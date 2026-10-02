'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * lib/core/doctor/canon-backfill-module.cjs - Phase 366-10 (D-16).
 *
 * `/mos:doctor --fix` runs this over EVERY registered room (the cascade flag
 * does not narrow it) and gives each old room the canon handles new rooms get
 * at filing time: for every thing the eureka recall substrate counts, the one
 * resolver (framework, methodology, title, then a ratified room translation)
 * names a canon framework or it does not. A thing that resolves but carries no
 * USES_FRAMEWORK edge gets the framework node minted FIRST and the edge second,
 * through navigation.linkThingToFramework, one transaction per thing. An
 * existing USES_FRAMEWORK edge whose framework:<slug> target has no node row
 * gets its node minted when the slug maps to exactly one canon name; any other
 * target is counted as unmapped and left alone. Exact matches and ratified
 * translations only: no fuzzy matching, no Theo lookup, no network.
 *
 * check(ctx) reads each room through the READ-ONLY navigation door and writes
 * nothing. Its status is 'warn' only when fix() has work to do (the engine runs
 * a fixer only on warn or error); a room with nothing resolvable left reads
 * 'ok', so a second --fix run finds nothing and changes nothing.
 *
 * fix(ctx) reads ctx.check_result.rooms, honors ctx.dryRun, re-scans each room
 * on its own write handle (never trusting a stale check), and returns per-room
 * counts: { room, minted_nodes, written_edges, unmapped_targets }. Counts only
 * in `detail`. One bad room never aborts the sweep (T-233-01 pattern).
 *
 * The room.db door: this directory may not require node:sqlite or room-db.cjs.
 * Every open goes through lib/core/navigation/spine-events.cjs.
 *
 * Canon Part 8: fully local. Canon Part 9: the graph is written only through
 * the navigation chokepoint's node and edge writers.
 */
const fs = require('node:fs');
const path = require('node:path');

const { readRegistry } = require('./shared.cjs');
const {
  openRoomDbForCaller,
  openRoomDbReadOnlyForCaller,
  closeRoomDbForCaller,
} = require('../navigation/spine-events.cjs');
const { FRAMEWORK_NODE_ID } = require('../navigation/reasoning-write.cjs');
const { mintFrameworkNode, linkThingToFramework } = require('../navigation/framework-node.cjs');
const { loadFrameworkNames } = require('../verification-stamp.cjs');

const ORIGIN = 'canon-backfill';

// resolveRoomPath(roomsHome, info): abs_path first, then path, else null.
function resolveRoomPath(roomsHome, info) {
  if (info && typeof info.abs_path === 'string' && info.abs_path.length > 0) return info.abs_path;
  const relPath = info && info.path;
  if (typeof relPath !== 'string' || relPath.length === 0) return null;
  return path.isAbsolute(relPath) ? relPath : path.join(roomsHome, relPath);
}

function hasRoomDb(roomPath) {
  try { return fs.existsSync(path.join(roomPath, '.mindrian', 'room.db')); } catch (_e) { return false; }
}

// slug -> the canon names that produce it, so a target maps only when exactly
// one name does.
function slugIndex(names) {
  const bySlug = new Map();
  for (const name of names) {
    const id = FRAMEWORK_NODE_ID(name);
    if (id === null) continue;
    if (!bySlug.has(id)) bySlug.set(id, []);
    bySlug.get(id).push(name);
  }
  return bySlug;
}

/*
 * scanRoom(db, roomPath, names) -> the work list for one open room handle:
 *   toLink          [{ id, canon }]    things that resolve and carry no edge
 *   mintTargets     [canonName]        edge targets lacking a node, exactly-one mapping
 *   unmappedTargets number             edge targets lacking a node, no single mapping
 * Throws when the room cannot be read; the caller soft-fails that room.
 */
function scanRoom(db, roomPath, names) {
  const { buildSubstrate } = require('../research-planner/perspectives/eureka-recall.cjs');
  const substrate = buildSubstrate(db, { roomDir: roomPath });

  const linked = new Set();
  substrate.edges.forEach(function (e) {
    if (e.type === 'USES_FRAMEWORK' && substrate.framework_nodes[e.target]) linked.add(e.source);
  });
  const toLink = [];
  substrate.things.forEach(function (t) {
    if (t.canon_handle && !linked.has(t.id) && names.has(t.canon_handle)) toLink.push({ id: t.id, canon: t.canon_handle });
  });

  const bySlug = slugIndex(names);
  const targets = db.prepare(
    "SELECT DISTINCT e.target AS target FROM edges e WHERE e.type = 'USES_FRAMEWORK' "
    + 'AND NOT EXISTS (SELECT 1 FROM nodes n WHERE n.id = e.target)'
  ).all();
  const mintTargets = [];
  let unmappedTargets = 0;
  targets.forEach(function (row) {
    const hit = bySlug.get(row.target);
    if (hit && hit.length === 1) mintTargets.push(hit[0]); else unmappedTargets += 1;
  });
  return { toLink, mintTargets, unmappedTargets };
}

