/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 143.1-01 -- render-state test for the dial-reach orchestrator
 * (DIALTUI-01 + DIALTUI-02). Maps 1:1 to the UI-SPEC Section 7 state matrix
 * (S1/S2/S2-negative/S3/S4) plus the provenance contract (Section 6), the
 * two-K separation (V9), and the Part-8 LOCAL-only purity tripwire (V11/T-1431.01-01).
 *
 * The orchestrator is pure / synchronous / LOCAL-only. The test injects
 * deterministic per-reach score vectors via the reachScores seam (the
 * pre-baked BRAIN.md-derived priors the caller supplies through roomState)
 * and drives the frozen 0.70 / 0.15 gate per mode. No db / no fs writes /
 * no Brain / no network.
 *
 * No em-dashes anywhere (CLAUDE.md Part 8 / project hard rule). Hyphens only.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const ORCH_PATH = path.resolve(__dirname, '..', 'lib', 'hmi', 'dial-reach-orchestrator.cjs');
const RANKER_PATH = path.resolve(__dirname, '..', 'lib', 'workflow', 'f-selector-ranker.cjs');

function loadOrch() {
  delete require.cache[require.resolve(ORCH_PATH)];
  return require(ORCH_PATH);
}

// The 5 canonical reach ids, in frozen order (UI-SPEC Section 0).
const CANON_REACH_IDS = [
  'context_block',
  'contradiction',
  'cross_room',
  'brain_consult',
  'deep_research',
  'hats',
];

// Helper: build a roomState that pins each reach's score to a crafted value.
// The map keys are reach_ids; the orchestrator reads these as the pre-baked
// LOCAL priors (zero live Brain calls).
function stateWith(tierMode, scores) {
  return {
    tierMode,
    reachScores: scores,
  };
}

function countRecommended(reachList) {
  return reachList.reaches.filter((r) => r.recommended === true).length;
}

// ---------------------------------------------------------------------------
// Two-K separation (V9) -- assert FIRST so a regression on MAX_K is loud.
// ---------------------------------------------------------------------------

test('V9: DIAL_REACH_K is 6 and distinct from the untouched ranker MAX_K=3', () => {
  const orch = loadOrch();
  const ranker = require(RANKER_PATH);
  assert.strictEqual(orch.DIAL_REACH_K, 6, 'DIAL_REACH_K must be 6 (Phase 148 D-09 raised 5 -> 6)');
  assert.strictEqual(ranker.MAX_K, 3, 'ranker MAX_K must STILL be 3 (untouched)');
  assert.notStrictEqual(orch.DIAL_REACH_K, ranker.MAX_K, 'the two Ks must be distinct constants');
});

test('Orchestrator returns exactly 6 ranked reaches (DIAL_REACH_K), desc by score', () => {
  const orch = loadOrch();
  const rl = orch.buildReachList(stateWith('mode_a', {
    context_block: 0.87,
    contradiction: 0.61,
    cross_room: 0.54,
    brain_consult: 0.48,
    deep_research: 0.40,
    hats: 0.33,
  }));
  assert.strictEqual(rl.reaches.length, 6, 'must return exactly 6 reaches');
  for (let i = 1; i < rl.reaches.length; i++) {
    assert.ok(
      rl.reaches[i - 1].score >= rl.reaches[i].score,
      'reaches must be sorted descending by score',
    );
  }
  // Every canonical reach id present, no more, no fewer.
  const ids = rl.reaches.map((r) => r.reach_id).sort();
  assert.deepStrictEqual(ids, CANON_REACH_IDS.slice().sort());
});

// ---------------------------------------------------------------------------
// S1 -- Mode A, clear leader -> exactly 1 recommended (reach #1)
// ---------------------------------------------------------------------------

