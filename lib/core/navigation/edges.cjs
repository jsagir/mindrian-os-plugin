'use strict';
// Phase 125-00 -- navigation.cjs edge-write primitive (per CONTEXT.md Pass 3 GAP-2
// resolution). Adds writeEdge to the navigation.cjs closed surface as an additive
// extension following the Phase 110-03 logMemoryEvent precedent.
//
// Canon Part 4: every choice is graph data; this is the chokepoint primitive that
// lets Plan 06 selector-decisions.cjs + future Phases 116/117/118 write typed
// cascade edges without bypassing the closed surface.
//
// Canon Part 7: reuse-before-build -- the UPSERT statement mirrors
// lib/core/lazygraph-ops.cjs::upsertEdge (lines 990-1019) so sibling agents
// emit edges via the same UPSERT shape and the navigation chokepoint stays
// the single door for write traffic.
//
// Canon Part 8 invariant: writeEdge takes (db, params) -- a db handle owned by
// the caller (via openRoomDb) -- so this module never opens room.db itself. Zero
// direct room-db.cjs require here. The navigation pre-commit hook treats this
// file as part of the navigation/* allow-list, NOT as a bypass.

const crypto = require('node:crypto');

// Closed edge-type allowlist enforced by writeEdge. Mirrors the EVENT_TYPES Set
// pattern in lib/core/navigation/memory-events.cjs. Phase 125 ships DEFERRED +
// REJECTED (D7 typed cascade edge surface for F.1 defer / F.2 reject). Future
// phases (e.g. Phase 116 tension resolution, Phase 117 auto-explore, Phase 118
// MVA) extend this Set additively without canon amendment -- same idiom as the
// EVENT_TYPES additive blocks for Phases 88.2-00 / 89-07 / 116-00 / 117-00 /
// 110-02.
//
// Tests assert a FLOOR (DEFERRED + REJECTED present) and Set-instance shape --
// not an exact size -- so additive extensions cannot regress baseline.
const ALLOWED_EDGE_TYPES = Object.freeze(new Set([
  // Phase 125 D7 -- F-selector decision edges (LOCKED LOCAL per Canon Part 8).
  'DEFERRED',
  'REJECTED',
  // Phase 120-00 Wave 1 extension (Breakthrough Scan / Category G; D-18 HARD FLOOR enforcement
  //   + D-20 Cypher-provable principle). DERIVED_FROM is the structural enforcement: a
  //   Breakthrough node CANNOT surface without at least one DERIVED_FROM edge to an
  //   Artifact node. Mirrors the Phase 125-00 DEFERRED + REJECTED additive idiom.
  //
  // Canon Part 4: every choice is graph data. The Breakthrough node + its DERIVED_FROM
  //   edges are the graph-native artifact of pattern detection.
  //
  // Canon Part 8: writeEdge takes (db, params) over a LOCAL room.db handle; DERIVED_FROM
  //   never crosses to Brain. Cross-room aggregation forbidden (Phase 8 cross-room fence).
  //
  // D-20 enforcement: lib/core/breakthrough/schema.cjs::writeBreakthrough wraps the
  //   Breakthrough node insert + N DERIVED_FROM edge inserts in a single SQLite transaction.
  //   If any step fails, the transaction rolls back -- partial Breakthrough state CANNOT
  //   land. The Cypher invariant `MATCH (b:Breakthrough)-[:DERIVED_FROM]->(a:Artifact)
  //   RETURN count(a)` is guaranteed >= 1 by construction.
  'DERIVED_FROM',
  // Phase 120-02 Wave 2 extension (Breakthrough Scan / Category G; D-09 file-as-decision
  //   bridge). FILED_AS_DECISION is the typed edge that promotes a Breakthrough node into
  //   the Phase 88 decision-log machinery when the user picks the [File as decision]
  //   verb on F.7. Mirrors the Phase 120-00 DERIVED_FROM additive idiom verbatim.
  //
  // Canon Part 4: every choice is graph data. The Breakthrough -> Decision edge is the
  //   graph-native bridge that lets future related breakthroughs reference the filed
  //   decision via ENABLES edges (per CONTEXT.md D-15 "may be referenced as ENABLES in
  //   future related breakthroughs").
  //
  // Canon Part 8: writeEdge takes (db, params) over a LOCAL room.db handle;
  //   FILED_AS_DECISION never crosses to Brain. Cross-room aggregation forbidden.
  //
  // Emitted by: lib/core/breakthrough/verb-dispatch.cjs::handleFileAsDecision.
  // The destination Decision node id is 'decision:' + breakthroughId by convention;
  // Phase 88 decision-log machinery (or a future Phase 121 housekeeping pass) is
  // responsible for materializing the Decision node body when one does not yet exist.
  'FILED_AS_DECISION',
  // Phase 129-01 extension (Spine Repair; FOLLOWS_FROM is the 8th canonical
  // cascade edge type extending the shipped vocabulary INFORMS / CONTRADICTS /
  // CONVERGES / INVALIDATES / ENABLES / REJECTED / DEFERRED per the 2026-05-16
  // dual-graph review additive-scope verdict). Emitted by the spine repair work
  // when one memory_event clearly follows another in the proactive loop (e.g.
  // spine_read FOLLOWS_FROM suggestion_surfaced). Mirrors the Phase 120-02
  // FILED_AS_DECISION additive idiom verbatim.
  //
  // Canon Part 8: properties are ENUM-ONLY (a surface scalar); no freeform
  //   user-content fields ever land on a FOLLOWS_FROM edge -- the review's hard
  //   constraint. writeEdge takes (db, params) over a LOCAL room.db handle;
  //   FOLLOWS_FROM never crosses to Brain.
  //
  // The dual-graph proposal's lens-class taxonomy (ASSOCIATION_LENS /
  //   TRANSITION_LENS) is REJECTED -- the verdict accepts a SINGLE additive
  //   cascade type that extends the shipped vocabulary, not parallel lens
  //   classes. Those strings stay OUT of the Set so writeEdge rejects them.
  'FOLLOWS_FROM',
  // Phase 129-03 extension (Spine Repair; OPERATOR_TRANSITION is the typed edge
  // that lib/conversation/operator.cjs used to write via a direct node:sqlite
  // INSERT bypass -- a baselined Phase 128 substrate violation). This is the
  // legal home for that edge: routing the write through navigation.writeEdge
  // (the chokepoint) RETIRES the bypass while preserving the edge the bypass
  // produced (the OPERATOR_TRANSITION row between two operator nodes per Canon
  // Part 4). Consumer = lib/core/navigation/spine-events.cjs::logOperatorTransition
  // (when payload.write_transition_edge is true), called by operator.cjs's
  // transition() path. Mirrors the Phase 129-01 FOLLOWS_FROM additive idiom.
  //
  // Canon Part 8: writeEdge takes (db, params) over a LOCAL room.db handle;
  //   OPERATOR_TRANSITION never crosses to Brain. The five-operator vocabulary
  //   is generic; only the generic operator names land on the edge.
  'OPERATOR_TRANSITION',
  // Phase 130-01 extension (Lens-Engine Skeleton; the two lens-engine cascade
  // edges that close review finding H2, the edge-allowlist bypass). INFORMS is
  // the lens-engine onAccept cascade edge -- a lens finding INFORMS a target
  // node (the engine's onAccept path writes it via writeEdge). REJECTED_BECAUSE
  // is the lens-engine onReject rejection-as-data edge per Canon Part 4 ("why
  // not" is graph data): the engine's onReject path records WHY a lens finding
  // was rejected so the next cross-relationship scan learns what not to surface.
  // Mirrors the Phase 129-03 OPERATOR_TRANSITION additive idiom verbatim.
  //
  // INFORMS was NAMED in the shipped-vocabulary comment since Phase 129-01
  // (INFORMS / CONTRADICTS / CONVERGES / INVALIDATES / ENABLES) but was never
  // actually a member of this Set -- so writeEdge would have rejected it. This
  // lands it, closing review finding H2 (the bypass where the engine would
  // otherwise write an edge type writeEdge rejects).
  //
  // Canon Part 8: properties are ENUM-ONLY (a surface scalar). REJECTED_BECAUSE
  //   carries a single reason scalar -- a short enum string such as low_evidence
  //   / off_topic / duplicate / out_of_scope -- never freeform user content, and
  //   never crosses to Brain. writeEdge takes (db, params) over a LOCAL room.db
  //   handle.
  //
  // The dual-graph proposal's lens-class taxonomy (ASSOCIATION_LENS /
  //   TRANSITION_LENS) stays REJECTED per the 2026-05-16 dual-graph verdict --
  //   those strings stay OUT of the Set so writeEdge rejects them.
  'INFORMS',
  'REJECTED_BECAUSE',
  // Phase 131-01 extension (Research as Graph-Aware Workflow; the two source-lens
  // cascade edges that close the LOCKED Phase 136 forward contract -- CONTRADICTS
  // and SUPERSEDES are added ADDITIVELY to this closed allow-list, never invented
  // per-phase). They EXTEND the shipped vocabulary (INFORMS / REJECTED_BECAUSE
  // shipped at 130-01) per the 4.8 re-baseline forward-contract lock:
  //   CONTRADICTS is the finding-kills-an-existing-claim edge -- a research
  //     EvidenceClaim node CONTRADICTS a target claim/assumption when the finding
  //     invalidates it (Stage 7 ACCEPT path; Phase 136 renders it as BOTH a graph
  //     edge AND a sentence per D-06).
  //   SUPERSEDES is the better-evidence-tier-version edge -- a higher-tier
  //     EvidenceClaim SUPERSEDES a lower-tier prior claim/EvidenceClaim.
  // Mirrors the Phase 130-01 INFORMS / REJECTED_BECAUSE additive idiom verbatim.
  //
  // Canon Part 4: every choice is graph data; CONTRADICTS / SUPERSEDES ARE the
  //   graph-native artifact of the Stage 7 wiring decision.
  // Canon Part 8: properties are ENUM-ONLY (a surface reason scalar -- a short
  //   enum string such as finding_kills_claim / higher_evidence_tier); never
  //   freeform user content, never crosses to Brain. writeEdge takes (db, params)
  //   over a LOCAL room.db handle.
  //
  // The cascade-edge targets are canonical correlation_ids (Phase 130.7
  //   computeCorrelationId), NOT raw names -- so edges do not fork across
  //   cross-label duplicates. The wirer (Plan 04) resolves the canonical id
  //   before calling writeEdge; this Set only governs the predicate vocabulary.
  'CONTRADICTS',
  'SUPERSEDES',
  // Phase 139-03 extension (Doctor Accumulative Engine -- Umbilical Cord, the
  // FIRST registered accumulative-engine module). AFFILIATED_WITH is the typed
  // edge a `.umbilical` cord projects into its TARGET room's room.db: a non-room
  // project (code / deck / research / deploy / doc / data tree) declares its
  // affiliation to a registered room via a `.umbilical` marker, and the doctor
  // umbilical module projects exactly ONE AFFILIATED_WITH edge per marker via
  // writeEdge. Added ADDITIVELY to this closed allow-list, never invented
  // per-phase -- mirrors the Phase 131-01 CONTRADICTS / SUPERSEDES additive
  // idiom verbatim.
  //
  // umbilical_storage LOCKED decision (Phase 139-CONTEXT.md): cords are
  //   authoritative at the REGISTRY layer (cross-tree, many-to-many) and are
  //   PROJECTED into each room.db as LOCAL AFFILIATED_WITH edges. The cord is
  //   the cross-tree source of truth; the edge is its per-room projection.
  //
  // Canon Part 8: the AFFILIATED_WITH edge is a LOCAL edge written into the
  //   TARGET room's OWN room.db ONLY -- NEVER a raw cross-room edge (no second
  //   room's db is opened to write it), and NEVER crosses to Brain. Properties
  //   are ENUM/scalar ONLY (relation enum + born ISO date); the marker's freeform
  //   `note:` field NEVER lands on the edge (it stays LOCAL to the marker file).
  //   writeEdge takes (db, params) over a LOCAL room.db handle.
  'AFFILIATED_WITH',
  // Phase 143.1-03 extension (Dial-TUI Capability Selector; DIALTUI-06 +
  // DIALTUI-08 -- the two dial-decision cascade edges closeReach() writes).
  // Added ADDITIVELY to this closed allow-list, never invented per-phase --
  // mirrors the Phase 139-03 AFFILIATED_WITH additive idiom verbatim. The floor
  // (DEFERRED / REJECTED + every prior type) is byte-identical except these two
  // additions; tests assert a FLOOR + named membership, never an exact count,
  // so this cannot regress baseline.
  //
  //   PIVOTED        -- DIALTUI-06. The "why not the recommendation" edge: when
  //     the navigator rotates the dial OFF the Recommended reach and commits a
  //     different one, closeReach writes a PIVOTED edge FROM the chosen reach TO
  //     the declined-recommended one. Canon Part 4: "why not" is graph data.
  //
  //     Canon Part 8 -- ENUM-ONLY props: {declined_recommended:'cmd:...',
  //       margin (a numeric scalar), decision_id (a generated handle)}. NO
  //       freeform user content ever lands on a PIVOTED edge -- the same hard
  //       constraint the FOLLOWS_FROM precedent (line 79) carries. writeEdge
  //       takes (db, params) over a LOCAL room.db handle; PIVOTED never crosses
  //       to Brain.
  //
  //   SELECTED_REACH -- DIALTUI-08 + FILEVAL-01. Every committed reach (sync OR
  //     pivot) writes ONE SELECTED_REACH edge FROM the active focus node TO
  //     cmd:<command> with props {jtbd, framework, recommended, decision_id}.
  //     This closes the Part 3 Layer-3 gap (the selection becomes graph data at
  //     the selection moment) and satisfies FILEVAL-01.
  //
  //     Canon Part 9 carve-out: SELECTED_REACH is SYSTEM BOOKKEEPING
  //       (created_by=system, exempt from human-confirm), kept DISTINCT from any
  //       confirmNode truth-claim promotion. A truth-claim promotion stays on
  //       the confirmNode human-byUser path; closeReach never folds it into the
  //       SELECTED_REACH write. writeEdge takes (db, params) over a LOCAL
  //       room.db handle; SELECTED_REACH never crosses to Brain.
  'PIVOTED',
  'SELECTED_REACH',
  // Phase 149-01 extension (GSD Planning Artifacts as Local-Graph Members; the
  // two GSD-lineage cascade edges the planning-artifact writer needs). Added
  // ADDITIVELY to this closed allow-list, never invented per-phase -- mirrors
  // the Phase 143.1-03 PIVOTED / SELECTED_REACH additive idiom verbatim. The
  // floor (DEFERRED / REJECTED + every prior type) is byte-identical except
  // these two additions; tests assert a FLOOR + named membership, never an
  // exact count, so this cannot regress baseline. INFORMS (line 127) is the
  // third lineage type and was already a member; these two complete the
  // FEEDS_INTO / VALIDATES / INFORMS lineage triple the SPEC names.
  //
  //   FEEDS_INTO  -- GAM-03. The artifact-lineage spine edge: SPEC FEEDS_INTO
  //     CONTEXT FEEDS_INTO PLAN (and PLAN FEEDS_INTO a requirement when that
  //     reading fits). The directed "this artifact informs the next stage of
  //     the GSD lifecycle" edge.
  //
  //   VALIDATES   -- GAM-03. The verification-lineage edge: a VERIFICATION
  //     artifact VALIDATES a requirement (or the owning PLAN). The directed
  //     "this artifact confirms that node was satisfied" edge.
  //
  // Canon Part 4: every choice is graph data; the GSD lineage edges ARE the
  //   graph-native artifact of the planning-doc lifecycle (Canon Part 9: files
  //   preserve meaning, SQL remembers and navigates).
  // Canon Part 8: properties are ENUM/scalar ONLY (a phase id + an artifact-type
  //   enum); the artifact BODY never lands on the edge. writeEdge takes
  //   (db, params) over a LOCAL room.db handle; FEEDS_INTO / VALIDATES never
  //   cross to Brain. Cross-room aggregation forbidden.
  //
  // Emitted by: lib/core/navigation/planning-artifacts.cjs writeLineageEdge,
  //   which constrains its accepted set to the LINEAGE subset
  //   {FEEDS_INTO, VALIDATES, INFORMS} -- a subset of this allow-list, so this
  //   Set stays the single source of truth for the predicate vocabulary.
  'FEEDS_INTO',
  'VALIDATES',
  // Phase 150-01 extension (Memory Cortex as Graph Members; the three cortex
  // lineage cascade edges the memory-artifact writer needs). Added ADDITIVELY to
  // this closed allow-list, never invented per-phase -- mirrors the Phase 149-01
  // FEEDS_INTO / VALIDATES additive idiom verbatim. The floor (DEFERRED /
  // REJECTED + every prior type) is byte-identical except these three additions;
  // tests assert a FLOOR + named membership, never an exact count, so this cannot
  // regress baseline. INFORMS (line 127) is the fourth cortex type and was
  // already a member; these three complete the STATES / SUPPORTS / INFORMS /
  // DESCRIBES cortex lineage taxonomy the SPEC names.
  //
  //   STATES    -- MEM-01. The governing-thought-states-section edge: a
  //     governing_thought node STATES the section memory_artifact it summarizes.
  //
  //   SUPPORTS  -- MEM-01. The claim-supports-governing-thought edge: a MECE
  //     claim node SUPPORTS the governing_thought it underpins.
  //
  //   DESCRIBES -- MEM-01. The persona-describes-room edge: a navigator_persona
  //     node DESCRIBES the room node.
  //
  // Canon Part 4: every choice is graph data; the cortex lineage edges ARE the
  //   graph-native artifact of the user-memory lifecycle (Canon Part 9: files
  //   preserve meaning, SQL remembers and navigates).
  // Canon Part 8: properties are ENUM/scalar ONLY (a section id + a kind enum);
  //   the memory BODY never lands on the edge. writeEdge takes (db, params) over
  //   a LOCAL room.db handle; STATES / SUPPORTS / DESCRIBES never cross to Brain.
  //   Cross-room aggregation forbidden.
  //
  // Emitted by: lib/core/navigation/memory-artifacts.cjs writeCortexLineageEdge,
  //   which constrains its accepted set to the CORTEX subset
  //   {STATES, SUPPORTS, INFORMS, DESCRIBES} -- a subset of this allow-list, so
  //   this Set stays the single source of truth for the predicate vocabulary.
  'STATES',
  'SUPPORTS',
  'DESCRIBES',
]));

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// writeEdge(db, params) -- the 15th-style additive re-export on the
// navigation.cjs closed surface (see navigation.cjs header comment for the
// canonical re-export pattern alongside logMemoryEvent + firstCapturedLastTouchedBySection).
//
// Positional db (first arg, owned by caller via openRoomDb), params object
// (second arg) with: { source_id, target_id, edge_type, properties }.
//
// Returns { ok: true, edge_id, type, source, target } on success, or
// { ok: false, reason, detail? } on validation / write failure. Defensive --
// never throws on caller input. The underlying prepare/run is sync per the
// node:sqlite contract (matches the rest of the navigation module).
function writeEdge(db, params) {
  if (!params || typeof params !== 'object') {
    return { ok: false, reason: 'invalid_params' };
  }
  const { source_id, target_id, edge_type, properties } = params;
  if (typeof source_id !== 'string' || source_id.length === 0) {
    return { ok: false, reason: 'invalid_source_id' };
  }
  if (typeof target_id !== 'string' || target_id.length === 0) {
    return { ok: false, reason: 'invalid_target_id' };
  }
  if (typeof edge_type !== 'string' || !ALLOWED_EDGE_TYPES.has(edge_type)) {
    return { ok: false, reason: 'invalid_edge_type', detail: String(edge_type).slice(0, 40) };
  }
  const props = isPlainObject(properties) ? properties : {};
  let propsJson;
  try {
    propsJson = JSON.stringify(props);
  } catch (_e) {
    return { ok: false, reason: 'properties_serialize_failed' };
  }
  const edgeId = 'edge:' + edge_type + ':' + Date.now() + ':' + crypto.randomBytes(4).toString('hex');
  try {
    db.prepare(
      'INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?) ' +
      'ON CONFLICT(source, target, type) DO UPDATE SET properties = excluded.properties'
    ).run(source_id, target_id, edge_type, propsJson);
  } catch (e) {
    return { ok: false, reason: 'edge_write_failed', detail: String(e.message || '').slice(0, 80) };
  }
  return { ok: true, edge_id: edgeId, type: edge_type, source: source_id, target: target_id };
}

module.exports = { ALLOWED_EDGE_TYPES, writeEdge };
