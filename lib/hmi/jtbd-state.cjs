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
 *
 * Phase 345-02 -- this file now holds TWO facts with TWO lifetimes and TWO
 * authorities. (a) `current` is what the classifier believes THIS TURN; it
 * is rewritten unattended by `setCurrent`/`bumpTurnCount`/`clear` from the
 * UserPromptSubmit hook (scripts/jtbd-update.cjs) on every classified
 * transition. (b) `goal` is what the navigator RATIFIED at a Decision Gate;
 * it is written ONLY by `setGoal`, called only from the gate approve branch
 * (plan 07). A record with a navigator's authority cannot live inside a
 * container an unattended classifier rebuilds wholesale -- 345-ICM-CONSULT
 * R1 (BLOCKING) put it at this top level instead. (c) `version` is a
 * FILE-FORMAT version, not a field-set version: `SCHEMA_VERSION` has never
 * been bumped even though Phase 240 added `turn_count`/`manual_set` to
 * `current` (:153-155 below) and Phase 345 adds the top-level `goal` and
 * `goal_history` keys, so field presence -- not `version` -- is the only
 * honest probe for what a given file actually carries (345-ICM-CONSULT
 * AP-G2). (d) `goal.parent_question` is LOCAL room prose under Canon Part 8
 * and must NEVER ride a reach `evidence` bag, a companion handle, a
 * `memory_event` payload, or any Theo argument including
 * `taxonomy_ladder`'s `question_label`. layer: context.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const rungVocabulary = require('../core/strategy/rung-vocabulary.cjs');

const SCHEMA_VERSION = 1;
const HISTORY_MAX = 50;
const GOAL_HISTORY_MAX = 50;
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
    goal: state.goal === undefined ? null : state.goal,
    goal_history: Array.isArray(state.goal_history) ? state.goal_history : [],
  };
  fs.writeFileSync(tmpPath, JSON.stringify(ordered, null, 2), 'utf8');
  fs.renameSync(tmpPath, finalPath);
}

function trimHistory(h, max) {
  if (!Array.isArray(h)) return [];
  const limit = typeof max === 'number' && max > 0 ? max : HISTORY_MAX;
  return h.length <= limit ? h.slice() : h.slice(h.length - limit);
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
        goal: prior && prior.goal,
        goal_history: prior && prior.goal_history,
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
      goal: prior && prior.goal,
      goal_history: prior && prior.goal_history,
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
    writeStateAtomic(roomDir, {
      current: nextCurrent,
      history: history,
      goal: state && state.goal,
      goal_history: state && state.goal_history,
    });
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
      goal: prior && prior.goal,
      goal_history: prior && prior.goal_history,
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

// getGoal(roomDir) -- the ratified-goal reader, sibling to getCurrent. A
// room with no state file, a legacy (pre-345) state file, or a `goal` key
// that is not an object all return null. Never throws (Canon Part 3).
function getGoal(roomDir) {
  const s = readState(roomDir);
  return s && s.goal && typeof s.goal === 'object' ? s.goal : null;
}

// setGoal(roomDir, opts) -- the ONLY writer of the top-level `goal` key.
// Ratification happens at a Decision Gate (plan 07's gate approve branch is
// the only intended caller); this function itself does not gate anything,
// it only validates shape and vocabulary before it writes.
//
// Refuses (returns null, writes nothing) on: opts not a plain object,
// opts.jtbd missing/empty/non-string, opts.rung present but failing
// rungVocabulary.isTheoRung (the WIRE-vocabulary ladder form, e.g.
// 'ill-defined', is a different vocabulary and is refused on purpose --
// 345-RESEARCH Pitfall 4), or opts.parent_question present but non-string.
// On any refusal, any prior goal record on disk is left byte-identical
// (readState is called only AFTER validation passes).
//
// On success: goal_version is monotone -- 1 for a room with no prior goal
// (absent or a pre-345 file with no goal_version), prior + 1 otherwise.
// One row is appended to goal_history (bounded at GOAL_HISTORY_MAX via
// trimHistory) recording from/to jtbd and from_rung/to_rung so what the
// goal was and who changed it is recoverable from the file alone. `current`
// and `history` are carried through from prior unchanged -- setGoal never
// touches the classifier's per-turn state.
function setGoal(roomDir, opts) {
  if (!opts || typeof opts !== 'object' || Array.isArray(opts)) {
    process.stderr.write('[jtbd-state] setGoal: opts is required\n');
    return null;
  }
  const jtbd = opts.jtbd;
  if (typeof jtbd !== 'string' || jtbd.length === 0) {
    process.stderr.write('[jtbd-state] setGoal: opts.jtbd must be non-empty string\n');
    return null;
  }
  if (opts.rung !== undefined && !rungVocabulary.isTheoRung(opts.rung)) {
    process.stderr.write('[jtbd-state] setGoal: opts.rung must be a Theo rung id\n');
    return null;
  }
  if (opts.parent_question !== undefined && typeof opts.parent_question !== 'string') {
    process.stderr.write('[jtbd-state] setGoal: opts.parent_question must be a string\n');
    return null;
  }

  const prior = readState(roomDir);
  const priorGoal = prior && prior.goal && typeof prior.goal === 'object' ? prior.goal : null;
  const priorGoalHistory = prior && Array.isArray(prior.goal_history) ? prior.goal_history : [];

  const goalVersion = (priorGoal
    && typeof priorGoal.goal_version === 'number' && priorGoal.goal_version > 0
    ? priorGoal.goal_version : 0) + 1;

  const rung = opts.rung !== undefined ? opts.rung : null;
  const parentQuestion = opts.parent_question !== undefined ? opts.parent_question : null;
  const setBy = typeof opts.set_by === 'string' && opts.set_by.length > 0
    ? opts.set_by : 'gate_answer';
  const setAt = new Date().toISOString();

  const newGoal = {
    jtbd: jtbd,
    parent_question: parentQuestion,
    rung: rung,
    goal_version: goalVersion,
    set_at: setAt,
    set_by: setBy,
  };

  const historyRow = {
    from: priorGoal && typeof priorGoal.jtbd === 'string' ? priorGoal.jtbd : null,
    to: jtbd,
    from_rung: priorGoal && priorGoal.rung !== undefined ? priorGoal.rung : null,
    to_rung: rung,
    goal_version: goalVersion,
    at: setAt,
    set_by: setBy,
  };

  try {
    writeStateAtomic(roomDir, {
      current: prior && prior.current,
      history: prior && prior.history,
      goal: newGoal,
      goal_history: trimHistory(priorGoalHistory.concat([historyRow]), GOAL_HISTORY_MAX),
    });
  } catch (e) {
    process.stderr.write('[jtbd-state] write error (setGoal): ' + e.message + '\n');
    return null;
  }
  return newGoal;
}

// goalHistory(roomDir, n) -- mirrors history(roomDir, n): default limit 20,
// tail slice, never throws.
function goalHistory(roomDir, n) {
  const limit = typeof n === 'number' && n > 0 ? Math.floor(n) : 20;
  const s = readState(roomDir);
  if (!s || !Array.isArray(s.goal_history)) return [];
  return s.goal_history.length <= limit
    ? s.goal_history.slice()
    : s.goal_history.slice(s.goal_history.length - limit);
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
  setGoal, getGoal, goalHistory, GOAL_HISTORY_MAX,
  SCHEMA_VERSION, HISTORY_MAX, DEFAULT_STALENESS_HOURS,
  _internal: { statePath, readState, writeStateAtomic, trimHistory, manualOverrideActive },
};
