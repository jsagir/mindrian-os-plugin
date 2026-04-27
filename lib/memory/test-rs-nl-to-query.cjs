#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.5 Plan 02 -- rs-nl-to-query NL-to-Query triangulation suite.
 *
 * 16 scenarios covering THE HARDEST Canon Part 8 surface in v1.11.0:
 *
 * Positive-path (intent recognition + frozen ALLOW_LIST_INTENTS):
 *   T1  feeds_into_query intent -> brain_query payload with allow-list scalar
 *   T2  reverse_salients_in_room intent -> SQL-only (brain_query null)
 *   T3  experts_on_topic intent -> Cypher-only (brain_query null)
 *   T4  methodology_chain intent -> brain_query only (sql + cypher null)
 *   T5  discovery_history intent -> SQL + Cypher mirror (brain_query null)
 *   T6  ALLOW_LIST_INTENTS frozen + length >= 5 + entry shape conformance
 *   T7  unrecognized intent -> brain_query null + safe fallback
 *
 * Adversarial Canon Part 8 (>= 6 leak-attempt scenarios):
 *   T8   artifact body leak attempt -> brain_query null OR audit throws
 *   T9   venture name leak attempt -> JSON.stringify(brain_query) excludes name
 *   T10  meeting transcript leak via opts -> input audit throws ExternalEgressViolation
 *   T11  financial figure leak attempt ($500M) -> output excludes the figure
 *   T12  decision_log leak attempt -> brain_query null AND output safe
 *   T13  governing_thought leak attempt -> brain_query null AND output safe
 *
 * Injection prevention:
 *   T14  SQL injection NL -> parameterized binding (zero string concatenation)
 *
 * Chokepoint exclusivity (Canon Part 7 + Part 8 invariant):
 *   T15  source-level grep: zero fetch(; zero brain-client require;
 *        >= 1 buildBrainQueryFromNL definition; >= 3 auditQueryObject sites
 *
 * A1 sweep (defense-in-depth across positive paths):
 *   T16  every positive-path output JSON.stringify scanned against
 *        FORBIDDEN_PATTERNS -> zero matches
 *
 * Pure CJS, zero npm deps, node built-ins only (assert + fs + path).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ---------- Suite bookkeeping ----------

let passed = 0;
let failed = 0;
const failures = [];

function record(name, fn) {
  try {
    fn();
    passed++;
    process.stdout.write('PASS ' + name + '\n');
  } catch (err) {
    failed++;
    failures.push({ name, message: err && err.message ? err.message : String(err) });
    process.stdout.write('FAIL ' + name + ': ' + (err && err.message ? err.message : String(err)) + '\n');
  }
}

// ---------- Module under test ----------

const mod = require('../core/rs-nl-to-query.cjs');
const { translate, ALLOW_LIST_INTENTS, _test } = mod;

const egressPrompts = require('../core/rs-egress-prompts.cjs');
const { FORBIDDEN_PATTERNS } = egressPrompts;

// Collect positive-test outputs for the A1 sweep (T16).
const positiveOutputs = [];

// ---------- T1: feeds_into_query intent ----------

record('T1 feeds_into_query intent emits brain_query with allow-list scalar', function () {
  const nl = 'What frameworks chain into RS Discovery?';
  const out = translate(nl, {});
  positiveOutputs.push(out);

  assert.ok(out && typeof out === 'object', 'translate must return object');
  assert.ok('cypher' in out, 'output must have cypher key');
  assert.ok('sql' in out, 'output must have sql key');
  assert.ok('brain_query' in out, 'output must have brain_query key');

  assert.ok(out.brain_query !== null && typeof out.brain_query === 'object',
    'feeds_into_query intent must produce non-null brain_query');
  assert.ok(typeof out.brain_query.cypher === 'string',
    'brain_query.cypher must be a string template');
  assert.ok(out.brain_query.params && typeof out.brain_query.params === 'object',
    'brain_query.params must be an object');

  // No raw user NL substring inside the brain_query payload.
  const payloadJson = JSON.stringify(out.brain_query);
  assert.ok(payloadJson.indexOf('RS Discovery') === -1,
    'brain_query payload must not contain raw user NL substring "RS Discovery"');
});

// ---------- T2: reverse_salients_in_room (LOCAL only) ----------

record('T2 reverse_salients_in_room intent: SQL parameterized + brain_query null', function () {
  const nl = 'Show me reverse salients in my fintech room';
  const out = translate(nl, {});
  positiveOutputs.push(out);

  assert.equal(out.brain_query, null,
    'reverse_salients_in_room is LOCAL-only; brain_query must be null');
  assert.ok(typeof out.sql === 'string', 'sql must be a string template');
  assert.ok(out.sql.indexOf('$1') !== -1 || out.sql.indexOf('?') !== -1,
    'sql must use parameterized placeholder ($1 or ?)');
  assert.ok(Array.isArray(out.sql_params),
    'sql_params must be an array');
  assert.ok(out.sql_params.length >= 1, 'sql_params must contain bound entity');
  // Bound entity should reference fintech room slug.
  const paramJoined = out.sql_params.join('|').toLowerCase();
  assert.ok(paramJoined.indexOf('fintech') !== -1,
    'sql_params must include bound "fintech" room slug');
  // No string concatenation: SQL template must not contain user NL substring.
  assert.ok(out.sql.toLowerCase().indexOf('fintech') === -1,
    'sql template must NOT contain "fintech" (parameterized binding required)');
});

// ---------- T3: experts_on_topic (Aura-only) ----------

record('T3 experts_on_topic intent: Cypher parameterized + brain_query null', function () {
  const nl = 'Who are experts on quantum computing?';
  const out = translate(nl, {});
  positiveOutputs.push(out);

  assert.equal(out.brain_query, null,
    'experts_on_topic is LOCAL Aura; brain_query must be null');
  assert.ok(typeof out.cypher === 'string', 'cypher must be a string');
  assert.ok(out.cypher.indexOf('$topic') !== -1,
    'cypher must reference $topic parameter placeholder');
  assert.ok(out.cypher_params && typeof out.cypher_params === 'object',
    'cypher_params must be an object');
  assert.ok(out.cypher_params.topic && typeof out.cypher_params.topic === 'string',
    'cypher_params.topic must be a bound string');
  assert.ok(out.cypher_params.topic.toLowerCase().indexOf('quantum') !== -1,
    'cypher_params.topic must include "quantum" entity');
  // No raw concatenation.
  assert.ok(out.cypher.toLowerCase().indexOf('quantum computing') === -1,
    'cypher template must NOT inline "quantum computing" (parameterized only)');
});

// ---------- T4: methodology_chain (Brain-only) ----------

record('T4 methodology_chain intent: Brain template + sql/cypher null', function () {
  const nl = 'What methodology chains from JTBD?';
  const out = translate(nl, {});
  positiveOutputs.push(out);

  assert.ok(out.brain_query !== null && typeof out.brain_query === 'object',
    'methodology_chain must emit Brain template');
  assert.ok(typeof out.brain_query.cypher === 'string',
    'brain_query.cypher must be a string');
  assert.ok(out.brain_query.params && typeof out.brain_query.params === 'object',
    'brain_query.params must be an object');
  assert.ok(typeof out.brain_query.params.source_id === 'string',
    'brain_query.params.source_id must be a bound scalar');
  assert.ok(out.brain_query.params.source_id.toLowerCase().indexOf('jtbd') !== -1,
    'source_id must reference jtbd');
  // No user NL substring inside the Brain payload.
  const json = JSON.stringify(out.brain_query);
  assert.ok(json.indexOf('What methodology') === -1,
    'brain_query must not contain raw NL prefix');
});

// ---------- T5: discovery_history (SQL + Cypher mirror) ----------

record('T5 discovery_history intent: SQL + Cypher mirror, brain_query null', function () {
  const nl = 'What RS discoveries have I made in my biotech room?';
  const out = translate(nl, {});
  positiveOutputs.push(out);

  assert.equal(out.brain_query, null,
    'discovery_history is LOCAL only; brain_query must be null');
  assert.ok(typeof out.sql === 'string', 'sql must be a string');
  assert.ok(Array.isArray(out.sql_params), 'sql_params must be array');
  assert.ok(out.sql_params.length >= 1, 'sql_params must contain room slug');
  // Verify it's the room slug ('biotech') -- not raw NL.
  const paramJoined = out.sql_params.join('|').toLowerCase();
  assert.ok(paramJoined.indexOf('biotech') !== -1, 'bound param must include biotech');
});

// ---------- T6: ALLOW_LIST_INTENTS shape + freeze ----------

record('T6 ALLOW_LIST_INTENTS frozen + length >= 5 + entry shape', function () {
  assert.ok(Array.isArray(ALLOW_LIST_INTENTS), 'ALLOW_LIST_INTENTS must be array');
  assert.equal(Object.isFrozen(ALLOW_LIST_INTENTS), true, 'ALLOW_LIST_INTENTS must be frozen');
  assert.ok(ALLOW_LIST_INTENTS.length >= 5,
    'ALLOW_LIST_INTENTS.length must be >= 5; got ' + ALLOW_LIST_INTENTS.length);
  for (const entry of ALLOW_LIST_INTENTS) {
    assert.ok(entry && typeof entry === 'object', 'every entry must be object');
    assert.equal(typeof entry.intent_id, 'string', 'entry.intent_id must be string');
    assert.ok(Array.isArray(entry.keyword_patterns),
      'entry.keyword_patterns must be array');
    assert.ok(entry.keyword_patterns.length >= 1,
      'entry.keyword_patterns must have >= 1 regex');
    // brain_template, sql_template, cypher_template each string|null
    assert.ok(entry.brain_template === null || typeof entry.brain_template === 'string',
      'entry.brain_template must be string or null');
    assert.ok(entry.sql_template === null || typeof entry.sql_template === 'string',
      'entry.sql_template must be string or null');
    assert.ok(entry.cypher_template === null || typeof entry.cypher_template === 'string',
      'entry.cypher_template must be string or null');
    assert.equal(typeof entry.params_extractor, 'function',
      'entry.params_extractor must be function');
    // Frozen entry guard.
    assert.equal(Object.isFrozen(entry), true,
      'every ALLOW_LIST_INTENTS entry must be Object.freeze\'d');
  }
});

// ---------- T7: unrecognized intent ----------

record('T7 unrecognized intent: brain_query null, no leak', function () {
  const nl = 'Tell me a joke about quantum computing';
  const out = translate(nl, {});
  // Don't push to positiveOutputs because brain_query is null by design.
  assert.equal(out.brain_query, null,
    'unrecognized NL must produce brain_query === null');
  // SQL + Cypher should be null OR a safe generic fallback (no raw NL).
  if (typeof out.sql === 'string') {
    assert.ok(out.sql.indexOf('joke') === -1, 'safe fallback SQL must not echo NL');
  }
  if (typeof out.cypher === 'string') {
    assert.ok(out.cypher.indexOf('joke') === -1, 'safe fallback Cypher must not echo NL');
  }
});

// ---------- T8: artifact body leak attempt ----------

record('T8 artifact body leak attempt: brain_query null AND output audit safe', function () {
  // The NL contains content that LOOKS like an artifact body excerpt.
  const nl = 'What does my artifact body say about RS chains?';
  let out = null;
  let threw = null;
  try {
    out = translate(nl, {});
  } catch (e) {
    threw = e;
  }
  // Two acceptable outcomes:
  //   (a) Audit throws ExternalEgressViolation on output (preferred)
  //   (b) Output returned with brain_query null
  if (threw !== null) {
    assert.equal(threw.name, 'ExternalEgressViolation',
      'if throw, must be ExternalEgressViolation');
  } else {
    assert.equal(out.brain_query, null,
      'artifact-body NL must NOT produce brain_query (LOCAL-only fallback or null)');
  }
});

// ---------- T9: venture name leak attempt ----------

record('T9 venture name leak attempt: name never reaches brain_query payload', function () {
  const nl = 'Show me reverse salients for my Acme Quantum Brain Imaging venture';
  const out = translate(nl, {});
  // brain_query may be either null (LOCAL-only intent) OR a generic template.
  if (out.brain_query !== null) {
    const json = JSON.stringify(out.brain_query);
    assert.ok(json.indexOf('Acme Quantum Brain Imaging') === -1,
      'brain_query payload must NOT contain venture name');
    assert.ok(json.indexOf('Acme') === -1,
      'brain_query payload must NOT contain venture name fragment');
  }
});

// ---------- T10: meeting transcript leak via opts ----------

record('T10 meeting transcript via opts: input audit throws ExternalEgressViolation', function () {
  const nl = 'What frameworks chain from JTBD?';
  // Use a phrase that hits FORBIDDEN_PATTERNS: "meeting with" pattern.
  const opts = { meeting_transcript: 'meeting with private board minutes about regulatory blocker' };
  let threw = null;
  try {
    translate(nl, opts);
  } catch (e) {
    threw = e;
  }
  assert.ok(threw !== null,
    'meeting_transcript in opts must trip input audit and throw');
  assert.equal(threw.name, 'ExternalEgressViolation',
    'thrown error must be ExternalEgressViolation');
  assert.ok(threw.meta && typeof threw.meta === 'object',
    'err.meta must be object');
  assert.ok(typeof threw.meta.surface === 'string' && threw.meta.surface.length > 0,
    'err.meta.surface must be a non-empty string tag');
  // Surface tag MUST identify the input chokepoint.
  assert.ok(threw.meta.surface.indexOf('input') !== -1
    || threw.meta.surface.indexOf('rs-nl-to-query') !== -1,
    'err.meta.surface must identify the rs-nl-to-query input chokepoint; got '
      + JSON.stringify(threw.meta.surface));
});

// ---------- T11: financial figure leak attempt ----------

record('T11 financial figure leak attempt: $500M never in output', function () {
  // The financial figure $500M matches FORBIDDEN_PATTERNS and MUST trip the audit.
  const nl = 'Find experts on $500M Series A failure modes';
  let out = null;
  let threw = null;
  try {
    out = translate(nl, {});
  } catch (e) {
    threw = e;
  }
  // Two acceptable outcomes:
  //   (a) Audit throws ExternalEgressViolation -- preferred since $500M is a forbidden pattern
  //   (b) Output returned but $500M does NOT appear anywhere
  if (threw !== null) {
    assert.equal(threw.name, 'ExternalEgressViolation');
  } else {
    const fullJson = JSON.stringify(out);
    assert.ok(fullJson.indexOf('$500M') === -1,
      'financial figure $500M must not appear anywhere in output');
    assert.ok(fullJson.indexOf('500M') === -1,
      'financial figure 500M must not appear in output');
  }
});

// ---------- T12: decision_log leak attempt ----------

record('T12 decision_log leak attempt: brain_query null + safe', function () {
  const nl = 'Why did I reject opportunity X in my decision log?';
  let out = null;
  let threw = null;
  try {
    out = translate(nl, {});
  } catch (e) {
    threw = e;
  }
  if (threw !== null) {
    assert.equal(threw.name, 'ExternalEgressViolation');
  } else {
    assert.equal(out.brain_query, null,
      'decision_log NL must yield brain_query === null');
  }
});

// ---------- T13: governing_thought leak attempt ----------

record('T13 governing_thought leak attempt: brain_query null + safe', function () {
  const nl = "What's my governing thought on Mindrian moat?";
  let out = null;
  let threw = null;
  try {
    out = translate(nl, {});
  } catch (e) {
    threw = e;
  }
  if (threw !== null) {
    assert.equal(threw.name, 'ExternalEgressViolation');
  } else {
    assert.equal(out.brain_query, null,
      'governing_thought NL must yield brain_query === null');
  }
});

// ---------- T14: SQL/Cypher injection prevention ----------

record('T14 SQL injection NL: parameterized binding (no concatenation)', function () {
  const nl = "Show me reverse salients in '; DROP TABLE rs_discoveries;--";
  const out = translate(nl, {});
  assert.equal(out.brain_query, null, 'reverse_salients_in_room is LOCAL-only');
  assert.ok(typeof out.sql === 'string', 'sql must be a string');
  // Crucial: the injection string must NOT appear in the SQL TEMPLATE.
  assert.ok(out.sql.indexOf("DROP TABLE") === -1,
    'sql template must NEVER contain "DROP TABLE" (parameterized only)');
  assert.ok(out.sql.indexOf("';") === -1,
    'sql template must NEVER contain quote-semicolon injection sequence');
  // Bound parameter is allowed to contain the raw input -- DB driver escapes it.
  assert.ok(Array.isArray(out.sql_params),
    'sql_params must be array (raw input bound, not concatenated)');
});

// ---------- T15: chokepoint exclusivity ----------

record('T15 chokepoint exclusivity: source-level grep invariants', function () {
  const srcPath = path.resolve(__dirname, '../core/rs-nl-to-query.cjs');
  const src = fs.readFileSync(srcPath, 'utf8');

  // Count occurrences of forbidden surfaces.
  const fetchHits = (src.match(/\bfetch\s*\(/g) || []).length;
  assert.equal(fetchHits, 0,
    'rs-nl-to-query.cjs must NEVER call fetch(); got ' + fetchHits + ' hits');

  // brain-client require must not appear (this module CONSTRUCTS, does NOT execute).
  const brainClientHits = (src.match(/require\(['"][^'"]*brain-client[^'"]*['"]\)/g) || []).length;
  assert.equal(brainClientHits, 0,
    'rs-nl-to-query.cjs must NOT require brain-client.cjs; got ' + brainClientHits + ' hits');

  // queryGraph must not be called directly (orchestrator executes).
  const queryGraphHits = (src.match(/\.queryGraph\s*\(/g) || []).length;
  assert.equal(queryGraphHits, 0,
    'rs-nl-to-query.cjs must NOT call queryGraph(); got ' + queryGraphHits + ' hits');

  // The chokepoint function must exist (definition + at least one call).
  const buildBrainQueryHits = (src.match(/buildBrainQueryFromNL/g) || []).length;
  assert.ok(buildBrainQueryHits >= 2,
    'buildBrainQueryFromNL must appear >= 2 times (definition + call); got '
      + buildBrainQueryHits);

  // auditQueryObject must be called at >= 3 sites.
  const auditObjHits = (src.match(/auditQueryObject\s*\(/g) || []).length;
  assert.ok(auditObjHits >= 3,
    'auditQueryObject must be called at >= 3 sites; got ' + auditObjHits);

  // _test export exists.
  assert.ok(_test && typeof _test === 'object', '_test export must be an object');
  assert.equal(typeof _test.classifyIntent, 'function',
    '_test.classifyIntent must be exported');
  assert.equal(typeof _test.buildBrainQueryFromNL, 'function',
    '_test.buildBrainQueryFromNL must be exported');
});

// ---------- T16: A1 sweep across positive outputs ----------

record('T16 A1 sweep: zero FORBIDDEN_PATTERNS matches in positive outputs', function () {
  assert.ok(positiveOutputs.length >= 5,
    'must have collected >= 5 positive outputs for A1 sweep; got '
      + positiveOutputs.length);
  for (let i = 0; i < positiveOutputs.length; i++) {
    const out = positiveOutputs[i];
    const json = JSON.stringify(out);
    for (const re of FORBIDDEN_PATTERNS) {
      assert.equal(re.test(json), false,
        'A1 sweep failed: positive output ' + i + ' matched FORBIDDEN_PATTERN '
          + re.source);
    }
  }
});

// ---------- Suite report ----------

const total = passed + failed;
process.stdout.write('\n');
if (failed === 0) {
  process.stdout.write('=== 89.5-02 rs-nl-to-query suite: ' + passed + '/' + total + ' passed ===\n');
  process.exit(0);
} else {
  process.stdout.write('=== 89.5-02 rs-nl-to-query suite: ' + passed + '/' + total + ' passed (' + failed + ' failed) ===\n');
  for (const f of failures) {
    process.stdout.write('  FAIL ' + f.name + ': ' + f.message + '\n');
  }
  process.exit(1);
}
