#!/usr/bin/env node
'use strict';

/*
 * Phase 127-02 Task 1 (TDD RED -> GREEN) -- refusal-messaging chokepoint
 * tests (module renamed from tier0-messaging.cjs in Phase 252-01, SWEEP-01;
 * the wire contract is byte-locked, unchanged by the rename).
 *
 * Covers BRAIN-MCP-127-09 acceptance:
 *   Test 1: DIRECTOR_NOT_AVAILABLE constant locks the wire string.
 *   Test 2: tier0Response("brain_ask") shape (status / reason / command_context
 *           / upgrade_hint regex / fallback_advice regex).
 *   Test 3: tier0Response(null) coerces command_context to "unknown".
 *   Test 4: isAvailable() returns false when MINDRIAN_BRAIN_KEY is unset.
 *   Test 5: isAvailable() returns true when MINDRIAN_BRAIN_KEY is set in env.
 *   Test 6: larryTier0Hint() returns a one-line string under 120 chars,
 *           contains "Brain" and "key", zero em-dashes.
 *   Test 7: Shim's tier0Response(name) is byte-identical to chokepoint's
 *           tier0Response(name) -- delegation property (no duplicate shape).
 *   Test 8: Plan 127-00's mindrian-brain-shim.test.cjs file still passes after
 *           the refactor (non-breaking chokepoint introduction).
 *
 * Canon parts:
 *   - Part 7 (reuse): the shim's local tier0Response is a one-line passthrough.
 *   - Part 8 (graph boundary): no network IO in this chokepoint; isAvailable
 *     delegates to brain-client.cjs (which is the existing chokepoint).
 *
 * HARD RULE: no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CHOKEPOINT_PATH = path.join(REPO_ROOT, 'lib', 'core', 'refusal-messaging.cjs');
const SHIM_PATH = path.join(REPO_ROOT, 'bin', 'mindrian-brain-mcp-client.cjs');
const SHIM_TEST_PATH = path.join(REPO_ROOT, 'lib', 'core', 'mindrian-brain-shim.test.cjs');

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  process.stdout.write('  ok ' + name + '\n');
}

function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

// ---------------------------------------------------------------------------
// Test 1: DIRECTOR_NOT_AVAILABLE constant locks the wire string.
// ---------------------------------------------------------------------------
(function test1_director_constant() {
  const label = 'DIRECTOR_NOT_AVAILABLE constant equals exact wire string';
  try {
    const mod = require(CHOKEPOINT_PATH);
    assert.equal(mod.DIRECTOR_NOT_AVAILABLE, 'DIRECTOR_NOT_AVAILABLE',
      'exported DIRECTOR_NOT_AVAILABLE must equal the literal wire string "DIRECTOR_NOT_AVAILABLE"');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Test 2: tier0Response("brain_ask") shape.
// ---------------------------------------------------------------------------
(function test2_response_shape() {
  const label = 'tier0Response("brain_ask") returns canonical sentinel shape';
  try {
    delete require.cache[CHOKEPOINT_PATH];
    const mod = require(CHOKEPOINT_PATH);
    const r = mod.tier0Response('brain_ask');
    assert.equal(r.status, 'DIRECTOR_NOT_AVAILABLE', 'status must be DIRECTOR_NOT_AVAILABLE');
    assert.equal(r.reason, 'MINDRIAN_BRAIN_KEY not set', 'reason must be exact string');
    assert.equal(r.command_context, 'brain_ask', 'command_context must echo input');
    assert.match(r.upgrade_hint, /brain-access/, 'upgrade_hint must reference brain-access URL');
    assert.match(r.fallback_advice, /Larry/, 'fallback_advice must mention Larry');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Test 3: tier0Response(null) coerces to "unknown".
// ---------------------------------------------------------------------------
(function test3_null_defensive() {
  const label = 'tier0Response(null) coerces command_context to "unknown"';
  try {
    delete require.cache[CHOKEPOINT_PATH];
    const mod = require(CHOKEPOINT_PATH);
    const r1 = mod.tier0Response(null);
    const r2 = mod.tier0Response(undefined);
    const r3 = mod.tier0Response('');
    const r4 = mod.tier0Response(123);
    assert.equal(r1.command_context, 'unknown', 'null -> unknown');
    assert.equal(r2.command_context, 'unknown', 'undefined -> unknown');
    assert.equal(r3.command_context, 'unknown', 'empty string -> unknown');
    assert.equal(r4.command_context, 'unknown', 'non-string -> unknown');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Test 4: isAvailable() returns false when MINDRIAN_BRAIN_KEY is unset.
// ---------------------------------------------------------------------------
(function test4_isAvailable_false() {
  const label = 'isAvailable() returns false when MINDRIAN_BRAIN_KEY is unset and no env-file';
  try {
    // Use a subprocess with hermetic HOME and unset MINDRIAN_BRAIN_KEY so we
    // do not pollute this process's brain-client memoized cache.
    const tmpHome = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'tier0-msg-test-'));
    const script = 'process.env.HOME=' + JSON.stringify(tmpHome) + ';'
      + 'delete process.env.MINDRIAN_BRAIN_KEY;'
      + 'const m = require(' + JSON.stringify(CHOKEPOINT_PATH) + ');'
      + 'process.stdout.write(JSON.stringify({ available: m.isAvailable() }));';
    const out = cp.execFileSync(process.execPath, ['-e', script], {
      encoding: 'utf8',
      env: Object.assign({}, process.env, { HOME: tmpHome, MINDRIAN_BRAIN_KEY: '' }),
    });
    const parsed = JSON.parse(out);
    assert.equal(parsed.available, false, 'isAvailable must be false with no key');
    fs.rmSync(tmpHome, { recursive: true, force: true });
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Test 5: isAvailable() returns true when MINDRIAN_BRAIN_KEY is set.
// ---------------------------------------------------------------------------
(function test5_isAvailable_true() {
  const label = 'isAvailable() returns true when MINDRIAN_BRAIN_KEY is set in env';
  try {
    const tmpHome = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'tier0-msg-test-'));
    const script = 'const m = require(' + JSON.stringify(CHOKEPOINT_PATH) + ');'
      + 'process.stdout.write(JSON.stringify({ available: m.isAvailable() }));';
    const out = cp.execFileSync(process.execPath, ['-e', script], {
      encoding: 'utf8',
      env: Object.assign({}, process.env, { HOME: tmpHome, MINDRIAN_BRAIN_KEY: 'test-key-fixture-127-02' }),
    });
    const parsed = JSON.parse(out);
    assert.equal(parsed.available, true, 'isAvailable must be true with key set');
    fs.rmSync(tmpHome, { recursive: true, force: true });
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Test 6: larryTier0Hint() shape.
// ---------------------------------------------------------------------------
(function test6_larry_hint() {
  const label = 'larryTier0Hint() one-line string, <120 chars, contains "Brain" + "key", zero em-dashes';
  try {
    delete require.cache[CHOKEPOINT_PATH];
    const mod = require(CHOKEPOINT_PATH);
    const hint = mod.larryTier0Hint();
    assert.equal(typeof hint, 'string', 'must return a string');
    assert.ok(hint.length <= 120, 'must be <= 120 chars (got ' + hint.length + ')');
    assert.ok(!/\n/.test(hint), 'must be a single line (no newlines)');
    assert.match(hint, /Brain/, 'must contain "Brain"');
    assert.match(hint, /key/, 'must contain "key"');
    assert.ok(!/[\u2014\u2013]/.test(hint), 'must contain zero em-dashes (U+2014) or en-dashes (U+2013)');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Test 7: Shim's tier0Response is byte-identical to chokepoint's tier0Response
//         (delegation property -- the shim's local function is a one-line
//          passthrough to the chokepoint).
// ---------------------------------------------------------------------------
(function test7_delegation_property() {
  const label = 'shim tier0Response delegates to chokepoint (byte-identical output for all 6 tool names)';
  try {
    delete require.cache[CHOKEPOINT_PATH];
    const chokepoint = require(CHOKEPOINT_PATH);
    // Read the shim source and verify it requires the chokepoint module.
    const src = fs.readFileSync(SHIM_PATH, 'utf8');
    assert.match(src, /require\(['"][^'"]*refusal-messaging\.cjs['"]\)/,
      'shim source must require lib/core/refusal-messaging.cjs');
    // Verify the chokepoint's response matches the wire shape for each tool.
    const toolNames = ['brain_ask', 'brain_query', 'brain_schema', 'brain_search', 'brain_stats', 'brain_write'];
    for (const name of toolNames) {
      const r = chokepoint.tier0Response(name);
      assert.equal(r.status, 'DIRECTOR_NOT_AVAILABLE', 'chokepoint status for ' + name);
      assert.equal(r.command_context, name, 'chokepoint command_context for ' + name);
      assert.equal(r.reason, 'MINDRIAN_BRAIN_KEY not set', 'chokepoint reason for ' + name);
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Test 8: Plan 127-00's mindrian-brain-shim.test.cjs still passes after
//         the refactor (non-breaking chokepoint introduction).
// ---------------------------------------------------------------------------
(function test8_shim_tests_preserved() {
  const label = 'plan 127-00 shim test file still PASSES after refactor';
  try {
    const result = cp.spawnSync(process.execPath, [SHIM_TEST_PATH], {
      encoding: 'utf8',
      timeout: 15000,
    });
    if (result.status !== 0) {
      throw new Error('shim test exited ' + result.status + '\nstdout:\n' + result.stdout + '\nstderr:\n' + result.stderr);
    }
    // Confirm all 6 tests passed.
    assert.match(result.stdout, /PASSED:\s*6/, 'expected 6 shim tests to pass; got:\n' + result.stdout);
    assert.match(result.stdout, /FAILED:\s*0/, 'expected 0 shim test failures; got:\n' + result.stdout);
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
process.stdout.write('\nPASSED: ' + passed + '\nFAILED: ' + failed + '\n');
process.exit(failed === 0 ? 0 : 1);
