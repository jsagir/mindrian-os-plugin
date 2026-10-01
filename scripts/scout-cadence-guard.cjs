#!/usr/bin/env node
'use strict';

/**
 * MindrianOS Plugin -- Scout Cadence Guard (Phase 145, SCHED-01 + SCHED-02)
 *
 * The safe-auto-fire guard for the scheduled scout suite. Two responsibilities:
 *   1. THROTTLE -- a LOCAL last-run timestamp gate (shouldFire / recordRun) that
 *      stops the cadence runner from firing every session. Default interval 24h.
 *   2. SAFE-AUTO-FIRE INVARIANTS -- the Phase-140 hardening checks
 *      (safeAutoFireCheck): no NULL source_path node (HARD-02), no .heal-backup
 *      pollution in the latest result set (HARD-03), and the expectation that the
 *      runner captures (never swallows) the sentinel-health-check exit (HARD-01).
 *
 * CANON PART 8 -- LOCAL-ONLY POSTURE (constitutional):
 *   This file makes ZERO network calls. No fetch, no http, no curl, no Brain, no
 *   tavily. The only identity it derives is a sha256 of the absolute room path,
 *   truncated to 12 hex chars, used purely as a LOCAL filename component so two
 *   rooms on the same machine keep separate last-run timestamps. No room CONTENT
 *   ever enters the path or any timestamp file. The throttle file lives under
 *   $HOME/.mindrian/scout-cadence/ -- it is a runtime artifact, never committed,
 *   never egressed.
 *
 * Part 7 reuse: this guard composes the Phase-140-hardened surfaces. It builds no
 * new sensor. The room.db read for the NULL-source_path check is a read-only open
 * of the existing graph the HSI-to-graph step writes.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const DEFAULT_INTERVAL_HOURS = 24;

// ---------------------------------------------------------------------------
// LOCAL identity + state dir helpers
// ---------------------------------------------------------------------------

/**
 * Derive a LOCAL-only room hash from the absolute room path.
 * sha256 of the resolved absolute path, first 12 hex chars. No room content.
 * @param {string} roomDir
 * @returns {string}
 */
function roomHash(roomDir) {
  const abs = path.resolve(String(roomDir || ''));
  return crypto.createHash('sha256').update(abs).digest('hex').slice(0, 12);
}

/**
 * The LOCAL cadence state directory. $HOME/.mindrian/scout-cadence/.
 * @returns {string}
 */
function cadenceStateDir() {
  return path.join(os.homedir(), '.mindrian', 'scout-cadence');
}

/**
 * The LOCAL last-run timestamp file for a room.
 * @param {string} roomDir
 * @returns {string}
 */
function lastRunFile(roomDir) {
  return path.join(cadenceStateDir(), `last-run-${roomHash(roomDir)}.txt`);
}

// ---------------------------------------------------------------------------
// (1) shouldFire -- the throttle gate
// ---------------------------------------------------------------------------

/**
 * Decide whether the cadence may fire, based on the LOCAL last-run timestamp.
 * Fires when the timestamp file is absent OR the interval has elapsed.
 *
 * @param {string} roomDir - absolute or relative room path (LOCAL identity only)
 * @param {number} [intervalHours=24] - throttle window in hours
 * @returns {{ fire: boolean, nextEligible?: string, lastRun?: string, intervalHours: number }}
 */
function shouldFire(roomDir, intervalHours) {
  const interval = Number.isFinite(Number(intervalHours)) && Number(intervalHours) > 0
    ? Number(intervalHours)
    : DEFAULT_INTERVAL_HOURS;

  const file = lastRunFile(roomDir);
  let lastRunIso = null;
  try {
    if (fs.existsSync(file)) {
      lastRunIso = fs.readFileSync(file, 'utf8').trim();
    }
  } catch (_e) {
    // Unreadable last-run file -- treat as no record, fire (soft-fail open is
    // safe here because recordRun re-arms the throttle immediately after).
    lastRunIso = null;
  }

  if (!lastRunIso) {
    return { fire: true, intervalHours: interval };
  }

  const lastMs = Date.parse(lastRunIso);
  if (Number.isNaN(lastMs)) {
    // Corrupt timestamp -- fire and let recordRun overwrite it cleanly.
    return { fire: true, intervalHours: interval };
  }

  const elapsedMs = Date.now() - lastMs;
  const windowMs = interval * 3600 * 1000;
  if (elapsedMs >= windowMs) {
    return { fire: true, lastRun: lastRunIso, intervalHours: interval };
  }

  const nextEligible = new Date(lastMs + windowMs).toISOString();
  return { fire: false, nextEligible, lastRun: lastRunIso, intervalHours: interval };
}

// ---------------------------------------------------------------------------
// (2) recordRun -- arm the throttle
// ---------------------------------------------------------------------------

/**
 * Record the current ISO timestamp as the room's last cadence run.
 * Soft-fails on any write error -- never throws (a cadence run must not crash
 * its host because the throttle file could not be written).
 *
 * @param {string} roomDir
 * @returns {{ recorded: boolean, file: string, timestamp?: string, error?: string }}
 */
