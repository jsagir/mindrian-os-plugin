'use strict';
/*
 * lib/core/check-plugin-enabled.cjs -- the ONE read-only probe for "is the
 * MindrianOS plugin ENABLED in Claude Code's user settings right now?"
 *
 * Why this exists (DRIFT-12 / RCA plugin-silent-disable-after-cc-self-upgrade):
 * when `claude plugin update mos@mindrian-marketplace` collides with a Claude
 * Code self-upgrade, the plugin can land DISABLED -- its key in
 * ~/.claude/settings.json `enabledPlugins` flips to `false`. Every existing
 * detector lives in plugin SessionStart hooks, and a DISABLED plugin's hooks do
 * NOT run, so nothing on the machine notices. This module is the detection seam
 * that runs from OUTSIDE the plugin's hook surface: doctor (and its npm
 * `npx @mindrian_os/cli doctor` entry) reaches it because the install cache +
 * npm package exist on disk regardless of the enabled flag.
 *
 * Contract:
 *   checkPluginEnabled(opts) -> {
 *     installed:     boolean,        // plugin present in installed_plugins.json
 *     enabled:       boolean|null,   // enabledPlugins[key]; null = key ABSENT
 *     key:           string|null,    // the resolved enabledPlugins key, if any
 *     settings_path: string,         // the settings.json path consulted
 *   }
 *
 *   enabled === null is "unknown, not an error": older Claude Code versions did
 *   not write an enabledPlugins block, so an absent key is the healthy/legacy
 *   state -- NOT the silent-disable failure. Only enabled === false is the bug.
 *
 * Pure, synchronous, no network, never throws. Every filesystem read is wrapped;
 * an unreadable / missing / malformed file degrades to a defined shape, never an
 * exception. Test seams: opts.settingsPath + opts.installedPluginsPath override
 * both file paths (the harness fixtures both).
 *
 * Canon Part 8: LOCAL file reads only (~/.claude/). Zero network. This module
 * NEVER writes settings.json -- it is a read-only check. Re-enabling is a
 * separate, deferred concern (the user runs `claude plugin enable <key>`).
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Accept either marketplace plugin-name shape. The live key looks like
// "mos@mindrian-marketplace"; older / alternate installs may carry
// "mindrian-os@mindrian-marketplace". Match defensively on the plugin-name
// segment before the "@" so a marketplace rename does not blind the probe.
const PLUGIN_NAMES = ['mos', 'mindrian-os'];
const MARKETPLACE = 'mindrian-marketplace';

function homeDir() {
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

// Read + parse a JSON file. Returns the parsed object, or null on any failure
// (missing, unreadable, malformed). Never throws.
function readJsonSafe(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (_e) {
    return null;
  }
}

// Does this enabledPlugins key name the MindrianOS plugin? Defensive against
// both key shapes (plugin-name@marketplace). We require the marketplace segment
// to match too, so an unrelated "mos@some-other-market" never trips the probe.
function isMindrianKey(key) {
  if (typeof key !== 'string' || key.indexOf('@') === -1) return false;
  const at = key.indexOf('@');
  const name = key.slice(0, at);
  const market = key.slice(at + 1);
  return PLUGIN_NAMES.indexOf(name) !== -1 && market === MARKETPLACE;
}

// Is the plugin present in installed_plugins.json? The v2 schema is
// { version: 2, plugins: { "<key>": [ {installPath, version, ...} ] } }.
// We accept any top-level plugins key that isMindrianKey(); we also tolerate an
// older flat shape where plugins is keyed directly. Returns {installed, key}.
function resolveInstalled(installedPluginsPath) {
  const parsed = readJsonSafe(installedPluginsPath);
  if (!parsed || typeof parsed !== 'object') return { installed: false, key: null };
  const plugins = parsed.plugins && typeof parsed.plugins === 'object'
    ? parsed.plugins
    : parsed; // tolerate a flat {<key>: ...} shape defensively
  for (const k of Object.keys(plugins)) {
    if (isMindrianKey(k)) return { installed: true, key: k };
  }
  return { installed: false, key: null };
}

/**
 * Read-only probe of the plugin's enabled state.
 *
 * @param {object} [opts]
 * @param {string} [opts.settingsPath]         override ~/.claude/settings.json
 * @param {string} [opts.installedPluginsPath] override ~/.claude/plugins/installed_plugins.json
 * @returns {{installed: boolean, enabled: (boolean|null), key: (string|null), settings_path: string}}
 */
function checkPluginEnabled(opts) {
  const o = opts || {};
  const home = homeDir();
  const settingsPath = o.settingsPath
    || path.join(home, '.claude', 'settings.json');
  const installedPluginsPath = o.installedPluginsPath
    || path.join(home, '.claude', 'plugins', 'installed_plugins.json');

  // Step 1 -- is the plugin installed at all? (cache/registry, not the flag.)
  const { installed, key: installedKey } = resolveInstalled(installedPluginsPath);

  // Step 2 -- read the enabledPlugins map from settings.json.
  const settings = readJsonSafe(settingsPath);
  const enabledMap = settings && settings.enabledPlugins
    && typeof settings.enabledPlugins === 'object'
    ? settings.enabledPlugins
    : null;

  // Resolve the key to inspect: prefer the installed_plugins.json key (the
  // authoritative active install), else the first MindrianOS key present in the
  // enabledPlugins map (covers the case where settings.json names it but
  // installed_plugins.json is missing / unreadable).
  let key = installedKey;
  if (!key && enabledMap) {
    for (const k of Object.keys(enabledMap)) {
      if (isMindrianKey(k)) { key = k; break; }
    }
  }

  // Step 3 -- resolve enabled. null when the key is ABSENT from enabledPlugins
  // (older Claude Code, or no settings file): unknown, not an error.
  let enabled = null;
  if (enabledMap && key && Object.prototype.hasOwnProperty.call(enabledMap, key)) {
    enabled = enabledMap[key] === true;
  } else if (enabledMap && key) {
    enabled = null; // key resolved from install but absent in enabledPlugins
  }

  return {
    installed: !!installed,
    enabled,
    key: key || null,
    settings_path: settingsPath,
  };
}

module.exports = { checkPluginEnabled };
