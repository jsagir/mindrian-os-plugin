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

// ---------- Phase 172-12: step-5 as a THIN CALLER of CIRS (Canon Part 11) ----------
//
// Canon Part 11 R2 (Born-wired): a new/modified surface fails the gate CLOSED
// unless it is WIRED (a `connector:` block) or EXCLUDED-with-reason. Phase 171's
// ingest step-5 used to be a free-text hand-wiring checklist. Rewritten here as a
// THIN CALLER of the CIRS born-wired wiring rules: it emits the EXACT connector
// block the new methodology must carry to be born-wired (so every future
// ingested methodology is born contextually-invocable, not dark), and asserts
// that block would PASS the coverage gate at ingest time.
//
// It reuses the FROZEN reach bank (REACH_IDS) -- it mints NO 7th reach (the
// SENS-09 precedent: a methodology trigger reuses brain_consult). The connector
// block carries ONLY generic machinery handles (a frozen reach_id, a frozen
// posture, the published framework NAME, a sensor-trigger id, render labels) --
// never user/venture content (Part 8).

// The frozen reach bank + posture bank, read from the single source of truth so
// step-5 can never drift onto an unfrozen reach. Required defensively (the engine
// is otherwise zero-import); soft-fall-back to the canonical frozen literals so a
// load fault never breaks the pure ingest path.
let FROZEN_REACH_IDS;
let FROZEN_POSTURE_IDS;
try {
  const st = require('./sensors/sensor-types.cjs');
  FROZEN_REACH_IDS = Array.isArray(st.REACH_IDS) ? st.REACH_IDS.slice() : null;
  FROZEN_POSTURE_IDS = Array.isArray(st.POSTURE_IDS) ? st.POSTURE_IDS.slice() : null;
} catch (_e) {
  FROZEN_REACH_IDS = null;
  FROZEN_POSTURE_IDS = null;
}
if (!FROZEN_REACH_IDS) {
  FROZEN_REACH_IDS = ['context_block', 'contradiction', 'cross_room', 'brain_consult', 'deep_research', 'hats'];
}
if (!FROZEN_POSTURE_IDS) {
  FROZEN_POSTURE_IDS = ['push_forward', 'hold', 'pull_back'];
}

// The default born-wired reach for an ingested methodology: brain_consult (the
// methodology-lookup reach -- the SENS-09 precedent). A spec MAY name a different
// frozen reach via spec.reach_id; an UNFROZEN value is rejected to brain_consult
// so step-5 can never recommend a 7th reach.
const DEFAULT_INGEST_REACH = 'brain_consult';
const DEFAULT_INGEST_POSTURE = 'push_forward';

/**
 * Emit the CIRS born-wired connector-block recommendation for an ingested
 * methodology (Canon Part 11 R1 WIRED / R2 born-wired). The returned block is the
 * connector: frontmatter the methodology's command surface must carry so it is
 * born contextually-invocable. Generic machinery handles ONLY (Part 8).
 *
 * @param {object} spec -- the normalized methodology spec
 * @returns {object} { connects_to_spine, sensor_triggers, reach_id, sub_mode,
 *                     framework, posture, filing, plan_gated, web_scope, surface }
 */
function bornWiredConnector(spec) {
  const s = (spec && typeof spec === 'object') ? spec : {};
  const reach = (typeof s.reach_id === 'string' && FROZEN_REACH_IDS.indexOf(s.reach_id) !== -1)
    ? s.reach_id : DEFAULT_INGEST_REACH;
  const posture = (typeof s.posture === 'string' && FROZEN_POSTURE_IDS.indexOf(s.posture) !== -1)
    ? s.posture : DEFAULT_INGEST_POSTURE;
  const fwSlug = slug(s.name);
  // A born-wired methodology declares a sensor trigger so it is CONTEXT-triggered
  // (R3), not dark. The spec may name an existing SENS id; absent, the
  // recommendation carries a placeholder the maintainer must mint under
  // lib/core/sensors/ in step-5 (reusing the frozen reach above).
  const sensorTrigger = (typeof s.trigger_sensor === 'string' && s.trigger_sensor)
    ? s.trigger_sensor : ('SENS-' + (fwSlug || 'new'));
  return {
    connects_to_spine: true,
    sensor_triggers: [sensorTrigger],
    reach_id: reach,                 // FROZEN reach (no 7th reach minted)
    sub_mode: fwSlug || 'methodology',
    framework: s.name,               // the EXACT published framework NAME (resolver key)
    posture: posture,                // FROZEN posture
    hierarchy_rank: (typeof s.hierarchy_rank === 'number') ? s.hierarchy_rank : 50,
    filing: 'fileEvidenceWithReadback',
    plan_gated: false,
    web_scope: null,
    surface: 'F.1',
  };
}

