#!/usr/bin/env node
'use strict';
/*
 * tests/test-347-chain-state-kinds.cjs -- Phase 347-03 Task 1.
 *
 * Pins lib/core/navigation/chain-state.cjs's KIND_TO_EPISTEMIC_TYPE mapping
 * table behavior: exactly five entries, five distinct values (no collapse),
 * a closed-kind refusal for anything outside the five, and the epistemic_type
 * actually merged into the stored properties JSON by insertNode (never just
 * asserted against the in-memory constant, which would prove nothing about
 * what actually lands in room.db).
 *
 * RED-PROOF: this file goes red on a single-line mutation of
 * lib/core/navigation/chain-state.cjs's KIND_TO_EPISTEMIC_TYPE -- for
 * example, collapsing every value to the pre-276-12 defect shape
 * (`gate_decision: 'observation'` instead of `'decision'`) trips Test 2
 * (five distinct values) and Test 4 (the gate_decision row's persisted
 * epistemic_type). Deleting one entry trips Test 1 (five keys). Renaming
 * `invalid_kind` to any other string trips Test 3.
 *
 * Plain node:assert CJS script. Hyphens only, no em-dashes (CLAUDE.md HARD
 * RULE).
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');

const { buildChainFixtureRoom, closeChainFixtureRoom } =
  require(path.join(REPO, 'tests', 'helpers', 'fixture-room-347.cjs'));
const chainState = require(path.join(REPO, 'lib', 'core', 'navigation', 'chain-state.cjs'));

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

console.log('test-347-chain-state-kinds:');

// ---- Test 1: the mapping table has exactly 5 keys. ----
const keys = Object.keys(chainState.KIND_TO_EPISTEMIC_TYPE);
assert.strictEqual(keys.length, 5, 'KIND_TO_EPISTEMIC_TYPE must carry exactly 5 keys');
assert.deepStrictEqual(
  keys.slice().sort(),
  ['draft', 'gate_decision', 'judgment', 'notes', 'task'].sort(),
  'KIND_TO_EPISTEMIC_TYPE keys must be exactly the five contracted kinds'
);
ok('KIND_TO_EPISTEMIC_TYPE has exactly the five contracted kind keys');

// ---- Test 2: the mapping table has 5 distinct values (no collapse). ----
const values = Object.values(chainState.KIND_TO_EPISTEMIC_TYPE);
assert.strictEqual(new Set(values).size, 5, 'KIND_TO_EPISTEMIC_TYPE must map onto 5 DISTINCT epistemic_type values, never a collapse');
ok('the five kinds map onto five distinct epistemic_type values');

// ---- Test 3: CHAIN_STATE_KINDS matches the mapping table's own keys, and a
// closed-kind refusal fires for anything outside it, before any prepare. ----
assert.deepStrictEqual(
  chainState.CHAIN_STATE_KINDS.slice().sort(),
  keys.slice().sort(),
  'CHAIN_STATE_KINDS must be exactly the mapping table\'s own key set'
);
ok('CHAIN_STATE_KINDS is exactly the mapping table\'s key set');

// ---- Test 4: the epistemic_type actually merged into the stored properties
// JSON by insertNode, one write per kind, read back off the real node row
// (not just the in-memory constant). ----
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-347-kinds-'));
let fixture = null;
try {
  fixture = buildChainFixtureRoom(tmpDir, 'wide');
  const db = fixture.db;
  const runId = 'run-347-kinds';

  chainState.CHAIN_STATE_KINDS.forEach((kind, idx) => {
    const write = chainState.writeChainStateRecord(db, {
      run_id: runId,
      step_index: idx,
      kind: kind,
      command: '/mos:a',
      body: { text: kind },
      quality: 'high',
      tier: 'executable',
      produced_by: 'worker',
      subject_node_id: fixture.subjectNodeId,
      byUser: kind === 'gate_decision' ? 'jsagir' : undefined,
    });
    assert.strictEqual(write.ok, true, 'kind ' + kind + ' must write successfully');
    const row = db.prepare('SELECT properties FROM nodes WHERE id = ?').get(write.node_id);
    assert.ok(row, 'a nodes row must exist at ' + write.node_id);
    const props = JSON.parse(row.properties);
    assert.strictEqual(
      props.epistemic_type,
      chainState.KIND_TO_EPISTEMIC_TYPE[kind],
      'kind ' + kind + ' must persist epistemic_type ' + chainState.KIND_TO_EPISTEMIC_TYPE[kind] + ' into the real stored properties JSON'
    );
  });
  ok('every kind persists its contracted epistemic_type into the real stored properties JSON, not just the in-memory constant');

  // ---- Test 5: the closed-kind refusal fires BEFORE any prepare -- no node
  // row is minted for an unknown kind, on any schema variant. ----
  const countBefore = db.prepare('SELECT count(*) AS c FROM nodes').get().c;
  const refusal = chainState.writeChainStateRecord(db, {
    run_id: runId,
    step_index: 999,
    kind: 'unknown_kind_347',
    command: '/mos:a',
    body: {},
    quality: 'high',
    tier: 'executable',
    produced_by: 'worker',
    subject_node_id: fixture.subjectNodeId,
  });
  assert.strictEqual(refusal.ok, false, 'a kind outside the closed five must be refused');
  assert.strictEqual(refusal.reason, 'invalid_kind', 'the refusal reason must be invalid_kind');
  const countAfter = db.prepare('SELECT count(*) AS c FROM nodes').get().c;
  assert.strictEqual(countAfter, countBefore, 'the closed-kind refusal must mint NO node row');
  ok('a kind outside the closed five is refused with invalid_kind before any prepare, and mints nothing');
} finally {
  if (fixture) closeChainFixtureRoom(fixture);
}

console.log(checks + ' checks passed.');
process.exit(0);
