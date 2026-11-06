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
 * Flags: --check (default), --path DIR, --forget, --data, --sync, --extras LIST, --approved-via cli|gate,
 * --deep, --json, --help.
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
 * Part 8: this module opens no network connection and no Brain connection. The only network step is the
 * uv sync child behind --approved-via; it passes --locked and --no-python-downloads (no Python fetch from
 * github.com) and only the known extras. Check, path, forget and data spawn only what checkEngine spawns
 * (uv --version, uv python find, node --version) and no engine code. The engine doctor runs offline.
 * The child environment is an allowlist: no CLAUDE_ or MINDRIAN_ variable reaches a child.
 *
 * The command installs nothing except through the approved sync. It never installs uv, Python, Node or a
 * model, and it never deletes the engine data, cache or environment folders (--forget removes the saved
 * setting only).
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

const USAGE = [
  'Usage: ' + ENABLE + ' [flags]',
  '  --check                 report whether the engine is set up (default)',
  '  --path DIR              save an engine folder you already have (absolute path)',
  '  --forget                remove the saved setting (data, cache and environment stay)',
  '  --data                  list what the engine writes, with sizes (deletes nothing)',
  '  --sync                  prepare the Python packages (the one network step; needs approval)',
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
  const o = { check: false, path: null, forget: false, data: false, sync: false, extras: null, approvedVia: null, deep: false, json: false, help: false, error: null };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    switch (a) {
      case '--check': o.check = true; break;
      case '--forget': o.forget = true; break;
      case '--data': o.data = true; break;
      case '--sync': o.sync = true; break;
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
    '2 Model folder (you place it; the engine never downloads one): ' + model,
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
    facts.fix = d.fix;
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
  lines.push('Setup has three parts. This command prepares only part 1, and only when you approve it.');
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
    if (o.sync) return modeSync(o, env, d);
    return modeCheck(o, env, d);
  } catch (error) {
    return { exitCode: 1, stdout: '', stderr: errorLines('The engine command stopped.', 'An unexpected error: ' + String(error && error.code || 'error'), ENABLE + ' --check').join('\n') + '\n' };
  }
}

function main(argv) {
  const result = run(argv, {});
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
  return result.exitCode;
}

module.exports = { run, main, runEngineSync, runEngineDoctor };

if (require.main === module) {
  main(process.argv.slice(2));
}
