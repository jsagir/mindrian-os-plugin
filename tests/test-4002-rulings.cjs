#!/usr/bin/env node
'use strict';
// Phase 400.2-09: the tension rulings of the door (scripts/persona-hats.cjs cmdRecordRuling, readRulingsStore, the
// settled mark of cmdMerge). Legs G1 to G10; G11 to G14 are extra legs (router, a second call, the corrupt store).
// Legs G20 to G22 (Phase 400.2.1, S6): the delegated ruling.
// Every leg passes homeDir, tmpDir, now and randomHex as options. No test sends a network request.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const DOOR_PATH = path.join(ROOT, 'scripts', 'persona-hats.cjs');

let failed = 0;
let passed = 0;
const queue = [];
function check(label, fn) {
  queue.push({ label, fn });
}

let door;
try {
  door = require(DOOR_PATH);
} catch (e) {
  console.log('FAIL: the door is missing: ' + (e && e.message ? e.message : String(e)));
  process.exit(1);
}

const HATS = ['white', 'red', 'black', 'yellow', 'green', 'blue'];
const READ_HATS = ['white', 'red', 'black', 'yellow', 'green'];
const NOW = new Date('2026-11-25T10:20:30.000Z');
const LATER = new Date('2026-11-26T08:00:00.000Z');
const SQ_TEXTS = ['Who pays first?', 'What breaks at the hand-off?'];
const tmpRoots = [];

function mkTmp(label) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-4002-rulings-' + label + '-'));
  tmpRoots.push(d);
  return d;
}

function put(room, rel, text) {
  const abs = path.join(room, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text, 'utf8');
}

function makeRoom() {
  const room = mkTmp('room');
  put(room, 'STATE.md', '---\nventure: Harbor Light Studio\nstage: seed\n---\n\n# Harbor Light Studio\n\nA test venture.\n');
  put(room, 'problem-definition/core-problem.md', '# Core problem\nSmall studios lose clients at the hand-off.\n');
  put(room, 'market-analysis/size.md', '# Size\nAbout 4000 studios in the region.\n');
  return room;
}

function counterHex() {
  let n = 0;
  return (len) => {
    n += 1;
    return crypto.createHash('sha256').update('seam-' + n).digest('hex').slice(0, len);
  };
}

function makeEnv(now) {
  const e = { homeDir: mkTmp('home'), tmpDir: mkTmp('tmp') };
  e.opts = () => ({ homeDir: e.homeDir, tmpDir: e.tmpDir, now: now || NOW, randomHex: counterHex() });
  return e;
}

function validSpec(hat) {
  return { schema: 'mos.persona-spec/1', hat, focus: 'Look at the ' + hat + ' side.', hat_questions: ['What does the room show?', 'What is missing?', 'What would change the view?'], must_not_judge: ['The price level.'], room_sources: ['problem-definition/core-problem.md'] };
}

// over.room, over.now, over.target (a room-relative file), over.subQuestions (texts), over.pos {hat: [value, value]},
// over.lines {hat: [line, line]} (a position line other than the default).
function mkRun(over) {
  const o = over || {};
  const room = o.room || makeRoom();
  const env = makeEnv(o.now);
  const bp = path.join(mkTmp('brief'), 'brief.json');
  fs.writeFileSync(bp, JSON.stringify({
    schema: 'mos.persona-brief/1', target: o.target || 'room',
    governing_question: 'Should the studio move to a fixed monthly retainer model for new clients?',
    sub_questions: o.subQuestions || SQ_TEXTS,
    reading_list: ['problem-definition/core-problem.md', 'market-analysis/size.md'],
    mode: 'deep', triage: { recommended: 'deep', reason: 'A pricing change.' },
  }), 'utf8');
  const res = door.cmdStart({ roomDir: room, briefPath: bp, mode: 'deep' }, env.opts());
  assert.equal(res.ok, true, JSON.stringify(res));
  const toDo = res.to_build.concat(res.to_accept);
  if (toDo.length > 0) {
    for (const h of res.to_build) fs.writeFileSync(path.join(res.hats[h].dir, 'persona.json'), JSON.stringify(validSpec(h)), 'utf8');
    assert.equal(door.cmdWritePersona({ roomDir: room, runId: res.run_id }, env.opts()).ok, true);
    const answer = {};
    for (const h of toDo) answer[h] = { decision: 'accept' };
    const ap = path.join(mkTmp('answer'), 'answer.json');
    fs.writeFileSync(ap, JSON.stringify({ schema: 'mos.persona-accept/1', run_id: res.run_id, hats: answer }), 'utf8');
    const a = door.cmdAcceptPersona({ roomDir: room, runId: res.run_id, answerPath: ap }, env.opts());
    assert.equal(a.ok && a.accept_done, true, JSON.stringify(a));
  }
  const p = door.cmdPlanResearch({ roomDir: room, runId: res.run_id }, env.opts());
  assert.equal(p.ok, true, JSON.stringify(p));
  const ledger = () => JSON.parse(fs.readFileSync(path.join(res.review_dir, 'run.json'), 'utf8'));
  const run = { room, env, res, ids: ledger().sub_questions.map(s => s.id), ledger };
  const pos = o.pos || {};
  for (const hat of READ_HATS) writeReading(run, hat, readingOf(run, hat, pos[hat], (o.lines || {})[hat]));
  writeReading(run, 'blue', blueReading(run));
  const c = door.cmdCheck({ roomDir: room, runId: res.run_id }, env.opts());
  assert.equal(c.ok, true, JSON.stringify(c));
  return run;
}

function lineOf(hat, i) {
  return hat + ' line ' + i;
}

