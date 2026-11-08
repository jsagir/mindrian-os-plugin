'use strict';
/*
 * Phase 118-06 Plan 06 -- Dror 2.0 Acceptance Harness (reduced by Phase 389 plan 07).
 *
 * The source-spec's hardest acceptance criterion (the-30-second-mva.md
 * line 129): "subject types one sentence and clicks an option within 60
 * seconds of the brief rendering." The harness first spawned the per-message
 * hook scripts/mva-detect.cjs. Phase 389 plan 07 (owner card D1 APPROVE,
 * 2026-11-08) removed that hook: the venture verdict is now taken once by
 * scripts/first-install-router.cjs from the sync heuristic classify of
 * lib/core/mva-classifier.cjs (pinned by tests/test-389-first-install-seed.cjs).
 * This harness keeps what is still true of the classification phase, on the
 * classifier itself, for the same 3 fixture sentences:
 *
 *   Test 1: VENTURE_EN ("I have an idea for a couples finance app")
 *           classify -> venture true, within the classification budget.
 *
 *   Test 2: NON_VENTURE ("fix the failing test in src/foo.test.ts")
 *           classify -> venture false.
 *
 *   Test 3 (CRITICAL-1+5 -- LD1 LOCKED Hebrew refusal):
 *           HEBREW = (a short Hebrew sentence, see the const below)
 *           Harness reads LD1 from 118-CONTEXT.md at startup; LD1 is
 *           LOCKED (English-only for v1.13.0; OQ1 is CLOSED per LD1).
 *           The harness asserts the classifier refuses Hebrew (venture false,
 *           reason hebrew_unsupported_v1.13.0). The ONLY failure mode for the
 *           LD1 read is if LD1 is DELETED from 118-CONTEXT.md (canon-deletion
 *           guard).
 *           Future-grep keywords: LD1, LOCKED -- the literal substrings
 *           MUST appear inline so reviewers can confirm OQ1 is closed.
 *
 * Removed with the hook (it had no other home): the pending state file and the
 * no-double-fire concurrency invariant (Test 4), and the hook telemetry check.
 * The downstream pipeline budget is asserted by mva-orchestrator.test.cjs.
 *
 * Pure CJS, node built-ins only.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const classifier = require(path.resolve(REPO_ROOT, 'lib', 'core', 'mva-classifier.cjs'));
const CONTEXT_PATH = path.resolve(
  REPO_ROOT,
  '.planning',
  'phases',
  '118-30-second-mva-reward-before-investment',
  '118-CONTEXT.md'
);

// Per source spec line 129: "within 60 seconds of the brief rendering."
// Plan 118-03 budget cap is 45000ms (WARN-2 field name total_duration_ms).
// This harness asserts the CLASSIFICATION + state-write phase, which is
// itself <= 1500ms per the hook budget. We use a generous 10s ceiling to
// accommodate cold-process JIT and slow CI runners while still surfacing
// any catastrophic regression. The downstream brief-rendering 45s budget
// is asserted by mva-orchestrator.test.cjs.
const MAX_TIME_MS = 60000; // hard ceiling per source spec line 129
const HOOK_BUDGET_MS = 10000; // classification-phase budget for this harness

// ---------- Fixture sentences ----------

const VENTURE_EN = 'I have an idea for a couples finance app';
const NON_VENTURE = 'fix the failing test in src/foo.test.ts';
const HEBREW = '\u05D9\u05E9 \u05DC\u05D9 \u05E8\u05E2\u05D9\u05D5\u05DF \u05DC\u05D0\u05E4\u05DC\u05D9\u05E7\u05E6\u05D9\u05D4 \u05DC\u05D6\u05D5\u05D2\u05D5\u05EA';

// ---------- LD1 LOCKED reader (CRITICAL-1+5) ----------

/*
 * CRITICAL-1+5: read LD1 LOCKED decision from 118-CONTEXT.md.
 * Future-grep keywords: LD1, LOCKED -- these literal substrings MUST
 * appear here so reviewers / future planners can confirm OQ1 is closed.
 *
 * LD1 LOCKS English-only for v1.13.0 (resolves OQ1). The harness asserts
 * the LD1 behavior, not a runtime-resolved OQ1. The ONLY failure mode is
 * if LD1 is DELETED from 118-CONTEXT.md (canon-deletion guard).
 */
