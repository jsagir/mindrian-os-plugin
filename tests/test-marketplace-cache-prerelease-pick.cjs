#!/usr/bin/env node
'use strict';

/*
 * Phase 126-02 Plan 02 -- marketplace-cache prerelease semver-pick fixture.
 *
 * Closes the dogfood finding (3b): on a Windows machine with marketplace
 * cache containing both `1.13.0-beta.9/` and `1.13.0-beta.13/`, doctor
 * recovered the install at `1.13.0-beta.9` (NOT beta.13). The cache-pick
 * `cmpVersion` helper in scripts/doctor.cjs (lines 194-205) compared
 * prereleases via `localeCompare` which sorts STRINGS lexicographically:
 * `"beta.10"` < `"beta.9"` lexicographically because `'1'` < `'9'` as ASCII.
 * The correct ordering treats numeric components NUMERICALLY:
 * `beta.9 < beta.10 < beta.13`.
 *
 * Five scenarios cover the prerelease ordering edge cases:
 *   1. beta.9 vs beta.13            -> beta.13 wins (the original dogfood bug)
 *   2. beta.13 vs beta.14           -> beta.14 wins (newer beta)
 *   3. beta.13 vs rc.1              -> rc.1 wins (rc > beta per spec)
 *   4. beta.13 vs stable 1.13.0     -> 1.13.0 wins (stable > any prerelease)
 *   5. 1.13.0 vs 1.14.0-beta.1      -> 1.14.0-beta.1 wins (newer minor's
 *                                      prerelease > older stable)
 *
 * Hermetic envelope: per-test mkdtempSync HOME + USERPROFILE +
 * MINDRIAN_PLUGIN_HOME override so doctor.cjs reads scratch
 * ~/.claude/plugins. Mirrors tests/test-doctor-class-i.cjs.
 *
 * Asserts against the doctor.cjs --json `cache.latest` field (the
 * `checkMarketplaceCache` result block; see scripts/doctor.cjs line 224 +
 * line 2611 + line 2872).
 *
 * RED until Plan 126-02 Task 2 replaces cmpVersion's localeCompare branch
 * with semver.compare from the semver@^7.7.4 package (already in
 * package.json devDeps; reuse per Canon Part 7).
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const DOCTOR = path.join(REPO_ROOT, 'scripts', 'doctor.cjs');

let passed = 0;
let failed = 0;
function pass(name) { passed += 1; console.log('PASS: ' + name); }
function failTest(name, err) { failed += 1; console.log('FAIL: ' + name + '\n    ' + (err && err.message || err)); }

// -- Hermetic envelope helpers ---------------------------------------------

function makeTmpHome(suffix) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '126-02-prerelease-' + suffix + '-'));
  fs.mkdirSync(path.join(tmp, '.claude', 'plugins'), { recursive: true });
  return tmp;
}

function rmTmp(t) {
  try { fs.rmSync(t, { recursive: true, force: true }); } catch (_) { /* best-effort */ }
}

// Seed the marketplace cache with one version dir per input. Each dir
// contains a minimal .claude-plugin/plugin.json so doctor's parseVersion +
// checkMarketplaceCache see a valid registry entry. Mirrors
// makeMarketplaceCache in tests/test-doctor-class-i.cjs.
function seedCache(home, versions) {
  for (const v of versions) {
    const cacheDir = path.join(home, '.claude', 'plugins', 'cache', 'mindrian-marketplace', 'mos', v);
    fs.mkdirSync(path.join(cacheDir, '.claude-plugin'), { recursive: true });
    fs.writeFileSync(
      path.join(cacheDir, '.claude-plugin', 'plugin.json'),
      JSON.stringify({ name: 'mos', version: v }, null, 2)
    );
    fs.mkdirSync(path.join(cacheDir, 'bin'), { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'bin', 'cli.js'), '#!/usr/bin/env node\n');
  }
}

// Spawn doctor.cjs --json against the scratch HOME and return the parsed
// report. Returns { r, report } so callers can inspect stderr / exit code
// on parse failure.
function invokeDoctor(home, extraArgs) {
  const env = Object.assign({}, process.env, {
    HOME: home,
    USERPROFILE: home,
    MINDRIAN_PLUGIN_HOME: path.join(home, '.claude', 'plugins'),
  });
  // Force CLI surface so non-TTY child spawn does not fall back to DESKTOP.
  if (!env.MINDRIAN_STATUSLINE_SURFACE) env.MINDRIAN_STATUSLINE_SURFACE = 'CLI';
  // Scrub MINDRIAN_OS_ROOT (would otherwise pull dev workspace).
  delete env.MINDRIAN_OS_ROOT;
  delete env.CLAUDE_DESKTOP;
  const args = [DOCTOR].concat(extraArgs || []).concat(['--json']);
  const r = spawnSync('node', args, { env, encoding: 'utf8', timeout: 30000 });
  let report = null;
  try { report = JSON.parse(r.stdout); } catch (_e) { /* leave null */ }
  return { r, report };
}

