'use strict';
/*
 * lib/core/doctor/icm-walk-module.cjs -- quick 261005-vi3.
 *
 * The ICM walk as a doctor tool, measurement first. It mechanizes the audit in
 * .planning/briefs/2026-10-05-prove-one-authority/FEYMINTO-ICM-AUDIT.md: for the room root and every
 * nest (a non-dot directory that holds a ROOM.md or a CONTEXT.md) it reports MEASURED values for the ten
 * ICM invariants and the walk test. Counts, bytes, approximate tokens (bytes / 4, rounded up) and
 * presence booleans only. A file that is not there is reported as missing and never scored. No row is
 * "passed" by assumption, and the only words beyond the numbers are the measured flags: over 60 lines,
 * over 8000 tokens, over budget, missing, duplicate, stale, no Room node.
 *
 * WHAT IT NEVER DOES. It writes nothing, fixes nothing and sends nothing. There is no fix() export and no
 * check() export on purpose: this is a sibling mode of scripts/doctor.cjs (`--icm-walk`, like
 * `--bind-check`), not a registry module, so it never joins the drift tally or the --fix flow.
 *
 * Canon Part 8: pure LOCAL reads. Zero network, zero Brain, zero telemetry.
 *
 * THE ROOM.DB DOOR. room.db is read only through the navigation read-only door
 * (openRoomDbReadOnlyForCaller, lib/core/navigation/spine-events.cjs; lib/core/navigation/CONTEXT.md, "The
 * two doors"), never through a direct sqlite require and never through the write door. One more fact
 * measured on a scaffolded room while writing this tool: a read-only open of a WAL-mode database IN PLACE
 * creates room.db-shm and room.db-wal next to it when they are absent (the tree hash of the room changed).
 * "Writes nothing" has to be literally true, so the file is copied (with its -wal and -shm when they exist)
 * into a throwaway temp directory under os.tmpdir() and the door is opened on the copy; the copy is removed
 * afterwards. The room itself is only ever read with fs.readFileSync, fs.statSync and fs.readdirSync.
 *
 * The nest, the walk and the rows (the measurement table of the quick plan):
 *   I1  ROOM.md present; purpose or first heading present; CONTEXT.md job_id
 *   I2  ROOM.md lines, bytes, wikilinks; over 60 lines
 *   I4  CONTEXT.md present; the four ICM parts (inputs, process, outputs, human check) and the three
 *       generated ruling sections (job, methodology sequence, writing rules) by heading; generated_at
 *   I5  markdown files in the nest carrying a generated marker vs authored files
 *   I6  per face (MINTO.md, FEYNMAN.md, BRAIN.md): present, edit-surface marker, governing_thought_placeholder
 *   I7  bytes and approximate tokens of ROOM.md + CONTEXT.md + MINTO.md + FEYNMAN.md (+ BRIEF.md); over 8000
 *       tokens; FEYNMAN.md body tokens against the 1500 budget
 *   I8a MINTO.md `sources:` entries that are also ROOM.md wikilinks, and the ones that appear nowhere in it
 *   I8b MINTO.md `room:` value vs the room slug; room-level: room.db, the `room:<slug>` Room node, identity rows
 *   I8c BRAIN.md present, brain_query_count, CONTEXT.md section-2 command names that BRAIN.md also names
 *   I9  STATE.md present, its last activity vs the newest file mtime in the nest; research-run counts (room)
 *   I10 files carrying auto_scaffolded, files carrying the seeded-at-birth template line
 *   I0  (room block) core sections present N of 11 (lib/core/section-registry.cjs CORE_SECTIONS, a directory
 *       under the root), the missing names, and the top-level nests found outside the canon
 *   W   walk test: reads to orient, ROOM.md routes, status scannable, referrers of the three face names
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const matter = require('gray-matter');

const { readRegistry } = require('./shared.cjs');
const { CORE_SECTIONS } = require('../section-registry.cjs');
const { openRoomDbReadOnlyForCaller, closeRoomDbForCaller } = require('../navigation/spine-events.cjs');

const PLUGIN_ROOT = path.resolve(__dirname, '..', '..', '..');

const SCHEMA = 'mos.icm-walk/1';
const FACES = ['MINTO.md', 'FEYNMAN.md', 'BRAIN.md'];
const LOAD_FILES = ['ROOM.md', 'CONTEXT.md', 'MINTO.md', 'FEYNMAN.md', 'BRIEF.md'];
const EDIT_MARKERS = ['editable_fields', 'edit_surface', 'human_edited'];
const GENERATED_RE = /DO NOT EDIT|generated_at|last_generated_at|auto_scaffolded/;
const SEEDED_LINE = 'Seeded at birth';
const LAST_ACTIVITY_KEYS = ['computed', 'computed_at', 'last_updated_at', 'auto_created_at', 'last_activity'];
const ROOM_MD_LINE_FLAG = 60;
const LOAD_TOKEN_FLAG = 8000;
const FEYNMAN_TOKEN_BUDGET = 1500;
const MAX_DEPTH = 8;
const REFERRER_DIRS = ['lib', 'scripts', 'hooks'];
const REFERRER_MAX_BYTES = 5 * 1024 * 1024;

// Directories the section walk never descends into (system + build noise); every dot entry is skipped too.
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build']);

// -- small readers (all read-only) ------------------------------------------------------------------------------

function readText(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch (_e) { return null; }
}

function isFile(file) {
  try { return fs.statSync(file).isFile(); } catch (_e) { return false; }
}

function isDir(file) {
  try { return fs.statSync(file).isDirectory(); } catch (_e) { return false; }
}

// The frontmatter reader is gray-matter, the one the section-ruling and room-map modules already use. The body
// is split here by hand so the byte count is exactly what follows the closing fence.
const FENCE_RE = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/;

function splitDoc(text) {
  if (text === null) return { data: {}, body: '' };
  const m = FENCE_RE.exec(text);
  if (!m) return { data: {}, body: text };
  let data = {};
  try { data = matter(text).data || {}; } catch (_e) { data = {}; }
  return { data: (data && typeof data === 'object') ? data : {}, body: text.slice(m[0].length) };
}

function bytesOf(text) { return Buffer.byteLength(text, 'utf8'); }

// Same count as `wc -l` on a newline-terminated file; an unterminated last line still counts as a line.
function lineCount(text) {
  if (text.length === 0) return 0;
  let n = 0;
  for (let i = 0; i < text.length; i += 1) if (text.charCodeAt(i) === 10) n += 1;
  return text.charCodeAt(text.length - 1) === 10 ? n : n + 1;
}

function tokensOf(bytes) { return Math.ceil(bytes / 4); }

function wikilinkTargets(text) {
  const out = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let m;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out;
}

// [[core-hypothesis|Title]], [[scientific-roadmap#roadmap|Title]], [[a/b/ROOM|x]] and a source `core-hypothesis.md`
// all reduce to the same key: the file name without a folder, an alias, an anchor or the .md extension.
function linkKey(raw) {
  const target = String(raw).split('|')[0].split('#')[0].trim();
  return path.posix.basename(target).replace(/\.md$/i, '');
}

function iso(ms) { return new Date(Math.round(ms)).toISOString(); }

function normalizeTime(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  const s = String(value).trim();
  if (s.length === 0) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? s : new Date(t).toISOString();
}

// -- the walk ----------------------------------------------------------------------------------------------------

function holdsRoomOrContext(dir) {
  return isFile(path.join(dir, 'ROOM.md')) || isFile(path.join(dir, 'CONTEXT.md'));
}

function listNests(rootDir) {
  const out = [];
  function walk(dir, depth) {
    if (depth > MAX_DEPTH) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return; }
    entries.forEach(function (e) {
      if (!e.isDirectory()) return;
      if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) return;
      const abs = path.join(dir, e.name);
      if (holdsRoomOrContext(abs)) out.push(abs);
      walk(abs, depth + 1);
    });
  }
  walk(rootDir, 0);
  return out;
}

// The files that belong to one nest: everything under it except dot entries and the sub-directories that are
// nests of their own.
function scopeFiles(dir, nestSet) {
  const out = [];
  function walk(d, depth) {
    if (depth > MAX_DEPTH) return;
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (_e) { return; }
    entries.forEach(function (e) {
      if (e.name.startsWith('.')) return;
      const abs = path.join(d, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name) || nestSet.has(abs)) return;
        walk(abs, depth + 1);
      } else if (e.isFile()) {
        out.push({ abs: abs, rel: path.relative(dir, abs) });
      }
    });
  }
  walk(dir, 0);
  return out;
}

// -- referrers (measured once per run, cached) -------------------------------------------------------------------

let _referrerCache = null;

function countReferrers() {
  if (_referrerCache) return _referrerCache;
  const counts = {};
  FACES.forEach(function (f) { counts[f] = 0; });
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return; }
    entries.forEach(function (e) {
      if (e.name === 'node_modules' || e.name === '.git') return;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) { walk(abs); return; }
      if (!e.isFile()) return;
      let buf;
      try {
        if (fs.statSync(abs).size > REFERRER_MAX_BYTES) return;
        buf = fs.readFileSync(abs);
      } catch (_e) { return; }
      if (buf.indexOf(0) !== -1) return; // binary: the same files `grep -I` skips
      const text = buf.toString('utf8');
      FACES.forEach(function (f) { if (text.indexOf(f) !== -1) counts[f] += 1; });
    });
  }
  REFERRER_DIRS.forEach(function (d) { walk(path.join(PLUGIN_ROOT, d)); });
  _referrerCache = counts;
  return counts;
}

// -- room.db (read through the navigation read door, on a throwaway copy) ----------------------------------------

function readRoomDb(roomDir, slug) {
  const src = path.join(roomDir, '.mindrian', 'room.db');
  const empty = { room_db: 'missing', room_node: null, identity_rows_total: null, identity_rows_naming_room: null, slug_db_agreement: null };
  if (!isFile(src)) return empty;
  let tmp = null;
  let db = null;
  try {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'icm-walk-'));
    fs.mkdirSync(path.join(tmp, '.mindrian'));
    ['', '-wal', '-shm'].forEach(function (suffix) {
      if (isFile(src + suffix)) fs.copyFileSync(src + suffix, path.join(tmp, '.mindrian', 'room.db' + suffix));
    });
    db = openRoomDbReadOnlyForCaller(tmp);
    if (!db) return Object.assign({}, empty, { room_db: 'unreadable' });
    const nodeCols = db.prepare('PRAGMA table_info(nodes)').all().map(function (c) { return c.name; });
    const roomNode = nodeCols.indexOf('id') === -1
      ? null
      : db.prepare('SELECT COUNT(*) AS n FROM nodes WHERE id = ?').get('room:' + slug).n > 0;
    const idCols = db.prepare('PRAGMA table_info(identity)').all().map(function (c) { return c.name; });
    let total = null;
    let naming = null;
    if (idCols.indexOf('key') !== -1 && idCols.indexOf('value') !== -1) {
      const rows = db.prepare('SELECT key, value FROM identity').all();
      total = rows.length;
      naming = rows.filter(function (r) { return String(r.key).indexOf(slug) !== -1 || String(r.value).indexOf(slug) !== -1; }).length;
    }
    let agreement = null;
    if (roomNode !== null || naming !== null) agreement = roomNode === true || (naming !== null && naming > 0);
    return { room_db: 'present', room_node: roomNode, identity_rows_total: total, identity_rows_naming_room: naming, slug_db_agreement: agreement };
  } catch (_e) {
    return Object.assign({}, empty, { room_db: 'unreadable' });
  } finally {
    try { closeRoomDbForCaller(db); } catch (_e) { /* best effort */ }
    if (tmp) { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best effort */ } }
  }
}

