#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 132 Plan 01 Task 1 -- fixture tests for the curation-batch runner.
 *
 * Six behaviors, all on FIXTURES with NEO4J_* unset so the suite never
 * touches a live Brain:
 *   1. provenance stamping: every forward write carries created_by == batchId.
 *   2. rollback pairing required: a batch with empty rollbackCyphers is
 *      rejected at construction (the reversibility contract).
 *   3. dry-run touches nothing: dryRun() returns forward + rollback + summary,
 *      constructs NO driver session, runs NO contract probe, needs NO creds.
 *   4. rollback restores by selector: each rollback Cypher references the SAME
 *      created_by selector its paired forward write stamped.
 *   5. Part 8 shape: scanBatchForUserContent returns [] for a handles-only
 *      batch, non-empty when a Cypher embeds a user-content token.
 *   6. write-time 130.7-contract guard: assertCorrelationContractPresent throws
 *      a blocked-on-130.7 error on a zero probe count and passes on >=1;
 *      execute() runs the probe FIRST and refuses (zero forward writes) when the
 *      probe finds zero correlation_id nodes; proceeds when the probe finds >=1.
 *      Asserted via an injected fake runner -- no live Brain needed.
 *
 * Zero new deps. node:assert/strict + the module under test only.
 */
'use strict';

// Hard-clear NEO4J creds so a developer's shell env can never make this suite
// reach a live Brain. dry-run + the pure predicates need no creds.
delete process.env.NEO4J_URI;
delete process.env.NEO4J_USER;
delete process.env.NEO4J_PASSWORD;

const assert = require('node:assert/strict');
const b = require('../brain/curation-batch.cjs');

let passed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }

// Shared fixtures: a handles-only batch (Part 8 clean).
function cleanForward(batchId) {
  return [
    {
      cypher: 'MERGE (n:AuthorshipEvent {id: $id}) SET n.created_by = $created_by, n.year = $year',
      params: { id: 'ae-russell-ackoff-idealized-design', created_by: batchId, year: 1981 },
    },
    {
      cypher: 'MATCH (e:AuthorshipEvent {id: $id}), (p:Person {name: $person}) MERGE (e)-[r:AUTHORED_IN_EVENT]->(p) SET r.created_by = $created_by',
      params: { id: 'ae-russell-ackoff-idealized-design', person: 'Russell Ackoff', created_by: batchId },
    },
  ];
}
function cleanRollback(batchId) {
  return [
    { cypher: 'MATCH ()-[r {created_by: $by}]-() DELETE r', params: { by: batchId } },
    { cypher: 'MATCH (n {created_by: $by}) DETACH DELETE n', params: { by: batchId } },
  ];
}

// Test 1: provenance stamping ----------------------------------------------
(function test1_provenanceStamping() {
  const batchId = 'phase-132-curation-batch-1';
  const batch = b.makeBatch({
    batchId,
    forwardCyphers: cleanForward(batchId),
    rollbackCyphers: cleanRollback(batchId),
  });
  const d = batch.dryRun();
  for (const w of d.forward) {
    assert.equal(w.params.created_by, b.BATCH_PROVENANCE_PREFIX + batchId,
      'every forward write carries created_by == prefix + batchId');
  }
  // A forward Cypher missing the created_by binding makes makeBatch throw.
  assert.throws(function () {
    b.makeBatch({
      batchId,
      forwardCyphers: [{ cypher: 'MERGE (n:X {id: $id})', params: { id: 'x' } }],
      rollbackCyphers: cleanRollback(batchId),
    });
  }, /created_by/, 'forward write missing created_by is rejected');
  ok('test1 provenance stamping');
})();

// Test 2: rollback pairing required ----------------------------------------
(function test2_rollbackPairingRequired() {
  const batchId = 'phase-132-curation-batch-2';
  assert.throws(function () {
    b.makeBatch({
      batchId,
      forwardCyphers: cleanForward(batchId),
      rollbackCyphers: [],
    });
  }, /rollback/i, 'empty rollbackCyphers rejected at construction');
  ok('test2 rollback pairing required');
})();

// Test 3: dry-run touches nothing (creds-free + ungated) -------------------
(function test3_dryRunTouchesNothing() {
  assert.equal(process.env.NEO4J_URI, undefined, 'NEO4J_URI must be unset for this test');
  const batchId = 'phase-132-curation-batch-3';
  const batch = b.makeBatch({
    batchId,
    forwardCyphers: cleanForward(batchId),
    rollbackCyphers: cleanRollback(batchId),
  });
  const d = batch.dryRun();
  assert.ok(Array.isArray(d.forward) && d.forward.length === 2, 'forward list returned');
  assert.ok(Array.isArray(d.rollback) && d.rollback.length === 2, 'rollback list returned');
  assert.ok(d.summary && typeof d.summary === 'object', 'summary object returned');
  assert.equal(d.summary.forward_count, 2, 'summary counts forward writes');
  assert.equal(d.summary.rollback_count, 2, 'summary counts rollback writes');
  assert.equal(d.summary.touched_brain, false, 'dry-run touches Brain zero times');
  ok('test3 dry-run touches nothing');
})();

