'use strict';
/*
 * Phase 195-04 -- the REGISTRY-LEVEL cross-room store (FCM-11b/c).
 * =========================================================================
 * The single source of truth for UMBILICAL_TO peer edges. Unlike NESTED_WITHIN
 * (a VERTICAL parent-child lineage edge that lives LOCAL to the child's room.db),
 * UMBILICAL_TO is a HORIZONTAL peer link between two SIBLING rooms and belongs to
 * NEITHER room alone. D-03 locks it at the REGISTRY level: a dedicated
 * `.rooms/cross-room.db` node:sqlite store, written through ONE chokepoint that
 * mirrors the navigation.cjs writeEdge discipline (Canon Part 9: one governed
 * write path; typed edges only through it).
 *
 * Canon Part 8 (the cross-room fence): edge properties are ENUM / scalar ONLY --
 * exactly { relevance, signal, linked_at, session_id }. Any unknown key, any
 * non-scalar value, or an over-long string (prose smuggled into an allowed field)
 * is REJECTED without a throw. These edges are LOCAL to the registry store; they
 * NEVER egress to the Brain. Only aggregate scalars cross a boundary (Appendix D
 * entry 23).
 *
 * Reconcile against room deletion (FCM-11c, D-03 orphan-reap), two layers:
 *   1. purgeRoomEdges(slug) -- called by the room-discard-cascade ordered teardown;
 *      removes every edge whose source OR target room is the discarded slug.
 *   2. reapOrphanEdges() -- a periodic stale-reap cloning session-presence's
 *      reapStalePresence idiom; sweeps edges pointing at slugs no longer present
 *      in `.rooms/registry.json` (defense-in-depth for out-of-band deletions).
 *
 * Defensive: never throws on caller input; a missing node:sqlite runtime degrades
 * to { ok:false, reason:'sqlite_unavailable' } for writes and empty results for
 * reads. House rule: hyphens only, no em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');

// The ONE edge type this store accepts. Mirrors navigation edges.cjs
// ALLOWED_EDGE_TYPES.has(edge_type) membership discipline at the registry level.
const CROSS_ROOM_EDGE_TYPE = 'UMBILICAL_TO';

// The enum / scalar-only property allow-list (Part 8 fence). Every property key
// MUST be one of these; every value MUST be a scalar; strings are length-capped so
// prose can never ride an allowed field. This is the byte-level cross-room fence.
const ALLOWED_PROP_KEYS = Object.freeze(new Set(['relevance', 'signal', 'linked_at', 'session_id']));
const MAX_SCALAR_STRING = 64;

function loadSqlite() {
  try {
    const { DatabaseSync } = require('node:sqlite');
    return DatabaseSync;
  } catch (_) {
    return null;
  }
}

function storeDbPath(roomsHome) {
  return path.join(roomsHome, '.rooms', 'cross-room.db');
}

// Open the registry-level store (create the .rooms dir + schema if needed) and
// hand it to fn, closing afterward. Open/close per call -- this is a low-frequency
// registry store, mirroring session-presence's per-call open discipline. Returns
// fallback when node:sqlite is absent (never throws).
function withStore(roomsHome, fallback, fn) {
  const DatabaseSync = loadSqlite();
  if (!DatabaseSync) return fallback;
  let db = null;
  try {
    fs.mkdirSync(path.join(roomsHome, '.rooms'), { recursive: true });
    // Phase 276 (C4) write-safety: fold the busy-timeout constructor option into
    // the DatabaseSync options object. Without it, node:sqlite fails a contended
    // write in 0ms with SQLITE_BUSY; the option turns that into a roughly 5s
    // busy-wait window. Strictly more forgiving - a longer wait, never a new
    // failure mode - because WAL readers never block writers. Option-only, per
    // D-276-4: openRoomDb is structurally WRONG here, not merely unused. It
    // takes a roomDir and builds <roomDir>/.mindrian/room.db, so it cannot open
    // <roomsHome>/.rooms/cross-room.db at all, and it would run 13 CREATE
    // TABLEs plus five room migrations against a store that has none of them.
    db = new DatabaseSync(storeDbPath(roomsHome), { timeout: 5000 });
    db.exec('PRAGMA journal_mode = WAL');
    db.exec(
      'CREATE TABLE IF NOT EXISTS cross_room_edges (' +
      '  source_id TEXT NOT NULL,' +
      '  target_id TEXT NOT NULL,' +
      '  source_room TEXT NOT NULL,' +
      '  target_room TEXT NOT NULL,' +
      '  edge_type TEXT NOT NULL,' +
      '  relevance REAL,' +
      '  signal TEXT,' +
      '  linked_at INTEGER,' +
      '  session_id TEXT,' +
      '  PRIMARY KEY (source_id, target_id, edge_type)' +
      ')'
    );
    return fn(db);
  } catch (_e) {
    return fallback;
  } finally {
    if (db) { try { db.close(); } catch (_e2) { /* already closed */ } }
  }
}

