'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 205-07 -- the FUSION cross-frame router test (scope item 1).
 * ============================================================================
 * FUSION fires when the navigator is stuck ACROSS frames (the Test 6 five-misses
 * failure). This suite proves FUSION is a ROUTER:
 *   assemble (live Frame nodes) -> brain_ask (DirectiveEnvelope) -> JTBD job-test
 *   -> D-Q4 0.70 gate -> horizontal move (containing system + SHARES_JOB /
 *   ELEVATES_TO), hedged-always, minting NO reach; plus the D-Q1 session-end
 *   quorum and the BLOCKED-UNTIL-200 lateral scaffold.
 *
 * Canon Part 8: the brain_ask payload carries ONLY generic frame / job / structure
 *   handles -- no prose. Canon Part 7: FUSION routes the frozen `deep_research`
 *   reach, minting none. Canon Part 3: every offer is HEDGED, never asserted.
 *
 * node:sqlite builds an in-memory migrated-nodes-schema db + an edges table so the
 * horizontal move round-trips through the real navigation.writeEdge chokepoint.
 * NO em-dashes anywhere (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.resolve(__dirname, '..');
const fusionPath = path.join(REPO_ROOT, 'lib', 'core', 'fusion-router.cjs');
const fusion = require(fusionPath);
const typedFrame = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'typed-frame.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const sensorTypes = require(path.join(REPO_ROOT, 'lib', 'core', 'sensors', 'sensor-types.cjs'));

let pass = 0;
let total = 0;
function check(label, fn) {
  total += 1;
  fn();
  pass += 1;
  console.log('  ok -', label);
}

// In-memory db with the Phase-109-migrated nodes schema + an edges table (mirrors
// tests/test-205-frame-node.cjs freshDb -- no SKIP path).
function freshDb() {
  const { DatabaseSync } = require('node:sqlite');
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
    '  source_section TEXT, ' +
    '  confirmed_by TEXT, ' +
    '  confirmed_at INTEGER' +
    ')'
  );
  db.exec(
    "CREATE TABLE edges (source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, " +
    "properties TEXT DEFAULT '{}', PRIMARY KEY(source, target, type));"
  );
  return db;
}

// Seed two live Frame nodes into room.db for a session.
function seedTwoFrames(db, sid) {
  typedFrame.writeFrameNode(db, { frameKey: 'frame-alpha', sessionId: sid, members: ['section:a'], topic: 'topic:alpha' });
  typedFrame.writeFrameNode(db, { frameKey: 'frame-beta', sessionId: sid, members: ['section:b'], topic: 'topic:beta' });
}

console.log('test-205-fusion-router (item 1): FUSION cross-frame ROUTER');

// ---------------------------------------------------------------------------
// Task 1: the module surface + the read helper.
// ---------------------------------------------------------------------------

check('Test 1 -- fusion-router exports runFusion + sessionEndQuorum', () => {
  assert.equal(typeof fusion.runFusion, 'function', 'runFusion is a function');
  assert.equal(typeof fusion.sessionEndQuorum, 'function', 'sessionEndQuorum is a function');
});

check('Test 2 -- typed-frame.readOpenFrames reads live frames back through the chokepoint family', () => {
  assert.equal(typeof typedFrame.readOpenFrames, 'function', 'readOpenFrames is a function');
  const db = freshDb();
  seedTwoFrames(db, 's1');
  const frames = typedFrame.readOpenFrames(db, { sessionId: 's1' });
  assert.equal(frames.length, 2, 'both live frames read back');
  const keys = frames.map((f) => f.frameKey).sort();
  assert.deepEqual(keys, ['frame-alpha', 'frame-beta'], 'frameKeys round-trip');
  db.close();
});

// ---------------------------------------------------------------------------
// Task 1: assemble -> brain_ask -> job-test -> gate -> horizontal move.
// ---------------------------------------------------------------------------

