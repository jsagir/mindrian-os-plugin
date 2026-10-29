#!/usr/bin/env node
'use strict';

/*
 * RCA intern-w1-statusline-room-mismatch (2026-07-11), class G half. Phase 341
 * plan 09 kept this test when the class H suites were retired.
 *
 * Class G (lib/core/doctor/statusline-visibility-module.cjs check()) Step 3 used
 * to exec the PLUGIN's own scripts/statusline-mos directly, never the actual
 * effective user-level override. So a broken user-level statusLine override
 * (the shape the retired class H --fix used to write: a path under the legacy
 * install directory) was invisible to class G, and the self-heal in
 * scripts/check-onboard-statusline.cjs declared success silently.
 *
 * This file freezes the class G half of that fix, with the REAL end-to-end CLI
 * dispatch (`node scripts/doctor.cjs --statusline-visibility --json`):
 *
 *   g.1  marketplace-cache-only topology fixture + a user-level statusLine
 *        override whose target does not exist (it does NOT match
 *        STALE_STATUSLINE_PATH_REGEX, so Step 1 cannot flag it) ->
 *        report.checks['statusline-visibility'].status !== 'ok', proving
 *        Step 3 tests the EFFECTIVE resolved command rather than the plugin's
 *        own (real, existing) scripts/statusline-mos file.
 *
 * Former arms h.1 to h.3 tested class H (install-incomplete) and were retired
 * with it: class H is unreachable after the shell installer was deleted
 * (see .planning/phases/341-(slug)/341-09-SUMMARY.md).
 *
 * Hermetic envelope: per-test mkdtempSync HOME + USERPROFILE +
 * MINDRIAN_PLUGIN_HOME override so the resolver reads a scratch
 * ~/.claude/plugins. Picked up by tests/run-all.sh's test-*.cjs glob.
 *
 * Canon Part 8: this test reads/writes only LOCAL scratch dirs. Zero network.
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
function failTest(name, err) { failed += 1; console.log('FAIL: ' + name + '\n    ' + ((err && err.message) || err)); }

function makeTmpHome(suffix) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'class-g-effective-' + suffix + '-'));
  fs.mkdirSync(path.join(tmp, '.claude', 'plugins'), { recursive: true });
  return tmp;
}

function rmTmp(t) {
  try { fs.rmSync(t, { recursive: true, force: true }); } catch (_) { /* best-effort */ }
}

// Lay down a synthetic marketplace-cache install at
// <home>/.claude/plugins/cache/mindrian-marketplace/mos/<version>/. NO legacy
// ~/.claude/plugins/mindrian-os dir, NO .install-receipt.json anywhere -- the
// exact healthy-but-false-positived shape from the RCA.
function makeMarketplaceCache(home, version) {
  const cacheDir = path.join(home, '.claude', 'plugins', 'cache', 'mindrian-marketplace', 'mos', version);
  fs.mkdirSync(path.join(cacheDir, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(
    path.join(cacheDir, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'mos', version }, null, 2)
  );
  fs.mkdirSync(path.join(cacheDir, 'bin'), { recursive: true });
  fs.writeFileSync(path.join(cacheDir, 'bin', 'cli.js'), '#!/usr/bin/env node\n');
  return cacheDir;
}

function makeInstalledPluginsJson(home, version, installPath) {
  const file = path.join(home, '.claude', 'plugins', 'installed_plugins.json');
  fs.writeFileSync(file, JSON.stringify({
    version: 2,
    plugins: {
      'mos@mindrian-marketplace': [
        { scope: 'user', installPath, version, installedAt: '2026-07-11T00:00:00Z', lastUpdated: '2026-07-11T00:00:00Z' }
      ]
    }
  }, null, 2));
}

function settingsPath(home) { return path.join(home, '.claude', 'settings.json'); }

function hermeticEnv(home, extraEnv) {
  const env = Object.assign({}, process.env, {
    HOME: home,
    USERPROFILE: home,
    MINDRIAN_PLUGIN_HOME: path.join(home, '.claude', 'plugins'),
  }, extraEnv || {});
  if (!env.MINDRIAN_STATUSLINE_SURFACE) env.MINDRIAN_STATUSLINE_SURFACE = 'CLI';
  if (!extraEnv || extraEnv.MINDRIAN_OS_ROOT === undefined) delete env.MINDRIAN_OS_ROOT;
  delete env.CLAUDE_DESKTOP;
  return env;
}

function runDoctor(home, extraArgs, extraEnv) {
  const args = [DOCTOR, '--statusline-visibility', '--json'].concat(extraArgs || []);
  const r = spawnSync('node', args, { env: hermeticEnv(home, extraEnv), encoding: 'utf8', timeout: 30000 });
  let report = null;
  try { report = JSON.parse(r.stdout); } catch (_e) { /* leave null */ }
  return { r, report };
}

// -- g.1: Class G Step 3 widening -- effective (user-level) command tested,
//         not always the plugin's own (real, existing) file ----------------
try {
  const home = makeTmpHome('g1');
  const V = '1.15.3-beta.13';
  const mcDir = makeMarketplaceCache(home, V);
  makeInstalledPluginsJson(home, V, mcDir);
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  // The EXACT shape fix() used to write: a user-level statusLine override
  // pointing at the legacy INSTALL_DIR (here: <home>/.claude/plugins/
  // mindrian-os/scripts/statusline-mos), which we deliberately never create.
  // This does NOT match STALE_STATUSLINE_PATH_REGEX (no "cache" path segment),
  // so Step 1 cannot flag it -- only a widened Step 3 can.
  const brokenTarget = path.join(home, '.claude', 'plugins', 'mindrian-os', 'scripts', 'statusline-mos');
  fs.writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify({
    agent: 'larry-extended',
    statusLine: { type: 'command', command: 'bash "' + brokenTarget + '"' },
  }, null, 2));
  assert.ok(!fs.existsSync(brokenTarget), 'sanity: the broken target must not exist');
  // Sanity: the PLUGIN's own real scripts/statusline-mos DOES exist in this
  // repo -- pre-fix Step 3 would have tested THIS file (found it, reported
  // ok) instead of the broken user-level override above.
  assert.ok(fs.existsSync(path.join(REPO_ROOT, 'scripts', 'statusline-mos')),
    'sanity: the plugin-level statusline-mos exists (pre-fix Step 3 would have masked the bug on it)');
  const { r, report } = runDoctor(home);
  assert.strictEqual(r.status, 0, 'doctor exits 0; got ' + r.status);
  const c = report.checks['statusline-visibility'];
  assert.notStrictEqual(c.status, 'ok',
    'Step 3 must catch the broken EFFECTIVE (user-level) command, not silently report ok '
    + 'against the plugin\'s own unrelated file; got ' + JSON.stringify(c));
  assert.ok(/effective|missing|corrupt/i.test(String(c.detail || '')),
    'detail names the effective-command mismatch; got ' + JSON.stringify(c.detail));
  rmTmp(home);
  pass('Test g.1 (Class G Step 3 tests the effective user-level command, not the plugin\'s own file)');
} catch (err) { failTest('Test g.1 (Class G Step 3 tests the effective user-level command, not the plugin\'s own file)', err); }

if (failed > 0) {
  console.log('\n' + failed + ' test(s) FAILED (' + passed + ' passed)');
  process.exit(1);
}
console.log('\nAll ' + passed + ' tests PASS');
process.exit(0);
