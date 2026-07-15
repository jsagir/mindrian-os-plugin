'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 223-04 -- /mos:intel-pipeline composition core proof (Req 3 + Req 4).
 * ==========================================================================
 * The staged runner lib/core/intel-pipeline.cjs is a THIN stage composer: it
 * sequences calibrate -> decompose -> plan-fan -> fan -> compute -> synthesize
 * -> close, gating at three declared HITL stages, and terminates through the
 * SAME writeCloseLoop spine bono uses (Req 4, one shared contract). Every leg is
 * an INJECTED seam here: no live LLM, no live web, no model download. Only
 * behavior 4 touches a real room.db + the bank dir (via the shipped
 * writeCloseLoop + a real compute-opportunity-state rollup).
 *
 * Behaviors:
 *   1. dry-run: emits the phase/fan plan and dispatches NOTHING (zero
 *      researchFn/computeFn/writeFn invocations, zero setCurrent).
 *   2. three ordered gate halts: calibrate (F.1), fan-approve (F.1),
 *      synthesize (F.5); a reject at fan-approve fires no research pass.
 *   3. quality:low mid-fan HALTS with a structural disclosure naming the pass
 *      (SEED-059) and dispatches no further passes.
 *   4. full loop: >= 1 claim node lands in room.db (proposed, pipeline
 *      'intel-pipeline') AND the opportunity .md lands in the bank (both stores).
 *   5. G-2: setCurrent called EXACTLY ONCE (at calibrate); a divergent findings
 *      set surfaces a divergence disclosure at the synthesize gate, NOT a second
 *      setCurrent.
 *   6. D-03 structural: comment-stripped source carries no Python/compute-hsi
 *      surface; the compute default names scoreMeasured / eureka-room-report;
 *      exactly one setCurrent call site; no raw SQL; no mindrian-designs.
 *
 * PASS line + non-zero exit on failure. NO em-dashes (CLAUDE.md HARD RULE).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const MOD_PATH = path.join(REPO_ROOT, 'lib', 'core', 'intel-pipeline.cjs');
const { runIntelPipeline, PIPELINE_STAGES } = require(MOD_PATH);
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const { buildFixtureRoom223 } = require(path.join(REPO_ROOT, 'tests', 'helpers', 'fixture-room-223.cjs'));

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) { passed += 1; console.log('  ok - ' + name); } else { failed += 1; console.log('  NOT OK - ' + name); }
}
function mkTmp(prefix) { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)); }

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
// Behavior 1: dry-run emits a plan and dispatches nothing.
// ---------------------------------------------------------------------------
async function b1() {
  console.log('--- Behavior 1: dry-run plan, zero dispatch ---');
  const spy = { research: 0, compute: 0, write: 0, set: 0 };
  const res = await runIntelPipeline({
    roomDir: '/tmp/does-not-matter',
    dryRun: true,
    jtbdFns: jtbdFnsStub(() => { spy.set += 1; }),
    planFn: planStub(5),
    researchFn: () => { spy.research += 1; return { findings: [], quality: 'ok' }; },
    computeFn: () => { spy.compute += 1; return { ok: true }; },
    writeFn: () => { spy.write += 1; return { ok: true }; },
    gateFn: () => { throw new Error('gate must not fire in dry-run'); },
    caps: { fan: 3 },
  });
  check('1a dry_run true, ok true', res.dry_run === true && res.ok === true);
  check('1b plan.stages equals PIPELINE_STAGES', Array.isArray(res.plan.stages) && res.plan.stages.join(',') === PIPELINE_STAGES.join(','));
  check('1c plan carries the calibrated jtbd', res.plan.jtbd && res.plan.jtbd.jtbd === 'validate-idea');
  check('1d plan.dimensions non-empty', Array.isArray(res.plan.dimensions) && res.plan.dimensions.length >= 3);
  check('1e fan.requested from planFn', res.plan.fan.requested === 5);
  check('1f fan.planned clamped low', res.plan.fan.planned === 3);
  check('1g fan.budget present', res.plan.fan.budget && typeof res.plan.fan.budget === 'object');
  check('1h ZERO research/compute/write invocations', spy.research === 0 && spy.compute === 0 && spy.write === 0);
  check('1i ZERO setCurrent in dry-run', spy.set === 0);
}