/**
 * Assert a born-wired connector recommendation would PASS the coverage gate at
 * ingest time (R2): it is WIRED (connects_to_spine true), uses a FROZEN reach +
 * FROZEN posture (no 7th reach), and names a framework. Returns
 * { wired, gate_pass, reasons } -- gate_pass=false means the methodology would be
 * born DARK and the ingest must not proceed to wire it as-is.
 */
function wouldPassCoverageGate(connector) {
  const c = (connector && typeof connector === 'object') ? connector : {};
  const reasons = [];
  const wired = c.connects_to_spine === true;
  if (!wired) reasons.push('not wired (connects_to_spine !== true)');
  if (FROZEN_REACH_IDS.indexOf(c.reach_id) === -1) reasons.push('reach_id not in the frozen 6');
  if (FROZEN_POSTURE_IDS.indexOf(c.posture) === -1) reasons.push('posture not in the frozen 3');
  if (typeof c.framework !== 'string' || !c.framework) reasons.push('no framework name');
  const gate_pass = reasons.length === 0;
  return { wired: wired, gate_pass: gate_pass, reasons: reasons };
}

// ---------- the 6-step plan (for dry-run + the command to follow) ----------

/**
 * Produce the ordered ingestion plan with the boundary gate result attached.
 * The maintainer command renders this and HALTS at step 2 if the gate is dirty.
 *
 * Phase 172-12: step-5 is now a THIN CIRS CALLER -- it carries the born-wired
 * connector RECOMMENDATION (bornWiredConnector) + the gate-pass assertion
 * (wouldPassCoverageGate), not a free-text hand-wiring checklist. So every
 * ingested methodology is born WIRED (R2) + would pass the coverage gate.
 */
function ingestPlan(spec) {
  const audit = auditSpecPart8(spec);
  const connector = bornWiredConnector(spec);
  const gate = wouldPassCoverageGate(connector);
  return {
    framework: spec && spec.name,
    gate_clean: audit.clean,
    steps: [
      { n: 1, id: 'encode', detail: 'Normalize the methodology into generic graph nodes (framework + variables + cases + steps + critiques).' },
      { n: 2, id: 'boundary-gate', detail: 'Canon Part 8 audit -- fail closed if the spec carries user/venture data.', result: audit },
      { n: 3, id: 'graph-write', detail: 'MERGE into Neo4j via my-neo4j (buildFrameworkCypher).' },
      { n: 4, id: 'vector-write', detail: 'Upsert summary + chunks into Pinecone pws-brain tools+core (buildPineconeRecords).' },
      {
        n: 5,
        id: 'born-wired',
        // THIN CIRS CALLER (Canon Part 11 R2): emit the connector block the
        // methodology must carry to be born WIRED + assert it passes the gate.
        detail: 'CIRS born-wired (Canon Part 11 R2): give the framework a connector: block (frozen reach, no 7th reach minted) so it is born contextually-invocable + passes the coverage gate at ingest. Chain FEEDS_INTO neighbors (buildFrameworkCypher chains_in/chains_out).',
        connector: connector,
        coverage_gate: gate,
      },
      { n: 6, id: 'register', detail: 'Register the phase: CONTEXT.md + CANON-PHASE-MAP row + ROADMAP entry + framework-names.json.' },
    ],
  };
}

module.exports = {
  auditSpecPart8: auditSpecPart8,
  buildFrameworkCypher: buildFrameworkCypher,
  buildPineconeRecords: buildPineconeRecords,
  bornWiredConnector: bornWiredConnector,
  wouldPassCoverageGate: wouldPassCoverageGate,
  ingestPlan: ingestPlan,
  slug: slug,
  PART8_FORBIDDEN: PART8_FORBIDDEN,
  FROZEN_REACH_IDS: FROZEN_REACH_IDS,
  FROZEN_POSTURE_IDS: FROZEN_POSTURE_IDS,
};
