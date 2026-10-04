'use strict';
// Phase 369 plan 33 (SHELL369-12 visibility half, GREC369-05 read surface) -- the
// durable gate records.
//
// Why this module exists. Claude Code runs the MindrianOS server as its OWN stdio
// process (.mcp.json starts it directly; 369-SESSION-CONTRACT.md section 4), so a
// gate Larry raises with gate_render lives only in that process's in-memory ledger
// (lib/mcp/gate-ledger.cjs). The shell talks to a different process, the flag-ON
// daemon, and can never see that ledger. The one medium both processes share is the
// room's room.db, the same medium the change feed already uses across processes
// (D-18). So every gate minted for a session bound to a room leaves ONE durable
// `gate_raised` record in that room, and a take that leaves without a recorded
// answer leaves one `gate_closed` record. The read side is in
// lib/core/navigation/room-projection.cjs (readOpenRaisedGates, readGateState).
//
// What the record is. A memory_event through navigation.logMemoryEvent, event type
// mcp_client_event_logged (the type gate_answer already uses for its answer record,
// so EVENT_TYPES is unchanged), label gate_raised, dedupe key gate_raised:<id>.
// logEvent accepts the contract as plain nested fields, so no contract_json string
// field is needed. The record carries the CARD CONTRACT ONLY: header, kind, select
// mode, options with ranks and previews, the recommended id, the notice, the
// approve label, the subject and evidence node ids, the approving ids, the
// framework handle, the minted and expiry times, and whether a step resumes on it.
// It NEVER carries a session id, a session key, a ledger key, a secret, or anything
// that reaches a Brain call (Canon Part 8 room-local, D-16, D-19; arm 2 of
// tests/test-369-gate-raised.cjs asserts it). contractOf copies by field name from
// the normalized card and the entry's named fields; it never spreads the entry.
//
// What it is not. A mint with no bound room, a binding card (kind 'binding') and a
// mirror (an entry carrying mirrorOf, plan 369-36) leave no open record. Answering
// still needs the session-scoped ledger entry: reading the record lets a surface
// SHOW the gate, never answer it (D-16).
//
// Failure model. Every function here answers { ok, reason } and never throws: a
// failed record write must not change a mint or a take (the ledger also swallows an
// observer's throw). Canon Part 9: room.db is reached only through navigation.cjs.
// Canon Part 8: zero network. CJS, 'use strict'. No em-dashes.

const navigation = require('../core/navigation.cjs');
const gateLedger = require('./gate-ledger.cjs');

// Per-field caps, shared in value with room-projection.cjs's reader (which re-bounds
// every field it serves, so a hand-edited row cannot hand a client an unbounded payload).
const CAP_HEADER = 200;
const CAP_LABEL = 200;
const CAP_DESCRIPTION = 500;
const CAP_PREVIEW = 1000;
const CAP_NOTICE = 500;
const CAP_ID = 200;
const MAX_OPTIONS = 20;
const MAX_EVIDENCE = 20;

function cap(v, n) {
  if (typeof v !== 'string') return null;
  return v.length > n ? v.slice(0, n) : v;
}

function capIds(list, max) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const v of list) {
    if (typeof v !== 'string' || v.length === 0) continue;
    out.push(cap(v, CAP_ID));
    if (out.length >= max) break;
  }
  return out;
}

/**
 * contractOf(gateId, entry) -> the bounded gate_raised payload, or null when the
 * entry is not recordable (a binding card, a mirror, no card).
 */
