'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 195-05 -- FCM-10: the F.8 cross-room umbilical gate + per-item closer.
 * ============================================================================
 * This module COMPOSES the shipped Phase-188 F.8 selector -- it mints NO new
 * selector shape (D-08) and NO new frozen scalar (Pitfall 4). It reuses:
 *   - shape-f8-renderer.cjs::renderShapeF8    (the independent-toggle basket;
 *     a candidate whose relevance >= the frozen PRE_CHECK_THRESHOLD=0.70 renders
 *     PRE-CHECKED, display-only, NEVER auto-applied),
 *   - f8-fanout-consumer.cjs::consumeF8Fanout (1 confirm -> N typed edges; it
 *     loops the confirmed toggle array and calls the per-item closer supplied HERE).
 *
 * The per-item closer is the net-new piece:
 *   - a toggled-ON candidate writes ONE UMBILICAL_TO edge through the Plan-04
 *     registry chokepoint (cross-room-store.writeUmbilicalEdge); properties are
 *     enum/scalar-only { relevance, signal, linked_at, session_id } (Canon Part 8),
 *   - a toggled-OFF candidate writes NOT_LINKED_BECAUSE (rejection-is-data,
 *     Canon Part 4 -- the "why not" is graph data too). NOT_LINKED_BECAUSE rows
 *     live in a registry-level rejection ledger; they are LOCAL, enum/scalar-only,
 *     and NEVER egress to the Brain.
 *
 * hitl_shape: F.8. Pre-check is DISPLAY-ONLY: nothing attaches until the single
 * confirm (the closer only ever sees the CONFIRMED toggle state). Pure CJS, node
 * built-ins only. Hyphens only, no em-dashes. No emoji. No Brain call.
 */

const fs = require('node:fs');
const path = require('node:path');

const shapeF8 = require('../hmi/shape-f8-renderer.cjs');
const fanout = require('./f8-fanout-consumer.cjs');
const crossRoomStore = require('../core/cross-room-store.cjs');

// The HITL shape this gate declares. It COMPOSES F.8; it does not mint a new one.
const HITL_SHAPE = 'F.8';

// The rejection channel edge type (rejection-is-data, Canon Part 4). Distinct
// from UMBILICAL_TO: this is the "why NOT linked" record, not a peer link.
const NOT_LINKED_EDGE_TYPE = 'NOT_LINKED_BECAUSE';

// The frozen pre-check threshold, REUSED from the shipped renderer -- NOT minted
// here (Pitfall 4). This module never defines its own 0.7x scalar.
const PRE_CHECK_THRESHOLD = shapeF8.PRE_CHECK_THRESHOLD;

// Rejection-ledger scalar fence (mirrors cross-room-store's allow-list discipline).
const MAX_SCALAR_STRING = 64;

// A structural, Part-8-safe toggle label for a candidate: its target_id (e.g.
// 'section:room-b/strategy'). Never prose. Used as the F.8 option label + the
// consumeF8Fanout verb, so the closer can map a confirmed toggle back to its
// candidate deterministically.
function labelFor(cand) {
  if (cand && typeof cand.target_id === 'string' && cand.target_id.length > 0) return cand.target_id;
  return null;
}

// ---------- Registry-level NOT_LINKED_BECAUSE ledger (LOCAL, enum/scalar-only) ----------

function loadSqlite() {
  try {
    const { DatabaseSync } = require('node:sqlite');
    return DatabaseSync;
  } catch (_) {
    return null;
  }
}

function rejectionDbPath(roomsHome) {
  return path.join(roomsHome, '.rooms', 'cross-room-rejections.db');
}