// I0: the eleven core sections. A core section is present when its directory exists under the root; a non-core
// directory is a top-level nest (a folder holding ROOM.md or CONTEXT.md) whose name is not one of the eleven.
function measureCoreSections(root, nestDirs) {
  const names = Object.keys(CORE_SECTIONS);
  const missing = names.filter(function (n) { return !isDir(path.join(root, n)); });
  const nonCore = nestDirs
    .map(function (abs) { return path.relative(root, abs); })
    .filter(function (rel) { return rel.indexOf(path.sep) === -1 && names.indexOf(rel) === -1; });
  return { core_present: names.length - missing.length, core_total: names.length, core_missing: missing, non_core_directories: nonCore };
}

function countResearchRuns(roomDir) {
  const base = path.join(roomDir, '.mindrian', 'research-runs');
  const out = { runs: 0, plan_json: 0, run_json: 0, operations_json: 0 };
  let entries;
  try { entries = fs.readdirSync(base, { withFileTypes: true }); } catch (_e) { return out; }
  entries.forEach(function (e) {
    if (!e.isDirectory()) return;
    out.runs += 1;
    if (isFile(path.join(base, e.name, 'plan.json'))) out.plan_json += 1;
    if (isFile(path.join(base, e.name, 'run.json'))) out.run_json += 1;
    if (isFile(path.join(base, e.name, 'operations.json'))) out.operations_json += 1;
  });
  return out;
}

