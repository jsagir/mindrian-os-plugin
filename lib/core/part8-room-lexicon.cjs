'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.2 Plan 01 (369.2-R04, CODE-07, J4) -- the read-only room lexicon
 * for the Theo content check.
 * ==========================================================================
 * Canon Part 8 means one thing: no room content to Theo. "Room content" is a
 * claim about PROVENANCE, not about the shape of a string. This module answers
 * the provenance question for a free-form string: does it name something the
 * bound room recorded (a term, a person, a venture, a claim, an artifact
 * title)? lib/core/part8-egress-guard.cjs theoVerdict() asks it, and the same
 * answer serves brain_ask, brain_search, brain_query and the PreToolUse hook.
 *
 * Read-only by construction:
 *   - room.db is opened ONLY when the file already exists, through the
 *     navigation read-only door (openRoomDbReadOnlyForCaller: a file: URI with
 *     ?mode=ro, so SQLite rejects any write). Never the creating room-db opener
 *     (which always creates and migrates, REV-05): a lexicon read must never
 *     mint a file, and this module never requires node:sqlite itself.
 *   - rows come from the nodes table only (a handful of SQL literals, a
 *     caller-owned read handle, zero DDL), gated on PRAGMA table_info(nodes)
 *     naming `type` and `properties` (lib/core/navigation/CONTEXT.md, the
 *     three schema variants rule). No artifact body is read: the hook has a
 *     2000 ms budget.
 *   - fail closed: any throw while a room.db exists answers
 *     { ok:false, reason:'room_check_unavailable' } and the guard blocks.
 *   - the matched text is never returned, logged or echoed. matchLexicon
 *     returns a token CLASS only.
 *
 * The guard's vocabulary sets are required lazily inside functions: the guard
 * requires this module at load time, so a top-level require back would be a
 * cycle.
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE). Pure CJS, zero npm deps.
 * License: BSL 1.1.
 */

const fs = require('node:fs');
const path = require('node:path');

const NAME_TYPES = Object.freeze({
  entity: 'room_term', company: 'room_term', technology: 'room_term', market: 'room_term',
  product: 'room_term', organization: 'room_term', person: 'person',
});
const CLAIM_TYPES = Object.freeze(['claim', 'CausalClaim']);
const ARTIFACT_TYPES = Object.freeze(['artifact', 'Artifact']);
const ROW_CAP = 5000;
const CLAIM_MIN_TOKENS = 3;

const KINDS = Object.freeze(['room_term', 'claim', 'person', 'venture_name', 'room_name', 'room_file']);

// room.db path (+ -wal mtime) + ROOM.md mtime -> { key, result }
const _cache = new Map();

function _resetLexiconCache() {
  _cache.clear();
}

function _guardSets() {
  // Lazy: the guard requires this module at load time.
  const g = require('./part8-egress-guard.cjs');
  return g;
}

function tokenize(s) {
  return String(s).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(function (t) { return t.length > 0; });
}

/**
 * resolveLexiconRoom(opts) -> abs room dir | null. Never throws.
 */
function resolveLexiconRoom(opts) {
  try {
    const r = require('./resolve-active-room.cjs').resolveActiveRoom(opts || {});
    return (r && typeof r.abs_path === 'string' && r.abs_path.length > 0) ? r.abs_path : null;
  } catch (_e) {
    return null;
  }
}

// An entry is worth keeping only when it can identify the room. Drop an entry
// whose every token is closed vocabulary (function word, methodology token,
// command slug, or inside a canonical framework phrase): a lexicon that holds
// "framework" would refuse every methodology question. Drop a single lowercase
// plain word too (a room that calls something "pricing" must not lose the word).
function makeEntry(kind, text, g) {
  if (typeof text !== 'string') return null;
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length < 3 || clean.length > 300) return null;
  const lc = clean.toLowerCase();
  let rest = lc;
  const phrases = g.CANONICAL_PHRASES || [];
  for (let i = 0; i < phrases.length; i += 1) {
    if (rest.indexOf(phrases[i]) !== -1) rest = rest.split(phrases[i]).join(' ');
  }
  const restTokens = tokenize(rest);
  const generic = restTokens.every(function (t) {
    return g.QUESTION_FUNCTION_WORDS.has(t) || g.METHODOLOGY_TOKEN_SET.has(t) || g.COMMAND_SLUG_SET.has(t);
  });
  if (generic) return null;
  const tokens = tokenize(clean);
  if (tokens.length === 0) return null;
  if (tokens.length === 1) {
    if (kind === 'room_file' || kind === 'claim') return null;
    if (clean === lc && !/[0-9_-]/.test(clean)) return null; // a single lowercase plain word
  }
  const entry = { kind: kind, text: clean, tokens: tokens, needle: ' ' + tokens.join(' ') + ' ' };
  if (kind === 'claim') {
    const content = Array.from(new Set(tokens.filter(function (t) {
      if (g.QUESTION_FUNCTION_WORDS.has(t) || g.METHODOLOGY_TOKEN_SET.has(t)) return false;
      return t.length >= 3 || /\p{N}/u.test(t);
    })));
    if (content.length < CLAIM_MIN_TOKENS) return null;
    entry.content = content;
    entry.need = Math.floor(content.length / 2) + 1;
  }
  return entry;
}

