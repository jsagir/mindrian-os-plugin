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
 *   - Connect-path heal budget:             15000 ms (this file) -- a
 *     PER-PROCESS ceiling (Phase 266 Plan 05, see below) spanning EVERY
 *     connect-path heal call an entry point makes, not a per-call number --
 *     leaves ~15000 ms for module load, tool/resource/prompt registration,
 *     and answering initialize.
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
 *
 * PHASE 266 PLAN 05 (MCPFIX-03 gap closure, dated 2026-08-27): 266-VERIFICATION.md
 * Truth #5 found the budget above enforced PER-CALL, not per-process. Both
 * entry points make FOUR connect-path heal calls in sequence at module scope
 * before either can answer `initialize`, and nothing threaded a shared
 * deadline across them -- each call independently got its own fresh 15000 ms
 * clock. The verifier reproduced this against the real, unmodified functions:
 * call1=15081ms, call2=15066ms, call3=15068ms, call4=15081ms,
 * cumulative=60296ms, roughly DOUBLE the ~30000 ms host connect timeout the
 * budget exists to respect.
 *
 * THE FIX: `beginConnectPathBudget()` arms ONE process-wide deadline, called
 * once per process by each entry point at module scope, before its first
 * connect-path heal call. Every connect-path heal call (in requireWithHeal
 * and ensureDepsPresent below) now consults `connectPathRemainingMs()`
 * instead of passing a fresh `CONNECT_PATH_BUDGET_MS` literal. Once the
 * remaining budget drops below `CONNECT_PATH_MIN_ATTEMPT_MS` (250 ms), the
 * call short-circuits: no new guarded install, no fresh peer-wait,
 * requireWithHeal re-throws the ORIGINAL MODULE_NOT_FOUND immediately and
 * ensureDepsPresent returns `{ healed: false, ok: false, budgetExhausted: true }`
 * before attempting anything.
 *
 * WHY A MODULE-SCOPED DEADLINE INSTEAD OF THREADING `timeoutMs` FROM EACH
 * CALL SITE: the fourth connect-path call site in bin/mindrian-mcp-server.cjs
 * (the lazy `zod` requireWithHeal) is NOT at module scope -- it lives inside
 * the `createServer()` factory, which the flag-ON multi-session HTTP branch
 * re-invokes per session. A call-site-threaded closure would have to be
 * plumbed into that factory, and a stale `budgetFor()` returning 0 on a later
 * session would hit `runGuardedInstall`'s `opts.timeoutMs > 0` guard and
 * silently fall back to the full 120000 ms `DEFAULT_INSTALL_TIMEOUT_MS`,
 * restoring a 120-second block mid-session. A module-scoped deadline reaches
 * the nested call with no plumbing, keeps the arithmetic in ONE place with
 * ONE test surface (tests/test-266-connect-path-process-budget.cjs), and
 * makes a later per-session `createServer()` correctly inherit the
 * already-spent deadline: a live process serving sessions must never block a
 * session on an npm install.
 *
 * PHASE 369.1 PLAN 06 (D-14, dated 2026-10-04): every self-install now runs
 * `npm ci --ignore-scripts --no-audit --no-fund` whenever npm-shrinkwrap.json
 * exists in the plugin root: the same flags the Claude Code loader uses
 * (frozen resolution, no lifecycle scripts). sharp's install script is
 * exactly why scripts stay off; the loader never runs them, neither do we.
 * Without a lockfile the `npm install --ignore-scripts --no-audit --no-fund
 * --silent` form stays (369.1-REVIEW WR-02: scripts stay off on every form). Outcomes now carry a `reason` (null, 'npm-not-found',
 * 'timeout', 'exit-<code>') so the in-band responder can say what happened.
 * A timed-out foreground npm is killed with SIGKILL: SIGTERM lets a real
 * `npm ci` clean up slowly and spawnSync then blocks past the host's connect
 * window. On the connect path a missing dependency set starts ONE detached
 * installer (dep-install-detached.cjs) that holds the install lock under its
 * own 600 s ceiling (369.1-REVIEW WR-06) and is NEVER killed at the connect budget: killing a
 * half-done `npm ci` and restarting it later doubles the cost on a slow
 * Cowork VM (RESEARCH A12). The entry waits for it only up to the remaining
 * process-wide budget, then serves the responder (mcp-install-responder.cjs).
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const {
  acquireInstallLock,
  releaseInstallLock,
  waitForUnlock,
  readLock,
  pidAlive,
  isReclaimable,
  LOCK_FILENAME,
} = require('./npm-install-lock.cjs');
const { resolveNpmCli, buildInstallArgs } = require('./npm-cli-resolve.cjs');
const {
  statusFilePath,
  readStatus,
  writeStatusFile,
  installRunning,
  installInterrupted,
} = require('./dep-install-status.cjs');

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

