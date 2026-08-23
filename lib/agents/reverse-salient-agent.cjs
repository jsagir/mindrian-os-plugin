/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 89-07 Wave 1 -- ReverseSalientAgent substrate.
 *
 * Wraps scripts/rs-engine.py output as graph-native typed cascade edges via
 * the Phase 109 navigation chokepoint (5 read functions) + the Phase 90
 * BRAIN.md quadruple read (LOCAL only) + the Phase 87 typed-edge primitives
 * exposed by lib/core/lazygraph-ops.cjs (upsertEdge added Wave 1).
 *
 * Graph-native HARD RULE (memory feedback_reverse_salient_agent_graph_native.md):
 *   1. READS go through lib/core/navigation.cjs ONLY (no direct DB module).
 *   2. WRITES emit typed cascade edges (INFORMS, CONTRADICTS, CONVERGES,
 *      INVALIDATES, ENABLES) via the upsertEdge primitive.
 *   3. BRAIN reads via folder-memory.readQuadruple ONLY (Canon Part 8 LOCAL
 *      pre-derived; the agent never queries Brain at runtime).
 *   4. NO direct DB module imports (Phase 109 D-06 chokepoint).
 *   5. NO Brain client imports (Canon Part 8 -- zero Brain queries from agent).
 *   6. NEVER reimplement rs-math in Node -- shell out to scripts/rs-engine.py.
 *
 * F.0 dispatch + persona suffix + telemetry mirror land in Wave 2 (89-07-02).
 * Pattern doc + release plumbing land in Wave 3 (89-07-03).
 *
 * Pure CJS, node built-ins only, zero new runtime dependencies.
 */

'use strict';

const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

// ---------- Whitelisted imports (Canon Part 8) ----------
//
// Allowed:
//   - lib/core/navigation.cjs                  (Phase 109 chokepoint)
//   - lib/core/folder-memory.cjs                (Phase 90 LOCAL Brain read)
//   - lib/core/navigation/memory-events.cjs     (Phase 109 logEvent)
//   - lib/core/lazygraph-ops.cjs                (Phase 87 typed-edge primitives)
//   - node:child_process                        (rs-engine.py invocation)
//   - node:path / node:fs / node:crypto         (built-ins)
//
// Forbidden (anti-pattern grep guards in tests):
//   - direct DB module imports (chokepoint violation)
//   - direct Brain client imports (Canon Part 8 violation)
//   - rs-math vectorization symbols (rs-math reimplementation)
const navigation = require('../core/navigation.cjs');
const folderMemory = require('../core/folder-memory.cjs');
// memory-events kept as a lazy import in detectAndSurface to avoid coupling
// the substrate test to logEvent semantics; Wave 2 will wire it for real.

// ---------- Cascade-edge mapping (RESEARCH SCOPE B Section 2) ----------
//
// Maps the rs-engine output `direction` field (NOT the invocation mode) to
// one of the 5 typed cascade edges. The mapping basis is documented in the
// 89-07-01-PLAN.md graph_native_invariant_check section: direction is the
// OUTPUT FIELD describing the actual finding kind; mode is a CALL PARAMETER.
//
//   structural_transfer + abs(signed_diff) <= 0.7 -> INFORMS
//   structural_transfer + abs(signed_diff) >  0.7 -> ENABLES
//   semantic_implementation + abs(sd) <= 0.7      -> CONVERGES
//   semantic_implementation + abs(sd) >  0.7      -> INVALIDATES
//   whitespace / blindspot                        -> CONTRADICTS
//   anything else (Pitfall 1 default)             -> INFORMS
function mapDirectionToCascadeEdge(direction, signed_diff) {
  const sd = (typeof signed_diff === 'number') ? signed_diff : 0;
  const dir = (typeof direction === 'string') ? direction : '';
  if (dir === 'structural_transfer') {
    return Math.abs(sd) > 0.7 ? 'ENABLES' : 'INFORMS';
  }
  if (dir === 'semantic_implementation') {
    return Math.abs(sd) > 0.7 ? 'INVALIDATES' : 'CONVERGES';
  }
  if (dir === 'whitespace' || dir === 'blindspot') {
    return 'CONTRADICTS';
  }
  // Pitfall 1 default: unknown direction string maps to INFORMS rather than
  // throwing, so a forward-compatible rs-engine output (Plan 89-04 / 89-05
  // adding new direction values) does not crash the agent.
  return 'INFORMS';
}

