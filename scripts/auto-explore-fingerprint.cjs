#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 117-01 Wave 1 -- PostToolUse Write|Edit|MultiEdit fingerprint hook.
 *
 * 9-step decision tree per RESEARCH Section 4.1:
 *   1. Read stdin JSON; extract file_path
 *   2. Walk up for .room-root sentinel; if absent -> exit silently
 *   3. computeMaterialId(roomDir, relative_file_path, mtime)
 *   4. detectFirstMaterial -> if Tier 0 / invalid args -> markFailed + silent
 *   5. findLatest(roomSlug, material_id); if present -> rate_limited; silent
 *   6. findRecentChanges(db, 24h, 'auto_explore_fired'); if >= 1 -> daily_cap; silent
 *   7. appendMaterial 'queued' entry to JSONL ledger
 *   8. spawn detached: node scripts/auto-explore-fire.cjs <roomDir> <file_path>
 *      <material_id> <session_id> (Phase 237-06, REACH-03: session_id is the
 *      4th spawn argv element, read off the same hook stdin JSON as
 *      file_path; may be an empty string when the hook payload carries none)
 *   9. exit envelope continue:true
 *
 * Per Brain Section 8.7: detection routing is LOCAL-only. Zero
 * [Brain Cypher edge type, name elided to keep grep regression at zero] Brain calls. AUTOEXPLORE-117-17 enforced via grep
 * regression in 117-04.
 *
 * Per Canon Part 8: zero outbound network surface, zero brain-client require.
 * Per Phase 109 D-06: zero direct room-db.cjs require (chokepoint preserved).
 *
 * ALWAYS exits 0; never blocks the tool call. uncaughtException catcher
 * guarantees the envelope still fires.
 *
 * Pure CJS, node built-ins only.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const store = require('../lib/memory/explored-materials-store.cjs');
const agent = require('../lib/agents/auto-explore-agent.cjs');

// ---------- Envelope helpers (mirrors scripts/preflight-tension-surface.cjs) ----------

const ENVELOPE_ALLOWED = new Set([
  'decision', 'reason', 'continue', 'stopReason',
  'suppressOutput', 'systemMessage', 'hookSpecificOutput',
]);

function emitEnvelope(envelope) {
  const filtered = {};
  for (const k of Object.keys(envelope || {})) {
    if (ENVELOPE_ALLOWED.has(k)) filtered[k] = envelope[k];
  }
  if (filtered.continue === undefined) filtered.continue = true;
  process.stdout.write(JSON.stringify(filtered));
  process.exit(0);
}

function emitEmpty() {
  emitEnvelope({ continue: true });
}

process.on('uncaughtException', () => emitEmpty());

// ---------- Stdin reader ----------

function readStdin() {
  try {
    const data = fs.readFileSync(0, 'utf8');
    if (!data) return {};
    return JSON.parse(data);
  } catch (_e) {
    return {};
  }
}

// ---------- Room section walker (repointed at the ONE shared resolver) ----------
// Phase 169-02 (GDH-01): the inline .room-root walk-up is repointed at the shared
// resolver (lib/core/room-root.cjs) so there is no duplicated walk-up. The shared
// resolver returns '' when no sentinel is found; this function's existing
// contract is null, so we coerce '' -> null at the boundary.
const { resolveRoomRoot: resolveRoomRootShared } = require('../lib/core/room-root.cjs');

function detectRoomSection(filePath) {
  return resolveRoomRootShared(filePath) || null;
}

function roomSlugFromDir(roomDir) {
  return path.basename(roomDir);
}

// ---------- room.db readers (LOCAL-only; no brain-client) ----------

function getArtifactCount(dbPath) {
  // Lazy require so environments lacking node:sqlite degrade to Tier 0.
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require('node:sqlite'));
  } catch (_e) {
    return -1;
  }
  let db;
  try {
    db = new DatabaseSync(dbPath);
  } catch (_e) {
    return -1;
  }
  try {
    const row = db.prepare('SELECT COUNT(*) AS c FROM nodes').get();
    return Number(row && row.c) || 0;
  } catch (_e) {
    return -1;
  } finally {
    try { db.close(); } catch (_e) { /* graceful close */ }
  }
}

function dailyCapHit(dbPath) {
  // Lazy require navigation to keep this hook pure-CJS-clean if substrate missing.
  let navigation;
  try {
    navigation = require('../lib/core/navigation.cjs');
  } catch (_e) {
    return false; // graceful: do not gate on missing infra
  }
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require('node:sqlite'));
  } catch (_e) {
    return false;
  }
  let db;
  try {
    db = new DatabaseSync(dbPath);
  } catch (_e) {
    return false;
  }
  try {
    const sinceEpochMs = Date.now() - (24 * 60 * 60 * 1000);
    const rows = navigation.findRecentChanges(db, sinceEpochMs, { eventType: 'auto_explore_fired' });
    return Array.isArray(rows) && rows.length >= 1;
  } catch (_e) {
    return false;
  } finally {
    try { db.close(); } catch (_e) { /* graceful close */ }
  }
}

