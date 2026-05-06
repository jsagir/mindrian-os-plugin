#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 117-01 Wave 1 -- SessionStart preflight + stale-sweep recovery.
 *
 * In Wave 1 this hook ONLY:
 *   1. Resolves roomDir + roomSlug
 *   2. Calls store.sweepStaleInFlight(roomSlug, {staleMs: 300000}) per
 *      RESEARCH scenario 7 (5min stale recovery: in_flight entries older
 *      than 5min get transitioned to 'failed' so the next material_id
 *      detection can fire fresh)
 *   3. Exits envelope continue:true (no additionalContext yet)
 *
 * In Wave 2 (117-03) this hook gains:
 *   4. Glob room/.mindrian/auto-explore-*.json for completed-but-unsurfaced findings
 *   5. Compose Larry-voice directive in additionalContext
 *   6. Set state='surfaced' in ledger after directive emits
 *
 * Per Canon Part 8: zero outbound network surface, zero brain-client require.
 * Per Phase 109 D-06: zero direct room-db.cjs require (chokepoint preserved).
 *
 * ALWAYS exits 0; never blocks the hook chain. uncaughtException catcher
 * guarantees the envelope still fires.
 *
 * Pure CJS, node built-ins only.
 */
'use strict';

const path = require('node:path');
const store = require('../lib/memory/explored-materials-store.cjs');

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

// Backstop: any uncaught exception lands here and the envelope still emits.
// This is the "ALWAYS exits 0" contract from RESEARCH Section 7.3 -- the
// SessionStart hook chain is never blocked by a sweep failure. The hook
// must NEVER trip the user's session start.
process.on('uncaughtException', () => emitEmpty());

// Defensive: process.on('unhandledRejection') not attached because Wave 1
// preflight has zero async surface (sweepStaleInFlight is sync). Wave 2
// (117-03) adds the UserPromptSubmit drain which DOES touch async fs ops;
// at that point an unhandledRejection catcher will be added alongside.

// ---------- Room resolution ----------

function resolveRoomDir() {
  if (typeof process.env.MINDRIAN_ROOM_DIR === 'string' && process.env.MINDRIAN_ROOM_DIR.length > 0) {
    return process.env.MINDRIAN_ROOM_DIR;
  }
  return process.cwd();
}

function roomSlugFromDir(roomDir) {
  return path.basename(roomDir);
}

// ---------- Main ----------

function main() {
  let roomDir;
  let roomSlug;
  try {
    roomDir = resolveRoomDir();
    roomSlug = roomSlugFromDir(roomDir);
  } catch (_e) {
    return emitEmpty();
  }

  // Wave 1: 5-min stale-sweep recovery only.
  // Wave 2 (117-03) will add UserPromptSubmit drain + F.1 surface composition.
  try {
    store.sweepStaleInFlight(roomSlug, { staleMs: 300000 });
  } catch (_e) {
    // Sweep failure is benign -- the next session start will retry; the user
    // is never blocked. Log nothing per dual-surface telemetry contract.
  }

  return emitEmpty();
}

try {
  main();
} catch (_e) {
  emitEmpty();
}
