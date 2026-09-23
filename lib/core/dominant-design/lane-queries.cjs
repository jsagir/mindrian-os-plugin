'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 361-03 -- dominant-design lane-query composer.
 *
 * D-03/D-04/D-05 (Canon Part 8): this module is the ONLY source of outbound
 * web query strings for the /mos:dominant-designs research path. Four fixed
 * lanes, one audited query each, in a frozen fixed order (variant_census,
 * convergence_signals, s_curve_limits, discontinuity_signals). Every composed
 * or navigator-edited string passes the SHIPPED auditQueryString fence
 * (lib/core/rs-egress-prompts.cjs) BEFORE it can be returned; a violation
 * degrades to an honest local-only envelope that names only the lane, never
 * the offending string (info-disclosure hygiene, the online-pattern-query
 * Phase 214-02 precedent, lib/core/eureka/online-pattern-query.cjs). There is
 * no send-anyway path.
 *
 * composeLaneQueries(input, opts):
 *   input = { domain: string }
 *   opts.auditFn - injection seam for tests; defaults to the shipped fence.
 *   returns { ok:true, domain_slug, lanes, audited, tavily_params,
 *             max_queries_per_lane }
 *        or { ok:false, degrade:'local-only', reason:'empty_domain' }
 *        or { ok:false, degrade:'local-only', reason:'bad_domain' }
 *        or { ok:false, degrade:'local-only', reason:'egress_violation', lane }
 *
 * auditEditedQuery(q, opts) re-audits ONE navigator-edited query string with
 * the same fence plus length/newline checks. The navigator can edit a
 * composed query at the gate card; every edit is re-audited here before it
 * can reach a fetch.
 *
 * Pure CJS: no fs, no network, no clock. Zero npm deps beyond the shipped
 * Part 8 fence.
 *
 * No em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const { auditQueryString } = require('../rs-egress-prompts.cjs');

const SURFACE = 'dominant-design';

const MAX_QUERIES_PER_LANE = 2;
const MAX_QUERY_CHARS = 200;
const MAX_DOMAIN_CHARS = 80;

// LANES: the frozen D-05 four-lane order. Each lane's `question` restates the
// D-05 ruling in plain words; `template` is the fixed word-string appended
// after the navigator's domain to form the one audited query per lane.
const LANES = Object.freeze([
  Object.freeze({
    id: 'variant_census',
    abbrev: 'VC',
    label: 'Variant census',
    question: 'which competing designs exist in this domain, when each first appeared, and who backs it',
    template: 'competing designs history first introduced',
  }),
  Object.freeze({
    id: 'convergence_signals',
    abbrev: 'CS',
    label: 'Convergence signals',
    question: 'which standards, market-share shifts, exits and consolidations show the market settling, with dates',
    template: 'industry standard adoption market share consolidation',
  }),
  Object.freeze({
    id: 's_curve_limits',
    abbrev: 'SL',
    label: 'S-curve limits',
    question: 'the physical, market and economic ceilings of the current dominant design',
    template: 'performance limits diminishing returns cost ceiling',
  }),
  Object.freeze({
    id: 'discontinuity_signals',
    abbrev: 'DS',
    label: 'Discontinuity signals',
    question: 'new entrants, substitutes, and patent or funding bursts that could break it',
    template: 'new entrants substitute technology patents funding',
  }),
]);

const LANE_IDS = Object.freeze(LANES.map(function (lane) { return lane.id; }));

// TAVILY_PARAMS: the fixed search parameters for every lane call (Claude's
// discretion, stated in 361-CONTEXT.md).
const TAVILY_PARAMS = Object.freeze({
  search_depth: 'basic',
  topic: 'general',
  max_results: 10,
});

// domainSlug(domain) -- lowercase, non-alphanumerics collapsed to single
// hyphens, trimmed of leading/trailing hyphens, capped at 60 chars. Never
// empty for a valid (already-validated) domain: falls back to 'domain' in the
// degenerate case of an all-punctuation input, which composeLaneQueries never
// reaches in practice since such a domain fails the audit or is empty first.
function domainSlug(domain) {
  const s = typeof domain === 'string' ? domain : '';
  const slug = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'domain';
}

function collapseWhitespace(s) {
  return s.replace(/\s+/g, ' ').trim();
}

// composeLaneQueries(input, opts) -- the one audited source of outbound
// strings. Validates the raw domain (CR/LF check on the RAW string, before
// whitespace collapse), then builds and audits one query per lane in the
// fixed D-05 order. The FIRST audit failure aborts composition and returns a
// local-only degrade naming only the lane, never the offending string.
function composeLaneQueries(input, opts) {
  const options = opts || {};
  const auditFn = typeof options.auditFn === 'function' ? options.auditFn : auditQueryString;

  const rawDomain = (input && typeof input.domain === 'string') ? input.domain : '';

  // CR/LF checked on the RAW input, before any whitespace collapse, so a
  // newline cannot hide inside what collapseWhitespace would otherwise turn
  // into an innocuous single space.
  if (/[\r\n]/.test(rawDomain)) {
    return { ok: false, degrade: 'local-only', reason: 'bad_domain' };
  }

  const domain = collapseWhitespace(rawDomain);

  if (domain.length === 0) {
    return { ok: false, degrade: 'local-only', reason: 'empty_domain' };
  }

  if (domain.length > MAX_DOMAIN_CHARS) {
    return { ok: false, degrade: 'local-only', reason: 'bad_domain' };
  }

  const lanes = [];
  let audited = 0;
  for (let i = 0; i < LANES.length; i += 1) {
    const lane = LANES[i];
    const q = domain + ' ' + lane.template;
    try {
      auditFn(q, SURFACE);
    } catch (_err) {
      // Any throw from the fence is a violation signal -> fail closed. Name
      // only the lane; never echo the offending string.
      return { ok: false, degrade: 'local-only', reason: 'egress_violation', lane: lane.id };
    }
    audited += 1;
    lanes.push({
      id: lane.id,
      abbrev: lane.abbrev,
      label: lane.label,
      question: lane.question,
      queries: [q],
    });
  }

  return {
    ok: true,
    domain_slug: domainSlug(domain),
    lanes: lanes,
    audited: audited,
    tavily_params: TAVILY_PARAMS,
    max_queries_per_lane: MAX_QUERIES_PER_LANE,
  };
}

// auditEditedQuery(q, opts) -- re-audits ONE navigator-edited query string
// before it can reach the gate card's approved set. Same fence as
// composeLaneQueries, plus the length/newline checks a raw edit box needs.
function auditEditedQuery(q, opts) {
  const options = opts || {};
  const auditFn = typeof options.auditFn === 'function' ? options.auditFn : auditQueryString;

  if (typeof q !== 'string' || q.trim().length === 0) {
    return { ok: false, reason: 'empty_query' };
  }
  if (/[\r\n]/.test(q)) {
    return { ok: false, reason: 'bad_query' };
  }
  if (q.length > MAX_QUERY_CHARS) {
    return { ok: false, reason: 'too_long' };
  }
  try {
    auditFn(q, SURFACE);
  } catch (_err) {
    // No echo: the failure reason alone is returned, never the string.
    return { ok: false, reason: 'egress_violation' };
  }
  return { ok: true, q: q };
}

module.exports = {
  LANES,
  LANE_IDS,
  TAVILY_PARAMS,
  MAX_QUERIES_PER_LANE,
  MAX_QUERY_CHARS,
  MAX_DOMAIN_CHARS,
  composeLaneQueries,
  auditEditedQuery,
  domainSlug,
};
