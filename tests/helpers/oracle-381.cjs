'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 381 Plan 01 (PERF381-01, PERF381-05): the OLD oracle and the comparison helpers of the
 * parity gate. tests/test-381-parity.cjs drives them.
 *
 * BASE_SHA = HEAD after quick sc6 4f470032b (which lands after quick D 261029-s9x) and the
 * injection hotfix quick 261029-u8x (at or after 5a2dcfd4d), recorded by plan 381-01 (ruling 9).
 * ORACLE_381_BASE_SHA overrides it.
 *
 * Parity contract (ruling 3): every child runs with LC_ALL=C.UTF-8 and a pinned TZ. Only the
 * "computed:" timestamp lines and the FUND_STALE day digits are normalized. Stdout bytes, the
 * exit code and the full post-run tree content are compared.
 *
 * Safety (T-381-03): no script ever runs on a source room. Every run uses a fresh "cp -a" copy
 * under os.tmpdir(); assertSafeTarget guards every copy target and every cwd. The only git use is
 * the read-only "git archive" of BASE_SHA. No network (net-guard-381.cjs is preloaded).
 *
 * Hyphens only.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { isUtf8 } = require('node:buffer');

const REPO = path.resolve(__dirname, '..', '..');
const { assertSafeTarget } = require(path.join(REPO, 'tests', 'fixtures', 'room-381', 'build-fixture.cjs'));

const BASE_SHA = process.env.ORACLE_381_BASE_SHA || '65aaf329f9c514c71fff2f1a530cd366c0b87b66';
const BASE_EPOCH = Date.UTC(2026, 0, 15, 12, 0, 0) / 1000;
const NET_GUARD = path.join(REPO, 'tests', 'helpers', 'net-guard-381.cjs');
const MODE = { 'compute-team': 'team', 'analyze-room': 'analyze', 'compute-state': 'state' };

// Repository fixture rooms (relative to tests/fixtures) that join the gate. A missing one is
// reported by the harness and not counted.
const FIXTURE_ROOMS = [
  'sample-room',
  'sample-room-opp',
  'sample-room-personas',
  'test-room-causal',
  'test-room-graph',
  'test-room-meeting',
  'test-room-reasoning',
  'test-room-visual',
  'wiki-room-232',
  'icm-rooms/alpha-room',
  '272/room',
  '195-nested-room-tree/root-room',
  'release-room',
  'futures-seed-room',
  'graph-export-golden-room',
  'never-ready-room',
];

