'use strict';

/**
 * quick(260706-13z) D14 -- Class S Eureka smoke.
 * A 5-layer composable probe of the LOCAL eureka embedding stack, the class-M
 * (Brain smoke) sibling. It answers one question on any machine in ~20s: is the
 * eureka stack ready, and if not, at which layer does it stop.
 *
 * "Class S" rationale: doctor.cjs assigns A-R (A-M install/brain, N
 * plugin-enabled, O agentshield, P/Q drift, R runtime-reachability). S is the
 * next free letter. If S is taken by execution time, take the next free letter
 * and note it here (the class-M module documents this exact precedent, K-taken).
 *
 * The D14 distribution gap (SEED-049 lines 383-393): npm install does NOT fetch
 * model weights; the tens-of-MB ONNX download happens lazily on the FIRST real
 * embedding call and today looks like a silent hang. This probe reports the
 * exact cache/degrade state WITHOUT ever triggering a download (unless the
 * operator opts in), so an offline / airgapped machine gets a graceful
 * PASS-with-reason, never a throw and never a surprise fetch inside a release gate.
 *
 * DELIBERATE DIVERGENCE FROM CLASS M: the layers are NON-cascading. Brain smoke
 * fail-fasts (a dead layer 1 makes 2-5 meaningless). Here an offline machine
 * with no deps must STILL prove layer 4 (graceful degrade), so every layer runs
 * regardless of earlier failures. Overall ok = L1 && L2 && L3 && L4 (L3.ok
 * already encodes "did not hang and did not throw"); L5 is ADVISORY and is
 * NEVER included in the overall verdict (Phase 341 Plan 03, D-10/D-11 -- see
 * below), but is always reported.
 *
 * Layers:
 *   L1 deps_present    sqlite-vec package.json under node_modules; reason
 *                      reports its version. CAPABILITY ONLY as of Phase 341
 *                      Plan 03: the heavy @huggingface/transformers probe
 *                      moved to L5 (advisory), since a slim shipped install
 *                      is expected to lack it by design (D-11).
 *   L2 vec_backend     in-memory allowExtension handle -> adapter ensureStore;
 *                      ok EITHER way (sqlite-vec or cjs-fallback), ok:false only
 *                      if both paths throw.
 *   L3 model_probe     cache HIT -> real embed under timeout, assert dim; cache
 *                      MISS -> ok:true WITHOUT downloading (unless allow-download);
 *                      encoder_unavailable -> ok:true (the graceful path IS the
 *                      contract). ONLY a hang-past-timeout or a throw is ok:false.
 *   L4 graceful_degrade  _forceUnavailable embed resolves the encoder_unavailable
 *                        envelope with no throw.
 *   L5 model_installed  ADVISORY (Phase 341 Plan 03, D-11): is the embedding
 *                       model package actually installed, resolved through
 *                       lib/core/eureka-deps-resolver.cjs -- the SAME authority
 *                       the runtime (embedding-spine.cjs) and the installer
 *                       (/mos:eureka enable) use, so this layer can never say
 *                       "not installed" right after a successful enable. Never
 *                       fails the tier (D-10 forbids making capability
 *                       conditional on the model) but is always REPORTED, so
 *                       a passing gate never hides "model not installed."
 *
 * Canon Part 7 (reuse): L2 reuses vector-store.cjs::ensureStore (no second
 *   loader); L3 reuses embedding-spine's resolveModel/resolveDim/isModelCached/
 *   getEncoder/embedTexts; L5 reuses eureka-deps-resolver.cjs::eurekaDepInstalled
 *   (no second probe of the side directory / plugin node_modules). Only the
 *   layer orchestration is net-new.
 * Canon Part 8 (graph boundary): the probe embeds at most one throwaway string
 *   ('probe') on a cache HIT; zero user content, zero network beyond the model
 *   fetch it explicitly refuses to trigger.
 *
 * HARD RULE: no em-dashes anywhere in this file.
 */

const path = require('node:path');
const fs = require('node:fs');

// Layer registry. Wire-locked: the test harness asserts id strings + order.
const LAYERS = Object.freeze([
  Object.freeze({ id: 'deps_present',     name: 'L1 eureka-deps-present' }),
  Object.freeze({ id: 'vec_backend',      name: 'L2 vector-store-backend' }),
  Object.freeze({ id: 'model_probe',      name: 'L3 model-cache-probe' }),
  Object.freeze({ id: 'graceful_degrade', name: 'L4 graceful-degrade' }),
  // Phase 341 Plan 03 (D-11): APPENDED, not inserted -- the harness pins the
  // first four ids AND their order, so appending is the only change that
  // keeps every existing index stable. Advisory; see checkEurekaSmoke below.
  Object.freeze({ id: 'model_installed',  name: 'L5 embedding-model-installed' }),
]);

