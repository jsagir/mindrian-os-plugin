#!/usr/bin/env node
'use strict';

/*
 * SEED-026 W3 (Phase 162-03 Task 2) - scripts/check-graph-export-typemap.cjs
 *
 * The node-type-map COMPLETENESS gate (CI tripwire, T-162-08 mitigation).
 *
 * WHY THIS EXISTS: getGraphExport (lib/core/navigation/graph-export.cjs) renders
 * every room.db node by looking its `type` up in NODE_TYPE_RENDER, skipping the
 * bookkeeping set in EXCLUDE_TYPES, and rendering anything ELSE LOUD as 'unknown'
 * (default color) + flagging it in unmapped_types. That graceful fallback keeps
 * the hot /mos:present path from throwing -- but it also means a NEW schema phase
 * can add a node type that silently renders as a gray 'unknown' blob in the
 * published viz, with nobody noticing. This gate FAILS LOUD on exactly that: it
 * opens a room.db, reads the DISTINCT node types it actually carries, and asserts
 * every one is either in NODE_TYPE_RENDER or in EXCLUDE_TYPES. Any type that is in
 * NEITHER set is an un-classified type -> exit non-zero, name the offender.
 *
 * Reads room.db DIRECTLY (node:sqlite) for a read-only SELECT DISTINCT type query.
 * This is a CI gate over a static fixture, not a runtime navigation path, so it
 * does not go through the navigation.cjs chokepoint -- it deliberately reuses the
 * SAME node:sqlite DatabaseSync that lazygraph-ops.cjs/openGraph uses, mirroring
 * the existing test idiom. It NEVER writes. Canon Part 8: LOCAL only, no Brain.
 *
 * CLI:    node scripts/check-graph-export-typemap.cjs <roomDir>
 *         (exit 0 = every type classified; exit 1 = unmapped type or error)
 * Import: const { checkTypeMap } = require('./check-graph-export-typemap.cjs');
 *         checkTypeMap(roomDir) -> { ok, dbExists, distinctTypes, mapped,
 *                                    excluded, unmapped }  (never throws)
 *
 * No emoji. No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const { NODE_TYPE_RENDER, EXCLUDE_TYPES } = require('../lib/core/navigation/graph-export.cjs');

/**
 * Diff a room.db's live node types against the mapped + excluded sets.
 * @param {string} roomDir - path to the room directory (contains .mindrian/room.db)
 * @returns {{
 *   ok: boolean, dbExists: boolean,
 *   distinctTypes: string[], mapped: string[], excluded: string[], unmapped: string[],
 *   error?: string
 * }}
 */
function checkTypeMap(roomDir) {
  const dbPath = path.join(path.resolve(roomDir), '.mindrian', 'room.db');
  if (!fs.existsSync(dbPath)) {
    // No db is not an unmapped-type failure: an empty/cold room has nothing to
    // classify. ok=true, dbExists=false so callers can distinguish.
    return { ok: true, dbExists: false, distinctTypes: [], mapped: [], excluded: [], unmapped: [] };
  }

  let db;
  try {
    db = new DatabaseSync(dbPath, { readOnly: true });
    const rows = db.prepare('SELECT DISTINCT type FROM nodes').all();
    const distinctTypes = rows.map((r) => r.type).filter((t) => t != null).sort();

    const mapped = [];
    const excluded = [];
    const unmapped = [];
    for (const t of distinctTypes) {
      if (Object.prototype.hasOwnProperty.call(NODE_TYPE_RENDER, t)) {
        mapped.push(t);
      } else if (EXCLUDE_TYPES.has(t)) {
        excluded.push(t);
      } else {
        unmapped.push(t);
      }
    }
    return { ok: unmapped.length === 0, dbExists: true, distinctTypes, mapped, excluded, unmapped };
  } catch (err) {
    return {
      ok: false, dbExists: true,
      distinctTypes: [], mapped: [], excluded: [], unmapped: [],
      error: err && err.message ? err.message : String(err),
    };
  } finally {
    if (db) { try { db.close(); } catch (_) {} }
  }
}

module.exports = { checkTypeMap };

// --- CLI ---
if (require.main === module) {
  const roomDir = process.argv[2];
  if (!roomDir) {
    process.stderr.write('usage: node scripts/check-graph-export-typemap.cjs <roomDir>\n');
    process.exit(2);
  }
  const res = checkTypeMap(roomDir);
  if (res.error) {
    process.stderr.write('check-graph-export-typemap: ERROR opening ' + roomDir + ': ' + res.error + '\n');
    process.exit(1);
  }
  if (!res.dbExists) {
    process.stdout.write('check-graph-export-typemap: no room.db at ' + roomDir + ' (nothing to classify) -- PASS\n');
    process.exit(0);
  }
  process.stdout.write('check-graph-export-typemap: ' + res.distinctTypes.length + ' distinct node types ('
    + res.mapped.length + ' mapped, ' + res.excluded.length + ' excluded)\n');
  if (!res.ok) {
    process.stderr.write('check-graph-export-typemap: FAIL -- ' + res.unmapped.length
      + ' UNMAPPED node type(s) (neither in NODE_TYPE_RENDER nor EXCLUDE_TYPES): '
      + res.unmapped.join(', ') + '\n');
    process.stderr.write('  Add each to NODE_TYPE_RENDER (to render it) or EXCLUDE_TYPES (to skip it) in '
      + 'lib/core/navigation/graph-export.cjs.\n');
    process.exit(1);
  }
  process.stdout.write('check-graph-export-typemap: PASS -- every live node type is classified.\n');
  process.exit(0);
}