// -- one block ---------------------------------------------------------------------------------------------------

const PART_RE = {
  inputs: /^#{1,6}[ \t]+(?:\d+\.[ \t]+)?Inputs?\b/mi,
  process: /^#{1,6}[ \t]+(?:\d+\.[ \t]+)?Process\b/mi,
  outputs: /^#{1,6}[ \t]+(?:\d+\.[ \t]+)?Outputs?\b/mi,
  human_check: /^#{1,6}[ \t]+(?:\d+\.[ \t]+)?Human check\b/mi,
  ruling_job: /^#{1,6}[ \t]+(?:\d+\.[ \t]+)?Job\b/mi,
  ruling_methodology_sequence: /^#{1,6}[ \t]+(?:\d+\.[ \t]+)?Methodology sequence\b/mi,
  ruling_writing_rules: /^#{1,6}[ \t]+(?:\d+\.[ \t]+)?Writing rules\b/mi,
};

function sectionTwoNames(contextText) {
  const start = /^##[ \t]+2\.[ \t]/m.exec(contextText);
  if (!start) return [];
  const rest = contextText.slice(start.index + start[0].length);
  const next = /^##[ \t]+\d+\.[ \t]/m.exec(rest);
  const section = next ? rest.slice(0, next.index) : rest;
  const seen = {};
  (section.match(/\/mos:[a-z0-9-]+/g) || []).forEach(function (n) { seen[n] = true; });
  return Object.keys(seen);
}

