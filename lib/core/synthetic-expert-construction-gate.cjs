'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * synthetic-expert-construction-gate.cjs -- local, deterministic classifier for
 * SYNTHETIC-EXPERT CONSTRUCTION fidelity (Phase 203-04, Plurai surface A).
 * =========================================================================
 * The runtime-safe half of the construction-fidelity eval gate: it reproduces the
 * Plurai fable judge's faithful/hollow verdict OFFLINE, so the GENESIS artifact
 * (Directive 1, Plan 203-01) can be regression-checked WITHOUT a live Plurai call
 * (Canon Part 8: Plurai is build/CI only, synthetic data only, never runtime).
 *
 * WHY A SECOND SURFACE: judging behavior alone lets a costume pass -- a hollow
 * expert can answer one prompt well. This gate judges the CONSTRUCTION independently:
 * a valid de Bono hat, a coherent domain/subdomain, a GENUINE beautiful-question
 * (not a template stub), a research-approach DERIVED from the fan-out (not a generic
 * method), and a real multi-lens fan-out from DISTINCT sources. A costume built from
 * one source wearing many hats FAILS here even if it later answers well.
 *
 * A sample is HOLLOW when ANY invariant is breached. The invariants are HARD checks
 * (booleans), never data-swept and never overridable by an options object -- a
 * violating sample stays hollow. "A gate that cannot fail is not a gate"
 * (ralph-loop-gate.cjs / rs-corpus-quality-gate.cjs precedent). The second arg is
 * accepted (callers may pass context) but DELIBERATELY IGNORED for the verdict.
 *
 * Pure + offline. Node built-ins only. NO em-dashes anywhere (CLAUDE.md HARD RULE).
 *
 * License: BSL 1.1.
 */

// The six de Bono hat colors (mirrors navigation/synthetic-expert.cjs::HAT_COLORS).
// Duplicated as a local frozen constant so the gate is a self-contained law with no
// runtime coupling to the writer.
const HAT_COLORS = Object.freeze(new Set(['White', 'Red', 'Black', 'Yellow', 'Green', 'Blue']));

// The fan-out floor: a genuine multi-lens expert crosses at least this many lenses.
const LENS_FLOOR = 2;

// Template beautiful-question stubs a hollow, hand-authored expert falls back to.
// A genuine question is DERIVED from the domain/subdomain lens (expert-genesis.cjs
// synthesizeExpert), so it never reads as one of these generic placeholders.
const TEMPLATE_STUBS = Object.freeze(new Set([
  'what are the key considerations?',
  'what should we consider?',
  'what are the main factors?',
  'what do we need to think about?',
  'what are the important points?',
  'what matters most here?',
]));

// Generic research-method stubs (identical-across-experts boilerplate). A genuine
// approach cites the fan-out (a distinct-source count) or the lens it cross-examines.
const GENERIC_METHODS = Object.freeze(new Set([
  'apply best practices.',
  'conduct thorough research.',
  'do a comprehensive analysis.',
  'research the topic and summarize.',
  'gather information and report.',
  'use standard methodology.',
]));

// Part-8 forbidden bytes: a construction sample carries only SYNTHETIC/generic
// content. A concrete venture magnitude, a currency figure, or an email address is
// a leak (real proprietary bytes must never ride an eval sample).
const FORBIDDEN_BYTES = Object.freeze([
  { name: 'currency', re: /\$\s?\d/ },
  { name: 'email', re: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i },
  { name: 'venture_magnitude', re: /\b\d[\d,.]*\s?(million|billion)\b/i },
]);

// Em-dash (U+2014) and en-dash (U+2013) are both banned in every surface byte.
const EM_DASH = /[—–]/;

function norm(s) {
  return String(s == null ? '' : s).trim().toLowerCase();
}

function scanForbidden(raw) {
  const hits = [];
  for (const f of FORBIDDEN_BYTES) {
    if (f.re.test(raw)) hits.push(f.name);
  }
  return hits;
}

// The construction law as predicates over a sample. Each hit(x, raw) returns true
// when the invariant is BREACHED. `raw` is the JSON serialization of the sample
// (so byte-level scans see the full content).
const CONSTRUCTION_INVARIANTS = Object.freeze([
  // The hat must be a real de Bono color.
  {
    name: 'invalid_hat',
    hit: function (x) { return !HAT_COLORS.has(x.hat); },
  },
  // The domain and subdomain must both be coherent (non-empty).
  {
    name: 'incoherent_domain',
    hit: function (x) { return norm(x.domain).length === 0 || norm(x.subdomain).length === 0; },
  },
  // The beautiful-question must be GENUINE: not a template stub, and derived from
  // the lens (references the domain or subdomain it interrogates).
  {
    name: 'template_question',
    hit: function (x) {
      const q = norm(x.beautiful_question);
      if (q.length === 0) return true;
      if (TEMPLATE_STUBS.has(q)) return true;
      const dom = norm(x.domain);
      const sub = norm(x.subdomain);
      const refsLens = (dom.length > 0 && q.indexOf(dom) !== -1) || (sub.length > 0 && q.indexOf(sub) !== -1);
      return !refsLens;
    },
  },
  // The research-approach must be DERIVED, not generic: not a boilerplate stub, and
  // it must cite the fan-out (a source count) or the lens.
  {
    name: 'generic_method',
    hit: function (x) {
      const a = norm(x.research_approach);
      if (a.length === 0) return true;
      if (GENERIC_METHODS.has(a)) return true;
      const dom = norm(x.domain);
      const sub = norm(x.subdomain);
      const refsFanout = a.indexOf('source') !== -1
        || (dom.length > 0 && a.indexOf(dom) !== -1)
        || (sub.length > 0 && a.indexOf(sub) !== -1);
      return !refsFanout;
    },
  },
  // The fan-out must cross at least LENS_FLOOR lenses.
  {
    name: 'insufficient_fanout',
    hit: function (x) { return !(Number(x.lens_count) >= LENS_FLOOR); },
  },
  // One source wearing many hats: distinct_source_count === 1 is a costume tell.
  {
    name: 'single_source_many_hats',
    hit: function (x) { return Number(x.distinct_source_count) === 1; },
  },
  // Part-8: no forbidden venture byte may ride a synthetic sample.
  {
    name: 'part8_leak',
    hit: function (x, raw) { return scanForbidden(raw).length > 0; },
  },
  // No em-dash / en-dash anywhere.
  {
    name: 'em_dash',
    hit: function (x, raw) { return EM_DASH.test(raw); },
  },
]);

/**
 * classifyConstruction(sample, _optsIgnored)
 *   -> { label: 'faithful' | 'hollow', violations: [...] }
 *
 * The second arg is accepted but DELIBERATELY IGNORED for the verdict -- the
 * invariants are the law, not a knob. A sample is faithful only when NO invariant
 * is breached.
 */
function classifyConstruction(sample, _optsIgnored) {
  const x = (sample && typeof sample === 'object') ? sample : {};
  const raw = JSON.stringify(x);
  const violations = [];
  for (const inv of CONSTRUCTION_INVARIANTS) {
    if (inv.hit(x, raw)) violations.push(inv.name);
  }
  return { label: violations.length === 0 ? 'faithful' : 'hollow', violations: violations };
}

module.exports = { classifyConstruction, CONSTRUCTION_INVARIANTS, HAT_COLORS, LENS_FLOOR };
