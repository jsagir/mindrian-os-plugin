/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.2 Plan 05 -- Experts post-processor.
 * Phase 94 Plan 05 amendment (2026-04-28): envelope wrap only.
 * mapExperts now returns an Array-with-properties hybrid: the return
 * value IS still an Array of expert records (preserving every existing
 * consumer: experts.length, experts.find(), experts[i] all work
 * byte-identically) and ALSO carries envelope properties tier, source,
 * results, experts attached to it. tier='derived' annotates that this
 * is a post-processor over academic.papers (not a network fetcher);
 * source='derived' is the canonical sentinel for non-fetcher modules.
 * This zero-blast-radius pattern is the cheapest correct way to honor
 * Plan 94-05's envelope-uniformity contract without breaking the
 * 17-scenario rs-fetcher-experts fixture suite or rs-discovery-engine
 * line 330 mapExperts consumer.
 *
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
 *
 * 2026 package changes (all additive; see rs/CHANGES-commands.md):
 *   - BUG FIX: the academic fetcher emits authors as plain strings and the
 *     citation count as cited_by_count; this module only accepted author
 *     OBJECTS and citationCount, so real fetcher output produced an empty
 *     experts list (every string author was dropped as "not an object").
 *     String authors and cited_by_count are now accepted.
 *   - every expert carries an explicit confidence (0..1) with its basis, the
 *     identity_resolution used (orcid | name_only | name_merged_into_orcid),
 *     the sources seen, and an evidence trail of up to 5 papers (paper id,
 *     source, URL, title, retrieval date, citations)
 *   - h_index_estimate is labelled h_index_basis: 'retrieved_papers_only'
 *     (it is computed over the fetched papers, not the author's career)
 *   - names are matched after case, accent and punctuation folding; a no-ORCID
 *     record is merged into the single ORCID record of the same name
 *   - retracted papers (is_retracted === true) are excluded from the counts
 *     unless opts.includeRetracted is true
 *   - a paper repeated in the input no longer counts twice for one author
 *   - the tie-break sort no longer depends on the host locale
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

// Evidence entries kept per expert (highest-cited first).
const MAX_EVIDENCE = 5;
const TOOL_ID = 'rs-fetcher-experts/2026.1';

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
  // 2026: ignore non-finite and negative entries instead of letting NaN poison the sort.
  const clean = citations.filter(function (c) { return typeof c === 'number' && isFinite(c) && c >= 0; });
  if (clean.length === 0) return 0;
  const sorted = clean.sort(function (a, b) { return b - a; });
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
  // 2026: the academic fetcher emits authors as plain display-name strings.
  if (typeof author === 'string') author = { name: author.trim() };
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

// Fold case, accents and punctuation so "Jose  Garcia", "JOSE GARCIA" and
// "Jose Garcia." match. Used for the grouping key only; the first-seen display
// name is what is emitted.
function foldName(name) {
  return String(name).normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

function paperKey(paper) {
  const doi = (paper && typeof paper.doi === 'string') ? paper.doi.trim().toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//, '') : '';
  if (doi) return 'doi:' + doi;
  if (paper && paper.id) return 'id:' + String(paper.id);
  return 'title:' + foldName((paper && paper.title) || '');
}

function citationOf(paper) {
  if (typeof paper.citationCount === 'number' && isFinite(paper.citationCount)) return paper.citationCount;
  if (typeof paper.cited_by_count === 'number' && isFinite(paper.cited_by_count)) return paper.cited_by_count;
  return 0;
}

function evidenceOf(paper) {
  const title = scrubScalar(typeof paper.title === 'string' ? paper.title.slice(0, 160) : null);
  return {
    paper_id: scrubScalar(paper.id !== undefined && paper.id !== null ? String(paper.id) : null),
    source: typeof paper.source === 'string' ? paper.source : null,
    source_id: scrubScalar(typeof paper.source_id === 'string' ? paper.source_id : null),
    url: scrubScalar(typeof paper.source_url === 'string' && paper.source_url ? paper.source_url : null),
    title: title,
    retrieved_at: (typeof paper.retrieved_at === 'string' ? paper.retrieved_at
      : (typeof paper.fetched_at === 'string' ? paper.fetched_at : null)),
    cited_by: (typeof paper.citationCount === 'number' || typeof paper.cited_by_count === 'number') ? citationOf(paper) : null,
  };
}

function dedupExperts(papers, opts) {
  opts = opts || {};
  const stats = { skipped_authors: 0, excluded_retracted: 0 };
  const authorMap = new Map();
  for (const paper of papers) {
    if (!paper || !Array.isArray(paper.authors)) continue;
    if (paper.is_retracted === true && opts.includeRetracted !== true) {
      stats.excluded_retracted += 1;
      continue;
    }
    const citationCount = citationOf(paper);
    const pk = paperKey(paper);
    const ev = evidenceOf(paper);
    for (let ai = 0; ai < paper.authors.length; ai += 1) {
      const author = paper.authors[ai];
      const rec = extractAuthorRecord(paper, author);
      if (rec === null) { stats.skipped_authors += 1; continue; }
      // Paper-level institution is only attributed on request, and only to the
      // first author, because the fetcher records the first institution it saw,
      // not a per-author affiliation.
      if (rec.institution === null && opts.inferFirstAuthorInstitution === true && ai === 0
        && typeof paper.institution === 'string' && paper.institution) {
        rec.institution = scrubScalar(paper.institution);
      }
      const key = foldName(rec.name) + '|' + (rec.orcid === null ? '__no_orcid__' : rec.orcid);
      if (!authorMap.has(key)) {
        authorMap.set(key, {
          name: rec.name,
          orcid: rec.orcid,
          institution: rec.institution,
          paper_count: 0,
          citations_per_paper: [],
          public_email_or_null: rec.public_email_or_null,
          entries: new Map(), // paper key -> {c: citations, ev: evidence entry}
          sources: new Set(),
          name_variants: new Set(),
        });
      }
      const existing = authorMap.get(key);
      if (existing.entries.has(pk)) continue; // same paper repeated in the input
      existing.entries.set(pk, { c: citationCount, ev: ev });
      if (typeof paper.source === 'string') existing.sources.add(paper.source);
      if (rec.name !== existing.name) existing.name_variants.add(rec.name);
      if (existing.institution === null && rec.institution !== null) {
        existing.institution = rec.institution;
      }
      if (existing.public_email_or_null === null && rec.public_email_or_null !== null) {
        existing.public_email_or_null = rec.public_email_or_null;
      }
    }
  }

  // Merge a no-ORCID record into the single ORCID record carrying the same
  // folded name. Two different ORCIDs with one name stay separate (homonyms).
  const byName = new Map();
  for (const [key, rec] of authorMap) {
    const fn = key.split('|')[0];
    if (!byName.has(fn)) byName.set(fn, []);
    byName.get(fn).push([key, rec]);
  }
  stats.merged_name_variants = 0;
  for (const group of byName.values()) {
    const withOrcid = group.filter(function (kr) { return kr[1].orcid !== null; });
    const noOrcid = group.filter(function (kr) { return kr[1].orcid === null; });
    if (withOrcid.length === 1 && noOrcid.length === 1) {
      const target = withOrcid[0][1];
      const from = noOrcid[0][1];
      for (const [pk, entry] of from.entries) {
        if (!target.entries.has(pk)) target.entries.set(pk, entry);
      }
      from.sources.forEach(function (s) { target.sources.add(s); });
      if (target.institution === null) target.institution = from.institution;
      if (target.public_email_or_null === null) target.public_email_or_null = from.public_email_or_null;
      target.merged_from_no_orcid = true;
      authorMap.delete(noOrcid[0][0]);
      stats.merged_name_variants += 1;
    }
  }
  // Derive the legacy helper fields from the per-paper entries.
  for (const rec of authorMap.values()) {
    rec.paper_count = rec.entries.size;
    rec.citations_per_paper = Array.from(rec.entries.values()).map(function (e) { return e.c; });
    rec.evidence = Array.from(rec.entries.values()).map(function (e) { return e.ev; });
  }
  authorMap._stats = stats;
  return authorMap;
}

// Deterministic confidence in the identity of one expert record. It rates how
// sure we are that the record is ONE real person, not how expert they are.
//   ORCID present: 0.80 start; name only: 0.45 start (homonym risk)
//   +0.05 per extra distinct paper (max +0.15); +0.05 for two or more sources;
//   +0.03 when an institution is known. Caps: 0.95 with ORCID, 0.70 without.
function scoreExpertConfidence(rec) {
  const basis = [];
  let c = rec.orcid !== null ? 0.80 : 0.45;
  basis.push(rec.orcid !== null ? 'orcid_present' : 'name_only_identity');
  const extra = Math.min(0.15, 0.05 * Math.max(0, rec.paper_count - 1));
  if (extra > 0) { c += extra; basis.push('repeat_appearance_x' + rec.paper_count); }
  if (rec.sources.size >= 2) { c += 0.05; basis.push('multi_source'); }
  if (rec.institution) { c += 0.03; basis.push('institution_known'); }
  if (rec.merged_from_no_orcid) basis.push('name_variant_merged_into_orcid');
  const cap = rec.orcid !== null ? 0.95 : 0.70;
  return { confidence: Math.round(Math.min(cap, c) * 100) / 100, basis: basis };
}

// ---------- mapExperts ----------
//
// Public entry point. Walks papers[], deduplicates authors, computes
// h_index_estimate per author, sorts deterministically, drops the
// citations_per_paper helper field from the final output, runs
// auditQueryObject(experts) as the pre-return defense-in-depth tripwire,
// and returns the experts[] array.
//
// opts (all optional, 2026):
//   includeRetracted               boolean  keep papers flagged is_retracted
//   inferFirstAuthorInstitution    boolean  attribute paper.institution to the
//                                           first author when none is known
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
  opts = (opts && typeof opts === 'object') ? opts : {};

  // Empty papers: still return Array-with-envelope-properties so the
  // T5 envelope-shape contract holds AND existing consumers that do
  // `experts.length === 0` keep working.
  if (papers.length === 0) {
    const empty = [];
    annotateExpertsEnvelope(empty, { input_papers: 0, skipped_authors: 0, excluded_retracted: 0, merged_name_variants: 0 }, opts);
    return empty;
  }

  const authorMap = dedupExperts(papers, opts);
  const stats = authorMap._stats || {};
  const experts = [];
  for (const rec of authorMap.values()) {
    const h = computeHIndexEstimate(rec.citations_per_paper);
    const conf = scoreExpertConfidence(rec);
    const evidence = rec.evidence.slice().sort(function (a, b) {
      const ca = (a.cited_by === null ? -1 : a.cited_by);
      const cb = (b.cited_by === null ? -1 : b.cited_by);
      if (cb !== ca) return cb - ca;
      return String(a.paper_id).localeCompare(String(b.paper_id), 'en');
    }).slice(0, MAX_EVIDENCE);
    experts.push({
      name: rec.name,
      orcid: rec.orcid,
      institution: rec.institution,
      paper_count: rec.paper_count,
      h_index_estimate: h,
      public_email_or_null: rec.public_email_or_null,
      // 2026 additive fields
      h_index_basis: 'retrieved_papers_only',
      confidence: conf.confidence,
      confidence_basis: conf.basis,
      identity_resolution: rec.orcid !== null ? (rec.merged_from_no_orcid ? 'name_merged_into_orcid' : 'orcid') : 'name_only',
      sources: Array.from(rec.sources).sort(),
      evidence: evidence,
      evidence_total: rec.paper_count,
    });
  }

  // Deterministic sort: paper_count descending, then name ascending. The
  // locale is pinned and a code-point tie-break removes host dependence.
  experts.sort(function (a, b) {
    if (b.paper_count !== a.paper_count) return b.paper_count - a.paper_count;
    const c = a.name.localeCompare(b.name, 'en');
    if (c !== 0) return c;
    return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0);
  });

  // Pre-return Canon Part 8 defense-in-depth audit. JSON.stringify
  // flattens every field; FORBIDDEN_PATTERNS scan catches anything
  // that smuggled past the per-field scrubScalar + isPublicEmail
  // allow-list (e.g. paper.id strings accidentally promoted into a
  // helper field by a future regression). Throws ExternalEgressViolation
  // on hit; the throw point is intentional so any leak is loud not silent.
  auditQueryObject(experts, 'experts');

  // Phase 94 Plan 05 envelope wrap: attach tier/source/results/experts
  // properties on the Array itself. JS arrays support extra named
  // properties; existing consumers (.length, .find, indexing) are
  // unaffected. Object.keys(experts) will enumerate only the named
  // properties (not the numeric indices), so JSON.stringify of a
  // mapExperts return still serializes as an Array (numeric indices
  // win); that preserves the existing wire format byte-identically.
  annotateExpertsEnvelope(experts, {
    input_papers: papers.length,
    skipped_authors: stats.skipped_authors || 0,
    excluded_retracted: stats.excluded_retracted || 0,
    merged_name_variants: stats.merged_name_variants || 0,
  }, opts);
  return experts;
}

