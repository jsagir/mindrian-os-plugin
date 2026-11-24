'use strict';
// lib/core/decision-advisor/shortlist.cjs -- Phase 399 Plan 06 (I-05, I-08).
//
// The per-turn lookup over the precomputed table. It reads one local JSON file.
// It makes no network call and no model call. The advisor advises and the host
// judges (D-02): this module serves ranked options with a band word each, and an
// explicit "no strong pick" state when no option is strong.
//
// Numbers (the calibrated values) go to internal callers only. The presentation
// layer (plan 07) strips them before any text reaches the host or the user.
//
// v0 job-only data: the shipped table holds only <job>|*|* rows. The key format
// and the fallback order below are built for finer rows and tested with a fixture
// table; they are not live with the shipped table.
//
// Row keys: <job>|<definition_level>|<last_command>, with "*" for "any".
// Fallback order: exact, then job|level|*, then job|*|last, then job|*|*.
//
// Env: MINDRIAN_DECISION_ADVISOR=off turns the advisor off (state "off").
//      MINDRIAN_DECISION_ADVISOR_TABLE points at another table file (test seam).
// Requires only node:fs and node:path so a hook can load it inside its budget.

const fs = require('node:fs');
const path = require('node:path');

const STATES = Object.freeze({
  ok: 'ok',
  no_strong_pick: 'no_strong_pick',
  no_job: 'no_job',
  no_row: 'no_row',
  no_table: 'no_table',
  off: 'off',
});

// A frozen copy of lib/core/problem-axes.cjs DEFINITION_LEVELS, so this module
// loads nothing else. tests/test-399-table.cjs leg S7 pins the copy to the source.
const DEFINITION_LEVELS = Object.freeze(['un-defined', 'ill-defined', 'well-defined']);

const DEFAULT_TABLE = path.join(__dirname, '..', '..', '..', 'data', 'decision-advisor-table.json');

let cache = null; // { file, mtimeMs, table }

function advisorEnabled() {
  return process.env.MINDRIAN_DECISION_ADVISOR !== 'off';
}

function tablePath() {
  return process.env.MINDRIAN_DECISION_ADVISOR_TABLE || DEFAULT_TABLE;
}

function validTable(t) {
  return (
    t &&
    typeof t === 'object' &&
    t.rows &&
    typeof t.rows === 'object' &&
    t.thresholds &&
    typeof t.thresholds.strong === 'number' &&
    typeof t.thresholds.possible === 'number' &&
    Number.isInteger(t.shortlist_k) &&
    t.shortlist_k > 0
  );
}

// Returns the parsed table or null. Never throws. Cached per path and file time.
function loadTable() {
  const file = tablePath();
  try {
    const st = fs.statSync(file);
    if (cache && cache.file === file && cache.mtimeMs === st.mtimeMs) return cache.table;
    const table = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!validTable(table)) return null;
    cache = { file, mtimeMs: st.mtimeMs, table };
    return table;
  } catch (_e) {
    return null;
  }
}

function tableMeta() {
  const t = loadTable();
  if (!t) return null;
  return {
    version: t.table_version,
    data_scope: t.data_scope || null,
    key_order: t.key_order,
    thresholds: { strong: t.thresholds.strong, possible: t.thresholds.possible },
    shortlist_k: t.shortlist_k,
    conditioned_rows: t.conditioned_rows === true,
  };
}

function bandFor(value, thresholds) {
  const th = thresholds || (loadTable() || {}).thresholds;
  if (!th || typeof value !== 'number') return 'weak';
  if (value >= th.strong) return 'strong';
  if (value >= th.possible) return 'possible';
  return 'weak';
}

function cleanLevel(level) {
  return typeof level === 'string' && DEFINITION_LEVELS.indexOf(level) !== -1 ? level : null;
}

function cleanName(name) {
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

// Finds the first row in the fallback order. Returns { key, row } or null.
function findRow(table, q) {
  const job = cleanName(q && q.jobId);
  if (!job) return null;
  const level = cleanLevel(q.definitionLevel);
  const last = cleanName(q.lastCommand);
  const keys = [];
  if (level && last) keys.push(job + '|' + level + '|' + last);
  if (level) keys.push(job + '|' + level + '|*');
  if (last) keys.push(job + '|*|' + last);
  keys.push(job + '|*|*');
  for (const key of keys) {
    const row = table.rows[key];
    if (Array.isArray(row)) return { key, row };
  }
  return null;
}

function empty(state, table) {
  return {
    state,
    key_used: null,
    options: [],
    no_strong_pick: false,
    top_tie: 0,
    table_version: table ? table.table_version : null,
  };
}

// lookupShortlist({ jobId, definitionLevel, lastCommand, exclude, k })
// Never throws. A missing job, row or table gives an empty option list and a state word.
function lookupShortlist(q) {
  try {
    if (!advisorEnabled()) return empty(STATES.off, null);
    if (!cleanName(q && q.jobId)) return empty(STATES.no_job, null);
    const table = loadTable();
    if (!table) return empty(STATES.no_table, null);
    const found = findRow(table, q);
    if (!found) return empty(STATES.no_row, table);
    const skip = new Set();
    const last = cleanName(q.lastCommand);
    if (last) skip.add(last);
    for (const name of Array.isArray(q.exclude) ? q.exclude : []) {
      const n = cleanName(name);
      if (n) skip.add(n);
    }
    const asked = Number.isInteger(q.k) && q.k > 0 ? q.k : table.shortlist_k;
    const k = Math.min(asked, table.shortlist_k);
    const options = [];
    for (const entry of found.row) {
      if (skip.has(entry.command)) continue;
      options.push({
        command: entry.command,
        band: bandFor(entry.calibrated, table.thresholds),
        rank: options.length + 1,
        calibrated: entry.calibrated,
      });
      if (options.length >= k) break;
    }
    const noStrong = !options.some((o) => o.band === 'strong');
    // Plan 07 guard: how many eligible entries of the WHOLE row share the top value. Many options tie at the
    // top (calibrated 1), and the order inside a tie is alphabetical, not a preference. 1 means a unique top.
    const eligible = found.row.filter((e) => !skip.has(e.command));
    const topTie = eligible.length === 0 ? 0 : eligible.filter((e) => e.calibrated === eligible[0].calibrated).length;
    return {
      state: noStrong ? STATES.no_strong_pick : STATES.ok,
      key_used: found.key,
      options,
      no_strong_pick: noStrong,
      top_tie: topTie,
      table_version: table.table_version,
    };
  } catch (_e) {
    return empty(STATES.no_table, null);
  }
}

// scoreFor({ jobId, definitionLevel, lastCommand }, command): the calibrated value or null.
// A command outside the stored row depth has no stored value and gives null.
function scoreFor(q, command) {
  try {
    if (!advisorEnabled()) return null;
    const table = loadTable();
    if (!table) return null;
    const found = findRow(table, q);
    if (!found) return null;
    const hit = found.row.find((e) => e.command === command);
    return hit ? hit.calibrated : null;
  } catch (_e) {
    return null;
  }
}

module.exports = { STATES, DEFINITION_LEVELS, advisorEnabled, tableMeta, lookupShortlist, scoreFor, bandFor };
