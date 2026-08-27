#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 266 Plan 05 (MCPFIX-03 gap closure) -- pins the PROCESS-LEVEL connect-
 * path budget contract that 266-VERIFICATION.md Truth #5 found FAILING:
 * CONNECT_PATH_BUDGET_MS (15000ms) was enforced PER-CALL, not per-process, so
 * the four connect-path heal calls each MCP entry point makes at module scope
 * before answering `initialize` could each independently burn a fresh 15000ms
 * budget. The verifier reproduced this against the real, unmodified production
 * functions with a planted live lock forcing the peer-wait branch on every
 * call: call1=15081ms, call2=15066ms, call3=15068ms, call4=15081ms,
 * cumulative=60296ms -- roughly DOUBLE the host's own ~30000ms MCP connect
 * timeout (CHANGELOG 2.1.242) that this budget exists to respect.
 *
 * WHY THE SIBLING FILE COULD NOT CATCH THIS: tests/test-266-dep-heal-connect-
 * budget.cjs checks 5 and 6 each exercise exactly ONE waitForUnlock /
 * ensureDepsPresent call in isolation. A green run there proves the SINGLE-
 * CALL bound only. This file owns the PROCESS-level contract: a cumulative
 * wall-clock bound across the real multi-call heal sequence, with the
 * sequence length DERIVED from the live entry-point files rather than
 * hardcoded, so a future fifth connect-path call site automatically
 * lengthens the replay this test proves against.
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
const {
  ensureDepsPresent,
  requireWithHeal,
  beginConnectPathBudget,
  connectPathRemainingMs,
  CONNECT_PATH_BUDGET_MS,
  DEFAULT_INSTALL_TIMEOUT_MS,
  CONNECT_PATH_MIN_ATTEMPT_MS,
} = depHeal;

const lock = require(LOCK_MODULE_PATH);
const { LOCK_FILENAME, STALE_THRESHOLD_MS, WAIT_TIMEOUT_MS } = lock;

// Named ceilings. Each carries its source as a comment so a reader never has
// to re-derive where a number came from.
const HOST_CONNECT_TIMEOUT_MS = 30000; // CHANGELOG 2.1.242 -- the number the whole budget exists to sit under.
const PROCESS_CEILING_MS = CONNECT_PATH_BUDGET_MS + 3000; // one budget plus poll and spawn overhead.
const SHORT_CIRCUIT_CEILING_MS = 500; // a short-circuited call must not measurably block.
const FAST_BUDGET_MS = 2000; // the parametric run's armed budget.

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
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-connect-process-budget-test-'));
}

/**
 * Strip whole-line comments (leading `//`, `*`, or a block-comment opener)
 * before matching, so header prose can neither satisfy nor trip a
 * source-scan assertion. Mirrors tests/test-266-dep-heal-connect-budget.cjs's
 * own helper and the acceptance-criteria grep pattern that drops any line
 * whose first non-whitespace character is `*` or `/`.
 */
function stripCommentLines(src) {
  return src
    .split('\n')
    .filter((line) => !/^\s*[*/]/.test(line))
    .join('\n');
}

/**
 * Count comment-stripped lines that contain a connect-path-opted heal call
 * (ensureDepsPresent( or requireWithHeal( together with the connectPath
 * token on the same line), and locate the LINE INDEX of the first such line.
 */
function countConnectPathHealCalls(src) {
  const lines = stripCommentLines(src).split('\n');
  let count = 0;
  let firstIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if ((line.indexOf('ensureDepsPresent(') >= 0 || line.indexOf('requireWithHeal(') >= 0) && line.indexOf('connectPath') >= 0) {
      count += 1;
      if (firstIdx === -1) firstIdx = i;
    }
  }
  return { count, firstIdx };
}

/** Character index (not line index) of the first connect-path heal call in a comment-stripped source string. */
function firstHealCallCharIndex(strippedSrc) {
  const lines = strippedSrc.split('\n');
  let offset = 0;
  for (const line of lines) {
    const hasEnsure = line.indexOf('ensureDepsPresent(') >= 0;
    const hasRequire = line.indexOf('requireWithHeal(') >= 0;
    if ((hasEnsure || hasRequire) && line.indexOf('connectPath') >= 0) {
      const token = hasEnsure ? 'ensureDepsPresent(' : 'requireWithHeal(';
      return offset + line.indexOf(token);
    }
    offset += line.length + 1;
  }
  return -1;
}

