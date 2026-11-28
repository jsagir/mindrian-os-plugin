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
 * cycle. The section registry is also required lazily, inside
 * _genericTokenSet, so the hook cold start does not grow.
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

// room.db path -> { key, result } (plan 400.3-05b: the key rule is above loadRoomLexicon)
const _cache = new Map();

// The generic token set (quick 261012-sbz, shape S1), built once per guard module.
let _genericTokens = null;
let _genericTokensFor = null;

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

// Quick 261118-x1g (owner rulings 2026-11-19, OWNER-P and OWNER-REDUCE): the
// room check for every profiled script. lib/core/part8-script-proof.cjs loads
// only for a non-ASCII entry or question (a non-ASCII letter, digit or mark),
// so an ASCII room and an ASCII question keep the START comparison, the START
// entries and the hook cold start. A module failure while a non-ASCII entry
// is built throws inside loadRoomLexicon's try block (ok:false, fail closed).
const _X1G_NEED_RE = /(?![\x00-\x7F])[\p{L}\p{N}\p{M}]/u;
let _x1gProof;
function _x1gProofMod() {
  if (_x1gProof === undefined) {
    try { _x1gProof = require('./part8-script-proof.cjs'); } catch (_e) { _x1gProof = null; }
  }
  return _x1gProof;
}
let _x1gNormalize = null;
function _x1gNormalizeEntry(text) {
  if (!/[^\x00-\x7F]/.test(text)) return text;
  if (!_x1gNormalize) _x1gNormalize = require('./part8-normalize.cjs');
  return _x1gNormalize.normalizeForGuard(text);
}
// A caseless single token is kept for person, venture_name and room_name; for
// room_term from the node types company, organization and product; and for
// room_term or room_file in Han or Kana with 2 or more segments.
function _x1gKeepCaseless(kind, clean, nodeType, sp) {
  if (/[\p{Lu}\p{Ll}\p{Lt}]/u.test(clean)) return false;
  if (kind === 'person' || kind === 'venture_name' || kind === 'room_name') return true;
  if (kind === 'room_term' && (nodeType === 'company' || nodeType === 'organization' || nodeType === 'product')) return true;
  if ((kind === 'room_term' || kind === 'room_file') && sp.hasSpacelessLetter(clean) && sp.countSpacelessWords(clean) >= 2) return true;
  return false;
}
// The folded fields of a non-ASCII entry: the check-view tokens and needle,
// and for Han or Kana the compact form (substring match).
function _x1gFoldFields(entry, clean, sp) {
  entry.ftokens = sp.lexTokens(clean);
  entry.foldNeedle = ' ' + entry.ftokens.join(' ') + ' ';
  if (sp.hasSpacelessLetter(clean)) entry.compact = sp.compactView(clean);
  if (entry.kind === 'claim' && Array.isArray(entry.content) && !entry.cjkClaim) {
    entry.fcontent = entry.content.map(function (t) { return sp.lexTokens(t).join(''); }).filter(function (t) { return t.length > 0; });
  }
  return entry;
}
// A Han or Kana claim: its content words are the Segmenter words of 2 or more
// letters that are not closed vocabulary; it matches by strict majority.
function _x1gCjkClaim(clean, tokens, g, sp) {
  const content = sp.cjkClaimContent(clean).filter(function (t) {
    return !g.QUESTION_FUNCTION_WORDS.has(t) && !g.METHODOLOGY_TOKEN_SET.has(t);
  });
  if (content.length < CLAIM_MIN_TOKENS) return null;
  const entry = { kind: 'claim', text: clean, tokens: tokens, needle: ' ' + tokens.join(' ') + ' ', content: content,
    need: Math.floor(content.length / 2) + 1, cjkClaim: true };
  return _x1gFoldFields(entry, clean, sp);
}
// The script comparisons of matchLexicon, in order: the folded needle, the
// token-wise match (T7: Hebrew and Arabic prefixes on the first entry token,
// Korean particles, the W2 Latin part, the Cyrillic and Greek stem rule), the
// confusable-folded question against every START needle, the compact
// substring of a Han or Kana entry, and the claim majority on the folded
// question. A Set of question-token variants prefilters the token-wise match.
function _x1gMatch(str, entries, sp) {
  const q = sp.lexTokens(str);
  if (q.length === 0) return null;
  const padded = ' ' + q.join(' ') + ' ';
  const have = new Set(q);
  const conf = tokenize(sp.confusableFold(sp.checkView(str)));
  const confPadded = ' ' + conf.join(' ') + ' ';
  const compactQ = sp.compactView(str);
  const variants = new Set();
  for (let i = 0; i < q.length; i += 1) sp.tokenVariants(q[i], { prefix: true }).forEach(function (v) { variants.add(v); });
  for (let i = 0; i < entries.length; i += 1) {
    const e = entries[i];
    const ft = Array.isArray(e.ftokens) ? e.ftokens : e.tokens;
    const fneedle = typeof e.foldNeedle === 'string' ? e.foldNeedle : e.needle;
    if (padded.indexOf(fneedle) !== -1) return { token_class: e.kind, token_count: e.tokens.length, at: i };
    if (ft.length > 0 && ft.length <= q.length) {
      const e0 = ft[0];
      const e3 = e0.slice(0, 3);
      if (variants.has(e0) || q.some(function (t) { return t.slice(0, 3) === e3; })) {
        for (let s = 0; s + ft.length <= q.length; s += 1) {
          let ok = true;
          for (let j = 0; ok && j < ft.length; j += 1) ok = sp.tokenMatches(q[s + j], ft[j], { first: j === 0 });
          if (ok) return { token_class: e.kind, token_count: e.tokens.length, at: i };
        }
      }
    }
    if (confPadded.indexOf(e.needle) !== -1) return { token_class: e.kind, token_count: e.tokens.length, at: i };
    if (typeof e.compact === 'string' && e.compact.length > 0 && e.kind !== 'claim' && compactQ.indexOf(e.compact) !== -1) {
      return { token_class: e.kind, token_count: e.tokens.length, at: i };
    }
    if (e.kind === 'claim') {
      let got = 0;
      if (e.cjkClaim) {
        for (let j = 0; j < e.content.length; j += 1) if (compactQ.indexOf(e.content[j]) !== -1) got += 1;
      } else if (Array.isArray(e.fcontent)) {
        for (let j = 0; j < e.fcontent.length; j += 1) if (have.has(e.fcontent[j])) got += 1;
      }
      if (got >= e.need) return { token_class: 'claim', token_count: got, at: i };
    }
  }
  return null;
}

