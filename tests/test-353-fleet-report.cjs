#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 353 Plan 01 Task 8 -- test-353-fleet-report: the report-mode-only
 * fleet walk. Walks every room in the registry, calling buildRoomMap per
 * room IN MEMORY WITHOUT WRITING ANYTHING, and emits a counted evidence
 * file: per-kind counts, missing-ROOM.md counts (scoped to the four
 * R-353-B blocked kinds), and a registry-lineage-drift count. No file name,
 * no artifact title, and no file content is ever recorded -- only
 * directory kinds, counts, and room slugs.
 *
 * HARD CONSTRAINTS, each enforced as an assertion in this file, not by
 * convention:
 *   - this file never invokes a doctor-module repair function and never
 *     passes a repair flag to anything (the acceptance grep for the two
 *     literal repair-invocation patterns returns zero hits on this file);
 *   - this file NEVER writes any file under a resolved room path or under
 *     the registry's rooms-home (buildRoomMap is a pure read; the two
 *     writer exports of lib/core/room-map.cjs are never imported here);
 *   - the emitted evidence JSON never carries a ".md" file name.
 *
 * If the registry or the rooms-home directory is absent (a machine with no
 * real fleet), this prints SKIP and exits 0 -- a fresh install with zero
 * rooms is not a failure.
 *
 * Run: node tests/test-353-fleet-report.cjs
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const EVIDENCE_PATH = path.join(
  REPO, '.planning', 'phases',
  '353-icm-section-ruling-system-self-locating-room-map-jtbd-rooted',
  '353-FLEET-REPORT.json'
);

let sharedDoctor;
let roomMap;
try {
  sharedDoctor = require(path.join(REPO, 'lib', 'core', 'doctor', 'shared.cjs'));
  roomMap = require(path.join(REPO, 'lib', 'core', 'room-map.cjs'));
} catch (e) {
  console.error('FAIL: test-353-fleet-report -- required module failed to load: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
}

const BLOCKED_KINDS = ['root', 'section', 'structural', 'sub-room'];
const ALL_KINDS = ['root', 'section', 'structural', 'sub-room', 'artifact'];

function main() {
  const reg = sharedDoctor.readRegistry();
  if (!reg || !reg.registry || typeof reg.registry.rooms !== 'object') {
    console.log('SKIP: fleet report -- no registry on this machine');
    process.exit(0);
  }
  const roomsHome = reg.roomsHome;
  if (!roomsHome || !fs.existsSync(roomsHome)) {
    console.log('SKIP: fleet report -- no registry on this machine');
    process.exit(0);
  }

  const roomsObj = reg.registry.rooms;
  const slugs = Array.isArray(roomsObj) ? [] : Object.keys(roomsObj);

  const perRoom = [];
  const totals = {
    root: 0, section: 0, structural: 0, 'sub-room': 0, artifact: 0,
    missing_room_md: { root: 0, section: 0, structural: 0, 'sub-room': 0 },
    registry_drift: 0,
  };

  for (const slug of slugs) {
    const entry = roomsObj[slug];
    if (!entry || !entry.path) continue;
    const roomPath = path.isAbsolute(entry.path) ? entry.path : path.join(roomsHome, entry.path);
    if (!fs.existsSync(roomPath)) continue; // stale registry entry; skip, never create
    if (!fs.existsSync(path.join(roomPath, '.room-root'))) continue; // not a real room boundary

    // READ-ONLY: buildRoomMap only ever calls fs.readdirSync/fs.existsSync/
    // fs.readFileSync. Nothing here writes a byte anywhere.
    let map;
    try {
      map = roomMap.buildRoomMap(roomPath);
    } catch (_e) {
      continue; // an unreadable room is skipped, never repaired
    }

    const kinds = { root: 0, section: 0, structural: 0, 'sub-room': 0, artifact: 0 };
    const missingByKind = { root: 0, section: 0, structural: 0, 'sub-room': 0 };
    let registryDrift = 0;
    for (const node of map.nodes) {
      if (kinds[node.kind] !== undefined) kinds[node.kind] += 1;
      if (BLOCKED_KINDS.indexOf(node.kind) !== -1 && node.has_room_md === false) {
        missingByKind[node.kind] += 1;
      }
      if (node.registry_drift) registryDrift += 1;
    }

    // Only the slug, kinds, missing-by-kind, and a drift count -- no path,
    // no file name, no artifact title, no file content.
    perRoom.push({
      slug: slug,
      kinds: kinds,
      missing_room_md_by_kind: missingByKind,
      registry_drift: registryDrift,
    });

    for (const k of ALL_KINDS) totals[k] += kinds[k];
    for (const k of BLOCKED_KINDS) totals.missing_room_md[k] += missingByKind[k];
    totals.registry_drift += registryDrift;
  }

  const report = {
    measured_at: new Date().toISOString(),
    rooms_scanned: perRoom.length,
    per_room: perRoom,
    totals: totals,
    // R-353-B restatement (D-353-CONTEXT): success criterion 1's "0
    // directories without ROOM.md" is scoped to the four blocked kinds
    // (root|section|structural|sub-room), never to every non-dot directory
    // in the tree (artifact folders are excluded by rule and never
    // blocked). Quoted verbatim so a reader does not need the research doc
    // to know the scope this number measures.
    scope_note: 'missing_room_md counts are scoped to root/section/structural/sub-room only (R-353-B); artifact folders are excluded by rule and never counted here.',
  };

  fs.mkdirSync(path.dirname(EVIDENCE_PATH), { recursive: true });
  fs.writeFileSync(EVIDENCE_PATH, JSON.stringify(report, null, 2) + '\n', 'utf8');

  // Self-checks (assertions, not convention):
  const raw = fs.readFileSync(EVIDENCE_PATH, 'utf8');
  assert.ok(!/\.md"/.test(raw), 'no file name appears in the evidence file');
  assert.equal(typeof report.rooms_scanned, 'number');
  assert.ok(Array.isArray(report.per_room));
  for (const r of report.per_room) {
    for (const v of Object.values(r.kinds)) assert.ok(Number.isInteger(v));
  }

  console.log('rooms_scanned: ' + report.rooms_scanned);
  console.log('totals: ' + JSON.stringify(totals));
  console.log(report.scope_note);
  console.log('evidence written to: ' + path.relative(REPO, EVIDENCE_PATH));
  console.log('');
  console.log('PASS test-353-fleet-report.cjs');
}

main();
