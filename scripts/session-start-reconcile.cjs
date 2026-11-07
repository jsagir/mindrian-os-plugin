#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 384 plan 14 (S1, PERF384-F03). The four best-effort reconcile blocks of scripts/session-start
 * (feynman timeline refresh, dial memory refresh, gsd planning-artifact reconcile, memory-cortex reconcile)
 * used to run as four `node -e` processes that each loaded the same navigation modules. They run here in
 * one process, in the same order, each inside its own try block, so one failing block does not stop the others.
 *
 * Canon Part 8: LOCAL only. Every block reads room data through lib/core/navigation.cjs (via its runner) and
 * writes only to the room. Nothing here opens a network connection or sends room bytes anywhere.
 *
 * Input (environment variables, read as data, never put into a command string):
 *   ACTIVE_ROOM_FOR_RECONCILE      the room directory of the shell (may be empty: the registry resolver is used)
 *   PLUGIN_ROOT_FOR_NODE_RECONCILE plugin root in the form the timeline and dial-memory blocks used
 *   PLUGIN_ROOT_RECONCILE          plugin root in the form the gsd and memory-cortex blocks used
 * Output: nothing on stdout. Progress lines go to stderr (the shell discards them). Exit code is always 0.
 *
 * Each function body is the body of the old inline code, moved without a change of logic. Every
 * process.exit(0) of the inline code is a return here, because an exit would stop the later blocks.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Resolve the active room: prefer the room of the shell; otherwise fall back to the registry resolver
// (mirror of scripts/brain-derive-command.cjs). Returns null where the old code called process.exit(0).
function resolveRoomDir(shellRoom) {
  var roomDir = shellRoom || '';
  if (!roomDir) {
    var roomsRoot = process.env.MINDRIAN_ROOMS_ROOT
      || process.env.MINDRIAN_ROOMS_HOME
      || path.join(os.homedir(), 'MindrianRooms');
    var regPath = path.join(roomsRoot, '.rooms', 'registry.json');
    if (!fs.existsSync(regPath)) return null;
    var reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
    if (!reg || !reg.active || !reg.rooms || !reg.rooms[reg.active]) return null;
    roomDir = path.resolve(roomsRoot, reg.rooms[reg.active].path || reg.active);
  }
  if (!fs.existsSync(roomDir)) return null;
  return roomDir;
}

// Open room.db when it exists; null when it does not or cannot be opened. The plain handle (no extra options)
// is the one the old inline blocks opened. It comes from resolveRoomDb of scripts/feynman-timeline-refresh-command.cjs
// (reuse before build, Canon Part 7): that helper is the existing, documented opener for exactly this call, and
// scripts/check-substrate.cjs blocks a new direct node:sqlite require in a script.
function openRoomDb(roomDir) {
  try {
    return require('./feynman-timeline-refresh-command.cjs').resolveRoomDb(roomDir);
  } catch (_) { return null; }
}

// Block 1: feynman timeline refresh (Phase 124). Plugin root form: pluginRootForNode.
function refreshTimeline(ctx) {
  try {
    var roomDir = resolveRoomDir(ctx.room);
    if (!roomDir) return;
    var db = openRoomDb(roomDir);
    var runner = require(ctx.pluginRootForNode + '/lib/core/feynman/timeline-runner.cjs');
    var result = runner.refreshAll(roomDir, { db: db });
    if (db) { try { db.close(); } catch (_) {} }
    if (result && result.refreshed && result.refreshed.length > 0) {
      process.stderr.write('feynman-timeline-refresh: ' + result.refreshed.length + ' section(s) refreshed\n');
    }
  } catch (e) {
    process.stderr.write('feynman-timeline-refresh failed: ' + (e && e.message) + '\n');
  }
}

// Block 2: dial memory refresh (Phase 143.1-05). Plugin root form: pluginRootForNode.
function refreshDialMemory(ctx) {
  try {
    var roomDir = resolveRoomDir(ctx.room);
    if (!roomDir) return;
    var db = openRoomDb(roomDir);
    var runner = require(ctx.pluginRootForNode + '/lib/core/feynman/dial-memory-runner.cjs');
    var result = runner.refreshAll(roomDir, { db: db });
    if (db) { try { db.close(); } catch (_) {} }
    if (result && result.refreshed && result.refreshed.length > 0) {
      process.stderr.write('dial-memory-refresh: ' + result.refreshed.length + ' section(s) refreshed\n');
    }
  } catch (e) {
    process.stderr.write('dial-memory-refresh failed: ' + (e && e.message) + '\n');
  }
}

