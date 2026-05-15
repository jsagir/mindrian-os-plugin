/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 118-02 Plan 02 -- ALL_AGENTS aggregator for the 6 MVA agents (Binding
 * Decision B1). Consumed by lib/core/mva-dispatcher.cjs which knows nothing
 * about which agents are which -- it accepts any { id, fn } tuple conforming
 * to the Agent contract in lib/core/mva-agent-contract.cjs.
 *
 * Agent ID -> source-file mapping (short forms per B1; long forms here):
 *
 *   brain_similar        <- brain-similar-ventures.cjs           (Agent 1)
 *   brain_cross_domain   <- brain-cross-domain.cjs               (Agent 2)
 *   brain_classic_traps  <- brain-classic-traps.cjs              (Agent 3)
 *   tavily_funding       <- tavily-funding-scan.cjs              (Agent 4)
 *   six_hats_red_black   <- six-hats-red-black.cjs               (Agent 5)
 *   dashboard_graph      <- dashboard-graph-neighborhood.cjs     (Agent 6)
 *
 * NOTE on filename drift (NIT-2 invariant from plan-checker iteration 2):
 *   The canonical filenames in this plan's files_modified (e.g.
 *   brain-cross-domain.cjs, dashboard-graph-neighborhood.cjs) are the
 *   implementation-time source files. The JSDoc above documents the agent-id
 *   -> source-file mapping using the B1 short forms so Plan 118-03's renderer
 *   prefixes ([brain] / [analogy] / [traps] / [funding] / [worth chewing on]
 *   / [your room]) deterministically resolve from agent_id alone. If an
 *   executor renames a source file, update both this comment block AND the
 *   require() path immediately below in the same commit.
 *
 * Canon Part 8: this module is a pure aggregator. Zero I/O. Each agent owns
 * its own boundary; the array shape preserves the dispatcher contract.
 */
'use strict';

const ALL_AGENTS = Object.freeze([
  { id: 'brain_similar',       fn: require('./brain-similar-ventures.cjs').run },
  { id: 'brain_cross_domain',  fn: require('./brain-cross-domain.cjs').run },
  { id: 'brain_classic_traps', fn: require('./brain-classic-traps.cjs').run },
  { id: 'tavily_funding',      fn: require('./tavily-funding-scan.cjs').run },
  { id: 'six_hats_red_black',  fn: require('./six-hats-red-black.cjs').run },
  { id: 'dashboard_graph',     fn: require('./dashboard-graph-neighborhood.cjs').run },
]);

module.exports = { ALL_AGENTS };
