#!/usr/bin/env node
'use strict';

/*
 * Phase 130-03 -- one-shot idempotent backfill: legacy hat STATE.md files into
 * room.db HatState nodes.
 *
 * Before Plan 03, hat state lived at room/.mindrian/hats/{color}/STATE.md as a
 * markdown file. Plan 03 RETIRES those filesystem writes and moves the canonical
 * state into typed HatState nodes in room.db (via lib/core/navigation.cjs). This
 * script migrates existing users' STATE.md content into HatState nodes ONE-SHOT
 * on first run after the upgrade, then leaves the markdown files in place as a
 * READ-ONLY ARCHIVE (the 130-CONTEXT pre-resolved decision).
 *
 * Idempotency: a re-run is a no-op. We stamp a 'state_alias_migration' memory_event
 * sentinel (payload.migration === 'hats_to_roomdb') after a successful pass; on a
 * subsequent run we query for that sentinel and skip if present. The legacy
 * markdown is NEVER deleted.
 *
 * This script IS allow-listed (scripts/migrate- prefix in check-substrate.cjs's
 * ALLOWED_DIRECT_IMPORT), so it MAY open room.db directly -- but per the plan it
 * PREFERS routing the writes through navigation.cjs (writeHatStateByRoomDir) for
 * consistency, opening room.db directly only for the sentinel read/write.
 *
 * Canon Part 8: zero network surface. Pure LOCAL filesystem + SQLite.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const fs = require('fs');
const path = require('path');
const navigation = require('../lib/core/navigation.cjs');
const roomDbMod = require('../lib/core/room-db.cjs');

const HAT_COLORS = ['white', 'red', 'black', 'yellow', 'green', 'blue'];

// The migration sentinel marker. A successful pass writes a 'state_alias_migration'
// memory_event with this migration tag; a re-run that finds it skips.
const MIGRATION_TAG = 'hats_to_roomdb';

function _roomDbPath(roomDir) {
  return path.join(roomDir, '.mindrian', 'room.db');
}

function _hasRoomDb(roomDir) {
  try {
    return fs.statSync(_roomDbPath(roomDir)).isFile();
  } catch (_e) {
    return false;
  }
}

// Parse a legacy hat STATE.md into the structured hat-state shape. Mirrors the
// parser that lib/core/hat-persistence.cjs carried before the Plan 03 rewrite,
// so a migrated node matches what the old loader would have produced.
function parseHatState(content) {
  const state = {
    current_focus: 'General analysis',
    last_analysis: 'never',
    top_concerns: [],
    top_opportunities: [],
    methodology_notes: [],
    session_count: 0,
  };
  if (!content || typeof content !== 'string') return state;

  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fmMatch) {
    const lines = fmMatch[1].split('\n');
    for (const line of lines) {
      const kvMatch = line.match(/^([a-z_]+):\s*(.*)$/);
      if (kvMatch) {
        const key = kvMatch[1];
        const val = kvMatch[2].trim();
        if (key === 'current_focus') state.current_focus = val;
        if (key === 'last_analysis') state.last_analysis = val;
        if (key === 'session_count') state.session_count = parseInt(val, 10) || 0;
      }
    }
  }

  const bodyStart = content.indexOf('---', content.indexOf('---') + 3);
  const body = bodyStart >= 0 ? content.slice(bodyStart + 3) : content;

  const concernsMatch = body.match(/## Top Concerns\n([\s\S]*?)(?=\n## |$)/);
  if (concernsMatch) {
    state.top_concerns = concernsMatch[1]
      .split('\n')
      .filter(l => l.trim().startsWith('-'))
      .map(l => l.replace(/^\s*-\s*/, '').trim())
      .filter(Boolean)
      .filter(v => v.toLowerCase() !== 'none yet');
  }

  const oppsMatch = body.match(/## Top Opportunities\n([\s\S]*?)(?=\n## |$)/);
  if (oppsMatch) {
    state.top_opportunities = oppsMatch[1]
      .split('\n')
      .filter(l => l.trim().startsWith('-'))
      .map(l => l.replace(/^\s*-\s*/, '').trim())
      .filter(Boolean)
      .filter(v => v.toLowerCase() !== 'none yet');
  }

  const methMatch = body.match(/## Methodology Notes\n([\s\S]*?)(?=\n## |$)/);
  if (methMatch) {
    state.methodology_notes = methMatch[1]
      .split('\n')
      .filter(l => l.trim().startsWith('-'))
      .map(l => l.replace(/^\s*-\s*/, '').trim())
      .filter(Boolean)
      .filter(v => v.toLowerCase() !== 'none yet');
  }

  return state;
}

// alreadyMigrated(roomDir) -- query room.db for the sentinel memory_event so a
// second run is a no-op. Opens room.db directly (allow-listed) for a read-only
// check via navigation.findRecentChanges.
function alreadyMigrated(roomDir) {
  if (!_hasRoomDb(roomDir)) return false;
  let db;
  try {
    db = roomDbMod.openRoomDb(roomDir);
    const recent = navigation.findRecentChanges(db, 0, {
      eventType: 'state_alias_migration', limit: 50,
    });
    if (Array.isArray(recent)) {
      for (const ev of recent) {
        const props = ev && ev.properties ? ev.properties : {};
        if (props.migration === MIGRATION_TAG) return true;
      }
    }
    return false;
  } catch (_e) {
    return false;
  } finally {
    try { if (db) roomDbMod.closeRoomDb(db); } catch (_e) { /* tolerant */ }
  }
}

// stampSentinel(roomDir, migratedColors) -- write the idempotency sentinel after
// a successful pass. Routes through navigation.logMemoryEvent (the chokepoint);
// opens room.db directly only to hold the handle the logMemoryEvent call needs.
function stampSentinel(roomDir, migratedColors) {
  if (!_hasRoomDb(roomDir)) return false;
  let db;
  try {
    db = roomDbMod.openRoomDb(roomDir);
    const res = navigation.logMemoryEvent(db, 'state_alias_migration', {
      migration: MIGRATION_TAG,
      migrated_count: migratedColors.length,
      source_path: 'system:migrate-hats-to-roomdb',
    });
    return !!(res && res.ok);
  } catch (_e) {
    return false;
  } finally {
    try { if (db) roomDbMod.closeRoomDb(db); } catch (_e) { /* tolerant */ }
  }
}

/**
 * migrateHatsToRoomDb(roomDir) -- one-shot idempotent backfill.
 * Scans room/.mindrian/hats/{color}/STATE.md for each of the 6 colors, parses
 * each, and writes it to a HatState node via navigation.writeHatStateByRoomDir.
 * Leaves the markdown files in place as a read-only archive. Stamps an
 * idempotency sentinel so a second run is a no-op.
 *
 * @param {string} roomDirInput - Absolute or relative path to room directory
 * @returns {{ ok: boolean, migrated: string[], skipped: boolean, reason?: string }}
 */
function migrateHatsToRoomDb(roomDirInput) {
  const roomDir = path.resolve(roomDirInput || '.');

  if (!_hasRoomDb(roomDir)) {
    // Defensive (T-130-03-03 accept): no room.db means nothing to backfill into;
    // the legacy STATE.md stays readable as the archive.
    return { ok: false, migrated: [], skipped: false, reason: 'no_room_db' };
  }

  if (alreadyMigrated(roomDir)) {
    return { ok: true, migrated: [], skipped: true, reason: 'already_migrated' };
  }

  const migrated = [];
  for (const color of HAT_COLORS) {
    const statePath = path.join(roomDir, '.mindrian', 'hats', color, 'STATE.md');
    let content;
    try {
      content = fs.readFileSync(statePath, 'utf-8');
    } catch (_e) {
      // No legacy STATE.md for this color -- nothing to migrate; skip.
      continue;
    }
    const parsed = parseHatState(content);
    const res = navigation.writeHatStateByRoomDir(roomDir, color, parsed);
    if (res && res.ok) {
      migrated.push(color);
    }
  }

  stampSentinel(roomDir, migrated);

  return { ok: true, migrated, skipped: false };
}

// CLI entry: node scripts/migrate-hats-to-roomdb.cjs <roomDir>
if (require.main === module) {
  const roomDir = process.argv[2] || './room';
  const result = migrateHatsToRoomDb(roomDir);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(result.ok ? 0 : 1);
}

module.exports = { migrateHatsToRoomDb, parseHatState };
