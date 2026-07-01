'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 196-04 (PB8-06) -- the LOCAL-only Part-8 egress telemetry ontology.
 * ==========================================================================
 * record(db, info) journals ONE classify() decision as a scalar-only typed
 * taxonomy: a category node (writeDomainNode, taxonomy=true), a memory_event
 * (logMemoryEvent, one of the 3 additive brain_egress_* strings), and one
 * TAGGED_WITH edge (writeEdge) linking the event to the category node.
 *
 * Canon Part 9 (D-09): EVERY write routes through lib/core/navigation.cjs (the
 * single SQL navigation chokepoint). This module NEVER opens room.db directly,
 * never calls db.prepare / db.exec itself. It hands the caller-owned db handle
 * to navigation.* and lets navigation own the SQL.
 *
 * Canon Part 8 (D-09): telemetry carries scalars + category slugs + counts ONLY.
 * The offending payload bytes NEVER enter a memory_event, an edge, or a node.
 * record() WHITELISTS the fields it forwards (verdict / class slug / count /
 * matched_pattern regex-source scalar) and NEVER spreads the caller's info bag,
 * so a hostile field (raw_payload) cannot leak.
 *
 * Best-effort contract (clone of brain-client.cjs::_logEventBestEffort,
 * :1086-1094): a navigation write failure is swallowed. record() NEVER throws --
 * a telemetry hiccup must never brick a Brain call.
 *
 * NO em-dashes / en-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only.
 * Pure CJS, zero npm deps.
 *
 * License: BSL 1.1.
 */

// ---------------------------------------------------------------------------
// Category slug vocabulary (RESEARCH / D-09). A category node's name is one of
// these slugs. BLOCK and MOVE vocabularies are documentation of the closed
// vocabulary; record() does not reject an unknown slug (classify() emits its own
// class slugs like content_set / move_set / unproven_packet) -- it SANITIZES the
// incoming class to a slug-safe scalar so nothing but a bounded token lands.
// ---------------------------------------------------------------------------
const BLOCK_CATEGORY_SLUGS = Object.freeze([
  'personal_identifier', 'proprietary_number', 'meeting_content',
  'room_metric', 'location', 'verbatim_quote',
]);
const MOVE_CATEGORY_SLUGS = Object.freeze([
  'framework_handle', 'reach_id', 'slug', 'methodology_tier',
  'phase_id', 'problem_type_enum',
]);

// The verdict -> additive EVENT_TYPES mapping (the 3 strings added to
// navigation/memory-events.cjs in this same plan). Anything outside this map is
// not a recordable verdict.
const VERDICT_EVENT = Object.freeze({
  block: 'brain_egress_blocked',
  allow: 'brain_egress_allowed',
  ambiguous: 'brain_egress_ambiguous',
});

// ---------------------------------------------------------------------------
// Scalar sanitizers -- the D-09 firewall. Every value that reaches a navigation
// write passes one of these so no raw payload byte can ride a scalar field.
// ---------------------------------------------------------------------------

// A slug is lowercased [a-z0-9_], capped at 40 chars. Anything else -> 'unknown'.
function _slug(v) {
  if (typeof v !== 'string' || v.length === 0) return 'unknown';
  const s = v.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 40);
  return s.length > 0 ? s : 'unknown';
}

// A short scalar (regex source / pattern name). Truncated hard so even a hostile
// value is bounded; this carries NO payload bytes (classify() only ever passes a
// regex .source or a fixed reason token here).
function _shortScalar(v) {
  if (typeof v !== 'string' || v.length === 0) return '';
  return v.slice(0, 80);
}

// A non-negative integer count; anything else collapses to 1.
function _count(v) {
  return Number.isInteger(v) && v >= 0 ? v : 1;
}

// Extract a node id from a navigation write return, tolerant of both the real
// shape (node_id / eventId) and the test-spy shape ({ id }).
function _nodeId(res) {
  if (!res || typeof res !== 'object') return '';
  return res.node_id || res.id || '';
}
function _eventId(res) {
  if (!res || typeof res !== 'object') return '';
  return res.eventId || res.id || '';
}

/**
 * record(db, info) -> void
 *
 * info = { verdict, class, matched_pattern?, count? } (+ any hostile extras that
 * are IGNORED). ctx (toolName / sessionId) may ride info too; only scalars are
 * forwarded. Writes a taxonomy category node + a brain_egress_* memory_event +
 * one TAGGED_WITH edge, ALL via navigation.cjs. Best-effort: never throws.
 */
function record(db, info) {
  if (!db) return;
  if (!info || typeof info !== 'object') return;

  const eventType = VERDICT_EVENT[info.verdict];
  if (!eventType) return; // not a recordable verdict; skip silently.

  const classSlug = _slug(info.class);
  const matchedPattern = _shortScalar(info.matched_pattern);
  const count = _count(info.count);
  const sessionId = typeof info.sessionId === 'string' && info.sessionId.length > 0
    ? info.sessionId
    : 'part8-egress';

  try {
    const navigation = require('./navigation.cjs');

    // 1. The taxonomy category node (system-bookkeeping, taxonomy=true so it is
    //    NOT a truth-claim; Part 9 v1.5 carve-out). Name is the sanitized slug.
    let classNodeId = '';
    try {
      const nodeRes = navigation.writeDomainNode(db, {
        domainType: 'focus_area',
        name: classSlug,
        sessionId: sessionId,
        taxonomy: true,
      });
      classNodeId = _nodeId(nodeRes);
    } catch (_e) { /* best-effort */ }

    // 2. The memory_event -- scalars + slug + count ONLY (D-09). NEVER spread
    //    info; whitelist the forwarded keys so raw_payload cannot leak.
    let eventNodeId = '';
    try {
      const payload = {
        egress_class: classSlug,
        verdict: _slug(info.verdict),
        count: count,
        created_by: 'system',
        source_path: 'part8:egress-guard',
      };
      if (matchedPattern) payload.matched_pattern = matchedPattern;
      const evtRes = navigation.logMemoryEvent(db, eventType, payload);
      eventNodeId = _eventId(evtRes);
    } catch (_e) { /* best-effort */ }

    // 3. One TAGGED_WITH edge from the memory_event to the category node. ENUM/
    //    scalar props ONLY. Include both edge_type (real writeEdge contract) and
    //    type (defensive mirror) so the write is unambiguous. Skip if either id
    //    failed to resolve (writeEdge rejects empty ids anyway).
    if (eventNodeId && classNodeId) {
      try {
        navigation.writeEdge(db, {
          source_id: eventNodeId,
          target_id: classNodeId,
          edge_type: 'TAGGED_WITH',
          type: 'TAGGED_WITH',
          properties: { relation: 'egress_class', egress_class: classSlug },
        });
      } catch (_e) { /* best-effort */ }
    }
  } catch (_e) {
    // Outer swallow: a navigation require failure or any unexpected throw is
    // best-effort. Telemetry NEVER bricks a Brain call.
  }
}

module.exports = {
  record: record,
  BLOCK_CATEGORY_SLUGS: BLOCK_CATEGORY_SLUGS,
  MOVE_CATEGORY_SLUGS: MOVE_CATEGORY_SLUGS,
  VERDICT_EVENT: VERDICT_EVENT,
};
