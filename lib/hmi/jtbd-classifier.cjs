/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 100-02 Task 2 -- Heuristic JTBD Classifier
 * =================================================
 * Phase 100's central computational primitive. Reads the 13-entry
 * taxonomy (lib/hmi/jtbd-taxonomy.json), the active operator
 * (Phase 99 lib/conversation/operator.cjs), the user's latest
 * message, and the last N decisions from STATE.md. Returns a typed
 * JTBD assignment with confidence and an evidence chain.
 *
 * Heuristic only. NO LLM round-trip per CONTEXT D-03.
 * LOCAL-only per Canon Part 8 -- zero remote-methodology /
 * vector-db / model-context-protocol imports or references
 * (boundary tokens omitted by name; see CONTEXT Part 8 for the
 * full forbidden-substring list this file must not match).
 *
 * Public API:
 *   classify({ userMessage, room, operator, decisionsRecency, currentJtbd })
 *     -> { jtbd: string|null, confidence: number, evidence: string[] }
 *
 * Algorithm (per RESEARCH §3):
 *   Three input strata, weighted 0.5 / 0.3 / 0.2:
 *     Stratum 1 (tokens):   lowercase userMessage substring-matched
 *                           against each JTBD's cue list. Normalized
 *                           min(matches, 3) / 3, multiplied by 0.5.
 *     Stratum 2 (operator): if active operator in JTBD's
 *                           operator_affinity[], add 0.3 (flat).
 *     Stratum 3 (recency):  count of last-3-decisions whose
 *                           methodology_hook matches one of the JTBD's
 *                           methodology_hooks[]. Normalized
 *                           min(matches, 3) / 3, multiplied by 0.2.
 *
 *   Hysteresis:  +0.1 to currentJtbd if set (sticky bias).
 *   Threshold:   0.6 default; 0.8 if operator === 'JUST_TALK'.
 *
 *   Below threshold -> { jtbd: null, confidence: top.score,
 *                        evidence: ['below_threshold',
 *                                   `top:${top.id}@${top.score}`] }
 *   Above threshold -> { jtbd: top.id, confidence: top.score,
 *                        evidence: [`tokens:${tokens}`,
 *                                   `operator:${operator||'none'}`,
 *                                   `recency:${recency}`] }
 *   No room        -> { jtbd: null, confidence: 0,
 *                        evidence: ['no_room'] }
 *   Classifier err -> { jtbd: null, confidence: 0,
 *                        evidence: ['classifier-error', errMsg.slice(0,80)] }
 *
 * Performance:
 *   - Cue regexes compiled once on module load (cache map).
 *   - Taxonomy lazy-loaded via require (Node caches automatically).
 *   - Target: < 5ms warm on a 100-char message + 13-JTBD scoring.
 *
 * License: BSL 1.1.
 */

'use strict';

// ---------- Taxonomy + cue cache ----------

const TAXONOMY = require('./jtbd-taxonomy.json');

// Compile cue substrings (lowercased, unique) once per module load.
// We use plain substring includes() rather than RegExp; substring is
// faster, deterministic, and identical in semantics for cue cards.
const CUE_CACHE = new Map(); // jtbdId -> Array<lowerCase string>
const HOOKS_CACHE = new Map(); // jtbdId -> Set<methodology hook string>
const AFFINITY_CACHE = new Map(); // jtbdId -> Set<operator>

(function buildCaches() {
  if (!TAXONOMY || !Array.isArray(TAXONOMY.jtbds)) return;
  for (const jtbd of TAXONOMY.jtbds) {
    if (!jtbd || typeof jtbd.id !== 'string') continue;
    const cues = Array.isArray(jtbd.cues) ? jtbd.cues : [];
    CUE_CACHE.set(jtbd.id, cues.map(c => String(c).toLowerCase()));
    const hooks = Array.isArray(jtbd.methodology_hooks) ? jtbd.methodology_hooks : [];
    HOOKS_CACHE.set(jtbd.id, new Set(hooks));
    const aff = Array.isArray(jtbd.operator_affinity) ? jtbd.operator_affinity : [];
    AFFINITY_CACHE.set(jtbd.id, new Set(aff));
  }
})();

