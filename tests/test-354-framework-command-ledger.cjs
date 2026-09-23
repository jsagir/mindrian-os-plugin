#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 354 Plan 17 Task 1 -- THEO-01 TypeSafe/Jev framework-command-ledger
 * extension. Builder offline-mode regression: T1 (buildOfflineSeedLedger
 * shape + live KNOWN_METHODOLOGIES scoping), T2 (--check against the
 * committed ledger), T3 (egress-ceiling positive/negative boundary), T4
 * (buildWithJevFixture determinism, zero network).
 *
 * Task 2 (brain-router.cjs lookup-integration regression: T-pos,
 * T-neg-absent, T-neg-seed) extends this file in a later commit.
 *
 * HONESTY (plan-checker blocker 4, 354-17 must_haves.truths): the ledger
 * this plan COMMITS is offline-seed build_mode with confidence_floor: null.
 * T1/T2 prove it is well-formed and offline-checkable; they do not claim it
 * delivers recall -- that is Task 2's T-neg-seed's job to prove it does
 * NOT, by design.
 *
 * Run: node tests/test-354-framework-command-ledger.cjs
 * Hyphens only, no em-dashes (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const BUILDER_PATH = path.join(REPO_ROOT, 'scripts', 'build-framework-command-ledger.cjs');
const BRAIN_ROUTER_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'brain-router.cjs');
const JEV_FIXTURE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'framework-command-ledger-jev-fixture.json');

let pass = 0;
let fail = 0;
function test(name, fn) {
  try {
    fn();
    process.stdout.write('  ok    ' + name + '\n');
    pass += 1;
  } catch (e) {
    process.stdout.write('  FAIL  ' + name + ' -- ' + (e && e.message ? e.message : String(e)) + '\n');
    fail += 1;
  }
}

const builder = require(BUILDER_PATH);

// -------------------------------------------------------------------------
// T1: buildOfflineSeedLedger() shape, every command_id in the LIVE
// KNOWN_METHODOLOGIES set.
// -------------------------------------------------------------------------
test('T1: buildOfflineSeedLedger() build_mode/jev_model/rows shape', () => {
  const ledger = builder.buildOfflineSeedLedger();
  assert.equal(ledger.build_mode, 'offline-seed');
  assert.equal(ledger.jev_model, null);
  assert.equal(ledger.confidence_floor, null);
  assert.ok(ledger.rows && typeof ledger.rows === 'object', 'rows is an object');
  assert.ok(Object.keys(ledger.rows).length > 0, 'offline-seed ledger has at least one row');
});

test('T1: every offline-seed command_id is in the live KNOWN_METHODOLOGIES set', () => {
  const ledger = builder.buildOfflineSeedLedger();
  const brainRouter = require(BRAIN_ROUTER_PATH);
  const known = brainRouter.KNOWN_METHODOLOGIES || [];
  assert.ok(known.length > 0, 'KNOWN_METHODOLOGIES is non-empty');
  for (const rows of Object.values(ledger.rows)) {
    for (const row of rows) {
      assert.ok(known.includes(row.command_id), 'unscoped command_id: ' + row.command_id);
      assert.equal(row.source, 'offline-seed');
      assert.equal(row.confidence, null);
    }
  }
});

// -------------------------------------------------------------------------
// T2: --check against the committed offline-seed ledger, zero
// TYPESAFE_API_KEY.
// -------------------------------------------------------------------------
test('T2: runCheck() against the committed ledger exits true with no TYPESAFE_API_KEY', () => {
  const savedKey = process.env.TYPESAFE_API_KEY;
  delete process.env.TYPESAFE_API_KEY;
  try {
    assert.ok(fs.existsSync(builder.LEDGER_PATH), 'data/framework-command-ledger.json must be committed before this test runs');
    const ok = builder.runCheck();
    assert.equal(ok, true);
  } finally {
    if (savedKey !== undefined) process.env.TYPESAFE_API_KEY = savedKey;
  }
});

// -------------------------------------------------------------------------
// T3: assertEgressCeiling -- negative (disallowed `description` key) and
// positive (name/jtbd/glossary at or under 140 chars) boundary, both
// proven, not just asserted in prose.
// -------------------------------------------------------------------------
test('T3: assertEgressCeiling throws on a disallowed candidate key (description)', () => {
  const badPayload = {
    model: 'jev-latest',
    state: { candidates: { f0: { name: 'Lean Canvas', jtbd: 'Choose a methodology', glossary: 'A one-page business model.', description: 'not allowed here' } } },
    questions: {},
  };
  assert.throws(() => builder.assertEgressCeiling(badPayload), /disallowed candidate key "description"/);
});

test('T3: assertEgressCeiling returns true for name/jtbd/glossary only, at or under 140 chars', () => {
  const goodPayload = {
    model: 'jev-latest',
    state: { candidates: { f0: { name: 'Lean Canvas', jtbd: 'Choose a methodology', glossary: 'A one-page business model.' } } },
    questions: { f0: { type: 'score', instructions: { judge: 'How well does the framework fit?' }, criteria: ['poor fit', 'partial fit', 'strong fit'] } },
  };
  assert.equal(builder.assertEgressCeiling(goodPayload), true);
});

// -------------------------------------------------------------------------
// T4: buildWithJevFixture -- deterministic, zero network (fetch mocked to
// throw if called), every (framework, command_id) pair the fixture
// declared is present in the resulting rows.
// -------------------------------------------------------------------------
test('T4: buildWithJevFixture is deterministic with zero network', () => {
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error('T4: network must not be called by buildWithJevFixture');
  };
  let ledger;
  try {
    ledger = builder.buildWithJevFixture(JEV_FIXTURE_PATH);
  } finally {
    global.fetch = originalFetch;
  }
  assert.equal(ledger.build_mode, 'jev-scored');
  assert.ok(ledger.jev_calls > 0, 'jev_calls > 0');
  assert.notEqual(ledger.confidence_floor, null, 'confidence_floor must not be null for a jev-scored ledger');

  const fixture = JSON.parse(fs.readFileSync(JEV_FIXTURE_PATH, 'utf8'));
  for (const [frameworkName, fixtureRows] of Object.entries(fixture.rows)) {
    const rowsForFramework = ledger.rows[frameworkName];
    assert.ok(Array.isArray(rowsForFramework), 'missing rows for framework: ' + frameworkName);
    for (const fr of fixtureRows) {
      const found = rowsForFramework.find((r) => r.command_id === fr.command_id);
      assert.ok(found, 'missing (' + frameworkName + ', ' + fr.command_id + ') pair');
    }
  }
});

process.stdout.write('\ntest-354-framework-command-ledger.cjs: ' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail === 0 ? 0 : 1);
