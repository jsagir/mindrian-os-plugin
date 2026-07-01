'use strict';
/*
 * Phase 179-05 -- the abstraction-level persistence helper. The truth-claim
 * property-write chokepoint for the instances-vs-structures abstraction gate
 * (SPEC Req 6; CONTEXT decision 2).
 *
 * This is an allow-listed navigation submodule (scripts/check-substrate.cjs
 * regex /^lib\/core\/navigation\// covers it), mirroring
 * lib/core/navigation/typed-claim.cjs writeClaimNode: it takes a db handle owned
 * by the caller (via lib/core/room-db.cjs openRoomDb), NEVER requires node:sqlite
 * and NEVER opens room.db itself, so it stays inside the navigation allow-list
 * with zero substrate bypass. It is re-exported through lib/core/navigation.cjs
 * (the single documented door) and surfaced on lib/core/abstraction-gate.cjs
 * alongside the pure selector.
 *
 * persistAbstractionLevel(db, params) writes the chosen abstraction_level
 *   (instances|structure|unsure) as an ADDITIVE property on the EXISTING
 *   hypothesis claim node (the Wave-4 truth-claim minted by writeClaimNode).
 *   Mirrors the typed-claim additive-JSON-props idiom: abstraction_level rides
 *   INSIDE the node's properties TEXT blob, NEVER a DDL column. It mints NO new
 *   node type and NO edge type (SPEC boundary + Part 11): it read-merge-writes
 *   the same nodes row, leaving type='claim' and review_status untouched (Part 9
 *   role 5: the abstraction pick does not promote a proposed claim to confirmed).
 *
 * Canon Part 8 (The Graph Boundary): LOCAL only. Pure CJS over a caller-owned db
 *   handle. Zero network surface; no Brain calls; the abstraction pick NEVER
 *   egresses to Brain. node built-ins only, zero new deps.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE). Hyphens only.
 */

// The closed 3-option abstraction-level enum. INSTANCES / STRUCTURE / unsure.
// 'unsure' is the deliberate third option absorbing the undecided navigator.
const ABSTRACTION_KEYS = Object.freeze(['instances', 'structure', 'unsure']);

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * normalizeAbstractionLevel(value) -- coerce a raw pick (a key, a label, or a
 * mixed-case string) to one of the frozen ABSTRACTION_KEYS, or null if invalid.
 * INSTANCES / instances -> 'instances'; STRUCTURE -> 'structure'; unsure ->
 * 'unsure'.
 */
function normalizeAbstractionLevel(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  return ABSTRACTION_KEYS.indexOf(v) !== -1 ? v : null;
}

/**
 * persistAbstractionLevel(db, params) -- persist the chosen abstraction_level as
 * an ADDITIVE property on the EXISTING hypothesis claim node.
 *
 * params = { nodeId, abstraction_level }.
 *
 * Behavior:
 *   - Validates abstraction_level against the frozen 3-key set (rejects
 *     invalid_abstraction_level otherwise).
 *   - Reads the existing node's properties JSON, merges abstraction_level into
 *     the blob (additive; every other prop preserved byte-stable), writes it
 *     back on the SAME row. type stays 'claim'; review_status is UNTOUCHED.
 *   - Mints NO new node type and NO edge type: a properties-blob UPDATE on the
 *     existing claim node, nothing else.
 *
 * Defensive: never throws on caller input; returns { ok:false, reason } on
 * failure. Canon Part 8: LOCAL SQLite only, no network.
 */
