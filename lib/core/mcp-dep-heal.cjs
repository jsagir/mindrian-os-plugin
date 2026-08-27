#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * MindrianOS Plugin -- MCP dependency self-heal (Option D, hybrid self-heal).
 *
 * THE PROBLEM (debug session mcp-servers-cache-missing-node-modules):
 * `claude plugin update` lands a fresh plugin cache directory with NO
 * node_modules. The SessionStart reconcile hook (scripts/sessionstart-npm-
 * reconcile.cjs) repairs it -- but on the FIRST post-update session Claude Code
 * spawns the bundled MCP servers (.mcp.json, alwaysLoad) at a moment that can
 * precede the hook's npm install finishing. The servers then crash at module
 * load with MODULE_NOT_FOUND for @modelcontextprotocol/sdk.
 *
 * THE FIX (this module): make each MCP entry point self-sufficient. Each server
 * calls `requireWithHeal(...)` instead of bare `require(...)`. On a
 * MODULE_NOT_FOUND it runs a ONE-SHOT synchronous `npm install` in the plugin
 * cache root, then re-requires. Combined with flipping the reconcile hook to
 * synchronous (async:false) in hooks.json, this closes the race from both ends:
 *   - healthy session: requireWithHeal succeeds first try, near-zero cost.
 *   - first post-update session: the hook usually wins; if it has not, the
 *     server heals itself before connecting its transport.
 *
 * RACE GUARD: both servers can spawn together. npm-install-lock.cjs guarantees
 * exactly one runs `npm install` while the other WAITS, so two concurrent
 * installs never corrupt node_modules.
 *
 * Canon Part 8: zero network surface. The only child process is `npm install`.
 * No Brain calls, no external requests, no user data.
 *
 * Canon Part 7: reuse before build -- this mirrors the detection logic already
 * in scripts/sessionstart-npm-reconcile.cjs (the hook) rather than inventing a
 * new mechanism; it is the same `npm install --no-audit --no-fund --silent`
 * invocation, wrapped for the require-time crash path.
 *
 * CROSS-PLATFORM (escalated mandate 2026-05-21): the npm invocation is resolved
 * through lib/core/npm-cli-resolve.cjs, which runs npm via its absolute
 * npm-cli.js entry off process.execPath -- correct on Windows (no `.cmd`
 * dependency), Mac (no PATH dependency for GUI-launched Claude Code), and Linux.
 * The bare spawnSync('npm') the prior fix used was dead on Windows and fragile
 * on Mac. The self-heal here is the BACKSTOP; the primary guarantee is the
 * vendored production node_modules shipped with the plugin (see CHANGELOG
 * v1.13.0-beta.23) -- on a normal install ensureDepsPresent finds the deps
 * already present and never spawns anything.
 *
 * HARD RULE: no em-dashes anywhere in this file (hyphens only).
 *
 * CONNECT-PATH BUDGET (Phase 266 Plan 03, MCPFIX-03, dated 2026-08-27):
 * Both entry points call ensureDepsPresent() at module load, before the SDK
 * require (bin/mindrian-mcp-server.cjs, bin/mindrian-brain-mcp-client.cjs). On
 * a cold plugin cache this ran a blocking `spawnSync('npm install')` with a
 * 120000 ms internal ceiling -- but Claude Code's own connect timeout for an
 * MCP server is about 30000 ms (CHANGELOG 2.1.242), roughly four times
 * sooner. A 120-second ceiling can therefore never fire usefully on the
 * connect path: the host gives up first and reports the server as failed.
 * Worse, the LOSER of the install-lock race was capped by npm-install-
 * lock.cjs's WAIT_TIMEOUT_MS (200000 ms), so the peer-wait arm could block for
 * over three minutes against a 30-second host clock.
 *
 * REJECTED ALTERNATIVE, evaluated with evidence: answer `initialize` first and
 * heal lazily afterward. Not available without a rewrite -- both entry points
 * require the MCP SDK at module scope immediately after this call
 * (bin/mindrian-mcp-server.cjs:55-56, bin/mindrian-brain-mcp-client.cjs:40-42)
 * and createServer() also runs at module scope, so on the exact failure this
 * heal exists for (a missing @modelcontextprotocol/sdk) there is no server
 * object capable of answering `initialize` at all. Deferring the heal would
 * just move the crash later, not fix it. The deeper fix -- decoupling
 * transport connect from dependency resolution entirely -- is a follow-up for
 * a later phase, not work for this one.
 *
 * THE FIX HERE: cap the connect path (CONNECT_PATH_BUDGET_MS, 15000 ms) well
 * under the host's ~30000 ms window and fail gracefully -- a bounded return
 * plus one clear stderr breadcrumb, never a hang. Both arms of the install
 * race are bounded by the same budget on the connect path: the install arm
 * via spawnSync's own `timeout`, and the peer-wait arm via a per-call
 * `timeoutMs` override threaded into npm-install-lock.cjs's waitForUnlock.
 * The hook path (scripts/sessionstart-npm-reconcile.cjs, via
 * runGuardedInstall with no opts) is untouched and keeps its full
 * DEFAULT_INSTALL_TIMEOUT_MS (120000 ms): a SessionStart hook has no host
 * connect clock, and shortening it would reintroduce the very race this
 * whole subsystem exists to close.
 *
 * THE BUDGET ARITHMETIC (do not re-derive this, read it here):
 *   - Host MCP connect timeout:            ~30000 ms (CHANGELOG 2.1.242)
 *   - Connect-path heal budget:             15000 ms (this file) -- leaves
 *     ~15000 ms for module load, tool/resource/prompt registration, and
 *     answering initialize.
 *   - Hook-path install timeout (unchanged): 120000 ms -- used by
 *     scripts/sessionstart-npm-reconcile.cjs.
 *   - Lock STALE_THRESHOLD_MS (unchanged):   180000 ms (npm-install-lock.cjs)
 *     -- must stay strictly above the hook-path install timeout.
 *   - Lock WAIT_TIMEOUT_MS default (unchanged): 200000 ms -- must stay
 *     strictly above STALE_THRESHOLD_MS.
 * 15000 sits comfortably below STALE_THRESHOLD_MS (180000), so a connect-path
 * process always releases its lock long before any peer could consider
 * reclaiming it -- the bug_001 invariant chain (install timeout < STALE <
 * WAIT) is preserved by lowering only the connect path, never the defaults.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  acquireInstallLock,
  releaseInstallLock,
  waitForUnlock,
} = require('./npm-install-lock.cjs');
const { resolveNpmCli, buildInstallArgs } = require('./npm-cli-resolve.cjs');

