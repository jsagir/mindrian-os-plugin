#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121-02 Task 4 -- D-07 breakthrough_dismissed capture integration tests.
 *
 * Verifies lib/core/breakthrough/scanner.cjs::surfaceBreakthrough emits a
 * breakthrough_dismissed event through lib/core/telemetry/writer.cjs each
 * time a breakthrough is successfully surfaced (after the D-20 provenance
 * check passes). Captures detector_type + verb_chosen + ethics_tier +
 * voice_audit_pass + room_slug_sha256.
 *
 * Test map (4 cases):
 *   1. surfaceBreakthrough on a provenance-good breakthrough with
 *      detector_type='convergence', ethics_tier='SOFT_BAND',
 *      voice_audit_pass=true, options.verb_chosen='Confirm' lands a
 *      breakthrough_dismissed row with all 5 fields preserved.
 *   2. ethics_tier is one of {HARD_FLOOR, SOFT_BAND, NEUTRAL, GREEN}.
 *   3. voice_audit_pass is Boolean (true OR false). Failed audit STILL
 *      emits the event (dismissal signal is valuable regardless).
 *   4. Provenance-blocked surfaceBreakthrough (D-20 refusal) does NOT
 *      emit a breakthrough_dismissed event -- only successful surfacings
 *      count.
 *
 * Hermetic: tmpdir + HOME + isolated room.db.
 *
 * Em-dash HARD RULE: use "--" not U+2014.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO = path.resolve(__dirname, '..');
const SCANNER_PATH = path.join(REPO, 'lib/core/breakthrough/scanner.cjs');
const WRITER_PATH = path.join(REPO, 'lib/core/telemetry/writer.cjs');
const ROOMDB_PATH = path.join(REPO, 'lib/core/room-db.cjs');

function mkTmpDir(prefix) {
  const base = path.join(
    os.tmpdir(),
    'mos-121-02-brk-' + prefix + '-' + process.pid + '-' + Date.now().toString(36)
  );
  fs.mkdirSync(base, { recursive: true });
  return base;
}
function rmRf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) {}
}
function withHome(tmp, fn) {
  const originalHome = process.env.HOME;
  process.env.HOME = tmp;
  try { delete require.cache[require.resolve(WRITER_PATH)]; } catch (_) {}
  try { delete require.cache[require.resolve(SCANNER_PATH)]; } catch (_) {}
  try { return fn(); } finally {
    process.env.HOME = originalHome;
    try { delete require.cache[require.resolve(WRITER_PATH)]; } catch (_) {}
    try { delete require.cache[require.resolve(SCANNER_PATH)]; } catch (_) {}
  }
}
function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, 'utf8');
  return text.split('\n').filter(l => l.length > 0).map(l => JSON.parse(l));
}
function findEventsFile(tmpHome) {
  const dir = path.join(tmpHome, '.mindrian', 'telemetry', 'v1.13');
  if (!fs.existsSync(dir)) return null;
  const names = fs.readdirSync(dir).filter(n => /^events-\d{4}-W\d{2}\.jsonl$/.test(n));
  if (names.length === 0) return null;
  return path.join(dir, names[0]);
}

function makeRoomWithDb(tmp, slug) {
  const roomDir = path.join(tmp, 'rooms', slug);
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  const roomDb = require(ROOMDB_PATH);
  const db = roomDb.openRoomDb(roomDir);
  return { roomDir, db };
}

function seedArtifact(db, id) {
  const nowMs = Date.now();
  db.prepare(
    "INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) " +
    "VALUES (?, 'artifact', '{}', 'test:fixture', 'system', 'confirmed', ?, ?)"
  ).run(id, nowMs, nowMs);
}

function seedBreakthroughWithProvenance(db, bkId, artifactIds, kind) {
  const nowMs = Date.now();
  // Seed artifacts so FK to edges is valid.
  for (const aid of artifactIds) {
    try { seedArtifact(db, aid); } catch (_e) { /* may already exist */ }
  }
  db.prepare(
    "INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) " +
    "VALUES (?, 'breakthrough', '{}', 'test:fixture', 'system', 'proposed', ?, ?)"
  ).run(bkId, nowMs, nowMs);
  for (const aid of artifactIds) {
    db.prepare(
      "INSERT INTO edges (source, target, type, properties) VALUES (?, ?, 'DERIVED_FROM', '{}')"
    ).run(bkId, aid);
  }
}

