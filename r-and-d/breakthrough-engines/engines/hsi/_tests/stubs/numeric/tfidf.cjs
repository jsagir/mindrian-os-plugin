'use strict';
// Test stub for lib/core/numeric/tfidf.cjs (not shipped in this slice): sklearn-style smooth idf, l2 rows.
const STOP = new Set('a an and are as at be by for from in is it of on or that the to with this was were has have'.split(' '));
function fitTfidf(texts, opts) {
  const maxFeatures = (opts && opts.maxFeatures) || 500;
  const docs = texts.map((t) => (String(t).toLowerCase().match(/[a-z]{2,}/g) || []).filter((w) => !STOP.has(w)));
  const total = new Map();
  docs.forEach((d) => d.forEach((w) => total.set(w, (total.get(w) || 0) + 1)));
  const vocabulary = Array.from(total.keys()).sort((a, b) => (total.get(b) - total.get(a)) || (a < b ? -1 : 1)).slice(0, maxFeatures).sort();
  const idx = new Map(vocabulary.map((w, i) => [w, i]));
  const n = texts.length;
  const df = vocabulary.map((w) => docs.filter((d) => d.includes(w)).length);
  const weights = docs.map((d) => {
    const row = new Array(vocabulary.length).fill(0);
    d.forEach((w) => { if (idx.has(w)) row[idx.get(w)] += 1; });
    const x = row.map((c, j) => c * (Math.log((1 + n) / (1 + df[j])) + 1));
    const norm = Math.sqrt(x.reduce((a, v) => a + v * v, 0)) || 1;
    return x.map((v) => v / norm);
  });
  return { vocabulary, weights };
}
module.exports = { fitTfidf };