function readingOf(run, hat, values, lines) {
  const base = { schema: 'mos.persona-reading/1', run_id: run.res.run_id, hat };
  base.positions = run.ids.map((id, i) => {
    const value = values && values[i] ? values[i] : 'no_position';
    const p = { sub_question: id, value };
    if (value !== 'no_position') p.line = lines && lines[i] ? lines[i] : lineOf(hat, i);
    return p;
  });
  if (hat === 'white') Object.assign(base, { evidence: [], missing_data: ['The price of rival plans.'] });
  if (hat === 'black') Object.assign(base, { evidence: [], steelman: 'The best case.' });
  if (hat === 'yellow') Object.assign(base, { evidence: [], none_found: false });
  if (hat === 'green') Object.assign(base, { provocations: ['What if the client owns the hand-off?'], evidence: [] });
  return base;
}

function blueReading(run) {
  return { schema: 'mos.persona-reading/1', run_id: run.res.run_id, hat: 'blue', skipped: ['No search was run for green.'], thin: ['The red hat gave only short lines.'], ask_next: ['Ask who pays first.'] };
}

function writeReading(run, hat, obj) {
  fs.writeFileSync(path.join(run.res.hats[hat].dir, 'reading.json'), JSON.stringify(obj), 'utf8');
}

function writeCounts(run) {
  const p = path.join(run.res.inbox_dir, 'counts.json');
  fs.writeFileSync(p, JSON.stringify({ agent_runs: 7, stops: 3, cards: 4 }), 'utf8');
  return p;
}

async function doMerge(run) {
  return door.cmdMerge({ roomDir: run.room, runId: run.res.run_id, countsPath: writeCounts(run) }, run.env.opts());
}

function writeAnswer(run, rulings, over) {
  // The inbox of the run sits in the scratch tree, which merge deletes: the command writes this answer file into
  // a directory of its own (mktemp -d), as it does for the brief.
  const p = path.join(mkTmp('ruling'), 'ruling.json');
  fs.writeFileSync(p, JSON.stringify(Object.assign({ schema: 'mos.persona-ruling-answer/1', run_id: run.res.run_id, rulings }, over || {})), 'utf8');
  return p;
}

function doRule(run, rulings, over) {
  return door.cmdRecordRuling({ roomDir: run.room, runId: run.res.run_id, answerPath: writeAnswer(run, rulings, over) }, run.env.opts());
}

const storePath = (room) => path.join(room, '.mindrian', 'hats', 'tension-rulings.json');
const readStore = (room) => JSON.parse(fs.readFileSync(storePath(room), 'utf8'));
// One tension on the first sub-question: black opposes, yellow favours.
const ONE = { yellow: ['favours', 'no_position'], black: ['opposes', 'no_position'] };
// Two tensions on the first sub-question: black and yellow, black and green.
const TWO = { yellow: ['favours'], black: ['opposes'], green: ['alternative_offered'] };

