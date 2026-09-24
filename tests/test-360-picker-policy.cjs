#!/usr/bin/env node
'use strict';
/*
 * Phase 360 Plan 05 -- the unit and spawn-level proof for the two navigator
 * rulings folded into 360: N-1 (SPEC R10, the cwd rule) and N-2 (SPEC R11,
 * "dev repo / no room" session memory), plus a fault leg for the new guard
 * (R6 applied to lib/core/room-bind-picker-policy.cjs).
 * ================================================================================
 * unit: pins the pure policy module's contract (360-07 ships it) --
 *   cwdRoomsHomeVerdict(cwd, roomsRoot) returns exactly one of 'inside',
 *   'outside', 'ancestor', 'unresolvable'; unboundPickerSuppression({binding,
 *   cwd, roomsRoot}) returns null | 'no-room-remembered' | 'cwd-outside-unbound',
 *   never throws, and never re-types the reserved sentinel as a quoted
 *   literal (the value comes from lib/core/session-binding.cjs). RED before
 *   360-07 with a single named reason: the module (or the NO_ROOM_SLUG
 *   export it needs) does not exist yet.
 * r10: spawn-level legs over CASES.policy_entries pin every cwd class's
 *   fail-toward-picker or byte-identical behavior against the LIVE
 *   scripts/intent-classifier.cjs (no policy module dependency -- these
 *   legs prove TODAY's baseline and the SPEC target in the same shapes).
 *   RED on outside-dev-repo (fires today, must suppress) and harness-inside
 *   (fires today, must suppress once the harness guard lands).
 * r11: three CASES.sequences drive the existing F.8 / zero-score gate
 *   answer flow to pin N-2's session memory (1 picker then 0, a new
 *   session_id still asks, an explicit rebind still works). RED on the
 *   typed sequence's turn 3 (fires today, the verified root cause).
 * fault: with --require throwing-picker-policy.cjs, an outside-dev-repo
 *   unbound human turn still fires (fail toward today's behavior), exits 0,
 *   and the stub proves it was reached exactly once. RED today (0 calls --
 *   nothing calls the not-yet-shipped export).
 *
 * Every spawn goes through tests/fixtures/ups-harness-360/spawn-kit.cjs (the
 * ONE hermetic spawn kit, D-13/T-360-05) -- this file holds no spawn call of
 * its own. `--only unit|r10|r11|fault` runs every leg whose id starts with
 * that prefix (same idiom as tests/test-360-tripwire.cjs and
 * tests/test-360-harness-picker.cjs). Node built-ins + the spawn kit only.
 * No em-dashes.
 *
 * Run: node tests/test-360-picker-policy.cjs [--only unit|r10|r11|fault]
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  REPO_ROOT,
  CASES,
  PRE_PHASE,
  markersIn,
  makeFixture,
  resolveCwd,
  writeBinding,
  readBinding,
  spawnClassifier,
  buildCodeRoot,
  sideWrites,
} = require(path.join(__dirname, 'fixtures', 'ups-harness-360', 'spawn-kit.cjs'));

const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'ups-harness-360');
const FAULT_STUB_PATH = path.join(FIXTURES_DIR, 'throwing-picker-policy.cjs');

const POLICY_PATH = path.join(REPO_ROOT, 'lib', 'core', 'room-bind-picker-policy.cjs');
const SESSION_BINDING_PATH = path.join(REPO_ROOT, 'lib', 'core', 'session-binding.cjs');

// ---------------------------------------------------------------------------
// Leg harness (same idiom as tests/test-360-tripwire.cjs /
// tests/test-360-harness-picker.cjs): a leg accumulates its own failure
// rather than aborting the whole file, so a RED leg reports exactly which
// case failed and why, and every other leg still runs.
// ---------------------------------------------------------------------------
const ONLY_PREFIX = (function () {
  const idx = process.argv.indexOf('--only');
  return (idx !== -1 && process.argv[idx + 1]) ? process.argv[idx + 1] : null;
})();

let checks = 0;
let failed = 0;

function assertTrue(cond, msg) {
  if (!cond) throw new Error(msg);
}

function leg(id, fn) {
  if (ONLY_PREFIX && id.indexOf(ONLY_PREFIX) !== 0) return;
  checks += 1;
  try {
    fn();
    console.log('  ok - ' + id);
  } catch (e) {
    failed += 1;
    console.log('  FAIL ' + id + ': ' + (e && e.message ? e.message : String(e)));
  }
}

console.log('test-360-picker-policy.cjs (360-05): N-1/R10 cwd rule, N-2/R11 no-room session memory, policy fault leg');

// ---------------------------------------------------------------------------
// Small helpers.
// ---------------------------------------------------------------------------

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
}

function readSpyLines(spyPath) {
  try {
    const raw = fs.readFileSync(spyPath, 'utf8');
    return raw.split('\n').filter(function (l) { return l.length > 0; });
  } catch (_e) {
    return [];
  }
}

// Byte-identity comparison that NEVER normalizes (D-17 idiom, matches
// tests/test-360-harness-picker.cjs): on a mismatch, report only the first
// differing byte offset and both lengths -- never the bytes themselves
// (T-360-04).
function assertBytesEqual(a, b, contextLabel) {
  const bufA = Buffer.from(typeof a === 'string' ? a : '', 'utf8');
  const bufB = Buffer.from(typeof b === 'string' ? b : '', 'utf8');
  if (Buffer.compare(bufA, bufB) === 0) return;
  const minLen = Math.min(bufA.length, bufB.length);
  let offset = minLen;
  for (let i = 0; i < minLen; i += 1) {
    if (bufA[i] !== bufB[i]) { offset = i; break; }
  }
  throw new Error(
    'non-deterministic output; byte identity cannot be proven (' + contextLabel + '): '
    + 'first differing byte offset ' + offset + ', lengths ' + bufA.length + ' vs ' + bufB.length
  );
}

// The room-resolution segment of stdout (same helper as
// tests/test-360-harness-picker.cjs, duplicated here since spawn-kit.cjs
// exports no test-assertion helpers of its own, D-13): main() writes at most
// one JSON envelope per turn via a single process.stdout.write call, and
// JSON.stringify never emits a raw newline byte, so gating on the leading
// '{' byte reliably isolates exactly what R10/R11 govern from the
// out-of-scope trailing navigation-engine block (D-09).
function roomResolutionSegment(stdout) {
  const text = typeof stdout === 'string' ? stdout : '';
  if (text.length === 0 || text.charAt(0) !== '{') return '';
  const idx = text.indexOf('\n');
  return idx === -1 ? text : text.slice(0, idx);
}

// Scans every room dir under the fixture for the most recent UN-consumed
// binding_gate_payload for this session (same backward scan
// scripts/intent-classifier.cjs's own consumePriorBindingAnswer performs;
// duplicated from tests/test-360-harness-picker.cjs for the same D-13
// reason -- spawn-kit holds no assertion/read-back helpers).
function readLatestGatePayload(fixture, sessionId) {
  let roomNames = [];
  try {
    roomNames = fs.readdirSync(fixture.rooms, { withFileTypes: true })
      .filter(function (e) { return e.isDirectory() && e.name !== '.rooms'; })
      .map(function (e) { return e.name; });
  } catch (_e) {
    roomNames = [];
  }
  for (const roomName of roomNames) {
    const tracePath = path.join(fixture.rooms, roomName, '.mindrian', 'decision-traces', sessionId + '.json');
    try {
      const raw = fs.readFileSync(tracePath, 'utf8');
      const parsed = JSON.parse(raw);
      const traces = Array.isArray(parsed.traces) ? parsed.traces : [];
      for (let i = traces.length - 1; i >= 0; i -= 1) {
        const e = traces[i];
        if (!e || typeof e !== 'object') continue;
        if (e.kind === 'binding_gate_consumed') break; // already consumed in this room
        if (e.binding_gate_payload && typeof e.binding_gate_payload === 'object') {
          return { roomName: roomName, payload: e.binding_gate_payload };
        }
      }
    } catch (_e) {
      // No trace file in this room -- keep scanning the others.
    }
  }
  return null;
}

// The reserved no-room option is always appended LAST by the shipped F.8 /
// zero-score gate builders (scripts/intent-classifier.cjs's emitBindingGate
// and emitNoMatchGate both push it after every scored/fixed room option,
// never before). Resolving it structurally from the persisted payload --
// rather than re-typing the label text -- is what the plan's own acceptance
// criterion requires (0 occurrences of the quoted label literal in this
// file). A sanity check confirms the resolved label is not one of the
// fixture's own registered room names (it must be the reserved option, not
// a scored room).
const KNOWN_FIXTURE_ROOM_NAMES = ['copper-ledger', 'tin-orchard', 'quantum-bakery'];
function resolveNoRoomLabel(payload) {
  const options = Array.isArray(payload && payload.options) ? payload.options : [];
  assertTrue(options.length > 0, 'gate payload must offer at least one option; got none');
  const last = options[options.length - 1];
  assertTrue(typeof last === 'string' && last.length > 0,
    'the last offered option must be a non-empty label; got ' + JSON.stringify(last));
  assertTrue(KNOWN_FIXTURE_ROOM_NAMES.indexOf(last) === -1,
    'the last offered option must be the reserved no-room label, not a scored room; got ' + last);
  return last;
}

// ---------------------------------------------------------------------------
// Policy module preflight (Task 1 action step 1): the unit legs require
// lib/core/room-bind-picker-policy.cjs and lib/core/session-binding.cjs's
// NO_ROOM_SLUG export; both land in 360-07. Before then this resolves to
// null and every unit leg fails with the single, named reason below --
// never a require() crash, never a silent skip.
// ---------------------------------------------------------------------------
const MODULE_MISSING_MESSAGE = 'room-bind-picker-policy missing (RED until 360-07)';

function loadPolicyModule() {
  try {
    const mod = require(POLICY_PATH);
    const sb = require(SESSION_BINDING_PATH);
    if (!mod || typeof mod.cwdRoomsHomeVerdict !== 'function'
        || typeof mod.unboundPickerSuppression !== 'function') {
      return null;
    }
    if (!sb || typeof sb.NO_ROOM_SLUG !== 'string' || sb.NO_ROOM_SLUG.length === 0) {
      return null;
    }
    return { policy: mod, NO_ROOM_SLUG: sb.NO_ROOM_SLUG };
  } catch (_e) {
    return null;
  }
}

function requirePolicyReady() {
  const loaded = loadPolicyModule();
  if (!loaded) throw new Error(MODULE_MISSING_MESSAGE);
  return loaded;
}

function assertValidCwdVerdict(v, label) {
  assertTrue(['inside', 'outside', 'ancestor', 'unresolvable'].indexOf(v) !== -1,
    label + ' must return one of inside|outside|ancestor|unresolvable; got ' + JSON.stringify(v));
}

function assertValidSuppressionVerdict(v, label) {
  assertTrue(v === null || v === 'no-room-remembered' || v === 'cwd-outside-unbound',
    label + ' must return null | "no-room-remembered" | "cwd-outside-unbound"; got ' + JSON.stringify(v));
}

// =============================================================================
// ===== unit ==================================================================
// =============================================================================
// P-1 (N-1): an ancestor of the rooms home is ambiguous and fires (fails
// toward the picker); pinned at unit level here, and again at spawn level in
// the r10 section below (grep -c "ancestor" >= 2, Task 1 acceptance).

// -- cwdRoomsHomeVerdict --------------------------------------------------

leg('unit-cwd-verdict-inside-room', function () {
  const loaded = requirePolicyReady();
  const fx = makeFixture();
  try {
    const cwd = resolveCwd(fx, 'inside-rooms-home');
    const v = loaded.policy.cwdRoomsHomeVerdict(cwd, fx.rooms);
    assertValidCwdVerdict(v, 'inside-room');
    assertTrue(v === 'inside', 'a room subdirectory must verdict inside; got ' + v);
  } finally { fx.cleanup(); }
});

leg('unit-cwd-verdict-rooms-home-itself', function () {
  const loaded = requirePolicyReady();
  const fx = makeFixture();
  try {
    const cwd = resolveCwd(fx, 'rooms-home-itself');
    const v = loaded.policy.cwdRoomsHomeVerdict(cwd, fx.rooms);
    assertValidCwdVerdict(v, 'rooms-home-itself');
    assertTrue(v === 'inside', 'the rooms home itself must verdict inside; got ' + v);
  } finally { fx.cleanup(); }
});

leg('unit-cwd-verdict-outside-dev-repo', function () {
  const loaded = requirePolicyReady();
  const fx = makeFixture();
  try {
    const cwd = resolveCwd(fx, 'outside-dev-repo');
    const v = loaded.policy.cwdRoomsHomeVerdict(cwd, fx.rooms);
    assertValidCwdVerdict(v, 'outside-dev-repo');
    assertTrue(v === 'outside', 'a code repo cwd must verdict outside; got ' + v);
  } finally { fx.cleanup(); }
});

leg('unit-cwd-verdict-ancestor', function () {
  const loaded = requirePolicyReady();
  const fx = makeFixture();
  try {
    const cwd = resolveCwd(fx, 'ancestor'); // the fixture root, parent of rooms/
    const v = loaded.policy.cwdRoomsHomeVerdict(cwd, fx.rooms);
    assertValidCwdVerdict(v, 'ancestor');
    assertTrue(v === 'ancestor', 'an ancestor of the rooms home must verdict ancestor (P-1, fails toward fire); got ' + v);
  } finally { fx.cleanup(); }
});

leg('unit-cwd-verdict-malformed-values', function () {
  const loaded = requirePolicyReady();
  const fx = makeFixture();
  try {
    const cases = [undefined, 42, '', resolveCwd(fx, 'relative')];
    for (const c of cases) {
      const v = loaded.policy.cwdRoomsHomeVerdict(c, fx.rooms);
      assertValidCwdVerdict(v, 'malformed cwd ' + JSON.stringify(c));
      assertTrue(v === 'unresolvable',
        'a missing/non-string/empty/relative cwd must verdict unresolvable; ' + JSON.stringify(c) + ' got ' + v);
    }
  } finally { fx.cleanup(); }
});

leg('unit-cwd-verdict-nonexistent-absolute', function () {
  const loaded = requirePolicyReady();
  const fx = makeFixture();
  try {
    const cwd = resolveCwd(fx, 'nonexistent');
    const v = loaded.policy.cwdRoomsHomeVerdict(cwd, fx.rooms);
    assertValidCwdVerdict(v, 'nonexistent-absolute');
    assertTrue(v === 'unresolvable', 'an absolute path that does not exist must verdict unresolvable; got ' + v);
  } finally { fx.cleanup(); }
});

leg('unit-cwd-verdict-regular-file', function () {
  const loaded = requirePolicyReady();
  const fx = makeFixture();
  try {
    const filePath = path.join(fx.root, 'a-regular-file.txt');
    fs.writeFileSync(filePath, 'not a directory\n');
    const v = loaded.policy.cwdRoomsHomeVerdict(filePath, fx.rooms);
    assertValidCwdVerdict(v, 'regular-file');
    assertTrue(v === 'unresolvable', 'a regular file path is not a directory, must verdict unresolvable; got ' + v);
  } finally { fx.cleanup(); }
});

leg('unit-cwd-verdict-symlink-to-inside', function () {
  const loaded = requirePolicyReady();
  const fx = makeFixture();
  try {
    const cwd = resolveCwd(fx, 'symlink-to-inside'); // pre-realpath path sits OUTSIDE rooms/
    const v = loaded.policy.cwdRoomsHomeVerdict(cwd, fx.rooms);
    assertValidCwdVerdict(v, 'symlink-to-inside');
    assertTrue(v === 'inside',
      'a symlink whose realpath target resolves inside the rooms home must verdict inside; got ' + v);
  } finally { fx.cleanup(); }
});

leg('unit-cwd-verdict-symlinked-rooms-root', function () {
  const loaded = requirePolicyReady();
  const fx = makeFixture();
  try {
    // The ROOMS ROOT parameter itself is a symlink; the cwd is a real path
    // under the symlink's TARGET (not through the symlink).
    const roomsRootLink = path.join(fx.root, 'rooms-root-link');
    fs.symlinkSync(fx.rooms, roomsRootLink, 'dir');
    const cwd = path.join(fx.rooms, 'copper-ledger');
    const v = loaded.policy.cwdRoomsHomeVerdict(cwd, roomsRootLink);
    assertValidCwdVerdict(v, 'symlinked-rooms-root');
    assertTrue(v === 'inside',
      'a cwd under a symlinked rooms root\'s real target must verdict inside; got ' + v);
  } finally { fx.cleanup(); }
});

leg('unit-cwd-verdict-roomsroot-undefined', function () {
  const loaded = requirePolicyReady();
  const fx = makeFixture();
  try {
    const cwd = resolveCwd(fx, 'inside-rooms-home');
    const v = loaded.policy.cwdRoomsHomeVerdict(cwd, undefined);
    assertValidCwdVerdict(v, 'roomsroot-undefined');
    assertTrue(v === 'unresolvable', 'an unresolvable rooms root must verdict unresolvable; got ' + v);
  } finally { fx.cleanup(); }
});

// -- unboundPickerSuppression ----------------------------------------------

leg('unit-suppress-null-binding-outside', function () {
  const loaded = requirePolicyReady();
  const fx = makeFixture();
  try {
    const cwd = resolveCwd(fx, 'outside-dev-repo');
    const v = loaded.policy.unboundPickerSuppression({ binding: null, cwd: cwd, roomsRoot: fx.rooms });
    assertValidSuppressionVerdict(v, 'null-binding-outside');
    assertTrue(v === 'cwd-outside-unbound', 'null binding + outside cwd must suppress; got ' + JSON.stringify(v));
  } finally { fx.cleanup(); }
});

leg('unit-suppress-null-binding-inside-ancestor-unresolvable', function () {
  const loaded = requirePolicyReady();
  const fx = makeFixture();
  try {
    const classes = ['inside-rooms-home', 'ancestor'];
    for (const cls of classes) {
      const cwd = resolveCwd(fx, cls);
      const v = loaded.policy.unboundPickerSuppression({ binding: null, cwd: cwd, roomsRoot: fx.rooms });
      assertValidSuppressionVerdict(v, 'null-binding-' + cls);
      assertTrue(v === null, 'null binding + ' + cls + ' cwd must not suppress; got ' + JSON.stringify(v));
    }
    // 'unresolvable' (a non-string cwd):
    const vUnresolvable = loaded.policy.unboundPickerSuppression({ binding: null, cwd: 42, roomsRoot: fx.rooms });
    assertValidSuppressionVerdict(vUnresolvable, 'null-binding-unresolvable');
    assertTrue(vUnresolvable === null, 'null binding + unresolvable cwd must not suppress; got ' + JSON.stringify(vUnresolvable));
  } finally { fx.cleanup(); }
});

leg('unit-suppress-sentinel-primary-inside', function () {
  const loaded = requirePolicyReady();
  const fx = makeFixture();
  try {
    const cwd = resolveCwd(fx, 'inside-rooms-home');
    const binding = { bound: [loaded.NO_ROOM_SLUG], primary: loaded.NO_ROOM_SLUG };
    const v = loaded.policy.unboundPickerSuppression({ binding: binding, cwd: cwd, roomsRoot: fx.rooms });
    assertValidSuppressionVerdict(v, 'sentinel-primary-inside');
    assertTrue(v === 'no-room-remembered', 'a stored sentinel primary must suppress (N-2); got ' + JSON.stringify(v));
  } finally { fx.cleanup(); }
});

leg('unit-suppress-sentinel-bound-null-primary', function () {
  const loaded = requirePolicyReady();
  const fx = makeFixture();
  try {
    const cwd = resolveCwd(fx, 'inside-rooms-home');
    const binding = { bound: [loaded.NO_ROOM_SLUG], primary: null };
    const v = loaded.policy.unboundPickerSuppression({ binding: binding, cwd: cwd, roomsRoot: fx.rooms });
    assertValidSuppressionVerdict(v, 'sentinel-bound-null-primary');
    assertTrue(v === 'no-room-remembered',
      'a sentinel in bound with a null primary must still count as "chose no room" (P-2); got ' + JSON.stringify(v));
  } finally { fx.cleanup(); }
});

leg('unit-suppress-real-primary-outside', function () {
  const loaded = requirePolicyReady();
  const fx = makeFixture();
  try {
    const cwd = resolveCwd(fx, 'outside-dev-repo');
    const binding = { bound: ['tin-orchard'], primary: 'tin-orchard' };
    const v = loaded.policy.unboundPickerSuppression({ binding: binding, cwd: cwd, roomsRoot: fx.rooms });
    assertValidSuppressionVerdict(v, 'real-primary-outside');
    assertTrue(v === null,
      'a session with a REAL primary is not unbound; N-1 is unbound-only, must not suppress here; got ' + JSON.stringify(v));
  } finally { fx.cleanup(); }
});

leg('unit-suppress-real-primary-with-sentinel-also-bound', function () {
  const loaded = requirePolicyReady();
  const fx = makeFixture();
  try {
    const cwd = resolveCwd(fx, 'outside-dev-repo');
    const binding = { bound: ['tin-orchard', loaded.NO_ROOM_SLUG], primary: 'tin-orchard' };
    const v = loaded.policy.unboundPickerSuppression({ binding: binding, cwd: cwd, roomsRoot: fx.rooms });
    assertValidSuppressionVerdict(v, 'real-primary-with-sentinel-also-bound');
    assertTrue(v === null,
      'a REAL primary keeps today\'s behavior even if the sentinel also rides in bound (P-2); got ' + JSON.stringify(v));
  } finally { fx.cleanup(); }
});

leg('unit-suppress-never-throws-malformed-bindings', function () {
  const loaded = requirePolicyReady();
  const fx = makeFixture();
  try {
    const cwd = resolveCwd(fx, 'outside-dev-repo');
    const throwingGetterBinding = {};
    Object.defineProperty(throwingGetterBinding, 'bound', {
      get: function () { throw new Error('boom (binding.bound getter fault)'); },
    });
    const malformedBindings = [42, { bound: 'x' }, {}, throwingGetterBinding];
    for (const b of malformedBindings) {
      const v = loaded.policy.unboundPickerSuppression({ binding: b, cwd: cwd, roomsRoot: fx.rooms });
      assertValidSuppressionVerdict(v, 'malformed binding ' + JSON.stringify(b === throwingGetterBinding ? '<throwing getter>' : b));
    }
  } finally { fx.cleanup(); }
});

// -- sentinel literal hygiene ------------------------------------------------

leg('unit-no-sentinel-literal-in-policy-module', function () {
  requirePolicyReady();
  const src = fs.readFileSync(POLICY_PATH, 'utf8');
  const matches = src.match(/['"]__no_room__['"]/g) || [];
  assertTrue(matches.length === 0,
    'lib/core/room-bind-picker-policy.cjs must not re-type the reserved sentinel as a quoted literal '
    + '(the value comes from lib/core/session-binding.cjs); found ' + matches.length + ' occurrence(s)');
});

// =============================================================================
// ===== r10 ===================================================================
// =============================================================================
// Spawn-level legs over CASES.policy_entries, driven against the LIVE
// scripts/intent-classifier.cjs. These do NOT depend on the policy module --
// they pin the observable cwd-rule behavior at the hook boundary, which is
// exactly SPEC R10's own acceptance shape. RED on outside-dev-repo (fires
// today, no cwd gate exists) and harness-inside (fires today, no harness
// guard exists -- both land in 360-07).

function stdinForPolicyEntry(fixture, entry, sessionId) {
  const stdin = { prompt: entry.prompt, session_id: sessionId, hook_event_name: 'UserPromptSubmit' };
  const cwd = resolveCwd(fixture, entry.cwd_class);
  if (typeof cwd !== 'undefined') stdin.cwd = cwd;
  return stdin;
}

function findPolicyEntry(id) {
  const entry = CASES.policy_entries.find(function (e) { return e.id === id; });
  assertTrue(entry, 'cases.json policy_entries must carry an entry with id ' + id);
  return entry;
}

// outside-dev-repo: an unbound session with a cwd outside the rooms home
// must emit no marker and make no side write (N-1, SPEC R10). RED today
// (this entry fires, exactly as 360-02-SUMMARY's smoke table recorded).
leg('r10-outside-dev-repo', function () {
  const entry = findPolicyEntry('outside-dev-repo');
  const sid = 'sample-session-r10-outside-dev-repo';
  const fx = makeFixture();
  try {
    const stdin = stdinForPolicyEntry(fx, entry, sid);
    const res = spawnClassifier(fx, stdin, {});
    assertTrue(res.status === 0, 'exit 0 (never-block); got ' + res.status + ' stderr=' + res.stderr);
    const hits = markersIn(res.stdout);
    assertTrue(hits.length === 0,
      'an unbound session with a cwd outside the rooms home must emit no marker; got [' + hits.join(', ') + ']');
    const sw = sideWrites(fx, sid);
    assertTrue(
      sw.f8SideChannel === 0 && sw.bindingGatePayload === 0 && sw.zeroScoreGate === 0
      && sw.strictModeTrace === 0 && sw.offeredMarkerFiles.length === 0,
      'must make 0 side writes; got ' + JSON.stringify(sw)
    );
  } finally { fx.cleanup(); }
});

// Control: the identical stdin on the PLAN_BASE code root must still fire --
// proves the corpus is meaningful (the message itself is rich enough to
// fire), both before AND after 360-07 lands the cwd guard.
leg('r10-outside-dev-repo-control-planbase', function () {
  const entry = findPolicyEntry('outside-dev-repo');
  const sid = 'sample-session-r10-outside-dev-repo-control';
  const fx = makeFixture();
  try {
    const stdin = stdinForPolicyEntry(fx, entry, sid);
    const planBase = buildCodeRoot(PRE_PHASE.plan_base_sha);
    const res = spawnClassifier(fx, stdin, { classifier: planBase });
    assertTrue(res.status === 0, 'control exit 0; got ' + res.status + ' stderr=' + res.stderr);
    const hits = markersIn(res.stdout);
    assertTrue(hits.length > 0, 'control (PLAN_BASE, no cwd guard exists there either) must fire; got no marker');
  } finally { fx.cleanup(); }
});

// inside-rooms-home / rooms-home-itself: N-1 does not apply inside the rooms
// home -- HEAD's stdout must be byte-identical to the PLAN_BASE code root at
// the same fixture path (behavior unchanged). GREEN today by construction
// (no cwd logic exists on either side yet) and must stay GREEN after 360-07.
const BYTE_IDENTICAL_IDS = ['inside-rooms-home', 'rooms-home-itself'];
for (const id of BYTE_IDENTICAL_IDS) {
  leg('r10-' + id, function () {
    const entry = findPolicyEntry(id);
    const sid = 'sample-session-r10-' + id;
    const fixedPath = path.join(os.tmpdir(), 'p360-r10-' + id + '-' + process.pid);
    try {
      const planBase = buildCodeRoot(PRE_PHASE.plan_base_sha);

      const fx1 = makeFixture({ at: fixedPath });
      const stdin1 = stdinForPolicyEntry(fx1, entry, sid);
      const runPlanBase = spawnClassifier(fx1, stdin1, { classifier: planBase });

      const fx2 = makeFixture({ at: fixedPath });
      const stdin2 = stdinForPolicyEntry(fx2, entry, sid);
      const runHead = spawnClassifier(fx2, stdin2, {});

      assertBytesEqual(
        roomResolutionSegment(runPlanBase.stdout),
        roomResolutionSegment(runHead.stdout),
        id + ' PLAN_BASE vs HEAD (room-resolution segment, N-1 does not apply inside the rooms home)'
      );
    } finally {
      rmrf(fixedPath);
    }
  });
}

// ancestor, missing, non-string, relative, nonexistent, symlink-to-inside:
// every fail-toward-picker class must still fire (unreadable/ambiguous cwd
// means today's behavior, N-1). GREEN today (nothing about cwd affects
// firing yet) and must stay GREEN after 360-07 (the rule's own fail-open
// branch, not a suppression case).
const FAIL_TOWARD_PICKER_IDS = ['ancestor', 'missing', 'non-string', 'relative', 'nonexistent', 'symlink-to-inside'];
for (const id of FAIL_TOWARD_PICKER_IDS) {
  leg('r10-' + id, function () {
    const entry = findPolicyEntry(id);
    const sid = 'sample-session-r10-' + id;
    const fx = makeFixture();
    try {
      const stdin = stdinForPolicyEntry(fx, entry, sid);
      const res = spawnClassifier(fx, stdin, {});
      assertTrue(res.status === 0, 'exit 0; got ' + res.status + ' stderr=' + res.stderr);
      const hits = markersIn(res.stdout);
      assertTrue(hits.length > 0,
        'cwd class "' + id + '" is ambiguous/unreadable and must fail toward showing the picker; got no marker');
    } finally { fx.cleanup(); }
  });
}

// bound-outside-offscope: N-1 is scoped to UNBOUND sessions. A session
// already bound to a room, working from a cwd outside the rooms home, must
// still see its off-scope mismatch header. GREEN today and after 360-07.
leg('r10-bound-outside-offscope', function () {
  const entry = findPolicyEntry('bound-outside-offscope');
  const sid = 'sample-session-r10-bound-outside-offscope';
  const fx = makeFixture();
  try {
    writeBinding(fx, sid, entry.binding);
    const stdin = stdinForPolicyEntry(fx, entry, sid);
    const res = spawnClassifier(fx, stdin, {});
    assertTrue(res.status === 0, 'exit 0; got ' + res.status + ' stderr=' + res.stderr);
    const hits = markersIn(res.stdout);
    const expectedMarker = typeof entry.marker === 'string' ? entry.marker : 'also matches';
    assertTrue(hits.indexOf(expectedMarker) !== -1,
      'a bound session with an outside cwd must still fire "' + expectedMarker + '"; got [' + hits.join(', ') + ']');
  } finally { fx.cleanup(); }
});

// harness-inside: a harness-lead prompt with a cwd inside the rooms home
// must emit no marker regardless -- R1 (the harness guard) and R10 (the cwd
// rule) are independent gates, and R1 always wins for a harness verdict.
// RED today (the harness guard does not exist yet either; both land in
// 360-07).
leg('r10-harness-inside', function () {
  const entry = findPolicyEntry('harness-inside');
  const sid = 'sample-session-r10-harness-inside';
  const fx = makeFixture();
  try {
    const stdin = stdinForPolicyEntry(fx, entry, sid);
    const res = spawnClassifier(fx, stdin, {});
    assertTrue(res.status === 0, 'exit 0 (never-block); got ' + res.status + ' stderr=' + res.stderr);
    const hits = markersIn(res.stdout);
    assertTrue(hits.length === 0,
      'a harness-lead prompt (even with a cwd inside the rooms home) must emit no marker (the harness guard, layered); '
      + 'got [' + hits.join(', ') + ']');
  } finally { fx.cleanup(); }
});

// =============================================================================
// ===== r11 ===================================================================
// =============================================================================
// SPEC R11 / N-2: once a session answers "dev repo / no room" (resolved
// structurally from the persisted gate payload, never re-typed as a
// literal -- see resolveNoRoomLabel above), the picker must not re-fire for
// the rest of that session_id; a different session_id still asks; an
// explicit rebind through the binding store still works.

leg('r11-typed-remembered', function () {
  const seq = CASES.sequences.find(function (s) { return s.id === 'r11-no-room-typed'; });
  assertTrue(seq, 'cases.json sequences must carry r11-no-room-typed');
  const sid = 'sample-session-r11-typed';
  const fx = makeFixture();
  try {
    const cwd = resolveCwd(fx, seq.cwd_class);

    // Turn 1 (human): fires the unbound F.8 gate and persists a
    // binding_gate_payload the sequence reads back.
    const turn1Stdin = { prompt: seq.turns[0].prompt, session_id: sid, hook_event_name: 'UserPromptSubmit', cwd: cwd };
    const res1 = spawnClassifier(fx, turn1Stdin, {});
    assertTrue(res1.status === 0, 'turn 1 exit 0; got ' + res1.status + ' stderr=' + res1.stderr);
    const hits1 = markersIn(res1.stdout);
    assertTrue(hits1.length > 0, 'turn 1 (human, unbound) must fire the F.8 gate; got no marker');

    const found = readLatestGatePayload(fx, sid);
    assertTrue(!!found, 'turn 1 must persist a binding_gate_payload the sequence can read back');
    const noRoomLabel = resolveNoRoomLabel(found.payload);

    // Turn 2 (human): the payload's own no-room label, typed exactly.
    const turn2Stdin = { prompt: noRoomLabel, session_id: sid, hook_event_name: 'UserPromptSubmit', cwd: cwd };
    const res2 = spawnClassifier(fx, turn2Stdin, {});
    assertTrue(res2.status === 0, 'turn 2 exit 0; got ' + res2.status + ' stderr=' + res2.stderr);
    const bindingAfter2 = readBinding(fx, sid);
    assertTrue(typeof bindingAfter2.primary === 'string' && bindingAfter2.primary.length > 0,
      'turn 2 (the no-room answer) must leave a non-empty sentinel primary; got ' + JSON.stringify(bindingAfter2.primary));
    assertTrue(KNOWN_FIXTURE_ROOM_NAMES.indexOf(bindingAfter2.primary) === -1,
      'turn 2 must leave primary equal to the reserved sentinel, never a real room; got ' + bindingAfter2.primary);

    // Turn 3 (human, same session_id): the identical turn-1 prompt must now
    // emit no marker and make 0 new side writes (0 pickers, N-2). RED today
    // (the verified root cause: runBindingGate / resolveSessionScope treat
    // the sentinel as off-scope for every room, so the unbound header fires
    // again instead of staying silent).
    const swBefore3 = sideWrites(fx, sid);
    const turn3Stdin = { prompt: seq.turns[2].prompt, session_id: sid, hook_event_name: 'UserPromptSubmit', cwd: cwd };
    const res3 = spawnClassifier(fx, turn3Stdin, {});
    assertTrue(res3.status === 0, 'turn 3 exit 0; got ' + res3.status + ' stderr=' + res3.stderr);
    const hits3 = markersIn(res3.stdout);
    assertTrue(hits3.length === 0,
      'turn 3 (same session, after the no-room answer) must emit no marker (0 pickers, N-2); got [' + hits3.join(', ') + ']');
    const swAfter3 = sideWrites(fx, sid);
    assertTrue(
      swAfter3.f8SideChannel === swBefore3.f8SideChannel
      && swAfter3.bindingGatePayload === swBefore3.bindingGatePayload
      && swAfter3.offeredMarkerFiles.length === swBefore3.offeredMarkerFiles.length,
      'turn 3 must make 0 new side writes (deltas must all be 0)'
    );

    // A different session_id with the same turn-1 prompt must still fire --
    // a new session asks again (N-2 is scoped to the session_id that
    // answered, not a global suppression).
    const otherSid = seq.other_session_id;
    assertTrue(typeof otherSid === 'string' && otherSid.length > 0, 'the sequence must name other_session_id');
    const turn3OtherStdin = { prompt: seq.turns[2].prompt, session_id: otherSid, hook_event_name: 'UserPromptSubmit', cwd: cwd };
    const res3Other = spawnClassifier(fx, turn3OtherStdin, {});
    assertTrue(res3Other.status === 0, 'other_session_id turn exit 0; got ' + res3Other.status);
    const hits3Other = markersIn(res3Other.stdout);
    assertTrue(hits3Other.length > 0,
      'a different session_id (' + otherSid + ') must still fire; a new session asks again; got no marker');
  } finally { fx.cleanup(); }
});

leg('r11-after-zero-score-remembered', function () {
  const seq = CASES.sequences.find(function (s) { return s.id === 'r11-no-room-after-zero-score'; });
  assertTrue(seq, 'cases.json sequences must carry r11-no-room-after-zero-score');
  const sid = 'sample-session-r11-zero-score';
  const fx = makeFixture();
  try {
    const cwd = resolveCwd(fx, seq.cwd_class);
    if (seq.setup && seq.setup.binding) writeBinding(fx, sid, seq.setup.binding);

    // Turn 1 (human): a substantive zero-score reframe fires the no-match gate.
    const turn1Stdin = { prompt: seq.turns[0].prompt, session_id: sid, hook_event_name: 'UserPromptSubmit', cwd: cwd };
    const res1 = spawnClassifier(fx, turn1Stdin, {});
    assertTrue(res1.status === 0, 'turn 1 exit 0; got ' + res1.status + ' stderr=' + res1.stderr);
    const hits1 = markersIn(res1.stdout);
    assertTrue(hits1.indexOf('no room matched') !== -1,
      'turn 1 must fire the zero-score no-match gate; got [' + hits1.join(', ') + ']');

    const found = readLatestGatePayload(fx, sid);
    assertTrue(!!found, 'turn 1 must persist a zero_score_gate binding_gate_payload');
    const noRoomLabel = resolveNoRoomLabel(found.payload);

    // Turn 2 (human): the payload's own no-room label.
    const turn2Stdin = { prompt: noRoomLabel, session_id: sid, hook_event_name: 'UserPromptSubmit', cwd: cwd };
    const res2 = spawnClassifier(fx, turn2Stdin, {});
    assertTrue(res2.status === 0, 'turn 2 exit 0; got ' + res2.status + ' stderr=' + res2.stderr);
    const bindingAfter2 = readBinding(fx, sid);
    assertTrue(typeof bindingAfter2.primary === 'string' && bindingAfter2.primary.length > 0,
      'turn 2 must leave a non-empty sentinel primary; got ' + JSON.stringify(bindingAfter2.primary));

    // Turn 3 (human): a later copper-ledger scoring prompt must not re-fire.
    // RED today for the same verified root cause as the typed sequence.
    const turn3Stdin = { prompt: seq.turns[2].prompt, session_id: sid, hook_event_name: 'UserPromptSubmit', cwd: cwd };
    const res3 = spawnClassifier(fx, turn3Stdin, {});
    assertTrue(res3.status === 0, 'turn 3 exit 0; got ' + res3.status + ' stderr=' + res3.stderr);
    const hits3 = markersIn(res3.stdout);
    assertTrue(hits3.length === 0,
      'turn 3 after the zero-score no-room answer must emit no marker; got [' + hits3.join(', ') + ']');
  } finally { fx.cleanup(); }
});

leg('r11-explicit-rebind-restores-gating', function () {
  const seq = CASES.sequences.find(function (s) { return s.id === 'r11-explicit-rebind'; });
  assertTrue(seq, 'cases.json sequences must carry r11-explicit-rebind');
  const sid = 'sample-session-r11-rebind';
  const fx = makeFixture();
  try {
    const cwd = resolveCwd(fx, seq.cwd_class);

    // Turn 1 (human): fires and persists the payload.
    const turn1Stdin = { prompt: seq.turns[0].prompt, session_id: sid, hook_event_name: 'UserPromptSubmit', cwd: cwd };
    const res1 = spawnClassifier(fx, turn1Stdin, {});
    assertTrue(res1.status === 0, 'turn 1 exit 0; got ' + res1.status);
    const hits1 = markersIn(res1.stdout);
    assertTrue(hits1.length > 0, 'turn 1 must fire; got no marker');

    const found = readLatestGatePayload(fx, sid);
    assertTrue(!!found, 'turn 1 must persist a binding_gate_payload');
    const noRoomLabel = resolveNoRoomLabel(found.payload);

    // Turn 2 (human): the no-room answer.
    const turn2Stdin = { prompt: noRoomLabel, session_id: sid, hook_event_name: 'UserPromptSubmit', cwd: cwd };
    const res2 = spawnClassifier(fx, turn2Stdin, {});
    assertTrue(res2.status === 0, 'turn 2 exit 0; got ' + res2.status);

    // Explicit room bind through the SAME store (standing in for /mos:rooms
    // or room_bind): N-2 must never suppress an explicit command.
    assertTrue(seq.explicit_rebind, 'the sequence must carry explicit_rebind');
    writeBinding(fx, sid, seq.explicit_rebind);

    // Turn 3 (human): a copper-ledger prompt must fire the off-scope header
    // again -- the explicit rebind restores gating.
    const turn3Entry = seq.turns[2];
    const turn3Stdin = { prompt: turn3Entry.prompt, session_id: sid, hook_event_name: 'UserPromptSubmit', cwd: cwd };
    const res3 = spawnClassifier(fx, turn3Stdin, {});
    assertTrue(res3.status === 0, 'turn 3 exit 0; got ' + res3.status);
    const hits3 = markersIn(res3.stdout);
    const expectedMarker = typeof turn3Entry.marker === 'string' ? turn3Entry.marker : 'also matches';
    assertTrue(hits3.indexOf(expectedMarker) !== -1,
      'turn 3 after an explicit rebind must fire "' + expectedMarker + '"; got [' + hits3.join(', ') + ']');
  } finally { fx.cleanup(); }
});

// =============================================================================
// ===== fault =================================================================
// =============================================================================
// R6 applied to the new guard: with --require throwing-picker-policy.cjs, an
// outside-dev-repo unbound human turn must still print the unbound header
// (fail toward today's behavior), exit 0 (PSB-06 never-block), and the spy
// file must hold exactly 1 invocation line once 360-07 wires the guard
// through this export. RED today: 0 invocations (nothing calls the
// not-yet-shipped unboundPickerSuppression export).
leg('fault-throwing-picker-policy', function () {
  const entry = findPolicyEntry('outside-dev-repo');
  const sid = 'sample-session-fault-outside';
  const fx = makeFixture();
  try {
    const stdin = stdinForPolicyEntry(fx, entry, sid);
    const spyPath = path.join(fx.tmp, 'spy-out-fault.txt');
    const res = spawnClassifier(fx, stdin, {
      preloads: [FAULT_STUB_PATH],
      env: { SPY_OUT_360: spyPath },
    });
    assertTrue(res.status === 0, 'exit 0 (never-block); got ' + res.status + ' stderr=' + res.stderr);
    const hits = markersIn(res.stdout);
    assertTrue(hits.length > 0,
      'a policy fault must fail toward today\'s behavior (the picker still fires); got no marker');
    const lines = readSpyLines(spyPath);
    assertTrue(lines.length === 1, 'the stub must record exactly 1 invocation; got ' + lines.length);
  } finally { fx.cleanup(); }
});

// ---------------------------------------------------------------------------

console.log('PASS test-360-picker-policy.cjs (' + checks + ' checks)');
if (failed > 0) process.exit(1);
