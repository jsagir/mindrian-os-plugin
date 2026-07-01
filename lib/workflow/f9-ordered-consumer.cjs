'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 188-07 -- consumeF9Ordered: the F.9 ordered cascade consumer (SFS-05).
 * ================================================================================
 * F.8's fan-out (lib/workflow/f8-fanout-consumer.cjs) loops an UNORDERED confirmed
 * set and writes N edges on ONE confirm. F.9 walks the cascade IN ORDER (array order
 * IS meaning) and applies each item's ORDERED outcome (Decision 13, "rejection is
 * data"):
 *   APPROVE -> write the edge,
 *   REJECT  -> record NOT-applied + the reason (the reason becomes a graph node),
 *   DEFER   -> leave a CONTRADICTS-linked competing-claim pair (both claims survive).
 * The outer ordered loop clones the F.8 fan-out; the three-way per-item resolve is
 * the only net-new structure.
 *
 * Part 9 chokepoint invariant (the load-bearing rule, f8-fanout-consumer.cjs:11-17):
 * this consumer NEVER opens room.db. The caller owns the handle and passes a
 * populated roomState.db; every write routes through lib/core/navigation.cjs (the
 * single SQL chokepoint) via the resolved graph writer. No native / node sqlite
 * require; no room-db open of its own (the source-grep in the suite proves the
 * forbidden requires are absent). A test seam lets the caller inject roomState.graph
 * (a spy) so the three ordered outcomes can be counted WITHOUT a live room.db.
 *
 * Degrade-never-block PER ITEM: a malformed / unmatched / writer-failed item returns
 * a structured no-op and does NOT abort the rest of the ordered cascade. The consumer
 * returns an applied count + a per-item result array (order preserved).
 *
 * SEED-039 is the CONSUMER of F.9, NOT its owner: the version-stamp / multi-session
 * reconcile machinery is DEFERRED and is deliberately NOT imported here. This module
 * ships F.9 the SHAPE; the multi-session reconcile rides it later.
 *
 * Framework: pure CJS, zero new dependencies (Phase 87 invariant). No em-dashes.
 * No emoji. No Brain call.
 *
 * License: BSL 1.1.
 */

const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..');

// Lazy + tolerant require (mirrors the F.8 fan-out): a navigation load failure
// degrades to a structured no-op rather than crashing the turn.
function _safeRequire(p) {
  try {
    return require(p);
  } catch (_e) {
    return null;
  }
}

// The closed ordered-outcome vocabulary (canon literal tokens). Reused, NOT a
// parallel enum -- it folds onto the four-outcome OUTCOMES via _normalizeOrdered.
const ORDERED_OUTCOMES = Object.freeze(['APPROVE', 'REJECT', 'DEFER']);

// The edge type a DEFER leaves: BOTH claims survive as competing claims linked by a
// CONTRADICTS edge (Decision 13; the reconcile happens later, the drop never does).
const CONTRADICTS = 'CONTRADICTS';

function _normalizeOrdered(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  const lower = raw.toLowerCase();
  if (lower === 'approve' || lower === 'accept') return 'APPROVE';
  if (lower === 'reject') return 'REJECT';
  if (lower === 'defer') return 'DEFER';
  return null;
}

// Resolve { item_id, outcome, reason, sentence, claim } from one ordered element.
function _resolveItem(raw, index) {
  if (!raw || typeof raw !== 'object') {
    return { item_id: 'item:' + String(index), outcome: null, reason: null, sentence: null, claim: null };
  }
  const item_id = (typeof raw.item_id === 'string' && raw.item_id.length > 0)
    ? raw.item_id
    : ((typeof raw.id === 'string' && raw.id.length > 0) ? raw.id : 'item:' + String(index));
  const outcome = _normalizeOrdered(raw.outcome);
  const reason = (typeof raw.reason === 'string' && raw.reason.length > 0) ? raw.reason : null;
  const sentence = (typeof raw.sentence === 'string' && raw.sentence.length > 0) ? raw.sentence : null;
  const claim = (typeof raw.claim === 'string' && raw.claim.length > 0)
    ? raw.claim
    : ((typeof raw.label === 'string' && raw.label.length > 0) ? raw.label : null);
  return { item_id, outcome, reason, sentence, claim };
}

