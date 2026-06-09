'use strict';
/*
 * Phase 150-02 Task 2 (MEM-04) -- memory-cortex-packet: the typed-packet
 * projection for any Brain query about the navigator's MEMORY CORTEX when
 * reaching. THE constitutional seal of Phase 150's REMOTE-queryability surface.
 *
 * This module MIRRORS lib/core/planning/artifact-brain-packet.cjs (Phase 149-03)
 * EXACTLY, repointed from the GSD planning artifacts to the user-memory cortex
 * (the 150-01 memory_artifact / governing_thought / navigator_persona / decision
 * nodes). It clones the build-from-ids discipline, the parse-handle-from-stable-id
 * helpers, the getNeighborhood union, the defensive minimal-packet fallback, and
 * the NEVER-read-properties rule.
 *
 * buildMemoryCortexPacket(db, {section}) returns a FLAT object of GENERIC HANDLES
 * ONLY (the minimal Part-8-safe query shape from 150-UNDERSTANDING section 3):
 *   - packet_version, job             constant typed-contract markers
 *   - section                         a generic LOCAL section handle (never prose)
 *   - governing_thought_hash          sha256 of the governing_thought node's HASH
 *                                     HANDLE (parsed from the stable node id),
 *                                     NEVER the raw MINTO governing-thought prose,
 *                                     via the packet.cjs hashText helper
 *   - correlation_id                  the name-based cid (the LOCAL<->REMOTE join
 *                                     key); derived via the spine-events
 *                                     _withCorrelationId precedence -- caller-
 *                                     supplied honored, else derived from the
 *                                     section canonical handle, else ABSENT when
 *                                     the section is HELD (un-canonicalized /
 *                                     no joinable cortex node)
 *   - problem_type (UDP|IDP|WDP)      closed enum scalars only; anything not in
 *   - complexity (Simple|Complex|     the closed set is DROPPED, never echoed
 *     Wicked)
 *   - persona (P-enum, 9-role)
 *   - current_framework               a public framework-name handle (absent if
 *                                     none on the connector/selector surface)
 *   - stage                           a journey/venture-stage enum scalar
 *   - gap_count                       a numeric scalar (sections lacking a
 *                                     governing_thought)
 *   - origin: 'navigation_api', constraints: { privacy: 'no_raw_memory_text' }
 *
 * It MUST NOT include: any memory MD body, the raw file path, filenames-as-
 * content, source_path / source_section, or ANY node properties prose. The packet
 * is built from node IDS + TYPE + correlation_id + review_status enum only -- it
 * NEVER reads a node's `properties` JSON, so no prose field can ever reach the
 * wire even if a 150-01 writer regression let prose onto a node.
 *
 * Canon Part 8 (zero Brain egress): this module BUILDS a packet; it does NOT send
 *   it. It requires ONLY ../navigation.cjs (the Phase 109 chokepoint) + the
 *   packet.cjs sha256 helper + ../correlation.cjs + node:path. NO brain-client,
 *   NO node:http / node:https, NO fetch. Sending stays the existing Brain-client
 *   path, which already passes the sanitizer; this module's output is
 *   structurally safe.
 *
 * Canon Part 9 (navigation chokepoint): reads room DATA ONLY via navigation.cjs
 *   getNeighborhood. NEVER opens room.db; NEVER requires node:sqlite.
 *
 * Canon Part 9 v1.5 (audit-node carve-out): memory_artifact + governing_thought +
 *   navigator_persona are system-bookkeeping nodes; their handles are not
 *   truth-claims. decision is a truth-claim node, but the packet carries only its
 *   id-derived handle, never its prose.
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE).
 *
 * Exports: buildMemoryCortexPacket
 */

const path = require('node:path');

const navigation = require('../navigation.cjs');
// Reuse the packet.cjs sha256-by-default projection helper (the leak-safe wire
// hasher). hashText(<generic handle>) hashes a GENERIC handle here (the
// governing_thought node-id handle), never prose.
const packet = require('./packet.cjs');
// The name-based, embedding-INDEPENDENT correlation id (the LOCAL<->REMOTE join
// key). computeCorrelationId(canonical_name, primary_label) -> 16-char hex.
const correlation = require('../correlation.cjs');

// The primary_label the memory-cortex join key is computed under. A LOCAL cortex
// node and a REMOTE Brain node carrying the same cid under this label are the
// same logical node. Stable string; never user content.
const CORTEX_PRIMARY_LABEL = 'memory_cortex';

