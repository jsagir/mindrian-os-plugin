#!/usr/bin/env node
'use strict';
/*
 * tests/test-347-record-per-step.cjs -- Phase 347-04 Task 1.
 *
 * Proves the writer landed in 347-03 finally has a caller: BOTH runChain
 * paths (the synchronous legacy path and the asynchronous resilient path)
 * write one anchored chain_state record per step, before the fold, under
 * one shared run_id, on all three schema variants. Also proves the two
 * failure-mode contracts: no room.db reachable degrades to a silent no-op
 * (byte-identical trace), and a refused write (missing structural anchor)
 * never halts the chain and is counted on the additive
 * record_write_failures field.
 *
 * Plain node:assert CJS script. Hyphens only, no em-dashes (CLAUDE.md HARD
 * RULE).
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');

const { buildChainFixtureRoom, closeChainFixtureRoom, SCHEMA_VARIANTS } =
  require(path.join(REPO, 'tests', 'helpers', 'fixture-room-347.cjs'));
const { runChain } = require(path.join(REPO, 'lib', 'core', 'chain-executor.cjs'));
const chainState = require(path.join(REPO, 'lib', 'core', 'navigation', 'chain-state.cjs'));

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

function makeScratchDir(suffix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-347-04-' + suffix + '-'));
}

const THREE_STEPS = Object.freeze([
  { step: 1, command: '/mos:a' },
  { step: 2, command: '/mos:b' },
  { step: 3, command: '/mos:c' },
]);

// A tier-1 executed chain_output shape (chain-step-dispatcher.cjs's own
// TIER_EXECUTABLE + executed:true shape), so the writer picks kind:'draft'.
function makeChainOutput(idx, step) {
  return { marker: 'output-of-' + step.command, idx: idx, executed: true, tier: 'executable' };
}

function makeOnStep() {
  let idx = 0;
  return function onStep(_step, _previousOutput) {
    const out = makeChainOutput(idx, _step);
    idx += 1;
    return { chain_output: out, quality: 'high' };
  };
}

function chainStateRowsIn(db) {
  const rows = db.prepare('SELECT properties FROM nodes WHERE type = ?').all(chainState.CHAIN_STATE_NODE_TYPE);
  return rows.map((r) => {
    try {
      return JSON.parse(r.properties || '{}');
    } catch (_e) {
      return {};
    }
  });
}

async function main() {
  for (const variant of SCHEMA_VARIANTS) {
    // ---- Test 1 (sync path): exactly 3 records, one per trace entry, one
    // shared run_id. ----
    {
      const tmpDir = makeScratchDir('sync-' + variant);
      const fixture = buildChainFixtureRoom(tmpDir, variant);

      const result = runChain(THREE_STEPS, {
        gateFn: function () { return 'run'; },
        onHalt: function () { return 'approve'; },
        onStep: makeOnStep(),
        maxSteps: 10,
        db: fixture.db,
        subjectNodeId: fixture.subjectNodeId,
      });

      assert.strictEqual(result.completed, true, variant + ': the 3-step sync chain must complete');
      assert.strictEqual(result.trace.length, 3, variant + ': the sync trace must carry exactly 3 entries');
      assert.strictEqual(typeof result.run_id, 'string', variant + ': runChain returns an additive run_id string');
      assert.ok(result.run_id.length > 0, variant + ': run_id is non-empty');

      const records = chainState.readChainState(fixture.db, result.run_id);
      assert.strictEqual(records.length, 3, variant + ': exactly 3 chain_state records exist for this run');
      const stepIndices = records.map((r) => r.step_index).slice().sort((a, b) => a - b);
      assert.deepStrictEqual(stepIndices, [0, 1, 2], variant + ': step_index 0, 1 and 2 are all present');
      for (const r of records) {
        assert.strictEqual(r.run_id, result.run_id, variant + ': every record shares the one run_id');
      }
      ok(variant + ': sync path writes exactly 3 chain_state records, one per trace entry, sharing one run_id');

      closeChainFixtureRoom(fixture);
    }

    // ---- Test 2 (async resilient path): the same 3 records, same shape.
    // A no-op sleep forces EXEC-05 dispatch onto _runChainResilient without
    // enabling journal/resume (roomDir is never supplied here -- the db
    // handle rides opts.db exactly as the sync leg above). ----
    {
      const tmpDir = makeScratchDir('async-' + variant);
      const fixture = buildChainFixtureRoom(tmpDir, variant);

      const result = await runChain(THREE_STEPS, {
        gateFn: function () { return 'run'; },
        onHalt: function () { return 'approve'; },
        onStep: makeOnStep(),
        maxSteps: 10,
        db: fixture.db,
        subjectNodeId: fixture.subjectNodeId,
        sleep: function () { return Promise.resolve(); },
      });

      assert.strictEqual(result.completed, true, variant + ': the 3-step async chain must complete');
      assert.strictEqual(result.trace.length, 3, variant + ': the async trace must carry exactly 3 entries');
      assert.strictEqual(typeof result.run_id, 'string', variant + ': the async path also returns an additive run_id');

      const records = chainState.readChainState(fixture.db, result.run_id);
      assert.strictEqual(records.length, 3, variant + ': the async path also writes exactly 3 chain_state records');
      const stepIndices = records.map((r) => r.step_index).slice().sort((a, b) => a - b);
      assert.deepStrictEqual(stepIndices, [0, 1, 2], variant + ': async step_index 0, 1 and 2 are all present');
      ok(variant + ': async resilient path writes the same 3 records, same shape as the sync path');

      closeChainFixtureRoom(fixture);
    }

    // ---- Test 3 (ordering): the record for step N exists at the moment
    // step N+1's onStep is invoked. Queries the raw nodes table directly
    // (never readChainState/run_id) so the check cannot cheat by reading
    // anything the loop itself handed back. ----
    {
      const tmpDir = makeScratchDir('order-' + variant);
      const fixture = buildChainFixtureRoom(tmpDir, variant);

      let idx = 0;
      const orderedOnStep = function (step, _previousOutput) {
        if (idx > 0) {
          const rows = chainStateRowsIn(fixture.db);
          const predecessorStepIndices = rows.map((p) => p.step_index);
          assert.ok(
            predecessorStepIndices.indexOf(idx - 1) !== -1,
            variant + ': the step-' + (idx - 1) + ' record must already be durable before onStep(' + idx + ') runs'
          );
        }
        const out = makeChainOutput(idx, step);
        idx += 1;
        return { chain_output: out, quality: 'high' };
      };

      const result = runChain(THREE_STEPS, {
        gateFn: function () { return 'run'; },
        onHalt: function () { return 'approve'; },
        onStep: orderedOnStep,
        maxSteps: 10,
        db: fixture.db,
        subjectNodeId: fixture.subjectNodeId,
      });
      assert.strictEqual(result.completed, true, variant + ': the ordering-proof chain must complete');
      ok(variant + ': the predecessor record is durable in room.db before the successor step\'s onStep runs');

      closeChainFixtureRoom(fixture);
    }

    // ---- Test 4 (no room.db reachable): no opts.db, no opts.roomDir. The
    // trace/completed/haltedAt triple stays exactly what it was before this
    // plan, no throw, nothing written. ----
    {
      const result = runChain(THREE_STEPS, {
        gateFn: function () { return 'run'; },
        onHalt: function () { return 'approve'; },
        onStep: makeOnStep(),
        maxSteps: 10,
      });
      assert.strictEqual(result.completed, true, variant + ': a chain with no reachable room.db still completes');
      assert.strictEqual(result.trace.length, 3, variant + ': its trace is unaffected (3 entries)');
      assert.strictEqual(result.haltedAt, null, variant + ': haltedAt is unaffected (null on a clean completion)');
      assert.strictEqual(typeof result.run_id, 'string', variant + ': run_id is still minted even with no database');
      assert.strictEqual(result.record_write_failures, 0, variant + ': no database means no write attempt, so no failure is counted');
      ok(variant + ': with no room.db reachable, runChain writes nothing and its trace/completed/haltedAt are unaffected');
    }

    // ---- Test 5 (refused write): a bogus subjectNodeId makes every write
    // fail missing_structural_anchor. The chain must not halt, quality must
    // be unaffected, and the refusal is counted on the additive field. ----
    {
      const tmpDir = makeScratchDir('refused-' + variant);
      const fixture = buildChainFixtureRoom(tmpDir, variant);

      const result = runChain(THREE_STEPS, {
        gateFn: function () { return 'run'; },
        onHalt: function () { return 'approve'; },
        onStep: makeOnStep(),
        maxSteps: 10,
        db: fixture.db,
        subjectNodeId: 'section:does-not-exist',
      });

      assert.strictEqual(result.completed, true, variant + ': a refused record write must never halt the chain');
      assert.strictEqual(result.trace.length, 3, variant + ': the trace still records every step despite the refusal');
      assert.ok(result.trace.every((t) => t.quality === 'high'), variant + ': quality is unaffected by a refused write');
      assert.strictEqual(typeof result.record_write_failures, 'number', variant + ': record_write_failures is an additive numeric field');
      assert.strictEqual(result.record_write_failures, 3, variant + ': all 3 steps were refused (bogus subject anchor)');

      const records = chainState.readChainState(fixture.db, result.run_id);
      assert.strictEqual(records.length, 0, variant + ': a refused write mints no chain_state row at all');
      ok(variant + ': a refused chain_state write (missing structural anchor) never halts, never touches quality, and is counted');

      closeChainFixtureRoom(fixture);
    }
  }

  console.log(checks + ' checks passed.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
