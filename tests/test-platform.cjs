'use strict';

/**
 * test-platform.cjs -- feynman-style test for lib/core/platform.cjs
 *
 * Structural checks that work on all three platforms. No Linux-only
 * assertions: detectPlatform() just has to return the shape we expect
 * for whichever OS the test happens to run on.
 *
 * Requirement: WIN-FIX-H-01
 */

const path = require('node:path');
const assert = require('node:assert');

const platform = require('../lib/core/platform.cjs');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const EXPECTED_VERSION = require('../.claude-plugin/plugin.json').version;

let failures = 0;
function run(name, fn) {
  try {
    platform.__resetForTests();
    fn();
    console.log(`  ok   ${name}`);
  } catch (e) {
    failures += 1;
    console.log(`  FAIL ${name}`);
    console.log(`       ${e.message}`);
  }
}

console.log('test-platform.cjs');

run('detectPlatform returns known os', () => {
  const info = platform.detectPlatform();
  assert.ok(['win32', 'linux', 'darwin'].includes(info.os), `os was ${info.os}`);
});

run('detectPlatform returns expected shape', () => {
  const info = platform.detectPlatform();
  assert.ok(typeof info.hasPython3 === 'boolean');
  assert.ok(typeof info.hasBashNative === 'boolean');
  assert.ok(typeof info.supportsUtf8 === 'boolean');
  assert.ok('shell' in info);
  assert.ok('codePage' in info);
});

run('detectPlatform memoizes', () => {
  const a = platform.detectPlatform();
  const b = platform.detectPlatform();
  assert.strictEqual(a, b, 'expected same object reference after memoization');
});

run('__resetForTests clears cache', () => {
  const a = platform.detectPlatform();
  platform.__resetForTests();
  const b = platform.detectPlatform();
  assert.notStrictEqual(a, b, 'expected different object reference after reset');
});

run('readPluginJson returns manifest object', () => {
  const manifest = platform.readPluginJson(PLUGIN_ROOT);
  assert.ok(manifest && typeof manifest === 'object');
  assert.strictEqual(manifest.version, EXPECTED_VERSION);
});

run('getPluginVersion returns real version', () => {
  const v = platform.getPluginVersion(PLUGIN_ROOT);
  assert.strictEqual(v, EXPECTED_VERSION);
  assert.notStrictEqual(v, 'unknown');
});

run('readPluginJsonVersion matches getPluginVersion', () => {
  assert.strictEqual(
    platform.readPluginJsonVersion(PLUGIN_ROOT),
    platform.getPluginVersion(PLUGIN_ROOT)
  );
});

run('getPluginVersion returns unknown on bad path', () => {
  const v = platform.getPluginVersion('/nonexistent/plugin/root/xyz');
  assert.strictEqual(v, 'unknown');
});

run('getPluginVersion never throws', () => {
  // Should not throw for any junk input.
  platform.getPluginVersion('');
  platform.getPluginVersion('/dev/null');
  platform.getPluginVersion('/');
});

run('resolveHookScript returns absolute path', () => {
  const p = platform.resolveHookScript('session-start', PLUGIN_ROOT);
  assert.ok(path.isAbsolute(p), `expected absolute path, got ${p}`);
});

run('resolveHookScript uses platform separator', () => {
  const p = platform.resolveHookScript('session-start', PLUGIN_ROOT);
  if (process.platform === 'win32') {
    assert.ok(
      p.endsWith('scripts\\session-start'),
      `expected backslash path on win32, got ${p}`
    );
  } else {
    // Linux and darwin both use forward slashes.
    assert.ok(
      p.endsWith('scripts/session-start'),
      `expected forward-slash path on ${process.platform}, got ${p}`
    );
  }
});

run('resolveHookScript defaults pluginRoot to repo root', () => {
  const p = platform.resolveHookScript('session-start');
  assert.ok(path.isAbsolute(p));
  assert.ok(p.includes('scripts'));
});

if (failures > 0) {
  console.log(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('\nall tests passed');
process.exit(0);
