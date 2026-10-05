'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 366 plan 13 (D-08, EPV366-06): the HSI perspective (hidden in plain
 * sight: two parts of the room that are close in structure and far in words),
 * stages 01 (substrate) and 02 (recall), re-derived from the room's local graph.
 *
 * WHAT IT DOES. Reads the bound room's local graph and proposes cross-section
 * pairs whose WORD overlap and GRAPH overlap disagree. It never embeds, never
 * calls a model, never reaches the network. The legacy HSI engine stays
 * untouched; the spike measures this module against it (D-08).
 *
 * THE TWO LEGS.
 *   lexical     Jaccard over the stopword-stripped tokens of the two things (title and body, body capped);
 *   relational  Jaccard over each thing's graph neighbor set: the entity nodes it DESCRIBES, the framework
 *               nodes it USES_FRAMEWORK, and one pseudo-neighbor "section:<slug>" for every section its own
 *               section is declared-coupled to, so two things share a pseudo-neighbor only when their sections
 *               feed or are fed by a common third section.
 * divergence = relational minus lexical. A pair is ranked by the size of that gap, top-K per thing, with no
 * absolute floor. The direction label of every row comes ONLY from
 * direction-convention.classifyGraph(lexical, relational): this module holds no comparison-to-label code
 * (leg H of test-355-direction-agreement) and no label literal of its own.
 *
 * TWO RECALL LANES, both local:
 *   relational   the relational leg is above zero;
 *   lexical      the lexical leg is above zero.
 *
 * THE EXCLUSION SET (ADR-E14): the one shared makeCandidateStore drops a pair the room already connects, or
 * already holds as the evidence of an opportunity, and counts it. This module never rebuilds that check.
 *
 * EDIT SURFACES (ICM invariant 6): each stage writes one plain file under
 * <room>/.mindrian/perspectives/hsi/<tag>/NN_stage/output/ through shared.writeRunFiles. Delete a line in
 * candidates.jsonl and the next stage judges what is left. STATUS.md is derived and never hand-edited.
 *
 * Part 8: nothing here egresses. The question set carries room titles for the navigator's plan card; only the
 * composed query slots (short terms through slotTerm) can ever leave, and the planner audits every one of them.
 *
 * Reads go through the navigation door (openRoomDbReadOnlyForCaller). This module writes nothing to room.db.
 * Hyphens only.
 */

const path = require('node:path');

const navigation = require('../../navigation.cjs');
const directionConvention = require('../../direction-convention.cjs');
const shared = require('./shared.cjs');
const eurekaRecall = require('./eureka-recall.cjs');

const ID = 'hsi';
const TEMPLATE_ID = 'hsi';
// The hsi template's one door (explicit_only): templateForCommand never routes to it,
// so this module sets template_id itself.
const COMMAND = '/mos:scout hsi';
const LENSES = Object.freeze(['hsi.diverge', 'hsi.known']);
// The hsi template's falsifier (question-templates HSI, dimension hsi:divergence).
const FALSIFIER = 'A source that already states this relationship in the room\'s own words, or shows the shared structure is coincidental.';
const RUN_ROOT = path.join('.mindrian', 'perspectives', 'hsi');
const BUDGETS = Object.freeze({ max_candidates: 200, max_leaves: 8, per_thing_top_k: 5, body_cap: 2000 });
const STAGE_A_LANES = Object.freeze(['relational', 'lexical']);
const STATUS_TITLE = 'HSI perspective run';
const SCHEMA_QS = 'mos.research-question-set/1';

function round4(x) { return Math.round(x * 10000) / 10000; }

// ---------------------------------------------------------------------------
// the relational leg: neighbor sets from the graph
// ---------------------------------------------------------------------------
function neighborSets(substrate, couplings) {
  const byId = {};
  substrate.things.forEach(function (t) { byId[t.id] = t; });
  const nb = {};
  substrate.things.forEach(function (t) { nb[t.id] = new Set(); });
  substrate.edges.forEach(function (e) {
    if (e.type === 'DESCRIBES') {
      if (byId[e.source] && substrate.entities[e.target]) nb[e.source].add(e.target);
      if (byId[e.target] && substrate.entities[e.source]) nb[e.target].add(e.source);
    } else if (e.type === 'USES_FRAMEWORK') {
      if (byId[e.source] && substrate.framework_nodes[e.target]) nb[e.source].add(e.target);
    }
  });
  // declared couplings as pseudo-neighbors: section:<X> for each X the thing's section is coupled to
  const coupledTo = {};
  couplings.forEach(function (k) {
    const p = k.split('\u0000');
    (coupledTo[p[0]] = coupledTo[p[0]] || []).push(p[1]);
    (coupledTo[p[1]] = coupledTo[p[1]] || []).push(p[0]);
  });
  substrate.things.forEach(function (t) {
    (coupledTo[t.section] || []).forEach(function (x) { nb[t.id].add('section:' + x); });
  });
  return nb;
}

