/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.2 Plan 06 Task 2 -- Phase 2 deterministic preprocessor.
 *
 * Per-document deterministic processor that produces the canonical 5-field
 * preprocessed shape from raw fetcher output (papers + patents + signals
 * all flow through the same preprocessor with source-aware extraction):
 *
 *   {
 *     document_id     : string  (copy of input.id for traceability)
 *     technical_terms : string[]  (top-N from deterministic n-gram + stopword filter)
 *     concepts        : string[]  (intersection with domain_analysis.concepts)
 *     methods         : string[]  (deterministic verb-phrase patterns)
 *     relevance_score : number  in [0,1]  (concept overlap ratio)
 *     boundary_flag   : boolean  (relevance < 0.5 OR zero concept overlap)
 *   }
 *
 * Determinism contract: same documents + same opts -> byte-identical output.
 * No Math.random, no Date.now, no LLM call. The preprocessor is the
 * deterministic bridge between Wave 2 fetchers (Plans 89.2-02 / 03 / 04)
 * and Wave 3 differential scorer (Task 3 of this plan). It produces the
 * concept[] field that the differential scorer consumes pair-wise.
 *
 * Canon Part 7 (Reuse Before Build): consumes domain_analysis from
 * lib/core/rs-domain-analyzer.cjs (89.1) for concept extraction. May
 * also consume substrate metadata via lib/core/rs-brain-substrate.cjs
 * (89.1a) for boundary_flag heuristic refinement -- the relevance_score
 * derived from domain_analysis IS the boundary signal in v1.11.0.
 *
 * Canon Part 8 (Graph Boundary): two defense-in-depth layers.
 *
 *   Layer 1 -- pre-input scan: domain_analysis fields are scanned for
 *     FORBIDDEN_PATTERNS before any extraction logic runs. On hit, the
 *     preprocessor returns a structured envelope {error, reason} so the
 *     caller knows the upstream component leaked and can repair before
 *     downstream surfaces (the differential scorer + classifier + thesis
 *     generator all flow downstream from preprocessor output).
 *
 *   Layer 2 -- pre-return audit: the composite preprocessed[] output is
 *     scanned via auditQueryObject before return. Throws
 *     ExternalEgressViolation on any FORBIDDEN_PATTERNS hit. Defense-in-
 *     depth so adversarial document.abstract / document.title content
 *     that leaks through extraction is caught at the gate before the
 *     differential scorer sees it.
 *
 * NEVER throws on operational failure (empty input, missing fields, etc.).
 * ONLY throws ExternalEgressViolation on Canon Part 8 boundary breach.
 *
 * Pure CJS, zero npm deps, node built-ins only.
 */
'use strict';

const { auditQueryObject } = require('./rs-egress-prompts.cjs');
const crossRoomAggregator = require('./cross-room-aggregator.cjs');
// rs-egress-violations is required transitively by rs-egress-prompts; we do
// not throw ExternalEgressViolation directly from this module (auditQueryObject
// does). The require below is a reachability witness for the audit chain.
require('./rs-egress-violations.cjs');

const FORBIDDEN_PATTERNS = crossRoomAggregator.FORBIDDEN_PATTERNS;
if (!Array.isArray(FORBIDDEN_PATTERNS) || FORBIDDEN_PATTERNS.length < 6) {
  throw new Error(
    'rs-preprocessor: FORBIDDEN_PATTERNS re-export failed; ' +
    'Canon Part 8 drift risk (expected >= 6 patterns from cross-room-aggregator)'
  );
}

// ---------- Constants ----------

const TECHNICAL_TERMS_MAX = 20;
const CONCEPTS_MAX = 10;
const METHODS_MAX = 5;
const BOUNDARY_THRESHOLD = 0.5;
const TEXT_MAX_LEN = 100000;  // 100KB cap on per-document text scan

// English stopwords (mirror rs-domain-analyzer.cjs STOPWORDS set; frozen).
const STOPWORDS = Object.freeze(new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'have', 'in', 'is', 'it', 'its', 'of', 'on', 'or', 'that',
  'the', 'this', 'to', 'was', 'were', 'will', 'with',
  'i', 'you', 'we', 'they', 'he', 'she', 'our', 'their',
  'about', 'above', 'after', 'again', 'all', 'also', 'any', 'been',
  'before', 'between', 'both', 'but', 'can', 'did', 'do', 'does',
  'into', 'just', 'more', 'most', 'no', 'not', 'now', 'only',
  'over', 'own', 'same', 'so', 'some', 'such', 'than', 'then',
  'there', 'these', 'those', 'through', 'under', 'up', 'very',
  'what', 'when', 'where', 'which', 'who', 'why', 'how',
  'while', 'because', 'against', 'last', 'week', 'held', 'results',
]));

// Technical-term regex: lowercase alphanumeric tokens 4-20 chars, optionally hyphenated.
const TECHNICAL_TERM_REGEX = /\b[a-z][a-z0-9]{3,19}(?:-[a-z0-9]{1,15})?\b/gi;

