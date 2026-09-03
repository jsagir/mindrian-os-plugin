'use strict';
/*
 * Quick task 260903-i2x -- reasoning-write: T2's node-writing half of the
 * ratified MOS Reasoning Constitution v3.1.0
 * (docs/2026-09-03-CONSTITUTION-v3.1.0-mos-reasoning-constitution.md).
 * The constitution's headline finding was "no ICM write emits a
 * GraphWriteEvent today" -- both `gate_answer`'s approve branch and
 * `artifact_file` called only `navigation.logMemoryEvent` and stopped. This
 * module is the ONE shared writer both wire into: it mints a typed reasoning
 * node (a decision or a claim) plus its provenance edges, so a judgment the
 * system already made is also persisted as graph data, not just logged as a
 * bookkeeping row.
 *
 * ADDITIVE ONLY. The existing `logMemoryEvent` calls at both call sites stay
 * exactly as they are; this writer is new code alongside them, never a
 * replacement.
 *
 * This module is an allow-listed navigation submodule (the
 * scripts/check-substrate.cjs regex /^lib\/core\/navigation\// already
 * covers it). It takes a caller-owned db handle exactly like
 * typed-claim.cjs and memory-artifacts.cjs do: it NEVER requires
 * node:sqlite and NEVER opens room.db itself.
 *
 * Canon Part 7 reuse-before-build justification: memory-artifacts.cjs::
 * writeDecisionNode is the closest existing writer and was evaluated first,
 * but its params are the Phase 108/109 decision-LEDGER projector shape
 * (mandatory section, summaryHash, source) which a gate approval has none
 * of, and it writes no provenance edges at all. This module composes the
 * SAME two shipped primitives (insertNode + edges.writeEdge) for a
 * different call shape; it mints no new primitive and no new vocabulary
 * member (USES_FRAMEWORK was minted separately, alongside this file, in the
 * same task).
 *
 * Canon Part 9 role 5 / DC-4 truth-claim discipline: a `decision` node is a
 * TRUTH-CLAIM node in the closed set {claim, CausalClaim, assumption,
 * decision, opportunity}. It is NOT under the Part 9 v1.5 audit-node
 * carve-out. So this writer ALWAYS mints at review_status='proposed',
 * NEVER 'confirmed' -- a 'confirmed' mint here would be a constitutional
 * breach (memory-artifacts.cjs:333-339). The human APPROVE at a gate is
 * recorded by promoting the node afterward through the shipped human-confirm
 * door navigation.confirmNode(db, id, byUser, reason); that promotion is the
 * CALLER's job (lib/mcp/tools/gate.cjs), not this writer's.
 *
 * Canon Part 8: zero network surface. Pure LOCAL SQLite over a caller-owned
 * handle. Edge properties are ENUM/scalar only -- a relation enum, a
 * framework slug, an origin enum -- NEVER prose, NEVER a claim or artifact
 * body. No Brain calls; no room content ever leaves the room.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const { insertNode } = require('../node-insert.cjs');
const edges = require('./edges.cjs');

// The provenance-target cap. Mirrors gate-render.cjs's own
// MAX_EVIDENCE_NODE_IDS (64) -- an unbounded caller-supplied list would be
// unbounded edge writes per call (T-i2x-02).
const MAX_PROVENANCE_TARGETS = 64;

// The node `text` truncation ceiling (Canon Part 8: keep the stored blob
// bounded; T-i2x-04).
const MAX_TEXT_LENGTH = 500;

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * FRAMEWORK_NODE_ID(name) -> 'framework:<slug>', or null when `name` is not
 * a non-empty string or slugs to empty. Mirrors gate-render.cjs's own
 * `_slug` shape so a framework name always resolves to the same handle
 * regardless of which module computes it.
 */
function FRAMEWORK_NODE_ID(name) {
  if (typeof name !== 'string' || name.length === 0) return null;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
  if (slug.length === 0) return null;
  return 'framework:' + slug;
}

/**
 * REASONING_NODE_ID(kind, key) -> `${kind}:${key}`, or null when either part
 * is not a non-empty string. Exists so both callers (gate.cjs / views.cjs)
 * and the test file share ONE id convention instead of string-concatenating
 * the same shape in three places. Shipped kinds:
 *   REASONING_NODE_ID('decision:gate', gateId)     -> 'decision:gate:<id>'
 *   REASONING_NODE_ID('claim:artifact', artifactId) -> 'claim:artifact:<id>'
 */
function REASONING_NODE_ID(kind, key) {
  if (typeof kind !== 'string' || kind.length === 0) return null;
  if (typeof key !== 'string' || key.length === 0) return null;
  return kind + ':' + key;
}

