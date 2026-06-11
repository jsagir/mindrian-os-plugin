#!/usr/bin/env node
'use strict';

/**
 * Regression (2026-06-11 session): MCP orchestration grouped sub-commands
 * (rooms-new, scout-health, act-chain, ...) returned "Reference file not
 * found" because loadReference() only tries the exact command name, while
 * the instruction files ship per command FAMILY (commands/rooms.md,
 * commands/scout.md, commands/act.md). Since the reference-prompt pattern
 * executes nothing itself, a missing reference makes the command a silent
 * no-op: rooms-new created no room.
 *
 * Contract: grouped sub-commands fall back to their family base file;
 * unknown commands still resolve to null (no accidental fallback).
 *
 * Zero test frameworks. Node built-in assert only. CJS only.
 */

const assert = require('node:assert');
const path = require('node:path');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const router = require(path.join(PLUGIN_ROOT, 'lib', 'mcp', 'tool-router.cjs'));

const loadReference = router._test && router._test.loadReference;
assert.strictEqual(typeof loadReference, 'function',
  'loadReference must be exported via module.exports._test');

let failed = 0;
function check(name, fn) {
  try {
    fn();
    process.stdout.write('  ok ' + name + '\n');
  } catch (err) {
    failed += 1;
    process.stderr.write('  FAIL ' + name + '\n    ' +
      (err && err.message ? err.message : err) + '\n');
  }
}

// Exact-name commands keep resolving (no behavior change).
check('exact command "rooms" resolves', () => {
  assert.ok(loadReference(PLUGIN_ROOT, 'rooms'), 'commands/rooms.md must load');
});

// Grouped sub-commands fall back to the family base file.
for (const cmd of ['rooms-new', 'rooms-list', 'rooms-open', 'rooms-close',
                   'rooms-archive', 'rooms-where',
                   'scout-health', 'scout-deadlines', 'scout-competitors',
                   'scout-hsi', 'scout-snapshot',
                   'act-chain', 'act-swarm', 'act-dry-run']) {
  check('grouped sub-command "' + cmd + '" falls back to family reference', () => {
    const ref = loadReference(PLUGIN_ROOT, cmd);
    assert.ok(ref && ref.length > 0, cmd + ' must resolve a non-empty reference');
  });
}

// Unknown commands must NOT accidentally fall back.
check('unknown command stays null', () => {
  assert.strictEqual(loadReference(PLUGIN_ROOT, 'totally-unknown-cmd'), null);
});

process.stdout.write('\ntool-router-grouped-reference: ' +
  (failed === 0 ? 'ALL PASS' : failed + ' FAILED') + '\n');
process.exit(failed === 0 ? 0 : 1);