function isScalar(v) {
  return typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean';
}

// Validate + normalize edge properties against the Part-8 enum/scalar fence.
// Returns { ok:true, props } or { ok:false, reason }. NEVER throws.
function validateProps(properties) {
  const props = (properties && typeof properties === 'object' && !Array.isArray(properties)) ? properties : {};
  for (const key of Object.keys(props)) {
    if (!ALLOWED_PROP_KEYS.has(key)) {
      return { ok: false, reason: 'invalid_property_key', detail: String(key).slice(0, 40) };
    }
    const val = props[key];
    if (!isScalar(val)) {
      return { ok: false, reason: 'non_scalar_property', detail: String(key).slice(0, 40) };
    }
    if (typeof val === 'string' && val.length > MAX_SCALAR_STRING) {
      return { ok: false, reason: 'property_too_long', detail: String(key).slice(0, 40) };
    }
  }
  return {
    ok: true,
    props: {
      relevance: typeof props.relevance === 'number' ? props.relevance : null,
      signal: typeof props.signal === 'string' ? props.signal : null,
      linked_at: typeof props.linked_at === 'number' ? props.linked_at : null,
      session_id: typeof props.session_id === 'string' ? props.session_id : null,
    },
  };
}

/**
 * writeUmbilicalEdge(roomsHome, params) -> { ok:true, ... } | { ok:false, reason }
 *
 * The SINGLE registry-level write chokepoint for cross-room peer edges. Mirrors
 * navigation.cjs writeEdge: positional roomsHome, a params object, an { ok } return,
 * never throws on caller input.
 *
 * params: { source_id, target_id, source_room, target_room, edge_type?, properties }
 * edge_type defaults to UMBILICAL_TO; any other type is REJECTED (mirrors the
 * ALLOWED_EDGE_TYPES.has gate). properties MUST be enum/scalar-only.
 */
function writeUmbilicalEdge(roomsHome, params) {
  if (typeof roomsHome !== 'string' || roomsHome.length === 0) {
    return { ok: false, reason: 'invalid_rooms_home' };
  }
  if (!params || typeof params !== 'object') {
    return { ok: false, reason: 'invalid_params' };
  }
  const { source_id, target_id, source_room, target_room, properties } = params;
  const edge_type = typeof params.edge_type === 'string' ? params.edge_type : CROSS_ROOM_EDGE_TYPE;
  if (edge_type !== CROSS_ROOM_EDGE_TYPE) {
    return { ok: false, reason: 'invalid_edge_type', detail: String(edge_type).slice(0, 40) };
  }
  if (typeof source_id !== 'string' || source_id.length === 0) return { ok: false, reason: 'invalid_source_id' };
  if (typeof target_id !== 'string' || target_id.length === 0) return { ok: false, reason: 'invalid_target_id' };
  if (typeof source_room !== 'string' || source_room.length === 0) return { ok: false, reason: 'invalid_source_room' };
  if (typeof target_room !== 'string' || target_room.length === 0) return { ok: false, reason: 'invalid_target_room' };

  const v = validateProps(properties);
  if (!v.ok) return v;
  const p = v.props;

  return withStore(roomsHome, { ok: false, reason: 'sqlite_unavailable' }, function (db) {
    try {
      db.prepare(
        'INSERT INTO cross_room_edges ' +
        '  (source_id, target_id, source_room, target_room, edge_type, relevance, signal, linked_at, session_id) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
        'ON CONFLICT(source_id, target_id, edge_type) DO UPDATE SET ' +
        '  source_room = excluded.source_room, target_room = excluded.target_room, ' +
        '  relevance = excluded.relevance, signal = excluded.signal, ' +
        '  linked_at = excluded.linked_at, session_id = excluded.session_id'
      ).run(source_id, target_id, source_room, target_room, edge_type,
        p.relevance, p.signal, p.linked_at, p.session_id);
    } catch (e) {
      return { ok: false, reason: 'edge_write_failed', detail: String(e.message || '').slice(0, 80) };
    }
    return { ok: true, edge_type: edge_type, source: source_id, target: target_id };
  });
}

