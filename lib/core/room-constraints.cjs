'use strict';

/*
 * lib/core/room-constraints.cjs
 *
 * Phase 365 B3 (D-09..D-15, Canon Parts 3, 8, 9): the room's "never do this"
 * list. One pure, fail-shut core module that both unattended runners (chain_run
 * and the ambient research runner) and both approval doors call.
 *
 * What it is: a small list, kept at <room>/.mindrian/never-do.json, of things an
 * unattended step must never do (run a command, file into a section, write under
 * a path, query a provider, search a term). A person names each item and approves
 * it; the runners stop before a step that matches one.
 *
 * Why it differs from lib/core/irreversibility-ledger.cjs ON PURPOSE:
 *   - The ledger fails OPEN (a build error means "no halt") and caches per
 *     process. This list fails SHUT: a missing file is an empty list, but a file
 *     that is present and unreadable, mis-shaped or hand-damaged halts every
 *     unattended check, because a damaged "never" list that waves steps through
 *     is worse than no list.
 *   - Every call reads the file fresh. There is no module-level cache, so a
 *     person's edit takes effect on the next step, not the next process.
 *
 * Matching (D-11) is deterministic over the fields a step already declares:
 * command, section and provider byte-exact; term after the same trim-and-lowercase
 * the research planner applies to grant terms; path by whole-segment prefix on
 * normalized POSIX paths. The `why` sentence is shown to a person, never matched.
 * No model judges a match.
 *
 * Trips (D-12): every halt appends one JSON line to .mindrian/constraint-trips.jsonl
 * carrying ids, enums and the matched literal only, never the `why` (Part 8).
 *
 * The list catches only what has been named (D-15). It is a floor, not a
 * guarantee; FLOOR_SENTENCE says so wherever the list is shown.
 *
 * Module rules: CJS, Node built-ins only (fs, path), zero network, no model call,
 * no room.db access (the decision node for an approval is minted by the caller).
 * Hyphens only.
 */

const fs = require('fs');
const path = require('path');

const SCHEMA = 'mos.room-constraints/1';
const TRIP_SCHEMA = 'mos.constraint-trip/1';
const FILE_REL = '.mindrian/never-do.json';
const TRIPS_REL = '.mindrian/constraint-trips.jsonl';
const KINDS = Object.freeze(new Set(['command', 'section', 'path', 'provider', 'term']));
const FLOOR_SENTENCE = 'This list catches only what has been named. It is a floor, not a guarantee.';

const MAX_VALUE = 200;
const MAX_WHY = 300;

// Specificity order used to pre-fill a proposal (D-14).
const SPECIFICITY = ['path', 'term', 'section', 'provider', 'command'];
const VERB = {
  path: 'write to',
  section: 'file into',
  term: 'search for',
  provider: 'query',
  command: 'run',
};

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------
function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function nonEmpty(v) { return typeof v === 'string' && v.trim().length > 0; }
const DASH_RE = new RegExp('[' + String.fromCharCode(0x2014) + String.fromCharCode(0x2013) + ']', 'g');
function noDash(s) { return String(s).replace(DASH_RE, '-'); }
function normTerm(t) { return String(t).trim().toLowerCase(); }

function filePath(roomDir) { return path.join(roomDir, '.mindrian', 'never-do.json'); }
function tripsPath(roomDir) { return path.join(roomDir, '.mindrian', 'constraint-trips.jsonl'); }

function isApprovedVia(v) {
  return isObj(v) && (v.surface === 'cli' || v.surface === 'mcp') &&
    typeof v.decision_node_id === 'string' && v.decision_node_id.length > 0;
}

// normalizePath(p) -> normalized POSIX string, or '' when the input is not a
// usable relative path. Used on both the declared field and the entry value.
function normalizePath(p) {
  if (typeof p !== 'string') return '';
  const raw = p.trim();
  if (raw.length === 0) return '';
  let s = raw.replace(/\\/g, '/');
  s = path.posix.normalize(s);
  while (s.indexOf('./') === 0) s = s.slice(2);
  if (s.length > 1 && s.charAt(s.length - 1) === '/') s = s.slice(0, -1);
  if (s === '.') return '';
  return s;
}

