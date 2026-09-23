'use strict';
/*
 * Phase 360 Plan 02 -- the ONE shared spawn kit for driving
 * scripts/intent-classifier.cjs under a fully hermetic env (T-360-05: no
 * 360 test may touch the navigator's real state). Plans 04 and 05 both
 * import this module; it holds no test assertions of its own.
 *
 * Node built-ins plus lib/core/session-binding.cjs only. No module-level
 * side effects. No stdin read (this file never reads fd 0 -- every hermetic
 * spawn passes its stdin payload via spawnSync's `input` option instead).
 *
 * No em-dashes.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const CLASSIFIER = path.join(REPO_ROOT, 'scripts', 'intent-classifier.cjs');

const { writeSessionBinding, readSessionBinding } = require(
  path.join(REPO_ROOT, 'lib', 'core', 'session-binding.cjs')
);

const CASES = require(path.join(__dirname, 'cases.json'));
const PRE_PHASE = require(path.join(__dirname, 'pre-phase.json'));

// ---------------------------------------------------------------------------
// MARKERS -- the distinctive stdout substrings a caller checks for. Every
// entry below is a LITERAL substring emitted by scripts/intent-classifier.cjs
// today (see 360-RESEARCH Findings 5-6 and the emitter read in 360-02's own
// plan <read_first> list); case-insensitive matching per the plan.
// ---------------------------------------------------------------------------
const MARKERS = Object.freeze([
  'bind session',
  'session unbound',
  'also matches',
  'no room matched',
  'Intent mismatch',
  'strict-mode override',
]);

function markersIn(stdout) {
  const text = typeof stdout === 'string' ? stdout : '';
  const lower = text.toLowerCase();
  const hits = [];
  for (const m of MARKERS) {
    if (lower.indexOf(m.toLowerCase()) !== -1) hits.push(m);
  }
  return hits;
}

// ---------------------------------------------------------------------------
// makeFixture(opts) -- a fully hermetic rooms home + env scratch space.
//
// Layout (all under one mkdtemp root, so a single cleanup() removes it all):
//   root/
//     rooms/                     <- MINDRIAN_ROOMS_HOME / MINDRIAN_ROOMS_ROOT
//       .rooms/registry.json
//       .rooms/sessions/<sid>.json     (session-binding.cjs writes here)
//       copper-ledger/STATE.md
//       tin-orchard/STATE.md
//       quantum-bakery/STATE.md
//     home/                      <- HOME (so os.homedir() never leaks to the
//                                    developer's real $HOME)
//     mindrian-home/             <- MINDRIAN_HOME
//     tmp/                       <- TMPDIR
//     dev/sample-repo/.git/      <- an "outside the rooms home" cwd target
//     card-fire-reached.json     <- CARD_FIRE_SIDECHANNEL_PATH file (not a dir)
//
// opts.at: reuse a FIXED root path (removed first if present) instead of a
// fresh mkdtemp, so the R3 byte-identical leg (360-03) can spawn the archived
// PLAN_BASE classifier and HEAD's classifier against the identical path.
// ---------------------------------------------------------------------------
function makeFixture(opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  let root;
  if (typeof o.at === 'string' && o.at.length > 0) {
    try { fs.rmSync(o.at, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
    fs.mkdirSync(o.at, { recursive: true });
    root = o.at;
  } else {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'p360-ups-'));
  }

  const rooms = path.join(root, 'rooms');
  const home = path.join(root, 'home');
  const mh = path.join(root, 'mindrian-home');
  const tmp = path.join(root, 'tmp');
  const devRepo = path.join(root, 'dev', 'sample-repo');
  const sidechannel = path.join(root, 'card-fire-reached.json');

  fs.mkdirSync(rooms, { recursive: true });
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(mh, { recursive: true });
  fs.mkdirSync(tmp, { recursive: true });
  fs.mkdirSync(devRepo, { recursive: true });
  fs.mkdirSync(path.join(devRepo, '.git'), { recursive: true });
  fs.mkdirSync(path.join(rooms, '.rooms'), { recursive: true });
  fs.mkdirSync(path.join(rooms, '.rooms', 'sessions'), { recursive: true });

  const roomNames = Object.keys(CASES.rooms).filter(function (k) { return k !== 'active'; });
  for (const name of roomNames) {
    const dir = path.join(rooms, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'STATE.md'), CASES.rooms[name].state_md);
  }

  const registry = { active: CASES.rooms.active, rooms: {} };
  for (const name of roomNames) registry.rooms[name] = { slug: name };
  fs.writeFileSync(
    path.join(rooms, '.rooms', 'registry.json'),
    JSON.stringify(registry, null, 2)
  );

  function cleanup() {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }

  return { root: root, rooms: rooms, home: home, mh: mh, sidechannel: sidechannel, tmp: tmp, devRepo: devRepo, cleanup: cleanup };
}

// ---------------------------------------------------------------------------
// resolveCwd(fixture, cwdClass) -- SPEC R10 / N-1 cwd classes. Returns the
// concrete value to place at stdin.cwd (never the real spawn cwd, which
// spawnClassifier always pins at fixture.root so resolve-brain-key never
// finds a repo .env).
// ---------------------------------------------------------------------------
function resolveCwd(fixture, cwdClass) {
  switch (cwdClass) {
    case 'missing':
      return undefined;
    case 'non-string':
      return 42;
    case 'relative':
      return path.join('dev', 'sample-repo');
    case 'nonexistent':
      return path.join(fixture.root, 'does-not-exist');
    case 'ancestor':
      return fixture.root;
    case 'rooms-home-itself':
      return fixture.rooms;
    case 'inside-rooms-home':
      return path.join(fixture.rooms, 'copper-ledger');
    case 'symlink-to-inside': {
      const linkPath = path.join(fixture.root, 'link-in');
      try { fs.unlinkSync(linkPath); } catch (_e) { /* not present */ }
      fs.symlinkSync(path.join(fixture.rooms, 'tin-orchard'), linkPath, 'dir');
      return linkPath;
    }
    case 'outside-dev-repo':
      return fixture.devRepo;
    default:
      return fixture.devRepo;
  }
}

