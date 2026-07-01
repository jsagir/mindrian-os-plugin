'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 194-06 Task 3 (PSB-10 / D-07) -- map a RECONCILE (lost-update) conflict
 * onto the SHIPPED F.9 ordered per-item gate. Part 11: 194 COMPOSES the 188 shape,
 * it builds NO new selector. The DEFER -> CONTRADICTS and REJECT -> NOT_APPLIED
 * mappings are ALREADY the shipped F.9 semantics; the ONLY reconcile-specific
 * branch is APPROVE, which re-runs the held node UPDATE ("yours wins") through the
 * navigation chokepoint, stamping a fresh last_modified_at, node stays proposed
 * (Part 9: a human still confirms a truth-claim).
 *
 * Three doors:
 *   buildReconcileGate(conflicts, opts) -> { shape:'F.9', items, zones, contract }
 *     render the conflict set through renderShapeF9 (array order IS meaning).
 *   applyReconcileDecision({ conflict, outcome, db, roomState }) -> { ok, kind }
 *     apply ONE per-item outcome through the reconcile-specific graph adapter.
 *   reconcileViaF9({ conflicts, db, roomDir, interactive, decisions, home, room })
 *     the orchestrator: build the gate, then either (interactive) drive
 *     consumeF9Ordered with the caller's decisions, or (async/no-turn) auto-DEFER
 *     every item (leave the data as competing claims, never lose it) and queue the
 *     pending reconcile for the next interactive turn.
 *
 * Open Q1 resolution (async write context): a background writer with no live
 * navigator turn CANNOT answer F.9. Default to DEFER (the CONTRADICTS / pending
 * path, never a data loss) and surface it next interactive turn. This is NOT a
 * D-07 violation -- D-07 governs the INTERACTIVE case; the async default is the
 * documented safe fallback.
 *
 * Fail OPEN: any adapter/render error degrades to a structured no-op, never a
 * throw into the turn. Canon Part 8: LOCAL only, zero Brain egress, zero network.
 * Pure CJS, node built-ins only, zero deps. NO em-dashes. No emoji.
 *
 * License: BSL 1.1.
 */

const path = require('node:path');
const fs = require('node:fs');

const REPO = path.resolve(__dirname, '..', '..');

function _safeRequire(p) {
  try { return require(p); } catch (_e) { return null; }
}

const renderer = _safeRequire(path.join(REPO, 'lib', 'hmi', 'shape-f9-renderer.cjs'));
const consumerMod = _safeRequire(path.join(REPO, 'lib', 'workflow', 'f9-ordered-consumer.cjs'));
const nav = _safeRequire(path.join(REPO, 'lib', 'core', 'navigation.cjs'));

// The claim line an F.9 item shows for a lost-update conflict. "<summary> -
// <session> changed this while you held it" (Pattern map, shape-f9 items).
function _conflictClaimLine(c) {
  const nodeId = (c && typeof c.nodeId === 'string' && c.nodeId.length > 0) ? c.nodeId : 'node';
  const sess = (c && typeof c.bySession === 'string' && c.bySession.length > 0)
    ? c.bySession : 'another session';
  const summary = (c && typeof c.summary === 'string' && c.summary.length > 0) ? c.summary : nodeId;
  return summary + ' - ' + sess + ' changed this while you held it';
}

function _asList(conflicts) {
  if (Array.isArray(conflicts)) return conflicts;
  if (conflicts && typeof conflicts === 'object') return [conflicts];
  return [];
}

// buildReconcileGate(conflicts, opts) -> { shape:'F.9', items, zones, contract }.
// One conflict -> one ordered F.9 item. Renders through the SHIPPED renderShapeF9
// (no new shape). PAGE_CEILING untouched. Order IS meaning.
function buildReconcileGate(conflicts, opts) {
  const list = _asList(conflicts);
  const items = list.map(function (c, i) {
    return {
      item_id: (c && typeof c.nodeId === 'string' && c.nodeId.length > 0) ? c.nodeId : ('item:' + i),
      claim: _conflictClaimLine(c),
    };
  });

  let zones = null;
  let contract = null;
  if (renderer && typeof renderer.renderShapeF9 === 'function') {
    try {
      const r = renderer.renderShapeF9({
        items: items,
        header: (opts && typeof opts.header === 'string') ? opts.header : null,
        personaContext: (opts && typeof opts.personaContext === 'string') ? opts.personaContext : null,
      });
      if (r && typeof r === 'object') {
        zones = r.zones || null;
        contract = r.contract || null;
      }
    } catch (_e) {
      // Fail open: an unrenderable gate still returns a usable descriptor.
    }
  }

  return { shape: 'F.9', items: items, zones: zones, contract: contract };
}

