'use strict';

/**
 * MindrianOS Plugin -- Session Catch-Up (SCHED-01)
 *
 * On MCP server init (Cowork), reads room/.mindrian/last-session.json,
 * computes what changed since the last session:
 *   - Hours since last scout run
 *   - Predictions approaching deadline
 *   - New files added since last session
 *   - Stale sections (no updates in 7+ days)
 *
 * Returns a structured catch-up summary for the first resource notification.
 * Writes last-session.json on SIGTERM / graceful shutdown.
 *
 * @module session-catchup
 */

const fs = require('fs');
const path = require('path');

const STALE_THRESHOLD_DAYS = 7;
const MS_PER_HOUR = 3600000;
const MS_PER_DAY = 86400000;

/**
 * Path to last-session.json inside a room.
 * @param {string} roomDir
 * @returns {string}
 */
function lastSessionPath(roomDir) {
  return path.join(roomDir, '.mindrian', 'last-session.json');
}

/**
 * Read the last session record.
 * @param {string} roomDir
 * @returns {{ timestamp: string, scoutTimestamp: string|null, fileSnapshot: string[], activeMethodology: string|null } | null}
 */
function readLastSession(roomDir) {
  const p = lastSessionPath(roomDir);
  try {
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(raw);
  } catch (_e) {
    return null;
  }
}

/**
 * Write the last session record.
 * @param {string} roomDir
 * @param {object} data
 */
function writeLastSession(roomDir, data) {
  const p = lastSessionPath(roomDir);
  const dir = path.dirname(p);
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
  } catch (e) {
    process.stderr.write(`[session-catchup] Failed to write last-session.json: ${e.message}\n`);
  }
}

/**
 * Recursively collect all .md files in a directory with their mtimes.
 * @param {string} dir
 * @param {string} baseDir - root for relative paths
 * @returns {Array<{relPath: string, mtime: number}>}
 */
function collectFiles(dir, baseDir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...collectFiles(fullPath, baseDir));
      } else if (entry.name.endsWith('.md') && entry.name !== 'STATE.md' && entry.name !== 'ROOM.md') {
        try {
          const stat = fs.statSync(fullPath);
          results.push({
            relPath: path.relative(baseDir, fullPath),
            mtime: stat.mtimeMs,
          });
        } catch (_e) { /* skip */ }
      }
    }
  } catch (_e) { /* skip */ }

  return results;
}

/**
 * Read prediction registry and find approaching deadlines.
 * @param {string} roomDir
 * @returns {Array<{title: string, deadline: string, daysRemaining: number}>}
 */
function getApproachingPredictions(roomDir) {
  const registryPath = path.join(roomDir, '.predictions', 'REGISTRY.json');
  if (!fs.existsSync(registryPath)) return [];

  try {
    const raw = fs.readFileSync(registryPath, 'utf8');
    const registry = JSON.parse(raw);
    const predictions = registry.predictions || registry.entries || [];
    const now = Date.now();
    const approaching = [];

    for (const pred of predictions) {
      if (!pred.deadline && !pred.due_date) continue;
      const deadline = pred.deadline || pred.due_date;
      const deadlineMs = new Date(deadline).getTime();
      if (isNaN(deadlineMs)) continue;

      const daysRemaining = Math.floor((deadlineMs - now) / MS_PER_DAY);
      // Show predictions due within 14 days (including overdue)
      if (daysRemaining <= 14) {
        approaching.push({
          title: pred.title || pred.description || pred.id || 'Untitled prediction',
          deadline,
          daysRemaining,
        });
      }
    }

    // Sort: overdue first, then by soonest
    approaching.sort((a, b) => a.daysRemaining - b.daysRemaining);
    return approaching;
  } catch (_e) {
    return [];
  }
}

/**
 * Detect stale sections (no file updates in 7+ days).
 * @param {string} roomDir
 * @returns {Array<{section: string, daysSinceUpdate: number}>}
 */
function getStaleSections(roomDir) {
  const stale = [];
  const now = Date.now();

  try {
    const entries = fs.readdirSync(roomDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.') || entry.name === 'exports' || entry.name === 'intelligence') continue;

      const sectionDir = path.join(roomDir, entry.name);
      const files = collectFiles(sectionDir, sectionDir);
      if (files.length === 0) continue;

      const latestMtime = Math.max(...files.map(f => f.mtime));
      const daysSince = Math.floor((now - latestMtime) / MS_PER_DAY);

      if (daysSince >= STALE_THRESHOLD_DAYS) {
        stale.push({
          section: entry.name,
          daysSinceUpdate: daysSince,
        });
      }
    }
  } catch (_e) { /* skip */ }

  // Sort by stalest first
  stale.sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate);
  return stale;
}

/**
 * Compute the full catch-up summary for this session.
 *
 * @param {string} roomDir - Absolute path to room directory
 * @returns {{ hasCatchUp: boolean, hoursSinceLastSession: number|null, hoursSinceScout: number|null, newFiles: string[], predictionsApproaching: Array, staleSections: Array, summary: string }}
 */
