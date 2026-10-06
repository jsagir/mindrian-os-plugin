'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.2 Plan 16 (369.2-R07; annex C01-C03, C16, C17; brief AI-04 gate half) -- the one source of
 * jobs-and-moves sentences for run results.
 *
 * A run's answer names the job and the move, never the id (INPUT addendum 2): which question was not
 * searched and why, that an empty result is only what one query returned, and whether the searches for
 * evidence against the claim ran. The words come from the operation ledger (operations.cjs), never from
 * a command return, so a sentence cannot say more than the ledger proved.
 *
 * Exports: REASON_WORDS, STOP_WORDS, reasonWords, incompleteLines, emptyResultLine, counterevidenceLine,
 * deepOpeningLine, governingWords.
 *
 * Pure: requires operations.cjs only (for isFalsifier). No fs, no network, no clock. Hyphens only.
 */

const operations = require('./operations.cjs');

// Exact reader words for each ledger reason (operations.cjs REASONS). The sentence they sit in always
// starts "<question> was not searched: ", so each phrase reads as the reason for that question.
const REASON_WORDS = Object.freeze({
  quick_cap: 'the quick run\'s three searches went to other questions first',
  search_cap: 'the run\'s search budget ran out before it',
  lane_cap: 'the run looks at a limited number of lines of inquiry at once, and this one was past the limit',
  ce_reserve_exhausted: 'the budget kept for evidence against it ran out',
  time: 'the time budget ran out',
  budget_usd: 'the cost budget ran out',
  offline: 'offline mode was on',
  theo_line_off: 'the Theo line is off for this room',
  run_aborted: 'the run stopped before it',
  stopped_by_navigator: 'you stopped the run',
  no_query_composed: 'no search phrase could be formed from its words',
  hash_not_approved: 'that search was not on the approved card',
  term_not_composed: 'Theo takes only canon framework names, and this was not one',
  grant_expired: 'the grant had expired',
  unknown_lens: 'its lens is not one the planner knows',
});

const FAILURE_WORDS = Object.freeze({
  network_timeout: 'it timed out',
  http_5xx: 'a server error',
  rate_limited: 'it was rate limited',
  budget: 'the search budget at the service was spent',
});

// Why a run stopped. Deviation from the plan text: stop_reason 'budget' covers BOTH the dollar budget
// and the search cap (369.2-15 finding, test E8 pins the code), so the word for it never claims cost
// alone; stopWords() narrows it from the operations when they say which one it was.
const STOP_WORDS = Object.freeze({
  cap: 'the search budget ran out',
  saturation: 'new searches stopped finding new records',
  time: 'the time budget ran out',
  budget: 'the search or cost budget ran out',
  navigator_stop: 'you stopped the run',
  plurality_required: 'both search wordings of the question have to run first',
});

const PROVIDER_NAMES = Object.freeze({ openalex: 'OpenAlex', tavily: 'Tavily', patent: 'the patent source', theo: 'Theo' });

const GOVERNING_WORDS = Object.freeze({ strengthened: 'stronger', weakened: 'weaker', split: 'split', unresolved: 'unresolved' });

function list(v) { return Array.isArray(v) ? v : []; }
function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function noDash(s) { return String(s).replace(/[\u2014\u2013]/g, '-'); }
function oneLine(s) { return String(s === undefined || s === null ? '' : s).replace(/\s+/g, ' ').trim(); }

// reasonWords(reason) -> plain words for one ledger reason. An unknown or missing reason never leaks its
// code: it reads as "it did not run".
function reasonWords(reason) {
  if (typeof reason !== 'string' || reason.length === 0) return 'it did not run';
  if (Object.prototype.hasOwnProperty.call(REASON_WORDS, reason)) return REASON_WORDS[reason];
  if (reason.indexOf('provider_failed:') === 0) {
    const cls = reason.slice('provider_failed:'.length);
    const w = Object.prototype.hasOwnProperty.call(FAILURE_WORDS, cls) ? FAILURE_WORDS[cls] : 'an error';
    return 'the search service did not answer (' + w + ')';
  }
  if (reason === 'provider_unavailable:patent') return 'there is no patent source on this machine';
  if (reason === 'provider_unavailable:tavily') return 'industry search needs a Tavily key, and none is set';
  if (reason.indexOf('provider_unavailable:') === 0) return 'that search source is not available on this machine';
  if (reason === 'bad_slot:limiter') return 'the wall it tests is written as a sentence; name it in a few words';
  if (reason.indexOf('bad_slot:') === 0) return 'one of its search terms could not be used';
  if (reason.indexOf('unused_slot:') === 0) return 'the extra term given for it is not used by its search shape';
  return 'it did not run';
}

// the same words inside a sentence about evidence against the claim: "... ran (<reason>)"
function ceReasonWords(reason) {
  return reasonWords(reason).replace(/ before it$/, '');
}

// label: the question without its trailing question mark, cut at 90 characters on a word boundary
function labelOf(label) {
  let s = oneLine(label).replace(/\s*\?+\s*$/, '');
  if (s.length === 0) return 'A question in the plan';
  if (s.length > 90) {
    const cut = s.slice(0, 90);
    const at = cut.lastIndexOf(' ');
    s = (at > 0 && s.charAt(90) !== ' ' ? cut.slice(0, at) : cut).replace(/[\s,;:]+$/, '');
  }
  return s;
}

