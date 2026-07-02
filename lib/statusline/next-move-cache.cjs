// lib/statusline/next-move-cache.cjs -- Quick task 20260702-statusline-live-signals
//
// The WRITE + READ side-channel that makes the statusline "Next:" cue LIVE. It
// closes the Phase 192-04 NAMED DEBT in cockpit-signals.cjs (deriveNextMove had no
// wire to the real routed next step, so it showed 'continue' forever).
//
// One tiny LOCAL file at ~/.mindrian/next-move.json carries the last routed offer
// the shipped router (navigation-engine-offer.suggestNext) produced:
//   { next_move: '<short cue>', command: '/mos:xxx', jtbd: '<label>', ts: <epoch> }
//
// The WRITE side is called from the router's runtime chokepoint (NOT the hot
// statusline path). The READ side is the hot-path-cheap single file read that
// deriveNextMove consults FIRST. Mirrors the room-health / stance / voice-mark
// side-channel idiom exactly: every fs op is try/caught, any failure degrades to
// the safe default (null on read -> caller falls back to jtbd / governing / 'continue').
//
// Canon Part 8 (Graph Boundary): LOCAL only. Zero network, zero Brain. The routed
// step is a generic command handle, never user-room content.
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
  return path.join(mindrianDir(), 'next-move.json');
}

// Max length of the rendered cue (matches the governing-thought truncation floor
// in cockpit-signals.deriveNextMove so the Tier-3 line stays a single hero cue).
const CUE_MAX = 48;

/**
 * Turn a routed command slug into a short human "Next:" cue.
 *   '/mos:map-unknowns' -> 'map unknowns'
 *   'mullins'           -> 'mullins'
 * Returns '' for a non-string / empty command.
 * @param {string} command
 * @returns {string}
 */
function formatCommandCue(command) {
  if (typeof command !== 'string') return '';
  let s = command.trim();
  if (!s) return '';
  s = s.replace(/^\/?mos:/i, '').replace(/^\//, '');
  s = s.replace(/-/g, ' ').trim();
  if (s.length > CUE_MAX) s = s.slice(0, CUE_MAX - 1) + '…';
  return s;
}

/**
 * Persist the routed next step from a resolved offer (navigation-engine-offer
 * resolveOffer output: { command, jtbd, ... }). When offer is null / has no
 * command (the router abstained), CLEAR the cache so the statusline falls back to
 * jtbd / governing-thought / 'continue' rather than pinning a stale routed step.
 * Defensive: never throws; returns true on a successful write/clear, false on any
 * failure.
 * @param {Object|null} offer
 * @returns {boolean}
 */
function persistNextMove(offer) {
  try {
    const dir = mindrianDir();
    const p = cachePath();
    const command = offer && typeof offer.command === 'string' ? offer.command.trim() : '';
    const cue = formatCommandCue(command);

    // Abstention (no routed command) -> clear to the byte-stable default.
    if (!cue) {
      try { fs.rmSync(p, { force: true }); } catch (_e) { /* already absent */ }
      return true;
    }

    try { fs.mkdirSync(dir, { recursive: true }); } catch (_e) { /* exists */ }
    const record = {
      next_move: cue,
      command: command,
      jtbd: offer && typeof offer.jtbd === 'string' ? offer.jtbd : null,
      ts: Date.now(),
    };
    const tmp = p + '.tmp-' + process.pid;
    fs.writeFileSync(tmp, JSON.stringify(record), 'utf8');
    fs.renameSync(tmp, p);
    return true;
  } catch (_e) {
    return false;
  }
}

/**
 * Read the LOCAL routed-next-step cache. Hot-path cheap (one small file read).
 * Defensive: a missing / malformed / unreadable cache returns null (caller falls
 * back to jtbd -> governing-thought -> 'continue').
 * @returns {string|null} the rendered cue, or null when absent.
 */
function readNextMove() {
  try {
    const raw = fs.readFileSync(cachePath(), 'utf8');
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    const cue = typeof data.next_move === 'string' ? data.next_move.trim() : '';
    return cue.length > 0 ? cue : null;
  } catch (_e) {
    return null;
  }
}

module.exports = {
  persistNextMove,
  readNextMove,
  formatCommandCue,
  cachePath,
  mindrianDir,
  CUE_MAX,
};
