#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * SEED-103 (2026-10-01): the Jev first-pass judge for an Eureka perspective run.
 * Dev-time only, from scripts/, per Phase 355 D-44: nothing under lib/ or
 * hooks/ references the Jev client, the vendor host, or TYPESAFE_API_KEY. The
 * navigator's runtime-Jev ruling (SEED-103 decision 2) decides whether this
 * ever moves under lib/; until then Claude Code runs it by hand.
 *
 * Reuses the Phase 355 usefulness_judge profile byte for byte
 * (scripts/jev-question-ceilings.cjs USEFULNESS_QUESTIONS, makeUsefulnessCeiling)
 * and the shared dev-time client (scripts/jev-devtime-client.cjs jev, pool,
 * loadKey, makeEgressGuard). The band is the MEASURED one from
 * eureka-judge.cjs JEV_USEFULNESS_BUCKET (76.04%, 'medium'), so every verdict
 * is human-routed.
 *
 * Usage:
 *   node scripts/eureka-jev-judge.cjs --room <roomDir> --tag <runTag> [--max N] [--check]
 *                                     [--seed S] [--repeats N]
 * --check replays recorded responses from <run>/03_judge/jev-responses.json with
 * zero network and zero key.
 * --seed / --repeats (2026): position-bias control and repeat-run agreement. With --seed
 * each pair is shown with its A and B excerpts swapped on a seeded, per-pair schedule;
 * with --repeats N each pair is judged N times (alternating orientation) and rows that
 * disagree are flagged unstable and human-routed. The judge is triage only; nothing here
 * ranks or drops a pair. Provenance (model, seed, repeats, time, usage) is written next
 * to the verdicts as <run>/03_judge/jev-provenance.json.
 *
 * Reads  <run>/02_recall/output/candidates.jsonl
 * Writes <run>/03_judge/output/verdicts.jsonl and <run>/03_judge/jev-responses.json
 * Part 8: the state sent is a_excerpt, b_excerpt (room text, capped at the
 * profile's 2400 chars), direction_phrase, verification 'unverified'. The
 * profile guard refuses any other key. Hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const REPO_ROOT = path.resolve(__dirname, '..');
const client = require('./jev-devtime-client.cjs');
const Q = require('./jev-question-ceilings.cjs');
const { parseJevResponse } = require('./jev-response-schema.cjs');
const recall = require(path.join(REPO_ROOT, 'lib/core/research-planner/perspectives/eureka-recall.cjs'));
const judge = require(path.join(REPO_ROOT, 'lib/core/research-planner/perspectives/eureka-judge.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib/core/navigation.cjs'));

const DIRECTION_PHRASE = 'same mechanism, different domain';
const EXCERPT_CAP = 2400;

// 2026: a bounded integer flag. `--max` with no value (true), a negative or a non-number used to
// become NaN / a negative slice end and silently judged the wrong number of pairs.
function intFlag(v, dflt, lo, hi) {
  const n = (typeof v === 'string') ? parseInt(v, 10) : NaN;
  if (!Number.isFinite(n)) return dflt;
  return Math.max(lo, Math.min(hi, n));
}

function redact(msg) {
  return String(msg)
    .replace(/sk-[A-Za-z0-9_-]+/g, '[key]')
    .replace(/Bearer\s+[A-Za-z0-9._~+\/=-]+/gi, 'Bearer [key]')
    .replace(/(api[_-]?key|token|authorization)(["'\s:=]+)[A-Za-z0-9._~+\/=-]{8,}/gi, '$1$2[key]');
}

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.indexOf('--') === 0) {
      const next = argv[i + 1];
      if (next !== undefined && next.indexOf('--') !== 0) { flags[a] = next; i += 1; } else flags[a] = true;
    }
  }
  return flags;
}

function excerptsFor(roomDir, ids) {
  const db = navigation.openRoomDbReadOnlyForCaller(roomDir);
  if (!db) throw new Error('room.db could not be opened read-only for ' + roomDir);
  const out = {};
  try {
    const stmt = db.prepare('SELECT id, properties FROM nodes WHERE id = ?');
    ids.forEach(function (id) {
      const row = stmt.get(id);
      let p = {};
      try { p = JSON.parse(row && row.properties ? row.properties : '{}'); } catch (_e) { p = {}; }
      const parts = [];
      ['title', 'name', 'text', 'summary', 'body', 'content', 'excerpt'].forEach(function (k) { if (typeof p[k] === 'string' && p[k].trim()) parts.push(p[k].trim()); });
      out[id] = parts.join('\n').slice(0, EXCERPT_CAP);
    });
  } finally { try { db.close(); } catch (_e) { /* read-only */ } }
  return out;
}

// Stable stringify (keys sorted at every depth). Phase 366 plan 18 fix: the previous key was
// JSON.stringify(body, Object.keys(body).sort()), and an array replacer whitelists keys at EVERY
// depth, so state and questions collapsed to {} and every pair shared one replay key.
function stableStringify(v) {
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + stableStringify(v[k]); }).join(',') + '}';
  return JSON.stringify(v);
}

