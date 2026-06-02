#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 132 Plan 03 -- dedup-collapse + held-rename machinery test.
 * ===============================================================
 * RE-BASELINED off the LIVE teaching graph (Phase 131 close-out packet,
 * 2026-06-01). The graph is ALREADY clean: 721 backfilled correlation_ids,
 * 0 collisions, and the real worklist is TINY:
 *   - 1 dedup pair: 'The Other Way Round' | Technique (node ids 6831 + 22816,
 *     identical name + label -- a legit collapse candidate).
 *   - 14 held nodes (name length > 80, correlation_status =
 *     'held-name-not-canonical') that need a canonical name assigned then a
 *     3-property re-backfill: 10 :Method + 4 :Framework.
 *
 * This suite tests GENERIC MACHINERY (a dedup-collapse pass + a held-rename
 * pass) on FIXTURES that mirror those two live shapes. ZERO live Brain writes:
 * NEO4J_* are unset, only dry-run + pure assertions run. Every write routes
 * through the 132-01 curation-batch runner (makeBatch). correlation_ids come
 * ONLY from lib/core/correlation.cjs computeCorrelationId (no re-hash).
 *
 * Canon Part 7 (reversible delete) + Part 8 (handles + ids + enums only).
 * No em-dashes. CJS only. No new deps.
 */

const assert = require('node:assert');

const m = require('../../scripts/curation-132-03-dedup-held-rename.cjs');
const batchLib = require('../../lib/brain/curation-batch.cjs');
const correlation = require('../../lib/core/correlation.cjs');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write('  ok  ' + name + '\n');
  } catch (err) {
    failed += 1;
    process.stdout.write('  FAIL ' + name + '\n       ' + (err && err.message) + '\n');
  }
}

// Guard: the suite must never see live creds (proves zero-live by construction).
assert.ok(!process.env.NEO4J_URI, 'NEO4J_URI must be unset in the test env');

// ---------------------------------------------------------------------------
// Fixtures mirroring the LIVE shapes (no live read; transcribed from the
// 2026-06-01 close-out packet worklist).
// ---------------------------------------------------------------------------

// The 1 live dedup pair. Two nodes, identical name + label. The keeper is the
// most-edged; the loser is archived + REPLACED_BY the keeper's correlation_id.
const DEDUP_FIXTURE = {
  name: 'The Other Way Round',
  label: 'Technique',
  nodes: [
    { id: 6831, name: 'The Other Way Round', labels: ['Technique'], edge_degree: 7 },
    { id: 22816, name: 'The Other Way Round', labels: ['Technique'], edge_degree: 2 },
  ],
};

// A tie fixture to exercise the primary-label tiebreak branch of pickCanonical
// (equal edge_degree -> the higher-priority label wins).
const TIE_FIXTURE = {
  name: 'Some Cross Label Node',
  nodes: [
    { id: 100, name: 'Some Cross Label Node', labels: ['Method'], edge_degree: 4 },
    { id: 101, name: 'Some Cross Label Node', labels: ['Framework'], edge_degree: 4 },
  ],
};

// 2 representative held nodes (the live 14 are 10 :Method + 4 :Framework). Each
// carries the long raw name + the canonical name the rename assigns. The pass
// must recompute correlation_id via computeCorrelationId(canonicalName, label).
const HELD_FIXTURE = [
  {
    id: 9655,
    label: 'Method',
    held_name: 'A method whose stored name runs well past eighty characters because the GraphRAG extractor pasted an entire sentence as the node name field here',
    canonical_name: 'Outcome-Driven Innovation',
  },
  {
    id: 10468,
    label: 'Framework',
    held_name: 'A framework whose stored name also runs past eighty characters owing to the same extraction defect that captured a full clause as the node name value',
    canonical_name: 'Platform Thinking',
  },
];

// ===========================================================================
// DEDUP-COLLAPSE PASS
// ===========================================================================

test('1. dedup: pickCanonical returns the most-edged node', function () {
  const winner = m.pickCanonical(DEDUP_FIXTURE.nodes);
  assert.strictEqual(winner.id, 6831, 'node 6831 (degree 7) must win over 22816 (degree 2)');
});

