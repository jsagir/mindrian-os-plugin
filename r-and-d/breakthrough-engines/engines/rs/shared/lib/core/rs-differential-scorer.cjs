/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.2 Plan 06 Task 3 -- Phase 3 dual-floor differential scorer.
 *
 * Pair-wise differential scorer per kickoff §5:
 *
 *   pair passes IFF (diff > 0.3 AND LSA > 0.2 AND BERT > 0.2)
 *
 * where diff = |LSA - BERT|. Strict > comparisons throughout (Test 5
 * verifies the exact-threshold case fails). The dual-floor filter is the
 * detection signal that distinguishes structural-transfer pairs (LSA high,
 * BERT low) from semantic-implementation pairs (BERT high, LSA low) from
 * direct-intersection pairs (both high, low diff -- pruned by the diff floor).
 *
 * --------------------------------------------------------------------------
 * CANON PART 7 CARVE-OUT (DELIBERATE, DOCUMENTED)
 * --------------------------------------------------------------------------
 *
 * The pair-wise LSA cosine below uses an embedded sklearn TfidfVectorizer +
 * TruncatedSVD subset inside lsaBridgeScript -- NOT rs_math.py's
 * build_tfidf_svd. This is a deliberate exception to Reuse Before Build
 * because rs_math.py's API is CORPUS-LEVEL: it expects Sequence[str] >= 3
 * documents and fits a corpus-wide IDF + SVD basis. A pair-wise comparison
 * (1 query_concept vs 1 doc_concept = 2-document mini-corpus) cannot consume
 * that API without forcing degenerate corpus statistics that change the
 * algorithm's semantics:
 *
 *   - 2-document IDF is mathematically meaningless (IDF on a 2-document
 *     corpus collapses the whole vocabulary into one of two values; the
 *     "rare-term up-weighting" that motivates IDF stops working).
 *
 *   - 1-component SVD (max for a 2-document matrix) does NOT correspond
 *     to Kwan 2023's algorithm, which fits ~80 components against a real
 *     corpus to capture topic structure.
 *
 * The pair-wise question requires a fresh per-pair TfidfVectorizer +
 * TruncatedSVD fit specifically tuned for the pair-wise cosine -- which IS
 * what lsaBridgeScript does. rs_math.py continues to be consumed in its
 * CORPUS-MODE use case (e.g., scripts/rs-engine.py for corpus reverse-salient
 * computation per Phase 89-01 / 89-03 / 89-05).
 *
 * To avoid future drift toward "all LSA must go through one path," this
 * carve-out is documented in three locations:
 *
 *   1. The plan's must_haves block + objective (.planning/phases/89.2-.../
 *      89.2-06-preprocessor-and-differential-scorer-PLAN.md)
 *   2. This source file's header comment block (above)
 *   3. The embedded Python lsaBridgeScript header (inside lsaBridgeScript)
 *
 * Acceptance grep enforces the carve-out comment block (>= 2 hits across
 * the CJS header AND the embedded Python header) so refactors that strip
 * one without the other are loud, not silent.
 *
 * --------------------------------------------------------------------------
 *
 * BERT cosine path (Canon Part 7 reuse, NO carve-out): consumes
 * lib/core/rs-pinecone-bridge.cjs (Task 1 of this plan) which wraps the
 * existing rs_cache.py::fetch_all_from_namespace primitive (Phase 89-03
 * v1.10.16) for strict-1024-dim Pinecone-direct vector retrieval.
 *
 * Graceful degradation contract:
 *
 *   bridge fails (no PINECONE_API_KEY, network error, namespace empty)
 *     -> {diff: <lsa>, lsa: <lsa>, bert: null, passes: lsa > LSA_FLOOR,
 *         warning: 'bert_unavailable'}
 *     -> NEVER throws on bridge failure
 *
 *   LSA bridge fails (python3 missing, sklearn import error, parse error)
 *     -> {diff: null, lsa: null, bert: <bert>, passes: false,
 *         warning: 'lsa_unavailable'}
 *     -> Pessimistic: passes=false because LSA is the structural anchor;
 *        without LSA the differential signal is unrecoverable.
 *
 * Canon Part 8 (Graph Boundary): two defense-in-depth layers.
 *
 *   Layer 1 -- pre-input scan: query_concept + doc_concept are passed
 *     through auditQueryString BEFORE either bridge is called. On
 *     FORBIDDEN_PATTERNS hit, throws ExternalEgressViolation; the bridges
 *     are NEVER invoked (Tests 9 + 10 verify call counts == 0).
 *
 *   Layer 2 -- pre-return audit: composite output is passed through
 *     auditQueryObject before return. Throws ExternalEgressViolation on
 *     hit. Defense-in-depth so any forbidden pattern smuggled via the
 *     bridge response (warning fields, error fields) is caught at the gate.
 *
 * --------------------------------------------------------------------------
 * 2026 REVIEW NOTES (additive; every existing export and default is unchanged)
 * --------------------------------------------------------------------------
 *
 *  1. KNOWN DEFECT IN THE LEGACY LSA LEG (kept as default, documented). The
 *     embedded script fits a 2-document corpus, so n_components is
 *     max(1, min(80, n_terms - 1, 2 - 1)) = 1. The cosine of two 1-component
 *     projections is +1, -1 or 0, so after the clamp the "lsa" value is
 *     effectively binary (1.0 whenever both documents project onto the first
 *     component, 0.0 otherwise). It carries almost no graded signal, so the
 *     dual-floor test (diff > 0.3 AND lsa > 0.2 AND bert > 0.2) mostly reduces to
 *     a test on the BERT leg. Opt in to a graded, deterministic, no-Python
 *     lexical leg with score(a, b, { lexicalLeg: 'tfidf' }).
 *  2. KNOWN DEFECT IN THE LEGACY BERT LEG (kept as default, guarded). The
 *     bridge ignores queryText: it returns the first cached record of the
 *     namespace, so both twin queries return the SAME vector and the cosine is
 *     ~1.0 regardless of the two concepts. computeBertCosine now refuses a
 *     result whose two hits are the same record (error 'bridge_not_query_keyed')
 *     so the scorer degrades to the documented bert_unavailable path instead of
 *     emitting a fabricated 1.0. Supply opts.encodeFn (texts -> number[][]) to
 *     get a real query-keyed semantic cosine through score().
 *  3. Fixed 0.3 / 0.2 floors are the legacy mode. scoreMeasured now accepts
 *     opts.diffMode = 'percentile' with opts.referenceDiffs (abs_diff values
 *     from the same corpus) and opts.percentile (default 0.9): a pair passes
 *     when its abs_diff reaches that empirical quantile of the corpus. The
 *     pure helper rankByPercentile(results, opts) does the same for a batch of
 *     already-scored pairs. Ranking stays in code; no LLM is involved.
 *
 * Pure CJS, zero npm deps, node built-ins only beyond the rs-egress-* +
 * rs-pinecone-bridge primitives.
 */