const PROBE_TIMEOUT_MS = Number(process.env.MINDRIAN_EUREKA_SMOKE_TIMEOUT_MS) || 20000;
const OVERALL_BUDGET_MS = 30000;

function _now() { return Date.now(); }

// Plugin root: this module lives at lib/core/doctor/, so the root (where
// node_modules lives) is three levels up. Same walk class-m uses for the shim.
function _pluginRoot() {
  return path.resolve(__dirname, '..', '..', '..');
}

async function _runLayer(fn) {
  const t0 = _now();
  try {
    const r = await fn();
    return { ok: !!r.ok, reason: r.reason || (r.ok ? 'pass' : 'fail'), ms: _now() - t0, advisory: !!r.advisory };
  } catch (e) {
    return { ok: false, reason: 'exception: ' + (e && e.message ? e.message : String(e)), ms: _now() - t0, advisory: false };
  }
}

// L1 -- deps_present. CAPABILITY REACHABLE ONLY as of Phase 341 Plan 03
// (D-11): reads the sqlite-vec package.json from disk (the package restricts
// `exports`, so require('<pkg>/package.json') throws; fs.readFileSync is the
// correct probe). sqlite-vec stays a real hard dependency after the 341-04
// packaging cut, so this layer stays a legitimate blocker. The heavy
// @huggingface/transformers probe moved to L5 (advisory, model_installed) --
// this layer must never probe it again.
async function _layer1(opts) {
  if (opts.mockL1) return opts.mockL1();
  const root = opts.pluginRoot || _pluginRoot();
  const specs = [
    ['sqlite-vec', path.join(root, 'node_modules', 'sqlite-vec', 'package.json')],
  ];
  const versions = [];
  for (let i = 0; i < specs.length; i += 1) {
    const name = specs[i][0];
    const pj = specs[i][1];
    if (!fs.existsSync(pj)) {
      return { ok: false, reason: name + ' not installed under node_modules (npm install to fetch it)' };
    }
    let ver = 'unknown';
    try { ver = JSON.parse(fs.readFileSync(pj, 'utf8')).version || 'unknown'; } catch (_e) { /* keep unknown */ }
    versions.push(name + ' ' + ver);
  }
  return { ok: true, reason: versions.join(', ') };
}

// L2 -- vec_backend. Opens an in-memory allowExtension handle and runs the D1
// adapter's ensureStore (Part 7: the ONE loader). ok EITHER backend; ok:false
// only if the adapter cannot create any vector store at all.
async function _layer2(opts) {
  if (opts.mockL2) return opts.mockL2();
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require('node:sqlite'));
  } catch (e) {
    return { ok: false, reason: 'node:sqlite unavailable: ' + (e && e.message) };
  }
  let db;
  try {
    db = new DatabaseSync(':memory:', { allowExtension: true });
  } catch (e) {
    // Some builds reject the option object; retry plain (forces cjs-fallback).
    try { db = new DatabaseSync(':memory:'); } catch (e2) {
      return { ok: false, reason: 'cannot open in-memory sqlite: ' + (e2 && e2.message) };
    }
  }
  try {
    const vec = require('../eureka/vector-store.cjs');
    const store = vec.ensureStore(db, 8);
    if (store.backend === 'sqlite-vec') {
      let ver = 'unknown';
      try { ver = (db.prepare('SELECT vec_version() AS v').get() || {}).v || 'unknown'; } catch (_e) { /* keep */ }
      return { ok: true, reason: 'sqlite-vec ' + ver + ' (primary leg live)' };
    }
    return { ok: true, reason: 'cjs-cosine fallback (sqlite-vec extension not loadable on this handle/platform)' };
  } catch (e) {
    return { ok: false, reason: 'ensureStore threw on both backends: ' + (e && e.message) };
  } finally {
    try { db.close(); } catch (_e) { /* ignore */ }
  }
}

function _withTimeout(promise, ms, label) {
  let t;
  const timeout = new Promise(function (_res, rej) {
    t = setTimeout(function () { rej(new Error(label + ' timed out after ' + ms + 'ms')); }, ms);
  });
  return Promise.race([
    Promise.resolve(promise).then(function (v) { clearTimeout(t); return v; },
      function (e) { clearTimeout(t); throw e; }),
    timeout,
  ]);
}

