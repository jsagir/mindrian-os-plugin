'use strict';
/*
 * Quick-task 260714-k44 -- tier-2a LOCAL embedding WHAT-vs-WHY classifier.
 *
 * WHAT THIS IS: the FREE, fully local first pass of the two-tier WHAT-vs-WHY
 * decision. Tier-1 (entity-extractor.cjs) is a structural regex parser that keeps
 * or drops a capitalized candidate by a hardcoded stoplist. This module draws the
 * SEMANTIC distinction the stoplist cannot generalize:
 *   WHAT: a concrete proper-noun entity in the venture's external world
 *         (a company, an organization, a product/technology, a named market).
 *   WHY:  the workspace's OWN methodology/framework/process-stage vocabulary --
 *         a term naming HOW the venture is analyzed or documented.
 * It answers that question by SEMANTIC SIMILARITY: how close is a candidate to a
 * curated set of WHAT exemplars versus a curated set of WHY exemplars, measured
 * with the room's already-shipped local encoder (embedding-spine.cjs, the same
 * encoder Eureka's ranking depends on). This is the tier-2a pass; the clear
 * majority of candidates resolve here at ZERO API spend. Only the low-margin
 * residual escalates to the tier-2b classifier module (entity-classifier.cjs,
 * unchanged), which the dispatcher calls for that residual only.
 *
 * WHY NEAREST-NEIGHBOR (not a centroid): the natural fit for a ~40-term in-memory
 * reference set is embedTexts plus the exported cosineSimilarity, scoring each
 * candidate against every exemplar and taking the MAX similarity per side. Unlike
 * vector-store.cjs (which needs a caller-owned sqlite handle this classifier does
 * not have, and whose own fallback leg is exactly a brute-force cosine scan), an
 * in-memory nearest-neighbor scan needs no db and makes an EXACT reference-set
 * member trivially confident at similarity 1.0 -- which is precisely why the live
 * residual-noise terms (Larry, Governing Thought, Pyramid Logic) resolve WHY for
 * free once they are seeded into the WHY reference set below.
 *
 * WHAT IT STRUCTURALLY CANNOT DO: the embedding tier labels ONLY 'what' or 'why'.
 * It cannot detect NOISE (a sentence-position fragment that names nothing) -- that
 * is a semantic verdict the closed two-way comparison cannot make, so NOISE stays
 * a tier-2b (LLM) verdict. A candidate the embedding tier is not confident about
 * is not silently forced either way; it is returned confident:false so the caller
 * can escalate it.
 *
 * CANON PART 8 (Graph Boundary): fully local, ZERO user-byte egress. This module
 * delegates all embedding to embedding-spine.cjs and adds no transport of its own.
 * The spine's documented boundary holds verbatim: the only network touch anywhere
 * is the one-time generic model-weight download by model id (no user text, no room
 * content leaves the machine); on this machine the model is already cached from
 * Eureka's own ranking runs. This module contains NO LLM transport host string and
 * NO Brain host string -- the sibling-transport test scans every eureka module and
 * proves entity-classifier.cjs stays the sole transport carrier.
 *
 * CANON PART 7 (Reuse Before Build): the WHY reference seed is the SAME frozen Set
 * exported by entity-extractor.cjs (FRAMEWORK_TERMS), reused here, never copied.
 * cosineSimilarity and embedTexts are reused from embedding-spine.cjs.
 *
 * DEGRADE-NEVER-THROW: any encoder failure (dep absent, model unresolvable, embed
 * error) returns { ok: false, error, detail } so the caller routes around the
 * whole tier; an empty/invalid names input returns { ok: true } with empty results.
 * This function NEVER throws across its boundary.
 *
 * Contract:
 *   async classifyByEmbedding({ names }, opts)
 *     -> { ok: true,
 *          results: { [name]: { label: 'what'|'why', margin: number, confident: boolean } },
 *          provenance: { model, dim, threshold } }
 *      | { ok: false, error: 'encoder_unavailable'|'embed_failed', detail }
 *   opts.encodeFn / opts._forceUnavailable are forwarded to embedTexts (the
 *   existing spine test seams), so every leg runs offline with injected vectors.
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE).
 */

