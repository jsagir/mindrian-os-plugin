#!/usr/bin/env node
'use strict';
/*
 * Phase 395 plan 11: the optional one-step Eureka engine setup (--setup) and its installer offer.
 *
 * The setup script is a STUB written to a temp folder by this test. The real script, GitHub, PyPI and Hugging
 * Face are never reached. Every HOME is a temp folder (tests/helpers/isolated-home-36925.cjs).
 *
 * Arms (each prints ok - or FAIL - with its label):
 *   S1   --setup with no approval prints the card (hosts, size, time, skip later, no room data), exits 2,
 *        spawns nothing and writes nothing under HOME
 *   S2   --setup --json gives the card facts; on win32 the script is the .ps1 and the write is a user setting
 *   S3   --setup with a wrong --approved-via value exits 1 and spawns nothing
 *   S4   setupCommand: bash + curl of the .sh on POSIX, powershell irm | iex of the .ps1 on win32
 *   S5   approved, stub last line "EUREKA_SETUP: OK <folder>": exit 0, folder saved, graph and pairs-and-scout ready
 *   S6   approved, stub last line "EUREKA_SETUP: OK engine-only <folder>": exit 0, folder saved by MindrianOS
 *   S7   approved, stub last line "EUREKA_SETUP: FAIL <step> <reason>" for each of the 6 steps: exit 1, the step,
 *        its plain sentence and the reason are shown, nothing is saved
 *   S8   a step name that is not one of the 6 is shown as unknown
 *   S9   no result line, and a command that cannot start: exit 1, "stopped without its result line"
 *   S10  parseSetupLine: the 3 forms, a folder with spaces, only the last line counts, carriage returns
 *   S11  the setup child environment holds no CLAUDE_, room or Brain variable, and holds HOME
 *   S12  --check with no engine: the Fix line names --setup and --path <folder>; nothing is spawned
 *   S13  --path and --sync still work as before (save, grant card exit 2, approved sync)
 *   S14  source guard: runEngineSetup is called once, inside modeSetup, after the no-approval return;
 *        the plugin code holds no model download call
 *   S15  installer: --eureka and --no-eureka are not passed to claude; with --no-eureka or no terminal no card
 *        is shown and no setup runs; the card is printed before the approved run in offerEurekaSetup
 *   S17  owner ruling 34: EUREKA_SETUP_COMMIT is a full 40-character commit; every setup URL (both commands,
 *        both cards) uses exactly that commit, never main or another branch; the docs name no branch URL
 *   S18  CR-01: the card names the .bak overwrite, the deleted lines, the uv cache, uv Python and the uv
 *        installer changes; an approved POSIX run first keeps an existing ~/.bashrc.bak as .bak.mindrian-<time>
 *   S16  this process made 0 non-loopback connection attempts, and no spawn tried curl, powershell or
 *        raw.githubusercontent.com (such a spawn is blocked by this file and never runs)
 *
 * Exit: 0 all pass; 1 any FAIL; 77 ENV GAP on win32 (the stub is a bash script). Hyphens only.
 */

if (process.platform === 'win32') {
  process.stdout.write('SKIPPED (ENV GAP): the stub setup script is a bash script; win32 is not covered\n');
  process.exit(77);
}

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const dns = require('node:dns');
const childProcess = require('node:child_process');

