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
// Env: the advisor is opt-in. Only MINDRIAN_DECISION_ADVISOR=on enables it; unset or any other value is off (state "off").
//      MINDRIAN_DECISION_ADVISOR_TABLE points at another table file (test seam).
// Requires only node:fs and node:path so a hook can load it inside its budget.
//
// Phase 400 Plan 09 (CY-05): the room's cause and effect domain. A query may carry
// causeEffect, one of the 5 closed domain ids. When the table key_order holds
// cause_effect, row keys are <job>|<level>|<domain>|<last> and the fallback tries each
// 399 key with the domain first, then without it (8 keys); with no domain it tries the
// 4 domain-free keys of the same shape. A 3-part table keeps the 399 key list. After
// the 399 result is built, ./domain.cjs (lazy, only with a closed domain) reorders inside
// the strong band only; it never changes a band, a value or a top tie. An unknown domain
// (absent, null, or outside the closed set) gives exactly the 399 result.

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

// A frozen copy of lib/core/problem-axes.cjs CAUSE_EFFECT_DOMAINS (Phase 400). Exact match only.
// tests/test-400-advisor-domain.cjs leg A9 pins the copy to the source.
const CAUSE_EFFECT_DOMAINS = Object.freeze(['clear', 'complicated', 'complex', 'chaotic', 'disorder']);

const DEFAULT_TABLE = path.join(__dirname, '..', '..', '..', 'data', 'decision-advisor-table.json');

let cache = null; // { file, mtimeMs, table }

// Opt-in until an independent measurement exists (orchestrator ruling 2026-11-24, after 399-07):
// the v0 table is calibrated on labels from the same model run and lowered selection eval B1/B2.
// Only MINDRIAN_DECISION_ADVISOR=on enables it; unset or any other value is off.
function advisorEnabled() {
  return process.env.MINDRIAN_DECISION_ADVISOR === 'on';
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

function cleanDomain(domain) {
  return typeof domain === 'string' && CAUSE_EFFECT_DOMAINS.indexOf(domain) !== -1 ? domain : null;
}

// Lazy: ./domain.cjs loads only when a closed domain is given (hook load budget). Review WR-08: the
// require is a literal, so every static check (tests/test-399-table.cjs S6, the hook require graph)
// sees the edge. S6 allows exactly this one sibling beside node:fs and node:path, checks that
// domain.cjs itself requires only node:fs and node:path, and times a lookup with a domain.
function domainModule() {
  return require('./domain.cjs');
}

function applyDomainTo(result, domain) {
  if (!domain) return result;
  return domainModule().applyDomain(result, domain);
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
  if (Array.isArray(table.key_order) && table.key_order.indexOf('cause_effect') !== -1) {
    // Phase 400: each 399 key with the domain first, then without it.
    const domain = cleanDomain(q.causeEffect);
    const push4 = (l, c) => {
      if (domain) keys.push(job + '|' + l + '|' + domain + '|' + c);
      keys.push(job + '|' + l + '|*|' + c);
    };
    if (level && last) push4(level, last);
    if (level) push4(level, '*');
    if (last) push4('*', last);
    push4('*', '*');
  } else {
    if (level && last) keys.push(job + '|' + level + '|' + last);
    if (level) keys.push(job + '|' + level + '|*');
    if (last) keys.push(job + '|*|' + last);
    keys.push(job + '|*|*');
  }
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

// lookupShortlist({ jobId, definitionLevel, causeEffect, lastCommand, exclude, k })
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
    return applyDomainTo({
      state: noStrong ? STATES.no_strong_pick : STATES.ok,
      key_used: found.key,
      options,
      no_strong_pick: noStrong,
      top_tie: topTie,
      table_version: table.table_version,
    }, cleanDomain(q.causeEffect));
  } catch (_e) {
    return empty(STATES.no_table, null);
  }
}

// The skip list of a query: the last command and the exclude names.
function skipSet(q) {
  const skip = new Set();
  const last = cleanName(q && q.lastCommand);
  if (last) skip.add(last);
  for (const name of Array.isArray(q && q.exclude) ? q.exclude : []) {
    const n = cleanName(name);
    if (n) skip.add(n);
  }
  return skip;
}

// strongOrder({ jobId, definitionLevel, causeEffect, lastCommand, exclude }): the command names of
// every strong entry of the found row (not only the top k; skip list applied). With a closed domain
// other than chaotic and disorder, a row top that is not a tie, and a lookupShortlist effect of reordered,
// the fit commands of the top k options come first (review WR-09: the same scope as next-move); else row
// order. Null when the advisor is off, or no table or no row is found.
function strongOrder(q) {
  try {
    if (!advisorEnabled()) return null;
    if (!cleanName(q && q.jobId)) return null;
    const table = loadTable();
    if (!table) return null;
    const found = findRow(table, q);
    if (!found) return null;
    const skip = skipSet(q);
    const eligible = found.row.filter((e) => e && !skip.has(e.command));
    const strong = eligible
      .filter((e) => bandFor(e.calibrated, table.thresholds) === 'strong')
      .map((e) => ({ command: e.command, band: 'strong' }));
    const topTie = eligible.length === 0 ? 0 : eligible.filter((e) => e.calibrated === eligible[0].calibrated).length;
    const domain = cleanDomain(q.causeEffect);
    if (!domain || domain === 'chaotic' || domain === 'disorder' || topTie >= 2) return strong.map((e) => e.command);
    // Review WR-09: one scope with lookupShortlist. Only the fit commands of its top k options go first, and only
    // when its effect is reordered; a fit command below rank k keeps its row place, as in next-move.
    const top = lookupShortlist(q);
    const fits = top && top.domain && top.domain.effect === 'reordered' && Array.isArray(top.domain.fits) ? new Set(top.domain.fits) : null;
    if (!fits) return strong.map((e) => e.command);
    return strong.filter((e) => fits.has(e.command)).concat(strong.filter((e) => !fits.has(e.command))).map((e) => e.command);
  } catch (_e) {
    return null;
  }
}

// scoreFor({ jobId, definitionLevel, causeEffect, lastCommand }, command): the calibrated value or null.
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

module.exports = { STATES, DEFINITION_LEVELS, CAUSE_EFFECT_DOMAINS, advisorEnabled, tableMeta, lookupShortlist, scoreFor, strongOrder, bandFor };
