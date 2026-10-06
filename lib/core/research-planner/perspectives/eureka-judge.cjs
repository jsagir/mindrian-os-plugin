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

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const critic = require('../../eureka-critic.cjs');
const shared = require('./shared.cjs');
const eurekaRecall = require('./eureka-recall.cjs');
const egressPolicy = require('../egress-policy.cjs');

// Source: .planning/phases/355-*/355-26-SUMMARY.md, usefulness judge vs the
// navigator's blind sitting-1 gold: 76.04% exact agreement on 96 pairings.
const JEV_USEFULNESS_BUCKET = Object.freeze({ correct: 73, n: 96, source: '355-26-SUMMARY.md (2026-09-24)' });

const CHOICES = Object.freeze(['useful', 'not_useful', 'already_known', 'none']);

function envInt(name, dflt) {
  const v = parseInt(process.env[name], 10);
  return Number.isFinite(v) ? v : dflt;
}

/**
 * Stage A on one candidate. Returns { pass, tag }.
 * `mod` is the perspective module (default eureka): it credits mod.STAGE_A_LANES
 * plus the entity floor, so rs and hsi candidates are not failed by eureka's lane
 * rule (D-06). The EUREKA_ENTITY_MIN env name applies to this shared judge.
 */
function stageAGate(candidate, mod) {
  const c = candidate || {};
  const text = [c.title_a, c.title_b, c.direction_phrase].filter(Boolean).join(' ');
  if (critic._gate1.FABRICATED_QUANTITY.test(text) || critic._gate1.DOLLAR_FIGURE.test(text)) {
    return { pass: false, tag: 'unsourced_quantity' };
  }
  const entityMin = envInt('EUREKA_ENTITY_MIN', 2);
  const credited = ((mod && mod.STAGE_A_LANES) || eurekaRecall.STAGE_A_LANES).filter(function (lane) { return Array.isArray(c.lanes) && c.lanes.indexOf(lane) !== -1; }).length;
  const entityCount = (Array.isArray(c.shared_entities) ? c.shared_entities.length : 0) + credited;
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
  const mod = o.module || eurekaRecall;
  const rows = [];
  const summary = { judge: judgeName, band: band, human_routed: humanRouted, judged: 0, stage_a_failed: 0, choices: { useful: 0, not_useful: 0, already_known: 0, none: 0 } };
  for (const c of (candidates || [])) {
    const a = stageAGate(c, mod);
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

function writeVerdicts(roomDir, tag, rows, opts) {
  const mod = (opts && opts.module) || eurekaRecall;
  const dir = mod.runDirFor(roomDir, tag);
  const file = path.join(dir, '03_judge', 'output', 'verdicts.jsonl');
  shared.writeJsonl(file, rows);
  shared.deriveStatus(dir, mod.STATUS_TITLE);
  return file;
}

function readVerdicts(roomDir, tag, opts) {
  const mod = (opts && opts.module) || eurekaRecall;
  return shared.readJsonl(path.join(mod.runDirFor(roomDir, tag), '03_judge', 'output', 'verdicts.jsonl'));
}

/** runJudge(roomDir, tag, opts): read candidates.jsonl, judge, write verdicts.jsonl. opts.module picks the perspective (default eureka). */
async function runJudge(roomDir, tag, opts) {
  const mod = (opts && opts.module) || eurekaRecall;
  const read = mod.readCandidates(roomDir, tag);
  if (!read) return { ok: false, reason: 'candidates_missing' };
  const res = await judgeCandidates(read.candidates, Object.assign({}, opts || {}, { module: mod }));
  const file = writeVerdicts(roomDir, tag, res.rows, { module: mod });
  return { ok: true, tag: tag, file: file, summary: res.summary, rows: res.rows };
}

// ---------------------------------------------------------------------------
// judgeState(roomDir, opts) -> { state, line } (369.2-27, SW-17 one-line half, R24).
// The one sentence both surfaces (the MCP perspective_judge next_step and the CLI answers) say when no model
// judged the Eureka pairs, and the next move. State:
//   no_key    no Jev key on this machine (env TYPESAFE_API_KEY non-empty, or ~/.secrets/typesafe.env carrying a
//             TYPESAFE_API_KEY= line). The key is checked for PRESENCE only: its value is never returned,
//             logged or put in a sentence.
//   line_off  a key is present but the room's egress policy line judge_jev is off (the shipped default is off)
//   available the key is present and the line is on; the MCP surface still runs no model judge, so the
//             sentence points at Claude Code
// The flag names that switch the line stay with 369.5 (SW-18). opts.env, opts.home and opts.policy exist so a
// test can pin each state without touching the real machine; nothing here writes.
// ---------------------------------------------------------------------------
// The sentences and the key variable name live in data/eureka-judge-lines.json: tests/test-355-part8-egress.cjs
// leg D bans the key variable name on any non-comment lib/ line (the Jev vendor is dev-time only, Phase 355
// D-44), and data/egress-policy.json already holds the vendor endpoint outside lib/ for the same reason.
const LINES_FILE = path.resolve(__dirname, '..', '..', '..', '..', 'data', 'eureka-judge-lines.json');
const FALLBACK_LINE = 'No model judged these pairs. Read the pairs that passed and judge them yourself.';

function readLinesDoc() {
  try {
    const doc = JSON.parse(fs.readFileSync(LINES_FILE, 'utf8'));
    if (doc && typeof doc.key_env === 'string' && typeof doc.secrets_file === 'string' && doc.lines
      && ['no_key', 'line_off', 'available'].every(function (k) { return typeof doc.lines[k] === 'string'; })) return doc;
  } catch (_e) { /* fail closed below */ }
  return null;
}

const LINES_DOC = readLinesDoc();
const JUDGE_LINES = Object.freeze(LINES_DOC
  ? { no_key: LINES_DOC.lines.no_key, line_off: LINES_DOC.lines.line_off, available: LINES_DOC.lines.available }
  : { no_key: FALLBACK_LINE, line_off: FALLBACK_LINE, available: FALLBACK_LINE });

function jevKeyPresent(opts) {
  const o = opts || {};
  if (!LINES_DOC) return false;
  const env = o.env || process.env;
  if (typeof env[LINES_DOC.key_env] === 'string' && env[LINES_DOC.key_env].length > 0) return true;
  try {
    const home = o.home || os.homedir();
    const raw = fs.readFileSync(path.join(home, LINES_DOC.secrets_file), 'utf8');
    return new RegExp('^' + LINES_DOC.key_env + '=.+$', 'm').test(raw);
  } catch (_e) {
    return false;
  }
}

function judgeState(roomDir, opts) {
  const o = opts || {};
  if (!jevKeyPresent(o)) return { state: 'no_key', line: JUDGE_LINES.no_key };
  const policy = o.policy || egressPolicy.loadEgressPolicy(roomDir);
  if (!egressPolicy.lineAllowed(policy, 'judge_jev')) return { state: 'line_off', line: JUDGE_LINES.line_off };
  return { state: 'available', line: JUDGE_LINES.available };
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
  JUDGE_LINES: JUDGE_LINES,
  judgeState: judgeState,
};