'use strict';

const path = require('node:path');
const childProcess = require('child_process');
const { auditQueryString, auditQueryObject } = require('./rs-egress-prompts.cjs');
const pineconeBridge = require('./rs-pinecone-bridge.cjs');
const directionConvention = require('./direction-convention.cjs');
// rs-egress-violations is required transitively by rs-egress-prompts; we do
// not throw ExternalEgressViolation directly from this module (the audit
// helpers do). The require below is a reachability witness for the audit chain.
require('./rs-egress-violations.cjs');

// ---------- Frozen invariants ----------

const REPO_ROOT = path.resolve(__dirname, '..', '..');
// 2026: Windows installs expose `python`, not `python3`.
const PYTHON_BIN = process.env.MINDRIAN_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const LSA_BRIDGE_TIMEOUT_MS = 30000;

// Dual-floor thresholds per kickoff §5. Strict > comparisons.
const DIFF_FLOOR = 0.3;
const LSA_FLOOR = 0.2;
const BERT_FLOOR = 0.2;

// SEED-018 H2: semantic-floor gate on external candidates. A candidate whose
// semantic similarity to the topic is below SEMANTIC_FLOOR is dropped BEFORE it
// ever enters the unified differential matrix -- this kills keyword-overweighting
// at the source, so an off-topic OpenAlex keyword match (e.g. an
// atmospheric-remote-sensing paper on a "multi-user team collaboration" topic)
// never reaches score(). Default 0.15, tunable via RS_SEMANTIC_FLOOR. This is
// ADDITIVE to the dual-floor pair-wise logic above; it does not alter score()'s
// existing contract or thresholds.
const SEMANTIC_FLOOR = (function resolveSemanticFloor() {
  const raw = process.env.RS_SEMANTIC_FLOOR;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const v = Number(raw);
    if (!Number.isNaN(v) && v >= 0 && v <= 1) return v;
  }
  return 0.15;
})();

// ---------- Embedded Python LSA bridge script ----------
//
// CANON PART 7 CARVE-OUT (DELIBERATE, DOCUMENTED): see file header above
// for the complete justification. In short:
//   rs_math.py::build_tfidf_svd is corpus-level (Sequence[str] >= 3 docs);
//   pair-wise (1 vs 1) cosine cannot consume that API without forcing
//   degenerate IDF + SVD. The script below fits a fresh per-pair
//   TfidfVectorizer + TruncatedSVD specifically for the pair-wise question.
//
// The leading `# BSL 1.1` line plus the carve-out justification block
// constitute the Canon discipline marker on the embedded source surface
// (W4 fix per Plan 89.2-06). Acceptance grep enforces presence in both
// the CJS file header (above) AND this embedded Python block.

