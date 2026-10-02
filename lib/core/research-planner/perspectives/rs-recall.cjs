'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 366 plan 13 (D-08, EPV366-05): the RS perspective (reverse salient, the
 * section that lags the rest of the system), stages 01 (substrate) and 02
 * (recall), re-derived from the room's local graph and its ICM structure.
 *
 * WHAT IT DOES. Reads the bound room's local graph and proposes cross-section
 * pairs that sit across a LAGGING boundary: a section whose upstream sections
 * are more developed than it is. It never embeds, never calls a model, never
 * reaches the network. The navigator's ruling (D-08): the canvas uses the local
 * graph and the ICM structure, not learned similarity. The legacy RS engine stays
 * untouched; the spike measures this module against it.
 *
 * WHY SECTION LEVEL. A fleet census (31 rooms) found only 38 dependency-shaped
 * edges, so a component graph built on dependency edges alone is empty. The
 * component here is the SECTION. Directed flow between sections comes from the
 * typed edges between things in different sections (INFORMS, ENABLES and
 * SUPPLIES_TO point from upstream to downstream; USES_COMPONENT and DERIVED_FROM
 * point at the thing that was used or derived from, which is upstream) and from
 * the room's own declared feeds: a section whose CONTEXT.md "## Inputs" names
 * another section is downstream of it. Direction is parsed here, because the
 * eureka declaredCouplings helper returns an undirected set.
 *
 * THE LAG SCORE. Per section: develop = the mean of the rank-normalized things
 * count and the rank-normalized anchored-claims count within the room (rank
 * normalization, so no absolute floor exists, 355 D-46). lag = median(develop of
 * the more developed upstream sections) - develop(self). A section with lag above
 * zero is lagging.
 *
 * THREE RECALL LANES, all local:
 *   flow_boundary  a typed flow edge crosses the boundary (upstream thing -> lagging section);
 *   icm_declared   the lagging section's own CONTEXT.md declares the upstream section as an input;
 *   support_gap    the lagging thing has no anchored claim (no SUPPORTS or SOURCED_FROM row).
 * Pairs are (a developed upstream thing, a thin lagging-section thing), capped per
 * boundary, then capped overall.
 *
 * THE EXCLUSION SET (ADR-E14): the one shared makeCandidateStore drops a pair the
 * room already connects, or already holds as the evidence of an opportunity, and
 * counts it. This module never rebuilds that check.
 *
 * EDIT SURFACES (ICM invariant 6): each stage writes one plain file under
 * <room>/.mindrian/perspectives/rs/<tag>/NN_stage/output/ through
 * shared.writeRunFiles. Delete a line in candidates.jsonl and the next stage
 * judges what is left. STATUS.md is derived and never hand-edited (invariant 9).
 *
 * Part 8: nothing here egresses. The question set carries room titles for the
 * navigator's plan card; only the composed query slots (short terms through
 * slotTerm) can ever leave, and the planner audits every one of them.
 *
 * Reads go through the navigation door (openRoomDbReadOnlyForCaller). This module
 * writes nothing to room.db. Hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');

const navigation = require('../../navigation.cjs');
const shared = require('./shared.cjs');
const eurekaRecall = require('./eureka-recall.cjs');

const ID = 'rs';
const TEMPLATE_ID = 'rs';
const COMMAND = '/mos:find-bottlenecks';
const LENSES = Object.freeze(['rs.lag', 'rs.known']);
// The rs template's falsifier (question-templates RS, dimension rs:lagging_component).
const FALSIFIER = 'Evidence that the named section is not the constraint: downstream progress is blocked elsewhere, or the section is complete under other words.';
const RUN_ROOT = path.join('.mindrian', 'perspectives', 'rs');
const BUDGETS = Object.freeze({ max_candidates: 200, max_leaves: 8, pairs_per_boundary: 10 });
const STAGE_A_LANES = Object.freeze(['flow_boundary', 'icm_declared', 'support_gap']);
const STATUS_TITLE = 'RS perspective run';
const SCHEMA_QS = 'mos.research-question-set/1';

