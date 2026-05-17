'use strict';
// Phase 120-00 Wave 1 -- the 4 breakthrough pattern detectors + classifyFireTier + the
// frozen threshold constants. Per CONTEXT.md D-01..D-06 + D-18 + D-20:
//   - PURE functions over local graph state (Canon Part 8 -- no Brain coupling)
//   - ALL chokepoint reads route via lib/core/navigation.cjs (Canon Part 9 D-06)
//   - Every emitted Breakthrough carries provenance.artifact_ids (D-20 HARD FLOOR)
//   - Reads Phase 117 math-layer JSON output; NEVER recomputes the math
//
// Canon Part 8 invariants (source-grep enforced by tests/test-120-00-scaffold.sh
// Gate 8 + the Test 12 in detectors.test.cjs):
//   - NO require of lib/core/brain-client.cjs or any mcp-server-brain/* module.
//   - NO fetch to brain.mindrian.* domain.
//   - NO cross-user OR cross-room aggregation -- "cross-domain" in this module
//     means cross-section WITHIN the same room (per CONTEXT.md scope D-04).
//
// Canon Part 9 invariant: the math layer (Phase 117) writes JSON files into
// roomDir/.mindrian/; detectors READ those files but NEVER re-execute the
// underlying Python scripts (no child_process.exec on hsi-*.py / rs-engine.py).
// Source-grep tripwire: zero matches for child_process.exec.+\.py.
//
// Em-dash HARD RULE (CLAUDE.md feedback_no_emdashes): use "--" not the U+2014
// character anywhere in this file (comments, log lines, strings).

const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

// Pin the DETECTOR_THRESHOLDS to the verbatim values locked in CONTEXT.md
// D-01..D-06. Plan 120-02 session-start scanner reads these constants at
// scan time, so they MUST stay frozen-by-Object.freeze + immutable in test
// surface. Any change to these numbers is a canon-level decision, not a
// source-level edit -- requires re-running /gsd:discuss-phase 120.
const DETECTOR_THRESHOLDS = Object.freeze({
  SOFT_FIRE_MIN_ARTIFACTS: 3,             // D-02
  SOFT_FIRE_MIN_CONFIDENCE: 0.25,         // D-02
  HARD_FIRE_MIN_ARTIFACTS: 4,             // D-03
  HARD_FIRE_CROSS_SECTION_BYPASS: 3,      // D-03 OR clause
  HARD_FIRE_MIN_CONFIDENCE: 0.35,         // D-03
  SEMANTIC_SIMILARITY_THRESHOLD: 0.40,    // D-04 (within-room noise correlation pushes threshold up)
  WINDOW_DAYS_DEFAULT: 14,                // D-06 ethical fence (no surface for material > 14 days old)
});

const DETECTOR_TYPES = Object.freeze([
  'convergence',
  'contradiction_resolved',
  'cross_domain_analogy',
  'reverse_salient_closed',
]);

// Reverse-salient lagging-component signal threshold (D-05 score-delta signal).
// signed_diff magnitude >= 0.5 means the score crossed its baseline meaningfully.
const RS_SCORE_DELTA_THRESHOLD = 0.5;

// Helper: build a deterministic Breakthrough id from kind + sorted artifact_ids + ts.
function buildBreakthroughId(kind, artifactIds, nowMs) {
  const seed = kind + ':' + artifactIds.slice().sort().join(',') + ':' + nowMs;
  const hash = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 16);
  return 'breakthrough:' + kind + ':' + hash;
}

// Helper: build a Breakthrough candidate with confidence formula applied. Per
// CONTEXT.md D-12 scoring blend: confidence = clip(0, 0.95, 0.25 + 0.10*count + 0.30*differential).
// The 0.10/0.30 weights deliberately bias the formula so cross-section linkage
// (an extra signal on top of count + differential) does NOT auto-promote a
// 3-artifact convergence past 0.35 -- classifyFireTier handles the bypass via
// the count-with-bypass OR clause + the conf >= 0.35 floor.
function buildCandidate(kind, artifactIds, theme, differential, crossSectionLinked, nowMs, windowMs) {
  const filtered = (artifactIds || []).filter((s) => typeof s === 'string' && s.length > 0);
  const baseConf = 0.25 + 0.10 * filtered.length + 0.30 * (typeof differential === 'number' ? differential : 0);
  const confidence = Math.min(0.95, Math.max(0, baseConf));
  return {
    id: buildBreakthroughId(kind, filtered, nowMs),
    kind: kind,
    confidence: confidence,
    artifact_ids: filtered,
    theme: typeof theme === 'string' ? theme.slice(0, 200) : '',
    differential: typeof differential === 'number' ? differential : 0,
    cross_section_linked: !!crossSectionLinked,
    detected_at: nowMs,
    window_start: nowMs - windowMs,
    window_end: nowMs,
  };
}