// A path ENTRY is stricter than a declared field: relative, no drive letter, no
// backslash, no `..` segment (T-365-10).
function pathEntryProblem(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return 'empty';
  const v = value.trim();
  if (v.charAt(0) === '/') return 'absolute';
  if (/^[A-Za-z]:/.test(v)) return 'drive';
  if (v.indexOf('\\') !== -1) return 'backslash';
  if (v.split('/').indexOf('..') !== -1) return 'dotdot';
  if (normalizePath(v) === '') return 'empty';
  return null;
}

function validateEntry(e) {
  if (!isObj(e)) return false;
  if (typeof e.kind !== 'string' || !KINDS.has(e.kind)) return false;
  if (!nonEmpty(e.value) || e.value.length > MAX_VALUE) return false;
  if (!nonEmpty(e.why) || e.why.length > MAX_WHY) return false;
  if (!isApprovedVia(e.approved_via)) return false;
  if (e.kind === 'path' && pathEntryProblem(e.value) !== null) return false;
  return true;
}

// ---------------------------------------------------------------------------
// readNeverDo(roomDir) -> {ok:true, entries} | {ok:false, reason, index?}
// Fresh read on every call. Missing file is an empty list; anything else wrong
// makes the whole file malformed (D-13).
// ---------------------------------------------------------------------------
function readNeverDo(roomDir) {
  const file = filePath(roomDir);
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    if (e && e.code === 'ENOENT') return { ok: true, entries: [] };
    return { ok: false, reason: 'malformed' };
  }
  let parsed;
  try { parsed = JSON.parse(raw); } catch (_e) { return { ok: false, reason: 'malformed' }; }
  if (!isObj(parsed) || parsed.schema !== SCHEMA || !Array.isArray(parsed.entries)) {
    return { ok: false, reason: 'wrong_schema' };
  }
  for (let i = 0; i < parsed.entries.length; i++) {
    if (!validateEntry(parsed.entries[i])) return { ok: false, reason: 'invalid_entry', index: i };
  }
  return { ok: true, entries: parsed.entries.map(function (e) {
    return {
      kind: e.kind,
      value: e.value,
      why: e.why,
      approved_via: { surface: e.approved_via.surface, decision_node_id: e.approved_via.decision_node_id },
      approved_at: typeof e.approved_at === 'string' ? e.approved_at : null,
    };
  }) };
}

// ---------------------------------------------------------------------------
// matchFields(entries, fields) -> the first matching entry or null.
// fields: {command, section, path, provider, term}; provider and term may be a
// string or an array of strings. Only declared fields are compared.
// ---------------------------------------------------------------------------
function asList(v) {
  if (Array.isArray(v)) return v.filter(function (x) { return typeof x === 'string'; });
  return typeof v === 'string' ? [v] : [];
}

function pathMatches(entryValue, fieldValue) {
  const e = normalizePath(entryValue);
  const f = normalizePath(fieldValue);
  if (e === '' || f === '') return false;
  return f === e || f.indexOf(e + '/') === 0;
}

function entryMatches(entry, fields) {
  const f = isObj(fields) ? fields : {};
  switch (entry.kind) {
    case 'command': return asList(f.command).indexOf(entry.value) !== -1;
    case 'section': return asList(f.section).indexOf(entry.value) !== -1;
    case 'provider': return asList(f.provider).indexOf(entry.value) !== -1;
    case 'term': {
      const want = normTerm(entry.value);
      return asList(f.term).some(function (t) { return normTerm(t) === want; });
    }
    case 'path': return asList(f.path).some(function (p) { return pathMatches(entry.value, p); });
    default: return false;
  }
}

function matchFields(entries, fields) {
  const list = Array.isArray(entries) ? entries : [];
  for (let i = 0; i < list.length; i++) {
    if (entryMatches(list[i], fields)) return list[i];
  }
  return null;
}

// ---------------------------------------------------------------------------
// checkStep(roomDir, fields) -> {halt:false} | {halt:true, reason, ...}
// A malformed file never returns halt:false (D-13).
// ---------------------------------------------------------------------------
function checkStep(roomDir, fields) {
  const r = readNeverDo(roomDir);
  if (!r.ok) {
    const detail = r.reason + (typeof r.index === 'number' ? ' at entry ' + r.index : '');
    return { halt: true, reason: 'constraints_malformed', detail: detail };
  }
  const hit = matchFields(r.entries, fields);
  if (!hit) return { halt: false };
  return { halt: true, reason: 'constraint_named', entry: { kind: hit.kind, value: hit.value, why: hit.why } };
}

