'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 185 -- DRIFT Runtime Reachability (DRIFT-01)
 * ==================================================
 * The runtime-reachability assertion for `doctor --drift`. Until now
 * `doctor --drift` did MERGE-TIME marking only (Class P prose-vs-code + Class Q
 * gsd-record); the canon concedes this at CIRS R7 (Part 11) / Appendix-D entries
 * 19/27 -- a WIRED capability that decide() can never actually reach at runtime
 * slips past the merge gate. This module closes that gap: it FAILS when a
 * capability is WIRED in the connector registry but the Phase-184 decide()-time
 * projection READER can never surface it.
 *
 * The predicate, in one sentence:
 *   A capability is "unreachable by decide() at runtime" when it is WIRED in the
 *   connector registry (connects_to_spine === true) AND is of a reader-eligible
 *   kind (command or agent -- the kinds the orchestration projection grants a
 *   `ranking` block), but the Phase-184 reader's deterministic ranker
 *   (rankCapabilities, the exact read decide() performs at the gate) does NOT
 *   emit a candidate for its projection node -- because the projection node is
 *   MISSING, carries NO `ranking` block, or the whole projection fails the
 *   reader's R2 correctness gate (so decide() skips the offer entirely).
 *
 * This is deterministic, code-evaluated reachability -- never an LLM-judge
 * (CIRS R15 discipline). It leans DIRECTLY on the Phase-184 reader
 * (lib/core/reader/decide-projection-reader.cjs): the same loadProjection /
 * validateProjection / rankCapabilities that decide() uses, so "reachable here"
 * means "reachable by the real decide() read", not by a parallel re-implementation
 * (Part 7 reuse-before-build).
 *
 * Reader-eligible kinds = {command, agent}. The projection generator grants
 * `ranking` blocks to commands + agents and NEVER to skills (skills are
 * trigger-wired for auto-activation, they are not Shape-F decision-gate options).
 * Scoping eligibility by kind is what keeps the assertion calibrated GREEN on the
 * real registry+projection today (every WIRED command + agent IS reader-emitted;
 * the 5 WIRED skills are correctly NOT counted as reader options).
 *
 * Canon Part 8 (HARD): this is a LOCAL read of two committed LOCAL artifacts
 * (data/connector-registry.json + data/brain-orchestration-projection.json).
 * ZERO Brain calls, ZERO network. It requires ONLY node:fs + node:path + the
 * Phase-184 reader (which is itself LOCAL-only). Frozen Part 3 contracts are
 * UNTOUCHED -- this adds a doctor check, it does not touch MAX_K, DIAL_REACH_K,
 * the 0.70/0.15 gate, the 6-reach bank, or any dial glyph.
 *
 * House rule: hyphens only, no em-dashes. Never throws.
 */

const fs = require('node:fs');
const path = require('node:path');
const reader = require('./reader/decide-projection-reader.cjs');

// The projection kinds that carry a `ranking` block and are therefore rankable
// by the Phase-184 reader. A WIRED connector whose source is one of these is
// EXPECTED to be reader-reachable; a WIRED connector of any other kind (skill,
// and any future trigger-only surface) is trigger-wired but is not a
// decision-gate option, so it is out of scope for the reachability assertion.
const READER_ELIGIBLE_SOURCES = Object.freeze(['command', 'agent']);

// A high enumeration limit. The Phase-184 READER_MAX_OPTIONS (5) is a per-turn
// CONTENT budget on how many options a single decide() beat surfaces -- it is
// NOT a reachability bound. For the reachability question we enumerate the FULL
// set the ranker can produce, so the cap must be large enough to never clip the
// real projection (249 nodes, 85 ranked today).
const REACHABILITY_ENUMERATION_LIMIT = 100000;

function _repoRoot() {
  // __dirname == <repo>/lib/core -> two up is the repo root.
  return path.resolve(__dirname, '..', '..');
}

function _defaultRegistryPath() {
  return path.join(_repoRoot(), 'data', 'connector-registry.json');
}

