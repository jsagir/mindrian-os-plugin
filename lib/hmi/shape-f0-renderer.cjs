/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.2-05 -- Shape F.0 Mini Decision Gate renderer (UISEL-88.2-07).
 *
 * Implements F.0 per CONTEXT.md amendment 2026-04-29 + D-AMEND-01.
 * EXACTLY 3 verbs: Approve / Reject (with reason) / Defer.
 * NO Free-Text slot (Reject reason captured as REJECTED_BECAUSE typed edge property).
 * Single-line ASCII border (visual sub-decision cue per spec).
 * persona-AGNOSTIC visually (D-AMEND-04).
 * F.0 ALWAYS produces a typed edge -- no silent dismiss path (Canon Part 4).
 *
 * REJECTED_BECAUSE edge schema (DISCRETION-AMEND-03 RESOLVED):
 *   { reason, rejected_at, parent_decision_id, actor_id?, confidence_self_report? }
 *   - Edge label: REJECTED_BECAUSE
 *   - Edge written via Phase 109 lib/core/navigation/memory-events logEvent
 *   - eventType: 'selector_rejection_captured' (one of 4 new strings from 88.2-00)
 *
 * Pure CJS, node built-ins only, zero new runtime deps (Phase 87 invariant).
 * Canon Part 8: zero Brain egress; reason text is graph-local only.
 */
'use strict';

const F0_VERBS = ['Approve', 'Reject', 'Defer'];
const DEFAULT_HEADER = '-- mindrianOS -- mini -- pick --';
const MARKER_ROW = '▷';      // 12-glyph vocab triangle marker (matches 88.2-01 ▷)
const REJECTION_EVENT_TYPE = 'selector_rejection_captured';

/**
 * Render F.0 Mini Decision Gate.
 * @param {object} [input]
 * @param {number} [input.tier]                 0/1/2/3 (mode A if >=2, B otherwise)
 * @param {string} [input.header]               Optional override header
 * @param {string} [input.body]                 The WHAT being decided (claim/question text)
 * @param {string} [input.parent_decision_id]   Surfaced in contract for downstream edge wiring
 * @returns {{zones, contract}}
 */
function renderShapeF0(input) {
  const opts = (input && typeof input === 'object') ? input : {};
  const tier = (typeof opts.tier === 'number') ? opts.tier : 0;
  const mode = (tier >= 2) ? 'A' : 'B';
  const header = (typeof opts.header === 'string' && opts.header.length > 0) ? opts.header : DEFAULT_HEADER;
  const bodyText = (typeof opts.body === 'string' && opts.body.length > 0) ? opts.body : '';
  const parentDecisionId = (typeof opts.parent_decision_id === 'string' && opts.parent_decision_id.length > 0)
    ? opts.parent_decision_id : null;

  // Compose body rows. Each verb gets a triangle marker (Mode A and Mode B both -- F.0 carries no RECOMMENDED).
  const rows = F0_VERBS.map((v, i) => {
    const suffix = (v === 'Approve') ? '  -- cascade now'
                 : (v === 'Reject')  ? '   -- capture reason -> graph data'
                 :                     '    -- queue for milestone audit';
    return MARKER_ROW + ' ' + (i + 1) + ') ' + v + suffix;
  });
  const body = (bodyText ? bodyText + '\n\n' : '') + rows.join('\n');

  return {
    zones: { header: header, body: body, signals: '', footer: null },
    contract: {
      shape: 'F.0',
      keyboard: 'askuserquestion',
      verbs: F0_VERBS.slice(),    // defensive copy
      freeTextOffered: false,     // closed-vocab carve-out (dispatcher respects)
      mode: mode,
      recommended: null,          // F.0 carries no RECOMMENDED (sub-decision shape)
      border_style: 'single',     // visual cue scalar
      parent_decision_id: parentDecisionId,
    },
  };
}

/**
 * Build and emit a REJECTED_BECAUSE typed edge to room.db via Phase 109.
 * Graceful-fail envelope -- never throws.
 *
 * @param {object} args
 * @param {string} args.roomDir
 * @param {string} args.reason                 Required, non-empty.
 * @param {string} args.parent_decision_id     Required, non-empty.
 * @param {string} [args.actor_id]             Optional Cowork scalar handle.
 * @param {number} [args.confidence_self_report] Optional 1-5 integer.
 * @returns {{ok:boolean, reason?:string, eventId?:string}}
 */
function buildRejectedBecauseEdge(args) {
  try {
    const a = (args && typeof args === 'object') ? args : {};
    if (typeof a.reason !== 'string' || a.reason.length === 0) {
      return { ok: false, reason: 'invalid_reason' };
    }
    if (typeof a.parent_decision_id !== 'string' || a.parent_decision_id.length === 0) {
      return { ok: false, reason: 'invalid_parent_decision_id' };
    }
    if (a.confidence_self_report !== undefined) {
      const c = a.confidence_self_report;
      if (!Number.isInteger(c) || c < 1 || c > 5) {
        return { ok: false, reason: 'invalid_confidence' };
      }
    }
    const { EVENT_TYPES, logEvent } = require('../core/navigation/memory-events.cjs');
    if (!EVENT_TYPES.has(REJECTION_EVENT_TYPE)) {
      return { ok: false, reason: 'event_type_not_registered' };
    }
    // Project standard: node:sqlite DatabaseSync per lib/core/lazygraph-ops.cjs.
    // better-sqlite3 is documented as broken in lib/import/PRECONDITIONS.md.
    let DatabaseSync;
    try { ({ DatabaseSync } = require('node:sqlite')); }
    catch (_e) { return { ok: false, reason: 'sqlite_unavailable' }; }
    const fs = require('node:fs');
    const path = require('node:path');
    if (typeof a.roomDir !== 'string' || a.roomDir.length === 0) {
      return { ok: false, reason: 'invalid_room_dir' };
    }
    const dbPath = path.join(a.roomDir, '.mindrian', 'room.db');
    if (!fs.existsSync(dbPath)) {
      return { ok: false, reason: 'db_not_initialized' };
    }
    // Phase 276 (C4) write-safety: fold the busy-timeout constructor option
    // into the DatabaseSync options object. Without it, node:sqlite fails a
    // contended write in 0ms with SQLITE_BUSY; the option turns that into a
    // roughly 5s busy-wait window. Strictly more forgiving - a longer wait,
    // never a new failure mode - because WAL readers never block writers.
    // Adapted from the one correct site, lib/core/room-db.cjs:242-251.
    const db = new DatabaseSync(dbPath, { timeout: 5000 });
    try {
      const props = {
        reason: a.reason,
        rejected_at: new Date().toISOString(),
        parent_decision_id: a.parent_decision_id,
      };
      if (typeof a.actor_id === 'string' && a.actor_id.length > 0) props.actor_id = a.actor_id;
      if (a.confidence_self_report !== undefined) props.confidence_self_report = a.confidence_self_report;
      return logEvent(db, REJECTION_EVENT_TYPE, props);
    } finally {
      db.close();
    }
  } catch (_e) {
    return { ok: false, reason: 'edge_build_threw_caught' };
  }
}

module.exports = {
  renderShapeF0,
  buildRejectedBecauseEdge,
  F0_VERBS: F0_VERBS.slice(),
  _internal: { REJECTION_EVENT_TYPE },
};
