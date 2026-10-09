'use strict';
const path = require('node:path'); const fs = require('node:fs'); const os = require('node:os');
const S = require('./_stubs.cjs'); const check = S.check;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eureka-smoke-'));
// fake side-dir install of the model package
const side = path.join(tmp, 'side'); const d = path.join(side, 'node_modules', '@huggingface', 'transformers');
fs.mkdirSync(d, { recursive: true });
fs.writeFileSync(path.join(d, 'package.json'), '{"name":"@huggingface/transformers","main":"i.js","version":"3.0.0"}');
fs.writeFileSync(path.join(d, 'i.js'), 'module.exports = { env: { cacheDir: "SIDE-DIR-CACHE" } };');
process.env.MINDRIAN_EUREKA_DEPS_ROOT = side;
let seenCacheDir = null;
S.extra.spine = {
  _test: {
    resolveModel: function () { return 'm'; }, resolveDim: function () { return 4; }, resolveDtype: function () { return 'q8'; },
    resolveCacheDir: function (env) { return (env && env.cacheDir) || null; },
    isModelCached: async function (m, dir) { seenCacheDir = dir; return false; },
  },
  getEncoder: async function () { return { success: true }; },
  embedTexts: async function (t, o) { if (o && o._forceUnavailable) return { success: false, error: 'encoder_unavailable' }; return { success: true, vectors: [[1, 0, 0, 0]] }; },
};
const pkg = path.join(__dirname, '../..');
const N = require(path.join(pkg, 'lib/core/doctor/class-s-eureka-smoke.cjs'));
const O = require(path.join(pkg, '../_baseline/orig/eureka/lib/core/doctor/class-s-eureka-smoke.cjs'));
const mocks = { mockL1: async function () { return { ok: true, reason: 'l1' }; }, mockL2: async function () { return { ok: true, reason: 'l2' }; }, mockL4: async function () { return { ok: true, reason: 'l4' }; }, mockL5: async function () { return { ok: false, advisory: true, reason: 'not installed' }; }, mockPerspective: async function () { return { ok: true, reason: 'p' }; } };