// Re-apply the held (losing) write through the navigation chokepoint. Prefers a
// caller-supplied reapply closure (most general); falls back to the abstraction
// merge chokepoint when the held payload names an abstraction_level. No readVersion
// is threaded here -> the re-apply is UNCONDITIONAL (yours wins), stamps a fresh
// last_modified_at, and leaves the node proposed. Fail open on any error.
function _reapplyHeld(db, held) {
  if (!held || typeof held !== 'object') return { ok: false, reason: 'no_held' };
  try {
    if (typeof held.reapply === 'function') {
      const r = held.reapply(db);
      return (r && r.ok === true) ? { ok: true, kind: 'reapply' } : { ok: false, reason: (r && r.reason) || 'reapply_failed' };
    }
    if (typeof held.abstraction_level === 'string'
        && nav && typeof nav.persistAbstractionLevel === 'function'
        && typeof held.nodeId === 'string') {
      const r = nav.persistAbstractionLevel(db, {
        nodeId: held.nodeId,
        abstraction_level: held.abstraction_level,
      });
      return (r && r.ok === true) ? { ok: true, kind: 'reapply' } : { ok: false, reason: (r && r.reason) || 'reapply_failed' };
    }
    return { ok: false, reason: 'no_reapply_strategy' };
  } catch (_e) {
    return { ok: false, reason: 'reapply_threw' };
  }
}

// The reconcile-specific graph adapter passed to consumeF9Ordered. It MIRRORS the
// shipped makeDefaultGraphAdapter for REJECT/DEFER but OVERRIDES APPROVE to re-run
// the held UPDATE. Keyed by item_id so each per-item outcome resolves its own
// held payload + rival node. Every branch returns { ok } so the ordered walk can
// count applied outcomes.
function _makeReconcileGraph(roomState, byId) {
  const db = (roomState && typeof roomState === 'object') ? roomState.db : null;
  return {
    // APPROVE -> yours wins: re-run the held node UPDATE (fresh last_modified_at,
    // proposed). NOT a cascade edge (the reconcile-specific override).
    writeEdge: function (edge) {
      const entry = byId[edge.item_id];
      const held = entry && entry.held;
      return _reapplyHeld(db, held);
    },
    // REJECT -> theirs wins: the co-session's write STANDS; our held write is NOT
    // applied. NOT_APPLIED is not an edge type in the local vocabulary, so the
    // rejection is a structured record (rejection is data, Decision 13), not a bad
    // edge write. The row is left untouched.
    recordRejection: function (rej) {
      return { ok: true, kind: 'not_applied', item_id: rej.item_id, reason: rej.reason || null };
    },
    // DEFER -> both claims survive: when a DISTINCT rival node exists, write a
    // CONTRADICTS pair (held -> rival) as proposed. In a pure single-row lost
    // update there is no second node to link, so DEFER degrades to a structured
    // pending record (still never lose data). Fail open.
    leaveContradictsPair: function (pair) {
      const entry = byId[pair.item_id];
      const conflict = entry && entry.conflict;
      const nodeId = conflict && conflict.nodeId;
      const rival = conflict && conflict.rivalNodeId;
      if (typeof nodeId === 'string' && typeof rival === 'string' && nodeId !== rival
          && nav && typeof nav.writeEdge === 'function' && db) {
        try {
          const r = nav.writeEdge(db, {
            source_id: nodeId,
            target_id: rival,
            edge_type: 'CONTRADICTS',
            properties: { reconcile: true, review_status: 'proposed' },
          });
          if (r && r.ok === true) return { ok: true, kind: 'contradicts' };
          return { ok: false, reason: (r && r.reason) || 'edge_write_failed' };
        } catch (_e) {
          return { ok: false, reason: 'edge_write_threw' };
        }
      }
      // No distinct rival node: keep both as a pending competing claim (no data lost).
      return { ok: true, kind: 'pending_contradicts', item_id: pair.item_id };
    },
  };
}

// Best-effort persist of the pending reconcile so the next interactive turn can
// surface it. Fire-and-forget; LOCAL only (Part 8). Never throws.
function _queuePending(roomDir, pending) {
  if (!roomDir || !Array.isArray(pending) || pending.length === 0) return;
  try {
    const dir = path.join(roomDir, '.mindrian');
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, 'pending-reconcile.json');
    let existing = [];
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (Array.isArray(parsed)) existing = parsed;
    } catch (_e) {
      existing = [];
    }
    const merged = existing.concat(pending);
    const tmp = filePath + '.tmp.' + process.pid;
    fs.writeFileSync(tmp, JSON.stringify(merged, null, 2));
    fs.renameSync(tmp, filePath);
  } catch (_e) {
    // Fire-and-forget.
  }
}

