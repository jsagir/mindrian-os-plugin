/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.2-06 -- Shape F.6 Plan Review Round renderer (UISEL-88.2-08 part 2).
 *
 * NAMING NOTE (R1 collision mitigation): this file is shape-f6-PLAN-REVIEW-renderer.cjs.
 * lib/hmi/shape-f6-renderer.cjs is Phase 101-01 JTBD-aware Next Move and is byte-stable
 * (sha256 baseline 1792535860abc791222bf0ecf59599d66e49ad9cc1606b3d8679fca2922150cf).
 * The umbrella 'F' branch in selector-dispatcher.cjs continues to route to the Phase
 * 101-01 module via JTBD logic; ONLY explicit requestedShape:'F.6' (string) routes
 * to this plan-review renderer.
 *
 * Replaces the 88.2-00 Wave-0 stub. Implements F.6 per CONTEXT.md amendment
 * 2026-04-29 + D-AMEND-01 (F.6 in scope of Phase 88.2 finish) + D-AMEND-04
 * (open-vocab parent shape with optional personaContext suffix) + D-AMEND-05
 * (Tier 2 persona-aware decoys via lib/hmi/decoy-tier.cjs dispatcher).
 *
 * F.6 invariants (CONTEXT.md spec body 2026-04-29):
 *   - Round size 15-30 questions (default 20). Real:decoy ratio 4:1 (16 + 4 at 20).
 *   - Real questions sourced from artifact's structural decomposition (tasks, gates,
 *     dependencies, acceptance criteria, success metrics).
 *   - Decoys NOT disclosed during round; debrief Shape A action report at round-end
 *     discloses (decoy-ethics contract, room/decisions/decision-decoy-ethics.md).
 *   - Each response writes ONE REVIEWED typed edge with properties
 *     { round_id, position, latency_ms, was_decoy, response, confidence_self_report }.
 *     Position-aware so debrief identifies decoys-caught vs decoys-missed.
 *   - Round can be paused via 'q' keystroke; resumes from same position; persists
 *     across session restarts (round-state graph node survives).
 *   - Cowork: parallel actor responses captured per actor_id (Cowork concurrency
 *     contract, room/decisions/decision-cowork-round-locking.md).
 *   - Double-line border (parent shape -- structural distinction from F.0 single-line).
 *
 * Three exports:
 *   1. renderShapeF6PlanReview({ tier, round_id?, position, totalQuestions, claim,
 *                                counts, header?, personaContext? })
 *      -> { zones, contract }
 *      Renders one question of N. The renderer is PURE (no FS reads, no DB writes);
 *      caller composes the round (decoy interleaving, real-question sourcing) by
 *      pairing this renderer with lib/hmi/decoy-tier.cjs and a per-position invocation.
 *
 *   2. buildReviewedEdge({ roomDir, round_id, position, latency_ms, was_decoy,
 *                          response, confidence_self_report?, reason?, actor_id? })
 *      -> { ok, reason?, eventId? }
 *      Writes one REVIEWED edge to room.db via Phase 109 logEvent with eventType
 *      'selector_response'. Closed-vocab response: confirm | reject | discuss |
 *      free-text. Graceful-fail envelope -- never throws.
 *
 *   3. emitRoundCompleted({ roomDir, round_id, real_count, decoy_count, tier })
 *      -> { ok, reason?, eventId? }
 *      Writes one f6_round_completed event at round close. Surfaces summary
 *      counts so the debrief Shape A action report can render without re-querying.
 *      Graceful-fail envelope -- never throws.
 *
 * Persona suffix (per D-AMEND-04 / 88.2-03 DISCRETION-AMEND-01 RESOLVED PATTERN):
 *   When personaContext is a non-empty string, the header gets ' ({personaContext} lens)'
 *   suffix. Cold-start (omitted/null/empty) preserves the persona-agnostic header
 *   byte-for-byte. The renderer stays PURE; the caller (dispatcher per 88.2-04) supplies
 *   the pre-computed string from readUserMd().role_blend per Phase 115 D-12.
 *
 * Glyph audit (12-glyph vocabulary per skills/ui-system/SKILL.md):
 *   ALLOWED: triangle (filled) / triangle (open) / square / dot / arrow.
 *   FORBIDDEN: rounded box corners, heavy horizontals/verticals, error/warn glyphs.
 *   The progress bar uses '=' and '-' ASCII (not heavy horizontal); count chips use plain text.
 *
 * Pure CJS, node built-ins only, zero deps (Phase 87 invariant).
 * Canon Part 4: every response produces a typed REVIEWED edge -- no silent dismiss.
 * Canon Part 8: all writes are LOCAL room.db; zero Brain egress.
 */
'use strict';

const F6_VERBS = ['Confirm', 'Reject', 'Discuss'];

