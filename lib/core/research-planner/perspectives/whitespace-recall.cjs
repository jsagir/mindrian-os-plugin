'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 366 plan 14 (D-06, EPV366-07): the whitespace perspective recall.
 *
 * Whitespace gets the same shape as eureka on its SHIPPED template (the
 * `whitespace` template of question-templates.cjs and its ws.* lenses; no new
 * template). Recall is local and offline: it reads room.db through the same
 * read-only door as eureka and reaches nothing else. Any web reach is a planner
 * query under a grant.
 *
 * Two lanes, both about borders of emptiness:
 *   zone_border      a WhitespaceZone borders things (WHITESPACE_DETECTED edges, zone -> artifact);
 *                    pair the most central bordering thing of each two bordering sections.
 *   declared_unlinked two sections the ICM declares coupled (CONTEXT.md "## Inputs") that no edge
 *                    joins; pair the most central thing of each.
 *
 * Every pair goes through shared.makeCandidateStore (the one exclusion set), so a pair the room
 * already connects, or already holds as the evidence of an opportunity, is dropped and counted.
 *
 * SEED-104 (the egain-des-liquid-conductor false negative): a long exact-phrase query returns a
 * meaningless 0 that reads as "gap confirmed". This module never composes a room-coverage phrase.
 * Plan 369.2-04 (ruling 2026-10-05, "and all"): a zone name is offered as the ws:gap_claim web slot under
 * the web rule (families.composableQuery, cap 200); the four-word cap is gone. Shaping a long phrase so it
 * does not guarantee a zero is plan 369.2-21's job, for every web slot. A name the web rule refuses (empty,
 * over 200 characters, a control character) is answered from the room only. The room-coverage leaf (ws:extraction_failure) carries no slots at all; the
 * planner's local check matches on tokens, not on a phrase.
 *
 * Plan 366-08 owns the substrate and the exclusion set. This module consumes them and edits neither
 * eureka-recall.cjs nor shared.cjs. Hyphens only.
 */

const path = require('node:path');

const navigation = require('../../navigation.cjs');
const eurekaRecall = require('./eureka-recall.cjs');
const shared = require('./shared.cjs');

const SCHEMA_QS = 'mos.research-question-set/1';
const ID = 'whitespace';
const TEMPLATE_ID = 'whitespace';
const COMMAND = '/mos:whitespace';
// The ws.* lenses the shipped whitespace template uses.
const LENSES = Object.freeze(['ws.gap', 'ws.covered_elsewhere', 'ws.extraction']);
// The ws:gap_claim falsifier text of the shipped template.
const FALSIFIER = 'Any peer-reviewed work that addresses the zone directly.';
const RUN_ROOT = path.join('.mindrian', 'perspectives', 'whitespace');
const STATUS_TITLE = 'Whitespace perspective run';
const BUDGETS = Object.freeze({ max_candidates: 100, max_leaves: 8, max_term_words: 4 });
const STAGE_A_LANES = Object.freeze(['zone_border', 'declared_unlinked']);
const RUN_LANES = STAGE_A_LANES;

const NOT_RESEARCHABLE_ZONE_TERM = 'No search phrase could be formed from this zone\'s name (empty, over 200 characters, or a control character), so it is answered from the room only.';
const NOT_RESEARCHABLE_UNLINKED = 'A declared section coupling that no edge joins is a gap in the room, not a literature claim; it has no zone term to search, so it is answered from the room only.';

// the most central thing of a list: highest degree, ties by id
function mostCentral(list) {
  let best = null;
  list.forEach(function (t) {
    if (!best || t.degree > best.degree || (t.degree === best.degree && t.id < best.id)) best = t;
  });
  return best;
}

function bySection(thingList) {
  const out = {};
  thingList.forEach(function (t) { if (!out[t.section]) out[t.section] = []; out[t.section].push(t); });
  return out;
}

/**
 * recallCandidates(substrate, roomDir, budgets) -> { candidates, counts, pairs_truncated, couplings }
 *   candidates: shared row shape plus zone_id on zone_border rows.
 */