// Normalize an outcome token to the frozen F.9 vocabulary. Default DEFER (safe).
function _normalizeOutcome(raw) {
  if (typeof raw !== 'string') return 'DEFER';
  const u = raw.trim().toUpperCase();
  if (u === 'APPROVE' || u === 'ACCEPT') return 'APPROVE';
  if (u === 'REJECT') return 'REJECT';
  return 'DEFER';
}

// applyReconcileDecision -- apply ONE outcome for ONE conflict through the
// reconcile graph adapter. Thin wrapper for granular callers / tests.
function applyReconcileDecision(argsIn) {
  const args = (argsIn && typeof argsIn === 'object') ? argsIn : {};
  const conflict = args.conflict || {};
  const outcome = _normalizeOutcome(args.outcome);
  const nodeId = (typeof conflict.nodeId === 'string') ? conflict.nodeId : 'node';
  const roomState = args.roomState || { db: args.db };
  const byId = {};
  byId[nodeId] = { conflict: conflict, held: args.held || conflict.held || null };
  const graph = _makeReconcileGraph(roomState, byId);
  try {
    if (outcome === 'APPROVE') return graph.writeEdge({ item_id: nodeId });
    if (outcome === 'REJECT') return graph.recordRejection({ item_id: nodeId, reason: args.reason || null });
    return graph.leaveContradictsPair({ item_id: nodeId });
  } catch (_e) {
    return { ok: false, reason: 'apply_threw' };
  }
}

// reconcileViaF9 -- the orchestrator. Build the F.9 gate, then resolve each item.
//   interactive === false -> auto-DEFER every item (never lose data) + queue the
//                            pending reconcile for the next interactive turn.
//   interactive === true  -> use args.decisions (map item_id/nodeId -> outcome);
//                            a missing decision defaults to DEFER (safe).
// Drives the SHIPPED consumeF9Ordered with the reconcile-specific graph adapter.
function reconcileViaF9(argsIn) {
  const args = (argsIn && typeof argsIn === 'object') ? argsIn : {};
  const conflicts = _asList(args.conflicts || args.conflict);
  const interactive = args.interactive === true;
  const db = args.db || null;
  const roomDir = (typeof args.roomDir === 'string') ? args.roomDir : null;

  const gate = buildReconcileGate(conflicts, args);

  // Key each conflict by its node id so the graph adapter resolves held + rival.
  const byId = {};
  for (let i = 0; i < conflicts.length; i++) {
    const c = conflicts[i] || {};
    const id = (typeof c.nodeId === 'string' && c.nodeId.length > 0) ? c.nodeId : ('item:' + i);
    byId[id] = { conflict: c, held: c.held || (args.held && i === 0 ? args.held : null) };
  }

  const decisions = (args.decisions && typeof args.decisions === 'object') ? args.decisions : {};
  const pending = [];

  // Build the ordered items with a resolved outcome per item (array order = meaning).
  const items = conflicts.map(function (c, i) {
    const id = (typeof c.nodeId === 'string' && c.nodeId.length > 0) ? c.nodeId : ('item:' + i);
    let outcome;
    if (!interactive) {
      outcome = 'DEFER'; // async/no-turn safe default (Open Q1).
      pending.push({ nodeId: id, readVersion: c.readVersion, current: c.current, queued_at: Date.now() });
    } else {
      outcome = _normalizeOutcome(decisions[id]);
    }
    return { item_id: id, claim: _conflictClaimLine(c), outcome: outcome, reason: c.reason || null };
  });

  if (!interactive) {
    _queuePending(roomDir, pending);
  }

  let consumed = { ok: false, applied: 0, items: [] };
  if (consumerMod && typeof consumerMod.consumeF9Ordered === 'function' && items.length > 0) {
    try {
      const graph = _makeReconcileGraph({ db: db }, byId);
      consumed = consumerMod.consumeF9Ordered({ items: items, roomState: { db: db, graph: graph } });
    } catch (_e) {
      consumed = { ok: false, applied: 0, items: [], reason: 'consume_threw' };
    }
  }

  return {
    ok: true,
    gate: gate,
    interactive: interactive,
    deferred: !interactive,
    applied: consumed.applied || 0,
    results: consumed.items || [],
    pending: pending,
  };
}

module.exports = {
  buildReconcileGate: buildReconcileGate,
  applyReconcileDecision: applyReconcileDecision,
  reconcileViaF9: reconcileViaF9,
};
