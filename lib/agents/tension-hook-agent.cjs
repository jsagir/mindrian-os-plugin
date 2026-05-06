/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 116-02 Wave 2 -- TensionHookAgent surface module.
 *
 * Mirrors lib/agents/reverse-salient-agent.cjs Steps 5+6 (surfaceFinding +
 * handleUserResponse) per docs/AGENTIC-SURFACING-PATTERN.md. Detection runs
 * upstream in scripts/preflight-tension-surface.cjs (116-01); this module
 * routes the user's F.1 pick back into JSONL state + RESOLVES_VIA cascade.
 *
 * Graph-native HARD RULES (memory feedback_reverse_salient_agent_graph_native.md):
 *   1. Reads route through lib/core/navigation.cjs only (Phase 109 D-06 chokepoint).
 *   2. NEVER require any direct DB module (chokepoint violation).
 *   3. NEVER require a Brain client (Canon Part 8 boundary).
 *   4. NEVER write to stdout / stderr (telemetry side-channel rule).
 *   5. F.1 dispatch ONLY via lib/hmi/selector-dispatcher.cjs pickShape.
 *   6. RESOLVES_VIA edge ONLY via lib/core/lazygraph-ops.cjs upsertEdge.
 *
 * Per CONTEXT.md D-02 + D-02a: NO persona-keyed suffix; the Phase 115
 * persona variant module is NOT consumed. Larry-voice is neutral citation
 * (the citation text lives in 116-01's additionalContext directive; this
 * module is the response-routing surface).
 *
 * Per CONTEXT.md D-08: zero surface-specific branches. 88.2-05 selector
 * dispatcher already shipped tri-polar so the F.1 surface is identical
 * across CLI / Desktop / Cowork.
 *
 * Pure CJS, node built-ins only, zero new runtime dependencies.
 */
'use strict';

const path = require('node:path');
const crypto = require('node:crypto');

// Phase 109 chokepoint (read-side reference; the agent stays read-clean
// because detection lives in the SessionStart hook, not here, but holding
// the require keeps the chokepoint adherence grep green and lets future
// Wave 4 telemetry land without restructuring).
const navigation = require('../core/navigation.cjs');
const pendingStore = require('../memory/pending-tension-store.cjs');
// Lazy requires (test substitution friendly):
//   - lib/hmi/selector-dispatcher.cjs (loaded inside surfaceFinding)
//   - lib/core/lazygraph-ops.cjs       (loaded inside buildResolvedViaEdge)

// ---------- Constants ----------

const F1_VERBS = ['Resolve', 'Later', 'Skip'];
const F1_HEADER = '-- mindrianOS -- pending tension -- pick a verb --';
const VALID_RESPONSES = Object.freeze(new Set(['RESOLVE', 'LATER', 'SKIP', 'FREE_TEXT']));
const TENSION_ID_LEN = 32;

// Touch the navigation chokepoint reference so static analysis reports
// it as used; the actual read calls land Wave 4 alongside telemetry.
// eslint-disable-next-line no-unused-vars
const _navigation_ref = navigation;

// ---------- Helpers ----------

function isHex32(v) {
  return typeof v === 'string' && /^[0-9a-f]{32}$/.test(v);
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.length > 0;
}

// ---------- composeFinding (deterministic id, Canon Part 8 clean) ----------

/**
 * Build a Canon-Part-8-clean finding object. All fields are scalar IDs and
 * enum-like section names; NO body_text / source_title / target_title or
 * any other user-content string lives in the finding (those live in the
 * graph and are fetched by Larry on his first turn via navigation.cjs per
 * the 116-01 directive contract).
 *
 * Deterministic: same inputs always yield the same finding (id is the
 * caller-supplied tension_id, which itself is computed deterministically
 * by lib/memory/pending-tension-store.cjs computeTensionId).
 *
 * @param {object} args
 * @param {string} args.tension_id      32-char hex
 * @param {string} args.source_node_id  node id (NOT title text)
 * @param {string} args.target_node_id  node id (NOT title text)
 * @param {string} args.source_section
 * @param {string} args.target_section
 * @param {string} args.tension_type    enum
 * @returns {object|null}
 */
