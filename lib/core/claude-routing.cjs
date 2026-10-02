'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * SEED-103 (2026-10-01): the ONE home for "which Claude model answers which
 * kind of work" inside lib/. Before this module every lib caller of
 * api.anthropic.com carried its own hardcoded model id (three different
 * Haiku ids, two retired Sonnet 4 ids) and its own request shape, so a model
 * generation change meant seven edits and a request that one model rejects
 * (Opus 5.5 returns 400 on `temperature`; Haiku 4.5 returns 400 on
 * `output_config.effort`).
 *
 * Contract:
 *   - ROLES is the closed list of work kinds. Each role names an alias
 *     (opus | sonnet | haiku) and an effort. The default alias for every
 *     role is `opus` (the claude-api reference: use claude-opus-5-5 unless
 *     the navigator names a different model; never downgrade for cost). A
 *     cheaper alias is a navigator decision, made through the env override
 *     MINDRIAN_MODEL_<ROLE> or the room's model_overrides (model-profiles.cjs),
 *     never a default written here.
 *   - ALIAS_IDS maps an alias to the current concrete model id. This is the
 *     ONLY place a `claude-*` id is written under lib/ outside tests
 *     (tests/test-seed103-claude-routing.cjs greps for that).
 *   - buildMessagesBody(role, parts) returns a request body that the
 *     resolved model accepts: sampling params are dropped on the 5.x
 *     generation, `output_config.effort` is set there and omitted on Haiku
 *     4.5, `thinking` is never sent (adaptive is the default where it
 *     exists), and max_tokens gets a floor on thinking models because
 *     thinking tokens count against it.
 *   - No network here. Callers keep their own fetch, timeout and fallback.
 *
 * Part 8: this module carries no room content; it shapes a request the
 * caller already decided to send.
 */

// ---- alias -> concrete id (the one home) ----------------------------------
const ALIAS_IDS = Object.freeze({
  opus: 'claude-opus-5-5',
  sonnet: 'claude-sonnet-5-5',
  haiku: 'claude-haiku-4-5',
});

const ALIASES = Object.freeze(Object.keys(ALIAS_IDS));

// ---- roles: what kind of work, default alias, effort -----------------------
// effort levels: low | medium | high | xhigh | max (5.x generation only).
const ROLES = Object.freeze({
  // Closed-set labeling of candidate entity names for one artifact
  // (lib/core/semantic-index/entity-classifier.cjs). Structural judgment on short
  // excerpts; a wrong label drops a real term or promotes noise.
  entity_classify: Object.freeze({ alias: 'opus', effort: 'low', max_tokens: 2000 }),
  // MVA (minimum viable answer) intent classification (lib/core/mva-classifier.cjs).
  mva_classify: Object.freeze({ alias: 'opus', effort: 'low', max_tokens: 1500 }),
  // One short name suggestion (lib/core/llm-name-suggester.cjs).
  name_suggest: Object.freeze({ alias: 'opus', effort: 'low', max_tokens: 1200 }),
  // Typed-edge candidate derivation between room nodes (lib/core/graph-candidate-producer.cjs).
  derive_edges: Object.freeze({ alias: 'opus', effort: 'medium', max_tokens: 4000 }),
  // Section briefing prose (lib/wiki/briefing.cjs).
  briefing: Object.freeze({ alias: 'opus', effort: 'medium', max_tokens: 4000 }),
  // Wiki chat answer (lib/wiki/wiki-server.cjs, lib/chat/fabric-chat.cjs).
  chat: Object.freeze({ alias: 'opus', effort: 'medium', max_tokens: 2000 }),
  // Opportunity statement prose for a judged pair (research-planner Eureka perspective).
  statement: Object.freeze({ alias: 'opus', effort: 'high', max_tokens: 6000 }),
  // Pair judgment when the judge is Claude rather than Jev (spike arm only).
  pair_judge: Object.freeze({ alias: 'opus', effort: 'high', max_tokens: 4000 }),
});

const ROLE_NAMES = Object.freeze(Object.keys(ROLES));

// Models on which sampling params are rejected and effort is accepted.
const FIVE_X = /^claude-(opus-5|sonnet-5|fable-5|mythos-5)/;
// Floor for max_tokens on thinking models: thinking tokens are billed inside it.
const THINKING_MAX_TOKENS_FLOOR = 1024;

