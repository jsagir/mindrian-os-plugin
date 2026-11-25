#!/usr/bin/env node
'use strict';
// Phase 400.2-16: the compare subcommand of the door (scripts/persona-hats.cjs cmdCompare). Legs K1 to K6 (task 2);
// K7 and K8 (task 3) run the recorded comparison on a fixture room. Every leg passes homeDir, tmpDir, now and randomHex
// as options. No test sends a network request: the one fetch of K7 goes through the injected seam _fetchCorpusEnvelope.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const DOOR_PATH = path.join(ROOT, 'scripts', 'persona-hats.cjs');

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
const BASE = new Date('2026-11-25T10:00:00.000Z');
const tmpRoots = [];

function mkTmp(label) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-4002-compare-' + label + '-'));
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

// An environment with a fixed clock: each call gets BASE plus the next step, so a run is the same on every machine.
// The random part of every id comes from a fixed counter that starts again for each call.
function makeEnv(startSeconds) {
  const env = { homeDir: mkTmp('home'), tmpDir: mkTmp('tmp'), step: startSeconds || 0 };
  env.opts = (extra) => {
    env.step += 1;
    let n = 0;
    const at = env.step;
    return Object.assign({
      homeDir: env.homeDir,
      tmpDir: env.tmpDir,
      now: new Date(BASE.getTime() + at * 1000),
      randomHex: (len) => crypto.createHash('sha256').update('compare-seam-' + at + '-' + (n += 1)).digest('hex').slice(0, len),
    }, extra || {});
  };
  return env;
}

const SQ_TEXTS = ['Who pays first?', 'What breaks at the hand-off?'];
function briefOf(over) {
  return Object.assign({
    schema: 'mos.persona-brief/1',
    target: 'room',
    governing_question: 'Should the studio move to a fixed monthly retainer model for new clients?',
    sub_questions: SQ_TEXTS,
    reading_list: ['problem-definition/core-problem.md', 'market-analysis/size.md'],
    mode: 'deep',
    triage: { recommended: 'deep', reason: 'A pricing change.' },
  }, over || {});
}
function writeJson(label, name, obj) {
  const p = path.join(mkTmp(label), name);
  fs.writeFileSync(p, typeof obj === 'string' ? obj : JSON.stringify(obj), 'utf8');
  return p;
}
function validSpec(hat) {
  return { schema: 'mos.persona-spec/1', hat, focus: 'Look at the ' + hat + ' side.', hat_questions: ['What does the room show?', 'What is missing?', 'What would change the view?'], must_not_judge: ['The price level.'], room_sources: ['problem-definition/core-problem.md'] };
}
function ledgerOf(res) {
  return JSON.parse(fs.readFileSync(path.join(res.review_dir, 'run.json'), 'utf8'));
}

// The simple readings of a run with no research: values {hat: [value, ...]}; a hat left out has no position.
function simpleReading(run, hat, values) {
  const base = { schema: 'mos.persona-reading/1', run_id: run.res.run_id, hat };
  base.positions = run.ids.map((id, i) => {
    const value = values && values[i] ? values[i] : 'no_position';
    const p = { sub_question: id, value };
    if (value !== 'no_position') p.line = hat + ' deep line ' + i;
    return p;
  });
  if (hat === 'white') Object.assign(base, { evidence: [], missing_data: ['The price of rival plans.'] });
  if (hat === 'black') Object.assign(base, { evidence: [], steelman: 'The best case.' });
  if (hat === 'yellow') Object.assign(base, { evidence: [], none_found: false });
  if (hat === 'green') Object.assign(base, { provocations: ['What if the client owns the hand-off?'], evidence: [] });
  return base;
}
const BLUE_READING = (runId) => ({ schema: 'mos.persona-reading/1', run_id: runId, hat: 'blue', skipped: ['No search was run for green.'], thin: ['The red hat gave only short lines.'], ask_next: ['Ask who pays first.'] });

/**
 * Build one merged deep run with no research (every researching hat is not planned).
 * o: room, env, brief (over), pos {hat: [value, value]}, counts.
 */