// Test 4: rollback restores by selector ------------------------------------
(function test4_rollbackBySelector() {
  const batchId = 'phase-132-curation-batch-4';
  const batch = b.makeBatch({
    batchId,
    forwardCyphers: cleanForward(batchId),
    rollbackCyphers: cleanRollback(batchId),
  });
  // assertRollbackPath returns true when every rollback names the batch selector.
  assert.equal(b.assertRollbackPath(batch), true, 'rollback path asserts true for matched selector');

  // A rollback that targets a DIFFERENT batch selector is rejected.
  assert.throws(function () {
    const bad = b.makeBatch({
      batchId,
      forwardCyphers: cleanForward(batchId),
      rollbackCyphers: [
        { cypher: 'MATCH (n {created_by: $by}) DETACH DELETE n', params: { by: 'phase-132-curation-batch-99' } },
      ],
    });
    b.assertRollbackPath(bad);
  }, /selector|created_by|batch/i, 'rollback targeting a different batch selector is rejected');
  ok('test4 rollback restores by selector');
})();

// Test 5: Part 8 shape -----------------------------------------------------
(function test5_part8Shape() {
  const batchId = 'phase-132-curation-batch-5';
  const cleanBatch = b.makeBatch({
    batchId,
    forwardCyphers: cleanForward(batchId),
    rollbackCyphers: cleanRollback(batchId),
  });
  assert.deepEqual(b.scanBatchForUserContent(cleanBatch), [], 'handles-only batch is Part 8 clean');

  const dirtyBatch = b.makeBatch({
    batchId,
    forwardCyphers: [
      {
        cypher: 'MERGE (n:Note {id: $id}) SET n.body = $body, n.created_by = $created_by',
        params: { id: 'n1', body: 'meeting transcript from MindrianRooms', created_by: batchId },
      },
    ],
    rollbackCyphers: cleanRollback(batchId),
  });
  const violations = b.scanBatchForUserContent(dirtyBatch);
  assert.ok(violations.length > 0, 'a Cypher embedding a user-content token is flagged');
  ok('test5 Part 8 shape');
})();

// Test 6: write-time 130.7-contract guard ----------------------------------
(function test6_contractGuard() {
  // Pure predicate: zero -> throws blocked-on-130.7; >=1 -> passes.
  assert.throws(function () { b.assertCorrelationContractPresent(0); }, /130\.7/,
    'assertCorrelationContractPresent(0) throws blocked-on-130.7');
  assert.equal(b.assertCorrelationContractPresent(1), true,
    'assertCorrelationContractPresent(1) passes');
  assert.equal(b.assertCorrelationContractPresent(721), true,
    'assertCorrelationContractPresent(721) passes');

  const batchId = 'phase-132-curation-batch-6';
  const batch = b.makeBatch({
    batchId,
    forwardCyphers: cleanForward(batchId),
    rollbackCyphers: cleanRollback(batchId),
  });

  // Inject a fake runner whose probe returns count 0 -> execute() refuses,
  // ZERO forward writes attempted, the blocked error surfaces.
  let forwardWritesWhenAbsent = 0;
  const fakeAbsent = {
    runProbe: function () { return 0; },
    runWrite: function () { forwardWritesWhenAbsent += 1; return { ok: true }; },
  };
  assert.throws(function () {
    batch.execute({ runner: fakeAbsent });
  }, /130\.7|blocked/i, 'execute() refuses when the contract probe finds zero correlation_ids');
  assert.equal(forwardWritesWhenAbsent, 0, 'zero forward writes attempted when contract absent');

  // Inject a fake runner whose probe returns count 1 -> execute() proceeds to
  // the forward writes.
  let forwardWritesWhenPresent = 0;
  const fakePresent = {
    runProbe: function () { return 1; },
    runWrite: function () { forwardWritesWhenPresent += 1; return { ok: true }; },
  };
  const res = batch.execute({ runner: fakePresent });
  assert.equal(forwardWritesWhenPresent, batch.dryRun().forward.length,
    'execute() runs every forward write when contract present');
  assert.ok(res && res.executed === true, 'execute() reports executed when contract present');

  // dry-run is NOT subject to the guard (re-assert creds-free dry-run).
  const d = batch.dryRun();
  assert.ok(d.forward.length > 0 && d.summary.touched_brain === false,
    'dry-run stays creds-free and ungated');
  ok('test6 write-time 130.7-contract guard');
})();

process.stdout.write('\ncuration-batch.test.cjs: ' + passed + '/6 behaviors green\n');
