'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 363 Plan 12 -- the quick-run verdict, computed in code (D-03, D-16).
 *
 * The verdict is never a model opinion. It is a fixed-order rule over three
 * inputs: what each search returned (outcome and count), which validated rows
 * support or contradict which leaf, and the disclosed count floor.
 *
 * Order (the first rule that fires wins):
 *   1. unresolved      any needed search failed, was blocked, was never run,
 *                      or came back with no count. A failure is never a
 *                      finding, so it can never read as gap-confirmed.
 *   2. gap-confirmed   whitespace only: the primary and the synonym-cover
 *                      searches both ran and both counts are at or below the
 *                      floor (and no row shows the zone covered elsewhere).
 *   3. settled         a count is above the floor and a validated row supports
 *                      the covered-elsewhere leaf with nothing against it.
 *   4. contested       validated rows both support and contradict one leaf.
 *   5. thin            everything else.
 * Non-whitespace templates skip rule 2 and read rule 3 as "a leaf has
 * supporting rows and no contradicting rows".
 *
 * Canon Part 12: no scores. Numbers on the answer line are counts, each named
 * with its source. Praise words never appear.
 *
 * Pure CJS, no fs, no network, no clock. No em-dash or en-dash in this file.
 */

// Disclosed default [re-measured in 363-20]: an exact-phrase count at or below
// this many hits counts as absent.
const GAP_COUNT_FLOOR = 3;

const VERDICTS = Object.freeze(['settled', 'thin', 'contested', 'gap-confirmed', 'unresolved']);

const OK_OUTCOMES = Object.freeze(['ok', 'empty_valid', 'cache_hit']);

const SOURCE_LABEL = 'OpenAlex exact-phrase count';

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function list(v) { return Array.isArray(v) ? v : []; }
function num(v) { return typeof v === 'number' && Number.isFinite(v); }

function templateIdOf(template) {
  if (typeof template === 'string') return template;
  return isObj(template) && typeof template.id === 'string' ? template.id : '';
}

function queryKey(q) { return String((q && q.leaf_id) || '') + '|' + String((q && q.template_id) || ''); }

function usable(rec) {
  return isObj(rec) && OK_OUTCOMES.indexOf(rec.outcome) !== -1 && num(rec.count);
}

function labelCounts(rows) {
  const by = {};
  list(rows).forEach(function (r) {
    if (!isObj(r) || typeof r.leaf_id !== 'string') return;
    if (!by[r.leaf_id]) by[r.leaf_id] = { supports: 0, contradicts: 0 };
    if (r.label === 'supports') by[r.leaf_id].supports += 1;
    if (r.label === 'contradicts') by[r.leaf_id].contradicts += 1;
  });
  return by;
}

// computeQuickVerdict({ queries, planned, rows, leaves, template })
//   queries  executed searches: { leaf_id, template_id, role, outcome, count }
//   planned  every search the plan meant to run: { leaf_id, template_id, role }
//            (defaults to queries); a planned search with no executed record
//            counts as not run
//   rows     validated evidence rows
//   leaves   plan leaves ({ id, dimension, researchable })
//   template template id string or { id }
// -> { verdict, plurality_ran, primary_count, cover_count, floor, reasons[] }
function computeQuickVerdict(input) {
  const inp = isObj(input) ? input : {};
  const queries = list(inp.queries);
  const planned = Array.isArray(inp.planned) ? inp.planned : queries;
  const leaves = list(inp.leaves);
  const isWhitespace = templateIdOf(inp.template) === 'whitespace';
  const byLeaf = labelCounts(inp.rows);

  const result = {
    verdict: 'thin',
    plurality_ran: false,
    primary_count: null,
    cover_count: null,
    floor: GAP_COUNT_FLOOR,
    reasons: [],
  };

  const executed = {};
  queries.forEach(function (q) { if (isObj(q)) executed[queryKey(q)] = q; });

  const needed = isWhitespace
    ? planned.filter(function (p) { return p && (p.role === 'primary' || p.role === 'falsifier_covered_elsewhere'); })
    : planned;

  // 1. unresolved
  if (isWhitespace && !planned.some(function (p) { return p && p.role === 'primary'; })) {
    result.verdict = 'unresolved';
    result.reasons.push('no_primary_search');
    return result;
  }
  if (needed.length === 0) {
    result.verdict = 'unresolved';
    result.reasons.push('no_search_planned');
    return result;
  }
  let broken = false;
  needed.forEach(function (p) {
    const rec = executed[queryKey(p)];
    if (!rec) { broken = true; result.reasons.push('not_run:' + String(p.template_id)); return; }
    if (!usable(rec)) {
      broken = true;
      result.reasons.push((OK_OUTCOMES.indexOf(rec.outcome) === -1 ? 'failed:' : 'no_count:') + String(rec.template_id));
    }
  });
  if (broken) {
    result.verdict = 'unresolved';
    return result;
  }

  const primary = queries.filter(function (q) { return q && q.role === 'primary'; })[0] || null;
  const cover = queries.filter(function (q) { return q && q.role === 'falsifier_covered_elsewhere'; })[0] || null;
  if (primary) result.primary_count = primary.count;
  if (cover) result.cover_count = cover.count;
  result.plurality_ran = !!(primary && cover);

  const coveredLeaves = leaves.filter(function (l) { return l && l.dimension === 'ws:covered_elsewhere'; });
  const coveredSupported = coveredLeaves.some(function (l) {
    const c = byLeaf[l.id];
    return !!c && c.supports > 0;
  });
  const coveredClean = coveredLeaves.some(function (l) {
    const c = byLeaf[l.id];
    return !!c && c.supports > 0 && c.contradicts === 0;
  });
  const anyAbove = queries.some(function (q) { return usable(q) && q.count > GAP_COUNT_FLOOR; });
  const contestedLeaf = Object.keys(byLeaf).some(function (id) { return byLeaf[id].supports > 0 && byLeaf[id].contradicts > 0; });

  // 2. gap-confirmed (whitespace only)
  if (isWhitespace && result.plurality_ran && primary.count <= GAP_COUNT_FLOOR && cover.count <= GAP_COUNT_FLOOR && !coveredSupported) {
    result.verdict = 'gap-confirmed';
    return result;
  }

  // 3. settled
  if (isWhitespace) {
    if (anyAbove && coveredClean) { result.verdict = 'settled'; return result; }
  } else {
    const leafSettled = Object.keys(byLeaf).some(function (id) { return byLeaf[id].supports > 0 && byLeaf[id].contradicts === 0; });
    if (leafSettled && !contestedLeaf) { result.verdict = 'settled'; return result; }
  }

  // 4. contested
  if (contestedLeaf) { result.verdict = 'contested'; return result; }

  // 5. thin
  result.verdict = 'thin';
  return result;
}