// ---------------------------------------------------------------------------
// Declared-field extractors.
// ---------------------------------------------------------------------------
// CR-01 (365 review). The section a chain step files into. chain_run has no
// section input (its schema is pinned for Theo parity), so on a real run there is
// no ctx.targetSection; the step's own registry-declared `produces`
// ("room/<section>/<artifact>/*") is the honest source. A glob in the section
// position ("room/**", "room/*") names no single section and yields null.
let _registryProduces = null;
function registryProducesOf(command) {
  if (_registryProduces === null) {
    _registryProduces = new Map();
    try {
      const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'command-registry.json'), 'utf8'));
      (Array.isArray(reg.commands) ? reg.commands : []).forEach(function (e) {
        if (isObj(e) && nonEmpty(e.command) && nonEmpty(e.produces)) _registryProduces.set(e.command, e.produces);
      });
    } catch (_e) { /* an unreadable registry declares no section */ }
  }
  return _registryProduces.get(command) || null;
}

function sectionOfProduces(produces) {
  if (!nonEmpty(produces)) return null;
  const m = /^room\/([A-Za-z0-9][A-Za-z0-9_-]*)\//.exec(normalizePath(produces) + '/');
  return m ? m[1] : null;
}

function declaredFieldsOfChainStep(step, ctx) {
  const s = isObj(step) ? step : {};
  const c = isObj(ctx) ? ctx : {};
  let produces = null;
  try {
    const dispatcher = require('./chain-step-dispatcher.cjs');
    const ex = dispatcher.resolveExecutable(s.command);
    if (ex && typeof ex.produces === 'string' && ex.produces.length > 0) produces = ex.produces;
  } catch (_e) { produces = null; }
  return {
    command: nonEmpty(s.command) ? s.command : null,
    section: nonEmpty(c.targetSection) ? c.targetSection : sectionOfProduces(registryProducesOf(s.command)),
    path: produces,
    provider: null,
    term: null,
  };
}

function declaredFieldsOfAmbientPlan(qs, plan, zoneTerm, grant) {
  const q = isObj(qs) ? qs : {};
  const p = isObj(plan) ? plan : {};
  const providers = [];
  (Array.isArray(q.leaves) ? q.leaves : []).forEach(function (leaf) {
    if (!isObj(leaf) || leaf.researchable !== true || !nonEmpty(leaf.corpus)) return;
    if (providers.indexOf(leaf.corpus) === -1) providers.push(leaf.corpus);
  });
  const terms = [];
  const zone = nonEmpty(zoneTerm) ? zoneTerm.trim() : '';
  if (zone) {
    terms.push(zone);
    const approved = isObj(grant) && Array.isArray(grant.approved_terms) ? grant.approved_terms : [];
    approved.forEach(function (e) {
      if (!isObj(e) || !nonEmpty(e.term) || normTerm(e.term) !== normTerm(zone)) return;
      (Array.isArray(e.synonyms) ? e.synonyms : []).filter(nonEmpty).forEach(function (syn) {
        const t = syn.trim();
        if (terms.indexOf(t) === -1) terms.push(t);
      });
    });
  }
  const rt = isObj(p.return_target) ? p.return_target : {};
  return {
    command: nonEmpty(q.command) ? q.command : null,
    section: nonEmpty(rt.section) ? rt.section : null,
    path: null,
    provider: providers,
    term: terms,
  };
}

// ---------------------------------------------------------------------------
// recordTrip(roomDir, trip) -> {ok}. Never throws. One JSON line per call; ids,
// enums and the matched literal only. The `why` is never copied in (Part 8).
// ---------------------------------------------------------------------------
function recordTrip(roomDir, trip) {
  try {
    const t = isObj(trip) ? trip : {};
    const line = {
      schema: TRIP_SCHEMA,
      at: new Date().toISOString(),
      surface: typeof t.surface === 'string' ? t.surface : null,
      reason: typeof t.reason === 'string' ? t.reason : null,
      kind: typeof t.kind === 'string' ? t.kind : null,
      value: typeof t.value === 'string' ? t.value : null,
      step_command: typeof t.step_command === 'string' ? t.step_command : null,
      run_id: typeof t.run_id === 'string' ? t.run_id : null,
    };
    fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
    fs.appendFileSync(tripsPath(roomDir), JSON.stringify(line) + '\n', 'utf8');
    return { ok: true };
  } catch (_e) {
    return { ok: false };
  }
}