// Method-verb regex: deterministic verb-phrase capture.
const METHOD_REGEX = /\b(applied|used|tested|measured|computed|calculated|analyzed|developed|implemented|proposed|designed)\s+([a-z][a-z0-9 -]{2,30})\b/gi;

// ---------- preInputScan ----------
//
// Scans every string field of the domain_analysis input against
// FORBIDDEN_PATTERNS. Returns true if any field hits a forbidden pattern.

function preInputScan(da) {
  if (!da || typeof da !== 'object') return false;
  for (const key of Object.keys(da)) {
    const v = da[key];
    if (typeof v === 'string') {
      for (const re of FORBIDDEN_PATTERNS) {
        if (re.test(v)) return true;
      }
    } else if (Array.isArray(v)) {
      for (const item of v) {
        if (typeof item === 'string') {
          for (const re of FORBIDDEN_PATTERNS) {
            if (re.test(item)) return true;
          }
        }
      }
    }
  }
  return false;
}

// ---------- tokenize ----------
//
// Lowercase, alpha+digit only, length >= 3, stopwords stripped.
// Deterministic.

function tokenize(s) {
  if (typeof s !== 'string') return [];
  const truncated = s.length > TEXT_MAX_LEN ? s.slice(0, TEXT_MAX_LEN) : s;
  return truncated.toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .split(/\s+/)
    .filter(function (t) { return t.length >= 3 && !STOPWORDS.has(t); });
}

// ---------- extractTechnicalTerms ----------
//
// Extract technical terms from text via TECHNICAL_TERM_REGEX. Lowercase,
// dedupe, filter stopwords, count by frequency, sort by count desc + alpha,
// take top TECHNICAL_TERMS_MAX. Determinism anchor: when counts tie, alpha
// sort breaks ties so output is byte-stable.

function extractTechnicalTerms(text) {
  if (typeof text !== 'string' || text.length === 0) return [];
  const truncated = text.length > TEXT_MAX_LEN ? text.slice(0, TEXT_MAX_LEN) : text;
  const matches = truncated.toLowerCase().match(TECHNICAL_TERM_REGEX) || [];
  const counts = new Map();
  for (const m of matches) {
    const t = m.trim();
    if (t.length < 4 || STOPWORDS.has(t)) continue;
    counts.set(t, (counts.get(t) || 0) + 1);
  }
  const arr = [];
  for (const [term, count] of counts.entries()) {
    arr.push({ term: term, count: count });
  }
  arr.sort(function (a, b) {
    if (b.count !== a.count) return b.count - a.count;
    return a.term < b.term ? -1 : (a.term > b.term ? 1 : 0);
  });
  return arr.slice(0, TECHNICAL_TERMS_MAX).map(function (e) { return e.term; });
}

// ---------- extractConcepts ----------
//
// Intersection of text tokens with domain_analysis.concepts. Deterministic.
// Capped at CONCEPTS_MAX. Order: domain_analysis.concepts iteration order.

function extractConcepts(text, da) {
  if (!da || !Array.isArray(da.concepts) || da.concepts.length === 0) return [];
  if (typeof text !== 'string' || text.length === 0) return [];
  const tokens = new Set(tokenize(text));
  const out = [];
  const seen = new Set();
  for (const c of da.concepts) {
    if (typeof c !== 'string') continue;
    const cl = c.toLowerCase();
    if (seen.has(cl)) continue;
    if (tokens.has(cl)) {
      seen.add(cl);
      out.push(cl);
      if (out.length >= CONCEPTS_MAX) break;
    }
  }
  return out;
}

// ---------- extractMethods ----------
//
// Deterministic verb-phrase capture via METHOD_REGEX. Take match group 2,
// trim, lowercase, dedupe, cap at METHODS_MAX.

function extractMethods(text) {
  if (typeof text !== 'string' || text.length === 0) return [];
  const truncated = text.length > TEXT_MAX_LEN ? text.slice(0, TEXT_MAX_LEN) : text;
  const out = [];
  const seen = new Set();
  let match;
  // Reset regex stateful position for safety.
  METHOD_REGEX.lastIndex = 0;
  while ((match = METHOD_REGEX.exec(truncated)) !== null) {
    const phrase = (match[2] || '').trim().toLowerCase();
    if (phrase.length === 0) continue;
    if (seen.has(phrase)) continue;
    seen.add(phrase);
    out.push(phrase);
    if (out.length >= METHODS_MAX) break;
  }
  return out;
}

// ---------- computeRelevance ----------
//
// Concept-overlap ratio (concepts found in text / total domain_analysis.concepts).
// Bounded [0,1]. Deterministic.

