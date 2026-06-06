'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 143.1-03 -- lib/workflow/dial-close-reach.cjs transaction test.
 * =====================================================================
 * Drives all FOUR closeReach() outcomes against a fixture room.db and asserts
 * the exact typed edges + events written (UI-SPEC Section 8 the four outcomes):
 *
 *   1. sync       -> ONE SELECTED_REACH edge + ONE f_selector_sync_confirmed
 *                    event; NO PIVOTED edge.
 *   2. pivot      -> ONE PIVOTED edge FROM chosen TO declined-recommended with
 *                    ENUM-only props {declined_recommended, margin, decision_id}
 *                    + ONE f_selector_pivot event + ALSO ONE SELECTED_REACH edge.
 *   3. defer/reject -> delegates to recordSelectorDecision; a DEFERRED or
 *                    REJECTED edge lands; NO SELECTED_REACH edge.
 *   4. free-text miss -> delegates to recordSelectorMiss; NO SELECTED_REACH edge,
 *                    NO 4th explicit Free-Text row (AP5).
 *
 * Part 9 write-locality (grep-audit tripwire): dial-close-reach.cjs imports ONLY
 * lib/core/navigation.cjs -- no direct room.db open, no direct navigation
 * submodule require. SELECTED_REACH is system bookkeeping kept DISTINCT from
 * any confirmNode truth-claim promotion.
 *
 * Part 8 ENUM-only PIVOTED props: the PIVOTED edge carries zero freeform
 * user-content fields.
 *
 * Layer-3 (Canon Part 3): every committed reach (outcomes 1+2) also produces a
 * STATE.md Decisions row / TodoWrite next-action -- asserted via the injected
 * recordNextAction seam being invoked.
 *
 * Floor preservation: ALLOWED_EDGE_TYPES still has DEFERRED + REJECTED;
 * EVENT_TYPES still has its baseline; both Sets are still Object.freeze'd.
 *
 * Three-surface compatibility: pure CJS + node:test. Uses fs.mkdtempSync +
 * openRoomDb fixture pattern from the Phase 125-06 selector-decisions suite.
 */

const { test } = require('node:test');
const { ok, equal } = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const CLOSE_REACH_PATH = path.join(REPO_ROOT, 'lib', 'workflow', 'dial-close-reach.cjs');
const EDGES_PATH = path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'edges.cjs');
const EVENTS_PATH = path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'memory-events.cjs');
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const closeReachMod = require(CLOSE_REACH_PATH);
const closeReach = closeReachMod.closeReach;

const SESSION = 'session:dial-close-reach-test';

function freshDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1431-03-close-reach-'));
  const db = openRoomDb(dir);
  return { dir, db };
}

function seedNode(db, id, type) {
  const nowMs = Date.now();
  db.prepare(
    "INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) " +
    "VALUES (?, ?, '{}', 'p1431-03-fixture', 'system', NULL, 'confirmed', ?, ?)"
  ).run(id, type, nowMs, nowMs);
}

// Seed the active focus node + the cmd:/framework: anchors the FK requires.
function seedReachFixture(db, focusId, command, framework, declinedRecommended) {
  seedNode(db, focusId, 'focus_anchor');
  seedNode(db, 'cmd:' + command, 'command');
  seedNode(db, 'framework:' + framework, 'framework');
  if (declinedRecommended) seedNode(db, declinedRecommended, 'command');
  navigation.setFocus(db, SESSION, focusId, 'user');
}

function fetchEdges(db, source, target, type) {
  return db.prepare(
    "SELECT source, target, type, properties FROM edges WHERE source = ? AND target = ? AND type = ?"
  ).all(source, target, type);
}

function countEvents(db, eventType) {
  return db.prepare(
    "SELECT COUNT(*) AS c FROM nodes WHERE type = 'memory_event' AND json_extract(properties, '$.event_type') = ?"
  ).get(eventType).c;
}

