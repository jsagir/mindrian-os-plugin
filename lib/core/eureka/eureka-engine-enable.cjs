'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 387 plan 09 -- the /mos:eureka enable engine command core.
 *
 * WHAT: four exports.
 *   run(argv, deps)               -> { exitCode, stdout, stderr }   (the whole command, testable)
 *   main(argv)                    prints the result and sets process.exitCode
 *   runEngineSync(root, extras, deps)   the ONE network step: uv sync, behind an approval flag
 *   runEngineDoctor(root, deps)         the engine's own health check, offline, on request
 * Flags: --check (default), --path DIR, --forget, --data, --sync, --setup, --extras LIST,
 * --approved-via cli|gate, --deep, --json, --help.
 *
 * Phase 395 plan 11 (--setup, the one-step setup): without --approved-via it prints the consent card and
 * runs nothing (exit 2). With it, runEngineSetup runs the engine's own public setup script
 * (github.com/jsagir/mindrian-eureka, scripts/setup-mindrianos.sh or .ps1, Apache-2.0), pinned to the engine
 * commit EUREKA_SETUP_COMMIT (owner ruling 34: one commit per MindrianOS release). That script reaches
 * GitHub, PyPI, the PyTorch index and Hugging Face, and it downloads the meaning model. The plugin vendors
 * no engine code. The result comes from the last line of the script, then from the disk (the --path step).
 *
 * WHY: the audits (Plan 387-01 RCA, EUREKA-ENGINE-FACTS) show that setup is three parts and that a package
 * sync gives only the first: (1) Python packages, (2) a model folder the person places (the engine never
 * downloads one), (3) Node.js 22 or newer for some workers. The command says so before it asks for a grant
 * and proves what it did from the disk (a fresh probe of the installed package groups), never from an exit
 * code alone.
 *
 * WHICH ENGINE: the new mindrian-eureka (decision record, engine_identity). Folder checks come from
 * checkEngine in eureka-engine-requirements.cjs; the location rule and the saved setting come from
 * eureka-engine-resolver.cjs. This file re-implements neither (Part 7).
 *
 * Part 8: this module opens no network connection and no Brain connection. There are two network steps,
 * each a child behind --approved-via. The setup script (--setup) gets no room data and no CLAUDE_ variable.
 * The uv sync child passes --locked and --no-python-downloads (no Python fetch from
 * github.com) and only the known extras. Check, path, forget and data spawn only what checkEngine spawns
 * (uv --version, uv python find, node --version) and no engine code. The engine doctor runs offline.
 * The child environment is an allowlist: no CLAUDE_ or MINDRIAN_ variable reaches a child.
 *
 * The command installs nothing except through the approved sync or the approved setup. The sync never
 * installs uv, Python, Node or a model. The approved setup script can install uv and Python 3.12 and can
 * download the model; nothing runs before the card is approved. The command never deletes the engine data,
 * cache or environment folders (--forget removes the saved setting only).
 *
 * ENGINE DOCTOR JSON KEYS (read-only look at mindrian_eureka/doctor.py, names only): the document holds
 * schema_version, ok and checks; each check holds id, name, status (PASS, WARN or FAIL), message (can span
 * lines) and fix (text or null).
 *
 * Plan note: extras are validated before the uv and Python checks, so an unknown group name spawns
 * nothing at all.
 */

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');
const { StringDecoder } = require('node:string_decoder');
const resolver = require('./eureka-engine-resolver.cjs');
const requirements = require('./eureka-engine-requirements.cjs');

const SYNC_TIMEOUT_MS = 20 * 60 * 1000;
const DOCTOR_TIMEOUT_MS = 60 * 1000;
const SYNC_OUTPUT_CAP = 500;
const DOCTOR_OUTPUT_CAP = 4000;
const WALK_LIMIT = 20000;
const LINE_CAP = 200;

const CHILD_ENV_KEYS = Object.freeze([
  'HOME', 'USERPROFILE', 'PATH', 'SHELL', 'TERM', 'USER', 'LANG', 'LC_ALL', 'TMPDIR', 'TEMP', 'TMP',
  'UV_CACHE_DIR', 'UV_PYTHON_INSTALL_DIR', 'UV_PROJECT_ENVIRONMENT',
  'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'no_proxy', 'SSL_CERT_FILE',
]);
const OFFLINE_KEYS = Object.freeze(['UV_OFFLINE', 'HF_HUB_OFFLINE', 'TRANSFORMERS_OFFLINE']);

const SIZE_NOTE = 'audit estimate, NOT CHECKED: mcp-server alone 100 to 250 MB; over 1 GB with modern-encoder';
const ENABLE = '/mos:eureka enable engine';

