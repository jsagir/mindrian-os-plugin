'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 366 plan 14 (D-09, EPV366-08): the analogies perspective recall.
 *
 * An analogy here is a pair of things that share STRUCTURE without sharing WORDS: a relational signal
 * (a shared entity, or a shared framework node) with low lexical overlap. Recall starts from the eureka
 * candidates on the same substrate and the same exclusion set (eurekaRecall.recallCandidates already
 * passed every pair through shared.makeCandidateStore), keeps the relational, low-lexical rows, and adds
 * the lane `structural`. There is no second substrate read and no second exclusion check.
 *
 * Recall is local and offline. Any web reach is a planner query under a grant, never code here.
 *
 * STATEMENT_TEMPLATE (D-09): the SAPPhIRE condensation (function, behavior, structure, per side) of
 * references/methodology/sapphire-encoding.md. Recall never fills it. The host model fills it from the
 * room text of the two things at the statement stage, before writing the opportunity statement, and the
 * slots never go into a leaf slot or a research query (T-366-58). The host_hint says so, and the
 * research_run perspective_recall op passes the template through with every analogies run.
 *
 * Plan 366-08 owns the substrate and the exclusion set. This module consumes them and edits neither
 * eureka-recall.cjs nor shared.cjs. Hyphens only.
 */

const path = require('node:path');

const navigation = require('../../navigation.cjs');
const eurekaRecall = require('./eureka-recall.cjs');
const shared = require('./shared.cjs');

const ID = 'analogies';
const TEMPLATE_ID = 'analogies';
const COMMAND = '/mos:find-analogies';
const LENSES = Object.freeze(['an.structure', 'an.known']);
const FALSIFIER = 'A documented case where the shared function and behavior did not transfer because the structures differ.';
const RUN_ROOT = path.join('.mindrian', 'perspectives', 'analogies');
const STATUS_TITLE = 'Analogies perspective run';
// lexical_ceiling: a pair above it shares words, so it is a eureka pair, not an analogy.
// lexical_mode (2026): 'fixed' (default) applies lexical_ceiling as is. 'percentile' also requires the
// pair to sit in the lowest lexical_percentile of the signal-bearing pool (never looser than the fixed
// ceiling), which adapts to a room whose wording overlaps more or less than the 0.15 calibration;
// it needs lexical_min_pool pairs, else it silently equals 'fixed' (reported in counts.lexical_mode).
const BUDGETS = Object.freeze({
  max_candidates: 100, max_leaves: 8, lexical_ceiling: 0.15,
  lexical_mode: 'fixed', lexical_percentile: 0.25, lexical_min_pool: 8,
});
const STAGE_A_LANES = Object.freeze(['structural', 'icm_declared']);
const RUN_LANES = STAGE_A_LANES;

const STATEMENT_TEMPLATE = Object.freeze({
  schema: 'mos.sapphire-statement/1',
  sides: Object.freeze(['a', 'b']),
  slots: Object.freeze(['function', 'behavior', 'structure']),
  source: 'references/methodology/sapphire-encoding.md',
  fill: 'statement stage, host model, from room text; never recall, never a query',
  host_hint: 'Before writing the opportunity statement for this pair, fill function, behavior and structure for side a and side b from the room text of the two things; keep these on the host and never put them in a research query.',
});

// the framework node ids a thing has a USES_FRAMEWORK edge to
function frameworksByThing(substrate) {
  const out = {};
  const fnodes = (substrate && substrate.framework_nodes) || {};
  ((substrate && substrate.edges) || []).forEach(function (e) {
    if (!e || e.type !== 'USES_FRAMEWORK' || !fnodes[e.target]) return;
    if (!out[e.source]) out[e.source] = [];
    if (out[e.source].indexOf(e.target) === -1) out[e.source].push(e.target);
  });
  return out;
}

/**
 * recallCandidates(substrate, roomDir, budgets) -> { candidates, counts, pairs_truncated, couplings }
 *   candidates: the eureka row shape, lane `structural` added, plus shared_frameworks (framework node ids).
 */
function lexicalQuantile(values, q) {
  const v = values.filter(Number.isFinite).sort(function (x, y) { return x - y; });
  if (!v.length) return NaN;
  const pos = (v.length - 1) * Math.min(1, Math.max(0, q));
  const lo = Math.floor(pos); const hi = Math.ceil(pos);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
}

function lexicalPercentile(values, x) {
  const v = values.filter(Number.isFinite);
  if (!v.length || !Number.isFinite(x)) return 0;
  let less = 0; let equal = 0;
  v.forEach(function (y) { if (y < x) less += 1; else if (y === x) equal += 1; });
  return (less + 0.5 * equal) / v.length;
}

