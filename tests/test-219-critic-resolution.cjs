#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 219 GAP-1 -- the async critic-resolution pass (the "future async
 * runner" opportunity-statement.cjs's own comment names).
 *
 * WHY THIS TEST EXISTS (RCA: .planning/debug/219-live-checkpoint-two-
 * structural-gaps.md, GAP-1): the real Phase 212 critic's stageA is async;
 * the synchronous statement emitter can never await it, so on ANY live room
 * every statement honestly degraded to critic 'pending' / banked false and
 * REQ-1 banking was structurally unsatisfiable. The 219-01 unit test used a
 * SYNCHRONOUS stub critic, which masked this entirely. This test uses a REAL
 * async stub critic (a stageA returning a genuine Promise) so the sync/async
 * seam can never go untested again.
 *
 * Contract under test (opportunity-statement.cjs additive exports):
 *   resolveCriticVerdict(statement, opts)   - one pending statement
 *   resolveCriticVerdicts(statements, opts) - bounded sequential batch
 *
 * Honesty floor (non-negotiable, same as the sync path):
 *   - a resolution that genuinely cannot complete (reject, timeout, degraded
 *     encoder envelope, critic absent) leaves the statement 'pending'/unbanked
 *   - banked flips true ONLY on a resolved PASSING verdict
 *   - the batch is BOUNDED: per-statement timeout + batch deadline; a critic
 *     that never resolves can never hang the suite (the vec0/FTS5 bounded-
 *     probe discipline).
 *
 * All hermetic: the async critic is injected through the EXISTING
 * _test.setCriticForTest seam (an object with an async stageA). Zero network,
 * zero encoder, zero room db. No em-dashes.
 */
'use strict';

const assert = require('node:assert/strict');

const opp = require('../lib/core/eureka/opportunity-statement.cjs');

let passed = 0;
function ok(name) { passed += 1; console.log('  ok   ' + name); }

function resetCritic() { opp._test.setCriticForTest(); }

// The same well-formed candidate the 215-03 contract tests use.
function wellFormed() {
  return {
    a: {
      id: 'C16796',
      title: 'Implantable arrhythmia monitor',
      primary_problem: 'undetected atrial fibrillation',
      section: 'cardiology',
      weak_dimensions: ['validated_demand'],
    },
    b: {
      id: 'C03552',
      title: 'Low-power biosignal ASIC',
      primary_problem: 'continuous cardiac telemetry',
      section: 'microelectronics',
      weak_dimensions: ['strategic_fit'],
    },
    shared_problems: ['long-horizon arrhythmia capture'],
    dims: { strategic_fit: 0.6, validated_demand: 0.3, tech_econ_feasibility: 0.7 },
    score: 0.82,
    rank: 1,
    tail: false,
  };
}

// A genuine-async stub critic: stageA returns a REAL Promise that resolves
// after a macrotask tick (never synchronously), mirroring the real Phase 212
// critic's shape. `calls` proves the resolution pass actually invoked it.
function asyncCritic(verdictOrFn) {
  const stub = {
    calls: 0,
    lastCandidate: null,
    stageA: function (candidate) {
      stub.calls += 1;
      stub.lastCandidate = candidate;
      return new Promise(function (resolve, reject) {
        setImmediate(function () {
          try {
            const v = (typeof verdictOrFn === 'function') ? verdictOrFn(candidate) : verdictOrFn;
            resolve(v);
          } catch (e) { reject(e); }
        });
      });
    },
  };
  return stub;
}