// Closed-vocab response taxonomy. The renderer surfaces 3 verbs; the
// 'free-text' branch is reachable when a downstream prompt captures a
// reject reason (the reason becomes a property on the REVIEWED edge,
// not a separate response token).
const VALID_RESPONSES = ['confirm', 'reject', 'discuss', 'free-text'];

const RESPONSE_EVENT_TYPE = 'selector_response';
const ROUND_COMPLETED_EVENT_TYPE = 'f6_round_completed';

const MARKER_ROW = '▷';            // 12-glyph row marker (matches 88.2-01 + F.0)
const MARKER_PROGRESS = '▶';       // 12-glyph progress chevron
const DEFAULT_HEADER_PREFIX = '-- mindrianOS -- plan review --';

// Progress bar geometry: 20 cells, 5% each. Filled cells use '='; empty
// cells use '-'. ASCII only -- no heavy-horizontal box-drawing chars
// (forbidden in the 12-glyph audit; project-wide convention).
const PROGRESS_BAR_CELLS = 20;

/**
 * Render one question of a F.6 plan-review round.
 *
 * Returns { zones, contract } where:
 *   - zones.header carries 'ROUND {position} of {totalQuestions}' + optional
 *     ' ({personaContext} lens)' suffix
 *   - zones.body carries the user-story claim + 3 verb rows + progress bar +
 *     count chips
 *   - contract.shape === 'F.6'; freeTextOffered === false; verbs frozen at
 *     ['Confirm', 'Reject', 'Discuss']; recommended === null in both modes
 *     (closed-vocab; no Brain confidence marker on F.6 itself)
 */
function renderShapeF6PlanReview(input) {
  const opts = (input && typeof input === 'object') ? input : {};
  const tier = (typeof opts.tier === 'number') ? opts.tier : 0;
  const mode = (tier >= 2) ? 'A' : 'B';
  const position = (Number.isInteger(opts.position) && opts.position >= 1) ? opts.position : 1;
  const totalQuestions = (Number.isInteger(opts.totalQuestions) && opts.totalQuestions >= 1)
    ? opts.totalQuestions : 20;
  const claim = (typeof opts.claim === 'string') ? opts.claim : '';
  const counts = (opts.counts && typeof opts.counts === 'object') ? opts.counts : {};
  const personaContext = (typeof opts.personaContext === 'string' && opts.personaContext.length > 0)
    ? opts.personaContext : null;
  const roundId = (typeof opts.round_id === 'string' && opts.round_id.length > 0)
    ? opts.round_id : null;

  // Header: caller override OR canonical 'ROUND N of M -- PLAN REVIEW' format.
  const headerBase = (typeof opts.header === 'string' && opts.header.length > 0)
    ? opts.header
    : DEFAULT_HEADER_PREFIX + ' ROUND ' + position + ' of ' + totalQuestions;
  const composedHeader = personaContext
    ? (headerBase + ' (' + personaContext + ' lens)')
    : headerBase;

  // Body: user-story scaffold + 3 verb rows.
  const verbRows = F6_VERBS.map((v, i) => MARKER_ROW + ' ' + (i + 1) + ') ' + v);

  // Progress bar: 20 cells, 5% each. Filled = '=' / Empty = '-'.
  const pct = Math.floor((position / totalQuestions) * 100);
  const filledCells = Math.max(0, Math.min(PROGRESS_BAR_CELLS, Math.floor(pct / 5)));
  let bar = '[';
  for (let i = 0; i < PROGRESS_BAR_CELLS; i++) {
    bar += (i < filledCells) ? '=' : '-';
  }
  bar += ']';

  // Count chips: 'reject N   discuss N   confirm N' (plain text -- no decorative
  // glyphs). The order matches the CONTEXT.md spec body sample box.
  const cReject = Number.isInteger(counts.reject) ? counts.reject : 0;
  const cDiscuss = Number.isInteger(counts.discuss) ? counts.discuss : 0;
  const cConfirm = Number.isInteger(counts.confirm) ? counts.confirm : 0;
  const countLine = 'reject ' + cReject + '   discuss ' + cDiscuss + '   confirm ' + cConfirm;

  const claimBlock = claim
    ? 'As a navigator, I confirm:\n  "' + claim + '"\n\n'
    : '';
  const body = claimBlock +
               verbRows.join('\n') + '\n\n' +
               MARKER_PROGRESS + ' progress  ' + bar + '  ' + pct + '%\n' +
               countLine;

  return {
    zones: {
      header: composedHeader,
      body: body,
      signals: '',
      footer: null,
    },
    contract: {
      shape: 'F.6',
      keyboard: 'askuserquestion',
      verbs: F6_VERBS.slice(),     // defensive copy
      freeTextOffered: false,      // closed-vocab; reject reason captured via downstream prompt
      mode: mode,
      recommended: null,           // F.6 carries no RECOMMENDED (closed-vocab parent shape)
      border_style: 'double',      // parent shape; distinct from F.0's single-line
      personaContext: personaContext,
      round_id: roundId,
      position: position,
      total_questions: totalQuestions,
    },
  };
}

