#!/usr/bin/env node
'use strict';
/*
 * Phase 265-22 -- test-265-intel-roster-fan.cjs
 *
 * ACE (/mos:diffusion) derives its actor roster mid-command (step 4, after
 * step 3's FI/OC coding), so neither a pre-chain nor a single mid-flow offer
 * can fill an N-entity table. This file proves the roster parameter added to
 * lib/core/intel-pipeline.cjs closes that gap without a new surface: it is
 * additive (JTBD mode unchanged), the existing fan-approve cost gate still
 * blocks every fetch on rejection, and per-cell attribution survives to the
 * payload handed to close.
 *
 * Seven arms, plain Node, no node:test runner (mirrors tests/test-223-intel-
 * pipeline.cjs's idiom). No network, no real room, NO TEMP DIRECTORY: every
 * arm either dry-runs (which never touches disk beyond a tolerant
 * fs.existsSync presence check inside the composer itself, on a dummy
 * '/tmp/...' string path that need not exist) or stubs writeFn/bankRollupFn
 * so nothing is ever written to a real room. runIntelPipeline's injectable
 * seams (jtbdFns, planFn, gateFn, researchFn, computeFn, writeFn,
 * bankRollupFn) are stubbed throughout, so this file never calls a corpus-
 * fetch function or reaches http(s) -- the "fetch seam" IS researchFn,
 * stubbed here.
 *
 * NO em-dashes (CLAUDE.md HARD RULE). CJS only, zero new deps.
 */

const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const MOD_PATH = path.join(REPO_ROOT, 'lib', 'core', 'intel-pipeline.cjs');
const { runIntelPipeline, rosterToCells } = require(MOD_PATH);

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) { passed += 1; console.log('  ok - ' + name); } else { failed += 1; console.log('  NOT OK - ' + name); }
}

const CURRENT_JTBD = { jtbd: 'validate-idea', confidence: 0.72, evidence: ['seed'] };
function jtbdFnsStub(onSet) {
  return {
    getCurrent: () => Object.assign({}, CURRENT_JTBD),
    setCurrent: (roomDir, opts) => { if (typeof onSet === 'function') onSet(roomDir, opts); },
  };
}
function approveAll() { return { approved: true }; }
function planStub(agents, budget) { return () => ({ agents: agents, budget: budget || { effective: 120000, remaining: 200000 } }); }

// ---------------------------------------------------------------------------
// Arm 1: pure helper arm.
// ---------------------------------------------------------------------------
function arm1() {
  console.log('--- Arm 1: rosterToCells pure helper ---');
  const roster = [{ name: 'A', handle: 'a' }, { name: 'B', handle: 'b' }];
  const axes = ['x', 'y'];
  const r1 = rosterToCells(roster, axes);
  const r2 = rosterToCells(roster, axes);
  check('1a returns ok:true', r1.ok === true);
  check('1b returns 4 cells (2 entities x 2 axes)', Array.isArray(r1.cells) && r1.cells.length === 4);
  check('1c every cell carries entity, axis, handle, cell_id', r1.cells.every((c) => typeof c.entity === 'string' && typeof c.axis === 'string' && typeof c.handle === 'string' && typeof c.cell_id === 'string'));
  check('1d cell_id deterministic across two calls', JSON.stringify(r1.cells.map((c) => c.cell_id)) === JSON.stringify(r2.cells.map((c) => c.cell_id)));
  check('1e cell_ids all unique', new Set(r1.cells.map((c) => c.cell_id)).size === 4);
}

// ---------------------------------------------------------------------------
// Arm 2: helper rejection arm.
// ---------------------------------------------------------------------------
function arm2() {
  console.log('--- Arm 2: rosterToCells rejection arm ---');
  const nonArray = rosterToCells('not-an-array', ['x']);
  check('2a non-array roster -> ok:false with typed reason', nonArray.ok === false && typeof nonArray.reason === 'string');
  const empty = rosterToCells([], ['x']);
  check('2b empty roster -> ok:false with typed reason', empty.ok === false && typeof empty.reason === 'string');
  const noHandle = rosterToCells([{ name: 'A' }, {}], ['x']);
  check('2c entry with no usable handle -> ok:false with typed reason', noHandle.ok === false && typeof noHandle.reason === 'string');
  let threw = false;
  try {
    rosterToCells(null, undefined);
    rosterToCells(undefined, null);
  } catch (_e) {
    threw = true;
  }
  check('2d none of the rejection paths throw', threw === false);
}

// ---------------------------------------------------------------------------
// Arm 3: JTBD regression arm (load-bearing: proves the parameter is additive).
// ---------------------------------------------------------------------------
async function arm3() {
  console.log('--- Arm 3: JTBD-mode regression (no roster) ---');
  const res = await runIntelPipeline({
    roomDir: '/tmp/does-not-matter',
    dryRun: true,
    jtbdFns: jtbdFnsStub(),
    planFn: planStub(5),
    caps: { fan: 3 },
  });
  console.log('  (no-roster plan.dimensions: ' + JSON.stringify(res.plan.dimensions) + ')');
  check('3a plan.dimensions is the JTBD-derived list', Array.isArray(res.plan.dimensions) && res.plan.dimensions.join(',') === 'demand-evidence,competitive-landscape,feasibility');
  check('3b plan.roster_mode is falsy', !res.plan.roster_mode);
  check('3c plan.roster is absent', res.plan.roster === undefined);
}

