#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 379.1 (graph derive drain and scout runaway CPU) proof: worker-caps.
 * Proves CPU379-03: the drain worker has a time limit, a low priority and an ONNX thread limit
 * set in lib/core/semantic-index/embedding-spine.cjs (intraOpNumThreads 2, interOpNumThreads 1,
 * allow_spinning "0" when the Wave 0 probe proves the extra map is honoured; D-379.1-13).
 * Plan 02 (this file's thread-cap part): resolveThreads, buildSessionOptions, and the hermetic
 * pipeline assertion through the stub package under tests/fixtures/379.1-stub-deps. Plan 04
 * adds the drain worker assertions (budget, priority) under the marker WORKER_ASSERTIONS_BELOW.
 * Opt-in live leg under MINDRIAN_LIVE_ENCODER=1 only (real deps, model already cached).
 * Hermetic: scrubVendorKey + installNetGuard first; attempts() === 0 last. No em-dashes.
 */
const { scrubVendorKey, installNetGuard } = require('./helpers/hygiene-355.cjs');
scrubVendorKey();
const netGuard = installNetGuard();

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const spine = require('../lib/core/semantic-index/embedding-spine.cjs');
const { DEFAULT_THREADS, resolveThreads, resolveAllowSpinning, buildSessionOptions, resetPipelineCache } = spine._test;
const STUB_ROOT = path.join(REPO, 'tests', 'fixtures', '379.1-stub-deps');
const STUB_INDEX = path.join(STUB_ROOT, 'node_modules', '@huggingface', 'transformers', 'index.js');
const PROBE = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', '379.1', 'probe-allow-spinning.json'), 'utf8'));

let pass = 0;
let fail = 0;
function t(label, fn) {
  try {
    fn();
    pass += 1;
    console.log('  ok - ' + label);
  } catch (e) {
    fail += 1;
    process.exitCode = 1;
    console.log('  FAIL - ' + label + ': ' + (e && e.message ? e.message : e));
  }
}
async function ta(label, fn) {
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
function skip(label) {
  console.log('  SKIP - ' + label);
}

function withEnv(pairs, fn) {
  const saved = {};
  for (const k of Object.keys(pairs)) {
    saved[k] = Object.prototype.hasOwnProperty.call(process.env, k) ? process.env[k] : undefined;
    if (pairs[k] === undefined) delete process.env[k]; else process.env[k] = pairs[k];
  }
  const restore = () => {
    for (const k of Object.keys(pairs)) {
      if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
    }
  };
  try {
    const r = fn();
    if (r && typeof r.then === 'function') return r.finally(restore);
    restore();
    return r;
  } catch (e) {
    restore();
    throw e;
  }
}

function hostCap() {
  const cores = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
  return Math.max(1, cores - 1);
}

function taskCount() {
  try {
    return fs.readdirSync('/proc/self/task').length;
  } catch (_e) {
    return null;
  }
}

async function main() {
  console.log('test-379.1-worker-caps (CPU379-03)');
  const cap = hostCap();

  t('DEFAULT_THREADS is 2 and resolveThreads() returns 2 with the env unset (host cap ' + cap + ')', () => {
    assert.equal(DEFAULT_THREADS, 2);
    withEnv({ MINDRIAN_EMBED_THREADS: undefined }, () => {
      assert.equal(resolveThreads(), Math.min(2, cap));
      if (cap >= 2) assert.equal(resolveThreads(), 2);
    });
  });

  t('resolveThreads() returns 3 with MINDRIAN_EMBED_THREADS=3 (when the host allows)', () => {
    withEnv({ MINDRIAN_EMBED_THREADS: '3' }, () => {
      assert.equal(resolveThreads(), Math.min(3, cap));
    });
  });

  t('resolveThreads() returns the default with abc, 0 and -1', () => {
    for (const bad of ['abc', '0', '-1', '', '  ', '2.5']) {
      withEnv({ MINDRIAN_EMBED_THREADS: bad }, () => {
        assert.equal(resolveThreads(), Math.min(2, cap), 'env ' + JSON.stringify(bad));
      });
    }
  });

  t('resolveThreads() never exceeds os.availableParallelism() - 1 when the env asks for 999', () => {
    withEnv({ MINDRIAN_EMBED_THREADS: '999' }, () => {
      const n = resolveThreads();
      assert.equal(n, cap);
      assert.ok(n <= cap && n >= 1);
    });
  });

  t('buildSessionOptions() carries intraOpNumThreads = resolveThreads() and interOpNumThreads 1', () => {
    withEnv({ MINDRIAN_EMBED_THREADS: undefined, MINDRIAN_EMBED_ALLOW_SPINNING: undefined }, () => {
      const so = buildSessionOptions();
      assert.equal(so.intraOpNumThreads, resolveThreads());
      assert.equal(so.interOpNumThreads, 1);
    });
    withEnv({ MINDRIAN_EMBED_THREADS: '1' }, () => {
      assert.equal(buildSessionOptions().intraOpNumThreads, 1);
    });
  });

  t('the extra map follows the Wave 0 probe (extra_honoured ' + PROBE.extra_honoured + ')', () => {
    withEnv({ MINDRIAN_EMBED_ALLOW_SPINNING: undefined }, () => {
      const so = buildSessionOptions();
      if (PROBE.extra_honoured === true) {
        assert.equal(spine._test.ALLOW_SPINNING_EXTRA_SHIPPED, true);
        assert.ok(so.extra && so.extra.session && so.extra.session.intra_op, 'extra.session.intra_op present');
        assert.equal(so.extra.session.intra_op.allow_spinning, '0');
        assert.equal(typeof so.extra.session.intra_op.allow_spinning, 'string', 'the binding needs a string');
        assert.equal(resolveAllowSpinning(), '0');
      } else {
        assert.equal(spine._test.ALLOW_SPINNING_EXTRA_SHIPPED, false);
        assert.equal(Object.prototype.hasOwnProperty.call(so, 'extra'), false);
        assert.equal(resolveAllowSpinning(), null);
      }
    });
    if (PROBE.extra_honoured === true) {
      withEnv({ MINDRIAN_EMBED_ALLOW_SPINNING: '1' }, () => {
        assert.equal(buildSessionOptions().extra.session.intra_op.allow_spinning, '1');
      });
      withEnv({ MINDRIAN_EMBED_ALLOW_SPINNING: 'yes' }, () => {
        assert.equal(buildSessionOptions().extra.session.intra_op.allow_spinning, '0', 'anything else is 0');
      });
    }
  });

  t('the one pipeline() call in the spine carries session_options: buildSessionOptions()', () => {
    const src = fs.readFileSync(path.join(REPO, 'lib', 'core', 'semantic-index', 'embedding-spine.cjs'), 'utf8');
    const lines = src.split('\n').filter((l) => l.indexOf("pipeline('feature-extraction'") !== -1);
    assert.equal(lines.length, 1, 'exactly one pipeline() call');
    assert.ok(lines[0].indexOf('session_options: buildSessionOptions()') !== -1, lines[0]);
  });

  // Hermetic pipeline assertion through the stub package.
  await ta('hermetic: embedTexts through the stub package records intraOpNumThreads 2 and interOpNumThreads 1', async () => {
    const cacheTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-379-1-caps-'));
    try {
      await withEnv({
        MINDRIAN_EUREKA_DEPS_ROOT: STUB_ROOT,
        MINDRIAN_EMBED_MODEL: spine._test.DEFAULT_MODEL,
        MINDRIAN_EMBED_THREADS: undefined,
        MINDRIAN_EMBED_ALLOW_SPINNING: undefined,
        MINDRIAN_MODEL_CACHE: cacheTmp,
      }, async () => {
        resetPipelineCache();
        const res = await spine.embedTexts(['a', 'b'], {});
        assert.equal(res.success, true, 'embedTexts succeeded through the stub: ' + JSON.stringify(res));
        assert.equal(res.vectors.length, 2);
        assert.equal(res.vectors[0].length, 3);
        assert.equal(res.provenance.model, spine._test.DEFAULT_MODEL);
        const stub = require(STUB_INDEX);
        assert.ok(stub.calls.length >= 1, 'the stub pipeline was called');
        const call = stub.calls[0];
        assert.equal(call[0], 'feature-extraction');
        assert.equal(call[1], spine._test.DEFAULT_MODEL);
        assert.equal(call[2].dtype, spine._test.resolveDtype());
        assert.equal(call[2].session_options.intraOpNumThreads, Math.min(2, cap));
        if (cap >= 2) assert.equal(call[2].session_options.intraOpNumThreads, 2);
        assert.equal(call[2].session_options.interOpNumThreads, 1);
        if (PROBE.extra_honoured === true) {
          assert.equal(call[2].session_options.extra.session.intra_op.allow_spinning, '0');
        }
        resetPipelineCache();
      });
    } finally {
      try { fs.rmSync(cacheTmp, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    }
  });

  // Opt-in live leg: the real deps, the model already cached, thread count bounded.
  if (process.env.MINDRIAN_LIVE_ENCODER === '1') {
    await ta('live: two strings through the real encoder; /proc/self/task count at most 11 + resolveThreads()', async () => {
      resetPipelineCache();
      const before = taskCount();
      const res = await withEnv({ MINDRIAN_EMBED_THREADS: undefined }, () => spine.embedTexts(['the cat sat on the mat', 'an audit of quarterly revenue'], {}));
      assert.equal(res.success, true, 'live encoder: ' + JSON.stringify(res && res.error) + ' ' + JSON.stringify(res && res.detail));
      assert.equal(res.vectors.length, 2);
      const after = taskCount();
      if (after === null) {
        skip('live thread count: /proc/self/task is not readable on this platform');
        return;
      }
      const limit = 11 + resolveThreads();
      assert.ok(after <= limit, 'threads after load ' + after + ' (before ' + before + ') is at most ' + limit);
      console.log('    live: threads before ' + before + ', after ' + after + ', limit ' + limit);
    });
  } else {
    skip('live encoder leg (set MINDRIAN_LIVE_ENCODER=1 to run it with the real deps)');
  }

  // ---- Plan 04 Task 3: the drain worker (CPU379-03, D-379.1-13) ----
  const { spawn, spawnSync } = require('node:child_process');
  const DRAIN = path.join(REPO, 'scripts', 'gsd-graph-derive-drain.cjs');
  const sweep = require('../scripts/gsd-graph-derive-sweep.cjs');
  const wtmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-379-1-worker-'));
  const emptyDeps = path.join(wtmp, 'no-deps');
  fs.mkdirSync(emptyDeps, { recursive: true });

  function scrubbedEnv(extra) {
    const env = {};
    for (const k of Object.keys(process.env)) {
      if (!/^MINDRIAN_|^MOS_/.test(k)) env[k] = process.env[k];
    }
    return Object.assign(env, {
      HOME: path.join(wtmp, 'home'),
      MINDRIAN_BRAIN_KEY: 'mos-379-test-key',
      MINDRIAN_BRAIN_URL: 'http://127.0.0.1:1',
      MINDRIAN_BRAIN_TIMEOUT_MS: '200',
    }, extra || {});
  }
  function makeRoom(name, count) {
    const room = path.join(wtmp, name);
    fs.mkdirSync(path.join(room, '.mindrian'), { recursive: true });
    fs.writeFileSync(path.join(room, '.room-root'), '{}\n', 'utf8');
    for (let i = 0; i < count; i += 1) {
      fs.writeFileSync(path.join(room, 'note-' + String(i).padStart(2, '0') + '.md'),
        '# Note ' + i + '\n\nA short note number ' + i + ' about topic ' + (i % 5) + '.\n', 'utf8');
    }
    sweep.enqueueDerive(room, {});
    return room;
  }
  function runChild(args, env, timeoutMs) {
    return new Promise((resolve) => {
      const t0 = Date.now();
      const child = spawn(process.execPath, args, { env: env, stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      let err = '';
      child.stdout.on('data', (d) => { out += d; });
      child.stderr.on('data', (d) => { err += d; });
      const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch (_e) { /* gone */ } }, timeoutMs);
      child.on('exit', (code) => {
        clearTimeout(timer);
        resolve({ code: code, out: out, err: err, ms: Date.now() - t0 });
      });
    });
  }

  try {
    await ta('(1a) --worker --report-usage prints one drain-usage-v1 JSON line and the child exits inside 10 s', async () => {
      const room = makeRoom('room-usage', 30);
      const res = await runChild(
        [DRAIN, '--worker', '--room', room, '--report-usage'],
        scrubbedEnv({ MOS_NO_DETACHED_DERIVE: '1', MINDRIAN_DERIVE_BUDGET_MS: '1500', MINDRIAN_EUREKA_DEPS_ROOT: emptyDeps }),
        15000
      );
      assert.equal(res.code, 0, 'exit 0; stderr: ' + res.err.slice(0, 200));
      assert.ok(res.ms < 10000, 'exits inside 10 s: ' + res.ms);
      const lines = res.err.split('\n').filter((l) => l.startsWith('{'));
      assert.ok(lines.length >= 1, 'a JSON line on stderr');
      const usage = JSON.parse(lines[lines.length - 1]);
      assert.equal(usage.schema, 'drain-usage-v1');
      assert.equal(typeof usage.cpu_user_us, 'number');
      assert.equal(typeof usage.cpu_system_us, 'number');
      assert.equal(typeof usage.max_rss_kb, 'number');
      assert.equal(typeof usage.clock_ms, 'number');
      assert.equal(usage.pid > 0, true);
      assert.equal(sweep.readQueue(room).entries.length, 0, 'the cold drain disclosed the skip and cleared the entry');
      assert.deepEqual(Object.keys(usage).sort(), ['clock_ms', 'cpu_system_us', 'cpu_user_us', 'max_rss_kb', 'pid', 'rss_kb', 'schema']);
      console.log('    usage line: ' + lines[lines.length - 1] + ' (wall ' + res.ms + ' ms)');
    });

    if (process.platform === 'win32') {
      skip('(1b) priority read on a held child (POSIX only)');
    } else {
      await ta('(1b) lowerWorkerPriority sets nice 19 on a held child', async () => {
        const code = "const d = require(" + JSON.stringify(DRAIN) + "); d._test.lowerWorkerPriority(); "
          + "process.stdout.write('HELD\\n'); setInterval(() => {}, 1000);";
        const child = spawn(process.execPath, ['-e', code], { stdio: ['ignore', 'pipe', 'pipe'], env: scrubbedEnv({}) });
        try {
          await new Promise((resolve, reject) => {
            let buf = '';
            const timer = setTimeout(() => reject(new Error('child never printed HELD')), 20000);
            child.stdout.on('data', (d) => {
              buf += d;
              if (buf.indexOf('HELD') !== -1) { clearTimeout(timer); resolve(); }
            });
            child.on('error', reject);
          });
          const prio = os.getPriority(child.pid);
          assert.equal(prio, 19, 'priority is 19, got ' + prio);
          console.log('    priority of the held child: ' + prio);
        } finally {
          try { child.kill('SIGKILL'); } catch (_e) { /* gone */ }
        }
      });
    }

    await ta('(1c) the backstop ends an idle stall inside 2000 ms with exit 0', async () => {
      const code = "const d = require(" + JSON.stringify(DRAIN) + "); d._test.armBackstop(300); setInterval(() => {}, 1000);";
      const t0 = Date.now();
      const res = await runChild(['-e', code], scrubbedEnv({}), 20000);
      const ms = Date.now() - t0;
      assert.equal(res.code, 0);
      console.log('    backstop exit: wall ' + ms + ' ms including module load');
    });
    await ta('(1c2) the backstop exits inside 2000 ms once the module is loaded', async () => {
      const code = "const d = require(" + JSON.stringify(DRAIN) + "); const t0 = Date.now(); "
        + "d._test.armBackstop(300); process.on('exit', () => process.stderr.write('ELAPSED ' + (Date.now() - t0) + '\\n')); setInterval(() => {}, 1000);";
      const res = await runChild(['-e', code], scrubbedEnv({}), 20000);
      assert.equal(res.code, 0);
      const m = /ELAPSED (\d+)/.exec(res.err);
      assert.ok(m, 'elapsed printed');
      assert.ok(Number(m[1]) < 2000, 'backstop fired in ' + m[1] + ' ms');
    });

    await ta('(2) MINDRIAN_DERIVE_SKIP=1: the hook entry exits 0 in under 2 s, no lock, no queue change, no output', async () => {
      const room = makeRoom('room-skip', 3);
      const qFile = path.join(room, '.mindrian', 'graph-derive-queue.json');
      const before = fs.readFileSync(qFile, 'utf8');
      const t0 = Date.now();
      const res = spawnSync(process.execPath, [DRAIN, '--room', room], {
        encoding: 'utf8', timeout: 10000, env: scrubbedEnv({ MINDRIAN_DERIVE_SKIP: '1' }),
      });
      assert.equal(res.status, 0);
      assert.ok(Date.now() - t0 < 2000, 'under 2 s: ' + (Date.now() - t0));
      assert.equal(res.stdout + res.stderr, '', 'no output');
      assert.equal(fs.existsSync(path.join(room, '.mindrian', 'graph-derive-drain.lock')), false, 'no lock');
      assert.equal(fs.readFileSync(qFile, 'utf8'), before, 'queue unchanged');
      // The worker form honours the switch too.
      const w = spawnSync(process.execPath, [DRAIN, '--worker', '--room', room, '--report-usage'], {
        encoding: 'utf8', timeout: 10000, env: scrubbedEnv({ MINDRIAN_DERIVE_SKIP: '1', MOS_NO_DETACHED_DERIVE: '1' }),
      });
      assert.equal(w.status, 0);
      assert.equal(fs.readFileSync(qFile, 'utf8'), before, 'queue unchanged by the worker form');
    });

    t('(3) source fence: the caps sit in the worker branch, after the detach check', () => {
      const src = fs.readFileSync(DRAIN, 'utf8');
      const mainStart = src.indexOf('async function main()');
      assert.ok(mainStart !== -1);
      const mainSrc = src.slice(mainStart);
      const detach = mainSrc.indexOf("process.env.MOS_NO_DETACHED_DERIVE !== '1'");
      const lower = mainSrc.indexOf('lowerWorkerPriority(');
      const arm = mainSrc.indexOf('armBackstop(');
      const workerBranch = mainSrc.indexOf('if (args.worker)');
      assert.ok(detach !== -1 && lower !== -1 && arm !== -1 && workerBranch !== -1);
      assert.ok(lower > detach && arm > detach, 'the caps come after the detach check');
      assert.ok(workerBranch > detach && lower > workerBranch && arm > workerBranch, 'the caps are inside the worker branch');
      const hookPart = mainSrc.slice(0, detach);
      assert.equal(hookPart.indexOf('lowerWorkerPriority('), -1);
      assert.equal(hookPart.indexOf('armBackstop('), -1);
      assert.ok(src.indexOf('os.setPriority') !== -1);
      assert.ok(src.indexOf('PRIORITY_BELOW_NORMAL') !== -1 && src.indexOf('PRIORITY_LOW') !== -1);
      assert.ok(src.indexOf('.unref()') !== -1 || src.indexOf('.unref ') !== -1 || src.indexOf("t.unref") !== -1);
      assert.ok(src.indexOf('MINDRIAN_DERIVE_SKIP') !== -1);
      assert.ok(src.indexOf('process.cpuUsage') !== -1 && src.indexOf('process.resourceUsage') !== -1);
    });
  } finally {
    try { fs.rmSync(wtmp, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }


  assert.equal(netGuard.attempts(), 0, 'no network attempt');
  netGuard.restore();
  console.log('PASS: ' + pass + ' FAIL: ' + fail);
}

main().catch((e) => {
  process.exitCode = 1;
  console.log('FAIL - harness: ' + (e && e.stack ? e.stack : e));
});