// 369.1-REVIEW WR-06: the detached installer is "never killed at the connect budget" so a slow
// Cowork VM can finish; it used to inherit the 120 s hook budget and SIGKILL npm mid-extraction
// on exactly those machines, then start again from zero and be killed again. It now has its own,
// much larger, ceiling: a sane upper bound for a genuinely hung npm, not a connect clock. It
// sits below the install-status staleness window (660000 ms) and the lock's absolute ceiling.
const DETACHED_INSTALL_TIMEOUT_MS = 600000;

/** The detached installer's ceiling; MINDRIAN_TEST_DETACHED_TIMEOUT_MS overrides it only under MINDRIAN_TEST_MODE=1. */
function detachedInstallTimeoutMs() {
  if (process.env.MINDRIAN_TEST_MODE === '1') {
    const t = Number.parseInt(process.env.MINDRIAN_TEST_DETACHED_TIMEOUT_MS || '', 10);
    if (Number.isFinite(t) && t > 0) return t;
  }
  return DETACHED_INSTALL_TIMEOUT_MS;
}

// Phase 266 Plan 05 (MCPFIX-03 gap closure): the floor below which starting a
// guarded install or a peer-wait is pointless, so the call short-circuits
// instead. Grounded in npm-install-lock.cjs's POLL_INTERVAL_MS (200 ms): a
// wait shorter than one poll cycle cannot observe anything, and a spawnSync
// npm install killed under 250 ms is guaranteed to leave the partial
// node_modules tree 266-REVIEW.md WR-03 already warns about. Starting either
// arm below the floor is strictly worse than skipping it.
const CONNECT_PATH_MIN_ATTEMPT_MS = 250;

// The ONE process-wide connect-path deadline (epoch ms). null = not armed
// yet. Set by beginConnectPathBudget(), consulted by connectPathRemainingMs().
let connectPathDeadlineAt = null;

/**
 * Arm the ONE process-wide connect-path deadline. Called once per process by
 * each MCP entry point at module scope, before its first connect-path heal
 * call. Idempotent: a second call is a no-op unless `opts.force === true`, so
 * an entry point cannot accidentally extend its own budget by calling this
 * more than once (and a later per-session createServer() re-invocation in the
 * flag-ON multi-session HTTP branch correctly inherits the already-armed, and
 * possibly already-spent, deadline rather than resetting it).
 *
 * `opts.budgetMs` and `opts.force` exist for tests only; production callers
 * pass nothing.
 *
 * @param {object} [opts]
 * @param {number} [opts.budgetMs] - override for CONNECT_PATH_BUDGET_MS (tests only)
 * @param {boolean} [opts.force]   - re-arm even if already armed (tests only)
 * @returns {number} the absolute deadline, epoch ms
 */
function beginConnectPathBudget(opts) {
  opts = opts || {};
  let budgetMs = (typeof opts.budgetMs === 'number' && isFinite(opts.budgetMs) && opts.budgetMs > 0)
    ? opts.budgetMs
    : CONNECT_PATH_BUDGET_MS;
  // Test-only seam (369.1-06): inert unless MINDRIAN_TEST_MODE === '1'.
  if (!(typeof opts.budgetMs === 'number' && opts.budgetMs > 0) &&
      process.env.MINDRIAN_TEST_MODE === '1') {
    const t = Number.parseInt(process.env.MINDRIAN_TEST_CONNECT_BUDGET_MS || '', 10);
    if (Number.isFinite(t) && t > 0) budgetMs = t;
  }
  if (connectPathDeadlineAt === null || opts.force === true) {
    connectPathDeadlineAt = Date.now() + budgetMs;
  }
  return connectPathDeadlineAt;
}

