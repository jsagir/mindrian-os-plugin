'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 218 (T-218-VD, post-checkpoint fix) -- cohort-stratification regression.
 *
 * THE BUG (traced live against aion-eureka-synergy, logged in 218-VERIFICATION.md):
 * scripts/eureka-portfolio-report.cjs pooled EVERY indexed node (memory_artifact
 * scaffold + the new company/technology/market entity nodes) into ONE cohort
 * array before calling portfolio-dimensions.cjs::scoreTechDimensions. That
 * function's validated_demand/tech_econ_feasibility dims are PERCENTILE RANKS
 * of pair_count/degree WITHIN the cohort passed in. A memory_artifact node that
 * has lived in a room for months accrues dozens of edges; a freshly-written
 * entity node starts at degree 1. Pooling both families means an entity node's
 * percentile is dragged to the floor by comparison against long-accumulated hub
 * degree -- not a real weakness signal. Live proof: aion-eureka-synergy's
 * top-25 stayed 100% memory_artifact-vs-memory_artifact even after 149 entity
 * nodes were written (100.0% -> 100.0%, zero movement).
 *
 * WHY THE EXISTING test-218-noise-reduction.cjs FIXTURE DIDN'T CATCH IT: its 6
 * seeded memory_artifact nodes form a fully-cited CONVERGES CLIQUE (every node
 * paired with every other), so every artifact has IDENTICAL degree. A uniform
 * cohort gives percentileRank = 0.5 for everyone -- validated_demand contributes
 * ZERO differentiation in that fixture, pre- or post-extraction, so it never
 * exercised the hub-vs-newcomer skew that a real, months-old room has.
 *
 * THE FIX: stratify the cohort by node-type family (ENTITY_NODE_TYPES vs
 * everything else) before computing percentiles, so entity nodes rank against
 * same-age peers instead of against long-accumulated hubs. When a room has
 * ZERO entity nodes, every tech routes to the single scaffold cohort --
 * mathematically identical to the pre-fix pooled behavior (the regression
 * guard this test's Leg 2 proves).
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');
const { insertNode } = require('../lib/core/node-insert.cjs');
const navigation = require('../lib/core/navigation.cjs');
const pdims = require('../lib/core/eureka/portfolio-dimensions.cjs');
const RUNNER = require('../scripts/eureka-portfolio-report.cjs');

function mkTempRoom() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-218-cohort-'));
  fs.mkdirSync(path.join(dir, 'sec-a'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'sec-b'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'sec-c'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'sec-a', 'FEYNMAN.md'), '# A\n\nContent A.\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'sec-b', 'FEYNMAN.md'), '# B\n\nContent B.\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'sec-c', 'FEYNMAN.md'), '# C\n\nContent C.\n', 'utf8');
  return dir;
}

async function main() {
  let passed = 0;

  // ---------------------------------------------------------------------
  // Leg 1: the mechanism, direct against the pure classifier (fast, no I/O).
  // Reproduce a realistic accumulated-hub-vs-newcomer skew: three scaffold
  // nodes with degree in the dozens (a room that has lived for months) and
  // three entity nodes freshly written at degree 1-2 -- exactly the shape
  // aion-eureka-synergy showed live (38 artifacts each carrying dozens of
  // edges, 149 entity nodes each carrying 1-3).
  // ---------------------------------------------------------------------
  {
    const scaffoldCohort = [
      { id: 'artifact:1', pair_count: 42, degree: 42 },
      { id: 'artifact:2', pair_count: 38, degree: 38 },
      { id: 'artifact:3', pair_count: 55, degree: 55 },
    ];
    const entityCohort = [
      { id: 'entity:1', pair_count: 1, degree: 1 },
      { id: 'entity:2', pair_count: 3, degree: 3 },
      { id: 'entity:3', pair_count: 2, degree: 2 },
    ];
    const targetEntity = entityCohort[1]; // pair_count 3, the strongest of the three entities

    // OLD (pre-fix) behavior: one pooled cohort across both families.
    const pooledCohort = scaffoldCohort.concat(entityCohort);
    const pooledDims = pdims.scoreTechDimensions(targetEntity, pooledCohort);

    // NEW (post-fix) behavior: percentile within the entity family only.
    const stratifiedDims = pdims.scoreTechDimensions(targetEntity, entityCohort);

    console.log(
      '  pooled validated_demand=' + pooledDims.validated_demand.toFixed(3) +
      '  stratified validated_demand=' + stratifiedDims.validated_demand.toFixed(3)
    );

    assert.ok(
      pooledDims.validated_demand <= 0.5,
      'sanity: the strongest entity, pooled against a hub-skewed cohort, must sit at or below the pooled midpoint (' +
      pooledDims.validated_demand.toFixed(3) + ') -- this is the bug the live room hit'
    );
    assert.ok(
      stratifiedDims.validated_demand > pooledDims.validated_demand,
      'stratified validated_demand (' + stratifiedDims.validated_demand.toFixed(3) +
      ') must exceed pooled (' + pooledDims.validated_demand.toFixed(3) +
      ') -- ranking the entity against its own peer family, not against accumulated hub degree'
    );
    assert.equal(
      stratifiedDims.validated_demand, 1.0,
      'the strongest entity in its own 3-member family should sit at the top of that family\'s percentile'
    );
    passed += 1;
    console.log('  leg 1 (mechanism, pure classifier): PASSED');
  }

  // ---------------------------------------------------------------------
  // Leg 2: regression guard. A room with ZERO entity nodes must produce
  // IDENTICAL scoring to the pre-fix pooled behavior -- the stratification
  // must be a no-op when there is nothing to stratify. Reuse the same
  // "uniform cohort -> percentile 0.5" identity: if entityCohort is empty,
  // every tech falls into scaffoldCohort, which is exactly cohortTechs, so
  // this is mathematically guaranteed by construction -- verified here via
  // the real runner end to end, not re-derived by hand.
  //
  // FIXTURE NOTE (quick task 260715-0nj): a bare 3-artifact CONVERGES clique
  // now ranks EMPTY, because the both-scaffold candidate-pair filter removes
  // every memory_artifact-vs-memory_artifact pair. So the fixture gains ONE
  // non-scaffold, non-ENTITY node (type 'Claim', the test-215/216 Claim
  // fixture idiom) wired with CONVERGES edges to all three artifacts. This
  // gives the ranker surviving Claim-vs-artifact pairs (exactly ONE scaffold
  // side, untouched by the narrow filter) while keeping EVERY node at a
  // UNIFORM degree of 3, so the validated_demand === 0.5 uniform-cohort proof
  // (this leg's actual purpose) still holds: 'Claim' is not in
  // ENTITY_NODE_TYPES, so it routes to scaffoldCohort and the cohort stays a
  // single uniform family -- the stratification no-op is unchanged.
  // ---------------------------------------------------------------------
  {
    const roomDir = mkTempRoom();
    try {
      const db = openRoomDb(roomDir, { allowExtension: true });
      const ids = ['sec-a', 'sec-b', 'sec-c'].map(function (slug) {
        const id = 'memory_artifact:' + slug + ':FEYNMAN';
        insertNode(db, id, 'memory_artifact', JSON.stringify({
          title: slug + ' FEYNMAN', path: slug + '/FEYNMAN.md', section: slug,
        }), { source_path: 'memory:' + slug + ':FEYNMAN', created_by: 'system' });
        return id;
      });
      // The non-scaffold, non-entity Claim node (props.text so it indexes with
      // no file body). It converges with all three artifacts so the surviving
      // ranked pairs are Claim-vs-artifact (one-side scaffold), and it lifts
      // every artifact to degree 3 while itself sitting at degree 3 -> uniform.
      const claimId = 'claim:leg2:uniform';
      insertNode(db, claimId, 'Claim', JSON.stringify({
        title: 'Uniform cohort claim', text: 'A non-scaffold claim node wired to every artifact.',
        section: 'claims',
      }), { source_path: 'claims/leg2-uniform', created_by: 'system' });
      for (let i = 0; i < ids.length; i += 1) {
        for (let j = i + 1; j < ids.length; j += 1) {
          const r = navigation.writeEdge(db, {
            source_id: ids[i], target_id: ids[j], edge_type: 'CONVERGES', properties: {},
          });
          assert.ok(r && r.ok, 'seed CONVERGES edge should write');
        }
      }
      for (let i = 0; i < ids.length; i += 1) {
        const r = navigation.writeEdge(db, {
          source_id: claimId, target_id: ids[i], edge_type: 'CONVERGES', properties: {},
        });
        assert.ok(r && r.ok, 'seed Claim CONVERGES edge should write');
      }
      closeRoomDb(db);

      const outJson = path.join(roomDir, '.mindrian', 'eureka', 'portfolio-report.json');
      const code = await RUNNER.main([
        '--db', roomDir, '--pairs', 'room', '--offline', '--top', '25',
        '--out', path.join(roomDir, '.mindrian', 'eureka', 'portfolio-report.md'),
        '--json', outJson,
      ]);
      assert.equal(code, 0, 'runner should exit 0 on a zero-entity room');
      const report = JSON.parse(fs.readFileSync(outJson, 'utf8'));
      assert.ok(Array.isArray(report.ranked) && report.ranked.length > 0, 'zero-entity room should still rank the surviving Claim-vs-artifact pairs');

      // The 3 artifacts plus the Claim node, each converging with every other
      // in its lane, give EVERY node an IDENTICAL degree of 3. A uniform
      // single-family cohort must still give percentileRank = 0.5 for everyone
      // -- proving entityCohort stayed empty (Claim routes to scaffoldCohort)
      // and every tech routed to the (unchanged) scaffold cohort. The
      // both-scaffold filter removed the 3 artifact-vs-artifact pairs, so the
      // surviving ranked pairs are the one-side Claim-vs-artifact pairs.
      for (const pair of report.ranked) {
        assert.equal(
          pair.dims.validated_demand, 0.5,
          'zero-entity room: validated_demand must be the pre-fix uniform-cohort value (0.5) for pair ' + pair.a + '<->' + pair.b
        );
      }
      passed += 1;
      console.log('  leg 2 (zero-entity regression guard): PASSED -- ' + report.ranked.length + ' pairs, all validated_demand=0.5');
    } finally {
      try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    }
  }

  console.log('test-218-cohort-stratification: ' + passed + '/2 legs PASSED');
}

main().then(function () {
  process.exit(0);
}).catch(function (err) {
  console.error('test-218-cohort-stratification FAILED:', err && err.message ? err.message : err);
  process.exit(1);
});