// ---------------------------------------------------------------------------
// Arm 4: roster substitution arm.
// ---------------------------------------------------------------------------
async function arm4() {
  console.log('--- Arm 4: roster substitution (dry-run) ---');
  const roster = [{ name: 'Alpha Corp', handle: 'alpha-corp' }, { name: 'Beta Inc', handle: 'beta-inc' }, { name: 'Gamma LLC', handle: 'gamma-llc' }];
  const axes = ['fi-capacity', 'oc-capacity', 'conceptual-capacity'];
  const res = await runIntelPipeline({
    roomDir: '/tmp/does-not-matter',
    dryRun: true,
    jtbdFns: jtbdFnsStub(),
    planFn: planStub(9),
    roster: roster,
    rosterAxes: axes,
    caps: { fan: 9 },
  });
  check('4a plan.roster_mode is true', res.plan.roster_mode === true);
  check('4b plan.roster reports {entities:3, axes:3, cells:9}', res.plan.roster && res.plan.roster.entities === 3 && res.plan.roster.axes === 3 && res.plan.roster.cells === 9);
  check('4c plan.dimensions carries the 9 cell ids', Array.isArray(res.plan.dimensions) && res.plan.dimensions.length === 9);
}

// ---------------------------------------------------------------------------
// Arm 5: gate still fires arm (the cost-control arm; asserts the call count).
// ---------------------------------------------------------------------------
async function arm5() {
  console.log('--- Arm 5: fan-approve gate still fires in roster mode ---');
  let fetchCalls = 0;
  const roster = [{ name: 'Alpha Corp', handle: 'alpha-corp' }, { name: 'Beta Inc', handle: 'beta-inc' }];
  const res = await runIntelPipeline({
    roomDir: '/tmp/r', db: {},
    jtbdFns: jtbdFnsStub(),
    planFn: planStub(6),
    roster: roster,
    rosterAxes: ['fi-capacity', 'oc-capacity', 'conceptual-capacity'],
    researchFn: () => { fetchCalls += 1; return { findings: [], quality: 'ok' }; },
    gateFn: (ctx) => (ctx.stage === 'fan-approve' ? { approved: false } : { approved: true }),
    caps: { fan: 6 },
  });
  check('5a run halts', res.halted === true && res.halt_stage === 'fan-approve');
  check('5b halt message contains "no research dispatched"', res.stages.some((s) => /no research dispatched/.test(s.disclosure || '')));
  check('5c fetch stub called ZERO times', fetchCalls === 0);
}

// ---------------------------------------------------------------------------
// Arm 6: cap clamp arm.
// ---------------------------------------------------------------------------
async function arm6() {
  console.log('--- Arm 6: cap clamp arm ---');
  const roster = [
    { name: 'A', handle: 'a' }, { name: 'B', handle: 'b' }, { name: 'C', handle: 'c' },
    { name: 'D', handle: 'd' }, { name: 'E', handle: 'e' },
  ];
  const axes = ['fi-capacity', 'oc-capacity', 'conceptual-capacity'];
  const res = await runIntelPipeline({
    roomDir: '/tmp/does-not-matter',
    dryRun: true,
    jtbdFns: jtbdFnsStub(),
    planFn: planStub(15),
    roster: roster,
    rosterAxes: axes,
    caps: { fan: 3 },
  });
  check('6a plan.fan.requested records the larger number', res.plan.fan.requested === 15);
  check('6b plan.fan.planned clamped to the fanCap', res.plan.fan.planned === 3);
  check('6c plan.roster.cells is the full 15 (5 entities x 3 axes)', res.plan.roster.cells === 15);
}

// ---------------------------------------------------------------------------
// Arm 7: attribution arm.
// ---------------------------------------------------------------------------
async function arm7() {
  console.log('--- Arm 7: attribution survives to close ---');
  const roster = [{ name: 'Alpha Corp', handle: 'alpha-corp' }, { name: 'Beta Inc', handle: 'beta-inc' }];
  const axes = ['fi-capacity', 'oc-capacity'];
  let writtenPayload = null;
  const res = await runIntelPipeline({
    roomDir: '/tmp/r', db: {},
    jtbdFns: jtbdFnsStub(),
    planFn: planStub(4),
    roster: roster,
    rosterAxes: axes,
    gateFn: approveAll,
    researchFn: (dim, ctx) => ({ findings: [{ text: 'capacity finding for ' + dim }], quality: 'ok', entity: ctx.entity, axis: ctx.axis }),
    computeFn: () => ({ ok: true }),
    writeFn: (db, roomDir, payload) => { writtenPayload = payload; return { ok: true, claim_ids: payload.claims.map((_c, i) => 'c' + i) }; },
    bankRollupFn: () => ({ ok: true }),
    caps: { fan: 4 },
  });
  check('7a run completed ok', res.ok === true && res.halted !== true);
  check('7b writeFn was called with a payload', writtenPayload && Array.isArray(writtenPayload.claims));
  const allAttributed = !!writtenPayload && writtenPayload.claims.length === 4
    && writtenPayload.claims.every((c) => typeof c.entity === 'string' && typeof c.axis === 'string');
  check('7c every claim carried into close names its entity and axis (an unattributed result is what a plain research pass already produces)', allAttributed);
}

async function main() {
  arm1();
  arm2();
  await arm3();
  await arm4();
  await arm5();
  await arm6();
  await arm7();
  console.log('\n' + (failed === 0 ? 'PASS' : 'FAIL') + ' - test-265-intel-roster-fan: ' + passed + ' passed, ' + failed + ' failed (7 arms)');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