check('G1. merge creates no store; record-ruling side_a writes one key with its fields; the store name is written in one function only', async () => {
  const run = mkRun({ pos: ONE });
  const out = await doMerge(run);
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(out.tensions.length, 1);
  assert.equal(fs.existsSync(storePath(run.room)), false, 'merge creates no store');
  const t = out.tensions[0];
  const r = doRule(run, [{ tension_id: t.id, ruling: 'side_a', reason: 'Black has the better case.' }]);
  assert.equal(r.ok, true, JSON.stringify(r));
  const store = readStore(run.room);
  // Phase 400.2.1 (S6): the door writes schema 2 (the optional delegated key); it still reads schema 1.
  assert.equal(store.schema, 'mos.persona-tension-rulings/2');
  assert.deepEqual(Object.keys(store.rulings), [t.id]);
  const e = store.rulings[t.id];
  assert.deepEqual(Object.keys(e).sort(), ['lines', 'pair', 'reason', 'ruled_at', 'ruling', 'run_id', 'sub_question_text'].sort());
  assert.equal(e.ruling, 'side_a');
  assert.equal(e.reason, 'Black has the better case.');
  assert.equal(e.ruled_at, NOW.toISOString());
  assert.equal(e.run_id, run.res.run_id);
  assert.equal(e.sub_question_text, SQ_TEXTS[0]);
  assert.deepEqual(e.pair, ['black', 'yellow']);
  assert.deepEqual(e.lines, { black: lineOf('black', 0), yellow: lineOf('yellow', 0) });
  assert.equal(run.ledger().steps.record_ruling.state, 'done');
  // The store name is written by one function only: cmdRecordRuling.
  const src = fs.readFileSync(DOOR_PATH, 'utf8');
  assert.equal(src.split('tension-rulings.json').length - 1, 1, 'the file name occurs once');
  const writes = src.match(/atomicWriteJson\(\s*rulingsStorePath\(/g) || [];
  assert.equal(writes.length, 1, 'one write call of the store');
  assert.ok(door.cmdRecordRuling.toString().includes('atomicWriteJson(rulingsStorePath('), 'the write is inside cmdRecordRuling');
  assert.equal(door.cmdMerge.toString().includes('atomicWriteJson(rulingsStorePath('), false, 'merge writes no store');
});

check('G2. a second run with the same target, sub-question text and positions marks the tension settled; stored and new lines side by side', async () => {
  const room = makeRoom();
  const a = mkRun({ room, pos: ONE });
  const outA = await doMerge(a);
  assert.equal(doRule(a, [{ tension_id: outA.tensions[0].id, ruling: 'side_b' }]).ok, true);
  const ids = a.ids;
  const b = mkRun({ room, pos: ONE, now: LATER, lines: { black: ['black new line', 'x'], yellow: ['yellow new line', 'x'] } });
  assert.deepEqual(b.ids, ids);
  const outB = await doMerge(b);
  assert.equal(outB.ok, true, JSON.stringify(outB));
  assert.deepEqual(outB.settled.map(t => t.id), [outA.tensions[0].id]);
  assert.deepEqual(outB.open, []);
  assert.equal(outB.tensions.length, 1);
  const t = outB.tensions[0];
  assert.equal(t.state, 'settled');
  assert.equal(t.ruling, 'side_b');
  assert.equal(t.ruled_at, NOW.toISOString());
  assert.deepEqual(t.lines, { black: 'black new line', yellow: 'yellow new line' });
  assert.deepEqual(t.stored_lines, { black: lineOf('black', 0), yellow: lineOf('yellow', 0) });
  assert.equal(b.ledger().tensions[0].state, 'settled');
  assert.equal(b.ledger().tensions[0].ruling, 'side_b');
  const lines = fs.readFileSync(outB.artifact, 'utf8').split('\n').map(l => l.trimEnd());
  assert.ok(lines.includes('settled on 2026-11-25: side_b'), 'the fixed settled line');
  for (const l of ['black opposes: black new line', 'yellow favours: yellow new line', 'stored black: ' + lineOf('black', 0), 'stored yellow: ' + lineOf('yellow', 0), 'state: settled']) {
    assert.ok(lines.includes(l), 'artifact line ' + l);
  }
  // Every line that starts with the new labels is the label plus one field, nothing else.
  for (const l of lines) {
    if (l.indexOf('settled on ') === 0) assert.equal(l, 'settled on 2026-11-25: side_b');
    if (l.indexOf('stored ') === 0) assert.ok(/^stored (black|yellow): /.test(l), l);
  }
  const idx = lines.indexOf('settled on 2026-11-25: side_b');
  assert.ok(lines.slice(idx - 4, idx + 4).includes('black opposes: black new line'), 'new lines near the settled line');
});

check('G3. a changed target file gives another id; a changed sub-question text gives another id; both are open', async () => {
  const room = makeRoom();
  const target = 'problem-definition/core-problem.md';
  const a = mkRun({ room, target, pos: ONE });
  const outA = await doMerge(a);
  const idA = outA.tensions[0].id;
  assert.equal(doRule(a, [{ tension_id: idA, ruling: 'side_a' }]).ok, true);
  // Same content again: settled.
  const same = mkRun({ room, target, pos: ONE, now: LATER });
  const outSame = await doMerge(same);
  assert.equal(outSame.tensions[0].state, 'settled');
  assert.equal(outSame.tensions[0].id, idA);
  // Changed target content.
  put(room, target, '# Core problem\nSmall studios lose clients at the hand-off, and the retainer changes that.\n');
  const c = mkRun({ room, target, pos: ONE, now: new Date('2026-11-27T08:00:00.000Z') });
  const outC = await doMerge(c);
  assert.equal(outC.ok, true, JSON.stringify(outC));
  assert.equal(outC.tensions.length, 1);
  assert.notEqual(outC.tensions[0].id, idA);
  assert.equal(outC.tensions[0].state, 'open');
  assert.equal(outC.open.length, 1);
  // Changed sub-question text.
  const d = mkRun({ room, target, pos: ONE, subQuestions: ['Who pays first, and when?', SQ_TEXTS[1]], now: new Date('2026-11-28T08:00:00.000Z') });
  const outD = await doMerge(d);
  assert.equal(outD.tensions.length, 1);
  assert.notEqual(outD.tensions[0].id, idA);
  assert.notEqual(outD.tensions[0].id, outC.tensions[0].id);
  assert.equal(outD.tensions[0].state, 'open');
});

check('G4. a defer is in the run record and not in the store; the next run has the tension open', async () => {
  const room = makeRoom();
  const a = mkRun({ room, pos: ONE });
  const outA = await doMerge(a);
  const id = outA.tensions[0].id;
  const r = doRule(a, [{ tension_id: id, ruling: 'defer' }]);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.deferred, [id]);
  assert.equal(fs.existsSync(storePath(room)), false, 'no store for a defer');
  const rec = a.ledger().tensions[0];
  assert.equal(rec.ruling, 'defer');
  assert.equal(rec.state, 'open');
  const b = mkRun({ room, pos: ONE, now: LATER });
  const outB = await doMerge(b);
  assert.equal(outB.tensions[0].state, 'open');
  assert.equal(outB.open.length, 1);
  assert.deepEqual(outB.settled, []);
});

check('G5. reopen true removes the key; the next run has the tension open', async () => {
  const room = makeRoom();
  const a = mkRun({ room, pos: ONE });
  const outA = await doMerge(a);
  const id = outA.tensions[0].id;
  assert.equal(doRule(a, [{ tension_id: id, ruling: 'both_hold' }]).ok, true);
  const b = mkRun({ room, pos: ONE, now: LATER });
  const outB = await doMerge(b);
  assert.equal(outB.tensions[0].state, 'settled');
  const r = doRule(b, [{ tension_id: id, ruling: 'defer', reopen: true }]);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.reopened, [id]);
  assert.deepEqual(readStore(room).rulings, {});
  assert.equal(b.ledger().tensions[0].state, 'open');
  assert.equal(b.ledger().tensions[0].stored_lines, undefined);
  const c = mkRun({ room, pos: ONE, now: new Date('2026-11-27T08:00:00.000Z') });
  const outC = await doMerge(c);
  assert.equal(outC.tensions[0].state, 'open');
});

