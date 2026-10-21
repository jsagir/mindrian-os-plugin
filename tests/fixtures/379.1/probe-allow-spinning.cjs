#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 379.1 Wave 0 probe: does onnxruntime-node 1.30.0 honour session_options.extra (D-379.1-13,
 * research open question 1)?
 *
 * Three cases, each in its own child process so one session's thread pool never colours another's
 * idle measurement (the parent re-runs this file with --case <name>):
 *   nospin    session_options { intraOpNumThreads: 2, interOpNumThreads: 1,
 *                               extra: { session: { intra_op: { allow_spinning: '0' } } } }
 *   nonstring the same with allow_spinning as the number 0: the Node binding on main throws
 *             a TypeError whose message contains 'must be a string'
 *   default   session_options with the two thread counts only
 * Each case loads the pipeline the way embedding-spine does (same model, dtype and cache dir,
 * env.allowRemoteModels = false so nothing downloads), embeds two literal probe strings, then sleeps
 * 2,000 ms and records process.cpuUsage() over the sleep (idle_cpu_ms) and the thread count from
 * /proc/self/task on linux.
 * extra_honoured = thrown_on_non_string OR idle_cpu_ms_nospin <= idle_cpu_ms_default / 2.
 *
 * Canon Part 8: no room is read; the result file holds numbers, booleans and enum strings only.
 * No network. The probe lowers its own priority first. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const RESULT_PATH = path.join(__dirname, 'probe-allow-spinning.json');
const IDLE_MS = 2000;
const CASES = ['nospin', 'nonstring', 'default'];
const PROBE_TEXTS = ['a short probe sentence about cadence and budget', 'another probe sentence about harbour tides and cargo'];

function lowerPriority() {
  try {
    os.setPriority(0, process.platform === 'win32' ? os.constants.priority.PRIORITY_BELOW_NORMAL : 19);
  } catch (_e) { /* advisory */ }
}

