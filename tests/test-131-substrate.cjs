'use strict';
// Phase 131-01 -- research substrate behavior suite (RED-first).
//
// Covers Task 2 (ALLOWED_EDGE_TYPES additive extension: CONTRADICTS + SUPERSEDES,
// alongside the shipped INFORMS + REJECTED_BECAUSE; EVENT_TYPES additive extension:
// research_filed / research_rejected / research_deferred) and Task 3
// (evidence-claim.cjs writeEvidenceClaim -- the locked Phase 136 node schema --
// plus research-preflight.cjs getResearchPreflight -- the batched 8-input Stage-1
// pre-flight -- plus the navigation.cjs re-exports). Hermetic via tmpdir per
// fixture; uses the canonical openRoomDb chokepoint so every node lands in the
// Phase-109 provenance schema.
//
// Canon Part 4: every choice is graph data (CONTRADICTS kills an existing claim,
//   SUPERSEDES is the better-evidence-tier version; both carry enum-only reason
//   scalars per Canon Part 8).
// Canon Part 5: an EvidenceClaim carries a graded evidence_tier from the closed
//   {Academic, Operational, Practitioner, None} set.
// Canon Part 9: a proposed EvidenceClaim is a TRUTH-CLAIM node, never auto-confirmed
//   (role 5; promotion is the Plan 04 human gate). It must NOT appear in
//   getConfirmedFacts before a human APPROVE.
// Canon Part 8: all room.db access is through navigation surfaces.
// NO em-dashes in this file (CLAUDE.md HARD RULE).

const { ok, equal } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const edges = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'edges.cjs'));
const memoryEvents = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'memory-events.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const roomHome = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'room-home.cjs'));

// The 2 net-new research cascade edge-type strings (additive to the closed
// allow-list -- they EXTEND the shipped vocabulary; never invented per-phase).
const RESEARCH_EDGE_TYPES = ['CONTRADICTS', 'SUPERSEDES'];

// The shipped lens edge types (a FLOOR -- they MUST still be present; this guards
// against an additive extension regressing the shipped 130-01 vocabulary).
const SHIPPED_LENS_EDGE_FLOOR = ['INFORMS', 'REJECTED_BECAUSE'];

// The 3 net-new research event-type strings (additive to EVENT_TYPES).
const RESEARCH_EVENT_TYPES = ['research_filed', 'research_rejected', 'research_deferred'];

// Captured pre-131 baselines. The two Sets are additive-only frozen Sets; the
// net-new DELTA is asserted by NAMED membership against these floors (the
// delta-of-N idiom), never against an absolute size -- so a future phase adding
// a member cannot regress this baseline. Pre-131: EDGE = 8, EVENT = 70.
const PRE_131_EDGE_BASELINE = 8;
const PRE_131_EVENT_BASELINE = 70;

function makeRoom() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-131-substrate-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  const db = openRoomDb(tmp);
  return { tmp, db };
}