/*
 * check(ctx) -> { status, detail, scope, rooms }. Read-only. ctx.flags is
 * ignored on purpose: D-16 says every registered room.
 */
function check(_ctx) {
  const reg = readRegistry();
  if (!reg) {
    return { status: 'skip', detail: 'no registry at ~/MindrianRooms/.rooms/registry.json (or MINDRIAN_ROOMS_HOME)', scope: 'all', rooms: [] };
  }
  const roomsHome = reg.roomsHome;
  const registered = (reg.registry && reg.registry.rooms) || {};
  const names = loadFrameworkNames();

  const rooms = [];
  for (const name of Object.keys(registered)) {
    try {
      // Inside the try on purpose (T-366-38): a malformed registry entry
      // soft-fails this room, never the sweep.
      const roomPath = resolveRoomPath(roomsHome, registered[name]);
      if (!roomPath) continue;
      if (!hasRoomDb(roomPath)) {
        rooms.push({ room: name, roomPath, has_db: false, resolvable_without_edge: 0, edge_targets_without_node: 0, unmapped_targets: 0 });
        continue;
      }
      let db = null;
      try {
        db = openRoomDbReadOnlyForCaller(roomPath);
        if (!db) throw new Error('room.db could not be opened');
        const scan = scanRoom(db, roomPath, names);
        rooms.push({
          room: name,
          roomPath,
          has_db: true,
          resolvable_without_edge: scan.toLink.length,
          edge_targets_without_node: scan.mintTargets.length,
          unmapped_targets: scan.unmappedTargets,
        });
      } finally {
        closeRoomDbForCaller(db);
      }
    } catch (_e) {
      rooms.push({ room: name, roomPath: null, has_db: false, unreadable: true, resolvable_without_edge: 0, edge_targets_without_node: 0, unmapped_targets: 0 });
    }
  }

  const resolvable = rooms.reduce((n, r) => n + r.resolvable_without_edge, 0);
  const targets = rooms.reduce((n, r) => n + r.edge_targets_without_node, 0);
  const unmapped = rooms.reduce((n, r) => n + r.unmapped_targets, 0);
  const unreadable = rooms.filter((r) => r.unreadable).length;
  const detail = rooms.length + ' room(s) in the registry: ' + resolvable + ' thing(s) resolve to a canon framework without an edge, '
    + targets + ' framework edge target(s) without a node, ' + unmapped + ' target(s) with no single canon name'
    + (unreadable > 0 ? ', ' + unreadable + ' room(s) not readable' : '')
    + ((resolvable + targets) > 0 ? '; run /mos:doctor --fix' : '');

  return {
    // warn only when fix() has work; the engine runs a fixer on warn or error.
    status: (resolvable + targets) > 0 ? 'warn' : 'ok',
    detail,
    scope: 'all',
    rooms,
  };
}

function rowExists(db, sql, params) {
  try { return !!db.prepare(sql).get(...params); } catch (_e) { return false; }
}

function inTransaction(db, body) {
  db.exec('BEGIN');
  let res;
  try {
    res = body();
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch (_r) { /* already closed */ }
    throw e;
  }
  if (res && res.ok === false) {
    try { db.exec('ROLLBACK'); } catch (_r) { /* already closed */ }
    return res;
  }
  db.exec('COMMIT');
  return res;
}

/*
 * fixRoom(db, roomPath, names, dryRun) -> { minted_nodes, written_edges, unmapped_targets, errors }.
 * dryRun counts what a real run would write and writes nothing.
 */
