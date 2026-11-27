#!/usr/bin/env node
'use strict';

/*
 * Quick 261127-bnd shell-args-bash: Codex Blocker 2 and plan check r2.
 *
 * Reason: a shell runs a command substitution `$(...)` and a backtick
 * command that a line holds, inside double quotes and with no quotes. When
 * an instruction line puts a speaker name, a project context, a venture name
 * or a venture stage on a shell command line, text from a transcript can run
 * a command.
 *
 * Rule: the text goes in a file (the model writes it with the Write tool),
 * and the command line holds the file path only. The 3 scripts
 * (scripts/research-speaker, scripts/room-registry,
 * scripts/create-speaker-profile) do not run the payload themselves; the
 * danger is the instruction line. The old argument form of each script
 * stays for callers that use an argument array and no shell.
 *
 * Isolation: every child gets a temp HOME, USERPROFILE, MINDRIAN_HOME,
 * MINDRIAN_ROOMS_HOME and MINDRIAN_BRAIN_URL=http://127.0.0.1:9, no session
 * variables, a temp working folder, and a stub `curl` first on PATH that
 * logs each URL and exits 1. A payload is written to a file with
 * fs.writeFileSync; it is never part of a command line. A payload holds only
 * the harmless command `touch bnd-canary-<n>` with a relative name.
 *
 * Node built-in modules only. Synthetic names only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const RS = path.join(REPO, 'scripts', 'research-speaker');
const RR = path.join(REPO, 'scripts', 'room-registry');
const CSP = path.join(REPO, 'scripts', 'create-speaker-profile');

const TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bnd-sab-')));
const W = path.join(TMP, 'w');
const HOME = path.join(TMP, 'h');
const MH = path.join(HOME, '.mindrian');
const RH = path.join(TMP, 'rooms');
const STUB = path.join(TMP, 'stub');
const FILES = path.join(TMP, 'files');
for (const d of [W, MH, RH, STUB, FILES]) fs.mkdirSync(d, { recursive: true });
fs.writeFileSync(path.join(STUB, 'curl'), "#!/bin/sh\nfor a in \"$@\"; do case \"$a\" in https://*) printf '%s\\n' \"$a\" >> \"$CURL_STUB_LOG\" ;; esac; done\nexit 1\n", { mode: 0o755 });
const TEST_PATH = [STUB, path.dirname(process.execPath), '/usr/local/bin', '/usr/bin', '/bin'].join(':');

const BT = '`';
const NAME_PAYLOAD = "Dana O'Neil $(touch bnd-canary-1) " + BT + 'touch bnd-canary-2' + BT + ' "q"';
const CONTEXT_PAYLOAD = 'solar storage $(touch bnd-canary-3)';
const VNAME_PAYLOAD = 'Acme $(touch bnd-canary-4) ' + BT + 'touch bnd-canary-5' + BT + ' "Q" O\'Neil';
const VSTAGE_PAYLOAD = 'Pre-Opportunity $(touch bnd-canary-6)';

const SAFE_PATH = /^[A-Za-z0-9_./-]+$/;

function P(p) {
  if (!SAFE_PATH.test(p)) throw new Error('unsafe path for a test line: ' + p);
  return '"' + p + '"';
}

let logSeq = 0;
function newLog() {
  logSeq += 1;
  const log = path.join(TMP, 'curl-' + logSeq + '.log');
  fs.writeFileSync(log, '');
  return log;
}

function env(log) {
  return {
    PATH: TEST_PATH,
    HOME: HOME,
    USERPROFILE: HOME,
    MINDRIAN_HOME: MH,
    MINDRIAN_ROOMS_HOME: RH,
    MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9',
    LANG: 'C',
    LC_ALL: 'C',
    TZ: 'UTC',
    CURL_STUB_LOG: log || path.join(TMP, 'curl-unused.log'),
  };
}

function result(r, log) {
  const urls = log && fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean) : [];
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '', urls: urls };
}

// sh: run one fixed line with `bash -c` in W. The line holds fixed text and temp paths only.
function sh(line) {
  const log = newLog();
  const r = spawnSync('bash', ['-c', line], { cwd: W, encoding: 'utf8', timeout: 120000, env: env(log) });
  return result(r, log);
}

// argv: run a script with an argument array and no shell.
function argv(script, args) {
  const log = newLog();
  const r = spawnSync('bash', [script].concat(args), { cwd: W, encoding: 'utf8', timeout: 120000, env: env(log) });
  return result(r, log);
}

function curlIsStub() {
  const r = spawnSync('bash', ['-c', 'command -v curl'], { cwd: W, encoding: 'utf8', env: env() });
  const got = (r.stdout || '').trim();
  if (got !== path.join(STUB, 'curl')) throw new Error('curl under the test PATH is not the stub: ' + got);
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
function file(text) {
  fileSeq += 1;
  const p = path.join(FILES, 'f' + fileSeq + '.txt');
  fs.writeFileSync(p, text);
  return p;
}

function speakerRoom(label, slug) {
  const room = path.join(TMP, 'room-' + label);
  const dir = path.join(room, 'team', 'advisors', slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'PROFILE.md'), ['---', 'name: Synthetic', 'role: advisor', 'first_meeting: 2026-01-01', 'research_status: pending', '---', '# Speaker', '', '## Context', '', '[To be filled after proactive research]', ''].join('\n'));
  return { room: room, profile: path.join(dir, 'PROFILE.md') };
}

function plainRoom(label) {
  const room = path.join(TMP, 'proom-' + label);
  fs.mkdirSync(room, { recursive: true });
  return room;
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

function firstSearch(stdout) {
  const l = stdout.split('\n').find(function (x) { return x.indexOf('1. ') === 0; });
  return l === undefined ? null : l;
}

function token(stdout) {
  const m = /^Approval token: ([0-9a-f]{16,})\s*$/m.exec(stdout);
  return m ? m[1] : null;
}

function registry() {
  const f = path.join(RH, '.rooms', 'registry.json');
  if (!fs.existsSync(f)) return { rooms: {} };
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

function lines(rel) { return fs.readFileSync(path.join(REPO, rel), 'utf8').split('\n'); }

function checkFileMeeting(rel) {
  const ls = lines(rel);
  const b = ls.findIndex(function (l) { return l.indexOf('approval-step-begin') !== -1; });
  const e = ls.findIndex(function (l) { return l.indexOf('approval-step-end') !== -1; });
  assert(b !== -1 && e > b, rel + ': approval markers absent');
  const rsIdx = [];
  ls.forEach(function (l, i) { if (l.indexOf('scripts/research-speaker"') !== -1) rsIdx.push(i); });
  assert(rsIdx.length === 3, rel + ': ' + rsIdx.length + ' research-speaker lines, want 3');
  const inside = rsIdx.filter(function (i) { return i > b && i < e; });
  assert(inside.length === 2, rel + ': ' + inside.length + ' research-speaker lines between the markers, want 2');
  for (const i of rsIdx) {
    const l = ls[i];
    assert(l.indexOf('--name-file "<dir>/speaker-name.txt"') !== -1, rel + ':' + (i + 1) + ' no --name-file');
    assert(l.indexOf('--context-file "<dir>/project-context.txt"') !== -1, rel + ':' + (i + 1) + ' no --context-file');
    assert(l.indexOf('<display-name>') === -1, rel + ':' + (i + 1) + ' holds <display-name>');
    assert(l.indexOf('"<project-context>"') === -1, rel + ':' + (i + 1) + ' holds "<project-context>"');
  }
  const block = ls.slice(b + 1, e).join('\n');
  for (const t of ['--list-queries', '--approve', 'mktemp -d']) assert(block.indexOf(t) !== -1, rel + ': the approval block has no ' + t);
  const third = ls[rsIdx[2]];
  assert(third.indexOf('--apply') !== -1 && third.indexOf('remove that directory') !== -1, rel + ': the third line has no --apply or no removal');
  const csp = ls.filter(function (l) { return l.indexOf('scripts/create-speaker-profile"') !== -1; });
  assert(csp.length >= 1, rel + ': no create-speaker-profile line');
  for (const l of csp) {
    for (const t of ['--role-file "<dir>/speaker-role.txt"', '--name-file "<dir>/speaker-name.txt"', 'mktemp -d', 'remove that directory']) {
      assert(l.indexOf(t) !== -1, rel + ': the create-speaker-profile line has no ' + t);
    }
    assert(l.indexOf('<display-name>') === -1 && l.indexOf('<speaker-role>') === -1, rel + ': the create-speaker-profile line holds a text placeholder');
  }
}

function checkRegistryLine(rel, wantStage) {
  const ls = lines(rel);
  const idx = [];
  ls.forEach(function (l, i) { if (l.indexOf('room-registry" create') !== -1) idx.push(i); });
  assert(idx.length >= 1, rel + ': no room-registry create line');
  for (const i of idx) {
    const l = ls[i];
    assert(l.indexOf('--name-file "<dir>/venture-name.txt"') !== -1, rel + ':' + (i + 1) + ' no --name-file');
    if (wantStage) assert(l.indexOf('--stage-file "<dir>/venture-stage.txt"') !== -1, rel + ':' + (i + 1) + ' no --stage-file');
    assert(l.indexOf('"<venture_name>"') === -1, rel + ':' + (i + 1) + ' holds "<venture_name>"');
    if (wantStage) assert(l.indexOf('"<venture_stage>"') === -1, rel + ':' + (i + 1) + ' holds "<venture_stage>"');
    let j = i - 1;
    while (j >= 0 && (ls[j].trim() === '' || /^\s*```/.test(ls[j]))) j -= 1;
    assert(j >= 0 && ls[j].indexOf('mktemp -d') !== -1 && ls[j].indexOf('remove that directory') !== -1, rel + ':' + (i + 1) + ' the write step above has no mktemp -d or no removal');
  }
}

const state = { s1Token: null, s1Room: null };

const CASES = [
  ['K0', 'control: a payload inside double quotes on a line runs', function () {
    const r = sh('printf "%s" "x $(touch bnd-canary-0)" >/dev/null');
    assert(r.status === 0, 'exit ' + r.status);
    const f = path.join(W, 'bnd-canary-0');
    assert(fs.existsSync(f), 'bnd-canary-0 was not made');
    fs.rmSync(f, { force: true });
  }],
  ['S1', 'research-speaker file form lists the searches with the name unchanged and sends nothing', function () {
    curlIsStub();
    const sr = speakerRoom('s1', 'bnd-speaker-rs');
    state.s1Room = sr;
    const nf = file(NAME_PAYLOAD + '\n');
    const cf = file(CONTEXT_PAYLOAD + '\n');
    const r = sh('bash ' + P(RS) + ' ' + P(sr.room) + ' bnd-speaker-rs --name-file ' + P(nf) + ' --context-file ' + P(cf) + ' --list-queries');
    assert(r.status === 0, 'exit ' + r.status + ' ' + r.stderr.slice(0, 200));
    assert(r.stdout.indexOf('Searches that would be sent (3):') !== -1, 'no list header: ' + r.stdout.slice(0, 200));
    const s = firstSearch(r.stdout);
    assert(s !== null && s.indexOf(NAME_PAYLOAD) !== -1, 'search 1 does not hold the name payload: ' + s);
    assert(r.stdout.indexOf('Nothing was sent.') !== -1, 'no "Nothing was sent."');
    assert(r.urls.length === 0, r.urls.length + ' stub calls');
    state.s1Token = token(r.stdout);
    noCanary();
  }],
  ['S2', 'research-speaker file form sends after approval and applies the context unchanged', function () {
    curlIsStub();
    assert(state.s1Token && state.s1Room, 'no token from S1');
    const nf = file(NAME_PAYLOAD + '\n');
    const cf = file(CONTEXT_PAYLOAD + '\n');
    const base = 'bash ' + P(RS) + ' ' + P(state.s1Room.room) + ' bnd-speaker-rs --name-file ' + P(nf) + ' --context-file ' + P(cf) + ' --approve ' + state.s1Token;
    const r = sh(base);
    assert(r.urls.length === 3, r.urls.length + ' stub calls, want 3');
    for (const u of r.urls) assert(u.indexOf('Dana') !== -1, 'a search has no Dana: ' + u.slice(0, 120));
    const a = sh(base + ' --apply');
    assert(a.stdout.indexOf('Profile updated:') !== -1, 'no "Profile updated:": ' + (a.stdout + a.stderr).slice(0, 200));
    const prof = fs.readFileSync(state.s1Room.profile, 'utf8');
    assert(prof.indexOf(CONTEXT_PAYLOAD) !== -1, 'PROFILE.md does not hold the context payload');
    noCanary();
  }],
  ['S3', 'research-speaker refuses a missing name file and an empty context file before any search', function () {
    curlIsStub();
    const sr = speakerRoom('s3', 'bnd-speaker-rs3');
    const missing = path.join(FILES, 'absent-name.txt');
    const cf = file(CONTEXT_PAYLOAD + '\n');
    const r = sh('bash ' + P(RS) + ' ' + P(sr.room) + ' bnd-speaker-rs3 --name-file ' + P(missing) + ' --context-file ' + P(cf) + ' --list-queries');
    assert(r.status === 1, 'missing name file: exit ' + r.status);
    assert(r.stderr.indexOf('--name-file') !== -1, 'missing name file: stderr has no --name-file: ' + r.stderr.slice(0, 200));
    assert(r.urls.length === 0, r.urls.length + ' stub calls');
    const nf = file(NAME_PAYLOAD + '\n');
    const empty = file('');
    const r2 = sh('bash ' + P(RS) + ' ' + P(sr.room) + ' bnd-speaker-rs3 --name-file ' + P(nf) + ' --context-file ' + P(empty) + ' --approve 0000000000000000');
    assert(r2.status === 1, 'empty context file: exit ' + r2.status);
    assert(r2.stderr.indexOf('--context-file') !== -1, 'empty context file: stderr has no --context-file');
    assert(r2.urls.length === 0, r2.urls.length + ' stub calls');
    noCanary();
  }],
  ['S4', 'research-speaker argument form by an argument array is unchanged', function () {
    curlIsStub();
    const sr = speakerRoom('s4', 'bnd-speaker-rs4');
    const r = argv(RS, [sr.room, 'bnd-speaker-rs4', 'Tyler Chen', 'EdTech tutoring', '--list-queries']);
    assert(r.status === 0, 'exit ' + r.status);
    const s = firstSearch(r.stdout);
    assert(s !== null && s.indexOf('"Tyler Chen"') !== -1, 'search 1: ' + s);
    assert(r.urls.length === 0, r.urls.length + ' stub calls');
  }],
  ['S5', 'the file-meeting instruction lines name files, not text placeholders', function () {
    checkFileMeeting('commands/file-meeting.md');
    checkFileMeeting('skills/file-meeting/SKILL.md');
  }],
  ['R1', 'room-registry file form stores the name and the stage unchanged', function () {
    const nf = file(VNAME_PAYLOAD + '\n');
    const sf = file(VSTAGE_PAYLOAD + '\n');
    const r = sh('bash ' + P(RR) + ' create bnd-room-a bnd-room-a --name-file ' + P(nf) + ' --stage-file ' + P(sf));
    assert(r.status === 0, 'exit ' + r.status + ' ' + r.stderr.slice(0, 300));
    const room = registry().rooms['bnd-room-a'];
    assert(room, 'the registry has no bnd-room-a');
    assert(room.venture_name === VNAME_PAYLOAD, 'venture_name: ' + room.venture_name);
    assert(room.venture_stage === VSTAGE_PAYLOAD, 'venture_stage: ' + room.venture_stage);
    const rm = fs.readFileSync(path.join(RH, 'bnd-room-a', 'ROOM.md'), 'utf8');
    assert(rm.split('\n').indexOf('venture_name: ' + VNAME_PAYLOAD) !== -1, 'ROOM.md has no venture_name line with the payload');
    noCanary();
  }],
  ['R2', 'room-registry file form takes the first line of the name file only', function () {
    const nf = file('Acme Two\nroom_id: injected\n');
    const r = sh('bash ' + P(RR) + ' create bnd-room-b bnd-room-b --name-file ' + P(nf));
    assert(r.status === 0, 'exit ' + r.status + ' ' + r.stderr.slice(0, 300));
    const room = registry().rooms['bnd-room-b'];
    assert(room && room.venture_name === 'Acme Two', 'venture_name: ' + (room && room.venture_name));
    const rm = fs.readFileSync(path.join(RH, 'bnd-room-b', 'ROOM.md'), 'utf8');
    const n = rm.split('\n').filter(function (l) { return l.indexOf('room_id:') === 0; }).length;
    assert(n === 1, n + ' room_id lines in ROOM.md');
  }],
  ['R3', 'room-registry refuses a missing name file and makes nothing', function () {
    const missing = path.join(FILES, 'absent-venture.txt');
    const r = sh('bash ' + P(RR) + ' create bnd-room-c bnd-room-c --name-file ' + P(missing));
    assert(r.status === 1, 'exit ' + r.status);
    assert(r.stderr.indexOf('--name-file') !== -1, 'stderr has no --name-file: ' + r.stderr.slice(0, 200));
    assert(!fs.existsSync(path.join(RH, 'bnd-room-c')), 'the folder bnd-room-c exists');
    assert(!registry().rooms['bnd-room-c'], 'the registry has bnd-room-c');
  }],
  ['R4', 'room-registry argument form by an argument array is unchanged', function () {
    const r = argv(RR, ['create', 'bnd-room-d', 'bnd-room-d', 'New Room', 'Pre-Opportunity']);
    assert(r.status === 0, 'exit ' + r.status + ' ' + r.stderr.slice(0, 300));
    const room = registry().rooms['bnd-room-d'];
    assert(room && room.venture_name === 'New Room' && room.venture_stage === 'Pre-Opportunity', 'stored: ' + JSON.stringify(room));
  }],
  ['R5', 'room-registry file form with the name file only uses the default stage', function () {
    const nf = file('Solo Venture\n');
    const r = sh('bash ' + P(RR) + ' create bnd-room-e bnd-room-e --name-file ' + P(nf));
    assert(r.status === 0, 'exit ' + r.status + ' ' + r.stderr.slice(0, 300));
    const room = registry().rooms['bnd-room-e'];
    assert(room && room.venture_stage === 'Pre-Opportunity', 'venture_stage: ' + (room && room.venture_stage));
  }],
  ['R6', 'the new-project and rooms instruction lines name files, not text placeholders', function () {
    checkRegistryLine('commands/new-project.md', true);
    checkRegistryLine('skills/new-project/SKILL.md', true);
    checkRegistryLine('commands/rooms.md', false);
    checkRegistryLine('skills/rooms/SKILL.md', false);
  }],
  ['P1', 'create-speaker-profile file form stores the name unchanged', function () {
    const room = plainRoom('p1');
    const rf = file('advisor\n');
    const nf = file(NAME_PAYLOAD + '\n');
    const r = sh('bash ' + P(CSP) + ' ' + P(room) + ' bnd-speaker-a --role-file ' + P(rf) + ' --name-file ' + P(nf));
    assert(r.status === 0, 'exit ' + r.status + ' ' + r.stderr.slice(0, 300));
    const dir = path.join(room, 'team', 'advisors', 'bnd-speaker-a');
    assert(r.stdout.indexOf(dir) !== -1, 'stdout has no profile folder: ' + r.stdout.slice(0, 200));
    const prof = fs.readFileSync(path.join(dir, 'PROFILE.md'), 'utf8');
    assert(prof.split('\n').indexOf('name: ' + NAME_PAYLOAD) !== -1, 'PROFILE.md has no name line with the payload');
    noCanary();
  }],
  ['P2', 'create-speaker-profile refuses a missing name file and a bad role before any folder', function () {
    const room = plainRoom('p2');
    const rf = file('advisor\n');
    const missing = path.join(FILES, 'absent-speaker.txt');
    const r = sh('bash ' + P(CSP) + ' ' + P(room) + ' bnd-speaker-b --role-file ' + P(rf) + ' --name-file ' + P(missing));
    assert(r.status === 1, 'missing name file: exit ' + r.status);
    assert(r.stderr.indexOf('--name-file') !== -1, 'stderr has no --name-file: ' + r.stderr.slice(0, 200));
    assert(!fs.existsSync(path.join(room, 'team', 'advisors', 'bnd-speaker-b')), 'the folder bnd-speaker-b exists');
    const bad = file('wizard\n');
    const nf = file('Pat Lee\n');
    const r2 = sh('bash ' + P(CSP) + ' ' + P(room) + ' bnd-speaker-c --role-file ' + P(bad) + ' --name-file ' + P(nf));
    assert(r2.status === 1, 'bad role: exit ' + r2.status);
    assert(!fs.existsSync(path.join(room, 'team')), 'a folder under team was made');
  }],
  ['P3', 'create-speaker-profile argument form by an argument array is unchanged', function () {
    const room = plainRoom('p3');
    const r = argv(CSP, [room, 'bnd-speaker-d', 'researcher', 'Tyler Chen']);
    assert(r.status === 0, 'exit ' + r.status + ' ' + r.stderr.slice(0, 300));
    const prof = fs.readFileSync(path.join(room, 'team', 'researchers', 'bnd-speaker-d', 'PROFILE.md'), 'utf8');
    assert(prof.split('\n').indexOf('name: Tyler Chen') !== -1, 'PROFILE.md has no name: Tyler Chen');
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
    // room-registry starts a background graph sync; give it time to end, then remove with force.
    spawnSync('sleep', ['1']);
    fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
  process.stdout.write('261127-bnd shell-args-bash: ' + p + ' passed, ' + f + ' failed\n');
  for (const m of failures) process.stdout.write('    ' + m.slice(0, 600) + '\n');
  process.exit(f ? 1 : 0);
}

main();