// L3 -- model_probe. Resolves the model + cache dir and reports the cache state
// WITHOUT downloading. Cache HIT (or allow-download opt-in): a real embed under
// a timebox, asserting the dim. Cache MISS: ok:true, download deferred to first
// real call. encoder_unavailable: ok:true (graceful degrade is the contract).
// Only a hang-past-timeout or a thrown error is ok:false.
async function _layer3(opts) {
  if (opts.mockL3) return opts.mockL3();
  let spine;
  try {
    spine = require('../eureka/embedding-spine.cjs');
  } catch (e) {
    return { ok: false, reason: 'embedding-spine unloadable: ' + (e && e.message) };
  }
  const model = spine._test.resolveModel();
  const expectedDim = spine._test.resolveDim();
  const dtype = spine._test.resolveDtype();

  // Resolve the cache dir via the transformers env (may be absent when deps
  // failed to install). Unknown cacheDir is treated as a hit by isModelCached,
  // so we resolve it defensively.
  let cacheDir = null;
  try {
    const transformers = require('@huggingface/transformers');
    cacheDir = spine._test.resolveCacheDir(transformers && transformers.env);
  } catch (_e) {
    cacheDir = spine._test.resolveCacheDir(null);
  }
  // Phase 341 Plan 03 fix (the live Pitfall 6 defect): isModelCached became
  // `async` in Phase 272-08 and this call site was never threaded with
  // `await`, so `cached` was always a truthy Promise object -- the
  // cache-miss branch below (:184-190) was unreachable and L3 performed a
  // REAL embed (a real network model download on a cold cache) inside every
  // release gate run. Awaited now, and passed the SAME dtype getEncoder
  // resolves below, not a guess.
  const cached = await spine._test.isModelCached(model, cacheDir, dtype);
  const allowDownload = process.env.MINDRIAN_EUREKA_SMOKE_ALLOW_DOWNLOAD === '1';
  const where = cacheDir || '(unknown cache dir)';

  if (!cached && !allowDownload) {
    return {
      ok: true,
      reason: 'cache miss at ' + where + '; model ' + model
        + ' downloads on first real embedding call (one-time). Set MINDRIAN_EUREKA_SMOKE_ALLOW_DOWNLOAD=1 to force it now.',
    };
  }

  // Cache hit (or forced): a real, timeboxed embed.
  try {
    const enc = await _withTimeout(spine.getEncoder({}), PROBE_TIMEOUT_MS, 'getEncoder');
    if (!enc || !enc.success) {
      return {
        ok: true,
        reason: 'encoder unavailable at ' + where + ' (graceful degrade): '
          + ((enc && enc.detail) || 'no detail'),
      };
    }
    const out = await _withTimeout(spine.embedTexts(['probe'], {}), PROBE_TIMEOUT_MS, 'embedTexts');
    if (!out || !out.success) {
      return { ok: true, reason: 'embed degraded gracefully: ' + ((out && out.error) || 'unknown') };
    }
    const dim = out.vectors && out.vectors[0] ? out.vectors[0].length : 0;
    if (dim !== expectedDim) {
      return { ok: false, reason: 'dim mismatch: embedded ' + dim + ' but resolveDim() is ' + expectedDim };
    }
    return { ok: true, reason: 'cache hit at ' + where + ', model ' + model + ', dim ' + dim };
  } catch (e) {
    // A timeout or a hard throw is the ONE ok:false path (a silent hang caught).
    return { ok: false, reason: (e && e.message) || 'model probe threw' };
  }
}

// L4 -- graceful_degrade. The _forceUnavailable seam must resolve the
// encoder_unavailable envelope with NO throw. This is the Tier-0 contract that
// keeps eureka safe on a machine where the model can never load.
async function _layer4(opts) {
  if (opts.mockL4) return opts.mockL4();
  let spine;
  try {
    spine = require('../eureka/embedding-spine.cjs');
  } catch (e) {
    return { ok: false, reason: 'embedding-spine unloadable: ' + (e && e.message) };
  }
  const r = await spine.embedTexts(['x'], { _forceUnavailable: true });
  if (r && r.success === false && r.error === 'encoder_unavailable') {
    return { ok: true, reason: 'degrades to encoder_unavailable without throwing' };
  }
  return { ok: false, reason: 'expected encoder_unavailable envelope, got ' + JSON.stringify(r) };
}

// L5 -- model_installed. ADVISORY (Phase 341 Plan 03, D-11): "capability
// reachable" (L1-L4, blocker) is a different question from "is the model
// installed" (this layer, advisory). Resolves through the ONE authority
// (lib/core/eureka-deps-resolver.cjs::eurekaDepInstalled) the runtime
// (embedding-spine.cjs) and the installer (/mos:eureka enable) also use --
// this layer does NOT re-implement the side-directory-first, plugin-fallback
// probe. Never throws, never downloads, never touches the network. D-10:
// capability is never conditional on the model, so checkEurekaSmoke below
// excludes this layer's ok:false from the overall verdict, but it is always
// reported in full (never a silent no-op, T-341-14).
async function _layer5(opts) {
  if (opts.mockL5) return opts.mockL5();
  const { eurekaDepInstalled } = require('../eureka-deps-resolver.cjs');
  const probe = eurekaDepInstalled('@huggingface/transformers');
  if (probe.installed) {
    return {
      ok: true,
      advisory: true,
      reason: 'embedding model stack installed at ' + probe.dir + ' (' + probe.where + ')',
    };
  }
  return {
    ok: false,
    advisory: true,
    reason: 'Eureka is reachable; the local model is not installed yet - run /mos:eureka enable (one-time, about 380 MB)',
  };
}

