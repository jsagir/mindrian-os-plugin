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

module.exports = {
  shouldFire,
  recordRun,
  safeAutoFireCheck,
  // helpers exposed for the runner + tests
  roomHash,
  cadenceStateDir,
  lastRunFile,
  DEFAULT_INTERVAL_HOURS,
};
