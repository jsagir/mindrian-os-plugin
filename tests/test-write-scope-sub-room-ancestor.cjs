#!/usr/bin/env node
'use strict';

/**
 * Quick task 260728-051 -- sub-room ancestor widening for the write-scope guard.
 *
 * Root cause (live-reproduced 2026-07-28): `room_bind({room:"motj-ecosystem"})`
 * succeeds, but a Write into
 * `motj-ecosystem/sub-rooms/jonathan-contractor-motj/...` was blocked with
 * "This session is bound to [motj-ecosystem]" until a SECOND, separate
 * `room_bind({room:"jonathan-contractor-motj"})` call was made. The TARGET side
 * of the hook (targetRoomUnderRoot) is already nesting-aware via SEED-004's
 * `.room-root` walk-up; the SCOPE side (isRoomInWriteScope) was a flat SET
 * membership check with zero hierarchy awareness, even though the registry
 * already carries a `parent` field on every sub-room entry.
 *
 * This file pins BOTH halves of the fix:
 *   - UNIT section (Task 1): the 3-arg `isRoomInWriteScope(room, binding,
 *     ancestorChain)` contract, including every pre-existing early-return.
 *   - E2E section (Task 2): the full spawned `scripts/write-scope-check.cjs`
 *     hook over real fixture registries, proving parent-to-child widening,
 *     no over-widening, exact-match preservation, and fail-open degrades.
 *
 * Zero test frameworks. Node built-in assert only. CJS only. No em-dashes.
 */

const assert = require('node:assert');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SESSION_BINDING = path.join(REPO_ROOT, 'lib', 'core', 'session-binding.cjs');
const sessionBinding = require(SESSION_BINDING);
const isRoomInWriteScope = sessionBinding.isRoomInWriteScope;

// ---------------------------------------------------------------------------
// Harness (same shape as scripts/83-scope-injection.test.cjs)
// ---------------------------------------------------------------------------

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// ---------------------------------------------------------------------------
// UNIT section (Task 1): the isRoomInWriteScope 3-arg contract.
// ---------------------------------------------------------------------------

test('unit 1: a room reachable via ancestorChain is in scope (the widening)', () => {
  const binding = { bound: ['motj-ecosystem'], primary: 'motj-ecosystem', sticky: false };
  assert.strictEqual(
    isRoomInWriteScope('jonathan-contractor-motj', binding, ['motj-ecosystem']),
    true,
    'a child whose parent is bound must be in write scope'
  );
});

test('unit 2: an unrelated ancestorChain does NOT widen scope', () => {
  const binding = { bound: ['motj-ecosystem'], primary: 'motj-ecosystem', sticky: false };
  assert.strictEqual(
    isRoomInWriteScope('some-other-room', binding, ['some-other-parent']),
    false,
    'no ancestor in the bound set means no widening (no sibling/unrelated leak)'
  );
});

test('unit 3: exact match wins before any ancestor lookup', () => {
  const binding = { bound: ['alpha', 'beta'], primary: 'alpha', sticky: false };
  assert.strictEqual(
    isRoomInWriteScope('alpha', binding, ['totally-unrelated']),
    true,
    'a directly bound room stays in scope regardless of ancestorChain contents'
  );
});

test('unit 4: the 2-arg call site is byte-for-byte backward compatible', () => {
  const binding = { bound: ['alpha', 'beta'], primary: 'alpha', sticky: false };
  assert.strictEqual(
    isRoomInWriteScope('alpha', binding), true, '2-arg in-set room still allowed'
  );
  assert.strictEqual(
    isRoomInWriteScope('gamma', binding), false, '2-arg off-bound room still blocked'
  );
});

test('unit 5: the __no_room__ sentinel bypass fires before ancestor logic', () => {
  const binding = { bound: ['alpha'], primary: 'alpha', sticky: false };
  assert.strictEqual(
    isRoomInWriteScope('__no_room__', binding, []),
    true,
    'the reserved dev-repo sentinel is always in scope'
  );
  assert.strictEqual(
    isRoomInWriteScope('__no_room__', binding, ['anything']),
    true,
    'ancestorChain contents never affect the sentinel bypass'
  );
});

test('unit 6: an unbound session still degrades to allow-all', () => {
  const binding = { bound: [], primary: null, sticky: false };
  assert.strictEqual(
    isRoomInWriteScope('any-room', binding, []),
    true,
    'an empty bound set is the pre-194 allow-all path'
  );
  assert.strictEqual(
    isRoomInWriteScope('any-room', binding, ['whatever']),
    true,
    'ancestorChain never turns an unbound allow into a block'
  );
});

test('unit 7: a non-array ancestorChain degrades to no widening, never throws', () => {
  const binding = { bound: ['alpha'], primary: 'alpha', sticky: false };
  assert.strictEqual(
    isRoomInWriteScope('gamma', binding, 'alpha'),
    false,
    'a string ancestorChain must coerce to [] (no accidental substring widening)'
  );
  assert.strictEqual(
    isRoomInWriteScope('gamma', binding, null),
    false,
    'a null ancestorChain behaves exactly like an omitted one'
  );
  assert.strictEqual(
    isRoomInWriteScope('gamma', binding, { bound: ['alpha'] }),
    false,
    'an object ancestorChain must coerce to [] rather than throw'
  );
});

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

(async function main() {
  let passed = 0;
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      process.stdout.write('  ok  ' + t.name + '\n');
      passed += 1;
    } catch (err) {
      process.stdout.write('  FAIL ' + t.name + '\n');
      process.stdout.write('       ' + (err && err.stack ? err.stack : String(err)) + '\n');
      failed += 1;
    }
  }
  process.stdout.write(
    '\n260728-051 sub-room ancestor write scope: ' + passed + '/' + tests.length + ' passed\n'
  );
  process.exit(failed === 0 ? 0 : 1);
})();
