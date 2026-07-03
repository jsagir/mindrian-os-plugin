/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 202-02 -- the APO loop (SEED-002 Path A: recommend-then-ratify).
 *
 * propose -> score -> select over ONE target prompt (commands/act.md, D-202-3).
 * `propose` is an injected agent callback; `score` blends the calibrated reward
 * signal; `select` returns the best variant as a RECOMMENDATION. The loop NEVER
 * writes commands/act.md -- a human ratifies a candidate into the plugin.
 *
 * Reward blend (D-202-2, QUALITY-PRIMARY):
 *   score = qualityTerm + (activated ? TELEMETRY_WEIGHT * telemetryTerm : 0)
 *
 *   - qualityTerm   = ctx.qualityScoreFn(candidate). The grading-corpus quality
 *                     of a candidate's output. PRIMARY. Injected + stubbed
 *                     offline (the grading corpus is Brain-only; this module
 *                     never calls Brain -- the caller supplies the score fn).
 *   - telemetryTerm = the candidate's reach reward from buildRewardTable
 *                     (202-01), in [0,1]. SECONDARY, and added ONLY when
 *                     ctx.telemetry.activated === true (>=100 real events).
 *
 *   TELEMETRY_WEIGHT (0.15, the canon frozen signal weight) CAPS the telemetry
 *   term's influence. A quality lead larger than 0.15 can never be overturned by
 *   telemetry, so a candidate that scores higher on telemetry but lower on
 *   quality does NOT auto-win. Selection is additionally quality-lexicographic
 *   (quality primary key, blended score tiebreak) for a structural guarantee.
 *
 * Canon Part 8: LAB-side only. Offline-capable (stubbed qualityScoreFn, no live
 * scorer required). Zero network, zero Brain, zero MCP, zero egress. Span data
 * (proposed variants, scores, traces) is written UNDER lab/apo/runs/ (gitignored
 * via lab/apo/.gitignore) and is never committed, never shipped (Part 8).
 *
 * Node built-ins only, CJS, no runtime deps. No em-dashes in code/comments.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Consume the 202-01 reward table (do not reimplement). This IS the key link:
// the telemetry reward table is a scoring term, added when activated (D-202-2).
const { buildRewardTable } = require('./reward-table.cjs');

// Load + render the target prompt (byte-lossless frontmatter split).
const { loadTarget, renderCandidate } = require('./prompt-target.cjs');

// Canon Part 12 via Phase 210-C: the voice contract is a SIGNAL, not a gate.
// A candidate whose OUTPUT breaks the contract (framework dump, over-long,
// em-dash, missing De Stijl mark) stays selectable -- violations dent its
// blended score and are flagged VISIBLY (voiceFlagged + voiceViolations) so
// the human who ratifies the recommendation always sees them. The detector
// itself (checkVoiceContract) is unchanged; only its veto power in this loop
// was removed (offline lab tool, human-ratified: judgment stays with the human).
const { checkVoiceContract } = require('./voice-contract-gate.cjs');

// The canon frozen signal weight (0.15). Telemetry is a SECONDARY term bounded
// by this weight; quality (weight 1.0, implicit) is PRIMARY.
const TELEMETRY_WEIGHT = 0.15;

// Phase 210-C: per-violation dent applied to the blended SCORE (never to
// quality). Coefficient choice: one third of TELEMETRY_WEIGHT, so among
// EQUAL-quality candidates a single violation is a visible nudge that a strong
// telemetry lead can still outweigh, while three-plus violations (>= 0.15)
// outweigh the maximum possible telemetry bonus. Because selectBest is
// quality-lexicographic (quality primary, score tiebreak), this dent can only
// ever decide ties between equal-quality candidates -- quality primacy stays
// structural, and the voice contract stays a signal, never a veto.
const VOICE_SIGNAL_WEIGHT = 0.05;

// Bounded optimization rounds -- the loop is finite by construction.
const MAX_ROUNDS = 8;

// Default span-output directory (gitignored via lab/apo/.gitignore).
const DEFAULT_RUNS_DIR = path.join(__dirname, 'runs');