function recordRun(roomDir) {
  const dir = cadenceStateDir();
  const file = lastRunFile(roomDir);
  const timestamp = new Date().toISOString();
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, timestamp + '\n');
    return { recorded: true, file, timestamp };
  } catch (e) {
    return { recorded: false, file, error: e && e.message ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------------------
// (3) safeAutoFireCheck -- the Phase-140 invariant pre/post guard
// ---------------------------------------------------------------------------

/**
 * Read-only scan of the room graph for any node with a NULL source_path.
 * HARD-02: the HSI-to-graph step must never insert a node without provenance.
 * Presence of such a node is a violation. Missing room.db / missing nodes table
 * is NOT a violation (a fresh room has no graph yet).
 *
 * @param {string} roomDir
 * @returns {{ checked: boolean, nullCount: number }}
 */
function scanNullSourcePath(roomDir) {
  const dbPath = path.join(path.resolve(roomDir), '.mindrian', 'room.db');
  if (!fs.existsSync(dbPath)) {
    return { checked: false, nullCount: 0 };
  }
  let db = null;
  try {
    const { DatabaseSync } = require('node:sqlite');
    // Read-only open: this guard never mutates the graph.
    db = new DatabaseSync(dbPath, { readOnly: true });
    // Confirm the nodes table + source_path column exist before querying.
    const cols = db.prepare("PRAGMA table_info('nodes')").all();
    const hasSourcePath = Array.isArray(cols) && cols.some(c => c.name === 'source_path');
    if (!hasSourcePath) {
      return { checked: false, nullCount: 0 };
    }
    const row = db.prepare('SELECT COUNT(*) AS n FROM nodes WHERE source_path IS NULL').get();
    const n = row && typeof row.n === 'number' ? row.n : 0;
    return { checked: true, nullCount: n };
  } catch (_e) {
    // Any read error -> treat as not-checked (do not fabricate a violation).
    return { checked: false, nullCount: 0 };
  } finally {
    try { if (db) db.close(); } catch (_e) { /* ignore */ }
  }
}

/**
 * Scan the latest health + reverse-salient result set for any path under
 * .heal-backup/. HARD-03: the snapshot/health pipeline must exclude backup dirs;
 * a .heal-backup/ path leaking into a result file is backup pollution.
 *
 * @param {string} roomDir
 * @returns {{ checked: boolean, hits: string[] }}
 */
function scanBackupPollution(roomDir) {
  const intelDir = path.join(path.resolve(roomDir), '.intelligence');
  if (!fs.existsSync(intelDir)) {
    return { checked: false, hits: [] };
  }
  const hits = [];
  let files;
  try {
    files = fs.readdirSync(intelDir).filter(f => f.endsWith('.md') || f.endsWith('.json'));
  } catch (_e) {
    return { checked: false, hits: [] };
  }
  for (const f of files) {
    try {
      const content = fs.readFileSync(path.join(intelDir, f), 'utf8');
      if (content.includes('.heal-backup/')) {
        hits.push(f);
      }
    } catch (_e) {
      // Unreadable file -- skip, do not fabricate a hit.
    }
  }
  return { checked: true, hits };
}

/**
 * The Phase-140 safe-auto-fire invariant guard. Returns ok + a violations[]
 * where each entry is a string naming the HARD-NN invariant it maps to.
 *
 * HARD-01 (health-check crash) is enforced by the RUNNER, which captures the
 * sentinel-health-check exit code and passes it here. This function records the
 * expectation and, when given a non-zero health-check exit, surfaces it as a
 * violation. The default (no exit supplied) assumes the runner has not yet run
 * the health step, so HARD-01 is not asserted here.
 *
 * @param {string} roomDir
 * @param {{ healthCheckExit?: number|null }} [opts]
 * @returns {{ ok: boolean, violations: string[], checks: object }}
 */
function safeAutoFireCheck(roomDir, opts) {
  const options = opts || {};
  const violations = [];

  // HARD-01: health-check exit captured by the runner, not swallowed.
  const healthExit = options.healthCheckExit;
  if (healthExit != null && Number(healthExit) !== 0) {
    violations.push(`HARD-01: sentinel-health-check exited non-zero (${healthExit}); a crashed health check must not be hidden`);
  }

  // HARD-02: no NULL source_path node in the room graph.
  const nullScan = scanNullSourcePath(roomDir);
  if (nullScan.checked && nullScan.nullCount > 0) {
    violations.push(`HARD-02: ${nullScan.nullCount} node(s) with NULL source_path present in room.db; HSI-to-graph provenance invariant breached`);
  }

  // HARD-03: no .heal-backup/ pollution in the latest result set.
  const backupScan = scanBackupPollution(roomDir);
  if (backupScan.checked && backupScan.hits.length > 0) {
    violations.push(`HARD-03: .heal-backup/ path leaked into result set (${backupScan.hits.join(', ')}); backup-exclusion invariant breached`);
  }

  return {
    ok: violations.length === 0,
    violations,
    checks: {
      health_check_exit: healthExit != null ? Number(healthExit) : null,
      null_source_path: nullScan,
      backup_pollution: backupScan,
    },
  };
}

// ---------------------------------------------------------------------------
// CLI -- process.argv switch-case (gsd-tools pattern; no commander/yargs)
// ---------------------------------------------------------------------------

function printJson(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
}

function main(argv) {
  const sub = argv[2];
  const a = argv.slice(3);

  switch (sub) {
    case 'should-fire': {
      const roomDir = a[0] || process.cwd();
      const interval = a[1] != null ? Number(a[1]) : DEFAULT_INTERVAL_HOURS;
      const result = shouldFire(roomDir, interval);
      printJson(result);
      // Exit 0 on a clean decision regardless of fire/throttle -- the caller
      // reads .fire, the exit code only signals the command itself ran.
      return 0;
    }
    case 'record-run': {
      const roomDir = a[0] || process.cwd();
      const result = recordRun(roomDir);
      printJson(result);
      return result.recorded ? 0 : 1;
    }
    case 'safe-auto-fire-check': {
      const roomDir = a[0] || process.cwd();
      const healthExit = a[1] != null ? Number(a[1]) : null;
      const result = safeAutoFireCheck(roomDir, { healthCheckExit: healthExit });
      printJson(result);
      return 0;
    }
    default: {
      process.stderr.write(
        'scout-cadence-guard.cjs -- LOCAL-only throttle + Phase-140 safe-auto-fire guard\n\n' +
        'Usage:\n' +
        '  node scout-cadence-guard.cjs should-fire <roomDir> [intervalHours]\n' +
        '  node scout-cadence-guard.cjs record-run <roomDir>\n' +
        '  node scout-cadence-guard.cjs safe-auto-fire-check <roomDir> [healthCheckExit]\n'
      );
      return sub ? 1 : 0;
    }
  }
}

if (require.main === module) {
  process.exit(main(process.argv));
}

// ---------------------------------------------------------------------------
// Phase 355.1 AMB-04: the ambient run ledger (extends this guard; the
// cadence functions above are UNCHANGED -- this section adds, it never
// edits, a line above it).
//
// One per-room ledger answers "have we already run on exactly this
// change?", "is a run in flight?", "did we already run this hour?"; one
// lock keeps two children from running at once; one writer owns the small
// delta-state file SENS-21 (lib/core/sensors/sensor-room-delta.cjs) reads.
//
// CANON PART 8 (same posture as the file's own docblock above): every
// value here is a closed enum, an ISO time, a non-negative integer, or a
// truncated hash -- never room content, never a path, never a slug. Zero
// network: no zod (a schema library, not needed for a plain frozen key
// list), no fetch, no node:sqlite in this section (the file's PRE-EXISTING
// HARD-02 check above legitimately uses node:sqlite for the room-graph
// null-source_path scan; that is unrelated machinery this section never
// touches).
//
// Every function here soft-fails (try/catch, never throws) and every JSON
// write is temp-then-rename (atomicWriteJsonAmbient below, the
// scripts/auto-explore-fire.cjs:146-156 idiom, replicated locally).
//
// House rule: hyphens only, no em-dashes.
// ---------------------------------------------------------------------------

const sensorRoomDelta = require('../lib/core/sensors/sensor-room-delta.cjs');
const directionConvention = require('../lib/core/direction-convention.cjs');

const {
  DELTA_STATE_RELPATH,
  DELTA_STATE_SCHEMA_VERSION,
  DELTA_CLASSES,
  SEAMS,
  RUN_STATES,
  SURFACED_VIA,
} = sensorRoomDelta;
const { FRAMING_IDS } = directionConvention;

// -- Constants (data/floor-ledger.json discloses AMBIENT_MAX_RUNS_PER_HOUR
// as a policy row; approval recorded at the single 355.1 checkpoint) ------

const AMBIENT_LEDGER_RELPATH = path.join('.mindrian', 'ambient-run-ledger.json');
const AMBIENT_LOCK_RELPATH = path.join('.mindrian', 'ambient-run.lock');
const AMBIENT_LEDGER_SCHEMA_VERSION = 1;
const AMBIENT_MAX_RUNS_PER_HOUR = 1;
const AMBIENT_THROTTLE_WINDOW_MS = 60 * 60 * 1000;
// Twice the child's total ambient budget of 4 minutes (plan 355.1-09),
// itself above the measured max fire-child runtime recorded in
// 355.1-BASELINE.md ("Measured Phase 117 child runtime": research's
// recorded max 166s is the conservative figure this budget is derived
// against, not the narrower fresh-sample max the same baseline documents
// as known to undercount the tail).
const AMBIENT_LOCK_STALE_MS = 8 * 60 * 1000;
const STAMPED_MATERIALS_MAX = 32;
const AMBIENT_PRODUCER_IDS = Object.freeze(['eureka', 'find-connections', 'find-bottlenecks', 'hsi', 'whitespace']);
// 366-07 (D-03): 'offered' (appended last) is the ambient eureka producer's
// outcome: the perspective recall handed the planner an offer, nothing filed.
const AMBIENT_PRODUCER_OUTCOMES = Object.freeze(['filed', 'no_candidate', 'below_floor', 'guard_not_cleared', 'error', 'skipped', 'deps_missing', 'offered']);
const AMBIENT_POSTURES = Object.freeze(['run', 'halt']);
const SHOULD_RUN_REASONS = Object.freeze(['ok', 'same_hash', 'in_flight', 'throttled', 'locked', 'ledger_corrupt']);

const AMBIENT_LEDGER_KEYS = Object.freeze([
  'schema_version', 'origin', 'last_run', 'last_delta_hash', 'watermarks',
  'in_flight', 'runs_window', 'producers', 'tier_counts', 'surfaced_via',
  'stamped_materials', 'last_closeout_at',
]);
const AMBIENT_WATERMARK_KEYS = Object.freeze(['claims_created_at', 'artifacts_created_at', 'contradicts_keys', 'stage', 'children']);
const AMBIENT_IN_FLIGHT_KEYS = Object.freeze(['delta_hash', 'started_at', 'seam', 'watermarks']);
const AMBIENT_RUNS_WINDOW_KEYS = Object.freeze(['hour_start', 'count']);
const AMBIENT_TIER_COUNT_KEYS = Object.freeze(['strong', 'indirect', 'unverified']);
const AMBIENT_PRODUCER_RECORD_KEYS = Object.freeze(['outcome', 'posture']);

const DELTA_STATE_KEYS = Object.freeze([
  'schema_version', 'evaluated_at', 'seam', 'classes', 'delta_hash',
  'run_state', 'material_id', 'opportunity_handle', 'surfaced_via', 'framing',
]);

// The materialId format a caller may supply, matching
// lib/core/sensors/sensor-room-delta.cjs's own MATERIAL_ID_RX shape (an
// opaque local handle, never room content).
const AMBIENT_MATERIAL_ID_RX = /^[0-9a-f]{6,64}$/;
const AMBIENT_OPPORTUNITY_HANDLE_RX = /^[A-Za-z0-9:_.-]{1,128}$/;
const AMBIENT_ISO_RX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const AMBIENT_HEX12_RX = /^[0-9a-f]{12}$/;
const AMBIENT_HEX64_RX = /^[0-9a-f]{64}$/;

// -- Small closed-shape validators (never throw) ---------------------------

function ambientIsIso(v) { return typeof v === 'string' && AMBIENT_ISO_RX.test(v); }
function ambientIsNonNegInt(v) { return Number.isInteger(v) && v >= 0; }
function ambientIsHex12(v) { return typeof v === 'string' && AMBIENT_HEX12_RX.test(v); }
function ambientIsHex64(v) { return typeof v === 'string' && AMBIENT_HEX64_RX.test(v); }
function ambientIsHex12Array(v) { return Array.isArray(v) && v.every(ambientIsHex12); }

function ambientHasExactKeys(obj, keys) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const actual = Object.keys(obj);
  if (actual.length !== keys.length) return false;
  return keys.every((k) => actual.indexOf(k) !== -1);
}

function validateAmbientWatermarks(w) {
  if (!ambientHasExactKeys(w, AMBIENT_WATERMARK_KEYS)) return false;
  if (w.claims_created_at !== null && !ambientIsNonNegInt(w.claims_created_at)) return false;
  if (w.artifacts_created_at !== null && !ambientIsNonNegInt(w.artifacts_created_at)) return false;
  if (w.contradicts_keys !== null && !ambientIsHex12Array(w.contradicts_keys)) return false;
  if (w.stage !== null && !ambientIsHex12(w.stage)) return false;
  if (w.children !== null && !ambientIsHex12Array(w.children)) return false;
  return true;
}

function normalizeAmbientWatermarks(candidate, fallback) {
  const c = (candidate && typeof candidate === 'object') ? candidate : {};
  const f = (fallback && typeof fallback === 'object') ? fallback : {};
  const pick = (key) => (Object.prototype.hasOwnProperty.call(c, key) ? c[key] : (Object.prototype.hasOwnProperty.call(f, key) ? f[key] : null));
  return {
    claims_created_at: pick('claims_created_at'),
    artifacts_created_at: pick('artifacts_created_at'),
    contradicts_keys: pick('contradicts_keys'),
    stage: pick('stage'),
    children: pick('children'),
  };
}

/**
 * validateAmbientLedger(obj) -> boolean. Exact top-level key set (12 keys,
 * an extra or missing key is invalid), closed enums, ISO strings,
 * non-negative integers and truncated hashes only. Never throws.
 */
function validateAmbientLedger(obj) {
  try {
    if (!ambientHasExactKeys(obj, AMBIENT_LEDGER_KEYS)) return false;
    if (obj.schema_version !== AMBIENT_LEDGER_SCHEMA_VERSION) return false;
    if (obj.origin !== 'ambient') return false;
    if (obj.last_run !== null && !ambientIsIso(obj.last_run)) return false;
    if (obj.last_delta_hash !== null && !ambientIsHex64(obj.last_delta_hash)) return false;
    if (!validateAmbientWatermarks(obj.watermarks)) return false;

    if (obj.in_flight !== null) {
      if (!ambientHasExactKeys(obj.in_flight, AMBIENT_IN_FLIGHT_KEYS)) return false;
      if (!ambientIsHex64(obj.in_flight.delta_hash)) return false;
      if (!ambientIsIso(obj.in_flight.started_at)) return false;
      if (SEAMS.indexOf(obj.in_flight.seam) === -1) return false;
      if (!validateAmbientWatermarks(obj.in_flight.watermarks)) return false;
    }

    if (!ambientHasExactKeys(obj.runs_window, AMBIENT_RUNS_WINDOW_KEYS)) return false;
    if (obj.runs_window.hour_start !== null && !ambientIsIso(obj.runs_window.hour_start)) return false;
    if (!ambientIsNonNegInt(obj.runs_window.count)) return false;

    if (!obj.producers || typeof obj.producers !== 'object' || Array.isArray(obj.producers)) return false;
    for (const key of Object.keys(obj.producers)) {
      if (AMBIENT_PRODUCER_IDS.indexOf(key) === -1) return false;
      const p = obj.producers[key];
      if (!ambientHasExactKeys(p, AMBIENT_PRODUCER_RECORD_KEYS)) return false;
      if (AMBIENT_PRODUCER_OUTCOMES.indexOf(p.outcome) === -1) return false;
      if (AMBIENT_POSTURES.indexOf(p.posture) === -1) return false;
    }

    if (!ambientHasExactKeys(obj.tier_counts, AMBIENT_TIER_COUNT_KEYS)) return false;
    if (!ambientIsNonNegInt(obj.tier_counts.strong)) return false;
    if (!ambientIsNonNegInt(obj.tier_counts.indirect)) return false;
    if (!ambientIsNonNegInt(obj.tier_counts.unverified)) return false;

    if (obj.surfaced_via !== null && SURFACED_VIA.indexOf(obj.surfaced_via) === -1) return false;

    if (!Array.isArray(obj.stamped_materials) || obj.stamped_materials.length > STAMPED_MATERIALS_MAX) return false;
    if (!obj.stamped_materials.every((m) => typeof m === 'string' && AMBIENT_MATERIAL_ID_RX.test(m))) return false;

    if (obj.last_closeout_at !== null && !ambientIsIso(obj.last_closeout_at)) return false;

    return true;
  } catch (_e) {
    return false;
  }
}

// -- File paths + atomic write ----------------------------------------------

function ambientLedgerPath(roomDir) {
  return path.join(path.resolve(String(roomDir || '')), AMBIENT_LEDGER_RELPATH);
}

function ambientLockPath(roomDir) {
  return path.join(path.resolve(String(roomDir || '')), AMBIENT_LOCK_RELPATH);
}

function ambientDeltaStatePath(roomDir) {
  return path.join(path.resolve(String(roomDir || '')), DELTA_STATE_RELPATH);
}

/**
 * atomicWriteJsonAmbient(filePath, data) -> boolean. temp-then-rename, the
 * scripts/auto-explore-fire.cjs:146-156 idiom, replicated locally (this
 * file has no existing atomic-write helper to reuse). Never throws.
 */
function atomicWriteJsonAmbient(filePath, data) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmpPath = filePath + '.tmp.' + process.pid;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, filePath);
    return true;
  } catch (_e) {
    return false;
  }
}