check('Test 3 -- runFusion assembles live frames and calls the brain_ask DirectiveEnvelope path', () => {
  const db = freshDb();
  seedTwoFrames(db, 's1');
  const r = fusion.runFusion({
    db,
    sessionId: 's1',
    frames: [
      { frameKey: 'frame-alpha', job: 'reduce-time-to-diagnosis', structure: 'pipeline', surface: 'clinical' },
      { frameKey: 'frame-beta', job: 'reduce-time-to-diagnosis', structure: 'pipeline', surface: 'ops' },
    ],
    confidence: 0.82,
  });
  assert.equal(r.frames_assembled, 2, 'two open frames assembled');
  // Part 8 fence: the brain_ask payload carries ONLY generic handles.
  assert.ok(r.brain_handles && Array.isArray(r.brain_handles.job_handles), 'brain_handles present');
  assert.ok(r.brain_handles.job_handles.includes('reduce-time-to-diagnosis'), 'job handle egressed');
  assert.ok(typeof r.envelope_mode === 'string' && r.envelope_mode.length > 0, 'DirectiveEnvelope mode resolved');
  db.close();
});

check('Test 4 -- same-job fixture: classifies horizontal, names a containing system, writes SHARES_JOB + ELEVATES_TO', () => {
  const db = freshDb();
  seedTwoFrames(db, 's1');
  const r = fusion.runFusion({
    db,
    sessionId: 's1',
    frames: [
      { frameKey: 'frame-alpha', job: 'reduce-time-to-diagnosis', structure: 'pipeline', surface: 'clinical' },
      { frameKey: 'frame-beta', job: 'reduce-time-to-diagnosis', structure: 'pipeline', surface: 'ops' },
    ],
    confidence: 0.82,
  });
  assert.equal(r.classification, 'horizontal', 'same job -> horizontal');
  assert.equal(r.fired, true, 'a horizontal move fired');
  assert.equal(r.containing_system, 'system:reduce-time-to-diagnosis', 'names the containing system');
  const types = r.edges_written.map((e) => e.type).sort();
  assert.deepEqual(types, ['ELEVATES_TO', 'SHARES_JOB'], 'both cross-frame edges written');
  // The edges landed in room.db through the chokepoint.
  const sj = db.prepare("SELECT COUNT(*) AS n FROM edges WHERE type = 'SHARES_JOB'").get();
  const el = db.prepare("SELECT COUNT(*) AS n FROM edges WHERE type = 'ELEVATES_TO'").get();
  assert.equal(sj.n, 1, 'SHARES_JOB edge is in room.db');
  assert.equal(el.n, 1, 'ELEVATES_TO edge is in room.db');
  db.close();
});

check('Test 5 -- the confidence gate uses the 0.70 detent (act at/above, offer below)', () => {
  const db = freshDb();
  seedTwoFrames(db, 's1');
  const frames = [
    { frameKey: 'frame-alpha', job: 'same-job', structure: 's', surface: 'x' },
    { frameKey: 'frame-beta', job: 'same-job', structure: 's', surface: 'y' },
  ];
  const hi = fusion.runFusion({ db, sessionId: 's1', frames, confidence: 0.82 });
  const lo = fusion.runFusion({ db, sessionId: 's1', frames, confidence: 0.55 });
  assert.equal(hi.gate.detent, 0.70, 'the detent is the frozen 0.70 (D-Q4)');
  assert.equal(hi.gate.act_or_offer, 'act_and_report', '>=0.70 -> act-and-report');
  assert.equal(lo.gate.act_or_offer, 'offer_as_question', '<0.70 -> offer-as-question');
  // Hedging is ALWAYS on regardless of the gate.
  assert.equal(hi.gate.confidence_axis, 'hedged', 'confidence axis clamped hedged (act)');
  assert.equal(lo.gate.confidence_axis, 'hedged', 'confidence axis clamped hedged (offer)');
  db.close();
});

check('Test 6 -- the horizontal offer is HEDGED (might / here is why), never an assertion', () => {
  const db = freshDb();
  seedTwoFrames(db, 's1');
  const r = fusion.runFusion({
    db,
    sessionId: 's1',
    frames: [
      { frameKey: 'frame-alpha', job: 'jobX', structure: 's', surface: 'x' },
      { frameKey: 'frame-beta', job: 'jobX', structure: 's', surface: 'y' },
    ],
    confidence: 0.9,
  });
  assert.equal(r.offer.hedged, true, 'offer flagged hedged');
  assert.equal(r.offer.asserted, false, 'offer never asserted');
  assert.ok(/MIGHT/.test(r.offer.text), 'offer text hedges with MIGHT');
  assert.ok(/here is why I think/.test(r.offer.text), 'offer text explains the reasoning');
  assert.ok(!/\bthese ARE the same\b/i.test(r.offer.text), 'offer never says these ARE the same');
  db.close();
});

