#!/usr/bin/env node
'use strict';
/*
 * scripts/build-command-irreversibility-ledger.cjs -- Phase 356 Plan 07
 * (R356-01, R356-03, R356-07, R356-08).
 *
 * Dev-time builder: scores every registry command once with one Jev Noul
 * carrying the written irreversibility policy, and ships the result as
 * data (data/command-irreversibility-ledger.json). This file is the ONLY
 * scoring core for that ledger; it has no local fetch wrapper and no local
 * egress guard, it imports both from scripts/jev-devtime-client.cjs (R8).
 *
 * The dev-time key is read only here, from the environment or
 * ~/.secrets/typesafe.env, never printed, never logged, never written into
 * the ledger. No file under lib/ or hooks/ may require this script or
 * scripts/jev-devtime-client.cjs (the Phase 356 tripwire in
 * tests/test-353-tripwires.cjs leg 2 enforces this).
 *
 * Exit codes (this plan lands only the scoring core; a later 356 plan adds
 * a require.main CLI): 0 ok, 1 threshold or scoring failure, 2 refused
 * input, 3 no key, 4 appeal gate. Modes (--jev-fixture, --check, live) are
 * added by 356-09 and 356-10.
 *
 * This plan (356-07) lands the scoring core only: readPolicy, makeGuard,
 * buildPayload, parseNoulAnswer, makeFixtureFetch, scoreAll. Threshold
 * math, ledger assembly and the CLI land in 356-09; --check in 356-10.
 *
 * House rule: hyphens only, no em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os'); // eslint-disable-line no-unused-vars -- future live-mode key path (356-09)
const crypto = require('node:crypto'); // eslint-disable-line no-unused-vars -- future ledger/label hashes (356-09)

const client = require('./jev-devtime-client.cjs');
const { commandTextHash, TEXT_HASH_BASIS } = require('../lib/core/irreversibility-ledger.cjs');
const { readRegistryRows, sha256Hex } = require('./irreversibility-answer-key.cjs'); // eslint-disable-line no-unused-vars -- future --label-sheet wiring reuse (356-09)

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

// Single source of truth for the policy path: the material_step_ledger
// profile's own must_equal_file entry (never a second literal).
const POLICY_REL = client.EGRESS_PROFILES.material_step_ledger.must_equal_file.policy;

const DEFAULT_LABELS_PATH = path.join(DATA_DIR, 'jev-labels', 'command-irreversibility.json');
const DEFAULT_LEDGER_PATH = path.join(DATA_DIR, 'command-irreversibility-ledger.json');

const MODEL = 'jev-latest';
const QUESTION_ID = 'irreversible';
const QUESTION_TEXT = 'Under the policy in `policy`, does running the command named in `slug`, as described by `teaching` and `jtbd_summary`, take an effect the policy calls irreversible?';
const CONC = 4;
const VENDOR_USD_PER_INPUT_TOKEN = 42 / 1e9; // vendor-claimed, unverified (Spike 002, 355-BRIEF)

// ---------------------------------------------------------------------------
// readPolicy(root) -> { text, obj, hash, path }
// Reads data/jev-policies/command-irreversibility.json (relative to root) as
// UTF-8 text, hashes the raw bytes, and refuses (INPUT_REFUSED) unless the
// parsed object has the D-01-shaped policy fields.
// ---------------------------------------------------------------------------
function readPolicy(root) {
  const abs = path.join(root, POLICY_REL);
  const raw = fs.readFileSync(abs);
  const text = raw.toString('utf8');
  const hash = sha256Hex(raw);

  let obj;
  try {
    obj = JSON.parse(text);
  } catch (e) {
    const err = new Error('readPolicy: ' + POLICY_REL + ' is not valid JSON: ' + e.message);
    err.code = 'INPUT_REFUSED';
    throw err;
  }

  const problems = [];
  if (typeof obj.policy_id !== 'string' || obj.policy_id.length === 0) {
    problems.push('policy_id must be a non-empty string');
  }
  if (typeof obj.version !== 'string' || obj.version.length === 0) {
    problems.push('version must be a non-empty string');
  }
  if (typeof obj.instructions !== 'string' || obj.instructions.length === 0) {
    problems.push('instructions must be a non-empty string');
  }
  const criteria = obj.criteria;
  if (!criteria || typeof criteria !== 'object' || Array.isArray(criteria)
    || typeof criteria.true !== 'string' || typeof criteria.false !== 'string') {
    problems.push('criteria must be a plain object with string true/false');
  }
  if (!Array.isArray(obj.boundary_cases) || obj.boundary_cases.length === 0
    || !obj.boundary_cases.every((s) => typeof s === 'string')) {
    problems.push('boundary_cases must be a non-empty array of strings');
  }
  if (problems.length > 0) {
    const err = new Error('readPolicy: ' + POLICY_REL + ' refused: ' + problems.join('; '));
    err.code = 'INPUT_REFUSED';
    throw err;
  }

  return { text: text, obj: obj, hash: hash, path: abs };
}

// ---------------------------------------------------------------------------
// makeGuard(root) -> guard(payload). Thin wrapper so every call site shares
// one profile reference (client.EGRESS_PROFILES.material_step_ledger).
// ---------------------------------------------------------------------------
function makeGuard(root) {
  return client.makeEgressGuard(client.EGRESS_PROFILES.material_step_ledger, { root: root });
}

// ---------------------------------------------------------------------------
// buildPayload(row, policy) -> the material_step_ledger request body for one
// registry row. row.teaching / row.jtbd_summary are expected already
// normalized to '' for a non-string source value (readRegistryRows does
// this); this function normalizes again defensively so a raw registry row
// (teaching: null) is still safe to pass in directly.
// ---------------------------------------------------------------------------
function buildPayload(row, policy) {
  const teaching = typeof row.teaching === 'string' ? row.teaching : '';
  const jtbdSummary = typeof row.jtbd_summary === 'string' ? row.jtbd_summary : '';
  const questions = {};
  questions[QUESTION_ID] = {
    type: 'noul',
    instructions: {
      question: QUESTION_TEXT,
      rule: policy.obj.instructions,
      boundary_cases: policy.obj.boundary_cases,
    },
    criteria: { true: policy.obj.criteria.true, false: policy.obj.criteria.false },
  };
  return {
    model: MODEL,
    state: {
      slug: row.command,
      teaching: teaching,
      jtbd_summary: jtbdSummary,
      policy: policy.text,
    },
    questions: questions,
  };
}

// ---------------------------------------------------------------------------
// parseNoulAnswer(json, command) -> the raw Noul number, stored exactly as
// returned (never rounded). Throws SCORE_FAILED naming the command on any
// shape other than { type: 'noul', noul: <finite number in [0,1]> }.
// ---------------------------------------------------------------------------
function parseNoulAnswer(json, command) {
  const answer = json && json.answers && json.answers[QUESTION_ID];
  const noul = answer && answer.noul;
  const ok = !!answer && answer.type === 'noul' && typeof noul === 'number'
    && Number.isFinite(noul) && noul >= 0 && noul <= 1;
  if (!ok) {
    const err = new Error('score: ' + command + ' returned a malformed noul answer');
    err.code = 'SCORE_FAILED';
    throw err;
  }
  return noul;
}

// ---------------------------------------------------------------------------
// makeFixtureFetch(fixture, sink) -> a fake fetchImpl that drives the REAL
// payload, guard and response-parsing path (unlike 353's fixture shortcut,
// RESEARCH Pitfall 9). Captures every outgoing { url, headers, body } into
// `sink` (an array) when provided, and answers from the SYNTHETIC per-
// command p values in `fixture` ({ model, default_p, p: { slug: p, ... } }).
// ---------------------------------------------------------------------------
function makeFixtureFetch(fixture, sink) {
  return async function fixtureFetch(url, init) {
    const body = JSON.parse(init.body);
    if (Array.isArray(sink)) {
      sink.push({ url: url, headers: init.headers, body: body });
    }
    const slug = body && body.state && body.state.slug;
    const hasSlug = fixture.p && Object.prototype.hasOwnProperty.call(fixture.p, slug);
    const p = hasSlug ? fixture.p[slug] : fixture.default_p;
    const answers = {};
    answers[QUESTION_ID] = { type: 'noul', noul: p };
    return {
      status: 200,
      text: async () => JSON.stringify({
        model: fixture.model,
        answers: answers,
        usage: { input_tokens: 1500, output_tokens: 5 },
      }),
    };
  };
}

// ---------------------------------------------------------------------------
// scoreAll(rows, policy, opts) -> { entries, usage }
// opts: { key, root, fetchImpl, sleepImpl, concurrency, buildPayloadImpl }
// Constructs the guard ONCE (makeGuard(opts.root || ROOT)), then sends one
// Noul per row through client.pool + client.jev (no local fetch, no local
// guard: every call is guarded and goes through the shared client, R8). A
// non-200 status, or a bad answer shape, ABORTS the build (SCORE_FAILED),
// never shipping a null entry.
// ---------------------------------------------------------------------------
async function scoreAll(rows, policy, opts) {
  const o = opts || {};
  const guard = makeGuard(o.root || ROOT);
  const buildPayloadImpl = o.buildPayloadImpl || buildPayload;
  const concurrency = o.concurrency || CONC;

  const models = new Set();
  let inputTokens = 0;
  let outputTokens = 0;

  const scored = await client.pool(rows, concurrency, async (row) => {
    const body = buildPayloadImpl(row, policy);
    const result = await client.jev(body, {
      key: o.key,
      guard: guard,
      fetchImpl: o.fetchImpl,
      sleepImpl: o.sleepImpl,
    });
    if (result.status !== 200 || !result.json) {
      const err = new Error('score: ' + row.command + ' HTTP ' + result.status);
      err.code = 'SCORE_FAILED';
      throw err;
    }
    const p = parseNoulAnswer(result.json, row.command);
    if (typeof result.json.model === 'string') models.add(result.json.model);
    const usage = result.json.usage;
    if (usage && typeof usage.input_tokens === 'number') inputTokens += usage.input_tokens;
    if (usage && typeof usage.output_tokens === 'number') outputTokens += usage.output_tokens;
    return {
      command: row.command,
      p_irreversible: p,
      text_hash: commandTextHash(row.command, row.teaching, row.jtbd_summary),
    };
  });

  const entries = scored.slice().sort((a, b) => (a.command < b.command ? -1 : a.command > b.command ? 1 : 0));
  const modelList = Array.from(models).sort();

  return {
    entries: entries,
    usage: {
      jev_calls: rows.length,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      jev_model: modelList.length <= 1 ? (modelList[0] || null) : modelList,
    },
  };
}

module.exports = {
  ROOT,
  DATA_DIR,
  POLICY_REL,
  DEFAULT_LABELS_PATH,
  DEFAULT_LEDGER_PATH,
  MODEL,
  QUESTION_ID,
  QUESTION_TEXT,
  CONC,
  VENDOR_USD_PER_INPUT_TOKEN,
  TEXT_HASH_BASIS,
  readPolicy,
  makeGuard,
  buildPayload,
  parseNoulAnswer,
  makeFixtureFetch,
  scoreAll,
};
