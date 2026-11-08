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
 * STATIC MODE (plan 370-10): node check-review-contract.cjs --check [--repo-root <dir>] [--strict]
 * It is the doctor coverage-gate entry. Offline. Three legs:
 *   templates  every fenced block of references/methodology/grade.md and agents/grading.md is scanned for an
 *              internal name or a dash; the block after the heading "## Artifact Template" must pass the
 *              full check; a block in commands/grade.md or commands/deep-grade.md directly under the line
 *              <!-- review-template --> must pass the full check
 *   fixtures   tests/fixtures/370/pre-fix.md must fail and post-fix.md must pass; skipped with an explicit
 *              SKIP line when tests/ is not in the layout (the npm pack does not ship tests/)
 *   contract   the contract data loads
 * OUTPUT: one LEG line per leg, one FINDING line per problem (leg, file, rule, class, line; never block
 * text), then RESULT OK, RESULT FAIL <n> or RESULT WARN <n>.
 * SEVERITY: read from enforcement.doctor_severity of data/review-contract.json. blocker: exit 1 on any
 * finding. advisory: FINDING lines go to stderr with the prefix WARN, exit 0. --strict: exit 1 on any
 * finding either way. off or missing: print "review-contract gate disabled by contract", exit 0.
 *
 * Reuse before build (Canon Part 7): no new framework. This file requires node built-ins and
 * ../lib/core/review-contract.cjs only. A switch-case router on process.argv, as in gsd-tools.cjs.
 */

const fs = require('fs');
const path = require('path');

const MAX_BYTES = 1000000;
const DEFAULT_ROOT = path.resolve(__dirname, '..');
const SHAPE_RULES = new Set(['shape_order', 'missing_section', 'extra_section', 'forbidden_section']);

const USAGE = 'usage: check-review-contract.cjs check <file|-> [--source <path>]... [--repo-root <dir>] | --check [--repo-root <dir>] [--strict]';

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

// ---------------------------------------------------------------------------
// Static mode (plan 370-10)
// ---------------------------------------------------------------------------

const TEMPLATE_MARKER = '<!-- review-template -->';
const REF_FILE = 'references/methodology/grade.md';
const AGENT_FILE = 'agents/grading.md';
const COMMAND_FILES = ['commands/grade.md', 'commands/deep-grade.md'];
const FIXTURE_DIR = 'tests/fixtures/370';
const DASH_OR_NAME_RULES = new Set(['internal_name', 'em_dash']);