// the network counter and the spawn recorder: installed BEFORE the module is required
const attempts = [];
function isLoopbackHost(host) {
  const h = String(host === undefined || host === null ? 'localhost' : host).toLowerCase().replace(/^\[|\]$/g, '');
  return h === 'localhost' || h === '::1' || /^127\./.test(h) || /^::ffff:127\./.test(h);
}
const origConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function wrappedConnect(...args) {
  let a0 = args[0];
  if (Array.isArray(a0)) a0 = a0[0];
  if (a0 && typeof a0 === 'object' && !a0.path) attempts.push({ host: String(a0.host), local: isLoopbackHost(a0.host) });
  else if (typeof a0 === 'number' || (typeof a0 === 'string' && !Number.isNaN(Number(a0)))) attempts.push({ host: String(args[1]), local: isLoopbackHost(args[1]) });
  return origConnect.apply(this, args);
};
const origLookup = dns.lookup;
dns.lookup = function wrappedLookup(hostname, ...rest) {
  attempts.push({ host: String(hostname), local: isLoopbackHost(hostname) });
  return origLookup.call(this, hostname, ...rest);
};
// A spawn that would reach the real setup is recorded and BLOCKED: it gets a fake child that fails at once.
// So even a broken build under test cannot reach GitHub, PyPI or Hugging Face from this file.
const { EventEmitter } = require('node:events');
function blockedChild() {
  const child = new EventEmitter();
  child.kill = () => true;
  setImmediate(() => child.emit('error', Object.assign(new Error('blocked by test-395-eureka-setup'), { code: 'BLOCKED_BY_TEST' })));
  return child;
}
const REAL_SETUP = /curl|powershell|raw\.githubusercontent\.com/;
const globalSpawns = [];
const origSpawn = childProcess.spawn;
childProcess.spawn = function recordedSpawn(command, args, options) {
  const rec = { command: String(command), args: Array.isArray(args) ? args.map(String) : [] };
  globalSpawns.push(rec);
  if (REAL_SETUP.test(rec.command + ' ' + rec.args.join(' '))) return blockedChild();
  return origSpawn.call(this, command, args, options);
};

const REPO = path.resolve(__dirname, '..');
const MODULE = path.join(REPO, 'lib', 'core', 'eureka', 'eureka-engine-enable.cjs');
const CLI = path.join(REPO, 'bin', 'cli.js');
const { mkIsolatedHome } = require('./helpers/isolated-home-36925.cjs');
const mod = require(MODULE);

// owner ruling 34: the scripts are pinned to one engine commit per release; S17 checks the pin itself
const PIN = String(mod.EUREKA_SETUP_COMMIT);
const URL_SH = 'https://raw.githubusercontent.com/jsagir/mindrian-eureka/' + PIN + '/scripts/setup-mindrianos.sh';
const URL_PS1 = 'https://raw.githubusercontent.com/jsagir/mindrian-eureka/' + PIN + '/scripts/setup-mindrianos.ps1';
const STEPS = ['tools', 'engine', 'packages', 'model', 'doctor', 'connect'];

let passed = 0;
let failed = 0;
async function arm(label, fn) {
  try { await fn(); passed += 1; process.stdout.write('ok - ' + label + '\n'); }
  catch (e) { failed += 1; process.stdout.write('FAIL - ' + label + '\n    ' + String(e && e.message || e).split('\n').slice(0, 6).join('\n    ') + '\n'); }
}

const STUB = [
  '#!/usr/bin/env bash',
  '# stub of the eureka setup script for tests/test-395-eureka-setup.cjs: no network, no model',
  'mode="$1"; engine="$2"; envout="$3"',
  'echo "== 1/6 tools"',
  'echo "stub: no network, no model download"',
  'if [ -n "$envout" ]; then env > "$envout"; fi',
  'case "$mode" in',
  '  ok|engine-only)',
  '    mkdir -p "$engine/.venv/lib/python3.12/site-packages/mcp-2.0.0.dist-info" "$engine/.venv/lib/python3.12/site-packages/sentence_transformers-5.0.0.dist-info"',
  '    printf \'[project]\\nname = "mindrian-eureka"\\nrequires-python = ">=3.11"\\n\\n[project.scripts]\\neureka-mcp = "x:y"\\n\' > "$engine/pyproject.toml"',
  '    if [ "$mode" = ok ]; then echo "EUREKA_SETUP: OK $engine"; else echo "EUREKA_SETUP: OK engine-only $engine"; fi',
  '    ;;',
  '  fail:*) step="${mode#fail:}"; echo "EUREKA_SETUP: FAIL $step stub reason for $step"; exit 1 ;;',
  '  none) echo "something went wrong before the end"; exit 0 ;;',
  'esac',
  '',
].join('\n');

function stubPath(iso) {
  const p = path.join(iso.home, 'stub-setup.sh');
  if (!fs.existsSync(p)) fs.writeFileSync(p, STUB, { mode: 0o755 });
  return p;
}

