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
 *                   _fetchCorpus }) -> { ok, findings, lens_set,
 *                                        research_mode, providers }
 *   where lensSet is the Plan-02 ordered [{lens, weight}] list and _fetchCorpus is
 *   a test seam defaulting to research-corpus.fetchCorpus. Each returned finding
 *   carries { source, url, retrieved_at, evidence_tier, relevance, summary, title }.
 *
 *   Phase 219-05 (D-19, ADDITIVE): research_mode is the typed run verdict
 *   (normal | web_degraded_local_fallback | local_only | insufficient_evidence)
 *   and providers is the per-lens {provider, lens, status, reason, counts,
 *   freshness} bag -- a failing fetch is a TYPED error, a cold corpus is
 *   'insufficient_evidence', never a silent ok + empty arrays (T-219-29).
 *   The shipped CACHE-FIRST fetch order is documented, NOT reordered:
 *   research-cache (30-day TTL) -> fetchCorpus live on a miss -> write-back.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE). Uses hyphens.
 */

const lensEngine = require('../core/lens-engine.cjs');
const researchCorpus = require('../core/research-corpus.cjs');
const researchCache = require('../core/research-cache.cjs');
// Phase 369.2 Plan 25: every lens leg is one operation in a small in-memory ledger (the same states and
// reasons the research planner uses), so a refusal, an empty result and a failure are told apart by proof.
const operations = require('../core/research-planner/operations.cjs');
// Phase 221-02 (absorbed 221-01 Task 3): the typed stage-envelope contract.
// fetchSourceCached consumes fetchCorpusEnvelope so a dead provider is a
// TYPED per-provider event, never a silently erased failure (D-02 additive:
// the 219-05 fields research_mode / status / reason / counts / freshness are
// NEVER renamed; the envelope rides ALONGSIDE them).
const stageEnvelope = require('../core/recovery/stage-envelope.cjs');
// Phase 221-02 Task 2: the recovery dispatcher (the 6-tier ladder, REQ-2).
// runSourceLens hands its per-provider envelope collector to dispatchRecovery
// after rotation; the wiring is ADDITIVE (action 'none' adds NOTHING).
const recoveryDispatcher = require('../core/recovery/dispatcher.cjs');
// Phase 221-04 (D-08): the result-semantics composer. On a recovery-touched
// run the dispatch outcome maps through composeRecoveryResult, which sets
// research_mode 'llm_engine_recovery' / 'manual_intervention_required' when
// applicable and attaches the annex-6 disclosure - ADDITIVE alongside every
// landed field (a healthy run's shape stays byte-identical to pre-221).
const resultSemantics = require('../core/recovery/result-semantics.cjs');

