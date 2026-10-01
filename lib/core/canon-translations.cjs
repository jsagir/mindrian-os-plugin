'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * lib/core/canon-translations.cjs - the room's canon translation table
 * (Phase 366-05; D-13, D-14).
 *
 * A room may call a canon framework by its own word ("Bottleneck Hunt" for
 * "Reverse Salient Analysis"). The table that maps one to the other lives at
 * <room>/references/canon-translations.md: a markdown file whose leading YAML
 * frontmatter block holds a `translations:` list of rows
 * { term, canon_name, ratified_at }. Strings are written JSON-quoted (valid
 * YAML) so this zero-dependency parser reads exactly what the writer wrote.
 *
 * Rules:
 *   - A proposed row carries ratified_at: null and is NEVER used by the
 *     resolver; only the navigator ratifies (ratifyRow sets an ISO date).
 *   - Exact match only. No case folding, no approximate scoring, no guessing.
 *   - The resolver (verification-stamp.cjs resolveEndpoint) additionally
 *     requires canon_name to still be in data/framework-names.json, so a stale
 *     or forged row resolves nothing (T-366-17).
 *   - Containment (T-366-16): the table is read and written only when its
 *     realpath sits in the room's own `references` directory under the room
 *     realpath. A `references/` symlink escaping the room reads as empty and
 *     refuses writes.
 *
 * Canon Part 8: this file never leaves the machine. Nothing here touches the
 * network, Theo or the Brain; the table is room content and stays local.
 *
 * Fresh read on every call, no module cache: the navigator edits the file by
 * hand or through ratifyRow, and every caller must see the current rows
 * without a process restart (same reasoning as loadFrameworkNames).
 */
const fs = require('node:fs');
const path = require('node:path');

const TRANSLATIONS_RELPATH = path.join('references', 'canon-translations.md');
const MAX_TERM_LENGTH = 80;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T[0-9:.]+Z?)?$/;

const DEFAULT_BODY = [
  '',
  '# Canon translations',
  '',
  'Room words mapped to canon framework names. A row with ratified_at null is a',
  'proposal and is never used until the navigator ratifies it.',
  '',
].join('\n');

// ---------------------------------------------------------------------------
// Containment
// ---------------------------------------------------------------------------

/*
 * _locate(roomDir, { create }) -> { file, dir } or null. The references
 * directory must realpath to exactly <roomReal>/references, and an existing
 * table file must realpath into that directory. With create:true a missing
 * references directory is made (non-recursively, inside the room realpath).
 */
function _locate(roomDir, opts) {
  if (typeof roomDir !== 'string' || roomDir.length === 0) return null;
  let roomReal;
  try {
    roomReal = fs.realpathSync(roomDir);
  } catch (_e) {
    return null;
  }
  const expectedDir = path.join(roomReal, 'references');
  if (!fs.existsSync(expectedDir)) {
    let isLink = false;
    try { isLink = fs.lstatSync(expectedDir).isSymbolicLink(); } catch (_e) { isLink = false; }
    if (isLink) return null; // a dangling symlink is never followed
    if (!(opts && opts.create)) return { file: path.join(expectedDir, 'canon-translations.md'), dir: expectedDir, missing: true };
    try {
      fs.mkdirSync(expectedDir);
    } catch (_e) {
      return null;
    }
  }
  let dirReal;
  try {
    dirReal = fs.realpathSync(expectedDir);
  } catch (_e) {
    return null;
  }
  if (dirReal !== expectedDir || dirReal.indexOf(roomReal + path.sep) !== 0) return null;
  const file = path.join(dirReal, 'canon-translations.md');
  if (fs.existsSync(file)) {
    let fileReal;
    try {
      fileReal = fs.realpathSync(file);
    } catch (_e) {
      return null;
    }
    if (path.dirname(fileReal) !== dirReal) return null;
  } else {
    let isLink = false;
    try { isLink = fs.lstatSync(file).isSymbolicLink(); } catch (_e) { isLink = false; }
    if (isLink) return null;
  }
  return { file, dir: dirReal, missing: false };
}

// ---------------------------------------------------------------------------
// Parse / serialize
// ---------------------------------------------------------------------------

function _parseScalar(raw) {
  const s = String(raw).trim();
  if (s === 'null' || s === '~' || s === '') return null;
  if (s[0] === '"' && s[s.length - 1] === '"' && s.length >= 2) {
    try {
      const v = JSON.parse(s);
      return typeof v === 'string' ? v : null;
    } catch (_e) {
      return s.slice(1, -1);
    }
  }
  if (s[0] === "'" && s[s.length - 1] === "'" && s.length >= 2) return s.slice(1, -1).replace(/''/g, "'");
  return s;
}

/*
 * _parse(text) -> { rows, body }. Reads only the leading `---` block (the
 * extractCarried frontmatter regex) and only its `translations:` list.
 */
function _parse(text) {
  const out = { rows: [], body: DEFAULT_BODY };
  if (typeof text !== 'string') return out;
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/);
  if (!m) return out;
  out.body = text.slice(m[0].length);
  if (out.body.length > 0 && out.body[0] !== '\n') out.body = '\n' + out.body;
  const lines = m[1].split(/\r?\n/);
  let inList = false;
  let cur = null;
  function flush() {
    if (cur && typeof cur.term === 'string' && cur.term.length > 0 && typeof cur.canon_name === 'string' && cur.canon_name.length > 0) {
      out.rows.push({
        term: cur.term,
        canon_name: cur.canon_name,
        ratified_at: typeof cur.ratified_at === 'string' && cur.ratified_at.length > 0 ? cur.ratified_at : null,
      });
    }
    cur = null;
  }
  for (const line of lines) {
    if (/^translations:\s*(\[\s*\])?\s*$/.test(line)) { inList = true; continue; }
    if (!inList) continue;
    if (/^\S/.test(line)) { flush(); inList = false; continue; }
    const item = line.match(/^\s*-\s+([A-Za-z_]+):\s*(.*)$/);
    if (item) {
      flush();
      cur = {};
      cur[item[1]] = _parseScalar(item[2]);
      continue;
    }
    const kv = line.match(/^\s+([A-Za-z_]+):\s*(.*)$/);
    if (kv && cur) cur[kv[1]] = _parseScalar(kv[2]);
  }
  flush();
  return out;
}

