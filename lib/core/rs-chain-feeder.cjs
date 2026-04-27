/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.4 Plan 02 -- engine-choreography codification (core).
 *
 * Codifies upstream + downstream chain wiring for the RS Discovery
 * Engine per kickoff section 6 (USER LOAD-BEARING INTENT 7).
 *
 *   lookupUpstream(problem_type, stage, opts?)
 *     -- queries Brain FEEDS_INTO topology via the EXISTING brain-client
 *        chokepoint (Canon Part 7); returns {state: 'ready'} OR
 *        {state: 'pause', missing_upstream, suggested_action}.
 *
 *   emitChainMetadata(rs_type, breakthrough_score, active_context)
 *     -- returns the chain metadata block consumed by RS output
 *        layer; recommended_verb validated via Canon Part 3 closed-
 *        vocabulary checker (89.4-01) BEFORE the block is returned.
 *
 *   recommendSkillSpawn(rs_type, breakthrough_score, opts)
 *     -- STUB in 89.4-02; rule table wired by Plan 89.4-03 in place
 *        (the module surface stays stable; only the body changes).
 *
 * Reuses (Canon Part 7):
 *   brain-client.cjs::query / isAvailable           (89.1a chokepoint)
 *   rs-egress-prompts.cjs::auditQueryObject         (89.2-01 chokepoint)
 *   rs-canon-violations.cjs::validateVerb           (89.4-01)
 *   rs-canon-violations.cjs::CanonVerbViolation     (89.4-01)
 *   rs-egress-violations.cjs::ExternalEgressViolation (89.2-01)
 *
 * Brain query graceful-degradation order (mirrors Phase 90 Mode B/C/Tier-0):
 *   1. brainClient.isAvailable() === false -> {state: 'ready'} + warn
 *   2. brainClient.query() throws or returns null -> {state: 'ready'} + warn
 *   3. response.records absent or wrong shape -> {state: 'ready'} + warn
 *   4. Cross-reference returned framework names against
 *      opts.upstreamFreshness Map<name, boolean>; absent key = fresh.
 *
 * Canon Part 8 defense-in-depth:
 *   - lookupUpstream input ({problem_type, stage}) is audited via
 *     auditQueryObject BEFORE any Brain query is dispatched. If the
 *     audit trips, no Brain RPC is made and ExternalEgressViolation
 *     bubbles to the caller.
 *   - emitChainMetadata input (active_context) is audited via
 *     auditQueryObject so adversarial bytes nested in active_context.meta
 *     cannot smuggle into the returned metadata block.
 *   - recommendSkillSpawn opts (when non-empty) is audited as well.
 *   - The module never reaches the network directly; the only outbound
 *     surface is brainClient.query, which inherits 89.1a's allow-list.
 *
 * Pure CJS, zero npm deps, no Node built-ins beyond core require.
 */
'use strict';

const brainClientDefault = require('./brain-client.cjs');
const { auditQueryObject } = require('./rs-egress-prompts.cjs');
const { ExternalEgressViolation } = require('./rs-egress-violations.cjs');
const {
  validateVerb,
  CanonVerbViolation,
  CANONICAL_VERBS,
} = require('./rs-canon-violations.cjs');

// ---------- Internal helpers ----------

// Sanitize a string for embedding in a Cypher query. Mirrors the byte-
// for-byte whitelist from brain-client.cjs::sanitizeCypherInput
// ([a-zA-Z0-9 ._-]). We do NOT call brainClient._test.sanitizeCypherInput
// directly so this module remains testable with a stub brainClient.
function _sanitizeCypher(value) {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'string' ? value : String(value);
  return s.replace(/[^a-zA-Z0-9 ._-]/g, '');
}

// Build the Brain Cypher query asking for upstream FEEDS_INTO frameworks
// for the reverse-salient engine, parameterized (defensively sanitized)
// by problem_type + stage for forward-compat (89.5 may bind these via
// Brain's parameterized query path).
function _buildUpstreamCypher(problem_type, stage) {
  const safeProblem = _sanitizeCypher(problem_type);
  const safeStage = _sanitizeCypher(stage);
  // Note: safeProblem / safeStage are intentionally embedded in a
  // comment line so they participate in the query text without
  // affecting the MATCH semantics. The authoritative Brain edge query
  // is for upstream frameworks pointing at the reverse-salient node.
  return (
    '// chain-feeder upstream lookup (problem_type=' + safeProblem +
    ' stage=' + safeStage + ')\n' +
    'MATCH (rs:Framework {id: "reverse-salient-framework"}) ' +
    '<-[:FEEDS_INTO]-(upstream:Framework) ' +
    'WHERE rs.id IS NOT NULL ' +
    'RETURN upstream.name AS name LIMIT 10'
  );
}

// Defensively pull the framework name from a Brain record. Brain
// returns either {name: '...'} (driver-mode) or [n0, n1, ...] (raw
// columns). We support both.
function _recordName(rec) {
  if (!rec || typeof rec !== 'object') return null;
  if (typeof rec.name === 'string') return rec.name;
  if (Array.isArray(rec) && typeof rec[0] === 'string') return rec[0];
  return null;
}

