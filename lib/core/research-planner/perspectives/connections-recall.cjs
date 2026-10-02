'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 366 plan 15 (D-09, D-11): the CONNECTIONS perspective, stages 01 (substrate)
 * and 02 (recall), for the one research planner.
 *
 * WHAT IT DOES. Reads the bound room's local graph and proposes pairs of things in
 * different sections whose canon framework names differ, so a lateral path between
 * those two canon frameworks is worth checking. Recall is fully local and offline:
 * it never reaches the network and never calls a model. The lateral-path check
 * itself is NOT here. It runs later, as an audited planner evidence lane under a
 * grant that names the Theo provider (lib/core/research-planner/theo-lane.cjs).
 *
 * TWO RECALL LANES, both local, both over the one substrate (366-08 contract):
 *   canon_pair      two things in different sections that BOTH carry a canon handle
 *                   and whose canon names differ (cap per thing, farthest sections
 *                   first, then ids);
 *   framework_walk  thing -> framework -> thing: two things in different sections
 *                   that USES_FRAMEWORK the same framework node (the rows of
 *                   substrate.edges whose target is a substrate.framework_nodes id).
 *
 * Every pair goes through shared.makeCandidateStore, the one exclusion-set upsert
 * (ADR-E14): a pair the room already connects, or already holds as opportunity
 * evidence, is dropped and counted. This module edits neither the eureka recall
 * module nor the shared helpers; it consumes their exports.
 *
 * QUESTION SET. Each lateral leaf carries corpus theo, slots {term: canon_a,
 * term2: canon_b} (canon framework names, never room text) and the closed pair. One
 * local leaf asks whether the room already connects the frameworks.
 *
 * Part 8: nothing here egresses. Reads go through the navigation door (read only).
 * Hyphens only.
 */

const path = require('node:path');

const navigation = require('../../navigation.cjs');
const families = require('../families.cjs');
const shared = require('./shared.cjs');
const eurekaRecall = require('./eureka-recall.cjs');

const SCHEMA_QS = 'mos.research-question-set/1';
const ID = 'connections';
const TEMPLATE_ID = 'connections';
const COMMAND = '/mos:find-connections';
const LENSES = Object.freeze(['cn.lateral', 'cn.known']);
const RUN_ROOT = path.join('.mindrian', 'perspectives', 'connections');
const FALSIFIER = 'No lateral path exists between the two canon frameworks, or the path runs only through generic hubs.';
const BUDGETS = Object.freeze({ max_candidates: 100, max_leaves: 8, per_thing_top_k: 5 });
const STAGE_A_LANES = Object.freeze(['canon_pair', 'framework_walk']);
const STATUS_TITLE = 'Connections perspective run';

// ---------------------------------------------------------------------------
// 01 substrate: the one eureka substrate reader (eight-key contract)
// ---------------------------------------------------------------------------
function buildSubstrate(db, opts) { return eurekaRecall.buildSubstrate(db, opts); }

// ---------------------------------------------------------------------------
// 02 recall
// ---------------------------------------------------------------------------
function sectionIndexOf(sections) {
  const ix = {};
  sections.forEach(function (s, i) { ix[s] = i; });
  return ix;
}

// allPairs(items, ix) -> every cross-section pair of items, farthest sections
// first (a lateral pair is more interesting across distant domains), then ids.
function allPairs(items, ix, accept) {
  const out = [];
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const t = items[i]; const u = items[j];
      if (t.section === u.section) continue;
      if (accept && !accept(t, u)) continue;
      const first = t.id < u.id ? t : u;
      const second = t.id < u.id ? u : t;
      out.push({ first: first, second: second, dist: Math.abs((ix[t.section] || 0) - (ix[u.section] || 0)) });
    }
  }
  out.sort(function (x, y) { return (y.dist - x.dist) || (x.first.id < y.first.id ? -1 : (x.first.id > y.first.id ? 1 : 0)) || (x.second.id < y.second.id ? -1 : (x.second.id > y.second.id ? 1 : 0)); });
  return out;
}

/**
 * recallCandidates(substrate, roomDir, budgets) -> { candidates, counts, pairs_truncated, couplings }
 *   candidates: shared row keys plus canon_a, canon_b (canon names of the ids' order a, b)
 *   and, for framework_walk, via_framework (the shared framework's name).
 */
