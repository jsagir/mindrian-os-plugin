#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 150.8-03 (DIKW-06) -- SessionStart resurface hook for the ambiguous
 * claim queue. Copied verbatim in shape from
 * scripts/check-pending-breakthrough.cjs (the queue-then-surface template):
 * same envelope emission, same room resolution, same D-16 empty-state silence,
 * same uncaughtException last-resort guard. Only the scan, the payload, the
 * mandatory Dismiss verb, and the 3-strikes throttle change.
 *
 * Flow:
 *   1. Resolve ROOMS_HOME (env override OR ~/MindrianRooms default).
 *   2. Read .rooms/registry.json (or MINDRIAN_ACTIVE_ROOM_DIR test fallback) for
 *      the active room dir.
 *   3. Open room.db via lib/core/room-db.cjs openRoomDb (the navigation
 *      chokepoint room handle -- never a direct sqlite open).
 *   4. Scan: SELECT id, properties FROM nodes WHERE type='claim'
 *      AND json_extract(properties,'$.disambiguation')='ambiguous'
 *      AND review_status='proposed'.
 *   5. Throttle pre-pass (the dismissal-canary fix, mirrors
 *      lib/memory/pending-tension-store.cjs evaluateAndDecay 3-strikes): bump a
 *      surfacing_count integer inside each ambiguous claim's properties JSON;
 *      surfacing_count >= 3 flips disambiguation 'ambiguous' -> 'dismissed' so the
 *      same node never re-surfaces forever.
 *   6. If the post-throttle queue is empty -> emit {continue:true} (D-16 silence).
 *   7. Else emit the canonical SessionStart envelope with additionalContext
 *      carrying COUNTS + node ids ONLY (no segment prose, Canon Part 8) and a
 *      MANDATORY Dismiss verb (mirrors the F.7 D-10 mandatory-Dismiss doctrine).
 *   8. ANY uncaught error -> degrade to {continue:true} + exit 0. The hook NEVER
 *      blocks session start.
 *
 * Desktop / Cowork fallback: those surfaces do not run CLI SessionStart hooks.
 * The same ambiguous queue is reachable there through the /mos:file-meeting
 * post-filing F.1 selector ("Review ambiguous segments") which reads the same
 * json_extract scan -- the hook is the CLI accelerator, not the only door.
 *
 * Canon Part 8: pure LOCAL scan; no Brain MCP coupling; the additionalContext
 *   payload carries enum/scalar COUNTS + node ids only, never segment prose.
 * Canon Part 9: ALL reads/writes via the navigation chokepoint room handle.
 *
 * Em-dash HARD RULE (CLAUDE.md feedback_no_emdashes): use `--` not U+2014.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// The 3-strikes throttle constant (mirrors pending-tension-store.cjs: surfacing
// count >= 3 retires the item so a dismissal-canary item never nags forever).
const THROTTLE_STRIKES = 3;

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
  // Try .rooms/registry.json first (the canonical Phase 83 active-room source).
  if (roomsHome) {
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
  }
  // Fallback: env override allows tests to point at a specific room dir.
  if (process.env.MINDRIAN_ACTIVE_ROOM_DIR && fs.existsSync(process.env.MINDRIAN_ACTIVE_ROOM_DIR)) {
    return process.env.MINDRIAN_ACTIVE_ROOM_DIR;
  }
  return null;
}

// The active-queue predicate: an ambiguous, still-proposed claim.
const QUEUE_SQL =
  "SELECT id, properties FROM nodes " +
  "WHERE type='claim' " +
  "AND json_extract(properties,'$.disambiguation')='ambiguous' " +
  "AND review_status='proposed'";

