#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * scripts/review-contract-hook.cjs -- Phase 370 plan 06 (review-contract)
 * ======================================================================
 * WHAT IT IS: a PreToolUse hook for the Write tool only. When Claude Code
 * writes a grade or deep-grade review with the plain Write tool, this hook
 * runs checkReview (lib/core/review-contract.cjs) over the content. It closes
 * the gap where a model skips the pre-file step (scripts/check-review-contract.cjs).
 *
 * SCOPE: Write only. Write carries the whole file in tool_input.content. Edit
 * and MultiEdit carry a diff, so they are not covered (stated limit). The
 * door, the pre-file step and the doctor template lint cover those.
 *
 * PATH RULES (all run BEFORE the content is looked at; a false block is worse
 * than a false allow, the rule of scripts/write-scope-check.cjs):
 *   1. The file path must end in .md (case-insensitive). Else exit 0.
 *   2. Resolve the path against the payload cwd (the process cwd when the
 *      payload has none). A result inside the plugin repo root (the folder
 *      above scripts/) is skipped.
 *   3. When the payload has a cwd and the result is inside it, take the path
 *      RELATIVE to that cwd. Any segment named pipelines, tests, .planning,
 *      references, agents, commands or skills means repo source: skip. This
 *      protects a developer who works in a checkout. A repo spec such as
 *      pipelines/PWS_grading/01-deep-grade.md carries methodology: deep-grade,
 *      and the planted fixture tests/fixtures/370/pre-fix.md carries
 *      review_contract: 1; a Write of either is never checked or logged.
 *   4. An absolute path outside the cwd and outside the repo root is NEVER
 *      skipped on segment names. A student review under ~/agents/room/x/ or
 *      under a parent folder named tests is still checked. The hook runs from
 *      the plugin install, which is not a developer checkout.
 *   Stated limit: a student whose cwd is a folder ABOVE a folder named agents,
 *   tests and so on, and who writes a review there, is skipped by rule 3.
 *
 * THEN THE CONTENT: a quick header check returns at once for anything that is
 * not a review (the text holds neither "methodology:" nor "review_contract"),
 * before any module is loaded. Only then the contract module is required,
 * isReviewArtifact confirms the header, and checkReview runs with
 * softTerms: 'skip' (the hook has no student text to exempt a plain word with).
 *
 * MODES (data/review-contract.json, enforcement.hook_mode, owner item O6B):
 *   log-only (owner answer 2026-11-08): exit 0, no output, one local log row
 *            (policy review-contract-body) with rule/class@line triples only.
 *   enforce: exit 2, stderr lists rule, class and line. The path exists and
 *            is OFF until the owner sets the mode.
 *   any other value (off, missing): exit 0.
 *
 * FAIL OPEN: empty or malformed input, any throw, a missing module, an unknown
 * tool, a missing file path or a file with no review header all exit 0 with
 * no output.
 *
 * --contract <path> is for tests only. hooks.json never passes it. There is no
 * environment override, so the model cannot weaken the check.
 *
 * Canon Part 8: local only. No network, no Brain call. The stderr message and
 * the log row hold rule ids, classes and line numbers, never body text.
 *
 * No em-dashes. License: BSL 1.1.
 */

const fs = require('node:fs');
const path = require('node:path');

const MAX_STDIN_BYTES = 1000000;
const REPO_ROOT = path.resolve(__dirname, '..');
const REPO_SOURCE_SEGMENTS = ['pipelines', 'tests', '.planning', 'references', 'agents', 'commands', 'skills'];
const POLICY_ID = 'review-contract-body';

function done(code) {
  process.exit(code);
}

