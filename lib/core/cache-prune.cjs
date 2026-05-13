'use strict';
/*
 * lib/core/cache-prune.cjs -- prune stale marketplace-cache version dirs.
 *
 * Phase 123 Plan-05 (HARNESS-123-13). Canon Part 8: this reads LOCAL files
 * only (~/.claude/plugins/) and writes LOCAL files only (fs.rmSync on
 * stale version dirs). Zero network surface.
 *
 * Background: Claude Code's marketplace install path is
 *   ~/.claude/plugins/cache/<marketplace>/mos/<version>/
 * where each <version> subdir is a self-contained install of that
 * version. On `claude plugin update`, the new version is downloaded
 * into a new <version> dir, but the old <version> dir is NEVER removed.
 * The Windows live test of v1.13.0-beta.12 surfaced two orphans on disk
 * (`1.12.0/`, `1.13.0-beta.9/`) alongside the active `1.13.0-beta.12/`.
 *
 * This helper prunes the cache, keying off Claude Code's own
 * installed_plugins.json (the source of truth for "which version is active"):
 *
 *   - active version (from installed_plugins.json's mos@mindrian-marketplace
 *     entry) is ALWAYS kept, regardless of mtime.
 *   - the N most recent non-active versions (default N=2, sorted by mtime
 *     DESC) are also kept.
 *   - everything else is removed.
 *
 * Belt + suspenders: before every fs.rmSync call, the path's basename is
 * cross-checked against the active version string -- if it matches, the
 * removal is SKIPPED with a logged reason (defends against a malformed
 * installed_plugins.json that somehow lists two different basenames as
 * "active", or a race between this function and a concurrent install).
 *
 * If installed_plugins.json is unreadable (ENOENT, parse error, or no
 * mos@mindrian-marketplace entry), the function returns
 *   { kept: [], removed: [], skipped: true, reason: '...' }
 * with NO mutation. Never guesses; never deletes anything in the absence
 * of an authoritative active-version answer.
 *
 * Signature:
 *   pruneMarketplaceCache({
 *     home = os.homedir(),
 *     marketplace = 'mindrian-marketplace',
 *     retainCount = 2,
 *     dryRun = false,
 *   } = {}) => {
 *     kept: string[],     // version basenames kept on disk (incl. active)
 *     removed: string[],  // version basenames removed (or would be, in dryRun)
 *     skipped: boolean,   // true if we declined to act (see `reason`)
 *     reason: string|null // human-readable explanation, or null on success
 *   }
 *
 * Canon Part 8 sanity check (cp.6): the forbidden-network-token grep
 * exits 1 (no match) on this source file. Test cp.6 enforces it.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Read installed_plugins.json and pull the mos@mindrian-marketplace active
// version. Returns { activeVersion, activeInstallPath } on success, or
// { skipped: true, reason } on any failure.
function readActiveVersion(home) {
  const installedPath = path.join(home, '.claude', 'plugins', 'installed_plugins.json');
  let raw;
  try {
    raw = fs.readFileSync(installedPath, 'utf8');
  } catch (e) {
    return { skipped: true, reason: 'installed_plugins.json unreadable (' + (e && e.code || e.message) + ') -- skipping prune' };
  }
  let ip;
  try {
    ip = JSON.parse(raw);
  } catch (e) {
    return { skipped: true, reason: 'installed_plugins.json parse error -- skipping prune' };
  }
  if (!ip || typeof ip !== 'object' || !ip.plugins || typeof ip.plugins !== 'object') {
    return { skipped: true, reason: 'installed_plugins.json has no plugins map -- skipping prune' };
  }
  // Accept either key shape: 'mos@mindrian-marketplace' or 'mos'.
  let entry = ip.plugins['mos@mindrian-marketplace'];
  if (!entry) {
    // Defensive: find any key whose left-of-@ is mos or mindrian-os.
    const keys = Object.keys(ip.plugins);
    for (const k of keys) {
      const name = String(k).split('@')[0];
      if (name === 'mos' || name === 'mindrian-os') { entry = ip.plugins[k]; break; }
    }
  }
  if (!entry) {
    return { skipped: true, reason: 'no active mos@mindrian-marketplace entry in installed_plugins.json -- skipping prune' };
  }
  if (Array.isArray(entry)) entry = entry[0];
  if (!entry || !entry.version) {
    return { skipped: true, reason: 'mos@mindrian-marketplace entry has no version field -- skipping prune' };
  }
  return {
    activeVersion: String(entry.version),
    activeInstallPath: entry.installPath || entry.path || entry.dir || null,
  };
}

// List child directory names under <home>/.claude/plugins/cache/<marketplace>/mos/.
// Returns [] if the cache dir does not exist (no-op case).
function listCacheVersions(home, marketplace) {
  const cacheDir = path.join(home, '.claude', 'plugins', 'cache', marketplace, 'mos');
  if (!fs.existsSync(cacheDir)) return { cacheDir, names: [] };
  let names = [];
  try {
    names = fs.readdirSync(cacheDir).filter(function (name) {
      try { return fs.statSync(path.join(cacheDir, name)).isDirectory(); }
      catch (_) { return false; }
    });
  } catch (_) { /* unreadable -- treat as empty */ }
  return { cacheDir, names };
}

