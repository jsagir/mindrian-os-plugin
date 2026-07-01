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

// The canon frozen signal weight (0.15). Telemetry is a SECONDARY term bounded
// by this weight; quality (weight 1.0, implicit) is PRIMARY.
const TELEMETRY_WEIGHT = 0.15;

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

module.exports = {
  scoreCandidate,
  qualityTerm,
  telemetryTerm,
  TELEMETRY_WEIGHT,
  MAX_ROUNDS,
  DEFAULT_RUNS_DIR,
};
