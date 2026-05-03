#!/usr/bin/env node
'use strict';

/*
 * Phase 108-02 - Provenance contract schema test.
 *
 * Implements: RECONCILE-108-03.
 *
 * Asserts that .planning/phases/108-graph-memory-schema-reconciliation/PROVENANCE.md:
 *   1. Contains all 6 required field names (source_path, created_by, confidence,
 *      review_status, created_at, last_seen_at).
 *   2. Contains all 3 optional field names (source_section, confirmed_by, confirmed_at).
 *   3. Contains the closed created_by enum with all 5 values.
 *   4. Contains the canonical Part 9 invariant SQL query verbatim.
 *   5. Contains the mandatory idx_nodes_review_status index recommendation.
 *   6. Contains the Phase 109 two-step migration reference (json_extract backfill).
 *   7. Contains the CHECK(created_by IN ...) constraint specification.
 *   8. Contains zero em-dashes or en-dashes (project hard rule).
 *
 * Exit 0 = PASS. Exit 1 = FAIL with offending field listed.
 *
 * Pattern source: tests/test-cascade-side-channel.cjs.
 */

const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');

const REPO_ROOT = path.resolve(__dirname, '..');
const PROVENANCE_PATH = path.join(
  REPO_ROOT,
  '.planning',
  'phases',
  '108-graph-memory-schema-reconciliation',
  'PROVENANCE.md'
);

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log('PASS:', name);
  } catch (e) {
    console.error('FAIL:', name, '-', e.message);
    failures += 1;
  }
}

if (!fs.existsSync(PROVENANCE_PATH)) {
  console.error('FAIL: PROVENANCE.md not found at', PROVENANCE_PATH);
  process.exit(1);
}
const provenance = fs.readFileSync(PROVENANCE_PATH, 'utf8');

const REQUIRED_FIELDS = [
  'source_path', 'created_by', 'confidence', 'review_status', 'created_at', 'last_seen_at'
];
const OPTIONAL_FIELDS = ['source_section', 'confirmed_by', 'confirmed_at'];
const CREATED_BY_ENUM_VALUES = ["'user'", "'larry'", "'import'", "'brain'", "'system'"];

test('all 6 required fields present', () => {
  const missing = REQUIRED_FIELDS.filter((f) => !provenance.includes(f));
  assert.equal(missing.length, 0, 'Missing required fields: ' + missing.join(', '));
});

test('all 3 optional fields present', () => {
  const missing = OPTIONAL_FIELDS.filter((f) => !provenance.includes(f));
  assert.equal(missing.length, 0, 'Missing optional fields: ' + missing.join(', '));
});

test('created_by closed enum has all 5 values', () => {
  const missing = CREATED_BY_ENUM_VALUES.filter((v) => !provenance.includes(v));
  assert.equal(missing.length, 0, 'Missing enum values: ' + missing.join(', '));
});

test('canonical Part 9 invariant SQL query present (key fragments)', () => {
  assert.ok(
    provenance.includes("review_status = 'confirmed'"),
    "Missing fragment: review_status = 'confirmed'"
  );
  assert.ok(
    provenance.includes("confirmed_by != 'user'"),
    "Missing fragment: confirmed_by != 'user'"
  );
  assert.ok(
    provenance.includes('confirmed_by IS NULL'),
    'Missing fragment: confirmed_by IS NULL'
  );
});

test('mandatory idx_nodes_review_status index present', () => {
  assert.ok(
    provenance.includes('idx_nodes_review_status'),
    'Missing mandatory index: idx_nodes_review_status'
  );
});

test('CHECK(created_by IN ...) constraint specified', () => {
  assert.ok(
    provenance.includes('CHECK(created_by IN'),
    'Missing CHECK constraint specification'
  );
});

test('Phase 109 two-step migration referenced (json_extract)', () => {
  assert.ok(
    provenance.includes('json_extract'),
    'Missing json_extract two-step migration reference'
  );
});

test('SQL column types specified (TEXT NOT NULL, REAL, INTEGER NOT NULL)', () => {
  assert.ok(provenance.includes('TEXT NOT NULL'), 'Missing TEXT NOT NULL');
  assert.ok(provenance.includes('REAL'), 'Missing REAL type for confidence');
  assert.ok(provenance.includes('INTEGER NOT NULL'), 'Missing INTEGER NOT NULL for timestamps');
});

test('contract specification framing (NOT a migration)', () => {
  // The doc must explicitly say it is a contract, not a migration.
  assert.ok(
    /CONTRACT specification|contract, not a migration|contract, not a script|spec.*not a migration/i.test(provenance),
    'Document does not explicitly frame itself as a contract spec (must say so to prevent Phase 109 misinterpretation)'
  );
});

test('zero em-dashes (U+2014) or en-dashes (U+2013)', () => {
  const emdashIdx = provenance.indexOf('—');
  const endashIdx = provenance.indexOf('–');
  assert.equal(emdashIdx, -1, 'Em-dash found at character offset ' + emdashIdx);
  assert.equal(endashIdx, -1, 'En-dash found at character offset ' + endashIdx);
});

process.exit(failures > 0 ? 1 : 0);
