'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 363 Plan 20 Task 1 -- D-19 acceptance: the diffusion lens is chosen by
 * a local, named rule and joins a Scientific Roadmapping question about a
 * dual-use technology's adoption. Legs F1-F4, all offline.
 *
 * F1  a researcher room with a timing artifact, a Scientific Roadmapping
 *     question set that asks for the diffusion lens: buildPlan selects it with
 *     named sources (larry and room_signal), the plan carries df leaves with
 *     falsifiers, and the engine is scientific-roadmapping.
 * F2  without the request it is still selected by the room signal; a founder
 *     room with no artifact, no request and no adoption step selects nothing.
 * F3  the deep run (replay routes derivation_hit, retest_hit, scurve_ceiling
 *     and diffusion_adoption) classifies limiters (physics only with the
 *     derivation row), reads the S-curve from df:timing rows, counts adoption
 *     steps in the unlock chains (self steps excluded) and names the next
 *     binding constraint.
 * F4  no call reaches Theo during lens selection (a stub brain client records
 *     zero calls).
 *
 * The technology in the fixture is generic (a battery chemistry), never a
 * room-derived phrase. No em-dash or en-dash literals: those characters are
 * spelled with String.fromCharCode. Exit 0 pass, 1 fail, 77 skip.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos363-acc-df-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:1';
process.env.MINDRIAN_BRAIN_TIMEOUT_MS = '500';

const ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(__dirname, 'helpers', 'hygiene-355.cjs'));
hygiene.scrubVendorKey();
delete process.env.OPENALEX_API_KEY;
delete process.env.OPENALEX_EMAIL;
const guard = hygiene.installNetGuard();
const NET_GUARD_FETCH = globalThis.fetch;
const { check, summary } = hygiene.makeChecker('363-20 acceptance: diffusion lens selection');

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

const FIXTURES = path.join(ROOT, 'tests', 'fixtures', '363-openalex', 'bodies.json');
if (!fs.existsSync(FIXTURES)) {
  console.log('SKIP: 363-02 fixtures absent');
  process.exit(77);
}
const BODIES = JSON.parse(fs.readFileSync(FIXTURES, 'utf8'));

const { makeReplayFetch } = require(path.join(__dirname, 'helpers', 'openalex-replay-363.cjs'));
const { buildRoom363 } = require(path.join(__dirname, 'helpers', 'fixture-room-363.cjs'));

const corpus = require(path.join(ROOT, 'lib', 'core', 'research-corpus.cjs'));
const planner = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'planner.cjs'));
const deep = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'deep.cjs'));
const planMod = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'plan.cjs'));
const auditLedger = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'audit-ledger.cjs'));
const brainClient = require(path.join(ROOT, 'lib', 'core', 'brain-client.cjs'));

const QS_DIR = path.join(ROOT, 'tests', 'fixtures', '363-question-sets');
function qsFile(name) { return JSON.parse(fs.readFileSync(path.join(QS_DIR, name + '.json'), 'utf8')); }
function clone(v) { return JSON.parse(JSON.stringify(v)); }

const rooms = [];
function newRoom(role, withTiming) {
  const r = buildRoom363({ role: role, withTimingArtifact: withTiming === true });
  rooms.push(r);
  try { fs.rmSync(path.join(TMP_HOME, '.mindrian'), { recursive: true, force: true }); } catch (_e) { /* ok */ }
  return r;
}

// The dual-use adoption question: the fixture's Scientific Roadmapping set
// (a generic battery chemistry) with the diffusion lens requested by Larry.
function diffusionQs() {
  const qs = qsFile('scientific-roadmapping');
  qs.stated_question = 'Will a dual-use solid-state cell chemistry spread beyond its first buyers?';
  return qs;
}
// The same set with no request and no adoption step anywhere: nothing local
// gives a reason to join the diffusion lens, so none is selected.
function plainQs() {
  const qs = diffusionQs();
  qs.lens_selection = [];
  qs.perspective.unlock_chains.forEach(function (c) { c.steps.forEach(function (s) { s.kind = 'field'; }); });
  qs.leaves = qs.leaves.filter(function (l) { return String(l.dimension).indexOf('df:') !== 0; });
  qs.key_line = qs.key_line.filter(function (k) { return String(k.dimension).indexOf('df:') !== 0; });
  return qs;
}

