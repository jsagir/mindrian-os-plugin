'use strict';
// Phase 172-11 -- projection-level coverage + chain-health monitor (CIRS INV-09).
//
// monitorCoverage(projection) -> a health report
//   { unwired, unranked, stale, command_gaps, chain_reachability, counts }
// composed from the LOCAL orchestration projection (the Part-8 control plane:
// generic machinery topology, every node methodology_tier-tagged). It surfaces:
//   - UN-WIRED   : a framework node not reachable to any frozen reach.
//   - UN-RANKED  : a connector-derived (reach_id-bearing) mindrian-operation node
//                  missing ranking inputs (reach_id / hierarchy_rank / posture).
//   - STALE      : a freshness flag carried on the projection itself (the script
//                  validateProjection owns the on-disk byte-compare STALE; the
//                  monitor reports the projection-carried stale markers only, so it
//                  stays a PURE read of the in-memory projection object).
//   - COMMAND-GAP: a bare command-kind node (no reach_id) not explicitly excluded.
//   - CHAIN-REACHABILITY : a FEEDS_INTO / CHAINS chain whose target node is absent
//                  from the projection (an unreachable / dangling chain target).
//
// Canon INV-09: MONITOR coverage + chain health at the PROJECTION level; per-user
//   invocation telemetry stays LOCAL (Part 8); the remote graph monitors GENERIC
//   machinery shape + chain integrity only.
// Canon INV-12 / Part 8: zero Brain, zero network. The monitor reads ONLY the
//   LOCAL projection object passed in. It opens no room.db, makes no fetch, and
//   carries no Brain-host token. The report carries ONLY generic machinery shape
//   (counts + framework/reach/command NAMES) -- never user content.
// Canon Part 7 (reuse-before-build): the UN-WIRED / UN-RANKED / COMMAND-GAP
//   classification mirrors scripts/build-orchestration-projection.cjs
//   validateProjection (Phase 172-03) verbatim in shape; the monitor is a pure,
//   disk-free composition of those same categories plus the chain layer.
//
// No em-dashes (CLAUDE.md HARD RULE).

// The frozen 6 machine reaches (Canon Part 2 / Appendix D entry 15: the bank is 6;
// hats is the 6th). Mirrored locally as a scalar-only Set so the monitor stays a
// pure projection read with zero require of the heavy navigation surface.
const FROZEN_REACH_IDS = Object.freeze(new Set([
  'methodology',
  'brain_consult',
  'research',
  'sub_agent',
  'opportunity_bank',
  'hats',
]));

const TIER_OP = 'mindrian-operation';

// The chain-layer edge types whose targets must resolve to a present node.
const CHAIN_EDGE_TYPES = Object.freeze(new Set(['FEEDS_INTO', 'CHAINS', 'PREREQUISITE']));

function _arr(v) { return Array.isArray(v) ? v : []; }

// A command is EXCLUDED (a first-class conformant terminal state, R1) iff it
// declares connector.excluded with a reason, OR carries an explicit excluded flag.
// A command is RANKED (wired) iff it declares a reach_id. Anything else is a gap.
function _classifyCommandNode(node) {
  if (!node || node.kind !== 'command') return 'n/a';
  if (typeof node.reach_id === 'string' && node.reach_id) return 'ranked';
  if (node.excluded === true) return 'excluded';
  if (node.connector && typeof node.connector === 'object' && node.connector.excluded) return 'excluded';
  return 'gap';
}

/**
 * monitorCoverage(projection) -> health report
 *
 * Pure function over the in-memory projection. Defensive: never throws on caller
 * input; a malformed projection degrades to an empty {nodes, edges} read.
 */
