'use strict';

/**
 * platform.cjs -- canonical cross-platform dispatch helper for MindrianOS.
 *
 * Provides OS detection, terminal code-page introspection, safe plugin.json
 * reads, and hook-script path resolution. Every downstream plan (85-02
 * node:sqlite migration, 85-06 banner rendering) depends on this module as
 * the single source of truth for platform-sensitive behavior.
 *
 * Design notes:
 *   - Zero new runtime dependencies. Only Node built-ins.
 *   - detectPlatform() reports the EXECUTION environment, not the user's
 *     desktop OS. On Cowork, process.platform may be 'linux' even if the
 *     user is driving from Windows. Callers that care about the user's
 *     actual terminal (banner rendering, code-page gating) must handle
 *     that distinction themselves.
 *   - All helpers are fail-safe. getPluginVersion() returns the literal
 *     string 'unknown' on any error rather than throwing, so the banner
 *     always renders.
 *
 * Requirement: WIN-FIX-H-01, WIN-FIX-B-01, WIN-FIX-B-02
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

let _cachedPlatform = null;
let _cachedRuntime = null;
let _cachedFailure = null;

/**
 * Detect the current execution environment.
 *
 * @returns {{
 *   os: 'win32'|'linux'|'darwin',
 *   shell: string|null,
 *   hasPython3: boolean,
 *   hasBashNative: boolean,
 *   codePage: number|null,
 *   supportsUtf8: boolean
 * }}
 */
function detectPlatform() {
  if (_cachedPlatform) return _cachedPlatform;

  const os = process.platform;

  // Shell sniff: SHELL (POSIX) -> TERM_PROGRAM (macOS Terminal/iTerm)
  // -> ComSpec (win32 cmd.exe).
  const shell =
    process.env.SHELL ||
    process.env.TERM_PROGRAM ||
    process.env.ComSpec ||
    null;

  // python3 probe. On win32, the Microsoft Store alias stub lives under
  // AppData/Local/Microsoft/WindowsApps/python3.exe and responds to
  // --version with an install prompt, not a version string. Treat the
  // stub as hasPython3:false so callers do not try to pipe JSON through
  // an installer prompt.
  let hasPython3 = false;
  try {
    const probe = spawnSync('python3', ['--version'], { stdio: 'ignore' });
    hasPython3 = probe.status === 0;
    if (hasPython3 && os === 'win32') {
      try {
        const where = spawnSync('where', ['python3'], { encoding: 'utf8' });
        if (where.status === 0 && /WindowsApps[\\/]python3\.exe/i.test(where.stdout || '')) {
          hasPython3 = false;
        }
      } catch (_e) {
        hasPython3 = false;
      }
    }
  } catch (_e) {
    hasPython3 = false;
  }

  // bash probe.
  let hasBashNative = false;
  try {
    const probe = spawnSync('bash', ['--version'], { stdio: 'ignore' });
    hasBashNative = probe.status === 0;
  } catch (_e) {
    hasBashNative = false;
  }

  // Terminal code page (win32 only). On POSIX there is no equivalent
  // concept; LANG governs encoding.
  let codePage = null;
  if (os === 'win32') {
    try {
      const cp = spawnSync('chcp', [], { shell: true, encoding: 'utf8' });
      if (cp.status === 0 && typeof cp.stdout === 'string') {
        const match = cp.stdout.match(/(\d{3,5})/);
        if (match) codePage = parseInt(match[1], 10);
      }
    } catch (_e) {
      codePage = null;
    }
  }

  const supportsUtf8 =
    os !== 'win32' ||
    codePage === 65001 ||
    /UTF-?8/i.test(process.env.LANG || '');

  _cachedPlatform = {
    os,
    shell,
    hasPython3,
    hasBashNative,
    codePage,
    supportsUtf8,
  };
  return _cachedPlatform;
}

/**
 * Read and parse the plugin.json manifest from the given plugin root.
 * Uses Node's native JSON loader so no python3 / jq / shell is involved.
 *
 * @param {string} pluginRoot absolute path to the plugin root directory
 * @returns {object} parsed plugin.json contents
 * @throws if the file is missing or invalid JSON
 */
function readPluginJson(pluginRoot) {
  const abs = path.resolve(pluginRoot, '.claude-plugin', 'plugin.json');
  // Bust the require cache so hot version bumps during a single process
  // lifetime are reflected. Cheap: the file is a few KB.
  delete require.cache[require.resolve(abs)];
  // eslint-disable-next-line global-require, import/no-dynamic-require
  return require(abs);
}

