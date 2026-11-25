#!/usr/bin/env node
'use strict';
// Phase 400.2-08: the merge step of the door (scripts/persona-hats.cjs cmdMerge).
// Legs M1 to M10 (task 1: positions, tensions, same-position lines, run record) and
// M11 to M16 (task 2: the review artifact, the notices, the session log); M17 and M18 are extra legs (router, counts file).
// Every leg passes homeDir, tmpDir, now and randomHex as options. No test sends a network request.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const DOOR_PATH = path.join(ROOT, 'scripts', 'persona-hats.cjs');
const ops = require(path.join(ROOT, 'lib', 'core', 'persona-ops.cjs'));

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
const tmpRoots = [];

function mkTmp(label) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-4002-merge-' + label + '-'));
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

// over.room: reuse a room; over.now: a Date for the run id; over.refuse: hats whose persona is refused;
// over.pos: {hat: [value for sub-question 0, value for sub-question 1]}; a hat that is absent reads no_position;
// over.skip: hats that get no reading file; over.readingOver: {hat: extra keys}; over.packs: {hat: pack items};
// over.noCheck: stop before check; over.noBlue: write no Blue reading.
function mkRun(over) {
  const o = over || {};
  const room = o.room || makeRoom();
  const env = makeEnv(o.now);
  const bp = path.join(mkTmp('brief'), 'brief.json');
  fs.writeFileSync(bp, JSON.stringify({
    schema: 'mos.persona-brief/1', target: 'room',
    governing_question: 'Should the studio move to a fixed monthly retainer model for new clients?',
    sub_questions: ['Who pays first?', 'What breaks at the hand-off?'],
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
    for (const h of toDo) answer[h] = { decision: (o.refuse || []).includes(h) ? 'refuse' : 'accept' };
    const ap = path.join(mkTmp('answer'), 'answer.json');
    fs.writeFileSync(ap, JSON.stringify({ schema: 'mos.persona-accept/1', run_id: res.run_id, hats: answer }), 'utf8');
    const a = door.cmdAcceptPersona({ roomDir: room, runId: res.run_id, answerPath: ap }, env.opts());
    assert.equal(a.ok && a.accept_done, true, JSON.stringify(a));
  }
  const p = door.cmdPlanResearch({ roomDir: room, runId: res.run_id }, env.opts());
  assert.equal(p.ok, true, JSON.stringify(p));
  const ledger = () => JSON.parse(fs.readFileSync(path.join(res.review_dir, 'run.json'), 'utf8'));
  const run = { room, env, res, ids: ledger().sub_questions.map(s => s.id), ledger };
  for (const [hat, items] of Object.entries(o.packs || {})) writePack(run, hat, items);
  const pos = o.pos || {};
  for (const hat of READ_HATS) {
    if ((o.skip || []).includes(hat)) continue;
    writeReading(run, hat, readingOf(run, hat, pos[hat], (o.readingOver || {})[hat]));
  }
  if (!o.noBlue && !(o.skip || []).includes('blue')) writeReading(run, 'blue', blueReading(run));
  if (!o.noCheck) {
    const c = door.cmdCheck({ roomDir: room, runId: res.run_id }, env.opts());
    assert.equal(c.ok, true, JSON.stringify(c));
  }
  return run;
}

function lineOf(hat, i) {
  return hat + ' line ' + i;
}

function readingOf(run, hat, values, over) {
  const base = { schema: 'mos.persona-reading/1', run_id: run.res.run_id, hat };
  base.positions = run.ids.map((id, i) => {
    const value = values && values[i] ? values[i] : 'no_position';
    const p = { sub_question: id, value };
    if (value !== 'no_position') p.line = lineOf(hat, i);
    return p;
  });
  if (hat === 'white') Object.assign(base, { evidence: [], missing_data: ['The price of rival plans.'] });
  if (hat === 'black') Object.assign(base, { evidence: [], steelman: 'The best case.' });
  if (hat === 'yellow') Object.assign(base, { evidence: [], none_found: false });
  if (hat === 'green') Object.assign(base, { provocations: ['What if the client owns the hand-off?'], evidence: [] });
  return Object.assign(base, over || {});
}

function blueReading(run, over) {
  return Object.assign({ schema: 'mos.persona-reading/1', run_id: run.res.run_id, hat: 'blue', skipped: ['No search was run for green.'], thin: ['The red hat gave only short lines.'], ask_next: ['Ask who pays first.'] }, over || {});
}

function writeReading(run, hat, obj) {
  fs.writeFileSync(path.join(run.res.hats[hat].dir, 'reading.json'), typeof obj === 'string' ? obj : JSON.stringify(obj), 'utf8');
}

// A door evidence pack (S-5) for a researching hat, with the given items and one string record.
function writePack(run, hat, items) {
  const strings = items.length === 0 ? [] : [{ text: 'a generic handle', q_hash: items[0].q_hash, state: 'ran_with_results', partial: false, providers: [{ provider: items[0].provider, lens: 'scholarly', operation_state: 'executed_with_results', reason: '', items: items.length, cache_hit: true }] }];
  const obj = { schema: 'mos.persona-evidence/1', run_id: run.res.run_id, hat, research_state: items.length ? 'ran_with_results' : 'ran_empty', strings, items };
  fs.writeFileSync(path.join(run.res.hats[hat].dir, 'evidence.json'), JSON.stringify(obj), 'utf8');
}

function packItem(n) {
  return { id: 'EvidenceClaim:s1:item' + n, title: 'Title ' + n, url: 'https://example.org/item' + n, tier: 'T2', provider: 'openalex', summary: 'Summary ' + n + '.', retrieved_at: '2026-11-25T10:00:00Z', q_hash: 'qhash' + n };
}

function writeCounts(run, obj) {
  const p = path.join(run.res.inbox_dir, 'counts.json');
  fs.writeFileSync(p, JSON.stringify(obj || { agent_runs: 7, stops: 3, cards: 4 }), 'utf8');
  return p;
}

async function doMerge(run, counts) {
  return door.cmdMerge({ roomDir: run.room, runId: run.res.run_id, countsPath: writeCounts(run, counts) }, run.env.opts());
}

function artifactLines(out) {
  return fs.readFileSync(out.artifact, 'utf8').split('\n');
}

// ---------------------------------------------------------------------------
// Task 1: positions, tensions, same position, the run record
// ---------------------------------------------------------------------------

check('M1. yellow favours and black opposes on A, no opposition on B: one tension on A, pair [black, yellow]', async () => {
  const run = mkRun({ pos: { yellow: ['favours', 'favours'], black: ['opposes', 'favours'] } });
  const out = await doMerge(run);
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(out.tensions.length, 1, JSON.stringify(out.tensions));
  const t = out.tensions[0];
  assert.equal(t.sub_question, run.ids[0]);
  assert.deepEqual(t.pair, ['black', 'yellow']);
  assert.deepEqual(t.lines, { black: lineOf('black', 0), yellow: lineOf('yellow', 0) });
  assert.equal(t.state, 'open');
  assert.equal(t.id, door.tensionKey(run.ledger().target_content_hash, run.ids[0], ['yellow', 'black']));
  assert.equal(t.id, crypto.createHash('sha256').update([run.ledger().target_content_hash, run.ids[0], 'black+yellow'].join('\n')).digest('hex'));
  assert.deepEqual(run.ledger().tensions, out.tensions);
});

check('M2. yellow favours and black favours: no tension and one same-position entry', async () => {
  const run = mkRun({ pos: { yellow: ['favours'], black: ['favours'] } });
  const out = await doMerge(run);
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.deepEqual(out.tensions, []);
  assert.deepEqual(run.ledger().same_position, [{ sub_question: run.ids[0], value: 'favours', hats: ['black', 'yellow'] }]);
});

check('M3. mixed and no_position keep a hat out of tensions and same-position entries; the line stays in the positions', async () => {
  const run = mkRun({ pos: { yellow: ['mixed'], black: ['opposes'], white: ['mixed'], red: ['mixed'] } });
  const out = await doMerge(run);
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.deepEqual(out.tensions, []);
  const rec = run.ledger();
  assert.deepEqual(rec.same_position, []);
  assert.deepEqual(rec.positions[run.ids[0]].yellow, { value: 'mixed', line: lineOf('yellow', 0) });
  assert.deepEqual(rec.positions[run.ids[0]].green, { value: 'no_position', line: '' });
  assert.deepEqual(rec.positions[run.ids[1]].black, { value: 'no_position', line: '' });
});

check('M4. green alternative_offered and black opposes give one tension; green is never in a same-position entry', async () => {
  const run = mkRun({ pos: { green: ['alternative_offered'], black: ['opposes'], yellow: ['opposes'] } });
  const out = await doMerge(run);
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(out.tensions.length, 1, JSON.stringify(out.tensions));
  assert.deepEqual(out.tensions[0].pair, ['black', 'green']);
  const rec = run.ledger();
  assert.deepEqual(rec.same_position, [{ sub_question: run.ids[0], value: 'opposes', hats: ['black', 'yellow'] }]);
  for (const e of rec.same_position) assert.equal(e.hats.includes('green'), false);
});

check('M5. white opposes and black favours give no tension; both lines are in the positions table', async () => {
  const run = mkRun({ pos: { white: ['opposes'], black: ['favours'] } });
  const out = await doMerge(run);
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.deepEqual(out.tensions, []);
  const rec = run.ledger();
  assert.equal(rec.positions[run.ids[0]].white.line, lineOf('white', 0));
  assert.equal(rec.positions[run.ids[0]].black.line, lineOf('black', 0));
});

check('M6. red favours and white opposes give one tension', async () => {
  const run = mkRun({ pos: { red: ['favours'], white: ['opposes'] } });
  const out = await doMerge(run);
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(out.tensions.length, 1, JSON.stringify(out.tensions));
  assert.deepEqual(out.tensions[0].pair, ['red', 'white']);
});

check('M7. the same fixtures run twice give the same tension ids and the same order', async () => {
  const room = makeRoom();
  const pos = {
    yellow: ['favours', 'favours'], black: ['opposes', 'opposes'], green: ['alternative_offered', 'alternative_offered'],
    red: ['favours', 'opposes'], white: ['opposes', 'favours'],
  };
  const a = mkRun({ room, pos });
  const outA = await doMerge(a);
  const b = mkRun({ room, pos, now: new Date('2026-11-25T10:20:31.000Z') });
  const outB = await doMerge(b);
  assert.equal(outA.ok, true, JSON.stringify(outA));
  assert.equal(outB.ok, true, JSON.stringify(outB));
  assert.equal(outA.tensions.length, 6, JSON.stringify(outA.tensions.map(t => t.pair)));
  assert.deepEqual(outA.tensions.map(t => t.id), outB.tensions.map(t => t.id));
  assert.deepEqual(outA.tensions.map(t => t.pair.join('+')), outB.tensions.map(t => t.pair.join('+')));
  // The order is sub-question first, then the sorted pair.
  const keys = outA.tensions.map(t => a.ids.indexOf(t.sub_question) + ':' + t.pair.join('+'));
  assert.deepEqual(keys, keys.slice().sort());
  assert.equal(new Set(outA.tensions.map(t => t.id)).size, 6);
});

check('M8. NEGATIVE: merge before check is out of order; a reading changed after check is rejected and in no tension', async () => {
  const early = mkRun({ pos: { red: ['favours'], white: ['opposes'] }, noCheck: true });
  const out0 = await doMerge(early);
  assert.deepEqual(out0, { ok: false, reason: 'step_out_of_order:check' });
  assert.equal(early.ledger().steps.merge, undefined);
  assert.equal(fs.existsSync(early.res.hats.white.dir), true);

  const run = mkRun({ pos: { red: ['favours'], white: ['opposes'] } });
  // The check passed. Now the white hat edits its own reading.
  const w = JSON.parse(fs.readFileSync(path.join(run.res.hats.white.dir, 'reading.json'), 'utf8'));
  w.positions[0].line = 'A line that was edited after check.';
  writeReading(run, 'white', w);
  const out = await doMerge(run);
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.deepEqual(out.tensions, []);
  const rec = run.ledger();
  assert.equal(rec.hats.white.reading, 'rejected:changed_after_check');
  assert.equal(rec.positions[run.ids[0]].white, undefined);
  assert.equal(rec.positions[run.ids[0]].red.value, 'favours');
  assert.deepEqual(out.not_run.filter(n => n.hat === 'white'), [{ hat: 'white', reason: 'changed_after_check', state: 'rejected:changed_after_check' }]);
});

check('M9. the run record holds positions, tensions, same_position, sources, audit and merged_at and no score-like key', async () => {
  const run = mkRun({ pos: { yellow: ['favours', 'favours'], black: ['opposes', 'favours'] }, packs: { black: [packItem(1)] } });
  const out = await doMerge(run, { agent_runs: 9, stops: 3, cards: 4 });
  assert.equal(out.ok, true, JSON.stringify(out));
  const rec = run.ledger();
  assert.equal(rec.steps.merge.state, 'done');
  assert.ok(rec.steps.merge.seq > rec.steps.check.seq);
  assert.deepEqual(Object.keys(rec.positions), run.ids);
  assert.deepEqual(rec.tensions.map(t => Object.keys(t).sort()), [['id', 'lines', 'pair', 'state', 'sub_question']]);
  assert.ok(Array.isArray(rec.same_position));
  assert.deepEqual(rec.sources, { white: 0, red: 0, black: 1, yellow: 0, green: 0, blue: 0 });
  assert.deepEqual(rec.audit, { edited_strings: [], cards: 4, stops: 3, agent_runs: 9, reported_by: 'command' });
  assert.equal(rec.timestamps.merged_at, NOW.toISOString());
  assert.equal(rec.timestamps.started_at, NOW.toISOString());
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      for (const k of Object.keys(v)) {
        assert.equal(/score|rank|winner|average|consensus|confidence/i.test(k), false, 'key ' + k);
        walk(v[k]);
      }
    }
  };
  walk(rec);
  const text = JSON.stringify(rec);
  assert.equal(text.includes(run.env.tmpDir), false);
  assert.equal(text.includes('mos-persona-'), false);
});

