#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * lib/memory/first-touch-version.test.cjs
 * ---------------------------------------
 * Phase 121.5-05 Sub-plan F Task 1 acceptance tests.
 *
 * 8 tests covering the first-touch-version-stamper module:
 *
 *   1. stampVersion('banner', '1.13.0-beta.15') contains "MindrianOS v1.13.0-beta.15"
 *   2. stampVersion('splash', '1.13.0') starts with "MindrianOS v1.13.0"
 *   3. stampVersion('onboard', '1.14.0') embeds "MindrianOS v1.14.0"
 *   4. stampVersion(<unknown_surface>, version) throws Error('unknown_surface: ...')
 *   5. stampVersion called without version arg auto-resolves from plugin.json
 *   6. data/first-touch-surfaces.json parses; surfaces[] length >= 6
 *   7. hasEmDash(text) returns true on U+2014, false otherwise
 *   8. scripts/banner output contains "MindrianOS v" + live plugin.json version
 *
 * Pure CJS, node built-ins only. No emoji. No em-dashes.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const stamperPath = path.join(REPO_ROOT, 'lib', 'core', 'first-touch-version-stamper.cjs');
const stamper = require(stamperPath);

let passed = 0;
let failed = 0;
const failures = [];

function assert(name, cond, detail) {
  if (cond) {
    passed++;
    console.log('  PASS  ' + name);
  } else {
    failed++;
    failures.push({ name, detail });
    console.log('  FAIL  ' + name + (detail ? ' :: ' + detail : ''));
  }
}

// --- Test 1: banner stamp contains MindrianOS v<version> ----------------
{
  const out = stamper.stampVersion('banner', '1.13.0-beta.15');
  assert(
    'Test 1: stampVersion(banner, "1.13.0-beta.15") contains "MindrianOS v1.13.0-beta.15"',
    out.indexOf('MindrianOS v1.13.0-beta.15') >= 0,
    'got: ' + out,
  );
}

// --- Test 2: splash stamp starts with MindrianOS v<version> -------------
{
  const out = stamper.stampVersion('splash', '1.13.0');
  assert(
    'Test 2: stampVersion(splash, "1.13.0") starts with "MindrianOS v1.13.0"',
    out.indexOf('MindrianOS v1.13.0') === 0,
    'got: ' + out,
  );
}

// --- Test 3: onboard stamp embeds MindrianOS v<version> -----------------
{
  const out = stamper.stampVersion('onboard', '1.14.0');
  assert(
    'Test 3: stampVersion(onboard, "1.14.0") embeds "MindrianOS v1.14.0"',
    out.indexOf('MindrianOS v1.14.0') >= 0,
    'got: ' + out,
  );
}

// --- Test 4: unknown surface throws -------------------------------------
{
  let threw = false;
  let msg = '';
  try {
    stamper.stampVersion('not-a-real-surface', '1.0.0');
  } catch (e) {
    threw = true;
    msg = e.message;
  }
  assert(
    'Test 4: stampVersion(unknown_surface) throws Error(unknown_surface: ...)',
    threw && /^unknown_surface:/.test(msg),
    'threw=' + threw + ' msg=' + msg,
  );
}

// --- Test 5: no version arg -> auto-resolve from plugin.json ------------
{
  const pluginJsonPath = path.join(REPO_ROOT, '.claude-plugin', 'plugin.json');
  const liveVersion = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8')).version;
  const out = stamper.stampVersion('banner');
  assert(
    'Test 5: stampVersion(banner) auto-resolves version from plugin.json (' + liveVersion + ')',
    out.indexOf(liveVersion) >= 0,
    'got: ' + out + ' live=' + liveVersion,
  );
}

// --- Test 6: surfaces JSON parses + has >= 6 entries --------------------
{
  const surfaces = stamper.readSurfaces();
  assert(
    'Test 6: data/first-touch-surfaces.json parses; surfaces[].length >= 6',
    Array.isArray(surfaces.surfaces) && surfaces.surfaces.length >= 6,
    'length=' + (surfaces.surfaces ? surfaces.surfaces.length : 'undefined'),
  );

  // Sanity: each surface has the required keys.
  const requiredKeys = ['id', 'file', 'kind', 'version_stamp_required', 'em_dash_check'];
  let allOk = true;
  let missingDetail = '';
  for (const s of surfaces.surfaces) {
    for (const k of requiredKeys) {
      if (!(k in s)) {
        allOk = false;
        missingDetail = 'surface ' + (s.id || '?') + ' missing key ' + k;
        break;
      }
    }
    if (!allOk) break;
  }
  assert(
    'Test 6b: every surface has id / file / kind / version_stamp_required / em_dash_check',
    allOk,
    missingDetail,
  );
}

// --- Test 7: hasEmDash detects U+2014 -----------------------------------
{
  // U+2014 EM DASH, written via escape so this source stays ASCII-clean.
  const withDash = 'this has an \u2014 em dash';
  const withoutDash = 'this has a - hyphen';
  assert(
    'Test 7a: hasEmDash returns true on U+2014',
    stamper.hasEmDash(withDash) === true,
  );
  assert(
    'Test 7b: hasEmDash returns false on plain hyphen',
    stamper.hasEmDash(withoutDash) === false,
  );
  assert(
    'Test 7c: hasEmDash returns false on non-string',
    stamper.hasEmDash(null) === false && stamper.hasEmDash(42) === false,
  );
}

// --- Test 8: scripts/banner emits "MindrianOS v" + live version ---------
{
  const bannerPath = path.join(REPO_ROOT, 'scripts', 'banner');
  let bannerOut = '';
  let bannerErr = null;
  try {
    bannerOut = execSync('bash ' + JSON.stringify(bannerPath), {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: Object.assign({}, process.env, { COLUMNS: '120' }),
    });
  } catch (e) {
    bannerErr = e.message;
  }
  const liveVersion = stamper.resolveCurrentVersion();
  assert(
    'Test 8a: scripts/banner runs without error',
    bannerErr === null,
    bannerErr || '',
  );
  assert(
    'Test 8b: banner output contains "MindrianOS v"',
    bannerOut.indexOf('MindrianOS v') >= 0,
    'first 200 chars: ' + bannerOut.slice(0, 200),
  );
  assert(
    'Test 8c: banner output contains the live plugin.json version (' + liveVersion + ')',
    bannerOut.indexOf(liveVersion) >= 0,
    'live=' + liveVersion,
  );
}

// --- Summary ------------------------------------------------------------
console.log('');
console.log('first-touch-version.test.cjs: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
  for (const f of failures) {
    console.log('  - ' + f.name + (f.detail ? ' :: ' + f.detail : ''));
  }
  process.exit(1);
}
process.exit(0);
