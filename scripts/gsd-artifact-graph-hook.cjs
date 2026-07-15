#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 149-03 Task 3 (GAM-04, D-01) -- the GSD planning-artifact PostToolUse hook.
 *
 * The CLI IMMEDIACY half of D-01 (the hybrid trigger): when a CLI user writes a
 * .planning/*.md file (Write|Edit|MultiEdit), this hook fires and lands the
 * artifact's planning_artifact + requirement nodes + lineage edges IMMEDIATELY,
 * so the graph is current before the next session-start. The session-start
 * reconcile slot (Plan 02) remains the UNIVERSAL net for Desktop / Cowork, which
 * have no PostToolUse hook.
 *
 * It calls the SAME reconcilePlanningArtifacts function the session-start slot
 * calls -- it does NOT reimplement reconcile logic. Because that reconcile is
 * idempotent (every node/edge write is an upsert on a stable id, Plan 01 + 02),
 * a write the hook catches AND a later session-start reconcile produce EXACTLY
 * one node and one edge set: no double-write by construction (threat T-149-10).
 *
 * reconcile-runner.cjs does NOT accept an onlyPath scoping option as of Plan 02,
 * so this hook calls the FULL idempotent reconcile (correctness over speed; the
 * full pass is cheap and cannot duplicate). If a future onlyPath option lands,
 * pass it here as an optimization, not a new code path.
 *
 * Gating: fires ONLY when the written path matches the strict .planning/*.md
 * pattern (threat T-149-11 -- elevation of privilege; the attacker-influenceable
 * file_path is gated before any action). For any other path it is a no-op exit 0.
 *
 * Graceful degradation (threat T-149-09 -- DoS): the whole body is wrapped in
 * try/catch, the db handle is closed, and the process exits 0 ALWAYS. A hook
 * failure must NEVER block the user's write.
 *
 * Canon Part 8 (zero Brain egress): no network surface. No brain-client, no
 *   node:http / node:https, no fetch. The reconcile reads room DATA only via
 *   navigation.cjs and the .planning markdown source-of-meaning locally.
 * Canon Part 9 (navigation chokepoint): room.db is touched only via the
 *   reconcile, which writes only through navigation.cjs.
 *
 * Mirrors the PostToolUse shape of scripts/memory-completion-detector.cjs +
 * scripts/auto-explore-fingerprint.cjs (stdin JSON -> file_path; resolve room;
 * best-effort; exit 0 always) and the room-resolution + db-open + reconcile-call
 * of the Phase 149 session-start slot verbatim.
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE). Pure CJS, node built-ins + the
 * navigation submodule's reconcile-runner.
 */

const fs = require('node:fs');
const path = require('node:path');

// Phase 169-02 (GDH-01, D-169-05): the ONE `.room-root` walk-up resolver. The
// write-index path resolves the room by the WRITTEN FILE's own `.room-root`
// FIRST, so a write into a sub-room indexes into THAT sub-room's db regardless
// of the registry active room (root cause #1). It returns '' on no sentinel, and
// the resolver below then degrades to the env / canonical-resolver fallback.
const { resolveRoomRoot } = require(
  path.resolve(__dirname, '..', 'lib', 'core', 'room-root.cjs')
);

// Phase 224-03 (Req 3): the Phase-194 CANONICAL write-target resolver. The
// fallback below rides resolveWriteRoom (leg order room-root, session.primary,
// reg.active) instead of a DUPLICATED registry read -- the SEED-034 lesson that
// there must be exactly ONE resolver, not a second guesser. resolveWriteRoom
// SUBSUMES the removed registry read and adds session awareness for free.
const { resolveWriteRoom } = require(
  path.resolve(__dirname, '..', 'lib', 'core', 'resolve-active-room.cjs')
);

// Strict gate: a path INSIDE a .planning/ tree that ends in .md. The attacker-
// influenceable file_path is checked against this before any room work happens.
// Normalize backslashes so the gate is cross-platform (Windows paths).
const PLANNING_MD_RE = /(^|[\\/])\.planning[\\/].*\.md$/;

function isPlanningMarkdown(filePath) {
  if (typeof filePath !== 'string' || filePath.length === 0) return false;
  const normalized = filePath.replace(/\\/g, '/');
  return PLANNING_MD_RE.test(filePath) || /(^|\/)\.planning\/.*\.md$/.test(normalized);
}

// readStdin -- the Claude Code PostToolUse hook contract delivers a JSON payload
// on stdin with tool_name + tool_input.file_path (mirrors auto-explore-fingerprint).
function readStdin() {
  try {
    const data = fs.readFileSync(0, 'utf8');
    if (!data) return {};
    return JSON.parse(data);
  } catch (_e) {
    return {};
  }
}