function computeCatchUp(roomDir) {
  const result = {
    hasCatchUp: false,
    hoursSinceLastSession: null,
    hoursSinceScout: null,
    newFiles: [],
    predictionsApproaching: [],
    staleSections: [],
    summary: '',
  };

  if (!fs.existsSync(roomDir)) {
    result.summary = 'No room directory found.';
    return result;
  }

  const lastSession = readLastSession(roomDir);
  const now = Date.now();

  // Hours since last session
  if (lastSession && lastSession.timestamp) {
    const lastMs = new Date(lastSession.timestamp).getTime();
    if (!isNaN(lastMs)) {
      result.hoursSinceLastSession = Math.round((now - lastMs) / MS_PER_HOUR * 10) / 10;
      result.hasCatchUp = true;
    }
  }

  // Hours since last scout
  if (lastSession && lastSession.scoutTimestamp) {
    const scoutMs = new Date(lastSession.scoutTimestamp).getTime();
    if (!isNaN(scoutMs)) {
      result.hoursSinceScout = Math.round((now - scoutMs) / MS_PER_HOUR * 10) / 10;
    }
  }

  // New files since last session
  if (lastSession && lastSession.fileSnapshot) {
    const previousFiles = new Set(lastSession.fileSnapshot);
    const currentFiles = collectFiles(roomDir, roomDir);
    result.newFiles = currentFiles
      .filter(f => !previousFiles.has(f.relPath))
      .map(f => f.relPath);
  }

  // Approaching predictions
  result.predictionsApproaching = getApproachingPredictions(roomDir);

  // Stale sections
  result.staleSections = getStaleSections(roomDir);

  // Build human-readable summary
  const parts = [];

  if (result.hoursSinceLastSession !== null) {
    parts.push(`Last session was ${result.hoursSinceLastSession} hours ago.`);
  } else {
    parts.push('This is the first session (no previous session data).');
  }

  if (result.hoursSinceScout !== null && result.hoursSinceScout > 24) {
    parts.push(`Scout hasn't run in ${Math.round(result.hoursSinceScout)} hours - consider running /mos:scout.`);
  }

  if (result.newFiles.length > 0) {
    parts.push(`${result.newFiles.length} new file(s) since last session: ${result.newFiles.slice(0, 5).join(', ')}${result.newFiles.length > 5 ? '...' : ''}`);
  }

  const overdue = result.predictionsApproaching.filter(p => p.daysRemaining < 0);
  const urgent = result.predictionsApproaching.filter(p => p.daysRemaining >= 0 && p.daysRemaining <= 3);
  if (overdue.length > 0) {
    parts.push(`${overdue.length} OVERDUE prediction(s): ${overdue.map(p => p.title).join(', ')}`);
  }
  if (urgent.length > 0) {
    parts.push(`${urgent.length} prediction(s) due within 3 days: ${urgent.map(p => p.title).join(', ')}`);
  }

  if (result.staleSections.length > 0) {
    parts.push(`${result.staleSections.length} stale section(s) (7+ days): ${result.staleSections.map(s => `${s.section} (${s.daysSinceUpdate}d)`).join(', ')}`);
  }

  result.summary = parts.join(' ');
  if (result.predictionsApproaching.length > 0 || result.staleSections.length > 0 || result.newFiles.length > 0) {
    result.hasCatchUp = true;
  }

  return result;
}

/**
 * Create a snapshot of the current session state for later comparison.
 * Call this on SIGTERM or session end.
 *
 * @param {string} roomDir
 * @param {object} [extra] - Additional fields to persist (scoutTimestamp, activeMethodology)
 */
function snapshotSession(roomDir, extra = {}) {
  const currentFiles = collectFiles(roomDir, roomDir);
  const data = {
    timestamp: new Date().toISOString(),
    scoutTimestamp: extra.scoutTimestamp || null,
    activeMethodology: extra.activeMethodology || null,
    fileSnapshot: currentFiles.map(f => f.relPath),
    fileCount: currentFiles.length,
  };
  writeLastSession(roomDir, data);
}

/**
 * Register SIGTERM handler to snapshot session on server shutdown.
 * Safe to call multiple times (idempotent) -- the SIGTERM/SIGINT/beforeExit
 * listeners themselves are attached exactly once, ever, per process.
 *
 * Phase 270-08 addition: an optional `extraTeardown` callback (e.g.
 * lib/mcp/tree-watcher.cjs's stopTreeWatcher) can be registered to run
 * alongside the session snapshot on the SAME shutdown event, so a second
 * caller never needs to add its own independent process.on('SIGTERM'/
 * 'SIGINT'/'beforeExit') listener. Each registered call's `roomDir`
 * argument is ignored after the first (this handler is a process-wide
 * singleton, matching its pre-existing idempotent contract); pass a falsy
 * roomDir when the ONLY reason for this call is to register extraTeardown.
 *
 * @param {string} roomDir
 * @param {function} [extraTeardown] - optional additional callback run on
 *   the same shutdown event, after the session snapshot. Never let one
 *   teardown callback's failure block another's.
 */
let _shutdownRegistered = false;
const _extraTeardownCallbacks = [];
function registerShutdownHandler(roomDir, extraTeardown) {
  if (typeof extraTeardown === 'function') _extraTeardownCallbacks.push(extraTeardown);
  if (_shutdownRegistered) return;
  _shutdownRegistered = true;

  // I-4 fix: guard against double-fire when SIGINT triggers followed by beforeExit
  let _shutdownDone = false;
  const handler = () => {
    if (_shutdownDone) return;
    _shutdownDone = true;
    try {
      snapshotSession(roomDir);
      process.stderr.write('[session-catchup] Session state saved on shutdown.\n');
    } catch (e) {
      process.stderr.write(`[session-catchup] Failed to save on shutdown: ${e.message}\n`);
    }
    for (const cb of _extraTeardownCallbacks) {
      try {
        cb();
      } catch (e) {
        process.stderr.write(`[session-catchup] an extra teardown callback failed: ${e && e.message ? e.message : String(e)}\n`);
      }
    }
  };

  process.on('SIGTERM', handler);
  process.on('SIGINT', handler);
  // Also handle graceful exit
  process.on('beforeExit', handler);
}

module.exports = {
  computeCatchUp,
  snapshotSession,
  readLastSession,
  writeLastSession,
  registerShutdownHandler,
  getApproachingPredictions,
  getStaleSections,
};
