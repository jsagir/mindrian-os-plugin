'use strict';
/*
 * Phase 165 Wave-0 RED stub -- test-unknowns-frozen-edges (D-165-08).
 *
 * GREEN assertion (Wave 4 turns this on; sourced from 165-VALIDATION.md +
 * 165-RESEARCH section 5):
 *   The engine emits ONLY the four frozen edge types
 *   INVALIDATES / ROOT_CAUSES / ENABLES / FEEDS_INTO (remap-only, D-165-08; 165
 *   mints NO new edge type and makes ZERO edges.cjs change). The shared iface
 *   exports exactly these four as FROZEN_ENGINE_EDGES, and the engine edge-writer
 *   (lib/core/unknowns/edge-writer.cjs or the orchestrator) performs the
 *   issue-tree.cjs:67-style module-load self-check against the LIVE
 *   ALLOWED_EDGE_TYPES (lib/core/navigation/edges.cjs) so a remap that DRIFTS out
 *   of the frozen set throws at require time. A drifted/made-up edge type is
 *   rejected by navigation.writeEdge (invalid_edge_type), never silently written.
 *
 * The module lib/core/unknowns/edge-writer.cjs does not exist yet. RED until
 * Wave 4. (The iface FROZEN_ENGINE_EDGES already ships; the LIVE assertion lives
 * in the engine edge-writer that requires navigation/edges.cjs -- see the
 * delegation note in iface.cjs.)
 *
 * NO em-dashes (CLAUDE.md HARD RULE).
 */
const MODULE = '../lib/core/unknowns/edge-writer.cjs';
try {
  require(MODULE);
} catch (_e) {
  console.error('RED: lib/core/unknowns/edge-writer.cjs not yet implemented (plan 04)');
  process.exit(1);
}
console.error('RED: frozen-edges writer loaded but the live ALLOWED_EDGE_TYPES self-check assertion is not wired yet (plan 04)');
process.exit(1);
