/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 202-01 -- reward extraction into a per-reach reward table.
 *
 * Consumes the high-signal event set from telemetry-consumer.cjs and extracts
 * the reward-bearing fields into a per-key table the APO loop (202-02) will
 * optimize against.
 *
 * Reward-field sourcing (D2): lib/core/telemetry/schema.cjs exports
 * ALLOWED_FIELDS -- the FULL per-event whitelist. It does NOT export a
 * "reward fields" subset; that subset is OUR selection. So this module holds
 * its own REWARD_FIELD map { event -> reward field name } for the four
 * reward-bearing events, and ASSERTS at runtime that each chosen field name is
 * present in ALLOWED_FIELDS[event]. If a future schema rename drifts a field,
 * the assertion fails loud (code REWARD_FIELD_DRIFT) rather than silently
 * extracting undefined.
 *
 * Normalization (D3):
 *   - selector_pick.ranker_confidence      -> direct (schema: number 0..1)
 *   - tension_engagement.user_response      -> resolve=1 / defer=0.5 / ignore=0
 *   - auto_explore_decision.domain_match_score -> direct (schema: number 0..1)
 *   - hooked_axis_score.score_value         -> RAW into signals, EXCLUDED from
 *     rewardMean. schema.cjs types score_value as an UNBOUNDED number (no 0..1
 *     range documented); fabricating a normalization here would be a lie.
 *     Normalization deferred to 202-02 blend-weighting.
 *
 * Canon Part 8: LAB-side only. Pure in-memory transform over already-read
 * LOCAL events. Zero network, zero Brain, zero egress. Node built-ins only.
 */
'use strict';

const { ALLOWED_FIELDS } = require('../../lib/core/telemetry/schema.cjs');

// ---------- Our reward-bearing field selection (D2) ----------
//
// This is the APO subset, NOT a schema export. assertRewardFieldsPresent()
// below verifies each name still exists in schema.cjs so a rename cannot drift
// this copy silently.
const REWARD_FIELD = Object.freeze({
  selector_pick: 'ranker_confidence',
  tension_engagement: 'user_response',
  auto_explore_decision: 'domain_match_score',
  hooked_axis_score: 'score_value',
});

// The per-reach key for each reward-bearing event (the "command/reach" the
// reward attaches to).
const KEY_FIELD = Object.freeze({
  selector_pick: 'verb_chosen',
  tension_engagement: 'tension_type',
  auto_explore_decision: 'finding_type',
  hooked_axis_score: 'axis_name',
});

// score_value is unbounded per schema.cjs; it is carried raw but never feeds
// rewardMean (D3). This set marks reward fields excluded from the bounded mean.
const UNBOUNDED_FIELDS = new Set(['score_value']);

const TENSION_RESPONSE_REWARD = Object.freeze({ resolve: 1, defer: 0.5, ignore: 0 });

// ---------- Anti-drift presence check (D2) ----------

/**
 * assertRewardFieldsPresent(fieldMap, allowedFields) -> void
 *
 * Throws Error.code='REWARD_FIELD_DRIFT' if any reward field name in fieldMap
 * is not present in allowedFields[event]. Injectable allowedFields so a test
 * can simulate a schema rename and prove the check follows the schema.
 */
function assertRewardFieldsPresent(fieldMap, allowedFields) {
  for (const event of Object.keys(fieldMap)) {
    const field = fieldMap[event];
    const allowed = allowedFields ? allowedFields[event] : undefined;
    if (!Array.isArray(allowed) || allowed.indexOf(field) === -1) {
      const e = new Error(
        "reward field drift: '" + field + "' is not in ALLOWED_FIELDS['" + event +
        "'] (lib/core/telemetry/schema.cjs). A schema rename drifted the reward " +
        'extractor -- update REWARD_FIELD to match the frozen schema.'
      );
      e.code = 'REWARD_FIELD_DRIFT';
      throw e;
    }
  }
}

// ---------- Normalization ----------

function normalizeReward(event, rawValue) {
  if (event === 'hooked_axis_score') {
    // score_value unbounded per schema.cjs; normalization deferred to 202-02
    // blend-weighting. Not a bounded contribution to rewardMean.
    return null;
  }
  if (event === 'tension_engagement') {
    return Object.prototype.hasOwnProperty.call(TENSION_RESPONSE_REWARD, rawValue)
      ? TENSION_RESPONSE_REWARD[rawValue]
      : null;
  }
  if (event === 'selector_pick' || event === 'auto_explore_decision') {
    return typeof rawValue === 'number' ? rawValue : null;
  }
  return null;
}

// ---------- Public API ----------

/**
 * buildRewardTable(events) -> { [key]: { rewardMean, n, signals } }
 *
 * key       = the per-reach identifier (verb_chosen / tension_type /
 *             finding_type / axis_name) the reward attaches to.
 * rewardMean = running mean of the bounded normalized reward across the three
 *             bounded signals (score_value EXCLUDED, D3).
 * n         = count of bounded observations backing rewardMean.
 * signals   = { [fieldName]: rawValue[] } -- every raw reward value seen,
 *             including the unbounded score_value (carried, never averaged).
 *
 * Events that are not reward-bearing (command_invocation, empathy_observation,
 * the 6 mva.* types, etc.) are skipped. Input is expected to be the high-signal
 * set from readTelemetry, but the function tolerates any event array.
 */
function buildRewardTable(events) {
  // Fail loud if a schema rename drifted our field selection (D2).
  assertRewardFieldsPresent(REWARD_FIELD, ALLOWED_FIELDS);

  const table = {};
  const list = Array.isArray(events) ? events : [];

  for (const ev of list) {
    if (!ev || typeof ev !== 'object') continue;
    const field = REWARD_FIELD[ev.event];
    if (!field) continue; // not a reward-bearing event

    const keyField = KEY_FIELD[ev.event];
    const key = ev[keyField] != null ? String(ev[keyField]) : '__unkeyed__';

    if (!Object.prototype.hasOwnProperty.call(table, key)) {
      table[key] = { rewardMean: 0, n: 0, signals: {} };
    }
    const bucket = table[key];

    const rawValue = ev[field];
    if (!Object.prototype.hasOwnProperty.call(bucket.signals, field)) {
      bucket.signals[field] = [];
    }
    bucket.signals[field].push(rawValue);

    // Unbounded fields are carried in signals but excluded from rewardMean (D3).
    if (UNBOUNDED_FIELDS.has(field)) continue;

    const norm = normalizeReward(ev.event, rawValue);
    if (norm == null) continue; // unrecognized enum / non-numeric: skip the mean contribution

    // Numerically stable running mean.
    bucket.n += 1;
    bucket.rewardMean += (norm - bucket.rewardMean) / bucket.n;
  }

  return table;
}

module.exports = {
  buildRewardTable,
  assertRewardFieldsPresent,
  REWARD_FIELD,
  KEY_FIELD,
};