const lsaBridgeScript = [
  '# BSL 1.1',
  '# Copyright (c) 2026 Mindrian. Phase 89.2 Plan 06 Task 3 -- pair-wise LSA cosine.',
  '#',
  '# CANON PART 7 CARVE-OUT (DELIBERATE, DOCUMENTED): This script computes',
  '# pair-wise (1 vs 1) LSA cosine. It does NOT call rs_math.py because',
  '# rs_math.py::build_tfidf_svd is corpus-level (Sequence[str] >= 3',
  '# documents) and would produce degenerate IDF + SVD on a 2-document pair.',
  '# The embedded sklearn subset below fits a fresh per-pair TfidfVectorizer',
  '# + TruncatedSVD specifically for the pair-wise question, which is the',
  '# algorithmically correct path. rs_math.py is consumed in CORPUS mode by',
  '# scripts/rs-engine.py.',
  '#',
  '# Protocol:',
  '#   stdin   JSON {a: string, b: string}',
  '#   stdout  JSON {success: true, cosine: number} OR {success: false, error: string}',
  'import sys, json',
  'try:',
  '    from sklearn.feature_extraction.text import TfidfVectorizer',
  '    from sklearn.metrics.pairwise import cosine_similarity as sk_cos',
  '    from sklearn.decomposition import TruncatedSVD',
  '    payload = json.loads(sys.stdin.read())',
  '    a = str(payload.get("a", ""))',
  '    b = str(payload.get("b", ""))',
  '    if len(a.strip()) == 0 or len(b.strip()) == 0:',
  '        sys.stdout.write(json.dumps({"success": True, "cosine": 0.0}))',
  '        sys.exit(0)',
  '    texts = [a, b]',
  '    vec = TfidfVectorizer(stop_words="english").fit_transform(texts)',
  '    if vec.shape[1] < 2:',
  '        sys.stdout.write(json.dumps({"success": True, "cosine": 0.0}))',
  '        sys.exit(0)',
  '    n_components = max(1, min(80, vec.shape[1] - 1, vec.shape[0] - 1))',
  '    svd = TruncatedSVD(n_components=n_components, random_state=256).fit(vec)',
  '    reduced = svd.transform(vec)',
  '    c = float(sk_cos(reduced[0:1], reduced[1:2])[0][0])',
  '    # Clamp to [0, 1] for downstream dual-floor consistency. Negative LSA',
  '    # cosines arise on degenerate SVD bases and are not interpretable as',
  '    # similarity in the Kwan 2023 framework.',
  '    sys.stdout.write(json.dumps({"success": True, "cosine": max(0.0, c)}))',
  'except Exception as e:',
  '    sys.stdout.write(json.dumps({"success": False, "error": str(e)}))',
  '',
].join('\n');

// ---------- computeLsaCosine ----------
//
// Spawns python3 with the embedded lsaBridgeScript, passes the two strings
// via JSON-over-stdin, parses the response. Returns:
//
//   {success: true, cosine: number}
//   {success: false, error: 'python_unavailable'|'python_exit_<N>'|'parse_error'|'timeout'|...}

async function computeLsaCosine(a, b) {
  const requestEnvelope = JSON.stringify({ a: a, b: b });
  let res;
  try {
    res = childProcess.spawnSync(PYTHON_BIN, ['-c', lsaBridgeScript], {
      input: requestEnvelope,
      encoding: 'utf8',
      timeout: LSA_BRIDGE_TIMEOUT_MS,
      cwd: REPO_ROOT,
    });
  } catch (err) {
    return { success: false, error: 'spawn_threw', detail: String(err && err.message) };
  }

  if (res && res.error) {
    if (res.error.code === 'ENOENT') return { success: false, error: 'python_unavailable' };
    if (res.error.code === 'ETIMEDOUT' || res.error.code === 'ERR_CHILD_PROCESS_TIMEOUT') {
      return { success: false, error: 'timeout' };
    }
    return { success: false, error: 'spawn_error', detail: String(res.error.message) };
  }

  if (res && res.signal === 'SIGTERM') {
    return { success: false, error: 'timeout' };
  }

  const stdout = (res && typeof res.stdout === 'string') ? res.stdout : '';
  const stderr = (res && typeof res.stderr === 'string') ? res.stderr : '';

  if (res && res.status !== 0) {
    return {
      success: false,
      error: 'python_exit_' + res.status,
      stderr: stderr.slice(0, 500),
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch (_e) {
    return { success: false, error: 'parse_error', stdout_sample: stdout.slice(0, 200) };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { success: false, error: 'parse_error' };
  }

  if (parsed.success !== true) {
    return { success: false, error: typeof parsed.error === 'string' ? parsed.error : 'bridge_error' };
  }

  if (typeof parsed.cosine !== 'number' || isNaN(parsed.cosine)) {
    return { success: false, error: 'invalid_cosine' };
  }

  return { success: true, cosine: parsed.cosine };
}

// ---------- computeLexicalCosine (2026, opt-in graded lexical leg) ----------
//
// Deterministic pure-JS TF-IDF cosine for a pair, replacing the effectively
// binary 1-component LSA when opts.lexicalLeg === 'tfidf'. sklearn-compatible
// smoothing (idf = ln((1 + N) / (1 + df)) + 1, N = 2), sublinear off, L2
// normalised. Stopword list is a small fixed English set.
const LEX_STOPWORDS = new Set(('a an and are as at be but by for from has have in into is it its of on or '
  + 'such that the their then there these they this to was were which will with not no than also can may '
  + 'we our us using use used based via').split(' '));

function lexTokens(s) {
  const out = [];
  const m = String(s).toLowerCase().match(/[a-z0-9][a-z0-9_-]+/g) || [];
  for (let i = 0; i < m.length; i += 1) if (!LEX_STOPWORDS.has(m[i])) out.push(m[i]);
  return out;
}

function computeLexicalCosine(a, b) {
  const ta = lexTokens(a);
  const tb = lexTokens(b);
  if (ta.length === 0 || tb.length === 0) return { success: true, cosine: 0 };
  const ca = new Map(); const cb = new Map();
  ta.forEach(function (t) { ca.set(t, (ca.get(t) || 0) + 1); });
  tb.forEach(function (t) { cb.set(t, (cb.get(t) || 0) + 1); });
  const vocab = Array.from(new Set(Array.from(ca.keys()).concat(Array.from(cb.keys())))).sort();
  let dot = 0; let na = 0; let nb = 0;
  vocab.forEach(function (t) {
    const df = (ca.has(t) ? 1 : 0) + (cb.has(t) ? 1 : 0);
    const idf = Math.log((1 + 2) / (1 + df)) + 1;
    const x = (ca.get(t) || 0) * idf;
    const y = (cb.get(t) || 0) * idf;
    dot += x * y; na += x * x; nb += y * y;
  });
  if (na === 0 || nb === 0) return { success: true, cosine: 0 };
  return { success: true, cosine: Math.max(0, Math.min(1, dot / (Math.sqrt(na) * Math.sqrt(nb)))) };
}

// ---------- corpus-relative (percentile) helpers (2026) ----------
//
// Same definitions as rs-math.cjs / rs_math.py (cross-checked): linear
// interpolation quantile, mid-rank empirical percentile. Kept local because
// rs-math.cjs pulls in the numeric stack at load.
function _sortedFinite(values) {
  const out = [];
  for (let i = 0; i < values.length; i += 1) if (typeof values[i] === 'number' && Number.isFinite(values[i])) out.push(values[i]);
  out.sort(function (x, y) { return x - y; });
  return out;
}
function _quantile(sorted, q) {
  const n = sorted.length;
  if (n === 0 || !Number.isFinite(q)) return NaN;
  const idx = (n - 1) * Math.min(1, Math.max(0, q));
  const lo = Math.floor(idx); const hi = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}
function _percentileRank(sorted, x) {
  const n = sorted.length;
  if (n === 0 || !Number.isFinite(x)) return NaN;
  let lo = 0; let hi = n;
  while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < x) lo = m + 1; else hi = m; }
  const left = lo; hi = n;
  while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] <= x) lo = m + 1; else hi = m; }
  return (left + 0.5 * (lo - left)) / n;
}