test('S1: mode_a clear leader [0.87,0.61,0.54] -> exactly 1 recommended (reach #1)', () => {
  const orch = loadOrch();
  const rl = orch.buildReachList(stateWith('mode_a', {
    context_block: 0.87,
    contradiction: 0.61,
    cross_room: 0.54,
    brain_consult: 0.48,
    deep_research: 0.40,
  }));
  assert.strictEqual(countRecommended(rl), 1, 'S1 must have exactly 1 marker');
  assert.strictEqual(rl.reaches[0].recommended, true, 'reach #1 is recommended');
  assert.strictEqual(rl.reaches[1].recommended, false, 'reach #2 is not recommended (margin guard)');
});

// ---------------------------------------------------------------------------
// S2 -- Mode A, near-tie (margin < 0.15) -> exactly 2 recommended (#1 + #2)
// ---------------------------------------------------------------------------

test('S2: mode_a near-tie [0.79,0.71,0.50] margin 0.08 -> exactly 2 recommended', () => {
  const orch = loadOrch();
  const rl = orch.buildReachList(stateWith('mode_a', {
    context_block: 0.79,
    contradiction: 0.71,
    cross_room: 0.50,
    brain_consult: 0.45,
    deep_research: 0.40,
  }));
  assert.strictEqual(countRecommended(rl), 2, 'S2 must have exactly 2 markers');
  assert.strictEqual(rl.reaches[0].recommended, true, 'reach #1 recommended');
  assert.strictEqual(rl.reaches[1].recommended, true, 'reach #2 recommended (near-tie)');
  assert.strictEqual(rl.reaches[2].recommended, false, 'reach #3 not recommended');
});

// ---------------------------------------------------------------------------
// S2-negative -- margin guard: reach#2 below floor OR margin too wide -> 1 marker.
// Proves the 0.70 floor is NEVER lowered to force a second marker (AP3).
// ---------------------------------------------------------------------------

test('S2-negative: mode_a [0.79,0.55] margin 0.24 > 0.15 -> exactly 1 recommended (0.70 floor held)', () => {
  const orch = loadOrch();
  const rl = orch.buildReachList(stateWith('mode_a', {
    context_block: 0.79,
    contradiction: 0.55,
    cross_room: 0.50,
    brain_consult: 0.45,
    deep_research: 0.40,
  }));
  assert.strictEqual(countRecommended(rl), 1, 'wide margin -> only reach #1');
  assert.strictEqual(rl.reaches[0].recommended, true);
  assert.strictEqual(rl.reaches[1].recommended, false, 'reach #2 below 0.70 AND wide margin -> never forced');
});

test('S2-negative-2: mode_a near-tie but reach#2 below 0.70 floor -> exactly 1 recommended', () => {
  const orch = loadOrch();
  // margin 0.05 < 0.15 (near-tie) BUT reach#2 = 0.66 < 0.70 floor.
  const rl = orch.buildReachList(stateWith('mode_a', {
    context_block: 0.71,
    contradiction: 0.66,
    cross_room: 0.50,
    brain_consult: 0.45,
    deep_research: 0.40,
  }));
  assert.strictEqual(countRecommended(rl), 1, 'near-tie cannot promote a below-floor reach#2');
  assert.strictEqual(rl.reaches[1].recommended, false, '0.70 floor is frozen, never lowered');
});

// ---------------------------------------------------------------------------
// S3 -- Mode B (Local Only) -> zero recommended
// ---------------------------------------------------------------------------

test('S3: mode_b any scores -> zero recommended (the 0.70 gate is a Brain-only concept)', () => {
  const orch = loadOrch();
  const rl = orch.buildReachList(stateWith('mode_b', {
    context_block: 0.99,
    contradiction: 0.98,
    cross_room: 0.97,
    brain_consult: 0.96,
    deep_research: 0.95,
  }));
  assert.strictEqual(rl.tier_mode, 'mode_b');
  assert.strictEqual(countRecommended(rl), 0, 'Mode B carries zero markers by design');
});

// ---------------------------------------------------------------------------
// S4 -- Tier 0 cold-room -> zero recommended
// ---------------------------------------------------------------------------