/**
 * _genericTokenSet(g) -> Set of lowercase tokens that name no room.
 * The union of the tokens of: the canonical framework phrases, the command
 * slugs, the methodology tokens, the question function words, and the core
 * section slugs and labels. Built once per guard module. A throw here happens
 * inside loadRoomLexicon's try block, so it fails closed.
 */
function _genericTokenSet(g) {
  const guardMod = g || _guardSets();
  if (_genericTokens && _genericTokensFor === guardMod) return _genericTokens;
  const set = new Set();
  const addAll = function (source) {
    if (!source || typeof source[Symbol.iterator] !== 'function') return;
    for (const v of source) tokenize(v).forEach(function (t) { set.add(t); });
  };
  addAll(guardMod.CANONICAL_PHRASES);
  addAll(guardMod.COMMAND_SLUG_SET);
  addAll(guardMod.METHODOLOGY_TOKEN_SET);
  addAll(guardMod.QUESTION_FUNCTION_WORDS);
  // Lazy: a pure module (fs and path only at load time), so no cycle.
  const sections = require('./section-registry.cjs').CORE_SECTIONS || {};
  Object.keys(sections).forEach(function (slug) {
    tokenize(slug).forEach(function (t) { set.add(t); });
    if (sections[slug] && typeof sections[slug].label === 'string') {
      tokenize(sections[slug].label).forEach(function (t) { set.add(t); });
    }
  });
  _genericTokens = set;
  _genericTokensFor = guardMod;
  return set;
}

