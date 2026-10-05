'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 363 Plan 16 -- room-started quick research runs inside a standing
 * grant, riding the 355.1 ambient child (lib/core/research-planner/ambient.cjs
 * and the one guarded call in lib/core/ambient-run.cjs). Legs M1-M11, all
 * offline on OpenAlex replay.
 *
 * The replay fetch is injected through maybeQuick's deps.fetchEnvelopeFn and,
 * for the wiring legs, through runAmbientInChild's existing o.deps seam
 * (deps.researchPlanner). The composition itself is stubbed there, as the
 * 355.1 tests do. The net guard stays installed everywhere else and its counter
 * is the last check. Rooms come from fixture-room-363 (and fixture-room-3551
 * for the wiring legs, which need a claimable room delta).
 *
 * No em-dash or en-dash literals: those characters are spelled with
 * String.fromCharCode.
 *
 * Exit 0 pass, 1 fail, 77 skip (fixtures absent).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos363-ambient-home-'));
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
const { check, summary } = hygiene.makeChecker('363-16 ambient quick research run');

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

const FIXTURES = path.join(ROOT, 'tests', 'fixtures', '363-openalex', 'bodies.json');
if (!fs.existsSync(FIXTURES)) {
  console.log('SKIP: 363-02 fixtures absent');
  process.exit(77);
}
const BODIES = JSON.parse(fs.readFileSync(FIXTURES, 'utf8'));

const { makeReplayFetch } = require(path.join(__dirname, 'helpers', 'openalex-replay-363.cjs'));
const { buildRoom363, GAP_TERM_363 } = require(path.join(__dirname, 'helpers', 'fixture-room-363.cjs'));
const { buildDeltaRoom } = require(path.join(__dirname, 'helpers', 'fixture-room-3551.cjs'));

const corpus = require(path.join(ROOT, 'lib', 'core', 'research-corpus.cjs'));
const grants = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'grants.cjs'));
const auditLedger = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'audit-ledger.cjs'));
const planner = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'planner.cjs'));
const cadenceGuard = require(path.join(ROOT, 'scripts', 'scout-cadence-guard.cjs'));
const ambientRun = require(path.join(ROOT, 'lib', 'core', 'ambient-run.cjs'));

const AMBIENT_FILE = path.join(ROOT, 'lib', 'core', 'research-planner', 'ambient.cjs');
let AMBIENT = null;
let loadError = null;
try {
  AMBIENT = require(AMBIENT_FILE);
} catch (e) {
  loadError = e;
}

const SYN = 'ultrasonic biofilm removal';
const NOW = Date.parse('2026-09-30T10:00:00Z');
const BIG_BUDGET = 4 * 60 * 1000;

const rooms = [];
function newRoom() {
  const r = buildRoom363({ role: 'researcher' });
  rooms.push(r);
  return r;
}

function standingGrant(room, terms) {
  const list = terms || [{ term: GAP_TERM_363, synonyms: [SYN] }];
  const proposal = grants.buildStandingProposal(room.roomDir, { terms: list });
  const w = grants.writeGrant(room.roomDir, proposal, { approved_via: { surface: 'cli', decision_node_id: 'd-363-16-test' } });
  if (!w.ok) throw new Error('grant failed: ' + JSON.stringify(w));
  return w.grant;
}

function routeBy(map) {
  return function (q) {
    const s = String(q || '');
    if (s.indexOf(' OR ') !== -1) return map.cover;
    if (s.indexOf(' AND (') !== -1) return map.prior;
    return map.primary;
  };
}

function seam(replay) {
  return async function (args) {
    const prev = globalThis.fetch;
    globalThis.fetch = replay;
    try {
      return await corpus.fetchCorpusEnvelope(args);
    } finally {
      globalThis.fetch = prev;
    }
  };
}

const ZERO = { primary: 'gap_primary_zero', cover: 'gap_primary_zero', prior: 'gap_primary_zero' };

function replayZero() {
  return makeReplayFetch({ route: routeBy(ZERO), bodies: BODIES });
}

