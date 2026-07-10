/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 213-01 -- the deterministic COMPRESSION meter (SEED-050 THE METRIC).
 *
 * THE FORMULA (verbatim from SEED-050:47, evals/eureka/README.md:50):
 *
 *   Score = CompressionDelta x GuardGate x StatusQuoGate
 *
 * This is CODE, not an LLM judge. No LLM sits anywhere in the formula path: the
 * meter takes already-judged scalars/enums and does deterministic arithmetic.
 * Novelty is NOT arrival, and arrival is NOT compression: the niche-foods session
 * ARRIVED at the team's own answer, but after two years of prior thought = arrival
 * WITHOUT compression = null (README:44). So the score measures how much the run
 * COMPRESSED the human's real path, never bare arrival.
 *
 * Two SEED-050 truths this module enforces:
 *   - A Lured arrival (fell for a seeded distractor) scores NEGATIVE, not zero
 *     ("Lured = negative, not zero"). A run that would have compressed a lot but
 *     got lured is penalized MORE, not less.
 *   - Arrival without compression (CompressionDelta 0) scores ~0 (the null-control
 *     anchors this; nichefoods-null is the pivotal negative).
 *
 * HOME (flagged Decision-Gate recommendation, RESEARCH Open Question 1): this
 * meter is the RUNTIME-SIDE leg under lib/core/eureka/ because it is consumed by
 * the plan-05 APO reward SIGNAL at runtime. The LLM-protocol graders live
 * eval-side under lab/eureka-graders/. MCP-servable packaging of the judge family
 * (SEED-050:102-105) is deferred to the consolidation arc's critic-MCP step.
 *
 * The gate labels are the 212 critic verdict enums; they are NOT re-minted here.
 * The guard label 'pseudoscience' is one of data/eureka-critic-tags.json verdicts;
 * 'status_quo_stuck' is the status-quo judge label (lab/eureka-graders/status-quo-judge.cjs).
 *
 * Pure, sync, zero-I/O. Zero network, zero Brain, zero MCP imports (Canon Part 8).
 * Node built-ins only, CJS, never throws, hyphens only (no em-dashes).
 */
'use strict';

// ---------------------------------------------------------------------------
// Frozen label constants. These NAME the enum values the meter keys on; the
// enums themselves are owned elsewhere (do not re-mint them here):
//   - GUARD_ZERO_LABEL is one of the four 212 critic verdicts
//     (data/eureka-critic-tags.json "verdicts").
//   - STATUS_QUO_ZERO_LABEL is the "stuck" label from the status-quo judge
//     (lab/eureka-graders/status-quo-judge.cjs STATUS_QUO_LABELS).
// ---------------------------------------------------------------------------

// GuardGate closes (0) when ANY scoring-path turn is labeled pseudoscience.
const GUARD_ZERO_LABEL = 'pseudoscience';

// StatusQuoGate closes (0) when ANY scoring-path turn re-defends the status quo
// after the persona signalled innovation intent and explicitly rejected it.
const STATUS_QUO_ZERO_LABEL = 'status_quo_stuck';

// The Lured leg. LURED_PENALTY is the NEGATIVE multiplier ("-1 x compressionDelta");
// MIN_LURED_MAGNITUDE floors the magnitude so a Lured run is never a soft zero
// even when its would-be compression was tiny. A Lured score is therefore
// LURED_PENALTY x max(compressionDelta, MIN_LURED_MAGNITUDE) -- always strictly < 0.
const LURED_PENALTY = -1;
const MIN_LURED_MAGNITUDE = 0.25;

// The arrival verdict that triggers the negative leg (mirrors
// lab/eureka-graders/arrival-grader.cjs ARRIVAL_VERDICTS 'Lured'; the arrival
// grader is the producer of this verdict, this meter is its consumer).
const LURED_ARRIVAL = 'Lured';

// ---------------------------------------------------------------------------
// clamp01 -- defensive clamp of a scalar into [0,1]. Non-finite -> 0.
// ---------------------------------------------------------------------------