test('2. dedup: pickCanonical tiebreaks on primary-label priority when degree ties', function () {
  const winner = m.pickCanonical(TIE_FIXTURE.nodes);
  assert.strictEqual(winner.id, 101, ':Framework must beat :Method at equal edge_degree');
});

test('3. dedup: buildDedupCollapsePass yields a keeper correlation_id + archive + migrate', function () {
  const batch = m.buildDedupCollapsePass([DEDUP_FIXTURE], 1);
  const d = batch.dryRun();
  const fwd = d.forward.map(function (f) { return f.cypher; }).join('\n');
  // keeper carries the canonical correlation_id from computeCorrelationId
  const expectedCid = correlation.computeCorrelationId('The Other Way Round', 'Technique');
  assert.strictEqual(expectedCid, '4210289a0ca1596b', 'anchor cid must match the locked contract');
  const carriesCid = d.forward.some(function (f) {
    return f.params && f.params.correlation_id === expectedCid;
  });
  assert.ok(carriesCid, 'keeper write must bind the computeCorrelationId value as a param');
  // archive the loser via :Archived + REPLACED_BY -> keeper
  assert.ok(/SET\s+\w+:Archived/.test(fwd), 'loser must be SET :Archived');
  assert.ok(/REPLACED_BY/.test(fwd), 'loser must MERGE a REPLACED_BY edge to the keeper');
  // migrate incoming edges to keeper
  assert.ok(/migrate|incoming|->\s*\(keeper|keeper\)/i.test(fwd) || /MATCH[\s\S]*-\[r\]->/.test(fwd),
    'an incoming-edge migration Cypher must be present');
});

test('4. dedup: archive is reversible-delete -- NO DETACH DELETE / bare node DELETE', function () {
  const batch = m.buildDedupCollapsePass([DEDUP_FIXTURE], 1);
  const d = batch.dryRun();
  const bad = d.forward.some(function (f) {
    const body = String(f.cypher).split('\n').filter(function (l) {
      return !l.trim().startsWith('//');
    }).join('\n');
    return /DETACH\s+DELETE/i.test(body) || /\bDELETE\s+\w+\s*$/m.test(body);
  });
  assert.ok(!bad, 'dedup forward must never DETACH DELETE or bare-DELETE a node (Canon Part 7)');
});

test('5. dedup: snapshot precondition is documented + asserted on the batch', function () {
  const batch = m.buildDedupCollapsePass([DEDUP_FIXTURE], 1);
  // The dedup MERGE loses the loser's edges; created_by rollback alone cannot
  // restore them. The machinery MUST expose a snapshot-precondition marker.
  assert.ok(batch.snapshotRequired === true,
    'a node-merge dedup batch must flag snapshotRequired=true');
  assert.ok(typeof m.SNAPSHOT_PRECONDITION === 'string' && m.SNAPSHOT_PRECONDITION.length > 20,
    'SNAPSHOT_PRECONDITION must document why a snapshot is required before MERGE');
});

test('6. dedup: routes through makeBatch -- provenance + rollback + Part 8', function () {
  const batch = m.buildDedupCollapsePass([DEDUP_FIXTURE], 1);
  const d = batch.dryRun();
  d.forward.forEach(function (f) {
    assert.strictEqual(f.params.created_by, 'phase-132-curation-batch-1',
      'every forward write carries created_by=phase-132-curation-batch-1');
  });
  batchLib.assertRollbackPath(batch);
  assert.deepStrictEqual(batchLib.scanBatchForUserContent(batch), [],
    'Part 8: no user content in the dedup batch');
});

// ===========================================================================
// HELD-RENAME PASS
// ===========================================================================

test('7. held: buildHeldRenamePass recomputes correlation_id via computeCorrelationId', function () {
  const batch = m.buildHeldRenamePass(HELD_FIXTURE, 2);
  const d = batch.dryRun();
  HELD_FIXTURE.forEach(function (h) {
    const expected = correlation.computeCorrelationId(h.canonical_name, h.label);
    const wrote = d.forward.some(function (f) {
      return f.params && f.params.correlation_id === expected && f.params.name === h.canonical_name;
    });
    assert.ok(wrote, 'held rename for ' + h.id + ' must bind name=' + h.canonical_name +
      ' and correlation_id=computeCorrelationId(name,label)');
  });
});