// ---------------------------------------------------------------------------
// proposalFromFields(fields, opts) -> {kind, value, why, alternatives} | null.
// Pre-fills one proposed entry from the most specific declared field (D-14).
// opts.surface names where the halt happened (default 'unattended').
// ---------------------------------------------------------------------------
function firstValue(v) {
  const l = asList(v).filter(function (x) { return x.trim().length > 0 && x.length <= MAX_VALUE; });
  return l.length > 0 ? l[0].trim() : null;
}

function proposalFromFields(fields, opts) {
  const f = isObj(fields) ? fields : {};
  const surface = opts && nonEmpty(opts.surface) ? opts.surface.trim() : 'unattended';
  const picks = [];
  SPECIFICITY.forEach(function (kind) {
    const v = firstValue(f[kind]);
    if (v === null) return;
    if (kind === 'path' && pathEntryProblem(v) !== null) return;
    picks.push({ kind: kind, value: v });
  });
  if (picks.length === 0) return null;
  const top = picks[0];
  const why = noDash('Never let an unattended ' + surface + ' step ' + VERB[top.kind] + ' ' + top.value + '.');
  return {
    kind: top.kind,
    value: top.value,
    why: why.length > MAX_WHY ? why.slice(0, MAX_WHY) : why,
    alternatives: picks.slice(1, 3),
  };
}

// ---------------------------------------------------------------------------
// writeNeverDoEntry(roomDir, entry, opts) -> {ok, entry?, duplicate?} | {ok:false, reason}
// The only writer. Refuses without an approval trail (the grants.writeGrant rule).
// ---------------------------------------------------------------------------
function atomicWrite(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp-' + process.pid + '-' + Date.now();
  try {
    fs.writeFileSync(tmp, noDash(JSON.stringify(data, null, 2)) + '\n', 'utf8');
    fs.renameSync(tmp, file);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch (_e) { /* best effort */ }
    throw e;
  }
}

function writeNeverDoEntry(roomDir, entry, opts) {
  const via = opts && opts.approved_via;
  if (!isApprovedVia(via)) return { ok: false, reason: 'approval_required' };
  const e = isObj(entry) ? entry : {};
  if (typeof e.kind !== 'string' || !KINDS.has(e.kind)) return { ok: false, reason: 'invalid_kind' };
  if (!nonEmpty(e.value) || e.value.length > MAX_VALUE) return { ok: false, reason: 'invalid_value' };
  if (e.kind === 'path' && pathEntryProblem(e.value) !== null) return { ok: false, reason: 'invalid_path' };
  const why = nonEmpty(e.why) ? noDash(e.why.trim()) : '';
  if (why.length === 0 || why.length > MAX_WHY) return { ok: false, reason: 'invalid_why' };

  const cur = readNeverDo(roomDir);
  if (!cur.ok) return { ok: false, reason: 'existing_file_malformed' };

  const value = e.kind === 'path' ? normalizePath(e.value) : e.value.trim();
  const dupe = cur.entries.some(function (x) {
    if (x.kind !== e.kind) return false;
    return e.kind === 'term' ? normTerm(x.value) === normTerm(value) : x.value === value;
  });
  if (dupe) return { ok: true, duplicate: true };

  const stored = {
    kind: e.kind,
    value: value,
    why: why,
    approved_via: { surface: via.surface, decision_node_id: via.decision_node_id },
    approved_at: new Date().toISOString(),
  };
  try {
    atomicWrite(filePath(roomDir), { schema: SCHEMA, entries: cur.entries.concat([stored]) });
  } catch (_e) {
    return { ok: false, reason: 'write_failed' };
  }
  return { ok: true, entry: stored };
}

// ---------------------------------------------------------------------------
// listSummary(roomDir) -> {ok, count, malformed} for status surfaces.
// ---------------------------------------------------------------------------
function listSummary(roomDir) {
  const r = readNeverDo(roomDir);
  if (!r.ok) return { ok: false, count: 0, malformed: r.reason };
  return { ok: true, count: r.entries.length, malformed: null };
}

module.exports = {
  SCHEMA,
  KINDS,
  FILE_REL,
  TRIPS_REL,
  FLOOR_SENTENCE,
  readNeverDo,
  normalizePath,
  matchFields,
  checkStep,
  declaredFieldsOfChainStep,
  declaredFieldsOfAmbientPlan,
  recordTrip,
  proposalFromFields,
  writeNeverDoEntry,
  listSummary,
};