function clamp01(x) {
  if (typeof x !== 'number' || !Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

// ---------------------------------------------------------------------------
// computeCompressionDelta(humanBaselineTurns, observedTurns) -> 0..1
//
// How much did the run COMPRESS the human's real path? 0 = took as long as / longer
// than the human (arrived where they already were); 1 = collapsed the whole baseline
// into no turns. delta = (human - observed) / human, clamped to [0,1].
//
// This function takes NUMBERS only. When the card carries a qualitative
// human_baseline_effort (strings like "~2 years"), the CALLER maps it to a
// turns-equivalent scalar BEFORE calling: that mapping is a hand-scoring judgment
// per the README rubric (D-locked "the meter is CODE"), kept OUT of the meter.
//
// Defensive: non-finite / absent / non-numeric inputs -> 0; baseline <= 0 -> 0
// (no divide). Never throws, never returns NaN.
// ---------------------------------------------------------------------------

function computeCompressionDelta(humanBaselineTurns, observedTurns) {
  const human = humanBaselineTurns;
  const observed = observedTurns;
  if (typeof human !== 'number' || !Number.isFinite(human) || human <= 0) return 0;
  if (typeof observed !== 'number' || !Number.isFinite(observed) || observed < 0) return 0;
  return clamp01((human - observed) / human);
}

// ---------------------------------------------------------------------------
// guardGate(guardEvents) -> 0 | 1
// 0 when ANY event equals GUARD_ZERO_LABEL ('pseudoscience'); else 1.
// Defensive: non-array -> treated as []; never throws.
// ---------------------------------------------------------------------------

function guardGate(guardEvents) {
  const events = Array.isArray(guardEvents) ? guardEvents : [];
  for (let i = 0; i < events.length; i += 1) {
    if (events[i] === GUARD_ZERO_LABEL) return 0;
  }
  return 1;
}

// ---------------------------------------------------------------------------
// statusQuoGate(statusQuoEvents) -> 0 | 1
// 0 when ANY event equals STATUS_QUO_ZERO_LABEL ('status_quo_stuck'); else 1.
// Defensive: non-array -> treated as []; never throws.
// ---------------------------------------------------------------------------

function statusQuoGate(statusQuoEvents) {
  const events = Array.isArray(statusQuoEvents) ? statusQuoEvents : [];
  for (let i = 0; i < events.length; i += 1) {
    if (events[i] === STATUS_QUO_ZERO_LABEL) return 0;
  }
  return 1;
}

// ---------------------------------------------------------------------------
// compressionScore({ compressionDelta, guardEvents, statusQuoEvents, arrival })
//   -> the composite Score.
//
//   Score = CompressionDelta x GuardGate x StatusQuoGate
//
// EXCEPT: a Lured arrival short-circuits to the NEGATIVE leg (SEED-050: Lured is
// negative, not zero), which no open gate can rescue. Falling for a seeded
// distractor dominates the outcome.
//
// All inputs defensive: compressionDelta clamped to [0,1]; event lists coerced to
// []; unknown arrival treated as non-Lured. Never throws.
// ---------------------------------------------------------------------------

function compressionScore(input) {
  const spec = (input && typeof input === 'object') ? input : {};
  const delta = clamp01(spec.compressionDelta);

  // The negative leg: a Lured arrival is penalized by its would-be compression,
  // floored at MIN_LURED_MAGNITUDE so it is never a soft zero. Gates cannot save it.
  if (spec.arrival === LURED_ARRIVAL) {
    return LURED_PENALTY * Math.max(delta, MIN_LURED_MAGNITUDE);
  }

  return delta * guardGate(spec.guardEvents) * statusQuoGate(spec.statusQuoEvents);
}

module.exports = {
  computeCompressionDelta: computeCompressionDelta,
  guardGate: guardGate,
  statusQuoGate: statusQuoGate,
  compressionScore: compressionScore,
  LURED_PENALTY: LURED_PENALTY,
  MIN_LURED_MAGNITUDE: MIN_LURED_MAGNITUDE,
  GUARD_ZERO_LABEL: GUARD_ZERO_LABEL,
  STATUS_QUO_ZERO_LABEL: STATUS_QUO_ZERO_LABEL,
};
