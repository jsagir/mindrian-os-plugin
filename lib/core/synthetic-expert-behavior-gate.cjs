'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * synthetic-expert-behavior-gate.cjs -- local, deterministic classifier for
 * SYNTHETIC-EXPERT BEHAVIORAL fidelity (Phase 203-04, Plurai surface B).
 * =========================================================================
 * The runtime-safe half of the behavioral-fidelity eval gate: it reproduces the
 * Plurai fable judge's faithful/costume verdict OFFLINE, so the INVOKED skill
 * (Directive 2, Plan 203-02 materializer) can be regression-checked WITHOUT a live
 * Plurai call (Canon Part 8: Plurai is build/CI only, synthetic data only).
 *
 * WHERE SURFACE A JUDGED THE COSTUME, surface B judges the PERFORMANCE: when the
 * skill is invoked, does it reason IN CHARACTER from its hat + domain lens, and does
 * it stay FAITHFUL to the RS expert-graph it reads? A transcript that drifts out of
 * its lens, invents an ungrounded claim, or answers off-role is a costume even if it
 * reads fluently. Together with surface A (construction), the two make the expert an
 * actual lens, not a costume.
 *
 * A sample is a COSTUME when ANY invariant is breached. The invariants are HARD
 * checks (booleans), never data-swept and never overridable by an options object --
 * a violating transcript stays a costume. "A gate that cannot fail is not a gate."
 * The second arg is accepted (callers may pass context) but DELIBERATELY IGNORED.
 *
 * Pure + offline. Node built-ins only. NO em-dashes anywhere (CLAUDE.md HARD RULE).
 *
 * License: BSL 1.1.
 */

// Part-8 forbidden bytes: a behavior transcript is SYNTHETIC. A concrete venture
// magnitude, a currency figure, or an email address is a leak.
const FORBIDDEN_BYTES = Object.freeze([
  { name: 'currency', re: /\$\s?\d/ },
  { name: 'email', re: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i },
  { name: 'venture_magnitude', re: /\b\d[\d,.]*\s?(million|billion)\b/i },
]);

// Em-dash (U+2014) and en-dash (U+2013) are both banned in every surface byte.
const EM_DASH = /[—–]/;

function scanForbidden(raw) {
  const hits = [];
  for (const f of FORBIDDEN_BYTES) {
    if (f.re.test(raw)) hits.push(f.name);
  }
  return hits;
}

// The behavior law as predicates over an invoked-skill transcript. Each hit(x, raw)
// returns true when the invariant is BREACHED. The three role invariants are POSITIVE
// contracts encoded as their negation (in_lens:true good, grounded:true good,
// off_role:false good); the two byte invariants scan the serialized transcript.
const BEHAVIOR_INVARIANTS = Object.freeze([
  // The response must stay inside the expert's hat + domain lens.
  {
    name: 'out_of_lens',
    hit: function (x) { return x.in_lens === false; },
  },
  // The response must cite / stay faithful to the RS expert-graph it reads.
  {
    name: 'ungrounded',
    hit: function (x) { return x.grounded === false; },
  },
  // The response must answer in-role (never answer a question outside its remit).
  {
    name: 'off_role',
    hit: function (x) { return x.off_role === true; },
  },
  // Part-8: no forbidden venture byte may ride a synthetic transcript.
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
 * classifyBehavior(sample, _optsIgnored)
 *   -> { label: 'faithful' | 'costume', violations: [...] }
 *
 * The second arg is accepted but DELIBERATELY IGNORED for the verdict -- the
 * invariants are the law, not a knob. A transcript is faithful only when NO invariant
 * is breached (in-character reasoning from hat + domain, grounded in the expert-graph).
 */
function classifyBehavior(sample, _optsIgnored) {
  const x = (sample && typeof sample === 'object') ? sample : {};
  const raw = JSON.stringify(x);
  const violations = [];
  for (const inv of BEHAVIOR_INVARIANTS) {
    if (inv.hit(x, raw)) violations.push(inv.name);
  }
  return { label: violations.length === 0 ? 'faithful' : 'costume', violations: violations };
}

module.exports = { classifyBehavior, BEHAVIOR_INVARIANTS };
