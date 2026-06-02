'use strict';
/*
 * Phase 131-03 -- source-lens-driver: the Stage 3-4 source-lens rotation driver.
 *
 * This is the execution heart of the /mos:research pipeline. It plugs into the
 * SHIPPED Phase 130 lens-engine rotate() via the activated `source` family slot
 * (lib/core/lens-engine.cjs LENS_REGISTRY.source, activated in Plan 131-03), runs
 * the Plan-02 ordered weighted lens set through the weighted-by-context rotation
 * mode, fetches every source EXCLUSIVELY through the Phase 130.5 shared corpus +
 * cache, dedups against prior research, and ranks findings by evidence-tier
 * (Canon Part 5) + relevance ONLY.
 *
 * RE-BASELINE HARD CONSTRAINTS (honored here):
 *   - CONSUME 130.5, build NO fetcher. The ONLY fetch path is
 *     research-corpus.cjs fetchCorpus (cache-first via research-cache.cjs). This
 *     module introduces NO fetcher, NO second cache, NO second pre-egress audit:
 *     the Canon Part 8 pre-egress audit is the SHARED hook INSIDE fetchCorpus, so
 *     the driver inherits it on every fetch.
 *   - ZERO Python. No external-process invocations, no interpreter subprocess,
 *     no require of any Python script, no HSI script. Ranking is CJS-native tier
 *     + token-overlap relevance. HSI-scoring of findings DEFERRED to v1.14.0
 *     fan-out behind Phase 134 CJS HSI; 131 ships zero Python.
 *   - WEIGHTING OWNERSHIP: this driver CONSUMES the ordered [{lens, weight}] list
 *     Plan 02's computeLensSet produced. It does NOT recompute, re-derive, or
 *     re-weight the lenses. It only ORDERS its rotation by the supplied descending
 *     weight (weighted = ordered-serial by the given weight) and drops no weight.
 *
 * room.db: reached ONLY via lib/core/lens-engine.cjs rotate() (which goes through
 *   navigation.cjs). The driver carries ZERO direct require of room-db.cjs /
 *   node:sqlite; it forwards a CALLER-OWNED db handle to rotate(input.db). The
 *   substrate guard (scripts/check-substrate.cjs) must return clean on it.
 *
 * Export:
 *   runSourceLens({ roomDir, topic, lensSet, preflight, stage, db, sessionId,
 *                   _fetchCorpus }) -> { ok, findings, lens_set }
 *   where lensSet is the Plan-02 ordered [{lens, weight}] list and _fetchCorpus is
 *   a test seam defaulting to research-corpus.fetchCorpus. Each returned finding
 *   carries { source, url, retrieved_at, evidence_tier, relevance, summary, title }.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE). Uses hyphens.
 */

const lensEngine = require('../core/lens-engine.cjs');
const researchCorpus = require('../core/research-corpus.cjs');
const researchCache = require('../core/research-cache.cjs');

// ---------------------------------------------------------------------------
// Lens -> Phase 130.5 corpus source mapping. Each Plan-02 lens name maps to a
// 130.5 source id (data/research-sources.json). A lens with no 130.5 source
// degrades to null (the lens fetches nothing, never throws).
// ---------------------------------------------------------------------------
const LENS_TO_SOURCE = Object.freeze({
  scholarly: 'openalex',
  industry: 'tavily',
  patent: 'pubmed',
  brain: 'brain-cypher',
  'competitive-intelligence': 'tavily',
  grants: 'tavily',
});

// Evidence-tier by source (Canon Part 5: Academic > Operational > Practitioner >
// None). The academic corpus sources are Academic; the Brain methodology source
// is Operational; the web source is Practitioner. An unknown / empty source is
// None. This is a pure source-keyed lookup, NOT an embedding and NOT HSI.
const SOURCE_TO_TIER = Object.freeze({
  openalex: 'Academic',
  arxiv: 'Academic',
  pubmed: 'Academic',
  'brain-cypher': 'Operational',
  tavily: 'Practitioner',
});

// The Part 5 tier ordering (higher = stronger). Drives the rank sort.
const TIER_RANK = Object.freeze({
  Academic: 3,
  Operational: 2,
  Practitioner: 1,
  None: 0,
});

