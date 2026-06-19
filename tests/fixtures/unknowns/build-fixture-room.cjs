'use strict';
/*
 * Phase 165-01 -- the seeded fixture room.db for the unknown-unknowns blind-spot
 * engine. This builds a deterministic temp room.db that seeds BOTH SIDES of the
 * D-165-03 corpus filter so the Wave-2 corpus-adapter test can prove the UNION
 * query returns ONLY graded-confirmed Academic/Operational claims and excludes
 * everything else.
 *
 * The D-165-03 corpus = UNION over (EvidenceClaim, claim, CausalClaim) WHERE
 *   review_status = 'confirmed' AND json_extract(properties,'$.evidence_tier')
 *   IN ('Academic','Operational').
 *
 * Seeded mix (165-01-PLAN Task 2):
 *   (a) >=5 EvidenceClaim/CausalClaim confirmed Academic|Operational -- THE CORPUS.
 *   (b) confirmed claims with evidence_tier None and Practitioner -- EXCLUDED (tier).
 *   (c) confirmed plain writeClaimNode claims with NO evidence_tier -- EXCLUDED
 *       (ungraded-confirmed; Pitfall 1: an ungraded confirmed claim is not yet in
 *       the well-evidenced hunt space).
 *   (d) proposed claims (Academic) -- EXCLUDED (status).
 *   (e) at least one CONTRADICTS / INVALIDATES edge incident on a corpus claim (so
 *       the proxy contradiction-density scalar has signal) + at least one corpus
 *       claim with an old last_modified_at (so the staleness scalar has signal).
 *
 * Section/domain enum handles vary across the corpus claims so DSP partitioning
 * has feature variance and the inter-partition distance has something to
 * discriminate. All node text is a generic enum-like handle (Part 8), NEVER
 * realistic venture prose.
 *
 * Substrate discipline (D-165-10): every node + edge is created through the SHIPPED
 * navigation.cjs chokepoint (writeEvidenceClaim / writeClaimNode / writeEdge /
 * confirmNode), NEVER a raw INSERT INTO nodes/edges. This file lives under
 * tests/fixtures/ which is on the substrate-guard allow-list
 * (scripts/check-substrate.cjs RE /^tests\/fixtures\//), so opening the
 * caller-owned write handle via room-db.openRoomDb is sanctioned; node/edge
 * creation still routes through the writers (no hand-rolled INSERT). The ONLY
 * direct SQL is a single UPDATE of last_modified_at on an already-minted node to
 * stamp the stale row -- last_modified_at is the Phase 160-04 write-time stamp the
 * writers do not set, and findStaleClaims (insights.cjs) keys on it; the fixture
 * sets it deterministically via the injected opts.now seam so the staleness test
 * is reproducible.
 *
 * Confirm path (Part 9 role 5): the writers mint review_status 'proposed'; the
 * fixture promotes corpus rows to 'confirmed' via navigation.confirmNode with a
 * HUMAN byUser ('navigator-fixture', a non-agent identity), so the truth-machine
 * guard (an agent-attributed confirm is REJECTED) is honored even in the fixture.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE). CJS, no new deps.
 */

const path = require('node:path');
const navigation = require('../../../lib/core/navigation.cjs');
const { openRoomDb, closeRoomDb } = require('../../../lib/core/room-db.cjs');

