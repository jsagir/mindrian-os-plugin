'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 395 plan 10 (owner rulings 21, 22 and 25 to 28, 2026-11-16): the job statements of each PwS framework, as Theo holds
 * them, shipped as data in data/framework-jobs.json. Ruling 22 allows the job statements (pws_jtbd, pws_jtbd_extra,
 * pws_jtbd_drafts) and their status marks, and no other Theo text. This module composes the file from Theo rows,
 * validates it, and reads it. It never opens a socket and never loads the Brain client.
 *
 * A statement has one of two status marks: ruled (the owner of the method approved it) or draft (a model wrote it and
 * the owner has not confirmed it). Ruling 21: a draft is shown as a draft and does not steer selection. In plan
 * 395-10 no statement, ruled or draft, is read by a sort key, a score, a ledger build or a filter. The one reader is
 * the display field method_job of the suggest_next reply (lib/mcp/tools/sensors.cjs).
 *
 * The validator checks closed allow-lists of keys at every level, so a field of another kind cannot enter the file
 * by mistake. Compose rule (Theo session handoffs, 2026-11-16): pws_jtbd is the ruled main statement; each
 * pws_jtbd_extra item is a ruled extra statement; a draft whose text equals a ruled statement is skipped (batch
 * p49-promote-high-v1 keeps pws_jtbd_drafts[0] equal to the promoted pws_jtbd); every other pws_jtbd_drafts[i] is
 * a draft, and it is the main statement only when i is 0 and pws_jtbd is absent. pws_jtbd_basis, when Theo holds it,
 * is carried on the ruled statements of that node as their basis mark (for example a statement a model drafted and
 * the owner approved by a rule), so the words a user model reads stay true about who wrote the statement. No other
 * provenance key (source path, quote hash, ruled-at time) is carried: no plugin reader needs it.
 *
 * Exam 2 shape (Theo session, 2026-11-16): on a ruled node pws_jtbd_drafts[0] equals pws_jtbd (skipped as above) and
 * the drafts after index 0 are draft extra jobs (main false). pws_jtbd_draft_confidence is one string per node: the
 * confidence of the main draft (index 0) only, so a later draft gets "unknown" unless Theo sends an index-aligned list.
 *
 * pws_backed (owner rulings 26 to 28): Theo marks a statement true when its compiler re-read and hash-checked a quote
 * for it against the PwS material. The marks are 3 Theo keys: pws_jtbd_pws_backed (one boolean for pws_jtbd),
 * pws_jtbd_extra_pws_backed and pws_jtbd_drafts_pws_backed (lists aligned with pws_jtbd_extra and pws_jtbd_drafts).
 * No key means false. Each statement of the file carries one boolean pws_backed; no source path and no quote text.
 * A list that does not line up with its statements is an error (rowMarkErrors), and the refresh then writes nothing.
 * A draft with pws_backed true is still a draft. In plan 395-10 the mark is carried and shown, and it does not steer.
 *
 * No em dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PLUGIN_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_JOBS_PATH = path.join(PLUGIN_ROOT, 'data', 'framework-jobs.json');
const COMMAND_REGISTRY_PATH = path.join(PLUGIN_ROOT, 'data', 'command-registry.json');

const STATUSES = ['ruled', 'draft'];
const CONFIDENCES = ['high', 'medium', 'low', 'unknown'];
const TOP_KEYS = ['snapshot_note', 'snapshot_date', 'source', 'source_sha256', 'counts', 'frameworks'];
const COUNT_KEYS = ['frameworks', 'ruled_main', 'with_extra', 'ruled_extra', 'with_drafts', 'drafts', 'with_basis', 'aliases',
  'ruled_main_pws_backed', 'ruled_extra_pws_backed', 'drafts_pws_backed'];
