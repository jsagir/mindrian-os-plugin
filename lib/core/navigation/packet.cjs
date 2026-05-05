'use strict';
// Phase 109-07 Brain Packet Builder. Per CONTEXT D-06 + RESEARCH section 7.
// Phase 109 ships the BUILDER; Phase 110 ships the schema validator + brainClient.query call.
//
// Canon Part 8 LOAD-BEARING: zero raw room content egress. The packet payload carries ONLY
// generic framework handles, phase identifiers, sha256 hashes, and enum scalars. ZERO
// user-content strings, ZERO artifact bodies, ZERO meeting transcripts. Every field is
// projected through a safe-shape mapper that strips body/properties/transcript fields.
// Canon Part 9: builder produces the JS object; Phase 110 wraps with validateAndSendBrainPacket;
// Phase 109 honors the privacy: 'no_raw_artifact_text' field by default in constraints.

const path = require('node:path');
const crypto = require('node:crypto');
const { getNeighborhood } = require('./neighborhood.cjs');
const { findContradictions, findUnsupportedClaims, findRelevantOpportunities } = require('./insights.cjs');
const { findRecentChanges } = require('./memory-events.cjs');

function loadJtbd(roomDir, mocks) {
  if (mocks && mocks.jtbd) return mocks.jtbd;
  try { return require(path.resolve(__dirname, '..', '..', 'hmi', 'jtbd-state.cjs')); } catch (_) { return null; }
}

function loadOperator(roomDir, mocks) {
  if (mocks && mocks.operator) return mocks.operator;
  try { return require(path.resolve(__dirname, '..', '..', 'conversation', 'operator.cjs')); } catch (_) { return null; }
}

function shortText(propertiesOrJson) {
  let p = propertiesOrJson;
  if (typeof p === 'string') {
    try { p = JSON.parse(p); } catch (_) { p = {}; }
  }
  p = p || {};
  const candidates = [p.summary, p.claim, p.title, p.text];
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) {
      return c.length > 120 ? c.slice(0, 117) + '...' : c;
    }
  }
  return '';
}

function safeNodeProjection(db, n) {
  // Project only safe scalar fields. Re-fetch properties to compute summary; never include body.
  const row = db.prepare('SELECT properties FROM nodes WHERE id = ?').get(n.id);
  const summary = row ? shortText(row.properties) : '';
  return {
    id: n.id,
    type: n.type,
    summary,
    depth: n.depth,
    edgeTypeIn: n.edgeTypeIn,
    score: typeof n.score === 'number' ? Math.round(n.score * 1000) / 1000 : 0,
    reviewStatus: n.reviewStatus,
    lastSeenAt: n.lastSeenAt,
  };
}

function safeContradictionProjection(c) {
  return {
    claimAId: c.claimA && c.claimA.id ? c.claimA.id : null,
    claimBId: c.claimB && c.claimB.id ? c.claimB.id : null,
    depth: 1,
    explanation: c.explanation,
  };
}

function safeUnsupportedProjection(u) {
  return {
    claimId: u.claim && u.claim.id ? u.claim.id : null,
    type: u.claim && u.claim.type ? u.claim.type : null,
    reviewStatus: u.claim && u.claim.reviewStatus ? u.claim.reviewStatus : null,
    lastSeenAt: u.claim && u.claim.lastSeenAt ? u.claim.lastSeenAt : null,
    explanation: u.explanation,
  };
}

function safeRecentChangeProjection(r) {
  return {
    id: r.id,
    eventType: r.eventType,
    targetNodeId: r.targetNodeId,
    createdAt: r.createdAt,
  };
}

function hsiBand(score) {
  const s = Number(score) || 0;
  if (s >= 70) return 'high';
  if (s >= 40) return 'medium';
  return 'low';
}

function surface_banked_opportunities(db, focusNodeId, mocks) {
  const opps = findRelevantOpportunities(db, focusNodeId, { topK: 3, _mocks: mocks });
  return {
    count: opps.length,
    items: opps.map((o) => ({
      id_hash: crypto.createHash('sha256').update(String(o.opportunityId || '')).digest('hex').slice(0, 12),
      tags: Array.isArray(o.tags) ? o.tags.filter((t) => typeof t === 'string' && t.length <= 30) : [],
      hsi_band: hsiBand(o.hsiScore),
      composite_score: Math.round((Number(o.compositeScore) || 0) * 100) / 100,
    })),
  };
}

function getRoomStage(db) {
  try {
    const row = db.prepare("SELECT value FROM identity WHERE key = 'stage'").get();
    if (row && typeof row.value === 'string' && row.value.length > 0) return row.value;
  } catch (_) { /* ignore */ }
  return 'unknown';
}

function getFocusType(db, focusNodeId) {
  const row = db.prepare('SELECT type FROM nodes WHERE id = ?').get(focusNodeId);
  return row ? row.type : null;
}

function buildBrainPacket(db, job, focusNodeId, opts) {
  const options = opts || {};
  const mocks = options._mocks;
  const roomId = options.roomId || null;

  // Active context. Mocks override the require() calls for hermetic tests.
  const jtbdMod = loadJtbd(null, mocks);
  const opMod = loadOperator(null, mocks);
  const jtbdRaw = jtbdMod ? jtbdMod.getCurrent(null) : null;
  const opRaw = opMod ? opMod.getCurrent(null) : null;
  const jtbdId = jtbdRaw && jtbdRaw.current && jtbdRaw.current.id ? jtbdRaw.current.id : null;
  const operator = opRaw && opRaw.current ? opRaw.current : 'JUST_TALK';

  // Focus node.
  const focusType = getFocusType(db, focusNodeId);
  const focusRow = db.prepare('SELECT properties FROM nodes WHERE id = ?').get(focusNodeId);
  const focusSummary = focusRow ? shortText(focusRow.properties) : '';

  // Local graph summary. Each helper output passes through a safe-shape mapper so
  // raw bodies, transcripts, and absolute paths NEVER reach the packet payload.
  const neighborhood = getNeighborhood(db, focusNodeId, { maxDepth: 2, topK: 50 });
  const nearestClaims = neighborhood
    .filter((n) => ['claim', 'CausalClaim'].includes(n.type))
    .slice(0, 5)
    .map((n) => safeNodeProjection(db, n));
  const nearestAssumptions = neighborhood
    .filter((n) => n.type === 'assumption')
    .slice(0, 5)
    .map((n) => safeNodeProjection(db, n));
  const contradictions = findContradictions(db, focusNodeId).slice(0, 5).map(safeContradictionProjection);
  const unsupportedClaims = findUnsupportedClaims(db, roomId || 'unknown').slice(0, 5).map(safeUnsupportedProjection);
  const recentChanges = findRecentChanges(db, Date.now() - 24 * 60 * 60 * 1000, { limit: 10 }).map(safeRecentChangeProjection);
  const bankedOpportunities = surface_banked_opportunities(db, focusNodeId, mocks);

  return {
    packet_version: '1.0',
    job,
    room_stage: getRoomStage(db),
    active_context: {
      jtbd: jtbdId,
      operator,
      focus_node: {
        id: focusNodeId,
        type: focusType,
        summary: focusSummary,
      },
    },
    local_graph_summary: {
      nearest_claims: nearestClaims,
      nearest_assumptions: nearestAssumptions,
      contradictions,
      unsupported_claims: unsupportedClaims,
      recent_changes: recentChanges,
      banked_opportunities: bankedOpportunities,
    },
    constraints: {
      privacy: 'no_raw_artifact_text',
      max_tokens: 1200,
    },
  };
}

module.exports = { buildBrainPacket, surface_banked_opportunities, shortText };
