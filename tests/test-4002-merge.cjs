#!/usr/bin/env node
'use strict';
// Phase 400.2-08: the merge step of the door (scripts/persona-hats.cjs cmdMerge).
// Legs M1 to M10 (task 1: positions, tensions, same-position lines, run record) and
// M11 to M16 (task 2: the review artifact, the notices, the session log); M17 and M18 are extra legs (router, counts file); plan 13 adds M19 to M21.
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
  // The research step seals the packs it writes (plan 11); this helper stands in for that step.
  const sealed = door.sealRunPacks({ roomDir: run.room, runId: run.res.run_id }, run.env.opts());
  assert.equal(sealed.ok, true, JSON.stringify(sealed));
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

// ---------------------------------------------------------------------------
// Task 2: the review artifact
// ---------------------------------------------------------------------------

const FULL_POS = {
  white: ['favours', 'opposes'], red: ['favours', 'no_position'], black: ['opposes', 'opposes'],
  yellow: ['favours', 'favours'], green: ['alternative_offered', 'no_position'],
};

check('M11. the artifact starts with the deep notice; four hats not planned give the research line', async () => {
  const run = mkRun({ pos: FULL_POS });
  const out = await doMerge(run);
  assert.equal(out.ok, true, JSON.stringify(out));
  const lines = artifactLines(out);
  assert.equal(lines[0], ops.DEEP_NOTICE);
  assert.equal(lines[1], 'Research not run for: white (no_valid_handle), black (no_valid_handle), yellow (no_valid_handle), green (no_valid_handle).');
  assert.deepEqual(out.notice_lines.slice(0, 2), lines.slice(0, 2));
  assert.equal(Object.keys(out)[1], 'notice_lines');
  assert.deepEqual(door.deepNoticeLines(run.ledger()), out.notice_lines);
});

check('M12. the section order is fixed and black is first under each sub-question of the dissent register', async () => {
  const run = mkRun({ pos: FULL_POS });
  const out = await doMerge(run);
  const lines = artifactLines(out).map(l => l.trimEnd());
  const L = door.ARTIFACT_LABELS;
  const at = (label) => {
    const i = lines.indexOf(label);
    assert.ok(i >= 0, 'missing section ' + label);
    return i;
  };
  const order = [L.section_brief, L.section_dissent, L.section_tensions, L.section_same, L.section_not_run, L.section_rules, L.section_lists, L.section_sources].map(at);
  assert.deepEqual(order, order.slice().sort((a, b) => a - b));
  const dis = at(L.section_dissent);
  const end = at(L.section_tensions);
  const subs = lines.map((l, i) => ({ l, i })).filter(x => x.i > dis && x.i < end && x.l.indexOf('### ') === 0);
  assert.equal(subs.length, 2);
  for (const s of subs) assert.equal(lines[s.i + 1].indexOf('black '), 0, lines[s.i + 1]);
});

// The strings of the input files. Call before merge: merge deletes the scratch directories.
function inputStrings(run) {
  const set = new Set(['true', 'false', 'unknown']);
  const add = (v) => {
    if (typeof v === 'string') set.add(v.replace(/[\x00-\x1f\x7f]+/g, ' ').trim());
    else if (Array.isArray(v)) v.forEach(add);
    else if (v && typeof v === 'object') Object.values(v).forEach(add);
    else if (typeof v === 'boolean') set.add(String(v));
  };
  for (const h of HATS) {
    set.add(h);
    for (const name of ['reading.json', 'evidence.json', 'shared-white.json']) {
      const p = path.join(run.res.hats[h].dir, name);
      if (fs.existsSync(p)) add(JSON.parse(fs.readFileSync(p, 'utf8')));
    }
  }
  const ledger = run.ledger();
  add(ledger.hats);
  add(ledger.target);
  add(ledger.brief.governing_question);
  add(ledger.sub_questions);
  return { set, add };
}

function expandedLabels() {
  const values = ['favours', 'opposes', 'mixed', 'no_position', 'alternative_offered'];
  const out = [];
  for (const v of Object.values(door.ARTIFACT_LABELS)) {
    let variants = [v];
    if (v.includes('{hat}')) variants = HATS.map(h => v.split('{hat}').join(h));
    for (const x of variants) {
      if (x.includes('{value}')) for (const val of values) out.push(x.split('{value}').join(val).trimEnd());
      else out.push(x.trimEnd());
    }
  }
  return out.filter(x => x.length > 0).sort((a, b) => b.length - a.length);
}