const ENTRY_KEYS = ['name', 'alias_of', 'jobs'];
const RULED_KEYS = ['main', 'pws_backed', 'status', 'text'];
const RULED_OPTIONAL_KEYS = ['basis'];
const DRAFT_KEYS = ['confidence', 'drafted_by', 'main', 'pws_backed', 'status', 'text'];
// The statement list keys of a Theo row and the pws_backed list key aligned with each (rulings 27 and 28).
const MARK_KEYS = [['pws_jtbd_extra', 'pws_jtbd_extra_pws_backed'], ['pws_jtbd_drafts', 'pws_jtbd_drafts_pws_backed']];
const MAX_TEXT = 600;
const MAX_NAME = 128;
const MAX_LABEL = 120;
const DASHES = String.fromCharCode(0x2013) + String.fromCharCode(0x2014);
const DASH_RE = new RegExp('[' + DASHES + ']');
const DASH_RE_ALL = new RegExp('[' + DASHES + ']', 'g');

// The default note and source of a built file. The refresh script passes its own note, which names its --live run.
const DEFAULT_NOTE =
  'The job statements of each :Framework, read from Theo. Owner ruling 22: only the job statements and their status '
  + 'marks are carried, no other Theo text. Ruling 21: a draft is shown as a draft and does not steer selection.';
const DEFAULT_SOURCE = 'theo brain_query (bucketed, fixed Cypher) via lib/core/brain-client.cjs query';

const RULED_NOTE = 'The job this method serves, as the owner of the method approved it. Shown for reference only; it does not rank the move.';
const RULED_BY_RULE_NOTE = 'The job this method serves. A model drafted it and the owner of the method approved it by a rule, not word by word. '
  + 'Shown for reference only; it does not rank the move.';
const DRAFT_NOTE = 'Draft: a model wrote this job statement and the owner of the method has not confirmed it yet. '
  + 'Say that it is a draft; do not present it as the method\'s own statement. It does not rank the move.';
// Shown only when pws_backed is true (rulings 27 and 28). When it is false the reply makes no claim about backing.
const BACKED_NOTE = 'Backed by the PwS material: Theo checked a quote for this statement word for word against its source '
  + '(the PwS course and its curated notes, or Theo\'s own text on this method). This does not make a draft final.';

function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function cleanText(v) {
  if (typeof v !== 'string') return '';
  return v.replace(DASH_RE_ALL, '-').replace(/\s+/g, ' ').trim();
}
function listOf(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v.trim()) return [v];
  return [];
}
function at(v, i) { return Array.isArray(v) ? v[i] : v; }
// marksOf(v) -- a pws_backed value of a Theo row as a list: absent gives [], one boolean gives [it], a list gives
// itself, any other value gives null (an error for rowMarkErrors).
function marksOf(v) {
  if (v === undefined || v === null) return [];
  if (typeof v === 'boolean') return [v];
  return Array.isArray(v) ? v : null;
}
function sameKeys(obj, keys) {
  const have = Object.keys(obj).sort();
  const want = keys.slice().sort();
  return have.length === want.length && have.every((k, i) => k === want[i]);
}

// ---------------------------------------------------------------------------
// composeEntry(row) -- one Theo row to { name, alias_of?, jobs }. Reads only the name, the alias link and the
// statement keys of the row; every other key of the row is ignored. Returns null for a row with no usable name.
// ---------------------------------------------------------------------------
function composeEntry(row) {
  if (!isObj(row) || typeof row.name !== 'string') return null;
  const name = row.name.trim();
  if (name.length < 1 || name.length > MAX_NAME) return null;
  const jobs = [];
  const seen = new Set();
  function push(job) {
    if (!job.text || seen.has(job.text)) return;
    seen.add(job.text);
    jobs.push(job);
  }
  const basis = cleanText(row.pws_jtbd_basis);
  const ruledJob = (text, main, backed) => (basis ? { text, status: 'ruled', main, pws_backed: backed, basis } : { text, status: 'ruled', main, pws_backed: backed });
  const ruled = cleanText(row.pws_jtbd);
  if (ruled) push(ruledJob(ruled, true, row.pws_jtbd_pws_backed === true));
  // Each mark is read at the index of its own statement in the Theo list (rulings 27 and 28). No mark means false.
  const extraMarks = marksOf(row.pws_jtbd_extra_pws_backed) || [];
  listOf(row.pws_jtbd_extra).forEach((x, i) => {
    const t = cleanText(x);
    if (t) push(ruledJob(t, false, extraMarks[i] === true));
  });
  const draftMarks = marksOf(row.pws_jtbd_drafts_pws_backed) || [];
  const confidencePerNode = !Array.isArray(row.pws_jtbd_draft_confidence);
  listOf(row.pws_jtbd_drafts).forEach((x, i) => {
    const t = cleanText(x);
    if (!t) return;
    // One confidence string per node is the confidence of the main draft (index 0) only (exam 2 shape).
    const confidence = confidencePerNode && i > 0 ? '' : cleanText(at(row.pws_jtbd_draft_confidence, i)).toLowerCase();
    const draftedBy = cleanText(at(row.pws_jtbd_draft_by, i));
    push({ text: t, status: 'draft', main: i === 0 && !ruled, pws_backed: draftMarks[i] === true, confidence: confidence || 'unknown', drafted_by: draftedBy || 'not recorded' });
  });
  const alias = cleanText(row.alias_of);
  const entry = { name };
  if (alias && alias !== name) entry.alias_of = alias;
  entry.jobs = jobs;
  return entry;
}

