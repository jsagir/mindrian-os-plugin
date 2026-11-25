#!/usr/bin/env node
'use strict';
// Phase 400.2-05: the door of the persona cycle (scripts/persona-hats.cjs): status, start,
// write-persona, accept-persona. Legs D1 to D4, D9 to D14 (task 1); D5 to D8, D15, D16 (task 2).
// Every leg passes homeDir, tmpDir, now and randomHex as options: no test writes under the
// real home and no test uses the clock.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const DOOR_PATH = path.join(ROOT, 'scripts', 'persona-hats.cjs');
const OPS_PATH = path.join(ROOT, 'lib', 'core', 'persona-ops.cjs');
const ops = require(OPS_PATH);

let failed = 0;
let passed = 0;
function check(label, fn) {
  try {
    fn();
    passed += 1;
    console.log('ok: ' + label);
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + label + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

let door;
try {
  door = require(DOOR_PATH);
} catch (e) {
  console.log('FAIL: the door is missing: ' + (e && e.message ? e.message : String(e)));
  process.exit(1);
}

const HATS = ['white', 'red', 'black', 'yellow', 'green', 'blue'];
const tmpRoots = [];
const NOW = new Date('2026-11-25T10:20:30.000Z');

function mkTmp(label) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-4002-door-' + label + '-'));
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

function makeEnv() {
  return { homeDir: mkTmp('home'), tmpDir: mkTmp('tmp') };
}

// A random-hex seam that gives a different value on each call.
function counterHex() {
  let n = 0;
  return (len) => {
    n += 1;
    return crypto.createHash('sha256').update('seam-' + n).digest('hex').slice(0, len);
  };
}

function validBrief(over) {
  return Object.assign({
    schema: 'mos.persona-brief/1',
    target: 'room',
    governing_question: 'Should the studio move to a fixed monthly retainer model for new clients?',
    sub_questions: ['Who pays first?', 'What breaks at the hand-off?', 'What does the retainer replace?'],
    reading_list: ['problem-definition/core-problem.md', 'market-analysis/size.md'],
    mode: 'deep',
    triage: { recommended: 'deep', reason: 'A pricing change with money at stake.' },
  }, over || {});
}

function writeBrief(obj) {
  const dir = mkTmp('brief');
  const p = path.join(dir, 'brief.json');
  fs.writeFileSync(p, JSON.stringify(obj), 'utf8');
  return p;
}

function opts(env, extra) {
  return Object.assign({ homeDir: env.homeDir, tmpDir: env.tmpDir, now: NOW, randomHex: counterHex() }, extra || {});
}

function startDeep(room, env, briefOver, extra) {
  const briefPath = writeBrief(validBrief(briefOver));
  return door.cmdStart({ roomDir: room, briefPath, mode: 'deep' }, opts(env, extra));
}

function treeHash(dir) {
  const lines = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const abs = path.join(d, e.name);
      if (e.isDirectory()) { lines.push('D ' + path.relative(dir, abs)); walk(abs); }
      else lines.push('F ' + path.relative(dir, abs) + ' ' + crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex'));
    }
  })(dir);
  return crypto.createHash('sha256').update(lines.join('\n')).digest('hex');
}

function readLedgerOf(res) {
  return JSON.parse(fs.readFileSync(path.join(res.review_dir, 'run.json'), 'utf8'));
}

// D1
check('D1. start with a valid deep brief writes the ledger with the contract keys', () => {
  const room = makeRoom();
  const env = makeEnv();
  const res = startDeep(room, env);
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.match(res.run_id, /^\d{8}-\d{6}-[0-9a-f]{4}$/);
  assert.equal(res.mode, 'deep');
  assert.equal(res.notice, ops.DEEP_NOTICE);
  const rel = path.relative(room, res.review_dir).split(path.sep).join('/');
  assert.ok(rel.startsWith('personas/hat-reviews/' + res.run_id + '-'), rel);
  const slug = rel.slice(('personas/hat-reviews/' + res.run_id + '-').length);
  assert.ok(slug.split('-').filter(Boolean).length <= 5, slug);
  const ledger = readLedgerOf(res);
  assert.equal(ledger.schema, 'mos.persona-run/1');
  assert.equal(ledger.steps.start.state, 'done');
  const b = validBrief();
  const canon = JSON.stringify({ target: b.target, governing_question: b.governing_question, sub_questions: b.sub_questions, reading_list: b.reading_list });
  assert.equal(ledger.brief_hash, crypto.createHash('sha256').update(canon).digest('hex'));
  const q = door.cmdStart({ roomDir: room, briefPath: writeBrief(validBrief({ mode: 'quick' })), mode: 'quick' }, opts(env, { now: new Date(NOW.getTime() + 5000) }));
  assert.equal(q.ok, true, JSON.stringify(q));
  assert.equal(readLedgerOf(q).brief_hash, ledger.brief_hash);
  assert.equal(ledger.room_fingerprint, ops.roomFingerprint(room));
});

