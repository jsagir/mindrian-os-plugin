#!/usr/bin/env node
'use strict';
/*
 * Phase 387 plan 10: the OWNER-RUN live leak test for the real Eureka engine.
 *
 * It makes one graph call with a synthetic snapshot that carries a planted marker, through the plugin's real
 * call path (uv run --no-sync --offline --locked --no-python-downloads), under strace for connect calls, in
 * scratch HOME, data and cache folders. Then it checks four things:
 *   1. no connect to a non-local address (AF_INET or AF_INET6 that is not loopback) by the call or any child
 *   2. every file that changed lies under the engine data folder or cache folder (scratch HOME unchanged)
 *   3. the engine folder, its .venv and its uv.lock are unchanged (Python bytecode files are listed as noise)
 *   4. the planted marker is in no file under the data and cache folders (sqlite files, -wal and -shm included)
 * Then L10 (read only): the engine own tests/conftest.py holds a no_network fixture; it prints the command.
 *
 * NO AGENT RUNS THIS TEST WITH THE OPT-IN. Without the opt-in it prints SKIPPED and exits 77. The gates, in order,
 * each exit 77 with one named reason: the opt-in is not set; the platform is not linux; the engine folder variable
 * is not an existing folder; strace is not on PATH (or may not trace); the engine is not prepared; unshare is not
 * allowed while the no-network run is requested.
 *
 * Owner settings (read, never assigned here): MINDRIAN_EUREKA_LIVE_LEAK=1, MINDRIAN_EUREKA_ROOT=<engine folder>,
 * optional MINDRIAN_EUREKA_UV, UV_PROJECT_ENVIRONMENT, MINDRIAN_EUREKA_LEAK_NO_NET=1 (run inside unshare -rn).
 * See .planning/phases/387-eureka-reachable-on-a-normal-install/387-LEAK-RUNBOOK.md.
 *
 * Node built-ins and repo modules only. No network call from this file. Hyphens only.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');

function skip(reason) {
  process.stdout.write('SKIPPED (ENV GAP): ' + reason + '\n');
  process.exit(77);
}

// every spawn goes through this one function: an argument array, shell false
function run(command, args, env) {
  return spawnSync(command, args, { shell: false, encoding: 'utf8', env, timeout: 30 * 60 * 1000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
}

// ---------------------------------------------------------------------------
// gates
// ---------------------------------------------------------------------------

if (process.env.MINDRIAN_EUREKA_LIVE_LEAK !== '1') skip('MINDRIAN_EUREKA_LIVE_LEAK is not 1 (this test runs the real engine and is owner-run only)');
if (process.platform !== 'linux') skip('the platform is not linux (strace and unshare are needed)');
const ENGINE_ROOT = process.env.MINDRIAN_EUREKA_ROOT;
let rootIsDir = false;
try { rootIsDir = typeof ENGINE_ROOT === 'string' && ENGINE_ROOT.length > 0 && fs.statSync(ENGINE_ROOT).isDirectory(); } catch (_e) { rootIsDir = false; }
if (!rootIsDir) skip('the engine folder variable for the real engine is not set to an existing folder');

const BASE_ENV = { PATH: process.env.PATH || '' };
const straceProbe = run('strace', ['-V'], BASE_ENV);
if (straceProbe.error || straceProbe.status !== 0) skip('strace is not on PATH');

const requirements = require(path.join(REPO, 'lib', 'core', 'eureka', 'eureka-engine-requirements.cjs'));
const resolver = require(path.join(REPO, 'lib', 'core', 'eureka', 'eureka-engine-resolver.cjs'));
const engineCheck = requirements.checkEngine(ENGINE_ROOT, { env: process.env });
if (engineCheck.ok !== true) {
  const d = resolver.describeEngineState({ state: 'broken', cause: engineCheck.cause || 'engine_start_failed', detail: { extras: ['mcp-server'] } });
  process.stdout.write('engine not prepared. cause: ' + (engineCheck.cause || 'unknown') + '\n  ' + d.sentence + '\n  fix: ' + d.fix + '\n');
  skip('the engine is not prepared (run /mos:eureka enable engine --sync first)');
}

const NO_NET = process.env.MINDRIAN_EUREKA_LEAK_NO_NET === '1';
if (NO_NET) {
  const probe = run('unshare', ['-r', '-n', 'true'], BASE_ENV);
  if (probe.error || probe.status !== 0) skip('unshare -rn is not allowed on this machine (MINDRIAN_EUREKA_LEAK_NO_NET=1 was set); run without it and rely on the strace result');
}

// ---------------------------------------------------------------------------
// L9: the measured run
// ---------------------------------------------------------------------------

const helpers = require('./helpers/leak-test-387.cjs');
let failed = 0;
function pass(label, info) { process.stdout.write('PASS - ' + label + (info ? ' (' + info + ')' : '') + '\n'); }
function fail(label, detail) { failed += 1; process.stdout.write('FAIL - ' + label + '\n'); if (detail) process.stdout.write('    ' + String(detail).split('\n').join('\n    ') + '\n'); }
function info(line) { process.stdout.write('info - ' + line + '\n'); }

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-387-live-leak-'));
const scratchHome = path.join(scratch, 'home');
const dataDir = path.join(scratch, 'data');
const cacheDir = path.join(scratch, 'cache');
for (const d of [scratchHome, dataDir, cacheDir]) fs.mkdirSync(d, { recursive: true });
const logFile = path.join(scratch, 'strace.log');
const resultFile = path.join(scratch, 'result.json');
const marker = 'MARKER387' + crypto.randomBytes(12).toString('hex');
const SNAP_CAP = 400000;

function snap(dir) {
  try { return helpers.snapshotTree(dir, { maxEntries: SNAP_CAP }); }
  catch (e) { skip('a folder is too large to snapshot (' + String(e.message).slice(0, 120) + ')'); return null; }
}

const beforeEngine = snap(ENGINE_ROOT);
const beforeHome = snap(scratchHome);

// the child environment: a fixed list, never the whole parent environment
const childEnv = { PATH: process.env.PATH || '', HOME: scratchHome, MINDRIAN_EUREKA_DATA_DIR: dataDir, MINDRIAN_EUREKA_CACHE_DIR: cacheDir, MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9' };
for (const key of ['MINDRIAN_EUREKA_ROOT', 'MINDRIAN_EUREKA_UV', 'UV_PROJECT_ENVIRONMENT']) {
  if (typeof process.env[key] === 'string' && process.env[key]) childEnv[key] = process.env[key];
}

const driver = path.join(__dirname, 'helpers', 'leak-driver-387.cjs');
const tracee = [process.execPath, driver, '--root', ENGINE_ROOT, '--out', resultFile, '--marker', marker];
const wrapped = NO_NET ? ['unshare', '-r', '-n'].concat(tracee) : tracee;
const straceArgs = ['-f', '-qq', '-e', 'trace=connect', '-o', logFile].concat(wrapped);
process.stdout.write('running one graph call under strace' + (NO_NET ? ' inside unshare -rn' : '') + ' with a planted marker; scratch folder ' + scratch + '\n');
const res = run('strace', straceArgs, childEnv);

const afterEngine = snap(ENGINE_ROOT);
const afterHome = snap(scratchHome);

let logText = '';
try { logText = fs.readFileSync(logFile, 'utf8'); } catch (_e) { logText = ''; }
if (/ptrace|Operation not permitted/i.test(String(res.stderr || ''))) {
  skip('strace may not trace here (ptrace is not allowed); see the runbook');
}

let result = null;
try { result = JSON.parse(fs.readFileSync(resultFile, 'utf8')); } catch (_e) { result = null; }
if (res.status !== 0 || !result || result.ok !== true) {
  fail('the graph call completed', 'driver exit ' + res.status + '; result ' + JSON.stringify(result && { ok: result.ok, reason: result.reason, cause: result.cause, engine_state: result.engine_state }) +
    '. Without a completed call the four criteria below do not prove anything.');
} else {
  pass('the graph call completed', 'ok true');
}

// criterion 1
let rows = [];
try { rows = helpers.assertNoNonLocalConnect(logText); pass('no non-local connect', rows.length + ' connect attempts, all local'); }
catch (e) { rows = helpers.parseStraceConnects(logText); fail('no non-local connect', e.message); }
const unixSockets = rows.filter((r) => r.family === 'unix').map((r) => r.address || 'abstract');
info('local connects: ' + rows.filter((r) => r.local).length + '; unix sockets: ' + (unixSockets.length ? unixSockets.slice(0, 5).join(', ') : 'none'));

// criterion 2: nothing changed outside the data and cache folders (the scratch HOME holds nothing else)
const homeDiff = helpers.diffTrees(beforeHome, afterHome, [dataDir, cacheDir]);
if (homeDiff.outsideAllowed.length === 0) pass('changes only in the data and cache folders', 'the scratch HOME is unchanged');
else fail('changes only in the data and cache folders', 'changed outside: ' + homeDiff.outsideAllowed.slice(0, 8).map((x) => x.path).join(', '));
const dataNow = snap(dataDir);
const cacheNow = snap(cacheDir);
const dataFiles = Array.from(dataNow.values()).concat(Array.from(cacheNow.values())).filter((v) => v.type === 'file').map((v) => v.abs);
info('files written in the data and cache folders: ' + (dataFiles.length ? dataFiles.map((f) => path.basename(f)).join(', ') : 'none'));

// criterion 3: the engine folder, its .venv and its uv.lock unchanged (bytecode is noise)
const engineDiff = helpers.diffTrees(beforeEngine, afterEngine, []);
const venvOrLock = engineDiff.outsideAllowed.filter((x) => x.path === 'uv.lock' || x.path === '.venv' || x.path.indexOf('.venv/') === 0);
if (engineDiff.outsideAllowed.length === 0) pass('engine folder and uv.lock unchanged', 'Python bytecode files are listed as noise: ' + engineDiff.noise.length);
else fail('engine folder and uv.lock unchanged', (venvOrLock.length ? 'the .venv or uv.lock changed: ' + venvOrLock.slice(0, 4).map((x) => x.path).join(', ') + '. ' : '') +
  'changed in the engine folder: ' + engineDiff.outsideAllowed.slice(0, 8).map((x) => x.path).join(', '));
if (engineDiff.noise.length) info('bytecode noise: ' + engineDiff.noise.slice(0, 5).map((x) => x.path).join(', ') + (engineDiff.noise.length > 5 ? ', ...' : ''));

// criterion 4: the marker is in no file of the data and cache folders (sqlite, -wal, -shm)
const scan = helpers.scanMarker(dataFiles, marker);
if (scan.total === 0) pass('marker not in the sqlite files', 'scanned ' + dataFiles.length + ' files under the data and cache folders');
else fail('marker not in the sqlite files', Object.keys(scan.byFile).filter((f) => scan.byFile[f] > 0).map((f) => path.basename(f) + ': ' + scan.byFile[f]).join(', '));
const inResult = result ? helpers.scanMarker([resultFile], marker).total : 0;
info('marker count in the result file (information only; the engine may echo input): ' + inResult);

// ---------------------------------------------------------------------------
// L10: the engine own no_network fixture (read only)
// ---------------------------------------------------------------------------

let conftest = '';
try { conftest = fs.readFileSync(path.join(ENGINE_ROOT, 'tests', 'conftest.py'), 'utf8'); } catch (_e) { conftest = ''; }
if (/no_network/.test(conftest) && /socket/.test(conftest)) pass('L10 the engine tests/conftest.py holds a no_network fixture that blocks sockets');
else fail('L10 the engine tests/conftest.py holds a no_network fixture that blocks sockets', 'tests/conftest.py is missing or holds no no_network and socket text');
process.stdout.write('second proof, for you to run from the engine folder (dev packages needed; nobody has run it yet):\n');
process.stdout.write('  cd <engine folder> && uv run --no-sync --offline --locked --no-python-downloads pytest\n');

process.stdout.write('\nscratch folder kept for your inspection: ' + scratch + '\n');
process.stdout.write(failed ? 'RESULT: FAIL (' + failed + ')\n' : 'RESULT: PASS\n');
process.stdout.write('Write down the plugin version and the engine commit you tested; a PASS covers only those.\n');
process.exit(failed ? 1 : 0);
