#!/usr/bin/env node
'use strict';

/*
 * Quick 261127-bnd shell-args-json: Codex Blocker 2 and plan check r2.
 *
 * Reason: a shell runs a command substitution `$(...)` and a backtick
 * command that a line holds, inside double quotes and with no quotes. When
 * an instruction line puts an opportunity, a topic or a report header on a
 * shell command line, text from a person or a transcript can run a command.
 *
 * Rule: the text goes in a JSON file (the model writes it with the Write
 * tool), and the command line holds the file path only. The 3 scripts
 * (scripts/mindrian-tools.cjs bank-opportunity, scripts/close-loop.cjs
 * version-log, scripts/dominant-design-research.cjs file-pack) do not run
 * the payload themselves; the danger is the instruction line. The old
 * argument form of each script stays for callers that use an argument array
 * and no shell.
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

const TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bnd-saj-')));
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
const MT = path.join(REPO, 'scripts', 'mindrian-tools.cjs');
const CL = path.join(REPO, 'scripts', 'close-loop.cjs');
const DD = path.join(REPO, 'scripts', 'dominant-design-research.cjs');
const NODE = process.execPath;

const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');

const BT = '`';
function payload(a, b, word) {
  return word + ' $(touch bnd-canary-' + a + ') ' + BT + 'touch bnd-canary-' + b + BT + ' "quoted" O\'Neil';
}
const PROBLEM_PAYLOAD = payload(1, 2, 'Clinics lose referrals');
const SOLUTION_PAYLOAD = payload(3, 4, 'A shared referral queue');
const TOPIC_PAYLOAD = payload(5, 6, 'pricing of grid storage');
const LABEL_PAYLOAD = payload(7, 8, 'Solar Ventures');
const STAGE_PAYLOAD = payload(9, 10, 'Validate');

const SAFE_PATH = /^[A-Za-z0-9_./-]+$/;
function P(p) {
  if (!SAFE_PATH.test(p)) throw new Error('unsafe path for a test line: ' + p);
  return '"' + p + '"';
}

function env(home) {
  const h = home || HOME;
  return {
    PATH: [path.dirname(NODE), '/usr/local/bin', '/usr/bin', '/bin'].join(':'),
    HOME: h,
    USERPROFILE: h,
    MINDRIAN_HOME: path.join(h, '.mindrian'),
    MINDRIAN_ROOMS_HOME: RH,
    MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9',
    LANG: 'C',
    LC_ALL: 'C',
    TZ: 'UTC',
  };
}

function out(r) { return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' }; }

// sh: run one fixed line with `bash -c` in W. The line holds fixed text and temp paths only.
function sh(line, home) {
  return out(spawnSync('bash', ['-c', line], { cwd: W, encoding: 'utf8', timeout: 120000, env: env(home) }));
}

// argv: run a node script with an argument array and no shell.
function argv(script, args, home) {
  return out(spawnSync(NODE, ['--no-warnings', script].concat(args), { cwd: W, encoding: 'utf8', timeout: 120000, env: env(home) }));
}

function nodeLine(script) { return P(NODE) + ' --no-warnings ' + P(script); }

function homeIsTemp(home) {
  const r = spawnSync(NODE, ['-p', "require('os').homedir()"], { cwd: W, encoding: 'utf8', env: env(home) });
  const got = (r.stdout || '').trim();
  if (got !== (home || HOME)) throw new Error('the child home is not the temp home: ' + got);
}

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
function file(text, ext) {
  fileSeq += 1;
  const p = path.join(FILES, 'f' + fileSeq + (ext || '.json'));
  fs.writeFileSync(p, text);
  return p;
}

let seq = 0;
function makeDir(label) {
  seq += 1;
  const d = path.join(TMP, label + '-' + seq);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function makeRoomWithDb() {
  const dir = makeDir('room');
  const db = openRoomDb(dir);
  closeRoomDb(db);
  return dir;
}

function listFiles(root) {
  const res = [];
  (function walk(d) {
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { return; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else res.push(path.relative(root, p));
    }
  })(root);
  return res.sort().join('\n');
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

function opportunity() {
  return { problem: PROBLEM_PAYLOAD, mirror_solution: SOLUTION_PAYLOAD, domain: 'health', evidence: 'conversation with user', source_framework: 'conversation', knight_position: 'uncertainty', confidence: 0.5 };
}

function scratchpadText(home) {
  const f = path.join(home || HOME, '.mindrian', 'scratchpad.json');
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
}

function jsonText(s) { return JSON.stringify(s).slice(1, -1); }

function lines(rel) { return fs.readFileSync(path.join(REPO, rel), 'utf8').split('\n'); }

const RUNNER = /(^|[\s`(!;|&])(node|bash|sh|python3?|npx|curl)\s/;

const CASES = [
  ['K0', 'control: a payload inside double quotes on a line runs', function () {
    const r = sh('printf "%s" "x $(touch bnd-canary-0)" >/dev/null');
    assert(r.status === 0, 'exit ' + r.status);
    const f = path.join(W, 'bnd-canary-0');
    assert(fs.existsSync(f), 'bnd-canary-0 was not made');
    fs.rmSync(f, { force: true });
  }],
  ['B1', 'bank-opportunity --file banks to the scratchpad with the text unchanged', function () {
    homeIsTemp();
    const f = file(JSON.stringify(opportunity()));
    const r = sh(nodeLine(MT) + ' bank-opportunity --file ' + P(f));
    assert(r.status === 0, 'exit ' + r.status + ' ' + (r.stdout + r.stderr).slice(-300));
    const sp = scratchpadText();
    assert(sp !== null && sp.indexOf(jsonText(PROBLEM_PAYLOAD)) !== -1, 'scratchpad.json does not hold the payload');
    noCanary();
  }],
  ['B2', 'bank-opportunity <room> --file banks to the room', function () {
    homeIsTemp();
    const room = makeDir('broom');
    const f = file(JSON.stringify(opportunity()));
    const r = sh(nodeLine(MT) + ' bank-opportunity ' + P(room) + ' --file ' + P(f));
    assert(r.status === 0, 'exit ' + r.status + ' ' + (r.stdout + r.stderr).slice(-300));
    const bank = path.join(room, 'opportunity-bank');
    const hits = listFiles(bank).split('\n').filter(Boolean).filter(function (rel) {
      return fs.readFileSync(path.join(bank, rel), 'utf8').indexOf(PROBLEM_PAYLOAD) !== -1;
    });
    assert(hits.length === 1, hits.length + ' files under opportunity-bank hold the problem payload');
    noCanary();
  }],
  ['B3', 'bank-opportunity refuses a missing file and a text that is not JSON', function () {
    const home = makeDir('home-b3');
    fs.mkdirSync(path.join(home, '.mindrian'), { recursive: true });
    homeIsTemp(home);
    const r1 = sh(nodeLine(MT) + ' bank-opportunity --file ' + P(path.join(FILES, 'absent-o.json')), home);
    assert(r1.status !== 0, 'missing file: exit 0');
    assert((r1.stdout + r1.stderr).indexOf('--file') !== -1, 'missing file: the output does not name --file');
    const r2 = sh(nodeLine(MT) + ' bank-opportunity --file ' + P(file('not json {')), home);
    assert(r2.status !== 0, 'not JSON: exit 0');
    assert(scratchpadText(home) === null, 'scratchpad.json exists in the new home');
  }],
  ['B4', 'bank-opportunity JSON argument by an argument array is unchanged', function () {
    const home = makeDir('home-b4');
    fs.mkdirSync(path.join(home, '.mindrian'), { recursive: true });
    homeIsTemp(home);
    const r = argv(MT, ['bank-opportunity', JSON.stringify(opportunity())], home);
    assert(r.status === 0, 'exit ' + r.status + ' ' + (r.stdout + r.stderr).slice(-300));
    const sp = scratchpadText(home);
    assert(sp !== null && sp.indexOf(jsonText(PROBLEM_PAYLOAD)) !== -1, 'scratchpad.json does not hold the payload');
  }],
  ['V1', 'version-log --topic-file uses the topic unchanged', function () {
    const room = makeRoomWithDb();
    const f = file(JSON.stringify({ topic: TOPIC_PAYLOAD }));
    const r = sh(nodeLine(CL) + ' version-log --room ' + P(room) + ' --topic-file ' + P(f));
    assert(r.status === 0, 'exit ' + r.status + ' ' + (r.stdout + r.stderr).slice(-300));
    assert(r.stdout === 'version-log: 0 conclusions on topic "' + TOPIC_PAYLOAD + '"\n', 'stdout: ' + r.stdout.slice(0, 200));
    noCanary();
  }],
  ['V2', 'version-log from a file equals version-log from an argument', function () {
    const room = makeRoomWithDb();
    const f = file(JSON.stringify({ topic: TOPIC_PAYLOAD }));
    const a = sh(nodeLine(CL) + ' version-log --room ' + P(room) + ' --topic-file ' + P(f));
    const b = argv(CL, ['version-log', '--room', room, '--topic', TOPIC_PAYLOAD]);
    assert(a.status === 0 && b.status === 0, 'exit ' + a.status + ' and ' + b.status);
    assert(a.stdout === b.stdout, 'stdout differs: ' + a.stdout.slice(0, 120) + ' | ' + b.stdout.slice(0, 120));
  }],
  ['V3', 'version-log refuses a double input, no topic, a text that is not JSON and no string topic', function () {
    const room = makeRoomWithDb();
    const good = file(JSON.stringify({ topic: 'x' }));
    const r1 = sh(nodeLine(CL) + ' version-log --room ' + P(room) + ' --topic plain --topic-file ' + P(good));
    assert(r1.status === 2, '--topic and --topic-file: exit ' + r1.status);
    const r2 = sh(nodeLine(CL) + ' version-log --room ' + P(room));
    assert(r2.status === 2, 'no topic: exit ' + r2.status);
    const r3 = sh(nodeLine(CL) + ' version-log --room ' + P(room) + ' --topic-file ' + P(file('not json {')));
    assert(r3.status === 1, 'not JSON: exit ' + r3.status);
    let j3 = null;
    try { j3 = JSON.parse(r3.stdout); } catch (_) { /* checked below */ }
    assert(j3 && j3.reason === 'topic_not_json', 'not JSON: reason ' + (j3 && j3.reason));
    const r4 = sh(nodeLine(CL) + ' version-log --room ' + P(room) + ' --topic-file ' + P(file(JSON.stringify({ topic: 7 }))));
    assert(r4.status === 1, 'no string topic: exit ' + r4.status);
    let j4 = null;
    try { j4 = JSON.parse(r4.stdout); } catch (_) { /* checked below */ }
    assert(j4 && j4.reason === 'topic_missing', 'no string topic: reason ' + (j4 && j4.reason));
  }],
  ['F1', 'file-pack --header-file sets the first line with the text unchanged', function () {
    const room = makeRoomWithDb();
    const pack = makeDir('pack');
    const h = path.join(pack, 'header.json');
    fs.writeFileSync(h, JSON.stringify({ room_label: LABEL_PAYLOAD, stage: STAGE_PAYLOAD }));
    const r = sh(nodeLine(DD) + ' file-pack --pack ' + P(pack) + ' --room ' + P(room) + ' --domain-slug solar-cells --date 2026-09-23 --header-file ' + P(h));
    assert(r.status === 0, 'exit ' + r.status + ' ' + (r.stdout + r.stderr).slice(-300));
    const first = r.stdout.split('\n')[0];
    assert(first === '-- ' + LABEL_PAYLOAD + ' -- competitive-analysis -- ' + STAGE_PAYLOAD + ' --', 'first line: ' + first);
    noCanary();
  }],
  ['F2', 'file-pack refuses a double input and a header that is not a JSON object, and writes nothing', function () {
    const room = makeRoomWithDb();
    const pack = makeDir('pack');
    const h = path.join(pack, 'header.json');
    fs.writeFileSync(h, JSON.stringify({ room_label: 'L', stage: 'S' }));
    const before = listFiles(room);
    const r1 = sh(nodeLine(DD) + ' file-pack --pack ' + P(pack) + ' --room ' + P(room) + ' --domain-slug solar-cells --date 2026-09-23 --header-file ' + P(h) + ' --room-label Other');
    assert(r1.status === 2, '--header-file and --room-label: exit ' + r1.status);
    const bad = path.join(pack, 'bad-header.json');
    fs.writeFileSync(bad, '["not", "an object"]');
    const r2 = sh(nodeLine(DD) + ' file-pack --pack ' + P(pack) + ' --room ' + P(room) + ' --domain-slug solar-cells --date 2026-09-23 --header-file ' + P(bad));
    assert(r2.status === 2, 'not an object: exit ' + r2.status);
    assert(listFiles(room) === before, 'the file list of the room changed');
  }],
  ['F3', 'file-pack --room-label and --stage by an argument array are unchanged', function () {
    const room = makeRoomWithDb();
    const pack = makeDir('pack');
    const r = argv(DD, ['file-pack', '--pack', pack, '--room', room, '--domain-slug', 'solar-cells', '--date', '2026-09-23', '--room-label', 'Solar Ventures', '--stage', 'Validate']);
    assert(r.status === 0, 'exit ' + r.status + ' ' + (r.stdout + r.stderr).slice(-300));
    assert(r.stdout.split('\n')[0] === '-- Solar Ventures -- competitive-analysis -- Validate --', 'first line: ' + r.stdout.split('\n')[0]);
  }],
  ['D1', 'the conversation-mode, bono and dominant-designs instruction lines name JSON files', function () {
    const cm = lines('skills/conversation-mode/SKILL.md');
    const bi = [];
    cm.forEach(function (l, i) { if (l.indexOf('bank-opportunity') !== -1 && RUNNER.test(l)) bi.push(i); });
    assert(bi.length === 1, 'conversation-mode: ' + bi.length + ' bank-opportunity shell lines, want 1');
    const bl = cm[bi[0]];
    assert(bl.indexOf('--file "<dir>/opportunity.json"') !== -1, 'conversation-mode: no --file');
    assert(bl.indexOf('"problem"') === -1, 'conversation-mode: the shell line holds "problem"');
    const up = cm[bi[0] - 2] || '';
    for (const t of ['Write tool', 'mktemp -d', 'remove that directory']) assert(up.indexOf(t) !== -1, 'conversation-mode: the write step has no ' + t);
    for (const rel of ['commands/bono.md', 'skills/bono/SKILL.md']) {
      const v = lines(rel).filter(function (l) { return l.indexOf('version-log --room') !== -1; });
      assert(v.length >= 1, rel + ': no version-log line');
      for (const l of v) {
        for (const t of ['--topic-file "<dir>/topic.json"', 'mktemp -d', 'remove that directory']) assert(l.indexOf(t) !== -1, rel + ': no ' + t);
        assert(l.indexOf('--topic "') === -1, rel + ': holds --topic "');
      }
    }
    for (const rel of ['commands/dominant-designs.md', 'skills/dominant-designs/SKILL.md']) {
      const v = lines(rel).filter(function (l) { return l.indexOf('file-pack --pack') !== -1; });
      assert(v.length >= 1, rel + ': no file-pack line');
      for (const l of v) {
        assert(l.indexOf('--header-file <scratch>/header.json') !== -1, rel + ': no --header-file');
        assert(l.indexOf('--room-label') === -1 && l.indexOf('--stage "') === -1, rel + ': holds --room-label or --stage "');
      }
    }
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
  process.stdout.write('261127-bnd shell-args-json: ' + p + ' passed, ' + f + ' failed\n');
  for (const m of failures) process.stdout.write('    ' + m.slice(0, 600) + '\n');
  process.exit(f ? 1 : 0);
}

main();