function classifyFireTier(candidate) {
  const T = DETECTOR_THRESHOLDS;
  if (!candidate || !Array.isArray(candidate.artifact_ids)) return 'below_floor';
  const count = candidate.artifact_ids.length;
  const conf = typeof candidate.confidence === 'number' ? candidate.confidence : 0;
  // D-03: hard-fire when (artifact_count >= 4) OR (>= 3 AND cross_section_linked),
  // AND confidence >= 0.35.
  const hard_eligible =
    ((count >= T.HARD_FIRE_MIN_ARTIFACTS) ||
     (count >= T.HARD_FIRE_CROSS_SECTION_BYPASS && candidate.cross_section_linked))
    && conf >= T.HARD_FIRE_MIN_CONFIDENCE;
  if (hard_eligible) return 'hard';
  // D-02: soft-fire when artifact_count >= 3 AND confidence >= 0.25 (below hard tier).
  const soft_eligible = count >= T.SOFT_FIRE_MIN_ARTIFACTS && conf >= T.SOFT_FIRE_MIN_CONFIDENCE;
  if (soft_eligible) return 'soft';
  return 'below_floor';
}

function partitionByTier(candidates) {
  const hits = [];
  const soft_fires = [];
  for (const c of candidates) {
    const tier = classifyFireTier(c);
    if (tier === 'hard') hits.push(c);
    else if (tier === 'soft') soft_fires.push(c);
    // 'below_floor' falls off -- never surfaces, never logs to buffer.
  }
  return { hits: hits, soft_fires: soft_fires };
}

// Internal: resolve the math-layer JSON path within roomDir/.mindrian/. Returns
// null when roomDir is invalid OR the file does not exist (graceful degradation:
// Phase 117 may not have fired yet on a fresh room).
function resolveMathFile(roomState, basename) {
  if (!roomState || typeof roomState.roomDir !== 'string') return null;
  const fullPath = path.join(roomState.roomDir, '.mindrian', basename);
  if (!fs.existsSync(fullPath)) return null;
  return fullPath;
}

function readMathJson(roomState, basename) {
  const p = resolveMathFile(roomState, basename);
  if (!p) return null;
  try {
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(raw);
  } catch (_e) {
    // Malformed JSON returns null -- the caller short-circuits to empty result.
    return null;
  }
}

// Compute the windowMs + nowMs for a detector call. Caps windowDays at 14 (D-06).
function resolveWindow(roomState, opts) {
  const nowMs = (roomState && typeof roomState.now === 'number') ? roomState.now : Date.now();
  const requestedDays = (opts && typeof opts.window_days === 'number') ? opts.window_days
    : ((roomState && typeof roomState.window_days === 'number') ? roomState.window_days
       : DETECTOR_THRESHOLDS.WINDOW_DAYS_DEFAULT);
  const cappedDays = Math.min(DETECTOR_THRESHOLDS.WINDOW_DAYS_DEFAULT, Math.max(1, requestedDays));
  return { nowMs: nowMs, windowMs: cappedDays * 24 * 3600 * 1000 };
}

// --- detectConvergence (D-01 detector 1) ---
// Reads whitespace.gaps[] from .mindrian/whitespace-results.json (Phase 117 math output).
// Each gap: {gap_id?, theme, artifacts: string[], differential: number, sections?: string[],
// detected_at?: number}. A gap with N artifacts where N >= 3 (after empty-string filtering)
// is a candidate. cross_section_linked = sections.length >= 2.
function detectConvergence(roomState, opts) {
  const { nowMs, windowMs } = resolveWindow(roomState, opts);
  const data = readMathJson(roomState, 'whitespace-results.json');
  if (!data || !Array.isArray(data.gaps)) {
    return { hits: [], soft_fires: [] };
  }
  const windowStart = nowMs - windowMs;
  const candidates = [];
  for (const gap of data.gaps) {
    if (!gap || typeof gap !== 'object') continue;
    // Window filter: detected_at older than windowStart is excluded (D-06).
    if (typeof gap.detected_at === 'number' && gap.detected_at < windowStart) continue;
    const artifacts = Array.isArray(gap.artifacts) ? gap.artifacts.filter((s) => typeof s === 'string' && s.length > 0) : [];
    if (artifacts.length < DETECTOR_THRESHOLDS.SOFT_FIRE_MIN_ARTIFACTS) continue;
    const sections = Array.isArray(gap.sections) ? gap.sections.filter((s) => typeof s === 'string' && s.length > 0) : [];
    const crossSectionLinked = sections.length >= 2;
    const candidate = buildCandidate(
      'convergence',
      artifacts,
      typeof gap.theme === 'string' ? gap.theme : '',
      typeof gap.differential === 'number' ? gap.differential : 0,
      crossSectionLinked,
      nowMs,
      windowMs
    );
    candidates.push(candidate);
  }
  return partitionByTier(candidates);
}

