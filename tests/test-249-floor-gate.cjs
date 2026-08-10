#!/usr/bin/env node
'use strict';

/**
 * Phase 249-02 (ENRICH-04) -- hermetic floor-gate logic + sabotage red proof.
 * ==========================================================================
 * scripts/check-flagship-floor.cjs is the machine form of the SWEEP-02 gate:
 * per invoked framework, requires BOTH normalize_framework_name returning
 * EXACTLY 1 canonical match AND orchestration_readiness readiness_score >= 3
 * (T6 takes exact-first LIMIT 1, so an ambiguous name makes the readiness
 * probe unreliable -- Pitfall 7).
 *
 * This suite drives the gate's PURE logic (evaluateFloor) with injected
 * probe fixtures -- ZERO network. The live CLI wiring (main(), brainCall
 * over the read-tier key) is exercised separately by the baseline red run
 * this task also files (SUMMARY.md), never inside this hermetic suite.
 *
 * Also proves the override-file parser (parseOverrideFile) fails loud on
 * malformed JSON or a malformed shape -- both hermetic, pure functions.
 *
 * RED on the unfixed code: evaluateFloor / parseOverrideFile are not
 * exported (import fails). GREEN after scripts/check-flagship-floor.cjs
 * exists.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { evaluateFloor, parseOverrideFile, CANON_PROSE_COMMAND_COUNT } = require('../scripts/check-flagship-floor.cjs');

// ---------------------------------------------------------------------------
// Fixture builders.
// ---------------------------------------------------------------------------
function fw(name, uses) {
  return { name, uses };
}

function probe(matches, score) {
  return { normalizeMatches: matches, readinessScore: score, normalizeOk: true, readinessOk: true };
}

// An all-green fixture: every framework has exactly 1 canonical match and a
// readiness score >= 3. The gate must exit 0 with zero misses on this.
const ALL_GREEN_FRAMEWORKS = [fw('Beautiful Question Framework', 5), fw('Problem Definition Transformation', 3), fw("Usher's Model", 2)];
const ALL_GREEN_PROBES = {
  'Beautiful Question Framework': probe(1, 4),
  'Problem Definition Transformation': probe(1, 4),
  "Usher's Model": probe(1, 3),
};

test('evaluateFloor: all-green fixture (1 match + score>=3 for every framework) passes with zero misses', () => {
  const r = evaluateFloor(ALL_GREEN_FRAMEWORKS, ALL_GREEN_PROBES);
  assert.equal(r.missCount, 0);
  assert.equal(r.passCount, 3);
  assert.equal(r.exitCode, 0);
  assert.ok(r.rows.every((row) => row.verdict === 'PASS'));
});

test('evaluateFloor: a framework below the readiness floor (score 2) is a MISS', () => {
  const probes = { ...ALL_GREEN_PROBES, "Usher's Model": probe(1, 2) };
  const r = evaluateFloor(ALL_GREEN_FRAMEWORKS, probes);
  assert.equal(r.missCount, 1);
  assert.equal(r.exitCode, 1);
  const missed = r.rows.find((row) => row.name === "Usher's Model");
  assert.equal(missed.verdict, 'MISS');
});

test('evaluateFloor: a multi-match name (ambiguous canonical, e.g. Scenario Planning 6 matches) is a MISS even at score>=3', () => {
  const frameworks = [...ALL_GREEN_FRAMEWORKS, fw('Scenario Planning', 4)];
  const probes = { ...ALL_GREEN_PROBES, 'Scenario Planning': probe(6, 4) };
  const r = evaluateFloor(frameworks, probes);
  assert.equal(r.missCount, 1);
  const missed = r.rows.find((row) => row.name === 'Scenario Planning');
  assert.equal(missed.verdict, 'MISS');
  assert.equal(missed.matches, 6);
});

test('evaluateFloor: zero normalize matches (an absent node, e.g. PEST Analysis) is a MISS', () => {
  const frameworks = [...ALL_GREEN_FRAMEWORKS, fw('PEST Analysis', 3)];
  const probes = { ...ALL_GREEN_PROBES, 'PEST Analysis': probe(0, null) };
  const r = evaluateFloor(frameworks, probes);
  const missed = r.rows.find((row) => row.name === 'PEST Analysis');
  assert.equal(missed.verdict, 'MISS');
  assert.equal(r.exitCode, 1);
});

test('evaluateFloor: a framework with no probe result at all (never probed) is a MISS, not silently dropped', () => {
  const frameworks = [...ALL_GREEN_FRAMEWORKS, fw('Never Probed Framework', 1)];
  const r = evaluateFloor(frameworks, ALL_GREEN_PROBES); // no entry for the new framework
  assert.equal(r.rows.length, 4, 'every enumerated framework must produce a row, even an unprobed one');
  const missed = r.rows.find((row) => row.name === 'Never Probed Framework');
  assert.equal(missed.verdict, 'MISS');
});

// ---------------------------------------------------------------------------
// RED PROOF (mandatory, in-suite): sabotage exactly ONE score OR ONE
// match-count in an otherwise all-green fixture and prove the gate turns
// red -- this is the demonstration that the gate CAN fail, not merely
// asserted in prose.
// ---------------------------------------------------------------------------
test('RED PROOF: sabotaging ONE score in an all-green fixture turns the whole gate red (non-zero exit)', () => {
  const greenResult = evaluateFloor(ALL_GREEN_FRAMEWORKS, ALL_GREEN_PROBES);
  assert.equal(greenResult.exitCode, 0, 'sanity: the unsabotaged fixture must be green first');

  const sabotagedProbes = { ...ALL_GREEN_PROBES, "Usher's Model": probe(1, 1) }; // score sabotaged 3->1
  const redResult = evaluateFloor(ALL_GREEN_FRAMEWORKS, sabotagedProbes);
  assert.equal(redResult.exitCode, 1, 'the gate must go red on a single sabotaged score');
  assert.equal(redResult.missCount, 1);
  assert.equal(redResult.passCount, 2);
});

test('RED PROOF: sabotaging ONE name to a 2-match ambiguity turns the whole gate red (non-zero exit)', () => {
  const greenResult = evaluateFloor(ALL_GREEN_FRAMEWORKS, ALL_GREEN_PROBES);
  assert.equal(greenResult.exitCode, 0, 'sanity: the unsabotaged fixture must be green first');

  const sabotagedProbes = { ...ALL_GREEN_PROBES, 'Beautiful Question Framework': probe(2, 4) }; // matches sabotaged 1->2
  const redResult = evaluateFloor(ALL_GREEN_FRAMEWORKS, sabotagedProbes);
  assert.equal(redResult.exitCode, 1, 'the gate must go red on a single sabotaged multi-match name');
  assert.equal(redResult.missCount, 1);
  const missed = redResult.rows.find((row) => row.name === 'Beautiful Question Framework');
  assert.equal(missed.verdict, 'MISS');
  assert.equal(missed.matches, 2);
});

// ---------------------------------------------------------------------------
// Override-file parser: fails loud on malformed JSON or a malformed shape.
// ---------------------------------------------------------------------------
test('parseOverrideFile: valid { frameworks: [...] } shape parses ok', () => {
  const r = parseOverrideFile(JSON.stringify({ frameworks: ['Beautiful Question Framework'], ratified_by: 'navigator', ratified_at: '2026-08-10' }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.frameworks, ['Beautiful Question Framework']);
});

test('RED PROOF: parseOverrideFile refuses malformed JSON (syntax error)', () => {
  const r = parseOverrideFile('{ this is not valid json ]');
  assert.equal(r.ok, false);
  assert.ok(/malformed json/i.test(r.error));
});

test('RED PROOF: parseOverrideFile refuses a well-formed JSON with the wrong shape (missing frameworks array)', () => {
  const r = parseOverrideFile(JSON.stringify({ ratified_by: 'navigator' }));
  assert.equal(r.ok, false);
  assert.ok(/malformed shape/i.test(r.error));
});

test('RED PROOF: parseOverrideFile refuses an empty frameworks array', () => {
  const r = parseOverrideFile(JSON.stringify({ frameworks: [] }));
  assert.equal(r.ok, false);
});

test('RED PROOF: parseOverrideFile refuses a frameworks array with a non-string entry', () => {
  const r = parseOverrideFile(JSON.stringify({ frameworks: ['ok', 42] }));
  assert.equal(r.ok, false);
});

// ---------------------------------------------------------------------------
// Denominator honesty: both candidates must be carried, never silently picked.
// ---------------------------------------------------------------------------
test('CANON_PROSE_COMMAND_COUNT is the recorded 25 canon-prose figure (denominator honesty, ratification OPEN)', () => {
  assert.equal(CANON_PROSE_COMMAND_COUNT, 25);
});
