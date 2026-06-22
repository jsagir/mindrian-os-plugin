'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 171 -- methodology-ingest pipeline (the reusable "add a methodology to
 * the remote Brain" machine). Codifies the 6-step process applied by hand in
 * Phase 170 (ACE / Hooked / Self-Selling Loop) so every future framework
 * follows the SAME safe path.
 *
 * This module is PURE / sync / zero-I/O. It does NOT touch the Brain. It
 * PREPARES the exact artifacts a maintainer then writes via the my-neo4j and
 * pinecone MCP tools (the admin write path; the Brain is admin-gated and the
 * boundary in Canon Part 8 forbids user-content egress regardless).
 *
 * The load-bearing function is auditSpecPart8: the boundary GATE. A methodology
 * spec is GENERIC teaching knowledge by construction; the gate fails closed if
 * the spec carries anything that looks like user/venture data (emails,
 * possessive user references, room ids, currency figures). Nothing is built for
 * the Brain until the gate is clean.
 *
 * Normalized spec shape (all fields optional except name + description):
 *   {
 *     name, canonical_name, description, when_to_use, when_not_to_use,
 *     methodology_tier: 'pws' | 'mindrian-operation',
 *     mos_command, author, source, origin_year,
 *     core_principles: [str], key_concepts: [str], common_pitfalls: [str],
 *     related_frameworks: [str], applicable_stages: [str], tags: [str],
 *     trigger_lexicon: [str], trigger_signal,
 *     steps:  [{ name, description, step_number }],
 *     cases:  [{ name, description, ...scalars }],
 *     chains_in:  [str],   // frameworks that FEED_INTO this one
 *     chains_out: [str],   // frameworks this one FEEDS_INTO
 *   }
 *
 * House rule: hyphens only, no em-dashes.
 */

// ---------- Part 8 boundary gate ----------

