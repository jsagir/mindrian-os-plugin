'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 160-06 Task 1 -- the ONE shared tri-polar date+sync gate chokepoint.
 * =========================================================================
 *
 * R11 (160-SPEC.md) + D-02 (160-CONTEXT.md). requireValidAt(filingNode, opts) is
 * the SINGLE enforcement rule for "no real-world-event artifact files without a
 * human-owned valid_at." The rule lives ONLY here. Both the CLI meeting-file
 * path (commands/file-meeting.md) and the MCP filing tool (lib/mcp/prompts.cjs)
 * call this one chokepoint -- tri-polar by construction, so per-surface drift
 * (CLI enforces, MCP does not) is impossible (T-160-15).
 *
 * The doctrine, in one line: created_at = WHEN WE FILED IT (the filing moment),
 * valid_at = WHEN IT HAPPENED (the real-world moment). The HUMAN owns valid_at.
 *
 * Verdicts:
 *   GATE_BLOCK -- the node is a real-world event (type 'meeting' always, or
 *     has_event_date === true) and no valid_at is resolvable yet. Returns a
 *     Shape F.1 selector SPEC ("when?" + multi-select "relates to?") -- NOT a
 *     rendered prompt. Each surface RENDERS the spec its own way (CLI
 *     AskUserQuestion, Desktop/Cowork conversational). Enforcement is one
 *     function; rendering is per-surface (D-02).
 *   GATE_PASS  -- either valid_at is now known (explicit numeric, or resolved
 *     from a free-typed "when?" answer via resolveRelativeTime against the
 *     reference), OR the node is NOT a real-world event so valid_at defaults to
 *     the filing moment SILENTLY (pure ideas / assumptions, no selector).
 *
 * Sync edges (the multi-select "relates to?"): when the human selects related
 * nodes, the gate writes ONE sync edge per relation via navigation.writeEdge
 * (the chokepoint) and emits f_selector_sync_confirmed via
 * navigation.logMemoryEvent -- REUSING the dial-close-reach idiom verbatim
 * (lib/workflow/dial-close-reach.cjs:361, the f_selector_sync_confirmed
 * emission alongside the SELECTED_REACH bookkeeping edge). The sync-edge
 * predicate is INFORMS (an existing ALLOWED_EDGE_TYPES member): the meeting
 * INFORMS the related node. No new edge type is minted; no canon amendment.
 *
 * D-04: has_event_date is READ off the node (set at WRITE time by node type;
 * the gate never infers it at read time). The gate stays deterministic.
 *
 * Part 8 (LOCAL -> BRAIN: NO). Everything here is LOCAL: valid_at / created_at
 * are epoch-ms SCALARS; the sync edge carries only node-id handles + an enum
 * relation scalar; the f_selector_sync_confirmed event carries only scalars.
 * Nothing egresses to Brain. The Phase 157 boundary scan stays GREEN.
 *
 * House rule: hyphens only, no em-dashes. Pure CJS. Reuses the Wave-2 resolver
 * + getReferenceNow + the navigation chokepoint (Part 7); no new dependency.
 */

const navigation = require('../navigation.cjs');
const { resolveRelativeTime } = require('./resolve-relative-time.cjs');
const { getReferenceNow } = require('./reference-now.cjs');

// The two verdict tokens (stable string enums).
const GATE_BLOCK = 'GATE_BLOCK';
const GATE_PASS = 'GATE_PASS';

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/*
 * isRealWorldEvent(node) -> boolean. A node is a real-world event when:
 *   - its type is 'meeting' (always), OR
 *   - it carries has_event_date === true (set EXPLICITLY at write time by node
 *     type per D-04 -- decision/claim flagged when the filing path detected an
 *     event date). NEVER inferred here; the gate only READS the flag.
 */
function isRealWorldEvent(node) {
  if (!isPlainObject(node)) return false;
  if (node.type === 'meeting') return true;
  return node.has_event_date === true;
}

/*
 * buildSelectorSpec() -> the Shape F.1 selector SPEC (not a rendered prompt).
 *
 * A "when?" question (sets valid_at; accepts an explicit date OR a free-typed
 * relative phrase resolved by chrono-node from Wave 2) and a multi-select
 * "relates to?" question (writes sync edges). Each surface renders this its own
 * way (D-02): CLI via AskUserQuestion, Desktop/Cowork conversationally.
 */
function buildSelectorSpec() {
  return {
    shape: 'F.1',
    prompt: 'When did this happen, and what does it relate to?',
    questions: [
      {
        id: 'when',
        question: 'When did this happen?',
        multi_select: false,
        accepts: 'date_or_relative_time',
        note: 'An explicit date, or a free-typed relative phrase ("last Tuesday").',
      },
      {
        id: 'relates_to',
        question: 'What does this relate to?',
        multi_select: true,
        accepts: 'node_ids',
        note: 'Pick the related nodes; each becomes a sync edge.',
      },
    ],
  };
}

/*
 * resolveValidAt(node, referenceMs, opts) -> number | null.
 *
 * valid_at precedence (the human owns valid_at):
 *   1. an explicit numeric node.valid_at OR opts.valid_at (already owned), else
 *   2. resolveRelativeTime(opts.whenAnswer) anchored to referenceMs (the
 *      free-typed "when?" answer the selector returned), else
 *   3. null (unresolved -> the caller BLOCKS for a real-world event).
 */
function resolveValidAt(node, referenceMs, opts) {
  if (isFiniteNumber(node.valid_at)) return node.valid_at;
  if (isFiniteNumber(opts.valid_at)) return opts.valid_at;
  if (typeof opts.whenAnswer === 'string' && opts.whenAnswer.trim()) {
    const resolved = resolveRelativeTime(opts.whenAnswer, { referenceMs });
    if (resolved && isFiniteNumber(resolved.validAtMs)) return resolved.validAtMs;
  }
  return null;
}

