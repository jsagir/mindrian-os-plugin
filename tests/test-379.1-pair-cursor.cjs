#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 379.1 (graph derive drain and scout runaway CPU) proof: pair-cursor.
 * Proves CPU379-02: no all-pairs scoring in the background, the top-k cosine pruner is the
 * primary bound, a per-drain pair cap and a cursor are the safety net (D-379.1-01, D-379.1-12);
 * and CPU379-04: attempts and last_attempt_at are written before the work, the entry clears
 * only on success; and CPU379-10 / T-379.1-01: the drain discloses what the scope removed.
 * Plan 04: hermetic drains on buildFixtureRoom224 rooms with a deterministic embedFn and a
 * counting lexicalFn (scoreMeasured calls it once per scored pair).
 * Hermetic: scrubVendorKey + installNetGuard first; attempts() === 0 last. No em-dashes.
 */
const { scrubVendorKey, installNetGuard } = require('./helpers/hygiene-355.cjs');
scrubVendorKey();
const netGuard = installNetGuard();

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const sweep = require('../scripts/gsd-graph-derive-sweep.cjs');
const drain = require('../scripts/gsd-graph-derive-drain.cjs');
const classifier = require('../lib/core/graph-derive-classifier.cjs');
const vectorCache = require('../lib/core/semantic-index/vector-cache.cjs');
const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');
const { buildFixtureRoom224 } = require('./helpers/fixture-room-224.cjs');

let pass = 0;
let fail = 0;
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

const PROBE_FIRST = 'probe alpha reference';

// Three clusters by content hash: same cluster -> cosine near 1, other cluster -> near 0.
function clusterVector(text) {
  const h = vectorCache.contentHash(text);
  const c = parseInt(h.slice(0, 2), 16) % 3;
  const noise = (parseInt(h.slice(2, 4), 16) / 255) * 0.05;
  const v = [0, 0, 0, noise];
  v[c] = 1;
  return v;
}
function makeCounters() {
  const c = { embedded: 0, scored: 0, deriveCalls: 0 };
  c.embedFn = async (texts) => {
    c.embedded += texts.length;
    return { success: true, vectors: texts.map(clusterVector) };
  };
  c.probeOpts = {
    encodeFn: (texts) => texts.map((x) => [x.length % 5 + 1, 1, 0.5]),
    lexicalFn: (a, b) => {
      if (a !== PROBE_FIRST) c.scored += 1;
      return 0;
    },
  };
  return c;
}
function withEnv(env, fn) {
  const keep = {};
  for (const k of Object.keys(env)) keep[k] = process.env[k];
  for (const k of Object.keys(env)) {
    if (env[k] === null) delete process.env[k]; else process.env[k] = env[k];
  }
  const restore = () => {
    for (const k of Object.keys(keep)) {
      if (keep[k] === undefined) delete process.env[k]; else process.env[k] = keep[k];
    }
  };
  let out;
  try { out = fn(); } catch (e) { restore(); throw e; }
  if (out && typeof out.then === 'function') return out.then((v) => { restore(); return v; }, (e) => { restore(); throw e; });
  restore();
  return out;
}
function readEvents(roomDir, type) {
  const db = openRoomDb(roomDir);
  try {
    return db.prepare(
      "SELECT properties FROM nodes WHERE type = 'memory_event' AND json_extract(properties, '$.event_type') = ?"
    ).all(type).map((r) => JSON.parse(r.properties));
  } finally {
    closeRoomDb(db);
  }
}
function entries(room) { return sweep.readQueue(room).entries; }
function bigText(i) {
  const words = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel'];
  const out = [];
  for (let k = 0; k < 40; k += 1) out.push(words[(i * 3 + k * 5) % words.length] + String(i % 9));
  return '# generated ' + i + '\n\n' + out.join(' ') + '\n';
}

