#!/usr/bin/env node
'use strict';
/*
 * tests/test-365-floor-gate.cjs -- Phase 365 Plan 08 (V365-03, V365-04, V365-06,
 * V365-07, V365-08, V365-16, V365-18; D-01, D-04, D-05, D-06, D-07, D-20, D-21,
 * D-22, D-24).
 *
 * Integration proof that the approval floor is live at the human gate:
 *
 *   G1..G9  floor enforcement and the audit event in _promoteCardSubject
 *           (lib/mcp/tools/gate.cjs): a claim subject below the room floor lands
 *           needs_evidence, a held claim stays held or is released through the
 *           unchanged confirmNode, opportunity subjects are untouched, card
 *           evidence ids never satisfy the floor, and every claim approve
 *           writes exactly one approval_floor_checked memory_event.
 *   H1,H2,H4 the gate_render handler composes the why-line (kind general, claim
 *           subject only), the relabelled approve reaches all rungs, and the
 *           render-time prediction rides the ledger so a standing that moved
 *           before the click is reported as floor_changed_since_render.
 *   H6a,H7  the one flagged describe string keeps the zod4 contract check (a)
 *           green, and the floor acceptance test names only the meeting leg.
 *
 * Every verdict is read back through a FRESH room.db handle, never from the
 * tool response alone. Plain Node, node:assert/strict, hygiene-355 first.
 * Hyphens only; the two dash characters are never written literally here.
 */

process.env.MINDRIAN_MCP_FIRST = 'all';
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