/**
 * Milliseconds remaining on the process-wide connect-path deadline. Auto-arms
 * with the default budget if nothing has armed it yet, so a connect-path
 * caller can never accidentally run unbudgeted.
 *
 * @returns {number} >= 0
 */
function connectPathRemainingMs() {
  if (connectPathDeadlineAt === null) beginConnectPathBudget();
  return Math.max(0, connectPathDeadlineAt - Date.now());
}

// The directory THIS file lives in (lib/core -> plugin root). require() resolves packages against
// the real location of the running code, so this is the only root an install can ever help.
const OWN_ROOT = path.resolve(__dirname, '..', '..');
let warnedEnvRoot = false;

function sameDirectory(a, b) {
  try {
    return fs.realpathSync(a) === fs.realpathSync(b);
  } catch (_) {
    return path.resolve(a) === path.resolve(b);
  }
}

/**
 * Resolve the plugin root the install must run in: the directory the running file
 * lives in (369.1-REVIEW WR-01). CLAUDE_PLUGIN_ROOT and MINDRIAN_OS_ROOT used to win,
 * but they are environment, and on a surface that does not export them to MCP
 * children (or on a machine whose ~/.claude/settings.json points MINDRIAN_OS_ROOT at a
 * dev clone) they name a different tree than the one `require` resolves against: the
 * install then wiped the clone's node_modules while the real cache stayed empty. An
 * environment root is honoured only when it is the same directory (a symlinked
 * spelling of it); any other value is ignored and logged once.
 *
 * @param {string} [fallbackDir] - an explicit override from the calling code (not the environment)
 * @returns {string}
 */
function resolvePluginRoot(fallbackDir) {
  if (fallbackDir) return path.resolve(String(fallbackDir));
  const env = process.env.CLAUDE_PLUGIN_ROOT || process.env.MINDRIAN_OS_ROOT;
  if (env && !warnedEnvRoot && !sameDirectory(env, OWN_ROOT)) {
    warnedEnvRoot = true;
    try {
      process.stderr.write('[mcp-dep-heal] ignoring the environment plugin root ' + env +
        ' (it is not the directory this code lives in); using ' + OWN_ROOT + '\n');
    } catch (_) { /* stderr gone */ }
  }
  return OWN_ROOT;
}

/**
 * Classify a failed spawnSync result into the reason the responder reports.
 * @param {object} result - spawnSync result
 * @returns {string} 'npm-not-found' | 'timeout' | 'exit-<code>'
 */
function installReason(result) {
  if (!result) return 'exit-1';
  if (result.error && result.error.code === 'ENOENT') return 'npm-not-found';
  if ((result.error && result.error.code === 'ETIMEDOUT') || result.signal) return 'timeout';
  return 'exit-' + (typeof result.status === 'number' ? result.status : 1);
}

/** Remove node_modules under dir; never throws. */
function removeNodeModules(dir) {
  try { fs.rmSync(path.join(dir, 'node_modules'), { recursive: true, force: true }); } catch (_) { /* best effort */ }
}

/**
 * After a successful in-process install, a record left over from an interrupted or
 * failed attempt must stop distrusting the (now complete) tree. A record that is
 * running (the detached installer's own) is never touched here: its owner settles it.
 */
function settleStatusAfterInstall(dir, prior) {
  try {
    if (!prior) return;
    const interrupted = installInterrupted(prior);
    if (interrupted || prior.state === 'failed' || prior.state === 'npm-not-found') {
      const now = new Date().toISOString();
      writeStatusFile(dir, { state: 'done', reason: null, pid: process.pid, startedAt: now, finishedAt: now });
    }
  } catch (_) { /* the install itself succeeded */ }
}