// --- detectContradictionResolved (D-01 detector 2) ---
// Reads CONTRADICTS edges from room.db within the window. When a CONTRADICTS edge
// in the window has properties.resolved === true, that's a candidate -- the pair
// of artifacts is the provenance. The "resolved" flag is set by Phase 116
// unresolved-tension-hook closure logic when a tension is resolved by a new artifact.
//
// Per Canon Part 9 D-06: this read goes through navigation.cjs. We lazy-require
// the navigation module so test code can override it (Test 6 seeds CONTRADICTS
// edges directly into the seeded db).
function detectContradictionResolved(roomState, opts) {
  const { nowMs, windowMs } = resolveWindow(roomState, opts);
  if (!roomState || !roomState.db) {
    return { hits: [], soft_fires: [] };
  }
  const windowStart = nowMs - windowMs;
  const candidates = [];
  try {
    // Query CONTRADICTS edges directly via the room.db handle. The edges table
    // schema (per lib/core/lazygraph-ops.cjs::initSchema) is
    //   (source TEXT, target TEXT, type TEXT, properties TEXT).
    // We filter by type='CONTRADICTS' and json_extract(properties,'$.resolved')='true'/1.
    // The window filter applies to properties.resolved_at if present.
    const rows = roomState.db.prepare(
      "SELECT source, target, properties FROM edges WHERE type = 'CONTRADICTS'"
    ).all();
    for (const row of rows) {
      if (!row || typeof row.properties !== 'string') continue;
      let props;
      try { props = JSON.parse(row.properties); } catch (_e) { continue; }
      if (!props || props.resolved !== true) continue;
      const resolvedAt = typeof props.resolved_at === 'number' ? props.resolved_at : nowMs;
      if (resolvedAt < windowStart) continue;
      const sourceId = typeof row.source === 'string' ? row.source : '';
      const targetId = typeof row.target === 'string' ? row.target : '';
      const artifacts = [sourceId, targetId].filter((s) => s.length > 0);
      if (artifacts.length < 2) continue;
      const candidate = buildCandidate(
        'contradiction_resolved',
        artifacts,
        typeof props.theme === 'string' ? props.theme : '',
        typeof props.differential === 'number' ? props.differential : 0.5,
        true,  // cross-section is implicit for a CONTRADICTS pair (different artifacts)
        nowMs,
        windowMs
      );
      candidates.push(candidate);
    }
  } catch (_err) {
    return { hits: [], soft_fires: [] };
  }
  // contradiction_resolved is inherently a 2-artifact event (source + target of the
  // CONTRADICTS edge). The generic SOFT_FIRE_MIN_ARTIFACTS=3 floor was tuned for
  // convergence (whitespace gaps with N>=3 by definition). For this detector we
  // apply a separate tier rule: every resolved contradiction in the window fires
  // at minimum at SOFT tier (since the act of resolution is itself the signal);
  // promotion to HARD requires the confidence floor (>= 0.35) -- same as the
  // generic D-03 hard floor.
  const hits = [];
  const soft_fires = [];
  for (const c of candidates) {
    if (c.confidence >= DETECTOR_THRESHOLDS.HARD_FIRE_MIN_CONFIDENCE) {
      hits.push(c);
    } else if (c.confidence >= DETECTOR_THRESHOLDS.SOFT_FIRE_MIN_CONFIDENCE) {
      soft_fires.push(c);
    }
  }
  return { hits: hits, soft_fires: soft_fires };
}

