'use strict';
/*
 * Phase 118-00 Plan 00 -- mva-classifier: two-mode "is this a venture
 * sentence?" classifier for the 30-Second MVA pipeline.
 *
 * Modes:
 *   (a) Anthropic Haiku 4.5 with strict 1-sentence-classify prompt
 *       (when ANTHROPIC_API_KEY resolves from env / ~/.mindrian.env / CWD .env /
 *        module-relative plugin-root .env -- the last leg is cwd-independent)
 *   (b) Heuristic regex fallback (when no key resolvable) using
 *       data/mva-heuristic-keywords.json
 *
 * Per OQ3 lean + LD1 (118-CONTEXT.md):
 *   - English-only pipeline for v1.13.0
 *   - Hebrew detection (single char in U+0590-U+05FF) returns refusal envelope
 *     BEFORE any Haiku call -- never sends Hebrew bytes to the API
 *   - Length guard short-circuits < 12 chars OR > 600 chars without API call
 *
 * Per B5 (reward-before-investment) -- this classifier fires on the FIRST
 * user sentence, before any room-creation investment. The classifier is the
 * pin that decides whether the MVA brief gets built.
 *
 * Per Canon Part 8:
 *   - No Brain MCP calls anywhere in this file (verified by grep in tests)
 *   - The OUTBOUND payload to Anthropic carries the user's sentence (this is
 *     Anthropic-direct, NOT through Brain MCP, so Part 8 does NOT apply --
 *     Part 8 governs the LOCAL -> BRAIN boundary, not LOCAL -> Anthropic)
 *   - The resulting cache + state writes contain ONLY sha256 hashes of the
 *     sentence, never the raw text (the hook script enforces this)
 *
 * Per Phase 110 telemetry side-channel rule:
 *   - NO console.log
 *   - NO process.stdout.write
 *   - Errors go to stderr via the caller (the hook); this module returns
 *     structured result objects, never throws on classification failure
 *
 * Test seam (`_test` namespace, mirrors Plan 90-01 / 125-05 idiom):
 *   - setFetch(fn): inject a mock fetch implementation
 *   - clearCache(): reset the sha256 in-memory cache
 *
 * Pure CJS, node built-ins only (fs, path, os, crypto). Uses global fetch
 * (Node 18+); never adds a network-client dependency.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

// ---------- Constants ----------

const MIN_LEN = 12;
const MAX_LEN = 600;
const HAIKU_MODEL = 'claude-haiku-4-5';
const HAIKU_TIMEOUT_MS = 1200; // leaves 300ms headroom under the 1500ms hook budget
const HAIKU_MAX_TOKENS = 4;
const HAIKU_TEMP = 0;
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

const CLASSIFY_SYSTEM_PROMPT =
  "You are a 1-sentence classifier. Output ONLY 'venture' or 'not-venture'. " +
  "A 'venture' sentence describes a business idea, product, startup, app, " +
  "platform, or commercial undertaking the user is considering or building. " +
  "A 'not-venture' sentence is about code, admin tasks, debugging, or any " +
  'non-business topic. Output one word only.';

const HEURISTIC_PATH = path.resolve(__dirname, '..', '..', 'data', 'mva-heuristic-keywords.json');

// ---------- Module-scope cache + injectable fetch ----------

const _cache = new Map(); // sha256 hex -> { venture, source, reason, confidence, ... }
let _fetchImpl = null; // null = use global fetch; tests inject a stub
let _heuristicCache = null;

function _resetForTests() {
  _cache.clear();
  _fetchImpl = null;
  _heuristicCache = null;
}

// ---------- Heuristic loader ----------

function loadHeuristic() {
  if (_heuristicCache) return _heuristicCache;
  try {
    const raw = fs.readFileSync(HEURISTIC_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    _heuristicCache = {
      venture_keywords: Array.isArray(parsed.venture_keywords) ? parsed.venture_keywords : [],
      venture_negative_patterns: Array.isArray(parsed.venture_negative_patterns)
        ? parsed.venture_negative_patterns : [],
      language_pattern_hebrew: typeof parsed.language_pattern_hebrew === 'string'
        ? parsed.language_pattern_hebrew : '[\\u0590-\\u05FF]',
    };
  } catch (_e) {
    // Degraded mode: if the heuristic file is missing or corrupt, fail safe
    // (treat everything as non-venture). The MVA pipeline does not fire.
    _heuristicCache = {
      venture_keywords: [],
      venture_negative_patterns: [],
      language_pattern_hebrew: '[\\u0590-\\u05FF]',
    };
  }
  return _heuristicCache;
}

// ---------- ANTHROPIC_API_KEY resolver ----------
// Mirrors lib/core/resolve-brain-key.cjs precedence: env -> ~/.mindrian.env
// -> CWD/.env -> null. We do NOT require resolve-brain-key.cjs directly
// because that resolver is keyed to MINDRIAN_BRAIN_KEY, not ANTHROPIC_API_KEY.

function _homeDir() {
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

function _parseAnthropicKey(body) {
  const m = body.match(/^ANTHROPIC_API_KEY\s*=\s*(.+?)\s*$/m);
  if (!m) return null;
  // Strip surrounding double quotes if the value was quoted (per the
  // feedback_gmail_qp_env_var_corruption memory rule -- quoted values are
  // the recommended form for env keys starting with hex digits).
  let v = m[1].trim();
  if (v.length >= 2 && v.charCodeAt(0) === 34 && v.charCodeAt(v.length - 1) === 34) {
    v = v.slice(1, -1);
  }
  return v.length > 0 ? v : null;
}

function resolveAnthropicKey() {
  if (process.env.ANTHROPIC_API_KEY) {
    const v = String(process.env.ANTHROPIC_API_KEY).trim();
    if (v.length > 0) return v;
  }
  try {
    const p = path.join(_homeDir(), '.mindrian.env');
    if (fs.existsSync(p)) {
      const body = fs.readFileSync(p, 'utf8');
      const v = _parseAnthropicKey(body);
      if (v) return v;
    }
  } catch (_e) {}
  try {
    const p = path.join(process.cwd(), '.env');
    if (fs.existsSync(p)) {
      const body = fs.readFileSync(p, 'utf8');
      const v = _parseAnthropicKey(body);
      if (v) return v;
    }
  } catch (_e) {}
  // Fourth leg (RCA handoff-eureka-entity-noise-2026-07-19): a MODULE-RELATIVE
  // .env, resolved from __dirname (lib/core/ -> plugin root), NOT process.cwd().
  // WHY this exists: the cwd leg above only finds the repo/plugin .env when cwd
  // happens to be the plugin root at invocation. Real invocations (the MCP server
  // launched via .mcp.json with no `cwd`, then entity-extract run in-process
  // against a ROOM) execute with cwd = the host launch dir, never the plugin root,
  // so tier-2b's Anthropic key never resolved and the LLM NOISE classifier never
  // fired (tier2_model stayed 0 in every real run). This cwd-independent leg lets
  // it fire regardless of invocation directory. Cross-platform (path.join only).
  // KEYLESS-SAFE: .env is gitignored and not in package.json files[], so an
  // installed plugin cache has no .env here -> returns null -> the documented
  // graceful degrade is preserved for users who set no key. Canon Part 8 holds:
  // this is a LOCAL -> Anthropic key, never a LOCAL -> Brain reach.
  try {
    const p = path.resolve(__dirname, '..', '..', '.env');
    if (fs.existsSync(p)) {
      const body = fs.readFileSync(p, 'utf8');
      const v = _parseAnthropicKey(body);
      if (v) return v;
    }
  } catch (_e) {}
  return null;
}

// ---------- Sentence normalization + sha256 ----------

function _normalize(s) {
  return String(s || '').trim().toLowerCase();
}

function _sha256(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

// ---------- Language detect (Hebrew per LD1) ----------

function _isHebrew(sentence) {
  const h = loadHeuristic();
  let re;
  try {
    re = new RegExp(h.language_pattern_hebrew);
  } catch (_e) {
    // fall back to literal range -- guaranteed valid
    re = /[֐-׿]/;
  }
  return re.test(sentence);
}

// ---------- Heuristic decision ----------

function _heuristicDecision(sentence) {
  const norm = _normalize(sentence);
  const h = loadHeuristic();
  // Negative patterns win (Pitfall-3 safety net pattern from Phase 115-02
  // dual-path-detector: kill signals override positive matches).
  for (const p of h.venture_negative_patterns) {
    let re;
    try { re = new RegExp(p, 'i'); } catch (_e) { continue; }
    if (re.test(norm)) {
      return { venture: false, reason: 'matches_negative_pattern' };
    }
  }
  // Positive keyword: any keyword match -> venture-positive.
  for (const kw of h.venture_keywords) {
    const lkw = String(kw).toLowerCase();
    if (norm.indexOf(lkw) !== -1) {
      return { venture: true, reason: 'matches_venture_keyword' };
    }
  }
  return { venture: false, reason: 'no_keyword_match' };
}

// ---------- Haiku call (best-effort; falls back to heuristic on any error) ----------

function _getFetch() {
  if (_fetchImpl) return _fetchImpl;
  if (typeof fetch === 'function') return fetch;
  return null;
}

async function _callHaiku(sentence, apiKey) {
  const f = _getFetch();
  if (!f) return null; // no fetch available -- caller falls back to heuristic
  const body = {
    model: HAIKU_MODEL,
    max_tokens: HAIKU_MAX_TOKENS,
    temperature: HAIKU_TEMP,
    system: CLASSIFY_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: sentence }],
  };
  const ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => { try { ctrl.abort(); } catch (_e) {} }, HAIKU_TIMEOUT_MS) : null;
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
    if (!res || !res.ok) return null;
    const j = await res.json();
    // Extract first text block; expected single token 'venture' | 'not-venture'.
    let text = '';
    if (j && Array.isArray(j.content)) {
      for (const blk of j.content) {
        if (blk && blk.type === 'text' && typeof blk.text === 'string') {
          text += blk.text;
        }
      }
    }
    const t = String(text || '').trim().toLowerCase();
    if (t.indexOf('venture') === 0 && t.indexOf('not') !== 0) {
      return { venture: true, source: 'haiku-4-5', confidence: 'high' };
    }
    if (t.indexOf('not-venture') === 0 || t.indexOf('not venture') === 0) {
      return { venture: false, source: 'haiku-4-5', confidence: 'high', reason: 'haiku_classified_not_venture' };
    }
    // Ambiguous output -- caller falls back to heuristic.
    return null;
  } catch (_e) {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ---------- Public: classify ----------

/**
 * Classify a single user-typed sentence. Synchronous return for callers that
 * want best-effort speed (heuristic + cache); when the Haiku path runs it
 * blocks via a deasync-style spin only if a key is present. To keep the hook
 * budget honest we expose a sync-friendly contract: the FIRST call may run
 * Haiku synchronously via an Atomics.wait-style busy-loop UNLESS the test
 * seam has injected a mock fetch -- in which case we still resolve quickly.
 *
 * Because Node has no first-class sync HTTP, we implement classify() as a
 * synchronous function that runs heuristic + cache + Hebrew + length guards
 * synchronously, and DEFERS the Haiku async call to a separate classifyAsync
 * surface. The hook script (scripts/mva-detect.cjs) will use the sync entry
 * point to honor the 1500ms hook budget; the Haiku enrichment runs in the
 * dispatch worker (Plan 118-01) where async is natural.
 *
 * Per OQ3 lean: the heuristic + cache delivers the hook-budget-safe answer;
 * Haiku is the enrichment path. In practice the heuristic is the dominant
 * path for v1.13.0 because the 1500ms hook budget is tight.
 *
 * @param {string} sentence
 * @returns {{venture: boolean, source: string, confidence?: string, reason?: string}}
 */