// A fake spawnSync for the uv, Python and Node probes that the --path report runs. Any other shape is recorded.
function fakeSpawnSync() {
  const calls = [];
  function spawnSync(command, args) {
    const a = Array.isArray(args) ? args : [];
    calls.push({ command, args: a });
    if (command === 'node' && a.length === 1 && a[0] === '--version') return { status: 0, stdout: 'v22.18.0\n', stderr: '' };
    if (a.length === 1 && a[0] === '--version') return { status: 0, stdout: 'uv 0.5.1\n', stderr: '' };
    if (a[0] === 'python' && a[1] === 'find') return { status: 0, stdout: '/usr/bin/python3.12\n', stderr: '' };
    if (a[0] === 'sync') return { status: 0, stdout: 'synced\n', stderr: '' };
    return { status: 1, stdout: '', stderr: 'unknown shape' };
  }
  return { spawnSync, calls };
}

// Runs only the stub (bash <temp>/stub-setup.sh) or the missing-command case; any other command is blocked.
function recordingSpawn() {
  const calls = [];
  function spawn(command, args, options) {
    calls.push({ command, args, options });
    const a = Array.isArray(args) ? args.map(String) : [];
    const isStub = command === 'bash' && /stub-setup\.sh$/.test(a[0] || '');
    if (!isStub && command !== 'no-such-command-395-11') return blockedChild();
    return origSpawn(command, args, options);
  }
  return { spawn, calls };
}

function sink() {
  const parts = [];
  return { write: (s) => { parts.push(String(s)); return true; }, text: () => parts.join('') };
}

function envOf(iso, extra) {
  const env = Object.assign({}, iso.env);
  delete env.MINDRIAN_EUREKA_ROOT;
  delete env.MINDRIAN_EUREKA_UV;
  delete env.MINDRIAN_EUREKA_RS_MODEL_PATH;
  return Object.assign(env, extra || {});
}

function pointerFile(iso) { return path.join(iso.home, '.mindrian', 'eureka-engine.json'); }
function out(r) { return String(r.stdout || '') + '\n' + String(r.stderr || ''); }

async function approved(iso, stubArgs, extraDeps) {
  const fake = fakeSpawnSync();
  const rec = recordingSpawn();
  const screen = sink();
  const deps = Object.assign({
    env: envOf(iso), spawnSync: fake.spawnSync, spawn: rec.spawn, stream: screen,
    setupCommand: { command: 'bash', args: [stubPath(iso)].concat(stubArgs) },
  }, extraDeps || {});
  const result = await mod.run(['--setup', '--approved-via', 'cli'], deps);
  return { result, fake, rec, screen };
}