function freshAmbientLedger() {
  return {
    schema_version: AMBIENT_LEDGER_SCHEMA_VERSION,
    origin: 'ambient',
    last_run: null,
    last_delta_hash: null,
    watermarks: {
      claims_created_at: null,
      artifacts_created_at: null,
      contradicts_keys: null,
      stage: null,
      children: null,
    },
    in_flight: null,
    runs_window: { hour_start: null, count: 0 },
    producers: {},
    tier_counts: { strong: 0, indirect: 0, unverified: 0 },
    surfaced_via: null,
    stamped_materials: [],
    last_closeout_at: null,
  };
}

/**
 * quarantineAmbientLedger(roomDir, nowMs) -> the quarantine path, or null.
 * T-3551-19: a corrupt ledger is renamed aside (never deleted) so the next
 * evaluation starts from a fresh ledger instead of blocking forever.
 */
function quarantineAmbientLedger(roomDir, nowMs) {
  const file = ambientLedgerPath(roomDir);
  try {
    if (fs.existsSync(file)) {
      const dest = file + '.corrupt.' + String(Number.isFinite(nowMs) ? nowMs : Date.now());
      fs.renameSync(file, dest);
      return dest;
    }
  } catch (_e) { /* best effort */ }
  return null;
}

/**
 * readAmbientLedger(roomDir) -> { ledger, corrupt }. No file on disk -> a
 * fresh ledger, not corrupt. Unparseable JSON or a shape
 * validateAmbientLedger rejects -> { ledger: null, corrupt: true } (the
 * caller quarantines; this function never mutates the filesystem itself).
 */
