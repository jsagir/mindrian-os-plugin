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
  findOpenQuestions: insights.findOpenQuestions,
  findSurfaceableTensions: insights.findSurfaceableTensions,

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

  // First-captured / last-touched scalars by section (Phase 124-01 -- a thin re-export so
  //   lib/core/feynman/timeline-renderer.cjs can compose its D-05 summary line over the
  //   memory_event log without reaching into the internal navigation/insights.cjs. The closed
  //   navigation surface is the DOCUMENTED 13-function API; the implementation re-exports
  //   internal helpers as needed -- same pattern as the Phase 110-03 logMemoryEvent re-export.)
  firstCapturedLastTouchedBySection: insights.firstCapturedLastTouchedBySection,

  // Edge-write primitive (Phase 125-00 -- Pass 3 GAP-2 resolution; D7 typed cascade edge
  //   surface for F.1 defer / F.2 reject. Allowlist gated on ALLOWED_EDGE_TYPES Set in
  //   navigation/edges.cjs. Plan 06 selector-decisions.cjs is the first consumer; Phase
  //   116/117/118 will extend the allowlist additively for tension / auto-explore /
  //   MVA edges. Same additive-re-export pattern as logMemoryEvent + firstCapturedLastTouchedBySection.)
  writeEdge: edges.writeEdge,

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
};
