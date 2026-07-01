'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 189-03 (HITL Memory Governance; SEED-040 / HMG-04) -- map a governance
 * candidate's MULTI-SECTION soft-edit cascade onto the SHIPPED F.9 ordered
 * per-item gate. This is the ORDERED variant of the HOW decision: when a single
 * candidate's cascade touches MORE THAN ONE section (architecture.md's cascade
 * rule -- detect impact, soft-edit affected sections, APPROVE / REJECT / DEFER,
 * the decision becomes graph data), the navigator resolves it through an F.9
 * ordered per-item gate instead of the flat F.8 basket 189-02 ships for the
 * single-section case. Array order IS meaning: item 0 (the first affected
 * section) is decided first.
 *
 * Canon Part 7 (reuse before build): 189 COMPOSES the 188 F.9 shape + the 188
 * f9-ordered-consumer, it builds NO new selector and mints NO new scalar. This
 * module clones the EXACT idiom Phase 194-06's reconcile-f9-adapter.cjs used
 * (buildReconcileGate + a _makeReconcileGraph-style injected graph adapter passed
 * to consumeF9Ordered) for the DISTINCT multi-SECTION soft-edit case -- not a
 * lost-update conflict, a single candidate's cascade across several sections.
 *
 * Two doors:
 *   buildMemoryCascadeGate(candidate, opts) -> { shape:'F.9', items, zones, contract }
 *     render candidate.affected_sections through renderShapeF9 (array order IS
 *     meaning). PAGE_CEILING untouched. No new shape.
 *   memoryCascadeViaF9({ candidate, decisions, roomState }) -> { ok, applied, items }
 *     the orchestrator: build the ordered items from affected_sections zipped with
 *     the per-section decision map (missing -> DEFER, safe default), then drive the
 *     SHIPPED consumeF9Ordered with a memory-specific injected graph adapter.
 *
 * Per-item semantics (the memory-specific override of the shipped three-way):
 *   APPROVE -> write ONE REMEMBERED_AS edge scoped to that section.
 *   REJECT  -> write ONE NOT_REMEMBERED_BECAUSE edge scoped to that section only
 *              (rejection is data, Decision 13; UNLIKE reconcile's NOT_APPLIED
 *              non-write, NOT_REMEMBERED_BECAUSE is a legal ALLOWED_EDGE_TYPES
 *              member SEED-040 names explicitly, so it DOES persist a real edge).
 *   DEFER   -> when a DISTINCT rival section-claim exists, leave a CONTRADICTS pair
 *              (candidate -> rival) so both claims survive; otherwise fail open to a
 *              structured pending_contradicts no-op (never lose data).
 *
 * Canon Part 8: LOCAL only, zero Brain egress, zero network. Item claims are a
 * STRUCTURAL descriptor (candidate_id + section id) ONLY, never the section's
 * actual content body.
 * Canon Part 9: this module NEVER opens room.db; the caller owns the db handle and
 * every write routes through navigation.writeEdge (the single SQL chokepoint).
 *
 * Pure CJS, node built-ins only, zero deps. NO em-dashes. No emoji.
 *
 * License: BSL 1.1.
 */

const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..');

function _safeRequire(p) {
  try { return require(p); } catch (_e) { return null; }
}

const renderer = _safeRequire(path.join(REPO, 'lib', 'hmi', 'shape-f9-renderer.cjs'));
const consumerMod = _safeRequire(path.join(REPO, 'lib', 'workflow', 'f9-ordered-consumer.cjs'));
const nav = _safeRequire(path.join(REPO, 'lib', 'core', 'navigation.cjs'));

// The claim line an F.9 item shows for an affected section. STRUCTURAL only
// (Part 8): "remember <candidate_id> under <sectionId>" -- never the candidate's
// or the section's actual content body.
function _cascadeClaimLine(candidate, sectionId) {
  const cid = (candidate && typeof candidate.candidate_id === 'string' && candidate.candidate_id.length > 0)
    ? candidate.candidate_id : 'candidate';
  const sid = (typeof sectionId === 'string' && sectionId.length > 0) ? sectionId : 'section';
  return 'remember ' + cid + ' under ' + sid;
}

