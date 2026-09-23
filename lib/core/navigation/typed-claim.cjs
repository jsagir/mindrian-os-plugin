'use strict';
/*
 * Phase 150.8-01 -- typed-claim: the truth-claim node-write chokepoint for the
 * meeting micro-knowledge DIKW ladder. This is the net-new `claim`-type writer
 * the entire DIKW slice stands on (DIKW-01 / DIKW-03): the Claimify-style 4-pass
 * extraction in the /mos:file-meeting path (Plan 03) calls writeClaimNode per
 * ATOMIC claim, so a transcript that decomposes into K segments mints K claim
 * nodes (the GATE-0 segmentation-authority consequence: extraction drives
 * segmentation, the file-level cascade never fans out per segment).
 *
 * This module is an allow-listed navigation submodule (scripts/check-substrate.cjs
 * regex /^lib\/core\/navigation\// covers it). It takes a db handle owned by the
 * caller (via lib/core/room-db.cjs openRoomDb) EXACTLY like
 * lib/core/navigation/evidence-claim.cjs writeEvidenceClaim and edges.cjs
 * writeEdge: it NEVER requires node:sqlite and NEVER opens room.db itself, so it
 * stays inside the navigation allow-list with zero substrate bypass. Hook-level
 * event logging stays with the CALLER via navigation.logMemoryEvent -- this
 * writer mints the node and nothing else.
 *
 * Canon Part 9 role 5 (the human gate): a claim is a TRUTH-CLAIM node in the
 *   closed set {claim, CausalClaim, assumption, decision, opportunity} -- it
 *   asserts something about the venture's world. So it lands review_status
 *   'proposed' and is NEVER auto-confirmed by an agent. Promotion to 'confirmed'
 *   requires a human APPROVE at a Decision Gate (routed through
 *   navigation.confirmNode in Plan 04). This is NOT carved out by the Part 9 v1.5
 *   audit-node carve-out -- it is a real truth claim, not system bookkeeping.
 *
 * Canon Part 8: zero network surface. Pure LOCAL SQLite over a caller-owned
 *   handle. No Brain calls; no transcript content ever leaves the room. Only the
 *   knowledge_type enum handle may ride to Brain downstream; the prose stays local.
 *
 * Schema discipline (the D-10 additive-JSON precedent, mirroring
 *   evidence-claim.cjs:90-100): knowledge_type, text, conditions,
 *   counter_conditions, valid_from, valid_until, source_speaker, source_segment,
 *   and the optional AMB-01 disambiguation marker are ALL additive keys inside the
 *   properties TEXT blob -- NEVER DDL columns. The `text` key is the atomic claim
 *   sentence itself: it is validated as mandatory (invalid_text below) and is
 *   persisted here so the read side (the tri-modal index props.text check) can
 *   extract the claim's content. review_status is the ONLY CHECK-constrained column
 *   (lib/core/migrations/phase-109-nodes-provenance.cjs); knowledge_type stays
 *   OUT of DDL. Zero ALTER TABLE, zero new migration file.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const { insertNode } = require('../node-insert.cjs');

// The closed 6-member knowledge-type enum (CONTEXT in-scope item 1; the DIKW
// taxonomy fact|causal|heuristic|anomaly_cue|mental_model|assumption). A claim's
// knowledge_type MUST validate against this Set; writeClaimNode rejects
// invalid_knowledge_type otherwise. Mirrors the EVIDENCE_TIERS frozen-Set idiom
// in evidence-claim.cjs:48.
const KNOWLEDGE_TYPES = Object.freeze(new Set([
  'fact', 'causal', 'heuristic', 'anomaly_cue', 'mental_model', 'assumption',
]));

// Plan 276-12 (TOOLHON-07), OQ-276-1 ANSWER (b+d, .planning/phases/276-*/
// 276-DECISIONS.md, ratified commit 26083bac): "map at the claim writer,
// cap-comparison deferred". This table replaces the pre-276-12 hardcoded
// `epistemic_type: 'extracted_fact'` constant that used to collapse all 6
// KNOWLEDGE_TYPES members onto ONE node-insert.cjs epistemic_type -- see
// writeClaimNode below. Placement here (next to KNOWLEDGE_TYPES, not inside
// node-insert.cjs's generic fail-closed gate) honors node-insert.cjs:110-112's
// own comment that per-writer mapping belongs at the call site.
//
// STATUS: the table's ROW CONTENT is executor-proposed (276-DECISIONS.md
// marks it "PROPOSED, not navigator-ratified" -- only the placement and the
// single-direction scope are ratified). Every value is a member of
// node-insert.cjs's ALLOWED_EPISTEMIC_TYPES; the operator-cap comparison
// against lib/conversation/operator.cjs's EPISTEMIC_LEVELS is a NAMED
// follow-up owned by plan 276-16's close-out, not built here.
const KNOWLEDGE_TYPE_TO_EPISTEMIC_TYPE = Object.freeze({
  fact: 'extracted_fact',
  causal: 'derived_fact',
  heuristic: 'interpretation',
  anomaly_cue: 'observation',
  mental_model: 'model_derived_assertion',
  assumption: 'assumption',
});

