'use strict';
/*
 * Phase 219-01 -- typed-opportunity: the opportunity node write chokepoint +
 * the D-17 stage machine + the evidence edge-linker. This is the WAVE 1 REQ-1
 * slice: guard-cleared eureka opportunity statements gain graph presence as
 * typed `opportunity` nodes through the navigation.cjs chokepoint, so the
 * harvest sensor (Plan 03) and qualification card (Plan 04) have a substrate.
 *
 * This module is a SIBLING clone of lib/core/navigation/typed-entity.cjs (the
 * key 219-RESEARCH finding 2: do NOT add 'opportunity' to ENTITY_NODE_TYPES;
 * mint the sibling writer). It mirrors typed-entity.cjs VERBATIM in structure:
 * the isPlainObject helper, the stable 31-multiplier hash id-minter, the
 * additive-JSON-props discipline (the 218 D-10 precedent), and the defensive
 * never-throw contract. It is an allow-listed navigation submodule; it takes a
 * db handle owned by the caller (via lib/core/room-db.cjs openRoomDb) and
 * NEVER requires node:sqlite / room-db.cjs itself.
 *
 * DO NOT USE lib/core/graph-ops.cjs indexOpportunity for governed opportunity
 * writes: it is a LEGACY raw-insert path that BYPASSES the navigation
 * chokepoint (a Canon Part 9 violation for truth-claim writes). It stays for
 * its legacy callers only; every Phase 219+ opportunity write routes here.
 *
 * D-03 (locked): opportunity candidates mint as a typed node (kind
 *   'opportunity') with review_status='proposed' and a `lifecycle` property
 *   (candidate|qualified|explored|promoted|parked|retired), through
 *   navigation.cjs only. lifecycle rides the additive JSON props bag, NEVER a
 *   DDL column (218 D-10 precedent).
 *
 * D-04 (locked): edge vocabulary reuse-first. The evidence subset is exactly
 *   {DERIVED_FROM, SUPPORTS, INFORMS} - all existing ALLOWED_EDGE_TYPES
 *   members, ZERO net-new edge types this phase. EVIDENCES is NOT in
 *   ALLOWED_EDGE_TYPES (it appears only in a READ query at insights.cjs:192);
 *   DERIVED_FROM is the Brain answer's named provenance edge and already the
 *   Breakthrough->Artifact edge. Rejection edges (REJECTED_BECAUSE) are
 *   written by Plan 04 via navigation.writeEdge directly, not through this
 *   helper.
 *
 * D-17 (locked): stage-vs-outcome separation. Props carry artifact_status
 *   (filed|banked), opportunity_stage (banked|explored), opportunity_outcome
 *   (open|deferred|rejected|archived) AND an APPEND-ONLY stage_history[] of
 *   entries {from,to,at,actor,reason,evidence_ids,formula_version} written on
 *   EVERY transition. State is never overwritten - supersede/append, never
 *   delete. lifecycle stays the human-readable current-state summary (D-03).
 *   The props-merge UPSERT preserves and appends to stage_history; the bare
 *   new-value overwrite is the exact forbidden pattern (test-pinned).
 *
 * Canon Part 9 (the human gate, NO carve-out here): an opportunity node is a
 *   PURE TRUTH-CLAIM. It ALWAYS lands review_status 'proposed' (the column
 *   DEFAULT - no review_status arg is ever passed) and is NEVER auto-confirmed
 *   by this writer (Part 9 role 5). Promotion to 'confirmed' requires a human
 *   APPROVE at a Decision Gate (navigation.confirmNode - the Plan 04 Qualify
 *   verb). There is deliberately NO confirm path in this module.
 *
 * Canon Part 8: zero network surface. Pure LOCAL SQLite over a caller-owned
 *   handle. Props are JSON-serialized scalars/arrays only; a serialize failure
 *   returns { ok:false }, never throws (the typed-entity idiom).
 *
 * props.section (the 216 field contract, test-216-field-contract.cjs
 *   precedent): banked nodes carry props.section derived from their evidence
 *   nodes' props.section or source_path - a real domain slug or the honest
 *   'unknown', NEVER the ICM node type column. The derivation lives with the
 *   caller (the banking pass); this writer carries the value verbatim and
 *   defaults it to 'unknown'.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const { insertNode, ALLOWED_EPISTEMIC_TYPES } = require('../node-insert.cjs');

// R17-02: the 'opportunity' truth-claim's default epistemic_type (Canon Part
// 9 role-5 truth-claim set includes 'opportunity'; not in Task 4's named
// per-writer table, judgment call: 'recommendation' fits an identified-but-
// unvalidated business opportunity better than the system-bookkeeping
// 'observation' bucket the other untabled writers use).
const OPPORTUNITY_DEFAULT_EPISTEMIC_TYPE = 'recommendation';
const { writeEdge } = require('./edges.cjs');

// The closed D-03 lifecycle enum. The human-readable current-state summary;
// transitions route through advanceOpportunityStage (axis 'lifecycle') so the
// D-17 stage_history records every move.
const OPPORTUNITY_LIFECYCLES = Object.freeze(new Set([
  'candidate', 'qualified', 'explored', 'promoted', 'parked', 'retired',
]));

// The closed D-17 axis enums. artifact_status is the backward-compatible
// filed-vs-banked flag (opportunity-ops.cjs funding-subsystem precedent);
// opportunity_stage and opportunity_outcome are the durable state axes.
const OPPORTUNITY_ARTIFACT_STATUSES = Object.freeze(new Set(['filed', 'banked']));
const OPPORTUNITY_STAGES = Object.freeze(new Set(['banked', 'explored']));
const OPPORTUNITY_OUTCOMES = Object.freeze(new Set(['open', 'deferred', 'rejected', 'archived']));

// The closed D-04 evidence-edge subset (a frozen subset of ALLOWED_EDGE_TYPES,
// mirroring typed-entity.cjs ENTITY_EDGE_SUBSET). Reuse-first: all three are
// existing members; zero net-new edge types this phase. linkOpportunityEvidence
// rejects anything else BEFORE delegating to writeEdge (which re-validates
// against the full frozen Set downstream).
const OPPORTUNITY_EVIDENCE_EDGE_SUBSET = Object.freeze(new Set([
  'DERIVED_FROM', 'SUPPORTS', 'INFORMS',
]));

// The three transition axes advanceOpportunityStage accepts, mapped to their
// props field. 'lifecycle' is the D-03 summary; 'stage'/'outcome' are the D-17
// durable axes. Every axis transition appends the SAME stage_history entry
// shape, so the history is one ordered ledger across all three axes.
const AXIS_FIELDS = Object.freeze({
  lifecycle: 'lifecycle',
  stage: 'opportunity_stage',
  outcome: 'opportunity_outcome',
});
const AXIS_ENUMS = Object.freeze({
  lifecycle: OPPORTUNITY_LIFECYCLES,
  stage: OPPORTUNITY_STAGES,
  outcome: OPPORTUNITY_OUTCOMES,
});

// The state keys advanceOpportunityStage owns. writeOpportunityNode's merge
// UPSERT NEVER lets a re-write (or an extraProps bag) touch these on an
// existing node: a transition that bypasses the history append would be the
// exact D-17 forbidden pattern.
const STATE_KEYS = Object.freeze([
  'lifecycle', 'artifact_status', 'opportunity_stage', 'opportunity_outcome', 'stage_history',
]);

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// OPPORTUNITY_NODE_ID(sessionId, name) -- the idempotent id-minter. The same
// crypto-free, dependency-free stable 31-multiplier hash over the name as
// typed-entity.cjs ENTITY_NODE_ID (:84-92): re-writing the same
// (sessionId, name) is an UPSERT, not a duplicate. Node id
// 'opportunity:'+sid+':'+hash.
function OPPORTUNITY_NODE_ID(sessionId, name) {
  const sid = typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : 'nosession';
  const key = typeof name === 'string' && name.length > 0 ? name : 'noname';
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return 'opportunity:' + sid + ':' + hash.toString(16);
}

// Build one D-17 stage_history entry. The shape is EXACTLY
// {from,to,at,actor,reason,evidence_ids,formula_version} - test-pinned; no
// extra keys, no missing keys.
function historyEntry(from, to, actor, reason, evidenceIds, formulaVersion) {
  return {
    from: (typeof from === 'string' && from.length > 0) ? from : null,
    to: to,
    at: new Date().toISOString(),
    actor: (typeof actor === 'string' && actor.length > 0) ? actor : 'system',
    reason: (typeof reason === 'string') ? reason : '',
    evidence_ids: Array.isArray(evidenceIds) ? evidenceIds : [],
    formula_version: (typeof formulaVersion === 'string' && formulaVersion.length > 0)
      ? formulaVersion : 'unversioned',
  };
}

// Read + parse an existing node's props. Returns { found, props, row } and
// NEVER throws; an unparseable props blob returns { found:true, props:null }
// so the caller can refuse (dropping history on a corrupt blob would violate
// D-17's never-delete rule).
function readNodeProps(db, nodeId) {
  let row = null;
  try {
    row = db.prepare('SELECT type, properties FROM nodes WHERE id = ?').get(nodeId);
  } catch (_e) {
    return { found: false, props: null, row: null };
  }
  if (!row) return { found: false, props: null, row: null };
  let props = null;
  try {
    const parsed = JSON.parse(row.properties || '{}');
    if (isPlainObject(parsed)) props = parsed;
  } catch (_e) {
    props = null;
  }
  return { found: true, props: props, row: row };
}

// writeOpportunityNode(db, params) -- UPSERT a typed 'opportunity' node.
//
// params = { name, sessionId, lifecycle?, lens?, jtbd?, score?, section?,
//            extraProps?, actor?, reason?, evidence_ids?, formula_version? }.
// Returns { ok:true, node_id } or { ok:false, reason } - never throws.
//
// Node kind is 'opportunity'; created_by 'system'; review_status is NEVER
// passed (the column DEFAULT 'proposed' lands - Part 9 role 5, no confirm
// path). lifecycle defaults 'candidate' and must be an OPPORTUNITY_LIFECYCLES
// member. Minting writes the initial stage_history entry {from:null,
// to:lifecycle, at, actor, reason, evidence_ids, formula_version} plus the
// D-17 axis defaults (artifact_status 'banked', opportunity_stage 'banked',
// opportunity_outcome 'open').
//
// Idempotent UPSERT keyed on OPPORTUNITY_NODE_ID(sessionId, name): re-writing
// the same (sessionId, name) MERGES props (new non-state scalars win), it does
// not duplicate - and it PRESERVES the five state keys (lifecycle, the D-17
// axes, stage_history) verbatim. State transitions on an existing node go
// through advanceOpportunityStage ONLY, so every move lands in the append-only
// history.
function writeOpportunityNode(db, params) {
  if (!isPlainObject(params)) {
    return { ok: false, reason: 'invalid_params' };
  }
  const {
    name, sessionId, lifecycle, lens, jtbd, score, section, extraProps,
    actor, reason, evidence_ids, formula_version,
  } = params;
  if (typeof name !== 'string' || name.length === 0) {
    return { ok: false, reason: 'invalid_name' };
  }
  const life = (lifecycle === undefined || lifecycle === null) ? 'candidate' : lifecycle;
  if (typeof life !== 'string' || !OPPORTUNITY_LIFECYCLES.has(life)) {
    return { ok: false, reason: 'invalid_lifecycle', detail: String(life).slice(0, 40) };
  }
  const sid = typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : 'nosession';
  const nodeId = OPPORTUNITY_NODE_ID(sid, name);

  // The incoming non-state props bag. extraProps merges first so the canonical
  // fields always win; the five STATE_KEYS are stripped from it (state is
  // owned by the mint defaults + advanceOpportunityStage, never a side-door).
  const incoming = {};
  if (isPlainObject(extraProps)) {
    for (const k of Object.keys(extraProps)) {
      if (STATE_KEYS.indexOf(k) === -1) incoming[k] = extraProps[k];
    }
  }
  incoming.name = name;
  if (typeof lens === 'string' && lens.length > 0) incoming.lens = lens;
  if (typeof jtbd === 'string' && jtbd.length > 0) incoming.jtbd = jtbd;
  if (typeof score === 'number' && Number.isFinite(score)) incoming.score = score;
  if (typeof section === 'string' && section.length > 0) incoming.section = section;

  const existing = readNodeProps(db, nodeId);
  let props;
  if (existing.found) {
    if (existing.props === null) {
      // A corrupt props blob: merging would silently drop stage_history
      // (the D-17 forbidden pattern), so refuse honestly.
      return { ok: false, reason: 'existing_properties_unparseable', node_id: nodeId };
    }
    // Merge UPSERT: existing props first, incoming non-state scalars win,
    // the five state keys re-asserted from the EXISTING node verbatim.
    props = Object.assign({}, existing.props, incoming);
    for (const k of STATE_KEYS) {
      if (existing.props[k] !== undefined) props[k] = existing.props[k];
      else delete props[k];
    }
    // A pre-D-17 row with no history keeps whatever state it has; we never
    // fabricate a history it did not live.
  } else {
    // Fresh mint: D-03 lifecycle summary + D-17 axes + the initial
    // stage_history entry. section defaults to the honest 'unknown' (the 216
    // field contract) when the caller derived nothing better.
    props = Object.assign({}, incoming, {
      lifecycle: life,
      artifact_status: 'banked',
      opportunity_stage: 'banked',
      opportunity_outcome: 'open',
      stage_history: [historyEntry(null, life, actor, (typeof reason === 'string' && reason.length > 0) ? reason : 'minted', evidence_ids, formula_version)],
    });
    if (typeof props.section !== 'string' || props.section.length === 0) props.section = 'unknown';
  }

  let propsJson;
  try {
    propsJson = JSON.stringify(props);
  } catch (_e) {
    return { ok: false, reason: 'properties_serialize_failed' };
  }
  const sourcePath = 'opportunity:' + sid + ':' + name;
  try {
    // Mint via the shared NOT-NULL-safe chokepoint (lands review_status
    // DEFAULT 'proposed' -- NO review_status arg is passed, so the opportunity
    // is born 'proposed' and stays there). created_by='system' satisfies the
    // Phase-109 CHECK. There is DELIBERATELY no confirm follow-up: only a
    // human confirmNode promotes (Part 9 role 5; the Plan 04 Qualify verb).
    insertNode(db, nodeId, 'opportunity', propsJson, {
      source_path: sourcePath,
      created_by: 'system',
      epistemic_type: OPPORTUNITY_DEFAULT_EPISTEMIC_TYPE,
    });
  } catch (e) {
    return { ok: false, reason: 'opportunity_write_failed', detail: String(e.message || '').slice(0, 80) };
  }
  return { ok: true, node_id: nodeId, merged: existing.found === true };
}

// advanceOpportunityStage(db, params) -- the ONLY legal state transition door.
//
// params = { node_id, axis, to, actor, reason, evidence_ids, formula_version }.
// axis is one of 'lifecycle' | 'stage' | 'outcome'; `to` must be a member of
// that axis's enum. Updates the current-state field for the named axis AND
// APPENDS a stage_history entry {from,to,at,actor,reason,evidence_ids,
// formula_version}. Prior history entries are IMMUTABLE: the merge preserves
// and appends, never replaces - a transition that overwrites or drops history
// is a contract violation (D-17, test-pinned).
//
// Returns { ok:true, node_id, axis, from, to } or { ok:false, reason } -
// never throws. Plans 04 (qualify/skip) and 05 (explored) call this with real
// actor/reason/evidence_ids.
function advanceOpportunityStage(db, params) {
  if (!isPlainObject(params)) {
    return { ok: false, reason: 'invalid_params' };
  }
  const {
    node_id, axis, to, actor, reason, evidence_ids, formula_version,
  } = params;
  if (typeof node_id !== 'string' || node_id.length === 0) {
    return { ok: false, reason: 'invalid_node_id' };
  }
  if (typeof axis !== 'string' || AXIS_FIELDS[axis] === undefined) {
    return { ok: false, reason: 'invalid_axis', detail: String(axis).slice(0, 40) };
  }
  const allowed = AXIS_ENUMS[axis];
  if (typeof to !== 'string' || !allowed.has(to)) {
    return { ok: false, reason: 'invalid_transition_target', detail: String(to).slice(0, 40) };
  }
  const existing = readNodeProps(db, node_id);
  if (!existing.found) {
    return { ok: false, reason: 'node_not_found', node_id: node_id };
  }
  if (existing.props === null) {
    return { ok: false, reason: 'existing_properties_unparseable', node_id: node_id };
  }
  const field = AXIS_FIELDS[axis];
  const from = (typeof existing.props[field] === 'string') ? existing.props[field] : null;
  const history = Array.isArray(existing.props.stage_history)
    ? existing.props.stage_history.slice()
    : [];
  history.push(historyEntry(from, to, actor, reason, evidence_ids, formula_version));
  const props = Object.assign({}, existing.props);
  props[field] = to;
  props.stage_history = history;

  let propsJson;
  try {
    propsJson = JSON.stringify(props);
  } catch (_e) {
    return { ok: false, reason: 'properties_serialize_failed' };
  }
  try {
    // The upsert path: ON CONFLICT(id) updates type + properties only, so
    // provenance columns (source_path / created_by / created_at) and
    // review_status stay untouched - a transition NEVER promotes a node.
    //
    // R17-02: epistemic_type must be re-supplied on every insertNode call
    // (required, no default at the chokepoint). Preserve whatever value the
    // node already carries (existing.props.epistemic_type, set by the
    // original mint above) rather than silently reclassifying it on a mere
    // stage transition; fall back to the writer's default only for a
    // pre-R17-02 row that predates this field.
    const preservedEpistemicType = (
      typeof existing.props.epistemic_type === 'string'
      && ALLOWED_EPISTEMIC_TYPES.has(existing.props.epistemic_type)
    ) ? existing.props.epistemic_type : OPPORTUNITY_DEFAULT_EPISTEMIC_TYPE;
    insertNode(db, node_id, existing.row.type || 'opportunity', propsJson, {
      created_by: 'system',
      epistemic_type: preservedEpistemicType,
    });
  } catch (e) {
    return { ok: false, reason: 'transition_write_failed', detail: String(e.message || '').slice(0, 80) };
  }
  return { ok: true, node_id: node_id, axis: axis, from: from, to: to };
}

// linkOpportunityEvidence(db, params) -- connect an opportunity node to the
// entity/artifact nodes it derives from, through navigation.writeEdge ONLY.
//
// params = { opportunity_id, target_id, edge_type, properties? }. edge_type is
// restricted to the three-member OPPORTUNITY_EVIDENCE_EDGE_SUBSET (D-04) BEFORE
// delegating to writeEdge (which re-validates against the full frozen
// ALLOWED_EDGE_TYPES downstream). Direction: source=opportunity, target=the
// evidence node (the opportunity DERIVED_FROM / is SUPPORTed by / is INFORMed
// by its evidence). Properties stay ENUM/scalar ONLY (Part 8). Returns the
// writeEdge result shape { ok, ... } - never throws.
function linkOpportunityEvidence(db, params) {
  if (!isPlainObject(params)) {
    return { ok: false, reason: 'invalid_params' };
  }
  const {
    opportunity_id, target_id, edge_type, properties,
  } = params;
  if (typeof opportunity_id !== 'string' || opportunity_id.length === 0) {
    return { ok: false, reason: 'invalid_opportunity_id' };
  }
  if (typeof target_id !== 'string' || target_id.length === 0) {
    return { ok: false, reason: 'invalid_target_id' };
  }
  if (typeof edge_type !== 'string' || !OPPORTUNITY_EVIDENCE_EDGE_SUBSET.has(edge_type)) {
    return {
      ok: false,
      reason: 'edge_not_in_opportunity_subset',
      detail: String(edge_type).slice(0, 40),
    };
  }
  const props = isPlainObject(properties)
    ? properties
    : { relation: edge_type.toLowerCase(), opportunity_node: opportunity_id };
  return writeEdge(db, {
    source_id: opportunity_id,
    target_id: target_id,
    edge_type: edge_type,
    properties: props,
  });
}

module.exports = {
  writeOpportunityNode,
  advanceOpportunityStage,
  linkOpportunityEvidence,
  OPPORTUNITY_NODE_ID,
  OPPORTUNITY_LIFECYCLES,
  OPPORTUNITY_ARTIFACT_STATUSES,
  OPPORTUNITY_STAGES,
  OPPORTUNITY_OUTCOMES,
  OPPORTUNITY_EVIDENCE_EDGE_SUBSET,
};