// ---------------------------------------------------------------------------
// writeBinding / readBinding -- thin wrappers over lib/core/session-binding.cjs
// scoped to the fixture's rooms home (D-13: never touch the real
// MINDRIAN_ROOMS_HOME).
// ---------------------------------------------------------------------------
function writeBinding(fixture, sid, binding) {
  writeSessionBinding(sid, binding, { home: fixture.rooms });
}

function readBinding(fixture, sid) {
  return readSessionBinding(sid, { home: fixture.rooms });
}

// ---------------------------------------------------------------------------
// spawnClassifier(fixture, stdinObj, opts) -- the ONE hermetic spawn. A
// minimal env allowlist only (T-360-05): no ambient developer env leaks in
// except PATH, so a fault in this kit can never touch the real navigator
// state or make a keyed network call.
// ---------------------------------------------------------------------------
function spawnClassifier(fixture, stdinObj, opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  const preloadArgs = [];
  const preloads = Array.isArray(o.preloads) ? o.preloads : [];
  for (const p of preloads) {
    preloadArgs.push('--require', p);
  }
  const classifierPath = (typeof o.classifier === 'string' && o.classifier.length > 0)
    ? o.classifier
    : CLASSIFIER;

  const env = Object.assign(
    {},
    { PATH: process.env.PATH || '/usr/bin:/bin' },
    {
      HOME: fixture.home,
      MINDRIAN_HOME: fixture.mh,
      CARD_FIRE_SIDECHANNEL_PATH: fixture.sidechannel,
      MINDRIAN_ROOMS_HOME: fixture.rooms,
      MINDRIAN_ROOMS_ROOT: fixture.rooms,
      TMPDIR: fixture.tmp,
      MINDRIAN_COPILOT_INJECT_FINDINGS: '0',
      MOS_NAV_TEST_DISABLE_DRAIN: '1',
    },
    (o.env && typeof o.env === 'object') ? o.env : {}
  );

  return spawnSync(process.execPath, preloadArgs.concat([classifierPath]), {
    input: JSON.stringify(stdinObj),
    encoding: 'utf8',
    cwd: fixture.root,
    timeout: 30000,
    env: env,
  });
}

