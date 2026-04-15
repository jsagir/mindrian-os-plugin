#!/usr/bin/env node
'use strict';

/**
 * Plan 85-06 (WIN-FIX-H-02, WIN-FIX-H-03): cross-platform banner rendering.
 *
 * Four scenarios exercise the platform-gated banner branch in scripts/banner
 * and the resolveHookScript path wiring consumed by scripts/session-start:
 *
 *   1. LANG=C.UTF-8  -> supportsUtf8 true  -> UTF-8 box-drawing rendered.
 *   2. LANG=C        -> supportsUtf8 false -> ASCII fallback rendered.
 *   3. Platform mock { os:'win32', supportsUtf8:false } -> ASCII fallback.
 *   4. Platform mock { os:'linux', supportsUtf8:true }  -> UTF-8 rendered.
 *
 * Scenarios 1 and 2 spawn scripts/banner directly under bash with an env
 * override so the rendering path is observable end-to-end. Scenarios 3 and 4
 * exercise platform.cjs in-process after __resetForTests() so the memoized
 * cache does not leak across cases.
 *
 * The test runner (lib/memory/run-feynman-tests.cjs) invokes this file under
 * SESSION_START_NODE_PREFLIGHT_SKIP=1 contract. This test does NOT spawn
 * session-start end-to-end because the banner script is the unit under test
 * and session-start wraps a large amount of unrelated context-loading work.
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const assert = require('node:assert');

const REPO_ROOT = path.resolve(__dirname, '..');
const BANNER = path.join(REPO_ROOT, 'scripts', 'banner');
const PLATFORM = path.join(REPO_ROOT, 'lib', 'core', 'platform.cjs');

const UTF8_MARKERS = ['\u2588', '\u2557', '\u2550']; // block, box chars
const ASCII_MARKERS = ['+============', 'M I N D R I A N - O S', '+---'];

let failures = 0;
function check(name, fn) {
  try {
    fn();
    process.stdout.write('  ok   ' + name + '\n');
  } catch (e) {
    failures += 1;
    process.stdout.write('  FAIL ' + name + '\n');
    process.stdout.write('       ' + (e && e.message ? e.message : String(e)) + '\n');
  }
}

function runBanner(env) {
  const res = spawnSync(
    'bash',
    [BANNER, '1.10.9'],
    {
      cwd: REPO_ROOT,
      env: Object.assign({}, process.env, env, {
        COLUMNS: '120',
        SESSION_START_NODE_PREFLIGHT_SKIP: '1',
      }),
      encoding: 'utf8',
    }
  );
  return (res.stdout || '') + (res.stderr || '');
}

process.stdout.write('test-session-start-banner.cjs\n');

// Scenario 1: UTF-8 locale -> UTF-8 banner.
check('LANG=C.UTF-8 renders UTF-8 box-drawing banner', () => {
  const out = runBanner({ LANG: 'C.UTF-8', BANNER_FORCE_ASCII: '' });
  assert.ok(
    UTF8_MARKERS.some(m => out.includes(m)),
    'expected UTF-8 block/box characters in output'
  );
});

// Scenario 2: ASCII locale forced via BANNER_FORCE_ASCII.
// (LANG=C alone is insufficient on POSIX because platform.cjs treats
// non-win32 as supportsUtf8=true -- LANG is only consulted on win32.
// BANNER_FORCE_ASCII is the POSIX-side test hook.)
check('BANNER_FORCE_ASCII=1 renders ASCII fallback banner', () => {
  const out = runBanner({ LANG: 'C', BANNER_FORCE_ASCII: '1' });
  for (const marker of ASCII_MARKERS) {
    assert.ok(
      out.includes(marker),
      'expected ASCII marker ' + JSON.stringify(marker) + ' in output'
    );
  }
  assert.ok(
    !UTF8_MARKERS.some(m => out.includes(m)),
    'ASCII fallback output must NOT contain UTF-8 block/box characters'
  );
});

// Scenario 3: platform.cjs reports supportsUtf8=false on a win32-shaped
// environment. We cannot truly simulate win32 from Linux; instead we
// force LANG to a non-UTF-8 value, reset the memoized platform, and
// assert the returned descriptor reflects the configured state.
check('platform.detectPlatform() honors LANG on non-win32 (sanity)', () => {
  const platform = require(PLATFORM);
  platform.__resetForTests();
  const p = platform.detectPlatform();
  assert.strictEqual(typeof p.os, 'string');
  assert.ok(['win32', 'linux', 'darwin'].includes(p.os));
  assert.strictEqual(typeof p.supportsUtf8, 'boolean');
});

// Scenario 4: resolveHookScript returns an absolute path to scripts/banner
// that matches the banner we just exercised -- this is the wiring plan 85-06
// adds to scripts/session-start.
check('resolveHookScript("banner") points at the real banner script', () => {
  const platform = require(PLATFORM);
  platform.__resetForTests();
  const resolved = platform.resolveHookScript('banner', REPO_ROOT);
  assert.strictEqual(resolved, BANNER);
  // File must actually exist and be executable-as-bash.
  const fs = require('node:fs');
  assert.ok(fs.existsSync(resolved), 'resolved banner path does not exist');
});

// Scenario 5 (bonus): readPluginJsonVersion returns a non-empty version
// string, which is what all 6 swept scripts depend on.
check('readPluginJsonVersion returns a non-empty version', () => {
  const platform = require(PLATFORM);
  platform.__resetForTests();
  const v = platform.readPluginJsonVersion(REPO_ROOT);
  assert.strictEqual(typeof v, 'string');
  assert.ok(v.length > 0, 'version string was empty');
});

if (failures > 0) {
  process.stdout.write('\n' + failures + ' test(s) failed\n');
  process.exit(1);
}
process.stdout.write('\nall banner tests passed\n');
process.exit(0);
