/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 91-09 -- navigation-invariants validator.
 *
 * Registry-compatible drop-in for the Phase 88-13 guardian. Auto-loaded
 * by scripts/feynman-minto-guardian.cjs's loadValidators() walker; no
 * guardian.cjs edits required (extensibility promise of Phase 88-13
 * registry contract).
 *
 * Converts five silent Phase 91 navigation failure modes into first-class
 * health signals visible at session-start, on-stop, and pre-commit:
 *
 *   INV-1  trace_missing_field         every persisted decision_trace
 *                                      entry must carry all 8 Section 8
 *                                      brain_md_* fields per
 *                                      navigation-engine-brain-interface
 *                                      v1. Missing field -> error.
 *   INV-2  recommended_in_wrong_mode   RECOMMENDED marker may render only
 *                                      in mode_a (Canon Part 3 Section 6).
 *                                      Rendered in mode_b or tier_0 ->
 *                                      error.
 *   INV-3  weight_clamp_breach         brain_md_weight_applied must lie
 *                                      in [0.0, 1.0] inclusive. Out-of-
 *                                      range -> error.
 *   INV-4  trace_file_malformed        decision-traces/*.json that fails
 *                                      JSON.parse -> error. Sibling files
 *                                      continue to be scanned.
 *   INV-5  unknown_verb_passed         trace.fire_skill (when present)
 *                                      must be in CANONICAL_VERBS (Canon
 *                                      Part 3 frozen 10-verb vocabulary).
 *                                      Unknown -> warning. Graceful when
 *                                      shared module unavailable.
 *
 * Canon Part 8 (Graph Boundary): pure LOCAL reader. Reads only files
 * under <roomDir>/.mindrian/decision-traces/. Zero network surface; zero
 * Brain MCP queries; zero shell-out. Test 13 source-scans this file for
 * forbidden references.
 *
 * Canon Part 7 (Reuse Before Build): Phase 88-13 built the validator
 * registry for exactly this scenario. This file plugs in; guardian.cjs
 * stays untouched. Fail-open is inherited from the registry loader (a
 * malformed sibling validator never prevents this validator from running).
 *
 * Three-surface compatibility: pure CJS + node built-ins (fs, path).
 * Works identically on Claude Code CLI, Claude Desktop MCP, and Cowork
 * shared-room scenarios.
 *
 * Mode dispatch (set by guardian invocation):
 *   session-start  advisory; emitted to TRIPLE_CONTEXT footer.
 *   on-stop        advisory; aggregated into invariant-report.json.
 *   pre-commit     blocking at error/critical (guardian exits 2). This
 *                  validator just emits; guardian owns exit codes.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

// ---------- Constants ----------

const SEVERITY_MAP = Object.freeze({
  // 6 categories the validator emits, mapped to severities the guardian
  // aggregates. Phase 88-13 expects the shape (object); the guardian's
  // SEVERITY_ORDER alone owns numeric ordering.
  trace_missing_field: 'error',
  recommended_in_wrong_mode: 'error',
  weight_clamp_breach: 'error',
  unknown_verb_passed: 'warning',
  trace_file_malformed: 'error',
  session_file_absent: 'info',
});

// 8 Section 8 fields per .planning/research/navigation-engine-brain-
// interface.md v1. Order is documentation-stable; the validator does not
// rely on order, but the test suite reads this list defensively.
const REQUIRED_TRACE_FIELDS = Object.freeze([
  'brain_md_version',
  'brain_md_staleness',
  'brain_md_stale_reason',
  'brain_md_weight_applied',
  'brain_md_recommended_confidence',
  'brain_md_recommended_marker_rendered',
  'brain_md_tier_mode',
  'brain_md_sections_consumed',
]);

const VALID_TIER_MODES = Object.freeze(['mode_a', 'mode_b', 'tier_0']);
const ROOM_SCOPE = '__room__';

// ---------- Lazy CANONICAL_VERBS load (graceful degradation) ----------

let _canonicalVerbs = undefined; // undefined: not yet loaded; null: unavailable.
function getCanonicalVerbs() {
  if (_canonicalVerbs !== undefined) return _canonicalVerbs;
  try {
    const sharedPath = path.join(__dirname, '..', '..', 'core',
      'navigation-engine-shared.cjs');
    // Best-effort require. If the shared module fails to load (missing,
    // syntax error), fall back to null so INV-5 silently skips. Per the
    // plan: graceful degradation, not noisy failure.
    const mod = require(sharedPath);
    if (mod && Array.isArray(mod.CANONICAL_VERBS) && mod.CANONICAL_VERBS.length > 0) {
      _canonicalVerbs = mod.CANONICAL_VERBS;
    } else {
      _canonicalVerbs = null;
    }
  } catch (_) {
    _canonicalVerbs = null;
  }
  return _canonicalVerbs;
}

// ---------- Helpers ----------

function isFiniteNumber(n) {
  return typeof n === 'number' && isFinite(n);
}

function safeReadDir(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter(function (d) { return d.isFile() && /\.json$/i.test(d.name); })
      .map(function (d) { return d.name; })
      .sort();
  } catch (_) {
    return null; // sentinel: directory absent or unreadable
  }
}

function makeViolation(category, message, extras) {
  const sev = SEVERITY_MAP[category] || 'warning';
  const base = {
    validator: 'navigation-invariants',
    category: category,
    severity: sev,
    message: message,
    scope: ROOM_SCOPE,
  };
  if (extras && typeof extras === 'object') {
    return Object.assign(base, extras);
  }
  return base;
}

// ---------- Per-trace invariant checks ----------

/**
 * Check a single persisted trace entry for INV-1, INV-2, INV-3, INV-5.
 * Pushes violations into the supplied array. Each violation carries
 * session_id (when known) + turn (when known) so /mos:explain-decision
 * and the guardian footer can pinpoint the offending row.
 */
