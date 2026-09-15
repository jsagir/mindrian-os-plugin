'use strict';
/*
 * Phase 347-03 -- chain-state: the ONE writer for a chain step's output as a
 * typed room-graph node with a mandatory provenance anchor, plus the reader
 * that walks the ordered records back into each step's input.
 *
 * docs/2026-09-14-CHAIN-SHARED-STATE-CONTRACT.md is the tracked contract this
 * module implements (Sections 3-5). Today the only durable trace of a chain
 * step is one memory_event node with zero edges
 * (chain-step-dispatcher.cjs:355-361; 343-ICM-CONSULT.md:93 confirms
 * logEvent writes zero edges), and the object that flows between steps lives
 * in a JS closure that evaporates (chain-executor.cjs:486, :656). This module
 * closes that gap.
 *
 * Canon Part 7 (reuse-before-build), why the two closest existing writers are
 * the wrong owner for this job:
 *   - typed-claim.cjs::writeClaimNode is wrong here because a chain record is
 *     not a truth claim: it would queue forever at review_status proposed
 *     (Canon Part 9 role 5, the TRUTH-CLAIM discipline every claim node
 *     inherits) and it would pollute the 2,497-row claim population in the
 *     dogfood room with chain bookkeeping that was never meant to be
 *     reviewed as a claim.
 *   - lib/core/navigation/memory-events.cjs::logMemoryEvent is wrong here
 *     because it writes zero edges and bypasses the node chokepoint by named
 *     exclusion (node-insert.cjs:5-9); an unanchorable record cannot satisfy
 *     this phase's own deliverable (SHARED-01: a record with no resolvable
 *     subject node is refused, not silently logged).
 *
 * Canon Part 8 (the graph boundary): the record body stays in node
 * properties on a LOCAL caller-owned handle. Edge properties are enum and
 * scalar only (edges.cjs:845-848: never prose, never a body). This module
 * makes zero fetch calls, requires no Brain client, and opens no database;
 * it is covered by tests/test-chain-executor-part8-leak.cjs's extended
 * surface list (plan 347-03 Task 2).
 *
 * WD-347-2 (the projection rule, docs/2026-09-14-CHAIN-SHARED-STATE-
 * CONTRACT.md Section 6): the chain_state records this module writes are a
 * PROJECTION. room/.mindrian/pipeline-state.json remains the sole
 * chain-state truth for resume position under D-166-02 and B1
 * (lib/mcp/pipeline-state.cjs:27-46). On disagreement the file wins and the
 * graph row is reported stale; no code path in this phase treats the graph
 * as the resume cursor.
 *
 * Allow-list coverage: this file lives under lib/core/navigation/, already
 * matched by scripts/check-substrate.cjs:70's ALLOWED_DIRECT_IMPORT regex
 * /^lib\/core\/navigation\//, exactly like reasoning-write.cjs and
 * typed-claim.cjs. No allow-list edit is needed and none is made.
 *
 * Ordering discipline (SHARED-01's own precondition): the subject-node
 * anchor existence check runs BEFORE insertNode is ever called, so a refusal
 * genuinely mints nothing -- no row, no edge. Putting the anchor check
 * inside node-insert.cjs instead would be the wrong owner
 * (343-ICM-CONSULT.md:372): the node chokepoint's entire contract is
 * inserting one row into `nodes` correctly across three schema variants and
 * it has no edge surface at all; merging the two chokepoints would erase a
 * distinction the architecture keeps deliberately
 * (lib/core/navigation/CONTEXT.md: "The two write chokepoints are
 * constitutionally distinct").
 *
 * Takes a caller-owned handle as the first parameter of every exported
 * function, exactly like typed-claim.cjs and reasoning-write.cjs. Requires
 * exactly two things: ../node-insert.cjs for insertNode and ./edges.cjs for
 * writeEdge. Requires the built-in SQLite module nowhere. Opens no database.
 *
 * Hyphens only, no em-dashes, no emoji (CLAUDE.md HARD RULE). CJS. Zero npm
 * dependencies.
 */

const { insertNode } = require('../node-insert.cjs');
const edges = require('./edges.cjs');

// The literal node type for every record this module writes.
const CHAIN_STATE_NODE_TYPE = 'chain_state';