check('M13. adds nothing: every line is a fixed label or a label and one field of the inputs', async () => {
  const run = mkRun({
    pos: FULL_POS,
    packs: { black: [packItem(1)] },
    readingOver: { black: { self_search_strings: ['retainer failure cases'], self_found_sources: [{ url: 'https://example.org/b', title: 'B title', search_string: 'retainer failure cases', summary: 'B summary.' }] } },
  });
  const inputs = inputStrings(run);
  const out = await doMerge(run);
  assert.equal(out.ok, true, JSON.stringify(out));
  const allowed = inputs.set;
  inputs.add(run.ledger().hats);
  inputs.add(run.ledger().tensions);
  const labels = expandedLabels();
  const notice = new Set(door.deepNoticeLines(run.ledger()));
  const hatSet = new Set(HATS);
  const bad = [];
  for (const raw of artifactLines(out)) {
    const line = raw.trimEnd();
    if (line === '') continue;
    if (notice.has(line)) continue;
    if (labels.includes(line)) continue;
    let ok = false;
    for (const lab of labels) {
      if (line.indexOf(lab) !== 0) continue;
      const rest = line.slice(lab.length).trim();
      if (rest === '' || allowed.has(rest) || rest.split(', ').every(p => hatSet.has(p)) || rest.split(' and ').every(p => hatSet.has(p))) { ok = true; break; }
    }
    if (!ok) bad.push(line);
  }
  assert.deepEqual(bad, []);
  const text = fs.readFileSync(out.artifact, 'utf8');
  assert.ok(text.includes('https://example.org/item1'));
  assert.ok(text.includes('openalex'));
  assert.ok(text.includes('https://example.org/b'));
});

check('M14. the three-pair line is present once; the Blue rule line is present only when Blue ran', async () => {
  const run = mkRun({ pos: FULL_POS });
  const out = await doMerge(run);
  const text = fs.readFileSync(out.artifact, 'utf8');
  const three = 'The tension map knows three hat pairs: yellow and black, green and black, red and white. Opposite positions of any other pair are shown in the dissent register only.';
  assert.equal(text.split(three).length - 1, 1);
  const blue = 'Blue is checked against the owner rule, not against the debate judge rule.';
  assert.equal(text.split(blue).length - 1, 1);
  const run2 = mkRun({ pos: FULL_POS, noBlue: true });
  const out2 = await doMerge(run2);
  assert.equal(fs.readFileSync(out2.artifact, 'utf8').includes(blue), false);
});

check('M15. self-found sources and reported strings get their fixed labels; the prompt-rule line follows the strings', async () => {
  const strings = ['retainer churn studies', 'agency retainer pricing', 'studio hand-off failure'];
  const found = [
    { url: 'https://example.org/one', title: 'First source', search_string: strings[0], summary: 'First summary.' },
    { url: 'https://example.org/two', title: 'Second source', search_string: strings[1], summary: 'Second summary.' },
  ];
  const run = mkRun({ pos: FULL_POS, readingOver: { black: { self_search_strings: strings, self_found_sources: found } } });
  const out = await doMerge(run);
  assert.equal(out.ok, true, JSON.stringify(out));
  const lines = artifactLines(out).map(l => l.trimEnd());
  const L = door.ARTIFACT_LABELS;
  assert.equal(L.found_by_hat, 'Found by the hat, not approved on a card, not wired to the room graph:');
  assert.equal(L.reported_strings, 'Search strings the hat reports it sent (not approved on a card):');
  const iFound = lines.indexOf(L.found_by_hat);
  const iStr = lines.indexOf(L.reported_strings);
  assert.ok(iFound > 0 && iStr > iFound);
  const between = lines.slice(iFound + 1, iStr);
  for (const f of found) {
    assert.ok(between.some(l => l.endsWith(f.url)), f.url);
    assert.ok(between.some(l => l.endsWith(f.title)), f.title);
    assert.ok(between.some(l => l.endsWith(f.search_string)), f.search_string);
    assert.ok(between.some(l => l.endsWith(f.summary)), f.summary);
  }
  // Phase 400.2.1 (S5): the run armed the reader search screen, so the line names the screen, not the prompt rule.
  assert.equal(run.ledger().reader_search_screen, 'armed');
  const rule = "A hat's own searches passed the reader search screen of the door before they left the machine. The screen blocks room words; it cannot catch a figure or a detail with no screened word.";
  assert.equal(L.reader_screen_rule, rule);
  assert.equal(lines.includes(L.prompt_rule), false, 'the prompt-rule line is for a run with no armed screen');
  const after = lines.slice(iStr + 1);
  for (const s of strings) assert.ok(after.some(l => l.endsWith(s)), s);
  assert.equal(lines.filter(l => l === rule).length, 1);
  assert.ok(lines.indexOf(rule) > iStr);
  const rec = run.ledger();
  assert.deepEqual(rec.hats.black.self_search_strings, strings);
  assert.equal(rec.hats.black.self_found_sources, 2);

  const quiet = mkRun({ pos: FULL_POS });
  const out2 = await doMerge(quiet);
  const text2 = fs.readFileSync(out2.artifact, 'utf8');
  assert.equal(text2.includes(rule), false);
  assert.equal(text2.includes(L.found_by_hat), false);
});

