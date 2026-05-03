#!/usr/bin/env node
/**
 * migrate-stale-user-settings.cjs
 *
 * Detects and removes stale version-pinned MindrianOS plugin paths from the
 * user's `~/.claude/settings.json`. Background:
 *
 * The deprecated `scripts/self-update` (preserved at .deprecated-2026-04-26.bak)
 * wrote absolute version-pinned paths into the user's settings.json, e.g.:
 *
 *   "statusLine": {
 *     "command": "node /home/.../plugins/cache/.../mos/1.10.13/scripts/context-monitor"
 *   }
 *
 * After self-update bumped the cache to 1.10.18, the user-settings entry
 * still pointed at 1.10.13 -- the OLD path. Even though the plugin's own
 * `settings.json` (inside the plugin) uses `${CLAUDE_PLUGIN_ROOT}/scripts/...`
 * which resolves correctly, the user-level settings OVERRIDE the plugin-level,
 * so the broken pinned path won.
 *
 * Aryeh Holtzberg hit this exact situation on 2026-04-26: even after
 * the v1.10.19 update landed, his statusline didn't render because his
 * `~/.claude/settings.json` had `1.10.13/scripts/context-monitor` baked in.
 *
 * This script detects MOS-related entries in user settings that reference
 * a version-pinned cache path and either:
 *   (A) Rewrites them to use a glob/wildcard that resolves to the latest
 *       installed version, OR
 *   (B) Removes them entirely so the plugin's own settings.json takes effect
 *
 * Default behavior is (B) -- removal. Plugin-level settings already provide
 * the correct config via `${CLAUDE_PLUGIN_ROOT}`. User-level overrides only
 * make sense for actual user customization, not for stale auto-written paths.
 *
 * USAGE:
 *   node scripts/migrate-stale-user-settings.cjs               # dry run
 *   node scripts/migrate-stale-user-settings.cjs --apply       # actually edit
 *   node scripts/migrate-stale-user-settings.cjs --auto        # detect-only, hook envelope
 *   node scripts/migrate-stale-user-settings.cjs --auto --quiet # hook-friendly: envelope-only stdout
 *
 * Output:
 *   Reports each detected stale entry. Apply mode backs up settings.json
 *   to settings.json.bak.<timestamp> before editing. Auto mode emits a
 *   Claude Code SessionStart envelope (continue:true + optional
 *   additionalContext warning); never modifies the user's file.
 *
 * Reference: Phase 90 hotfix doc 2026-04-26 (initial dry-run/--apply tool).
 *            Phase 106-01 D-01 productionizes --auto + --quiet for the
 *            SessionStart hook (STATUS-106-01).
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');
const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const AUTO  = argv.includes('--auto');
const QUIET = argv.includes('--quiet');

// Patterns that identify a stale MOS path:
// - Contains "plugins/cache/.../mos/<version>/" (version-pinned, indicates
//   self-update wrote it -- not user-curated)
// - Or absolute path containing /mindrian-os/ or /mos/ + /scripts/
const STALE_PATH_REGEX = /plugins[\/\\]cache[\/\\][^\/\\]+[\/\\]mos[\/\\]\d+\.\d+\.\d+[\/\\]/;
const PLUGIN_OWNS_KEYS = ['statusLine', 'hooks'];

// ----- envelope schema allowlist (Phase 95 BASH-95-01; mirrored from operator-update.cjs) -----
// Phase 106-01 D-01: --auto mode emits a Claude Code SessionStart envelope so the
// migrator can run as a hook without printing free-form text. --quiet suppresses
// header chatter so stdout is envelope-only when both flags are combined.
const ENVELOPE_ALLOWED = new Set([
  'decision',
  'reason',
  'continue',
  'stopReason',
  'suppressOutput',
  'systemMessage',
  'hookSpecificOutput',
]);

function emitEnvelope(obj) {
  const filtered = {};
  for (const k of Object.keys(obj || {})) {
    if (ENVELOPE_ALLOWED.has(k)) filtered[k] = obj[k];
  }
  if (filtered.continue === undefined) filtered.continue = true;
  process.stdout.write(JSON.stringify(filtered));
}

function logHeader(line) {
  if (!QUIET) console.log(line);
}

function loadSettings() {
  if (!fs.existsSync(SETTINGS_PATH)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
  } catch (e) {
    console.error(`Could not parse ${SETTINGS_PATH}: ${e.message}`);
    return null;
  }
}

function isStale(value) {
  if (typeof value === 'string') return STALE_PATH_REGEX.test(value);
  if (value && typeof value === 'object') {
    return Object.values(value).some(isStale);
  }
  return false;
}

function findStaleEntries(settings) {
  const findings = [];
  if (!settings || typeof settings !== 'object') return findings;

  for (const key of Object.keys(settings)) {
    const value = settings[key];
    if (isStale(value)) {
      findings.push({
        key: key,
        value: value,
        action: PLUGIN_OWNS_KEYS.includes(key) ? 'remove' : 'flag',
        reason: PLUGIN_OWNS_KEYS.includes(key)
          ? `Plugin's own settings.json provides ${key} via \${CLAUDE_PLUGIN_ROOT}; user-level override is stale auto-written path. Removing user-level entry restores plugin-level config.`
          : `Stale MOS-related path detected; not auto-removing because key "${key}" is not plugin-owned.`,
      });
    }
  }
  return findings;
}

function applyMigration(settings, findings) {
  // Backup first
  const backupPath = `${SETTINGS_PATH}.bak.${Date.now()}`;
  fs.copyFileSync(SETTINGS_PATH, backupPath);
  console.log(`Backup created: ${backupPath}`);

  for (const f of findings) {
    if (f.action === 'remove') {
      delete settings[f.key];
      console.log(`  Removed: ${f.key}`);
    } else {
      console.log(`  Flagged (manual review): ${f.key}`);
    }
  }

  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  console.log(`Settings updated: ${SETTINGS_PATH}`);
}

function main() {
  logHeader(`migrate-stale-user-settings: scanning ${SETTINGS_PATH}`);
  let mode;
  if (AUTO) mode = 'AUTO (detect-only, hook envelope)';
  else if (APPLY) mode = 'APPLY (will edit)';
  else mode = 'DRY RUN (no changes)';
  logHeader(`Mode: ${mode}`);
  logHeader('');

  const settings = loadSettings();
  if (!settings) {
    logHeader('No settings.json found or parse failed -- nothing to migrate.');
    if (AUTO) {
      // Hook-friendly mode: emit empty envelope and exit 0.
      emitEnvelope({ continue: true });
    }
    process.exit(0);
  }

  // Phase 106-01: disableAllHooks edge case. When the user has disabled all hooks
  // in their settings.json, --auto cannot self-heal anything (the migrator hook
  // itself would not have run, but if it did via direct CLI we still surface the
  // distinct guidance). Per RESEARCH section 3.3 this gets its own envelope message
  // so users see why /mos:doctor --fix won't help.
  if (AUTO && settings.disableAllHooks === true) {
    emitEnvelope({
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: 'MindrianOS hooks are disabled in your settings. Set disableAllHooks=false to re-enable the statusline.',
      },
    });
    process.exit(0);
  }

  const findings = findStaleEntries(settings);

  if (AUTO) {
    // Hook-friendly mode: detect only, never modify, emit envelope.
    // Findings are not printed; envelope carries the warning instead.
    if (findings.length > 0) {
      emitEnvelope({
        continue: true,
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: 'MindrianOS settings drift detected. Run /mos:doctor --fix to repair.',
        },
      });
    } else {
      emitEnvelope({ continue: true });
    }
    process.exit(0);
  }

  if (findings.length === 0) {
    logHeader('PASS: no stale MOS paths detected in user settings.');
    process.exit(0);
  }

  if (!QUIET) {
    console.log(`Found ${findings.length} stale entr${findings.length === 1 ? 'y' : 'ies'}:`);
    console.log('');
    for (const f of findings) {
      console.log(`  Key:    ${f.key}`);
      console.log(`  Value:  ${JSON.stringify(f.value).slice(0, 120)}`);
      console.log(`  Action: ${f.action}`);
      console.log(`  Reason: ${f.reason}`);
      console.log('');
    }
  }

  if (APPLY) {
    applyMigration(settings, findings);
    logHeader('');
    logHeader('Migration complete. Restart Claude Code for changes to take effect.');
  } else {
    logHeader('Run with --apply to perform the migration.');
    logHeader('A backup will be created before any changes.');
  }
}

main();
