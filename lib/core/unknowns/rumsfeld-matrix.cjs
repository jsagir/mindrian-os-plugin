'use strict';
// ========================================
// MINDRIAN RUMSFELD 2x2 ROUTER (KnownsUnknownsMatrix port) (Phase 165 Wave 4)
// Categorize each item into KK / KU / UK / UU and return the quadrant -> pipeline
// routing intent (the frozen FEEDS_INTO chain targets), the front-of-house for
// /mos:map-unknowns.
//
// Ported from reference/unknown-unknowns-horvitz/README.md
// (KnownsUnknownsMatrix.categorizeItem / getMatrixSummary / exportMatrix). The
// categorization MATH ports verbatim on the two booleans (awareness, knowledge);
// the Mindrian addition is the quadrant -> downstream-pipeline routing table that
// maps each non-KK quadrant to its shipped /mos: consumer handle, declared as a
// frozen FEEDS_INTO chain target (D-165-08; FROZEN_ENGINE_EDGES.FEEDS_INTO from
// the shared iface). KK is the bandit hunting ground (no downstream route -- it IS
// the input the engine probes).
//
// The module RETURNS the routing INTENT (quadrant + the FEEDS_INTO target
// handles). It does NOT invoke the commands and does NOT write edges -- the
// orchestrator (plan 165-04) writes the FEEDS_INTO edges through the navigation
// chokepoint. So this module makes ZERO Brain require, ZERO navigation require,
// ZERO I/O; it is a pure deterministic categorizer + routing-table lookup
// (Canon Part 8 / D-165-10). It mints NO new edge type (D-165-08, remap-only); the
// only edge handle it emits is the frozen FEEDS_INTO.
//
// NO em-dashes (CLAUDE.md HARD RULE); CJS; no new deps.
//
// Sources: 165-RESEARCH.md section 4.1 (the NOW-SHIPPED down-targets), the plan
// Task 3 read_first (the quadrant -> pipeline mapping), the shared iface
// (FROZEN_ENGINE_EDGES.FEEDS_INTO).
// ========================================

const { FROZEN_ENGINE_EDGES } = require('./iface.cjs');

// The four Rumsfeld quadrants (closed set).
const QUADRANTS = Object.freeze({
  KK: 'KK', // known knowns   (aware + knowledgeable)  -> the bandit hunting ground
  KU: 'KU', // known unknowns  (aware, not knowledgeable)
  UK: 'UK', // unknown knowns  (knowledgeable, not aware)
  UU: 'UU', // unknown unknowns (neither)
});

// The quadrant -> pipeline routing table. Each non-KK quadrant maps to the shipped
// /mos: consumer command slugs (165-RESEARCH section 4.1). These are the FEEDS_INTO
// chain DOWN-targets the orchestrator declares as edges. KK carries NO downstream
// route: it is the input the bandit probes, not a routed quadrant.
//
//   KU (known unknown -- we know we do not know): whitespace / research / expert-fill /
//      find-analogies (go FILL the gap).
//   UK (unknown known -- latent knowledge not surfaced): meetings / graph-walk /
//      build-knowledge (go SURFACE what is already in the room).
//   UU (unknown unknown -- the blind spot): challenge / issue-tree / validate-mvp
//      (go STRESS-TEST the confident belief).
const ROUTING_TABLE = Object.freeze({
  KK: Object.freeze([]),
  KU: Object.freeze(['whitespace', 'find-analogies', 'bono', 'deep-research']),
  UK: Object.freeze(['file-meeting', 'navigate-graph', 'analyze-room']),
  UU: Object.freeze(['challenge-assumptions', 'diagnose', 'validate']),
});

/**
 * categorizeItem(item, awareness, knowledge) -> 'KK' | 'KU' | 'UK' | 'UU'
 * The reference 2x2: awareness (do we KNOW we hold this belief?) x knowledge (do we
 * UNDERSTAND it well / is it well-evidenced?). Pure, deterministic. `item` is
 * carried for contract parity (the caller may pass the claim handle); the quadrant
 * is decided by the two booleans only (Part 8: no item BODY is read).
 */
function categorizeItem(item, awareness, knowledge) {
  const aware = !!awareness;
  const known = !!knowledge;
  if (aware && known) return QUADRANTS.KK;
  if (aware && !known) return QUADRANTS.KU;
  if (!aware && known) return QUADRANTS.UK;
  return QUADRANTS.UU;
}

/**
 * routeQuadrant(quadrant) -> { quadrant, edge_type, targets }
 * The quadrant -> pipeline routing INTENT. `edge_type` is the frozen FEEDS_INTO
 * handle (never invoked, never written here). `targets` is the ordered list of
 * shipped consumer command slugs for the quadrant (empty for KK -- the hunting
 * ground). Returns null for an unknown quadrant.
 */
function routeQuadrant(quadrant) {
  if (!Object.prototype.hasOwnProperty.call(ROUTING_TABLE, quadrant)) return null;
  return {
    quadrant,
    edge_type: FROZEN_ENGINE_EDGES.FEEDS_INTO,
    targets: ROUTING_TABLE[quadrant].slice(),
  };
}

/**
 * categorizeAndRoute(item, awareness, knowledge) -> { quadrant, edge_type, targets }
 * Convenience: categorize then route in one call.
 */
function categorizeAndRoute(item, awareness, knowledge) {
  return routeQuadrant(categorizeItem(item, awareness, knowledge));
}

/**
 * getMatrixSummary(categorized) -> { KK, KU, UK, UU, total }
 * Quadrant tallies over a categorized set. `categorized` is an array of
 * { quadrant } objects (or raw quadrant strings). Pure; deterministic.
 */
function getMatrixSummary(categorized) {
  const summary = { KK: 0, KU: 0, UK: 0, UU: 0, total: 0 };
  const list = Array.isArray(categorized) ? categorized : [];
  for (const c of list) {
    const q = (typeof c === 'string') ? c : (c && c.quadrant);
    if (Object.prototype.hasOwnProperty.call(QUADRANTS, q)) {
      summary[q] += 1;
      summary.total += 1;
    }
  }
  return summary;
}

/**
 * exportMatrix(categorized) -> { summary, quadrants, routing }
 * The engine's analyze-step export: the tallies + the per-quadrant member ids +
 * the routing intent per non-empty quadrant. Pure; deterministic; member ids are
 * id handles only (Part 8: no body). `categorized` is an array of
 * { id?, quadrant }.
 */
function exportMatrix(categorized) {
  const list = Array.isArray(categorized) ? categorized : [];
  const quadrants = { KK: [], KU: [], UK: [], UU: [] };
  for (const c of list) {
    const q = (typeof c === 'string') ? c : (c && c.quadrant);
    if (!Object.prototype.hasOwnProperty.call(quadrants, q)) continue;
    const id = (c && typeof c.id === 'string') ? c.id : null;
    if (id) quadrants[q].push(id);
  }
  for (const q of Object.keys(quadrants)) quadrants[q].sort();
  const routing = {};
  for (const q of Object.keys(quadrants)) {
    if (q === 'KK') continue; // the hunting ground is not routed
    if (quadrants[q].length > 0) routing[q] = routeQuadrant(q);
  }
  return {
    summary: getMatrixSummary(list),
    quadrants,
    routing,
  };
}

module.exports = {
  categorizeItem,
  routeQuadrant,
  categorizeAndRoute,
  getMatrixSummary,
  exportMatrix,
  QUADRANTS,
  ROUTING_TABLE,
};
