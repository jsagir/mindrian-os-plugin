/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.2 Plan 05 -- Experts post-processor.
 *
 * Wave-2 module that extracts deduped author records from academic
 * fetcher output (papers[]). The naming convention follows the other
 * Wave-2 modules (rs-fetcher-academic.cjs, rs-fetcher-patents.cjs,
 * rs-fetcher-industry.cjs) but THIS MODULE IS NOT A FETCHER.
 *
 *   Input:  papers[] from rs-fetcher-academic.cjs (already validated +
 *           audited at the network boundary by Plan 89.2-02)
 *   Output: experts[] one record per deduped author with shape
 *             { name, orcid, institution, paper_count,
 *               h_index_estimate, public_email_or_null }
 *
 * NO network egress. NO outbound calls. The post-processor reads its
 * input, deduplicates by (name|orcid) composite key, computes the
 * h-index estimate from per-author citation counts, sorts deterministically
 * (paper_count desc, name asc), and runs auditQueryObject(experts) BEFORE
 * return as the defense-in-depth tripwire. Even though there is no
 * outbound network surface, the experts[] payload is the lineage that
 * downstream Plan 89.5 rs-expert-mapper.cjs writes to the user's own
 * Aura via Cypher; auditing at this boundary is conservative Canon
 * Part 8 enforcement (the user's own Aura is NOT the Brain, but the
 * extra audit ensures that any forbidden bytes that slip past the
 * upstream academic fetcher cannot smuggle into the Aura write).
 *
 * Privacy stance per kickoff section 15 open-question-4: public author
 * emails sourced from OpenAlex are allowed (the data is already public
 * via OpenAlex authorships.author.email). Anything sourced behind a
 * login wall (Scopus, IEEE, Nature) is dropped (public_email_or_null
 * = null). PUBLIC_EMAIL_SOURCES enforces this allow-list.
 *
 * Deterministic: same papers[] input produces byte-identical experts[]
 * output. Sort order: paper_count descending then name ascending.
 *
 * Pure CJS, zero npm deps. Imports the shared ExternalEgressViolation
 * and auditQueryObject primitives from Plan 89.2-01 (Wave 1).
 */
'use strict';

const { ExternalEgressViolation } = require('./rs-egress-violations.cjs');
const { auditQueryObject, FORBIDDEN_PATTERNS } = require('./rs-egress-prompts.cjs');

// ---------- Frozen invariants ----------

// Public-email allow-list per kickoff section 15 open-question-4.
// Only OpenAlex emails are considered public (data is already public via
// OpenAlex authorships.author.email field). Any other source is treated
// as login-gated and dropped to public_email_or_null = null.
const PUBLIC_EMAIL_SOURCES = Object.freeze(new Set(['openalex']));

// Strict email format: no whitespace, single @, TLD at least 2 chars.
const PUBLIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ---------- scrubScalar ----------
//
// Mirrors the 89.1 Plan 02 rs-domain-analyzer.cjs scrubScalar pattern:
// any string that matches any FORBIDDEN_PATTERNS regex is rejected
// (returns null). Non-string inputs pass through. Empty strings become
// null so the caller's "empty or scrubbed" branch is one check.

function scrubScalar(s) {
  if (s === null || s === undefined) return null;
  if (typeof s !== 'string') return s;
  if (s.length === 0) return null;
  for (const re of FORBIDDEN_PATTERNS) {
    if (re.test(s)) return null;
  }
  return s;
}

// ---------- isPublicEmail ----------
//
// Three-layer check before allowing an author email into output:
//   1. paper.source must be on the PUBLIC_EMAIL_SOURCES allow-list
//   2. author.email must match the strict PUBLIC_EMAIL_REGEX
//   3. author.email must NOT match any FORBIDDEN_PATTERNS regex (defense
//      in depth: even an openalex source with a malformed email goes null)
//
// Returns boolean. Caller must still pass the email through scrubScalar
// before promoting into output (belt and suspenders).

function isPublicEmail(paper, author) {
  if (!paper || typeof paper.source !== 'string') return false;
  if (!PUBLIC_EMAIL_SOURCES.has(paper.source)) return false;
  if (!author || typeof author.email !== 'string') return false;
  if (!PUBLIC_EMAIL_REGEX.test(author.email)) return false;
  for (const re of FORBIDDEN_PATTERNS) {
    if (re.test(author.email)) return false;
  }
  return true;
}

// ---------- computeHIndexEstimate ----------
//
// Standard h-index over a citation list. h is the largest value such
// that h papers each have >= h citations. Sort descending; walk from
// highest h down to 0 and return the first h that satisfies the
// condition. Empty list returns 0.
//
// Examples:
//   [10, 8, 5, 3, 1]  -> 3   (4 papers >= 3 cites; only 3 papers >= 4 cites)
//   [0, 0, 0]         -> 0
//   []                -> 0
//   [1]               -> 1
//   [5, 5, 5, 5, 5]   -> 5

function computeHIndexEstimate(citations) {
  if (!Array.isArray(citations) || citations.length === 0) return 0;
  const sorted = citations.slice().sort(function (a, b) { return b - a; });
  for (let h = sorted.length; h >= 1; h -= 1) {
    if (sorted[h - 1] >= h) return h;
  }
  return 0;
}