// ---------------------------------------------------------------------------
// Plan 392-11 (P5, 392-SC5, F8): the session-owned lexicon room.
//
// The lexicon check protects the room of THIS session, not whichever room
// another session last activated. With a session id the room is resolved
// through resolveSessionRoom({sessionId, requireOwnership: true}) of
// lib/core/resolve-active-room.cjs (the binding file under
// <rooms home>/.rooms/sessions/<sessionId>.json); only its leg A
// (session.primary) counts as bound. Its demoted leg B (reg.active) is the
// fresh-session seed default for WRITES and is declined here: the owner rule
// says an unbound session has an empty lexicon and is allowed, so two sessions
// bound to different rooms never share a lexicon and an unbound session never
// inherits a foreign room's words. Without a session id (the shim on Claude
// Desktop and Cowork, or any process where CLAUDE_CODE_SESSION_ID is absent)
// the machine-global active room is used, today's behaviour, and the result
// says so: lexicon_scope machine_global.
//
// "Cannot check" blocks, it never allows: a binding file that does not parse,
// a traversal-shaped session id, a throw anywhere, or a bound room whose
// room.db cannot be read (fs.accessSync R_OK on the same path loadRoomLexicon
// opens, or a non-file in its place) answers status unavailable, and the guard
// blocks every payload kind with class room_check_unavailable.
//
// CLAUDE_ACTIVE_ROOM (the operator pin and the hermetic test seam) outranks
// the registry in resolveActiveRoom and outranks the binding here too (reason
// env_override, scope machine_global: it is a machine-wide pin).
//
// Result: { status: 'bound' | 'unbound' | 'unavailable', roomDir: string |
// null, reason, lexicon_scope: 'session' | 'machine_global' }. Reasons:
// session.primary, reg.active, env_override (bound); no_binding, room_missing,
// no_active (unbound); resolver_error, room_unreadable (unavailable).
// Never throws. LOCAL filesystem reads only (Canon Part 8 and 9).
// ---------------------------------------------------------------------------
const LEXICON_SCOPES = Object.freeze(['session', 'machine_global']);

function _roomsHome(o) {
  if (typeof o.home === 'string' && o.home.length > 0) return o.home;
  const env = process.env.MINDRIAN_ROOMS_HOME;
  if (typeof env === 'string' && env.length > 0) return env;
  const os = require('node:os');
  return path.join(process.env.HOME || process.env.USERPROFILE || os.homedir(), 'MindrianRooms');
}

// 'ok' when the room's db is readable or absent (a names-only lexicon),
// 'room_unreadable' when a room.db exists and cannot be read as a file.
function _probeRoomDb(roomDir) {
  const dbFile = path.join(roomDir, '.mindrian', 'room.db');
  if (!fs.existsSync(dbFile)) return 'ok';
  try {
    if (!fs.statSync(dbFile).isFile()) return 'room_unreadable';
    fs.accessSync(dbFile, fs.constants.R_OK);
    return 'ok';
  } catch (_e) {
    return 'room_unreadable';
  }
}

function _envOverrideRoom() {
  const raw = process.env.CLAUDE_ACTIVE_ROOM;
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  try {
    const v = require('./platform.cjs').windowsDrivePathToPosix(raw.trim());
    return (v !== null && v.length > 0 && fs.existsSync(v)) ? v : null;
  } catch (_e) {
    return null;
  }
}