const serverSrc = fs.readFileSync(MCP_SERVER_PATH, 'utf8');
const brainSrc = fs.readFileSync(BRAIN_CLIENT_PATH, 'utf8');
const serverCensus = countConnectPathHealCalls(serverSrc);
const brainCensus = countConnectPathHealCalls(brainSrc);
const SEQUENCE_LEN = Math.max(serverCensus.count, brainCensus.count);

// --- 1: EXPORT SHAPE ---------------------------------------------------

test('beginConnectPathBudget and connectPathRemainingMs are exported functions; CONNECT_PATH_MIN_ATTEMPT_MS is a valid floor', () => {
  assert.equal(typeof beginConnectPathBudget, 'function', 'beginConnectPathBudget must be exported as a function');
  assert.equal(typeof connectPathRemainingMs, 'function', 'connectPathRemainingMs must be exported as a function');
  assert.equal(typeof CONNECT_PATH_MIN_ATTEMPT_MS, 'number', 'CONNECT_PATH_MIN_ATTEMPT_MS must be exported as a number');
  assert.ok(isFinite(CONNECT_PATH_MIN_ATTEMPT_MS) && CONNECT_PATH_MIN_ATTEMPT_MS > 0,
    'CONNECT_PATH_MIN_ATTEMPT_MS must be a finite positive number');
  assert.ok(CONNECT_PATH_MIN_ATTEMPT_MS < CONNECT_PATH_BUDGET_MS,
    'CONNECT_PATH_MIN_ATTEMPT_MS (' + CONNECT_PATH_MIN_ATTEMPT_MS + ') must be below CONNECT_PATH_BUDGET_MS (' + CONNECT_PATH_BUDGET_MS + ')');
});

// --- 2: INVARIANT CHAIN ---------------------------------------------------

test('the four-link invariant chain holds against IMPORTED values, plus value pins (CONNECT_PATH_BUDGET_MS asserted by relation only)', () => {
  assert.ok(CONNECT_PATH_BUDGET_MS < DEFAULT_INSTALL_TIMEOUT_MS,
    'CONNECT_PATH_BUDGET_MS (' + CONNECT_PATH_BUDGET_MS + ') must be below DEFAULT_INSTALL_TIMEOUT_MS (' + DEFAULT_INSTALL_TIMEOUT_MS + ')');
  assert.ok(DEFAULT_INSTALL_TIMEOUT_MS < STALE_THRESHOLD_MS,
    'DEFAULT_INSTALL_TIMEOUT_MS (' + DEFAULT_INSTALL_TIMEOUT_MS + ') must be below STALE_THRESHOLD_MS (' + STALE_THRESHOLD_MS + ')');
  assert.ok(STALE_THRESHOLD_MS < WAIT_TIMEOUT_MS,
    'STALE_THRESHOLD_MS (' + STALE_THRESHOLD_MS + ') must be below WAIT_TIMEOUT_MS (' + WAIT_TIMEOUT_MS + ')');
  assert.ok(CONNECT_PATH_BUDGET_MS < HOST_CONNECT_TIMEOUT_MS,
    'CONNECT_PATH_BUDGET_MS (' + CONNECT_PATH_BUDGET_MS + ') must sit below the ~30000ms host connect timeout (CHANGELOG 2.1.242)');
  assert.equal(DEFAULT_INSTALL_TIMEOUT_MS, 120000, 'DEFAULT_INSTALL_TIMEOUT_MS must stay 120000');
  assert.equal(STALE_THRESHOLD_MS, 180000, 'STALE_THRESHOLD_MS must stay 180000');
  assert.equal(WAIT_TIMEOUT_MS, 200000, 'WAIT_TIMEOUT_MS must stay 200000');
});

// --- 3: CALL-SITE CENSUS ---------------------------------------------------