function monitorCoverage(projection) {
  const proj = (projection && typeof projection === 'object') ? projection : {};
  const nodes = _arr(proj.nodes);
  const edges = _arr(proj.edges);

  const unwired = [];
  const unranked = [];
  const stale = [];
  const command_gaps = [];

  // ---- STALE (projection-carried freshness markers only; disk byte-compare is
  // the script's job, kept out so the monitor stays a pure in-memory read). ----
  if (proj.stale === true) {
    stale.push('STALE: the projection carries an explicit stale=true freshness marker.');
  }
  for (const s of _arr(proj.stale)) {
    if (typeof s === 'string' && s) stale.push(s);
  }

  // ---- UN-WIRED: framework reachability to a frozen reach via OPERATES->reach. ----
  const commandReachById = new Map();
  for (const n of nodes) {
    if (n && n.kind === 'command' && typeof n.reach_id === 'string' && n.reach_id) {
      commandReachById.set(n.id, n.reach_id);
    }
  }
  const frameworkReaches = new Map();
  for (const n of nodes) {
    if (n && n.kind === 'framework') frameworkReaches.set(n.id, false);
  }
  for (const e of edges) {
    if (!e || e.type !== 'OPERATES') continue;
    const fromReach = commandReachById.get(e.from);
    if (fromReach && FROZEN_REACH_IDS.has(fromReach) && frameworkReaches.has(e.to)) {
      frameworkReaches.set(e.to, true);
    }
  }
  for (const n of nodes) {
    if (!n || n.kind !== 'framework') continue;
    if (!frameworkReaches.get(n.id)) {
      unwired.push(
        'UN-WIRED: framework "' + (n.name || n.id) + '" (node ' + n.id + ') is not ' +
        'reachable to any of the 6 frozen reaches via an OPERATES->reach chain.'
      );
    }
  }

  // ---- UN-RANKED: a connector-derived mindrian-operation node (reach_id-bearing)
  // missing ranking inputs. ----
  for (const n of nodes) {
    if (!n || n.methodology_tier !== TIER_OP) continue;
    if (typeof n.reach_id !== 'string' || !n.reach_id) continue; // not connector-derived
    const missing = [];
    if (typeof n.hierarchy_rank !== 'number') missing.push('hierarchy_rank');
    if (typeof n.posture !== 'string' || !n.posture) missing.push('posture');
    if (missing.length) {
      unranked.push(
        'UN-RANKED: connector-derived node ' + n.id + ' ("' + (n.name || n.id) + '") is ' +
        'missing ranking input(s): ' + missing.join(', ') + '.'
      );
    }
  }

  // ---- COMMAND-GAP: a bare command-kind node (no reach_id) not excluded. ----
  for (const n of nodes) {
    if (!n || n.kind !== 'command') continue;
    if (_classifyCommandNode(n) === 'gap') {
      command_gaps.push(
        'COMMAND-GAP: command "' + (n.name || n.id) + '" (node ' + n.id + ') is a bare ' +
        'command (no reach_id) and is not explicitly excluded.'
      );
    }
  }

  // ---- CHAIN-REACHABILITY: every chain-layer edge target must resolve to a
  // present node. A FEEDS_INTO / CHAINS / PREREQUISITE edge whose `to` (or `from`)
  // is absent from the projection is a dangling / unreachable chain (R13: the gate
  // FAILS on a live FEEDS_INTO whose target is retired/absent). ----
  const nodeIds = new Set();
  for (const n of nodes) { if (n && typeof n.id === 'string') nodeIds.add(n.id); }
  const unreachable = [];
  let chainEdgeCount = 0;
  for (const e of edges) {
    if (!e || !CHAIN_EDGE_TYPES.has(e.type)) continue;
    chainEdgeCount += 1;
    if (typeof e.to === 'string' && !nodeIds.has(e.to)) {
      unreachable.push({ type: e.type, from: e.from, to: e.to, reason: 'target_absent' });
    } else if (typeof e.from === 'string' && !nodeIds.has(e.from)) {
      unreachable.push({ type: e.type, from: e.from, to: e.to, reason: 'source_absent' });
    }
  }
  const chain_reachability = {
    chain_edges: chainEdgeCount,
    unreachable,
    healthy: unreachable.length === 0,
  };

  return {
    unwired,
    unranked,
    stale,
    command_gaps,
    chain_reachability,
    counts: {
      unwired: unwired.length,
      unranked: unranked.length,
      stale: stale.length,
      command_gaps: command_gaps.length,
      chain_edges: chainEdgeCount,
      chain_unreachable: unreachable.length,
    },
  };
}

module.exports = { monitorCoverage };