// ---------- Helpers ----------

function normalizeMatchCount(n) {
  // min(n, 3) / 3 -- saturating normalization
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 3) / 3;
}

function countCueMatches(lowerMsg, cues) {
  if (!cues || cues.length === 0) return 0;
  let n = 0;
  for (const cue of cues) {
    if (lowerMsg.includes(cue)) n += 1;
  }
  return n;
}

function countRecencyMatches(decisions, hooksSet) {
  if (!Array.isArray(decisions) || decisions.length === 0) return 0;
  if (!hooksSet || hooksSet.size === 0) return 0;
  let n = 0;
  for (const d of decisions) {
    if (!d) continue;
    if (typeof d.methodology_hook === 'string' && hooksSet.has(d.methodology_hook)) {
      n += 1;
    }
  }
  return n;
}

// ---------- classify ----------

function classify(input) {
  // Defensive null/undefined guard
  if (!input || typeof input !== 'object') {
    return { jtbd: null, confidence: 0, evidence: ['classifier-error', 'no_input'] };
  }

  try {
    const { userMessage, room, operator, decisionsRecency, currentJtbd } = input;

    // No-room edge
    if (!room) {
      return { jtbd: null, confidence: 0, evidence: ['no_room'] };
    }

    // Lowercased message; tolerate undefined / non-string
    const msg = (typeof userMessage === 'string') ? userMessage.toLowerCase() : '';

    // Score each JTBD
    const scores = {};
    const tokenCounts = {};
    const recencyCounts = {};

    if (!Array.isArray(TAXONOMY.jtbds)) {
      return { jtbd: null, confidence: 0, evidence: ['classifier-error', 'taxonomy_missing'] };
    }

    for (const jtbd of TAXONOMY.jtbds) {
      const id = jtbd.id;
      const cues = CUE_CACHE.get(id) || [];
      const hooks = HOOKS_CACHE.get(id) || new Set();
      const aff = AFFINITY_CACHE.get(id) || new Set();

      // Stratum 1 (tokens, weight 0.5)
      const tCount = countCueMatches(msg, cues);
      tokenCounts[id] = tCount;
      let s = 0.5 * normalizeMatchCount(tCount);

      // Stratum 2 (operator, flat 0.3)
      if (operator && aff.has(operator)) {
        s += 0.3;
      }

      // Stratum 3 (recency, weight 0.2)
      const rCount = countRecencyMatches(decisionsRecency, hooks);
      recencyCounts[id] = rCount;
      s += 0.2 * normalizeMatchCount(rCount);

      scores[id] = s;
    }

    // Hysteresis -- sticky +0.1 toward currentJtbd if set
    if (currentJtbd && Object.prototype.hasOwnProperty.call(scores, currentJtbd)) {
      scores[currentJtbd] += 0.1;
    }

    // Pick top
    let topId = null;
    let topScore = -Infinity;
    for (const id of Object.keys(scores)) {
      if (scores[id] > topScore) {
        topScore = scores[id];
        topId = id;
      }
    }

    // Threshold (raise to 0.8 in JUST_TALK)
    const threshold = (operator === 'JUST_TALK') ? 0.8 : 0.6;

    if (topId === null || topScore < threshold) {
      const topRound = Number.isFinite(topScore) ? topScore.toFixed(2) : '0.00';
      return {
        jtbd: null,
        confidence: Number.isFinite(topScore) ? topScore : 0,
        evidence: ['below_threshold', `top:${topId || 'none'}@${topRound}`],
      };
    }

    return {
      jtbd: topId,
      confidence: topScore,
      evidence: [
        `tokens:${tokenCounts[topId] || 0}`,
        `operator:${operator || 'none'}`,
        `recency:${recencyCounts[topId] || 0}`,
      ],
    };
  } catch (err) {
    const m = (err && err.message) ? String(err.message).slice(0, 80) : 'unknown';
    return { jtbd: null, confidence: 0, evidence: ['classifier-error', m] };
  }
}

module.exports = { classify };
