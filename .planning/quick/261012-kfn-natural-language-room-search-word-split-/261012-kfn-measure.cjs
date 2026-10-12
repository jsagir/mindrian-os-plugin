'use strict';
// Quick 261012-kfn verification harness. Read-only on the room.
//
// Usage:
//   node 261012-kfn-measure.cjs                     (engine = lib/mcp/tools/room.cjs _internal)
//   node 261012-kfn-measure.cjs --engine prototype  (engine = 261012-kfn-bm25-prototype.cjs)
//
// Runs the 10 spike-010 cases in both forms (natural question, keywords) and
// the 3 spike-010 negative controls against the real room
// ~/MindrianRooms/rethinking-mindrianos. Token figure = chars/4 of
// JSON.stringify(results.slice(0, 50), null, 2), the same proxy as
// .planning/spikes/010-leviathan-search-vs-room-search/run.cjs. Also prints the
// floor inputs (words matched, IDF share) so the floor rule stays measured.
//
// Exits 1 when a target misses: nl top5 >= 8, kw top5 >= 7, 3 negatives empty
// with a reason_code, median results tokens <= 460 per form.
// Local files only. No network. No em-dashes.

const path = require('node:path');
const REPO = path.resolve(__dirname, '../../..');
const ROOM = path.join(process.env.HOME, 'MindrianRooms/rethinking-mindrianos');
const cases = require(path.join(REPO, '.planning/spikes/010-leviathan-search-vs-room-search/cases.json'));
const NEGATIVES = [
  'quarterly revenue forecast for the bakery franchise',
  'how do I configure Kubernetes autoscaling',
  'what is the capital of Mongolia',
];

const usePrototype = process.argv.includes('--engine') && process.argv[process.argv.indexOf('--engine') + 1] === 'prototype';
const engine = usePrototype
  ? require(path.join(__dirname, '261012-kfn-bm25-prototype.cjs'))
  : require(path.join(REPO, 'lib/mcp/tools/room.cjs'))._internal;
for (const fn of ['searchRoomDetailed', 'queryWords', 'scoreWordTier']) {
  if (typeof engine[fn] !== 'function') {
    console.log('FAIL: engine does not export ' + fn);
    process.exit(1);
  }
}

const tok = (s) => Math.ceil(s.length / 4);
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const uniq = (a) => [...new Set(a)];
// The room_search tool envelope as the handler builds it (debug keys excluded).
function envelope(q, out) {
  const e = { room_dir: ROOM, query: q, tier: out.tier, results: out.results };
  if (out.tier !== 'phrase') e.words = out.words;
  if (out.reason_code) { e.reason_code = out.reason_code; e.reason = out.reason; }
  return e;
}

const rows = [];
for (const c of cases) {
  for (const form of ['nl', 'kw']) {
    const q = c[form];
    const out = engine.searchRoomDetailed(ROOM, q, null);
    const files = uniq(out.results.map((r) => r.file));
    const i = files.slice(0, 5).indexOf(c.target);
    const words = engine.queryWords(q);
    const scored = out.tier === 'words' ? engine.scoreWordTier(ROOM, ROOM, words) : [];
    const tgt = scored.find((s) => s.file === c.target);
    rows.push({
      id: c.id,
      form,
      tier: out.tier,
      rank: i < 0 ? null : i + 1,
      n: files.length,
      tokens: tok(JSON.stringify(out.results.slice(0, 50), null, 2)),
      envelope: tok(JSON.stringify(envelope(q, out), null, 2)),
      target_words: tgt ? tgt.words_matched + '/' + words.length : '-',
      target_idf_share: tgt ? +tgt.idf_share.toFixed(2) : '-',
    });
  }
}
console.table(rows);

const neg = NEGATIVES.map((q) => {
  const out = engine.searchRoomDetailed(ROOM, q, null);
  const words = engine.queryWords(q);
  const best = engine.scoreWordTier(ROOM, ROOM, words).slice(0, 1)[0];
  return {
    q,
    results: out.results.length,
    reason_code: out.reason_code || null,
    unfloored_hits: engine.scoreWordTier(ROOM, ROOM, words).length,
    best_words: best ? best.words_matched + '/' + words.length : '-',
    best_idf_share: best ? +best.idf_share.toFixed(2) : '-',
  };
});
console.table(neg);

const summary = {};
for (const form of ['nl', 'kw']) {
  const rs = rows.filter((r) => r.form === form);
  summary[form] = {
    top1: rs.filter((r) => r.rank === 1).length,
    top5: rs.filter((r) => r.rank != null).length,
    zero_hit: rs.filter((r) => r.n === 0).length,
    median_tokens: med(rs.map((r) => r.tokens)),
    median_envelope_tokens: med(rs.map((r) => r.envelope)),
  };
}
console.table(summary);

const misses = [];
if (summary.nl.top5 < 8) misses.push('nl top5 ' + summary.nl.top5 + ' < 8');
if (summary.kw.top5 < 7) misses.push('kw top5 ' + summary.kw.top5 + ' < 7');
for (const n of neg) if (n.results !== 0 || !n.reason_code) misses.push('negative not empty with reason: ' + n.q);
for (const form of ['nl', 'kw']) if (summary[form].median_tokens > 460) misses.push(form + ' median tokens ' + summary[form].median_tokens + ' > 460');
if (misses.length) {
  console.log('FAIL: ' + misses.join('; '));
  process.exit(1);
}
console.log('PASS: 261012-kfn targets met (engine=' + (usePrototype ? 'prototype' : 'room.cjs') + ')');
