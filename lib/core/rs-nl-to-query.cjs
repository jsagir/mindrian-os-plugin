/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.5 Plan 02 -- NL-to-Query triangulation (HARDEST Canon Part 8 surface in v1.11.0).
 *
 * Translates user-supplied natural-language queries into a triangulated
 * three-graph query bundle: {cypher, sql, brain_query}. Read by the
 * Phase 89.5 orchestrator (Plan 89.5-04) and the /mos:rs-explain command
 * (Plan 89.5-05); never executes queries itself (Canon Part 7 reuse:
 * lazygraph-ops + the Brain HTTP client are the executors).
 *
 * Why this module is the hardest Canon Part 8 surface in v1.11.0:
 *
 *   The Brain (brain.mindrian.ai) is a generic methodology repository
 *   that MUST never receive user content. Every other 89.x callsite
 *   builds Brain queries from STRUCTURED inputs (problem_type, framework
 *   id, phase id) where the audit surface is a finite enum. This module
 *   builds Brain queries from FREE-FORM user NL, which means the only
 *   thing standing between an arbitrary user phrase and a Brain RPC is
 *   the chokepoint pattern in this file.
 *
 *   The chokepoint is buildBrainQueryFromNL. It is the SINGLE function
 *   in the codebase that constructs Brain query payloads from NL input.
 *   It runs auditQueryString on the raw NL (SEAM 1) and auditQueryObject
 *   on the constructed payload (SEAM 2). Recognized intents map to
 *   allow-listed Brain templates that carry only generic scalars
 *   (framework name, methodology id, source id). Unrecognized intents
 *   OR intents that would require user-content -> brain_query is null
 *   (Brain query OMITTED; room.db + Aura still work).
 *
 *   The translate() entry point also runs auditQueryObject on the
 *   {nl_query, opts} input (SEAM A) and on the constructed bundle before
 *   return (SEAM C). Three audit seams + one chokepoint = four
 *   independent tripwires defending the Brain boundary against arbitrary
 *   user NL.
 *
 * Reuses (Canon Part 7):
 *   rs-egress-violations.cjs::ExternalEgressViolation     (89.2-01)
 *   rs-egress-prompts.cjs::auditQueryString               (89.2-01)
 *   rs-egress-prompts.cjs::auditQueryObject               (89.2-01)
 *   rs-egress-prompts.cjs::FORBIDDEN_PATTERNS             (89.2-01)
 *
 * NEVER imports (this module CONSTRUCTS, the orchestrator EXECUTES):
 *   the Brain HTTP client module                          (orchestrator only)
 *   lazygraph-ops.cjs::queryGraph                         (orchestrator only)
 *
 * NEVER invokes any network primitive. Pure CJS, zero npm deps,
 * no Node built-ins beyond core require.
 */
'use strict';

const { ExternalEgressViolation } = require('./rs-egress-violations.cjs');
const {
  auditQueryString,
  auditQueryObject,
  FORBIDDEN_PATTERNS,
} = require('./rs-egress-prompts.cjs');

// ---------- Constants ----------

// Maximum bound-parameter scalar length. Bounded so a runaway NL fragment
// cannot smuggle a multi-kilobyte payload through the entity extractor.
const PARAM_MAX_LENGTH = 100;

// ---------- Entity extractors (pure functions over NL strings) ----------
//
// Each extractor pulls a structured scalar from the NL string and runs the
// scalar through auditQueryString before returning. ExternalEgressViolation
// bubbles to the caller if the extracted scalar matches any FORBIDDEN_PATTERN.
// Length cap applied after extraction, before audit.