const MIN_REFERENCE_DIFFS = 20;

/*
 * rankByPercentile(results, opts): pure, deterministic. `results` is an array
 * of objects carrying abs_diff (scoreMeasured) or diff (score()); opts:
 * { percentile = 0.9, field }. Returns a NEW array (input untouched), each
 * element shallow-copied with abs_diff_percentile (mid-rank, 0..1),
 * abs_diff_threshold (the empirical quantile) and passes_percentile. Items with
 * a non-numeric diff get abs_diff_percentile null and passes_percentile false.
 * With fewer than MIN_REFERENCE_DIFFS usable values the percentile is still
 * reported but passes_percentile is false and warning 'reference_too_small'
 * is set, because a quantile of a handful of pairs is not a threshold.
 */
function rankByPercentile(results, opts) {
  const o = opts || {};
  const pct = (typeof o.percentile === 'number' && o.percentile >= 0 && o.percentile <= 1) ? o.percentile : 0.9;
  const list = Array.isArray(results) ? results : [];
  const fieldOf = function (r) {
    if (!r || typeof r !== 'object') return null;
    const f = o.field ? r[o.field] : (typeof r.abs_diff === 'number' ? r.abs_diff : r.diff);
    return (typeof f === 'number' && Number.isFinite(f)) ? f : null;
  };
  const sorted = _sortedFinite(list.map(fieldOf).filter(function (v) { return v !== null; }));
  const threshold = _quantile(sorted, pct);
  const small = sorted.length < MIN_REFERENCE_DIFFS;
  return list.map(function (r) {
    const v = fieldOf(r);
    const copy = Object.assign({}, r);
    copy.abs_diff_percentile = v === null ? null : _percentileRank(sorted, v);
    copy.abs_diff_threshold = Number.isNaN(threshold) ? null : threshold;
    copy.passes_percentile = v !== null && !small && v >= threshold;
    if (small) copy.warning = copy.warning || 'reference_too_small';
    return copy;
  });
}

// ---------- computeBertCosine ----------
//
// Twin queryPineconeWithVectors calls (one per concept), then pure-JS
// cosineSimilarity on the resulting vectors -- historically 1024-dim
// (Pinecone multilingual-e5-large); after Plan 296-05's repoint, whatever
// dim the local signal cache's encoder resolves to (checked at runtime by
// the dim_mismatch guard below, not hardcoded here). Returns:
//
//   {success: true, cosine: number}
//   {success: false, error: 'namespace_required'|'bridge_failed'|'no_hits'|'shape_error'}