function readAmbientLedger(roomDir) {
  const file = ambientLedgerPath(roomDir);
  if (!fs.existsSync(file)) {
    return { ledger: freshAmbientLedger(), corrupt: false };
  }
  let parsed = null;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_e) {
    return { ledger: null, corrupt: true };
  }
  if (!validateAmbientLedger(parsed)) {
    return { ledger: null, corrupt: true };
  }
  return { ledger: parsed, corrupt: false };
}

// -- shouldRunAmbient: the ladder ------------------------------------------

/**
 * shouldRunAmbient(roomDir, deltaHash, opts) -> { run, reason }. reason is
 * a SHOULD_RUN_REASONS member. opts.now is an epoch-ms Number (defaults to
 * Date.now()). The ladder, in order: corrupt (quarantine, then run) ->
 * same_hash -> a fresh in_flight claim -> throttled -> a fresh lock file ->
 * ok. Never throws.
 */
function shouldRunAmbient(roomDir, deltaHash, opts) {
  try {
    const o = (opts && typeof opts === 'object') ? opts : {};
    const nowMs = Number.isFinite(o.now) ? o.now : Date.now();

    const read = readAmbientLedger(roomDir);
    if (read.corrupt) {
      quarantineAmbientLedger(roomDir, nowMs);
      return { run: false, reason: 'ledger_corrupt' };
    }
    const ledger = read.ledger;

    if (typeof deltaHash === 'string' && deltaHash.length > 0 && ledger.last_delta_hash === deltaHash) {
      return { run: false, reason: 'same_hash' };
    }

    if (ledger.in_flight && typeof ledger.in_flight === 'object') {
      const startedMs = Date.parse(ledger.in_flight.started_at);
      const age = nowMs - startedMs;
      if (Number.isFinite(startedMs) && age >= 0 && age < AMBIENT_LOCK_STALE_MS) {
        return { run: false, reason: 'in_flight' };
      }
      // Stale in-flight: falls through -- it never blocks, and this
      // read-only function never clears it (the next claimAmbientRun call
      // overwrites it).
    }

    const rw = (ledger.runs_window && typeof ledger.runs_window === 'object') ? ledger.runs_window : { hour_start: null, count: 0 };
    if (rw.hour_start) {
      const hourStartMs = Date.parse(rw.hour_start);
      const withinWindow = Number.isFinite(hourStartMs) && (nowMs - hourStartMs) < AMBIENT_THROTTLE_WINDOW_MS;
      if (withinWindow && rw.count >= AMBIENT_MAX_RUNS_PER_HOUR) {
        return { run: false, reason: 'throttled' };
      }
    }

    const lockPath = ambientLockPath(roomDir);
    if (fs.existsSync(lockPath)) {
      let lockFresh = false;
      try {
        const st = fs.statSync(lockPath);
        lockFresh = (nowMs - st.mtimeMs) <= AMBIENT_LOCK_STALE_MS;
      } catch (_e) {
        lockFresh = false;
      }
      if (lockFresh) {
        return { run: false, reason: 'locked' };
      }
    }

    return { run: true, reason: 'ok' };
  } catch (_e) {
    return { run: false, reason: 'ledger_corrupt' };
  }
}

