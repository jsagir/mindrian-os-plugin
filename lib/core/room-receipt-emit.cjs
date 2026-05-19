/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121-03 Task 2 -- emit helper for room_receipt_written events (D-09 surface 2).
 *
 * Called from the Phase 119 receipt-write surface (lib/core/room-auto-create.cjs
 * after autoCreatePlaceholderRoom finishes scaffolding the room directory + registry
 * entry + room_auto_created memory_event). One line per receipt-write, routed
 * through writer.emit() (Canon Part 9 chokepoint), validated by Canon Part 8.
 *
 * Per Canon Part 10 sub-claim 3 ("rooms are receipts, not entry points"): every
 * room creation IS a receipt of conversation work. This module emits the
 * trajectory-telemetry counterpart of the room_auto_created memory_event, so
 * SEED-002 consumers can correlate receipt cadence with engagement quality.
 *
 * Non-throwing by contract: validation breaches and disk errors are swallowed
 * so the Phase 119 receipt-write surface is never blocked by telemetry. The
 * pipeline must not crash because telemetry storage is unavailable (mirrors
 * the writer.cjs best-effort silent-swallow policy).
 *
 * Hash discipline:
 *   - room_slug_sha256:     sha256(slug) -- 64-char hex; if slug falsy, sha256('').
 *   - conversation_id_hash: sha256(conversationId) first 16 chars -- shorter hash
 *                           (matches schema.cjs MAX_CONTEXT_HASH_LEN convention).
 *   - generated_at_ts:      ISO-8601 timestamp string (Date.toISOString()).
 *
 * Pure CJS, node built-ins only. Zero new runtime deps.
 */
'use strict';

const crypto = require('node:crypto');
const telemetry = require('./telemetry/writer.cjs');

function _sha256(s) {
  return crypto.createHash('sha256').update(String(s || '')).digest('hex');
}

/**
 * emitReceiptWritten(roomSlug, conversationId) -> void
 *
 * Best-effort emit of one room_receipt_written event. Falsy arguments are
 * defensively normalized to empty-string hashes so the Phase 119 wire-in
 * never blocks on missing scaffolding metadata.
 *
 * @param {string|null|undefined} roomSlug      placeholder slug (e.g. 'untitled-2026-05-19-1234')
 * @param {string|null|undefined} conversationId Phase 119 source_material_id or session id
 */
function emitReceiptWritten(roomSlug, conversationId) {
  try {
    telemetry.emit('room_receipt_written', {
      room_slug_sha256: _sha256(roomSlug),
      conversation_id_hash: _sha256(conversationId).slice(0, 16),
      generated_at_ts: new Date().toISOString(),
    });
  } catch (_e) {
    // Best-effort. Per Canon Part 9 (memory locality) and the writer's
    // silent-swallow policy: telemetry MUST NEVER block the surface it
    // observes. A missing telemetry row is recoverable; a crashed room
    // creation is not.
  }
}

module.exports = { emitReceiptWritten: emitReceiptWritten };