// Block 3: gsd planning-artifact reconcile (Phase 149). Plugin root form: pluginRoot.
function reconcileGsdPlanning(ctx) {
  try {
    var roomDir = resolveRoomDir(ctx.room);
    if (!roomDir) return;
    var db = openRoomDb(roomDir);
    if (!db) return;
    var pluginRoot = ctx.pluginRoot || '';
    var runner = require(pluginRoot + '/lib/core/planning/reconcile-runner.cjs');
    // Dog-food: when the active room IS the plugin workspace, reconcile the plugins OWN .planning tree
    // (it lives at PLUGIN_ROOT/.planning, not ROOM_DIR/.planning). Detect by comparing resolved paths.
    var reconcileOpts = { db: db };
    try {
      if (pluginRoot && path.resolve(roomDir) === path.resolve(pluginRoot)) {
        reconcileOpts.planningDir = path.join(pluginRoot, '.planning');
      }
    } catch (_) {}
    var result = runner.reconcilePlanningArtifacts(roomDir, reconcileOpts);
    try { db.close(); } catch (_) {}
    if (result && result.upserted > 0) {
      process.stderr.write('gsd-planning-reconcile: ' + result.upserted + ' artifact node(s) upserted, '
        + result.requirement_nodes + ' requirement node(s), ' + result.edges + ' lineage edge(s)\n');
    }
  } catch (e) {
    process.stderr.write('gsd-planning-reconcile failed: ' + (e && e.message) + '\n');
  }
}

// Block 4: memory-cortex reconcile (Phase 150). Plugin root form: pluginRoot.
function reconcileMemoryCortex(ctx) {
  try {
    var roomDir = resolveRoomDir(ctx.room);
    if (!roomDir) return;
    var db = openRoomDb(roomDir);
    if (!db) return;
    var pluginRoot = ctx.pluginRoot || '';
    var runner = require(pluginRoot + '/lib/core/memory/reconcile-memory-runner.cjs');
    // Dog-food: when the active room IS the plugin workspace, reconcile the plugins OWN per-folder memory
    // files (PLUGIN_ROOT as the section root, not ROOM_DIR). Detect by comparing resolved paths.
    var reconcileOpts = { db: db };
    try {
      if (pluginRoot && path.resolve(roomDir) === path.resolve(pluginRoot)) {
        reconcileOpts.sectionRoot = pluginRoot;
      }
    } catch (_) {}
    var result = runner.reconcileMemoryArtifacts(roomDir, reconcileOpts);
    try { db.close(); } catch (_) {}
    if (result && result.upserted > 0) {
      process.stderr.write('memory-cortex-reconcile: ' + result.upserted + ' memory node(s) upserted, '
        + (result.unchanged || 0) + ' unchanged, '
        + result.decision_nodes + ' decision node(s), ' + result.edges + ' cortex edge(s)\n');
    }
  } catch (e) {
    process.stderr.write('memory-cortex-reconcile failed: ' + (e && e.message) + '\n');
  }
}

const DEFAULT_BLOCKS = [refreshTimeline, refreshDialMemory, reconcileGsdPlanning, reconcileMemoryCortex];

// runAll(ctx, blocks): run the blocks in the given order, each in its own try block. Writes nothing to
// stdout. Returns one result per block: { name, ok }.
function runAll(ctx, blocks) {
  var list = Array.isArray(blocks) ? blocks : DEFAULT_BLOCKS;
  var results = [];
  for (var i = 0; i < list.length; i += 1) {
    var fn = list[i];
    var name = (fn && fn.name) || ('block' + i);
    var ok = true;
    try {
      fn(ctx);
    } catch (e) {
      ok = false;
      try { process.stderr.write('session-start-reconcile: ' + name + ' failed: ' + (e && e.message) + '\n'); } catch (_) {}
    }
    results.push({ name: name, ok: ok });
  }
  return results;
}

function ctxFromEnv(env) {
  return {
    room: env.ACTIVE_ROOM_FOR_RECONCILE || '',
    pluginRootForNode: env.PLUGIN_ROOT_FOR_NODE_RECONCILE || '',
    pluginRoot: env.PLUGIN_ROOT_RECONCILE || '',
  };
}

if (require.main === module) {
  try { runAll(ctxFromEnv(process.env)); } catch (_) { /* best effort: never fail session start */ }
  process.exitCode = 0;
}

module.exports = { runAll, ctxFromEnv, refreshTimeline, refreshDialMemory, reconcileGsdPlanning, reconcileMemoryCortex, DEFAULT_BLOCKS };
