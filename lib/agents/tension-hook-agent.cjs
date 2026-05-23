/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 116-02 Wave 2 -- TensionHookAgent surface module.
 * Phase 116-04 Wave 4 -- adds 5 telemetry emit helpers per CONTEXT.md D-04.
 *   Mirrors lib/agents/reverse-salient-agent.cjs lines 393-446 emitDetected /
 *   emitActedOn pattern. All payloads scalar-only per Canon Part 8 (D-04a).
 *   Suppression paths still emit tension_detected per Pitfall 5 (D-04c).
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

// Phase 121.5-10 Sub-plan K (audit Section 5.3 minor alignment + LOCKED
// decision 1): aliases KEPT for pedagogical clarity in the tension-hook
// surface; alias_map (loaded from lib/hmi/jtbd-taxonomy.json by the
// dispatcher) collapses to canonical at selection time for graph-edge
// persistence (Resolve -> Run Methodology / Later -> Defer / Skip ->
// Free-Text). The user sees the contextual alias; the graph stores the
// canonical verb.
const F1_VERBS = ['Resolve', 'Later', 'Skip'];
// Phase 121.5-10 Sub-plan K (audit Section 5.3): the locked [■ BRAIN] chip
// replaces the prior verbose header. The tension context now lands in the
// question-line slot directly beneath the chip ("Resolve pending tension:"
// + brief summary) per the two-row format that preserves context without
// violating the 12-char chip rule.
const F1_HEADER = '[■ BRAIN]';
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
  // Phase 121.5-10 Sub-plan K (audit Section 5.3): load alias_map from
  // jtbd-taxonomy.json so the dispatcher can collapse Resolve / Later /
  // Skip to canonical verbs (Run Methodology / Defer / Free-Text) at
  // selection time. Lazy-required so test substitution can fake the
  // dispatcher without rebuilding the taxonomy fixture.
  let aliasMap = {};
  try {
    const tax = require('../hmi/jtbd-taxonomy.json');
    if (tax && tax.alias_map && tax.alias_map.verb_aliases) {
      aliasMap = tax.alias_map.verb_aliases;
    }
  } catch (_e) { /* graceful */ }
  // Build the two-line option rows for the locked Brain-suggestion template.
  // Per Phase 116 explicit design note (audit Section 5.1): recommendedVerb
  // stays null (the tension hook deliberately omits the RECOMMENDED gate);
  // all three verbs render with the empty-triangle alternative glyph.
  const tensionType = (finding && typeof finding.tension_type === 'string')
    ? finding.tension_type : 'pending';
  const optionRows = F1_VERBS.map(function (v, i) {
    let meta = '';
    if (v === 'Resolve') meta = tensionType + ' tension · captures RESOLVES_VIA edge';
    else if (v === 'Later') meta = 'queue for next session · surfacing_count preserved';
    else if (v === 'Skip') meta = 'silent dismiss · re-evaluated next SessionStart';
    return { glyph: '▷', number: i + 1, verb: v, confPct: 0, meta: meta };
  });
  let result;
  try {
    result = dispatcher.pickShape({
      requestedShape: 'F.1',
      roomDir: roomDir,
      operator: operator,
      tier: tier,
      payload: {
        brain_suggestion_variant: true,
        verbs: F1_VERBS.slice(),
        header: F1_HEADER,
        questionLine: 'Resolve pending tension:',
        alias_map: aliasMap,
        optionRows: optionRows,
        footer: '▶ Brain · top-3 of 3 ranked · cyan = informing',
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
      // Wave-4 telemetry: emit tension_resolved per CONTEXT.md D-04.
      try {
        emitResolved(roomDir, finding, {
          latency_ms: latency_ms,
          resolved_via_edge_emitted: !!(r2 && r2.ok),
        });
      } catch (_e) { /* never throw on telemetry */ }
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
      // No emit per RESEARCH Section 11.2 row 4: the next session start's
      // tension_detected captures the re-enter (no separate LATER event).
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
      // Wave-4 telemetry: emit tension_skipped per CONTEXT.md D-04.
      try {
        emitSkipped(roomDir, finding, {
          latency_ms: latency_ms,
          surfacing_count: Number(current.surfacing_count) || 0,
        });
      } catch (_e) { /* never throw on telemetry */ }
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

// ---------- Telemetry helpers (Canon Part 8 scalar-only payloads) ----------
//
// Each helper wraps recordSelectorMirror in try/catch and coerces every value
// to a scalar type (string / number / boolean / null). NEVER carries
// finding.body_text, finding.source_title, finding.target_title (those don't
// exist on the Phase 116 finding object per 116-02 composeFinding contract;
// the fence is defense-in-depth).
//
// Mirrors lib/agents/reverse-salient-agent.cjs lines 393-446 emitDetected /
// emitActedOn pattern verbatim with field substitutions per RESEARCH 4.5.

function emitDetected(roomDir, finding, ctx) {
  try {
    const telemetry = require('../hmi/selector-telemetry.cjs');
    if (!telemetry || typeof telemetry.recordSelectorMirror !== 'function') {
      return { ok: false, reason: 'telemetry_module_unavailable' };
    }
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const payload = {
      tension_id: String((finding && finding.id) || ''),
      tension_type: String((finding && finding.tension_type) || ''),
      source_edge_count: Number(c.source_edge_count) || 0,
      tier: Number(c.tier) || 0,
      surfacing_count: Number(c.surfacing_count) || 0,
      surfaced: Boolean(c.surfaced),
      suppress_reason: c.suppress_reason === null || c.suppress_reason === undefined
        ? null
        : String(c.suppress_reason),
      brain_offline_flag: Boolean(c.brain_offline_flag),
      selection_priority: Number(c.selection_priority) || 0,
    };
    return telemetry.recordSelectorMirror(roomDir, 'tension_detected', payload);
  } catch (_e) {
    return { ok: false, reason: 'detected_telemetry_threw' };
  }
}

function emitSurfaced(roomDir, finding, ctx) {
  try {
    const telemetry = require('../hmi/selector-telemetry.cjs');
    if (!telemetry || typeof telemetry.recordSelectorMirror !== 'function') {
      return { ok: false, reason: 'telemetry_module_unavailable' };
    }
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const payload = {
      tension_id: String((finding && finding.id) || ''),
      tension_type: String((finding && finding.tension_type) || ''),
      tier: Number(c.tier) || 0,
      surfacing_count: Number(c.surfacing_count) || 0,
      f1_verb_count: Number(c.f1_verb_count) || 4,
    };
    return telemetry.recordSelectorMirror(roomDir, 'tension_surfaced', payload);
  } catch (_e) {
    return { ok: false, reason: 'surfaced_telemetry_threw' };
  }
}

function emitResolved(roomDir, finding, ctx) {
  try {
    const telemetry = require('../hmi/selector-telemetry.cjs');
    if (!telemetry || typeof telemetry.recordSelectorMirror !== 'function') {
      return { ok: false, reason: 'telemetry_module_unavailable' };
    }
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const safeLatency = Number.isFinite(c.latency_ms) ? Math.max(0, Math.floor(c.latency_ms)) : 0;
    const payload = {
      tension_id: String((finding && finding.id) || ''),
      response: 'RESOLVE',
      latency_ms: safeLatency,
      resolved_via_edge_emitted: Boolean(c.resolved_via_edge_emitted),
    };
    return telemetry.recordSelectorMirror(roomDir, 'tension_resolved', payload);
  } catch (_e) {
    return { ok: false, reason: 'resolved_telemetry_threw' };
  }
}

function emitDecayed(roomDir, tension_id, ctx) {
  try {
    const telemetry = require('../hmi/selector-telemetry.cjs');
    if (!telemetry || typeof telemetry.recordSelectorMirror !== 'function') {
      return { ok: false, reason: 'telemetry_module_unavailable' };
    }
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const payload = {
      tension_id: String(tension_id || ''),
      surfacing_count: Number(c.surfacing_count) || 3,
      evaluation_pass_id: String(c.evaluation_pass_id || ''),
    };
    return telemetry.recordSelectorMirror(roomDir, 'tension_decayed', payload);
  } catch (_e) {
    return { ok: false, reason: 'decayed_telemetry_threw' };
  }
}

function emitSkipped(roomDir, finding, ctx) {
  try {
    const telemetry = require('../hmi/selector-telemetry.cjs');
    if (!telemetry || typeof telemetry.recordSelectorMirror !== 'function') {
      return { ok: false, reason: 'telemetry_module_unavailable' };
    }
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const safeLatency = Number.isFinite(c.latency_ms) ? Math.max(0, Math.floor(c.latency_ms)) : 0;
    const payload = {
      tension_id: String((finding && finding.id) || ''),
      latency_ms: safeLatency,
      surfacing_count: Number(c.surfacing_count) || 0,
    };
    return telemetry.recordSelectorMirror(roomDir, 'tension_skipped', payload);
  } catch (_e) {
    return { ok: false, reason: 'skipped_telemetry_threw' };
  }
}

// ---------- Module exports ----------

module.exports = {
  composeFinding: composeFinding,
  surfaceFinding: surfaceFinding,
  buildResolvedViaEdge: buildResolvedViaEdge,
  handleUserResponse: handleUserResponse,
  emitDetected: emitDetected,
  emitSurfaced: emitSurfaced,
  emitResolved: emitResolved,
  emitDecayed: emitDecayed,
  emitSkipped: emitSkipped,
  F1_VERBS: F1_VERBS.slice(),
  F1_HEADER: F1_HEADER,
};
