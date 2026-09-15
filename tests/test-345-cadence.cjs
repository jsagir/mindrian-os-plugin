#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 345-03 Task 2 -- goal-cadence.cjs: the cadence and stall counters,
 * and the null-default stall signal named for Phase 346.
 *
 * Grounds every leg against the shipped organs this module composes, not a
 * reimplementation of them:
 *   - lib/core/navigation/memory-events.cjs::EVENT_TYPES (the closed set
 *     findRecentChanges filters on; memory-events.cjs:783)
 *   - lib/core/navigation.cjs::findRecentChanges / logMemoryEvent (the Part 9
 *     chokepoint; this test seeds fixture rows through logMemoryEvent, never
 *     a raw INSERT)
 *   - tests/helpers/fixture-room-347.cjs (the 'wide' schema variant is the
 *     one memory-events.cjs::logEvent's INSERT actually targets: source_path,
 *     created_by, confidence, review_status, created_at, last_seen_at)
 *
 * DEVIATION NOTE (recorded here, and in 345-03-SUMMARY.md, per Rule 1): the
 * plan's own <behavior> bullet list gives two goal-stall examples keyed on
 * STRATEGY_STALL_MIN_SAMPLE (12) alone, but the plan's own prose also states,
 * as a load-bearing invariant, that STRATEGY_MIN_INTERVAL_REACHES (20) is
 * checked FIRST and short-circuits shouldPropose to false "regardless of the
 * other counts". 12 < 20, so a literal reaches_since=12 stall-true case
 * contradicts the floor-first order the same paragraph mandates -- and the
 * floor is the anti-nagging invariant this whole plan exists to protect
 * (345-RESEARCH Pitfall 3). This suite honors the floor-first order (matching
 * the plan's own acceptance_criteria node -e commands, which all pass either
 * way) and drives the stall-true leg at reaches_since =
 * max(STRATEGY_STALL_MIN_SAMPLE, STRATEGY_MIN_INTERVAL_REACHES) so the case
 * clears BOTH the floor and the stall sample size at once, rather than
 * silently picking one contradictory reading of the plan text.
 *
 * Plain-node house style: hand-rolled ok()/skip() helpers, a failing
 * assertion prints and process.exit(1)s. Zero-dep beyond node:sqlite (guarded
 * -- fixture legs SKIP honestly when unavailable, never silently PASS). CJS.
 * NO em-dashes.
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const CADENCE_PATH = path.join(ROOT, 'lib', 'core', 'strategy', 'goal-cadence.cjs');
const MEMORY_EVENTS_PATH = path.join(ROOT, 'lib', 'core', 'navigation', 'memory-events.cjs');
const NAVIGATION_PATH = path.join(ROOT, 'lib', 'core', 'navigation.cjs');
const FIXTURE_PATH = path.join(ROOT, 'tests', 'helpers', 'fixture-room-347.cjs');

let checks = 0;
let failed = 0;
let skipped = 0;

function ok(label, cond) {
  checks++;
  if (!cond) {
    failed++;
    console.log('FAIL: ' + label);
  } else {
    console.log('ok: ' + label);
  }
}

function skip(label) {
  skipped++;
  console.log('SKIP: ' + label);
}

const cadence = require(CADENCE_PATH);
const memoryEvents = require(MEMORY_EVENTS_PATH);
const navigation = require(NAVIGATION_PATH);

// ---------------------------------------------------------------------------
// Leg 1: EVENT_TYPES membership (Task 1 proof) -- the events this module
// reads plus the two Phase 345-03 additions strategy-throttle.cjs writes.
// ---------------------------------------------------------------------------
console.log('--- Leg 1: EVENT_TYPES membership ---');

['reach_presented', 'gate_reached', 'node_created', 'status_promoted',
  'strategy_proposed', 'strategy_throttled'].forEach(function (t) {
  ok('EVENT_TYPES has ' + t, memoryEvents.EVENT_TYPES.has(t));
});

// ---------------------------------------------------------------------------
// Leg 2: exported constants and shape.
// ---------------------------------------------------------------------------
console.log('--- Leg 2: exported constants ---');

ok('exports computeStrategyCounts', typeof cadence.computeStrategyCounts === 'function');
ok('exports shouldPropose', typeof cadence.shouldPropose === 'function');
ok('exports readStallSignal', typeof cadence.readStallSignal === 'function');
ok('exports readLastProposalEpochMs', typeof cadence.readLastProposalEpochMs === 'function');
ok('STRATEGY_CADENCE_REACHES === 40', cadence.STRATEGY_CADENCE_REACHES === 40);
ok('STRATEGY_STALL_MIN_SAMPLE === 12', cadence.STRATEGY_STALL_MIN_SAMPLE === 12);
ok('STRATEGY_MIN_INTERVAL_REACHES === 20', cadence.STRATEGY_MIN_INTERVAL_REACHES === 20);

