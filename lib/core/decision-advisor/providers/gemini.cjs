'use strict';
// Phase 399-04 (D-04, I-04): Gemini Decision provider shape. Pure body builder and response parser.
// Shapes come from the google-genai client attribute names used in the recorded research runs
// (decisions.create with input and questions; answers read as noul, choice, probabilities, score).
// The REST path and the REST JSON field casing are NOT confirmed: PATH stays null and PATH_CONFIRMED
// stays false until plan 05 confirms them from the vendor documentation. The parser accepts both
// snake_case and camelCase for the usage fields.
// This file opens no connection, reads no environment, and names no endpoint host.

const ID = 'gemini';
const MODEL = 'gemini-decision-1';
const API_VERSION = 'v1beta';
const REQUEST_FIELD = 'input';
const TYPE_MAP = Object.freeze({ yes_no: 'noul', choice: 'choice', score: 'score' });
const MAX_QUESTIONS = 1000;
// The provider sorts choice options itself, so a caller cannot use option order as a signal.
const SORTS_OPTIONS = true;
const PATH = null;
const PATH_CONFIRMED = false;

function buildBody(rendered) {
  const questions = {};
  for (const id of Object.keys(rendered.questions)) {
    const q = rendered.questions[id];
    const out = { type: TYPE_MAP[q.type], instructions: q.instructions };
    if (q.type === 'choice') out.criteria = Object.assign({}, q.options);
    if (q.type === 'score') out.criteria = q.levels.slice();
    questions[id] = out;
  }
  return { model: MODEL, [REQUEST_FIELD]: rendered.context, questions };
}

function isProb(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
}

function pickNumber(a, names) {
  for (const n of names) if (a && a[n] !== undefined && a[n] !== null) return a[n];
  return undefined;
}

// Keep only the keys the question defines; one out-of-range value voids the whole map.
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
    return isProb(a.noul) ? { type: 'yes_no', p: a.noul } : missing;
  }
  if (q.type === 'choice') {
    const keys = Object.keys(q.options);
    const probabilities = cleanProbs(a.probabilities, keys);
    if (!probabilities || typeof a.choice !== 'string' || keys.indexOf(a.choice) === -1) return missing;
    const conf = a.confidence;
    return { type: 'choice', probabilities, choice: a.choice, confidence: isProb(conf) ? conf : null };
  }
  const levelKeys = q.levels.map((_l, i) => String(i)).concat(q.levels);
  const probabilities = cleanProbs(a.probabilities, levelKeys);
  if (!isProb(a.score) || !probabilities) return missing;
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
  return {
    answers,
    usage: {
      input_tokens: tokens(pickNumber(usage, ['total_input_tokens', 'totalInputTokens'])),
      output_tokens: tokens(pickNumber(usage, ['total_output_tokens', 'totalOutputTokens'])),
    },
  };
}

module.exports = { ID, MODEL, API_VERSION, REQUEST_FIELD, TYPE_MAP, MAX_QUESTIONS, SORTS_OPTIONS, PATH, PATH_CONFIRMED, buildBody, parseResponse };
