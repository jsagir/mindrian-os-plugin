#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.6 plan 02 Task 3 (Codex round 2 MEDIUM, round 3 HIGH): the reviewed Jev transport for voice judge
 * payloads, with a voice ceiling of its own.
 *
 * Why a new transport (Canon Part 7, reuse before build, with a stated reason): the section ledger's ceiling
 * (scripts/build-section-command-ledger.cjs, assertEgressCeiling) allows ledger state keys and 140-character
 * strings only, so it rejects a voice payload by design. Widening that ceiling would loosen the ledger's own
 * Canon Part 8 guard. This module keeps the ledger byte-unchanged, reuses its loadKey and pool, and adds a
 * ceiling that fits exactly one payload shape: the verified fixture reply, its probe, and the rubric items.
 *
 * The ceiling compares the whole payload tuple (probe id, prompt, context, turn index, reply bytes and the
 * rubric items) with a verified record that scripts/eval-larry-voice.cjs builds from provenance it re-derived
 * before any payload existed. jevVoice serializes the body once, runs the ceiling on the parsed form of those
 * exact bytes as its last step before fetch, and sends the same bytes.
 *
 * The ledger's jev() and assertEgressCeiling are never called here and never see a voice payload.
 * The key is never printed, stored or returned. Canon Part 8: invented fixture text only, never room content,
 * user text, a tool log or a hook-composed reply.
 */

const ledger = require('./build-section-command-ledger.cjs');

// The same URL as the ledger's ENDPOINT constant, which that file does not export. The test reads the ledger
// source text and asserts the two literals are equal.
const JEV_VOICE_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const JEV_VOICE_MODEL = 'jev-latest';

const ALLOWED_TOP_KEYS = new Set(['model', 'state', 'questions']);
const ALLOWED_STATE_KEYS = new Set(['probe_id', 'turn_index', 'prompt', 'context', 'reply']);
const ALLOWED_QUESTION_KEYS = new Set(['type', 'instructions', 'criteria']);
const MAX_JUDGE_INSTRUCTION_CHARS = 400; // the ledger's own cap for instructions.judge
const MAX_CRITERION_CHARS = 900;
const HOME_PATH_RE = /\/home\/|\/Users\/|[A-Za-z]:\\+Users|MindrianRooms/i;

function breach(reason, detail) {
  const e = new Error('assertVoiceEgressCeiling: ' + reason + (detail ? ' (' + detail + ')' : ''));
  e.reason = reason;
  e.detail = detail || null;
  return e;
}

function limitsOf(opts) {
  if (opts && opts.limits) {
    if (!['reply', 'prompt', 'context'].every(function (k) { return Number.isFinite(opts.limits[k]) && opts.limits[k] > 0; })) throw breach('limits_unavailable');
    return opts.limits;
  }
  // read at call time so the eval module can load this file lazily without a load-order cycle
  const ev = require('./eval-larry-voice.cjs');
  const lim = { reply: ev.JUDGE_MAX_REPLY_CHARS, prompt: ev.JUDGE_MAX_PROMPT_CHARS, context: ev.JUDGE_MAX_CONTEXT_CHARS };
  // fail closed: a missing limit (for example from a load-order cycle) must never read as "no limit"
  if (!['reply', 'prompt', 'context'].every(function (k) { return Number.isFinite(lim[k]) && lim[k] > 0; })) throw breach('limits_unavailable');
  return lim;
}

function scanStrings(value, visit) {
  if (typeof value === 'string') visit(value);
  else if (Array.isArray(value)) value.forEach(function (v) { scanStrings(v, visit); });
  else if (value && typeof value === 'object') Object.keys(value).forEach(function (k) { visit(k); scanStrings(value[k], visit); });
}

/*
 * assertVoiceEgressCeiling(body, { verified, limits }) -> true, or throws with .reason.
 * `body` is the parsed payload. `verified` is the record from verifyJudgeProvenance: { entries: [...] }.
 */