/*
 * writeSyncEdges(db, sourceId, relatesTo, opts) -> { edges, eventEmitted }.
 *
 * For each related node id, write ONE INFORMS sync edge (source = the filing
 * node, target = the related node) via navigation.writeEdge, then emit a single
 * f_selector_sync_confirmed memory_event via navigation.logMemoryEvent reusing
 * the dial-close-reach idiom. No-op (returns empty) when there is no db handle,
 * no source id, or no relations -- the gate degrades to a date-only pass.
 *
 * Part 8: the edge carries a relation enum + node-id handles only; the event
 * carries scalars only. No user prose. No Brain.
 */
function writeSyncEdges(db, sourceId, relatesTo, opts) {
  const out = { edges: [], eventEmitted: false };
  if (!db || typeof sourceId !== 'string' || !sourceId) return out;
  if (!Array.isArray(relatesTo) || relatesTo.length === 0) return out;

  for (const targetId of relatesTo) {
    if (typeof targetId !== 'string' || !targetId) continue;
    const res = navigation.writeEdge(db, {
      source_id: sourceId,
      target_id: targetId,
      edge_type: 'INFORMS',
      properties: { relation: 'date_sync', source_path: 'gate:date-sync:relates_to' },
    });
    if (res && res.ok) {
      out.edges.push({ source: sourceId, target: targetId, type: 'INFORMS' });
    }
  }

  // Reuse the dial-close-reach f_selector_sync_confirmed idiom verbatim: the
  // resting-detent in-sync signal, emitted once when sync edges land.
  if (out.edges.length > 0) {
    const chokeOpts = {};
    if (typeof opts.now === 'function') chokeOpts.now = opts.now;
    const ev = navigation.logMemoryEvent(db, 'f_selector_sync_confirmed', {
      source_path: 'gate:date-sync:relates_to',
      synced_count: out.edges.length,
      created_by: 'user',
    }, chokeOpts);
    out.eventEmitted = !!(ev && ev.ok);
  }
  return out;
}

/*
 * requireValidAt(filingNode, opts) -> verdict object.
 *
 * The single tri-polar enforcement chokepoint (D-02). Surface-agnostic: returns
 * a verdict + (on block) a Shape F.1 selector SPEC; the CLI and MCP layers
 * RENDER it. Enforcement is this one function.
 *
 * Returns on GATE_BLOCK:  { verdict, selector, created_at, reason }
 * Returns on GATE_PASS:   { verdict, valid_at, created_at, sync_edges?, sync_event? }
 *
 * opts (all optional):
 *   db           a caller-owned room.db handle (via openRoomDb) -- needed only
 *                to write the multi-select sync edges. Absent -> no edges.
 *   now          injectable clock closure (the options.now seam, D-01a). The
 *                filing moment created_at is sourced from this.
 *   referenceMs  explicit reference epoch ms for relative-time resolution (test
 *                seam); else derived from getReferenceNow via now/currentDate.
 *   currentDate  YYYY-MM-DD forwarded to getReferenceNow when no referenceMs.
 *   seamPath     LOCAL seam file forwarded to getReferenceNow.
 *   whenAnswer   the human's free-typed (or explicit) "when?" selector answer.
 *   valid_at     an explicit numeric valid_at the caller already holds.
 *   relatesTo    the multi-select "relates to?" node ids -> sync edges.
 */
function requireValidAt(filingNode, opts) {
  const node = isPlainObject(filingNode) ? filingNode : {};
  const o = opts && typeof opts === 'object' ? opts : {};

  // The filing moment (created_at) is the reference now, sourced from the
  // options.now seam (D-01a). This NEVER becomes valid_at for a real-world event.
  let createdAt;
  if (isFiniteNumber(o.referenceMs)) {
    createdAt = o.referenceMs;
  } else {
    const ref = getReferenceNow({
      currentDate: typeof o.currentDate === 'string' ? o.currentDate : undefined,
      now: typeof o.now === 'function' ? o.now : undefined,
      seamPath: typeof o.seamPath === 'string' ? o.seamPath : undefined,
    });
    createdAt = ref && isFiniteNumber(ref.referenceMs) ? ref.referenceMs : Date.now();
  }
  const referenceMs = createdAt;

  // Pure ideas / assumptions (NOT real-world events): stamp valid_at = filing
  // time SILENTLY. No selector, no block (the human-owned-date rule applies only
  // to real-world events).
  if (!isRealWorldEvent(node)) {
    return { verdict: GATE_PASS, valid_at: createdAt, created_at: createdAt };
  }

  // Real-world event: valid_at must be resolvable, else BLOCK with the selector.
  const validAt = resolveValidAt(node, referenceMs, o);
  if (validAt == null) {
    return {
      verdict: GATE_BLOCK,
      selector: buildSelectorSpec(),
      created_at: createdAt,
      reason: 'real_world_event_missing_valid_at',
    };
  }

  // Dated: PASS. Write any multi-select sync edges (the "relates to?" answer)
  // and emit f_selector_sync_confirmed. created_at stays the filing moment.
  const sourceId = typeof node.id === 'string' ? node.id : null;
  const sync = writeSyncEdges(o.db, sourceId, o.relatesTo, o);

  return {
    verdict: GATE_PASS,
    valid_at: validAt,
    created_at: createdAt,
    sync_edges: sync.edges,
    sync_event: sync.eventEmitted,
  };
}

module.exports = {
  requireValidAt,
  GATE_BLOCK,
  GATE_PASS,
  // Exported for the CLI/MCP renderers + targeted tests.
  isRealWorldEvent,
  buildSelectorSpec,
};