// Resolve the graph writer. The caller MAY inject roomState.graph (a spy or a surface
// writer exposing writeEdge / recordRejection / leaveContradictsPair) so the ordered
// walk is testable WITHOUT a live room.db (Part 9). Otherwise build a thin adapter
// over navigation.cjs -- the single SQL chokepoint -- that NEVER opens room.db and
// writes only over the caller-supplied roomState.db handle.
function _resolveGraph(roomState) {
  const injected = roomState && typeof roomState === 'object' ? roomState.graph : null;
  if (injected && typeof injected.writeEdge === 'function'
      && typeof injected.recordRejection === 'function'
      && typeof injected.leaveContradictsPair === 'function') {
    return injected;
  }

  // Production adapter: route every write through navigation.cjs (the chokepoint).
  // The consumer opens NO room.db; it forwards the caller-owned db handle only.
  const nav = _safeRequire(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
  if (!nav || typeof nav.writeEdge !== 'function') return null;
  const db = roomState && typeof roomState === 'object' ? roomState.db : null;

  return {
    // APPROVE: write the cascade edge over the caller-owned handle.
    writeEdge: function (edge) {
      return nav.writeEdge(Object.assign({ db: db }, edge));
    },
    // REJECT: record NOT-applied + reason (rejection is data) as a typed edge.
    recordRejection: function (rej) {
      return nav.writeEdge(Object.assign({ db: db, type: 'NOT_APPLIED' }, rej));
    },
    // DEFER: leave BOTH claims as a CONTRADICTS-linked competing pair.
    leaveContradictsPair: function (pair) {
      return nav.writeEdge(Object.assign({ db: db, type: CONTRADICTS }, pair));
    },
  };
}

// consumeOne(item, graph) -> { ok, item_id, outcome, reason?, kind }
// Applies the ordered three-way resolve for ONE cascade item over the resolved graph
// writer. A no-op returns { ok:false, reason } and writes nothing (degrade-never-block).
function _consumeOne(item, graph) {
  const outcome = item.outcome;
  if (outcome === null || ORDERED_OUTCOMES.indexOf(outcome) === -1) {
    return { ok: false, item_id: item.item_id, outcome: null, reason: 'unmatched' };
  }

  try {
    if (outcome === 'APPROVE') {
      // APPROVE writes the edge.
      const r = graph.writeEdge({ item_id: item.item_id, claim: item.claim, sentence: item.sentence });
      if (!r || r.ok !== true) return { ok: false, item_id: item.item_id, outcome: outcome, reason: (r && r.reason) ? r.reason : 'write_failed' };
      return { ok: true, item_id: item.item_id, outcome: outcome, kind: 'edge' };
    }
    if (outcome === 'REJECT') {
      // REJECT records NOT-applied + the reason (Decision 13: rejection is data).
      const r = graph.recordRejection({ item_id: item.item_id, claim: item.claim, reason: item.reason || null });
      if (!r || r.ok !== true) return { ok: false, item_id: item.item_id, outcome: outcome, reason: (r && r.reason) ? r.reason : 'write_failed' };
      return { ok: true, item_id: item.item_id, outcome: outcome, kind: 'rejection', reason: item.reason || null };
    }
    // DEFER leaves a CONTRADICTS-linked competing-claim pair (both survive).
    const r = graph.leaveContradictsPair({ item_id: item.item_id, claim: item.claim, edge_type: CONTRADICTS });
    if (!r || r.ok !== true) return { ok: false, item_id: item.item_id, outcome: outcome, reason: (r && r.reason) ? r.reason : 'write_failed' };
    return { ok: true, item_id: item.item_id, outcome: outcome, kind: 'contradicts' };
  } catch (_e) {
    return { ok: false, item_id: item.item_id, outcome: outcome, reason: 'writer_threw' };
  }
}

// ---------------------------------------------------------------------------
// consumeF9Ordered({ items, roomState }) -> { ok, applied, items }
//
// items:     the ORDERED cascade ([{ item_id?, claim?, outcome, reason? }, ...]) from
//            the F.9 ordered-capture adapter. Array order IS meaning (walked in order).
// roomState: the caller-owned room state; roomState.db MUST be populated by the
//            caller (this consumer NEVER opens room.db; Part 9). roomState.graph MAY
//            be injected (writeEdge / recordRejection / leaveContradictsPair) for tests.
//
// Walks the cascade IN ORDER and applies each item's ordered outcome: APPROVE writes
// the edge, REJECT records the reason, DEFER leaves a CONTRADICTS pair. One bad item
// does NOT abort the cascade (degrade-never-block); `applied` counts the items that
// wrote. A cold / empty / graph-absent turn returns a structured no-op.
// ---------------------------------------------------------------------------
function consumeF9Ordered(args) {
  const a = (args && typeof args === 'object') ? args : {};
  const roomState = (a.roomState && typeof a.roomState === 'object') ? a.roomState : {};
  const rawItems = Array.isArray(a.items) ? a.items : null;

  if (!rawItems || rawItems.length === 0) {
    return { ok: false, reason: 'no_items', applied: 0, items: [] };
  }

  const graph = _resolveGraph(roomState);
  if (!graph) {
    return { ok: false, reason: 'graph_unavailable', applied: 0, items: [] };
  }

  let applied = 0;
  const results = [];
  for (let i = 0; i < rawItems.length; i++) {
    const item = _resolveItem(rawItems[i], i);
    const res = _consumeOne(item, graph);
    results.push(res);
    if (res.ok === true) applied++;
  }

  // The confirm itself succeeded (the ordered walk ran); per-item failures degrade
  // but never fail the cascade. ok:true so a downstream reconcile can act on `applied`.
  return { ok: true, applied: applied, items: results };
}

module.exports = {
  consumeF9Ordered: consumeF9Ordered,
  ORDERED_OUTCOMES: ORDERED_OUTCOMES,
  CONTRADICTS: CONTRADICTS,
};
