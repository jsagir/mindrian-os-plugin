#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 379.1 (graph derive drain and scout runaway CPU) proof: scout-bound.
 * Proves CPU379-06: the scout is bounded before buildLsaMatrix (an artifact-count cap that
 * returns the degraded envelope, a timeout and killSignal on runStep, and a single-flight lock
 * with a PID liveness check and a throttle stamp written at run start).
 * Plan 05 Task 1: the cap part (rs-engine runModeInternal, hsi-engine runTier1, source-order
 * fence, scope disclosure). Plan 05 Task 2: the runner part under RUNNER_ASSERTIONS_BELOW.
 * Hermetic: scrubVendorKey + installNetGuard first; attempts() === 0 last. No em-dashes.
 */
const { scrubVendorKey, installNetGuard } = require('./helpers/hygiene-355.cjs');
scrubVendorKey();
const netGuard = installNetGuard();

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, fork } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');

let pass = 0;
let fail = 0;
async function t(label, fn) {
  try {
    await fn();
    pass += 1;
    console.log('  ok - ' + label);
  } catch (e) {
    fail += 1;
    process.exitCode = 1;
    console.log('  FAIL - ' + label + ': ' + (e && e.message ? e.message : e));
  }
}

function withEnv(name, value, fn) {
  const had = Object.prototype.hasOwnProperty.call(process.env, name);
  const prev = process.env[name];
  if (value === undefined) delete process.env[name]; else process.env[name] = value;
  const restore = () => {
    if (had) process.env[name] = prev; else delete process.env[name];
  };
  let out;
  try {
    out = fn();
  } catch (e) {
    restore();
    throw e;
  }
  if (out && typeof out.then === 'function') {
    return out.then((v) => { restore(); return v; }, (e) => { restore(); throw e; });
  }
  restore();
  return out;
}

const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-379-1-scout-'));
let roomSeq = 0;

// A tmp room with n section artifacts (bodies above MIN_BODY_CHARS 50).
function makeRoom(n) {
  roomSeq += 1;
  const room = path.join(SCRATCH, 'room-' + roomSeq);
  fs.mkdirSync(path.join(room, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(room, '.room-root'), JSON.stringify({ room: 'scout-fixture-' + roomSeq, active: true }), 'utf8');
  const dir = path.join(room, 'notes');
  fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < n; i += 1) {
    fs.writeFileSync(
      path.join(dir, 'item-' + i + '.md'),
      '# Item ' + i + '\n\nThis body talks about subject number ' + i + ' with enough words to count as an artifact for the walker.\n',
      'utf8',
    );
  }
  return room;
}