// Closed enum sets. Anything not in these sets is DROPPED from the packet, never
// echoed -- so a malformed node id carrying prose after a delimiter never
// survives (mirror of artifact-brain-packet.cjs typeSet gating).
const PROBLEM_TYPES = Object.freeze(new Set(['UDP', 'IDP', 'WDP']));
const COMPLEXITIES = Object.freeze(new Set(['Simple', 'Complex', 'Wicked']));
// The 9-role persona taxonomy (Canon Part 2 / Part 8). P-enum + role names.
const PERSONAS = Object.freeze(new Set([
  'P1', 'P2', 'P2.IND', 'P3', 'P.grant', 'S',
  'Founder', 'Researcher', 'Operator', 'Investor', 'Mentor',
  'Domain Expert', 'Student',
]));
// Journey-stage / venture-stage enum scalars (Campbell 12-stage + common venture
// stages). Closed set; anything else dropped.
const STAGES = Object.freeze(new Set([
  'Ordinary World', 'Call to Adventure', 'Refusal of the Call',
  'Meeting the Mentor', 'Crossing the Threshold', 'Tests Allies Enemies',
  'Approach to the Inmost Cave', 'Ordeal', 'Reward', 'The Road Back',
  'Resurrection', 'Return with the Elixir',
  'Pre-Opportunity', 'Opportunity', 'Investment', 'unknown',
]));

// Resolve the stable governing_thought node id for a section VIA the navigation
// chokepoint helper, with a defensive fallback to the literal handle shape so a
// helper-absent runtime never throws.
function governingThoughtId(section) {
  try {
    if (typeof navigation.GOVERNING_THOUGHT_NODE_ID === 'function') {
      return navigation.GOVERNING_THOUGHT_NODE_ID(section);
    }
  } catch (_e) { /* fall through to literal handle */ }
  return 'governing_thought:' + section;
}

// Parse a closed-set enum candidate out of a stable node id's trailing segment.
// Node id shape for an enum-bearing cortex node would be <prefix>:<...>:<ENUM>.
// We take the LAST ':' segment and validate it against the closed set; anything
// not in the set returns null (dropped, never echoed). Mirror of
// artifact-brain-packet.cjs artifactTypeFromNodeId.
function enumFromNodeId(nodeId, validSet) {
  if (typeof nodeId !== 'string') return null;
  const idx = nodeId.lastIndexOf(':');
  if (idx < 0) return null;
  const candidate = nodeId.slice(idx + 1);
  return validSet.has(candidate) ? candidate : null;
}

// _withCorrelationId precedence (mirror of spine-events.cjs:74-86): honor a
// caller-supplied cid verbatim; else derive from a canonical name; else leave
// ABSENT (HELD-node graceful degradation -- never invent a cid). Returns the cid
// string or null.
function resolveCorrelationId(opts, canonicalName, joinable) {
  // 1. caller-supplied cid honored verbatim.
  if (opts && typeof opts.correlation_id === 'string' && opts.correlation_id.length > 0) {
    return opts.correlation_id;
  }
  // 2. derive from the canonical name ONLY when a joinable cortex node exists for
  //    the section (the section is canonicalized). A HELD-only section (no
  //    joinable node) contributes a LOCAL-only handle and is omitted from the
  //    remote-join field.
  if (joinable && typeof canonicalName === 'string' && canonicalName.trim().length > 0) {
    // Mirror the HELD-node rule: an un-canonicalizable name (> 80 chars) does not
    // get a fabricated cid -- it stays a LOCAL-only handle.
    if (canonicalName.length <= 80) {
      try {
        return correlation.computeCorrelationId(canonicalName, CORTEX_PRIMARY_LABEL);
      } catch (_e) {
        // Never let cid derivation throw the build; degrade to no cid.
        return null;
      }
    }
  }
  // 3. else ABSENT.
  return null;
}