function assertVoiceEgressCeiling(body, opts) {
  const o = opts || {};
  const verified = o.verified;
  if (!verified || !Array.isArray(verified.entries) || !verified.entries.length) throw breach('verified_record_required');
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw breach('payload_not_object');
  Object.keys(body).forEach(function (k) { if (!ALLOWED_TOP_KEYS.has(k)) throw breach('disallowed_top_key', k); });
  if (body.model !== JEV_VOICE_MODEL) throw breach('model_not_allowed', String(body.model));
  const state = body.state;
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw breach('state_not_object');
  Object.keys(state).forEach(function (k) { if (!ALLOWED_STATE_KEYS.has(k)) throw breach('disallowed_state_key', k); });
  ['probe_id', 'prompt', 'context', 'reply'].forEach(function (k) { if (typeof state[k] !== 'string') throw breach('state_field_type', k); });
  if (typeof state.turn_index !== 'number' || !Number.isInteger(state.turn_index)) throw breach('state_field_type', 'turn_index');
  const lim = limitsOf(o);
  if (state.reply.length > lim.reply) throw breach('reply_too_long', String(state.reply.length));
  if (state.prompt.length > lim.prompt) throw breach('prompt_too_long', String(state.prompt.length));
  if (state.context.length > lim.context) throw breach('context_too_long', String(state.context.length));
  const sameProbe = verified.entries.filter(function (e) { return e.probe_id === state.probe_id; });
  if (!sameProbe.length) throw breach('probe_id_not_verified', state.probe_id);
  if (!verified.entries.some(function (e) { return e.reply === state.reply; })) throw breach('reply_not_in_verified_set');
  const questions = body.questions;
  if (!questions || typeof questions !== 'object' || Array.isArray(questions)) throw breach('questions_not_object');
  Object.keys(questions).forEach(function (qid) {
    const q = questions[qid];
    if (!q || typeof q !== 'object') throw breach('question_not_object', qid);
    Object.keys(q).forEach(function (k) { if (!ALLOWED_QUESTION_KEYS.has(k)) throw breach('disallowed_question_key', qid + '.' + k); });
    // instructions is an object that holds the judge text and nothing else, so every transmitted field is covered
    if (!q.instructions || typeof q.instructions !== 'object' || Array.isArray(q.instructions)) throw breach('instructions_not_object', qid);
    Object.keys(q.instructions).forEach(function (k) { if (k !== 'judge') throw breach('disallowed_instruction_key', qid + '.' + k); });
    if (typeof q.instructions.judge !== 'string' || q.instructions.judge.length > MAX_JUDGE_INSTRUCTION_CHARS) throw breach('instruction_too_long', qid);
    if (!Array.isArray(q.criteria)) throw breach('criteria_not_array', qid);
    if (Array.isArray(q.criteria) && q.criteria.some(function (c) { return typeof c !== 'string' || c.length > MAX_CRITERION_CHARS; })) throw breach('criterion_too_long', qid);
  });
  const match = sameProbe.filter(function (e) {
    if (e.turn_index !== state.turn_index || e.prompt !== state.prompt || e.context !== state.context || e.reply !== state.reply) return false;
    const ids = Object.keys(questions).sort();
    if (ids.join(',') !== e.items.map(function (it) { return it.id; }).sort().join(',')) return false;
    return e.items.every(function (it) {
      const q = questions[it.id];
      return q && q.type === 'score' && q.instructions && q.instructions.judge === it.judge && Array.isArray(q.criteria) &&
        q.criteria.length === it.criteria.length && q.criteria.every(function (c, i) { return c === it.criteria[i]; });
    });
  });
  if (!match.length) throw breach('payload_tuple_mismatch', state.probe_id);
  scanStrings(body, function (s) { if (HOME_PATH_RE.test(s)) throw breach('home_path_in_payload'); });
  return true;
}

const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

/*
 * jevVoice(key, body, { verified, fetchImpl, limits }) -> { status, ms, json }.
 * The retry and backoff shape is the ledger client's. The body is serialized once; the ceiling runs on the
 * parsed form of those bytes; the same bytes are sent.
 */
async function jevVoice(key, body, opts) {
  const o = opts || {};
  const bytes = JSON.stringify(body);
  assertVoiceEgressCeiling(JSON.parse(bytes), { verified: o.verified, limits: o.limits });
  const fetchImpl = o.fetchImpl || fetch;
  let attempt = 0;
  for (;;) {
    const t0 = Date.now();
    let r;
    try {
      r = await fetchImpl(JEV_VOICE_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: bytes,
      });
    } catch (_e) {
      if (attempt++ < 3) { await sleep(500 * 2 ** attempt); continue; }
      return { status: 0, ms: Date.now() - t0, json: null };
    }
    const ms = Date.now() - t0;
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_e) { /* leave json null */ }
    if ((r.status === 429 || r.status === 529) && attempt++ < 4) { await sleep(400 * 2 ** attempt); continue; }
    return { status: r.status, ms: ms, json: json };
  }
}

module.exports = {
  jevVoice,
  assertVoiceEgressCeiling,
  JEV_VOICE_ENDPOINT,
  loadKey: ledger.loadKey,
  pool: ledger.pool,
};