// -- Test 1: beta.9 vs beta.13 -> beta.13 wins (THE dogfood bug) -----------
try {
  const home = makeTmpHome('t1');
  seedCache(home, ['1.13.0-beta.9', '1.13.0-beta.13']);
  const { r, report } = invokeDoctor(home);
  assert.ok(report, 'doctor --json output is parseable (stderr: ' + (r.stderr || '') + ')');
  assert.ok(report.cache, 'report.cache exists');
  assert.strictEqual(report.cache.status, 'ok', 'cache status ok');
  assert.strictEqual(
    report.cache.latest, '1.13.0-beta.13',
    'Test 1: beta.13 must win over beta.9 (numeric-aware prerelease ordering); ' +
    'got ' + JSON.stringify(report.cache.latest) +
    ' -- this is the original Windows dogfood bug'
  );
  rmTmp(home);
  pass('Test 1: beta.9 vs beta.13 -> beta.13 wins');
} catch (err) { failTest('Test 1: beta.9 vs beta.13 -> beta.13 wins', err); }

// -- Test 2: beta.13 vs beta.14 -> beta.14 wins ----------------------------
try {
  const home = makeTmpHome('t2');
  seedCache(home, ['1.13.0-beta.13', '1.13.0-beta.14']);
  const { r, report } = invokeDoctor(home);
  assert.ok(report, 'doctor --json output is parseable (stderr: ' + (r.stderr || '') + ')');
  assert.strictEqual(
    report.cache.latest, '1.13.0-beta.14',
    'Test 2: beta.14 must win over beta.13 (later beta); got ' + JSON.stringify(report.cache.latest)
  );
  rmTmp(home);
  pass('Test 2: beta.13 vs beta.14 -> beta.14 wins');
} catch (err) { failTest('Test 2: beta.13 vs beta.14 -> beta.14 wins', err); }

// -- Test 3: beta.13 vs rc.1 -> rc.1 wins ----------------------------------
try {
  const home = makeTmpHome('t3');
  seedCache(home, ['1.13.0-beta.13', '1.13.0-rc.1']);
  const { r, report } = invokeDoctor(home);
  assert.ok(report, 'doctor --json output is parseable (stderr: ' + (r.stderr || '') + ')');
  assert.strictEqual(
    report.cache.latest, '1.13.0-rc.1',
    'Test 3: rc.1 must win over beta.13 (rc > beta per semver spec); got ' + JSON.stringify(report.cache.latest)
  );
  rmTmp(home);
  pass('Test 3: beta.13 vs rc.1 -> rc.1 wins');
} catch (err) { failTest('Test 3: beta.13 vs rc.1 -> rc.1 wins', err); }

// -- Test 4: beta.13 vs stable 1.13.0 -> 1.13.0 wins -----------------------
try {
  const home = makeTmpHome('t4');
  seedCache(home, ['1.13.0-beta.13', '1.13.0']);
  const { r, report } = invokeDoctor(home);
  assert.ok(report, 'doctor --json output is parseable (stderr: ' + (r.stderr || '') + ')');
  assert.strictEqual(
    report.cache.latest, '1.13.0',
    'Test 4: stable 1.13.0 must win over 1.13.0-beta.13 (stable > prerelease at same M.m.p); ' +
    'got ' + JSON.stringify(report.cache.latest)
  );
  rmTmp(home);
  pass('Test 4: beta.13 vs stable 1.13.0 -> 1.13.0 wins');
} catch (err) { failTest('Test 4: beta.13 vs stable 1.13.0 -> 1.13.0 wins', err); }

// -- Test 5: 1.13.0 vs 1.14.0-beta.1 -> 1.14.0-beta.1 wins ------------------
try {
  const home = makeTmpHome('t5');
  seedCache(home, ['1.13.0', '1.14.0-beta.1']);
  const { r, report } = invokeDoctor(home);
  assert.ok(report, 'doctor --json output is parseable (stderr: ' + (r.stderr || '') + ')');
  assert.strictEqual(
    report.cache.latest, '1.14.0-beta.1',
    'Test 5: 1.14.0-beta.1 must win over stable 1.13.0 (newer minor outranks older stable); ' +
    'got ' + JSON.stringify(report.cache.latest)
  );
  rmTmp(home);
  pass('Test 5: 1.13.0 vs 1.14.0-beta.1 -> 1.14.0-beta.1 wins');
} catch (err) { failTest('Test 5: 1.13.0 vs 1.14.0-beta.1 -> 1.14.0-beta.1 wins', err); }

if (failed > 0) {
  console.log('\n' + failed + ' test(s) FAILED (' + passed + ' passed)');
  process.exit(1);
}
console.log('\nAll ' + passed + ' tests PASS');
process.exit(0);
