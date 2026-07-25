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
  // Phase 150.8 extension (Meeting Micro-Knowledge DIKW Filing; the three
  // Knowledge-rung relationship edges the typed-claim writer needs to express
  // refinement + causal + instantiation structure between claim nodes). Added
  // ADDITIVELY to this closed allow-list, never invented per-phase -- mirrors
  // the Phase 150-01 STATES / SUPPORTS / DESCRIBES additive idiom verbatim. The
  // floor (DEFERRED / REJECTED + every prior type) is byte-identical except
  // these three additions; tests assert a FLOOR + named membership, never an
  // exact count, so this cannot regress baseline.
  //
  // NAVIGATOR-GATED Canon Part 4 + Phase 108 amendment (AskUserQuestion approval
  //   D-150.8, 2026-06-12). Unlike the routine additive-without-amendment idiom
  //   above, this trio MOVES A FROZEN CONSTITUTIONAL SET: a navigator approved
  //   the closed-set change via a blocking AskUserQuestion BEFORE these bytes
  //   landed, mirroring the Phase 148 D-09 reach-count amendment procedure. The
  //   three deferred types (GENERALIZES / CONTRADICTS_CONDITIONALLY /
  //   SUPERSEDES_v2) stay OUT (SEED-023, v1.14.0) so writeEdge rejects them.
  //
  //   REFINES        -- DIKW-04. The refinement edge: a new claim TIGHTENS or
  //     CONDITIONS a prior claim without invalidating it. Today the schema
  //     forces a wrong binary choice between INFORMS (too weak) and CONTRADICTS
  //     (wrong); REFINES is the missing middle. Source = the refining claim,
  //     target = the refined-prior claim.
  //
  //   ROOT_CAUSES    -- DIKW-04. The directional causal-mechanism edge:
  //     source = the cause, target = the effect. A causal claim ROOT_CAUSES the
  //     outcome it explains; makes the causal chain queryable as graph paths.
  //
  //   INSTANTIATES   -- DIKW-04. The example-evidences-abstraction edge: a
  //     concrete example claim INSTANTIATES an abstract claim it is an instance
  //     of. Source = the concrete instance, target = the abstract claim.
  //
  // Canon Part 4: every choice is graph data; REFINES / ROOT_CAUSES /
  //   INSTANTIATES ARE the graph-native artifact of the Knowledge-rung filing
  //   decision (Canon Part 9: files preserve meaning, SQL remembers and
  //   navigates).
  // Canon Part 8: properties are ENUM/scalar ONLY. The claim/segment BODY never
  //   lands on the edge; valid_from / valid_until (TV-01) are SCALARS that ride
  //   the existing writeEdge properties JSON param with ZERO signature change.
  //   writeEdge takes (db, params) over a LOCAL room.db handle; REFINES /
  //   ROOT_CAUSES / INSTANTIATES never cross to Brain. Cross-room aggregation
  //   forbidden.
  'REFINES',
  'ROOT_CAUSES',
  'INSTANTIATES',
  // Phase 163-01 extension (Trending-to-the-Absurd Harness; the four
  // domain-taxonomy relationship edges the connective taxonomy layer needs to
  // make domains / subdomains / focus_areas first-class connected graph citizens
  // per D-163-01). Added ADDITIVELY to this closed allow-list, never invented
  // per-phase -- mirrors the Phase 150.8 REFINES / ROOT_CAUSES / INSTANTIATES
  // additive idiom verbatim. The floor (DEFERRED / REJECTED + every prior type)
  // is byte-identical except these four additions; tests assert a FLOOR + named
  // membership, never an exact count, so this cannot regress baseline.
  //
  // NAVIGATOR-GATED Canon Part 4 + Phase 108 amendment (D-163-03, navigator-LOCKED
  //   2026-06-17). Unlike the routine additive-without-amendment idiom above, this
  //   set of four MOVES A FROZEN CONSTITUTIONAL SET: a navigator ratified the
  //   closed-set change at a blocking checkpoint BEFORE these bytes landed,
  //   mirroring the Phase 150.8 D-150.8 trio and the Phase 148 D-09 reach-count
  //   amendment procedure.
  //
  //   DECOMPOSED_INTO -- the hierarchy edge. Source = the parent taxonomy node,
  //     target = the child. Legal endpoints are domain -> subdomain and
  //     subdomain -> focus_area ONLY. Makes the domain tree queryable as graph
  //     paths (walk a domain down to its focus areas and back).
  //
  //   PART_OF -- the structural-membership edge. Source = the member node, target
  //     = the domain / subdomain it belongs to. Legal source endpoints are ANY
  //     node type (claim / assumption / opportunity / Artifact / Section / trend /
  //     CausalClaim); legal target endpoints are domain / subdomain / focus_area.
  //     This is the connective edge that lets a domain walk to everything it
  //     touches (D-163-01).
  //
  //   TAGGED_WITH -- the lightweight categorization edge. Source = any node,
  //     target = a domain / subdomain (the connective taxonomy tag). Weaker than
  //     PART_OF: a tag relationship, not a structural-membership claim.
  //
  //   RELATED_TO -- the symmetric cross-domain relatedness edge between two
  //     taxonomy nodes (domain <-> domain, subdomain <-> subdomain) when a theme
  //     spans them. The undirected sibling of DECOMPOSED_INTO's hierarchy.
  //
  // Canon Part 4: every choice is graph data; DECOMPOSED_INTO / PART_OF /
  //   TAGGED_WITH / RELATED_TO ARE the graph-native artifact of the connective
  //   taxonomy layer (Canon Part 9: files preserve meaning, SQL remembers and
  //   navigates).
  // Canon Part 8: properties are ENUM/scalar ONLY (the taxonomy node id + a
  //   relation enum); never prose, never a domain/trend BODY. These edges are
  //   LOCAL room.db edges; writeEdge takes (db, params) over a LOCAL room.db
  //   handle; DECOMPOSED_INTO / PART_OF / TAGGED_WITH / RELATED_TO never cross to
  //   Brain. Cross-room aggregation forbidden.
  'DECOMPOSED_INTO',
  'PART_OF',
  'TAGGED_WITH',
  'RELATED_TO',
  // Phase 168-01 extension (Part 4 edge-vocabulary RECONCILIATION; the three
  // Part-4-blessed cascade edges the Part 9 chokepoint frozen set was MISSING).
  // Added ADDITIVELY to this closed allow-list, never invented per-phase --
  // mirrors the Phase 163-01 DECOMPOSED_INTO / PART_OF / TAGGED_WITH / RELATED_TO
  // additive idiom verbatim. The floor (DEFERRED / REJECTED + every prior type)
  // is byte-identical except these three additions; tests assert a FLOOR + named
  // membership, never an exact count, so this cannot regress baseline.
  //
  // This is a RECONCILIATION, not a net-new vocabulary expansion. Canon Part 4
  //   PROSE has ALWAYS declared the cascade edges INFORMS / CONTRADICTS /
  //   CONVERGES / INVALIDATES / ENABLES, and the legacy lib/core/lazygraph-ops.cjs
  //   path (the Phase 84 cascade path) ALREADY writes all three. But this Part 9
  //   writeEdge chokepoint frozen set carried only INFORMS (line 127) + CONTRADICTS
  //   (line 153) and never caught up on CONVERGES / INVALIDATES / ENABLES -- so
  //   writeEdge rejected three edges the canon already blessed. This block brings
  //   the code into line with the already-blessed prose (Canon Part 6 dog-fooding:
  //   the plugin must honor its own canon; the drift was a self-CONTRADICTS this
  //   phase resolves). Phase 164's issue-tree must emit INVALIDATES / ENABLES via
  //   THIS chokepoint, so closing the drift was a blocking prerequisite.
  //
  // NAVIGATOR-GATED Canon Part 4 + Phase 108 amendment (D-168, navigator-LOCKED
  //   2026-06-18). Unlike the routine additive-without-amendment idiom above, this
  //   trio MOVES A FROZEN CONSTITUTIONAL SET: a navigator ratified the closed-set
  //   reconciliation at a blocking checkpoint BEFORE these bytes landed, mirroring
  //   the Phase 163 D-163-03 quad and the Phase 150.8 D-150.8 trio. BELONGS_TO is
  //   NOT added (the Phase 164 issue-tree REMAPS it to PART_OF, the structural
  //   edge Phase 163 already froze); the lazygraph-ops.cjs legacy-array
  //   two-vocabulary unification (HSI_CONNECTION / REVERSE_SALIENT / RESOLVES_VIA
  //   etc.) is a deferred follow-on, OUT of scope here.
  //
  //   CONVERGES   -- the convergence cascade edge (CLAUDE.md cross-relationship
  //     rule 3): this artifact's themes appear in 3+ other sections. Source = the
  //     converging artifact, target = a section/node the theme converges on.
  //
  //   INVALIDATES -- the assumption-stale cascade edge (CLAUDE.md rule 4): this
  //     artifact makes an existing assumption stale. Source = the invalidating
  //     artifact, target = the now-stale assumption.
  //
  //   ENABLES     -- the unblocks cascade edge (CLAUDE.md rule 5): this artifact
  //     unblocks something in another section. Source = the enabling artifact,
  //     target = the unblocked node/section.
  //
  // Canon Part 4: every choice is graph data; CONVERGES / INVALIDATES / ENABLES
  //   ARE the graph-native artifact of the cross-relationship scan (Canon Part 9:
  //   files preserve meaning, SQL remembers and navigates).
  // Canon Part 8: properties are ENUM/scalar ONLY (a relation enum + scalar
  //   counts); never prose, never an artifact BODY. These edges are LOCAL room.db
  //   edges; writeEdge takes (db, params) over a LOCAL room.db handle; CONVERGES /
  //   INVALIDATES / ENABLES never cross to Brain. Cross-room aggregation forbidden.
  'CONVERGES',
  'INVALIDATES',
  'ENABLES',
  // Phase 169-00 extension (Graph-Derivation Harness; the room-lineage edge the
  // D-169-11 fractal joint needs to have a LEGAL, graph-navigable frozen-set
  // representation). Added ADDITIVELY to this closed allow-list, never invented
  // per-phase -- mirrors the Phase 168-01 CONVERGES / INVALIDATES / ENABLES
  // additive idiom verbatim. The floor (DEFERRED / REJECTED + every prior type)
  // is byte-identical except this one addition; tests assert a FLOOR + named
  // membership, never an exact count, so this cannot regress baseline.
  //
  // The 8-agent ICM/fractal fan-out (verdict MISSING) proved the joint had no
  //   legal home today: PART_OF (above) is the domain-taxonomy structural edge
  //   whose legal targets are domain / subdomain / focus_area ONLY (consumed by
  //   typed-domain.cjs + get-domains-for-trends.cjs), so a room is an illegal
  //   PART_OF target -- writeEdge checks type-membership but NOT endpoints, so a
  //   room->room PART_OF would write SILENTLY while breaching the frozen-endpoint
  //   contract (a Part 4 self-CONTRADICTS). And BELONGS_TO is NOT a member of this
  //   navigation frozen set at all (it lives only in the legacy lazygraph
  //   EDGE_TYPES array, written via raw SQL, not this chokepoint), so a child-room
  //   BELONGS_TO parent-room via navigation.writeEdge would be REJECTED
  //   (invalid_edge_type). NESTED_WITHIN is the clean LEGAL representation: a NEW
  //   dedicated lineage type, NOT a widening of PART_OF endpoints, so room-lineage
  //   walks never pollute the domain-taxonomy traversals.
  //
  // NAVIGATOR-GATED Canon Part 4 + Phase 108 amendment (D-169-11, navigator-LOCKED
  //   / ratified as option-a 2026-06-19). Unlike the routine additive-without-
  //   amendment idiom above, this MOVES A FROZEN CONSTITUTIONAL SET: a navigator
  //   ratified the closed-set move (mint NESTED_WITHIN, NOT a PART_OF widening,
  //   NOT BELONGS_TO) at a blocking checkpoint BEFORE these bytes landed, mirroring
  //   the Phase 168 D-168 reconciliation, the Phase 163 D-163-03 quad, and the
  //   Phase 150.8 D-150.8 trio.
  //
  //   NESTED_WITHIN -- the room-lineage edge. Source = a healed / born CHILD room
  //     node id (room:<child-slug>), target = its PARENT room node id
  //     (room:<parent-slug>). It is the graph-navigable fractal joint (D-169-11):
  //     a graph walk traverses the nested hierarchy up to the parent and
  //     (read-side, via the rollup) down to children, expressing the ICM / Simon
  //     nested-near-decomposable-hierarchy claim directly (the nested folder
  //     hierarchy IS the graph). Plans 04 (the rollup walk) + 07 (the heal lineage
  //     edge) BOTH consume this type, so it lands Wave 1, before any consumer.
  //
  // Canon Part 4: every choice is graph data; NESTED_WITHIN IS the graph-native
  //   artifact of the room-lineage joint (Canon Part 9: files preserve meaning,
  //   SQL remembers and navigates).
  // Canon Part 8: properties are ENUM/scalar ONLY (a relation enum + the parent
  //   slug handle, e.g. { relation:'nested', parent:'<parent-slug>' }); never
  //   prose, never a room/artifact BODY. NESTED_WITHIN is a LOCAL room.db edge in
  //   the child's db; writeEdge takes (db, params) over a LOCAL room.db handle;
  //   NESTED_WITHIN never crosses to Brain. Cross-room aggregation of the edge is
  //   forbidden.
  'NESTED_WITHIN',
  // Phase 205-02 extension (Larry-Loop Elevation FUSION substrate; the ONE additive
  // cross-frame edge the horizontal-elevation move needs -- decision D-Q5 /
  // 205-CONTEXT.md graph-readiness gap-2). Added ADDITIVELY to this closed
  // allow-list, never invented per-phase -- mirrors the Phase 169-00 NESTED_WITHIN
  // additive idiom verbatim. The floor (DEFERRED / REJECTED + every prior type) is
  // byte-identical except these two additions; tests assert a FLOOR + named
  // membership, never an exact count, so this cannot regress baseline. This is the
  // SAME additive idiom the CONTRADICTS (line 153) / SELECTED_REACH (line 210)
  // members were grown by -- 205-CONTEXT.md names them as the precedent.
  //
  // The FUSION cross-frame move (plan 205-07) is the measured highest-value gap:
  //   Larry is strong within-frame (vertical) but weak across-frames (5 Test-6
  //   horizontal misses). These two edges give the horizontal move a graph-native
  //   home so the connection becomes graph data (Canon Part 4) instead of prose.
  //
  //   SHARES_JOB   -- D-Q5 gap-2. The horizontal-move edge: two Frame nodes SHARE
  //     THE SAME JTBD JOB (the containing-system signal that the navigator's two
  //     separate ideas may be one argument). Source + target are Frame node ids
  //     (frame:<sid>:<hash>, minted by typed-frame.cjs); the shared-job signal is
  //     what the cross-frame synthesis writes when it detects the same underlying
  //     job across two open frames.
  //
  //   ELEVATES_TO  -- D-Q5 gap-2. The frame-to-containing-system edge: when the
  //     horizontal move NAMES the system that contains both frames, it writes an
  //     ELEVATES_TO edge FROM a Frame node TO the containing-system node it was
  //     elevated to. The directed "this frame elevates to that containing system"
  //     edge that makes the elevation path queryable as graph paths.
  //
  // Canon Part 4: every choice is graph data; SHARES_JOB / ELEVATES_TO ARE the
  //   graph-native artifact of the horizontal cross-frame elevation decision (Canon
  //   Part 9: files preserve meaning, SQL remembers and navigates).
  // Canon Part 8: properties are ENUM/scalar ONLY (a job enum/hash handle + a
  //   confidence scalar + a generated decision handle); never prose, never a frame
  //   or conversation BODY. These are LOCAL room.db edges; writeEdge takes
  //   (db, params) over a LOCAL room.db handle; SHARES_JOB / ELEVATES_TO NEVER
  //   cross to Brain (Frame membership + its edges are LOCAL only). Cross-room
  //   aggregation forbidden.
  'SHARES_JOB',
  'ELEVATES_TO',
  // Phase 195-04 extension (Fractal Cross-Room Memory; FCM-11 -- the ONE net-new
  // frozen-set member this phase mints). Added ADDITIVELY beside NESTED_WITHIN and
  // the Phase-205 SHARES_JOB / ELEVATES_TO pair, never clobbering them -- the floor
  // (DEFERRED / REJECTED + every prior type) asserts named MEMBERSHIP, never an exact
  // count, so this additive change cannot regress the baseline (and cannot race the
  // concurrent 205 additions to the SAME Set).
  //
  //   UMBILICAL_TO vs NESTED_WITHIN -- the axis contrast (encode it, do not conflate):
  //   NESTED_WITHIN is a parent-child VERTICAL lineage joint. Source = a CHILD room
  //     node (room:<child-slug>), target = its PARENT room node (room:<parent-slug>);
  //     it is a LOCAL edge living in the CHILD's own room.db, expressing the nested
  //     near-decomposable hierarchy (Simon / ICM). It walks UP and DOWN the tree.
  //   UMBILICAL_TO is a PEER-to-peer HORIZONTAL cross-room link. Source =
  //     item_in_room_A, target = item_in_room_B (two SIBLING rooms, no lineage
  //     between them); it is the cross-room cord the F.8 fan-out (Plan 05) consumes.
  //     Unlike NESTED_WITHIN, it does NOT live in a single child's room.db -- it is
  //     the single source of truth at the REGISTRY level (.rooms/cross-room store,
  //     lib/core/cross-room-store.cjs), because a peer edge belongs to neither room
  //     alone. D-03 locks this registry-level single-write-chokepoint placement.
  //
  // Canon Part 4: every choice is graph data; UMBILICAL_TO IS the graph-native
  //   artifact of the cross-room peer link (Canon Part 9: files preserve meaning,
  //   SQL remembers and navigates).
  // Canon Part 8 (the cross-room fence): properties are ENUM/scalar ONLY --
  //   { relevance, signal, linked_at, session_id } -- never prose, never a room /
  //   artifact BODY. UMBILICAL_TO edges are LOCAL to the registry store and NEVER
  //   egress to the Brain; only aggregate scalars cross a boundary (Appendix D
  //   entry 23). This chokepoint validation mirrors writeEdge's ALLOWED_EDGE_TYPES.has
  //   discipline at the registry (.rooms/) level.
  'UMBILICAL_TO',
  // Phase 200-02 extension (RS Engine Spine reconciliation; SEED-030 / D-200-2 --
  // the TWO RS discovery edge types the Part-9 chokepoint frozen set was MISSING).
  // Added ADDITIVELY to this closed allow-list, never invented per-phase -- mirrors
  // the Phase 195-04 UMBILICAL_TO additive idiom verbatim. The floor (DEFERRED /
  // REJECTED + every prior type) is byte-identical except these two additions; tests
  // assert a FLOOR + named membership, never an exact count, so this cannot regress
  // baseline (and cannot race any concurrent addition to the SAME Set).
  //
  // This is a RECONCILIATION, not a net-new vocabulary. The RS dual-tier writers
  //   (rs-neo4j-writer.cjs Tier 1 + rs-sqlite-mirror.cjs Tier 0) emit FIVE edge
  //   types -- DISCOVERED / DERIVED_FROM / ENABLES / AUTHORED_BY / AFFILIATED_WITH.
  //   THREE were already members (DERIVED_FROM line 52, AFFILIATED_WITH line 176,
  //   ENABLES line 422), so rerouting the RS Tier-0 edge writes through the Part-9
  //   navigation.writeEdge chokepoint (mirroring lib/core/breakthrough/schema.cjs:
  //   nodes via lazygraph, edges via navigation.writeEdge) was rejected only for the
  //   remaining two. This block lands them, closing the drift: rs-sqlite-mirror wrote
  //   these edges DIRECTLY to the edges table via lazygraph, bypassing the chokepoint
  //   (a Part-9 gap the recon flagged). Wave 1 mints the types before Wave 2's reroute
  //   consumes them (same land-type-before-consumer idiom as NESTED_WITHIN line 471).
  //
  // NAVIGATOR-GATED Canon Part 4 + Phase 108 amendment (D-200-2, navigator-ratified
  //   via the "Extend navigation vocab" blocking checkpoint 2026-07-01). Unlike the
  //   routine additive-without-amendment idiom, this MOVES A FROZEN CONSTITUTIONAL
  //   SET: the navigator ratified minting exactly DISCOVERED + AUTHORED_BY BEFORE these
  //   bytes landed, mirroring the Phase 168 D-168 reconciliation and the Phase 169-00
  //   NESTED_WITHIN mint.
  //
  //   DISCOVERED   -- the discovery-surfaces-a-salient edge. Source = an RSDiscovery
  //     node (rsd-<hash>), target = the ReverseSalient node (rs-<hash>) it surfaced.
  //     The root edge of the RS discovery sub-graph.
  //
  //   AUTHORED_BY  -- the paper-authored-by-author edge. Source = a Paper node,
  //     target = an Author node (name|orcid composite id). Makes the expert graph
  //     (SEED-030) walkable from a discovery's papers to their authors.
  //
  // Canon Part 4: every choice is graph data; DISCOVERED / AUTHORED_BY ARE the
  //   graph-native artifact of the reverse-salient discovery (Canon Part 9: files
  //   preserve meaning, SQL remembers and navigates).
  // Canon Part 8: properties are ENUM/scalar ONLY (the RS deterministic node-id
  //   handles + a schema_version scalar); never prose, never a paper/abstract BODY.
  //   Author/Paper/Institution are LOCAL per the D-200-2 local-only expert-graph
  //   resolution. writeEdge takes (db, params) over a LOCAL room.db handle;
  //   DISCOVERED / AUTHORED_BY never cross to Brain. Cross-room aggregation forbidden.
  'DISCOVERED',
  'AUTHORED_BY',
  // Phase 189-01 extension (HITL Memory Governance; SEED-040 / HMG-08 -- the THREE
  // net-new governance-bookkeeping edge types the human-in-the-loop memory-write path
  // needs). Added ADDITIVELY to this closed allow-list, never invented per-phase --
  // mirrors the Phase 195-04 UMBILICAL_TO / Phase 205-02 SHARES_JOB / ELEVATES_TO
  // additive idiom verbatim (the LIGHTER additive-comment-only idiom, not the
  // navigator-gated blocking-checkpoint ceremony: SEED-040's Provenance line already
  // records navigator-direction 2026-06-30, Shape-F explainer session, and the two most
  // recent precedents 195-04 / 205-02 used this lighter idiom). The floor (DEFERRED /
  // REJECTED + every prior type) is byte-identical except these three additions; the
  // floor test asserts named MEMBERSHIP, never an exact `.size` / count, so this cannot
  // regress baseline (and cannot race any concurrent addition to the SAME Set).
  //
  // These are the F.8/F.9 memory-governance edges (Phase 188 F.8/F.9 shipped; Phase 189
  //   repoints them at the general memory-write path per SEED-040). MEMORY_LAYER is NOT
  //   a fourth edge type: it does not read as a directed relationship between two nodes,
  //   it reads as an attribute of WHERE a memory lives, so it rides as the enum-scalar
  //   `memory_layer` PROPERTY on ATTRIBUTED_TO (values within-session | across-session |
  //   cross-room, reusing the exact three strings the shipped /mos:memory three-layer
  //   model already uses). Exactly THREE edge types are minted, not four.
  //
  //   REMEMBERED_AS          -- the "this got durably filed" governance-bookkeeping edge.
  //     Source = the candidate / proposed node id, target = the section or typed node it
  //     was filed as. Written when a human confirms a candidate and it lands durably.
  //
  //   ATTRIBUTED_TO          -- the WHO-decided edge. Source = the same candidate node id,
  //     target = a session / persona identity handle (e.g. session:<id>). Carries the WHO
  //     decision plus the `memory_layer` enum property. WHO is an explicit choice, never a
  //     silent default.
  //
  //   NOT_REMEMBERED_BECAUSE -- the rejection-as-data edge (Canon Part 4: "why not" is
  //     graph data). Source / target = the SAME pair REMEMBERED_AS would have used had the
  //     confirm toggle been ON. Mirrors the REJECTED_BECAUSE (line 128) /
  //     NOT_LINKED_BECAUSE precedent: a declined candidate records WHY so the next
  //     memory-ranking pass learns what not to surface.
  //
  // Canon Part 4: every choice is graph data; REMEMBERED_AS / ATTRIBUTED_TO /
  //   NOT_REMEMBERED_BECAUSE ARE the graph-native artifact of the human-in-the-loop
  //   memory-governance decision (Canon Part 9: files preserve meaning, SQL remembers
  //   and navigates; only a human confirms a truth-claim node).
  // Canon Part 8: properties on all three are ENUM / scalar ONLY (a reason enum, a
  //   memory_layer enum, a section / session handle); NEVER prose, NEVER a candidate /
  //   artifact BODY. These are LOCAL room.db edges; writeEdge takes (db, params) over a
  //   LOCAL room.db handle; REMEMBERED_AS / ATTRIBUTED_TO / NOT_REMEMBERED_BECAUSE NEVER
  //   cross to Brain. Cross-room aggregation forbidden.
  'REMEMBERED_AS',
  'ATTRIBUTED_TO',
  'NOT_REMEMBERED_BECAUSE',
  // Phase 218-01 extension (Entity Extraction Pipeline; D-02 -- the THREE
  // domain-relationship edge types the entity extractor needs to wire
  // company / technology / market nodes to each other and to their source
  // artifacts). Added ADDITIVELY to this closed allow-list, never invented
  // per-phase -- mirrors the Phase 189-01 REMEMBERED_AS / ATTRIBUTED_TO /
  // NOT_REMEMBERED_BECAUSE additive idiom verbatim (the LIGHTER additive-
  // comment-only idiom, not the navigator-gated blocking-checkpoint ceremony;
  // this is a routine additive vocabulary extension, the same lighter idiom the
  // two most recent precedents 195-04 / 189-01 used). The floor (DEFERRED /
  // REJECTED + every prior type) is byte-identical except these three additions;
  // the floor test asserts named MEMBERSHIP, never an exact `.size` / count, so
  // this cannot regress baseline (post-phase count = 40, satisfying REQ-2's
  // ">= 40 entries").
  //
  //   COMPETES_WITH  -- the rivalry edge. Source = a company / technology node,
  //     target = the rival company / technology it competes with. Makes the
  //     competitive landscape queryable as graph paths.
  //
  //   USES_COMPONENT -- the dependency edge. Source = a company / technology
  //     node, target = the technology / component it uses. The directed "this
  //     entity is built on that component" edge.
  //
  //   SUPPLIES_TO    -- the supply-chain edge. Source = a supplier company,
  //     target = the company it supplies. The directed "this supplier feeds
  //     that customer" edge.
  //
  // Canon Part 4: every choice is graph data; COMPETES_WITH / USES_COMPONENT /
  //   SUPPLIES_TO ARE the graph-native artifact of the entity-relationship
  //   extraction (Canon Part 9: files preserve meaning, SQL remembers and
  //   navigates).
  // Canon Part 8: properties are ENUM / scalar ONLY (a relation enum + scalar
  //   handles); NEVER prose, NEVER an artifact / entity BODY. These are LOCAL
  //   room.db edges; writeEdge takes (db, params) over a LOCAL room.db handle;
  //   COMPETES_WITH / USES_COMPONENT / SUPPLIES_TO NEVER cross to Brain.
  //   Cross-room aggregation forbidden.
  //
  // Emitted by: lib/core/navigation/typed-entity.cjs linkEntityRelations, which
  //   constrains its accepted set to the ENTITY_EDGE_SUBSET {COMPETES_WITH,
  //   USES_COMPONENT, SUPPLIES_TO} plus the already-existing DESCRIBES artifact-
  //   link type -- a subset of this allow-list, so this Set stays the single
  //   source of truth for the predicate vocabulary.
  'COMPETES_WITH',
  'USES_COMPONENT',
  'SUPPLIES_TO',
  // Quick task 260725-9ca extension (Local Reified-Claim Events; the ONE net-new
  // edge type the ContradictionEvent primitive needs). Added ADDITIVELY to this
  // closed allow-list, never invented per-phase -- mirrors the Phase 218-01
  // COMPETES_WITH / USES_COMPONENT / SUPPLIES_TO additive idiom verbatim (the
  // LIGHTER additive-comment-only idiom; this is a routine additive vocabulary
  // extension, not a navigator-gated blocking-checkpoint ceremony). The floor
  // (DEFERRED / REJECTED + every prior type) is byte-identical except this one
  // addition; the floor test asserts named MEMBERSHIP, never an exact `.size` /
  // count, so this cannot regress baseline.
  //
  //   CONCERNS -- the event-to-claim "this event is about that claim" edge. It is
  //     the FIRST link a reified event node needs: no existing edge type means
  //     "this event concerns that claim" (INFORMS is too weak, PART_OF is domain
  //     taxonomy, DESCRIBES is artifact-link). Source = a ContradictionEvent node
  //     (event:contradictionevent:<hash>), target = its `claim` participant (a
  //     typed_claim node, type='claim'). Minted by
  //     lib/core/navigation/reified-claim.cjs writeContradictionEvent.
  //
  // Edge vocabulary decision (260725-9ca-CONTEXT.md, LOCKED): CONTRADICTS (already
  //   a member at line 153) is REUSED VERBATIM for the event-to-rivalClaim link.
  //   NO CONTRADICTED_BY type is minted -- it would be a near-duplicate of an edge
  //   type that already means exactly this. So this block adds exactly ONE new
  //   member (CONCERNS), and the rivalClaim link rides the pre-existing CONTRADICTS.
  //
  // Canon Part 8: properties on CONCERNS are ENUM/scalar ONLY (a relation enum +
  //   the event-node id handle, e.g. { relation:'concerns', event:'event:...' });
  //   NEVER prose, NEVER a claim BODY. This is a LOCAL room.db edge; writeEdge
  //   takes (db, params) over a LOCAL room.db handle; CONCERNS NEVER crosses to
  //   Brain (Canon Part 8 LOCAL -> BRAIN: NO). Cross-room aggregation forbidden.
  'CONCERNS',
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
// Phase 224-01 (D-05) additive extension: writeEdge gains an OPTIONAL
// review_status param. When present it must be exactly 'proposed' or 'confirmed'
// (the derivation writer passes 'proposed'; a future human-confirm path passes
// 'confirmed'), else the write is rejected (reason: invalid-review-status).
// When ABSENT it binds NULL -- so every pre-224 caller is byte-compatible (their
// edges stay review_status NULL, the "not-a-proposal" state documented in the
// phase-224-edge-review-status migration header).
//
// THE UPSERT INVARIANT (Req 4 / the Ralph invariant): review_status is set at
// FIRST INSERT ONLY. The ON CONFLICT clause updates properties ONLY and NEVER
// touches review_status -- so a re-derivation never downgrades a 'confirmed'
// edge and never demotes a NULL legacy edge. No writer can promote or demote an
// existing row through this path; 'confirmed' stays a separate byUser path.
//
// Phase 224 review (WR-06) extension: the properties update is ALSO withheld
// when the existing row is 'confirmed' (DO UPDATE ... WHERE review_status IS
// NOT 'confirmed'). Phase 224's automatic background deriver upserts the same
// (source, target, type) key space humans ratify; without the guard a
// re-derivation replaced a confirmed edge's whole properties JSON (decision
// handles, TV-01 validity scalars) with {relation:'derived', ...}. The
// review_status invariant is thereby mirrored onto properties for confirmed
// rows. NULL (legacy) and 'proposed' rows keep the pre-224 update-on-conflict
// contract, byte-compatible with every pre-224 caller.
const VALID_REVIEW_STATUS = Object.freeze(new Set(['proposed', 'confirmed']));

