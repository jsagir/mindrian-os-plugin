'use strict';
/*
 * lib/core/graph-doctor/index.cjs -- read (via chokepoint) -> check -> propose -> queue.
 * Writes nothing to room.db. Never throws. Async (the chokepoint read is async).
 */
const path = require('node:path');
const { readRoomGraph } = require('./reader.cjs');
const { runChecks } = require('./checks.cjs');
const { buildProposals, writeQueue } = require('./proposals.cjs');

async function runGraphDoctor(roomDir, opts = {}) {
  const snap = await readRoomGraph(roomDir);
  if (snap.status !== 'ok') return { status: 'skip', reason: snap.reason };
  const findings = runChecks(snap);
  const proposals = buildProposals(findings);
  const outDir = opts.outDir || path.join(path.resolve(roomDir), '.mindrian', 'graph-doctor');
  const file = writeQueue(outDir, proposals, {
    room: path.resolve(roomDir), counts: findings.counts, read_via: snap.via,
    dropped_edges: snap.dropped_edges, excluded_types: snap.excluded,
  });
  return {
    status: proposals.length ? 'warn' : 'ok',
    counts: findings.counts,
    isolated: findings.isolated.length,
    duplicate_name_groups: findings.duplicate_names.length,
    open_triads: findings.open_triads.length,
    proposals: proposals.length,
    queue_file: file,
    dropped_edges: snap.dropped_edges,
  };
}

module.exports = { runGraphDoctor };
