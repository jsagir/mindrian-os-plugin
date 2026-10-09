'use strict';
/*
 * lib/core/graph-doctor/reader.cjs -- reads a room's local SQL graph THROUGH the
 * navigation chokepoint (getGraphExport in lib/core/navigation/graph-export.cjs).
 * No direct node:sqlite import: the chokepoint guard (scripts/check-substrate.cjs)
 * forbids it. Async, because the chokepoint is async. Local only (Canon Part 8).
 * The chokepoint's view omits excluded node types and drops edges with a missing
 * endpoint (a legal state). The doctor reports on that view and says so.
 */
const path = require('node:path');
const { getGraphExport } = require('../navigation/graph-export.cjs');

function dbPath(roomDir) {
  return path.join(path.resolve(roomDir), '.mindrian', 'room.db');
}

function idOf(el) { return el && el.data ? el.data.id : undefined; }
function nameOfEl(el) {
  const d = (el && el.data) || {};
  return String(d.label || d.name || d.id || '');
}

/** Resolves { status:'ok', nodes, edges, via } or { status:'skip', reason }. Never throws. */
async function readRoomGraph(roomDir) {
  const { existsSync } = require('node:fs');
  if (!existsSync(dbPath(roomDir))) return { status: 'skip', reason: 'no room.db at ' + dbPath(roomDir) };
  // The chokepoint read can write (schema or journal setup). So it runs on a COPY of
  // room.db in a temp dir, and the live room.db is never opened by this module.
  const fs = require('node:fs');
  const os = require('node:os');
  const copyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-doctor-'));
  let exp;
  try {
    fs.mkdirSync(path.join(copyDir, '.mindrian'));
    const src = dbPath(roomDir);
    fs.copyFileSync(src, path.join(copyDir, '.mindrian', 'room.db'));
    for (const suffix of ['-wal', '-shm']) {
      if (fs.existsSync(src + suffix)) fs.copyFileSync(src + suffix, path.join(copyDir, '.mindrian', 'room.db' + suffix));
    }
    exp = await getGraphExport(copyDir);
  } catch (e) {
    return { status: 'skip', reason: 'chokepoint read failed: ' + String(e.message).slice(0, 160) };
  } finally {
    try { fs.rmSync(copyDir, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  }
  if (!exp || exp.ok === false) {
    return { status: 'skip', reason: 'chokepoint read unavailable: ' + ((exp && exp.error) || 'unknown') };
  }
  const els = exp.elements || { nodes: [], edges: [] };
  const nodes = els.nodes.map((n) => ({ id: idOf(n), type: (n.data && n.data.type) || '', name: nameOfEl(n) }))
    .filter((n) => n.id !== undefined);
  const edges = els.edges.map((e) => ({ source: e.data.source, target: e.data.target, type: (e.data && e.data.type) || '' }));
  return { status: 'ok', nodes, edges, via: 'navigation/graph-export.getGraphExport (on a copy of room.db)', dropped_edges: exp.counts ? exp.counts.dropped_edges : 0, excluded: exp.counts ? exp.counts.excluded : 0 };
}

module.exports = { readRoomGraph, dbPath };