function writeEdge(db, params) {
  if (!params || typeof params !== 'object') {
    return { ok: false, reason: 'invalid_params' };
  }
  const { source_id, target_id, edge_type, properties, review_status } = params;
  if (typeof source_id !== 'string' || source_id.length === 0) {
    return { ok: false, reason: 'invalid_source_id' };
  }
  if (typeof target_id !== 'string' || target_id.length === 0) {
    return { ok: false, reason: 'invalid_target_id' };
  }
  if (typeof edge_type !== 'string' || !ALLOWED_EDGE_TYPES.has(edge_type)) {
    return { ok: false, reason: 'invalid_edge_type', detail: String(edge_type).slice(0, 40) };
  }
  // Optional review_status: absent binds NULL; present must be in the enum.
  let reviewStatusValue = null;
  if (review_status !== undefined && review_status !== null) {
    if (typeof review_status !== 'string' || !VALID_REVIEW_STATUS.has(review_status)) {
      return { ok: false, reason: 'invalid_review_status', detail: String(review_status).slice(0, 40) };
    }
    reviewStatusValue = review_status;
  }
  // 'confirmed' is the HUMAN-trust state (Canon Part 9: only a human confirms;
  // the migration header reserves it for the explicit byUser confirmation
  // path). The chokepoint ENFORCES that here instead of leaving it to
  // convention: a first-insert 'confirmed' requires a non-empty byUser handle,
  // recorded as a confirmed_by scalar in properties (mirroring the confirmNode
  // discipline), so a background writer can never mint human-trust edges.
  if (reviewStatusValue === 'confirmed'
    && (typeof params.byUser !== 'string' || params.byUser.trim().length === 0)) {
    return { ok: false, reason: 'confirmed_requires_by_user' };
  }
  const props = isPlainObject(properties) ? Object.assign({}, properties) : {};
  if (reviewStatusValue === 'confirmed') {
    props.confirmed_by = params.byUser.trim();
  }
  let propsJson;
  try {
    propsJson = JSON.stringify(props);
  } catch (_e) {
    return { ok: false, reason: 'properties_serialize_failed' };
  }
  const edgeId = 'edge:' + edge_type + ':' + Date.now() + ':' + crypto.randomBytes(4).toString('hex');
  try {
    db.prepare(
      'INSERT INTO edges (source, target, type, properties, review_status) VALUES (?, ?, ?, ?, ?) ' +
      'ON CONFLICT(source, target, type) DO UPDATE SET properties = excluded.properties ' +
      "WHERE edges.review_status IS NOT 'confirmed'"
    ).run(source_id, target_id, edge_type, propsJson, reviewStatusValue);
  } catch (e) {
    return { ok: false, reason: 'edge_write_failed', detail: String(e.message || '').slice(0, 80) };
  }
  return { ok: true, edge_id: edgeId, type: edge_type, source: source_id, target: target_id };
}

module.exports = { ALLOWED_EDGE_TYPES, writeEdge };
