'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 188-04 (SFS-08) -- per-room F.3 depth-state I/O at
 * <roomDir>/.mindrian/depth-state.json. Clones the jtbd-state.cjs per-room
 * atomic model (Phase 100-03): same-dir tmp + POSIX-atomic rename(2), schema
 * v1, bounded history. Stores a single DEPTH SCALAR from the closed F.3 axis
 * (Shallow / Medium / Deep / Extreme). D-12 depth-state wiring at first-class
 * parity with the other Shape-F sub-shapes.
 *
 * Closed-vocab carve-out (research pitfall #4): F.3 is NOT Brain-routed and has
 * NO recommended marker / Free-Text. This module is the capture/consumer/STATE
 * layer only; it never touches the renderer and never mints a marker.
 *
 * Canon binding:
 *   Part 3: graceful fallback -- every path degrades to a no-op / null, never
 *           throws into the calling turn.
 *   Part 8: LOCAL-only by construction. The stored value is the closed depth
 *           enum; any raw navigator text rides the sentence LOCAL lane at the
 *           capture adapter and is never persisted here.
 *   Part 9: this is per-room JSON state (the local mind), NOT a typed-edge write;
 *           it opens NO room.db. Typed-edge writes (if ever needed) route through
 *           lib/core/navigation.cjs -- never from here.
 *
 * Pure CJS, node built-ins only, zero deps (Phase 87 invariant). No em-dashes.
 *
 * API: getCurrent / setCurrent / clear / history.
 */

const fs = require('node:fs');
const path = require('node:path');

const SCHEMA_VERSION = 1;
const HISTORY_MAX = 50;

// The closed F.3 depth axis (renderer F3_OPTIONS minus the Back control).
const DEPTH_VALUES = Object.freeze(['Shallow', 'Medium', 'Deep', 'Extreme']);

function statePath(roomDir) { return path.join(roomDir, '.mindrian', 'depth-state.json'); }

function ensureStateDir(roomDir) {
  const dir = path.join(roomDir, '.mindrian');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Membership normalize: only a closed-axis value is accepted; anything else -> null.
function normalizeDepth(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  return DEPTH_VALUES.indexOf(raw) !== -1 ? raw : null;
}

function readState(roomDir) {
  if (typeof roomDir !== 'string' || roomDir.length === 0) return null;
  const p = statePath(roomDir);
  if (!fs.existsSync(p)) return null;
  let raw;
  try {
    raw = fs.readFileSync(p, 'utf8');
  } catch (e) {
    process.stderr.write('[depth-state] read error at ' + p + ': ' + e.message + '\n');
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    process.stderr.write('[depth-state] corrupt JSON at ' + p + ': ' + e.message + '\n');
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  return parsed;
}

function writeStateAtomic(roomDir, state) {
  ensureStateDir(roomDir);
  const dir = path.join(roomDir, '.mindrian');
  const finalPath = path.join(dir, 'depth-state.json');
  const suffix = process.pid.toString(36) + '-' + process.hrtime.bigint().toString(36);
  const tmpPath = path.join(dir, '.depth-state.json.tmp.' + suffix);
  const ordered = {
    version: SCHEMA_VERSION,
    current: state.current === undefined ? null : state.current,
    history: Array.isArray(state.history) ? state.history : [],
  };
  fs.writeFileSync(tmpPath, JSON.stringify(ordered, null, 2), 'utf8');
  fs.renameSync(tmpPath, finalPath);
}

function trimHistory(h) {
  if (!Array.isArray(h)) return [];
  return h.length <= HISTORY_MAX ? h.slice() : h.slice(h.length - HISTORY_MAX);
}

// getCurrent(roomDir) -> { depth, entered_at } | null. Degrade-never-block.
function getCurrent(roomDir) {
  const s = readState(roomDir);
  if (s && s.current && typeof s.current === 'object'
      && typeof s.current.depth === 'string' && s.current.depth.length > 0) {
    return s.current;
  }
  return null;
}

// setCurrent(roomDir, depth) -- write the closed depth scalar. Accepts a bare
// depth string or an opts object { depth }. An out-of-axis value is a no-op
// (Part 3 graceful fallback; matches the deterministic membership discipline).
function setCurrent(roomDir, depth) {
  if (typeof roomDir !== 'string' || roomDir.length === 0) {
    process.stderr.write('[depth-state] setCurrent: roomDir is required\n');
    return null;
  }
  const raw = (depth && typeof depth === 'object') ? depth.depth : depth;
  const value = normalizeDepth(raw);
  if (value === null) {
    process.stderr.write('[depth-state] setCurrent: depth must be one of ' + DEPTH_VALUES.join('/') + '\n');
    return null;
  }
  const nowIso = new Date().toISOString();
  const prior = readState(roomDir);
  const priorCurrent = prior && prior.current && typeof prior.current === 'object' ? prior.current : null;
  const priorHistory = prior && Array.isArray(prior.history) ? prior.history : [];
  const fromDepth = priorCurrent && typeof priorCurrent.depth === 'string' ? priorCurrent.depth : null;

  const newCurrent = { depth: value, entered_at: nowIso };
  const transitionRow = { from: fromDepth, to: value, at: nowIso };
  try {
    writeStateAtomic(roomDir, {
      current: newCurrent,
      history: trimHistory(priorHistory.concat([transitionRow])),
    });
  } catch (e) {
    process.stderr.write('[depth-state] write error (setCurrent): ' + e.message + '\n');
    return null;
  }
  return newCurrent;
}

function clear(roomDir) {
  const prior = readState(roomDir);
  const priorHistory = prior && Array.isArray(prior.history) ? prior.history : [];
  const nowIso = new Date().toISOString();
  const clearRow = { from: getCurrent(roomDir) ? getCurrent(roomDir).depth : null, to: null, at: nowIso };
  try {
    writeStateAtomic(roomDir, { current: null, history: trimHistory(priorHistory.concat([clearRow])) });
  } catch (e) {
    process.stderr.write('[depth-state] write error (clear): ' + e.message + '\n');
  }
}

function history(roomDir, n) {
  const limit = typeof n === 'number' && n > 0 ? Math.floor(n) : 20;
  const s = readState(roomDir);
  if (!s || !Array.isArray(s.history)) return [];
  return s.history.length <= limit ? s.history.slice() : s.history.slice(s.history.length - limit);
}

module.exports = {
  getCurrent, setCurrent, clear, history,
  normalizeDepth,
  DEPTH_VALUES: DEPTH_VALUES.slice(),
  SCHEMA_VERSION, HISTORY_MAX,
  _internal: { statePath, readState, writeStateAtomic, trimHistory },
};