function recallCandidates(substrate, roomDir, budgets) {
  const B = Object.assign({}, BUDGETS, budgets || {});
  const cap = Number.isFinite(B.max_candidates) && B.max_candidates >= 0 ? Math.floor(B.max_candidates) : BUDGETS.max_candidates;
  // The pool is the eureka recall at the eureka cap; this module's own cap is applied after the filter.
  const pool = eurekaRecall.recallCandidates(substrate, roomDir, { max_candidates: eurekaRecall.BUDGETS.max_candidates });
  const fw = frameworksByThing(substrate);
  let droppedLexical = 0;
  let droppedNoSignal = 0;
  const signalled = [];
  pool.candidates.forEach(function (c) {
    const fa = fw[c.a] || []; const fb = fw[c.b] || [];
    const sharedFw = fa.filter(function (id) { return fb.indexOf(id) !== -1; }).sort();
    const entities = Array.isArray(c.shared_entities) ? c.shared_entities : [];
    const signal = entities.length + sharedFw.length;
    if (signal === 0) { droppedNoSignal += 1; return; }
    signalled.push({ c: c, sharedFw: sharedFw, signal: signal, entities: entities });
  });
  // Effective lexical ceiling: the fixed ceiling, tightened (never loosened) by the pool percentile when asked.
  const lexVals = signalled.map(function (x) { return x.c.lexical; });
  let ceiling = B.lexical_ceiling;
  let lexMode = 'fixed';
  if (B.lexical_mode === 'percentile' && lexVals.filter(Number.isFinite).length >= B.lexical_min_pool) {
    const qv = lexicalQuantile(lexVals, B.lexical_percentile);
    if (Number.isFinite(qv)) { ceiling = Math.min(B.lexical_ceiling, qv); lexMode = 'percentile'; }
  }
  const kept = [];
  signalled.forEach(function (x) {
    const c = x.c;
    if (c.lexical > ceiling) { droppedLexical += 1; return; }
    const row = Object.assign({}, c, { lanes: (c.lanes || []).slice(), shared_entities: x.entities.slice() });
    if (row.lanes.indexOf('structural') === -1) row.lanes.push('structural');
    row.shared_frameworks = x.sharedFw;
    row._signal = x.signal;
    row.lexical_percentile = lexicalPercentile(lexVals, c.lexical);
    kept.push(row);
  });
  // Most relational signal first; among equals the pair with the LEAST shared wording first (2026), then ids.
  kept.sort(function (x, y) {
    const lx = Number.isFinite(x.lexical) ? x.lexical : 1; const ly = Number.isFinite(y.lexical) ? y.lexical : 1;
    return (y._signal - x._signal) || (lx - ly) || (x.a < y.a ? -1 : (x.a > y.a ? 1 : 0)) || (x.b < y.b ? -1 : (x.b > y.b ? 1 : 0));
  });
  const truncated = Math.max(0, kept.length - cap);
  const list = kept.slice(0, cap);
  list.forEach(function (r) { delete r._signal; });
  const counts = {
    things: pool.counts.things,
    sections: pool.counts.sections,
    canon_resolved: pool.counts.canon_resolved,
    known_pairs: pool.counts.known_pairs,
    excluded_known: pool.counts.excluded_known,
    eureka_pool: pool.candidates.length,
    dropped_no_relational_signal: droppedNoSignal,
    dropped_lexical_above_ceiling: droppedLexical,
    structural: kept.length,
    candidates: list.length,
    lexical_mode: lexMode,
    lexical_ceiling_used: ceiling,
  };
  return { candidates: list, counts: counts, pairs_truncated: truncated, couplings: pool.couplings };
}

// ---------------------------------------------------------------------------
// run files (shared helpers; the run root is this perspective's own)
// ---------------------------------------------------------------------------
function runDirFor(roomDir, tag) { return shared.runDirFor(roomDir, RUN_ROOT, tag); }

function writeRunFiles(roomDir, tag, substrate, recall) {
  return shared.writeRunFiles(roomDir, RUN_ROOT, tag, substrate, recall, { title: STATUS_TITLE, lanes: RUN_LANES.slice() });
}

function readCandidates(roomDir, tag) { return shared.readCandidates(roomDir, RUN_ROOT, tag); }