function checkTraceEntry(trace, sessionId, fileName, violations) {
  if (!trace || typeof trace !== 'object') return;
  const turn = (typeof trace.turn === 'number') ? trace.turn : null;
  const idCommon = {
    session_id: sessionId,
    file: fileName,
  };
  if (turn !== null) idCommon.turn = turn;

  // INV-1 trace_missing_field. Use hasOwnProperty so explicit `null` /
  // 0 / '' / false / [] do NOT trip the check (Section 8 sentinels are
  // valid values).
  for (const field of REQUIRED_TRACE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(trace, field)) {
      violations.push(makeViolation(
        'trace_missing_field',
        'decision_trace missing required Section 8 field "' + field +
          '" in session ' + sessionId +
          (turn !== null ? ' turn ' + turn : ''),
        Object.assign({ field: field, action_hint: 'review_decision_trace_emitter' },
          idCommon)
      ));
    }
  }

  // INV-2 recommended_in_wrong_mode. RECOMMENDED marker may render only
  // when tier_mode === 'mode_a' per Canon Part 3 Section 6.
  const rendered = trace.brain_md_recommended_marker_rendered;
  const tierMode = trace.brain_md_tier_mode;
  if (rendered === true && tierMode !== 'mode_a' &&
      VALID_TIER_MODES.indexOf(tierMode) !== -1) {
    violations.push(makeViolation(
      'recommended_in_wrong_mode',
      'RECOMMENDED marker rendered while tier_mode="' + tierMode +
        '" (Canon Part 3 Section 6 requires mode_a) in session ' +
        sessionId + (turn !== null ? ' turn ' + turn : ''),
      Object.assign({ tier_mode: tierMode, action_hint: 'audit_recommended_gate' },
        idCommon)
    ));
  }

  // INV-3 weight_clamp_breach. brain_md_weight_applied in [0.0, 1.0].
  const weight = trace.brain_md_weight_applied;
  if (isFiniteNumber(weight) && (weight < 0.0 || weight > 1.0)) {
    violations.push(makeViolation(
      'weight_clamp_breach',
      'brain_md_weight_applied=' + weight + ' outside [0.0, 1.0] in session ' +
        sessionId + (turn !== null ? ' turn ' + turn : ''),
      Object.assign({ weight_applied: weight, action_hint: 'enforce_clamp_at_emitter' },
        idCommon)
    ));
  }

  // INV-5 unknown_verb_passed. Only check when CANONICAL_VERBS available
  // AND fire_skill is a non-empty string (absent/null fire_skill is
  // valid: the engine emits null when no skill is recommended).
  const verbs = getCanonicalVerbs();
  if (verbs !== null && typeof trace.fire_skill === 'string' &&
      trace.fire_skill.length > 0 && verbs.indexOf(trace.fire_skill) === -1) {
    violations.push(makeViolation(
      'unknown_verb_passed',
      'fire_skill="' + trace.fire_skill +
        '" is not in Canon Part 3 vocabulary (10 frozen verbs) in session ' +
        sessionId + (turn !== null ? ' turn ' + turn : ''),
      Object.assign({ fire_skill: trace.fire_skill,
        action_hint: 'route_through_canonicalizeVerb' }, idCommon)
    ));
  }
}