/**
 * Map a WIRED connector surface to the projection node id the reader would emit
 * for it. Commands carry a bare "/mos:foo" surface and live in the projection as
 * "command:/mos:foo"; agents (and skills) already carry a "kind:name" surface
 * that IS the projection node id. Returns a string id (never throws).
 */
function projectionNodeIdForSurface(connector) {
  const surface = connector && typeof connector.surface === 'string' ? connector.surface : '';
  if (surface.indexOf('/mos:') === 0) return 'command:' + surface;
  return surface; // already kind:name (agent:<name> / skill:<name>)
}

/**
 * loadRegistry(opts) -> { ok, registry, source, reason }
 *
 * LOCAL read of the connector registry. Never throws. Injection seam:
 *   opts.registry      an in-memory registry object (bypasses disk)
 *   opts.registryPath  an explicit path (bypasses the default)
 */
function loadRegistry(opts) {
  const o = opts || {};
  if (o.registry !== undefined && o.registry !== null) {
    return { ok: true, registry: o.registry, source: 'injected', reason: 'ok' };
  }
  const p = (typeof o.registryPath === 'string' && o.registryPath.length > 0)
    ? o.registryPath
    : _defaultRegistryPath();
  try {
    if (!fs.existsSync(p)) {
      return { ok: false, registry: null, source: p, reason: 'registry_missing' };
    }
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    return { ok: true, registry: parsed, source: p, reason: 'ok' };
  } catch (_e) {
    return { ok: false, registry: null, source: p, reason: 'registry_unreadable' };
  }
}

/**
 * wiredEligibleConnectors(registry) -> [ connector... ]
 *
 * The WIRED, reader-eligible set: connects_to_spine === true AND source is a
 * reader-eligible kind (command / agent). This is the set decide() is expected
 * to be able to surface; it is what the reachability assertion measures against.
 */
function wiredEligibleConnectors(registry) {
  if (!registry || !Array.isArray(registry.connectors)) return [];
  return registry.connectors.filter(function (c) {
    return c && typeof c === 'object'
      && c.connects_to_spine === true
      && READER_ELIGIBLE_SOURCES.indexOf(c.source) !== -1;
  });
}

/**
 * checkRuntimeReachability(opts) -> result
 *
 * The DRIFT-01 assertion. Compares the WIRED, reader-eligible connector set
 * against what the Phase-184 reader's decide()-time ranker can actually surface
 * over the LOCAL projection. Never throws.
 *
 * Injection seams (all LOCAL; for hermetic tests):
 *   opts.registry / opts.registryPath     -> the connector registry
 *   opts.projection / opts.projectionPath -> the orchestration projection
 *
 * Returns:
 *   {
 *     status: 'ok' | 'warn' | 'error',   // warn == runtime-drift found
 *     wired_eligible: <int>,
 *     reachable: <int>,
 *     unreachable: [ { surface, source, projection_node_id, reason } ],
 *     detail: <string>,
 *     report_only: false,                 // this gate produces a HARD signal
 *   }
 * The non-ok reasons per unreachable surface:
 *   'no_projection_node'  -> the projection has no node for this WIRED surface
 *   'no_ranking_block'    -> a node exists but carries no `ranking` block,
 *                            so the reader can never rank/surface it
 *   'reader_skipped'      -> the whole projection failed the reader R2 gate, so
 *                            decide() skips the offer (every eligible surface is
 *                            unreachable this turn)
 *   'not_emitted'         -> a ranked node exists but the reader did not emit it
 */