// Phase 266 Plan 03 (MCPFIX-03): see the module header for the full budget
// arithmetic. DEFAULT_INSTALL_TIMEOUT_MS is the pre-existing hook-path
// budget (unchanged in value, now named); CONNECT_PATH_BUDGET_MS is the new,
// much tighter budget for the two MCP entry points, which are answering a
// host that is already counting down its own ~30000 ms connect timeout
// (CHANGELOG 2.1.242). 15000 sits well under that host window AND well under
// the lock's 180000 ms STALE_THRESHOLD_MS, so the bug_001 invariant chain
// (install timeout < STALE < WAIT) stays intact.
const DEFAULT_INSTALL_TIMEOUT_MS = 120000;
const CONNECT_PATH_BUDGET_MS = 15000;

/**
 * Resolve the plugin cache root the install must run in. CLAUDE_PLUGIN_ROOT is
 * set by Claude Code when it spawns plugin processes; the __dirname fallback
 * (lib/core -> plugin root) covers manual / test invocation.
 *
 * @param {string} [fallbackDir] - explicit override (used by callers / tests)
 * @returns {string}
 */
function resolvePluginRoot(fallbackDir) {
  return (
    process.env.CLAUDE_PLUGIN_ROOT ||
    process.env.MINDRIAN_OS_ROOT ||
    fallbackDir ||
    path.resolve(__dirname, '..', '..')
  );
}

/**
 * Run `npm install` once in `dir`, guarded so two racing servers cannot run it
 * concurrently. The loser waits for the winner instead.
 *
 * @param {string} dir
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs] - budget for BOTH arms of the race: the
 *   spawnSync `timeout` on the install-owner arm, and the waitForUnlock
 *   `timeoutMs` on the peer-wait arm. Defaults to DEFAULT_INSTALL_TIMEOUT_MS
 *   (120000 ms, the hook-path budget). Phase 266 MCPFIX-03: before this fix
 *   only the install arm was bounded and the wait arm could run the full
 *   200000 ms WAIT_TIMEOUT_MS regardless of the caller's own budget.
 * @returns {{ ran: boolean, waited: boolean, ok: boolean }}
 */
