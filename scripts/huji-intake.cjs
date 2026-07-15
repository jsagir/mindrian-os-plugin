#!/usr/bin/env node
'use strict';
/*
 * scripts/huji-intake.cjs - Phase 229-05, seam (b): the deterministic room-populator.
 *
 * populateRoom({roomDir, evidence, transcript, sessionId}) drives the SHIPPED Claimify
 * writer (navigation.writeClaimNode) DIRECTLY over a scratch room.db, exactly as the
 * shipped file-meeting pipeline populates a real room, but NON-INTERACTIVELY. It never
 * invokes the interactive file-meeting slash command: that command carries an F.8
 * nugget-routing HITL and uses AskUserQuestion, which would block an unattended
 * --permission-mode dontAsk session (CONTRACTS INTAKE_PATH). We reuse the MACHINERY,
 * not the interactive shell.
 *
 * Every claim in the Stage A evidence.json (problem_claim, value_proposition, and each
 * evidence_claims[] item) mints ONE typed claim node with:
 *   - review_status='proposed' (NEVER auto-confirmed; only a human confirmNode promotes,
 *     Canon Part 9 role 5),
 *   - the VERBATIM transcript quote + evidenced disposition riding the additive extraProps
 *     blob (D1 anchor rides into the node, protected keys untouched),
 *   - a stable sourceSegment id so a rerun UPSERTs rather than duplicating (idempotency).
 *
 * Related claims are linked through navigation.writeEdge (ALLOWED_EDGE_TYPES only), and
 * wisdom nuggets are extracted the way file-meeting surfaces them. Room population is
 * LOCAL room.db ONLY - no Brain write, no network (Canon Part 8, threat T-229-05-03).
 *
 * CJS only. No em-dashes (CLAUDE.md HARD RULE). Zero new dependencies (reuse shipped core).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');
const navigation = require('../lib/core/navigation.cjs');

// --------------------------------------------------------------------------
// knowledgeTypeForEvidence - map the evidence `evidenced` enum onto the frozen
// 6-member KNOWLEDGE_TYPES taxonomy. Only a demonstrated ('evidenced') claim rises
// to 'fact'; an asserted or absent claim is an 'assumption' (an unvalidated venture
// belief). Problem and value claims are venture hypotheses, so 'assumption' by default.
// --------------------------------------------------------------------------
function knowledgeTypeForEvidence(evidenced) {
  if (evidenced === 'evidenced') return 'fact';
  return 'assumption'; // 'asserted' | 'absent' | anything else -> unvalidated belief
}

// --------------------------------------------------------------------------
// extractWisdomNuggets - the file-meeting nugget pass, made deterministic. A nugget
// is a notable, quote-anchored signal worth surfacing. Two sources, both grounded in
// what the student actually said (never fabricated):
//   1. self_identified_gaps - metacognition signals (REWARD, never double-punish).
//   2. evidenced claims - the pitch's strongest, backed points.
// Returns an array of { kind, text, quote }. Pure function, no writes.
// --------------------------------------------------------------------------
function extractWisdomNuggets(evidence) {
  const nuggets = [];
  const gaps = Array.isArray(evidence.self_identified_gaps) ? evidence.self_identified_gaps : [];
  for (const gap of gaps) {
    if (typeof gap === 'string' && gap.trim().length > 0) {
      nuggets.push({ kind: 'self_identified_gap', text: gap.trim(), quote: '' });
    }
  }
  const claims = Array.isArray(evidence.evidence_claims) ? evidence.evidence_claims : [];
  for (const c of claims) {
    if (c && c.evidenced === 'evidenced' && typeof c.claim === 'string') {
      nuggets.push({ kind: 'evidenced_strength', text: c.claim, quote: typeof c.quote === 'string' ? c.quote : '' });
    }
  }
  return nuggets;
}

// --------------------------------------------------------------------------
// buildClaimSpecs - flatten the evidence object into an ordered list of claim specs.
// Each spec carries a STABLE sourceSegment id (role + deterministic index + timestamp
// when present) so reruns UPSERT the exact same node ids (idempotency key, per the
// writeClaimNode CLAIM_NODE_ID(sessionId, segmentKey) contract).
// --------------------------------------------------------------------------
function buildClaimSpecs(evidence) {
  const specs = [];

  if (evidence.problem_claim && evidence.problem_claim.stated) {
    const ts = evidence.problem_claim.timestamp;
    specs.push({
      role: 'problem_claim',
      text: evidence.problem_claim.quote || 'problem claim',
      quote: evidence.problem_claim.quote || '',
      evidenced: 'asserted',
      knowledge_type: 'assumption',
      sourceSegment: 'problem_claim@' + (typeof ts === 'string' && ts ? ts : 'na'),
    });
  }

  if (evidence.value_proposition && evidence.value_proposition.stated) {
    specs.push({
      role: 'value_proposition',
      text: evidence.value_proposition.quote || 'value proposition',
      quote: evidence.value_proposition.quote || '',
      evidenced: 'asserted',
      knowledge_type: 'assumption',
      sourceSegment: 'value_proposition',
    });
  }

  const claims = Array.isArray(evidence.evidence_claims) ? evidence.evidence_claims : [];
  claims.forEach((c, i) => {
    if (!c || typeof c.claim !== 'string') return;
    specs.push({
      role: 'evidence_claim',
      index: i,
      text: c.claim,
      quote: typeof c.quote === 'string' ? c.quote : '',
      evidenced: typeof c.evidenced === 'string' ? c.evidenced : 'asserted',
      knowledge_type: knowledgeTypeForEvidence(c.evidenced),
      // absent = a claimed-but-unmade element: unresolved, so mark ambiguous for review.
      disambiguation: c.evidenced === 'absent' ? 'ambiguous' : undefined,
      sourceSegment: 'evidence:' + i,
    });
  });

  return specs;
}

// --------------------------------------------------------------------------
// populateRoom - the entry point. Opens the scratch room.db, mints one proposed claim
// node per evidence claim, links related claims, extracts wisdom nuggets. Idempotent.
// Returns { ok, roomDir, sessionId, minted:[node_id...], edges:[edge_id...],
//   nuggets:[...], errors:[...] }. Defensive: never throws on caller input.
// --------------------------------------------------------------------------
function populateRoom(opts) {
  const { roomDir, evidence, sessionId } = opts || {};
  if (typeof roomDir !== 'string' || roomDir.length === 0) {
    return { ok: false, reason: 'invalid_roomDir' };
  }
  if (!evidence || typeof evidence !== 'object') {
    return { ok: false, reason: 'invalid_evidence' };
  }
  const sid = typeof sessionId === 'string' && sessionId.length > 0
    ? sessionId
    : (typeof evidence.submission_id === 'string' && evidence.submission_id.length > 0
      ? evidence.submission_id
      : 'huji-intake');
  const speaker = evidence.speaker_count === 1 ? 'Speaker 2' : 'presenter';

  const minted = [];
  const edges = [];
  const errors = [];
  const byRole = {}; // role/index -> node_id, for edge wiring

  const db = openRoomDb(roomDir);
  try {
    const specs = buildClaimSpecs(evidence);
    for (const spec of specs) {
      const params = {
        knowledge_type: spec.knowledge_type,
        text: spec.text,
        sessionId: sid,
        sourceSegment: spec.sourceSegment,
        sourceSpeaker: speaker,
        // verbatim quote + evidenced disposition ride the additive extraProps blob
        // (D1 anchor persisted onto the node; protected keys are filtered by the writer).
        extraProps: { quote: spec.quote, evidenced: spec.evidenced, intake_stage: 'A' },
      };
      if (spec.disambiguation) params.disambiguation = spec.disambiguation;

      const res = navigation.writeClaimNode(db, params);
      if (res && res.ok) {
        minted.push(res.node_id);
        const key = spec.role === 'evidence_claim' ? 'evidence:' + spec.index : spec.role;
        byRole[key] = res.node_id;
      } else {
        errors.push({ segment: spec.sourceSegment, reason: res && res.reason });
      }
    }

    // Link related claims (ALLOWED_EDGE_TYPES only). value_proposition RELATED_TO the
    // problem it addresses; each evidence claim SUPPORTS the value proposition. Edges
    // are minted only when BOTH endpoints exist, all born review_status 'proposed'.
    const problemId = byRole.problem_claim;
    const valueId = byRole.value_proposition;
    if (valueId && problemId) {
      const e = navigation.writeEdge(db, {
        source_id: valueId, target_id: problemId, edge_type: 'RELATED_TO', review_status: 'proposed',
      });
      if (e && e.ok) edges.push(e.edge_id); else errors.push({ edge: 'value->problem', reason: e && e.reason });
    }
    if (valueId) {
      for (const key of Object.keys(byRole)) {
        if (key.indexOf('evidence:') !== 0) continue;
        const e = navigation.writeEdge(db, {
          source_id: byRole[key], target_id: valueId, edge_type: 'SUPPORTS', review_status: 'proposed',
        });
        if (e && e.ok) edges.push(e.edge_id); else errors.push({ edge: key + '->value', reason: e && e.reason });
      }
    }

    const nuggets = extractWisdomNuggets(evidence);
    return { ok: true, roomDir, sessionId: sid, minted, edges, nuggets, errors };
  } finally {
    try { closeRoomDb(db); } catch (_e) { /* never throw on close */ }
  }
}

