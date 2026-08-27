#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 266 Plan 03 (MCPFIX-03) -- pins the MCP dependency self-heal connect-
 * path budget BEFORE the production code changes, in the style of
 * lib/core/mcp-dep-heal.test.cjs (mkdtemp scratch roots, a plain test(name, fn)
 * helper, a summary line, exit 0 on all-pass).
 *
 * THE BUG THIS GUARDS (266-RESEARCH-stateless-spec-update.md / the mcp-layer
 * audit): both MCP entry points call `ensureDepsPresent()` at module load,
 * before the SDK require. On a cold plugin cache that runs a blocking
 * `spawnSync('npm install')` with a 120000 ms internal ceiling
 * (lib/core/mcp-dep-heal.cjs), but Claude Code's own connect timeout for an
 * MCP server is about 30 seconds (CHANGELOG 2.1.242) -- four times sooner. The
 * LOSER of the install-lock race is worse: it is capped by npm-install-lock.cjs's
 * WAIT_TIMEOUT_MS (200000 ms), so the peer-wait path can block for over three
 * minutes against a 30-second host clock.
 *
 * THE FIX (production code, next task): a CONNECT_PATH_BUDGET_MS (15000 ms)
 * budget threaded through ensureDepsPresent/requireWithHeal/runGuardedInstall
 * via a `connectPath` option, and a per-call `timeoutMs` override on
 * waitForUnlock so the peer-wait arm is bounded too. The hook path
 * (scripts/sessionstart-npm-reconcile.cjs) keeps its full 120-second
 * DEFAULT_INSTALL_TIMEOUT_MS budget -- it has no host connect clock counting
 * against it.
 *
 * PHASE 266 PLAN 05 (MCPFIX-03 gap closure, dated 2026-08-27): this file owns
 * the PER-CALL contract only -- every check below exercises exactly ONE
 * waitForUnlock / ensureDepsPresent call in isolation. The PROCESS-level
 * contract (a cumulative wall-clock bound across the full multi-call
 * module-scope sequence both MCP entry points actually run before answering
 * `initialize`) lives in tests/test-266-connect-path-process-budget.cjs. This
 * split is deliberate: a green run of THIS file alone proved the single-call
 * bound only, and that gap is exactly how 266-VERIFICATION.md Truth #5's
 * regression shipped (four independently-budgeted calls, each individually
 * correct, compounding to a measured 60296ms cumulative worst case against a
 * ~30000ms host connect timeout). CONNECT_PATH_BUDGET_MS itself is now a
 * PER-PROCESS ceiling spanning every connect-path heal call, not a per-call
 * number -- see lib/core/mcp-dep-heal.cjs's module header for the full
 * arithmetic. No assertion or executable line in this file changed.
 *
 * SUBPROCESS GUARDING: two of the checks below (5 and 6) exercise code paths
 * that, PRE-FIX, block synchronously for up to WAIT_TIMEOUT_MS (200 seconds --
 * today's actual bug). Running those calls in-process during the RED phase of
 * this task would make the whole suite take over three minutes just to fail.
 * Instead each of those checks spawns a tiny node subprocess and bounds ITS
 * OWN patience with spawnSync's `timeout` option, independent of whatever the
 * production code actually does -- a pre-fix hang is caught and reported as a
 * clear timeout failure in a few seconds, not silently eaten for three minutes.
 *
 * HERMETIC: every case is self-contained under a fresh mkdtemp root and NONE
 * ever shells out to a real `npm install` -- each lock-contention case plants
 * a live (this-process-owned) lock file FIRST so acquireInstallLock always
 * loses and the code takes the wait branch, never the install branch.
 *
 * HARD RULE: no em-dashes anywhere in this file (hyphens only).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const DEP_HEAL_MODULE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'mcp-dep-heal.cjs');
const LOCK_MODULE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'npm-install-lock.cjs');
const MCP_SERVER_PATH = path.join(REPO_ROOT, 'bin', 'mindrian-mcp-server.cjs');
const BRAIN_CLIENT_PATH = path.join(REPO_ROOT, 'bin', 'mindrian-brain-mcp-client.cjs');
const RECONCILE_HOOK_PATH = path.join(REPO_ROOT, 'scripts', 'sessionstart-npm-reconcile.cjs');

const depHeal = require(DEP_HEAL_MODULE_PATH);
const lock = require(LOCK_MODULE_PATH);
const { ensureDepsPresent, DEFAULT_INSTALL_TIMEOUT_MS, CONNECT_PATH_BUDGET_MS } = depHeal;
const { LOCK_FILENAME, STALE_THRESHOLD_MS } = lock;

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  process.stdout.write('  ok ' + name + '\n');
}
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  process.stdout.write('    ' + (err && err.message ? err.message : String(err)) + '\n');
}
function test(name, fn) {
  try { fn(); ok(name); } catch (err) { fail(name, err); }
}

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-connect-budget-test-'));
}

