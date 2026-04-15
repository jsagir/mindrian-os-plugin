'use strict';

/**
 * test-session-start-node-preflight.cjs -- fixture test for the Node
 * version preflight block in scripts/session-start.
 *
 * Spoofs Node 20.0.0 via FORCE_NODE_VERSION, runs session-start, and
 * asserts:
 *   - stderr contains the verbatim friendly upgrade message
 *   - exit code is 0 (soft fail, NEVER hard-fail the Claude launch)
 *
 * Also runs a passthrough case with SESSION_START_NODE_PREFLIGHT_SKIP=1
 * and asserts session-start does not emit the preflight message.
 *
 * Requirement: WIN-FIX-B-01 (folded), plan 85-01 task 10
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const assert = require('node:assert');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const SESSION_START = path.join(PLUGIN_ROOT, 'scripts', 'session-start');

const EXPECTED_PREFIX = 'MindrianOS v1.10.9+ requires Node >= 22.5.0. You are running Node ';
const EXPECTED_SUFFIX =
  '. Please upgrade Node (nvm install 22, fnm install 22, or your package manager) and restart Claude Code. Plugin will continue with reduced functionality until Node is upgraded.';

let failures = 0;
function run(name, fn) {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (e) {
    failures += 1;
    console.log(`  FAIL ${name}`);
    console.log(`       ${e.message}`);
  }
}

console.log('test-session-start-node-preflight.cjs');

run('Node 20 spoof triggers friendly message and exit 0', () => {
  const result = spawnSync('bash', [SESSION_START], {
    env: {
      ...process.env,
      FORCE_NODE_VERSION: '20.0.0',
      // Provide a stdin payload so session-start does not hang on read.
      HOME: process.env.HOME,
    },
    input: '{}',
    encoding: 'utf8',
    timeout: 15000,
  });

  assert.strictEqual(result.status, 0, `expected exit 0, got ${result.status}`);
  const stderr = result.stderr || '';
  assert.ok(
    stderr.includes(EXPECTED_PREFIX),
    `stderr missing expected prefix. got:\n${stderr}`
  );
  assert.ok(
    stderr.includes('20.0.0'),
    `stderr missing detected version. got:\n${stderr}`
  );
  assert.ok(
    stderr.includes(EXPECTED_SUFFIX),
    `stderr missing expected suffix. got:\n${stderr}`
  );
});

run('Preflight skip bypasses the message', () => {
  const result = spawnSync('bash', [SESSION_START], {
    env: {
      ...process.env,
      SESSION_START_NODE_PREFLIGHT_SKIP: '1',
      HOME: process.env.HOME,
    },
    input: '{}',
    encoding: 'utf8',
    timeout: 20000,
  });

  // With the skip flag, the preflight block never runs, so the friendly
  // message must not appear on stderr regardless of actual Node version.
  const stderr = result.stderr || '';
  assert.ok(
    !stderr.includes(EXPECTED_PREFIX),
    `preflight message should not appear with skip flag. got:\n${stderr}`
  );
});

if (failures > 0) {
  console.log(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('\nall tests passed');
process.exit(0);