// Fenced blocks of a text. Returns [{ startLine, text, marked }]. startLine is the 1-based line of the
// opening fence; marked is true when the line right above the fence is the review-template marker.
function fencedBlocks(text) {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let open = null;
  for (let i = 0; i < lines.length; i++) {
    const m = /^ {0,3}(`{3,}|~{3,})/.exec(lines[i]);
    if (open) {
      if (m && m[1].charAt(0) === open.ch && m[1].length >= open.len && /^[ \t]*$/.test(lines[i].slice(m[0].length))) {
        blocks.push({ startLine: open.line, text: open.buf.join('\n'), marked: open.marked });
        open = null;
      } else {
        open.buf.push(lines[i]);
      }
    } else if (m) {
      open = {
        ch: m[1].charAt(0), len: m[1].length, buf: [], line: i + 1,
        marked: i > 0 && lines[i - 1].trim() === TEMPLATE_MARKER,
      };
    }
  }
  return blocks;
}

// 1-based line number of the first line equal to the heading, or -1.
function headingLine(text, heading) {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) if (lines[i].trim() === heading) return i + 1;
  return -1;
}

function staticCheck(args) {
  let repoRoot = DEFAULT_ROOT;
  let strict = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--repo-root') {
      if (i + 1 >= args.length) fail(3, USAGE);
      repoRoot = path.resolve(args[++i]);
    } else if (args[i] === '--strict') {
      strict = true;
    } else {
      fail(3, USAGE);
    }
  }

  let RC;
  try {
    RC = require('../lib/core/review-contract.cjs');
  } catch (_) {
    return fail(3, 'cannot load the review contract module');
  }

  // Severity. An unreadable contract file fails closed (blocker) and the contract leg reports it.
  let severity = 'blocker';
  let raw = null;
  try {
    raw = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data', 'review-contract.json'), 'utf8'));
  } catch (_) { /* the contract leg reports it */ }
  if (raw && typeof raw === 'object') {
    const s = raw.enforcement && raw.enforcement.doctor_severity;
    severity = (s === 'blocker' || s === 'advisory') ? s : 'off';
  }
  if (severity === 'off' && !strict) {
    process.stdout.write('review-contract gate disabled by contract\n');
    process.exit(0);
  }

  const out = [];
  const findings = [];
  const legCount = { templates: 0, fixtures: 0, contract: 0 };
  const skipped = {};
  const add = (leg, file, rule, cls, line) => {
    findings.push('FINDING ' + leg + ' ' + file + ' ' + rule + ' ' + cls + ' line ' + line);
    legCount[leg]++;
  };
  const read = (rel) => {
    try {
      return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
    } catch (_) {
      return null;
    }
  };
  const safeCheck = (text) => {
    try {
      return RC.checkReview(text, { repoRoot });
    } catch (_) {
      return null;
    }
  };

  // ---- leg: contract
  try {
    RC.loadContract({ repoRoot });
  } catch (_) {
    add('contract', 'data/review-contract.json', 'contract_load', 'contract', 0);
  }

  // ---- leg: templates
  const scan = (rel, block, onlyNames) => {
    const res = safeCheck(block.text);
    if (!res) {
      add('templates', rel, 'check_error', 'template', block.startLine);
      return;
    }
    for (const v of res.violations) {
      if (onlyNames && !DASH_OR_NAME_RULES.has(v.rule)) continue;
      add('templates', rel, v.rule, v.class, block.startLine + v.line);
    }
  };
  const ref = read(REF_FILE);
  if (ref === null) {
    add('templates', REF_FILE, 'missing_file', 'template', 0);
  } else {
    const at = headingLine(ref, '## Artifact Template');
    let full = null;
    if (at === -1) {
      add('templates', REF_FILE, 'missing_template', 'template', 0);
    } else {
      full = fencedBlocks(ref).find((b) => b.startLine > at) || null;
      if (!full) add('templates', REF_FILE, 'missing_template', 'template', at);
    }
    for (const b of fencedBlocks(ref)) scan(REF_FILE, b, !(full && b.startLine === full.startLine));
  }
  const agent = read(AGENT_FILE);
  if (agent === null) {
    add('templates', AGENT_FILE, 'missing_file', 'template', 0);
  } else {
    for (const b of fencedBlocks(agent)) scan(AGENT_FILE, b, true);
  }
  for (const rel of COMMAND_FILES) {
    const t = read(rel);
    if (t === null) {
      add('templates', rel, 'missing_file', 'template', 0);
      continue;
    }
    for (const b of fencedBlocks(t)) if (b.marked) scan(rel, b, false);
  }

  // ---- leg: fixtures
  if (!fs.existsSync(path.join(repoRoot, 'tests'))) {
    skipped.fixtures = true;
  } else {
    for (const [name, wantOk] of [['pre-fix.md', false], ['post-fix.md', true]]) {
      const rel = FIXTURE_DIR + '/' + name;
      const t = read(rel);
      if (t === null) {
        add('fixtures', rel, 'missing_file', 'fixture', 0);
        continue;
      }
      const res = safeCheck(t);
      if (!res) {
        add('fixtures', rel, 'check_error', 'fixture', 0);
      } else if (res.ok !== wantOk) {
        add('fixtures', rel, wantOk ? 'fixture_should_pass' : 'fixture_should_fail', 'fixture', 0);
      }
    }
  }

  for (const leg of ['templates', 'fixtures', 'contract']) {
    if (skipped[leg]) out.push('LEG ' + leg + ' SKIP');
    else out.push('LEG ' + leg + ' ' + (legCount[leg] === 0 ? 'OK' : 'FINDINGS ' + legCount[leg]));
  }
  if (skipped.fixtures) out.push('SKIP fixtures: tests/ is not in this layout');

  const n = findings.length;
  const warnOnly = severity === 'advisory' && !strict;
  if (n === 0) {
    out.push('RESULT OK');
  } else if (warnOnly) {
    out.push('RESULT WARN ' + n);
    process.stderr.write(findings.map((f) => 'WARN ' + f).join('\n') + '\n');
  } else {
    out.push('RESULT FAIL ' + n);
    out.splice(3, 0, ...findings);
  }
  process.stdout.write(out.join('\n') + '\n');
  process.exit(n > 0 && !warnOnly ? 1 : 0);
}

const cmd = process.argv[2];
switch (cmd) {
  case 'check':
    cmdCheck(process.argv.slice(3));
    break;
  case '--check':
    staticCheck(process.argv.slice(3));
    break;
  default:
    fail(3, USAGE);
}