function countsOf(frameworks) {
  const c = { frameworks: 0, ruled_main: 0, with_extra: 0, ruled_extra: 0, with_drafts: 0, drafts: 0, with_basis: 0, aliases: 0,
    ruled_main_pws_backed: 0, ruled_extra_pws_backed: 0, drafts_pws_backed: 0 };
  const backed = (list) => list.filter((j) => j.pws_backed === true).length;
  for (const e of frameworks) {
    const jobs = Array.isArray(e && e.jobs) ? e.jobs.filter((j) => isObj(j)) : [];
    if (jobs.length > 0) c.frameworks += 1;
    const main = jobs.filter((j) => j.status === 'ruled' && j.main === true);
    if (main.length > 0) c.ruled_main += 1;
    c.ruled_main_pws_backed += main.length > 0 && main[0].pws_backed === true ? 1 : 0;
    const extras = jobs.filter((j) => j.status === 'ruled' && j.main !== true);
    if (extras.length > 0) c.with_extra += 1;
    c.ruled_extra += extras.length;
    c.ruled_extra_pws_backed += backed(extras);
    const drafts = jobs.filter((j) => j.status === 'draft');
    if (drafts.length > 0) c.with_drafts += 1;
    c.drafts += drafts.length;
    c.drafts_pws_backed += backed(drafts);
    if (jobs.some((j) => typeof j.basis === 'string')) c.with_basis += 1;
    if (e && typeof e.alias_of === 'string') c.aliases += 1;
  }
  return c;
}

// ---------------------------------------------------------------------------
// rowMarkErrors(rows) -- rulings 27 and 28. pws_jtbd_pws_backed must be absent or a boolean. Each pws_backed list
// must be absent, empty (the fixed read gives [] for an absent key), or hold one boolean for each item of its
// statement list, in the same order. Returns a list of errors that name the framework only, never a statement
// text. The refresh writes nothing when the list is not empty (exit 4): a misaligned mark is never read as false.
// ---------------------------------------------------------------------------
function rowMarkErrors(rows) {
  const errors = [];
  (Array.isArray(rows) ? rows : []).forEach((row, i) => {
    if (!isObj(row)) return;
    const who = typeof row.name === 'string' ? row.name : 'row ' + i;
    const one = row.pws_jtbd_pws_backed;
    if (one !== undefined && one !== null && typeof one !== 'boolean') errors.push(who + ': pws_jtbd_pws_backed is not a boolean');
    MARK_KEYS.forEach((pair) => {
      const marks = marksOf(row[pair[1]]);
      if (marks === null) {
        errors.push(who + ': ' + pair[1] + ' is not a list');
        return;
      }
      if (marks.length === 0) return;
      const n = listOf(row[pair[0]]).length;
      if (marks.length !== n) errors.push(who + ': ' + pair[1] + ' has ' + marks.length + ' marks for ' + n + ' statements');
      else if (marks.some((m) => typeof m !== 'boolean')) errors.push(who + ': ' + pair[1] + ' holds a value that is not a boolean');
    });
  });
  return errors;
}

// jobsSha256(frameworks) -- sha256 hex of JSON.stringify(frameworks), in the order given (the file keeps it sorted).
function jobsSha256(frameworks) {
  return crypto.createHash('sha256').update(JSON.stringify(Array.isArray(frameworks) ? frameworks : [])).digest('hex');
}