function scrub(msg) {
  return String(msg || '').replace(/\/[^\s'"]+/g, '<path>').slice(0, 200);
}

function baseResult(status) {
  return {
    probe: 'allow-spinning',
    probed_at: new Date().toISOString(),
    node_version: process.version,
    host_cores: os.availableParallelism(),
    platform: process.platform,
    status: status,
    params: { idle_ms: IDLE_MS, intra_op_threads: 2, inter_op_threads: 1, cases: CASES },
  };
}

function writeResult(obj) {
  fs.writeFileSync(RESULT_PATH, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function readVersion(pkgDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')).version || null;
  } catch (_e) {
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sessionOptionsFor(name) {
  const base = { intraOpNumThreads: 2, interOpNumThreads: 1 };
  if (name === 'nospin') return Object.assign({}, base, { extra: { session: { intra_op: { allow_spinning: '0' } } } });
  if (name === 'nonstring') return Object.assign({}, base, { extra: { session: { intra_op: { allow_spinning: 0 } } } });
  return base;
}

/* Child: one case, prints one JSON line on stdout. */
async function runCase(name) {
  lowerPriority();
  const { requireEurekaDep } = require(path.join(ROOT, 'lib', 'core', 'eureka-deps-resolver.cjs'));
  const spine = require(path.join(ROOT, 'lib', 'core', 'semantic-index', 'embedding-spine.cjs'));
  const transformers = requireEurekaDep('@huggingface/transformers');
  if (!transformers) return { ok: false, reason: 'encoder_unavailable', detail: 'dependency not installed' };
  const { pipeline, env } = transformers;
  env.allowRemoteModels = false;
  env.cacheDir = spine._test.resolveCacheDir(env);
  const model = spine._test.resolveModel();
  const dtype = spine._test.resolveDtype();
  const t0 = Date.now();
  let pipe;
  try {
    pipe = await pipeline('feature-extraction', model, { dtype: dtype, session_options: sessionOptionsFor(name) });
  } catch (e) {
    return { ok: false, reason: 'thrown', thrown: true, message: scrub(e && e.message), error_name: (e && e.name) || null, model: model, dtype: dtype };
  }
  const load_ms = Date.now() - t0;
  const t1 = Date.now();
  const out = await pipe(PROBE_TEXTS, { pooling: 'mean', normalize: true });
  const embed_ms = Date.now() - t1;
  const dims = out && Array.isArray(out.dims) ? out.dims.slice() : null;
  const c0 = process.cpuUsage();
  await sleep(IDLE_MS);
  const c1 = process.cpuUsage(c0);
  const idle_cpu_ms = (c1.user + c1.system) / 1000;
  let threads = null;
  if (process.platform === 'linux') {
    try { threads = fs.readdirSync('/proc/self/task').length; } catch (_e) { threads = null; }
  }
  return { ok: true, thrown: false, load_ms: load_ms, embed_ms: embed_ms, dims: dims, idle_cpu_ms: idle_cpu_ms, threads: threads, model: model, dtype: dtype };
}

function runChild(name) {
  const r = spawnSync(process.execPath, [__filename, '--case', name], { encoding: 'utf8', env: process.env, timeout: 300000, maxBuffer: 16 * 1024 * 1024 });
  const lines = String(r.stdout || '').split('\n').map((l) => l.trim()).filter((l) => l[0] === '{');
  if (lines.length === 0) return { ok: false, reason: 'no_json', exit: r.status, detail: scrub(String(r.stderr || '').slice(-200)) };
  try { return JSON.parse(lines[lines.length - 1]); } catch (_e) { return { ok: false, reason: 'bad_json', exit: r.status }; }
}

function main() {
  lowerPriority();
  const { eurekaDepsRoot } = require(path.join(ROOT, 'lib', 'core', 'eureka-deps-resolver.cjs'));
  const depsRoot = eurekaDepsRoot();
  const out = baseResult('ok');
  out.ort_version = depsRoot ? readVersion(path.join(depsRoot, 'node_modules', 'onnxruntime-node')) : null;
  out.transformers_version = depsRoot ? readVersion(path.join(depsRoot, 'node_modules', '@huggingface', 'transformers')) : null;

  const results = {};
  for (const name of CASES) {
    process.stderr.write('probe-allow-spinning: case ' + name + '\n');
    results[name] = runChild(name);
  }
  const nospin = results.nospin;
  const nonstring = results.nonstring;
  const dflt = results.default;

  if (!nospin.ok && nospin.reason === 'encoder_unavailable') out.status = 'encoder_unavailable';
  else if (!nospin.ok && !dflt.ok) out.status = 'encoder_unavailable';

  out.model = (dflt && dflt.model) || (nospin && nospin.model) || null;
  out.dtype = (dflt && dflt.dtype) || (nospin && nospin.dtype) || null;
  out.thrown_on_non_string = nonstring.thrown === true && /must be a string/i.test(nonstring.message || '');
  out.non_string_thrown_at_all = nonstring.thrown === true;
  out.non_string_message = nonstring.thrown === true ? nonstring.message : null;
  out.non_string_error_name = nonstring.thrown === true ? nonstring.error_name : null;
  out.idle_cpu_ms_default = dflt.ok ? dflt.idle_cpu_ms : null;
  out.idle_cpu_ms_nospin = nospin.ok ? nospin.idle_cpu_ms : null;
  out.load_ms_default = dflt.ok ? dflt.load_ms : null;
  out.load_ms_nospin = nospin.ok ? nospin.load_ms : null;
  out.embed_ms_default = dflt.ok ? dflt.embed_ms : null;
  out.embed_ms_nospin = nospin.ok ? nospin.embed_ms : null;
  out.threads_after_load = dflt.ok ? dflt.threads : null;
  out.threads_after_load_nospin = nospin.ok ? nospin.threads : null;
  out.nospin_load_ok = nospin.ok === true;
  out.default_load_ok = dflt.ok === true;
  const idleHalved = typeof out.idle_cpu_ms_nospin === 'number' && typeof out.idle_cpu_ms_default === 'number'
    && out.idle_cpu_ms_nospin <= out.idle_cpu_ms_default / 2;
  out.idle_halved = idleHalved;
  out.extra_honoured = out.thrown_on_non_string === true || idleHalved === true;
  writeResult(out);
  process.stderr.write('probe-allow-spinning: extra_honoured ' + out.extra_honoured + ' (thrown_on_non_string ' + out.thrown_on_non_string + ', idle default ' + out.idle_cpu_ms_default + ' ms, nospin ' + out.idle_cpu_ms_nospin + ' ms)\n');
}

if (require.main === module) {
  const idx = process.argv.indexOf('--case');
  if (idx !== -1) {
    runCase(process.argv[idx + 1]).then((r) => {
      process.stdout.write(JSON.stringify(r) + '\n');
      process.exit(0);
    }).catch((e) => {
      process.stdout.write(JSON.stringify({ ok: false, reason: 'child_error', message: scrub(e && e.message) }) + '\n');
      process.exit(0);
    });
  } else {
    try {
      main();
      process.exit(0);
    } catch (e) {
      const out = baseResult('error');
      out.error = scrub(e && e.message);
      out.extra_honoured = false;
      try { writeResult(out); } catch (_e) { /* nothing more to do */ }
      process.stderr.write('probe-allow-spinning: error ' + out.error + '\n');
      process.exit(1);
    }
  }
}

module.exports = { sessionOptionsFor, CASES, IDLE_MS };