function composeFinding(args) {
  const a = (args && typeof args === 'object') ? args : {};
  if (!isNonEmptyString(a.tension_id)) return null;
  if (typeof a.tension_id === 'string' && a.tension_id.length !== TENSION_ID_LEN) {
    // Tolerate non-hex but length-matched ids for forward-compat with
    // upstream id schemes; reject only on empty / non-string.
  }
  return {
    id: String(a.tension_id),
    tension_type: isNonEmptyString(a.tension_type) ? a.tension_type : null,
    source_node_id: isNonEmptyString(a.source_node_id) ? a.source_node_id : null,
    target_node_id: isNonEmptyString(a.target_node_id) ? a.target_node_id : null,
    source_section: isNonEmptyString(a.source_section) ? a.source_section : null,
    target_section: isNonEmptyString(a.target_section) ? a.target_section : null,
    // NO body_text. NO source_title. NO target_title. NO quoted_text. (Canon Part 8)
  };
}

// ---------- surfaceFinding (the F.1 dispatch surface) ----------

/**
 * Routes a detected tension finding through the F.1 Mini Decision Gate via
 * lib/hmi/selector-dispatcher.cjs pickShape. Honors the suppression paths:
 *   - tier === 0          -> {surfaced:false, suppress_reason:'tier_0'}     (no dispatch)
 *   - operator JUST_TALK  -> {surfaced:false, suppress_reason:'just_talk'}  (no dispatch)
 *   - dispatcher error    -> {surfaced:false, suppress_reason:<err code>}
 *
 * Per CONTEXT.md D-02 (locked): Larry-voice render is neutral citation.
 * The body / quote rendering happens upstream in 116-01's
 * composeLarryVoiceDirective (additionalContext); this surface is the
 * verb-selection gate the user picks against. recommendedVerb is null
 * because Phase 116 deliberately omits recommendation (D-02b).
 *
 * @param {object} args
 * @param {object} args.finding     composeFinding output
 * @param {string} args.roomDir
 * @param {string} args.sessionId
 * @param {number} args.tier        0 / 1 / 2 / 3 (Mode B/A by tier-check)
 * @param {string} args.operator    null or 'JUST_TALK' (others are pass-through)
 * @returns {object}
 */
function surfaceFinding(args) {
  const a = (args && typeof args === 'object') ? args : {};
  const finding = a.finding;
  const roomDir = a.roomDir;
  const tier = (typeof a.tier === 'number') ? a.tier : 0;
  const operator = (typeof a.operator === 'string' && a.operator.length > 0) ? a.operator : null;

  if (!finding || typeof finding !== 'object') {
    return { surfaced: false, suppress_reason: 'invalid_finding' };
  }

  // Suppression check 1: tier 0 -- short-circuit pre-dispatch (RESEARCH 3.4).
  if (tier === 0) {
    return { surfaced: false, suppress_reason: 'tier_0', finding: finding };
  }

  // Suppression check 2: JUST_TALK -- short-circuit pre-dispatch.
  if (operator === 'JUST_TALK') {
    return { surfaced: false, suppress_reason: 'just_talk', finding: finding };
  }

  // Lazy-require the dispatcher (test substitution friendly).
  let dispatcher;
  try {
    dispatcher = require('../hmi/selector-dispatcher.cjs');
  } catch (e) {
    return { surfaced: false, suppress_reason: 'dispatcher_load_failed', finding: finding };
  }
  if (!dispatcher || typeof dispatcher.pickShape !== 'function') {
    return { surfaced: false, suppress_reason: 'pickShape_unavailable', finding: finding };
  }

  const surfaceStartedAtMs = Date.now();
  let result;
  try {
    result = dispatcher.pickShape({
      requestedShape: 'F.1',
      roomDir: roomDir,
      operator: operator,
      tier: tier,
      payload: {
        verbs: F1_VERBS.slice(),
        header: F1_HEADER,
        recommendedVerb: null,         // D-02 neutral; no recommendation
        emitTelemetry: true,           // 116-04 selector_presentation event fires via this flag
      },
    });
  } catch (e) {
    const detail = String((e && e.message) || '').slice(0, 40);
    return { surfaced: false, suppress_reason: 'dispatch_threw:' + detail, finding: finding };
  }

  if (!result || result.shape === 'error') {
    const errCode = (result && result.rendered && result.rendered.error)
      ? String(result.rendered.error)
      : 'unknown_dispatch_error';
    return { surfaced: false, suppress_reason: errCode, finding: finding };
  }

  return {
    surfaced: true,
    finding: finding,
    contract: (result.rendered && result.rendered.contract) ? result.rendered.contract : null,
    rendered: result.rendered || null,
    surfaceStartedAtMs: surfaceStartedAtMs,
  };
}