function truthy(v) {
  if (v === undefined || v === null || v === false) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'string') return v.trim().length > 0;
  return true;
}

function measureBlock(dir, rel, kind, slug, nestSet, referrers) {
  const text = {};
  const fm = {};
  const present = {};
  ['ROOM.md', 'CONTEXT.md', 'MINTO.md', 'FEYNMAN.md', 'BRAIN.md', 'BRIEF.md', 'STATE.md'].forEach(function (f) {
    const t = readText(path.join(dir, f));
    present[f] = t !== null;
    text[f] = t;
    fm[f] = splitDoc(t);
  });
  const room = present['ROOM.md'];
  const ctx = present['CONTEXT.md'];

  // I1
  let purposeOrHeading = null;
  if (room) {
    const d = fm['ROOM.md'].data;
    purposeOrHeading = (typeof d.purpose === 'string' && d.purpose.trim().length > 0) || /^#[ \t]+\S/m.test(fm['ROOM.md'].body);
  }
  const jobId = ctx && typeof fm['CONTEXT.md'].data.job_id === 'string' ? fm['CONTEXT.md'].data.job_id : null;
  const I1 = { room_md: room, purpose_or_heading: purposeOrHeading, job_id: jobId };

  // I2
  const roomLinks = room ? wikilinkTargets(text['ROOM.md']) : null;
  const I2 = room
    ? {
      lines: lineCount(text['ROOM.md']), bytes: bytesOf(text['ROOM.md']), wikilinks: roomLinks.length,
      over_60_lines: lineCount(text['ROOM.md']) > ROOM_MD_LINE_FLAG,
    }
    : { lines: null, bytes: null, wikilinks: null, over_60_lines: null };

  // I4
  const part = function (name) { return ctx ? PART_RE[name].test(text['CONTEXT.md']) : null; };
  const I4 = {
    context_md: ctx,
    inputs: part('inputs'), process: part('process'), outputs: part('outputs'), human_check: part('human_check'),
    ruling_job: part('ruling_job'), ruling_methodology_sequence: part('ruling_methodology_sequence'), ruling_writing_rules: part('ruling_writing_rules'),
    generated_at: ctx ? Object.prototype.hasOwnProperty.call(fm['CONTEXT.md'].data, 'generated_at') : null,
  };

  // I5, I10 and the newest mtime share one scope
  const files = scopeFiles(dir, nestSet);
  const mdFiles = files.filter(function (f) { return /\.md$/i.test(f.rel); });
  let generated = 0;
  let scaffolded = 0;
  let seeded = 0;
  mdFiles.forEach(function (f) {
    const t = readText(f.abs) || '';
    if (GENERATED_RE.test(t)) generated += 1;
    if (t.indexOf('auto_scaffolded') !== -1) scaffolded += 1;
    if (t.indexOf(SEEDED_LINE) !== -1) seeded += 1;
  });
  const I5 = { md_files: mdFiles.length, generated_marked: generated, authored: mdFiles.length - generated };
  const I10 = { auto_scaffolded_files: scaffolded, seeded_at_birth_files: seeded };
  let newest = null;
  files.forEach(function (f) {
    if (f.rel === 'STATE.md') return;
    let ms;
    try { ms = fs.statSync(f.abs).mtimeMs; } catch (_e) { return; }
    if (newest === null || ms > newest) newest = ms;
  });

  // I6
  const faces = {};
  FACES.forEach(function (f) {
    if (!present[f]) { faces[f] = { present: false, edit_surface_marker: null, governing_thought_placeholder: null }; return; }
    const d = fm[f].data;
    let placeholder = null;
    if (f === 'MINTO.md' && typeof d.governing_thought_placeholder === 'boolean') placeholder = d.governing_thought_placeholder;
    faces[f] = {
      present: true,
      edit_surface_marker: EDIT_MARKERS.some(function (k) { return truthy(d[k]); }),
      governing_thought_placeholder: placeholder,
    };
  });
  const I6 = { faces: faces };

  // I7
  const loadBytes = {};
  let total = 0;
  LOAD_FILES.forEach(function (f) {
    if (present[f]) { loadBytes[f] = bytesOf(text[f]); total += loadBytes[f]; } else loadBytes[f] = null;
  });
  const feynmanTokens = present['FEYNMAN.md'] ? tokensOf(bytesOf(fm['FEYNMAN.md'].body)) : null;
  const I7 = {
    files: loadBytes, bytes: total, approx_tokens: tokensOf(total), over_8000_tokens: tokensOf(total) > LOAD_TOKEN_FLAG,
    feynman_body_tokens: feynmanTokens, feynman_over_1500: feynmanTokens === null ? null : feynmanTokens > FEYNMAN_TOKEN_BUDGET,
  };

  // I8a
  let I8a = { minto_sources: null, in_room_md: null, absent_from_room_md: null };
  if (present['MINTO.md'] && room) {
    let sources = fm['MINTO.md'].data.sources;
    if (typeof sources === 'string') sources = sources.split(',');
    sources = Array.isArray(sources) ? sources.map(function (s) { return linkKey(s); }).filter(function (s) { return s.length > 0; }) : [];
    const linked = new Set(roomLinks.map(linkKey));
    const dup = sources.filter(function (s) { return linked.has(s); }).length;
    I8a = { minto_sources: sources.length, in_room_md: dup, absent_from_room_md: sources.length - dup };
  }

  // I8b
  const mintoRoom = present['MINTO.md'] && typeof fm['MINTO.md'].data.room === 'string' ? fm['MINTO.md'].data.room : null;
  const I8b = { minto_room: mintoRoom, matches_slug: mintoRoom === null ? null : mintoRoom === slug };

  // I8c
  const names = ctx ? sectionTwoNames(text['CONTEXT.md']) : null;
  const brain = present['BRAIN.md'];
  const queryCount = brain && typeof fm['BRAIN.md'].data.brain_query_count === 'number' ? fm['BRAIN.md'].data.brain_query_count : null;
  const I8c = {
    brain_md: brain,
    brain_query_count: queryCount,
    context_command_names: names === null ? null : names.length,
    restated: names !== null && brain ? names.filter(function (n) { return text['BRAIN.md'].indexOf(n) !== -1; }).length : null,
  };

  // I9
  let lastActivity = null;
  if (present['STATE.md']) {
    const d = fm['STATE.md'].data;
    for (let i = 0; i < LAST_ACTIVITY_KEYS.length && lastActivity === null; i += 1) lastActivity = normalizeTime(d[LAST_ACTIVITY_KEYS[i]]);
  }
  let stale = null;
  if (lastActivity !== null && newest !== null && !Number.isNaN(Date.parse(lastActivity))) stale = Date.parse(lastActivity) < Math.round(newest);
  const I9 = {
    state_md: present['STATE.md'],
    last_activity: lastActivity,
    newest_file_mtime: newest === null ? null : iso(newest),
    stale: stale,
  };

  // W
  const W = {
    reads_needed: ['ROOM.md', 'CONTEXT.md', 'BRIEF.md'].filter(function (f) { return present[f]; }).length,
    room_md_routes: room ? roomLinks.length > 0 : null,
    status_scannable: present['STATE.md'],
    referrers: referrers,
  };

  return { nest: rel, kind: kind, I1: I1, I2: I2, I4: I4, I5: I5, I6: I6, I7: I7, I8a: I8a, I8b: I8b, I8c: I8c, I9: I9, I10: I10, W: W };
}

