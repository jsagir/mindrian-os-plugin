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
    return {
      ok: false,
      reason: 'rs_engine_invocation_failed',
      detail: String((e && e.message) || '').slice(0, 120),
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
    return { ok: false, reason: rs.reason, findings: [] };
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

module.exports = {
  gatherFocusContext,
  gatherBrainContext,
  composeFinding,
  emitFindingEdge,
  mapDirectionToCascadeEdge,
  runRsEngine,
  detectAndSurface,
  // Internal helpers exposed for substrate tests; not part of the public API.
  _internal: { normalizePair, readPairField },
};
