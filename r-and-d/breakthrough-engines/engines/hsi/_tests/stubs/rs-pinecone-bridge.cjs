'use strict';
// Test stub: plain cosine (zero-norm -> NaN on purpose, to exercise the NaN-safe clip).
function cosineSimilarity(a, b) {
  let d = 0; let na = 0; let nb = 0;
  for (let i = 0; i < a.length; i += 1) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / (Math.sqrt(na) * Math.sqrt(nb));
}
module.exports = { cosineSimilarity };
