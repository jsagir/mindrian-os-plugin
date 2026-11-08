#!/usr/bin/env node
'use strict';

/*
 * check-review-contract.cjs - the pre-file CLI wrapper for the review contract (Phase 370, plan 08).
 *
 * WHAT IT IS: a thin command-line door around checkReview in lib/core/review-contract.cjs. The two grade
 * commands run a draft review through this wrapper before they file it: write the draft to a scratch file,
 * run the wrapper, fix what it lists, retry, then file. The wrapper decides nothing itself. The output
 * and the exit code are the module result and nothing else.
 *
 * USAGE:
 *   node "${CLAUDE_PLUGIN_ROOT}/scripts/check-review-contract.cjs" check <file|-> [--source <path>]... [--repo-root <dir>]
 *   <file|->      a draft review file, or - for standard input
 *   --source P    the student's own source text, used for the soft-term exemption (owner item O3).
 *                 P is a file (read as text) or a directory (read through collectSourceText).
 *                 It may be repeated.
 *   --repo-root D the repo root that holds agents/, data/ (default: the root of this script)
 *
 * OUTPUT (stdout):
 *   OK review-contract v<version>                          when the review passes
 *   VIOLATION <rule> <class> line <n> tier <tier>          one line per violation
 *   EXPECTED-HEADINGS <heading>|<heading>|...              only when a shape rule failed
 *   RESULT FAIL <count>                                    last line when there is a violation
 * The EXPECTED-HEADINGS line lists the six section headings in order and then the optional tail
 * heading marked (optional). Those are contract headings, not review text.
 *
 * OUTPUT RULE (Canon Part 8, threat T-370-38): the wrapper prints a rule id, a tier, a class, a line
 * number and a count. It never prints the review body, a heading text from the review, or the matched
 * term. Local files only. No network. No Brain call.
 *
 * EXIT CODES: 0 the review passes, 1 one or more violations, 3 usage error or read error (also an input
 * over 1000000 bytes).
 *
 * The static --check mode of this script is added by plan 370-10. Until then --check prints one
 * line on stderr and exits 3.
 *
 * Reuse before build (Canon Part 7): no new framework. This file requires node built-ins and
 * ../lib/core/review-contract.cjs only. A switch-case router on process.argv, as in gsd-tools.cjs.
 */

const fs = require('fs');
const path = require('path');

const MAX_BYTES = 1000000;
const DEFAULT_ROOT = path.resolve(__dirname, '..');
const SHAPE_RULES = new Set(['shape_order', 'missing_section', 'extra_section', 'forbidden_section']);

const USAGE = 'usage: check-review-contract.cjs check <file|-> [--source <path>]... [--repo-root <dir>]';

function fail(code, message) {
  process.stderr.write(message + '\n');
  process.exit(code);
}

function sizeFail() {
  fail(3, 'input is over ' + MAX_BYTES + ' bytes (size limit); the review was not checked');
}

// Read a file as text. Never echoes content. Errors name the problem and the path only.
function readTextFile(p, what) {
  let st;
  try {
    st = fs.statSync(p);
  } catch (_) {
    fail(3, 'cannot read ' + what + ': ' + p);
  }
  if (!st.isFile()) fail(3, 'cannot read ' + what + ' (not a file): ' + p);
  if (what === 'file' && st.size > MAX_BYTES) sizeFail();
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (_) {
    return fail(3, 'cannot read ' + what + ': ' + p);
  }
}

// Read standard input up to the bound. Stops at once when the bound is passed.
function readStdin() {
  const chunks = [];
  let total = 0;
  const buf = Buffer.alloc(65536);
  for (;;) {
    let n;
    try {
      n = fs.readSync(0, buf, 0, buf.length, null);
    } catch (e) {
      if (e && e.code === 'EAGAIN') {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
        continue;
      }
      if (e && e.code === 'EOF') break;
      return fail(3, 'cannot read standard input');
    }
    if (n === 0) break;
    total += n;
    if (total > MAX_BYTES) sizeFail();
    chunks.push(Buffer.from(buf.subarray(0, n)));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function parseCheckArgs(args) {
  const out = { target: null, sources: [], repoRoot: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--source') {
      if (i + 1 >= args.length) fail(3, USAGE);
      out.sources.push(args[++i]);
    } else if (a === '--repo-root') {
      if (i + 1 >= args.length) fail(3, USAGE);
      out.repoRoot = args[++i];
    } else if (a === '-' || a.charAt(0) !== '-') {
      if (out.target !== null) fail(3, USAGE);
      out.target = a;
    } else {
      fail(3, USAGE);
    }
  }
  if (out.target === null) fail(3, USAGE);
  return out;
}

function expectedHeadings(contract) {
  const parts = contract.sections.map((s) => s.heading);
  for (const t of contract.optional_tail || []) parts.push(t.heading + ' (optional)');
  return parts.join('|');
}

function cmdCheck(args) {
  const opts = parseCheckArgs(args);
  const repoRoot = opts.repoRoot ? path.resolve(opts.repoRoot) : DEFAULT_ROOT;

  let RC;
  try {
    RC = require('../lib/core/review-contract.cjs');
  } catch (_) {
    return fail(3, 'cannot load the review contract module');
  }

  const text = opts.target === '-' ? readStdin() : readTextFile(opts.target, 'file');

  const pieces = [];
  for (const s of opts.sources) {
    let st;
    try {
      st = fs.statSync(s);
    } catch (_) {
      return fail(3, 'cannot read source: ' + s);
    }
    if (st.isDirectory()) {
      pieces.push(RC.collectSourceText(s));
    } else {
      pieces.push(readTextFile(s, 'source'));
    }
  }
  const sourceText = pieces.length > 0 ? pieces.join('\n') : undefined;

  let result;
  let contract;
  try {
    contract = RC.loadContract({ repoRoot });
    result = RC.checkReview(text, { repoRoot, sourceText });
  } catch (e) {
    return fail(3, 'review contract could not run: ' + ((e && e.code) || 'error'));
  }

  if (result.ok) {
    process.stdout.write('OK review-contract v' + result.contract_version + '\n');
    process.exit(0);
  }

  const lines = [];
  let shape = false;
  for (const v of result.violations) {
    lines.push('VIOLATION ' + v.rule + ' ' + v.class + ' line ' + v.line + ' tier ' + v.tier);
    if (SHAPE_RULES.has(v.rule)) shape = true;
  }
  if (shape) lines.push('EXPECTED-HEADINGS ' + expectedHeadings(contract));
  lines.push('RESULT FAIL ' + result.violations.length);
  process.stdout.write(lines.join('\n') + '\n');
  process.exit(1);
}

const cmd = process.argv[2];
switch (cmd) {
  case 'check':
    cmdCheck(process.argv.slice(3));
    break;
  case '--check':
    fail(3, 'static check not available yet (plan 370-10)');
    break;
  default:
    fail(3, USAGE);
}
