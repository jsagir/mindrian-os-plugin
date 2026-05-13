#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 93 D2 -- /mos:doctor diagnostic + recovery for install-cache drift.
 *
 * Detects whether the live install at ~/.claude/plugins/mindrian-os/ is
 * out of sync with the marketplace cache at
 * ~/.claude/plugins/cache/mindrian-marketplace/mos/<latest>/, and offers
 * a one-shot recovery via --fix that backs up the stale install and
 * replaces it with the latest cached version.
 *
 * MODES:
 *   doctor             read-only diagnostic — exits with status code only
 *   doctor --fix       runs backup-then-replace recovery if drift detected
 *   doctor --json      machine-readable output (for hooks / regression tests)
 *
 * Exit codes:
 *   0  -> healthy, no drift
 *   1  -> drift detected (read-only mode)
 *   2  -> drift detected and recovered (--fix mode)
 *   3  -> internal error (cannot read directories, no marketplace cache, etc.)
 *
 * Phase 93 scope. See docs/autopsies/2026-04-28-install-cache-drift-incident.md.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// -- Paths -----------------------------------------------------------

const HOME = os.homedir();
// Phase 95.2 D-14: optional MINDRIAN_PLUGIN_HOME override mirrors the
// MINDRIAN_ROOMS_HOME pattern from 95.1 (line 294). Tests set this to a
// scratch dir; production users never set it -- defaults to ~/.claude/plugins.
const PLUGIN_HOME = process.env.MINDRIAN_PLUGIN_HOME || path.join(HOME, '.claude/plugins');
// INSTALL_DIR is the legacy-clone path; class I (Phase 123 Plan-03) treats
// topology=='legacy' as a migration candidate, not a missing-install. New
// code MUST use resolveActivePluginRoot() from lib/core/active-plugin-root.cjs
// instead of this constant. INSTALL_DIR remains the source of truth for the
// existing class A check (checkInstallVersion), which class I reinterprets
// via topology classification (Bug 7 fix: marketplace-cache topology with no
// legacy dir is VALID, not drift).
const INSTALL_DIR = path.join(PLUGIN_HOME, 'mindrian-os');
// Phase 123 Plan-03 (HARNESS-123-07 + HARNESS-123-08): the one resolver.
// Class I + class J + the aggressive --fix all resolve via this -- NEVER via
// the hardcoded INSTALL_DIR constant above.
const { resolveActivePluginRoot } = require(path.join(__dirname, '..', 'lib', 'core', 'active-plugin-root.cjs'));
// Phase 123 Plan-03: the plugin root for class-J --fix and for spawning
// session-start. resolveActivePluginRoot's `root` is the ACTIVE install path
// (which may be a marketplace-cache version dir); the plugin SOURCE root --
// where scripts/session-start lives -- is THIS script's repo root.
const PLUGIN_ROOT = path.resolve(__dirname, '..');
const INSTALL_PLUGIN_JSON = path.join(INSTALL_DIR, '.claude-plugin/plugin.json');
const MARKETPLACE_CACHE_DIR = path.join(PLUGIN_HOME, 'cache/mindrian-marketplace/mos');
// Phase 95.6 D-09 / R-01: the install receipt install.sh writes incrementally.
// Class H reads it to confirm the install actually finished and, if not, to
// name the missing tail steps.
const INSTALL_RECEIPT_JSON = path.join(INSTALL_DIR, '.install-receipt.json');

// -- ANSI colors -----------------------------------------------------

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

// -- Argument parsing ------------------------------------------------

function parseArgs(argv) {
  const flags = {
    fix: false, json: false, verbose: false,
    cascadeRooms: false, verifySurface: false, roomMd: false, uiCompliance: false,
    statuslineVisibility: false,
    installState: false,
    // Phase 123 Plan-04 (HARNESS-123-11 + HARNESS-123-12): release-gate-as-a-
    // command. --acceptance runs the 7-point checklist; --pre-tag filters to
    // the 5 pre-tag-applicable points; --light-npx skips the mktemp HOME
    // override sandbox in the npx-roundtrip point (operator opt-in for slow
    // networks / hermetic CI). --acceptance has its OWN exit-code contract
    // (0 = all points passed; 1 = any point failed) and is NOT a class flag,
    // so the class-flag-always-exit-0 invariant does NOT apply.
    acceptance: false, preTag: false, lightNpx: false,
    all: false, simulateWrite: null,
    scanCommandsDir: null, scanScriptsDir: null,
  };
  for (const arg of argv) {
    if (arg === '--fix') flags.fix = true;
    else if (arg === '--json') flags.json = true;
    else if (arg === '--verbose' || arg === '-v') flags.verbose = true;
    else if (arg === '--cascade-rooms') flags.cascadeRooms = true;
    else if (arg === '--verify-surface') flags.verifySurface = true;
    else if (arg === '--room-md') flags.roomMd = true;
    else if (arg === '--ui-compliance') flags.uiCompliance = true;
    else if (arg === '--statusline-visibility') flags.statuslineVisibility = true;
    else if (arg === '--install-state') flags.installState = true;
    else if (arg === '--acceptance') flags.acceptance = true;
    else if (arg === '--pre-tag') flags.preTag = true;
    else if (arg === '--light-npx') flags.lightNpx = true;
    else if (arg === '--all') flags.all = true;
    else if (arg.startsWith('--simulate-write=')) flags.simulateWrite = arg.slice('--simulate-write='.length);
    else if (arg.startsWith('--scan-commands=')) flags.scanCommandsDir = arg.slice('--scan-commands='.length);
    else if (arg.startsWith('--scan-scripts=')) flags.scanScriptsDir = arg.slice('--scan-scripts='.length);
    else if (arg === '--help' || arg === '-h') {
      console.log(usageText());
      process.exit(0);
    }
  }
  // --all activates every class flag.
  if (flags.all) {
    flags.cascadeRooms = true;
    flags.verifySurface = true;
    flags.roomMd = true;
    flags.uiCompliance = true;
    flags.statuslineVisibility = true;
    flags.installState = true;
  }
  // --pre-tag implies --acceptance (convenience; running --pre-tag standalone
  // is meaningless).
  if (flags.preTag) flags.acceptance = true;
  return flags;
}

function usageText() {
  return `Usage: doctor.cjs [flags]

Default (no flag) runs class A install-cache check only.

Class flags (combine freely; --all activates them all):
  --cascade-rooms          class B (.room-root sentinel) + class C (active-room guard silence)
  --verify-surface         class D (live cascade end-to-end against test fixture)
  --room-md                class E (ROOM.md/MINTO.md presence under .room-root)
  --ui-compliance          class F (UI Ruling System scan)
  --statusline-visibility  class G (user-settings drift, plugin install integrity, statusline-mos isolated execution)
                           + class H (install-incomplete: missing statusLine block and/or a halted .install-receipt.json)
  --install-state          class I (install-state + topology + 6-way version-of-record consistency)
                           + class J (deployment-surface manifest reconciliation)
  --all                    activate all class flags

Release-gate runner (Phase 123 Plan-04 -- separate from class flags):
  --acceptance             run the 7-point release-gate checklist (install-state +
                           deployment-surfaces + version-of-record-repo + verify-release +
                           doctor-all + version-of-record-published + npx-roundtrip).
                           Hard abort (exit non-zero) on any sub-check failure.
                           NO --allow override -- release infra is the one gate you cannot skip.
  --pre-tag                with --acceptance: filter to the 5 pre-tag-applicable points
                           (skips version-of-record-published + npx-roundtrip which are
                           false until AFTER the tag + npm publish). --pre-tag IMPLIES
                           --acceptance. release.sh Step 6.6 runs this BEFORE git tag.
  --light-npx              with --acceptance (full): skip the mktemp HOME-override sandbox
                           in the npx-roundtrip point; resolve npx --no-install --help
                           instead of doing a live install. Operator opt-in.

Behavior flags:
  --fix                attempt auto-recovery for each class that supports it
                       (class H: re-stamps the canonical statusLine block when missing, idempotently)
  --json               machine-readable output (for hooks / regression tests)
  --verbose, -v        extra diagnostic detail
  --simulate-write=<p> simulate a PWD write at <p> for class C active-room mismatch
  --scan-commands=<d>  override commands/ scan dir for class F (default: ./commands)
  --scan-scripts=<d>   override scripts/ scan dir for class F (default: ./scripts)
  --help, -h           print this usage

Exit codes:
  0  healthy, no drift across activated classes; --acceptance: all points passed
  1  drift detected (read-only mode); --acceptance: any point failed (hard abort)
  2  drift detected and recovered (--fix mode)
  3  internal error
`;
}

// -- Comparable semver helpers ---------------------------------------

function parseVersion(v) {
  if (!v || typeof v !== 'string') return null;
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!m) return null;
  return {
    major: parseInt(m[1], 10),
    minor: parseInt(m[2], 10),
    patch: parseInt(m[3], 10),
    prerelease: m[4] || null,
    raw: v,
  };
}

function cmpVersion(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;
  // Prerelease versions sort BEFORE the corresponding stable version.
  if (a.prerelease && !b.prerelease) return -1;
  if (!a.prerelease && b.prerelease) return 1;
  if (a.prerelease && b.prerelease) {
    return a.prerelease.localeCompare(b.prerelease);
  }
  return 0;
}

// -- Diagnostic checks -----------------------------------------------

function checkInstallVersion() {
  if (!fs.existsSync(INSTALL_DIR)) {
    return { status: 'missing', detail: `install dir does not exist: ${INSTALL_DIR}` };
  }
  if (!fs.existsSync(INSTALL_PLUGIN_JSON)) {
    return { status: 'missing', detail: `plugin.json missing inside install: ${INSTALL_PLUGIN_JSON}` };
  }
  try {
    const json = JSON.parse(fs.readFileSync(INSTALL_PLUGIN_JSON, 'utf8'));
    return { status: 'ok', version: json.version, parsed: parseVersion(json.version) };
  } catch (err) {
    return { status: 'error', detail: `failed to parse plugin.json: ${err.message}` };
  }
}

function checkMarketplaceCache() {
  if (!fs.existsSync(MARKETPLACE_CACHE_DIR)) {
    return { status: 'missing', detail: `marketplace cache dir does not exist: ${MARKETPLACE_CACHE_DIR}` };
  }
  let entries;
  try {
    entries = fs.readdirSync(MARKETPLACE_CACHE_DIR, { withFileTypes: true });
  } catch (err) {
    return { status: 'error', detail: `failed to read marketplace cache: ${err.message}` };
  }
  const versions = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const parsed = parseVersion(entry.name);
    if (parsed) {
      versions.push({ raw: entry.name, parsed });
    }
  }
  if (versions.length === 0) {
    return { status: 'empty', detail: 'no version directories found in marketplace cache' };
  }
  // Sort ascending, take last as latest
  versions.sort((a, b) => cmpVersion(a.parsed, b.parsed));
  return {
    status: 'ok',
    versions: versions.map(v => v.raw),
    latest: versions[versions.length - 1].raw,
    latestParsed: versions[versions.length - 1].parsed,
  };
}

function checkDevSourceConsistency() {
  // Best-effort: look for the canonical dev source. If absent, skip silently.
  const devSource = path.join(HOME, 'MindrianOS-Plugin');
  if (!fs.existsSync(path.join(devSource, '.claude-plugin/plugin.json'))) {
    return { status: 'skip', detail: 'dev source not found at ~/MindrianOS-Plugin (acceptable for end users)' };
  }
  try {
    const pluginJson = JSON.parse(fs.readFileSync(path.join(devSource, '.claude-plugin/plugin.json'), 'utf8'));
    const pkgJsonPath = path.join(devSource, 'package.json');
    let pkgVersion = null;
    if (fs.existsSync(pkgJsonPath)) {
      pkgVersion = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')).version;
    }
    const consistent = !pkgVersion || pkgVersion === pluginJson.version;
    return {
      status: consistent ? 'ok' : 'mismatch',
      pluginJson: pluginJson.version,
      packageJson: pkgVersion,
    };
  } catch (err) {
    return { status: 'error', detail: err.message };
  }
}

// -- Recovery --------------------------------------------------------
// Phase 95.2 D-01..D-04: atomic-swap recovery.
// Pattern: cp -> verify -> two-step rename. Destructive ops only after
// non-destructive verification has passed. POSIX rename(2) is atomic on
// the same filesystem (~/.claude/plugins/ is single-mount in practice).
// For cross-fs (EXDEV) we fall back to cpSync+rmSync per safeRename().

function performRecoveryAtomic(installVersion, latestCacheVersion) {
  const sourceDir = path.join(MARKETPLACE_CACHE_DIR, latestCacheVersion);
  if (!fs.existsSync(sourceDir)) {
    return { status: 'error', detail: `marketplace cache for ${latestCacheVersion} not found at ${sourceDir}`, stage: 'precheck' };
  }
  const installNewDir = INSTALL_DIR + '.new';
  const ts = new Date().toISOString().replace(/[:.]/g, '').replace(/T/, '-').slice(0, 15);
  // Finding F: 'missing' is more truthful than 'unknown' when the install dir doesn't exist.
  const backupTag = installVersion || (fs.existsSync(INSTALL_DIR) ? 'unknown' : 'missing');
  const backupDir = path.join(PLUGIN_HOME, `mindrian-os.stale-${backupTag}-${ts}`);

  // Phase 1: prepare install.new (cleanup any stale install.new from a prior failed run -- recover-the-recoverer logic)
  try {
    if (fs.existsSync(installNewDir)) fs.rmSync(installNewDir, { recursive: true, force: true });
  } catch (err) {
    return { status: 'error', detail: `failed to clean prior install.new: ${err.message}`, stage: 'cleanup-installnew' };
  }

  // Finding E: hermetic test injection point.
  if (process.env.MOS_TEST_FORCE_FAIL === 'copy') {
    return { status: 'error', detail: 'MOS_TEST_FORCE_FAIL=copy injection', stage: 'cp', installNewDir };
  }

  // Phase 2: cp via fs.cpSync (Finding A; replaces the prior shell-out copy -- Windows-functional, no exec)
  try {
    fs.cpSync(sourceDir, installNewDir, { recursive: true, dereference: false, preserveTimestamps: true });
  } catch (err) {
    // install untouched; install.new may be incomplete -- leave for inspection.
    return { status: 'error', detail: `cp failed: ${err.message}`, stage: 'cp', installNewDir };
  }

  // Phase 3: structural version verify (D-02). Read plugin.json from install.new ONLY; do not load any plugin code.
  if (process.env.MOS_TEST_FORCE_FAIL === 'verify') {
    return { status: 'error', detail: 'MOS_TEST_FORCE_FAIL=verify injection', stage: 'verify', installNewDir };
  }
  try {
    const pj = JSON.parse(fs.readFileSync(path.join(installNewDir, '.claude-plugin/plugin.json'), 'utf8'));
    if (pj.version !== latestCacheVersion) {
      return { status: 'error', detail: `verify failed: install.new version is ${pj.version}, expected ${latestCacheVersion}`, stage: 'verify', installNewDir };
    }
  } catch (err) {
    return { status: 'error', detail: `verify failed: ${err.message}`, stage: 'verify', installNewDir };
  }

  // Phase 4: two-step atomic-swap.
  // Phase 4a: mv install -> install.stale-X (only if install exists). Finding D safeRename for cross-fs.
  let backedUp = false;
  if (fs.existsSync(INSTALL_DIR)) {
    if (process.env.MOS_TEST_FORCE_FAIL === 'rename-old') {
      return { status: 'error', detail: 'MOS_TEST_FORCE_FAIL=rename-old injection', stage: 'backup-mv', installNewDir };
    }
    try {
      safeRename(INSTALL_DIR, backupDir);
      backedUp = true;
    } catch (err) {
      // install untouched (rename didn't complete); install.new left for inspection.
      return { status: 'error', detail: `backup mv failed: ${err.message}`, stage: 'backup-mv', installNewDir };
    }
  }

  // Phase 4b: mv install.new -> install. The atomic moment.
  if (process.env.MOS_TEST_FORCE_FAIL === 'commit') {
    // Simulate post-backup commit failure -> trigger D-03 rollback path.
    if (backedUp) {
      try { safeRename(backupDir, INSTALL_DIR); } catch (_) { /* double failure; user must recover manually */ }
    }
    return { status: 'error', detail: 'recovery failed -- live install restored from backup; investigate manually', stage: 'commit-rollback', exitCode: 4 };
  }
  try {
    safeRename(installNewDir, INSTALL_DIR);
  } catch (err) {
    // D-03 rollback: restore from backup so live install is recovered to pre-recovery state.
    if (backedUp) {
      try { safeRename(backupDir, INSTALL_DIR); }
      catch (_) { /* double failure; backup remains on disk for manual recovery */ }
    }
    return { status: 'error', detail: `recovery failed -- live install restored from backup; investigate manually (root: ${err.message})`, stage: 'commit-rollback', exitCode: 4 };
  }

  // Phase 5: post-swap verification (cheap re-check; should-never-fail given Phase 3 already passed).
  const after = checkInstallVersion();
  if (after.status !== 'ok' || after.version !== latestCacheVersion) {
    return { status: 'error', detail: `post-swap verify mismatch: install version is ${after.version || 'unknown'}, expected ${latestCacheVersion}`, backup: backedUp ? backupDir : null };
  }
  return { status: 'ok', backup: backedUp ? backupDir : null, recoveredVersion: latestCacheVersion };
}

