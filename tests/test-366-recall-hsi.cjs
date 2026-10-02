#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 366 Plan 13 Task 2 (EPV366-06, D-08): the HSI perspective recall from lexical
 * versus graph co-occurrence divergence, and the graph direction variant that lives in
 * lib/core/direction-convention.cjs (the one home of comparison-to-label code).
 *
 *   H1  classifyGraph(lexical, relational): relational above lexical reads structural_transfer, below reads semantic_implementation
 *   H2  a tie reads semantic_implementation (the locked D-02 tie rule, no third branch); a null, undefined or non-finite leg reads none
 *   H3  GRAPH_PHRASE_HASH is its own table hash; the legacy phrase hash and the framing hash are untouched
 *   H4  the planted hsi pair is a candidate: lane relational, divergence above zero, direction structural_transfer
 *   H5  known pair excluded, cap honored, deterministic, shared row keys plus relational, divergence and direction
 *   H6  every direction label equals classifyGraph(lexical, relational).label; hsi-recall holds no label literal
 *   H7  questionSetFor: hsi:divergence leaves with {term, term2}, closed pair, hsi-known room leaf, validates
 *
 * Isolation: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME point at temp dirs and the
 * session env is cleared BEFORE any repo module loads. Zero network. Exit 77 when
 * node:sqlite is missing. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-hsi-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-hsi-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;