// ---------------------------------------------------------------------------
// 02 recall
// ---------------------------------------------------------------------------
function recallCandidates(substrate, roomDir, budgets) {
  const B = Object.assign({}, BUDGETS, budgets || {});
  const things = substrate.things.slice().sort(function (x, y) { return x.id < y.id ? -1 : (x.id > y.id ? 1 : 0); });
  const couplings = eurekaRecall.declaredCouplings(roomDir, substrate.sections);
  const nb = neighborSets(substrate, couplings);
  const store = shared.makeCandidateStore(substrate);
  const counts = { things: things.length, sections: substrate.sections.length, known_pairs: substrate.connected.size + substrate.opp_pairs.size, relational: 0, lexical: 0, excluded_known: 0 };

  const proposed = new Set();
  things.forEach(function (t) {
    const scored = [];
    things.forEach(function (u) {
      if (u.id === t.id || u.section === t.section) return;
      const lex = round4(shared.jaccard(t.tokens, u.tokens));
      const rel = round4(shared.jaccard(nb[t.id], nb[u.id]));
      if (lex <= 0 && rel <= 0) return;
      scored.push({ u: u, lex: lex, rel: rel, gap: Math.abs(round4(rel - lex)) });
    });
    scored.sort(function (x, y) { return (y.gap - x.gap) || (x.u.id < y.u.id ? -1 : 1); });
    scored.slice(0, B.per_thing_top_k).forEach(function (s) {
      const k = shared.pairKey(t.id, s.u.id);
      // the pair is seen from both ends; propose it once so the exclusion counter counts distinct pairs
      if (proposed.has(k)) return;
      proposed.add(k);
      const lanes = [];
      if (s.rel > 0) lanes.push('relational');
      if (s.lex > 0) lanes.push('lexical');
      const fields = { relational: s.rel, divergence: round4(s.rel - s.lex), direction: directionConvention.classifyGraph(s.lex, s.rel).label };
      store.upsert(t.id, s.u.id, lanes[0], { lexical: s.lex, fields: fields });
      // an excluded pair leaves no row: later lanes and entities must not recount it
      if (!store.get(t.id, s.u.id)) return;
      for (let i = 1; i < lanes.length; i += 1) store.upsert(t.id, s.u.id, lanes[i], { lexical: s.lex });
      Array.from(nb[t.id]).filter(function (n) { return nb[s.u.id].has(n) && substrate.entities[n]; }).sort().forEach(function (n) {
        store.upsert(t.id, s.u.id, null, { entity: substrate.entities[n].title });
      });
    });
  });

  counts.excluded_known = store.excludedKnown();
  let list = store.rows();
  list.sort(function (x, y) {
    return (Math.abs(y.divergence) - Math.abs(x.divergence)) || (y.lanes.length - x.lanes.length) || (x.a < y.a ? -1 : (x.a > y.a ? 1 : 0)) || (x.b < y.b ? -1 : (x.b > y.b ? 1 : 0));
  });
  const truncated = Math.max(0, list.length - B.max_candidates);
  list = list.slice(0, B.max_candidates);
  list.forEach(function (r) { STAGE_A_LANES.forEach(function (ln) { if (r.lanes.indexOf(ln) !== -1) counts[ln] += 1; }); });
  counts.candidates = list.length;
  return { candidates: list, counts: counts, pairs_truncated: truncated, couplings: Array.from(couplings).map(function (k) { return k.split('\u0000'); }) };
}

// ---------------------------------------------------------------------------
// run files (edit surfaces) and STATUS.md (derived)
// ---------------------------------------------------------------------------
function runDirFor(roomDir, tag) { return shared.runDirFor(roomDir, RUN_ROOT, tag); }

function writeRunFiles(roomDir, tag, substrate, recall) {
  return shared.writeRunFiles(roomDir, RUN_ROOT, tag, substrate, recall, { title: 'HSI perspective run', lanes: ['relational', 'lexical'], header_extra: { phrase_hash: directionConvention.GRAPH_PHRASE_HASH } });
}

function readCandidates(roomDir, tag) { return shared.readCandidates(roomDir, RUN_ROOT, tag); }

