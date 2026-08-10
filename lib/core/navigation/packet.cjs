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
// Phase 125-03 -- framework_chain_hint stitch. projections.cjs (Plan 01) gives
// us the active framework set + hop depth from roomState; framework-chain-slice
// (Plan 02) fetches the FEEDS_INTO Cypher slice from the Brain. Both modules
// are pure-or-graceful: projections never throws, slice fetcher returns a
// degraded envelope rather than throwing. Required at module top because the
// stitch is a hot path the helper does NOT lazy-import.
const projections = require('./projections.cjs');
const chainSliceMod = require('../../brain/framework-chain-slice.cjs');

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

// Canon Part 8 (Graph Boundary) + Part 9 (Memory Locality): privacy-mode-gated text
// projection. This is the value-space chokepoint -- the single place that decides whether
// a node's prose crosses to the Brain as a sha256 HASH (the default, leak-safe path) or as
// a truncated EXCERPT (only under the explicit allow_excerpts opt-in).
//
// Review finding H5: shortText() previously returned raw node prose (summary/claim/title/
// text) under EVERY privacy mode, including the default local_summary_only. That let user
// prose cross the LOCAL->BRAIN boundary in the summary/explanation fields -- a latent Part 8
// breach (dormant only because sendPacket has zero production consumers today). This fact
// is now the formal Phase 239 BRAIN-03 ruling: see the dated PARKED note above
// lib/core/brain-client.cjs's sendPacket() and the matching ADR amendment in
// docs/architecture/SUBSTRATE-CONTRACT.md (Phase 239-06, 2026-07-30).
//
// The gate:
//   - local_summary_only (default) AND allow_filenames -> sha256 hash of the content
//     (NOT prose). The Brain can still dedupe/reference by hash without reading content.
//   - allow_excerpts (explicit Part-3 APPROVE opt-in) -> truncated excerpt (<=120 chars),
//     the deliberate mode where excerpts crossing is intentional.
//
// Mirrors the proven-clean pattern in lib/core/brain-derivation.cjs::buildBrainQueryContext
// (sha256: prefix + NFC normalize + EMPTY_SHA256 sentinel for empty input).

// SHA256 of the empty string, with the canonical 'sha256:' prefix. Mirrors
// lib/core/brain-derivation.cjs EMPTY_SHA256 verbatim so empty governing prose hashes to a
// stable, parseable sentinel rather than a bare empty string.
const EMPTY_SHA256 = 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

function hashText(text) {
  const s = (text == null) ? '' : String(text);
  if (s.length === 0) return EMPTY_SHA256;
  return 'sha256:' + crypto.createHash('sha256').update(s.normalize('NFC')).digest('hex');
}

// projectText(text, privacyMode) -> hash-or-excerpt. The four projection sites
// (shortText/safeNodeProjection summary, focus summary, contradiction explanation,
// unsupported explanation) all route through this so the value-space gate is enforced once.
function projectText(text, privacyMode) {
  const s = (typeof text === 'string') ? text : '';
  if (privacyMode === 'allow_excerpts') {
    // Explicit opt-in: keep the truncated-excerpt behavior (<=120 chars).
    if (s.length === 0) return '';
    return s.length > 120 ? s.slice(0, 117) + '...' : s;
  }
  // Default (local_summary_only) AND allow_filenames: hash, never prose.
  return hashText(s);
}

// shortText(propertiesOrJson, privacyMode) -- extract the first non-empty candidate prose
// field, then project it through the privacy-mode gate. Under the default mode the return
// value is a sha256 hash; under allow_excerpts it is a truncated excerpt.
function shortText(propertiesOrJson, privacyMode) {
  let p = propertiesOrJson;
  if (typeof p === 'string') {
    try { p = JSON.parse(p); } catch (_) { p = {}; }
  }
  p = p || {};
  const candidates = [p.summary, p.claim, p.title, p.text];
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) {
      return projectText(c, privacyMode);
    }
  }
  // No prose candidate: hash of empty (EMPTY_SHA256 sentinel) under default; '' under
  // allow_excerpts (an empty excerpt is the honest representation of "no prose").
  return projectText('', privacyMode);
}

