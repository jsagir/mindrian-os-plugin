// lib/statusline/room-health-cache.cjs -- Quick task 20260702-statusline-live-signals
//
// The WRITE side of the room-health signal. It closes the Phase 192-04 NAMED DEBT:
// cockpit-signals.readHealthStatus() already READS ~/.mindrian/room-health.json
// {status:'sound'|'drift'|'broken'}, but nothing WROTE it, so health was always
// absent -> static green. This module persists the status the shipped reader
// expects, fed from the doctor --bind-check LOCAL room-health job.
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

module.exports = {
  statusFromBindReport,
  persistRoomHealth,
  cachePath,
  mindrianDir,
  VALID,
};
