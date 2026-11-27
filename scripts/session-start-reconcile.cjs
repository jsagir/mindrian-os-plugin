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


// Plan 400.3-06c (review B-b, M3): run one block's runner call. With a handle, the call runs inside one
// navigation.withRoomTx (one wait for the write lock, all or nothing); a busy throw trips the process cap
// (noteBusy), writes 'session-start-reconcile: <block> room_db_busy: skipped' and gives { busy: true }. With no
// handle the call runs as at BASE, outside withRoomTx. Any other throw goes to the block's own catch.
function inRoomTx(db, blockName, fn) {
  if (!db) return { value: fn() };
  try {
    var navigation = require(path.join(__dirname, '..', 'lib', 'core', 'navigation.cjs'));
    return { value: navigation.withRoomTx(db, fn) };
  } catch (e) {
    // Wave 2 Goldfish W2-CD-03: the one busy test (lib/core/hook-busy-cap.cjs isBusyError).
    if (!require(path.join(__dirname, '..', 'lib', 'core', 'hook-busy-cap.cjs')).isBusyError(e)) throw e;
    try { require(path.join(__dirname, '..', 'lib', 'core', 'hook-busy-cap.cjs')).noteBusy(); } catch (_) { /* tolerant */ }
    process.stderr.write('session-start-reconcile: ' + blockName + ' room_db_busy: skipped\n');
    return { busy: true };
  }
}

// Wave 2 Goldfish W2-D-04: blocks 1 and 2 read FEYNMAN.md, render from room.db (reads need no write lock in WAL)
// and write the file OUTSIDE the transaction; their only room.db writes are memory events, which the runner puts
// in a sink. The events are logged in one short withRoomTx after the render, so the write lock is held for the
// inserts only, not for the file reads and the render. No event: no transaction, no wait.
function refreshWithEventSink(db, blockName, runRefresh) {
  if (!db) return { value: runRefresh(null) };
  var sink = [];
  var value = runRefresh(sink);
  if (sink.length === 0) return { value: value };
  var navigation = require(path.join(__dirname, '..', 'lib', 'core', 'navigation.cjs'));
  var logged = inRoomTx(db, blockName, function () {
    for (var i = 0; i < sink.length; i += 1) {
      try { navigation.logMemoryEvent(db, sink[i].type, sink[i].payload); } catch (_) { /* as the runner: a log failure does not undo the landed write */ }
    }
  });
  return logged.busy ? { value: value, busy: true } : { value: value };
}

// Block 1: feynman timeline refresh (Phase 124). Plugin root form: pluginRootForNode.
function refreshTimeline(ctx) {
  try {
    var roomDir = resolveRoomDir(ctx.room);
    if (!roomDir) return;
    var db = openRoomDb(roomDir);
    var runner = require(ctx.pluginRootForNode + '/lib/core/feynman/timeline-runner.cjs');
    var run;
    try { run = refreshWithEventSink(db, 'refreshTimeline', function (sink) { return runner.refreshAll(roomDir, sink ? { db: db, eventSink: sink } : { db: db }); }); }
    finally { if (db) { try { db.close(); } catch (_) {} } }
    var result = run.value;
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
    var run;
    try { run = refreshWithEventSink(db, 'refreshDialMemory', function (sink) { return runner.refreshAll(roomDir, sink ? { db: db, eventSink: sink } : { db: db }); }); }
    finally { if (db) { try { db.close(); } catch (_) {} } }
    var result = run.value;
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
    // Wave 2 Goldfish W2-D-04: read every planning file before the transaction (the Phase 367 rule).
    if (typeof runner.preparePlanningArtifacts === 'function') reconcileOpts.prepared = runner.preparePlanningArtifacts(roomDir, reconcileOpts);
    var run;
    try { run = inRoomTx(db, 'reconcileGsdPlanning', function () { return runner.reconcilePlanningArtifacts(roomDir, reconcileOpts); }); }
    finally { try { db.close(); } catch (_) {} }
    var result = run.value;
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
    // Wave 2 Goldfish W2-D-04: read and parse every memory file before the transaction (the Phase 367 rule).
    if (typeof runner.prepareMemoryArtifacts === 'function') reconcileOpts.prepared = runner.prepareMemoryArtifacts(roomDir, reconcileOpts);
    var run;
    try { run = inRoomTx(db, 'reconcileMemoryCortex', function () { return runner.reconcileMemoryArtifacts(roomDir, reconcileOpts); }); }
    finally { try { db.close(); } catch (_) {} }
    var result = run.value;
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
  // Plan 400.3-06c: the process cap keeps the 5000 ms wait for the first block and trips to 0 after the first busy.
  try {
    var busyCap = require(path.join(__dirname, '..', 'lib', 'core', 'hook-busy-cap.cjs'));
    busyCap.setHookBusyCap(busyCap.DEFAULT_BUSY_MS);
  } catch (_) { /* the default wait stays */ }
  try { runAll(ctxFromEnv(process.env)); } catch (_) { /* best effort: never fail session start */ }
  process.exitCode = 0;
}

module.exports = { runAll, ctxFromEnv, refreshTimeline, refreshDialMemory, reconcileGsdPlanning, reconcileMemoryCortex, DEFAULT_BLOCKS };
