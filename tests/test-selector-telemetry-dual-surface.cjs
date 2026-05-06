#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.2-03 Task 2 -- dual-surface telemetry assertions.
 *
 * Replaces the 88.2-00 Wave-0 stub. Validates D-AMEND-02 Option B:
 *   - JSONL primary surface continues to write (regression-safe).
 *   - Mirror surface writes a memory_event row into <roomDir>/.mindrian/room.db
 *     via the Phase 109 navigation chokepoint when conditions are met.
 *   - Mirror failure modes are GRACEFUL (structured envelope, never throws).
 *   - Mirror failure does NOT break the JSONL primary surface.
 *   - Both surfaces are LOCAL per Canon Part 8 (zero LOCAL->BRAIN egress).
 *
 * Implementing plan: .planning/phases/88.2-uiux-selector-block/88.2-03-PLAN.md
 *
 * 8 assertions:
 *   1.  api_export                       -- recordSelectorMirror is exported as a function
 *   2.  invalid_event_type               -- mirror with invalid eventType -> {ok:false, reason:'invalid_event_type'}
 *   3.  db_not_initialized               -- mirror when room.db absent -> {ok:false, reason:'db_not_initialized'}
 *   4.  mirror_writes_memory_event       -- mirror with valid eventType + bootstrapped db -> {ok:true, eventId} AND row exists with event_type=selector_presentation
 *   5.  jsonl_primary_unaffected_on_mirror_fail -- mirror fails (no db) but recordPresentation still appends to its JSONL ledger
 *   6.  no_network_egress                -- selector-telemetry.cjs source contains zero http/https/fetch/Brain refs
 *   7.  four_new_event_types_valid       -- all 4 new EVENT_TYPES strings are valid for mirror
 *   8.  resilience_env_disable           -- MINDRIAN_DISABLE_MEMORY_EVENT=1 -> {ok:false, reason:'mirror_disabled_env'} but JSONL primary still writes
 *
 * Resilience contract (D-AMEND-02): JSONL emit must succeed even when the
 * mirror is unreachable or disabled. The 8th assertion proves this holds
 * under the explicit MINDRIAN_DISABLE_MEMORY_EVENT=1 env-var path.
 *
 * Project sqlite binding: node:sqlite DatabaseSync (per lib/core/lazygraph-ops.cjs).
 *
 * Exit 0 on full pass, non-zero on any failure.
 */

'use strict';

