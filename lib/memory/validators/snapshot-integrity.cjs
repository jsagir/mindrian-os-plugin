/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 88-13 MEM-GUARDIAN-SNAPSHOT-01.
 *
 * Detects partial session-snapshot.json produced by an on-stop walk that
 * crashed mid-iteration before the atomic rename landed. Without this
 * validator the drift stays silent for 20+ sessions (no visible
 * TRIPLE_CONTEXT entry for the affected section, but user never sees why).
 *
 * Signals emitted:
 *   partial_snapshot        warning per missing section, action_hint
 *                           'partial_snapshot_detected'
 *   snapshot_empty          error when snapshot has zero sections but the
 *                           room has at least one ROOM.md section on disk.
 *                           Action hint 'rerun_on_stop'.
 *   (missing file)          silent: no violation. Healthy first-session.
 *
 * Emits violations against a synthetic section key `__room__` so the
 * guardian aggregator can surface them without tying them to a specific
 * section (they are a room-wide health signal).
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SEVERITY_MAP = { critical: 3, error: 2, warning: 1, info: 0 };
const ROOM_SCOPE = '__room__';

function safeReadSections(roomDir) {
  // Returns an array of section dir names that hold a ROOM.md, per the
  // ICM Layer 0 identity invariant (CLAUDE.md decision #15).
  try {
    return fs.readdirSync(roomDir, { withFileTypes: true })
      .filter(function (d) { return d.isDirectory() && d.name[0] !== '.'; })
      .filter(function (d) {
        try {
          return fs.existsSync(path.join(roomDir, d.name, 'ROOM.md'));
        } catch (_) { return false; }
      })
      .map(function (d) { return d.name; });
  } catch (_) {
    return [];
  }
}

function validateRoom(roomDir) {
  const snapPath = path.join(roomDir, '.mindrian', 'session-snapshot.json');
  if (!fs.existsSync(snapPath)) {
    return { severity: null, violations: [] };
  }
  let parsed;
  try {
    const raw = fs.readFileSync(snapPath, 'utf8');
    parsed = JSON.parse(raw);
  } catch (_) {
    // Malformed JSON surfaced as error (silent-to-loud conversion).
    return {
      severity: 'error',
      violations: [{
        validator: 'snapshot-integrity',
        category: 'snapshot_unparseable',
        severity: 'error',
        message: 'session-snapshot.json is unparseable; on-stop likely crashed',
        action_hint: 'rerun_on_stop',
        scope: ROOM_SCOPE,
      }],
    };
  }
  const snapSections = (parsed && parsed.sections && typeof parsed.sections === 'object')
    ? Object.keys(parsed.sections)
    : [];
  const diskSections = safeReadSections(roomDir);

  const violations = [];
  if (snapSections.length === 0 && diskSections.length > 0) {
    violations.push({
      validator: 'snapshot-integrity',
      category: 'snapshot_empty',
      severity: 'error',
      message: 'on-stop walk crashed or never ran: snapshot empty while room has ' +
        diskSections.length + ' section' + (diskSections.length === 1 ? '' : 's'),
      action_hint: 'rerun_on_stop',
      scope: ROOM_SCOPE,
    });
  } else {
    const snapSet = new Set(snapSections);
    for (const d of diskSections) {
      if (!snapSet.has(d)) {
        violations.push({
          validator: 'snapshot-integrity',
          category: 'partial_snapshot',
          severity: 'warning',
          message: 'section "' + d + '" exists on disk but missing from session-snapshot.json',
          action_hint: 'partial_snapshot_detected',
          scope: ROOM_SCOPE,
          section: d,
        });
      }
    }
  }
  // Aggregate severity
  let max = -1;
  const order = ['info', 'warning', 'error', 'critical'];
  for (const v of violations) {
    const i = order.indexOf(v.severity);
    if (i > max) max = i;
  }
  return {
    severity: max === -1 ? null : order[max],
    violations: violations,
  };
}

module.exports = {
  id: 'snapshot-integrity',
  severity_map: SEVERITY_MAP,
  // Section-scoped validators get a sectionDir; this one is room-scoped so
  // the guardian invokes it once per room (sectionDir parameter is ignored
  // when context.scope === 'room'). The guardian honors a special
  // `scope: 'room'` field so we do not duplicate work across N sections.
  scope: 'room',
  validate: function (sectionDirOrRoomDir, ctx) {
    // The guardian always passes the room path when scope === 'room'.
    const roomDir = (ctx && ctx.roomDir) ? ctx.roomDir : sectionDirOrRoomDir;
    return validateRoom(roomDir);
  },
};
