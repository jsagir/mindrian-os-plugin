'use strict';
// Phase 109-04 test: 10K-node neighborhood query latency. NAV-109-02 perf bound.
// Skipped in CI when SKIP_PERF=1 is set.

const { ok } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

if (process.env.SKIP_PERF === '1') {
  process.stdout.write('test-navigation-perf-10k: SKIPPED (SKIP_PERF=1)\n');
  process.exit(0);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { generatePerfRoom } = require(path.join(REPO_ROOT, 'tests', 'fixtures', 'phase-109', 'generate-perf-room.cjs'));

const COLD_BUDGET_MS = 200;
const WARM_P95_BUDGET_MS = 50;
const MEMORY_BUDGET_MB = 200;
const NODE_COUNT = 10000;

function p95(arr) {
  const sorted = arr.slice().sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return sorted[idx];
}

function run() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-109-perf-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  try {
    // openRoomDb runs migrations so generatePerfRoom sees the 12-column schema.
    const db = openRoomDb(tmp);
    db.close();
    // Generate 10K-node room directly into the migrated db.
    generatePerfRoom(NODE_COUNT, path.join(tmp, '.mindrian', 'room.db'));

    const dbWarm = openRoomDb(tmp);
    // Pick a node that exists; the generator uses ids of pattern '<type>:perf-NNNNNN'.
    const sampleRow = dbWarm.prepare("SELECT id FROM nodes WHERE id LIKE 'claim:perf-%' LIMIT 1").get();
    ok(sampleRow && sampleRow.id, 'generator produced a claim node');
    const sampleId = sampleRow.id;

    // COLD: first call after open.
    const t0 = process.hrtime.bigint();
    navigation.getNeighborhood(dbWarm, sampleId, { maxDepth: 2, topK: 20 });
    const coldMs = Number(process.hrtime.bigint() - t0) / 1e6;
    ok(coldMs < COLD_BUDGET_MS, 'cold call ' + coldMs.toFixed(2) + 'ms exceeds budget ' + COLD_BUDGET_MS + 'ms');

    // WARM: 100 successive calls; track p95.
    const samples = [];
    for (let i = 0; i < 100; i++) {
      const ti = process.hrtime.bigint();
      navigation.getNeighborhood(dbWarm, sampleId, { maxDepth: 2, topK: 20 });
      samples.push(Number(process.hrtime.bigint() - ti) / 1e6);
    }
    const warmP95 = p95(samples);
    ok(warmP95 < WARM_P95_BUDGET_MS, 'warm p95 ' + warmP95.toFixed(2) + 'ms exceeds budget ' + WARM_P95_BUDGET_MS + 'ms');

    // Memory: peak RSS during the run.
    const rssMb = process.memoryUsage().rss / (1024 * 1024);
    ok(rssMb < MEMORY_BUDGET_MB, 'RSS ' + rssMb.toFixed(2) + 'MB exceeds budget ' + MEMORY_BUDGET_MB + 'MB');

    dbWarm.close();
    process.stdout.write('test-navigation-perf-10k: PASS cold=' + coldMs.toFixed(2) + 'ms warm_p95=' + warmP95.toFixed(2) + 'ms rss=' + rssMb.toFixed(2) + 'MB\n');
    process.exit(0);
  } catch (err) {
    process.stderr.write('test-navigation-perf-10k: FAIL: ' + err.message + '\n' + err.stack + '\n');
    process.exit(1);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ }
  }
}

run();
