'use strict';
// Phase 399-04 (D-04, I-04): Jev-compatible provider shape (hosted Jev or self-hosted Kev).
// Pure body builder and response parser. Shape from the 2026-09-17 spike reference
// (.claude/skills/spike-findings-MindrianOS-Plugin/references/jev-typed-decisions-api.md):
// POST body { model, state, questions }, response { model, answers, usage, latency_ms }.
// A malformed question returns 400. 20 questions per call was measured safe.
// This file opens no connection, reads no environment, and names no endpoint host.

const ID = 'jev';
const MODEL = 'jev-latest';
const MODELS = Object.freeze(['jev-latest', 'kev-latest']);
const REQUEST_FIELD = 'state';
const TYPE_MAP = Object.freeze({ yes_no: 'noul', choice: 'choice', score: 'score' });
const MAX_QUESTIONS = 20;
// The provider keeps the order of the options it receives. Callers must shuffle for a fair test.
const SORTS_OPTIONS = false;
const PATH = '/v1/systemone';

function buildBody(rendered, opts) {
  const wanted = opts && opts.model;
  const model = MODELS.indexOf(wanted) !== -1 ? wanted : MODEL;
  const questions = {};
  for (const id of Object.keys(rendered.questions)) {
    const q = rendered.questions[id];
    const out = { type: TYPE_MAP[q.type], instructions: q.instructions };
    if (q.type === 'choice') out.criteria = Object.assign({}, q.options);
    if (q.type === 'score') out.criteria = q.levels.slice();
    questions[id] = out;
  }
  return { model, [REQUEST_FIELD]: rendered.context, questions };
}

function isProb(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
}

function cleanProbs(raw, allowedKeys) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};
  for (const k of Object.keys(raw)) {
    if (allowedKeys.indexOf(k) === -1) continue;
    if (!isProb(raw[k])) return null;
    out[k] = raw[k];
  }
  return Object.keys(out).length ? out : null;
}

function parseOne(q, a) {
  const missing = { type: q.type, missing: true };
  if (!a || typeof a !== 'object') return missing;
  if (q.type === 'yes_no') {
    return a.type === 'noul' && isProb(a.noul) ? { type: 'yes_no', p: a.noul } : missing;
  }
  if (q.type === 'choice') {
    const keys = Object.keys(q.options);
    const probabilities = cleanProbs(a.probabilities, keys);
    if (a.type !== 'choice' || !probabilities || typeof a.choice !== 'string' || keys.indexOf(a.choice) === -1) return missing;
    return { type: 'choice', probabilities, choice: a.choice, confidence: isProb(a.confidence) ? a.confidence : null };
  }
  const levelKeys = q.levels.map((_l, i) => String(i)).concat(q.levels);
  const probabilities = cleanProbs(a.probabilities, levelKeys);
  if (a.type !== 'score' || !isProb(a.score) || !probabilities) return missing;
  return { type: 'score', score: a.score, probabilities, confidence: isProb(a.confidence) ? a.confidence : null };
}

function tokens(v) {
  return Number.isInteger(v) && v >= 0 ? v : 0;
}

// Never throws. `questions` is the rendered question map of the request chunk.
function parseResponse(resp, questions) {
  const answers = {};
  let src = {};
  let usage = {};
  try {
    if (resp && typeof resp === 'object') {
      if (resp.answers && typeof resp.answers === 'object') src = resp.answers;
      if (resp.usage && typeof resp.usage === 'object') usage = resp.usage;
    }
  } catch (_e) { /* keep defaults */ }
  for (const id of Object.keys(questions)) {
    try {
      answers[id] = parseOne(questions[id], Object.prototype.hasOwnProperty.call(src, id) ? src[id] : null);
    } catch (_e) {
      answers[id] = { type: questions[id].type, missing: true };
    }
  }
  return { answers, usage: { input_tokens: tokens(usage.input_tokens), output_tokens: tokens(usage.output_tokens) } };
}

module.exports = { ID, MODEL, REQUEST_FIELD, TYPE_MAP, MAX_QUESTIONS, SORTS_OPTIONS, PATH, buildBody, parseResponse };