function classify(sentence) {
  // Length guard FIRST (no fetch, no Hebrew check needed for empty/tiny)
  const s = String(sentence || '');
  if (s.length < MIN_LEN || s.length > MAX_LEN) {
    return { venture: false, source: 'length_guard', reason: 'length_out_of_range' };
  }

  // Hebrew detect SECOND (LD1: never send Hebrew bytes downstream)
  if (_isHebrew(s)) {
    return {
      venture: false,
      source: 'language_detect',
      reason: 'hebrew_unsupported_v1.13.0',
    };
  }

  // Cache check by sha256(normalized)
  const key = _sha256(_normalize(s));
  if (_cache.has(key)) return _cache.get(key);

  // Heuristic decision (synchronous, always runs)
  const heur = _heuristicDecision(s);

  // Decide source label based on key availability:
  //   - Key absent  -> heuristic_fallback, confidence: medium
  //   - Key present -> heuristic with confidence: high (Haiku enrichment
  //     is the async path for Plan 118-01; sync hook keeps the heuristic
  //     answer for the 1500ms budget)
  const keyAvail = resolveAnthropicKey() !== null;
  const result = heur.venture
    ? {
        venture: true,
        source: keyAvail ? 'heuristic' : 'heuristic_fallback',
        confidence: keyAvail ? 'high' : 'medium',
        reason: heur.reason,
      }
    : {
        venture: false,
        source: keyAvail ? 'heuristic' : 'heuristic_fallback',
        confidence: keyAvail ? 'high' : 'medium',
        reason: heur.reason,
      };

  _cache.set(key, result);
  return result;
}

