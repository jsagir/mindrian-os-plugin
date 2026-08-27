'use strict';
// Phase 109 navigation chokepoint module. The closed 13-function surface per CONTEXT D-05.
// Every other module that touches the graph goes through this API. The Plan 109-06
// pre-commit hook fails any new code that requires lib/core/room-db.cjs directly outside
// the allow-list (this file, lib/core/navigation/*, room-db.cjs self, lazygraph-ops.cjs,
// memory-ops.cjs, opportunity-ops.cjs legacy, tests/, scripts/migrate-).
//
// Canon Part 7: single chokepoint module re-exporting the closed surface; a 14th export
// (note: closed surface is the documented 13-function API; the implementation module here
// re-exports those plus internal helpers as needed) requires canon amendment.
// Canon Part 9: navigation IS the local mind; this is the only module callers should
// require for graph reads, ranking, packet building, and truth-state promotion.
//
// Phase 125-00 amendment (Pass 3 GAP-2 resolution): writeEdge added as a thin
// re-export on the navigation surface. Additive extension per the Phase 110-03
// logMemoryEvent precedent (and the Phase 124-01 firstCapturedLastTouchedBySection
// precedent shipped between 110-03 and here). The closed DOCUMENTED 13-function
// API is unchanged in spirit -- additive re-exports of internal helpers are
// needed for the Plan 06 selector-decisions surface to write typed cascade edges
// (DEFERRED / REJECTED per CONTEXT.md D7) without bypassing the chokepoint.
// Canon Part 4 binding: every choice is graph data; writeEdge is the primitive
// that lets the F-selector ranker emit those choices as typed edges.

const focus = require('./navigation/focus.cjs');
const neighborhoodMod = require('./navigation/neighborhood.cjs');
const memoryEvents = require('./navigation/memory-events.cjs');
const transitions = require('./navigation/transitions.cjs');
const insights = require('./navigation/insights.cjs');
const packet = require('./navigation/packet.cjs');
const ingestion = require('./navigation/ingestion.cjs');
const roomHome = require('./navigation/room-home.cjs');
const edges = require('./navigation/edges.cjs');
const dashboardHelpers = require('./navigation/dashboard-helpers.cjs');
const spineEvents = require('./navigation/spine-events.cjs');
const confirmNodeMod = require('./navigation/confirm-node.cjs');
const lensNodes = require('./navigation/lens-nodes.cjs');
const evidenceClaim = require('./navigation/evidence-claim.cjs');
const researchPreflight = require('./navigation/research-preflight.cjs');
const roomContext = require('./navigation/room-context.cjs');
const fileEvidenceReadback = require('./navigation/file-evidence-readback.cjs');
const planningArtifacts = require('./navigation/planning-artifacts.cjs');
const memoryArtifacts = require('./navigation/memory-artifacts.cjs');
const typedClaim = require('./navigation/typed-claim.cjs');
const typedOpenQuestion = require('./navigation/typed-open-question.cjs');
const abstractionClaim = require('./navigation/abstraction-claim.cjs');
const reconcileGuard = require('./navigation/reconcile-guard.cjs');
const typedDomain = require('./navigation/typed-domain.cjs');
const typedEntity = require('./navigation/typed-entity.cjs');
const reifiedClaim = require('./navigation/reified-claim.cjs');
const typedOpportunity = require('./navigation/typed-opportunity.cjs');
const typedFrame = require('./navigation/typed-frame.cjs');
const syntheticExpert = require('./navigation/synthetic-expert.cjs');
const getDomainsForTrends = require('./navigation/get-domains-for-trends.cjs');
const memoryOps = require('./memory-ops.cjs');
const roomBirth = require('./navigation/room-birth.cjs');
const grantRubric = require('./navigation/grant-rubric.cjs');
const pointInTime = require('./temporal/point-in-time.cjs');
const graphExport = require('./navigation/graph-export.cjs');
const calibrationLog = require('./navigation/calibration-log.cjs');
const twoGauge = require('./meter/two-gauge.cjs');
const governance = require('./navigation/governance.cjs');
const rankerWeights = require('./navigation/ranker-weights.cjs');

function notImplementedYet(name, plan) {
  return function () {
    throw new Error('not_implemented_yet:' + name + ':' + plan + ' - the closed 13-function navigation surface is established by Plan 109-04; this stub will be replaced by ' + plan);
  };
}

