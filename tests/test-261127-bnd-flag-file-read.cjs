#!/usr/bin/env node
'use strict';

/*
 * Quick 261127-bnd follow-up: the read rule of every file flag of this branch.
 *
 * Reason: an independent verifier found 3 defects in the new file-flag readers.
 *   d1: the size cap trusted the stat size (a pseudo-file with stat size 0 gave a
 *       66248-byte read with a cap of 65536).
 *   d2: a reader had no regular-file check (a FIFO made the reader hang).
 *   d3: a large one-line file was slow (1 MB took 83 s) and a 5 MB file ignored SIGTERM.
 *
 * The one rule for each reader: (a) refuse a path that is not a regular file (a
 * symlink to a regular file stays allowed, as today); (b) read at most cap + 1
 * bytes from the open file and refuse more than cap, never trust the stat size;
 * (c) take a time that does not grow with the file size beyond the cap; (d) refuse
 * a NUL byte; (e) refuse with the existing refusal form of the script, before any
 * write and before any folder is made.
 *
 * The 17 readers (11 scripts): claim-checks --words-file and --against-file;
 * room-question --text-file and --account-file; rs-experts --topic-file;
 * close-loop version-log --topic-file (cap 1048576, the existing readInput cap);
 * dominant-design-research file-pack --header-file; mindrian-tools
 * bank-opportunity --file; create-speaker-profile --role-file and --name-file;
 * research-speaker --name-file and --context-file; room-registry create
 * --name-file and --stage-file.
 *
 * The 9 cases of each reader: fifo, dir, missing, capplus1 (one line of cap + 1
 * bytes), proc (/proc/kallsyms: stat size 0, more than 1 MiB of text; skipped
 * with a reason where it is absent or short), nul, big (one line of 1 MiB + 1
 * bytes, refused in under 2 seconds), symlink (a symlink to a valid file is
 * accepted), valid (a valid file is accepted). A refusal case also checks that
 * the room folder, the home folder and the work folder did not change.
 *
 * Each run has a timeout of 15 s with SIGKILL, so a hang is a failure and not a
 * stuck test. Temp HOME, MINDRIAN_HOME and MINDRIAN_ROOMS_HOME; no network
 * (MINDRIAN_BRAIN_URL=http://127.0.0.1:9). Node built-in modules only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bnd-ff-')));
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
const S = (n) => path.join(REPO, 'scripts', n);
const NODE = process.execPath;
const SMALL = 65536;
const LARGE = 1048576;
const BIG = 1048576 + 1;
const TIME_LIMIT_MS = 2000;
const RUN_TIMEOUT_MS = 15000;

const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');

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

function run(cmd, args, extra) {
  const t0 = Date.now();
  const r = spawnSync(cmd, args, { cwd: W, encoding: 'utf8', timeout: RUN_TIMEOUT_MS, killSignal: 'SIGKILL', env: env(extra), maxBuffer: 64 * 1024 * 1024 });
  return { status: r.status, signal: r.signal, ms: Date.now() - t0, out: (r.stdout || '') + (r.stderr || '') };
}

let seq = 0;
function file(content) {
  seq += 1;
  const p = path.join(FILES, 'f' + seq + '.txt');
  fs.writeFileSync(p, content);
  return p;
}
function fresh(name) {
  seq += 1;
  return path.join(TMP, name + '-' + seq);
}
function makeRoom() {
  const dir = fresh('room');
  fs.mkdirSync(dir, { recursive: true });
  const db = openRoomDb(dir);
  closeRoomDb(db);
  return dir;
}

// tree: a hash of the names and the bytes of every file under a folder (no -wal, no -shm).
function tree(dir) {
  const h = crypto.createHash('sha256');
  (function walk(d) {
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { h.update('absent:' + d); return; }
    ents.sort((a, b) => (a.name < b.name ? -1 : 1));
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (/-(wal|shm)$/.test(e.name)) continue;
      h.update(path.relative(dir, p) + '\n');
      if (e.isDirectory() && !e.isSymbolicLink()) walk(p);
      else if (e.isFile()) h.update(fs.readFileSync(p));
    }
  })(dir);
  return h.digest('hex');
}

const VALID_TEXT = 'harbor crane\n';
const OPP = JSON.stringify({ problem: 'slow harbor cranes', mirror_solution: 'faster cranes', domain: 'health', evidence: 'conversation with user', source_framework: 'conversation', knight_position: 'uncertainty', confidence: 0.5 });

// Each reader: the flag, the cap, a valid content and build(fileArg) -> { cmd, args, env, room, watch }.
// refused: the pattern of the existing refusal form of the script for that flag.
const READERS = [
  {
    id: 'claim-checks --words-file', cap: SMALL, valid: VALID_TEXT, refused: /--words-file needs a readable file/,
    build(f) { const room = makeRoom(); return { room, cmd: NODE, args: ['--no-warnings', S('claim-checks.cjs'), 'show', '--room', room, '--words-file', f] }; },
  },
  {
    id: 'claim-checks --against-file', cap: SMALL, valid: VALID_TEXT, refused: /--against-file needs a readable file/,
    build(f) { const room = makeRoom(); return { room, cmd: NODE, args: ['--no-warnings', S('claim-checks.cjs'), 'record', '--room', room, '--claim', 'claim-none', '--against-file', f, '--against-kind', 'observation', '--rung', '3', '--method', 'compare', '--result', 'supports'] }; },
  },
  {
    id: 'room-question --text-file', cap: SMALL, valid: 'What problem matters\n', refused: /--text-file needs a readable file/,
    build(f) { const room = makeRoom(); return { room, cmd: NODE, args: ['--no-warnings', S('room-question.cjs'), 'set', '--room', room, '--origin', 'chosen', '--text-file', f] }; },
  },
  {
    id: 'room-question --account-file', cap: SMALL, valid: 'It named the wrong user\n', refused: /--account-file needs a readable file/,
    build(f) { const room = makeRoom(); const q = file('Which problem matters more\n'); return { room, cmd: NODE, args: ['--no-warnings', S('room-question.cjs'), 'set', '--room', room, '--origin', 'chosen', '--based-on', '1', '--text-file', q, '--account-file', f] }; },
  },
  {
    id: 'rs-experts --topic-file', cap: SMALL, valid: 'grid storage\n', refused: /Topic file refused/,
    build(f) { const room = makeRoom(); return { room, cmd: NODE, args: ['--no-warnings', S('rs-experts-command.cjs'), '--topic-file', f], env: { MINDRIAN_ROOM: room } }; },
  },
  {
    id: 'close-loop version-log --topic-file', cap: LARGE, valid: JSON.stringify({ topic: 'grid storage' }), refused: /topic_(unreadable|too_large|not_json)/,
    build(f) { const room = makeRoom(); return { room, cmd: NODE, args: ['--no-warnings', S('close-loop.cjs'), 'version-log', '--room', room, '--topic-file', f] }; },
  },
  {
    id: 'dominant-design-research file-pack --header-file', cap: SMALL, valid: JSON.stringify({ room_label: 'Solar Ventures', stage: 'Validate' }), refused: /--header-file needs a readable file/,
    build(f) { const room = makeRoom(); const pack = fresh('pack'); fs.mkdirSync(pack); return { room, watch: [pack], cmd: NODE, args: ['--no-warnings', S('dominant-design-research.cjs'), 'file-pack', '--pack', pack, '--room', room, '--domain-slug', 'solar-cells', '--date', '2026-09-23', '--header-file', f] }; },
  },
  {
    id: 'mindrian-tools bank-opportunity --file', cap: SMALL, valid: OPP, refused: /bank-opportunity --file (needs a readable|holds text that is not JSON)/,
    build(f) { const room = makeRoom(); return { room, cmd: NODE, args: ['--no-warnings', S('mindrian-tools.cjs'), 'bank-opportunity', room, '--file', f] }; },
  },
  {
    id: 'create-speaker-profile --role-file', cap: SMALL, valid: 'mentor\n', refused: /ERROR: --role-file needs a readable file/,
    build(f) { const room = makeRoom(); const n = file('Ada Example\n'); return { room, cmd: 'bash', args: [S('create-speaker-profile'), room, 'bnd-speaker', '--role-file', f, '--name-file', n] }; },
  },
  {
    id: 'create-speaker-profile --name-file', cap: SMALL, valid: 'Ada Example\n', refused: /ERROR: --name-file needs a readable file/,
    build(f) { const room = makeRoom(); const r = file('mentor\n'); return { room, cmd: 'bash', args: [S('create-speaker-profile'), room, 'bnd-speaker', '--role-file', r, '--name-file', f] }; },
  },
  {
    id: 'research-speaker --name-file', cap: SMALL, valid: 'Ada Example\n', refused: /ERROR: --name-file needs a readable file/,
    build(f) { const room = makeRoom(); const c = file('grid storage\n'); return { room, cmd: 'bash', args: [S('research-speaker'), room, 'bnd-speaker', '--name-file', f, '--context-file', c, '--list-queries'] }; },
  },
  {
    id: 'research-speaker --context-file', cap: SMALL, valid: 'grid storage\n', refused: /ERROR: --context-file needs a readable file/,
    build(f) { const room = makeRoom(); const n = file('Ada Example\n'); return { room, cmd: 'bash', args: [S('research-speaker'), room, 'bnd-speaker', '--name-file', n, '--context-file', f, '--list-queries'] }; },
  },
  {
    id: 'room-registry create --name-file', cap: SMALL, valid: 'Harbor Cranes\n', refused: /Cannot create room -- the file of --name-file/,
    build(f) { const room = fresh('newroom'); return { room, cmd: 'bash', args: [S('room-registry'), 'create', path.basename(room), room, '--name-file', f] }; },
  },
  {
    id: 'room-registry create --stage-file', cap: SMALL, valid: 'Pre-Opportunity\n', refused: /Cannot create room -- the file of --stage-file/,
    build(f) { const room = fresh('newroom'); const n = file('Harbor Cranes\n'); return { room, cmd: 'bash', args: [S('room-registry'), 'create', path.basename(room), room, '--name-file', n, '--stage-file', f] }; },
  },
];

function mkfifo() {
  const p = fresh('fifo');
  const r = spawnSync('mkfifo', [p]);
  return r.status === 0 ? p : null;
}

const PROC = '/proc/kallsyms';
function procSkip() {
  if (process.platform !== 'linux') return 'not Linux: no /proc pseudo-file';
  try {
    if (fs.statSync(PROC).size !== 0) return PROC + ' has a stat size that is not 0';
    const fd = fs.openSync(PROC, 'r');
    const b = Buffer.alloc(BIG + 1);
    let got = 0;
    for (;;) { const n = fs.readSync(fd, b, got, b.length - got, null); if (n === 0 || got + n >= b.length) { got += n; break; } got += n; }
    fs.closeSync(fd);
    if (got <= BIG) return PROC + ' holds ' + got + ' bytes only';
  } catch (e) { return PROC + ' is not readable: ' + e.code; }
  return null;
}
const PROC_SKIP = procSkip();

// The case inputs. Each returns the file argument, or { skip: reason }.
const CASES = {
  fifo: () => mkfifo() || { skip: 'mkfifo failed' },
  dir: () => { const d = fresh('dir'); fs.mkdirSync(d); return d; },
  missing: () => fresh('missing') + '.txt',
  capplus1: (rd) => file('a'.repeat(rd.cap + 1)),
  proc: () => (PROC_SKIP ? { skip: PROC_SKIP } : PROC),
  nul: () => file('ab\u0000cd\n'),
  big: () => file('a'.repeat(BIG)),
  symlink: (rd) => { const t = file(rd.valid); const l = fresh('link') + '.txt'; fs.symlinkSync(t, l); return l; },
  valid: (rd) => file(rd.valid),
};
const ACCEPT = new Set(['symlink', 'valid']);

let pass = 0;
let fail = 0;
let skip = 0;
const failures = [];

for (const rd of READERS) {
  for (const name of Object.keys(CASES)) {
    const label = rd.id + ' / ' + name;
    const f = CASES[name](rd);
    if (f && typeof f === 'object' && f.skip) { skip += 1; console.log('SKIP ' + label + ': ' + f.skip); continue; }
    const b = rd.build(f);
    const watch = [b.room, HOME, W].concat(b.watch || []);
    const before = watch.map(tree);
    const r = run(b.cmd, b.args, b.env);
    let why = null;
    if (r.signal) why = 'killed by ' + r.signal + ' after ' + r.ms + ' ms (a hang)';
    else if (ACCEPT.has(name)) {
      if (rd.refused.test(r.out)) why = 'a valid file was refused: ' + r.out.trim().split('\n')[0].slice(0, 160);
    } else {
      if (r.status === 0) why = 'exit 0, want a refusal';
      else if (!rd.refused.test(r.out)) why = 'exit ' + r.status + ' without the refusal form: ' + r.out.trim().split('\n').slice(0, 2).join(' | ').slice(0, 200);
      else {
        const after = watch.map(tree);
        const moved = watch.filter((_d, i) => before[i] !== after[i]);
        if (moved.length) why = 'refused, but a folder changed: ' + moved.map((d) => path.relative(TMP, d) || d).join(', ');
        else if (name === 'big' && r.ms >= TIME_LIMIT_MS) why = 'refused in ' + r.ms + ' ms, limit ' + TIME_LIMIT_MS + ' ms';
      }
    }
    if (why) { fail += 1; failures.push(label + ': ' + why); console.log('FAIL ' + label + ': ' + why); }
    else { pass += 1; console.log('PASS ' + label + ' (' + r.ms + ' ms)'); }
  }
}

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) { /* a FIFO or a link is removed with the folder */ }
console.log('');
console.log('flag-file-read: ' + pass + ' passed, ' + fail + ' failed, ' + skip + ' skipped');
process.exit(fail === 0 ? 0 : 1);
