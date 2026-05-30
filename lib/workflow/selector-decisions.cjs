'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 125-06 -- F-selector decision recording + decay weight (D7 implementation).
 * =================================================================================
 * Implements CONTEXT.md D7: when the user picks F.1 (defer) or F.2 (reject) on a
 * ranked command, emit THREE side-effects atomically:
 *
 *   1. memory_event row (event_type='f_selector_decision') via
 *      navigation.logMemoryEvent
 *   2. typed cascade edge (DEFERRED | REJECTED) via navigation.writeEdge
 *      (Plan 00 primitive)
 *   3. decay-weight applied to next N rankings (via applyDecayWeight reader,
 *      consumed by Plan 05 ranker's opts._applyDecayWeight IoC hook)
 *
 * All writes route through the navigation.cjs chokepoint. ZERO direct room-db
 * access. ZERO direct loads of internal navigation submodules (the chokepoint
 * is the only door). The grep audit in lib/memory/selector-decisions.test.cjs
 * Test 7 enforces these invariants structurally on every CI run.
 *
 * Canon binding:
 *   Part 4: every choice is graph data; defer/reject become typed edges.
 *   Part 7: reuse before build; we ship as thin glue over Plan 00's
 *           writeEdge + Phase 109's logMemoryEvent + Phase 109's
 *           findRecentChanges -- not a single net-new SQL statement.
 *   Part 8: LOCAL only; no Brain calls; no user content leaves the room.
 *   Part 9: SQL remembers and navigates; this module reads-and-writes
 *           through the navigation chokepoint, never around it.
 *
 * Function signatures LOCKED in 125-CONTEXT.md "Function signatures":
 *   recordSelectorDecision({decision, command, framework, reason?, roomState})
 *     -> {decision_id, edge_id} on success | {ok: false, reason, detail?} on failure
 *   applyDecayWeight(base_score, command_id, roomState) -> number
 *
 * D7 exponential decay formula (CONTEXT.md verbatim):
 *   adjusted_score = base_score * (1 - exp(-(invocations_since_decision / N)))
 * where N = 5 (DECAY_WINDOW).
 *
 *   At decision time (n=0):  factor = 0 (command pushed to bottom).
 *   5 invocations later:     factor ~ 0.6321.
 *   10 invocations later:    factor ~ 0.8647.
 *   15+ invocations later:   factor approaches 1 (decision effectively expires).
 *
 * License: BSL 1.1.
 */

const navigation = require('../core/navigation.cjs');

// CONTEXT.md Open Question #6 lean: decay window N=5 invocations. Tunable per-
// room via .mos/config.json in v2; fixed at 5 for v1. Exposed as a module
// constant so consumers (Plan 05 ranker, debug tooling, future tuning passes)
// can reference DECAY_WINDOW symbolically rather than hard-coding 5.
const DECAY_WINDOW = 5;

// CONTEXT.md RESEARCH G-09 lean: exclude commands whose decay factor is below
// this threshold from the top-K list entirely (freshly-rejected commands
// shouldn't appear in the very next selector). Plan 05 ranker may wire this
// helper via opts to filter. Threshold 0.1 means "first invocation after a
// decision suppresses the command; from invocation 1 onwards the command
// resurfaces with the decayed weight". Configurable in v2.
const EXCLUSION_THRESHOLD = 0.1;

// CONTEXT.md Open Question #7 lean: clock-driven expiry alongside the
// invocation-count decay. DEFERRED edges carry expires_at 30 days from
// decision time; REJECTED edges have no expiry. This handles long-idle rooms
// gracefully (a deferred command shouldn't stay suppressed for a year if the
// user simply walked away from the room for weeks).
const DEFAULT_DEFER_EXPIRY_DAYS = 30;

function _defaultExpiresAt() {
  return new Date(Date.now() + DEFAULT_DEFER_EXPIRY_DAYS * 24 * 3600 * 1000).toISOString();
}

// ---------------------------------------------------------------------------
// recordSelectorDecision -- the D7 writer.
//
// CONTEXT.md locked signature:
//   recordSelectorDecision({decision, command, framework, reason?, roomState})
//     -> {decision_id, edge_id}
//
// db handle is read from roomState.db per the design lock (callers populate
// roomState.db before invocation). This keeps the signature stable as the
// roomState shape evolves and prevents accidental signature drift.
//
// Returns {ok: true, decision_id, edge_id} on success, or
// {ok: false, reason, detail?} on validation/write failure. Defensive --
// never throws on caller input.
// ---------------------------------------------------------------------------
function recordSelectorDecision(args) {
  const o = args || {};
  const decision = o.decision;
  const command = o.command;
  const framework = o.framework;
  // Reason is optional. CONTEXT.md acceptance: "Reason is optional -- when
  // omitted, payload.reason is null AND edge.properties.reason is null."
  const reason = (typeof o.reason === 'string' && o.reason.length > 0) ? o.reason : null;
  const roomState = o.roomState || {};
  const db = roomState.db;
  const score_at_decision = (typeof o.score_at_decision === 'number') ? o.score_at_decision : null;

  // -------------------------------------------------------------------------
  // Phase 129.5-03 -- the Decision Gate APPROVE path (F.0 accept branch).
  //
  // Canon Part 3: a human APPROVE at a tri-context Decision Gate is the ONLY
  // path to a confirmed truth-claim node. Canon Part 9 (role 5): the human
  // confirms truth; Larry proposes but never silently confirms. This branch
  // wires the dead lever: an APPROVE promotes a PROPOSED truth-claim node to
  // confirmed via the navigation chokepoint's confirmNode helper, attributed to
  // the active room's USER.md navigator identity (resolveByUser).
  //
  // The branch routes EVERYTHING through navigation.confirmNode -- NO direct
  // promoteNodeStatus call, NO raw SQL (Canon Part 8 / substrate guard:
  // selector-decisions.cjs is NOT allow-listed, so it touches room.db only via
  // the chokepoint, the same source-of-truth as the defer/reject branches).
  //
  // byUser resolution: if args.byUser is a non-empty string, use it VERBATIM (so
  // a hostile-caller path exercises the AGENT_IDENTITIES guard end-to-end); else
  // resolve from roomState.roomDir USER.md via navigation.resolveByUser (which
  // never returns an agent identity, defaulting to 'navigator').
  // -------------------------------------------------------------------------
  if (decision === 'accept' || decision === 'approve') {
    if (!db) {
      return { ok: false, reason: 'invalid_db' };
    }
    const nodeId = o.nodeId;
    if (typeof nodeId !== 'string' || nodeId.length === 0) {
      return { ok: false, reason: 'invalid_node_id' };
    }
    const byUser = (typeof o.byUser === 'string' && o.byUser.length > 0)
      ? o.byUser
      : navigation.resolveByUser(roomState.roomDir);
    const result = navigation.confirmNode(db, nodeId, byUser, reason);
    if (result && result.ok) {
      // decision_id is the status_promoted eventId from confirmNode.
      return { ok: true, decision_id: result.eventId };
    }
    // Surface the confirmNode failure verbatim so agent_attribution_forbidden /
    // unknown_node / invalid_transition / state_mismatch reach the caller
    // unchanged.
    return result;
  }

  // Validation gate (defensive; never throws).
  if (decision !== 'defer' && decision !== 'reject') {
    return { ok: false, reason: 'invalid_decision' };
  }
  if (typeof command !== 'string' || command.length === 0) {
    return { ok: false, reason: 'invalid_command' };
  }
  if (typeof framework !== 'string' || framework.length === 0) {
    return { ok: false, reason: 'invalid_framework' };
  }
  if (!db) {
    // Locked design: db must be on roomState.db. Callers populate this.
    return { ok: false, reason: 'invalid_db' };
  }

  const investment_level_at_decision =
    (typeof roomState.investment_level === 'number') ? roomState.investment_level : 0;
  const edgeSemantic = (decision === 'defer') ? 'DEFERRED' : 'REJECTED';
  const expiresAt = (decision === 'defer') ? _defaultExpiresAt() : null;

  // ---------------------------------------------------------------------
  // Step 1: write memory_event via the navigation chokepoint.
  // CONTEXT.md memory_event payload schema (verbatim):
  //   {
  //     event_type: 'f_selector_decision',         // overridden by logMemoryEvent
  //     decision: 'defer' | 'reject',
  //     command, framework,
  //     reason: string | null,
  //     edge_semantic: 'DEFERRED' | 'REJECTED',
  //     expires_at: ISO string | null,
  //     score_at_decision: number | null,
  //     investment_level_at_decision: number,
  //     source_path: 'f-selector:' + command,
  //     created_by: 'user',
  //   }
  // ---------------------------------------------------------------------
  const memEvent = navigation.logMemoryEvent(db, 'f_selector_decision', {
    decision,
    command,
    framework,
    reason,
    edge_semantic: edgeSemantic,
    expires_at: expiresAt,
    score_at_decision,
    investment_level_at_decision,
    source_path: 'f-selector:' + command,
    created_by: 'user',
  });
  if (!memEvent || !memEvent.ok) {
    return {
      ok: false,
      reason: 'memory_event_failed',
      detail: memEvent ? memEvent.reason : 'unknown',
    };
  }
  const decision_id = memEvent.eventId;

  // ---------------------------------------------------------------------
  // Step 2: write typed cascade edge via Plan 00's writeEdge primitive.
  // CONTEXT.md edge schemas:
  //   DEFERRED: {reason, decision_id, expires_at}
  //   REJECTED: {reason, decision_id}    (no expires_at)
  // ---------------------------------------------------------------------
  const edgeProps = (decision === 'defer')
    ? { reason, decision_id, expires_at: expiresAt }
    : { reason, decision_id };

  const edgeResult = navigation.writeEdge(db, {
    source_id: 'cmd:' + command,
    target_id: 'framework:' + framework,
    edge_type: edgeSemantic,
    properties: edgeProps,
  });

  if (!edgeResult || !edgeResult.ok) {
    return {
      ok: false,
      reason: 'edge_write_failed',
      detail: edgeResult ? edgeResult.reason : 'unknown',
    };
  }

  return {
    ok: true,
    decision_id,
    edge_id: edgeResult.edge_id,
  };
}

// ---------------------------------------------------------------------------
// _invocationsSinceDecision -- internal counter helper.
//
// Counts framework_invoked memory_event rows newer than the most recent
// f_selector_decision for this command. When roomState provides a pre-
// computed counter (test injection or upstream cache), prefer that --
// keeps applyDecayWeight pure for unit tests AND db-backed for production.
//
// Returns:
//   number (>= 0) when a decision is on record.
//   Infinity   when no decision is on record (no decay applies).
// ---------------------------------------------------------------------------
function _invocationsSinceDecision(db, command, roomState) {
  // Test seam: explicit pre-computed counter wins.
  if (roomState
      && roomState.invocationsSinceDecision
      && typeof roomState.invocationsSinceDecision[command] === 'number') {
    return roomState.invocationsSinceDecision[command];
  }
  if (!db) {
    // No db and no counter -> treat as no decision (return Infinity sentinel).
    return Infinity;
  }
  // Find the most recent f_selector_decision for this command.
  // findRecentChanges returns rows ordered by created_at DESC; we scan up to
  // 100 rows (the decision frequency is human-paced -- 100 is generous).
  const recent = navigation.findRecentChanges(db, 0, {
    eventType: 'f_selector_decision',
    limit: 100,
  });
  let lastDecisionAt = null;
  for (const row of recent) {
    if (row && row.properties && row.properties.command === command) {
      if (lastDecisionAt === null || row.createdAt > lastDecisionAt) {
        lastDecisionAt = row.createdAt;
      }
    }
  }
  if (lastDecisionAt === null) return Infinity; // no decision -> no decay
  // Count framework_invoked events strictly newer than lastDecisionAt.
  // findRecentChanges uses strict '>' on created_at per Phase 109.
  const invocations = navigation.findRecentChanges(db, lastDecisionAt, {
    eventType: 'framework_invoked',
    limit: 1000,
  });
  return invocations.length;
}

// ---------------------------------------------------------------------------
// applyDecayWeight -- D7 exponential decay reader.
//
// CONTEXT.md locked signature:
//   applyDecayWeight(base_score: number, command_id: string, roomState) -> number
//
// Pure when roomState supplies invocationsSinceDecision[command_id].
// Reads via navigation.findRecentChanges when db is on roomState.db.
//
// Decay formula:
//   factor = 1 - exp(-(n / DECAY_WINDOW))
//   adjusted = base_score * factor
//
// Edge cases:
//   - No decision recorded -> returns base_score unchanged.
//   - Non-finite or non-number base_score -> returns 0 (defensive).
//   - Null/undefined roomState -> returns base_score (no history = no decay).
// ---------------------------------------------------------------------------
function applyDecayWeight(base_score, command_id, roomState) {
  if (typeof base_score !== 'number' || !isFinite(base_score)) return 0;
  if (typeof command_id !== 'string' || command_id.length === 0) return base_score;
  const rs = (roomState && typeof roomState === 'object') ? roomState : {};
  const db = rs.db ? rs.db : null;
  const n = _invocationsSinceDecision(db, command_id, rs);
  if (n === Infinity) return base_score; // no decision recorded; no decay
  const factor = 1 - Math.exp(-(n / DECAY_WINDOW));
  return base_score * factor;
}

// ---------------------------------------------------------------------------
// shouldExclude -- RESEARCH G-09 helper.
//
// Plan 05 ranker may wire this to filter freshly-rejected commands from
// top-K entirely (when their decay factor is below EXCLUSION_THRESHOLD).
// Returns true when the command should be excluded; false otherwise.
// ---------------------------------------------------------------------------
function shouldExclude(command_id, roomState) {
  const rs = (roomState && typeof roomState === 'object') ? roomState : {};
  const db = rs.db ? rs.db : null;
  const n = _invocationsSinceDecision(db, command_id, rs);
  if (n === Infinity) return false;
  const factor = 1 - Math.exp(-(n / DECAY_WINDOW));
  return factor < EXCLUSION_THRESHOLD;
}

// ---------------------------------------------------------------------------
// Phase 125-07 -- D8 ranker-miss capture. Writes memory_event only (no edge --
// miss is temporal signal per CONTEXT.md D8 + RESEARCH G-10). Canon Part 8:
// user_intent is LOCAL-only; lives in room.db; never crosses to Brain.
// Consumer (F-selector renderer) is responsible for the follow-up /mos:do call;
// recordSelectorMiss never routes.
//
// CONTEXT.md locked signature:
//   recordSelectorMiss({top_k_offered, user_intent, roomState}) -> {miss_id}
//
// db handle is read from roomState.db per the locked design; callers populate
// roomState.db before invocation (mirrors recordSelectorDecision pattern).
//
// Returns {ok: true, miss_id} on success, or {ok: false, reason, detail?} on
// validation/write failure. Defensive -- never throws on caller input.
// ---------------------------------------------------------------------------
function recordSelectorMiss(args) {
  const o = args || {};
  const top_k_offered = o.top_k_offered;
  const user_intent = o.user_intent;
  const roomState = o.roomState || {};
  const db = roomState.db;

  // Validation gate (defensive; never throws). db check is first because
  // without it the chokepoint call would throw a more confusing error.
  if (!db) {
    return { ok: false, reason: 'invalid_db' };
  }
  if (!Array.isArray(top_k_offered)) {
    return { ok: false, reason: 'invalid_top_k_offered' };
  }
  if (typeof user_intent !== 'string' || user_intent.length === 0) {
    return { ok: false, reason: 'invalid_user_intent' };
  }

  // Sanitize top_k_offered: keep ONLY {command, score} fields. Defense-in-
  // depth so callers passing full RankedItem objects (with teaching /
  // jtbd_summary / why / source / framework / investment_level) don't
  // accidentally write those extra fields into the payload. The miss capture
  // is a tuning signal, not a snapshot of the full ranker output.
  const cleanOffered = top_k_offered
    .filter((x) => x && typeof x.command === 'string' && typeof x.score === 'number')
    .map((x) => ({ command: x.command, score: x.score }));

  const investment_level_at_decision =
    (typeof roomState.investment_level === 'number') ? roomState.investment_level : 0;

  // Write memory_event via the navigation chokepoint. NO cascade edge --
  // miss is a temporal signal per D8 (and the absence of an edge is what
  // makes recordSelectorMiss strictly weaker than recordSelectorDecision).
  // Canon Part 8: user_intent never leaves room.db; never crosses to Brain.
  const result = navigation.logMemoryEvent(db, 'f_selector_miss', {
    top_k_offered: cleanOffered,
    user_intent,
    investment_level_at_decision,
    source_path: 'f-selector:miss',
    created_by: 'user',
  });

  if (!result || !result.ok) {
    return {
      ok: false,
      reason: 'memory_event_failed',
      detail: result ? result.reason : 'unknown',
    };
  }

  return { ok: true, miss_id: result.eventId };
}

module.exports = {
  recordSelectorDecision,
  applyDecayWeight,
  shouldExclude,
  recordSelectorMiss,
  DECAY_WINDOW,
  EXCLUSION_THRESHOLD,
  DEFAULT_DEFER_EXPIRY_DAYS,
  // Test seam (private; consumed only by lib/memory/selector-decisions.test.cjs
  // + lib/memory/selector-miss.test.cjs).
  _test: {
    _invocationsSinceDecision,
    _defaultExpiresAt,
  },
};
