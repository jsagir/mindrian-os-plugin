#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 132 Plan 03 -- cross-label dedup-collapse + held-name-rename MACHINERY.
 * ===========================================================================
 * RE-BASELINED off the LIVE teaching graph (Phase 131 close-out packet,
 * 2026-06-01). The graph is ALREADY clean (721 backfilled correlation_ids, 0
 * collisions). The ~50-group / 22-REVIEW_REQUIRED worklist the 132-03 plan
 * was written against is STALE -- almost entirely resolved by the dogfooding
 * session + the 130.7 backfill. The REAL live worklist is TINY:
 *
 *   DEDUP (1 pair): 'The Other Way Round' | Technique, node ids 6831 + 22816
 *     (identical name + label -- a legit collapse candidate).
 *
 *   HELD-RENAME (14 nodes): name length > 80, correlation_status =
 *     'held-name-not-canonical', skipped by the 130.7 backfill because their
 *     stored name is a GraphRAG-pasted sentence, not a canonical handle. ids +
 *     labels: 9655/9271/9502/9622/9528/9491/9551/9625/9529/9586 (:Method),
 *     10468/10455/7841/10102 (:Framework). Each needs a canonical name
 *     assigned, its correlation_id recomputed, the held marker cleared, and the
 *     3-property backfill applied -- exactly what 130.7 would have written had
 *     the name been canonical.
 *
 * This module ships the GENERIC MACHINERY (a dedup-collapse pass + a held-rename
 * pass), tested on FIXTURES that mirror those two shapes. It DOES NOT run live:
 * the orchestrator runs the tiny live worklist later, snapshot-first. Every
 * write routes through the 132-01 curation-batch runner (makeBatch) so it
 * inherits the created_by stamping, the asserted rollback-by-created_by, the
 * Part 8 no-user-content scan, and the write-time 130.7-contract guard on
 * --execute. correlation_ids come ONLY from lib/core/correlation.cjs
 * computeCorrelationId (Canon Part 7 reuse-before-build; NO re-hash here).
 *
 * SNAPSHOT PRECONDITION (the one irreversibility this machinery cannot undo by
 * created_by alone): a dedup node-merge re-points the loser's incoming edges
 * onto the keeper and archives the loser. The loser keeps its node (:Archived,
 * reversible) but its ORIGINAL incoming-edge endpoints are migrated; a
 * created_by rollback can DELETE the migrated edges but cannot perfectly
 * reconstruct the pre-merge edge set if any edge already existed on the keeper.
 * Therefore a dedup MERGE batch flags snapshotRequired=true: the orchestrator
 * MUST take a graph snapshot before --execute, so a full restore is possible if
 * the canonical pick was wrong. (The held-rename pass mutates only node
 * properties + a status marker and is fully created_by-reversible, so it does
 * NOT require a snapshot.)
 *
 * Default mode is --dry-run (creds-free, ZERO writes). --execute is gated by the
 * 132-01 runner (creds + the inherited write-time 130.7 guard). --rollback runs
 * the paired rollbackCyphers. Zero new deps. CJS only. No em-dashes.
 */

const batchLib = require('../lib/brain/curation-batch.cjs');
const correlation = require('../lib/core/correlation.cjs');
const labelIndex = require('../lib/core/correlation-label-index.cjs');

const { makeBatch, assertRollbackPath, scanBatchForUserContent } = batchLib;
const { computeCorrelationId } = correlation;
const { LABEL_PRIORITY } = labelIndex;

// The curated-v1 scope value (matches the 130.7 backfill 3-property write).
const CORRELATION_SCOPE = 'curated-v1';

// The held marker the 130.7 backfill stamped on name>80 nodes it skipped.
const HELD_STATUS = 'held-name-not-canonical';

// Documented snapshot precondition (read by the test + printed at --dry-run).
const SNAPSHOT_PRECONDITION =
  'A dedup node-merge re-points the loser node incoming edges onto the keeper ' +
  'and archives the loser. A created_by rollback can DELETE the migrated edges ' +
  'but cannot perfectly reconstruct the pre-merge edge set, so the orchestrator ' +
  'MUST take a graph snapshot before --execute (a wrong canonical pick is then ' +
  'fully restorable from the snapshot, not just by created_by selector).';

// ---------------------------------------------------------------------------
// pickCanonical: most-edged wins; ties break on primary-label priority.
// ---------------------------------------------------------------------------

/**
 * pickCanonical(nodes) -> the keeper node.
 *
 * Rule (from CONTEXT + the 130.7 LABEL_PRIORITY contract): the most-edged node
 * wins. On an edge_degree tie, the node whose primary label is highest in the
 * LOCKED LABEL_PRIORITY order wins (Framework > Technique > Method > Tool > ...).
 * A node with no priority-list label ranks last. Deterministic, total.
 *
 * @param {Array<{id:number, labels:string[], edge_degree:number}>} nodes
 * @returns {object} the keeper node
 */