function checkRuntimeReachability(opts) {
  const o = opts || {};

  // 1. LOAD both LOCAL artifacts (registry + projection). A missing/unreadable
  //    artifact is INDETERMINATE (error), not a false-clean and not a drift
  //    FAIL -- we cannot assert reachability without both sides.
  const regLoad = loadRegistry(o);
  if (!regLoad.ok || !regLoad.registry) {
    return {
      status: 'error',
      detail: 'connector registry unavailable (' + regLoad.reason + ') -- reachability indeterminate',
      wired_eligible: 0,
      reachable: 0,
      unreachable: [],
      report_only: false,
    };
  }
  const projLoad = reader.loadProjection({
    projection: o.projection,
    projectionPath: o.projectionPath,
  });
  if (!projLoad.ok || !projLoad.projection) {
    return {
      status: 'error',
      detail: 'orchestration projection unavailable (' + projLoad.reason + ') -- reachability indeterminate',
      wired_eligible: 0,
      reachable: 0,
      unreachable: [],
      report_only: false,
    };
  }

  const projection = projLoad.projection;
  const eligible = wiredEligibleConnectors(regLoad.registry);

  // 2. R2 gate (the reader's own correctness gate). If the projection is
  //    malformed the reader FAILS CLOSED and decide() SKIPS the offer entirely
  //    -- so EVERY WIRED eligible capability is unreachable this turn. That is a
  //    real runtime-drift FAIL, surfaced as such.
  const gate = reader.validateProjection(projection);
  if (!gate.valid) {
    const unreachable = eligible.map(function (c) {
      return {
        surface: c.surface,
        source: c.source,
        projection_node_id: projectionNodeIdForSurface(c),
        reason: 'reader_skipped',
      };
    });
    return {
      status: eligible.length > 0 ? 'warn' : 'ok',
      detail: 'projection failed the reader R2 gate (' + gate.reason
        + ') -- decide() skips the offer; ' + unreachable.length
        + ' WIRED capabilit' + (unreachable.length === 1 ? 'y' : 'ies') + ' runtime-unreachable',
      wired_eligible: eligible.length,
      reachable: 0,
      unreachable: unreachable,
      report_only: false,
    };
  }

  // 3. The decide()-time read: the reader's DETERMINISTIC ranker over the LOCAL
  //    projection. We enumerate the full producible set (large limit -- the per-
  //    turn READER_MAX_OPTIONS content budget is not a reachability bound). The
  //    set of emitted node ids IS "what decide() can surface at runtime".
  const ranked = reader.rankCapabilities(projection, {}, { limit: REACHABILITY_ENUMERATION_LIMIT });
  const emittedIds = new Set();
  for (const r of ranked) {
    if (r && typeof r.id === 'string') emittedIds.add(r.id);
  }

  // Index projection nodes by id so we can name the precise failure reason.
  const nodeById = new Map();
  if (Array.isArray(projection.nodes)) {
    for (const n of projection.nodes) {
      if (n && typeof n.id === 'string') nodeById.set(n.id, n);
    }
  }

  // 4. Assert: every WIRED eligible capability is emitted by the reader.
  const unreachable = [];
  let reachable = 0;
  for (const c of eligible) {
    const pid = projectionNodeIdForSurface(c);
    if (emittedIds.has(pid)) {
      reachable += 1;
      continue;
    }
    const node = nodeById.get(pid);
    let reason;
    if (!node) reason = 'no_projection_node';
    else if (!node.ranking || typeof node.ranking !== 'object') reason = 'no_ranking_block';
    else reason = 'not_emitted';
    unreachable.push({
      surface: c.surface,
      source: c.source,
      projection_node_id: pid,
      reason: reason,
    });
  }

  const drift = unreachable.length > 0;
  return {
    status: drift ? 'warn' : 'ok',
    detail: drift
      ? ('runtime-reachability drift: ' + unreachable.length + ' of ' + eligible.length
        + ' WIRED capabilit' + (eligible.length === 1 ? 'y' : 'ies')
        + ' unreachable by decide() at runtime ('
        + unreachable.map(function (u) { return u.surface + ':' + u.reason; }).join(', ') + ')')
      : ('all ' + eligible.length + ' WIRED command/agent capabilities reachable by decide() at runtime'),
    wired_eligible: eligible.length,
    reachable: reachable,
    unreachable: unreachable,
    report_only: false,
  };
}

module.exports = {
  checkRuntimeReachability: checkRuntimeReachability,
  loadRegistry: loadRegistry,
  wiredEligibleConnectors: wiredEligibleConnectors,
  projectionNodeIdForSurface: projectionNodeIdForSurface,
  READER_ELIGIBLE_SOURCES: READER_ELIGIBLE_SOURCES,
  REACHABILITY_ENUMERATION_LIMIT: REACHABILITY_ENUMERATION_LIMIT,
};