// ---------- Public surface: lookupUpstream ----------

async function lookupUpstream(problem_type, stage, opts) {
  opts = opts || {};
  const brainClient = opts.brainClient || brainClientDefault;

  // Canon Part 8: pre-flight audit on the input strings before they
  // can reach Brain. ExternalEgressViolation bubbles to the caller.
  auditQueryObject(
    { problem_type: problem_type, stage: stage },
    'rs-chain-feeder-lookup-upstream'
  );

  if (!brainClient.isAvailable()) {
    process.stderr.write('chain-feeder: Brain unreachable; assuming upstream ready\n');
    return { state: 'ready' };
  }

  let result;
  try {
    const cypher = _buildUpstreamCypher(problem_type, stage);
    result = await brainClient.query(cypher);
  } catch (_err) {
    process.stderr.write('chain-feeder: Brain query threw; assuming upstream ready\n');
    return { state: 'ready' };
  }

  if (!result || !Array.isArray(result.records)) {
    process.stderr.write(
      'chain-feeder: Brain query returned unexpected shape; assuming upstream ready\n'
    );
    return { state: 'ready' };
  }

  // Cross-reference upstream framework names against active room state
  // freshness. Plan 89.4-02 ships a minimal in-memory check: if
  // opts.upstreamFreshness is provided (Map<framework_name, boolean>),
  // use it. Absent key = fresh by default (Phase 89.5 will integrate
  // folder-memory.cjs for real freshness reads against BRAIN.md
  // quadruples per Phase 90).
  const freshness = opts.upstreamFreshness instanceof Map
    ? opts.upstreamFreshness
    : new Map();

  const missing = [];
  for (const rec of result.records) {
    const name = _recordName(rec);
    if (typeof name !== 'string' || name.length === 0) continue;
    if (freshness.has(name) && freshness.get(name) === false) {
      missing.push(name);
    }
  }

  if (missing.length === 0) return { state: 'ready' };
  return {
    state: 'pause',
    missing_upstream: missing,
    suggested_action: 'Run Methodology',
  };
}

// ---------- Public surface: emitChainMetadata ----------

function emitChainMetadata(rs_type, breakthrough_score, active_context) {
  active_context = active_context || {};

  // Canon Part 8: scan active_context for FORBIDDEN_PATTERNS via the
  // existing chokepoint. Adversarial bytes nested in any field
  // (e.g., active_context.meta.contact) get caught here.
  auditQueryObject(active_context, 'rs-chain-feeder-emit-metadata');

  // feeds_into mapping (deterministic per rs_type).
  let feeds_into;
  if (rs_type === 'structural_transfer') feeds_into = 'PWS VP';
  else if (rs_type === 'semantic_implementation') feeds_into = 'Causal Loop';
  else if (rs_type === 'hybrid') feeds_into = 'Navigation Engine';
  else feeds_into = 'JTBD'; // fallback for unknown rs_type

  // recommended_verb selection (deterministic per breakthrough_score).
  // Plan 89.4-03 may refine via skill rules; this module ships the
  // baseline heuristic.
  const score = Number(breakthrough_score);
  const safeScore = Number.isFinite(score) ? score : 0;
  let recommended_verb;
  if (safeScore >= 7) recommended_verb = 'Bank Opportunity';
  else if (safeScore >= 5) recommended_verb = 'Synthesize';
  else recommended_verb = 'Reformulate';

  // Canon Part 3: validate before returning. Defensive against future
  // edits to the heuristic introducing out-of-set verbs.
  validateVerb(recommended_verb, 'rs-chain-feeder-emit-metadata');

  return {
    recommended_verb: recommended_verb,
    feeds_into: feeds_into,
    spawn_skill: null, // Plan 89.4-03 wires the rule table
  };
}

// ---------- Public surface: recommendSkillSpawn (STUB; 89.4-03 wires) ----------

function recommendSkillSpawn(rs_type, breakthrough_score, opts) {
  opts = opts || {};
  // Canon Part 8 defense-in-depth: when opts carries any keys, audit it.
  // Empty-opts case is exempt to keep the stub trivially callable.
  if (opts && typeof opts === 'object' && Object.keys(opts).length > 0) {
    auditQueryObject(opts, 'rs-chain-feeder-recommend-skill-spawn');
  }
  return {
    spawn_skill: null,
    confidence: 0,
    reasoning: 'no rule matched (89.4-02 stub; 89.4-03 wires the rule table)',
  };
}

// ---------- Module exports ----------

module.exports = {
  lookupUpstream,
  emitChainMetadata,
  recommendSkillSpawn,
  // Re-export so Canon-aware caller wrappers can catch by err.name
  // without re-requiring the upstream modules themselves.
  ExternalEgressViolation,
  CanonVerbViolation,
  CANONICAL_VERBS,
};
