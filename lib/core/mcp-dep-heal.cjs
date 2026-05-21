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
 * HARD RULE: no em-dashes anywhere in this file (hyphens only).
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  acquireInstallLock,
  releaseInstallLock,
  waitForUnlock,
} = require('./npm-install-lock.cjs');

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
 * @returns {{ ran: boolean, waited: boolean, ok: boolean }}
 */
function runGuardedInstall(dir) {
  const haveLock = acquireInstallLock(dir);

  if (!haveLock) {
    // Another live process is installing. Wait for it, then return without
    // running our own install -- node_modules should now exist.
    const cleared = waitForUnlock(dir);
    return { ran: false, waited: true, ok: cleared };
  }

  try {
    const result = spawnSync(
      'npm',
      ['install', '--no-audit', '--no-fund', '--silent'],
      { cwd: dir, timeout: 120000, stdio: 'ignore' }
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

    const outcome = runGuardedInstall(dir);
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
 * @param {string[]} [opts.probe] - dependency names to stat-check; defaults to
 *                                  the MCP-critical pair.
 * @param {function} [opts.log]
 * @returns {{ healed: boolean, ok: boolean }}
 */
function ensureDepsPresent(opts) {
  opts = opts || {};
  const log = typeof opts.log === 'function' ? opts.log : () => {};
  const dir = resolvePluginRoot(opts.pluginRoot);
  const probe = Array.isArray(opts.probe) && opts.probe.length
    ? opts.probe
    : ['@modelcontextprotocol/sdk', 'zod'];

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
    const outcome = runGuardedInstall(dir);
    log(
      '[mcp-dep-heal] install ' +
        (outcome.waited ? 'waited-for-peer' : 'ran') +
        '; ok=' + outcome.ok
    );
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
};