// --------------------------------------------------------------------------
// --selftest: scaffold a throwaway room, run populateRoom over a tiny evidence object,
// assert claim nodes exist with review_status='proposed', and that a SECOND run does
// not duplicate them (idempotency). Exits 0 on pass, 1 on failure. No model calls.
// --------------------------------------------------------------------------
function selftest() {
  const assert = require('node:assert');
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'huji-intake-selftest-'));
  const roomDir = path.join(tmpRoot, 'scratch-room');
  fs.mkdirSync(roomDir, { recursive: true });
  // A grading-legal scratch STATE.md (Stage: Validation) per AI-SPEC pitfall 3; not
  // strictly needed for the write, but keeps the scratch room shaped like the real one.
  fs.writeFileSync(path.join(roomDir, 'STATE.md'), '# Scratch Room\n\nStage: Validation\n', 'utf8');

  const evidence = {
    submission_id: 'selftest-001',
    problem_claim: { stated: true, quote: 'Food allergies are a big problem around the world.', timestamp: '0:10' },
    value_proposition: { stated: true, quote: 'a tiny device that tests your food right at the table' },
    evidence_claims: [
      { claim: 'uses a smart light sensor', quote: 'The science inside uses smart light sensor.', evidenced: 'asserted' },
      { claim: 'passed a validation study', quote: 'We ran a validation study with real users.', evidenced: 'evidenced' },
      { claim: 'has FDA approval', quote: '', evidenced: 'absent' },
    ],
    self_identified_gaps: ['deeper market research', 'competitor analysis'],
    speaker_count: 1,
    language_notes: 'Non-native English; minor disfluencies. Not content weaknesses.',
  };

  const r1 = populateRoom({ roomDir, evidence, sessionId: 'selftest-001' });
  assert.strictEqual(r1.ok, true, 'first run must succeed: ' + JSON.stringify(r1));
  assert.strictEqual(r1.errors.length, 0, 'first run must have zero write errors: ' + JSON.stringify(r1.errors));
  // 2 anchors + 3 evidence claims = 5 claim nodes.
  assert.strictEqual(r1.minted.length, 5, 'expected 5 minted claim nodes, got ' + r1.minted.length);
  assert.ok(r1.nuggets.length >= 2, 'expected wisdom nuggets (>=2 gaps), got ' + r1.nuggets.length);
  assert.ok(r1.nuggets.some((n) => n.kind === 'evidenced_strength'), 'expected an evidenced_strength nugget');

  // Assert the nodes exist as type='claim', review_status='proposed'.
  const db = openRoomDb(roomDir);
  let countAfterFirst;
  let proposedCount;
  try {
    countAfterFirst = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type='claim'").get().n;
    proposedCount = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type='claim' AND review_status='proposed'").get().n;
  } finally {
    closeRoomDb(db);
  }
  assert.strictEqual(countAfterFirst, 5, 'expected 5 claim rows after first run, got ' + countAfterFirst);
  assert.strictEqual(proposedCount, 5, 'all 5 claim nodes must be review_status=proposed, got ' + proposedCount);

  // Second run: idempotent, MUST NOT duplicate.
  const r2 = populateRoom({ roomDir, evidence, sessionId: 'selftest-001' });
  assert.strictEqual(r2.ok, true, 'second run must succeed');
  const db2 = openRoomDb(roomDir);
  let countAfterSecond;
  try {
    countAfterSecond = db2.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type='claim'").get().n;
  } finally {
    closeRoomDb(db2);
  }
  assert.strictEqual(countAfterSecond, 5, 'rerun must not duplicate; expected 5 claim rows, got ' + countAfterSecond);

  // Clean up the throwaway room.
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  console.log('OK - huji-intake selftest passed: 5 proposed claim nodes, idempotent rerun, nuggets extracted');
}

if (require.main === module) {
  if (process.argv.includes('--selftest')) {
    try {
      selftest();
      process.exit(0);
    } catch (e) {
      console.error('SELFTEST FAILED:', e && e.message ? e.message : e);
      process.exit(1);
    }
  } else {
    console.log('Usage: node scripts/huji-intake.cjs --selftest');
    console.log('  (populateRoom is consumed programmatically by the Stage A intake driver.)');
    process.exit(0);
  }
}

module.exports = { populateRoom, extractWisdomNuggets, buildClaimSpecs, knowledgeTypeForEvidence };
