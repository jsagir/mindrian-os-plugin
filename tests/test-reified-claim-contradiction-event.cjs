'use strict';
// Quick task 260725-9ca Task 2 -- reified-claim ContradictionEvent writer driver.
//
// Asserts the net-new writeContradictionEvent primitive:
//   - mints a type='ContradictionEvent' node, review_status='proposed'
//     (NEVER auto-confirmed -- Canon Part 9), created_by='system', with
//     properties.evidence / properties.status matching input
//   - wires exactly ONE CONCERNS edge (event -> claim) and ONE CONTRADICTS edge
//     (event -> rivalClaim), both landed through navigation.writeEdge (asserted by
//     querying the edges table directly, not by trusting the return value)
//   - gates claim / rivalClaim participants to EXISTING type='claim' nodes; a
//     missing or wrong-type id is rejected with invalid_claim_participant_type /
//     invalid_rival_claim_participant_type, and NO node/edge is written
//   - rejects self-contradiction (claim === rivalClaim) with invalid_same_participant
//   - gates status against the frozen {open, resolved} Set; absent status -> 'open'
//   - a non-object params returns invalid_params
//   - is idempotent: the same (claim, rivalClaim, evidence, status) tuple mints the
//     SAME node_id and does not duplicate the row (the SQLite ON CONFLICT target
//     replaces the Brain-side Cypher MERGE)
//   - re-export identity holds: navigation.writeContradictionEvent === the module's
//   - CONCERNS is a member of ALLOWED_EDGE_TYPES; CONTRADICTS was already a member
//     (proving no CONTRADICTED_BY was minted per the Edge vocabulary decision)
//   - ACCEPTANCE CASE: reifies the recurring-reach-card RCA contradiction from
//     260725-9ca-CONTEXT.md's worked example
//
// Participants are seeded via navigation.writeClaimNode (the shipped chokepoint)
// so the test never hand-inserts a fake 'claim'-typed row via raw SQL -- exactly
// like a real caller would produce them (Canon Part 7 reuse-before-build).
//
// SKIP 77 if node:sqlite is unavailable (the established Phase 150 discipline).
// NO em-dashes anywhere (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const path = require('node:path');

try {
  require('node:sqlite');
} catch (_e) {
  process.stdout.write('SKIP test-reified-claim-contradiction-event.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const { DatabaseSync } = require('node:sqlite');
const REPO_ROOT = path.resolve(__dirname, '..');
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const reifiedClaim = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'reified-claim.cjs'));
const edges = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'edges.cjs'));
const { applySchema } = require(path.join(__dirname, 'claim-harness', 'build-fixture-room-db.cjs'));

const {
  writeContradictionEvent, writeClaimNode, REIFIED_CLAIM_EVENT_ID, REIFIED_STATUS_VALUES,
} = navigation;

let pass = 0;
function check(label, fn) {
  fn();
  pass += 1;
  console.log('  ok -', label);
}

function freshDb() {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  return db;
}

// seedClaim -- mint a REAL typed_claim participant through the shipped writer and
// return its node id (exactly like a real caller would).
function seedClaim(db, knowledgeType, text, sessionId) {
  const r = writeClaimNode(db, { knowledge_type: knowledgeType, text: text, sessionId: sessionId });
  assert.equal(r.ok, true, `seed claim failed: ${JSON.stringify(r)}`);
  return r.node_id;
}

function countNodes(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM nodes').get().n;
}
function countEdges(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM edges').get().n;
}

console.log('test-reified-claim-contradiction-event');

// (1) Mint: type='ContradictionEvent', review_status='proposed', created_by='system',
//     properties.evidence/status match input.
check("writeContradictionEvent mints type='ContradictionEvent' review_status='proposed'", () => {
  const db = freshDb();
  const claim = seedClaim(db, 'fact', 'the market is 190M USD', 's1');
  const rival = seedClaim(db, 'anomaly_cue', 'the market never materialized', 's1r');
  const r = writeContradictionEvent(db, {
    claim: claim, rivalClaim: rival, evidence: 'ev:handle-1', status: 'open',
  });
  assert.equal(r.ok, true, `expected ok:true, got ${JSON.stringify(r)}`);
  assert.equal(r.event_type, 'ContradictionEvent');
  const row = db.prepare('SELECT type, created_by, review_status, properties FROM nodes WHERE id = ?').get(r.node_id);
  assert.equal(row.type, 'ContradictionEvent');
  assert.equal(row.created_by, 'system');
  assert.equal(row.review_status, 'proposed', 'a ContradictionEvent must NEVER mint confirmed');
  const props = JSON.parse(row.properties);
  assert.equal(props.evidence, 'ev:handle-1');
  assert.equal(props.status, 'open');
  db.close();
});

