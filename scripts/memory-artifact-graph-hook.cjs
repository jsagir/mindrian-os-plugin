#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 150-03 Task 3 (MEM-01, D-01) -- the user-memory PostToolUse hook (the
 * cortex twin of scripts/gsd-artifact-graph-hook.cjs).
 *
 * The CLI IMMEDIACY half of D-01 (the hybrid trigger): when a CLI user writes a
 * per-folder memory MD file (one of {ROOM,STATE,MINTO,BRAIN,FEYNMAN,USER}.md via
 * Write|Edit|MultiEdit), this hook fires and lands the cortex IMMEDIATELY -- the
 * memory_artifact node + governing_thought / navigator_persona / decision
 * projections + lineage edges -- so the graph is current before the next
 * session-start. The session-start reconcile slot remains the UNIVERSAL net for
 * Desktop / Cowork, which have no PostToolUse hook (the tri-polar coverage).
 *
 * It calls the SAME reconcileMemoryArtifacts function the session-start slot
 * calls -- it does NOT reimplement reconcile logic. Because that reconcile is
 * idempotent (every node/edge write is an upsert on a stable id, the 150-01
 * contract), a write the hook catches AND a later session-start reconcile
 * produce EXACTLY one node and one edge set: no double-write by construction
 * (threat T-150-03-03).
 *
 * reconcile-memory-runner.cjs calls the FULL idempotent reconcile (correctness
 * over speed; the full pass is cheap and cannot duplicate).
 *
 * Gating: fires ONLY when the written path's basename is one of the six exact
 * memory basenames (threat T-150-03-04 -- elevation of privilege; the
 * attacker-influenceable file_path is gated before any room work). For any other
 * path it is a no-op exit 0.
 *
 * Graceful degradation (threat T-150-03-02 -- DoS): the whole body is wrapped in
 * try/catch, the db handle is closed in finally, and the process exits 0 ALWAYS.
 * A hook failure must NEVER block the user's write.
 *
 * Canon Part 8 (zero Brain egress): no network surface. No brain-client, no
 *   node:http / node:https, no fetch. The reconcile reads room DATA only via
 *   navigation.cjs and the memory markdown source-of-meaning locally.
 * Canon Part 9 (navigation chokepoint): room.db is touched only via the
 *   reconcile, which writes only through navigation.cjs.
 *
 * Mirrors scripts/gsd-artifact-graph-hook.cjs verbatim (stdin JSON -> file_path;
 * resolve room; lazy node:sqlite open; best-effort; exit 0 always), swapping the
 * strict .planning gate for the strict six-basename memory gate.
 *
 * Plan 400.3-06c: the hook opens room.db through the one script opener
 * (feynman-timeline-refresh-command.cjs resolveRoomDb) with the hook cap of
 * 750 ms, and runs the whole reconcile inside one navigation.withRoomTx. So N
 * memory files cost 1 wait, not N waits, and the reconcile lands all or
 * nothing (review B-b). The run then holds the write lock for its whole
 * length; tests/test-400-3-room-db-scripts.cjs K6 measures that hold (review
 * M4). Canon Part 9: no new SQLite open site; the writes still go through
 * navigation.cjs. On a held lock the hook writes a typed room_db_busy line.
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE). Pure CJS, node built-ins + the
 * memory reconcile-runner.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
// 260917-dia (Task C): the ONE shared MINDRIAN_ROOMS_HOME-then-ROOT env
// precedence resolver (HOME is the intended primary name per docs).
const { roomsHomeEnv } = require(path.join(__dirname, '..', 'lib', 'core', 'rooms-home-env.cjs'));

// The six per-folder memory basenames. The gate is an exact-basename match
// (case-exact: state.md does NOT match STATE.md), cross-platform normalized for
// backslashes. Any other path is a no-op exit 0.
const MEMORY_BASENAMES = Object.freeze([
  'ROOM.md', 'STATE.md', 'MINTO.md', 'BRAIN.md', 'FEYNMAN.md', 'USER.md',
]);

function isMemoryMarkdown(filePath) {
  if (typeof filePath !== 'string' || filePath.length === 0) return false;
  // Normalize backslashes so a Windows path resolves its basename correctly.
  const normalized = filePath.replace(/\\/g, '/');
  const base = normalized.slice(normalized.lastIndexOf('/') + 1);
  return MEMORY_BASENAMES.indexOf(base) !== -1;
}

