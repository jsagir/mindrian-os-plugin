'use strict';
// Phase 125-00 -- navigation.cjs edge-write primitive (per CONTEXT.md Pass 3 GAP-2
// resolution). Adds writeEdge to the navigation.cjs closed surface as an additive
// extension following the Phase 110-03 logMemoryEvent precedent.
//
// Canon Part 4: every choice is graph data; this is the chokepoint primitive that
// lets Plan 06 selector-decisions.cjs + future Phases 116/117/118 write typed
// cascade edges without bypassing the closed surface.
//
// Canon Part 7: reuse-before-build -- the UPSERT statement mirrors
// lib/core/lazygraph-ops.cjs::upsertEdge (lines 990-1019) so sibling agents
// emit edges via the same UPSERT shape and the navigation chokepoint stays
// the single door for write traffic.
//
// Canon Part 8 invariant: writeEdge takes (db, params) -- a db handle owned by
// the caller (via openRoomDb) -- so this module never opens room.db itself. Zero
// direct room-db.cjs require here. The navigation pre-commit hook treats this
// file as part of the navigation/* allow-list, NOT as a bypass.

const crypto = require('node:crypto');

// Closed edge-type allowlist enforced by writeEdge. Mirrors the EVENT_TYPES Set
// pattern in lib/core/navigation/memory-events.cjs. Phase 125 ships DEFERRED +
// REJECTED (D7 typed cascade edge surface for F.1 defer / F.2 reject). Future
// phases (e.g. Phase 116 tension resolution, Phase 117 auto-explore, Phase 118
// MVA) extend this Set additively without canon amendment -- same idiom as the
// EVENT_TYPES additive blocks for Phases 88.2-00 / 89-07 / 116-00 / 117-00 /
// 110-02.
//
// Tests assert a FLOOR (DEFERRED + REJECTED present) and Set-instance shape --
// not an exact size -- so additive extensions cannot regress baseline.
const ALLOWED_EDGE_TYPES = Object.freeze(new Set([
  // Phase 125 D7 -- F-selector decision edges (LOCKED LOCAL per Canon Part 8).
  'DEFERRED',
  'REJECTED',
]));

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// writeEdge(db, params) -- the 15th-style additive re-export on the
// navigation.cjs closed surface (see navigation.cjs header comment for the
// canonical re-export pattern alongside logMemoryEvent + firstCapturedLastTouchedBySection).
//
// Positional db (first arg, owned by caller via openRoomDb), params object
// (second arg) with: { source_id, target_id, edge_type, properties }.
//
// Returns { ok: true, edge_id, type, source, target } on success, or
// { ok: false, reason, detail? } on validation / write failure. Defensive --
// never throws on caller input. The underlying prepare/run is sync per the
// node:sqlite contract (matches the rest of the navigation module).
function writeEdge(db, params) {
  if (!params || typeof params !== 'object') {
    return { ok: false, reason: 'invalid_params' };
  }
  const { source_id, target_id, edge_type, properties } = params;
  if (typeof source_id !== 'string' || source_id.length === 0) {
    return { ok: false, reason: 'invalid_source_id' };
  }
  if (typeof target_id !== 'string' || target_id.length === 0) {
    return { ok: false, reason: 'invalid_target_id' };
  }
  if (typeof edge_type !== 'string' || !ALLOWED_EDGE_TYPES.has(edge_type)) {
    return { ok: false, reason: 'invalid_edge_type', detail: String(edge_type).slice(0, 40) };
  }
  const props = isPlainObject(properties) ? properties : {};
  let propsJson;
  try {
    propsJson = JSON.stringify(props);
  } catch (_e) {
    return { ok: false, reason: 'properties_serialize_failed' };
  }
  const edgeId = 'edge:' + edge_type + ':' + Date.now() + ':' + crypto.randomBytes(4).toString('hex');
  try {
    db.prepare(
      'INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?) ' +
      'ON CONFLICT(source, target, type) DO UPDATE SET properties = excluded.properties'
    ).run(source_id, target_id, edge_type, propsJson);
  } catch (e) {
    return { ok: false, reason: 'edge_write_failed', detail: String(e.message || '').slice(0, 80) };
  }
  return { ok: true, edge_id: edgeId, type: edge_type, source: source_id, target: target_id };
}

module.exports = { ALLOWED_EDGE_TYPES, writeEdge };