function resolveLexiconRoom(opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  const hasSession = typeof o.sessionId === 'string' && o.sessionId.length > 0;
  const scope = hasSession ? 'session' : 'machine_global';
  const out = function (status, roomDir, reason, lexiconScope) {
    return { status: status, roomDir: roomDir, reason: reason, lexicon_scope: lexiconScope || scope };
  };
  try {
    const home = _roomsHome(o);
    const rar = require('./resolve-active-room.cjs');

    // The operator pin wins on every path (resolveActiveRoom does the same).
    const pinned = _envOverrideRoom();
    if (pinned) {
      const probe = _probeRoomDb(pinned);
      return probe === 'ok' ? out('bound', pinned, 'env_override', 'machine_global') : out('unavailable', pinned, probe, 'machine_global');
    }

    if (hasSession) {
      // A session id that could climb out of the sessions folder cannot name
      // a binding; refuse rather than guess. The test is the one
      // session-binding.cjs isSafeSlug applies (no `..`), inlined so that
      // module loads only when a binding file exists (the hook's fresh-process
      // module count, tests/test-386-folder-memory-lazy-timeline.cjs LZ5).
      if (o.sessionId.indexOf('..') !== -1) return out('unavailable', null, 'resolver_error');
      const bindingFile = path.join(home, '.rooms', 'sessions', o.sessionId + '.json');
      if (!fs.existsSync(bindingFile)) return out('unbound', null, 'no_binding');
      // readSessionBinding collapses a corrupt file to the safe default (an
      // unbound session). For the lexicon a corrupt binding is "cannot check".
      let parsed;
      try {
        parsed = JSON.parse(fs.readFileSync(bindingFile, 'utf8'));
      } catch (_e) {
        return out('unavailable', null, 'resolver_error');
      }
      if (!parsed || typeof parsed !== 'object') return out('unavailable', null, 'resolver_error');
      const hit = rar.resolveSessionRoom({ sessionId: o.sessionId, requireOwnership: o.requireOwnership === true, home: home });
      if (hit && hit.source === 'session.primary' && typeof hit.abs_path === 'string' && hit.abs_path.length > 0) {
        const probe = _probeRoomDb(hit.abs_path);
        return probe === 'ok' ? out('bound', hit.abs_path, 'session.primary') : out('unavailable', hit.abs_path, probe);
      }
      // Leg B (reg.active) declined: no primary, or a primary whose room is
      // not on disk (nothing there to protect).
      const primary = (typeof parsed.primary === 'string' && parsed.primary.length > 0) ? parsed.primary : null;
      return out('unbound', null, primary ? 'room_missing' : 'no_binding');
    }

    // Machine-global: the registry's active room (today's behaviour).
    const active = rar.resolveActiveRoom({ home: home });
    if (!active || typeof active.abs_path !== 'string' || active.abs_path.length === 0) return out('unbound', null, 'no_active');
    const probe = _probeRoomDb(active.abs_path);
    return probe === 'ok' ? out('bound', active.abs_path, 'reg.active') : out('unavailable', active.abs_path, probe);
  } catch (_e) {
    return out('unavailable', null, 'resolver_error');
  }
}

/**
 * resolveLexiconRoomDir(opts) -> abs room dir | null. Never throws.
 * @deprecated Plan 392-11: the old bare-string form, kept for callers that
 * pass no session (the guard's own in-process fallback when a caller gives no
 * roomDir). It answers the machine-global active room; it cannot say
 * "unavailable", so a caller that needs the fail-closed status must use
 * resolveLexiconRoom. New code passes {sessionId} and reads status.
 */
function resolveLexiconRoomDir(opts) {
  try {
    const r = resolveLexiconRoom(opts);
    return (r.status === 'bound' && typeof r.roomDir === 'string') ? r.roomDir : null;
  } catch (_e) {
    return null;
  }
}

