'use strict';
/*
 * Phase 164-02 -- synthetic-expert: the writeSyntheticExpertNode node-write
 * chokepoint (E1 / D-164-S1). This is the WAVE 2 writer that mints the
 * SyntheticExpert reusable-expert graph citizen the Wave-1 amendment froze into
 * the node taxonomy (TRUTH_CLAIM_TYPES + aliases.yml + the promoteNodeStatus
 * human-confirm gate). A high-value BONO team member, FILED from the
 * room/team/personas .md files and promoted to a queryable node, re-invokable as
 * a hat in future runs (164-SYNTHETIC-EXPERTS.md section 2).
 *
 * This module mirrors lib/core/navigation/typed-domain.cjs writeDomainNode
 * VERBATIM in structure: the allow-list header note, the isPlainObject helper,
 * the stable 31-multiplier hash id-minter, the additive-JSON-props discipline
 * (the D-10 precedent), and the defensive never-throw contract. It is an
 * allow-listed navigation submodule. It takes a db handle owned by the caller
 * (via lib/core/room-db.cjs openRoomDb) EXACTLY like typed-domain.cjs /
 * edges.cjs writeEdge: it NEVER requires node:sqlite and NEVER opens room.db
 * itself, so it stays inside the navigation allow-list with zero substrate bypass.
 *
 * Canon Part 9 (the human gate, role 5): a SyntheticExpert is a TRUTH-CLAIM node
 *   (it asserts which lens is worth keeping; the navigator decides). The writer
 *   lands it at review_status 'proposed' (the column DEFAULT) and NEVER
 *   auto-confirms it. Promotion to 'confirmed' rides the existing human
 *   confirmNode(byUser) door; the Wave-1 TRUTH_CLAIM_TYPES extension makes the
 *   promoteNodeStatus guard reject an agent-attributed confirm for free.
 *
 * Canon Part 8 (the generic-lens-only gate, the load-bearing constraint): the
 *   frozen SYNTHETIC_EXPERT_FIELDS allow-list rejects ANY params key outside the
 *   generic-lens set (forbidden_field) BEFORE any insert. The props bag carries
 *   ONLY generic-lens metadata (hat / name / surname / archetype /
 *   beautiful_question / research_approach / evidence_tier / invocation_count /
 *   last_used / provenance). provenance carries the originating runId + domain
 *   node ids as scalars/ids ONLY, NEVER venture prose. No venture body ever rides
 *   the props. Zero network surface; pure LOCAL SQLite over a caller-owned handle.
 *
 * Canon Part 2: hat / name / surname / archetype IS the canonical team-member
 *   identity (de Bono cognitive stance + main domain + sub-domain + 7-role lens).
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const { insertNode } = require('../node-insert.cjs');

// The closed de Bono hat-color Set (Canon Part 2 team identity). A SyntheticExpert
// hat MUST validate against this Set; writeSyntheticExpertNode rejects invalid_hat
// otherwise. Mirrors the DOMAIN_NODE_TYPES frozen-Set idiom in typed-domain.cjs.
const HAT_COLORS = Object.freeze(new Set([
  'White', 'Red', 'Black', 'Yellow', 'Green', 'Blue',
]));

// The frozen generic-lens allow-list (164-SYNTHETIC-EXPERTS.md section 2 table).
// This is the Part 8 gate: a params key outside this union is rejected
// forbidden_field BEFORE any insert, so no venture body ever rides the props.
// The camelCase caller keys map to the snake_case props bag below; the input
// allow-list carries BOTH the camelCase input keys and the structural keys
// (sessionId for the id-minter) so a caller bag is validated exactly.
const SYNTHETIC_EXPERT_FIELDS = Object.freeze(new Set([
  'hat', 'name', 'surname', 'archetype', 'beautifulQuestion', 'researchApproach',
  'evidenceTier', 'invocationCount', 'lastUsed', 'provenance', 'sessionId',
]));

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// SYNTHETIC_EXPERT_NODE_ID(sessionId, hat, surname) -- the idempotent id-minter.
// A crypto-free, dependency-free stable 31-multiplier hash over (hat + ':' +
// surname) (mirrors DOMAIN_NODE_ID at typed-domain.cjs:75-83) keeps re-writing
// the same (hat, surname, sessionId) an UPSERT, not a duplicate. Node id
// 'expert:'+sid+':'+hash.
function SYNTHETIC_EXPERT_NODE_ID(sessionId, hat, surname) {
  const sid = typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : 'nosession';
  const h = typeof hat === 'string' && hat.length > 0 ? hat : 'nohat';
  const s = typeof surname === 'string' && surname.length > 0 ? surname : 'nosurname';
  const key = h + ':' + s;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return 'expert:' + sid + ':' + hash.toString(16);
}

// writeSyntheticExpertNode(db, params) -- UPSERT a SyntheticExpert truth-claim node.
//
// params = { hat, name, surname, archetype?, beautifulQuestion?, researchApproach?,
//   evidenceTier?, invocationCount?, lastUsed?, provenance?, sessionId? }.
// type = 'SyntheticExpert', created_by 'system'. review_status lands 'proposed' by
// the column DEFAULT and is NEVER promoted here (Part 9 role 5: a SyntheticExpert
// is a truth-claim node; the human promotes via confirmNode(byUser)).
//
// The Part 8 generic-lens gate: ANY params key not in SYNTHETIC_EXPERT_FIELDS is
// rejected forbidden_field BEFORE any insert. Properties bag is ADDITIVE JSON
// only, snake_cased to the 164-SYNTHETIC-EXPERTS.md table keys; provenance carries
// scalars/ids ONLY (never prose). Defensive: never throws on caller input; returns
// { ok:false, reason }.
function writeSyntheticExpertNode(db, params) {
  if (!isPlainObject(params)) {
    return { ok: false, reason: 'invalid_params' };
  }
  // Part 8 generic-lens gate FIRST: reject any non-allow-listed key before any
  // validation or write, so a venture-body field never even reaches the insert.
  for (const key of Object.keys(params)) {
    if (!SYNTHETIC_EXPERT_FIELDS.has(key)) {
      return { ok: false, reason: 'forbidden_field', detail: String(key).slice(0, 40) };
    }
  }
  const {
    hat, name, surname, archetype, beautifulQuestion, researchApproach,
    evidenceTier, invocationCount, lastUsed, provenance, sessionId,
  } = params;
  if (typeof hat !== 'string' || !HAT_COLORS.has(hat)) {
    return { ok: false, reason: 'invalid_hat', detail: String(hat).slice(0, 40) };
  }
  if (typeof name !== 'string' || name.length === 0) {
    return { ok: false, reason: 'invalid_name' };
  }
  if (typeof surname !== 'string' || surname.length === 0) {
    return { ok: false, reason: 'invalid_surname' };
  }
  const sid = typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : 'nosession';
  // Provenance is scalars/ids ONLY (Part 8). Defensively coerce to the documented
  // shape: a runId string + a domainNodeIds id-array; any prose-bearing extra key
  // is dropped here (the props bag below copies ONLY these two fields).
  const provIn = isPlainObject(provenance) ? provenance : {};
  const prov = {
    runId: typeof provIn.runId === 'string' ? provIn.runId : '',
    domainNodeIds: Array.isArray(provIn.domainNodeIds)
      ? provIn.domainNodeIds.filter((x) => typeof x === 'string')
      : [],
  };
  // Additive JSON props ONLY (the D-10 precedent), snake_cased to the
  // 164-SYNTHETIC-EXPERTS.md table. Defaults so the shape stays stable.
  const props = {
    hat: hat,
    name: name,
    surname: surname,
    archetype: typeof archetype === 'string' ? archetype : '',
    beautiful_question: typeof beautifulQuestion === 'string' ? beautifulQuestion : '',
    research_approach: typeof researchApproach === 'string' ? researchApproach : '',
    evidence_tier: typeof evidenceTier === 'string' ? evidenceTier : 'None',
    invocation_count: Number.isFinite(invocationCount) ? invocationCount : 0,
    last_used: Number.isFinite(lastUsed) ? lastUsed : 0,
    provenance: prov,
  };
  let propsJson;
  try {
    propsJson = JSON.stringify(props);
  } catch (_e) {
    return { ok: false, reason: 'properties_serialize_failed' };
  }
  const nodeId = SYNTHETIC_EXPERT_NODE_ID(sid, hat, surname);
  const sourcePath = 'expert:' + sid + ':' + hat + ':' + surname;
  try {
    // Mint via the shared NOT-NULL-safe chokepoint (lands review_status DEFAULT
    // 'proposed'). created_by='system' satisfies the Phase-109 CHECK; the writer
    // NEVER promotes (Part 9 role 5: the human confirms via confirmNode).
    insertNode(db, nodeId, 'SyntheticExpert', propsJson, {
      source_path: sourcePath,
      created_by: 'system',
      // R17-02: 'extracted_fact' -- a SyntheticExpert is filed from real
      // room/team/personas .md content, same "extracted from source" class
      // as typed-entity.cjs. SyntheticExpert is a TRUTH_CLAIM_TYPES member
      // (transitions.cjs), so it requires human confirmNode promotion.
      epistemic_type: 'extracted_fact',
    });
  } catch (e) {
    return { ok: false, reason: 'expert_write_failed', detail: String(e.message || '').slice(0, 80) };
  }
  return { ok: true, node_id: nodeId, hat: hat };
}

module.exports = {
  writeSyntheticExpertNode,
  SYNTHETIC_EXPERT_FIELDS,
  HAT_COLORS,
  SYNTHETIC_EXPERT_NODE_ID,
};