// ---------------------------------------------------------------------------
// the question set the planner consumes
// ---------------------------------------------------------------------------
function handlesByThingOf(substrate) {
  const out = {};
  Object.keys(substrate.entities).sort().forEach(function (eid) {
    const ent = substrate.entities[eid];
    if (!ent.title_from_field) return;
    Array.from(ent.things).forEach(function (tid) { (out[tid] = out[tid] || []).push(ent.title); });
  });
  return out;
}

function questionSetFor(recall, substrate, opts) {
  const o = opts || {};
  const maxLeaves = o.max_leaves || BUDGETS.max_leaves;
  const tag = typeof o.tag === 'string' && o.tag ? o.tag : shared.runTagNow(o.now);
  const byId = {};
  substrate.things.forEach(function (t) { byId[t.id] = t; });
  const handles = handlesByThingOf(substrate);
  const abstractTerm = eurekaRecall._test.abstractTerm;
  // the set holds at most max_leaves leaves in all: the hsi-known leaf takes one place
  const pairRows = recall.candidates.slice(0, Math.max(0, maxLeaves - 1));
  const leaves = [];
  pairRows.forEach(function (c, i) {
    const termA = abstractTerm(byId[c.a], handles, c.shared_entities);
    const termB = abstractTerm(byId[c.b], handles, c.shared_entities);
    const question = 'Do "' + c.title_a + '" (' + c.section_a + ') and "' + c.title_b + '" (' + c.section_b + ') share a structure the room has not put into words?';
    const pair = { a: c.a, b: c.b, perspective: 'hsi', run_tag: tag };
    if (!termA || !termB || termA.trim().toLowerCase() === termB.trim().toLowerCase()) {
      leaves.push({
        id: 'hsi-' + (i + 1), question: question, origin: 'framework_dimension', dimension: 'hsi:divergence', lens: 'hsi.diverge',
        researchable: false,
        not_researchable_reason: eurekaRecall._test.NOT_RESEARCHABLE_PAIR,
        falsifier: { text: FALSIFIER }, corpus: 'room', pair: pair, lanes: c.lanes.slice(),
      });
      return;
    }
    leaves.push({
      id: 'hsi-' + (i + 1), question: question, origin: 'framework_dimension', dimension: 'hsi:divergence', lens: 'hsi.diverge',
      researchable: true, falsifier: { text: FALSIFIER }, corpus: 'openalex',
      slots: { term: termA, term2: termB }, pair: pair, lanes: c.lanes.slice(),
    });
  });
  leaves.push({
    id: 'hsi-known', question: 'Does the room already connect these pairs under other words?', origin: 'framework_dimension',
    dimension: 'hsi:already_known', lens: 'hsi.known', researchable: true,
    falsifier: { text: 'A room artifact that already states the connection.' }, corpus: 'room',
  });
  const secs = pairRows.map(function (c) { return c.section_a + ' and ' + c.section_b; });
  return {
    schema: SCHEMA_QS,
    template_id: TEMPLATE_ID,
    command: COMMAND,
    stated_question: 'Which pairs in this room are close in structure and far in wording, and is that shared structure real?',
    scqa: {
      situation: 'The room holds ' + substrate.things.length + ' things across ' + substrate.sections.length + ' sections; ' + recall.candidates.length + ' cross-section pairs differ most between their word overlap and their graph overlap.',
      complication: 'A gap between wording and structure can be a hidden connection or a coincidence, and the room may already hold the connection under other words.',
      question: 'Which of these pairs share a structure that is documented outside the room?',
    },
    key_line: [
      { id: 'k1', label: 'Semantic divergence', dimension: 'hsi:divergence' },
      { id: 'k2', label: 'Already known', dimension: 'hsi:already_known' },
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
  const budgets = Object.assign({}, BUDGETS, o.budgets || {});
  const db = navigation.openRoomDbReadOnlyForCaller(resolved);
  let substrate; let recall;
  try {
    substrate = eurekaRecall.buildSubstrate(db, Object.assign({}, o, { roomDir: resolved, body_cap: budgets.body_cap }));
    recall = recallCandidates(substrate, resolved, budgets);
  } finally {
    try { db.close(); } catch (_e) { /* read-only handle */ }
  }
  const tag = o.tag || shared.runTagNow(o.now);
  const dir = writeRunFiles(resolved, tag, substrate, recall);
  const qs = questionSetFor(recall, substrate, Object.assign({}, o, { tag: tag }));
  return { ok: true, tag: tag, run_dir: dir, counts: recall.counts, pairs_truncated: recall.pairs_truncated, couplings: recall.couplings, candidates: recall.candidates, question_set: qs };
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
  runRecall: runRecall,
  readCandidates: readCandidates,
  runDirFor: runDirFor,
  questionSetFor: questionSetFor,
  _test: { neighborSets: neighborSets, recallCandidates: recallCandidates },
};
