/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 88-13 MEM-GUARDIAN-STALE-01.
 *
 * Re-validates every .mindrian/minto-stale.json entry (written by 88-06
 * for sections whose MINTO couldn't regen) against the current MINTO
 * state. A stale entry whose section now has a valid MINTO is a GHOST:
 * the ledger lies. This validator emits a warning per ghost so the
 * on-stop mode of the guardian can prune the ghost atomically. Without
 * this, ghost entries linger forever and pollute session-start footers
 * with false alarms.
 *
 * Signals:
 *   stale_ghost  (warning)  entry lists section X but invariants.validate(X)
 *                           is now clean. Carries section name + action_hint
 *                           'prune_stale_entry'. Consumed by guardian on-stop
 *                           mode to rewrite stale.json atomically.
 *   (MINTO still invalid)   no new violation; real staleness is already
 *                           surfaced by the stale.json consumer (88-07).
 *   (missing stale.json)    no violation; healthy.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SEVERITY_MAP = { critical: 3, error: 2, warning: 1, info: 0 };
const ROOM_SCOPE = '__room__';

const { validate: invariantsValidate } = require('../../core/feynman-minto-invariants.cjs');

function validateRoom(roomDir) {
  const stalePath = path.join(roomDir, '.mindrian', 'minto-stale.json');
  if (!fs.existsSync(stalePath)) {
    return { severity: null, violations: [] };
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(stalePath, 'utf8'));
  } catch (_) {
    return {
      severity: 'warning',
      violations: [{
        validator: 'stale-lifecycle',
        category: 'stale_file_unparseable',
        severity: 'warning',
        message: 'minto-stale.json is unparseable',
        scope: ROOM_SCOPE,
      }],
    };
  }
  const list = (parsed && Array.isArray(parsed.sections)) ? parsed.sections : [];
  const violations = [];
  // Reasons owned by the invariants module. Only these reasons are
  // candidates for ghost detection via re-validation. Other reasons
  // (never_generated, missing_timestamps, artifacts_newer_than_minto) are
  // signaled by folder-memory.computeStale() independently of invariants
  // state -- re-running invariants won't learn anything about them and
  // pruning based on invariant cleanliness would erase real signals.
  const INVARIANT_OWNED_REASONS = new Set(['invariant_violation', 'parse_failed']);
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const section = entry.section;
    if (typeof section !== 'string' || section.length === 0) continue;
    const reason = typeof entry.reason === 'string' ? entry.reason : '';
    if (!INVARIANT_OWNED_REASONS.has(reason)) {
      // Skip entries whose reason is not owned by the invariants module;
      // folder-memory is the authoritative source for these, and pruning
      // would erase valid staleness. These stay in stale.json until the
      // originating producer (88-06 on-stop walk) removes them.
      continue;
    }
    const mintoPath = path.join(roomDir, section, 'MINTO.md');
    if (!fs.existsSync(mintoPath)) continue;
    let result;
    try { result = invariantsValidate(mintoPath); }
    catch (_) { continue; }
    // Ghost condition: MINTO is fully invariant-clean. If ANY violation
    // survives (including freshness/coherence warnings), the section is
    // still stale and must NOT be pruned.
    const violationsList = (result && result.violations) || [];
    if (violationsList.length === 0) {
      violations.push({
        validator: 'stale-lifecycle',
        category: 'stale_ghost',
        severity: 'warning',
        message: 'stale.json lists "' + section + '" (reason=' + reason +
          ') but MINTO is now invariant-clean',
        action_hint: 'prune_stale_entry',
        section: section,
        scope: ROOM_SCOPE,
      });
    }
  }
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
  id: 'stale-lifecycle',
  severity_map: SEVERITY_MAP,
  scope: 'room',
  validate: function (sectionDirOrRoomDir, ctx) {
    const roomDir = (ctx && ctx.roomDir) ? ctx.roomDir : sectionDirOrRoomDir;
    return validateRoom(roomDir);
  },
};
