'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 143-03 Task 1 -- the hat -> web-tool scoping table (Canon Part 2).
 *
 * Canon Part 2 "EXTERNAL WEB" affordance is hat-scoped:
 *   White: Tavily + arxiv for data and research.
 *   Green: patents + arxiv + deep-research for innovation.
 *   Black: failure-case and risk searches.
 *   Yellow: success-case and benefit searches.
 *   Red: no external tool (intuition only).
 *   Blue: synthesis across the other hats' returns.
 *
 * This module makes that affordance table machine-readable. hatScopeFor(hat)
 * returns the hat's web scope: the tool set, a focus tag, and whether external
 * web is enabled at all. SENS-04 (sensor-external-fact.cjs) reads this to scope
 * the external-fact reach by the active hat.
 *
 * Part 8: this table holds ONLY generic tool names + focus tags. It carries no
 * user content and makes no network call -- a pure lookup. The Part-8 sweep over
 * lib/core/sensors/ spans this file; it adds zero Brain egress surface.
 *
 * Pure / sync / zero-I/O. node built-ins only. No new deps.
 * House rule: hyphens only, no em-dashes.
 */

// The six-hat web-scope table. Each entry:
//   web_enabled : whether the hat reaches external web at all (Red = false)
//   tools       : the generic tool-name handles in scope for the hat
//   focus       : the search focus tag (data / innovation / failure / success / synthesis)
//   deep_research: whether the deep-research escalation lane is in scope (Green)
const HAT_SCOPE = Object.freeze({
  White: Object.freeze({
    web_enabled: true,
    tools: Object.freeze(['Tavily', 'arxiv']),
    focus: 'data-and-research',
    deep_research: false,
  }),
  Green: Object.freeze({
    web_enabled: true,
    tools: Object.freeze(['patents', 'arxiv', 'deep-research']),
    focus: 'innovation',
    deep_research: true,
  }),
  Black: Object.freeze({
    web_enabled: true,
    tools: Object.freeze(['Tavily', 'arxiv']),
    focus: 'failure-and-risk-cases',
    deep_research: false,
  }),
  Yellow: Object.freeze({
    web_enabled: true,
    tools: Object.freeze(['Tavily', 'arxiv']),
    focus: 'success-and-benefit-cases',
    deep_research: false,
  }),
  Red: Object.freeze({
    web_enabled: false,
    tools: Object.freeze([]),
    focus: 'intuition-only',
    deep_research: false,
  }),
  Blue: Object.freeze({
    web_enabled: true,
    tools: Object.freeze(['synthesis']),
    focus: 'synthesis-across-hats',
    deep_research: false,
  }),
});

// The default scope when the hat is unknown / absent. Treated as a White-like
// data lane (the most conservative reachable lane) so an unrecognized hat still
// gets a tool-choice gate rather than a silent dispatch. Never auto-enables
// deep-research for an unknown hat.
const DEFAULT_SCOPE = Object.freeze({
  web_enabled: true,
  tools: Object.freeze(['Tavily', 'arxiv']),
  focus: 'data-and-research',
  deep_research: false,
});

/**
 * Return the web scope for a hat per Canon Part 2. Defensive: a non-string or
 * unknown hat returns the default (White-like) scope. Red returns a
 * web_enabled=false scope (intuition only -- no external tool).
 *
 * @param {string} hat -- one of White/Green/Black/Yellow/Red/Blue (case-sensitive
 *                         canonical capitalization; a lowercase form is normalized)
 * @returns {Readonly<object>} { web_enabled, tools, focus, deep_research }
 */
function hatScopeFor(hat) {
  if (typeof hat !== 'string' || hat.length === 0) return DEFAULT_SCOPE;
  // Normalize to canonical capitalization (white -> White) so callers may pass
  // either form; the table key is canonical.
  const key = hat.charAt(0).toUpperCase() + hat.slice(1).toLowerCase();
  return Object.prototype.hasOwnProperty.call(HAT_SCOPE, key) ? HAT_SCOPE[key] : DEFAULT_SCOPE;
}

module.exports = {
  hatScopeFor: hatScopeFor,
  HAT_SCOPE: HAT_SCOPE,
};
