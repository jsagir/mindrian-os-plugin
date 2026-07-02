'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 203-03 -- the Larry-reach expert-skill sensor test suite.
 *
 * Proves SEED-035 sub-claim 2: Larry PROACTIVELY suggests materialization via a
 * PURE, REGISTERED sensor that rides the frozen context_block reach.
 *
 * The four proofs (one per must_have truth):
 *   1. Signal-threshold: sensorExpertSkill fires context_block/signal='expert_skill'
 *      on the ctx reusable-expert signal (invocation OR tier), null otherwise; it is
 *      pure (ctx-scalars only, no db, no confirmNode/emitter call); REACH_ID is a
 *      member of the frozen 6 (never a minted 7th reach).
 *   2. Registration (the blocker fix): dispatchSensors EMITS a context_block reach
 *      when ctx carries the reusable-expert signal -- proving the sensor is in
 *      SENSOR_REGISTRY and actually fires through the governed dispatch.
 *   3. ctx-assembly producer: detectExpertSkillCandidates reads CONFIRMED-only
 *      SyntheticExpert nodes from room.db (the db read at assembly time, NOT in the
 *      sensor) and yields the closed scalars; threading them onto sensorCtx makes
 *      dispatchSensors emit the reach; the engine seam requires + threads the signal.
 *   4. Gate: APPROVE promotes through the POSITIONAL confirmNode(db, nodeId, byUser,
 *      reason) with a STRING byUser from resolveByUser (never an { byUser } object)
 *      and yields the materialize intent; REJECT/DEFER become typed graph edges
 *      (rejection is data, Decision 13); a REJECT with no reason is refused.
 *
 * Canon Part 8: offline / in-memory SQLite over a caller-owned handle; no Brain,
 *   no network, no repo-tree writes.
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const REPO_ROOT = path.resolve(__dirname, '..');
const SENSOR_PATH = path.join(REPO_ROOT, 'lib', 'core', 'sensors', 'sensor-expert-skill.cjs');
const INSIGHT_PATH = path.join(REPO_ROOT, 'lib', 'core', 'insight-sensors.cjs');
const ENGINE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'navigation-engine.cjs');

const {
  sensorExpertSkill,
  detectExpertSkillCandidates,
  resolveExpertSkillDecision,
  SENSOR_ID,
  REACH_ID,
} = require(SENSOR_PATH);
const { dispatchSensors } = require(INSIGHT_PATH);
const { REACH_IDS } = require(path.join(REPO_ROOT, 'lib', 'core', 'sensors', 'sensor-types.cjs'));
const { writeSyntheticExpertNode } = require(
  path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'synthetic-expert.cjs'));

// In-memory db with the Phase-109 nodes + edges schema (mirrors the shipped
// tests/test-203-genesis-fanout.cjs freshDb).
function freshDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(
    'CREATE TABLE nodes (' +
    '  id TEXT PRIMARY KEY, ' +
    '  type TEXT NOT NULL, ' +
    "  properties TEXT DEFAULT '{}', " +
    '  source_path TEXT NOT NULL, ' +
    "  created_by TEXT NOT NULL CHECK(created_by IN ('user','larry','import','brain','system')), " +
    '  confidence REAL, ' +
    "  review_status TEXT NOT NULL DEFAULT 'proposed' " +
    "    CHECK(review_status IN ('proposed','confirmed','rejected','stale','superseded','needs_evidence','validated','invalidated')), " +
    '  created_at INTEGER NOT NULL, ' +
    '  last_seen_at INTEGER NOT NULL, ' +
    '  last_modified_at INTEGER, ' +
    '  source_section TEXT, ' +
    '  confirmed_by TEXT, ' +
    '  confirmed_at INTEGER, ' +
    '  invalidated_at INTEGER, ' +
    '  valid_to INTEGER' +
    ')'
  );
  db.exec(
    "CREATE TABLE edges (source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, " +
    "properties TEXT DEFAULT '{}', PRIMARY KEY(source, target, type));"
  );
  return db;
}

// Seed a SyntheticExpert through the SHIPPED writer (lands 'proposed'); optionally
// promote to 'confirmed' by direct column write (the human-gate step Part 9 role 5).
function seedExpert(db, params, status) {
  const w = writeSyntheticExpertNode(db, params);
  if (!w.ok) throw new Error('seed failed: ' + w.reason);
  if (status && status !== 'proposed') {
    db.prepare('UPDATE nodes SET review_status = ? WHERE id = ?').run(status, w.node_id);
  }
  return w.node_id;
}

