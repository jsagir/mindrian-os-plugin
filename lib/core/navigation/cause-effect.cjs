'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 400 plan 08 (CY-03, O-04, Part 9): the one owner of identity key problem.cause_effect.
 *
 * The value is the navigator's answer on a gate card of kind cause_effect_domain only. It is never
 * inferred from room text (F-02). One domain per room (O-04): a new write replaces the old one.
 *
 *   writeCauseEffect(db, {domain, gateId, decisionNodeId, answeredVia})  upsert the key; the caller owns the transaction
 *   readCauseEffect(db)                                     the stored value, or null
 *   readCauseEffectForRoom(roomDir)                         the same through a read-only handle; never creates room.db
 *
 * The stored value is JSON: {domain, source: 'navigator', gate_id, decision_node_id, answered_via, updated_at (epoch ms)}.
 * The domain is a closed label from lib/core/problem-axes.cjs, never room text.
 * Review WR-06 (Part 9 provenance): answered_via is how the gate answer reached the room, the same word gate_answer
 * records (browser_nonce: the person answered the card in the browser, proven; mcp_relayed: the host model relayed
 * the answer, not proven). Any other value, and a value stored before this field, reads as unrecorded. A consumer
 * that needs a proven answer checks answered_via, not source.
 *
 * Substrate note: this is an allow-listed navigation submodule (scripts/check-substrate.cjs). The read-only door
 * comes from ./spine-events.cjs, not navigation.cjs, so the require graph stays small and has no cycle.
 * Canon Part 8: zero network; lib/core/navigation/packet.cjs does not read this key.
 *
 * Hyphens only in this file.
 */

const { isCauseEffectDomain } = require('../problem-axes.cjs');
const spine = require('./spine-events.cjs');

const KEY = 'problem.cause_effect';
const SOURCE = 'navigator';
const ANSWERED_VIA = Object.freeze(['browser_nonce', 'mcp_relayed']);
const UNRECORDED = 'unrecorded';

function answeredViaOf(x) {
  return typeof x === 'string' && ANSWERED_VIA.indexOf(x) !== -1 ? x : UNRECORDED;
}

function optString(x) {
  return typeof x === 'string' && x.length > 0 ? x : null;
}

/**
 * Write the navigator's domain. The caller owns the transaction. A refused domain writes nothing.
 * @param {import('node:sqlite').DatabaseSync} db write handle owned by the caller
 * @param {{domain:string, gateId?:string, decisionNodeId?:string, answeredVia?:string}} args
 * @returns {{ok:true, domain:string} | {ok:false, reason:string}}
 */
function writeCauseEffect(db, args) {
  const a = args && typeof args === 'object' ? args : {};
  if (!isCauseEffectDomain(a.domain)) return { ok: false, reason: 'not_a_domain' };
  if (!db || typeof db.prepare !== 'function') return { ok: false, reason: 'no_db' };
  const value = {
    domain: a.domain,
    source: SOURCE,
    gate_id: optString(a.gateId),
    decision_node_id: optString(a.decisionNodeId),
    answered_via: answeredViaOf(a.answeredVia),
    updated_at: Date.now(),
  };
  db.prepare(
    'INSERT INTO identity (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
  ).run(KEY, JSON.stringify(value), new Date(value.updated_at).toISOString());
  return { ok: true, domain: a.domain };
}

function parseValue(raw) {
  if (typeof raw !== 'string') return null;
  let v;
  try { v = JSON.parse(raw); } catch (_e) { return null; }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  if (!isCauseEffectDomain(v.domain)) return null;
  if (v.source !== SOURCE) return null;
  return {
    domain: v.domain,
    source: SOURCE,
    gate_id: optString(v.gate_id),
    decision_node_id: optString(v.decision_node_id),
    answered_via: answeredViaOf(v.answered_via),
    updated_at: Number.isInteger(v.updated_at) ? v.updated_at : null,
  };
}

/**
 * Read the stored domain. Null for a missing key, invalid JSON, an unknown domain or a source other than navigator.
 * Never throws.
 * @param {import('node:sqlite').DatabaseSync} db
 */
function readCauseEffect(db) {
  try {
    if (!db || typeof db.prepare !== 'function') return null;
    const row = db.prepare('SELECT value FROM identity WHERE key = ?').get(KEY);
    return row ? parseValue(row.value) : null;
  } catch (_e) {
    return null;
  }
}

/**
 * Read the stored domain of a room through a read-only handle. Null when room.db is absent (the file is not
 * created) or on any error. Closes the handle in finally. Never throws.
 * @param {string} roomDir
 */
function readCauseEffectForRoom(roomDir) {
  let db = null;
  try {
    db = spine.openRoomDbReadOnlyForCaller(roomDir);
    if (!db) return null;
    return readCauseEffect(db);
  } catch (_e) {
    return null;
  } finally {
    spine.closeRoomDbForCaller(db);
  }
}

module.exports = {
  KEY,
  writeCauseEffect,
  readCauseEffect,
  readCauseEffectForRoom,
};
