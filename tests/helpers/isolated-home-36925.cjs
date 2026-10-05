'use strict';
/*
 * Phase 369.25 (plan 02) -- the one isolated-home helper every tests/test-36925-*.cjs file uses.
 *
 * WHY. A test that births a fixture room outside an isolated HOME writes into the navigator's real rooms home
 * (threat T-369.25-02-01). This helper gives every slice test one mkdtemp HOME, one rooms home under it, an env
 * copy that points HOME, USERPROFILE and MINDRIAN_ROOMS_HOME there (CLAUDE_CODE_SESSION_ID removed so a child
 * never inherits the live session binding), a birthRoom wrapper, a tree hash and a dash guard.
 *
 * Node built-ins only. CommonJS. Hyphens only: the two dash characters are built from code points below.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

const TO_REMOVE = [];
let exitHookInstalled = false;
function installExitHook() {
  if (exitHookInstalled) return;
  exitHookInstalled = true;
  process.on('exit', () => {
    for (const d of TO_REMOVE) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ } }
  });
}

// The navigator's real homes, as the OS reports them (not as process.env.HOME may have been reassigned).
function realHomes() {
  const homes = new Set();
  try { homes.add(os.homedir()); } catch (_e) { /* ignore */ }
  try { homes.add(os.userInfo().homedir); } catch (_e) { /* ignore */ }
  return Array.from(homes).filter(Boolean);
}

function isUnder(child, parent) {
  const c = path.resolve(child);
  const p = path.resolve(parent);
  return c === p || c.startsWith(p + path.sep);
}

// T-369.25-02-01: refuse a home that resolves under the real ~/MindrianRooms or ~/.mindrian.
function assertNotRealHome(dir) {
  const resolved = fs.existsSync(dir) ? fs.realpathSync(dir) : path.resolve(dir);
  for (const h of realHomes()) {
    for (const guarded of [path.join(h, 'MindrianRooms'), path.join(h, '.mindrian')]) {
      if (isUnder(resolved, guarded) || isUnder(dir, guarded)) {
        throw new Error('isolated-home-36925: refusing ' + dir + ' (under ' + guarded + ')');
      }
    }
  }
}

function mkIsolatedHome(prefix) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), '36925-' + String(prefix || 'x') + '-'));
  assertNotRealHome(home);
  const roomsHome = path.join(home, 'rooms');
  fs.mkdirSync(roomsHome, { recursive: true });
  TO_REMOVE.push(home);
  installExitHook();
  const env = Object.assign({}, process.env, { HOME: home, USERPROFILE: home, MINDRIAN_ROOMS_HOME: roomsHome });
  delete env.CLAUDE_CODE_SESSION_ID;
  delete env.MINDRIAN_ACTIVE_SESSION_ID;
  function cleanup() { try { fs.rmSync(home, { recursive: true, force: true }); } catch (_e) { /* best effort */ } }
  return { home, roomsHome, env, cleanup };
}

// birthRoom wrapper, the vi3 birthB argument shape. Points the in-process env at the isolated home first,
// so the registry and any ~/.mindrian write land under the temp directory.
function birthFixtureRoom(opts) {
  const o = opts || {};
  const iso = o.iso;
  if (!iso || !iso.roomsHome) throw new Error('birthFixtureRoom: iso (from mkIsolatedHome) is required');
  assertNotRealHome(iso.home);
  const slug = o.slug || 'fixture-36925';
  process.env.HOME = iso.home;
  process.env.USERPROFILE = iso.home;
  process.env.MINDRIAN_ROOMS_HOME = iso.roomsHome;
  delete process.env.CLAUDE_CODE_SESSION_ID;
  delete process.env.MINDRIAN_ACTIVE_SESSION_ID;
  fs.mkdirSync(iso.roomsHome, { recursive: true });
  const roomDir = path.join(iso.roomsHome, slug);
  const birth = require(path.join(ROOT, 'lib', 'core', 'navigation', 'room-birth.cjs')).birthRoom({
    slug,
    roomDir,
    sessionId: o.sessionId || 'test-36925',
    ventureText: o.ventureText || 'A fixture venture for the 369.25 tests',
    jtbd: '',
    approvedBy: 'test-36925',
    canonicalRole: 'founder',
    vname: o.vname || slug,
    vstage: 'Pre-Opportunity',
  });
  return Object.assign({ roomDir, slug }, birth);
}

// sha256 over every relative path and file content under dir, sorted (the vi3 M1 idiom, content only so a
// rewrite with identical bytes keeps the same hash).
function treeHash(dir) {
  const h = crypto.createHash('sha256');
  (function walk(d) {
    fs.readdirSync(d, { withFileTypes: true }).sort((x, y) => (x.name < y.name ? -1 : 1)).forEach((e) => {
      const p = path.join(d, e.name);
      const rel = path.relative(dir, p);
      if (e.isDirectory()) { h.update('D ' + rel + '\n'); walk(p); }
      else if (e.isFile()) {
        h.update('F ' + rel + ' ' + crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') + '\n');
      }
    });
  })(dir);
  return h.digest('hex');
}

// The files (of those given) that contain an em dash or an en dash. A missing file is skipped.
function dashGuard(files) {
  return (files || []).filter((f) => {
    try { const t = fs.readFileSync(f, 'utf8'); return t.indexOf(EM) !== -1 || t.indexOf(EN) !== -1; }
    catch (_e) { return false; }
  });
}

module.exports = { mkIsolatedHome, birthFixtureRoom, treeHash, dashGuard };
