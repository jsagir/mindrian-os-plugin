/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 89-07 Wave 0 -- ReverseSalientAgent stub.
 * Real substrate ships in Wave 1 (89-07-01-PLAN.md).
 *
 * Graph-native HARD RULE (memory feedback_reverse_salient_agent_graph_native.md):
 *   - READS go through lib/core/navigation.cjs ONLY (no direct room-db.cjs import)
 *   - WRITES emit typed cascade edges via the existing primitives
 *   - SURFACES via F.0 dispatcher (lib/hmi/selector-dispatcher.cjs pickShape)
 *   - TELEMETRY mirrors via recordSelectorMirror (Phase 88.2-03)
 *   - PERSONA from Phase 115 readUserMd().role_blend
 *   - BRAIN reads are LOCAL-only via folder-memory.readQuadruple (Canon Part 8)
 *
 * Pure CJS, node built-ins only, zero new runtime deps.
 */
'use strict';

function notImplementedYet(name) {
  return function () {
    throw new Error('not_implemented_yet:' + name + ':89-07-01 - Wave 1 substrate');
  };
}

module.exports = {
  gatherFocusContext: notImplementedYet('gatherFocusContext'),
  gatherBrainContext: notImplementedYet('gatherBrainContext'),
  composeFinding: notImplementedYet('composeFinding'),
  surfaceFinding: notImplementedYet('surfaceFinding'),
  emitFindingEdge: notImplementedYet('emitFindingEdge'),
  detectAndSurface: notImplementedYet('detectAndSurface'),
};