/**
 * Run `npm install` once in `dir`, guarded so two racing servers cannot run it
 * concurrently. The loser waits for the winner instead.
 *
 * @param {string} dir
 * @param {object} [opts]
 * @param {boolean} [opts.cleanTree] - remove node_modules after taking the lock, before npm
 *   runs (369.1-REVIEW CR-02: the detached installer sets it when it claimed over an
 *   interrupted record). An interrupted record found here also triggers the removal.
 * @param {number} [opts.timeoutMs] - budget for BOTH arms of the race: the
 *   spawnSync `timeout` on the install-owner arm, and the waitForUnlock
 *   `timeoutMs` on the peer-wait arm. Defaults to DEFAULT_INSTALL_TIMEOUT_MS
 *   (120000 ms, the hook-path budget). Phase 266 MCPFIX-03: before this fix
 *   only the install arm was bounded and the wait arm could run the full
 *   200000 ms WAIT_TIMEOUT_MS regardless of the caller's own budget.
 * @returns {{ ran: boolean, waited: boolean, ok: boolean, reason: (string|null) }}
 *   reason: null on success, 'npm-not-found' (ENOENT), 'timeout', or 'exit-<code>'.
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
    return { ran: false, waited: true, ok: cleared, reason: cleared ? null : 'timeout' };
  }

  try {
    // 369.1-REVIEW CR-02: an install that started and never finished (the record says
    // "installing" but nothing is running) built the tree that is on disk. Remove it
    // first, so a partial tree can never pass the presence probe again. We hold the
    // install lock, so nobody else is extracting into it.
    const prior = readStatus(dir);
    if (opts.cleanTree === true || installInterrupted(prior)) removeNodeModules(dir);

    // Portable npm resolution: run npm via its absolute npm-cli.js off the
    // current node binary (process.execPath). This is correct on Windows
    // (no `.cmd` extension dependency), Mac (no PATH dependency), and Linux.
    const npm = resolveNpmCli();
    const frozen = fs.existsSync(path.join(dir, 'npm-shrinkwrap.json'));
    const result = spawnSync(
      npm.command,
      buildInstallArgs(npm, undefined, { frozen }),
      { cwd: dir, timeout: timeoutMs, killSignal: 'SIGKILL', stdio: 'ignore', shell: npm.shell }
    );
    const ok = !!result && result.status === 0;
    if (ok) settleStatusAfterInstall(dir, prior);
    // 369.1-REVIEW WR-06: npm ran and did not finish cleanly (a non-zero exit, a timeout): the
    // tree it was building is partial. Remove it so no later probe can trust it. A missing npm
    // (ENOENT) never started, so nothing it could have broken is deleted.
    else if (result && !(result.error && result.error.code === 'ENOENT')) removeNodeModules(dir);
    return { ran: true, waited: false, ok, reason: ok ? null : installReason(result) };
  } catch (_) {
    return { ran: true, waited: false, ok: false, reason: 'exit-1' };
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
 *   timeout). The backstop install is then the detached installer, waited on
 *   for at most the remaining process-wide budget and never killed; when it is
 *   not finished in time this throws an error with code MINDRIAN_INSTALL_PENDING
 *   (369.1-REVIEW CR-03) that the entry points turn into an in-band answer.
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

    // Phase 266 Plan 05 (MCPFIX-03 gap closure): check the shared process-wide
    // budget BEFORE announcing a heal attempt. On the connect path, once the
    // budget is spent, short-circuit here -- propagate the ORIGINAL
    // MODULE_NOT_FOUND immediately, with NO new guarded install and NO retry
    // require. This is what keeps the fourth call site (the nested `zod`
    // require inside createServer()) from starting its own fresh install once
    // an earlier call has already spent the process's whole connect budget.
    if (opts.connectPath) {
      const remainingMs = connectPathRemainingMs();
      if (remainingMs < CONNECT_PATH_MIN_ATTEMPT_MS) {
        log(
          '[mcp-dep-heal] connect-path budget spent (' + CONNECT_PATH_BUDGET_MS +
            'ms process-wide, ' + remainingMs + 'ms left); skipping the install for ' +
            moduleId + ' and failing fast'
        );
        throw err;
      }
      // 369.1-REVIEW CR-03 (D-14): NEVER an in-process `npm ci` on the connect path. A cold
      // install takes 17 to 26 s against a budget of at most 15 s, so a blocking spawnSync
      // killed at the budget leaves exactly the half-installed tree CR-02 distrusts. The
      // install is the detached installer, waited on (never killed) for the remaining
      // budget; when it is not done in time the entry gets a typed error and answers in
      // band through the responder instead of crashing at the host's connect window.
      log('[mcp-dep-heal] missing dependency for ' + moduleId + '; self-healing npm install (detached installer) in ' + dir);
      const r = connectPathInstall(dir, productionDepNames(dir), log, { force: true });
      log('[mcp-dep-heal] detached install ' + (r.ok ? 'finished' : 'not finished (' + r.reason + ')') + ' for ' + moduleId);
      if (!r.ok) throw installPendingError(r.reason, err);
      return require(moduleId);
    }

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
 * Defensive: a missing or unreadable package.json yields the MCP-critical
 * fallback set rather than crashing -- the heal pre-flight must never throw.
 * Phase 267 Plan 05 (canary): the fallback gained
 * '@modelcontextprotocol/server', because the brain stdio shim now resolves
 * McpServer/serveStdio from the split v2 package instead of the v1
 * '@modelcontextprotocol/sdk' monolith. Phase 267 Plan 17 removed the v1
 * monolith as a dependency, so the fallback is now exactly
 * ['@modelcontextprotocol/server', 'zod'].
 *
 * @param {string} dir - resolved plugin cache root
 * @returns {string[]} dependency names to stat-check
 */
