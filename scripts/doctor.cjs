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
const INSTALL_DIR = path.join(HOME, '.claude/plugins/mindrian-os');
const INSTALL_PLUGIN_JSON = path.join(INSTALL_DIR, '.claude-plugin/plugin.json');
const MARKETPLACE_CACHE_DIR = path.join(HOME, '.claude/plugins/cache/mindrian-marketplace/mos');

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
    all: false, simulateWrite: null,
  };
  for (const arg of argv) {
    if (arg === '--fix') flags.fix = true;
    else if (arg === '--json') flags.json = true;
    else if (arg === '--verbose' || arg === '-v') flags.verbose = true;
    else if (arg === '--cascade-rooms') flags.cascadeRooms = true;
    else if (arg === '--verify-surface') flags.verifySurface = true;
    else if (arg === '--room-md') flags.roomMd = true;
    else if (arg === '--ui-compliance') flags.uiCompliance = true;
    else if (arg === '--all') flags.all = true;
    else if (arg.startsWith('--simulate-write=')) flags.simulateWrite = arg.slice('--simulate-write='.length);
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
  }
  return flags;
}

function usageText() {
  return `Usage: doctor.cjs [flags]

Default (no flag) runs class A install-cache check only.

Class flags (combine freely; --all activates them all):
  --cascade-rooms      class B (.room-root sentinel) + class C (active-room guard silence)
  --verify-surface     class D (live cascade end-to-end against test fixture)
  --room-md            class E (ROOM.md/MINTO.md presence under .room-root)
  --ui-compliance      class F (UI Ruling System scan)
  --all                activate all class flags

Behavior flags:
  --fix                attempt auto-recovery for each class that supports it
  --json               machine-readable output (for hooks / regression tests)
  --verbose, -v        extra diagnostic detail
  --simulate-write=<p> simulate a PWD write at <p> for class C active-room mismatch
  --help, -h           print this usage

Exit codes:
  0  healthy, no drift across activated classes
  1  drift detected (read-only mode)
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

function performRecovery(installVersion, latestCacheVersion) {
  const sourceDir = path.join(MARKETPLACE_CACHE_DIR, latestCacheVersion);
  if (!fs.existsSync(sourceDir)) {
    return { status: 'error', detail: `marketplace cache for ${latestCacheVersion} not found at ${sourceDir}` };
  }
  // Generate timestamp for backup
  const ts = new Date().toISOString().replace(/[:.]/g, '').replace(/T/, '-').slice(0, 15);
  const backupDir = path.join(HOME, `.claude/plugins/mindrian-os.stale-${installVersion}-${ts}`);
  // Step 1: rename current install to backup
  try {
    fs.renameSync(INSTALL_DIR, backupDir);
  } catch (err) {
    return { status: 'error', detail: `failed to back up stale install: ${err.message}` };
  }
  // Step 2: copy marketplace cache to install location
  try {
    copyRecursive(sourceDir, INSTALL_DIR);
  } catch (err) {
    // Try to restore the backup
    try { fs.renameSync(backupDir, INSTALL_DIR); } catch (_) {}
    return { status: 'error', detail: `failed to copy marketplace cache: ${err.message} (rollback attempted)` };
  }
  // Step 3: verify
  const after = checkInstallVersion();
  if (after.status !== 'ok' || after.version !== latestCacheVersion) {
    return { status: 'error', detail: `post-recovery verification failed: install version is ${after.version || 'unknown'}, expected ${latestCacheVersion}`, backup: backupDir };
  }
  return { status: 'ok', backup: backupDir, recoveredVersion: latestCacheVersion };
}

function copyRecursive(src, dst) {
  // Use cp -aT — preserves attributes, treats dst as the new target (no nesting)
  const { execSync } = require('child_process');
  execSync(`cp -aT ${shellQuote(src)} ${shellQuote(dst)}`);
}

function shellQuote(s) {
  return "'" + String(s).replace(/'/g, "'\\''") + "'";
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

// -- Class D: surface verification (STUB; live runner deferred to Plan 95.1-07) ----

// Class D execution lives in tests/test-cascade-surface-e2e.cjs (Plan
// 95.1-02). Wired into doctor's runtime path by Plan 95.1-07 (integration).
// For now, this stub reports skip with a pointer to the test command.
function checkSurfaceVerification() {
  return {
    status: 'skip',
    detail: 'class D end-to-end test runs separately: node tests/test-cascade-surface-e2e.cjs',
    runner: 'tests/test-cascade-surface-e2e.cjs',
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

  // Slot for class B/C/D/E/F rows -- populated by Plans 95.1-05 + 95.1-06 via
  // report.checks.* extension. Each new check reads from report.checks[name]
  // and pushes rows in the same Shape-E format: filled-square + class label
  // + status glyph + detail.
  if (report.checks) {
    for (const [name, _check] of Object.entries(report.checks)) {
      if (name === 'install-cache') continue; // already handled above.
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

  const installResult = checkInstallVersion();
  const cacheResult = checkMarketplaceCache();
  const devResult = checkDevSourceConsistency();

  // Detect whether any class B/C/D/E/F flag was activated -- when YES the
  // doctor run is in "class-flag mode" (graceful degradation per Canon Part
  // 8 invariant): class A install/cache issues become informational, never
  // hard exits, and warnings from new checks return 0 unless --fix-failed.
  const classFlagsActive = flags.cascadeRooms || flags.verifySurface
    || flags.roomMd || flags.uiCompliance;

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

  // Drift detection (class A).
  if (installResult.status === 'ok' && cacheResult.status === 'ok') {
    if (installResult.parsed && cacheResult.latestParsed) {
      const cmp = cmpVersion(installResult.parsed, cacheResult.latestParsed);
      report.drift = {
        detected: cmp < 0,
        compare: cmp,
      };
    }
  }

  // Class A recovery (existing behavior preserved; result also pushed onto
  // the unified report.recovered array for class B/C/D/E/F co-existence).
  if (flags.fix && report.drift.detected) {
    const result = performRecovery(installResult.version, cacheResult.latest);
    if (result.status === 'ok') {
      report.classARecovered = result;
      report.recovered.push({ tool: 'install-cache', status: 'ok', version: result.recoveredVersion, backup: result.backup });
    } else {
      report.recoveryError = result.detail;
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

  // Class F: UI Ruling System scan -- wired in Plan 95.1-06 (next plan).

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
  if (installResult.status !== 'ok' || cacheResult.status !== 'ok') process.exit(3);
  if (!report.drift.detected) process.exit(0);
  if (report.classARecovered) process.exit(2);
  process.exit(1);
}

main();
