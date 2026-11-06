'use strict';
/*
 * tests/test-386-session-start-topology-env.cjs -- Phase 386 plan 09 (finding B4).
 *
 * The dev-clone topology probe in scripts/session-start must pass
 * PLUGIN_ROOT_FOR_RESOLVE to node as an ENVIRONMENT variable. A `VAR=value`
 * word placed after `node -e '<program>'` is an argv entry, so the program saw
 * undefined and always printed not-found.
 *
 *   T1  the probe line extracted from the real file returns dev-clone on a fixture dev clone
 *   T2  the same line on a fixture non-dev root returns a topology other than dev-clone
 *   T3  the line is found in the real file by its marker comment and the token
 *
 * The real scripts/session-start is NEVER run, and scripts/install-pre-commit.sh
 * is never run. Only the single _MOS_TOPOLOGY line runs in a child bash, with
 * HOME pointing at a temporary fixture. Fixture directories only (Canon Part 8).
 * Node built-ins only. Prints "ok - <label>" or "FAIL - <label>"; exit 1 on any failure.
 */

const assert = require('node:assert');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'session-start');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'test-386-topology-'));

let failed = 0;
function arm(label, fn) {
  try { fn(); console.log('ok - ' + label); }
  catch (e) { failed++; console.log('FAIL - ' + label + ': ' + (e && e.message ? e.message.split('\n')[0] : e)); }
}

// Extract the _MOS_TOPOLOGY assignment from the install-state manifest reconcile block.
function extractProbeLine() {
  const lines = fs.readFileSync(SCRIPT, 'utf8').split('\n');
  const begin = lines.findIndex((l) => l.includes('BEGIN install-state manifest reconcile'));
  if (begin < 0) return null;
  for (let i = begin; i < lines.length; i++) {
    if (lines[i].includes('END install-state manifest reconcile')) break;
    if (/^\s*_MOS_TOPOLOGY=\$\(node -e /.test(lines[i])) return lines[i].trim();
  }
  return null;
}

// A fixture HOME whose installed_plugins.json points at an install dir.
function makeHome(name, installDir) {
  const home = path.join(tmp, name + '-home');
  fs.mkdirSync(path.join(home, '.claude', 'plugins'), { recursive: true });
  fs.writeFileSync(
    path.join(home, '.claude', 'plugins', 'installed_plugins.json'),
    JSON.stringify({ version: 2, plugins: { 'mos@mindrian-marketplace': [{ installPath: installDir }] } })
  );
  return home;
}

function runProbe(line, home) {
  const env = Object.assign({}, process.env, { HOME: home, USERPROFILE: home, PLUGIN_ROOT_FOR_NODE: ROOT });
  delete env.MINDRIAN_OS_ROOT;
  delete env.PLUGIN_ROOT_FOR_RESOLVE;
  const r = cp.spawnSync('bash', ['-c', line + '\nprintf %s "$_MOS_TOPOLOGY"'], { env, encoding: 'utf8', timeout: 20000 });
  return (r.stdout || '').trim();
}

// Fixture dev clone: .git, .claude-plugin/plugin.json, and an origin remote URL that names the plugin repo.
const devDir = path.join(tmp, 'dev-clone');
fs.mkdirSync(path.join(devDir, '.claude-plugin'), { recursive: true });
fs.writeFileSync(path.join(devDir, '.claude-plugin', 'plugin.json'), '{"name":"mos","version":"0.0.0"}');
cp.spawnSync('git', ['-C', devDir, 'init', '-q'], { encoding: 'utf8' });
cp.spawnSync('git', ['-C', devDir, 'remote', 'add', 'origin', 'https://example.invalid/fixture/mindrian-os-plugin.git'], { encoding: 'utf8' });

// Fixture non-dev root: a plugin dir with no .git.
const plainDir = path.join(tmp, 'plain-install');
fs.mkdirSync(path.join(plainDir, '.claude-plugin'), { recursive: true });
fs.writeFileSync(path.join(plainDir, '.claude-plugin', 'plugin.json'), '{"name":"mos","version":"0.0.0"}');

const line = extractProbeLine();

arm('T3 the probe line is found by its marker comment and holds the PLUGIN_ROOT_FOR_RESOLVE token', () => {
  assert.ok(line, 'no _MOS_TOPOLOGY line inside the manifest reconcile block');
  assert.ok(line.includes('PLUGIN_ROOT_FOR_RESOLVE'), 'token missing');
});

arm('T1 the probe returns dev-clone on a fixture dev clone', () => {
  assert.ok(line, 'no probe line');
  assert.strictEqual(runProbe(line, makeHome('dev', devDir)), 'dev-clone');
});

arm('T2 the probe does not return dev-clone on a fixture non-dev root', () => {
  assert.ok(line, 'no probe line');
  const got = runProbe(line, makeHome('plain', plainDir));
  assert.notStrictEqual(got, 'dev-clone');
});

try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* best effort */ }
process.exit(failed ? 1 : 0);