async function computeBertCosine(a, b, namespace, roomDir) {
  if (typeof namespace !== 'string' || namespace.length === 0) {
    return { success: false, error: 'namespace_required' };
  }

  const resA = await pineconeBridge.queryPineconeWithVectors(namespace, a, 1, roomDir);
  if (!resA || resA.success !== true) {
    return { success: false, error: 'bridge_failed_a', detail: resA && resA.error };
  }
  const resB = await pineconeBridge.queryPineconeWithVectors(namespace, b, 1, roomDir);
  if (!resB || resB.success !== true) {
    return { success: false, error: 'bridge_failed_b', detail: resB && resB.error };
  }

  if (!Array.isArray(resA.hits) || resA.hits.length === 0) {
    return { success: false, error: 'no_hits_a' };
  }
  if (!Array.isArray(resB.hits) || resB.hits.length === 0) {
    return { success: false, error: 'no_hits_b' };
  }

  const va = resA.hits[0] && resA.hits[0].values;
  const vb = resB.hits[0] && resB.hits[0].values;
  if (!Array.isArray(va) || !Array.isArray(vb)) {
    return { success: false, error: 'shape_error' };
  }
  // 2026 guard: the bridge is not keyed on the query text, so two different
  // concepts that come back as the identical cached record (same id AND same
  // vector) were never embedded; their cosine would be a fabricated ~1.0.
  const ha = resA.hits[0];
  const hb = resB.hits[0];
  if (a !== b && ha.id !== undefined && ha.id === hb.id && va.length === vb.length &&
      va.every(function (x, i) { return x === vb[i]; })) {
    return { success: false, error: 'bridge_not_query_keyed' };
  }
  // dim_mismatch is the runtime backstop for RSLOCAL-04. Pre-296-05 it
  // protected against a Pinecone shape error; after the repoint it protects
  // against a mixed-space compare (two records embedded by different
  // encoder versions/models). Left exactly as it was: still the load-
  // bearing guard, just against a different root cause now.
  if (va.length !== vb.length || va.length === 0) {
    return { success: false, error: 'dim_mismatch' };
  }

  const cos = pineconeBridge.cosineSimilarity(va, vb);
  return { success: true, cosine: cos };
}

// ---------- score ----------
//
// Public entry point. Pair-wise dual-floor differential scorer.
//
// Inputs:
//   query_concept  string  the concept seeded from preprocessor.concepts[]
//   doc_concept    string  the candidate concept (cross-domain or same-domain)
//   opts           optional:
//     namespace      string  signal-cache namespace for BERT cosine (typically 'external:<topic-slug>')
//     roomDir        string  (Plan 296-05) the room the namespace is scoped to; threaded
//                            through to both computeBertCosine's queryPineconeWithVectors calls
//
// Output (happy path):
//   {diff, lsa, bert, passes}
//
// Output (graceful degradation):
//   {diff, lsa, bert: null, passes: lsa>0.2, warning: 'bert_unavailable'}
//   {diff: null, lsa: null, bert, passes: false, warning: 'lsa_unavailable'}
//
// Throws (the only escape route -- Canon Part 8):
//   ExternalEgressViolation  if either concept matches FORBIDDEN_PATTERNS

async function score(query_concept, doc_concept, opts) {
  // Canon Part 8 Layer 1: pre-input scan on user-controlled concepts.
  // auditQueryString throws ExternalEgressViolation on hit; the bridges
  // below are NEVER invoked when this throws. Tests 9 + 10 verify the
  // call-count contract.
  auditQueryString(typeof query_concept === 'string' ? query_concept : '', 'differential-scorer');
  auditQueryString(typeof doc_concept === 'string' ? doc_concept : '', 'differential-scorer');

  opts = opts || {};
  const namespace = (typeof opts.namespace === 'string' && opts.namespace.length > 0)
    ? opts.namespace
    : null;
  const roomDir = (typeof opts.roomDir === 'string' && opts.roomDir.length > 0)
    ? opts.roomDir
    : null;

  // Run both bridges in parallel. computeLsaCosine is cheap (single Python
  // spawn); computeBertCosine spawns the Pinecone bridge twice. Promise.all
  // means LSA does not block on BERT's spawnSync in the parallel mock-test
  // case. Sequential await would be equivalent for correctness; parallel
  // is the future-proofing for real Brain latency.
  // 2026 opt-ins: opts.lexicalLeg === 'tfidf' replaces the (effectively
  // binary) Python 1-component LSA with a graded pure-JS TF-IDF cosine;
  // opts.encodeFn (texts -> number[][]) supplies a real query-keyed semantic
  // leg in place of the pinecone bridge. Defaults keep the legacy behaviour.
  const useTfidf = opts.lexicalLeg === 'tfidf';
  const lexPromise = useTfidf
    ? Promise.resolve(computeLexicalCosine(query_concept, doc_concept))
    : computeLsaCosine(query_concept, doc_concept);
  let semPromise;
  if (typeof opts.encodeFn === 'function') {
    semPromise = Promise.resolve().then(function () {
      const vecs = opts.encodeFn([query_concept, doc_concept]);
      const va = vecs && vecs[0];
      const vb = vecs && vecs[1];
      if (!Array.isArray(va) || !Array.isArray(vb) || va.length !== vb.length || va.length === 0) {
        return { success: false, error: 'shape_error' };
      }
      return { success: true, cosine: pineconeBridge.cosineSimilarity(va, vb) };
    }).catch(function (e) { return { success: false, error: 'encode_failed', detail: String(e && e.message) }; });
  } else {
    semPromise = computeBertCosine(query_concept, doc_concept, namespace, roomDir);
  }
  const [lsaResult, bertResult] = await Promise.all([lexPromise, semPromise]);

  let out;
  if (lsaResult.success && bertResult.success) {
    const lsa = lsaResult.cosine;
    const bert = bertResult.cosine;
    const diff = Math.abs(lsa - bert);
    const passes = (diff > DIFF_FLOOR) && (lsa > LSA_FLOOR) && (bert > BERT_FLOOR);
    out = { diff: diff, lsa: lsa, bert: bert, passes: passes };
  } else if (lsaResult.success && !bertResult.success) {
    // BERT unavailable: degrade to LSA-only. Per plan: bert=null, diff=lsa
    // (treat as max divergence), passes=(lsa>LSA_FLOOR only since bert
    // unavailable), warning='bert_unavailable'.
    const lsa = lsaResult.cosine;
    out = {
      diff: lsa,
      lsa: lsa,
      bert: null,
      passes: lsa > LSA_FLOOR,
      warning: 'bert_unavailable',
    };
  } else {
    // LSA failed (with or without BERT): pessimistic. Per plan: passes=false
    // because LSA is the structural anchor; without LSA the differential
    // signal is unrecoverable.
    out = {
      diff: null,
      lsa: null,
      bert: bertResult.success ? bertResult.cosine : null,
      passes: false,
      warning: 'lsa_unavailable',
    };
  }

  // Canon Part 8 Layer 2: pre-return audit on composite output.
  // Throws ExternalEgressViolation on any FORBIDDEN_PATTERNS hit.
  auditQueryObject(out, 'differential-scorer');

  return out;
}