check('M10. merge confirms nothing: no lens_finding node, and the door source holds no confirm call and no accept hook', async () => {
  const run = mkRun({ pos: { yellow: ['favours', 'favours'], black: ['opposes', 'favours'] } });
  const roomDbMod = require(path.join(ROOT, 'lib', 'core', 'room-db.cjs'));
  roomDbMod.closeRoomDb(roomDbMod.openRoomDb(run.room));
  const out = await doMerge(run);
  assert.equal(out.ok, true, JSON.stringify(out));
  const navigation = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));
  const db = navigation.openRoomDbForCaller(run.room);
  assert.ok(db, 'room.db opens');
  try {
    const n = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'lens_finding'").get().n;
    assert.equal(n, 0);
    // The session log path of hat-persistence writes one HatState bookkeeping node for each hat (session count, system
    // author). It is not a claim. Any other node would be a claim written by merge.
    const others = db.prepare("SELECT id, type FROM nodes WHERE type != 'HatState'").all();
    assert.deepEqual(others, []);
    const hatStates = db.prepare("SELECT created_by FROM nodes WHERE type = 'HatState'").all();
    assert.ok(hatStates.length > 0);
    for (const h of hatStates) assert.equal(h.created_by, 'system');
  } finally {
    navigation.closeRoomDbForCaller(db);
  }
  const src = fs.readFileSync(DOOR_PATH, 'utf8');
  assert.equal(src.includes('confirmNode'), false);
  assert.equal(src.includes('onAccept'), false);
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
