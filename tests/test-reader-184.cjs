'use strict';
/*
 * Phase 184 -- READER acceptance test (R1 / R2 / R3 + behavior).
 *
 * Asserts:
 *   R2  validateProjection rejects a malformed projection (5 malformations) and
 *       PASSES the real 249-node projection; decide() degrades gracefully (no throw)
 *       on a malformed AND on a missing projection.
 *   R3  the read stays inside the ambient-turn budget (read_ms <= READER_BUDGET_MS)
 *       AND the context-weight budget (option_count <= READER_MAX_OPTIONS).
 *   R1  the grounded-vs-ungrounded A/B harness runs the LOCAL measurement today,
 *       records the live-A/B NAMED DEBT (subject_class unknown / uninstrumented)
 *       honestly, and clears to 'measured' ONLY with a live navigator subject.
 *   ranking is DETERMINISTIC (same input -> identical output, a total order).
 *   READER-04 content: every surfaced option carries fires:false.
 *   Part 8: zero network tokens in the new reader + harness modules.
 *   House rule: no em-dashes in the new files.
 *
 * Canon Part 8: this test makes no Brain / network call. hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const reader = require(path.join(REPO_ROOT, 'lib', 'core', 'reader', 'decide-projection-reader.cjs'));
const harness = require(path.join(REPO_ROOT, 'lib', 'core', 'reader', 'ab-harness.cjs'));
const ne = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation-engine.cjs'));

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass += 1; }

// ---- a small valid projection fixture (mirrors the real shape) ----
function validFixture() {
  return {
    nodes: [
      { id: 'command:/mos:a', kind: 'command', methodology_tier: 'mindrian-operation', name: '/mos:a',
        reach_id: 'context_block', sub_mode: 'a', hierarchy_rank: 10, posture: 'hold',
        sensor_triggers: ['SENS-05'], ranking: { reach_id: 'context_block', hierarchy_rank: 10, posture: 'hold' } },
      { id: 'command:/mos:b', kind: 'command', methodology_tier: 'mindrian-operation', name: '/mos:b',
        reach_id: 'hats', sub_mode: 'b', hierarchy_rank: 20, posture: 'push_forward',
        ranking: { reach_id: 'hats', hierarchy_rank: 20, posture: 'push_forward' } },
      { id: 'framework:Cynefin', kind: 'framework', methodology_tier: 'pws', name: 'Cynefin' },
    ],
    edges: [],
  };
}

// =====================================================================
// R2 -- projection-correctness gate
// =====================================================================

// passes the real projection (the 249-node hygiene is already met)
(function () {
  const loaded = reader.loadProjection({});
  ok('R2: real projection loads', loaded.ok === true && loaded.projection && Array.isArray(loaded.projection.nodes));
  const gate = reader.validateProjection(loaded.projection);
  ok('R2: real projection PASSES the gate', gate.valid === true && gate.reason === 'ok');
  ok('R2: real projection carries 249 nodes', gate.node_count === 249);
  ok('R2: real projection all-tier-tagged', gate.checks.all_tier_tagged === true);
  ok('R2: real projection no-dupes', gate.checks.no_dupes === true);
})();

// FAILS CLOSED on five malformations
(function () {
  ok('R2: not-an-object rejected', reader.validateProjection(null).valid === false);
  ok('R2: empty nodes rejected', reader.validateProjection({ nodes: [] }).valid === false);

  const missingTier = validFixture();
  delete missingTier.nodes[0].methodology_tier;
  let g = reader.validateProjection(missingTier);
  ok('R2: missing methodology_tier rejected (boundary-keeper)',
     g.valid === false && g.reason === 'missing_or_bad_methodology_tier');

  const badTier = validFixture();
  badTier.nodes[0].methodology_tier = 'not-a-tier';
  ok('R2: bad methodology_tier rejected', reader.validateProjection(badTier).valid === false);

  const dup = validFixture();
  dup.nodes[1].id = dup.nodes[0].id;
  g = reader.validateProjection(dup);
  ok('R2: duplicate node id rejected', g.valid === false && g.reason === 'duplicate_node_id');

  const badShape = validFixture();
  delete badShape.nodes[0].kind;
  g = reader.validateProjection(badShape);
  ok('R2: malformed node shape (no kind) rejected', g.valid === false && g.reason === 'malformed_node_shape');
})();

// the read SKIPS on a malformed projection (fails closed, never throws)
(function () {
  const badTier = validFixture();
  badTier.nodes[0].methodology_tier = 'junk';
  const res = reader.offerProjectionCapabilities({}, { projection: badTier, noCache: true });
  ok('R2: read SKIPS on a malformed projection', res.skipped === true && /^r2_gate_failed:/.test(res.reason));
  ok('R2: skipped read returns null options (not a throw)', res.options === null);
})();

// =====================================================================
// decide() degrades gracefully (no throw) on missing AND malformed projection
// =====================================================================
(function () {
  // missing projection (path that does not exist)
  let threw = false, d;
  try {
    d = ne.decide({ userText: 'x', sectionPath: null }, { projectionPath: '/no/such/projection.json' });
  } catch (_e) { threw = true; }
  ok('decide() does not throw on a missing projection', threw === false);
  ok('decide() carries a skipped projection_offer on a missing projection',
     d && d.decision_trace && d.decision_trace.projection_offer
     && d.decision_trace.projection_offer.skipped === true);

  // malformed projection injected through decide()
  const badTier = validFixture();
  badTier.nodes[0].methodology_tier = 'junk';
  threw = false;
  try {
    d = ne.decide({ userText: 'x', sectionPath: null }, { projectionOverride: badTier });
  } catch (_e) { threw = true; }
  ok('decide() does not throw on a malformed projection', threw === false);
  ok('decide() skips the offer (R2 closed) on a malformed projection',
     d && d.decision_trace.projection_offer && d.decision_trace.projection_offer.skipped === true);
})();

// =====================================================================
// R3 -- ambient-turn latency + context-weight budget
// =====================================================================
(function () {
  reader.__resetCache();
  // warm the cache (first read pays the disk cost), then measure the ambient read.
  reader.offerProjectionCapabilities({}, {});
  const res = reader.offerProjectionCapabilities({ firingSensors: ['SENS-05'] }, {});
  ok('R3: read is not skipped on the real projection', res.skipped === false);
  ok('R3: read_ms is within READER_BUDGET_MS (' + reader.READER_BUDGET_MS + 'ms)',
     res._meta.within_budget === true && res._meta.read_ms <= reader.READER_BUDGET_MS);
  ok('R3: option_count within READER_MAX_OPTIONS (' + reader.READER_MAX_OPTIONS + ')',
     res._meta.option_count <= reader.READER_MAX_OPTIONS && res.options.length <= reader.READER_MAX_OPTIONS);
})();

// =====================================================================
// ranking determinism (READER-02 total order)
// =====================================================================
(function () {
  const fx = validFixture();
  const ctx = { firingSensors: ['SENS-05'] };
  const a = reader.rankCapabilities(fx, ctx, {});
  const b = reader.rankCapabilities(fx, ctx, {});
  ok('ranking is deterministic (identical output for identical input)',
     JSON.stringify(a) === JSON.stringify(b));
  // a total order: score descending, id ascending on ties.
  let ordered = true;
  for (let i = 1; i < a.length; i += 1) {
    if (a[i - 1].score < a[i].score) ordered = false;
    if (a[i - 1].score === a[i].score && a[i - 1].id > a[i].id) ordered = false;
  }
  ok('ranking is a total order (score desc, id asc on ties)', ordered === true);
  // SENS-05 context match outranks the higher-hierarchy-rank node.
  ok('ranking is context-aware (the SENS-05-matched node ranks first)', a[0].id === 'command:/mos:a' && a[0].context_matched === true);
})();

// =====================================================================
// READER-04 content: every surfaced option is fires:false (never a fire)
// =====================================================================
(function () {
  const res = reader.offerProjectionCapabilities({}, {});
  const allFalse = Array.isArray(res.options) && res.options.every(function (o) { return o.fires === false; });
  ok('READER-04: every surfaced option carries fires:false (content, never a fire)', allFalse === true);
})();

// =====================================================================
// R1 -- grounded-vs-ungrounded A/B harness
// =====================================================================
(function () {
  const res = harness.runGroundedVsUngroundedAB({ firingSensors: ['SENS-05'] }, {});
  // the LOCAL structural measurement runs today.
  ok('R1: local_measurement present', !!res.local_measurement);
  ok('R1: choice_shift is measured (projection reshapes the option set)',
     typeof res.local_measurement.choice_shift === 'number' && res.local_measurement.choice_shift > 0);
  ok('R1: grounded + ungrounded latencies measured',
     typeof res.local_measurement.latency_grounded_ms === 'number'
     && typeof res.local_measurement.latency_ungrounded_ms === 'number');
  ok('R1: grounded arm is the projection-ranked set (not skipped)', res.local_measurement.grounded_skipped === false);

  // the LIVE A/B is the NAMED DEBT today: subject_class unknown / uninstrumented.
  ok('R1: live_ab subject_class is unknown today (no live navigator)', res.live_ab.subject_class === 'unknown');
  ok('R1: live_ab state is uninstrumented (the named debt, not a fabricated pass)',
     res.live_ab.state === 'uninstrumented' && res.live_ab.result === null);
  ok('R1: the named debt is recorded honestly (no euphemism)',
     typeof res.live_ab.named_debt === 'string' && /UNINSTRUMENTED/.test(res.live_ab.named_debt));

  // a maintainer/dogfood reading does NOT clear the debt (entry-20 override guard).
  const maint = harness.runGroundedVsUngroundedAB({}, { subjectClass: 'maintainer', liveChoice: { arm: 'grounded', label: 'x', latency_ms: 5 } });
  ok('R1: a maintainer reading does NOT clear the live A/B', maint.live_ab.state === 'uninstrumented');

  // the harness CAN run the live A/B the instant a navigator subject exists.
  const live = harness.runGroundedVsUngroundedAB({ firingSensors: ['SENS-05'] }, {
    subjectClass: 'navigator',
    liveChoice: { arm: 'grounded', label: '/mos:persona', latency_ms: 1200 },
  });
  ok('R1: a live navigator subject CLEARS the A/B to measured',
     live.live_ab.state === 'measured' && live.live_ab.result && live.live_ab.result.chosen_arm === 'grounded');
})();

// =====================================================================
// Part 8 (no network) + house rule (no em-dashes) over the new files
// =====================================================================
(function () {
  // Network sweep over the PRODUCTION reader + harness modules only. (The two test
  // files legitimately carry the network-token regex as a literal pattern, so
  // self-sweeping them is a false-positive paradox; their structure is guarded by
  // the R4 require allow-list instead.)
  const PROD = [
    path.join(REPO_ROOT, 'lib', 'core', 'reader', 'decide-projection-reader.cjs'),
    path.join(REPO_ROOT, 'lib', 'core', 'reader', 'ab-harness.cjs'),
  ];
  const NET = /\bfetch\s*\(|https?:\/\/|\bcurl\b|brain\.mindrian|tavily|brain-client/;
  for (const f of PROD) {
    const src = fs.readFileSync(f, 'utf8');
    // strip full-line comments so a header that NAMES a token in prose cannot self-trip.
    const code = src.split(/\r?\n/).filter(function (l) { return !/^\s*(\/\/|\*)/.test(l); }).join('\n');
    ok('Part 8: ' + path.basename(f) + ' carries zero network tokens', NET.test(code) === false);
  }
  // em-dash house-rule check over ALL four new files (no literal-pattern paradox here).
  const ALL = PROD.concat([
    path.join(REPO_ROOT, 'tests', 'test-reader-184.cjs'),
    path.join(REPO_ROOT, 'tests', 'test-reader-r4-structural-184.cjs'),
  ]);
  const EMDASH = new RegExp('\\u2014');
  for (const f of ALL) {
    const src = fs.readFileSync(f, 'utf8');
    ok('house rule: ' + path.basename(f) + ' has no em-dashes', EMDASH.test(src) === false);
  }
})();

console.log('');
console.log('PASS ' + pass + ' assertions');
console.log('>>> test-reader-184.cjs: PASSED');
process.exit(0);