// Normalize the affected_sections field to an array of section ids.
function _affectedList(candidate) {
  const a = candidate && candidate.affected_sections;
  if (Array.isArray(a)) return a;
  return [];
}

// buildMemoryCascadeGate(candidate, opts) -> { shape:'F.9', items, zones, contract }.
// One affected section -> one ordered F.9 item. Renders through the SHIPPED
// renderShapeF9 (no new shape). PAGE_CEILING untouched. Order IS meaning: item 0
// is the FIRST affected section. Clones buildReconcileGate's body verbatim, swapping
// "conflict" for "affected section".
function buildMemoryCascadeGate(candidate, opts) {
  const list = _affectedList(candidate);
  const items = list.map(function (sectionId, i) {
    return {
      item_id: (typeof sectionId === 'string' && sectionId.length > 0) ? sectionId : ('item:' + i),
      claim: _cascadeClaimLine(candidate, sectionId),
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

// The memory-specific graph adapter passed to consumeF9Ordered. It MIRRORS
// _makeReconcileGraph's structure exactly (keyed by item_id, every branch returns
// { ok } so the ordered walk can count applied outcomes), but with memory-specific
// per-section branches. db is caller-owned throughout (Part 9); every write routes
// through nav.writeEdge(db, params) -- the single SQL chokepoint.
function _makeMemoryGraph(roomState, candidate, byId) {
  const db = (roomState && typeof roomState === 'object') ? roomState.db : null;
  const map = (byId && typeof byId === 'object') ? byId : {};
  return {
    // APPROVE -> write ONE REMEMBERED_AS edge scoped to this section.
    writeEdge: function (edge) {
      if (!(nav && typeof nav.writeEdge === 'function' && db)) {
        return { ok: false, reason: 'graph_unavailable' };
      }
      try {
        const r = nav.writeEdge(db, {
          source_id: candidate.candidate_id,
          target_id: edge.item_id,
          edge_type: 'REMEMBERED_AS',
          properties: {
            filed_as: candidate.chosen_verb || 'INFORMS',
            truth_state: candidate.truth_state || 'proposed',
            cascade: true,
          },
        });
        if (r && r.ok === true) return { ok: true, kind: 'remembered_as' };
        return { ok: false, reason: (r && r.reason) || 'edge_write_failed' };
      } catch (_e) {
        return { ok: false, reason: 'edge_write_threw' };
      }
    },
    // REJECT -> write ONE NOT_REMEMBERED_BECAUSE edge scoped to this section only.
    // UNLIKE reconcile's NOT_APPLIED non-write, this DOES persist a real edge:
    // NOT_REMEMBERED_BECAUSE is a legal ALLOWED_EDGE_TYPES member (SEED-040 names
    // it explicitly). Rejection is data (Decision 13 / Part 4).
    recordRejection: function (rej) {
      if (!(nav && typeof nav.writeEdge === 'function' && db)) {
        return { ok: false, reason: 'graph_unavailable' };
      }
      try {
        const r = nav.writeEdge(db, {
          source_id: candidate.candidate_id,
          target_id: rej.item_id,
          edge_type: 'NOT_REMEMBERED_BECAUSE',
          properties: {
            reason: rej.reason || 'navigator_declined',
            cascade: true,
          },
        });
        if (r && r.ok === true) return { ok: true, kind: 'not_remembered_because' };
        return { ok: false, reason: (r && r.reason) || 'edge_write_failed' };
      } catch (_e) {
        return { ok: false, reason: 'edge_write_threw' };
      }
    },
    // DEFER -> both claims survive: when a DISTINCT rival section-claim exists for
    // this section (byId[item_id] carries a rivalNodeId), write a CONTRADICTS edge
    // candidate -> rival as proposed. Otherwise fail open to a structured
    // pending_contradicts no-op (never lose data). Mirrors reconcile's DEFER exactly.
    leaveContradictsPair: function (pair) {
      const entry = map[pair.item_id];
      const rival = entry && typeof entry.rivalNodeId === 'string' ? entry.rivalNodeId : null;
      const cid = candidate && candidate.candidate_id;
      if (typeof cid === 'string' && typeof rival === 'string' && cid !== rival
          && nav && typeof nav.writeEdge === 'function' && db) {
        try {
          const r = nav.writeEdge(db, {
            source_id: cid,
            target_id: rival,
            edge_type: 'CONTRADICTS',
            properties: { reconcile: false, cascade: true, review_status: 'proposed' },
          });
          if (r && r.ok === true) return { ok: true, kind: 'contradicts' };
          return { ok: false, reason: (r && r.reason) || 'edge_write_failed' };
        } catch (_e) {
          return { ok: false, reason: 'edge_write_threw' };
        }
      }
      // No distinct rival: keep both as a pending competing claim (no data lost).
      return { ok: true, kind: 'pending_contradicts', item_id: pair.item_id };
    },
  };
}

// Normalize an outcome token to the frozen F.9 vocabulary. Default DEFER (safe) --
// mirrors reconcileViaF9's async-default posture: a missing / malformed decision
// never silently drops a section.
function _normalizeOutcome(raw) {
  if (typeof raw !== 'string') return 'DEFER';
  const u = raw.trim().toUpperCase();
  if (u === 'APPROVE' || u === 'ACCEPT') return 'APPROVE';
  if (u === 'REJECT') return 'REJECT';
  return 'DEFER';
}

// memoryCascadeViaF9({ candidate, decisions, roomState }) -> { ok, applied, items }.
// The orchestrator. Build the ordered items array from candidate.affected_sections
// zipped with the per-section decisions map (item_id -> 'APPROVE'|'REJECT'|'DEFER',
// default DEFER on a missing decision -- safe default), construct byId from
// candidate.section_rivals (optional, item_id -> rivalNodeId), then drive the
// SHIPPED consumeF9Ordered with the memory-specific injected graph adapter. Returns
// its { ok, applied, items } verbatim. NEVER opens room.db (Part 9); db is
// caller-owned throughout.
function memoryCascadeViaF9(argsIn) {
  const args = (argsIn && typeof argsIn === 'object') ? argsIn : {};
  const candidate = (args.candidate && typeof args.candidate === 'object') ? args.candidate : {};
  const decisions = (args.decisions && typeof args.decisions === 'object') ? args.decisions : {};
  const roomState = (args.roomState && typeof args.roomState === 'object') ? args.roomState : {};
  const db = roomState.db || null;

  const affected = _affectedList(candidate);
  const sectionReasons = (candidate.section_reasons && typeof candidate.section_reasons === 'object')
    ? candidate.section_reasons : {};

  // byId: item_id -> { rivalNodeId } from the optional section_rivals map.
  const rivals = (candidate.section_rivals && typeof candidate.section_rivals === 'object')
    ? candidate.section_rivals : {};
  const byId = {};
  for (let i = 0; i < affected.length; i++) {
    const sid = (typeof affected[i] === 'string' && affected[i].length > 0) ? affected[i] : ('item:' + i);
    const rival = (typeof rivals[sid] === 'string' && rivals[sid].length > 0) ? rivals[sid] : null;
    byId[sid] = { rivalNodeId: rival };
  }

  // Build the ordered items with a resolved outcome per item (array order = meaning).
  const items = affected.map(function (sectionId, i) {
    const sid = (typeof sectionId === 'string' && sectionId.length > 0) ? sectionId : ('item:' + i);
    const reason = (typeof sectionReasons[sid] === 'string' && sectionReasons[sid].length > 0)
      ? sectionReasons[sid] : null;
    return {
      item_id: sid,
      claim: _cascadeClaimLine(candidate, sid),
      outcome: _normalizeOutcome(decisions[sid]),
      reason: reason,
    };
  });

  let consumed = { ok: false, applied: 0, items: [] };
  if (consumerMod && typeof consumerMod.consumeF9Ordered === 'function' && items.length > 0) {
    try {
      const graph = _makeMemoryGraph({ db: db }, candidate, byId);
      consumed = consumerMod.consumeF9Ordered({ items: items, roomState: { db: db, graph: graph } });
    } catch (_e) {
      consumed = { ok: false, applied: 0, items: [], reason: 'consume_threw' };
    }
  }

  return {
    ok: consumed.ok === true,
    applied: consumed.applied || 0,
    items: consumed.items || [],
  };
}

module.exports = {
  buildMemoryCascadeGate: buildMemoryCascadeGate,
  memoryCascadeViaF9: memoryCascadeViaF9,
};