/**
 * Convenience helper. Returns the plugin version string, or the literal
 * 'unknown' on any error. NEVER throws. The banner MUST always render.
 *
 * @param {string} pluginRoot absolute path to the plugin root directory
 * @returns {string} version string or 'unknown'
 */
function getPluginVersion(pluginRoot) {
  try {
    const manifest = readPluginJson(pluginRoot);
    if (manifest && typeof manifest.version === 'string' && manifest.version.length > 0) {
      return manifest.version;
    }
    return 'unknown';
  } catch (_e) {
    return 'unknown';
  }
}

/**
 * Back-compat alias. Plan 85-09 owns scripts/self-update and will define
 * its own helper pattern. Exposed here under the exact name the plan
 * frontmatter calls out for symmetry with getPluginVersion.
 *
 * @param {string} pluginRoot absolute path to the plugin root directory
 * @returns {string} version string or 'unknown'
 */
function readPluginJsonVersion(pluginRoot) {
  return getPluginVersion(pluginRoot);
}

/**
 * Resolve the absolute path to a hook script under scripts/ using the
 * current platform's path separator. On win32 this returns a backslash
 * path; on POSIX, forward slashes. No shell-quoting is applied -- the
 * caller is responsible for escaping when passing to a shell.
 *
 * Consumed by plan 85-06 for cross-platform banner wrapper paths.
 *
 * @param {string} scriptName base name of the script (e.g. 'session-start')
 * @param {string} [pluginRoot] absolute path to the plugin root. Defaults
 *                              to two levels up from this file (lib/core/..).
 * @returns {string} absolute path to the resolved script
 */
function resolveHookScript(scriptName, pluginRoot) {
  const root = pluginRoot || path.resolve(__dirname, '..', '..');
  return path.join(root, 'scripts', scriptName);
}

// ---------------------------------------------------------------------------
// Room runtime resolver (Phase 383, D-03, QA383-01).
//
// scripts/room-registry needs a real bash and a real Python 3.9 or newer. On
// Windows the name `bash` can be the WSL launcher (System32 or WindowsApps) and
// the name `python3` can be the Microsoft Store stub. Both exist on PATH, both
// answer, and neither works. This resolver probes each candidate by running it,
// rejects those two, and records every candidate it tried. It is lazy and
// cached: detectPlatform() runs on the banner path at every session start and
// never calls it.
// ---------------------------------------------------------------------------

const PLAIN_NO_BASH_WIN32 = 'Room creation cannot start on this computer yet.\n  Why: it needs Git Bash, and no working Git Bash was found.\n  Fix: install Git for Windows from git-scm.com, then ask for the room again.';
const PLAIN_NO_BASH_POSIX = 'Room creation cannot start on this computer yet.\n  Why: it needs bash, and no working bash was found.\n  Fix: install bash, then ask for the room again.';
const PLAIN_NO_PYTHON = 'Room creation cannot start on this computer yet.\n  Why: it needs Python 3.9 or newer, and no working Python was found.\n  Fix: install Python 3 from python.org, then ask for the room again.';

const PY_FLOOR_MAJOR = 3;
const PY_FLOOR_MINOR = 9;

/** Replace every backslash with a forward slash (Git Bash reads either, a bash -c string eats backslashes). */
function toBashPath(p) {
  return String(p).replace(/\\/g, '/');
}

function _winKey(p) {
  return toBashPath(p).toLowerCase();
}

// Review WR-02: each probe blocks the event loop (spawnSync), so the per-candidate timeout is short and a
// failed resolution is remembered for a short window instead of being paid again on every retry.
const PROBE_TIMEOUT_MS = 2000;
const NEGATIVE_CACHE_MS = 30000;

function _spawnOpts() {
  return { encoding: 'utf8', timeout: PROBE_TIMEOUT_MS, windowsHide: true };
}

/** The inputs a default-call probe reads, so a cached failure is dropped when the machine setup changes. */
function _envFingerprint(env) {
  return ['PATH', 'Path', 'MINDRIAN_BASH', 'MINDRIAN_PYTHON', 'CLAUDE_CODE_GIT_BASH_PATH']
    .map(function (k) { return String(env[k] || ''); }).join('\u0001');
}