// -- claim / release / record -----------------------------------------------

// CR-01 fix (355.1 review): claimAmbientRun used to be a plain
// read-modify-write (readAmbientLedger -> mutate in_flight in memory ->
// atomicWriteJsonAmbient). atomicWriteJsonAmbient's temp-then-rename only
// makes the WRITE atomic; it does nothing to stop two processes both
// reading in_flight:null before either has written, both concluding
// claimed:true, and both spawning a child. The fix makes the claim's
// read-mutate-write window itself mutually exclusive: an exclusive-create
// ('wx') sentinel file, the same idiom acquireAmbientLock already uses two
// hundred lines below, guarded by its own AMBIENT_CLAIM_LOCK_RELPATH (kept
// separate from AMBIENT_LOCK_RELPATH -- the composition lock guards a
// multi-minute child run; this one guards a sub-millisecond ledger CAS, and
// conflating them would make a legitimate claim block on an unrelated
// in-progress composition). A second concurrent caller that cannot acquire
// this mutex gets claimed:false immediately, without ever reading or
// mutating the ledger.

const AMBIENT_CLAIM_LOCK_RELPATH = path.join('.mindrian', 'ambient-claim.lock');

function ambientClaimLockPath(roomDir) {
  return path.join(path.resolve(String(roomDir || '')), AMBIENT_CLAIM_LOCK_RELPATH);
}

/**
 * acquireAmbientClaimLock(roomDir, nowMs) -> boolean. A short-lived
 * exclusive-create mutex (the acquireAmbientLock 'wx' idiom) around
 * claimAmbientRun's ledger read-modify-write, so only one process at a time
 * can be inside that window. Reclaims a stale lock (a crash mid-claim that
 * never released) after AMBIENT_LOCK_STALE_MS -- the same self-healing
 * window the composition lock uses, even though this mutex is normally held
 * for microseconds. Never throws.
 */