function recallCandidates(substrate, roomDir, budgets) {
  const B = Object.assign({}, BUDGETS, budgets || {});
  const things = substrate.things;
  const thingById = {};
  things.forEach(function (t) { thingById[t.id] = t; });
  const store = shared.makeCandidateStore(substrate);
  const counts = { things: things.length, sections: substrate.sections.length, canon_resolved: things.filter(function (t) { return !!t.canon_handle; }).length, known_pairs: substrate.connected.size + substrate.opp_pairs.size, zone_border: 0, declared_unlinked: 0, excluded_known: 0 };

  // lane zone_border: WHITESPACE_DETECTED rows run zone -> artifact; a reversed row is read the same way.
  Object.keys(substrate.whitespace_zones).sort().forEach(function (zid) {
    const bordering = [];
    substrate.edges.forEach(function (e) {
      if (e.type !== 'WHITESPACE_DETECTED') return;
      const other = e.source === zid ? e.target : (e.target === zid ? e.source : null);
      if (other && thingById[other] && bordering.indexOf(thingById[other]) === -1) bordering.push(thingById[other]);
    });
    const groups = bySection(bordering);
    const secs = Object.keys(groups).sort();
    for (let i = 0; i < secs.length; i += 1) for (let j = i + 1; j < secs.length; j += 1) {
      const ta = mostCentral(groups[secs[i]]); const tb = mostCentral(groups[secs[j]]);
      if (ta && tb && store.upsert(ta.id, tb.id, 'zone_border', { fields: { zone_id: zid } })) counts.zone_border += 1;
    }
  });

  // lane declared_unlinked: a declared coupling with zero edges between things of the two sections.
  const couplings = eurekaRecall.declaredCouplings(roomDir, substrate.sections);
  const sectionOf = {};
  things.forEach(function (t) { sectionOf[t.id] = t.section; });
  const groupsAll = bySection(things);
  Array.from(couplings).sort().forEach(function (k) {
    const secs = k.split('\u0000');
    const sa = secs[0]; const sb = secs[1];
    if (!groupsAll[sa] || !groupsAll[sb]) return;
    const joined = substrate.edges.some(function (e) {
      const x = sectionOf[e.source]; const y = sectionOf[e.target];
      return (x === sa && y === sb) || (x === sb && y === sa);
    });
    if (joined) return;
    const ta = mostCentral(groupsAll[sa]); const tb = mostCentral(groupsAll[sb]);
    if (ta && tb && store.upsert(ta.id, tb.id, 'declared_unlinked', {})) counts.declared_unlinked += 1;
  });

  counts.excluded_known = store.excludedKnown();
  let list = store.rows();
  list.sort(function (x, y) {
    return (y.lanes.length - x.lanes.length)
      || ((x.zone_id ? 0 : 1) - (y.zone_id ? 0 : 1))
      || (x.a < y.a ? -1 : (x.a > y.a ? 1 : 0))
      || (x.b < y.b ? -1 : (x.b > y.b ? 1 : 0));
  });
  const truncated = Math.max(0, list.length - B.max_candidates);
  list = list.slice(0, B.max_candidates);
  counts.candidates = list.length;
  return { candidates: list, counts: counts, pairs_truncated: truncated, couplings: Array.from(couplings).map(function (k) { return k.split('\u0000'); }) };
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
// zoneTerm(substrate, zoneId) -> a web phrase from the zone's own name (web rule, cap 200), or null.
function zoneTerm(substrate, zoneId, _maxWords) {
  const z = substrate.whitespace_zones && substrate.whitespace_zones[zoneId];
  if (!z) return null;
  // 369.2-04 (ruling 2026-10-05): the web rule only; the four-word cap (BUDGETS.max_term_words, kept for
  // compatibility) guarded the strict Theo term rule and a zone named by a sentence is a valid web phrase.
  return eurekaRecall._test.slotTerm(z.title);
}

function questionSetFor(recall, substrate, opts) {
  const o = opts || {};
  const maxLeaves = o.max_leaves || BUDGETS.max_leaves;
  const maxWords = o.max_term_words || BUDGETS.max_term_words;
  const tag = typeof o.tag === 'string' && o.tag ? o.tag : shared.runTagNow(o.now);
  const leaves = [];
  let firstTerm = null;
  recall.candidates.slice(0, maxLeaves).forEach(function (c, i) {
    const pair = { a: c.a, b: c.b, perspective: ID, run_tag: tag };
    const zone = c.zone_id && substrate.whitespace_zones ? substrate.whitespace_zones[c.zone_id] : null;
    const question = zone
      ? 'Is the zone "' + zone.title + '" between ' + c.section_a + ' and ' + c.section_b + ' empty in the literature, or only in your room?'
      : 'The room declares ' + c.section_a + ' and ' + c.section_b + ' coupled but joins them by no edge: is the gap only in your room?';
    const term = c.zone_id ? zoneTerm(substrate, c.zone_id, maxWords) : null;
    if (!term) {
      leaves.push({
        id: 'ws-' + (i + 1),
        question: question,
        origin: 'framework_dimension',
        dimension: 'ws:gap_claim',
        lens: 'ws.gap',
        researchable: false,
        not_researchable_reason: c.zone_id ? NOT_RESEARCHABLE_ZONE_TERM : NOT_RESEARCHABLE_UNLINKED,
        falsifier: { text: FALSIFIER },
        corpus: 'room',
        pair: pair,
        lanes: c.lanes.slice(),
      });
      return;
    }
    if (!firstTerm) firstTerm = term;
    leaves.push({
      id: 'ws-' + (i + 1),
      question: question,
      origin: 'framework_dimension',
      dimension: 'ws:gap_claim',
      lens: 'ws.gap',
      researchable: true,
      falsifier: { text: FALSIFIER },
      corpus: 'openalex',
      slots: { term: term },
      pair: pair,
      lanes: c.lanes.slice(),
    });
  });
  const keyLine = [{ id: 'k1', label: 'Gap claim', dimension: 'ws:gap_claim' }];
  if (firstTerm) {
    leaves.push({
      id: 'ws-covered',
      question: 'Is the same problem studied under a neighboring term?',
      origin: 'framework_dimension',
      dimension: 'ws:covered_elsewhere',
      lens: 'ws.covered_elsewhere',
      researchable: true,
      falsifier: { text: 'Work under another term that answers the same question.' },
      corpus: 'openalex',
      slots: { term: firstTerm },
    });
    keyLine.push({ id: 'k2', label: 'Covered under another term', dimension: 'ws:covered_elsewhere' });
  }
  leaves.push({
    id: 'ws-extraction',
    question: 'Does the room already hold these zones under other words?',
    origin: 'framework_dimension',
    dimension: 'ws:extraction_failure',
    lens: 'ws.extraction',
    researchable: true,
    falsifier: { text: 'A room artifact that already covers the zone.' },
    corpus: 'room',
    slots: {},
  });
  keyLine.push({ id: 'k3', label: 'Extraction failure', dimension: 'ws:extraction_failure' });
  const secs = recall.candidates.slice(0, maxLeaves).map(function (c) { return c.section_a + ' and ' + c.section_b; });
  return {
    schema: SCHEMA_QS,
    template_id: TEMPLATE_ID,
    command: COMMAND,
    stated_question: 'Which gaps in this room are missing from the literature too, and which are only missing from the room?',
    scqa: {
      situation: 'The room holds ' + substrate.things.length + ' things across ' + substrate.sections.length + ' sections; ' + recall.candidates.length + ' pairs sit on a whitespace border or an unlinked declared coupling.',
      complication: 'An empty search is not a confirmed gap, and the room may already hold the zone under other words.',
      question: 'For each border pair, is the zone empty in the literature, or only in the room?',
    },
    key_line: keyLine,
    leaves: leaves,
    coverage_notes: [{ dimension: 'ws:irrelevant', not_researchable_reason: 'Whether the zone is worth filling at all is navigator judgment, not a literature question.' }],
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
  recallCandidates: recallCandidates,
  writeRunFiles: writeRunFiles,
  readCandidates: readCandidates,
  runDirFor: runDirFor,
  questionSetFor: questionSetFor,
  runRecall: runRecall,
};
