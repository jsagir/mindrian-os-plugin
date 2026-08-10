'use strict';
/*
 * lib/core/doctor/statusline-visibility-module.cjs -- Phase 217 Plan 05 (D-01).
 *
 * The class-G "statusline-visibility" doctor check + fix, migrated out of the
 * doctor CLI inline main() block into a registry-driven cadence:always runner.
 *
 * WHAT check() DOES (moved checkStatuslineVisibility verbatim, paths re-based):
 * probes four local signals for a silently-broken statusline (Phase 106-03,
 * RESEARCH 4.3):
 *   1. stale ~/.claude/settings.json statusLine.command at a dead version-cache
 *      path (warn, recoverable=true -- the 2026-04-26 incident pattern);
 *   2. plugin's own settings.json statusLine.command does not resolve (error,
 *      recoverable=false -- broken install, --fix cannot help);
 *   3. statusline-mos isolated execution: exit 0 + brand-glyph prefix (error/
 *      warn, recoverable=false);
 *   4. disableAllHooks=true (warn, recoverable=false -- user opt-out).
 * DESKTOP/COWORK surfaces -> status skip (no statusline primitive; D-04 fallback).
 *
 * WHAT fix() DOES (moved performStatuslineFix): spawns
 * scripts/migrate-stale-user-settings.cjs --apply --quiet (D-01) which REMOVES
 * the stale user-settings statusLine override so plugin-level config takes
 * effect. The engine's fix-then-recheck flow gates it on status='warn' AND
 * recoverable !== false (which is exactly class G's historical gate), then
 * re-runs check(). The returned record preserves the raw tool field
 * ('migrate-stale-user-settings') that main() pushed onto report.recovered, and
 * adds status/detail so the generic recovered renderer has a status to key on.
 *
 * Canon Part 8: pure LOCAL probe + local spawn of a repo-local migrator -- zero
 * network, zero Brain. Never back-requires the doctor CLI (circular). Requires
 * only node built-ins + ./shared.cjs (PLUGIN_ROOT).
 *
 * Threat register (Phase 217 Plan 05): T-217-01 (self-DoS) -- the engine wraps
 * check + fix in try/catch; the isolated statusline-mos spawn carries a 1500ms
 * timeout and the migrator spawn a 5000ms timeout, so a hung child cannot wedge
 * the doctor.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { PLUGIN_ROOT } = require('./shared.cjs');

const STALE_STATUSLINE_PATH_REGEX = /plugins[\/\\]cache[\/\\][^\/\\]+[\/\\]mos[\/\\]\d+\.\d+\.\d+[\/\\]/;

// Strip ANSI escape sequences before brand-prefix matching. The plugin's
// statusline emits ANSI color codes BEFORE the brand glyph, so a naive
// startsWith check would always fail.
function stripAnsi(s) {
  return String(s || '').replace(/\[[0-9;]*m/g, '');
}

function check(_ctx) {
  const evidence = [];

  // Step 0 -- surface detection via lib/statusline/surface-detect.cjs (Plan 106-04).
  // CLI is the only surface where the statusline render is the visibility source;
  // DESKTOP and COWORK route through the D-04 fallback echo.
  try {
    const mod = require(path.join(PLUGIN_ROOT, 'lib', 'statusline', 'surface-detect.cjs'));
    const surface = mod.detectStatuslineSurface();
    if (surface !== 'CLI') {
      return {
        status: 'skip',
        detail: surface + ' has no statusline primitive -- D-04 fallback applies',
        evidence: ['surface=' + surface + ' (via lib/statusline/surface-detect.cjs)'],
        recoverable: false,
      };
    }
  } catch (_e) {
    // Graceful: if the helper cannot load, fall back to the original env-var
    // probe so the doctor never blocks itself.
    if (process.env.CLAUDE_DESKTOP === '1') {
      return {
        status: 'skip',
        detail: 'Desktop has no statusline primitive -- D-04 fallback applies',
        evidence: ['CLAUDE_DESKTOP=1 detected (fallback path)'],
        recoverable: false,
      };
    }
  }

  // Step 1 -- ~/.claude/settings.json user-level drift.
  const userSettingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  let userSettings = null;
  try {
    if (fs.existsSync(userSettingsPath)) {
      userSettings = JSON.parse(fs.readFileSync(userSettingsPath, 'utf8'));
    }
  } catch (_e) { /* ignore parse errors; treat as null */ }

  if (userSettings && userSettings.disableAllHooks === true) {
    return {
      status: 'warn',
      detail: 'disableAllHooks=true blocks statusline',
      evidence: [userSettingsPath + ': disableAllHooks=true'],
      recoverable: false,
    };
  }
  if (userSettings && userSettings.statusLine && typeof userSettings.statusLine.command === 'string') {
    const cmd = userSettings.statusLine.command;
    if (STALE_STATUSLINE_PATH_REGEX.test(cmd)) {
      // Extract a path token from the command string. Try a unix or windows
      // absolute-path match first.
      const match = cmd.match(/(\/[^\s"']+|[A-Za-z]:\\[^\s"']+)/);
      const candidate = match ? match[0] : cmd;
      if (!fs.existsSync(candidate)) {
        return {
          status: 'warn',
          detail: 'stale user-settings statusLine path',
          evidence: [userSettingsPath + ': command points at non-existent ' + candidate],
          recoverable: true,
        };
      }
    }
  }

  // Step 2 -- plugin's own settings.json statusLine.command must resolve.
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || PLUGIN_ROOT;
  const pluginSettingsPath = path.join(pluginRoot, 'settings.json');
  let pluginSettings = null;
  try {
    if (fs.existsSync(pluginSettingsPath)) {
      pluginSettings = JSON.parse(fs.readFileSync(pluginSettingsPath, 'utf8'));
    }
  } catch (_e) { /* ignore */ }
  if (pluginSettings && pluginSettings.statusLine && typeof pluginSettings.statusLine.command === 'string') {
    // Manually substitute ${CLAUDE_PLUGIN_ROOT} so we can verify the file exists.
    const resolved = pluginSettings.statusLine.command.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, pluginRoot);
    const targetMatch = resolved.match(/(\/[^\s"']+|[A-Za-z]:\\[^\s"']+)/);
    const target = targetMatch ? targetMatch[0] : null;
    if (target && !fs.existsSync(target)) {
      return {
        status: 'error',
        detail: 'plugin install corrupt',
        evidence: ['plugin statusLine.command resolves to non-existent ' + target],
        recoverable: false,
      };
    }
    if (target) evidence.push('plugin statusLine.command resolved to ' + target);
  }

  // Step 3 -- statusline-mos isolated execution against the EFFECTIVE
  // resolved command (RCA intern-w1-statusline-room-mismatch), not always the
  // plugin's own file. A user-level ~/.claude/settings.json statusLine
  // override, when present, OVERRIDES the plugin-level one (documented
  // precedence, migrate-stale-user-settings.cjs header) -- that is what a
  // real Claude Code session actually execs. Testing only pluginRoot's own
  // file here (pre-fix behavior) meant this self-test could never detect a
  // broken user-level override -- including one THIS SAME --fix run just
  // wrote (class H's fix() used to write exactly such a broken override) --
  // so Step 3 always reported 'ok' regardless of what the effective override
  // said, and attemptStatuslineSelfHeal() declared success silently. Resolve
  // the actual effective target: the user-level override's path if Step 1
  // found a statusLine.command string, else the plugin's own
  // scripts/statusline-mos.
  let statuslineMos = path.join(pluginRoot, 'scripts', 'statusline-mos');
  let statuslineSource = 'plugin-level scripts/statusline-mos';
  if (userSettings && userSettings.statusLine && typeof userSettings.statusLine.command === 'string') {
    const overrideMatch = userSettings.statusLine.command.match(/(\/[^\s"']+|[A-Za-z]:\\[^\s"']+)/);
    if (overrideMatch) {
      statuslineMos = overrideMatch[0];
      statuslineSource = 'user-level settings.json override';
    }
  }
  if (!fs.existsSync(statuslineMos)) {
    return {
      status: 'warn',
      detail: statuslineSource === 'user-level settings.json override'
        ? 'effective (user-level) statusline command target missing'
        : 'plugin install corrupt',
      evidence: [statuslineSource + ' resolves to non-existent ' + statuslineMos],
      // Only the user-level-override shape is recoverable here (removal
      // restores plugin-level config, mirroring the Step 1 stale-path branch
      // above); a corrupt plugin-level file is not something --fix can
      // repair from inside this module.
      recoverable: statuslineSource === 'user-level settings.json override',
    };
  }
  const SYNTHETIC = {
    model: { display_name: 'Test' },
    workspace: { current_dir: '/tmp' },
    context_window: { used_percentage: 0, remaining_percentage: 100, context_window_size: 200000 },
  };

  // F-A (windows-install-and-field-qa-sweep-2026-08-10): invoke the target
  // the way the real session does, never a direct exec. settings.json ships
  // statusLine.command = 'bash "${CLAUDE_PLUGIN_ROOT}/scripts/statusline-mos"'
  // -- the runtime ALWAYS routes the extensionless shebang script through
  // `bash`. The old direct spawnSync(statuslineMos, ...) worked by accident
  // on POSIX (the OS honors the shebang) but has no direct-exec association
  // on Windows, so the probe reported a false 'error' even when the real
  // statusline rendered fine (T1: "It's calling the script directly instead
  // of through Bash which doesn't work on Windows regardless of whether the
  // status line itself is healthy"). Route through `bash` whenever the
  // effective command is the plugin's own bash script (no override, or an
  // override whose command itself starts with `bash`); keep the direct spawn
  // only for a future user override that names a native executable.
  const effectiveCommand = (userSettings && userSettings.statusLine && typeof userSettings.statusLine.command === 'string')
    ? userSettings.statusLine.command
    : (pluginSettings && pluginSettings.statusLine && typeof pluginSettings.statusLine.command === 'string')
      ? pluginSettings.statusLine.command
      : null; // no settings.json on disk at all -> mirror the shipped default shape (bash-wrapped)
  const useBash = effectiveCommand === null || /^\s*bash\b/i.test(effectiveCommand);

  let r;
  try {
    r = useBash
      ? require('node:child_process').spawnSync('bash', [statuslineMos], {
          input: JSON.stringify(SYNTHETIC),
          encoding: 'utf8',
          timeout: 1500,
        })
      : require('node:child_process').spawnSync(statuslineMos, [], {
          input: JSON.stringify(SYNTHETIC),
          encoding: 'utf8',
          timeout: 1500,
        });
  } catch (err) {
    return {
      status: 'error',
      detail: 'statusline-mos spawn failed: ' + err.message,
      evidence: [],
      recoverable: false,
    };
  }
  if (r.status !== 0) {
    return {
      status: 'error',
      detail: 'statusline-mos exit ' + r.status,
      evidence: [r.stderr ? r.stderr.slice(0, 500) : '(no stderr)'],
      recoverable: false,
    };
  }
  const out = stripAnsi(r.stdout || '').trim();
  // Brand prefix per lib/core/visual-ops.cjs SYMBOLS.brand (hexagon) followed by
  // a space + persona. Empty stdout (cache not populated yet) is also acceptable
  // -- the wrapper exits 0 silently in that case to let Claude Code render its
  // default statusline. We only fail when stdout is non-empty AND lacks the
  // brand prefix.
  if (out.length > 0) {
    // Validate on the BRAND HEXAGON lead, not a frozen word (fix 2026-07-02):
    // the renderer now emits a persona-led prefix, so the old literal
    // false-positived a healthy statusline. The invariant is the brand glyph.
    const validPrefix = out.startsWith('⬡') || out.startsWith('🏠');
    if (!validPrefix) {
      return {
        status: 'warn',
        detail: 'script output unexpected',
        evidence: ['first 80 chars: ' + out.slice(0, 80)],
        recoverable: false,
      };
    }
    evidence.push('statusline-mos produced expected brand prefix');
  } else {
    evidence.push('statusline-mos exited 0 with no output (cache not populated; default Claude Code statusline applies)');
  }
  return {
    status: 'ok',
    detail: 'statusline rendering correctly',
    evidence,
    recoverable: false,
  };
}

// fix(ctx) -- moved performStatuslineFix. Invoked by the engine's fix-then-
// recheck flow with ctx.check_result. Spawns the stale-user-settings migrator
// (REMOVE mechanism, not regenerate). Returns the raw recovery record shape
// main() pushed (tool preserved) plus status/detail.
function fix(_ctx) {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || PLUGIN_ROOT;
  const migrator = path.join(pluginRoot, 'scripts', 'migrate-stale-user-settings.cjs');
  const r = require('node:child_process').spawnSync('node', [migrator, '--apply', '--quiet'], {
    encoding: 'utf8',
    timeout: 5000,
  });
  const exitCode = typeof r.status === 'number' ? r.status : -1;
  return {
    tool: 'migrate-stale-user-settings',
    action: 'removes stale user-settings.json statusLine override so plugin-level config takes effect',
    exit_code: exitCode,
    stdout: (r.stdout || '').slice(0, 500),
    stderr: (r.stderr || '').slice(0, 500),
    status: exitCode === 0 ? 'ok' : 'error',
    detail: exitCode === 0
      ? 'removed stale user-settings statusLine override'
      : 'migrate-stale-user-settings exited ' + exitCode,
  };
}

module.exports = {
  check,
  fix,
};
