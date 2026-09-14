#!/usr/bin/env node
'use strict';

/*
 * tests/test-347-ranked-set-exclusion.cjs -- Phase 347-06 Task 2.
 *
 * Pins WD-347-4 (docs/2026-09-14-CHAIN-SHARED-STATE-CONTRACT.md): chain_state
 * records are excluded from Leg C's ranked neighborhood by default, and
 * remain reachable only by an explicit focus on a chain_state record itself
 * (a default, not a wall). The exclusion is applied APP-SIDE in legC only;
 * NEIGHBORHOOD_SQL and lib/core/navigation/neighborhood.cjs stay untouched
 * and every other getNeighborhood caller keeps seeing every type.
 *
 * Reuse before build (Canon Part 7): reuses tests/fixtures/room-141-
 * fixture.cjs (buildFixtureDb) -- the same fixture Task 1's test uses and
 * tests/test-get-room-context.cjs already established -- plus the real
 * chain-state.cjs writer and edges.cjs::writeEdge chokepoints to seed
 * chain_state content on top of it, rather than hand-rolling a fourth room
 * schema.
 *
 * FIXTURE NOTE on edge direction: chain-state.cjs's own writer only ever
 * creates SOURCED_FROM (chain_state -> subject) and FEEDS_INTO (chain_state
 * -> chain_state successor) edges -- both edges with a chain_state row as
 * SOURCE. NEIGHBORHOOD_SQL walks strictly source-to-target outward from the
 * focus (neighborhood.cjs:19-25), so a real chain_state record is never
 * reachable outward from an ordinary room node through edges chain-state.cjs
 * itself ever writes. This fixture adds ONE additional synthetic INFORMS
 * edge from an ordinary claim node to the chain_state record, purely to
 * construct a room where a ranked-neighborhood walk from that ordinary
 * claim WOULD surface a chain_state row absent the guard -- exactly the
 * dilution scenario WD-347-4 names. The guard under test (filterRankedExclusions)
 * operates on row TYPE alone, agnostic to how a row became reachable, so
 * this is a faithful way to exercise it without asserting anything about
 * real production edge shape.
 *
 * Plain node:assert CJS script. Hyphens only, no em-dashes (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const { getRoomContext, CORTEX_NODE_TYPES } =
  require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'room-context.cjs'));
const { getNeighborhood } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'neighborhood.cjs'));
const { buildFixtureDb } = require(path.join(REPO_ROOT, 'tests', 'fixtures', 'room-141-fixture.cjs'));
const chainState = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'chain-state.cjs'));
const edges = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'edges.cjs'));

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

console.log('test-347-ranked-set-exclusion:');

async function main() {
  // ======================================================================
  // Shared fixture: room-141's claims/section plus two sequential
  // chain_state records anchored to claim:tam-large, joined by the writer's
  // own FEEDS_INTO sibling edge, plus one synthetic INFORMS edge from
  // claim:tam-large to the first record (see the FIXTURE NOTE above).
  // ======================================================================
  const db = buildFixtureDb();
  try {
    const write0 = chainState.writeChainStateRecord(db, {
      run_id: 'run-347-06-excl',
      step_index: 0,
      kind: 'task',
      command: '/mos:act',
      body: { text: 'step 0' },
      quality: 'high',
      tier: 'executable',
      produced_by: 'worker',
      subject_node_id: 'claim:tam-large',
    });
    const write1 = chainState.writeChainStateRecord(db, {
      run_id: 'run-347-06-excl',
      step_index: 1,
      kind: 'draft',
      command: '/mos:act',
      body: { text: 'step 1' },
      quality: 'high',
      tier: 'executable',
      produced_by: 'worker',
      subject_node_id: 'claim:tam-large',
    });
    assert.equal(write0.ok, true, 'the fixture chain-state write (step 0) must succeed');
    assert.equal(write1.ok, true, 'the fixture chain-state write (step 1) must succeed');
    const recA = write0.node_id;
    const recB = write1.node_id;

    const synthetic = edges.writeEdge(db, {
      source_id: 'claim:tam-large',
      target_id: recA,
      edge_type: 'INFORMS',
      properties: { reason: 'test-347-06-fixture-only-reachability-edge' },
    });
    assert.equal(synthetic.ok, true, 'the fixture-only synthetic edge must write');

    // ---- Test 1: a default (non-chain_state) focus returns zero
    // chain_state rows in relevantNodes, even though the raw graph makes
    // both recA and recB reachable from it. ----
    const defaultResult = await getRoomContext(db, 'fixture', {
      focusNodeId: 'claim:tam-large', topK: 10, maxDepth: 3,
    });
    const defaultTypes = defaultResult.relevantNodes.map((n) => n.type);
    assert.ok(defaultTypes.indexOf('chain_state') === -1,
      'a default focus must return zero chain_state rows in relevantNodes');
    assert.ok(defaultResult.relevantNodes.some((n) => n.id === 'claim:tam-small'),
      'a default focus must still surface real room content (claim:tam-small)');
    ok('Test 1: a default (non-chain_state) focus returns zero chain_state rows');

    // ---- Test 2: an explicit focus ON a chain_state record still reaches
    // its neighbors, INCLUDING sibling chain_state records -- the exclusion
    // is a default, not a wall. ----
    const chainFocusResult = await getRoomContext(db, 'fixture', {
      focusNodeId: recA, topK: 10, maxDepth: 2,
    });
    const chainFocusIds = chainFocusResult.relevantNodes.map((n) => n.id);
    assert.ok(chainFocusIds.indexOf(recB) !== -1,
      'an explicit focus on a chain_state record must still reach a sibling chain_state record (FEEDS_INTO)');
    assert.ok(chainFocusIds.indexOf('claim:tam-large') !== -1,
      'an explicit focus on a chain_state record must still reach its own SOURCED_FROM subject');
    ok('Test 2: an explicit focus on a chain_state record reaches its neighbors, siblings included');

    // ---- Test 4: the exclusion is applied APP-SIDE in legC, never in
    // NEIGHBORHOOD_SQL -- navigation.getNeighborhood called directly still
    // returns every type, chain_state included. ----
    const rawNeighborhood = getNeighborhood(db, 'claim:tam-large', { topK: 10, maxDepth: 3 });
    const rawIds = rawNeighborhood.map((n) => n.id);
    assert.ok(rawIds.indexOf(recA) !== -1,
      'getNeighborhood called directly must still surface the chain_state row (the SQL primitive is unfiltered)');
    ok('Test 4: getNeighborhood called directly returns every type; the guard lives in legC only');

    // ---- Test 5: legD's frozen CORTEX_NODE_TYPES is untouched: exactly
    // its five existing members, nothing quietly added. ----
    assert.deepStrictEqual(
      CORTEX_NODE_TYPES,
      ['memory_artifact', 'governing_thought', 'navigator_persona', 'decision', 'claim'],
      'CORTEX_NODE_TYPES must be unchanged: exactly its five existing members'
    );
    ok('Test 5: CORTEX_NODE_TYPES is untouched (five members, nothing quietly added)');
  } finally {
    db.close();
  }

  // ======================================================================
  // Test 3: a room with NO chain_state nodes at all returns a relevantNodes
  // array deep-strict-equal to the raw getNeighborhood call -- the filter
  // is a no-op where it has nothing to drop.
  // ======================================================================
  {
    const dbClean = buildFixtureDb();
    try {
      const result = await getRoomContext(dbClean, 'fixture', {
        focusNodeId: 'section:market-analysis', topK: 10, maxDepth: 2,
      });
      const raw = getNeighborhood(dbClean, 'section:market-analysis', { topK: 10, maxDepth: 2 });
      assert.deepStrictEqual(
        result.relevantNodes, raw,
        'a room with no chain_state nodes must return relevantNodes deep-strict-equal to the unfiltered getNeighborhood call'
      );
      ok('Test 3: a room with no chain_state nodes is a filter no-op (relevantNodes deep-equals the raw call)');
    } finally {
      dbClean.close();
    }
  }

  console.log(checks + ' checks passed.');
  process.exit(0);
}

main().catch((err) => {
  console.error('FAIL test-347-ranked-set-exclusion: ' + (err && err.stack ? err.stack : String(err)));
  process.exit(1);
});
