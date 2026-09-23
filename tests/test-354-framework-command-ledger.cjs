#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 354 Plan 17 -- THEO-01 TypeSafe/Jev framework-command-ledger
 * extension. Builder offline-mode regression (Task 1: T1-T4) plus
 * brain-router.cjs lookup-integration regression (Task 2: T-pos,
 * T-neg-absent, T-neg-seed).
 *
 * T1 (buildOfflineSeedLedger shape + live KNOWN_METHODOLOGIES scoping), T2
 * (--check against the committed ledger), T3 (egress-ceiling
 * positive/negative boundary), T4 (buildWithJevFixture determinism, zero
 * network).
 *
 * T-pos / T-neg-absent / T-neg-seed drive a real captured brainRoute run
 * (354-09's own test pattern: tests/helpers/brain-capture-server.cjs),
 * proving `_lookupLedgerCommand` resolves a framework label the exact-slug
 * check alone would drop, still rejects a label absent from the ledger, and
 * -- critically -- that the COMMITTED offline-seed ledger promotes nothing.
 *
 * HONESTY (plan-checker blocker 4, 354-17 must_haves.truths): the ledger
 * this plan COMMITS is offline-seed build_mode with confidence_floor: null.
 * T1/T2 prove it is well-formed and offline-checkable; T-neg-seed proves it
 * promotes ZERO candidates, by design -- neither this file nor any summary
 * of it may imply this plan alone delivers working recall. T-pos and
 * T-neg-absent prove the LOOKUP LOGIC works correctly, but only against a
 * jev-scored ledger built via --jev-fixture (zero network), never against
 * the committed ledger.
 *
 * Run: node tests/test-354-framework-command-ledger.cjs
 * Hyphens only, no em-dashes (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const BUILDER_PATH = path.join(REPO_ROOT, 'scripts', 'build-framework-command-ledger.cjs');
const BRAIN_ROUTER_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'brain-router.cjs');
const BRAIN_CLIENT_PATH = path.join(REPO_ROOT, 'lib', 'core', 'brain-client.cjs');
const JEV_FIXTURE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'framework-command-ledger-jev-fixture.json');

const {
  startCaptureServer,
  resetCaptured,
  stopCaptureServer,
  setToolScript,
  resetToolScript,
} = require('./helpers/brain-capture-server.cjs');

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

async function atest(name, fn) {
  try {
    await fn();
    process.stdout.write('  ok    ' + name + '\n');
    pass += 1;
  } catch (e) {
    process.stdout.write('  FAIL  ' + name + ' -- ' + (e && e.message ? e.message : String(e)) + '\n');
    fail += 1;
  }
}

function requireFresh(modulePath) {
  delete require.cache[modulePath];
  return require(modulePath);
}

function sseTextBody(payload, id) {
  return 'data: ' + JSON.stringify({
    jsonrpc: '2.0',
    id: id || 2,
    result: { content: [{ type: 'text', text: JSON.stringify(payload) }] },
  }) + '\n';
}

const builder = require(BUILDER_PATH);