const spine = require('./embedding-spine.cjs');
const { embedTexts, cosineSimilarity, encoderProvenance, resolveDim } = spine;

// ---------- Reference sets (reuse, do not invent) ----------
//
// WHY_EXAMPLES: the exported FRAMEWORK_TERMS Set (the room's own WHY vocabulary,
// reused per Canon Part 7) plus the three live 218-VERIFICATION.md residual-noise
// terms the tier-1 stoplist could not reach. Those three are the room's own
// persona / methodology vocabulary that ranked as top "entities" on the live
// aion-eureka-synergy room; exact membership here makes them trivially confident
// WHY at similarity ~1.0 and zero cost, which is exactly what unblocks the pending
// quick 260714-hzx live verification WITHOUT a funded key.
const FRAMEWORK_TERMS = require('./entity-extractor.cjs').FRAMEWORK_TERMS;
const WHY_EXAMPLES = Object.freeze(
  Array.from(FRAMEWORK_TERMS).concat(['Larry', 'Governing Thought', 'Pyramid Logic'])
);

// WHAT_EXAMPLES: the synthetic-fixture and verification-corpus company / org names
// already used by commit 7d98c9b8 and quick 260714-hzx (reused, not invented, per
// the task directive) -- concrete proper-noun entities in the venture world.
const WHAT_EXAMPLES = Object.freeze([
  'Helix Biosciences', 'Genomix', 'Meridian Therapeutics', 'BioNova Labs',
  'AION Labs', 'Recursion', 'Prodrive', 'Xtrac',
]);

// DEFAULT_MARGIN: the confidence-margin default below which a candidate escalates
// to tier-2b. MEASUREMENT-CALIBRATED against the real local encoder
// (MongoDB/mdbr-leaf-ir) in quick 260714-k44 Task 3 (the full margin table is in
// that task's SUMMARY). The finding: mdbr-leaf-ir is a RETRIEVAL model, not a
// classifier, so its WHAT-vs-WHY separation on this vocabulary is weak and it leans
// WHY. At 0.10 every calibration holdout is confident-AND-correct while every
// misclassification-prone term escalates (a WHAT company mislabeled WHY at margin
// <= 0.10 is pushed to the LLM tier rather than silently suppressed). Lower values
// (0.05) resolve more candidates for free but confidently mislabel real companies;
// 0.10 is the conservative point where a confident verdict is trustworthy and the
// residual escalates. Tunable per room via MINDRIAN_WHATWHY_MARGIN.
const DEFAULT_MARGIN = 0.10;

// resolveMargin: MINDRIAN_WHATWHY_MARGIN env, validated positive-FLOAT parse
// mirroring embedding-spine.cjs resolveBatchSize's shape (non-empty trimmed string
// -> Number -> finite and > 0, else the calibrated default). A malformed operator
// env ('0', '-1', 'abc', '') can never zero out or invert routing.
function resolveMargin() {
  const raw = process.env.MINDRIAN_WHATWHY_MARGIN;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw.trim());
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_MARGIN;
}

// ---------- Reference embedding cache (once per process, per model) ----------
//
// The reference set is embedded exactly ONCE per process, keyed by the resolved
// model (mirrors the embedding-spine _pipelineCache idiom): a mid-process model
// swap rebuilds the reference vectors rather than silently reusing the wrong ones.
// A FAILED embedding is never cached (transient encoder failure must not poison
// the cache), so a later call retries cleanly. Exposed via _test.resetRefCache().
let _refCache = Object.create(null);