// (2) Wiring: exactly one CONCERNS (event->claim) and one CONTRADICTS
//     (event->rivalClaim) edge land in the edges table (queried directly).
check('exactly one CONCERNS (event->claim) + one CONTRADICTS (event->rivalClaim) edge land', () => {
  const db = freshDb();
  const claim = seedClaim(db, 'fact', 'claim A', 's2');
  const rival = seedClaim(db, 'anomaly_cue', 'rival B', 's2r');
  const r = writeContradictionEvent(db, {
    claim: claim, rivalClaim: rival, evidence: 'ev:wiring', status: 'open',
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  const concerns = db.prepare("SELECT source, target FROM edges WHERE type='CONCERNS'").all();
  assert.equal(concerns.length, 1, 'exactly one CONCERNS edge');
  assert.equal(concerns[0].source, r.node_id, 'CONCERNS source is the event node');
  assert.equal(concerns[0].target, claim, 'CONCERNS target is the claim participant');
  const contradicts = db.prepare("SELECT source, target FROM edges WHERE type='CONTRADICTS'").all();
  assert.equal(contradicts.length, 1, 'exactly one CONTRADICTS edge');
  assert.equal(contradicts[0].source, r.node_id, 'CONTRADICTS source is the event node');
  assert.equal(contradicts[0].target, rival, 'CONTRADICTS target is the rivalClaim participant');
  db.close();
});

// (3) Participant-type gate: a claim id that does not resolve to a type='claim'
//     node is rejected; nothing is written.
check('missing/non-claim claim id -> invalid_claim_participant_type, no write', () => {
  const db = freshDb();
  const rival = seedClaim(db, 'anomaly_cue', 'real rival', 's3r');
  const nodesBefore = countNodes(db);
  const edgesBefore = countEdges(db);
  // (a) missing claim id
  const rMissing = writeContradictionEvent(db, {
    claim: 'claim:does-not-exist', rivalClaim: rival, evidence: 'ev:x', status: 'open',
  });
  assert.equal(rMissing.ok, false);
  assert.equal(rMissing.reason, 'invalid_claim_participant_type');
  // (b) wrong-type claim id (a non-claim node). Seed a plain node of another type.
  db.prepare(
    "INSERT INTO nodes (id, type, properties, source_path, created_by, created_at, last_seen_at) " +
    "VALUES ('entity:x', 'company', '{}', 'test', 'system', 0, 0)"
  ).run();
  const rWrong = writeContradictionEvent(db, {
    claim: 'entity:x', rivalClaim: rival, evidence: 'ev:x', status: 'open',
  });
  assert.equal(rWrong.ok, false);
  assert.equal(rWrong.reason, 'invalid_claim_participant_type');
  assert.equal(rWrong.detail, 'company', 'detail names the wrong type');
  // No ContradictionEvent node and no CONCERNS/CONTRADICTS edge was written.
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type='ContradictionEvent'").get().n, 0);
  assert.equal(countEdges(db), edgesBefore, 'no edge written for the rejected calls');
  // (nodesBefore + 1 for the manually-seeded entity:x; no event node added.)
  assert.equal(countNodes(db), nodesBefore + 1);
  db.close();
});

// (3b) Participant-type gate on the rivalClaim side.
check('missing/non-claim rivalClaim id -> invalid_rival_claim_participant_type, no write', () => {
  const db = freshDb();
  const claim = seedClaim(db, 'fact', 'real claim', 's3b');
  const edgesBefore = countEdges(db);
  const r = writeContradictionEvent(db, {
    claim: claim, rivalClaim: 'claim:missing-rival', evidence: 'ev:x', status: 'open',
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'invalid_rival_claim_participant_type');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type='ContradictionEvent'").get().n, 0);
  assert.equal(countEdges(db), edgesBefore, 'no edge written for the rejected call');
  db.close();
});

// (4) Self-contradiction gate.
check('claim === rivalClaim -> invalid_same_participant', () => {
  const db = freshDb();
  const claim = seedClaim(db, 'fact', 'self', 's4');
  const r = writeContradictionEvent(db, {
    claim: claim, rivalClaim: claim, evidence: 'ev:self', status: 'open',
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'invalid_same_participant');
  db.close();
});

// (5) Status enum gate + default.
check("status outside {open,resolved} -> invalid_status; omitted -> 'open'", () => {
  const db = freshDb();
  const claim = seedClaim(db, 'fact', 'claim S', 's5');
  const rival = seedClaim(db, 'anomaly_cue', 'rival S', 's5r');
  const bad = writeContradictionEvent(db, {
    claim: claim, rivalClaim: rival, evidence: 'ev:s', status: 'pending',
  });
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, 'invalid_status');
  assert.equal(bad.detail, 'pending');
  // Omitted status defaults to 'open'.
  const dflt = writeContradictionEvent(db, {
    claim: claim, rivalClaim: rival, evidence: 'ev:s',
  });
  assert.equal(dflt.ok, true, JSON.stringify(dflt));
  const props = JSON.parse(db.prepare('SELECT properties FROM nodes WHERE id = ?').get(dflt.node_id).properties);
  assert.equal(props.status, 'open', 'absent status defaults to open');
  db.close();
});

// (6) Non-object params + empty-string field gates.
check('non-object params -> invalid_params; empty fields rejected', () => {
  const db = freshDb();
  assert.equal(writeContradictionEvent(db, null).reason, 'invalid_params');
  assert.equal(writeContradictionEvent(db, 'nope').reason, 'invalid_params');
  assert.equal(writeContradictionEvent(db, []).reason, 'invalid_params');
  const claim = seedClaim(db, 'fact', 'claim E', 's6');
  const rival = seedClaim(db, 'anomaly_cue', 'rival E', 's6r');
  assert.equal(writeContradictionEvent(db, { claim: '', rivalClaim: rival, evidence: 'e' }).reason, 'invalid_claim');
  assert.equal(writeContradictionEvent(db, { claim: claim, rivalClaim: '', evidence: 'e' }).reason, 'invalid_rival_claim');
  assert.equal(writeContradictionEvent(db, { claim: claim, rivalClaim: rival, evidence: '' }).reason, 'invalid_evidence');
  db.close();
});

// (7) Idempotency: same tuple mints the same node id, no duplicate row.
check('identical (claim, rivalClaim, evidence, status) is idempotent (COUNT stays 1)', () => {
  const db = freshDb();
  const claim = seedClaim(db, 'fact', 'claim I', 's7');
  const rival = seedClaim(db, 'anomaly_cue', 'rival I', 's7r');
  const params = { claim: claim, rivalClaim: rival, evidence: 'ev:idem', status: 'open' };
  const r1 = writeContradictionEvent(db, params);
  const r2 = writeContradictionEvent(db, Object.assign({}, params));
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  assert.equal(r2.node_id, r1.node_id, 'same tuple must mint the same node id');
  const cnt = db.prepare('SELECT COUNT(*) AS n FROM nodes WHERE id = ?').get(r1.node_id).n;
  assert.equal(cnt, 1, 'no duplicate row -- the ON CONFLICT target replaces the Cypher MERGE');
  db.close();
});

// (8) Re-export identity.
check('navigation.writeContradictionEvent === reified-claim module (re-export identity)', () => {
  assert.equal(navigation.writeContradictionEvent, reifiedClaim.writeContradictionEvent);
  assert.equal(navigation.REIFIED_CLAIM_EVENT_ID, reifiedClaim.REIFIED_CLAIM_EVENT_ID);
  assert.equal(REIFIED_STATUS_VALUES instanceof Set, true);
  assert.equal(REIFIED_STATUS_VALUES.size, 2);
});

// (9) CONCERNS is a member; CONTRADICTS was already a member (no CONTRADICTED_BY).
check('CONCERNS + CONTRADICTS are members of ALLOWED_EDGE_TYPES; no CONTRADICTED_BY', () => {
  assert.equal(edges.ALLOWED_EDGE_TYPES.has('CONCERNS'), true, 'CONCERNS must be registered');
  assert.equal(edges.ALLOWED_EDGE_TYPES.has('CONTRADICTS'), true, 'CONTRADICTS must already be a member');
  assert.equal(edges.ALLOWED_EDGE_TYPES.has('CONTRADICTED_BY'), false, 'no CONTRADICTED_BY minted');
});

// (9b) REIFIED_CLAIM_EVENT_ID is deterministic + namespaced with the event: prefix.
check("REIFIED_CLAIM_EVENT_ID is deterministic + 'event:contradictionevent:' prefixed", () => {
  const a = REIFIED_CLAIM_EVENT_ID('ContradictionEvent', { claim: 'c1', rivalClaim: 'c2', evidence: 'e', status: 'open' });
  const b = REIFIED_CLAIM_EVENT_ID('ContradictionEvent', { claim: 'c1', rivalClaim: 'c2', evidence: 'e', status: 'open' });
  const c = REIFIED_CLAIM_EVENT_ID('ContradictionEvent', { claim: 'c1', rivalClaim: 'c2', evidence: 'e', status: 'resolved' });
  assert.equal(a, b, 'same participants mint the same id');
  assert.notEqual(a, c, 'a status change mints a DIFFERENT id (hash includes status)');
  assert.equal(a.indexOf('event:contradictionevent:'), 0, 'id is namespaced with the event: prefix');
});

// (10) ACCEPTANCE CASE -- the worked recurring-reach-card RCA contradiction from
//      .planning/debug/recurring-reach-card-defeats-relevance-gate-and-hsi-clamp-garbage.md
//      (per 260725-9ca-CONTEXT.md's specifics section).
check('ACCEPTANCE: reifies the recurring-reach-card RCA contradiction (Finding-2-fixed vs recurs-anyway) from recurring-reach-card-defeats-relevance-gate-and-hsi-clamp-garbage.md', () => {
  const db = freshDb();
  // claim = "Finding 2 fixed (commit 62b09ee8)" as a fact typed_claim.
  const finding2Fixed = seedClaim(
    db, 'fact',
    'Finding 2 CONFIRMED and FIXED in commit 62b09ee8 (relevance gate + HSI clamp corrected)',
    'rca:finding-2-fixed'
  );
  // rivalClaim = "recurs anyway (2026-07-23, 2026-07-25 evidence)" as an anomaly_cue.
  const recursAnyway = seedClaim(
    db, 'anomaly_cue',
    'the recurring reach card recurs anyway per the 2026-07-23 and 2026-07-25 recurrence evidence',
    'rca:recurs-anyway'
  );
  const evidenceHandle = 'rca:recurring-reach-card-defeats-relevance-gate-and-hsi-clamp-garbage#finding-2';
  const r = writeContradictionEvent(db, {
    claim: finding2Fixed,
    rivalClaim: recursAnyway,
    evidence: evidenceHandle,
    status: 'open',
  });
  assert.equal(r.ok, true, `acceptance reify failed: ${JSON.stringify(r)}`);
  // CONCERNS points at the Finding-2-fixed claim.
  const concerns = db.prepare("SELECT target FROM edges WHERE type='CONCERNS' AND source = ?").get(r.node_id);
  assert.equal(concerns.target, finding2Fixed, 'CONCERNS points at the Finding-2-fixed claim');
  // CONTRADICTS points at the recurs-anyway claim.
  const contradicts = db.prepare("SELECT target FROM edges WHERE type='CONTRADICTS' AND source = ?").get(r.node_id);
  assert.equal(contradicts.target, recursAnyway, 'CONTRADICTS points at the recurs-anyway claim');
  // The persisted status reads 'open'.
  const props = JSON.parse(db.prepare('SELECT properties FROM nodes WHERE id = ?').get(r.node_id).properties);
  assert.equal(props.status, 'open');
  assert.equal(props.evidence, evidenceHandle, 'evidence is the short handle, never full prose');
  db.close();
});

console.log(`\ntest-reified-claim-contradiction-event: ${pass} checks passed`);