// Forbidden patterns: a generic methodology spec must carry NONE of these. If
// any appears, the spec is carrying (or risks carrying) user/venture content and
// must NOT be written to the Brain (Canon Part 8: LOCAL -> BRAIN: NO).
const PART8_FORBIDDEN = [
  { id: 'email', re: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i },
  { id: 'user-possessive', re: /\b(the user's|this venture's|the navigator's|our customer's|the client's)\b/i },
  { id: 'room-id', re: /\broom:[a-z0-9-]+/i },
  { id: 'currency-figure', re: /[$€£]\s?\d[\d,]{3,}/ },
];

function collectStrings(v, out) {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) { for (const x of v) collectStrings(x, out); }
  else if (v && typeof v === 'object') { for (const k of Object.keys(v)) collectStrings(v[k], out); }
  return out;
}

/**
 * The boundary gate. Returns { clean, violations }. clean=false means do NOT
 * write this spec to the Brain.
 */
function auditSpecPart8(spec) {
  const strings = collectStrings(spec || {}, []);
  const violations = [];
  for (const s of strings) {
    for (const p of PART8_FORBIDDEN) {
      if (p.re.test(s)) violations.push({ pattern: p.id, sample: s.slice(0, 80) });
    }
  }
  return { clean: violations.length === 0, violations: violations };
}

// ---------- helpers ----------

function slug(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function asArray(v) { return Array.isArray(v) ? v : []; }

// ---------- Neo4j: parameterized framework Cypher (injection-safe) ----------

/**
 * Build the idempotent, parameterized Cypher to MERGE a framework + its steps +
 * cases + author + chains. Returns { cypher, params }. Uses $-params and `+=`
 * map-merge so no string interpolation of spec values ever happens (safe).
 */
function buildFrameworkCypher(spec) {
  if (!spec || typeof spec.name !== 'string' || !spec.name) {
    throw new Error('methodology-ingest: spec.name is required');
  }
  const props = {};
  const carry = ['canonical_name', 'description', 'when_to_use', 'when_not_to_use',
    'category', 'purpose', 'theoretical_foundation', 'core_principles', 'key_concepts',
    'common_pitfalls', 'success_metrics', 'related_frameworks', 'applicable_stages',
    'mos_command', 'author', 'source', 'origin_year', 'methodology_tier', 'discipline',
    'trigger_lexicon', 'trigger_signal', 'jtbd_anchor'];
  for (const k of carry) if (spec[k] != null) props[k] = spec[k];
  props.added_by = 'methodology-ingest';

  const steps = asArray(spec.steps).map(function (s, i) {
    return { name: s.name, props: { description: s.description || '', step_number: s.step_number != null ? s.step_number : i + 1 } };
  });
  const cases = asArray(spec.cases).map(function (c) {
    const p = {};
    for (const k of Object.keys(c)) if (k !== 'name') p[k] = c[k];
    return { name: c.name, props: p };
  });

  const cypher = [
    'MERGE (f:Framework {name:$name}) SET f += $props',
    'WITH f',
    'FOREACH (st IN $steps | MERGE (s:FrameworkStep {name:st.name}) SET s += st.props MERGE (f)-[:HAS_STEP]->(s))',
    'WITH f',
    'FOREACH (c IN $cases | MERGE (cs:CaseStudy {name:c.name}) SET cs += c.props MERGE (f)-[:HAS_EXAMPLE]->(cs))',
    'WITH f',
    'FOREACH (a IN $author | MERGE (p:Person {name:a}) MERGE (f)-[:AUTHORED_BY]->(p) MERGE (p)-[:TEACHES]->(f))',
    'WITH f',
    'FOREACH (up IN $chains_in | MERGE (u:Framework {name:up}) MERGE (u)-[:FEEDS_INTO]->(f))',
    'WITH f',
    'FOREACH (dn IN $chains_out | MERGE (d:Framework {name:dn}) MERGE (f)-[:FEEDS_INTO]->(d))',
    'RETURN f.name AS framework',
  ].join('\n');

  const params = {
    name: spec.name,
    props: props,
    steps: steps,
    cases: cases,
    author: spec.author ? [spec.author] : [],
    chains_in: asArray(spec.chains_in),
    chains_out: asArray(spec.chains_out),
  };
  return { cypher: cypher, params: params };
}

// ---------- Pinecone: summary + granular chunk records ----------

/**
 * Build the Pinecone records (summary + one per case + one per step) for an
 * integrated-embedding index whose fieldMap text field is "content". Flat
 * scalar/array metadata only (Pinecone rule + Part 8). Returns an array.
 */
function buildPineconeRecords(spec) {
  if (!spec || !spec.name) throw new Error('methodology-ingest: spec.name is required');
  const fwSlug = slug(spec.name);
  const out = [];

  const summary = {
    _id: 'framework-' + fwSlug,
    content: (spec.name + '. ' + (spec.description || '')).trim(),
    framework_name: spec.name,
    node_type: 'framework',
  };
  if (spec.methodology_tier) summary.methodology_tier = spec.methodology_tier;
  if (spec.mos_command) summary.mos_command = spec.mos_command;
  if (Array.isArray(spec.key_concepts)) summary.key_concepts = spec.key_concepts;
  if (Array.isArray(spec.related_frameworks)) summary.related_frameworks = spec.related_frameworks;
  if (Array.isArray(spec.applicable_stages)) summary.applicable_stages = spec.applicable_stages;
  if (Array.isArray(spec.tags)) summary.tags = spec.tags;
  out.push(summary);

  asArray(spec.cases).forEach(function (c) {
    const rec = {
      _id: fwSlug + '-case-' + slug(c.name),
      content: (spec.name + ' case - ' + c.name + '. ' + (c.description || '')).trim(),
      parent_framework: spec.name,
      node_type: 'case',
    };
    for (const k of Object.keys(c)) {
      if (k === 'name' || k === 'description') continue;
      const v = c[k];
      const t = typeof v;
      if (t === 'string' || t === 'number' || t === 'boolean' ||
          (Array.isArray(v) && v.every(function (x) { return typeof x === 'string'; }))) {
        rec[k] = v;
      }
    }
    out.push(rec);
  });

  asArray(spec.steps).forEach(function (s, i) {
    out.push({
      _id: fwSlug + '-step-' + (s.step_number != null ? s.step_number : i + 1),
      content: (spec.name + ' step ' + (s.step_number != null ? s.step_number : i + 1) + ' - ' + s.name + '. ' + (s.description || '')).trim(),
      parent_framework: spec.name,
      node_type: 'step',
      step_number: s.step_number != null ? s.step_number : i + 1,
    });
  });

  return out;
}

// ---------- the 6-step plan (for dry-run + the command to follow) ----------

/**
 * Produce the ordered ingestion plan with the boundary gate result attached.
 * The maintainer command renders this and HALTS at step 2 if the gate is dirty.
 */
function ingestPlan(spec) {
  const audit = auditSpecPart8(spec);
  return {
    framework: spec && spec.name,
    gate_clean: audit.clean,
    steps: [
      { n: 1, id: 'encode', detail: 'Normalize the methodology into generic graph nodes (framework + variables + cases + steps + critiques).' },
      { n: 2, id: 'boundary-gate', detail: 'Canon Part 8 audit -- fail closed if the spec carries user/venture data.', result: audit },
      { n: 3, id: 'graph-write', detail: 'MERGE into Neo4j via my-neo4j (buildFrameworkCypher).' },
      { n: 4, id: 'vector-write', detail: 'Upsert summary + chunks into Pinecone pws-brain tools+core (buildPineconeRecords).' },
      { n: 5, id: 'trigger', detail: 'Wire a sensor/trigger (frozen reach) + dispatch map -> command. Chain FEEDS_INTO neighbors.' },
      { n: 6, id: 'register', detail: 'Register the phase: CONTEXT.md + CANON-PHASE-MAP row + ROADMAP entry + framework-names.json.' },
    ],
  };
}

module.exports = {
  auditSpecPart8: auditSpecPart8,
  buildFrameworkCypher: buildFrameworkCypher,
  buildPineconeRecords: buildPineconeRecords,
  ingestPlan: ingestPlan,
  slug: slug,
  PART8_FORBIDDEN: PART8_FORBIDDEN,
};
