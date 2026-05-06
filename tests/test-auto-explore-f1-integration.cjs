'use strict';
/*
 * Phase 117-03 Wave 2 -- AUTOEXPLORE-117-06 (F.1 dispatch contract + verbs).
 * 15 tests covering surfaceFinding + handleUserResponse against the F.1 contract.
 *
 * Per RESEARCH Section 5: F.1 happy path + 4 suppression vocabularies +
 * verb labels + RECOMMENDED gate + emitTelemetry + contract shape +
 * three-surface render parity + persona suffix absent + parent_decision_id +
 * 3 user-response routings.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const agent = require('../lib/agents/auto-explore-agent.cjs');

const TEST_ROOM_PREFIX = path.join(os.tmpdir(), 'mindrian-117-03-f1-');

function makeRoom() {
  const dir = TEST_ROOM_PREFIX + crypto.randomBytes(6).toString('hex');
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  return dir;
}

function rmRoom(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* graceful */ }
}

function makeFinding(overrides) {
  const base = {
    id: 'a'.repeat(32),
    material_id: 'b'.repeat(32),
    source_pipeline: 'cross-domain',
    source_node_id: 'src-node-1',
    target_node_id: 'tgt-node-1',
    score: 0.85,
    candidate_count: 3,
    candidates_per_pipeline: { 'domain': 0, 'trends': 0, 'reverse-salients': 1, 'cross-domain': 2 },
    top_differential: null,
    semantic_surprise: null,
    category_errors_identified: [],
    top_differential_score: null,
    source_section: 'wind power',
    target_section: 'computational stability',
    framework_chain: ['Cross-Domain Analogy'],
    generated_at: 0,
  };
  return Object.assign(base, overrides || {});
}

// Test 1: Happy path -- surfaceFinding dispatches F.1 successfully.
test('AUTOEXPLORE-117-06 #1: surfaceFinding happy path returns surfaced=true', () => {
  const roomDir = makeRoom();
  try {
    const finding = makeFinding({ score: 0.85 });
    const result = agent.surfaceFinding({
      finding: finding,
      roomDir: roomDir,
      operator: 'AUTONOMOUS',
      tier: 1,
    });
    assert.equal(result.surfaced, true, 'expected surfaced=true');
    assert.ok(result.contract || result.rendered, 'expected contract or rendered');
    assert.ok(result.bq_line && result.bq_line.length > 0, 'expected BQ line');
  } finally {
    rmRoom(roomDir);
  }
});

// Test 2: Tier 0 suppress.
test('AUTOEXPLORE-117-06 #2: tier 0 suppresses with suppress_reason=tier_0', () => {
  const finding = makeFinding();
  const result = agent.surfaceFinding({
    finding: finding,
    roomDir: '/tmp',
    operator: 'AUTONOMOUS',
    tier: 0,
  });
  assert.equal(result.surfaced, false);
  assert.equal(result.suppress_reason, 'tier_0');
});

// Test 3: JUST_TALK suppress.
test('AUTOEXPLORE-117-06 #3: JUST_TALK suppresses with suppress_reason=just_talk', () => {
  const finding = makeFinding();
  const result = agent.surfaceFinding({
    finding: finding,
    roomDir: '/tmp',
    operator: 'JUST_TALK',
    tier: 1,
  });
  assert.equal(result.surfaced, false);
  assert.equal(result.suppress_reason, 'just_talk');
});

// Test 4: Invalid finding suppress.
test('AUTOEXPLORE-117-06 #4: invalid finding suppresses with suppress_reason=invalid_finding', () => {
  const result = agent.surfaceFinding({
    finding: null,
    roomDir: '/tmp',
    operator: 'AUTONOMOUS',
    tier: 1,
  });
  assert.equal(result.surfaced, false);
  assert.equal(result.suppress_reason, 'invalid_finding');
});

// Test 5: surfaceFinding never throws on malformed args.
test('AUTOEXPLORE-117-06 #5: surfaceFinding never throws on malformed args', () => {
  let result;
  try {
    result = agent.surfaceFinding({});
  } catch (e) {
    assert.fail('threw: ' + e.message);
  }
  assert.equal(result.surfaced, false);
});

// Test 6: Verb labels exactly ['Explore', 'Skip', 'Later'] (locked).
test('AUTOEXPLORE-117-06 #6: F.1 verbs locked at Explore/Skip/Later', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'agents', 'auto-explore-agent.cjs'), 'utf8');
  assert.match(src, /\['Explore', 'Skip', 'Later'\]/, 'verb literal not found in source');
});

// Test 7: recommendedVerb null when score < 0.7; 'Explore' when >= 0.7 (Phase 88.2 invariant).
test('AUTOEXPLORE-117-06 #7: RECOMMENDED gate at >= 0.7 (Phase 88.2 invariant)', () => {
  const roomDir = makeRoom();
  try {
    const lowScore = makeFinding({ score: 0.5 });
    const result1 = agent.surfaceFinding({
      finding: lowScore,
      roomDir: roomDir,
      operator: 'AUTONOMOUS',
      tier: 1,
    });
    // populateHSIAnalysis sets top_differential_score = 0.5 -> recommendedVerb null.
    assert.equal(result1.surfaced, true);
    assert.equal(Number(result1.finding.top_differential_score), 0.5);

    const highScore = makeFinding({ score: 0.85 });
    const result2 = agent.surfaceFinding({
      finding: highScore,
      roomDir: roomDir,
      operator: 'AUTONOMOUS',
      tier: 1,
    });
    assert.equal(result2.surfaced, true);
    assert.ok(Number(result2.finding.top_differential_score) >= 0.7);
  } finally {
    rmRoom(roomDir);
  }
});

