'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 400.2.1: the room identity screen of the /mos:persona door and the reader search marker, in one small module
 * with a light require graph (node built-ins, plus rs-egress-prompts.cjs loaded lazily for the content fence). The door
 * (scripts/persona-hats.cjs), persona-ops (lib/core/persona-ops.cjs) and the reader search guard hook
 * (scripts/persona-reader-search-guard-hook.cjs) read the same functions here, so the hook does not load the door.
 *
 * Contents: the room name (roomVentureNameOf), the identity screen (roomIdentityScreen, handleHitsScreen), the search
 * text screen (screenSearchText, urlScreenTexts), the light run ledger read (readLedger), and the live reader search
 * markers (liveReaderMarkers, removeReaderMarker, readerSearchVerdict). The marker writer stays in the door.
 * No network call. No em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MAX_JSON_BYTES = 262144;
const RUN_ID_RE = /^\d{8}-\d{6}-[0-9a-f]{4}$/;

function readText(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; }
}

function isPlain(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Read one JSON file. Never throws. Refuses a file that is too large.
 * @returns {{ok: true, value: *, sha256: string} | {ok: false, reason: string}}
 */
function readJsonFile(p, options) {
  const o = options || {};
  let st;
  try {
    st = o.noSymlink ? fs.lstatSync(p) : fs.statSync(p);
  } catch (e) {
    return { ok: false, reason: 'file_unreadable' };
  }
  if (!st.isFile()) return { ok: false, reason: o.noSymlink ? 'not_a_regular_file' : 'file_unreadable' };
  if (st.size > MAX_JSON_BYTES) return { ok: false, reason: 'file_too_large' };
  let bytes;
  try {
    bytes = fs.readFileSync(p);
  } catch (e) {
    return { ok: false, reason: 'file_unreadable' };
  }
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch (e) {
    return { ok: false, reason: 'schema_invalid:json' };
  }
  return { ok: true, value, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
}

// ---------------------------------------------------------------------------
// The room name (Phase 400.2.1, S3)
// ---------------------------------------------------------------------------

// Phase 400.2.1 (S3): the first headings that a generator writes into STATE.md. None of them is a venture name.
// - The skeleton heading of the room birth: read from the template itself (templates/room-skeleton/STATE.md.tmpl,
//   written by lib/core/room-skeleton-scaffold.cjs). The birth keeps this file until the first state recompute.
// - The computed heading: lib/core/room-render-state.cjs writes "# Data Room State".
// - The vault-import skeleton heading: scripts/vault-import.cjs scaffoldRoom writes "# Project State".
// tests/test-40021-persona-domain.cjs D14 checks each entry against its generator, so a changed generator fails a test.
const STATE_SKELETON_TEMPLATE = path.join(__dirname, '..', '..', 'templates', 'room-skeleton', 'STATE.md.tmpl');
const COMPUTED_STATE_HEADING = 'Data Room State';
const VAULT_IMPORT_STATE_HEADING = 'Project State';
let generatedHeadingsCache = null;

/** The generated STATE.md first headings (exact text). The template is read once; a missing template is skipped. */
function generatedStateHeadings() {
  if (generatedHeadingsCache) return generatedHeadingsCache.slice();
  const out = [];
  let tmpl = null;
  try { tmpl = fs.readFileSync(STATE_SKELETON_TEMPLATE, 'utf8'); } catch (e) { tmpl = null; }
  const m = tmpl ? /^#\s+(.+?)\s*$/m.exec(tmpl) : null;
  if (m && m[1]) out.push(m[1]);
  for (const h of [COMPUTED_STATE_HEADING, VAULT_IMPORT_STATE_HEADING]) if (!out.includes(h)) out.push(h);
  generatedHeadingsCache = out;
  return out.slice();
}

/** True when a heading text is exactly one generated heading (case and outer space do not matter). */
function isGeneratedStateHeading(text) {
  const t = String(text == null ? '' : text).trim().toLowerCase();
  return generatedStateHeadings().some(h => h.toLowerCase() === t);
}

// Kept for callers of the round 3 export: the computed heading only. Use isGeneratedStateHeading for the full set.
const GENERATED_STATE_HEADING = /^data room state$/i;
const FALLBACK_VENTURE_NAME = 'venture';

/** The slug of a name: lower case, a-z 0-9 and single hyphens, 40 characters or fewer, no hyphen at an end. */
function domainSlug(name) {
  return String(name == null ? '' : name)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
    .replace(/^-+|-+$/g, '');
}

/** The icm_self.room name of a ROOM.md text, or null. CRLF and LF line ends both work. Pure. */
function icmSelfRoomName(roomMd) {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(String(roomMd || ''));
  if (!fm) return null;
  const lines = fm[1].split(/\r?\n/);
  const at = lines.findIndex(l => /^icm_self:\s*$/.test(l));
  if (at === -1) return null;
  for (let i = at + 1; i < lines.length; i += 1) {
    const l = lines[i];
    if (!/^\s/.test(l)) break;
    // Only the direct key of icm_self (2 spaces of indent), never a room: key of a nested block.
    const m = /^ {2}room:\s*(.+?)\s*$/.exec(l);
    if (m) {
      const v = m[1].replace(/^["']|["']$/g, '').trim();
      return v.length > 0 ? v : null;
    }
  }
  return null;
}

/**
 * Phase 400.2.1 (S3): the name of a room and where it came from, for the persona domain and the room identity screen of
 * the door. Order: the STATE.md venture: line (source venture_line), a first heading that is not the generated "Data
 * Room State" (heading), the ROOM.md icm_self.room name (room_md), the room directory name (directory), then "venture"
 * (fallback). Local reads only.
 * @param {string} roomDir
 * @param {string} [stateText] - the STATE.md text when the caller already read it
 * @returns {{name: string, source: string}}
 */
function roomVentureNameOf(roomDir, stateText) {
  const resolved = path.resolve(String(roomDir));
  const state = typeof stateText === 'string' ? stateText : (readText(path.join(resolved, 'STATE.md')) || '');
  const v = state.match(/^venture:[ \t]*(\S.*)$/im);
  if (v && v[1].trim()) return { name: v[1].trim(), source: 'venture_line' };
  const h = state.match(/^#\s+(.+)/m);
  if (h && h[1].trim() && !isGeneratedStateHeading(h[1])) return { name: h[1].trim(), source: 'heading' };
  const fromRoom = icmSelfRoomName(readText(path.join(resolved, 'ROOM.md')) || '');
  if (fromRoom && domainSlug(fromRoom)) return { name: fromRoom, source: 'room_md' };
  const base = path.basename(resolved);
  if (domainSlug(base)) return { name: base, source: 'directory' };
  return { name: FALLBACK_VENTURE_NAME, source: 'fallback' };
}

/** The name of roomVentureNameOf. @returns {string} */
function roomVentureName(roomDir, stateText) {
  return roomVentureNameOf(roomDir, stateText).name;
}


// ---------------------------------------------------------------------------
// The room identity screen (Phase 400.2-10, PS-01; moved here in Phase 400.2.1)
// ---------------------------------------------------------------------------

// Generic words that are common in room and venture names and are valid domain words. A token on this list is never
// a screened word (the full-venture-name rule still applies). "clean room design" is not refused in a room named room.
const IDENTITY_STOP_LIST = Object.freeze([
  'room', 'venture', 'project', 'company', 'startup', 'labs', 'group', 'systems', 'solutions', 'technologies',
  'global', 'health', 'energy', 'data', 'market', 'platform', 'network', 'digital', 'research', 'design', 'care',
  'food', 'water', 'power', 'cloud', 'mobile', 'smart', 'green', 'blue', 'open', 'new', 'test', 'demo',
]);

const IDENTITY_MIN_LETTERS = 4;
const IDENTITY_FILE_CAP = 200;
const IDENTITY_READ_CAP = 262144;
const UNKNOWN_VENTURE = 'unknown venture';

/** Lower-case a text and split it on every character outside a-z and 0-9. */
function identityTokens(text) {
  return String(text == null ? '' : text).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * The venture name, from roomVentureNameOf, the same name as the persona domain (Phase 400.2.1, S3). The screen needs a
 * name that the room states: a STATE.md venture line, a real heading or the ROOM.md icm_self.room name. A name from the
 * directory or the fallback gives null, so the screen does not run (DESIGN 8).
 */
const SCREEN_NAME_SOURCES = Object.freeze(['venture_line', 'heading', 'room_md']);
function readVentureName(roomResolved) {
  // Round 3 (N1): no early return when STATE.md cannot be read; the ROOM.md icm_self.room name still counts.
  const named = roomVentureNameOf(roomResolved);
  return SCREEN_NAME_SOURCES.includes(named.source) ? named.name : null;
}

/** Base names (no extension) of the files under team/, to a depth of 3. */
function teamFileBaseNames(roomResolved) {
  const out = [];
  function walk(dir, depth) {
    if (depth > 3 || out.length >= IDENTITY_FILE_CAP) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return;
    }
    for (const ent of entries) {
      if (out.length >= IDENTITY_FILE_CAP) return;
      if (ent.isDirectory()) walk(path.join(dir, ent.name), depth + 1);
      else if (ent.isFile()) out.push(path.basename(ent.name, path.extname(ent.name)));
    }
  }
  walk(path.join(roomResolved, 'team'), 1);
  return out;
}

/**
 * Proper-noun candidates of a text: a word that starts with a capital letter and is not the first word of a line
 * (a heading or a list item counts as a line) or of a sentence. A limit that the card covers: an abbreviation such
 * as "Dr." ends a sentence for this rule.
 */
function properNounCandidates(text) {
  const out = [];
  const lines = String(text).split(/\r?\n/);
  for (const line of lines) {
    const re = /[A-Za-z][A-Za-z0-9'’]*/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      const before = line.slice(0, m.index).replace(/[\s"'“”‘’(\[\]*_`>#-]+$/, '');
      const first = before === '' || /[.!?]$/.test(before);
      if (!first && /^[A-Z]/.test(m[0])) out.push(m[0]);
    }
  }
  return out;
}

/**
 * The room identity screen (DESIGN 8). It collects the names of the room that must not enter a search string.
 * It returns {ran, venture_name_found, tokens_checked} as visible fields. The token set, the venture tokens and the
 * methods are not enumerable, so no serialised form holds a token.
 * @param {string} roomDir
 * @param {string[]} [readingList] - room-relative paths of the reading-list files
 */
function roomIdentityScreen(roomDir, readingList) {
  const roomResolved = path.resolve(roomDir);
  const ventureName = readVentureName(roomResolved);
  const ventureTokens = ventureName ? identityTokens(ventureName) : [];
  const found = ventureName !== null && ventureTokens.length > 0 && ventureName.toLowerCase().trim() !== UNKNOWN_VENTURE;
  const tokens = new Set();
  if (found) {
    for (const t of ventureTokens) tokens.add(t);
    for (const t of identityTokens(path.basename(roomResolved))) tokens.add(t);
    for (const name of teamFileBaseNames(roomResolved)) for (const t of identityTokens(name)) tokens.add(t);
    const list = Array.isArray(readingList) ? readingList : [];
    let realRoom = null;
    try { realRoom = fs.realpathSync(roomResolved); } catch (e) { realRoom = null; }
    for (const rel of list) {
      if (typeof rel !== 'string' || rel.length === 0 || rel.length > 300) continue;
      try {
        const abs = path.resolve(roomResolved, rel.replace(/\\/g, '/'));
        const back = path.relative(roomResolved, abs);
        if (back === '' || back.startsWith('..') || path.isAbsolute(back)) continue;
        const real = fs.realpathSync(abs);
        const inside = realRoom ? path.relative(realRoom, real) : '..';
        if (inside === '' || inside.startsWith('..') || path.isAbsolute(inside)) continue;
        if (!fs.statSync(real).isFile()) continue;
        const buf = fs.readFileSync(real);
        const text = buf.slice(0, IDENTITY_READ_CAP).toString('utf8');
        for (const cand of properNounCandidates(text)) for (const t of identityTokens(cand)) tokens.add(t);
      } catch (e) {
        // An unreadable reading-list file adds no token. The card stays the final control.
      }
    }
  }
  const screen = {
    ran: found,
    venture_name_found: found,
    tokens_checked: found ? tokens.size : 0,
  };
  const hidden = {
    counts: () => ({ ran: screen.ran, venture_name_found: screen.venture_name_found, tokens_checked: screen.tokens_checked }),
    has: (token) => found && tokens.has(String(token).toLowerCase()),
    ventureTokens: found ? ventureTokens.slice() : [],
    toJSON: () => ({ ran: screen.ran, venture_name_found: screen.venture_name_found, tokens_checked: screen.tokens_checked }),
  };
  for (const k of Object.keys(hidden)) {
    Object.defineProperty(screen, k, { value: hidden[k], enumerable: false, writable: false, configurable: false });
  }
  return screen;
}

/** True when the handle tokens hold a screened word or the full venture name (DESIGN 8, match rule). */
function handleHitsScreen(handleTokens, screen) {
  for (const t of handleTokens) {
    if (t.length >= IDENTITY_MIN_LETTERS && !IDENTITY_STOP_LIST.includes(t) && screen.has(t)) return true;
  }
  const v = screen.ventureTokens;
  if (v.length > 0 && v.length <= handleTokens.length) {
    for (let i = 0; i + v.length <= handleTokens.length; i += 1) {
      let same = true;
      for (let j = 0; j < v.length; j += 1) {
        if (handleTokens[i + j] !== v[j]) { same = false; break; }
      }
      if (same) return true;
    }
  }
  return false;
}


// ---------------------------------------------------------------------------
// The search text screen (Phase 400.2.1, S5)
// ---------------------------------------------------------------------------

// Round 3 (M5): well-known organisation and vendor words of a url path or query. A word on this list is never a screened
// word in a WebFetch url, so a room that names one of them (for example a reading list that cites arXiv) does not block
// every page of that site. Closed list; the host of a url is never screened.
const URL_ORG_TOKENS = Object.freeze([
  'wikipedia', 'wiki', 'google', 'scholar', 'github', 'gitlab', 'arxiv', 'openalex', 'statista', 'python', 'pubmed',
  'ncbi', 'nih', 'doi', 'springer', 'elsevier', 'sciencedirect', 'wiley', 'nature', 'science', 'ieee', 'acm', 'jstor',
  'researchgate', 'semanticscholar', 'huggingface', 'kaggle', 'asknature', 'microsoft', 'amazon', 'apple', 'meta',
  'youtube', 'reddit', 'medium', 'stackoverflow', 'mozilla', 'lean', 'mathlib', 'nist', 'pdf', 'html', 'abs', 'www',
  // Common path words of a url (round 3, M5: "blog" from a reading-list heading blocked a leanprover blog post).
  'blog', 'blogs', 'news', 'post', 'posts', 'article', 'articles', 'docs', 'doc', 'about', 'index', 'page', 'pages',
]);

/** Plus to a space, then decodeURIComponent, inside a try. Pure. @returns {string} */
function decodeForScreen(text) {
  const spaced = String(text).replace(/\+/g, ' ');
  try { return decodeURIComponent(spaced); } catch (e) { return spaced; }
}

/**
 * Round 3 (M3, M5): the texts of a WebFetch url to screen: its path and query, raw and decoded. The host is not
 * screened. A text that is not a url is screened raw and decoded. Pure. @returns {string[]}
 */
function urlScreenTexts(url) {
  let raw = String(url);
  try {
    const u = new URL(raw);
    raw = u.pathname + (u.search ? ' ' + u.search : '');
  } catch (e) { /* not a url: the whole text */ }
  const decoded = decodeForScreen(raw);
  return decoded === raw ? [raw] : [raw, decoded];
}

/**
 * Screen one search text with the door controls: the content fence (auditQueryString), then the room identity screen
 * (DESIGN 8). The check count and the reader search hook use it. With opts.url true, the words of URL_ORG_TOKENS are
 * not screened words. It returns a reason only, never a token.
 * @returns {string|null} egress_violation, room_identity_word, or null
 */
function screenSearchText(text, screen, opts) {
  const o = opts || {};
  const rs = require(path.join(REPO_ROOT, 'lib', 'core', 'rs-egress-prompts.cjs'));
  try {
    rs.auditQueryString(String(text), 'persona-hats');
  } catch (e) {
    return 'egress_violation';
  }
  const screenRan = Boolean(screen) && screen.ran === true && typeof screen.has === 'function';
  if (!screenRan) return null;
  let tokens = identityTokens(text);
  if (o.url === true) tokens = tokens.filter(t => !URL_ORG_TOKENS.includes(t));
  return handleHitsScreen(tokens, screen) ? 'room_identity_word' : null;
}

// ---------------------------------------------------------------------------
// The light run ledger read (the same checks as the door)
// ---------------------------------------------------------------------------

function reviewsDirOf(roomResolved) {
  return path.join(roomResolved, 'personas', 'hat-reviews');
}

function findRunDir(roomResolved, runId) {
  if (typeof runId !== 'string' || !RUN_ID_RE.test(runId)) return null;
  let entries;
  try {
    entries = fs.readdirSync(reviewsDirOf(roomResolved), { withFileTypes: true });
  } catch (e) {
    return null;
  }
  for (const e of entries) {
    if (e.isDirectory() && e.name.startsWith(runId + '-') && fs.existsSync(path.join(reviewsDirOf(roomResolved), e.name, 'run.json'))) {
      return path.join(reviewsDirOf(roomResolved), e.name);
    }
  }
  return null;
}

/**
 * Fix after the verification (S5, owner ruling "Fail closed"): true only when the review folder of the room does not
 * exist (ENOENT or ENOTDIR), or exists and can be read. Any other read error (for example EACCES) gives false: the run
 * cannot be looked up, so the hook must block and keep the marker, never read it as "run not found".
 */
function reviewsFolderMissingOrReadable(roomResolved) {
  try {
    fs.readdirSync(reviewsDirOf(roomResolved));
    return true;
  } catch (e) {
    return Boolean(e && (e.code === 'ENOENT' || e.code === 'ENOTDIR'));
  }
}

/** Read the ledger of a run. @returns {{ok: true, dir, ledger} | {ok: false, reason}} */
function readLedger(roomDir, runId) {
  const roomResolved = path.resolve(roomDir);
  const dir = findRunDir(roomResolved, runId);
  if (!dir) return { ok: false, reason: 'run_not_found' };
  const r = readJsonFile(path.join(dir, 'run.json'));
  if (!r.ok) return { ok: false, reason: 'ledger_invalid' };
  const l = r.value;
  if (!l || l.schema !== 'mos.persona-run/1' || l.run_id !== runId || !l.steps || !l.hats) return { ok: false, reason: 'ledger_invalid' };
  // IN-03: brief_hash names a store file; a hand-edited value must not reach a path.
  if (typeof l.brief_hash !== 'string' || !/^[0-9a-f]{64}$/.test(l.brief_hash)) return { ok: false, reason: 'ledger_invalid' };
  return { ok: true, dir, ledger: l };
}

// ---------------------------------------------------------------------------
// The reader search marker (Phase 400.2.1, S5). Owner rulings 2026-11-26: "A: screen with a hook" and "Fail closed,
// plus an off switch". The door writes the marker (writeReaderMarker); this module reads and removes it.
// ---------------------------------------------------------------------------

const READER_MARKER_SCHEMA = 'mos.persona-reader-search-marker/1';
const READER_MARKER_MAX_AGE_MS = 2 * 60 * 60 * 1000;
const READER_MARKER_RE = /^(\d{8}-\d{6}-[0-9a-f]{4})\.json$/;
const DISARM_COMMAND = 'node scripts/persona-hats.cjs disarm-reader-screen --run <run_id>';

function readerMarkerDir(homeDir) {
  return path.join(homeDir, 'persona-hats', 'reader-search');
}

/** Remove the marker of a run. @returns {boolean} true when no marker is left */
function removeReaderMarker(homeDir, runId) {
  try { fs.rmSync(path.join(readerMarkerDir(homeDir), runId + '.json'), { force: true }); return true; } catch (e) { return false; }
}

/**
 * The live markers. A marker that is not valid, is past expires_at, or is older than the maximum age is stale: it is
 * removed and not returned. @returns {Array<{run_id: string, room: string}>}
 */
function liveReaderMarkers(homeDir, now) {
  const dir = readerMarkerDir(homeDir);
  let names = [];
  try { names = fs.readdirSync(dir); } catch (e) { return []; }
  const t = (now instanceof Date ? now : new Date()).getTime();
  const out = [];
  for (const name of names) {
    const m = READER_MARKER_RE.exec(name);
    if (!m) continue;
    const r = readJsonFile(path.join(dir, name), { noSymlink: true });
    const v = r.ok ? r.value : null;
    const created = v && typeof v.created_at === 'string' ? Date.parse(v.created_at) : NaN;
    const expires = v && typeof v.expires_at === 'string' ? Date.parse(v.expires_at) : NaN;
    const valid = isPlain(v) && v.schema === READER_MARKER_SCHEMA && v.run_id === m[1] && typeof v.room === 'string'
      && Number.isFinite(created) && Number.isFinite(expires);
    if (!valid || t > expires || t - created > READER_MARKER_MAX_AGE_MS) {
      try { fs.rmSync(path.join(dir, name), { force: true }); } catch (e) { /* the next call removes it */ }
      continue;
    }
    out.push({ run_id: v.run_id, room: v.room });
  }
  return out;
}

/**
 * The verdict of the reader search hook for one tool call: the first live marker whose screen hits the text. For
 * WebSearch the query is screened; for WebFetch the path and query of the url, raw and decoded (not the host).
 * Round 3 (M1): a marker is removed only when its run is not found or its run is merged. Any other ledger failure is a
 * block with reader_search_screen_unavailable (fail closed). A review folder that cannot be read (not missing) also blocks.
 * @returns {{block: boolean, reason: string|null, run_id: string|null, markers: number}}
 */
function readerSearchVerdict(tool, text, homeDir, now) {
  const markers = liveReaderMarkers(homeDir, now);
  const isUrl = tool === 'WebFetch';
  const texts = isUrl ? urlScreenTexts(text) : [String(text), decodeForScreen(text)].filter((x, i, a) => a.indexOf(x) === i);
  for (const mk of markers) {
    const lr = readLedger(mk.room, mk.run_id);
    if (!lr.ok) {
      if (lr.reason === 'run_not_found' && reviewsFolderMissingOrReadable(path.resolve(mk.room))) { removeReaderMarker(homeDir, mk.run_id); continue; }
      return { block: true, reason: 'reader_search_screen_unavailable', run_id: mk.run_id, markers: markers.length };
    }
    if (lr.ledger.steps && lr.ledger.steps.merge) { removeReaderMarker(homeDir, mk.run_id); continue; }
    const screen = roomIdentityScreen(mk.room, lr.ledger.brief && lr.ledger.brief.reading_list);
    for (const t of texts) {
      const reason = screenSearchText(t, screen, { url: isUrl });
      if (reason) return { block: true, reason, run_id: mk.run_id, markers: markers.length };
    }
  }
  return { block: false, reason: null, run_id: null, markers: markers.length };
}

module.exports = {
  MAX_JSON_BYTES,
  RUN_ID_RE,
  readJsonFile,
  GENERATED_STATE_HEADING,
  generatedStateHeadings,
  isGeneratedStateHeading,
  domainSlug,
  icmSelfRoomName,
  roomVentureNameOf,
  roomVentureName,
  IDENTITY_STOP_LIST,
  IDENTITY_MIN_LETTERS,
  IDENTITY_FILE_CAP,
  IDENTITY_READ_CAP,
  UNKNOWN_VENTURE,
  identityTokens,
  readVentureName,
  teamFileBaseNames,
  properNounCandidates,
  roomIdentityScreen,
  handleHitsScreen,
  URL_ORG_TOKENS,
  decodeForScreen,
  urlScreenTexts,
  screenSearchText,
  reviewsDirOf,
  findRunDir,
  reviewsFolderMissingOrReadable,
  readLedger,
  READER_MARKER_SCHEMA,
  READER_MARKER_MAX_AGE_MS,
  READER_MARKER_RE,
  DISARM_COMMAND,
  readerMarkerDir,
  removeReaderMarker,
  liveReaderMarkers,
  readerSearchVerdict,
};
