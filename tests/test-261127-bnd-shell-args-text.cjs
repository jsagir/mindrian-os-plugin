#!/usr/bin/env node
'use strict';

/*
 * Quick 261127-bnd shell-args-text: Codex Blocker 2 and plan check r2.
 *
 * Reason: a shell runs a command substitution `$(...)` and a backtick
 * command that a line holds, inside double quotes and with no quotes. When
 * an instruction line puts claim words, an answer, a question, an account
 * or a topic on a shell command line, text from a person or a transcript
 * can run a command.
 *
 * Rule: the text goes in a file (the model writes it with the Write tool),
 * and the command line holds the file path only. The 3 scripts
 * (scripts/claim-checks.cjs, scripts/room-question.cjs,
 * scripts/rs-experts-command.cjs) do not run the payload themselves; the
 * danger is the instruction line. The old argument form of each script
 * stays for callers that use an argument array and no shell.
 *
 * Isolation: the temp HOME, USERPROFILE, MINDRIAN_HOME, MINDRIAN_ROOMS_HOME
 * and MINDRIAN_BRAIN_URL=http://127.0.0.1:9 are set before the first
 * require of plugin code and in the environment of every child; the session
 * variables are removed. Every child has a temp working folder. A payload
 * is written to a file with fs.writeFileSync; it is never part of a command
 * line. A payload holds only the harmless command `touch bnd-canary-<n>`.
 *
 * Node built-in modules only. Synthetic text only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bnd-sat-')));
const W = path.join(TMP, 'w');
const HOME = path.join(TMP, 'h');
const MH = path.join(HOME, '.mindrian');
const RH = path.join(TMP, 'rooms');
const FILES = path.join(TMP, 'files');
for (const d of [W, MH, RH, FILES]) fs.mkdirSync(d, { recursive: true });
process.env.HOME = HOME;
process.env.USERPROFILE = HOME;
process.env.MINDRIAN_HOME = MH;
process.env.MINDRIAN_ROOMS_HOME = RH;
process.env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9';
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_ROOM;

const REPO = path.resolve(__dirname, '..');
const CC = path.join(REPO, 'scripts', 'claim-checks.cjs');
const RQ = path.join(REPO, 'scripts', 'room-question.cjs');
const RX = path.join(REPO, 'scripts', 'rs-experts-command.cjs');
const NODE = process.execPath;

const navigation = require('../lib/core/navigation.cjs');
const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');

const BT = '`';
function payload(a, b, word) {
  return word + ' $(touch bnd-canary-' + a + ') ' + BT + 'touch bnd-canary-' + b + BT + ' "quoted" O\'Neil';
}
const Q_PAYLOAD = payload(1, 2, 'What problem matters');
const Q2_PAYLOAD = payload(3, 4, 'Which problem matters more');
const ACCOUNT_PAYLOAD = payload(5, 6, 'It named the wrong user');
const AGAINST_PAYLOAD = payload(7, 8, 'field note');
const WORDS_PAYLOAD = payload(9, 10, 'zzqx');
const TOPIC_PAYLOAD = payload(11, 12, 'grid storage');

const SAFE_PATH = /^[A-Za-z0-9_./-]+$/;
function P(p) {
  if (!SAFE_PATH.test(p)) throw new Error('unsafe path for a test line: ' + p);
  return '"' + p + '"';
}

function env(extra) {
  return Object.assign({
    PATH: [path.dirname(NODE), '/usr/local/bin', '/usr/bin', '/bin'].join(':'),
    HOME: HOME,
    USERPROFILE: HOME,
    MINDRIAN_HOME: MH,
    MINDRIAN_ROOMS_HOME: RH,
    MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9',
    LANG: 'C',
    LC_ALL: 'C',
    TZ: 'UTC',
  }, extra || {});
}

function out(r) { return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' }; }

// sh: run one fixed line with `bash -c` in W. The line holds fixed text and temp paths only.
function sh(line, extra) {
  return out(spawnSync('bash', ['-c', line], { cwd: W, encoding: 'utf8', timeout: 120000, env: env(extra) }));
}

// argv: run a node script with an argument array and no shell.
function argv(script, args, extra) {
  return out(spawnSync(NODE, ['--no-warnings', script].concat(args), { cwd: W, encoding: 'utf8', timeout: 120000, env: env(extra) }));
}

function nodeLine(script) { return P(NODE) + ' --no-warnings ' + P(script); }

function canaries() {
  const found = [];
  (function walk(d) {
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { return; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.name.indexOf('bnd-canary-') === 0) found.push(p);
      if (e.isDirectory() && !e.isSymbolicLink()) walk(p);
    }
  })(TMP);
  return found;
}

function noCanary() {
  const c = canaries();
  if (c.length) throw new Error('canary file(s): ' + c.map(function (p) { return path.relative(TMP, p); }).join(', '));
}

let fileSeq = 0;
function file(text) {
  fileSeq += 1;
  const p = path.join(FILES, 'f' + fileSeq + '.txt');
  fs.writeFileSync(p, text);
  return p;
}

let roomSeq = 0;
function makeRoom() {
  roomSeq += 1;
  const dir = path.join(TMP, 'room-' + roomSeq);
  fs.mkdirSync(dir, { recursive: true });
  const db = openRoomDb(dir);
  closeRoomDb(db);
  return dir;
}

function seedClaim(roomDir, text, seg) {
  const db = navigation.openRoomDbForCaller(roomDir);
  try {
    const r = navigation.writeClaimNode(db, { knowledge_type: 'fact', text: text, sessionId: 's261127-bnd', sourceSegment: seg });
    if (!r.ok) throw new Error('seed failed: ' + JSON.stringify(r));
    return r.node_id;
  } finally {
    navigation.closeRoomDbForCaller(db);
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

function json(r, label) {
  try { return JSON.parse(r.stdout); } catch (_) { throw new Error(label + ': stdout is not JSON: ' + (r.stdout + r.stderr).slice(0, 200)); }
}

// The option values of a claim check, read at run time (the combination of the
// record case of tests/test-358-b1-cli.cjs: an observation, rung 3, compare, contradicts).
function recordOptions() {
  const o = json(argv(CC, ['options']), 'options');
  const kind = o.against_kinds.find(function (k) { return k === o.against_kinds[2]; });
  return { kind: kind, rung: '3', method: o.methods[1], result: o.results[1] };
}

function firstOrigin() {
  return json(argv(RQ, ['origins', '--json']), 'origins')[0].id;
}

function lines(rel) { return fs.readFileSync(path.join(REPO, rel), 'utf8').split('\n'); }

function checkRoom(rel) {
  const ls = lines(rel);
  const show = ls.filter(function (l) { return l.indexOf('claim-checks.cjs" show --room') !== -1; });
  assert(show.length === 2, rel + ': ' + show.length + ' show lines, want 2');
  for (const l of show) {
    assert(l.indexOf('--words-file "<dir>/words.txt"') !== -1, rel + ': a show line has no --words-file');
    assert(l.indexOf('<id or words>') === -1, rel + ': a show line holds <id or words>');
  }
  const rec = ls.filter(function (l) { return l.indexOf('claim-checks.cjs" record') !== -1; });
  assert(rec.length >= 1, rel + ': no record line');
  for (const l of rec) {
    assert(l.indexOf('--against-file "<dir>/against.txt"') !== -1, rel + ': the record line has no --against-file');
    assert(l.indexOf('--against "') === -1, rel + ': the record line holds --against "');
  }
  const set = ls.filter(function (l) { return l.indexOf('room-question.cjs" set') !== -1; });
  assert(set.length >= 1, rel + ': no set line');
  for (const l of set) {
    assert(l.indexOf('--text-file "<dir>/question.txt"') !== -1, rel + ': the set line has no --text-file');
    assert(l.indexOf('"<question text>"') === -1, rel + ': the set line holds "<question text>"');
  }
  assert(!ls.some(function (l) { return l.indexOf('--account "<') !== -1; }), rel + ': a line holds --account "<');
  const acc = ls.filter(function (l) { return l.indexOf('--account-file "<dir>/account.txt"') !== -1; }).length;
  assert(acc === 1, rel + ': ' + acc + ' --account-file lines, want 1');
  const mk = ls.filter(function (l) { return l.indexOf('mktemp -d') !== -1; }).length;
  const rm = ls.filter(function (l) { return l.indexOf('remove that directory') !== -1; }).length;
  assert(mk >= 3 && rm >= 3, rel + ': ' + mk + ' mktemp -d lines and ' + rm + ' removal lines, want 3 or more of each');
}

function checkRsExperts(rel) {
  const ls = lines(rel).filter(function (l) { return l.indexOf('rs-experts-command.cjs"') !== -1; });
  assert(ls.length >= 1, rel + ': no rs-experts-command line');
  for (const l of ls) {
    for (const t of ['--topic-file "<dir>/topic.txt"', 'mktemp -d', 'remove that directory']) assert(l.indexOf(t) !== -1, rel + ': no ' + t);
    assert(l.indexOf('"<topic>"') === -1, rel + ': holds "<topic>"');
  }
}

function rxFirstLine(stdout) {
  return stdout.split('\n').find(function (l) { return l.trim() !== ''; });
}

const state = {};

const CASES = [
  ['K0', 'control: a payload inside double quotes on a line runs', function () {
    const r = sh('printf "%s" "x $(touch bnd-canary-0)" >/dev/null');
    assert(r.status === 0, 'exit ' + r.status);
    const f = path.join(W, 'bnd-canary-0');
    assert(fs.existsSync(f), 'bnd-canary-0 was not made');
    fs.rmSync(f, { force: true });
  }],
  ['Q1', 'room-question set --text-file records the question unchanged', function () {
    const room = makeRoom();
    state.qRoom = room;
    state.origin = firstOrigin();
    const f = file(Q_PAYLOAD + '\n');
    const r = sh(nodeLine(RQ) + ' set --room ' + P(room) + ' --origin ' + state.origin + ' --text-file ' + P(f));
    assert(r.status === 0, 'exit ' + r.status + ' ' + r.stderr.slice(-300));
    assert(r.stdout.indexOf('Recorded: version 1 (first question)') !== -1, 'stdout: ' + r.stdout.slice(0, 200));
    const v = argv(RQ, ['show', '--room', room, '--json']);
    assert(v.stdout.indexOf(JSON.stringify(Q_PAYLOAD).slice(1, -1)) !== -1, 'show --json does not hold the question payload');
    noCanary();
  }],
  ['Q2', 'room-question change needs --account-file and records the account unchanged', function () {
    const room = state.qRoom;
    assert(room, 'no room from Q1');
    const f = file(Q2_PAYLOAD + '\n');
    const base = nodeLine(RQ) + ' set --room ' + P(room) + ' --origin ' + state.origin + ' --based-on 1 --text-file ' + P(f);
    const r = sh(base);
    assert(r.status === 1, 'no account: exit ' + r.status + ' ' + r.stderr.slice(-300));
    assert(r.stderr.indexOf('change_needs_account') !== -1, 'stderr has no change_needs_account');
    assert(r.stderr.indexOf('--account-file') !== -1, 'stderr has no --account-file');
    assert(r.stderr.indexOf('--account "') === -1, 'stderr holds --account "');
    const af = file(ACCOUNT_PAYLOAD + '\n');
    const r2 = sh(base + ' --account-file ' + P(af));
    assert(r2.status === 0, 'with account: exit ' + r2.status + ' ' + r2.stderr.slice(-300));
    assert(r2.stdout.indexOf('refines') !== -1, 'stdout has no refines');
    const h = argv(RQ, ['history', '--room', room, '--json']);
    assert(h.stdout.indexOf(JSON.stringify(ACCOUNT_PAYLOAD).slice(1, -1)) !== -1, 'history --json does not hold the account payload');
    noCanary();
  }],
  ['Q3', 'room-question refuses a double input and a missing file and records nothing', function () {
    const room = makeRoom();
    const origin = firstOrigin();
    const before = argv(RQ, ['show', '--room', room, '--json']).stdout;
    const f = file('A question from a file\n');
    const r1 = sh(nodeLine(RQ) + ' set --room ' + P(room) + ' --origin ' + origin + ' --text-file ' + P(f) + ' extra words');
    assert(r1.status === 2, 'words and --text-file: exit ' + r1.status);
    const af = file('An account\n');
    const r2 = sh(nodeLine(RQ) + ' set --room ' + P(room) + ' --origin ' + origin + ' --text-file ' + P(f) + ' --account plain --account-file ' + P(af));
    assert(r2.status === 2, '--account and --account-file: exit ' + r2.status);
    const r3 = sh(nodeLine(RQ) + ' set --room ' + P(room) + ' --origin ' + origin + ' --text-file ' + P(path.join(FILES, 'absent-q.txt')));
    assert(r3.status === 2, 'missing file: exit ' + r3.status);
    const after = argv(RQ, ['show', '--room', room, '--json']).stdout;
    assert(after === before, 'show --json changed');
  }],
  ['Q4', 'room-question argument form by an argument array is unchanged', function () {
    const room = makeRoom();
    const r = argv(RQ, ['set', '--room', room, '--origin', firstOrigin(), Q_PAYLOAD]);
    assert(r.status === 0, 'exit ' + r.status + ' ' + r.stderr.slice(-300));
    const v = argv(RQ, ['show', '--room', room, '--json']);
    assert(v.stdout.indexOf(JSON.stringify(Q_PAYLOAD).slice(1, -1)) !== -1, 'show --json does not hold the question payload');
  }],
  ['C1', 'claim-checks record --against-file records the answer unchanged', function () {
    const room = makeRoom();
    const id = seedClaim(room, 'The bridge at grid 42 is passable.', 'bnd-seed-c1');
    const o = recordOptions();
    const f = file(AGAINST_PAYLOAD + '\n');
    const r = sh(nodeLine(CC) + ' record --room ' + P(room) + ' --claim ' + id + ' --against-file ' + P(f) + ' --against-kind ' + o.kind + ' --rung ' + o.rung + ' --method ' + o.method + ' --result ' + o.result);
    assert(r.status === 0, 'exit ' + r.status + ' ' + r.stderr.slice(-300));
    assert(r.stdout.indexOf('Recorded a check on this claim.') !== -1, 'stdout: ' + r.stdout.slice(0, 200));
    const v = argv(CC, ['show', '--room', room, '--json', id]);
    assert(v.stdout.indexOf(JSON.stringify(AGAINST_PAYLOAD).slice(1, -1)) !== -1, 'show --json does not hold the answer payload');
    noCanary();
  }],
  ['C2', 'claim-checks record refuses a double input, a missing file and an empty file', function () {
    const room = makeRoom();
    const id = seedClaim(room, 'The ford at grid 17 is too deep.', 'bnd-seed-c2');
    const o = recordOptions();
    const tail = ' --against-kind ' + o.kind + ' --rung ' + o.rung + ' --method ' + o.method + ' --result ' + o.result;
    const before = argv(CC, ['show', '--room', room, '--json', id]).stdout;
    const f = file('a document\n');
    const head = nodeLine(CC) + ' record --room ' + P(room) + ' --claim ' + id;
    const r1 = sh(head + ' --against plain --against-file ' + P(f) + tail);
    assert(r1.status === 2, '--against and --against-file: exit ' + r1.status);
    const r2 = sh(head + ' --against-file ' + P(path.join(FILES, 'absent-a.txt')) + tail);
    assert(r2.status === 2, 'missing file: exit ' + r2.status);
    const r3 = sh(head + ' --against-file ' + P(file('')) + tail);
    assert(r3.status === 2, 'empty file: exit ' + r3.status);
    const after = argv(CC, ['show', '--room', room, '--json', id]).stdout;
    assert(after === before, 'the claim view changed');
  }],
  ['C3', 'claim-checks record --against by an argument array is unchanged', function () {
    const room = makeRoom();
    const id = seedClaim(room, 'The tank at grid 9 is full.', 'bnd-seed-c3');
    const o = recordOptions();
    const r = argv(CC, ['record', '--room', room, '--claim', id, '--against', 'field note, exercise 02', '--against-kind', o.kind, '--rung', o.rung, '--method', o.method, '--result', o.result]);
    assert(r.status === 0, 'exit ' + r.status + ' ' + r.stderr.slice(-300));
    assert(r.stdout.indexOf('Recorded a check on this claim.') !== -1, 'stdout: ' + r.stdout.slice(0, 200));
  }],
  ['C4', 'claim-checks show --words-file finds a claim and refuses a double input', function () {
    const room = makeRoom();
    seedClaim(room, 'The harbor crane at pier 5 is idle.', 'bnd-seed-c4');
    const head = nodeLine(CC) + ' show --room ' + P(room);
    const r1 = sh(head + ' --words-file ' + P(file('harbor crane\n')));
    assert(r1.status === 0, 'words: exit ' + r1.status + ' ' + r1.stderr.slice(-300));
    assert(r1.stdout.indexOf('The harbor crane at pier 5 is idle.') !== -1, 'stdout has no claim text');
    const r2 = sh(head + ' --words-file ' + P(file(WORDS_PAYLOAD + '\n')));
    assert(r2.status === 1, 'payload: exit ' + r2.status);
    assert(r2.stderr.indexOf('claim_not_found') !== -1, 'payload: stderr has no claim_not_found');
    noCanary();
    const r3 = sh(head + ' harbor --words-file ' + P(file('harbor crane\n')));
    assert(r3.status === 2, 'words and --words-file: exit ' + r3.status);
    const r4 = sh(head + ' --words-file ' + P(path.join(FILES, 'absent-w.txt')));
    assert(r4.status === 2, 'missing file: exit ' + r4.status);
  }],
  ['X1', 'rs-experts --topic-file uses the topic unchanged', function () {
    const room = makeRoom();
    state.xRoom = room;
    const f = file(TOPIC_PAYLOAD + '\n');
    const r = sh(nodeLine(RX) + ' --topic-file ' + P(f), { MINDRIAN_ROOM: room });
    assert(r.status === 0, 'exit ' + r.status + ' ' + r.stderr.slice(-300));
    const first = rxFirstLine(r.stdout);
    assert(first === '-- rs-experts -- ' + TOPIC_PAYLOAD + ' -- 0 local authors --', 'first line: ' + first);
    noCanary();
  }],
  ['X2', 'rs-experts refuses a double input and a missing file', function () {
    const room = state.xRoom || makeRoom();
    const f = file('grid storage\n');
    const r1 = sh(nodeLine(RX) + ' storage --topic-file ' + P(f), { MINDRIAN_ROOM: room });
    assert(r1.status === 1, 'topic and --topic-file: exit ' + r1.status);
    assert(r1.stderr.indexOf('--topic-file') !== -1, 'stderr has no --topic-file');
    const r2 = sh(nodeLine(RX) + ' --topic-file ' + P(path.join(FILES, 'absent-t.txt')), { MINDRIAN_ROOM: room });
    assert(r2.status === 1, 'missing file: exit ' + r2.status);
  }],
  ['X3', 'rs-experts topic by an argument array is unchanged', function () {
    const room = state.xRoom || makeRoom();
    const r = argv(RX, [TOPIC_PAYLOAD], { MINDRIAN_ROOM: room });
    assert(r.status === 0, 'exit ' + r.status + ' ' + r.stderr.slice(-300));
    const first = rxFirstLine(r.stdout);
    assert(first === '-- rs-experts -- ' + TOPIC_PAYLOAD + ' -- 0 local authors --', 'first line: ' + first);
  }],
  ['D1', 'the room and rs-experts instruction lines name files, not text placeholders', function () {
    checkRoom('commands/room.md');
    checkRoom('skills/room/SKILL.md');
    checkRsExperts('commands/rs-experts.md');
    checkRsExperts('skills/rs-experts/SKILL.md');
  }],
];

function main() {
  let p = 0;
  let f = 0;
  const failures = [];
  try {
    for (const [id, name, fn] of CASES) {
      try { fn(); p += 1; process.stdout.write('  ok   ' + id + ' ' + name + '\n'); }
      catch (err) { f += 1; failures.push(id + ': ' + (err && err.message ? err.message : String(err))); process.stdout.write('  FAIL ' + id + ' ' + name + '\n'); }
    }
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
  process.stdout.write('261127-bnd shell-args-text: ' + p + ' passed, ' + f + ' failed\n');
  for (const m of failures) process.stdout.write('    ' + m.slice(0, 600) + '\n');
  process.exit(f ? 1 : 0);
}

main();
