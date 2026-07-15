'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 223-02 -- SUPERSEDES chain proof (Req 2, lib level).
 * =========================================================
 *   1. 2-run fixture: run A writes a conclusion; A is confirmed (Part 9: a
 *      human ratifies before it can be superseded); run B calls
 *      findPriorConclusion (finds A) then writeCloseLoop(priorConclusionId=A) --
 *      the db holds EXACTLY ONE SUPERSEDES edge (B->A), its review_status column
 *      is NULL (D-04), and walkSupersedesChain(db, B) returns [B, A].
 *   2. 1-run fixture: a single run produces ZERO SUPERSEDES edges (no false
 *      chain on a first run) and walkSupersedesChain returns a single element.
 *   3. 3-link chain A<-B<-C walks as [C,B,A]; walking from the MIDDLE (B) still
 *      returns the full chain in order.
 *   4. cycle guard: a manually-inserted cyclic SUPERSEDES pair terminates with
 *      { ok:false, reason:'cycle_detected' }, never an infinite loop.
 *   5. the walk is independent of node review_status (a confirmed conclusion and
 *      a proposed one appear identically in chain order) -- D-04 mechanics.
 *
 * Drives writeCloseLoop / findPriorConclusion from Task 2 (the Req 2 lib-level
 * proof; Plan 03 wires the same calls into bono's --version-log surface).
 * Hermetic: buildFixtureRoom224 + openRoomDb, no network, no model download.
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
const closeLoop = require(path.join(REPO_ROOT, 'lib', 'core', 'close-loop-writer.cjs'));
const supersession = require(path.join(REPO_ROOT, 'lib', 'core', 'temporal', 'supersession.cjs'));

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) { passed += 1; console.log('  ok - ' + name); } else { failed += 1; console.log('  NOT OK - ' + name); }
}
function mkTmp(prefix) { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)); }

const TOPIC = 'meal-kit-go-to-market';
function conclusionPayload(nth) {
  return {
    conclusion: {
      governing_thought: 'Revision ' + nth + ': the wedge is corporate wellness subsidies that lower CAC.',
      key_claims: [
        'Corporate programs subsidize the first two months.',
        'Referral loops keep paid acquisition near zero.',
        'Menu personalization cuts the churn that kills LTV.',
      ],
      topic: TOPIC,
    },
    claims: [], knowns: [], unknowns: [], killed: [], relations: [], opportunities: [],
  };
}

// Run one revision through writeCloseLoop; optionally supersede a prior; return
// the new conclusion node id. Confirms the NEW node when confirmPrior is set so
// the NEXT run can legally supersede it (Part 9 confirmed->superseded).
function runRevision(db, roomDir, nth, runId, priorConclusionId) {
  const payload = conclusionPayload(nth);
  if (priorConclusionId) payload.priorConclusionId = priorConclusionId;
  const res = closeLoop.writeCloseLoop(db, roomDir, payload, { surface: 'bono', run_id: runId });
  return res;
}