check('Test 7 -- FUSION mints NO new reach_id (routes the frozen deep_research reach)', () => {
  assert.equal(fusion.FUSION_REACH_ID, 'deep_research', 'FUSION routes the frozen deep_research reach');
  // deep_research is one of the frozen six; FUSION is NOT itself a reach_id.
  assert.ok(sensorTypes.REACH_IDS.includes('deep_research'), 'deep_research is a frozen-six member');
  assert.equal(sensorTypes.REACH_IDS.includes('FUSION'), false, 'FUSION is not a reach_id');
  assert.equal(sensorTypes.REACH_IDS.includes('fusion'), false, 'fusion is not a reach_id');
  // The router source references only the frozen reach, never a net-new reach id.
  const src = fs.readFileSync(fusionPath, 'utf8');
  assert.equal(/reach_id\s*[:=]\s*['"](?!deep_research['"])/.test(src.replace(/FUSION_REACH_ID/g, '')), false,
    'no net-new reach_id literal minted in fusion-router');
});

check('Test 8 -- Part 8 fence: no prose egresses; the router makes no network call', () => {
  const src = fs.readFileSync(fusionPath, 'utf8');
  assert.equal(/require\(['"](node:)?https?['"]\)/.test(src), false, 'no http/https require');
  assert.equal(/\bfetch\s*\(/.test(src), false, 'no fetch call (Part 8 zero network)');
  // The brain_ask path goes through directive-envelope.cjs (the Phase 191 operator).
  assert.ok(/require\(['"]\.\/directive-envelope\.cjs['"]\)/.test(src), 'requires directive-envelope.cjs');
  // The brain handles carry only generic ids / enums (built from node_id / job /
  // structure fields), never a members-prose or text field.
  const db = freshDb();
  seedTwoFrames(db, 's1');
  const r = fusion.runFusion({
    db,
    sessionId: 's1',
    frames: [
      { frameKey: 'frame-alpha', job: 'j', structure: 's', surface: 'x' },
      { frameKey: 'frame-beta', job: 'j', structure: 's', surface: 'y' },
    ],
    confidence: 0.8,
  });
  const flat = JSON.stringify(r.brain_handles);
  assert.equal(/\s{2,}[a-z]+\s[a-z]+\s[a-z]+/.test(flat), false, 'brain handles are handles, not prose');
  db.close();
});

check('Test 9 -- fewer than two frames -> no cross-frame move (insufficient_frames)', () => {
  const db = freshDb();
  typedFrame.writeFrameNode(db, { frameKey: 'solo', sessionId: 's1', members: ['section:a'] });
  const r = fusion.runFusion({
    db, sessionId: 's1',
    frames: [{ frameKey: 'solo', job: 'j', structure: 's', surface: 'x' }],
    confidence: 0.9,
  });
  assert.equal(r.fired, false, 'no move on a single frame');
  assert.equal(r.reason, 'insufficient_frames', 'reason names the two-plus precondition');
  db.close();
});

check('Test 10 -- Q2 job-test visibility: visible for learners, invisible for peers', () => {
  assert.equal(fusion.isJobTestVisible('student'), true, 'student -> visible');
  assert.equal(fusion.isJobTestVisible('practitioner'), true, 'practitioner -> visible');
  assert.equal(fusion.isJobTestVisible('researcher'), false, 'researcher -> invisible');
  assert.equal(fusion.isJobTestVisible('professor'), false, 'professor -> invisible');
  assert.equal(fusion.isJobTestVisible(null), true, 'cold start -> learner default -> visible');
});

// ---------------------------------------------------------------------------
// Task 2: session-end quorum (D-Q1) + lateral scaffold (BLOCKED-UNTIL-200).
// ---------------------------------------------------------------------------

check('Test 11 -- session-end quorum forces EXACTLY ONE offered hypothesis when 2+ frames live and none fired', () => {
  const db = freshDb();
  seedTwoFrames(db, 's1');
  const q = fusion.sessionEndQuorum({
    db, sessionId: 's1',
    frames: [
      { frameKey: 'frame-alpha', job: '', structure: 'pipeline', surface: 'x' },
      { frameKey: 'frame-beta', job: '', structure: 'pipeline', surface: 'y' },
    ],
    horizontalFiredThisSession: false,
  });
  assert.equal(q.forced, true, 'quorum forces a hypothesis');
  assert.equal(q.count, 1, 'EXACTLY one offered hypothesis (D-Q1)');
  assert.equal(q.hypothesis.offered, true, 'the hypothesis is offered');
  assert.equal(q.hypothesis.committed, false, 'NEVER auto-committed as a decision (T-205-07-E)');
  assert.equal(q.hypothesis.hedged, true, 'the forced hypothesis is hedged');
  db.close();
});

check('Test 12 -- quorum forces ZERO when a horizontal move already fired', () => {
  const db = freshDb();
  seedTwoFrames(db, 's1');
  const q = fusion.sessionEndQuorum({
    db, sessionId: 's1',
    frames: [
      { frameKey: 'frame-alpha', job: 'j', structure: 's', surface: 'x' },
      { frameKey: 'frame-beta', job: 'j', structure: 's', surface: 'y' },
    ],
    horizontalFiredThisSession: true,
  });
  assert.equal(q.forced, false, 'no forced hypothesis when a horizontal move already fired');
  assert.equal(q.reason, 'horizontal_move_already_fired', 'reason names the already-fired case');
  db.close();
});

check('Test 13 -- the continuous-cadence seam exists but is OFF (D-Q1 boundary-pass first)', () => {
  assert.equal(fusion.CONTINUOUS_CADENCE_ENABLED, false, 'continuous cadence is disabled');
  const src = fs.readFileSync(fusionPath, 'utf8');
  assert.ok(/CONTINUOUS_CADENCE_ENABLED\s*=\s*false/.test(src), 'the seam is present and flagged off');
});

check('Test 14 -- lateral scaffold degrades cleanly when RS (Phase 200) is absent (no fabricated score)', () => {
  const db = freshDb();
  seedTwoFrames(db, 's1');
  const r = fusion.runFusion({
    db, sessionId: 's1',
    frames: [
      // same structure, DIVERGENT surface -> lateral (reverse-salient signature).
      { frameKey: 'frame-alpha', job: 'jobA', structure: 'resilience', surface: 'german' },
      { frameKey: 'frame-beta', job: 'jobB', structure: 'resilience', surface: 'supply-chain' },
    ],
    confidence: 0.9,
    // no lateralEngine injected -> RS is not live.
  });
  assert.equal(r.classification, 'lateral', 'same structure + divergent surface -> lateral');
  assert.equal(r.fired, false, 'lateral does not auto-fire a horizontal move');
  assert.ok(r.lateral, 'a lateral result is present');
  assert.equal(r.lateral.available, false, 'lateral degrades to not-available (RS absent)');
  assert.equal(r.lateral.reason, 'blocked_until_phase_200_rs', 'BLOCKED-UNTIL-200 marker');
  assert.equal(r.lateral.differential_score, null, 'no fabricated differential_score (T-205-07-R)');
  db.close();
});

check('Test 15 -- lateral routes to the RS sideways engine when a live discriminator is injected', () => {
  const db = freshDb();
  seedTwoFrames(db, 's1');
  const r = fusion.runFusion({
    db, sessionId: 's1',
    frames: [
      { frameKey: 'frame-alpha', job: 'jobA', structure: 'resilience', surface: 'german' },
      { frameKey: 'frame-beta', job: 'jobB', structure: 'resilience', surface: 'supply-chain' },
    ],
    confidence: 0.9,
    lateralEngine: { score: function () { return null; } }, // a live RS stub.
  });
  assert.equal(r.classification, 'lateral', 'still lateral');
  assert.equal(r.lateral.available, true, 'RS live -> lateral available');
  assert.equal(r.lateral.routed_to, 'rs_sideways_engine', 'routes to the RS sideways engine');
  assert.equal(r.lateral.differential_score, null, 'score is computed downstream, not fabricated here');
  db.close();
});

check('Test 16 -- the lateral handler never throws on a malformed pair', () => {
  assert.doesNotThrow(() => fusion.runLateralPath({}, null, 'structure'), 'null pair tolerated');
  const r = fusion.runLateralPath({}, [null, null], undefined);
  assert.equal(r.available, false, 'degrades cleanly');
  assert.equal(r.differential_score, null, 'no fabricated score');
});

console.log('\nPASS test-205-fusion-router (' + pass + '/' + total + ')');
process.exit(0);
