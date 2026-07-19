'use strict';
/*
 * Quick-task 260714-hzx -- tier-2 WHAT / WHY / NOISE semantic entity classifier.
 *
 * WHAT THIS IS: the SECOND pass over the tier-1 entity-extractor's survivors. Tier-1
 * is a structural regex parser with only two outcomes for a capitalized candidate:
 * kept as an entity, or dropped by a hardcoded stoplist. That is a STRUCTURAL
 * distinction. The distinction this module draws is SEMANTIC and a stoplist cannot
 * make it: given a surviving proper-noun term, is it
 *   WHAT: a concrete entity in the venture's external world (a company, an
 *         organization, a product / technology, a named market or segment), or
 *   WHY:  the workspace's OWN methodology, framework, process-stage, or
 *         analytical-dimension vocabulary -- a term naming HOW the venture is
 *         analyzed or documented, in ANY domain (a biotech room's regulatory-stage
 *         labels are WHY exactly as a software room's framework labels are), or
 *   NOISE: not a meaningful term (sentence-position capitalization, a fragment).
 * Because the WHY vocabulary is domain-specific and unbounded, no hardcoded list
 * can generalize -- a local classification model is the right tool.
 *
 * MODEL BOUNDARY (documented the same way entity-extractor.cjs documents its
 * zero-egress guarantee, and mandated by the task directive):
 *   - This is the FIRST legitimately model-using step in the entity-extraction
 *     pipeline. Tier-1 keeps its Part 8 ZERO-egress guarantee; this tier-2 module
 *     is the ONLY place the pipeline reaches a model.
 *   - It is a LOCAL classification call over the Anthropic LLM transport -- the
 *     established plugin pattern. Precedents whose headers spell this out:
 *     lib/core/mva-classifier.cjs and lib/core/llm-name-suggester.cjs. The Part 8
 *     graph boundary governs LOCAL -> BRAIN (the Mindrian-owned methodology
 *     repository that must never receive user data), NOT LOCAL -> the stateless
 *     Anthropic LLM transport. User room content (candidate names + a short
 *     excerpt) crosses ONLY to that transport, never to the Brain surface.
 *   - This is explicitly NOT the Plurai remote classifier that 218-VERIFICATION.md
 *     rejected: that was an unverified third-party judge. This is the repo's
 *     standard local LLM transport with a degrade-to-passthrough contract.
 *   - There is NO Brain host string and NO brain-client require anywhere in this
 *     file (the llm-name-suggester tripwire pattern, grep-gated by the test).
 *
 * DEGRADE-TO-PASSTHROUGH CONTRACT: with no resolvable key, no available transport,
 * a non-2xx response, a timeout, an unparseable body, or any other failure, this
 * module returns the fallback -- every candidate labeled 'what', source 'fallback'
 * -- so the caller writes exactly today's behavior. It NEVER throws.
 *
 * REUSE-BEFORE-BUILD (Part 7): resolveAnthropicKey is REQUIRED from
 * lib/core/mva-classifier.cjs (it is exported there), never copied.
 *
 * Test seam: module-scope _fetchImpl injected via _test.setFetch(fn) /
 * _test.reset(), mirroring mva-classifier exactly, so every test leg runs offline
 * with zero live calls.
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE).
 */

const mva = require('../mva-classifier.cjs');

// Model id inlined with provenance. The source-of-truth declaration lives at
// lib/core/mva-classifier.cjs:53 (HAIKU_MODEL); it is a module-internal const
// there, NOT exported, so per the llm-name-suggester.cjs:54 precedent it is
// inlined here rather than required. If a future phase exports it, replace the
// literal with the require.
const CLASSIFIER_MODEL = 'claude-haiku-4-5';
const CLASSIFIER_TIMEOUT_MS = 10000; // batch-pipeline budget, not the 1500ms hook budget
const CLASSIFIER_MAX_TOKENS = 500;
const CLASSIFIER_TEMP = 0;
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const EXCERPT_CAP = 600;

// The closed label set. Any value outside it (from an adversarial or garbled
// response) is coerced to 'noise' -- see _coerceLabels for why this DROPS the term
// rather than promoting it to 'what' (RCA handoff-eureka-entity-noise-2026-07-19).
const VALID_LABELS = new Set(['what', 'why', 'noise']);

// The system prompt defines the three labels GENERICALLY. It deliberately carries
// zero workspace-specific vocabulary -- a hardcoded example term would structurally
// prevent domain-agnosticism, and the test greps this file to prove there is none.
const CLASSIFY_SYSTEM_PROMPT = [
  'You are a terminology classifier for a venture-analysis workspace.',
  'You receive a JSON object with a "candidates" array of proper-noun terms',
  'extracted from ONE analysis document, plus a short "excerpt" of that document',
  'for context. Label every candidate with exactly one of three categories:',
  '',
  'WHAT: a concrete proper-noun entity that exists in the venture external world',
  '  - a company, an organization, a product or technology, or a named market or',
  '  segment. A thing in the world the venture operates in.',
  '',
  'WHY: the workspace own methodology, framework, process-stage, or',
  '  analytical-dimension vocabulary. A term that names HOW the venture is being',
  '  analyzed or documented, rather than a thing in the venture world. This is',
  '  domain-independent: a biotech document regulatory-stage or milestone labels',
  '  are WHY exactly as any other document analytical-framework labels are WHY.',
  '',
  'NOISE: not a meaningful term. A sentence-position capitalization, a fragment,',
  '  or a generic word that names nothing.',
  '',
  'Output STRICT JSON and nothing else, of the exact form',
  '{"labels":{"TermOne":"what","TermTwo":"why"}}. Every input candidate must',
  'appear as a key. Use only the lowercase strings what, why, or noise as values.',
].join('\n');

