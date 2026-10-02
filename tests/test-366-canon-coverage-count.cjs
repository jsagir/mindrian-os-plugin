#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 366-10 Task 1: canon coverage is an organ statement (D-12), hermetic.
 *   V1  3 things, 1 with a USES_FRAMEWORK edge to a framework-typed node:
 *       things_with_canon_handle 1, things_without_canon_handle 2
 *   V2  an edge to framework:x whose node row is missing is not a handle
 *   V3  a nodes table without a type column (unreadable variant): both null
 *   V4  the doctor detail line names the coverage counts, no banned adjective
 *   V5  SENS-19 watched_by names the coverage count; its firing sum is unchanged
 * Fully local. Rooms live under mkdtemp. No network.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Isolate from the machine's real rooms BEFORE any repo module loads.
const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-cov-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-cov-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;

const REPO_ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(REPO_ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey();
delete process.env.ANTHROPIC_API_KEY;
const net = hygiene.installNetGuard();
const C = hygiene.makeChecker('test-366-canon-coverage-count');

const { DatabaseSync } = require('node:sqlite');
const roomDb = require(path.join(REPO_ROOT, 'lib/core/room-db.cjs'));
const { insertNode } = require(path.join(REPO_ROOT, 'lib/core/node-insert.cjs'));
const counts = require(path.join(REPO_ROOT, 'lib/core/navigation/graph-integrity-counts.cjs'));

const CANON = 'Reverse Salient Analysis';

function buildRoom(label, spec) {
  const roomDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-cov-' + label + '-')), 'room');
  fs.mkdirSync(roomDir, { recursive: true });
  const db = roomDb.openRoomDb(roomDir);
  try {
    spec.nodes.forEach(function (n) {
      insertNode(db, n[0], n[1], JSON.stringify(n[2] || { title: n[0] }), { source_path: 'test:366-cov', epistemic_type: 'observation' });
    });
    const ins = db.prepare('INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)');
    (spec.edges || []).forEach(function (e) { ins.run(e[0], e[1], e[2], '{}'); });
  } finally {
    roomDb.closeRoomDb(db);
  }
  return roomDir;
}

function bagFor(roomDir) {
  const db = new DatabaseSync(path.join(roomDir, '.mindrian', 'room.db'), { readOnly: true });
  try { return counts.countGraphIntegrity(db); } finally { db.close(); }
}

// ---- V1 ----------------------------------------------------------------
const r1 = buildRoom('v1', {
  nodes: [
    ['pd/A', 'Artifact'], ['pd/B', 'Artifact'], ['pd/C', 'claim'],
    ['framework:reverse-salient-analysis', 'framework', { name: CANON }],
    ['section:pd', 'Section', { slug: 'pd' }],
    ['ev:1', 'memory_event', { title: 'ev' }],
  ],
  edges: [['pd/A', 'framework:reverse-salient-analysis', 'USES_FRAMEWORK']],
});
const b1 = bagFor(r1);
C.check('V1 things_with_canon_handle is 1', b1.things_with_canon_handle === 1, String(b1.things_with_canon_handle));
C.check('V1 things_without_canon_handle is 2', b1.things_without_canon_handle === 2, String(b1.things_without_canon_handle));

// ---- V2 ----------------------------------------------------------------
const r2 = buildRoom('v2', {
  nodes: [['pd/A', 'Artifact'], ['pd/B', 'Artifact']],
  edges: [['pd/A', 'framework:ghost', 'USES_FRAMEWORK']],
});
const b2 = bagFor(r2);
C.check('V2 an edge to a missing framework node is not a handle', b2.things_with_canon_handle === 0 && b2.things_without_canon_handle === 2, JSON.stringify([b2.things_with_canon_handle, b2.things_without_canon_handle]));
C.check('V2 the missing endpoint still counts in the existing statement', b2.edge_rows_missing_endpoint === 1, String(b2.edge_rows_missing_endpoint));

// ---- V3 ----------------------------------------------------------------
const unreadableDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-cov-v3-')), 'room');
fs.mkdirSync(unreadableDir, { recursive: true });
{
  const raw = new DatabaseSync(':memory:');
  raw.exec('CREATE TABLE nodes (id TEXT PRIMARY KEY); CREATE TABLE edges (source TEXT, target TEXT, type TEXT);');
  const b3 = counts.countGraphIntegrity(raw);
  raw.close();
  C.check('V3 unreadable variant: schema_variant is unreadable', b3.schema_variant === 'unreadable', b3.schema_variant);
  C.check('V3 unreadable variant: both coverage keys are null, never 0', b3.things_with_canon_handle === null && b3.things_without_canon_handle === null, JSON.stringify([b3.things_with_canon_handle, b3.things_without_canon_handle]));
}
{
  const legacy = new DatabaseSync(':memory:');
  legacy.exec("CREATE TABLE nodes (id TEXT PRIMARY KEY, type TEXT NOT NULL, properties TEXT DEFAULT '{}'); CREATE TABLE edges (source TEXT, target TEXT, type TEXT, PRIMARY KEY (source, target, type));");
  legacy.exec("INSERT INTO nodes (id, type) VALUES ('a', 'Artifact')");
  const b3b = counts.countGraphIntegrity(legacy);
  legacy.close();
  C.check('V3 legacy variant still answers the statement', b3b.things_with_canon_handle === 0 && b3b.things_without_canon_handle === 1, JSON.stringify([b3b.things_with_canon_handle, b3b.things_without_canon_handle]));
}

// ---- V4 (doctor organ) -------------------------------------------------
const roomsHome = process.env.MINDRIAN_ROOMS_HOME;
fs.mkdirSync(path.join(roomsHome, '.rooms'), { recursive: true });
fs.writeFileSync(path.join(roomsHome, '.rooms', 'registry.json'), JSON.stringify({ active: 'cov', rooms: { cov: { abs_path: r1 } } }));
const mod = require(path.join(REPO_ROOT, 'lib/core/doctor/room-graph-integrity-module.cjs'));
const res = mod.check({});
C.check('V4 detail names the coverage counts', /1 thing\(s\) with a canon handle, 2 without/.test(res.detail), res.detail);
C.check('V4 totals carry the two coverage fields', res.totals && res.totals.things_with_canon_handle === 1 && res.totals.things_without_canon_handle === 2, JSON.stringify(res.totals && [res.totals.things_with_canon_handle, res.totals.things_without_canon_handle]));
const BANNED = /\b(orphan|orphaned|dangling|broken|corrupt|stale|unhealthy|degraded|dense|sparse|density|risk|healthy)\b/i;
C.check('V4 no banned adjective in the detail line', !BANNED.test(res.detail), res.detail);
C.check('V4 status is never warn', res.status === 'ok', res.status);

// ---- V5 (SENS-19) ------------------------------------------------------
const priority = require(path.join(REPO_ROOT, 'lib/core/sensors/sensor-priority.cjs'));
const recs = priority.SENS_PRIORITY;
const rec = (recs || []).find(function (r) { return r && r.id === 'SENS-19'; });
C.check('V5 SENS-19 watched_by names the canon coverage count', !!rec && /canon coverage count/.test(rec.watched_by), rec && rec.watched_by);
C.check('V5 SENS-19 optimizes is unchanged', !!rec && rec.optimizes === 'the count of room-graph-integrity contradiction offers surfaced to the navigator', rec && rec.optimizes);
const sensor = require(path.join(REPO_ROOT, 'lib/core/sensors/sensor-graph-integrity.cjs'));
const fn = sensor.sensorGraphIntegrity || sensor;
const noDefects = fn({}, {}, { graph_integrity: { edge_rows_missing_endpoint: 0, claim_nodes_no_anchor_new: 0, things_with_canon_handle: 0, things_without_canon_handle: 100000 } });
C.check('V5 huge coverage gap alone never fires the sensor', noDefects === null);
const defects = fn({}, {}, { graph_integrity: { edge_rows_missing_endpoint: 25, claim_nodes_no_anchor_new: 0, things_with_canon_handle: 100000, things_without_canon_handle: 0 } });
C.check('V5 the firing sum still reads only the two defect counts', defects !== null && typeof defects === 'object');
const src = fs.readFileSync(path.join(REPO_ROOT, 'lib/core/sensors/sensor-graph-integrity.cjs'), 'utf8');
C.check('V5 sensor source never reads the coverage keys', !/things_(with|without)_canon_handle/.test(src));

C.check('no network attempted', net.attempts() === 0);
net.restore();
process.exit(C.summary());
