#!/usr/bin/env node
'use strict';

/**
 * Phase 369-04 (TS369-07, D-18) -- the SSE event vocabulary pin.
 *
 * lib/mcp/sse-event-bus.cjs EVENT_KINDS is frozen and additive-only. Before
 * Phase 369 nothing pinned it (only test-198-local-only greps the file for
 * the Part 8 floor). This is that pin:
 *
 *   1. the three original kinds are unchanged and in order
 *   2. the list is frozen
 *   3. every kind after those three appears, in order, in ADDITIVE_ALLOWED
 *      (a kind added without updating this pin fails)
 *   4. the module source carries no Brain or network token outside comments
 *      (the Part 8 floor, restated)
 *
 * No em-dashes (hyphens only). CJS.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const BUS = path.resolve(__dirname, '..', 'lib', 'mcp', 'sse-event-bus.cjs');
const { EVENT_KINDS } = require(BUS);

const ORIGINAL_KINDS = ['status-segment', 'gate-fired', 'reconcile-raised'];
// Later kinds, in the order they may be appended. Adding a kind to the bus
// means adding it here in the same change, deliberately.
const ADDITIVE_ALLOWED = ['room.changed'];

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('  ok ' + name);
  } catch (err) {
    failed += 1;
    console.log('  FAIL ' + name);
    console.log('    ' + (err && err.message ? err.message : String(err)));
  }
}

// Strip block and line comments, then string-free scan is not needed: tokens
// are searched in the code remainder, comments excluded.
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/^\s*\/\/.*$/, '').replace(/\s\/\/\s.*$/, ''))
    .join('\n');
}

test('the three original kinds are unchanged and in order', () => {
  assert.deepEqual(EVENT_KINDS.slice(0, 3), ORIGINAL_KINDS);
});

test('EVENT_KINDS is frozen', () => {
  assert.equal(Object.isFrozen(EVENT_KINDS), true);
});

test('every later kind is on the explicit additive list, in order', () => {
  const extra = EVENT_KINDS.slice(3);
  const allowedPrefix = ADDITIVE_ALLOWED.slice(0, extra.length);
  assert.deepEqual(
    extra,
    allowedPrefix,
    'EVENT_KINDS after the original three must be a prefix of ADDITIVE_ALLOWED ' +
      JSON.stringify(ADDITIVE_ALLOWED) + ', got ' + JSON.stringify(extra) +
      ' (add a new kind to ADDITIVE_ALLOWED in this test, never rename or remove one)'
  );
});

test('the bus module carries no Brain or network token outside comments', () => {
  const code = codeOnly(fs.readFileSync(BUS, 'utf8'));
  for (const token of ['brain', 'theo', 'http://', 'https://']) {
    assert.equal(
      code.toLowerCase().indexOf(token),
      -1,
      'sse-event-bus.cjs code must not contain "' + token + '" (Canon Part 8)'
    );
  }
});

console.log('');
console.log('RESULT: PASS=' + passed + ' FAIL=' + failed);
process.exit(failed > 0 ? 1 : 0);