// ---------------------------------------------------------------------------
// the question set the planner consumes
// ---------------------------------------------------------------------------
// The term gate and the SEED-104 abstraction live in eureka's questionSetFor; the pair leaves are taken
// from it (one copy of that logic) and re-dimensioned onto the analogies template. The leaves carry only
// short terms, never SAPPhIRE content.
function questionSetFor(recall, substrate, opts) {
  const o = opts || {};
  const maxLeaves = o.max_leaves || BUDGETS.max_leaves;
  const tag = typeof o.tag === 'string' && o.tag ? o.tag : shared.runTagNow(o.now);
  const base = eurekaRecall.questionSetFor(recall, substrate, { max_leaves: maxLeaves, tag: tag });
  if (!base || !Array.isArray(base.leaves)) throw new Error('analogies-recall: eureka questionSetFor returned no leaves');
  const byPair = {};
  recall.candidates.forEach(function (c) { byPair[c.a + '\u0000' + c.b] = c; });
  const leaves = [];
  base.leaves.filter(function (l) { return l.pair; }).forEach(function (l, i) {
    const c = byPair[l.pair.a + '\u0000' + l.pair.b];
    const out = Object.assign({}, l, {
      id: 'an-' + (i + 1),
      question: 'Does the function and behavior behind "' + (c ? c.title_a : l.pair.a) + '" (' + (c ? c.section_a : '') + ') transfer to "' + (c ? c.title_b : l.pair.b) + '" (' + (c ? c.section_b : '') + '), given the structures on each side?',
      dimension: 'an:structural_transfer',
      lens: 'an.structure',
      falsifier: { text: FALSIFIER },
      pair: { a: l.pair.a, b: l.pair.b, perspective: ID, run_tag: tag },
    });
    leaves.push(out);
  });
  leaves.push({
    id: 'an-known',
    question: 'Which of these pairs does the room already compare under other words?',
    origin: 'framework_dimension',
    dimension: 'an:already_known',
    lens: 'an.known',
    researchable: true,
    falsifier: { text: 'A room artifact that already draws the analogy.' },
    corpus: 'room',
  });
  const secs = recall.candidates.slice(0, maxLeaves).map(function (c) { return c.section_a + ' and ' + c.section_b; });
  const nThings = (substrate.things || []).length; const nSections = (substrate.sections || []).length;
  return {
    schema: base.schema,
    template_id: TEMPLATE_ID,
    command: COMMAND,
    stated_question: 'Which pairs in this room share a structure without sharing words, and does the function and behavior of one transfer to the other?',
    scqa: {
      situation: 'The room holds ' + nThings + ' things across ' + nSections + ' sections; ' + recall.candidates.length + ' cross-section pairs share structure but not wording.',
      complication: 'Shared structure is not shared function, and the room may already draw the analogy under other words.',
      question: 'Which of the recalled pairs transfer function and behavior across their structures, and is that documented outside the room?',
    },
    key_line: [
      { id: 'k1', label: 'Structural transfer', dimension: 'an:structural_transfer' },
      { id: 'k2', label: 'Already known', dimension: 'an:already_known' },
    ],
    leaves: leaves,
    sections_spanned: Array.from(new Set(secs)),
    mode_hint: 'quick',
  };
}

// ---------------------------------------------------------------------------
// runRecall: the whole stage 01 + 02 pass for one room, read-only on room.db
// ---------------------------------------------------------------------------
function runRecall(roomDir, opts) {
  const o = opts || {};
  const resolved = path.resolve(roomDir);
  const db = navigation.openRoomDbReadOnlyForCaller(resolved);
  let substrate; let recall;
  try {
    substrate = eurekaRecall.buildSubstrate(db, Object.assign({}, o, { roomDir: resolved }));
    recall = recallCandidates(substrate, resolved, o.budgets || {});
  } finally {
    try { db.close(); } catch (_e) { /* read-only handle */ }
  }
  const tag = o.tag || shared.runTagNow(o.now);
  const dir = writeRunFiles(resolved, tag, substrate, recall);
  const qs = questionSetFor(recall, substrate, Object.assign({}, o, { tag: tag }));
  return { ok: true, tag: tag, run_dir: dir, counts: recall.counts, pairs_truncated: recall.pairs_truncated, couplings: recall.couplings, candidates: recall.candidates, question_set: qs, statement_template: STATEMENT_TEMPLATE };
}

module.exports = {
  ID: ID,
  TEMPLATE_ID: TEMPLATE_ID,
  COMMAND: COMMAND,
  LENSES: LENSES,
  FALSIFIER: FALSIFIER,
  RUN_ROOT: RUN_ROOT,
  BUDGETS: BUDGETS,
  STAGE_A_LANES: STAGE_A_LANES,
  STATUS_TITLE: STATUS_TITLE,
  STATEMENT_TEMPLATE: STATEMENT_TEMPLATE,
  recallCandidates: recallCandidates,
  writeRunFiles: writeRunFiles,
  readCandidates: readCandidates,
  runDirFor: runDirFor,
  questionSetFor: questionSetFor,
  runRecall: runRecall,
};