// ---------------------------------------------------------------------------
// Behavior 2: three ordered gate halts; reject at fan-approve fires no research.
// ---------------------------------------------------------------------------
async function b2() {
  console.log('--- Behavior 2: three ordered gates ---');
  const gateLog = [];
  const healthy = {
    jtbdFns: jtbdFnsStub(),
    planFn: planStub(3),
    researchFn: (dim) => ({ findings: [{ text: 'f-' + dim, dimension: dim }], quality: 'ok' }),
    computeFn: () => ({ ok: true }),
    writeFn: () => ({ ok: true, claim_ids: ['c1'] }),
    bankRollupFn: () => ({ ok: true }),
    caps: { fan: 3 },
  };
  const res = await runIntelPipeline(Object.assign({ roomDir: '/tmp/r', db: {}, gateFn: (ctx) => { gateLog.push({ stage: ctx.stage, shape: ctx.shape }); return { approved: true }; } }, healthy));
  check('2a three gates recorded', gateLog.length === 3);
  check('2b gate stage order', gateLog.map((g) => g.stage).join(',') === 'calibrate,fan-approve,synthesize');
  check('2c gate shape order', gateLog.map((g) => g.shape).join(',') === 'F.1,F.1,F.5');
  check('2d approved run completes ok', res.ok === true && res.halted !== true);

  let researchCalls = 0;
  const res2 = await runIntelPipeline(Object.assign({}, healthy, {
    roomDir: '/tmp/r', db: {},
    researchFn: () => { researchCalls += 1; return { findings: [], quality: 'ok' }; },
    gateFn: (ctx) => (ctx.stage === 'fan-approve' ? { approved: false } : { approved: true }),
  }));
  check('2e reject at fan-approve -> no research pass', researchCalls === 0);
  check('2f reject halts with halt_stage fan-approve', res2.halted === true && res2.halt_stage === 'fan-approve');
  check('2g rejected run ok false', res2.ok === false);
}

// ---------------------------------------------------------------------------
// Behavior 3: quality:low mid-fan HALTS, names the pass, dispatches no more.
// ---------------------------------------------------------------------------
async function b3() {
  console.log('--- Behavior 3: quality-low mid-fan HALT ---');
  let calls = 0;
  const res = await runIntelPipeline({
    roomDir: '/tmp/r', db: {},
    jtbdFns: jtbdFnsStub(),
    planFn: planStub(3),
    gateFn: approveAll,
    researchFn: (dim) => { calls += 1; return { findings: [{ text: 'f' + calls, dimension: dim }], quality: calls === 2 ? 'low' : 'ok' }; },
    computeFn: () => ({ ok: true }),
    writeFn: () => ({ ok: true }),
    caps: { fan: 3 },
  });
  check('3a run halted at fan', res.halted === true && res.halt_stage === 'fan');
  check('3b exactly 2 passes dispatched (pass 3 skipped)', calls === 2);
  const fanStage = res.stages.find((s) => s.stage === 'fan');
  check('3c fan stage discloses SEED-059 + the failing pass', fanStage && /SEED-059/.test(fanStage.disclosure || '') && /pass 2/.test(fanStage.disclosure || ''));
  check('3d run ok false', res.ok === false);
}