// ---------------------------------------------------------------------------
// Leg 3: computeStrategyCounts(null, 0), the cold path -- no throw.
// ---------------------------------------------------------------------------
console.log('--- Leg 3: computeStrategyCounts cold path ---');

const cold = cadence.computeStrategyCounts(null, 0);
ok(
  'computeStrategyCounts(null,0) returns all-zero scalar counts',
  cold.reaches_since === 0 && cold.gates_since === 0 && cold.claims_since === 0
    && cold.promotions_since === 0 && cold.artifacts_since === 0
);
ok(
  'computeStrategyCounts(null,0).candidates is an empty array',
  Array.isArray(cold.candidates) && cold.candidates.length === 0
);

// ---------------------------------------------------------------------------
// Leg 4: shouldPropose, pure, no db.
// ---------------------------------------------------------------------------
console.log('--- Leg 4: shouldPropose ---');

ok(
  'a cold room (reaches_since 0) does not propose',
  cadence.shouldPropose({ reaches_since: 0, claims_since: 0 }).propose === false
);

(function () {
  const r = cadence.shouldPropose({ reaches_since: cadence.STRATEGY_CADENCE_REACHES, claims_since: 5 });
  ok('at the cadence threshold, propose is true', r.propose === true);
  ok('at the cadence threshold, signal is goal_cadence_due', r.signal === 'goal_cadence_due');
}());

(function () {
  // Deviation-adjusted (see header note): clears BOTH the hard floor and the
  // stall sample size at once.
  const reaches = Math.max(cadence.STRATEGY_STALL_MIN_SAMPLE, cadence.STRATEGY_MIN_INTERVAL_REACHES);
  const r = cadence.shouldPropose({
    reaches_since: reaches, claims_since: 0, promotions_since: 0, artifacts_since: 0,
  });
  ok('past the stall floor with zero production, propose is true', r.propose === true);
  ok('past the stall floor with zero production, signal is goal_stall', r.signal === 'goal_stall');
}());

(function () {
  const reaches = Math.max(cadence.STRATEGY_STALL_MIN_SAMPLE, cadence.STRATEGY_MIN_INTERVAL_REACHES);
  const r = cadence.shouldPropose({
    reaches_since: reaches, claims_since: 0, promotions_since: 0, artifacts_since: 3,
  });
  ok(
    'a room filing artifacts past the stall floor does not propose (producing, not circling)',
    r.propose === false
  );
}());

ok(
  'below the hard floor, propose is false regardless of every other count',
  cadence.shouldPropose({
    reaches_since: cadence.STRATEGY_MIN_INTERVAL_REACHES - 1,
    claims_since: 999, promotions_since: 999, artifacts_since: 0,
  }).propose === false
);

// ---------------------------------------------------------------------------
// Leg 5: readStallSignal, the null-default Phase 346 input.
// ---------------------------------------------------------------------------
console.log('--- Leg 5: readStallSignal ---');

const nullSignal = cadence.readStallSignal(null, null);
ok('readStallSignal(null,null).stall_count is null (load-bearing)', nullSignal.stall_count === null);
ok(
  'readStallSignal(null,null) reaches_since and claims_since read 0, not null',
  nullSignal.reaches_since === 0 && nullSignal.claims_since === 0
);

const injectedSignal = cadence.readStallSignal(null, { strategyStallCount: 7 });
ok(
  'readStallSignal prefers the injected roomState.strategyStallCount verbatim',
  injectedSignal.stall_count === 7
);

// ---------------------------------------------------------------------------
// Leg 6: fixture-based counting legs (guarded; SKIP honestly, never PASS,
// when node:sqlite is unavailable).
// ---------------------------------------------------------------------------
console.log('--- Leg 6: fixture-based counting ---');

let sqliteAvailable = true;
try {
  require('node:sqlite');
} catch (_e) {
  sqliteAvailable = false;
}

