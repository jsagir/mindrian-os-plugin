'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 148-01 Task 3 -- IRW-02 falsifiable test for the 6th MACHINE reach.
 * ========================================================================
 * The D-09 constitutional amendment minted `hats` as a REAL 6th machine
 * reach_id (no longer a render-label sub_mode under brain_consult). This test
 * is the falsifiable contract for that amendment + the DIAL_REACH_K 5 -> 6
 * raise. It mirrors the assertion style of tests/test-dial-reach-orchestrator.cjs
 * (plain node:assert/strict, PASS line on stdout, non-zero exit on failure).
 *
 * The four behaviors (148-VALIDATION.md IRW-02 row):
 *   1. sensor-types.REACH_IDS has length 6 and includes 'hats'.
 *   2. orchestrator.DIAL_REACH_K === 6 AND ranker.MAX_K === 3 (distinct).
 *   3. buildReachList previews a reach whose reach_id === 'hats'.
 *   4. the per-room persona-cache helper rebuilds on a cache miss (first call)
 *      and reads from cache on the second call (no rebuild) for the same room.
 *
 * Assertions 1-3 are HARD and run now -- Task 1 already shipped the spine.
 * Assertion 4 depends on the per-room Hats persona cache helper that Wave 3
 * Plan 05 wires (reusing the per-room dial-memory cache idiom,
 * lib/core/feynman/dial-memory-renderer.cjs). Until Plan 05 lands the cache
 * module, assertion 4 is a DOCUMENTED Wave-dependency stub gated behind a
 * presence check: it asserts read-then-rebuild ONLY when the module is present;
 * otherwise it records the stub and continues (so this file is GREEN now and
 * HARDENS automatically the moment Plan 05 ships the helper).
 *
 * No em-dashes anywhere (CLAUDE.md / project hard rule). Hyphens only.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const sensorTypes = require(path.join(REPO_ROOT, 'lib', 'core', 'sensors', 'sensor-types.cjs'));
const orchestrator = require(path.join(REPO_ROOT, 'lib', 'hmi', 'dial-reach-orchestrator.cjs'));
const ranker = require(path.join(REPO_ROOT, 'lib', 'workflow', 'f-selector-ranker.cjs'));

// ---------------------------------------------------------------------------
// 1. sensor-types.REACH_IDS has length 6 and includes 'hats'.
// ---------------------------------------------------------------------------
assert.equal(
  sensorTypes.REACH_IDS.length,
  6,
  'IRW-02: sensor-types.REACH_IDS must carry EXACTLY 6 frozen reach_ids (Phase 148 D-09)'
);
assert.ok(
  sensorTypes.REACH_IDS.indexOf('hats') !== -1,
  "IRW-02: sensor-types.REACH_IDS must include the 6th machine reach 'hats'"
);

// ---------------------------------------------------------------------------
// 2. orchestrator.DIAL_REACH_K === 6 AND ranker.MAX_K === 3 (distinct).
// ---------------------------------------------------------------------------
assert.equal(
  orchestrator.DIAL_REACH_K,
  6,
  'IRW-02: orchestrator.DIAL_REACH_K must be 6 (Phase 148 D-09 raised 5 -> 6)'
);
assert.equal(
  ranker.MAX_K,
  3,
  'IRW-02: ranker.MAX_K must STAY 3 (the chooser clamp is never raised by D-09)'
);
assert.notEqual(
  orchestrator.DIAL_REACH_K,
  ranker.MAX_K,
  'IRW-02: DIAL_REACH_K (6) and MAX_K (3) must remain distinct constants'
);

// ---------------------------------------------------------------------------
// 3. buildReachList previews a reach whose reach_id === 'hats'.
// ---------------------------------------------------------------------------
const reachList = orchestrator.buildReachList({
  tierMode: 'mode_a',
  reachScores: {
    context_block: 0.87,
    contradiction: 0.61,
    cross_room: 0.54,
    brain_consult: 0.48,
    deep_research: 0.40,
    hats: 0.33,
  },
});
assert.ok(
  Array.isArray(reachList.reaches),
  'IRW-02: buildReachList must return a reaches[] array'
);
assert.equal(
  reachList.reaches.length,
  6,
  'IRW-02: buildReachList must preview all 6 reaches'
);
const hatsReach = reachList.reaches.find(function (r) { return r.reach_id === 'hats'; });
assert.ok(
  hatsReach && hatsReach.reach_id === 'hats',
  "IRW-02: buildReachList must preview a reach whose reach_id === 'hats'"
);

// ---------------------------------------------------------------------------
// 4. persona-cache read-then-rebuild (Wave-dependency stub until Plan 05).
// ---------------------------------------------------------------------------
// The per-room Hats persona cache helper lands in Wave 3 Plan 05 (D-06: research
// personas are cached per room, rebuilt on demand). It reuses the per-room
// dial-memory cache idiom. Candidate module paths Plan 05 may ship the helper at:
const CACHE_CANDIDATES = [
  path.join(REPO_ROOT, 'lib', 'core', 'feynman', 'hats-persona-cache.cjs'),
  path.join(REPO_ROOT, 'lib', 'core', 'hats-persona-cache.cjs'),
  path.join(REPO_ROOT, 'lib', 'hmi', 'hats-persona-cache.cjs'),
];

function resolveCacheModule() {
  for (const p of CACHE_CANDIDATES) {
    try {
      require.resolve(p);
      return p;
    } catch (_e) { /* not present yet */ }
  }
  return null;
}

let personaCacheStubbed = false;
const cacheModulePath = resolveCacheModule();

if (cacheModulePath) {
  // Plan 05 has landed the helper -- assertion 4 is now HARD.
  const cache = require(cacheModulePath);
  assert.equal(
    typeof cache.getOrBuildPersonas,
    'function',
    'IRW-02: the persona-cache helper must export getOrBuildPersonas(room, builder)'
  );

  const room = 'irw02-fixture-room';
  let rebuildCount = 0;
  const builder = function () {
    rebuildCount += 1;
    return { personas: ['white', 'red', 'black', 'yellow', 'green', 'blue'] };
  };

  // First call: cache miss -> rebuild fires.
  const first = cache.getOrBuildPersonas(room, builder);
  assert.ok(first && Array.isArray(first.personas), 'IRW-02: first call returns built personas');
  assert.equal(rebuildCount, 1, 'IRW-02: first call is a cache miss and rebuilds');

  // Second call (same room): cache hit -> NO rebuild.
  const second = cache.getOrBuildPersonas(room, builder);
  assert.ok(second && Array.isArray(second.personas), 'IRW-02: second call returns cached personas');
  assert.equal(rebuildCount, 1, 'IRW-02: second call reads from cache and does NOT rebuild');
} else {
  // Plan 05 has NOT landed the helper yet. Documented Wave-dependency stub: the
  // read-then-rebuild assertion is deferred to Plan 05, which MUST satisfy it by
  // shipping a per-room persona-cache helper at one of CACHE_CANDIDATES. The
  // three spine assertions above are hard and already green.
  personaCacheStubbed = true;
}

if (personaCacheStubbed) {
  process.stdout.write(
    'PASS test-148-hats-sixth-reach.cjs (IRW-02 spine: 6 reach_ids + hats + DIAL_REACH_K===6; ' +
      'persona-cache read-then-rebuild STUBBED pending Wave 3 Plan 05)\n'
  );
} else {
  process.stdout.write(
    'PASS test-148-hats-sixth-reach.cjs (IRW-02: 6 reach_ids + hats + DIAL_REACH_K===6 + ' +
      'persona-cache read-then-rebuild)\n'
  );
}
process.exit(0);