// A non-agent (human) identity so confirmNode's truth-machine guard promotes the
// truth-claim corpus rows. AGENT_IDENTITIES is {larry, brain, system, assistant};
// 'navigator-fixture' is none of those, so it counts as a human byUser.
const FIXTURE_NAVIGATOR = 'navigator-fixture';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// buildFixtureRoom(roomDir, opts) -> {
//   dbPath, corpusIds, nonCorpusIds, contradictedId, staleId
// }
//
// opts.now -- a fixed epoch-ms reference for deterministic stale timestamps. When
//   absent, defaults to a fixed constant (NOT Date.now in the math path) so a
//   re-run is byte-identical. The stale row is stamped (now - 90 days) so it falls
//   outside the 30-day staleWindow; a fresh corpus row is stamped (now) so it does
//   not.
function buildFixtureRoom(roomDir, opts) {
  const options = (opts && typeof opts === 'object') ? opts : {};
  // Fixed default reference so the fixture is deterministic without an injected now.
  const nowRef = (typeof options.now === 'number' && Number.isFinite(options.now))
    ? options.now
    : 1750000000000; // a fixed 2025-ish epoch-ms anchor; NOT Date.now.

  const db = openRoomDb(roomDir);
  const dbPath = path.join(path.resolve(roomDir), '.mindrian', 'room.db');

  const corpusIds = [];
  const nonCorpusIds = [];

  // -----------------------------------------------------------------------
  // (a) THE CORPUS: >=5 confirmed Academic|Operational graded truth claims.
  // EvidenceClaim carries evidence_tier in properties (validated on write).
  // section/domain vary so DSP has feature variance. We confirm each via the
  // human-byUser confirmNode so it lands review_status 'confirmed'.
  //
  // EvidenceClaim ids are derived from (sessionId, url-hash) by writeEvidenceClaim;
  // we capture the returned node_id.
  // -----------------------------------------------------------------------
  const corpusSeeds = [
    { url: 'handle://corpus/academic-1', source: 'src-a', tier: 'Academic', section: 'problem-definition', domain: 'oncology', topic: 'h-academic-1' },
    { url: 'handle://corpus/academic-2', source: 'src-b', tier: 'Academic', section: 'market-analysis', domain: 'fintech', topic: 'h-academic-2' },
    { url: 'handle://corpus/operational-1', source: 'src-c', tier: 'Operational', section: 'solution-design', domain: 'oncology', topic: 'h-operational-1' },
    { url: 'handle://corpus/operational-2', source: 'src-d', tier: 'Operational', section: 'business-model', domain: 'logistics', topic: 'h-operational-2' },
    { url: 'handle://corpus/operational-3', source: 'src-e', tier: 'Operational', section: 'market-analysis', domain: 'fintech', topic: 'h-operational-3' },
  ];

  let staleId = null;
  for (let i = 0; i < corpusSeeds.length; i += 1) {
    const s = corpusSeeds[i];
    const r = navigation.writeEvidenceClaim(db, {
      topic: s.topic,
      source: s.source,
      url: s.url,
      retrieved_at: '',
      evidence_tier: s.tier,
      summary: s.section + '/' + s.domain, // enum-like handle only (Part 8), never prose
      sessionId: 'fixture-165',
    });
    if (!r || !r.ok) {
      throw new Error('fixture corpus write failed: ' + (r && r.reason));
    }
    // Promote proposed -> confirmed via the HUMAN gate (Part 9 role 5).
    const c = navigation.confirmNode(db, r.node_id, FIXTURE_NAVIGATOR, 'fixture-seed');
    if (!c || c.ok === false) {
      throw new Error('fixture confirm failed for ' + r.node_id + ': ' + (c && c.reason));
    }
    // Stamp section/domain enum handles + a deterministic last_modified_at on the
    // already-minted node so the corpus-adapter can derive section/domain and the
    // proxy staleness scalar has a write-time stamp. This is the ONLY direct SQL
    // (an UPDATE on an existing node, sanctioned in the fixtures allow-list); node
    // creation stayed on the writer.
    const isStaleRow = (i === corpusSeeds.length - 1); // the last corpus row is the stale one
    const lastMod = isStaleRow ? (nowRef - 90 * MS_PER_DAY) : nowRef;
    // Merge section/domain enum handles into the existing properties JSON.
    const existing = db.prepare('SELECT properties FROM nodes WHERE id = ?').get(r.node_id);
    let propsObj = {};
    try { propsObj = JSON.parse(existing.properties || '{}'); } catch (_e) { propsObj = {}; }
    propsObj.section = s.section;
    propsObj.domain = s.domain;
    db.prepare('UPDATE nodes SET properties = ?, last_modified_at = ? WHERE id = ?')
      .run(JSON.stringify(propsObj), lastMod, r.node_id);
    corpusIds.push(r.node_id);
    if (isStaleRow) staleId = r.node_id;
  }

  // -----------------------------------------------------------------------
  // (b) EXCLUDED by tier: confirmed claims with evidence_tier None + Practitioner.
  // These ARE confirmed and DO carry an evidence_tier, but the tier is not in
  // ('Academic','Operational') so the UNION filter drops them.
  // -----------------------------------------------------------------------
  const excludedTierSeeds = [
    { url: 'handle://noncorpus/none-1', source: 'src-n', tier: 'None' },
    { url: 'handle://noncorpus/practitioner-1', source: 'src-p', tier: 'Practitioner' },
  ];
  for (const s of excludedTierSeeds) {
    const r = navigation.writeEvidenceClaim(db, {
      topic: 'h-excluded-tier', source: s.source, url: s.url, retrieved_at: '',
      evidence_tier: s.tier, summary: 'excluded/tier', sessionId: 'fixture-165',
    });
    if (!r || !r.ok) throw new Error('fixture excluded-tier write failed: ' + (r && r.reason));
    const c = navigation.confirmNode(db, r.node_id, FIXTURE_NAVIGATOR, 'fixture-seed');
    if (!c || c.ok === false) throw new Error('fixture excluded-tier confirm failed: ' + (c && c.reason));
    nonCorpusIds.push(r.node_id);
  }

  // -----------------------------------------------------------------------
  // (c) EXCLUDED ungraded-confirmed: plain writeClaimNode claims with NO
  // evidence_tier. These are confirmed but json_extract(...,'$.evidence_tier')
  // returns NULL so the IN ('Academic','Operational') filter drops them
  // automatically (Pitfall 1). writeClaimNode mints type='claim' with
  // knowledge_type (fact/causal/...), NOT evidence_tier.
  // -----------------------------------------------------------------------
  const ungradedSeeds = [
    { knowledge_type: 'fact', sourceSegment: 'seg-ungraded-1' },
    { knowledge_type: 'causal', sourceSegment: 'seg-ungraded-2' },
  ];
  for (const s of ungradedSeeds) {
    const r = navigation.writeClaimNode(db, {
      knowledge_type: s.knowledge_type,
      text: 'h-ungraded', // enum-like handle, never prose
      sessionId: 'fixture-165',
      sourceSegment: s.sourceSegment,
    });
    if (!r || !r.ok) throw new Error('fixture ungraded write failed: ' + (r && r.reason));
    // confirmNode requires a HUMAN byUser since 'claim' is a TRUTH_CLAIM type.
    const c = navigation.confirmNode(db, r.node_id, FIXTURE_NAVIGATOR, 'fixture-seed');
    if (!c || c.ok === false) throw new Error('fixture ungraded confirm failed: ' + (c && c.reason));
    nonCorpusIds.push(r.node_id);
  }

  // -----------------------------------------------------------------------
  // (d) EXCLUDED by status: PROPOSED claims (Academic tier). These carry a corpus
  // tier but are NOT confirmed, so the review_status='confirmed' filter drops them.
  // Left at the writer-default 'proposed' (no confirmNode call).
  // -----------------------------------------------------------------------
  const proposedSeeds = [
    { url: 'handle://noncorpus/proposed-academic-1', source: 'src-q' },
  ];
  for (const s of proposedSeeds) {
    const r = navigation.writeEvidenceClaim(db, {
      topic: 'h-proposed', source: s.source, url: s.url, retrieved_at: '',
      evidence_tier: 'Academic', summary: 'proposed/academic', sessionId: 'fixture-165',
    });
    if (!r || !r.ok) throw new Error('fixture proposed write failed: ' + (r && r.reason));
    // intentionally NOT confirmed -- stays 'proposed'.
    nonCorpusIds.push(r.node_id);
  }

  // -----------------------------------------------------------------------
  // (e) Signal edges: a CONTRADICTS edge incident on a corpus claim (proxy
  // contradiction-density signal) + an INVALIDATES edge incident on a corpus
  // claim. Both edge types are frozen in ALLOWED_EDGE_TYPES (CONTRADICTS:153,
  // INVALIDATES brought into the chokepoint by Phase 168). Routed through
  // navigation.writeEdge, never raw INSERT.
  //
  // The contradicted corpus claim is corpusIds[0] (an Academic claim). We seed a
  // generic source node id for the contradicting end (an enum handle).
  // -----------------------------------------------------------------------
  const contradictedId = corpusIds[0];
  const contraSrc = 'handle:contradicting-observation-1';
  let e1 = navigation.writeEdge(db, {
    source_id: contraSrc,
    target_id: contradictedId,
    edge_type: 'CONTRADICTS',
    properties: { relation: 'fixture_signal' },
  });
  if (!e1 || e1.ok === false) throw new Error('fixture CONTRADICTS edge failed: ' + (e1 && e1.reason));
  let e2 = navigation.writeEdge(db, {
    source_id: 'handle:invalidating-observation-1',
    target_id: contradictedId,
    edge_type: 'INVALIDATES',
    properties: { relation: 'fixture_signal' },
  });
  if (!e2 || e2.ok === false) throw new Error('fixture INVALIDATES edge failed: ' + (e2 && e2.reason));

  // A second corpus claim gets a benign SUPPORTS edge so contradiction density
  // discriminates (some corpus claims are contested, some are not).
  let e3 = navigation.writeEdge(db, {
    source_id: 'handle:supporting-observation-1',
    target_id: corpusIds[1],
    edge_type: 'SUPPORTS',
    properties: { relation: 'fixture_signal' },
  });
  if (!e3 || e3.ok === false) throw new Error('fixture SUPPORTS edge failed: ' + (e3 && e3.reason));

  closeRoomDb(db);

  return {
    dbPath,
    corpusIds,
    nonCorpusIds,
    contradictedId,
    staleId,
  };
}

module.exports = { buildFixtureRoom, FIXTURE_NAVIGATOR };