// An entry is worth keeping only when it can identify the room. The closed-list
// rule applies to every kind: drop an entry whose every token is closed
// vocabulary (function word, methodology token, command slug, or inside a
// canonical framework phrase), because a lexicon that holds "framework" would
// refuse every methodology question. Drop a single lowercase plain word too (a
// room that calls something "pricing" must not lose the word).
// Shape S1 (navigator decision 2026-10-12): a room term or an artifact title
// made only of framework-name words, command-name words, methodology words,
// question words or core section names is dropped as well. One word outside
// that union keeps the entry. Claim, person, venture_name and room_name entries
// never pass this rule. Known residual: a word such as "segment" is in none of
// the five sources, so a name that holds it still blocks.
// Quick 261118-x1g: nodeType (the room.db node type) decides the caseless
// single-token rule; a non-ASCII entry goes through the guard normaliser first
// and gets the folded fields; the length floor is 2 for Han and Kana.
function makeEntry(kind, text, g, nodeType) {
  if (typeof text !== 'string') return null;
  text = _x1gNormalizeEntry(text);
  const clean = text.replace(/\s+/g, ' ').trim();
  const x1gNeeds = _X1G_NEED_RE.test(clean);
  const sp = x1gNeeds ? _x1gProofMod() : null;
  if (x1gNeeds && !sp) throw new Error('the script proof could not load');
  const x1gHanKana = sp !== null && sp.hasSpacelessLetter(clean);
  if ((clean.length < 3 && !(x1gHanKana && clean.length === 2)) || clean.length > 300) return null;
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
  if (kind === 'room_term' || kind === 'room_file') {
    const union = _genericTokenSet(g);
    if (tokens.every(function (t) { return union.has(t); })) return null;
  }
  if (kind === 'claim' && x1gHanKana) {
    const cjk = _x1gCjkClaim(clean, tokens, g, sp);
    if (cjk) return cjk;
  }
  const x1gKeep = tokens.length === 1 && sp !== null && _x1gKeepCaseless(kind, clean, nodeType, sp);
  if (tokens.length === 1 && !x1gKeep) {
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
  if (sp !== null) _x1gFoldFields(entry, clean, sp);
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

// Plan 400.3-05b: the rows are read on the caller's open read-only handle (one
// snapshot with the cache key), so this function no longer opens room.db. The
// SQL, the table_info check and ROW_CAP are the BASE ones. Returns the number of
// rows read.
function _readDbEntries(db, g, push) {
  const cols = db.prepare('PRAGMA table_info(nodes)').all().map(function (c) { return c.name; });
  if (cols.indexOf('type') === -1 || cols.indexOf('properties') === -1) return 0;
  const types = Object.keys(NAME_TYPES).concat(CLAIM_TYPES, ARTIFACT_TYPES);
  const sql = 'SELECT type, properties FROM nodes WHERE type IN ('
    + types.map(function () { return '?'; }).join(',') + ') LIMIT ' + ROW_CAP;
  const stmt = db.prepare(sql);
  const rows = stmt.all.apply(stmt, types);
  rows.forEach(function (row) {
    let props = null;
    try { props = JSON.parse(row.properties || '{}'); } catch (_e) { props = null; }
    if (!props || typeof props !== 'object') return;
    if (NAME_TYPES[row.type]) push(NAME_TYPES[row.type], props.name || props.title, row.type);
    else if (CLAIM_TYPES.indexOf(row.type) !== -1) push('claim', props.text || props.statement);
    else if (ARTIFACT_TYPES.indexOf(row.type) !== -1) push('room_file', props.title || props.name);
  });
  return rows.length;
}

// ---------------------------------------------------------------------------
// Plan 400.3-05b (OR-5, OA-1): the persisted lexicon cache.
//
// Each guard call is a new process, so the in-process memo never helps the
// hook. A successful room.db build is written to
// <room>/.mindrian/part8-lexicon-cache.json (mode 0600, a temp file plus a
// rename) and used, in any process, while its key equals the current key.
//
// Why the key reads the change feed: any room.db write can add a room term, and
// a stat of room.db or of its WAL is not a sound change signal. Every node or
// edge insert, update and delete writes a room_change_log row through a
// trigger, and the sequence never goes backwards (AUTOINCREMENT keeps its
// high-water mark in sqlite_sequence). So the key holds the change_log_epoch
// value and the latest sequence (the readChangeLogMeta rule). A cache is read
// or written only when all 6 change-log triggers exist: with a missing trigger
// the sequence may not move on a write (Phase 369 Pitfall 6).
//
// Order: one handle through the read-only navigation door (no busy wait, no
// write) and one read transaction; the key values first, the node rows second
// and only when the cache does not match, so both come from one snapshot. Any
// error fails closed with room_check_unavailable and writes no cache (OA-1).
//
// The cache file holds room terms and stays inside the room, next to room.db
// (Part 8: no network). A planted file with a matching key is trusted to the
// same degree as room.db, which the same local user can edit.
// ---------------------------------------------------------------------------
const CACHE_FILE = 'part8-lexicon-cache.json';
const CACHE_SCHEMA = 1;
// The builder side of the key: the plugin version and the content hash of the
// files that decide the entries (npm normalizes mtimes, so no mtime is used).
// The first 5 are the vocabulary files of the plan; the last 2 shape the folded
// fields of each entry (quick 261118-x1g), so a change there rebuilds too.
const BUILDER_FILES = Object.freeze([
  'lib/core/part8-room-lexicon.cjs',
  'lib/core/part8-egress-guard.cjs',
  'lib/core/section-registry.cjs',
  'data/command-registry.json',
  'data/framework-names.json',
  'lib/core/part8-script-proof.cjs',
  'lib/core/part8-normalize.cjs',
]);
const PLUGIN_ROOT = path.join(__dirname, '..', '..');

// undefined: not computed yet; null: a read failed, so no cache read and no
// cache write in this process (the BASE build runs).
let _builderStamp;
function _builder() {
  if (_builderStamp !== undefined) return _builderStamp;
  try {
    const crypto = require('node:crypto');
    const pj = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
    if (!pj || typeof pj.version !== 'string' || pj.version.length === 0) throw new Error('no plugin version');
    const files = {};
    BUILDER_FILES.forEach(function (rel) {
      files[rel] = crypto.createHash('sha256').update(fs.readFileSync(path.join(PLUGIN_ROOT, rel))).digest('hex');
    });
    _builderStamp = { version: pj.version, files: files };
  } catch (_e) {
    _builderStamp = null;
  }
  return _builderStamp;
}

// Test use only: the source and the row count of the last loadRoomLexicon call.
let _lastInfo = null;
function _lastLoadInfo() { return _lastInfo; }

function _roomMdHash(roomDir) {
  try {
    const file = path.join(roomDir, 'ROOM.md');
    if (!fs.existsSync(file)) return 'none';
    const head = fs.readFileSync(file, 'utf8').slice(0, 4000);
    return require('node:crypto').createHash('sha256').update(head).digest('hex');
  } catch (_e) {
    return 'unreadable';
  }
}

// The key of an open read-only handle, inside the read transaction.
// usable false: no cache read and no cache write.
function _readKey(db, roomDir, slug) {
  const rcl = require('./navigation/room-change-log.cjs');
  const names = rcl.CHANGE_LOG_TRIGGERS;
  const tstmt = db.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name IN ("
    + names.map(function () { return '?'; }).join(',') + ')');
  const found = tstmt.all.apply(tstmt, names).length;
  const meta = rcl.readChangeLogMeta(db);
  const builder = _builder();
  const key = JSON.stringify({
    schema: CACHE_SCHEMA,
    builder: builder,
    room: fs.realpathSync(roomDir),
    epoch: meta.present ? meta.epoch : null,
    seq: meta.present ? meta.latest_seq : null,
    roomMd: _roomMdHash(roomDir),
    slug: slug || '',
  });
  return { key: key, usable: builder !== null && meta.present === true && found === names.length };
}

function _readCacheFile(roomDir, key) {
  try {
    const c = JSON.parse(fs.readFileSync(path.join(roomDir, '.mindrian', CACHE_FILE), 'utf8'));
    if (!c || typeof c !== 'object' || c.schema !== CACHE_SCHEMA || c.key !== key || !Array.isArray(c.entries)) return null;
    return c.entries;
  } catch (_e) {
    return null;
  }
}

// Wave 2 Goldfish W2-D-07: a writer killed between the temp write and the
// rename (SIGKILL) leaves <cache>.<pid>.<hex>.tmp with room terms in it. Each
// cache write removes such temp files when they are older than 60 s (a live
// writer finishes in milliseconds). Only the exact temp-name shape is removed.
const STALE_TMP_MS = 60000;
function _sweepStaleTmp(dir) {
  try {
    const shape = new RegExp('^' + CACHE_FILE.replace(/[.]/g, '\\.') + '\\.\\d+\\.[0-9a-f]+\\.tmp$');
    const now = Date.now();
    for (const name of fs.readdirSync(dir)) {
      if (!shape.test(name)) continue;
      const p = path.join(dir, name);
      try {
        if (now - fs.statSync(p).mtimeMs > STALE_TMP_MS) fs.unlinkSync(p);
      } catch (_e) { /* gone or not ours: best effort */ }
    }
  } catch (_e) {
    // best effort
  }
}

// Temp file plus rename: 2 hook processes that write at once each leave a whole
// file. Any failure is ignored and removes the temp file; the result never
// depends on the write.
function _writeCacheFile(roomDir, key, entries) {
  const dir = path.join(roomDir, '.mindrian');
  _sweepStaleTmp(dir);
  let tmp = null;
  try {
    tmp = path.join(dir, CACHE_FILE + '.' + process.pid + '.' + require('node:crypto').randomBytes(6).toString('hex') + '.tmp');
    fs.writeFileSync(tmp, JSON.stringify({ schema: CACHE_SCHEMA, key: key, source: 'room.db', entries: entries }), { mode: 0o600, flag: 'wx' });
    fs.renameSync(tmp, path.join(dir, CACHE_FILE));
    tmp = null;
  } catch (_e) {
    // best effort
  } finally {
    if (tmp) { try { fs.unlinkSync(tmp); } catch (_e) { /* best effort */ } }
  }
}

/**
 * loadRoomLexicon(roomDir, opts) -> { ok:true, entries, source } | { ok:false, reason }
 * roomDir null -> { ok:true, entries:[] } (no room bound: nothing to protect).
 * source: 'cache' (plan 400.3-05b, the persisted cache matched), 'room.db',
 * 'names' (no room.db) or 'none'.
 * Memoized per room.db path. With a room.db the memo key is the cache key
 * (plan 400.3-05b: one rule for the memo and the file); without a usable key it
 * also holds the db, wal and ROOM.md stat. Without a room.db the memo key is the
 * BASE stat key.
 */
function _buildEntries(roomDir, o, db) {
  const g = _guardSets();
  const entries = [];
  const seen = new Set();
  const push = function (kind, text, nodeType) {
    const e = makeEntry(kind, text, g, nodeType);
    if (!e) return;
    const id = e.kind + '|' + e.needle;
    if (seen.has(id)) return;
    seen.add(id);
    entries.push(e);
  };
  const rowsRead = db ? _readDbEntries(db, g, push) : 0;
  _readFrontmatterNames(roomDir).forEach(function (n) { push('venture_name', n); });
  push('room_name', String(o.slug || path.basename(roomDir)).replace(/[-_]+/g, ' '));
  return { entries: entries, rowsRead: rowsRead };
}

function loadRoomLexicon(roomDir, opts) {
  if (typeof roomDir !== 'string' || roomDir.length === 0) {
    _lastInfo = { source: 'none', rowsRead: 0 };
    return { ok: true, entries: [], source: 'none' };
  }
  const o = opts || {};
  const dbFile = path.join(roomDir, '.mindrian', 'room.db');
  const hasDb = fs.existsSync(dbFile);
  const memo = _cache.get(dbFile);

  if (!hasDb) {
    // The BASE names-only path and its BASE memo key. No cache file is written.
    const key = [_statKey(dbFile), '', _statKey(path.join(roomDir, 'ROOM.md')), o.slug || ''].join('|');
    if (memo && memo.key === key) { _lastInfo = { source: memo.result.source, rowsRead: 0 }; return memo.result; }
    let result;
    try {
      result = { ok: true, entries: _buildEntries(roomDir, o, null).entries, source: 'names' };
      _lastInfo = { source: 'names', rowsRead: 0 };
    } catch (_e) {
      result = { ok: false, reason: 'room_check_unavailable' };
      _lastInfo = { source: 'error', rowsRead: 0 };
    }
    if (result.ok === true) _cache.set(dbFile, { key: key, result: result });
    else _cache.delete(dbFile);
    return result;
  }

  let result = null;
  let memoKey = null;
  let writeKey = null;
  let db = null;
  try {
    // Plan 400.3-05b: a 0-byte or non-file room.db fails closed (lazy require).
    if (!require('./room-root.cjs').roomDbPresent(roomDir)) throw new Error('room.db is empty or not a file');
    // The read-only navigation door (spine-events.cjs openRoomDbReadOnlyForCaller):
    // file: URI ?mode=ro, so SQLite itself rejects any write and no migration
    // path is reachable; no busy timeout (WAL readers never block on a writer).
    // This module never requires node:sqlite itself (substrate M3).
    db = require('./navigation/spine-events.cjs').openRoomDbReadOnlyForCaller(roomDir);
    if (!db) throw new Error('room.db could not be opened read-only');
    db.exec('BEGIN');
    const k = _readKey(db, roomDir, o.slug);
    memoKey = k.usable ? k.key : [k.key, _statKey(dbFile), _statKey(dbFile + '-wal'), _statKey(path.join(roomDir, 'ROOM.md'))].join('|');
    if (memo && memo.key === memoKey) {
      result = memo.result;
      _lastInfo = { source: memo.result.source, rowsRead: 0 };
    } else {
      const cached = k.usable ? _readCacheFile(roomDir, k.key) : null;
      if (cached) {
        result = { ok: true, entries: cached, source: 'cache' };
        _lastInfo = { source: 'cache', rowsRead: 0 };
      } else {
        const built = _buildEntries(roomDir, o, db);
        result = { ok: true, entries: built.entries, source: 'room.db' };
        _lastInfo = { source: 'room.db', rowsRead: built.rowsRead };
        if (k.usable) writeKey = k.key;
      }
    }
  } catch (_e) {
    // Any fault while a room is bound: fail closed. Never echo the cause.
    result = { ok: false, reason: 'room_check_unavailable' };
    _lastInfo = { source: 'error', rowsRead: 0 };
    writeKey = null;
  } finally {
    if (db) {
      try { db.exec('ROLLBACK'); } catch (_e) { /* no open transaction */ }
      try { db.close(); } catch (_e) { /* best-effort */ }
    }
  }
  // Only a successful room.db build is persisted (plan 386-33 R7 rule kept).
  if (writeKey !== null && result.ok === true) _writeCacheFile(roomDir, writeKey, result.entries);
  // Plan 386-33 (R7): only a successful read is cached. A failed read is returned
  // for this call (fail closed, typed reason room_check_unavailable) and the next
  // call reads the database again, so one failed read (a chmod, a lock) does not
  // block every question until a file changes.
  if (result.ok === true && memoKey !== null) {
    _cache.set(dbFile, { key: memoKey, result: result });
  } else {
    _cache.delete(dbFile);
  }
  return result;
}

/**
 * matchLexicon(str, lexicon) -> { token_class, token_count, at } | null
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
    if (padded.indexOf(e.needle) !== -1) return { token_class: e.kind, token_count: e.tokens.length, at: i };
    if (e.kind === 'claim') {
      let got = 0;
      for (let j = 0; j < e.content.length; j += 1) {
        if (have.has(e.content[j])) got += 1;
      }
      if (got >= e.need) return { token_class: 'claim', token_count: got, at: i };
    }
  }
  // Quick 261118-x1g: the script comparisons run only for a question with a
  // non-ASCII letter, digit or mark; an ASCII question keeps the START answer.
  // The module cannot load: fail closed (a hit on the first entry).
  if (_X1G_NEED_RE.test(str)) {
    const sp = _x1gProofMod();
    if (!sp) return { token_class: entries[0].kind, token_count: 1, at: 0 };
    const x1gHit = _x1gMatch(str, entries, sp);
    if (x1gHit) return x1gHit;
  }
  return null;
}

module.exports = {
  loadRoomLexicon: loadRoomLexicon,
  matchLexicon: matchLexicon,
  resolveLexiconRoom: resolveLexiconRoom,
  resolveLexiconRoomDir: resolveLexiconRoomDir,
  LEXICON_SCOPES: LEXICON_SCOPES,
  _resetLexiconCache: _resetLexiconCache,
  _lastLoadInfo: _lastLoadInfo,
  _genericTokenSet: _genericTokenSet,
  KINDS: KINDS,
};