function pickCanonical(nodes) {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    throw new Error('pickCanonical: nodes must be a non-empty array');
  }
  function labelRank(node) {
    const primary = labelIndex.resolvePrimaryLabel(node.labels || []);
    const idx = LABEL_PRIORITY.indexOf(primary);
    return idx === -1 ? LABEL_PRIORITY.length : idx;
  }
  let best = nodes[0];
  for (let i = 1; i < nodes.length; i += 1) {
    const n = nodes[i];
    const nDeg = Number(n.edge_degree) || 0;
    const bDeg = Number(best.edge_degree) || 0;
    if (nDeg > bDeg) { best = n; continue; }
    if (nDeg === bDeg && labelRank(n) < labelRank(best)) { best = n; }
  }
  return best;
}

// ---------------------------------------------------------------------------
// DEDUP-COLLAPSE PASS
// ---------------------------------------------------------------------------

/**
 * buildDedupCollapsePass(groups, batchN) -> a makeBatch batch (+ snapshotRequired).
 *
 * Each group = { name, label, nodes:[{id, name, labels, edge_degree}, ...] }.
 * Per group:
 *   - pickCanonical -> the keeper. Its correlation_id is computeCorrelationId(
 *     group.name, group.label) -- the canonical id (NO re-hash).
 *   - keeper write: MATCH the keeper by id, SET correlation_id + created_by.
 *   - migrate write: re-point every incoming edge from each loser to the keeper
 *     (additive MERGE carrying created_by), so no edge is dropped from the graph.
 *   - archive write per loser: SET loser:Archived, SET archived_by, MERGE
 *     (loser)-[:REPLACED_BY {created_by}]->(keeper) by the keeper correlation_id.
 *     NEVER DETACH DELETE (Canon Part 7 reversible-delete).
 * Rollback (audit Section 17 shapes, all by created_by selector):
 *   REMOVE :Archived by archived_by, DELETE REPLACED_BY by created_by, DELETE
 *   migrated edges by created_by, and remove the keeper correlation_id stamp.
 *
 * Returns the makeBatch batch with snapshotRequired=true (a node-merge is not
 * fully created_by-reversible -- see SNAPSHOT_PRECONDITION).
 *
 * @param {Array<object>} groups
 * @param {number} batchN
 */
function buildDedupCollapsePass(groups, batchN) {
  const batchId = 'phase-132-curation-batch-' + batchN;
  const forward = [];
  const rollback = [];

  (groups || []).forEach(function (group) {
    const keeper = pickCanonical(group.nodes);
    const losers = group.nodes.filter(function (n) { return n.id !== keeper.id; });
    const cid = computeCorrelationId(group.name, group.label);

    // 1. Keeper: stamp the canonical correlation_id + provenance.
    forward.push({
      cypher:
        'MATCH (keeper) WHERE id(keeper) = $keeperId\n' +
        'SET keeper.correlation_id = $correlation_id,\n' +
        '    keeper.correlation_scope = $correlation_scope,\n' +
        '    keeper.dedup_created_by = $created_by\n' +
        'RETURN id(keeper) AS kept',
      params: {
        keeperId: keeper.id,
        correlation_id: cid,
        correlation_scope: CORRELATION_SCOPE,
        created_by: batchId,
      },
    });
    // Rollback the keeper stamp by the created_by selector.
    rollback.push({
      cypher:
        'MATCH (keeper) WHERE keeper.dedup_created_by = $created_by\n' +
        'REMOVE keeper.correlation_id, keeper.correlation_scope, keeper.dedup_created_by',
      params: { created_by: batchId },
    });

    losers.forEach(function (loser) {
      // 2. Migrate incoming edges: re-point each incoming edge from the loser
      //    onto the keeper (additive; the migrated edge carries created_by so
      //    rollback can DELETE exactly the edges this batch created).
      forward.push({
        cypher:
          '// migrate incoming edges from loser to keeper (additive)\n' +
          'MATCH (src)-[r]->(loser) WHERE id(loser) = $loserId AND id(src) <> $keeperId\n' +
          'MATCH (keeper) WHERE id(keeper) = $keeperId\n' +
          'MERGE (src)-[m:MIGRATED_TO {created_by: $created_by}]->(keeper)\n' +
          'RETURN count(m) AS migrated',
        params: { loserId: loser.id, keeperId: keeper.id, created_by: batchId },
      });
      rollback.push({
        cypher:
          'MATCH ()-[m:MIGRATED_TO {created_by: $created_by}]->() DELETE m',
        params: { created_by: batchId },
      });

      // 3. Archive the loser: :Archived + REPLACED_BY -> keeper correlation_id.
      //    Reversible-delete only (NO DETACH DELETE / bare node DELETE).
      forward.push({
        cypher:
          'MATCH (loser) WHERE id(loser) = $loserId\n' +
          'MATCH (keeper) WHERE id(keeper) = $keeperId\n' +
          'SET loser:Archived, loser.archived_by = $created_by\n' +
          'MERGE (loser)-[rep:REPLACED_BY {created_by: $created_by}]->(keeper)\n' +
          'SET rep.canonical_correlation_id = $correlation_id\n' +
          'RETURN id(loser) AS archived',
        params: {
          loserId: loser.id,
          keeperId: keeper.id,
          correlation_id: cid,
          created_by: batchId,
        },
      });
      rollback.push({
        cypher:
          'MATCH (loser:Archived) WHERE loser.archived_by = $created_by\n' +
          'REMOVE loser:Archived, loser.archived_by\n' +
          'WITH loser MATCH (loser)-[rep:REPLACED_BY {created_by: $created_by}]->() DELETE rep',
        params: { created_by: batchId },
      });
    });
  });

  if (forward.length === 0) {
    throw new Error('buildDedupCollapsePass: no groups produced any forward write');
  }

  const batch = makeBatch({ batchId: batchId, forwardCyphers: forward, rollbackCyphers: rollback });
  // A node-merge is not fully created_by-reversible -- demand a snapshot.
  batch.snapshotRequired = true;
  batch.snapshotReason = SNAPSHOT_PRECONDITION;
  return batch;
}