// Phase 223-02 (Req 4): the props keys writeClaimNode OWNS. An optional
// extraProps bag (the conclusion marker kind/topic/topic_hash + the G-1
// provenance tag pipeline/run_id) may merge additive keys into the props blob,
// but it may NEVER override these fixed provenance keys -- exactly the
// typed-opportunity.cjs protected-key discipline. knowledge_type + text are the
// validated truth-claim identity; overriding them through a side bag would let a
// caller mislabel a claim. review_status / type are never props keys at all, so
// they can never be reached through extraProps either.
//
// Phase 358-02 (Rome B1, navigator ruling 2026-09-23): 'verification' joined
// this list. The B1 checking record is owned by
// lib/core/navigation/verification.cjs, whose recordClaimVerification is its
// only writer; an extraProps bag can never write, replace or forge it.
const PROTECTED_CLAIM_KEYS = Object.freeze([
  'knowledge_type', 'text', 'conditions', 'counter_conditions',
  'valid_from', 'valid_until', 'source_speaker', 'source_segment', 'disambiguation',
  'verification',
]);

// Phase 358-02 (B1-03, the verification-wipe fix): the props keys a re-file
// must carry forward from the existing row because a DIFFERENT writer owns
// them. An explicit named list, deliberately NOT "preserve every old key",
// so no other writer's semantics change by accident.
const CARRY_FORWARD_CLAIM_KEYS = Object.freeze(['verification']);

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// CLAIM_NODE_ID(sessionId, segmentKey) -- the idempotent id-minter. A crypto-free,
// dependency-free stable 31-multiplier hash over the segment key (mirrors
// evidence-claim.cjs:110-117) keeps re-filing the same segment in the same
// session an UPSERT, not a duplicate. Node id 'claim:'+sid+':'+hash.
function CLAIM_NODE_ID(sessionId, segmentKey) {
  const sid = typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : 'nosession';
  const key = typeof segmentKey === 'string' && segmentKey.length > 0 ? segmentKey : 'noseg';
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return 'claim:' + sid + ':' + hash.toString(16);
}