// Phase 395 plan 11: the one-step setup (--setup). The engine repository is public (Apache-2.0).
// Owner ruling 34: the setup steps are pinned per MindrianOS release. EUREKA_SETUP_COMMIT is the full
// 40-character commit of mindrian-eureka whose setup scripts were tested for this version. A release that
// moves the pin changes ONLY this line (docs/RELEASE-CEREMONY-RULING-SYSTEM.md, RULE 5 note). Never a branch name.
const EUREKA_SETUP_COMMIT = '9b91d252f532366b7a1958cbbf2d98eaaa9753eb';
const SETUP_SCRIPT_BASE = 'https://raw.githubusercontent.com/jsagir/mindrian-eureka/' + EUREKA_SETUP_COMMIT + '/scripts/';
const SETUP_SCRIPT_POSIX = SETUP_SCRIPT_BASE + 'setup-mindrianos.sh';
const SETUP_SCRIPT_WINDOWS = SETUP_SCRIPT_BASE + 'setup-mindrianos.ps1';
const SETUP_TIMEOUT_MS = 30 * 60 * 1000;
const SETUP_TAIL_CAP = 8192;
const SETUP_REASON_CAP = 200;
const SETUP_ENV_KEYS = Object.freeze(CHILD_ENV_KEYS.concat([
  'MINDRIAN_EUREKA_ROOT', 'XDG_CACHE_HOME', 'HF_HOME', 'HF_HUB_CACHE', 'SSL_CERT_DIR', 'REQUESTS_CA_BUNDLE',
  'SystemRoot', 'windir', 'ComSpec', 'PATHEXT', 'APPDATA', 'LOCALAPPDATA', 'HOMEDRIVE', 'HOMEPATH',
  'PSModulePath', 'ProgramData', 'ProgramFiles',
  // WR-06 (395-11 review): Windows system variables that Git for Windows, the uv installer, uv and Python read
  'SystemDrive', 'USERNAME', 'USERDOMAIN', 'PROCESSOR_ARCHITECTURE', 'NUMBER_OF_PROCESSORS', 'OS', 'ProgramFiles(x86)',
  'ProgramW6432', 'CommonProgramFiles', 'CommonProgramFiles(x86)', 'CommonProgramW6432', 'ALLUSERSPROFILE', 'PUBLIC',
  // WR-07 (395-11 review): the proxy, certificate and package-index settings of a managed network.
  // They carry no room data and no Brain key.
  'ALL_PROXY', 'all_proxy', 'UV_INDEX_URL', 'UV_DEFAULT_INDEX', 'UV_EXTRA_INDEX_URL', 'UV_INDEX', 'UV_NATIVE_TLS',
  'PIP_INDEX_URL', 'PIP_EXTRA_INDEX_URL', 'PIP_CERT', 'HF_ENDPOINT', 'CURL_CA_BUNDLE', 'GIT_SSL_CAINFO', 'NODE_EXTRA_CA_CERTS',
]));
const SETUP_HOSTS = Object.freeze([
  'raw.githubusercontent.com: the engine\'s setup steps as tested for this MindrianOS version (engine commit ' + EUREKA_SETUP_COMMIT.slice(0, 7) + ')',
  'github.com: the newest engine code, and Python 3.12 when this computer has none',
  'astral.sh: the uv tool, only when this computer has none',
  'pypi.org, files.pythonhosted.org and download.pytorch.org: the Python packages',
  'huggingface.co: the meaning model all-MiniLM-L6-v2 (about 90 MB)',
]);
const SETUP_STEP_TEXT = Object.freeze({
  // WR-08 (395-11 review): the tools step fails for a missing curl or git and for a failed uv install
  tools: ['A tool that the setup needs is missing or could not be installed (curl, git or uv).', 'Install the tool that the setup named above (curl, git or uv), then run ' + ENABLE + ' --setup again'],
  download: ['The setup steps could not be downloaded from raw.githubusercontent.com.', 'Check the network or the proxy, then run ' + ENABLE + ' --setup again'],
  engine: ['The engine code could not be downloaded.', 'Check the network or the proxy, then run ' + ENABLE + ' --setup again'],
  packages: ['The Python packages could not be installed.', 'Check the network or the proxy, then run ' + ENABLE + ' --setup again'],
  model: ['The meaning model could not be downloaded.', 'Check the network or the proxy, then run ' + ENABLE + ' --setup again'],
  doctor: ['The engine health check found a problem after the setup.', ENABLE + ' --check --deep'],
  connect: ['The engine is set up, but MindrianOS could not save its folder.', ENABLE + ' --path <folder>'],
});
// CR-01 (395-11 review): the pinned script runs sed -i.bak on ~/.bashrc and ~/.zshrc, which replaces an existing
// ~/.bashrc.bak or ~/.zshrc.bak. The plugin cannot change the pinned script, so it keeps a copy first.
const SHELL_BACKUP_KEEP = '<name>.bak.mindrian-';
const SHELL_START_FILES = Object.freeze(['.zshrc', '.bashrc']);
const ABSENT_FIX = ENABLE + ' --setup (one step; it shows what it reaches and downloads before it runs), or ' + ENABLE + ' --path <folder> for an engine folder you already have';

const USAGE = [
  'Usage: ' + ENABLE + ' [flags]',
  '  --check                 report whether the engine is set up (default)',
  '  --path DIR              save an engine folder you already have (absolute path)',
  '  --forget                remove the saved setting (data, cache and environment stay)',
  '  --data                  list what the engine writes, with sizes (deletes nothing)',
  '  --sync                  prepare the Python packages (the one network step; needs approval)',
  '  --setup                 one step: get and set up the engine with its own setup script (card first; needs approval)',
  '  --extras LIST           package groups for --sync: mcp-server (always), modern-encoder, reference-encoder, hmm',
  '  --approved-via cli|gate record that you approved the grant card',
  '  --deep                  with --check: run the engine own health check (offline)',
  '  --json                  print JSON',
  '  --help                  print this text',
];

function envObject(deps) {
  const e = deps && deps.env;
  if (e === undefined || e === null) return process.env;
  return typeof e === 'object' ? e : {};
}

function str(value) { return typeof value === 'string' && value.trim() ? value : null; }

function homeOf(env) { return str(env.HOME) || str(env.USERPROFILE) || ''; }

function uvCommandOf(env) { return str(env.MINDRIAN_EUREKA_UV) || 'uv'; }

function isDir(p) { try { return fs.statSync(p).isDirectory(); } catch (_e) { return false; } }

// ---------------------------------------------------------------------------
// argument router (switch-case, no parser library)
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = Array.isArray(argv) ? argv.map(String) : [];
  const o = { check: false, path: null, forget: false, data: false, sync: false, setup: false, extras: null, approvedVia: null, deep: false, json: false, help: false, error: null };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    switch (a) {
      case '--check': o.check = true; break;
      case '--forget': o.forget = true; break;
      case '--data': o.data = true; break;
      case '--sync': o.sync = true; break;
      case '--setup': o.setup = true; break;
      case '--deep': o.deep = true; break;
      case '--json': o.json = true; break;
      case '--help': case '-h': o.help = true; break;
      case '--path': case '--extras': case '--approved-via': {
        const value = args[i + 1];
        if (value === undefined) { o.error = a + ' needs a value.'; break; }
        i += 1;
        if (a === '--path') o.path = value;
        else if (a === '--extras') o.extras = value;
        else o.approvedVia = value;
        break;
      }
      default:
        o.error = 'Unknown flag: ' + a.slice(0, 40).replace(/[^\x20-\x7e]/g, '?');
    }
  }
  return o;
}

// ---------------------------------------------------------------------------
// text helpers
// ---------------------------------------------------------------------------

function errorLines(headline, why, fix) {
  return ['x ' + headline, '  Why: ' + why, '  Fix: ' + fix];
}