const TOP_N = 5;            // Stage 5 cap.
const PER_SOURCE_LIMIT = 20; // The corpus limit per lens fetch.

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Tokenize a string into a lowercase [a-z0-9]+ word set (pure, no NLP, no deps).
function tokenize(text) {
  const s = String(text == null ? '' : text).toLowerCase();
  const words = s.match(/[a-z0-9]+/g) || [];
  const set = new Set();
  for (const w of words) {
    if (w.length >= 3) set.add(w); // drop trivially short tokens.
  }
  return set;
}

// Build the section claim-graph token set from the preflight: the evidence_gaps
// claim text + the current_section label. This is what relevance is measured
// against (Canon Part 5: relevance = % match to the section claim graph).
function claimGraphTokens(preflight, topic) {
  const pf = isPlainObject(preflight) ? preflight : {};
  const parts = [];
  if (typeof topic === 'string') parts.push(topic);
  if (typeof pf.current_section === 'string') parts.push(pf.current_section);
  const gaps = Array.isArray(pf.evidence_gaps) ? pf.evidence_gaps : [];
  for (const g of gaps) {
    if (!isPlainObject(g)) continue;
    if (typeof g.summary === 'string') parts.push(g.summary);
    if (typeof g.text === 'string') parts.push(g.text);
    if (typeof g.claim === 'string') parts.push(g.claim);
  }
  return tokenize(parts.join(' '));
}

// Relevance: the fraction of claim-graph tokens that appear in the item's
// title + abstract (a bounded 0..1 scalar). CJS-native string overlap, NOT an
// embedding, NOT HSI, NOT Python.
function relevanceScore(item, claimTokens) {
  if (!(claimTokens instanceof Set) || claimTokens.size === 0) return 0;
  const itemTokens = tokenize(
    (item && item.title ? item.title : '') + ' ' + (item && item.abstract ? item.abstract : '')
  );
  let hits = 0;
  for (const t of claimTokens) {
    if (itemTokens.has(t)) hits++;
  }
  return Math.round((hits / claimTokens.size) * 1000) / 1000;
}

// The canonical url of a corpus item (id is a url for academic + tavily items).
function itemUrl(item) {
  if (!isPlainObject(item)) return '';
  if (typeof item.url === 'string' && item.url.length > 0) return item.url;
  if (typeof item.id === 'string' && item.id.length > 0) return item.id;
  return '';
}

function itemDoi(item) {
  return (isPlainObject(item) && typeof item.doi === 'string' && item.doi.length > 0) ? item.doi : null;
}

// Build the set of prior-research identity keys (url + doi) to dedup against.
function priorResearchKeys(preflight) {
  const pf = isPlainObject(preflight) ? preflight : {};
  const prior = Array.isArray(pf.prior_research) ? pf.prior_research : [];
  const keys = new Set();
  for (const p of prior) {
    if (!isPlainObject(p)) continue;
    if (typeof p.url === 'string' && p.url.length > 0) keys.add('url:' + p.url);
    if (typeof p.doi === 'string' && p.doi.length > 0) keys.add('doi:' + p.doi);
  }
  return keys;
}

// True iff the item matches a prior-research entry (same url OR same DOI).
function isPriorMatch(item, priorKeys) {
  const url = itemUrl(item);
  const doi = itemDoi(item);
  if (url && priorKeys.has('url:' + url)) return true;
  if (doi && priorKeys.has('doi:' + doi)) return true;
  return false;
}

// Cache-first fetch for ONE source via the 130.5 shared corpus + cache. The ONLY
// fetch path. Returns a results array; a failure (or unknown source) degrades to
// an empty array (best-effort; never throws). roomDir empty -> no cache layer
// (the corpus is still the single fetch path).
async function fetchSourceCached(source, query, roomDir, fetchCorpusFn) {
  if (!source || typeof query !== 'string' || query.length === 0) return [];
  // Cache-first: research-cache, then fetchCorpus on a miss, then write-back.
  if (typeof roomDir === 'string' && roomDir.length > 0) {
    try {
      const cached = researchCache.getCached(roomDir, source, query);
      if (Array.isArray(cached)) return cached;
    } catch (_e) {
      // cache read failure -> fall through to a live fetch (best-effort).
    }
  }
  let results = [];
  try {
    const out = await fetchCorpusFn({ source, query, limit: PER_SOURCE_LIMIT });
    results = Array.isArray(out) ? out : [];
  } catch (_e) {
    // Per-source fetch failure degrades that lens to empty (Canon DoS mitigation).
    return [];
  }
  if (typeof roomDir === 'string' && roomDir.length > 0) {
    try {
      researchCache.putCached(roomDir, source, query, results);
    } catch (_e) {
      // cache write failure never aborts the rotation.
    }
  }
  return results;
}