// ---------- Semantic-floor gate (SEED-018 H2) ----------
//
// passesSemanticFloor: pure boolean guard. A candidate SURVIVES iff its cosine
// similarity to the topic vector is >= floor; otherwise it is off-topic noise
// and is rejected before the unified matrix. Reuses rs-pinecone-bridge's
// cosineSimilarity (Canon Part 7 reuse, no carve-out). A degenerate or
// orthogonal candidate vector cosines to 0, which is below any positive floor,
// so it is dropped -- the intended off-topic behavior. Pure / offline: no
// network, no Brain, no spawn.
function passesSemanticFloor(topicVector, candidateVector, floor) {
  const f = (typeof floor === 'number' && floor >= 0 && floor <= 1)
    ? floor
    : SEMANTIC_FLOOR;
  const sim = pineconeBridge.cosineSimilarity(topicVector, candidateVector);
  return sim >= f;
}

// gateCandidatesBySemanticFloor: drop external candidates below SEMANTIC_FLOOR
// BEFORE the differential matrix. encodeFn maps a candidate to its embedding
// vector (a deterministic offline stub encoder in tests per Canon Part 8; the
// embedding spine in production). Returns a filtered shallow copy; never mutates
// the input. If no encodeFn is supplied the gate is a no-op pass-through so
// existing callers are unaffected.
function gateCandidatesBySemanticFloor(topicVector, candidates, encodeFn, floor) {
  if (!Array.isArray(candidates)) return [];
  if (typeof encodeFn !== 'function') return candidates.slice();
  return candidates.filter(function keep(c) {
    return passesSemanticFloor(topicVector, encodeFn(c), floor);
  });
}

// ==========================================================================
// Measured differential (Phase 211, D-200-1)
// ==========================================================================
//
// scoreMeasured is the LOCAL, MEASURED, no-Python replacement for the legacy
// remote/Python legs on the pair-wise path. It is PURELY ADDITIVE: score(),
// computeLsaCosine, computeBertCosine, the embedded Python lsaBridgeScript, and
// every existing export are byte-unchanged. Nothing that consumed the legacy
// scorer notices this section exists.
//
//   semantic leg = local embedding cosine via the 211-01 embedding spine
//                  (embedTexts / encoderProvenance; default model is now
//                  MongoDB/mdbr-leaf-ir per quick(260706-13z) D3, was MiniLM),
//                  reusing the SAME cosineSimilarity score() trusts (Part 7,
//                  no fork).
//   lexical  leg = deterministic pure-CJS Jaccard (lexical-overlap.cjs,
//                  jaccard-v1), the no-Python replacement for the sklearn LSA
//                  spawn on this pair-wise path (SEED-049 D2).
//
// THE SIGN IS THE INSIGHT: signed_diff = semantic - lexical. The direction
// label is derived by lib/core/direction-convention.cjs's classify() (Phase
// 355 D-47; this was the FIFTH direction-classifying site in the repo,
// carrying an inverted copy of the rule until this flip -- 355-RESEARCH.md
// correction C1). classify(lexical, semantic) resolves to:
//   signed_diff > 0   structural_transfer     (same meaning, different words --
//                     the vocabulary bridge)
//   signed_diff <= 0  semantic_implementation (same words, different meaning --
//                     the false friend; includes the exact-tie case, D-02)
// scoreMeasured no longer carries its own copy of this comparison; it calls
// the one module. lib/core/eureka/portfolio-dimensions.cjs's feasibilityFromRs
// had its two label branches swapped in the SAME commit as this flip (355-10
// Task 2) so the pair-to-feasibility MAP, and therefore eureka's ranking, is
// unchanged -- only the label's own meaning became honest. See
// tests/fixtures/355/eureka-ranking-pin.json for the before/after proof.
//
// DROPPED LEG: the original differential(lexical, semantic, sentiment) loses its
// sentiment term per the s11 live-measurement refinement (no principled
// unlabeled sentiment computation exists). The measured formula is
// differential(lexical, semantic) only.
//
// UNCALIBRATED: EUREKA_DIFF_FLOOR and the bands below are DEFAULTS, not validated
// thresholds (s11). Calibration is a Phase 202 APO job. Every result is
// provenance-tagged (model, dtype, method, date) so no number is ever mistaken
// for ground truth (the s11 "store as embedding-cosine-differential with model +
// date, NEVER a bare differential_score" refinement; STRIDE T-211-07).
//
// Part 8 (Graph Boundary): the SAME dual-layer defense as score(). Layer 1
// auditQueryString on both inputs BEFORE any compute (so the injected encodeFn
// is NEVER reached on a forbidden input); Layer 2 auditQueryObject on the
// composite output before return. Encoder failure degrades to a structured
// warning envelope and NEVER throws; Part 8 violations remain the only escape
// route (same contract as score()).

