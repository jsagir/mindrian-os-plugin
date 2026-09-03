'use strict';
/*
 * Phase 223-02 -- typed-open-question: the net-new `open_question` node-write
 * chokepoint for the JTBD-driven intelligence pipeline (SPEC Req 4). This is the
 * writer the shipped reader lib/core/navigation/insights.cjs::findOpenQuestions
 * has always SELECTed for (n.type = 'open_question') but that navigation never
 * shipped a WRITER for. The 223 close-the-loop contract (close-loop-writer.cjs)
 * turns every UNKNOWN a surface surfaces into an open_question node through this
 * door, so the gaps a debate could not close become first-class graph citizens.
 *
 * This module is modeled line-for-line on lib/core/navigation/typed-claim.cjs:
 * the isPlainObject helper, the crypto-free 31-multiplier stable hash id-minter,
 * the additive-JSON-props discipline (the D-10 precedent), and the defensive
 * never-throw contract. It is an allow-listed navigation submodule
 * (scripts/check-substrate.cjs regex /^lib\/core\/navigation\// covers it). It
 * takes a db handle owned by the caller (via lib/core/room-db.cjs openRoomDb)
 * EXACTLY like typed-claim.cjs writeClaimNode and edges.cjs writeEdge: it NEVER
 * requires the sqlite driver and NEVER opens room.db itself, so it stays inside
 * the navigation allow-list with zero substrate bypass.
 *
 * Canon Part 9 (the human gate): an open_question is BORN review_status
 *   'proposed' and is NEVER auto-confirmed by an agent. Promotion to 'confirmed'
 *   requires a human APPROVE routed through navigation.confirmNode(byUser). This
 *   writer mints the node and nothing else; there is deliberately NO confirm
 *   path here (Part 9 role 5). The DO UPDATE SET clause EXCLUDES review_status
 *   so a human-confirmed question re-projected by the system stays confirmed
 *   (the no-downgrade idiom, copied verbatim from typed-claim.cjs writeClaimNode).
 *
 * Canon Part 8: zero network surface. Pure LOCAL SQLite over a caller-owned
 *   handle. No Brain calls; the question prose never leaves the room. review_status
 *   is the only CHECK-constrained column; the question text + source ride the
 *   additive properties JSON blob, never a DDL column. Zero ALTER TABLE.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const { insertNode } = require('../node-insert.cjs');

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// The props keys this writer OWNS. An extraProps bag may NEVER override them
// (the typed-opportunity.cjs protected-key discipline): the question text and
// its source provenance are fixed by the caller's named params, not by the
// additive bag. review_status / type are never props keys at all, so they can
// never be reached through extraProps either.
const PROTECTED_OPEN_QUESTION_KEYS = Object.freeze(['question', 'source']);

// OPEN_QUESTION_NODE_ID(sessionId, questionKey) -- the idempotent id-minter.
// Same crypto-free, dependency-free stable 31-multiplier hash over the question
// key as typed-claim.cjs CLAIM_NODE_ID, so re-writing the same question in the
// same session is an UPSERT, not a duplicate. Node id 'open_question:'+sid+':'+hash.
function OPEN_QUESTION_NODE_ID(sessionId, questionKey) {
  const sid = typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : 'nosession';
  const key = typeof questionKey === 'string' && questionKey.length > 0 ? questionKey : 'noquestion';
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return 'open_question:' + sid + ':' + hash.toString(16);
}

// writeOpenQuestionNode(db, params) -- UPSERT a typed 'open_question' node.
//
// params = { question, sessionId, source?, extraProps? }.
//   question    mandatory non-empty string (the unknown made explicit)
//   sessionId   idempotency scope
//   source      optional provenance scalar (which surface/step raised it)
//   extraProps  optional plain-object bag merged AFTER the fixed keys, with the
//               PROTECTED_OPEN_QUESTION_KEYS filtered out; a non-plain-object is
//               ignored (byte-identical shape when absent).
//
// type 'open_question', created_by 'system', confidence 1.0, review_status
// 'proposed' at INSERT. The DO UPDATE SET clause updates properties + last_seen_at
// ONLY (review_status never touched -- the no-downgrade idiom). Defensive: never
// throws on caller input; returns { ok:false, reason } on failure.
function writeOpenQuestionNode(db, params) {
  if (!db || typeof db.prepare !== 'function') {
    return { ok: false, reason: 'invalid_db' };
  }
  if (!isPlainObject(params)) {
    return { ok: false, reason: 'invalid_params' };
  }
  const { question, sessionId, source, extraProps } = params;
  if (typeof question !== 'string' || question.length === 0) {
    return { ok: false, reason: 'invalid_question' };
  }
  // Additive JSON props ONLY (the D-10 precedent). The fixed keys land first.
  const props = {
    question: question,
    source: typeof source === 'string' ? source : '',
  };
  // The protected-key filter runs BEFORE the props merge: extraProps may never
  // override the question text or its source provenance (typed-opportunity's
  // discipline). A non-plain-object bag is silently ignored.
  if (isPlainObject(extraProps)) {
    for (const k of Object.keys(extraProps)) {
      if (PROTECTED_OPEN_QUESTION_KEYS.indexOf(k) === -1) props[k] = extraProps[k];
    }
  }
  let propsJson;
  try {
    propsJson = JSON.stringify(props);
  } catch (_e) {
    return { ok: false, reason: 'properties_serialize_failed' };
  }
  const sid = typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : 'nosession';
  const nodeId = OPEN_QUESTION_NODE_ID(sid, question);
  const sourcePath = 'open_question:' + sid + ':' + (typeof source === 'string' && source.length > 0 ? source : 'inline');
  try {
    // review_status='proposed' on INSERT (born proposed, never auto-confirmed).
    // insertNode's DO UPDATE clause never touches review_status or confidence,
    // so a human-confirmed question re-projected by the system stays confirmed
    // (no downgrade). That no-downgrade guarantee now lives inside insertNode.
    insertNode(db, nodeId, 'open_question', propsJson, {
      source_path: sourcePath,
      created_by: 'system',
      confidence: 1.0,
      review_status: 'proposed',
    });
  } catch (e) {
    return { ok: false, reason: 'open_question_write_failed', detail: String(e.message || '').slice(0, 80) };
  }
  return { ok: true, node_id: nodeId };
}

module.exports = { writeOpenQuestionNode, OPEN_QUESTION_NODE_ID, PROTECTED_OPEN_QUESTION_KEYS };
