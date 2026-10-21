#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 379.1 Wave 0 (plan 01, Task 1): the large-room fixture builder proof.
 * Requirements: CPU379-08 (a fixture with more than 2,000 artifacts), decision D-379.1-02.
 *
 * Proves tests/fixtures/large-room/build-fixture.cjs:
 *   1. writes more than 2,000 markdown files under a tmp target
 *   2. writes GENERATED_DIR/engine-input-room
 *   3. the withManifest variant writes engine-input-manifest.json
 *   4. refuses a target under ~/MindrianRooms (threat T-379.1-08)
 *   5. is deterministic: a second build gives byte-identical gen-0001.md and gen-2100.md
 * Hermetic: scrubVendorKey + installNetGuard first, tmp dir removed in finally, attempts() === 0 last.
 * Plan 06 adds the release-leg assertions (large_room_leg): the limit logic on synthetic legs, a smoke
 * run through runLargeRoomLeg, and the --large-room-only --smoke CLI. The hermetic run points
 * MINDRIAN_MODEL_CACHE at an empty directory, so the drain child is never started and no model is
 * loaded or downloaded: the expected hermetic status is inconclusive (encoder_unavailable). Set
 * MINDRIAN_LIVE_ENCODER=1 to run the real encoder in the smoke leg.
 * No em-dashes. Hyphens only.
 */
const { scrubVendorKey, installNetGuard } = require('./helpers/hygiene-355.cjs');
scrubVendorKey();
const netGuard = installNetGuard();

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const builder = require('./fixtures/large-room/build-fixture.cjs');
const leg = require('../scripts/release-lib/large-room-leg.cjs');
const cp = require('node:child_process');

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

function countMd(dir) {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) n += countMd(abs);
    else if (e.isFile() && e.name.endsWith('.md')) n += 1;
  }
  return n;
}