test('S4: tier_0 minimal set -> zero recommended', () => {
  const orch = loadOrch();
  const rl = orch.buildReachList(stateWith('tier_0', {}));
  assert.strictEqual(rl.tier_mode, 'tier_0');
  assert.strictEqual(countRecommended(rl), 0, 'Tier 0 carries zero markers by design');
  assert.ok(rl.reaches.length >= 1, 'Tier 0 still renders a non-empty reach set');
});

// ---------------------------------------------------------------------------
// Provenance (UI-SPEC Section 6) -- every reach exposes the full contract.
// ---------------------------------------------------------------------------

test('Provenance: every reach exposes {score, source, brain_component, local_component, recommended}', () => {
  const orch = loadOrch();
  const rl = orch.buildReachList(stateWith('mode_a', {
    context_block: 0.87,
    contradiction: 0.61,
    cross_room: 0.54,
    brain_consult: 0.48,
    deep_research: 0.40,
  }));
  for (const r of rl.reaches) {
    assert.strictEqual(typeof r.reach_id, 'string', 'reach_id is a string');
    assert.ok(CANON_REACH_IDS.indexOf(r.reach_id) !== -1, 'reach_id is canonical');
    assert.strictEqual(typeof r.canonical_verb, 'string', 'canonical_verb present');
    assert.strictEqual(typeof r.score, 'number', 'score is a number');
    assert.strictEqual(typeof r.source, 'string', 'source is a string');
    assert.ok(['local', 'registry', 'brain', 'blend'].indexOf(r.source) !== -1, 'source enum valid');
    assert.strictEqual(typeof r.brain_component, 'number', 'brain_component is a number');
    assert.strictEqual(typeof r.local_component, 'number', 'local_component is a number');
    assert.strictEqual(typeof r.recommended, 'boolean', 'recommended is a boolean');
  }
});

test('ReachList carries offered_count (<=3) and total_count (=N)', () => {
  const orch = loadOrch();
  const rl = orch.buildReachList(stateWith('mode_a', {
    context_block: 0.87,
    contradiction: 0.61,
    cross_room: 0.54,
    brain_consult: 0.48,
    deep_research: 0.40,
  }));
  assert.strictEqual(rl.total_count, 6, 'total_count is N (6)');
  assert.ok(rl.offered_count <= 3, 'offered_count never exceeds MAX_K=3');
  assert.strictEqual(rl.offered_count, Math.min(rl.reaches.length, 3));
});

// ---------------------------------------------------------------------------
// Pure / sync (D10) -- the orchestrator returns synchronously, not a Promise.
// ---------------------------------------------------------------------------

test('buildReachList is synchronous (returns a plain object, not a Promise)', () => {
  const orch = loadOrch();
  const rl = orch.buildReachList(stateWith('mode_a', { context_block: 0.5 }));
  assert.ok(rl && typeof rl === 'object', 'returns an object');
  assert.strictEqual(typeof rl.then, 'undefined', 'not a thenable / Promise');
});

// ---------------------------------------------------------------------------
// Part-8 LOCAL-only purity tripwire (T-1431.01-01 / V11). A source-grep
// asserting the orchestrator file contains zero network / Brain-client tokens.
// ---------------------------------------------------------------------------

test('Part 8: orchestrator source contains zero fetch / http / brain-client require tokens', () => {
  const src = fs.readFileSync(ORCH_PATH, 'utf8');
  // Strip block + line comments so a prose mention of a banned word in a
  // comment cannot trip the tripwire; only live code is scanned.
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  assert.ok(!/\bfetch\s*\(/.test(code), 'no live fetch( call');
  assert.ok(!/\bhttps?\b/.test(code), 'no http/https token in code');
  assert.ok(!/require\([^)]*brain[^)]*\)/i.test(code), 'no require of a brain client');
  assert.ok(!/\bawait\b/.test(code), 'no await (pure synchronous, no async Brain calls)');
});
