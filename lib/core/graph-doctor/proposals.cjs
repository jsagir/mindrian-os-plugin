'use strict';
/*
 * lib/core/graph-doctor/proposals.cjs -- turns check findings into PROPOSALS and writes
 * a queue file. Proposals are never written to room.db. Every proposal is status
 * 'pending_gate': a human confirms or rejects it (Canon Part 9). Confirmed edge writes
 * belong to lib/core/navigation.cjs, the single write chokepoint, not to this module.
 */
const fs = require('node:fs');
const path = require('node:path');

function buildProposals(findings) {
  const out = [];
  for (const t of findings.open_triads || []) {
    out.push({
      kind: 'link',
      from: t.a, to: t.b,
      evidence: { shared_neighbours: t.shared, adamic_adar: t.score },
      label: 'ESTIMATED',
      method: 'open triad, Adamic-Adar over shared neighbours (no null model in v1)',
      status: 'pending_gate',
    });
  }
  for (const d of findings.duplicate_names || []) {
    out.push({
      kind: 'merge_review',
      ids: d.ids, name: d.name,
      evidence: { same_normalised_name: d.name },
      label: 'COMPUTED',
      method: 'identical normalised name on distinct ids',
      status: 'pending_gate',
    });
  }
  for (const id of findings.isolated || []) {
    out.push({
      kind: 'review_isolated',
      id,
      evidence: { edges: 0 },
      label: 'COMPUTED',
      method: 'node with no edge in or out',
      status: 'pending_gate',
    });
  }
  return out;
}

/** Writes the queue under outDir. Returns the file path. Never touches room.db. */
function writeQueue(outDir, proposals, meta) {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, 'graph-doctor-proposals.json');
  const doc = { schema: 'graph-doctor-proposals/1', ...meta, count: proposals.length, proposals };
  fs.writeFileSync(file, JSON.stringify(doc, null, 2), 'utf8');
  return file;
}

module.exports = { buildProposals, writeQueue };