function fixRoom(db, roomPath, names, dryRun) {
  const scan = scanRoom(db, roomPath, names);
  const out = { minted_nodes: 0, written_edges: 0, unmapped_targets: scan.unmappedTargets, errors: [] };
  const mintedNow = new Set();

  function nodeAbsent(canon) {
    const id = FRAMEWORK_NODE_ID(canon);
    return !mintedNow.has(id) && !rowExists(db, 'SELECT 1 FROM nodes WHERE id = ?', [id]);
  }

  for (const item of scan.toLink) {
    const nodeId = FRAMEWORK_NODE_ID(item.canon);
    const needsNode = nodeAbsent(item.canon);
    const needsEdge = !rowExists(db, "SELECT 1 FROM edges WHERE source = ? AND target = ? AND type = 'USES_FRAMEWORK'", [item.id, nodeId]);
    if (dryRun) {
      if (needsNode) { out.minted_nodes += 1; mintedNow.add(nodeId); }
      if (needsEdge) out.written_edges += 1;
      continue;
    }
    try {
      const res = inTransaction(db, function () {
        const r = linkThingToFramework(db, item.id, item.canon, ORIGIN, { names });
        return r && r.ok === true ? r : { ok: false, reason: (r && r.reason) || 'write_failed' };
      });
      if (res.ok === true) {
        if (needsNode) { out.minted_nodes += 1; mintedNow.add(nodeId); }
        if (needsEdge) out.written_edges += 1;
      } else {
        out.errors.push({ id: item.id, reason: res.reason });
      }
    } catch (e) {
      out.errors.push({ id: item.id, reason: String((e && e.message) || 'write threw').slice(0, 120) });
    }
  }

  for (const canon of scan.mintTargets) {
    const nodeId = FRAMEWORK_NODE_ID(canon);
    if (!nodeAbsent(canon)) continue;
    if (dryRun) { out.minted_nodes += 1; mintedNow.add(nodeId); continue; }
    try {
      const res = inTransaction(db, function () {
        const r = mintFrameworkNode(db, canon);
        return r && r.ok === true ? r : { ok: false, reason: (r && r.reason) || 'write_failed' };
      });
      if (res.ok === true) { out.minted_nodes += 1; mintedNow.add(nodeId); } else out.errors.push({ id: nodeId, reason: res.reason });
    } catch (e) {
      out.errors.push({ id: nodeId, reason: String((e && e.message) || 'write threw').slice(0, 120) });
    }
  }
  return out;
}

/*
 * fix(ctx) -> { status, healed, projected, recoveries, errors, rooms, detail }.
 */
function fix(ctx) {
  const c = ctx || {};
  const dryRun = !!c.dryRun;
  const entries = Array.isArray(c.check_result && c.check_result.rooms) ? c.check_result.rooms : [];
  const names = loadFrameworkNames();

  const rooms = [];
  const recoveries = [];
  const errors = [];
  let healed = 0;
  let projected = 0;

  for (const entry of entries) {
    if (!entry || !entry.roomPath || entry.has_db === false) continue;
    let db = null;
    try {
      db = dryRun ? openRoomDbReadOnlyForCaller(entry.roomPath) : openRoomDbForCaller(entry.roomPath);
      if (!db) throw new Error('room.db could not be opened');
      const r = fixRoom(db, entry.roomPath, names, dryRun);
      rooms.push({ room: entry.room, minted_nodes: r.minted_nodes, written_edges: r.written_edges, unmapped_targets: r.unmapped_targets });
      r.errors.forEach(function (e) { errors.push({ room: entry.room, reason: e.reason }); });
      const touched = r.minted_nodes + r.written_edges;
      if (touched > 0) {
        projected += 1;
        if (!dryRun) healed += 1;
        recoveries.push({
          room: entry.room,
          status: dryRun ? 'projected' : 'ok',
          detail: (dryRun ? 'would mint ' : 'minted ') + r.minted_nodes + ' framework node(s) and '
            + (dryRun ? 'write ' : 'wrote ') + r.written_edges + ' edge(s) for ' + entry.room,
        });
      }
    } catch (e) {
      errors.push({ room: entry.room, reason: String((e && e.message) || 'room could not be backfilled').slice(0, 120) });
    } finally {
      closeRoomDbForCaller(db);
    }
  }

  const nodes = rooms.reduce((n, r) => n + r.minted_nodes, 0);
  const edges = rooms.reduce((n, r) => n + r.written_edges, 0);
  return {
    status: errors.length > 0 ? 'warn' : 'ok',
    healed,
    projected,
    recoveries,
    errors,
    rooms,
    detail: 'canon-backfill fix: ' + nodes + ' framework node(s) and ' + edges + ' edge(s) '
      + (dryRun ? 'would be written' : 'written') + ' across ' + rooms.length + ' room(s); '
      + errors.length + ' error(s)' + (dryRun ? ' (dry-run)' : ''),
  };
}

module.exports = { check, fix };