function scrubLines(text, ctx, maxLines) {
  const out = [];
  for (const raw of String(text === null || text === undefined ? '' : text).split(/\r?\n/)) {
    const line = requirements.startLine(raw, ctx);
    if (line) out.push(line.slice(0, LINE_CAP));
    if (out.length >= maxLines) break;
  }
  return out;
}

function humanSize(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

// bounded walk: stops at WALK_LIMIT entries; symlinks are not followed
function folderSize(root) {
  let bytes = 0;
  let entries = 0;
  let truncated = false;
  if (!isDir(root)) return { present: false, bytes: 0, entries: 0, truncated: false };
  const stack = [root];
  while (stack.length > 0 && !truncated) {
    const dir = stack.pop();
    let list = [];
    try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { list = []; }
    for (const entry of list) {
      entries += 1;
      if (entries > WALK_LIMIT) { truncated = true; break; }
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) {
        try { bytes += fs.statSync(full).size; } catch (_e) { /* unreadable file */ }
      }
    }
  }
  return { present: true, bytes, entries: Math.min(entries, WALK_LIMIT), truncated };
}

// ---------------------------------------------------------------------------
// the report (check, and the tail of path and sync)
// ---------------------------------------------------------------------------

function checkOf(result, id) {
  return (result && Array.isArray(result.checks) ? result.checks : []).find((c) => c.id === id) || null;
}

function setupParts(env, root, result) {
  let packages;
  if (!root) {
    packages = 'not checked (no engine folder yet)';
  } else {
    const inst = requirements.extrasInstalled(root, env);
    if (!inst.venv_present) packages = 'no environment yet (run ' + ENABLE + ' --sync)';
    else if (!inst.located) packages = 'environment found, package groups could not be read';
    else {
      const have = Object.keys(inst.installed).filter((k) => inst.installed[k] === true);
      packages = have.length ? 'installed groups: ' + have.join(', ') : 'none of the engine groups are installed (run ' + ENABLE + ' --sync)';
    }
  }
  const hint = requirements.modelHint(env);
  const model = hint.found ? 'found via ' + hint.via + ' (advisory)' : 'not found (advisory; the engine own search may differ)';
  const nodeCheck = checkOf(result, 'node');
  let node = 'not checked';
  if (nodeCheck && nodeCheck.ok === true) node = nodeCheck.detail + ' ok';
  else if (nodeCheck && nodeCheck.ok === false) node = nodeCheck.detail;
  return [
    '1 Python packages: ' + packages,
    '2 Model folder (the approved --setup downloads it, or you place it; the engine never downloads one by itself): ' + model,
    '3 Node.js 22 or newer for some workers: ' + node,
  ];
}

function buildReport(env, deps) {
  const engine = resolver.resolveEngine(env);
  const facts = {
    state: engine.state, source: engine.source, root: engine.root, ok: null, cause: engine.cause,
    sentence: '', fix: '', checks: [], families: [], setting_path: resolver.enginePointerPath(env),
  };
  let result = null;
  if (engine.state === 'present') {
    result = requirements.checkEngine(engine.root, { env, spawnSync: deps && deps.spawnSync });
    facts.ok = result.ok;
    facts.cause = result.cause;
    facts.checks = result.checks;
    facts.families = result.families;
    if (result.ok === true) {
      facts.sentence = 'The Eureka engine is set up and ready for the graph tools.';
    } else if (result.ok === null) {
      facts.sentence = 'The Eureka engine is set up, but its installed package groups could not be verified.';
      facts.fix = ENABLE + ' --check --deep';
    } else {
      const d = resolver.describeEngineState({ state: 'broken', cause: result.cause, detail: { extras: ['mcp-server'] } });
      facts.sentence = d.sentence;
      facts.fix = d.fix;
    }
  } else {
    const d = resolver.describeEngineState({ state: engine.state, cause: engine.cause });
    facts.sentence = d.sentence;
    facts.fix = engine.state === 'absent' ? ABSENT_FIX : d.fix;
  }
  facts.setup_parts = setupParts(env, engine.state === 'present' ? engine.root : null, result);
  facts.engine_result = result;
  return facts;
}

function reportLines(facts) {
  const lines = [];
  if (facts.state === 'absent') lines.push('Engine: not set up');
  else if (facts.state === 'broken') lines.push('Engine: saved, but the folder is not usable (source: ' + facts.source + ')');
  else if (facts.ok === true) lines.push('Engine: set up and ready (source: ' + facts.source + ', folder: ' + facts.root + ')');
  else lines.push('Engine: set up, not ready yet (source: ' + facts.source + ', folder: ' + facts.root + ')');
  lines.push(facts.sentence);
  if (facts.fix) lines.push('  Fix: ' + facts.fix);
  for (const c of facts.checks) {
    const mark = c.ok === true ? 'ok     ' : c.ok === false ? 'MISSING' : 'skipped';
    lines.push('  ' + mark + ' ' + c.id + ': ' + c.detail);
  }
  if (facts.families.length) {
    lines.push('Route families:');
    for (const f of facts.families) lines.push('  ' + f.family + ': ' + f.status + ' (needs ' + f.needs.join(', ') + ')');
  }
  // WR-09 (395-11 review): this report also follows a finished --setup, which prepared parts 1 and 2
  lines.push('Setup has three parts. --sync prepares part 1; --setup prepares parts 1 and 2. Each runs only after you approve its card.');
  for (const part of facts.setup_parts) lines.push('  ' + part);
  return lines;
}

function publicFacts(facts) {
  const copy = Object.assign({}, facts);
  delete copy.engine_result;
  return copy;
}

// ---------------------------------------------------------------------------
// the child spawns: the ONLY two functions that start a process
// ---------------------------------------------------------------------------

function childEnvironment(env, offline) {
  const out = {};
  for (const key of CHILD_ENV_KEYS) if (typeof env[key] === 'string') out[key] = env[key];
  if (offline) for (const key of OFFLINE_KEYS) out[key] = '1';
  return out;
}