// Edge types that carry flow between things. FORWARD: the source is upstream.
// REVERSE: the target is upstream (A USES_COMPONENT B means B feeds A).
const FLOW_FORWARD = Object.freeze(new Set(['INFORMS', 'ENABLES', 'SUPPLIES_TO']));
const FLOW_REVERSE = Object.freeze(new Set(['USES_COMPONENT', 'DERIVED_FROM']));
const ANCHOR_EDGES = Object.freeze(new Set(['SUPPORTS', 'SOURCED_FROM']));

const SAFE_SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

// ---------------------------------------------------------------------------
// small math helpers
// ---------------------------------------------------------------------------
function round4(x) { return Math.round(x * 10000) / 10000; }

function median(xs) {
  if (!xs.length) return 0;
  const s = xs.slice().sort(function (a, b) { return a - b; });
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// rankNormalize({key: value}) -> {key: 0..1}: average rank for ties, (rank-1)/(n-1); one key reads 0.5.
function rankNormalize(values) {
  const keys = Object.keys(values).sort();
  const n = keys.length;
  const out = {};
  if (n === 0) return out;
  if (n === 1) { out[keys[0]] = 0.5; return out; }
  const order = keys.slice().sort(function (a, b) { return values[a] - values[b] || (a < b ? -1 : 1); });
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && values[order[j + 1]] === values[order[i]]) j += 1;
    const avgRank = (i + 1 + j + 1) / 2;
    for (let k = i; k <= j; k += 1) out[order[k]] = (avgRank - 1) / (n - 1);
    i = j + 1;
  }
  return out;
}

function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\\/-]/g, '\\$&'); }

// ---------------------------------------------------------------------------
// ICM lane: DIRECTED declared feeds from each section's CONTEXT.md "## Inputs"
// ---------------------------------------------------------------------------
/**
 * declaredFeeds(roomDir, sections) -> [[from, to]] sorted and unique.
 * A section whose "## Inputs" body references another known section as
 * <slug>/ or ../<slug>/ is DOWNSTREAM of it: the feed is other -> section.
 * A missing or unreadable CONTEXT.md means no declared inputs. A slug that is not
 * a plain directory name is never read (no path is built from a traversal shape).
 */