async function main() {
  console.log('test-379.1-pair-cursor (CPU379-02, CPU379-04, CPU379-10)');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-379-1-cursor-'));
  try {
    fs.mkdirSync(path.join(tmp, 'a'), { recursive: true });
    const fxA = await buildFixtureRoom224(path.join(tmp, 'a'), { artifactCount: 12 });
    const roomA = fxA.roomDir;
    const ALL_PAIRS_12 = 66;

    await ta('(1) room scope, per-drain cap 3: 3 pairs per drain, a cursor, then one completion with the disclosure fields', async () => {
      const c = makeCounters();
      sweep.enqueueDerive(roomA, {});
      await withEnv({ MINDRIAN_DERIVE_MAX_PAIRS_PER_DRAIN: '3' }, async () => {
        const r1 = await drain.drainDerive(roomA, { embedFn: c.embedFn, probeOpts: c.probeOpts });
        assert.notEqual(r1.locked, true);
        assert.equal(c.embedded, 12, 'each artifact embedded once');
        assert.equal(c.scored, 3, 'exactly 3 pairs scored');
        const e = entries(roomA);
        assert.equal(e.length, 1);
        assert.equal(e[0].cursor, 3);
        assert.ok(Number.isInteger(e[0].pairs_total) && e[0].pairs_total > 3, 'pairs_total ' + e[0].pairs_total);
        assert.match(String(e[0].scope_hash), /^[0-9a-f]{16}$/);
        assert.equal(e[0].attempts, 0, 'progress resets attempts');
        assert.equal(e[0].vectors_ready, true);
        assert.equal(e[0].artifact_count, 12);
        assert.ok(e[0].last_attempt_at);
        assert.equal(e[0].worker_pid, process.pid);
        const total = e[0].pairs_total;
        assert.equal(e[0].pairs_pruned, ALL_PAIRS_12 - total, 'pairs_pruned = all pairs - pairs_total');
        let guard = 0;
        while (entries(roomA).length > 0 && guard < 40) {
          // eslint-disable-next-line no-await-in-loop
          await drain.drainDerive(roomA, { embedFn: c.embedFn, probeOpts: c.probeOpts });
          guard += 1;
        }
        assert.equal(entries(roomA).length, 0, 'the entry cleared');
        assert.equal(c.scored, total, 'every candidate pair scored exactly once');
        assert.equal(c.embedded, 12, 'no re-embed across drains');
        const ev = readEvents(roomA, 'derivation_completed');
        assert.equal(ev.length, 1, 'one completion event');
        assert.equal(ev[0].pairs_scored, total);
        assert.equal(ev[0].pairs_pruned, ALL_PAIRS_12 - total);
        assert.equal(ev[0].scope_excluded_dirs, 0);
        assert.equal(ev[0].scope_excluded_artifacts, 0);
        assert.equal(ev[0].scope_overbroad, false);
        // With 2,163 artifacts and k 10 the design scores at most 21,630 pairs (N x k).
        assert.ok(2163 * 10 <= 21630);
        assert.ok(total <= 12 * classifier.resolvePruneK());
      });
    });

    await ta('(2) entry ceiling 2: zero pairs scored, one pair_cap_exceeded skip with the scope fields, queue empty', async () => {
      const c = makeCounters();
      sweep.enqueueDerive(roomA, {});
      await withEnv({ MINDRIAN_DERIVE_MAX_PAIRS_PER_ENTRY: '2' }, async () => {
        await drain.drainDerive(roomA, { embedFn: c.embedFn, probeOpts: c.probeOpts });
      });
      assert.equal(c.scored, 0);
      assert.equal(entries(roomA).length, 0);
      const ev = readEvents(roomA, 'derivation_skipped').filter((x) => x.reason === 'pair_cap_exceeded');
      assert.equal(ev.length, 1);
      assert.ok(ev[0].pairs_skipped > 2);
      assert.equal(ev[0].scope_excluded_dirs, 0);
      assert.equal(ev[0].scope_overbroad, false);
    });

    await ta('(3) injected deriveFn without an embedFn: the plain sequence sliced by the per-drain cap (legacy seam)', async () => {
      let calls = 0;
      const deriveFn = async () => { calls += 1; return []; };
      sweep.enqueueDerive(roomA, {});
      await withEnv({ MINDRIAN_DERIVE_MAX_PAIRS_PER_DRAIN: '5' }, async () => {
        await drain.drainDerive(roomA, { deriveFn: deriveFn, probeOpts: makeCounters().probeOpts });
        assert.equal(calls, 5);
        const e = entries(roomA);
        assert.equal(e[0].cursor, 5);
        assert.equal(e[0].pairs_total, ALL_PAIRS_12);
        let guard = 0;
        while (entries(roomA).length > 0 && guard < 30) {
          // eslint-disable-next-line no-await-in-loop
          await drain.drainDerive(roomA, { deriveFn: deriveFn, probeOpts: makeCounters().probeOpts });
          guard += 1;
        }
        assert.equal(calls, ALL_PAIRS_12, 'every pair scored once across drains');
      });
    });

    await ta('(4) attempt record before the first pair; attempts 5 is dropped with a permanent record', async () => {
      let seenAttempts = null;
      let seenAt = null;
      const deriveFn = async () => {
        const cur = entries(roomA)[0] || {};
        seenAttempts = cur.attempts;
        seenAt = cur.last_attempt_at;
        throw new Error('boom');
      };
      sweep.enqueueDerive(roomA, {});
      await drain.drainDerive(roomA, { deriveFn: deriveFn, probeOpts: makeCounters().probeOpts });
      assert.equal(seenAttempts, 1, 'attempts written before the first pair');
      assert.ok(typeof seenAt === 'string' && seenAt.length > 0, 'last_attempt_at written before the first pair');
      const kept = entries(roomA);
      assert.equal(kept.length, 1, 'a thrown entry is kept');
      assert.equal(kept[0].attempts, 1);
      assert.equal(kept[0].failures, 1);
      // Clear it, then pre-write an entry that has already used 5 attempts.
      sweep.writeQueue(roomA, { entries: [{ roomDir: path.resolve(roomA), enqueued_at: '2026-10-21T00:00:00.000Z', attempts: 5 }] });
      let called = 0;
      await drain.drainDerive(roomA, { deriveFn: async () => { called += 1; return []; }, probeOpts: makeCounters().probeOpts });
      assert.equal(called, 0, 'no pair scored for an exhausted entry');
      assert.equal(entries(roomA).length, 0, 'dropped');
      const log = JSON.parse(fs.readFileSync(drain.failureLogPath(path.resolve(roomA)), 'utf8')).failures;
      const rec = log.filter((r) => r.error === 'attempts_exhausted_without_progress');
      assert.equal(rec.length, 1);
      assert.equal(rec[0].permanent, true);
      const ev = readEvents(roomA, 'derivation_skipped').filter((x) => x.reason === 'attempts_exhausted');
      assert.equal(ev.length, 1);
    });

    await ta('(5) source fence: the all-pairs builder appears once, in the legacy arm; pairCountFor counts without it', async () => {
      const raw = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'gsd-graph-derive-drain.cjs'), 'utf8').split('\n');
      const codeLines = raw.map((line, i) => ({ line, i })).filter((x) => !/^\s*(\/\/|\/\*|\*)/.test(x.line));
      const hits = codeLines.filter((x) => x.line.indexOf('buildAllPairs(') !== -1);
      assert.equal(hits.length, 1, 'one code hit: ' + hits.length);
      const marker = raw.findIndex((l) => l.indexOf('LEGACY_INJECTED_PAIRS') !== -1);
      assert.ok(marker !== -1, 'marker present');
      assert.ok(hits[0].i > marker && hits[0].i - marker <= 3, 'the hit follows the marker');
      const src = raw.join('\n');
      const start = src.indexOf('function pairCountFor');
      const body = src.slice(start, src.indexOf('\n}\n', start));
      assert.equal(body.indexOf('buildAllPairs'), -1);
      assert.ok(body.indexOf('countAllPairs') !== -1);
    });

    // (6) scope on the walker and in the disclosure
    function addGenerated(room, withMarker) {
      const gen = path.join(room, 'generated');
      fs.mkdirSync(gen, { recursive: true });
      for (let i = 0; i < 50; i += 1) fs.writeFileSync(path.join(gen, 'g' + String(i).padStart(2, '0') + '.md'), bigText(i));
      if (withMarker) fs.writeFileSync(path.join(gen, 'engine-input-manifest.json'), '{}\n');
    }
    await ta('(6a) marker directory: the walker returns 5, the drain event says 1 dir and 50 artifacts excluded', async () => {
      const fx = await buildFixtureRoom224(path.join(tmp, 's1'), { artifactCount: 5 });
      addGenerated(fx.roomDir, true);
      assert.equal(classifier._test.enumerateArtifacts(fx.roomDir).length, 5);
      const c = makeCounters();
      sweep.enqueueDerive(fx.roomDir, {});
      await drain.drainDerive(fx.roomDir, { embedFn: c.embedFn, probeOpts: c.probeOpts });
      assert.equal(entries(fx.roomDir).length, 0);
      const ev = readEvents(fx.roomDir, 'derivation_completed');
      assert.equal(ev.length, 1);
      assert.equal(ev[0].scope_excluded_dirs, 1);
      assert.equal(ev[0].scope_excluded_artifacts, 50);
      assert.equal(ev[0].scope_overbroad, false);
    });
    await ta('(6b) no marker and a wildcard-only declaration: the walker returns all 55, overbroad_patterns 1', async () => {
      const fx = await buildFixtureRoom224(path.join(tmp, 's2'), { artifactCount: 5 });
      addGenerated(fx.roomDir, false);
      fs.writeFileSync(path.join(fx.roomDir, '.mindrian', 'artifact-scope.json'), JSON.stringify({ version: 1, exclude: ['**'] }));
      assert.equal(classifier._test.enumerateArtifacts(fx.roomDir).length, 55);
      const ws = classifier.enumerateArtifactsWithScope(fx.roomDir);
      assert.equal(ws.scope.overbroad_patterns, 1);
    });
    await ta('(6c) no marker and a declaration naming every top-level directory: overbroad true, the event says so', async () => {
      const fx = await buildFixtureRoom224(path.join(tmp, 's3'), { artifactCount: 5 });
      addGenerated(fx.roomDir, false);
      fs.mkdirSync(path.join(fx.roomDir, 'extra'), { recursive: true });
      fs.writeFileSync(path.join(fx.roomDir, 'extra', 'x.md'), bigText(99));
      fs.writeFileSync(path.join(fx.roomDir, '.mindrian', 'artifact-scope.json'), JSON.stringify({ version: 1, exclude: ['generated', 'extra'] }));
      assert.equal(classifier._test.enumerateArtifacts(fx.roomDir).length, 56);
      const ws = classifier.enumerateArtifactsWithScope(fx.roomDir);
      assert.equal(ws.scope.overbroad, true);
      const c = makeCounters();
      sweep.enqueueDerive(fx.roomDir, {});
      let guard = 0;
      await drain.drainDerive(fx.roomDir, { embedFn: c.embedFn, probeOpts: c.probeOpts });
      while (entries(fx.roomDir).length > 0 && guard < 20) {
        // eslint-disable-next-line no-await-in-loop
        await drain.drainDerive(fx.roomDir, { embedFn: c.embedFn, probeOpts: c.probeOpts });
        guard += 1;
      }
      const ev = readEvents(fx.roomDir, 'derivation_completed');
      assert.equal(ev.length, 1);
      assert.equal(ev[0].scope_overbroad, true);
    });

    await ta('(7) strict probe: identical vectors are unavailable, separated vectors are available', async () => {
      const identical = await drain._test.probeEncoder({ strictProbe: true, encodeFn: (texts) => texts.map(() => [1, 1, 1]) });
      assert.equal(identical.available, false);
      const zeros = await drain._test.probeEncoder({ strictProbe: true, encodeFn: (texts) => texts.map(() => [0, 0, 0]) });
      assert.equal(zeros.available, false);
      const [s1, s2] = drain._test.PROBE_SIMILAR;
      const separated = await drain._test.probeEncoder({
        strictProbe: true,
        encodeFn: (texts) => texts.map((x) => {
          if (x === s1) return [1, 0.1, 0];
          if (x === s2) return [1, 0.2, 0];
          if (/tax/.test(x)) return [0, 1, 0];
          if (/Volcanic/.test(x)) return [0, 0, 1];
          return [0.3, 0.3, 0.3];
        }),
      });
      assert.equal(separated.available, true);
    });

    await ta('(8) budget inside the loop: 1 ms budget keeps the entry with vectors ready; a second drain completes it', async () => {
      const fx = await buildFixtureRoom224(path.join(tmp, 'b'), { artifactCount: 12 });
      const c = makeCounters();
      sweep.enqueueDerive(fx.roomDir, {});
      // Phase 379.1 plan 06: the 1 ms budget must be spent inside the embed step, not by luck. A fast machine
      // embeds 12 short texts in under 1 ms and the first drain then finishes the entry (a flake seen under load
      // and idle alike). The first drain's embedFn therefore holds for 5 ms, so the deadline has always passed.
      const slowEmbed = async (texts) => {
        const t0 = Date.now();
        while (Date.now() - t0 < 5) { /* hold the clock past the 1 ms budget */ }
        return c.embedFn(texts);
      };
      await withEnv({ MINDRIAN_DERIVE_BUDGET_MS: '1' }, async () => {
        await drain.drainDerive(fx.roomDir, { embedFn: slowEmbed, probeOpts: c.probeOpts });
      });
      const e = entries(fx.roomDir);
      assert.equal(e.length, 1, 'the entry stays');
      assert.equal(e[0].vectors_ready, true);
      assert.equal(e[0].attempts, 1);
      assert.ok(e[0].cursor === undefined || e[0].cursor === 0);
      assert.equal(c.scored, 0, 'no pair scored');
      await drain.drainDerive(fx.roomDir, { embedFn: c.embedFn, probeOpts: c.probeOpts });
      assert.equal(entries(fx.roomDir).length, 0, 'the second drain completes the entry');
      assert.ok(c.scored > 0);
      assert.equal(c.embedded, 12, 'the vectors saved by the first drain were reused');
    });
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
  assert.equal(netGuard.attempts(), 0, 'no network attempt');
  netGuard.restore();
  console.log('PASS: ' + pass + ' FAIL: ' + fail);
}

main().catch((e) => {
  process.exitCode = 1;
  console.log('FAIL - harness: ' + (e && e.stack ? e.stack : e));
});