try { require('node:sqlite'); } catch (_e) {
  process.stdout.write('ENV GAP: node:sqlite unavailable (node ' + process.version + '); need node >= 22\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(REPO_ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey && hygiene.scrubVendorKey();
delete process.env.ANTHROPIC_API_KEY;
const net = hygiene.installNetGuard ? hygiene.installNetGuard() : { attempts: function () { return 0; }, restore: function () {} };
const C = hygiene.makeChecker('test-366-recall-hsi');

const PERSP = path.join(REPO_ROOT, 'lib/core/research-planner/perspectives');
const fixture = require(path.join(REPO_ROOT, 'tests/helpers/fixture-366.cjs'));
const index = require(path.join(PERSP, 'index.cjs'));
const Q = require(path.join(REPO_ROOT, 'lib/core/research-planner/question-templates.cjs'));
const dc = require(path.join(REPO_ROOT, 'lib/core/direction-convention.cjs'));
const hsi = require(path.join(PERSP, 'hsi-recall.cjs'));

const TAG = '20261002T000000Z';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-hsi-'));

function leg(name, fn) {
  return Promise.resolve().then(fn).then(function (ok) {
    C.check(name, ok === true, ok === true ? '' : String(ok));
  }, function (e) {
    C.check(name, false, 'threw: ' + String(e && e.stack ? e.stack : e).slice(0, 500));
  });
}
function findPair(rows, a, b) { return rows.filter(function (r) { return (r.a === a && r.b === b) || (r.a === b && r.b === a); })[0] || null; }

(async function main() {
  const room = fixture.buildPerspectiveRoom(root, { name: 'hsi-room' });
  const P = room.planted;

  await leg('H1 classifyGraph: relational above lexical is structural_transfer, below is semantic_implementation', function () {
    const a = dc.classifyGraph(0.1, 0.6);
    if (a.label !== 'structural_transfer' || a.phrase !== dc.GRAPH_PHRASES.structural_transfer) return JSON.stringify(a);
    const b = dc.classifyGraph(0.6, 0.1);
    if (b.label !== 'semantic_implementation' || b.phrase !== dc.GRAPH_PHRASES.semantic_implementation) return JSON.stringify(b);
    if (a.phrase_hash !== dc.GRAPH_PHRASE_HASH || b.phrase_hash !== dc.GRAPH_PHRASE_HASH) return 'phrase_hash';
    if (dc.classifyGraph('0.1', '0.6').label !== 'structural_transfer') return 'numeric strings coerce';
    return true;
  });

  await leg('H2 tie is semantic_implementation; null, undefined or non-finite is none', function () {
    const t = dc.classifyGraph(0.3, 0.3);
    if (t.label !== 'semantic_implementation') return JSON.stringify(t);
    if (dc.classifyGraph(0, 0).label !== dc.classifyDiff(0)) return 'zero tie differs from classifyDiff(0)';
    const bad = [[null, 0.2], [0.2, null], [undefined, 0.2], [0.2, undefined], [NaN, 0.2], [0.2, Infinity], ['x', 0.2]];
    for (const p of bad) {
      const r = dc.classifyGraph(p[0], p[1]);
      if (r.label !== dc.NONE || r.phrase !== dc.GRAPH_PHRASES.none || r.phrase !== dc.NONE_MEANING) return 'none case ' + JSON.stringify(p) + ' -> ' + JSON.stringify(r);
    }
    if (JSON.stringify(dc.GRAPH_IDS) !== '["structural_transfer","semantic_implementation","none"]') return JSON.stringify(dc.GRAPH_IDS);
    return true;
  });

  await leg('H3 own table hash; legacy and framing hashes untouched', function () {
    if (!/^[0-9a-f]{64}$/.test(dc.GRAPH_PHRASE_HASH)) return 'hash shape';
    if (dc.GRAPH_PHRASE_HASH !== dc.hashGraphTable(dc.GRAPH_PHRASES)) return 'GRAPH_PHRASE_HASH is not hashGraphTable(GRAPH_PHRASES)';
    if (dc.GRAPH_PHRASE_HASH === dc.phraseHash()) return 'collides with the legacy phrase hash';
    const clone = Object.assign({}, dc.GRAPH_PHRASES, { structural_transfer: dc.GRAPH_PHRASES.structural_transfer + '.' });
    if (dc.hashGraphTable(clone) === dc.GRAPH_PHRASE_HASH) return 'a changed phrase did not change the hash';
    if (dc.phraseHash() !== dc.PHRASES_CONFIRMED.phrase_hash) return 'legacy phraseHash drifted';
    if (dc.framingHash() !== dc.FRAMING_CONFIRMED.framing_hash) return 'framing hash drifted';
    if (!Object.isFrozen(dc.GRAPH_PHRASES) || !Object.isFrozen(dc.GRAPH_IDS)) return 'tables not frozen';
    if (dc.DIRECTION_MEANING.structural_transfer !== 'same meaning in different words' || dc.DIRECTION_MEANING.semantic_implementation !== 'same words with different meaning') return 'DIRECTION_MEANING edited';
    return true;
  });

  const rec = hsi.runRecall(room.roomDir, { tag: TAG });

  await leg('H4 planted hsi pair: relational lane, divergence above zero, structural_transfer', function () {
    if (!rec.ok) return JSON.stringify(rec).slice(0, 200);
    if (index.available('hsi') !== true || index.getPerspective('hsi') !== hsi) return 'registry';
    for (const n of index.INTERFACE_NAMES) if (hsi[n] === undefined) return 'missing export ' + n;
    if (hsi.ID !== 'hsi' || hsi.TEMPLATE_ID !== 'hsi' || hsi.COMMAND !== '/mos:scout hsi') return 'ids';
    if (JSON.stringify(hsi.LENSES) !== '["hsi.diverge","hsi.known"]') return JSON.stringify(hsi.LENSES);
    if (JSON.stringify(hsi.STAGE_A_LANES) !== '["relational","lexical"]' || !Object.isFrozen(hsi.STAGE_A_LANES)) return 'lanes';
    if (JSON.stringify(hsi.BUDGETS) !== '{"max_candidates":200,"max_leaves":8,"per_thing_top_k":5,"body_cap":2000}' || !Object.isFrozen(hsi.BUDGETS)) return JSON.stringify(hsi.BUDGETS);
    if (hsi.RUN_ROOT !== path.join('.mindrian', 'perspectives', 'hsi')) return hsi.RUN_ROOT;
    const row = findPair(rec.candidates, P.hsi[0], P.hsi[1]);
    if (!row) return 'planted pair missing';
    if (row.lanes.indexOf('relational') === -1) return 'lanes ' + row.lanes.join(',');
    if (!(row.divergence > 0)) return 'divergence ' + row.divergence;
    if (row.direction !== 'structural_transfer') return 'direction ' + row.direction;
    if (row.shared_entities.length < 3) return 'shared entities ' + JSON.stringify(row.shared_entities);
    return true;
  });

  await leg('H5 known pair excluded, cap honored, deterministic, row keys', function () {
    if (findPair(rec.candidates, P.known[0], P.known[1])) return 'known pair present';
    if (!(rec.counts.excluded_known >= 1)) return 'excluded_known ' + rec.counts.excluded_known;
    const opp = room.ids.opportunity_pair;
    if (findPair(rec.candidates, opp[0], opp[1])) return 'opportunity pair present';
    if (rec.candidates.some(function (r) { return r.section_a === r.section_b; })) return 'same-section pair';
    const want = ['a', 'b', 'section_a', 'section_b', 'title_a', 'title_b', 'lanes', 'lexical', 'shared_entities', 'relational', 'divergence', 'direction'];
    for (const r of rec.candidates) want.forEach(function (k) { if (!(k in r)) throw new Error('row missing ' + k); });
    for (let i = 1; i < rec.candidates.length; i += 1) {
      if (Math.abs(rec.candidates[i - 1].divergence) < Math.abs(rec.candidates[i].divergence)) return 'not sorted by |divergence|';
    }
    const capped = hsi.runRecall(room.roomDir, { tag: '20261002T000001Z', budgets: { max_candidates: 2 } });
    if (capped.candidates.length !== 2 || !(capped.pairs_truncated >= 1)) return 'cap ' + capped.candidates.length + '/' + capped.pairs_truncated;
    const file = path.join(hsi.runDirFor(room.roomDir, TAG), '02_recall', 'output', 'candidates.jsonl');
    const first = fs.readFileSync(file);
    hsi.runRecall(room.roomDir, { tag: TAG });
    if (!first.equals(fs.readFileSync(file))) return 'bytes differ across runs';
    if (file.indexOf(path.join(room.roomDir, '.mindrian', 'perspectives', 'hsi')) !== 0) return file;
    const back = hsi.readCandidates(room.roomDir, TAG);
    if (!back || !back.header || back.header.phrase_hash !== dc.GRAPH_PHRASE_HASH) return 'header phrase_hash';
    return true;
  });

  await leg('H6 every label comes from classifyGraph; the module holds no label literal', function () {
    let neg = 0;
    for (const r of rec.candidates) {
      const want = dc.classifyGraph(r.lexical, r.relational).label;
      if (r.direction !== want) return r.a + '|' + r.b + ' direction ' + r.direction + ' want ' + want;
      if (Math.round((r.relational - r.lexical) * 10000) / 10000 !== r.divergence) return 'divergence is not relational minus lexical for ' + r.a;
      if (r.direction === 'semantic_implementation') neg += 1;
    }
    if (neg < 1) return 'no semantic_implementation row in the fixture (word overlap without relation)';
    const src = fs.readFileSync(path.join(PERSP, 'hsi-recall.cjs'), 'utf8');
    if (/structural_transfer|semantic_implementation/.test(src)) return 'hsi-recall holds a direction literal';
    if (!/classifyGraph\(/.test(src)) return 'classifyGraph not called';
    if (/rs-engine|hsi-engine|hsi-lsa/.test(src)) return 'imports the legacy engine';
    return true;
  });

  await leg('H7 questionSetFor leaves', function () {
    const qs = rec.question_set;
    if (qs.template_id !== 'hsi') return qs.template_id;
    const div = qs.leaves.filter(function (l) { return l.dimension === 'hsi:divergence'; });
    if (!div.length) return 'no hsi:divergence leaf';
    const researchable = div.filter(function (l) { return l.researchable === true; });
    if (!researchable.length) return 'no researchable pair leaf';
    for (const l of researchable) {
      if (Object.keys(l.slots).sort().join() !== 'term,term2') return 'slots ' + JSON.stringify(l.slots);
      if (l.corpus !== 'openalex' || l.lens !== 'hsi.diverge') return 'corpus/lens';
      if (/[()"\n]/.test(l.slots.term + l.slots.term2)) return 'slot not a short term';
    }
    for (const l of div) {
      if (!l.pair || l.pair.perspective !== 'hsi' || l.pair.run_tag !== TAG) return 'pair ' + JSON.stringify(l.pair);
      if (Object.keys(l.pair).sort().join() !== 'a,b,perspective,run_tag') return 'pair keys';
    }
    const known = qs.leaves.filter(function (l) { return l.dimension === 'hsi:already_known'; });
    if (known.length !== 1 || known[0].corpus !== 'room' || known[0].lens !== 'hsi.known') return 'hsi-known leaf';
    if (qs.leaves.length > hsi.BUDGETS.max_leaves) return 'too many leaves ' + qs.leaves.length;
    const shape = Q.validateQuestionSet(qs);
    if (!shape.ok) return JSON.stringify(shape.errors);
    return true;
  });

  const attempts = typeof net.attempts === 'function' ? net.attempts() : 0;
  C.check('zero network attempts', attempts === 0, String(attempts));
  net.restore();
  try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* tmp */ }
  process.exit(C.summary());
})().catch(function (err) {
  process.stderr.write('test-366-recall-hsi THREW: ' + String(err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