// ---------- Phase 109 navigation reads (chokepoint adherence) ----------
//
// gatherFocusContext composes the 5 navigation.cjs functions used by the
// agent. Returns null when there is no active focus, so callers can skip
// finding generation gracefully. Never throws.
function gatherFocusContext(db, sessionId) {
  try {
    const focus = navigation.getActiveFocus(db, sessionId);
    if (!focus) return null;
    const neighborhood = navigation.getNeighborhood(db, focus.focusNodeId, {
      maxDepth: 2,
      topK: 20,
      edgeTypes: ['CONTRADICTS', 'INVALIDATES', 'CASCADES_TO', 'INFORMS'],
    });
    const contradictions = navigation.findContradictions(db, focus.focusNodeId);
    const unsupported = navigation.findUnsupportedClaims(db);
    const stale = navigation.findStaleDecisions(db, { staleAfterSessions: 5 });
    const sevenDaysAgo = Date.now() - (7 * 24 * 3600 * 1000);
    const recentChanges = navigation.findRecentChanges(db, sevenDaysAgo, { limit: 50 });
    return { focus, neighborhood, contradictions, unsupported, stale, recentChanges };
  } catch (_e) {
    // Defensive: if any navigation function throws (e.g. db schema not yet
    // initialized in a fresh tmp room), the agent surfaces no finding rather
    // than crashing. Wave 2 will wire telemetry on this path.
    return null;
  }
}

// ---------- Phase 90 BRAIN.md quadruple read (LOCAL only; Canon Part 8) ----------
//
// gatherBrainContext returns one of three shapes:
//   { brain: <payload>, graceful_degradation: null }      -- fresh
//   { brain: null,      graceful_degradation: 'stale_or_offline' }
//   { brain: null,      graceful_degradation: 'no_quadruple' }
//
// Never throws. The agent NEVER queries Brain at runtime; the brain payload
// surfaced here was written by a prior /mos:brain-derive run (Phase 90).
function gatherBrainContext(sectionPath) {
  try {
    const quadruple = folderMemory.readQuadruple(sectionPath);
    if (!quadruple) return { brain: null, graceful_degradation: 'no_quadruple' };
    if (!folderMemory.isQuadrupleFresh(quadruple)) {
      return { brain: null, graceful_degradation: 'stale_or_offline' };
    }
    return { brain: quadruple.brain || null, graceful_degradation: null };
  } catch (_e) {
    return { brain: null, graceful_degradation: 'no_quadruple' };
  }
}

// ---------- Schema-tolerant rs-engine reader (Pitfall 7 forward-compat) ----------
//
// readPairField + normalizePair accept canonical field names AND known
// alternates so the agent can consume rs-engine output across Plans 89-01
// (Mode A) / 89-04 (Mode B) / 89-05 (Mode C) without re-edits.
function readPairField(pair, primary, fallback) {
  if (pair && Object.prototype.hasOwnProperty.call(pair, primary)) return pair[primary];
  if (fallback && pair && Object.prototype.hasOwnProperty.call(pair, fallback)) return pair[fallback];
  return undefined;
}

function normalizePair(pair) {
  const p = (pair && typeof pair === 'object') ? pair : {};
  return {
    source_artifact_id: readPairField(p, 'source_artifact_id'),
    source_section: readPairField(p, 'source_section'),
    source_title: readPairField(p, 'source_title'),
    target_artifact_id: readPairField(p, 'target_artifact_id'),
    target_section: readPairField(p, 'target_section'),
    target_title: readPairField(p, 'target_title'),
    signed_diff: readPairField(p, 'signed_diff', 'signed_delta'),
    abs_diff: readPairField(p, 'abs_diff'),
    direction: readPairField(p, 'direction', 'innovation_type'),
    lsa_score: readPairField(p, 'lsa_score'),
    semantic_score: readPairField(p, 'semantic_score'),
  };
}

