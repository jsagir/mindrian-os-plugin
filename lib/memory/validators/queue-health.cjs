/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 88-13 MEM-GUARDIAN-QUEUE-01.
 *
 * Enforces size ceilings on the minto-debouncer queue
 * (.mindrian/minto-queue.json shipped by 88-02). Without this validator,
 * unbounded queue growth (drain never fires) accumulates silently for
 * hundreds of sessions before anyone notices. This converts the silent
 * growth into a visible session-start signal.
 *
 * Thresholds:
 *   entries <  500              healthy, no violation
 *   entries >= 500 && <= 999    warning  queue_approaching_ceiling
 *   entries >= 1000             error    queue_ceiling_exceeded +
 *                                        action_hint halt_enqueue_until_drained
 *
 * Emits at most ONE aggregate violation per invocation (not N per entry).
 * Missing queue file -> no violation (healthy first-session state).
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SEVERITY_MAP = { critical: 3, error: 2, warning: 1, info: 0 };
const WARN_THRESHOLD = 500;
const ERROR_THRESHOLD = 1000;
const ROOM_SCOPE = '__room__';

function validateRoom(roomDir) {
  const qp = path.join(roomDir, '.mindrian', 'minto-queue.json');
  if (!fs.existsSync(qp)) {
    return { severity: null, violations: [] };
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(qp, 'utf8'));
  } catch (_) {
    // Malformed queue file is a silent-failure signal in its own right.
    return {
      severity: 'warning',
      violations: [{
        validator: 'queue-health',
        category: 'queue_unparseable',
        severity: 'warning',
        message: 'minto-queue.json is unparseable; debouncer self-healed or writer crashed',
        scope: ROOM_SCOPE,
      }],
    };
  }
  const entries = (parsed && Array.isArray(parsed.entries)) ? parsed.entries : [];
  const count = entries.length;
  if (count < WARN_THRESHOLD) {
    return { severity: null, violations: [] };
  }
  if (count >= ERROR_THRESHOLD) {
    return {
      severity: 'error',
      violations: [{
        validator: 'queue-health',
        category: 'queue_ceiling_exceeded',
        severity: 'error',
        message: 'minto-debouncer queue at ' + count +
          ' entries, ceiling ' + ERROR_THRESHOLD,
        action_hint: 'halt_enqueue_until_drained',
        count: count,
        scope: ROOM_SCOPE,
      }],
    };
  }
  return {
    severity: 'warning',
    violations: [{
      validator: 'queue-health',
      category: 'queue_approaching_ceiling',
      severity: 'warning',
      message: 'minto-debouncer queue at ' + count +
        ' entries, ceiling ' + ERROR_THRESHOLD,
      action_hint: 'drain_soon',
      count: count,
      scope: ROOM_SCOPE,
    }],
  };
}

module.exports = {
  id: 'queue-health',
  severity_map: SEVERITY_MAP,
  scope: 'room',
  validate: function (sectionDirOrRoomDir, ctx) {
    const roomDir = (ctx && ctx.roomDir) ? ctx.roomDir : sectionDirOrRoomDir;
    return validateRoom(roomDir);
  },
};
