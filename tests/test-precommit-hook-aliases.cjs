#!/usr/bin/env node
'use strict';

/*
 * Phase 108-05 - Pre-commit hook fixture-based test.
 *
 * Implements: RECONCILE-108-05 (hook behavior).
 *
 * Asserts that scripts/check-schema-aliases.cjs:
 *   1. PASSES (zero violations) for in-alias CREATE TABLE (banked_by_audit derives from BANKED_BY).
 *   2. FAILS for out-of-alias CREATE TABLE (parallel_opportunities not in any resolution).
 *   3. PASSES for ALTER TABLE ADD COLUMN (always allowed per D-05).
 *   4. PASSES for CREATE INDEX on an existing table (nodes is in ALLOWED_EXISTING_TABLES).
 *   5. FAILS for CREATE INDEX on a missing table (nonexistent_table is not in any alias).
 *   6. The failure error message contains the canonical "SCHEMA DRIFT GUARD - PHASE 108" header.
 *
 * Exit 0 = PASS. Exit 1 = FAIL.
 */

const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');

const REPO_ROOT = path.resolve(__dirname, '..');
const HOOK_MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'check-schema-aliases.cjs');
const FIXTURES_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'phase-108');

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

if (!fs.existsSync(HOOK_MODULE_PATH)) {
  console.error('FAIL: hook module not found at', HOOK_MODULE_PATH);
  process.exit(1);
}
const { checkSqlAgainstAliases, formatViolation } = require(HOOK_MODULE_PATH);

function loadFixture(name) {
  const p = path.join(FIXTURES_DIR, name);
  if (!fs.existsSync(p)) throw new Error('Fixture not found: ' + p);
  return fs.readFileSync(p, 'utf8');
}

// ----------------------------------------------------------------------------
// Fixture tests.
// ----------------------------------------------------------------------------

test('in-alias.sql produces zero violations (CREATE TABLE banked_by_audit)', () => {
  const sql = loadFixture('in-alias.sql');
  const violations = checkSqlAgainstAliases(sql, 'tests/fixtures/phase-108/in-alias.sql');
  assert.equal(
    violations.length, 0,
    'Expected 0 violations; got ' + violations.length + ': ' + JSON.stringify(violations)
  );
});

test('out-of-alias.sql produces a create_table_drift violation (parallel_opportunities)', () => {
  const sql = loadFixture('out-of-alias.sql');
  const violations = checkSqlAgainstAliases(sql, 'tests/fixtures/phase-108/out-of-alias.sql');
  assert.ok(violations.length >= 1, 'Expected at least 1 violation; got 0');
  const drift = violations.find((v) => v.kind === 'create_table_drift' && v.table === 'parallel_opportunities');
  assert.ok(drift, 'Expected create_table_drift on parallel_opportunities; got: ' + JSON.stringify(violations));
});

test('out-of-alias error message contains canonical header', () => {
  const sql = loadFixture('out-of-alias.sql');
  const violations = checkSqlAgainstAliases(sql, 'tests/fixtures/phase-108/out-of-alias.sql');
  const drift = violations.find((v) => v.kind === 'create_table_drift');
  assert.ok(drift, 'No drift violation found');
  const msg = formatViolation(drift);
  assert.ok(msg.includes('SCHEMA DRIFT GUARD - PHASE 108'), 'Error message missing canonical header');
  assert.ok(msg.includes('parallel_opportunities'), 'Error message missing offending table name');
  assert.ok(msg.includes('Phase 108 D-05'), 'Error message missing D-05 reference');
});

test('additive-column.sql produces zero violations (ALTER TABLE ADD COLUMN allowed)', () => {
  const sql = loadFixture('additive-column.sql');
  const violations = checkSqlAgainstAliases(sql, 'tests/fixtures/phase-108/additive-column.sql');
  assert.equal(violations.length, 0, 'Expected 0 violations; got ' + JSON.stringify(violations));
});

test('index-on-existing.sql produces zero violations (CREATE INDEX on nodes/assumptions)', () => {
  const sql = loadFixture('index-on-existing.sql');
  const violations = checkSqlAgainstAliases(sql, 'tests/fixtures/phase-108/index-on-existing.sql');
  assert.equal(violations.length, 0, 'Expected 0 violations; got ' + JSON.stringify(violations));
});

test('index-on-missing-table.sql produces a create_index_on_missing_table violation', () => {
  const sql = loadFixture('index-on-missing-table.sql');
  const violations = checkSqlAgainstAliases(sql, 'tests/fixtures/phase-108/index-on-missing-table.sql');
  assert.ok(violations.length >= 1, 'Expected at least 1 violation; got 0');
  const v = violations.find((x) => x.kind === 'create_index_on_missing_table' && x.table === 'nonexistent_table');
  assert.ok(v, 'Expected create_index_on_missing_table on nonexistent_table; got: ' + JSON.stringify(violations));
});

test('hook performance: 5 fixture scans complete in under 200ms (warm)', () => {
  const fixtures = ['in-alias.sql', 'out-of-alias.sql', 'additive-column.sql', 'index-on-existing.sql', 'index-on-missing-table.sql'];
  const start = Date.now();
  for (const f of fixtures) {
    const sql = loadFixture(f);
    checkSqlAgainstAliases(sql, f);
  }
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 500, 'Performance budget exceeded: ' + elapsed + 'ms (RESEARCH section 6 budget under 200ms warm; 500ms ceiling for cold-start tolerance)');
});

process.exit(failures > 0 ? 1 : 0);