// same sub-question text, same id
check('D1b. a sub-question id is content-derived (normal form of P-4)', () => {
  assert.equal(door.subQuestionId('  Who   PAYS first? '), door.subQuestionId('who pays first?'));
  assert.notEqual(door.subQuestionId('who pays first?'), door.subQuestionId('who pays last?'));
  assert.match(door.subQuestionId('x'), /^sq-[0-9a-f]{8}$/);
  const room = makeRoom();
  const env = makeEnv();
  const a = readLedgerOf(startDeep(room, env));
  const b = readLedgerOf(startDeep(room, env, null, { now: new Date(NOW.getTime() + 9000) }));
  assert.deepEqual(a.sub_questions.map(s => s.id), b.sub_questions.map(s => s.id));
  const c = readLedgerOf(startDeep(room, env, { sub_questions: ['Who pays first?', 'What breaks at the hand-off?', 'What does the retainer displace?'] }, { now: new Date(NOW.getTime() + 19000) }));
  assert.notEqual(a.sub_questions[2].id, c.sub_questions[2].id);
});

// D2
check('D2. a bad brief is refused by name and writes no folder', () => {
  const room = makeRoom();
  const env = makeEnv();
  const cases = [
    [{ unknown_key: 1 }, 'unknown_key:unknown_key'],
    [{ sub_questions: ['only one'] }, 'schema_invalid:sub_questions'],
    [{ sub_questions: ['a', 'b', 'c', 'd', 'e', 'f'] }, 'schema_invalid:sub_questions'],
    [{ sub_questions: ['same', 'same'] }, 'schema_invalid:sub_questions'],
    [{ reading_list: ['personas/white-x.md'] }, 'schema_invalid:reading_list'],
    [{ reading_list: ['nope/missing.md'] }, 'schema_invalid:reading_list'],
    [{ reading_list: Array.from({ length: 13 }, () => 'market-analysis/size.md') }, 'schema_invalid:reading_list'],
    [{ target: 'nope/missing.md' }, 'schema_invalid:target'],
    [{ mode: 'slow' }, 'schema_invalid:mode'],
    [{ triage: undefined }, 'schema_invalid:triage'],
  ];
  for (const [over, reason] of cases) {
    const res = startDeep(room, env, over);
    assert.equal(res.ok, false, JSON.stringify(over));
    assert.ok(String(res.reason).startsWith(reason), JSON.stringify(over) + ' gave ' + res.reason);
  }
  assert.equal(fs.existsSync(path.join(room, 'personas', 'hat-reviews')), false);
  assert.deepEqual(fs.readdirSync(env.tmpDir), []);
});

// D3
check('D3. room precondition: only ROOM.md files refused; nested artifacts accepted', () => {
  const env = makeEnv();
  const thin = mkTmp('thin');
  put(thin, 'STATE.md', '---\nventure: Thin\n---\n');
  put(thin, 'problem-definition/ROOM.md', '# room\n');
  put(thin, 'market-analysis/ROOM.md', '# room\n');
  put(thin, 'market-analysis/size.txt', 'x');
  const res = startDeep(thin, env, { reading_list: ['market-analysis/size.txt'] });
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'room_too_thin');
  const nested = mkTmp('nested');
  put(nested, 'STATE.md', '---\nventure: Nested\n---\n');
  put(nested, 'problem-definition/core/core.md', '# core\nbody\n');
  put(nested, 'market-analysis/size/size.md', '# size\nbody\n');
  const ok = startDeep(nested, env, { reading_list: ['problem-definition/core/core.md'] });
  assert.equal(ok.ok, true, JSON.stringify(ok));
});

