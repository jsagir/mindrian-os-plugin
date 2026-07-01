'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 188-04 (SFS-09) -- per-room F.4 harvest-scope state at
 * <roomDir>/.mindrian/harvest-scope-state.json. Mirrors depth-state.cjs (which
 * clones the jtbd-state.cjs atomic model): same-dir tmp + POSIX-atomic
 * rename(2), schema v1, bounded history. The load-bearing F.4 property is
 * PROGRESSIVE ACCUMULATION: each rung ADDS to the prior scope
 * ('Key insights' -> +contradictions -> +actions), it does NOT replace it.
 *
 * Closed-vocab carve-out (research pitfall #4): F.4 is NOT Brain-routed and has
 * NO recommended marker / Free-Text. This is the capture/consumer/STATE layer
 * only; it never touches the renderer and never mints a marker.
 *
 * Canon binding:
 *   Part 3: graceful fallback -- every path degrades to a no-op / [], never throws.
 *   Part 8: LOCAL-only. The stored values are the closed scope-rung enum; raw
 *           navigator text rides the sentence LOCAL lane at the capture adapter.
 *   Part 9: per-room JSON state (the local mind), NOT a typed-edge write; opens
 *           NO room.db. Typed-edge writes route through navigation.cjs, never here.
 *
 * Pure CJS, node built-ins only, zero deps (Phase 87 invariant). No em-dashes.
 *
 * API: getCurrent / setCurrent / addScope / getScope / clear / history.
 */

const fs = require('node:fs');
const path = require('node:path');

const SCHEMA_VERSION = 1;
const HISTORY_MAX = 50;

// The closed F.4 progressive ladder (renderer F4_OPTIONS minus the terminal
// 'Create artifact draft' and the 'Back' control). These are the accumulating rungs.
const SCOPE_RUNGS = Object.freeze(['Key insights', '+contradictions', '+actions']);

function statePath(roomDir) { return path.join(roomDir, '.mindrian', 'harvest-scope-state.json'); }

function ensureStateDir(roomDir) {
  const dir = path.join(roomDir, '.mindrian');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Membership normalize: only a closed ladder rung is accepted; else null.
function normalizeRung(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  return SCOPE_RUNGS.indexOf(raw) !== -1 ? raw : null;
}

function readState(roomDir) {
  if (typeof roomDir !== 'string' || roomDir.length === 0) return null;
  const p = statePath(roomDir);
  if (!fs.existsSync(p)) return null;
  let raw;
  try {
    raw = fs.readFileSync(p, 'utf8');
  } catch (e) {
    process.stderr.write('[harvest-scope-state] read error at ' + p + ': ' + e.message + '\n');
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    process.stderr.write('[harvest-scope-state] corrupt JSON at ' + p + ': ' + e.message + '\n');
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  return parsed;
}

function writeStateAtomic(roomDir, state) {
  ensureStateDir(roomDir);
  const dir = path.join(roomDir, '.mindrian');
  const finalPath = path.join(dir, 'harvest-scope-state.json');
  const suffix = process.pid.toString(36) + '-' + process.hrtime.bigint().toString(36);
  const tmpPath = path.join(dir, '.harvest-scope-state.json.tmp.' + suffix);
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

// getScope(roomDir) -> [ ...rungs ] (the accumulated set; [] when cold).
function getScope(roomDir) {
  const s = readState(roomDir);
  if (s && s.current && typeof s.current === 'object' && Array.isArray(s.current.scope)) {
    return s.current.scope.slice();
  }
  return [];
}

// getCurrent(roomDir) -> { scope, entered_at } | null. Degrade-never-block.
function getCurrent(roomDir) {
  const s = readState(roomDir);
  if (s && s.current && typeof s.current === 'object' && Array.isArray(s.current.scope)) {
    return s.current;
  }
  return null;
}

// _writeScope -- shared write path. Persists the ordered accumulated scope + a
// history row. Returns the new current, or null on write failure.
function _writeScope(roomDir, nextScope, addedRung) {
  const nowIso = new Date().toISOString();
  const prior = readState(roomDir);
  const priorHistory = prior && Array.isArray(prior.history) ? prior.history : [];
  const newCurrent = { scope: nextScope, entered_at: nowIso };
  const row = { added: (addedRung === undefined ? null : addedRung), scope: nextScope.slice(), at: nowIso };
  try {
    writeStateAtomic(roomDir, {
      current: newCurrent,
      history: trimHistory(priorHistory.concat([row])),
    });
  } catch (e) {
    process.stderr.write('[harvest-scope-state] write error: ' + e.message + '\n');
    return null;
  }
  return newCurrent;
}

// addScope(roomDir, rung) -- ACCUMULATE the rung onto the prior scope. Order is
// the canonical ladder order; a rung already present is idempotent (no dupes).
// An out-of-ladder rung is a no-op (Part 3 graceful fallback). Returns the new
// accumulated scope array (or the prior scope on a no-op).
function addScope(roomDir, rung) {
  if (typeof roomDir !== 'string' || roomDir.length === 0) {
    process.stderr.write('[harvest-scope-state] addScope: roomDir is required\n');
    return [];
  }
  const value = normalizeRung(rung);
  const priorScope = getScope(roomDir);
  if (value === null) {
    process.stderr.write('[harvest-scope-state] addScope: rung must be one of ' + SCOPE_RUNGS.join('/') + '\n');
    return priorScope;
  }
  if (priorScope.indexOf(value) !== -1) {
    // Idempotent: already accumulated. Re-anchor entered_at without duplicating.
    const w = _writeScope(roomDir, priorScope.slice(), value);
    return w ? w.scope.slice() : priorScope;
  }
  // Accumulate, then re-sort into canonical ladder order for a stable scope view.
  const merged = priorScope.concat([value]);
  const nextScope = SCOPE_RUNGS.filter(function (r) { return merged.indexOf(r) !== -1; });
  const written = _writeScope(roomDir, nextScope, value);
  return written ? written.scope.slice() : priorScope;
}

// setCurrent(roomDir, scope) -- REPLACE the accumulated scope with the supplied
// set (accepts an array or an opts object { scope }). Out-of-ladder members are
// dropped; the result is re-ordered into canonical ladder order.
function setCurrent(roomDir, scope) {
  if (typeof roomDir !== 'string' || roomDir.length === 0) {
    process.stderr.write('[harvest-scope-state] setCurrent: roomDir is required\n');
    return null;
  }
  const rawList = Array.isArray(scope)
    ? scope
    : (scope && typeof scope === 'object' && Array.isArray(scope.scope) ? scope.scope : null);
  if (rawList === null) {
    process.stderr.write('[harvest-scope-state] setCurrent: scope must be an array (or { scope: [] })\n');
    return null;
  }
  const cleaned = SCOPE_RUNGS.filter(function (r) { return rawList.indexOf(r) !== -1; });
  return _writeScope(roomDir, cleaned, undefined);
}

function clear(roomDir) {
  const prior = readState(roomDir);
  const priorHistory = prior && Array.isArray(prior.history) ? prior.history : [];
  const nowIso = new Date().toISOString();
  const clearRow = { added: null, scope: [], at: nowIso, cleared: true };
  try {
    writeStateAtomic(roomDir, { current: { scope: [], entered_at: nowIso }, history: trimHistory(priorHistory.concat([clearRow])) });
  } catch (e) {
    process.stderr.write('[harvest-scope-state] write error (clear): ' + e.message + '\n');
  }
}

function history(roomDir, n) {
  const limit = typeof n === 'number' && n > 0 ? Math.floor(n) : 20;
  const s = readState(roomDir);
  if (!s || !Array.isArray(s.history)) return [];
  return s.history.length <= limit ? s.history.slice() : s.history.slice(s.history.length - limit);
}

module.exports = {
  getCurrent, setCurrent, addScope, getScope, clear, history,
  normalizeRung,
  SCOPE_RUNGS: SCOPE_RUNGS.slice(),
  SCHEMA_VERSION, HISTORY_MAX,
  _internal: { statePath, readState, writeStateAtomic, trimHistory },
};