/**
 * writeReasoningNode(db, params) -- mint a typed reasoning node plus its
 * provenance edges. Defensive: never throws on caller input.
 *
 * params = { nodeId, nodeType, epistemicType, text, section?, sourcePath?,
 *   subjectNodeId?, evidenceNodeIds?, framework?, origin? }
 *
 * Returns:
 *   { ok:true, node_id, edges_written, framework_edge:boolean } on success.
 *   { ok:false, reason, detail? } on validation / write failure.
 */
function writeReasoningNode(db, params) {
  if (!isPlainObject(params)) {
    return { ok: false, reason: 'invalid_params' };
  }
  const {
    nodeId, nodeType, epistemicType, text, section, sourcePath,
    subjectNodeId, evidenceNodeIds, framework, origin,
  } = params;

  if (typeof nodeId !== 'string' || nodeId.length === 0) {
    return { ok: false, reason: 'invalid_node_id' };
  }
  if (typeof nodeType !== 'string' || nodeType.length === 0) {
    return { ok: false, reason: 'invalid_node_type' };
  }

  // Build the props blob. text is always present (truncated, '' when
  // absent); section / origin ride only when non-empty strings. No other
  // keys. epistemic_type is NOT set here -- insertNode merges the validated
  // value in and always overrides a caller-supplied key (R17-02 protected-
  // key discipline), so setting it here would be redundant and could
  // silently diverge from what actually lands.
  const props = {
    text: typeof text === 'string' ? text.slice(0, MAX_TEXT_LENGTH) : '',
  };
  if (typeof section === 'string' && section.length > 0) props.section = section;
  if (typeof origin === 'string' && origin.length > 0) props.origin = origin;

  let propsJson;
  try {
    propsJson = JSON.stringify(props);
  } catch (_e) {
    return { ok: false, reason: 'properties_serialize_failed' };
  }

  // epistemicType is passed straight through to insertNode, which owns the
  // fail-closed 10-member enum gate (R17-02) -- do NOT duplicate that enum
  // here; a bad value surfaces as reasoning_node_write_failed below.
  try {
    insertNode(db, nodeId, nodeType, propsJson, {
      source_path: (typeof sourcePath === 'string' && sourcePath.length > 0) ? sourcePath : ('reasoning:' + nodeId),
      created_by: 'system',
      confidence: 1.0,
      // 'proposed' is load-bearing per DC-4 -- never 'confirmed' here, on
      // either caller path. Promotion (when warranted) is the CALLER's job
      // through navigation.confirmNode.
      review_status: 'proposed',
      epistemic_type: epistemicType,
    });
  } catch (e) {
    return { ok: false, reason: 'reasoning_node_write_failed', detail: String((e && e.message) || e).slice(0, 80) };
  }

  // Provenance targets: subjectNodeId first, then each evidenceNodeIds
  // entry, first-wins de-duplication via a Set, capped at
  // MAX_PROVENANCE_TARGETS. Never self-edge. Empty list -> zero calls, the
  // design's own "never fabricate provenance" floor (T-i2x-01 / T-i2x-02).
  const targets = [];
  const seen = new Set();
  function addTarget(t) {
    if (typeof t !== 'string' || t.length === 0) return;
    if (t === nodeId) return; // never self-edge
    if (seen.has(t)) return;
    if (targets.length >= MAX_PROVENANCE_TARGETS) return;
    seen.add(t);
    targets.push(t);
  }
  addTarget(subjectNodeId);
  if (Array.isArray(evidenceNodeIds)) {
    for (const id of evidenceNodeIds) addTarget(id);
  }

  let edgesWritten = 0;
  for (const target of targets) {
    // Edge properties are ENUM/scalar only per Canon Part 8 -- a relation
    // enum and an origin enum. Never prose, never a claim or artifact body.
    const result = edges.writeEdge(db, {
      source_id: nodeId,
      target_id: target,
      edge_type: 'SOURCED_FROM',
      properties: { relation: 'sourced_from', origin: (typeof origin === 'string' ? origin : '') },
    });
    if (result && result.ok === true) edgesWritten += 1;
    // Never let an edge failure fail the whole call: the node write already
    // succeeded and losing it would be worse than a missing edge.
  }

  let frameworkEdge = false;
  const frameworkHandle = FRAMEWORK_NODE_ID(framework);
  if (frameworkHandle !== null) {
    const result = edges.writeEdge(db, {
      source_id: nodeId,
      target_id: frameworkHandle,
      edge_type: 'USES_FRAMEWORK',
      properties: { relation: 'uses_framework', framework: frameworkHandle.slice('framework:'.length), origin: (typeof origin === 'string' ? origin : '') },
    });
    if (result && result.ok === true) {
      edgesWritten += 1;
      frameworkEdge = true;
    }
  }

  return { ok: true, node_id: nodeId, edges_written: edgesWritten, framework_edge: frameworkEdge };
}

module.exports = { writeReasoningNode, REASONING_NODE_ID, FRAMEWORK_NODE_ID };
