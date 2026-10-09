'use strict';
// Test stub: concept-bag embedder (synonyms share an axis). Replaced per test via opts.embedTexts too.
const CONCEPTS = { payment: 0, invoice: 0, billing: 0, settlement: 0, vaccine: 1, immunization: 1, inoculation: 1, antigen: 1,
  route: 2, logistics: 2, delivery: 2, shipping: 2, bottleneck: 3, congestion: 3, backlog: 3, queue: 3, algorithm: 4, scheduler: 4, optimizer: 4, heuristic: 4 };
async function embedTexts(texts) {
  const vectors = texts.map((t) => { const v = new Array(6).fill(0); v[5] = 0.01; (String(t).toLowerCase().match(/[a-z]+/g) || []).forEach((w) => { if (w in CONCEPTS) v[CONCEPTS[w]] += 1; }); return v; });
  return { success: true, vectors, model: 'stub-concept-bag' };
}
module.exports = { embedTexts };