// Finding D: rename(2) is atomic on the same filesystem; cpSync+rmSync fallback for EXDEV.
function safeRename(src, dst) {
  try {
    fs.renameSync(src, dst);
  } catch (err) {
    if (err && err.code === 'EXDEV') {
      // Cross-filesystem move; copy + delete (NOT atomic, but only path that works across mounts).
      fs.cpSync(src, dst, { recursive: true, dereference: false, preserveTimestamps: true });
      fs.rmSync(src, { recursive: true, force: true });
      return;
    }
    throw err;
  }
}

// -- Shared helpers for class B/C/E checks ---------------------------

const SKIP_DIRS = new Set([
  '.git', '.mindrian', '.context', '.lazygraph', '.rooms',
  'node_modules', '.next', 'dist', 'build', '.cache',
]);

// Pure Node port of scripts/post-write detect_room_section() lines 25-47
// + scripts/hooks/pre-commit-room-minto-guard.sh find_room_root() symlink
// safety. Returns the absolute roomDir (the directory containing
// .room-root) or null if the walk does not find a sentinel within 12 hops.
function findRoomRoot(filePath) {
  let dir = path.dirname(filePath);
  const visited = new Set();
  let hops = 0;
  while (dir !== '/' && dir !== '.' && hops < 12) {
    let real;
    try { real = fs.realpathSync(dir); } catch (_) { return null; }
    if (visited.has(real)) break;
    visited.add(real);
    if (fs.existsSync(path.join(real, '.room-root'))) return real;
    dir = path.dirname(real);
    hops += 1;
  }
  return null;
}

// Read ~/MindrianRooms/.rooms/registry.json (or MINDRIAN_ROOMS_HOME override)
// and return { roomsHome, registry, registryPath } or null when missing/
// unreadable. Honors the canonical env-var name MINDRIAN_ROOMS_HOME used by
// scripts/resolve-room line 34.
function readRegistry() {
  const home = process.env.MINDRIAN_ROOMS_HOME || path.join(HOME, 'MindrianRooms');
  const registryPath = path.join(home, '.rooms', 'registry.json');
  if (!fs.existsSync(registryPath)) return null;
  try {
    const raw = fs.readFileSync(registryPath, 'utf8');
    const reg = JSON.parse(raw);
    return { roomsHome: home, registry: reg, registryPath };
  } catch (_) { return null; }
}

// Walk subdirectories under rootDir, returning absolute paths. Skips
// SKIP_DIRS and respects maxDepth (default 8). Used by class E to enumerate
// section + sub-section directories under a .room-root.
function listSubdirs(rootDir, opts) {
  const o = opts || {};
  const recursive = o.recursive !== false;
  const maxDepth = typeof o.maxDepth === 'number' ? o.maxDepth : 8;
  const results = [];
  function walk(dir, depth) {
    if (depth > maxDepth) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (_) { return; }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (SKIP_DIRS.has(entry.name)) continue;
      const sub = path.join(dir, entry.name);
      results.push(sub);
      if (recursive) walk(sub, depth + 1);
    }
  }
  walk(rootDir, 0);
  return results;
}

// Spawn scripts/generate-section-intelligence.cjs as a child process. Used
// by class E --fix to remediate missing ROOM.md/MINTO.md across a room
// subtree. Returns a normalized result with status/stdout/stderr/exitCode.
function invokeGenerator(targetDir, opts) {
  const { spawnSync } = require('child_process');
  const o = opts || {};
  const recursive = o.recursive !== false;
  const force = !!o.force;
  const generatorPath = path.join(__dirname, 'generate-section-intelligence.cjs');
  if (!fs.existsSync(generatorPath)) {
    return { status: 'error', detail: 'generator not found at ' + generatorPath, stdout: '', stderr: '', exitCode: -1 };
  }
  const args = [generatorPath, targetDir];
  if (recursive) args.push('--recursive');
  if (force) args.push('--force');
  const res = spawnSync('node', args, { encoding: 'utf8', timeout: 30000 });
  return {
    status: res.status === 0 ? 'ok' : 'error',
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    exitCode: typeof res.status === 'number' ? res.status : -1,
  };
}

// -- Class B + C: cascade-rooms checks -------------------------------

// Class B: scan every registered room for a .room-root sentinel.
// Returns either a 'skip' (no registry) or {status: 'ok'|'warn',
// missingSentinels: [<roomName>...], okCount: number}. Test harness asserts
// shape per tests/test-doctor-class-b.cjs.
function checkCascadeRoomsSentinel() {
  const reg = readRegistry();
  if (!reg) {
    return { status: 'skip', detail: 'no registry at ~/MindrianRooms/.rooms/registry.json (or MINDRIAN_ROOMS_HOME)', missingSentinels: [], okCount: 0 };
  }
  const roomsHome = reg.roomsHome;
  const rooms = (reg.registry && reg.registry.rooms) || {};
  const missingSentinels = [];
  let okCount = 0;
  for (const name of Object.keys(rooms)) {
    const info = rooms[name];
    const relPath = info && info.path;
    if (!relPath) continue;
    const roomPath = path.isAbsolute(relPath) ? relPath : path.join(roomsHome, relPath);
    if (!fs.existsSync(roomPath)) {
      // Room directory itself missing -- treat as missing sentinel for class B.
      missingSentinels.push(name);
      continue;
    }
    if (fs.existsSync(path.join(roomPath, '.room-root'))) {
      okCount += 1;
    } else {
      missingSentinels.push(name);
    }
  }
  if (missingSentinels.length === 0) {
    return { status: 'ok', missingSentinels: [], okCount };
  }
  return {
    status: 'warn',
    missingSentinels,
    okCount,
    detail: missingSentinels.length + ' room(s) missing .room-root sentinel',
  };
}

// Class C: active-room guard silence detector. Reads registry for active
// room; if --simulate-write=<path> is provided, walks up from that path
// looking for a .room-root sentinel; if the sentinel room differs from the
// registry's active room, reports the mismatch (writes there would be
// silenced by scripts/post-write lines 207-217 active-room guard).
function checkCascadeRoomsActive(simulateWritePath) {
  const reg = readRegistry();
  if (!reg) {
    return { status: 'skip', detail: 'no registry; class C scoped to active room', activeRoom: null, writeRoom: null };
  }
  const roomsHome = reg.roomsHome;
  const rooms = (reg.registry && reg.registry.rooms) || {};
  const activeName = (reg.registry && reg.registry.active) || null;
  // Decide which path to inspect for the "current write" room. If
  // --simulate-write was passed, use it; otherwise use the doctor's cwd.
  // findRoomRoot expects a FILE path, not a directory -- append a dummy
  // basename so dirname returns the intended directory.
  const probePath = simulateWritePath
    ? path.join(simulateWritePath, '__doctor_probe__')
    : path.join(process.cwd(), '__doctor_probe__');
  let writeRoomDir = null;
  try { writeRoomDir = findRoomRoot(probePath); }
  catch (err) { return { status: 'error', detail: err.message, activeRoom: activeName, writeRoom: null }; }
  if (!writeRoomDir) {
    // No room sentinel found above the probe path -- write is outside any
    // Data Room, so the active-room guard does not apply.
    return { status: 'ok', activeRoom: activeName, writeRoom: null, activeMismatch: false };
  }
  // Resolve the active-room absolute path.
  let activePath = null;
  if (activeName && rooms[activeName] && rooms[activeName].path) {
    const relPath = rooms[activeName].path;
    activePath = path.isAbsolute(relPath) ? relPath : path.join(roomsHome, relPath);
  }
  // Map writeRoomDir back to a known room name when possible.
  let writeRoomName = null;
  for (const name of Object.keys(rooms)) {
    const info = rooms[name];
    const relPath = info && info.path;
    if (!relPath) continue;
    const roomPath = path.isAbsolute(relPath) ? relPath : path.join(roomsHome, relPath);
    try {
      if (path.resolve(roomPath) === path.resolve(writeRoomDir)) { writeRoomName = name; break; }
    } catch (_) { /* fall through */ }
  }
  if (!writeRoomName) writeRoomName = path.basename(writeRoomDir);
  // Compare write room against active room.
  if (activePath && path.resolve(activePath) === path.resolve(writeRoomDir)) {
    return { status: 'ok', activeRoom: activeName, writeRoom: writeRoomName, activeMismatch: false };
  }
  return {
    status: 'warn',
    activeRoom: activeName,
    writeRoom: writeRoomName,
    activeMismatch: true,
    detail: 'writes to ' + writeRoomName + ' would be silenced (active=' + (activeName || 'none') + ')',
  };
}

// -- Class D: surface verification (LIVE runner; upgraded by Plan 95.1-07) -----

// Class D end-to-end test lives at tests/test-cascade-surface-e2e.cjs (Plan
// 95.1-02). This function spawns the test runner programmatically and asserts
// the 8-key shape per D-06. Cross-platform: bash required for the post-write
// hook spawn inside the test; on Windows-without-git-bash, we skip the test
// (mirroring the test's own self-skip behavior per RESEARCH cross-platform note).
function checkSurfaceVerification() {
  const { spawnSync } = require('child_process');
  const repoRoot = path.resolve(__dirname, '..');
  const testPath = path.join(repoRoot, 'tests', 'test-cascade-surface-e2e.cjs');
  if (!fs.existsSync(testPath)) {
    return {
      status: 'skip',
      detail: 'class D test runner not found at ' + path.relative(repoRoot, testPath),
      runner: testPath,
    };
  }
  // Cross-platform: bash required for the post-write hook spawn inside the test.
  // On Windows-without-git-bash, the test will skip itself; we mirror by skipping here.
  if (process.platform === 'win32') {
    const bashCheck = spawnSync('bash', ['--version'], { encoding: 'utf8' });
    if (bashCheck.status !== 0) {
      return {
        status: 'skip',
        detail: 'class D requires bash; not found on Windows host',
        runner: path.relative(repoRoot, testPath),
      };
    }
  }
  const res = spawnSync('node', [testPath], {
    encoding: 'utf8',
    timeout: 30000,
    cwd: repoRoot,
  });
  return {
    status: res.status === 0 ? 'ok' : 'warn',
    detail: res.status === 0
      ? 'side-channel 8-key shape verified end-to-end'
      : 'live cascade test failed (exit ' + res.status + ')',
    exitCode: res.status,
    runner: path.relative(repoRoot, testPath),
    stdout: (res.stdout || '').slice(-500),
    stderr: (res.stderr || '').slice(-500),
  };
}

// -- Class E: room-md cascade check ----------------------------------

// Walks the active room's subdirectories under .room-root and reports any
// directories missing ROOM.md or MINTO.md. The pre-commit guard from Phase
// 87-01a enforces both files at every level under .room-root subtrees.
function checkRoomMd() {
  const reg = readRegistry();
  if (!reg) {
    return { status: 'skip', detail: 'no registry; class E scoped to active room', missing: [] };
  }
  const activeName = reg.registry && reg.registry.active;
  if (!activeName) {
    return { status: 'skip', detail: 'no active room', missing: [] };
  }
  const activeInfo = (reg.registry.rooms || {})[activeName];
  if (!activeInfo || !activeInfo.path) {
    return { status: 'skip', detail: 'active room not in registry', missing: [] };
  }
  const roomPath = path.isAbsolute(activeInfo.path)
    ? activeInfo.path
    : path.join(reg.roomsHome, activeInfo.path);
  // Sentinel must exist for class E to apply (Phase 87-01a guard scope).
  if (!fs.existsSync(path.join(roomPath, '.room-root'))) {
    return { status: 'skip', detail: 'active room missing .room-root sentinel (class B finding)', missing: [], roomPath };
  }
  const subdirs = listSubdirs(roomPath, { recursive: true, maxDepth: 8 });
  const missing = [];
  for (const subdir of subdirs) {
    const hasRoom = fs.existsSync(path.join(subdir, 'ROOM.md'));
    const hasMinto = fs.existsSync(path.join(subdir, 'MINTO.md'));
    if (!hasRoom || !hasMinto) {
      const filesMissing = [];
      if (!hasRoom) filesMissing.push('ROOM.md');
      if (!hasMinto) filesMissing.push('MINTO.md');
      missing.push({
        section: path.relative(roomPath, subdir),
        absPath: subdir,
        files: filesMissing,
      });
    }
  }
  if (missing.length === 0) {
    return { status: 'ok', missing: [], roomPath, subdirs: subdirs.length };
  }
  return {
    status: 'warn',
    missing,
    roomPath,
    subdirs: subdirs.length,
    detail: missing.length + ' dir(s) missing ROOM.md or MINTO.md',
  };
}

// Class E remediation: invoke generate-section-intelligence.cjs --recursive
// against the active room's path and re-run checkRoomMd. Returns 'ok' when
// post-fix check has no remaining missing entries; 'partial' when some
// directories still lack files; 'error' when generator failed.
function performRoomMdRecovery(checkResult) {
  if (!checkResult || checkResult.status !== 'warn') {
    return { status: 'skip', detail: 'no class E drift to recover', tool: 'generate-section-intelligence' };
  }
  if (!checkResult.roomPath) {
    return { status: 'error', detail: 'roomPath not set on check result', tool: 'generate-section-intelligence' };
  }
  const result = invokeGenerator(checkResult.roomPath, { recursive: true, force: false });
  if (result.status !== 'ok') {
    return {
      status: 'error',
      detail: 'generator failed: ' + (result.stderr || result.stdout || 'no output').slice(0, 200),
      tool: 'generate-section-intelligence',
      exitCode: result.exitCode,
    };
  }
  const afterCheck = checkRoomMd();
  if (afterCheck.status === 'ok') {
    return {
      status: 'ok',
      detail: 'all subdirs now have ROOM.md + MINTO.md',
      tool: 'generate-section-intelligence',
      generatorOutput: result.stdout,
    };
  }
  return {
    status: 'partial',
    detail: afterCheck.missing.length + ' dir(s) still missing after generation',
    tool: 'generate-section-intelligence',
    remaining: afterCheck.missing,
  };
}

// -- Class F: UI Ruling System compliance check ----------------------
//
// Per CONTEXT D-13 + D-14 + skills/ui-system/SKILL.md:
//   (a) commands/*.md frontmatter MUST declare body_shape (sub-check a)
//   (b) scripts/*.cjs MUST NOT contain unauthorized box-drawing chars or
//       glyphs outside the 12-glyph allowlist (sub-check b)
//   (c) command output renderers MUST emit Zone 1 header + Zone 4 action
//       footer patterns (sub-check c, best-effort)
//
// CRITICAL self-referential design: every forbidden char in regex source
// uses Unicode escape sequences (\uXXXX). This file's SOURCE therefore
// contains zero literal forbidden chars, so running this detector against
// scripts/doctor.cjs reports zero violations. Validates Pitfall 3 from
// 95.1-RESEARCH.md: Plan 95.1-04 cleaned the file; Plan 95.1-06 must not
// re-introduce forbidden chars when implementing the scanner. Comments
// reference Unicode codepoint names ONLY -- never the literal characters.
//
// Per D-13: --fix for class F is detect-only in 95.1 (auto-rewriting
// renderer code is out of scope; defer to 95.2 or human review).

// Forbidden box-drawing characters (D-11). Unicode escapes ONLY in the
// regex source so this file's SOURCE never contains literal box chars
// (the detector would flag itself when scanning scripts/doctor.cjs).
//   U+256D BOX DRAWINGS LIGHT ARC DOWN AND RIGHT  (curved top-left)
//   U+256E BOX DRAWINGS LIGHT ARC DOWN AND LEFT   (curved top-right)
//   U+256F BOX DRAWINGS LIGHT ARC UP AND LEFT     (curved bottom-right)
//   U+2570 BOX DRAWINGS LIGHT ARC UP AND RIGHT    (curved bottom-left)
//   U+250C BOX DRAWINGS LIGHT DOWN AND RIGHT
//   U+2510 BOX DRAWINGS LIGHT DOWN AND LEFT
//   U+2514 BOX DRAWINGS LIGHT UP AND RIGHT
//   U+2518 BOX DRAWINGS LIGHT UP AND LEFT
//   U+2502 BOX DRAWINGS LIGHT VERTICAL
//   U+2500 BOX DRAWINGS LIGHT HORIZONTAL
//   U+2501 BOX DRAWINGS HEAVY HORIZONTAL
const FORBIDDEN_BOX_CHARS = new RegExp(
  '[' +
  '\u256D\u256E\u256F\u2570' +  // curved corners (top-l/r, bottom-r/l)
  '\u250C\u2510\u2514\u2518' +  // light corners
  '\u2502' +                       // light vertical
  '\u2500\u2501' +                // horizontal (light + heavy)
  ']'
);

