'use strict';
/*
 * lib/core/graph-doctor/checks.cjs -- pure, deterministic checks on a graph snapshot
 * { nodes:[{id,type,name}], edges:[{source,target,type}] }. No I/O. No model calls.
 * Labels: structural counts are COMPUTED; open-triad scores are ESTIMATED (heuristic,
 * no degree-preserving null in v1).
 * An edge whose endpoint node is missing is LEGAL (lib/core/navigation/CONTEXT.md).
 * It is never reported as a defect here.
 */

function adjacency(snap) {
  const ids = new Set(snap.nodes.map((n) => n.id));
  const adj = new Map();
  for (const id of ids) adj.set(id, new Set());
  for (const e of snap.edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) continue; // legal dangling edge: skip
    if (e.source === e.target) continue;
    adj.get(e.source).add(e.target);
    adj.get(e.target).add(e.source);
  }
  return adj;
}

function isolatedNodes(snap) {
  const adj = adjacency(snap);
  return snap.nodes.filter((n) => adj.get(n.id).size === 0).map((n) => n.id);
}

function duplicateNames(snap) {
  const byName = new Map();
  for (const n of snap.nodes) {
    const k = String(n.name || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!k) continue;
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(n.id);
  }
  return [...byName.entries()].filter(([, ids]) => ids.length > 1)
    .map(([name, ids]) => ({ name, ids }));
}

/** Open triads: unlinked pairs with >=2 shared neighbours, Adamic-Adar scored (ESTIMATED). */
function openTriads(snap, { minShared = 2, top = 20 } = {}) {
  const adj = adjacency(snap);
  const ids = [...adj.keys()];
  const out = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i], b = ids[j];
      if (adj.get(a).has(b)) continue;
      const shared = [...adj.get(a)].filter((z) => adj.get(b).has(z));
      if (shared.length < minShared) continue;
      let score = 0;
      for (const z of shared) {
        const d = adj.get(z).size;
        if (d > 1) score += 1 / Math.log(d);
      }
      out.push({ a, b, shared: shared.sort(), score: Number(score.toFixed(4)) });
    }
  }
  out.sort((x, y) => y.score - x.score || (x.a + x.b).localeCompare(y.a + y.b));
  return out.slice(0, top);
}

function runChecks(snap) {
  return {
    counts: { nodes: snap.nodes.length, edges: snap.edges.length },
    isolated: isolatedNodes(snap),
    duplicate_names: duplicateNames(snap),
    open_triads: openTriads(snap),
  };
}

module.exports = { runChecks, isolatedNodes, duplicateNames, openTriads, adjacency };