function runEngineSync(root, extras, deps) {
  const env = envObject(deps);
  const spawn = (deps && deps.spawnSync) || childProcess.spawnSync;
  const args = requirements.uvSyncArgs(Array.isArray(extras) ? extras : []);
  let res;
  try {
    res = spawn(uvCommandOf(env), args, {
      shell: false, cwd: root, encoding: 'utf8', timeout: SYNC_TIMEOUT_MS, input: '',
      env: childEnvironment(env, false), windowsHide: true, maxBuffer: 8 * 1024 * 1024,
    });
  } catch (error) {
    return { status: null, error: String(error && error.code || 'spawn_failed'), stdout: '', stderr: '' };
  }
  return {
    status: typeof res.status === 'number' ? res.status : null,
    error: res.error ? String(res.error.code || 'spawn_failed') : null,
    stdout: String(res.stdout || '').slice(0, SYNC_OUTPUT_CAP),
    stderr: String(res.stderr || '').slice(0, SYNC_OUTPUT_CAP),
  };
}

function runEngineDoctor(root, deps) {
  const env = envObject(deps);
  const spawn = (deps && deps.spawnSync) || childProcess.spawnSync;
  const args = requirements.uvRunArgs(root, ['mcp-server'], { entry: ['eureka', 'doctor', '--json'] });
  let res;
  try {
    res = spawn(uvCommandOf(env), args, {
      shell: false, cwd: root, encoding: 'utf8', timeout: DOCTOR_TIMEOUT_MS, input: '',
      env: childEnvironment(env, true), windowsHide: true, maxBuffer: 8 * 1024 * 1024,
    });
  } catch (error) {
    return { status: null, error: String(error && error.code || 'spawn_failed'), stdout: '', stderr: '' };
  }
  return {
    status: typeof res.status === 'number' ? res.status : null,
    error: res.error ? String(res.error.code || 'spawn_failed') : null,
    stdout: String(res.stdout || '').slice(0, DOCTOR_OUTPUT_CAP),
    stderr: String(res.stderr || '').slice(0, DOCTOR_OUTPUT_CAP),
  };
}

// the setup child (Phase 395 plan 11): the engine's own setup script, only after the card is approved.
// Its environment is an allowlist: no CLAUDE_ variable, no room variable and no Brain variable reaches it.
function setupEnvironment(env) {
  const out = {};
  for (const key of SETUP_ENV_KEYS) if (typeof env[key] === 'string') out[key] = env[key];
  return out;
}

// WR-08 (395-11 review): no "curl | bash" pipe. A missing curl, a failed download or an empty file gives a
// result line with its own step; only a complete download runs. $0 is the pinned script address.
const POSIX_SETUP_RUNNER = [
  'command -v curl >/dev/null 2>&1 || { echo "EUREKA_SETUP: FAIL tools curl is missing; install curl, then run again"; exit 1; }',
  'f=$(mktemp "${TMPDIR:-/tmp}/mindrian-eureka-setup.XXXXXX") || { echo "EUREKA_SETUP: FAIL download no temporary file could be made"; exit 1; }',
  'trap \'rm -f "$f"\' EXIT',
  'curl -fsSL "$0" -o "$f" && [ -s "$f" ] || { echo "EUREKA_SETUP: FAIL download the setup steps could not be downloaded (network or proxy?)"; exit 1; }',
  'bash "$f"',
].join('\n');

function setupCommand(platform) {
  if (platform === 'win32') {
    return { command: 'powershell.exe', args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'irm ' + SETUP_SCRIPT_WINDOWS + ' | iex'] };
  }
  return { command: 'bash', args: ['-c', POSIX_SETUP_RUNNER, SETUP_SCRIPT_POSIX] };
}

// streams the child output to the person and keeps the tail to read the result line
function runEngineSetup(platform, deps) {
  const env = envObject(deps);
  const spawn = (deps && deps.spawn) || childProcess.spawn;
  const cmd = (deps && deps.setupCommand) || setupCommand(platform);
  const stream = (deps && deps.stream) || process.stdout;
  const win = platform === 'win32';
  const timeoutMs = deps && Number.isFinite(deps.timeoutMs) && deps.timeoutMs > 0 ? deps.timeoutMs : SETUP_TIMEOUT_MS;
  return new Promise((resolve) => {
    let tail = '';
    let settled = false;
    let timer = null;
    let child = null;
    // WR-01 (395-11 review): the setup is a pipeline (curl, bash, git, uv, python). Stop the WHOLE tree:
    // on POSIX the child leads its own process group (detached), on Windows taskkill /T stops the tree.
    const stopTree = (signal) => {
      if (!child) return;
      if (child.pid && win) {
        try { childProcess.spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 10000 }); } catch (_e) { /* gone */ }
        return;
      }
      if (child.pid) { try { process.kill(-child.pid, signal); return; } catch (_e) { /* no group: fall back */ } }
      try { child.kill(signal); } catch (_e) { /* already gone */ }
    };
    // a detached group does not get the Ctrl-C or the host kill of this process, so pass them on
    const onSignal = (signal) => { stopTree('SIGTERM'); unhook(); try { process.kill(process.pid, signal); } catch (_e) { process.exit(1); } };
    const onExit = () => stopTree('SIGTERM');
    const SIGNALS = win ? [] : ['SIGINT', 'SIGTERM', 'SIGHUP'];
    const unhook = () => { for (const s of SIGNALS) process.removeListener(s, onSignal); process.removeListener('exit', onExit); };
    const finish = (r) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      unhook();
      resolve(r);
    };
    // WR-02 (395-11 review): both pipes go to the screen, but the tail (where the result line is read) holds
    // stdout only. Each pipe has its own UTF-8 decoder, so a chunk boundary inside a character breaks nothing.
    const decoders = { out: new StringDecoder('utf8'), err: new StringDecoder('utf8') };
    const show = (s) => { if (s) { try { stream.write(s); } catch (_e) { /* the person's screen is gone; keep the tail */ } } };
    const take = (which) => (chunk) => {
      const s = typeof chunk === 'string' ? chunk : decoders[which].write(chunk);
      show(s);
      if (which === 'out') tail = (tail + s).slice(-SETUP_TAIL_CAP);
    };
    const flush = () => {
      const rest = decoders.out.end();
      show(rest + decoders.err.end());
      tail = (tail + rest).slice(-SETUP_TAIL_CAP);
      return tail;
    };
    try {
      child = spawn(cmd.command, cmd.args, { shell: false, env: setupEnvironment(env), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, detached: !win });
    } catch (error) {
      finish({ status: null, error: String(error && error.code || 'spawn_failed'), tail: '' });
      return;
    }
    for (const s of SIGNALS) process.on(s, onSignal);
    process.on('exit', onExit);
    timer = setTimeout(() => {
      stopTree('SIGTERM');
      const hard = setTimeout(() => stopTree('SIGKILL'), 5000);
      if (hard && hard.unref) hard.unref();
      try { if (child.stdout) child.stdout.destroy(); if (child.stderr) child.stderr.destroy(); } catch (_e) { /* closed */ }
      finish({ status: null, error: 'timeout', tail });
    }, timeoutMs);
    if (child.stdout) child.stdout.on('data', take('out'));
    if (child.stderr) child.stderr.on('data', take('err'));
    child.on('error', (error) => finish({ status: null, error: String(error && error.code || 'spawn_failed'), tail }));
    child.on('close', (code) => { if (!settled) flush(); finish({ status: typeof code === 'number' ? code : null, error: null, tail }); });
  });
}