/**
 * Strip whole-line comments (leading `//`, `*`, or a block-comment opener)
 * before matching, so header prose can neither satisfy nor trip a
 * source-scan assertion. Mirrors the acceptance-criteria grep pattern that
 * drops any line whose first non-whitespace character is `*` or `/`.
 */
function stripCommentLines(src) {
  return src
    .split('\n')
    .filter((line) => !/^\s*[*/]/.test(line))
    .join('\n');
}

// --- 1/2/3/4: the two exported budgets, their shape, and their ordering ----

test('mcp-dep-heal.cjs exports DEFAULT_INSTALL_TIMEOUT_MS and CONNECT_PATH_BUDGET_MS as numbers', () => {
  assert.equal(typeof DEFAULT_INSTALL_TIMEOUT_MS, 'number',
    'DEFAULT_INSTALL_TIMEOUT_MS must be exported as a number');
  assert.equal(typeof CONNECT_PATH_BUDGET_MS, 'number',
    'CONNECT_PATH_BUDGET_MS must be exported as a number');
});

test('DEFAULT_INSTALL_TIMEOUT_MS is unchanged at 120000 (the hook path is not tightened)', () => {
  assert.equal(DEFAULT_INSTALL_TIMEOUT_MS, 120000,
    'the SessionStart reconcile hook needs its full 120-second budget');
});

test('CONNECT_PATH_BUDGET_MS is <= 20000 and strictly below the host connect timeout (~30000ms, CHANGELOG 2.1.242)', () => {
  assert.ok(CONNECT_PATH_BUDGET_MS <= 20000,
    'CONNECT_PATH_BUDGET_MS (' + CONNECT_PATH_BUDGET_MS + ') must leave headroom for module load + registration + initialize');
  assert.ok(CONNECT_PATH_BUDGET_MS < 30000,
    'CONNECT_PATH_BUDGET_MS (' + CONNECT_PATH_BUDGET_MS + ') must sit below Claude Code\'s ~30000ms MCP connect timeout (CHANGELOG 2.1.242)');
});

test('CONNECT_PATH_BUDGET_MS is strictly below STALE_THRESHOLD_MS (a connect-path process cannot outlive its own lock\'s stale window)', () => {
  assert.ok(CONNECT_PATH_BUDGET_MS < STALE_THRESHOLD_MS,
    'CONNECT_PATH_BUDGET_MS (' + CONNECT_PATH_BUDGET_MS + ') must be below STALE_THRESHOLD_MS (' + STALE_THRESHOLD_MS + ')');
});

// --- 5: wall-clock bound on the peer-wait path, subprocess-guarded ----------