// The composition result shape runAmbientComposition returns; whitespace ran.
function compWithWhitespace() {
  return {
    producers: { whitespace: { outcome: 'no_candidate', posture: 'run' } },
    tier_counts: { strong: 0, indirect: 0, unverified: 0 },
    card: null,
    surfaced_via: 'none',
  };
}

function compWithout() {
  return {
    producers: { eureka: { outcome: 'no_candidate', posture: 'run' }, whitespace: { outcome: 'deps_missing', posture: 'run' } },
    tier_counts: { strong: 0, indirect: 0, unverified: 0 },
    card: null,
    surfaced_via: 'none',
  };
}

function writeGaps(roomDir, gaps) {
  fs.writeFileSync(path.join(roomDir, '.mindrian', 'whitespace-results.json'),
    JSON.stringify({ metadata: { frozen_for: 'phase-363-tests' }, gaps: gaps }, null, 2), 'utf8');
}

function runsDir(room) { return path.join(room.roomDir, '.mindrian', 'research-runs'); }
function runDirs(room) {
  try { return fs.readdirSync(runsDir(room)); } catch (_e) { return []; }
}

function walk(dir, out) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return out; }
  entries.forEach(function (e) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  });
  return out;
}

function fileText(room, rel) { return fs.readFileSync(path.join(room.roomDir, rel), 'utf8'); }
function hasDash(text) { return text.indexOf(EM) !== -1 || text.indexOf(EN) !== -1; }

function optsFor(replay, extra) {
  return Object.assign({
    budgetMs: BIG_BUDGET,
    now: NOW,
    deltaHash: 'a'.repeat(64),
    deps: { fetchEnvelopeFn: seam(replay) },
  }, extra || {});
}

