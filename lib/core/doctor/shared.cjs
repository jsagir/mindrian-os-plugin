'use strict';
/*
 * lib/core/doctor/shared.cjs -- Phase 217 Plan 01 (D-02 prerequisite).
 *
 * The LEAF module of the doctor subsystem: the shared constants + helpers that
 * both scripts/doctor.cjs AND every lib/core/doctor/*-module.cjs runner consume.
 *
 * NO-CIRCULAR-REQUIRE RULE (RESEARCH Pitfall 4): dependency flows ONE direction
 * only -- scripts/doctor.cjs -> shared.cjs and runner files -> shared.cjs.
 * shared.cjs must require NOTHING from scripts/ and NOTHING from a doctor
 * *-module.cjs runner. It requires only node built-ins, semver (already
 * vendored), and lib/core/active-plugin-root.cjs (a plain sibling helper, not a
 * doctor module), whose resolveActivePluginRoot it RE-EXPORTS so callers have a
 * single import site.
 *
 * CRITICAL __dirname re-base: this file lives at lib/core/doctor/, three levels
 * below the repo root. scripts/doctor.cjs (one level below root) computed the
 * plugin root as path.resolve(__dirname, '..'); here it is
 * path.resolve(__dirname, '..', '..', '..'). Every moved body's repo-root and
 * sibling-module path derivations are re-based accordingly.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const semver = require('semver');

// resolveActivePluginRoot lives at lib/core/active-plugin-root.cjs -- one dir UP
// from this file (lib/core/doctor/). Re-exported below so doctor.cjs + runners
// import it from the single shared surface.
const { resolveActivePluginRoot } = require(path.join(__dirname, '..', 'active-plugin-root.cjs'));

// -- Paths -----------------------------------------------------------
// Env-var names preserved byte-for-byte (MINDRIAN_PLUGIN_HOME, MINDRIAN_ROOMS_HOME):
// hermetic tests depend on them.

const HOME = os.homedir();
// Phase 95.2 D-14: optional MINDRIAN_PLUGIN_HOME override mirrors the
// MINDRIAN_ROOMS_HOME pattern. Tests set this to a scratch dir; production users
// never set it -- defaults to ~/.claude/plugins.
const PLUGIN_HOME = process.env.MINDRIAN_PLUGIN_HOME || path.join(HOME, '.claude/plugins');
// INSTALL_DIR is the legacy-clone path; class I treats topology=='legacy' as a
// migration candidate, not a missing-install. New code MUST use
// resolveActivePluginRoot() instead of this constant. INSTALL_DIR remains the
// source of truth for the existing class A check (checkInstallVersion).
const INSTALL_DIR = path.join(PLUGIN_HOME, 'mindrian-os');
const INSTALL_PLUGIN_JSON = path.join(INSTALL_DIR, '.claude-plugin/plugin.json');
const MARKETPLACE_CACHE_DIR = path.join(PLUGIN_HOME, 'cache/mindrian-marketplace/mos');
// PLUGIN_ROOT: the plugin SOURCE root (where scripts/session-start lives). This
// is THIS file's repo root -- re-based from scripts/doctor.cjs's
// path.resolve(__dirname, '..') to path.resolve(__dirname, '..', '..', '..')
// because shared.cjs sits three levels below the root at lib/core/doctor/.
const PLUGIN_ROOT = path.resolve(__dirname, '..', '..', '..');

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

// -- Version helpers -------------------------------------------------

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
    // Phase 126 Plan-02 FIX: numeric-aware prerelease ordering per
    // npm-semver spec (section 11.4.4). The prior localeCompare branch
    // sorted prereleases LEXICOGRAPHICALLY which makes "beta.10" < "beta.9"
    // because ASCII '1' < '9'. That cost a Windows tester the wrong
    // recovery target (beta.9 picked over beta.13) per the 2026-05-13
    // dogfood session. semver.compare returns -1/0/1 with proper
    // numeric-component-aware semantics: beta.9 < beta.10 < beta.13.
    //
    // Safety: cmpVersion is only invoked on parseVersion outputs; the regex
    // there gates both inputs to /^M.m.p(?:-PR)?$/ and the major/minor/patch
    // early-returns above guarantee equal cores here. semver.compare
    // validates internally and falls through to lexicographic only when its
    // parser cannot resolve the prerelease -- which our parseVersion regex
    // prevents from reaching this branch.
    return semver.compare(a.raw, b.raw);
  }
  return 0;
}

// -- Diagnostic checks (pure class-A constituent readers) ------------

function checkInstallVersion() {
  // Topology-aware REGARDLESS of legacy-dir presence (RCA:
  // doctor-marketplace-cache-drift-deadlock, 2026-06-12): under
  // marketplace-cache topology Claude Code loads the plugin from the cache
  // version dir recorded in installed_plugins.json. The active-root read used
  // to live ONLY inside the dir-missing branch below, so a VESTIGIAL legacy
  // ~/.claude/plugins/mindrian-os/ dir (stale at an older version)
  // short-circuited it: this function returned the legacy dir's stale version,
  // drift detection tripped against the cache latest, the recovery gate
  // refused to act (marketplace-cache topology, by design), and the
  // unconditional drift exit-1 deadlocked /mos:update Step 7 permanently.
  // Read the ACTIVE root FIRST so class A reports the version the loader
  // actually uses; the legacy dir's presence is informational only
  // (legacyDirPresent feeds the deferred P1 class I reap).
  try {
    const active = resolveActivePluginRoot();
    if (active && active.topology === 'marketplace-cache' && active.root) {
      const activePluginJson = path.join(active.root, '.claude-plugin', 'plugin.json');
      if (fs.existsSync(activePluginJson)) {
        const json = JSON.parse(fs.readFileSync(activePluginJson, 'utf8'));
        return {
          status: 'ok',
          version: json.version,
          parsed: parseVersion(json.version),
          topology: 'marketplace-cache',
          activeRoot: active.root,
          legacyDirPresent: fs.existsSync(INSTALL_DIR),
        };
      }
    }
  } catch (_) { /* fall through to the existing legacy logic below */ }
  if (!fs.existsSync(INSTALL_DIR)) {
    // Topology-aware (Bug 7 follow-up, 2026-06-02): under marketplace-cache
    // topology Claude Code loads the plugin from the cache version dir, and the
    // legacy ~/.claude/plugins/mindrian-os/ dir is CORRECTLY absent. Read the
    // ACTIVE root's plugin.json so class A reports the real installed version
    // instead of a false "install dir does not exist" warning. The beta.39
    // class-A fix made the install-missing DRIFT branch topology-aware; this
    // makes the cannot-read-state branch (the warning surfaced on /mos:doctor
    // --fix + the post-update activator) match, so a healthy marketplace-cache
    // install reports healthy. RCA: doctor-class-a-cannot-read-state-topology-blind.
    try {
      const active = resolveActivePluginRoot();
      if (active && active.topology === 'marketplace-cache' && active.root) {
        const activePluginJson = path.join(active.root, '.claude-plugin', 'plugin.json');
        if (fs.existsSync(activePluginJson)) {
          const json = JSON.parse(fs.readFileSync(activePluginJson, 'utf8'));
          return { status: 'ok', version: json.version, parsed: parseVersion(json.version), topology: 'marketplace-cache', activeRoot: active.root };
        }
      }
    } catch (_) { /* fall through to the legacy-dir-missing report below */ }
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

// -- Room + registry helpers -----------------------------------------

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

module.exports = {
  // constants
  C,
  HOME,
  PLUGIN_HOME,
  INSTALL_DIR,
  INSTALL_PLUGIN_JSON,
  MARKETPLACE_CACHE_DIR,
  PLUGIN_ROOT,
  // version helpers
  parseVersion,
  cmpVersion,
  // sibling re-export (single import site)
  resolveActivePluginRoot,
  // room + registry helpers
  findRoomRoot,
  readRegistry,
  readInstalledPluginsVersion,
  // pure class-A constituent readers
  checkInstallVersion,
  checkMarketplaceCache,
  checkDevSourceConsistency,
};