// ---------- rs-engine.py invocation (HARD RULE 6: never reimplement math) ----------
//
// Shells out to scripts/rs-engine.py via child_process.execFileSync, then
// reads the JSON results file the script writes. Returns:
//   { ok: true,  pairs: [<normalized pair>...] }
//   { ok: false, reason: <string>,             pairs: [] }
//
// Reasons surfaced (for graceful Wave-2 telemetry mirroring):
//   - invalid_room_dir
//   - rs_engine_invocation_failed
//   - rs_engine_results_missing
//   - rs_engine_results_parse_failed
function runRsEngine(opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  const roomDir = o.roomDir;
  const mode = (typeof o.mode === 'string') ? o.mode : 'internal';
  if (typeof roomDir !== 'string' || roomDir.length === 0) {
    return { ok: false, reason: 'invalid_room_dir', pairs: [] };
  }
  const py = process.env.MINDRIAN_PYTHON || 'python3';
  const script = path.join(__dirname, '..', '..', 'scripts', 'rs-engine.py');
  const args = ['--mode', mode, '--room', roomDir];
  if (o.topk) args.push('--topk', String(o.topk));
  if (o.no_thesis) args.push('--no-thesis');
  try {
    execFileSync(py, [script].concat(args), {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60000,
    });
  } catch (e) {
    // Phase 127.2-03 Task 1 (Finding F2): forward the child python process's
    // stderr LAST 200 chars to result.detail.diagnostic so callers can
    // self-recover from missing-deps / import errors (the Windows tester
    // 2026-05-23 silent-failure class). Truncate at the START so the tail
    // (which carries the exception name + actionable fix line printed by
    // rs_corpus -- e.g. "Run: pip install -r requirements-hsi.txt") is the
    // half that survives the cap. Backward compatible: ok / reason / detail
    // (e.message) unchanged; detail upgraded from plain string to object
    // ONLY when stderr is present, so legacy callers reading detail as a
    // string still get the truncated message via detail.message.
    const message = String((e && e.message) || '').slice(0, 120);
    const stderrRaw = (e && e.stderr) ? String(e.stderr) : '';
    const diagnostic = stderrRaw.length > 200 ? stderrRaw.slice(-200) : stderrRaw;
    const detail = stderrRaw.length > 0
      ? { message: message, diagnostic: diagnostic }
      : message;
    return {
      ok: false,
      reason: 'rs_engine_invocation_failed',
      detail: detail,
      pairs: [],
    };
  }
  const resultsPath = path.join(roomDir, '.rs-engine-results.json');
  if (!fs.existsSync(resultsPath)) {
    return { ok: false, reason: 'rs_engine_results_missing', pairs: [] };
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  } catch (_e) {
    return { ok: false, reason: 'rs_engine_results_parse_failed', pairs: [] };
  }
  const pairs = (raw && Array.isArray(raw.pairs)) ? raw.pairs.map(normalizePair) : [];
  return { ok: true, pairs };
}