// Read stdin synchronously, bounded. Returns '' on any error or when the input is too large.
function readStdinBounded() {
  try {
    const chunks = [];
    let total = 0;
    const buf = Buffer.alloc(65536);
    for (;;) {
      let n;
      try {
        n = fs.readSync(0, buf, 0, buf.length, null);
      } catch (e) {
        if (e && e.code === 'EAGAIN') continue;
        if (e && e.code === 'EOF') break;
        break;
      }
      if (!n) break;
      total += n;
      if (total > MAX_STDIN_BYTES) return '';
      chunks.push(Buffer.from(buf.subarray(0, n)));
    }
    return Buffer.concat(chunks).toString('utf8');
  } catch (_) {
    return '';
  }
}

function contractArg() {
  const i = process.argv.indexOf('--contract');
  if (i !== -1 && typeof process.argv[i + 1] === 'string' && process.argv[i + 1]) return process.argv[i + 1];
  return null;
}

// True when p sits inside base (or equals it).
function isInside(base, p) {
  const rel = path.relative(base, p);
  if (rel === '') return true;
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

// The path rules. Returns true when the file must NOT be checked.
function skipByPath(filePath, payloadCwd) {
  if (!/\.md$/i.test(filePath)) return true;
  const hasCwd = typeof payloadCwd === 'string' && payloadCwd.length > 0;
  const base = hasCwd ? payloadCwd : process.cwd();
  const resolved = path.resolve(base, filePath);
  if (isInside(REPO_ROOT, resolved)) return true;
  if (hasCwd && isInside(payloadCwd, resolved)) {
    const rel = path.relative(payloadCwd, resolved);
    const segments = rel.split(/[\\/]+/).filter(Boolean);
    for (const seg of segments) {
      if (REPO_SOURCE_SEGMENTS.indexOf(seg) !== -1) return true;
    }
  }
  return false;
}

function main() {
  const raw = readStdinBounded();
  if (!raw || !raw.trim()) return done(0);

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (_) {
    return done(0);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return done(0);

  if (payload.tool_name !== undefined && payload.tool_name !== 'Write') return done(0);
  const toolInput = payload.tool_input;
  if (!toolInput || typeof toolInput !== 'object') return done(0);

  const filePath = toolInput.file_path;
  if (typeof filePath !== 'string' || !filePath) return done(0);
  if (skipByPath(filePath, payload.cwd)) return done(0);

  const content = toolInput.content;
  if (typeof content !== 'string') return done(0);

  // Quick header check: no module is loaded for anything that is not a review.
  if (content.indexOf('methodology:') === -1 && content.indexOf('review_contract') === -1) return done(0);

  const contractPath = contractArg();
  const rc = require('../lib/core/review-contract.cjs');
  const contract = contractPath ? rc.loadContract({ contractPath }) : rc.loadContract({});
  if (!rc.isReviewArtifact(content, { contract })) return done(0);

  const enforcement = contract && typeof contract.enforcement === 'object' && contract.enforcement ? contract.enforcement : {};
  const mode = enforcement.hook_mode;
  if (mode !== 'log-only' && mode !== 'enforce') return done(0);

  const result = rc.checkReview(content, { softTerms: 'skip', contract });
  if (!result || result.ok === true || !Array.isArray(result.violations) || result.violations.length === 0) return done(0);

  if (mode === 'log-only') {
    const triples = result.violations.map((v) => v.rule + '/' + v.class + '@' + v.line).join(' ');
    const sid = typeof payload.session_id === 'string' ? payload.session_id : '';
    require('../lib/hmi/voice-style-log.cjs').appendVoiceStyleRow({
      policy_id: POLICY_ID,
      result: 'fire',
      detail: triples,
      session_id: sid,
    });
    return done(0);
  }

  const out = [];
  out.push('Review contract: this review has internal names or a wrong shape, so it was not written (reason review_contract_violation).');
  for (const v of result.violations) {
    out.push('- ' + v.rule + ' (' + v.class + ') line ' + v.line);
  }
  out.push('Rewrite the review for the student without tool, agent, command or system names, keep the fixed shape, and write it again.');
  process.stderr.write(out.join('\n') + '\n');
  return done(2);
}

try {
  main();
} catch (_) {
  // Fail open: any error exits 0 with no output.
  process.exit(0);
}