// buildMemoryCortexPacket(db, {section}) -- the generic-handles-only projection.
// Anchors on the section's governing_thought node, traverses the cortex
// neighborhood via navigation.getNeighborhood, and projects ONLY ids -> handles +
// enum scalars. Defensive: never throws on caller input; returns a minimal packet
// (generic handles, absent join fields) when db is absent or the section is
// unknown.
function buildMemoryCortexPacket(db, params) {
  const opts = (params && typeof params === 'object') ? params : {};
  const section = (typeof opts.section === 'string' && opts.section.length > 0) ? opts.section : '';

  const anchorId = governingThoughtId(section);

  // The packet skeleton -- every field a generic scalar or array of handles.
  // governing_thought_hash is the sha256 of the GENERIC node-id handle (never
  // prose). Stable across calls.
  const out = {
    packet_version: '1.0',
    job: 'memory_cortex_query',
    section: section,
    governing_thought_hash: packet.hashText(anchorId),
    correlation_id: null,
    problem_type: null,
    complexity: null,
    persona: null,
    current_framework: null,
    stage: null,
    gap_count: 0,
    origin: 'navigation_api',
    constraints: { privacy: 'no_raw_memory_text' },
  };

  if (!db || !section) return out;

  // Traverse the cortex neighborhood OUTBOUND from the governing_thought anchor.
  // getNeighborhood returns rows with id / type / reviewStatus ONLY -- it NEVER
  // returns a node's `properties`, so no prose can reach the packet by
  // construction. Returns [] for a missing focus (the section has no
  // governing_thought node -> HELD-only / cold section).
  let neighborhood = [];
  try {
    neighborhood = navigation.getNeighborhood(db, anchorId, { maxDepth: 3, topK: 200 }) || [];
  } catch (_e) {
    neighborhood = [];
  }

  // A joinable cortex node exists for this section when the anchor resolved a
  // non-empty neighborhood (the governing_thought node exists and is wired). This
  // gates correlation_id derivation per the HELD-node rule.
  const joinable = neighborhood.length > 0;

  // correlation_id: the LOCAL<->REMOTE join key. Derived from the section
  // canonical handle via the _withCorrelationId precedence; ABSENT when the
  // section is HELD (no joinable cortex node) -- never fabricated.
  const cid = resolveCorrelationId(opts, section, joinable);
  if (typeof cid === 'string' && cid.length > 0) {
    out.correlation_id = cid;
  }

  // Parse enum/handle fields from the stable node ids in the neighborhood,
  // validating each against its closed set. The 150-01 cortex node ids do not
  // currently encode problem_type / complexity / persona / stage in their ids, so
  // these fields stay absent unless a validated source surfaces them -- absence
  // is acceptable (they are optional). When a caller supplies validated enum
  // scalars on opts, honor them (closed-set gated) so the packet is useful the
  // moment those signals exist.
  const fromOpt = function (key, validSet) {
    const v = opts && opts[key];
    return (typeof v === 'string' && validSet.has(v)) ? v : null;
  };
  out.problem_type = fromOpt('problem_type', PROBLEM_TYPES);
  out.complexity = fromOpt('complexity', COMPLEXITIES);
  out.persona = fromOpt('persona', PERSONAS);
  out.stage = fromOpt('stage', STAGES);

  // current_framework: a public framework-name handle (from the connector/
  // selector surface), never user content. Honored from opts when supplied as a
  // bounded handle string. We cap the length so a malformed value carrying prose
  // cannot smuggle a body through; a framework name is short.
  if (opts && typeof opts.current_framework === 'string'
      && opts.current_framework.length > 0 && opts.current_framework.length <= 80) {
    out.current_framework = opts.current_framework;
  }

  // Defensive id-derived enum sweep: if any neighborhood node id encodes a
  // closed-set enum in its trailing segment, surface it (gated). This is the
  // parse-from-stable-id discipline mirrored from artifact-brain-packet.cjs; it
  // keeps the builder forward-compatible if a future cortex node id carries an
  // enum, while NEVER echoing anything outside the closed set.
  for (const n of neighborhood) {
    if (!n || typeof n.id !== 'string') continue;
    if (out.problem_type == null) {
      const pt = enumFromNodeId(n.id, PROBLEM_TYPES);
      if (pt) out.problem_type = pt;
    }
    if (out.complexity == null) {
      const cx = enumFromNodeId(n.id, COMPLEXITIES);
      if (cx) out.complexity = cx;
    }
  }

  // gap_count: a numeric scalar. A cold/HELD section (no joinable
  // governing_thought) counts as one gap; otherwise honor a caller-supplied
  // numeric scalar (the lowFillSections count surfaced by the STATE projection),
  // defaulting to 0.
  if (!joinable) {
    out.gap_count = 1;
  } else if (opts && typeof opts.gap_count === 'number' && Number.isFinite(opts.gap_count)) {
    out.gap_count = opts.gap_count;
  } else {
    out.gap_count = 0;
  }

  return out;
}

module.exports = {
  buildMemoryCortexPacket,
};