// ---------- Compose finding (deterministic id for idempotent re-fires) ----------
//
// finding.id = first 32 chars of sha256(source_artifact_id|target_artifact_id|direction).
// Same pair + same direction across runs = same id. The cascade-edge upsert
// in emitFindingEdge is itself idempotent (ON CONFLICT in the SQL); the
// deterministic id is for external referents (telemetry, F.0 dispatch links,
// downstream cascade traces) per Pitfall 6 in 89-07-RESEARCH.md.
function composeFinding(args) {
  const a = (args && typeof args === 'object') ? args : {};
  const pair = a.pair || {};
  const idBasis =
    String(pair.source_artifact_id) +
    '|' +
    String(pair.target_artifact_id) +
    '|' +
    String(pair.direction);
  const id = crypto.createHash('sha256').update(idBasis).digest('hex').slice(0, 32);
  const brain = (a.brainContext && a.brainContext.brain) || null;
  const chainText = (brain && Array.isArray(brain.framework_chain_predictions))
    ? brain.framework_chain_predictions.slice(0, 3).join(' -> ')
    : '';
  const sourceLabel = String(pair.source_title || pair.source_artifact_id || '?')
    + ' (' + String(pair.source_section || '?') + ')';
  const targetLabel = String(pair.target_title || pair.target_artifact_id || '?')
    + ' (' + String(pair.target_section || '?') + ')';
  const body_text =
    sourceLabel +
    ' is lagging relative to ' +
    targetLabel +
    ' [signed_diff=' + String(pair.signed_diff) +
    ', abs_diff=' + String(pair.abs_diff) + ']';
  return {
    id,
    source_artifact_id: pair.source_artifact_id,
    target_artifact_id: pair.target_artifact_id,
    direction: pair.direction,
    signed_diff: pair.signed_diff,
    abs_diff: pair.abs_diff,
    body_text,
    brain_chain_text: chainText,
  };
}

// ---------- Emit cascade edge on user APPROVE ----------
//
// On APPROVE, calls lazygraph-ops.upsertEdge with the mapped cascade type.
// REJECT and DEFER paths are skip-stubs; the F.0 dispatcher (Wave 2) writes
// REJECTED_BECAUSE / DEFERRED edges along its own path so this helper does
// NOT duplicate.
//
// upsertEdge is loaded lazily so test-reverse-salient-cascade-emit.cjs can
// substitute the lazygraph-ops module in require.cache before the agent's
// first emit call. The lazy require pattern is per-call inside this function.
function emitFindingEdge(db, finding, userResponse) {
  if (userResponse !== 'APPROVE') {
    const reason =
      userResponse === 'REJECT' ? 'rejected_handled_by_f0_dispatcher' :
      userResponse === 'DEFER' ? 'deferred_handled_by_f0_dispatcher' :
      'unknown_response_skipped';
    return { skipped: true, reason };
  }
  if (!finding || typeof finding !== 'object') {
    return { ok: false, reason: 'invalid_finding' };
  }
  const edgeType = mapDirectionToCascadeEdge(finding.direction, finding.signed_diff);
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
  try {
    const result = lazygraph.upsertEdge(db, {
      type: edgeType,
      source: finding.source_artifact_id,
      target: finding.target_artifact_id,
      properties: {
        source: 'rs-engine',
        agent: 'reverse-salient',
        signed_diff: finding.signed_diff,
        abs_diff: finding.abs_diff,
        finding_id: finding.id,
      },
    });
    return { ok: true, edgeType, result };
  } catch (e) {
    return {
      ok: false,
      reason: 'edge_emit_threw',
      detail: String((e && e.message) || '').slice(0, 80),
    };
  }
}

// ---------- High-level surface (Wave 2 wires F.0 + persona + telemetry) ----------
//
// detectAndSurface composes runRsEngine -> gatherFocusContext ->
// gatherBrainContext -> composeFinding for the top-k pairs. Wave 2 will wrap
// this with a surfaceFinding helper that fires the F.0 dispatcher with
// persona-aware framing and mirrors the selector_presentation /
// selector_response telemetry events.
function detectAndSurface(args) {
  const a = (args && typeof args === 'object') ? args : {};
  const rs = runRsEngine({
    roomDir: a.roomDir,
    mode: a.mode || 'internal',
    topk: a.topk,
    no_thesis: a.no_thesis,
  });
  if (!rs.ok) {
    // Phase 127.2-03 (Finding F2) contract: runRsEngine() populates `detail`
    // (message + truncated stderr diagnostic) specifically so callers can
    // self-recover from missing-deps / import / schema errors. This early
    // return used to drop it, silently regressing F2 one call-frame up from
    // where it was fixed (RCA rs-engine-python-insert-not-null-and-detail-
    // drop-regression). Forward it unchanged.
    return { ok: false, reason: rs.reason, detail: rs.detail, findings: [] };
  }
  const focusContext = a.db ? gatherFocusContext(a.db, a.sessionId) : null;
  const sectionPath = a.sectionPath || a.roomDir;
  const brainContext = gatherBrainContext(sectionPath);
  const limit = (typeof a.topk === 'number' && a.topk > 0) ? a.topk : 1;
  const findings = rs.pairs.slice(0, limit).map((pair) =>
    composeFinding({ pair, focusContext, brainContext })
  );
  return { ok: true, findings, focusContext, brainContext };
}

