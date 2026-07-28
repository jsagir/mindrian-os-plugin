'use strict';
/*
 * tests/test-cross-session-room-bleed.cjs
 *
 * RCA resolve-active-room-cross-session-bleed. BEHAVIORAL harness for the
 * two-concurrent-session bleed: two sessions share one MINDRIAN_ROOMS_HOME;
 * session A binds room X and (as room_bind does) also sets reg.active = X;
 * session B is bound to its OWN room Y. Session B must resolve Y, never X.
 *
 * Two defects this pins:
 *   D2 -- resolveWriteRoom leg 2 derived the bound room's dir as
 *         path.join(home, primary), which is FALSE for a SUB-room (registry
 *         `path` is e.g. parent/sub-rooms/child). existsSync failed, leg 2 fell
 *         through to leg 3 (reg.active), so a sub-room binding silently
 *         degraded to the machine-wide value.
 *   D1 -- scripts/intent-classifier.cjs resolved the F.1 / F.8 room via the
 *         machine-wide resolveActiveRoomDir(), never the session-aware
 *         resolver, so even a top-level binding was ignored.
 *
 * Canon Part 8: hermetic, LOCAL-only, mkdtemp scratch home. Zero network.
 * Node built-in assert only. No em-dashes.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

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

// ---------------------------------------------------------------------------
// Fixture: one rooms home, three rooms. `room-x` and `room-y-parent` are
// top-level; `room-y` is a SUB-room of room-y-parent (the shape that kills
// leg 2's naive path.join). reg.active points at room-x (session A's write).
// ---------------------------------------------------------------------------
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'bleed-home-'));
const roomX = path.join(home, 'room-x');
const parentY = path.join(home, 'room-y-parent');
const roomY = path.join(parentY, 'sub-rooms', 'room-y');
fs.mkdirSync(roomX, { recursive: true });
fs.mkdirSync(roomY, { recursive: true });
fs.mkdirSync(path.join(home, '.rooms'), { recursive: true });

fs.writeFileSync(path.join(home, '.rooms', 'registry.json'), JSON.stringify({
  active: 'room-x',
  rooms: {
    'room-x': { path: 'room-x', status: 'active' },
    'room-y-parent': { path: 'room-y-parent', status: 'active' },
    // The sub-room: its real location is NOT <home>/<slug>.
    'room-y': { path: 'room-y-parent/sub-rooms/room-y', status: 'active', parent: 'room-y-parent' },
  },
}, null, 2));

const SESSION_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const SESSION_B = 'bbbbbbbb-0000-4000-8000-000000000002';
const SESSION_C = 'cccccccc-0000-4000-8000-000000000003'; // never bound

// Session A bound to room-x (top-level). Session B bound to room-y (SUB-room).
sessionBinding.writeSessionBinding(SESSION_A, { bound: ['room-x'], primary: 'room-x' }, { home: home });
sessionBinding.writeSessionBinding(SESSION_B, { bound: ['room-y'], primary: 'room-y' }, { home: home });

console.log('test-cross-session-room-bleed (RCA resolve-active-room-cross-session-bleed)');
console.log('  fixture home: ' + home);
console.log('  reg.active = room-x (written by session A)');

// ---------------------------------------------------------------------------
// 1. Sanity: the machine-wide resolver is machine-wide. This is NOT the bug --
//    it is the documented contract, and 17 production call sites depend on it.
//    Pinned so a future "fix" cannot session-scope this resolver by accident.
// ---------------------------------------------------------------------------
const machineWide = rar.resolveActiveRoom({ home: home });
check('resolveActiveRoom stays machine-wide (reg.active = room-x)',
  machineWide && machineWide.slug === 'room-x');

// ---------------------------------------------------------------------------
// 2. THE BLEED (D2). Session B is bound to the SUB-room room-y. It must resolve
//    room-y. Pre-fix this returned room-x via source:'reg.active' because
//    path.join(home,'room-y') does not exist.
// ---------------------------------------------------------------------------
const bResolved = rar.resolveWriteRoom({ sessionId: SESSION_B, home: home });
check('session B (bound to a SUB-room) resolves its OWN room, not reg.active',
  bResolved && bResolved.slug === 'room-y');
check('session B resolves via session.primary, not the demoted reg.active leg',
  bResolved && bResolved.source === 'session.primary');
check('session B abs_path is the real nested sub-room dir',
  bResolved && bResolved.abs_path === roomY);

// ---------------------------------------------------------------------------
// 3. Session A (bound to a TOP-LEVEL room) still resolves correctly, and does
//    so through leg 2, not by coincidence of reg.active agreeing.
// ---------------------------------------------------------------------------
const aResolved = rar.resolveWriteRoom({ sessionId: SESSION_A, home: home });
check('session A resolves room-x via session.primary (not coincidental reg.active)',
  aResolved && aResolved.slug === 'room-x' && aResolved.source === 'session.primary');

// ---------------------------------------------------------------------------
// 4. NO REGRESSION: an UNBOUND session still falls through to the reg.active
//    seed exactly as the PSB-15 contract documents. This is what keeps a
//    single-session tier-0 user working.
// ---------------------------------------------------------------------------
const cResolved = rar.resolveWriteRoom({ sessionId: SESSION_C, home: home });
check('unbound session still seeds from reg.active (PSB-15 contract preserved)',
  cResolved && cResolved.slug === 'room-x' && cResolved.source === 'reg.active');

// ---------------------------------------------------------------------------
// 5. The shared session-scoped read export (leg 2 -> leg 3, no cwd walk-up).
//    intent-classifier consumes THIS, so the hook can never accidentally
//    inherit resolveWriteRoom's filePath/cwd leg 1.
// ---------------------------------------------------------------------------
if (typeof rar.resolveSessionRoom !== 'function') {
  check('resolveSessionRoom is exported (the ONE session-scoped read)', false);
} else {
  const sB = rar.resolveSessionRoom({ sessionId: SESSION_B, home: home });
  check('resolveSessionRoom(B) returns the sub-room room-y',
    sB && sB.slug === 'room-y' && sB.source === 'session.primary');
  const sC = rar.resolveSessionRoom({ sessionId: SESSION_C, home: home });
  check('resolveSessionRoom(unbound) falls back to the reg.active seed',
    sC && sC.slug === 'room-x' && sC.source === 'reg.active');

  // Leg-1 independence: resolveSessionRoom must NOT walk up from process.cwd().
  // Plant a .room-root sentinel in cwd's tree and prove it is ignored.
  const cwdRoom = fs.mkdtempSync(path.join(os.tmpdir(), 'bleed-cwd-'));
  fs.writeFileSync(path.join(cwdRoom, '.room-root'), '');
  const prevCwd = process.cwd();
  try {
    process.chdir(cwdRoom);
    const sNoCwd = rar.resolveSessionRoom({ sessionId: SESSION_B, home: home });
    check('resolveSessionRoom ignores a cwd .room-root sentinel (no leg-1 leak)',
      sNoCwd && sNoCwd.slug === 'room-y');
  } finally {
    try { process.chdir(prevCwd); } catch (_) {}
    try { fs.rmSync(cwdRoom, { recursive: true, force: true }); } catch (_) {}
  }
}

// ---------------------------------------------------------------------------
// 6. D1: the hook must consume the session-scoped resolver, not the
//    machine-wide one, for its F.1 / F.8 room state. Source-level structural
//    assertion (the hook's hot path cannot be booted here without a full
//    stdin/turn fixture, and the resolution itself is proven behaviorally above).
// ---------------------------------------------------------------------------
const hookSrc = fs.readFileSync(path.join(REPO, 'scripts', 'intent-classifier.cjs'), 'utf8');
check('intent-classifier requires the session-scoped resolveSessionRoom',
  hookSrc.indexOf('resolveSessionRoom') !== -1);
check('intent-classifier has a resolveSessionRoomDir helper feeding the engine block',
  hookSrc.indexOf('function resolveSessionRoomDir') !== -1);
check('the F.1 engine block no longer takes its roomDir straight from the machine-wide resolver',
  hookSrc.indexOf('const roomDir = resolveActiveRoomDir();') === -1);

try { fs.rmSync(home, { recursive: true, force: true }); } catch (_) {}

if (failures > 0) {
  console.log('FAIL: test-cross-session-room-bleed (' + failures + ' failing)');
  process.exit(1);
}
console.log('PASS: test-cross-session-room-bleed');