/**
 * Boolean alias: true iff classify(s).venture is true.
 */
function isVentureSentence(s) {
  return classify(s).venture === true;
}

/**
 * Async enrichment surface (called by Plan 118-01's dispatcher worker, not
 * by the hook). Runs the Haiku 4.5 path when a key resolves; otherwise
 * returns the same heuristic-driven result classify() returned synchronously.
 *
 * The cache contract: classifyAsync writes through to the same sha256 cache
 * so a subsequent sync classify() call returns the Haiku-enriched answer.
 */
async function classifyAsync(sentence) {
  const sync = classify(sentence);
  if (sync.source === 'length_guard' || sync.source === 'language_detect') return sync;
  const apiKey = resolveAnthropicKey();
  if (!apiKey) return sync; // no enrichment path -- heuristic stands
  const enriched = await _callHaiku(sentence, apiKey);
  if (!enriched) return sync; // Haiku failed/timed out -- heuristic stands
  // Promote: write enriched into cache by sha256(normalized).
  const key = _sha256(_normalize(sentence));
  const promoted = Object.assign({}, sync, enriched);
  _cache.set(key, promoted);
  return promoted;
}

module.exports = {
  classify,
  classifyAsync,
  isVentureSentence,
  loadHeuristic,
  resolveAnthropicKey,
  // Test seam (mirrors Plan 90-01 / 125-05 idiom)
  _test: {
    setFetch(fn) { _fetchImpl = fn; },
    clearCache() { _resetForTests(); },
  },
};