function acquireAmbientClaimLock(roomDir, nowMs) {
  const lockPath = ambientClaimLockPath(roomDir);
  try { fs.mkdirSync(path.dirname(lockPath), { recursive: true }); } catch (_e) { /* best effort */ }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const fd = fs.openSync(lockPath, 'wx');
      try { fs.writeSync(fd, String(process.pid)); } catch (_we) { /* advisory */ }
      fs.closeSync(fd);
      return true;
    } catch (_e) {
      try {
        const st = fs.statSync(lockPath);
        if ((nowMs - st.mtimeMs) > AMBIENT_LOCK_STALE_MS) {
          fs.rmSync(lockPath, { force: true });
          continue;
        }
        return false;
      } catch (_se) {
        // The holder released between our open() and stat(): retry once.
        continue;
      }
    }
  }
  return false;
}

/**
 * releaseAmbientClaimLock(roomDir) -> void. Never throws.
 */
function releaseAmbientClaimLock(roomDir) {
  try { fs.rmSync(ambientClaimLockPath(roomDir), { force: true }); } catch (_e) { /* best effort */ }
}

/**
 * claimAmbientRun(roomDir, { deltaHash, watermarks, seam, now }) -> {
 * claimed, ledger }. Sets in_flight and advances runs_window (restarting
 * the hour window when the prior one elapsed). The whole read-modify-write
 * runs under acquireAmbientClaimLock (CR-01): a second concurrent caller
 * that cannot take the mutex, or that takes it but finds a fresh (non-stale)
 * in_flight already set by the winner, returns claimed:false without
 * writing anything. Never throws.
 */
function claimAmbientRun(roomDir, opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  const nowMs = Number.isFinite(o.now) ? o.now : Date.now();
  if (!acquireAmbientClaimLock(roomDir, nowMs)) {
    return { claimed: false };
  }
  try {
    const nowIso = new Date(nowMs).toISOString();

    const read = readAmbientLedger(roomDir);
    const ledger = read.corrupt ? freshAmbientLedger() : read.ledger;

    // Re-check under the mutex: if another process already won the claim
    // (a fresh, non-stale in_flight) between our caller's shouldRunAmbient
    // check and this write, refuse rather than overwrite it.
    if (ledger.in_flight && typeof ledger.in_flight === 'object') {
      const startedMs = Date.parse(ledger.in_flight.started_at);
      const age = nowMs - startedMs;
      if (Number.isFinite(startedMs) && age >= 0 && age < AMBIENT_LOCK_STALE_MS) {
        return { claimed: false };
      }
    }

    ledger.in_flight = {
      delta_hash: (typeof o.deltaHash === 'string') ? o.deltaHash : '',
      started_at: nowIso,
      seam: (SEAMS.indexOf(o.seam) !== -1) ? o.seam : SEAMS[0],
      watermarks: normalizeAmbientWatermarks(o.watermarks, {}),
    };

    const rw = (ledger.runs_window && typeof ledger.runs_window === 'object') ? ledger.runs_window : { hour_start: null, count: 0 };
    const hourStartMs = rw.hour_start ? Date.parse(rw.hour_start) : NaN;
    const withinWindow = Number.isFinite(hourStartMs) && (nowMs - hourStartMs) < AMBIENT_THROTTLE_WINDOW_MS;
    ledger.runs_window = withinWindow
      ? { hour_start: rw.hour_start, count: rw.count + 1 }
      : { hour_start: nowIso, count: 1 };

    const wrote = atomicWriteJsonAmbient(ambientLedgerPath(roomDir), ledger);
    return { claimed: !!wrote, ledger: ledger };
  } catch (_e) {
    return { claimed: false };
  } finally {
    releaseAmbientClaimLock(roomDir);
  }
}

/**
 * releaseAmbientClaim(roomDir, deltaHash) -> { released }. Clears in_flight
 * ONLY when in_flight.delta_hash === deltaHash (a different hash leaves it
 * alone). Never throws.
 */
function releaseAmbientClaim(roomDir, deltaHash) {
  try {
    const read = readAmbientLedger(roomDir);
    if (read.corrupt) return { released: false };
    const ledger = read.ledger;
    if (ledger.in_flight && ledger.in_flight.delta_hash === deltaHash) {
      ledger.in_flight = null;
      const wrote = atomicWriteJsonAmbient(ambientLedgerPath(roomDir), ledger);
      return { released: !!wrote };
    }
    return { released: false };
  } catch (_e) {
    return { released: false };
  }
}

/**
 * recordAmbientRun(roomDir, { deltaHash, producers, tierCounts,
 * surfacedVia, materialId, now }) -> { recorded, ledger }. Sets last_run,
 * last_delta_hash, watermarks (from the claimed in_flight.watermarks),
 * producers, tier_counts, surfaced_via; appends materialId to
 * stamped_materials only when surfacedVia is 'sens13' (bounded to
 * STAMPED_MATERIALS_MAX, oldest dropped); clears in_flight. Never throws.
 */
function recordAmbientRun(roomDir, opts) {
  try {
    const o = (opts && typeof opts === 'object') ? opts : {};
    const nowMs = Number.isFinite(o.now) ? o.now : Date.now();
    const nowIso = new Date(nowMs).toISOString();

    const read = readAmbientLedger(roomDir);
    const ledger = read.corrupt ? freshAmbientLedger() : read.ledger;

    const inFlightWatermarks = (ledger.in_flight && typeof ledger.in_flight === 'object' && ledger.in_flight.watermarks && typeof ledger.in_flight.watermarks === 'object')
      ? ledger.in_flight.watermarks
      : null;

    ledger.origin = 'ambient';
    ledger.last_run = nowIso;
    ledger.last_delta_hash = (typeof o.deltaHash === 'string') ? o.deltaHash : ledger.last_delta_hash;
    if (inFlightWatermarks) {
      ledger.watermarks = normalizeAmbientWatermarks(inFlightWatermarks, ledger.watermarks);
    }
    ledger.producers = (o.producers && typeof o.producers === 'object' && !Array.isArray(o.producers)) ? o.producers : ledger.producers;
    ledger.tier_counts = (o.tierCounts && typeof o.tierCounts === 'object') ? {
      strong: ambientIsNonNegInt(o.tierCounts.strong) ? o.tierCounts.strong : 0,
      indirect: ambientIsNonNegInt(o.tierCounts.indirect) ? o.tierCounts.indirect : 0,
      unverified: ambientIsNonNegInt(o.tierCounts.unverified) ? o.tierCounts.unverified : 0,
    } : ledger.tier_counts;
    ledger.surfaced_via = (SURFACED_VIA.indexOf(o.surfacedVia) !== -1) ? o.surfacedVia : null;

    if (ledger.surfaced_via === 'sens13' && typeof o.materialId === 'string' && AMBIENT_MATERIAL_ID_RX.test(o.materialId)) {
      const list = Array.isArray(ledger.stamped_materials) ? ledger.stamped_materials.slice() : [];
      list.push(o.materialId);
      while (list.length > STAMPED_MATERIALS_MAX) list.shift();
      ledger.stamped_materials = list;
    }

    ledger.in_flight = null;

    const wrote = atomicWriteJsonAmbient(ambientLedgerPath(roomDir), ledger);
    return { recorded: !!wrote, ledger: ledger };
  } catch (_e) {
    return { recorded: false };
  }
}