// D4
check('D4. scratch layout: modes, unguessable names, private run map, no scratch path in the ledger', () => {
  const room = makeRoom();
  const env = makeEnv();
  const res = door.cmdStart({ roomDir: room, briefPath: writeBrief(validBrief()), mode: 'deep' }, { homeDir: env.homeDir, tmpDir: env.tmpDir, now: NOW });
  assert.equal(res.ok, true, JSON.stringify(res));
  const dirs = HATS.map(h => res.hats[h].dir);
  assert.equal(new Set(dirs).size, 6);
  for (const h of HATS) assert.match(path.basename(res.hats[h].dir), new RegExp('^' + h + '-[0-9a-f]{16}$'));
  const mapPath = path.join(env.homeDir, 'persona-hats', 'runs', res.run_id + '.json');
  assert.ok(fs.existsSync(mapPath));
  if (process.platform !== 'win32') {
    for (const d of dirs.concat([res.inbox_dir, path.dirname(dirs[0])])) assert.equal(fs.statSync(d).mode & 0o777, 0o700, d);
    assert.equal(fs.statSync(mapPath).mode & 0o777, 0o600);
    assert.equal(fs.statSync(path.dirname(mapPath)).mode & 0o777, 0o700);
  } else {
    console.log('skip: mode assertions on win32');
  }
  const text = fs.readFileSync(path.join(res.review_dir, 'run.json'), 'utf8');
  assert.equal(text.includes(path.dirname(dirs[0])), false);
  assert.equal(text.includes('mos-persona-'), false);
});

// D9
check('D9. six fresh personas: nothing to build or accept, both steps skipped', () => {
  const room = makeRoom();
  const env = makeEnv();
  const fp = ops.roomFingerprint(room);
  for (const h of HATS) {
    put(room, 'personas/' + h + '-venture.md', ['---', 'hat: ' + h, 'built_by: persona-analyst', 'persona_status: accepted', 'room_fingerprint: "' + fp + '"', '---', '', '# ' + h, ''].join('\n'));
  }
  const res = startDeep(room, env);
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.deepEqual(res.to_build, []);
  assert.deepEqual(res.to_accept, []);
  const ledger = readLedgerOf(res);
  assert.equal(ledger.steps.write_persona.state, 'skipped');
  assert.equal(ledger.steps.accept_persona.state, 'skipped');
  for (const h of HATS) assert.equal(ledger.hats[h].persona, 'fresh');
});

// D10
check('D10. a proposed file with the current fingerprint goes to to_accept, not to_build', () => {
  const room = makeRoom();
  const env = makeEnv();
  const fp = ops.roomFingerprint(room);
  put(room, 'personas/white-venture.md', ['---', 'hat: white', 'built_by: persona-analyst', 'persona_status: proposed', 'room_fingerprint: "' + fp + '"', '---', '', '# white', ''].join('\n'));
  const res = startDeep(room, env);
  assert.equal(res.ok, true);
  assert.deepEqual(res.to_accept, ['white']);
  assert.equal(res.to_build.includes('white'), false);
  assert.deepEqual(res.to_build, ['red', 'black', 'yellow', 'green', 'blue']);
  assert.equal(res.hats.white.persona, 'unaccepted');
});

// D11
check('D11. two starts in one second differ; an existing review folder is refused', () => {
  const room = makeRoom();
  const env = makeEnv();
  const a = door.cmdStart({ roomDir: room, briefPath: writeBrief(validBrief()), mode: 'deep' }, { homeDir: env.homeDir, tmpDir: env.tmpDir, now: NOW, randomHex: counterHex() });
  const hexB = (len) => 'f'.repeat(len);
  const b = door.cmdStart({ roomDir: room, briefPath: writeBrief(validBrief()), mode: 'deep' }, { homeDir: env.homeDir, tmpDir: env.tmpDir, now: NOW, randomHex: hexB });
  assert.equal(a.ok, true, JSON.stringify(a));
  assert.equal(b.ok, true, JSON.stringify(b));
  assert.notEqual(a.run_id, b.run_id);
  const c = door.cmdStart({ roomDir: room, briefPath: writeBrief(validBrief()), mode: 'deep' }, { homeDir: env.homeDir, tmpDir: env.tmpDir, now: NOW, randomHex: hexB });
  assert.equal(c.ok, false);
  assert.equal(c.reason, 'run_folder_exists');
});