async function mergedDeep(o) {
  const room = o.room || makeRoom();
  const env = o.env || makeEnv();
  const res = door.cmdStart({ roomDir: room, briefPath: writeJson('brief', 'brief.json', briefOf(o.brief)), mode: 'deep' }, env.opts());
  assert.equal(res.ok, true, JSON.stringify(res));
  const todo = res.to_build.concat(res.to_accept);
  if (res.to_build.length > 0) {
    for (const h of res.to_build) fs.writeFileSync(path.join(res.hats[h].dir, 'persona.json'), JSON.stringify(validSpec(h)), 'utf8');
    assert.equal(door.cmdWritePersona({ roomDir: room, runId: res.run_id }, env.opts()).ok, true);
  }
  if (todo.length > 0) {
    const answer = {};
    for (const h of todo) answer[h] = { decision: 'accept' };
    const a = door.cmdAcceptPersona({ roomDir: room, runId: res.run_id, answerPath: writeJson('answer', 'answer.json', { schema: 'mos.persona-accept/1', run_id: res.run_id, hats: answer }) }, env.opts());
    assert.equal(a.ok && a.accept_done, true, JSON.stringify(a));
  }
  const p = door.cmdPlanResearch({ roomDir: room, runId: res.run_id }, env.opts());
  assert.equal(p.ok, true, JSON.stringify(p));
  const run = { room, env, res, ids: ledgerOf(res).sub_questions.map(s => s.id) };
  for (const hat of READ_HATS) fs.writeFileSync(path.join(res.hats[hat].dir, 'reading.json'), JSON.stringify(simpleReading(run, hat, (o.pos || {})[hat])), 'utf8');
  fs.writeFileSync(path.join(res.hats.blue.dir, 'reading.json'), JSON.stringify(BLUE_READING(res.run_id)), 'utf8');
  const c = door.cmdCheck({ roomDir: room, runId: res.run_id }, env.opts());
  assert.equal(c.ok, true, JSON.stringify(c));
  const countsPath = path.join(res.inbox_dir, 'counts.json');
  fs.writeFileSync(countsPath, JSON.stringify(o.counts || { agent_runs: 7, stops: 3, cards: 4 }), 'utf8');
  const m = await door.cmdMerge({ roomDir: room, runId: res.run_id, countsPath }, env.opts());
  assert.equal(m.ok, true, JSON.stringify(m));
  run.merge = m;
  return run;
}

function quickResultOf(run, pos) {
  const hats = {};
  for (const hat of READ_HATS) {
    const vals = (pos && pos[hat]) || [];
    hats[hat] = { positions: run.ids.map((id, i) => (vals[i] && vals[i] !== 'no_position' ? { sub_question: id, value: vals[i], line: hat + ' quick line ' + i } : { sub_question: id, value: 'no_position' })) };
  }
  hats.green.provocations = ['What if the client owns the hand-off?'];
  hats.blue = { skipped: ['No search was run, by design.'] };
  return { schema: 'mos.persona-quick/1', run_id: run.res.run_id, hats };
}

/** Build one merged quick run. o: room, env, brief (over), pos, counts, omit (hats left out of the result). */
async function mergedQuick(o) {
  const room = o.room || makeRoom();
  const env = o.env || makeEnv();
  const brief = briefOf(Object.assign({ mode: 'quick', triage: { recommended: 'quick', reason: 'A fast look.' } }, o.brief || {}));
  const res = door.cmdStart({ roomDir: room, briefPath: writeJson('brief', 'brief.json', brief), mode: 'quick' }, env.opts());
  assert.equal(res.ok, true, JSON.stringify(res));
  const run = { room, env, res, ids: ledgerOf(res).sub_questions.map(s => s.id) };
  const result = quickResultOf(run, o.pos);
  for (const h of o.omit || []) delete result.hats[h];
  const quickResultPath = path.join(res.inbox_dir, 'quick-result.json');
  fs.writeFileSync(quickResultPath, JSON.stringify(result), 'utf8');
  const countsPath = path.join(res.inbox_dir, 'counts.json');
  fs.writeFileSync(countsPath, JSON.stringify(o.counts || { agent_runs: 0, stops: 1, cards: 1 }), 'utf8');
  const m = await door.cmdMerge({ roomDir: room, runId: res.run_id, quickResultPath, countsPath }, env.opts());
  assert.equal(m.ok, true, JSON.stringify(m));
  run.merge = m;
  return run;
}