async function test1_twoRun() {
  console.log('--- Test 1: 2-run one NULL SUPERSEDES edge + [B,A] chain ---');
  const tmp = mkTmp('c223s1-');
  const fx = await buildFixtureRoom224(tmp, { artifactCount: 3 });
  const db = openRoomDb(fx.roomDir);
  try {
    const resA = runRevision(db, fx.roomDir, 1, 'run-A', null);
    check('1a run A conclusion minted', resA.ok && typeof resA.conclusion_id === 'string');
    const A = resA.conclusion_id;
    // Human ratifies A so the mechanical supersede (confirmed->superseded) is legal.
    const conf = navigation.confirmNode(db, A, 'navigator');
    check('1b A confirmed by a human', conf.ok === true);

    const topicHash = closeLoop.topicHashOf(TOPIC);
    const found = closeLoop.findPriorConclusion(db, topicHash, { excludeRunId: 'run-B' });
    check('1c findPriorConclusion locates A', found.ok === true && found.node_id === A);

    const resB = runRevision(db, fx.roomDir, 2, 'run-B', found.node_id);
    check('1d run B conclusion minted (distinct node)', resB.ok && resB.conclusion_id && resB.conclusion_id !== A);
    check('1e supersede reported ok', resB.superseded && resB.superseded.ok === true);
    const B = resB.conclusion_id;

    const cnt = db.prepare("SELECT COUNT(*) AS c FROM edges WHERE type = 'SUPERSEDES'").get().c;
    check('1f exactly one SUPERSEDES edge', cnt === 1);
    const row = db.prepare("SELECT source, target, review_status FROM edges WHERE type = 'SUPERSEDES'").get();
    check('1g edge is B->A', row.source === B && row.target === A);
    check('1h SUPERSEDES review_status IS NULL (D-04)', row.review_status === null);

    const walk = supersession.walkSupersedesChain(db, B);
    check('1i walk ok', walk.ok === true);
    check('1j chain is [B, A] newest-first', walk.chain.length === 2 && walk.chain[0].node_id === B && walk.chain[1].node_id === A);
  } finally {
    closeRoomDb(db);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function test2_oneRun() {
  console.log('--- Test 2: 1-run zero SUPERSEDES + single-element chain ---');
  const tmp = mkTmp('c223s2-');
  const fx = await buildFixtureRoom224(tmp, { artifactCount: 3 });
  const db = openRoomDb(fx.roomDir);
  try {
    const resA = runRevision(db, fx.roomDir, 1, 'run-only', null);
    const cnt = db.prepare("SELECT COUNT(*) AS c FROM edges WHERE type = 'SUPERSEDES'").get().c;
    check('2a zero SUPERSEDES edges on a first run', cnt === 0);
    const walk = supersession.walkSupersedesChain(db, resA.conclusion_id);
    check('2b single-element chain', walk.ok === true && walk.chain.length === 1 && walk.chain[0].node_id === resA.conclusion_id);
  } finally {
    closeRoomDb(db);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function test3_threeLink() {
  console.log('--- Test 3: 3-link chain [C,B,A] from any node ---');
  const tmp = mkTmp('c223s3-');
  const fx = await buildFixtureRoom224(tmp, { artifactCount: 3 });
  const db = openRoomDb(fx.roomDir);
  try {
    const resA = runRevision(db, fx.roomDir, 1, 'run-A', null);
    const A = resA.conclusion_id;
    navigation.confirmNode(db, A, 'navigator');
    const resB = runRevision(db, fx.roomDir, 2, 'run-B', A);
    const B = resB.conclusion_id;
    check('3a B supersedes A', resB.superseded && resB.superseded.ok === true);
    navigation.confirmNode(db, B, 'navigator');
    const resC = runRevision(db, fx.roomDir, 3, 'run-C', B);
    const C = resC.conclusion_id;
    check('3b C supersedes B', resC.superseded && resC.superseded.ok === true);

    const cnt = db.prepare("SELECT COUNT(*) AS c FROM edges WHERE type = 'SUPERSEDES'").get().c;
    check('3c exactly two SUPERSEDES edges', cnt === 2);

    const ids = (w) => w.chain.map((x) => x.node_id).join(',');
    const fromEnd = supersession.walkSupersedesChain(db, C);
    check('3d walk from newest C is [C,B,A]', fromEnd.ok && ids(fromEnd) === [C, B, A].join(','));
    const fromMiddle = supersession.walkSupersedesChain(db, B);
    check('3e walk from MIDDLE B is [C,B,A]', fromMiddle.ok && ids(fromMiddle) === [C, B, A].join(','));
    const fromOldest = supersession.walkSupersedesChain(db, A);
    check('3f walk from oldest A is [C,B,A]', fromOldest.ok && ids(fromOldest) === [C, B, A].join(','));
  } finally {
    closeRoomDb(db);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function test4_cycleGuard() {
  console.log('--- Test 4: cycle guard terminates ---');
  const tmp = mkTmp('c223s4-');
  const fx = await buildFixtureRoom224(tmp, { artifactCount: 3 });
  const db = openRoomDb(fx.roomDir);
  try {
    const x = navigation.writeClaimNode(db, { knowledge_type: 'fact', text: 'Node X.', sessionId: 's', sourceSegment: 'x' });
    const y = navigation.writeClaimNode(db, { knowledge_type: 'fact', text: 'Node Y.', sessionId: 's', sourceSegment: 'y' });
    // Manually insert a cyclic SUPERSEDES pair (X->Y and Y->X) through the
    // chokepoint (a corrupt state the walker must survive).
    navigation.writeEdge(db, { source_id: x.node_id, target_id: y.node_id, edge_type: 'SUPERSEDES', properties: {} });
    navigation.writeEdge(db, { source_id: y.node_id, target_id: x.node_id, edge_type: 'SUPERSEDES', properties: {} });
    const walk = supersession.walkSupersedesChain(db, x.node_id, { maxDepth: 50 });
    check('4a cycle detected, not an infinite loop', walk.ok === false && walk.reason === 'cycle_detected');
  } finally {
    closeRoomDb(db);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function test5_statusIndependent() {
  console.log('--- Test 5: walk independent of review_status ---');
  const tmp = mkTmp('c223s5-');
  const fx = await buildFixtureRoom224(tmp, { artifactCount: 3 });
  const db = openRoomDb(fx.roomDir);
  try {
    const resA = runRevision(db, fx.roomDir, 1, 'run-A', null);
    const A = resA.conclusion_id;
    navigation.confirmNode(db, A, 'navigator');
    const resB = runRevision(db, fx.roomDir, 2, 'run-B', A);
    const B = resB.conclusion_id;
    // A is now 'superseded', B is 'proposed' -- deliberately different statuses.
    const sA = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(A).review_status;
    const sB = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(B).review_status;
    check('5a the two nodes carry different review_status', sA !== sB);
    const walk = supersession.walkSupersedesChain(db, B);
    check('5b chain order is [B,A] regardless of status', walk.ok && walk.chain.length === 2 && walk.chain[0].node_id === B && walk.chain[1].node_id === A);
  } finally {
    closeRoomDb(db);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

(async function main() {
  try {
    await test1_twoRun();
    await test2_oneRun();
    await test3_threeLink();
    await test4_cycleGuard();
    await test5_statusIndependent();
  } catch (e) {
    console.error('FATAL', e && e.stack ? e.stack : e);
    process.exit(1);
  }
  console.log('');
  console.log('test-223-supersedes-chain: passed=' + passed + ' failed=' + failed);
  if (failed > 0) { process.exit(1); }
  console.log('PASS');
}());