// Open the rejection ledger (create dir + schema if needed), hand it to fn, close
// afterward. Open/close per call, mirroring cross-room-store's discipline. Returns
// fallback when node:sqlite is absent (never throws).
function withRejectionStore(roomsHome, fallback, fn) {
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
    // <roomsHome>/.rooms/cross-room-rejections.db at all, and it would run 13
    // CREATE TABLEs plus five room migrations against a store that has none of
    // them.
    db = new DatabaseSync(rejectionDbPath(roomsHome), { timeout: 5000 });
    db.exec('PRAGMA journal_mode = WAL');
    db.exec(
      'CREATE TABLE IF NOT EXISTS cross_room_rejections (' +
      '  source_id TEXT NOT NULL,' +
      '  target_id TEXT NOT NULL,' +
      '  source_room TEXT NOT NULL,' +
      '  target_room TEXT NOT NULL,' +
      '  edge_type TEXT NOT NULL,' +
      '  relevance REAL,' +
      '  signal TEXT,' +
      '  rejected_at INTEGER,' +
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

// writeNotLinked(roomsHome, params) -> { ok } | { ok:false, reason }
// The rejection-is-data write. Enum/scalar-only; an over-long or non-scalar field
// is rejected without a throw (mirrors the cross-room-store Part-8 fence).
function writeNotLinked(roomsHome, params) {
  if (typeof roomsHome !== 'string' || roomsHome.length === 0) return { ok: false, reason: 'invalid_rooms_home' };
  if (!params || typeof params !== 'object') return { ok: false, reason: 'invalid_params' };
  const { source_id, target_id, source_room, target_room } = params;
  if (typeof source_id !== 'string' || source_id.length === 0) return { ok: false, reason: 'invalid_source_id' };
  if (typeof target_id !== 'string' || target_id.length === 0) return { ok: false, reason: 'invalid_target_id' };
  if (typeof source_room !== 'string' || source_room.length === 0) return { ok: false, reason: 'invalid_source_room' };
  if (typeof target_room !== 'string' || target_room.length === 0) return { ok: false, reason: 'invalid_target_room' };
  const signal = (typeof params.signal === 'string' && params.signal.length <= MAX_SCALAR_STRING) ? params.signal : null;
  const relevance = typeof params.relevance === 'number' ? params.relevance : null;
  const rejected_at = typeof params.rejected_at === 'number' ? params.rejected_at : null;
  const session_id = (typeof params.session_id === 'string' && params.session_id.length <= MAX_SCALAR_STRING) ? params.session_id : null;

  return withRejectionStore(roomsHome, { ok: false, reason: 'sqlite_unavailable' }, function (db) {
    try {
      db.prepare(
        'INSERT INTO cross_room_rejections ' +
        '  (source_id, target_id, source_room, target_room, edge_type, relevance, signal, rejected_at, session_id) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
        'ON CONFLICT(source_id, target_id, edge_type) DO UPDATE SET ' +
        '  source_room = excluded.source_room, target_room = excluded.target_room, ' +
        '  relevance = excluded.relevance, signal = excluded.signal, ' +
        '  rejected_at = excluded.rejected_at, session_id = excluded.session_id'
      ).run(source_id, target_id, source_room, target_room, NOT_LINKED_EDGE_TYPE,
        relevance, signal, rejected_at, session_id);
    } catch (e) {
      return { ok: false, reason: 'rejection_write_failed', detail: String(e.message || '').slice(0, 80) };
    }
    return { ok: true, edge_type: NOT_LINKED_EDGE_TYPE, source: source_id, target: target_id };
  });
}

// readNotLinked(roomsHome, slug) -> Array<rejection>. Read-only; never throws.
function readNotLinked(roomsHome, slug) {
  if (typeof roomsHome !== 'string' || typeof slug !== 'string' || slug.length === 0) return [];
  return withRejectionStore(roomsHome, [], function (db) {
    try {
      return db.prepare(
        'SELECT * FROM cross_room_rejections WHERE source_room = ? OR target_room = ?'
      ).all(slug, slug);
    } catch (_e) {
      return [];
    }
  });
}

// ---------- The F.8 basket render (reuse, no new shape) ----------

/**
 * renderUmbilicalBasket(candidates, opts) -> { zones, contract }
 *
 * Reuses renderShapeF8: each candidate becomes a toggle whose confidence is its
 * relevance scalar, so a candidate >= 0.70 renders PRE-CHECKED (display-only,
 * NEVER auto-applied). Nothing writes here -- this is render only.
 */
function renderUmbilicalBasket(candidates, opts) {
  opts = opts || {};
  const list = Array.isArray(candidates) ? candidates : [];
  const options = [];
  for (const c of list) {
    const label = labelFor(c);
    if (!label) continue;
    options.push({ label: label, confidence: (typeof c.relevance === 'number') ? c.relevance : null });
  }
  const rendered = shapeF8.renderShapeF8({
    options: options,
    header: (typeof opts.header === 'string' && opts.header.length > 0) ? opts.header : '-- mindrianOS -- cross-room -- link --',
    personaContext: opts.personaContext,
  });
  // Declare the composed HITL shape on the contract (F.8; no new shape minted).
  rendered.contract.hitl_shape = HITL_SHAPE;
  return rendered;
}

// ---------- The per-item closer supplied to consumeF8Fanout ----------

/**
 * makeUmbilicalCloser(gateCtx) -> { closeOffer }
 *
 * The closer consumeF8Fanout calls PER confirmed item. The two-channel idiom:
 *   - OUTCOME channel: closeArgs.pick is the outcome keyword ('accept' | 'reject').
 *   - REACH channel: closeArgs.offer.command is the toggle label (= target_id),
 *     which maps back to the candidate.
 * accept -> ONE UMBILICAL_TO edge via the Plan-04 store chokepoint.
 * reject -> ONE NOT_LINKED_BECAUSE row (rejection-is-data). Both are SUCCESSFUL
 * closes (ok:true) so a per-item reject never aborts the confirmed fan-out.
 */
function makeUmbilicalCloser(gateCtx) {
  return {
    closeOffer: function (closeArgs) {
      const a = (closeArgs && typeof closeArgs === 'object') ? closeArgs : {};
      const label = (a.offer && typeof a.offer.command === 'string') ? a.offer.command : null;
      const cand = label ? gateCtx.byLabel[label] : null;
      if (!cand) return { ok: false, reason: 'unknown_candidate' };

      if (a.pick === 'accept') {
        const r = gateCtx.store.writeUmbilicalEdge(gateCtx.roomsHome, {
          source_id: gateCtx.source_id,
          target_id: cand.target_id,
          source_room: gateCtx.source_room,
          target_room: cand.target_room,
          edge_type: crossRoomStore.CROSS_ROOM_EDGE_TYPE,
          properties: {
            relevance: cand.relevance,
            signal: cand.signal,
            linked_at: gateCtx.linked_at,
            session_id: gateCtx.session_id,
          },
        });
        if (r && r.ok) {
          gateCtx.linked.push({
            target_id: cand.target_id,
            target_room: cand.target_room,
            relevance: cand.relevance,
            signal: cand.signal,
            edge_type: crossRoomStore.CROSS_ROOM_EDGE_TYPE,
          });
          return { ok: true, edge_type: crossRoomStore.CROSS_ROOM_EDGE_TYPE };
        }
        return { ok: false, reason: (r && r.reason) ? r.reason : 'edge_write_failed' };
      }

      if (a.pick === 'reject') {
        const rr = gateCtx.rejectionSink.writeNotLinked(gateCtx.roomsHome, {
          source_id: gateCtx.source_id,
          target_id: cand.target_id,
          source_room: gateCtx.source_room,
          target_room: cand.target_room,
          signal: cand.signal,
          relevance: cand.relevance,
          rejected_at: gateCtx.linked_at,
          session_id: gateCtx.session_id,
        });
        if (rr && rr.ok) {
          gateCtx.notLinked.push({
            target_id: cand.target_id,
            target_room: cand.target_room,
            signal: cand.signal,
            edge_type: NOT_LINKED_EDGE_TYPE,
          });
          return { ok: true, edge_type: NOT_LINKED_EDGE_TYPE };
        }
        return { ok: false, reason: (rr && rr.reason) ? rr.reason : 'rejection_write_failed' };
      }

      // defer / any other outcome: no cross-room write (never auto-attach).
      return { ok: false, reason: 'unsupported_outcome' };
    },
  };
}

// ---------- The composed gate ----------

/**
 * runUmbilicalGate(args) -> { ok, hitl_shape, rendered, appliedCount, linked, not_linked, items }
 *
 * Composes render + consumeF8Fanout on ONE confirm. NEVER auto-attaches: a
 * candidate only links when its label appears in `accepted` (the CONFIRMED toggle
 * state). Pre-check (>=0.70) is display-only and does NOT imply acceptance.
 *
 * args:
 *   roomsHome    -- the ~/MindrianRooms root (registry store lives at .rooms/).
 *   source_id    -- the current focus item id (edge source).
 *   source_room  -- the current room slug.
 *   session_id   -- the confirming session (scalar prop).
 *   candidates   -- [{ target_id, target_room, relevance, signal }] from the emitter.
 *   accepted     -- array of toggle labels (target_ids) the navigator confirmed ON.
 *                   Omit / empty => every candidate is a NOT_LINKED_BECAUSE (all OFF).
 *   store        -- (test seam) defaults to cross-room-store.
 *   rejectionSink-- (test seam) defaults to this module's writeNotLinked ledger.
 */
function runUmbilicalGate(args) {
  const a = (args && typeof args === 'object') ? args : {};
  const roomsHome = a.roomsHome;
  const source_id = a.source_id;
  const source_room = a.source_room;
  const session_id = (typeof a.session_id === 'string') ? a.session_id : null;
  const candidates = Array.isArray(a.candidates) ? a.candidates : [];
  const acceptedSet = new Set(Array.isArray(a.accepted) ? a.accepted : []);
  const store = (a.store && typeof a.store.writeUmbilicalEdge === 'function') ? a.store : crossRoomStore;
  const rejectionSink = (a.rejectionSink && typeof a.rejectionSink.writeNotLinked === 'function')
    ? a.rejectionSink
    : { writeNotLinked: writeNotLinked };

  const rendered = renderUmbilicalBasket(candidates, { header: a.header, personaContext: a.personaContext });

  // Map each toggle label back to its candidate; build the fan-out verbs + picks.
  const byLabel = {};
  const verbs = [];
  const picks = [];
  for (const c of candidates) {
    const label = labelFor(c);
    if (!label || byLabel[label]) continue; // skip malformed / duplicate
    byLabel[label] = c;
    verbs.push(label);
    picks.push({ verb: label, outcome: acceptedSet.has(label) ? 'accept' : 'reject' });
  }

  const gateCtx = {
    roomsHome: roomsHome,
    source_id: source_id,
    source_room: source_room,
    session_id: session_id,
    linked_at: Date.now(),
    byLabel: byLabel,
    store: store,
    rejectionSink: rejectionSink,
    linked: [],
    notLinked: [],
  };

  const roomState = {
    closer: makeUmbilicalCloser(gateCtx),
    offer: {}, // the shared scaffold; the per-item command carries the label
    db: {},    // Part 9: the closer never opens room.db; the registry store owns writes
  };

  const fan = fanout.consumeF8Fanout({
    priorPayload: { verbs: verbs },
    picks: picks,
    roomState: roomState,
  });

  return {
    ok: !!(fan && fan.ok),
    hitl_shape: HITL_SHAPE,
    rendered: rendered,
    appliedCount: (fan && typeof fan.appliedCount === 'number') ? fan.appliedCount : 0,
    linked: gateCtx.linked,
    not_linked: gateCtx.notLinked,
    items: (fan && Array.isArray(fan.items)) ? fan.items : [],
  };
}

module.exports = {
  HITL_SHAPE: HITL_SHAPE,
  NOT_LINKED_EDGE_TYPE: NOT_LINKED_EDGE_TYPE,
  PRE_CHECK_THRESHOLD: PRE_CHECK_THRESHOLD,
  labelFor: labelFor,
  renderUmbilicalBasket: renderUmbilicalBasket,
  makeUmbilicalCloser: makeUmbilicalCloser,
  runUmbilicalGate: runUmbilicalGate,
  writeNotLinked: writeNotLinked,
  readNotLinked: readNotLinked,
};
