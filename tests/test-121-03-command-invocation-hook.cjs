#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121-03 Task 3 -- command_invocation PostToolUse hook tests (D-09 surface 3).
 *
 * Verifies scripts/telemetry-command-invocation.cjs:
 *   - filters at the script level: only /mos:* invocations emit
 *   - routes every emit through writer.emit() (Canon Part 9 chokepoint)
 *   - produces command_invocation rows with the 4 ALLOWED_FIELDS:
 *       command, outcome, duration_ms, context_hash
 *   - context_hash is at most 16 chars (matches MAX_CONTEXT_HASH_LEN)
 *   - missing CLAUDE_TOOL_DURATION_MS defaults to 0 (defensive)
 *   - 100 simulated invocations land in the SAME ISO-week file (type
 *     discriminator preserved; high-volume bucket isolated)
 *
 * Test map (5 cases, one-to-one with PLAN <behavior>):
 *   1. /mos:scout + success + 1500ms -> 1 row with matching scalars.
 *   2. Non-/mos: command (e.g. 'Read', '') -> 0 rows. Filter applied.
 *   3. context_hash is <= 16 chars (MAX_CONTEXT_HASH_LEN).
 *   4. Missing CLAUDE_TOOL_DURATION_MS -> duration_ms === 0 (defensive).
 *   5. 100 /mos:* invocations land in same ISO-week file; every row has
 *      event === 'command_invocation' (type discriminator preserved).
 *
 * The hook script is invoked via main() directly (exported for tests) so we
 * can manipulate process.env inline -- no spawnSync round-trips needed.
 *
 * Hermetic: per-test tmpdir + HOME swap. Mirrors writer.test.cjs scaffolding.
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO = path.resolve(__dirname, '..');
const HOOK_PATH = path.join(REPO, 'scripts', 'telemetry-command-invocation.cjs');

// ---------- Fixture scaffolding ----------

function mkTmpHome(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-121-03-ci-' + prefix + '-'));
}

function rmRf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) {}
}

function listEventFiles(homeDir) {
  const v113 = path.join(homeDir, '.mindrian', 'telemetry', 'v1.13');
  if (!fs.existsSync(v113)) return [];
  return fs.readdirSync(v113).filter(function (f) { return /^events-\d{4}-W\d{2}\.jsonl$/.test(f); }).map(function (f) { return path.join(v113, f); });
}

function readJsonl(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split('\n').filter(function (l) { return l.length > 0; });
  return lines.map(function (l) { return JSON.parse(l); });
}

function freshRequireHook() {
  try { delete require.cache[require.resolve(HOOK_PATH)]; } catch (_) {}
  return require(HOOK_PATH);
}

function runHookWithEnv(envOverrides, homeDir) {
  const orig = {};
  // Snapshot every key we are about to override; restore on exit.
  const allKeys = ['CLAUDE_TOOL_COMMAND', 'CLAUDE_TOOL_OUTCOME', 'CLAUDE_TOOL_DURATION_MS', 'CLAUDE_SESSION_ID', 'PWD', 'HOME'];
  for (const k of allKeys) { orig[k] = process.env[k]; }
  process.env.HOME = homeDir;
  for (const [k, v] of Object.entries(envOverrides)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    // Re-require so the writer picks up the new HOME for its internal
    // homeDir() call (writer reads env at emit-time, but we force a fresh
    // module each time for paranoia + symmetry with other 121-03 tests).
    //
    // NOTE: tests call processInvocation() (the non-exiting variant), not
    // main() -- main() always terminates the runtime via process.exit(0)
    // because the CLI path is a PostToolUse hook that must never propagate
    // errors back to the Claude Code runtime.
    const hook = freshRequireHook();
    hook.processInvocation();
  } catch (_e) {
    // The hook is best-effort by contract (processInvocation swallows all
    // internal errors). If we land here it's a test-harness bug; surface it.
    throw _e;
  } finally {
    for (const k of allKeys) {
      if (orig[k] === undefined) delete process.env[k];
      else process.env[k] = orig[k];
    }
  }
}

let passed = 0;
let failed = 0;
function recordPass(name) { passed++; console.log('PASS: ' + name); }
function recordFail(name, e) { failed++; console.error('FAIL: ' + name + ' :: ' + (e && e.message ? e.message : e)); }

// ---------- Test 1: /mos:scout + success + 1500ms emits one row ----------

(function test1MosScoutSuccess() {
  const tmp = mkTmpHome('t1');
  try {
    runHookWithEnv({
      CLAUDE_TOOL_COMMAND: '/mos:scout',
      CLAUDE_TOOL_OUTCOME: 'success',
      CLAUDE_TOOL_DURATION_MS: '1500',
      CLAUDE_SESSION_ID: 'sess-test-1',
      PWD: '/tmp/fake-cwd',
    }, tmp);
    const files = listEventFiles(tmp);
    assert.equal(files.length, 1, 't1: one ISO-week file');
    const events = readJsonl(files[0]);
    assert.equal(events.length, 1, 't1: one event');
    const e = events[0];
    assert.equal(e.event, 'command_invocation', 't1: event type');
    assert.equal(e.command, '/mos:scout', 't1: command');
    assert.equal(e.outcome, 'success', 't1: outcome');
    assert.equal(e.duration_ms, 1500, 't1: duration_ms');
    assert.equal(typeof e.context_hash, 'string', 't1: context_hash is string');
    recordPass('t1: /mos:scout success 1500ms emits one well-formed row');
  } catch (e) {
    recordFail('t1: /mos:scout success', e);
  } finally {
    rmRf(tmp);
  }
})();

