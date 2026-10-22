#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 379.1 gap closure plan 07: hermetic proof of the drain RSS probe
 * (tests/fixtures/379.1/probe-drain-rss.cjs): the arm table, the arithmetic, the result schema,
 * the environment scrub and the no-egress rule. No real encoder, no child process, no network.
 * Case 6 reads the live result file when it exists and skips when it does not.
 * Hyphens only.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const PROBE_FILE = path.join(REPO, 'tests', 'fixtures', '379.1', 'probe-drain-rss.cjs');
const RESULT_FILE = path.join(REPO, 'tests', 'fixtures', '379.1', 'probe-drain-rss.json');
const probe = require(PROBE_FILE);
const leg = require('../scripts/release-lib/large-room-leg.cjs');

const DASH = String.fromCharCode(0x2014);
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

function row(arm, rep, rss, extra) {
  return Object.assign({ arm: arm, rep: rep, ok: true, max_rss_mb: rss, clock_ms: 1000 * rss, cpu_ms: 500 * rss }, extra || {});
}

function goodResult() {
  const children = [
    row('D8', 1, 700), row('D8', 2, 710), row('D16', 1, 900), row('D16', 2, 920),
    row('D32', 1, 1800), row('D32', 2, 1840), row('E0', 1, 300), row('E32', 1, 1500), row('E32_ARENA_OFF', 1, 1200),
  ];
  const sum = probe.summarize(children, 1024);
  return {
    probe: 'drain-rss', probed_at: new Date().toISOString(), node_version: process.version, host_cores: 8,
    host_mem_total_mb: 8000, platform: process.platform, status: 'ok',
    params: { reps: 2, batches: [8, 16, 32], artifact_count: 2105, limit_mb: 1024 },
    arms: sum.arms, derived: sum.derived, children: children,
  };
}

console.log('379.1 drain RSS probe (plan 07)');

t('1 ARMS lists D8, D16, D32, E0, E32, E32_ARENA_OFF in order with kinds and batches', () => {
  assert.deepEqual(probe.ARMS.map((a) => a.name), ['D8', 'D16', 'D32', 'E0', 'E32', 'E32_ARENA_OFF']);
  assert.deepEqual(probe.ARMS.map((a) => a.kind), ['drain', 'drain', 'drain', 'embed_floor', 'embed', 'embed_arena_off']);
  assert.deepEqual(probe.ARMS.slice(0, 3).map((a) => a.batch), [8, 16, 32]);
  assert.equal(probe.ARMS[4].batch, 32);
  assert.equal(probe.ARMS[5].batch, 32);
});

t('2 summarize gives stats per arm and the derived facts', () => {
  const children = [
    row('D8', 1, 700), row('D8', 2, 710),
    row('D16', 1, 900), row('D16', 2, 920),
    row('D32', 1, 1800), row('D32', 2, 1840), row('D32', 3, 100, { ok: false }),
    row('E0', 1, 300), row('E32', 1, 1500), row('E32_ARENA_OFF', 1, 1200),
  ];
  const s = probe.summarize(children, 1024);
  assert.equal(s.arms.D8.rss_mb_min, 700);
  assert.equal(s.arms.D8.rss_mb_median, 705);
  assert.equal(s.arms.D8.rss_mb_max, 710);
  assert.equal(s.arms.D8.reps_ok, 2);
  assert.equal(s.arms.D8.under_limit, true);
  assert.equal(s.arms.D32.reps_run, 3);
  assert.equal(s.arms.D32.reps_ok, 2);
  assert.equal(s.arms.D32.rss_mb_max, 1840);
  assert.equal(s.arms.D32.under_limit, false);
  const d = s.derived;
  assert.equal(d.limit_mb, 1024);
  assert.equal(d.control_reproduced_breach, true);
  assert.deepEqual(d.batch_curve.map((c) => c.batch), [8, 16, 32]);
  assert.equal(d.largest_batch_under_limit, 16);
  assert.equal(d.encoder_floor_mb, 300);
  assert.equal(d.encoder_share_of_control, 0.82);
  assert.equal(d.arena_off_change_pct_vs_embed_only, -20);
  assert.ok(!('recommendation' in d));
  const empty = probe.summarize([row('D8', 1, 500)], 1024);
  assert.equal(empty.arms.D16.rss_mb_max, null);
  assert.equal(empty.arms.D16.rss_mb_median, null);
  assert.equal(empty.arms.D16.under_limit, null);
  assert.equal(empty.derived.encoder_share_of_control, null);
  assert.equal(empty.derived.arena_off_change_pct_vs_embed_only, null);
  assert.equal(empty.derived.largest_batch_under_limit, 8);
});

