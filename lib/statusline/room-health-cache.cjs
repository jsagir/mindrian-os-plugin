// lib/statusline/room-health-cache.cjs -- Quick task 20260702-statusline-live-signals
//
// The WRITE side of the room-health signal. It closes the Phase 192-04 NAMED DEBT:
// cockpit-signals.readHealthStatus() already READS ~/.mindrian/room-health.json
// {status:'sound'|'drift'|'broken'}, but nothing WROTE it, so health was always
// absent -> static green. This module persists the status the shipped reader
// expects, fed from the LOCAL bind-time room-health job.
//
// RCA statusline-room-health-chip-never-updates (2026-07-31): shipping the write
// function was not enough. Its ONLY caller was the manual `doctor --bind-check`
// CLI flag, which nothing in the shipped product ever invoked, so the chip froze
// at whatever a past manual shell run wrote. runBindHealthCheck (below) is that
// flag's composition extracted for LIVE, in-process callers - the room_bind MCP
// tool (the D-03 binding front door) and the F.8 session-binding consumer.
//
// Mirrors the reader in cockpit-signals exactly (same HOME/.mindrian path) so the
// already-wired read lights up the instant this write lands. Every fs op is
// try/caught; any failure degrades silently (never throws) and the reader simply
// keeps returning the byte-stable default (sound).
//
// Canon Part 8 (Graph Boundary): LOCAL only. Zero network, zero Brain. The status
// is a generic health enum, never user-room content.
//
// House rule: hyphens only, no em-dashes.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function homeDir() {
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

function mindrianDir() {
  return path.join(homeDir(), '.mindrian');
}

function cachePath() {
  return path.join(mindrianDir(), 'room-health.json');
}

const VALID = Object.freeze(['sound', 'drift', 'broken']);

/**
 * Map a doctor --bind-check report to the room-health status enum the reader
 * expects. The bind-check produces { healthy:boolean, findings:string[], ... }.
 *   - a hard error (missing/exception -> the 'bind-check-error' finding) -> 'broken'
 *   - healthy === true                                                    -> 'sound'
 *   - healthy === false (advisory findings)                               -> 'drift'
 * Defensive: an absent / malformed report degrades to 'broken' (a report we cannot
 * read is not a healthy room).
 * @param {Object|null} report
 * @returns {'sound'|'drift'|'broken'}
 */
function statusFromBindReport(report) {
  if (!report || typeof report !== 'object') return 'broken';
  const findings = Array.isArray(report.findings) ? report.findings : [];
  if (findings.indexOf('bind-check-error') !== -1) return 'broken';
  if (report.healthy === true) return 'sound';
  return 'drift';
}

/**
 * Persist the room-health status the shipped cockpit-signals reader consumes.
 * Defensive + atomic (tmp + rename): never throws; returns true on a successful
 * write, false on any failure or an invalid status.
 * @param {'sound'|'drift'|'broken'} status
 * @param {string} [homeOverride] - explicit HOME (defaults to process HOME).
 * @returns {boolean}
 */
function persistRoomHealth(status, homeOverride) {
  try {
    if (VALID.indexOf(status) === -1) return false;
    const base = (typeof homeOverride === 'string' && homeOverride)
      ? path.join(homeOverride, '.mindrian')
      : mindrianDir();
    try { fs.mkdirSync(base, { recursive: true }); } catch (_e) { /* exists */ }
    const p = path.join(base, 'room-health.json');
    const record = { status: status, at: new Date().toISOString() };
    const tmp = p + '.tmp-' + process.pid;
    fs.writeFileSync(tmp, JSON.stringify(record), 'utf8');
    fs.renameSync(tmp, p);
    return true;
  } catch (_e) {
    return false;
  }
}

/**
 * The rooms home (where the session-binding store and the room directories live).
 * Mirrors lib/core/session-binding.cjs's resolveHome exactly, so this health job
 * never resolves a DIFFERENT home than the bind it is checking. Note this is the
 * ROOMS home, not the OS home that carries .mindrian/room-health.json.
 * @param {string} [home]
 * @returns {string}
 */