// ---------------------------------------------------------------------------
// temp dirs
// ---------------------------------------------------------------------------
const TMP_DIRS = [];
function mkTmp(label) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'oracle-381-' + label + '-'));
  assertSafeTarget(d);
  TMP_DIRS.push(d);
  return d;
}
let keepTmp = false;
function setKeep(flag) {
  keepTmp = !!flag;
}
function dropTmp(d) {
  if (keepTmp) return;
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  const i = TMP_DIRS.indexOf(d);
  if (i >= 0) TMP_DIRS.splice(i, 1);
}
function cleanupTmp() {
  if (keepTmp) return;
  while (TMP_DIRS.length) {
    const d = TMP_DIRS.pop();
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
}

// ---------------------------------------------------------------------------
// OLD tree: git archive of BASE_SHA (read-only git use)
// ---------------------------------------------------------------------------
const treeCache = new Map();
function buildOldTree(sha) {
  const ref = sha || BASE_SHA;
  if (treeCache.has(ref)) return treeCache.get(ref);
  const tmp = mkTmp('old');
  const tar = path.join(tmp, 'old.tar');
  const a = spawnSync('git', ['archive', '-o', tar, ref, 'scripts', 'lib', 'references', 'data', 'package.json', '.claude-plugin'], {
    cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'],
  });
  if (a.status !== 0) throw new Error('git archive ' + ref + ' failed: ' + String(a.stderr || '').trim());
  const x = spawnSync('tar', ['-xf', tar, '-C', tmp], { encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'] });
  if (x.status !== 0) throw new Error('tar extract failed: ' + String(x.stderr || '').trim());
  fs.rmSync(tar, { force: true });
  const nm = path.join(REPO, 'node_modules');
  if (fs.existsSync(nm)) {
    try { fs.symlinkSync(nm, path.join(tmp, 'node_modules'), 'dir'); } catch (_e) { /* best effort */ }
  }
  treeCache.set(ref, tmp);
  return tmp;
}

// ---------------------------------------------------------------------------
// clean env, copy, mtime pin, registry
// ---------------------------------------------------------------------------
function cleanEnv(o) {
  const opts = o || {};
  const env = {
    PATH: path.dirname(process.execPath) + ':/usr/bin:/bin',
    HOME: opts.home,
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8',
    MINDRIAN_ROOMS_HOME: opts.roomsHome,
    NODE_OPTIONS: '--require ' + NET_GUARD,
  };
  const tz = opts.tz === undefined ? 'UTC' : opts.tz;
  if (tz !== 'host') env.TZ = tz;
  Object.keys(opts.extra || {}).forEach((k) => { env[k] = opts.extra[k]; });
  return env;
}

function copyRoom(src, dst) {
  assertSafeTarget(dst);
  const r = spawnSync('cp', ['-a', src, dst], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('cp -a failed for ' + src + ': ' + String(r.stderr || '').trim());
}

// Entries (relative paths) in byte-sorted order, symlinks not followed.
function listEntries(root) {
  const out = [];
  (function walk(dir, rel) {
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return; }
    ents.forEach((e) => {
      const r = rel ? rel + '/' + e.name : e.name;
      out.push(r);
      if (e.isDirectory()) walk(path.join(dir, e.name), r);
    });
  })(root, '');
  out.sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
  return out;
}

function pinMtimes(dir, mode) {
  const entries = listEntries(dir);
  const stamp = (p, t) => {
    try { fs.lutimesSync(p, t, t); } catch (_e) { /* an unsupported entry keeps its time */ }
  };
  entries.forEach((rel, i) => {
    const t = mode === 'equal' ? BASE_EPOCH : BASE_EPOCH + 60 * i;
    stamp(path.join(dir, rel), t);
  });
  stamp(dir, BASE_EPOCH);
}

function writeRegistry(roomsHome, slug, roomPath) {
  const dir = path.join(roomsHome, '.rooms');
  const file = path.join(dir, 'registry.json');
  if (roomPath === null || roomPath === undefined) {
    fs.rmSync(file, { force: true });
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
  const rooms = {};
  rooms[slug] = { abs_path: roomPath };
  fs.writeFileSync(file, JSON.stringify({ active: slug, rooms }));
}

// ---------------------------------------------------------------------------
// run one script
// ---------------------------------------------------------------------------
function runScript(o) {
  const t0 = Date.now();
  let r;
  if (o.direct) {
    const env = Object.assign({}, o.env, { NODE_NO_WARNINGS: '1' });
    r = spawnSync(process.execPath, [path.join(o.tree, 'lib', 'core', 'room-render.cjs'), MODE[o.script], o.roomArg], {
      cwd: o.cwd, env, maxBuffer: 1 << 28, timeout: 600000,
    });
  } else {
    r = spawnSync('bash', [path.join(o.tree, 'scripts', o.script), o.roomArg], {
      cwd: o.cwd, env: o.env, maxBuffer: 1 << 28, timeout: 600000,
    });
  }
  return {
    stdout: r.stdout || Buffer.alloc(0),
    stderr: r.stderr || Buffer.alloc(0),
    status: r.status === null ? ('signal:' + r.signal) : r.status,
    ms: Date.now() - t0,
  };
}

// ---------------------------------------------------------------------------
// normalization and tree digest
// ---------------------------------------------------------------------------
function normalizeText(buf) {
  const s = Buffer.from(buf).toString('latin1')
    .replace(/^computed: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/gm, 'computed: <T>')
    .replace(/FUND_STALE:([^:\n]*):\d+/g, 'FUND_STALE:$1:<N>');
  return Buffer.from(s, 'latin1');
}

function treeDigest(dir) {
  const map = new Map();
  listEntries(dir).forEach((rel) => {
    const p = path.join(dir, rel);
    let st;
    try { st = fs.lstatSync(p); } catch (_e) { return; }
    if (st.isSymbolicLink()) {
      let target = '?';
      try { target = fs.readlinkSync(p); } catch (_e) { /* keep ? */ }
      map.set(rel, 'L:' + target);
    } else if (st.isDirectory()) {
      map.set(rel, 'D');
    } else {
      let content = Buffer.alloc(0);
      try { content = fs.readFileSync(p); } catch (_e) { /* unreadable counts as empty */ }
      map.set(rel, 'F:' + crypto.createHash('sha256').update(normalizeText(content)).digest('hex'));
    }
  });
  return map;
}

function treeDiff(a, b) {
  const out = [];
  const keys = new Set([...a.keys(), ...b.keys()]);
  Array.from(keys).sort().forEach((k) => {
    if (!a.has(k)) out.push('tree: only in NEW: ' + JSON.stringify(k));
    else if (!b.has(k)) out.push('tree: only in OLD: ' + JSON.stringify(k));
    else if (a.get(k) !== b.get(k)) out.push('tree: content differs: ' + JSON.stringify(k));
  });
  return out;
}

// ---------------------------------------------------------------------------
// stdout comparison
// ---------------------------------------------------------------------------
function splitLines(buf) {
  const s = buf.toString('latin1');
  return s.split('\n');
}

function cutAtUntil(buf, until) {
  if (!until) return buf;
  const lines = splitLines(buf);
  const i = lines.indexOf(until);
  if (i < 0) return buf;
  return Buffer.from(lines.slice(0, i).join('\n'), 'latin1');
}

function stdoutDiff(oldBuf, newBuf) {
  if (oldBuf.equals(newBuf)) return [];
  const a = splitLines(oldBuf);
  const b = splitLines(newBuf);
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  const out = ['stdout differs at line ' + (i + 1) + ' (OLD ' + a.length + ' lines, NEW ' + b.length + ' lines)'];
  for (let k = i; k < Math.min(i + 3, a.length); k += 1) out.push('OLD: ' + JSON.stringify(a[k]));
  for (let k = i; k < Math.min(i + 3, b.length); k += 1) out.push('NEW: ' + JSON.stringify(b[k]));
  return out;
}

// ---------------------------------------------------------------------------
// comparePair
// ---------------------------------------------------------------------------
function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

function readLog(file) {
  try { return fs.readFileSync(file, 'utf8').trim(); } catch (_e) { return ''; }
}

function runSide(side, ctx) {
  const root = mkTmp('side');
  const home = path.join(root, 'home');
  const roomsHome = path.join(root, 'rooms-home');
  const cwd = path.join(root, 'cwd');
  [home, roomsHome, cwd].forEach((d) => { assertSafeTarget(d); fs.mkdirSync(d, { recursive: true }); });
  const log = path.join(root, 'net.log');
  let roomArg = ctx.srcRoom;
  let digest = new Map();
  const haveRoom = ctx.hasSource;
  if (haveRoom) {
    fs.rmSync(ctx.runRoom, { recursive: true, force: true });
    copyRoom(ctx.srcRoom, ctx.runRoom);
    pinMtimes(ctx.runRoom, ctx.mtimeMode);
    roomArg = ctx.runRoom;
    if (ctx.registry) writeRegistry(roomsHome, path.basename(ctx.srcRoom) || 'room', ctx.runRoom);
  }
  const env = cleanEnv({ home, roomsHome, tz: ctx.tz, extra: Object.assign({ NET_GUARD_381_LOG: log }, side.env || {}) });
  const res = runScript({ tree: side.tree, script: ctx.script, roomArg, env, direct: !!side.direct, cwd });
  if (haveRoom) {
    if (!ctx.noTree) digest = treeDigest(ctx.runRoom);
    fs.rmSync(ctx.runRoom, { recursive: true, force: true });
  }
  let cwdFiles = [];
  try { cwdFiles = fs.readdirSync(cwd); } catch (_e) { /* ignore */ }
  res.cwdFiles = cwdFiles;
  res.net = readLog(log);
  res.digest = digest;
  res.root = root;
  return res;
}

function comparePair(o) {
  const hasSource = fs.existsSync(o.srcRoom);
  const pairRoot = mkTmp('pair');
  const ctx = {
    script: o.script,
    srcRoom: o.srcRoom,
    hasSource,
    runRoom: path.join(pairRoot, 'room'),
    mtimeMode: o.mtimeMode || 'stagger',
    registry: o.registry !== false && o.script === 'compute-state',
    tz: o.tz === undefined ? 'UTC' : o.tz,
    noTree: !!o.noTree,
  };
  let oldRes;
  let newRes;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const day0 = utcDay();
    oldRes = runSide(o.oldSide, ctx);
    newRes = runSide(o.newSide, ctx);
    if (utcDay() === day0) break;
  }

  const diffs = [];
  if (oldRes.status !== newRes.status) diffs.push('exit code: OLD ' + oldRes.status + ' NEW ' + newRes.status);
  const oldOut = cutAtUntil(normalizeText(oldRes.stdout), o.until);
  const newOut = cutAtUntil(normalizeText(newRes.stdout), o.until);
  stdoutDiff(oldOut, newOut).forEach((l) => diffs.push(l));
  if (oldRes.stderr.length === 0 && newRes.stderr.length > 0) {
    diffs.push('NEW stderr is not empty while OLD stderr is empty: ' + JSON.stringify(newRes.stderr.toString('utf8').slice(0, 200)));
  }
  if (!ctx.noTree && hasSource) treeDiff(oldRes.digest, newRes.digest).forEach((l) => diffs.push(l));
  [['OLD', oldRes], ['NEW', newRes]].forEach((pair) => {
    if (pair[1].cwdFiles.length) diffs.push('marker file in run cwd (' + pair[0] + '): ' + JSON.stringify(pair[1].cwdFiles));
    if (pair[1].net) diffs.push('network attempt (' + pair[0] + '): ' + pair[1].net.split('\n')[0]);
  });
  dropTmp(oldRes.root);
  dropTmp(newRes.root);
  dropTmp(pairRoot);
  return { ok: diffs.length === 0, diffs, oldMs: oldRes.ms, newMs: newRes.ms };
}

// ---------------------------------------------------------------------------
// gatePrecondition: divergence shapes a gate room must not carry (ruling 2)
// ---------------------------------------------------------------------------
const LARGE_FILE_BYTES = 65536;

function checkBytes(file, rel, found) {
  let buf;
  try { buf = fs.readFileSync(file); } catch (_e) { return; }
  if (!isUtf8(buf) || buf.includes(0)) found.push('invalid UTF-8 or NUL: ' + rel);
}

function gatePrecondition(roomDir) {
  const found = [];
  let top;
  try { top = fs.readdirSync(roomDir, { withFileTypes: true }); } catch (_e) { return found; }
  top.forEach((e) => {
    const p = path.join(roomDir, e.name);
    let st;
    try { st = fs.statSync(p); } catch (_e) { return; }
    if (!st.isDirectory()) return;
    if (e.name === 'team') {
      (function walk(dir, rel) {
        let ents;
        try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return; }
        ents.forEach((x) => {
          const r = rel + '/' + x.name;
          if (x.isDirectory()) walk(path.join(dir, x.name), r);
          else if (x.isFile()) checkBytes(path.join(dir, x.name), r, found);
        });
      })(p, 'team');
      return;
    }
    let ents;
    try { ents = fs.readdirSync(p, { withFileTypes: true }); } catch (_e) { return; }
    ents.forEach((x) => {
      const fp = path.join(p, x.name);
      let fst;
      try { fst = fs.statSync(fp); } catch (_e) { return; }
      if (!fst.isFile()) return;
      const rel = e.name + '/' + x.name;
      checkBytes(fp, rel, found);
      if (fst.size > LARGE_FILE_BYTES) found.push('file over 64 KiB: ' + rel + ' (' + fst.size + ' bytes)');
    });
  });
  return found;
}

module.exports = {
  BASE_SHA,
  BASE_EPOCH,
  FIXTURE_ROOMS,
  MODE,
  buildOldTree,
  cleanEnv,
  copyRoom,
  pinMtimes,
  writeRegistry,
  runScript,
  treeDigest,
  normalizeText,
  comparePair,
  gatePrecondition,
  mkTmp,
  cleanupTmp,
  setKeep,
  listEntries,
};
