'use strict';
/*
 * Phase 150-01 -- memory-artifacts: the memory-cortex node/edge-write chokepoint
 * for the user-memory MD files (ROOM / STATE / MINTO / BRAIN / FEYNMAN / USER).
 * This is the net-new substrate every downstream 150 wave rides on: the reconcile
 * + trigger (Plan 03), the local-consumption + orphans (Plan 04), the spine
 * connector (Plan 05), and the selector graph-drive (Plan 06) all call these
 * writers. MEM-01 / MEM-02 / MEM-07.
 *
 * It MIRRORS lib/core/navigation/planning-artifacts.cjs (Phase 149-01) verbatim
 * in shape, repointed from the DEV .planning/ docs to the SIX user-memory MD
 * files. It is an allow-listed navigation submodule (scripts/check-substrate.cjs
 * regex /^lib\/core\/navigation\// covers it). It takes a db handle owned by the
 * caller (via lib/core/room-db.cjs openRoomDb) EXACTLY like planning-artifacts.cjs
 * and edges.cjs: it NEVER requires node:sqlite and NEVER opens room.db itself, so
 * it stays inside the navigation allow-list with ZERO substrate bypass (MEM-01
 * substrate-guard floor; threat T-150-05). The only sibling it requires is
 * ./edges.cjs.
 *
 * Exports:
 *   writeMemoryArtifactNode(db, {section, kind, path, hash})
 *                                  -> { ok, node_id } | { ok:false, reason }
 *   writeGoverningThoughtNode(db, {section, hash})
 *                                  -> { ok, node_id } | { ok:false, reason }
 *   writeNavigatorPersonaNode(db, {roleBlend, journeyStage})
 *                                  -> { ok, node_id } | { ok:false, reason }
 *   writeDecisionNode(db, {decisionId, section, summaryHash, source})
 *                                  -> { ok, node_id } | { ok:false, reason }
 *   writeCortexLineageEdge(db, {source_id, target_id, edge_type, properties})
 *                                  -> { ok, ... } | { ok:false, reason }
 *   MEMORY_KINDS                   -> frozen array of the 7 memory kinds (+DRIFT)
 *   MEMORY_ARTIFACT_NODE_ID(section, kind) -> stable node id
 *   GOVERNING_THOUGHT_NODE_ID(section)     -> stable node id
 *   NAVIGATOR_PERSONA_NODE_ID()            -> stable node id (one per room)
 *   DECISION_NODE_ID(decisionId)           -> stable node id
 *
 * ====================================================================
 * THE HEADLINE DISTINCTION: system-bookkeeping vs truth-claim
 * ====================================================================
 *
 * Canon Part 9 v1.5 (AUDIT-NODE CARVE-OUT): memory_artifact + governing_thought +
 *   navigator_persona are SYSTEM-BOOKKEEPING nodes -- they record what the system
 *   DID about the user-memory surface (WHICH memory files exist, which
 *   governing-thought / persona the system projected), NOT a truth-claim about the
 *   venture. They are NOT in the truth-claim set {claim, CausalClaim, assumption,
 *   decision, opportunity}. So they MAY carry created_by='system'
 *   review_status='confirmed' WITHOUT a human byUser; the carve-out makes that
 *   confirmed-status write canon-legal, not a Part 9 role-5 violation. Here
 *   review_status='confirmed' means write-completed (the node exists), not
 *   human-attributed truth. They never reach the confirmNode human-byUser
 *   truth-claim path. Mirrors lib/core/navigation/focus.cjs writing a
 *   focus_changed audit node with created_by='system' review_status='confirmed'
 *   and lib/core/navigation/planning-artifacts.cjs writing planning_artifact +
 *   requirement nodes the same way.
 *
 * writeDecisionNode IS THE ONE EXCEPTION. A `decision` node is a TRUTH-CLAIM node
 *   {claim, CausalClaim, assumption, decision, opportunity}, so per Canon Part 9
 *   role 5 it may NEVER be system-confirmed. writeDecisionNode mints it at
 *   review_status='proposed' (created_by='system') and the ON CONFLICT update
 *   never overwrites review_status, so a human-confirmed decision that the system
 *   re-projects stays confirmed. Only the human confirmNode path promotes a
 *   decision from proposed to confirmed. A 'confirmed' mint on the decision path
 *   here would be a Canon Part 9 role-5 constitutional breach. See the prominent
 *   comment block on writeDecisionNode below.
 *
 * ====================================================================
 *
 * Canon Part 8: zero network surface. Pure LOCAL SQLite over a caller-owned
 *   handle. No Brain calls; the memory BODY never leaves the room. Node
 *   properties carry only section/kind enums, sha256 hash handles, and
 *   role-blend / journey-stage enums -- never raw MINTO governing-thought or
 *   USER.md persona prose. The lineage edge properties are ENUM/scalar only.
 *
 * Canon Part 7 (reuse before build): writeCortexLineageEdge is a thin pass-through
 *   to edges.writeEdge -- the existing edge-write primitive gated on the shipped
 *   ALLOWED_EDGE_TYPES Set. This module adds NO new taxonomy member of its own; it
 *   CONSTRAINS to the existing CORTEX subset {STATES, SUPPORTS, INFORMS,
 *   DESCRIBES} (all members of ALLOWED_EDGE_TYPES), so edges.cjs stays the single
 *   source of truth for the predicate vocabulary (threat T-150-01).
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const edges = require('./edges.cjs');
const { insertNode } = require('../node-insert.cjs');

// The user-memory kinds (ROOM / STATE / MINTO / BRAIN / FEYNMAN / USER + DRIFT).
// Frozen so callers cannot mutate the closed set; writeMemoryArtifactNode
// validates kind against the Set.
//
// FCM-07 (Phase 195, Wave 1): DRIFT is the 7th memory kind. The CODE registration
// lands autonomously now so the navigator-gated canon 6->7 amendment (FCM-08,
// Wave 5) ratifies an already-wired kind. A registered BASENAME_TO_KIND entry
// (reconcile-memory-runner.cjs) MUST have a matching accepted kind here or a
// DRIFT.md file would be discovered but fail to project -- a broken wire (Part 11
// R1/R2: born WIRED or excluded). DRIFT is LOCAL only; a drift entry never egresses
// to the Brain (Part 8). NO canon bytes here -- MEMORY_KINDS is code, not the
// docs/MINDRIAN-CANON.md Part 9 list the amendment edits.
const MEMORY_KINDS = Object.freeze([
  'ROOM',
  'STATE',
  'MINTO',
  'BRAIN',
  'FEYNMAN',
  'USER',
  'DRIFT',
]);
const MEMORY_KIND_SET = Object.freeze(new Set(MEMORY_KINDS));

// The CORTEX subset writeCortexLineageEdge accepts. Each member is ALSO a member
// of edges.cjs ALLOWED_EDGE_TYPES (STATES + SUPPORTS + DESCRIBES added at Phase
// 150-01; INFORMS shipped at Phase 130-01). This is a SUBSET-constraint, not a
// new taxonomy: a non-cortex-but-real edge type (e.g. DEFERRED) is rejected here
// even though edges.writeEdge would accept it, and a non-taxonomy type
// (BOGUS_LINK) is rejected at BOTH layers.
//   STATES   -- governing_thought STATES section
//   SUPPORTS -- MECE claim SUPPORTS governing_thought
//   INFORMS  -- decision INFORMS section (reuses the shipped INFORMS member)
//   DESCRIBES -- persona DESCRIBES room
const CORTEX_LINEAGE_EDGE_TYPES = Object.freeze(['STATES', 'SUPPORTS', 'INFORMS', 'DESCRIBES']);
const CORTEX_LINEAGE_EDGE_TYPE_SET = Object.freeze(new Set(CORTEX_LINEAGE_EDGE_TYPES));

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// _nodeContentUnchanged(db, nodeId, propsJson) -- true when a node with this id
// already exists AND its stored properties are byte-identical to propsJson. This
// is the MED-04 idempotence-observability probe: a re-projection that would write
// the SAME properties is a no-op (report.unchanged), not genuine work
// (report.upserted). Best-effort: any read failure returns false (treat as
// changed) so the writer never suppresses a real write on a read fault.
function _nodeContentUnchanged(db, nodeId, propsJson) {
  try {
    const row = db.prepare('SELECT properties FROM nodes WHERE id = ?').get(nodeId);
    return !!(row && row.properties === propsJson);
  } catch (_e) {
    return false;
  }
}

// MEMORY_ARTIFACT_NODE_ID(section, kind) -- the stable id that makes the
// ON CONFLICT(id) DO UPDATE upsert deduplicate per the MEM-02 idempotence
// contract. Re-running over the same memory file updates the SAME row, never
// adds a duplicate.
function MEMORY_ARTIFACT_NODE_ID(section, kind) {
  return 'memory_artifact:' + section + ':' + kind;
}

// GOVERNING_THOUGHT_NODE_ID(section) -- the stable id for the per-section MINTO
// governing-thought node.
function GOVERNING_THOUGHT_NODE_ID(section) {
  return 'governing_thought:' + section;
}

// NAVIGATOR_PERSONA_NODE_ID() -- one persona node per room (USER.md is one file).
function NAVIGATOR_PERSONA_NODE_ID() {
  return 'navigator_persona:room';
}

// DECISION_NODE_ID(decisionId) -- the stable id for a per-decision node, so the
// ON CONFLICT upsert collapses the triple-ledger to one graph-authoritative row.
function DECISION_NODE_ID(decisionId) {
  return 'decision:' + decisionId;
}

// writeMemoryArtifactNode(db, {section, kind, path, hash, anchors}) -- UPSERT a
// typed memory_artifact node (the user-memory twin of writePlanningArtifactNode).
// Validates kind against MEMORY_KIND_SET; JSON.stringify the properties
// {section, kind, path, hash, anchors?}; runs the INSERT ... ON CONFLICT(id) DO
// UPDATE upsert. created_by='system', confidence 1.0, review_status='confirmed'
// (the Canon Part 9 v1.5 audit-node carve-out -- system-bookkeeping, NOT a truth
// claim). source_path is a LOCAL handle 'memory:'+section+':'+kind, never user
// prose. The `path` field is a ROOM-RELATIVE handle (the caller passes a path
// relative to the room root, NOT an absolute path -- LOW-03: an absolute path is
// user-identifying and a latent egress surface). The `hash` field is a sha256
// content-hash handle, never prose. The optional `anchors` field is an array of
// GENERIC framework-name handles (e.g. 'SWOT', 'Porter Five Forces') derived
// from a BRAIN-kind file's Phase-90 derivation -- framework names only, never
// BRAIN.md prose (Part 8). The deriveBrainAnchors consumer reads this key.
// Defensive: never throws on caller input; returns { ok:false, reason } on
// failure.
function writeMemoryArtifactNode(db, params) {
  if (!isPlainObject(params)) {
    return { ok: false, reason: 'invalid_params' };
  }
  const { section, kind, path: artifactPath, hash, anchors } = params;
  if (typeof section !== 'string' || section.length === 0) {
    return { ok: false, reason: 'invalid_section' };
  }
  if (typeof kind !== 'string' || !MEMORY_KIND_SET.has(kind)) {
    return { ok: false, reason: 'invalid_kind', detail: String(kind).slice(0, 40) };
  }
  if (typeof artifactPath !== 'string' || artifactPath.length === 0) {
    return { ok: false, reason: 'invalid_path' };
  }
  // anchors: keep ONLY non-empty string handles (framework names). A non-array
  // or empty input drops the key so the props stay minimal for files that carry
  // no derivation (Part 8: generic handles only, never prose).
  const cleanAnchors = Array.isArray(anchors)
    ? anchors.filter((a) => typeof a === 'string' && a.length > 0)
    : [];
  const props = {
    section: section,
    kind: kind,
    path: artifactPath,
    hash: typeof hash === 'string' ? hash : '',
  };
  if (cleanAnchors.length > 0) {
    props.anchors = cleanAnchors;
  }
  let propsJson;
  try {
    propsJson = JSON.stringify(props);
  } catch (_e) {
    return { ok: false, reason: 'properties_serialize_failed' };
  }
  const nodeId = MEMORY_ARTIFACT_NODE_ID(section, kind);
  const sourcePath = 'memory:' + section + ':' + kind;
  const unchanged = _nodeContentUnchanged(db, nodeId, propsJson);
  try {
    insertNode(db, nodeId, 'memory_artifact', propsJson, {
      source_path: sourcePath,
      created_by: 'system',
      confidence: 1.0,
      review_status: 'confirmed',
      // R17-02 (Task 4 Decision 4): 'observation' -- system bookkeeping.
      epistemic_type: 'observation',
    });
  } catch (e) {
    return { ok: false, reason: 'memory_artifact_write_failed', detail: String(e.message || '').slice(0, 80) };
  }
  return { ok: true, node_id: nodeId, changed: !unchanged };
}

// writeGoverningThoughtNode(db, {section, hash, freshness}) -- UPSERT a typed
// governing_thought node (the MINTO governing-thought as a sha256 hash handle
// only, NEVER the raw governing-thought prose). Same system-bookkeeping carve-out
// as writeMemoryArtifactNode (created_by='system', review_status='confirmed').
// The optional `freshness` field is a closed enum ('fresh' | 'stale') derived
// from the source MINTO file's mtime vs a staleness window -- a generic temporal
// scalar, never prose. The buildReachScoresFromCortex consumer reads this key to
// distinguish the higher 'fresh' context-grounding prior from the lower
// present-at-all prior. Defensive; never throws.
function writeGoverningThoughtNode(db, params) {
  if (!isPlainObject(params)) {
    return { ok: false, reason: 'invalid_params' };
  }
  const { section, hash, freshness } = params;
  if (typeof section !== 'string' || section.length === 0) {
    return { ok: false, reason: 'invalid_section' };
  }
  const props = { section: section, hash: typeof hash === 'string' ? hash : '' };
  // freshness: closed enum scalar only. Drop anything outside the closed set so
  // a malformed value never lands on the node.
  if (freshness === 'fresh' || freshness === 'stale') {
    props.freshness = freshness;
  }
  let propsJson;
  try {
    propsJson = JSON.stringify(props);
  } catch (_e) {
    return { ok: false, reason: 'properties_serialize_failed' };
  }
  const nodeId = GOVERNING_THOUGHT_NODE_ID(section);
  const sourcePath = 'governing_thought:' + section;
  const unchanged = _nodeContentUnchanged(db, nodeId, propsJson);
  try {
    insertNode(db, nodeId, 'governing_thought', propsJson, {
      source_path: sourcePath,
      created_by: 'system',
      confidence: 1.0,
      review_status: 'confirmed',
      // R17-02 (Task 4 Decision 4): 'observation' -- system bookkeeping.
      epistemic_type: 'observation',
    });
  } catch (e) {
    return { ok: false, reason: 'governing_thought_write_failed', detail: String(e.message || '').slice(0, 80) };
  }
  return { ok: true, node_id: nodeId, changed: !unchanged };
}

// writeNavigatorPersonaNode(db, {roleBlend, journeyStage}) -- UPSERT a typed
// navigator_persona node (the USER persona as ENUM/handle scalars only: a
// role-blend enum string and a journey-stage enum from the Campbell 12-stage
// taxonomy, NEVER raw USER.md persona prose). Same system-bookkeeping carve-out.
// One persona node per room. Defensive; never throws.
function writeNavigatorPersonaNode(db, params) {
  if (!isPlainObject(params)) {
    return { ok: false, reason: 'invalid_params' };
  }
  const { roleBlend, journeyStage } = params;
  const props = {
    role_blend: typeof roleBlend === 'string' ? roleBlend : '',
    journey_stage: typeof journeyStage === 'string' ? journeyStage : '',
  };
  let propsJson;
  try {
    propsJson = JSON.stringify(props);
  } catch (_e) {
    return { ok: false, reason: 'properties_serialize_failed' };
  }
  const nodeId = NAVIGATOR_PERSONA_NODE_ID();
  const sourcePath = 'navigator_persona:room';
  const unchanged = _nodeContentUnchanged(db, nodeId, propsJson);
  try {
    insertNode(db, nodeId, 'navigator_persona', propsJson, {
      source_path: sourcePath,
      created_by: 'system',
      confidence: 1.0,
      review_status: 'confirmed',
      // R17-02 (Task 4 Decision 4): 'observation' -- system bookkeeping.
      epistemic_type: 'observation',
    });
  } catch (e) {
    return { ok: false, reason: 'navigator_persona_write_failed', detail: String(e.message || '').slice(0, 80) };
  }
  return { ok: true, node_id: nodeId, changed: !unchanged };
}

// ====================================================================
// writeDecisionNode -- THE ONE TRUTH-CLAIM WRITER (contrast with the three
// system-bookkeeping writers above).
// ====================================================================
//
// writeDecisionNode(db, {decisionId, section, summaryHash, source}) is the
// 108/109 EXTEND-debt projector. It collapses the triple-ledger (decisions_index
// / MINTO decision_log / f_selector_decision named in 150-LOOP-MAP.md) to ONE
// graph-authoritative `decision` node so the reads that query type='decision'
// (find_stale_decisions at insights.cjs:118, room-home.cjs:60, focus.cjs:126,
// packet.cjs:62) stop returning a silent empty set (MEM-07 decision closure).
//
// CRITICAL CANON PART 9 ROLE-5 RULE: a `decision` is a TRUTH-CLAIM node
// {claim, CausalClaim, assumption, decision, opportunity}, NOT a system-bookkeeping
// node. So unlike the three writers above, it is NOT under the audit-node
// carve-out. It MUST be minted at review_status='proposed' (created_by='system'),
// NEVER 'confirmed'. Only the human confirmNode path (lib/core/navigation/
// confirm-node.cjs) promotes a decision from proposed to confirmed with a human
// byUser attribution. A 'confirmed' mint here would be a constitutional breach.
//
// IDEMPOTENCE + NO-DOWNGRADE: the ON CONFLICT(id) DO UPDATE upserts properties +
// last_seen_at but DELIBERATELY EXCLUDES review_status from the SET clause. So if
// the human already confirmed this decision and the system later re-projects it
// from the ledger, the re-projection updates the summary_hash but leaves the
// human-attributed 'confirmed' status intact. The projector can only ever WRITE
// 'proposed' on first insert; it can NEVER overwrite a status on update.
// properties carry only {section, summary_hash, source, kind?} -- a section
// enum, a sha256 summary handle, a ledger-origin enum, and an optional closed
// 'kind' enum ('contradiction'), never decision prose.
// Defensive; never throws on caller input.
function writeDecisionNode(db, params) {
  if (!isPlainObject(params)) {
    return { ok: false, reason: 'invalid_params' };
  }
  const { decisionId, section, summaryHash, source, kind } = params;
  if (typeof decisionId !== 'string' || decisionId.length === 0) {
    return { ok: false, reason: 'invalid_decision_id' };
  }
  if (typeof section !== 'string' || section.length === 0) {
    return { ok: false, reason: 'invalid_section' };
  }
  const props = {
    section: section,
    summary_hash: typeof summaryHash === 'string' ? summaryHash : '',
    source: typeof source === 'string' ? source : '',
  };
  // kind: a closed-enum classification scalar. The ONLY recognized value today
  // is 'contradiction' (the archetype-escalation signal hasContradiction reads).
  // A generic enum, never decision prose (Part 8). Drop anything outside the
  // closed set so a malformed value never lands on the node.
  if (kind === 'contradiction') {
    props.kind = kind;
  }
  let propsJson;
  try {
    propsJson = JSON.stringify(props);
  } catch (_e) {
    return { ok: false, reason: 'properties_serialize_failed' };
  }
  const nodeId = DECISION_NODE_ID(decisionId);
  const sourcePath = 'decision:' + section + ':' + decisionId;
  const unchanged = _nodeContentUnchanged(db, nodeId, propsJson);
  try {
    // review_status='proposed' on INSERT (TRUTH-CLAIM: never auto-confirmed).
    // insertNode's DO UPDATE clause never touches review_status or confidence,
    // so a human-confirmed decision re-projected by the system stays confirmed
    // (no downgrade). That no-downgrade guarantee now lives inside insertNode.
    insertNode(db, nodeId, 'decision', propsJson, {
      source_path: sourcePath,
      created_by: 'system',
      confidence: 1.0,
      review_status: 'proposed',
      // R17-02 (Task 4 Decision 4): 'decision'.
      epistemic_type: 'decision',
    });
  } catch (e) {
    return { ok: false, reason: 'decision_write_failed', detail: String(e.message || '').slice(0, 80) };
  }
  return { ok: true, node_id: nodeId, changed: !unchanged };
}

// writeCortexLineageEdge(db, {source_id, target_id, edge_type, properties}) -- a
// thin pass-through to edges.writeEdge that FIRST constrains edge_type to the
// CORTEX subset {STATES, SUPPORTS, INFORMS, DESCRIBES}. The constraint means:
//   - a non-taxonomy type (BOGUS_LINK) is rejected here (and would also be
//     rejected by writeEdge);
//   - a real-but-non-cortex type (DEFERRED) is rejected HERE even though
//     writeEdge would accept it -- the cortex writer does not widen the
//     taxonomy, it narrows the accepted set.
// edges.writeEdge stays the single source of truth for the predicate vocabulary
// (its ALLOWED_EDGE_TYPES gate); this writer never adds a new member.
// Defensive; never throws on caller input.
function writeCortexLineageEdge(db, params) {
  if (!isPlainObject(params)) {
    return { ok: false, reason: 'invalid_params' };
  }
  const { edge_type } = params;
  if (typeof edge_type !== 'string' || !CORTEX_LINEAGE_EDGE_TYPE_SET.has(edge_type)) {
    return { ok: false, reason: 'invalid_cortex_edge_type', detail: String(edge_type).slice(0, 40) };
  }
  return edges.writeEdge(db, params);
}

module.exports = {
  MEMORY_KINDS,
  MEMORY_KIND_SET,
  CORTEX_LINEAGE_EDGE_TYPES,
  MEMORY_ARTIFACT_NODE_ID,
  GOVERNING_THOUGHT_NODE_ID,
  NAVIGATOR_PERSONA_NODE_ID,
  DECISION_NODE_ID,
  writeMemoryArtifactNode,
  writeGoverningThoughtNode,
  writeNavigatorPersonaNode,
  writeDecisionNode,
  writeCortexLineageEdge,
};
