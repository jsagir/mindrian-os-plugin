#!/usr/bin/env node
'use strict';

/*
 * DRIFT-12 (RCA plugin-silent-disable-after-cc-self-upgrade) -- /mos:doctor
 * class N (plugin-enabled-state) hermetic test fixtures.
 *
 * Detection half of the install-cache failure family case 7: when
 * `claude plugin update mos@mindrian-marketplace` collides with a Claude Code
 * self-upgrade, the plugin can land DISABLED -- its key in
 * ~/.claude/settings.json `enabledPlugins` flips to false. The plugin's own
 * SessionStart hooks cannot fire while disabled, so doctor (reachable via the
 * npm `npx @mindrian_os/cli doctor` entry because the install cache + npm
 * package exist on disk regardless of the enabled flag) is the only detector
 * that runs while DISABLED.
 *
 * Module-level (pure, test-seamed):
 *   n.u1  enabledPlugins[key]=false      -> {installed:true, enabled:false}
 *   n.u2  enabledPlugins[key]=true       -> {installed:true, enabled:true}
 *   n.u3  key ABSENT from enabledPlugins -> {installed:true, enabled:null}  (unknown)
 *   n.u4  settings.json missing          -> {installed:true, enabled:null}
 *   n.u5  malformed settings.json        -> never throws; enabled:null
 *   n.u6  mindrian-os@mindrian-marketplace key shape (defensive)
 *   n.u7  not installed                  -> {installed:false}
 *
 * End-to-end (bare `doctor` run -- NO class flag, the silent-disable situation):
 *   n.1  key=false  -> class N status 'warn' (CRITICAL) + non-zero exit + fix text
 *   n.2  key=true   -> class N status 'ok' + exit 0
 *   n.3  key absent -> class N status 'ok' (unknown, not an error) + exit 0
 *
 * Hermetic envelope mirrors test-doctor-class-j.cjs.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const DOCTOR = path.join(REPO_ROOT, 'scripts', 'doctor.cjs');
const { checkPluginEnabled } = require(path.join(REPO_ROOT, 'lib', 'core', 'check-plugin-enabled.cjs'));

let passed = 0;
let failed = 0;
function pass(name) { passed += 1; console.log('PASS: ' + name); }
function failTest(name, err) { failed += 1; console.log('FAIL: ' + name + '\n    ' + (err && err.message || err)); }

function makeTmpHome(suffix) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'drift12-n-' + suffix + '-'));
  fs.mkdirSync(path.join(tmp, '.claude', 'plugins'), { recursive: true });
  return tmp;
}
function rmTmp(t) { try { fs.rmSync(t, { recursive: true, force: true }); } catch (_) { /* best-effort */ } }

function writeSettings(home, obj) {
  fs.writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify(obj, null, 2));
}
function settingsPath(home) { return path.join(home, '.claude', 'settings.json'); }
function installedPath(home) { return path.join(home, '.claude', 'plugins', 'installed_plugins.json'); }

function writeInstalled(home, key, version, installPath) {
  fs.writeFileSync(installedPath(home), JSON.stringify({
    version: 2,
    plugins: { [key]: [{ scope: 'user', installPath: installPath || '/x', version: version || '1.13.1-beta.14' }] },
  }, null, 2));
}

