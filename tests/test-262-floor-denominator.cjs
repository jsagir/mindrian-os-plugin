#!/usr/bin/env node
'use strict';

/*
 * Phase 262 Plan 01 Task 1 (FLOOR-01, Wave 0) -- pin the ratified 28-name
 * denominator against the live frontmatter scan.
 * ==========================================================================
 * This suite proves that data/flagship-floor-set.json cannot be silently
 * narrowed to fake a green floor gate: it pins frameworks.length === 28 and
 * ratified_at === '2026-08-11', then diffs the ratified set 1:1 against a
 * live scanMethodologyCommands() run so a name that drifts by one character
 * in command frontmatter fails loud instead of silently dropping out of the
 * enumerated floor (262-RESEARCH.md Pitfall 3). "Narrowing the ratified set
 * to make the gate green" is the rejected option this test exists to block
 * (262-RESEARCH.md "Anti-patterns to avoid").
 * This suite is zero-network: parseOverrideFile and scanMethodologyCommands
 * are both pure disk readers, reused from scripts/check-flagship-floor.cjs
 * and scripts/build-brain-census.cjs (Part 7), never reimplemented here.
 *
 * 28 names, diffed 1:1 against a live scanMethodologyCommands() run,
 * measured against the incumbent Brain's command set on 2026-09-02 (D-04's
 * dating rule: every floor number this phase writes carries the date it was
 * measured).
 *
 * No em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { scanMethodologyCommands } = require('../scripts/build-brain-census.cjs');
const { parseOverrideFile } = require('../scripts/check-flagship-floor.cjs');

const OVERRIDE_PATH = path.join(__dirname, '..', 'data', 'flagship-floor-set.json');

const EXPECTED_FRAMEWORK_COUNT = 28;
const EXPECTED_RATIFIED_AT = '2026-08-11';

function readParsedOverride() {
  const rawText = fs.readFileSync(OVERRIDE_PATH, 'utf8');
  return parseOverrideFile(rawText);
}

// ---------------------------------------------------------------------------
// Test 1: the ratified denominator file parses cleanly.
// ---------------------------------------------------------------------------
test('parseOverrideFile(data/flagship-floor-set.json) returns ok: true', () => {
  const parsed = readParsedOverride();
  assert.equal(parsed.ok, true, 'the ratified denominator file must parse as a valid override');
});

// ---------------------------------------------------------------------------
// Test 2: the not-narrowed assertion.
// ---------------------------------------------------------------------------
test('the ratified frameworks array has not been narrowed: length === 28', () => {
  const parsed = readParsedOverride();
  assert.equal(
    parsed.frameworks.length,
    EXPECTED_FRAMEWORK_COUNT,
    'narrowing data/flagship-floor-set.json to make the gate green must fail this test'
  );
});

// ---------------------------------------------------------------------------
// Test 3: the ratification is pinned, so silently re-ratifying to a smaller
// set is a visible diff plus a red test.
// ---------------------------------------------------------------------------
test('the ratification is pinned: ratified_at and ratified_by match the navigator record', () => {
  const parsed = readParsedOverride();
  assert.equal(parsed.meta.ratified_at, EXPECTED_RATIFIED_AT);
  assert.match(parsed.meta.ratified_by, /navigator/);
});

// ---------------------------------------------------------------------------
// Test 4: every ratified name is present, byte-exact, in a live frontmatter
// scan (1:1, zero mismatches, case-sensitive).
// ---------------------------------------------------------------------------
test('every ratified name matches a live scanMethodologyCommands() name byte-exact', () => {
  const parsed = readParsedOverride();
  const scanned = scanMethodologyCommands();
  const scannedNames = new Set(scanned.frameworks.map((fw) => fw.name));
  const missing = parsed.frameworks.filter((name) => !scannedNames.has(name));
  assert.deepStrictEqual(
    missing,
    [],
    'every ratified name must appear byte-exact in the live frontmatter scan; a drifted name silently drops out of the floor otherwise'
  );
});

// ---------------------------------------------------------------------------
// Test 5: the filter the gate actually performs (Pitfall 3 made loud).
// ---------------------------------------------------------------------------
test('the gate filter (overrideNames.has(fw.name)) enumerates all 28 ratified frameworks today', () => {
  const parsed = readParsedOverride();
  const scanned = scanMethodologyCommands();
  const overrideNames = new Set(parsed.frameworks);
  const enumerated = scanned.frameworks.filter((fw) => overrideNames.has(fw.name));
  assert.equal(
    enumerated.length,
    EXPECTED_FRAMEWORK_COUNT,
    'a drifted frontmatter name silently drops out of the enumerated floor today; this must stay 28'
  );
});

// ---------------------------------------------------------------------------
// Test 6 (negative / RED PROOF, in-test): a narrowed 20-name copy must throw
// the same assertion Test 2 makes. Built inline; data/flagship-floor-set.json
// is never written to and never modified.
// ---------------------------------------------------------------------------
test('RED PROOF: a locally constructed 20-name copy of the parsed object fails the not-narrowed assertion', () => {
  const parsed = readParsedOverride();
  const narrowedCopy = { ...parsed, frameworks: parsed.frameworks.slice(0, 20) };
  assert.equal(narrowedCopy.frameworks.length, 20, 'sanity: the scratch copy really is narrowed to 20');
  assert.throws(
    () => {
      assert.equal(narrowedCopy.frameworks.length, EXPECTED_FRAMEWORK_COUNT);
    },
    /AssertionError/,
    'a narrowed 20-name copy must fail the not-narrowed assertion, proving Test 2 is a real tripwire'
  );
});