/**
 * Run the 4-layer eureka smoke probe. NON-cascading: every layer runs even if an
 * earlier one failed (an offline machine must still prove L4).
 *
 * @param {{
 *   mockL1?: function, mockL2?: function, mockL3?: function, mockL4?: function,
 *   pluginRoot?: string,
 * }} [opts]
 * @returns {Promise<{ok:boolean, layers:Array<{id,name,ok,reason,ms}>, overall_ms:number}>}
 */
async function checkEurekaSmoke(opts) {
  const o = opts || {};
  const t0 = _now();
  const out = { ok: true, layers: [], overall_ms: 0 };
  const layerFns = [_layer1, _layer2, _layer3, _layer4, _layer5];
  for (let i = 0; i < LAYERS.length; i += 1) {
    const meta = LAYERS[i];
    // NON-cascading: run regardless of prior results.
    // eslint-disable-next-line no-await-in-loop
    const r = await _runLayer(function () { return layerFns[i](o); });
    out.layers.push({ id: meta.id, name: meta.name, ok: r.ok, reason: r.reason, ms: r.ms, advisory: r.advisory });
  }
  // Overall ok = L1 && L2 && L3 && L4 (each already blocker-shaped; L3.ok
  // already encodes the hang/throw rule). L5 (model_installed) is ADVISORY
  // (Phase 341 Plan 03, D-10/D-11): an advisory ok:false is reported in full
  // and NEVER fails the tier, because D-10 forbids making capability
  // conditional on the model -- only its `advisory` flag is excluded from
  // this reduction, its `reason` still travels on the pushed layer object
  // above so the JSON payload always shows it.
  out.ok = out.layers.every(function (l) { return l.advisory === true ? true : l.ok; });
  out.overall_ms = _now() - t0;
  if (out.overall_ms > OVERALL_BUDGET_MS) {
    out.ok = false;
    out.layers.push({
      id: 'budget', name: 'overall-budget', ok: false,
      reason: 'overall_ms ' + out.overall_ms + ' > ' + OVERALL_BUDGET_MS, ms: 0,
    });
  }
  return out;
}

/**
 * Phase 341 Plan 02 (D-09): `doctor --fix eureka` is now real. It runs the
 * SAME install as `/mos:eureka enable` by spawning the eureka dispatcher's
 * `enable` subcommand as a subprocess (the statusline-visibility-module.cjs
 * `fix()` idiom: never install inline, spawn a dedicated, separately
 * testable script and report the exit code with stdout/stderr sliced to
 * 500 characters), never a shell string, `input:''` closing stdin so a
 * prompt can never hang the call.
 *
 * Idempotent by construction: `enableEureka` (inside the spawned
 * subprocess) probes `eurekaDepInstalled` before installing, so a
 * `doctor --fix --all` run on an already-enabled machine spawns, probes,
 * and returns without a download.
 *
 * Does NOT touch LAYERS, checkEurekaSmoke, or _layer1 through _layer4 --
 * that surgery is plan 341-03's exclusive scope, deliberately kept out of
 * this commit so the Class S layer count stays at 4 between plans.
 *
 * @param {object} _result  the checkEurekaSmoke result (unused)
 * @returns {{fixed: boolean, reason: string}}
 */
function fixEurekaSmoke(_result) {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || _pluginRoot();
  const dispatcher = path.join(pluginRoot, 'scripts', 'eureka-command.cjs');
  const r = require('node:child_process').spawnSync(
    process.execPath,
    [dispatcher, '.', 'enable'],
    { encoding: 'utf8', input: '', timeout: 180000 }
  );
  const exitCode = typeof r.status === 'number' ? r.status : -1;
  if (exitCode === 0) {
    return {
      fixed: true,
      reason: 'eureka embedding stack installed at the ~/.mindrian/eureka-deps side directory',
    };
  }
  const stderrTail = (r.stderr || '').slice(0, 500);
  return {
    fixed: false,
    reason: 'eureka enable exited ' + exitCode
      + '; run /mos:eureka enable manually to see the full output. '
      + (stderrTail ? ('stderr: ' + stderrTail) : 'no stderr captured'),
  };
}

module.exports = { checkEurekaSmoke, LAYERS, fixEurekaSmoke, PROBE_TIMEOUT_MS };