function codeOf(file) {
  let src = fs.readFileSync(file, 'utf8');
  src = src.replace(/\/\*[\s\S]*?\*\//g, '');
  return src.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
}

function bodyOf(code, name) {
  const start = code.search(new RegExp('^function\\s+' + name + '\\s*\\(', 'm'));
  assert.ok(start !== -1, name + ' not found');
  const end = code.indexOf('\n}\n', start);
  assert.ok(end !== -1, 'end of ' + name + ' not found');
  return code.slice(start, end);
}

(async function main() {
  process.stdout.write('Phase 395 plan 11 -- the optional one-step Eureka engine setup\n');

  await arm('S1 --setup without approval: card, exit 2, nothing spawned, nothing written', async () => {
    const iso = mkIsolatedHome('395-s1');
    const fake = fakeSpawnSync();
    const rec = recordingSpawn();
    const result = mod.run(['--setup'], { env: envOf(iso), spawnSync: fake.spawnSync, spawn: rec.spawn, platform: 'linux' });
    assert.ok(!(result && typeof result.then === 'function'), 'the card must not start anything that runs later');
    assert.equal(result.exitCode, 2);
    const text = result.stdout;
    for (const needle of ['Set up the Eureka engine (optional)', 'raw.githubusercontent.com',
      'setup steps as tested for this MindrianOS version (engine commit ' + PIN.slice(0, 7) + ')', 'github.com', 'astral.sh', 'pypi.org',
      'files.pythonhosted.org', 'download.pytorch.org', 'huggingface.co', 'all-MiniLM-L6-v2', 'about 90 MB', 'about 1.3 GB',
      'Time: ', 'run it later with /mos:eureka enable engine --setup', 'Nothing from your rooms is sent', 'runs offline']) {
      assert.ok(text.includes(needle), 'card lacks: ' + needle);
    }
    assert.ok(/Nothing was run/.test(result.stderr), 'stderr does not say that nothing was run');
    assert.equal(fake.calls.length, 0, 'spawnSync was called');
    assert.equal(rec.calls.length, 0, 'spawn was called');
    assert.ok(!fs.existsSync(path.join(iso.home, '.mindrian')), 'the card wrote under HOME');
  });

  await arm('S2 --setup --json: card facts; win32 uses the .ps1 and a user setting', async () => {
    const iso = mkIsolatedHome('395-s2');
    const posix = JSON.parse(mod.run(['--setup', '--json'], { env: envOf(iso), platform: 'linux' }).stdout);
    assert.equal(posix.kind, 'engine_setup_grant');
    assert.equal(posix.script, URL_SH);
    assert.equal(posix.room_data, 'none');
    assert.equal(posix.commit, PIN);
    assert.ok(posix.writes.some((w) => w.includes(path.join(iso.home, '.mindrian', 'eureka-engine'))), 'engine folder not listed');
    assert.ok(posix.writes.some((w) => w.includes('.bashrc')), 'shell file line not listed');
    const win = JSON.parse(mod.run(['--setup', '--json'], { env: envOf(iso), platform: 'win32' }).stdout);
    assert.equal(win.script, URL_PS1);
    assert.ok(win.writes.some((w) => w.includes('user setting')), 'Windows user setting not listed');
  });

  await arm('S3 --setup with a wrong approval value: exit 1, nothing spawned', async () => {
    const iso = mkIsolatedHome('395-s3');
    const rec = recordingSpawn();
    const result = mod.run(['--setup', '--approved-via', 'yes'], { env: envOf(iso), spawn: rec.spawn });
    assert.equal(result.exitCode, 1);
    assert.ok(/--approved-via takes cli or gate/.test(result.stderr));
    assert.equal(rec.calls.length, 0);
  });

  await arm('S4 setupCommand: bash and curl of the .sh on POSIX; powershell irm | iex of the .ps1 on win32', async () => {
    assert.deepEqual(mod.setupCommand('linux'), { command: 'bash', args: ['-c', 'curl -fsSL "$0" | bash', URL_SH] });
    assert.deepEqual(mod.setupCommand('darwin'), { command: 'bash', args: ['-c', 'curl -fsSL "$0" | bash', URL_SH] });
    assert.deepEqual(mod.setupCommand('win32'), { command: 'powershell.exe', args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'irm ' + URL_PS1 + ' | iex'] });
  });

  await arm('S5 approved, OK <folder>: exit 0, folder saved, graph and pairs-and-scout ready', async () => {
    const iso = mkIsolatedHome('395-s5');
    const engine = path.join(iso.home, '.mindrian', 'eureka-engine');
    const { result, rec, screen } = await approved(iso, ['ok', engine]);
    assert.equal(result.exitCode, 0, out(result));
    assert.equal(rec.calls.length, 1, 'the setup must spawn once');
    assert.ok(screen.text().includes('EUREKA_SETUP: OK ' + engine), 'the setup output was not streamed');
    assert.ok(result.stdout.includes('The Eureka setup finished. The engine folder is ' + engine + '.'), result.stdout);
    assert.ok(result.stdout.includes('graph: ready'), 'graph not ready');
    assert.ok(result.stdout.includes('pairs-and-scout: ready'), 'pairs-and-scout not ready');
    assert.equal(JSON.parse(fs.readFileSync(pointerFile(iso), 'utf8')).root, engine);
  });

  await arm('S6 approved, OK engine-only <folder>: exit 0, MindrianOS saves the folder', async () => {
    const iso = mkIsolatedHome('395-s6');
    const engine = path.join(iso.home, 'engine with space');
    const { result } = await approved(iso, ['engine-only', engine]);
    assert.equal(result.exitCode, 0, out(result));
    assert.ok(result.stdout.includes('did not find MindrianOS to connect to, so MindrianOS saves the engine folder now: ' + engine + '.'), result.stdout);
    assert.equal(JSON.parse(fs.readFileSync(pointerFile(iso), 'utf8')).root, engine);
  });

  await arm('S7 approved, FAIL <step> <reason> for each of the 6 steps: exit 1, step, sentence, reason, nothing saved', async () => {
    const sentences = {
      tools: 'A tool that the setup needs is missing (git or uv).',
      engine: 'The engine code could not be downloaded.',
      packages: 'The Python packages could not be installed.',
      model: 'The meaning model could not be downloaded.',
      doctor: 'The engine health check found a problem after the setup.',
      connect: 'The engine is set up, but MindrianOS could not save its folder.',
    };
    for (const step of STEPS) {
      const iso = mkIsolatedHome('395-s7-' + step);
      const { result } = await approved(iso, ['fail:' + step, path.join(iso.home, 'e')]);
      assert.equal(result.exitCode, 1, step);
      assert.ok(result.stderr.includes('x The Eureka setup did not finish (step: ' + step + ').'), step + ': ' + result.stderr);
      assert.ok(result.stderr.includes(sentences[step]), step + ' sentence missing');
      assert.ok(result.stderr.includes('The setup said: stub reason for ' + step), step + ' reason missing');
      assert.ok(/\n {2}Fix: \S/.test(result.stderr), step + ' Fix line missing');
      assert.ok(!fs.existsSync(pointerFile(iso)), step + ': a folder was saved');
    }
  });

  await arm('S8 an unknown step name is shown as unknown', async () => {
    const iso = mkIsolatedHome('395-s8');
    const { result } = await approved(iso, ['fail:banana', path.join(iso.home, 'e')]);
    assert.equal(result.exitCode, 1);
    assert.ok(result.stderr.includes('(step: unknown)'), result.stderr);
    assert.ok(result.stderr.includes('does not know'), result.stderr);
  });

  await arm('S9 no result line, and a command that cannot start: exit 1', async () => {
    const iso = mkIsolatedHome('395-s9');
    const none = await approved(iso, ['none', path.join(iso.home, 'e')]);
    assert.equal(none.result.exitCode, 1);
    assert.ok(none.result.stderr.includes('stopped without its result line (exit 0)'), none.result.stderr);
    const missing = await approved(iso, [], { setupCommand: { command: 'no-such-command-395-11', args: [] } });
    assert.equal(missing.result.exitCode, 1);
    assert.ok(missing.result.stderr.includes('error ENOENT'), missing.result.stderr);
    assert.ok(!fs.existsSync(pointerFile(iso)), 'a folder was saved');
  });

  await arm('S10 parseSetupLine: 3 forms, spaces, last line only, carriage returns', async () => {
    const p = mod.parseSetupLine;
    assert.deepEqual(p('a\nEUREKA_SETUP: OK /h/x\n'), { form: 'ok', folder: '/h/x', step: null, reason: null });
    assert.deepEqual(p('EUREKA_SETUP: OK engine-only /h/my engine\r\n'), { form: 'ok_engine_only', folder: '/h/my engine', step: null, reason: null });
    assert.deepEqual(p('EUREKA_SETUP: FAIL packages uv sync failed (network or proxy?)'), { form: 'fail', folder: null, step: 'packages', reason: 'uv sync failed (network or proxy?)' });
    assert.equal(p('EUREKA_SETUP: FAIL model').reason, '');
    assert.equal(p('EUREKA_SETUP: OK /h/x\nmore text after').form, 'none');
    assert.equal(p('progress\rEUREKA_SETUP: OK /h/x').form, 'ok');
    assert.equal(p('').form, 'none');
    for (const step of STEPS) assert.equal(p('EUREKA_SETUP: FAIL ' + step + ' r').step, step);
  });

  await arm('S11 the setup child environment: no CLAUDE_, room or Brain variable; HOME is there', async () => {
    const iso = mkIsolatedHome('395-s11');
    const envFile = path.join(iso.home, 'child-env.txt');
    const extra = { env: envOf(iso, { CLAUDE_CONFIG_DIR: '/x', CLAUDE_CODE_SESSION_ID: 'y', MINDRIAN_BRAIN_KEY: 'k', MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9', MINDRIAN_ROOMS_HOME: '/r' }) };
    const { result } = await approved(iso, ['none', path.join(iso.home, 'e'), envFile], extra);
    assert.equal(result.exitCode, 1);
    const names = fs.readFileSync(envFile, 'utf8').split('\n').map((l) => l.split('=')[0]);
    for (const bad of ['CLAUDE_CONFIG_DIR', 'CLAUDE_CODE_SESSION_ID', 'MINDRIAN_BRAIN_KEY', 'MINDRIAN_BRAIN_URL', 'MINDRIAN_ROOMS_HOME']) {
      assert.ok(names.indexOf(bad) === -1, 'the child got ' + bad);
    }
    assert.ok(names.indexOf('HOME') !== -1, 'the child did not get HOME');
  });

  await arm('S12 --check with no engine: the Fix line names --setup and --path <folder>; nothing spawned', async () => {
    const iso = mkIsolatedHome('395-s12');
    const fake = fakeSpawnSync();
    const rec = recordingSpawn();
    const result = mod.run(['--check'], { env: envOf(iso), spawnSync: fake.spawnSync, spawn: rec.spawn });
    assert.equal(result.exitCode, 0);
    const fix = result.stdout.split('\n').find((l) => /^ {2}Fix: /.test(l)) || '';
    assert.ok(fix.includes('/mos:eureka enable engine --setup'), 'Fix line lacks --setup: ' + fix);
    assert.ok(fix.includes('/mos:eureka enable engine --path <folder>'), 'Fix line lacks --path: ' + fix);
    assert.equal(JSON.parse(mod.run(['--check', '--json'], { env: envOf(iso), spawnSync: fake.spawnSync }).stdout).state, 'absent');
    assert.equal(fake.calls.length + rec.calls.length, 0, 'the check spawned something');
  });

  await arm('S13 --path and --sync still work: save, grant card exit 2, approved sync', async () => {
    const iso = mkIsolatedHome('395-s13');
    const engine = path.join(iso.home, 'own-engine');
    fs.mkdirSync(path.join(engine, '.venv', 'lib', 'python3.12', 'site-packages', 'mcp-2.0.0.dist-info'), { recursive: true });
    fs.writeFileSync(path.join(engine, 'pyproject.toml'), '[project]\nname = "mindrian-eureka"\nrequires-python = ">=3.11"\n\n[project.scripts]\neureka-mcp = "x:y"\n');
    const fake = fakeSpawnSync();
    const rec = recordingSpawn();
    const deps = { env: envOf(iso), spawnSync: fake.spawnSync, spawn: rec.spawn };
    const saved = mod.run(['--path', engine], deps);
    assert.equal(saved.exitCode, 0, out(saved));
    assert.equal(JSON.parse(fs.readFileSync(pointerFile(iso), 'utf8')).root, engine);
    const card = mod.run(['--sync'], deps);
    assert.equal(card.exitCode, 2, out(card));
    assert.equal(JSON.parse(card.stdout).kind, 'engine_sync_grant');
    assert.ok(!fake.calls.some((c) => c.args[0] === 'sync'), 'the sync ran without approval');
    const synced = mod.run(['--sync', '--approved-via', 'cli'], deps);
    assert.equal(synced.exitCode, 0, out(synced));
    assert.ok(synced.stdout.includes('The engine package sync finished.'), synced.stdout);
    assert.equal(fake.calls.filter((c) => c.args[0] === 'sync').length, 1, 'the approved sync must spawn once');
    assert.equal(rec.calls.length, 0, 'path or sync started the setup');
  });

  await arm('S14 source guard: runEngineSetup once, inside modeSetup, after the no-approval return; no model download code', async () => {
    const code = codeOf(MODULE);
    const calls = code.split('\n').filter((l) => /\brunEngineSetup\(/.test(l) && !/^function\s+runEngineSetup/.test(l) && !/module\.exports/.test(l));
    assert.equal(calls.length, 1, 'runEngineSetup must be called from exactly one place: ' + JSON.stringify(calls));
    const body = bodyOf(code, 'modeSetup');
    const approvalIdx = body.search(/o\.approvedVia\s*===\s*null/);
    const callIdx = body.search(/\brunEngineSetup\(/);
    assert.ok(approvalIdx !== -1 && callIdx !== -1 && approvalIdx < callIdx, 'runEngineSetup must come after the approval test');
    assert.ok(/return\s*\{\s*exitCode:\s*2/.test(body.slice(approvalIdx, callIdx)), 'the no-approval branch must return exit 2 before the setup');
    assert.equal((code.match(/https:\/\/raw\.githubusercontent\.com/g) || []).length, 1, 'the setup address must appear only in SETUP_SCRIPT_BASE');
    for (const f of [MODULE, path.join(REPO, 'lib', 'core', 'eureka', 'eureka-engine-requirements.cjs'), path.join(REPO, 'lib', 'core', 'eureka', 'eureka-engine-resolver.cjs'), CLI]) {
      assert.ok(!/snapshot_download|hf_hub_download|from_pretrained/.test(codeOf(f)), path.basename(f) + ' holds a model download call');
    }
  });

  await arm('S15 installer: flags not passed to claude; no card and no setup with --no-eureka or no terminal; card before run', async () => {
    const cli = codeOf(CLI);
    const offer = bodyOf(cli, 'offerEurekaSetup');
    const cardIdx = offer.indexOf("enable.run(['--setup'], {})");
    const runIdx = offer.indexOf("'--approved-via', 'cli'");
    assert.ok(cardIdx !== -1 && runIdx !== -1 && cardIdx < runIdx, 'the card must be printed before the approved run');
    assert.ok(/rawArgs\.filter\(\(a\) => a !== '--eureka' && a !== '--no-eureka'\)/.test(cli), 'the Eureka flags are not filtered out');
    const iso = mkIsolatedHome('395-s15');
    const bin = path.join(iso.home, 'fakebin');
    fs.mkdirSync(bin, { recursive: true });
    const log = path.join(iso.home, 'claude-argv.log');
    fs.writeFileSync(path.join(bin, 'claude'), '#!/bin/sh\necho "$*" >> "$FAKE_CLAUDE_LOG"\nexit 0\n', { mode: 0o755 });
    // a fake curl first on PATH: if the installer child ever started the setup, it gets this, not the network
    const curlLog = path.join(iso.home, 'curl-argv.log');
    fs.writeFileSync(path.join(bin, 'curl'), '#!/bin/sh\necho "$*" >> "' + curlLog + '"\nexit 1\n', { mode: 0o755 });
    const env = Object.assign(envOf(iso), { PATH: bin + path.delimiter + process.env.PATH, FAKE_CLAUDE_LOG: log });
    for (const args of [['--no-eureka'], []]) {
      const r = childProcess.spawnSync(process.execPath, [CLI].concat(args), { env, encoding: 'utf8', input: '', timeout: 60000 });
      assert.equal(r.status, 0, 'installer exit ' + r.status + ' ' + String(r.stderr).slice(0, 300));
      assert.ok(r.stdout.includes('Eureka engine (optional): run  /mos:eureka enable engine --setup'), 'no later line: ' + r.stdout.slice(-400));
      assert.ok(!r.stdout.includes('It reaches these websites'), 'a card was shown with ' + JSON.stringify(args));
      assert.ok(r.stdout.includes('Start:   open a fresh Claude Code session'), 'the install did not finish');
    }
    const argv = fs.readFileSync(log, 'utf8');
    assert.ok(argv.includes('plugin install mos@mindrian-marketplace'), 'claude plugin install was not called');
    assert.ok(!/eureka/i.test(argv), 'an Eureka flag reached claude: ' + argv);
    assert.ok(!fs.existsSync(path.join(iso.home, '.mindrian')), 'the installer wrote under HOME without a yes');
    assert.ok(!fs.existsSync(curlLog), 'the installer started the setup without a yes');
  });

  await arm('S18 CR-01: the card names every change of the script; an existing .bak file is kept before the run', async () => {
    const iso = mkIsolatedHome('395-s18');
    const posix = mod.run(['--setup'], { env: envOf(iso), platform: 'linux' }).stdout;
    for (const needle of ['every line that holds MINDRIAN_EUREKA_RS_MODEL_PATH is deleted', '~/.bashrc.bak and ~/.zshrc.bak',
      'replaces a file you already have with that name', '<name>.bak.mindrian-', 'the uv package cache', 'Python 3.12 managed by uv',
      'the uv installer from astral.sh puts uv in ~/.local/bin', 'shell start files', 'can become a plain file']) {
      assert.ok(posix.includes(needle), 'POSIX card lacks: ' + needle);
    }
    const win = mod.run(['--setup'], { env: envOf(iso), platform: 'win32' }).stdout;
    for (const needle of ['MINDRIAN_EUREKA_RS_MODEL_PATH', 'the uv package cache', 'Python 3.12 managed by uv', 'adds that folder to your user PATH']) {
      assert.ok(win.includes(needle), 'Windows card lacks: ' + needle);
    }
    assert.ok(!fs.existsSync(path.join(iso.home, '.mindrian')), 'the card wrote under HOME');
    // approved: ~/.bashrc and an own ~/.bashrc.bak exist; ~/.zshrc.bak exists without ~/.zshrc (the script skips it)
    fs.writeFileSync(path.join(iso.home, '.bashrc'), 'echo rc\n');
    fs.writeFileSync(path.join(iso.home, '.bashrc.bak'), 'my own backup\n');
    fs.writeFileSync(path.join(iso.home, '.zshrc.bak'), 'not touched\n');
    const engine = path.join(iso.home, '.mindrian', 'eureka-engine');
    const { result, screen } = await approved(iso, ['ok', engine], { now: new Date('2026-11-16T10:20:30.400Z') });
    assert.equal(result.exitCode, 0, out(result));
    const keep = path.join(iso.home, '.bashrc.bak.mindrian-2026-11-16T10-20-30-400Z');
    assert.equal(fs.readFileSync(keep, 'utf8'), 'my own backup\n', 'the own .bak file was not kept');
    assert.ok(screen.text().indexOf('MindrianOS kept a copy of ' + path.join(iso.home, '.bashrc.bak')) !== -1, 'the copy was not shown');
    assert.ok(screen.text().indexOf('kept a copy') < screen.text().indexOf('== 1/6 tools'), 'the copy must come before the setup runs');
    assert.ok(!fs.readdirSync(iso.home).some((n) => n.startsWith('.zshrc.bak.mindrian-')), 'a .bak file was copied for a start file that does not exist');
    // a second run in the same instant never replaces the kept copy: the setup stops before it runs
    const again = await approved(iso, ['ok', engine], { now: new Date('2026-11-16T10:20:30.400Z') });
    assert.equal(again.result.exitCode, 1, out(again.result));
    assert.ok(again.result.stderr.includes('The Eureka setup did not start.'), again.result.stderr);
    assert.equal(again.rec.calls.length, 0, 'the setup ran after a failed copy');
  });

  await arm('S17 the setup scripts are pinned to a 40-character engine commit, never a branch', async () => {
    assert.ok(/^[0-9a-f]{40}$/.test(PIN), 'EUREKA_SETUP_COMMIT is not a full 40-character commit: ' + PIN);
    const pin = /^https:\/\/raw\.githubusercontent\.com\/jsagir\/mindrian-eureka\/([^/]+)\/scripts\/setup-mindrianos\.(sh|ps1)$/;
    const win = mod.setupCommand('win32').args[4];
    const urls = [
      mod.setupCommand('linux').args[2],
      win.replace(/^irm /, '').replace(/ \| iex$/, ''),
      JSON.parse(mod.run(['--setup', '--json'], { env: { HOME: '/h' }, platform: 'linux' }).stdout).script,
      JSON.parse(mod.run(['--setup', '--json'], { env: { HOME: '/h' }, platform: 'win32' }).stdout).script,
    ];
    for (const u of urls) {
      const m = pin.exec(u);
      assert.ok(m, 'not a pinned setup script URL: ' + u);
      assert.equal(m[1], PIN, 'the URL does not use the pinned commit: ' + u);
    }
    const code = codeOf(MODULE);
    const decl = code.match(/const EUREKA_SETUP_COMMIT = '([^']*)';/g) || [];
    assert.equal(decl.length, 1, 'exactly one constant must hold the commit');
    assert.ok(!/mindrian-eureka\/(main|master|HEAD|refs)\b/.test(code), 'the module names a branch in an engine URL');
    for (const rel of ['commands/eureka.md', 'README.md', 'docs/integrations/mindrian-eureka-engine.md']) {
      const text = fs.readFileSync(path.join(REPO, rel), 'utf8');
      assert.ok(!/raw\.githubusercontent\.com\/jsagir\/mindrian-eureka\/(?![0-9a-f]{40}\/)/.test(text), rel + ' names an unpinned setup script URL');
    }
  });

  await arm('S16 no network attempt; no unstubbed spawn reached curl, powershell or the script URL', async () => {
    const remote = attempts.filter((a) => !a.local);
    assert.equal(remote.length, 0, 'non-loopback attempts: ' + JSON.stringify(remote.slice(0, 5)));
    const bad = globalSpawns.filter((s) => REAL_SETUP.test(s.command + ' ' + s.args.join(' ')));
    assert.equal(bad.length, 0, 'a spawn of the real setup was tried (and blocked): ' + JSON.stringify(bad));
  });

  process.stdout.write('\ntest-395-eureka-setup: ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed === 0 ? 0 : 1);
})();