(async () => {
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

  // -------------------------------------------------------------------------
  // T-pos / T-neg-absent / T-neg-seed: brain-router lookup integration,
  // against a real captured brainRoute run (354-09's own test pattern:
  // tests/helpers/brain-capture-server.cjs). MINDRIAN_FRAMEWORK_LEDGER_PATH
  // is a test-only override so these never touch the committed, shared
  // data/framework-command-ledger.json on disk (other sessions are
  // concurrently active in this working tree).
  // -------------------------------------------------------------------------
  const { server, url } = await startCaptureServer();
  process.env.MINDRIAN_BRAIN_URL = url;
  process.env.MINDRIAN_BRAIN_KEY = 'synthetic-354-17-key';
  process.env.MINDRIAN_BRAIN_ROUTE_TIMEOUT_MS = '5000';
  process.env.MINDRIAN_BRAIN_RETRY_MAX = '0';
  process.env.MINDRIAN_BRAIN_RETRY_BASE_MS = '1';
  requireFresh(BRAIN_CLIENT_PATH);
  const brainRouter = requireFresh(BRAIN_ROUTER_PATH);

  const savedLedgerPathEnv = process.env.MINDRIAN_FRAMEWORK_LEDGER_PATH;

  // A jev-scored ledger built from Task 1's committed named fixture, written
  // to a throwaway temp path -- never the shared data/ file.
  const tmpLedgerPath = path.join(os.tmpdir(), 'mos-354-17-jev-ledger-' + process.pid + '-' + Date.now() + '.json');
  const jevLedger = builder.buildWithJevFixture(JEV_FIXTURE_PATH);
  fs.writeFileSync(tmpLedgerPath, JSON.stringify(jevLedger, null, 2) + '\n');

  await atest('T-pos: a framework present only in a jev-scored ledger (no exact command-slug candidate) resolves through the ledger', async () => {
    process.env.MINDRIAN_FRAMEWORK_LEDGER_PATH = tmpLedgerPath;
    resetToolScript();
    setToolScript([
      { body: sseTextBody({ answer_mode: 'structured_rows', rows: [] }) },
      { body: sseTextBody({ chain: [{ framework: 'Lean Canvas', degree: 100 }] }) },
      { body: sseTextBody([{ framework: 'Lean Canvas', commands: [] }]) },
    ]);
    resetCaptured();

    const rec = await brainRouter.recommend('synthetic-354-17-t-pos');
    assert.equal(rec.source, 'brain', 'rec: ' + JSON.stringify(rec));
    assert.ok(Array.isArray(rec.chain) && rec.chain.includes('lean-canvas'), 'chain: ' + JSON.stringify(rec.chain));
    assert.ok(rec.provenance && rec.provenance.ledger_assisted === true, 'provenance: ' + JSON.stringify(rec.provenance));
    assert.equal(rec.provenance.ledger_source, 'framework-command-ledger');
  });

  await atest('T-neg-absent: a framework absent from the same jev-scored ledger still lands in rejected_candidates, never chain', async () => {
    process.env.MINDRIAN_FRAMEWORK_LEDGER_PATH = tmpLedgerPath;
    resetToolScript();
    setToolScript([
      { body: sseTextBody({ answer_mode: 'structured_rows', rows: [] }) },
      { body: sseTextBody({ chain: [{ framework: 'Design Thinking', degree: 100 }, { framework: 'Totally Unknown Framework XYZ', degree: 50 }] }) },
      { body: sseTextBody([{ framework: 'Design Thinking', commands: ['/mos:diagnose'] }, { framework: 'Totally Unknown Framework XYZ', commands: [] }]) },
    ]);
    resetCaptured();

    const rec = await brainRouter.recommend('synthetic-354-17-t-neg-absent');
    assert.equal(rec.source, 'brain', 'rec: ' + JSON.stringify(rec));
    assert.ok(rec.chain.includes('diagnose'), 'chain: ' + JSON.stringify(rec.chain));
    assert.ok(rec.rejected_candidates.includes('Totally Unknown Framework XYZ'), 'rejected_candidates: ' + JSON.stringify(rec.rejected_candidates));
    // The absent framework must never contribute a chain element.
    assert.equal(rec.chain.length, 1, 'chain: ' + JSON.stringify(rec.chain));
  });

  await atest('T-neg-seed: the COMMITTED offline-seed ledger promotes nothing, even with a matching row for the tested framework label', async () => {
    delete process.env.MINDRIAN_FRAMEWORK_LEDGER_PATH; // default path: the real, committed ledger

    const committedLedger = JSON.parse(fs.readFileSync(builder.LEDGER_PATH, 'utf8'));
    assert.equal(committedLedger.build_mode, 'offline-seed', 'committed ledger must be offline-seed');
    assert.equal(committedLedger.confidence_floor, null, 'committed ledger must carry confidence_floor: null');
    const frameworkKeys = Object.keys(committedLedger.rows || {});
    assert.ok(frameworkKeys.length > 0, 'precondition: the committed offline-seed ledger has at least one row');
    // Pick a framework whose rows never carry command_id 'diagnose', so the
    // final assertion below cannot be confused by the OTHER (Design
    // Thinking, exact-slug) chain element this scenario also scripts.
    const testedFramework = frameworkKeys.find((k) => (
      Array.isArray(committedLedger.rows[k])
      && committedLedger.rows[k].length > 0
      && !committedLedger.rows[k].some((r) => r.command_id === 'diagnose')
    ));
    assert.ok(testedFramework, 'precondition: at least one offline-seed row not colliding with the diagnose chain element');
    for (const row of committedLedger.rows[testedFramework]) {
      assert.equal(row.source, 'offline-seed', 'precondition: every row under ' + testedFramework + ' is offline-seed');
    }

    resetToolScript();
    setToolScript([
      { body: sseTextBody({ answer_mode: 'structured_rows', rows: [] }) },
      { body: sseTextBody({ chain: [{ framework: 'Design Thinking', degree: 100 }, { framework: testedFramework, degree: 50 }] }) },
      { body: sseTextBody([{ framework: 'Design Thinking', commands: ['/mos:diagnose'] }, { framework: testedFramework, commands: [] }]) },
    ]);
    resetCaptured();

    const rec = await brainRouter.recommend('synthetic-354-17-t-neg-seed');
    assert.equal(rec.source, 'brain', 'rec: ' + JSON.stringify(rec));
    assert.ok(rec.chain.includes('diagnose'), 'chain: ' + JSON.stringify(rec.chain));
    assert.ok(rec.rejected_candidates.includes(testedFramework), 'rejected_candidates: ' + JSON.stringify(rec.rejected_candidates) + ' (framework: ' + testedFramework + ')');
    // The offline-seed ledger's own row for this exact framework must NOT
    // have promoted anything into chain -- the honesty guarantee. chain
    // must contain exactly the one exact-slug element (diagnose), nothing
    // ledger-derived from the offline-seed row.
    assert.equal(rec.chain.length, 1, 'chain: ' + JSON.stringify(rec.chain));
    for (const row of committedLedger.rows[testedFramework]) {
      assert.ok(!rec.chain.includes(row.command_id), 'chain unexpectedly includes an offline-seed-promoted command_id: ' + JSON.stringify(rec.chain));
    }
  });

  if (savedLedgerPathEnv !== undefined) {
    process.env.MINDRIAN_FRAMEWORK_LEDGER_PATH = savedLedgerPathEnv;
  } else {
    delete process.env.MINDRIAN_FRAMEWORK_LEDGER_PATH;
  }
  try {
    fs.unlinkSync(tmpLedgerPath);
  } catch (_e) { /* best-effort cleanup */ }

  await stopCaptureServer(server);

  process.stdout.write('\ntest-354-framework-command-ledger.cjs: ' + pass + ' passed, ' + fail + ' failed\n');
  process.exit(fail === 0 ? 0 : 1);
})();