t('3 collect makes no child call without a model and arms x reps calls with one', () => {
  let calls = 0;
  const none = probe.collect({ modelCached: () => false, runChild: () => { calls += 1; return {}; } });
  assert.equal(calls, 0);
  assert.equal(none.status, 'encoder_unavailable');
  assert.deepEqual(none.children, []);
  const origWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = () => true;
  let got;
  try {
    got = probe.collect({ modelCached: () => true, reps: 2, arms: ['D8', 'E0', 'E32'], runChild: (n, r) => { calls += 1; return row(n, r, 100); } });
  } finally {
    process.stderr.write = origWrite;
  }
  assert.equal(calls, 6);
  assert.equal(got.children.length, 6);
  assert.equal(got.status, 'collected');
});

t('4 validateResult accepts a good result and rejects NaN, an unknown status and a path', () => {
  assert.deepEqual(probe.validateResult(goodResult()), []);
  const nan = goodResult();
  nan.params.limit_mb = NaN;
  assert.ok(probe.validateResult(nan).length > 0);
  const st = goodResult();
  st.status = 'weird';
  assert.ok(probe.validateResult(st).length > 0);
  const home = goodResult();
  home.children[0].note = path.join(os.homedir(), 'secret', 'room');
  assert.ok(probe.validateResult(home).length > 0);
  const tmp = goodResult();
  tmp.children[0].note = path.join(os.tmpdir(), 'mos-rss-probe-x');
  assert.ok(probe.validateResult(tmp).length > 0);
  const longStr = goodResult();
  longStr.children[0].note = 'x'.repeat(201);
  assert.ok(probe.validateResult(longStr).length > 0);
  const missing = goodResult();
  delete missing.derived;
  assert.ok(probe.validateResult(missing).length > 0);
});

t('5 the probe source has no network primitive or em-dash; the leg exports modelCachedLocally', () => {
  const src = fs.readFileSync(PROBE_FILE, 'utf8');
  const exec = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.ok(!/fetch\(|https?:\/\/|require\(['"]node:https?|\b(curl|wget)\b/.test(exec));
  assert.ok(!src.includes(DASH));
  assert.ok(!fs.readFileSync(__filename, 'utf8').includes(DASH));
  assert.equal(typeof leg.modelCachedLocally, 'function');
  assert.equal(leg.DEFAULT_LIMITS.rss_mb, 1024);
});

t('6 the live result file, when present, is valid and measured D8, D16 and D32', () => {
  if (!fs.existsSync(RESULT_FILE)) {
    console.log('  SKIP - no probe-drain-rss.json yet');
    return;
  }
  const j = JSON.parse(fs.readFileSync(RESULT_FILE, 'utf8'));
  assert.deepEqual(probe.validateResult(j), []);
  ['D8', 'D16', 'D32'].forEach((n) => {
    assert.ok(j.arms[n] && j.arms[n].reps_ok >= 1, n + ' has no good run');
  });
});

t('7 scrubEnv removes the probe variables, keeps the rest, does not mutate the input', () => {
  const env = {
    PATH: '/usr/bin', HOME: '/home/x', MINDRIAN_EMBED_BATCH: '8', MINDRIAN_EMBED_THREADS: '4', MINDRIAN_EMBED_CPU_ARENA: '0',
    MINDRIAN_LARGE_ROOM_RSS_MB: '9999', MINDRIAN_LARGE_ROOM_CLOCK_MS: '1', MINDRIAN_OTHER: 'keep',
  };
  const copy = Object.assign({}, env);
  const out = probe.scrubEnv(env);
  assert.deepEqual(env, copy);
  assert.deepEqual(Object.keys(out).sort(), ['HOME', 'MINDRIAN_OTHER', 'PATH']);
  assert.equal(out.PATH, '/usr/bin');
  assert.equal(out.HOME, '/home/x');
  assert.notEqual(out, env);
});

console.log('rss-probe: PASS ' + pass + ' FAIL ' + fail);
if (fail > 0) process.exit(1);