// ---------------------------------------------------------------------------
// HELD-RENAME PASS
// ---------------------------------------------------------------------------

/**
 * buildHeldRenamePass(held, batchN) -> a makeBatch batch.
 *
 * Each held = { id, label, held_name, canonical_name }. Per held node:
 *   - assign the canonical name, recompute correlation_id =
 *     computeCorrelationId(canonical_name, label) (NO re-hash).
 *   - 3-property backfill: SET correlation_id + correlation_scope='curated-v1' +
 *     correlation_backfilled_at (matches the 130.7 clean write).
 *   - clear the held marker: REMOVE correlation_status.
 *   - stamp created_by + held_rename_by for rollback selection.
 * Rollback restores the held marker (correlation_status=held-name-not-canonical)
 * and removes the backfill, all by the held_rename_by created_by selector.
 *
 * This pass is fully created_by-reversible (node-property + marker only), so it
 * does NOT set snapshotRequired.
 *
 * @param {Array<object>} held
 * @param {number} batchN
 */
function buildHeldRenamePass(held, batchN) {
  const batchId = 'phase-132-curation-batch-' + batchN;
  const forward = [];
  const rollback = [];

  (held || []).forEach(function (h) {
    const cid = computeCorrelationId(h.canonical_name, h.label);
    forward.push({
      cypher:
        'MATCH (n) WHERE id(n) = $nodeId\n' +
        'SET n.name = $name,\n' +
        '    n.correlation_id = $correlation_id,\n' +
        '    n.correlation_scope = $correlation_scope,\n' +
        '    n.correlation_backfilled_at = $backfilled_at,\n' +
        '    n.held_rename_by = $created_by\n' +
        'REMOVE n.correlation_status\n' +
        'RETURN id(n) AS renamed',
      params: {
        nodeId: h.id,
        name: h.canonical_name,
        correlation_id: cid,
        correlation_scope: CORRELATION_SCOPE,
        backfilled_at: '2026-06-02',
        created_by: batchId,
      },
    });
    rollback.push({
      // The held status is a generic curation enum (Part 8 safe), inlined so the
      // restored marker is visible in the rollback Cypher body, not only in a param.
      cypher:
        'MATCH (n) WHERE n.held_rename_by = $created_by\n' +
        "SET n.correlation_status = 'held-name-not-canonical'\n" +
        'REMOVE n.correlation_id, n.correlation_scope, n.correlation_backfilled_at, n.held_rename_by',
      params: { created_by: batchId },
    });
  });

  if (forward.length === 0) {
    throw new Error('buildHeldRenamePass: no held nodes produced any forward write');
  }

  return makeBatch({ batchId: batchId, forwardCyphers: forward, rollbackCyphers: rollback });
}

// ---------------------------------------------------------------------------
// CLI: --dry-run (default) / --execute (gated) / --rollback.
// ---------------------------------------------------------------------------