// realOrResolve -- realpath of the nearest existing ancestor plus the missing
// tail (a Write may name a file that does not exist yet). Falls back to
// path.resolve on any error. Phase 386 plan 16 (B14).
function realOrResolve(p) {
  const abs = path.resolve(p);
  let head = abs;
  const tail = [];
  for (let i = 0; i < 64; i += 1) {
    try {
      return path.join(fs.realpathSync(head), ...tail.slice().reverse());
    } catch (_e) {
      const parent = path.dirname(head);
      if (parent === head) return abs;
      tail.push(path.basename(head));
      head = parent;
    }
  }
  return abs;
}

// isInsideRoom -- true only when the written file lies inside the room
// directory (both sides realpath-resolved, so a symlink or a ".." segment
// cannot point outside). Phase 386 plan 16 (B14, T-386-16-01).
function isInsideRoom(filePath, roomDir) {
  try {
    const rel = path.relative(realOrResolve(roomDir), realOrResolve(filePath));
    if (rel === '' || rel === '..' || rel.startsWith('..' + path.sep)) return false;
    return !path.isAbsolute(rel);
  } catch (_e) {
    return false;
  }
}

// readStdin -- the Claude Code PostToolUse hook contract delivers a JSON payload
// on stdin with tool_name + tool_input.file_path (mirror of the gsd hook).
function readStdin() {
  try {
    const data = fs.readFileSync(0, 'utf8');
    if (!data) return {};
    return JSON.parse(data);
  } catch (_e) {
    return {};
  }
}

// resolveRoomDir -- prefer the explicit env room (CLI hook contract), else fall
// back to the MindrianRooms registry active room. Mirror of the gsd hook
// resolver -- the SAME registry, no new resolver added.
function resolveRoomDir() {
  const envRoom = process.env.CLAUDE_ROOM_DIR ||
                  process.env.CLAUDE_ACTIVE_ROOM ||
                  process.env.ROOM_DIR ||
                  '';
  if (envRoom && fs.existsSync(envRoom)) return envRoom;

  try {
    const roomsRoot = roomsHomeEnv() ||
                      path.join(os.homedir(), 'MindrianRooms');
    const regPath = path.join(roomsRoot, '.rooms', 'registry.json');
    if (!fs.existsSync(regPath)) return '';
    const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
    if (!reg || !reg.active || !reg.rooms || !reg.rooms[reg.active]) return '';
    const rd = path.resolve(roomsRoot, reg.rooms[reg.active].path || reg.active);
    return fs.existsSync(rd) ? rd : '';
  } catch (_e) {
    return '';
  }
}

// resolvePluginRoot -- the plugin workspace root (this file lives in scripts/).
function resolvePluginRoot() {
  return process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
}

function runHook() {
  // Plan 400.3-06c: the hook process waits at most the hook cap (750 ms) for room.db.
  try {
    const busyCap = require(path.join(__dirname, '..', 'lib', 'core', 'hook-busy-cap.cjs'));
    busyCap.setHookBusyCap(busyCap.HOOK_BUSY_MS);
  } catch (_e) { /* the default wait stays */ }
  const input = readStdin();
  const tool = String((input && input.tool_name) || '');
  if (tool !== 'Write' && tool !== 'Edit' && tool !== 'MultiEdit') return;

  const filePath = String((input.tool_input && input.tool_input.file_path) || '');
  if (!filePath) return;

  // Strict six-basename gate -- skip-fast for any other path (no-op exit 0).
  if (!isMemoryMarkdown(filePath)) return;

  const roomDir = resolveRoomDir();
  if (!roomDir) return;

  // B14: the basename gate alone is not a scope. Reconcile only the room that
  // owns the written file; a memory-named file in another room or another
  // repository causes no room work.
  if (!isInsideRoom(filePath, roomDir)) return;

  // Plan 400.3-06c: the reconcile runs in reconcileRoom (one wait per run, one transaction).
  const out = reconcileRoom(roomDir, {});
  const result = out && out.result;
  // MED-04: log only when genuine work happened (upserted > 0). An unchanged
  // room (all no-op re-projections) emits nothing, so the line is honest and an
  // idempotent re-run no longer claims it "did work". The unchanged count is
  // surfaced for observability of the idempotence invariant.
  if (out && out.ok === true && result && result.upserted > 0) {
    try {
      process.stderr.write('[memory-artifact-graph-hook] ' + result.upserted +
        ' memory node(s) upserted, ' + (result.unchanged || 0) + ' unchanged, ' +
        result.decision_nodes + ' decision node(s), ' + result.edges + ' cortex edge(s)\n');
    } catch (_e) { /* swallow logger error */ }
  } else if (out && out.reason === 'room_db_busy') {
    try {
      process.stderr.write('[memory-artifact-graph-hook] room_db_busy: memory files not reconciled now; the session-start reconcile files them later\n');
    } catch (_e) { /* swallow logger error */ }
  } else if (out && out.reason === 'reconcile_failed') {
    try {
      process.stderr.write('[memory-artifact-graph-hook] error: ' + String(out.detail || '').slice(0, 200) + '\n');
    } catch (_e) { /* swallow logger error */ }
  }
}