/**
 * recordAmbientBaseline(roomDir, { watermarks }) -> { ok, ledger }. Fills
 * ONLY watermark fields that are still null (contradicts_keys, stage,
 * children) so classes b, c and d have a baseline even in a room that has
 * not run yet; NEVER touches claims_created_at, artifacts_created_at,
 * last_delta_hash, last_run or runs_window. A second call with different
 * values changes nothing already set. Never throws.
 */
function recordAmbientBaseline(roomDir, opts) {
  try {
    const o = (opts && typeof opts === 'object') ? opts : {};
    const wm = (o.watermarks && typeof o.watermarks === 'object') ? o.watermarks : {};

    const read = readAmbientLedger(roomDir);
    const ledger = read.corrupt ? freshAmbientLedger() : read.ledger;

    const next = Object.assign({}, ledger.watermarks);
    if (next.contradicts_keys === null && Object.prototype.hasOwnProperty.call(wm, 'contradicts_keys')) {
      next.contradicts_keys = wm.contradicts_keys;
    }
    if (next.stage === null && Object.prototype.hasOwnProperty.call(wm, 'stage')) {
      next.stage = wm.stage;
    }
    if (next.children === null && Object.prototype.hasOwnProperty.call(wm, 'children')) {
      next.children = wm.children;
    }
    ledger.watermarks = next;

    const wrote = atomicWriteJsonAmbient(ambientLedgerPath(roomDir), ledger);
    return { ok: !!wrote, ledger: ledger };
  } catch (_e) {
    return { ok: false };
  }
}

/**
 * recordAmbientCloseout(roomDir, { now }) -> { ok, ledger }. Sets
 * last_closeout_at (Ruling 2: when the Stop-time close-out last ran for
 * this room, written by plan 355.1-13); changes nothing else. Never
 * throws.
 */
function recordAmbientCloseout(roomDir, opts) {
  try {
    const o = (opts && typeof opts === 'object') ? opts : {};
    const nowMs = Number.isFinite(o.now) ? o.now : Date.now();
    const nowIso = new Date(nowMs).toISOString();

    const read = readAmbientLedger(roomDir);
    const ledger = read.corrupt ? freshAmbientLedger() : read.ledger;
    ledger.last_closeout_at = nowIso;

    const wrote = atomicWriteJsonAmbient(ambientLedgerPath(roomDir), ledger);
    return { ok: !!wrote, ledger: ledger };
  } catch (_e) {
    return { ok: false };
  }
}

// -- Lock (the scripts/gsd-graph-derive-drain.cjs:243-289 idiom) -----------

/**
 * acquireAmbientLock(roomDir, opts) -> { ok, path?, reclaimed?, reason?,
 * token? }. opts.now is an epoch-ms Number. fs.openSync 'wx' (the repo's
 * existing write-lock idiom); a lock older than AMBIENT_LOCK_STALE_MS is
 * reclaimed (ok true, reclaimed true) and retried once. Never throws.
 *
 * CR-03 fix (355.1 review): the lock file used to carry only
 * process.pid, and nothing ever read it back -- neither the stale-reclaim
 * check (mtime-only) nor releaseAmbientLock (an unconditional rmSync of
 * whatever file currently sits at the path). That let a slow holder's own
 * `finally`-block release silently delete a DIFFERENT, later owner's live
 * lock after a stale-reclaim had already taken over the path (see the
 * review's Child A/Child B walkthrough). The lock file now carries a random
 * per-acquire token (pid + nonce; the pid alone is meaningless across a
 * reclaim boundary and was never validated), returned to the caller as
 * `token`. Every acquire (including a stale reclaim) writes a fresh token.
 */
function acquireAmbientLock(roomDir, opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  const nowMs = Number.isFinite(o.now) ? o.now : Date.now();
  const lockPath = ambientLockPath(roomDir);
  try { fs.mkdirSync(path.dirname(lockPath), { recursive: true }); } catch (_e) { /* best effort */ }

  let reclaimed = false;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const fd = fs.openSync(lockPath, 'wx');
      const token = String(process.pid) + ':' + crypto.randomBytes(8).toString('hex');
      try { fs.writeSync(fd, token); } catch (_we) { /* advisory */ }
      fs.closeSync(fd);
      return { ok: true, path: lockPath, reclaimed: reclaimed, token: token };
    } catch (_e) {
      try {
        const st = fs.statSync(lockPath);
        if ((nowMs - st.mtimeMs) > AMBIENT_LOCK_STALE_MS) {
          fs.rmSync(lockPath, { force: true });
          reclaimed = true;
          continue;
        }
        return { ok: false, reason: 'held' };
      } catch (_se) {
        // The holder released between our open() and stat(): retry once.
        continue;
      }
    }
  }
  return { ok: false, reason: 'held' };
}