function runGuardedInstall(dir, opts) {
  opts = opts || {};
  const timeoutMs = (typeof opts.timeoutMs === 'number' && isFinite(opts.timeoutMs) && opts.timeoutMs > 0)
    ? opts.timeoutMs
    : DEFAULT_INSTALL_TIMEOUT_MS;
  const haveLock = acquireInstallLock(dir);

  if (!haveLock) {
    // Another live process is installing. Wait for it, then return without
    // running our own install -- node_modules should now exist. Bounded by
    // the SAME budget as the install arm, so a connect-path caller never
    // sits longer than it told us it could afford.
    const cleared = waitForUnlock(dir, { timeoutMs });
    return { ran: false, waited: true, ok: cleared };
  }

  try {
    // Portable npm resolution: run npm via its absolute npm-cli.js off the
    // current node binary (process.execPath). This is correct on Windows
    // (no `.cmd` extension dependency), Mac (no PATH dependency), and Linux.
    const npm = resolveNpmCli();
    const result = spawnSync(
      npm.command,
      buildInstallArgs(npm),
      { cwd: dir, timeout: timeoutMs, stdio: 'ignore', shell: npm.shell }
    );
    const ok = !!result && result.status === 0;
    return { ran: true, waited: false, ok };
  } catch (_) {
    return { ran: true, waited: false, ok: false };
  } finally {
    releaseInstallLock(dir);
  }
}

/**
 * require() a module; on MODULE_NOT_FOUND, run a one-shot guarded `npm install`
 * in the plugin cache root and retry exactly once.
 *
 * Any non-MODULE_NOT_FOUND error is re-thrown immediately (a real bug, not a
 * missing-dependency situation -- healing would not help).
 *
 * @param {string} moduleId   - the module specifier to require
 * @param {object} [opts]
 * @param {string} [opts.pluginRoot] - explicit plugin cache root override
 * @param {function} [opts.log]      - sink for a one-line stderr breadcrumb
 * @param {boolean} [opts.connectPath] - true when this require runs on the
 *   MCP connect path (a host is already counting down its own connect
 *   timeout). Bounds the backstop install to CONNECT_PATH_BUDGET_MS instead
 *   of the full DEFAULT_INSTALL_TIMEOUT_MS.
 * @returns {*} the required module
 */
function requireWithHeal(moduleId, opts) {
  opts = opts || {};
  const log = typeof opts.log === 'function' ? opts.log : () => {};
  try {
    return require(moduleId);
  } catch (err) {
    if (!err || err.code !== 'MODULE_NOT_FOUND') throw err;

    const dir = resolvePluginRoot(opts.pluginRoot);
    log('[mcp-dep-heal] missing dependency for ' + moduleId + '; self-healing npm install in ' + dir);

    const outcome = runGuardedInstall(dir, opts.connectPath ? { timeoutMs: CONNECT_PATH_BUDGET_MS } : undefined);
    log(
      '[mcp-dep-heal] install ' +
        (outcome.waited ? 'waited-for-peer' : outcome.ran ? 'ran' : 'skipped') +
        '; ok=' + outcome.ok
    );

    // Retry the require. If the peer-install or our own install succeeded the
    // module now resolves. If it still fails, the error propagates -- the
    // server crashes with a clear MODULE_NOT_FOUND, exactly as before, and the
    // SessionStart reconcile hook is the remaining safety net for next session.
    return require(moduleId);
  }
}

/**
 * The full production dependency set the plugin requires at runtime, read from
 * the plugin's own package.json. This is the bug_011 fix: a probe limited to
 * just ['@modelcontextprotocol/sdk', 'zod'] passes on a PARTIALLY-populated
 * node_modules (sdk + zod present, @modelcontextprotocol/ext-apps or another
 * dep absent), no heal runs, then a bare `require` deeper in the lib/mcp/*
 * chain (capability-registry.cjs -> app-views.cjs -> ext-apps/server) throws
 * MODULE_NOT_FOUND at module-init scope and crashes the server. Probing the
 * full `dependencies` set -- exactly as scripts/sessionstart-npm-reconcile.cjs
 * already does -- catches an incomplete tree before any require runs.
 *
 * Defensive: a missing or unreadable package.json yields the MCP-critical pair
 * as a fallback rather than crashing -- the heal pre-flight must never throw.
 *
 * @param {string} dir - resolved plugin cache root
 * @returns {string[]} dependency names to stat-check
 */