async function leg(name, fn) {
  try {
    const r = await fn();
    if (r === undefined) return;
    check(name, r === true, String(r));
  } catch (e) {
    check(name, false, (e && e.stack) || String(e));
  }
}

// -- deep-run drive (in process, replay through the fetchEnvelopeFn seam) ----------
function srRoute(q) {
  const s = String(q || '');
  if (/fundamental limit/.test(s)) return 'derivation_hit';
  if (/overcome/.test(s)) return 'retest_hit';
  if (/saturation/.test(s)) return /host volume swing/.test(s) ? 'scurve_headroom' : 'scurve_ceiling';
  if (/adoption OR diffusion/.test(s)) return 'diffusion_adoption';
  if (/\(review OR survey\)/.test(s)) return 'prior_review_two';
  return 'gap_primary_zero';
}
function seam(replay) {
  return async function (args) {
    const prev = globalThis.fetch;
    globalThis.fetch = replay;
    try { return await corpus.fetchCorpusEnvelope(args); } finally { globalThis.fetch = prev; }
  };
}
function rec(key, i) { return BODIES[key].results[i]; }
function rowOf(key, i, leafId, label) {
  const r = rec(key, i);
  return { leaf_id: leafId, record_id: r.id, claim: 'Model claim for ' + leafId, quote: r.title, label: label };
}
function readRecords(room, payload) {
  return JSON.parse(fs.readFileSync(path.join(room.roomDir, payload.records_path), 'utf8')).records;
}
// The lane analyst, simulated: LM1 gets a derivation row, LM2 a retest row and
// (round two) an S-curve ceiling row, LM3 (round two) a df:timing headroom row.
function analyst(p, round) {
  const rows = [];
  if (round === 1 && p.lane === 'LM1') rows.push(rowOf('derivation_hit', 0, 'L8', 'derivation'));
  if (round === 1 && p.lane === 'LM2') rows.push(rowOf('retest_hit', 0, 'L9', 'retest'));
  if (round === 2 && p.lane === 'LM2') rows.push(rowOf('scurve_ceiling', 0, 'L9', 'scurve_ceiling'));
  if (round === 2 && p.lane === 'LM3') rows.push(rowOf('scurve_headroom', 0, 'L15', 'scurve_headroom'));
  return rows;
}
async function driveDeep(room, planIn) {
  // 369.2-24 (HARNESS-10): the field scan spends searches of the cap that this leg's round two needs, and this
  // leg tests the diffusion reading, not the scan (test-3692-baseline owns that): the scan is set to 0 here
  const rev = planner.revisePlan(room.roomDir, planIn.run_id, { op: 'set_budget', budget: { baseline_max: 0 } }, {});
  if (!rev.ok) return { error: 'revisePlan ' + JSON.stringify(rev).slice(0, 200) };
  const plan = rev.plan;
  const replay = makeReplayFetch({ route: srRoute, bodies: BODIES });
  const appr = planner.approvePlanReview(room.roomDir, plan.run_id, { approvedVia: 'cli' });
  if (!appr.ok) return { error: 'approvePlanReview ' + JSON.stringify(appr) };
  const init = deep.initDeepState(room.roomDir, plan, appr.grant, {});
  if (!init.ok) return { error: 'init ' + JSON.stringify(init) };
  const id = plan.run_id;
  const env = { fetchEnvelopeFn: seam(replay) };
  const out = { replay: replay, steps: [] };
  for (let n = 0; n < 60; n += 1) {
    const s = deep.nextDeepStep(room.roomDir, id);
    if (!s.ok) return { error: 'step ' + JSON.stringify(s) };
    out.steps.push(s.step);
    if (s.step === 'fetch_round') {
      const fr = await deep.fetchRound(room.roomDir, id, env);
      if (!fr.ok) return { error: 'fetch ' + JSON.stringify(fr) };
    } else if (s.step === 'dispatch_lanes') {
      for (let i = 0; i < s.payload.lanes.length; i += 1) {
        const p = s.payload.lanes[i];
        const rr = deep.recordLaneRows(room.roomDir, id, p.lane, analyst(p, s.round));
        if (rr && rr.ok === false) return { error: 'record ' + JSON.stringify(rr) };
      }
    } else if (s.step === 'reflect') {
      const pf = deep.proposeFollowups(room.roomDir, id, []);
      if (!pf.ok) return { error: 'followups ' + JSON.stringify(pf) };
    } else if (s.step === 'extend_card') {
      const d = deep.applyExtendDecision(room.roomDir, id, 'stop', {});
      if (!d.ok) return { error: 'extend ' + JSON.stringify(d) };
    } else if (s.step === 'counterevidence') {
      const ce = await deep.runCounterevidence(room.roomDir, id, env);
      if (!ce.ok) return { error: 'ce ' + JSON.stringify(ce) };
      if (ce.lane_payload) {
        const rr = deep.recordLaneRows(room.roomDir, id, 'CE', []);
        if (rr && rr.ok === false) return { error: 'ce record ' + JSON.stringify(rr) };
      }
    } else if (s.step === 'synthesize') {
      out.result = deep.synthesize(room.roomDir, id);
      return out;
    } else if (s.step === 'done') {
      return out;
    }
  }
  return { error: 'loop guard' };
}