/** One line that names every candidate the resolver tried. */
function formatTried(tried) {
  const list = Array.isArray(tried) ? tried : [];
  const part = function (kind) {
    const items = list
      .filter(function (t) { return t.kind === kind; })
      .map(function (t) { return toBashPath(t.cmd) + ' ' + t.result; });
    return kind + ': ' + (items.length ? items.join(', ') : 'none');
  };
  return part('bash') + '; ' + part('python');
}

function _probeBash(cand, plat, spawn, tried) {
  const r = spawn(cand, ['-c', 'echo $OSTYPE'], _spawnOpts());
  if (r && r.error) {
    const code = r.error.code;
    tried.push({ kind: 'bash', cmd: cand, result: code === 'ENOENT' ? 'not_found' : 'probe_failed', detail: String(r.error.message || code || '') });
    return null;
  }
  if (!r || r.status !== 0) {
    tried.push({ kind: 'bash', cmd: cand, result: 'probe_failed', detail: 'exit ' + (r ? r.status : 'none') });
    return null;
  }
  const ostype = String(r.stdout || '').split(/\r?\n/)[0].trim();
  if (plat === 'win32' && !/^(msys|cygwin)/i.test(ostype)) {
    tried.push({ kind: 'bash', cmd: cand, result: 'rejected_wsl', detail: 'ostype ' + ostype });
    return null;
  }
  tried.push({ kind: 'bash', cmd: cand, result: 'ok', detail: ostype });
  return { path: plat === 'win32' ? toBashPath(cand) : cand, ostype: ostype };
}