function productionDepNames(dir) {
  const fallback = ['@modelcontextprotocol/server', 'zod'];
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

/** Portable synchronous short sleep (the connect path runs at module scope, so it cannot await). */
function sleepSync(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch (_) {
    const until = Date.now() + ms;
    while (Date.now() < until) { /* spin */ }
  }
}

/** True when every probed dependency directory exists under dir/node_modules. */
function depsPresent(dir, probe) {
  const nm = path.join(dir, 'node_modules');
  if (!fs.existsSync(nm)) return false;
  for (const dep of probe) {
    if (!fs.existsSync(path.join(nm, ...dep.split('/')))) return false;
  }
  return true;
}

/**
 * Can the node_modules under dir be trusted? Every probed dependency directory
 * exists AND no install that started has failed to finish (369.1-REVIEW CR-02).
 * An interrupted `npm ci` leaves every top-level dependency directory present,
 * so the presence probe alone passes on a half-installed tree; a record that
 * says "installing" with no finishedAt, whether its installer is alive, dead or
 * long gone, means the tree on disk is unfinished.
 *
 * @param {string} dir
 * @param {string[]} probe
 * @returns {boolean}
 */
function treeTrusted(dir, probe) {
  if (!depsPresent(dir, probe)) return false;
  const st = readStatus(dir);
  if (st && st.state === 'installing' && !st.finishedAt) return false;
  return true;
}

/**
 * Is an install running for this plugin root right now? Two signals, either one
 * is enough: the status file says installing with a live pid and no finishedAt,
 * or the install lock is held by a live pid. node_modules cannot be trusted
 * while this is true: an interrupted `npm ci` leaves every top-level dependency
 * directory present, so the presence probe alone passes on a half-installed tree
 * and the next require crashes (369.1-03 finding 2).
 *
 * @param {string} dir
 * @returns {{ inFlight: boolean, pid: (number|null) }}
 */
function installInFlight(dir) {
  try {
    const st = readStatus(dir);
    // installRunning: a live pid AND a valid, fresh start time (a planted or recycled-pid
    // record can never pin the self-install, 369.1-REVIEW CR-01 / WR-04).
    if (installRunning(st)) return { inFlight: true, pid: st.pid };
  } catch (_) { /* fall through to the lock signal */ }
  try {
    const lp = path.join(dir, LOCK_FILENAME);
    if (fs.existsSync(lp)) {
      const data = readLock(lp);
      // isReclaimable adds the absolute age ceiling: a lock older than any install can run is
      // abandoned even when its pid was recycled by a live stranger (369.1-REVIEW WR-04).
      if (data && data !== 'EMPTY' && pidAlive(data.pid) && !isReclaimable(data)) return { inFlight: true, pid: data.pid };
    }
  } catch (_) { /* no lock signal */ }
  return { inFlight: false, pid: null };
}

// 369.1-REVIEW WR-03: after a failed install (offline, a registry error) the next connect must not
// respawn a detached `npm ci` (which wipes node_modules first) on every start, two servers per
// session, forever. A failed record backs the retry off: one minute after the first failure,
// doubling per consecutive failure, capped at fifteen minutes. A missing npm is not backed off:
// the retry is a cheap spawn failure and the user may have installed Node since.
const FAILED_BACKOFF_BASE_MS = 60000;
const FAILED_BACKOFF_MAX_MS = 15 * 60000;

function failedBackoffMs(attempts) {
  const n = Math.max(1, Number.isInteger(attempts) ? attempts : 1);
  return Math.min(FAILED_BACKOFF_MAX_MS, FAILED_BACKOFF_BASE_MS * Math.pow(2, Math.min(n, 30) - 1));
}

/** Record that the installer could not even be started: failed, never "installing". */
function recordSpawnFailure(dir, prior) {
  try {
    const now = new Date().toISOString();
    const attempts = (prior && prior.state === 'failed' ? prior.attempts : 0) + 1;
    writeStatusFile(dir, { state: 'failed', reason: 'spawn-failed', pid: null, startedAt: now, finishedAt: now, attempts });
  } catch (_) { /* the caller still reports spawn-failed */ }
}

/**
 * Start ONE detached installer (lib/core/dep-install-detached.cjs) for `dir`,
 * unless an install is already running (a live installer in the status file or
 * a live lock holder), or the last attempt failed so recently that it is still
 * backing off (WR-03), in which case nothing is started. The child holds the
 * install lock with its own ceiling and is NEVER killed by the caller: a slow
 * machine (a Cowork VM) finishes the install for the next task instead of
 * restarting it (RESEARCH A12). Two servers racing here is safe: the child
 * claims the status file atomically and the loser exits.
 *
 * @param {string} dir - plugin root
 * @returns {{ started: boolean, pid: (number|null), statusFile: string, reason?: string, backoff?: boolean }}
 *   `reason` is set when nothing was started and the answer is already known: the stored
 *   reason of a backed-off failure, or 'spawn-failed' when the child never came up.
 */
function startDetachedInstall(dir) {
  const statusFile = statusFilePath(dir);
  const flight = installInFlight(dir);
  if (flight.inFlight) return { started: false, pid: flight.pid, statusFile };
  const prior = readStatus(dir);
  if (prior && prior.state === 'failed' && prior.finishedAt) {
    const sinceMs = Date.now() - Date.parse(prior.finishedAt);
    if (sinceMs >= 0 && sinceMs < failedBackoffMs(prior.attempts)) {
      return { started: false, pid: null, statusFile, reason: prior.reason || 'failed', backoff: true };
    }
  }
  try {
    const child = spawn(
      process.execPath,
      [path.join(__dirname, 'dep-install-detached.cjs'), dir],
      { detached: true, stdio: 'ignore', windowsHide: true, cwd: dir, env: process.env }
    );
    child.on('error', () => { /* surfaced below as a missing pid */ });
    child.unref();
    if (typeof child.pid !== 'number') {
      // A bad cwd or an exec error: spawn returns without throwing and the child never runs.
      recordSpawnFailure(dir, prior);
      return { started: false, pid: null, statusFile, reason: 'spawn-failed' };
    }
    return { started: true, pid: child.pid, statusFile };
  } catch (_) {
    recordSpawnFailure(dir, prior);
    return { started: false, pid: null, statusFile, reason: 'spawn-failed' };
  }
}

/**
 * Connect-path install: start (or join) the detached installer and wait for it
 * only as long as the process-wide budget allows. Never kills the installer.
 *
 * @param {string} dir
 * @param {string[]} probe
 * @param {function} log
 * @param {object} [opts]
 * @param {boolean} [opts.force] - a require failed although the tree looked complete
 *   (requireWithHeal): success then needs a finished run (a "done" record written by the
 *   installer this call started, or by the peer it joined), not just a trusted tree.
 * @returns {{ ok: boolean, reason: (string|null), detached: boolean }}
 */
function connectPathInstall(dir, probe, log, opts) {
  const force = !!(opts && opts.force);
  const t0 = Date.now();
  const started = startDetachedInstall(dir);
  if (!started.started && started.reason) {
    // Backing off after a recent failure, or the installer could not be spawned: the answer is
    // already known, so answer now instead of waiting out the budget.
    log('[mcp-dep-heal] not starting an install (' + started.reason + (started.backoff ? ', backing off after a recent failure' : '') + ')');
    return { ok: false, reason: started.reason, detached: false };
  }
  log(
    '[mcp-dep-heal] ' + (started.started ? 'started detached installer pid ' + started.pid : 'joined running install') +
      '; waiting up to the remaining connect budget'
  );
  for (;;) {
    const st = readStatus(dir);
    const inFlight = installInFlight(dir).inFlight;
    if (force) {
      const finishedAfter = st && st.finishedAt && Date.parse(st.finishedAt) >= t0 - 50;
      if (st && st.state === 'done' && !inFlight && (!started.started || finishedAfter)) {
        return { ok: true, reason: null, detached: started.started };
      }
    } else if (treeTrusted(dir, probe) && !inFlight) {
      return { ok: true, reason: null, detached: started.started };
    }
    // A terminal status counts only if THIS start (or a peer's newer run) wrote it, not a leftover.
    const fresh = st && (!started.started || Date.parse(st.startedAt) >= t0 - 50);
    if (fresh && (st.state === 'failed' || st.state === 'npm-not-found')) {
      return { ok: false, reason: st.reason || st.state, detached: started.started };
    }
    if (connectPathRemainingMs() < CONNECT_PATH_MIN_ATTEMPT_MS) {
      return { ok: false, reason: 'installing', detached: started.started };
    }
    sleepSync(Math.min(250, Math.max(1, connectPathRemainingMs())));
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
 * @returns {{ healed: boolean, ok: boolean, reason?: (string|null), detached?: boolean, budgetExhausted?: boolean }}
 *   On the connect path with packages missing (or an install in flight), the
 *   install is detached: ok is true only when the packages are all present and
 *   no install is running; otherwise reason is 'installing' or the failure
 *   reason ('npm-not-found', 'exit-<code>', ...) from the status file.
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
    // A present-looking tree is not trusted while an install runs, nor after one that
    // started and never finished (CR-02): treeTrusted reads the install record.
    const missing = !treeTrusted(dir, probe);
    if (!missing) return { healed: false, ok: true };

    // Phase 266 Plan 05 (MCPFIX-03 gap closure): check the shared process-wide
    // budget BEFORE any install is attempted and BEFORE announcing a heal.
    // On the connect path, once the budget is spent, short-circuit here --
    // no new guarded install, no fresh peer-wait.
    let installOpts;
    if (connectPath) {
      const remainingMs = connectPathRemainingMs();
      if (remainingMs < CONNECT_PATH_MIN_ATTEMPT_MS) {
        log(
          '[mcp-dep-heal] connect-path budget spent (' + CONNECT_PATH_BUDGET_MS +
            'ms process-wide, ' + remainingMs + 'ms left); skipping the install for ' +
            dir + ' and failing fast'
        );
        return { healed: false, ok: false, budgetExhausted: true };
      }
      installOpts = { timeoutMs: remainingMs };
    }

    if (connectPath) {
      // D-14: never install in-process on the connect path. A detached installer
      // outlives the budget; we wait only for the remaining budget.
      log('[mcp-dep-heal] node_modules missing/incomplete; self-healing npm install (detached installer) in ' + dir);
      const r = connectPathInstall(dir, probe, log);
      if (!r.ok) {
        log(
          '[mcp-dep-heal] connect-path install not finished inside the process-wide ' + CONNECT_PATH_BUDGET_MS +
            'ms connect budget (' + r.reason + '); the detached installer keeps running and the server answers in-band'
        );
      }
      return { healed: true, ok: r.ok, reason: r.reason, detached: r.detached };
    }

    log('[mcp-dep-heal] node_modules missing/incomplete; self-healing npm install in ' + dir);
    const outcome = runGuardedInstall(dir, installOpts);
    log(
      '[mcp-dep-heal] install ' +
        (outcome.waited ? 'waited-for-peer' : 'ran') +
        '; ok=' + outcome.ok
    );
    return { healed: true, ok: outcome.ok, reason: outcome.reason };
  } catch (_) {
    // Never let the heal pre-flight itself crash the server -- requireWithHeal
    // is the backstop.
    return { healed: false, ok: false };
  }
}

/** The error code requireWithHeal throws on the connect path when the detached install is not finished in time. */
const INSTALL_PENDING_CODE = 'MINDRIAN_INSTALL_PENDING';

function installPendingError(reason, cause) {
  const err = new Error('MindrianOS packages are not installed yet (' + (reason || 'installing') + '); the install continues in the background');
  err.code = INSTALL_PENDING_CODE;
  err.reason = reason || 'installing';
  err.cause = cause;
  return err;
}

/**
 * True when `err` means "a package this plugin depends on is not installed (yet)":
 * the typed pending error, or a MODULE_NOT_FOUND for a bare package specifier
 * (never a relative path: a missing plugin file is a different failure).
 */
function isMissingPackagesError(err) {
  if (!err) return false;
  if (err.code === INSTALL_PENDING_CODE) return true;
  if (err.code !== 'MODULE_NOT_FOUND') return false;
  const m = /Cannot find module '([^']+)'/.exec(String(err.message || ''));
  return !!(m && !m[1].startsWith('.') && !path.isAbsolute(m[1]));
}