function readLD1FromContext() {
  const ctx = fs.readFileSync(CONTEXT_PATH, 'utf8');
  // LD1 LOCKED: English-only for v1.13.0 (resolves OQ1)
  // The harness asserts the LD1 behavior, not a runtime-resolved OQ1.
  const ld1Match = ctx.match(/### LD1[^\n]*\n([\s\S]*?)(?=\n### |\n---|\Z)/);
  if (!ld1Match) {
    throw new Error(
      'LD1 LOCKED block not found in 118-CONTEXT.md -- the canon expected ' +
      'English-only for v1.13.0 is missing. Restore LD1 before running the ' +
      'harness. The harness no longer reads a runtime-resolved OQ1; LD1 ' +
      'supersedes it.'
    );
  }
  const body = ld1Match[1];
  // Sanity: the LD1 block must explicitly LOCK English-only behavior.
  if (!/English-only/i.test(body)) {
    throw new Error(
      'LD1 block found but does not LOCK English-only behavior. ' +
      'Expected substring "English-only" in the LD1 body; got: ' +
      body.slice(0, 200)
    );
  }
  return {
    locked: true,
    english_only_v1_13_0: true,
    source: 'LD1',
    context_path: '118-CONTEXT.md',
  };
}

// ---------- Test runner ----------

let passed = 0;
let failed = 0;
const results = [];

function run(name, fn) {
  const t0 = Date.now();
  try {
    fn();
    const elapsed = Date.now() - t0;
    process.stdout.write('ok  ' + name + ' (' + elapsed + 'ms)\n');
    results.push({ name, status: 'PASS', elapsed_ms: elapsed });
    passed += 1;
  } catch (err) {
    const elapsed = Date.now() - t0;
    process.stderr.write('FAIL ' + name + ' (' + elapsed + 'ms)\n' +
      (err && err.stack ? err.stack : String(err)) + '\n');
    results.push({ name, status: 'FAIL', elapsed_ms: elapsed, error: err && err.message });
    failed += 1;
  }
}

// ---------- Load LD1 once at startup (CRITICAL-1+5) ----------

let LD1;
try {
  LD1 = readLD1FromContext();
  process.stdout.write('LD1 LOCKED: ' + JSON.stringify(LD1) + '\n');
} catch (err) {
  process.stderr.write('FATAL: ' + err.message + '\n');
  process.exit(2);
}

// ---------- Test 1: VENTURE_EN happy path ----------

run('Test 1 VENTURE_EN: classifier identifies venture within the classification budget', () => {
  const t0 = Date.now();
  const verdict = classifier.classify(VENTURE_EN);
  const elapsed = Date.now() - t0;
  assert.equal(verdict.venture, true, 'expected venture true; got ' + JSON.stringify(verdict));
  assert.ok(elapsed <= HOOK_BUDGET_MS, 'classification phase took ' + elapsed + 'ms; budget ' + HOOK_BUDGET_MS + 'ms');
  assert.ok(elapsed <= MAX_TIME_MS, 'classification phase exceeded source-spec ceiling (' + MAX_TIME_MS + 'ms)');
});

// ---------- Test 2: NON_VENTURE ----------

run('Test 2 NON_VENTURE: classifier rejects a non-venture sentence', () => {
  const verdict = classifier.classify(NON_VENTURE);
  assert.equal(verdict.venture, false, 'expected venture false; got ' + JSON.stringify(verdict));
});

// ---------- Test 3 (CRITICAL-1+5): LD1 LOCKED Hebrew refusal ----------

run('Test 3 (LD1 LOCKED -- OQ1 closed): Hebrew sentence is refused by the classifier', () => {
  // LD1 LOCKS English-only for v1.13.0. LD1 supersedes OQ1.
  assert.ok(LD1.locked, 'LD1 must be LOCKED at this point (read at harness startup)');
  assert.ok(LD1.english_only_v1_13_0, 'LD1 LOCKS English-only behavior');
  const verdict = classifier.classify(HEBREW);
  assert.equal(verdict.venture, false, 'expected venture false per LD1; got ' + JSON.stringify(verdict));
  assert.equal(verdict.source, 'language_detect', 'expected source language_detect per LD1; got ' + verdict.source);
  assert.match(verdict.reason, /^hebrew/, 'expected a hebrew reason per LD1; got ' + verdict.reason);
});

// ---------- Summary ----------

process.stdout.write('\n=========================================\n');
process.stdout.write('Dror 2.0 harness results\n');
process.stdout.write('=========================================\n');
for (const r of results) {
  const tag = r.status === 'PASS' ? 'PASS' : 'FAIL';
  process.stdout.write('  ' + tag + ' ' + r.name + ' (' + r.elapsed_ms + 'ms)\n');
}
process.stdout.write('\n' + passed + '/' + (passed + failed) + ' passed\n');
process.stdout.write('LD1 LOCKED reference: ' + JSON.stringify(LD1) + '\n');

if (failed > 0) {
  process.exit(1);
}
process.exit(0);