function clamp01(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * qualityTerm(candidate, ctx) -> number
 * The PRIMARY term: the injected grading-corpus quality of the candidate.
 */
function qualityTerm(candidate, ctx) {
  if (!ctx || typeof ctx.qualityScoreFn !== 'function') {
    throw new Error('scoreCandidate: ctx.qualityScoreFn is required (offline stub allowed)');
  }
  const q = Number(ctx.qualityScoreFn(candidate));
  return Number.isFinite(q) ? q : 0;
}

/**
 * telemetryTerm(candidate, telemetry) -> number in [0,1]
 *
 * Derived from buildRewardTable(telemetry.events). If the candidate names a
 * reach (candidate.reachKey) present in the table, that reach's mean reward is
 * used; otherwise the n-weighted corpus mean is used. Returns 0 for an empty or
 * absent corpus. This is the ONLY consumer of the reward table in the blend.
 */
function telemetryTerm(candidate, telemetry) {
  const events = telemetry && Array.isArray(telemetry.events) ? telemetry.events : [];
  const table = buildRewardTable(events);

  if (candidate && candidate.reachKey != null &&
      Object.prototype.hasOwnProperty.call(table, candidate.reachKey)) {
    return clamp01(table[candidate.reachKey].rewardMean);
  }

  // Corpus-level n-weighted mean of the per-reach means.
  let sum = 0;
  let n = 0;
  for (const key of Object.keys(table)) {
    const bucket = table[key];
    if (bucket && bucket.n > 0) {
      sum += bucket.rewardMean * bucket.n;
      n += bucket.n;
    }
  }
  return n > 0 ? clamp01(sum / n) : 0;
}

/**
 * scoreCandidate(candidate, ctx) -> number
 *
 * ctx = {
 *   qualityScoreFn: (candidate) => number,   // PRIMARY, required
 *   telemetry?: { activated: boolean, events: object[] }  // SECONDARY, optional
 * }
 *
 * score = qualityTerm + (telemetry.activated ? TELEMETRY_WEIGHT * telemetryTerm : 0)
 *
 * The telemetry term is added ONLY when activated (D-202-2). It is bounded by
 * TELEMETRY_WEIGHT so it can never overturn a quality lead larger than 0.15.
 */
function scoreCandidate(candidate, ctx) {
  const q = qualityTerm(candidate, ctx);
  const tel = ctx && ctx.telemetry;
  if (tel && tel.activated === true) {
    return q + TELEMETRY_WEIGHT * telemetryTerm(candidate, tel);
  }
  return q;
}

/**
 * selectBest(candidates) -> candidate | null
 *
 * Quality-lexicographic selection: the highest qualityTerm wins; the blended
 * score breaks ties. This makes quality primacy STRUCTURAL (D-202-2) -- a higher
 * telemetry term can only decide between candidates of equal quality.
 */
function selectBest(candidates) {
  let best = null;
  for (const c of candidates) {
    if (best === null ||
        c.quality > best.quality ||
        (c.quality === best.quality && c.score > best.score)) {
      best = c;
    }
  }
  return best;
}

/**
 * runApo(target, opts) -> { best, candidates, rounds, spanPath }
 *
 * The Path A optimization loop: propose -> score -> select, bounded rounds.
 *
 * target : a commands/*.md path (string) or a loadTarget() result.
 * opts = {
 *   proposeFn: (loadedTarget, { round, best }) => candidate[],  // REQUIRED agent callback
 *   qualityScoreFn: (candidate) => number,                       // REQUIRED, offline stub ok
 *   telemetry?: { activated, events },                           // optional secondary signal
 *   rounds?: number,                                             // default 1, capped at MAX_ROUNDS
 *   runsDir?: string,                                            // default lab/apo/runs/ (gitignored)
 * }
 *
 * Each candidate: { id, body?, reachKey? }. `best` is a RECOMMENDATION object
 * (the winning candidate plus its rendered full-file form), NOT a written file.
 * Span data is written under runsDir (gitignored, Part 8). This function NEVER
 * writes the target prompt (commands/act.md) -- Path A recommend-then-ratify.
 */
function runApo(target, opts) {
  const options = opts || {};
  const loaded = typeof target === 'string' ? loadTarget(target) : target;

  if (typeof options.proposeFn !== 'function') {
    throw new Error('runApo: opts.proposeFn (the injected variant generator) is required');
  }
  if (typeof options.qualityScoreFn !== 'function') {
    throw new Error('runApo: opts.qualityScoreFn is required (an offline stub is allowed)');
  }

  const requested = Number.isInteger(options.rounds) && options.rounds > 0 ? options.rounds : 1;
  const rounds = Math.min(requested, MAX_ROUNDS);
  const runsDir = options.runsDir || DEFAULT_RUNS_DIR;
  const ctx = {
    qualityScoreFn: options.qualityScoreFn,
    telemetry: options.telemetry || null,
    // Forwarded to checkVoiceContract; carries an optional llmJudge for the
    // subjective reframe-plus-question beat (omitted offline -> skipped).
    voiceOpts: options.voiceOpts || {},
  };

  const candidates = [];
  const roundRecords = [];
  let runningBest = null;

  for (let r = 0; r < rounds; r++) {
    const proposed = options.proposeFn(loaded, { round: r, best: runningBest }) || [];
    const scored = [];
    for (const c of proposed) {
      const bodyVariant = c && c.body != null ? c.body : loaded.body;
      const rendered = renderCandidate(loaded, bodyVariant); // string only; never written to disk here
      const quality = qualityTerm(c, ctx);
      // Canon Part 12 voice-contract SIGNAL (Phase 210-C). Only candidates
      // that DECLARE an output string are checked; a candidate with no output
      // carries zero violations (backward compatible with the 202-02 loop).
      // Violations dent the blended SCORE (never quality) and flag the record;
      // they never remove a candidate from selection.
      const output = c && c.output != null ? String(c.output) : null;
      const voice = output != null
        ? checkVoiceContract(output, ctx.voiceOpts || {})
        : { pass: true, violations: [] };
      const voiceFlagged = voice.pass !== true;
      const score = scoreCandidate(c, ctx)
        - VOICE_SIGNAL_WEIGHT * voice.violations.length;
      const entry = {
        id: c && c.id != null ? c.id : 'cand-' + r + '-' + scored.length,
        reachKey: c && c.reachKey != null ? c.reachKey : null,
        body: bodyVariant,
        rendered,
        quality,
        score,
        output,
        voiceViolations: voice.violations,
        voiceFlagged,
        round: r,
      };
      scored.push(entry);
      candidates.push(entry);
    }
    roundRecords.push({ round: r, candidateIds: scored.map((s) => s.id) });
    // Selection sees EVERY candidate (Phase 210-C: signal, not gate).
    runningBest = selectBest(candidates);
  }

  const best = selectBest(candidates);

  // Write span data to the gitignored runs dir (Part 8: never committed).
  fs.mkdirSync(runsDir, { recursive: true });
  const stamp = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  const spanPath = path.join(runsDir, 'apo-' + stamp + '.json');
  const span = {
    target: loaded.path || (typeof target === 'string' ? target : null),
    rounds,
    roundRecords,
    candidates: candidates.map((c) => ({
      id: c.id,
      reachKey: c.reachKey,
      quality: c.quality,
      score: c.score,
      round: c.round,
      voiceFlagged: c.voiceFlagged,
      voiceViolations: c.voiceViolations,
    })),
    best: best ? { id: best.id, quality: best.quality, score: best.score } : null,
    recommendedAt: new Date().toISOString(),
    note: 'RECOMMENDATION ONLY (SEED-002 Path A). commands/act.md was NOT modified; a human ratifies a candidate.',
  };
  fs.writeFileSync(spanPath, JSON.stringify(span, null, 2) + '\n');

  return { best, candidates, rounds, spanPath };
}

module.exports = {
  scoreCandidate,
  qualityTerm,
  telemetryTerm,
  selectBest,
  runApo,
  TELEMETRY_WEIGHT,
  VOICE_SIGNAL_WEIGHT,
  MAX_ROUNDS,
  DEFAULT_RUNS_DIR,
};
