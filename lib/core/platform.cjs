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

let _cachedPlatform = null;

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

/**
 * Test-only helper. Resets the module-level memoization so tests can
 * exercise detectPlatform() under controlled conditions.
 */
function __resetForTests() {
  _cachedPlatform = null;
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
  __resetForTests,
};
