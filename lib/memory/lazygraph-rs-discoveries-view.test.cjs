#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Regression test for the rs_discoveries SQL view (graph-on-graph P0 cont., 2026-05-11).
 * =====================================================================================
 * The RS SQLite mirror (rs-sqlite-mirror.cjs) writes RSDiscovery records into
 * the `nodes` table with the payload in a JSON `properties` bag. The RS NL/SQL
 * readers (rs-nl-to-query.cjs SQL templates, scripts/rs-thesis-command.cjs)
 * query `FROM rs_discoveries` -- a table that did not exist, so queryGraph
 * swallowed the "no such table" error as []. lazygraph-ops.cjs initSchema now
 * creates a `rs_discoveries` VIEW over `nodes WHERE type = 'RSDiscovery'` that
 * json_extract's the payload keys into the columns the readers expect, renaming
 * the writer's `room_id` -> reader's `room_slug` and `classification` -> `rs_type`.
 *
 * This test:
 *  - opens a throwaway room.db via openGraph
 *  - inserts two RSDiscovery nodes directly into `nodes` (one fintech, one biotech)
 *  - queries `SELECT * FROM rs_discoveries WHERE room_slug = ?` with a bound param
 *    -> asserts the WHERE filter works AND thesis/rs_type/breakthrough_score/room_slug
 *       come back populated
 *  - queries the rs-thesis-shaped read `SELECT id, thesis, rs_type, breakthrough_score,
 *    room_slug, created_at FROM rs_discoveries WHERE id = ? LIMIT 1`
 *
 * Self-contained: no live Brain, no live Aura. Pure CJS, node built-ins only
 * (assert + os + fs + path).
 */

const assert = require('node:assert/strict');
const os = require('os');
const fs = require('fs');
const path = require('path');

const lg = require('../core/lazygraph-ops.cjs');

let passed = 0;
let failed = 0;
const failures = [];

(async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rsv-'));
  let db;
  try {
    const opened = await lg.openGraph(tmpDir);
    db = opened.db;
    const conn = opened.conn;

    // Insert two RSDiscovery nodes directly into `nodes` (mirrors what
    // rs-sqlite-mirror.cjs writes: type='RSDiscovery', properties=JSON bag).
    conn.prepare('INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?)').run(
      'd1', 'RSDiscovery', JSON.stringify({
        thesis: 'fraud-graph mapping',
        classification: 'structural_transfer',
        breakthrough_score: 8,
        room_id: 'fintech',
        created_at: '2026-01-02T00:00:00Z',
        bridge_concept: 'graph similarity',
        dominant_dimension: 'magnitude',
        diff: 0.2,
        lsa: 0.7,
        bert: 0.65,
        domain: 'fintech',
      })
    );
    conn.prepare('INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?)').run(
      'd2', 'RSDiscovery', JSON.stringify({
        thesis: 'CRISPR delivery analogue',
        classification: 'semantic_implementation',
        breakthrough_score: 6,
        room_id: 'biotech',
        created_at: '2026-01-01T00:00:00Z',
        bridge_concept: 'vector packaging',
        dominant_dimension: 'feasibility',
        diff: 0.1,
        lsa: 0.5,
        bert: 0.55,
        domain: 'biotech',
      })
    );

    // (1) rs-nl-to-query-shaped read with a bound room_slug param.
    const rows = await lg.queryGraph(
      conn,
      'SELECT * FROM rs_discoveries WHERE room_slug = ? ORDER BY created_at DESC',
      ['fintech']
    );
    assert.strictEqual(rows.length, 1, 'WHERE room_slug = ? must return exactly the fintech row');
    assert.strictEqual(rows[0].thesis, 'fraud-graph mapping', 'thesis column populated from $.thesis');
    assert.strictEqual(rows[0].rs_type, 'structural_transfer', 'rs_type column mapped from $.classification');
    assert.strictEqual(Number(rows[0].breakthrough_score), 8, 'breakthrough_score column populated');
    assert.strictEqual(rows[0].room_slug, 'fintech', 'room_slug column mapped from $.room_id');

    // (2) rs-thesis-command-shaped read by id.
    const t = await lg.queryGraph(
      conn,
      'SELECT id, thesis, rs_type, breakthrough_score, room_slug, created_at FROM rs_discoveries WHERE id = ? LIMIT 1',
      ['d1']
    );
    assert.strictEqual(t.length, 1, 'WHERE id = ? must return exactly one row');
    assert.strictEqual(t[0].id, 'd1', 'id column passthrough');
    assert.strictEqual(t[0].thesis, 'fraud-graph mapping', 'thesis column populated in id-shaped read');
    assert.strictEqual(t[0].rs_type, 'structural_transfer', 'rs_type column populated in id-shaped read');

    passed = 2;
  } catch (err) {
    failed = 1;
    failures.push(err && err.message ? err.message : String(err));
  } finally {
    try { if (db) await lg.closeGraph(db); } catch (_e) { /* ignore */ }
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  }

  if (failed > 0) {
    process.stderr.write('lazygraph-rs-discoveries-view: FAIL\n');
    for (const f of failures) process.stderr.write('  - ' + f + '\n');
    process.exit(1);
  }
  process.stdout.write('lazygraph-rs-discoveries-view: all assertions passed (bound-param room_slug read + id-shaped read over the view)\n');
  process.exit(0);
})();
