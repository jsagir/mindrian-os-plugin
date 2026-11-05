#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 383 Plan 02 Task 1 (QA383-06). Wave 0, RED-first.
 *
 * A room create or switch that fails must carry two things: the verbatim failure line (for the bug seed
 * and the log) and a `plain` three-line message for the person (what happened, Why, Fix) with no path,
 * no traceback and no raw child text.
 *
 *   L1  navigation.birthRoom with a failing registry: reason registry_create_failed*, stderr kept, plain 3 lines (RED)
 *   L2  answerRoomCreation with a failed resume: top-level plain, same shape (RED)
 *   L3  openRoom with a failing registry: set_active_failed, stderr kept, plain 3 lines (RED)
 *   L4  larry-extended.md, commands/rooms.md, skills/rooms/SKILL.md carry the SEED-117 doctrine words (RED)
 *   L5  scripts/room-registry does not tell the person to `run inside WSL` (RED)
 *   L6  lib/mcp/tool-router.cjs rooms-open failure branch prints result.plain first (RED)
 *
 * Child legs run in a subprocess whose PATH starts with a python3 stub that answers --version and fails
 * otherwise. HOME, USERPROFILE, MINDRIAN_HOME, MINDRIAN_ROOMS_HOME and CLAUDE_CONFIG_DIR are mkdtemp dirs
 * before any repo require; the child inherits them. Nothing is written outside a mkdtemp dir.
 * Output: PASS, FAIL or PENDING lines, then PASS: n FAIL: n PENDING: n. House rule: hyphens only.
 */

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MARK = 'PF383_JSON=';
const REGISTRY = path.join(ROOT, 'scripts', 'room-registry');

// ---------------------------------------------------------------------------
// Child mode: `node this-file --child <kind> <json-args>`.
// ---------------------------------------------------------------------------
if (process.argv[2] === '--child') {
  const kind = process.argv[3];
  const a = JSON.parse(process.argv[4] || '{}');
  let out;
  try {
    if (kind === 'birth') {
      const nav = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));
      out = nav.birthRoom({ approvedBy: 'navigator', slug: a.slug, roomDir: a.roomDir, sessionId: 'nosession', vname: 'PF', ventureText: 'pf' });
    } else if (kind === 'answer') {
      const ops = require(path.join(ROOT, 'lib', 'mcp', 'startup-operations.cjs'));
      out = ops.answerRoomCreation({ resumeFn: function () { return { ok: false, reason: 'registry_create_failed:x', stderr: 'boom' }; } },
        { gate_id: 'g1', verdict: 'approve' }, 's1');
    } else if (kind === 'openroom') {
      out = require(path.join(ROOT, 'lib', 'core', 'room-open.cjs')).openRoom({ room: a.room, home: a.home });
    } else {
      out = { error: 'unknown child kind ' + kind };
    }
  } catch (e) {
    out = { threw: String(e && e.message || e) };
  }
  process.stdout.write('\n' + MARK + JSON.stringify(out) + '\n');
  process.exit(0);
}

const H = require('./helpers/harness-383.cjs');
const hermetic = H.hermeticEnv('plainfail');
H.applyEnv(hermetic.env);
const R = H.reporter('test-383-plain-failure');

/** A PATH dir with system tools, node, and a python3 that answers --version but fails otherwise. */
function boomPath() {
  try { return H.shimPath({ python3: 'boom' }); } catch (e) { if (e instanceof H.Skip) return null; throw e; }
}

function childEnv(home, roomsHome, shim) {
  const env = Object.assign({}, hermetic.env, { HOME: home, USERPROFILE: home, MINDRIAN_ROOMS_HOME: roomsHome });
  if (shim) env.PATH = shim + path.delimiter + (process.env.PATH || '');
  return env;
}