async function run() {
  // ---------- Test 0: the additive exports exist ----------
  {
    assert.equal(typeof opp.resolveCriticVerdict, 'function',
      'Test 0: resolveCriticVerdict is exported');
    assert.equal(typeof opp.resolveCriticVerdicts, 'function',
      'Test 0: resolveCriticVerdicts is exported');
    ok('Test 0: async resolution entry points are exported');
  }

  // ---------- Test 1: sync emission still degrades honestly on an async critic ----------
  // (the regression floor: the synchronous seam NEVER awaits, NEVER fabricates)
  {
    resetCritic();
    const stub = asyncCritic({ pass: true, features: { shift: 0.4 } });
    opp._test.setCriticForTest(stub);
    const st = opp.buildOpportunityStatement(wellFormed());
    assert.equal(st.critic, 'pending', 'Test 1: sync path stays pending on an async critic');
    assert.equal(st.banked, false, 'Test 1: sync path never banks on an unresolved Promise');
    assert.equal(stub.calls, 1, 'Test 1: the sync gate did invoke stageA (and discarded the Promise)');
    resetCritic();
    ok('Test 1: synchronous honest-degrade path unchanged (byte-behavior floor)');
  }

  // ---------- Test 2: the async pass resolves a PASSING verdict and banks ----------
  {
    resetCritic();
    const verdict = { pass: true, features: { shift: 0.41, entity_count: 3 } };
    const stub = asyncCritic(verdict);
    opp._test.setCriticForTest(stub);
    const st = opp.buildOpportunityStatement(wellFormed());
    assert.equal(st.critic, 'pending', 'Test 2: starts pending');
    const r = await opp.resolveCriticVerdicts([st], { timeoutMs: 2000, batchMs: 5000 });
    assert.equal(r.resolved, 1, 'Test 2: one statement resolved');
    assert.equal(r.banked, 1, 'Test 2: one statement banked');
    assert.equal(r.pending, 0, 'Test 2: nothing left pending');
    assert.deepEqual(st.critic, verdict, 'Test 2: the real awaited verdict is carried verbatim');
    assert.equal(st.banked, true, 'Test 2: banked flips true ONLY via the resolved passing verdict');
    assert.equal(stub.calls, 2, 'Test 2: stageA invoked once by sync gate, once awaited by the pass');
    // the resolution pass sends the SAME candidate shape the sync gate sends
    assert.equal(typeof stub.lastCandidate.text, 'string', 'Test 2: candidate carries text');
    assert.equal(stub.lastCandidate.mechanismText, st.fields.novel_application,
      'Test 2: candidate mechanismText is the novel_application slot (parity with runCriticGate)');
    resetCritic();
    ok('Test 2: async resolution awaits the real Promise, updates verdict + banked');
  }

  // ---------- Test 3: a resolved FAILING verdict never banks, but IS resolved ----------
  {
    resetCritic();
    const verdict = { pass: false, route: 'general_shallow', tag: 'entity_nonspecific' };
    opp._test.setCriticForTest(asyncCritic(verdict));
    const st = opp.buildOpportunityStatement(wellFormed());
    const r = await opp.resolveCriticVerdicts([st], { timeoutMs: 2000, batchMs: 5000 });
    assert.equal(r.resolved, 1, 'Test 3: the fail verdict counts as resolved');
    assert.equal(r.banked, 0, 'Test 3: a failing verdict never banks');
    assert.deepEqual(st.critic, verdict, 'Test 3: the fail verdict is carried verbatim (not pending)');
    assert.equal(st.banked, false, 'Test 3: banked stays false');
    resetCritic();
    ok('Test 3: resolved fail is honest - verdict recorded, banked false');
  }

  // ---------- Test 4: a REJECTING stageA leaves the statement honestly pending ----------
  {
    resetCritic();
    opp._test.setCriticForTest(asyncCritic(function () { throw new Error('encoder exploded'); }));
    const st = opp.buildOpportunityStatement(wellFormed());
    const r = await opp.resolveCriticVerdicts([st], { timeoutMs: 2000, batchMs: 5000 });
    assert.equal(r.resolved, 0, 'Test 4: a rejecting stageA resolves nothing');
    assert.equal(r.pending, 1, 'Test 4: the statement is counted still-pending');
    assert.equal(st.critic, 'pending', 'Test 4: critic stays pending, NEVER a fabricated verdict');
    assert.equal(st.banked, false, 'Test 4: banked stays false');
    resetCritic();
    ok('Test 4: async failure degrades honestly to pending (the floor holds)');
  }

  // ---------- Test 5: a DEGRADED encoder envelope stays pending ----------
  // stageA's encoder-unavailable envelope is a non-evaluation, not a verdict:
  // treating it as a resolved fail would let predicate 'all' bank statements
  // the critic never actually looked at.
  {
    resetCritic();
    opp._test.setCriticForTest(asyncCritic({
      pass: false, route: 'general_shallow', tag: 'calibration_unknown', degraded: true,
    }));
    const st = opp.buildOpportunityStatement(wellFormed());
    const r = await opp.resolveCriticVerdicts([st], { timeoutMs: 2000, batchMs: 5000 });
    assert.equal(r.resolved, 0, 'Test 5: a degraded envelope is NOT a resolution');
    assert.equal(st.critic, 'pending', 'Test 5: critic stays pending on encoder-unavailable');
    resetCritic();
    ok('Test 5: degraded (encoder-unavailable) envelope never masquerades as resolved');
  }

  // ---------- Test 6: per-statement timeout bounds a never-resolving critic ----------
  {
    resetCritic();
    opp._test.setCriticForTest({
      stageA: function () { return new Promise(function () { /* never resolves */ }); },
    });
    const st = opp.buildOpportunityStatement(wellFormed());
    const t0 = Date.now();
    const r = await opp.resolveCriticVerdicts([st], { timeoutMs: 100, batchMs: 5000 });
    const elapsed = Date.now() - t0;
    assert.equal(r.resolved, 0, 'Test 6: never-resolving critic resolves nothing');
    assert.equal(st.critic, 'pending', 'Test 6: statement stays pending after timeout');
    assert.ok(elapsed < 2000, 'Test 6: timeout actually bounds (took ' + elapsed + 'ms)');
    resetCritic();
    ok('Test 6: per-statement timeout bounds a hung critic (' + elapsed + 'ms)');
  }

  // ---------- Test 7: batch deadline caps the whole pass; remainder stays pending ----------
  {
    resetCritic();
    opp._test.setCriticForTest({
      stageA: function () { return new Promise(function () { /* never resolves */ }); },
    });
    const sts = [
      opp.buildOpportunityStatement(wellFormed()),
      opp.buildOpportunityStatement(wellFormed()),
      opp.buildOpportunityStatement(wellFormed()),
    ];
    const t0 = Date.now();
    const r = await opp.resolveCriticVerdicts(sts, { timeoutMs: 5000, batchMs: 150 });
    const elapsed = Date.now() - t0;
    assert.equal(r.resolved, 0, 'Test 7: nothing resolves against a hung critic');
    assert.equal(r.pending, 3, 'Test 7: ALL three statements counted still-pending');
    assert.equal(r.deadline_hit, true, 'Test 7: the batch deadline is reported honestly');
    for (const st of sts) {
      assert.equal(st.critic, 'pending', 'Test 7: every statement stays pending');
      assert.equal(st.banked, false, 'Test 7: nothing banks');
    }
    assert.ok(elapsed < 3000, 'Test 7: batch deadline actually caps (took ' + elapsed + 'ms)');
    resetCritic();
    ok('Test 7: batch deadline caps the pass; the remainder degrades to honest pending (' + elapsed + 'ms)');
  }

  // ---------- Test 8: an already-resolved statement is never touched ----------
  {
    resetCritic();
    // sync stub resolves at emission time (the 219-01 path)
    const syncVerdict = { pass: true, verdict: 'transferable', reasoning_tag: 'passes_all_gates' };
    opp._test.setCriticForTest(function () { return syncVerdict; });
    const st = opp.buildOpportunityStatement(wellFormed());
    assert.equal(st.banked, true, 'Test 8: sync stub banked at emission (219-01 behavior intact)');
    // now swap in an async critic that would FAIL it - the pass must not re-run
    const stub = asyncCritic({ pass: false, route: 'restatement', tag: 'restatement_vocab_swap' });
    opp._test.setCriticForTest(stub);
    const r = await opp.resolveCriticVerdicts([st], { timeoutMs: 2000, batchMs: 5000 });
    assert.equal(r.attempted, 0, 'Test 8: an already-resolved statement is not re-attempted');
    assert.equal(stub.calls, 0, 'Test 8: the critic is never re-invoked');
    assert.deepEqual(st.critic, syncVerdict, 'Test 8: the original verdict stands');
    assert.equal(st.banked, true, 'Test 8: banked unchanged');
    resetCritic();
    ok('Test 8: resolution only touches pending statements (idempotent over resolved)');
  }

  // ---------- Test 9: absent critic stays pending (module truly missing) ----------
  {
    resetCritic();
    opp._test.setCriticForTest(null); // force the absent path
    const st = opp.buildOpportunityStatement(wellFormed());
    const r = await opp.resolveCriticVerdicts([st], { timeoutMs: 2000, batchMs: 5000 });
    assert.equal(r.resolved, 0, 'Test 9: absent critic resolves nothing');
    assert.equal(st.critic, 'pending', 'Test 9: statement stays pending when the critic is absent');
    resetCritic();
    ok('Test 9: absent critic module keeps the honest pending state');
  }

  console.log('\ntest-219-critic-resolution: ' + passed + ' checks passed');
}

run().then(
  function () { process.exit(0); },
  function (err) {
    console.error('\ntest-219-critic-resolution FAILED: ' + (err && err.stack ? err.stack : err));
    process.exit(1);
  }
);
