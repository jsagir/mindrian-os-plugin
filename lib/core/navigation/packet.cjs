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

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { getNeighborhood } = require('./neighborhood.cjs');
const { findContradictions, findUnsupportedClaims, findRelevantOpportunities } = require('./insights.cjs');
const { findRecentChanges } = require('./memory-events.cjs');

// Phase 110-02 (D-03 + D-09): privacy-mode opt-up. local_summary_only is the default and
// the only mode any of the 12 shipped Brain jobs ever requests (every $def.in.properties.privacy_mode
// in data/brain-packet-schema.json is { const: 'local_summary_only' }). allow_filenames opts
// up via .config.json preferences.brain_privacy_mode (project-level) or opts.privacyMode
// (per-call); allow_excerpts ADDITIONALLY requires a Part-3 Decision Gate APPROVE-with-reason
// row on the room graph tagged brain_excerpts -- there is NO shipped consumer of allow_excerpts
// as of v1.13.0-beta.3, so it is a defined-but-unconsumed escape hatch. Config can only CAP
// the mode, never RAISE what a job sends -- the schema's per-job const enforces this for free
// in Phase 110-03 sendPacket.
const PRIVACY_MODES = ['local_summary_only', 'allow_filenames', 'allow_excerpts'];

function readRoomConfigPrivacyMode(roomDir) {
  if (!roomDir) return null;
  try {
    const p = path.join(roomDir, '.config.json');
    if (!fs.existsSync(p)) return null;
    const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
    const v = cfg && cfg.preferences && cfg.preferences.brain_privacy_mode;
    return PRIVACY_MODES.includes(v) ? v : null;
  } catch (_) {
    return null;
  }
}

// The Part-3 Decision Gate APPROVE row (Canon Part 3 + Part 4). The F.0 selector at
// lib/hmi/shape-f0-renderer.cjs is the canonical render path that, when wired in a future
// plan, writes the brain_excerpts-tagged APPROVE decision row that this helper looks for.
// As of v1.13.0-beta.3 there is NO shipped consumer of allow_excerpts -- so this returns
// false until a Part-3 gate is wired and the user approves. The query is a single guarded
// SELECT against the local room graph (the same db handle buildBrainPacket already takes);
// any error or absent row returns false so the resolver caps down safely.
function roomHasExcerptApproval(db, roomDir) {
  try {
    if (!db) return false;
    const row = db.prepare(
      "SELECT 1 FROM nodes WHERE type IN ('decision','memory_event') " +
      "AND review_status = 'confirmed' AND created_by = 'user' " +
      "AND instr(properties, 'brain_excerpts') > 0 LIMIT 1"
    ).get();
    return !!row;
  } catch (_) {
    return false;
  }
}

function resolvePrivacyMode(db, roomDir, opts) {
  const options = opts || {};
  const perCall = options.privacyMode;
  const fromConfig = readRoomConfigPrivacyMode(roomDir);
  const requested = (typeof perCall === 'string' && PRIVACY_MODES.includes(perCall))
    ? perCall
    : (fromConfig || 'local_summary_only');
  if (requested === 'allow_excerpts' && !roomHasExcerptApproval(db, roomDir)) {
    // Cap down per "config caps, never raises". If config said allow_filenames, keep it;
    // otherwise drop to local_summary_only.
    return fromConfig === 'allow_filenames' ? 'allow_filenames' : 'local_summary_only';
  }
  return requested;
}

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
  const roomDir = options.roomDir || null;

  // Phase 110-02: resolve the privacy mode BEFORE building the packet body so the resolved
  // value is available on the top-level return object alongside packet_version and origin.
  const privacyMode = resolvePrivacyMode(db, roomDir, options);

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
    // Phase 110-02 D-08 layer 1: stamp the navigation-API provenance origin. The schema's
    // $defs.Origin enum constrains this to the closed set; brain-client.sendPacket (Phase
    // 110-03) refuses any other value at wire time. defense-in-depth -- three layers (schema
    // enum + pre-commit hook + sendPacket allowlist), no in-process nonce.
    origin: 'navigation_api',
    // Phase 110-02 D-09: top-level privacy_mode (one of D-03's 3 enum values; default
    // local_summary_only). Separate from constraints.privacy (human-readable note) -- the
    // schema's $defs.PrivacyMode enum + each job's $def.in.properties.privacy_mode const
    // enforces "config caps, never raises" at the wire level in Phase 110-03 sendPacket.
    privacy_mode: privacyMode,
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

module.exports = {
  buildBrainPacket,
  surface_banked_opportunities,
  shortText,
  // Phase 110-02 (D-09): exported so Phase 110-05 round-trip tests, future callers, and
  // brain-client.sendPacket (110-03) can introspect / reuse the resolution order.
  resolvePrivacyMode,
  readRoomConfigPrivacyMode,
  roomHasExcerptApproval,
  PRIVACY_MODES,
};