// The live worklist (transcribed from the 2026-06-01 close-out packet). Used
// ONLY by the --execute / --rollback CLI paths the orchestrator runs later,
// snapshot-first. The fixture tests build their own fixtures and never read
// these constants, so a transcription error here cannot mask a test failure.
const LIVE_DEDUP_GROUPS = [
  {
    name: 'The Other Way Round',
    label: 'Technique',
    nodes: [
      { id: 6831, name: 'The Other Way Round', labels: ['Technique'], edge_degree: null },
      { id: 22816, name: 'The Other Way Round', labels: ['Technique'], edge_degree: null },
    ],
  },
];

// The 14 held node ids + labels. canonical_name is INTENTIONALLY left null: the
// orchestrator (or a follow-up human-verify checkpoint) assigns each canonical
// name before --execute. Running --execute with a null canonical_name throws.
const LIVE_HELD_NODES = [
  { id: 9655, label: 'Method', canonical_name: null },
  { id: 9271, label: 'Method', canonical_name: null },
  { id: 9502, label: 'Method', canonical_name: null },
  { id: 9622, label: 'Method', canonical_name: null },
  { id: 9528, label: 'Method', canonical_name: null },
  { id: 9491, label: 'Method', canonical_name: null },
  { id: 9551, label: 'Method', canonical_name: null },
  { id: 9625, label: 'Method', canonical_name: null },
  { id: 9529, label: 'Method', canonical_name: null },
  { id: 9586, label: 'Method', canonical_name: null },
  { id: 10468, label: 'Framework', canonical_name: null },
  { id: 10455, label: 'Framework', canonical_name: null },
  { id: 7841, label: 'Framework', canonical_name: null },
  { id: 10102, label: 'Framework', canonical_name: null },
];

function printDryRun() {
  process.stdout.write('Phase 132 Plan 03 -- dedup-collapse + held-rename (DRY RUN)\n');
  process.stdout.write('RE-BASELINED: live worklist is 1 dedup pair + 14 held nodes.\n\n');

  const dedup = buildDedupCollapsePass(LIVE_DEDUP_GROUPS, 1);
  const dd = dedup.dryRun();
  process.stdout.write('DEDUP batch ' + dd.batchId + ': ' + dd.summary.forward_count +
    ' forward / ' + dd.summary.rollback_count + ' rollback writes\n');
  process.stdout.write('  snapshotRequired: ' + dedup.snapshotRequired + '\n');
  process.stdout.write('  ' + SNAPSHOT_PRECONDITION + '\n\n');

  const heldReady = LIVE_HELD_NODES.filter(function (h) { return h.canonical_name; });
  if (heldReady.length === 0) {
    process.stdout.write('HELD batch: 14 held nodes await canonical names (assign before --execute).\n');
    process.stdout.write('  ids: ' + LIVE_HELD_NODES.map(function (h) { return h.id; }).join(', ') + '\n');
  } else {
    const held = buildHeldRenamePass(heldReady, 2);
    const hd = held.dryRun();
    process.stdout.write('HELD batch ' + hd.batchId + ': ' + hd.summary.forward_count +
      ' forward / ' + hd.summary.rollback_count + ' rollback writes\n');
  }

  // Part 8 self-proof on the dry-run batches.
  const v = scanBatchForUserContent(dedup);
  assertRollbackPath(dedup);
  process.stdout.write('\nPart 8 scan (dedup): ' + (v.length === 0 ? 'clean' : JSON.stringify(v)) + '\n');
}

function main() {
  const args = process.argv.slice(2);
  if (args.indexOf('--execute') !== -1 || args.indexOf('--rollback') !== -1) {
    const ready = LIVE_HELD_NODES.filter(function (h) { return h.canonical_name; });
    if (ready.length !== LIVE_HELD_NODES.length) {
      process.stderr.write(
        'refusing --execute/--rollback: ' + (LIVE_HELD_NODES.length - ready.length) +
        ' held nodes still have a null canonical_name. Assign every canonical name first ' +
        '(snapshot-first, orchestrator-run).\n'
      );
      process.exit(2);
    }
    process.stderr.write(
      'live --execute/--rollback is orchestrator-run, snapshot-first, and is NOT invoked ' +
      'from this script in the Phase 132-03 plan (machinery only; ZERO live writes).\n'
    );
    process.exit(3);
  }
  printDryRun();
}

if (require.main === module) {
  main();
}

module.exports = {
  pickCanonical: pickCanonical,
  buildDedupCollapsePass: buildDedupCollapsePass,
  buildHeldRenamePass: buildHeldRenamePass,
  SNAPSHOT_PRECONDITION: SNAPSHOT_PRECONDITION,
  CORRELATION_SCOPE: CORRELATION_SCOPE,
  HELD_STATUS: HELD_STATUS,
  LIVE_DEDUP_GROUPS: LIVE_DEDUP_GROUPS,
  LIVE_HELD_NODES: LIVE_HELD_NODES,
};