async function main() {
  if (!AMBIENT) {
    check('M0 lib/core/research-planner/ambient.cjs loads', false, loadError && loadError.message);
    check('M1 no whitespace finding -> skipped_no_whitespace, zero calls', false, 'module missing');
    check('M2 a 1-section gap -> context_insufficient, nothing written', false, 'module missing');
    check('M3 2-section gap, no grant -> plan_card_no_grant, zero egress', false, 'module missing');
    check('M4 grant without the term -> plan_card_reask new_term, zero calls', false, 'module missing');
    check('M5 grant covers the term -> ran: quick run, audit, pending evidence card, unfiled', false, 'module missing');
    check('M6 throttle and once-per-delta', false, 'module missing');
    check('M7 tiny remaining budget -> budget_exhausted before any call', false, 'module missing');
    check('M8 isolation: strict 355.1 ledger and delta state keep their key sets', false, 'module missing');
    check('M9 wiring: one guarded call after composition, before the lock release', false, 'module missing');
    check('M10 deep never', false, 'module missing');
    check('M11 Part 8: planted marker never leaves', false, 'module missing');
    return;
  }

  check('M0 ambient.cjs exports maybeQuick, whitespaceQuestionSet, AMBIENT_OUTCOMES',
    typeof AMBIENT.maybeQuick === 'function' && typeof AMBIENT.whitespaceQuestionSet === 'function'
    && Array.isArray(AMBIENT.AMBIENT_OUTCOMES) && AMBIENT.AMBIENT_OUTCOMES.length >= 9);

  // ---- M1 ------------------------------------------------------------------
  {
    const room = newRoom();
    standingGrant(room);
    const replay = replayZero();
    const a = await AMBIENT.maybeQuick(room.roomDir, compWithout(), optsFor(replay));
    const b = await AMBIENT.maybeQuick(room.roomDir, { producers: {}, card: null }, optsFor(replay));
    fs.rmSync(path.join(room.roomDir, '.mindrian', 'whitespace-results.json'));
    const c = await AMBIENT.maybeQuick(room.roomDir, compWithWhitespace(), optsFor(replay));
    check('M1 no whitespace finding -> skipped_no_whitespace, zero calls',
      a.outcome === 'skipped_no_whitespace' && b.outcome === 'skipped_no_whitespace' && c.outcome === 'skipped_no_whitespace'
      && replay.calls.length === 0 && runDirs(room).length === 0,
      JSON.stringify([a.outcome, b.outcome, c.outcome, replay.calls.length]));
  }

  // ---- M2 ------------------------------------------------------------------
  {
    const room = newRoom();
    standingGrant(room);
    writeGaps(room.roomDir, [room.zones.oneSection]);
    const replay = replayZero();
    const out = await AMBIENT.maybeQuick(room.roomDir, compWithWhitespace(), optsFor(replay));
    check('M2 a 1-section gap -> context_insufficient, zero calls, nothing under research-runs',
      out.outcome === 'context_insufficient' && replay.calls.length === 0 && runDirs(room).length === 0
      && !fs.existsSync(path.join(room.roomDir, 'research')),
      JSON.stringify(out));
  }

  // ---- M3 ------------------------------------------------------------------
  {
    const room = newRoom();
    const replay = replayZero();
    const out = await AMBIENT.maybeQuick(room.roomDir, compWithWhitespace(), optsFor(replay));
    const dir = out.run_id ? path.join('.mindrian', 'research-runs', out.run_id) : null;
    const pending = planner.pendingCards(room.roomDir);
    const hit = pending.filter(function (p) { return p.run_id === out.run_id; })[0];
    check('M3 2-section gap, no grant -> plan_card_no_grant: plan.json + card.json, pending, zero egress, no audit',
      out.outcome === 'plan_card_no_grant' && !!dir
      && fs.existsSync(path.join(room.roomDir, dir, 'plan.json')) && fs.existsSync(path.join(room.roomDir, dir, 'card.json'))
      && !!hit && hit.kind === 'plan_card_no_grant' && !!hit.card
      && replay.calls.length === 0 && auditLedger.readAudit(room.roomDir, {}).length === 0
      && !fs.existsSync(path.join(room.roomDir, dir, 'run.json')),
      JSON.stringify(out));
  }

  // ---- M4 ------------------------------------------------------------------
  {
    const room = newRoom();
    standingGrant(room, [{ term: 'unrelated approved term', synonyms: [] }]);
    const replay = replayZero();
    const out = await AMBIENT.maybeQuick(room.roomDir, compWithWhitespace(), optsFor(replay));
    let card = null;
    try { card = JSON.parse(fileText(room, path.join('.mindrian', 'research-runs', out.run_id, 'card.json'))); } catch (_e) { card = null; }
    const listed = card && card.payload && Array.isArray(card.payload.new_terms) && card.payload.new_terms.indexOf(GAP_TERM_363) !== -1;
    check('M4 a grant without the gap term -> plan_card_reask (new_term), zero calls, the card lists the new term',
      out.outcome === 'plan_card_reask' && out.reason === 'new_term' && replay.calls.length === 0 && !!listed
      && auditLedger.readAudit(room.roomDir, {}).length === 0,
      JSON.stringify(out));
  }

  // ---- M5 (kept for M6 and M8 below) -----------------------------------------
  const room5 = newRoom();
  const delta5 = 'b'.repeat(64);
  let out5 = null;
  let replay5 = null;
  {
    standingGrant(room5);
    replay5 = replayZero();
    out5 = await AMBIENT.maybeQuick(room5.roomDir, compWithWhitespace(), optsFor(replay5, { deltaHash: delta5 }));
    const runId = out5.run_id;
    let run = null;
    try { run = JSON.parse(fileText(room5, path.join('.mindrian', 'research-runs', runId, 'run.json'))); } catch (_e) { run = null; }
    const pending = planner.pendingCards(room5.roomDir);
    const hit = pending.filter(function (p) { return p.run_id === runId; })[0];
    const audit = auditLedger.readAudit(room5.roomDir, { run_id: runId });
    check('M5 covered term -> ran: at most 3 replay calls, audit written, run.json trigger ambient, evidence card queued, unfiled',
      out5.outcome === 'ran' && replay5.calls.length >= 1 && replay5.calls.length <= 3
      && audit.length >= 1 && !!run && run.trigger === 'ambient' && run.filed === false
      && !!hit && hit.kind === 'evidence' && !!hit.card
      && !fs.existsSync(path.join(room5.roomDir, 'research')),
      JSON.stringify({ o: out5.outcome, calls: replay5.calls.length, audit: audit.length, trig: run && run.trigger, hit: !!hit }));
  }

  // ---- M6 ------------------------------------------------------------------
  {
    const replay = replayZero();
    const sameDelta = await AMBIENT.maybeQuick(room5.roomDir, compWithWhitespace(), optsFor(replay, { deltaHash: delta5 }));
    const otherDelta = await AMBIENT.maybeQuick(room5.roomDir, compWithWhitespace(), optsFor(replay, { deltaHash: 'c'.repeat(64) }));
    const later = await AMBIENT.maybeQuick(room5.roomDir, compWithWhitespace(),
      optsFor(replay, { deltaHash: 'd'.repeat(64), now: NOW + 61 * 60 * 1000 }));
    check('M6 a second run inside the hour -> throttled (zero calls); same delta -> already_run_for_delta; a later hour runs',
      sameDelta.outcome === 'already_run_for_delta' && otherDelta.outcome === 'throttled'
      && later.outcome === 'ran' && replay.calls.length <= 3,
      JSON.stringify([sameDelta.outcome, otherDelta.outcome, later.outcome, replay.calls.length]));
  }

  // ---- M7 ------------------------------------------------------------------
  {
    const room = newRoom();
    standingGrant(room);
    const replay = replayZero();
    const out = await AMBIENT.maybeQuick(room.roomDir, compWithWhitespace(), optsFor(replay, { budgetMs: 1000 }));
    check('M7 a tiny remaining budget -> budget_exhausted before any call or write',
      out.outcome === 'budget_exhausted' && replay.calls.length === 0 && runDirs(room).length === 0,
      JSON.stringify(out));
  }

  // ---- M8 (maybeQuick alone) + M9 (wiring) -----------------------------------
  {
    const noLedger = !fs.existsSync(path.join(room5.roomDir, '.mindrian', 'ambient-run-ledger.json'))
      && !fs.existsSync(path.join(room5.roomDir, '.mindrian', 'last-room-delta.json'));
    const src = fs.readFileSync(AMBIENT_FILE, 'utf8');
    check('M8a maybeQuick touches neither the 355.1 ambient ledger nor the delta-state file',
      noLedger && src.indexOf('scout-cadence-guard') === -1 && src.indexOf('recordAmbientRun') === -1);
  }

  // Wiring room: a claimable delta plus a frozen two-section gap and a grant.
  function wiringRoom(label) {
    const r = buildDeltaRoom(label);
    rooms.push(r);
    fs.mkdirSync(path.join(r.roomDir, '.mindrian'), { recursive: true });
    const donor = buildRoom363({ role: 'researcher' });
    rooms.push(donor);
    writeGaps(r.roomDir, [donor.zones.twoSection, donor.zones.oneSection]);
    r.addArtifact();
    standingGrant(r);
    return r;
  }

  function fakeComposition(calls) {
    return function () {
      calls.push('composition');
      return Promise.resolve(compWithWhitespace());
    };
  }

  // M9a: order and single call
  {
    const room = wiringRoom('wire-order');
    const calls = [];
    const lockFile = cadenceGuard.ambientLockPath ? cadenceGuard.ambientLockPath(room.roomDir) : null;
    const seen = [];
    const spy = function (roomDir, comp, opts) {
      calls.push('maybeQuick');
      const st = cadenceGuard.readRoomDeltaState(roomDir);
      seen.push({ run_state: st && st.run_state, budget: opts && opts.budgetMs, dh: opts && opts.deltaHash, hasComp: !!(comp && comp.producers) });
      return Promise.resolve({ outcome: 'skipped_no_whitespace' });
    };
    void lockFile;
    const res = await ambientRun.runAmbientInChild(room.roomDir, {
      seam: 'material', materialId: 'ab12cd34ef56', sessionId: 's',
      deps: { composition: fakeComposition(calls), researchPlanner: { maybeQuick: spy } },
      now: Date.now(),
    });
    const budgetOk = seen[0] && Number.isFinite(seen[0].budget) && seen[0].budget > 0 && seen[0].budget <= ambientRun.AMBIENT_TOTAL_BUDGET_MS;
    check('M9a runAmbientInChild calls maybeQuick once, after composition, while the run is still running',
      calls.join(',') === 'composition,maybeQuick' && res.state === 'completed'
      && seen[0].run_state === 'running' && seen[0].hasComp && /^[0-9a-f]{64}$/.test(seen[0].dh || '') && budgetOk,
      JSON.stringify({ calls: calls, res: res, seen: seen }));
  }

  // M9b: a throwing maybeQuick never changes the returned state; M8b strict files
  {
    const room = wiringRoom('wire-throw');
    const calls = [];
    const spy = function () { throw new Error('research branch exploded'); };
    const res = await ambientRun.runAmbientInChild(room.roomDir, {
      seam: 'material', materialId: 'ab12cd34ef56', sessionId: 's',
      deps: { composition: fakeComposition(calls), researchPlanner: { maybeQuick: spy } },
      now: Date.now(),
    });
    const st = cadenceGuard.readRoomDeltaState(room.roomDir);
    check('M9b a maybeQuick that throws does not change the returned ambient state',
      res.state === 'completed' && !!st && st.run_state === 'completed', JSON.stringify({ res: res, st: st && st.run_state }));
  }

  // M9c + M8b: the real maybeQuick through the ambient child: a run happens, the strict files stay strict
  {
    const room = wiringRoom('wire-real');
    const calls = [];
    const replay = replayZero();
    const res = await ambientRun.runAmbientInChild(room.roomDir, {
      seam: 'material', materialId: 'ab12cd34ef56', sessionId: 's',
      deps: { composition: fakeComposition(calls), researchPlanner: { fetchEnvelopeFn: seam(replay) } },
      now: Date.now(),
    });
    const pending = planner.pendingCards(room.roomDir);
    check('M9c the real branch runs inside the ambient child: one quick run, evidence card queued',
      res.state === 'completed' && replay.calls.length >= 1 && replay.calls.length <= 3
      && pending.some(function (p) { return p.kind === 'evidence'; }),
      JSON.stringify({ res: res, calls: replay.calls.length, pending: pending.length }));

    const ledgerRaw = JSON.parse(fileText(room, path.join('.mindrian', 'ambient-run-ledger.json')));
    const deltaRaw = JSON.parse(fileText(room, path.join('.mindrian', 'last-room-delta.json')));
    const ledgerKeys = Object.keys(ledgerRaw).sort();
    const wantLedger = ['schema_version', 'origin', 'last_run', 'last_delta_hash', 'watermarks', 'in_flight', 'runs_window', 'producers', 'tier_counts', 'surfaced_via', 'stamped_materials', 'last_closeout_at'].sort();
    const deltaKeys = Object.keys(deltaRaw).sort();
    const wantDelta = ['schema_version', 'evaluated_at', 'seam', 'classes', 'delta_hash', 'run_state', 'material_id', 'opportunity_handle', 'surfaced_via', 'framing'].sort();
    const producerIds = Object.keys(ledgerRaw.producers || {});
    const validation = cadenceGuard.validateDeltaState(deltaRaw);
    check('M8b the 355.1 ambient ledger and delta state still validate with unchanged key sets and no research producer id',
      cadenceGuard.validateAmbientLedger(ledgerRaw) === true && validation.ok === true
      && JSON.stringify(ledgerKeys) === JSON.stringify(wantLedger) && JSON.stringify(deltaKeys) === JSON.stringify(wantDelta)
      && producerIds.every(function (id) { return cadenceGuard.AMBIENT_PRODUCER_IDS.indexOf(id) !== -1; })
      && cadenceGuard.AMBIENT_PRODUCER_IDS.indexOf('research') === -1,
      JSON.stringify({ ledgerKeys: ledgerKeys, deltaKeys: deltaKeys, producerIds: producerIds }));
  }

  // ---- M9d: source-level wiring pin ------------------------------------------
  {
    const src = fs.readFileSync(path.join(ROOT, 'lib', 'core', 'ambient-run.cjs'), 'utf8');
    const count = (src.match(/maybeQuick/g) || []).length;
    const iComp = src.indexOf('compositionFn(roomDir');
    const iCall = src.indexOf('maybeQuick(roomDir');
    const iRecord = src.indexOf('scoutCadenceGuard.recordAmbientRun(roomDir');
    const iRelease = src.indexOf('scoutCadenceGuard.releaseAmbientLock(roomDir');
    check('M9d source pin: the require and the call sit after composition, before recordAmbientRun and the lock release',
      src.indexOf('research-planner/ambient.cjs') !== -1 && count >= 2 && iComp !== -1 && iCall > iComp && iCall < iRecord && iRecord < iRelease,
      JSON.stringify({ count: count, iComp: iComp, iCall: iCall, iRecord: iRecord, iRelease: iRelease }));
  }

  // ---- M10 -------------------------------------------------------------------
  {
    const src = fs.readFileSync(AMBIENT_FILE, 'utf8');
    const requires = (src.match(/require\(([^)]*)\)/g) || []).join('\n');
    const room = newRoom();
    standingGrant(room);
    const deepQs = AMBIENT.whitespaceQuestionSet({ term: GAP_TERM_363, sections: ['problem-definition', 'market-analysis'] }, null);
    const deepPlan = planner.buildPlan(room.roomDir, deepQs, { mode: 'deep', now: new Date(NOW) });
    const before = deepPlan && deepPlan.ok ? path.join(room.roomDir, '.mindrian', 'research-runs', deepPlan.run_id) : null;
    const replay = replayZero();
    const out = await AMBIENT.maybeQuick(room.roomDir, compWithWhitespace(), optsFor(replay));
    const noState = !before || (!fs.existsSync(path.join(before, 'state.json')) && !fs.existsSync(path.join(before, 'run.json')));
    check('M10 deep never: no deep.cjs require, and a saved deep plan is never started',
      !/deep\.cjs/.test(requires) && !/escalate|nextDeepStep|fetchRound|ensureDeepState/.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''))
      && noState && out.outcome === 'ran',
      JSON.stringify({ req: requires.slice(0, 400), noState: noState, o: out.outcome }));
  }

  // ---- M11 -------------------------------------------------------------------
  {
    const room = newRoom();
    standingGrant(room);
    const replay = replayZero();
    const out = await AMBIENT.maybeQuick(room.roomDir, compWithWhitespace(), optsFor(replay));
    const audit = JSON.stringify(auditLedger.readAudit(room.roomDir, {}));
    const urls = JSON.stringify(replay.calls);
    const stateText = walk(runsDir(room), []).map(function (f) { return fs.readFileSync(f, 'utf8'); }).join('\n');
    const argvText = JSON.stringify(process.argv);
    check('M11 Part 8: the planted marker is in no replay URL, no audit record, no run state and no argv',
      out.outcome === 'ran' && replay.calls.length >= 1
      && urls.indexOf(room.marker) === -1 && audit.indexOf(room.marker) === -1
      && stateText.indexOf(room.marker) === -1 && argvText.indexOf(room.marker) === -1
      && replay.violations.length === 0,
      JSON.stringify({ o: out.outcome, urls: urls.indexOf(room.marker), audit: audit.indexOf(room.marker), state: stateText.indexOf(room.marker) }));
  }

  // ---- M12 (369.2 R02): a standing grant never sends; the card is a run grant -----------
  // 369.2-10 (R02, ruling 2026-10-05, A5): a room-started pass under a covering STANDING grant
  // records a plan-only card whose proposal is a run grant listing every exact string. Zero
  // replay calls, no run, no audit.
  let m12 = null;
  {
    const room = newRoom();
    standingGrant(room);
    const replay = replayZero();
    const out = await AMBIENT.maybeQuick(room.roomDir, compWithWhitespace(), optsFor(replay, { deltaHash: 'e'.repeat(64) }));
    let prop = null;
    let plan = null;
    try { prop = JSON.parse(fileText(room, path.join('.mindrian', 'research-runs', out.run_id, 'proposal.json'))).proposal; } catch (_e) { prop = null; }
    try { plan = planner.loadPlan(room.roomDir, out.run_id).plan; } catch (_e) { plan = null; }
    const qHashes = [];
    ((plan && plan.leaves) || []).forEach(function (leaf) {
      ((leaf && leaf.queries) || []).forEach(function (q) { if (q && qHashes.indexOf(q.q_hash) === -1) qHashes.push(q.q_hash); });
    });
    const same = !!prop && Array.isArray(prop.approved_hashes) && qHashes.length > 0
      && JSON.stringify(prop.approved_hashes.slice().sort()) === JSON.stringify(qHashes.slice().sort());
    m12 = { room: room, out: out, replay: replay, plan: plan };
    check('M12 a covering standing grant -> plan_card_reask with a run-grant proposal over the plan q_hashes, zero calls (369.2 R02)',
      out.outcome === 'plan_card_reask' && out.reason === 'hash_not_approved'
      && !!prop && prop.lifetime === 'run' && same
      && replay.calls.length === 0 && auditLedger.readAudit(room.roomDir, {}).length === 0
      && !fs.existsSync(path.join(room.roomDir, '.mindrian', 'research-runs', out.run_id, 'run.json')),
      JSON.stringify({ out: out, life: prop && prop.lifetime, same: same, calls: replay.calls.length }));
  }

  // ---- M13 (369.2 R02): once the run grant is approved, run-quick sends exactly those strings
  {
    const room = m12.room;
    const runId = m12.out.run_id;
    const ap = planner.approvePlanReview(room.roomDir, runId, { approvedVia: { surface: 'cli' } });
    const loaded = planner.loadPlan(room.roomDir, runId);
    const replay = replayZero();
    const quickMod = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'quick.cjs'));
    const res = await quickMod.runQuick(room.roomDir, loaded.plan, {
      trigger: 'ambient', budgetMs: BIG_BUDGET, now: NOW, fetchEnvelopeFn: seam(replay),
    });
    const sent = replay.calls.length;
    const want = quickMod.queriesOf(loaded.plan).length;
    let run = null;
    try { run = JSON.parse(fileText(room, path.join('.mindrian', 'research-runs', runId, 'run.json'))); } catch (_e) { run = null; }
    const audit = auditLedger.readAudit(room.roomDir, { run_id: runId });
    check('M13 after approvePlanReview on the card run_id, one quick run sends exactly the card strings, audit written, evidence card returned, unfiled (369.2 R02)',
      ap && ap.ok === true && res && res.status === 'done' && sent >= 1 && sent <= 3 && sent === want
      && audit.length >= 1 && !!run && run.filed === false && !!res.card
      && !fs.existsSync(path.join(room.roomDir, 'research')),
      JSON.stringify({ ap: ap && (ap.ok || ap.reason), st: res && (res.status + ':' + res.reason), sent: sent, want: want, audit: audit.length }));
  }

  // ---- dash guard ------------------------------------------------------------
  {
    const files = [AMBIENT_FILE, path.join(ROOT, 'tests', 'test-363-ambient.cjs')];
    const dirty = files.filter(function (f) {
      try { return hasDash(fs.readFileSync(f, 'utf8')); } catch (_e) { return false; }
    });
    let cardsDirty = false;
    rooms.forEach(function (r) {
      walk(path.join(r.roomDir, '.mindrian', 'research-runs'), []).forEach(function (f) {
        try { if (hasDash(fs.readFileSync(f, 'utf8'))) cardsDirty = true; } catch (_e) { /* ignore */ }
      });
    });
    check('dash guard: no em-dash or en-dash in ambient.cjs, this test, or any written card/run file', dirty.length === 0 && !cardsDirty,
      dirty.join(',') + (cardsDirty ? ' (run files)' : ''));
  }

  check('net guard: zero real fetch attempts', guard.attempts() === 0, 'attempts=' + guard.attempts());
}

main().then(function () {
  rooms.forEach(function (r) { try { r.cleanup(); } catch (_e) { /* ignore */ } });
  try { fs.rmSync(TMP_HOME, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  process.exit(summary());
}).catch(function (e) {
  console.log('FAIL: test crashed: ' + ((e && e.stack) || e));
  rooms.forEach(function (r) { try { r.cleanup(); } catch (_e) { /* ignore */ } });
  process.exit(1);
});