const DEEP_POS = { black: ['opposes', 'mixed'], yellow: ['favours', 'favours'], white: ['favours', 'no_position'], red: ['mixed', 'no_position'], green: ['alternative_offered', 'no_position'] };
const QUICK_POS = { black: ['opposes', 'opposes'], yellow: ['favours', 'no_position'], white: ['no_position', 'favours'], red: ['favours', 'no_position'] };
const doCompare = (room, deep, quick, env) => door.cmdCompare({ roomDir: room, deepRunId: deep, quickRunId: quick }, (env || makeEnv()).opts());
const compareFile = (run) => path.join(run.res.review_dir, 'compare.md');

check('K1. NEGATIVE: different brief hashes, two deep runs, two quick runs and a run with no merge step are refused; no file is written', async () => {
  const room = makeRoom();
  const env = makeEnv();
  const deep = await mergedDeep({ room, env, pos: DEEP_POS });
  const quick = await mergedQuick({ room, env, pos: QUICK_POS });
  // Another brief: another set of sub-questions.
  const other = await mergedQuick({ room, env, pos: QUICK_POS, brief: { sub_questions: ['Who pays first?', 'What is the price floor?'] } });
  assert.deepEqual(doCompare(room, deep.res.run_id, other.res.run_id, env), { ok: false, reason: 'brief_hash_differs' });
  // Two deep runs and two quick runs of one brief.
  const deep2 = await mergedDeep({ room, env, pos: DEEP_POS });
  const quick2 = await mergedQuick({ room, env, pos: QUICK_POS });
  assert.deepEqual(doCompare(room, deep.res.run_id, deep2.res.run_id, env), { ok: false, reason: 'modes_not_deep_and_quick' });
  assert.deepEqual(doCompare(room, quick.res.run_id, quick2.res.run_id, env), { ok: false, reason: 'modes_not_deep_and_quick' });
  // The arguments in the wrong order are two modes in the wrong place.
  assert.deepEqual(doCompare(room, quick.res.run_id, deep.res.run_id, env), { ok: false, reason: 'modes_not_deep_and_quick' });
  // A run with no merge step: a quick run that was started and not merged.
  const open = door.cmdStart({ roomDir: room, briefPath: writeJson('brief', 'brief.json', briefOf({ mode: 'quick', triage: { recommended: 'quick', reason: 'A fast look.' } })), mode: 'quick' }, env.opts());
  assert.equal(open.ok, true, JSON.stringify(open));
  assert.deepEqual(doCompare(room, deep.res.run_id, open.run_id, env), { ok: false, reason: 'not_merged:' + open.run_id });
  // A run id that does not exist, and a room that does not exist.
  assert.equal(doCompare(room, deep.res.run_id, '20260101-000000-abcd', env).ok, false);
  assert.equal(doCompare(path.join(room, 'missing'), deep.res.run_id, quick.res.run_id, env).reason, 'room_not_found');
  for (const r of [deep, deep2, quick, quick2, other]) assert.equal(fs.existsSync(compareFile(r)), false, 'no compare.md');
  assert.equal(fs.existsSync(path.join(open.review_dir, 'compare.md')), false);
});