function recallCandidates(substrate, _roomDir, budgets) {
  const B = Object.assign({}, BUDGETS, budgets || {});
  const things = substrate.things.slice().sort(function (x, y) { return x.id < y.id ? -1 : (x.id > y.id ? 1 : 0); });
  const store = shared.makeCandidateStore(substrate);
  const ix = sectionIndexOf(substrate.sections);
  const counts = {
    things: things.length,
    sections: substrate.sections.length,
    canon_resolved: things.filter(function (t) { return !!t.canon_handle; }).length,
    known_pairs: substrate.connected.size + substrate.opp_pairs.size,
    canon_pair: 0,
    framework_walk: 0,
    excluded_known: 0,
  };
  function isKnown(a, b) {
    const k = shared.pairKey(a, b);
    return substrate.connected.has(k) || substrate.opp_pairs.has(k);
  }

  // lane 1: canon_pair, a per-thing cap counted over both endpoints
  const withCanon = things.filter(function (t) { return !!t.canon_handle; });
  const used = {};
  allPairs(withCanon, ix, function (t, u) { return t.canon_handle !== u.canon_handle; }).forEach(function (p) {
    if (isKnown(p.first.id, p.second.id)) { store.upsert(p.first.id, p.second.id, 'canon_pair', {}); return; }
    if ((used[p.first.id] || 0) >= B.per_thing_top_k || (used[p.second.id] || 0) >= B.per_thing_top_k) return;
    const made = store.upsert(p.first.id, p.second.id, 'canon_pair', { fields: { canon_a: p.first.canon_handle, canon_b: p.second.canon_handle } });
    if (made) {
      counts.canon_pair += 1;
      used[p.first.id] = (used[p.first.id] || 0) + 1;
      used[p.second.id] = (used[p.second.id] || 0) + 1;
    }
  });

  // lane 2: framework_walk, thing -> framework -> thing over USES_FRAMEWORK rows
  const frameworkOf = {};
  substrate.edges.forEach(function (e) {
    if (e.type === 'USES_FRAMEWORK' && substrate.framework_nodes[e.target] && frameworkOf[e.source] === undefined) frameworkOf[e.source] = e.target;
  });
  const byFramework = {};
  things.forEach(function (t) {
    const f = frameworkOf[t.id];
    if (!f) return;
    if (!byFramework[f]) byFramework[f] = [];
    byFramework[f].push(t);
  });
  const usedWalk = {};
  Object.keys(byFramework).sort().forEach(function (f) {
    const name = substrate.framework_nodes[f].name;
    allPairs(byFramework[f], ix, null).forEach(function (p) {
      if (isKnown(p.first.id, p.second.id)) { store.upsert(p.first.id, p.second.id, 'framework_walk', {}); return; }
      if ((usedWalk[p.first.id] || 0) >= B.per_thing_top_k || (usedWalk[p.second.id] || 0) >= B.per_thing_top_k) return;
      const made = store.upsert(p.first.id, p.second.id, 'framework_walk', {
        fields: { canon_a: p.first.canon_handle || null, canon_b: p.second.canon_handle || null, via_framework: name },
      });
      if (made) {
        counts.framework_walk += 1;
        usedWalk[p.first.id] = (usedWalk[p.first.id] || 0) + 1;
        usedWalk[p.second.id] = (usedWalk[p.second.id] || 0) + 1;
      }
    });
  });

  counts.excluded_known = store.excludedKnown();
  const secIx = ix;
  let list = store.rows();
  list.forEach(function (c) {
    if (c.canon_a === undefined) c.canon_a = null;
    if (c.canon_b === undefined) c.canon_b = null;
  });
  list.sort(function (x, y) {
    const dx = Math.abs((secIx[x.section_a] || 0) - (secIx[x.section_b] || 0));
    const dy = Math.abs((secIx[y.section_a] || 0) - (secIx[y.section_b] || 0));
    return (y.lanes.length - x.lanes.length) || (dy - dx) || (x.a < y.a ? -1 : (x.a > y.a ? 1 : 0)) || (x.b < y.b ? -1 : (x.b > y.b ? 1 : 0));
  });
  const total = list.length;
  const truncated = Math.max(0, total - B.max_candidates);
  list = list.slice(0, B.max_candidates);
  counts.candidates = list.length;
  return { candidates: list, counts: counts, pairs_truncated: truncated, couplings: [] };
}

