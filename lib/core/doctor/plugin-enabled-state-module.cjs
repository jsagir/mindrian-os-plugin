'use strict';
/*
 * lib/core/doctor/plugin-enabled-state-module.cjs -- Phase 217 Plan 03
 * (D-01/D-02).
 *
 * The class-N "plugin-enabled-state" doctor check (DRIFT-12 / RCA
 * plugin-silent-disable-after-cc-self-upgrade), migrated out of the
 * doctor CLI inline main() block into a registry-driven cadence:always
 * runner. flag:null in the registry, so it runs on a bare / --all / --fix run
 * exactly like the old `flags.all || flags.fix || !classFlagsActive` gate -- the
 * silent-disable situation a disabled user is actually in. Check-only
 * (fix_supported:false).
 *
 * WHAT IT DOES: wraps lib/core/check-plugin-enabled.cjs::checkPluginEnabled(),
 * which reads ~/.claude/settings.json `enabledPlugins` + installed_plugins.json.
 * When the plugin is installed but its enabledPlugins key is false, that IS the
 * silent-disable failure (the plugin's own SessionStart hooks cannot fire to
 * report it). enabled===null (key absent on older Claude Code) is "unknown, not
 * an error" -> ok. Not installed -> skip (class A/I own install state).
 *
 * Contract: check(ctx) -> { status:'ok'|'warn'|'skip'|'error', detail:string,
 *   class:'N', installed, enabled, key, settings_path, action_lines? }. The warn
 *   path carries the re-enable hint on action_lines (the deleted hand-coded N
 *   render branch's sub-line).
 *
 * Canon Part 8: LOCAL read only; NEVER writes settings.json. Never
 * back-requires the doctor CLI (circular).
 */

const { checkPluginEnabled } = require('../check-plugin-enabled.cjs');

function check(ctx) {
  void ctx; // no ctx inputs: the probe reads the real ~/.claude state.
  let res;
  try {
    res = checkPluginEnabled();
  } catch (err) {
    return {
      class: 'N',
      status: 'error',
      detail: (err && err.message) || 'class N threw',
      installed: false,
      enabled: null,
      key: null,
    };
  }

  let status;
  let detail;
  if (res.installed && res.enabled === false) {
    status = 'warn'; // CRITICAL -- the silent-disable failure state.
    detail = 'plugin is DISABLED (enabledPlugins["' + (res.key || 'mos@mindrian-marketplace')
      + '"] = false) -- this state is the silent-disable failure (install-cache family case 7). Fix: claude plugin enable '
      + (res.key || 'mos@mindrian-marketplace') + ' (or /plugin in the TUI)';
  } else if (res.installed && (res.enabled === true || res.enabled === null)) {
    status = 'ok';
    detail = res.enabled === true
      ? 'plugin is enabled (enabledPlugins["' + res.key + '"] = true)'
      : 'plugin enabled flag absent (older Claude Code) -- treated as enabled (unknown, not an error)';
  } else {
    // Not installed: out of scope for this check (class A/I own install state).
    status = 'skip';
    detail = 'plugin not found in installed_plugins.json -- enabled-state check not applicable';
  }

  const out = {
    class: 'N',
    status,
    detail,
    installed: res.installed,
    enabled: res.enabled,
    key: res.key,
    settings_path: res.settings_path,
  };
  if (status === 'warn') {
    // The deleted N render branch's re-enable hint, now structural via action_lines.
    out.action_lines = [
      'claude plugin enable ' + (res.key || 'mos@mindrian-marketplace') + '   (or /plugin in the Claude Code TUI)',
    ];
  }
  return out;
}

module.exports = {
  check,
};