check('K2. compare.md has one table for each sub-question with one row for each of the six hats; a hat that did not run says not run', async () => {
  const room = makeRoom();
  const env = makeEnv();
  const deep = await mergedDeep({ room, env, pos: DEEP_POS });
  const quick = await mergedQuick({ room, env, pos: QUICK_POS, omit: ['white'] });
  const out = doCompare(room, deep.res.run_id, quick.res.run_id, env);
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(out.file, compareFile(deep));
  const lines = fs.readFileSync(compareFile(deep), 'utf8').split('\n');
  const dRec = ledgerOf(deep.res);
  const qRec = ledgerOf(quick.res);
  SQ_TEXTS.forEach((sq, qi) => {
    const at = lines.indexOf('### ' + sq);
    assert.ok(at >= 0, 'heading of ' + sq);
    assert.equal(lines[at + 1], '| hat | deep value | deep line | quick value | quick line |');
    const rows = lines.slice(at + 3, at + 9);
    assert.deepEqual(rows.map(r => r.split(' | ')[0].replace(/^\| /, '')), HATS);
    for (const row of rows) assert.ok(/^\|.*\|$/.test(row), row);
    const dId = dRec.sub_questions[qi].id;
    const qId = qRec.sub_questions[qi].id;
    const cells = (hat) => rows.find(r => r.indexOf('| ' + hat + ' |') === 0).slice(1, -1).split(' | ').map(c => c.trim());
    // black ran in both modes: the cells are the values and the lines of the two records.
    const b = cells('black');
    assert.equal(b[1], dRec.positions[dId].black.value);
    assert.equal(b[2], dRec.positions[dId].black.line);
    assert.equal(b[3], qRec.positions[qId].black.value);
    assert.equal(b[4], qRec.positions[qId].black.line);
    // white did not run in quick mode.
    const w = cells('white');
    assert.equal(w[3], 'not run');
    assert.equal(w[4], 'not run');
    assert.notEqual(w[1], 'not run');
    // blue has no position in either mode.
    const bl = cells('blue');
    assert.equal(bl[1], 'not applicable');
    assert.equal(bl[3], 'not applicable');
  });
  // A hat with no_position and no line shows "none" and not an empty cell.
  assert.ok(lines.some(l => l.indexOf('| red | no_position | none |') === 0));
});

check('K3. compare.md holds no word of score, winner, better, worse, wins or diff and no numeric cell', async () => {
  const room = makeRoom();
  const env = makeEnv();
  const deep = await mergedDeep({ room, env, pos: DEEP_POS });
  const quick = await mergedQuick({ room, env, pos: QUICK_POS });
  const out = doCompare(room, deep.res.run_id, quick.res.run_id, env);
  assert.equal(out.ok, true, JSON.stringify(out));
  const text = fs.readFileSync(compareFile(deep), 'utf8');
  for (const line of text.split('\n')) {
    assert.equal(/\b(score|scores|winner|better|worse|wins|diff|differences?)\b/i.test(line), false, line);
  }
  // The output names no verdict key either.
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') for (const k of Object.keys(v)) { assert.equal(/score|rank|winner|better|diff|count_of|delta/i.test(k), false, 'key ' + k); walk(v[k]); }
  };
  walk(out);
  // A table cell is a hat name, a closed value, a line or a fixed word: never a number.
  for (const line of text.split('\n')) {
    if (line.indexOf('|') !== 0 || line.indexOf('---') !== -1 || line.indexOf('| hat |') === 0) continue;
    for (const cell of line.slice(1, -1).split(' | ').map(c => c.trim())) assert.equal(/^[0-9][0-9.,]*$/.test(cell), false, 'numeric cell ' + cell);
  }
  assert.equal(/—|–/.test(text), false, 'no em dash or en dash');
});

check('K4. each mode block shows the counts with the mark reported by the command; the wall time is merged_at minus started_at of that record', async () => {
  const room = makeRoom();
  const env = makeEnv();
  const deep = await mergedDeep({ room, env, pos: DEEP_POS, counts: { agent_runs: 12, stops: 3, cards: 8 } });
  const quick = await mergedQuick({ room, env, pos: QUICK_POS, counts: { agent_runs: 0, stops: 1, cards: 1 } });
  assert.equal(doCompare(room, deep.res.run_id, quick.res.run_id, env).ok, true);
  const lines = fs.readFileSync(compareFile(deep), 'utf8').split('\n');
  const block = (head) => {
    const at = lines.indexOf(head);
    assert.ok(at >= 0, head);
    let end = lines.length;
    for (let i = at + 1; i < lines.length; i += 1) if (lines[i].indexOf('## ') === 0 || lines[i].indexOf('Navigator note:') === 0) { end = i; break; }
    return lines.slice(at + 1, end).filter(l => l !== '');
  };
  const wall = (rec) => String((new Date(rec.timestamps.merged_at).getTime() - new Date(rec.timestamps.started_at).getTime()) / 1000);
  const dRec = ledgerOf(deep.res);
  const qRec = ledgerOf(quick.res);
  const d = block('## Deep run');
  const q = block('## Quick run');
  assert.ok(d.includes('run id: ' + dRec.run_id));
  assert.ok(d.includes('agent runs: 12 (reported by the command)'));
  assert.ok(d.includes('stops: 3 (reported by the command)'));
  assert.ok(d.includes('cards: 8 (reported by the command)'));
  assert.ok(d.includes('wall time: ' + wall(dRec) + ' seconds'));
  assert.ok(d.includes('door evidence items: 0'));
  assert.ok(d.includes('self-found sources: 0'));
  assert.ok(d.includes('hats that ran: white, red, black, yellow, green, blue'));
  assert.ok(q.includes('run id: ' + qRec.run_id));
  assert.ok(q.includes('agent runs: 0 (reported by the command)'));
  assert.ok(q.includes('stops: 1 (reported by the command)'));
  assert.ok(q.includes('cards: 1 (reported by the command)'));
  assert.ok(q.includes('wall time: ' + wall(qRec) + ' seconds'));
  assert.ok(Number(wall(dRec)) > 0);
});