const BASE_EXPERT = {
  hat: 'Green', name: 'Resilience', surname: 'Adaptation',
  archetype: 'Synthetic Resilience Expert',
  beautifulQuestion: 'How does resilience hold when SWOT and TRIZ disagree?',
  researchApproach: 'Cross-examine adaptation through SWOT / TRIZ, then synthesize.',
  provenance: { runId: 'genesis:test', domainNodeIds: ['domain:adaptation'] },
  sessionId: 'genesis-test',
};

let pass = 0;
let total = 0;
function check(label, fn) {
  total += 1;
  try {
    fn();
    pass += 1;
    console.log('  ok -', label);
  } catch (e) {
    console.error('  FAIL -', label, '\n   ', e && e.message);
    process.exitCode = 1;
  }
}

console.log('test-203-reach-sensor:');

// ---------- Task 1: the PURE registered sensor riding context_block ----------

check('(a) fires context_block/signal=expert_skill on invocation signal', () => {
  const reach = sensorExpertSkill({}, {}, { reusableExpertCandidate: true, reusableExpertInvocationMax: 4 });
  assert.ok(reach, 'should fire');
  assert.equal(reach.reach_id, 'context_block', 'rides the frozen context_block reach');
  assert.equal(reach.signal, 'expert_skill', 'signal marks the expert-skill offer');
  assert.equal(reach.evidence.invocation_max, 4, 'closed invocation_max scalar rides');
});

check('(b) fires on tier signal at invocation 0', () => {
  const reach = sensorExpertSkill({}, {}, { reusableExpertCandidate: true, reusableExpertTierSignal: true });
  assert.ok(reach, 'tier signal alone fires the reach');
  assert.equal(reach.reach_id, 'context_block');
  assert.equal(reach.evidence.tier_signal, true, 'tier_signal scalar rides');
});

check('(c) null when no confirmed reusable signal', () => {
  assert.equal(sensorExpertSkill({}, {}, { reusableExpertCandidate: false }), null);
  assert.equal(sensorExpertSkill({}, {}, {}), null);
  assert.equal(sensorExpertSkill({}, {}, null), null);
});

check('(d) REACH_ID is a member of the frozen 6, not a minted 7th reach', () => {
  assert.equal(REACH_ID, 'context_block');
  assert.notEqual(REACH_IDS.indexOf(REACH_ID), -1, 'REACH_ID must be in the frozen REACH_IDS bank');
  assert.equal(REACH_IDS.length, 6, 'the reach bank stays frozen at 6');
});

check('(e) REGISTRATION PROOF: dispatchSensors EMITS the context_block reach', () => {
  const reaches = dispatchSensors({}, {}, { reusableExpertCandidate: true, reusableExpertInvocationMax: 4 });
  assert.ok(Array.isArray(reaches), 'dispatchSensors returns an array');
  const hit = reaches.find((r) => r && r.reach_id === 'context_block' && r.signal === 'expert_skill');
  assert.ok(hit, 'the registered sensor fires through the governed dispatch (it is in SENSOR_REGISTRY)');
});

check('(f) the sensor calls NO confirmNode, NO emitter, NO db (pure)', () => {
  // A ctx laced with tripwire methods -- the pure sensor must touch none of them.
  let confirmCalls = 0;
  let dbCalls = 0;
  const ctx = {
    reusableExpertCandidate: true,
    reusableExpertInvocationMax: 5,
    confirmNode: () => { confirmCalls += 1; },
    db: { prepare: () => { dbCalls += 1; return { all: () => [], get: () => null, run: () => {} }; } },
  };
  const reach = sensorExpertSkill({}, {}, ctx);
  assert.ok(reach, 'still fires');
  assert.equal(confirmCalls, 0, 'the sensor never promotes');
  assert.equal(dbCalls, 0, 'the sensor never reads a db');
});

check('(f2) the sensor SOURCE makes no db.prepare (the db read lives in the producer/gate)', () => {
  const src = fs.readFileSync(SENSOR_PATH, 'utf8');
  // Strip the two db-owning helpers, then assert the remaining sensor body has no db.prepare.
  const producerIdx = src.indexOf('function detectExpertSkillCandidates');
  const sensorRegion = producerIdx === -1 ? src : src.slice(0, producerIdx);
  assert.equal(sensorRegion.indexOf('db.prepare'), -1, 'the sensor fn body must not read a db');
});

check('SENSOR_ID is a new SENS id string', () => {
  assert.equal(typeof SENSOR_ID, 'string');
  assert.ok(/^SENS-\d+/.test(SENSOR_ID), 'SENSOR_ID follows the SENS-<n> convention');
});