check('M16. readings are copied, the artifact has the run folder name, and each hat with position lines gets a session log entry', async () => {
  const run = mkRun({ pos: FULL_POS });
  const fpBefore = ops.roomArtifactIndex(run.room).fingerprint;
  const out = await doMerge(run);
  assert.equal(out.ok, true, JSON.stringify(out));
  // The filed review is not an input of the room fingerprint, so the six personas stay fresh after a run.
  assert.equal(ops.roomArtifactIndex(run.room).fingerprint, fpBefore);
  for (const h of HATS) assert.equal(ops.personaFreshness(run.room).hats[h].state, 'fresh', h);
  assert.equal(out.artifact, path.join(run.res.review_dir, path.basename(run.res.review_dir) + '.md'));
  for (const h of HATS) {
    const copy = path.join(run.res.review_dir, 'readings', h + '.json');
    assert.equal(fs.existsSync(copy), true, h);
  }
  const logOf = (hat) => {
    const dir = path.join(run.room, '.mindrian', 'hats', hat, 'session-log');
    if (!fs.existsSync(dir)) return null;
    return fs.readdirSync(dir).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  };
  const section = (text, from, to) => {
    const a = text.indexOf(from);
    const b = text.indexOf(to, a);
    return text.slice(a + from.length, b).split('\n').map(s => s.trim()).filter(Boolean);
  };
  for (const h of READ_HATS) {
    const text = logOf(h);
    assert.ok(text, 'log of ' + h);
    const expected = FULL_POS[h].map((v, i) => (v === 'no_position' ? null : '- ' + lineOf(h, i))).filter(Boolean);
    assert.deepEqual(section(text, '### Findings', '### Concerns'), expected, h);
    assert.deepEqual(section(text, '### Concerns', '### Opportunities'), [], h);
    assert.deepEqual(section(text, '### Opportunities', '---'), [], h);
    assert.ok(text.includes('**Focus:** room'));
  }
  assert.equal(logOf('blue'), null);
  assert.deepEqual(Object.keys(out.session_log).sort(), READ_HATS.slice().sort());
});