/**
 * reconcileRoom(roomDir, opts) -> { ok: true, result } | { ok: false, reason, detail? }
 * Plan 400.3-06c (review B-b): open room.db through the one script opener and run
 * the whole memory reconcile inside one navigation.withRoomTx, so a held lock
 * costs one wait. opts.busyMs: a non-negative integer, else the hook cap of the
 * process. Reasons: 'no_room_db' (missing, 0-byte or unopenable room.db: no
 * reconcile, as at BASE), 'room_db_busy', 'reconcile_failed'. Never throws.
 */
function reconcileRoom(roomDir, opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  const busyCap = require(path.join(__dirname, '..', 'lib', 'core', 'hook-busy-cap.cjs'));
  const busyMs = (Number.isInteger(o.busyMs) && o.busyMs >= 0) ? o.busyMs : busyCap.capBusyMs(busyCap.DEFAULT_BUSY_MS);
  let db = null;
  try {
    db = require('./feynman-timeline-refresh-command.cjs').resolveRoomDb(roomDir, { busyMs: busyMs });
  } catch (_e) { db = null; }
  if (!db) return { ok: false, reason: 'no_room_db' };
  try {
    const pluginRoot = resolvePluginRoot();
    const runner = require(path.join(pluginRoot, 'lib', 'core', 'memory', 'reconcile-memory-runner.cjs'));
    const navigation = require(path.join(__dirname, '..', 'lib', 'core', 'navigation.cjs'));
    // Dog-food: when the active room IS the plugin workspace, reconcile the
    // plugin's OWN per-folder memory files (PLUGIN_ROOT as the section root, not
    // ROOM_DIR). Same resolved-path compare as the session-start slot.
    const reconcileOpts = { db: db };
    try {
      if (pluginRoot && path.resolve(roomDir) === path.resolve(pluginRoot)) {
        reconcileOpts.sectionRoot = pluginRoot;
      }
    } catch (_e) { /* keep the default sectionRoot */ }
    // Call the SAME idempotent reconcile the session-start slot calls, inside one
    // transaction (D-01 belt-and-suspenders: a later session-start never duplicates).
    // Wave 2 Goldfish W2-D-04: read and parse every memory file BEFORE the
    // transaction (the Phase 367 read-before-tx rule), so the write lock is held
    // for the inserts only, not for the file reads.
    if (typeof runner.prepareMemoryArtifacts === 'function') reconcileOpts.prepared = runner.prepareMemoryArtifacts(roomDir, reconcileOpts);
    const result = navigation.withRoomTx(db, () => runner.reconcileMemoryArtifacts(roomDir, reconcileOpts));
    return { ok: true, result: result };
  } catch (err) {
    if (busyCap.isBusyError(err)) {  // wave 2 Goldfish W2-CD-03: the one busy test
      try { busyCap.noteBusy(); } catch (_e) { /* tolerant */ }
      return { ok: false, reason: 'room_db_busy' };
    }
    return { ok: false, reason: 'reconcile_failed', detail: String(err && err.message ? err.message : err).slice(0, 200) };
  } finally {
    try { db.close(); } catch (_e) { /* graceful close */ }
  }
}

module.exports = { isMemoryMarkdown: isMemoryMarkdown, resolveRoomDir: resolveRoomDir, isInsideRoom: isInsideRoom, reconcileRoom: reconcileRoom };

// CLI entry -- the PostToolUse hook contract. ALWAYS exit 0; never block the write.
if (require.main === module) {
  try {
    runHook();
  } catch (err) {
    try {
      process.stderr.write('[memory-artifact-graph-hook] CLI error: ' +
        String(err && err.message ? err.message : err).slice(0, 200) + '\n');
    } catch (_e) { /* swallow */ }
  }
  process.exit(0);
}