test('call-site census: both entry points make at least 4 connect-path heal calls; SEQUENCE_LEN=' + SEQUENCE_LEN + ' derived from the live files, not hardcoded', () => {
  assert.ok(serverCensus.count >= 4,
    'bin/mindrian-mcp-server.cjs must have at least 4 connect-path heal call lines, found ' + serverCensus.count);
  assert.ok(brainCensus.count >= 4,
    'bin/mindrian-brain-mcp-client.cjs must have at least 4 connect-path heal call lines, found ' + brainCensus.count);
  assert.ok(SEQUENCE_LEN >= 4, 'SEQUENCE_LEN must be at least 4, derived as ' + SEQUENCE_LEN);
});

// --- 4: ARMING CENSUS -------------------------------------------------------

test('arming census: beginConnectPathBudget( appears before the first connect-path heal call in each entry point', () => {
  const serverStripped = stripCommentLines(serverSrc);
  const brainStripped = stripCommentLines(brainSrc);
  const serverArmIdx = serverStripped.indexOf('beginConnectPathBudget(');
  const brainArmIdx = brainStripped.indexOf('beginConnectPathBudget(');
  assert.ok(serverArmIdx >= 0, 'bin/mindrian-mcp-server.cjs must call beginConnectPathBudget(');
  assert.ok(brainArmIdx >= 0, 'bin/mindrian-brain-mcp-client.cjs must call beginConnectPathBudget(');

  const serverFirstHealIdx = firstHealCallCharIndex(serverStripped);
  const brainFirstHealIdx = firstHealCallCharIndex(brainStripped);
  assert.ok(serverFirstHealIdx >= 0, 'bin/mindrian-mcp-server.cjs must have a connect-path heal call');
  assert.ok(brainFirstHealIdx >= 0, 'bin/mindrian-brain-mcp-client.cjs must have a connect-path heal call');

  assert.ok(serverArmIdx < serverFirstHealIdx,
    'beginConnectPathBudget( must be armed before the first connect-path heal call in bin/mindrian-mcp-server.cjs');
  assert.ok(brainArmIdx < brainFirstHealIdx,
    'beginConnectPathBudget( must be armed before the first connect-path heal call in bin/mindrian-brain-mcp-client.cjs');
});

// --- 5: PARAMETRIC CUMULATIVE BOUND, subprocess-guarded, fast --------------

