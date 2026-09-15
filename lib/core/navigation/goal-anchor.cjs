'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 345-06 Task 1 -- goal-anchor: the payload-free, idempotent
 * `goal:<room-slug>` node the strategy card's `subject_node_id` points at.
 * layer: graph
 *
 * FIVE THINGS THIS HEADER STATES (345-ICM-CONSULT OBJ-G5, Card (b)):
 *
 * 1. THIS NODE IS A PROJECTION, NOT A HOME. The home is
 *    `<roomDir>/.mindrian/jtbd-state.json`'s top-level `goal` key
 *    (lib/hmi/jtbd-state.cjs::setGoal/getGoal, landed 345-02). The node holds
 *    NO payload. Its entire job is to be a real id that `card.subject_node_id`
 *    can name, so `writeReasoningNode`'s never-fabricate-provenance floor
 *    (reasoning-write.cjs:162-165) has something honest to write an edge
 *    against. Do not build a second goal store here.
 *
 * 2. WHY `goal:<room-slug>` AND NOT `jtbd:<slug>`. A room may hold up to 13
 *    distinct `jtbd:<slug>` nodes over its life (lib/hmi/jtbd-taxonomy.json),
 *    so the ratified history of the room's goal would scatter across up to 13
 *    subjects. With ONE `goal:<room-slug>` node, walking that single node's
 *    inbound SOURCED_FROM edges returns the complete, ordered, human-confirmed
 *    history of every goal change in the room, in one hop. Seeding
 *    `jtbd:<slug>` to revive focus.cjs Rule 1 is a different fact and a
 *    different phase (345-ICM-CONSULT R10).
 *
 * 3. `node.type` IS `'goal'` AND NEVER `'claim'`. A `claim`-typed anchor with
 *    nothing above it would land in Phase 343's `unanchored_claims` numerator
 *    as a brand-new unanchored claim in every room that ever renders a
 *    strategy card.
 *
 * 4. `epistemic_type` IS `'assumption'`, the weakest honest member of the
 *    closed 10-member enum (node-insert.cjs ALLOWED_EPISTEMIC_TYPES), at
 *    `review_status: 'proposed'`, promoted to `confirmed` by
 *    `navigation.confirmNode` on approve (plan 07). `decision` is reserved
 *    for gate-produced nodes and the anchor is minted BEFORE ratification, so
 *    it is not a decision. That keeps `epistemic_type` describing the kind of
 *    statement and `review_status` describing who vouched, which is the split
 *    the repo already uses (reasoning-write.cjs:150-153).
 *
 * 5. A REJECTED OR DEFERRED GATE LEAVES AN ANCHOR WITH ZERO INBOUND EDGES.
 *    That is harmless (a node is not a dangling edge) but it does increment
 *    the node census; say so here so a future doctor run does not read it as
 *    a defect.
 *
 * ORDER IS THE WHOLE DELIVERABLE (345-ICM-CONSULT R2, BLOCKING). `writeEdge`
 * never probes whether either endpoint has a node row (the foreign key was
 * deliberately removed in Phase 169 D-169-11). So a SOURCED_FROM edge written
 * to a `goal:<slug>` id that was never inserted still succeeds and becomes a
 * NEW dangling-edge row -- one of the exact defects Phase 343 exists to
 * count. The caller (lib/core/strategy/strategy-card.cjs) MUST call
 * mintGoalAnchor and confirm `ok: true` BEFORE the card is assembled. Mint
 * first, or do not point at it.
 *
 * DO NOT HAND-ROLL THE SEEDING (345-ICM-CONSULT R3). spine-events.cjs:272-300
 * `_emitWithOperatorEdge` is the shipped idiom for exactly this move (seed a
 * node idempotently, best-effort, never let a seed failure change the
 * caller's result) for a sibling fact, the operator transition. This module
 * copies that discipline: validate first, never throw, degrade to
 * `{ ok: false, reason }` on any fault.
 *
 * Canon Part 9: the single node-write chokepoint is node-insert.cjs::
 * insertNode; this file never issues a raw node-table SQL insert directly.
 * Canon Part 8: zero network surface. Pure LOCAL SQLite over a caller-owned
 * conn handle (never opens room.db itself).
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const { insertNode } = require('../node-insert.cjs');

/**
 * GOAL_ANCHOR_ID(roomSlug) -> 'goal:<roomSlug>', or null.
 *
 * Mirrors reasoning-write.cjs::REASONING_NODE_ID's shape: null on any
 * non-string or empty input, never throws.
 *
 * @param {*} roomSlug
 * @returns {string|null}
 */
function GOAL_ANCHOR_ID(roomSlug) {
  if (typeof roomSlug !== 'string' || roomSlug.length === 0) return null;
  return 'goal:' + roomSlug;
}

/**
 * mintGoalAnchor(db, roomSlug) -> { ok, node_id?, created?, reason?, detail? }
 *
 * Idempotently upserts the payload-free `goal:<roomSlug>` node through the
 * node-insert.cjs chokepoint. Safe to call on every card build: `on_conflict:
 * 'nothing'` means a re-run never touches `last_seen_at` or any other column
 * on an existing row (byte-identical re-mint).
 *
 * Never throws. Validates `db` and `roomSlug` FIRST, before any query.
 *
 * @param {{prepare: Function}} db - caller-owned node:sqlite DatabaseSync
 * @param {*} roomSlug
 * @returns {{ok: boolean, node_id?: string, created?: boolean, reason?: string, detail?: string}}
 */
function mintGoalAnchor(db, roomSlug) {
  if (!db || typeof db.prepare !== 'function') {
    return { ok: false, reason: 'no_db' };
  }
  const id = GOAL_ANCHOR_ID(roomSlug);
  if (id === null) {
    return { ok: false, reason: 'invalid_slug' };
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
    // to re-run on every card build without touching last_seen_at, which is
    // what "idempotent" has to mean here.
    insertNode(db, id, 'goal', '{}', {
      source_path: 'system:goal-anchor',
      created_by: 'system',
      epistemic_type: 'assumption',
      review_status: 'proposed',
      on_conflict: 'nothing',
    });
  } catch (e) {
    // Best-effort, _emitWithOperatorEdge discipline: a seeding fault never
    // throws past this function; the caller decides what to do with a
    // failed mint (strategy-card.cjs returns null rather than a card
    // pointing at nothing).
    return { ok: false, reason: 'anchor_write_failed', detail: String((e && e.message) || e).slice(0, 80) };
  }

  return { ok: true, node_id: id, created: created };
}

module.exports = { mintGoalAnchor, GOAL_ANCHOR_ID };