// ---------- Task 2: the ctx-assembly producer (mirror MED-01) ----------

check('detectExpertSkillCandidates: CONFIRMED node at invocation 4 is reusable', () => {
  const db = freshDb();
  seedExpert(db, Object.assign({}, BASE_EXPERT, { evidenceTier: 'None', invocationCount: 4 }), 'confirmed');
  const sig = detectExpertSkillCandidates(db, { threshold: 3 });
  assert.equal(sig.reusable, true, 'invocation 4 >= threshold 3 -> reusable');
  assert.equal(sig.invocationMax, 4, 'invocationMax scalar surfaced');
  assert.equal(sig.candidates.length, 1, 'one LOCAL candidate');
  assert.ok(sig.candidates[0].nodeId, 'candidate carries the LOCAL node id (gate-only)');
});

check('detectExpertSkillCandidates: CONFIRMED Academic-tier node at invocation 0 is reusable', () => {
  const db = freshDb();
  seedExpert(db, Object.assign({}, BASE_EXPERT, { evidenceTier: 'Academic', invocationCount: 0 }), 'confirmed');
  const sig = detectExpertSkillCandidates(db, { threshold: 3 });
  assert.equal(sig.reusable, true, 'Academic tier fires even at invocation 0');
  assert.equal(sig.tierSignal, true, 'tierSignal scalar set');
});

check('detectExpertSkillCandidates: a PROPOSED node is NEVER a candidate (confirmed-only)', () => {
  const db = freshDb();
  seedExpert(db, Object.assign({}, BASE_EXPERT, { evidenceTier: 'Academic', invocationCount: 9 }), 'proposed');
  const sig = detectExpertSkillCandidates(db, { threshold: 3 });
  assert.equal(sig.reusable, false, 'a proposed expert is not yet trusted (Part 9 role 5)');
  assert.equal(sig.candidates.length, 0);
});

check('detectExpertSkillCandidates: empty / confirmed-none db returns reusable:false', () => {
  const db = freshDb();
  const sig = detectExpertSkillCandidates(db, { threshold: 3 });
  assert.equal(sig.reusable, false);
  assert.equal(sig.candidates.length, 0);
});

check('producer-then-dispatch integration: the signal threads onto ctx so dispatchSensors emits', () => {
  const db = freshDb();
  seedExpert(db, Object.assign({}, BASE_EXPERT, { evidenceTier: 'None', invocationCount: 4 }), 'confirmed');
  const sig = detectExpertSkillCandidates(db, { threshold: 3 });
  // Mirror the navigation-engine producer: thread the closed scalars onto sensorCtx.
  const sensorCtx = {
    reusableExpertCandidate: sig.reusable,
    reusableExpertInvocationMax: sig.invocationMax,
    reusableExpertTierSignal: sig.tierSignal,
    reusableExpertCandidateCount: sig.candidates.length,
  };
  const reaches = dispatchSensors({}, {}, sensorCtx);
  const hit = reaches.find((r) => r && r.reach_id === 'context_block' && r.signal === 'expert_skill');
  assert.ok(hit, 'the producer-threaded ctx makes the registered sensor fire');
});

check('engine seam: navigation-engine requires the producer and threads reusableExpertCandidate', () => {
  const src = fs.readFileSync(ENGINE_PATH, 'utf8');
  assert.ok(/detectExpertSkillCandidates/.test(src), 'engine requires the ctx-assembly producer');
  assert.ok(/sensorCtx\.reusableExpertCandidate\b/.test(src), 'engine threads the signal onto sensorCtx');
});

// ---------- Task 3: APPROVE -> positional confirmNode; REJECT/DEFER -> edge ----------