// ---------------------------------------------------------------------------
// buildJobsSnapshot({ rows, date, note?, source? }) -- pure. Two rows with one name become one entry (the statements of both, the
// first alias link). An entry with no statement is kept only when it carries an alias link.
// ---------------------------------------------------------------------------
function buildJobsSnapshot(opts) {
  const o = isObj(opts) ? opts : {};
  const rows = Array.isArray(o.rows) ? o.rows : [];
  const date = typeof o.date === 'string' && o.date ? o.date : new Date().toISOString().slice(0, 10);
  const byName = new Map();
  for (const row of rows) {
    const e = composeEntry(row);
    if (!e) continue;
    const prev = byName.get(e.name);
    if (!prev) {
      byName.set(e.name, e);
      continue;
    }
    const texts = new Set(prev.jobs.map((j) => j.text));
    e.jobs.forEach((j) => {
      if (!texts.has(j.text)) {
        texts.add(j.text);
        prev.jobs.push(j);
      }
    });
    if (!prev.alias_of && e.alias_of) byName.set(e.name, { name: prev.name, alias_of: e.alias_of, jobs: prev.jobs });
  }
  const frameworks = Array.from(byName.values())
    .filter((e) => e.jobs.length > 0 || typeof e.alias_of === 'string')
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    snapshot_note: typeof o.note === 'string' && o.note ? o.note : DEFAULT_NOTE,
    snapshot_date: date,
    source: typeof o.source === 'string' && o.source ? o.source : DEFAULT_SOURCE,
    source_sha256: jobsSha256(frameworks),
    counts: countsOf(frameworks),
    frameworks,
  };
}

// ---------------------------------------------------------------------------
// validateJobsSnapshot(snapshot) -- offline. Shape, closed key lists, closed status and confidence sets, sort order,
// unique names, no dash character, hash and counts. Returns { valid, errors }.
// ---------------------------------------------------------------------------
function validateJobsSnapshot(snapshot) {
  const errors = [];
  if (!isObj(snapshot)) return { valid: false, errors: ['jobs snapshot is not an object'] };
  if (!sameKeys(snapshot, TOP_KEYS)) errors.push('jobs snapshot top-level keys must be exactly ' + TOP_KEYS.join(', ') + '; got ' + Object.keys(snapshot).join(', '));
  ['snapshot_note', 'snapshot_date', 'source', 'source_sha256'].forEach((k) => {
    if (typeof snapshot[k] !== 'string' || snapshot[k].length === 0) errors.push(k + ' must be a non-empty string');
  });
  let serialized = '';
  try { serialized = JSON.stringify(snapshot); } catch (_e) { serialized = ''; }
  if (DASH_RE.test(serialized)) errors.push('jobs snapshot contains an em dash or an en dash');
  const fws = Array.isArray(snapshot.frameworks) ? snapshot.frameworks : null;
  if (!fws) {
    errors.push('frameworks is not an array');
    return { valid: false, errors };
  }
  const seen = new Set();
  for (let i = 0; i < fws.length; i++) {
    const e = fws[i];
    const where = 'frameworks[' + i + ']';
    if (!isObj(e)) { errors.push(where + ' is not an object'); continue; }
    const extra = Object.keys(e).filter((k) => ENTRY_KEYS.indexOf(k) === -1);
    if (extra.length > 0) errors.push(where + ' has a key outside the allowed list: ' + extra.join(', '));
    if (typeof e.name !== 'string' || e.name.length < 1 || e.name.length > MAX_NAME) errors.push(where + ' has an invalid name');
    else {
      if (seen.has(e.name)) errors.push('frameworks has a duplicate name: ' + e.name);
      seen.add(e.name);
      if (i > 0 && isObj(fws[i - 1]) && typeof fws[i - 1].name === 'string' && fws[i - 1].name.localeCompare(e.name) > 0) errors.push('frameworks is not sorted at ' + where);
    }
    if (Object.prototype.hasOwnProperty.call(e, 'alias_of')) {
      if (typeof e.alias_of !== 'string' || e.alias_of.length < 1 || e.alias_of.length > MAX_NAME || e.alias_of === e.name) errors.push(where + ' has an invalid alias_of');
    }
    if (!Array.isArray(e.jobs)) { errors.push(where + '.jobs is not an array'); continue; }
    if (e.jobs.length === 0 && typeof e.alias_of !== 'string') errors.push(where + ' has no statement and no alias_of');
    e.jobs.forEach((j, k) => {
      const jw = where + '.jobs[' + k + ']';
      if (!isObj(j)) { errors.push(jw + ' is not an object'); return; }
      if (STATUSES.indexOf(j.status) === -1) { errors.push(jw + ' has a status outside ' + STATUSES.join(', ')); return; }
      const required = j.status === 'ruled' ? RULED_KEYS : DRAFT_KEYS;
      const optional = j.status === 'ruled' ? RULED_OPTIONAL_KEYS : [];
      if (!sameKeys(j, required.concat(optional.filter((k) => Object.prototype.hasOwnProperty.call(j, k))))) errors.push(jw + ' keys must be ' + required.join(', ') + (optional.length ? ' (optional: ' + optional.join(', ') + ')' : ''));
      if (Object.prototype.hasOwnProperty.call(j, 'basis') && (typeof j.basis !== 'string' || j.basis.length < 1 || j.basis.length > MAX_LABEL)) errors.push(jw + ' has an invalid basis');
      if (typeof j.text !== 'string' || j.text.length < 1 || j.text.length > MAX_TEXT) errors.push(jw + ' has an invalid text');
      if (typeof j.main !== 'boolean') errors.push(jw + '.main must be a boolean');
      if (typeof j.pws_backed !== 'boolean') errors.push(jw + '.pws_backed must be a boolean');
      if (j.status === 'draft') {
        if (CONFIDENCES.indexOf(j.confidence) === -1) errors.push(jw + ' has a confidence outside ' + CONFIDENCES.join(', '));
        if (typeof j.drafted_by !== 'string' || j.drafted_by.length < 1 || j.drafted_by.length > MAX_LABEL) errors.push(jw + ' has an invalid drafted_by');
      }
    });
  }
  if (snapshot.source_sha256 !== jobsSha256(fws)) errors.push('jobs source_sha256 mismatch: got ' + snapshot.source_sha256 + ', expected ' + jobsSha256(fws));
  const want = countsOf(fws);
  if (!isObj(snapshot.counts) || !sameKeys(snapshot.counts, COUNT_KEYS) || COUNT_KEYS.some((k) => snapshot.counts[k] !== want[k])) {
    errors.push('counts must equal ' + JSON.stringify(want) + '; got ' + JSON.stringify(snapshot.counts));
  }
  return { valid: errors.length === 0, errors };
}

