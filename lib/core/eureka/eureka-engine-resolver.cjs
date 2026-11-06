'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 387 plan 03 -- the Eureka engine resolver.
 *
 * WHAT: the ONE place that decides where the Eureka engine checkout is, and what to say when it is
 * not there. Seven functions and one frozen cause table:
 *   resolveEngine(env)          -> { state, source, root, cause, reason }
 *   describeEngineState(input)  -> { state, cause, reason, sentence, fix }
 *   reasonForCause(cause)       -> the typed reason for a cause
 *   enginePointerPath(env)      -> the path of the saved setting file
 *   readPointer(env), writePointer(root, env), clearPointer(env)
 *   ENGINE_CAUSES               -> frozen table of the 13 cause names
 *
 * WHERE THE ENGINE IS, in order:
 *   1. env.MINDRIAN_EUREKA_ROOT (a non-empty string), source "env"
 *   2. the saved setting file HOME/.mindrian/eureka-engine.json, source "pointer"
 *   3. the default folder HOME/.mindrian/eureka-engine when it exists, source "default"
 *   4. nothing: state "absent", reason engine_not_configured
 * A root that is found must be an existing folder that holds pyproject.toml (the same two-step
 * check the four older call sites make). No project-name check, no spawn and no environment probe
 * happens here: the per-call gate stays cheap. The deeper check is in eureka-engine-requirements.cjs.
 *
 * WHICH ENGINE: the engine is the NEW mindrian-eureka project (origin jsagir/mindrian-eureka). The
 * resolver searches only the three places above. It never looks in any other folder, so an older
 * plugin-style Eureka checkout is never discovered; a folder without the engine pyproject.toml is
 * refused as engine_checkout_unavailable.
 *
 * WHY: the engine path used to come only from one shell variable that nothing in the shipped files
 * sets (Plan 387-01 RCA). A saved setting works on CLI and Desktop alike and survives plugin
 * updates, which delete the versioned plugin cache folder.
 *
 * Part 7 (reuse before build): the home resolution chain is the one in lib/core/eureka-deps-resolver.cjs
 * (HOME, then USERPROFILE), reduced to read the env object that is passed in. The temp-then-rename
 * write is the idiom of atomicWriteJson in lib/core/research-planner/planner.cjs (private there,
 * copied in six lines here). lib/core/eureka/eureka-enable.cjs and eureka-deps-resolver.cjs handle the
 * encoder install and are not touched.
 *
 * Part 8: local filesystem only. No network, no Brain, no room text. The sentences are fixed ASCII
 * text and hold no absolute path and no engine output.
 *
 * TEST SEAM: every function takes the env object. When it holds neither HOME nor USERPROFILE the
 * saved setting and the default folder are skipped, so a test with a synthetic environment never
 * reads the real home.
 *
 * Every export degrades to a documented default and never throws across the boundary.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ENGINE_CAUSES = Object.freeze({
  checkout_missing: 'checkout_missing',
  pyproject_missing: 'pyproject_missing',
  pointer_unreadable: 'pointer_unreadable',
  project_name_mismatch: 'project_name_mismatch',
  uv_missing: 'uv_missing',
  python_missing: 'python_missing',
  env_not_synced: 'env_not_synced',
  lock_stale: 'lock_stale',
  extra_missing: 'extra_missing',
  model_missing: 'model_missing',
  node_missing: 'node_missing',
  node_too_old: 'node_too_old',
  engine_start_failed: 'engine_start_failed',
});

const REASON_BY_CAUSE = Object.freeze({
  checkout_missing: 'engine_checkout_unavailable',
  pyproject_missing: 'engine_checkout_unavailable',
  pointer_unreadable: 'engine_checkout_unavailable',
  project_name_mismatch: 'engine_checkout_unavailable',
  extra_missing: 'engine_extra_missing',
  model_missing: 'engine_model_missing',
  node_missing: 'engine_node_missing',
  node_too_old: 'engine_node_missing',
  uv_missing: 'engine_unavailable',
  python_missing: 'engine_unavailable',
  env_not_synced: 'engine_unavailable',
  lock_stale: 'engine_unavailable',
  engine_start_failed: 'engine_unavailable',
});

const POINTER_FILE = 'eureka-engine.json';
const DEFAULT_FOLDER = 'eureka-engine';

function envObject(env) {
  if (env === undefined) return process.env;
  return env && typeof env === 'object' ? env : {};
}