check('G6. NEGATIVE: an id the run does not hold is tension_not_in_run; a bad ruling value is schema_invalid; nothing is written', async () => {
  const run = mkRun({ pos: ONE });
  const out = await doMerge(run);
  const id = out.tensions[0].id;
  const before = run.ledger();
  const ghost = crypto.createHash('sha256').update('ghost').digest('hex');
  const r1 = doRule(run, [{ tension_id: id, ruling: 'side_a' }, { tension_id: ghost, ruling: 'side_a' }]);
  assert.deepEqual(r1, { ok: false, reason: 'tension_not_in_run' });
  const r2 = doRule(run, [{ tension_id: id, ruling: 'winner' }]);
  assert.equal(r2.ok, false);
  assert.ok(/^schema_invalid/.test(r2.reason), r2.reason);
  const r3 = doRule(run, [{ tension_id: id, ruling: 'side_a', extra: 1 }]);
  assert.ok(/^schema_invalid/.test(r3.reason), r3.reason);
  const r4 = doRule(run, [{ tension_id: id, ruling: 'side_a', reason: 'x'.repeat(281) }]);
  assert.ok(/^schema_invalid/.test(r4.reason), r4.reason);
  const r5 = doRule(run, [{ tension_id: id, ruling: 'side_a' }], { run_id: '20200101-000000-abcd' });
  assert.equal(r5.ok, false);
  assert.ok(/^schema_invalid/.test(r5.reason), r5.reason);
  assert.equal(fs.existsSync(storePath(run.room)), false, 'no store');
  assert.deepEqual(run.ledger(), before, 'the ledger is unchanged');
});

check('G7. NEGATIVE: record-ruling before merge is done returns step_out_of_order:merge', async () => {
  const run = mkRun({ pos: ONE });
  const r = doRule(run, [{ tension_id: crypto.createHash('sha256').update('x').digest('hex'), ruling: 'side_a' }]);
  assert.deepEqual(r, { ok: false, reason: 'step_out_of_order:merge' });
  assert.equal(fs.existsSync(storePath(run.room)), false);
});

function roomDbEvents(room) {
  const navigation = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));
  const db = navigation.openRoomDbForCaller(room);
  assert.ok(db, 'room.db opens');
  try {
    return db.prepare("SELECT id, properties, created_by, review_status FROM nodes WHERE type = 'memory_event'").all()
      .map(r => Object.assign({ id: r.id, created_by: r.created_by, review_status: r.review_status }, { props: JSON.parse(r.properties) }))
      .filter(r => r.props.event_type === 'decision_captured');
  } finally {
    navigation.closeRoomDbForCaller(db);
  }
}

check('G8. with a room.db each ruling adds one decision_captured event with ids and the value only; EVENT_TYPES size stays 106', async () => {
  const run = mkRun({ pos: TWO });
  const roomDbMod = require(path.join(ROOT, 'lib', 'core', 'room-db.cjs'));
  roomDbMod.closeRoomDb(roomDbMod.openRoomDb(run.room));
  const out = await doMerge(run);
  assert.equal(out.tensions.length, 2, JSON.stringify(out.tensions.map(t => t.pair)));
  const reason = 'Because the SECRET-REASON-TEXT holds.';
  const r = doRule(run, [{ tension_id: out.tensions[0].id, ruling: 'side_a', reason }, { tension_id: out.tensions[1].id, ruling: 'both_hold' }]);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.memory_event.state, 'logged');
  assert.equal(r.memory_event.logged, 2);
  const events = roomDbEvents(run.room);
  assert.equal(events.length, 2);
  for (const e of events) {
    const keys = Object.keys(e.props).filter(k => k !== 'event_type').sort();
    assert.deepEqual(keys, ['dedupe_key', 'pair', 'ruling', 'run_id', 'source', 'sub_question_id', 'tension_id']);
    assert.equal(e.props.source, 'persona-hats');
    assert.equal(e.props.run_id, run.res.run_id);
    assert.equal(e.props.sub_question_id, run.ids[0]);
    assert.ok(Array.isArray(e.props.pair) && e.props.pair.length === 2);
    const text = JSON.stringify(e.props);
    assert.equal(text.includes('SECRET-REASON-TEXT'), false, 'no reason text');
    for (const l of ['black line 0', 'yellow line 0', 'green line 0']) assert.equal(text.includes(l), false, 'no line text');
    assert.equal(e.created_by, 'system');
  }
  assert.deepEqual(events.map(e => e.props.tension_id).sort(), out.tensions.map(t => t.id).sort());
  assert.deepEqual(events.map(e => e.props.ruling).sort(), ['both_hold', 'side_a']);
  const memoryEvents = require(path.join(ROOT, 'lib', 'core', 'navigation', 'memory-events.cjs'));
  assert.equal(memoryEvents.EVENT_TYPES.size, 106);
  // No claim node was written by the ruling: the nodes are hat bookkeeping and memory events only.
  const navigation = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));
  const db = navigation.openRoomDbForCaller(run.room);
  try {
    const others = db.prepare("SELECT type FROM nodes WHERE type NOT IN ('HatState', 'memory_event')").all();
    assert.deepEqual(others, []);
  } finally {
    navigation.closeRoomDbForCaller(db);
  }
});

check('G9. with no room.db that can be opened the ruling is stored and the output says memory_event not_logged with the reason', async () => {
  const run = mkRun({ pos: ONE });
  const out = await doMerge(run);
  const r = doRule(run, [{ tension_id: out.tensions[0].id, ruling: 'side_a' }]);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.memory_event.state, 'not_logged');
  assert.equal(r.memory_event.reason, 'no_room_db');
  assert.equal(Object.keys(readStore(run.room).rulings).length, 1);
  // A room.db file that is not a database gives the same answer and the ruling is still stored.
  const run2 = mkRun({ pos: ONE });
  const out2 = await doMerge(run2);
  fs.mkdirSync(path.join(run2.room, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(run2.room, '.mindrian', 'room.db'), 'this is not a database file', 'utf8');
  const r2 = doRule(run2, [{ tension_id: out2.tensions[0].id, ruling: 'side_b' }]);
  assert.equal(r2.ok, true, JSON.stringify(r2));
  assert.equal(r2.memory_event.state, 'not_logged');
  assert.equal(typeof r2.memory_event.reason, 'string');
  assert.equal(Object.keys(readStore(run2.room).rulings).length, 1);
});