function contractOf(gateId, entry) {
  if (typeof gateId !== 'string' || gateId.length === 0) return null;
  if (!entry || typeof entry !== 'object') return null;
  if (entry.kind === 'binding') return null;
  if (entry.mirrorOf !== undefined && entry.mirrorOf !== null && entry.mirrorOf !== false) return null;
  const card = (entry.card && typeof entry.card === 'object') ? entry.card : null;
  if (!card) return null;

  const options = [];
  const rawOptions = Array.isArray(card.options) ? card.options : [];
  for (const o of rawOptions) {
    if (!o || typeof o !== 'object' || typeof o.id !== 'string' || o.id.length === 0) continue;
    options.push({
      id: cap(o.id, CAP_ID),
      label: cap(typeof o.label === 'string' ? o.label : o.id, CAP_LABEL),
      description: cap(o.description, CAP_DESCRIPTION),
      rank: (typeof o.rank === 'number' && Number.isFinite(o.rank)) ? o.rank : null,
      preview: cap(o.preview, CAP_PREVIEW),
      recommended: o.recommended === true,
    });
    if (options.length >= MAX_OPTIONS) break;
  }
  const approveOption = options.find((o) => o.id === 'approve');

  const mintedAt = (typeof entry.mintedAt === 'number' && Number.isFinite(entry.mintedAt)) ? entry.mintedAt : Date.now();
  const kind = (typeof entry.kind === 'string' && entry.kind.length > 0) ? entry.kind : 'general';
  const framework = (entry.haltedStep && typeof entry.haltedStep === 'object' && typeof entry.haltedStep.framework === 'string')
    ? cap(entry.haltedStep.framework, CAP_ID)
    : null;

  return {
    label: 'gate_raised',
    gate_id: cap(gateId, CAP_ID),
    dedupe_key: 'gate_raised:' + gateId,
    gate_kind: cap(kind, CAP_ID),
    header: cap(card.header, CAP_HEADER),
    select_mode: card.selectMode === 'multi' ? 'multi' : 'single',
    options: options,
    recommended: cap(card.recommended, CAP_ID),
    notice: cap(card.notice, CAP_NOTICE),
    approve_label: approveOption ? approveOption.label : null,
    subject_node_id: cap(card.subjectNodeId, CAP_ID),
    evidence_node_ids: capIds(card.evidenceNodeIds, MAX_EVIDENCE),
    approving: Array.isArray(entry.approving) ? capIds(entry.approving, MAX_OPTIONS) : null,
    framework: framework,
    minted_at: mintedAt,
    expires_at: mintedAt + gateLedger.LEDGER_TTL_MS,
    resumes: typeof entry.resumeFn === 'function',
  };
}

/**
 * mirrorCardFrom(record) -> the card a MIRROR of a recorded gate is drawn from
 * (plan 369-36), or null when the record cannot be mirrored. `record` is the
 * bounded contract the room readers serve (navigation.readRaisedGate /
 * readGateState), so this is the room's own copy of the card and never the
 * caller's: header, select mode, options with ranks, descriptions, previews and
 * the recommended flag, subject and evidence ids. Returns the gate_render input
 * names (header, kind, select_mode, options, subject_node_id, evidence_node_ids)
 * plus what the mirror's ledger entry must carry: approving (the 289 verdict and
 * chosen coherence ids), framework (a chain halt's handle, so the mirror's
 * decision node gets the same USES_FRAMEWORK edge), expires_at and source_kind.
 *
 * A material_step or binding source mirrors as a general card: the mirror has no
 * resume owner, the source's owner resumes its own step (answered_elsewhere), and a
 * mirror must never promote a card subject on behalf of an action authorization.
 * Copies by field name; carries no session identity (there is none in a record).
 */
function mirrorCardFrom(record) {
  if (!record || typeof record !== 'object') return null;
  const rawOptions = Array.isArray(record.options) ? record.options : [];
  const options = [];
  for (const o of rawOptions) {
    if (!o || typeof o !== 'object' || typeof o.id !== 'string' || o.id.length === 0) continue;
    const out = { id: o.id, label: (typeof o.label === 'string' && o.label.length > 0) ? o.label : o.id };
    if (typeof o.description === 'string') out.description = o.description;
    if (typeof o.rank === 'number' && Number.isFinite(o.rank)) out.rank = o.rank;
    if (typeof o.preview === 'string') out.preview = o.preview;
    if (o.recommended === true) out.recommended = true;
    options.push(out);
  }
  if (options.length === 0) return null;
  const sourceKind = (typeof record.kind === 'string' && record.kind.length > 0) ? record.kind : 'general';
  const kind = (sourceKind === 'material_step' || sourceKind === 'binding') ? 'general' : sourceKind;
  return {
    header: typeof record.header === 'string' ? record.header : undefined,
    kind: kind,
    select_mode: record.select_mode === 'multi' ? 'multi' : 'single',
    options: options,
    subject_node_id: (typeof record.subject_node_id === 'string' && record.subject_node_id.length > 0) ? record.subject_node_id : undefined,
    evidence_node_ids: Array.isArray(record.evidence_node_ids) ? record.evidence_node_ids.slice() : [],
    approving: Array.isArray(record.approving) ? record.approving.slice() : null,
    framework: (typeof record.framework === 'string' && record.framework.length > 0) ? record.framework : null,
    expires_at: (typeof record.expires_at === 'number' && Number.isFinite(record.expires_at)) ? record.expires_at : null,
    source_kind: sourceKind,
  };
}

