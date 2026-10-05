'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 365 Plan 10 -- the ambient research runner stops before any request when
 * the room's never-do list names what the run was about to do (D-12, D-13, D-14,
 * D-26). Legs A1..A11, offline: the net guard counts every real fetch, a
 * fetchEnvelopeFn spy counts every injected one, and both must stay at zero on
 * every halt leg.
 *
 * No em-dash or en-dash literals: those characters are spelled with
 * String.fromCharCode.
 *
 * Exit 0 pass, 1 fail, 77 skip (fixtures absent).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos365-never-do-ambient-home-'));
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
const { check, summary } = hygiene.makeChecker('365-10 ambient never-do halt');

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

const corpus = require(path.join(ROOT, 'lib', 'core', 'research-corpus.cjs'));
const grants = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'grants.cjs'));
const planner = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'planner.cjs'));
const roomConstraints = require(path.join(ROOT, 'lib', 'core', 'room-constraints.cjs'));
const AMBIENT_FILE = path.join(ROOT, 'lib', 'core', 'research-planner', 'ambient.cjs');
const AMBIENT = require(AMBIENT_FILE);
const quickMod = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'quick.cjs'));

const NOW = Date.parse('2026-09-30T10:00:00Z');
const BIG_BUDGET = 4 * 60 * 1000;
const FLOOR = roomConstraints.FLOOR_SENTENCE;

const rooms = [];
function newRoom() {
  const r = buildRoom363({ role: 'researcher' });
  rooms.push(r);
  return r;
}

function standingGrant(room) {
  const proposal = grants.buildStandingProposal(room.roomDir, { terms: [{ term: GAP_TERM_363, synonyms: [] }] });
  const w = grants.writeGrant(room.roomDir, proposal, { approved_via: { surface: 'cli', decision_node_id: 'd-365-10-test' } });
  if (!w.ok) throw new Error('grant failed: ' + JSON.stringify(w));
  return w.grant;
}

// 369.2-10 (R02, ruling 2026-10-05, A5): a standing grant never sends a web string. The room below
// keeps its standing grant (the room a navigator really has), but a room-started pass over it queues
// the run card and sends nothing; the room "would fetch" only after the navigator approves THAT run.
// approveAndRun is that approval (approvePlanReview, the CLI review approve path) plus run-quick.
async function approveAndRun(room, runId, spy) {
  const ap = planner.approvePlanReview(room.roomDir, runId, { approvedVia: { surface: 'cli' } });
  const loaded = planner.loadPlan(room.roomDir, runId);
  if (!(ap && ap.ok === true && loaded.ok)) return { ap: ap, res: null };
  const res = await quickMod.runQuick(room.roomDir, loaded.plan, { budgetMs: BIG_BUDGET, now: NOW, fetchEnvelopeFn: spy.fn });
  return { ap: ap, res: res };
}

// A room that would fetch once its run is approved: a standing grant plus the run card below.
function fetchingRoom() {
  const r = newRoom();
  standingGrant(r);
  return r;
}