// ---------- annotateExpertsEnvelope ----------
//
// Attaches Phase 94 Plan 05 envelope properties to the experts Array
// in place. tier='derived' source='derived' results=<array>
// experts=<array>. The Array remains the authoritative collection;
// the envelope properties are additive metadata for the T5 envelope-
// shape contract.

function annotateExpertsEnvelope(arr, counts, opts) {
  Object.defineProperty(arr, 'provenance', {
    value: Object.freeze({
      tool: TOOL_ID,
      computed_at: new Date().toISOString(),
      params: {
        include_retracted: !!(opts && opts.includeRetracted === true),
        infer_first_author_institution: !!(opts && opts.inferFirstAuthorInstitution === true),
        max_evidence: MAX_EVIDENCE,
      },
      counts: counts || {},
    }),
    enumerable: false, writable: false,
  });
  Object.defineProperty(arr, 'tier', { value: 'derived', enumerable: false, writable: false });
  Object.defineProperty(arr, 'source', { value: 'derived', enumerable: false, writable: false });
  Object.defineProperty(arr, 'results', { value: arr, enumerable: false, writable: false });
  Object.defineProperty(arr, 'experts', { value: arr, enumerable: false, writable: false });
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
    foldName,
    scoreExpertConfidence,
    PUBLIC_EMAIL_REGEX,
    PUBLIC_EMAIL_SOURCES,
  },
  // Re-export so callers needing instanceof checks have a stable import
  // path without going to rs-egress-violations.cjs directly.
  ExternalEgressViolation,
};