check('G10. side_a is the first hat of the sorted pair, side_b the second; the output and the store agree', async () => {
  const run = mkRun({ pos: TWO });
  const out = await doMerge(run);
  assert.deepEqual(out.tensions.map(t => t.pair), [['black', 'green'], ['black', 'yellow']]);
  const r = doRule(run, [{ tension_id: out.tensions[0].id, ruling: 'side_a' }, { tension_id: out.tensions[1].id, ruling: 'side_b' }]);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.recorded[0].side_hat, 'black');
  assert.equal(r.recorded[1].side_hat, 'yellow');
  const store = readStore(run.room);
  assert.equal(store.rulings[out.tensions[0].id].pair[0], 'black');
  assert.equal(store.rulings[out.tensions[1].id].pair[1], 'yellow');
});

check('G11. a second call for other tensions of the same run is allowed; a ruling on a settled tension needs reopen', async () => {
  const run = mkRun({ pos: TWO });
  const out = await doMerge(run);
  const [t0, t1] = out.tensions;
  assert.equal(doRule(run, [{ tension_id: t0.id, ruling: 'side_a' }]).ok, true);
  const again = doRule(run, [{ tension_id: t0.id, ruling: 'side_b' }]);
  assert.deepEqual(again, { ok: false, reason: 'tension_already_settled' });
  const second = doRule(run, [{ tension_id: t1.id, ruling: 'both_hold' }]);
  assert.equal(second.ok, true, JSON.stringify(second));
  assert.equal(Object.keys(readStore(run.room).rulings).length, 2);
  assert.deepEqual(second.remaining_open, []);
  assert.deepEqual(run.ledger().tensions.map(t => t.state), ['settled', 'settled']);
});

check('G12. NEGATIVE: a corrupt store stops merge before anything is written, with a typed reason', async () => {
  const run = mkRun({ pos: ONE });
  fs.mkdirSync(path.dirname(storePath(run.room)), { recursive: true });
  fs.writeFileSync(storePath(run.room), '{not json', 'utf8');
  const before = run.ledger();
  const out = await doMerge(run);
  assert.deepEqual(out, { ok: false, reason: 'rulings_store_invalid' });
  assert.deepEqual(run.ledger(), before);
  assert.equal(fs.existsSync(run.res.hats.white.dir), true, 'the scratch tree is still there');
  assert.equal(door.readRulingsStore(run.room).ok, false);
  fs.writeFileSync(storePath(run.room), JSON.stringify({ schema: 'mos.persona-tension-rulings/1', rulings: { abc: { ruling: 'winner' } } }), 'utf8');
  assert.equal(door.readRulingsStore(run.room).ok, false);
  fs.rmSync(storePath(run.room));
  assert.deepEqual(door.readRulingsStore(run.room), { ok: true, rulings: {} });
});

check('G13. the router runs record-ruling as a subcommand and prints one JSON object', async () => {
  const { spawnSync } = require('node:child_process');
  const run = mkRun({ pos: ONE });
  const out = await doMerge(run);
  const env2 = Object.assign({}, process.env, { MINDRIAN_HOME: run.env.homeDir });
  const usage = spawnSync(process.execPath, [DOOR_PATH, 'record-ruling', '--room', run.room], { env: env2, encoding: 'utf8' });
  assert.equal(usage.status, 2);
  const ap = writeAnswer(run, [{ tension_id: out.tensions[0].id, ruling: 'side_a', reason: 'Sound.' }]);
  const res = spawnSync(process.execPath, [DOOR_PATH, 'record-ruling', '--room', run.room, '--run', run.res.run_id, '--answer', ap], { env: env2, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.ok, true, res.stdout);
  assert.equal(parsed.recorded.length, 1);
  assert.ok(door.SUBCOMMANDS.includes('record-ruling'));
});

check('G14. the memory event dedupe key is stable for one tension and one ruling', async () => {
  const run = mkRun({ pos: ONE });
  const roomDbMod = require(path.join(ROOT, 'lib', 'core', 'room-db.cjs'));
  roomDbMod.closeRoomDb(roomDbMod.openRoomDb(run.room));
  const out = await doMerge(run);
  assert.equal(doRule(run, [{ tension_id: out.tensions[0].id, ruling: 'side_a' }]).ok, true);
  const events = roomDbEvents(run.room);
  assert.equal(events.length, 1);
  assert.equal(typeof events[0].props.dedupe_key, 'string');
  assert.ok(events[0].props.dedupe_key.includes(out.tensions[0].id));
});

// ---------------------------------------------------------------------------
// Plan 16 (orchestrator decision): record-ruling appends a fixed "Rulings" section to the filed review artifact.
// ---------------------------------------------------------------------------

const readArtifact = (run) => fs.readFileSync(path.join(run.res.review_dir, path.basename(run.res.review_dir) + '.md'), 'utf8');
const RULINGS_LABELS = ['tension id: ', 'ruling: ', 'side hat: ', 'ruled on: '];

check('G15. record-ruling appends the fixed Rulings section; the state line of a ruled tension is no longer open; the ruling reason text is not in the artifact', async () => {
  const run = mkRun({ pos: ONE });
  const out = await doMerge(run);
  assert.equal(out.ok, true, JSON.stringify(out));
  const before = readArtifact(run);
  assert.ok(before.split('\n').includes('state: open'), 'the merge artifact shows the tension open');
  assert.equal(before.includes('## Rulings'), false, 'merge writes no Rulings section');
  const t = out.tensions[0];
  const r = doRule(run, [{ tension_id: t.id, ruling: 'side_a', reason: 'Navigator reason text, not for the artifact.' }]);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.artifact, { state: 'updated' });
  const lines = readArtifact(run).split('\n').map(l => l.trimEnd());
  assert.equal(lines.filter(l => l === '## Rulings').length, 1, 'one Rulings heading');
  assert.equal(lines.includes('state: open'), false, 'no tension shows open');
  assert.ok(lines.includes('state: settled'));
  const at = lines.indexOf('## Rulings');
  assert.deepEqual(lines.slice(at + 1).filter(l => l !== ''), [
    'tension id: ' + t.id, 'ruling: side_a', 'side hat: black', 'ruled on: 2026-11-25',
  ]);
  assert.equal(lines.join('\n').includes('Navigator reason text'), false, 'the reason stays in the store');
  // Everything above the Rulings section is the merge artifact, except the state line of the ruled tension.
  const old = before.split('\n').map(l => l.trimEnd());
  const head = lines.slice(0, at);
  while (head.length && head[head.length - 1] === '') head.pop();
  while (old.length && old[old.length - 1] === '') old.pop();
  assert.equal(head.length, old.length);
  const changed = head.map((l, i) => (l === old[i] ? null : [old[i], l])).filter(Boolean);
  assert.deepEqual(changed, [['state: open', 'state: settled']]);
});