check('APPROVE promotes via POSITIONAL confirmNode(db, nodeId, byUser:string, reason)', () => {
  const db = freshDb();
  const nodeId = seedExpert(db, Object.assign({}, BASE_EXPERT, { evidenceTier: 'Academic', invocationCount: 4 }), 'proposed');

  const seen = [];
  const spyConfirm = function (a, b, c, d) {
    seen.push({ argc: arguments.length, db: a, nodeId: b, byUser: c, reason: d });
    return { ok: true };
  };
  const res = resolveExpertSkillDecision(db, nodeId, 'APPROVE', {
    roomDir: '/tmp/nonexistent-room-203',
    confirmNode: spyConfirm,
    // real resolveByUser default is used; force via stub returning a STRING to prove positionality
    resolveByUser: () => 'navigator',
  });

  assert.equal(seen.length, 1, 'confirmNode called exactly once');
  assert.equal(seen[0].argc, 4, 'confirmNode called with 4 POSITIONAL args');
  assert.equal(seen[0].db, db, 'arg1 is the db handle');
  assert.equal(seen[0].nodeId, nodeId, 'arg2 is the node id');
  assert.equal(typeof seen[0].byUser, 'string', 'arg3 byUser is a STRING, never an { byUser } object');
  assert.equal(seen[0].byUser, 'navigator', 'byUser is the resolveByUser string id');
  assert.equal(typeof seen[0].reason, 'string', 'arg4 is the reason string');
  assert.equal(res.ok, true, 'APPROVE succeeds');
  assert.ok(res.intent && /--from-expert/.test(res.intent.command), 'yields the /mos:skill --from-expert materialize intent');
  assert.ok(/\b/.test(res.intent.command) && res.intent.command.indexOf(nodeId) !== -1, 'the intent names the node id');
});

check('APPROVE uses the REAL resolveByUser to resolve a STRING byUser (no object)', () => {
  const db = freshDb();
  const nodeId = seedExpert(db, Object.assign({}, BASE_EXPERT, { evidenceTier: 'Academic', invocationCount: 4 }), 'proposed');
  let capturedByUser;
  const spyConfirm = function (a, b, byUser) { capturedByUser = byUser; return { ok: true }; };
  // No resolveByUser override -> the module's default (the real confirm-node.cjs resolver)
  // resolves a STRING id from an absent USER.md (the 'navigator' default).
  resolveExpertSkillDecision(db, nodeId, 'APPROVE', {
    roomDir: '/tmp/nonexistent-room-203',
    confirmNode: spyConfirm,
  });
  assert.equal(typeof capturedByUser, 'string', 'the real resolveByUser yields a STRING byUser');
  assert.notEqual(capturedByUser, null);
});

check('REJECT-with-reason writes a typed REJECTED edge and does NOT promote', () => {
  const db = freshDb();
  const nodeId = seedExpert(db, Object.assign({}, BASE_EXPERT, { evidenceTier: 'Academic', invocationCount: 4 }), 'proposed');
  const res = resolveExpertSkillDecision(db, nodeId, 'REJECT', { reason: 'not reusable across ventures' });
  assert.equal(res.ok, true, 'reject with reason succeeds');
  assert.equal(res.promoted, false, 'reject promotes nothing');
  const status = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(nodeId).review_status;
  assert.equal(status, 'proposed', 'the node stays proposed (never promoted on reject)');
  const edge = db.prepare("SELECT type, properties FROM edges WHERE source = ? AND type = 'REJECTED'").get(nodeId);
  assert.ok(edge, 'a typed REJECTED edge is written (rejection is data, Decision 13)');
  assert.ok(/not reusable/.test(edge.properties), 'the reason rides the edge as typed graph data');
});

check('a REJECT with NO reason is REFUSED (rejection is data, Decision 13)', () => {
  const db = freshDb();
  const nodeId = seedExpert(db, Object.assign({}, BASE_EXPERT, { evidenceTier: 'Academic', invocationCount: 4 }), 'proposed');
  const res = resolveExpertSkillDecision(db, nodeId, 'REJECT', {});
  assert.equal(res.ok, false, 'a reasonless reject is refused');
  assert.equal(res.reason, 'reason_required');
  const edgeCount = db.prepare("SELECT COUNT(*) AS n FROM edges WHERE source = ?").get(nodeId).n;
  assert.equal(edgeCount, 0, 'no edge is written for a refused reject');
});

check('DEFER writes a DEFERRED edge and leaves the node proposed', () => {
  const db = freshDb();
  const nodeId = seedExpert(db, Object.assign({}, BASE_EXPERT, { evidenceTier: 'Academic', invocationCount: 4 }), 'proposed');
  const res = resolveExpertSkillDecision(db, nodeId, 'DEFER', { reason: 'revisit after the next study' });
  assert.equal(res.ok, true, 'defer succeeds');
  assert.equal(res.promoted, false, 'defer promotes nothing');
  const status = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(nodeId).review_status;
  assert.equal(status, 'proposed', 'the node stays proposed on defer');
  const edge = db.prepare("SELECT type FROM edges WHERE source = ? AND type = 'DEFERRED'").get(nodeId);
  assert.ok(edge, 'a typed DEFERRED edge is written');
});

console.log('\n' + pass + '/' + total + ' passed');
if (pass !== total) process.exit(1);
