#!/usr/bin/env node
'use strict';

/**
 * Phase 259 Plan 03 (TRUST-02) -- the VOID verdict, zero-I/O, pure fixtures.
 * ==========================================================================
 * scripts/check-flagship-floor.cjs::evaluateFloor() currently stamps any
 * probe row lacking a clean numeric result as MISS, so a rate-limited probe,
 * a timed-out probe, and a framework that genuinely misses the floor are
 * byte-identical to the operator and to any automation reading the exit
 * code. This suite proves a third verdict, VOID, triggered by any of D-05's
 * three failure modes (hard_error / timeout / malformed) on a probe row,
 * with its own voidCount and exit code 3 -- and that a VOID row is never
 * silently counted as PASS (the old passCount arithmetic bug) or folded
 * into missCount (the false-MISS this phase exists to kill).
 *
 * Skeleton copied from tests/test-249-floor-gate.cjs (fixture builders,
 * shared ALL_GREEN fixtures, the sabotage-from-green RED PROOF shape).
 * Uses node:assert/strict (not the older loose node:assert 249 uses --
 * PATTERNS.md Correction 1). Zero network, zero I/O. No new deps.
 * No em-dashes.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { evaluateFloor, parseOverrideFile, CANON_PROSE_COMMAND_COUNT, renderVoidDetailLines, renderFloorSummaryLines } = require('../scripts/check-flagship-floor.cjs');

// ---------------------------------------------------------------------------
// Fixture builders (duplicated from test-249-floor-gate.cjs -- the existing
// repo norm for two trivial three-line builders).
// ---------------------------------------------------------------------------
function fw(name, uses) {
  return { name, uses };
}

function probe(matches, score) {
  return { normalizeMatches: matches, readinessScore: score, normalizeOk: true, readinessOk: true };
}

function failing(kind, httpStatus, detail, whichProbe) {
  return {
    ...probe(null, null),
    failures: [{ probe: whichProbe || 'readiness', kind, httpStatus, detail }],
  };
}

const ALL_GREEN_FRAMEWORKS = [fw('Beautiful Question Framework', 5), fw('Problem Definition Transformation', 3), fw("Usher's Model", 2)];
const ALL_GREEN_PROBES = {
  'Beautiful Question Framework': probe(1, 4),
  'Problem Definition Transformation': probe(1, 4),
  "Usher's Model": probe(1, 3),
};

// ---------------------------------------------------------------------------
// Each of the three D-05 trigger types produces VOID.
// ---------------------------------------------------------------------------
test('evaluateFloor: a probe row with a hard_error failure is VOID', () => {
  const probes = { ...ALL_GREEN_PROBES, "Usher's Model": failing('hard_error', 429, 'Rate limit exceeded') };
  const r = evaluateFloor(ALL_GREEN_FRAMEWORKS, probes);
  const row = r.rows.find((x) => x.name === "Usher's Model");
  assert.equal(row.verdict, 'VOID', 'a hard_error probe failure must VOID the row, never MISS');
});

test('evaluateFloor: a probe row with a timeout failure is VOID', () => {
  const probes = { ...ALL_GREEN_PROBES, "Usher's Model": failing('timeout', 0, 'The operation was aborted due to timeout') };
  const r = evaluateFloor(ALL_GREEN_FRAMEWORKS, probes);
  const row = r.rows.find((x) => x.name === "Usher's Model");
  assert.equal(row.verdict, 'VOID', 'a timeout probe failure must VOID the row, never MISS');
});

test('evaluateFloor: a probe row with a malformed failure is VOID', () => {
  const probes = { ...ALL_GREEN_PROBES, "Usher's Model": failing('malformed', 200, 'no SSE data line in response: ...') };
  const r = evaluateFloor(ALL_GREEN_FRAMEWORKS, probes);
  const row = r.rows.find((x) => x.name === "Usher's Model");
  assert.equal(row.verdict, 'VOID', 'a malformed probe failure must VOID the row, never MISS');
});

// ---------------------------------------------------------------------------
// VOID outranks both PASS and MISS.
// ---------------------------------------------------------------------------
test('evaluateFloor: VOID outranks PASS -- a row with matches=1 score=4 but a non-empty failures array is VOID, not PASS', () => {
  const probes = {
    ...ALL_GREEN_PROBES,
    "Usher's Model": { normalizeMatches: 1, readinessScore: 4, normalizeOk: true, readinessOk: false, failures: [{ probe: 'readiness', kind: 'hard_error', httpStatus: 429, detail: 'Rate limit exceeded' }] },
  };
  const r = evaluateFloor(ALL_GREEN_FRAMEWORKS, probes);
  const row = r.rows.find((x) => x.name === "Usher's Model");
  assert.equal(row.verdict, 'VOID', 'a non-empty failures array must VOID the row even when matches/score look clean');
});

test('evaluateFloor: VOID outranks MISS -- a run with one VOID row and one real MISS row exits 3, voidCount=1, missCount=1', () => {
  const frameworks = [...ALL_GREEN_FRAMEWORKS, fw('PEST Analysis', 3)];
  const probes = {
    ...ALL_GREEN_PROBES,
    "Usher's Model": failing('hard_error', 429, 'Rate limit exceeded'),
    'PEST Analysis': probe(0, null), // a genuine MISS
  };
  const r = evaluateFloor(frameworks, probes);
  assert.equal(r.exitCode, 3, 'any VOID row must drive the exit code to 3, even alongside a real MISS');
  assert.equal(r.voidCount, 1);
  assert.equal(r.missCount, 1);
});

// ---------------------------------------------------------------------------
// RED PROOF (the false-MISS proof): sabotaging one row to a probe failure
// must VOID it, not MISS it -- the miss count must NOT increase.
// ---------------------------------------------------------------------------
test('RED PROOF: sabotaging ONE row to a probe failure flips exitCode 0->3, sets voidCount=1, and leaves missCount at 0 (the false-MISS proof)', () => {
  const greenResult = evaluateFloor(ALL_GREEN_FRAMEWORKS, ALL_GREEN_PROBES);
  assert.equal(greenResult.exitCode, 0, 'sanity: the unsabotaged fixture must be green first');

  const sabotagedProbes = { ...ALL_GREEN_PROBES, "Usher's Model": failing('hard_error', 429, 'Rate limit exceeded') }; // clean -> probe failure
  const redResult = evaluateFloor(ALL_GREEN_FRAMEWORKS, sabotagedProbes);
  assert.equal(redResult.exitCode, 3, 'the gate must go VOID, not MISS, on a single sabotaged probe failure');
  assert.equal(redResult.voidCount, 1);
  assert.equal(redResult.missCount, 0, 'the miss count must NOT increase -- that is the false-MISS bug this phase closes');
});

// ---------------------------------------------------------------------------
// passCount never counts a VOID row.
// ---------------------------------------------------------------------------
test('evaluateFloor: passCount never counts a VOID row', () => {
  const sabotagedProbes = { ...ALL_GREEN_PROBES, "Usher's Model": failing('hard_error', 429, 'Rate limit exceeded') };
  const r = evaluateFloor(ALL_GREEN_FRAMEWORKS, sabotagedProbes);
  assert.equal(r.passCount, 2, 'passCount must be exactly the PASS rows (2), never rows.length - misses.length (which would flatteringly count the VOID row as a pass)');
});

// ---------------------------------------------------------------------------
// Exit codes stay distinct.
// ---------------------------------------------------------------------------
test('evaluateFloor: exit codes stay distinct -- 0 clean, 1 miss-only, 3 void-present', () => {
  assert.equal(evaluateFloor(ALL_GREEN_FRAMEWORKS, ALL_GREEN_PROBES).exitCode, 0);
  const missOnly = { ...ALL_GREEN_PROBES, "Usher's Model": probe(1, 1) };
  assert.equal(evaluateFloor(ALL_GREEN_FRAMEWORKS, missOnly).exitCode, 1);
  const voidPresent = { ...ALL_GREEN_PROBES, "Usher's Model": failing('timeout', 0, 'timed out') };
  assert.equal(evaluateFloor(ALL_GREEN_FRAMEWORKS, voidPresent).exitCode, 3);
});

// ---------------------------------------------------------------------------
// OQ-2 pinned: a never-probed framework stays MISS, not VOID, not dropped.
// ---------------------------------------------------------------------------
test('evaluateFloor: a framework with no probe entry at all is still MISS with failures:[], never VOID, never dropped', () => {
  const frameworks = [...ALL_GREEN_FRAMEWORKS, fw('Never Probed Framework', 1)];
  const r = evaluateFloor(frameworks, ALL_GREEN_PROBES);
  assert.equal(r.rows.length, 4, 'every enumerated framework must produce a row, even an unprobed one');
  const missed = r.rows.find((row) => row.name === 'Never Probed Framework');
  assert.equal(missed.verdict, 'MISS');
  assert.deepStrictEqual(missed.failures, []);
});

// ---------------------------------------------------------------------------
// Every row carries a failures array, [] on clean rows.
// ---------------------------------------------------------------------------
test('evaluateFloor: every row carries a failures array, [] on clean rows', () => {
  const r = evaluateFloor(ALL_GREEN_FRAMEWORKS, ALL_GREEN_PROBES);
  for (const row of r.rows) {
    assert.ok(Array.isArray(row.failures), 'every row must carry a failures array');
    assert.deepStrictEqual(row.failures, []);
  }
});

// ---------------------------------------------------------------------------
// Pre-existing 249 assertions restated here (byte-behavior parity), zero
// edits made to test-249-floor-gate.cjs itself (regression run separately).
// ---------------------------------------------------------------------------
test('CANON_PROSE_COMMAND_COUNT is unaffected by this plan', () => {
  assert.equal(CANON_PROSE_COMMAND_COUNT, 25);
});

test('parseOverrideFile is unaffected by this plan', () => {
  const r = parseOverrideFile(JSON.stringify({ frameworks: ['x'] }));
  assert.equal(r.ok, true);
});

// ---------------------------------------------------------------------------
// Task 3: pure VOID renderers (D-06), zero I/O.
// ---------------------------------------------------------------------------
test('renderVoidDetailLines: one line per failure, naming framework/probe/trigger-type/HTTP-status/detail', () => {
  const rows = [
    {
      name: 'Scenario Planning', uses: 4, matches: null, score: null, verdict: 'VOID',
      failures: [
        { probe: 'readiness', kind: 'hard_error', httpStatus: 429, detail: 'Rate limit exceeded' },
        { probe: 'normalize', kind: 'timeout', httpStatus: 0, detail: 'The operation was aborted due to timeout' },
      ],
    },
    { name: 'PEST Analysis', uses: 3, matches: 1, score: 4, verdict: 'PASS', failures: [] },
  ];
  const lines = renderVoidDetailLines(rows);
  assert.equal(lines.length, 2, 'a row with two failing probes must yield one line per failure');
  assert.match(lines[0], /Scenario Planning/);
  assert.match(lines[0], /readiness/);
  assert.match(lines[0], /hard-error/);
  assert.match(lines[0], /429/);
  assert.match(lines[1], /timeout/);
  assert.match(lines[1], /--/, 'zero httpStatus must print as -- not 0');
  for (const l of lines) assert.doesNotMatch(l, /\n/, 'no rendered line may contain a raw newline');
});

test('renderVoidDetailLines: zero VOID rows returns an empty array', () => {
  const rows = [{ name: 'X', uses: 1, matches: 1, score: 4, verdict: 'PASS', failures: [] }];
  assert.deepStrictEqual(renderVoidDetailLines(rows), []);
});

test('renderFloorSummaryLines: voidCount=0 is byte-identical to the pre-259 green and red banners', () => {
  const green = renderFloorSummaryLines({ rows: [1, 2], passCount: 2, missCount: 0, voidCount: 0, exitCode: 0 });
  const red = renderFloorSummaryLines({ rows: [1, 2], passCount: 1, missCount: 1, voidCount: 0, exitCode: 1 });
  assert.equal(green[green.length - 1], '=== FLOOR HOLDS (SWEEP-02 gate GREEN) ===');
  assert.equal(red[red.length - 1], '=== FLOOR DOES NOT HOLD (SWEEP-02 gate RED) ===');
  assert.doesNotMatch(green.join('\n'), /VOID/);
  assert.doesNotMatch(red.join('\n'), /VOID/);
});

test('renderFloorSummaryLines: voidCount>0 is a THIRD distinct banner, miss line qualified as a lower bound, VOID line present', () => {
  const result = { rows: [1, 2, 3], passCount: 1, missCount: 1, voidCount: 1, exitCode: 3 };
  const lines = renderFloorSummaryLines(result);
  const joined = lines.join('\n');
  assert.match(joined, /lower bound/i, 'when voidCount > 0 the miss line must be qualified as a lower bound');
  assert.match(joined, /VOIDED/, 'a VOID-count line must be present when voidCount > 0');
  assert.equal(lines[lines.length - 1], '=== FLOOR RUN VOID (probe failures present, re-run required, this is NOT a floor verdict) ===');
  assert.notEqual(lines[lines.length - 1], '=== FLOOR DOES NOT HOLD (SWEEP-02 gate RED) ===', 'the VOID banner must never read like the RED banner');
});