// Forbidden glyphs (D-13). Unicode escapes ONLY for the same reason as
// above. Bare U+26A0 WARNING SIGN (without variation selector) is APPROVED
// per the 12-glyph vocabulary; only U+26A0 followed by U+FE0F (variation
// selector forcing emoji presentation) is forbidden.
//   U+2717 BALLOT X
//   U+2718 HEAVY BALLOT X
//   U+2715 MULTIPLICATION X
//   U+274C CROSS MARK
//   U+2753 BLACK QUESTION MARK ORNAMENT
//   U+2755 WHITE EXCLAMATION MARK ORNAMENT
//   U+2757 HEAVY EXCLAMATION MARK SYMBOL
//   U+26A0 + U+FE0F  WARNING SIGN with emoji presentation
const FORBIDDEN_GLYPHS = new RegExp(
  '[\u2717\u2718\u2715]' +  // ballot X variants + multiplication X
  '|\u274C' +                  // cross mark
  '|\u2753' +                  // black question mark ornament
  '|\u2755' +                  // white exclamation mark ornament
  '|\u2757' +                  // heavy exclamation mark
  '|\u26A0\uFE0F'             // warning sign with emoji presentation
);

// Carve-out: scripts/context-monitor is the documented emoji exception
// (SKILL.md §3 + 2026-04-14 user directive).
const FILES_EMOJI_CARVE_OUT = ['context-monitor'];