function main() {
  console.log('test-379.1-large-fixture (CPU379-08 run-time builder)');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-379-large-'));
  try {
    const first = builder.buildLargeRoom(path.join(tmp, 'a'), { slug: 'large-a' });
    const written = countMd(first.roomDir);
    console.log('  written markdown files: ' + written + ' (artifacts reported: ' + first.artifacts + ')');

    t('the builder wrote more than 2,000 markdown files', () => {
      assert.ok(written > 2000, 'written ' + written);
      assert.ok(first.artifacts > 2000, 'artifacts ' + first.artifacts);
      assert.equal(first.artifacts, builder.GENERATED_COUNT + 5);
    });
    t('GENERATED_DIR/engine-input-room exists under the room', () => {
      const inputDir = path.join(first.roomDir, builder.GENERATED_DIR, 'engine-input-room');
      assert.ok(fs.existsSync(inputDir), inputDir);
      assert.equal(first.generatedDir, path.join(first.roomDir, builder.GENERATED_DIR));
      assert.ok(!fs.existsSync(path.join(first.generatedDir, 'engine-input-manifest.json')), 'no manifest without the option');
    });
    t('every generated body is between 400 and 800 characters (above MIN_BODY_CHARS)', () => {
      for (const i of [1, 2, 777, 1500, 2100]) {
        const body = fs.readFileSync(path.join(first.generatedDir, 'engine-input-room', 'gen-' + String(i).padStart(4, '0') + '.md'), 'utf8');
        assert.ok(body.length >= 400 && body.length <= 800, 'gen-' + i + ' length ' + body.length);
      }
    });
    t('the withManifest variant writes engine-input-manifest.json', () => {
      const second = builder.buildLargeRoom(path.join(tmp, 'b'), { slug: 'large-b', withManifest: true });
      const manifestPath = path.join(second.generatedDir, 'engine-input-manifest.json');
      assert.ok(fs.existsSync(manifestPath), manifestPath);
      const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      assert.equal(typeof m.source, 'string');
      assert.equal(m.engine_input_room, 'engine-input-room');
      assert.equal(m.n_records, builder.GENERATED_COUNT);
      assert.deepEqual(m.records, []);
    });
    t('a target under ~/MindrianRooms is refused before any write', () => {
      const forbidden = path.join(os.homedir(), 'MindrianRooms', 'mos-379-must-refuse');
      assert.throws(() => builder.buildLargeRoom(forbidden, { slug: 'refused' }), /refusing a target under/);
      assert.ok(!fs.existsSync(forbidden), 'nothing was written under the real rooms home');
    });
    t('a second build with the same inputs is byte-identical (gen-0001.md, gen-2100.md)', () => {
      const again = builder.buildLargeRoom(path.join(tmp, 'c'), { slug: 'large-a' });
      for (const name of ['gen-0001.md', 'gen-2100.md']) {
        const x = fs.readFileSync(path.join(first.generatedDir, 'engine-input-room', name));
        const y = fs.readFileSync(path.join(again.generatedDir, 'engine-input-room', name));
        assert.ok(x.equals(y), name + ' differs between builds');
      }
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  legAssertions();
  t('no network attempt was made', () => {
    assert.equal(netGuard.attempts(), 0);
  });
  netGuard.restore();
  console.log('PASS: ' + pass + ' FAIL: ' + fail);
}

// -- Plan 06: the release leg (large_room_leg) ------------------------------------------------------------
function synthetic(over) {
  const base = {
    drain: { clock_ms: 1000, cpu_ms: 2000, max_rss_mb: 300, outcome: 'bounded_progress' },
    scout: { clock_ms: 800, cpu_ms: 900, max_rss_mb: 200, degraded: 'artifact_cap_exceeded' },
    scope: { ok: true },
  };
  return Object.assign({}, base, over || {});
}

function legAssertions() {
  const limits = { clock_ms: 300000, cpu_ms: 600000, rss_mb: 1024 };
  t('evaluateLeg: all in bounds is ok', () => {
    const v = leg.evaluateLeg(synthetic(), limits);
    assert.equal(v.status, 'ok');
    assert.equal(v.ok, true);
    assert.equal(v.first_not_ok, null);
    assert.equal(v.drain.within_limits, true);
    assert.equal(v.scout.within_limits, true);
  });
  t('evaluateLeg: drain CPU above the limit is a breach naming drain.cpu_ms', () => {
    const v = leg.evaluateLeg(synthetic({ drain: { clock_ms: 1000, cpu_ms: 600001, max_rss_mb: 300, outcome: 'bounded_progress' } }), limits);
    assert.equal(v.drain.within_limits, false);
    assert.equal(v.status, 'breach');
    assert.equal(v.first_not_ok, 'drain.cpu_ms');
  });
  t('evaluateLeg: scout peak RSS above the limit is a breach naming scout.max_rss_mb', () => {
    const v = leg.evaluateLeg(synthetic({ scout: { clock_ms: 800, cpu_ms: 900, max_rss_mb: 1025, degraded: 'artifact_cap_exceeded' } }), limits);
    assert.equal(v.scout.within_limits, false);
    assert.equal(v.status, 'breach');
    assert.equal(v.first_not_ok, 'scout.max_rss_mb');
  });
  t('evaluateLeg: a drain timeout is a breach', () => {
    const v = leg.evaluateLeg(synthetic({ drain: { clock_ms: 330000, cpu_ms: 1, max_rss_mb: 1, outcome: 'timeout' } }), limits);
    assert.equal(v.status, 'breach');
    assert.equal(v.ok, false);
  });
  t('evaluateLeg: an unavailable encoder with everything else in bounds is inconclusive', () => {
    const v = leg.evaluateLeg(synthetic({ drain: { clock_ms: 0, cpu_ms: 0, max_rss_mb: 0, outcome: 'encoder_unavailable' } }), limits);
    assert.equal(v.status, 'inconclusive');
    assert.equal(v.ok, false);
  });
  t('evaluateLeg: a scout that is not the cap envelope, or a scope mismatch, is a breach', () => {
    assert.equal(leg.evaluateLeg(synthetic({ scout: { clock_ms: 1, cpu_ms: 1, max_rss_mb: 1, degraded: null } }), limits).status, 'breach');
    assert.equal(leg.evaluateLeg(synthetic({ scope: { ok: false } }), limits).status, 'breach');
  });
  t('evaluateLeg: an error is status error', () => {
    assert.equal(leg.evaluateLeg({ error: 'x'.repeat(500) }, limits).status, 'error');
  });
  t('DEFAULT_LIMITS and the leg exports exist', () => {
    assert.deepEqual(Object.keys(leg.DEFAULT_LIMITS).sort(), ['clock_ms', 'cpu_ms', 'rss_mb']);
    assert.equal(typeof leg.runLargeRoomLeg, 'function');
    assert.equal(typeof leg.formatLargeRoomBlock, 'function');
  });

  // The hermetic env has no usable model cache: an empty directory keeps the drain child from starting.
  const live = process.env.MINDRIAN_LIVE_ENCODER === '1';
  const emptyCache = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-379-empty-cache-'));
  const savedCache = process.env.MINDRIAN_MODEL_CACHE;
  if (!live) process.env.MINDRIAN_MODEL_CACHE = emptyCache;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-379-leg-'));
  try {
    let res = null;
    t('a smoke leg returns smoke true, a hermetic status, the cap envelope and the scope counts', () => {
      res = leg.runLargeRoomLeg({ sha: 'test', scratch: tmp, smoke: true, limits: { clock_ms: 120000, cpu_ms: 240000, rss_mb: 2048 } });
      assert.equal(res.smoke, true);
      assert.ok(['ok', 'inconclusive'].indexOf(res.status) !== -1, 'status ' + res.status + ' first_not_ok ' + res.first_not_ok);
      if (!live) assert.equal(res.drain.outcome, 'encoder_unavailable');
      assert.equal(res.scout.degraded, 'artifact_cap_exceeded');
      assert.ok(typeof res.scout.max_rss_mb === 'number' && res.scout.max_rss_mb > 0, 'scout rss ' + res.scout.max_rss_mb);
      assert.equal(res.scope.ok, true);
      assert.equal(res.scope.excluded_artifacts, 2100);
      assert.equal(res.scope.with_manifest_classifier, 5);
      assert.equal(res.scope.with_manifest_rs_engine, 5);
      assert.ok(res.artifact_count > 2000);
    });
    t('the result carries no path string', () => {
      assert.ok(res, 'no result');
      const text = JSON.stringify(res);
      assert.ok(text.indexOf(tmp) === -1, 'scratch path in the result');
      assert.ok(text.indexOf(os.tmpdir()) === -1, 'tmp path in the result');
      assert.ok(text.indexOf(path.sep + 'home' + path.sep) === -1, 'home path in the result');
    });
    t('formatLargeRoomBlock names the leg, smoke mode and has no dash character', () => {
      const block = leg.formatLargeRoomBlock(res);
      assert.ok(block.indexOf('== Large room leg ==') === 0);
      assert.ok(block.indexOf('Smoke mode') !== -1);
      assert.ok(/It tried:/.test(block) && /It got:/.test(block) && /It could not:/.test(block));
      assert.ok(!/[\u2013\u2014]/.test(block));
    });
    t('real-room-run.cjs --large-room-only --smoke --json exits 0 and prints large_room_leg', () => {
      const r = cp.spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'real-room-run.cjs'), '--large-room-only', '--smoke', '--json'], {
        encoding: 'utf8', timeout: 240000, maxBuffer: 32 * 1024 * 1024, env: process.env,
      });
      assert.equal(r.status, 0, 'exit ' + r.status + ' stderr ' + String(r.stderr).slice(-300));
      const lines = String(r.stdout).trim().split('\n');
      const j = JSON.parse(lines[lines.length - 1]);
      assert.ok(j.large_room_leg && typeof j.large_room_leg.status === 'string');
      assert.equal(j.large_room_leg.smoke, true);
      assert.equal(j.large_room_leg.scope.excluded_artifacts, 2100);
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(emptyCache, { recursive: true, force: true });
    if (savedCache === undefined) delete process.env.MINDRIAN_MODEL_CACHE; else process.env.MINDRIAN_MODEL_CACHE = savedCache;
  }
}

main();
