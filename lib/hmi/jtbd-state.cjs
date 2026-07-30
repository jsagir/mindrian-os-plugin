/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 100-03 -- per-room JTBD state I/O at
 * <roomDir>/.mindrian/jtbd-state.json. Atomic tmp+rename (Phase 95
 * pattern), schema v1, history bounded at 50, 24h staleness on both
 * auto current and manual overrides. D-06 per-room scope (no global
 * file). D-12 manual override semantics. Canon Part 3 graceful
 * fallback (no throws). Canon Part 8 LOCAL-only by construction.
 * Pure CJS, node built-ins only, zero deps (Phase 87 invariant).
 *
 * API: getCurrent / setCurrent / clear / history / isStale.
 * See .planning/phases/100-jtbd-inference-engine/100-CONTEXT.md and
 * 100-03-PLAN.md for full contract.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SCHEMA_VERSION = 1;
const HISTORY_MAX = 50;
const DEFAULT_STALENESS_HOURS = 24;
const MS_PER_HOUR = 60 * 60 * 1000;

function statePath(roomDir) { return path.join(roomDir, '.mindrian', 'jtbd-state.json'); }

function ensureStateDir(roomDir) {
  const dir = path.join(roomDir, '.mindrian');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readState(roomDir) {
  const p = statePath(roomDir);
  if (!fs.existsSync(p)) return null;
  let raw;
  try {
    raw = fs.readFileSync(p, 'utf8');
  } catch (e) {
    process.stderr.write('[jtbd-state] read error at ' + p + ': ' + e.message + '\n');
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    process.stderr.write('[jtbd-state] corrupt JSON at ' + p + ': ' + e.message + '\n');
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  // Tolerate legacy (version: undefined) reads. version === 1 canonical.
  return parsed;
}

function writeStateAtomic(roomDir, state) {
  ensureStateDir(roomDir);
  const dir = path.join(roomDir, '.mindrian');
  const finalPath = path.join(dir, 'jtbd-state.json');
  // Same-dir tmp -> POSIX-atomic rename(2). pid + hrtime nanos = collision-free.
  const suffix = process.pid.toString(36) + '-' + process.hrtime.bigint().toString(36);
  const tmpPath = path.join(dir, '.jtbd-state.json.tmp.' + suffix);
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

function manualOverrideActive(current) {
  if (!current || typeof current !== 'object' || !current.expires_at) return false;
  const expiresMs = Date.parse(current.expires_at);
  return !Number.isNaN(expiresMs) && expiresMs > Date.now();
}

function getCurrent(roomDir) {
  const s = readState(roomDir);
  return s && s.current && typeof s.current === 'object' ? s.current : null;
}

function setCurrent(roomDir, opts) {
  if (!opts || typeof opts !== 'object') {
    process.stderr.write('[jtbd-state] setCurrent: opts is required\n');
    return;
  }
  const jtbd = opts.jtbd;
  if (typeof jtbd !== 'string' || jtbd.length === 0) {
    process.stderr.write('[jtbd-state] setCurrent: opts.jtbd must be non-empty string\n');
    return;
  }
  const confidence = typeof opts.confidence === 'number' ? opts.confidence : 0;
  const evidence = Array.isArray(opts.evidence) ? opts.evidence.slice() : [];
  const trigger = typeof opts.trigger === 'string' && opts.trigger.length > 0
    ? opts.trigger : 'unspecified';
  const manual = opts.manual === true;

  const now = new Date();
  const nowIso = now.toISOString();

  const prior = readState(roomDir);
  const priorCurrent = prior && prior.current && typeof prior.current === 'object'
    ? prior.current : null;
  const priorHistory = prior && Array.isArray(prior.history) ? prior.history : [];
  const fromJtbd = priorCurrent && typeof priorCurrent.jtbd === 'string'
    ? priorCurrent.jtbd : 'explore';

  // Manual block: auto write inside non-expired manual window -> blocked history row,
  // current untouched. Manual writes always go through.
  if (!manual && manualOverrideActive(priorCurrent)) {
    const blockedRow = {
      from: fromJtbd, to: jtbd, trigger: 'auto_blocked_by_manual',
      at: nowIso, evidence: evidence,
    };
    try {
      writeStateAtomic(roomDir, {
        current: priorCurrent,
        history: trimHistory(priorHistory.concat([blockedRow])),
      });
    } catch (e) {
      process.stderr.write('[jtbd-state] write error (auto_blocked): ' + e.message + '\n');
    }
    return;
  }

  const newCurrent = {
    jtbd: jtbd, confidence: confidence, entered_at: nowIso,
    evidence: evidence,
    expires_at: manual
      ? new Date(now.getTime() + DEFAULT_STALENESS_HOURS * MS_PER_HOUR).toISOString()
      : null,
    // turn_count: a real transition RESETS the counter, because the
    // transition turn IS turn 1 on the new topic. bumpTurnCount (below)
    // increments it on subsequent same-topic turns. across-session-
    // memory.cjs:392 has been reading this field since Phase 103-05 with
    // nothing ever writing it (MEM-01); this write revives that dead
    // read path.
    turn_count: 1,
    // manual_set: across-session-memory.cjs:395's promotion gate reads
    // this exact field name. `trigger` lives only in transitionRow below
    // and therefore never reached the gate. Accepted residual: a
    // manual_set: true can outlive its expires_at window until the next
    // auto transition overwrites it with false (see plan 240-03 R-09 for
    // why the expiry predicate is deliberately NOT ANDed into the gate).
    manual_set: manual,
  };
  // SCHEMA_VERSION is not bumped: turn_count and manual_set are additive
  // fields and every reader guards with typeof, so a legacy state file
  // without them behaves exactly as it did before this change.
  const transitionRow = {
    from: fromJtbd, to: jtbd, trigger: trigger, at: nowIso, evidence: evidence,
  };
  try {
    writeStateAtomic(roomDir, {
      current: newCurrent,
      history: trimHistory(priorHistory.concat([transitionRow])),
    });
  } catch (e) {
    process.stderr.write('[jtbd-state] write error (setCurrent): ' + e.message + '\n');
  }
}

// bumpTurnCount(roomDir, expectedJtbd) -- the narrow per-turn counter writer
// for a NON-transition turn. This is deliberately NOT a second call to
// setCurrent: setCurrent would rewrite entered_at (destroying the dwell
// signal), append one history row per turn, and pressure HISTORY_MAX = 50
// (240-RESEARCH.md Pitfall 3).
//
// Behavior: reads state via readState. Returns null if there is no state,
// no current object, or no string current.jtbd. Returns null if
// expectedJtbd is a non-empty string that does not strictly equal
// current.jtbd, so a counter named for "consecutive same-topic turns"
// cannot accumulate across a topic change. Otherwise computes
// next = (turn_count if a positive number, else 1) + 1, writes state back
// through writeStateAtomic with current = prior current plus ONLY the
// replaced turn_count, and history passed through UNCHANGED (no
// trimHistory call, no row appended). Returns next.
//
// Invariants: jtbd, confidence, entered_at, evidence and expires_at are
// carried through untouched, so the dwell signal (entered_at) and the 24h
// manual window (expires_at) are both preserved. No history row is
// appended, so HISTORY_MAX = 50 is never pressured by per-turn ticks. This
// function NEVER throws (Canon Part 3 graceful-fallback discipline): the
// write is wrapped in the same try/catch shape setCurrent uses, a
// truncated stderr line is written on failure, and null is returned.
function bumpTurnCount(roomDir, expectedJtbd) {
  const state = readState(roomDir);
  const current = state && state.current && typeof state.current === 'object'
    ? state.current : null;
  if (!current || typeof current.jtbd !== 'string') return null;
  if (typeof expectedJtbd === 'string' && expectedJtbd.length > 0
    && expectedJtbd !== current.jtbd) {
    return null;
  }
  const next = (typeof current.turn_count === 'number' && current.turn_count > 0
    ? current.turn_count : 1) + 1;
  // Object.assign preserves field ORDER for any consumer diffing the file,
  // and means a legacy state file lacking turn_count simply gains it.
  const nextCurrent = Object.assign({}, current, { turn_count: next });
  const history = Array.isArray(state.history) ? state.history : [];
  try {
    writeStateAtomic(roomDir, { current: nextCurrent, history: history });
  } catch (e) {
    process.stderr.write('[jtbd-state] write error (bumpTurnCount): ' + e.message + '\n');
    return null;
  }
  return next;
}

function clear(roomDir) {
  const prior = readState(roomDir);
  const priorCurrent = prior && prior.current && typeof prior.current === 'object'
    ? prior.current : null;
  const priorHistory = prior && Array.isArray(prior.history) ? prior.history : [];
  const fromJtbd = priorCurrent && typeof priorCurrent.jtbd === 'string'
    ? priorCurrent.jtbd : 'explore';
  const nowIso = new Date().toISOString();
  const clearRow = {
    from: fromJtbd, to: null, trigger: 'manual_clear', at: nowIso, evidence: [],
  };
  try {
    writeStateAtomic(roomDir, {
      current: null,
      history: trimHistory(priorHistory.concat([clearRow])),
    });
  } catch (e) {
    process.stderr.write('[jtbd-state] write error (clear): ' + e.message + '\n');
  }
}

function history(roomDir, n) {
  const limit = typeof n === 'number' && n > 0 ? Math.floor(n) : 20;
  const s = readState(roomDir);
  if (!s || !Array.isArray(s.history)) return [];
  return s.history.length <= limit ? s.history.slice() : s.history.slice(s.history.length - limit);
}

function isStale(roomDir, maxAgeHours) {
  const hours = typeof maxAgeHours === 'number' && maxAgeHours > 0
    ? maxAgeHours : DEFAULT_STALENESS_HOURS;
  const current = getCurrent(roomDir);
  if (!current) return true;
  if (current.expires_at) {
    const expiresMs = Date.parse(current.expires_at);
    if (!Number.isNaN(expiresMs) && expiresMs < Date.now()) return true;
  }
  if (typeof current.entered_at !== 'string') return true;
  const enteredMs = Date.parse(current.entered_at);
  if (Number.isNaN(enteredMs)) return true;
  return (Date.now() - enteredMs) > hours * MS_PER_HOUR;
}

module.exports = {
  getCurrent, setCurrent, clear, history, isStale, bumpTurnCount,
  SCHEMA_VERSION, HISTORY_MAX, DEFAULT_STALENESS_HOURS,
  _internal: { statePath, readState, writeStateAtomic, trimHistory, manualOverrideActive },
};