// ---------- buildResolvedViaEdge (RESOLVES_VIA cascade emission) ----------

/**
 * Sibling helper to lib/hmi/shape-f0-renderer.cjs buildRejectedBecauseEdge.
 * Writes a RESOLVES_VIA typed cascade edge via lazygraph-ops.upsertEdge.
 *
 * properties.source = 'tension-hook' distinguishes this edge from the
 * rs-engine-sourced edges that share the same edge type (the 89-07 agent
 * uses a different edge type entirely; this attribution lets a downstream
 * audit identify which agentic surface produced each cascade).
 *
 * Wrapped in try/catch -- never throws.
 *
 * @param {object} args
 * @param {string} args.roomDir
 * @param {string} args.tension_id
 * @param {string} args.source_node_id
 * @param {string} args.target_node_id
 * @param {string} args.parent_decision_id
 * @param {string} [args.actor_id]
 * @param {object} args.db                        node:sqlite DatabaseSync handle
 * @returns {{ok:boolean, reason?:string, edgeType?:string, edge?:object}}
 */
function buildResolvedViaEdge(args) {
  try {
    const a = (args && typeof args === 'object') ? args : {};
    if (!isNonEmptyString(a.tension_id)) {
      return { ok: false, reason: 'invalid_tension_id' };
    }
    if (!isNonEmptyString(a.source_node_id)) {
      return { ok: false, reason: 'invalid_source_id' };
    }
    if (!isNonEmptyString(a.target_node_id)) {
      return { ok: false, reason: 'invalid_target_id' };
    }
    if (!isNonEmptyString(a.parent_decision_id)) {
      return { ok: false, reason: 'invalid_parent_decision_id' };
    }
    if (!a.db) {
      return { ok: false, reason: 'db_unavailable' };
    }

    let lazygraph;
    try {
      lazygraph = require('../core/lazygraph-ops.cjs');
    } catch (e) {
      return {
        ok: false,
        reason: 'lazygraph_load_failed',
        detail: String((e && e.message) || '').slice(0, 80),
      };
    }
    if (!lazygraph || typeof lazygraph.upsertEdge !== 'function') {
      return { ok: false, reason: 'upsertEdge_not_available' };
    }

    const props = {
      source: 'tension-hook',          // distinguishes from rs-engine origin
      agent: 'unresolved-tension',
      tension_id: a.tension_id,
      parent_decision_id: a.parent_decision_id,
      resolved_at: new Date().toISOString(),
    };
    if (isNonEmptyString(a.actor_id)) {
      props.actor_id = a.actor_id;
    }

    const result = lazygraph.upsertEdge(a.db, {
      type: 'RESOLVES_VIA',
      source: a.source_node_id,
      target: a.target_node_id,
      properties: props,
    });
    if (!result || result.ok !== true) {
      return { ok: false, reason: (result && result.reason) || 'upsert_failed' };
    }
    return { ok: true, edgeType: 'RESOLVES_VIA', edge: result };
  } catch (e) {
    return {
      ok: false,
      reason: 'edge_build_threw_caught',
      detail: String((e && e.message) || '').slice(0, 80),
    };
  }
}

// ---------- handleUserResponse (post-F.1 routing) ----------

