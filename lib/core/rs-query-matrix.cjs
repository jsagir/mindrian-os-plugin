/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.1 Plan 03 -- canonical 60-query matrix generator.
 *
 * 15 templates x 4 categories. Fixed-order iteration so the same input
 * deterministically produces the same output. Each template is a function
 * (a, b, concepts, terminology, methods, breakthroughs) -> string. The
 * generator runs every template, scans the output against
 * FORBIDDEN_PATTERNS, and either includes the query or short-circuits
 * with ExternalEgressViolation if a forbidden hit is found.
 *
 * Input shape (consumed from rs-domain-analyzer.cjs::analyzeDomain):
 *   {
 *     primary_domain: string,
 *     concepts: string[],
 *     terminology: string[],
 *     methods: string[],
 *     breakthroughs: string[],
 *     boundary_flag: boolean,
 *     adjacent_domains: string[],
 *   }
 *
 * Output shape (consumed by 89.2 external fetchers):
 *   {
 *     categories: {
 *       a_intersect_b: string[15],
 *       a_leads_to_b:  string[15],
 *       b_leads_to_a:  string[15],
 *       adjacent:      string[15],
 *     }
 *   }
 *
 * Canon Part 8 enforcement:
 *   1. validateAnalysis pre-input scan -- every user-controlled scalar in
 *      the analysis input is scanned against FORBIDDEN_PATTERNS before
 *      any template runs. Forbidden hit returns invalid_analysis envelope
 *      with reason 'forbidden_input'. NO bytes ever reach the template
 *      layer.
 *   2. auditQuery per-template scan -- each template's output is scanned
 *      before insertion into the categories array. Forbidden hit throws
 *      ExternalEgressViolation. Defense-in-depth in case a template
 *      somehow produces a forbidden string from sanitized inputs (e.g.
 *      future template that joins strings in unexpected ways).
 *
 * ExternalEgressViolation is defined locally as a SIBLING class to the
 * one in rs-domain-analyzer.cjs (per CONTEXT.md "Claude's Discretion:
 * sibling vs reuse -- lean toward sibling"). Brain-inbound and external-
 * outbound surfaces are semantically distinct; sharing the class would
 * conflate two bottlenecks and complicate stack traces.
 *
 * Pure CJS, zero npm deps, node built-ins only.
 */
'use strict';

const prompts = require('./rs-brain-substrate-prompts.cjs');
const { FORBIDDEN_PATTERNS } = prompts;

// ---------- ExternalEgressViolation (sibling class) ----------

class ExternalEgressViolation extends Error {
  constructor(message, meta) {
    super(message);
    this.name = 'ExternalEgressViolation';
    this.meta = meta || {};
  }
}

// ---------- Frozen invariants ----------

const QUERIES_PER_CATEGORY = 15;

// ---------- Helper: pick first available element from array, fallback to A or B ----------

function pick(arr, idx, fallback) {
  if (Array.isArray(arr) && arr.length > 0) {
    return arr[idx % arr.length];
  }
  return fallback;
}

// ---------- 15 templates: A INTERSECT B (queries finding shared ground) ----------

const TEMPLATES_A_INTERSECT_B = [
  function (a, b)                      { return a + ' AND ' + b; },
  function (a, b)                      { return 'intersection of ' + a + ' and ' + b; },
  function (a, b, c)                   { return pick(c, 0, a) + ' shared with ' + b; },
  function (a, b)                      { return 'common methods between ' + a + ' and ' + b; },
  function (a, b, c, t)                { return pick(t, 0, a) + ' across ' + b; },
  function (a, b)                      { return 'overlap of ' + a + ' research and ' + b + ' research'; },
  function (a, b)                      { return 'where ' + a + ' meets ' + b; },
  function (a, b, c, t, m)             { return pick(m, 0, a) + ' applied in both ' + a + ' and ' + b; },
  function (a, b)                      { return 'joint ' + a + '-' + b + ' approaches'; },
  function (a, b, c)                   { return pick(c, 1, a) + ' and ' + b + ' shared frameworks'; },
  function (a, b)                      { return 'concepts present in ' + a + ' AND ' + b; },
  function (a, b, c, t)                { return pick(t, 1, a) + ' in ' + b + ' applications'; },
  function (a, b)                      { return a + ' techniques used in ' + b + ' problems'; },
  function (a, b, c, t, m, br)         { return pick(br, 0, a) + ' transferred between ' + a + ' and ' + b; },
  function (a, b)                      { return 'cross-domain literature ' + a + ' ' + b; },
];

// ---------- 15 templates: A LEADS TO B (causal A -> B) ----------

const TEMPLATES_A_LEADS_TO_B = [
  function (a, b)                      { return a + ' enables ' + b; },
  function (a, b)                      { return 'how ' + a + ' produces ' + b; },
  function (a, b, c)                   { return pick(c, 0, a) + ' causing ' + b; },
  function (a, b, c, t)                { return pick(t, 0, a) + ' as precursor to ' + b; },
  function (a, b, c, t, m)             { return pick(m, 0, a) + ' driving ' + b; },
  function (a, b)                      { return a + ' upstream of ' + b; },
  function (a, b, c, t, m, br)         { return pick(br, 0, a) + ' leading to ' + b; },
  function (a, b)                      { return a + ' input to ' + b; },
  function (a, b, c)                   { return pick(c, 1, a) + ' triggers ' + b; },
  function (a, b)                      { return 'consequence of ' + a + ' on ' + b; },
  function (a, b, c, t)                { return pick(t, 1, a) + ' feeding into ' + b; },
  function (a, b)                      { return a + ' as foundation for ' + b; },
  function (a, b)                      { return 'pipeline from ' + a + ' to ' + b; },
  function (a, b, c, t, m)             { return pick(m, 1, a) + ' enabling ' + b + ' breakthroughs'; },
  function (a, b)                      { return a + ' causally precedes ' + b; },
];

// ---------- 15 templates: B LEADS TO A (causal B -> A) ----------

const TEMPLATES_B_LEADS_TO_A = [
  function (a, b)                      { return b + ' enables ' + a; },
  function (a, b)                      { return 'how ' + b + ' informs ' + a; },
  function (a, b, c)                   { return pick(c, 0, a) + ' caused by ' + b; },
  function (a, b, c, t)                { return pick(t, 0, a) + ' downstream of ' + b; },
  function (a, b, c, t, m)             { return pick(m, 0, a) + ' driven by ' + b; },
  function (a, b)                      { return b + ' upstream of ' + a; },
  function (a, b, c, t, m, br)         { return pick(br, 0, a) + ' triggered by ' + b; },
  function (a, b)                      { return b + ' input to ' + a; },
  function (a, b, c)                   { return pick(c, 1, a) + ' result of ' + b; },
  function (a, b)                      { return 'consequence of ' + b + ' on ' + a; },
  function (a, b, c, t)                { return pick(t, 1, a) + ' produced by ' + b; },
  function (a, b)                      { return b + ' as foundation for ' + a; },
  function (a, b)                      { return 'pipeline from ' + b + ' to ' + a; },
  function (a, b, c, t, m)             { return pick(m, 1, a) + ' arising from ' + b; },
  function (a, b)                      { return b + ' causally precedes ' + a; },
];

// ---------- 15 templates: ADJACENT (boundary-spanning bridges) ----------

const TEMPLATES_ADJACENT = [
  function (a, b)                      { return 'frameworks adjacent to ' + a + ' related to ' + b; },
  function (a, b)                      { return a + ' near-domain methods'; },
  function (a, b, c)                   { return pick(c, 0, a) + ' bridging to ' + b; },
  function (a, b)                      { return 'analogies from ' + b + ' applicable to ' + a; },
  function (a, b, c, t)                { return pick(t, 0, a) + ' analog in ' + b; },
  function (a, b)                      { return a + ' edge cases informed by ' + b; },
  function (a, b, c, t, m)             { return pick(m, 0, a) + ' adapted from ' + b; },
  function (a, b)                      { return b + ' patterns at boundary of ' + a; },
  function (a, b, c)                   { return pick(c, 1, a) + ' cross-pollinated from ' + b; },
  function (a, b)                      { return a + ' related fields including ' + b; },
  function (a, b, c, t)                { return pick(t, 1, a) + ' analogue across ' + b; },
  function (a, b)                      { return 'sister disciplines of ' + a + ' such as ' + b; },
  function (a, b, c, t, m, br)         { return pick(br, 0, a) + ' near ' + b + ' frontier'; },
  function (a, b)                      { return 'methodological neighbors of ' + a + ' including ' + b; },
  function (a, b)                      { return a + ' adjacent literature touching ' + b; },
];

// ---------- validateAnalysis: input gate ----------
//
// Returns {ok:true} on valid input. Returns {ok:false, error,
// reason} on any failure. The reason field is the single discriminator
// the caller uses to surface the right message; ordering matters and is
// frozen by the test contract:
//   1. malformed_input    (not an object / array / null)
//   2. no_primary_domain  (primary_domain not a non-empty string)
//   3. no_adjacent_domain (adjacent_domains not a non-empty array)
//   4. no_concepts        (concepts not a non-empty array)
//   5. forbidden_input    (any user-controlled scalar matched FORBIDDEN_PATTERNS)
//
// The forbidden_input check runs LAST so structural validation is
// reported first; the Canon Part 8 layer is the deepest defense.

function validateAnalysis(da) {
  if (!da || typeof da !== 'object' || Array.isArray(da)) {
    return { ok: false, error: 'invalid_analysis', reason: 'malformed_input' };
  }
  if (typeof da.primary_domain !== 'string' || da.primary_domain.length === 0) {
    return { ok: false, error: 'invalid_analysis', reason: 'no_primary_domain' };
  }
  if (!Array.isArray(da.adjacent_domains) || da.adjacent_domains.length === 0) {
    return { ok: false, error: 'invalid_analysis', reason: 'no_adjacent_domain' };
  }
  if (!Array.isArray(da.concepts) || da.concepts.length === 0) {
    return { ok: false, error: 'invalid_analysis', reason: 'no_concepts' };
  }
  // Pre-input scan: every user-controlled string in the analysis input
  // must be free of forbidden patterns. Defense-in-depth: 89.1-02 already
  // scrubs at output time, but the matrix gate scans again.
  const scalars = []
    .concat([da.primary_domain])
    .concat(da.concepts || [])
    .concat(da.terminology || [])
    .concat(da.methods || [])
    .concat(da.breakthroughs || [])
    .concat(da.adjacent_domains || []);
  for (const s of scalars) {
    if (typeof s !== 'string') continue;
    for (const re of FORBIDDEN_PATTERNS) {
      if (re.test(s)) {
        return { ok: false, error: 'invalid_analysis', reason: 'forbidden_input' };
      }
    }
  }
  return { ok: true };
}

// ---------- auditQuery: per-query Canon Part 8 audit ----------
//
// Returns true if the query string is clean, false on any forbidden
// regex hit. Callers that get a false return MUST throw
// ExternalEgressViolation before pushing the query into the output array.

function auditQuery(q) {
  if (typeof q !== 'string' || q.length === 0) return false;
  for (const re of FORBIDDEN_PATTERNS) {
    if (re.test(q)) return false;
  }
  return true;
}

// ---------- generateCategory: runs 15 templates in fixed order ----------
//
// Throws ExternalEgressViolation on the first auditQuery failure. The
// throw is intentional: a forbidden template output indicates a Canon
// Part 8 breach and the caller must NEVER receive a partial category.

function generateCategory(templates, a, b, concepts, terminology, methods, breakthroughs) {
  const out = [];
  for (let i = 0; i < templates.length; i += 1) {
    const q = templates[i](a, b, concepts, terminology, methods, breakthroughs);
    if (!auditQuery(q)) {
      throw new ExternalEgressViolation(
        'query template ' + i + ' produced forbidden output',
        { template_index: i }
      );
    }
    out.push(q);
  }
  return out;
}

// ---------- generateQueryMatrix (public; deterministic) ----------
//
// On valid input: returns {categories: {a_intersect_b[15], a_leads_to_b[15],
// b_leads_to_a[15], adjacent[15]}}.
// On invalid input: returns {error, reason} envelope.
// On forbidden post-template hit (defense-in-depth): throws
// ExternalEgressViolation. The validateAnalysis pre-input scan should
// catch every realistic forbidden payload before this throw can fire,
// but the throw remains the last line of defense.

function generateQueryMatrix(da, opts) {
  opts = opts || {};
  const check = validateAnalysis(da);
  if (!check.ok) {
    return { error: check.error, reason: check.reason };
  }

  const a = da.primary_domain;
  const b = da.adjacent_domains[0];

  const a_intersect_b = generateCategory(
    TEMPLATES_A_INTERSECT_B, a, b,
    da.concepts, da.terminology, da.methods, da.breakthroughs
  );
  const a_leads_to_b = generateCategory(
    TEMPLATES_A_LEADS_TO_B, a, b,
    da.concepts, da.terminology, da.methods, da.breakthroughs
  );
  const b_leads_to_a = generateCategory(
    TEMPLATES_B_LEADS_TO_A, a, b,
    da.concepts, da.terminology, da.methods, da.breakthroughs
  );
  const adjacent = generateCategory(
    TEMPLATES_ADJACENT, a, b,
    da.concepts, da.terminology, da.methods, da.breakthroughs
  );

  // Sanity guard: each category MUST have exactly 15 entries (per kickoff §5).
  if (a_intersect_b.length !== QUERIES_PER_CATEGORY ||
      a_leads_to_b.length  !== QUERIES_PER_CATEGORY ||
      b_leads_to_a.length  !== QUERIES_PER_CATEGORY ||
      adjacent.length      !== QUERIES_PER_CATEGORY) {
    return { error: 'matrix_shape_invariant_failed', reason: 'category_count_mismatch' };
  }

  return {
    categories: {
      a_intersect_b: a_intersect_b,
      a_leads_to_b: a_leads_to_b,
      b_leads_to_a: b_leads_to_a,
      adjacent: adjacent,
    },
  };
}

// ---------- Exports ----------

module.exports = {
  generateQueryMatrix: generateQueryMatrix,
  ExternalEgressViolation: ExternalEgressViolation,
  QUERIES_PER_CATEGORY: QUERIES_PER_CATEGORY,
  _test: {
    TEMPLATES_A_INTERSECT_B: TEMPLATES_A_INTERSECT_B,
    TEMPLATES_A_LEADS_TO_B: TEMPLATES_A_LEADS_TO_B,
    TEMPLATES_B_LEADS_TO_A: TEMPLATES_B_LEADS_TO_A,
    TEMPLATES_ADJACENT: TEMPLATES_ADJACENT,
    validateAnalysis: validateAnalysis,
    auditQuery: auditQuery,
    generateCategory: generateCategory,
    pick: pick,
  },
};