module.exports = {
  // Focus (Plan 109-02 LIVE).
  getActiveFocus: focus.getActiveFocus,
  setFocus: focus.setFocus,

  // Neighborhood (Plan 109-04 LIVE).
  getNeighborhood: neighborhoodMod.getNeighborhood,

  // Insight queries (Plan 109-05 LIVE; Plan 116-01 added findSurfaceableTensions).
  findContradictions: insights.findContradictions,
  findUnsupportedClaims: insights.findUnsupportedClaims,
  findBlockingAssumptions: insights.findBlockingAssumptions,
  findStaleDecisions: insights.findStaleDecisions,
  // Generalized stale detection (Phase 160-05 -- R10; additive re-export alongside
  //   findStaleDecisions. findStaleClaims generalizes the single 30-day stale
  //   computation to {claim, assumption, opportunity, decision} with a configurable
  //   window, keyed on last_modified_at (Plan 04 write-time stamp, not last_seen_at).
  //   findStaleDecisions is UNCHANGED for back-compat. Canon Part 8: LOCAL SQL only.)
  findStaleClaims: insights.findStaleClaims,
  findOpenQuestions: insights.findOpenQuestions,
  findSurfaceableTensions: insights.findSurfaceableTensions,
  // Transitive support closure (Phase 270-10 -- MEMOP-07; RESEARCH.md 3.3
  //   candidate 2, the recursive-CTE upgrade of the single-hop
  //   findUnsupportedClaims). Same thin additive-re-export idiom as every
  //   insights.* export above.
  findTransitiveSupport: insights.findTransitiveSupport,

  // findRecentChanges (Plan 109-03 LIVE).
  findRecentChanges: memoryEvents.findRecentChanges,

  // Opportunity ranking (Plan 109-05 LIVE).
  findRelevantOpportunities: insights.findRelevantOpportunities,

  // Brain integration (Plan 109-07 LIVE; Plan 109-08 LIVE).
  buildBrainPacket: packet.buildBrainPacket,
  storeBrainSuggestions: ingestion.storeBrainSuggestions,

  // Room Home (Plan 109-09 LIVE - 13th and LAST live export; navigation.cjs surface COMPLETE).
  getRoomHomeView: roomHome.getRoomHomeView,

  // Truth-state chokepoint (Plan 109-04 LIVE).
  promoteNodeStatus: transitions.promoteNodeStatus,

  // Memory-event logging (Phase 110-03 -- a thin re-export so brain-client.cjs can log the
  //   brain_packet_rejected / brain_response_rejected / brain_legacy_path_used events without
  //   reaching into the internal navigation/memory-events.cjs. The closed navigation surface is
  //   the DOCUMENTED 13-function API; the implementation re-exports internal helpers as needed.)
  logMemoryEvent: memoryEvents.logEvent,

  // Calibration shadow-log writer (Phase 177-05 -- BCH-04; a thin additive
  //   re-export so the keypress AUDIT path (BCH-REG-AUDIT) and Wave-3 callers
  //   reach the dedicated LOCAL calibration row store through the navigation
  //   chokepoint, never a direct require of the calibration writer module.
  //   logCalibrationObservation writes ONE row (below-floor cues are logged with
  //   cue_disposition 'discarded', NOT dropped) + optionally emits ONE scalar
  //   audit-marker memory_event. SHADOW-ONLY: it logs, it does not fire; no reach
  //   is minted, routing_source stays legacy. Canon Part 8: the row store is a
  //   DEDICATED LOCAL table, structurally invisible to buildBrainPacket (the
  //   BCH-14 egress fence holds by construction); the audit marker carries scalars
  //   + enum handles only, never a row body, never crosses to Brain. Same thin
  //   additive-re-export idiom as logMemoryEvent / writeEdge / getRoomContext.)
  logCalibrationObservation: calibrationLog.logCalibrationObservation,

  // First-captured / last-touched scalars by section (Phase 124-01 -- a thin re-export so
  //   lib/core/feynman/timeline-renderer.cjs can compose its D-05 summary line over the
  //   memory_event log without reaching into the internal navigation/insights.cjs. The closed
  //   navigation surface is the DOCUMENTED 13-function API; the implementation re-exports
  //   internal helpers as needed -- same pattern as the Phase 110-03 logMemoryEvent re-export.)
  firstCapturedLastTouchedBySection: insights.firstCapturedLastTouchedBySection,

  // Governance candidate query (Phase 189-02 -- HMG-01; additive re-export so the
  //   governance-candidate-raiser (Task 2) reaches the closed truth-claim candidate
  //   SELECT through the navigation chokepoint instead of a direct room.db open. The
  //   query reuses transitions.TRUTH_CLAIM_TYPES (single source of truth) and reads
  //   the EXISTING n.confidence brain_consult signal -- it mints no new reach. Same
  //   thin additive-re-export idiom as logMemoryEvent / firstCapturedLastTouchedBySection /
  //   writeEdge.)
  findGovernanceCandidates: governance.findGovernanceCandidates,

  // Edge-write primitive (Phase 125-00 -- Pass 3 GAP-2 resolution; D7 typed cascade edge
  //   surface for F.1 defer / F.2 reject. Allowlist gated on ALLOWED_EDGE_TYPES Set in
  //   navigation/edges.cjs. Plan 06 selector-decisions.cjs is the first consumer; Phase
  //   116/117/118 will extend the allowlist additively for tension / auto-explore /
  //   MVA edges. Same additive-re-export pattern as logMemoryEvent + firstCapturedLastTouchedBySection.)
  writeEdge: edges.writeEdge,

  // Planning-artifact writers (Phase 149-01 -- GAM-01 / GAM-03 / GAM-04;
  //   additive re-export so the reconcile (Plan 02) + writer hook (Plan 03) reach
  //   the planning_artifact + requirement node writers and the typed-lineage-edge
  //   writer through the navigation chokepoint, never a direct room.db open
  //   (Canon Part 9 substrate guard). writePlanningArtifactNode +
  //   writeRequirementNode are SYSTEM-BOOKKEEPING writes under the Part 9 v1.5
  //   audit-node carve-out (created_by=system review_status=confirmed). The
  //   writers take (db, params) over a caller-owned room.db handle, so this file
  //   stays the single door. writeLineageEdge constrains to the LINEAGE subset
  //   {FEEDS_INTO, VALIDATES, INFORMS} of edges.cjs ALLOWED_EDGE_TYPES -- it adds
  //   no new taxonomy member. Same additive-re-export pattern as logMemoryEvent /
  //   firstCapturedLastTouchedBySection / writeEdge / detectActiveRoom.)
  writePlanningArtifactNode: planningArtifacts.writePlanningArtifactNode,
  writeRequirementNode: planningArtifacts.writeRequirementNode,
  writeLineageEdge: planningArtifacts.writeLineageEdge,
  ARTIFACT_TYPES: planningArtifacts.ARTIFACT_TYPES,
  ARTIFACT_NODE_ID: planningArtifacts.ARTIFACT_NODE_ID,
  REQUIREMENT_NODE_ID: planningArtifacts.REQUIREMENT_NODE_ID,

  // Memory-cortex writers (Phase 150-01 -- MEM-01 / MEM-02 / MEM-07; additive
  //   re-export so the reconcile + trigger (Plan 03), the local-consumption +
  //   orphans (Plan 04), the spine connector (Plan 05), and the selector
  //   graph-drive (Plan 06) reach the memory_artifact / governing_thought /
  //   navigator_persona / decision node writers and the cortex-lineage-edge
  //   writer through the navigation chokepoint, never a direct room.db open
  //   (Canon Part 9 substrate guard). writeMemoryArtifactNode +
  //   writeGoverningThoughtNode + writeNavigatorPersonaNode are SYSTEM-BOOKKEEPING
  //   writes under the Part 9 v1.5 audit-node carve-out (created_by=system
  //   review_status=confirmed). writeDecisionNode is the ONE truth-claim writer:
  //   it mints review_status=proposed (NEVER confirmed) -- only the human
  //   confirmNode path promotes a decision. The writers take (db, params) over a
  //   caller-owned room.db handle, so this file stays the single door.
  //   writeCortexLineageEdge constrains to the CORTEX subset
  //   {STATES, SUPPORTS, INFORMS, DESCRIBES} of edges.cjs ALLOWED_EDGE_TYPES -- it
  //   adds no new taxonomy member. Same additive-re-export pattern as the
  //   planning-artifact writers above.)
  writeMemoryArtifactNode: memoryArtifacts.writeMemoryArtifactNode,
  writeGoverningThoughtNode: memoryArtifacts.writeGoverningThoughtNode,
  writeNavigatorPersonaNode: memoryArtifacts.writeNavigatorPersonaNode,
  writeDecisionNode: memoryArtifacts.writeDecisionNode,
  writeCortexLineageEdge: memoryArtifacts.writeCortexLineageEdge,
  MEMORY_KINDS: memoryArtifacts.MEMORY_KINDS,
  MEMORY_ARTIFACT_NODE_ID: memoryArtifacts.MEMORY_ARTIFACT_NODE_ID,
  GOVERNING_THOUGHT_NODE_ID: memoryArtifacts.GOVERNING_THOUGHT_NODE_ID,
  NAVIGATOR_PERSONA_NODE_ID: memoryArtifacts.NAVIGATOR_PERSONA_NODE_ID,
  DECISION_NODE_ID: memoryArtifacts.DECISION_NODE_ID,

  // Typed-claim writer (Phase 150.8-01 -- DIKW-01 / DIKW-03; additive re-export
  //   so the Claimify-style 4-pass meeting extraction (file-meeting.md Step 3,
  //   Plan 03) reaches the truth-claim node writer through the navigation
  //   chokepoint, never a direct room.db open (Canon Part 9 substrate guard).
  //   writeClaimNode is a truth-claim writer: it mints type='claim'
  //   review_status='proposed' (NEVER confirmed); only the confirmNode path with
  //   a human byUser promotes it (Part 9 role 5). A claim is NOT under the v1.5
  //   audit-node carve-out -- it is a real truth claim, unlike memory_event /
  //   focus. The 6-member KNOWLEDGE_TYPES enum gates knowledge_type; conditions /
  //   counter_conditions / valid_from / valid_until ride the properties JSON blob
  //   as ADDITIVE keys (the D-10 precedent), never DDL columns. The writer takes
  //   (db, params) over a caller-owned room.db handle, so this file stays the
  //   single door. Same thin additive-re-export pattern as writeEvidenceClaim /
  //   writeDecisionNode above.)
  writeClaimNode: typedClaim.writeClaimNode,
  KNOWLEDGE_TYPES: typedClaim.KNOWLEDGE_TYPES,
  CLAIM_NODE_ID: typedClaim.CLAIM_NODE_ID,

  // Typed-open-question writer (Phase 223-02 -- Req 4; the net-new
  //   writeOpenQuestionNode that closes the write-side gap for the type the
  //   shipped reader insights.findOpenQuestions has always SELECTed. Additive
  //   re-export so the 223 close-the-loop spine (close-loop-writer.cjs) reaches
  //   the open_question node writer through the navigation chokepoint, never a
  //   direct room.db open (Canon Part 9 substrate guard). An open_question is a
  //   truth-adjacent gap node: it is BORN review_status 'proposed' and is NEVER
  //   auto-confirmed (Part 9 role 5) -- only a human confirmNode promotes it.
  //   The writer takes (db, params) over a caller-owned room.db handle, so this
  //   file stays the single door. Same thin additive-re-export pattern as
  //   writeClaimNode / writeOpportunityNode.)
  writeOpenQuestionNode: typedOpenQuestion.writeOpenQuestionNode,
  OPEN_QUESTION_NODE_ID: typedOpenQuestion.OPEN_QUESTION_NODE_ID,

  // Abstraction-level persistence (Phase 179-05 -- SPEC Req 6; additive re-export
  //   so the Door 3 abstraction gate reaches the property-write helper through the
  //   navigation chokepoint, never a direct room.db open (Canon Part 9 substrate
  //   guard). persistAbstractionLevel writes the chosen abstraction_level
  //   (instances|structure|unsure) as an ADDITIVE property on the EXISTING
  //   hypothesis claim node minted by writeClaimNode -- a read-merge-write on the
  //   SAME nodes row that mints NO new node type and NO edge type and leaves
  //   review_status untouched (Part 9 role 5: the abstraction pick is not a human
  //   promotion). The writer takes (db, params) over a caller-owned room.db handle,
  //   so this file stays the single door. Same thin additive-re-export pattern as
  //   writeClaimNode above. Surfaced on lib/core/abstraction-gate.cjs alongside the
  //   pure 3-option selector. Canon Part 8: LOCAL only, never to Brain.)
  persistAbstractionLevel: abstractionClaim.persistAbstractionLevel,
  normalizeAbstractionLevel: abstractionClaim.normalizeAbstractionLevel,
  ABSTRACTION_KEYS: abstractionClaim.ABSTRACTION_KEYS,

  // Reconcile guard (Phase 194-06 -- PSB-08/09; additive re-export following the
  //   logMemoryEvent / writeEdge / getRoomContext precedent). checkLostUpdate is
  //   the ONE CAS helper (reads last_modified_at over the caller-owned handle,
  //   compares to a caller-held readVersion) so the reconcile-f9-adapter reaches
  //   it through the single door; checkReconcile is the pure comparator. The guard
  //   opens no room.db of its own and carries zero Brain egress (Canon Part 8/9).
  checkLostUpdate: reconcileGuard.checkLostUpdate,
  checkReconcile: reconcileGuard.checkReconcile,

  // Typed-domain writer + edge-linker (Phase 163-02 -- D-163-01 / D-163-04; the
  //   WAVE 2 FOUNDATION-B connective-taxonomy substrate. Additive re-export so the
  //   Wave-3 trend agent + getDomainsForTrendExtrapolation reach the domain /
  //   subdomain / focus_area node writer + the four-edge linker through the
  //   navigation chokepoint, never a direct room.db open (Canon Part 9 substrate
  //   guard). writeDomainNode mints a domain/subdomain/focus_area node: a
  //   truth-claim domain (taxonomy absent/false) lands review_status 'proposed'
  //   (NEVER auto-confirmed, Part 9 role 5); a pure-taxonomy domain (taxonomy:true)
  //   is system-bookkeeping and may carry 'confirmed' (the Part 9 v1.5 audit-node
  //   carve-out spirit -- a taxonomy label asserts no venture truth, like
  //   focus.cjs's focus_changed memory_event). linkDomainToRelated constrains its
  //   accepted set to the DOMAIN_EDGE_SUBSET {DECOMPOSED_INTO, PART_OF, TAGGED_WITH,
  //   RELATED_TO} of edges.cjs ALLOWED_EDGE_TYPES and routes EVERY edge write
  //   through navigation.writeEdge (the chokepoint, never raw SQL) -- it adds no
  //   new taxonomy member. Both take (db, params) over a caller-owned room.db
  //   handle, so this file stays the single door. Same thin additive-re-export
  //   pattern as writeClaimNode / writeCortexLineageEdge / writeLineageEdge.)
  writeDomainNode: typedDomain.writeDomainNode,
  linkDomainToRelated: typedDomain.linkDomainToRelated,
  DOMAIN_NODE_TYPES: typedDomain.DOMAIN_NODE_TYPES,
  DOMAIN_EDGE_SUBSET: typedDomain.DOMAIN_EDGE_SUBSET,
  DOMAIN_NODE_ID: typedDomain.DOMAIN_NODE_ID,

  // Typed-entity writer + edge-linker (Phase 218-01 -- D-01; the WAVE 1 central
  //   slice that gives the graph real domain-entity node types. Additive re-export
  //   so the entity extractor reaches the company / technology / market node writer
  //   + the three-edge linker through the navigation chokepoint, never a direct
  //   room.db open (Canon Part 9 substrate guard). writeEntityNode mints a
  //   company/technology/market node: an entity is a PURE TRUTH-CLAIM, so it ALWAYS
  //   lands review_status 'proposed' and is NEVER auto-confirmed (Part 9 role 5).
  //   CRITICAL CONTRAST with writeDomainNode: the taxonomy -> 'confirmed' promotion
  //   branch is DELIBERATELY OMITTED (REQ-1 + the 218-CONTEXT HITL constraint); an
  //   entity stays 'proposed' forever until a human confirmNode promotes it.
  //   linkEntityRelations constrains its accepted set to the ENTITY_EDGE_SUBSET
  //   {COMPETES_WITH, USES_COMPONENT, SUPPLIES_TO} of edges.cjs ALLOWED_EDGE_TYPES
  //   plus the already-existing DESCRIBES artifact-link type, and routes EVERY edge
  //   write through navigation.writeEdge (the chokepoint, never raw SQL) -- it adds
  //   no new taxonomy member. Both take (db, params) over a caller-owned room.db
  //   handle, so this file stays the single door. Same thin additive-re-export
  //   pattern as writeDomainNode / writeCortexLineageEdge / writeLineageEdge.)
  writeEntityNode: typedEntity.writeEntityNode,
  linkEntityRelations: typedEntity.linkEntityRelations,
  ENTITY_NODE_TYPES: typedEntity.ENTITY_NODE_TYPES,
  ENTITY_EDGE_SUBSET: typedEntity.ENTITY_EDGE_SUBSET,
  ENTITY_NODE_ID: typedEntity.ENTITY_NODE_ID,

  // Reified-claim event writer (quick task 260725-9ca -- the LOCAL, SQLite-native
  //   reified-claim event pattern, starting with ContradictionEvent. Additive
  //   re-export so a caller reaches the event-node writer through the navigation
  //   chokepoint, never a direct room.db open (Canon Part 9 substrate guard). It
  //   mirrors the SHAPE of the Brain-side lib/brain/hypergraph-event-schema.cjs
  //   (a reified event node wired by typed edges to its participants) as a NEW,
  //   SEPARATE, LOCAL-only module that NEVER requires or imports that Brain-side
  //   file -- Canon Part 8 LOCAL -> BRAIN: NO. writeContradictionEvent mints a
  //   'ContradictionEvent' node: it ASSERTS something about the graph, so like an
  //   entity it lands review_status 'proposed' and is NEVER auto-confirmed
  //   (Part 9 role 5); only a human confirmNode promotes it. It wires the event to
  //   its claim participant via a CONCERNS edge (net-new per the Edge vocabulary
  //   decision) and to its rivalClaim via the reused CONTRADICTS edge (no
  //   CONTRADICTED_BY minted), BOTH through navigation.writeEdge (never raw SQL).
  //   Claim / rivalClaim participants are restricted to type='claim' typed_claim
  //   nodes (the Legal participant node types decision). The write is idempotent:
  //   REIFIED_CLAIM_EVENT_ID mints the same deterministic node id for the same
  //   (claim, rivalClaim, evidence, status) tuple. SCOPE (260725-9ca-CONTEXT.md):
  //   primitive + tests only, no wired caller, no update/resolve verb this task.
  //   Takes (db, params) over a caller-owned room.db handle, so this file stays
  //   the single door. Same thin additive-re-export pattern as writeEntityNode /
  //   writeClaimNode.)
  writeContradictionEvent: reifiedClaim.writeContradictionEvent,
  REIFIED_CLAIM_EVENT_ID: reifiedClaim.REIFIED_CLAIM_EVENT_ID,
  REIFIED_EVENT_TYPES: reifiedClaim.REIFIED_EVENT_TYPES,
  PARTICIPANT_NODE_TYPE: reifiedClaim.PARTICIPANT_NODE_TYPE,
  REIFIED_STATUS_VALUES: reifiedClaim.REIFIED_STATUS_VALUES,

  // Typed-opportunity writer + stage machine + evidence-linker (Phase 219-01 --
  //   D-03/D-04/D-17; the REQ-1 eureka-statement-banking substrate. Additive
  //   re-export so the eureka banking pass (and Plans 03/04/05: harvest sensor,
  //   qualification card, explore chain) reach the opportunity node writer
  //   through the navigation chokepoint, never a direct room.db open (Canon
  //   Part 9 substrate guard). writeOpportunityNode mints an 'opportunity'
  //   node: a PURE TRUTH-CLAIM, so it ALWAYS lands review_status 'proposed'
  //   and is NEVER auto-confirmed (Part 9 role 5) - only a human confirmNode
  //   promotes (the Plan 04 Qualify verb). advanceOpportunityStage is the ONLY
  //   legal state-transition door: every lifecycle/stage/outcome move APPENDS
  //   an immutable stage_history entry (D-17: never overwrite prior state).
  //   linkOpportunityEvidence constrains its accepted set to the
  //   OPPORTUNITY_EVIDENCE_EDGE_SUBSET {DERIVED_FROM, SUPPORTS, INFORMS} of
  //   edges.cjs ALLOWED_EDGE_TYPES (D-04 reuse-first: zero net-new edge types)
  //   and routes EVERY edge write through navigation.writeEdge (the chokepoint,
  //   never raw SQL). All take (db, params) over a caller-owned room.db handle,
  //   so this file stays the single door. Same thin additive-re-export pattern
  //   as writeEntityNode / writeDomainNode / writeFrameNode.)
  writeOpportunityNode: typedOpportunity.writeOpportunityNode,
  advanceOpportunityStage: typedOpportunity.advanceOpportunityStage,
  linkOpportunityEvidence: typedOpportunity.linkOpportunityEvidence,
  OPPORTUNITY_NODE_ID: typedOpportunity.OPPORTUNITY_NODE_ID,
  OPPORTUNITY_LIFECYCLES: typedOpportunity.OPPORTUNITY_LIFECYCLES,
  OPPORTUNITY_EVIDENCE_EDGE_SUBSET: typedOpportunity.OPPORTUNITY_EVIDENCE_EDGE_SUBSET,

  // Typed-frame writer (Phase 205-02 -- D-Q5; the FUSION-substrate WAVE 1 net-new.
  //   Additive re-export so the Wave-3 gated FUSION router (plan 205-07) reaches
  //   the first-class Frame node writer through the navigation chokepoint, never a
  //   direct room.db open (Canon Part 9 substrate guard). writeFrameNode mints a
  //   `frame` node recording WHICH section nodes / topics compose each live frame
  //   (D-Q5 navigator override of the derive-do-not-mint lean): membership is a set
  //   of GENERIC member node-id handles carried as additive JSON props, NEVER
  //   conversation prose (Canon Part 8 -- Frame membership is LOCAL room.db only,
  //   ZERO Brain egress). A frame lands review_status 'proposed' by default; a
  //   pure-bookkeeping frame (taxonomy:true) may carry 'confirmed' via the Part 9
  //   v1.5 audit-node carve-out (a composition asserts no venture truth), never a
  //   truth-claim promotion. Takes (db, params) over a caller-owned room.db handle,
  //   so this file stays the single door. Same thin additive-re-export pattern as
  //   writeDomainNode / writeClaimNode.)
  writeFrameNode: typedFrame.writeFrameNode,
  FRAME_NODE_TYPES: typedFrame.FRAME_NODE_TYPES,
  FRAME_NODE_ID: typedFrame.FRAME_NODE_ID,

  // SyntheticExpert writer (Phase 164-02 -- E1 / D-164-S1; the WAVE 2 writer that
  //   mints the reusable-expert graph citizen the Wave-1 amendment froze into the
  //   node taxonomy. Additive re-export so the team-assembly library reader + the
  //   filing flow reach the writer through the navigation chokepoint, never a
  //   direct room.db open (Canon Part 9 substrate guard). writeSyntheticExpertNode
  //   mints a SyntheticExpert truth-claim node at review_status 'proposed' and
  //   NEVER auto-confirms it (Part 9 role 5: the human promotes via confirmNode);
  //   the frozen SYNTHETIC_EXPERT_FIELDS allow-list rejects any non-generic field
  //   forbidden_field before any insert (Part 8 generic-lens-only, the load-bearing
  //   gate -- no venture body ever rides the props). Takes (db, params) over a
  //   caller-owned room.db handle, so this file stays the single door. Same thin
  //   additive-re-export pattern as writeDomainNode / writeClaimNode.)
  writeSyntheticExpertNode: syntheticExpert.writeSyntheticExpertNode,
  SYNTHETIC_EXPERT_FIELDS: syntheticExpert.SYNTHETIC_EXPERT_FIELDS,
  HAT_COLORS: syntheticExpert.HAT_COLORS,
  SYNTHETIC_EXPERT_NODE_ID: syntheticExpert.SYNTHETIC_EXPERT_NODE_ID,

  // Domain-for-trends reader (Phase 163-03 -- D-163-01 / D-163-04; the WAVE 3
  //   FOUNDATION-C graph-walking reader the Wave-4 trend pipeline seeds itself
  //   from. Additive re-export so the trend agent reaches the reader through the
  //   navigation chokepoint. getDomainsForTrendExtrapolation(roomDir, opts) is the
  //   Tier-2 PRIMARY path: when opts.db is supplied AND domain nodes exist, it
  //   WALKS each domain hub via the getNeighborhood chokepoint to its related
  //   nodes (the connective taxonomy made walkable). Tier-0 is a cold-start
  //   stopgap ONLY (no domain nodes): it parses recent explore-domains artifacts
  //   + BRAIN.md concept handles by reusing the shipped parseFrontmatter (Canon
  //   Part 7), a LOCAL read of an already-derived cache -- NEVER a live Brain call
  //   (Canon Part 8 zero Brain egress). The reader carries zero direct room-db /
  //   sqlite require and never opens room.db (caller-owned handle). Same thin
  //   additive-re-export pattern as writeDomainNode / getNeighborhood.)
  getDomainsForTrendExtrapolation: getDomainsForTrends.getDomainsForTrendExtrapolation,

  // Dashboard MVA helpers (Phase 118 Plan 02 -- additive re-export so the
  //   lib/agents/mva/dashboard-graph-neighborhood.cjs agent goes through the
  //   navigation chokepoint per Canon Part 9 D-06 invariant. Same additive-
  //   re-export pattern as logMemoryEvent / firstCapturedLastTouchedBySection /
  //   writeEdge. detectActiveRoom mirrors scripts/brain-derive-command.cjs
  //   line 142 verbatim; getRecentDecisionNeighborhood is a thin wrapper that
  //   resolves the focus node + calls the existing getNeighborhood chokepoint.)
  detectActiveRoom: dashboardHelpers.detectActiveRoom,
  getRecentDecisionNeighborhood: dashboardHelpers.getRecentDecisionNeighborhood,

  // Spine helpers (Phase 129-01 -- the per-event spine API; consumer = the 6
  //   spine scripts (mos-status / suggest-next / act / pipeline / jtbd /
  //   operator / memory) which are NOT in the substrate-guard allow-list and so
  //   must reach room.db ONLY through this chokepoint. Each log* helper takes a
  //   roomDir (never a db handle), opens room.db internally, writes the right
  //   memory_event via logEvent, and closes the handle. getCurrentJTBD /
  //   getCurrentOperator are event-log-authoritative with cache fallback. Same
  //   thin additive-re-export pattern as logMemoryEvent / writeEdge /
  //   detectActiveRoom. Canon Part 9: navigation IS the local mind.)
  logSpineRead: spineEvents.logSpineRead,
  logJtbdTransition: spineEvents.logJtbdTransition,
  logOperatorTransition: spineEvents.logOperatorTransition,
  logWorkflowStage: spineEvents.logWorkflowStage,
  logSuggestionSurfaced: spineEvents.logSuggestionSurfaced,
  getCurrentJTBD: spineEvents.getCurrentJTBD,
  getCurrentOperator: spineEvents.getCurrentOperator,

  // Caller-owned room.db handle (Phase 135-01 -- the door for non-allow-listed
  //   hot-path callers (scripts/intent-classifier.cjs) to obtain a LIVE room.db
  //   handle for roomState.db without requiring room-db.cjs directly. The
  //   F-selector design contract (Phase 125) requires the caller to populate
  //   roomState.db before rankForSelector / shouldExclude / recordSelectorDecision
  //   run. openRoomDbForCaller opens through the allow-listed chokepoint and
  //   returns a handle the caller owns and MUST close via closeRoomDbForCaller in
  //   a finally; returns null when room.db is absent (Tier 0). Same caller-owns-
  //   the-handle pattern as the Phase 130-03 *ByRoomDir helpers and writeEdge's db
  //   contract; same thin additive-re-export pattern as logSpineRead / writeEdge.
  //   Canon Part 9: navigation IS the only door to room.db.)
  openRoomDbForCaller: spineEvents.openRoomDbForCaller,
  closeRoomDbForCaller: spineEvents.closeRoomDbForCaller,

  // Caller-owned READ-ONLY room.db handle (Phase 232.1 -- D-04 corrected. A
  //   second MODE of entry through the SAME chokepoint, never a second
  //   chokepoint. openRoomDbForCaller above is NOT read-only: it delegates to
  //   room-db.cjs::openRoomDb, which mkdirSync's .mindrian/, runs 13 CREATE
  //   TABLE IF NOT EXISTS statements and 5 migrations on EVERY open (reproduced
  //   empirically in 232.1-RESEARCH.md Pitfall 1). That is right for a caller
  //   about to USE the room and wrong for a DIAGNOSTIC caller that must never
  //   mutate what it measures -- the room-graph census would otherwise migrate
  //   every registered room on its first run. Consumer = lib/core/doctor/
  //   room-graph-density-module.cjs. Opens via node:sqlite's file: URI ?mode=ro
  //   form so writes are mechanically rejected and no migration path is
  //   reachable; returns null when room.db is absent (Tier 0). There is NO
  //   sibling close function on purpose: the caller closes this handle through
  //   the pre-existing closeRoomDbForCaller re-export just above, which already
  //   tolerates any bare DatabaseSync. Same thin additive-re-export pattern as
  //   openRoomDbForCaller / logSpineRead / writeEdge. Canon Part 9: navigation
  //   IS the only door to room.db, read or write.)
  openRoomDbReadOnlyForCaller: spineEvents.openRoomDbReadOnlyForCaller,

  // Confirm chokepoint + USER.md identity resolver (Phase 129.5-02 -- D-01 +
  //   D-02; the human-confirms-truth lever made live. confirmNode is the single
  //   APPROVE to promote door: every gate calls it, none call promoteNodeStatus
  //   directly. resolveByUser maps the active room's USER.md navigator identity
  //   to a non-agent byUser (default 'navigator', never larry/brain/system/
  //   assistant). Consumer = the Plan 03 selector dispatcher APPROVE path +
  //   future gates 130 lens-engine accept / 116 tension resolution. Same thin
  //   additive-re-export pattern as logMemoryEvent / writeEdge / logSpineRead;
  //   confirm-node.cjs delegates all writes to promoteNodeStatus. Canon Part 9
  //   v1.5: the human confirms truth; no agent writes a confirmed truth-claim node.)
  confirmNode: confirmNodeMod.confirmNode,
  resolveByUser: confirmNodeMod.resolveByUser,
  // Phase 150.8-04 (DIKW-08): the stable non-agent default byUser, re-exported so
  // the post-filing Confirm-proposed-claims dispatch + its test can assert the
  // coercion result (a poisoned agent-literal USER.md resolves to this default).
  NAVIGATOR_DEFAULT: confirmNodeMod.NAVIGATOR_DEFAULT,

  // Lens-node writers + readers (Phase 130-01 -- the typed HatState +
  //   lens-finding node-write chokepoint for the lens-engine. Consumer = the
  //   Plan 02 lens-engine.cjs (onAccept writes a lens_finding node then an
  //   INFORMS edge FROM it; onReject a REJECTED_BECAUSE edge) and the Plan 03
  //   hat-persistence.cjs rewrite (the 6 filesystem .mindrian/hats/{color}/
  //   STATE.md writes RETIRE to typed HatState nodes in room.db). Each writer
  //   takes a db handle owned by the caller via openRoomDb -- exactly like
  //   writeEdge -- so lens-nodes.cjs carries zero direct room.db open and stays
  //   inside the navigation allow-list. Same thin additive-re-export pattern as
  //   logMemoryEvent / writeEdge / logSpineRead / confirmNode. Canon Part 9 v1.5:
  //   a HatState node is a system-bookkeeping node (the audit-node carve-out),
  //   so created_by='system' review_status='confirmed' is canon-legal without a
  //   human byUser.)
  writeHatState: lensNodes.writeHatState,
  readHatState: lensNodes.readHatState,
  readAllHatStates: lensNodes.readAllHatStates,
  writeLensFinding: lensNodes.writeLensFinding,

  // Lens-node roomDir-taking wrappers (Phase 130-03 -- the door for the rewritten
  //   lib/core/hat-persistence.cjs, which is NOT allow-listed and so may never
  //   require room-db.cjs. These open room.db internally inside lens-nodes.cjs
  //   (legal -- navigation/ is allow-listed) and always close in finally, exactly
  //   like spine-events.cjs log* helpers. hat-persistence requires navigation.cjs
  //   and routes every HatState read/write through these.)
  writeHatStateByRoomDir: lensNodes.writeHatStateByRoomDir,
  readHatStateByRoomDir: lensNodes.readHatStateByRoomDir,
  readAllHatStatesByRoomDir: lensNodes.readAllHatStatesByRoomDir,

  // Research substrate (Phase 131-01 -- the source-lens research pipeline's two
  //   forward-contract surfaces, locked for Phase 136 consumption without a
  //   migration. writeEvidenceClaim is the LOCKED EvidenceClaim node writer (the
  //   Stage 7 ACCEPT path; review_status 'proposed' -- a TRUTH-CLAIM node never
  //   auto-confirmed; the Plan 04 wirer routes APPROVE through confirmNode).
  //   getResearchPreflight is the batched Stage-1 read that collapses the 8
  //   pre-flight inputs into one navigation.cjs round-trip. Both new submodules
  //   take a caller-owned db handle (writeEvidenceClaim) / db + roomDir
  //   (getResearchPreflight) and carry zero direct room.db open -- exactly like
  //   writeEvidenceClaim's sibling lens-nodes writers -- so they stay inside the
  //   navigation allow-list. Consumers: Plan 03 driver, Plan 04 wirer + selector,
  //   Plan 05 command. Same thin additive-re-export pattern as writeHatState /
  //   confirmNode / writeEdge. Canon Part 9 role 5: an EvidenceClaim is a truth
  //   claim, never carved out; only a human APPROVE promotes it to confirmed.)
  writeEvidenceClaim: evidenceClaim.writeEvidenceClaim,
  getResearchPreflight: researchPreflight.getResearchPreflight,

  // Local 3-leg retrieval fusion (Phase 141-03 -- RETR-01/03/04 / D-04a). The
  //   100%-local Context Block reach behind the Capability Dial: getRoomContext
  //   fuses Leg A (getRoomHomeView RAW) + Leg B (windowed getSessionHistory
  //   fragments) + Leg C (getNeighborhood graph-ranking), seeded by the last ~2
  //   conversation turns. Caller-owned db handle; NEVER imports packet.cjs
  //   (raw prose, never a hash -- RETR-03). getSessionHistory is PROMOTED into
  //   this chokepoint (D-04a) so getRoomContext is its first real consumer
  //   through the door rather than calling memory-ops directly; it was formerly
  //   reachable only at memory-ops.cjs's own re-export. Same thin additive-re-
  //   export pattern as logMemoryEvent / writeEdge / writeEvidenceClaim. Canon
  //   Part 8: the output feeds Larry's in-process reasoning, never the wire.
  //   Canon Part 9: navigation IS the local mind.)
  getRoomContext: roomContext.getRoomContext,
  getSessionHistory: memoryOps.getSessionHistory,

  // Read-back-validated evidence filing (Phase 141-04 -- FILEVAL-02 / D-02a /
  //   D-10). The honesty floor on the founding loop's write side: a thin wrapper
  //   over the SHIPPED writeEvidenceClaim + writeEdge that, after writing the
  //   typed EvidenceClaim node + its INFORMS edge in one transaction, READS the
  //   row back and asserts it landed with the expected provenance -- surfacing a
  //   filing that did not land as { ok:false, reason } rather than swallowing it
  //   (the FILEVAL honesty rule, threat T-141-07). It owns NO INSERT INTO nodes;
  //   it wraps, never rebuilds (Canon Part 7). It reserves the additive
  //   artifact_path provenance key (D-10) without touching the 4 LOCKED Phase 136
  //   provenance fields, keeping the deferred Phase 143 MEMDIAL render-from-graph
  //   projection (D-09) possible. Caller-owned db handle; NEVER opens room.db.
  //   Canon Part 9 role 5: the filed node lands review_status 'proposed', never
  //   auto-confirmed. Same thin additive-re-export idiom as writeEvidenceClaim /
  //   writeEdge / getRoomContext. First consumers are deferred (DRSCH execution +
  //   Phase 143 FILEVAL-01), so an unused consumer here is expected, not a smell.
  fileEvidenceWithReadback: fileEvidenceReadback.fileEvidenceWithReadback,
  // FILEVAL-03 (Phase 142): the surfacing layer. Larry SHOWS the read-back
  // result (honesty signal for ok:false; landed-filing recall for ok:true),
  // never swallows it. Pure function, LOCAL recall only (Part 8).
  surfaceFileEvidenceResult: fileEvidenceReadback.surfaceFileEvidenceResult,

  // Birth transaction keystone (Phase 155-02 -- SEED-022; additive re-export so
  //   the ignite.md command (Plan 06) and Plan 05 TUI reach birthRoom through the
  //   navigation chokepoint, never a direct require of room-birth.cjs. birthRoom
  //   is the single orchestrator for the Q1 7-step birth sequence: scaffold +
  //   SQLite transaction + compute-state + registry flip + reconcile + scratchpad
  //   drain. The scaffold-before-registry order is RESEARCH Q1's primary
  //   correction; drainBirthGateAnswers is also re-exported for Plans that need
  //   to call the drain independently. Same thin additive-re-export pattern as
  //   logMemoryEvent / writeEdge / logSpineRead / confirmNode. Canon Part 9:
  //   navigation IS the only door to room.db; birthRoom opens room.db via
  //   openRoomDb (the lazy creator), the ONLY legal door at birth time.)
  birthRoom: roomBirth.birthRoom,
  drainBirthGateAnswers: roomBirth.drainBirthGateAnswers,

  // Grant-rubric graph writers (quick 260806-grant-grader-room-graph; additive
  //   re-export so the /mos:grade-grant host surface reaches the rubric-map +
  //   grading-profile writers through the navigation chokepoint, never a direct
  //   require of navigation/grant-rubric.cjs and never a raw INSERT from
  //   lib/core/eureka/ (which the substrate guard bans). writeGrantRubricGraph
  //   mints grant_criterion anchor nodes (SYSTEM-BOOKKEEPING, Part 9 v1.5
  //   audit-node carve-out -- rubric structure, not a venture truth-claim) +
  //   MAPS_TO_SECTION edges to the standard Section nodes (the ONE new
  //   ALLOWED_EDGE_TYPES member this quick task mints, see edges.cjs).
  //   writeGradingSectionEdges mints the per-run verdict->Section INFORMS
  //   coverage-profile edges (scalar counts only, aggregated per section --
  //   the (source,target,type) PK-honest shape). Both take (db, params) over a
  //   caller-owned room.db handle, so this file stays the single door. Canon
  //   Part 8: LOCAL only; rubric prose never lands on a node/edge property and
  //   never crosses to Brain. Same thin additive-re-export pattern as
  //   logMemoryEvent / writeEdge / birthRoom above.)
  writeGrantRubricGraph: grantRubric.writeGrantRubricGraph,
  writeGradingSectionEdges: grantRubric.writeGradingSectionEdges,

  // Point-in-time bitemporal query helper (Phase 160-05 -- R9; additive re-export
  //   so historical-reconstruction callers reach queryAsOf through the navigation
  //   chokepoint, never a direct require of temporal/point-in-time.cjs. queryAsOf
  //   is a pure LOCAL read of the Phase 160-04 bitemporal columns (valid_from /
  //   valid_to / invalidated_at) implementing the canonical (T_tx, T_v) WHERE
  //   clause; it owns NO room.db open (the writeEdge / supersede caller-owned-
  //   handle contract). Closes the Plan 04 R8 round-trip: an as-of query before a
  //   supersession still returns the superseded fact because supersede() CLOSES
  //   (invalidated_at) rather than deletes. Canon Part 8: zero Brain queries, zero
  //   egress. Same thin additive-re-export idiom as logMemoryEvent / writeEdge /
  //   getRoomContext.)
  queryAsOf: pointInTime.queryAsOf,

  // Whole-graph export for the visualization surfaces (SEED-026 -- the graph-viz
  //   orphan fix). getGraphExport(roomDir) sources BOTH nodes and edges from
  //   room.db in ONE identity space and emits a Cytoscape-ready payload, so a
  //   dangling edge is structurally impossible (an edge ships only when BOTH
  //   endpoints are in the included node set). It replaces the old two-authority
  //   path where generate-presentation.cjs built nodes from a filesystem/wikilink
  //   scan (scripts/build-graph) and bolted room.db edges on top in a DIFFERENT
  //   id space -- the orphan generator. memory_event / focus / audit and the
  //   memory-cortex bookkeeping types are excluded (counted, never silently
  //   dropped); knowledge_type drives node color; degree is derived; cold-start
  //   emits section anchors so a Tier-0 room never renders blank.
  //   Canon Part 8: this is a BROAD READ that can land in a deployable present/
  //   HTML artifact, so the payload is a strict WHITELIST of local render fields
  //   (id/label/type/knowledge_type/color/degree/review_status) -- never the raw
  //   properties blob, source paths, or any correlation_id / Brain-correlated
  //   bytes. The boundary is structural, not audited.
  //   Canon Part 9: the viz reads THROUGH the spine, never a second scanner.
  //   SURFACE-GROWTH NOTE (Part 6 dog-fooding): navigation.cjs documents a
  //   "closed 13-function" API but has grown additively well past it (writeEdge,
  //   logMemoryEvent, getRoomContext, the planning/cortex/lens/research writers,
  //   ...). getGraphExport is one more additive re-export of an internal
  //   navigation/ helper, following that established precedent; it adds NO new
  //   taxonomy and opens NO new wire. A future canon pass should reconcile the
  //   stated count with the real additive surface (tracked, not silent).
  getGraphExport: graphExport.getGraphExport,

  // The WELDED two-gauge meter read (Phase 183-02 METER-01+02 -- Canon Part 5 /
  //   Appendix D entry 31, the v1.19 headline product metric at the telemetry layer).
  //   readTwoGauge(db, sinceEpochMs, roomState) returns Gauge 1 (invocation density,
  //   VOLUME) AND the Gauge-2 named-debt transfer SOURCE (QUALITY) welded in ONE frozen
  //   object -- the pair together or it throws; there is NO bare-density path, so a
  //   future reader cannot drop the transfer half and ship the engagement machine. It
  //   stamps subject_class (maintainer | navigator | unknown -- only navigator clears the
  //   entry-31 self-binding clause) and transfer_state (measured | uninstrumented, a
  //   DISTINCT third state from flat). Caller-owned db handle; reads ONLY through the two
  //   shipped meter readers over the Part 9 chokepoint; makes ZERO Brain calls and imports
  //   no packet.cjs and no Brain client module (Part 8). Same thin additive-re-export idiom as
  //   logMemoryEvent / writeEdge / getRoomContext so callers reach the meter through the
  //   one Part 9 door.
  readTwoGauge: twoGauge.readTwoGauge,

  // Phase 222-01 Hedge weight-state accessor pair (D-02). The ONLY caller-facing
  //   SQL surface for the ranker_weights table; internally implemented in
  //   lib/core/navigation/ranker-weights.cjs (which, with the migration, is the
  //   only place SQL touches that table -- Part 9 single-chokepoint invariant).
  //   The read accessor returns null on a fresh table (cold start) and lets a
  //   real read fault THROW so Plan 02's ranker can emit the Req 7 degrade event;
  //   the write accessor validates finite scalars at the write boundary and
  //   wraps all row upserts in one transaction (atomic-write discipline). Typed
  //   and scalar-only (expert_id, weight, update_count, updated_at); no generic
  //   db.prepare escape hatch is exposed. Same thin additive-re-export idiom as
  //   logMemoryEvent / writeEdge / readTwoGauge.
  readHedgeWeightState: rankerWeights.readWeightState,
  upsertHedgeWeightState: rankerWeights.upsertWeightState,
};
