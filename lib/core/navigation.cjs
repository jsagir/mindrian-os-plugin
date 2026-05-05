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

const focus = require('./navigation/focus.cjs');
const neighborhoodMod = require('./navigation/neighborhood.cjs');
const memoryEvents = require('./navigation/memory-events.cjs');
const transitions = require('./navigation/transitions.cjs');
const insights = require('./navigation/insights.cjs');
const roomHome = require('./navigation/room-home.cjs');

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

  // Insight queries (Plan 109-05 LIVE).
  findContradictions: insights.findContradictions,
  findUnsupportedClaims: insights.findUnsupportedClaims,
  findBlockingAssumptions: insights.findBlockingAssumptions,
  findStaleDecisions: insights.findStaleDecisions,
  findOpenQuestions: insights.findOpenQuestions,

  // findRecentChanges (Plan 109-03 LIVE).
  findRecentChanges: memoryEvents.findRecentChanges,

  // Opportunity ranking (Plan 109-05 LIVE).
  findRelevantOpportunities: insights.findRelevantOpportunities,

  // Brain integration (Plans 109-07 + 109-08 will replace).
  buildBrainPacket: notImplementedYet('buildBrainPacket', 'Plan 109-07'),
  storeBrainSuggestions: notImplementedYet('storeBrainSuggestions', 'Plan 109-08'),

  // Room Home (Plan 109-09 LIVE - 13th and LAST live export; navigation.cjs surface COMPLETE).
  getRoomHomeView: roomHome.getRoomHomeView,

  // Truth-state chokepoint (Plan 109-04 LIVE).
  promoteNodeStatus: transitions.promoteNodeStatus,
};
