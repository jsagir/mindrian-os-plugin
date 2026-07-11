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

// -- Class I / J shared readers (Phase 217 Plan 06, D-02) -----------------
//
// Moved verbatim out of scripts/doctor.cjs so BOTH the migrated class I/J
// runner modules (install-state-module.cjs, deployment-surfaces-module.cjs)
// AND doctor.cjs's --report-registration-bug assembler consume them from the
// single leaf surface (no back-require of scripts/). Canon Part 8: all LOCAL
// reads + guarded LOCAL git probes; zero network.

function readHomeFile(home, ...parts) {
  try { return fs.readFileSync(path.join(home, ...parts), 'utf8'); } catch (_) { return null; }
}

// F11 recurrence (twice on the same real Windows machine): the LEGACY v1
// plugin-system file ~/.claude/plugins/config.json keeps a `mos.version` pin
// that drifts away from the MODERN ~/.claude/plugins/installed_plugins.json
// (schema v2, namespaced key `mos@mindrian-marketplace`). On 2026-07-02 it
// pinned 1.8.2; on 2026-07-05 it pinned 1.15.1 -- both stale relative to the
// active install -- and the stale pin poisons command registration while every
// other subsystem looks healthy. The finding below detects that drift; because
// the install-state acceptance point passes only on status === 'healthy', the
// finding automatically rides doctor --acceptance (no new acceptance point).
function resolveLegacyConfigPinEntry(data) {
  // Shared resolver used by BOTH detection (readLegacyConfigPin) and the
  // --fix writer, so a match found one way is guaranteed mutable the other
  // way -- no `data[key]` shortcut that only covers the flat schema.
  // Returns { entry, key } where `entry` is the ACTUAL nested object
  // reference from `data` (mutating entry.version mutates `data` in place),
  // or null if no pin found under any known generation.
  //
  // THREE known config.json generations coexist in the wild (confirmed via a
  // live cross-check against a real Windows install, 2026-07-05) -- check all,
  // first match wins:
  //   (a) flat top-level:      { "mos": { "version": "X", ... } }
  //   (b) plugins-wrapped:     { "plugins": { "mos": { "version": "X" } } }
  //   (c) repositories-nested: { "repositories": { "<mp>": { "plugins":
  //                              { "mos": { "version": "X" } } } } }
  // (c) is the generation actually observed live; (a)/(b) are defensive
  // fallbacks for other config.json shapes this file's own comments describe
  // elsewhere -- keep all three rather than assuming one is authoritative.
  if (!data || typeof data !== 'object') return null;
  const candidates = [
    ['mos', data.mos],
    ['mindrian-os', data['mindrian-os']],
    ['mos', data.plugins && data.plugins.mos],
    ['mindrian-os', data.plugins && data.plugins['mindrian-os']],
  ];
  const repos = (data.repositories && typeof data.repositories === 'object') ? data.repositories : {};
  for (const mp of Object.keys(repos)) {
    const plugins = (repos[mp] && repos[mp].plugins) || {};
    candidates.push(['mos', plugins.mos]);
    candidates.push(['mindrian-os', plugins['mindrian-os']]);
  }
  for (const [key, entry] of candidates) {
    if (entry && entry.version) return { entry, key };
  }
  return null;
}

function readLegacyConfigPin(home) {
  // Returns { version, key } for the mos pin in the legacy config.json, or null
  // when the file is absent, unparseable, or carries no pin. Absence is the
  // healthy fresh-install state (N/A), never an error -- the whole body is
  // wrapped so a malformed legacy artifact degrades to a skip.
  try {
    const file = path.join(home, '.claude', 'plugins', 'config.json');
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const resolved = resolveLegacyConfigPinEntry(data);
    if (resolved) return { version: String(resolved.entry.version), key: resolved.key };
  } catch (_) { /* absent / unparseable -> N/A */ }
  return null;
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
  // class I / J shared readers (Phase 217 Plan 06)
  readHomeFile,
  resolveLegacyConfigPinEntry,
  readLegacyConfigPin,
  readInstalledPluginsInstallPath,
  detectMarketplaceCacheInstall,
  readPathBinVersion,
  pathBinVanished,
  collectVersionOfRecord,
  computeVersionDivergences,
  isLegacyDevClone,
  legacyDirtyOrUnpushed,
};