try {
  require('node:sqlite');
} catch (_e) {
  process.stdout.write('SKIP test-365-floor-gate.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const fx = require('./helpers/fixture-room-365.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const { registerRouterTools } = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tool-router.cjs'));
const gateTool = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'gate.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

const checker = hygiene.makeChecker('test-365-floor-gate');
const { check } = checker;

function textOf(raw) {
  return (raw && raw.content && raw.content[0] && raw.content[0].text) || '';
}
function jsonOf(raw) {
  try { return JSON.parse(textOf(raw)); } catch (_e) { return null; }
}

const OPTIONS = [
  { id: 'approve', label: 'Approve' },
  { id: 'reject', label: 'Reject' },
  { id: 'defer', label: 'Defer' },
];

let sessionCounter = 0;
function nextSession(label) {
  sessionCounter += 1;
  return 'test-365-floor-gate-' + label + '-' + sessionCounter;
}

// A headless (rung c) harness: gate tools plus the router tools on one room.
function makeHarness(label, surface) {
  const room = fx.makeRoom365(label);
  const { server, handlers } = fx.captureToolServer();
  registerRouterTools(server, room.room, REPO_ROOT, { full: '' }, 'cli');
  gateTool.register(server, { fallbackRoomDir: room.room, pluginRoot: REPO_ROOT, surface: surface || 'headless-365' });
  return { room, handlers };
}

async function renderCard(h, subjectId, opts) {
  const o = opts || {};
  const extra = { sessionId: o.sessionId || nextSession('r') };
  const args = {
    header: o.header || 'Confirm the claim',
    kind: o.kind || 'general',
    select_mode: 'single',
    options: OPTIONS,
    subject_node_id: subjectId,
  };
  if (Array.isArray(o.evidence)) args.evidence_node_ids = o.evidence;
  const raw = await h.handlers.get('gate_render')(args, extra);
  const json = jsonOf(raw);
  return { raw, json, text: textOf(raw), extra, gateId: json && json.gate_id };
}

async function answer(h, card, verdict, chosen) {
  const raw = await h.handlers.get('gate_answer')(
    { gate_id: card.gateId, chosen: [chosen || verdict], verdict: verdict }, card.extra);
  return { raw, json: jsonOf(raw) };
}

// render then approve in one go
async function approve(h, subjectId, opts) {
  const card = await renderCard(h, subjectId, opts);
  const res = await answer(h, card, 'approve');
  return { card, json: res.json };
}

function floorEvents(roomDir, targetId) {
  const db = openRoomDb(roomDir);
  try {
    const rows = db.prepare(
      "SELECT properties FROM nodes WHERE type = 'memory_event' " +
      "AND json_extract(properties, '$.event_type') = 'approval_floor_checked' ORDER BY created_at, rowid"
    ).all();
    const all = rows.map((r) => JSON.parse(r.properties || '{}'));
    return targetId ? all.filter((e) => e.target_node_id === targetId) : all;
  } finally {
    closeRoomDb(db);
  }
}

function readNodeRow(roomDir, id) {
  const db = openRoomDb(roomDir);
  try {
    return db.prepare('SELECT id, type, review_status, properties FROM nodes WHERE id = ?').get(id);
  } finally {
    closeRoomDb(db);
  }
}

function withDb(roomDir, fn) {
  const db = openRoomDb(roomDir);
  try { return fn(db); } finally { closeRoomDb(db); }
}

const EVENT_KEYS = new Set([
  'target_node_id', 'floor_id', 'floor_source', 'standing', 'floor_met',
  'from_status', 'landed_status', 'declared_max_rung', 'created_by', 'event_type',
]);

function eventIsClean(ev) {
  return Object.keys(ev).every((k) => EVENT_KEYS.has(k))
    && Object.values(ev).every((v) => typeof v !== 'string' || v.length <= 120);
}

// -------------------------------------------------------------------
async function g1toG3andG8G9() {
  process.stdout.write('\n-- G1, G2, G3, G8, G9: default floor, ask-only claim, then a source edge --\n');
  const h = makeHarness('g1');
  try {
    const claim = withDb(h.room.room, (db) => {
      const id = fx.seedClaim(db, { text: 'G1 claim: only a model was asked.', variant: 'g1' });
      fx.recordAsk(db, id, { rung: 2 });
      return id;
    });

    const first = await approve(h, claim, { header: 'Floor decision header G1' });
    const rn = first.json && first.json.reasoning_node;
    check('G1 gate_answer ok', !!first.json && first.json.ok === true, JSON.stringify(first.json));
    check('G1 fresh handle reads needs_evidence', fx.readStatus(h.room.room, claim) === 'needs_evidence');
    check('G1 subject_confirmed false', !!rn && rn.subject_confirmed === false, JSON.stringify(rn));
    check('G1 subject_held true', !!rn && rn.subject_held === true, JSON.stringify(rn));
    check('G1 subject_skip_reason below_floor', !!rn && rn.subject_skip_reason === 'below_floor', JSON.stringify(rn));
    check('G1 landed_status needs_evidence', !!rn && rn.landed_status === 'needs_evidence', JSON.stringify(rn));

    const ev1 = floorEvents(h.room.room, claim);
    check('G2 exactly one approval_floor_checked event', ev1.length === 1, 'n=' + ev1.length);
    const e = ev1[0] || {};
    check('G2 event payload fields', e.target_node_id === claim && e.floor_id === 'secondary_document'
      && e.floor_source === 'default' && e.standing === 'model_only' && e.floor_met === false
      && e.from_status === 'proposed' && e.landed_status === 'needs_evidence' && e.created_by === 'system'
      && e.declared_max_rung === 2, JSON.stringify(e));
    check('G2 payload keys are a subset and no value is long', eventIsClean(e), JSON.stringify(e));

    const decisionId = 'decision:gate:' + first.card.gateId;
    const dec = readNodeRow(h.room.room, decisionId);
    const decProps = dec ? JSON.parse(dec.properties || '{}') : {};
    check('G9 decision node text equals the card header', !!dec && decProps.text === 'Floor decision header G1',
      JSON.stringify(decProps));
    check('G9 decision node is confirmed', !!dec && dec.review_status === 'confirmed', JSON.stringify(dec));

    // G8: approved again while still below floor -> stays held
    const again = await approve(h, claim);
    const rn2 = again.json && again.json.reasoning_node;
    check('G8 still below floor stays needs_evidence', fx.readStatus(h.room.room, claim) === 'needs_evidence');
    check('G8 subject_skip_reason below_floor_still_held', !!rn2 && rn2.subject_skip_reason === 'below_floor_still_held',
      JSON.stringify(rn2));
    const ev2 = floorEvents(h.room.room, claim);
    check('G8 one more event', ev2.length === 2, 'n=' + ev2.length);
    check('G8 second event from_status needs_evidence', !!ev2[1] && ev2[1].from_status === 'needs_evidence'
      && ev2[1].landed_status === 'needs_evidence', JSON.stringify(ev2[1]));

    // G3: add a source edge and approve a new card for the same subject -> confirmed
    withDb(h.room.room, (db) => {
      fx.addSourceEdge(db, claim, { url: 'https://example.org/g3', retrieved_at: '2026-09-30', variant: 'g3' });
    });
    const third = await approve(h, claim);
    const rn3 = third.json && third.json.reasoning_node;
    check('G3 released claim reads confirmed', fx.readStatus(h.room.room, claim) === 'confirmed');
    check('G3 subject_confirmed true', !!rn3 && rn3.subject_confirmed === true && rn3.subject_skip_reason === null,
      JSON.stringify(rn3));
    const ev3 = floorEvents(h.room.room, claim);
    const last = ev3[ev3.length - 1] || {};
    check('G3 event says floor_met true from needs_evidence', last.floor_met === true
      && last.from_status === 'needs_evidence' && last.landed_status === 'confirmed' && last.standing === 'source_edge',
      JSON.stringify(last));
  } finally {
    h.room.cleanup();
  }
}

async function g4() {
  process.stdout.write('\n-- G4: a hand edit lowers the floor, the held claim is released --\n');
  const h = makeHarness('g4');
  try {
    const claim = withDb(h.room.room, (db) => fx.seedClaim(db, { text: 'G4 claim: nothing checked.', variant: 'g4' }));
    await approve(h, claim);
    check('G4 first approve holds the claim', fx.readStatus(h.room.room, claim) === 'needs_evidence');
    fx.writeRoomFloor(h.room.room, 'unchecked');
    await approve(h, claim);
    check('G4 after lowering the floor the claim is confirmed', fx.readStatus(h.room.room, claim) === 'confirmed');
    const evs = floorEvents(h.room.room, claim);
    const last = evs[evs.length - 1] || {};
    check('G4 event floor_source room_md and floor_id unchecked', last.floor_source === 'room_md'
      && last.floor_id === 'unchecked' && last.floor_met === true, JSON.stringify(last));
  } finally {
    h.room.cleanup();
  }
}

async function g5() {
  process.stdout.write('\n-- G5: structural higher floors (D-22) --\n');
  {
    const h = makeHarness('g5a');
    try {
      fx.writeRoomFloor(h.room.room, 'primary_source_located');
      const noLoc = withDb(h.room.room, (db) => {
        const id = fx.seedClaim(db, { text: 'G5 claim without a locator.', variant: 'g5a' });
        fx.addSourceEdge(db, id, { url: 'https://example.org/n', retrieved_at: '2026-09-30', variant: 'g5a' });
        return id;
      });
      const withLoc = withDb(h.room.room, (db) => {
        const id = fx.seedClaim(db, { text: 'G5 claim with a locator.', variant: 'g5b' });
        fx.addSourceEdge(db, id, {
          url: 'https://example.org/l', retrieved_at: '2026-09-30', locator: 'section 4.2', variant: 'g5b',
        });
        return id;
      });
      await approve(h, noLoc);
      check('G5 primary_source_located without a locator is held', fx.readStatus(h.room.room, noLoc) === 'needs_evidence');
      await approve(h, withLoc);
      check('G5 primary_source_located with a locator is confirmed', fx.readStatus(h.room.room, withLoc) === 'confirmed');
    } finally {
      h.room.cleanup();
    }
  }
  {
    const h = makeHarness('g5c');
    try {
      fx.writeRoomFloor(h.room.room, 'person');
      const claim = withDb(h.room.room, (db) => {
        const id = fx.seedClaim(db, { text: 'G5 person floor claim.', variant: 'g5c' });
        fx.addSourceEdge(db, id, {
          url: 'https://example.org/p', retrieved_at: '2026-09-30', locator: 'p. 9', variant: 'g5c',
        });
        return id;
      });
      const res = await approve(h, claim);
      const rn = res.json && res.json.reasoning_node;
      check('G5 person floor always holds', fx.readStatus(h.room.room, claim) === 'needs_evidence');
      check('G5 person floor reports below_floor', !!rn && rn.subject_skip_reason === 'below_floor', JSON.stringify(rn));
    } finally {
      h.room.cleanup();
    }
  }
}

async function g6() {
  process.stdout.write('\n-- G6: an opportunity subject is untouched by the floor (D-21) --\n');
  const h = makeHarness('g6');
  try {
    const oppId = withDb(h.room.room, (db) => {
      const res = navigation.writeOpportunityNode(db, { name: 'G6 opportunity', sessionId: 'g6-opp' });
      assert.ok(res && res.ok === true, 'opportunity seed');
      return res.node_id;
    });
    const res = await approve(h, oppId);
    const rn = res.json && res.json.reasoning_node;
    check('G6 opportunity confirmed exactly as before', fx.readStatus(h.room.room, oppId) === 'confirmed');
    check('G6 reasoning_node carries no floor fields', !!rn && rn.subject_confirmed === true
      && rn.floor_id === undefined && rn.landed_status === undefined, JSON.stringify(rn));
    check('G6 no approval_floor_checked event', floorEvents(h.room.room).length === 0);
  } finally {
    h.room.cleanup();
  }
}

async function g7() {
  process.stdout.write('\n-- G7: card evidence ids never satisfy the floor (T-365-01) --\n');
  const h = makeHarness('g7');
  try {
    const { claim, evidence } = withDb(h.room.room, (db) => {
      const c = fx.seedClaim(db, { text: 'G7 claim with no outbound edge.', variant: 'g7' });
      const ev = navigation.writeEvidenceClaim(db, {
        topic: 'g7 source', source: 'fixture-365', url: 'https://example.org/g7', retrieved_at: '2026-09-30',
        evidence_tier: 'Academic', summary: 'g7 evidence', sessionId: 'g7-ev',
      });
      assert.ok(ev && ev.ok === true, 'evidence seed');
      return { claim: c, evidence: ev.node_id || ev.id };
    });
    const res = await approve(h, claim, { evidence: [evidence] });
    const rn = res.json && res.json.reasoning_node;
    check('G7 claim is held despite the card evidence', fx.readStatus(h.room.room, claim) === 'needs_evidence',
      JSON.stringify(rn));
    check('G7 evidence node itself is not promoted', fx.readStatus(h.room.room, evidence) !== 'confirmed');
    const evs = floorEvents(h.room.room, claim);
    check('G7 event standing none', !!evs[0] && evs[0].standing === 'none' && evs[0].floor_met === false,
      JSON.stringify(evs[0]));
  } finally {
    h.room.cleanup();
  }
}

async function h1h2h4() {
  process.stdout.write('\n-- H1, H2, H4: the gate_render handler composes the why-line --\n');
  const h = makeHarness('h1');
  try {
    const { held, readyToRelease, opp } = withDb(h.room.room, (db) => {
      const a = fx.seedClaim(db, { text: 'H1 claim: ask only.', variant: 'h1a' });
      fx.recordAsk(db, a, { rung: 2 });
      const b = fx.seedClaim(db, { text: 'H4 claim: will gain a source.', variant: 'h4' });
      const o = navigation.writeOpportunityNode(db, { name: 'H1 opportunity', sessionId: 'h1-opp' });
      assert.ok(o && o.ok === true, 'opportunity seed');
      return { held: a, readyToRelease: b, opp: o.node_id };
    });

    // H1: a claim subject, rung c, carries the notice and the relabel.
    const card = await renderCard(h, held);
    check('H1 rung c rendered', !!card.json && card.json.ok === true && card.json.renderer === 'text', card.text.slice(0, 200));
    check('H1 card text carries the Checked against line', card.text.indexOf('Checked against:') !== -1);
    check('H1 card text says needs evidence', card.text.indexOf('needs evidence') !== -1);
    check('H1 card text carries the relabelled approve', card.text.indexOf('Approve, mark as needs evidence') !== -1);
    check('H1 the old Approve label is relabelled, ids unchanged', card.text.indexOf('approve') !== -1);

    // H1: the relabelled card validates by id and by the new label only.
    {
      const viaLabel = await answer(h, card, 'approve', 'Approve, mark as needs evidence');
      check('H1 chosen by the new label is accepted', !!viaLabel.json && viaLabel.json.ok === true, JSON.stringify(viaLabel.json));
    }
    {
      const card2 = await renderCard(h, held);
      const viaOld = await answer(h, card2, 'approve', 'Approve');
      check('H1 chosen by the old label is rejected', !!viaOld.json && viaOld.json.ok === false
        && viaOld.json.reason === 'chosen_not_in_card_options', JSON.stringify(viaOld.json));
    }

    // H1: an opportunity subject and an unknown subject get no notice.
    const oppCard = await renderCard(h, opp);
    check('H1 opportunity subject gets no notice', oppCard.text.indexOf('Checked against:') === -1, oppCard.text.slice(0, 200));
    const unknownCard = await renderCard(h, 'claim:does-not-exist-365');
    check('H1 an unknown subject renders with no notice', !!unknownCard.json && unknownCard.json.ok === true
      && unknownCard.text.indexOf('Checked against:') === -1);
    const noSubject = await h.handlers.get('gate_render')(
      { header: 'No subject', kind: 'general', select_mode: 'single', options: OPTIONS }, { sessionId: nextSession('ns') });
    check('H1 a card with no subject renders with no notice', textOf(noSubject).indexOf('Checked against:') === -1
      && !!jsonOf(noSubject) && jsonOf(noSubject).ok === true);

    // H2: only a kind general card is composed.
    const matCard = await renderCard(h, held, { kind: 'material_step' });
    check('H2 a material_step card is never given a notice', matCard.text.indexOf('Checked against:') === -1,
      matCard.text.slice(0, 200));

    // H4: TOCTOU. Rendered below the floor, a source edge arrives, then approve.
    const early = await renderCard(h, readyToRelease);
    check('H4 render predicts needs evidence', early.text.indexOf('approving files it as needs evidence') !== -1);
    withDb(h.room.room, (db) => {
      fx.addSourceEdge(db, readyToRelease, { url: 'https://example.org/h4', retrieved_at: '2026-09-30', variant: 'h4' });
    });
    const done = await answer(h, early, 'approve');
    const rn = done.json && done.json.reasoning_node;
    check('H4 the claim is confirmed because evidence arrived', fx.readStatus(h.room.room, readyToRelease) === 'confirmed');
    check('H4 floor_changed_since_render is true', !!rn && rn.floor_changed_since_render === true, JSON.stringify(rn));

    // H4 control: nothing moved between render and click.
    const steady = await approve(h, held);
    const rn2 = steady.json && steady.json.reasoning_node;
    check('H4 control: floor_changed_since_render is false', !!rn2 && rn2.floor_changed_since_render === false,
      JSON.stringify(rn2));
  } finally {
    h.room.cleanup();
  }
}

function runNode(file) {
  return spawnSync(process.execPath, [path.join(REPO_ROOT, 'tests', file)], {
    cwd: REPO_ROOT, encoding: 'utf8', timeout: 240000,
  });
}

async function h6aH7() {
  process.stdout.write('\n-- H6a, H7: zod4 contract check (a) and the floor acceptance leg --\n');
  const c = runNode('test-267-mcpv2-zod4-contract.cjs');
  const out = (c.stdout || '') + (c.stderr || '');
  check('H6a zod4 contract check (a) still passes', /^PASS: Check \(a\)/m.test(out), out.slice(0, 300));
  const acc = runNode('test-365-acceptance-floor.cjs');
  const accOut = (acc.stdout || '') + (acc.stderr || '');
  const noticeReds = accOut.split('\n').filter((l) => l.indexOf('RED-365-FLOOR-NOTICE') === 0);
  check('H7 no RED-365-FLOOR-NOTICE on rungs a, b or c', noticeReds.every((l) => l.indexOf('meeting') !== -1), noticeReds.join(' | '));
  check('H7 no RED-365-FLOOR token for the below-floor approve', accOut.split('\n').every((l) => l.indexOf('RED-365-FLOOR:') !== 0), accOut.slice(0, 300));
}

async function main() {
  await g1toG3andG8G9();
  await g4();
  await g5();
  await g6();
  await g7();
  await h1h2h4();
  await h6aH7();

  check('net guard saw no network attempts', netGuard.attempts() === 0, 'attempts=' + netGuard.attempts());
  return checker.summary();
}

main().then((code) => { process.exit(code); }).catch((e) => {
  process.stdout.write('FAIL: unhandled ' + String((e && e.stack) || e) + '\n');
  process.exit(1);
});
