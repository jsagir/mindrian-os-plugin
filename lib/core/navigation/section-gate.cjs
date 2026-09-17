'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 353 Plan 02 Task 7 (D-353-8, R-353-D) -- the filing gate on
 * `artifact_file` and `claim_write`.
 *
 * MODE RESOLUTION ORDER (stated once, here): an explicit `mode` on the tool
 * call if one already exists, else the room's own setting if one exists,
 * else `'flag'`. This plan invents no new environment variable and no new
 * MCP schema parameter for mode; both tools call evaluateFilingGate with
 * `mode: 'flag'` today (the shipped default), and a future plan may widen
 * the resolution order without touching this function's contract.
 *
 * `resolveFocusSection` and `evaluateFilingGate` live HERE, behind the
 * navigation door, rather than in the MCP tool layer (Canon Part 9: the
 * focus read and the node-properties read are graph reads, not tool-layer
 * logic). Re-exported by lib/core/navigation.cjs alongside GATE_MODES.
 *
 * Canon Part 9 floor (D-353-8's closing sentence, restated): bookkeeping
 * never blocks a write. A failed anchor mint means no edge, never a refused
 * claim, unless the operator set `strict`. `unresolved` is the honest
 * answer when no section resolves; it is never silently treated as a
 * match (the two verdicts trigger different downstream handling: a `flag`
 * caller may still choose to disclose an `unresolved` write, while `match`
 * never disclosies anything).
 *
 * No em-dashes anywhere in this file (CLAUDE.md hard rule).
 */

const focus = require('./focus.cjs');
const sectionRegistry = require('../section-registry.cjs');

const GATE_MODES = Object.freeze(['flag', 'strict']);

/**
 * resolveFocusSection(db, sessionId) -> { ok, section?, reason? }
 *
 * Reads the active focus node's own `section` property (the same
 * `properties.section` key reasoning-write.cjs already writes onto every
 * claim/artifact node it mints). Never throws, never widens an MCP schema.
 *
 * @param {{prepare: Function}} db
 * @param {*} sessionId
 * @returns {{ok: boolean, section?: string, reason?: string}}
 */
function resolveFocusSection(db, sessionId) {
  if (!db || typeof db.prepare !== 'function') {
    return { ok: false, reason: 'read_failed' };
  }
  let activeFocus;
  try {
    activeFocus = focus.getActiveFocus(db, sessionId);
  } catch (_e) {
    return { ok: false, reason: 'read_failed' };
  }
  if (!activeFocus || !activeFocus.focusNodeId) {
    return { ok: false, reason: 'no_focus' };
  }
  let row;
  try {
    row = db.prepare('SELECT properties FROM nodes WHERE id = ?').get(activeFocus.focusNodeId);
  } catch (_e) {
    return { ok: false, reason: 'read_failed' };
  }
  if (!row) {
    return { ok: false, reason: 'no_section_on_focus' };
  }
  let props;
  try {
    props = JSON.parse(row.properties || '{}');
  } catch (_e) {
    return { ok: false, reason: 'read_failed' };
  }
  if (!props || typeof props.section !== 'string' || props.section.length === 0) {
    return { ok: false, reason: 'no_section_on_focus' };
  }
  return { ok: true, section: props.section };
}

/**
 * evaluateFilingGate({ section, servesJtbd, mode }) -> {
 *   verdict: 'match' | 'mismatch' | 'unresolved',
 *   section_job, declared_job, reason,
 * }
 *
 * Pure, synchronous, never throws.
 *
 * - `section` falsy/unresolved -> verdict 'unresolved', reason 'no_section'.
 * - `section`'s own job is undeclared in data/section-job-canon.json ->
 *   verdict 'unresolved', reason 'section_job_undeclared' (the doctor
 *   reports "undeclared" rather than the gate guessing, section-registry.cjs
 *   Task 1's own discipline carried forward here).
 * - `servesJtbd` absent (no independent job signal for this write, e.g. a
 *   fresh room with no .mindrian/jtbd-state.json yet) -> verdict 'match',
 *   reason 'no_declared_job_signal' (Canon Part 9: never manufacture a
 *   disclosure out of missing data).
 * - `servesJtbd` equals the section's own job_id OR its declared
 *   secondary_job_id (a legitimate declared cross-section reason, D-353-8)
 *   -> verdict 'match', reason 'exact' or 'secondary'.
 * - otherwise -> verdict 'mismatch', reason 'job_mismatch'.
 *
 * @param {{section?: string, servesJtbd?: string, mode?: string}} args
 * @returns {{verdict: string, section_job: string|null, declared_job: string|null, reason: string}}
 */
function evaluateFilingGate(args) {
  const a = args || {};
  const section = typeof a.section === 'string' && a.section.length > 0 ? a.section : null;
  const declaredJob = typeof a.servesJtbd === 'string' && a.servesJtbd.length > 0 ? a.servesJtbd : null;

  if (!section) {
    return { verdict: 'unresolved', section_job: null, declared_job: declaredJob, reason: 'no_section' };
  }

  const canonRow = sectionRegistry.getSectionJob(section);
  if (!canonRow || !canonRow.job_id) {
    return { verdict: 'unresolved', section_job: null, declared_job: declaredJob, reason: 'section_job_undeclared' };
  }

  if (!declaredJob) {
    return { verdict: 'match', section_job: canonRow.job_id, declared_job: null, reason: 'no_declared_job_signal' };
  }

  if (declaredJob === canonRow.job_id) {
    return { verdict: 'match', section_job: canonRow.job_id, declared_job: declaredJob, reason: 'exact' };
  }
  if (canonRow.secondary_job_id && declaredJob === canonRow.secondary_job_id) {
    return { verdict: 'match', section_job: canonRow.job_id, declared_job: declaredJob, reason: 'secondary' };
  }

  return { verdict: 'mismatch', section_job: canonRow.job_id, declared_job: declaredJob, reason: 'job_mismatch' };
}

// Phase 353 Plan 02 Task 9 (D-353-9): the statement-home half of the
// section-ruling doctor module's `claims_without_anchor` drift class.
// Mirrors lib/core/navigation/graph-integrity-counts.cjs's own statement-
// home discipline (a fixed SQL literal here, never inline in the doctor
// module, which lib/core/doctor/ is not allow-listed to require node:sqlite
// / room-db.cjs for at all). Scoped to claims created ON OR AFTER `sinceMs`
// (this module's `introduced_version` stamp date) so legacy claims stay out
// of scope (D-353-8's closing sentence). Unlike graph-integrity-counts.cjs's
// general `claim_nodes_no_anchor_total` (SOURCED_FROM or DERIVED_FROM to
// ANY target), this counts specifically the absence of a SOURCED_FROM edge
// to a `jtbd:*` target -- a claim anchored to plain evidence but never to
// its section's job still counts here.
const SQL_CLAIM_NODES_NO_JTBD_ANCHOR = 'SELECT count(*) AS c FROM nodes n '
  + "WHERE n.type = 'claim' AND n.created_at >= ? AND NOT EXISTS ("
  + 'SELECT 1 FROM edges e WHERE e.source = n.id '
  + "AND e.type = 'SOURCED_FROM' AND e.target LIKE 'jtbd:%')";

/**
 * countClaimsWithoutJtbdAnchor(db, sinceMs) -> integer | null
 *
 * Never throws. Returns null on any read fault (a legacy/unreadable schema
 * variant, a closed handle) rather than a misleading 0.
 *
 * @param {{prepare: Function}} db - caller-owned, already-open handle
 * @param {number} sinceMs - epoch ms; only claims created at or after this
 *   moment are counted
 * @returns {number|null}
 */
function countClaimsWithoutJtbdAnchor(db, sinceMs) {
  if (!db || typeof db.prepare !== 'function') return null;
  const cutoff = (typeof sinceMs === 'number' && Number.isFinite(sinceMs)) ? sinceMs : 0;
  try {
    const row = db.prepare(SQL_CLAIM_NODES_NO_JTBD_ANCHOR).get(cutoff);
    return (row && typeof row.c === 'number') ? row.c : 0;
  } catch (_e) {
    return null;
  }
}

module.exports = { resolveFocusSection, evaluateFilingGate, GATE_MODES, countClaimsWithoutJtbdAnchor };