(async function () {
  check('LAYERS wire-locked ids/order', N.LAYERS.map(function (l) { return l.id; }).join() === 'deps_present,vec_backend,model_probe,graceful_degrade,model_installed');
  check('exports unchanged', Object.keys(O).sort().join() === Object.keys(N).sort().join());

  // L3 resolution authority (bug fix)
  seenCacheDir = null; await O.checkEurekaSmoke(Object.assign({}, mocks, { mockL3: undefined }));
  const origSeen = seenCacheDir;
  seenCacheDir = null; const r = await N.checkEurekaSmoke(Object.assign({}, mocks));
  check('ORIGINAL L3 cannot see side-dir model package (bug)', origSeen === null, String(origSeen));
  check('2026 L3 resolves cacheDir through the side directory', seenCacheDir === 'SIDE-DIR-CACHE', String(seenCacheDir));
  const l3 = r.layers.find(function (l) { return l.id === 'model_probe'; });
  check('L3 cache miss ok:true no download', l3.ok === true && /cache miss at SIDE-DIR-CACHE/.test(l3.reason), l3.reason);

  // L4 real against stub spine
  const l4 = r.layers.find(function (l) { return l.id === 'graceful_degrade'; });
  check('L4 stub spine mock layer present', l4 && l4.ok);

  // overall verdict logic
  check('advisory L5 failure does not fail overall', r.ok === true && r.layers[4].advisory === true && r.layers[4].ok === false);
  check('perspective attached', r.perspective && r.perspective.id === 'perspective_recall' && r.perspective.ok === true);
  const bad = await N.checkEurekaSmoke(Object.assign({}, mocks, { mockL2: async function () { return { ok: false, reason: 'x' }; } }));
  check('blocker failure fails overall', bad.ok === false);
  const non = await N.checkEurekaSmoke(Object.assign({}, mocks, { mockL1: async function () { return { ok: false, reason: 'dead' }; } }));
  check('non-cascading: later layers still run', non.layers.length === 5 && non.layers[3].ok === true);
  const pf = await N.checkEurekaSmoke(Object.assign({}, mocks, { mockPerspective: async function () { return { ok: false, reason: 'off' }; } }));
  check('perspective failure is a blocker', pf.ok === false);
  const nothing = await N.checkEurekaSmoke(Object.assign({}, mocks, { mockL1: async function () { return undefined; } }));
  check('layer resolving undefined reported cleanly (2026)', nothing.layers[0].ok === false && nothing.layers[0].reason === 'layer returned no result object', nothing.layers[0].reason);
  const nothingO = await O.checkEurekaSmoke(Object.assign({}, mocks, { mockL1: async function () { return undefined; } }));
  check('original gave an opaque TypeError string', /exception: /.test(nothingO.layers[0].reason));
  const thr = await N.checkEurekaSmoke(Object.assign({}, mocks, { mockL2: async function () { throw new Error('boom'); } }));
  check('thrown layer -> exception reason', /exception: boom/.test(thr.layers[1].reason));

  // encoderPresentSync with fake plugin roots
  const root = path.join(tmp, 'plugin'); fs.mkdirSync(path.join(root, 'node_modules', 'sqlite-vec'), { recursive: true });
  fs.writeFileSync(path.join(root, 'node_modules', 'sqlite-vec', 'package.json'), '{"version":"0.1.6"}');
  const ep = N.encoderPresentSync({ pluginRoot: root });
  check('L1 reads sqlite-vec version', ep.deps.ok && ep.deps.reason === 'sqlite-vec 0.1.6');
  check('L5 model installed via side dir', ep.model.installed && ep.model.where === 'side-dir' && ep.present === true);
  const ep2 = N.encoderPresentSync({ pluginRoot: path.join(tmp, 'nowhere') });
  check('missing sqlite-vec -> deps not ok', ep2.deps.ok === false && ep2.present === false);

  // timeout env guard
  check('default timeout', N.PROBE_TIMEOUT_MS === 20000);
  for (const [val, want] of [['-5', 20000], ['abc', 20000], ['0', 20000], ['1500', 1500]]) {
    process.env.MINDRIAN_EUREKA_SMOKE_TIMEOUT_MS = val;
    const out = require('node:child_process').spawnSync(process.execPath, ['-e', 'const M=require("module");const o=M._load;M._load=function(r){if(/embedding-spine|eureka-deps/.test(r))return {};return o.apply(this,arguments)};console.log(require(process.argv[1]).PROBE_TIMEOUT_MS)', path.join(pkg, 'lib/core/doctor/class-s-eureka-smoke.cjs')], { encoding: 'utf8', env: Object.assign({}, process.env) });
    const o = require('node:child_process').spawnSync(process.execPath, ['-e', 'console.log(require(process.argv[1]).PROBE_TIMEOUT_MS)', path.join(pkg, '../_baseline/orig/eureka/lib/core/doctor/class-s-eureka-smoke.cjs')], { encoding: 'utf8', env: Object.assign({}, process.env) });
    check('timeout env ' + val + ' -> ' + want + ' (orig: ' + o.stdout.trim() + ')', out.stdout.trim() === String(want), out.stdout + out.stderr);
  }
  delete process.env.MINDRIAN_EUREKA_SMOKE_TIMEOUT_MS;

  // fix(): never spawn the real installer in tests; patch spawnSync and the resolver
  const cp = require('node:child_process'); const realSpawn = cp.spawnSync; const Mod = require('node:module'); const realResolve = Mod._resolveFilename;
  let spawned = 0;
  cp.spawnSync = function () { spawned += 1; return { status: null, error: { code: 'ETIMEDOUT' }, stderr: 'slow' }; };
  const fx1 = N.fixEurekaSmoke({});
  check('timeout surfaces spawn error code (2026)', fx1.fixed === false && /ETIMEDOUT/.test(fx1.reason) && /exited -1/.test(fx1.reason), fx1.reason);
  const fxO = O.fixEurekaSmoke({});
  check('original omitted the cause', !/ETIMEDOUT/.test(fxO.reason));
  cp.spawnSync = function () { spawned += 1; return { status: 0, stderr: '' }; };
  check('exit 0 -> fixed', N.fixEurekaSmoke({}).fixed === true);
  Mod._resolveFilename = function (req) { if (/eureka-enable/.test(req)) { const e = new Error("Cannot find module 'x'"); e.code = 'MODULE_NOT_FOUND'; throw e; } return realResolve.apply(this, arguments); };
  let threw = false; let fx;
  try { fx = N.fixEurekaSmoke({}); } catch (e) { threw = true; }
  check('missing installer: structured result, no throw (2026)', threw === false && fx.fixed === false && /installer not found/.test(fx.reason), JSON.stringify(fx));
  let othrew = false; try { O.fixEurekaSmoke({}); } catch (e) { othrew = true; }
  check('original threw on missing installer', othrew === true);
  Mod._resolveFilename = realResolve; cp.spawnSync = realSpawn;
  fs.rmSync(tmp, { recursive: true, force: true });
  S.done('test-smoke');
})();