function productionDepNames(dir) {
  const fallback = ['@modelcontextprotocol/sdk', 'zod'];
  try {
    const pkgPath = path.join(dir, 'package.json');
    if (!fs.existsSync(pkgPath)) return fallback;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const names = Object.keys(pkg.dependencies || {});
    return names.length ? names : fallback;
  } catch (_) {
    // Unreadable / unparseable package.json -- fall back gracefully.
    return fallback;
  }
}

/**
 * Heal the plugin's node_modules up front, BEFORE any dependency require runs.
 * Cheap pre-flight: a few stat() calls on a healthy box, the guarded install
 * only on a genuinely-missing cache.
 *
 * MCP entry points call this once at the very top so the subsequent SDK / zod
 * requires are guaranteed to resolve. Idempotent and defensive: any error is
 * swallowed (the per-require requireWithHeal path remains as a second net).
 *
 * @param {object} [opts]
 * @param {string}   [opts.pluginRoot]
 * @param {string[]} [opts.probe] - explicit dependency names to stat-check.
 *                                  When omitted, defaults to the FULL
 *                                  production dependency set from the plugin's
 *                                  package.json (bug_011) so a partially
 *                                  populated node_modules is detected, not just
 *                                  a totally absent one.
 * @param {function} [opts.log]
 * @param {boolean} [opts.connectPath] - Phase 266 MCPFIX-03: true when this
 *   call runs on the MCP connect path, before the host's ~30000 ms connect
 *   timeout (CHANGELOG 2.1.242) elapses. Bounds the heal to
 *   CONNECT_PATH_BUDGET_MS instead of the full DEFAULT_INSTALL_TIMEOUT_MS,
 *   and emits one clear stderr breadcrumb if the heal cannot finish inside
 *   that window -- the SessionStart reconcile hook (no host clock) remains
 *   the backstop that completes the install before the next session.
 * @returns {{ healed: boolean, ok: boolean }}
 */
function ensureDepsPresent(opts) {
  opts = opts || {};
  const log = typeof opts.log === 'function' ? opts.log : () => {};
  const dir = resolvePluginRoot(opts.pluginRoot);
  const probe = Array.isArray(opts.probe) && opts.probe.length
    ? opts.probe
    : productionDepNames(dir);
  const connectPath = !!opts.connectPath;

  try {
    const nm = path.join(dir, 'node_modules');
    let missing = false;
    if (!fs.existsSync(nm)) {
      missing = true;
    } else {
      for (const dep of probe) {
        if (!fs.existsSync(path.join(nm, ...dep.split('/')))) { missing = true; break; }
      }
    }
    if (!missing) return { healed: false, ok: true };

    log('[mcp-dep-heal] node_modules missing/incomplete; self-healing npm install in ' + dir);
    const outcome = runGuardedInstall(dir, connectPath ? { timeoutMs: CONNECT_PATH_BUDGET_MS } : undefined);
    log(
      '[mcp-dep-heal] install ' +
        (outcome.waited ? 'waited-for-peer' : 'ran') +
        '; ok=' + outcome.ok
    );
    if (connectPath && !outcome.ok) {
      log(
        '[mcp-dep-heal] connect-path heal did not finish inside ' + CONNECT_PATH_BUDGET_MS +
          'ms (the host\'s connect window); the SessionStart reconcile hook will complete it before the next session'
      );
    }
    return { healed: true, ok: outcome.ok };
  } catch (_) {
    // Never let the heal pre-flight itself crash the server -- requireWithHeal
    // is the backstop.
    return { healed: false, ok: false };
  }
}

module.exports = {
  requireWithHeal,
  ensureDepsPresent,
  runGuardedInstall,
  resolvePluginRoot,
  productionDepNames,
  DEFAULT_INSTALL_TIMEOUT_MS,
  CONNECT_PATH_BUDGET_MS,
};