// ---------------------------------------------------------------------------
// Lens -> Phase 130.5 corpus source mapping. Each Plan-02 lens name maps to a
// 130.5 source id (data/research-sources.json). A lens with no 130.5 source
// degrades to null (the lens fetches nothing, never throws).
// ---------------------------------------------------------------------------
const LENS_TO_SOURCE = Object.freeze({
  scholarly: 'openalex',
  industry: 'tavily',
  // CODE-02 (369.2 Plan 25): a patent lens searches PatentsView PatentSearch (source 'patents', gated on
  // PATENTSVIEW_API_KEY) or is refused before dispatch. It used to ask PubMed, a biomedical index wearing a
  // patent label.
  patent: 'patents',
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
  // A patent is the primary record of an invention (an operational artifact, not a peer-reviewed claim and
  // not a practitioner opinion), so the patents source sits at the Operational tier.
  patents: 'Operational',
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

// ---------------------------------------------------------------------------
// Phase 219-05 (D-19) -- the provider-status envelope. ADDITIVE: existing
// consumers keep every current field; research_mode + providers ride alongside.
//
// RESEARCH_MODES is the closed typed vocabulary every research return draws
// from (T-219-29: ok:true+empty must never mask an outage):
//   normal                       >=1 provider supplied items; no live failure
//   web_degraded_local_fallback  a live/web leg failed; local/cached data covered
//   local_only                   the caller ran deliberately local (offline seam)
//   insufficient_evidence        zero items anywhere (a COLD corpus is typed,
//                                never a bare ok:true + empty arrays)
//
// Each provider entry is { provider, lens?, status, reason, counts, freshness }:
//   status    'ok' | 'empty' | 'error' | 'skipped'   (closed enum)
//   reason    a short typed reason string ('live_fetch' / 'cache_hit' /
//             'fetch_failed' / 'no_source_mapped' / ...)
//   counts    { items: <number> }
//   freshness 'live' | 'cached_fresh' | 'local' | 'unknown'
//
// composeResearchMode(providers, opts) is the ONE composition rule, exported so
// the Phase 219-05 explore chain (queryRoomCorpus / exploreOpportunity)
// composes onto this exact seam instead of minting a second mode vocabulary.
// ---------------------------------------------------------------------------
const RESEARCH_MODES = Object.freeze([
  'normal',
  'web_degraded_local_fallback',
  'local_only',
  'insufficient_evidence',
]);

function composeResearchMode(providers, opts) {
  const list = Array.isArray(providers) ? providers : [];
  let totalItems = 0;
  let anyError = false;
  for (const p of list) {
    if (!isPlainObject(p)) continue;
    const n = p.counts && typeof p.counts.items === 'number' ? p.counts.items : 0;
    totalItems += n;
    if (p.status === 'error') anyError = true;
  }
  if (totalItems === 0) return 'insufficient_evidence';
  if (isPlainObject(opts) && opts.localOnly === true) return 'local_only';
  if (anyError) return 'web_degraded_local_fallback';
  return 'normal';
}

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

// Wrap a LEGACY array-returning fetch fn (the shipped _fetchCorpus seam /
// research-corpus.fetchCorpus contract) into an envelope-returning fn, so
// every existing caller and test stub keeps working byte-identically while
// the driver itself consumes envelopes (Phase 221-02, D-02 additive rule).
// A throw propagates: fetchSourceCached types it at ONE place below.
function legacyToEnvelopeFn(legacyFn) {
  return async function (args) {
    const out = await legacyFn(args);
    const results = Array.isArray(out) ? out : [];
    return stageEnvelope.makeStageEnvelope({
      stage: 'retrieval',
      engine: args.source,
      status: results.length > 0 ? 'ok' : 'empty_valid',
      payload: { results: results },
      output: results,
    });
  };
}

// Cache-first fetch for ONE source via the 130.5 shared corpus + cache. The ONLY
// fetch path. Returns { items, status, reason, freshness, envelope } -- the
// D-19 typed summary fields UNCHANGED for every 219 consumer, PLUS the full
// Phase 221 stage envelope for the recovery dispatcher (221-02). A failure
// (or unknown source) degrades to items:[] WITH a typed status: the
// RESILIENCE is unchanged, the OBSERVABILITY is new. Never throws. roomDir
// empty -> no cache layer (the corpus is still the single fetch path).
async function fetchSourceCached(source, query, roomDir, fetchEnvelopeFn, extraArgs) {
  if (!source || typeof query !== 'string' || query.length === 0) {
    // Nothing was attempted: no stage ran, so no stage envelope exists.
    return { items: [], status: 'skipped', reason: 'no_source_mapped', freshness: 'unknown', envelope: null };
  }
  const warnings = [];
  // Cache-first: research-cache, then fetchCorpusEnvelope on a miss, then
  // write-back (the SHIPPED order, documented not reordered). A cache HIT is
  // an ok envelope with EXPLICIT 'research-cache' provenance so Tier-2
  // substitution honesty (T-221-05 / T-221-08) can tell live from cached.
  if (typeof roomDir === 'string' && roomDir.length > 0) {
    try {
      const entry = researchCache.getCachedEntry(roomDir, source, query);
      if (entry && Array.isArray(entry.results)) {
        const cached = entry.results;
        // Phase 363 (D-16): the stored meta rides back on a hit; null for a
        // pre-363 entry (never read as carrying a count).
        const hitMeta = entry.meta || null;
        const hitEnv = stageEnvelope.makeStageEnvelope({
          stage: 'retrieval',
          engine: source,
          status: cached.length > 0 ? 'ok' : 'empty_valid',
          provenance: ['research-cache'],
          payload: hitMeta ? { results: cached, meta: hitMeta } : { results: cached },
          output: cached,
        });
        // The envelope constructor drops unknown keys: attach meta after.
        if (hitMeta) hitEnv.meta = hitMeta;
        return {
          items: cached,
          results: cached,
          status: cached.length > 0 ? 'ok' : 'empty',
          reason: 'cache_hit',
          freshness: 'cached_fresh',
          provenance: 'research-cache',
          meta: hitMeta,
          envelope: hitEnv,
        };
      }
    } catch (e) {
      // Cache read failure -> fall through to a live fetch with a WARNING on
      // the envelope, never an error (221-01 Task 3 behavior 3).
      warnings.push('cache_read_failed: ' + String((e && e.message) || e));
    }
  }
  let env;
  try {
    env = await fetchEnvelopeFn(Object.assign({ source, query, limit: PER_SOURCE_LIMIT }, isPlainObject(extraArgs) ? extraArgs : {}));
  } catch (e) {
    // Per-source fetch failure degrades that lens to zero items (Canon DoS
    // mitigation, resilience unchanged) -- but the outage stays VISIBLE as a
    // typed envelope, never an erased failure (D-19 + 221-02). A Part 8
    // ExternalEgressViolation is typed blocked/policy_blocked here; it is
    // TERMINAL at the dispatcher boundary (never retried, never rerouted).
    const isEgress = !!(e && e.name === 'ExternalEgressViolation');
    return {
      items: [],
      status: 'error',
      reason: 'fetch_failed',
      freshness: 'unknown',
      envelope: stageEnvelope.makeStageEnvelope({
        stage: 'retrieval',
        engine: source,
        status: isEgress ? 'blocked' : 'failed',
        failure_class: isEgress ? 'policy_blocked' : 'unknown_error',
        error: String((e && e.message) || e),
        warnings: warnings,
      }),
    };
  }
  if (!isPlainObject(env)) {
    // A malformed envelope from the fetch fn is a contract breach, typed.
    return {
      items: [],
      status: 'error',
      reason: 'fetch_failed',
      freshness: 'unknown',
      envelope: stageEnvelope.makeStageEnvelope({
        stage: 'retrieval',
        engine: source,
        status: 'failed',
        failure_class: 'contract_violation',
        error: 'fetch fn returned a non-envelope value',
        warnings: warnings,
      }),
    };
  }
  if (warnings.length > 0) {
    env.warnings = (Array.isArray(env.warnings) ? env.warnings : []).concat(warnings);
  }
  const items = (env.payload && Array.isArray(env.payload.results)) ? env.payload.results : [];
  const succeeded = env.status === 'ok' || env.status === 'empty_valid' || env.status === 'degraded';
  // Phase 363 (D-16): the envelope meta (count, cost, budget, translated query).
  // Attached by the corpus after construction; payload.meta is the mirror.
  const liveMeta = isPlainObject(env.meta)
    ? env.meta
    : ((env.payload && isPlainObject(env.payload.meta)) ? env.payload.meta : null);
  if (succeeded && typeof roomDir === 'string' && roomDir.length > 0) {
    try {
      researchCache.putCached(roomDir, source, query, items, { meta: liveMeta });
    } catch (_e) {
      // cache write failure never aborts the rotation.
    }
  }
  if (!succeeded) {
    // failed | blocked: the exact legacy degrade posture for 219 consumers
    // (zero items, typed 'error'), with the precise class on the envelope.
    return {
      items: [],
      status: 'error',
      reason: 'fetch_failed',
      freshness: 'unknown',
      meta: liveMeta,
      envelope: env,
    };
  }
  return {
    items: items,
    results: items,
    status: items.length > 0 ? 'ok' : 'empty',
    reason: 'live_fetch',
    freshness: 'live',
    provenance: 'live',
    meta: liveMeta,
    envelope: env,
  };
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

// lensSummary(result) -> { searched_lenses, unavailable_lenses }. A lens is searched only when its operation
// executed (with results or empty); a refused lens is unavailable, named with the provider and the gate it
// needs, and is never counted as searched.
function lensSummary(result) {
  const list = (isPlainObject(result) && Array.isArray(result.providers)) ? result.providers : [];
  return {
    searched_lenses: list
      .filter(function (p) { return isPlainObject(p) && isPlainObject(p.operation) && (p.operation.state === 'executed_with_results' || p.operation.state === 'executed_empty'); })
      .map(function (p) { return p.lens; }),
    unavailable_lenses: list
      .filter(function (p) { return isPlainObject(p) && p.status === 'refused'; })
      .map(function (p) { return { lens: p.lens, provider: p.provider, reason: p.reason, needs: p.needs || null }; }),
  };
}

// ---------------------------------------------------------------------------
// Phase 369.2 Plan 26 (HARNESS-03, SW-11, SEED-120 CFG-01; R15) -- provider preflight.
//
// preflightLenses(lensSet, opts) -> { available: [lens], unavailable: [{lens, provider, reason, needs}] }
// reads the gate each lens's mapped source needs BEFORE any dispatch: the env gates in
// data/research-sources.json (a key that is not set is reason 'no_key'), and for the Brain lane the egress
// policy's theo line plus the local availability check (reason 'line_off', 'offline' or 'no_brain_url').
// It reads presence only, never a key value, and makes no network call. A lens with no mapped source is
// available here (its own leg answers no_source_mapped). A patent lens whose caller granted the Tavily
// fallback stays available when a Tavily key is set.
// opts: { roomDir, offline, allowFallback }.
// ---------------------------------------------------------------------------
const LANE_WORDS = Object.freeze({
  industry: 'industry',
  'competitive-intelligence': 'competitive intelligence',
  grants: 'grants',
  patent: 'patents',
  scholarly: 'scholarly',
  brain: 'brain',
});

function preflightLenses(lensSet, opts) {
  const o = isPlainObject(opts) ? opts : {};
  const list = Array.isArray(lensSet) ? lensSet : [];
  const available = [];
  const unavailable = [];
  let policy = null;
  for (const e of list) {
    const lens = typeof e === 'string' ? e : (isPlainObject(e) ? e.lens : null);
    if (typeof lens !== 'string') continue;
    const source = LENS_TO_SOURCE[lens] || null;
    if (!source) { available.push(lens); continue; }
    const gate = researchCorpus.sourceGateStatus(source);
    if (!gate.met) {
      const fbAsked = lens === 'patent' && isPlainObject(o.allowFallback) && o.allowFallback.patent === 'tavily';
      if (fbAsked && researchCorpus.sourceGateStatus('tavily').met) { available.push(lens); continue; }
      unavailable.push({
        lens: lens,
        provider: source,
        reason: gate.known === false ? 'unknown_source' : 'no_key',
        needs: gate.unmet.join(','),
      });
      continue;
    }
    if (source === 'brain-cypher') {
      let reason = null;
      if (o.offline === true) {
        reason = 'offline';
      } else {
        try {
          if (policy === null) policy = require('../core/research-planner/egress-policy.cjs').loadEgressPolicy(o.roomDir || '', { offline: false });
          const line = policy.lines && policy.lines.theo;
          if (line && line.allowed !== true) reason = 'line_off';
        } catch (_e) { reason = null; }
        if (reason === null) {
          try { if (!require('../core/brain-client.cjs').isAvailable()) reason = 'no_brain_url'; } catch (_e) { reason = 'no_brain_url'; }
        }
      }
      if (reason) {
        unavailable.push({ lens: lens, provider: 'theo', reason: reason, needs: 'brain:isAvailable' });
        continue;
      }
    }
    available.push(lens);
  }
  return { available: available, unavailable: unavailable };
}

function wordsList(words) {
  if (words.length <= 1) return words.join('');
  return words.slice(0, -1).join(', ') + ' and ' + words[words.length - 1];
}

// unavailableAnswerLine(unavailable) -> one or more plain sentences naming what was not searched and why,
// or '' when every lens is available. No dash characters (house rule).
function unavailableAnswerLine(unavailable) {
  const list = Array.isArray(unavailable) ? unavailable : [];
  const wordsOf = function (u) { return LANE_WORDS[u.lens] || u.lens; };
  const out = [];
  const tavily = list.filter(function (u) { return u.provider === 'tavily'; }).map(wordsOf);
  if (tavily.length > 0) {
    out.push('Industry search needs a Tavily key, and none is set, so ' + wordsList(tavily) + (tavily.length === 1 ? ' was' : ' were') + ' not searched.');
  }
  if (list.some(function (u) { return u.provider === 'patents'; })) {
    out.push('Patent search needs a PatentsView key, and none is set, so patents were not searched.');
  }
  const brainWhy = { line_off: 'the Theo line is off', offline: 'this run is offline', no_brain_url: 'no Brain connection is set' };
  list.filter(function (u) { return u.provider === 'theo'; }).forEach(function (u) {
    out.push('Brain search is not available (' + (brainWhy[u.reason] || u.reason) + '), so brain was not searched.');
  });
  list.filter(function (u) { return ['tavily', 'patents', 'theo'].indexOf(u.provider) === -1; }).forEach(function (u) {
    out.push(wordsOf(u) + ' was not searched: ' + String(u.reason).replace(/_/g, ' ') + '.');
  });
  return out.join(' ');
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
  // Phase 221-02 seam resolution (additive): the driver consumes the TYPED
  // fetchCorpusEnvelope path. The shipped legacy _fetchCorpus seam keeps
  // working byte-identically via legacyToEnvelopeFn (no caller or test stub
  // breaks); a new _fetchCorpusEnvelope seam injects envelopes directly.
  const usesRealCorpus = typeof opts._fetchCorpusEnvelope !== 'function' && typeof opts._fetchCorpus !== 'function';
  const fetchEnvelopeFn = (typeof opts._fetchCorpusEnvelope === 'function')
    ? opts._fetchCorpusEnvelope
    : ((typeof opts._fetchCorpus === 'function')
      ? legacyToEnvelopeFn(opts._fetchCorpus)
      : researchCorpus.fetchCorpusEnvelope);

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

  // Phase 369.2 Plan 26 (HARNESS-03): the provider preflight runs BEFORE any dispatch. A lens whose mapped
  // source gate is unmet leaves the rotation, is minted a refused_before_fetch operation below, and is named
  // in the result; the run never reports a wider coverage than it can search. A caller that injects its own
  // fetch seam supplies the provider itself, so the process env says nothing about it and nothing is narrowed
  // (the same rule the per-lens gate below uses).
  const pre = usesRealCorpus
    ? preflightLenses(orderedLensSet, { roomDir: roomDir, offline: opts.offline === true, allowFallback: opts.allowFallback })
    : { available: lensNames.slice(), unavailable: [] };
  const unavailByLens = Object.create(null);
  for (const u of pre.unavailable) unavailByLens[u.lens] = u;
  const liveLensSet = orderedLensSet.filter((e) => !unavailByLens[e.lens]);
  const rotationNames = liveLensSet.map((e) => e.lens);

  // The section claim-graph tokens relevance is measured against.
  const claimTokens = claimGraphTokens(preflight, topic);
  const priorKeys = priorResearchKeys(preflight);

  // Per-lens fetched items, keyed by lens, captured by the perLensFn the engine
  // runs (ordered-serial by the supplied weight via the weighted-by-context mode).
  const fetchedByLens = Object.create(null);

  // Phase 369.2 Plan 25: one operation per lens leg, minted up front so a leg the rotation never reaches is
  // closed as not executed (run_aborted) at the end instead of vanishing.
  const opLedger = operations.createLedger('lens-' + Date.now().toString(36), null);
  const opByLens = Object.create(null);
  for (const l of lensNames) {
    opByLens[l] = operations.mint(opLedger, {
      plan_dimension: l,
      dimension_label: l,
      kind: 'direct',
      template_id: 'lens.' + l,
      provider: LENS_TO_SOURCE[l] || null,
    });
  }
  // The preflight refusals: one terminal operation and one typed bag per unavailable lens, before dispatch.
  for (const u of pre.unavailable) {
    const reason = 'provider_unavailable:' + (u.lens === 'patent' ? 'patent' : (LENS_TO_SOURCE[u.lens] || u.provider));
    operations.transition(opLedger, opByLens[u.lens].operation_id, 'refused_before_fetch', { reason: reason });
    fetchedByLens[u.lens] = {
      source: LENS_TO_SOURCE[u.lens] || null,
      items: [],
      status: 'refused',
      reason: reason,
      freshness: 'unknown',
      operation: opByLens[u.lens] || null,
      fallback: null,
      needs: u.needs || null,
      envelope: null,
    };
  }

  // perLensFn: maps a lens to its 130.5 source and fetches cache-first via the
  // shared corpus. Returns a typed-finding-shaped summary object the engine
  // writes as a lens_finding node + hands to the synthesizer. The raw item list
  // is attached on item_count + stashed in fetchedByLens for post-rotation rank.
  async function perLensFn(lens, _ctx) {
    const source = LENS_TO_SOURCE[lens] || null;
    const op = opByLens[lens];
    let fetched;
    let bagSource = source;
    let fallback = null;
    let needs = null;
    if (!source) {
      fetched = { items: [], status: 'skipped', reason: 'no_source_mapped', freshness: 'unknown', envelope: null };
    } else {
      // The env-gate pre-check guards the REAL corpus path. A caller that injects its own fetch seam
      // (_fetchCorpus / _fetchCorpusEnvelope: tests, and the 219/221 recovery fixtures) supplies the
      // provider itself, so the process env says nothing about whether that seam can answer.
      const gate = usesRealCorpus ? researchCorpus.sourceGateStatus(source) : { met: true, unmet: [] };
      if (!gate.met) {
        // The mapped provider's gate is unmet: no dispatch at all (CODE-02). The one way past it is the
        // opt-in Tavily fallback for the patent lens, granted by the caller (the command asks the navigator).
        needs = gate.unmet.join(',');
        const fbAsked = lens === 'patent' && isPlainObject(opts.allowFallback) && opts.allowFallback.patent === 'tavily';
        if (fbAsked && researchCorpus.sourceGateStatus('tavily').met) {
          // No cache layer on the fallback (roomDir ''): a domain-restricted search must never share a cache
          // entry with an unrestricted Tavily search of the same words.
          fetched = await fetchSourceCached('tavily', topic, '', fetchEnvelopeFn, { include_domains: ['patents.google.com'] });
          bagSource = 'tavily';
          fallback = { original_provider: 'patents', fallback_provider: 'tavily', reason: 'no_patent_key', authorized_by: 'navigator' };
          // The fallback's envelope stays out of the recovery dispatcher: its retry would re-ask Tavily
          // without the domain restriction, which is not what the navigator authorized.
          fetched = Object.assign({}, fetched, { envelope: null });
        } else {
          fetched = {
            items: [],
            status: 'refused',
            reason: 'provider_unavailable:' + (lens === 'patent' ? 'patent' : source),
            freshness: 'unknown',
            envelope: null,
          };
        }
      } else {
        fetched = await fetchSourceCached(source, topic, roomDir, fetchEnvelopeFn);
      }
    }
    // The lens operation: one terminal state per leg, with the proof it needs.
    if (op) {
      if (fetched.status === 'refused') {
        operations.transition(opLedger, op.operation_id, 'refused_before_fetch', { reason: fetched.reason });
      } else if (fetched.status === 'ok') {
        operations.transition(opLedger, op.operation_id, 'executed_with_results', { count: fetched.items.length, provider: bagSource, q: topic, cache_hit: fetched.reason === 'cache_hit' });
      } else if (fetched.status === 'empty') {
        operations.transition(opLedger, op.operation_id, 'executed_empty', { count: 0, provider: bagSource, q: topic, cache_hit: fetched.reason === 'cache_hit' });
      } else if (fetched.status === 'error') {
        const cls = (fetched.envelope && typeof fetched.envelope.failure_class === 'string' && fetched.envelope.failure_class) ? fetched.envelope.failure_class : 'unknown_error';
        operations.transition(opLedger, op.operation_id, 'not_executed', { reason: 'provider_failed:' + cls, provider: bagSource });
      } else {
        operations.transition(opLedger, op.operation_id, 'not_executed', { reason: 'unknown_lens' });
      }
      if (fallback) operations.recordFallback(opLedger, op.operation_id, fallback);
    }
    const items = fetched.items;
    fetchedByLens[lens] = {
      source: bagSource,
      items,
      status: fetched.status,
      reason: fetched.reason,
      freshness: fetched.freshness,
      operation: op || null,
      fallback: fallback,
      needs: needs,
      // Phase 221-02: the full typed stage envelope rides the bag additively
      // (one bag, two views: the 219 summary fields above stay for their
      // consumers; the envelope feeds the recovery dispatcher).
      envelope: fetched.envelope || null,
    };
    const lead = items.length > 0 && isPlainObject(items[0]) && typeof items[0].title === 'string'
      ? items[0].title
      : '';
    return {
      topic,
      summary: fetched.status === 'refused'
        ? (lens + ': ' + fetched.reason + ' (nothing was searched)')
        : (source
          ? (bagSource + ': ' + items.length + ' item(s)' + (lead ? ' -- lead: ' + lead : ''))
          : (lens + ': no 130.5 source mapped')),
      item_count: items.length,
    };
  }

  // Drive the SHIPPED lens-engine rotate() over the activated source family via
  // the weighted-by-context mode. room.db is reached ONLY through the engine ->
  // navigation.cjs; the driver opens no db handle of its own.
  let rotation;
  if (rotationNames.length === 0) {
    // Every lens was refused before dispatch: there is nothing to rotate over.
    rotation = { ok: true, skipped: 'no_available_lens' };
  } else {
    try {
      rotation = await lensEngine.rotate({
        lensType: 'source',
        lensSet: rotationNames,
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

  // D-19 (Phase 219-05): the typed per-provider envelope, built in lens
  // (weight) order from what each leg actually did. A lens the rotation never
  // reached (rotation fault before its perLensFn ran) is typed 'skipped', so
  // an engine-side failure is as visible as a fetch failure.
  // (Phase 221-02: built BEFORE ranking so the recovery dispatcher can merge
  // recovered items into the ranked set; the shipped fetch chain is untouched.)
  const providers = [];
  // Phase 221-02 (absorbed 221-01 Task 3): the per-provider stage-envelope
  // collector, in lens (weight) order. The 219 summary fields above and this
  // full-envelope view are TWO VIEWS OF ONE BAG (D-02 additive; zero renames).
  const stageEnvelopes = [];
  for (const entry of orderedLensSet) {
    const lens = entry.lens;
    const bag = fetchedByLens[lens];
    if (bag) {
      providers.push({
        provider: bag.source || lens,
        lens: lens,
        status: bag.status,
        reason: bag.reason,
        counts: { items: Array.isArray(bag.items) ? bag.items.length : 0 },
        freshness: bag.freshness,
        operation: bag.operation || null,
        fallback: bag.fallback || null,
        needs: bag.needs || null,
      });
      if (bag.envelope) stageEnvelopes.push(bag.envelope);
    } else {
      providers.push({
        provider: LENS_TO_SOURCE[lens] || lens,
        lens: lens,
        status: 'skipped',
        reason: 'rotation_never_reached_lens',
        counts: { items: 0 },
        freshness: 'unknown',
        operation: opByLens[lens] || null,
        fallback: null,
        needs: null,
      });
    }
  }
  // A leg the rotation never reached is closed as not executed, never left planned.
  operations.sweep(opLedger, 'run_aborted');
  // A rotation-level fault stays non-fatal (the ranked-continue-after-partial
  // resilience) but is now OBSERVABLE as its own orchestration-stage envelope.
  if (!(rotation && rotation.ok) && rotation && rotation.reason === 'rotation_threw') {
    stageEnvelopes.push(stageEnvelope.makeStageEnvelope({
      stage: 'orchestration',
      engine: 'lens-engine',
      status: 'failed',
      failure_class: 'unknown_error',
      error: 'rotation_threw',
    }));
  }

  // -------------------------------------------------------------------------
  // Phase 221-02 Task 2 (D-03): hand {envelopes, ctx} to the recovery
  // dispatcher after rotation. ctx.origin threads from the caller (default
  // 'on_demand'; scout/cadence callers pass 'cadence' -- Part 3: Tier-3 is
  // SKIPPED unattended). ADDITIVE: on action 'none' the wiring adds NOTHING
  // to the legacy result shape; Tier-3 is only ever RECORDED as an offer
  // (the controller is Plan 03, the D-07 gate consumes it there).
  // -------------------------------------------------------------------------
  let recovery = null;
  if (stageEnvelopes.length > 0) {
    const recoveredByRetry = [];
    const dispatchCtx = {
      origin: (typeof opts.origin === 'string' && opts.origin.length > 0) ? opts.origin : 'on_demand',
      background: opts.background === true,
      material: opts.material === true,
      roomDir: roomDir,
      requestedScope: lensNames,
      topicHandles: [topic],
      budgets: isPlainObject(opts._recoveryBudgets) ? opts._recoveryBudgets : undefined,
      _sleep: (typeof opts._sleep === 'function') ? opts._sleep : undefined,
      // Tier-1 retry: an idempotent RE-FETCH of the failed provider through
      // the one shipped fetch path (the dispatcher only ever calls this for
      // IDEMPOTENT_STAGES -- writes never reach it, T-221-07).
      retryFn: async function (envelope, _attempt) {
        const refetched = await fetchSourceCached(envelope.engine, topic, roomDir, fetchEnvelopeFn);
        if (Array.isArray(refetched.items) && refetched.items.length > 0) {
          recoveredByRetry.push({ source: envelope.engine, items: refetched.items });
        }
        return refetched.envelope;
      },
      // Tier-2 substitute: test seam; the dispatcher's default consumes
      // 219-05's queryRoomCorpus (consume, never re-implement).
      substituteFn: (typeof opts._substituteFn === 'function') ? opts._substituteFn : undefined,
    };
    let dispatch = null;
    try {
      dispatch = await recoveryDispatcher.dispatchRecovery({ envelopes: stageEnvelopes, ctx: dispatchCtx });
    } catch (_e) {
      // A broken dispatcher never breaks the shipped fetch chain (resilience).
      dispatch = null;
    }
    if (dispatch && dispatch.action && dispatch.action !== 'none') {
      recovery = dispatch;
      if (dispatch.action === 'retried' || dispatch.action === 'substituted') {
        // Merge retry-recovered live items under their true source + tier.
        for (const rec of recoveredByRetry) {
          for (const item of rec.items) {
            if (!isPlainObject(item)) continue;
            candidates.push(toFinding(item, rec.source, claimTokens));
          }
        }
        // Merge substitute items with their EXPLICIT substitution provenance
        // so downstream disclosure (Plan 04) can tell the truth: a substitute
        // is NEVER presented as live (D-03, T-221-08).
        const subs = Array.isArray(dispatch.substitutions) ? dispatch.substitutions : [];
        for (const sub of subs) {
          if (!Array.isArray(sub.results)) continue;
          for (const item of sub.results) {
            if (!isPlainObject(item)) continue;
            const f = toFinding(item, sub.substitute, claimTokens);
            f.provenance = sub.provenance;
            candidates.push(f);
          }
        }
      }
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
  const findings = ranked.slice(0, TOP_N).map((f) => {
    const out = {
      source: f.source,
      url: f.url,
      title: f.title,
      summary: f.summary,
      retrieved_at: f.retrieved_at,
      evidence_tier: f.evidence_tier,
      relevance: f.relevance,
    };
    // Only a recovery-substituted finding carries a provenance field (the
    // healthy-run shape is byte-identical to pre-221).
    if (typeof f.provenance === 'string') out.provenance = f.provenance;
    return out;
  });

  const result = {
    ok: true,
    findings,
    lens_set: orderedLensSet,
    rotation_ok: !!(rotation && rotation.ok),
    // D-19 additive envelope: a cold corpus composes 'insufficient_evidence',
    // never a bare ok:true + empty arrays (T-219-29).
    research_mode: composeResearchMode(providers),
    providers: providers,
    // Phase 221-02 additive: the full typed per-provider stage envelopes (the
    // recovery dispatcher's input). 219 consumers keep every field they read.
    stage_envelopes: stageEnvelopes,
  };
  // Phase 369.2 Plan 25 (CODE-02): when a lens was refused for want of a provider, the result names which
  // lenses really searched and which were unavailable (with the gate they need). The two keys ride ONLY on a
  // run that refused a lens, so a healthy run keeps its pre-221 shape (the 221 M4 pin); lensSummary(result)
  // derives the same two lists for any result.
  const lensSum = lensSummary(result);
  if (lensSum.unavailable_lenses.length > 0) {
    result.searched_lenses = lensSum.searched_lenses;
    result.unavailable_lenses = lensSum.unavailable_lenses;
  }
  // Phase 369.2 Plan 26: the preflight and the one sentence naming what could not be searched ride only on a
  // run that had an unavailable lens (the healthy-run shape stays byte-identical); lens_set is the narrowed set.
  if (pre.unavailable.length > 0) {
    result.lens_set = liveLensSet;
    result.preflight = { available: pre.available, unavailable: pre.unavailable };
    result.answer_line = unavailableAnswerLine(pre.unavailable);
  }
  // Phase 221-02 additive: the raw dispatch result rides alongside. Absent on
  // action 'none' (the byte-behavior guarantee).
  if (recovery) {
    result.recovery = recovery;
    // Phase 221-04 (D-08): map the dispatch outcome through the semantics
    // composer. research_mode may now take the two ADDITIVE values
    // ('manual_intervention_required' on human_required dispatch;
    // 'llm_engine_recovery' when a completed Tier-3 result is supplied via
    // the opts.recoveryResult surface seam) - the 219 four are unrenamed and
    // still compose every non-recovery run. outcome + disclosure ride
    // alongside ONLY on recovery-touched runs (the M4 healthy-run byte pin).
    const composed = resultSemantics.composeRecoveryResult({
      envelopes: stageEnvelopes,
      dispatch: recovery,
      recovery: isPlainObject(opts.recoveryResult) ? opts.recoveryResult : null,
      ctx: {
        requestedScope: lensNames,
        authoritativeEngines: Array.isArray(opts.authoritativeEngines) ? opts.authoritativeEngines : [],
        base_research_mode: result.research_mode,
        modelInfo: isPlainObject(opts.modelInfo) ? opts.modelInfo : undefined,
      },
    });
    result.research_mode = composed.research_mode;
    result.outcome = composed.outcome;
    result.disclosure = composed.disclosure;
  }
  return result;
}

module.exports = {
  runSourceLens,
  // Phase 363-04 (D-03, Canon Part 7): the ONE cache-first fetch helper,
  // exported additively for the 363 engine instead of copied. Returns
  // { items, results, status, reason, freshness, provenance, meta, envelope };
  // provenance is 'research-cache' on a hit, 'live' on a live fetch; meta is
  // {count, cost_usd, remaining_usd, limit_usd, x_query} or null.
  fetchSourceCached,
  lensSummary,
  // Phase 369.2 Plan 26 (HARNESS-03): the provider preflight and its plain-English sentence.
  preflightLenses,
  unavailableAnswerLine,
  // D-19 (Phase 219-05): the provider-status envelope seam. The explore chain
  // (explore-chain.cjs / research-filing.cjs queryRoomCorpus) composes onto
  // THIS vocabulary + composition rule -- one research_mode source of truth.
  RESEARCH_MODES,
  composeResearchMode,
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
