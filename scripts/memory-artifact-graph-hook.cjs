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
 * NO em-dashes anywhere (CLAUDE.md HARD RULE). Pure CJS, node built-ins + the
 * memory reconcile-runner.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

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
    const roomsRoot = process.env.MINDRIAN_ROOMS_ROOT ||
                      process.env.MINDRIAN_ROOMS_HOME ||
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
  const input = readStdin();
  const tool = String((input && input.tool_name) || '');
  if (tool !== 'Write' && tool !== 'Edit' && tool !== 'MultiEdit') return;

  const filePath = String((input.tool_input && input.tool_input.file_path) || '');
  if (!filePath) return;

  // Strict six-basename gate -- skip-fast for any other path (no-op exit 0).
  if (!isMemoryMarkdown(filePath)) return;

  const roomDir = resolveRoomDir();
  if (!roomDir) return;

  // Open room.db so the reconcile can upsert. Lazy-require node:sqlite so an
  // environment without it degrades to a silent no-op (Tier 0).
  let db = null;
  try {
    const dbPath = path.join(roomDir, '.mindrian', 'room.db');
    if (!fs.existsSync(dbPath)) return;
    const sqlite = require('node:sqlite');
    db = new sqlite.DatabaseSync(dbPath);
  } catch (_e) {
    db = null;
  }
  if (!db) return;

  try {
    const pluginRoot = resolvePluginRoot();
    const runner = require(path.join(pluginRoot, 'lib', 'core', 'memory', 'reconcile-memory-runner.cjs'));

    // Dog-food: when the active room IS the plugin workspace, reconcile the
    // plugin's OWN per-folder memory files (PLUGIN_ROOT as the section root, not
    // ROOM_DIR). Same resolved-path compare as the session-start slot.
    const reconcileOpts = { db: db };
    try {
      if (pluginRoot && path.resolve(roomDir) === path.resolve(pluginRoot)) {
        reconcileOpts.sectionRoot = pluginRoot;
      }
    } catch (_e) { /* keep the default sectionRoot */ }

    // Call the SAME idempotent reconcile the session-start slot calls. The full
    // pass is the chokepoint; because it is idempotent, the hook write + a later
    // session-start reconcile never duplicate (D-01 belt-and-suspenders).
    const result = runner.reconcileMemoryArtifacts(roomDir, reconcileOpts);
    if (result && result.upserted > 0) {
      try {
        process.stderr.write('[memory-artifact-graph-hook] ' + result.upserted +
          ' memory node(s) upserted, ' + result.decision_nodes +
          ' decision node(s), ' + result.edges + ' cortex edge(s)\n');
      } catch (_e) { /* swallow logger error */ }
    }
  } catch (err) {
    try {
      process.stderr.write('[memory-artifact-graph-hook] error: ' +
        String(err && err.message ? err.message : err).slice(0, 200) + '\n');
    } catch (_e) { /* swallow logger error */ }
  } finally {
    try { db.close(); } catch (_e) { /* graceful close */ }
  }
}

module.exports = { isMemoryMarkdown: isMemoryMarkdown, resolveRoomDir: resolveRoomDir };

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