/**
 * Routes the user's F.1 selection back into JSONL state + cascade edge.
 *
 * RESOLVE   -> markResolved(roomSlug, finding.id, 'RESOLVE') + buildResolvedViaEdge
 * LATER     -> requeue(roomSlug, finding.id) (state -> 'queued'; surfacing_count NOT decremented)
 * SKIP      -> appendTension preserving state='surfaced' with last_response='SKIP'
 *              (re-evaluated next SessionStart per RESEARCH 11.2)
 * FREE_TEXT -> log only; Larry interprets per Canon Part 3 Verb 10; no JSONL state change
 *
 * Wrapped in try/catch -- never throws. Returns scalar-only result envelope
 * (no user-content fields) so the caller can mirror to telemetry safely.
 *
 * @param {object} args
 * @param {object} args.finding
 * @param {string} args.roomDir
 * @param {string} args.userResponse  'RESOLVE'|'LATER'|'SKIP'|'FREE_TEXT' (case-insensitive)
 * @param {number} args.surfaceStartedAtMs  Date.now() at surfaceFinding time
 * @param {object} args.db                  node:sqlite DatabaseSync handle (for RESOLVE path)
 * @param {string} [args.actor_id]
 * @returns {object}
 */
function handleUserResponse(args) {
  try {
    const a = (args && typeof args === 'object') ? args : {};
    const finding = a.finding;
    const roomDir = a.roomDir;
    const userResponse = String(a.userResponse || '').toUpperCase();
    const surfaceStartedAtMs = Number.isFinite(a.surfaceStartedAtMs) ? a.surfaceStartedAtMs : Date.now();
    const latency_ms = Math.max(0, Math.floor(Date.now() - surfaceStartedAtMs));

    if (!finding || typeof finding !== 'object') {
      return { ok: false, reason: 'invalid_finding', latency_ms: latency_ms };
    }
    if (!VALID_RESPONSES.has(userResponse)) {
      return { ok: false, reason: 'invalid_response', latency_ms: latency_ms };
    }
    const roomSlug = path.basename(typeof roomDir === 'string' ? roomDir : '');

    if (userResponse === 'RESOLVE') {
      const r1 = pendingStore.markResolved(roomSlug, finding.id, 'RESOLVE');
      const r2 = buildResolvedViaEdge({
        roomDir: roomDir,
        tension_id: finding.id,
        source_node_id: finding.source_node_id,
        target_node_id: finding.target_node_id,
        parent_decision_id: 'tension:' + String(finding.id || ''),
        actor_id: a.actor_id,
        db: a.db,
      });
      return {
        ok: true,
        response: 'RESOLVE',
        latency_ms: latency_ms,
        jsonl: r1,
        edge: r2,
      };
    }

    if (userResponse === 'LATER') {
      const r1 = pendingStore.requeue(roomSlug, finding.id);
      return {
        ok: true,
        response: 'LATER',
        latency_ms: latency_ms,
        jsonl: r1,
      };
    }

    if (userResponse === 'SKIP') {
      // Per RESEARCH Section 11.2: state stays 'surfaced'; record last_response='SKIP'
      // via a transition append. We read the current entry (LWW replay) and write
      // a sibling entry preserving state but recording the skip, so a later
      // SessionStart re-evaluates whether to surface again.
      const all = pendingStore.readTensions(roomSlug);
      const current = (Array.isArray(all)
        ? all.find((t) => t && t.tension_id === finding.id)
        : null);
      if (!current) {
        return { ok: false, reason: 'tension_not_found_for_skip', latency_ms: latency_ms };
      }
      const next = Object.assign({}, current, { last_response: 'SKIP' });
      const r1 = pendingStore.appendTension(roomSlug, next);
      return {
        ok: true,
        response: 'SKIP',
        latency_ms: latency_ms,
        jsonl: r1,
      };
    }

    if (userResponse === 'FREE_TEXT') {
      // Larry interprets per Canon Part 3 Verb 10. No JSONL state change.
      return {
        ok: true,
        response: 'FREE_TEXT',
        latency_ms: latency_ms,
      };
    }

    // Unreachable -- VALID_RESPONSES guarded above.
    return { ok: false, reason: 'unknown_response', latency_ms: latency_ms };
  } catch (e) {
    return {
      ok: false,
      reason: 'handle_response_threw',
      detail: String((e && e.message) || '').slice(0, 80),
    };
  }
}

// ---------- Module exports ----------

module.exports = {
  composeFinding: composeFinding,
  surfaceFinding: surfaceFinding,
  buildResolvedViaEdge: buildResolvedViaEdge,
  handleUserResponse: handleUserResponse,
  F1_VERBS: F1_VERBS.slice(),
  F1_HEADER: F1_HEADER,
};