// The closed five-kind vocabulary (docs/2026-09-14-CHAIN-SHARED-STATE-
// CONTRACT.md Section 4). A kind outside this set is refused with
// invalid_kind before any prepare().
const CHAIN_STATE_KINDS = Object.freeze(['task', 'draft', 'notes', 'judgment', 'gate_decision']);

// The kind-to-epistemic_type mapping table (contract Section 4). Phase
// 276-12 already solved the sibling problem for claims
// (typed-claim.cjs::KNOWLEDGE_TYPE_TO_EPISTEMIC_TYPE) after a hardcoded
// constant "collapsed all 6 KNOWLEDGE_TYPES onto one epistemic_type"
// (typed-claim.cjs:192-194). This table copies that shape rather than
// reinventing it. A single hardcoded epistemic_type for all five kinds is
// FORBIDDEN: it would repeat the exact pre-276-12 defect and make a `task`
// bookkeeping row indistinguishable from a navigator's `gate_decision`
// verdict to any reader walking the graph by epistemic_type alone.
const KIND_TO_EPISTEMIC_TYPE = Object.freeze({
  // A task description records what was asked, not a derived position.
  task: 'observation',
  // A draft is the model's own output standing on its own, not yet reviewed.
  draft: 'model_derived_assertion',
  // Notes are extracted and restructured from a source the step already read.
  notes: 'derived_fact',
  // A judgment reads evidence and takes a position short of a decision.
  judgment: 'interpretation',
  // It records a navigator verdict, the closed enum's own decision member.
  gate_decision: 'decision',
});