async function main() {
  // F1 -------------------------------------------------------------------------
  await leg('F1 researcher room with a timing artifact: diffusion selected with named sources, df leaves with falsifiers, engine scientific-roadmapping', async function () {
    const room = newRoom('researcher', true);
    const r = await planner.buildPlan(room.roomDir, diffusionQs(), { mode: 'deep' });
    if (r.status !== 'ready') return 'status ' + r.status + ' ' + JSON.stringify(r.errors);
    const sel = r.lenses_selected || [];
    if (sel.length !== 1 || sel[0].lens !== 'diffusion') return 'lenses ' + JSON.stringify(sel);
    if (sel[0].source !== 'larry') return 'first source ' + sel[0].source;
    if (sel[0].signals.indexOf('larry') === -1 || sel[0].signals.indexOf('room_signal') === -1) return 'named sources ' + JSON.stringify(sel[0].signals);
    if (typeof sel[0].reason !== 'string' || sel[0].reason.length === 0) return 'no reason on the selection';
    if (r.plan.pyramid.lenses_selected.indexOf('diffusion') === -1) return 'pyramid lenses_selected missing diffusion';
    if (r.plan.perspective.engine !== 'scientific-roadmapping') return 'engine ' + r.plan.perspective.engine;
    const df = r.plan.leaves.filter(function (l) { return String(l.dimension).indexOf('df:') === 0; });
    const dims = df.map(function (l) { return l.dimension; }).sort().join(',');
    if (dims !== 'df:absorptive_capacity,df:civil_defense_crossing,df:first_adopters,df:timing') return 'df leaves ' + dims;
    if (!df.every(function (l) { return l.falsifier && typeof l.falsifier.text === 'string' && l.falsifier.text.length > 0; })) return 'a df leaf has no falsifier';
    const saved = planner.loadPlan(room.roomDir, r.run_id);
    if (!saved.ok || planMod.validatePlan(saved.plan).ok !== true) return 'saved plan invalid';
    return true;
  });

  // F2 -------------------------------------------------------------------------
  await leg('F2 without the request the room signal still selects it; no request, no artifact, no adoption step selects nothing', async function () {
    const room = newRoom('researcher', true);
    const noReq = diffusionQs();
    noReq.lens_selection = [];
    const r = await planner.buildPlan(room.roomDir, noReq, { mode: 'deep' });
    if (r.status !== 'ready') return 'status ' + r.status + ' ' + JSON.stringify(r.errors);
    const sel = r.lenses_selected || [];
    if (sel.length !== 1 || sel[0].source !== 'room_signal') return 'without the request ' + JSON.stringify(sel);
    if (sel[0].signals.indexOf('larry') !== -1) return 'the larry signal fired with no request';

    const founder = newRoom('founder', false);
    const plain = await planner.buildPlan(founder.roomDir, plainQs(), { mode: 'deep' });
    if (plain.ok !== true) return 'plain plan ' + JSON.stringify(plain).slice(0, 300);
    if ((plain.lenses_selected || []).length !== 0) return 'a founder room with no reason selected ' + JSON.stringify(plain.lenses_selected);
    if (plain.plan.pyramid.lenses_selected.length !== 0) return 'pyramid lists a lens that was not selected';

    // a request with no reason is refused, not obeyed
    const bare = diffusionQs();
    bare.lens_selection = [{ lens: 'diffusion', reason: '' }];
    const f2 = newRoom('founder', false);
    const noReason = clone(bare);
    noReason.perspective.unlock_chains.forEach(function (c) { c.steps.forEach(function (s) { s.kind = 'field'; }); });
    const refused = await planner.buildPlan(f2.roomDir, noReason, { mode: 'deep' });
    if ((refused.lenses_selected || []).length !== 0) return 'a request with no reason was obeyed';
    const named = (refused.errors || []).some(function (e) { return /^lens_selection_reason_missing/.test(String(e)); })
      || (refused.lens_refused || []).some(function (x) { return x.reason === 'reason_required'; });
    if (!named) return 'the missing reason was not named ' + JSON.stringify(refused).slice(0, 300);
    return true;
  });

  // F3 -------------------------------------------------------------------------
  await leg('F3 deep run: physics only with the derivation row, S-curve from df:timing rows, adoption steps counted and self steps excluded, next binding constraint named', async function () {
    const room = newRoom('researcher', true);
    const qs = diffusionQs();
    const built = await planner.buildPlan(room.roomDir, qs, { mode: 'deep' });
    if (built.status !== 'ready') return 'plan ' + built.status + ' ' + JSON.stringify(built.errors);
    const loaded = planner.loadPlan(room.roomDir, built.run_id);
    if (!loaded.ok) return 'load ' + JSON.stringify(loaded);
    const out = await driveDeep(room, loaded.plan);
    if (out.error) return out.error;
    if (!out.result || out.result.ok !== true) return 'synthesis ' + JSON.stringify(out.result).slice(0, 300);
    const run = out.result.run;
    const by = {};
    run.classifications.forEach(function (c) { by[c.limiter_id] = c; });
    // physics only with the derivation row
    if (by.LM1.column !== 'physics' || by.LM1.reason !== 'validated_derivation') return 'LM1 ' + JSON.stringify(by.LM1);
    if (['LM2', 'LM3', 'LM4'].some(function (id) { return by[id].column !== 'assumed'; })) return 'a limiter without a derivation row left the assumed column: ' + JSON.stringify(['LM2', 'LM3', 'LM4'].map(function (id) { return by[id].column; }));
    // S-curve: LM2 from its own ceiling row, LM3 only from the df:timing row
    if (by.LM2.s_curve !== 'near_ceiling') return 'LM2 s_curve ' + by.LM2.s_curve;
    if (by.LM3.s_curve !== 'headroom') return 'LM3 did not read the df:timing row: ' + by.LM3.s_curve;
    // the same run without the diffusion lens cannot read LM3 from timing
    const room2 = newRoom('researcher', false);
    const qs2 = diffusionQs();
    qs2.lens_selection = [];
    qs2.perspective.unlock_chains.forEach(function (c) { c.steps.forEach(function (s) { s.kind = 'field'; }); });
    qs2.leaves = qs2.leaves.filter(function (l) { return String(l.dimension).indexOf('df:') !== 0 || l.dimension === 'df:timing'; });
    qs2.key_line = qs2.key_line.filter(function (k) { return String(k.dimension).indexOf('df:') !== 0 || k.dimension === 'df:timing'; });
    const b2 = await planner.buildPlan(room2.roomDir, qs2, { mode: 'deep' });
    if (b2.status !== 'ready' || (b2.lenses_selected || []).length !== 0) return 'no-lens control plan ' + b2.status + ' ' + JSON.stringify(b2.lenses_selected) + JSON.stringify(b2.errors);
    const l2 = planner.loadPlan(room2.roomDir, b2.run_id);
    const out2 = await driveDeep(room2, l2.plan);
    if (out2.error) return 'no-lens run ' + out2.error;
    const lm3 = out2.result.run.classifications.filter(function (c) { return c.limiter_id === 'LM3'; })[0];
    if (lm3.s_curve !== 'unknown') return 'timing informed LM3 without the diffusion lens: ' + lm3.s_curve;
    // adoption steps count as field steps, self steps do not
    const chains = {};
    run.perspective.unlock_chains.forEach(function (c) { chains[c.limiter_id] = c.length; });
    if (chains.LM2 !== 2) return 'LM2 chain length ' + chains.LM2 + ' (field step + adoption step, self step excluded)';
    if (chains.LM4 !== 0) return 'a self step counted: LM4 length ' + chains.LM4;
    if (run.perspective.ranking[0] !== 'LM2') return 'ranking ' + JSON.stringify(run.perspective.ranking);
    // the next binding constraint is named and is an assumed limiter
    if (run.next_binding_constraint !== 'LM2') return 'next binding constraint ' + run.next_binding_constraint;
    const nb = run.perspective.limiters.filter(function (l) { return l.id === run.next_binding_constraint; })[0];
    if (!nb || nb.column !== 'assumed') return 'the next binding constraint is not an assumed limiter';
    if (auditLedger.readAudit(room.roomDir, { run_id: built.run_id }).length === 0) return 'no audited searches';
    if (out.replay.violations.length !== 0) return 'replay recorded a violation';
    return true;
  });

  // F4 -------------------------------------------------------------------------
  await leg('F4 lens selection never reaches Theo: a stub brain client and the shared brain client record zero calls', async function () {
    const room = newRoom('researcher', true);
    let stubCalls = 0;
    const stub = {
      query: async function () { stubCalls += 1; return null; },
      call: async function () { stubCalls += 1; return null; },
    };
    const realQuery = brainClient.query;
    let sharedCalls = 0;
    brainClient.query = function () { sharedCalls += 1; return Promise.resolve(null); };
    try {
      const r = await planner.buildPlan(room.roomDir, diffusionQs(), { mode: 'deep', brainClient: stub });
      if (r.status !== 'ready' || (r.lenses_selected || []).length !== 1) return 'plan ' + r.status;
      const lensOnly = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'structure.cjs')).lensSelection({
        roomDir: room.roomDir, templateId: 'scientific-roadmapping', requested: { lens: 'diffusion', reason: 'adoption is disputed' }, frameworks: ['Scientific Roadmapping'], perspective: diffusionQs().perspective,
      });
      if (lensOnly.selected.length !== 1) return 'direct lens selection ' + JSON.stringify(lensOnly);
    } finally {
      brainClient.query = realQuery;
    }
    if (stubCalls !== 0) return 'the stub brain client was called ' + stubCalls + ' times';
    if (sharedCalls !== 0) return 'the shared brain client was called ' + sharedCalls + ' times';
    if (guard.attempts() !== 0) return 'a network call was attempted';
    return true;
  });

  // guards -----------------------------------------------------------------------
  check('dash guard: no em-dash or en-dash in this test', (function () {
    const s = fs.readFileSync(__filename, 'utf8');
    return s.indexOf(EM) === -1 && s.indexOf(EN) === -1;
  })());
  check('net guard: zero real network attempts', guard.attempts() === 0, 'attempts ' + guard.attempts());
  check('global fetch restored to the net guard', globalThis.fetch === NET_GUARD_FETCH);

  rooms.forEach(function (r) { try { r.cleanup(); } catch (_e) { /* ok */ } });
  return summary();
}

main().then(function (code) { process.exit(code); }).catch(function (e) {
  console.log('FAIL: harness ' + ((e && e.stack) || String(e)));
  process.exit(1);
});