function _readFrontmatterNames(roomDir) {
  const names = [];
  try {
    const file = path.join(roomDir, 'ROOM.md');
    if (!fs.existsSync(file)) return names;
    const head = fs.readFileSync(file, 'utf8').slice(0, 4000);
    const m = head.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) return names;
    const re = /^(venture_name|title):\s*(.+?)\s*$/gm;
    let hit;
    while ((hit = re.exec(m[1])) !== null) {
      names.push(hit[2].replace(/^["']|["']$/g, ''));
    }
  } catch (_e) {
    // an unreadable ROOM.md only loses its names; the db read below is the gate
  }
  return names;
}

function _statKey(file) {
  try {
    const st = fs.statSync(file);
    return st.mtimeMs + ':' + st.size;
  } catch (_e) {
    return 'none';
  }
}

function _readDbEntries(roomDir, g, push) {
  // The read-only navigation door (spine-events.cjs openRoomDbReadOnlyForCaller):
  // file: URI ?mode=ro, so SQLite itself rejects any write and no migration
  // path is reachable; null when the file is absent or cannot be opened. The
  // caller already proved the file exists, so a null here is a failed open and
  // fails closed. This module never requires node:sqlite itself (substrate M3).
  const db = require('./navigation/spine-events.cjs').openRoomDbReadOnlyForCaller(roomDir);
  if (!db) throw new Error('room.db could not be opened read-only');
  try {
    const cols = db.prepare('PRAGMA table_info(nodes)').all().map(function (c) { return c.name; });
    if (cols.indexOf('type') === -1 || cols.indexOf('properties') === -1) return;
    const types = Object.keys(NAME_TYPES).concat(CLAIM_TYPES, ARTIFACT_TYPES);
    const sql = 'SELECT type, properties FROM nodes WHERE type IN ('
      + types.map(function () { return '?'; }).join(',') + ') LIMIT ' + ROW_CAP;
    const stmt = db.prepare(sql);
    const rows = stmt.all.apply(stmt, types);
    rows.forEach(function (row) {
      let props = null;
      try { props = JSON.parse(row.properties || '{}'); } catch (_e) { props = null; }
      if (!props || typeof props !== 'object') return;
      if (NAME_TYPES[row.type]) push(NAME_TYPES[row.type], props.name || props.title);
      else if (CLAIM_TYPES.indexOf(row.type) !== -1) push('claim', props.text || props.statement);
      else if (ARTIFACT_TYPES.indexOf(row.type) !== -1) push('room_file', props.title || props.name);
    });
  } finally {
    try { db.close(); } catch (_e) { /* best-effort */ }
  }
}

/**
 * loadRoomLexicon(roomDir, opts) -> { ok:true, entries, source } | { ok:false, reason }
 * roomDir null -> { ok:true, entries:[] } (no room bound: nothing to protect).
 * Memoized per room.db path, keyed by the db, wal and ROOM.md stat.
 */
function loadRoomLexicon(roomDir, opts) {
  if (typeof roomDir !== 'string' || roomDir.length === 0) {
    return { ok: true, entries: [], source: 'none' };
  }
  const o = opts || {};
  const dbFile = path.join(roomDir, '.mindrian', 'room.db');
  const hasDb = fs.existsSync(dbFile);
  const key = [_statKey(dbFile), hasDb ? _statKey(dbFile + '-wal') : '', _statKey(path.join(roomDir, 'ROOM.md')), o.slug || ''].join('|');
  const memo = _cache.get(dbFile);
  if (memo && memo.key === key) return memo.result;

  let result;
  try {
    const g = _guardSets();
    const entries = [];
    const seen = new Set();
    const push = function (kind, text) {
      const e = makeEntry(kind, text, g);
      if (!e) return;
      const id = e.kind + '|' + e.needle;
      if (seen.has(id)) return;
      seen.add(id);
      entries.push(e);
    };
    if (hasDb) _readDbEntries(roomDir, g, push);
    _readFrontmatterNames(roomDir).forEach(function (n) { push('venture_name', n); });
    push('room_name', String(o.slug || path.basename(roomDir)).replace(/[-_]+/g, ' '));
    result = { ok: true, entries: entries, source: hasDb ? 'room.db' : 'names' };
  } catch (_e) {
    // Any fault while a room is bound: fail closed. Never echo the cause.
    result = { ok: false, reason: 'room_check_unavailable' };
  }
  _cache.set(dbFile, { key: key, result: result });
  return result;
}

/**
 * matchLexicon(str, lexicon) -> { token_class } | null
 * Names match as whole token phrases, case-insensitive. A claim matches by
 * strict-majority content-token coverage of at least CLAIM_MIN_TOKENS tokens
 * (the localRoomCheck rule, research-planner/quick.cjs, restated here because
 * the hook must not load the research stack). Never returns the matched text.
 */
function matchLexicon(str, lexicon) {
  if (typeof str !== 'string' || str.length === 0 || !lexicon) return null;
  const entries = Array.isArray(lexicon) ? lexicon : lexicon.entries;
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const qTokens = tokenize(str);
  if (qTokens.length === 0) return null;
  const padded = ' ' + qTokens.join(' ') + ' ';
  const have = new Set(qTokens);
  for (let i = 0; i < entries.length; i += 1) {
    const e = entries[i];
    if (padded.indexOf(e.needle) !== -1) return { token_class: e.kind };
    if (e.kind === 'claim') {
      let got = 0;
      for (let j = 0; j < e.content.length; j += 1) {
        if (have.has(e.content[j])) got += 1;
      }
      if (got >= e.need) return { token_class: 'claim' };
    }
  }
  return null;
}

module.exports = {
  loadRoomLexicon: loadRoomLexicon,
  matchLexicon: matchLexicon,
  resolveLexiconRoom: resolveLexiconRoom,
  _resetLexiconCache: _resetLexiconCache,
  KINDS: KINDS,
};