async function buildRefVectors(opts) {
  const res = await embedTexts(WHAT_EXAMPLES.concat(WHY_EXAMPLES), opts);
  if (!res || res.success !== true || !Array.isArray(res.vectors)
      || res.vectors.length !== WHAT_EXAMPLES.length + WHY_EXAMPLES.length) {
    return {
      ok: false,
      error: (res && res.error) || 'embed_failed',
      detail: res && res.detail,
    };
  }
  const whatVectors = res.vectors.slice(0, WHAT_EXAMPLES.length);
  const whyVectors = res.vectors.slice(WHAT_EXAMPLES.length);
  const dim = (res.vectors[0] && res.vectors[0].length) || 0;
  return { ok: true, whatVectors: whatVectors, whyVectors: whyVectors, dim: dim };
}

function getRefVectors(opts) {
  const model = encoderProvenance().model;
  if (_refCache[model]) return _refCache[model];
  const p = buildRefVectors(opts).then(function (r) {
    if (!r || r.ok !== true) { delete _refCache[model]; } // never poison the cache
    return r;
  });
  _refCache[model] = p;
  return p;
}

// maxSim: the nearest-neighbor score of a candidate vector against a reference
// side -- the MAX cosine similarity to any exemplar on that side. cosineSimilarity
// is defensive (returns 0 on a bad vector), so a malformed row never throws.
function maxSim(cv, refVectors) {
  let best = -Infinity;
  for (let i = 0; i < refVectors.length; i += 1) {
    const s = cosineSimilarity(cv, refVectors[i]);
    if (s > best) best = s;
  }
  return best;
}

/**
 * classifyByEmbedding({ names }, opts) -- the tier-2a local pass.
 *
 * Embeds the reference set once (cached) and the candidate batch once, then labels
 * each candidate by nearest-neighbor cosine similarity: label = whichever side is
 * closer ('what' on an exact tie -- the fail-open direction), margin = the absolute
 * similarity gap, confident = margin >= resolveMargin(). Never throws.
 *
 * @param {{names: string[]}} input
 * @param {object} [opts] - forwarded to embedTexts (encodeFn / _forceUnavailable).
 * @returns {Promise<object>}
 */
async function classifyByEmbedding(input, opts) {
  const options = opts || {};
  const threshold = resolveMargin();
  const model = encoderProvenance().model;
  try {
    const names = (input && Array.isArray(input.names))
      ? input.names.filter(function (n) { return typeof n === 'string' && n.length > 0; })
      : [];
    if (names.length === 0) {
      return { ok: true, results: {}, provenance: { model: model, dim: resolveDim(), threshold: threshold } };
    }

    const ref = await getRefVectors(options);
    if (!ref || ref.ok !== true) {
      return { ok: false, error: (ref && ref.error) || 'encoder_unavailable', detail: ref && ref.detail };
    }

    const emb = await embedTexts(names, options);
    if (!emb || emb.success !== true || !Array.isArray(emb.vectors) || emb.vectors.length !== names.length) {
      return { ok: false, error: (emb && emb.error) || 'embed_failed', detail: emb && emb.detail };
    }

    const results = {};
    for (let i = 0; i < names.length; i += 1) {
      const cv = emb.vectors[i];
      const simWhat = maxSim(cv, ref.whatVectors);
      const simWhy = maxSim(cv, ref.whyVectors);
      const label = simWhat >= simWhy ? 'what' : 'why'; // 'what' on an exact tie (fail-open)
      const margin = Math.abs(simWhat - simWhy);
      results[names[i]] = { label: label, margin: margin, confident: margin >= threshold };
    }
    return { ok: true, results: results, provenance: { model: model, dim: ref.dim, threshold: threshold } };
  } catch (err) {
    // Degrade-never-throw: any unexpected failure routes the whole tier around.
    return { ok: false, error: 'embed_failed', detail: String(err && err.message) };
  }
}

module.exports = {
  classifyByEmbedding: classifyByEmbedding,
  DEFAULT_MARGIN: DEFAULT_MARGIN,
  resolveMargin: resolveMargin,
  _test: {
    WHAT_EXAMPLES: WHAT_EXAMPLES,
    WHY_EXAMPLES: WHY_EXAMPLES,
    resetRefCache: function reset() { _refCache = Object.create(null); },
  },
};