// ---- reader ---------------------------------------------------------------------------------------------------------

let jobsPathOverride = null;
let docCache = { path: null, doc: null, map: null };
let registryCache = null;

// setJobsPath(p) -- a test seam: read the jobs file from p (null restores the shipped file). Clears the cache.
function setJobsPath(p) {
  jobsPathOverride = typeof p === 'string' && p ? p : null;
  docCache = { path: null, doc: null, map: null };
}

function readJobsDoc() {
  const p = jobsPathOverride || DEFAULT_JOBS_PATH;
  if (docCache.path === p) return docCache;
  let doc = null;
  try { doc = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_e) { doc = null; }
  if (doc && validateJobsSnapshot(doc).valid !== true) doc = null;
  const map = new Map();
  if (doc) doc.frameworks.forEach((e) => map.set(e.name, e));
  docCache = { path: p, doc, map };
  return docCache;
}

/**
 * jobsFor(name) -- the job statements of one framework, read from the shipped file. An entry with no statement of its
 * own and an alias link is read through that link (one step only). Returns null when the file is absent or invalid,
 * or the name is not in it.
 * @returns {{ name, via_alias: string|null, ruled_main: string|null, ruled_main_pws_backed: boolean, ruled_basis: string|null, ruled_extra: string[], ruled_extra_pws_backed: boolean[], drafts: Array<{text, main, pws_backed, confidence, drafted_by}> }|null}
 */