function persistAbstractionLevel(db, params) {
  if (!isPlainObject(params)) {
    return { ok: false, reason: 'invalid_params' };
  }
  const { nodeId, abstraction_level } = params;
  if (typeof nodeId !== 'string' || nodeId.length === 0) {
    return { ok: false, reason: 'invalid_node_id' };
  }
  const level = normalizeAbstractionLevel(abstraction_level);
  if (level === null) {
    return {
      ok: false,
      reason: 'invalid_abstraction_level',
      detail: String(abstraction_level).slice(0, 40),
    };
  }
  if (!db || typeof db.prepare !== 'function') {
    return { ok: false, reason: 'invalid_db' };
  }

  let row;
  try {
    row = db.prepare('SELECT properties FROM nodes WHERE id = ?').get(nodeId);
  } catch (e) {
    return { ok: false, reason: 'node_read_failed', detail: String(e.message || '').slice(0, 80) };
  }
  if (!row) {
    return { ok: false, reason: 'node_not_found', detail: nodeId.slice(0, 60) };
  }

  // Read-merge: parse the existing properties blob, fold abstraction_level in
  // additively. A malformed/absent blob degrades to a fresh object so the write
  // still lands the additive key (never throws).
  let props = {};
  if (typeof row.properties === 'string' && row.properties.length > 0) {
    try {
      const parsed = JSON.parse(row.properties);
      if (isPlainObject(parsed)) props = parsed;
    } catch (_e) {
      props = {};
    }
  }
  props.abstraction_level = level;

  let propsJson;
  try {
    propsJson = JSON.stringify(props);
  } catch (_e) {
    return { ok: false, reason: 'properties_serialize_failed' };
  }

  // Phase 194-06 Task 2 (PSB-08/09/12): the optimistic lost-update guard, gated
  // behind the presence fast-path. It arms ONLY when the caller supplies
  // params.readVersion AND a live co-session shares the room. On drift (a
  // concurrent abstraction merge bumped last_modified_at since the read) it
  // returns WITHOUT overwriting so the caller raises a RECONCILE (F.9) rather than
  // silently losing the co-session's key. Fail OPEN; additive (no readVersion ->
  // no check, byte-identical to today).
  if (params.readVersion !== undefined && params.readVersion !== null) {
    try {
      const presence = require('../session-presence.cjs');
      const live = presence.listLiveCoSessions({
        roomDir: params.roomDir,
        room: params.room,
        home: params.home,
        sessionId: params.sessionId,
      });
      if (Array.isArray(live) && live.length > 0) {
        const guard = require('./reconcile-guard.cjs');
        const verdict = guard.checkLostUpdate(db, nodeId, params.readVersion);
        if (verdict && verdict.conflict === true) {
          return {
            ok: false,
            reason: 'lost_update',
            reconcile: {
              nodeId: nodeId,
              held: 'abstraction_level',
              readVersion: params.readVersion,
              currentVersion: verdict.currentVersion,
            },
          };
        }
      }
    } catch (_e) {
      // Fail OPEN: a guard/presence failure never blocks the write.
    }
  }

  // Additive UPDATE on the SAME claim row: the properties blob, last_seen_at,
  // AND last_modified_at move. type, review_status, created_by are all untouched
  // -- no new node type, no new edge type, no promotion.
  //
  // Phase 194-06 Task 1 (PSB-08 pre-req / A1-A4 correction): this read-merge-write
  // is the classic lost-update shape (session B reads the pre-A properties blob,
  // merges its own key, writes -- A's key is silently lost). The reconcile-guard
  // CAS token is last_modified_at, so this content mutation MUST bump it or a
  // concurrent abstraction merge is invisible to the guard. last_seen_at is kept
  // (a read/write conflated stamp); last_modified_at is the pure modify stamp both
  // bound to the SAME now so the CAS token moves on every merge.
  const nowMs = Date.now();
  try {
    db.prepare(
      'UPDATE nodes SET properties = ?, last_seen_at = ?, last_modified_at = ? WHERE id = ?'
    ).run(propsJson, nowMs, nowMs, nodeId);
  } catch (e) {
    return { ok: false, reason: 'abstraction_write_failed', detail: String(e.message || '').slice(0, 80) };
  }

  return { ok: true, node_id: nodeId, abstraction_level: level };
}

module.exports = {
  persistAbstractionLevel,
  normalizeAbstractionLevel,
  ABSTRACTION_KEYS,
};
