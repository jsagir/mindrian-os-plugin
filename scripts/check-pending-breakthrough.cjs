#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 120-02 Wave 2 -- Session-start cascade scanner for the breakthrough
 * surface (Plan 120-02 Task 3). Mirrors scripts/check-pending-naming-decision.cjs
 * (Phase 119-01 precedent) for envelope shape + graceful-degradation invariant.
 *
 * Flow:
 *   1. Resolve ROOMS_HOME (env override OR ~/MindrianRooms default).
 *   2. Read .rooms/registry.json to identify the active room slug.
 *   3. Call scanForBreakthroughs(activeRoomDir).
 *   4. If top === null -> emit {"continue": true} (D-16 empty-state silence).
 *   5. If top exists -> call surfaceBreakthrough; emit the canonical SessionStart
 *      envelope with the F.7 rendered surface attached as additionalContext.
 *   6. ANY uncaught error -> degrade to {"continue": true} + exit 0. The hook
 *      NEVER blocks session start (mirrors Phase 117 + Phase 119 invariant).
 *
 * SessionStart ordering invariant per CONTEXT.md Claude's Discretion item 4:
 *   - Phase 119 fires FIRST (detectNoActiveRoom -- a room must exist).
 *   - Phase 117 fires SECOND (detectFirstMaterial -- math layer must populate).
 *   - Phase 120 fires THIRD (consumes both upstream products).
 *
 * Canon Part 8: pure LOCAL scan; no Brain MCP coupling.
 * Canon Part 9: ALL reads via the navigation chokepoint.
 * Canon Part 10 sub-claim 5: variable reward fires automatically; the math IS
 *   the surface; no user-facing trigger required.
 *
 * Em-dash HARD RULE (CLAUDE.md feedback_no_emdashes): use `--` not U+2014.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// ---------------------------------------------------------------------------
// Canonical SessionStart envelope emission. The hook NEVER blocks; on any
// failure, emit { continue: true } and exit 0.
// ---------------------------------------------------------------------------
function emitContinue() {
  try {
    process.stdout.write(JSON.stringify({ continue: true }) + '\n');
  } catch (_e) { /* swallow */ }
  process.exit(0);
}

function emitContinueWithContext(additionalContext) {
  try {
    process.stdout.write(JSON.stringify({
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: additionalContext,
      },
    }) + '\n');
  } catch (_e) { /* swallow */ }
  process.exit(0);
}

function resolveRoomsHome() {
  if (process.env.MINDRIAN_ROOMS_HOME && fs.existsSync(process.env.MINDRIAN_ROOMS_HOME)) {
    return process.env.MINDRIAN_ROOMS_HOME;
  }
  const defaultHome = path.join(os.homedir(), 'MindrianRooms');
  if (fs.existsSync(defaultHome)) return defaultHome;
  return null;
}

function readActiveRoomDir(roomsHome) {
  if (!roomsHome) return null;
  // Try .rooms/registry.json first (the canonical Phase 83 active-room source).
  try {
    const regPath = path.join(roomsHome, '.rooms', 'registry.json');
    if (fs.existsSync(regPath)) {
      const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
      if (reg && typeof reg.active === 'string' && reg.active.length > 0) {
        const dir = path.join(roomsHome, reg.active);
        if (fs.existsSync(dir)) return dir;
      }
    }
  } catch (_e) { /* fall through */ }
  // Fallback: env override allows tests to point at a specific room dir.
  if (process.env.MINDRIAN_ACTIVE_ROOM_DIR && fs.existsSync(process.env.MINDRIAN_ACTIVE_ROOM_DIR)) {
    return process.env.MINDRIAN_ACTIVE_ROOM_DIR;
  }
  return null;
}

function main() {
  // Lazy-require the scanner so that even if the scanner module fails to load
  // (e.g., a broken require chain in a partial install), the hook still emits
  // {continue:true} via the uncaughtException handler below.
  const roomsHome = resolveRoomsHome();
  const activeRoomDir = readActiveRoomDir(roomsHome);
  if (!activeRoomDir) {
    // No active room -> nothing to scan. D-16 silence.
    return emitContinue();
  }

  let scanner;
  try {
    scanner = require(path.join(__dirname, '..', 'lib', 'core', 'breakthrough', 'scanner.cjs'));
  } catch (_e) {
    return emitContinue();
  }

  let scanResult;
  try {
    scanResult = scanner.scanForBreakthroughs(activeRoomDir);
  } catch (_e) {
    return emitContinue();
  }

  if (!scanResult || !scanResult.top) {
    // D-16 empty-state silence: no eligible candidates. NO additionalContext,
    // NO F.7 dispatch, NO placeholder text.
    return emitContinue();
  }

  // Dispatch F.7. surfaceBreakthrough opens its own db handle (the scanner
  // closed the connection it opened earlier; we pass roomDir explicitly + a
  // fresh db handle here so surfaceBreakthrough can read provenance + emit
  // the surfaced event).
  let roomDb;
  try {
    roomDb = require(path.join(__dirname, '..', 'lib', 'core', 'room-db.cjs'));
  } catch (_e) {
    return emitContinue();
  }
  let db;
  try {
    db = roomDb.openRoomDb(activeRoomDir);
  } catch (_e) {
    return emitContinue();
  }

  let surface;
  try {
    surface = scanner.surfaceBreakthrough(scanResult.top, {
      db: db,
      roomDir: activeRoomDir,
      tier: 1,
      more_count: typeof scanResult.more_count === 'number' ? scanResult.more_count : 0,
    });
  } catch (_e) {
    surface = { ok: false, reason: 'surface_threw' };
  }

  if (!surface || !surface.ok) {
    // Surface refused or failed -> defensive degrade. Still continue session.
    return emitContinue();
  }

  // Build the additionalContext payload. Plan 120-03 ships the Larry-voice
  // narrative line per D-17; this scanner hook passes the rendered next-move
  // envelope through verbatim so all three surfaces (CLI / Desktop / Cowork)
  // can render uniformly per the tri-surface invariant.
  // Phase 188-01 (SFS-06): the surface home is the F.1 next-move now (Breakthrough
  // is a MOVE, not a shape -- bare F.7 is the canonical dial per D-10).
  let additionalContext;
  try {
    additionalContext = JSON.stringify({
      shape: 'F.1',
      breakthrough: {
        id: scanResult.top.id,
        kind: scanResult.top.kind,
        confidence: scanResult.top.confidence,
        theme: typeof scanResult.top.theme === 'string' ? scanResult.top.theme.slice(0, 200) : '',
        artifact_ids: Array.isArray(scanResult.top.artifact_ids) ? scanResult.top.artifact_ids.slice(0, 12) : [],
      },
      more_count: scanResult.more_count || 0,
      throttled_kinds: Array.isArray(scanResult.throttled_kinds) ? scanResult.throttled_kinds : [],
      rendered: surface.rendered || null,
    });
  } catch (_e) {
    return emitContinue();
  }

  return emitContinueWithContext(additionalContext);
}

process.on('uncaughtException', function () {
  // Defensive last resort -- the hook NEVER blocks session start.
  try { process.stdout.write(JSON.stringify({ continue: true }) + '\n'); } catch (_e) {}
  process.exit(0);
});

main();