function homeOf(env) {
  const e = envObject(env);
  for (const key of ['HOME', 'USERPROFILE']) {
    if (typeof e[key] === 'string' && e[key].trim()) return e[key];
  }
  return null;
}

function enginePointerPath(env) {
  const home = homeOf(env);
  return home ? path.join(home, '.mindrian', POINTER_FILE) : null;
}

function readPointer(env) {
  const file = enginePointerPath(env);
  if (!file) return { ok: false, error: 'no_home' };
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch (error) {
    return { ok: false, error: error && error.code === 'ENOENT' ? 'not_found' : 'unreadable' };
  }
  let parsed;
  try { parsed = JSON.parse(raw); } catch (_error) { return { ok: false, error: 'unreadable' }; }
  if (!parsed || typeof parsed !== 'object' || typeof parsed.root !== 'string' || !parsed.root.trim()) {
    return { ok: false, error: 'unreadable' };
  }
  return { ok: true, root: parsed.root };
}

function writePointer(root, env) {
  try {
    const file = enginePointerPath(env);
    if (!file) return { ok: false, error: 'no_home' };
    if (typeof root !== 'string' || !root.trim() || root.indexOf('\u0000') !== -1) return { ok: false, error: 'bad_root' };
    const dir = path.dirname(file);
    fs.mkdirSync(dir, { recursive: true });
    const body = JSON.stringify({ schema: 1, root: path.resolve(root), set_at: new Date().toISOString(), source: 'adopted' }, null, 2) + '\n';
    // temp-then-rename write (atomicWriteJson idiom of lib/core/research-planner/planner.cjs)
    const tmp = path.join(dir, '.' + POINTER_FILE + '.' + process.pid + '.' + crypto.randomBytes(3).toString('hex') + '.tmp');
    try {
      fs.writeFileSync(tmp, body, { mode: 0o600 });
      fs.renameSync(tmp, file);
    } catch (error) {
      try { fs.unlinkSync(tmp); } catch (_e) { /* the temp file may not exist */ }
      throw error;
    }
    return { ok: true, path: file };
  } catch (error) {
    return { ok: false, error: String(error && error.code || 'write_failed') };
  }
}

function clearPointer(env) {
  try {
    const file = enginePointerPath(env);
    if (!file) return { ok: false, removed: false, error: 'no_home' };
    try { fs.unlinkSync(file); } catch (error) {
      if (error && error.code === 'ENOENT') return { ok: true, removed: false };
      throw error;
    }
    return { ok: true, removed: true };
  } catch (error) {
    return { ok: false, removed: false, error: String(error && error.code || 'remove_failed') };
  }
}

function isDirectory(p) {
  try { return fs.statSync(p).isDirectory(); } catch (_error) { return false; }
}

function isFile(p) {
  try { return fs.statSync(p).isFile(); } catch (_error) { return false; }
}

function checkRoot(source, rawRoot) {
  let root;
  try { root = path.resolve(rawRoot); } catch (_error) {
    return { state: 'broken', source, root: null, cause: 'checkout_missing', reason: REASON_BY_CAUSE.checkout_missing };
  }
  if (rawRoot.indexOf('\u0000') !== -1 || !isDirectory(root)) {
    return { state: 'broken', source, root, cause: 'checkout_missing', reason: REASON_BY_CAUSE.checkout_missing };
  }
  if (!isFile(path.join(root, 'pyproject.toml'))) {
    return { state: 'broken', source, root, cause: 'pyproject_missing', reason: REASON_BY_CAUSE.pyproject_missing };
  }
  return { state: 'present', source, root, cause: null, reason: null };
}

function resolveEngine(env) {
  try {
    const e = envObject(env);
    const override = e.MINDRIAN_EUREKA_ROOT;
    if (typeof override === 'string' && override.trim()) return checkRoot('env', override);
    const home = homeOf(e);
    if (home) {
      const pointerFile = path.join(home, '.mindrian', POINTER_FILE);
      let pointerExists = false;
      try { fs.statSync(pointerFile); pointerExists = true; } catch (_error) { pointerExists = false; }
      if (pointerExists) {
        const pointer = readPointer(e);
        if (!pointer.ok) {
          return { state: 'broken', source: 'pointer', root: null, cause: 'pointer_unreadable', reason: REASON_BY_CAUSE.pointer_unreadable };
        }
        return checkRoot('pointer', pointer.root);
      }
      const def = path.join(home, '.mindrian', DEFAULT_FOLDER);
      if (isDirectory(def)) return checkRoot('default', def);
    }
    return { state: 'absent', source: null, root: null, cause: null, reason: 'engine_not_configured' };
  } catch (_error) {
    return { state: 'absent', source: null, root: null, cause: null, reason: 'engine_not_configured' };
  }
}