// ---------------------------------------------------------------------------
// modes
// ---------------------------------------------------------------------------

function done(exitCode, stdoutLines, stderrLines) {
  return { exitCode, stdout: stdoutLines.length ? stdoutLines.join('\n') + '\n' : '', stderr: stderrLines && stderrLines.length ? stderrLines.join('\n') + '\n' : '' };
}

function jsonDone(exitCode, obj) {
  return { exitCode, stdout: JSON.stringify(obj, null, 2) + '\n', stderr: '' };
}

function deepSection(env, facts, deps) {
  const ctx = { root: facts.root, home: homeOf(env) };
  const lines = ['Engine health check (the engine own checks, offline):'];
  const blocked = ['checkout_missing', 'pyproject_missing', 'project_name_mismatch', 'uv_missing', 'python_missing'];
  if (facts.state !== 'present' || blocked.indexOf(facts.cause) !== -1) {
    lines.push('  skipped: the engine cannot start yet (see the checks above).');
    return { exitCode: 0, lines, data: { skipped: true } };
  }
  const res = runEngineDoctor(facts.root, Object.assign({}, deps, { env }));
  let doc = null;
  try { doc = JSON.parse(res.stdout); } catch (_e) { doc = null; }
  const checks = doc && Array.isArray(doc.checks) ? doc.checks : null;
  if (!checks) {
    if (res.error === 'ENOENT') {
      const d = resolver.describeEngineState({ state: 'broken', cause: 'uv_missing' });
      lines.push('x The engine health check could not start.', '  Why: ' + d.sentence, '  Fix: ' + d.fix);
      return { exitCode: 1, lines, data: { error: res.error } };
    }
    const shown = scrubLines((res.stdout || '') + '\n' + (res.stderr || ''), ctx, 8);
    lines.push('x The engine did not return a health report.');
    for (const l of shown) lines.push('  ' + l);
    lines.push('Engine exit code: ' + res.status);
    return { exitCode: 1, lines, data: { status: res.status } };
  }
  let missingLibraries = false;
  for (const c of checks) {
    const status = String(c && c.status || '').toUpperCase();
    if (status === 'PASS') continue;
    const id = String(c.id || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 8);
    const name = String(c.name || '').replace(/[^\x20-\x7e]/g, '?').slice(0, 40);
    lines.push('  [' + status + '] ' + id + ' ' + name);
    for (const l of scrubLines(c.message, ctx, 4)) lines.push('    ' + l);
    for (const l of scrubLines(c.fix, ctx, 2)) lines.push('    fix: ' + l);
    if (/librar/i.test(String(name)) || /librar/i.test(String(c.message || ''))) missingLibraries = true;
  }
  if (lines.length === 1) lines.push('  every engine check passed');
  const inst = requirements.extrasInstalled(facts.root, env);
  if (missingLibraries && inst.installed['modern-encoder'] !== true) {
    lines.push('Note: the engine health check needs the encoder libraries. On a setup with only the mcp-server group it reports them as missing. That is the engine own answer.');
  }
  lines.push('Engine exit code: ' + res.status);
  return { exitCode: 0, lines, data: { status: res.status, ok: doc.ok === true } };
}

function modeCheck(o, env, deps) {
  const facts = buildReport(env, deps);
  let exitCode = 0;
  const lines = reportLines(facts);
  let deep = null;
  if (o.deep) {
    deep = deepSection(env, facts, deps);
    exitCode = deep.exitCode;
    for (const l of deep.lines) lines.push(l);
  }
  if (o.json) {
    const out = publicFacts(facts);
    if (deep) out.deep = deep.data;
    return jsonDone(exitCode, out);
  }
  return done(exitCode, lines);
}

function modePath(o, env, deps) {
  const raw = o.path;
  const refuse = (why, fix) => ({ exitCode: 1, stdout: '', stderr: errorLines('Could not save the Eureka engine folder.', why, fix || ENABLE + ' --path <absolute folder>').join('\n') + '\n' });
  if (typeof raw !== 'string' || !raw.trim()) return refuse('The folder path is empty.');
  if (raw.indexOf('\u0000') !== -1) return refuse('The folder path holds a character that is not allowed.');
  if (!path.isAbsolute(raw)) return refuse('The folder path is not an absolute path.');
  const root = path.resolve(raw);
  if (!isDir(root)) return refuse(resolver.describeEngineState({ state: 'broken', cause: 'checkout_missing' }).sentence);
  // folder and project-name checks only: a probe that cannot spawn anything
  const noProbe = () => ({ error: new Error('probe disabled'), status: null, stdout: '', stderr: '' });
  const folder = requirements.checkEngine(root, { env, spawnSync: noProbe });
  if (['checkout_missing', 'pyproject_missing', 'project_name_mismatch'].indexOf(folder.cause) !== -1) {
    const d = resolver.describeEngineState({ state: 'broken', cause: folder.cause });
    return refuse(d.sentence, d.fix);
  }
  const saved = resolver.writePointer(root, env);
  if (!saved.ok) return refuse('The setting file could not be written (' + saved.error + ').');
  // report from the saved setting (a set variable would win over it and hide what was just saved)
  const reportEnv = Object.assign({}, env);
  delete reportEnv.MINDRIAN_EUREKA_ROOT;
  const facts = buildReport(reportEnv, deps);
  facts.saved = true;
  facts.saved_to = saved.path;
  const coreCauses = ['uv_missing', 'python_missing', 'env_not_synced', 'extra_missing'];
  const exitCode = facts.ok === false && coreCauses.indexOf(facts.cause) !== -1 ? 1 : 0;
  if (o.json) return jsonDone(exitCode, publicFacts(facts));
  const lines = ['Saved the Eureka engine folder: ' + root].concat(reportLines(facts));
  return done(exitCode, lines);
}

