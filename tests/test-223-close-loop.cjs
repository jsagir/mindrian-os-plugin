'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 223-02 -- close-the-loop graph-write proof (Req 4).
 * ========================================================
 * SECTION A (Task 1, behaviors 1-4): the navigation additions.
 *   1. writeOpenQuestionNode lands a type='open_question' row, review_status
 *      'proposed', properties carrying the question; re-writing UPSERTs (no
 *      duplicate) and NEVER downgrades review_status on conflict.
 *   2. insights.findOpenQuestions (via navigation) returns that node -- writer
 *      and shipped reader agree on the 'open_question' type string.
 *   3. writeClaimNode's optional extraProps bag persists additive keys, filters
 *      protected-key overrides, and is byte-identical to today when absent.
 *   4. the byUser gate (Part 9): an agent/system-attributed confirm of a claim
 *      this plan writes is REJECTED; only a human byUser promotes.
 *
 * SECTION B (Task 2, behaviors 1-7): the close-loop-writer spine. Appended by
 *   Task 2 below Section A.
 *
 * FIXTURE CHOICE: this leg builds throwaway rooms with buildFixtureRoom224 (the
 * Wave-1 sibling Plan 01 fixture-223 helper is NOT a dependency of this plan --
 * the 224 base suffices for pure room.db legs). Deterministic, hermetic, no
 * network, no model download.
 *
 * PASS line + non-zero exit on failure. NO em-dashes (CLAUDE.md HARD RULE).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const { buildFixtureRoom224 } = require(path.join(REPO_ROOT, 'tests', 'helpers', 'fixture-room-224.cjs'));

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) { passed += 1; console.log('  ok - ' + name); } else { failed += 1; console.log('  NOT OK - ' + name); }
}

function mkTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function selectNode(db, id) {
  return db.prepare('SELECT id, type, properties, review_status FROM nodes WHERE id = ?').get(id);
}

// ===========================================================================
// SECTION A -- navigation additions (Task 1).
// ===========================================================================
async function sectionA() {
  console.log('--- Section A: navigation additions (open_question writer + claim extraProps + byUser gate) ---');
  const tmp = mkTmp('c223a-');
  const fx = await buildFixtureRoom224(tmp, { artifactCount: 3 });
  const db = openRoomDb(fx.roomDir);
  try {
    // Behavior 1: writeOpenQuestionNode + UPSERT + no review_status downgrade.
    const q = 'How do we validate the retention assumption before scaling?';
    const w1 = navigation.writeOpenQuestionNode(db, { question: q, sessionId: 's1', source: 'bono' });
    check('1a writeOpenQuestionNode ok', w1.ok === true && typeof w1.node_id === 'string');
    const row1 = selectNode(db, w1.node_id);
    check('1b node type open_question', row1 && row1.type === 'open_question');
    check('1c review_status proposed', row1 && row1.review_status === 'proposed');
    check('1d properties carry the question', row1 && JSON.parse(row1.properties).question === q);

    // Confirm it (human), then re-write -- review_status must stay confirmed
    // (no downgrade) and the row count must stay 1 (UPSERT, not duplicate).
    const conf = navigation.confirmNode(db, w1.node_id, 'navigator');
    check('1e human confirm promotes', conf.ok === true);
    const w1again = navigation.writeOpenQuestionNode(db, { question: q, sessionId: 's1', source: 'bono', extraProps: { revisit: true } });
    check('1f re-write ok (same id)', w1again.ok === true && w1again.node_id === w1.node_id);
    const rowAfter = selectNode(db, w1.node_id);
    check('1g no downgrade on conflict (stays confirmed)', rowAfter.review_status === 'confirmed');
    check('1h properties updated on conflict (extraProps merged)', JSON.parse(rowAfter.properties).revisit === true);
    const dupCount = db.prepare("SELECT COUNT(*) AS c FROM nodes WHERE type = 'open_question'").get().c;
    check('1i exactly one open_question row (UPSERT)', dupCount === 1);

    // Behavior 2: the shipped reader agrees on the type string.
    const open = navigation.findOpenQuestions(db, 'fixture-224');
    check('2a findOpenQuestions returns the written node', open.some((o) => o.question && o.question.id === w1.node_id));

    // Behavior 3: writeClaimNode extraProps -- persist, protect, byte-identical.
    const c3 = navigation.writeClaimNode(db, {
      knowledge_type: 'fact', text: 'The pilot cohort renewed at 82 percent.', sessionId: 's1',
      sourceSegment: 'seg-3a', extraProps: { kind: 'conclusion', topic_hash: 'abc', pipeline: 'bono-v2' },
    });
    check('3a claim with extraProps ok', c3.ok === true);
    const p3 = JSON.parse(selectNode(db, c3.node_id).properties);
    check('3b extraProps kind persisted', p3.kind === 'conclusion');
    check('3c extraProps topic_hash persisted', p3.topic_hash === 'abc');
    check('3d extraProps pipeline persisted', p3.pipeline === 'bono-v2');

    const c3b = navigation.writeClaimNode(db, {
      knowledge_type: 'fact', text: 'Real claim text.', sessionId: 's1', sourceSegment: 'seg-3b',
      extraProps: { knowledge_type: 'assumption', text: 'HACKED', pipeline: 'ok-field' },
    });
    const p3b = JSON.parse(selectNode(db, c3b.node_id).properties);
    check('3e protected knowledge_type not overridden', p3b.knowledge_type === 'fact');
    check('3f protected text not overridden', p3b.text === 'Real claim text.');
    check('3g non-protected extraProps still merges', p3b.pipeline === 'ok-field');

    // Byte-identical-when-absent: two claim writes over identical fixed params
    // produce identical props MINUS the bag keys.
    const cWith = navigation.writeClaimNode(db, { knowledge_type: 'heuristic', text: 'Ship weekly.', sessionId: 's1', sourceSegment: 'seg-3shared', extraProps: { pipeline: 'x' } });
    const cWithout = navigation.writeClaimNode(db, { knowledge_type: 'heuristic', text: 'Ship weekly.', sessionId: 's2', sourceSegment: 'seg-3shared' });
    const pWith = JSON.parse(selectNode(db, cWith.node_id).properties);
    const pWithout = JSON.parse(selectNode(db, cWithout.node_id).properties);
    delete pWith.pipeline;
    check('3h props byte-identical when extraProps absent', JSON.stringify(pWith) === JSON.stringify(pWithout));

    // Behavior 4: the byUser gate on a claim this plan writes (Part 9).
    const c4 = navigation.writeClaimNode(db, { knowledge_type: 'fact', text: 'A gate-test claim.', sessionId: 's1', sourceSegment: 'seg-4' });
    const badConfirm = navigation.confirmNode(db, c4.node_id, 'system');
    check('4a agent/system-attributed confirm rejected', badConfirm.ok === false && badConfirm.reason === 'agent_attribution_forbidden');
    const goodConfirm = navigation.confirmNode(db, c4.node_id, 'navigator');
    check('4b human byUser confirm promotes', goodConfirm.ok === true);
    check('4c node now confirmed', selectNode(db, c4.node_id).review_status === 'confirmed');
  } finally {
    closeRoomDb(db);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

(async function main() {
  try {
    await sectionA();
  } catch (e) {
    console.error('FATAL', e && e.stack ? e.stack : e);
    process.exit(1);
  }
  console.log('');
  console.log('test-223-close-loop: passed=' + passed + ' failed=' + failed);
  if (failed > 0) { process.exit(1); }
  console.log('PASS');
}());
