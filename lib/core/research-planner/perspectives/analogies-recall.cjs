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
 * Phase 369.2 plan 28 (HARNESS-04, SW-19, SEED-118 D10, annex C02): a third signal, structural_from_encoding.
 * A thing whose artifact carries `methodology: sapphire-encoding` (lines Function:, Behavior:, Structure:) is
 * an encoding. Another thing bridges to it when that thing's title and text cover a strict majority (and at
 * least 3) of the encoding's function and behavior content tokens. Before this plan the matcher counted only
 * shared entities and shared framework nodes, so an encoding the navigator wrote changed nothing (C02). The
 * encoding lane runs before the signal filter: a bridged pair the eureka pool never surfaced is added through
 * the same exclusion store, and a pool pair gains the encoding signal. The module's own max_candidates still
 * caps the result. Reads are local: one file per thing, 64 KB at most, nothing leaves the room.
 *
 * Plan 366-08 owns the substrate and the exclusion set. This module consumes them and edits neither
 * eureka-recall.cjs nor shared.cjs. Hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');

const navigation = require('../../navigation.cjs');
const eurekaRecall = require('./eureka-recall.cjs');
const shared = require('./shared.cjs');
const contentTokenMod = require('../content-tokens.cjs');
const evidenceRows = require('../evidence-rows.cjs');

const ID = 'analogies';
const TEMPLATE_ID = 'analogies';
const COMMAND = '/mos:find-analogies';
const LENSES = Object.freeze(['an.structure', 'an.known']);
const FALSIFIER = 'A documented case where the shared function and behavior did not transfer because the structures differ.';
const RUN_ROOT = path.join('.mindrian', 'perspectives', 'analogies');
const STATUS_TITLE = 'Analogies perspective run';
// lexical_ceiling: a pair above it shares words, so it is a eureka pair, not an analogy.
const BUDGETS = Object.freeze({ max_candidates: 100, max_leaves: 8, lexical_ceiling: 0.15 });
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
  substrate.edges.forEach(function (e) {
    if (e.type !== 'USES_FRAMEWORK' || !substrate.framework_nodes[e.target]) return;
    if (!out[e.source]) out[e.source] = [];
    if (out[e.source].indexOf(e.target) === -1) out[e.source].push(e.target);
  });
  return out;
}

// ---------------------------------------------------------------------------
// SAPPhIRE encodings (369.2-28, HARNESS-04, SW-19, annex C02)
// ---------------------------------------------------------------------------
const ENCODING_METHODOLOGY = 'sapphire-encoding';
const ENCODING_MAX_BYTES = 64 * 1024; // T-369.2-28-01: one encoding file is read to 64 KB at most
const ENCODING_PROBE_BYTES = 2048; // the frontmatter check reads only the head of a file
const ENCODING_MIN_COVER = 3; // a bridge needs at least 3 shared function and behavior tokens
const ENCODING_LABELS = Object.freeze(['function', 'behavior', 'structure']);

// readHead(file, maxBytes) -> the first maxBytes of a regular file as utf8, or null (missing, a link, unreadable)
function readHead(file, maxBytes) {
  let fd = null;
  try {
    const st = fs.lstatSync(file);
    if (!st.isFile()) return null;
    fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(Math.min(maxBytes, st.size));
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    return buf.toString('utf8', 0, n);
  } catch (_e) {
    return null;
  } finally {
    if (fd !== null) { try { fs.closeSync(fd); } catch (_e2) { /* closed */ } }
  }
}

// artifactFileFor(roomDir, id) -> the .md file a thing id names inside the room, or null. An id with a scheme,
// an absolute path or a parent segment never names a file.
function artifactFileFor(roomDir, id) {
  const sid = String(id);
  if (!sid || sid.indexOf(':') !== -1 || sid.indexOf('\0') !== -1 || sid.charAt(0) === '/' || sid.charAt(0) === '\\') return null;
  if (sid.replace(/\\/g, '/').split('/').indexOf('..') !== -1) return null;
  const root = path.resolve(roomDir);
  const file = path.resolve(root, /\.md$/i.test(sid) ? sid : sid + '.md');
  return file.indexOf(root + path.sep) === 0 ? file : null;
}