(function main() {
  const fs = require('node:fs');
  const path = require('node:path');
  const os = require('node:os');
  const crypto = require('node:crypto');

  const REPO_ROOT = path.resolve(__dirname, '..');
  const TELEMETRY_PATH = path.join(REPO_ROOT, 'lib', 'hmi', 'selector-telemetry.cjs');
  const MEMORY_EVENTS_PATH = path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'memory-events.cjs');

  const failures = [];
  function pass(name) { process.stdout.write('  ok  ' + name + '\n'); }
  function fail(name, msg) {
    failures.push(name + ': ' + msg);
    process.stdout.write('  FAIL ' + name + ': ' + msg + '\n');
  }

  process.stdout.write('test-selector-telemetry-dual-surface.cjs (Phase 88.2-03 Task 2)\n');

  // Per-test helper: re-require selector-telemetry.cjs after env mutation
  // so the env-var check runs fresh. Stash + restore env vars cleanly.
  function freshTelemetry(envOverrides) {
    const before = {
      MINDRIAN_SELECTOR_TELEMETRY_PATH: process.env.MINDRIAN_SELECTOR_TELEMETRY_PATH,
      MINDRIAN_DISABLE_MEMORY_EVENT: process.env.MINDRIAN_DISABLE_MEMORY_EVENT,
    };
    if (envOverrides) {
      for (const k of Object.keys(envOverrides)) {
        if (envOverrides[k] === null || typeof envOverrides[k] === 'undefined') {
          delete process.env[k];
        } else {
          process.env[k] = envOverrides[k];
        }
      }
    }
    delete require.cache[TELEMETRY_PATH];
    const mod = require(TELEMETRY_PATH);
    return {
      mod: mod,
      restore: () => {
        for (const k of Object.keys(before)) {
          if (typeof before[k] === 'undefined') delete process.env[k];
          else process.env[k] = before[k];
        }
        delete require.cache[TELEMETRY_PATH];
      },
    };
  }

  // Bootstrap a hermetic room dir with a fresh nodes-schema-equipped room.db.
  // Mirrors the bootstrap in tests/test-navigation-memory-events.cjs so that
  // logEvent's INSERT succeeds in this test environment (idempotent migration
  // ships in Plan 109-01 openRoomDb; this test owns its tmp DB).
  function makeRoomWithDb() {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-88-2-03-'));
    fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
    const dbPath = path.join(tmp, '.mindrian', 'room.db');
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    db.exec(
      "CREATE TABLE IF NOT EXISTS nodes (" +
        "id TEXT PRIMARY KEY, " +
        "type TEXT NOT NULL, " +
        "properties TEXT DEFAULT '{}', " +
        "source_path TEXT NOT NULL, " +
        "created_by TEXT NOT NULL CHECK(created_by IN ('user', 'larry', 'import', 'brain', 'system')), " +
        "confidence REAL, " +
        "review_status TEXT NOT NULL DEFAULT 'proposed' CHECK(review_status IN ('proposed', 'confirmed', 'rejected', 'stale', 'superseded', 'needs_evidence', 'validated', 'invalidated')), " +
        "created_at INTEGER NOT NULL, " +
        "last_seen_at INTEGER NOT NULL, " +
        "source_section TEXT, " +
        "confirmed_by TEXT, " +
        "confirmed_at INTEGER" +
      "); " +
      "CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type); " +
      "CREATE INDEX IF NOT EXISTS idx_nodes_review_status ON nodes(review_status); " +
      "CREATE INDEX IF NOT EXISTS idx_nodes_created_at ON nodes(created_at);"
    );
    db.close();
    return { tmp: tmp, dbPath: dbPath };
  }

  function makeEmptyRoom() {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-88-2-03-empty-'));
    fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
    return { tmp: tmp };
  }

  function cleanup(tmp) {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }

  // ---- Assertion 1: api_export ----
  {
    const { mod, restore } = freshTelemetry();
    try {
      if (typeof mod.recordSelectorMirror === 'function') pass('api_export');
      else fail('api_export', 'recordSelectorMirror is ' + typeof mod.recordSelectorMirror);
    } finally { restore(); }
  }

  // ---- Assertion 2: invalid_event_type ----
  {
    const { tmp } = makeEmptyRoom();
    const { mod, restore } = freshTelemetry();
    try {
      const r = mod.recordSelectorMirror(tmp, 'not_a_real_event_type_xyz', { foo: 'bar' });
      if (r && r.ok === false && r.reason === 'invalid_event_type') pass('invalid_event_type');
      else fail('invalid_event_type', 'got ' + JSON.stringify(r));
    } finally { restore(); cleanup(tmp); }
  }

  // ---- Assertion 3: db_not_initialized ----
  // Empty room directory exists, but no .mindrian/room.db file.
  {
    const { tmp } = makeEmptyRoom();
    const { mod, restore } = freshTelemetry();
    try {
      const r = mod.recordSelectorMirror(tmp, 'selector_presentation', { sub_shape: 'F.1', mode: 'A' });
      if (r && r.ok === false && r.reason === 'db_not_initialized') pass('db_not_initialized');
      else fail('db_not_initialized', 'got ' + JSON.stringify(r));
    } finally { restore(); cleanup(tmp); }
  }

  // ---- Assertion 4: mirror_writes_memory_event ----
  // Bootstrap room.db with the post-Plan-109-01 schema; mirror should
  // write a memory_event row that we can read back.
  {
    const { tmp, dbPath } = makeRoomWithDb();
    const { mod, restore } = freshTelemetry();
    try {
      const r = mod.recordSelectorMirror(tmp, 'selector_presentation', {
        sub_shape: 'F.1', mode: 'A', source_path: 'system:test',
      });
      if (!r || r.ok !== true || typeof r.eventId !== 'string' || r.eventId.length === 0) {
        fail('mirror_writes_memory_event', 'mirror did not return ok+eventId; got ' + JSON.stringify(r));
      } else {
        // Read back the row via a fresh DatabaseSync; the closed surface in
        // the helper module is verified separately in Phase 109 tests.
        const { DatabaseSync } = require('node:sqlite');
        const db2 = new DatabaseSync(dbPath);
        try {
          const row = db2.prepare(
            "SELECT id, type, json_extract(properties, '$.event_type') AS event_type " +
            "FROM nodes WHERE type='memory_event' " +
            "AND json_extract(properties, '$.event_type')='selector_presentation' LIMIT 1"
          ).get();
          if (!row) {
            fail('mirror_writes_memory_event', 'no memory_event row found post-mirror');
          } else if (row.event_type !== 'selector_presentation') {
            fail('mirror_writes_memory_event', 'wrong event_type: ' + row.event_type);
          } else {
            pass('mirror_writes_memory_event');
          }
        } finally { db2.close(); }
      }
    } finally { restore(); cleanup(tmp); }
  }

  // ---- Assertion 5: jsonl_primary_unaffected_on_mirror_fail ----
  // Mirror fails (no db). recordPresentation still appends to its JSONL ledger.
  // Use a tmp telemetry path env-var so we don't pollute the real ~/.mindrian.
  {
    const { tmp } = makeEmptyRoom();
    const tmpJsonl = path.join(tmp, 'tmp-selector.jsonl');
    const { mod, restore } = freshTelemetry({
      MINDRIAN_SELECTOR_TELEMETRY_PATH: tmpJsonl,
      MINDRIAN_DISABLE_MEMORY_EVENT: null,
    });
    try {
      // Mirror fails (room has no db).
      const m = mod.recordSelectorMirror(tmp, 'selector_response', { sub_shape: 'F.1' });
      if (m.ok !== false || m.reason !== 'db_not_initialized') {
        fail('jsonl_primary_unaffected_on_mirror_fail',
          'expected mirror failure (db_not_initialized); got ' + JSON.stringify(m));
      } else {
        // JSONL primary STILL succeeds:
        mod.recordPresentation(tmp, {
          sub_shape: 'F.1', mode: 'A', options_count: 5, recommended_present: false,
        });
        if (!fs.existsSync(tmpJsonl)) {
          fail('jsonl_primary_unaffected_on_mirror_fail', 'JSONL primary surface did not write');
        } else {
          const lines = fs.readFileSync(tmpJsonl, 'utf8').split('\n').filter(Boolean);
          if (lines.length < 1) {
            fail('jsonl_primary_unaffected_on_mirror_fail', 'JSONL has no lines');
          } else {
            pass('jsonl_primary_unaffected_on_mirror_fail');
          }
        }
      }
    } finally { restore(); cleanup(tmp); }
  }

  // ---- Assertion 6: no_network_egress ----
  // Structural assertion -- the executable code (excluding comments) of
  // selector-telemetry.cjs has zero http/https/fetch references.
  {
    const src = fs.readFileSync(TELEMETRY_PATH, 'utf8');
    let code = src;
    code = code.replace(/\/\*[\s\S]*?\*\//g, '');
    code = code.replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    const forbidden = [
      /fetch\s*\(/,
      /\bhttps:\/\//,
      /\bhttp:\/\//,
      /brain[-_]client/i,
      /brain\.mindrian\.ai/i,
      /\baxios\b/,
      /require\(\s*['"]request['"]\s*\)/,
    ];
    let bad = null;
    for (const re of forbidden) {
      if (re.test(code)) { bad = re.toString(); break; }
    }
    if (bad) fail('no_network_egress', 'pattern matched in executable code: ' + bad);
    else pass('no_network_egress');
  }

  // ---- Assertion 7: four_new_event_types_valid ----
  // All 4 new EVENT_TYPES strings landed by 88.2-00 must be valid for mirror.
  {
    delete require.cache[MEMORY_EVENTS_PATH];
    const memMod = require(MEMORY_EVENTS_PATH);
    const required = [
      'selector_presentation',
      'selector_response',
      'selector_rejection_captured',
      'f6_round_completed',
    ];
    let ok = true;
    let missing = null;
    for (const t of required) {
      if (!memMod.EVENT_TYPES.has(t)) { ok = false; missing = t; break; }
    }
    if (ok) pass('four_new_event_types_valid');
    else fail('four_new_event_types_valid', 'missing: ' + missing);
  }

  // ---- Assertion 8: resilience_env_disable ----
  // MINDRIAN_DISABLE_MEMORY_EVENT=1 -> mirror returns {ok:false, reason:'mirror_disabled_env'}.
  // JSONL primary still emits.
  {
    const { tmp, dbPath: _dbPath } = makeRoomWithDb();
    const tmpJsonl = path.join(tmp, 'tmp-disable.jsonl');
    const { mod, restore } = freshTelemetry({
      MINDRIAN_DISABLE_MEMORY_EVENT: '1',
      MINDRIAN_SELECTOR_TELEMETRY_PATH: tmpJsonl,
    });
    try {
      const m = mod.recordSelectorMirror(tmp, 'selector_presentation', { sub_shape: 'F.1' });
      if (m.ok !== false || m.reason !== 'mirror_disabled_env') {
        fail('resilience_env_disable',
          'expected {ok:false, reason:mirror_disabled_env}; got ' + JSON.stringify(m));
      } else {
        // JSONL primary still emits:
        mod.recordPresentation(tmp, {
          sub_shape: 'F.1', mode: 'A', options_count: 3, recommended_present: false,
        });
        if (!fs.existsSync(tmpJsonl)) {
          fail('resilience_env_disable', 'JSONL primary did not write under env-disable');
        } else {
          const lines = fs.readFileSync(tmpJsonl, 'utf8').split('\n').filter(Boolean);
          if (lines.length < 1) {
            fail('resilience_env_disable', 'JSONL primary has no lines under env-disable');
          } else {
            pass('resilience_env_disable');
          }
        }
      }
    } finally { restore(); cleanup(tmp); }
  }

  // ---- Summary ----
  if (failures.length > 0) {
    process.stdout.write('\n' + failures.length + ' failure(s):\n');
    for (const f of failures) process.stdout.write('  - ' + f + '\n');
    process.exit(1);
  }
  process.stdout.write('\nDual-surface telemetry OK 8/8\n');
  process.exit(0);
})();