// -- the room ----------------------------------------------------------------------------------------------------

function walkRoom(roomDir) {
  if (typeof roomDir !== 'string' || !isDir(roomDir)) throw new Error('room directory not found');
  const root = path.resolve(roomDir);
  const slug = path.basename(root);
  const nestDirs = listNests(root).sort(function (a, b) {
    const ra = path.relative(root, a);
    const rb = path.relative(root, b);
    return ra < rb ? -1 : ra > rb ? 1 : 0;
  });
  const nestSet = new Set(nestDirs);
  const referrers = countReferrers();

  const nests = [measureBlock(root, '.', 'root', slug, nestSet, referrers)];
  nestDirs.forEach(function (abs) { nests.push(measureBlock(abs, path.relative(root, abs), 'nest', slug, nestSet, referrers)); });

  const roomInfo = Object.assign({ slug: slug }, readRoomDb(root, slug), { research_runs: countResearchRuns(root), I0: measureCoreSections(root, nestDirs) });

  // the summary: the three duplications and the edit-surface marker, each with its measured count
  const only = nests.filter(function (n) { return n.kind === 'nest'; });
  let sourcesInRoomMd = 0;
  let restated = 0;
  let facesPresent = 0;
  let markerAbsent = 0;
  nests.forEach(function (n) {
    if (n.I8a.in_room_md !== null) sourcesInRoomMd += n.I8a.in_room_md;
    if (n.I8c.restated !== null) restated += n.I8c.restated;
    FACES.forEach(function (f) {
      const face = n.I6.faces[f];
      if (!face.present) return;
      facesPresent += 1;
      if (face.edit_surface_marker === false) markerAbsent += 1;
    });
  });
  const identityInDb = roomInfo.slug_db_agreement === true;
  const summary = {
    nests_walked: only.length,
    nests_with_every_face: only.filter(function (n) { return FACES.every(function (f) { return n.I6.faces[f].present; }); }).length,
    minto_sources_in_room_md: sourcesInRoomMd,
    theo_face_restated_commands: restated,
    identity_in_room_db: identityInDb,
    edit_surface_marker_absent: markerAbsent,
    face_files_present: facesPresent,
    core_sections_present: roomInfo.I0.core_present,
    core_sections_total: roomInfo.I0.core_total,
    duplications_found: (sourcesInRoomMd > 0 ? 1 : 0) + (restated > 0 ? 1 : 0) + (identityInDb ? 0 : 1),
    duplications_possible: 3,
  };

  return { schema: SCHEMA, room: roomInfo, referrers: referrers, nests: nests, summary: summary };
}