// =====================================================================
// Phase 89-07 Wave 2 -- F.0 dispatch + persona suffix + telemetry mirror.
// =====================================================================
//
// Wave 2 wires the Wave-1 substrate to:
//   - lib/hmi/selector-dispatcher.cjs (88.2-04+05 pickShape -> F.0)
//   - lib/hmi/shape-f0-renderer.cjs (88.2-05 buildRejectedBecauseEdge)
//   - lib/hmi/selector-telemetry.cjs (88.2-03 recordSelectorMirror dual-surface)
//   - lib/core/reverse-salient-persona-suffix.cjs (Wave-2 7-key persona map)
//
// Imports use lazy require inside helpers so tests can substitute the
// require.cache slot before the agent's first call. Pattern matches Wave-1
// emitFindingEdge lazy-require for lazygraph-ops.

// ---------- Resolve persona key + suffix from role_blend ----------
//
// resolvePersonaKey returns the canonical role key chosen for telemetry
// (e.g. 'founder', 'researcher', 'default'). resolvePersonaSuffix wraps
// the persona-suffix module's suffixFor() with a try/catch fence so a
// broken module load can never bring down the agent.
function resolvePersonaKey(roleBlend) {
  try {
    const personaSuffix = require('../core/reverse-salient-persona-suffix.cjs');
    if (!roleBlend || typeof roleBlend !== 'object') return 'default';
    const keys = Object.keys(roleBlend)
      .filter((k) => personaSuffix.CANONICAL_KEYS.indexOf(k) !== -1)
      .sort();
    let best = null;
    let bestWeight = 0;
    for (const k of keys) {
      const w = roleBlend[k];
      if (typeof w === 'number' && Number.isFinite(w) && w > bestWeight) {
        best = k;
        bestWeight = w;
      }
    }
    return (best && bestWeight > 0) ? best : 'default';
  } catch (_e) {
    return 'default';
  }
}

function resolvePersonaSuffix(roleBlend) {
  try {
    const personaSuffix = require('../core/reverse-salient-persona-suffix.cjs');
    return personaSuffix.suffixFor(roleBlend);
  } catch (_e) {
    return 'lagging component';
  }
}

// ---------- Telemetry helpers (Canon Part 8 scalar-only payloads) ----------
//
// emitDetected fires the reverse_salient_detected memory_event. The payload
// carries 9 scalar fields per Canon Part 8 audit. Suppression paths (tier 0,
// JUST_TALK, dispatcher error) STILL fire this event with surfaced=false +
// suppress_reason set (Pitfall 5).
//
// emitActedOn fires the reverse_salient_acted_on memory_event. The payload
// carries 4 scalar fields. The reject reason TEXT never appears -- only
// reason_present (boolean). The reject reason text lives in the
// REJECTED_BECAUSE typed edge written by buildRejectedBecauseEdge.
function emitDetected(roomDir, finding, ctx) {
  try {
    const telemetry = require('../hmi/selector-telemetry.cjs');
    if (!telemetry || typeof telemetry.recordSelectorMirror !== 'function') {
      return { ok: false, reason: 'telemetry_module_unavailable' };
    }
    const payload = {
      finding_id: String(finding && finding.id || ''),
      direction: String(finding && finding.direction || ''),
      abs_diff: Number(finding && finding.abs_diff) || 0,
      signed_diff: Number(finding && finding.signed_diff) || 0,
      tier: Number(ctx.tier) || 0,
      persona_key: String(ctx.persona_key || 'default'),
      surfaced: Boolean(ctx.surfaced),
      suppress_reason: ctx.suppress_reason === null || ctx.suppress_reason === undefined
        ? null
        : String(ctx.suppress_reason),
      brain_offline_flag: Boolean(ctx.brain_offline_flag),
    };
    return telemetry.recordSelectorMirror(roomDir, 'reverse_salient_detected', payload);
  } catch (_e) {
    return { ok: false, reason: 'detected_telemetry_threw' };
  }
}