// ---------- Main ----------

function main() {
  const input = readStdin();
  const tool = String((input && input.tool_name) || '');
  if (tool !== 'Write' && tool !== 'Edit' && tool !== 'MultiEdit') {
    return emitEmpty();
  }

  const filePath = String((input.tool_input && input.tool_input.file_path) || '');
  if (!filePath) return emitEmpty();
  if (!fs.existsSync(filePath)) return emitEmpty();

  // Phase 237-06 (REACH-03): session_id off the same hook stdin JSON as
  // file_path, defaulting to an empty string when absent or not a string.
  // Threaded through to the detached fire spawn below.
  const sessionId = (typeof input.session_id === 'string') ? input.session_id : '';

  // Phase 119-00 (D-01 sibling hook): roomDir is reassigned by the auto-create
  // branch below when the no-active-room invariant holds.
  // Changed from const -> let so the reassignment is valid.
  let roomDir = detectRoomSection(filePath);
  if (!roomDir) return emitEmpty();

  let mtimeMs;
  try {
    mtimeMs = fs.statSync(filePath).mtime.getTime();
  } catch (_e) {
    return emitEmpty();
  }

  const relativeFilePath = path.relative(roomDir, filePath);
  // Phase 119-00 (D-01 sibling hook): roomDir + roomSlug + dbPath are reassigned
  // by the auto-create branch below when the no-active-room invariant holds.
  // Changed from const -> let so the reassignment is valid.
  let roomSlug = roomSlugFromDir(roomDir);
  let dbPath = path.join(roomDir, '.mindrian', 'room.db');

  // Phase 119-00 sibling hook (CONTEXT.md D-01 + D-04): if no active room AND the current
  // roomDir has no room.db (Tier 0 / first-ever upload case), auto-create a placeholder
  // room synchronously BEFORE the detection check, so the Phase 117 detector runs against
  // a real placeholder room with a properly-migrated room.db. The fire child then writes
  // into the freshly-created room.db. Never blocks the tool call -- any failure mode
  // (read-only $ROOMS_HOME, registry create failed, etc.) degrades to the original
  // roomDir and the rest of the Phase 117 path proceeds byte-identically.
  //
  // ORDERING NOTE: this hook fires BEFORE the detectFirstMaterial call. The original plan
  // placed the hook AFTER the is_first_material check, but the Phase 117 detector returns
  // Tier 0 (suppression) when artifactCount < 0 (no room.db). The Tier 0 case is exactly
  // the first-ever-upload scenario Phase 119 is designed to handle. Inserting after the
  // suppression means the hook is unreachable in the canonical first-touch flow. This
  // ordering correction is a Rule 3 blocker fix; documented in Plan 119-00 SUMMARY.
  //
  // Canon Part 9 invariant: writes route through navigation.cjs::logMemoryEvent (the
  // room_auto_created event lands inside autoCreatePlaceholderRoom, not here).
  // Canon Part 8 invariant: no Brain call; the helper is pure-local (registry.json read).
  const ROOMS_HOME = process.env.MINDRIAN_ROOMS_HOME ||
    path.join(process.env.HOME || require('node:os').homedir(), 'MindrianRooms');
  try {
    if (agent.detectNoActiveRoom(ROOMS_HOME) && !fs.existsSync(dbPath)) {
      const autoCreate = require('../lib/core/room-auto-create.cjs');
      // Pre-compute the material_id so we can pass it through to the auto-create
      // payload AND to the post-create detection call. Mirrors the Phase 117 idiom.
      const preMaterialId = store.computeMaterialId(roomDir, relativeFilePath, mtimeMs);
      const result = autoCreate.autoCreatePlaceholderRoom(ROOMS_HOME, {
        source_material_id: preMaterialId,
        source_relative_path: relativeFilePath,
        source_mtime_ms: mtimeMs,
        tier: 1,
      });
      if (result && result.ok) {
        // Reassign roomDir + roomSlug + dbPath so the detection + rate-limit + daily-cap +
        // spawn paths operate against the freshly-created placeholder room. The auto-explore-fire
        // spawn at the bottom of this function then writes auto-explore-<material_id>.json
        // into the placeholder's .mindrian/ dir.
        roomDir = result.room_dir;
        roomSlug = roomSlugFromDir(roomDir);
        dbPath = path.join(roomDir, '.mindrian', 'room.db');
      }
      // result.ok === false -> degrade gracefully: continue with original roomDir.
      // The downstream detection will return Tier 0 and emitEmpty() per Phase 117.
    }
  } catch (_e) {
    // Phase 119-00 invariant: NEVER block. Any uncaught error in the auto-create path
    // is absorbed; the original Phase 117 detector flow proceeds.
  }

  // Tier 0: room.db missing -> suppress (LOCAL-only routing per Brain Section 8.7).
  const artifactCount = fs.existsSync(dbPath) ? getArtifactCount(dbPath) : -1;
  const detection = agent.detectFirstMaterial({
    roomDir: roomDir,
    relativeFilePath: relativeFilePath,
    mtimeMs: mtimeMs,
    artifactCount: artifactCount,
  });

  if (!detection.is_first_material) {
    if (detection.material_id) {
      const reason = detection.suppress_reason || 'tier_0';
      try {
        store.markFailed(roomSlug, detection.material_id, reason);
      } catch (_e) { /* never throw */ }
      // Phase 117-05 telemetry: suppression path emits auto_explore_skipped.
      try { agent.emitSkipped(roomDir, { material_id: detection.material_id, suppress_reason: reason, tier: detection.tier || 0 }); } catch (_e) { /* never throw */ }
    }
    return emitEmpty();
  }

  // Rate-limit check: same material_id already in ledger?
  let existing = null;
  try {
    existing = store.findLatest(roomSlug, detection.material_id);
  } catch (_e) {
    existing = null;
  }
  if (existing && (existing.state === 'queued' || existing.state === 'in_flight' || existing.state === 'completed')) {
    try {
      store.markFailed(roomSlug, detection.material_id, 'rate_limited');
    } catch (_e) { /* never throw */ }
    // Phase 117-05 telemetry: rate-limited suppression.
    try { agent.emitSkipped(roomDir, { material_id: detection.material_id, suppress_reason: 'rate_limited', tier: detection.tier || 0 }); } catch (_e) { /* never throw */ }
    return emitEmpty();
  }

  // Daily cap (24h, per-room). 1 fire per 24h max per CONTEXT.md AC4.
  if (fs.existsSync(dbPath) && dailyCapHit(dbPath)) {
    try {
      store.markFailed(roomSlug, detection.material_id, 'daily_cap_exceeded');
    } catch (_e) { /* never throw */ }
    // Phase 117-05 telemetry: daily-cap suppression.
    try { agent.emitSkipped(roomDir, { material_id: detection.material_id, suppress_reason: 'daily_cap_exceeded', tier: detection.tier || 0 }); } catch (_e) { /* never throw */ }
    return emitEmpty();
  }

  // Append 'queued' entry to JSONL ledger. file_path_sha256 hashes the
  // relative_file_path so any downstream telemetry mirror carries only the
  // 16-char hex hash (Canon Part 8 -- never store raw path in event payload).
  const fileSha = crypto.createHash('sha256').update(relativeFilePath).digest('hex').slice(0, 16);
  try {
    store.appendMaterial(roomSlug, {
      material_id: detection.material_id,
      file_path_sha256: fileSha,
      relative_file_path: relativeFilePath,
      mtime_seconds: Math.floor(mtimeMs / 1000),
      fired_at: Date.now(),
      state: 'queued',
      finding_count: null,
      surfaced: false,
      user_response: null,
      responded_at: null,
      suppress_reason: null,
      in_flight_since: null,
    });
  } catch (_e) {
    // JSONL append failed -- defensively continue; SessionStart sweep will
    // catch any orphaned spawn at next session boundary (5min stale rule).
  }

  // Phase 117-05 telemetry: emit auto_explore_fired immediately before
  // spawning the detached fire child. Scalar-only payload per Canon Part 8.
  try {
    agent.emitFired(roomDir, {
      material_id: detection.material_id,
      relative_file_path: relativeFilePath,
      room_slug: roomSlug,
      tier: detection.tier || 1,
      surfacing_count: 0,
      brain_baseline_present: false,
    });
  } catch (_e) { /* never throw */ }

  // Spawn detached: scripts/auto-explore-fire.cjs (lands in 117-02). When the
  // child script does not yet exist (Wave 1 tests), skip the spawn but still
  // emit the envelope continue:true.
  const firePath = path.join(__dirname, 'auto-explore-fire.cjs');
  if (fs.existsSync(firePath)) {
    try {
      const fire = spawn('node', [firePath, roomDir, relativeFilePath, detection.material_id, sessionId], {
        detached: true,
        stdio: 'ignore',
        env: process.env,
      });
      fire.unref(); // Parent exits without waiting; AC2 ~10s budget honored.
    } catch (_e) {
      // Spawn failure -- never block; ledger still records 'queued'; sweep recovers.
    }
  }

  return emitEmpty();
}

try {
  main();
} catch (_e) {
  emitEmpty();
}
