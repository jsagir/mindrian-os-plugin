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
};
