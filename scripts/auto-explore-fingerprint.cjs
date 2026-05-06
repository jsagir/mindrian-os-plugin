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
 *   8. spawn detached: node scripts/auto-explore-fire.cjs <roomDir> <file_path> <material_id>
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

// ---------- Room section walker (mirrors scripts/post-write detect_room_section) ----------

function detectRoomSection(filePath) {
  let cur = path.dirname(filePath);
  const root = path.parse(cur).root;
  let hops = 0;
  while (cur && cur !== root && hops < 12) {
    if (fs.existsSync(path.join(cur, '.room-root'))) return cur;
    cur = path.dirname(cur);
    hops += 1;
  }
  return null;
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

  const roomDir = detectRoomSection(filePath);
  if (!roomDir) return emitEmpty();

  let mtimeMs;
  try {
    mtimeMs = fs.statSync(filePath).mtime.getTime();
  } catch (_e) {
    return emitEmpty();
  }

  const relativeFilePath = path.relative(roomDir, filePath);
  const roomSlug = roomSlugFromDir(roomDir);
  const dbPath = path.join(roomDir, '.mindrian', 'room.db');

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
      const fire = spawn('node', [firePath, roomDir, relativeFilePath, detection.material_id], {
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
