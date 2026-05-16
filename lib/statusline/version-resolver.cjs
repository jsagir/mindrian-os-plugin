// lib/statusline/version-resolver.cjs -- Phase 121.5-03 Task 2 Step 2
//
// Resolves the running plugin version + checks whether an update is available.
// Pure, single-purpose: no rendering, no truncation. Returns:
//   {
//     current_version: string,
//     update_available: boolean,
//     update_available_version: string|null
//   }
//
// SEED-007 (version-of-record) anchored here. Row 1 of the statusline reads
// from this resolver.
//
// Canon Part 8: LOCAL-only. Reads ~/.mindrian/update-check.json (LOCAL
// side-channel) + the plugin's own .claude-plugin/plugin.json. Zero network.

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

function defaultCheckPath() {
  return path.join(os.homedir(), '.mindrian', 'update-check.json');
}

function readUpdateCheck(checkPath) {
  const p = checkPath || defaultCheckPath();
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {
    return null;
  }
}

function readPluginVersion(pluginRoot) {
  // Resolution chain (mirrors scripts/context-monitor readPluginVersion):
  //   1. opts.pluginRoot (explicit override for tests)
  //   2. __dirname/../../.claude-plugin/plugin.json (this file lives at lib/statusline/)
  //   3. MINDRIAN_OS_ROOT env (when set by statusline-mos wrapper)
  const candidates = [];
  if (pluginRoot) candidates.push(pluginRoot);
  candidates.push(path.resolve(__dirname, '..', '..'));
  if (process.env.MINDRIAN_OS_ROOT) candidates.push(process.env.MINDRIAN_OS_ROOT);
  for (const root of candidates) {
    try {
      const pj = path.join(root, '.claude-plugin', 'plugin.json');
      if (fs.existsSync(pj)) {
        const data = JSON.parse(fs.readFileSync(pj, 'utf8'));
        if (data && typeof data.version === 'string' && data.version.length > 0) {
          return data.version;
        }
      }
    } catch (_) {}
  }
  return 'unknown';
}

function resolveVersion(opts) {
  const o = opts || {};
  const checkPath = o.checkPath || defaultCheckPath();
  const check = readUpdateCheck(checkPath);
  const current = readPluginVersion(o.pluginRoot);
  const hasUpdate =
    !!check &&
    check.available === true &&
    typeof check.available_version === 'string' &&
    check.available_version.length > 0 &&
    check.available_version !== current;
  return {
    current_version: current,
    update_available: !!hasUpdate,
    update_available_version: hasUpdate ? check.available_version : null,
  };
}

module.exports = {
  resolveVersion,
  readUpdateCheck,
  readPluginVersion,
};