// ---------- Module-scope injectable transport (test seam) ----------

let _fetchImpl = null; // null = use global fetch; tests inject a stub

function _reset() { _fetchImpl = null; }

function _getFetch() {
  if (_fetchImpl) return _fetchImpl;
  if (typeof fetch === 'function') return fetch;
  return null;
}

// The pass-through fallback: every name -> 'what'. Never throws.
function _fallback(names) {
  const labels = {};
  for (const n of names) labels[n] = 'what';
  return { labels: labels, source: 'fallback' };
}

// Coerce a raw model labels object into the closed set. An unknown or missing
// value DROPS the term (coerced to 'noise'), it does NOT default to 'what'.
//
// RCA handoff-eureka-entity-noise-2026-07-19: this is the ONE path where the model
// DID run (a parseable response came back) but returned garbage or nothing for a
// specific term. Promoting that to 'what' minted a CONFIRMED entity out of a
// non-answer -- the model was asked, did not answer usefully, and its silence was
// read as a positive verdict. That is not graceful degradation, it is a provenance
// leak. Coercing to 'noise' drops the term through the existing NOISE path (the
// caller in entity-extract.cjs treats 'noise' as a drop). This is a NARROW change:
// it does NOT touch the DEGRADE-TO-PASSTHROUGH contract (_fallback), which still
// fails OPEN to every-name-'what' when the whole response fails (no key, throw,
// non-2xx, unparseable body) -- so the T-T2-01 DoS protection (an adversarial doc
// cannot suppress extraction by inducing a FULL classifier failure) is preserved.
// Only a per-term non-answer inside an otherwise-valid response now drops.
function _coerceLabels(names, raw) {
  const labels = {};
  const rawLabels = (raw && typeof raw === 'object' && raw.labels && typeof raw.labels === 'object')
    ? raw.labels
    : {};
  for (const n of names) {
    const v = typeof rawLabels[n] === 'string' ? rawLabels[n].trim().toLowerCase() : null;
    labels[n] = (v && VALID_LABELS.has(v)) ? v : 'noise';
  }
  return labels;
}

/**
 * classifyArtifactCandidates({ names, excerpt }, opts)
 *   -> { labels: { [name]: 'what'|'why'|'noise' }, source: 'model'|'fallback' }
 *
 * Classifies the tier-1 survivor candidate names for ONE artifact. On any failure
 * mode it degrades to pass-through (every name 'what', source 'fallback') and
 * NEVER throws.
 *
 * @param {{names: string[], excerpt?: string}} input
 * @param {object} [opts] - reserved for future tuning; currently unused.
 * @returns {Promise<{labels: object, source: string}>}
 */
async function classifyArtifactCandidates(input, opts) {
  void opts;
  const names = (input && Array.isArray(input.names))
    ? input.names.filter(function (n) { return typeof n === 'string' && n.length > 0; })
    : [];
  if (names.length === 0) return { labels: {}, source: 'fallback' };

  const excerpt = (input && typeof input.excerpt === 'string')
    ? input.excerpt.slice(0, EXCERPT_CAP)
    : '';

  let apiKey = null;
  try { apiKey = mva.resolveAnthropicKey(); } catch (_e) { apiKey = null; }
  if (!apiKey) return _fallback(names);

  const f = _getFetch();
  if (!f) return _fallback(names);

  const body = {
    model: CLASSIFIER_MODEL,
    max_tokens: CLASSIFIER_MAX_TOKENS,
    temperature: CLASSIFIER_TEMP,
    system: CLASSIFY_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: JSON.stringify({ candidates: names, excerpt: excerpt }),
    }],
  };

  const ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
  const timer = ctrl
    ? setTimeout(function () { try { ctrl.abort(); } catch (_e) {} }, CLASSIFIER_TIMEOUT_MS)
    : null;
  try {
    const res = await f(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
      signal: ctrl ? ctrl.signal : undefined,
    });
    if (!res || !res.ok) return _fallback(names);
    const j = await res.json();
    let text = '';
    if (j && Array.isArray(j.content)) {
      for (const blk of j.content) {
        if (blk && blk.type === 'text' && typeof blk.text === 'string') text += blk.text;
      }
    }
    const trimmed = String(text || '').trim();
    if (!trimmed) return _fallback(names);
    let parsed;
    try { parsed = JSON.parse(trimmed); } catch (_e) { return _fallback(names); }
    const labels = _coerceLabels(names, parsed);
    return { labels: labels, source: 'model' };
  } catch (_e) {
    return _fallback(names);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

module.exports = {
  classifyArtifactCandidates: classifyArtifactCandidates,
  CLASSIFIER_MODEL: CLASSIFIER_MODEL,
  CLASSIFY_SYSTEM_PROMPT: CLASSIFY_SYSTEM_PROMPT,
  // Test seam (mirrors the mva-classifier _test idiom).
  _test: {
    setFetch: function (fn) { _fetchImpl = fn; },
    reset: function () { _reset(); },
  },
};