function roomsHome(home) {
  if (typeof home === 'string' && home.length > 0) return home;
  const env = process.env.MINDRIAN_ROOMS_HOME || process.env.MINDRIAN_ROOMS_ROOT;
  if (typeof env === 'string' && env.length > 0) return env;
  return path.join(os.homedir(), 'MindrianRooms');
}

/**
 * runBindHealthCheck -- the ONE in-process bind-time room-health job.
 *
 * RCA statusline-room-health-chip-never-updates: persistRoomHealth had exactly one
 * caller in the tree (the manual `--bind-check <roomDir>` CLI flag), which nothing
 * in the shipped product ever invoked, so the statusline health chip froze at
 * whatever a past manual shell run wrote. This function is the composition that
 * flag performs, extracted so LIVE callers (the room_bind MCP tool, the F.8
 * session-binding consumer) can run it IN-PROCESS. No child process is spawned:
 * an MCP tool handler must never shell out for a synchronous tool call.
 *
 * Composes the shipped pieces, re-implementing none of them:
 *   lib/core/resolve-active-room.registryRoomPath  (the ONE slug -> dir derivation)
 *   lib/core/session-presence.runBindCheck         (the LOCAL scope + structural check)
 *   statusFromBindReport + persistRoomHealth       (the unchanged write contract)
 *
 * NEVER throws and never blocks: a health reading is advisory, the bind that
 * triggered it is the load-bearing operation. Returns the persisted status, or
 * null when the check could not run at all (nothing is written in that case, so a
 * missing dependency degrades to the previous reading rather than a fabricated one).
 *
 * Canon Part 8 (Graph Boundary): LOCAL only. Filesystem reads plus a read-only
 * room.db open. Zero network, zero Brain.
 *
 * @param {Object} opts
 * @param {string} [opts.sessionId]    - the session whose binding is being checked
 * @param {string} [opts.room]         - the bound room slug (the topRoom for on-scope)
 * @param {string} [opts.roomDir]      - an explicit room directory (wins over the slug derivation)
 * @param {string} [opts.home]         - the rooms home (test seam / explicit override)
 * @param {string} [opts.homeOverride] - the OS home for the cache write (test seam)
 * @returns {'sound'|'drift'|'broken'|null}
 */
function runBindHealthCheck(opts) {
  try {
    const o = (opts && typeof opts === 'object') ? opts : {};
    const slug = (typeof o.room === 'string' && o.room.length > 0) ? o.room : null;
    const home = roomsHome(o.home);

    // Resolve the room DIRECTORY so the structural half of the check can run. An
    // explicit roomDir wins (the cwd auto-bind path already holds one). Otherwise
    // derive it from the slug through registryRoomPath, which handles nested
    // sub-room paths correctly. When that derivation misses, fall back to the flat
    // <home>/<slug>: the structural check then reports an honest room-dir-missing
    // finding instead of skipping the check and fabricating a green reading.
    let roomDir = (typeof o.roomDir === 'string' && o.roomDir.length > 0) ? o.roomDir : null;
    if (!roomDir && slug) {
      try {
        const rar = require('../core/resolve-active-room.cjs');
        roomDir = (typeof rar.registryRoomPath === 'function')
          ? rar.registryRoomPath(home, slug)
          : null;
      } catch (_e) {
        roomDir = null;
      }
      if (!roomDir) roomDir = path.join(home, slug);
    }
    if (!roomDir) return null;

    let presence = null;
    try {
      presence = require('../core/session-presence.cjs');
    } catch (_e) {
      presence = null;
    }
    if (!presence || typeof presence.runBindCheck !== 'function') return null;

    let report;
    try {
      report = presence.runBindCheck({
        sessionId: o.sessionId,
        roomDir: roomDir,
        topRoom: slug || undefined,
        home: home,
      });
    } catch (_e) {
      report = { healthy: false, bound: [], primary: null, onScope: false, findings: ['bind-check-error'] };
    }

    const status = statusFromBindReport(report);
    persistRoomHealth(status, o.homeOverride);
    return status;
  } catch (_e) {
    return null;
  }
}

module.exports = {
  statusFromBindReport,
  persistRoomHealth,
  runBindHealthCheck,
  cachePath,
  mindrianDir,
  roomsHome,
  VALID,
};