// WD-347-3: the bookkeeping carve-out. task/draft/notes/judgment land
// review_status confirmed unconditionally (mirrors the memory_event
// carve-out at 343-ICM-CONSULT.md:89); gate_decision is the one kind that
// carries human-trust semantics and is gated on a non-empty byUser below.
const BOOKKEEPING_REVIEW_STATUS = 'confirmed';

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * detectSchemaVariant(db) -> 'wide' | 'mid' | 'legacy'.
 *
 * Gates on PRAGMA table_info(nodes) up front, following node-insert.cjs's
 * own isMigratedSchema idiom (node-insert.cjs:148-150), so a statement the
 * schema cannot answer is never fabricated. 'wide' carries the Phase-109
 * marker column (source_path); 'mid' is wider than the bare 3-column shape
 * but lacks the marker; 'legacy' is the bare id/type/properties shape.
 * Defensive: any PRAGMA failure falls back to 'legacy', the safe choice
 * (mirrors node-insert.cjs::isMigratedSchema's own defensive default).
 */
function detectSchemaVariant(db) {
  try {
    const cols = db.prepare('PRAGMA table_info(nodes)').all();
    const names = cols.map((c) => c && c.name);
    if (names.indexOf('source_path') !== -1) return 'wide';
    if (cols.length > 3) return 'mid';
    return 'legacy';
  } catch (_e) {
    return 'legacy';
  }
}

/**
 * findChainStateNodeByStep(db, runId, stepIndex) -> {id, properties} | null.
 *
 * A chain_state node's id embeds run_id, step_index and kind, but a caller
 * looking for "the record at step N of run R" does not know the kind ahead
 * of time, so this walks the type-scoped node set and matches on the
 * validated properties.run_id / properties.step_index pair instead of
 * building a caller-supplied id. Used both to find a write's predecessor
 * (for the FEEDS_INTO successor edge) and by readChainState to find the
 * step-0 entry point. A column name is never caller-supplied; the single
 * bound value is the fixed CHAIN_STATE_NODE_TYPE literal.
 *
 * WR-02 (347 code review): the scan is ORDER BY rowid DESC, so when more
 * than one node exists for the same (run_id, step_index) pair -- a second
 * `kind` written at an already-occupied step, which mints a second node id
 * rather than overwriting the first -- the most recently INSERTED row wins,
 * deterministically, rather than depending on SQLite's otherwise-unspecified
 * row order for a query with no ORDER BY.
 */
function findChainStateNodeByStep(db, runId, stepIndex) {
  if (typeof stepIndex !== 'number' || stepIndex < 0) return null;
  let rows;
  try {
    // WR-02 (347 code review): ORDER BY rowid DESC, mirroring tool-router.cjs's
    // own _newestChainRunId idiom -- `nodes` keeps its default SQLite rowid
    // regardless of schema variant (the id column's PRIMARY KEY never
    // declares WITHOUT ROWID), so this reliably walks rows most-recent-first.
    // Two different `kind` values at the same (run_id, step_index) mint two
    // distinct node ids (never one overwritten node), so "the first match in
    // this order" is an ENFORCED "most recent write wins" rule rather than
    // an accident of SQLite's otherwise-unspecified row order.
    rows = db.prepare('SELECT id, properties FROM nodes WHERE type = ? ORDER BY rowid DESC').all(CHAIN_STATE_NODE_TYPE);
  } catch (_e) {
    return null;
  }
  for (const row of rows) {
    let props;
    try {
      props = JSON.parse(row.properties || '{}');
    } catch (_e) {
      continue;
    }
    if (isPlainObject(props) && props.run_id === runId && props.step_index === stepIndex) {
      return { id: row.id, properties: props };
    }
  }
  return null;
}

function toRecord(id, properties, schemaVariant) {
  const p = isPlainObject(properties) ? properties : {};
  return {
    node_id: id,
    run_id: typeof p.run_id === 'string' ? p.run_id : null,
    step_index: typeof p.step_index === 'number' ? p.step_index : null,
    kind: typeof p.kind === 'string' ? p.kind : null,
    command: typeof p.command === 'string' ? p.command : null,
    body: p.body === undefined ? null : p.body,
    quality: p.quality === undefined ? null : p.quality,
    tier: p.tier === undefined ? null : p.tier,
    produced_by: p.produced_by === undefined ? null : p.produced_by,
    schema_variant: schemaVariant,
  };
}

/**
 * writeChainStateRecord(db, params) -> {ok, node_id, anchor, successor,
 *   schema_variant} | {ok:false, reason, detail?}.
 *
 * params: { run_id, step_index, kind, command, body, quality, tier,
 *   produced_by, subject_node_id, byUser?, extraProps? }.
 *
 * Validates in order, all before any prepare(), all fail-closed:
 *   1. kind is in CHAIN_STATE_KINDS, else reason invalid_kind.
 *   2. run_id and step_index are present and of the right primitive type,
 *      else reason invalid_params.
 *   3. subject_node_id is a non-empty string AND a row with that id exists
 *      in nodes, else reason missing_structural_anchor. The anchor
 *      existence check is a single prepared SELECT bound with a
 *      placeholder; a column name is never caller-supplied.
 *
 * Only after all three gates pass: composes node_id as
 * 'chain:'+run_id+':'+step_index+':'+kind, calls insertNode with overrides
 * carrying source_path='chain:'+run_id, created_by='system', epistemic_type
 * from KIND_TO_EPISTEMIC_TYPE, and review_status per WD-347-3. Mirrors
 * node-insert's own protected-key discipline: the properties object is
 * built locally, spreading any caller extraProps FIRST, then setting
 * run_id, step_index, command, kind, body, quality, tier and produced_by
 * AFTER, so a caller-supplied key can never shadow a contracted one.
 *
 * Then writes the anchor through writeEdge (SOURCED_FROM, record ->
 * subject, properties carrying only run_id/step_index scalars) and reads
 * `written`, not only `ok` (edges.cjs D-01, Phase 273: 77 call sites across
 * 43 files read `ok`, so `written` is the additive, non-breaking signal).
 * When a predecessor record exists at (run_id, step_index - 1), writes the
 * second edge (FEEDS_INTO, predecessor -> this record) with the same two
 * scalar properties.
 */
function writeChainStateRecord(db, params) {
  if (!isPlainObject(params)) {
    return { ok: false, reason: 'invalid_params' };
  }
  const {
    run_id, step_index, kind, command, body, quality, tier, produced_by,
    subject_node_id, byUser, extraProps,
  } = params;

  // Gate 1: the closed five-kind vocabulary. Checked FIRST, before any other
  // work, mirroring insertNode's own epistemic_type-first discipline.
  if (typeof kind !== 'string' || CHAIN_STATE_KINDS.indexOf(kind) === -1) {
    return { ok: false, reason: 'invalid_kind', detail: String(kind).slice(0, 40) };
  }

  // Gate 2: run_id and step_index primitive shape.
  if (typeof run_id !== 'string' || run_id.length === 0
    || typeof step_index !== 'number' || !Number.isInteger(step_index) || step_index < 0) {
    return { ok: false, reason: 'invalid_params' };
  }

  // Gate 3: the structural anchor. A record with no resolvable subject node
  // is refused here, BEFORE insertNode is ever called, so the refusal mints
  // NO row at all (SHARED-01's own precondition).
  if (typeof subject_node_id !== 'string' || subject_node_id.length === 0) {
    return { ok: false, reason: 'missing_structural_anchor' };
  }
  let subjectRow;
  try {
    subjectRow = db.prepare('SELECT id FROM nodes WHERE id = ?').get(subject_node_id);
  } catch (_e) {
    return { ok: false, reason: 'missing_structural_anchor' };
  }
  if (!subjectRow) {
    return { ok: false, reason: 'missing_structural_anchor' };
  }

  const nodeId = 'chain:' + run_id + ':' + step_index + ':' + kind;

  // WD-347-3: bookkeeping kinds are confirmed unconditionally; gate_decision
  // is confirmed ONLY with a non-empty byUser handle, mirroring writeEdge's
  // own confirmed_requires_by_user guard (edges.cjs:1083-1088). insertNode
  // does not enforce this for nodes, so the writer's own contract must.
  const hasByUser = typeof byUser === 'string' && byUser.trim().length > 0;
  const reviewStatus = kind === 'gate_decision'
    ? (hasByUser ? 'confirmed' : 'proposed')
    : BOOKKEEPING_REVIEW_STATUS;

  // Protected-key discipline: spread caller extras FIRST, then set every
  // contracted key AFTER, so a caller-supplied key can never shadow a
  // validated one (mirrors typed-claim.cjs's PROTECTED_CLAIM_KEYS idiom).
  const props = isPlainObject(extraProps) ? Object.assign({}, extraProps) : {};
  props.run_id = run_id;
  props.step_index = step_index;
  props.command = typeof command === 'string' ? command : '';
  props.kind = kind;
  props.body = body === undefined ? null : body;
  props.quality = typeof quality === 'string' ? quality : null;
  props.tier = typeof tier === 'string' ? tier : null;
  props.produced_by = typeof produced_by === 'string' ? produced_by : null;
  if (hasByUser) props.by_user = byUser.trim();

  let propsJson;
  try {
    propsJson = JSON.stringify(props);
  } catch (_e) {
    return { ok: false, reason: 'properties_serialize_failed' };
  }

  try {
    insertNode(db, nodeId, CHAIN_STATE_NODE_TYPE, propsJson, {
      source_path: 'chain:' + run_id,
      created_by: 'system',
      review_status: reviewStatus,
      epistemic_type: KIND_TO_EPISTEMIC_TYPE[kind],
    });
  } catch (e) {
    return { ok: false, reason: 'chain_state_write_failed', detail: String(e.message || '').slice(0, 80) };
  }

  // The mandatory anchor. Properties carry only run_id/step_index scalars
  // (edges.cjs:845-848: enum and scalar only, never a body).
  const anchorResult = edges.writeEdge(db, {
    source_id: nodeId,
    target_id: subject_node_id,
    edge_type: 'SOURCED_FROM',
    properties: { run_id: run_id, step_index: step_index },
  });
  const anchor = (anchorResult && anchorResult.ok && anchorResult.written === true)
    ? anchorResult.edge_id
    : null;

  // The successor pointer, when a predecessor record already exists for
  // (run_id, step_index - 1). A step-0 record (or one whose predecessor was
  // never written) carries no FEEDS_INTO edge.
  let successor = null;
  const predecessor = findChainStateNodeByStep(db, run_id, step_index - 1);
  if (predecessor) {
    const feedsResult = edges.writeEdge(db, {
      source_id: predecessor.id,
      target_id: nodeId,
      edge_type: 'FEEDS_INTO',
      properties: { run_id: run_id, step_index: step_index },
    });
    successor = (feedsResult && feedsResult.ok && feedsResult.written === true)
      ? feedsResult.edge_id
      : null;
  }

  return {
    ok: true,
    node_id: nodeId,
    anchor: anchor,
    successor: successor,
    schema_variant: detectSchemaVariant(db),
  };
}

/**
 * readChainState(db, runId) -> Array<record>.
 *
 * Selects the chain_state nodes for the run, then walks FEEDS_INTO forward
 * from the step-0 record. Before following any edge, verifies its target
 * row exists: the edges foreign key was removed under Phase 169 D-169-11
 * and a dangling edge is a permitted state (2,657 dangling rows measured
 * across 30 rooms, lib/core/navigation/CONTEXT.md "Why a dangling endpoint
 * is legal"), so referential integrity cannot be assumed. A break in the
 * chain stops the walk at the last resolvable record rather than fabricate
 * a phantom continuation. Returns records ordered by the FEEDS_INTO walk,
 * never by a step_index sort, each carrying a schema_variant marker.
 */
function readChainState(db, runId) {
  const schemaVariant = detectSchemaVariant(db);
  if (typeof runId !== 'string' || runId.length === 0) return [];

  const start = findChainStateNodeByStep(db, runId, 0);
  if (!start) return [];

  const ordered = [toRecord(start.id, start.properties, schemaVariant)];
  const visited = new Set([start.id]);
  let currentId = start.id;

  // Walk forward. Cycle-guarded via `visited`; each hop verifies the target
  // node row actually exists before following it, per the dangling-edge
  // rule above.
  while (true) {
    let edgeRow;
    try {
      // WR-02 (347 code review): ORDER BY rowid DESC LIMIT 1, the same
      // tie-break as findChainStateNodeByStep above -- a source node with
      // more than one outgoing FEEDS_INTO edge (two different kinds recorded
      // at the same step_index under different node ids) now deterministically
      // follows the most recently written edge, rather than relying on
      // SQLite's unspecified row order for a bare .get() with no ORDER BY.
      edgeRow = db.prepare('SELECT target FROM edges WHERE type = ? AND source = ? ORDER BY rowid DESC LIMIT 1').get('FEEDS_INTO', currentId);
    } catch (_e) {
      break;
    }
    if (!edgeRow || !edgeRow.target || visited.has(edgeRow.target)) break;

    let targetRow;
    try {
      targetRow = db.prepare('SELECT id, type, properties FROM nodes WHERE id = ?').get(edgeRow.target);
    } catch (_e) {
      break;
    }
    // The permitted dangling state: the edge exists but its endpoint has no
    // node row (or is no longer a chain_state row). Stop honestly here
    // rather than fabricate a continuation.
    if (!targetRow || targetRow.type !== CHAIN_STATE_NODE_TYPE) break;

    let props;
    try {
      props = JSON.parse(targetRow.properties || '{}');
    } catch (_e) {
      break;
    }

    visited.add(targetRow.id);
    currentId = targetRow.id;
    ordered.push(toRecord(targetRow.id, props, schemaVariant));
  }

  return ordered;
}

/**
 * reconstructStepInput(db, runId, stepIndex) -> {ok, input, schema_variant}
 *   | {ok:false, reason:'unreconstructible', missing_step, schema_variant}.
 *
 * Rebuilds the predecessor's body. Returns ok:true with input:null at step
 * index 0 (there is no predecessor to fold forward). For any later index,
 * walks the endpoint-verified readChainState result (never a raw step_index
 * sort, so a hole earlier in the chain honestly breaks the lookup) and
 * returns ok:false with reason unreconstructible plus the missing step
 * index when the predecessor record or its edge endpoint is absent. Never
 * returns an empty object and never returns 0 for something unmeasurable
 * (343-ICM-CONSULT.md:502's catch-returns-0 rule): schema_variant is always
 * a string and input is always explicitly null, not omitted.
 */
function reconstructStepInput(db, runId, stepIndex) {
  const schemaVariant = detectSchemaVariant(db);
  if (typeof runId !== 'string' || runId.length === 0
    || typeof stepIndex !== 'number' || !Number.isInteger(stepIndex) || stepIndex < 0) {
    return { ok: false, reason: 'invalid_params', schema_variant: schemaVariant };
  }
  if (stepIndex === 0) {
    return { ok: true, input: null, schema_variant: schemaVariant };
  }
  const records = readChainState(db, runId);
  const predecessor = records.find((r) => r.step_index === stepIndex - 1);
  if (!predecessor) {
    return { ok: false, reason: 'unreconstructible', missing_step: stepIndex - 1, schema_variant: schemaVariant };
  }
  return { ok: true, input: predecessor.body, schema_variant: schemaVariant };
}

module.exports = {
  writeChainStateRecord,
  readChainState,
  reconstructStepInput,
  CHAIN_STATE_NODE_TYPE,
  CHAIN_STATE_KINDS,
  KIND_TO_EPISTEMIC_TYPE,
};