function writeNeverDo(room, entries) {
  const full = entries.map(function (e) {
    return {
      kind: e.kind,
      value: e.value,
      why: e.why || 'The navigator ruled this out of unattended work.',
      approved_via: { surface: 'cli', decision_node_id: 'd-365-10-never' },
      approved_at: '2026-09-30T09:00:00.000Z',
    };
  });
  fs.mkdirSync(path.join(room.roomDir, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(room.roomDir, '.mindrian', 'never-do.json'),
    JSON.stringify({ schema: roomConstraints.SCHEMA, entries: full }, null, 2), 'utf8');
}

function routeZero() { return 'gap_primary_zero'; }

// A fetchEnvelopeFn spy: counts calls, answers from replay when a call is allowed.
function spyFetch() {
  const replay = makeReplayFetch({ route: routeZero, bodies: BODIES });
  const spy = {
    calls: 0,
    fn: async function (args) {
      spy.calls += 1;
      const prev = globalThis.fetch;
      globalThis.fetch = replay;
      try {
        return await corpus.fetchCorpusEnvelope(args);
      } finally {
        globalThis.fetch = prev;
      }
    },
  };
  return spy;
}

function compWithWhitespace() {
  return {
    producers: { whitespace: { outcome: 'no_candidate', posture: 'run' } },
    tier_counts: { strong: 0, indirect: 0, unverified: 0 },
    card: null,
    surfaced_via: 'none',
  };
}

function optsFor(spy, extra) {
  return Object.assign({
    budgetMs: BIG_BUDGET,
    now: NOW,
    deltaHash: 'a'.repeat(64),
    deps: { fetchEnvelopeFn: spy.fn },
  }, extra || {});
}

function runLedgerRuns(room) {
  return grants.readRunLedger(room.roomDir, {}).runs;
}

function readTrips(room) {
  const f = path.join(room.roomDir, '.mindrian', 'constraint-trips.jsonl');
  try {
    return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(function (l) { return JSON.parse(l); });
  } catch (_e) {
    return [];
  }
}

function readCard(room, runId) {
  try {
    return JSON.parse(fs.readFileSync(path.join(room.roomDir, '.mindrian', 'research-runs', runId, 'card.json'), 'utf8'));
  } catch (_e) {
    return null;
  }
}

function runDirFile(room, runId, name) {
  return fs.existsSync(path.join(room.roomDir, '.mindrian', 'research-runs', runId, name));
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

function hasDash(text) { return text.indexOf(EM) !== -1 || text.indexOf(EN) !== -1; }

async function main() {
  // ---- A1 ------------------------------------------------------------------
  {
    const earlier = ['skipped_no_whitespace', 'context_insufficient', 'plan_card_no_grant', 'plan_card_reask',
      'throttled', 'already_run_for_delta', 'ran', 'budget_exhausted', 'error'];
    const o = AMBIENT.AMBIENT_OUTCOMES;
    // Append-only list: halted_constraint is appended right after the nine earlier outcomes.
    // Later phases may append after it (366-07 appended plan_card_eureka_offer), so pin the
    // prefix and the position, never the list length or the last slot.
    check('A1 AMBIENT_OUTCOMES keeps every earlier outcome in order and appends halted_constraint right after them',
      earlier.every(function (n, i) { return o[i] === n; })
      && o[earlier.length] === 'halted_constraint', JSON.stringify(o));
  }

  // ---- A2 ------------------------------------------------------------------
  let haltRoom = null;
  let haltOut = null;
  {
    const room = fetchingRoom();
    haltRoom = room;
    // control: without a never-do list this room WOULD fetch
    const control = fetchingRoom();
    const cSpy = spyFetch();
    const cOut = await AMBIENT.maybeQuick(control.roomDir, compWithWhitespace(), optsFor(cSpy));
    const cRun = cOut.run_id ? await approveAndRun(control, cOut.run_id, cSpy) : null;

    writeNeverDo(room, [{ kind: 'term', value: GAP_TERM_363.toUpperCase(), why: 'This zone is under an embargo the room agreed to.' }]);
    const spy = spyFetch();
    const before = runLedgerRuns(room).length;
    const out = await AMBIENT.maybeQuick(room.roomDir, compWithWhitespace(), optsFor(spy));
    haltOut = out;
    check('A2 a standing grant plus a never-do term -> halted_constraint / constraint_named, zero fetches, no run recorded (control: plan_card_reask, then its approved run sends)',
      cOut.outcome === 'plan_card_reask' && !!cRun && !!cRun.res && cRun.res.status === 'done' && cSpy.calls >= 1
      && out.outcome === 'halted_constraint' && out.reason === 'constraint_named' && /^rp-/.test(out.run_id || '')
      && spy.calls === 0 && guard.attempts() === 0 && runLedgerRuns(room).length === before,
      JSON.stringify({ control: cOut.outcome, run: cRun && cRun.res && cRun.res.status, out: out, calls: spy.calls, attempts: guard.attempts() }));
  }

  // ---- A3 ------------------------------------------------------------------
  {
    const cases = [
      { kind: 'command', value: '/mos:whitespace' },
      { kind: 'section', value: 'problem-definition' },
      { kind: 'provider', value: 'openalex' },
    ];
    const results = [];
    for (let i = 0; i < cases.length; i += 1) {
      const room = fetchingRoom();
      writeNeverDo(room, [cases[i]]);
      const spy = spyFetch();
      const out = await AMBIENT.maybeQuick(room.roomDir, compWithWhitespace(), optsFor(spy));
      const trips = readTrips(room);
      results.push({
        c: cases[i].kind,
        ok: out.outcome === 'halted_constraint' && out.reason === 'constraint_named' && spy.calls === 0
          && trips.length === 1 && trips[0].kind === cases[i].kind && trips[0].value === cases[i].value,
        out: out.outcome,
      });
    }
    check('A3 a command, a return section and a provider entry each halt (zero fetches, trip names the entry)',
      results.every(function (r) { return r.ok; }), JSON.stringify(results));
  }

  // ---- A4 ------------------------------------------------------------------
  let malformedRoom = null;
  let malformedOut = null;
  {
    const room = fetchingRoom();
    malformedRoom = room;
    fs.mkdirSync(path.join(room.roomDir, '.mindrian'), { recursive: true });
    fs.writeFileSync(path.join(room.roomDir, '.mindrian', 'never-do.json'), '{ not json', 'utf8');
    const spy = spyFetch();
    const before = runLedgerRuns(room).length;
    const out = await AMBIENT.maybeQuick(room.roomDir, compWithWhitespace(), optsFor(spy));
    malformedOut = out;
    check('A4 a malformed never-do.json -> halted_constraint / constraints_malformed, zero fetches, no run recorded',
      out.outcome === 'halted_constraint' && out.reason === 'constraints_malformed'
      && spy.calls === 0 && guard.attempts() === 0 && runLedgerRuns(room).length === before,
      JSON.stringify(out));
  }

  // ---- A5 ------------------------------------------------------------------
  {
    const runId = haltOut.run_id;
    const card = readCard(haltRoom, runId);
    const pending = planner.pendingCards(haltRoom.roomDir);
    const hit = pending.filter(function (p) { return p.run_id === runId; })[0];
    const why = 'This zone is under an embargo the room agreed to.';
    const wantHeader = "A room-started research run stopped before any request. This room's never-do list names term "
      + GAP_TERM_363.toUpperCase() + '. Why: ' + why + ' Nothing ran and nothing left this machine. ' + FLOOR;
    const opts = card && card.options;
    const optsOk = Array.isArray(opts) && opts.length === 3
      && opts[0].id === 'approve' && opts[0].label === 'Run it now, attended'
      && opts[1].id === 'reject' && opts[1].label === 'Leave it stopped'
      && opts[2].id === 'defer' && opts[2].label === 'Decide later';
    const p = card && card.payload;
    check('A5a halt run dir keeps plan.json and card.json; card is a gate card with the whole why in a capped header',
      runDirFile(haltRoom, runId, 'plan.json') && runDirFile(haltRoom, runId, 'card.json')
      && !!card && card.kind === 'general' && card.header === wantHeader && card.header.length <= 400
      && card.notice === card.header && optsOk
      && !!p && p.ambient === true && p.halted_constraint === true && p.run_id === runId
      && p.constraint && p.constraint.kind === 'term' && p.constraint.value === GAP_TERM_363.toUpperCase(),
      JSON.stringify(card));
    check('A5b planner.pendingCards returns the card with kind halted_constraint',
      !!hit && hit.kind === 'halted_constraint' && !!hit.card && hit.card.kind === 'general',
      JSON.stringify(pending.map(function (x) { return [x.run_id, x.kind]; })));

    const mCard = readCard(malformedRoom, malformedOut.run_id);
    const wantMal = "A room-started research run stopped before any request, because this room's never-do list could not be read (.mindrian/never-do.json). Nothing ran and nothing left this machine. " + FLOOR;
    check('A5c a malformed list gets the unreadable-list header (floor sentence kept), constraint null',
      !!mCard && mCard.header === wantMal && mCard.header.length <= 400 && mCard.notice === wantMal
      && mCard.payload.constraint.kind === null && mCard.payload.constraint.value === null,
      JSON.stringify(mCard && mCard.header));

    // a long why is trimmed and the floor sentence survives whole
    const long = fetchingRoom();
    writeNeverDo(long, [{ kind: 'term', value: GAP_TERM_363, why: 'x'.repeat(290) }]);
    const lo = await AMBIENT.maybeQuick(long.roomDir, compWithWhitespace(), optsFor(spyFetch()));
    const lCard = readCard(long, lo.run_id);
    check('A5d a long why is trimmed to keep the header at 400 characters with the floor sentence whole',
      !!lCard && lCard.header.length <= 400 && lCard.header.slice(-FLOOR.length) === FLOOR
      && lCard.header.indexOf('...') !== -1, JSON.stringify(lCard && lCard.header.length));
  }

  // ---- A6 ------------------------------------------------------------------
  {
    const spy = spyFetch();
    const again = await AMBIENT.maybeQuick(haltRoom.roomDir, compWithWhitespace(), optsFor(spy, { deltaHash: 'b'.repeat(64) }));
    const halts = planner.pendingCards(haltRoom.roomDir).filter(function (p) { return p.kind === 'halted_constraint'; });
    const dirs = fs.readdirSync(path.join(haltRoom.roomDir, '.mindrian', 'research-runs'));
    check('A6 a second pass while the card is unsurfaced -> halted_constraint deduped, one card, no extra run dir, zero fetches',
      again.outcome === 'halted_constraint' && again.deduped === true && again.run_id === haltOut.run_id
      && halts.length === 1 && dirs.length === 1 && spy.calls === 0,
      JSON.stringify({ again: again, halts: halts.length, dirs: dirs.length }));
  }

  // ---- A7 ------------------------------------------------------------------
  {
    const trips = readTrips(haltRoom);
    const t = trips[0];
    const raw = fs.readFileSync(path.join(haltRoom.roomDir, '.mindrian', 'constraint-trips.jsonl'), 'utf8');
    check('A7 a trip line per halt: surface ambient, reason, kind, value, step_command, run_id, and no why',
      trips.length === 2 && !!t && t.surface === 'ambient' && t.reason === 'constraint_named' && t.kind === 'term'
      && t.value === GAP_TERM_363.toUpperCase() && t.step_command === '/mos:whitespace' && t.run_id === haltOut.run_id
      && !Object.prototype.hasOwnProperty.call(t, 'why') && raw.indexOf('embargo') === -1,
      JSON.stringify(trips));
  }

  // ---- A8 ------------------------------------------------------------------
  {
    const withGrant = fetchingRoom();
    const spy1 = spyFetch();
    const a = await AMBIENT.maybeQuick(withGrant.roomDir, compWithWhitespace(), optsFor(spy1));
    const aRun = a.run_id ? await approveAndRun(withGrant, a.run_id, spy1) : null;
    const noGrant = newRoom();
    const spy2 = spyFetch();
    const b = await AMBIENT.maybeQuick(noGrant.roomDir, compWithWhitespace(), optsFor(spy2));
    // a never-do list that names something else changes nothing
    const other = fetchingRoom();
    writeNeverDo(other, [{ kind: 'term', value: 'something unrelated entirely' }, { kind: 'provider', value: 'crossref' }]);
    const spy3 = spyFetch();
    const c = await AMBIENT.maybeQuick(other.roomDir, compWithWhitespace(), optsFor(spy3));
    const cRun = c.run_id ? await approveAndRun(other, c.run_id, spy3) : null;
    check('A8 no never-do file -> plan_card_reask under a standing grant (its approved run sends), plan_card_no_grant without; a non-matching list changes nothing',
      a.outcome === 'plan_card_reask' && !!aRun && !!aRun.res && aRun.res.status === 'done' && spy1.calls >= 1
      && b.outcome === 'plan_card_no_grant' && spy2.calls === 0
      && c.outcome === 'plan_card_reask' && !!cRun && !!cRun.res && cRun.res.status === 'done' && spy3.calls >= 1
      && readTrips(withGrant).length === 0 && readTrips(other).length === 0,
      JSON.stringify([a.outcome, b.outcome, c.outcome]));
  }

  // ---- A9 / A9b / A10 / A11 (D-14, D-26: every halt carries a proposal) --------
  {
    const wantProposal = { kind: 'term', value: GAP_TERM_363 };

    // A9: a plan-only card (no grant)
    const room = newRoom();
    const out = await AMBIENT.maybeQuick(room.roomDir, compWithWhitespace(), optsFor(spyFetch()));
    const card = readCard(room, out.run_id);
    const pr = card && card.payload && card.payload.never_do_proposal;
    const altKinds = pr && Array.isArray(pr.alternatives) ? pr.alternatives.map(function (a) { return a.kind; }) : null;
    check('A9 a no-grant plan-only card carries never_do_proposal: kind term, the zone term, at most 2 alternatives from other fields',
      out.outcome === 'plan_card_no_grant' && !!pr && pr.kind === wantProposal.kind && pr.value === wantProposal.value
      && typeof pr.why === 'string' && pr.why.length > 0 && !!altKinds && altKinds.length <= 2
      && altKinds.every(function (k) { return ['section', 'provider', 'command'].indexOf(k) !== -1; })
      && altKinds.indexOf('section') !== -1,
      JSON.stringify(pr));

    // A9b: the halted_constraint card carries it too
    const hcard = readCard(haltRoom, haltOut.run_id);
    const hp = hcard && hcard.payload && hcard.payload.never_do_proposal;
    check('A9b the halted_constraint card.json also carries a never_do_proposal built from the same fields',
      !!hp && hp.kind === 'term' && hp.value === GAP_TERM_363 && Array.isArray(hp.alternatives)
      && hp.alternatives.length <= 2, JSON.stringify(hp));

    // A10: the re-ask call site (runQuick returns reask after a covering cover check)
    // 369.2-10 (R02, ruling 2026-10-05, A5): under a standing grant coverFor no longer covers, so the pass
    // reaches the call site only when coverFor says covered; both are stubbed to keep the call site pinned
    // (a run card answered by a re-ask, e.g. a plan edited between the cover check and the run).
    const room10 = fetchingRoom();
    const origRun = quickMod.runQuick;
    const origCover = quickMod.coverFor;
    let reaskOut = null;
    let runCalls = 0;
    quickMod.coverFor = function () { return { covered: true }; };
    quickMod.runQuick = async function (roomDir, plan) {
      runCalls += 1;
      const rk = quickMod.reaskCard(roomDir, plan, null, 'hash_not_approved', NOW);
      return { status: 'reask', reason: 'hash_not_approved', card: rk.card, proposal: rk.proposal, new_terms: rk.new_terms };
    };
    try {
      reaskOut = await AMBIENT.maybeQuick(room10.roomDir, compWithWhitespace(), optsFor(spyFetch()));
    } finally {
      quickMod.runQuick = origRun;
      quickMod.coverFor = origCover;
    }
    const rcard = reaskOut && reaskOut.run_id ? readCard(room10, reaskOut.run_id) : null;
    const rp = rcard && rcard.payload && rcard.payload.never_do_proposal;
    check('A10 a re-ask plan-only card (runQuick reask) carries the same proposal',
      runCalls === 1 && !!reaskOut && reaskOut.outcome === 'plan_card_reask' && !!rp
      && rp.kind === 'term' && rp.value === GAP_TERM_363 && rcard.payload.reask_reason === 'hash_not_approved'
      && rcard.payload.plan_only === true && rcard.payload.ambient === true,
      JSON.stringify({ o: reaskOut, rp: rp }));

    // A11: every other payload key and proposal.json are unchanged
    const without = Object.assign({}, card.payload);
    delete without.never_do_proposal;
    // 369.2-10 (R02, ruling 2026-10-05): the run card (plan 09) adds families, job, queries and template_ids to
    // the payload; ambient, plan_only, run_id, reask_reason and the grant fields stay, and grant_lifetime reads 'run'.
    const expectKeys = ['ambient', 'families', 'grant_lifetime', 'job', 'new_terms', 'plan_only', 'policy_version', 'queries', 'reask_reason', 'run_id', 'template_ids'];
    const planDir = path.join(room.roomDir, '.mindrian', 'research-runs', out.run_id);
    let propJson = null;
    try { propJson = JSON.parse(fs.readFileSync(path.join(planDir, 'proposal.json'), 'utf8')); } catch (_e) { propJson = null; }
    const baseCard = quickMod.reaskCard(room.roomDir, planner.loadPlan(room.roomDir, out.run_id).plan, null, 'no_grant', NOW).card;
    check('A11 plan-only payload keys (ambient, plan_only, run_id, reask_reason, grant fields) and proposal.json are unchanged',
      JSON.stringify(Object.keys(without).sort()) === JSON.stringify(expectKeys)
      && without.ambient === true && without.plan_only === true && without.run_id === out.run_id
      && without.reask_reason === 'no_grant' && without.grant_lifetime === 'run'
      && Object.keys(card).filter(function (k) { return k !== 'payload'; }).sort().join() === Object.keys(baseCard).filter(function (k) { return k !== 'payload'; }).sort().join()
      && !!propJson && Object.keys(propJson).sort().join() === 'new_terms,proposal',
      JSON.stringify({ keys: Object.keys(without).sort(), prop: propJson && Object.keys(propJson) }));
  }

  // ---- source order (T-365-07): the check sits before coverFor and recordRun --
  {
    const src = fs.readFileSync(AMBIENT_FILE, 'utf8');
    const iCheck = src.indexOf('roomConstraints.checkStep(');
    const iCover = src.indexOf('quickMod.coverFor(');
    const iRec = src.indexOf('grants.recordRun(');
    const iRun = src.indexOf('quickMod.runQuick(');
    check('order: checkStep sits before coverFor, grants.recordRun and runQuick',
      iCheck > 0 && iCheck < iCover && iCheck < iRec && iCheck < iRun);
  }

  // ---- dash guard ------------------------------------------------------------
  {
    const files = [AMBIENT_FILE, path.join(ROOT, 'tests', 'test-365-never-do-ambient.cjs')];
    const dirty = files.filter(function (f) {
      try { return hasDash(fs.readFileSync(f, 'utf8')); } catch (_e) { return false; }
    });
    let runFilesDirty = false;
    rooms.forEach(function (r) {
      walk(path.join(r.roomDir, '.mindrian'), []).forEach(function (f) {
        try { if (hasDash(fs.readFileSync(f, 'utf8'))) runFilesDirty = true; } catch (_e) { /* ignore */ }
      });
    });
    check('dash guard: no em-dash or en-dash in ambient.cjs, this test, or any written card or trip file',
      dirty.length === 0 && !runFilesDirty, dirty.join(',') + (runFilesDirty ? ' (room files)' : ''));
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