test('parametric: SEQUENCE_LEN=' + SEQUENCE_LEN + ' replayed calls stay under FAST_BUDGET_MS + 1500ms cumulative, short-circuit after budget spend', () => {
  const dir = tmpdir();
  const lockP = path.join(dir, LOCK_FILENAME);
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'fake-266-05', version: '0.0.0', dependencies: { 'fake-dep-266-05': '^1.0.0' } })
  );
  // A live, this-process-owned lock forces acquireInstallLock to lose so the
  // peer-wait branch is taken on the first call and no real npm install ever
  // runs.
  fs.writeFileSync(lockP, JSON.stringify({ pid: process.pid, timestamp: Date.now() }));

  try {
    const script = [
      'const m = require(' + JSON.stringify(DEP_HEAL_MODULE_PATH) + ');',
      'm.beginConnectPathBudget({ budgetMs: ' + FAST_BUDGET_MS + ', force: true });',
      'const dir = ' + JSON.stringify(dir) + ';',
      'const logs = [];',
      'const log = function (msg) { logs.push(msg); };',
      'const results = [];',
      'let cumulative = 0;',
      'const t0 = Date.now();',
      'const r0 = m.ensureDepsPresent({ pluginRoot: dir, connectPath: true, log: log });',
      'const d0 = Date.now() - t0;',
      'cumulative += d0;',
      'results.push({ call: 0, ms: d0, res: r0 });',
      'for (let i = 1; i < ' + SEQUENCE_LEN + '; i++) {',
      '  const t = Date.now();',
      '  const entry = { call: i };',
      '  try {',
      "    m.requireWithHeal('@mindrian-test/absent-266-05-probe', { pluginRoot: dir, connectPath: true, log: log });",
      '    entry.threw = false;',
      '  } catch (err) {',
      '    entry.threw = true;',
      '    entry.code = err && err.code;',
      '  }',
      '  entry.ms = Date.now() - t;',
      '  cumulative += entry.ms;',
      '  results.push(entry);',
      '}',
      'process.stdout.write(JSON.stringify({ cumulative: cumulative, results: results, logs: logs }));',
    ].join('\n');

    // MANDATORY child env sanitation: resolvePluginRoot (mcp-dep-heal.cjs:132-139)
    // prefers CLAUDE_PLUGIN_ROOT / MINDRIAN_OS_ROOT over the caller's pluginRoot
    // argument, so without deleting these two vars this spawn would aim a real
    // `npm install` at whatever plugin root the ambient environment names.
    const childEnv = Object.assign({}, process.env);
    delete childEnv.CLAUDE_PLUGIN_ROOT;
    delete childEnv.MINDRIAN_OS_ROOT;

    const child = spawnSync(process.execPath, ['-e', script], { timeout: 12000, encoding: 'utf8', env: childEnv });
    assert.ok(
      !(child.error && child.error.code === 'ETIMEDOUT') && child.signal !== 'SIGTERM',
      'the parametric replay must not hang past 12000ms'
    );
    assert.equal(child.status, 0, 'child process must exit cleanly; stderr: ' + (child.stderr || ''));
    const parsed = JSON.parse(child.stdout);

    assert.ok(
      parsed.cumulative < FAST_BUDGET_MS + 1500,
      'cumulative elapsed must be under FAST_BUDGET_MS + 1500ms, took ' + parsed.cumulative + 'ms'
    );

    // Every call AFTER call 0 (the one that spends the whole budget waiting on
    // the planted live lock) must short-circuit fast and propagate the
    // original MODULE_NOT_FOUND without a new install/peer-wait attempt.
    for (const entry of parsed.results) {
      if (entry.call === 0) continue;
      assert.ok(
        entry.ms < SHORT_CIRCUIT_CEILING_MS,
        'call ' + entry.call + ' after budget exhaustion must return in under ' + SHORT_CIRCUIT_CEILING_MS + 'ms, took ' + entry.ms + 'ms'
      );
      assert.equal(entry.threw, true, 'call ' + entry.call + ' (a short-circuited requireWithHeal) must throw');
      assert.equal(entry.code, 'MODULE_NOT_FOUND', 'call ' + entry.call + ' must propagate the original MODULE_NOT_FOUND, not swallow it');
    }

    const budgetSpentLogs = parsed.logs.filter((l) => /budget spent/i.test(l)).length;
    assert.ok(
      budgetSpentLogs >= SEQUENCE_LEN - 1,
      'at least ' + (SEQUENCE_LEN - 1) + ' log lines must mention the budget being spent, found ' + budgetSpentLogs
    );

    const healLogCount = parsed.logs.filter((l) => l.indexOf('self-healing npm install') >= 0).length;
    assert.equal(healLogCount, 1, 'exactly one call may attempt a heal (the first); found ' + healLogCount + ' self-healing npm install log lines');

    assert.ok(!fs.existsSync(path.join(dir, 'node_modules')), 'the scratch root must have no node_modules -- no real install ever ran');
  } finally {
    try { fs.unlinkSync(lockP); } catch (_) { /* already gone */ }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- 6: REAL-NUMBER CUMULATIVE BOUND, subprocess-guarded -------------------

test('real-number: the verifier\'s exact scenario (default CONNECT_PATH_BUDGET_MS) stays under the process ceiling and the host connect timeout, replacing the measured 60296ms regression', () => {
  const dir = tmpdir();
  const lockP = path.join(dir, LOCK_FILENAME);
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'fake-266-05', version: '0.0.0', dependencies: { 'fake-dep-266-05': '^1.0.0' } })
  );
  fs.writeFileSync(lockP, JSON.stringify({ pid: process.pid, timestamp: Date.now() }));

  try {
    const script = [
      'const m = require(' + JSON.stringify(DEP_HEAL_MODULE_PATH) + ');',
      'm.beginConnectPathBudget();', // default CONNECT_PATH_BUDGET_MS, no override
      'const dir = ' + JSON.stringify(dir) + ';',
      'const logs = [];',
      'const log = function (msg) { logs.push(msg); };',
      'const results = [];',
      'let cumulative = 0;',
      'const t0 = Date.now();',
      'const r0 = m.ensureDepsPresent({ pluginRoot: dir, connectPath: true, log: log });',
      'const d0 = Date.now() - t0;',
      'cumulative += d0;',
      'results.push({ call: 0, ms: d0, res: r0 });',
      'for (let i = 1; i < ' + SEQUENCE_LEN + '; i++) {',
      '  const t = Date.now();',
      '  const entry = { call: i };',
      '  try {',
      "    m.requireWithHeal('@mindrian-test/absent-266-05-probe', { pluginRoot: dir, connectPath: true, log: log });",
      '    entry.threw = false;',
      '  } catch (err) {',
      '    entry.threw = true;',
      '    entry.code = err && err.code;',
      '  }',
      '  entry.ms = Date.now() - t;',
      '  cumulative += entry.ms;',
      '  results.push(entry);',
      '}',
      'process.stdout.write(JSON.stringify({ cumulative: cumulative, results: results, logs: logs }));',
    ].join('\n');

    // MANDATORY child env sanitation (see check 5 for the full rationale):
    // without deleting CLAUDE_PLUGIN_ROOT / MINDRIAN_OS_ROOT, resolvePluginRoot
    // would ignore our pluginRoot argument and aim a real npm install at the
    // ambient plugin root.
    const childEnv = Object.assign({}, process.env);
    delete childEnv.CLAUDE_PLUGIN_ROOT;
    delete childEnv.MINDRIAN_OS_ROOT;

    const child = spawnSync(process.execPath, ['-e', script], { timeout: 25000, encoding: 'utf8', env: childEnv });
    assert.ok(
      !(child.error && child.error.code === 'ETIMEDOUT') && child.signal !== 'SIGTERM',
      'the real-number replay must not hang past 25000ms (pre-fix this is the verifier\'s ~60296ms reproduction)'
    );
    assert.equal(child.status, 0, 'child process must exit cleanly; stderr: ' + (child.stderr || ''));
    const parsed = JSON.parse(child.stdout);

    assert.ok(
      parsed.cumulative < PROCESS_CEILING_MS,
      'cumulative elapsed must be under PROCESS_CEILING_MS (' + PROCESS_CEILING_MS + 'ms), took ' + parsed.cumulative + 'ms'
    );
    assert.ok(
      parsed.cumulative < HOST_CONNECT_TIMEOUT_MS,
      'cumulative elapsed must stay under the ~30000ms host connect timeout (CHANGELOG 2.1.242), took ' + parsed.cumulative + 'ms'
    );
    assert.ok(
      parsed.cumulative < 2 * CONNECT_PATH_BUDGET_MS,
      'cumulative elapsed must stay well under the verifier\'s measured 60296ms regression (4x CONNECT_PATH_BUDGET_MS), took ' + parsed.cumulative + 'ms'
    );

    assert.ok(!fs.existsSync(path.join(dir, 'node_modules')), 'the scratch root must have no node_modules -- no real install ever ran');
  } finally {
    try { fs.unlinkSync(lockP); } catch (_) { /* already gone */ }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- 7: HOOK PATH UNTOUCHED --------------------------------------------------

test('scripts/sessionstart-npm-reconcile.cjs has no host connect clock: zero matches for connectPath, timeoutMs, or beginConnectPathBudget', () => {
  const src = stripCommentLines(fs.readFileSync(RECONCILE_HOOK_PATH, 'utf8'));
  const matches = (src.match(/connectPath|timeoutMs|beginConnectPathBudget/g) || []).length;
  assert.equal(matches, 0,
    'the SessionStart reconcile hook must keep calling runGuardedInstall() with no options and its full DEFAULT_INSTALL_TIMEOUT_MS budget');
});

process.stdout.write('\ntest-266-connect-path-process-budget: ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
