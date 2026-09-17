'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 353 Plan 02 Task 6 (R-353-I, R-353-J) -- jtbd-anchor: the
 * payload-free, idempotent `jtbd:<job_id>` node a filed claim or artifact
 * anchors a SOURCED_FROM edge to (D-353-8). Structural clone of
 * lib/core/navigation/goal-anchor.cjs with four substitutions: the `jtbd:`
 * id prefix, `source_path: 'system:jtbd-anchor'`, `epistemic_type:
 * 'observation'`, and node type `'jtbd'`.
 * layer: graph
 *
 * FOUR THINGS THIS HEADER STATES, in the same voice as goal-anchor.cjs's:
 *
 * 1. THIS NODE IS A PROJECTION, NOT A HOME. The homes are
 *    `data/section-job-canon.json` (what a section's job IS) and
 *    `.mindrian/room-map.json` (a folder's own declared or parent-fallback
 *    job_id, Phase 353 Plan 01). The node holds NO payload beyond its own
 *    id. Its entire job is to be a real id that a `SOURCED_FROM` edge can
 *    name, so `writeEdge`'s validation has something honest to point at. Do
 *    not build a second job store here.
 *
 * 2. `node.type` IS `'jtbd'` AND NEVER THE TYPE STRING "claim". A
 *    claim-typed anchor with nothing above it would land in Phase 343's
 *    `unanchored_claims`
 *    numerator as a brand-new unanchored claim in every room that ever
 *    files a claim or artifact into a section, which would manufacture up
 *    to about 500 new unanchored claims fleet-wide (one per declared job
 *    per room, Seam 5's 16-plus-4-job vocabulary against the measured
 *    31-room fleet) while this same phase's own success criterion 3
 *    (100 percent of new claims filed on fixture rooms carry an anchor
 *    edge) claims to CLOSE that exact gap. This is the single sharpest trap
 *    in this phase's Seam 7 (353-RESEARCH.md Pitfall 5); grep and test both
 *    assert `'jtbd'` is the minted type and the type string "claim" never
 *    appears in this file.
 *
 * 3. `epistemic_type` IS `'observation'`, at `review_status: 'proposed'`.
 *    A folder's declared job is a FACT about the folder (D-353-8), the
 *    strongest honest member available for a system-authored, unconfirmed
 *    row; `goal-anchor.cjs` chose the weaker `'assumption'` for a
 *    navigator's stated goal, a different kind of fact. `observation` is
 *    already a member of the closed 10-member `ALLOWED_EPISTEMIC_TYPES`
 *    enum (node-insert.cjs); no member is added here.
 *
 * 4. A SECTION WITH NO FILED CLAIM YET LEAVES AN ANCHOR WITH ZERO INBOUND
 *    EDGES. That is harmless (a node is not a dangling edge) but it does
 *    increment the node census by one node per declared job per room; say
 *    so here so a future doctor run does not read it as a defect.
 *
 * ORDER IS THE WHOLE DELIVERABLE (goal-anchor.cjs's R2, BLOCKING, unchanged
 * here). `writeEdge` never probes whether either endpoint has a node row
 * (the foreign key was deliberately removed in Phase 169 D-169-11). So a
 * `SOURCED_FROM` edge written to a `jtbd:<job_id>` id that was never
 * inserted still succeeds and becomes a NEW dangling-edge row, one of the
 * exact defects Phase 343 exists to count. The caller (lib/mcp/tools/
 * views.cjs::fileArtifact, lib/mcp/tools/claim.cjs's claim_write handler)
 * MUST call mintJtbdAnchor and confirm `ok: true` BEFORE the edge is
 * written. Mint first, or do not point at it.
 *
 * DO NOT HAND-ROLL THE SEEDING. This module copies goal-anchor.cjs's
 * discipline verbatim: validate first, never throw, degrade to
 * `{ ok: false, reason }` on any fault.
 *
 * Canon Part 9: the single node-write chokepoint is node-insert.cjs::
 * insertNode; this file never issues a raw node-table SQL insert directly.
 * Canon Part 8: zero network surface. Pure LOCAL SQLite over a caller-owned
 * conn handle (never opens room.db itself).
 *
 * No em-dashes anywhere in this file (CLAUDE.md hard rule).
 */

const { insertNode } = require('../node-insert.cjs');

/**
 * JTBD_ANCHOR_ID(jobId) -> 'jtbd:<jobId>', or null.
 *
 * Mirrors GOAL_ANCHOR_ID's shape: null on any non-string or empty input,
 * never throws.
 *
 * @param {*} jobId
 * @returns {string|null}
 */
function JTBD_ANCHOR_ID(jobId) {
  if (typeof jobId !== 'string' || jobId.length === 0) return null;
  return 'jtbd:' + jobId;
}

/**
 * mintJtbdAnchor(db, jobId) -> { ok, node_id?, created?, reason?, detail? }
 *
 * Idempotently upserts the payload-free `jtbd:<jobId>` node through the
 * node-insert.cjs chokepoint. Safe to call on every filing attempt:
 * `on_conflict: 'nothing'` means a re-run never touches `last_seen_at` or
 * any other column on an existing row (byte-identical re-mint).
 *
 * Never throws. Validates `db` and `jobId` FIRST, before any query.
 *
 * @param {{prepare: Function}} db - caller-owned node:sqlite DatabaseSync
 * @param {*} jobId
 * @returns {{ok: boolean, node_id?: string, created?: boolean, reason?: string, detail?: string}}
 */
function mintJtbdAnchor(db, jobId) {
  if (!db || typeof db.prepare !== 'function') {
    return { ok: false, reason: 'no_db' };
  }
  const id = JTBD_ANCHOR_ID(jobId);
  if (id === null) {
    return { ok: false, reason: 'invalid_job_id' };
  }

  let existing;
  try {
    existing = db.prepare('SELECT id FROM nodes WHERE id = ?').get(id);
  } catch (e) {
    return { ok: false, reason: 'anchor_write_failed', detail: String((e && e.message) || e).slice(0, 80) };
  }
  const created = !existing;

  try {
    // on_conflict: 'nothing' is load-bearing: it is what makes the mint safe
    // to re-run on every filing attempt without touching last_seen_at,
    // which is what "idempotent" has to mean here.
    insertNode(db, id, 'jtbd', '{}', {
      source_path: 'system:jtbd-anchor',
      created_by: 'system',
      epistemic_type: 'observation',
      review_status: 'proposed',
      on_conflict: 'nothing',
    });
  } catch (e) {
    // Best-effort, goal-anchor.cjs discipline: a seeding fault never throws
    // past this function; the caller decides what to do with a failed mint
    // (Canon Part 9: bookkeeping never blocks a write, so a failed mint
    // means no edge, never a refused claim, unless the operator set strict).
    return { ok: false, reason: 'anchor_write_failed', detail: String((e && e.message) || e).slice(0, 80) };
  }

  return { ok: true, node_id: id, created: created };
}

module.exports = { mintJtbdAnchor, JTBD_ANCHOR_ID };