function emitActedOn(roomDir, finding, response, latency_ms, reason_present) {
  try {
    const telemetry = require('../hmi/selector-telemetry.cjs');
    if (!telemetry || typeof telemetry.recordSelectorMirror !== 'function') {
      return { ok: false, reason: 'telemetry_module_unavailable' };
    }
    const safeLatency = Number.isFinite(latency_ms) ? Math.max(0, Math.floor(latency_ms)) : 0;
    const payload = {
      finding_id: String(finding && finding.id || ''),
      response: String(response || ''),
      latency_ms: safeLatency,
      reason_present: Boolean(reason_present),
    };
    return telemetry.recordSelectorMirror(roomDir, 'reverse_salient_acted_on', payload);
  } catch (_e) {
    return { ok: false, reason: 'acted_telemetry_threw' };
  }
}

// ---------- Wave-2 surfaceFinding (the F.0 dispatch surface) ----------
//
// Routes every Wave-1 finding through the F.0 Mini Decision Gate via the
// 88.2-04+05 dispatcher. Honors the 4 canonical refuse paths:
//   - tier === 0          -> suppress + telemetry suppress_reason='tier_0'
//   - operator JUST_TALK  -> suppress + telemetry suppress_reason='just_talk'
//   - dispatcher error    -> suppress + telemetry suppress_reason=<dispatch_err>
//   - tier>=1 non-JT      -> F.0 surface fires; telemetry surfaced=true
//
// Persona suffix from role_blend goes into the F.0 header per RESEARCH
// SCOPE B Section 6. parent_decision_id = 'rs-finding:' + finding.id ties
// the dispatched surface to the deterministic Wave-1 finding id (Pitfall 6).
//
// GRAPH-NATIVE INVARIANT 4 (89-07-VALIDATION.md): F.0 surface fires for
// accept/reject/defer. This function is the entry point that proves it.
function surfaceFinding(args) {
  const a = (args && typeof args === 'object') ? args : {};
  const finding = a.finding || {};
  const roomDir = a.roomDir;
  const tier = (typeof a.tier === 'number') ? a.tier : 1;
  const operator = (typeof a.operator === 'string' && a.operator.length > 0) ? a.operator : null;
  const roleBlend = a.roleBlend || null;
  const personaKey = resolvePersonaKey(roleBlend);
  const personaSuffixText = resolvePersonaSuffix(roleBlend);
  const brainOfflineFlag = Boolean(a.brainOfflineFlag);
  const parentDecisionId = 'rs-finding:' + String(finding.id || '');

  // Suppression check 1: tier 0 -- short-circuit pre-dispatch.
  if (tier === 0) {
    emitDetected(roomDir, finding, {
      tier: tier,
      persona_key: personaKey,
      surfaced: false,
      suppress_reason: 'tier_0',
      brain_offline_flag: brainOfflineFlag,
    });
    return { surfaced: false, suppress_reason: 'tier_0' };
  }

  // Suppression check 2: JUST_TALK operator -- short-circuit pre-dispatch.
  // Per Canon Part 3 + render-v2 step 6, JUST_TALK suppresses ALL selector
  // output. The dispatcher itself would also refuse; we short-circuit
  // earlier to avoid a wasted pickShape() call and to record the more
  // semantic suppress_reason='just_talk' (vs the dispatcher's
  // 'render_v2_compaction_violation' error code).
  if (operator === 'JUST_TALK') {
    emitDetected(roomDir, finding, {
      tier: tier,
      persona_key: personaKey,
      surfaced: false,
      suppress_reason: 'just_talk',
      brain_offline_flag: brainOfflineFlag,
    });
    return { surfaced: false, suppress_reason: 'just_talk' };
  }

  // Phase 121.5-10 Sub-plan K (audit Section 5.3): the locked [■ BRAIN]
  // chip replaces the prior `-- mindrianOS -- reverse salient -- <persona>
  // --` header. The persona suffix (Phase 89-07 extension via
  // resolvePersonaSuffix) moves into the body slot directly beneath the
  // chip so the two-row chip+context format preserves the persona signal
  // without violating the 12-char chip rule. F.0 closed vocabulary
  // (Approve / Reject / Defer) STAYS verbatim per the F.0 specification
  // (no RECOMMENDED in F.0; the shape itself is the recommendation
  // surface). The body composition (persona + body_text + framework chain)
  // continues to render in zones.body via the F.0 renderer.
  const header = '[■ BRAIN]';
  const bodyText = String(finding.body_text || '');
  const chainText = String(finding.brain_chain_text || '');
  const personaLine = personaSuffixText && personaSuffixText.length > 0
    ? '(' + personaSuffixText + ' lens)\n\n' : '';
  const body = personaLine + bodyText + (chainText.length > 0 ? '\n\nFramework chain: ' + chainText : '');

  // Dispatch via the canonical 88.2-04+05 pickShape entry point.
  // emitTelemetry:false because the agent owns the dual-surface mirror via
  // emitDetected/emitActedOn. The dispatcher's own JSONL telemetry is
  // separate from the agent's memory_event telemetry per D-AMEND-02.
  let dispatchResult;
  try {
    const dispatcher = require('../hmi/selector-dispatcher.cjs');
    dispatchResult = dispatcher.pickShape({
      requestedShape: 'F.0',
      roomDir: roomDir,
      operator: operator,
      tier: tier,
      payload: {
        header: header,
        body: body,
        parent_decision_id: parentDecisionId,
        emitTelemetry: false,
      },
    });
  } catch (e) {
    const reason = 'dispatch_threw:' + String((e && e.message) || '').slice(0, 40);
    emitDetected(roomDir, finding, {
      tier: tier,
      persona_key: personaKey,
      surfaced: false,
      suppress_reason: reason,
      brain_offline_flag: brainOfflineFlag,
    });
    return { surfaced: false, suppress_reason: reason };
  }

  // Dispatcher returned an error envelope -> record suppression with the
  // dispatcher's error string as the suppress_reason.
  if (dispatchResult && dispatchResult.shape === 'error') {
    const reason = (dispatchResult.rendered && dispatchResult.rendered.error)
      ? String(dispatchResult.rendered.error)
      : 'dispatch_failed';
    emitDetected(roomDir, finding, {
      tier: tier,
      persona_key: personaKey,
      surfaced: false,
      suppress_reason: reason,
      brain_offline_flag: brainOfflineFlag,
    });
    return { surfaced: false, suppress_reason: reason };
  }

  // F.0 surfaced successfully.
  emitDetected(roomDir, finding, {
    tier: tier,
    persona_key: personaKey,
    surfaced: true,
    suppress_reason: null,
    brain_offline_flag: brainOfflineFlag,
  });
  return {
    surfaced: true,
    suppress_reason: null,
    dispatchResult: dispatchResult,
    parent_decision_id: parentDecisionId,
    surfaceStartedAtMs: Date.now(),
    persona_key: personaKey,
  };
}

