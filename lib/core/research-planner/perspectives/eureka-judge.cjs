'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * SEED-103 (2026-10-01): the Eureka perspective, stage 03 (judge). Design:
 * .planning/REVIEWS/2026-10-01-eureka-v2-design.md (ADR-E15).
 *
 * Two layers, in order:
 *   Stage A  local gates that cost nothing: the fabricated-quantity and dollar
 *            regexes eureka-critic.cjs already owns (a candidate that names an
 *            invented number is out) and an entity floor (a pair with no shared
 *            or named entity is not specific enough to judge).
 *   Judge    an injected judgeFn(candidate) -> { choice, confidence } or null.
 *            'none' is a valid judge: the stage then writes Stage A results
 *            only and the run stays fully local. The Jev judge lives in
 *            scripts/eureka-jev-judge.cjs (dev-time by Phase 355 D-44; nothing
 *            under lib/ references the Jev client). The MCP surface runs
 *            judge 'none' and returns candidates for the host to judge.
 *
 * The band (high | medium | low | unknown) comes from confidenceFromBucket over
 * a MEASURED bucket, never from a model's self-reported confidence (D-46).
 * The one measured bucket today is the Phase 355 usefulness judge: 73 of 96
 * agreements with the navigator's blind gold (355-26-SUMMARY.md, 76.04%),
 * which reads 'medium'. Under the D-46 seam rule 'medium' means every verdict
 * is human-routed; nothing auto-passes and nothing auto-drops.
 *
 * Writes one edit surface: <run>/03_judge/output/verdicts.jsonl. Hyphens only.
 */

const path = require('node:path');
const critic = require('../../eureka-critic.cjs');
const recall = require('./eureka-recall.cjs');

// Source: .planning/phases/355-*/355-26-SUMMARY.md, usefulness judge vs the
// navigator's blind sitting-1 gold: 76.04% exact agreement on 96 pairings.
const JEV_USEFULNESS_BUCKET = Object.freeze({ correct: 73, n: 96, source: '355-26-SUMMARY.md (2026-09-24)' });

const CHOICES = Object.freeze(['useful', 'not_useful', 'already_known', 'none']);

function envInt(name, dflt) {
  const v = parseInt(process.env[name], 10);
  return Number.isFinite(v) ? v : dflt;
}

/** Stage A on one candidate. Returns { pass, tag }. */
function stageAGate(candidate) {
  const c = candidate || {};
  const text = [c.title_a, c.title_b, c.direction_phrase].filter(Boolean).join(' ');
  if (critic._gate1.FABRICATED_QUANTITY.test(text) || critic._gate1.DOLLAR_FIGURE.test(text)) {
    return { pass: false, tag: 'unsourced_quantity' };
  }
  const entityMin = envInt('EUREKA_ENTITY_MIN', 2);
  const entityCount = (Array.isArray(c.shared_entities) ? c.shared_entities.length : 0) + (Array.isArray(c.lanes) && c.lanes.indexOf('icm_declared') !== -1 ? 1 : 0) + (Array.isArray(c.lanes) && c.lanes.indexOf('lexical') !== -1 ? 1 : 0);
  if (entityCount < Math.min(entityMin, 1)) return { pass: false, tag: 'entity_nonspecific' };
  return { pass: true, tag: null };
}

function bandFor(judgeName, opts) {
  const o = opts || {};
  if (o.bucket) return critic.confidenceFromBucket(o.bucket);
  if (judgeName === 'jev') return critic.confidenceFromBucket(JEV_USEFULNESS_BUCKET);
  return 'unknown';
}

/**
 * judgeCandidates(candidates, opts) -> { rows, summary }
 *   opts.judge    'none' (default) | a judge name for the record
 *   opts.judgeFn  async (candidate) -> { choice, confidence? } | null
 *   opts.bucket   { correct, n } measured bucket for the band (else by judge name)
 *   opts.now      ISO timestamp override
 */
async function judgeCandidates(candidates, opts) {
  const o = opts || {};
  const judgeName = o.judgeFn ? (o.judge || 'custom') : 'none';
  const band = o.judgeFn ? bandFor(judgeName, o) : 'unknown';
  const humanRouted = band !== 'high';
  const now = o.now || new Date().toISOString();
  const rows = [];
  const summary = { judge: judgeName, band: band, human_routed: humanRouted, judged: 0, stage_a_failed: 0, choices: { useful: 0, not_useful: 0, already_known: 0, none: 0 } };
  for (const c of (candidates || [])) {
    const a = stageAGate(c);
    const row = { a: c.a, b: c.b, section_a: c.section_a, section_b: c.section_b, lanes: c.lanes || [], stage_a: a, judge: judgeName, choice: null, confidence: null, band: band, human_routed: humanRouted, judged_at: now };
    if (!a.pass) { summary.stage_a_failed += 1; rows.push(row); continue; }
    if (o.judgeFn) {
      let v = null;
      try { v = await o.judgeFn(c); } catch (_e) { v = null; }
      if (v && CHOICES.indexOf(v.choice) !== -1) {
        row.choice = v.choice;
        row.confidence = (typeof v.confidence === 'number') ? v.confidence : null;
        summary.judged += 1;
        summary.choices[v.choice] += 1;
      }
    }
    rows.push(row);
  }
  return { rows: rows, summary: summary };
}

function writeVerdicts(roomDir, tag, rows) {
  const dir = recall.runDirFor(roomDir, tag);
  const file = path.join(dir, '03_judge', 'output', 'verdicts.jsonl');
  recall.writeJsonl(file, rows);
  recall.deriveStatus(dir);
  return file;
}

function readVerdicts(roomDir, tag) {
  return recall.readJsonl(path.join(recall.runDirFor(roomDir, tag), '03_judge', 'output', 'verdicts.jsonl'));
}

/** runJudge(roomDir, tag, opts): read candidates.jsonl, judge, write verdicts.jsonl. */
async function runJudge(roomDir, tag, opts) {
  const read = recall.readCandidates(roomDir, tag);
  if (!read) return { ok: false, reason: 'candidates_missing' };
  const res = await judgeCandidates(read.candidates, opts);
  const file = writeVerdicts(roomDir, tag, res.rows);
  return { ok: true, tag: tag, file: file, summary: res.summary, rows: res.rows };
}

module.exports = {
  JEV_USEFULNESS_BUCKET: JEV_USEFULNESS_BUCKET,
  CHOICES: CHOICES,
  stageAGate: stageAGate,
  bandFor: bandFor,
  judgeCandidates: judgeCandidates,
  writeVerdicts: writeVerdicts,
  readVerdicts: readVerdicts,
  runJudge: runJudge,
};