// A marketplace-cache install so a BARE doctor run resolves a plugin root and
// reaches the class-N block.
function makeMarketplaceCache(home, version) {
  const cacheDir = path.join(home, '.claude', 'plugins', 'cache', 'mindrian-marketplace', 'mos', version);
  fs.mkdirSync(path.join(cacheDir, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(path.join(cacheDir, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'mos', version }, null, 2));
  fs.mkdirSync(path.join(cacheDir, 'bin'), { recursive: true });
  return cacheDir;
}

function runDoctorBare(home) {
  const env = Object.assign({}, process.env, {
    HOME: home, USERPROFILE: home,
    MINDRIAN_PLUGIN_HOME: path.join(home, '.claude', 'plugins'),
  });
  delete env.MINDRIAN_OS_ROOT;
  delete env.CLAUDE_DESKTOP;
  const r = spawnSync('node', [DOCTOR, '--json'], { env, encoding: 'utf8', timeout: 30000 });
  let report = null;
  try { report = JSON.parse(r.stdout); } catch (_e) { /* leave null */ }
  return { r, report };
}

// =====================================================================
// Module-level unit tests (pure, test-seamed via opts)
// =====================================================================

// n.u1: key=false -> DISABLED
try {
  const home = makeTmpHome('u1');
  writeInstalled(home, 'mos@mindrian-marketplace');
  writeSettings(home, { enabledPlugins: { 'mos@mindrian-marketplace': false } });
  const res = checkPluginEnabled({ settingsPath: settingsPath(home), installedPluginsPath: installedPath(home) });
  assert.strictEqual(res.installed, true, 'installed');
  assert.strictEqual(res.enabled, false, 'enabled=false');
  assert.strictEqual(res.key, 'mos@mindrian-marketplace', 'key resolved');
  rmTmp(home);
  pass('Test n.u1 (key=false -> installed+enabled:false)');
} catch (err) { failTest('Test n.u1 (key=false -> installed+enabled:false)', err); }

// n.u2: key=true -> enabled
try {
  const home = makeTmpHome('u2');
  writeInstalled(home, 'mos@mindrian-marketplace');
  writeSettings(home, { enabledPlugins: { 'mos@mindrian-marketplace': true } });
  const res = checkPluginEnabled({ settingsPath: settingsPath(home), installedPluginsPath: installedPath(home) });
  assert.strictEqual(res.installed, true);
  assert.strictEqual(res.enabled, true, 'enabled=true');
  rmTmp(home);
  pass('Test n.u2 (key=true -> enabled:true)');
} catch (err) { failTest('Test n.u2 (key=true -> enabled:true)', err); }

// n.u3: key absent from enabledPlugins -> unknown (null)
try {
  const home = makeTmpHome('u3');
  writeInstalled(home, 'mos@mindrian-marketplace');
  writeSettings(home, { enabledPlugins: { 'context7@claude-plugins-official': true } });
  const res = checkPluginEnabled({ settingsPath: settingsPath(home), installedPluginsPath: installedPath(home) });
  assert.strictEqual(res.installed, true);
  assert.strictEqual(res.enabled, null, 'enabled=null when key absent (unknown, not an error)');
  rmTmp(home);
  pass('Test n.u3 (key absent -> enabled:null unknown)');
} catch (err) { failTest('Test n.u3 (key absent -> enabled:null unknown)', err); }

// n.u4: settings.json missing -> enabled null, never throws
try {
  const home = makeTmpHome('u4');
  writeInstalled(home, 'mos@mindrian-marketplace');
  const res = checkPluginEnabled({ settingsPath: settingsPath(home), installedPluginsPath: installedPath(home) });
  assert.strictEqual(res.installed, true);
  assert.strictEqual(res.enabled, null, 'enabled=null when settings.json missing');
  rmTmp(home);
  pass('Test n.u4 (settings.json missing -> enabled:null)');
} catch (err) { failTest('Test n.u4 (settings.json missing -> enabled:null)', err); }

// n.u5: malformed settings.json -> never throws
try {
  const home = makeTmpHome('u5');
  writeInstalled(home, 'mos@mindrian-marketplace');
  fs.writeFileSync(settingsPath(home), '{ this is not valid json ');
  const res = checkPluginEnabled({ settingsPath: settingsPath(home), installedPluginsPath: installedPath(home) });
  assert.strictEqual(res.enabled, null, 'malformed settings.json -> enabled:null, no throw');
  rmTmp(home);
  pass('Test n.u5 (malformed settings.json -> never throws)');
} catch (err) { failTest('Test n.u5 (malformed settings.json -> never throws)', err); }

// n.u6: defensive -- mindrian-os@mindrian-marketplace key shape
try {
  const home = makeTmpHome('u6');
  writeInstalled(home, 'mindrian-os@mindrian-marketplace');
  writeSettings(home, { enabledPlugins: { 'mindrian-os@mindrian-marketplace': false } });
  const res = checkPluginEnabled({ settingsPath: settingsPath(home), installedPluginsPath: installedPath(home) });
  assert.strictEqual(res.installed, true, 'alt key shape installed');
  assert.strictEqual(res.enabled, false, 'alt key shape disabled detected');
  assert.strictEqual(res.key, 'mindrian-os@mindrian-marketplace', 'alt key resolved');
  rmTmp(home);
  pass('Test n.u6 (mindrian-os@mindrian-marketplace key shape)');
} catch (err) { failTest('Test n.u6 (mindrian-os@mindrian-marketplace key shape)', err); }

// n.u7: not installed -> installed:false
try {
  const home = makeTmpHome('u7');
  writeInstalled(home, 'context7@claude-plugins-official');
  writeSettings(home, { enabledPlugins: { 'context7@claude-plugins-official': true } });
  const res = checkPluginEnabled({ settingsPath: settingsPath(home), installedPluginsPath: installedPath(home) });
  assert.strictEqual(res.installed, false, 'not installed');
  rmTmp(home);
  pass('Test n.u7 (not installed -> installed:false)');
} catch (err) { failTest('Test n.u7 (not installed -> installed:false)', err); }

// =====================================================================
// End-to-end doctor runs (bare run -- the silent-disable situation)
// =====================================================================

// n.1: DISABLED -> CRITICAL warn + non-zero exit + fix text
try {
  const home = makeTmpHome('e1');
  const V = '1.13.1-beta.14';
  const mcDir = makeMarketplaceCache(home, V);
  writeInstalled(home, 'mos@mindrian-marketplace', V, mcDir);
  writeSettings(home, {
    statusLine: { type: 'command', command: 'bash "x"' },
    enabledPlugins: { 'mos@mindrian-marketplace': false },
  });
  const { r, report } = runDoctorBare(home);
  assert.ok(report, 'JSON report parsed');
  const c = report.checks['plugin-enabled-state'];
  assert.ok(c, 'plugin-enabled-state check present on a BARE run');
  assert.strictEqual(c.status, 'warn', 'DISABLED -> warn (CRITICAL); got ' + c.status);
  assert.strictEqual(c.enabled, false, 'enabled=false captured');
  assert.match(c.detail, /silent-disable failure/, 'detail names the silent-disable failure');
  assert.match(c.detail, /claude plugin enable/, 'detail carries the re-enable fix text');
  assert.notStrictEqual(r.status, 0, 'bare doctor exits non-zero on DISABLED; got ' + r.status);
  rmTmp(home);
  pass('Test n.1 (DISABLED -> CRITICAL warn + non-zero exit)');
} catch (err) { failTest('Test n.1 (DISABLED -> CRITICAL warn + non-zero exit)', err); }

// n.2: ENABLED -> ok
try {
  const home = makeTmpHome('e2');
  const V = '1.13.1-beta.14';
  const mcDir = makeMarketplaceCache(home, V);
  writeInstalled(home, 'mos@mindrian-marketplace', V, mcDir);
  writeSettings(home, {
    statusLine: { type: 'command', command: 'bash "x"' },
    enabledPlugins: { 'mos@mindrian-marketplace': true },
  });
  const { report } = runDoctorBare(home);
  const c = report.checks['plugin-enabled-state'];
  assert.ok(c, 'check present');
  assert.strictEqual(c.status, 'ok', 'ENABLED -> ok; got ' + c.status);
  assert.strictEqual(c.enabled, true, 'enabled=true');
  rmTmp(home);
  pass('Test n.2 (ENABLED -> ok)');
} catch (err) { failTest('Test n.2 (ENABLED -> ok)', err); }

// n.3: key ABSENT -> ok (unknown, not an error)
try {
  const home = makeTmpHome('e3');
  const V = '1.13.1-beta.14';
  const mcDir = makeMarketplaceCache(home, V);
  writeInstalled(home, 'mos@mindrian-marketplace', V, mcDir);
  writeSettings(home, {
    statusLine: { type: 'command', command: 'bash "x"' },
    enabledPlugins: { 'context7@claude-plugins-official': true },
  });
  const { report } = runDoctorBare(home);
  const c = report.checks['plugin-enabled-state'];
  assert.ok(c, 'check present');
  assert.strictEqual(c.status, 'ok', 'absent key -> ok (unknown, not an error); got ' + c.status);
  assert.strictEqual(c.enabled, null, 'enabled=null');
  rmTmp(home);
  pass('Test n.3 (key absent -> ok unknown)');
} catch (err) { failTest('Test n.3 (key absent -> ok unknown)', err); }

if (failed > 0) {
  console.log('\n' + failed + ' test(s) FAILED (' + passed + ' passed)');
  process.exit(1);
}
console.log('\nAll ' + passed + ' tests PASS');
process.exit(0);