// ---------------------------------------------------------------------------
// Behavior 4: full loop lands a claim in room.db AND the opportunity .md in bank.
// ---------------------------------------------------------------------------
async function b4() {
  console.log('--- Behavior 4: full loop, both stores ---');
  const tmp = mkTmp('i223-b4-');
  const fx = await buildFixtureRoom223(tmp, { artifactCount: 4 });
  const db = openRoomDb(fx.roomDir);
  try {
    let firstDim = null;
    const res = await runIntelPipeline({
      roomDir: fx.roomDir, db: db,
      jtbdFns: jtbdFnsStub(),
      planFn: planStub(3),
      gateFn: approveAll,
      researchFn: (dim) => {
        if (firstDim === null) firstDim = dim;
        const opps = dim === firstDim
          ? [{ name: 'Corporate wellness pilot', problem: 'High acquisition cost for meal-kit subscriptions' }]
          : [];
        return { findings: [{ text: 'Evidenced claim for ' + dim, dimension: dim }], opportunities: opps, quality: 'ok' };
      },
      computeFn: () => ({ ok: true, measured: [] }),
      dateStr: '2026-07-15',
      caps: { fan: 3 },
    });
    check('4a run ok (not halted)', res.ok === true && res.halted !== true);
    check('4b writer summary present', res.written && Array.isArray(res.written.claim_ids));

    const claimRows = db.prepare("SELECT id, properties FROM nodes WHERE type = 'claim'").all();
    const pipelineClaims = claimRows.filter((r) => {
      try { return JSON.parse(r.properties || '{}').pipeline === 'intel-pipeline'; } catch (_e) { return false; }
    });
    check('4c >= 1 claim node with pipeline intel-pipeline', pipelineClaims.length >= 1);

    const oppNodes = db.prepare("SELECT id, review_status FROM nodes WHERE type = 'opportunity'").all();
    check('4d opportunity node born proposed', oppNodes.length >= 1 && oppNodes.every((r) => r.review_status === 'proposed'));

    const bankFiles = fs.readdirSync(fx.bankDir).filter((f) => f.endsWith('.md'));
    check('4e opportunity .md landed in the bank (store 2)', bankFiles.length >= 1);
    check('4f writer reports the md_path for the opportunity', res.written.opportunity.length >= 1 && typeof res.written.opportunity[0].md_path === 'string');
  } finally {
    closeRoomDb(db);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Behavior 5: G-2 -- one setCurrent; divergence surfaced at synthesize, not written.
// ---------------------------------------------------------------------------
async function b5() {
  console.log('--- Behavior 5: G-2 single setCurrent + divergence disclosure ---');
  let setCalls = 0;
  const gateLog = [];
  const res = await runIntelPipeline({
    roomDir: '/tmp/r', db: {},
    jtbdFns: jtbdFnsStub(() => { setCalls += 1; }),
    planFn: planStub(3),
    gateFn: (ctx) => { gateLog.push(ctx); return { approved: true }; },
    // Every pass returns a dimension NOT in the calibrated validate-idea cues.
    researchFn: () => ({ findings: [{ text: 'a pivot signal', dimension: 'unrelated-pivot-signal' }], quality: 'ok' }),
    computeFn: () => ({ ok: true }),
    writeFn: () => ({ ok: true, claim_ids: ['c'] }),
    bankRollupFn: () => ({ ok: true }),
    caps: { fan: 3 },
  });
  check('5a setCurrent called EXACTLY once', setCalls === 1);
  const synth = gateLog.find((g) => g.stage === 'synthesize');
  check('5b synthesize gate carries jtbd_divergence', synth && synth.jtbd_divergence && Array.isArray(synth.jtbd_divergence.divergent));
  check('5c divergence names the diverging dimension', synth && synth.jtbd_divergence && synth.jtbd_divergence.divergent.indexOf('unrelated-pivot-signal') !== -1);
  check('5d still exactly one setCurrent after synthesize', setCalls === 1);
  check('5e run completed ok (divergence disclosed, not fatal)', res.ok === true);
}

// ---------------------------------------------------------------------------
// Behavior 6: D-03 structural + chokepoint source assertions.
// ---------------------------------------------------------------------------
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}
function b6() {
  console.log('--- Behavior 6: D-03 structural source assertions ---');
  const src = fs.readFileSync(MOD_PATH, 'utf8');
  const stripped = stripComments(src);
  check('6a no compute-hsi / python / .py / spawn-python surface (comment-stripped)', !/compute-hsi|\.py\b|python|spawn[\s\S]{0,40}python/i.test(stripped));
  check('6b compute default names scoreMeasured', /scoreMeasured/.test(src));
  check('6c compute default names eureka-room-report', /eureka-room-report/.test(src));
  check('6d exactly one setCurrent call site (G-2)', (src.match(/setCurrent/g) || []).length === 1);
  check('6e terminates through writeCloseLoop / close-loop-writer', /writeCloseLoop|close-loop-writer/.test(src));
  check('6f no raw INSERT INTO (comment-stripped)', !/INSERT INTO/.test(stripped));
  check('6g no mindrian-designs reference', !/mindrian-designs/.test(src));
  check('6h no em-dash', !/—/.test(src));
}

async function main() {
  await b1();
  await b2();
  await b3();
  await b4();
  await b5();
  b6();
  console.log('\n' + (failed === 0 ? 'PASS' : 'FAIL') + ' - test-223-intel-pipeline: ' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
