'use strict';
/*
 * Quick task 260725-9ca -- reified-claim: the LOCAL, SQLite-native reified-claim
 * event write chokepoint, starting with ContradictionEvent. This module mirrors
 * the SHAPE of Phase 132's Brain-side lib/brain/hypergraph-event-schema.cjs (a
 * reified event node wired by typed edges to its participants, carrying
 * scalar/enum properties) as a NEW, SEPARATE, LOCAL-only module.
 *
 * WHY A SEPARATE MODULE (Canon Part 8 -- the hard boundary this file exists to
 *   respect): lib/brain/hypergraph-event-schema.cjs is BRAIN-SIDE. It reifies
 *   generic PWS teaching content (Person / Framework / Book) into the remote
 *   Neo4j teaching graph via Cypher MERGE. Canon Part 8 forbids routing local
 *   room/repo-specific data through it (LOCAL -> BRAIN: NO). So this module NEVER
 *   requires, imports, or reuses hypergraph-event-schema.cjs. It only MIRRORS its
 *   shape (a role table + a deterministic id-minter) for the LOCAL room.db, whose
 *   participants are the user's OWN typed_claim nodes, not generic frameworks.
 *   The two modules share a shape, never a byte.
 *
 * This module is an allow-listed navigation submodule (scripts/check-substrate.cjs
 * regex /^lib\/core\/navigation\// covers it). It takes a db handle owned by the
 * caller (via lib/core/room-db.cjs openRoomDb) EXACTLY like
 * lib/core/navigation/typed-entity.cjs / typed-claim.cjs / edges.cjs writeEdge:
 * it NEVER requires node:sqlite and NEVER opens room.db itself, so it stays inside
 * the navigation allow-list with zero substrate bypass. It requires ONLY
 * node:crypto (a Node.js builtin, zero new deps), ../node-insert.cjs (insertNode)
 * and ./edges.cjs (writeEdge).
 *
 * Canon Part 7 (reuse before build): the event node is written through the shared
 *   insertNode NOT-NULL-safe chokepoint (never a bare INSERT), and the two edges
 *   land EXCLUSIVELY through navigation.writeEdge (never a raw INSERT INTO edges).
 *   The participant seed side reuses the shipped writeClaimNode; this module does
 *   not hand-roll a second node/edge write path.
 *
 * Canon Part 8: zero network surface. Pure LOCAL SQLite over a caller-owned
 *   handle. No Brain calls; no claim prose ever leaves the room. The two event
 *   edges (CONCERNS / CONTRADICTS) carry ENUM/scalar props ONLY (a relation enum +
 *   scalar node-id handles). evidence is a short handle/id, NEVER full prose, and
 *   is truncated to 200 chars on write (the createCausalClaim cause/effect
 *   truncation precedent).
 *
 * Canon Part 9 (the human gate, NO carve-out here): a ContradictionEvent ASSERTS
 *   something about the graph (that one claim contradicts another), so like an
 *   entity it is a truth-bearing node and lands review_status 'proposed' by the
 *   column DEFAULT -- it is NEVER auto-confirmed. Promotion to 'confirmed' requires
 *   a human APPROVE at a Decision Gate (navigation.confirmNode). Mirrors
 *   typed-entity.cjs writeEntityNode exactly: there is no taxonomy-confirmed branch.
 *
 * SCOPE (260725-9ca-CONTEXT.md, LOCKED): this ships create-with-initial-status
 *   ONLY. There is no update/resolve verb. Because the deterministic id hashes
 *   evidence + status, a status change simply mints a DIFFERENT event node today;
 *   an open -> resolved transition verb is explicit future follow-up, out of scope.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const crypto = require('node:crypto');
const { insertNode } = require('../node-insert.cjs');
const { writeEdge } = require('./edges.cjs');

// The LOCAL role table this module ships. Mirrors the SHAPE of
// hypergraph-event-schema.cjs EVENT_NODE_TYPES.ContradictionEvent.roles, but the
// `node` values point at the LOCAL typed_claim node type ('claim'), and the
// `edge` values are the LOCAL edge vocabulary: CONCERNS (net-new per the Edge
// vocabulary decision) for the claim participant, CONTRADICTS (reused verbatim,
// no CONTRADICTED_BY minted) for the rivalClaim participant. evidence + status
// are scalar roles (a property on the event node, no edge).
const REIFIED_EVENT_TYPES = Object.freeze({
  ContradictionEvent: Object.freeze({
    label: 'ContradictionEvent',
    roles: Object.freeze([
      Object.freeze({ role: 'claim', node: 'claim', edge: 'CONCERNS', kind: 'participant' }),
      Object.freeze({ role: 'rivalClaim', node: 'claim', edge: 'CONTRADICTS', kind: 'participant' }),
      Object.freeze({ role: 'evidence', kind: 'scalar' }),
      Object.freeze({ role: 'status', kind: 'scalar' }),
    ]),
  }),
});

// The LOCAL node type a claim / rivalClaim participant MUST be (the Legal
// participant node types decision, 260725-9ca-CONTEXT.md): only nodes of type
// 'claim' -- typed_claim nodes minted by lib/core/navigation/typed-claim.cjs
// writeClaimNode -- are legal participants for this first cut. Extending to more
// participant types later is additive (a role-table entry), not a redesign.
const PARTICIPANT_NODE_TYPE = 'claim';

// The closed 2-member status enum. A ContradictionEvent is born 'open' and can be
// 'resolved'; this task ships create-with-initial-status only (no transition
// verb), so both are just legal INITIAL values. Mirrors the KNOWLEDGE_TYPES /
// ENTITY_NODE_TYPES frozen-Set idiom.
const REIFIED_STATUS_VALUES = Object.freeze(new Set(['open', 'resolved']));

// The max evidence handle length. evidence is a short handle/id, never full prose
// (Canon Part 8 + the CONTEXT.md worked example); truncate on write, mirroring
// lib/core/lazygraph-ops.cjs createCausalClaim's cause/effect truncation.
const EVIDENCE_MAX_LEN = 200;

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// REIFIED_CLAIM_EVENT_ID(eventType, participants) -- the deterministic id-minter.
// Mirrors hypergraph-event-schema.cjs deterministicEventId construction exactly:
// build parts = [eventType], push role + '=' + String(value) for every role whose
// participant value is non-null in role-table order, join with '|', sha256 the
// joined key, take the first 16 hex chars. But it RETURNS
// 'event:' + eventType.toLowerCase() + ':' + hash instead of the Brain-side
// eventType.toLowerCase().replace('event','') + '-' + hash shape -- this
// namespaces the id against the entity: / claim: / domain: prefixes already used
// in room.db's nodes.id space, and is the SQLite INSERT ... ON CONFLICT(id) target
// this task needs instead of a Cypher MERGE target. Because the hash includes
// evidence + status, changing either mints a DIFFERENT node -- deliberate, and
// consistent with the create-with-initial-status-only Scope decision.
function REIFIED_CLAIM_EVENT_ID(eventType, participants) {
  const def = REIFIED_EVENT_TYPES[eventType];
  const p = isPlainObject(participants) ? participants : {};
  const parts = [eventType];
  if (def) {
    def.roles.forEach(function (r) {
      const v = p[r.role];
      if (v != null) parts.push(r.role + '=' + String(v));
    });
  }
  const key = parts.join('|');
  const hash = crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
  return 'event:' + eventType.toLowerCase() + ':' + hash;
}

// writeContradictionEvent(db, params) -- the primary export. Reify a local
// contradiction between two typed_claim nodes as a first-class ContradictionEvent
// node wired by a CONCERNS edge to its claim and a CONTRADICTS edge to its
// rivalClaim.
//
// params = { claim, rivalClaim, evidence, status }.
//   claim / rivalClaim -- node ids of EXISTING type='claim' (typed_claim) nodes.
//   evidence -- a short handle/id (never full prose), truncated to 200 chars.
//   status -- optional, one of REIFIED_STATUS_VALUES; defaults to 'open'.
//
// Returns { ok:true, node_id, event_type:'ContradictionEvent', edges:[...] } on
// success, or { ok:false, reason, detail? } on any validation or write failure.
// Defensive: NEVER throws on caller input.
function writeContradictionEvent(db, params) {
  // Shape validation FIRST (fail closed before any db read or write).
  if (!isPlainObject(params)) {
    return { ok: false, reason: 'invalid_params' };
  }
  const { claim, rivalClaim, evidence, status } = params;
  if (typeof claim !== 'string' || claim.length === 0) {
    return { ok: false, reason: 'invalid_claim' };
  }
  if (typeof rivalClaim !== 'string' || rivalClaim.length === 0) {
    return { ok: false, reason: 'invalid_rival_claim' };
  }
  if (claim === rivalClaim) {
    // A claim cannot contradict itself.
    return { ok: false, reason: 'invalid_same_participant' };
  }
  if (typeof evidence !== 'string' || evidence.length === 0) {
    return { ok: false, reason: 'invalid_evidence' };
  }
  // status defaults to 'open' when absent; when supplied it must be in the enum.
  let statusValue = 'open';
  if (status !== undefined && status !== null) {
    if (typeof status !== 'string' || !REIFIED_STATUS_VALUES.has(status)) {
      return { ok: false, reason: 'invalid_status', detail: String(status).slice(0, 40) };
    }
    statusValue = status;
  }

  // Participant-type gate (T-9ca-01): READ back claim + rivalClaim from the nodes
  // table and reject when a row is missing OR its type is not 'claim'. This is a
  // READ, not a second write path. It runs ONLY after the shape validations pass,
  // so no db access happens on a malformed params object.
  let claimRow;
  let rivalRow;
  try {
    const sel = db.prepare('SELECT type FROM nodes WHERE id = ?');
    claimRow = sel.get(claim);
    rivalRow = sel.get(rivalClaim);
  } catch (e) {
    return { ok: false, reason: 'participant_lookup_failed', detail: String(e.message || '').slice(0, 80) };
  }
  if (!claimRow || claimRow.type !== PARTICIPANT_NODE_TYPE) {
    return {
      ok: false,
      reason: 'invalid_claim_participant_type',
      detail: claimRow ? String(claimRow.type).slice(0, 40) : 'missing',
    };
  }
  if (!rivalRow || rivalRow.type !== PARTICIPANT_NODE_TYPE) {
    return {
      ok: false,
      reason: 'invalid_rival_claim_participant_type',
      detail: rivalRow ? String(rivalRow.type).slice(0, 40) : 'missing',
    };
  }

  // evidence is a short handle, never prose: truncate on write (Part 8 +
  // createCausalClaim precedent).
  const evidenceHandle = evidence.slice(0, EVIDENCE_MAX_LEN);

  // Mint the deterministic id. The hash includes evidence + status, so the same
  // (claim, rivalClaim, evidence, status) tuple always mints the same node id
  // (idempotent: the ON CONFLICT(id) target replaces the Cypher MERGE).
  const eventId = REIFIED_CLAIM_EVENT_ID('ContradictionEvent', {
    claim: claim,
    rivalClaim: rivalClaim,
    evidence: evidenceHandle,
    status: statusValue,
  });

  // Additive JSON props ONLY (the D-10 precedent): evidence + status live in the
  // properties blob, never new DDL columns.
  let propsJson;
  try {
    propsJson = JSON.stringify({ evidence: evidenceHandle, status: statusValue });
  } catch (_e) {
    return { ok: false, reason: 'properties_serialize_failed' };
  }

  // Write the event node via the shared NOT-NULL-safe chokepoint. review_status is
  // left to the column DEFAULT ('proposed') -- a ContradictionEvent is never
  // auto-confirmed (Canon Part 9), mirroring writeEntityNode exactly. No
  // review_status arg is passed, so it is born 'proposed' and stays there until a
  // human confirmNode promotes it.
  try {
    insertNode(db, eventId, 'ContradictionEvent', propsJson, {
      source_path: 'reified-claim:contradiction:' + eventId,
      created_by: 'system',
      // R17-02: 'observation' -- a system-bookkeeping audit event (the fact
      // that a contradiction was detected), same class as memory_event.
      epistemic_type: 'observation',
    });
  } catch (e) {
    return { ok: false, reason: 'event_write_failed', detail: String(e.message || '').slice(0, 80) };
  }

  // Write exactly two edges through writeEdge (the chokepoint, never a raw INSERT
  // INTO edges). Non-transactional two-step discipline, mirroring the
  // writeEntityNode + linkEntityRelations pair. Fail closed: if either edge write
  // returns ok:false, stop and surface it immediately.
  const concernsResult = writeEdge(db, {
    source_id: eventId,
    target_id: claim,
    edge_type: 'CONCERNS',
    properties: { relation: 'concerns', event: eventId },
  });
  if (!concernsResult || !concernsResult.ok) {
    return {
      ok: false,
      reason: 'edge_write_failed',
      node_id: eventId,
      detail: 'CONCERNS:' + ((concernsResult && concernsResult.reason) ? concernsResult.reason : 'unknown'),
    };
  }
  const contradictsResult = writeEdge(db, {
    source_id: eventId,
    target_id: rivalClaim,
    edge_type: 'CONTRADICTS',
    properties: { relation: 'contradicts', event: eventId },
  });
  if (!contradictsResult || !contradictsResult.ok) {
    return {
      ok: false,
      reason: 'edge_write_failed',
      node_id: eventId,
      detail: 'CONTRADICTS:' + ((contradictsResult && contradictsResult.reason) ? contradictsResult.reason : 'unknown'),
    };
  }

  return {
    ok: true,
    node_id: eventId,
    event_type: 'ContradictionEvent',
    edges: [
      { edge: 'CONCERNS', source: eventId, target: claim },
      { edge: 'CONTRADICTS', source: eventId, target: rivalClaim },
    ],
  };
}

module.exports = {
  writeContradictionEvent,
  REIFIED_CLAIM_EVENT_ID,
  REIFIED_EVENT_TYPES,
  PARTICIPANT_NODE_TYPE,
  REIFIED_STATUS_VALUES,
};