// incompleteLines(completion, opts) -> sentences, one per question not searched (ops of one dimension
// collapse into one sentence), then '<n> more questions were not searched.' past opts.max (default 3).
//   opts.operations       the run's operation list, used by skipFalsifiers
//   opts.skipFalsifiers   leave out evidence-against operations (the counterevidence sentence covers them)
function incompleteLines(completion, opts) {
  const o = isObj(opts) ? opts : {};
  const max = typeof o.max === 'number' && o.max >= 0 ? o.max : 3;
  const falsifierIds = {};
  if (o.skipFalsifiers === true) {
    list(o.operations).forEach(function (op) { if (operations.isFalsifier(op)) falsifierIds[op.operation_id] = true; });
  }
  const order = [];
  const byDim = {};
  list(completion && completion.incomplete).forEach(function (i) {
    if (!isObj(i)) return;
    if (o.skipFalsifiers === true && (falsifierIds[i.operation_id] === true || String(i.plan_dimension || '').indexOf('CE:') === 0)) return;
    const key = String(i.plan_dimension === undefined || i.plan_dimension === null ? i.operation_id : i.plan_dimension);
    if (!byDim[key]) { byDim[key] = { label: i.dimension_label, words: [] }; order.push(key); }
    const w = reasonWords(i.reason);
    if (byDim[key].words.indexOf(w) === -1) byDim[key].words.push(w);
    if (!byDim[key].label && i.dimension_label) byDim[key].label = i.dimension_label;
  });
  const lines = order.slice(0, max).map(function (k) {
    return noDash('"' + labelOf(byDim[k].label) + '" was not searched: ' + byDim[k].words.join('; and ') + '.');
  });
  const rest = order.length - Math.min(order.length, max);
  if (rest > 0) lines.push(rest + ' more question' + (rest === 1 ? ' was' : 's were') + ' not searched.');
  return lines;
}

// emptyResultLine(ops) -> the C03 sentence over the operations that ran and came back with a counted zero,
// or '' when none did. Lateral Theo checks are a different kind of answer and are left out.
function emptyResultLine(ops) {
  const empty = list(ops).filter(function (op) {
    return isObj(op) && op.state === 'executed_empty' && op.kind !== 'theo' && typeof op.q === 'string' && op.q.length > 0;
  });
  if (empty.length === 0) return '';
  const first = empty[0];
  const prov = typeof first.provider === 'string' ? (PROVIDER_NAMES[first.provider] || first.provider) : 'the search source';
  const more = empty.length > 1 ? ' and ' + (empty.length - 1) + ' more' : '';
  return noDash('These searches ran and returned no records: "' + oneLine(first.q) + '" (' + prov + ')' + more + '. That is what these searches returned, not proof the literature is silent.');
}

// counterevidenceLine(ce, { roundOneOnly }) -> the evidence-against sentence for the status (C17); '' for
// not_needed. Only a complete status may say the searches ran; it never says verified.
function counterevidenceLine(ce, opts) {
  if (!isObj(ce)) return '';
  const roundOneOnly = isObj(opts) && opts.roundOneOnly === true;
  const executed = typeof ce.executed === 'number' ? ce.executed : 0;
  const planned = typeof ce.planned === 'number' ? ce.planned : 0;
  const reasons = list(ce.reasons).map(ceReasonWords);
  const why = reasons.length > 0 ? reasons.join('; ') : 'none was planned from the question\'s words';
  switch (ce.status) {
    case 'complete':
      return roundOneOnly
        ? 'The searches for evidence against it ran inside the first round (' + executed + '), so no extra pass was needed.'
        : 'The searches for evidence against it ran (' + executed + ').';
    case 'partial':
      return 'Only ' + executed + ' of ' + planned + ' searches for evidence against it ran (' + why + ').';
    case 'not_run':
      return 'Not verified: the searches for evidence against it did not run (' + why + ').';
    default:
      return '';
  }
}

function governingWords(governing) {
  return Object.prototype.hasOwnProperty.call(GOVERNING_WORDS, governing) ? GOVERNING_WORDS[governing] : 'unresolved';
}

// stopWords(stop, ops) -> why the run stopped, in words. 'budget' is narrowed by the operations: a search-cap
// reason names the search budget, a dollar reason the cost budget, neither stays "search or cost".
function stopWords(stop, ops) {
  const key = typeof stop === 'string' && stop.length > 0 ? stop : 'cap';
  if (key === 'budget') {
    const reasons = list(ops).map(function (op) { return isObj(op) ? op.reason : null; });
    const usd = reasons.indexOf('budget_usd') !== -1;
    const cap = reasons.indexOf('search_cap') !== -1 || reasons.indexOf('ce_reserve_exhausted') !== -1;
    if (usd && !cap) return 'the cost budget ran out';
    if (cap && !usd) return 'the search budget ran out';
  }
  return Object.prototype.hasOwnProperty.call(STOP_WORDS, key) ? STOP_WORDS[key] : 'the run reached its limit';
}

// deepOpeningLine({ executed, planned, rows, governing, stop, operations }) -> the first sentence of a deep answer
function deepOpeningLine(f) {
  const x = isObj(f) ? f : {};
  const executed = typeof x.executed === 'number' ? x.executed : 0;
  const planned = typeof x.planned === 'number' ? x.planned : 0;
  const rows = typeof x.rows === 'number' ? x.rows : 0;
  return noDash('The deep run made ' + executed + ' of ' + planned + ' planned searches and kept ' + rows + ' checked rows; the main question now reads ' + governingWords(x.governing) + '. It stopped because ' + stopWords(x.stop, x.operations) + '.');
}

module.exports = {
  REASON_WORDS: REASON_WORDS,
  STOP_WORDS: STOP_WORDS,
  reasonWords: reasonWords,
  stopWords: stopWords,
  incompleteLines: incompleteLines,
  emptyResultLine: emptyResultLine,
  counterevidenceLine: counterevidenceLine,
  deepOpeningLine: deepOpeningLine,
  governingWords: governingWords,
};