function jobsFor(name) {
  if (typeof name !== 'string' || !name.trim()) return null;
  const c = readJobsDoc();
  if (!c.doc) return null;
  const asked = name.trim();
  let e = c.map.get(asked);
  if (!e) return null;
  let via = null;
  if (e.jobs.length === 0 && typeof e.alias_of === 'string') {
    via = e.alias_of;
    e = c.map.get(e.alias_of) || { jobs: [] };
  }
  const ruledMain = e.jobs.find((j) => j.status === 'ruled' && j.main === true) || null;
  const extras = e.jobs.filter((j) => j.status === 'ruled' && j.main !== true);
  return {
    name: asked,
    via_alias: via,
    ruled_main: ruledMain ? ruledMain.text : null,
    ruled_main_pws_backed: !!ruledMain && ruledMain.pws_backed === true,
    ruled_basis: ruledMain && typeof ruledMain.basis === 'string' ? ruledMain.basis : null,
    ruled_extra: extras.map((j) => j.text),
    ruled_extra_pws_backed: extras.map((j) => j.pws_backed === true),
    drafts: e.jobs.filter((j) => j.status === 'draft').map((j) => ({ text: j.text, main: j.main, pws_backed: j.pws_backed === true, confidence: j.confidence, drafted_by: j.drafted_by })),
  };
}

function frameworksOfCommand(command) {
  if (!registryCache) {
    registryCache = new Map();
    let doc = null;
    try { doc = JSON.parse(fs.readFileSync(COMMAND_REGISTRY_PATH, 'utf8')); } catch (_e) { doc = null; }
    (doc && Array.isArray(doc.commands) ? doc.commands : []).forEach((c) => {
      if (c && typeof c.command === 'string' && Array.isArray(c.frameworks)) registryCache.set(c.command.replace(/^\/mos:/, ''), c.frameworks.filter((f) => typeof f === 'string'));
    });
  }
  return registryCache.get(String(command).replace(/^\/mos:/, '')) || [];
}

/**
 * methodJobForCommand(command) -- the one job statement shown beside a proposed command: the ruled main statement of
 * the first framework of the command (data/command-registry.json order) that has one, else the main draft of the
 * first framework that has a draft. Display only. A ruled statement with a basis mark that names a model keeps the
 * mark and says that a model drafted it. A statement with pws_backed true also carries pws_backed and the backing
 * sentence; a statement with pws_backed false carries neither (no claim). Returns null when there is none.
 * @returns {{ framework, alias_of?, statement, status: 'ruled'|'draft', basis?, confidence?, note, pws_backed?: true, backing? }|null}
 */
function methodJobForCommand(command) {
  if (typeof command !== 'string' || !command) return null;
  if (!readJobsDoc().doc) return null;
  const found = frameworksOfCommand(command).map((fw) => ({ fw, j: jobsFor(fw) })).filter((x) => x.j);
  const head = (x) => (x.j.via_alias ? { framework: x.fw, alias_of: x.j.via_alias } : { framework: x.fw });
  const backing = (isBacked) => (isBacked === true ? { pws_backed: true, backing: BACKED_NOTE } : {});
  const ruled = found.find((x) => x.j.ruled_main);
  if (ruled) {
    const b = ruled.j.ruled_basis;
    if (b) return Object.assign(head(ruled), { statement: ruled.j.ruled_main, status: 'ruled', basis: b, note: /model/i.test(b) ? RULED_BY_RULE_NOTE : RULED_NOTE }, backing(ruled.j.ruled_main_pws_backed));
    return Object.assign(head(ruled), { statement: ruled.j.ruled_main, status: 'ruled', note: RULED_NOTE }, backing(ruled.j.ruled_main_pws_backed));
  }
  const drafted = found.find((x) => x.j.drafts.length > 0);
  if (drafted) {
    const d = drafted.j.drafts.find((x) => x.main) || drafted.j.drafts[0];
    return Object.assign(head(drafted), { statement: d.text, status: 'draft', confidence: d.confidence, note: DRAFT_NOTE }, backing(d.pws_backed));
  }
  return null;
}

module.exports = {
  DEFAULT_JOBS_PATH,
  STATUSES,
  CONFIDENCES,
  RULED_NOTE,
  RULED_BY_RULE_NOTE,
  DRAFT_NOTE,
  BACKED_NOTE,
  composeEntry,
  rowMarkErrors,
  countsOf,
  jobsSha256,
  buildJobsSnapshot,
  validateJobsSnapshot,
  setJobsPath,
  jobsFor,
  methodJobForCommand,
};