// EUREKA_DIFF_FLOOR: env-tunable, reuses DIFF_FLOOR (0.3) as the default. Same
// env-string -> validated -> default pattern as SEMANTIC_FLOOR. Read at CALL
// time so a consumer (or test) can flip it between calls.
const EUREKA_DIFF_FLOOR_DEFAULT = DIFF_FLOOR;

function resolveEurekaDiffFloor() {
  const raw = process.env.EUREKA_DIFF_FLOOR;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const v = Number(raw);
    if (!Number.isNaN(v) && v >= 0 && v <= 1) return v;
  }
  return EUREKA_DIFF_FLOOR_DEFAULT;
}

// bandFor: UNCALIBRATED default bands over abs_diff (s11). Strict > comparisons.
function bandFor(absDiff) {
  if (absDiff > 0.5) return 'breakthrough';
  if (absDiff > 0.4) return 'high';
  if (absDiff > 0.3) return 'opportunity';
  if (absDiff > 0.1) return 'moderate';
  return 'low';
}

// ---------- scoreMeasured ----------
//
// scoreMeasured(a, b, opts) -> Promise<result>
//   opts.encodeFn   (texts -> number[][])  injectable semantic leg (tests)
//   opts.vectors    ([vecA, vecB])         precomputed vectors (211-05 reuse path)
//   opts.lexicalFn  ((a,b) -> number)      injectable lexical leg; default jaccard
//   opts._forceUnavailable                 forwarded to embedTexts (degradation test)
//
// See the section header for the full contract, floors, bands, and provenance.

