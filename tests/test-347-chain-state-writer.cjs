#!/usr/bin/env node
'use strict';
/*
 * tests/test-347-chain-state-writer.cjs -- Phase 347-02 Task 2.
 *
 * Pins lib/core/navigation/chain-state.cjs's writer contract BEFORE the
 * writer exists (docs/2026-09-14-CHAIN-SHARED-STATE-CONTRACT.md, Sections
 * 3-5). Authored first so the writer is built to satisfy this test rather
 * than the test written to describe whatever the writer did.
 *
 * The require below throws a module-resolution error until plan 347-03
 * lands the writer. This is the EXPECTED-RED state tests/run-all-347.sh's
 * run_red_until helper measures for SHARED-01; it is deliberately NOT
 * wrapped in a try-catch that would turn the writer's absence into a pass.
 * A pin that passes before its subject exists is the defect run_red_until
 * was written to catch.
 *
 * The five epistemic_type values below are asserted against a LOCAL frozen
 * mapping, sourced from docs/2026-09-14-CHAIN-SHARED-STATE-CONTRACT.md
 * Section 4 (never re-derived, never imported from the writer under test,
 * since importing it from the writer would let the writer grade its own
 * homework).
 *
 * Plain node:assert CJS script, one file per behavior cluster (the repo's
 * own convention: tests/test-347-layer-graph-declaration.cjs,
 * tests/test-343-room-graph-integrity.cjs). Hyphens only, no em-dashes
 * (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');

const { buildChainFixtureRoom, closeChainFixtureRoom, SCHEMA_VARIANTS } =
  require(path.join(REPO, 'tests', 'helpers', 'fixture-room-347.cjs'));

// The writer under test. Deliberately UNGUARDED: while plan 347-03 has not
// landed lib/core/navigation/chain-state.cjs, this require throws and the
// whole file exits non-zero, which is exactly the EXPECTED-RED state
// tests/run-all-347.sh's run_red_until helper reports for SHARED-01. Do NOT
// wrap this in a try-catch -- a pin that passes before its writer exists
// proves nothing.
const chainState = require(path.join(REPO, 'lib', 'core', 'navigation', 'chain-state.cjs'));

// Section 4 of docs/2026-09-14-CHAIN-SHARED-STATE-CONTRACT.md, copied here
// as the source of record so drift between the contract and the writer is
// visible in review (never imported from the writer under test).
const KIND_TO_EPISTEMIC_TYPE = Object.freeze({
  task: 'observation',
  draft: 'model_derived_assertion',
  notes: 'derived_fact',
  judgment: 'interpretation',
  gate_decision: 'decision',
});
const FIVE_KINDS = Object.freeze(Object.keys(KIND_TO_EPISTEMIC_TYPE));

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

function makeScratchDir(suffix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-347-writer-' + suffix + '-'));
}

function nodeRow(db, nodeId) {
  return db.prepare('SELECT id, type, properties FROM nodes WHERE id = ?').get(nodeId);
}

function nodeCount(db) {
  return db.prepare('SELECT count(*) AS c FROM nodes').get().c;
}

function edgeRows(db, edgeType) {
  return db.prepare('SELECT source, target, properties FROM edges WHERE type = ?').all(edgeType);
}

function reviewStatusColumnPresent(db) {
  try {
    return db.prepare('PRAGMA table_info(nodes)').all().some((c) => c && c.name === 'review_status');
  } catch (_e) {
    return false;
  }
}

function readReviewStatus(db, nodeId) {
  // Honest per lib/core/navigation/CONTEXT.md's "Three schema variants, one
  // rule": a column the schema cannot answer reports undefined here, never a
  // fabricated value. The legacy 3-column fixture has no review_status
  // column at all; the writer's own review_status discipline (WD-347-3) can
  // only be measured where the column exists.
  if (!reviewStatusColumnPresent(db)) return undefined;
  const row = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(nodeId);
  return row ? row.review_status : undefined;
}

console.log('test-347-chain-state-writer:');

for (const variant of SCHEMA_VARIANTS) {
  console.log(' variant: ' + variant);
  const tmpDir = makeScratchDir(variant);
  let fixture = null;
  try {
    fixture = buildChainFixtureRoom(tmpDir, variant);
    const db = fixture.db;
    const runId = 'run-347-' + variant;

    // ---- Test 1: a valid write returns ok true with the contracted id shape,
    // and a nodes row of type chain_state exists at that id. ----
    const write1 = chainState.writeChainStateRecord(db, {
      run_id: runId,
      step_index: 0,
      kind: 'task',
      command: '/mos:act',
      body: { text: 'step 0 task body' },
      quality: 'high',
      tier: 'executable',
      produced_by: 'worker',
      subject_node_id: fixture.subjectNodeId,
    });
    assert.strictEqual(write1.ok, true, variant + ': valid write must return ok true');
    const expectedId1 = 'chain:' + runId + ':0:task';
    assert.strictEqual(write1.node_id, expectedId1, variant + ': node_id must be chain:<run_id>:<step_index>:<kind>');
    const row1 = nodeRow(db, expectedId1);
    assert.ok(row1, variant + ': a nodes row must exist at the contracted id');
    assert.strictEqual(row1.type, 'chain_state', variant + ': node type must be exactly chain_state');
    ok(variant + ': valid write returns the contracted node_id and mints a chain_state row');

    // ---- Test 2: an unresolvable subject_node_id refuses with
    // missing_structural_anchor and mints NO node. ----
    const countBefore = nodeCount(db);
    const write2 = chainState.writeChainStateRecord(db, {
      run_id: runId,
      step_index: 99,
      kind: 'task',
      command: '/mos:act',
      body: { text: 'unanchorable' },
      quality: 'high',
      tier: 'executable',
      produced_by: 'worker',
      subject_node_id: 'section:does-not-exist-347',
    });
    assert.strictEqual(write2.ok, false, variant + ': a record with no resolvable subject node must be refused');
    assert.strictEqual(write2.reason, 'missing_structural_anchor', variant + ': the refusal reason must be missing_structural_anchor');
    const countAfter = nodeCount(db);
    assert.strictEqual(countAfter, countBefore, variant + ': the refusal must mint NO node (row count unchanged)');
    ok(variant + ': missing_structural_anchor refuses the write and mints nothing');

    // ---- Test 3: each of the five kinds writes the contracted epistemic_type,
    // read back out of the node's properties JSON; a sixth unknown kind is
    // refused with invalid_kind. epistemic_type rides properties on EVERY
    // schema variant (node-insert.cjs merges it into the JSON blob, never a
    // column), so this check is meaningful on wide, mid and legacy alike. ----
    FIVE_KINDS.forEach((kind, idx) => {
      const stepIndex = 1000 + idx;
      const write = chainState.writeChainStateRecord(db, {
        run_id: runId,
        step_index: stepIndex,
        kind: kind,
        command: '/mos:act',
        body: { text: kind + ' body' },
        quality: 'high',
        tier: 'executable',
        produced_by: 'worker',
        subject_node_id: fixture.subjectNodeId,
        byUser: kind === 'gate_decision' ? 'jsagir' : undefined,
      });
      assert.strictEqual(write.ok, true, variant + ': kind ' + kind + ' must write successfully');
      const nodeId = 'chain:' + runId + ':' + stepIndex + ':' + kind;
      const row = nodeRow(db, nodeId);
      assert.ok(row, variant + ': kind ' + kind + ' must mint a nodes row');
      const props = JSON.parse(row.properties);
      assert.strictEqual(
        props.epistemic_type,
        KIND_TO_EPISTEMIC_TYPE[kind],
        variant + ': kind ' + kind + ' must carry epistemic_type ' + KIND_TO_EPISTEMIC_TYPE[kind]
      );
    });
    const invalidKindWrite = chainState.writeChainStateRecord(db, {
      run_id: runId,
      step_index: 2000,
      kind: 'not_a_real_kind',
      command: '/mos:act',
      body: {},
      quality: 'high',
      tier: 'executable',
      produced_by: 'worker',
      subject_node_id: fixture.subjectNodeId,
    });
    assert.strictEqual(invalidKindWrite.ok, false, variant + ': an unknown kind must be refused');
    assert.strictEqual(invalidKindWrite.reason, 'invalid_kind', variant + ': the refusal reason must be invalid_kind');
    ok(variant + ': all five kinds map to their contracted epistemic_type; a sixth kind is refused as invalid_kind');

    // ---- Test 4: the SOURCED_FROM anchor edge exists from the record to the
    // subject, properties JSON has exactly run_id and step_index, and no
    // property value exceeds 64 characters (edges.cjs:845-848: enum and
    // scalar only, never a body). ----
    const sourcedFromRows = edgeRows(db, 'SOURCED_FROM').filter((e) => e.source === expectedId1);
    assert.ok(sourcedFromRows.length > 0, variant + ': a SOURCED_FROM edge must exist from the record to its subject');
    const anchorEdge = sourcedFromRows[0];
    assert.strictEqual(anchorEdge.target, fixture.subjectNodeId, variant + ': the SOURCED_FROM edge target must be the subject node');
    const anchorProps = JSON.parse(anchorEdge.properties || '{}');
    assert.deepStrictEqual(
      Object.keys(anchorProps).sort(),
      ['run_id', 'step_index'],
      variant + ': SOURCED_FROM edge properties must carry exactly run_id and step_index'
    );
    for (const key of Object.keys(anchorProps)) {
      assert.ok(String(anchorProps[key]).length <= 64, variant + ': SOURCED_FROM property ' + key + ' must be a short scalar, never a body');
    }
    ok(variant + ': the SOURCED_FROM anchor edge carries only run_id and step_index, scalar-only');

    // ---- Test 5: a FEEDS_INTO edge from record N to record N+1 exists once
    // the successor is written; no FEEDS_INTO edge exists for a
    // single-record run. ----
    const singleRunId = 'run-347-single-' + variant;
    chainState.writeChainStateRecord(db, {
      run_id: singleRunId,
      step_index: 0,
      kind: 'task',
      command: '/mos:act',
      body: { text: 'only step' },
      quality: 'high',
      tier: 'executable',
      produced_by: 'worker',
      subject_node_id: fixture.subjectNodeId,
    });
    const singleFeedsInto = edgeRows(db, 'FEEDS_INTO').filter((e) => e.source === 'chain:' + singleRunId + ':0:task');
    assert.strictEqual(singleFeedsInto.length, 0, variant + ': a single-record run must carry no FEEDS_INTO edge');

    const successorRunId = 'run-347-successor-' + variant;
    const recN = chainState.writeChainStateRecord(db, {
      run_id: successorRunId,
      step_index: 0,
      kind: 'task',
      command: '/mos:act',
      body: { text: 'step N' },
      quality: 'high',
      tier: 'executable',
      produced_by: 'worker',
      subject_node_id: fixture.subjectNodeId,
    });
    const recN1 = chainState.writeChainStateRecord(db, {
      run_id: successorRunId,
      step_index: 1,
      kind: 'draft',
      command: '/mos:act',
      body: { text: 'step N+1' },
      quality: 'high',
      tier: 'executable',
      produced_by: 'worker',
      subject_node_id: fixture.subjectNodeId,
    });
    assert.strictEqual(recN.ok, true, variant + ': step N must write successfully');
    assert.strictEqual(recN1.ok, true, variant + ': step N+1 must write successfully');
    const feedsIntoRows = edgeRows(db, 'FEEDS_INTO').filter((e) => e.source === recN.node_id && e.target === recN1.node_id);
    assert.ok(feedsIntoRows.length > 0, variant + ': a FEEDS_INTO edge must exist from record N to record N+1');
    ok(variant + ': FEEDS_INTO links record N to N+1 and a single-record run carries none');

    // ---- Test 6 (WD-347-3): review_status discipline. task/draft/notes/
    // judgment land confirmed (bookkeeping carve-out); gate_decision with no
    // byUser lands proposed, with a non-empty byUser lands confirmed and
    // records the handle. Measured only where the schema exposes a
    // review_status column at all (honest per CONTEXT.md's three-schema
    // rule); the legacy 3-column fixture has no such column, so this check
    // is skipped there rather than reporting a fabricated value. ----
    if (reviewStatusColumnPresent(db)) {
      const bookkeepingKinds = ['task', 'draft', 'notes', 'judgment'];
      bookkeepingKinds.forEach((kind, idx) => {
        const nodeId = 'chain:' + runId + ':' + (1000 + FIVE_KINDS.indexOf(kind)) + ':' + kind;
        const status = readReviewStatus(db, nodeId);
        assert.strictEqual(status, 'confirmed', variant + ': kind ' + kind + ' must land review_status confirmed (bookkeeping carve-out)');
      });

      const gateNoUser = chainState.writeChainStateRecord(db, {
        run_id: runId,
        step_index: 3000,
        kind: 'gate_decision',
        command: '/mos:act',
        body: { verdict: 'approve' },
        quality: 'high',
        tier: 'host_dispatch',
        produced_by: 'navigator',
        subject_node_id: fixture.subjectNodeId,
      });
      assert.strictEqual(gateNoUser.ok, true, variant + ': a gate_decision with no byUser must still write');
      assert.strictEqual(
        readReviewStatus(db, gateNoUser.node_id),
        'proposed',
        variant + ': a gate_decision with no byUser must land review_status proposed'
      );

      const gateWithUser = chainState.writeChainStateRecord(db, {
        run_id: runId,
        step_index: 3001,
        kind: 'gate_decision',
        command: '/mos:act',
        body: { verdict: 'approve' },
        quality: 'high',
        tier: 'host_dispatch',
        produced_by: 'navigator',
        subject_node_id: fixture.subjectNodeId,
        byUser: 'jsagir',
      });
      assert.strictEqual(gateWithUser.ok, true, variant + ': a gate_decision with a non-empty byUser must write');
      assert.strictEqual(
        readReviewStatus(db, gateWithUser.node_id),
        'confirmed',
        variant + ': a gate_decision with a non-empty byUser must land review_status confirmed'
      );
      ok(variant + ': review_status follows WD-347-3 (bookkeeping confirmed; gate_decision proposed unless byUser)');
    } else {
      ok(variant + ': review_status is not measurable on this schema (no review_status column); honestly skipped, never fabricated');
    }
  } finally {
    if (fixture) closeChainFixtureRoom(fixture);
  }
}

console.log(checks + ' checks passed.');
process.exit(0);