// ---------- Test 1: surfaceBreakthrough emits breakthrough_dismissed with all 5 fields ----------

(function test1EmitsBreakthroughDismissed() {
  const tmp = mkTmpDir('t1');
  try {
    withHome(tmp, () => {
      const { roomDir, db } = makeRoomWithDb(tmp, 'fixture-room-t1');
      seedBreakthroughWithProvenance(db, 'bk:t1', ['a1', 'a2', 'a3'], 'convergence');
      const scanner = require(SCANNER_PATH);
      const surface = scanner.surfaceBreakthrough({
        id: 'bk:t1',
        kind: 'convergence',
        confidence: 0.78,
        ethics_tier: 'SOFT_BAND',
        voice_audit_pass: true,
        artifact_ids: ['a1', 'a2', 'a3'],
      }, {
        db: db, roomDir: roomDir, tier: 1, more_count: 0, verb_chosen: 'Confirm',
      });
      assert.equal(surface.ok, true, 'surfaceBreakthrough must succeed: ' + JSON.stringify(surface));
      db.close();
      const filePath = findEventsFile(tmp);
      assert.ok(filePath, 'events-YYYY-WNN.jsonl must be created');
      const rows = readJsonl(filePath).filter(r => r.event === 'breakthrough_dismissed');
      assert.equal(rows.length, 1, 'exactly 1 breakthrough_dismissed row; got ' + rows.length);
      const r = rows[0];
      assert.equal(typeof r.detector_type, 'string');
      assert.equal(typeof r.verb_chosen, 'string');
      assert.equal(typeof r.ethics_tier, 'string');
      assert.equal(typeof r.voice_audit_pass, 'boolean');
      assert.equal(r.room_slug_sha256.length, 64, 'room_slug_sha256 must be 64-hex');
      assert.equal(r.ethics_tier, 'SOFT_BAND');
      assert.equal(r.voice_audit_pass, true);
      assert.equal(r.verb_chosen, 'Confirm');
    });
    console.log('PASS test 1: surfaceBreakthrough emits breakthrough_dismissed with 5 fields');
  } finally {
    rmRf(tmp);
  }
})();

// ---------- Test 2: ethics_tier in {HARD_FLOOR, SOFT_BAND, NEUTRAL, GREEN} ----------

(function test2EthicsTierEnum() {
  const tmp = mkTmpDir('t2');
  const tiers = ['HARD_FLOOR', 'SOFT_BAND', 'NEUTRAL', 'GREEN'];
  const valid = new Set(tiers);
  try {
    withHome(tmp, () => {
      const { roomDir, db } = makeRoomWithDb(tmp, 'fixture-room-t2');
      // Seed shared artifacts.
      for (let i = 1; i <= 4; i++) seedArtifact(db, 'a' + i);
      const scanner = require(SCANNER_PATH);
      let i = 0;
      for (const tier of tiers) {
        const bkId = 'bk:t2-' + i;
        const nowMs = Date.now();
        db.prepare(
          "INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) " +
          "VALUES (?, 'breakthrough', '{}', 'test:fixture', 'system', 'proposed', ?, ?)"
        ).run(bkId, nowMs, nowMs);
        db.prepare(
          "INSERT INTO edges (source, target, type, properties) VALUES (?, ?, 'DERIVED_FROM', '{}')"
        ).run(bkId, 'a' + ((i % 4) + 1));
        scanner.surfaceBreakthrough({
          id: bkId, kind: 'convergence', confidence: 0.5,
          ethics_tier: tier, voice_audit_pass: true,
        }, { db: db, roomDir: roomDir, tier: 1, more_count: 0, verb_chosen: 'Confirm' });
        i++;
      }
      db.close();
      const filePath = findEventsFile(tmp);
      const rows = readJsonl(filePath).filter(r => r.event === 'breakthrough_dismissed');
      assert.equal(rows.length, tiers.length,
        tiers.length + ' breakthrough_dismissed rows expected; got ' + rows.length);
      for (let j = 0; j < tiers.length; j++) {
        assert.ok(valid.has(rows[j].ethics_tier),
          'ethics_tier[' + j + '] must be one of ' + JSON.stringify(tiers) + '; got ' + rows[j].ethics_tier);
      }
    });
    console.log('PASS test 2: ethics_tier in {HARD_FLOOR, SOFT_BAND, NEUTRAL, GREEN}');
  } finally {
    rmRf(tmp);
  }
})();