// ---------------------------------------------------------------------------
// buildCodeRoot(sha) -- 357's `--code-root` pattern (Pattern 3): extract
// `git archive <sha> scripts lib data` into a cached temp dir and return the
// archived classifier's path, for the R3 byte-identical leg (360-03). Cached
// per sha for the lifetime of the process so repeated calls in one test file
// do not re-extract.
// ---------------------------------------------------------------------------
const codeRootCache = new Map();
function buildCodeRoot(sha) {
  if (codeRootCache.has(sha)) return codeRootCache.get(sha);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p360-coderoot-'));
  const archive = execFileSync('git', ['archive', sha, 'scripts', 'lib', 'data'], {
    cwd: REPO_ROOT,
    maxBuffer: 1024 * 1024 * 128,
  });
  execFileSync('tar', ['-x'], { cwd: dir, input: archive });
  const classifierPath = path.join(dir, 'scripts', 'intent-classifier.cjs');
  codeRootCache.set(sha, classifierPath);
  return classifierPath;
}

// ---------------------------------------------------------------------------
// sideWrites(fixture, sid) -- counts of every side write the F.8 / zero-score
// / strict-mode / consumer paths can make for a given session, scanning
// EVERY room under the fixture (a bound session's writes land in whichever
// room resolveSessionRoomDir picked, not necessarily the scored room).
// ---------------------------------------------------------------------------
function sideWrites(fixture, sid) {
  const out = {
    f8SideChannel: 0,
    bindingGatePayload: 0,
    zeroScoreGate: 0,
    strictModeTrace: 0,
    bindingGateConsumed: 0,
    offeredMarkerFiles: [],
  };

  // Card-fire side channel: one JSON store keyed by sessionId.
  try {
    const raw = fs.readFileSync(fixture.sidechannel, 'utf8');
    const store = JSON.parse(raw);
    const list = (store && Array.isArray(store[sid])) ? store[sid] : [];
    out.f8SideChannel = list.filter(function (rec) {
      return rec && rec.shape === 'F.8';
    }).length;
  } catch (_e) {
    // No side-channel file yet -- 0 is correct.
  }

  // Decision traces + offered markers: scan every room dir under fixture.rooms.
  let roomNames = [];
  try {
    roomNames = fs.readdirSync(fixture.rooms, { withFileTypes: true })
      .filter(function (e) { return e.isDirectory() && e.name !== '.rooms'; })
      .map(function (e) { return e.name; });
  } catch (_e) {
    roomNames = [];
  }

  for (const roomName of roomNames) {
    const tracesDir = path.join(fixture.rooms, roomName, '.mindrian', 'decision-traces');

    const tracePath = path.join(tracesDir, sid + '.json');
    try {
      const raw = fs.readFileSync(tracePath, 'utf8');
      const parsed = JSON.parse(raw);
      const traces = (parsed && Array.isArray(parsed.traces)) ? parsed.traces : [];
      for (const e of traces) {
        if (!e || typeof e !== 'object') continue;
        if (e.kind === 'binding_gate' && e.binding_gate_payload) out.bindingGatePayload += 1;
        if (e.kind === 'zero_score_gate' && e.binding_gate_payload) out.zeroScoreGate += 1;
        if (e.kind === 'strict_mode') out.strictModeTrace += 1;
        if (e.kind === 'binding_gate_consumed') out.bindingGateConsumed += 1;
      }
    } catch (_e) {
      // No trace file for this room -- 0 is correct.
    }

    for (const suffix of ['.binding-gate-offered.json', '.zero-score-gate-offered.json']) {
      const markerPath = path.join(tracesDir, sid + suffix);
      if (fs.existsSync(markerPath)) out.offeredMarkerFiles.push(markerPath);
    }
  }

  return out;
}

module.exports = {
  REPO_ROOT,
  CLASSIFIER,
  CASES,
  PRE_PHASE,
  MARKERS,
  markersIn,
  makeFixture,
  resolveCwd,
  writeBinding,
  readBinding,
  spawnClassifier,
  buildCodeRoot,
  sideWrites,
};