function rowToEdge(r) {
  return {
    source_id: r.source_id,
    target_id: r.target_id,
    source_room: r.source_room,
    target_room: r.target_room,
    edge_type: r.edge_type,
    properties: {
      relevance: r.relevance,
      signal: r.signal,
      linked_at: r.linked_at,
      session_id: r.session_id,
    },
  };
}

/**
 * edgesForRoom(roomsHome, slug) -> Array<edge>
 *
 * Bidirectional traversal: returns every edge whose source_room OR target_room is
 * the given slug, so the edge surfaces from EITHER end of the peer link. Read-only;
 * never throws (empty array on any failure).
 */
function edgesForRoom(roomsHome, slug) {
  if (typeof roomsHome !== 'string' || typeof slug !== 'string' || slug.length === 0) return [];
  return withStore(roomsHome, [], function (db) {
    try {
      const rows = db.prepare(
        'SELECT * FROM cross_room_edges WHERE source_room = ? OR target_room = ?'
      ).all(slug, slug);
      return rows.map(rowToEdge);
    } catch (_e) {
      return [];
    }
  });
}

/**
 * purgeRoomEdges(roomsHome, slug) -> number (edges removed)
 *
 * FCM-11c layer 1: called by the room-discard-cascade ordered teardown. Removes
 * every UMBILICAL_TO edge whose source OR target room is the discarded slug so no
 * dangling cross-room edge survives the cascade. Never throws (0 on failure).
 */
function purgeRoomEdges(roomsHome, slug) {
  if (typeof roomsHome !== 'string' || typeof slug !== 'string' || slug.length === 0) return 0;
  return withStore(roomsHome, 0, function (db) {
    try {
      const info = db.prepare(
        'DELETE FROM cross_room_edges WHERE source_room = ? OR target_room = ?'
      ).run(slug, slug);
      return Number(info && info.changes) || 0;
    } catch (_e) {
      return 0;
    }
  });
}

// Read the set of registered room slugs from .rooms/registry.json. Returns null
// when the registry is absent / unreadable (so the reap can no-op safely rather
// than mistaking an unreadable registry for an empty one and purging everything).
function readRegisteredSlugs(roomsHome) {
  try {
    const registryPath = path.join(roomsHome, '.rooms', 'registry.json');
    const reg = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    if (!reg || typeof reg.rooms !== 'object' || reg.rooms === null) return null;
    return new Set(Object.keys(reg.rooms));
  } catch (_e) {
    return null;
  }
}

/**
 * reapOrphanEdges(roomsHome) -> number (edges reaped)
 *
 * FCM-11c layer 2: a periodic stale-reap cloning session-presence.reapStalePresence.
 * Sweeps edges whose source OR target room is NO LONGER present in
 * .rooms/registry.json (defense-in-depth for rooms deleted outside the cascade).
 * Fails SAFE: if the registry cannot be read, reaps nothing (never throws).
 */
function reapOrphanEdges(roomsHome) {
  if (typeof roomsHome !== 'string' || roomsHome.length === 0) return 0;
  const registered = readRegisteredSlugs(roomsHome);
  if (registered === null) return 0; // unreadable registry -> reap nothing (fail-safe)
  return withStore(roomsHome, 0, function (db) {
    try {
      const rows = db.prepare('SELECT source_id, target_id, edge_type, source_room, target_room FROM cross_room_edges').all();
      let reaped = 0;
      const del = db.prepare('DELETE FROM cross_room_edges WHERE source_id = ? AND target_id = ? AND edge_type = ?');
      for (const r of rows) {
        if (!registered.has(r.source_room) || !registered.has(r.target_room)) {
          const info = del.run(r.source_id, r.target_id, r.edge_type);
          reaped += Number(info && info.changes) || 0;
        }
      }
      return reaped;
    } catch (_e) {
      return 0;
    }
  });
}

module.exports = {
  CROSS_ROOM_EDGE_TYPE,
  ALLOWED_PROP_KEYS,
  writeUmbilicalEdge,
  edgesForRoom,
  purgeRoomEdges,
  reapOrphanEdges,
};