async function main() {
  console.log('test-379.1-scout-bound (CPU379-06)');
  // An empty model cache keeps the semantic leg hermetic and fast: no local model, so the encoder
  // is unavailable and the engine takes its identity fallback.
  const emptyModelCache = path.join(SCRATCH, 'empty-model-cache');
  fs.mkdirSync(emptyModelCache, { recursive: true });
  process.env.MINDRIAN_MODEL_CACHE = emptyModelCache;

  try {
    const rsEngine = require('../lib/core/rs-engine.cjs');
    const hsiEngine = require('../lib/core/hsi-engine.cjs');
    const probe = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', '379.1', 'probe-svd-parity.json'), 'utf8'));

    await t('DEFAULT_MAX_ARTIFACTS equals rs_max_artifacts_default of the svd probe', () => {
      assert.equal(rsEngine._test.DEFAULT_MAX_ARTIFACTS, probe.rs_max_artifacts_default);
      assert.equal(withEnv('MINDRIAN_RS_MAX_ARTIFACTS', undefined, () => rsEngine._test.resolveMaxArtifacts()), probe.rs_max_artifacts_default);
    });

    await t('resolveMaxArtifacts: a positive integer env wins; junk, zero and negatives fall back', () => {
      const dflt = rsEngine._test.DEFAULT_MAX_ARTIFACTS;
      assert.equal(withEnv('MINDRIAN_RS_MAX_ARTIFACTS', '7', () => rsEngine._test.resolveMaxArtifacts()), 7);
      for (const bad of ['0', '-3', 'abc', '1.5', '', ' ']) {
        assert.equal(withEnv('MINDRIAN_RS_MAX_ARTIFACTS', bad, () => rsEngine._test.resolveMaxArtifacts()), dflt, 'bad value ' + JSON.stringify(bad));
      }
    });

    await t('cap 5 on a 6-artifact room: degraded artifact_cap_exceeded in under 2000 ms, results file written', async () => {
      const room = makeRoom(6);
      const started = Date.now();
      const res = await withEnv('MINDRIAN_RS_MAX_ARTIFACTS', '5', () => rsEngine.runModeInternal(room, {}));
      const ms = Date.now() - started;
      assert.ok(ms < 2000, 'took ' + ms + ' ms');
      assert.equal(res.metadata.degraded, 'artifact_cap_exceeded');
      assert.equal(res.metadata.artifact_cap, 5);
      assert.equal(res.metadata.artifact_count, 6);
      assert.ok(Number.isInteger(res.metadata.scope_excluded_dirs));
      assert.ok(Number.isInteger(res.metadata.scope_excluded_artifacts));
      assert.equal(typeof res.metadata.scope_overbroad, 'boolean');
      assert.deepEqual(res.pairs, []);
      const onDisk = JSON.parse(fs.readFileSync(path.join(room, '.rs-engine-results.json'), 'utf8'));
      assert.equal(onDisk.metadata.degraded, 'artifact_cap_exceeded');
      assert.equal(onDisk.metadata.artifact_cap, 5);
    });

    await t('cap 6 on a 6-artifact room proceeds past the cap and carries the scope fields', async () => {
      const room = makeRoom(6);
      const res = await withEnv('MINDRIAN_RS_MAX_ARTIFACTS', '6', () => rsEngine.runModeInternal(room, {}));
      assert.notEqual(res.metadata.degraded, 'artifact_cap_exceeded');
      assert.equal(res.metadata.artifact_count, 6);
      assert.ok(Number.isInteger(res.metadata.scope_excluded_dirs));
      assert.ok(Number.isInteger(res.metadata.scope_excluded_artifacts));
      assert.equal(typeof res.metadata.scope_overbroad, 'boolean');
    });

    await t('the cap result discloses the scope: a manifest room reads 5 artifacts and says 1 dir and 50 files were removed', async () => {
      const room = makeRoom(5);
      const gen = path.join(room, 'solution-design', 'gen');
      fs.mkdirSync(path.join(gen, 'engine-input-room'), { recursive: true });
      fs.writeFileSync(path.join(gen, 'engine-input-manifest.json'), '{}', 'utf8');
      for (let i = 0; i < 50; i += 1) {
        fs.writeFileSync(
          path.join(gen, 'engine-input-room', 'g-' + i + '.md'),
          '# Gen ' + i + '\n\nGenerated engine input body number ' + i + ' with enough words to count as an artifact.\n',
          'utf8',
        );
      }
      const res = await withEnv('MINDRIAN_RS_MAX_ARTIFACTS', '4', () => rsEngine.runModeInternal(room, {}));
      assert.equal(res.metadata.degraded, 'artifact_cap_exceeded');
      assert.equal(res.metadata.artifact_count, 5);
      assert.equal(res.metadata.scope_excluded_dirs, 1);
      assert.equal(res.metadata.scope_excluded_artifacts, 50);
      assert.equal(res.metadata.scope_overbroad, false);
    });

    await t('the below-two short-circuit also carries the scope fields', async () => {
      const room = makeRoom(1);
      const res = await rsEngine.runModeInternal(room, {});
      assert.equal(res.metadata.artifact_count, 1);
      assert.ok(Number.isInteger(res.metadata.scope_excluded_dirs));
      assert.equal(typeof res.metadata.scope_overbroad, 'boolean');
    });

    await t('hsi-engine runTier1 with cap 5 on 6 artifacts returns success false, artifact_cap_exceeded', async () => {
      const room = makeRoom(6);
      const res = await withEnv('MINDRIAN_RS_MAX_ARTIFACTS', '5', () => hsiEngine.runTier1(room, {}));
      assert.equal(res.success, false);
      assert.equal(res.error, 'artifact_cap_exceeded');
      assert.equal(res.detail.artifact_count, 6);
      assert.equal(res.detail.artifact_cap, 5);
    });

    await t('source fence: the cap check sits above the buildLsaMatrix call in runModeInternal', () => {
      const src = fs.readFileSync(path.join(REPO, 'lib', 'core', 'rs-engine.cjs'), 'utf8');
      const start = src.indexOf('async function runModeInternal');
      assert.ok(start > 0);
      const body = src.slice(start);
      const capAt = body.indexOf("'artifact_cap_exceeded'");
      const lsaAt = body.indexOf('rsMath.buildLsaMatrix(');
      assert.ok(capAt > 0 && lsaAt > 0 && capAt < lsaAt, 'cap at ' + capAt + ', lsa at ' + lsaAt);
      const hsi = fs.readFileSync(path.join(REPO, 'lib', 'core', 'hsi-engine.cjs'), 'utf8');
      const hCap = hsi.indexOf("'artifact_cap_exceeded'");
      const hLsa = hsi.indexOf('computeLsaSimilarity(texts)');
      assert.ok(hCap > 0 && hLsa > 0 && hCap < hLsa, 'hsi cap before lsa');
    });

    await t('rs-engine keeps the three cache function names and delegates to vector-cache', () => {
      const src = fs.readFileSync(path.join(REPO, 'lib', 'core', 'rs-engine.cjs'), 'utf8');
      for (const fn of ['_contentHash', '_loadEmbeddingCache', '_saveEmbeddingCache']) {
        assert.ok(src.includes('function ' + fn), fn);
      }
      assert.ok(src.includes("require('./semantic-index/vector-cache.cjs')"));
      assert.ok(src.includes("require('./artifact-scope.cjs')"));
      assert.ok(src.includes('vectorCache.load(') && src.includes('vectorCache.save(') && src.includes('vectorCache.contentHash('));
    });

    // --- Plan 05 Task 2: the scout runner is bounded, armed at start, and single flight ---
    const RUNNER = path.join(REPO, 'scripts', 'scout-cadence-runner.cjs');
    const HOLDER = path.join(REPO, 'tests', 'helpers', 'job-lock-holder-379.cjs');
    const runner = require('../scripts/scout-cadence-runner.cjs');

    // A hermetic child env: scratch HOME (the throttle stamp lives under $HOME), no vendor keys.
    function childEnv(home, extra) {
      const env = Object.assign({}, process.env, {
        HOME: home,
        USERPROFILE: home,
        MINDRIAN_ROOMS_HOME: path.join(home, 'rooms'),
        MINDRIAN_MODEL_CACHE: emptyModelCache,
        MINDRIAN_SCOUT_STEP_TIMEOUT_MS: '120000',
      }, extra || {});
      for (const k of Object.keys(env)) {
        if (/^(ANTHROPIC|OPENAI|GEMINI|GOOGLE|PINECONE|TAVILY|MINDRIAN_BRAIN)[A-Z_]*KEY/.test(k)) delete env[k];
      }
      return env;
    }

    function runRunner(room, args, env) {
      return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [RUNNER, room].concat(args), { env, stdio: ['ignore', 'pipe', 'pipe'] });
        let out = '';
        let err = '';
        child.stdout.on('data', (d) => { out += d; });
        child.stderr.on('data', (d) => { err += d; });
        child.on('error', reject);
        child.on('exit', (code) => resolve({ code, out, err, child }));
        runRunner.last = child;
      });
    }

    function parseSummary(out) {
      const at = out.indexOf('{');
      assert.ok(at >= 0, 'no JSON summary in stdout: ' + out.slice(0, 200));
      return JSON.parse(out.slice(at));
    }

    await t('runStep: a hung child dies at the timeout; status degraded, exit null, stderr names the timeout, no throw', () => {
      const started = Date.now();
      const step = withEnv('MINDRIAN_SCOUT_STEP_TIMEOUT_MS', '500', () =>
        runner.runStep('hang', process.execPath, ['-e', 'setInterval(() => {}, 1000)']));
      const ms = Date.now() - started;
      assert.ok(ms < 3000, 'took ' + ms + ' ms');
      assert.equal(step.status, 'degraded');
      assert.equal(step.exit, null);
      assert.ok(/timeout/.test(step.stderr), step.stderr);
    });

    await t('runStep: a normal exit and a non-zero exit keep their old mapping', () => {
      const good = runner.runStep('ok', process.execPath, ['-e', 'process.stdout.write("hi")']);
      assert.equal(good.status, 'ok');
      assert.equal(good.exit, 0);
      assert.equal(good.stdout, 'hi');
      const bad = runner.runStep('bad', process.execPath, ['-e', 'process.exit(3)']);
      assert.equal(bad.status, 'degraded');
      assert.equal(bad.exit, 3);
    });

    await t('resolveStepTimeoutMs: default 300000; a positive integer env wins; junk falls back', () => {
      assert.equal(withEnv('MINDRIAN_SCOUT_STEP_TIMEOUT_MS', undefined, () => runner._test.resolveStepTimeoutMs()), 300000);
      assert.equal(withEnv('MINDRIAN_SCOUT_STEP_TIMEOUT_MS', '900', () => runner._test.resolveStepTimeoutMs()), 900);
      for (const bad of ['0', '-1', 'x', '1.5', '']) {
        assert.equal(withEnv('MINDRIAN_SCOUT_STEP_TIMEOUT_MS', bad, () => runner._test.resolveStepTimeoutMs()), 300000, bad);
      }
    });

    await t('runner: the throttle stamp exists while the run is still going, and the lock is released at the end', async () => {
      const home = path.join(SCRATCH, 'home-stamp');
      fs.mkdirSync(home, { recursive: true });
      const room = makeRoom(3);
      const env = childEnv(home, { MINDRIAN_RS_MAX_ARTIFACTS: '1' });
      const stampDir = path.join(home, '.mindrian', 'scout-cadence');
      let seenWhileRunning = false;
      const done = runRunner(room, ['--json', '--force'], env);
      const child = runRunner.last;
      const poll = setInterval(() => {
        let names = [];
        try { names = fs.readdirSync(stampDir); } catch (_e) { names = []; }
        if (names.some((n) => /^last-run-.*\.txt$/.test(n)) && child.exitCode === null) seenWhileRunning = true;
      }, 5);
      const res = await done;
      clearInterval(poll);
      assert.equal(res.code, 0, res.err);
      const summary = parseSummary(res.out);
      assert.equal(summary.fired, true);
      assert.equal(summary.in_flight === true, false);
      assert.equal(seenWhileRunning, true, 'the stamp was not visible before the run ended');
      const rs = summary.steps.find((x) => x.name === 'rs-engine-cjs');
      assert.ok(rs, 'rs-engine-cjs step present');
      const results = JSON.parse(fs.readFileSync(path.join(room, '.rs-engine-results.json'), 'utf8'));
      assert.equal(results.metadata.degraded, 'artifact_cap_exceeded');
      assert.equal(fs.existsSync(path.join(room, '.mindrian', 'scout-cadence.lock')), false, 'the lock is released');
    });

    await t('runner: a live holder on the scout lock -> in_flight true with the holder pid; no step ran', async () => {
      const home = path.join(SCRATCH, 'home-flight');
      fs.mkdirSync(home, { recursive: true });
      const room = makeRoom(3);
      const lockPath = path.join(room, '.mindrian', 'scout-cadence.lock');
      const holder = fork(HOLDER, [lockPath, 'hold', '30000']);
      try {
        const msg = await new Promise((resolve, reject) => {
          holder.once('message', resolve);
          holder.once('error', reject);
        });
        assert.equal(msg.acquired, true);
        const res = await runRunner(room, ['--json', '--force'], childEnv(home));
        assert.equal(res.code, 0, res.err);
        const summary = parseSummary(res.out);
        assert.equal(summary.in_flight, true);
        assert.equal(summary.lock_pid, msg.pid);
        assert.equal(summary.lock_reason, 'held');
        assert.equal(summary.fired, false);
        assert.deepEqual(summary.steps, []);
        assert.equal(fs.existsSync(path.join(home, '.mindrian', 'scout-cadence')), false, 'no stamp from the blocked run');
      } finally {
        holder.kill();
        await new Promise((resolve) => { holder.once('exit', resolve); if (holder.exitCode !== null) resolve(); });
      }
    });

    await t('source fence: recordRun comes before the first runStep in main; killSignal, ETIMEDOUT, setPriority, job-lock are present', () => {
      const src = fs.readFileSync(RUNNER, 'utf8');
      const mainAt = src.indexOf('async function main(');
      assert.ok(mainAt > 0);
      const body = src.slice(mainAt);
      const recAt = body.indexOf('guard.recordRun(');
      const stepAt = body.indexOf('runStep(');
      assert.ok(recAt > 0 && stepAt > 0 && recAt < stepAt, 'recordRun at ' + recAt + ', first runStep at ' + stepAt);
      assert.equal((src.match(/guard\.recordRun\(/g) || []).length, 1, 'exactly one recordRun call');
      const stepFn = src.slice(src.indexOf('function runStep('), src.indexOf('function runStep(') + 1200);
      assert.ok(stepFn.includes("killSignal: 'SIGKILL'"));
      assert.ok(src.includes('ETIMEDOUT'));
      assert.ok(src.includes('os.setPriority'));
      assert.ok(src.includes("require('../lib/core/job-lock.cjs')"));
      assert.ok(src.includes('scout-cadence.lock'));
    });

    // RUNNER_ASSERTIONS_BELOW (Plan 05 Task 2 adds the scout runner assertions here)
  } finally {
    try { fs.rmSync(SCRATCH, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
  assert.equal(netGuard.attempts(), 0, 'no network attempt');
  netGuard.restore();
  console.log('PASS: ' + pass + ' FAIL: ' + fail);
}

main().then(() => {
  // exit explicitly: the encoder module may leave handles open
  process.exit(process.exitCode || 0);
}, (e) => {
  console.error(e);
  process.exit(1);
});