// isEncodingHead(head) -> true when the frontmatter says methodology: sapphire-encoding
function isEncodingHead(head) {
  const m = String(head).replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---/);
  if (!m) return false;
  return m[1].split('\n').some(function (l) {
    const mm = l.match(/^methodology:\s*(.*)$/);
    return !!mm && mm[1].trim().replace(/^["']|["']$/g, '').toLowerCase() === ENCODING_METHODOLOGY;
  });
}

// parseEncodingLines(text) -> { function: tokens[], behavior: tokens[], structure: tokens[] }. A label starts
// a segment that ends at the next label or at the end of its line, so both one-label-per-line and a whole
// paragraph on one line read the same way.
function parseEncodingLines(text) {
  const body = String(text).replace(/\r\n/g, '\n').replace(/^---\n[\s\S]*?\n---\n?/, '');
  const got = { function: [], behavior: [], structure: [] };
  body.split('\n').forEach(function (line) {
    const re = /\b(Function|Behavior|Structure):\s*/g;
    const marks = [];
    let m;
    while ((m = re.exec(line)) !== null) marks.push({ label: m[1].toLowerCase(), from: m.index + m[0].length, at: m.index });
    marks.forEach(function (mk, i) {
      const to = i + 1 < marks.length ? marks[i + 1].at : line.length;
      got[mk.label].push(line.slice(mk.from, to));
    });
  });
  const out = {};
  ENCODING_LABELS.forEach(function (label) {
    out[label] = contentTokenMod.contentTokens(evidenceRows.normalizeText(got[label].join(' ')));
  });
  return out;
}

/**
 * readEncodings(roomDir, substrate) -> { [thingId]: { function_tokens, behavior_tokens, structure_tokens } }
 * The things whose artifact file has `methodology: sapphire-encoding` in its frontmatter. Only the head of a
 * file is probed; an encoding is read to 64 KB. A thing with fewer than 3 function and behavior tokens is not
 * an usable encoding and is skipped. No roomDir: no encodings.
 */
function readEncodings(roomDir, substrate) {
  const out = {};
  if (typeof roomDir !== 'string' || !roomDir) return out;
  substrate.things.forEach(function (t) {
    const file = artifactFileFor(roomDir, t.id);
    if (!file) return;
    const head = readHead(file, ENCODING_PROBE_BYTES);
    if (head === null || !isEncodingHead(head)) return;
    const full = readHead(file, ENCODING_MAX_BYTES);
    if (full === null) return;
    const lines = parseEncodingLines(full);
    const needle = Array.from(new Set(lines.function.concat(lines.behavior)));
    if (needle.length < ENCODING_MIN_COVER) return;
    out[t.id] = { function_tokens: lines.function, behavior_tokens: lines.behavior, structure_tokens: lines.structure };
  });
  return out;
}

// encodingBridges(substrate, encodings) -> Map(pairKey -> [encodedId, otherId]): the pairs where the other
// thing's normalized title plus text covers a strict majority (and at least 3) of the encoding's function and
// behavior content tokens.
function encodingBridges(substrate, encodings) {
  const bridges = new Map();
  const ids = Object.keys(encodings).sort();
  if (ids.length === 0) return bridges;
  const tokenSets = {};
  function setOf(t) {
    if (!tokenSets[t.id]) tokenSets[t.id] = new Set(contentTokenMod.contentTokens(evidenceRows.normalizeText(t.title + ' ' + t.text)));
    return tokenSets[t.id];
  }
  ids.forEach(function (eid) {
    const e = encodings[eid];
    const needle = Array.from(new Set(e.function_tokens.concat(e.behavior_tokens)));
    substrate.things.forEach(function (t) {
      if (t.id === eid) return;
      const have = setOf(t);
      let got = 0;
      needle.forEach(function (tok) { if (have.has(tok)) got += 1; });
      if (got >= ENCODING_MIN_COVER && contentTokenMod.coversByMajority(have, needle)) {
        const k = shared.pairKey(eid, t.id);
        if (!bridges.has(k)) bridges.set(k, [eid, t.id]);
      }
    });
  });
  return bridges;
}

// the entity titles two things both describe (the eureka shared_entity bridge, recomputed for a row the pool lacks)
function sharedEntityTitles(substrate, a, b) {
  const out = [];
  Object.keys(substrate.entities).forEach(function (id) {
    const ent = substrate.entities[id];
    if (ent.things.has(a) && ent.things.has(b) && out.indexOf(ent.title) === -1) out.push(ent.title);
  });
  return out;
}

/**
 * recallCandidates(substrate, roomDir, budgets) -> { candidates, counts, pairs_truncated, couplings }
 *   candidates: the eureka row shape, lane `structural` added, plus shared_frameworks (framework node ids) and
 *   signal_sources (a sorted subset of shared_entity, framework, encoding).
 *   counts.structural_from_encoding: the kept rows that carry the encoding signal.
 */
function recallCandidates(substrate, roomDir, budgets) {
  const B = Object.assign({}, BUDGETS, budgets || {});
  // The pool is the eureka recall at the eureka cap; this module's own cap is applied after the filter.
  const pool = eurekaRecall.recallCandidates(substrate, roomDir, { max_candidates: eurekaRecall.BUDGETS.max_candidates });
  const fw = frameworksByThing(substrate);

  // The encoding lane (HARNESS-04, annex C02) runs before the signal filter. A bridged pair the pool lacks is
  // added through the shared exclusion store, so a known pair, a same-section pair and an opportunity pair
  // stay out for this lane exactly as for every other.
  const bridges = encodingBridges(substrate, readEncodings(roomDir, substrate));
  const inPool = new Set(pool.candidates.map(function (c) { return shared.pairKey(c.a, c.b); }));
  const thingById = {};
  substrate.things.forEach(function (t) { thingById[t.id] = t; });
  const store = shared.makeCandidateStore(substrate);
  bridges.forEach(function (pair, k) {
    if (inPool.has(k)) return;
    const ta = thingById[pair[0]]; const tb = thingById[pair[1]];
    store.upsert(pair[0], pair[1], 'structural', { lexical: shared.jaccard(ta.tokens, tb.tokens) });
  });
  const lanePool = store.rows().map(function (r) {
    r.shared_entities = sharedEntityTitles(substrate, r.a, r.b);
    return r;
  });

  let droppedLexical = 0;
  let droppedNoSignal = 0;
  const kept = [];
  pool.candidates.concat(lanePool).forEach(function (c) {
    const fa = fw[c.a] || []; const fb = fw[c.b] || [];
    const sharedFw = fa.filter(function (id) { return fb.indexOf(id) !== -1; }).sort();
    const enc = bridges.has(shared.pairKey(c.a, c.b));
    const signal = c.shared_entities.length + sharedFw.length + (enc ? 1 : 0);
    if (signal === 0) { droppedNoSignal += 1; return; }
    if (c.lexical > B.lexical_ceiling) { droppedLexical += 1; return; }
    const row = Object.assign({}, c, { lanes: c.lanes.slice(), shared_entities: c.shared_entities.slice() });
    if (row.lanes.indexOf('structural') === -1) row.lanes.push('structural');
    row.shared_frameworks = sharedFw;
    row.signal_sources = [];
    if (row.shared_entities.length > 0) row.signal_sources.push('shared_entity');
    if (sharedFw.length > 0) row.signal_sources.push('framework');
    if (enc) row.signal_sources.push('encoding');
    row._signal = signal;
    kept.push(row);
  });
  kept.sort(function (x, y) {
    return (y._signal - x._signal) || (x.a < y.a ? -1 : (x.a > y.a ? 1 : 0)) || (x.b < y.b ? -1 : (x.b > y.b ? 1 : 0));
  });
  const truncated = Math.max(0, kept.length - B.max_candidates);
  const list = kept.slice(0, B.max_candidates);
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
    structural_from_encoding: kept.filter(function (r) { return r.signal_sources.indexOf('encoding') !== -1; }).length,
    candidates: list.length,
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
  return {
    schema: base.schema,
    template_id: TEMPLATE_ID,
    command: COMMAND,
    stated_question: 'Which pairs in this room share a structure without sharing words, and does the function and behavior of one transfer to the other?',
    scqa: {
      situation: 'The room holds ' + substrate.things.length + ' things across ' + substrate.sections.length + ' sections; ' + recall.candidates.length + ' cross-section pairs share structure but not wording.',
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
  readEncodings: readEncodings,
  recallCandidates: recallCandidates,
  writeRunFiles: writeRunFiles,
  readCandidates: readCandidates,
  runDirFor: runDirFor,
  questionSetFor: questionSetFor,
  runRecall: runRecall,
};