function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

// answerLine(verdictResult, ctx) -> one plain sentence. Numbers come only from
// counts and are named with their source. ctx: { rows, bearing } (bearing: how many fetched records match the
// question, counted by the caller; absent means not counted).
function answerLine(v, ctx) {
  const r = isObj(v) ? v : { verdict: 'unresolved' };
  const rows = list(ctx && ctx.rows);
  const bearing = ctx && ctx.bearing;
  const sup = rows.filter(function (x) { return x && x.label === 'supports'; }).length;
  const con = rows.filter(function (x) { return x && x.label === 'contradicts'; }).length;
  const p = num(r.primary_count) ? SOURCE_LABEL + ' ' + r.primary_count + ' for the main search' : null;
  const c = num(r.cover_count) ? SOURCE_LABEL + ' ' + r.cover_count + ' for the synonym cover' : null;
  const counts = [p, c].filter(Boolean).join(' and ');
  let line;
  switch (r.verdict) {
    case 'gap-confirmed':
      line = 'No published work turned up under the main wording or its synonyms (' + counts + ', floor ' + r.floor + '), so the gap held up in this search.';
      break;
    case 'settled':
      line = 'The same problem is already studied under another wording (' + (counts || SOURCE_LABEL + ' above the floor of ' + r.floor) + '), with ' + plural(sup, 'supporting row', 'supporting rows') + '.';
      break;
    case 'contested':
      line = 'The evidence disagrees on the same question: ' + plural(sup, 'row supports', 'rows support') + ' it and ' + plural(con, 'row contradicts', 'rows contradict') + ' it' + (counts ? ' (' + counts + ')' : '') + '.';
      break;
    case 'thin': {
      // 369.2-18 (INPUT defect 3): the verdict rule is unchanged; the line says how many fetched records match the
      // question when the run counted them (ctx.bearing), and keeps the row sentence when rows were read for or
      // against it or when the caller did not count.
      const head = 'There is not enough here to call it' + (counts ? ' (' + counts + ')' : '') + '; ';
      if (sup + con === 0 && num(bearing)) {
        line = bearing > 0
          ? head + bearing + ' record' + (bearing === 1 ? ' matches' : 's match') + ' the question, and none were read for or against it.'
          : head + 'no fetched record matches the question.';
      } else {
        line = head + plural(sup + con, 'row', 'rows') + ' bear on the question.';
      }
      break;
    }
    default:
      line = 'This could not be answered: a search failed, was blocked, was not run, or came back with no count, so nothing is concluded.';
  }
  return line.replace(/[\u2014\u2013]/g, '-');
}

module.exports = {
  GAP_COUNT_FLOOR: GAP_COUNT_FLOOR,
  VERDICTS: VERDICTS,
  computeQuickVerdict: computeQuickVerdict,
  answerLine: answerLine,
};
