#!/usr/bin/env node
'use strict';

/*
 * Phase 127-02 Task 1 (TDD RED -> GREEN) -- refusal-messaging chokepoint
 * tests (module renamed from tier0-messaging.cjs in Phase 252-01, SWEEP-01;
 * the wire contract is byte-locked, unchanged by the rename).
 *
 * Quick 261005-l8g (SEED-119) rewrote tests 1-7: the keyless sentinel and
 * hint are gone, so they pin the bare contract instead:
 *   Test 1: the keyless sentinel, status constant and hint are not exported.
 *   Test 2: REFUSAL_KINDS is the five honest kinds.
 *   Test 3: an unrecognized kind coerces to unreachable and names no key.
 *   Test 4: isAvailable() is true with nothing configured.
 *   Test 5: the shim delegates to the chokepoint and has no keyless branch.
 *   Test 8: Plan 127-00's mindrian-brain-shim.test.cjs file still passes.
 *
 * Canon parts:
 *   - Part 7 (reuse): the shim delegates refusal shapes to this chokepoint.
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
const SHIM_PATH = path.join(REPO_ROOT, 'scripts', 'mindrian-brain-mcp-client.cjs');
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
// Quick 261005-l8g (SEED-119): the keyless refusal kind, its sentinel and its
// hint are GONE. Theo is called bare, so these tests now pin the bare contract.
// ---------------------------------------------------------------------------

// Test 1: the keyless sentinel and hint are not exported any more.
(function test1_sentinel_gone() {
  const label = 'the keyless sentinel (status constant, response builder, Larry hint) is not exported';
  try {
    delete require.cache[CHOKEPOINT_PATH];
    const mod = require(CHOKEPOINT_PATH);
    assert.equal(mod.DIRECTOR_NOT_AVAILABLE, undefined, 'status constant must be gone');
    assert.equal(mod.tier0Response, undefined, 'sentinel builder must be gone');
    assert.equal(mod.larryTier0Hint, undefined, 'Larry hint must be gone');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// Test 2: the closed refusal set is the five honest kinds, with no keyless kind.
(function test2_kinds() {
  const label = 'REFUSAL_KINDS is exactly unreachable, tier_denied, not_ready, rate_limited, egress_blocked';
  try {
    delete require.cache[CHOKEPOINT_PATH];
    const mod = require(CHOKEPOINT_PATH);
    assert.deepEqual(Array.from(mod.REFUSAL_KINDS),
      ['unreachable', 'tier_denied', 'not_ready', 'rate_limited', 'egress_blocked']);
    ok(label);
  } catch (e) { fail(label, e); }
})();

// Test 3: a stale caller asking for the removed kind lands on `unreachable`, never a key prompt.
(function test3_stale_kind_coerces() {
  const label = 'an unrecognized kind coerces to unreachable and names no key';
  try {
    delete require.cache[CHOKEPOINT_PATH];
    const mod = require(CHOKEPOINT_PATH);
    const r = mod.refusalResponse('removed_kind_probe', { tool: 'brain_ask' });
    assert.equal(r.kind, 'unreachable');
    assert.equal(r.status, 'BRAIN_UNREACHABLE');
    assert.ok(!/key|Tier 0/i.test(JSON.stringify(r) + mod.renderRefusal('removed_kind_probe') + mod.larryRefusalLine('removed_kind_probe')),
      'no refusal surface may mention a key or Tier 0');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// Test 4: isAvailable() is true with nothing configured (fresh HOME, no env).
(function test4_isAvailable_true_bare() {
  const label = 'isAvailable() returns true with a fresh HOME and nothing configured';
  try {
    const tmpHome = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'refusal-msg-test-'));
    const script = 'const m = require(' + JSON.stringify(CHOKEPOINT_PATH) + ');'
      + 'process.stdout.write(JSON.stringify({ available: m.isAvailable() }));';
    const env = {};
    for (const k of Object.keys(process.env)) { if (!/^MINDRIAN_/.test(k)) env[k] = process.env[k]; }
    env.HOME = tmpHome;
    const out = cp.execFileSync(process.execPath, ['-e', script], { encoding: 'utf8', env: env });
    assert.equal(JSON.parse(out).available, true, 'isAvailable must be true with nothing configured');
    fs.rmSync(tmpHome, { recursive: true, force: true });
    ok(label);
  } catch (e) { fail(label, e); }
})();

// Test 5: the shim delegates to the chokepoint and carries no keyless branch.
(function test5_shim_delegation() {
  const label = 'shim requires the refusal chokepoint and has no keyless sentinel';
  try {
    const src = fs.readFileSync(SHIM_PATH, 'utf8');
    assert.match(src, /require\(['"][^'"]*refusal-messaging\.cjs['"]\)/,
      'shim source must require lib/core/refusal-messaging.cjs');
    assert.ok(!/tier0Response|ensureAvailable/.test(src), 'shim must carry no keyless gate');
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
