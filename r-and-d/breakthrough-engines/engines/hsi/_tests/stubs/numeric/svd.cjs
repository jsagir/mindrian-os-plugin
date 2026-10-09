'use strict';
// Test stub for lib/core/numeric/svd.cjs: eigen-decompose the Gram matrix X X^T by Jacobi rotations.
function truncatedSvdWithSignFlip(X, k) {
  const n = X.length;
  const G = X.map((a) => X.map((b) => a.reduce((s, v, i) => s + v * b[i], 0)));
  const V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 60; sweep += 1) {
    let off = 0;
    for (let p = 0; p < n; p += 1) for (let q = p + 1; q < n; q += 1) off += G[p][q] * G[p][q];
    if (off < 1e-24) break;
    for (let p = 0; p < n; p += 1) for (let q = p + 1; q < n; q += 1) {
      if (Math.abs(G[p][q]) < 1e-300) continue;
      const theta = (G[q][q] - G[p][p]) / (2 * G[p][q]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1); const s = t * c;
      for (let r = 0; r < n; r += 1) { const a = G[r][p]; const b = G[r][q]; G[r][p] = c * a - s * b; G[r][q] = s * a + c * b; }
      for (let r = 0; r < n; r += 1) { const a = G[p][r]; const b = G[q][r]; G[p][r] = c * a - s * b; G[q][r] = s * a + c * b; }
      for (let r = 0; r < n; r += 1) { const a = V[r][p]; const b = V[r][q]; V[r][p] = c * a - s * b; V[r][q] = s * a + c * b; }
    }
  }
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => G[b][b] - G[a][a]).slice(0, k);
  const singularValues = order.map((i) => Math.sqrt(Math.max(G[i][i], 0)));
  const leftSingularVectors = V.map((row) => order.map((i) => row[i]));
  return { ok: true, singularValues, leftSingularVectors, components: [] };
}
module.exports = { truncatedSvdWithSignFlip };
