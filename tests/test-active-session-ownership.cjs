'use strict';
/*
 * tests/test-active-session-ownership.cjs
 *
 * RCA registry-active-session-unbound-inheritance. Pins the ownership stamp on
 * registry.json's machine-wide `active` field and the opt-in gate that stops an
 * UNBOUND session from inheriting a room a DIFFERENT, still-live session set.
 *
 * The distinction this exists to make (the one a bare id-match cannot make):
 *   unowned / self / stale  -> INHERIT, byte-identical to pre-fix behavior.
 *   foreign-live            -> DECLINE, the bleed.
 *
 * Tier-0 is the load-bearing invariant: a single unbound session with no
 * concurrent siblings must resolve its room EXACTLY as before. Every uncertain
 * path therefore fails OPEN, and this file pins each of those paths separately
 * so a future tightening cannot quietly regress the single-session user.
 *
 * Liveness fixtures are REAL, not mocked: `process.pid` is a definitely-live
 * process, and a spawnSync'd child that has already exited and been reaped is a
 * definitely-dead pid.
 *
 * Canon Part 8: hermetic, LOCAL-only, mkdtemp scratch homes. Zero network.
 * Node built-in assert only. No em-dashes.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.join(__dirname, '..');
const rar = require(path.join(REPO, 'lib', 'core', 'resolve-active-room.cjs'));
const sessionBinding = require(path.join(REPO, 'lib', 'core', 'session-binding.cjs'));

let failures = 0;
function check(label, cond) {
  if (cond) {
    console.log('  PASS ' + label);
  } else {
    console.log('  FAIL ' + label);
    failures += 1;
  }
}

const SESSION_A = 'aaaaaaaa-0000-4000-8000-000000000001'; // the owner
const SESSION_B = 'bbbbbbbb-0000-4000-8000-000000000002'; // the unbound reader

// A definitely-live pid: this very process.
const LIVE_PID = process.pid;
// A definitely-dead pid: spawn a child, let spawnSync reap it, keep the number.
const reaped = spawnSync(process.execPath, ['-e', '0'], { stdio: 'ignore' });
const DEAD_PID = reaped.pid;

function pidIsDead(pid) {
  try { process.kill(pid, 0); return false; } catch (_) { return true; }
}

const tmpHomes = [];
function makeHome(ownership) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'own-home-'));
  tmpHomes.push(home);
  fs.mkdirSync(path.join(home, 'room-x'), { recursive: true });
  fs.mkdirSync(path.join(home, 'room-y-parent', 'sub-rooms', 'room-y'), { recursive: true });
  fs.mkdirSync(path.join(home, '.rooms'), { recursive: true });
  const reg = Object.assign({
    active: 'room-x',
    rooms: {
      'room-x': { path: 'room-x', status: 'active' },
      'room-y-parent': { path: 'room-y-parent', status: 'active' },
      'room-y': { path: 'room-y-parent/sub-rooms/room-y', status: 'active', parent: 'room-y-parent' },
    },
  }, ownership || {});
  fs.writeFileSync(path.join(home, '.rooms', 'registry.json'), JSON.stringify(reg, null, 2));
  return home;
}

const NOW = new Date().toISOString();
const AGE_25H = new Date(Date.now() - (25 * 60 * 60 * 1000)).toISOString();

const homeUnowned = makeHome(null);
const homeSelf = makeHome({ active_session: SESSION_B, active_session_pid: LIVE_PID, active_session_at: NOW });
const homeExited = makeHome({ active_session: SESSION_A, active_session_pid: DEAD_PID, active_session_at: NOW });
const homeLive = makeHome({ active_session: SESSION_A, active_session_pid: LIVE_PID, active_session_at: NOW });
const homeLiveOld = makeHome({ active_session: SESSION_A, active_session_pid: LIVE_PID, active_session_at: AGE_25H });
const homeNoPid = makeHome({ active_session: SESSION_A, active_session_at: NOW });

// ---------------------------------------------------------------------------
// Fixture sanity. If these fail, every assertion below is meaningless.
// ---------------------------------------------------------------------------
console.log('own.fixture -- real liveness fixtures');
check('own.00 DEAD_PID is genuinely not signalable', Number.isInteger(DEAD_PID) && pidIsDead(DEAD_PID));
check('own.01 LIVE_PID is genuinely signalable', !pidIsDead(LIVE_PID));

// ---------------------------------------------------------------------------
// resolveActiveOwnership -- the three-way classifier.
// ---------------------------------------------------------------------------
console.log('own.ownership -- three-way classifier');

let o = rar.resolveActiveOwnership({ home: homeUnowned, sessionId: SESSION_B });
check('own.10 no active_session field -> unowned + inheritable', o.state === 'unowned' && o.inheritable === true);

o = rar.resolveActiveOwnership({ home: homeSelf, sessionId: SESSION_B });
check('own.11 owner is me -> self + inheritable', o.state === 'self' && o.inheritable === true);

o = rar.resolveActiveOwnership({ home: homeExited, sessionId: SESSION_B });
check('own.12 foreign owner, process exited -> stale + inheritable', o.state === 'stale' && o.inheritable === true);

o = rar.resolveActiveOwnership({ home: homeLive, sessionId: SESSION_B });
check('own.13 foreign owner, process LIVE -> foreign-live + NOT inheritable', o.state === 'foreign-live' && o.inheritable === false);

o = rar.resolveActiveOwnership({ home: homeLiveOld, sessionId: SESSION_B });
check('own.14 foreign owner live but stamp older than the recycle ceiling -> stale + inheritable', o.state === 'stale' && o.inheritable === true);

o = rar.resolveActiveOwnership({ home: homeNoPid, sessionId: SESSION_B });
check('own.15 foreign owner with no pid recorded -> stale + inheritable (unprobeable fails OPEN)', o.state === 'stale' && o.inheritable === true);

o = rar.resolveActiveOwnership({ home: homeLive, sessionId: null });
check('own.16 reader with no session id -> anonymous-reader + inheritable', o.state === 'anonymous-reader' && o.inheritable === true);

o = rar.resolveActiveOwnership({ home: path.join(homeLive, 'nope-does-not-exist'), sessionId: SESSION_B });
check('own.17 missing registry -> unowned + inheritable, never throws', o.state === 'unowned' && o.inheritable === true);

check('own.18 ownership ceiling is a documented non-frozen scalar (24h)', rar.OWNERSHIP_MAX_AGE_MS === 86400000);

// A malformed registry must not throw and must not decline.
const homeJunk = fs.mkdtempSync(path.join(os.tmpdir(), 'own-junk-'));
tmpHomes.push(homeJunk);
fs.mkdirSync(path.join(homeJunk, '.rooms'), { recursive: true });
fs.writeFileSync(path.join(homeJunk, '.rooms', 'registry.json'), '{ this is not json');
o = rar.resolveActiveOwnership({ home: homeJunk, sessionId: SESSION_B });
check('own.19 corrupt registry -> unowned + inheritable, never throws', o.state === 'unowned' && o.inheritable === true);

// ---------------------------------------------------------------------------
// resolveSessionRoom -- the gate is OPT-IN. Default OFF must be byte-identical
// to pre-fix behavior, because resolveWriteRoom and 9 MCP tool modules ride it.
// ---------------------------------------------------------------------------
console.log('own.optin -- default OFF is byte-identical');

let r = rar.resolveSessionRoom({ sessionId: SESSION_B, home: homeLive });
check('own.20 foreign-live WITHOUT the flag still inherits (pre-fix behavior preserved)',
  r !== null && r.slug === 'room-x' && r.source === 'reg.active');

r = rar.resolveWriteRoom({ sessionId: SESSION_B, home: homeLive, filePath: path.join(homeLive, 'nowhere.md') });
check('own.21 resolveWriteRoom is untouched by ownership (zero write-path blast radius)',
  r !== null && r.slug === 'room-x' && r.source === 'reg.active');

// ---------------------------------------------------------------------------
// resolveSessionRoom with requireOwnership -- the gate itself.
// ---------------------------------------------------------------------------
console.log('own.gate -- requireOwnership');

r = rar.resolveSessionRoom({ sessionId: SESSION_B, home: homeLive, requireOwnership: true });
check('own.30 foreign-live -> DECLINE (null), the bleed is closed', r === null);

r = rar.resolveSessionRoom({ sessionId: SESSION_B, home: homeUnowned, requireOwnership: true });
check('own.31 TIER-0 (no ownership recorded) -> still inherits reg.active',
  r !== null && r.slug === 'room-x' && r.source === 'reg.active');

r = rar.resolveSessionRoom({ sessionId: SESSION_B, home: homeExited, requireOwnership: true });
check('own.32 owner exited -> still inherits reg.active (tier-0 restart case)',
  r !== null && r.slug === 'room-x' && r.source === 'reg.active');

r = rar.resolveSessionRoom({ sessionId: SESSION_B, home: homeSelf, requireOwnership: true });
check('own.33 I am the owner -> still inherits reg.active',
  r !== null && r.slug === 'room-x' && r.source === 'reg.active');

r = rar.resolveSessionRoom({ sessionId: null, home: homeLive, requireOwnership: true });
check('own.34 anonymous reader -> still inherits (cannot claim foreignness)',
  r !== null && r.slug === 'room-x' && r.source === 'reg.active');

// A BOUND session must be immune: leg A wins before ownership is ever consulted.
sessionBinding.writeSessionBinding(SESSION_B, { bound: ['room-y'], primary: 'room-y' }, { home: homeLive });
r = rar.resolveSessionRoom({ sessionId: SESSION_B, home: homeLive, requireOwnership: true });
check('own.35 a BOUND session outranks ownership entirely (resolves its own SUB-room)',
  r !== null && r.slug === 'room-y' && r.source === 'session.primary');

// ---------------------------------------------------------------------------
// The WRITER: scripts/room-registry stamps ownership from the environment, and
// CLEARS it when no session id is resolvable (never leaves a stale owner).
// ---------------------------------------------------------------------------
console.log('own.writer -- scripts/room-registry set-active');

function readReg(home) {
  return JSON.parse(fs.readFileSync(path.join(home, '.rooms', 'registry.json'), 'utf8'));
}
function setActive(home, env) {
  const base = {
    PATH: process.env.PATH,
    HOME: home,
    MINDRIAN_ROOMS_HOME: home,
  };
  return spawnSync('bash', [path.join(REPO, 'scripts', 'room-registry'), 'set-active', 'room-y'], {
    env: Object.assign(base, env || {}),
    encoding: 'utf8',
  });
}

const homeWriter = makeHome(null);
// Suppress the retro-bootstrap side trip; it is orthogonal and slow.
fs.writeFileSync(path.join(homeWriter, '.rooms', '.bootstrap-127.3-done'), 'x');

let res = setActive(homeWriter, { MINDRIAN_ACTIVE_SESSION_ID: SESSION_A, MINDRIAN_ACTIVE_SESSION_PID: String(LIVE_PID) });
let reg = readReg(homeWriter);
check('own.40 set-active flips active', res.status === 0 && reg.active === 'room-y');
check('own.41 set-active stamps active_session', reg.active_session === SESSION_A);
check('own.42 set-active stamps active_session_pid as a number', reg.active_session_pid === LIVE_PID);
check('own.43 set-active stamps active_session_at', typeof reg.active_session_at === 'string' && Number.isFinite(Date.parse(reg.active_session_at)));

// A stamped registry is immediately usable by the reader.
o = rar.resolveActiveOwnership({ home: homeWriter, sessionId: SESSION_B });
check('own.44 the stamp the writer produced classifies as foreign-live for another session',
  o.state === 'foreign-live' && o.inheritable === false);

// Now a set-active with NO session id in the environment: the previous owner
// must be CLEARED, not left pointing at a room it did not choose.
res = setActive(homeWriter, { MINDRIAN_ACTIVE_SESSION_ID: '', MINDRIAN_ACTIVE_SESSION_PID: '', CLAUDE_CODE_SESSION_ID: '', CLAUDE_PID: '' });
reg = readReg(homeWriter);
check('own.45 set-active with no session id clears active_session',
  res.status === 0 && !('active_session' in reg));
check('own.46 set-active with no session id clears active_session_pid', !('active_session_pid' in reg));
check('own.47 set-active with no session id clears active_session_at', !('active_session_at' in reg));
o = rar.resolveActiveOwnership({ home: homeWriter, sessionId: SESSION_B });
check('own.48 a cleared registry falls back to unowned (today\'s behavior)',
  o.state === 'unowned' && o.inheritable === true);

// A session id with no pid still stamps, and still fails OPEN on read.
res = setActive(homeWriter, { MINDRIAN_ACTIVE_SESSION_ID: SESSION_A, MINDRIAN_ACTIVE_SESSION_PID: '', CLAUDE_PID: '' });
reg = readReg(homeWriter);
check('own.49 session id without a pid stamps the id and omits the pid',
  res.status === 0 && reg.active_session === SESSION_A && !('active_session_pid' in reg));

// archive clears ownership along with active.
const homeArchive = makeHome({ active_session: SESSION_A, active_session_pid: LIVE_PID, active_session_at: NOW });
fs.writeFileSync(path.join(homeArchive, '.rooms', '.bootstrap-127.3-done'), 'x');
res = spawnSync('bash', [path.join(REPO, 'scripts', 'room-registry'), 'archive', 'room-x'], {
  env: { PATH: process.env.PATH, HOME: homeArchive, MINDRIAN_ROOMS_HOME: homeArchive },
  encoding: 'utf8',
});
reg = readReg(homeArchive);
check('own.50 archiving the active room clears active and its ownership stamp',
  res.status === 0 && reg.active === '' && !('active_session' in reg) && !('active_session_pid' in reg));

// ---------------------------------------------------------------------------
// END-TO-END: the REAL hook. This is the behavioral bar -- the F.1 block's
// decision traces must stop landing in a stranger's room, and must keep landing
// in the tier-0 room. Counting files on disk, not inspecting code.
// ---------------------------------------------------------------------------
console.log('own.e2e -- real intent-classifier.cjs hook run');

function runHook(home, sessionId, message) {
  return spawnSync(process.execPath, [path.join(REPO, 'scripts', 'intent-classifier.cjs')], {
    input: JSON.stringify({ session_id: sessionId, prompt: message }),
    env: {
      PATH: process.env.PATH,
      HOME: home,
      MINDRIAN_ROOMS_HOME: home,
      MINDRIAN_ROOMS_ROOT: home,
    },
    encoding: 'utf8',
    timeout: 60000,
  });
}

function traceCount(home, room, sessionId) {
  try {
    const p = path.join(home, room, '.mindrian', 'decision-traces', sessionId + '.json');
    const d = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Array.isArray(d.traces) ? d.traces.length : 0;
  } catch (_) {
    return 0;
  }
}

const MSG = 'map the venture funding strategy and check the assumptions we logged';

const e2eTier0 = makeHome(null);
runHook(e2eTier0, SESSION_B, MSG);
check('own.60 E2E tier-0: an unbound session with no siblings still writes into reg.active room',
  traceCount(e2eTier0, 'room-x', SESSION_B) > 0);

const e2eExited = makeHome({ active_session: SESSION_A, active_session_pid: DEAD_PID, active_session_at: NOW });
runHook(e2eExited, SESSION_B, MSG);
check('own.61 E2E owner exited: unbound session still writes into reg.active room',
  traceCount(e2eExited, 'room-x', SESSION_B) > 0);

const e2eLive = makeHome({ active_session: SESSION_A, active_session_pid: LIVE_PID, active_session_at: NOW });
runHook(e2eLive, SESSION_B, MSG);
check('own.62 E2E owner LIVE: unbound session writes ZERO traces into the stranger room',
  traceCount(e2eLive, 'room-x', SESSION_B) === 0);

// And the bound session is still served under a live foreign owner.
const e2eBound = makeHome({ active_session: SESSION_A, active_session_pid: LIVE_PID, active_session_at: NOW });
sessionBinding.writeSessionBinding(SESSION_B, { bound: ['room-y'], primary: 'room-y' }, { home: e2eBound });
runHook(e2eBound, SESSION_B, MSG);
check('own.63 E2E bound session under a live foreign owner writes into its OWN sub-room',
  traceCount(e2eBound, path.join('room-y-parent', 'sub-rooms', 'room-y'), SESSION_B) > 0
  && traceCount(e2eBound, 'room-x', SESSION_B) === 0);

// ---------------------------------------------------------------------------
for (const h of tmpHomes) {
  try { fs.rmSync(h, { recursive: true, force: true }); } catch (_) {}
}

console.log('');
console.log('---');
console.log(failures === 0 ? 'ALL GREEN' : (failures + ' FAILING'));
process.exit(failures === 0 ? 0 : 1);