// ---------- Test 2: non-/mos: tool produces no event ----------

(function test2NonMosFiltered() {
  const tmp = mkTmpHome('t2');
  try {
    runHookWithEnv({
      CLAUDE_TOOL_COMMAND: 'Read',
      CLAUDE_TOOL_OUTCOME: 'success',
      CLAUDE_TOOL_DURATION_MS: '50',
    }, tmp);
    runHookWithEnv({
      CLAUDE_TOOL_COMMAND: '',
      CLAUDE_TOOL_OUTCOME: 'success',
    }, tmp);
    runHookWithEnv({
      CLAUDE_TOOL_COMMAND: 'Edit',
    }, tmp);
    const files = listEventFiles(tmp);
    // The filter may not even create the dir if nothing was emitted.
    if (files.length === 0) {
      recordPass('t2: non-/mos: tool produces no event (no file created)');
      return;
    }
    // If the file exists, it must be empty (no /mos: rows landed).
    const events = readJsonl(files[0]);
    assert.equal(events.length, 0, 't2: zero events landed for non-/mos: tools');
    recordPass('t2: non-/mos: tool produces no event (empty file)');
  } catch (e) {
    recordFail('t2: non-/mos: tool filtered', e);
  } finally {
    rmRf(tmp);
  }
})();

// ---------- Test 3: context_hash <= 16 chars ----------

(function test3ContextHashLength() {
  const tmp = mkTmpHome('t3');
  try {
    runHookWithEnv({
      CLAUDE_TOOL_COMMAND: '/mos:status',
      CLAUDE_TOOL_OUTCOME: 'success',
      CLAUDE_TOOL_DURATION_MS: '100',
      CLAUDE_SESSION_ID: 'x'.repeat(200),  // long input
      PWD: '/tmp/' + 'y'.repeat(500),       // long input
    }, tmp);
    const files = listEventFiles(tmp);
    assert.equal(files.length, 1, 't3: one ISO-week file');
    const events = readJsonl(files[0]);
    assert.equal(events.length, 1, 't3: one event');
    const ctx = events[0].context_hash;
    assert.ok(typeof ctx === 'string', 't3: context_hash is string');
    assert.ok(ctx.length <= 16, 't3: context_hash length <= 16; got ' + ctx.length);
    assert.ok(/^[0-9a-f]+$/.test(ctx), 't3: context_hash is hex');
    recordPass('t3: context_hash <= 16 chars (matches MAX_CONTEXT_HASH_LEN)');
  } catch (e) {
    recordFail('t3: context_hash length', e);
  } finally {
    rmRf(tmp);
  }
})();

// ---------- Test 4: missing CLAUDE_TOOL_DURATION_MS defaults to 0 ----------

(function test4DurationDefault() {
  const tmp = mkTmpHome('t4');
  try {
    runHookWithEnv({
      CLAUDE_TOOL_COMMAND: '/mos:think-hats',
      CLAUDE_TOOL_OUTCOME: 'success',
      CLAUDE_TOOL_DURATION_MS: undefined,  // explicitly absent
    }, tmp);
    const files = listEventFiles(tmp);
    assert.equal(files.length, 1, 't4: one ISO-week file');
    const events = readJsonl(files[0]);
    assert.equal(events.length, 1, 't4: one event');
    assert.equal(events[0].duration_ms, 0, 't4: duration_ms defaults to 0');
    recordPass('t4: missing CLAUDE_TOOL_DURATION_MS defaults to 0');
  } catch (e) {
    recordFail('t4: duration default', e);
  } finally {
    rmRf(tmp);
  }
})();

// ---------- Test 5: 100 /mos:* invocations land in same ISO-week file ----------

(function test5HundredInvocationsSameWeek() {
  const tmp = mkTmpHome('t5');
  try {
    for (let i = 0; i < 100; i++) {
      runHookWithEnv({
        CLAUDE_TOOL_COMMAND: '/mos:scout',
        CLAUDE_TOOL_OUTCOME: 'success',
        CLAUDE_TOOL_DURATION_MS: String(100 + i),
        CLAUDE_SESSION_ID: 'sess-' + i,
        PWD: '/tmp/r-' + i,
      }, tmp);
    }
    const files = listEventFiles(tmp);
    assert.equal(files.length, 1, 't5: exactly ONE ISO-week file');
    const events = readJsonl(files[0]);
    assert.equal(events.length, 100, 't5: exactly 100 rows');
    for (const e of events) {
      assert.equal(e.event, 'command_invocation', 't5: every row has type discriminator preserved');
    }
    recordPass('t5: 100 /mos:* invocations land in same ISO-week file; type discriminator preserved');
  } catch (e) {
    recordFail('t5: 100 invocations same week', e);
  } finally {
    rmRf(tmp);
  }
})();

// ---------- Summary ----------

const total = passed + failed;
console.log('');
console.log(passed + '/' + total + ' tests passed');
if (failed > 0) process.exit(1);
process.exit(0);
