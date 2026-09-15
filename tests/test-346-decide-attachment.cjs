'use strict';
// Phase 346-07 -- attach the arbiter to decide() without creating a second
// selection brain, behind one blocking navigator checkpoint (ratified in the
// live orchestrator session, see 346-07-SUMMARY.md's Task 1 provenance note).
//
// Two tasks land in this one file, in order:
//   Task 2: the null default in emptyDecisionTrace and the ctx-assembly
//     threading (arbitrationResult computed once, before any return path,
//     unused until Task 3 wires it).
//   Task 3: applyArbitration on both return paths, with the null no-op
//     proven byte-identical, plus the 60-case non-interference sweep.
//
// House idiom: node:assert/strict, `let n = 0; function ok(desc, fn)`, final
// line '>>> test-346-decide-attachment.cjs: PASSED'.
//
// House rule: hyphens only, no em-dashes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const SHARED_PATH = path.join(REPO, 'lib', 'core', 'navigation-engine-shared.cjs');
const ENGINE_PATH = path.join(REPO, 'lib', 'core', 'navigation-engine.cjs');
const ARBITRATION_PATH = path.join(REPO, 'lib', 'core', 'arbitration.cjs');

const shared = require(SHARED_PATH);
const engine = require(ENGINE_PATH);

const decide = engine.decide;

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-346-decide-attachment');

// ---------------------------------------------------------------------------
// Task 2: the null default in emptyDecisionTrace, and the once-before-any-
// return computation (unused at the end of Task 2; wired by Task 3).
// ---------------------------------------------------------------------------

ok('emptyDecisionTrace().arbitration is null, not undefined', function () {
  const t = shared.emptyDecisionTrace();
  assert.equal('arbitration' in t, true);
  assert.equal(t.arbitration, null);
});

ok('emptyDecision().decision_trace.arbitration is null', function () {
  assert.equal(shared.emptyDecision().decision_trace.arbitration, null);
});

ok('emptyDecisionTrace() key count grows by exactly one versus the pre-plan snapshot; no key removed or renamed', function () {
  const PRE_PLAN_KEYS = [
    'brain_md_version', 'brain_md_staleness', 'brain_md_stale_reason',
    'brain_md_weight_applied', 'brain_md_recommended_confidence',
    'brain_md_recommended_marker_rendered', 'brain_md_tier_mode',
    'brain_md_sections_consumed', 'brain_pattern_verb', 'brain_pattern_verb_confidence',
    'navigated_neighborhood', 'icm_scope', 'sql_signals', 'minto_reasoning',
    'intent_persona', 'chosen_rationale', 'projection_offer',
  ];
  const keys = Object.keys(shared.emptyDecisionTrace());
  PRE_PLAN_KEYS.forEach(function (k) {
    assert.ok(keys.indexOf(k) !== -1, 'missing pre-plan key: ' + k);
  });
  assert.equal(keys.length, PRE_PLAN_KEYS.length + 1, 'expected exactly one new key on top of the pre-plan set');
  const added = keys.filter(function (k) { return PRE_PLAN_KEYS.indexOf(k) === -1; });
  assert.deepEqual(added, ['arbitration'], 'the one added key must be "arbitration"');
});

ok('decide() opens no file and no database to compute the arbitration (source scan of the computation block)', function () {
  const src = fs.readFileSync(ENGINE_PATH, 'utf8');
  const startMarker = 'let arbitrationResult = null;';
  const startIdx = src.indexOf(startMarker);
  assert.ok(startIdx !== -1, 'arbitrationResult computation block not found');
  // The block ends at the next "let quadruple = ctx.quadruple;" (the start of
  // the pre-existing per-turn cache scope, unmoved by this plan).
  const endIdx = src.indexOf('let quadruple = ctx.quadruple;', startIdx);
  assert.ok(endIdx !== -1 && endIdx > startIdx, 'could not bound the arbitration computation block');
  const block = src.slice(startIdx, endIdx);
  assert.equal(/\bfs\./.test(block), false, 'the arbitration computation block must not read fs');
  assert.equal(/openRoomDb/.test(block), false, 'the arbitration computation block must not open room.db');
  const requireMatches = [...block.matchAll(/require\(['"]([^'"]+)['"]\)/g)].map(function (m) { return m[1]; });
  assert.deepEqual(requireMatches, ['./arbitration.cjs'], 'the only require added in this block is ./arbitration.cjs');
});

ok('a resolver fault (module require throws) degrades arbitrationResult to null, never a crash (proven end to end via decide())', function () {
  const original = require.cache[ARBITRATION_PATH];
  require.cache[ARBITRATION_PATH] = {
    id: ARBITRATION_PATH, filename: ARBITRATION_PATH, loaded: true,
    exports: { resolveArbitration: function () { throw new Error('injected-arbitration-fault'); } },
  };
  try {
    const decision = decide({}, {});
    assert.equal(decision.decision_trace.arbitration, null);
  } finally {
    if (original) { require.cache[ARBITRATION_PATH] = original; } else { delete require.cache[ARBITRATION_PATH]; }
  }
});

console.log(n + ' assertions passed');
console.log('>>> test-346-decide-attachment.cjs: PASSED');
process.exit(0);
