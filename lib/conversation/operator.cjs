/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 99-01 -- conversation operator state machine
 * ===================================================
 * Per-room conversation operator state primitive. Five operators
 * (JUST_TALK, EXPLORE_CAPTURE, BUILD_ROOM, METHODOLOGY, DECISION_GATE)
 * with 7 transition rules. State persists at
 * <roomDir>/.mindrian/conversation-operator.json with schema_version
 * "1.0.0". Atomic writes via mktemp + rename. Cold-start default
 * JUST_TALK (Phase 99 D-04). History bounded at 50 entries with
 * drop-oldest rotation (Phase 99 D-26).
 *
 * Every successful transition writes a typed OPERATOR_TRANSITION edge
 * to the local graph (<roomDir>/.room-graph/room.db) per Canon Part 4.
 * If the graph database is absent, the edge write is silently skipped;
 * the state file write still succeeds (graceful degradation per
 * Decision #8).
 *
 * Public API:
 *   getCurrent(roomDir) -> state object (or JUST_TALK default if file absent)
 *   transition(roomDir, to, trigger, contextDelta) -> { success, current, previous, entered_at } | { success: false, violations }
 *   validate(from, to, trigger) -> { valid: true } | { valid: false, reason }
 *
 * Frame budget (Phase 99 D-23, D-24):
 *   getCurrent < 1ms target
 *   transition < 5ms target
 *
 * Canon Part 8 (LOCAL ONLY):
 *   This module never queries Brain. Never writes to Brain. The
 *   five-operator vocabulary is generic; even if a future phase
 *   ever ships cross-room operator pattern queries, only the generic
 *   names would egress -- never user content. Phase 99 ships zero
 *   Brain surface.
 *
 * Pure CJS, node built-ins only, zero npm dependencies (Phase 87 invariant).
 *
 * License: BSL 1.1.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// ---------- Constants ----------

const SCHEMA_VERSION = '1.0.0';
const OPERATORS = ['JUST_TALK', 'EXPLORE_CAPTURE', 'BUILD_ROOM', 'METHODOLOGY', 'DECISION_GATE'];
const TRIGGERS = ['session_start', 'user_message', 'mos_command', 'operator_change', 'hook_post_tool_use', 'hook_stop', 'manual_set', 'manual_reset'];
const HISTORY_MAX = 50;

// Transition rules (Phase 99 CONTEXT.md D-08).
// Format: { from: <operator>|'ANY', to: <operator>|'previous', triggers: [<allowed triggers>] }
const TRANSITION_RULES = [
  { from: 'ANY', to: 'JUST_TALK', triggers: ['user_message', 'manual_set', 'manual_reset'] },
  { from: 'JUST_TALK', to: 'EXPLORE_CAPTURE', triggers: ['user_message', 'manual_set'] },
  { from: 'EXPLORE_CAPTURE', to: 'BUILD_ROOM', triggers: ['user_message', 'mos_command', 'manual_set'] },
  { from: 'BUILD_ROOM', to: 'METHODOLOGY', triggers: ['mos_command', 'hook_post_tool_use', 'manual_set'] },
  { from: 'METHODOLOGY', to: 'BUILD_ROOM', triggers: ['mos_command', 'hook_post_tool_use', 'manual_set'] },
  { from: 'ANY', to: 'DECISION_GATE', triggers: ['mos_command', 'hook_post_tool_use', 'manual_set'] },
  { from: 'DECISION_GATE', to: 'previous', triggers: ['user_message', 'hook_post_tool_use', 'manual_set'] },
];

// ---------- Validation ----------

function validate(from, to, trigger) {
  if (!OPERATORS.includes(from)) {
    return { valid: false, reason: `invalid 'from' operator: ${from}` };
  }
  if (to !== 'previous' && !OPERATORS.includes(to)) {
    return { valid: false, reason: `invalid 'to' operator: ${to}` };
  }
  if (!TRIGGERS.includes(trigger)) {
    return { valid: false, reason: `invalid trigger: ${trigger}` };
  }
  if (from === to) {
    return { valid: false, reason: `no-op transition: ${from} -> ${to}` };
  }
  for (const rule of TRANSITION_RULES) {
    const fromOk = rule.from === 'ANY' || rule.from === from;
    const toOk = rule.to === to;
    const trigOk = rule.triggers.includes(trigger);
    if (fromOk && toOk && trigOk) return { valid: true };
  }
  return { valid: false, reason: `no rule matches: ${from} -> ${to} via ${trigger}` };
}

// ---------- State path + default ----------

function statePath(roomDir) {
  return path.join(roomDir, '.mindrian', 'conversation-operator.json');
}

function defaultState(roomDir) {
  return {
    schema_version: SCHEMA_VERSION,
    current: 'JUST_TALK',
    previous: null,
    entered_at: new Date().toISOString(),
    context: {
      active_room: path.basename(roomDir),
      active_section: null,
      methodology_in_flight: null,
      decision_gate_pending: null,
    },
    history: [],
  };
}

// ---------- getCurrent ----------

function getCurrent(roomDir) {
  const p = statePath(roomDir);
  if (!fs.existsSync(p)) return defaultState(roomDir);
  let raw;
  try {
    raw = fs.readFileSync(p, 'utf8');
  } catch (e) {
    process.stderr.write(`[operator] read error at ${p}\n`);
    process.stderr.write(`[operator] ${e.message}\n`);
    process.stderr.write(`[operator] falling back to JUST_TALK default\n`);
    return defaultState(roomDir);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    process.stderr.write(`[operator] corrupt JSON at ${p}\n`);
    process.stderr.write(`[operator] ${e.message}\n`);
    process.stderr.write(`[operator] falling back to JUST_TALK default\n`);
    return defaultState(roomDir);
  }
  if (parsed.schema_version !== SCHEMA_VERSION) {
    process.stderr.write(`[operator] schema_version mismatch: got ${parsed.schema_version}, expected ${SCHEMA_VERSION}\n`);
    process.stderr.write(`[operator] file ${p}\n`);
    process.stderr.write(`[operator] falling back to JUST_TALK default\n`);
    return defaultState(roomDir);
  }
  if (!OPERATORS.includes(parsed.current)) {
    process.stderr.write(`[operator] invalid current operator: ${parsed.current}\n`);
    process.stderr.write(`[operator] file ${p}\n`);
    process.stderr.write(`[operator] falling back to JUST_TALK default\n`);
    return defaultState(roomDir);
  }
  return parsed;
}

// ---------- Atomic write ----------

function writeStateAtomic(roomDir, state) {
  const dir = path.join(roomDir, '.mindrian');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const finalPath = path.join(dir, 'conversation-operator.json');
  // mktemp inside SAME directory for POSIX-atomic rename
  const rand = crypto.randomBytes(6).toString('hex');
  const tmpPath = path.join(dir, `.conversation-operator.json.${rand}`);
  // Serialize with schema_version FIRST (D-06)
  const ordered = {
    schema_version: SCHEMA_VERSION,
    current: state.current,
    previous: state.previous,
    entered_at: state.entered_at,
    context: state.context,
    history: state.history,
  };
  fs.writeFileSync(tmpPath, JSON.stringify(ordered, null, 2), 'utf8');
  fs.renameSync(tmpPath, finalPath);
}

// ---------- OPERATOR_TRANSITION edge writer ----------

function writeOperatorTransitionEdge(roomDir, from, to, trigger, contextDelta) {
  const graphDir = path.join(roomDir, '.room-graph');
  const dbPath = path.join(graphDir, 'room.db');
  if (!fs.existsSync(dbPath)) return; // graceful: no graph yet, skip
  let db;
  try {
    // node:sqlite is available in Node 22+ (matches lib/core/lazygraph-ops.cjs).
    // Phase 87 invariant: zero new runtime deps. Use node:sqlite (built-in) only.
    const { DatabaseSync } = require('node:sqlite');
    db = new DatabaseSync(dbPath);
  } catch (_e) {
    // Either node:sqlite unavailable (older Node) OR DB locked. Silent skip.
    return;
  }
  try {
    const props = JSON.stringify({
      trigger,
      timestamp: new Date().toISOString(),
      entities_introduced: contextDelta && Array.isArray(contextDelta.entities_introduced) ? contextDelta.entities_introduced : [],
      methodology: contextDelta && contextDelta.methodology_in_flight ? contextDelta.methodology_in_flight : null,
    });
    // Insert nodes (idempotent) before edge
    const insNode = db.prepare(`INSERT OR IGNORE INTO nodes(id, type) VALUES (?, ?)`);
    insNode.run(from, 'operator');
    insNode.run(to, 'operator');
    const stmt = db.prepare(`INSERT OR IGNORE INTO edges(source, target, type, properties) VALUES (?, ?, 'OPERATOR_TRANSITION', ?)`);
    stmt.run(from, to, props);
  } catch (_e) {
    // Schema mismatch (e.g., older graph without nodes table) -- silent skip
  } finally {
    try { db.close(); } catch (_) { /* best-effort */ }
  }
}

// ---------- transition ----------

function transition(roomDir, to, trigger, contextDelta = {}) {
  const state = getCurrent(roomDir);
  const from = state.current;

  // Validate against the ORIGINAL `to` (which may be the literal string
  // 'previous' for the DECISION_GATE -> previous rule per D-08). The rule
  // table records `to: 'previous'` literally; resolving before validate
  // would prevent the rule from matching.
  const v = validate(from, to, trigger);
  if (!v.valid) {
    return { success: false, violations: [{ category: 'transition', severity: 'error', message: v.reason }] };
  }

  // Resolve `to === 'previous'` to state.previous for the actual write.
  let resolvedTo = to;
  if (to === 'previous') {
    if (!state.previous) {
      return { success: false, violations: [{ category: 'transition', severity: 'error', message: `cannot transition to 'previous': no previous operator recorded` }] };
    }
    resolvedTo = state.previous;
  }

  const now = new Date().toISOString();
  const nextHistory = state.history.slice();
  nextHistory.push({ op: resolvedTo, from, to: resolvedTo, trigger, ts: now });
  if (nextHistory.length > HISTORY_MAX) {
    nextHistory.splice(0, nextHistory.length - HISTORY_MAX); // drop-oldest (D-26)
  }

  const nextContext = Object.assign({}, state.context, contextDelta || {});
  // Always reset active_room to current basename in case roomDir changed
  nextContext.active_room = path.basename(roomDir);

  const nextState = {
    schema_version: SCHEMA_VERSION,
    current: resolvedTo,
    previous: from,
    entered_at: now,
    context: nextContext,
    history: nextHistory,
  };

  try {
    writeStateAtomic(roomDir, nextState);
  } catch (e) {
    return { success: false, violations: [{ category: 'io', severity: 'error', message: `atomic write failed: ${e.message}` }] };
  }

  // Best-effort graph edge write (silent on failure)
  try { writeOperatorTransitionEdge(roomDir, from, resolvedTo, trigger, contextDelta); } catch (_) { /* graceful */ }

  return { success: true, current: resolvedTo, previous: from, entered_at: now };
}

// ---------- Exports ----------

module.exports = {
  // Public API
  getCurrent,
  transition,
  validate,
  // Constants (consumed by 99-02 classifier, 99-04 hooks, 99-05 command)
  OPERATORS,
  TRIGGERS,
  TRANSITION_RULES,
  SCHEMA_VERSION,
  HISTORY_MAX,
  // Internal helpers exported for testability ONLY (do not consume from production code)
  _internal: { statePath, defaultState, writeStateAtomic, writeOperatorTransitionEdge },
};