// ---------- Main validate() ----------

function validateRoom(roomDir) {
  const violations = [];
  const tracesDir = path.join(roomDir, '.mindrian', 'decision-traces');
  const files = safeReadDir(tracesDir);

  if (files === null) {
    // INV: no decision-traces dir. This is the healthy fresh-room state;
    // surface as info so /mos:explain-decision telemetry has something
    // benign to report rather than a confusing silence.
    violations.push(makeViolation(
      'session_file_absent',
      'No decision traces recorded yet (fresh room or pre-engine state).',
      { action_hint: 'none' }
    ));
    return finalize(violations);
  }

  if (files.length === 0) {
    // Directory exists but is empty. Treat the same as absent for
    // signaling purposes.
    violations.push(makeViolation(
      'session_file_absent',
      'decision-traces directory present but contains no session files.',
      { action_hint: 'none' }
    ));
    return finalize(violations);
  }

  for (const fname of files) {
    const fullPath = path.join(tracesDir, fname);
    let raw;
    try {
      raw = fs.readFileSync(fullPath, 'utf8');
    } catch (e) {
      // Read failure is treated as malformed: the file exists but cannot
      // be processed. Continue to the next sibling.
      violations.push(makeViolation(
        'trace_file_malformed',
        'decision-traces file "' + fname + '" could not be read: ' +
          (e && e.message ? e.message : String(e)),
        { file: fname, action_hint: 'inspect_file_permissions' }
      ));
      continue;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      violations.push(makeViolation(
        'trace_file_malformed',
        'decision-traces file "' + fname + '" is not valid JSON: ' +
          (e && e.message ? e.message : String(e)),
        { file: fname, action_hint: 'rotate_or_remove_corrupt_trace' }
      ));
      continue;
    }
    if (!parsed || typeof parsed !== 'object') {
      violations.push(makeViolation(
        'trace_file_malformed',
        'decision-traces file "' + fname + '" did not parse to an object.',
        { file: fname, action_hint: 'rotate_or_remove_corrupt_trace' }
      ));
      continue;
    }
    const sessionId = (typeof parsed.session_id === 'string' &&
      parsed.session_id.length > 0) ? parsed.session_id : fname.replace(/\.json$/i, '');
    const traces = Array.isArray(parsed.traces) ? parsed.traces : [];
    for (const t of traces) {
      checkTraceEntry(t, sessionId, fname, violations);
    }
  }

  return finalize(violations);
}

function finalize(violations) {
  // Aggregate severity for guardian's per-validator summary line.
  const order = ['info', 'warning', 'error', 'critical'];
  let max = -1;
  for (const v of violations) {
    const i = order.indexOf(v.severity);
    if (i > max) max = i;
  }
  return {
    severity: max === -1 ? null : order[max],
    violations: violations,
  };
}

// ---------- Exports ----------

module.exports = {
  id: 'navigation-invariants',
  severity_map: SEVERITY_MAP,
  scope: 'room',
  validate: function (sectionDirOrRoomDir, ctx) {
    // Phase 88-13 contract: when scope === 'room' the guardian invokes
    // validate(roomDir, ctx). For defensive symmetry with the other
    // room-scoped validators (snapshot-integrity, queue-health,
    // stale-lifecycle), prefer ctx.roomDir when available.
    const roomDir = (ctx && typeof ctx.roomDir === 'string' && ctx.roomDir.length > 0)
      ? ctx.roomDir
      : sectionDirOrRoomDir;
    if (typeof roomDir !== 'string' || roomDir.length === 0) {
      return { severity: null, violations: [] };
    }
    return validateRoom(roomDir);
  },
  // Internal exports for tests (not part of the registry contract; the
  // guardian ignores extra keys):
  __internal: {
    REQUIRED_TRACE_FIELDS: REQUIRED_TRACE_FIELDS,
    VALID_TIER_MODES: VALID_TIER_MODES,
  },
};