function _truncateAndAudit(scalar, surfaceTag) {
  if (typeof scalar !== 'string') return null;
  let s = scalar.trim();
  if (s.length === 0) return null;
  if (s.length > PARAM_MAX_LENGTH) s = s.slice(0, PARAM_MAX_LENGTH);
  // Strip surrounding quotes (single or double).
  s = s.replace(/^["']|["']$/g, '').trim();
  if (s.length === 0) return null;
  // Audit BEFORE return. Any forbidden pattern raises immediately.
  auditQueryString(s, surfaceTag);
  return s;
}

// extractRoomSlugParam: pulls "in my <slug> room" or "for my <slug> venture"
// or fallback to known section keywords.
function extractRoomSlugParam(nl_query) {
  const surface = 'rs-nl-to-query-extract-room-slug';
  // "in my fintech room" / "for my biotech venture" / "in my X room"
  const m1 = /(?:in|for)\s+my\s+([a-z0-9 _-]{1,50}?)\s+(?:room|venture|project)/i.exec(nl_query);
  if (m1 && m1[1]) {
    const slug = _truncateAndAudit(m1[1].trim().toLowerCase().replace(/\s+/g, '-'), surface);
    if (slug) return { room_slug: slug };
  }
  // Fallback: look for "<word> room" anywhere.
  const m2 = /\b([a-z][a-z0-9_-]{2,30})\s+room\b/i.exec(nl_query);
  if (m2 && m2[1]) {
    const slug = _truncateAndAudit(m2[1].trim().toLowerCase(), surface);
    if (slug) return { room_slug: slug };
  }
  // Last resort: empty bound param so the parameterized binding still works.
  return { room_slug: '' };
}

// extractTopicParam: pulls "experts on <topic>" or "leading researchers in <topic>".
function extractTopicParam(nl_query) {
  const surface = 'rs-nl-to-query-extract-topic';
  const m1 = /experts?\s+on\s+(.+?)(?:\?|$|\.|;)/i.exec(nl_query);
  if (m1 && m1[1]) {
    const topic = _truncateAndAudit(m1[1].trim(), surface);
    if (topic) return { topic: topic.toLowerCase() };
  }
  const m2 = /(?:researchers|authors|leaders)\s+(?:in|on)\s+(.+?)(?:\?|$|\.|;)/i.exec(nl_query);
  if (m2 && m2[1]) {
    const topic = _truncateAndAudit(m2[1].trim(), surface);
    if (topic) return { topic: topic.toLowerCase() };
  }
  return { topic: '' };
}

// extractFrameworkParam: maps NL framework references to canonical scalars.
// Allow-list approach: only recognized framework names produce a bound scalar.
const FRAMEWORK_ALIASES = Object.freeze({
  'rs discovery': 'reverse_salient_engine',
  'reverse salient': 'reverse_salient_engine',
  'reverse salients': 'reverse_salient_engine',
  'reverse-salient': 'reverse_salient_engine',
  'jtbd': 'jtbd',
  'jobs-to-be-done': 'jtbd',
  'jobs to be done': 'jtbd',
  'persona': 'persona',
  'navigation engine': 'navigation_engine',
  'pws vp': 'pws_vp',
  'mind map': 'mind_map',
});

function extractFrameworkParam(nl_query) {
  // Walk aliases longest-first so multi-word matches win.
  const lc = nl_query.toLowerCase();
  const sortedAliases = Object.keys(FRAMEWORK_ALIASES).sort(function (a, b) {
    return b.length - a.length;
  });
  for (const alias of sortedAliases) {
    if (lc.indexOf(alias) !== -1) {
      // Already an enum scalar; no audit needed (allow-list source).
      return { target_framework: FRAMEWORK_ALIASES[alias] };
    }
  }
  return { target_framework: '' };
}

// extractMethodologyParam: maps NL methodology refs to source_id scalar.
function extractMethodologyParam(nl_query) {
  const lc = nl_query.toLowerCase();
  const sortedAliases = Object.keys(FRAMEWORK_ALIASES).sort(function (a, b) {
    return b.length - a.length;
  });
  for (const alias of sortedAliases) {
    if (lc.indexOf(alias) !== -1) {
      return { source_id: FRAMEWORK_ALIASES[alias] };
    }
  }
  return { source_id: '' };
}

// ---------- Frozen ALLOW_LIST_INTENTS ----------
//
// Five intent records covering the v1.11.0-beta.1 NL-to-Query surface.
// Each record is independently Object.freeze'd so the table cannot mutate
// at runtime even if a caller obtains a reference. params_extractor is the
// pure-function entity puller that audits the scalar before binding.
//
// Brain templates use parameterized Cypher placeholders ($source_id,
// $target_framework). Local SQL uses $1/$2 PostgreSQL-style placeholders.
// Local Cypher uses $room_slug / $topic placeholders. Templates NEVER
// inline user NL.

const ALLOW_LIST_INTENTS = Object.freeze([
  Object.freeze({
    intent_id: 'feeds_into_query',
    keyword_patterns: [
      /what\s+(frameworks?|methodologies?)\s+(chain|feed)\s+(into|to)/i,
      /downstream\s+of/i,
      /what\s+chains?\s+into/i,
    ],
    brain_template:
      'MATCH (m:Methodology {id: $target_framework})-[:FEEDS_INTO*0..1]-(t:Methodology) '
      + 'RETURN t.name AS name, t.id AS id LIMIT 10',
    sql_template: null,
    cypher_template: null,
    params_extractor: extractFrameworkParam,
  }),
  Object.freeze({
    intent_id: 'reverse_salients_in_room',
    keyword_patterns: [
      /(show|find|list)\s+(me\s+)?reverse\s+salients?/i,
    ],
    brain_template: null,
    sql_template:
      'SELECT * FROM rs_discoveries WHERE room_slug = ? ORDER BY created_at DESC',
    cypher_template:
      'MATCH (rs:RSDiscovery {room_slug: $room_slug}) RETURN rs ORDER BY rs.created_at DESC',
    params_extractor: extractRoomSlugParam,
  }),
  Object.freeze({
    intent_id: 'experts_on_topic',
    keyword_patterns: [
      /(?:who\s+(?:are\s+)?|find\s+)experts?\s+on/i,
      /(?:who.*authored|leading\s+researchers)\s+(?:in|on)/i,
    ],
    brain_template: null,
    sql_template: null,
    cypher_template:
      'MATCH (a:Author)-[:AUTHORED_BY]->(p:Paper) '
      + 'WHERE p.topic = $topic RETURN a.name AS name, a.affiliation AS affiliation LIMIT 20',
    params_extractor: extractTopicParam,
  }),
  Object.freeze({
    intent_id: 'methodology_chain',
    keyword_patterns: [
      /methodology\s+chains?\s+from/i,
      /what\s+comes\s+after/i,
      /chains?\s+from\s+(?:jtbd|persona|swot|porter)/i,
    ],
    brain_template:
      'MATCH (m:Methodology {id: $source_id})-[:FEEDS_INTO*1..3]->(t:Methodology) '
      + 'RETURN t.name AS name, t.id AS id LIMIT 10',
    sql_template: null,
    cypher_template: null,
    params_extractor: extractMethodologyParam,
  }),
  Object.freeze({
    intent_id: 'discovery_history',
    keyword_patterns: [
      /(?:what\s+)?(?:rs\s+|reverse\s+salient\s+)?discoveries\s+(?:have\s+i|did\s+i)\s+(?:made|created|found)/i,
      /my\s+discoveries/i,
      /discoveries.*(?:have\s+i|in\s+my\s+\w+\s+room)/i,
    ],
    brain_template: null,
    sql_template:
      'SELECT * FROM rs_discoveries WHERE room_slug = ? ORDER BY created_at DESC',
    cypher_template:
      'MATCH (rs:RSDiscovery {room_slug: $room_slug}) RETURN rs ORDER BY rs.created_at DESC',
    params_extractor: extractRoomSlugParam,
  }),
]);

// ---------- Internal helpers ----------

// classifyIntent: deterministic keyword match over ALLOW_LIST_INTENTS.
// First-match-wins across the entries; within an entry, ANY keyword match
// triggers the intent. Returns the entry OR null if no match.
function classifyIntent(nl_query) {
  if (typeof nl_query !== 'string' || nl_query.length === 0) return null;
  for (const entry of ALLOW_LIST_INTENTS) {
    for (const re of entry.keyword_patterns) {
      if (re.test(nl_query)) return entry;
    }
  }
  return null;
}

// ---------- THE CHOKEPOINT: buildBrainQueryFromNL ----------
//
// THE SINGLE function in the codebase that constructs Brain query payloads
// from NL input. Two-seam defense:
//   SEAM 1: auditQueryString on the raw NL (catches direct forbidden bytes)
//   SEAM 2: auditQueryObject on the constructed payload (catches indirect
//           leakage through entity extraction or template substitution)
//
// If intent === null OR intent.brain_template === null OR the entity
// extractor returns an empty scalar -> return null (Brain query OMITTED).
//
// Never throws on the "Brain query OMITTED" path; only throws when the
// audit explicitly identifies a FORBIDDEN_PATTERN in the input or output.

function buildBrainQueryFromNL(nl_query, intent) {
  // SEAM 1: raw NL audit (the input chokepoint for Brain construction).
  // ExternalEgressViolation bubbles to the caller (translate()).
  auditQueryString(nl_query, 'rs-nl-to-query-brain-input');

  // No intent OR intent has no Brain template -> Brain query OMITTED.
  if (intent === null || intent.brain_template === null) return null;

  // Extract entity params (extractor audits the scalar already).
  const params = intent.params_extractor(nl_query);

  // If extractor returned an empty scalar across all bound keys, we can't
  // form a meaningful Brain query without inlining user NL. OMIT.
  let hasNonEmpty = false;
  for (const k of Object.keys(params)) {
    if (typeof params[k] === 'string' && params[k].length > 0) {
      hasNonEmpty = true;
      break;
    }
  }
  if (!hasNonEmpty) return null;

  // Build the structured payload. NEVER inline user NL.
  const brainQuery = {
    cypher: intent.brain_template,
    params: params,
    intent_id: intent.intent_id,
  };

  // SEAM 2: constructed-payload audit. JSON.stringify scan catches any
  // residual user-content that snuck through the extractor (e.g., if a
  // future extractor regression bound a multi-word phrase containing a
  // forbidden pattern).
  auditQueryObject(brainQuery, 'rs-nl-to-query-brain-output');

  return brainQuery;
}

// ---------- Local query builder (room.db SQL + Aura Cypher) ----------
//
// Builds parameterized SQL/Cypher. NEVER concatenates user NL into the
// template string. ALL bound scalars come from the intent's
// params_extractor (which already ran auditQueryString on the scalar).

function buildLocalQueries(nl_query, intent) {
  if (intent === null) {
    return { sql: null, sql_params: null, cypher: null, cypher_params: null };
  }
  const params = intent.params_extractor(nl_query);

  // SQL: use $1 placeholder, bind room_slug as the first positional param.
  let sql = null;
  let sql_params = null;
  if (typeof intent.sql_template === 'string') {
    sql = intent.sql_template;
    // Bind the FIRST scalar key as $1. Parameterized binding only.
    const keys = Object.keys(params);
    if (keys.length > 0) {
      sql_params = [params[keys[0]]];
    } else {
      sql_params = [];
    }
  }

  // Cypher: use named placeholders ($room_slug / $topic). Pass the params
  // map directly; never concatenated.
  let cypher = null;
  let cypher_params = null;
  if (typeof intent.cypher_template === 'string') {
    cypher = intent.cypher_template;
    cypher_params = params;
  }

  return { sql: sql, sql_params: sql_params, cypher: cypher, cypher_params: cypher_params };
}

// ---------- Public entry: translate ----------
//
// Top-level NL-to-Query translator. Three audit seams + one chokepoint:
//
//   SEAM A: auditQueryObject({nl_query, opts}) before ANY work
//           -> catches forbidden patterns nested in opts (e.g., a leaked
//              meeting_transcript field)
//   SEAM 1: inside buildBrainQueryFromNL -- raw NL audit
//   SEAM 2: inside buildBrainQueryFromNL -- constructed-payload audit
//   SEAM C: auditQueryObject on the returned bundle -- last line of defense
//
// Returns: {cypher, sql, brain_query, sql_params, cypher_params}
//   - brain_query is null when intent unrecognized OR Brain template absent
//   - sql / cypher are null when the intent is the other backend's exclusive
//   - sql_params / cypher_params follow their respective query string

function translate(nl_query, opts) {
  opts = opts || {};

  // SEAM A: input audit. JSON.stringify scan catches forbidden patterns in
  // either the NL itself OR any field of opts. Throws ExternalEgressViolation
  // BEFORE buildBrainQueryFromNL runs, so adversarial opts.meeting_transcript
  // never reaches the chokepoint.
  auditQueryObject({ nl_query: nl_query, opts: opts }, 'rs-nl-to-query-input');

  // Defensive: also require nl_query to be a string. Null/non-string is a
  // caller bug, not a Canon violation.
  if (typeof nl_query !== 'string') {
    throw new TypeError('translate: nl_query must be a string; got ' + typeof nl_query);
  }

  // Classify and build.
  const intent = classifyIntent(nl_query);
  const brainQuery = buildBrainQueryFromNL(nl_query, intent);
  const local = buildLocalQueries(nl_query, intent);

  const bundle = {
    cypher: local.cypher,
    sql: local.sql,
    brain_query: brainQuery,
    sql_params: local.sql_params,
    cypher_params: local.cypher_params,
  };

  // SEAM C: post-build audit on the returned bundle. Catches any leakage
  // that snuck past SEAM A + the chokepoint (e.g., a bound scalar that
  // matched a FORBIDDEN_PATTERN only after extractor normalization).
  auditQueryObject(bundle, 'rs-nl-to-query-output');

  return bundle;
}

// ---------- Exports ----------

module.exports = {
  translate,
  ALLOW_LIST_INTENTS,
  // Re-export so callers can catch by err.name without re-requiring the
  // upstream egress-violations module.
  ExternalEgressViolation,
  // Test surface (Canon Part 7: never used by production callers; only the
  // RED/GREEN suite imports these for chokepoint introspection).
  _test: {
    classifyIntent: classifyIntent,
    buildBrainQueryFromNL: buildBrainQueryFromNL,
    buildLocalQueries: buildLocalQueries,
    extractRoomSlugParam: extractRoomSlugParam,
    extractTopicParam: extractTopicParam,
    extractFrameworkParam: extractFrameworkParam,
    extractMethodologyParam: extractMethodologyParam,
    FRAMEWORK_ALIASES: FRAMEWORK_ALIASES,
    PARAM_MAX_LENGTH: PARAM_MAX_LENGTH,
  },
};