// writeClaimNode(db, params) -- UPSERT a typed truth-claim node.
//
// params = { knowledge_type, text, sessionId, sourceSegment?, sourceSpeaker?,
//   conditions?, counter_conditions?, valid_from?, valid_until?, disambiguation? }.
// type 'claim', created_by 'system', review_status 'proposed' (NEVER confirmed --
// Canon Part 9 role 5). The DO UPDATE SET clause EXCLUDES review_status so a
// human-confirmed claim re-projected by the extraction stays confirmed
// (no-downgrade, copied verbatim from memory-artifacts.cjs writeDecisionNode).
// Phase 358-02 (B1-03): a re-file carries CARRY_FORWARD_CLAIM_KEYS forward
// from the existing row (Phase 358 B1, the verification-wipe fix).
// Defensive: never throws on caller input; returns { ok:false, reason } on failure.
function writeClaimNode(db, params) {
  if (!isPlainObject(params)) {
    return { ok: false, reason: 'invalid_params' };
  }
  const {
    knowledge_type, text, sessionId, sourceSegment, sourceSpeaker,
    conditions, counter_conditions, valid_from, valid_until, disambiguation,
    extraProps,
  } = params;
  if (typeof knowledge_type !== 'string' || !KNOWLEDGE_TYPES.has(knowledge_type)) {
    return { ok: false, reason: 'invalid_knowledge_type', detail: String(knowledge_type).slice(0, 40) };
  }
  if (typeof text !== 'string' || text.length === 0) {
    return { ok: false, reason: 'invalid_text' };
  }
  // Additive JSON props ONLY (the D-10 precedent). Every temporal + provenance
  // field defaults to '' so the shape is stable; knowledge_type rides the same
  // blob, never a column.
  const props = {
    knowledge_type: knowledge_type,
    text: text,
    conditions: typeof conditions === 'string' ? conditions : '',
    counter_conditions: typeof counter_conditions === 'string' ? counter_conditions : '',
    // Phase 348 (SUPER-10 / D-06): display-only. Nothing determines a claim's
    // truth-state or closes it based on these two strings. The AUTHORITATIVE
    // validity window is the integer column pair nodes.valid_from /
    // nodes.valid_to (plus nodes.invalidated_at), added by
    // lib/core/migrations/phase-160-nodes-bitemporal.cjs, because those are
    // what the shipped readers actually read: lib/core/temporal/
    // supersession.cjs closes A.valid_to against B.valid_from THE COLUMN, and
    // lib/core/temporal/point-in-time.cjs::queryAsOf answers as-of questions
    // from the same columns. Two mismatches a reader will otherwise trip
    // over, layered on top of each other: the props pair here is named
    // valid_from / valid_UNTIL while the column pair is named valid_from /
    // valid_TO, and these props are STRINGS while the columns are INTEGERS.
    // The consequence, stated plainly rather than left implied: a
    // meeting-stated expiry captured here does NOT close a claim today, and
    // will not until a future phase gives it a consumer -- writing it here
    // is capture, not enforcement.
    //
    // One heuristic exception exists, named here rather than hidden:
    // lib/core/leverage-scan.cjs's Meadows Level-9 ("Delays") signature
    // checks only WHETHER these two keys are non-null
    // (json_extract(properties, '$.valid_from'/'$.valid_until') IS NOT NULL)
    // as a leverage-scoring nudge. It never reads their VALUE and never
    // closes or truth-gates a claim from them, so it does not compete with
    // the columns above as an authority and does not change this ruling.
    //
    // No third representation is added. If a future phase wants a stated
    // expiry to take effect, it PARSES these strings into the existing
    // columns at write time; it does not mint a fifth field name. That
    // reverse path is WD-348-2 in docs/SUPERSESSION-CONTRACT.md.
    valid_from: typeof valid_from === 'string' ? valid_from : '',
    valid_until: typeof valid_until === 'string' ? valid_until : '',
    source_speaker: typeof sourceSpeaker === 'string' ? sourceSpeaker : '',
    source_segment: typeof sourceSegment === 'string' ? sourceSegment : '',
  };
  // AMB-01: the disambiguation marker is a PURELY ADDITIVE optional key consumed
  // by the Plan 03 ambiguous-queue (disambiguation:'ambiguous'). It is NOT a new
  // review_status member (the closed status set has no 'ambiguous'). Set only
  // when the caller supplies a non-empty string, so the shape is byte-identical
  // when absent.
  if (typeof disambiguation === 'string' && disambiguation.length > 0) {
    props.disambiguation = disambiguation;
  }
  // Phase 223-02 (Req 4): the OPTIONAL additive extraProps bag. The protected-key
  // filter runs BEFORE the merge, so an extraProps bag can carry the conclusion
  // marker (kind/topic/topic_hash) and the G-1 provenance tag (pipeline/run_id)
  // WITHOUT overriding knowledge_type / text / any fixed provenance key and
  // WITHOUT a new node type or schema change. A non-plain-object bag is ignored,
  // and when extraProps is ABSENT the props shape is byte-identical to the
  // pre-223 writer -- every existing caller is unaffected.
  if (isPlainObject(extraProps)) {
    for (const k of Object.keys(extraProps)) {
      if (PROTECTED_CLAIM_KEYS.indexOf(k) === -1) props[k] = extraProps[k];
    }
  }
  // Idempotency key off the segment (or the claim text when no segment id is
  // supplied) so re-filing the same atomic claim UPSERTs rather than duplicating.
  // Computed here, ABOVE the properties serialization below, so the
  // carry-forward prior-row read (which needs nodeId) can run before props
  // is turned into JSON.
  const sid = typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : 'nosession';
  const segmentKey = (typeof sourceSegment === 'string' && sourceSegment.length > 0) ? sourceSegment : text;
  const nodeId = CLAIM_NODE_ID(sid, segmentKey);
  const sourcePath = 'meeting:' + sid + ':' + (typeof sourceSegment === 'string' ? sourceSegment : 'inline');

  // Phase 358-02 (B1-03, T-358-09/T-358-10): CR-01, node:sqlite's
  // DatabaseSync has no nested-transaction support (same ownership idiom as
  // lib/core/navigation/ranker-weights.cjs and
  // lib/core/navigation/verification.cjs). A caller who already opened a
  // transaction on this handle owns COMMIT/ROLLBACK; this function only
  // opens/closes ITS OWN transaction when none is already open. A failed
  // BEGIN (for example SQLITE_BUSY) never blocks the write itself -- it
  // falls back to running without a transaction rather than refusing the
  // claim (never block a claim write on the lock idiom).
  let owns = db.isTransaction !== true;
  if (owns) {
    try {
      db.exec('BEGIN IMMEDIATE');
    } catch (_e) {
      owns = false;
    }
  }
  try {
    // Carry the existing row's CARRY_FORWARD_CLAIM_KEYS forward. This runs
    // AFTER the protected extraProps merge above, so the stored record
    // always wins over anything an extraProps bag tried to smuggle in under
    // the same key. A read or parse failure here (T-358-10, a malformed
    // prior properties blob) is swallowed: a carry-forward read never
    // blocks the claim write.
    try {
      const prior = db.prepare('SELECT properties FROM nodes WHERE id = ?').get(nodeId);
      const priorProps = prior && typeof prior.properties === 'string' ? JSON.parse(prior.properties) : null;
      if (isPlainObject(priorProps)) {
        for (const k of CARRY_FORWARD_CLAIM_KEYS) {
          if (isPlainObject(priorProps[k])) props[k] = priorProps[k];
        }
      }
    } catch (_e) {
      // Never block the claim write on a carry-forward read failure.
    }

    let propsJson;
    try {
      propsJson = JSON.stringify(props);
    } catch (_e) {
      if (owns) db.exec('ROLLBACK');
      return { ok: false, reason: 'properties_serialize_failed' };
    }

    // review_status='proposed' on INSERT (TRUTH-CLAIM: never auto-confirmed).
    // insertNode's DO UPDATE clause never touches review_status or confidence,
    // so a human-confirmed claim re-projected by the system stays confirmed
    // (no downgrade). That no-downgrade guarantee now lives inside insertNode.
    insertNode(db, nodeId, 'claim', propsJson, {
      source_path: sourcePath,
      created_by: 'system',
      confidence: 1.0,
      review_status: 'proposed',
      // Plan 276-12 (TOOLHON-07), OQ-276-1: per-knowledge_type mapping via
      // KNOWLEDGE_TYPE_TO_EPISTEMIC_TYPE above, replacing the pre-276-12
      // hardcoded 'extracted_fact' constant (R17-02, Task 4 Decision 4) that
      // collapsed all 6 KNOWLEDGE_TYPES onto one epistemic_type. Always a
      // hit: knowledge_type already validated against KNOWLEDGE_TYPES above,
      // and every KNOWLEDGE_TYPES member has a row in the mapping table.
      epistemic_type: KNOWLEDGE_TYPE_TO_EPISTEMIC_TYPE[knowledge_type],
    });
    if (owns) db.exec('COMMIT');
  } catch (e) {
    if (owns) db.exec('ROLLBACK');
    return { ok: false, reason: 'claim_write_failed', detail: String(e.message || '').slice(0, 80) };
  }
  return { ok: true, node_id: nodeId, knowledge_type: knowledge_type };
}

module.exports = {
  writeClaimNode, KNOWLEDGE_TYPES, CLAIM_NODE_ID, PROTECTED_CLAIM_KEYS,
  CARRY_FORWARD_CLAIM_KEYS, KNOWLEDGE_TYPE_TO_EPISTEMIC_TYPE,
};