// Throttle pre-pass: bump surfacing_count on every active ambiguous claim; when
// it reaches the 3-strikes ceiling, flip disambiguation 'ambiguous' ->
// 'dismissed' so the node leaves the active queue (dismissal-canary fix). The
// update writes ONLY enum/scalar JSON props back into room.db (Part 8): no body
// text, no prose, just the surfacing_count integer and the dismissed marker.
// Returns the list of { id } still active AFTER the throttle pass.
function throttleAndCollect(db) {
  let rows = [];
  try {
    rows = db.prepare(QUEUE_SQL).all();
  } catch (_e) {
    return [];
  }
  const stillActive = [];
  for (const row of rows) {
    let props;
    try {
      props = JSON.parse(row.properties);
    } catch (_e) {
      continue; // unparseable props -- skip defensively, never crash
    }
    if (!props || typeof props !== 'object') continue;
    const prevCount = Number.isInteger(props.surfacing_count) ? props.surfacing_count : 0;
    const nextCount = prevCount + 1;
    props.surfacing_count = nextCount;
    if (nextCount >= THROTTLE_STRIKES) {
      // 3-strikes: retire the node from the active queue.
      props.disambiguation = 'dismissed';
    }
    let propsJson;
    try {
      propsJson = JSON.stringify(props);
    } catch (_e) {
      continue;
    }
    try {
      // Phase 194-06 Task 1 (PSB-08 pre-req): this maintenance read-merge-write on
      // properties (surfacing_count) also bumps last_modified_at so the CAS token
      // moves; the token must advance on every content mutation, even offline ones.
      db.prepare('UPDATE nodes SET properties = ?, last_modified_at = ? WHERE id = ?')
        .run(propsJson, Date.now(), row.id);
    } catch (_e) {
      continue;
    }
    if (props.disambiguation === 'ambiguous') {
      stillActive.push({ id: row.id });
    }
  }
  return stillActive;
}

function main() {
  const roomsHome = resolveRoomsHome();
  const activeRoomDir = readActiveRoomDir(roomsHome);
  if (!activeRoomDir) {
    // No active room -> nothing to scan. D-16 silence.
    return emitContinue();
  }

  // Lazy-require the navigation chokepoint room handle. If it fails to load
  // (partial install), degrade to {continue:true} via the guard below.
  let roomDb;
  try {
    roomDb = require(path.join(__dirname, '..', 'lib', 'core', 'room-db.cjs'));
  } catch (_e) {
    return emitContinue();
  }

  // The room.db may not exist yet for a brand-new room -> D-16 silence. The
  // canonical room.db path is <roomDir>/.mindrian/room.db (openRoomDb resolves
  // it there); a missing file means there is nothing to scan.
  const dbPath = path.join(activeRoomDir, '.mindrian', 'room.db');
  if (!fs.existsSync(dbPath)) {
    return emitContinue();
  }

  let db;
  try {
    db = roomDb.openRoomDb(activeRoomDir);
  } catch (_e) {
    return emitContinue();
  }

  let active;
  try {
    active = throttleAndCollect(db);
  } catch (_e) {
    try { roomDb.closeRoomDb ? roomDb.closeRoomDb(db) : db.close(); } catch (_e2) {}
    return emitContinue();
  }

  try { roomDb.closeRoomDb ? roomDb.closeRoomDb(db) : db.close(); } catch (_e) {}

  if (!active || active.length === 0) {
    // D-16 empty-state silence: no active ambiguous claims (the queue is empty,
    // or every member was just retired by the throttle). NO additionalContext.
    return emitContinue();
  }

  // Build the additionalContext payload. COUNTS + node ids ONLY -- NEVER the
  // segment prose (Canon Part 8). The verbs include a MANDATORY Dismiss (the
  // F.7 D-10 mandatory-Dismiss doctrine mirrored for this resurface host: the
  // navigator can always retire the queue).
  let additionalContext;
  try {
    additionalContext = JSON.stringify({
      shape: 'F.1',
      ambiguous_count: active.length,
      node_ids: active.map((n) => n.id).slice(0, 25),
      verbs: [
        'Review ambiguous segments',
        'Confirm proposed claims',
        'Dismiss',
        'Back',
      ],
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