function modeForget(o, env) {
  const res = resolver.clearPointer(env);
  const lines = [];
  if (!res.ok) lines.push('x The saved setting could not be removed (' + res.error + ').');
  else lines.push(res.removed ? 'Removed the saved engine setting.' : 'There was no saved engine setting.');
  lines.push('That is all this command removes. The engine data and cache folders and the .venv stay. Run ' + ENABLE + ' --data to see where they are.');
  if (str(env.MINDRIAN_EUREKA_ROOT)) lines.push('The variable MINDRIAN_EUREKA_ROOT is still set in this environment and still wins.');
  if (o.json) return jsonDone(res.ok ? 0 : 1, { removed: res.removed === true, ok: res.ok });
  return done(res.ok ? 0 : 1, lines);
}

function modeData(o, env) {
  const places = requirements.engineWrites(env).map((p) => Object.assign({}, p, folderSize(p.path)));
  if (o.json) return jsonDone(0, { places, deletes: 'nothing' });
  const lines = ['What the Eureka engine writes or reads on this machine:'];
  for (const p of places) {
    const size = p.present ? p.bytes + ' bytes (' + humanSize(p.bytes) + ')' + (p.truncated ? ', stopped counting at ' + WALK_LIMIT + ' entries' : '') : 'not present';
    lines.push('  ' + p.kind + ': ' + p.path + ' - ' + p.access + ' - ' + size);
  }
  lines.push('This command deletes none of them.');
  return done(0, lines);
}

function parseExtras(raw) {
  if (raw === null) return { ok: true, list: [] };
  const names = String(raw).split(',').map((s) => s.trim()).filter(Boolean);
  const bad = names.find((n) => requirements.SYNC_EXTRAS_ALLOWED.indexOf(n) === -1);
  if (bad !== undefined) return { ok: false, bad };
  return { ok: true, list: names };
}

function modeSync(o, env, deps) {
  const engine = resolver.resolveEngine(env);
  if (engine.state !== 'present') {
    const d = resolver.describeEngineState({ state: engine.state, cause: engine.cause });
    return { exitCode: 1, stdout: '', stderr: errorLines('The engine package sync cannot run.', d.sentence, d.fix).join('\n') + '\n' };
  }
  const parsed = parseExtras(o.extras);
  if (!parsed.ok) {
    return { exitCode: 1, stdout: '', stderr: errorLines('The package group name is not allowed.', 'Allowed groups: ' + requirements.SYNC_EXTRAS_ALLOWED.join(', ') + '.', ENABLE + ' --sync --extras mcp-server').join('\n') + '\n' };
  }
  if (o.approvedVia !== null && o.approvedVia !== 'cli' && o.approvedVia !== 'gate') {
    return { exitCode: 1, stdout: '', stderr: errorLines('The approval value is not allowed.', '--approved-via takes cli or gate.', ENABLE + ' --sync --approved-via cli').join('\n') + '\n' };
  }
  const ordered = ['mcp-server'].concat(parsed.list.filter((n) => n !== 'mcp-server').filter((n, i, a) => a.indexOf(n) === i));
  // uv and Python must pass before any grant card is shown
  const pre = requirements.checkEngine(engine.root, { env, spawnSync: deps && deps.spawnSync });
  if (['checkout_missing', 'pyproject_missing', 'project_name_mismatch', 'uv_missing', 'python_missing'].indexOf(pre.cause) !== -1) {
    const d = resolver.describeEngineState({ state: 'broken', cause: pre.cause });
    return { exitCode: 1, stdout: '', stderr: errorLines('The engine package sync cannot run.', d.sentence, d.fix).join('\n') + '\n' };
  }
  const hosts = requirements.syncHosts(ordered);
  if (o.approvedVia === null) {
    const card = {
      kind: 'engine_sync_grant',
      command: [uvCommandOf(env)].concat(requirements.uvSyncArgs(ordered)),
      extras: ordered,
      hosts: hosts.hosts,
      python_downloads: hosts.python_downloads,
      builds_from_source: hosts.builds_from_source,
      writes: requirements.engineWrites(env),
      model: 'not fetched by this plugin; you place a model folder yourself',
      node: 'not installed by this plugin',
      size_note: SIZE_NOTE,
      then_offline: true,
    };
    return { exitCode: 2, stdout: JSON.stringify(card, null, 2) + '\n', stderr: 'Approval needed. Nothing was run. Show the grant card, then run again with --approved-via cli or gate.\n' };
  }
  const res = runEngineSync(engine.root, ordered, Object.assign({}, deps, { env }));
  const ctx = { root: engine.root, home: homeOf(env) };
  if (res.error === 'ENOENT') {
    const d = resolver.describeEngineState({ state: 'broken', cause: 'uv_missing' });
    return { exitCode: 1, stdout: '', stderr: errorLines('The package sync did not start.', d.sentence, d.fix).join('\n') + '\n' };
  }
  if (res.error || res.status !== 0) {
    const shown = scrubLines(res.stderr + '\n' + res.stdout, ctx, 3);
    const classified = requirements.classifyEngineText(res.stderr + '\n' + res.stdout);
    const d = resolver.describeEngineState({ state: 'broken', cause: classified ? classified.cause : 'engine_start_failed', detail: classified || {} });
    const why = d.sentence + (shown.length ? ' uv said: ' + shown.join(' / ') : '') + ' (exit ' + res.status + ')';
    return { exitCode: 1, stdout: '', stderr: errorLines('The package sync failed.', why, d.fix).join('\n') + '\n' };
  }
  // report from the disk, never from the exit code alone
  const inst = requirements.extrasInstalled(engine.root, env);
  const missing = ordered.filter((g) => !(inst.installed && inst.installed[g] === true));
  const result = { checks: [] };
  const nodeCheck = pre.checks.find((c) => c.id === 'node');
  if (nodeCheck) result.checks.push(nodeCheck);
  const parts = setupParts(env, engine.root, result);
  if (missing.length) {
    const d = resolver.describeEngineState({ state: 'broken', cause: 'extra_missing', detail: { extras: missing } });
    const body = errorLines('The sync ended but these package groups are not installed: ' + missing.join(', ') + '.', 'cause extra_missing. ' + d.sentence, d.fix);
    return { exitCode: 1, stdout: '', stderr: body.concat(parts.map((p) => '  ' + p)).join('\n') + '\n' };
  }
  if (o.json) return jsonDone(0, { ok: true, installed: ordered, setup_parts: parts });
  const lines = ['The engine package sync finished. Installed groups (read from the environment folder): ' + ordered.join(', ') + '.',
    'The engine now starts offline. This command did not place a model folder and did not install Node.js.'];
  for (const p of parts) lines.push('  ' + p);
  return done(0, lines);
}