if (!sqliteAvailable) {
  skip('computeStrategyCounts row counts over a seeded fixture room (node:sqlite unavailable)');
  skip('candidates is built from node_created rows, capped at MAX_CANDIDATES (node:sqlite unavailable)');
  skip('findRecentChanges filters on a valid eventType (node:sqlite unavailable)');
  skip('readLastProposalEpochMs reads the strategy_proposed row back (node:sqlite unavailable)');
} else {
  const { buildChainFixtureRoom, closeChainFixtureRoom } = require(FIXTURE_PATH);

  // --- Sub-fixture A: the five counters + the artifact-type derivation ---
  (function () {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-345-cadence-'));
    const fixture = buildChainFixtureRoom(tmpDir, 'wide');
    try {
      const db = fixture.db;
      navigation.logMemoryEvent(db, 'reach_presented', {
        reach_id: 'contradiction', source_path: 'test:345-cadence', created_by: 'system',
      });
      navigation.logMemoryEvent(db, 'reach_presented', {
        reach_id: 'contradiction', source_path: 'test:345-cadence', created_by: 'system',
      });
      navigation.logMemoryEvent(db, 'gate_reached', {
        reach_count: 1, source_path: 'test:345-cadence', created_by: 'system',
      });
      navigation.logMemoryEvent(db, 'node_created', {
        target_node_id: 'claim:test-1', node_type: 'claim',
        source_path: 'test:345-cadence', created_by: 'system',
      });
      navigation.logMemoryEvent(db, 'node_created', {
        target_node_id: 'artifact:test-1', node_type: 'memory_artifact',
        source_path: 'test:345-cadence', created_by: 'system',
      });
      navigation.logMemoryEvent(db, 'status_promoted', {
        target_node_id: 'claim:test-1', source_path: 'test:345-cadence', created_by: 'system',
      });

      const counts = cadence.computeStrategyCounts(db, 0);
      ok('reaches_since counts reach_presented rows', counts.reaches_since === 2);
      ok('gates_since counts gate_reached rows', counts.gates_since === 1);
      ok('claims_since counts node_created rows', counts.claims_since === 2);
      ok('promotions_since counts status_promoted rows', counts.promotions_since === 1);
      ok(
        'artifacts_since counts node_created rows whose node_type is an artifact type',
        counts.artifacts_since === 1
      );
      ok(
        'candidates carries the node ids from node_created rows',
        counts.candidates.indexOf('claim:test-1') !== -1
          && counts.candidates.indexOf('artifact:test-1') !== -1
      );

      const filteredRows = navigation.findRecentChanges(db, 0, {
        eventType: 'strategy_proposed', limit: 100,
      });
      ok(
        'findRecentChanges filters on a valid eventType rather than falling through',
        filteredRows.length === 0
      );

      ok(
        'readLastProposalEpochMs returns 0 when no strategy_proposed row exists',
        cadence.readLastProposalEpochMs(db) === 0
      );

      const beforeProposal = Date.now();
      navigation.logMemoryEvent(db, 'strategy_proposed', {
        goal_version: 1, rung: 'IllDefined', jtbd: 'test-jtbd',
        reaches_since: 2, claims_since: 2, anchor_node_id: 'goal:test-room',
        source_path: 'test:345-cadence', created_by: 'system',
        dedupe_key: 'test-345-cadence-proposal-1',
      });
      const lastProposalTs = cadence.readLastProposalEpochMs(db);
      ok(
        'readLastProposalEpochMs reads the strategy_proposed row back once one exists',
        typeof lastProposalTs === 'number' && lastProposalTs >= beforeProposal
      );
    } finally {
      closeChainFixtureRoom(fixture);
    }
  }());

  // --- Sub-fixture B: the MAX_CANDIDATES cap + first-wins de-dup ---
  (function () {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-345-cadence-cap-'));
    const fixture = buildChainFixtureRoom(tmpDir, 'wide');
    try {
      const db = fixture.db;
      const seeded = 70;
      for (let i = 0; i < seeded; i++) {
        navigation.logMemoryEvent(db, 'node_created', {
          target_node_id: 'claim:cap-' + i, node_type: 'claim',
          source_path: 'test:345-cadence-cap', created_by: 'system',
        });
      }
      // A repeated id proves first-wins de-dup independent of the cap.
      navigation.logMemoryEvent(db, 'node_created', {
        target_node_id: 'claim:cap-0', node_type: 'claim',
        source_path: 'test:345-cadence-cap', created_by: 'system',
      });

      const counts = cadence.computeStrategyCounts(db, 0);
      ok('claims_since counts every node_created row, uncapped', counts.claims_since === seeded + 1);
      ok('candidates is capped at MAX_CANDIDATES (64)', counts.candidates.length === 64);
      ok(
        'candidates carries no duplicate node ids (first-wins de-dup)',
        new Set(counts.candidates).size === counts.candidates.length
      );
    } finally {
      closeChainFixtureRoom(fixture);
    }
  }());
}

// ---------------------------------------------------------------------------
// Leg 7: source-discipline greps (no db require, no raw SQL, READ_LIMIT wired).
// ---------------------------------------------------------------------------
console.log('--- Leg 7: source discipline ---');

const cadenceSource = fs.readFileSync(CADENCE_PATH, 'utf8');
ok(
  'goal-cadence.cjs never requires better-sqlite3 or node:sqlite',
  !/require\(['"](?:better-sqlite3|node:sqlite)['"]\)/.test(cadenceSource)
);
ok('goal-cadence.cjs issues no raw SQL prepare() call', !/\.prepare\(/.test(cadenceSource));
ok('goal-cadence.cjs threads READ_LIMIT into every findRecentChanges call', /findRecentChanges\([^)]*READ_LIMIT/.test(cadenceSource) || /limit:\s*READ_LIMIT/.test(cadenceSource));
ok('goal-cadence.cjs states which source artifacts_since derives from', /artifacts_since/.test(cadenceSource));

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('');
console.log('======================================');
console.log('Checks: ' + checks + '  Failed: ' + failed + '  Skipped: ' + skipped);
console.log('======================================');

if (failed > 0) {
  process.exit(1);
}