// D12
check('D12. start sweeps old scratch trees of this door and their run maps only', () => {
  const room = makeRoom();
  const env = makeEnv();
  const runsDir = path.join(env.homeDir, 'persona-hats', 'runs');
  fs.mkdirSync(runsDir, { recursive: true });
  const oldId = '20261120-010101-aaaa';
  const newId = '20261125-090000-bbbb';
  const oldTree = path.join(env.tmpDir, 'mos-persona-' + oldId + '-' + '1'.repeat(16));
  const newTree = path.join(env.tmpDir, 'mos-persona-' + newId + '-' + '2'.repeat(16));
  const other = path.join(env.tmpDir, 'other-tool-' + oldId);
  for (const d of [oldTree, newTree, other]) fs.mkdirSync(path.join(d, 'inbox'), { recursive: true });
  fs.writeFileSync(path.join(runsDir, oldId + '.json'), '{}');
  fs.writeFileSync(path.join(runsDir, newId + '.json'), '{}');
  const oldTime = new Date(NOW.getTime() - 30 * 3600 * 1000);
  const newTime = new Date(NOW.getTime() - 2 * 3600 * 1000);
  fs.utimesSync(oldTree, oldTime, oldTime);
  fs.utimesSync(other, oldTime, oldTime);
  fs.utimesSync(newTree, newTime, newTime);
  const res = startDeep(room, env);
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.equal(fs.existsSync(oldTree), false);
  assert.equal(fs.existsSync(path.join(runsDir, oldId + '.json')), false);
  assert.equal(fs.existsSync(newTree), true);
  assert.equal(fs.existsSync(path.join(runsDir, newId + '.json')), true);
  assert.equal(fs.existsSync(other), true);
});

// D13
check('D13. a quick start returns the quick notice, an inbox and no per-hat directory', () => {
  const room = makeRoom();
  const env = makeEnv();
  const res = door.cmdStart({ roomDir: room, briefPath: writeBrief(validBrief({ mode: 'quick' })), mode: 'quick' }, opts(env));
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.equal(res.mode, 'quick');
  assert.equal(res.quick.notice, ops.QUICK_NOTICE);
  assert.ok(fs.existsSync(res.inbox_dir));
  assert.equal(res.hats, undefined);
  const root = path.dirname(res.inbox_dir);
  assert.deepEqual(fs.readdirSync(root), ['inbox']);
  const ledger = readLedgerOf(res);
  for (const h of HATS) assert.ok(['fresh', 'fixed_discipline'].includes(ledger.hats[h].persona), h);
  assert.equal(ledger.mode, 'quick');
});

// D14
check('D14. status writes nothing and reports the room state', () => {
  const room = makeRoom();
  const env = makeEnv();
  startDeep(room, env);
  const before = treeHash(room);
  const res = door.cmdStatus({ roomDir: room }, opts(env));
  assert.equal(treeHash(room), before);
  assert.equal(res.ok, true);
  assert.equal(res.room_ok, true);
  assert.equal(res.sections_with_artifacts, 2);
  assert.equal(res.fingerprint, ops.roomFingerprint(room));
  assert.deepEqual(Object.keys(res.hats), HATS);
  assert.equal(res.venture_name_present, true);
  assert.equal(res.open_runs.length, 1);
});

// D0
check('D0. SUBCOMMANDS is frozen and lists the door subcommands of this plan', () => {
  assert.ok(Object.isFrozen(door.SUBCOMMANDS));
  for (const s of ['status', 'start']) assert.ok(door.SUBCOMMANDS.includes(s), s);
  const src = fs.readFileSync(DOOR_PATH, 'utf8');
  assert.equal(/^(const|let|var)\b.*require\(['"]\.\.\/lib\/core\/bono/m.test(src), false);
});

for (const d of tmpRoots) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}
console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