check('G16. a second call updates the section in place: both rulings are listed, the heading stays once; both_hold has side hat none', async () => {
  const run = mkRun({ pos: TWO });
  const out = await doMerge(run);
  assert.equal(out.tensions.length, 2);
  const [a, b] = out.tensions;
  assert.equal(doRule(run, [{ tension_id: a.id, ruling: 'side_b' }]).ok, true);
  assert.equal(doRule(run, [{ tension_id: b.id, ruling: 'both_hold' }]).ok, true);
  const lines = readArtifact(run).split('\n').map(l => l.trimEnd());
  assert.equal(lines.filter(l => l === '## Rulings').length, 1);
  const at = lines.indexOf('## Rulings');
  const tail = lines.slice(at + 1).filter(l => l !== '');
  assert.equal(tail.length, 8);
  for (const l of tail) assert.ok(RULINGS_LABELS.some(lab => l.indexOf(lab) === 0), l);
  assert.deepEqual(tail.filter(l => l.indexOf('tension id: ') === 0), ['tension id: ' + a.id, 'tension id: ' + b.id]);
  assert.ok(tail.includes('ruling: side_b'));
  assert.ok(tail.includes('side hat: ' + a.pair[1]));
  assert.ok(tail.includes('ruling: both_hold'));
  assert.ok(tail.includes('side hat: none'));
  assert.equal(lines.includes('state: open'), false);
});

check('G17. a defer adds no Rulings section and leaves the state open; reopen removes the entry, sets the state back and drops the stored lines', async () => {
  const room = makeRoom();
  const a = mkRun({ room, pos: ONE });
  const outA = await doMerge(a);
  const id = outA.tensions[0].id;
  assert.equal(doRule(a, [{ tension_id: id, ruling: 'defer' }]).ok, true);
  const afterDefer = readArtifact(a);
  assert.equal(afterDefer.includes('## Rulings'), false, 'a defer adds no section');
  assert.ok(afterDefer.split('\n').includes('state: open'));
  // A stored ruling of run A makes the tension settled in run B; the artifact of B holds the stored lines.
  const a2 = mkRun({ room, pos: ONE, now: new Date('2026-11-26T01:00:00.000Z') });
  const outA2 = await doMerge(a2);
  assert.equal(doRule(a2, [{ tension_id: outA2.tensions[0].id, ruling: 'side_a' }]).ok, true);
  const b = mkRun({ room, pos: ONE, now: LATER });
  const outB = await doMerge(b);
  assert.equal(outB.tensions[0].state, 'settled');
  assert.ok(readArtifact(b).split('\n').some(l => l.indexOf('stored ') === 0), 'merge printed the stored lines');
  const r = doRule(b, [{ tension_id: id, ruling: 'defer', reopen: true }]);
  assert.equal(r.ok, true, JSON.stringify(r));
  const lines = readArtifact(b).split('\n').map(l => l.trimEnd());
  assert.ok(lines.includes('state: open'));
  assert.equal(lines.some(l => l.indexOf('stored ') === 0 || l.indexOf('settled on ') === 0), false, 'stale settled lines are gone');
  assert.equal(lines.indexOf('## Rulings'), -1, 'no ruling is left and the section was never written, so it is absent');
});

check('G18. NEGATIVE: with the artifact file gone the ruling is still stored and the output says so; the Rulings lines hold only labels and ids', async () => {
  const run = mkRun({ pos: ONE });
  const out = await doMerge(run);
  fs.rmSync(out.artifact, { force: true });
  const r = doRule(run, [{ tension_id: out.tensions[0].id, ruling: 'side_a' }]);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.artifact, { state: 'not_updated', reason: 'artifact_missing' });
  assert.equal(Object.keys(readStore(run.room).rulings).length, 1);
  assert.equal(fs.existsSync(out.artifact), false, 'no artifact is created from nothing');
  // The door source keeps every Rulings line in ARTIFACT_LABELS.
  const L = door.ARTIFACT_LABELS;
  assert.equal(L.section_rulings, '## Rulings');
  for (const k of ['ruling_value', 'ruling_side_hat', 'ruling_date']) assert.equal(typeof L[k], 'string', k);
});

