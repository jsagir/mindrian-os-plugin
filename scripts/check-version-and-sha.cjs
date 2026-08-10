#!/usr/bin/env node
/**
 * check-version-and-sha.cjs
 *
 * Detects three update states by comparing BOTH the semver version string
 * AND the underlying git commit SHA:
 *
 *   UP_TO_DATE                  local version == latest, local SHA == remote tag SHA
 *   VERSION_DIFFERS             local version < latest (standard upgrade)
 *   SHA_DIFFERS_INVERSION_HOTFIX local version == latest, but tag was force-moved
 *                               (in-version hotfix shipped under the same tag)
 *
 * Used by /mos:update (commands/update.md) so that users on a corrupted
 * v<X> install where the v<X> tag has been force-moved to a hotfix commit
 * still detect that an update is available -- standard semver comparison
 * alone misses this case (the cause of Aryeh Holtzberg's "you're on the
 * latest, nothing to update" loop on 2026-04-26).
 *
 * Output protocol (first line on stdout):
 *   STATUS=<one of the four states>
 * Followed by KEY=VALUE lines:
 *   LOCAL_VERSION=<x.y.z>
 *   LATEST_VERSION=<x.y.z>
 *   LOCAL_SHA=<short-sha or "unknown">
 *   REMOTE_TAG_SHA=<short-sha or "unknown">
 *   REASON=<human-readable explanation>
 *
 * Exit codes:
 *   0 -- check ran successfully (regardless of status)
 *   1 -- network failure (couldn't reach GitHub)
 *   2 -- internal error (couldn't read local plugin.json or other)
 *
 * LATEST resolution (RCA doctor-marketplace-cache-drift-deadlock P2,
 * 2026-06-12): LATEST resolves PRIMARILY from the mindrian-marketplace
 * catalog pin (marketplace.json plugins[] entry name 'mos' -> .version) --
 * the version `claude plugin update` actually delivers to users. Main's
 * plugin.json always holds the NEXT unreleased placeholder on this repo's
 * release train (live bug: LATEST=1.13.1-beta.17 reported while
 * 1.13.1-beta.16 was the real landing), so it is only a DEGRADED fallback
 * that discloses itself in the REASON line. Catalog-over-tags rationale:
 * the newest git tag can briefly lead the catalog during a release cut;
 * the catalog pin IS what users receive.
 *
 * Reference: https://github.com/anthropics/claude-code/issues/31462
 *   ("Plugin update detection and upgrade workflow")
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const { execSync } = require('node:child_process');

const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
const REPO_OWNER = 'jsagir';
const REPO_NAME = 'mindrian-os-plugin';
const MARKETPLACE_REPO_OWNER = 'jsagir';
const MARKETPLACE_REPO_NAME = 'mindrian-marketplace';

// NOTE: the marketplace repo's default branch is `master` (NOT `main`); the
// branch-agnostic HEAD ref follows the default branch on raw.githubusercontent
// and survives a future rename (verified live 2026-06-12: /main/ 404s,
// /HEAD/ 200 with the mos pin).
const CATALOG_URL = `https://raw.githubusercontent.com/${MARKETPLACE_REPO_OWNER}/${MARKETPLACE_REPO_NAME}/HEAD/.claude-plugin/marketplace.json`;
const MAIN_PLUGIN_JSON_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/.claude-plugin/plugin.json`;

// ----- Generic JSON-over-HTTPS helper (factored from the old fetchLatestVersion) -----
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'mos-update-checker' } }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
        return;
      }
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// ----- Read local version -----
function readLocalVersion() {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
    return manifest.version;
  } catch (e) {
    return null;
  }
}

// ----- Read local commit SHA from installed_plugins.json -----
// Claude Code tracks gitCommitSha there per #31462.
function readLocalSha() {
  try {
    const home = process.env.HOME || require('os').homedir();
    const installedPath = path.join(home, '.claude', 'plugins', 'installed_plugins.json');
    if (!fs.existsSync(installedPath)) return null;
    const installed = JSON.parse(fs.readFileSync(installedPath, 'utf8'));
    // Walk the structure looking for mos@mindrian-marketplace
    const findSha = (obj) => {
      if (!obj || typeof obj !== 'object') return null;
      for (const [k, v] of Object.entries(obj)) {
        if (typeof k === 'string' && k.includes('mos@mindrian-marketplace')) {
          if (v && typeof v === 'object' && v.gitCommitSha) return String(v.gitCommitSha);
        }
        if (v && typeof v === 'object') {
          const found = findSha(v);
          if (found) return found;
        }
      }
      return null;
    };
    return findSha(installed);
  } catch (e) {
    return null;
  }
}

// ----- Resolve the LATEST pin from a parsed marketplace catalog (pure; no I/O) -----
// Shape validation hardening (threat T-q260612-01): anything malformed -> null
// (degraded fallback downstream), never a crash and never an unvalidated string
// flowing into the shell-parsed KEY=VALUE output.
function resolveLatestFromCatalog(catalog) {
  if (!catalog || !Array.isArray(catalog.plugins)) return null;
  const entry = catalog.plugins.find(p => p && p.name === 'mos');
  if (!entry || typeof entry.version !== 'string' || entry.version === '') return null;
  return entry.version;
}

// ----- Transient-network retry-with-backoff (F-I, windows-install-and-field- -----
// qa-sweep-2026-08-10): both CATALOG_URL and MAIN_PLUGIN_JSON_URL share the
// raw.githubusercontent.com host, so a single host-level reset used to fail
// the whole check in one shot (T2's /mos:update looping on "read ECONNRESET"
// on an enterprise/edu network that resets/proxies that host). Retries apply
// ONLY to transient net errors (ECONNRESET/ETIMEDOUT/EAI_AGAIN); any other
// failure (HTTP 4xx/5xx, malformed JSON) throws immediately, unretried, so
// STATUS=NETWORK_ERROR still surfaces fast for a genuinely broken fetch
// instead of stalling behind a pointless retry. Bounded: 3 attempts max,
// 250/500/1000ms backoff -- never unbounded, never a busy loop.
//
// NOTE (follow-up, not implemented here per the sweep's scope): once retries
// exhaust, /mos:update could auto-degrade straight to the native
// `/plugin marketplace update` + `/plugin update` path instead of handing
// the user two commands to paste. Left as a documented follow-up.
const RETRY_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [250, 500, 1000];

function isTransientNetError(err) {
  if (!err) return false;
  const code = err.code || '';
  if (code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'EAI_AGAIN') return true;
  const msg = String(err.message || '');
  return /\bECONNRESET\b|\bETIMEDOUT\b|\bEAI_AGAIN\b/.test(msg);
}

function defaultSleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// fetchJsonRetrying -- wraps a single fj(url) call in a bounded retry loop.
// `sleep` is dependency-injectable for hermetic unit tests (no real timers).
async function fetchJsonRetrying(fj, url, sleep) {
  let lastErr;
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      return await fj(url);
    } catch (e) {
      lastErr = e;
      if (!isTransientNetError(e) || attempt === RETRY_ATTEMPTS - 1) throw e;
      await sleep(RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]);
    }
  }
  throw lastErr;
}

// ----- Fetch latest version: marketplace catalog pin first, degraded fallback -----
// Resolution chain (RCA doctor-marketplace-cache-drift-deadlock P2):
//   PRIMARY  -- the mindrian-marketplace catalog pin (the released version
//               users actually receive from `claude plugin update`).
//   FALLBACK -- main plugin.json (the never-released next placeholder), marked
//               source 'main-plugin-json-degraded' so main() can disclose it.
//   BOTH FAIL -- reject (main()'s catch keeps STATUS=NETWORK_ERROR + exit 1),
//               only after each leg's own bounded retry has exhausted.
// `deps` is optional dependency injection for hermetic unit tests
// (tests/test-check-version-latest-resolution.cjs, tests/test-check-version-network-retry.cjs).
async function fetchLatestVersion(deps) {
  const fj = (deps && deps.fetchJson) || fetchJson;
  const sleep = (deps && deps.sleep) || defaultSleep;
  let catalogErr = null;
  try {
    const catalog = await fetchJsonRetrying(fj, CATALOG_URL, sleep);
    const pinned = resolveLatestFromCatalog(catalog);
    if (pinned) {
      return { version: pinned, source: 'marketplace-catalog' };
    }
  } catch (e) {
    catalogErr = e;
  }
  try {
    const manifest = await fetchJsonRetrying(fj, MAIN_PLUGIN_JSON_URL, sleep);
    if (manifest && typeof manifest.version === 'string' && manifest.version !== '') {
      return { version: manifest.version, source: 'main-plugin-json-degraded' };
    }
    throw new Error(`main plugin.json carries no version (${MAIN_PLUGIN_JSON_URL})`);
  } catch (e2) {
    throw (catalogErr || e2);
  }
}

// ----- Fetch the SHA that the v<version> tag points at, via GitHub API -----
function fetchTagSha(version) {
  return new Promise((resolve, reject) => {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/refs/tags/v${version}`;
    https.get(url, { headers: { 'User-Agent': 'mos-update-checker', 'Accept': 'application/vnd.github+json' } }, (res) => {
      if (res.statusCode !== 200) {
        // Tag doesn't exist or other error -- not fatal, return null
        resolve(null);
        return;
      }
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const ref = JSON.parse(body);
          // For lightweight tags: ref.object.sha is the commit SHA directly.
          // For annotated tags: ref.object.sha is the tag object SHA; we'd need
          // a second fetch to dereference. For our purposes, lightweight is
          // sufficient since git tag -f produces lightweight tags.
          resolve(ref && ref.object && ref.object.sha ? String(ref.object.sha) : null);
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

// ----- Main -----
async function main() {
  const localVersion = readLocalVersion();
  if (!localVersion) {
    process.stdout.write('STATUS=ERROR\nREASON=Could not read local plugin.json\n');
    process.exit(2);
  }

  const localSha = readLocalSha(); // may be null

  let latestVersion;
  let degradedNote = '';
  try {
    const latest = await fetchLatestVersion();
    latestVersion = latest.version;
    if (latest.source === 'main-plugin-json-degraded') {
      // Disclose the degraded resolution in the REASON line (RCA P2): the
      // placeholder may name a not-yet-released version.
      degradedNote = ' (degraded: resolved from main plugin.json placeholder, marketplace catalog unreachable)';
    }
  } catch (e) {
    process.stdout.write(`STATUS=NETWORK_ERROR\nLOCAL_VERSION=${localVersion}\nREASON=${e.message}\n`);
    process.exit(1);
  }

  // Compare versions semantically (simple split-and-compare for x.y.z)
  const cmp = compareSemver(localVersion, latestVersion);

  if (cmp < 0) {
    // Local is older -- standard upgrade
    process.stdout.write(`STATUS=VERSION_DIFFERS\nLOCAL_VERSION=${localVersion}\nLATEST_VERSION=${latestVersion}\nLOCAL_SHA=${localSha || 'unknown'}\nREMOTE_TAG_SHA=unknown\nREASON=Standard semver upgrade available (${localVersion} -> ${latestVersion})${degradedNote}\n`);
    process.exit(0);
  }

  // Local version >= latest -- need SHA check to detect in-version hotfix
  const remoteTagSha = await fetchTagSha(latestVersion);

  if (!remoteTagSha) {
    // Couldn't get tag SHA, fall back to "you're up to date" but flag it
    process.stdout.write(`STATUS=UP_TO_DATE\nLOCAL_VERSION=${localVersion}\nLATEST_VERSION=${latestVersion}\nLOCAL_SHA=${localSha || 'unknown'}\nREMOTE_TAG_SHA=unknown\nREASON=Versions match; SHA check skipped (couldn't fetch tag SHA from GitHub API)${degradedNote}\n`);
    process.exit(0);
  }

  // Compare SHAs (use first 7 chars / "short SHA" for display, but compare full)
  const localShaShort = localSha ? localSha.slice(0, 7) : 'unknown';
  const remoteShaShort = remoteTagSha.slice(0, 7);

  if (!localSha) {
    // We can't tell -- err on the side of "up to date" but disclose
    process.stdout.write(`STATUS=UP_TO_DATE\nLOCAL_VERSION=${localVersion}\nLATEST_VERSION=${latestVersion}\nLOCAL_SHA=unknown\nREMOTE_TAG_SHA=${remoteShaShort}\nREASON=Versions match; local SHA unavailable (run /plugin install mos@mindrian-marketplace to refresh registry)${degradedNote}\n`);
    process.exit(0);
  }

  if (localSha === remoteTagSha || localSha.startsWith(remoteTagSha) || remoteTagSha.startsWith(localSha)) {
    process.stdout.write(`STATUS=UP_TO_DATE\nLOCAL_VERSION=${localVersion}\nLATEST_VERSION=${latestVersion}\nLOCAL_SHA=${localShaShort}\nREMOTE_TAG_SHA=${remoteShaShort}\nREASON=Both version and SHA match; you are running the canonical v${localVersion}${degradedNote}\n`);
    process.exit(0);
  }

  // Same version, different SHA -- in-version hotfix detected
  process.stdout.write(`STATUS=SHA_DIFFERS_INVERSION_HOTFIX\nLOCAL_VERSION=${localVersion}\nLATEST_VERSION=${latestVersion}\nLOCAL_SHA=${localShaShort}\nREMOTE_TAG_SHA=${remoteShaShort}\nREASON=v${localVersion} tag was force-moved to a newer commit (in-version hotfix). Run /plugin install mos@mindrian-marketplace to pull the patched code.\n`);
  process.exit(0);
}

function compareSemver(a, b) {
  // Correct semver precedence, INCLUDING prerelease (bug fix 2026-07-02):
  // the old split('.')-only form parsed "1.15.0-beta.13" as [1,15,0,13] and
  // ranked a beta ABOVE its own stable release, so every beta tester was told
  // "you're current" when the stable shipped. Split the prerelease off first.
  const parse = (v) => {
    const [main, pre = ''] = String(v).split('-');
    const nums = main.split('.').map(n => parseInt(n, 10) || 0);
    return { nums, pre };
  };
  const pa = parse(a);
  const pb = parse(b);
  // 1. Compare the numeric x.y.z core.
  const len = Math.max(pa.nums.length, pb.nums.length);
  for (let i = 0; i < len; i++) {
    const ai = pa.nums[i] || 0;
    const bi = pb.nums[i] || 0;
    if (ai < bi) return -1;
    if (ai > bi) return 1;
  }
  // 2. Core equal -> a version WITHOUT a prerelease outranks one WITH it
  //    (1.15.0 > 1.15.0-beta.13), per semver 11.3.
  if (pa.pre === '' && pb.pre === '') return 0;
  if (pa.pre === '') return 1;
  if (pb.pre === '') return -1;
  // 3. Both prerelease -> compare dot-separated identifiers left to right;
  //    numeric identifiers compare numerically, and a shorter set is lower.
  const ida = pa.pre.split('.');
  const idb = pb.pre.split('.');
  const l2 = Math.max(ida.length, idb.length);
  for (let i = 0; i < l2; i++) {
    if (ida[i] === undefined) return -1;
    if (idb[i] === undefined) return 1;
    const xn = parseInt(ida[i], 10);
    const yn = parseInt(idb[i], 10);
    const xIsNum = !Number.isNaN(xn) && String(xn) === ida[i];
    const yIsNum = !Number.isNaN(yn) && String(yn) === idb[i];
    if (xIsNum && yIsNum) {
      if (xn !== yn) return xn < yn ? -1 : 1;
    } else if (ida[i] !== idb[i]) {
      return ida[i] < idb[i] ? -1 : 1;
    }
  }
  return 0;
}

// Exports for hermetic unit testing (tests/test-check-version-latest-resolution.cjs).
// The require.main guard (same idiom as scripts/doctor.cjs) makes the module
// requirable without executing main() -- CLI behavior is unchanged.
module.exports = { resolveLatestFromCatalog, fetchLatestVersion, compareSemver };

if (require.main === module) {
  main().catch(e => {
    process.stdout.write(`STATUS=ERROR\nREASON=${e.message}\n`);
    process.exit(2);
  });
}