/**
 * mirrorOptionIdsMatch(record, callerOptions) -> true only when the caller's option
 * ids equal the recorded ids in the same order. A caller that cannot repeat the
 * record's ids is not looking at the record's card (mirror_mismatch).
 */
function mirrorOptionIdsMatch(record, callerOptions) {
  const recorded = (record && Array.isArray(record.options)) ? record.options.map((o) => o && o.id) : [];
  const given = Array.isArray(callerOptions) ? callerOptions.map((o) => (o && typeof o === 'object') ? o.id : undefined) : [];
  if (recorded.length === 0 || recorded.length !== given.length) return false;
  for (let i = 0; i < recorded.length; i += 1) {
    if (typeof recorded[i] !== 'string' || recorded[i] !== given[i]) return false;
  }
  return true;
}

function closeQuietly(db) {
  if (!db) return;
  try { navigation.closeRoomDbForCaller(db); } catch (_e) { /* best effort */ }
}

/**
 * recordRaised(roomDir, gateId, entry) -> { ok, reason? }. Writes one gate_raised
 * memory_event into the room. Never throws.
 */
function recordRaised(roomDir, gateId, entry) {
  if (typeof roomDir !== 'string' || roomDir.length === 0) return { ok: false, reason: 'no_room' };
  let contract = null;
  try {
    contract = contractOf(gateId, entry);
  } catch (_e) {
    contract = null;
  }
  if (!contract) return { ok: false, reason: 'not_recorded' };
  let db = null;
  try {
    db = navigation.openRoomDbForCaller(roomDir);
    if (!db) return { ok: false, reason: 'no_room_db' };
    const res = navigation.logMemoryEvent(db, 'mcp_client_event_logged', contract);
    if (!res || res.ok !== true) {
      return { ok: false, reason: String((res && res.reason) || 'log_failed').slice(0, 80) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: String((e && e.message) || e).slice(0, 80) };
  } finally {
    closeQuietly(db);
  }
}

/**
 * recordClosedIfUnanswered(roomDir, gateId) -> { ok, reason?, skipped? }. A take
 * that left without a recorded answer (an inline elicitation answer, a chain
 * resume, a binding-style take) writes one gate_closed memory_event, so the room
 * stops listing the gate. When an answer anchor already exists nothing is written.
 * Never throws.
 */
function recordClosedIfUnanswered(roomDir, gateId) {
  if (typeof roomDir !== 'string' || roomDir.length === 0) return { ok: false, reason: 'no_room' };
  if (typeof gateId !== 'string' || gateId.length === 0) return { ok: false, reason: 'no_gate' };
  let db = null;
  try {
    db = navigation.openRoomDbForCaller(roomDir);
    if (!db) return { ok: false, reason: 'no_room_db' };
    const anchor = navigation.readGateAnswerAnchor(db, gateId);
    if (anchor && anchor.found === true) return { ok: true, skipped: 'answered' };
    const res = navigation.logMemoryEvent(db, 'mcp_client_event_logged', {
      label: 'gate_closed',
      gate_id: cap(gateId, CAP_ID),
      reason: 'taken_without_answer',
      dedupe_key: 'gate_closed:' + gateId,
    });
    if (!res || res.ok !== true) {
      return { ok: false, reason: String((res && res.reason) || 'log_failed').slice(0, 80) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: String((e && e.message) || e).slice(0, 80) };
  } finally {
    closeQuietly(db);
  }
}

module.exports = {
  contractOf,
  mirrorCardFrom,
  mirrorOptionIdsMatch,
  recordRaised,
  recordClosedIfUnanswered,
  CAPS: Object.freeze({
    header: CAP_HEADER, label: CAP_LABEL, description: CAP_DESCRIPTION, preview: CAP_PREVIEW,
    notice: CAP_NOTICE, id: CAP_ID, options: MAX_OPTIONS, evidence: MAX_EVIDENCE,
  }),
};