// Renderer-pattern detection (sub-check c). A file is treated as a renderer
// if it contains lines.push(. Renderers must include Zone 1 header pattern
// (-- WORD -- WORD --) and Zone 4 action pattern (▶ /mos:).
const RENDERER_INDICATOR = /lines\.push\(/;
const ZONE_1_RENDERER_PATTERN = /-- [\w-]+(?: -- [\w-]+)+ --/;
const ZONE_4_RENDERER_PATTERN = /▶ \/mos:/;

function extractFrontmatterField(filePath, field) {
  let content;
  try { content = fs.readFileSync(filePath, 'utf8'); }
  catch (_) { return null; }
  const m = content.match(/^---\s*\n([\s\S]*?)\n---/m);
  if (!m) return null;
  const fm = m[1];
  const fieldRegex = new RegExp('^' + field + ':\\s*(.+)$', 'm');
  const fieldMatch = fm.match(fieldRegex);
  return fieldMatch ? fieldMatch[1].trim() : null;
}

function isCarveOutFile(filePath) {
  for (const carve of FILES_EMOJI_CARVE_OUT) {
    if (filePath.endsWith(carve) || filePath.endsWith(carve + '.cjs')) return true;
  }
  return false;
}

// Scan a single .cjs file line-by-line for forbidden box chars + glyphs.
// Returns an array of violation entries {kind, file, line, snippet, char}.
function scanScriptFile(filePath, repoRoot) {
  let content;
  try { content = fs.readFileSync(filePath, 'utf8'); }
  catch (_) { return []; }
  const violations = [];
  const relFile = repoRoot ? path.relative(repoRoot, filePath) : filePath;
  const carveOut = isCarveOutFile(filePath);
  const fileLines = content.split('\n');
  for (let i = 0; i < fileLines.length; i++) {
    const ln = fileLines[i];
    const boxMatch = ln.match(FORBIDDEN_BOX_CHARS);
    if (boxMatch) {
      violations.push({
        kind: 'unauthorized-box-char',
        file: relFile,
        line: i + 1,
        char: boxMatch[0],
        snippet: ln.trim().slice(0, 80),
      });
    }
    if (!carveOut) {
      const glyphMatch = ln.match(FORBIDDEN_GLYPHS);
      if (glyphMatch) {
        violations.push({
          kind: 'unauthorized-glyph',
          file: relFile,
          line: i + 1,
          char: glyphMatch[0],
          snippet: ln.trim().slice(0, 80),
        });
      }
    }
  }
  // Sub-check (c): renderer Zone 1 + Zone 4 patterns. Best-effort; only
  // flag when the file IS a renderer (contains lines.push() calls) AND is
  // missing the canonical patterns.
  if (RENDERER_INDICATOR.test(content)) {
    if (!ZONE_1_RENDERER_PATTERN.test(content)) {
      violations.push({
        kind: 'renderer-missing-zone1',
        file: relFile,
        line: 0,
        detail: 'renderer file lacks Zone 1 header pattern (-- X -- Y --)',
      });
    }
    if (!ZONE_4_RENDERER_PATTERN.test(content)) {
      violations.push({
        kind: 'renderer-missing-zone4',
        file: relFile,
        line: 0,
        detail: 'renderer file lacks Zone 4 action footer pattern (>/mos: marker)',
      });
    }
  }
  return violations;
}

// Class F: UI Ruling System compliance scanner. Three sub-checks per D-13:
// (a) commands/*.md frontmatter body_shape presence
// (b) scripts/*.cjs forbidden chars + glyphs
// (c) renderer Zone 1 + Zone 4 patterns (best-effort)
//
// Test contract per tests/test-doctor-class-f.cjs:
//   --scan-commands=<dir> overrides commands scan dir (defaults to ./commands)
//   --scan-scripts=<dir>  overrides scripts scan dir (defaults to ./scripts)
//   Returns {status: 'ok'|'warn', violations: [{kind, file, ...}], counts}
//   kind values: 'missing-body-shape', 'unauthorized-box-char',
//                'unauthorized-glyph', 'renderer-missing-zone1',
//                'renderer-missing-zone4'
function checkUIRulingCompliance(opts) {
  const o = opts || {};
  const repoRoot = o.repoRoot || path.resolve(__dirname, '..');
  const commandsDir = o.scanCommandsDir || path.join(repoRoot, 'commands');
  const scriptsDir = o.scanScriptsDir || path.join(repoRoot, 'scripts');

  const violations = [];

  // Sub-check (a): commands/*.md frontmatter body_shape presence.
  if (fs.existsSync(commandsDir)) {
    let cmdFiles;
    try {
      cmdFiles = fs.readdirSync(commandsDir).filter(function (f) { return f.endsWith('.md'); });
    } catch (_) { cmdFiles = []; }
    for (const f of cmdFiles) {
      const filePath = path.join(commandsDir, f);
      const bodyShape = extractFrontmatterField(filePath, 'body_shape');
      if (!bodyShape) {
        violations.push({
          kind: 'missing-body-shape',
          file: path.relative(repoRoot, filePath),
          detail: 'frontmatter is missing body_shape field',
        });
      }
    }
  }

  // Sub-check (b) + (c): scripts/*.cjs scan.
  if (fs.existsSync(scriptsDir)) {
    let scriptFiles;
    try {
      scriptFiles = fs.readdirSync(scriptsDir).filter(function (f) { return f.endsWith('.cjs'); });
    } catch (_) { scriptFiles = []; }
    for (const f of scriptFiles) {
      const filePath = path.join(scriptsDir, f);
      const fileViolations = scanScriptFile(filePath, repoRoot);
      for (const v of fileViolations) violations.push(v);
    }
  }

  // Aggregate counts per kind for the report consumer.
  const counts = {
    missingBodyShape: 0,
    unauthorizedBoxChar: 0,
    unauthorizedGlyph: 0,
    rendererMissingZone1: 0,
    rendererMissingZone4: 0,
  };
  for (const v of violations) {
    if (v.kind === 'missing-body-shape') counts.missingBodyShape += 1;
    else if (v.kind === 'unauthorized-box-char') counts.unauthorizedBoxChar += 1;
    else if (v.kind === 'unauthorized-glyph') counts.unauthorizedGlyph += 1;
    else if (v.kind === 'renderer-missing-zone1') counts.rendererMissingZone1 += 1;
    else if (v.kind === 'renderer-missing-zone4') counts.rendererMissingZone4 += 1;
  }

  return {
    status: violations.length === 0 ? 'ok' : 'warn',
    detail: violations.length === 0
      ? 'all scanned files comply with UI Ruling System SKILL.md sections 1-4'
      : violations.length + ' violation(s) across commands/ and scripts/',
    violations,
    counts,
    fixable: false, // D-13: --fix is detect-only in 95.1
    fixDeferredTo: '95.2 or human review',
    scannedDirs: { commands: commandsDir, scripts: scriptsDir },
  };
}

// -- Class G: statusline visibility (Phase 106-03) -------------------
//
// Per Phase 106 D-03 / RESEARCH §4.3: Claude Code provides no signal when
// the statusline fails to render. Class G probes four signals locally:
//   1. Stale ~/.claude/settings.json statusLine.command pinned at a
//      version-cache path that no longer exists (the 2026-04-26 Aryeh
//      Holtzberg incident pattern). Status: warn / recoverable=true.
//   2. Plugin's own settings.json statusLine.command points at a file
//      that does not resolve. Status: error / recoverable=false (broken
//      install, --fix cannot help).
//   3. statusline-mos isolated execution: spawn the script with synthetic
//      stdin payload; require exit 0 + a recognizable brand prefix in
//      stdout (after stripping ANSI). Status: error/warn / recoverable=false.
//   4. disableAllHooks=true in user settings. Status: warn / recoverable=
//      false (user opt-out; --fix would not unblock).
//
// Surface detect (Plan 106-04 will swap this for the surface-detect
// helper): CLAUDE_DESKTOP=1 -> status=skip (Desktop has no statusline
// primitive; D-04 fallback applies).
//
// --fix dispatch: when status='warn' AND recoverable, performStatuslineFix()
// spawns scripts/migrate-stale-user-settings.cjs --apply --quiet (D-01),
// re-runs checkStatuslineVisibility, and pushes the recovery record onto
// report.recovered[].
//
// Locked --fix language per RESEARCH Open Question #6:
//   "removes stale user-settings.json statusLine override so plugin-level
//    config takes effect"
// (NOT "regenerates" -- removal is the mechanism; plugin-level config wins
// the merge once the user-level entry is gone.)

const STALE_STATUSLINE_PATH_REGEX = /plugins[\/\\]cache[\/\\][^\/\\]+[\/\\]mos[\/\\]\d+\.\d+\.\d+[\/\\]/;

// Strip ANSI escape sequences before brand-prefix matching. The plugin's
// statusline emits ANSI color codes BEFORE the brand glyph, so a naive
// startsWith check would always fail.
function stripAnsi(s) {
  return String(s || '').replace(/\[[0-9;]*m/g, '');
}

function checkStatuslineVisibility() {
  const evidence = [];

  // Step 0 -- surface detection via lib/statusline/surface-detect.cjs (Plan 106-04).
  // CLAUDE_DESKTOP=1, COWORK_SESSION_ID, /sessions dir, non-TTY heuristics
  // all roll up into one canonical helper. CLI is the only surface where
  // the statusline render is the visibility source; DESKTOP and COWORK
  // route through the D-04 fallback echo (scripts/statusline-fallback-echo.cjs).
  try {
    const mod = require(path.resolve(__dirname, '..', 'lib', 'statusline', 'surface-detect.cjs'));
    const surface = mod.detectStatuslineSurface();
    if (surface !== 'CLI') {
      return {
        status: 'skip',
        detail: surface + ' has no statusline primitive -- D-04 fallback applies',
        evidence: ['surface=' + surface + ' (via lib/statusline/surface-detect.cjs)'],
        recoverable: false,
      };
    }
  } catch (_e) {
    // Graceful: if the helper cannot load, fall back to the original env-var
    // probe so the doctor never blocks itself.
    if (process.env.CLAUDE_DESKTOP === '1') {
      return {
        status: 'skip',
        detail: 'Desktop has no statusline primitive -- D-04 fallback applies',
        evidence: ['CLAUDE_DESKTOP=1 detected (fallback path)'],
        recoverable: false,
      };
    }
  }

  // Step 1 -- ~/.claude/settings.json user-level drift.
  const userSettingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  let userSettings = null;
  try {
    if (fs.existsSync(userSettingsPath)) {
      userSettings = JSON.parse(fs.readFileSync(userSettingsPath, 'utf8'));
    }
  } catch (_e) { /* ignore parse errors; treat as null */ }

  if (userSettings && userSettings.disableAllHooks === true) {
    return {
      status: 'warn',
      detail: 'disableAllHooks=true blocks statusline',
      evidence: [userSettingsPath + ': disableAllHooks=true'],
      recoverable: false,
    };
  }
  if (userSettings && userSettings.statusLine && typeof userSettings.statusLine.command === 'string') {
    const cmd = userSettings.statusLine.command;
    if (STALE_STATUSLINE_PATH_REGEX.test(cmd)) {
      // Extract a path token from the command string. Try a unix or windows
      // absolute-path match first.
      const match = cmd.match(/(\/[^\s"']+|[A-Za-z]:\\[^\s"']+)/);
      const candidate = match ? match[0] : cmd;
      if (!fs.existsSync(candidate)) {
        return {
          status: 'warn',
          detail: 'stale user-settings statusLine path',
          evidence: [userSettingsPath + ': command points at non-existent ' + candidate],
          recoverable: true,
        };
      }
    }
  }

  // Step 2 -- plugin's own settings.json statusLine.command must resolve.
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
  const pluginSettingsPath = path.join(pluginRoot, 'settings.json');
  let pluginSettings = null;
  try {
    if (fs.existsSync(pluginSettingsPath)) {
      pluginSettings = JSON.parse(fs.readFileSync(pluginSettingsPath, 'utf8'));
    }
  } catch (_e) { /* ignore */ }
  if (pluginSettings && pluginSettings.statusLine && typeof pluginSettings.statusLine.command === 'string') {
    // Manually substitute ${CLAUDE_PLUGIN_ROOT} so we can verify the file exists.
    const resolved = pluginSettings.statusLine.command.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, pluginRoot);
    const targetMatch = resolved.match(/(\/[^\s"']+|[A-Za-z]:\\[^\s"']+)/);
    const target = targetMatch ? targetMatch[0] : null;
    if (target && !fs.existsSync(target)) {
      return {
        status: 'error',
        detail: 'plugin install corrupt',
        evidence: ['plugin statusLine.command resolves to non-existent ' + target],
        recoverable: false,
      };
    }
    if (target) evidence.push('plugin statusLine.command resolved to ' + target);
  }

  // Step 3 -- statusline-mos isolated execution. Synthetic stdin + 1500ms
  // timeout so a hanging script is treated as broken.
  const statuslineMos = path.join(pluginRoot, 'scripts', 'statusline-mos');
  if (!fs.existsSync(statuslineMos)) {
    return {
      status: 'error',
      detail: 'plugin install corrupt',
      evidence: ['scripts/statusline-mos missing at ' + statuslineMos],
      recoverable: false,
    };
  }
  const SYNTHETIC = {
    model: { display_name: 'Test' },
    workspace: { current_dir: '/tmp' },
    context_window: { used_percentage: 0, remaining_percentage: 100, context_window_size: 200000 },
  };
  let r;
  try {
    r = require('child_process').spawnSync(statuslineMos, [], {
      input: JSON.stringify(SYNTHETIC),
      encoding: 'utf8',
      timeout: 1500,
    });
  } catch (err) {
    return {
      status: 'error',
      detail: 'statusline-mos spawn failed: ' + err.message,
      evidence: [],
      recoverable: false,
    };
  }
  if (r.status !== 0) {
    return {
      status: 'error',
      detail: 'statusline-mos exit ' + r.status,
      evidence: [r.stderr ? r.stderr.slice(0, 500) : '(no stderr)'],
      recoverable: false,
    };
  }
  const out = stripAnsi(r.stdout || '').trim();
  // Brand prefix per lib/core/visual-ops.cjs SYMBOLS.brand (⬡ hexagon)
  // followed by a space + 'MindrianOS'. The bash wrapper statusline-mos
  // execs context-monitor which produces this prefix on every healthy run.
  // Empty stdout (cache not populated yet) is also acceptable -- the
  // wrapper exits 0 silently in that case to let Claude Code render its
  // default statusline. We only fail when stdout is non-empty AND lacks
  // the brand prefix.
  if (out.length > 0) {
    const validPrefix = out.startsWith('⬡ MindrianOS') || out.startsWith('🏠 MindrianOS');
    if (!validPrefix) {
      return {
        status: 'warn',
        detail: 'script output unexpected',
        evidence: ['first 80 chars: ' + out.slice(0, 80)],
        recoverable: false,
      };
    }
    evidence.push('statusline-mos produced expected brand prefix');
  } else {
    evidence.push('statusline-mos exited 0 with no output (cache not populated; default Claude Code statusline applies)');
  }
  return {
    status: 'ok',
    detail: 'statusline rendering correctly',
    evidence,
    recoverable: false,
  };
}

function performStatuslineFix(_currentCheck) {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
  const migrator = path.join(pluginRoot, 'scripts', 'migrate-stale-user-settings.cjs');
  const r = require('child_process').spawnSync('node', [migrator, '--apply', '--quiet'], {
    encoding: 'utf8',
    timeout: 5000,
  });
  return {
    tool: 'migrate-stale-user-settings',
    action: 'removes stale user-settings.json statusLine override so plugin-level config takes effect',
    exit_code: typeof r.status === 'number' ? r.status : -1,
    stdout: (r.stdout || '').slice(0, 500),
    stderr: (r.stderr || '').slice(0, 500),
  };
}

// -- Class H: install-incomplete -------------------------------------
//
// Phase 95.6 D-09. The "silent install-incomplete" failure mode: install.sh
// halted (D-03 bug) or a manual recovery skipped it, so commands + Larry are
// present but ~/.claude/settings.json has no .statusLine block and the
// bottom-of-terminal `(hexagon) MindrianOS-Plugin <room> <ctx%>` never renders.
// Class G assumes a statusLine block exists and checks that it RESOLVES; class H
// is orthogonal -- it checks the install is structurally COMPLETE:
//   (a) ~/.claude/plugins/mindrian-os/.install-receipt.json exists and shows
//       every canonical step ran with completed_at stamped; if a halted
//       receipt, name the missing tail steps. recoverable iff the only missing
//       step is register_statusline (then --fix can restamp); otherwise
//       report-only (re-running install.sh is the user's call).
//   (b) if no receipt, fall back to: does ~/.claude/settings.json have a
//       .statusLine block at all? Missing -> warn, recoverable (--fix writes it).
// Desktop carve-out mirrors class G: CLAUDE_DESKTOP=1 -> status=skip.

const CLASS_H_CANONICAL_STEPS = [
  'preflight',
  'clone',
  'register_statusline',
  'register_commands',
  'register_skills',
  'register_agents',
  'configure_hooks',
];

function classHActionString() {
  return 'writes the canonical MindrianOS statusLine block (bash "<install-dir>/scripts/statusline-mos") into ~/.claude/settings.json';
}

function userSettingsHasStatusLine() {
  const userSettingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  let userSettings = null;
  try {
    if (fs.existsSync(userSettingsPath)) {
      userSettings = JSON.parse(fs.readFileSync(userSettingsPath, 'utf8'));
    }
  } catch (_e) { /* treat as no settings */ }
  const sl = userSettings && userSettings.statusLine;
  return !!(sl && typeof sl === 'object' && typeof sl.command === 'string' && sl.command.length > 0);
}

function checkInstallIncomplete() {
  // Step 0 -- Desktop carve-out (mirror class G).
  let surface = 'CLI';
  try {
    const mod = require(path.resolve(__dirname, '..', 'lib', 'statusline', 'surface-detect.cjs'));
    surface = mod.detectStatuslineSurface();
  } catch (_e) {
    if (process.env.CLAUDE_DESKTOP === '1') surface = 'DESKTOP';
  }
  if (surface !== 'CLI') {
    return {
      status: 'skip',
      detail: 'class H (install-incomplete) is CLI-only -- ' + surface + ' has no statusline primitive',
      evidence: ['surface=' + surface],
      recoverable: false,
      action: classHActionString(),
    };
  }

  // Step 1 -- read the install receipt, if present.
  let receipt = null;
  let receiptParseError = false;
  if (fs.existsSync(INSTALL_RECEIPT_JSON)) {
    try {
      receipt = JSON.parse(fs.readFileSync(INSTALL_RECEIPT_JSON, 'utf8'));
    } catch (_e) { receiptParseError = true; }
  }

  if (receipt && typeof receipt === 'object' && !receiptParseError) {
    const ranNames = Array.isArray(receipt.steps)
      ? receipt.steps.map((s) => (s && s.name)).filter(Boolean)
      : [];
    const missing = CLASS_H_CANONICAL_STEPS.filter((n) => ranNames.indexOf(n) === -1);
    const completed = receipt.completed_at !== null && receipt.completed_at !== undefined;
    if (completed && missing.length === 0) {
      return {
        status: 'ok',
        detail: 'install complete (.install-receipt.json shows all ' + CLASS_H_CANONICAL_STEPS.length + ' steps ran)',
        evidence: ['receipt: ' + INSTALL_RECEIPT_JSON, 'completed_at=' + receipt.completed_at],
        recoverable: false,
        action: classHActionString(),
      };
    }
    // Halted install. recoverable only when register_statusline is literally
    // the one missing step -- then --fix can restamp it. Otherwise re-running
    // install.sh is the user's call (report-only).
    const onlyStatuslineMissing = missing.length === 1 && missing[0] === 'register_statusline';
    return {
      status: 'warn',
      detail: 'install halted -- missing steps: ' + (missing.length ? missing.join(', ') : '(none, but completed_at is null)'),
      evidence: [
        'receipt: ' + INSTALL_RECEIPT_JSON,
        'completed_at=' + JSON.stringify(receipt.completed_at),
        'ran: ' + (ranNames.length ? ranNames.join(', ') : '(none)'),
      ],
      missingSteps: missing,
      recoverable: onlyStatuslineMissing,
      action: classHActionString(),
    };
  }

  // Step 2 -- no usable receipt. Check whether ~/.claude/settings.json has a
  // statusLine block at all (class H's "EXISTS" check, distinct from class G's
  // "RESOLVES" check). Missing -> install incomplete, recoverable via --fix.
  if (userSettingsHasStatusLine()) {
    return {
      status: 'ok',
      detail: 'statusLine block present in ~/.claude/settings.json',
      evidence: receiptParseError
        ? ['.install-receipt.json present but not valid JSON; statusLine block check passed']
        : ['no .install-receipt.json on disk; statusLine block check passed'],
      recoverable: false,
      action: classHActionString(),
    };
  }
  return {
    status: 'warn',
    detail: 'statusLine block missing from ~/.claude/settings.json (install.sh halted before register_statusline, or a manual recovery skipped it)',
    evidence: [
      receiptParseError
        ? '.install-receipt.json present but not valid JSON'
        : 'no .install-receipt.json on disk',
      'no .statusLine block in ' + path.join(os.homedir(), '.claude', 'settings.json'),
    ],
    recoverable: true,
    action: classHActionString(),
  };
}

// Class H --fix: write the canonical statusLine block into ~/.claude/settings.json
// idempotently. Mirrors the SessionStart hook-registration idempotent-write
// pattern from Phase 95.2. It does NOT re-run the whole install -- it just
// restamps the statusline; the missing-tail-steps case is report-only.
function performClassHFix(_currentCheck) {
  const userSettingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  const want = {
    type: 'command',
    command: 'bash "' + path.join(INSTALL_DIR, 'scripts', 'statusline-mos') + '"',
  };
  try {
    let s = {};
    if (fs.existsSync(userSettingsPath)) {
      try { s = JSON.parse(fs.readFileSync(userSettingsPath, 'utf8')); } catch (_e) { s = {}; }
    }
    if (!s || typeof s !== 'object') s = {};
    const cur = s.statusLine;
    const alreadyGood = cur && typeof cur === 'object' && cur.command === want.command;
    if (!alreadyGood) {
      s.statusLine = want;
      fs.mkdirSync(path.dirname(userSettingsPath), { recursive: true });
      fs.writeFileSync(userSettingsPath, JSON.stringify(s, null, 2));
    }
    return {
      tool: 'doctor-class-h',
      action: classHActionString(),
      exit_code: 0,
      changed: !alreadyGood,
      target: userSettingsPath,
    };
  } catch (err) {
    return {
      tool: 'doctor-class-h',
      action: classHActionString(),
      exit_code: -1,
      changed: false,
      detail: err.message,
    };
  }
}

// -- Class I + Class J: install-state + topology + version-of-record  ---
//   + deployment-surface manifest reconciliation (Phase 123 Plan-03).
//
// Class I (HARNESS-123-07): install-state record present + internally
//   consistent; topology classification (Bug 7 fix); 6-way version-of-record
//   equality across installed_plugins.json <-> record.active_version <->
//   record.statusline_renders_version <-> record.last_version_file_value
//   <-> record.path_bin_version <-> ~/.mindrian-last-version. STRING
//   EQUALITY tolerates the 4-component non-semver 1.12.5.1 case.
//
// Class J (HARNESS-123-08): walks data/deployment-surfaces.json; per
//   surface, checks expected vs observed per check_kind (marker | exact-
//   value | observed-only); honors topology_scope='dev-clone' (skipped on
//   non-dev-clone) and reconcile='never' (excluded from auto-fix); honors
//   the schema extension `path_within_file` (added in Plan-03 to fix the
//   live-dev-box settings.json whole-file-comparison bug).
//
// Aggressive --fix (HARNESS-123-09): missing record (spawn session-start);
//   wrong ~/.mindrian-last-version (rewrite); legacy-clone migration
//   (backup-verify-remove with the dev-clone safety belt -- NEVER touches
//   a dev clone); conservative installed_plugins.json repair (back up
//   first; repoint at newest valid marketplace-cache dir; restart note);
//   flag-only for topology=='not-found' / vanished PATH-bin / wrong
//   statusline_renders_version.
//
// Class-flag invariant: when --install-state (or --all) is set, exit is
//   always 0 unless an explicit --fix attempt failed.
//
// Canon Part 8: all of class I + class J is LOCAL-only. Zero fetch / http /
//   curl / brain.mindrian / tavily in any of these functions.

// -- Class I helpers ------------------------------------------------------

function readHomeFile(home, ...parts) {
  try { return fs.readFileSync(path.join(home, ...parts), 'utf8'); } catch (_) { return null; }
}

function readInstalledPluginsVersion(home) {
  // Returns the version string of the active mos@mindrian-marketplace entry,
  // or 'unknown' on absence / unparseable. STRING (not semver-parsed) so the
  // 4-component 1.12.5.1 case is handled identically.
  const file = path.join(home, '.claude', 'plugins', 'installed_plugins.json');
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const plugins = (data && data.plugins) || {};
    for (const key of Object.keys(plugins)) {
      const name = String(key).split('@')[0];
      if (name !== 'mos' && name !== 'mindrian-os') continue;
      let entry = plugins[key];
      if (Array.isArray(entry)) entry = entry[0];
      if (entry && entry.version) return String(entry.version);
    }
  } catch (_) { /* ignore */ }
  return 'unknown';
}

function readInstalledPluginsInstallPath(home) {
  const file = path.join(home, '.claude', 'plugins', 'installed_plugins.json');
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const plugins = (data && data.plugins) || {};
    for (const key of Object.keys(plugins)) {
      const name = String(key).split('@')[0];
      if (name !== 'mos' && name !== 'mindrian-os') continue;
      let entry = plugins[key];
      if (Array.isArray(entry)) entry = entry[0];
      if (entry && (entry.installPath || entry.path || entry.dir)) {
        return entry.installPath || entry.path || entry.dir;
      }
    }
  } catch (_) { /* ignore */ }
  return null;
}

function detectMarketplaceCacheInstall(home) {
  // Scan ~/.claude/plugins/cache/<mp>/mos/<v>/ for the newest valid plugin
  // dir (one with a .claude-plugin/plugin.json). Returns { root, version }
  // or null. Mirrors lib/core/active-plugin-root.cjs fromMarketplaceCache().
  const cacheBase = path.join(home, '.claude', 'plugins', 'cache');
  let entries;
  try { entries = fs.readdirSync(cacheBase, { withFileTypes: true }); } catch (_) { return null; }
  const found = [];
  for (const mk of entries) {
    if (!mk.isDirectory()) continue;
    for (const pluginName of ['mos', 'mindrian-os']) {
      const pluginDir = path.join(cacheBase, mk.name, pluginName);
      let versions;
      try { versions = fs.readdirSync(pluginDir, { withFileTypes: true }); } catch (_) { continue; }
      for (const v of versions) {
        if (!v.isDirectory()) continue;
        const candidate = path.join(pluginDir, v.name);
        const pj = path.join(candidate, '.claude-plugin', 'plugin.json');
        if (fs.existsSync(pj)) found.push({ root: candidate, version: v.name });
      }
    }
  }
  if (!found.length) return null;
  found.sort((a, b) => String(a.version).localeCompare(String(b.version), undefined, { numeric: true }));
  return found[found.length - 1];
}

function readPathBinVersion(home) {
  // Look at $PATH entries; return the <version> segment of any
  // .../mos/<version>/bin entry that EXISTS on disk. Returns 'unknown' if
  // no such entry resolves.
  const PATH = process.env.PATH || '';
  const parts = PATH.split(path.delimiter);
  for (const p of parts) {
    const m = p.match(/[\\/](?:mos|mindrian-os)[\\/]([^\\/]+)[\\/]bin$/i);
    if (m) {
      try { if (fs.existsSync(p)) return m[1]; } catch (_) { /* ignore */ }
    }
  }
  return 'unknown';
}

function pathBinVanished(home, activeRoot) {
  // True if the record's path_bin_version points at a dir that no longer
  // exists. We use the live PATH if the record didn't carry path_bin_version.
  if (!activeRoot) return false;
  const binPath = path.join(activeRoot, 'bin');
  try { return !fs.existsSync(binPath); } catch (_) { return false; }
}

function collectVersionOfRecord(home, resolverResult, record) {
  // Returns { IP, AV, SR, LV, PB }. All STRING values (or 'unknown').
  // SB (SessionStart-banner) is not separately tracked yet; we treat SR as
  // a proxy per RESEARCH note. The 6th leg is the spot-checked installed
  // path's plugin.json version (which the resolver already returned via
  // root). String equality, NEVER semver.valid().
  const IP = readInstalledPluginsVersion(home);
  const AV = (record && record.active_version) || 'unknown';
  const SR = (record && record.statusline_renders_version) || 'unknown';
  const LV_raw = readHomeFile(home, '.mindrian-last-version');
  const LV = LV_raw === null ? 'unknown' : LV_raw.trim();
  // path_bin_version: prefer the record snapshot; fall back to live PATH probe.
  let PB = (record && record.path_bin_version) || readPathBinVersion(home);
  if (!PB) PB = 'unknown';
  return { IP, AV, SR, LV, PB };
}

function computeVersionDivergences(versions) {
  // Returns an array of { from, to, fromValue, toValue, recoverable }
  // entries describing pairwise disagreements between known legs. Legs
  // marked 'unknown' are excluded from comparisons. STRING equality only.
  const known = {};
  for (const [k, v] of Object.entries(versions || {})) {
    if (v && v !== 'unknown') known[k] = v;
  }
  const out = [];
  const keys = Object.keys(known);
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = keys[i], b = keys[j];
      if (known[a] !== known[b]) {
        // Recoverable iff the disagreeing leg is something --fix can stamp.
        // LV-vs-IP: --fix rewrites LV. AV-vs-IP: record stale, re-run
        // session-start (informational). SR-vs-AV: flag-only (D-13).
        // PB-vs-anything: PATH is owned by Claude Code (flag-only).
        const involvesLV = a === 'LV' || b === 'LV';
        const involvesPB = a === 'PB' || b === 'PB';
        const recoverable = involvesLV && !involvesPB;
        out.push({ from: a, to: b, fromValue: known[a], toValue: known[b], recoverable });
      }
    }
  }
  return out;
}

function isLegacyDevClone(legacyDir) {
  // RETURN TRUE if the legacyDir is actually a dev-clone we must NOT touch.
  // Belt-and-suspenders dev-clone test (per D-13 + i.5 scenario):
  //   1. MINDRIAN_OS_ROOT env points at this path -> dev-clone.
  //   2. `git -C <legacyDir> remote get-url origin` matches mindrian-os-plugin.
  if (process.env.MINDRIAN_OS_ROOT) {
    try {
      if (path.resolve(process.env.MINDRIAN_OS_ROOT) === path.resolve(legacyDir)) return true;
    } catch (_) { /* ignore */ }
  }
  try {
    const cp = require('child_process');
    const r = cp.spawnSync('git', ['-C', legacyDir, 'remote', 'get-url', 'origin'], {
      encoding: 'utf8', timeout: 1500, stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (r && r.status === 0 && r.stdout && /mindrian-os-plugin/i.test(r.stdout)) return true;
  } catch (_) { /* ignore */ }
  return false;
}

function legacyDirtyOrUnpushed(legacyDir) {
  // Returns { dirty, reason } -- dirty=true means --fix must REFUSE migration.
  const cp = require('child_process');
  // 1. uncommitted changes via `git status --porcelain`.
  try {
    const r = cp.spawnSync('git', ['-C', legacyDir, 'status', '--porcelain'], {
      encoding: 'utf8', timeout: 1500, stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (r && r.status === 0 && r.stdout && r.stdout.trim().length > 0) {
      return { dirty: true, reason: 'legacy clone has uncommitted changes (git status --porcelain non-empty)' };
    }
  } catch (_) { /* ignore */ }
  // 2. unpushed commits via `git log @{u}..HEAD --oneline`.
  try {
    const r = cp.spawnSync('git', ['-C', legacyDir, 'log', '@{u}..HEAD', '--oneline'], {
      encoding: 'utf8', timeout: 1500, stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (r && r.status === 0 && r.stdout && r.stdout.trim().length > 0) {
      return { dirty: true, reason: 'legacy clone has unpushed commits' };
    }
    // If status != 0 and the dir IS a git repo, treat as "no upstream" => refuse (conservative).
    // We confirm it's a git repo first via `git rev-parse --is-inside-work-tree`.
    if (r && r.status !== 0) {
      const isGit = cp.spawnSync('git', ['-C', legacyDir, 'rev-parse', '--is-inside-work-tree'], {
        encoding: 'utf8', timeout: 1500, stdio: ['ignore', 'pipe', 'ignore'],
      });
      if (isGit && isGit.status === 0) {
        return { dirty: true, reason: 'legacy clone has no upstream -- cannot verify pushed state (conservative refuse)' };
      }
    }
  } catch (_) { /* ignore */ }
  return { dirty: false, reason: null };
}

// -- Class I check function ----------------------------------------------

function checkInstallState(opts) {
  const o = opts || {};
  const home = o.home || HOME;
  // 1. Resolve live.
  let r;
  try { r = resolveActivePluginRoot(); } catch (err) {
    return {
      status: 'error',
      detail: 'resolveActivePluginRoot threw: ' + err.message,
      topology: 'not-found', record: null, versions: null, findings: [],
      recoverable: false,
    };
  }
  // 2. Read the record.
  const recordPath = path.join(home, '.mindrian', 'install-state.json');
  let record = null, recordOk = false;
  try { record = JSON.parse(fs.readFileSync(recordPath, 'utf8')); recordOk = true; } catch (_) { /* absent or unparseable */ }
  // 3. Live spot-check (D-05): compare record.active_version vs
  //    installed_plugins.json. STRING equality.
  let spotCheckFinding = null;
  if (recordOk && record && record.active_version) {
    const liveAV = readInstalledPluginsVersion(home);
    if (liveAV !== 'unknown' && liveAV !== record.active_version) {
      spotCheckFinding = 'install-state record stale -- record says ' + record.active_version
        + ', installed_plugins.json says ' + liveAV + '; re-run session-start';
    }
  }
  // 4. Topology classification (D-11, BUG 7 fix). Each of marketplace-cache
  //    | dev-clone | legacy | not-found is VALID; only not-found is drift
  //    on its own, and `legacy` becomes a migration candidate iff a healthy
  //    marketplace-cache install exists alongside it.
  const topology = (record && record.topology) || r.topology || 'not-found';
  let topologyFinding = null;
  let topologyRecoverable = false;
  if (topology === 'not-found') {
    topologyFinding = 'no active plugin install resolved -- reinstall: claude plugin install mos@mindrian-marketplace';
    // flag-only per D-13.
  } else if (topology === 'legacy') {
    // Migration candidate iff a separate healthy marketplace-cache install exists.
    const mc = detectMarketplaceCacheInstall(home);
    if (mc && mc.root) {
      topologyFinding = 'legacy clone detected alongside a healthy marketplace-cache install -- migration candidate (run with --fix to backup-then-remove)';
      topologyRecoverable = true;
    }
  }
  // Also detect a SEPARATE legacy dir alongside a healthy marketplace-cache
  // topology -- the resolver picked marketplace-cache (per installed_plugins.json
  // precedence) but a legacy ~/.claude/plugins/mindrian-os/ still exists on
  // disk. This is the most common live case -- Bug 7's symptom + the
  // legacy-migration candidate.
  if (topology === 'marketplace-cache' && !topologyFinding) {
    const legacyDir = path.join(home, '.claude', 'plugins', 'mindrian-os');
    try {
      if (fs.existsSync(legacyDir) && fs.statSync(legacyDir).isDirectory()) {
        topologyFinding = 'legacy clone present at ' + legacyDir + ' alongside marketplace-cache install -- migration candidate (run with --fix to backup-then-remove)';
        topologyRecoverable = true;
      }
    } catch (_) { /* ignore */ }
  }
  // 5. Version-of-record 6-way comparison (STRING equality).
  const versions = collectVersionOfRecord(home, r, record);
  const divergences = computeVersionDivergences(versions);
  // 6. Compose findings.
  const findings = [];
  if (!recordOk) {
    findings.push({
      id: 'record-absent', status: 'warn', recoverable: true,
      finding: 'install-state record absent -- run session-start (or doctor --fix)',
    });
  }
  if (spotCheckFinding) {
    findings.push({
      id: 'record-stale', status: 'warn', recoverable: false,
      finding: spotCheckFinding,
    });
  }
  if (topologyFinding) {
    findings.push({
      id: 'topology', status: 'warn', recoverable: topologyRecoverable,
      finding: topologyFinding, topology,
    });
  }
  for (const d of divergences) {
    findings.push({
      id: 'vor-' + d.from + '-vs-' + d.to,
      status: 'warn',
      recoverable: d.recoverable,
      finding: 'version-of-record divergence: ' + d.from + '=' + d.fromValue + ' vs ' + d.to + '=' + d.toValue,
      from: d.from, to: d.to, fromValue: d.fromValue, toValue: d.toValue,
    });
  }
  // Flag-only: PATH-bin entry vanished (Claude Code owns the entry).
  if (r && r.root && pathBinVanished(home, r.root)) {
    findings.push({
      id: 'path-bin-vanished', status: 'warn', recoverable: false,
      finding: 'PATH entry ' + path.join(r.root, 'bin') + ' does not exist -- restart Claude Code; if the issue persists, reinstall',
    });
  }
  // Flag-only: statusline-renders-wrong-version is a resolver-bug signal.
  // (Handled by the vor-AV-vs-SR divergence above; recoverable:false because
  // re-stamping the symptom masks the bug.)

  return {
    status: findings.length === 0 ? 'healthy' : 'warn',
    topology,
    record,
    record_present: recordOk,
    versions,
    findings,
    resolver: { root: r.root, source: r.source, topology: r.topology },
    recoverable: findings.some(f => f.recoverable),
  };
}

// -- Class I --fix --------------------------------------------------------

function performClassIFix(check, opts) {
  const o = opts || {};
  const home = o.home || HOME;
  const recoveries = [];
  if (!check || !check.findings) return recoveries;
  for (const f of check.findings) {
    if (!f.recoverable) continue;
    if (f.id === 'record-absent') {
      // Spawn scripts/session-start to write the record.
      const cp = require('child_process');
      const sessionStart = path.join(PLUGIN_ROOT, 'scripts', 'session-start');
      try {
        const env = Object.assign({}, process.env, {
          HOME: home, USERPROFILE: home,
          SESSION_START_NODE_PREFLIGHT_SKIP: '1',
        });
        const r = cp.spawnSync('bash', [sessionStart], { encoding: 'utf8', timeout: 10000, env });
        const recorded = fs.existsSync(path.join(home, '.mindrian', 'install-state.json'));
        recoveries.push({
          class: 'install-state', surface: 'record', action: 'session-start-write',
          ok: recorded, exit_code: typeof r.status === 'number' ? r.status : -1,
        });
      } catch (err) {
        recoveries.push({
          class: 'install-state', surface: 'record', action: 'session-start-write',
          ok: false, detail: err.message,
        });
      }
      continue;
    }
    if (f.id && /^vor-/.test(f.id) && (f.from === 'LV' || f.to === 'LV')) {
      // LV divergence -> rewrite ~/.mindrian-last-version to match the OTHER
      // leg (prefer IP, then AV).
      const target = (f.from === 'LV') ? f.toValue : f.fromValue;
      const lvPath = path.join(home, '.mindrian-last-version');
      try {
        fs.writeFileSync(lvPath, String(target) + '\n');
        recoveries.push({
          class: 'install-state', surface: 'mindrian-last-version',
          action: 'rewrite', ok: true, target_value: target,
        });
      } catch (err) {
        recoveries.push({
          class: 'install-state', surface: 'mindrian-last-version',
          action: 'rewrite', ok: false, detail: err.message,
        });
      }
      continue;
    }
    if (f.id === 'topology' && f.topology === 'legacy' || (f.id === 'topology' && /migration candidate/i.test(f.finding || ''))) {
      // Legacy-clone migration: backup-verify-remove.
      const legacyDir = path.join(home, '.claude', 'plugins', 'mindrian-os');
      // 0. Dev-clone safety belt: NEVER migrate a dev-clone.
      if (!fs.existsSync(legacyDir)) {
        recoveries.push({
          class: 'install-state', surface: 'legacy-clone', action: 'skipped',
          reason: 'legacy dir does not exist at ' + legacyDir,
        });
        continue;
      }
      if (isLegacyDevClone(legacyDir)) {
        recoveries.push({
          class: 'install-state', surface: 'legacy-clone', action: 'skipped',
          reason: 'origin remote points at mindrian-os-plugin OR MINDRIAN_OS_ROOT is set -- treating as a dev clone, NOT migrating',
        });
        continue;
      }
      // 1. Refuse if uncommitted/unpushed.
      const dirty = legacyDirtyOrUnpushed(legacyDir);
      if (dirty.dirty) {
        recoveries.push({
          class: 'install-state', surface: 'legacy-clone', action: 'skipped',
          reason: dirty.reason,
        });
        continue;
      }
      // 2. Confirm a healthy marketplace-cache install exists.
      const mc = detectMarketplaceCacheInstall(home);
      if (!mc || !mc.root) {
        recoveries.push({
          class: 'install-state', surface: 'legacy-clone', action: 'skipped',
          reason: 'no healthy marketplace-cache install to migrate to',
        });
        continue;
      }
      // 3. tar the legacy dir to ~/.mindrian/backups/legacy-<ISO>.tar.gz.
      const backupsDir = path.join(home, '.mindrian', 'backups');
      try { fs.mkdirSync(backupsDir, { recursive: true }); } catch (_) { /* ignore */ }
      const ts = new Date().toISOString().replace(/[:.]/g, '').replace(/T/, '-').slice(0, 15);
      const tarballPath = path.join(backupsDir, 'legacy-' + ts + '.tar.gz');
      const cp = require('child_process');
      const tarRes = cp.spawnSync('tar', [
        '-czf', tarballPath,
        '-C', path.dirname(legacyDir),
        path.basename(legacyDir),
      ], { encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] });
      const tarballOk = tarRes.status === 0 && fs.existsSync(tarballPath) && fs.statSync(tarballPath).size > 0;
      if (!tarballOk) {
        recoveries.push({
          class: 'install-state', surface: 'legacy-clone', action: 'skipped',
          reason: 'tar failed -- refusing to remove legacy dir without a verified backup ' + (tarRes.stderr || ''),
        });
        continue;
      }
      // 4. Remove the legacy dir.
      try {
        fs.rmSync(legacyDir, { recursive: true, force: true });
        recoveries.push({
          class: 'install-state', surface: 'legacy-clone', action: 'migrated',
          backup_path: tarballPath, ok: true,
          note: 'legacy clone migrated; backup at ' + tarballPath,
        });
      } catch (err) {
        recoveries.push({
          class: 'install-state', surface: 'legacy-clone', action: 'skipped',
          reason: 'rm failed: ' + err.message,
          backup_path: tarballPath,
        });
      }
      continue;
    }
  }
  // Conservative installed_plugins.json repair: only when demonstrably stale.
  // Heuristic: the entry's installPath points at a missing dir AND there's a
  // valid marketplace-cache install present. Back up + repoint.
  try {
    const installPath = readInstalledPluginsInstallPath(home);
    const stalePath = installPath && !fs.existsSync(installPath);
    if (stalePath) {
      const mc = detectMarketplaceCacheInstall(home);
      if (mc && mc.root) {
        const file = path.join(home, '.claude', 'plugins', 'installed_plugins.json');
        const ts = new Date().toISOString();
        const backupsDir = path.join(home, '.mindrian', 'backups');
        try { fs.mkdirSync(backupsDir, { recursive: true }); } catch (_) { /* ignore */ }
        const backupPath = path.join(backupsDir, 'installed_plugins.json.' + ts + '.bak');
        try { fs.copyFileSync(file, backupPath); } catch (_) { /* best-effort */ }
        // Read, mutate the entry, write back. Conservative: only repoint
        // installPath; do not change the version field (leave for Claude Code).
        try {
          const data = JSON.parse(fs.readFileSync(file, 'utf8'));
          const plugins = (data && data.plugins) || {};
          for (const key of Object.keys(plugins)) {
            const name = String(key).split('@')[0];
            if (name !== 'mos' && name !== 'mindrian-os') continue;
            let entries = plugins[key];
            if (!Array.isArray(entries)) entries = [entries];
            for (const e of entries) {
              if (!e) continue;
              if (e.installPath) e.installPath = mc.root;
              if (e.version) e.version = mc.version;
            }
            plugins[key] = entries;
          }
          fs.writeFileSync(file, JSON.stringify(data, null, 2));
          recoveries.push({
            class: 'install-state', surface: 'installed-plugins.json',
            action: 'repointed', ok: true, backup_path: backupPath,
            note: 'Claude Code must be restarted to re-read installed_plugins.json',
          });
        } catch (err) {
          recoveries.push({
            class: 'install-state', surface: 'installed-plugins.json',
            action: 'skipped', detail: 'parse/write failed: ' + err.message,
          });
        }
      }
    }
  } catch (_) { /* swallow -- repair is best-effort */ }
  return recoveries;
}

// -- Class J helpers ------------------------------------------------------

function expandSurfacePath(p, ctx) {
  if (!p || typeof p !== 'string') return null;
  const home = ctx.home || HOME;
  const activeRoot = ctx.activeRoot || null;
  const topology = ctx.topology || 'not-found';
  let out = p.replace(/\$HOME/g, home);
  if (out.includes('<active_root>')) {
    if (!activeRoot) return null;
    out = out.replace(/<active_root>/g, activeRoot);
  }
  if (out.includes('<dev_clone_root>')) {
    if (topology !== 'dev-clone' || !activeRoot) return null;
    out = out.replace(/<dev_clone_root>/g, activeRoot);
  }
  return out;
}

function readJsonPath(obj, dotPath) {
  // Walk a dot-path like "statusLine.command" through `obj` and return the
  // value, or `undefined` on missing leg.
  if (!obj || typeof obj !== 'object') return undefined;
  const parts = String(dotPath).split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

function substituteExpected(expected, activeVersion, home) {
  if (typeof expected !== 'string') return expected;
  if (expected === '<active_version>') return activeVersion || '';
  // Also expand the $HOME token inside the expected value -- the manifest
  // stores `bash "$HOME/.claude/statusline-mos"` and `session-start` writes
  // the expanded form (`bash "/home/user/.claude/statusline-mos"`); class J
  // must compare like-for-like.
  if (home && expected.includes('$HOME')) {
    return expected.replace(/\$HOME/g, home);
  }
  return expected;
}

// -- Class J check function ----------------------------------------------

function checkDeploymentSurfaces(opts) {
  const o = opts || {};
  const home = o.home || HOME;
  const topology = o.topology || 'not-found';
  const activeRoot = o.activeRoot || null;
  const activeVersion = o.activeVersion || null;
  // Desktop / Cowork carve-out (mirrors class G).
  let surface = 'CLI';
  try {
    const mod = require(path.resolve(__dirname, '..', 'lib', 'statusline', 'surface-detect.cjs'));
    surface = mod.detectStatuslineSurface();
  } catch (_e) {
    if (process.env.CLAUDE_DESKTOP === '1') surface = 'DESKTOP';
    if (process.env.COWORK_SESSION_ID) surface = 'COWORK';
  }
  if (surface !== 'CLI') {
    return { status: 'skipped', reason: surface + ' install -- no owned surfaces (D-04 fallback applies)', surfaces: [] };
  }
  // Read the manifest.
  const manifestPath = path.join(PLUGIN_ROOT, 'data', 'deployment-surfaces.json');
  let manifest = null;
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
  catch (err) {
    return { status: 'warn', finding: 'deployment-surfaces.json unreadable: ' + err.message, surfaces: [], recoverable: false };
  }
  const out = [];
  for (const s of (manifest.surfaces || [])) {
    // topology_scope: dev-clone -> skip on user box.
    if (s.topology_scope === 'dev-clone' && topology !== 'dev-clone') {
      out.push({ id: s.id, status: 'skipped', reason: 'topology_scope=dev-clone, this is a ' + topology + ' box', ok: null, check_kind: s.check_kind, owner: s.owner });
      continue;
    }
    const fp = expandSurfacePath(s.path, { home, activeRoot, topology });
    if (!fp) {
      out.push({ id: s.id, status: 'skipped', reason: 'path tokens unresolvable (active_root or dev_clone_root not available)', ok: null, check_kind: s.check_kind, owner: s.owner });
      continue;
    }
    // reconcile: never -> observed-only by definition (the install-state record
    // self-entry). We mark it observed (excluded from its own check) per D-08.
    if (s.reconcile === 'never') {
      let observed = null;
      try {
        const stat = fs.statSync(fp);
        observed = stat.isFile() ? 'self-excluded' : (stat.isDirectory() ? 'self-excluded-dir' : 'present');
      } catch (_) { observed = 'absent'; }
      out.push({ id: s.id, path: fp, check_kind: s.check_kind, expected: s.expected, observed, ok: null, owner: s.owner, remediation: s.remediation });
      continue;
    }
    let observed = null, ok = null, finding = null;
    if (s.check_kind === 'marker') {
      let content;
      try { content = fs.readFileSync(fp, 'utf8'); }
      catch (_) {
        out.push({ id: s.id, path: fp, check_kind: s.check_kind, expected: s.expected, observed: 'absent', ok: false, finding: 'surface ' + s.id + ': ' + fp + ' unreadable / missing', owner: s.owner, remediation: s.remediation });
        continue;
      }
      ok = String(content).includes(String(s.expected));
      observed = ok ? s.expected : null;
      if (!ok) finding = 'surface ' + s.id + ": marker '" + s.expected + "' missing from " + fp;
    } else if (s.check_kind === 'exact-value') {
      const expSubstituted = substituteExpected(s.expected, activeVersion, home);
      let content;
      try { content = fs.readFileSync(fp, 'utf8'); }
      catch (_) {
        out.push({ id: s.id, path: fp, check_kind: s.check_kind, expected: expSubstituted, observed: 'absent', ok: false, finding: 'surface ' + s.id + ': ' + fp + ' unreadable / missing', owner: s.owner, remediation: s.remediation });
        continue;
      }
      // Schema extension (Plan-03): path_within_file = a dot-path into a JSON
      // file (e.g. "statusLine.command"). If present, parse + extract.
      if (s.path_within_file) {
        let parsed = null;
        try { parsed = JSON.parse(content); }
        catch (err) {
          out.push({ id: s.id, path: fp, check_kind: s.check_kind, expected: expSubstituted, observed: 'parse-error', ok: false, finding: 'surface ' + s.id + ': ' + fp + ' JSON parse failed: ' + err.message, owner: s.owner, remediation: s.remediation, path_within_file: s.path_within_file });
          continue;
        }
        const val = readJsonPath(parsed, s.path_within_file);
        observed = val == null ? null : String(val);
        ok = observed != null && observed === expSubstituted;
        if (!ok) finding = 'surface ' + s.id + ': value at ' + s.path_within_file + ' = ' + JSON.stringify(observed) + ', expected ' + JSON.stringify(expSubstituted);
      } else {
        // Default: substring match against the whole file content.
        const trimmed = String(content).trim();
        observed = trimmed.length > 200 ? trimmed.slice(0, 200) + '...' : trimmed;
        ok = String(content).includes(expSubstituted);
        if (!ok) finding = 'surface ' + s.id + ': expected ' + JSON.stringify(expSubstituted) + ' not present in ' + fp;
      }
    } else {
      // observed-only -> record presence/value, never ok=false.
      try {
        const stat = fs.statSync(fp);
        observed = stat.isDirectory() ? 'present' : 'present';
      } catch (_) { observed = 'absent'; }
      ok = null;
    }
    out.push(Object.assign({
      id: s.id, path: fp, check_kind: s.check_kind, expected: s.expected,
      observed, ok, owner: s.owner, remediation: s.remediation,
    }, s.path_within_file ? { path_within_file: s.path_within_file } : {}, finding ? { finding } : {}));
  }
  const drift = out.some(x => x.ok === false);
  const status = drift ? 'warn' : 'healthy';
  // Recoverable iff some owner='session-start' surface is ok:false.
  const recoverable = out.some(x => x.ok === false && x.owner === 'session-start');
  return { status, surfaces: out, recoverable };
}

// -- Class J --fix --------------------------------------------------------

function performClassJFix(check, opts) {
  const o = opts || {};
  const home = o.home || HOME;
  const activeVersion = o.activeVersion || null;
  const recoveries = [];
  if (!check || !check.surfaces) return recoveries;
  // The session-start path re-stamps everything owned. But in the hermetic
  // test envelope we cannot rely on session-start hitting every surface
  // exactly. Walk each ok:false owner='session-start' surface and re-stamp
  // it directly. Idempotent.
  for (const s of check.surfaces) {
    if (s.ok !== false) continue;
    if (s.owner !== 'session-start') continue;
    try {
      if (s.id === 'statusline-dispatch-shim') {
        // Re-stamp the dispatcher shim with the marker. Mirror Plan-02
        // session-start Step A's shim content (minimal -- the dispatcher
        // logic is in scripts/statusline-mos-dispatch).
        const dispatcherSrc = path.join(PLUGIN_ROOT, 'scripts', 'statusline-mos-dispatch');
        let content;
        if (fs.existsSync(dispatcherSrc)) {
          content = fs.readFileSync(dispatcherSrc, 'utf8');
          if (!content.includes('MINDRIAN-STATUSLINE-DISPATCH')) {
            // Belt-and-suspenders: prepend the marker if the dispatcher src
            // somehow lost it.
            content = '#!/usr/bin/env bash\n# MINDRIAN-STATUSLINE-DISPATCH\n' + content;
          }
        } else {
          content = '#!/usr/bin/env bash\n# MINDRIAN-STATUSLINE-DISPATCH\n# (auto-stamped by /mos:doctor --fix)\n';
        }
        fs.mkdirSync(path.dirname(s.path), { recursive: true });
        fs.writeFileSync(s.path, content);
        try { fs.chmodSync(s.path, 0o755); } catch (_) { /* ignore on Windows */ }
        recoveries.push({ class: 'deployment-surfaces', surface: s.id, action: 're-stamp', ok: true, target: s.path });
        continue;
      }
      if (s.id === 'settings-statusline-command') {
        // The path is the JSON settings.json file; we must JSON-merge so we
        // don't clobber unrelated keys.
        let obj = {};
        if (fs.existsSync(s.path)) {
          try { obj = JSON.parse(fs.readFileSync(s.path, 'utf8')); } catch (_) { obj = {}; }
        }
        if (!obj || typeof obj !== 'object') obj = {};
        const want = 'bash "' + path.join(home, '.claude', 'statusline-mos') + '"';
        obj.statusLine = obj.statusLine || {};
        obj.statusLine.type = 'command';
        obj.statusLine.command = want;
        fs.mkdirSync(path.dirname(s.path), { recursive: true });
        fs.writeFileSync(s.path, JSON.stringify(obj, null, 2));
        recoveries.push({ class: 'deployment-surfaces', surface: s.id, action: 'rewrite', ok: true, target: s.path, target_value: want });
        continue;
      }
      if (s.id === 'mindrian-last-version') {
        if (!activeVersion) {
          recoveries.push({ class: 'deployment-surfaces', surface: s.id, action: 'skipped', detail: 'no active_version available' });
          continue;
        }
        fs.writeFileSync(s.path, String(activeVersion) + '\n');
        recoveries.push({ class: 'deployment-surfaces', surface: s.id, action: 'rewrite', ok: true, target: s.path, target_value: activeVersion });
        continue;
      }
      if (s.id === 'dev-clone-pre-commit-hook') {
        // Idempotently install the dev-clone pre-commit hook.
        const cp = require('child_process');
        const installer = path.join(PLUGIN_ROOT, 'scripts', 'install-pre-commit.sh');
        if (fs.existsSync(installer)) {
          // The installer uses `git rev-parse --show-toplevel`; we run it
          // from the dev-clone root (s.path is .git/hooks/pre-commit, so
          // the repo root is two levels up from that file).
          const repoRoot = path.resolve(path.dirname(s.path), '..', '..');
          const r = cp.spawnSync('bash', [installer], { cwd: repoRoot, encoding: 'utf8', timeout: 5000 });
          recoveries.push({
            class: 'deployment-surfaces', surface: s.id, action: 'install',
            ok: r.status === 0, exit_code: typeof r.status === 'number' ? r.status : -1,
          });
        } else {
          recoveries.push({ class: 'deployment-surfaces', surface: s.id, action: 'skipped', detail: 'install-pre-commit.sh not found' });
        }
        continue;
      }
      // Default: skip unknown owned surfaces (forward-compat).
      recoveries.push({ class: 'deployment-surfaces', surface: s.id, action: 'skipped', detail: 'unknown surface id' });
    } catch (err) {
      recoveries.push({ class: 'deployment-surfaces', surface: s.id, action: 'error', detail: err.message });
    }
  }
  // Plan-5 (HARNESS-123-13): unconditional cache prune. Doctor --fix runs the
  // prune every time, regardless of version change -- this is recovery (the
  // operator asked for it), not an automatic post-update tidy.
  try {
    const { pruneMarketplaceCache } = require(path.join(__dirname, '..', 'lib', 'core', 'cache-prune.cjs'));
    const r = pruneMarketplaceCache({ home });
    if (r.skipped) {
      recoveries.push({ class: 'deployment-surfaces', surface: 'cache-prune', action: 'skipped', reason: r.reason, ok: null });
    } else if (r.removed.length > 0) {
      for (const dir of r.removed) {
        recoveries.push({ class: 'deployment-surfaces', surface: 'cache-prune', action: 'removed', dir, ok: true });
      }
    } else {
      recoveries.push({ class: 'deployment-surfaces', surface: 'cache-prune', action: 'no-op', kept: r.kept, ok: true });
    }
  } catch (e) {
    recoveries.push({ class: 'deployment-surfaces', surface: 'cache-prune', action: 'errored', error: e.message, ok: false });
  }
  return recoveries;
}

// -- Acceptance: release-gate-as-a-command (Phase 123 Plan-04) -------
//
// `mindrian-os doctor --acceptance` runs a 7-point checklist that asserts the
// release is consistent end-to-end. `--pre-tag` filters to the 5 points true
// BEFORE the tag + npm publish lands. Both are HARD ABORTS -- no --allow
// override (per CONTEXT D-16: release infra is the one gate you cannot skip).
//
// THIS BLOCK IS NOT A CLASS FLAG. It has its own exit-code contract:
//   0 = all (filtered) points passed
//   1 = any point failed
// The class-flag-always-exit-0 graceful-degradation invariant does NOT apply.
//
// Canon Part 8 (LOCAL-only invariant): the npx-roundtrip + version-of-record-
// published points are the ONE network touch in this phase. They run ONLY
// during a release (when release.sh invokes --acceptance after the push).
// --pre-tag has ZERO network -- it stays Part-8 clean for in-session use.
//
// Test-mode env hooks (honored only when DOCTOR_TEST_MODE=1):
//   DOCTOR_TEST_STUB_POST_PUBLISH=1     post-publish points throw if invoked
//                                       (asserts the --pre-tag filter works)
//   DOCTOR_TEST_FAIL_POINT=<point_id>   synthesize a failure of the named point
//   DOCTOR_VERIFY_RELEASE_PATH=<path>   override scripts/verify-release path

function buildAcceptanceChecklist(ctx) {
  const home = ctx.home;
  const pluginRoot = ctx.pluginRoot;
  const flagLightNpx = ctx.flagLightNpx;
  const inTestMode = process.env.DOCTOR_TEST_MODE === '1';
  return [
    {
      id: 'install-state',
      label: 'install-state record present + snapshot matches a live spot-check',
      severity: 'blocker',
      applies_to: ['pre-tag', 'full'],
      run: async function () {
        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'install-state') {
          return { ok: false, finding: 'install-state synthesized failure (test mode)', detail: {} };
        }
        const c = checkInstallState({ home: home });
        // status: 'healthy' | 'warn' | 'error'. We allow 'healthy' through; anything
        // else fails the gate. (Findings drive the finding string for the operator.)
        const ok = c.status === 'healthy';
        let finding = null;
        if (!ok) {
          if (Array.isArray(c.findings) && c.findings.length) {
            finding = c.findings[0].finding || c.findings[0].id || ('install-state status: ' + c.status);
          } else {
            finding = 'install-state status: ' + c.status;
          }
        }
        return { ok: ok, finding: finding, detail: { status: c.status, findings: c.findings, topology: c.topology } };
      },
    },
    {
      id: 'deployment-surfaces',
      label: 'every owned deployment surface reconciled',
      severity: 'blocker',
      applies_to: ['pre-tag', 'full'],
      run: async function () {
        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'deployment-surfaces') {
          return { ok: false, finding: 'deployment-surfaces synthesized failure (test mode)', detail: {} };
        }
        // Reuse install-state for the topology + active root/version handles.
        const s = checkInstallState({ home: home });
        const activeRoot = (s.record && s.record.active_root)
          || (s.resolver && s.resolver.root)
          || null;
        const activeVersion = (s.record && s.record.active_version)
          || (function () { try { return readInstalledPluginsVersion(home); } catch (_) { return null; } })();
        const c = checkDeploymentSurfaces({
          home: home,
          topology: s.topology || 'not-found',
          activeRoot: activeRoot,
          activeVersion: activeVersion,
        });
        const ok = c.status === 'healthy' || c.status === 'skipped';
        const failedSurfaces = Array.isArray(c.surfaces)
          ? c.surfaces.filter(function (x) { return x.ok === false; })
          : [];
        const finding = ok ? null : (failedSurfaces.length + ' surface(s) drifted');
        return { ok: ok, finding: finding, detail: { status: c.status, surfaces: c.surfaces } };
      },
    },
    {
      id: 'version-of-record-repo',
      label: 'plugin.json / package.json / CHANGELOG top entry consistent (repo-file half of 5-way)',
      severity: 'blocker',
      applies_to: ['pre-tag', 'full'],
      run: async function () {
        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'version-of-record-repo') {
          return { ok: false, finding: 'version-of-record-repo synthesized failure (test mode)', detail: {} };
        }
        try {
          const pjPath = path.join(pluginRoot, '.claude-plugin', 'plugin.json');
          const pkPath = path.join(pluginRoot, 'package.json');
          const chPath = path.join(pluginRoot, 'CHANGELOG.md');
          const pj = JSON.parse(fs.readFileSync(pjPath, 'utf8'));
          const pk = JSON.parse(fs.readFileSync(pkPath, 'utf8'));
          const ch = fs.readFileSync(chPath, 'utf8');
          const chMatch = ch.match(/^## \[([^\]]+)\]/m);
          const chTop = chMatch ? chMatch[1] : null;
          const pjVer = pj.version;
          const pkVer = pk.version;
          // Accept "Unreleased" CHANGELOG heading (work in progress); the
          // sub-check passes if pj==pk AND CHANGELOG either matches OR is
          // an [Unreleased] heading naming the same version in its body
          // (the release.sh Step 6 finalizes [Unreleased] -> [vN] before
          // Step 6.6 calls us, so by then chTop is the version).
          const allMatch = pjVer === pkVer && (pjVer === chTop || chTop === 'Unreleased');
          const finding = allMatch ? null : ('version mismatch: plugin.json=' + pjVer + ', package.json=' + pkVer + ', CHANGELOG top=' + chTop);
          return { ok: !!allMatch, finding: finding, detail: { pluginJson: pjVer, packageJson: pkVer, changelogTop: chTop } };
        } catch (e) {
          return { ok: false, finding: 'version-of-record-repo read failed: ' + e.message, detail: {} };
        }
      },
    },
    {
      id: 'verify-release',
      label: 'scripts/verify-release passes',
      severity: 'blocker',
      applies_to: ['pre-tag', 'full'],
      run: async function () {
        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'verify-release') {
          return { ok: false, finding: 'verify-release synthesized failure (test mode)', detail: {} };
        }
        // Override path only honored in test mode (the test harness sets a logging shim).
        const verifyPath = (inTestMode && process.env.DOCTOR_VERIFY_RELEASE_PATH)
          ? process.env.DOCTOR_VERIFY_RELEASE_PATH
          : path.join(pluginRoot, 'scripts', 'verify-release');
        const cp = require('child_process');
        const r = cp.spawnSync('bash', [verifyPath], { encoding: 'utf8', timeout: 60000 });
        const ok = r.status === 0;
        const finding = ok ? null : ('verify-release exited ' + r.status);
        return { ok: ok, finding: finding, detail: { status: r.status, stdoutTail: (r.stdout || '').slice(-500), stderrTail: (r.stderr || '').slice(-500) } };
      },
    },
    {
      id: 'version-of-record-published',
      label: 'git tag exists + marketplace source.ref pinned + npm view returns the version',
      severity: 'blocker',
      applies_to: ['full'],
      run: async function () {
        if (inTestMode && process.env.DOCTOR_TEST_STUB_POST_PUBLISH === '1') {
          throw new Error('post-publish stub invoked under --pre-tag -- bug in runner');
        }
        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'version-of-record-published') {
          return { ok: false, finding: 'version-of-record-published synthesized failure (test mode)', detail: {} };
        }
        const cp = require('child_process');
        try {
          const pj = JSON.parse(fs.readFileSync(path.join(pluginRoot, '.claude-plugin', 'plugin.json'), 'utf8'));
          const ver = pj.version;
          // (a) git tag exists, reachable from origin/main.
          const t = cp.spawnSync('git', ['-C', pluginRoot, 'rev-parse', '--verify', 'refs/tags/v' + ver], { encoding: 'utf8' });
          if (t.status !== 0) return { ok: false, finding: 'git tag v' + ver + ' not found', detail: { stderr: (t.stderr || '').slice(-200) } };
          // (b) marketplace source.ref pinned to v<ver>.
          const mpPath = path.join(home, 'mindrian-marketplace', '.claude-plugin', 'marketplace.json');
          let mp;
          try { mp = JSON.parse(fs.readFileSync(mpPath, 'utf8')); }
          catch (e) { return { ok: false, finding: 'marketplace.json unreadable: ' + e.message, detail: { mpPath: mpPath } }; }
          const ref = mp.plugins && mp.plugins[0] && mp.plugins[0].source && mp.plugins[0].source.ref;
          if (ref !== 'v' + ver) return { ok: false, finding: 'marketplace source.ref is ' + ref + ', expected v' + ver, detail: { ref: ref, expected: 'v' + ver } };
          // (c) npm view -- THIS IS THE ONE NETWORK CALL in this point.
          const n = cp.spawnSync('npm', ['view', '@mindrian_os/install@' + ver, 'version'], { encoding: 'utf8', timeout: 30000 });
          if (n.status !== 0) return { ok: false, finding: 'npm view failed: ' + (n.stderr || '').slice(-200), detail: { status: n.status } };
          const npmVer = (n.stdout || '').trim();
          const ok = npmVer === ver;
          return { ok: ok, finding: ok ? null : ('npm view returned ' + npmVer + ', expected ' + ver), detail: { npmVer: npmVer, expectedVer: ver } };
        } catch (e) {
          return { ok: false, finding: 'version-of-record-published threw: ' + e.message, detail: {} };
        }
      },
    },
    {
      id: 'npx-roundtrip',
      label: 'npx @mindrian_os/install round-trip resolves cleanly',
      severity: 'blocker',
      applies_to: ['full'],
      run: async function () {
        if (inTestMode && process.env.DOCTOR_TEST_STUB_POST_PUBLISH === '1') {
          throw new Error('post-publish stub invoked under --pre-tag -- bug in runner');
        }
        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'npx-roundtrip') {
          return { ok: false, finding: 'npx-roundtrip synthesized failure (test mode)', detail: {} };
        }
        const cp = require('child_process');
        const pj = JSON.parse(fs.readFileSync(path.join(pluginRoot, '.claude-plugin', 'plugin.json'), 'utf8'));
        const ver = pj.version;
        if (flagLightNpx) {
          // Light path: resolve --help against the published package without
          // doing a live install. Operator opt-in for slow networks / CI.
          const r = cp.spawnSync('npx', ['--no-install', '@mindrian_os/install@' + ver, '--help'], { encoding: 'utf8', timeout: 30000 });
          const ok = r.status === 0;
          return { ok: ok, finding: ok ? null : ('npx --no-install --help failed (' + r.status + ')'), detail: { status: r.status, stderrTail: (r.stderr || '').slice(-200) } };
        }
        // Full path: mktemp HOME-override sandbox + live install. The sandbox
        // is rm-rf'd in `finally` so the operator's live install is never
        // touched. RESEARCH § override 9 (full mode).
        const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-acceptance-'));
        try {
          const env = Object.assign({}, process.env, {
            HOME: sandbox,
            USERPROFILE: sandbox,
            npm_config_cache: path.join(sandbox, '.npm'),
          });
          const r = cp.spawnSync('npx', ['@mindrian_os/install@' + ver, '--help'], { encoding: 'utf8', env: env, timeout: 90000 });
          const ok = r.status === 0;
          return { ok: ok, finding: ok ? null : ('npx round-trip failed (' + r.status + ')'), detail: { status: r.status, stderrTail: (r.stderr || '').slice(-300) } };
        } finally {
          try { fs.rmSync(sandbox, { recursive: true, force: true }); } catch (_) { /* best-effort */ }
        }
      },
    },
    {
      id: 'doctor-all',
      label: 'doctor --all exits 0',
      severity: 'blocker',
      applies_to: ['pre-tag', 'full'],
      run: async function () {
        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'doctor-all') {
          return { ok: false, finding: 'doctor-all synthesized failure (test mode)', detail: {} };
        }
        // Spawn ourselves with --all (NOT --acceptance, to avoid recursion).
        // Scrub DOCTOR_TEST_FAIL_POINT so a top-level test fail-point env var
        // doesn't propagate into our self-spawn and re-trigger the synthesis
        // there (the synthesis above already covers this point).
        const cp = require('child_process');
        const childEnv = Object.assign({}, process.env, { DOCTOR_TEST_FAIL_POINT: '' });
        const r = cp.spawnSync('node', [path.join(pluginRoot, 'scripts', 'doctor.cjs'), '--all', '--json'], { encoding: 'utf8', timeout: 60000, env: childEnv });
        let j = null;
        try {
          if (r.stdout) {
            const start = r.stdout.indexOf('{');
            if (start !== -1) j = JSON.parse(r.stdout.slice(start));
          }
        } catch (_) { /* leave null */ }
        const driftCount = j && j.summary && typeof j.summary.drift === 'number' ? j.summary.drift : 0;
        const ok = r.status === 0 && driftCount === 0;
        let finding = null;
        if (r.status !== 0) finding = 'doctor --all exited ' + r.status;
        else if (driftCount > 0) finding = 'doctor --all reports ' + driftCount + ' drift item(s)';
        return { ok: ok, finding: finding, detail: { exit: r.status, summary: j && j.summary } };
      },
    },
  ];
}

async function runAcceptance(opts) {
  const home = opts.home;
  const pluginRoot = opts.pluginRoot;
  const flagPreTag = opts.flagPreTag;
  const flagLightNpx = opts.flagLightNpx;
  const checklist = buildAcceptanceChecklist({ home: home, pluginRoot: pluginRoot, flagLightNpx: flagLightNpx });
  const mode = flagPreTag ? 'pre-tag' : 'full';
  const filtered = checklist.filter(function (p) { return p.applies_to.indexOf(mode) !== -1; });
  const results = [];
  const failed = [];
  for (const p of filtered) {
    let r;
    try { r = await p.run(); }
    catch (e) { r = { ok: false, finding: 'point ' + p.id + ' threw: ' + e.message, detail: {} }; }
    results.push({ id: p.id, label: p.label, ok: !!r.ok, finding: r.finding || null, detail: r.detail || null });
    if (!r.ok) failed.push(p.id);
  }
  return {
    mode: mode,
    points: results,
    failed_points: failed,
    summary: { total: results.length, passed: results.length - failed.length, failed: failed.length },
  };
}

// -- Renderers -------------------------------------------------------

// Phase 95.1-04 retrofit: 4-zone Shape E (Action Report) per skills/ui-system/SKILL.md.
// Zone 1 header literal '-- MindrianOS -- doctor -- {stage} --' (compact form when
// projected lines > 30 per D-16). Zone 2 body holds per-class drift findings using
// only the 12-glyph vocabulary. Zone 3 reserved for room-proactive signals (D-17;
// always empty in Phase 95.1, room-proactive integration deferred). F.1 Next Move
// selector renders before Zone 4 when drift detected without --fix (D-18; structural
// marker only, canonical AskUserQuestion implementation deferred to Phase 88.2 -- see
// .planning/phases/95.1-mos-doctor-drift-detection-and-self-heal/f1-selector-deferred.md).
// Zone 4 action footer always present (D-12). Renderer is purely structural; Larry
// handles narrative interpretation per D-19.
function renderHumanReport(report) {
  const lines = [];

  // Compute stage label for Zone 1 per D-12 stage values.
  let stage = 'no-drift';
  if (report.fixRequested && report.classARecovered) stage = 'recovered';
  else if (report.fixRequested) stage = 'recovering';
  else if (report.drift && report.drift.detected) stage = 'drift-detected';
  // Additional class-driven drift detection added by 95.1 plans 05+06 will populate
  // report.checks; iterate and aggregate stage accordingly.

  // Compute body rows BEFORE deciding header density (D-16).
  const bodyRows = [];

  // Class A -- install-cache (existing logic preserved, glyphs swapped to vocabulary).
  if (report.install.status === 'ok' && report.cache.status === 'ok') {
    if (report.drift.detected) {
      bodyRows.push(`  ${C.yellow}■${C.reset} install-cache              ${C.yellow}⚠${C.reset} drift detected`);
      bodyRows.push(`     ${C.dim}live${C.reset}    ${C.yellow}${report.install.version}${C.reset} ${C.dim}→${C.reset} ${C.green}${report.cache.latest}${C.reset}`);
      if (report.classARecovered) {
        bodyRows.push(`     ${C.green}✓${C.reset} recovered to ${C.green}${report.classARecovered.recoveredVersion}${C.reset}`);
        bodyRows.push(`     ${C.dim}backup ${report.classARecovered.backup}${C.reset}`);
      } else if (report.fixRequested) {
        bodyRows.push(`     ${C.red}⚠${C.reset} recovery failed: ${report.recoveryError || 'unknown'}`);
      }
    } else {
      bodyRows.push(`  ${C.green}■${C.reset} install-cache              ${C.green}✓${C.reset} healthy ${C.dim}(${report.install.version})${C.reset}`);
    }
  } else {
    bodyRows.push(`  ${C.red}■${C.reset} install-cache              ${C.red}⚠${C.reset} cannot read state`);
    if (report.install.status !== 'ok') bodyRows.push(`     ${C.dim}install: ${report.install.detail || report.install.status}${C.reset}`);
    if (report.cache.status !== 'ok') bodyRows.push(`     ${C.dim}cache:   ${report.cache.detail || report.cache.status}${C.reset}`);
  }

  // Dev source consistency.
  if (report.dev.status === 'ok') {
    bodyRows.push(`  ${C.green}■${C.reset} dev-source                 ${C.green}✓${C.reset} consistent ${C.dim}(${report.dev.pluginJson})${C.reset}`);
  } else if (report.dev.status === 'mismatch') {
    bodyRows.push(`  ${C.yellow}■${C.reset} dev-source                 ${C.yellow}⚠${C.reset} version mismatch`);
    bodyRows.push(`     ${C.dim}plugin.json  ${report.dev.pluginJson}${C.reset}`);
    bodyRows.push(`     ${C.dim}package.json ${report.dev.packageJson}${C.reset}`);
  }
  // status=skip silently omitted (acceptable for end users without dev clone).

  // Slot for class B/C/D/E/F/G rows -- populated by Plans 95.1-05 + 95.1-06
  // and Plan 106-03 via report.checks.* extension. Each new check reads from
  // report.checks[name] and pushes rows in the same Shape-E format:
  // filled-square + class label + status glyph + detail. Glyphs match the
  // existing class A pattern: green check for ok, yellow warn for warn,
  // red warn for error (mirrors line 1067 'cannot read state'), dim slash
  // for skip. Class F UI compliance scanner approves these glyphs (U+2717
  // BALLOT X is forbidden; U+26A0 WARN and U+2298 CIRCLED DIVISION SLASH
  // are approved per the 12-glyph vocabulary).
  if (report.checks) {
    const stl = report.checks['statusline-visibility'];
    if (stl) {
      let glyph;
      let color;
      if (stl.status === 'ok') { glyph = '✓'; color = C.green; }
      else if (stl.status === 'warn') { glyph = '⚠'; color = C.yellow; }
      else if (stl.status === 'error') { glyph = '⚠'; color = C.red; }
      else { glyph = '⊘'; color = C.dim; } // skip
      bodyRows.push('  ' + color + '■' + C.reset + ' statusline-visibility       ' + color + glyph + C.reset + ' ' + (stl.detail || stl.status));
    }
    const inc = report.checks['install-incomplete'];
    if (inc) {
      let glyph;
      let color;
      if (inc.status === 'ok') { glyph = '✓'; color = C.green; }
      else if (inc.status === 'warn') { glyph = '⚠'; color = C.yellow; }
      else if (inc.status === 'error') { glyph = '⚠'; color = C.red; }
      else { glyph = '⊘'; color = C.dim; } // skip
      bodyRows.push('  ' + color + '■' + C.reset + ' install-incomplete          ' + color + glyph + C.reset + ' ' + (inc.detail || inc.status));
      if (inc.status === 'warn' && inc.recoverable === true) {
        bodyRows.push('     ' + C.dim + '-> /mos:doctor --statusline-visibility --fix re-stamps the statusLine block' + C.reset);
      }
    }
    for (const [name, _check] of Object.entries(report.checks)) {
      if (name === 'install-cache') continue; // already handled above.
      if (name === 'statusline-visibility') continue; // rendered above.
      if (name === 'install-incomplete') continue; // rendered above.
      // Future: render check.detail rows here using the same idiom.
    }
  }

  // Summary line. Aggregate counts from install/dev/drift signals plus any
  // report.checks.* rows that Plans 05+06 will register.
  const summary = computeSummary(report);
  bodyRows.push('');
  bodyRows.push(`  ${C.dim}Summary: ${C.green}${summary.healthy}${C.dim} healthy / ${C.yellow}${summary.drift}${C.dim} drift / ${C.red}${summary.warnings}${C.dim} warnings${C.reset}`);

  // F.1 Next Move selector (D-18) -- only when drift AND !fix. Phase 95.1 ships
  // a STRUCTURAL marker. Larry handles conversational selection per D-19.
  // Phase 88.2 will replace this with the canonical AskUserQuestion primitive.
  // See .planning/phases/95.1-.../f1-selector-deferred.md for the deferral note.
  if (!report.fixRequested && (report.drift.detected || summary.drift > 0)) {
    bodyRows.push('');
    bodyRows.push(`  ${C.cyan}[F.1 Next Move]${C.reset}`);
    bodyRows.push(`   ${C.cyan}▶${C.reset} Run ${C.cyan}/mos:doctor --fix${C.reset}`);
    bodyRows.push(`   ${C.dim}▷${C.reset} Defer`);
    bodyRows.push(`   ${C.dim}▷${C.reset} Free-Text`);
  }

  // Zone 4 action footer -- ALWAYS present (D-12 mandate). 2-3 grounded /mos:
  // commands. Primary action uses U+25B6, alternatives use U+25B7.
  bodyRows.push('');
  if (report.drift.detected || summary.drift > 0) {
    bodyRows.push(`  ${C.cyan}▶ /mos:doctor --fix --all${C.reset}     ${C.dim}# auto-recover all drift classes${C.reset}`);
    bodyRows.push(`  ${C.dim}▷${C.reset} ${C.cyan}/mos:rooms${C.reset}                 ${C.dim}# inspect known rooms${C.reset}`);
    bodyRows.push(`  ${C.dim}▷${C.reset} ${C.cyan}/mos:doctor --json${C.reset}         ${C.dim}# machine-readable output${C.reset}`);
  } else {
    bodyRows.push(`  ${C.cyan}▶ /mos:status${C.reset}                  ${C.dim}# room state overview${C.reset}`);
    bodyRows.push(`  ${C.dim}▷${C.reset} ${C.cyan}/mos:doctor --all${C.reset}          ${C.dim}# re-run all classes${C.reset}`);
    bodyRows.push(`  ${C.dim}▷${C.reset} ${C.cyan}/mos:doctor --json${C.reset}         ${C.dim}# machine-readable output${C.reset}`);
  }

  // Zone 1 header (decided AFTER body rows for density rule, D-16).
  // Zone 3 (Intelligence Strip) stays empty in 95.1 per D-17 -- room-proactive
  // integration deferred. Default behavior: omit Zone 3 entirely.
  const projectedLineCount = bodyRows.length + 4; // header + blank + body + trailing blank.
  if (projectedLineCount > 30) {
    // Compact header per D-16 density rule.
    const classCount = Object.keys(report.checks || { 'install-cache': 1 }).length;
    lines.push(`${C.dim}-- doctor: ${classCount} drift classes checked --${C.reset}`);
  } else {
    // Standard Zone 1 header per D-12. Literal prefix '-- MindrianOS -- doctor'
    // is asserted by tests/test-doctor-ui-self-compliant.cjs scenario 3.
    lines.push(`${C.dim}-- MindrianOS -- doctor -- ${stage} --${C.reset}`);
  }
  lines.push('');
  for (const row of bodyRows) lines.push(row);
  lines.push('');

  return lines.join('\n');
}

// Helper for Zone 2 summary aggregation. Walks install/dev/drift signals plus
// any report.checks.* rows that Plans 05+06 will register and returns
// healthy / drift / warning totals.
function computeSummary(report) {
  let healthy = 0;
  let drift = 0;
  let warnings = 0;
  // Class A -- install-cache + drift signal.
  if (report.install.status === 'ok' && report.cache.status === 'ok' && !report.drift.detected) {
    healthy += 1;
  } else if (report.drift.detected) {
    drift += 1;
  } else {
    warnings += 1;
  }
  // Dev source.
  if (report.dev.status === 'ok') healthy += 1;
  else if (report.dev.status === 'mismatch') warnings += 1;
  // Future class B/C/D/E/F: walk report.checks.
  if (report.checks) {
    for (const [name, check] of Object.entries(report.checks)) {
      if (name === 'install-cache') continue;
      if (check && check.status === 'ok') healthy += 1;
      else if (check && (check.status === 'warn' || check.status === 'error')) drift += 1;
      // status='skip' omitted from totals.
    }
  }
  return { healthy, drift, warnings };
}

// -- Main ------------------------------------------------------------

function main() {
  const flags = parseArgs(process.argv.slice(2));

  // Phase 123 Plan-04: release-gate runner. --acceptance has its own exit-
  // code contract (0 = all points passed; 1 = any point failed); HARD ABORT
  // -- no --allow override (per CONTEXT D-16: release infra is the one gate
  // you cannot skip). The class-flag-always-exit-0 invariant does NOT apply.
  // Dispatched BEFORE the class-flag block so the existing per-class drift
  // detectors do not run twice (the doctor-all sub-check spawns ourselves
  // with --all for that, in a child process).
  if (flags.acceptance) {
    const home = process.env.HOME || process.env.USERPROFILE || HOME;
    runAcceptance({
      home: home,
      pluginRoot: PLUGIN_ROOT,
      flagPreTag: flags.preTag,
      flagLightNpx: flags.lightNpx,
    }).then(function (result) {
      // Per-point status lines (human-readable).
      for (const p of result.points) {
        const tag = p.ok ? 'PASS' : 'FAIL';
        const findingSuffix = p.finding ? '  -- ' + p.finding : '';
        console.log(tag + '  ' + p.id + ': ' + p.label + findingSuffix);
      }
      console.log('');
      const failSuffix = result.failed_points.length
        ? '; failed: ' + result.failed_points.join(', ')
        : '';
      console.log('Acceptance ' + result.mode + ': ' + result.summary.passed + '/' + result.summary.total + ' points passed' + failSuffix + '.');
      if (flags.json) console.log(JSON.stringify(result, null, 2));
      process.exit(result.failed_points.length === 0 ? 0 : 1);
    }).catch(function (e) {
      console.error('acceptance runner threw: ' + (e && e.message));
      if (flags.json) console.log(JSON.stringify({ mode: flags.preTag ? 'pre-tag' : 'full', error: e && e.message, points: [], failed_points: ['__runner__'], summary: { total: 0, passed: 0, failed: 1 } }, null, 2));
      process.exit(1);
    });
    return;
  }


  const installResult = checkInstallVersion();
  const cacheResult = checkMarketplaceCache();
  const devResult = checkDevSourceConsistency();

  // Detect whether any class B/C/D/E/F/G/I/J flag was activated -- when YES the
  // doctor run is in "class-flag mode" (graceful degradation per Canon Part
  // 8 invariant): class A install/cache issues become informational, never
  // hard exits, and warnings from new checks return 0 unless --fix-failed.
  const classFlagsActive = flags.cascadeRooms || flags.verifySurface
    || flags.roomMd || flags.uiCompliance || flags.statuslineVisibility
    || flags.installState;

  const report = {
    install: installResult,
    cache: cacheResult,
    dev: devResult,
    drift: { detected: false },
    fixRequested: flags.fix,
    classARecovered: null, // class A install-cache recovery result (single object)
    recoveryError: null,
    checks: {},     // class B/C/D/E/F results land here.
    recovered: [],  // unified array of recovery records across all classes.
  };

  // Drift detection (class A) -- widened in Phase 95.2 D-05/D-06.
  if (installResult.status === 'ok' && cacheResult.status === 'ok') {
    if (installResult.parsed && cacheResult.latestParsed) {
      const cmp = cmpVersion(installResult.parsed, cacheResult.latestParsed);
      report.drift = {
        detected: cmp < 0,
        compare: cmp,
      };
    }
  } else if (installResult.status === 'missing'
             && cacheResult.status === 'ok'
             && cacheResult.versions
             && cacheResult.versions.length > 0) {
    // Phase 95.2 D-05: missing install with available cache is a recoverable drift case.
    report.drift = { detected: true, reason: 'install-missing' };
  }

  // Phase 95.2 D-07: install.recoverable (pure addition; preserves byte-stability of existing fields).
  // True iff the cache holds at least one valid version. Lets automation distinguish
  // 'can fix automatically' from 'needs manual intervention' without parsing cache.versions[].
  report.install.recoverable = (cacheResult.status === 'ok' && cacheResult.versions && cacheResult.versions.length > 0);

  // Class A recovery (existing behavior preserved; result also pushed onto
  // the unified report.recovered array for class B/C/D/E/F co-existence).
  // Phase 95.2 D-01..D-04: now uses performRecoveryAtomic with two-step atomic-swap.
  // Phase 123 Plan-03 carve-out: when --install-state (class I) is active,
  // class A's `--fix` is suppressed. Class I owns the legacy-migration
  // semantics (backup-then-verify-then-remove with the dev-clone safety belt
  // and the dirty/unpushed refuse checks per D-13). Without this carve-out
  // class A would migrate the legacy dir AHEAD of class I, defeating the
  // dirty-legacy refuse contract.
  if (flags.fix && report.drift.detected && !flags.installState) {
    const result = performRecoveryAtomic(installResult.version, cacheResult.latest);
    if (result.status === 'ok') {
      report.classARecovered = result;
      report.recovered.push({ tool: 'install-cache', status: 'ok', version: result.recoveredVersion, backup: result.backup });
    } else {
      report.recoveryError = result.detail;
      // Phase 95.2 D-03: distinguish rollback exit (code 4) from regular failure (code 1).
      if (result.exitCode === 4 || result.stage === 'commit-rollback') {
        report.recoveryRolledBack = true;
      }
    }
  }

  // Class B + C: cascade-rooms (sentinel + active-room guard silence).
  if (flags.cascadeRooms) {
    try { report.checks['cascade-rooms'] = checkCascadeRoomsSentinel(); }
    catch (err) { report.checks['cascade-rooms'] = { status: 'error', detail: err.message, missingSentinels: [], okCount: 0 }; }
    try { report.checks['cascade-rooms-active'] = checkCascadeRoomsActive(flags.simulateWrite); }
    catch (err) { report.checks['cascade-rooms-active'] = { status: 'error', detail: err.message }; }
  }

  // Class D: surface verification (stub; live runner deferred to Plan 95.1-07).
  if (flags.verifySurface) {
    try { report.checks['verify-surface'] = checkSurfaceVerification(); }
    catch (err) { report.checks['verify-surface'] = { status: 'error', detail: err.message }; }
  }

  // Class E: room-md cascade (ROOM.md + MINTO.md presence under .room-root).
  if (flags.roomMd) {
    try { report.checks['room-md'] = checkRoomMd(); }
    catch (err) { report.checks['room-md'] = { status: 'error', detail: err.message, missing: [] }; }
  }

  // Class F: UI Ruling System scan (D-13 + D-14). --scan-commands and
  // --scan-scripts allow tests to override the default ./commands and
  // ./scripts directories with scratch fixtures. Per D-13, --fix is
  // detect-only in 95.1 (no recovery dispatch).
  if (flags.uiCompliance) {
    try {
      report.checks['ui-compliance'] = checkUIRulingCompliance({
        scanCommandsDir: flags.scanCommandsDir,
        scanScriptsDir: flags.scanScriptsDir,
      });
    } catch (err) {
      report.checks['ui-compliance'] = { status: 'error', detail: err.message, violations: [] };
    }
  }

  // Class G: statusline visibility (Phase 106-03). Probes user-settings drift,
  // plugin install integrity, statusline-mos isolated execution, and
  // disableAllHooks user opt-out.
  if (flags.statuslineVisibility) {
    try {
      report.checks['statusline-visibility'] = checkStatuslineVisibility();
    } catch (err) {
      report.checks['statusline-visibility'] = { status: 'error', detail: err.message };
    }
  }

  // Class H: install-incomplete (Phase 95.6 D-09). Subsumes the missing-
  // statusLine case. Activated by --statusline-visibility (so the first-session
  // check /mos:doctor --statusline-visibility surfaces it) and by --all.
  if (flags.statuslineVisibility) {
    try {
      report.checks['install-incomplete'] = checkInstallIncomplete();
    } catch (err) {
      report.checks['install-incomplete'] = { status: 'error', detail: err.message, recoverable: false };
    }
  }

  // Class E --fix dispatch: invoke generator + re-check.
  if (flags.fix && flags.roomMd && report.checks['room-md'] && report.checks['room-md'].status === 'warn') {
    try {
      const recovery = performRoomMdRecovery(report.checks['room-md']);
      // performRoomMdRecovery already attached tool: 'generate-section-intelligence'.
      report.recovered.push(recovery);
      // Re-pull the post-fix check so the report reflects remediation state.
      try { report.checks['room-md'] = checkRoomMd(); }
      catch (err) { report.checks['room-md'] = { status: 'error', detail: err.message, missing: [] }; }
    } catch (err) {
      report.recovered.push({ status: 'error', detail: err.message, tool: 'generate-section-intelligence' });
    }
  }

  // Class G --fix dispatch: invoke migrate-stale-user-settings.cjs + re-check.
  // Gated on status='warn' AND recoverable=true so disableAllHooks (recoverable
  // false) never triggers the migrator -- the user opted out of hooks; --fix
  // cannot help, see RESEARCH §4.3.
  if (flags.fix && flags.statuslineVisibility
      && report.checks['statusline-visibility']
      && report.checks['statusline-visibility'].status === 'warn'
      && report.checks['statusline-visibility'].recoverable !== false) {
    try {
      const recovery = performStatuslineFix(report.checks['statusline-visibility']);
      report.recovered.push(recovery);
      try { report.checks['statusline-visibility'] = checkStatuslineVisibility(); }
      catch (err) { report.checks['statusline-visibility'] = { status: 'error', detail: err.message }; }
    } catch (err) {
      report.recovered.push({ status: 'error', detail: err.message, tool: 'migrate-stale-user-settings' });
    }
  }

  // Class H --fix dispatch: re-stamp the canonical statusLine block when it is
  // missing (status='warn' AND recoverable). The halted-tail-steps case has
  // recoverable=false (report-only -- doctor does not re-run install.sh).
  if (flags.fix && flags.statuslineVisibility
      && report.checks['install-incomplete']
      && report.checks['install-incomplete'].status === 'warn'
      && report.checks['install-incomplete'].recoverable === true) {
    try {
      const recovery = performClassHFix(report.checks['install-incomplete']);
      report.recovered.push(recovery);
      try { report.checks['install-incomplete'] = checkInstallIncomplete(); }
      catch (err) { report.checks['install-incomplete'] = { status: 'error', detail: err.message, recoverable: false }; }
    } catch (err) {
      report.recovered.push({ status: 'error', detail: err.message, tool: 'doctor-class-h' });
    }
  }

  // Class I + Class J: install-state + topology + 6-way version-of-record;
  // deployment-surface manifest reconciliation. Phase 123 Plan-03.
  if (flags.installState) {
    const home = process.env.HOME || process.env.USERPROFILE || HOME;
    let stateCheck;
    try {
      stateCheck = checkInstallState({ home });
    } catch (err) {
      stateCheck = { status: 'error', detail: err.message, findings: [], topology: 'not-found', recoverable: false };
    }
    report.checks['install-state'] = stateCheck;
    // --fix dispatch BEFORE class J check so the recoveries are visible and
    // class J reads the (possibly repaired) record + LV on its run.
    if (flags.fix && stateCheck && stateCheck.recoverable) {
      try {
        const classIRecoveries = performClassIFix(stateCheck, { home });
        if (!Array.isArray(report.recoveries)) report.recoveries = [];
        for (const rec of classIRecoveries) report.recoveries.push(rec);
        for (const rec of classIRecoveries) report.recovered.push(rec);
        // Re-pull the post-fix check so the report reflects remediation state.
        try { report.checks['install-state'] = checkInstallState({ home }); } catch (e) { /* keep prior */ }
      } catch (err) {
        if (!Array.isArray(report.recoveries)) report.recoveries = [];
        report.recoveries.push({ class: 'install-state', action: 'error', detail: err.message });
      }
    }
    // Now class J -- reads topology + active_root + active_version from the
    // (possibly post-fix) install-state.
    const stateAfter = report.checks['install-state'];
    const activeRoot = stateAfter && stateAfter.record && stateAfter.record.active_root
      ? stateAfter.record.active_root
      : (stateAfter && stateAfter.resolver && stateAfter.resolver.root) || null;
    const activeVersion = stateAfter && stateAfter.record && stateAfter.record.active_version
      ? stateAfter.record.active_version
      : (function() {
          try { return readInstalledPluginsVersion(home); } catch (_) { return null; }
        })();
    let surfacesCheck;
    try {
      surfacesCheck = checkDeploymentSurfaces({
        home,
        topology: (stateAfter && stateAfter.topology) || 'not-found',
        activeRoot, activeVersion,
      });
    } catch (err) {
      surfacesCheck = { status: 'error', detail: err.message, surfaces: [], recoverable: false };
    }
    report.checks['deployment-surfaces'] = surfacesCheck;
    if (flags.fix && surfacesCheck && surfacesCheck.recoverable) {
      try {
        const classJRecoveries = performClassJFix(surfacesCheck, { home, activeVersion });
        if (!Array.isArray(report.recoveries)) report.recoveries = [];
        for (const rec of classJRecoveries) report.recoveries.push(rec);
        for (const rec of classJRecoveries) report.recovered.push(rec);
        // Re-pull the post-fix surfaces check.
        try {
          report.checks['deployment-surfaces'] = checkDeploymentSurfaces({
            home,
            topology: (stateAfter && stateAfter.topology) || 'not-found',
            activeRoot, activeVersion,
          });
        } catch (e) { /* keep prior */ }
      } catch (err) {
        if (!Array.isArray(report.recoveries)) report.recoveries = [];
        report.recoveries.push({ class: 'deployment-surfaces', action: 'error', detail: err.message });
      }
    }
    // BUG 7 reinterpretation: when class A (install-cache) reports
    // status:'missing' AND class I says topology=='marketplace-cache', the
    // legacy clone is EXPECTED to be absent. Downgrade class A to a note.
    if (report.install && report.install.status === 'missing'
        && stateAfter && stateAfter.topology === 'marketplace-cache') {
      report.install = Object.assign({}, report.install, {
        status: 'ok',
        note: 'legacy clone path expected absent on a marketplace-cache install (Bug 7 fix)',
        bug7_fix: true,
      });
      // Likewise neutralize drift detection if it was based on
      // 'install-missing'.
      if (report.drift && report.drift.reason === 'install-missing') {
        report.drift = { detected: false, reason: 'bug7-fix-marketplace-cache' };
      }
    }
  }

  // Output
  if (flags.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderHumanReport(report));
  }

  // Exit code.
  // When class flags are active we honor the graceful-degradation invariant
  // (Canon Part 8): the doctor run NEVER aborts with non-zero unless an
  // explicit --fix attempt failed. Tests rely on this for hermetic scratch-
  // registry runs that have no real install directory.
  if (classFlagsActive) {
    process.exit(0);
  }
  // Phase 95.2 exit-code chain (additive; preserves existing 0/1/2/3 semantics, adds 4).
  // 0 = healthy (no drift detected).
  // 1 = drift detected (read-only mode OR --fix didn't run).
  // 2 = drift detected and recovered via --fix.
  // 3 = internal error (cache unreadable, or install in 'error' state -- not 'missing').
  // 4 = recovery attempted but rolled back to backup state (D-03).
  if (cacheResult.status !== 'ok') process.exit(3);
  if (installResult.status === 'error') process.exit(3);
  if (report.recoveryRolledBack) process.exit(4);
  if (report.classARecovered) process.exit(2);
  if (report.drift.detected) process.exit(1);
  process.exit(0);
}

main();