check('M17. the router runs merge as a subcommand, waits for the tension call and prints one JSON object', async () => {
  const { spawnSync } = require('node:child_process');
  const run = mkRun({ pos: { yellow: ['favours', 'favours'], black: ['opposes', 'favours'] } });
  const env2 = Object.assign({}, process.env, { MINDRIAN_HOME: run.env.homeDir });
  const usage = spawnSync(process.execPath, [DOOR_PATH, 'merge', '--room', run.room], { env: env2, encoding: 'utf8' });
  assert.equal(usage.status, 2);
  const countsPath = writeCounts(run, { agent_runs: 8, stops: 3, cards: 4 });
  const res = spawnSync(process.execPath, [DOOR_PATH, 'merge', '--room', run.room, '--run', run.res.run_id, '--counts', countsPath], { env: env2, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.ok, true, res.stdout);
  assert.equal(parsed.tensions.length, 1);
  assert.equal(parsed.cleanup, 'done');
  assert.equal(run.ledger().audit.agent_runs, 8);
});

check('M18. NEGATIVE: a counts file with an unknown key or a bad number is refused before anything is written', async () => {
  const run = mkRun({ pos: { yellow: ['favours', 'favours'] } });
  const before = run.ledger();
  for (const bad of [{ agent_runs: 1, stops: 1, cards: 1, extra: 1 }, { agent_runs: -1, stops: 1, cards: 1 }, { agent_runs: 1, stops: 'x', cards: 1 }, { agent_runs: 1, stops: 1 }]) {
    const out = await doMerge(run, bad);
    assert.equal(out.ok, false);
    assert.ok(/^counts_invalid:/.test(out.reason), out.reason);
  }
  assert.deepEqual(run.ledger(), before);
  assert.equal(fs.existsSync(run.res.hats.white.dir), true);
  // No counts file at all: the audit says so and does not claim the command reported.
  const out = await door.cmdMerge({ roomDir: run.room, runId: run.res.run_id }, run.env.opts());
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(run.ledger().audit.reported_by, 'not_reported');
  assert.equal(run.ledger().audit.agent_runs, null);
});

// ---------------------------------------------------------------------------
// Plan 13: the artifact, the notices and the Blue ledger against real research packs (real run-research)
// The plan names these legs M17 to M19; M17 and M18 are taken by plan 08 (router, counts file), so they are M19 to M21.
// ---------------------------------------------------------------------------

const fx = require(path.join(__dirname, 'fixtures', 'persona-run-4002.cjs'));

/** Write the five readings and the Blue reading, check, merge. */
async function finish(ctx, over) {
  const o = over || {};
  for (const h of fx.READ_HATS) fx.writeReading(ctx, h, fx.readingOf(ctx, h, o[h]));
  fx.writeReading(ctx, 'blue', fx.blueReadingOf(ctx));
  const c = fx.doCheck(ctx);
  assert.equal(c.ok, true, JSON.stringify(c));
  const m = await fx.doMerge(ctx);
  assert.equal(m.ok, true, JSON.stringify(m));
  return { check: c, merge: m, lines: fs.readFileSync(m.artifact, 'utf8').split('\n') };
}

/** The lines of the section "Sources by hat", split by hat heading. */
function sourceSections(lines) {
  const from = lines.indexOf('## Sources by hat');
  assert.ok(from >= 0, 'the sources section exists');
  let to = lines.length;
  for (let i = from + 1; i < lines.length; i += 1) { if (lines[i].startsWith('## ')) { to = i; break; } }
  const out = {};
  let hat = null;
  for (const l of lines.slice(from + 1, to)) {
    if (l.startsWith('### ')) { hat = l.slice(4); out[hat] = []; } else if (hat) out[hat].push(l);
  }
  return out;
}

check('M19. the sources by hat lists each door item with id, title, URL, tier, provider and cache mark from its pack; the run record counts equal the pack items', async () => {
  await fx.withEnvAsync(fx.NO_KEYS, async () => {
    const { ctx } = await fx.researched();
    const packs = {};
    for (const h of fx.RESEARCH) packs[h] = fx.packOf(ctx, h);
    const { lines } = await finish(ctx);
    const sections = sourceSections(lines);
    assert.deepEqual(Object.keys(sections), fx.RESEARCH);
    for (const h of fx.RESEARCH) {
      assert.ok(packs[h].items.length >= 1, h);
      const want = [];
      for (const it of packs[h].items) {
        want.push('id: ' + it.id, 'title: ' + it.title, 'url: ' + it.url, 'tier: ' + it.tier, 'provider: ' + it.provider);
      }
      const got = sections[h].filter(l => /^(id|title|url|tier|provider): /.test(l));
      assert.deepEqual(got, want, h);
      const marks = sections[h].filter(l => l.startsWith('cache_hit: '));
      assert.equal(marks.length, packs[h].items.length, h);
      for (const m of marks) assert.ok(m === 'cache_hit: true' || m === 'cache_hit: false', h + ' ' + m);
    }
    const ledger = fx.ledgerOf(ctx);
    for (const h of fx.RESEARCH) assert.equal(ledger.sources[h], packs[h].items.length, h);
    assert.equal(ledger.sources.red, 0);
    assert.equal(ledger.sources.blue, 0);
    // The White package is listed once, under white; the copies in the other directories add no line.
    const whiteIds = new Set(packs.white.items.map(i => i.id));
    for (const h of ['black', 'yellow', 'green']) {
      for (const l of sections[h]) if (l.startsWith('id: ')) assert.equal(whiteIds.has(l.slice(4)), false, h);
    }
  });
});

check('M20. the notice names each hat whose research was declined or failed with the stored reason; with White declined the White package is empty', async () => {
  await fx.withEnvAsync(fx.NO_KEYS, async () => {
    const ctx = fx.planned();
    const blackTexts = ctx.plan.hats.black.strings.map(s => s.text);
    const seam = fx.makeSeam((a) => (blackTexts.includes(a.query) ? fx.failEnv(a.source, 'http_error') : null));
    const hats = Object.assign(fx.approveAll(ctx.plan, ['yellow']), { yellow: { decision: 'refuse', q_hashes: [], providers: [] } });
    const out = await fx.go(ctx, fx.approvedFile(ctx, hats), seam);
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.equal(out.hats.yellow, 'declined');
    assert.equal(out.hats.black, 'failed');
    const done = await finish(ctx);
    assert.ok(done.lines.includes('Research not run for: yellow (declined).'), done.lines.slice(0, 6).join(' | '));
    assert.ok(done.lines.includes('Research failed for: black (provider_failed:http_error).'), done.lines.slice(0, 6).join(' | '));
    assert.ok(done.merge.notice_lines.includes('Research not run for: yellow (declined).'));
    assert.ok(done.merge.notice_lines.includes('Research failed for: black (provider_failed:http_error).'));
    assert.equal(done.lines.filter(l => l.startsWith('Research not run for')).length, 1);

    // White declined: the line names white and the shared package has zero items.
    const ctx2 = fx.planned();
    const hats2 = Object.assign(fx.approveAll(ctx2.plan, ['white']), { white: { decision: 'refuse', q_hashes: [], providers: [] } });
    const out2 = await fx.go(ctx2, fx.approvedFile(ctx2, hats2), fx.makeSeam());
    assert.equal(out2.ok, true, JSON.stringify(out2));
    // The merge deletes the scratch tree, so the packs are read before it.
    for (const h of fx.READ_HATS) assert.equal(fx.packOf(ctx2, h, 'shared-white.json').items.length, 0, h);
    assert.equal(fx.packOf(ctx2, 'white').research_state, 'declined');
    const done2 = await finish(ctx2);
    assert.ok(done2.lines.includes('Research not run for: white (declined).'), done2.lines.slice(0, 6).join(' | '));
    assert.equal(fx.ledgerOf(ctx2).sources.white, 0);
  });
});

check('M21. the Blue ledger counts the approved and refused strings from the plan and the approved file, and the door items of each hat from its pack', async () => {
  await fx.withEnvAsync(fx.NO_KEYS, async () => {
    const ctx = fx.planned();
    const hats = Object.assign(fx.approveAll(ctx.plan, ['yellow']), { yellow: { decision: 'refuse', q_hashes: [], providers: [] } });
    const out = await fx.go(ctx, fx.approvedFile(ctx, hats), fx.makeSeam());
    assert.equal(out.ok, true, JSON.stringify(out));
    // 3 approved hats with 2 strings each, plus the nature string of green (PS-09): 7.
    assert.deepEqual(out.counts, { strings_approved: 7, strings_refused: 2 });
    for (const h of fx.READ_HATS) fx.writeReading(ctx, h, fx.readingOf(ctx, h));
    const c = fx.doCheck(ctx);
    assert.equal(c.ok, true, JSON.stringify(c));
    const blue = JSON.parse(fs.readFileSync(c.blue_ledger, 'utf8'));
    assert.equal(blue.strings_approved, 7);
    assert.equal(blue.strings_refused, 2);
    for (const h of fx.RESEARCH) assert.equal(blue.hats[h].door_items, fx.packOf(ctx, h).items.length, h);
    assert.equal(blue.hats.yellow.door_items, 0);
    assert.equal(blue.hats.yellow.research, 'declined');
    assert.ok(blue.hats.white.door_items >= 1);
    assert.equal(blue.hats.red.door_items, 0);
    assert.equal(blue.hats.blue.door_items, 0);
    // The reading evidence count stays what the reading holds: these readings cite nothing.
    assert.equal(blue.hats.white.evidence_items, 0);
    // Counts and state names only.
    (function walk(v, key) {
      if (typeof v === 'string') assert.ok(v.length <= 60 && !v.includes('http'), key);
      else if (typeof v === 'number') assert.ok(Number.isInteger(v) && v >= 0, key);
      else if (v && typeof v === 'object') for (const k of Object.keys(v)) walk(v[k], k);
    })(blue, 'root');
  });
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
  fx.cleanup();
  for (const d of tmpRoots) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* ignore */ }
  }
  console.log(passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
