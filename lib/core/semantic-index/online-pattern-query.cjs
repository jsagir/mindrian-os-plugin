/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 214-02 -- online-pattern-query: the Part-8-safe egress composer for
 * find-analogies' online leg.
 *
 * Canon Part 8 framing: the web is the SIGNAL channel. SIGNAL -> LOCAL is YES;
 * what crosses OUTBOUND is ONLY the abstracted pattern vocabulary (SAPPhIRE
 * functional keywords, TRIZ principle names, the domain-generic abstract
 * function). Abstraction IS the fence (Pattern 2); this module makes it
 * mechanical. It COMPOSES and AUDITS. It NEVER transmits.
 *
 * The outbound audit reuses the SHIPPED chokepoint auditQueryString from
 * lib/core/rs-egress-prompts.cjs (the same seam rs-differential-scorer.cjs
 * proves at lines 314-322). There is NO private forbidden-pattern copy here
 * (the Phase 196 no-private-copies precedent): one fence, one truth. Every
 * composed query string is audited inline BEFORE it can be returned; the first
 * throw aborts composition and maps to an honest local-only degrade envelope
 * that names ONLY the family, never the offending string (info-disclosure
 * hygiene). No send-anyway verb exists (Phase 196 D-01 precedent).
 *
 * DG-2 (fence mechanism): the Phase 196 runtime egress hook matches Brain MCP
 * tool calls only (hooks.json; Phase 239 BRAIN-01 corrected the live matcher
 * to mcp__(?:plugin_[a-z0-9_-]+_)?mindrian-brain__.*, replacing the dead
 * mcp__brain_.* literal that never matched a live registered name), so
 * Tavily/web egress is NOT covered by it either way. This module wires the
 * fence INLINE rather than relying on that hook. A hook-level PreToolUse
 * matcher for the web surface is an additive follow-up, never a replacement
 * for this inline audit.
 *
 * Zero network surface: no http / https / net require, no fetch, no MCP
 * surface. The actual Tavily/WebSearch calls live at the command layer, behind
 * navigator confirmation (plan 214-03).
 *
 * Pure CJS, zero npm deps.
 */
'use strict';

const { auditQueryString } = require('../rs-egress-prompts.cjs');

// The three query families the command's existing --external mode already
// specs (biomimicry / patents / academic). Frozen: a bounded, predictable
// egress budget, not an open-ended generator.
const QUERY_FAMILIES = Object.freeze(['biomimicry', 'patents', 'academic']);

// The outbound surface tag stamped on every audit call (audit-trail identity).
const SURFACE = 'find-analogies-online';

// Bounded composition caps -- a predictable egress budget per invocation.
const BIOMIMICRY_KEYWORD_CAP = 3; // one query per keyword, first three
const PATENT_PRINCIPLE_CAP = 1;   // first principle only
const PATENT_KEYWORD_CAP = 2;     // paired with the first two keywords

function isNonEmptyString(x) {
  return typeof x === 'string' && x.trim().length > 0;
}

// Compose the candidate query strings from the abstracted pattern vocabulary.
// ONLY the three pattern fields plus the fixed template words may appear. This
// is pure string assembly -- no audit here; the caller audits every candidate.
function composeCandidates(pattern) {
  const p = pattern || {};
  const keywords = (Array.isArray(p.functionalKeywords) ? p.functionalKeywords : [])
    .filter(isNonEmptyString)
    .map(function (k) { return k.trim(); });
  const principles = (Array.isArray(p.trizPrinciples) ? p.trizPrinciples : [])
    .filter(isNonEmptyString)
    .map(function (t) { return t.trim(); });
  const abstractFunction = isNonEmptyString(p.abstractFunction) ? p.abstractFunction.trim() : '';

  const candidates = [];

  // biomimicry: "how does nature <functionalKeyword>" (one per keyword, cap 3).
  keywords.slice(0, BIOMIMICRY_KEYWORD_CAP).forEach(function (kw) {
    candidates.push({ family: 'biomimicry', q: 'how does nature ' + kw });
  });

  // patents: "<trizPrinciple> <functionalKeyword> patent"
  // (first principle x first two keywords).
  principles.slice(0, PATENT_PRINCIPLE_CAP).forEach(function (pr) {
    keywords.slice(0, PATENT_KEYWORD_CAP).forEach(function (kw) {
      candidates.push({ family: 'patents', q: pr + ' ' + kw + ' patent' });
    });
  });

  // academic: "<abstractFunction> cross-domain solution".
  if (abstractFunction !== '') {
    candidates.push({ family: 'academic', q: abstractFunction + ' cross-domain solution' });
  }

  return candidates;
}

// composePatternQueries(pattern, opts)
//   pattern = { functionalKeywords: string[], trizPrinciples: string[], abstractFunction: string }
//   opts.auditFn - injection seam for tests; defaults to the shipped fence.
//
// Returns one of:
//   {ok:true, queries:[{family, q}], audited:number}
//   {ok:false, degrade:'local-only', reason:'egress_violation', family:string}
//   {ok:false, degrade:'local-only', reason:'empty_pattern'}
function composePatternQueries(pattern, opts) {
  const options = opts || {};
  const auditFn = typeof options.auditFn === 'function' ? options.auditFn : auditQueryString;

  const candidates = composeCandidates(pattern);

  // Nothing composable from the abstracted vocabulary -> nothing to audit,
  // nothing to send. Honest local-only degrade without touching the fence.
  if (candidates.length === 0) {
    return { ok: false, degrade: 'local-only', reason: 'empty_pattern' };
  }

  // Audit EVERY string inline, synchronously, BEFORE it can be returned. The
  // first throw aborts composition and degrades to local-only. We name ONLY the
  // family being composed, never the offending string (no content echo).
  const queries = [];
  let audited = 0;
  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    try {
      auditFn(candidate.q, SURFACE);
    } catch (err) {
      // Any throw from the fence is a violation signal -> fail closed. We do
      // not distinguish beyond "the audit refused it"; the envelope leaks
      // nothing but the family name.
      return { ok: false, degrade: 'local-only', reason: 'egress_violation', family: candidate.family };
    }
    audited += 1;
    queries.push(candidate);
  }

  return { ok: true, queries: queries, audited: audited };
}

// _test: internal seams exposed for the offline contract suite only.
const _test = { composeCandidates: composeCandidates, SURFACE: SURFACE };

module.exports = {
  QUERY_FAMILIES,
  composePatternQueries,
  _test,
};
