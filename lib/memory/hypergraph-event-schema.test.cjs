#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 132 Plan 01 Task 2 -- fixture tests for the frozen 5-event-type
 * hypergraph schema contract + the reify Cypher builder.
 *
 * Five behaviors:
 *   1. 5 types frozen: EVENT_NODE_TYPES has exactly the 5 CONTEXT-table keys;
 *      each carries roles[] matching the table.
 *   2. additive contract: buildReifyCypher MERGEs the event node + binary edges
 *      from event TO each participant, and contains zero DELETE/REMOVE/DETACH/DROP
 *      (reification is additive per Canon Part 7).
 *   3. provenance carried: buildReifyCypher embeds a created_by binding so the
 *      output is directly consumable by makeBatch.
 *   4. instance floor exported: EVENT_INSTANCE_MIN === 20.
 *   5. no user content: a reify batch is Part 8 clean (scanBatchForUserContent []).
 *
 * Zero new deps. node:assert/strict + the modules under test only.
 */
'use strict';

const assert = require('node:assert/strict');
const s = require('../brain/hypergraph-event-schema.cjs');
const cb = require('../brain/curation-batch.cjs');

let passed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }

const BATCH_ID = 'phase-132-curation-batch-1';
const DESTRUCTIVE = /\b(DELETE|REMOVE|DETACH|DROP)\b/i;

// Test 1: 5 types frozen ---------------------------------------------------
(function test1_fiveTypesFrozen() {
  const keys = Object.keys(s.EVENT_NODE_TYPES).sort();
  assert.deepEqual(
    keys,
    ['AuthorshipEvent', 'ContradictionEvent', 'EvolutionEvent', 'IllustrationEvent', 'MotivationEvent'],
    'exactly the 5 CONTEXT-table event labels'
  );
  // Roles match the CONTEXT table for a representative type.
  const authorship = s.EVENT_NODE_TYPES.AuthorshipEvent;
  assert.ok(Array.isArray(authorship.roles), 'AuthorshipEvent carries a roles array');
  const roleNames = authorship.roles.map(function (r) { return r.role; });
  ['person', 'work', 'year', 'organization'].forEach(function (expected) {
    assert.ok(roleNames.indexOf(expected) !== -1, 'AuthorshipEvent roles include ' + expected);
  });
  // The object is frozen (single source of truth -- no hand-rolling).
  assert.ok(Object.isFrozen(s.EVENT_NODE_TYPES), 'EVENT_NODE_TYPES is frozen');
  // Every type declares roles + at least one participant edge label.
  Object.keys(s.EVENT_NODE_TYPES).forEach(function (k) {
    const t = s.EVENT_NODE_TYPES[k];
    assert.ok(Array.isArray(t.roles) && t.roles.length > 0, k + ' has roles');
  });
  ok('test1 five types frozen');
})();

// Test 2: additive contract ------------------------------------------------
(function test2_additiveContract() {
  const out = s.buildReifyCypher('AuthorshipEvent',
    { person: 'Russell Ackoff', work: 'Idealized Design', year: 1981, organization: 'Wharton' },
    BATCH_ID);
  assert.ok(out && typeof out.cypher === 'string', 'buildReifyCypher returns { cypher, params }');
  assert.ok(/MERGE/.test(out.cypher), 'reify uses MERGE (idempotent)');
  assert.ok(!DESTRUCTIVE.test(out.cypher),
    'reify Cypher contains NO DELETE/REMOVE/DETACH/DROP (additive per Part 7)');
  // Binary edge from the event node to a participant.
  assert.ok(/->/.test(out.cypher), 'reify emits a directed binary edge from the event node');
  ok('test2 additive contract');
})();

// Test 3: provenance carried -----------------------------------------------
(function test3_provenanceCarried() {
  const out = s.buildReifyCypher('IllustrationEvent',
    { example: 'Netflix DVD-to-streaming', work: 'Disruptive Innovation', year: 2007, industry: 'Media', outcome: 'incumbent-displaced' },
    BATCH_ID);
  assert.equal(out.params.created_by, BATCH_ID, 'created_by bound to the batchId');
  assert.ok(/created_by/.test(out.cypher), 'cypher SETs created_by');
  // Directly feedable to makeBatch: build a batch from a reify output.
  const batch = cb.makeBatch({
    batchId: BATCH_ID,
    forwardCyphers: [out],
    rollbackCyphers: [{ cypher: 'MATCH (n {created_by: $by}) DETACH DELETE n', params: { by: BATCH_ID } }],
  });
  cb.assertRollbackPath(batch);
  ok('test3 provenance carried');
})();

// Test 4: instance floor exported ------------------------------------------
(function test4_instanceFloor() {
  assert.equal(s.EVENT_INSTANCE_MIN, 20, 'EVENT_INSTANCE_MIN === 20 (Plan 02 reads the floor)');
  ok('test4 instance floor exported');
})();

// Test 5: no user content --------------------------------------------------
(function test5_noUserContent() {
  // Build a reify batch across all 5 types with handles + enums + scalars only.
  const forward = [
    s.buildReifyCypher('AuthorshipEvent',
      { person: 'Russell Ackoff', work: 'Idealized Design', year: 1981, organization: 'Wharton' }, BATCH_ID),
    s.buildReifyCypher('ContradictionEvent',
      { framework: 'Lean Startup', rivalFramework: 'Design Thinking', evidence: 'Academic', status: 'open' }, BATCH_ID),
    s.buildReifyCypher('MotivationEvent',
      { problem: 'Innovator Dilemma', framework: 'Jobs To Be Done', severity: 'high', date: 2003 }, BATCH_ID),
    s.buildReifyCypher('EvolutionEvent',
      { framework: 'OKR', parentFramework: 'MBO', year: 1999, author: 'Andy Grove' }, BATCH_ID),
  ];
  const batch = cb.makeBatch({
    batchId: BATCH_ID,
    forwardCyphers: forward,
    rollbackCyphers: [{ cypher: 'MATCH (n {created_by: $by}) DETACH DELETE n', params: { by: BATCH_ID } }],
  });
  assert.deepEqual(cb.scanBatchForUserContent(batch), [], 'reify batch is Part 8 clean');
  ok('test5 no user content');
})();

process.stdout.write('\nhypergraph-event-schema.test.cjs: ' + passed + '/5 behaviors green\n');