function _resolveBash(plat, env, spawn, exists, tried) {
  const seen = {};
  const tryOne = function (cand, fixed) {
    if (!cand) return null;
    if (plat === 'win32') {
      const key = _winKey(cand);
      if (seen[key]) return null;
      seen[key] = true;
      if (/[\\/](system32|windowsapps)[\\/]/i.test(cand)) {
        tried.push({ kind: 'bash', cmd: cand, result: 'rejected_wsl', detail: 'WSL launcher or WindowsApps shim' });
        return null;
      }
      if (fixed && !exists(cand)) {
        tried.push({ kind: 'bash', cmd: cand, result: 'not_found', detail: '' });
        return null;
      }
    }
    return _probeBash(cand, plat, spawn, tried);
  };

  if (plat === 'win32') {
    const pf = env.ProgramFiles || 'C:\\Program Files';
    const pf86 = env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const fixedList = [
      env.MINDRIAN_BASH,
      env.CLAUDE_CODE_GIT_BASH_PATH,
      pf + '\\Git\\bin\\bash.exe',
      pf + '\\Git\\usr\\bin\\bash.exe',
      pf86 + '\\Git\\bin\\bash.exe',
      env.LOCALAPPDATA ? env.LOCALAPPDATA + '\\Programs\\Git\\bin\\bash.exe' : null,
    ];
    for (let i = 0; i < fixedList.length; i += 1) {
      const got = tryOne(fixedList[i], true);
      if (got) return got;
    }
    let lines = [];
    try {
      const w = spawn('where', ['bash'], _spawnOpts());
      if (w && !w.error && w.status === 0) {
        lines = String(w.stdout || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
      }
    } catch (_e) {
      lines = [];
    }
    for (let j = 0; j < lines.length; j += 1) {
      const got = tryOne(lines[j], false);
      if (got) return got;
    }
    return null;
  }

  const posix = [env.MINDRIAN_BASH, 'bash'];
  for (let k = 0; k < posix.length; k += 1) {
    const got = tryOne(posix[k], false);
    if (got) return got;
  }
  return null;
}

function _probePython(cand, plat, spawn, tried) {
  const label = [cand.cmd].concat(cand.pre).join(' ');
  const note = function (result, detail) {
    tried.push({ kind: 'python', cmd: label, result: result, detail: detail || '' });
  };
  const r = spawn(cand.cmd, cand.pre.concat(['--version']), _spawnOpts());
  if (r && r.error) {
    note(r.error.code === 'ENOENT' ? 'not_found' : 'probe_failed', String(r.error.message || r.error.code || ''));
    return null;
  }
  const combined = String((r && r.stdout) || '') + '\n' + String((r && r.stderr) || '');
  if ((r && r.status === 9009) || /Microsoft Store|was not found/i.test(combined)) {
    note('rejected_store_stub', 'Microsoft Store stub');
    return null;
  }
  if (!r || r.status !== 0) {
    note('probe_failed', 'exit ' + (r ? r.status : 'none'));
    return null;
  }
  const m = combined.match(/Python\s+(\d+)\.(\d+)\S*/);
  if (!m) {
    note('probe_failed', 'no version in the answer');
    return null;
  }
  const major = parseInt(m[1], 10);
  const minor = parseInt(m[2], 10);
  const versionLine = m[0].replace(/\s+/g, ' ');
  if (major < PY_FLOOR_MAJOR || (major === PY_FLOOR_MAJOR && minor < PY_FLOOR_MINOR)) {
    note('below_floor', versionLine);
    return null;
  }
  let exePath = cand.cmd;
  if (plat === 'win32') {
    const e = spawn(cand.cmd, cand.pre.concat(['-c', 'import sys;print(sys.executable)']), _spawnOpts());
    const first = e && !e.error && e.status === 0
      ? String(e.stdout || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean)[0]
      : '';
    if (first) {
      exePath = toBashPath(first);
    } else if (cand.cmd === 'py') {
      note('probe_failed', 'py -3 gave no sys.executable');
      return null;
    }
  }
  note('ok', versionLine);
  return { path: exePath, cmd: cand.cmd, pre: cand.pre.slice(), version: major + '.' + minor, version_line: versionLine };
}

function _resolvePython(plat, env, spawn, tried) {
  const cands = [];
  if (env.MINDRIAN_PYTHON) cands.push({ cmd: env.MINDRIAN_PYTHON, pre: [] });
  cands.push({ cmd: 'python3', pre: [] });
  cands.push({ cmd: 'python', pre: [] });
  if (plat === 'win32') cands.push({ cmd: 'py', pre: ['-3'] });
  for (let i = 0; i < cands.length; i += 1) {
    const got = _probePython(cands[i], plat, spawn, tried);
    if (got) return got;
  }
  return null;
}

/**
 * Find a working bash and a working Python 3.9 or newer for scripts/room-registry.
 *
 * A failed result is cached for NEGATIVE_CACHE_MS (default calls only); `refresh: true` always probes again.
 *
 * @param {{platform?: string, env?: object, spawnSync?: Function, existsSync?: Function, refresh?: boolean, now?: number}} [opts]
 * @returns {{ok: boolean, bash: ({path: string, ostype: string}|null),
 *   python: ({path: string, cmd: string, pre: string[], version: string, version_line: string}|null),
 *   tried: Array<{kind: string, cmd: string, result: string, detail: string}>,
 *   reason: (null|'no_bash'|'no_python'), plain: string}}
 */
function resolveRoomRuntime(opts) {
  opts = opts || {};
  const injected = opts.platform !== undefined || opts.env !== undefined ||
    opts.spawnSync !== undefined || opts.existsSync !== undefined;
  if (!injected && !opts.refresh && _cachedRuntime) return _cachedRuntime;
  const now = typeof opts.now === 'number' ? opts.now : Date.now();
  if (!injected && !opts.refresh && _cachedFailure &&
      now - _cachedFailure.at < NEGATIVE_CACHE_MS && _cachedFailure.key === _envFingerprint(process.env)) {
    return _cachedFailure.result;
  }

  const plat = opts.platform || process.platform;
  const env = opts.env || process.env;
  const spawn = opts.spawnSync || spawnSync;
  const exists = opts.existsSync || fs.existsSync;
  const tried = [];

  // Probe both kinds every time so `tried` is complete in the failure report.
  const bash = _resolveBash(plat, env, spawn, exists, tried);
  const python = _resolvePython(plat, env, spawn, tried);

  let reason = null;
  let plain = '';
  if (!bash) {
    reason = 'no_bash';
    plain = plat === 'win32' ? PLAIN_NO_BASH_WIN32 : PLAIN_NO_BASH_POSIX;
  } else if (!python) {
    reason = 'no_python';
    plain = PLAIN_NO_PYTHON;
  }
  const result = { ok: reason === null, bash: bash, python: python, tried: tried, reason: reason, plain: plain };
  if (!injected) {
    if (result.ok) {
      _cachedRuntime = result;
      _cachedFailure = null;
    } else {
      _cachedFailure = { at: now, key: _envFingerprint(env), result: result };
    }
  }
  return result;
}

/**
 * Name the shell hooks/run-hook.cmd would pick on this machine. On win32 this mirrors the
 * wrapper's lookup order exactly: the Program Files Git Bash, the Program Files (x86) Git Bash,
 * then the first `where bash` hit, then a silent exit. Read-only: it checks files and runs
 * `where bash`, it executes no hook (T-383-01). Doctor-only; detectPlatform never calls it.
 *
 * @param {{platform?: string, env?: object, spawnSync?: Function, existsSync?: Function}} [opts]
 * @returns {{path: (string|null), kind: ('git-bash'|'wsl-launcher'|'path-bash'|'none'|'posix'), note?: string}}
 */
function resolveHookShell(opts) {
  opts = opts || {};
  const plat = opts.platform || process.platform;
  if (plat !== 'win32') return { path: 'bash', kind: 'posix' };
  const spawn = opts.spawnSync || spawnSync;
  const exists = opts.existsSync || fs.existsSync;
  const fixed = [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
  ];
  for (let i = 0; i < fixed.length; i += 1) {
    if (exists(fixed[i])) return { path: toBashPath(fixed[i]), kind: 'git-bash' };
  }
  let first = '';
  try {
    const w = spawn('where', ['bash'], _spawnOpts());
    if (w && !w.error && w.status === 0) {
      first = String(w.stdout || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean)[0] || '';
    }
  } catch (_e) {
    first = '';
  }
  if (!first) {
    return { path: null, kind: 'none', note: 'hooks/run-hook.cmd exits 0 and the bash hooks do not run' };
  }
  const kind = /[\\/](system32|windowsapps)[\\/]/i.test(first) ? 'wsl-launcher' : 'path-bash';
  return { path: toBashPath(first), kind: kind };
}

/**
 * The one helper that runs scripts/room-registry. It refuses to spawn when the
 * runtime is not ready. Argv array only, never a shell (T-383-02).
 *
 * @param {string[]} args registry arguments (rooms home first, then the subcommand)
 * @param {{roomsHome?: string, cwd?: string, timeout?: number, env?: object, runtime?: object,
 *   spawnSync?: Function, platform?: string, script?: string}} [opts]
 */
function spawnRoomRegistry(args, opts) {
  opts = opts || {};
  const plat = opts.platform || process.platform;
  const runtime = opts.runtime || resolveRoomRuntime();
  if (!runtime || !runtime.ok) {
    const tried = (runtime && runtime.tried) || [];
    return {
      ok: false,
      out: null,
      stderr: 'room runtime not ready: ' + formatTried(tried),
      status: null,
      python: 'no working Python found (' + formatTried(tried) + ')',
      reason: 'environment_not_ready',
      plain: (runtime && runtime.plain) || '',
      tried: tried,
    };
  }

  const script = opts.script || path.resolve(__dirname, '..', '..', 'scripts', 'room-registry');
  const cwd = opts.cwd || path.resolve(__dirname, '..', '..');
  const timeout = typeof opts.timeout === 'number' ? opts.timeout : 10000;
  const spawn = opts.spawnSync || spawnSync;
  const roomsHome = opts.roomsHome || process.env.MINDRIAN_ROOMS_HOME || path.join(os.homedir(), 'MindrianRooms');
  const argv = [toBashPath(script)].concat((args || []).map(function (a) {
    // A drive path (C:\x) and a UNC path (\\server\share\x) both reach bash with forward slashes only.
    return plat === 'win32' && /^(?:[A-Za-z]:[\\/]|\\\\)/.test(String(a)) ? toBashPath(a) : a;
  }));
  const env = Object.assign({}, process.env, opts.env || {}, {
    MINDRIAN_ROOMS_HOME: plat === 'win32' ? toBashPath(roomsHome) : roomsHome,
    MINDRIAN_PYTHON: runtime.python.path,
  });
  const python = runtime.python.version_line || runtime.python.path;

  const r = spawn(runtime.bash.path, argv, {
    cwd: cwd, env: env, stdio: 'pipe', encoding: 'utf8', timeout: timeout, windowsHide: true,
  });
  if (r && r.error) {
    if (r.error.code === 'ETIMEDOUT') {
      return { ok: false, out: null, stderr: 'room-registry timed out after ' + timeout + ' ms', status: null, python: python, reason: 'timeout', plain: '', tried: runtime.tried || [] };
    }
    return { ok: false, out: null, stderr: 'could not run bash: ' + (r.error.message || r.error.code), status: null, python: python, reason: 'spawn_error', plain: '', tried: runtime.tried || [] };
  }
  if (!r || r.status !== 0) {
    return {
      ok: false,
      out: String((r && r.stdout) || '').trim(),
      stderr: String((r && r.stderr) || ''),
      status: r ? r.status : null,
      python: python,
      reason: 'exit_nonzero',
      plain: '',
      tried: runtime.tried || [],
    };
  }
  return { ok: true, out: String(r.stdout || '').trim(), stderr: '', status: 0, python: '', reason: null, plain: '', tried: runtime.tried || [] };
}

/**
 * Test-only helper. Resets the module-level memoization so tests can
 * exercise detectPlatform() under controlled conditions.
 */
function __resetForTests() {
  _cachedPlatform = null;
  _cachedRuntime = null;
  _cachedFailure = null;
}

/**
 * Open a URL in the user's default browser. Cross-platform dispatch with a
 * STRICT localhost-only guard: non-local URLs are refused.
 *
 * Rationale (R-87-08-B): this helper is used by serve-dashboard-live and
 * similar localhost tooling. Accepting arbitrary URLs here would let a
 * malicious caller invoke a shell command with a URL we did not construct;
 * the guard defense-in-depths against that. Spawn uses an argv array (never
 * exec+template-string) so URL content cannot be interpreted as shell.
 *
 * @param {string} url  Must match http(s)://(127.0.0.1|localhost)(:port)?(/|$)
 * @param {{preferredBrowser?: string}} [opts] reserved for future use
 * @throws {Error} if url is not a localhost URL
 * @returns {void}
 */
function openBrowser(url, opts) {
  opts = opts || {};
  if (typeof url !== 'string' || !url) {
    throw new Error('openBrowser: url must be a non-empty string');
  }
  // R-87-08-B: reject anything that is not 127.0.0.1 or localhost.
  // The trailing group requires a slash OR end-of-string so substrings
  // like "http://localhost.evil.com/" cannot slip through.
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(url)) {
    throw new Error('openBrowser refuses non-localhost URL: ' + url);
  }
  // Test / CI gate (R-87-08-B follow-up): run through the guard above but do
  // NOT actually spawn a browser when any of these env vars are set. This
  // lets dashboard-server.test.cjs exercise the localhost guard without
  // hijacking the developer's browser on every suite run. Activated by any
  // of: MINDRIAN_OPEN_BROWSER_DISABLE=1, MINDRIAN_TEST_MODE=1, CI=1.
  if (
    process.env.MINDRIAN_OPEN_BROWSER_DISABLE === '1' ||
    process.env.MINDRIAN_TEST_MODE === '1' ||
    process.env.CI === '1'
  ) {
    return;
  }
  const { spawn } = require('node:child_process');
  const plat = detectPlatform().os;
  try {
    if (plat === 'darwin') {
      spawn('open', [url], { stdio: 'ignore', detached: true }).unref();
    } else if (plat === 'win32') {
      // `start "" <url>` -- the empty title arg is required by cmd.exe's
      // `start` builtin. URL is already validated as localhost-only.
      spawn('cmd', ['/c', 'start', '""', url], { stdio: 'ignore', detached: true, shell: false }).unref();
    } else {
      spawn('xdg-open', [url], { stdio: 'ignore', detached: true }).unref();
    }
  } catch (err) {
    // Do NOT throw -- the caller has already printed the URL to stderr,
    // so the user can still click / copy it. Surface the failure for debug.
    process.stderr.write('[mindrian-os] openBrowser spawn failed: ' + err.message + '\n');
  }
}

module.exports = {
  detectPlatform,
  readPluginJson,
  readPluginJsonVersion,
  getPluginVersion,
  resolveHookScript,
  openBrowser,
  resolveRoomRuntime,
  resolveHookShell,
  toBashPath,
  spawnRoomRegistry,
  formatTried,
  PLAIN_NO_BASH_WIN32,
  PLAIN_NO_BASH_POSIX,
  PLAIN_NO_PYTHON,
  PROBE_TIMEOUT_MS,
  NEGATIVE_CACHE_MS,
  __resetForTests,
};

// CLI: node lib/core/platform.cjs room-runtime [--json]
if (require.main === module) {
  switch (process.argv[2]) {
    case 'room-runtime': {
      const r = resolveRoomRuntime({ refresh: true });
      process.stdout.write(JSON.stringify(r, null, 2) + '\n');
      if (!r.ok) {
        process.stderr.write(r.plain + '\n');
        process.exitCode = 1;
      }
      break;
    }
    default:
      process.stderr.write('usage: node lib/core/platform.cjs room-runtime [--json]\n');
      process.exitCode = 2;
  }
}