// resolveRoomDir(filePath) -- FILE-ROOTED first (Phase 169-02 / GDH-01): when the
// written filePath sits inside a room carrying a `.room-root` sentinel, resolve
// to THAT room (so a sub-room write indexes into the sub-room's own db, not the
// registry active room -- root cause #1). Only when the file is outside any room
// (resolveRoomRoot -> '') do we fall back, first to the hook-contract room env
// vars (shared with memory-artifact-graph-hook.cjs + memory-completion-detector.cjs)
// and then to the Phase-194 CANONICAL resolveWriteRoom (Req 3). resolveWriteRoom's
// own leg order (room-root, session.primary, reg.active) SUBSUMES the duplicated
// registry read this hook used to carry, and adds session awareness for free.
function resolveRoomDir(filePath) {
  // File-rooted resolution FIRST.
  if (typeof filePath === 'string' && filePath.length > 0) {
    try {
      const rooted = resolveRoomRoot(filePath);
      if (rooted && fs.existsSync(rooted)) return rooted;
    } catch (_e) { /* fall through to env / canonical resolver */ }
  }

  const envRoom = process.env.CLAUDE_ROOM_DIR ||
                  process.env.CLAUDE_ACTIVE_ROOM ||
                  process.env.ROOM_DIR ||
                  '';
  if (envRoom && fs.existsSync(envRoom)) return envRoom;

  // Canonical fallback (Req 3): the single audited resolveWriteRoom. Return its
  // abs_path only when it exists on disk (T-224-10 existence check), else the
  // empty string -- preserving the existing empty-string degrade contract.
  try {
    const wr = resolveWriteRoom({ filePath: filePath });
    if (wr && typeof wr.abs_path === 'string' && wr.abs_path.length > 0 && fs.existsSync(wr.abs_path)) {
      return wr.abs_path;
    }
    return '';
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

  // Strict .planning/*.md gate -- skip-fast for any other path (no-op exit 0).
  if (!isPlanningMarkdown(filePath)) return;

  // Phase 169-02 (GDH-01): thread the written filePath so the write-index room is
  // resolved by the file's OWN `.room-root` first, then env/registry as fallback.
  const roomDir = resolveRoomDir(filePath);
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
    const runner = require(path.join(pluginRoot, 'lib', 'core', 'planning', 'reconcile-runner.cjs'));

    // Dog-food: when the active room IS the plugin workspace, reconcile the
    // plugin's OWN .planning tree (PLUGIN_ROOT/.planning, not ROOM_DIR/.planning).
    // Same resolved-path compare as the session-start slot.
    const reconcileOpts = { db: db };
    try {
      if (pluginRoot && path.resolve(roomDir) === path.resolve(pluginRoot)) {
        reconcileOpts.planningDir = path.join(pluginRoot, '.planning');
      }
    } catch (_e) { /* keep the default planningDir */ }

    // Call the SAME idempotent reconcile the session-start slot calls. The full
    // pass is the chokepoint; because it is idempotent, the hook write + a later
    // session-start reconcile never duplicate (D-01 belt-and-suspenders).
    const result = runner.reconcilePlanningArtifacts(roomDir, reconcileOpts);
    if (result && result.upserted > 0) {
      try {
        process.stderr.write('[gsd-artifact-graph-hook] ' + result.upserted +
          ' artifact node(s) upserted, ' + result.requirement_nodes +
          ' requirement node(s), ' + result.edges + ' lineage edge(s)\n');
      } catch (_e) { /* swallow logger error */ }
    }
  } catch (err) {
    try {
      process.stderr.write('[gsd-artifact-graph-hook] error: ' +
        String(err && err.message ? err.message : err).slice(0, 200) + '\n');
    } catch (_e) { /* swallow logger error */ }
  } finally {
    try { db.close(); } catch (_e) { /* graceful close */ }
  }
}

module.exports = { isPlanningMarkdown: isPlanningMarkdown, resolveRoomDir: resolveRoomDir };

// CLI entry -- the PostToolUse hook contract. ALWAYS exit 0; never block the write.
if (require.main === module) {
  try {
    runHook();
  } catch (err) {
    try {
      process.stderr.write('[gsd-artifact-graph-hook] CLI error: ' +
        String(err && err.message ? err.message : err).slice(0, 200) + '\n');
    } catch (_e) { /* swallow */ }
  }
  process.exit(0);
}