/**
 * Decision 8 (CLAUDE.md): a server that cannot load its packages says so in the
 * turn, never a silent partial toolset and never a crash at the host's connect
 * window. Serves the dependency-free install-status responder
 * (lib/core/mcp-install-responder.cjs) with exactly one tool for this server.
 * When nothing is installing yet (the budget was spent before an install could
 * start) the detached installer is started first, and never killed.
 *
 * @param {string} serverName - 'mindrian-os' | 'mindrian-brain'
 * @param {{reason?: (string|null), code?: string, startInstall?: boolean, http?: boolean}} outcome - the heal outcome or the
 *   caught error; http: true when the surface selected the HTTP transport (Cowork), so the
 *   responder listens on 127.0.0.1 like the full server instead of reading stdio (WR-07)
 * @param {function} [log]
 * @returns {boolean} true when the responder is serving (the caller should return)
 */
function serveInstallResponderFor(serverName, outcome, log) {
  const say = typeof log === 'function' ? log : () => {};
  let responderLib = null;
  try {
    responderLib = require('./mcp-install-responder.cjs');
  } catch (e) {
    say('[' + serverName + '] install responder unavailable (' + e.message + '); continuing with the normal start');
    return false;
  }
  const root = resolvePluginRoot();
  if (outcome && outcome.startInstall) {
    try { startDetachedInstall(root); } catch (_) { /* the responder still answers honestly */ }
  }
  let version = '0.0.0';
  try {
    version = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin', 'plugin.json'), 'utf8')).version || version;
  } catch (_) { /* keep the placeholder */ }
  const reason = (outcome && outcome.reason) || 'installing';
  const status = readStatus(root) || { state: reason === 'npm-not-found' ? 'npm-not-found' : 'installing', reason };
  say('[' + serverName + '] packages not ready (' + reason + '); serving the install-status tool until the next session');
  responderLib.serveInstallingResponder({ serverName, version, pluginRoot: root, status, transport: outcome && outcome.http ? 'http' : 'stdio' });
  return true;
}

module.exports = {
  INSTALL_PENDING_CODE,
  isMissingPackagesError,
  serveInstallResponderFor,
  requireWithHeal,
  ensureDepsPresent,
  runGuardedInstall,
  startDetachedInstall,
  failedBackoffMs,
  installInFlight,
  treeTrusted,
  resolvePluginRoot,
  productionDepNames,
  beginConnectPathBudget,
  connectPathRemainingMs,
  DEFAULT_INSTALL_TIMEOUT_MS,
  DETACHED_INSTALL_TIMEOUT_MS,
  detachedInstallTimeoutMs,
  CONNECT_PATH_BUDGET_MS,
  CONNECT_PATH_MIN_ATTEMPT_MS,
};
