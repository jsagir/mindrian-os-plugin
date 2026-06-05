'use strict';
// RETR-04 (Phase 141) -- per-turn assembly latency budget.
//
// Builds the populated fixture room.db, times getRoomContext over it, and asserts
// the assembly completes under 1200ms (the NAV_HARD_TIMEOUT_MS envelope at
// scripts/intent-classifier.cjs:635). RED now: navigation.getRoomContext is not
// yet exported, so the function-presence assertion fails before timing runs.
//
// Caller-owned fixture db. Never opens a real room.db. House rule: hyphens only,
// no em-dashes.

const assert = require('node:assert/strict');
const path = require('node:path');

let buildFixtureDb;
try {
  ({ buildFixtureDb } = require(path.join(__dirname, 'fixtures', 'room-141-fixture.cjs')));
} catch (e) {
  process.stdout.write('SKIP test-room-context-latency.cjs (fixture unavailable: ' + e.message + ')\n');
  process.exit(77);
}

const navigation = require(path.join(__dirname, '..', 'lib', 'core', 'navigation.cjs'));

const BUDGET_MS = 1200;

async function main() {
  assert.equal(
    typeof navigation.getRoomContext, 'function',
    'navigation.getRoomContext must be exported (RED until Wave-1 room-context.cjs lands)'
  );

  const db = buildFixtureDb();
  try {
    // One warm call (ignore) then a measured call -- mirror a steady per-turn hit.
    await navigation.getRoomContext(db, 'fixture', { topK: 10, fragmentWindow: 6, maxDepth: 2 });

    const start = process.hrtime.bigint();
    await navigation.getRoomContext(db, 'fixture', { topK: 10, fragmentWindow: 6, maxDepth: 2 });
    const end = process.hrtime.bigint();

    const elapsedMs = Number(end - start) / 1e6;
    assert.ok(
      elapsedMs < BUDGET_MS,
      'RETR-04: getRoomContext assembly must complete under ' + BUDGET_MS + 'ms (was ' + elapsedMs.toFixed(1) + 'ms)'
    );
    process.stdout.write('PASS test-room-context-latency.cjs (RETR-04 ' + elapsedMs.toFixed(1) + 'ms < ' + BUDGET_MS + 'ms)\n');
  } finally {
    db.close();
  }
}

main().catch((err) => {
  process.stderr.write('FAIL test-room-context-latency.cjs: ' + (err && err.message ? err.message : String(err)) + '\n');
  process.exit(1);
});