// Normalize one corpus item into a candidate finding carrying the LOCKED
// provenance fields (Phase 136 contract: source / url / retrieved_at /
// evidence_tier) + relevance + summary + title.
function toFinding(item, source, claimTokens) {
  const tier = SOURCE_TO_TIER[source] || 'None';
  const abstract = (isPlainObject(item) && typeof item.abstract === 'string') ? item.abstract : '';
  const retrievedAt = (isPlainObject(item) && typeof item.fetched_at === 'string' && item.fetched_at.length > 0)
    ? item.fetched_at
    : new Date().toISOString();
  return {
    source,
    url: itemUrl(item),
    doi: itemDoi(item),
    title: (isPlainObject(item) && typeof item.title === 'string') ? item.title : '',
    summary: abstract.length > 280 ? abstract.slice(0, 277) + '...' : abstract,
    retrieved_at: retrievedAt,
    evidence_tier: tier,
    relevance: relevanceScore(item, claimTokens),
  };
}

// Rank findings: evidence-tier first (Part 5 order), then relevance %, then a
// stable url tiebreak. The stage threshold tightens the floor: a commit stage
// drops None-tier findings (commit demands Academic / Operational; we keep
// Practitioner as a lead but drop None entirely at commit).
function rankFindings(findings, stage) {
  const isCommit = String(stage || '').toLowerCase() === 'commit';
  let pool = findings.slice();
  if (isCommit) {
    pool = pool.filter((f) => f.evidence_tier !== 'None');
  }
  pool.sort((a, b) => {
    const tierDelta = (TIER_RANK[b.evidence_tier] || 0) - (TIER_RANK[a.evidence_tier] || 0);
    if (tierDelta !== 0) return tierDelta;
    if (b.relevance !== a.relevance) return b.relevance - a.relevance;
    return String(a.url).localeCompare(String(b.url));
  });
  return pool;
}

/**
 * runSourceLens(opts) -- the Stage 3-4 source-lens rotation.
 *
 * opts:
 *   roomDir      room directory (for the shared cache + role-blend framing).
 *   topic        the research topic (the corpus query string; a GENERIC handle).
 *   lensSet      the Plan-02 ordered [{ lens, weight }] list (descending weight).
 *   preflight    the Stage-1 pre-flight (evidence_gaps + prior_research + section).
 *   stage        the pipeline stage ('explore' | 'commit' | ...). Tightens the floor.
 *   db           a caller-owned room.db handle (forwarded to rotate; may be null).
 *   sessionId    optional session id (forwarded to rotate).
 *   _fetchCorpus a test seam; defaults to research-corpus.fetchCorpus.
 *
 * Returns { ok:true, findings: top5, lens_set } on success; { ok:false, reason }
 * on a defensive rejection (invalid opts / invalid lens set).
 */
