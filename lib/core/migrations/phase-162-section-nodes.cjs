'use strict';
/**
 * Phase 162-02 (R11 / D-B) -- Section-node backfill migration.
 *
 * D-B (LOCKED): real Section nodes are written into room.db at room birth
 * (lib/core/navigation/room-birth.cjs writeSectionNodes), AND this migration
 * backfills Section nodes for EXISTING rooms that were born before D-B shipped.
 * Once room.db carries real Section nodes the export-time section anchors in
 * lib/core/navigation/graph-export.cjs demote to a Tier-0 fallback (they fire
 * only when room.db is absent or has zero included nodes).
 *
 * Authored as the migrate-hats-to-roomdb.cjs ANALOG (Canon Part 7 reuse): the
 * alreadyMigrated guard + stampSentinel-via-navigation.logMemoryEvent idiom, the
 * idempotent backfill, never deletes, never auto-runs destructively.
 *
 * Allow-list rationale (Canon Part 9):
 *   This module lives in lib/core/migrations/ which scripts/check-substrate.cjs
 *   allow-lists (/^lib\/core\/migrations\//), so it may open room.db via
 *   lib/core/room-db.cjs::openRoomDb (the lazy creator + migration chain). It
 *   NEVER uses the caller-only opener and NEVER constructs a raw SQLite handle
 *   directly. The Section-node write reuses writeSectionNodes (the same helper
 *   birthRoom uses) and the idempotency sentinel is stamped through
 *   navigation.logMemoryEvent (the chokepoint), mirroring migrate-hats.
 *
 * Canon Part 8: zero Brain egress. All writes are LOCAL to the caller's room.db.
 *   The section_nodes_migration memory_event carries only a count scalar +
 *   source_path; never a node body, never user prose.
 *
 * Idempotent: alreadyMigrated returns true when a section_nodes_migration sentinel
 * event exists OR any Section node is already present. A second run is a no-op and
 * reports already_migrated:true with migrated:0.
 *
 * Exports:
 *   migrateSectionNodes(roomDir) -> {
 *     ok, migrated, skipped?, already_migrated?, reason?
 *   }
 *   MIGRATION_TAG (string)
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const fs = require('node:fs');
const path = require('node:path');

const roomDbMod = require('../room-db.cjs');
const navigation = require('../navigation.cjs');
const { writeSectionNodes, SECTION_NAMES } = require('../navigation/room-birth.cjs');

let discoverSections = null;
try { ({ discoverSections } = require('../section-registry.cjs')); } catch (_) { discoverSections = null; }

const MIGRATION_TAG = 'phase_162_section_nodes_v1';

function _hasRoomDb(roomDir) {
  try {
    return fs.existsSync(path.join(path.resolve(roomDir), '.mindrian', 'room.db'));
  } catch (_) {
    return false;
  }
}

// Discover the room's sections (the same source graph-export.cjs cold-start uses).
// Falls back to the canonical 8 SECTION_NAMES when discovery returns nothing.
function _discoverSectionSlugs(roomDir) {
  if (discoverSections) {
    try {
      const res = discoverSections(roomDir);
      if (res && Array.isArray(res.all) && res.all.length > 0) return res.all;
    } catch (_) { /* fall through */ }
  }
  return SECTION_NAMES.slice();
}

// alreadyMigrated(roomDir) -- a Section node present OR a section_nodes_migration
// sentinel event makes a second run a no-op. Read-only.
function alreadyMigrated(db) {
  // Any existing Section node short-circuits (covers freshly-birthed D-B rooms).
  try {
    const row = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'Section'").get();
    if (row && row.n > 0) return true;
  } catch (_) { /* tolerate */ }

  // Sentinel event check via the navigation chokepoint read primitive.
  try {
    const recent = navigation.findRecentChanges(db, 0, {
      eventType: 'section_nodes_migration', limit: 50,
    });
    if (Array.isArray(recent)) {
      for (const ev of recent) {
        const props = ev && ev.properties ? ev.properties : {};
        if (props.migration === MIGRATION_TAG || props.event_type === 'section_nodes_migration') return true;
      }
    }
  } catch (_) { /* tolerate */ }

  return false;
}

/**
 * migrateSectionNodes(roomDir) -- one-shot idempotent Section-node backfill.
 *
 * @param {string} roomDirInput - absolute or relative path to room directory
 * @returns {{ok:boolean, migrated:number, already_migrated?:boolean, skipped?:boolean, reason?:string}}
 */
function migrateSectionNodes(roomDirInput) {
  const roomDir = path.resolve(roomDirInput || '.');

  if (!_hasRoomDb(roomDir)) {
    return { ok: false, migrated: 0, skipped: true, reason: 'no_room_db' };
  }

  let db;
  try {
    db = roomDbMod.openRoomDb(roomDir);
  } catch (e) {
    return { ok: false, migrated: 0, reason: 'open_room_db_failed', detail: String(e && e.message || e).slice(0, 200) };
  }

  try {
    if (alreadyMigrated(db)) {
      return { ok: true, migrated: 0, already_migrated: true };
    }

    const sectionSlugs = _discoverSectionSlugs(roomDir);

    let written = 0;
    db.exec('BEGIN');
    try {
      written = writeSectionNodes(db, sectionSlugs);
      db.exec('COMMIT');
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch (_) {}
      return { ok: false, migrated: 0, reason: 'backfill_failed', detail: String(e && e.message || e).slice(0, 200) };
    }

    // Stamp the idempotency sentinel through the navigation chokepoint
    // (system-bookkeeping memory_event; Part 9 v1.5 audit-node carve-out).
    try {
      navigation.logMemoryEvent(db, 'section_nodes_migration', {
        migration: MIGRATION_TAG,
        migrated_count: written,
        created_by: 'system',
        source_path: 'system:migrate-section-nodes',
      });
    } catch (_) {
      // Tolerate: the Section nodes are written; a sentinel-log failure degrades
      // to "any Section node present" short-circuit on the next run.
    }

    return { ok: true, migrated: written };
  } finally {
    try { roomDbMod.closeRoomDb(db); } catch (_) {}
  }
}

module.exports = { migrateSectionNodes, MIGRATION_TAG };