// The last line of the setup script: "EUREKA_SETUP: OK <folder>", "EUREKA_SETUP: OK engine-only <folder>"
// or "EUREKA_SETUP: FAIL <step> <reason>", step one of tools, download (the plugin runner), engine, packages,
// model, doctor, connect.
// WR-02 (395-11 review): the text is the stdout tail only; colour codes are removed, and the result is the last
// line that starts with EUREKA_SETUP: (a later progress or warning line does not hide it).
const ANSI_CODES = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g;
function parseSetupLine(text) {
  const clean = String(text === null || text === undefined ? '' : text).replace(ANSI_CODES, '');
  const lines = clean.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
  let last = '';
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].startsWith('EUREKA_SETUP:')) { last = lines[i]; break; }
  }
  // IN-04: "OK engine-only" with no folder is engine-only with the default folder, never the folder "engine-only"
  let m = /^EUREKA_SETUP: OK engine-only(?: (.+))?$/.exec(last);
  if (m) return { form: 'ok_engine_only', folder: m[1] ? m[1].trim() : null, step: null, reason: null };
  m = /^EUREKA_SETUP: OK(?: (.+))?$/.exec(last);
  if (m) return { form: 'ok', folder: m[1] ? m[1].trim() : null, step: null, reason: null };
  m = /^EUREKA_SETUP: FAIL (\S+)(?: (.*))?$/.exec(last);
  if (m) {
    const step = Object.prototype.hasOwnProperty.call(SETUP_STEP_TEXT, m[1]) ? m[1] : 'unknown';
    const reason = String(m[2] || '').replace(/[^\x20-\x7e]/g, '?').slice(0, SETUP_REASON_CAP);
    return { form: 'fail', folder: null, step, reason };
  }
  return { form: 'none', folder: null, step: null, reason: null };
}

function setupCardFacts(env, platform) {
  const win = platform === 'win32';
  const engineFolder = str(env.MINDRIAN_EUREKA_ROOT) || path.join(homeOf(env), '.mindrian', 'eureka-engine');
  const hub = requirements.engineWrites(env).find((p) => p.kind === 'huggingface');
  return {
    kind: 'engine_setup_grant',
    script: win ? SETUP_SCRIPT_WINDOWS : SETUP_SCRIPT_POSIX,
    commit: EUREKA_SETUP_COMMIT,
    hosts: SETUP_HOSTS.slice(),
    // CR-01 (395-11 review): every change of the approved script, named before the person says yes
    writes: win ? [
      engineFolder + ' (the engine and its Python packages)',
      (hub ? hub.path : 'the Hugging Face cache folder') + ' (the meaning model)',
      resolver.enginePointerPath(env) + ' (where MindrianOS finds the engine)',
      'one user setting, MINDRIAN_EUREKA_RS_MODEL_PATH, that tells the engine where the model is (an old value is replaced)',
      'the uv package cache (by default %LOCALAPPDATA%\\uv\\cache), and Python 3.12 managed by uv (by default %APPDATA%\\uv\\python) when this computer has none',
      'only when uv is missing: the uv installer from astral.sh puts uv in %USERPROFILE%\\.local\\bin and adds that folder to your user PATH',
    ] : [
      engineFolder + ' (the engine and its Python packages)',
      (hub ? hub.path : 'the Hugging Face cache folder') + ' (the meaning model)',
      resolver.enginePointerPath(env) + ' (where MindrianOS finds the engine)',
      '~/.bashrc and ~/.zshrc, when they exist: every line that holds MINDRIAN_EUREKA_RS_MODEL_PATH is deleted (also a line you wrote), then one line that sets it is added; a start file that is a link to another file can become a plain file',
      '~/.bashrc.bak and ~/.zshrc.bak: the setup puts a copy of each start file there and replaces a file you already have with that name. MindrianOS first keeps a copy of such a file as ' + SHELL_BACKUP_KEEP + '<date and time>',
      'the uv package cache (by default ~/.cache/uv), and Python 3.12 managed by uv (by default ~/.local/share/uv/python) when this computer has none',
      'only when uv is missing: the uv installer from astral.sh puts uv in ~/.local/bin and can add a line to your shell start files (such as ~/.profile, ~/.bashrc, ~/.zshrc) that puts it on PATH',
    ],
    disk: 'about 1.3 GB, most of it the Python packages (measured on a computer that already had uv and Python 3.12; more on a new computer)',
    time: 'about 1 to 10 minutes, depending on the connection',
    later: ENABLE + ' --setup',
    room_data: 'none',
    then_offline: true,
  };
}

function setupCardLines(card) {
  const lines = [
    'Set up the Eureka engine (optional)',
    'This one step gets the Eureka engine ready on this computer. MindrianOS works without it.',
    'You can skip it now and run it later with ' + card.later + '.',
    'It reaches these websites:',
  ];
  for (const h of card.hosts) lines.push('  ' + h);
  lines.push('On disk: ' + card.disk + '.');
  lines.push('Time: ' + card.time + '.');
  lines.push('It writes:');
  for (const w of card.writes) lines.push('  ' + w);
  lines.push('Nothing from your rooms is sent, and the Brain is not called. After setup the engine runs offline.');
  return lines;
}