// -- the text ----------------------------------------------------------------------------------------------------

function yn(v) { return v === null || v === undefined ? 'n/a' : (v ? 'yes' : 'no'); }
function num(v) { return v === null || v === undefined ? 'n/a' : String(v); }

function renderBlock(n) {
  const L = [];
  L.push(n.kind === 'root' ? '== room root: ' + n.slug + ' ==' : '== nest: ' + n.nest + ' ==');
  const row = function (label, body) { L.push('  ' + label + '  ' + body); };

  row('I1', 'ROOM.md: ' + (n.I1.room_md ? 'present' : 'missing') + ' | purpose or heading: ' + yn(n.I1.purpose_or_heading)
    + ' | job_id: ' + (n.I1.job_id === null ? 'none' : n.I1.job_id));
  row('I2', n.I2.lines === null ? 'ROOM.md: missing'
    : 'lines=' + n.I2.lines + ' bytes=' + n.I2.bytes + ' wikilinks=' + n.I2.wikilinks + (n.I2.over_60_lines ? ' [over 60 lines]' : ''));
  row('I4', n.I4.context_md
    ? 'CONTEXT.md: present | parts: inputs ' + yn(n.I4.inputs) + ', process ' + yn(n.I4.process) + ', outputs ' + yn(n.I4.outputs)
      + ', human check ' + yn(n.I4.human_check) + ' | ruling: job ' + yn(n.I4.ruling_job) + ', methodology sequence '
      + yn(n.I4.ruling_methodology_sequence) + ', writing rules ' + yn(n.I4.ruling_writing_rules) + ' | generated_at: ' + yn(n.I4.generated_at)
    : 'CONTEXT.md: missing');
  row('I5', 'md files=' + n.I5.md_files + ' generated-marked=' + n.I5.generated_marked + ' authored=' + n.I5.authored);
  row('I6', FACES.map(function (f) {
    const face = n.I6.faces[f];
    return f + ': ' + (face.present ? 'present, edit-surface marker ' + yn(face.edit_surface_marker) : 'missing');
  }).join(' | ') + ' | governing_thought_placeholder: ' + num(n.I6.faces['MINTO.md'].governing_thought_placeholder));
  row('I7', LOAD_FILES.map(function (f) { return f + '=' + (n.I7.files[f] === null ? 'missing' : n.I7.files[f]); }).join(' ')
    + ' | total bytes=' + n.I7.bytes + ' approx tokens=' + n.I7.approx_tokens + (n.I7.over_8000_tokens ? ' [over 8000 tokens]' : '')
    + ' | FEYNMAN body tokens=' + (n.I7.feynman_body_tokens === null ? 'missing' : n.I7.feynman_body_tokens + '/' + FEYNMAN_TOKEN_BUDGET)
    + (n.I7.feynman_over_1500 ? ' [over budget]' : ''));
  row('I8a', n.I8a.minto_sources === null ? 'MINTO.md or ROOM.md: missing'
    : 'MINTO sources=' + n.I8a.minto_sources + ' also in ROOM.md links=' + n.I8a.in_room_md + ' in no ROOM.md link=' + n.I8a.absent_from_room_md
      + (n.I8a.in_room_md > 0 ? ' [duplicate]' : ''));
  row('I8b', 'MINTO room: ' + (n.I8b.minto_room === null ? 'n/a' : n.I8b.minto_room) + ' | matches slug: ' + yn(n.I8b.matches_slug));
  row('I8c', 'BRAIN.md: ' + (n.I8c.brain_md ? 'present, brain_query_count=' + num(n.I8c.brain_query_count) : 'missing')
    + ' | CONTEXT section-2 command names=' + num(n.I8c.context_command_names) + ' restated in BRAIN.md=' + num(n.I8c.restated)
    + (n.I8c.restated > 0 ? ' [duplicate]' : ''));
  row('I9', 'STATE.md: ' + (n.I9.state_md ? 'present, last activity ' + num(n.I9.last_activity) : 'missing')
    + ' | newest file ' + num(n.I9.newest_file_mtime) + (n.I9.stale ? ' [stale]' : ''));
  row('I10', 'auto_scaffolded files=' + n.I10.auto_scaffolded_files + ' seeded-at-birth files=' + n.I10.seeded_at_birth_files);
  row('W', 'reads to orient=' + n.W.reads_needed + ' | ROOM.md routes: ' + yn(n.W.room_md_routes) + ' | status scannable: ' + yn(n.W.status_scannable)
    + ' | referrers ' + FACES.map(function (f) { return f + '=' + n.W.referrers[f]; }).join(' '));
  return L;
}