function reachFor(command, framework) {
  return {
    command,
    jtbd: 'find-problem',
    framework,
    recommended: true,
    decision_id: 'dec:' + command + ':' + Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Outcome 1 -- resting-detent sync commit.
// ---------------------------------------------------------------------------
test('Outcome 1 (sync): one SELECTED_REACH edge + one f_selector_sync_confirmed event; no PIVOTED', () => {
  const { db } = freshDb();
  const focusId = 'node:problem-formulation';
  seedReachFixture(db, focusId, 'mos:beautiful-question', 'Beautiful Question Framework');
  let nextActionCalls = 0;
  const r = closeReach({
    outcome: 'sync',
    reach: reachFor('mos:beautiful-question', 'Beautiful Question Framework'),
    sessionId: SESSION,
    roomState: { db, investment_level: 0.3 },
    recordNextAction: () => { nextActionCalls += 1; return { ok: true }; },
  });
  ok(r.ok, 'closeReach sync returns ok; got reason=' + (r && r.reason));

  // SELECTED_REACH FROM active focus TO cmd:<command>.
  const sel = fetchEdges(db, focusId, 'cmd:mos:beautiful-question', 'SELECTED_REACH');
  equal(sel.length, 1, 'exactly one SELECTED_REACH edge');
  const props = JSON.parse(sel[0].properties);
  equal(props.jtbd, 'find-problem', 'SELECTED_REACH carries jtbd');
  equal(props.framework, 'Beautiful Question Framework', 'SELECTED_REACH carries framework');
  equal(props.recommended, true, 'SELECTED_REACH carries recommended');
  ok(typeof props.decision_id === 'string' && props.decision_id.length > 0, 'SELECTED_REACH carries decision_id');

  // Positive resting-detent in-sync signal.
  equal(countEvents(db, 'f_selector_sync_confirmed'), 1, 'one f_selector_sync_confirmed event');
  // No PIVOTED edge on a sync.
  const piv = db.prepare("SELECT COUNT(*) AS c FROM edges WHERE type = 'PIVOTED'").get().c;
  equal(piv, 0, 'no PIVOTED edge on a sync commit');
  // No pivot event.
  equal(countEvents(db, 'f_selector_pivot'), 0, 'no f_selector_pivot on a sync commit');
  // Layer-3 next-action invoked.
  equal(nextActionCalls, 1, 'recordNextAction invoked once on a committed reach');
});

// ---------------------------------------------------------------------------
// Outcome 2 -- rotate-to-pivot commit.
// ---------------------------------------------------------------------------
test('Outcome 2 (pivot): PIVOTED edge (ENUM-only props) + f_selector_pivot + SELECTED_REACH', () => {
  const { db } = freshDb();
  const focusId = 'node:problem-formulation';
  const declined = 'cmd:mos:swot';
  seedReachFixture(db, focusId, 'mos:beautiful-question', 'Beautiful Question Framework', declined);
  let nextActionCalls = 0;
  const r = closeReach({
    outcome: 'pivot',
    reach: reachFor('mos:beautiful-question', 'Beautiful Question Framework'),
    declinedRecommended: declined,
    margin: 0.08,
    sessionId: SESSION,
    roomState: { db, investment_level: 0.2 },
    recordNextAction: () => { nextActionCalls += 1; return { ok: true }; },
  });
  ok(r.ok, 'closeReach pivot returns ok; got reason=' + (r && r.reason));

  // PIVOTED edge FROM chosen TO declined-recommended.
  const piv = fetchEdges(db, 'cmd:mos:beautiful-question', declined, 'PIVOTED');
  equal(piv.length, 1, 'exactly one PIVOTED edge from chosen to declined-recommended');
  const pivProps = JSON.parse(piv[0].properties);
  equal(pivProps.declined_recommended, declined, 'PIVOTED carries declined_recommended');
  equal(pivProps.margin, 0.08, 'PIVOTED carries margin');
  ok(typeof pivProps.decision_id === 'string' && pivProps.decision_id.length > 0, 'PIVOTED carries decision_id');

  // ENUM-only: PIVOTED props carry zero freeform user-content fields. The only
  // allowed keys are the three ENUM/scalar fields.
  const allowedKeys = new Set(['declined_recommended', 'margin', 'decision_id']);
  for (const k of Object.keys(pivProps)) {
    ok(allowedKeys.has(k), 'PIVOTED prop key "' + k + '" is ENUM-only (no freeform user content)');
  }

  // The pivot also writes the SELECTED_REACH edge for the chosen reach.
  const sel = fetchEdges(db, focusId, 'cmd:mos:beautiful-question', 'SELECTED_REACH');
  equal(sel.length, 1, 'pivot ALSO writes the SELECTED_REACH edge');

  // f_selector_pivot event lands; no positive sync event.
  equal(countEvents(db, 'f_selector_pivot'), 1, 'one f_selector_pivot event');
  equal(countEvents(db, 'f_selector_sync_confirmed'), 0, 'no sync-confirmed event on a pivot');
  // Layer-3 next-action invoked.
  equal(nextActionCalls, 1, 'recordNextAction invoked once on a pivot commit');
});

test('Outcome 2 (pivot): investment-scaled pivot-penalty is recorded for the ranker', () => {
  const { db } = freshDb();
  const focusId = 'node:pf';
  const declined = 'cmd:mos:swot';
  seedReachFixture(db, focusId, 'mos:beautiful-question', 'Beautiful Question Framework', declined);
  const r = closeReach({
    outcome: 'pivot',
    reach: reachFor('mos:beautiful-question', 'Beautiful Question Framework'),
    declinedRecommended: declined,
    margin: 0.05,
    sessionId: SESSION,
    roomState: { db, investment_level: 0.2 },
    recordNextAction: () => ({ ok: true }),
  });
  ok(r.ok, 'pivot ok');
  // The penalty signal the ranker decay/penalty reader consumes is carried on
  // the f_selector_pivot event payload as an investment-scaled scalar.
  const ev = db.prepare(
    "SELECT properties FROM nodes WHERE type='memory_event' AND json_extract(properties,'$.event_type')='f_selector_pivot' ORDER BY created_at DESC LIMIT 1"
  ).get();
  ok(ev, 'f_selector_pivot event present');
  const p = JSON.parse(ev.properties);
  ok(typeof p.pivot_penalty === 'number' && isFinite(p.pivot_penalty), 'pivot_penalty is a finite number');
  ok(p.pivot_penalty > 0 && p.pivot_penalty <= 1, 'pivot_penalty in (0,1]; got ' + p.pivot_penalty);
  // Investment-scaled: a low investment_level produces a SMALLER penalty so one
  // early pivot does not permanently bury a reach.
  equal(typeof p.investment_level_at_pivot, 'number', 'penalty payload carries investment_level_at_pivot');
});

// ---------------------------------------------------------------------------
// Outcome 3 -- defer / reject delegate to recordSelectorDecision.
// ---------------------------------------------------------------------------
test('Outcome 3 (defer): delegates to recordSelectorDecision; a DEFERRED edge lands; no SELECTED_REACH', () => {
  const { db } = freshDb();
  const focusId = 'node:pf';
  seedReachFixture(db, focusId, 'mos:swot', 'SWOT');
  let nextActionCalls = 0;
  const r = closeReach({
    outcome: 'defer',
    reach: reachFor('mos:swot', 'SWOT'),
    reason: 'not now',
    sessionId: SESSION,
    roomState: { db, investment_level: 0.4 },
    recordNextAction: () => { nextActionCalls += 1; return { ok: true }; },
  });
  ok(r.ok, 'defer ok; got reason=' + (r && r.reason));
  const deferred = db.prepare("SELECT COUNT(*) AS c FROM edges WHERE type = 'DEFERRED'").get().c;
  equal(deferred, 1, 'one DEFERRED edge landed via recordSelectorDecision');
  // No SELECTED_REACH on a defer (not a committed reach).
  const sel = db.prepare("SELECT COUNT(*) AS c FROM edges WHERE type = 'SELECTED_REACH'").get().c;
  equal(sel, 0, 'no SELECTED_REACH edge on a defer');
  // No next-action on a non-committed outcome.
  equal(nextActionCalls, 0, 'recordNextAction NOT invoked on a defer');
});

test('Outcome 3 (reject): delegates to recordSelectorDecision; a REJECTED edge lands', () => {
  const { db } = freshDb();
  const focusId = 'node:pf';
  seedReachFixture(db, focusId, 'mos:swot', 'SWOT');
  const r = closeReach({
    outcome: 'reject',
    reach: reachFor('mos:swot', 'SWOT'),
    reason: 'wrong stage',
    sessionId: SESSION,
    roomState: { db },
    recordNextAction: () => ({ ok: true }),
  });
  ok(r.ok, 'reject ok; got reason=' + (r && r.reason));
  const rejected = db.prepare("SELECT COUNT(*) AS c FROM edges WHERE type = 'REJECTED'").get().c;
  equal(rejected, 1, 'one REJECTED edge landed via recordSelectorDecision');
});

// ---------------------------------------------------------------------------
// Outcome 4 -- free-text / none-fit overflow delegates to recordSelectorMiss.
// ---------------------------------------------------------------------------
test('Outcome 4 (free-text miss): delegates to recordSelectorMiss; no SELECTED_REACH; no 4th row', () => {
  const { db } = freshDb();
  const focusId = 'node:pf';
  seedReachFixture(db, focusId, 'mos:swot', 'SWOT');
  const r = closeReach({
    outcome: 'free-text',
    topKOffered: [{ command: 'mos:swot', score: 0.5 }],
    userIntent: 'I want to interview customers instead',
    sessionId: SESSION,
    roomState: { db, investment_level: 0.1 },
    recordNextAction: () => ({ ok: true }),
  });
  ok(r.ok, 'free-text miss ok; got reason=' + (r && r.reason));
  // The miss writes a f_selector_miss event, NO cascade edge.
  equal(countEvents(db, 'f_selector_miss'), 1, 'one f_selector_miss event via recordSelectorMiss');
  const sel = db.prepare("SELECT COUNT(*) AS c FROM edges WHERE type = 'SELECTED_REACH'").get().c;
  equal(sel, 0, 'no SELECTED_REACH edge on a free-text miss');
  // No 4th explicit Free-Text row: closeReach never writes a fourth option-row
  // edge; the miss is temporal-only.
  const anyEdge = db.prepare("SELECT COUNT(*) AS c FROM edges").get().c;
  equal(anyEdge, 0, 'free-text miss writes NO cascade edge (AP5; no 4th row)');
});

// ---------------------------------------------------------------------------
// Part 9 carve-out: SELECTED_REACH is system bookkeeping, kept DISTINCT from
// any confirmNode truth-claim promotion.
// ---------------------------------------------------------------------------
test('SELECTED_REACH is system bookkeeping -- distinct from confirmNode truth-claim promotion', () => {
  const src = fs.readFileSync(CLOSE_REACH_PATH, 'utf8');
  // closeReach writes SELECTED_REACH via writeEdge (bookkeeping). It does NOT
  // fold a truth-claim promotion into the SELECTED_REACH write -- confirmNode (if
  // used at all) stays a separate call. The grep-audit asserts closeReach does
  // not silently promote a truth-claim as part of the SELECTED_REACH edge write.
  ok(src.indexOf('SELECTED_REACH') !== -1, 'closeReach references SELECTED_REACH');
  // If confirmNode is referenced, it must be commented as the DISTINCT path, not
  // wired into the SELECTED_REACH writeEdge call. We assert the SELECTED_REACH
  // edge_type write and confirmNode are not on the same statement.
  const selLine = src.split('\n').find((l) => l.indexOf("'SELECTED_REACH'") !== -1 || l.indexOf('"SELECTED_REACH"') !== -1);
  if (selLine) {
    ok(selLine.indexOf('confirmNode') === -1, 'SELECTED_REACH write does not call confirmNode on the same line');
  }
});

// ---------------------------------------------------------------------------
// Write locality (Part 9, AP6): dial-close-reach.cjs imports ONLY
// lib/core/navigation.cjs -- no room.db open, no direct submodule require.
// ---------------------------------------------------------------------------
test('Write locality grep-audit: only navigation.cjs imported (no room.db, no submodule require)', () => {
  const src = fs.readFileSync(CLOSE_REACH_PATH, 'utf8');
  ok(/require\(['"]\.\.\/core\/navigation\.cjs['"]\)/.test(src),
    "must require('../core/navigation.cjs')");
  // Reuse the shipped recorders.
  ok(/recordSelectorDecision|recordSelectorMiss/.test(src),
    'must reuse selector-decisions recorders for outcomes 3 + 4');
  // No direct room.db open.
  ok(!/require\([^)]*room-db/.test(src),
    'must NOT require room-db.cjs directly (Part 9 chokepoint invariant)');
  ok(!/openRoomDb\b/.test(src),
    'must NOT open room.db directly');
  // No direct internal navigation submodule require.
  ok(!/require\([^)]*navigation\/(edges|memory-events|focus|confirm-node)/.test(src),
    'must NOT require a navigation submodule directly; route via navigation.cjs');
  ok(!/require\(['"]better-sqlite3['"]\)/.test(src), 'no better-sqlite3 require');
  ok(!/require\(['"]node:sqlite['"]\)/.test(src), 'no node:sqlite require');
});

// ---------------------------------------------------------------------------
// Floor preservation: the registries keep their baselines and stay frozen.
// ---------------------------------------------------------------------------
test('Floor preservation: ALLOWED_EDGE_TYPES + EVENT_TYPES baselines intact and frozen', () => {
  const { ALLOWED_EDGE_TYPES } = require(EDGES_PATH);
  const { EVENT_TYPES } = require(EVENTS_PATH);
  // New members present.
  ok(ALLOWED_EDGE_TYPES.has('PIVOTED'), 'PIVOTED present');
  ok(ALLOWED_EDGE_TYPES.has('SELECTED_REACH'), 'SELECTED_REACH present');
  ok(EVENT_TYPES.has('f_selector_pivot'), 'f_selector_pivot present');
  ok(EVENT_TYPES.has('f_selector_sync_confirmed'), 'f_selector_sync_confirmed present');
  // Floor preserved.
  ok(ALLOWED_EDGE_TYPES.has('DEFERRED'), 'DEFERRED floor preserved');
  ok(ALLOWED_EDGE_TYPES.has('REJECTED'), 'REJECTED floor preserved');
  ok(EVENT_TYPES.has('f_selector_decision'), 'f_selector_decision floor preserved');
  ok(EVENT_TYPES.has('f_selector_miss'), 'f_selector_miss floor preserved');
  // Still frozen.
  ok(Object.isFrozen(ALLOWED_EDGE_TYPES), 'ALLOWED_EDGE_TYPES still frozen');
  ok(Object.isFrozen(EVENT_TYPES), 'EVENT_TYPES still frozen');
});