// ---------- Test 3: voice_audit_pass is Boolean; failed audit STILL emits ----------

(function test3VoiceAuditFailedStillEmits() {
  const tmp = mkTmpDir('t3');
  try {
    withHome(tmp, () => {
      const { roomDir, db } = makeRoomWithDb(tmp, 'fixture-room-t3');
      seedBreakthroughWithProvenance(db, 'bk:t3', ['a1', 'a2'], 'convergence');
      const scanner = require(SCANNER_PATH);
      const surface = scanner.surfaceBreakthrough({
        id: 'bk:t3',
        kind: 'convergence',
        confidence: 0.6,
        ethics_tier: 'NEUTRAL',
        voice_audit_pass: false, // FAILED audit -- must STILL emit
        artifact_ids: ['a1', 'a2'],
      }, { db: db, roomDir: roomDir, tier: 1, more_count: 0, verb_chosen: 'Dismiss' });
      assert.equal(surface.ok, true);
      db.close();
      const filePath = findEventsFile(tmp);
      const rows = readJsonl(filePath).filter(r => r.event === 'breakthrough_dismissed');
      assert.equal(rows.length, 1, 'failed voice audit must STILL emit; got ' + rows.length);
      assert.equal(typeof rows[0].voice_audit_pass, 'boolean');
      assert.equal(rows[0].voice_audit_pass, false,
        'voice_audit_pass must reflect the failed audit (Boolean false)');
    });
    console.log('PASS test 3: voice_audit_pass is Boolean; failed audit STILL emits');
  } finally {
    rmRf(tmp);
  }
})();

// ---------- Test 4: Provenance-blocked surfaceBreakthrough does NOT emit ----------

(function test4ProvenanceBlockedNoEmit() {
  const tmp = mkTmpDir('t4');
  try {
    withHome(tmp, () => {
      const { roomDir, db } = makeRoomWithDb(tmp, 'fixture-room-t4');
      // Insert a breakthrough WITHOUT any DERIVED_FROM edges (constitutional
      // bypass attempt). The scanner's D-20 third structural enforcement
      // refuses to surface, so NO breakthrough_dismissed must land.
      const nowMs = Date.now();
      db.prepare(
        "INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) " +
        "VALUES ('bk:bypass-t4', 'breakthrough', '{}', 'test:bypass', 'system', 'proposed', ?, ?)"
      ).run(nowMs, nowMs);
      const scanner = require(SCANNER_PATH);
      const surface = scanner.surfaceBreakthrough(
        { id: 'bk:bypass-t4', kind: 'convergence', artifact_ids: [], confidence: 0.6,
          ethics_tier: 'GREEN', voice_audit_pass: true },
        { db: db, roomDir: roomDir, tier: 1, more_count: 0, verb_chosen: 'Confirm' }
      );
      assert.equal(surface.ok, false, 'provenance-less surfaceBreakthrough must be refused');
      assert.equal(surface.reason, 'provenance_required');
      db.close();
      const filePath = findEventsFile(tmp);
      const rows = filePath ? readJsonl(filePath).filter(r => r.event === 'breakthrough_dismissed') : [];
      assert.equal(rows.length, 0,
        'provenance-blocked surfacing must NOT emit breakthrough_dismissed; got ' + rows.length);
    });
    console.log('PASS test 4: provenance-blocked surfacing does NOT emit breakthrough_dismissed');
  } finally {
    rmRf(tmp);
  }
})();

console.log('\ntest-121-02-breakthrough-dismissed-capture.cjs: 4/4 tests passed');