async function runSourceLens(opts) {
  if (!isPlainObject(opts)) {
    return { ok: false, reason: 'invalid_opts' };
  }
  const roomDir = typeof opts.roomDir === 'string' ? opts.roomDir : '';
  const topic = typeof opts.topic === 'string' ? opts.topic : '';
  const stage = typeof opts.stage === 'string' ? opts.stage : 'explore';
  const preflight = isPlainObject(opts.preflight) ? opts.preflight : {};
  const db = opts.db || null;
  const sessionId = typeof opts.sessionId === 'string' ? opts.sessionId : undefined;
  const fetchCorpusFn = (typeof opts._fetchCorpus === 'function')
    ? opts._fetchCorpus
    : researchCorpus.fetchCorpus;

  // The Plan-02 ordered weighted lens set. We CONSUME its order + weights; we do
  // NOT recompute them. Sort by descending weight defensively (the list is meant
  // to arrive ordered; we never drop or override a supplied weight).
  const rawLensSet = Array.isArray(opts.lensSet) ? opts.lensSet : [];
  const orderedLensSet = rawLensSet
    .filter((e) => isPlainObject(e) && typeof e.lens === 'string')
    .slice()
    .sort((a, b) => (Number(b.weight) || 0) - (Number(a.weight) || 0));
  if (orderedLensSet.length === 0) {
    return { ok: false, reason: 'empty_lens_set' };
  }
  const lensNames = orderedLensSet.map((e) => e.lens);

  // The section claim-graph tokens relevance is measured against.
  const claimTokens = claimGraphTokens(preflight, topic);
  const priorKeys = priorResearchKeys(preflight);

  // Per-lens fetched items, keyed by lens, captured by the perLensFn the engine
  // runs (ordered-serial by the supplied weight via the weighted-by-context mode).
  const fetchedByLens = Object.create(null);

  // perLensFn: maps a lens to its 130.5 source and fetches cache-first via the
  // shared corpus. Returns a typed-finding-shaped summary object the engine
  // writes as a lens_finding node + hands to the synthesizer. The raw item list
  // is attached on item_count + stashed in fetchedByLens for post-rotation rank.
  async function perLensFn(lens, _ctx) {
    const source = LENS_TO_SOURCE[lens] || null;
    const items = source ? await fetchSourceCached(source, topic, roomDir, fetchCorpusFn) : [];
    fetchedByLens[lens] = { source, items };
    const lead = items.length > 0 && isPlainObject(items[0]) && typeof items[0].title === 'string'
      ? items[0].title
      : '';
    return {
      topic,
      summary: source
        ? (source + ': ' + items.length + ' item(s)' + (lead ? ' -- lead: ' + lead : ''))
        : (lens + ': no 130.5 source mapped'),
      item_count: items.length,
    };
  }

  // Drive the SHIPPED lens-engine rotate() over the activated source family via
  // the weighted-by-context mode. room.db is reached ONLY through the engine ->
  // navigation.cjs; the driver opens no db handle of its own.
  let rotation;
  try {
    rotation = await lensEngine.rotate({
      lensType: 'source',
      lensSet: lensNames,
      rotationMode: 'weighted-by-context',
      input: { roomDir, topic, db, sessionId },
      perLensFn,
      synthesize: 'source-comparison',
      surfaceSelector: 'F.1',
      persistence: 'memory_event',
    });
  } catch (_e) {
    rotation = { ok: false, reason: 'rotation_threw' };
  }
  // A rotation-level failure is non-fatal for the findings path: we still rank
  // whatever the perLensFn fetched. (The engine emits its own lifecycle events.)

  // Aggregate every fetched item into a candidate finding, in lens (weight) order.
  let candidates = [];
  for (const lens of lensNames) {
    const entry = fetchedByLens[lens];
    if (!entry || !Array.isArray(entry.items)) continue;
    for (const item of entry.items) {
      if (!isPlainObject(item)) continue;
      candidates.push(toFinding(item, entry.source, claimTokens));
    }
  }

  // Dedup against prior research (Stage 1 input 7) BEFORE ranking.
  candidates = candidates.filter((f) => {
    const synthetic = { url: f.url, doi: f.doi };
    return !isPriorMatch(synthetic, priorKeys);
  });

  // Dedup within this run by url (a source can return the same url twice; keep
  // the first, which is the higher-weight lens's copy).
  const seenUrls = new Set();
  candidates = candidates.filter((f) => {
    const key = f.url || (f.source + ':' + f.title);
    if (seenUrls.has(key)) return false;
    seenUrls.add(key);
    return true;
  });

  // Rank by tier then relevance, apply the stage threshold, cap at top-5.
  const ranked = rankFindings(candidates, stage);
  const findings = ranked.slice(0, TOP_N).map((f) => ({
    source: f.source,
    url: f.url,
    title: f.title,
    summary: f.summary,
    retrieved_at: f.retrieved_at,
    evidence_tier: f.evidence_tier,
    relevance: f.relevance,
  }));

  return {
    ok: true,
    findings,
    lens_set: orderedLensSet,
    rotation_ok: !!(rotation && rotation.ok),
  };
}

module.exports = {
  runSourceLens,
  // Pure helpers exposed for tests (private; do NOT consume in production).
  _internal: {
    LENS_TO_SOURCE,
    SOURCE_TO_TIER,
    TIER_RANK,
    tokenize,
    relevanceScore,
    rankFindings,
    claimGraphTokens,
  },
};