function declaredFeeds(roomDir, sections) {
  const known = (Array.isArray(sections) ? sections : []).filter(function (s) { return typeof s === 'string' && SAFE_SLUG.test(s) && s.indexOf('..') === -1; });
  const feeds = new Set();
  known.forEach(function (sec) {
    let body = '';
    try { body = fs.readFileSync(path.join(roomDir, sec, 'CONTEXT.md'), 'utf8'); } catch (_e) { return; }
    // JavaScript has no \Z: the real end anchor is a negative lookahead for any character.
    const m = body.match(/^##[ \t]+Inputs[ \t]*$([\s\S]*?)(?=^##\s|(?![\s\S]))/m);
    const inputs = m ? m[1] : '';
    if (!inputs) return;
    known.forEach(function (other) {
      if (other === sec) return;
      const re = new RegExp('(^|[\\s`(/])(\\.\\./)?' + escapeRe(other) + '/', 'm');
      if (re.test(inputs)) feeds.add(other + '\u0000' + sec);
    });
  });
  return Array.from(feeds).sort().map(function (k) { return k.split('\u0000'); });
}

// ---------------------------------------------------------------------------
// the section graph and the lag score
// ---------------------------------------------------------------------------
function analyzeSections(substrate, feeds) {
  const byId = {};
  substrate.things.forEach(function (t) { byId[t.id] = t; });
  const sections = substrate.sections.slice();

  // anchored things: any SUPPORTS or SOURCED_FROM row touching the thing
  const anchoredThing = new Set();
  substrate.edges.forEach(function (e) {
    if (!ANCHOR_EDGES.has(e.type)) return;
    if (byId[e.source]) anchoredThing.add(e.source);
    if (byId[e.target]) anchoredThing.add(e.target);
  });

  // section flow from typed edges between things in different sections
  const flowCount = {}; // 'U\0L' -> number of edge rows
  substrate.edges.forEach(function (e) {
    let up; let down;
    if (FLOW_FORWARD.has(e.type)) { up = byId[e.source]; down = byId[e.target]; }
    else if (FLOW_REVERSE.has(e.type)) { up = byId[e.target]; down = byId[e.source]; }
    else return;
    if (!up || !down || up.section === down.section) return;
    const k = up.section + '\u0000' + down.section;
    flowCount[k] = (flowCount[k] || 0) + 1;
  });
  const feedSet = new Set();
  feeds.forEach(function (f) { if (sections.indexOf(f[0]) !== -1 && sections.indexOf(f[1]) !== -1) feedSet.add(f[0] + '\u0000' + f[1]); });

  const stat = {};
  sections.forEach(function (s) { stat[s] = { section: s, things: 0, claims: 0, anchored_claims: 0, inbound: 0, outbound: 0, upstream: [] }; });
  substrate.things.forEach(function (t) {
    const st = stat[t.section];
    if (!st) return;
    st.things += 1;
    if (t.type === 'claim') {
      st.claims += 1;
      if (anchoredThing.has(t.id)) st.anchored_claims += 1;
    }
  });
  const edgeKeys = new Set(Object.keys(flowCount).concat(Array.from(feedSet)));
  edgeKeys.forEach(function (k) {
    const p = k.split('\u0000');
    if (!stat[p[0]] || !stat[p[1]]) return;
    const n = (flowCount[k] || 0) + (feedSet.has(k) ? 1 : 0);
    stat[p[0]].outbound += n;
    stat[p[1]].inbound += n;
    if (stat[p[1]].upstream.indexOf(p[0]) === -1) stat[p[1]].upstream.push(p[0]);
  });
  sections.forEach(function (s) { stat[s].upstream.sort(); });

  // develop: mean of the rank-normalized things and anchored-claims counts
  const thingsRank = {}; const anchoredRank = {};
  const thingsVals = {}; const anchoredVals = {};
  sections.forEach(function (s) { thingsVals[s] = stat[s].things; anchoredVals[s] = stat[s].anchored_claims; });
  Object.assign(thingsRank, rankNormalize(thingsVals));
  Object.assign(anchoredRank, rankNormalize(anchoredVals));
  sections.forEach(function (s) { stat[s].develop = (thingsRank[s] + anchoredRank[s]) / 2; });

  // lag: median(develop of the more developed upstream sections) - develop(self)
  sections.forEach(function (s) {
    const ups = stat[s].upstream.filter(function (u) { return stat[u].develop > stat[s].develop; });
    stat[s].lag = ups.length ? median(ups.map(function (u) { return stat[u].develop; })) - stat[s].develop : 0;
    stat[s].lead_upstream = ups;
  });
  return { stat: stat, flowCount: flowCount, feedSet: feedSet, anchoredThing: anchoredThing, byId: byId };
}

// ---------------------------------------------------------------------------
// 02 recall
// ---------------------------------------------------------------------------
function recallCandidates(substrate, roomDir, budgets) {
  const B = Object.assign({}, BUDGETS, budgets || {});
  const feeds = declaredFeeds(roomDir, substrate.sections);
  const an = analyzeSections(substrate, feeds);
  const store = shared.makeCandidateStore(substrate);
  const stat = an.stat;

  const lagging = substrate.sections.filter(function (s) { return stat[s].lag > 0; })
    .sort(function (x, y) { return (stat[y].lag - stat[x].lag) || (x < y ? -1 : 1); });

  const counts = {
    things: substrate.things.length,
    sections: substrate.sections.length,
    flow_edges: Object.keys(an.flowCount).reduce(function (n, k) { return n + an.flowCount[k]; }, 0),
    declared_feeds: feeds.length,
    lagging_sections: lagging.length,
    known_pairs: substrate.connected.size + substrate.opp_pairs.size,
    flow_boundary: 0, icm_declared: 0, support_gap: 0, excluded_known: 0,
  };

  const bySection = {};
  substrate.things.forEach(function (t) { (bySection[t.section] = bySection[t.section] || []).push(t); });

  const keep = new Set();
  let truncated = 0;
  lagging.forEach(function (L) {
    stat[L].lead_upstream.forEach(function (U) {
      const allUps = bySection[U] || []; const allLags = bySection[L] || [];
      const ups = allUps.slice().sort(function (x, y) { return (y.degree - x.degree) || (x.id < y.id ? -1 : 1); }).slice(0, B.pairs_per_boundary);
      const lags = allLags.slice().sort(function (x, y) { return (x.text.length - y.text.length) || (x.id < y.id ? -1 : 1); }).slice(0, B.pairs_per_boundary);
      // pairs the side caps never examined are reported, not silently lost (T-366-56)
      truncated += Math.max(0, allUps.length * allLags.length - ups.length * lags.length);
      const k = U + '\u0000' + L;
      const lanes = [];
      if (an.flowCount[k]) lanes.push('flow_boundary');
      if (an.feedSet.has(k)) lanes.push('icm_declared');
      const pairs = [];
      ups.forEach(function (u) {
        lags.forEach(function (l) { pairs.push({ u: u, l: l, lex: shared.jaccard(u.tokens, l.tokens) }); });
      });
      // thin lagging thing first, then the better connected upstream thing, then word overlap
      pairs.sort(function (x, y) {
        return (x.l.text.length - y.l.text.length) || (y.u.degree - x.u.degree) || (y.lex - x.lex) || (x.u.id < y.u.id ? -1 : 1) || (x.l.id < y.l.id ? -1 : 1);
      });
      const lagScore = round4(stat[L].lag);
      const rows = [];
      pairs.forEach(function (p) {
        const laneList = lanes.slice();
        if (!an.anchoredThing.has(p.l.id)) laneList.push('support_gap');
        if (!laneList.length) return;
        const prev = store.get(p.u.id, p.l.id);
        const better = !prev || typeof prev.lag_score !== 'number' || lagScore > prev.lag_score;
        const fields = better ? { lag_score: lagScore, upstream: p.u.id } : {};
        store.upsert(p.u.id, p.l.id, laneList[0], { lexical: round4(p.lex), fields: fields });
        const row = store.get(p.u.id, p.l.id);
        // an excluded or invalid pair leaves no row: the later lanes must not recount it
        if (!row) return;
        for (let i = 1; i < laneList.length; i += 1) store.upsert(p.u.id, p.l.id, laneList[i], { lexical: round4(p.lex) });
        if (rows.indexOf(row) === -1) rows.push(row);
      });
      rows.slice(0, B.pairs_per_boundary).forEach(function (r) { keep.add(r); });
      truncated += Math.max(0, rows.length - B.pairs_per_boundary);
    });
  });

  counts.excluded_known = store.excludedKnown();
  let list = store.rows().filter(function (r) { return keep.has(r); });
  list.sort(function (x, y) {
    return (y.lag_score - x.lag_score) || (y.lanes.length - x.lanes.length) || (x.a < y.a ? -1 : (x.a > y.a ? 1 : 0)) || (x.b < y.b ? -1 : (x.b > y.b ? 1 : 0));
  });
  truncated += Math.max(0, list.length - B.max_candidates);
  list = list.slice(0, B.max_candidates);
  list.forEach(function (r) {
    STAGE_A_LANES.forEach(function (ln) { if (r.lanes.indexOf(ln) !== -1) counts[ln] += 1; });
  });
  counts.candidates = list.length;

  const lagTable = lagging.map(function (s) {
    const st = stat[s];
    return { section: s, things: st.things, claims: st.claims, anchored_claims: st.anchored_claims, inbound: st.inbound, outbound: st.outbound, develop: round4(st.develop), upstream: st.lead_upstream.slice(), lag: round4(st.lag) };
  });
  return { candidates: list, counts: counts, pairs_truncated: truncated, couplings: feeds, lag: lagTable };
}

// ---------------------------------------------------------------------------
// run files (edit surfaces) and STATUS.md (derived)
// ---------------------------------------------------------------------------
function runDirFor(roomDir, tag) { return shared.runDirFor(roomDir, RUN_ROOT, tag); }

function writeRunFiles(roomDir, tag, substrate, recall) {
  return shared.writeRunFiles(roomDir, RUN_ROOT, tag, substrate, recall, { title: 'RS perspective run', lanes: ['flow_boundary', 'icm_declared', 'support_gap'], header_extra: { lag: recall.lag } });
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
  const leaves = [];
  recall.candidates.slice(0, maxLeaves).forEach(function (c, i) {
    const upId = c.upstream === c.b ? c.b : c.a;
    const downId = upId === c.a ? c.b : c.a;
    const up = byId[upId]; const down = byId[downId];
    const upTitle = upId === c.a ? c.title_a : c.title_b; const downTitle = upId === c.a ? c.title_b : c.title_a;
    const upSec = upId === c.a ? c.section_a : c.section_b; const downSec = upId === c.a ? c.section_b : c.section_a;
    const cause = abstractTerm(up, handles, c.shared_entities);
    const effect = abstractTerm(down, handles, c.shared_entities);
    const question = 'Is "' + downTitle + '" (' + downSec + ') held back because it has not kept pace with "' + upTitle + '" (' + upSec + ')?';
    const pair = { a: c.a, b: c.b, perspective: 'rs', run_tag: tag };
    if (!cause || !effect || cause.trim().toLowerCase() === effect.trim().toLowerCase()) {
      leaves.push({
        id: 'rs-' + (i + 1), question: question, origin: 'framework_dimension', dimension: 'rs:lagging_component', lens: 'rs.lag',
        researchable: false,
        not_researchable_reason: 'No search term could be composed for this pair without sending room text, so it is answered from the room only.',
        falsifier: { text: FALSIFIER }, corpus: 'room', pair: pair, lanes: c.lanes.slice(),
      });
      return;
    }
    leaves.push({
      id: 'rs-' + (i + 1), question: question, origin: 'framework_dimension', dimension: 'rs:lagging_component', lens: 'rs.lag',
      researchable: true, falsifier: { text: FALSIFIER }, corpus: 'openalex',
      slots: { cause: cause, effect: effect }, pair: pair, lanes: c.lanes.slice(),
    });
  });
  leaves.push({
    id: 'rs-known', question: 'Does the room already name any of these sections as the constraint?', origin: 'framework_dimension',
    dimension: 'rs:already_known', lens: 'rs.known', researchable: true,
    falsifier: { text: 'A room artifact that already names this section as the constraint.' }, corpus: 'room',
  });
  const secs = recall.candidates.slice(0, maxLeaves).map(function (c) { return c.section_a + ' and ' + c.section_b; });
  return {
    schema: SCHEMA_QS,
    template_id: TEMPLATE_ID,
    command: COMMAND,
    stated_question: 'Which section of this room lags behind the sections that feed it, and is it the constraint holding the rest back?',
    scqa: {
      situation: 'The room holds ' + substrate.things.length + ' things across ' + substrate.sections.length + ' sections; ' + recall.counts.lagging_sections + ' sections are less developed than the ones that feed them.',
      complication: 'A thin section is not always the bottleneck: the room may be developed elsewhere under other words, or progress may be blocked somewhere else.',
      question: 'Which lagging section, if any, is the constraint, and is that documented outside the room?',
    },
    key_line: [
      { id: 'k1', label: 'Lagging component', dimension: 'rs:lagging_component' },
      { id: 'k2', label: 'Already known', dimension: 'rs:already_known' },
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
  return { ok: true, tag: tag, run_dir: dir, counts: recall.counts, pairs_truncated: recall.pairs_truncated, couplings: recall.couplings, lag: recall.lag, candidates: recall.candidates, question_set: qs };
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
  _test: { declaredFeeds: declaredFeeds, analyzeSections: analyzeSections, rankNormalize: rankNormalize, recallCandidates: recallCandidates },
};