check('G19. WR-09 NEGATIVE: two navigators who rule on two runs of one room at the same time both keep their ruling (Cowork); a held lock gives a typed refusal', async () => {
  const room = makeRoom();
  const a = mkRun({ room, pos: ONE });
  const b = mkRun({ room, now: LATER, pos: ONE, subQuestions: ['Who pays last?', 'What breaks at the start?'] });
  const ma = await doMerge(a);
  const mb = await doMerge(b);
  const ta = ma.tensions[0];
  const tb = mb.tensions[0];
  assert.ok(ta && tb && ta.id !== tb.id);
  const store = storePath(room);
  // Writer B runs to the end while writer A is between its read of the store and its write of the store.
  const realOpen = fs.openSync;
  const realRename = fs.renameSync;
  let fired = false;
  let bOut = null;
  const interleave = () => {
    if (fired) return;
    fired = true;
    bOut = doRule(b, [{ tension_id: tb.id, ruling: 'side_b' }]);
  };
  let aOut;
  try {
    fs.openSync = function (p, ...rest) {
      if (typeof p === 'string' && p === store + '.lock') interleave();
      return realOpen.call(fs, p, ...rest);
    };
    fs.renameSync = function (from, to) {
      if (to === store) interleave();
      return realRename.call(fs, from, to);
    };
    aOut = doRule(a, [{ tension_id: ta.id, ruling: 'side_a' }]);
  } finally {
    fs.openSync = realOpen;
    fs.renameSync = realRename;
  }
  assert.equal(fired, true);
  assert.equal(bOut && bOut.ok, true, JSON.stringify(bOut));
  assert.equal(aOut.ok, true, JSON.stringify(aOut));
  const kept = readStore(room).rulings;
  assert.deepEqual(Object.keys(kept).sort(), [ta.id, tb.id].sort(), 'no ruling is lost: the last rename does not win');
  assert.equal(kept[ta.id].ruling, 'side_a');
  assert.equal(kept[tb.id].ruling, 'side_b');
  assert.equal(fs.existsSync(store + '.lock'), false, 'the lock is released');
  // A lock that another writer holds now: a typed refusal, nothing written.
  fs.writeFileSync(store + '.lock', 'held', 'utf8');
  const before = fs.readFileSync(store, 'utf8');
  const busy = door.cmdRecordRuling({ roomDir: a.room, runId: a.res.run_id, answerPath: writeAnswer(a, [{ tension_id: ta.id, ruling: 'defer', reopen: true }]) }, Object.assign(a.env.opts(), { _lockWaitMs: 50 }));
  assert.deepEqual(busy, { ok: false, reason: 'rulings_store_busy' });
  assert.equal(fs.readFileSync(store, 'utf8'), before);
  // A stale lock (older than the stale age) is removed and the write goes on.
  const old = new Date(Date.now() - 10 * 60 * 1000);
  fs.utimesSync(store + '.lock', old, old);
  const reopen = door.cmdRecordRuling({ roomDir: a.room, runId: a.res.run_id, answerPath: writeAnswer(a, [{ tension_id: ta.id, ruling: 'defer', reopen: true }]) }, Object.assign(a.env.opts(), { _lockWaitMs: 50 }));
  assert.equal(reopen.ok, true, JSON.stringify(reopen));
  assert.deepEqual(Object.keys(readStore(room).rulings), [tb.id]);
});

// Phase 400.2.1 (S6): the delegated ruling. Owner ruling 2026-11-26: "Larry picks, you confirm". Larry states the pick
// and one reason, the navigator confirms in one word, and the door stores a normal ruling with delegated: true.
check('G20. 400.2.1 S6: a confirmed delegated ruling stores the pick of Larry with delegated true; the output, the event and the artifact say so', async () => {
  const run = mkRun({ pos: ONE });
  const roomDbMod = require(path.join(ROOT, 'lib', 'core', 'room-db.cjs'));
  roomDbMod.closeRoomDb(roomDbMod.openRoomDb(run.room));
  const out = await doMerge(run);
  const t = out.tensions[0];
  const r = doRule(run, [{ tension_id: t.id, ruling: 'delegated', larry_pick: 'both_hold', navigator_confirmed: true, reason: 'The navigator said: Larry decides; then yes.' }]);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.recorded, [{ tension_id: t.id, ruling: 'both_hold', side_hat: null, delegated: true }]);
  const store = readStore(run.room);
  assert.equal(store.schema, 'mos.persona-tension-rulings/2');
  const e = store.rulings[t.id];
  assert.equal(e.ruling, 'both_hold');
  assert.equal(e.delegated, true);
  assert.deepEqual(Object.keys(e).sort(), ['delegated', 'lines', 'pair', 'reason', 'ruled_at', 'ruling', 'run_id', 'sub_question_text']);
  assert.equal(door.readRulingsStore(run.room).ok, true, 'a store with a delegated entry is valid');
  const lt = run.ledger().tensions.find(x => x.id === t.id);
  assert.equal(lt.state, 'settled');
  assert.equal(lt.ruling, 'both_hold');
  assert.equal(lt.delegated, true);
  assert.equal(r.memory_event.state, 'logged');
  const ev = roomDbEvents(run.room);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].props.delegated, true);
  assert.equal(ev[0].props.ruling, 'both_hold');
  assert.equal(ev[0].props.dedupe_key, 'persona-ruling:' + t.id + ':both_hold:delegated');
  const lines = readArtifact(run).split('\n').map(l => l.trimEnd());
  const at = lines.indexOf('## Rulings');
  assert.deepEqual(lines.slice(at + 1).filter(l => l !== ''), ['tension id: ' + t.id, 'ruling: both_hold', 'side hat: none', 'delegated to Larry: yes', 'ruled on: 2026-11-25']);
});

