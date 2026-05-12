'use strict';
/*
 * lib/core/active-plugin-root.cjs -- the ONE resolver for "where is the active
 * MindrianOS plugin install on this machine?"
 *
 * Background: before this module, three different places guessed independently
 * (bin/cli.js hardcoded a legacy path; scripts/statusline-mos did `ls cache |
 * sort -V` with a pure-semver regex that rejected `-beta.N`; context-monitor
 * inherited whatever those picked). Three guessers, three failure modes -- a box
 * with 1.12.0 + 1.13.0-beta.9 in the cache ended up rendering the statusline,
 * the version banner, and MINDRIAN_OS_ROOT from the wrong (older) version. This
 * collapses them into one source of truth.
 *
 * Precedence (first hit wins):
 *   1. MINDRIAN_OS_ROOT env var          -- tests, dev boxes, hand clones.
 *   2. ~/.claude/plugins/installed_plugins.json
 *                                        -- Claude Code's own registry of the
 *                                           ACTIVE install of mos@mindrian-marketplace.
 *                                           Temporal truth: it knows which one is
 *                                           current even when "highest semver" is not
 *                                           the active one (e.g. a pinned older version).
 *   3. ~/.claude/plugins/cache/<marketplace>/mos/<version>/
 *                                        -- newest valid version dir; pre-release
 *                                           tolerant (`sort -V` ordering). Fallback
 *                                           for when installed_plugins.json is missing
 *                                           or unparseable.
 *   4. ~/.claude/plugins/mindrian-os/    -- legacy hand-clone layout.
 *   5. null                              -- not installed.
 *
 * Use as a module:
 *   const { resolveActivePluginRoot } = require('<...>/lib/core/active-plugin-root.cjs');
 *   const { root, source } = resolveActivePluginRoot();   // root may be null
 *
 * Use as a CLI (so a bash wrapper -- e.g. scripts/statusline-mos -- can shell out):
 *   node active-plugin-root.cjs          -> prints the resolved path, or nothing; exit 0 if found, 1 if not
 *   node active-plugin-root.cjs --json   -> prints {"root": "<path|null>", "source": "<...>"}
 *
 * Canon Part 8: this reads LOCAL files only (~/.claude/plugins/). Zero network.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const PLUGIN_KEYS = ['mos', 'mindrian-os']; // accept either marketplace plugin name

// A valid plugin install dir has a .claude-plugin/plugin.json.
function isPluginDir(dir) {
  try {
    return !!dir && fs.statSync(dir).isDirectory() && fs.existsSync(path.join(dir, '.claude-plugin', 'plugin.json'));
  } catch {
    return false;
  }
}

function fromInstalledPlugins(home) {
  // Shape (Claude Code 2.x):
  //   { "version": N, "plugins": { "mos@mindrian-marketplace": [ { "installPath": "...", ... } ], ... } }
  // Defensive: the key might be just "mos"; the value might be an object not a
  // 1-element array; the path field might be installPath / path / dir.
  const file = path.join(home, '.claude', 'plugins', 'installed_plugins.json');
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
  const plugins = (data && (data.plugins || data)) || {};
  for (const key of Object.keys(plugins)) {
    const name = String(key).split('@')[0];
    if (!PLUGIN_KEYS.includes(name)) continue;
    let entry = plugins[key];
    if (Array.isArray(entry)) entry = entry[0];
    if (!entry || typeof entry !== 'object') continue;
    const p = entry.installPath || entry.path || entry.dir;
    if (p && isPluginDir(p)) return p;
  }
  return null;
}

function fromMarketplaceCache(home) {
  const cacheBase = path.join(home, '.claude', 'plugins', 'cache');
  let marketplaces;
  try {
    marketplaces = fs.readdirSync(cacheBase, { withFileTypes: true });
  } catch {
    return null;
  }
  const found = [];
  for (const mk of marketplaces) {
    if (!mk.isDirectory()) continue;
    for (const pluginName of PLUGIN_KEYS) {
      const pluginDir = path.join(cacheBase, mk.name, pluginName);
      let versions;
      try {
        versions = fs.readdirSync(pluginDir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const v of versions) {
        if (!v.isDirectory()) continue;
        const candidate = path.join(pluginDir, v.name);
        if (isPluginDir(candidate)) found.push({ dir: candidate, ver: v.name });
      }
    }
  }
  if (!found.length) return null;
  // `localeCompare` numeric ordering matches `sort -V` for the cases we care
  // about: 1.12.0 < 1.12.5.1 < 1.13.0-beta.9 < 1.13.0-beta.11 < 1.13.0.
  found.sort((a, b) => String(a.ver).localeCompare(String(b.ver), undefined, { numeric: true }));
  return found[found.length - 1].dir;
}

function fromLegacyClone(home) {
  const legacy = path.join(home, '.claude', 'plugins', 'mindrian-os');
  return isPluginDir(legacy) ? legacy : null;
}

function resolveActivePluginRoot() {
  const envRoot = process.env.MINDRIAN_OS_ROOT;
  if (envRoot) return { root: envRoot, source: 'MINDRIAN_OS_ROOT' };

  const home = os.homedir();
  let r;
  if ((r = fromInstalledPlugins(home))) return { root: r, source: 'installed_plugins.json' };
  if ((r = fromMarketplaceCache(home))) return { root: r, source: 'marketplace-cache' };
  if ((r = fromLegacyClone(home))) return { root: r, source: 'legacy-clone' };
  return { root: null, source: 'not-found' };
}

module.exports = { resolveActivePluginRoot };

// CLI entry point.
if (require.main === module) {
  const out = resolveActivePluginRoot();
  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify(out) + '\n');
  } else if (out.root) {
    process.stdout.write(out.root + '\n');
  }
  process.exit(out.root ? 0 : 1);
}
