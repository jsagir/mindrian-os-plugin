'use strict';
function toArr(x) { return x instanceof Set ? Array.from(x) : Array.from(x || []); }
function pairKey(a, b) { return a < b ? a + '|' + b : b + '|' + a; }
function jaccard(a, b) {
  const A = new Set(toArr(a)); const B = new Set(toArr(b));
  if (A.size === 0 && B.size === 0) return 0;
  let inter = 0; A.forEach((x) => { if (B.has(x)) inter++; });
  return inter / (A.size + B.size - inter);
}
function makeCandidateStore() {
  const rows = new Map();
  return {
    upsert(a, b, lane, o) {
      const k = pairKey(a, b);
      let r = rows.get(k);
      if (!r) { r = { a, b, lanes: [], divergence: (o && o.fields && o.fields.divergence) || 0, shared_entities: [] }; rows.set(k, r); }
      if (lane && r.lanes.indexOf(lane) === -1) r.lanes.push(lane);
      if (o && o.entity) r.shared_entities.push(o.entity);
    },
    get(a, b) { return rows.get(pairKey(a, b)); },
    rows() { return Array.from(rows.values()); },
    excludedKnown() { return 0; },
  };
}
module.exports = { pairKey, jaccard, makeCandidateStore, runTagNow: () => 't', writeRunFiles: () => '/tmp/x', readCandidates: () => [], runDirFor: () => '/tmp/x' };