function _serialize(rows, body) {
  const lines = ['---', 'translations:'];
  for (const r of rows) {
    lines.push('  - term: ' + JSON.stringify(r.term));
    lines.push('    canon_name: ' + JSON.stringify(r.canon_name));
    lines.push('    ratified_at: ' + (r.ratified_at === null ? 'null' : JSON.stringify(r.ratified_at)));
  }
  lines.push('---');
  return lines.join('\n') + (typeof body === 'string' ? body : DEFAULT_BODY);
}

function _readFile(loc) {
  if (!loc || loc.missing) return null;
  try {
    return fs.readFileSync(loc.file, 'utf8');
  } catch (_e) {
    return null;
  }
}

function _writeAtomic(loc, text) {
  const tmp = path.join(loc.dir, '.canon-translations.md.' + process.pid + '.' + Date.now() + '.tmp');
  try {
    fs.writeFileSync(tmp, text, { flag: 'wx' });
    fs.renameSync(tmp, loc.file);
    return true;
  } catch (_e) {
    try { fs.unlinkSync(tmp); } catch (_e2) { /* nothing to clean */ }
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/* listRows(roomDir) -> Array<{term, canon_name, ratified_at}>; never throws. */
function listRows(roomDir) {
  try {
    const text = _readFile(_locate(roomDir));
    if (text === null) return [];
    return _parse(text).rows;
  } catch (_e) {
    return [];
  }
}

/* readTranslations(roomDir) -> Map term -> canon_name, ratified rows only. */
function readTranslations(roomDir) {
  const map = new Map();
  for (const r of listRows(roomDir)) {
    if (r.ratified_at !== null && !map.has(r.term)) map.set(r.term, r.canon_name);
  }
  return map;
}

function _defaultNames() {
  // Lazy: verification-stamp.cjs requires this module, so the reverse
  // require stays inside the call to keep the load graph acyclic.
  return require('./verification-stamp.cjs').loadFrameworkNames();
}

/*
 * proposeRow(roomDir, {term, canon_name}, {names}) -> {ok, reason}. Adds a
 * row with ratified_at null. Refuses a canon_name outside the snapshot, an
 * empty or over-long term, and a term already mapped elsewhere. Idempotent on
 * the same (term, canon_name). Never throws.
 */
function proposeRow(roomDir, row, opts) {
  try {
    if (!row || typeof row !== 'object') return { ok: false, reason: 'invalid_row' };
    const term = typeof row.term === 'string' ? row.term.trim() : '';
    const canonName = typeof row.canon_name === 'string' ? row.canon_name : '';
    if (term.length === 0 || /[\r\n]/.test(term)) return { ok: false, reason: 'invalid_term' };
    if (term.length > MAX_TERM_LENGTH) return { ok: false, reason: 'term_too_long' };
    const names = (opts && opts.names instanceof Set) ? opts.names : _defaultNames();
    if (!names.has(canonName)) return { ok: false, reason: 'not_canon' };
    const loc = _locate(roomDir, { create: true });
    if (!loc || loc.missing) return { ok: false, reason: 'outside_room' };
    const parsed = _parse(_readFile(loc));
    const existing = parsed.rows.find((r) => r.term === term);
    if (existing) {
      if (existing.canon_name === canonName) return { ok: true, reason: 'already_present' };
      return { ok: false, reason: 'term_conflict' };
    }
    parsed.rows.push({ term, canon_name: canonName, ratified_at: null });
    if (!_writeAtomic(loc, _serialize(parsed.rows, parsed.body))) return { ok: false, reason: 'write_failed' };
    return { ok: true, reason: 'proposed' };
  } catch (_e) {
    return { ok: false, reason: 'write_failed' };
  }
}

/*
 * ratifyRow(roomDir, term, isoDate) -> {ok, reason}. The navigator's act:
 * sets ratified_at on an existing row. isoDate defaults to today (UTC).
 * Never throws.
 */
function ratifyRow(roomDir, term, isoDate) {
  try {
    if (typeof term !== 'string' || term.length === 0) return { ok: false, reason: 'invalid_term' };
    const date = (typeof isoDate === 'string' && isoDate.length > 0) ? isoDate : new Date().toISOString().slice(0, 10);
    if (!ISO_DATE_RE.test(date)) return { ok: false, reason: 'invalid_date' };
    const loc = _locate(roomDir);
    if (!loc) return { ok: false, reason: 'outside_room' };
    const text = _readFile(loc);
    if (text === null) return { ok: false, reason: 'row_missing' };
    const parsed = _parse(text);
    const row = parsed.rows.find((r) => r.term === term);
    if (!row) return { ok: false, reason: 'row_missing' };
    row.ratified_at = date;
    if (!_writeAtomic(loc, _serialize(parsed.rows, parsed.body))) return { ok: false, reason: 'write_failed' };
    return { ok: true, reason: 'ratified' };
  } catch (_e) {
    return { ok: false, reason: 'write_failed' };
  }
}

module.exports = {
  TRANSLATIONS_RELPATH,
  MAX_TERM_LENGTH,
  listRows,
  readTranslations,
  proposeRow,
  ratifyRow,
};