/**
 * Build and emit a REVIEWED typed edge to room.db via Phase 109.
 * Graceful-fail envelope -- never throws.
 *
 * Closed-vocab response: confirm | reject | discuss | free-text.
 * was_decoy is required boolean (per F.6 spec position-aware debrief).
 * confidence_self_report is optional 1-5 integer.
 * reason is optional free-text (carries reject reason when response === 'reject').
 * actor_id is optional Cowork scalar handle (parallel-actor disambiguation).
 */
function buildReviewedEdge(args) {
  try {
    const a = (args && typeof args === 'object') ? args : {};

    if (typeof a.round_id !== 'string' || a.round_id.length === 0) {
      return { ok: false, reason: 'invalid_round_id' };
    }
    if (!Number.isInteger(a.position) || a.position < 1) {
      return { ok: false, reason: 'invalid_position' };
    }
    if (typeof a.was_decoy !== 'boolean') {
      return { ok: false, reason: 'invalid_was_decoy' };
    }
    if (VALID_RESPONSES.indexOf(a.response) === -1) {
      return { ok: false, reason: 'invalid_response' };
    }
    if (a.confidence_self_report !== undefined) {
      const c = a.confidence_self_report;
      if (!Number.isInteger(c) || c < 1 || c > 5) {
        return { ok: false, reason: 'invalid_confidence' };
      }
    }

    const { EVENT_TYPES, logEvent } = require('../core/navigation/memory-events.cjs');
    if (!EVENT_TYPES.has(RESPONSE_EVENT_TYPE)) {
      return { ok: false, reason: 'event_type_not_registered' };
    }

    // Project standard: node:sqlite DatabaseSync per lib/core/lazygraph-ops.cjs.
    // better-sqlite3 documented as broken in lib/import/PRECONDITIONS.md.
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
        round_id: a.round_id,
        position: a.position,
        latency_ms: (typeof a.latency_ms === 'number') ? a.latency_ms : null,
        was_decoy: a.was_decoy,
        response: a.response,
      };
      if (a.confidence_self_report !== undefined) props.confidence_self_report = a.confidence_self_report;
      if (typeof a.reason === 'string' && a.reason.length > 0) props.reason = a.reason;
      if (typeof a.actor_id === 'string' && a.actor_id.length > 0) props.actor_id = a.actor_id;
      return logEvent(db, RESPONSE_EVENT_TYPE, props);
    } finally {
      db.close();
    }
  } catch (_e) {
    return { ok: false, reason: 'edge_build_threw_caught' };
  }
}

/**
 * Emit the f6_round_completed event at round close. Carries summary counts
 * + tier label so debrief Shape A action report can render without
 * re-querying the per-response edges.
 *
 * Graceful-fail envelope -- never throws.
 */
function emitRoundCompleted(args) {
  try {
    const a = (args && typeof args === 'object') ? args : {};
    if (typeof a.round_id !== 'string' || a.round_id.length === 0) {
      return { ok: false, reason: 'invalid_round_id' };
    }

    const { EVENT_TYPES, logEvent } = require('../core/navigation/memory-events.cjs');
    if (!EVENT_TYPES.has(ROUND_COMPLETED_EVENT_TYPE)) {
      return { ok: false, reason: 'event_type_not_registered' };
    }

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
        round_id: a.round_id,
        real_count: (typeof a.real_count === 'number') ? a.real_count : null,
        decoy_count: (typeof a.decoy_count === 'number') ? a.decoy_count : null,
        tier: (typeof a.tier === 'string') ? a.tier : null,
        ended_at: new Date().toISOString(),
      };
      return logEvent(db, ROUND_COMPLETED_EVENT_TYPE, props);
    } finally {
      db.close();
    }
  } catch (_e) {
    return { ok: false, reason: 'round_completion_threw_caught' };
  }
}

module.exports = {
  renderShapeF6PlanReview: renderShapeF6PlanReview,
  buildReviewedEdge: buildReviewedEdge,
  emitRoundCompleted: emitRoundCompleted,
  F6_VERBS: F6_VERBS.slice(),
  VALID_RESPONSES: VALID_RESPONSES.slice(),
  _internal: {
    RESPONSE_EVENT_TYPE: RESPONSE_EVENT_TYPE,
    ROUND_COMPLETED_EVENT_TYPE: ROUND_COMPLETED_EVENT_TYPE,
    PROGRESS_BAR_CELLS: PROGRESS_BAR_CELLS,
  },
};