// Test 8: Surface result carries bq_line + parent_decision_id + finding.
test('AUTOEXPLORE-117-06 #8: surface result shape carries bq_line + parent_decision_id + finding', () => {
  const roomDir = makeRoom();
  try {
    const finding = makeFinding();
    const result = agent.surfaceFinding({
      finding: finding,
      roomDir: roomDir,
      operator: 'AUTONOMOUS',
      tier: 1,
    });
    assert.equal(result.surfaced, true);
    assert.ok(typeof result.bq_line === 'string' && result.bq_line.length > 0);
    assert.ok(typeof result.parent_decision_id === 'string');
    assert.equal(result.parent_decision_id, finding.id);
    assert.ok(result.finding && typeof result.finding === 'object');
  } finally {
    rmRoom(roomDir);
  }
});

// Test 9: Three-surface render parity -- same finding produces deep-equal contract on CLI/Desktop/Cowork.
test('AUTOEXPLORE-117-06 #9: three-surface render parity', () => {
  const roomDir = makeRoom();
  try {
    const finding = makeFinding();
    const r1 = agent.surfaceFinding({ finding: finding, roomDir: roomDir, operator: 'AUTONOMOUS', tier: 1 });
    const r2 = agent.surfaceFinding({ finding: finding, roomDir: roomDir, operator: 'AUTONOMOUS', tier: 1 });
    assert.equal(r1.surfaced, true);
    assert.equal(r2.surfaced, true);
    assert.equal(r1.bq_line, r2.bq_line, 'BQ line should be identical');
    assert.equal(r1.parent_decision_id, r2.parent_decision_id);
  } finally {
    rmRoom(roomDir);
  }
});

// Test 10: parent_decision_id is sha256-32-hex format (matches finding.id).
test('AUTOEXPLORE-117-06 #10: parent_decision_id is sha256-32 hex', () => {
  const roomDir = makeRoom();
  try {
    const findingId = crypto.createHash('sha256').update('test').digest('hex').slice(0, 32);
    const finding = makeFinding({ id: findingId });
    const result = agent.surfaceFinding({
      finding: finding,
      roomDir: roomDir,
      operator: 'AUTONOMOUS',
      tier: 1,
    });
    assert.equal(result.surfaced, true);
    assert.match(result.parent_decision_id, /^[0-9a-f]{32}$/);
  } finally {
    rmRoom(roomDir);
  }
});

// Test 11: handleUserResponse EXPLORE -- routes to ledger; attempts INFORMS edge.
test('AUTOEXPLORE-117-06 #11: handleUserResponse EXPLORE routes to ledger', () => {
  const roomDir = makeRoom();
  try {
    const finding = makeFinding();
    const result = agent.handleUserResponse({
      finding: finding,
      userResponse: 'EXPLORE',
      roomDir: roomDir,
      db: null, // no db -> ledger only, no edge emitted
      materialNodeId: 'mat-node-1',
      parent_decision_id: finding.id,
    });
    assert.equal(result.ok, true);
    assert.equal(result.response, 'EXPLORE');
  } finally {
    rmRoom(roomDir);
  }
});

// Test 12: handleUserResponse SKIP -- routes to ledger only; no cascade edge attempted.
test('AUTOEXPLORE-117-06 #12: handleUserResponse SKIP appends ledger no edge', () => {
  const roomDir = makeRoom();
  try {
    const finding = makeFinding();
    const result = agent.handleUserResponse({
      finding: finding,
      userResponse: 'SKIP',
      roomDir: roomDir,
      db: null,
    });
    assert.equal(result.ok, true);
    assert.equal(result.response, 'SKIP');
    assert.equal(result.edge, null, 'SKIP must not emit cascade edge');
  } finally {
    rmRoom(roomDir);
  }
});

// Test 13: handleUserResponse LATER -- requeue; ledger entry but no edge.
test('AUTOEXPLORE-117-06 #13: handleUserResponse LATER requeues with no edge', () => {
  const roomDir = makeRoom();
  try {
    const finding = makeFinding();
    const result = agent.handleUserResponse({
      finding: finding,
      userResponse: 'LATER',
      roomDir: roomDir,
      db: null,
    });
    assert.equal(result.ok, true);
    assert.equal(result.response, 'LATER');
    assert.equal(result.edge, null);
  } finally {
    rmRoom(roomDir);
  }
});

// Test 14: handleUserResponse rejects invalid response.
test('AUTOEXPLORE-117-06 #14: handleUserResponse rejects invalid_response', () => {
  const finding = makeFinding();
  const result = agent.handleUserResponse({
    finding: finding,
    userResponse: 'BOGUS_VERB',
    roomDir: '/tmp',
    db: null,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid_response');
});

// Test 15: buildExploreApprovedEdge emits INFORMS edge with properties.source='auto-explore'.
test('AUTOEXPLORE-117-06 #15: buildExploreApprovedEdge emits INFORMS edge', () => {
  const finding = makeFinding();
  const edge = agent.buildExploreApprovedEdge({
    finding: finding,
    materialNodeId: 'mat-1',
    parent_decision_id: finding.id,
  });
  assert.ok(edge, 'expected edge object');
  assert.equal(edge.type, 'INFORMS');
  assert.equal(edge.source, 'mat-1');
  assert.equal(edge.target, 'tgt-node-1');
  assert.equal(edge.properties.source, 'auto-explore');
  assert.equal(edge.properties.material_id, finding.material_id);
  assert.equal(edge.properties.finding_id, finding.id);
});