/**
 * releaseAmbientLock(roomDir, token) -> { ok, reason? }. CR-03 fix: when a
 * token is supplied, this is now a compare-and-delete -- the lock is
 * removed ONLY when the file on disk still holds that exact token; a
 * mismatch (someone else's stale-reclaim already replaced it) returns
 * { ok: false, reason: 'token_mismatch' } and leaves the file untouched, so
 * a slow holder's own cleanup can never evict a different, later owner's
 * live lock. A missing file is treated as already released (ok: true). A
 * caller with no token (legacy / a test's own direct cleanup) keeps the
 * prior unconditional-delete behavior; every production caller in this
 * repo now passes the token acquireAmbientLock returned. Never throws.
 */
function releaseAmbientLock(roomDir, token) {
  const lockPath = ambientLockPath(roomDir);
  try {
    if (!fs.existsSync(lockPath)) return { ok: true };
    if (typeof token === 'string' && token.length > 0) {
      let onDisk = null;
      try { onDisk = fs.readFileSync(lockPath, 'utf8'); } catch (_re) { onDisk = null; }
      if (onDisk !== token) {
        return { ok: false, reason: 'token_mismatch' };
      }
    }
    fs.rmSync(lockPath, { force: true });
    return { ok: true };
  } catch (_e) {
    return { ok: false };
  }
}

// -- Delta-state writer (the SENS-21 side channel; one writer) -------------

/**
 * validateDeltaState(obj) -> { ok, reason? }. Exact key set (10 keys),
 * closed enums against SEAMS / DELTA_CLASSES / RUN_STATES / SURFACED_VIA /
 * FRAMING_IDS (framing checked against direction-convention.cjs's
 * FRAMING_IDS, seams/run-states/classes against the sensor module's own
 * enums), sorted classes, a 64-hex delta_hash, an 8-64 lowercase-hex
 * material_id or null, an opportunity_handle matching
 * /^[A-Za-z0-9:_.-]{1,128}$/ or null. Never throws.
 */
function validateDeltaState(obj) {
  try {
    if (!ambientHasExactKeys(obj, DELTA_STATE_KEYS)) return { ok: false, reason: 'key_set' };
    if (obj.schema_version !== DELTA_STATE_SCHEMA_VERSION) return { ok: false, reason: 'schema_version' };
    if (!ambientIsIso(obj.evaluated_at)) return { ok: false, reason: 'evaluated_at' };
    if (SEAMS.indexOf(obj.seam) === -1) return { ok: false, reason: 'seam' };
    if (!Array.isArray(obj.classes) || obj.classes.length === 0 || obj.classes.some((c) => DELTA_CLASSES.indexOf(c) === -1)) {
      return { ok: false, reason: 'classes' };
    }
    const sortedClasses = obj.classes.slice().sort();
    if (JSON.stringify(sortedClasses) !== JSON.stringify(obj.classes)) return { ok: false, reason: 'classes_unsorted' };
    if (!ambientIsHex64(obj.delta_hash)) return { ok: false, reason: 'delta_hash' };
    if (RUN_STATES.indexOf(obj.run_state) === -1) return { ok: false, reason: 'run_state' };
    if (obj.material_id !== null && !AMBIENT_MATERIAL_ID_RX.test(String(obj.material_id))) return { ok: false, reason: 'material_id' };
    if (obj.opportunity_handle !== null && !AMBIENT_OPPORTUNITY_HANDLE_RX.test(String(obj.opportunity_handle))) return { ok: false, reason: 'opportunity_handle' };
    if (obj.surfaced_via !== null && SURFACED_VIA.indexOf(obj.surfaced_via) === -1) return { ok: false, reason: 'surfaced_via' };
    if (obj.framing !== null && FRAMING_IDS.indexOf(obj.framing) === -1) return { ok: false, reason: 'framing' };
    return { ok: true };
  } catch (_e) {
    return { ok: false, reason: 'exception' };
  }
}

/**
 * writeRoomDeltaState(roomDir, state) -> { ok, reason? }. Validates the
 * full closed schema, THEN an atomic temp-then-rename write; an invalid
 * state writes nothing (no partial file, no .tmp leftover). Never throws.
 */
function writeRoomDeltaState(roomDir, state) {
  const v = validateDeltaState(state);
  if (!v.ok) return { ok: false, reason: v.reason };
  const wrote = atomicWriteJsonAmbient(ambientDeltaStatePath(roomDir), state);
  return wrote ? { ok: true } : { ok: false, reason: 'write_failed' };
}

/**
 * readRoomDeltaState(roomDir) -> the parsed state, or null. Never throws.
 */
function readRoomDeltaState(roomDir) {
  try {
    const file = ambientDeltaStatePath(roomDir);
    if (!fs.existsSync(file)) return null;
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : null;
  } catch (_e) {
    return null;
  }
}

module.exports = {
  shouldFire,
  recordRun,
  safeAutoFireCheck,
  // helpers exposed for the runner + tests
  roomHash,
  cadenceStateDir,
  lastRunFile,
  DEFAULT_INTERVAL_HOURS,
  // Phase 355.1 AMB-04: the ambient run ledger, lock and delta-state writer
  readAmbientLedger,
  validateAmbientLedger,
  shouldRunAmbient,
  claimAmbientRun,
  releaseAmbientClaim,
  recordAmbientRun,
  recordAmbientBaseline,
  recordAmbientCloseout,
  acquireAmbientLock,
  releaseAmbientLock,
  acquireAmbientClaimLock,
  releaseAmbientClaimLock,
  validateDeltaState,
  writeRoomDeltaState,
  readRoomDeltaState,
  AMBIENT_LEDGER_RELPATH,
  AMBIENT_LOCK_RELPATH,
  AMBIENT_CLAIM_LOCK_RELPATH,
  AMBIENT_LEDGER_SCHEMA_VERSION,
  AMBIENT_MAX_RUNS_PER_HOUR,
  AMBIENT_THROTTLE_WINDOW_MS,
  AMBIENT_LOCK_STALE_MS,
  STAMPED_MATERIALS_MAX,
  AMBIENT_PRODUCER_IDS,
  AMBIENT_PRODUCER_OUTCOMES,
  AMBIENT_POSTURES,
  SHOULD_RUN_REASONS,
};