function reasonForCause(cause) {
  if (cause === null || cause === undefined) return 'engine_not_configured';
  return Object.prototype.hasOwnProperty.call(REASON_BY_CAUSE, cause) ? REASON_BY_CAUSE[cause] : 'engine_unavailable';
}

const ENABLE_PATH_FIX = '/mos:eureka enable engine --path <folder>';
const CHECK = '/mos:eureka enable engine --check';

const SENTENCES = Object.freeze({
  absent: 'The Eureka engine is not set up on this machine.',
  present: 'The Eureka engine is set up.',
  checkout_missing: 'The saved Eureka engine folder is missing.',
  pyproject_missing: 'The Eureka engine folder has no pyproject.toml, so it is not an engine checkout.',
  pointer_unreadable: 'The saved Eureka engine setting cannot be read.',
  project_name_mismatch: 'The folder is not the Mindrian Eureka engine. Its project name is not mindrian-eureka.',
  uv_missing: 'The tool uv is not installed or is not on the PATH, so the engine cannot start.',
  python_missing: 'No Python that meets the engine requirement was found.',
  env_not_synced: 'The engine folder has no prepared Python environment yet.',
  lock_stale: 'The engine uv.lock does not match its pyproject.toml, so the offline start was refused.',
  model_missing: 'No local embedding model was found. The engine never downloads one.',
  node_missing: 'Node.js was not found on the PATH. Some Eureka workers need Node.js 22 or newer.',
  node_too_old: 'Node.js is older than version 22. Some Eureka workers need Node.js 22 or newer.',
  engine_start_failed: 'The engine did not start.',
});

const FIXES = Object.freeze({
  absent: ENABLE_PATH_FIX,
  present: '',
  checkout_missing: ENABLE_PATH_FIX,
  pyproject_missing: ENABLE_PATH_FIX,
  pointer_unreadable: ENABLE_PATH_FIX,
  project_name_mismatch: ENABLE_PATH_FIX,
  uv_missing: 'Install uv (https://docs.astral.sh/uv/getting-started/installation/), then run ' + CHECK,
  python_missing: 'Install a Python that meets the engine requirement, then run ' + CHECK,
  env_not_synced: '/mos:eureka enable engine --sync',
  lock_stale: 'Update the engine checkout, then run /mos:eureka enable engine --sync',
  model_missing: "Put a model folder on this machine and set MINDRIAN_EUREKA_RS_MODEL_PATH to it (the engine's docs/offline-install.md explains how), then run " + CHECK,
  node_missing: 'Install Node.js 22 or newer, then run ' + CHECK,
  node_too_old: 'Install Node.js 22 or newer, then run ' + CHECK,
  engine_start_failed: CHECK + ' --deep',
});

function extraNames(detail) {
  const list = detail && Array.isArray(detail.extras) ? detail.extras.filter((x) => typeof x === 'string' && /^[a-z][a-z0-9-]*$/.test(x)) : [];
  return list;
}

function describeEngineState(input) {
  const i = input && typeof input === 'object' ? input : {};
  const state = i.state === 'present' || i.state === 'broken' ? i.state : 'absent';
  const cause = typeof i.cause === 'string' ? i.cause : null;
  let key;
  if (state === 'present') key = 'present';
  else if (state === 'absent' && !cause) key = 'absent';
  else if (cause === 'extra_missing') key = 'extra_missing';
  else key = Object.prototype.hasOwnProperty.call(SENTENCES, cause) ? cause : 'engine_start_failed';
  let sentence;
  let fix;
  if (key === 'extra_missing') {
    const names = extraNames(i.detail);
    sentence = 'The engine package group ' + (names.length ? names.join(', ') : 'it needs') + ' is not installed.';
    fix = '/mos:eureka enable engine --sync' + (names.length ? ' --extras ' + names.join(',') : '');
  } else {
    sentence = SENTENCES[key];
    fix = FIXES[key];
  }
  const reason = state === 'present' ? null : reasonForCause(key === 'absent' ? null : key);
  return { state, cause: key === 'absent' || key === 'present' ? null : key, reason, sentence, fix };
}

module.exports = {
  ENGINE_CAUSES,
  resolveEngine,
  describeEngineState,
  reasonForCause,
  enginePointerPath,
  readPointer,
  writePointer,
  clearPointer,
};