function renderText(report) {
  const L = [];
  const r = report.room;
  report.nests.forEach(function (n, i) {
    const block = renderBlock(Object.assign({ slug: r.slug }, n));
    L.push.apply(L, block);
    if (i === 0) {
      const runs = r.research_runs;
      L.push('  room.db: ' + r.room_db + ' | Room node: ' + (r.room_node === null ? 'n/a' : (r.room_node ? 'yes' : 'no'))
        + ' | identity rows: ' + num(r.identity_rows_total) + ' total, ' + num(r.identity_rows_naming_room) + ' naming the room'
        + ' | research runs: ' + runs.runs + ' (plan.json ' + runs.plan_json + ', run.json ' + runs.run_json + ', operations.json ' + runs.operations_json + ')');
    }
    if (i === 0) {
      const c = r.I0;
      L.push('  I0  core sections present: ' + c.core_present + ' of ' + c.core_total
        + ' | missing: ' + (c.core_missing.length === 0 ? 'none' : c.core_missing.join(', '))
        + ' | non-core directories (' + c.non_core_directories.length + '): ' + (c.non_core_directories.length === 0 ? 'none' : c.non_core_directories.join(', ')));
    }
    L.push('');
  });
  const s = report.summary;
  L.push('== room summary ==');
  L.push('room: ' + r.slug);
  L.push('nests walked: ' + s.nests_walked);
  L.push('nests with every face: ' + s.nests_with_every_face);
  L.push('core sections present: ' + s.core_sections_present + ' of ' + s.core_sections_total);
  L.push('MINTO sources also listed in ROOM.md links: ' + s.minto_sources_in_room_md);
  L.push('Theo face restating CONTEXT.md sequence: ' + s.theo_face_restated_commands + ' command name(s)');
  L.push('room identity in room.db: ' + (s.identity_in_room_db ? 'yes' : 'no')
    + ' (room.db: ' + r.room_db + ', Room node: ' + (r.room_node === null ? 'n/a' : (r.room_node ? 'yes' : 'no'))
    + ', identity rows naming the room: ' + num(r.identity_rows_naming_room) + ')'
    + (s.identity_in_room_db ? '' : ' [no Room node or identity row: the slug is the only identity]'));
  L.push('edit-surface marker absent: ' + s.edit_surface_marker_absent + ' of ' + s.face_files_present + ' face file(s)');
  L.push('duplications found: ' + s.duplications_found + ' of ' + s.duplications_possible);
  return L.join('\n') + '\n';
}

// -- room resolution ---------------------------------------------------------------------------------------------

// --room <dir> wins; otherwise the doctor's own registry resolution (the one the class-E room-md check uses):
// the registry's active room, an absolute registry path as is, else joined onto the rooms home.
function resolveRoomDir(arg) {
  if (typeof arg === 'string' && arg.length > 0) {
    const abs = path.resolve(arg);
    if (!isDir(abs)) throw new Error('room directory not found: ' + arg);
    return abs;
  }
  const reg = readRegistry();
  const active = reg && reg.registry && reg.registry.active;
  const info = active && reg.registry.rooms ? reg.registry.rooms[active] : null;
  if (!info || !info.path) throw new Error('no room to walk: pass --room <dir> or bind an active room');
  const abs = path.isAbsolute(info.path) ? info.path : path.join(reg.roomsHome, info.path);
  if (!isDir(abs)) throw new Error('the active room directory is not there: ' + active);
  return abs;
}

module.exports = {
  walkRoom,
  renderText,
  resolveRoomDir,
  SCHEMA,
};