async function scoreMeasured(a, b, opts) {
  // Canon Part 8 Layer 1: pre-input scan on user-controlled concepts. Throws
  // ExternalEgressViolation on hit; the encodeFn / spine below is NEVER invoked
  // when this throws (Test 8 pins encodeFn call-count 0).
  auditQueryString(typeof a === 'string' ? a : '', 'differential-scorer-measured');
  auditQueryString(typeof b === 'string' ? b : '', 'differential-scorer-measured');

  opts = opts || {};

  // Lexical leg (default jaccard-v1; injectable). Deterministic, offline, cheap.
  const lexicalFn = (typeof opts.lexicalFn === 'function')
    ? opts.lexicalFn
    : require('./semantic-index/lexical-overlap.cjs').lexicalOverlap;
  const lexical = lexicalFn(a, b);

  const measured_at = new Date().toISOString().slice(0, 10);
  const LEXICAL_METHOD = 'jaccard-v1';

  // Semantic leg: precomputed vectors > injected encodeFn > local embedding
  // spine (lazy-required INSIDE the function so the scorer still loads when the
  // heavy dep is absent -- Canon Decision #8).
  let semantic = null;
  let semantic_model = 'stub';
  let semantic_dtype = 'stub';
  let dim = 0;
  let encoderFailed = false;

  if (Array.isArray(opts.vectors) && opts.vectors.length === 2) {
    const vA = opts.vectors[0];
    const vB = opts.vectors[1];
    semantic = pineconeBridge.cosineSimilarity(vA, vB);
    dim = Array.isArray(vA) ? vA.length : 0;
  } else if (typeof opts.encodeFn === 'function') {
    // 2026: an injected encoder that throws degrades to the documented
    // encoder_unavailable envelope instead of escaping (the header contract
    // says only Part 8 violations may throw out of this function).
    try {
      const vecs = opts.encodeFn([a, b]);
      const vA = vecs && vecs[0];
      const vB = vecs && vecs[1];
      semantic = pineconeBridge.cosineSimilarity(vA, vB);
      dim = Array.isArray(vA) ? vA.length : 0;
    } catch (_encErr) {
      encoderFailed = true;
    }
  } else {
    // eslint-disable-next-line global-require
    const spine = require('./semantic-index/embedding-spine.cjs');
    const emb = await spine.embedTexts([a, b], opts);
    if (!emb || emb.success !== true || !Array.isArray(emb.vectors) || emb.vectors.length < 2) {
      encoderFailed = true;
    } else {
      semantic = pineconeBridge.cosineSimilarity(emb.vectors[0], emb.vectors[1]);
      const prov = spine.encoderProvenance();
      semantic_model = prov.model;
      semantic_dtype = prov.dtype;
      dim = (emb.provenance && emb.provenance.dim) || emb.vectors[0].length;
    }
  }

  let out;
  if (encoderFailed) {
    // Graceful degradation: never throw on encoder failure. Lexical still
    // measured; semantic null; pessimistic passes=false.
    out = {
      semantic: null,
      lexical: lexical,
      signed_diff: null,
      abs_diff: null,
      direction: null,
      passes: false,
      band: null,
      warning: 'encoder_unavailable',
      provenance: {
        semantic_model: null,
        semantic_dtype: null,
        dim: 0,
        lexical_method: LEXICAL_METHOD,
        measured_at: measured_at,
      },
    };
  } else {
    const floor = resolveEurekaDiffFloor();
    const signed_diff = semantic - lexical;
    const abs_diff = Math.abs(signed_diff);
    // 2026: threshold mode. 'fixed' (default) is the legacy absolute floor.
    // 'percentile' compares abs_diff to the opts.percentile quantile of
    // opts.referenceDiffs (abs_diff values of the same corpus), so the cutoff
    // moves with the corpus instead of being a magic 0.3.
    const diffMode = opts.diffMode === 'percentile' ? 'percentile' : 'fixed';
    let thresholdUsed = floor;
    let thresholdMode = 'fixed';
    let thresholdWarning = null;
    let diffPercentile = null;
    if (diffMode === 'percentile') {
      const ref = _sortedFinite(Array.isArray(opts.referenceDiffs) ? opts.referenceDiffs : []);
      const pct = (typeof opts.percentile === 'number' && opts.percentile >= 0 && opts.percentile <= 1) ? opts.percentile : 0.9;
      if (ref.length >= MIN_REFERENCE_DIFFS) {
        thresholdUsed = _quantile(ref, pct);
        thresholdMode = 'percentile';
        diffPercentile = _percentileRank(ref, abs_diff);
      } else {
        thresholdWarning = 'reference_too_small_fell_back_to_fixed';
      }
    }
    // Phase 355 D-47: the one direction rule, not a local copy (see the
    // section header above).
    const direction = directionConvention.classify(lexical, semantic);
    // passes iff the gap clears the floor AND the HIGH leg is real (not a gap
    // between two near-zero numbers).
    const highLeg = signed_diff > 0 ? semantic : lexical;
    const passes = thresholdMode === 'percentile'
      ? ((abs_diff >= thresholdUsed) && (highLeg > 0.2))
      : ((abs_diff > floor) && (highLeg > 0.2));
    out = {
      semantic: semantic,
      lexical: lexical,
      signed_diff: signed_diff,
      abs_diff: abs_diff,
      direction: direction,
      passes: passes,
      band: bandFor(abs_diff),
      provenance: {
        semantic_model: semantic_model,
        semantic_dtype: semantic_dtype,
        dim: dim,
        lexical_method: LEXICAL_METHOD,
        measured_at: measured_at,
        threshold_mode: thresholdMode,
        threshold: thresholdUsed,
      },
    };
    if (diffPercentile !== null) out.abs_diff_percentile = diffPercentile;
    if (thresholdWarning) out.warning = thresholdWarning;
  }

  // Canon Part 8 Layer 2: pre-return audit on composite output. Throws
  // ExternalEgressViolation on any FORBIDDEN_PATTERNS hit smuggled via a leg.
  auditQueryObject(out, 'differential-scorer-measured');

  return out;
}

// ---------- Exports ----------

module.exports = {
  score: score,
  scoreMeasured: scoreMeasured,
  SEMANTIC_FLOOR: SEMANTIC_FLOOR,
  passesSemanticFloor: passesSemanticFloor,
  gateCandidatesBySemanticFloor: gateCandidatesBySemanticFloor,
  rankByPercentile: rankByPercentile,
  _test: {
    computeLexicalCosine: computeLexicalCosine,
    MIN_REFERENCE_DIFFS: MIN_REFERENCE_DIFFS,
    DIFF_FLOOR: DIFF_FLOOR,
    LSA_FLOOR: LSA_FLOOR,
    BERT_FLOOR: BERT_FLOOR,
    SEMANTIC_FLOOR: SEMANTIC_FLOOR,
    LSA_BRIDGE_TIMEOUT_MS: LSA_BRIDGE_TIMEOUT_MS,
    PYTHON_BIN: PYTHON_BIN,
    REPO_ROOT: REPO_ROOT,
    computeLsaCosine: computeLsaCosine,
    computeBertCosine: computeBertCosine,
    lsaBridgeScript: lsaBridgeScript,
    passesSemanticFloor: passesSemanticFloor,
    gateCandidatesBySemanticFloor: gateCandidatesBySemanticFloor,
    EUREKA_DIFF_FLOOR_DEFAULT: EUREKA_DIFF_FLOOR_DEFAULT,
    resolveEurekaDiffFloor: resolveEurekaDiffFloor,
    bandFor: bandFor,
  },
};