function child(kind, args, env) {
  const r = cp.spawnSync(process.execPath, [__filename, '--child', kind, JSON.stringify(args)],
    { env: env, cwd: ROOT, encoding: 'utf8', timeout: 120000 });
  const line = (r.stdout || '').split('\n').reverse().find(function (l) { return l.startsWith(MARK); });
  if (!line) throw new Error('child ' + kind + ' printed no result; exit=' + r.status + ' stderr=' + String(r.stderr || '').slice(-300));
  return JSON.parse(line.slice(MARK.length));
}

/** Returns a list of shape faults for a `plain` value; [] when it is a good three-line message. */
function plainFaults(plain) {
  const faults = [];
  if (typeof plain !== 'string' || !plain) return ['plain is not a non-empty string (got ' + JSON.stringify(plain) + ')'];
  const lines = plain.split('\n');
  if (lines.length !== 3) faults.push('plain has ' + lines.length + ' lines, want 3');
  if (!/^ {2}Why:/.test(lines[1] || '')) faults.push('line 2 does not start with two spaces and Why:');
  if (!/^ {2}Fix:/.test(lines[2] || '')) faults.push('line 3 does not start with two spaces and Fix:');
  if (/[A-Za-z]:[\\/]|\\|\/[^\s\/]+\//.test(plain)) faults.push('plain holds a path');
  if (/Traceback/.test(plain)) faults.push('plain holds Traceback');
  if (/boom/.test(plain)) faults.push('plain holds the raw child text `boom`');
  return faults;
}

function freshHome(name) {
  const home = H.mkTmp(name);
  const roomsHome = path.join(home, 'MindrianRooms');
  fs.mkdirSync(roomsHome, { recursive: true });
  return { home: home, roomsHome: roomsHome };
}

const SHIM = boomPath();

// ---- L1
(function () {
  if (!SHIM) { R.pending('L1 birthRoom failure payload', 'no bash under /usr/bin or /bin to build the boom PATH'); return; }
  try {
    const h = freshHome('l1');
    const out = child('birth', { slug: 'pf1', roomDir: path.join(h.roomsHome, 'pf1') }, childEnv(h.home, h.roomsHome, SHIM));
    const faults = [];
    if (out.ok !== false) faults.push('ok is ' + JSON.stringify(out.ok) + ', want false');
    if (typeof out.reason !== 'string' || out.reason.indexOf('registry_create_failed') !== 0) faults.push('reason ' + JSON.stringify(out.reason));
    if (typeof out.stderr !== 'string' || !/boom/.test(out.stderr)) faults.push('stderr lost the verbatim line: ' + JSON.stringify(out.stderr));
    for (const f of plainFaults(out.plain)) faults.push(f);
    if (faults.length === 0) R.pass('L1 birthRoom failure carries stderr and a plain three-line message');
    else R.fail('L1 birthRoom failure carries stderr and a plain three-line message', faults.join('; '));
  } catch (e) {
    R.fail('L1 birthRoom failure carries stderr and a plain three-line message', e && e.message);
  }
})();

// ---- L2
(function () {
  if (!SHIM) { R.pending('L2 answerRoomCreation failure payload', 'no bash under /usr/bin or /bin to build the boom PATH'); return; }
  try {
    const h = freshHome('l2');
    const out = child('answer', {}, childEnv(h.home, h.roomsHome, SHIM));
    const faults = [];
    if (out.ok !== false) faults.push('ok is ' + JSON.stringify(out.ok) + ', want false');
    for (const f of plainFaults(out.plain)) faults.push(f);
    if (faults.length === 0) R.pass('L2 answerRoomCreation failure carries a top-level plain message');
    else R.fail('L2 answerRoomCreation failure carries a top-level plain message', faults.join('; ') + ' | payload ' + JSON.stringify(out).slice(0, 240));
  } catch (e) {
    R.fail('L2 answerRoomCreation failure carries a top-level plain message', e && e.message);
  }
})();

// ---- L3
(function () {
  if (!SHIM) { R.pending('L3 openRoom failure payload', 'no bash under /usr/bin or /bin to build the boom PATH'); return; }
  try {
    const h = freshHome('l3');
    // Seed two rooms under the system PATH, as test-l9o-rooms-python-floor.cjs does.
    const seedEnv = childEnv(h.home, h.roomsHome, null);
    for (const s of ['a', 'b']) {
      const d = path.join(h.roomsHome, s);
      fs.mkdirSync(d, { recursive: true });
      const r = cp.spawnSync('bash', [REGISTRY, 'create', s, d, s.toUpperCase(), 'idea'], { env: seedEnv, cwd: ROOT, encoding: 'utf8', timeout: 60000 });
      if (r.status !== 0) { R.pending('L3 openRoom failure payload', 'seed create ' + s + ' exit ' + r.status + ': ' + String(r.stderr || '').slice(-160)); return; }
    }
    const out = child('openroom', { room: 'a', home: h.roomsHome }, childEnv(h.home, h.roomsHome, SHIM));
    const faults = [];
    if (out.ok !== false || out.reason !== 'set_active_failed') faults.push('want ok false and reason set_active_failed, got ' + JSON.stringify({ ok: out.ok, reason: out.reason }));
    if (typeof out.stderr !== 'string' || !/boom/.test(out.stderr)) faults.push('stderr lost the verbatim line: ' + JSON.stringify(out.stderr));
    for (const f of plainFaults(out.plain)) faults.push(f);
    if (faults.length === 0) R.pass('L3 openRoom failure carries stderr and a plain three-line message');
    else R.fail('L3 openRoom failure carries stderr and a plain three-line message', faults.join('; '));
  } catch (e) {
    R.fail('L3 openRoom failure carries stderr and a plain three-line message', e && e.message);
  }
})();

// ---- L4
(function () {
  const files = ['agents/larry-extended.md', 'commands/rooms.md', 'skills/rooms/SKILL.md'];
  const need = ['plain three-line message', 'verbatim failure line', 'into the bug seed and the log', 'Never hand-build a room'];
  const bannedPhrase = 'Report the failure line verbatim';
  const faults = [];
  for (const f of files) {
    const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const missing = need.filter(function (s) { return t.indexOf(s) === -1; });
    if (missing.length) faults.push(f + ' lacks ' + JSON.stringify(missing));
    if (t.indexOf(bannedPhrase) !== -1) faults.push(f + ' still contains `' + bannedPhrase + '`');
  }
  if (faults.length === 0) R.pass('L4 SEED-117 doctrine names the plain message and keeps the verbatim line');
  else R.fail('L4 SEED-117 doctrine names the plain message and keeps the verbatim line', faults.join('; '));
})();

// ---- L5
(function () {
  const t = fs.readFileSync(REGISTRY, 'utf8');
  if (t.indexOf('run inside WSL') === -1) R.pass('L5 room-registry does not tell the person to run inside WSL');
  else R.fail('L5 room-registry does not tell the person to run inside WSL', 'the phrase `run inside WSL` is present in scripts/room-registry');
})();

// ---- L6
(function () {
  const t = fs.readFileSync(path.join(ROOT, 'lib', 'mcp', 'tool-router.cjs'), 'utf8');
  const iFail = t.indexOf('## rooms-open FAILED');
  const iPlain = iFail < 0 ? -1 : t.indexOf('result.plain', iFail);
  const iTail = iFail < 0 ? -1 : t.indexOf('Registry error (last lines)', iFail);
  const faults = [];
  if (iFail < 0) faults.push('rooms-open failure branch not found');
  if (t.indexOf('result.plain') === -1) faults.push('tool-router never reads result.plain');
  if (t.indexOf('result.stderr') === -1) faults.push('tool-router never reads result.stderr');
  if (t.indexOf('result.python') === -1) faults.push('tool-router never reads result.python');
  if (iPlain >= 0 && iTail >= 0 && iPlain > iTail) faults.push('result.plain appears after the Registry error text');
  if (iFail >= 0 && iPlain < 0) faults.push('result.plain is absent from the rooms-open failure branch');
  if (faults.length === 0) R.pass('L6 tool-router rooms-open prints the plain message before the registry error');
  else R.fail('L6 tool-router rooms-open prints the plain message before the registry error', faults.join('; '));
})();

R.done();