function _envOverride(role) {
  const key = 'MINDRIAN_MODEL_' + String(role).toUpperCase();
  const v = process.env[key];
  return (typeof v === 'string' && v.trim()) ? v.trim() : null;
}

/**
 * Resolve the concrete model id for a role.
 * Precedence: opts.override (a room model_overrides value or a caller's
 * explicit choice) > env MINDRIAN_MODEL_<ROLE> > the role's default alias.
 * An override may be an alias (opus | sonnet | haiku) or a full claude-* id.
 * Unknown role -> throws (a typo must not silently route to a default).
 */
function resolveModelId(role, opts) {
  if (!Object.prototype.hasOwnProperty.call(ROLES, role)) {
    throw new Error('claude-routing: unknown role "' + role + '"');
  }
  const o = opts || {};
  const raw = (typeof o.override === 'string' && o.override.trim()) ? o.override.trim() : _envOverride(role);
  if (raw) {
    if (Object.prototype.hasOwnProperty.call(ALIAS_IDS, raw)) return ALIAS_IDS[raw];
    if (/^claude-[a-z]+-[0-9]/.test(raw)) return raw;
    throw new Error('claude-routing: override for role "' + role + '" is neither an alias nor a model id');
  }
  return ALIAS_IDS[ROLES[role].alias];
}

/** Effort for the role, env-overridable via MINDRIAN_EFFORT_<ROLE>. */
function resolveEffort(role) {
  const v = process.env['MINDRIAN_EFFORT_' + String(role).toUpperCase()];
  const levels = ['low', 'medium', 'high', 'xhigh', 'max'];
  if (typeof v === 'string' && levels.indexOf(v.trim()) !== -1) return v.trim();
  return ROLES[role].effort;
}

function isFiveX(modelId) {
  return FIVE_X.test(String(modelId || ''));
}

/**
 * Build a /v1/messages body the resolved model accepts.
 * parts: { system?, messages (required), max_tokens?, temperature? }
 * On a 5.x model: temperature/top_p/top_k are dropped, output_config.effort is
 * set, thinking is omitted, max_tokens is floored. On Haiku 4.5: temperature
 * passes through, no output_config.
 */
function buildMessagesBody(role, parts, opts) {
  const p = parts || {};
  if (!Array.isArray(p.messages) || p.messages.length === 0) {
    throw new Error('claude-routing: messages are required');
  }
  const model = resolveModelId(role, opts);
  const spec = ROLES[role];
  const body = { model: model, messages: p.messages };
  if (typeof p.system === 'string' && p.system) body.system = p.system;
  let maxTokens = (typeof p.max_tokens === 'number' && p.max_tokens > 0) ? p.max_tokens : spec.max_tokens;
  if (isFiveX(model)) {
    if (maxTokens < THINKING_MAX_TOKENS_FLOOR) maxTokens = THINKING_MAX_TOKENS_FLOOR;
    body.output_config = { effort: resolveEffort(role) };
    // sampling params are rejected on this generation: never forwarded.
  } else {
    if (typeof p.temperature === 'number') body.temperature = p.temperature;
  }
  body.max_tokens = maxTokens;
  return body;
}

/** Concatenate the text blocks of a /v1/messages response (thinking blocks skipped). */
function textOf(responseJson) {
  let text = '';
  if (responseJson && Array.isArray(responseJson.content)) {
    for (const blk of responseJson.content) {
      if (blk && blk.type === 'text' && typeof blk.text === 'string') text += blk.text;
    }
  }
  return text;
}

/** One table for /mos:models and doctor: role -> resolved id, effort, source. */
function routingTable() {
  return ROLE_NAMES.map(function (role) {
    const env = _envOverride(role);
    return {
      role: role,
      model: resolveModelId(role),
      effort: isFiveX(resolveModelId(role)) ? resolveEffort(role) : null,
      source: env ? 'env' : 'default',
    };
  });
}

module.exports = {
  ALIAS_IDS: ALIAS_IDS,
  ALIASES: ALIASES,
  ROLES: ROLES,
  ROLE_NAMES: ROLE_NAMES,
  ANTHROPIC_VERSION: '2023-06-01',
  ANTHROPIC_URL: 'https://api.anthropic.com/v1/messages',
  resolveModelId: resolveModelId,
  resolveEffort: resolveEffort,
  isFiveX: isFiveX,
  buildMessagesBody: buildMessagesBody,
  textOf: textOf,
  routingTable: routingTable,
};