function setupOutcome(env, deps, res) {
  const parsed = parseSetupLine(res.tail);
  if (parsed.form === 'ok' || parsed.form === 'ok_engine_only') {
    const folder = parsed.folder || str(env.MINDRIAN_EUREKA_ROOT) || path.join(homeOf(env), '.mindrian', 'eureka-engine');
    const head = parsed.form === 'ok'
      ? 'The Eureka setup finished. The engine folder is ' + folder + '.'
      : 'The Eureka setup finished. It did not find MindrianOS to connect to, so MindrianOS saves the engine folder now: ' + folder + '.';
    const saved = modePath({ path: folder, json: false }, env, deps);
    return { exitCode: saved.exitCode, stdout: head + '\n' + (saved.stdout || ''), stderr: saved.stderr || '' };
  }
  if (parsed.form === 'fail') {
    const text = SETUP_STEP_TEXT[parsed.step] || ['The setup stopped at a step that MindrianOS does not know.', ENABLE + ' --setup'];
    const why = text[0] + (parsed.reason ? ' The setup said: ' + parsed.reason : '');
    return { exitCode: 1, stdout: '', stderr: errorLines('The Eureka setup did not finish (step: ' + parsed.step + ').', why, text[1]).join('\n') + '\n' };
  }
  if (res.error === 'timeout') {
    const limit = deps && Number.isFinite(deps.timeoutMs) && deps.timeoutMs > 0 ? deps.timeoutMs : SETUP_TIMEOUT_MS;
    const took = limit >= 60000 ? Math.round(limit / 60000) + ' minutes' : Math.round(limit / 1000) + ' seconds';
    return { exitCode: 1, stdout: '', stderr: errorLines('The Eureka setup did not finish.', 'It ran longer than ' + took + ', so MindrianOS stopped it and every process that it started (error timeout).', 'Check the network or the proxy, then run ' + ENABLE + ' --setup again').join('\n') + '\n' };
  }
  const why = 'It stopped without its result line (' + (res.error ? 'error ' + res.error : 'exit ' + res.status) + ').';
  return { exitCode: 1, stdout: '', stderr: errorLines('The Eureka setup did not finish.', why, 'Read the setup output above for the cause, then run ' + ENABLE + ' --setup again').join('\n') + '\n' };
}

// Before the approved POSIX setup: for each start file that exists and has a .bak file, copy the .bak file to
// <name>.bak.mindrian-<UTC time>. A copy never replaces a file. A failed copy stops the setup before it runs.
function preserveShellBackups(env, platform, now) {
  const copies = [];
  if (platform === 'win32') return { ok: true, copies };
  const home = homeOf(env);
  if (!home) return { ok: true, copies };
  const stamp = (now instanceof Date ? now : new Date()).toISOString().replace(/[:.]/g, '-');
  const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch (_e) { return false; } };
  for (const name of SHELL_START_FILES) {
    const bak = path.join(home, name) + '.bak';
    if (!isFile(path.join(home, name)) || !isFile(bak)) continue;
    const keep = bak + '.mindrian-' + stamp;
    try { fs.copyFileSync(bak, keep, fs.constants.COPYFILE_EXCL); } catch (error) {
      return { ok: false, copies, path: bak, error: String(error && error.code || 'copy_failed') };
    }
    copies.push({ from: bak, to: keep });
  }
  return { ok: true, copies };
}

function modeSetup(o, env, deps) {
  if (o.approvedVia !== null && o.approvedVia !== 'cli' && o.approvedVia !== 'gate') {
    return { exitCode: 1, stdout: '', stderr: errorLines('The approval value is not allowed.', '--approved-via takes cli or gate.', ENABLE + ' --setup --approved-via cli').join('\n') + '\n' };
  }
  const platform = (deps && deps.platform) || process.platform;
  if (o.approvedVia === null) {
    const card = setupCardFacts(env, platform);
    const body = o.json ? JSON.stringify(card, null, 2) : setupCardLines(card).join('\n');
    return { exitCode: 2, stdout: body + '\n', stderr: 'Approval needed. Nothing was run. Show the card, then run again with --approved-via cli or gate.\n' };
  }
  const kept = preserveShellBackups(env, platform, deps && deps.now);
  if (!kept.ok) {
    return { exitCode: 1, stdout: '', stderr: errorLines('The Eureka setup did not start.', 'MindrianOS could not keep a copy of ' + kept.path + ' before the setup replaces it (' + kept.error + '). Nothing was run.', 'Move or copy ' + kept.path + ' yourself, then run ' + ENABLE + ' --setup again').join('\n') + '\n' };
  }
  const screen = (deps && deps.stream) || process.stdout;
  for (const c of kept.copies) {
    try { screen.write('MindrianOS kept a copy of ' + c.from + ' as ' + c.to + ' (the setup replaces ' + c.from + ').\n'); } catch (_e) { /* no screen */ }
  }
  return runEngineSetup(platform, Object.assign({}, deps, { env }))
    .then((res) => setupOutcome(env, deps, res))
    .catch((error) => ({ exitCode: 1, stdout: '', stderr: errorLines('The Eureka setup stopped.', 'An unexpected error: ' + String(error && error.code || 'error'), ENABLE + ' --check').join('\n') + '\n' }));
}

function run(argv, deps) {
  try {
    const o = parseArgs(argv);
    const env = envObject(deps);
    const d = deps && typeof deps === 'object' ? deps : {};
    if (o.help) return done(0, USAGE);
    if (o.error) return { exitCode: 1, stdout: '', stderr: errorLines(o.error, 'The command did not understand the flags.', ENABLE + ' --help').join('\n') + '\n' };
    if (o.forget) return modeForget(o, env);
    if (o.data) return modeData(o, env);
    if (o.path !== null) return modePath(o, env, d);
    if (o.setup) return modeSetup(o, env, d);
    if (o.sync) return modeSync(o, env, d);
    return modeCheck(o, env, d);
  } catch (error) {
    return { exitCode: 1, stdout: '', stderr: errorLines('The engine command stopped.', 'An unexpected error: ' + String(error && error.code || 'error'), ENABLE + ' --check').join('\n') + '\n' };
  }
}

function emit(result) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
  return result.exitCode;
}

// the approved setup returns a Promise; every other mode returns the result at once
function main(argv) {
  const result = run(argv, {});
  if (result && typeof result.then === 'function') return result.then(emit);
  return emit(result);
}

module.exports = { run, main, runEngineSync, runEngineDoctor, runEngineSetup, setupCommand, parseSetupLine, EUREKA_SETUP_COMMIT };

if (require.main === module) {
  main(process.argv.slice(2));
}