// ---------- extractAuthorRecord ----------
//
// Build the per-author intermediate record from a single (paper, author)
// pair. Returns null if the author cannot be safely emitted (scrubbed
// name, missing required fields). The record is intermediate because
// paper_count + h_index_estimate are aggregated across multiple papers
// in mapExperts.

function extractAuthorRecord(paper, author) {
  if (!author || typeof author !== 'object') return null;
  const name = scrubScalar(author.name);
  if (name === null) return null; // forbidden or empty -- skip
  const orcid = scrubScalar(author.orcid);
  const institution = scrubScalar(author.institution);
  let email = null;
  if (isPublicEmail(paper, author)) {
    const scrubbed = scrubScalar(author.email);
    if (scrubbed !== null) email = scrubbed;
  }
  return {
    name: name,
    orcid: orcid,
    institution: institution,
    public_email_or_null: email,
  };
}

// ---------- dedupExperts ----------
//
// Walk papers; build authorMap keyed by (name|orcid). For each
// occurrence: bump paper_count, push the citation count into
// citations_per_paper, fill in institution if previously null,
// fill in public_email_or_null if previously null.
//
// Note: institution and email "fill if previously null" semantics
// favor the FIRST non-null value seen (deterministic given the input
// papers[] order). The same name appearing with different institutions
// across papers will keep the first non-null institution.

function dedupExperts(papers) {
  const authorMap = new Map();
  for (const paper of papers) {
    if (!paper || !Array.isArray(paper.authors)) continue;
    const citationCount = (typeof paper.citationCount === 'number' && isFinite(paper.citationCount))
      ? paper.citationCount
      : 0;
    for (const author of paper.authors) {
      const rec = extractAuthorRecord(paper, author);
      if (rec === null) continue;
      const key = rec.name + '|' + (rec.orcid === null ? '__no_orcid__' : rec.orcid);
      if (!authorMap.has(key)) {
        authorMap.set(key, {
          name: rec.name,
          orcid: rec.orcid,
          institution: rec.institution,
          paper_count: 0,
          citations_per_paper: [],
          public_email_or_null: rec.public_email_or_null,
        });
      }
      const existing = authorMap.get(key);
      existing.paper_count += 1;
      existing.citations_per_paper.push(citationCount);
      if (existing.institution === null && rec.institution !== null) {
        existing.institution = rec.institution;
      }
      if (existing.public_email_or_null === null && rec.public_email_or_null !== null) {
        existing.public_email_or_null = rec.public_email_or_null;
      }
    }
  }
  return authorMap;
}

// ---------- mapExperts ----------
//
// Public entry point. Walks papers[], deduplicates authors, computes
// h_index_estimate per author, sorts deterministically, drops the
// citations_per_paper helper field from the final output, runs
// auditQueryObject(experts) as the pre-return defense-in-depth tripwire,
// and returns the experts[] array.
//
// Throws:
//   TypeError                if papers is not an array
//   ExternalEgressViolation  if any FORBIDDEN_PATTERNS regex matches
//                            the JSON.stringify of the output (defense
//                            in depth -- the per-field scrubScalar +
//                            isPublicEmail allow-list should have caught
//                            anything earlier)
//
// Returns: experts[] array. May be empty when papers[] is empty or no
// safely-emittable authors are found.

function mapExperts(papers, opts) {
  if (!Array.isArray(papers)) {
    throw new TypeError('mapExperts: papers must be an array; got ' + typeof papers);
  }
  if (papers.length === 0) return [];
  // opts is reserved for forward compatibility (e.g. min_paper_count
  // filter). Reading it would be premature; preserve the parameter so
  // future plans can add knobs without changing the call signature.
  void opts;

  const authorMap = dedupExperts(papers);
  const experts = [];
  for (const rec of authorMap.values()) {
    const h = computeHIndexEstimate(rec.citations_per_paper);
    experts.push({
      name: rec.name,
      orcid: rec.orcid,
      institution: rec.institution,
      paper_count: rec.paper_count,
      h_index_estimate: h,
      public_email_or_null: rec.public_email_or_null,
    });
  }

  // Deterministic sort: paper_count descending, then name ascending.
  experts.sort(function (a, b) {
    if (b.paper_count !== a.paper_count) return b.paper_count - a.paper_count;
    return a.name.localeCompare(b.name);
  });

  // Pre-return Canon Part 8 defense-in-depth audit. JSON.stringify
  // flattens every field; FORBIDDEN_PATTERNS scan catches anything
  // that smuggled past the per-field scrubScalar + isPublicEmail
  // allow-list (e.g. paper.id strings accidentally promoted into a
  // helper field by a future regression). Throws ExternalEgressViolation
  // on hit; the throw point is intentional so any leak is loud not silent.
  auditQueryObject(experts, 'experts');

  return experts;
}

// ---------- Exports ----------

module.exports = {
  mapExperts,
  // _test exposes internals for the fixture suite. Not part of the public
  // API contract; downstream consumers MUST use mapExperts only.
  _test: {
    scrubScalar,
    isPublicEmail,
    computeHIndexEstimate,
    extractAuthorRecord,
    dedupExperts,
    PUBLIC_EMAIL_REGEX,
    PUBLIC_EMAIL_SOURCES,
  },
  // Re-export so callers needing instanceof checks have a stable import
  // path without going to rs-egress-violations.cjs directly.
  ExternalEgressViolation,
};