function computeRelevance(text, da) {
  if (!da || !Array.isArray(da.concepts) || da.concepts.length === 0) return 0;
  if (typeof text !== 'string' || text.length === 0) return 0;
  const overlap = extractConcepts(text, da).length;
  const ratio = overlap / da.concepts.length;
  return Math.max(0, Math.min(1, ratio));
}

// ---------- computeBoundaryFlag ----------
//
// True if relevance below threshold OR zero concept overlap. The boundary
// flag tells the differential scorer (and classifier downstream) that this
// document is on the edge of the user's substrate; cross-domain analogies
// surface most strongly when at least one side is boundary-flagged.

function computeBoundaryFlag(relevance, concepts) {
  if (typeof relevance !== 'number' || isNaN(relevance)) return true;
  if (!Array.isArray(concepts) || concepts.length === 0) return true;
  return relevance < BOUNDARY_THRESHOLD;
}

// ---------- preprocess ----------
//
// Public entry point. Takes raw fetcher output (papers + patents + signals)
// and produces deterministic per-document preprocessed records.
//
// Inputs:
//   documents  Array<{id, abstract?, signal?, title?, source?, ...}>
//   opts       optional object:
//     domain_analysis  {primary_domain, concepts[], terminology[], methods[]}
//                      from lib/core/rs-domain-analyzer.cjs
//
// Output (happy path):
//   Array<{document_id, technical_terms[], concepts[], methods[],
//          relevance_score, boundary_flag, warning?}>
//
// Output (Canon Part 8 input rejection):
//   {error: 'invalid_input', reason: 'forbidden_input'}
//
// Throws:
//   ExternalEgressViolation  if composite output contains FORBIDDEN_PATTERNS
//                            (intentional Canon Part 8 escape route).

function preprocess(documents, opts) {
  if (!Array.isArray(documents)) return [];
  if (documents.length === 0) return [];

  opts = opts || {};
  const domain_analysis = opts.domain_analysis || { concepts: [], terminology: [], methods: [] };

  // Canon Part 8 Layer 1: pre-input scan on domain_analysis.
  if (preInputScan(domain_analysis)) {
    return { error: 'invalid_input', reason: 'forbidden_input' };
  }

  const out = [];
  for (const doc of documents) {
    if (!doc || typeof doc !== 'object') continue;
    const document_id = (typeof doc.id === 'string') ? doc.id : '';
    // Source-aware text extraction. Papers + patents have abstract; signals
    // have signal. Title is fallback. All flow through the same preprocessing.
    let text = '';
    if (typeof doc.abstract === 'string' && doc.abstract.length > 0) {
      text = doc.abstract;
    } else if (typeof doc.signal === 'string' && doc.signal.length > 0) {
      text = doc.signal;
    } else if (typeof doc.title === 'string' && doc.title.length > 0) {
      text = doc.title;
    }

    if (text.length === 0) {
      out.push({
        document_id: document_id,
        technical_terms: [],
        concepts: [],
        methods: [],
        relevance_score: 0,
        boundary_flag: true,
        warning: 'document_text_missing',
      });
      continue;
    }

    // Title is included in the technical-term + concept extraction surface
    // when present, so adversarial title content (Test 9) flows through the
    // pre-return audit and gets caught.
    const composite = (typeof doc.title === 'string' ? doc.title + ' ' : '') + text;

    const technical_terms = extractTechnicalTerms(composite);
    const concepts = extractConcepts(composite, domain_analysis);
    const methods = extractMethods(composite);
    const relevance_score = computeRelevance(composite, domain_analysis);
    const boundary_flag = computeBoundaryFlag(relevance_score, concepts);

    out.push({
      document_id: document_id,
      technical_terms: technical_terms,
      concepts: concepts,
      methods: methods,
      relevance_score: relevance_score,
      boundary_flag: boundary_flag,
    });
  }

  // Canon Part 8 Layer 2: pre-return audit. Throws ExternalEgressViolation
  // on any FORBIDDEN_PATTERNS hit in the composite preprocessed[] output.
  // This is the intentional escape route from preprocess().
  auditQueryObject(out, 'preprocessor');

  return out;
}

// ---------- Exports ----------

module.exports = {
  preprocess: preprocess,
  _test: {
    extractTechnicalTerms: extractTechnicalTerms,
    extractConcepts: extractConcepts,
    extractMethods: extractMethods,
    computeRelevance: computeRelevance,
    computeBoundaryFlag: computeBoundaryFlag,
    tokenize: tokenize,
    preInputScan: preInputScan,
    TECHNICAL_TERM_REGEX: TECHNICAL_TERM_REGEX,
    METHOD_REGEX: METHOD_REGEX,
    STOPWORDS: STOPWORDS,
    TECHNICAL_TERMS_MAX: TECHNICAL_TERMS_MAX,
    CONCEPTS_MAX: CONCEPTS_MAX,
    METHODS_MAX: METHODS_MAX,
    BOUNDARY_THRESHOLD: BOUNDARY_THRESHOLD,
  },
};