check('K5. the file ends with the empty field "Navigator note:"', async () => {
  const room = makeRoom();
  const env = makeEnv();
  const deep = await mergedDeep({ room, env, pos: DEEP_POS });
  const quick = await mergedQuick({ room, env, pos: QUICK_POS });
  assert.equal(doCompare(room, deep.res.run_id, quick.res.run_id, env).ok, true);
  const text = fs.readFileSync(compareFile(deep), 'utf8');
  assert.ok(text.endsWith('\nNavigator note:\n'), JSON.stringify(text.slice(-40)));
  assert.equal(text.split('Navigator note:').length - 1, 1);
});

check('K6. compare writes only compare.md in the deep run folder; both run records are byte-equal; the router runs it; the usage names ten subcommands', async () => {
  const room = makeRoom();
  const env = makeEnv();
  const deep = await mergedDeep({ room, env, pos: DEEP_POS });
  const quick = await mergedQuick({ room, env, pos: QUICK_POS });
  const snap = () => {
    const out = {};
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const abs = path.join(d, e.name);
        if (e.isDirectory()) walk(abs); else out[path.relative(room, abs)] = fs.readFileSync(abs).toString('base64');
      }
    };
    walk(room);
    return out;
  };
  const before = snap();
  const dBytes = fs.readFileSync(path.join(deep.res.review_dir, 'run.json'));
  const qBytes = fs.readFileSync(path.join(quick.res.review_dir, 'run.json'));
  const out = doCompare(room, deep.res.run_id, quick.res.run_id, env);
  assert.equal(out.ok, true, JSON.stringify(out));
  const after = snap();
  assert.deepEqual(Object.keys(after).filter(k => !(k in before)), [path.relative(room, compareFile(deep))]);
  for (const k of Object.keys(before)) assert.equal(after[k], before[k], 'unchanged ' + k);
  assert.deepEqual(fs.readFileSync(path.join(deep.res.review_dir, 'run.json')), dBytes);
  assert.deepEqual(fs.readFileSync(path.join(quick.res.review_dir, 'run.json')), qBytes);
  const first = fs.readFileSync(compareFile(deep));
  assert.equal(doCompare(room, deep.res.run_id, quick.res.run_id, env).ok, true);
  assert.deepEqual(fs.readFileSync(compareFile(deep)), first);
  assert.deepEqual(fs.readdirSync(deep.res.review_dir).filter(n => n.endsWith('.tmp')), []);
  const cp = require('node:child_process');
  const cli = cp.spawnSync(process.execPath, [DOOR_PATH, 'compare', '--room', room, '--deep', deep.res.run_id, '--quick', quick.res.run_id], { encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(JSON.parse(cli.stdout).ok, true);
  const noArg = cp.spawnSync(process.execPath, [DOOR_PATH, 'compare', '--room', room], { encoding: 'utf8' });
  assert.equal(noArg.status, 2);
  const usage = cp.spawnSync(process.execPath, [DOOR_PATH], { encoding: 'utf8' });
  assert.equal(usage.status, 2);
  const names = ['status', 'start', 'write-persona', 'accept-persona', 'plan-research', 'run-research', 'check', 'merge', 'record-ruling', 'compare'];
  for (const sub of names) assert.ok(usage.stderr.includes(sub), 'usage names ' + sub);
  assert.deepEqual(door.SUBCOMMANDS, names);
});

(async () => {
  let passed = 0;
  let failed = 0;
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