// ---------- Wave-2 handleUserResponse (post-F.0 graph wiring) ----------
//
// APPROVE -> emitFindingEdge (Wave-1 cascade emit) + reverse_salient_acted_on.
// REJECT  -> buildRejectedBecauseEdge (88.2-05) with reason + parent_decision_id
//            + reverse_salient_acted_on (reason_present:true; reason text
//            stays in the REJECTED_BECAUSE edge, never in telemetry).
// DEFER   -> reverse_salient_acted_on with response='DEFER' for Phase 116
//            unresolved-tension-hook consumption.
//
// All three paths produce a typed graph artifact (cascade edge or
// REJECTED_BECAUSE event or acted_on event). Canon Part 4 invariant: every
// choice is graph data; zero silent dismiss paths.
function handleUserResponse(args) {
  const a = (args && typeof args === 'object') ? args : {};
  const finding = a.finding || {};
  const roomDir = a.roomDir;
  const userResponse = a.userResponse;
  const reason = (typeof a.reason === 'string' && a.reason.length > 0) ? a.reason : null;
  const surfaceStartedAtMs = Number.isFinite(a.surfaceStartedAtMs) ? a.surfaceStartedAtMs : Date.now();
  const latency_ms = Date.now() - surfaceStartedAtMs;
  const parentDecisionId = 'rs-finding:' + String(finding.id || '');

  if (userResponse === 'APPROVE') {
    // Cascade edge writes via Wave-1 emitFindingEdge (the lazygraph primitive
    // chain). Tests pass `db: null` -> we record acted_on but skip the edge
    // emit, surfacing { deferred_db: true } so the test can assert telemetry
    // independently of the SQL substrate.
    let edgeResult = { ok: true, deferred_db: true };
    if (a.db) {
      edgeResult = emitFindingEdge(a.db, finding, 'APPROVE');
    }
    emitActedOn(roomDir, finding, 'APPROVE', latency_ms, false);
    return {
      handled: true,
      response: 'APPROVE',
      edgeResult: edgeResult,
      latency_ms: latency_ms,
    };
  }

  if (userResponse === 'REJECT') {
    let edgeResult = { ok: false, reason: 'f0_renderer_unavailable' };
    try {
      const f0Renderer = require('../hmi/shape-f0-renderer.cjs');
      if (f0Renderer && typeof f0Renderer.buildRejectedBecauseEdge === 'function') {
        edgeResult = f0Renderer.buildRejectedBecauseEdge({
          roomDir: roomDir,
          reason: reason || 'no_reason_provided',
          parent_decision_id: parentDecisionId,
        });
      }
    } catch (e) {
      edgeResult = {
        ok: false,
        reason: 'reject_edge_threw',
        detail: String((e && e.message) || '').slice(0, 80),
      };
    }
    emitActedOn(roomDir, finding, 'REJECT', latency_ms, Boolean(reason));
    return {
      handled: true,
      response: 'REJECT',
      edgeResult: edgeResult,
      latency_ms: latency_ms,
    };
  }

  if (userResponse === 'DEFER') {
    // DEFERRED memory_event for Phase 116 unresolved-tension-hook consumption.
    // The reverse_salient_acted_on event with response='DEFER' is the
    // canonical signal Phase 116 reads (per RESEARCH cross-phase wiring).
    emitActedOn(roomDir, finding, 'DEFER', latency_ms, false);
    return {
      handled: true,
      response: 'DEFER',
      latency_ms: latency_ms,
    };
  }

  return {
    handled: false,
    reason: 'unknown_user_response',
  };
}

module.exports = {
  // Wave-1 substrate exports preserved.
  gatherFocusContext,
  gatherBrainContext,
  composeFinding,
  emitFindingEdge,
  mapDirectionToCascadeEdge,
  runRsEngine,
  detectAndSurface,
  // Wave-2 additions.
  surfaceFinding,
  handleUserResponse,
  resolvePersonaKey,
  resolvePersonaSuffix,
  emitDetected,
  emitActedOn,
  // Internal helpers exposed for substrate tests; not part of the public API.
  _internal: { normalizePair, readPairField },
};
