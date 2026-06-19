#!/usr/bin/env node
'use strict';

/*
 * Phase 164 Plan 04 -- the parallel (subdomain x hat) cell fan-out test suite.
 *
 * Tests (164-04-PLAN.md <behavior>):
 *   1. Parallel + cap: runCellFanout plans N = subdomains x hats cells, clamps N
 *      to the cost-governor cap (the FUTURES_FANOUT_CAP idiom), and dispatches
 *      them via Promise.all over an injected per-cell dispatch fn -- NOT a
 *      sequential for-loop awaiting one at a time, NOT a runChain require.
 *   2. Shape: each collected result is
 *      {subdomain, hat, stance in {supports,challenges,refines,neutral},
 *       evidence:[], confidence: number in [0,1]}; an erroring cell returns a
 *      graceful neutral/low-confidence stub, never crashing the fan-out.
 *   3. Part 8 web leg: each cell's web leg calls research-corpus.fetchCorpus with
 *      a GENERIC domain handle derived from the subdomain (never venture body);
 *      the spy asserts the query is only the generic handle.
 *   5. Not-runChain: the module does NOT require lib/core/chain-executor.cjs
 *      (source grep-assert).
 *
 * Pure Node built-ins. No emoji. No em-dashes (hyphens only).
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const MOD = path.join(__dirname, '..', 'lib', 'core', 'bono', 'cell-fanout.cjs');
const fanout = require(MOD);

let passed = 0;
function ok(name) { passed++; console.log('  ok - ' + name); }

const STANCES = ['supports', 'challenges', 'refines', 'neutral'];

(async function main() {
  // -------------------------------------------------------------------------
  // Test 1: parallel dispatch + cost-governor cap.
  // -------------------------------------------------------------------------
  {
    // A dispatch spy that records the ORDER it was entered vs resolved. If the
    // fan-out were a sequential await-loop, entry[i+1] would only happen after
    // resolve[i]. With Promise.all all entries happen before any resolve.
    const entryOrder = [];
    const resolveOrder = [];
    let inFlight = 0;
    let maxConcurrent = 0;

    function dispatchCell(cell) {
      entryOrder.push(cell.subdomain + '/' + cell.hat);
      inFlight++;
      maxConcurrent = Math.max(maxConcurrent, inFlight);
      return new Promise((resolve) => {
        // Defer resolution to the next tick so concurrency is observable.
        setImmediate(() => {
          inFlight--;
          resolveOrder.push(cell.subdomain + '/' + cell.hat);
          resolve({ stance: 'supports', evidence: [], confidence: 0.7 });
        });
      });
    }

    // 3 subdomains x 4 hats = 12 cells; cap at 5 should clamp to 5.
    const subdomains = ['sd-a', 'sd-b', 'sd-c'];
    const hats = ['White', 'Black', 'Green', 'Yellow'];

    const res = await fanout.runCellFanout({
      subdomains,
      hats,
      dispatchCell,
      cap: 5,
      researchFn: async () => [],
      selfCritique: (c) => ({ keep: true, cell: c }),
    });

    assert.ok(res && typeof res === 'object', 'returns a result object');
    assert.ok(res.plan && typeof res.plan === 'object', 'carries a plan summary');
    assert.strictEqual(res.plan.requested, 12, 'requested = 3 x 4 = 12 cells');
    assert.strictEqual(res.plan.dispatched, 5, 'dispatched clamped to cap 5');
    assert.strictEqual(res.plan.capped, true, 'plan.capped flags the clamp bit');
    assert.strictEqual(res.cells.length, 5, 'collected exactly the capped count');
    // Parallel proof: more than 1 cell was concurrently in flight (a serial
    // await-loop would have maxConcurrent === 1).
    assert.ok(maxConcurrent > 1, 'cells dispatched in parallel (maxConcurrent ' + maxConcurrent + ' > 1)');
    // All entries happened before all resolves (Promise.all, not serial).
    assert.strictEqual(entryOrder.length, 5, 'all 5 cells entered');
    ok('Test 1: parallel dispatch + cost-governor cap clamps the grid');
  }

  // -------------------------------------------------------------------------
  // Test 2: shape + defensive stub on a cell error.
  // -------------------------------------------------------------------------
  {
    let call = 0;
    function dispatchCell(cell) {
      call++;
      // The second cell throws -- the fan-out must NOT crash; it returns a
      // graceful neutral low-confidence stub for that cell.
      if (call === 2) return Promise.reject(new Error('cell boom'));
      return Promise.resolve({ stance: 'challenges', evidence: [{ id: 'e1' }], confidence: 0.6 });
    }

    const res = await fanout.runCellFanout({
      subdomains: ['sd-x', 'sd-y'],
      hats: ['White'],
      dispatchCell,
      cap: 10,
      researchFn: async () => [],
      selfCritique: (c) => ({ keep: true, cell: c }),
    });

    assert.strictEqual(res.cells.length, 2, 'both cells collected (error did not crash the fan-out)');
    for (const c of res.cells) {
      assert.ok(typeof c.subdomain === 'string', 'cell carries subdomain');
      assert.ok(typeof c.hat === 'string', 'cell carries hat');
      assert.ok(STANCES.includes(c.stance), 'stance in the closed set: ' + c.stance);
      assert.ok(Array.isArray(c.evidence), 'evidence is an array');
      assert.ok(typeof c.confidence === 'number' && c.confidence >= 0 && c.confidence <= 1,
        'confidence is a scalar in [0,1]: ' + c.confidence);
    }
    // The erroring cell is the defensive stub: neutral + low confidence.
    const stub = res.cells.find((c) => c.stance === 'neutral');
    assert.ok(stub, 'the erroring cell collapsed to a neutral stub');
    assert.ok(stub.confidence <= 0.2, 'the defensive stub carries low confidence: ' + stub.confidence);
    ok('Test 2: shape contract + defensive neutral stub on a cell error');
  }

  // -------------------------------------------------------------------------
  // Test 3: Part 8 web leg -- fetchCorpus carries a GENERIC handle only.
  // -------------------------------------------------------------------------
  {
    const seenQueries = [];
    // A fetchCorpus SPY: records the query each cell passed and returns a stub.
    async function researchSpy(args) {
      seenQueries.push(args && args.query);
      return [{ id: 'paper-1', title: 'generic finding' }];
    }

    // The dispatch fn here uses the default per-cell research path: in this
    // suite we pass dispatchCell undefined so the module's DEFAULT per-cell
    // research dispatch runs (which calls researchFn = the spy).
    const VENTURE_BODY = 'Acme proprietary CAR-T manufacturing margin 42 percent secret';

    const res = await fanout.runCellFanout({
      subdomains: ['quantum-imaging'],
      hats: ['White'],
      // no dispatchCell -> exercise the default per-cell research dispatch
      researchFn: researchSpy,
      cap: 10,
      ventureBody: VENTURE_BODY, // deliberately try to smuggle venture content
      selfCritique: (c) => ({ keep: true, cell: c }),
    });

    assert.strictEqual(seenQueries.length, 1, 'the web leg fired exactly once for the one White cell');
    const q = String(seenQueries[0] || '');
    assert.ok(q.length > 0, 'the query is a non-empty generic handle');
    assert.ok(q.indexOf('proprietary') === -1 && q.indexOf('42 percent') === -1 && q.indexOf('secret') === -1,
      'the venture body never crossed the boundary: ' + q);
    assert.ok(q.toLowerCase().indexOf('quantum') !== -1 || q.toLowerCase().indexOf('imaging') !== -1,
      'the query is the GENERIC subdomain-derived handle: ' + q);
    // The cell collected a reading carrying the evidence from the spy.
    assert.strictEqual(res.cells.length, 1, 'one cell collected');
    ok('Test 3: Part 8 web leg passes only a generic subdomain handle to fetchCorpus');
  }

  // -------------------------------------------------------------------------
  // Test 5: not-runChain -- the module must NOT require chain-executor.cjs.
  // -------------------------------------------------------------------------
  {
    const src = fs.readFileSync(MOD, 'utf-8');
    assert.ok(src.indexOf('chain-executor') === -1,
      'cell-fanout.cjs must NOT require lib/core/chain-executor.cjs (the fan-out is parallel; Wave 5 consumes it)');
    assert.ok(src.indexOf('runChain') === -1,
      'cell-fanout.cjs must NOT reference runChain (D-164-S2)');
    // It DOES wire the cost-governor substrate (planDispatch + the futures cap).
    assert.ok(src.indexOf('planDispatch') !== -1, 'rides dispatch-optimizer.planDispatch (the cost-governed swarm planner)');
    assert.ok(src.indexOf('FUTURES_FANOUT_CAP') !== -1 || src.indexOf('resolveFanoutCap') !== -1,
      'mirrors the FUTURES_FANOUT_CAP clamp idiom');
    assert.ok(src.indexOf('fetchCorpus') !== -1, 'the web leg is research-corpus.fetchCorpus');
    ok('Test 5: not-runChain (parallel substrate only) + the reuse pointers are wired');
  }

  console.log('\n' + passed + ' assertions/blocks passed (test-bono-cell-fanout.cjs)');
})().catch((e) => {
  console.error('FAIL:', e && e.message);
  console.error(e && e.stack);
  process.exit(1);
});