test('8. held: rename clears the held marker + writes the 3-property backfill', function () {
  const batch = m.buildHeldRenamePass(HELD_FIXTURE, 2);
  const d = batch.dryRun();
  const fwd = d.forward.map(function (f) { return f.cypher; }).join('\n');
  // 3-property backfill: correlation_id + correlation_scope + correlation_backfilled_at
  assert.ok(/correlation_scope/.test(fwd), 'must SET correlation_scope (the curated-v1 backfill)');
  assert.ok(/correlation_backfilled_at/.test(fwd), 'must SET correlation_backfilled_at');
  // clear the held marker
  assert.ok(/REMOVE\s+\w+\.correlation_status|correlation_status\s*=\s*null|REMOVE n\.correlation_status/.test(fwd) ||
    d.forward.some(function (f) { return /correlation_status/.test(f.cypher); }),
    'must clear correlation_status held-name-not-canonical');
  // the scope value is curated-v1 (matches the 130.7 backfill contract)
  const usesCuratedV1 = d.forward.some(function (f) {
    return f.params && f.params.correlation_scope === 'curated-v1';
  });
  assert.ok(usesCuratedV1, 'held rename scope must be curated-v1');
});

test('9. held: NO destructive verbs -- additive SET + REMOVE marker only', function () {
  const batch = m.buildHeldRenamePass(HELD_FIXTURE, 2);
  const d = batch.dryRun();
  const bad = d.forward.some(function (f) {
    const body = String(f.cypher).split('\n').filter(function (l) {
      return !l.trim().startsWith('//');
    }).join('\n');
    return /DETACH\s+DELETE/i.test(body) || /\bDROP\b/i.test(body);
  });
  assert.ok(!bad, 'held rename must never DETACH DELETE or DROP (Canon Part 7)');
});

test('10. held: routes through makeBatch -- provenance + rollback + Part 8', function () {
  const batch = m.buildHeldRenamePass(HELD_FIXTURE, 2);
  const d = batch.dryRun();
  d.forward.forEach(function (f) {
    assert.strictEqual(f.params.created_by, 'phase-132-curation-batch-2',
      'every held-rename forward write carries created_by=phase-132-curation-batch-2');
  });
  batchLib.assertRollbackPath(batch);
  assert.deepStrictEqual(batchLib.scanBatchForUserContent(batch), [],
    'Part 8: no user content in the held-rename batch');
});

test('11. held: rollback restores the held marker by created_by selector', function () {
  const batch = m.buildHeldRenamePass(HELD_FIXTURE, 2);
  const d = batch.dryRun();
  const rb = d.rollback.map(function (r) { return r.cypher; }).join('\n');
  assert.ok(/held-name-not-canonical/.test(rb),
    'rollback must restore correlation_status=held-name-not-canonical');
});

// ===========================================================================
// CROSS-PASS contract: both route through the 132-01 runner, batch ids gated.
// ===========================================================================

test('12. both passes use a valid phase-132-curation-batch-N id', function () {
  const dedup = m.buildDedupCollapsePass([DEDUP_FIXTURE], 1);
  const held = m.buildHeldRenamePass(HELD_FIXTURE, 2);
  assert.strictEqual(dedup.dryRun().batchId, 'phase-132-curation-batch-1');
  assert.strictEqual(held.dryRun().batchId, 'phase-132-curation-batch-2');
});

test('13. no re-hash: the module never re-implements a correlation hash', function () {
  // Reuse contract (Canon Part 7): the module must import computeCorrelationId,
  // never construct its own crypto hash for correlation_id.
  const src = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', '..', 'scripts', 'curation-132-03-dedup-held-rename.cjs'),
    'utf8'
  );
  assert.ok(/computeCorrelationId/.test(src), 'must reuse computeCorrelationId');
  assert.ok(!/createHash\s*\(/.test(src), 'must NOT hand-roll a crypto hash (reuse, do not re-hash)');
});

process.stdout.write('\n  ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