test('waitForUnlock honors a per-call timeoutMs override (wall-clock bound, subprocess-guarded)', () => {
  const dir = tmpdir();
  const lockP = path.join(dir, LOCK_FILENAME);
  // A live, fresh, non-reclaimable lock owned by THIS very process (this pid
  // is alive and the timestamp is fresh, so isReclaimable is false and the
  // default wait would otherwise sit for the full WAIT_TIMEOUT_MS, 200000ms).
  fs.writeFileSync(lockP, JSON.stringify({ pid: process.pid, timestamp: Date.now() }));

  // Bounds our OWN patience independent of whatever waitForUnlock actually
  // does today -- pre-fix this call ignores the second argument entirely and
  // sits for ~200000ms; the outer spawnSync timeout below catches that as a
  // clean, fast failure instead of a 200-second hang.
  const OUTER_TIMEOUT_MS = 6000;
  const script = [
    'const { waitForUnlock } = require(' + JSON.stringify(LOCK_MODULE_PATH) + ');',
    'const start = Date.now();',
    'const cleared = waitForUnlock(' + JSON.stringify(dir) + ', { timeoutMs: 300 });',
    'process.stdout.write(JSON.stringify({ elapsed: Date.now() - start, cleared: cleared }));',
  ].join('\n');

  try {
    const child = spawnSync(process.execPath, ['-e', script], { timeout: OUTER_TIMEOUT_MS, encoding: 'utf8' });
    assert.ok(
      !(child.error && child.error.code === 'ETIMEDOUT') && child.signal !== 'SIGTERM',
      'waitForUnlock(dir, {timeoutMs:300}) must not hang past ' + OUTER_TIMEOUT_MS +
        'ms (pre-fix it ignores the override and sits for WAIT_TIMEOUT_MS, ~200000ms)'
    );
    assert.equal(child.status, 0, 'child process must exit cleanly; stderr: ' + (child.stderr || ''));
    const parsed = JSON.parse(child.stdout);
    assert.equal(parsed.cleared, false, 'a live never-clearing lock must time out, not report cleared');
    assert.ok(parsed.elapsed < 3000,
      'waitForUnlock must honor the timeoutMs override and return in well under 3000ms, took ' + parsed.elapsed + 'ms');
  } finally {
    try { fs.unlinkSync(lockP); } catch (_) { /* already gone */ }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- 6: wall-clock bound on the connect path end to end, subprocess-guarded -

test('ensureDepsPresent({connectPath:true}) returns inside its budget end to end (wall-clock, subprocess-guarded)', () => {
  const dir = tmpdir();
  const lockP = path.join(dir, LOCK_FILENAME);
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'fake-266-connect-budget', version: '0.0.0', dependencies: { 'fake-dep-266': '^1.0.0' } })
  );
  // No node_modules at all -> ensureDepsPresent sees a missing tree and calls
  // runGuardedInstall, which first tries acquireInstallLock. Planting a live
  // (this-process-owned) lock FIRST makes that acquire lose, forcing the wait
  // branch -- this is what keeps this case from ever shelling out to a real
  // npm install.
  fs.writeFileSync(lockP, JSON.stringify({ pid: process.pid, timestamp: Date.now() }));

  // Pre-fix, CONNECT_PATH_BUDGET_MS is undefined; assume the production value
  // this same plan pins (15000ms) so the outer guard is meaningful either way.
  const configuredBudget = (typeof CONNECT_PATH_BUDGET_MS === 'number' && CONNECT_PATH_BUDGET_MS > 0)
    ? CONNECT_PATH_BUDGET_MS
    : 15000;
  const OUTER_TIMEOUT_MS = configuredBudget + 5000;

  const script = [
    'const m = require(' + JSON.stringify(DEP_HEAL_MODULE_PATH) + ');',
    'const start = Date.now();',
    'const res = m.ensureDepsPresent({ pluginRoot: ' + JSON.stringify(dir) + ', connectPath: true, log: function () {} });',
    'process.stdout.write(JSON.stringify({ elapsed: Date.now() - start, res: res }));',
  ].join('\n');

  try {
    const child = spawnSync(process.execPath, ['-e', script], { timeout: OUTER_TIMEOUT_MS, encoding: 'utf8' });
    assert.ok(
      !(child.error && child.error.code === 'ETIMEDOUT') && child.signal !== 'SIGTERM',
      'ensureDepsPresent({connectPath:true}) must not hang past ' + OUTER_TIMEOUT_MS +
        'ms (pre-fix, unbudgeted, this sits for WAIT_TIMEOUT_MS, ~200000ms)'
    );
    assert.equal(child.status, 0, 'child process must exit cleanly; stderr: ' + (child.stderr || ''));
    const parsed = JSON.parse(child.stdout);
    assert.ok(
      parsed.elapsed < configuredBudget + 3000,
      'the connect path must return inside its budget: took ' + parsed.elapsed + 'ms, budget ' + configuredBudget + 'ms'
    );
    assert.ok(parsed.res && typeof parsed.res === 'object', 'ensureDepsPresent must return an object, never hang or throw');
    assert.equal(parsed.res.healed, true, 'a missing tree must report healed=true');
    assert.equal(parsed.res.ok, false, 'a peer-wait that does not clear within the budget must report ok=false');
  } finally {
    try { fs.unlinkSync(lockP); } catch (_) { /* already gone */ }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- 7: entry-point opt-in census -------------------------------------------

test('bin/mindrian-mcp-server.cjs opts its ensureDepsPresent call into connectPath', () => {
  const src = stripCommentLines(fs.readFileSync(MCP_SERVER_PATH, 'utf8'));
  assert.ok(
    /ensureDepsPresent\(\{[^}]*connectPath/.test(src),
    'bin/mindrian-mcp-server.cjs must call ensureDepsPresent({ ..., connectPath: true, ... })'
  );
});

test('bin/mindrian-brain-mcp-client.cjs opts its ensureDepsPresent call into connectPath', () => {
  const src = stripCommentLines(fs.readFileSync(BRAIN_CLIENT_PATH, 'utf8'));
  assert.ok(
    /ensureDepsPresent\(\{[^}]*connectPath/.test(src),
    'bin/mindrian-brain-mcp-client.cjs must call ensureDepsPresent({ ..., connectPath: true, ... })'
  );
});

// --- 8: hook path stays untouched -------------------------------------------

test('scripts/sessionstart-npm-reconcile.cjs is untouched: no connectPath, no timeoutMs (keeps the full 120s budget)', () => {
  const src = stripCommentLines(fs.readFileSync(RECONCILE_HOOK_PATH, 'utf8'));
  assert.equal(
    (src.match(/connectPath|timeoutMs/g) || []).length,
    0,
    'the SessionStart reconcile hook has no host connect clock; it must keep calling runGuardedInstall() with no options'
  );
});

process.stdout.write('\ntest-266-dep-heal-connect-budget: ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
