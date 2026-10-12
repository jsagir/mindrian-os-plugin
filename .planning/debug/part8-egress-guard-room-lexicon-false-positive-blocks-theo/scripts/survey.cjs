'use strict';
// Survey: for each scratch copy of a room, build the lexicon and run the 26 positives + 10 negatives.
// usage: node survey.cjs <surveyDir> <guardPath> <outSummary.json> <outPrivate.json>
// outSummary holds counts, classes and reason slugs only. outPrivate may hold lexicon entry text (private/ only).
const fs = require('node:fs');
const path = require('node:path');

let fetchCalls = 0;
globalThis.fetch = function () { fetchCalls += 1; throw new Error('network blocked in debug session'); };

const surveyDir = process.argv[2];
const guardPath = process.argv[3];
const outSummary = process.argv[4];
const outPrivate = process.argv[5];

const guard = require(guardPath);
const lexMod = require(path.join(path.dirname(guardPath), 'part8-room-lexicon.cjs'));
const corpusName = process.argv[6] || 'base';
const base = require('./corpus.cjs');
const POSITIVES = corpusName === 'ext' ? require('./corpus-ext.cjs').EXT : base.POSITIVES;
const NEGATIVES = base.NEGATIVES;

const summary = [];
const priv = [];
for (const slug of fs.readdirSync(surveyDir).sort()) {
  const roomDir = path.join(surveyDir, slug);
  if (!fs.existsSync(path.join(roomDir, '.mindrian', 'room.db'))) continue;
  const t0 = Date.now();
  const lex = lexMod.loadRoomLexicon(roomDir);
  const loadMs = Date.now() - t0;
  const kinds = {};
  if (lex.ok) lex.entries.forEach(function (e) { kinds[e.kind] = (kinds[e.kind] || 0) + 1; });
  const fps = [];
  const fpPriv = [];
  POSITIVES.forEach(function (p) {
    const r = guard.classify({ question: p.q }, { toolName: 'brain_ask', roomDir: roomDir });
    if (r.verdict !== 'allow') {
      fps.push({ id: p.id, class: r.class, token_class: r.token_class || null });
      // which entry matched (text stays in private/)
      let hit = null;
      if (lex.ok) {
        const lexM = lexMod.matchLexicon(p.q, lex);
        if (lexM) hit = lexM.token_class;
      }
      fpPriv.push({ id: p.id, q: p.q, class: r.class, token_class: r.token_class || null, lexicon_hit_class: hit });
    }
  });
  let leaks = [];
  NEGATIVES.forEach(function (n) {
    const r = guard.classify({ question: n.q }, { toolName: 'brain_ask', roomDir: roomDir });
    if (r.verdict === 'allow') leaks.push(n.id);
  });
  summary.push({
    room: slug,
    lexicon_ok: lex.ok,
    lexicon_source: lex.source || null,
    entries_total: lex.ok ? lex.entries.length : 0,
    entries_by_kind: kinds,
    load_ms: loadMs,
    false_positives: fps.length,
    fp_detail: fps,
    negatives_allowed: leaks,
  });
  priv.push({ room: slug, fp: fpPriv });
}
const agg = {
  rooms: summary.length,
  rooms_with_fp: summary.filter(function (s) { return s.false_positives > 0; }).length,
  fp_total: summary.reduce(function (a, s) { return a + s.false_positives; }, 0),
  fetch_calls: fetchCalls,
};
fs.writeFileSync(outSummary, JSON.stringify({ aggregate: agg, rooms: summary }, null, 2) + '\n');
fs.writeFileSync(outPrivate, JSON.stringify(priv, null, 2) + '\n');
console.log(JSON.stringify(agg));