// ---------------------------------------------------------------------------
// run files (edit surfaces) and STATUS.md (derived)
// ---------------------------------------------------------------------------
function runDirFor(roomDir, tag) { return shared.runDirFor(roomDir, RUN_ROOT, tag); }

function writeRunFiles(roomDir, tag, substrate, recall) {
  return shared.writeRunFiles(roomDir, RUN_ROOT, tag, substrate, recall, { title: STATUS_TITLE, lanes: STAGE_A_LANES.slice() });
}

function readCandidates(roomDir, tag) { return shared.readCandidates(roomDir, RUN_ROOT, tag); }

// ---------------------------------------------------------------------------
// the question set the planner consumes
// ---------------------------------------------------------------------------
// canonSlot(name) -> the canon framework name when it is a clean composable term, else null.
function canonSlot(name) {
  if (typeof name !== 'string' || !name.trim()) return null;
  const t = families.composableTerm(name.trim());
  return t === name.trim() ? t : null;
}

function questionSetFor(recall, substrate, opts) {
  const o = opts || {};
  const maxLeaves = o.max_leaves || BUDGETS.max_leaves;
  const tag = typeof o.tag === 'string' && o.tag ? o.tag : shared.runTagNow(o.now);
  // a lateral leaf needs two clean, distinct canon names; nothing else may ride a slot
  const eligible = recall.candidates.filter(function (c) {
    const a = canonSlot(c.canon_a); const b = canonSlot(c.canon_b);
    return !!a && !!b && a !== b;
  }).slice(0, maxLeaves);
  const leaves = eligible.map(function (c, i) {
    return {
      id: 'cn-' + (i + 1),
      question: 'Is there a documented lateral path between the frameworks behind "' + c.title_a + '" (' + c.section_a + ') and "' + c.title_b + '" (' + c.section_b + '), beyond generic hubs?',
      origin: 'framework_dimension',
      dimension: 'cn:lateral_path',
      lens: 'cn.lateral',
      researchable: true,
      falsifier: { text: FALSIFIER },
      corpus: 'theo',
      slots: { term: c.canon_a, term2: c.canon_b },
      pair: { a: c.a, b: c.b, perspective: 'connections', run_tag: tag },
      lanes: c.lanes.slice(),
    };
  });
  leaves.push({
    id: 'cn-known',
    question: 'Which of these framework pairs does the room already connect under other words?',
    origin: 'framework_dimension',
    dimension: 'cn:already_known',
    lens: 'cn.known',
    researchable: true,
    falsifier: { text: 'A room artifact that already states the connection.' },
    corpus: 'room',
  });
  const secs = eligible.map(function (c) { return c.section_a + ' and ' + c.section_b; });
  return {
    schema: SCHEMA_QS,
    template_id: TEMPLATE_ID,
    command: COMMAND,
    stated_question: 'Which pairs of canon frameworks in this room have a real lateral path between them that nobody has connected yet?',
    scqa: {
      situation: 'The room holds ' + substrate.things.length + ' things across ' + substrate.sections.length + ' sections; ' + recall.candidates.length + ' pairs carry canon framework names that are not yet connected in the graph.',
      complication: 'Two frameworks can sit in one room without anyone linking them, and a path through generic hubs is not a lateral connection.',
      question: 'Which of the recalled framework pairs have a lateral path documented in the teaching graph?',
    },
    key_line: [
      { id: 'k1', label: 'Lateral path', dimension: 'cn:lateral_path' },
      { id: 'k2', label: 'Already known', dimension: 'cn:already_known' },
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
    substrate = buildSubstrate(db, Object.assign({}, o, { roomDir: resolved }));
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
  buildSubstrate: buildSubstrate,
  recallCandidates: recallCandidates,
  writeRunFiles: writeRunFiles,
  readCandidates: readCandidates,
  runDirFor: runDirFor,
  questionSetFor: questionSetFor,
  runRecall: runRecall,
};
