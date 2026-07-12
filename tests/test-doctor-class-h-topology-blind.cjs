#!/usr/bin/env node
'use strict';

/*
 * RCA intern-w1-statusline-room-mismatch (2026-07-11).
 *
 * Class H (lib/core/doctor/install-incomplete-module.cjs check()/fix(), Phase
 * 95.6 D-09, migrated by Phase 217 Plan 05 out of scripts/doctor.cjs's inline
 * main() into a registry-driven cadence:always runner) never received the
 * resolveActivePluginRoot()+topology-awareness fix that Class A
 * (checkInstallVersion, in scripts/doctor.cjs) and Class I
 * (lib/core/doctor/install-state-module.cjs) already got (Phase 123 Plan-03).
 * It false-positived 'warn' on every healthy one-command marketplace install
 * (no legacy .install-receipt.json, no user-level statusLine block -- BOTH
 * normal for that topology), and its --fix path wrote a
 * ~/.claude/settings.json statusLine override pointing at the hardcoded
 * legacy INSTALL_DIR, which does not exist on a marketplace-cache-only
 * machine -- silently breaking the statusline (user-level settings override
 * plugin-level; bash exec failures never surface in chat).
 *
 * A second, independent defect (RCA evidence, 2026-07-11T01:05:00Z): Class G
 * (lib/core/doctor/statusline-visibility-module.cjs check()) Step 3 always
 * exec'd the PLUGIN's own scripts/statusline-mos directly, never the actual
 * effective user-level override -- so even after Class H wrote a broken
 * override, Class G's own re-check reported 'ok' regardless, and the
 * self-heal (scripts/check-onboard-statusline.cjs::attemptStatuslineSelfHeal)
 * declared success silently.
 *
 * This file's tests exercise the REAL (not stubbed) end-to-end CLI dispatch --
 * `node scripts/doctor.cjs --statusline-visibility [--fix] --json` -- which
 * routes through the Phase 217 accumulative engine into
 * lib/core/doctor/install-incomplete-module.cjs and
 * lib/core/doctor/statusline-visibility-module.cjs. This is unlike
 * tests/test-statusline-visibility-self-heal.cjs, which stubs doctor.cjs
 * entirely via a fake CLAUDE_PLUGIN_ROOT/scripts/doctor.cjs and therefore
 * could never have caught this:
 *
 *   h.1  marketplace-cache-only topology (no legacy INSTALL_DIR, no
 *        .install-receipt.json, no user-level statusLine block) ->
 *        report.checks['install-incomplete'].status === 'ok', NOT 'warn'.
 *   h.2  same fixture + --fix -> install-incomplete-module's fix() must NOT
 *        run (the engine's dispatch gate requires status='warn'; class H is
 *        'ok'), so ~/.claude/settings.json is never created/mutated and
 *        report.recovered carries no 'doctor-class-h' entry.
 *   h.3  legacy/dev-clone topology regression: pinning MINDRIAN_OS_ROOT at a
 *        nonexistent legacy path (topology='dev-clone', NOT
 *        'marketplace-cache') with no statusLine block must still warn +
 *        recoverable=true -- the topology guard must not swallow the
 *        legitimate legacy-flow detection (byte-identical to
 *        tests/test-doctor-class-h.cjs Test 2).
 *   h.4  Class G Step 3 widening: marketplace-cache-only topology fixture +
 *        a user-level statusLine override shaped exactly like the broken
 *        write Class H used to perform (legacy INSTALL_DIR path, does NOT
 *        match STALE_STATUSLINE_PATH_REGEX so Step 1 cannot flag it) ->
 *        report.checks['statusline-visibility'].status !== 'ok' (the
 *        effective command is broken), proving Step 3 now tests the
 *        EFFECTIVE resolved command rather than always falling back to the
 *        plugin's own (real, existing) scripts/statusline-mos file.
 *
 * Hermetic envelope mirrors tests/test-doctor-class-a-topology-drift.cjs:
 * per-test mkdtempSync HOME + USERPROFILE + MINDRIAN_PLUGIN_HOME override so
 * the resolver reads a scratch ~/.claude/plugins. Picked up by
 * tests/run-all.sh's test-*.cjs glob.
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'class-h-topo-' + suffix + '-'));
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

// -- h.1: marketplace-cache-only, no legacy artifacts -> class H reports ok --
try {
  const home = makeTmpHome('h1');
  const V = '1.15.3-beta.13';
  const mcDir = makeMarketplaceCache(home, V);
  makeInstalledPluginsJson(home, V, mcDir);
  // Critically: NO legacy dir, NO .install-receipt.json, NO user-level
  // settings.json at all -- the exact healthy marketplace-only shape.
  const { r, report } = runDoctor(home);
  assert.strictEqual(r.status, 0, 'doctor exits 0; got ' + r.status);
  assert.ok(report && report.checks, 'JSON parses + checks present');
  const c = report.checks['install-incomplete'];
  assert.ok(c, 'install-incomplete key present');
  assert.strictEqual(c.status, 'ok',
    'marketplace-cache-only topology must report class H healthy, not warn; got ' + JSON.stringify(c));
  assert.match(String(c.detail || ''), /marketplace-cache/i,
    'detail names the marketplace-cache topology; got ' + JSON.stringify(c.detail));
  rmTmp(home);
  pass('Test h.1 (marketplace-cache-only, no legacy artifacts -> class H ok)');
} catch (err) { failTest('Test h.1 (marketplace-cache-only, no legacy artifacts -> class H ok)', err); }

// -- h.2: same fixture + --fix -> fix() never runs, settings.json is never
//         created, no doctor-class-h recovery entry ------------------------
try {
  const home = makeTmpHome('h2');
  const V = '1.15.3-beta.13';
  const mcDir = makeMarketplaceCache(home, V);
  makeInstalledPluginsJson(home, V, mcDir);
  const { r, report } = runDoctor(home, ['--fix']);
  assert.strictEqual(r.status, 0, 'doctor --fix exits 0; got ' + r.status);
  const c = report.checks['install-incomplete'];
  assert.strictEqual(c.status, 'ok', 'class H stays ok post --fix; got ' + JSON.stringify(c));
  assert.ok(!fs.existsSync(settingsPath(home)),
    '--fix must NOT create ~/.claude/settings.json on a healthy marketplace-cache install '
    + '(the exact self-inflicted-breakage write this RCA fixes)');
  const recovered = (report.recovered || []).filter((x) => x && x.tool === 'doctor-class-h');
  assert.strictEqual(recovered.length, 0,
    'no doctor-class-h recovery entry expected; got ' + JSON.stringify(recovered));
  rmTmp(home);
  pass('Test h.2 (marketplace-cache-only + --fix -> no write, no recovery entry)');
} catch (err) { failTest('Test h.2 (marketplace-cache-only + --fix -> no write, no recovery entry)', err); }

// -- h.3: legacy/dev-clone topology regression (byte-identical to the
//         pre-existing test-doctor-class-h.cjs Test 2 contract) -------------
try {
  const home = makeTmpHome('h3');
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify({ agent: 'larry-extended' }));
  // MINDRIAN_OS_ROOT pinned at a nonexistent path forces topology='dev-clone'
  // (classifyTopology: source === 'MINDRIAN_OS_ROOT' -> always 'dev-clone'),
  // i.e. NOT marketplace-cache -- the topology guard must not short-circuit
  // this branch; the legacy detection logic (Steps 1-2) must still run.
  const { r, report } = runDoctor(home, [], { MINDRIAN_OS_ROOT: '/tmp/does-not-exist-class-h-topo' });
  assert.strictEqual(r.status, 0, 'doctor exits 0; got ' + r.status);
  const c = report.checks['install-incomplete'];
  assert.ok(c.status === 'warn' || c.status === 'error',
    'dev-clone topology with no statusLine block must still warn/error (no regression); got ' + c.status);
  assert.strictEqual(c.recoverable, true, 'expected recoverable=true; got ' + c.recoverable);
  rmTmp(home);
  pass('Test h.3 (dev-clone topology -> class H warn preserved, no regression)');
} catch (err) { failTest('Test h.3 (dev-clone topology -> class H warn preserved, no regression)', err); }

// -- h.4: Class G Step 3 widening -- effective (user-level) command tested,
//         not always the plugin's own (real, existing) file ----------------
try {
  const home = makeTmpHome('h4');
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
  pass('Test h.4 (Class G Step 3 tests the effective user-level command, not the plugin\'s own file)');
} catch (err) { failTest('Test h.4 (Class G Step 3 tests the effective user-level command, not the plugin\'s own file)', err); }

if (failed > 0) {
  console.log('\n' + failed + ' test(s) FAILED (' + passed + ' passed)');
  process.exit(1);
}
console.log('\nAll ' + passed + ' tests PASS');
process.exit(0);
