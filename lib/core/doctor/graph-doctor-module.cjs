'use strict';
/*
 * lib/core/doctor/graph-doctor-module.cjs -- doctor module for the local SQL graph.
 * The doctor engine calls check() synchronously, and the chokepoint read is async.
 * So this module REPORTS the last queue written by scripts/graph-doctor.cjs. It does
 * not read the graph itself. Contract: check(ctx) -> { status:'ok'|'warn'|'skip', detail }.
 * fix_supported:false. NO fix export. Never writes.
 */
const fs = require('node:fs');
const path = require('node:path');

function check(ctx = {}) {
  const roomDir = path.resolve(ctx.roomDir || ctx.room || process.cwd());
  const file = path.join(roomDir, '.mindrian', 'graph-doctor', 'graph-doctor-proposals.json');
  if (!fs.existsSync(file)) {
    return { status: 'skip', detail: 'no graph-doctor queue yet; run: node scripts/graph-doctor.cjs ' + roomDir };
  }
  let q;
  try { q = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
    return { status: 'skip', detail: 'graph-doctor queue unreadable: ' + String(e.message).slice(0, 120) };
  }
  const c = q.counts || {};
  const detail = `last run: ${c.nodes || 0} nodes, ${c.edges || 0} edges; ${q.count || 0} proposal(s) pending gate at ${file}`;
  return { status: q.count ? 'warn' : 'ok', detail };
}

module.exports = { check };