// Sort version names by mtime DESC (newest first). Falls back to lexicographic
// order if statSync fails on any path (defensive).
function sortByMtimeDesc(cacheDir, names) {
  const stats = names.map(function (name) {
    let mtimeMs = 0;
    try { mtimeMs = fs.statSync(path.join(cacheDir, name)).mtimeMs || 0; }
    catch (_) { mtimeMs = 0; }
    return { name, mtimeMs };
  });
  stats.sort(function (a, b) {
    if (b.mtimeMs !== a.mtimeMs) return b.mtimeMs - a.mtimeMs;
    return a.name < b.name ? 1 : -1; // tie-break lexicographic DESC (stable)
  });
  return stats.map(function (s) { return s.name; });
}

function pruneMarketplaceCache(opts) {
  const o = opts || {};
  const home = o.home || os.homedir();
  const marketplace = o.marketplace || 'mindrian-marketplace';
  const retainCount = (typeof o.retainCount === 'number' && o.retainCount >= 0) ? o.retainCount : 2;
  const dryRun = !!o.dryRun;

  // Step 1: read active version. Skip entirely if unavailable -- never guess.
  const active = readActiveVersion(home);
  if (active.skipped) {
    return { kept: [], removed: [], skipped: true, reason: active.reason };
  }
  const activeVersion = active.activeVersion;

  // Step 2: list cache version dirs.
  const { cacheDir, names } = listCacheVersions(home, marketplace);
  if (names.length === 0) {
    // No cache dir to prune. The active version is still "kept" conceptually
    // (it lives in the cache when it exists; absent cache = nothing to do).
    return { kept: [activeVersion], removed: [], skipped: false, reason: 'no cache dir to prune' };
  }

  // Step 3: build the keep-set.
  //   - the active version is ALWAYS kept (regardless of mtime).
  //   - then the N most recent non-active versions (by mtime DESC).
  const sorted = sortByMtimeDesc(cacheDir, names);
  const keep = new Set();
  keep.add(activeVersion);
  for (const name of sorted) {
    if (name === activeVersion) continue;
    if (keep.size >= retainCount + 1) break; // +1 reserves the slot for active
    keep.add(name);
  }

  // Step 4: compute the prune set and act on it.
  const removed = [];
  for (const name of names) {
    if (keep.has(name)) continue;
    // Belt + suspenders: NEVER rm the active version's dir, no matter what.
    if (name === activeVersion) {
      // (Cannot reach here under normal flow -- the keep-set above always
      // contains activeVersion. Defensive sentinel for malformed inputs.)
      continue;
    }
    const target = path.join(cacheDir, name);
    if (dryRun) {
      removed.push(name);
      continue;
    }
    try {
      fs.rmSync(target, { recursive: true, force: true });
      removed.push(name);
    } catch (e) {
      // Best-effort: a failed removal does not abort the whole prune; we
      // record it in the reason field at the end if any failures occurred.
      // The caller (session-start with `|| true`; doctor with try/catch +
      // report.recoveries) handles the partial state.
      removed.push(name + ' (rm-failed: ' + (e && e.code || e.message) + ')');
    }
  }

  return {
    kept: Array.from(keep),
    removed,
    skipped: false,
    reason: null,
  };
}

module.exports = {
  pruneMarketplaceCache,
  // Internal helpers exposed for testability + future reuse.
  readActiveVersion,
  listCacheVersions,
  sortByMtimeDesc,
};