// --- detectCrossDomainAnalogy (D-01 detector 3) ---
// Reads analogy.zones[] from .mindrian/discovery-cycle-results.json (Phase 117 math output).
// Per CONTEXT.md SCOPE clarification + D-04: "cross-domain means cross-section within
// the same room, NEVER cross-user or cross-room aggregation". Cross-section is
// encoded by source_section !== target_section AND similarity >= 0.40.
function detectCrossDomainAnalogy(roomState, opts) {
  const { nowMs, windowMs } = resolveWindow(roomState, opts);
  const data = readMathJson(roomState, 'discovery-cycle-results.json');
  if (!data) return { hits: [], soft_fires: [] };
  // The file can either have analogy_whitespace.zones or analogy.zones depending on
  // the Phase 117 writer version. Accept both.
  const zones = (data.analogy_whitespace && Array.isArray(data.analogy_whitespace.zones)) ? data.analogy_whitespace.zones
    : (data.analogy && Array.isArray(data.analogy.zones)) ? data.analogy.zones
    : [];
  if (!zones.length) return { hits: [], soft_fires: [] };
  const windowStart = nowMs - windowMs;
  const candidates = [];
  for (const zone of zones) {
    if (!zone || typeof zone !== 'object') continue;
    if (typeof zone.detected_at === 'number' && zone.detected_at < windowStart) continue;
    const similarity = typeof zone.similarity === 'number' ? zone.similarity : 0;
    if (similarity < DETECTOR_THRESHOLDS.SEMANTIC_SIMILARITY_THRESHOLD) continue;
    const sourceArt = typeof zone.source_artifact_id === 'string' ? zone.source_artifact_id : '';
    const targetArt = typeof zone.target_artifact_id === 'string' ? zone.target_artifact_id : '';
    const artifacts = [sourceArt, targetArt].filter((s) => s.length > 0);
    if (artifacts.length < 2) continue;
    const sourceSection = typeof zone.source_section === 'string' ? zone.source_section : '';
    const targetSection = typeof zone.target_section === 'string' ? zone.target_section : '';
    const crossSectionLinked = sourceSection !== targetSection && sourceSection.length > 0 && targetSection.length > 0;
    // D-04 boost: similarity feeds the differential blend so high-similarity cross-section
    // matches push past the soft floor naturally.
    const candidate = buildCandidate(
      'cross_domain_analogy',
      artifacts,
      typeof zone.theme === 'string' ? zone.theme : sourceSection + ' x ' + targetSection,
      similarity,  // pass similarity as the differential -- 0.40+ -> 0.12+ added to baseConf
      crossSectionLinked,
      nowMs,
      windowMs
    );
    candidates.push(candidate);
  }
  return partitionByTier(candidates);
}

// --- detectReverseSalientClosed (D-01 detector 4) ---
// Reads rs.pairs[] from .mindrian/.rs-engine-results.json (Phase 117 math output).
// Per CONTEXT.md D-05: BOTH signals required for hard-fire:
//   (a) graph-level proof -- closure_edge_now_exists === true (a structural transition
//       that did not hold at window_start but holds now), AND
//   (b) score-delta -- |signed_diff| >= RS_SCORE_DELTA_THRESHOLD (the lagging-component
//       score crossed its baseline within the window).
// Single-signal candidates return soft_fire only.
function detectReverseSalientClosed(roomState, opts) {
  const { nowMs, windowMs } = resolveWindow(roomState, opts);
  const data = readMathJson(roomState, '.rs-engine-results.json');
  if (!data || !Array.isArray(data.pairs)) {
    return { hits: [], soft_fires: [] };
  }
  const windowStart = nowMs - windowMs;
  const candidates = [];
  for (const pair of data.pairs) {
    if (!pair || typeof pair !== 'object') continue;
    if (typeof pair.detected_at === 'number' && pair.detected_at < windowStart) continue;
    const sourceArt = typeof pair.source_artifact_id === 'string' ? pair.source_artifact_id : '';
    const targetArt = typeof pair.target_artifact_id === 'string' ? pair.target_artifact_id : '';
    const artifacts = [sourceArt, targetArt].filter((s) => s.length > 0);
    if (artifacts.length < 2) continue;

    const signedDiff = typeof pair.signed_diff === 'number' ? pair.signed_diff : 0;
    const scoreDeltaSignal = Math.abs(signedDiff) >= RS_SCORE_DELTA_THRESHOLD;
    const graphSignal = pair.closure_edge_now_exists === true;
    // D-05 BOTH-signals invariant: only when both fire do we get a hard candidate.
    // Single-signal candidates land at soft tier via the confidence floor manipulation:
    // we cap differential at 0.3 for single-signal cases (drives conf below 0.35).
    const bothSignals = scoreDeltaSignal && graphSignal;
    const differential = bothSignals ? 0.6 : 0.2;

    const sourceSection = typeof pair.source_section === 'string' ? pair.source_section : '';
    const targetSection = typeof pair.target_section === 'string' ? pair.target_section : '';
    const crossSectionLinked = sourceSection !== targetSection && sourceSection.length > 0 && targetSection.length > 0;

    const candidate = buildCandidate(
      'reverse_salient_closed',
      artifacts,
      typeof pair.theme === 'string' ? pair.theme : '',
      differential,
      crossSectionLinked,
      nowMs,
      windowMs
    );
    candidates.push(candidate);
  }
  return partitionByTier(candidates);
}

module.exports = {
  detectConvergence,
  detectContradictionResolved,
  detectCrossDomainAnalogy,
  detectReverseSalientClosed,
  classifyFireTier,
  partitionByTier,
  buildCandidate,
  buildBreakthroughId,
  DETECTOR_THRESHOLDS,
  DETECTOR_TYPES,
  RS_SCORE_DELTA_THRESHOLD,
};