function cleanup(tmp) {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

// Seed a node so edges (FK to nodes(id)) can reference it. Phase-109 provenance
// schema: source_path NOT NULL, created_by + review_status in the closed CHECK sets.
function seedNode(db, id, type) {
  const nowMs = Date.now();
  db.prepare(
    "INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) "
    + "VALUES (?, ?, '{}', 'fixture', 'system', NULL, 'proposed', ?, ?)"
  ).run(id, type || 'claim', nowMs, nowMs);
}

// ---------------------------------------------------------------------------
// Task 2 -- CONTRADICTS + SUPERSEDES + 3 research events (additive Sets)
// ---------------------------------------------------------------------------

function test1_researchEdgeTypesPresentAdditively() {
  for (const t of RESEARCH_EDGE_TYPES) {
    ok(edges.ALLOWED_EDGE_TYPES.has(t), 'ALLOWED_EDGE_TYPES must contain ' + t);
  }
  // The shipped lens floor stays (no regression on the 130-01 vocabulary).
  for (const t of SHIPPED_LENS_EDGE_FLOOR) {
    ok(edges.ALLOWED_EDGE_TYPES.has(t), 'shipped lens edge type missing: ' + t);
  }
  // Named-membership DELTA over the pre-131 baseline is exactly 2 (CONTRADICTS +
  // SUPERSEDES are the only two net-new members).
  equal(edges.ALLOWED_EDGE_TYPES.size, PRE_131_EDGE_BASELINE + 2,
    'edge-type net-new delta over the pre-131 Set must be exactly 2');
}

function test2_researchEventTypesPresentAdditively() {
  for (const t of RESEARCH_EVENT_TYPES) {
    ok(memoryEvents.EVENT_TYPES.has(t), 'EVENT_TYPES must contain ' + t);
  }
  // Named-membership DELTA over the pre-131 baseline is exactly 3.
  equal(memoryEvents.EVENT_TYPES.size, PRE_131_EVENT_BASELINE + 3,
    'event-type net-new delta over the pre-131 Set must be exactly 3');
}

function test3_contradictsEdgeWritesWithReasonScalar() {
  const { tmp, db } = makeRoom();
  try {
    seedNode(db, 'EvidenceClaim:a', 'EvidenceClaim');
    seedNode(db, 'claim:target', 'claim');
    const r = edges.writeEdge(db, {
      source_id: 'EvidenceClaim:a', target_id: 'claim:target',
      edge_type: 'CONTRADICTS', properties: { reason: 'finding_kills_claim' },
    });
    ok(r.ok, 'CONTRADICTS writeEdge should return ok:true; got ' + JSON.stringify(r));
    const row = db.prepare(
      "SELECT properties FROM edges WHERE source = ? AND target = ? AND type = 'CONTRADICTS'"
    ).get('EvidenceClaim:a', 'claim:target');
    ok(row, 'a CONTRADICTS edge row should exist');
    equal(JSON.parse(row.properties).reason, 'finding_kills_claim', 'the enum-only reason scalar round-trips');
  } finally {
    closeRoomDb(db); cleanup(tmp);
  }
}

function test4_supersedesEdgeWrites() {
  const { tmp, db } = makeRoom();
  try {
    seedNode(db, 'EvidenceClaim:new', 'EvidenceClaim');
    seedNode(db, 'EvidenceClaim:old', 'EvidenceClaim');
    const r = edges.writeEdge(db, {
      source_id: 'EvidenceClaim:new', target_id: 'EvidenceClaim:old',
      edge_type: 'SUPERSEDES', properties: { reason: 'higher_evidence_tier' },
    });
    ok(r.ok, 'SUPERSEDES writeEdge should return ok:true; got ' + JSON.stringify(r));
    equal(r.type, 'SUPERSEDES', 'returned type should be SUPERSEDES');
  } finally {
    closeRoomDb(db); cleanup(tmp);
  }
}

function test5_researchEventsLogThroughChokepoint() {
  const { tmp, db } = makeRoom();
  try {
    for (const ev of RESEARCH_EVENT_TYPES) {
      const r = memoryEvents.logEvent(db, ev, { topic: 'x', tier: 'Academic' });
      ok(r.ok, ev + ' should log through the chokepoint; got ' + JSON.stringify(r));
    }
  } finally {
    closeRoomDb(db); cleanup(tmp);
  }
}

// ---------------------------------------------------------------------------
// Task 3 -- evidence-claim.cjs writeEvidenceClaim (the locked Phase 136 schema)
// ---------------------------------------------------------------------------

function test6_writeEvidenceClaimWritesLockedSchema() {
  const { tmp, db } = makeRoom();
  try {
    const r = navigation.writeEvidenceClaim(db, {
      topic: 'CAR-T manufacturing cost curve',
      source: 'OpenAlex',
      url: 'https://openalex.org/W123',
      retrieved_at: '2026-06-01T00:00:00Z',
      evidence_tier: 'Academic',
      summary: 'Per-dose COGS fell 38% across 2022-2025 autologous trials',
      sessionId: 'sess-1',
    });
    ok(r.ok, 'writeEvidenceClaim should return ok:true; got ' + JSON.stringify(r));
    ok(typeof r.node_id === 'string' && r.node_id.length > 0, 'writeEvidenceClaim returns a node_id');
    const row = db.prepare(
      "SELECT type, created_by, review_status, properties FROM nodes WHERE id = ?"
    ).get(r.node_id);
    ok(row, 'the EvidenceClaim node should exist');
    equal(row.type, 'EvidenceClaim', 'type should be EvidenceClaim');
    equal(row.created_by, 'system', 'created_by should be system');
    equal(row.review_status, 'proposed', 'review_status should be proposed (never auto-confirmed)');
    // The LOCKED Phase 136 provenance schema: source / url / retrieved_at / evidence_tier.
    const props = JSON.parse(row.properties);
    equal(props.source, 'OpenAlex', 'source provenance field round-trips');
    equal(props.url, 'https://openalex.org/W123', 'url provenance field round-trips');
    equal(props.retrieved_at, '2026-06-01T00:00:00Z', 'retrieved_at provenance field round-trips');
    equal(props.evidence_tier, 'Academic', 'evidence_tier provenance field round-trips');
    equal(props.topic, 'CAR-T manufacturing cost curve', 'topic round-trips');
    equal(props.summary, 'Per-dose COGS fell 38% across 2022-2025 autologous trials', 'summary round-trips');
  } finally {
    closeRoomDb(db); cleanup(tmp);
  }
}

function test7_writeEvidenceClaimRejectsMissingUrlOrSource() {
  const { tmp, db } = makeRoom();
  try {
    const noUrl = navigation.writeEvidenceClaim(db, {
      topic: 't', source: 'OpenAlex', url: '', evidence_tier: 'Academic',
    });
    ok(!noUrl.ok, 'a missing url should be rejected, not thrown');
    equal(noUrl.reason, 'invalid_url', 'reason should be invalid_url');
    const noSource = navigation.writeEvidenceClaim(db, {
      topic: 't', source: '', url: 'https://x', evidence_tier: 'Academic',
    });
    ok(!noSource.ok, 'a missing source should be rejected, not thrown');
    equal(noSource.reason, 'invalid_source', 'reason should be invalid_source');
  } finally {
    closeRoomDb(db); cleanup(tmp);
  }
}

function test8_writeEvidenceClaimRejectsInvalidTier() {
  const { tmp, db } = makeRoom();
  try {
    const r = navigation.writeEvidenceClaim(db, {
      topic: 't', source: 'OpenAlex', url: 'https://x', evidence_tier: 'Gossip',
    });
    ok(!r.ok, 'a non-Part-5 evidence_tier should be rejected');
    equal(r.reason, 'invalid_evidence_tier', 'reason should be invalid_evidence_tier');
  } finally {
    closeRoomDb(db); cleanup(tmp);
  }
}

function test9_evidenceClaimAbsentFromConfirmedFacts() {
  const { tmp, db } = makeRoom();
  try {
    const r = navigation.writeEvidenceClaim(db, {
      topic: 't', source: 'OpenAlex', url: 'https://x',
      retrieved_at: '2026-06-01T00:00:00Z', evidence_tier: 'Academic', summary: 's',
    });
    ok(r.ok, 'writeEvidenceClaim should succeed');
    // The human-gate invariant (Canon Part 9 role 5): a PROPOSED EvidenceClaim is
    // NOT a confirmed fact. It must not surface in getConfirmedFacts before a human
    // APPROVE (which Plan 04 wires).
    const confirmed = roomHome.getRoomHomeView
      ? navigation.getRoomHomeView(db, 'fixture', {}).confirmedFacts
      : [];
    const found = confirmed.some((f) => f.id === r.node_id);
    ok(!found, 'a proposed EvidenceClaim must NOT appear in getConfirmedFacts');
  } finally {
    closeRoomDb(db); cleanup(tmp);
  }
}

function test10_writeEvidenceClaimRejectsBadParams() {
  const { tmp, db } = makeRoom();
  try {
    const r = navigation.writeEvidenceClaim(db, null);
    ok(!r.ok, 'null params should be rejected, not thrown');
    equal(r.reason, 'invalid_params', 'reason should be invalid_params');
  } finally {
    closeRoomDb(db); cleanup(tmp);
  }
}

// ---------------------------------------------------------------------------
// Task 3 -- research-preflight.cjs getResearchPreflight (batched 8-input read)
// ---------------------------------------------------------------------------

const PREFLIGHT_KEYS = [
  'active_workflow', 'active_jtbd', 'operator', 'current_section',
  'recent_changes', 'evidence_gaps', 'prior_research', 'role_blend',
];

function test11_getResearchPreflightReturnsAll8Inputs() {
  const { tmp, db } = makeRoom();
  try {
    const pre = navigation.getResearchPreflight(db, {
      roomDir: tmp, sessionId: 'sess-1', topic: 'CAR-T cost curve',
    });
    ok(pre && typeof pre === 'object', 'getResearchPreflight returns an object');
    for (const k of PREFLIGHT_KEYS) {
      ok(Object.prototype.hasOwnProperty.call(pre, k),
        'getResearchPreflight must return key ' + k + ' in one round-trip');
    }
    // prior_research is a documented placeholder (the driver fills it via the
    // 130.5 cache + Pinecone dedup in Plan 03); it starts as an empty array.
    ok(Array.isArray(pre.prior_research), 'prior_research is an array (placeholder for the driver)');
    equal(pre.prior_research.length, 0, 'prior_research starts empty (filled by the source-lens driver Stage 4 dedup)');
    // recent_changes + evidence_gaps degrade to arrays on a fresh room (never throw).
    ok(Array.isArray(pre.recent_changes), 'recent_changes degrades to an array');
    ok(Array.isArray(pre.evidence_gaps), 'evidence_gaps degrades to an array');
  } finally {
    closeRoomDb(db); cleanup(tmp);
  }
}

function test12_getResearchPreflightDegradesGracefully() {
  const { tmp, db } = makeRoom();
  try {
    // Missing roomDir / sessionId: every sub-read degrades to null/[], never aborts.
    const pre = navigation.getResearchPreflight(db, { topic: 'x' });
    ok(pre && typeof pre === 'object', 'getResearchPreflight never throws on missing opts');
    for (const k of PREFLIGHT_KEYS) {
      ok(Object.prototype.hasOwnProperty.call(pre, k), 'degraded result still carries key ' + k);
    }
  } finally {
    closeRoomDb(db); cleanup(tmp);
  }
}

// ---------------------------------------------------------------------------
// Task 3 -- substrate-guard + re-export + em-dash hygiene
// ---------------------------------------------------------------------------

function test13_newSubmodulesHaveNoDirectSqliteRequire() {
  for (const f of ['evidence-claim.cjs', 'research-preflight.cjs']) {
    const src = fs.readFileSync(
      path.join(REPO_ROOT, 'lib', 'core', 'navigation', f), 'utf8'
    );
    ok(!/require\(['"](?:node:sqlite|better-sqlite3)['"]\)/.test(src),
      f + ' must NOT require node:sqlite or better-sqlite3 (caller owns the db handle)');
    ok(!src.includes(String.fromCharCode(8212)), f + ' must contain zero em-dashes');
  }
}

function test14_navigationReExportsResearchSubstrate() {
  for (const f of ['writeEvidenceClaim', 'getResearchPreflight']) {
    equal(typeof navigation[f], 'function', 'navigation.cjs must re-export ' + f);
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const TESTS = [
  ['test1_researchEdgeTypesPresentAdditively', test1_researchEdgeTypesPresentAdditively],
  ['test2_researchEventTypesPresentAdditively', test2_researchEventTypesPresentAdditively],
  ['test3_contradictsEdgeWritesWithReasonScalar', test3_contradictsEdgeWritesWithReasonScalar],
  ['test4_supersedesEdgeWrites', test4_supersedesEdgeWrites],
  ['test5_researchEventsLogThroughChokepoint', test5_researchEventsLogThroughChokepoint],
  ['test6_writeEvidenceClaimWritesLockedSchema', test6_writeEvidenceClaimWritesLockedSchema],
  ['test7_writeEvidenceClaimRejectsMissingUrlOrSource', test7_writeEvidenceClaimRejectsMissingUrlOrSource],
  ['test8_writeEvidenceClaimRejectsInvalidTier', test8_writeEvidenceClaimRejectsInvalidTier],
  ['test9_evidenceClaimAbsentFromConfirmedFacts', test9_evidenceClaimAbsentFromConfirmedFacts],
  ['test10_writeEvidenceClaimRejectsBadParams', test10_writeEvidenceClaimRejectsBadParams],
  ['test11_getResearchPreflightReturnsAll8Inputs', test11_getResearchPreflightReturnsAll8Inputs],
  ['test12_getResearchPreflightDegradesGracefully', test12_getResearchPreflightDegradesGracefully],
  ['test13_newSubmodulesHaveNoDirectSqliteRequire', test13_newSubmodulesHaveNoDirectSqliteRequire],
  ['test14_navigationReExportsResearchSubstrate', test14_navigationReExportsResearchSubstrate],
];

let passed = 0;
let failed = 0;
for (const [name, fn] of TESTS) {
  try {
    fn();
    passed += 1;
    console.log('  PASS ' + name);
  } catch (err) {
    failed += 1;
    console.error('  FAIL ' + name + ': ' + (err && err.message ? err.message : err));
  }
}

console.log('');
console.log('Phase 131-01 research substrate: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
  process.exit(1);
}