function safeNodeProjection(db, n, privacyMode) {
  // Project only safe scalar fields. Re-fetch properties to compute summary; never include body.
  // The summary is gated by privacyMode (hash under default; excerpt under allow_excerpts).
  const row = db.prepare('SELECT properties FROM nodes WHERE id = ?').get(n.id);
  const summary = row ? shortText(row.properties, privacyMode) : projectText('', privacyMode);
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

function safeContradictionProjection(c, privacyMode) {
  // explanation may carry raw user prose -- gate it through the value-space chokepoint
  // (hash under default; excerpt under allow_excerpts). H5 fix: was verbatim before.
  return {
    claimAId: c.claimA && c.claimA.id ? c.claimA.id : null,
    claimBId: c.claimB && c.claimB.id ? c.claimB.id : null,
    depth: 1,
    explanation: projectText(c.explanation, privacyMode),
  };
}

function safeUnsupportedProjection(u, privacyMode) {
  // explanation may carry raw user prose -- gate it through the value-space chokepoint
  // (hash under default; excerpt under allow_excerpts). H5 fix: was verbatim before.
  return {
    claimId: u.claim && u.claim.id ? u.claim.id : null,
    type: u.claim && u.claim.type ? u.claim.type : null,
    reviewStatus: u.claim && u.claim.reviewStatus ? u.claim.reviewStatus : null,
    lastSeenAt: u.claim && u.claim.lastSeenAt ? u.claim.lastSeenAt : null,
    explanation: projectText(u.explanation, privacyMode),
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

// Phase 125-03 -- stitch helper. Reads roomState via projections, fetches the
// 1-3 hop FEEDS_INTO slice via Plan 02 fetcher (or mock from opts._mocks),
// returns the framework_chain_hint shape per CONTEXT.md Scope IN section B
// item 5 -- OR undefined when the active set is empty (which is the "absent
// from packet" path per Plan 04 schema: framework_chain_hint is optional on
// LocalGraphSummary; absence is meaningful).
//
// Contract:
//   - roomState null / not-an-object -> undefined  (cold-start packet ships without hint)
//   - active frameworks empty array  -> undefined  (no anchor to fetch a slice for)
//   - active frameworks non-empty + Brain reachable  -> hint object (5 fields)
//   - active frameworks non-empty + Brain unreachable -> hint object with degraded
//     shape per Plan 02 fetcher contract (edges:[], brain_snapshot_id:null,
//     slice_rationale carrying 'brain_unreachable' or similar marker). The hint
//     is STILL attached so the ranker can distinguish "active set non-empty but
//     Brain failed" from "active set empty" (RESEARCH G-08 / Tier 0 invariant).
//
// Async because the fetcher is async. Pure read-only flow: no db writes, no fs
// writes, no Brain writes -- only the Plan 02 read primitive (Cypher MATCH).
async function _surfaceFrameworkChainHint(db, roomState, opts) {
  if (!roomState || typeof roomState !== 'object') return undefined;
  const active = projections.resolveActiveFrameworks(roomState);
  if (!Array.isArray(active) || active.length === 0) return undefined;
  const hopDepth = projections.resolveHopDepth(roomState);
  const depth = (hopDepth && (hopDepth.depth === 1 || hopDepth.depth === 2 || hopDepth.depth === 3))
    ? hopDepth.depth
    : 3;
  const activeNames = active.map(function (a) { return a.name; });
  // Test seam: opts._mocks.fetchFrameworkChainSlice replaces the live fetcher
  // for hermetic tests (no Brain network). Falls through to the shipped Plan
  // 02 module when no mock is provided.
  const fetcher = (opts && opts._mocks && typeof opts._mocks.fetchFrameworkChainSlice === 'function')
    ? opts._mocks.fetchFrameworkChainSlice
    : chainSliceMod.fetchFrameworkChainSlice;
  // Per Plan 02 contract, fetcher NEVER throws; it returns a degraded envelope
  // on any failure path (Brain unreachable, query throws, sanitizer rejects).
  // Wrapping in try/catch is defensive belt-and-suspenders in case a future
  // mock or replacement misbehaves.
  // Phase 249-01 (ENRICH-01): thread roomDir from buildBrainPacket's already-
  // resolved options.roomDir (the SAME opts object this function receives)
  // into the fetcher args so fetchFrameworkChainSlice's piggyback probe can
  // fire. Absent options.roomDir threads through as null (not undefined) so
  // the fetcher's own gate ("typeof o.roomDir === 'string'") never mistakes
  // a missing key for one that was checked and found empty.
  const roomDirForSlice = (opts && typeof opts.roomDir === 'string' && opts.roomDir.length > 0)
    ? opts.roomDir
    : null;
  let slice;
  try {
    slice = await fetcher({ active_frameworks: activeNames, max_hops: depth, roomDir: roomDirForSlice });
  } catch (_e) {
    // Defensive: even if the fetcher contract is violated, do NOT crash the
    // packet builder. Return undefined -> hint absent for this call.
    return undefined;
  }
  if (!slice || typeof slice !== 'object') return undefined;
  return slice;
}

async function buildBrainPacket(db, job, focusNodeId, opts) {
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

  // Focus node. The focus summary is gated by the resolved privacyMode (hash under the
  // default local_summary_only / allow_filenames; excerpt only under allow_excerpts).
  const focusType = getFocusType(db, focusNodeId);
  const focusRow = db.prepare('SELECT properties FROM nodes WHERE id = ?').get(focusNodeId);
  const focusSummary = focusRow ? shortText(focusRow.properties, privacyMode) : projectText('', privacyMode);

  // Local graph summary. Each helper output passes through a safe-shape mapper so
  // raw bodies, transcripts, and absolute paths NEVER reach the packet payload.
  const neighborhood = getNeighborhood(db, focusNodeId, { maxDepth: 2, topK: 50 });
  const nearestClaims = neighborhood
    .filter((n) => ['claim', 'CausalClaim'].includes(n.type))
    .slice(0, 5)
    .map((n) => safeNodeProjection(db, n, privacyMode));
  const nearestAssumptions = neighborhood
    .filter((n) => n.type === 'assumption')
    .slice(0, 5)
    .map((n) => safeNodeProjection(db, n, privacyMode));
  const contradictions = findContradictions(db, focusNodeId).slice(0, 5).map((c) => safeContradictionProjection(c, privacyMode));
  const unsupportedClaims = findUnsupportedClaims(db, roomId || 'unknown').slice(0, 5).map((u) => safeUnsupportedProjection(u, privacyMode));
  const recentChanges = findRecentChanges(db, Date.now() - 24 * 60 * 60 * 1000, { limit: 10 }).map(safeRecentChangeProjection);
  const bankedOpportunities = surface_banked_opportunities(db, focusNodeId, mocks);

  // Phase 125-03: framework_chain_hint stitch. Reads roomState from opts (callers
  // pass it through; Plan 05 ranker passes its own roomState when calling
  // buildBrainPacket explicitly). When opts.roomState is absent OR resolves to an
  // empty active framework set, the hint is ABSENT from the packet per the
  // CONTEXT.md "absent when active set empty" invariant (Plan 04 schema accepts
  // both shapes since framework_chain_hint is NOT in LocalGraphSummary.required[]).
  const roomState = (options && typeof options === 'object') ? options.roomState : null;
  const frameworkChainHint = await _surfaceFrameworkChainHint(db, roomState, options || {});

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
    local_graph_summary: Object.assign(
      {
        nearest_claims: nearestClaims,
        nearest_assumptions: nearestAssumptions,
        contradictions,
        unsupported_claims: unsupportedClaims,
        recent_changes: recentChanges,
        banked_opportunities: bankedOpportunities,
      },
      // Phase 125-03: conditionally include framework_chain_hint. Object.assign
      // with an empty-object short-circuit guarantees the key is ABSENT (not
      // present with an undefined value) when frameworkChainHint is undefined.
      // This preserves the schema invariant in Plan 04 (the field is optional;
      // absence is meaningful for the ranker in Plan 05).
      (frameworkChainHint === undefined) ? {} : { framework_chain_hint: frameworkChainHint }
    ),
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
  // H5 fix (Canon Part 8): the privacy-mode value-space chokepoint + its empty sentinel.
  // Exported so round-trip tests can assert hash-vs-excerpt behavior directly.
  projectText,
  hashText,
  EMPTY_SHA256,
  // Phase 110-02 (D-09): exported so Phase 110-05 round-trip tests, future callers, and
  // brain-client.sendPacket (110-03) can introspect / reuse the resolution order.
  resolvePrivacyMode,
  readRoomConfigPrivacyMode,
  roomHasExcerptApproval,
  PRIVACY_MODES,
  // Phase 125-03 test seam: surface helper exposed for fine-grained unit tests
  // in lib/memory/packet-chain-hint.test.cjs. NOT part of the public API; Plan
  // 05 ranker reads the assembled local_graph_summary.framework_chain_hint
  // directly off the packet rather than calling the helper.
  _test: { _surfaceFrameworkChainHint },
};