function canonicalKey(body) {
  return crypto.createHash('sha256').update(stableStringify(body), 'utf8').digest('hex');
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const room = flags['--room'] ? path.resolve(flags['--room']) : null;
  const tag = flags['--tag'];
  if (!room || !tag) { process.stdout.write(JSON.stringify({ ok: false, reason: 'room_and_tag_required' }) + '\n'); process.exit(2); }
  const read = recall.readCandidates(room, tag);
  if (!read) { process.stdout.write(JSON.stringify({ ok: false, reason: 'candidates_missing' }) + '\n'); process.exit(2); }
  const max = intFlag(flags['--max'], 25, 1, 1000);
  const repeats = intFlag(flags['--repeats'], 1, 1, 9);
  const seed = (typeof flags['--seed'] === 'string' && flags['--seed']) ? flags['--seed'] : null;
  const candidates = read.candidates.slice(0, max);
  const runDir = recall.runDirFor(room, tag);
  const responsesPath = path.join(runDir, '03_judge', 'jev-responses.json');
  const check = flags['--check'] === true;

  let recorded = {};
  if (check) {
    try { recorded = JSON.parse(fs.readFileSync(responsesPath, 'utf8')); } catch (_e) { process.stdout.write(JSON.stringify({ ok: false, reason: 'no_recorded_responses' }) + '\n'); process.exit(2); }
  }
  const key = check ? null : client.loadKey();
  if (!check && !key) { process.stdout.write(JSON.stringify({ ok: false, reason: 'no_key' }) + '\n'); process.exit(3); }

  const ids = Array.from(new Set(candidates.reduce(function (acc, c) { return acc.concat([c.a, c.b]); }, [])));
  const excerpts = excerptsFor(room, ids);
  const pairMap = new Map(candidates.map(function (c) { return [c.a + '|' + c.b, { a_excerpt: excerpts[c.a] || c.title_a, b_excerpt: excerpts[c.b] || c.title_b, direction_phrase: DIRECTION_PHRASE }]; }));
  // 2026: the swapped orientation is registered under b|a so the usefulness ceiling guard sees the
  // same excerpts it is shown in the other order. UNVERIFIED against the real guard: see CHANGES-rest.md.
  if (seed !== null || repeats > 1) {
    candidates.forEach(function (c) {
      const k = c.b + '|' + c.a;
      if (!pairMap.has(k)) {
        const f = pairMap.get(c.a + '|' + c.b);
        pairMap.set(k, { a_excerpt: f.b_excerpt, b_excerpt: f.a_excerpt, direction_phrase: DIRECTION_PHRASE });
      }
    });
  }
  const guard = Q.composeGuard(client.makeEgressGuard(client.EGRESS_PROFILES.usefulness_judge, { root: REPO_ROOT }), Q.makeUsefulnessCeiling(pairMap));

  const usage = { calls: 0, input_tokens: 0 };
  const newResponses = Object.assign({}, recorded);
  const judgeFn = async function (c, meta) {
    const swap = !!(meta && meta.swap);
    const item = pairMap.get(swap ? (c.b + '|' + c.a) : (c.a + '|' + c.b));
    const body = { model: Q.PINNED_MODEL, state: Object.assign({}, item, { verification: 'unverified' }), questions: Q.USEFULNESS_QUESTIONS };
    const k = canonicalKey(body);
    let res;
    if (check) {
      res = recorded[k];
      if (!res) return null;
    } else {
      usage.calls += 1;
      res = await client.jev(body, { guard: guard, key: key, timeoutMs: 15000, honorRetryAfter: true });
      if (res && res.json && res.json.usage && typeof res.json.usage.input_tokens === 'number') usage.input_tokens += res.json.usage.input_tokens;
      newResponses[k] = { status: res.status, json: res.json };
    }
    // expected is { questionId: [option, ...] } (jev-response-schema); the old { questionIds: [...] } made every answer unparsable
    const parsed = parseJevResponse(res, { usefulness: Object.keys(Q.USEFULNESS_QUESTIONS.usefulness.criteria) });
    if (!parsed.ok) return null;
    const ans = parsed.answers && parsed.answers.usefulness;
    if (!ans) return null;
    return { choice: ans.choice, confidence: (typeof ans.confidence === 'number') ? ans.confidence : null };
  };

  const startedAt = new Date().toISOString();
  const res = await judge.judgeCandidates(candidates, { judge: 'jev', judgeFn: judgeFn, bucket: judge.JEV_USEFULNESS_BUCKET, seed: seed === null ? undefined : seed, repeats: repeats });
  const file = judge.writeVerdicts(room, tag, res.rows);
  if (!check) {
    fs.mkdirSync(path.dirname(responsesPath), { recursive: true });
    fs.writeFileSync(responsesPath + '.tmp', JSON.stringify(newResponses, null, 2));
    fs.renameSync(responsesPath + '.tmp', responsesPath);
  }
  // 2026 provenance: what was computed, with which parameters, and when. A separate file so
  // jev-responses.json (a hash -> response replay map) keeps its exact shape.
  const provenancePath = path.join(runDir, '03_judge', 'jev-provenance.json');
  const provenance = {
    schema_version: 1,
    computed_at: startedAt,
    mode: check ? 'replay' : 'live',
    model: Q.PINNED_MODEL,
    profile: 'usefulness_judge',
    seed: seed,
    repeats: repeats,
    max: max,
    pairs: candidates.length,
    node: process.version,
    usage: check ? { replay: true } : usage,
    band: res.summary.band,
    judge_role: 'triage_only; nothing ranks or drops a pair from the judge answer',
  };
  fs.mkdirSync(path.dirname(provenancePath), { recursive: true });
  fs.writeFileSync(provenancePath + '.tmp', JSON.stringify(provenance, null, 2) + '\n');
  fs.renameSync(provenancePath + '.tmp', provenancePath);
  process.stdout.write(JSON.stringify({ ok: true, tag: tag, file: file, summary: res.summary, usage: check ? { replay: true } : usage, provenance: provenancePath }) + '\n');
}

// 2026: only run as a CLI. The original called main() at import time, so merely requiring this
// file (for a test, or a tool that wants canonicalKey) started a judge run.
if (require.main === module) {
  main().catch(function (err) {
    const msg = redact(err && err.message ? err.message : err);
    process.stdout.write(JSON.stringify({ ok: false, reason: 'error', detail: msg.slice(0, 200) }) + '\n');
    process.exit(1);
  });
}

module.exports = { main: main, parseArgs: parseArgs, intFlag: intFlag, redact: redact, stableStringify: stableStringify, canonicalKey: canonicalKey, excerptsFor: excerptsFor };