check('G21. 400.2.1 S6 NEGATIVE: no store write without the navigator: an unconfirmed delegated ruling and every bad larry_pick are refused', async () => {
  const run = mkRun({ pos: ONE });
  const out = await doMerge(run);
  const t = out.tensions[0];
  assert.deepEqual(doRule(run, [{ tension_id: t.id, ruling: 'delegated', larry_pick: 'side_a' }]), { ok: false, reason: 'delegated_not_confirmed' }, 'Larry alone cannot store a ruling');
  assert.deepEqual(doRule(run, [{ tension_id: t.id, ruling: 'delegated', larry_pick: 'side_a', navigator_confirmed: false }]), { ok: false, reason: 'schema_invalid:rulings.0.navigator_confirmed' });
  assert.deepEqual(doRule(run, [{ tension_id: t.id, ruling: 'delegated', navigator_confirmed: true }]), { ok: false, reason: 'schema_invalid:rulings.0.larry_pick' });
  assert.deepEqual(doRule(run, [{ tension_id: t.id, ruling: 'delegated', larry_pick: 'defer', navigator_confirmed: true }]), { ok: false, reason: 'schema_invalid:rulings.0.larry_pick' });
  assert.deepEqual(doRule(run, [{ tension_id: t.id, ruling: 'side_a', larry_pick: 'side_b' }]), { ok: false, reason: 'schema_invalid:rulings.0.larry_pick' });
  assert.deepEqual(doRule(run, [{ tension_id: t.id, ruling: 'defer', reopen: true, larry_pick: 'nonsense' }]), { ok: false, reason: 'schema_invalid:rulings.0.larry_pick' }, 'a present larry_pick is always checked');
  assert.deepEqual(doRule(run, [{ tension_id: t.id, ruling: 'side_a', navigator_confirmed: true }]), { ok: false, reason: 'schema_invalid:rulings.0.navigator_confirmed' });
  assert.equal(fs.existsSync(storePath(run.room)), false, 'a refused answer stores nothing');
  const r = doRule(run, [{ tension_id: t.id, ruling: 'delegated', larry_pick: 'side_a', navigator_confirmed: true }]);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.recorded, [{ tension_id: t.id, ruling: 'side_a', side_hat: 'black', delegated: true }]);
});

check('G22. 400.2.1 S6: a later run renders a delegated settled tension with "(delegated to Larry)"; reopen drops the flag; a schema 1 store still reads, and a schema 1 store with delegated is refused', async () => {
  const room = makeRoom();
  const a = mkRun({ room, pos: ONE });
  const outA = await doMerge(a);
  const id = outA.tensions[0].id;
  assert.equal(doRule(a, [{ tension_id: id, ruling: 'delegated', larry_pick: 'side_b', navigator_confirmed: true }]).ok, true);
  const b = mkRun({ room, pos: ONE, now: LATER });
  const outB = await doMerge(b);
  assert.ok(outB.ok, JSON.stringify(outB));
  const tb = b.ledger().tensions.find(x => x.id === id);
  assert.equal(tb.state, 'settled');
  assert.equal(tb.delegated, true);
  const art = readArtifact(b).split('\n').map(l => l.trimEnd());
  assert.ok(art.includes('settled on 2026-11-25: side_b (delegated to Larry)'), art.join('\n'));
  assert.equal(door.ARTIFACT_LABELS.settled_on_delegated, 'settled on {date}: {ruling} (delegated to Larry)');
  const re = doRule(b, [{ tension_id: id, ruling: 'defer', reopen: true }]);
  assert.equal(re.ok, true, JSON.stringify(re));
  assert.equal('delegated' in b.ledger().tensions.find(x => x.id === id), false);
  assert.equal(readArtifact(b).includes('(delegated to Larry)'), false, 'reopen drops the settled line');
  // Read compatibility: a schema 1 store (written by beta.92) is valid; the next write upgrades it to schema 2.
  const st = readStore(room);
  st.schema = 'mos.persona-tension-rulings/1';
  fs.writeFileSync(storePath(room), JSON.stringify(st), 'utf8');
  assert.equal(door.readRulingsStore(room).ok, true);
  assert.equal(doRule(b, [{ tension_id: id, ruling: 'delegated', larry_pick: 'side_a', navigator_confirmed: true }]).ok, true);
  assert.equal(readStore(room).schema, 'mos.persona-tension-rulings/2');
  const st2 = readStore(room);
  st2.schema = 'mos.persona-tension-rulings/1';
  fs.writeFileSync(storePath(room), JSON.stringify(st2), 'utf8');
  assert.deepEqual(door.readRulingsStore(room), { ok: false, reason: 'rulings_store_invalid' }, 'schema 1 has no delegated key');
  st2.schema = 'mos.persona-tension-rulings/2';
  st2.rulings[id].delegated = false;
  fs.writeFileSync(storePath(room), JSON.stringify(st2), 'utf8');
  assert.deepEqual(door.readRulingsStore(room), { ok: false, reason: 'rulings_store_invalid' }, 'delegated is always true when present');
});

(async () => {
  for (const t of queue) {
    try {
      await t.fn();
      passed += 1;
      console.log('ok: ' + t.label);
    } catch (e) {
      failed += 1;
      console.log('FAIL: ' + t.label + ' -- ' + (e && e.message ? e.message : String(e)));
    }
  }
  for (const d of tmpRoots) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* ignore */ }
  }
  console.log(passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
