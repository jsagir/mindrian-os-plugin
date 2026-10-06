/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 369.25 plan 12 -- the room-scoped guardian validator for FEYNMINTO-11,
 * the identity invariant: a face's room id must equal the room_id room.db holds.
 *
 * The identity is read ONCE per room through readRoomIdentity (the in_place door,
 * read-only, nothing written into the room) and passed down to the pure
 * lib/core/feynman-minto-invariants.cjs, which never opens room.db itself.
 *
 *   - identity not ready: ONE room-level violation, category identity, severity
 *     error, action_hint repair_room_identity. Never regenerate_face: a room with
 *     no id has nothing to key a regenerated face to, so no regeneration is
 *     enqueued until the identity exists (T-369.25-12-02).
 *   - identity ready: for every nest directory directly under the room that holds
 *     MINTO.md, FEYNMAN.md or BRAIN.md, a MINTO room that is not the room_id is a
 *     critical violation with action_hint regenerate_face; a FEYNMAN or BRAIN
 *     room_id that is missing is a warning, one that differs is critical.
 *
 * Contract (shared with all validators, see README.md): scope 'room', so the
 * guardian calls validate(roomDir, ctx) once per room and reports through the
 * on-stop invariant report (.mindrian/invariant-report.json, section __room__).
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  validate: invariantsValidate,
  validateFaceRoomId,
  CATEGORIES,
  INVARIANT_IDS,
} = require('../../core/feynman-minto-invariants.cjs');

const ID = 'room-identity-invariants';
const SEVERITY_ORDER = ['info', 'warning', 'error', 'critical'];

function aggregate(violations) {
  let max = -1;
  for (const v of violations) {
    const i = SEVERITY_ORDER.indexOf(v.severity);
    if (i > max) max = i;
  }
  return max === -1 ? null : SEVERITY_ORDER[max];
}

function fault(message) {
  return {
    severity: 'error',
    violations: [{
      validator: ID,
      category: 'invariants_module_fault',
      severity: 'error',
      message: message,
    }],
  };
}

function nestsOf(roomDir) {
  let entries;
  try {
    entries = fs.readdirSync(roomDir, { withFileTypes: true });
  } catch (_e) {
    return [];
  }
  return entries
    .filter((d) => d.isDirectory() && d.name[0] !== '.')
    .map((d) => d.name)
    .filter((name) => ['MINTO.md', 'FEYNMAN.md', 'BRAIN.md'].some((f) => fs.existsSync(path.join(roomDir, name, f))))
    .sort();
}

module.exports = {
  id: ID,
  severity_map: { critical: 3, error: 2, warning: 1, info: 0 },
  scope: 'room',
  validate: function (roomDir) {
    let identity;
    try {
      // lazy: the guardian loads every validator at start-up, and the identity module pulls in room.db
      const { readRoomIdentity } = require('../../core/navigation/room-identity.cjs');
      identity = readRoomIdentity(roomDir, { door: 'in_place' });
    } catch (e) {
      return fault('readRoomIdentity threw: ' + (e && e.message || String(e)));
    }

    if (!identity || identity.ok !== true) {
      const reason = (identity && identity.reason) || 'unknown';
      const detail = identity && identity.detail ? ' - ' + identity.detail : '';
      const v = {
        validator: ID,
        category: CATEGORIES.IDENTITY,
        severity: 'error',
        message: 'Room identity not ready: ' + reason + detail +
          ' (' + INVARIANT_IDS.FACE_ROOM_ID + ', the identity invariant)',
        action_hint: 'repair_room_identity',
      };
      return { severity: 'error', violations: [v] };
    }

    const out = [];
    try {
      for (const nest of nestsOf(roomDir)) {
        const dir = path.join(roomDir, nest);
        const tag = function (v) {
          return Object.assign({}, v, { validator: ID, section: nest });
        };
        const mintoPath = path.join(dir, 'MINTO.md');
        if (fs.existsSync(mintoPath)) {
          const r = invariantsValidate(mintoPath, { roomIdentity: identity });
          for (const v of (r && r.violations) || []) {
            if (v.category === CATEGORIES.IDENTITY) out.push(tag(v));
          }
        }
        for (const face of ['FEYNMAN.md', 'BRAIN.md']) {
          const facePath = path.join(dir, face);
          if (!fs.existsSync(facePath)) continue;
          const r = validateFaceRoomId(facePath, identity);
          for (const v of (r && r.violations) || []) out.push(tag(v));
        }
      }
    } catch (e) {
      return fault('face identity check threw: ' + (e && e.message || String(e)));
    }
    return { severity: aggregate(out), violations: out };
  },
};
