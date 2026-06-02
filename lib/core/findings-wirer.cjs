'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 131-04 -- findings-wirer.cjs
 * ==================================
 * Stage 7: turn each gate decision over a ranked research finding into typed
 * graph data through navigation.cjs (Canon Part 4: every choice is graph data).
 *   - ACCEPT -> writeEvidenceClaim (review_status proposed) + INFORMS edge
 *               (+ CONTRADICTS when the finding kills an existing claim,
 *                + SUPERSEDES when it is a better evidence tier) + research_filed.
 *   - REJECT -> REJECTED_BECAUSE edge carrying the captured reason scalar
 *               (rejection IS data per Canon Part 4) + research_rejected.
 *   - DEFER  -> research_deferred memory_event queued to milestone audit; no edge.
 *
 * EDGE-TARGET SCOPING (the design clarification):
 *   - LOCAL target (a room section / local claim node): the edge target is the
 *     LOCAL room.db node id, resolved via the navigation.cjs section-node
 *     convention 'section:' + section (the SAME id navigation-engine-offer.cjs
 *     uses). It is NOT a correlation_id. MOST of 131's INFORMS / CONTRADICTS /
 *     SUPERSEDES edges are local-to-local and stay local-node-id.
 *   - TEACHING-GRAPH target (a framework / concept in the teaching graph): the
 *     edge target resolves to a canonical correlation_id via the consumer-side
 *     resolver (lib/lens-engine/correlation-resolver.cjs resolveCorrelation,
 *     built from 130.7's REAL computeCorrelationId + parseLabelIndex), so the
 *     edge does NOT fork across cross-label duplicates. This is the ONLY case
 *     that touches the correlation_id path.
 *
 * Canon Part 9: this module requires lib/core/navigation.cjs ONLY for room.db
 *   (it is NOT substrate-allow-listed, so it carries zero room-db.cjs /
 *   node:sqlite require -- the caller owns the db handle, exactly like the
 *   lens-engine accept/reject idiom). EvidenceClaim lands review_status proposed
 *   (a TRUTH-CLAIM node, never auto-confirmed; promotion to confirmed is the
 *   human APPROVE at the F.1 gate via navigation.confirmNode -- NOT this wirer).
 *   All memory-event writes go through the navigation.cjs RE-EXPORT
 *   navigation.logMemoryEvent (the chokepoint), NEVER the raw logEvent from
 *   lib/core/navigation/memory-events.cjs.
 *
 * Canon Part 8: edge properties + event payloads are enum/scalar + node-id
 *   handles + provenance scalars only. The finding prose lives on the
 *   EvidenceClaim NODE (via writeEvidenceClaim), NEVER on an edge.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 *
 * Exports (each takes a caller-owned db handle):
 *   wireAccept(db, params) -> { ok, node_id } | { ok:false, reason }
 *   wireReject(db, params) -> { ok } | { ok:false, reason }
 *   wireDefer(db, params)  -> { ok } | { ok:false, reason }
 *
 * License: BSL 1.1.
 */

const navigation = require('./navigation.cjs');

// The consumer-side teaching-graph resolver (Task 2). _resolveCorrelation
// DEFAULTS to this REAL resolver (built from 130.7's computeCorrelationId +
// parseLabelIndex); it is overridable in params for tests. There is NO phantom
// dotted resolver on the correlation module; this is the real one.
const correlationResolver = require('../lens-engine/correlation-resolver.cjs');

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// The local section-node id convention: 'section:' + section. Mirrors
// lib/core/navigation-engine-offer.cjs (sectionNodeId = 'section:' + section).
// Overridable via params._resolveLocalTarget for tests.
function defaultResolveLocalTarget(targetSection) {
  if (typeof targetSection !== 'string' || targetSection.length === 0) return null;
  // If the caller already passed a fully-qualified room.db node id (carries a
  // ':' namespace prefix such as 'claim:' or 'section:'), pass it through.
  if (targetSection.indexOf(':') !== -1) return targetSection;
  return 'section:' + targetSection;
}

// Resolve a cascade-edge target to a room.db id. The local-vs-teaching-graph
// branch is enforced in this ONE place (the single resolveTarget chokepoint).
//   - 'teaching-graph': resolve to the canonical correlation_id.
//   - anything else (default 'local'): resolve to the LOCAL room.db node id.
// Returns a string id or null. Never throws.
function resolveTarget(targetSection, targetKind, ctx) {
  const c = isPlainObject(ctx) ? ctx : {};
  if (targetKind === 'teaching-graph') {
    const resolveFn = (typeof c._resolveCorrelation === 'function')
      ? c._resolveCorrelation
      : correlationResolver.resolveCorrelation;
    try {
      const r = resolveFn(targetSection, { correlationLabelsSection: c.correlationLabelsSection });
      if (r && typeof r.correlation_id === 'string' && r.correlation_id.length > 0) {
        return r.correlation_id;
      }
    } catch (_e) { /* degrade to null below */ }
    return null;
  }
  const localFn = (typeof c._resolveLocalTarget === 'function')
    ? c._resolveLocalTarget
    : defaultResolveLocalTarget;
  try {
    const id = localFn(targetSection);
    return (typeof id === 'string' && id.length > 0) ? id : null;
  } catch (_e) {
    return null;
  }
}

// Build the enum-only edge properties: a reason scalar + the evidence_tier
// (Canon Part 8 -- never freeform user content).
function edgeProps(reason, evidenceTier) {
  const props = {};
  if (typeof reason === 'string' && reason.length > 0) props.reason = reason.slice(0, 64);
  if (typeof evidenceTier === 'string' && evidenceTier.length > 0) props.evidence_tier = evidenceTier.slice(0, 32);
  return props;
}

/**
 * wireAccept(db, params) -> { ok, node_id } | { ok:false, reason }
 *
 * params = { finding, decision, roomDir, sessionId, topic, correlationLabelsSection?,
 *            _resolveCorrelation?, _resolveLocalTarget? }
 *   finding: { source, url, retrieved_at, evidence_tier, summary, title }
 *   decision: { target_kind ('local' default | 'teaching-graph'), target_section,
 *               kills_claim?, kills_claim_kind?, better_tier_than?,
 *               better_tier_than_kind?, secondary_section?, secondary_kind? (Split) }
 *
 * Writes the EvidenceClaim (proposed) then the INFORMS edge to the resolved
 * target (local-node-id for a local target; correlation_id for a teaching-graph
 * target), plus CONTRADICTS / SUPERSEDES on the decision flags and a Split
 * reference INFORMS when a secondary target is given. Emits research_filed via
 * navigation.logMemoryEvent carrying provenance. Defensive: any write failure
 * returns { ok:false, reason } and never throws.
 */
function wireAccept(db, params) {
  if (!db || !isPlainObject(params)) return { ok: false, reason: 'invalid_params' };
  const finding = isPlainObject(params.finding) ? params.finding : null;
  const decision = isPlainObject(params.decision) ? params.decision : null;
  if (!finding) return { ok: false, reason: 'invalid_finding' };
  if (!decision) return { ok: false, reason: 'invalid_decision' };

  const ctx = {
    _resolveCorrelation: params._resolveCorrelation,
    _resolveLocalTarget: params._resolveLocalTarget,
    correlationLabelsSection: params.correlationLabelsSection,
  };
  const targetKind = decision.target_kind === 'teaching-graph' ? 'teaching-graph' : 'local';

  // 1. Write the EvidenceClaim node (proposed; NEVER confirmed -- Canon Part 9).
  let claim;
  try {
    claim = navigation.writeEvidenceClaim(db, {
      topic: typeof params.topic === 'string' ? params.topic : (finding.title || ''),
      source: finding.source,
      url: finding.url,
      retrieved_at: finding.retrieved_at,
      evidence_tier: finding.evidence_tier,
      summary: finding.summary,
      sessionId: params.sessionId,
    });
  } catch (e) {
    return { ok: false, reason: 'evidence_claim_threw', detail: String(e.message || '').slice(0, 80) };
  }
  if (!claim || !claim.ok) {
    return { ok: false, reason: (claim && claim.reason) ? claim.reason : 'evidence_claim_failed' };
  }
  const nodeId = claim.node_id;

  // 2. INFORMS edge from the EvidenceClaim to the resolved primary target.
  const primaryTargetId = resolveTarget(decision.target_section, targetKind, ctx);
  if (!primaryTargetId) {
    return { ok: false, reason: 'unresolved_target', node_id: nodeId };
  }
  const informs = navigation.writeEdge(db, {
    source_id: nodeId,
    target_id: primaryTargetId,
    edge_type: 'INFORMS',
    properties: edgeProps('finding_informs_target', finding.evidence_tier),
  });
  if (!informs || !informs.ok) {
    return { ok: false, reason: (informs && informs.reason) ? informs.reason : 'informs_edge_failed', node_id: nodeId };
  }

  // 2b. Split: a reference INFORMS to the secondary target (per its kind).
  if (typeof decision.secondary_section === 'string' && decision.secondary_section.length > 0) {
    const secKind = decision.secondary_kind === 'teaching-graph' ? 'teaching-graph' : 'local';
    const secId = resolveTarget(decision.secondary_section, secKind, ctx);
    if (secId) {
      navigation.writeEdge(db, {
        source_id: nodeId,
        target_id: secId,
        edge_type: 'INFORMS',
        properties: edgeProps('split_reference', finding.evidence_tier),
      });
    }
  }

  // 3. CONTRADICTS when the finding kills an existing claim (per its kind).
  if (typeof decision.kills_claim === 'string' && decision.kills_claim.length > 0) {
    const killKind = decision.kills_claim_kind === 'teaching-graph' ? 'teaching-graph' : 'local';
    const killTarget = resolveTarget(decision.kills_claim, killKind, ctx);
    if (killTarget) {
      navigation.writeEdge(db, {
        source_id: nodeId,
        target_id: killTarget,
        edge_type: 'CONTRADICTS',
        properties: edgeProps('finding_kills_claim', finding.evidence_tier),
      });
    }
  }

  // 4. SUPERSEDES when the finding is a better evidence tier than an existing claim.
  if (typeof decision.better_tier_than === 'string' && decision.better_tier_than.length > 0) {
    const supKind = decision.better_tier_than_kind === 'teaching-graph' ? 'teaching-graph' : 'local';
    const supTarget = resolveTarget(decision.better_tier_than, supKind, ctx);
    if (supTarget) {
      navigation.writeEdge(db, {
        source_id: nodeId,
        target_id: supTarget,
        edge_type: 'SUPERSEDES',
        properties: edgeProps('higher_evidence_tier', finding.evidence_tier),
      });
    }
  }

  // 5. research_filed memory_event with provenance (via the logMemoryEvent chokepoint).
  try {
    navigation.logMemoryEvent(db, 'research_filed', {
      node_id: nodeId,
      target_id: primaryTargetId,
      target_kind: targetKind,
      source: typeof finding.source === 'string' ? finding.source.slice(0, 64) : '',
      url: typeof finding.url === 'string' ? finding.url.slice(0, 256) : '',
      retrieved_at: typeof finding.retrieved_at === 'string' ? finding.retrieved_at.slice(0, 40) : '',
      evidence_tier: typeof finding.evidence_tier === 'string' ? finding.evidence_tier.slice(0, 32) : '',
    });
  } catch (_e) { /* event logging is best-effort; the edge is the load-bearing write */ }

  return { ok: true, node_id: nodeId, target_id: primaryTargetId, target_kind: targetKind };
}

/**
 * wireReject(db, params) -> { ok } | { ok:false, reason }
 *
 * params = { finding, reason, roomDir, sessionId, decision, correlationLabelsSection?,
 *            _resolveCorrelation?, _resolveLocalTarget? }
 *
 * Resolves the target (local-node-id or correlation_id per decision.target_kind)
 * and writes EXACTLY ONE REJECTED_BECAUSE edge carrying the captured reason
 * scalar (rejection IS data per Canon Part 4; open-decision 4 RESOLVED: the
 * source url + retrieved_at are retained on the edge properties as enum/scalar
 * provenance). Emits research_rejected via navigation.logMemoryEvent so the next
 * run's dedup learns what not to surface. Writes ZERO INFORMS edges.
 *
 * The rejected finding is STILL filed as an EvidenceClaim node (review_status
 * proposed) so the rejection edge has a real graph source -- rejection IS data
 * (Canon Part 4): the "why not" node + its REJECTED_BECAUSE edge teach the next
 * cross-relationship scan what not to surface. The edges table FKs both endpoints
 * to nodes(id), so the source node MUST exist; the EvidenceClaim node is that
 * source. NO INFORMS / CONTRADICTS / SUPERSEDES edge is written for a rejected
 * finding (only the rejection-as-data edge).
 */
function wireReject(db, params) {
  if (!db || !isPlainObject(params)) return { ok: false, reason: 'invalid_params' };
  const finding = isPlainObject(params.finding) ? params.finding : {};
  const decision = isPlainObject(params.decision) ? params.decision : {};
  const reason = (typeof params.reason === 'string' && params.reason.length > 0)
    ? params.reason
    : 'rejected_no_reason';

  const ctx = {
    _resolveCorrelation: params._resolveCorrelation,
    _resolveLocalTarget: params._resolveLocalTarget,
    correlationLabelsSection: params.correlationLabelsSection,
  };
  const targetKind = decision.target_kind === 'teaching-graph' ? 'teaching-graph' : 'local';
  const targetId = resolveTarget(decision.target_section, targetKind, ctx);
  if (!targetId) return { ok: false, reason: 'unresolved_target' };

  // File the rejected finding as an EvidenceClaim node (proposed) so the
  // REJECTED_BECAUSE edge has a real graph source (the edges table FKs the source
  // to nodes(id)). This makes rejection a first-class graph datum per Canon Part 4.
  let claim;
  try {
    claim = navigation.writeEvidenceClaim(db, {
      topic: typeof params.topic === 'string' ? params.topic : (finding.title || ''),
      source: finding.source,
      url: finding.url,
      retrieved_at: finding.retrieved_at,
      evidence_tier: finding.evidence_tier,
      summary: finding.summary,
      sessionId: params.sessionId,
    });
  } catch (e) {
    return { ok: false, reason: 'evidence_claim_threw', detail: String(e.message || '').slice(0, 80) };
  }
  if (!claim || !claim.ok) {
    return { ok: false, reason: (claim && claim.reason) ? claim.reason : 'evidence_claim_failed' };
  }
  const rejectSource = claim.node_id;

  const props = edgeProps(reason, finding.evidence_tier);
  // Open-decision 4 RESOLVED: retain url + retrieved_at as enum/scalar provenance.
  if (typeof finding.url === 'string' && finding.url.length > 0) props.url = finding.url.slice(0, 256);
  if (typeof finding.retrieved_at === 'string' && finding.retrieved_at.length > 0) {
    props.retrieved_at = finding.retrieved_at.slice(0, 40);
  }

  const edge = navigation.writeEdge(db, {
    source_id: rejectSource,
    target_id: targetId,
    edge_type: 'REJECTED_BECAUSE',
    properties: props,
  });
  if (!edge || !edge.ok) {
    return { ok: false, reason: (edge && edge.reason) ? edge.reason : 'rejected_edge_failed' };
  }

  try {
    navigation.logMemoryEvent(db, 'research_rejected', {
      target_id: targetId,
      target_kind: targetKind,
      reason: reason.slice(0, 64),
      source: typeof finding.source === 'string' ? finding.source.slice(0, 64) : '',
      url: typeof finding.url === 'string' ? finding.url.slice(0, 256) : '',
    });
  } catch (_e) { /* best-effort */ }

  return { ok: true, node_id: rejectSource, target_id: targetId, target_kind: targetKind, reason: reason };
}

/**
 * wireDefer(db, params) -> { ok } | { ok:false, reason }
 *
 * params = { finding, roomDir, sessionId }
 *
 * Emits a research_deferred memory_event (queued to milestone audit) via
 * navigation.logMemoryEvent. Writes NO cascade edge.
 */
function wireDefer(db, params) {
  if (!db || !isPlainObject(params)) return { ok: false, reason: 'invalid_params' };
  const finding = isPlainObject(params.finding) ? params.finding : {};
  try {
    navigation.logMemoryEvent(db, 'research_deferred', {
      queued_to: 'milestone_audit',
      source: typeof finding.source === 'string' ? finding.source.slice(0, 64) : '',
      url: typeof finding.url === 'string' ? finding.url.slice(0, 256) : '',
      evidence_tier: typeof finding.evidence_tier === 'string' ? finding.evidence_tier.slice(0, 32) : '',
    });
  } catch (e) {
    return { ok: false, reason: 'defer_event_failed', detail: String(e.message || '').slice(0, 80) };
  }
  return { ok: true, queued_to: 'milestone_audit' };
}

module.exports = {
  wireAccept: wireAccept,
  wireReject: wireReject,
  wireDefer: wireDefer,
  // Exposed for the wirer's own internal resolution chokepoint + tests.
  resolveTarget: resolveTarget,
};
