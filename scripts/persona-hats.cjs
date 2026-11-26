#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 400.2-05 -- persona-hats: the ONE CLI door of the persona cycle. Every
 * deterministic step of the deep and quick persona review is a call of this script,
 * so a later step can refuse a step that did not happen. The command prose cannot
 * skip a step: each subcommand reads the run ledger first.
 *
 * CANON PART 7 (Reuse Before Build): the Bono research leg has no door and prose-only
 * wiring is what failed there (DESIGN 4.3). Precedents reused: the flag parser, the
 * file-path input and the switch-case router of scripts/dominant-design-research.cjs.
 * CANON PART 8 (Graph Boundary): navigator text and room text enter by JSON file path
 * only, never as argv text. This script sends nothing to the Brain. run-research is the one
 * subcommand that makes a fetch: it sends only the strings that the navigator approved on a
 * card (a screened generic handle plus a fixed qualifier) to the approved providers of the
 * plan (openalex, arxiv, tavily, patents), never to the Brain; host web search results come
 * back through a file. No other subcommand makes a fetch.
 * CANON PART 9 (Memory Locality): this script confirms no truth-claim node. The only
 * writer of persona_status accepted is the function markAccepted, fed by a navigator
 * answer file. room.db is opened only through the navigation chokepoint, in three places:
 * run-research (each finding is filed by wireAccept as a proposed EvidenceClaim under
 * section:personas, with its memory_event rows), merge (persistPersonaFindings writes the
 * HatState bookkeeping nodes of the session log) and record-ruling (one decision_captured
 * event for each stored ruling: ids and the ruling value only).
 * CANON PART 11: this file is a door of the persona surface, not a new invocable surface.
 *
 * Subcommands (SUBCOMMANDS):
 *   status --room <dir>
 *   start --room <dir> --brief <file> [--mode deep|quick]
 *   write-persona --room <dir> --run <id>
 *   accept-persona --room <dir> --run <id> --answer <file>
 *   plan-research --room <dir> --run <id> [--edited <file>]  (the research plan from the stored or proposed handles; an edit of its strings)
 *   run-research --room <dir> --run <id> --approved <file> [--host-results <file>]  (the fetch of the approved strings, the evidence packs, the research states; the results of the host web search)
 *   check --room <dir> --run <id>              (schema, per-hat rules, citation boundary, Blue ledger)
 *   merge --room <dir> --run <id> [--counts <file>] [--quick-result <file>]  (positions, tensions, artifact, run record, cleanup; a quick run merges its quick result)
 *   record-ruling --room <dir> --run <id> --answer <file>  (the navigator ruling on a tension; the only writer of the rulings store)
 *   compare --room <dir> --deep <id> --quick <id>  (one merged deep run and one merged quick run of one brief, side by side)
 *
 * Every subcommand prints one JSON object. A refusal is data: {ok: false, reason}
 * with exit code 0. Exit code 2 is a usage error (unknown subcommand, missing flag).
 *
 * Test seams are function options, never CLI flags: homeDir, tmpDir, now, randomHex.
 * The MindrianOS home is MINDRIAN_HOME, else ~/.mindrian.
 *
 * No em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const REPO_ROOT = path.resolve(__dirname, '..');
const ops = require(path.join(REPO_ROOT, 'lib', 'core', 'persona-ops.cjs'));

const SUBCOMMANDS = Object.freeze(['status', 'start', 'write-persona', 'accept-persona', 'plan-research', 'run-research', 'check', 'merge', 'record-ruling', 'compare']);
const USAGE = 'usage: persona-hats.cjs <' + SUBCOMMANDS.join('|') + '> --room <dir> ...';

const HATS = Object.freeze(Object.keys(ops.HAT_DEFINITIONS));
const RUN_ID_RE = /^\d{8}-\d{6}-[0-9a-f]{4}$/;
const SCRATCH_RE = /^mos-persona-(\d{8}-\d{6}-[0-9a-f]{4})-[0-9a-f]{16}$/;
const SCRATCH_MAX_AGE_MS = 24 * 3600 * 1000;
const MAX_JSON_BYTES = 262144;
const BRIEF_KEYS = ['schema', 'target', 'governing_question', 'sub_questions', 'reading_list', 'mode', 'triage'];
const TRIAGE_KEYS = ['recommended', 'reason'];

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function parseFlags(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (typeof a === 'string' && a.indexOf('--') === 0) {
      const v = argv[i + 1];
      // IN-05: a flag with no value, or one followed by another flag, has the value true (a usage error in main).
      if (typeof v !== 'string' || v.indexOf('--') === 0) {
        flags[a.slice(2)] = true;
      } else {
        flags[a.slice(2)] = v;
        i += 1;
      }
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
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

/** Write JSON through a temporary file in the same directory and a rename. */
function atomicWriteJson(target, obj, mode) {
  const dir = path.dirname(target);
  const tmp = path.join(dir, '.' + path.basename(target) + '.' + process.pid + '.' + crypto.randomBytes(4).toString('hex') + '.tmp');
  try {
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', { encoding: 'utf8', mode: mode || 0o644 });
    if (mode && process.platform !== 'win32') fs.chmodSync(tmp, mode);
    fs.renameSync(tmp, target);
  } catch (e) {
    try { fs.rmSync(tmp, { force: true }); } catch (_) { /* ignore */ }
    throw e;
  }
}

// WR-09: a room-wide store (the rulings store, the handles store) can have two writers in one shared Cowork room.
// Each write takes an exclusive lock file, re-reads the store under the lock, merges by key and renames.
const STORE_LOCK_STALE_MS = 30000;
const STORE_LOCK_WAIT_MS = 2000;

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Run fn while holding the lock file <file>.lock (created with the flag wx). A lock older than the stale age is
 * removed. When the lock stays held past the wait time the result is {ok: false, reason: 'store_busy'}.
 * The test seam deps._lockWaitMs sets the wait time. fn returns the result; an exception of fn passes through.
 */
function withStoreLock(file, deps, fn) {
  const lock = file + '.lock';
  const waitMs = deps && Number.isInteger(deps._lockWaitMs) && deps._lockWaitMs >= 0 ? deps._lockWaitMs : STORE_LOCK_WAIT_MS;
  const started = Date.now();
  let fd = null;
  for (;;) {
    try {
      fd = fs.openSync(lock, 'wx', 0o600);
      break;
    } catch (e) {
      if (!e || e.code !== 'EEXIST') throw e;
    }
    let st = null;
    try { st = fs.statSync(lock); } catch (e) { st = null; }
    if (st && Date.now() - st.mtimeMs > STORE_LOCK_STALE_MS) {
      try { fs.rmSync(lock, { force: true }); } catch (e) { /* a lock that stays ends in store_busy */ }
    }
    if (Date.now() - started >= waitMs) return { ok: false, reason: 'store_busy' };
    if (st) sleepSync(Math.min(25, Math.max(1, waitMs)));
  }
  try { fs.writeSync(fd, String(process.pid)); } catch (e) { /* the lock is the file, not its text */ }
  try { fs.closeSync(fd); } catch (e) { /* ignore */ }
  try {
    return fn();
  } finally {
    try { fs.rmSync(lock, { force: true }); } catch (e) { /* a stale lock is removed by the next writer */ }
  }
}

function homeDirOf(deps) {
  return (deps && deps.homeDir) || process.env.MINDRIAN_HOME || path.join(os.homedir(), '.mindrian');
}

function tmpDirOf(deps) {
  return (deps && deps.tmpDir) || os.tmpdir();
}

function nowOf(deps) {
  const n = deps && deps.now !== undefined && deps.now !== null ? new Date(deps.now) : new Date();
  return Number.isNaN(n.getTime()) ? new Date() : n;
}

function hexOf(deps, len) {
  if (deps && typeof deps.randomHex === 'function') return String(deps.randomHex(len));
  return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len);
}

function sha256Hex(textOrBytes) {
  return crypto.createHash('sha256').update(textOrBytes).digest('hex');
}

function makeRunId(now, deps) {
  const iso = now.toISOString(); // 2026-11-25T10:20:30.000Z
  const date = iso.slice(0, 10).replace(/-/g, '');
  const time = iso.slice(11, 19).replace(/:/g, '');
  return date + '-' + time + '-' + hexOf(deps, 4);
}

function roomDirCheck(roomDir) {
  if (typeof roomDir !== 'string' || roomDir.length === 0) return null;
  const resolved = path.resolve(roomDir);
  try {
    if (!fs.statSync(resolved).isDirectory()) return null;
  } catch (e) {
    return null;
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// Brief (S-1)
// ---------------------------------------------------------------------------

/** Normal form of a sub-question (P-4): trim, lower case, each run of white space is one space. */
function normalSubQuestion(text) {
  return String(text).trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Content-derived id (P-4): sq- plus the first 8 hex characters of the SHA-256 of the normal form. */
function subQuestionId(text) {
  return 'sq-' + sha256Hex(normalSubQuestion(text)).slice(0, 8);
}

/**
 * Resolve a room-relative path to an existing regular file inside the room.
 * rel is the lexical relative path; realRel is the relative path of the real file (links resolved) in the real room.
 * @returns {{abs: string, rel: string, realRel: string}|null}
 */
function roomFile(roomResolved, value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 300) return null;
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  const norm = value.replace(/\\/g, '/');
  if (path.isAbsolute(norm) || /^[A-Za-z]:/.test(norm)) return null;
  const abs = path.resolve(roomResolved, norm);
  const rel = path.relative(roomResolved, abs);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  let real;
  let realRoom;
  try {
    if (!fs.statSync(abs).isFile()) return null;
    real = fs.realpathSync(abs);
    realRoom = fs.realpathSync(roomResolved);
  } catch (e) {
    return null;
  }
  const back = path.relative(realRoom, real);
  if (back === '' || back.startsWith('..') || path.isAbsolute(back)) return null;
  return { abs, rel: rel.split(path.sep).join('/'), realRel: back.split(path.sep).join('/') };
}

/** WR-10: a path whose lexical or real first component is personas reaches a persona file. */
function underPersonas(f) {
  return f.rel.split('/')[0] === 'personas' || f.realRel.split('/')[0] === 'personas';
}

function nonEmptyString(v, max) {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max;
}

/**
 * Validate a brief against schema S-1 and the room. Never repairs a brief.
 * @returns {{ok: true, brief: Object, targetAbs: string|null} | {ok: false, reason: string}}
 */
function validateBrief(brief, roomDir) {
  const fail = (r) => ({ ok: false, reason: r });
  if (!brief || typeof brief !== 'object' || Array.isArray(brief)) return fail('schema_invalid:brief');
  for (const k of Object.keys(brief)) {
    if (!BRIEF_KEYS.includes(k)) return fail('unknown_key:' + k);
  }
  const roomResolved = path.resolve(roomDir);
  if (brief.schema !== 'mos.persona-brief/1') return fail('schema_invalid:schema');

  let targetAbs = null;
  if (typeof brief.target !== 'string') return fail('schema_invalid:target');
  if (brief.target !== 'room') {
    const t = roomFile(roomResolved, brief.target);
    // WR-10: a target under personas/ would send one hat's persona file to all six readers.
    if (!t || underPersonas(t)) return fail('schema_invalid:target');
    targetAbs = t.abs;
  }
  if (!nonEmptyString(brief.governing_question, 300)) return fail('schema_invalid:governing_question');

  const sq = brief.sub_questions;
  if (!Array.isArray(sq) || sq.length < 2 || sq.length > 5) return fail('schema_invalid:sub_questions');
  if (!sq.every(s => nonEmptyString(s, 200))) return fail('schema_invalid:sub_questions');
  if (new Set(sq.map(normalSubQuestion)).size !== sq.length) return fail('schema_invalid:sub_questions');

  const rl = brief.reading_list;
  if (!Array.isArray(rl) || rl.length < 1 || rl.length > 12) return fail('schema_invalid:reading_list');
  for (let i = 0; i < rl.length; i += 1) {
    const f = roomFile(roomResolved, rl[i]);
    if (!f || underPersonas(f)) return fail('schema_invalid:reading_list');
  }

  if (brief.mode !== 'deep' && brief.mode !== 'quick') return fail('schema_invalid:mode');

  const tr = brief.triage;
  if (!tr || typeof tr !== 'object' || Array.isArray(tr)) return fail('schema_invalid:triage');
  for (const k of Object.keys(tr)) {
    if (!TRIAGE_KEYS.includes(k)) return fail('schema_invalid:triage');
  }
  if (tr.recommended !== 'deep' && tr.recommended !== 'quick') return fail('schema_invalid:triage');
  if (typeof tr.reason !== 'string' || tr.reason.length > 200) return fail('schema_invalid:triage');

  return { ok: true, brief, targetAbs };
}

/** SHA-256 of the canonical JSON of target, governing_question, sub_questions and reading_list. */
function briefHashOf(brief) {
  return sha256Hex(JSON.stringify({
    target: brief.target,
    governing_question: brief.governing_question,
    sub_questions: brief.sub_questions,
    reading_list: brief.reading_list,
  }));
}

function slugOf(question) {
  let handle;
  try {
    // Lazy require: the Bono modules load inside the function only.
    handle = require(path.join(REPO_ROOT, 'lib', 'core', 'bono', 'cell-fanout.cjs')).genericDomainHandle(question);
  } catch (e) {
    handle = String(question).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const words = String(handle).split(' ').filter(Boolean).slice(0, 5);
  return words.join('-') || 'review';
}

// ---------------------------------------------------------------------------
// Ledger (S-8): only this door writes run.json
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

function writeLedger(dir, ledger) {
  atomicWriteJson(path.join(dir, 'run.json'), ledger);
}

/** Refuse a step whose earlier step is absent. @returns {string|null} */
function requireStep(ledger, step) {
  const s = ledger && ledger.steps && ledger.steps[step];
  if (!s || (s.state !== 'done' && s.state !== 'skipped')) return 'step_out_of_order:' + step;
  return null;
}

function markStep(ledger, step, state, now) {
  const seqs = Object.values(ledger.steps).map(s => (s && typeof s.seq === 'number' ? s.seq : 0));
  ledger.steps[step] = { state, at: now.toISOString(), seq: Math.max(0, ...seqs) + 1 };
}

// ---------------------------------------------------------------------------
// Private run map and scratch
// ---------------------------------------------------------------------------

function runMapPath(homeDir, runId) {
  return path.join(homeDir, 'persona-hats', 'runs', runId + '.json');
}

function ensurePrivateDir(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') fs.chmodSync(dir, 0o700);
}

/** Delete scratch trees of this door older than 24 hours and their run maps. @returns {number} */
function sweepScratch(tmpDir, homeDir, now) {
  let entries;
  try {
    entries = fs.readdirSync(tmpDir);
  } catch (e) {
    return 0;
  }
  let n = 0;
  for (const name of entries) {
    const m = SCRATCH_RE.exec(name);
    if (!m) continue;
    const abs = path.join(tmpDir, name);
    let st;
    try { st = fs.lstatSync(abs); } catch (e) { continue; }
    if (!st.isDirectory() || st.isSymbolicLink()) continue;
    if (now.getTime() - st.mtimeMs <= SCRATCH_MAX_AGE_MS) continue;
    try {
      fs.rmSync(abs, { recursive: true, force: true });
      fs.rmSync(runMapPath(homeDir, m[1]), { force: true });
      n += 1;
    } catch (e) { /* a tree that stays is swept at the next start */ }
  }
  return n;
}

/** Read the private run map of a run. @returns {Object|null} */
function readRunMap(homeDir, runId, roomResolved) {
  const r = readJsonFile(runMapPath(homeDir, runId), { noSymlink: true });
  if (!r.ok || !r.value || r.value.run_id !== runId) return null;
  try {
    if (fs.realpathSync(r.value.room) !== fs.realpathSync(roomResolved)) return null;
  } catch (e) {
    return null;
  }
  return r.value;
}

// ---------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------

/** Read-only. Writes nothing. */
function cmdStatus(args, deps) {
  const roomResolved = roomDirCheck(args && args.roomDir);
  if (!roomResolved) return { ok: false, reason: 'room_not_found' };
  const index = ops.roomArtifactIndex(roomResolved);
  const count = Object.values(index.sections).filter(list => list.length > 0).length;
  const freshness = ops.personaFreshness(roomResolved);
  const signals = ops.extractDomainSignals(roomResolved);
  const open = [];
  let entries = [];
  try { entries = fs.readdirSync(reviewsDirOf(roomResolved), { withFileTypes: true }); } catch (e) { entries = []; }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const r = readJsonFile(path.join(reviewsDirOf(roomResolved), e.name, 'run.json'));
    if (!r.ok || !r.value || r.value.schema !== 'mos.persona-run/1') continue;
    if (r.value.steps && r.value.steps.merge) continue;
    open.push({ run_id: r.value.run_id, mode: r.value.mode, steps: Object.keys(r.value.steps || {}) });
  }
  return {
    ok: true,
    room_ok: count >= 2,
    sections_with_artifacts: count,
    fingerprint: freshness.fingerprint,
    hats: freshness.hats,
    venture_name_present: Boolean(signals.ventureName) && signals.ventureName !== 'Unknown Venture',
    open_runs: open,
  };
}

// ---------------------------------------------------------------------------
// start
// ---------------------------------------------------------------------------

function cmdStart(args, deps) {
  const roomResolved = roomDirCheck(args && args.roomDir);
  if (!roomResolved) return { ok: false, reason: 'room_not_found' };
  const read = readJsonFile(args.briefPath);
  if (!read.ok) return { ok: false, reason: read.reason };
  const checked = validateBrief(read.value, roomResolved);
  if (!checked.ok) return checked;
  const brief = checked.brief;
  const mode = args.mode === undefined || args.mode === null ? brief.mode : args.mode;
  if (mode !== 'deep' && mode !== 'quick') return { ok: false, reason: 'schema_invalid:mode' };

  // The room precondition of the door: 2 or more sections with an indexable artifact.
  // The fingerprint is taken here, before any dispatch and before anything is written.
  const index = ops.roomArtifactIndex(roomResolved);
  const sectionsWith = Object.values(index.sections).filter(list => list.length > 0).length;
  if (sectionsWith < 2) return { ok: false, reason: 'room_too_thin' };
  const fingerprint = index.fingerprint;

  const homeDir = homeDirOf(deps);
  const tmpDir = tmpDirOf(deps);
  const now = nowOf(deps);
  sweepScratch(tmpDir, homeDir, now);

  const runId = makeRunId(now, deps);
  const reviews = reviewsDirOf(roomResolved);
  let taken = [];
  try { taken = fs.readdirSync(reviews); } catch (e) { taken = []; }
  if (taken.some(n => n.startsWith(runId + '-'))) return { ok: false, reason: 'run_folder_exists' };
  const reviewDir = path.join(reviews, runId + '-' + slugOf(brief.governing_question));

  // WR-08: the target hash is read here, so a disk error is a refusal and not a throw.
  let targetContentHash = fingerprint;
  if (brief.target !== 'room') {
    try { targetContentHash = sha256Hex(fs.readFileSync(checked.targetAbs)); } catch (e) { return { ok: false, reason: 'target_unreadable' }; }
  }

  const freshness = ops.personaFreshness(roomResolved);
  const toBuild = [];
  const toAccept = [];
  const hatsLedger = {};
  for (const hat of HATS) {
    const state = freshness.hats[hat].state;
    if (mode === 'quick') {
      hatsLedger[hat] = { persona: state === 'fresh' ? 'fresh' : 'fixed_discipline', rebuilds: 0 };
    } else if (state === 'fresh') {
      hatsLedger[hat] = { persona: 'fresh', rebuilds: 0 };
    } else if (state === 'unaccepted') {
      toAccept.push(hat);
      hatsLedger[hat] = { persona: 'proposed', rebuilds: 0 };
      // WR-01: the accept step binds to the bytes of the proposed file as start saw them.
      try {
        hatsLedger[hat].persona_file = freshness.hats[hat].file;
        hatsLedger[hat].persona_file_sha256 = sha256Hex(fs.readFileSync(path.join(roomResolved, 'personas', freshness.hats[hat].file)));
      } catch (e) {
        delete hatsLedger[hat].persona_file;
        delete hatsLedger[hat].persona_file_sha256;
      }
    } else {
      toBuild.push(hat);
      hatsLedger[hat] = { persona: 'pending_build', rebuilds: 0 };
    }
  }

  const ledger = {
    schema: 'mos.persona-run/1',
    run_id: runId,
    mode,
    brief_hash: briefHashOf(brief),
    target: brief.target,
    target_content_hash: targetContentHash,
    room_fingerprint: fingerprint,
    sub_questions: brief.sub_questions.map(text => ({ id: subQuestionId(text), text })),
    brief: { governing_question: brief.governing_question, reading_list: brief.reading_list, triage: brief.triage },
    steps: {},
    hats: hatsLedger,
    to_build: toBuild,
    to_accept: toAccept,
    timestamps: { started_at: now.toISOString() },
  };
  markStep(ledger, 'start', 'done', now);
  if (mode === 'quick' || (toBuild.length === 0 && toAccept.length === 0)) {
    markStep(ledger, 'write_persona', 'skipped', now);
    markStep(ledger, 'accept_persona', 'skipped', now);
  }

  let scratchRoot = null;
  let createdReview = false;
  let mapWritten = false;
  try {
    fs.mkdirSync(reviews, { recursive: true });
    try {
      fs.mkdirSync(reviewDir);
    } catch (e) {
      if (e && e.code === 'EEXIST') return { ok: false, reason: 'run_folder_exists' };
      throw e;
    }
    createdReview = true;

    scratchRoot = path.join(tmpDir, 'mos-persona-' + runId + '-' + hexOf(deps, 16));
    fs.mkdirSync(scratchRoot, { mode: 0o700 });
    if (process.platform !== 'win32') fs.chmodSync(scratchRoot, 0o700);
    const inboxDir = path.join(scratchRoot, 'inbox');
    fs.mkdirSync(inboxDir, { mode: 0o700 });
    if (process.platform !== 'win32') fs.chmodSync(inboxDir, 0o700);
    const hatDirs = {};
    if (mode === 'deep') {
      for (const hat of HATS) {
        const d = path.join(scratchRoot, hat + '-' + hexOf(deps, 16));
        fs.mkdirSync(d, { mode: 0o700 });
        if (process.platform !== 'win32') fs.chmodSync(d, 0o700);
        hatDirs[hat] = d;
      }
    }

    ensurePrivateDir(path.join(homeDir, 'persona-hats'));
    ensurePrivateDir(path.join(homeDir, 'persona-hats', 'runs'));
    atomicWriteJson(runMapPath(homeDir, runId), {
      schema: 'mos.persona-run-map/1',
      run_id: runId,
      room: roomResolved,
      scratch_root: scratchRoot,
      inbox: inboxDir,
      hats: hatDirs,
      created_at: now.toISOString(),
    }, 0o600);
    mapWritten = true;

    let quick = null;
    if (mode === 'quick') quick = ops.quickLook(roomResolved, checked.targetAbs);

    writeLedger(reviewDir, ledger);

    if (mode === 'quick') {
      return { ok: true, run_id: runId, mode, review_dir: reviewDir, inbox_dir: inboxDir, quick };
    }
    const hatsOut = {};
    // CR-01: persona is a state word, never a file name. persona_file is the room-relative file name a hat agent
    // gets, or null when the hat has no usable file yet (it is built or rebuilt in Step 3).
    for (const hat of HATS) {
      const fh = freshness.hats[hat];
      const usable = (fh.state === 'fresh' || fh.state === 'unaccepted') && typeof fh.file === 'string';
      hatsOut[hat] = { persona: fh.state, persona_file: usable ? 'personas/' + fh.file : null, dir: hatDirs[hat], discipline: ops.HAT_DISCIPLINE[hat] };
    }
    // With nothing to build or accept the command goes straight to the handle agents; else accept-persona lists them.
    const handlesList = toBuild.length === 0 && toAccept.length === 0 ? handlesNeeded(roomResolved, ledger) : [];
    return {
      ok: true,
      run_id: runId,
      mode,
      review_dir: reviewDir,
      notice: ops.DEEP_NOTICE,
      room_fingerprint: fingerprint,
      sub_questions: ledger.sub_questions,
      hats: hatsOut,
      to_build: toBuild,
      to_accept: toAccept,
      handles_needed: handlesList,
      inbox_dir: inboxDir,
    };
  } catch (e) {
    if (scratchRoot) { try { fs.rmSync(scratchRoot, { recursive: true, force: true }); } catch (_) { /* ignore */ } }
    if (mapWritten) { try { fs.rmSync(runMapPath(homeDir, runId), { force: true }); } catch (_) { /* ignore */ } }
    if (createdReview) { try { fs.rmSync(reviewDir, { recursive: true, force: true }); } catch (_) { /* ignore */ } }
    return { ok: false, reason: 'start_failed:' + (e && e.code ? e.code : 'error') };
  }
}

// ---------------------------------------------------------------------------
// write-persona
// ---------------------------------------------------------------------------

/**
 * Read the persona spec of each hat that waits for a build and write one proposed persona file
 * for it. A missing or refused spec gives build_failed for that hat only. A hat that is not
 * waiting for a build is not touched.
 */
function cmdWritePersona(args, deps) {
  const roomResolved = roomDirCheck(args && args.roomDir);
  if (!roomResolved) return { ok: false, reason: 'room_not_found' };
  const lr = readLedger(roomResolved, args.runId);
  if (!lr.ok) return lr;
  const ledger = lr.ledger;
  // WR-11: a merged run is closed; a later call must not change the final run record (S-8).
  if (ledger.steps.merge) return { ok: false, reason: 'step_already_done:merge' };
  const order = requireStep(ledger, 'start');
  if (order) return { ok: false, reason: order };
  if (ledger.mode !== 'deep') return { ok: false, reason: 'mode_not_deep' };
  const map = readRunMap(homeDirOf(deps), ledger.run_id, roomResolved);
  if (!map || !map.hats || typeof map.scratch_root !== 'string') return { ok: false, reason: 'run_map_missing' };

  const now = nowOf(deps);
  const results = {};
  for (const hat of HATS) {
    const entry = ledger.hats[hat];
    if (!entry || entry.persona !== 'pending_build') continue;
    const dir = map.hats[hat];
    const inside = typeof dir === 'string' && (() => {
      const rel = path.relative(map.scratch_root, dir);
      return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
    })();
    let reason = null;
    let proposedFile = null;
    if (!inside) {
      reason = 'run_map_missing';
    } else {
      const specPath = path.join(dir, 'persona.json');
      const r = readJsonFile(specPath, { noSymlink: true });
      // WR-01: the spec is consumed. A rebuild whose builder writes no new spec fails; it never re-proposes the old one.
      try { fs.rmSync(specPath, { force: true }); } catch (e) { /* the scratch tree is removed at merge */ }
      if (!r.ok) {
        reason = r.reason === 'file_unreadable' ? 'no_spec_file' : r.reason;
      } else {
        entry.spec_sha256 = r.sha256;
        const w = ops.writeReasonedPersona(roomResolved, hat, r.value, { fingerprint: ledger.room_fingerprint, now });
        if (w.ok) proposedFile = w.file;
        else reason = w.reason;
      }
    }
    let fileSha = null;
    if (!reason) {
      try { fileSha = sha256Hex(fs.readFileSync(path.join(roomResolved, proposedFile))); } catch (e) { reason = 'persona_file_unreadable'; }
    }
    if (reason) {
      entry.persona = 'build_failed';
      entry.persona_reason = reason;
      delete entry.persona_file;
      delete entry.persona_file_sha256;
      results[hat] = { state: 'build_failed:' + reason };
    } else {
      entry.persona = 'proposed';
      delete entry.persona_reason;
      // WR-01: the door binds the accept step to the exact bytes it wrote.
      entry.persona_file = path.basename(proposedFile);
      entry.persona_file_sha256 = fileSha;
      results[hat] = { state: 'proposed', file: proposedFile, spec_sha256: entry.spec_sha256 };
    }
  }
  if (!ledger.steps.write_persona) markStep(ledger, 'write_persona', 'done', now);
  try {
    writeLedger(lr.dir, ledger);
  } catch (e) {
    return { ok: false, reason: 'write_failed:' + (e && e.code ? e.code : 'error') };
  }
  return { ok: true, run_id: ledger.run_id, hats: results };
}

// ---------------------------------------------------------------------------
// accept-persona
// ---------------------------------------------------------------------------

const ACCEPT_KEYS = ['schema', 'run_id', 'hats'];
const ACCEPT_HAT_KEYS = ['decision', 'guidance'];
const DECISIONS = ['accept', 'rebuild', 'refuse', 'defer'];
const REBUILD_LIMIT = 2;
const RESOLVED = ['fresh', 'built_accepted', 'refused', 'build_failed'];

/** Check the answer file (P-3). Never repairs an answer. @returns {string|null} the named reason */
function answerRefusal(answer, runId) {
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return 'schema_invalid:answer';
  for (const k of Object.keys(answer)) {
    if (!ACCEPT_KEYS.includes(k)) return 'schema_invalid:unknown_key:' + k;
  }
  if (answer.schema !== 'mos.persona-accept/1') return 'schema_invalid:schema';
  if (answer.run_id !== runId) return 'schema_invalid:run_id';
  if (!answer.hats || typeof answer.hats !== 'object' || Array.isArray(answer.hats)) return 'schema_invalid:hats';
  for (const hat of Object.keys(answer.hats)) {
    if (!HATS.includes(hat)) return 'schema_invalid:hats.' + hat;
    const d = answer.hats[hat];
    if (!d || typeof d !== 'object' || Array.isArray(d)) return 'schema_invalid:hats.' + hat;
    for (const k of Object.keys(d)) {
      if (!ACCEPT_HAT_KEYS.includes(k)) return 'schema_invalid:hats.' + hat + '.' + k;
    }
    if (!DECISIONS.includes(d.decision)) return 'schema_invalid:hats.' + hat + '.decision';
    if (d.guidance !== undefined && (typeof d.guidance !== 'string' || d.guidance.length > 200)) return 'schema_invalid:hats.' + hat + '.guidance';
  }
  return null;
}

/** Find the proposed persona file of a hat. @returns {{file: string, abs: string, fingerprint: string}|null} */
function findProposedFile(roomResolved, hat) {
  const dir = path.join(roomResolved, 'personas');
  let names = [];
  try { names = fs.readdirSync(dir).filter(n => n.startsWith(hat + '-') && n.endsWith('.md')).sort(); } catch (e) { return null; }
  for (const name of names) {
    let text;
    try { text = fs.readFileSync(path.join(dir, name), 'utf8'); } catch (e) { continue; }
    const m = /^---\n([\s\S]*?)\n---/.exec(text);
    if (!m) continue;
    const lines = m[1].split('\n');
    if (!lines.includes('built_by: persona-analyst') || !lines.includes('persona_status: proposed')) continue;
    const fpLine = lines.find(l => l.startsWith('room_fingerprint:')) || '';
    return { file: name, abs: path.join(dir, name), fingerprint: fpLine.slice('room_fingerprint:'.length).trim().replace(/^"|"$/g, '') };
  }
  return null;
}

/**
 * The ONLY writer of the accepted status in the repository. It changes the 2 frontmatter lines of
 * one persona file (status and accepted_at) through a temporary file and a rename. It runs only
 * from cmdAcceptPersona, after a navigator answer file named the hat.
 * @returns {{ok: true} | {ok: false, reason: string}}
 */
function markAccepted(absFile, nowIso) {
  let text;
  try { text = fs.readFileSync(absFile, 'utf8'); } catch (e) { return { ok: false, reason: 'persona_file_unreadable' }; }
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!m) return { ok: false, reason: 'not_proposed' };
  const lines = m[1].split('\n');
  const at = lines.indexOf('persona_status: proposed');
  if (at === -1) return { ok: false, reason: 'not_proposed' };
  lines.splice(at, 1, 'persona_status: accepted', 'accepted_at: "' + nowIso + '"');
  const next = '---\n' + lines.join('\n') + '\n---' + text.slice(m[0].length);
  const tmp = path.join(path.dirname(absFile), '.' + path.basename(absFile) + '.' + process.pid + '.' + crypto.randomBytes(4).toString('hex') + '.tmp');
  try {
    fs.writeFileSync(tmp, next, 'utf8');
    fs.renameSync(tmp, absFile);
  } catch (e) {
    try { fs.rmSync(tmp, { force: true }); } catch (_) { /* ignore */ }
    return { ok: false, reason: 'write_failed:' + (e && e.code ? e.code : 'error') };
  }
  return { ok: true };
}

/**
 * Apply the answer of Stop 2. It checks the whole answer first and applies it after, so a refused
 * answer changes nothing. The step accept_persona is done only when every hat of to_build and
 * to_accept is resolved. An empty hats object only closes a run whose hats are all resolved.
 */
function cmdAcceptPersona(args, deps) {
  const roomResolved = roomDirCheck(args && args.roomDir);
  if (!roomResolved) return { ok: false, reason: 'room_not_found' };
  const lr = readLedger(roomResolved, args.runId);
  if (!lr.ok) return lr;
  const ledger = lr.ledger;
  // WR-11: a merged run is closed; a later call must not change the final run record (S-8).
  if (ledger.steps.merge) return { ok: false, reason: 'step_already_done:merge' };
  const order = requireStep(ledger, 'write_persona');
  if (order) return { ok: false, reason: order };
  const read = readJsonFile(args.answerPath);
  if (!read.ok) return { ok: false, reason: read.reason };
  const answer = read.value;
  const bad = answerRefusal(answer, ledger.run_id);
  if (bad) return { ok: false, reason: bad };

  const allowed = HATS.filter(h => ledger.to_build.includes(h) || ledger.to_accept.includes(h));
  const found = {};
  for (const hat of Object.keys(answer.hats)) {
    if (!allowed.includes(hat)) return { ok: false, reason: 'no_proposed_file:' + hat };
    // WR-01: only a hat whose current build is proposed can be answered; pending_build and build_failed cannot.
    if (!ledger.hats[hat] || ledger.hats[hat].persona !== 'proposed') return { ok: false, reason: 'not_proposed:' + hat };
    const f = findProposedFile(roomResolved, hat);
    if (!f) return { ok: false, reason: 'no_proposed_file:' + hat };
    if (f.fingerprint !== ledger.room_fingerprint) return { ok: false, reason: 'persona_file_changed:' + hat };
    // WR-01: the file must be the one the door wrote (or the one start saw), byte for byte.
    let fileSha = null;
    try { fileSha = sha256Hex(fs.readFileSync(f.abs)); } catch (e) { fileSha = null; }
    const want = ledger.hats[hat].persona_file_sha256;
    if (typeof want !== 'string' || fileSha !== want || (ledger.hats[hat].persona_file && ledger.hats[hat].persona_file !== f.file)) {
      return { ok: false, reason: 'persona_file_changed:' + hat };
    }
    if (answer.hats[hat].decision === 'rebuild' && (ledger.hats[hat].rebuilds || 0) >= REBUILD_LIMIT) {
      return { ok: false, reason: 'rebuild_limit', hat };
    }
    found[hat] = f;
  }

  const now = nowOf(deps);
  const out = {};
  const toRebuild = [];
  let failure = null;
  for (const hat of HATS) {
    if (!answer.hats[hat]) continue;
    const decision = answer.hats[hat].decision;
    const entry = ledger.hats[hat];
    if (decision === 'accept') {
      const w = markAccepted(found[hat].abs, now.toISOString());
      if (!w.ok) { failure = w.reason + ':' + hat; break; }
      entry.persona = 'built_accepted';
      delete entry.persona_reason;
    } else if (decision === 'rebuild') {
      entry.rebuilds = (entry.rebuilds || 0) + 1;
      entry.persona = 'pending_build';
      delete entry.persona_reason;
      toRebuild.push({ hat, guidance: answer.hats[hat].guidance || '' });
    } else {
      entry.persona = 'refused';
      if (decision === 'defer') entry.persona_reason = 'deferred';
      else delete entry.persona_reason;
    }
    out[hat] = { decision, persona: entry.persona };
  }

  const pending = allowed.filter(h => !RESOLVED.includes(ledger.hats[h].persona));
  if (!failure && pending.length === 0 && !ledger.steps.accept_persona) markStep(ledger, 'accept_persona', 'done', now);
  try {
    writeLedger(lr.dir, ledger);
  } catch (e) {
    return { ok: false, reason: 'write_failed:' + (e && e.code ? e.code : 'error') };
  }
  if (failure) return { ok: false, reason: failure };
  const acceptDone = Boolean(ledger.steps.accept_persona);
  return { ok: true, run_id: ledger.run_id, hats: out, to_rebuild: toRebuild, pending, accept_done: acceptDone, persona_files: personaFilesOf(roomResolved, ledger), handles_needed: acceptDone ? handlesNeeded(roomResolved, ledger) : [] };
}

/**
 * CR-01: the room-relative persona file of each hat that a hat agent may read: a usable persona in the ledger (fresh
 * or built_accepted) and an accepted file with the current fingerprint on disk. Any other hat gives null.
 * @returns {Object<string, string|null>}
 */
function personaFilesOf(roomResolved, ledger) {
  const fr = ops.personaFreshness(roomResolved);
  const out = {};
  for (const hat of HATS) {
    const e = ledger && isPlain(ledger.hats) ? ledger.hats[hat] : null;
    const f = fr.hats[hat];
    const usable = e && PERSONA_USABLE.includes(e.persona) && f && f.state === 'fresh' && typeof f.file === 'string';
    out[hat] = usable ? 'personas/' + f.file : null;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Reading schema (S-6 with FS-4), per-hat rules (DESIGN 4.7) and the citation boundary (FS-5)
// ---------------------------------------------------------------------------

const RESEARCH_HATS = Object.freeze(['white', 'black', 'yellow', 'green']);
const READ_HATS = Object.freeze(['white', 'red', 'black', 'yellow', 'green']);

const COMMON_READING_KEYS = Object.freeze(['schema', 'run_id', 'hat']);
const SELF_KEYS = Object.freeze(['self_search_strings', 'self_found_sources']);

// The closed key list of each hat. A forbidden key gives forbidden_key:<key>; any other key that is not
// allowed gives unknown_key:<key>. Design v2 superseded by owner answer 1: no follow-up request key exists.
const READING_KEYS = Object.freeze({
  white: Object.freeze({
    allowed: Object.freeze(['positions', 'evidence', 'missing_data', 'nothing_missing'].concat(SELF_KEYS)),
    forbidden: Object.freeze(['justification', 'provocations', 'none_found', 'verdict', 'skipped', 'thin', 'ask_next']),
  }),
  red: Object.freeze({
    allowed: Object.freeze(['positions']),
    forbidden: Object.freeze(['evidence', 'justification', 'missing_data', 'provocations', 'none_found', 'verdict', 'self_search_strings', 'self_found_sources', 'skipped', 'thin', 'ask_next']),
  }),
  black: Object.freeze({
    allowed: Object.freeze(['positions', 'evidence', 'steelman'].concat(SELF_KEYS)),
    forbidden: Object.freeze(['justification', 'provocations', 'none_found', 'verdict', 'missing_data', 'skipped', 'thin', 'ask_next']),
  }),
  yellow: Object.freeze({
    allowed: Object.freeze(['positions', 'evidence', 'none_found'].concat(SELF_KEYS)),
    forbidden: Object.freeze(['justification', 'provocations', 'verdict', 'missing_data', 'skipped', 'thin', 'ask_next']),
  }),
  green: Object.freeze({
    allowed: Object.freeze(['positions', 'provocations', 'evidence'].concat(SELF_KEYS)),
    forbidden: Object.freeze(['justification', 'verdict', 'none_found', 'missing_data', 'skipped', 'thin', 'ask_next']),
  }),
  blue: Object.freeze({
    allowed: Object.freeze(['skipped', 'thin', 'ask_next']),
    forbidden: Object.freeze(['positions', 'evidence', 'justification', 'provocations', 'none_found', 'verdict', 'missing_data', 'self_search_strings', 'self_found_sources']),
  }),
});

const FOUR_VALUES = Object.freeze(['favours', 'opposes', 'mixed', 'no_position']);
const READING_VALUES = Object.freeze({
  positions: Object.freeze({
    white: FOUR_VALUES,
    red: FOUR_VALUES,
    black: FOUR_VALUES,
    yellow: FOUR_VALUES,
    green: Object.freeze(['alternative_offered', 'no_position']),
  }),
  // The disposition of an evidence item: black sets one of the first two on each item it cites.
  black_dispositions: Object.freeze(['disconfirming', 'confirming']),
  dispositions: Object.freeze(['disconfirming', 'confirming', 'neutral', 'mixed']),
});

const READING_LIMITS = Object.freeze({
  line: 300,
  note: 300,
  source: 500,
  tier: 40,
  evidence_items: 40,
  missing_data_items: 20,
  missing_data: 200,
  steelman: 400,
  provocations: 7,
  provocation: 300,
  blue_items: 7,
  blue_item: 200,
  search_strings: 50,
  search_string: 200,
  found_sources: 30,
  found_title: 200,
  found_summary: 300,
  red_line_words: 25,
});

/** A key name is echoed in a reason only when it is a short plain identifier. */
function safeKeyName(k) {
  return /^[A-Za-z0-9_]{1,24}$/.test(String(k)) ? String(k) : '_';
}

function isPlain(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function strIn(v, min, max) {
  return typeof v === 'string' && v.length >= min && v.length <= max;
}

/**
 * Check a reading against the closed schema of its hat. Pure: no file access. Never repairs a reading
 * and never echoes the text it refuses.
 * @returns {{ok: true} | {ok: false, reason: string, state: string}}
 */
function validateReading(hat, reading, ctx) {
  const c = ctx || {};
  const fail = (reason) => ({ ok: false, reason, state: 'rejected:' + reason });
  if (!Object.prototype.hasOwnProperty.call(READING_KEYS, hat)) return fail('schema_invalid:hat');
  if (!isPlain(reading)) return fail('schema_invalid:reading');
  const keys = READING_KEYS[hat];
  for (const k of Object.keys(reading)) {
    if (COMMON_READING_KEYS.includes(k)) continue;
    if (keys.forbidden.includes(k)) return fail('forbidden_key:' + k);
    if (!keys.allowed.includes(k)) return fail('unknown_key:' + safeKeyName(k));
  }
  if (reading.schema !== 'mos.persona-reading/1') return fail('schema_invalid:schema');
  if (reading.run_id !== c.runId) return fail('schema_invalid:run_id');
  if (reading.hat !== hat) return fail('schema_invalid:hat');

  if (hat === 'blue') {
    for (const name of ['skipped', 'thin', 'ask_next']) {
      if (reading[name] === undefined) continue;
      const list = reading[name];
      if (!Array.isArray(list) || list.length > READING_LIMITS.blue_items) return fail('schema_invalid:' + name);
      for (let i = 0; i < list.length; i += 1) {
        if (!strIn(list[i], 1, READING_LIMITS.blue_item)) return fail('schema_invalid:' + name + '[' + i + ']');
        if (name === 'thin' && !HATS.some(h => list[i].toLowerCase().includes(h))) return fail('schema_invalid:thin[' + i + ']');
      }
    }
    return { ok: true };
  }

  // positions: one entry for each sub-question id of the ledger, no other id, no id twice.
  const ids = Array.isArray(c.subQuestionIds) ? c.subQuestionIds : [];
  const pos = reading.positions;
  if (!Array.isArray(pos) || pos.length !== ids.length) return fail('schema_invalid:positions');
  const seen = new Set();
  const values = READING_VALUES.positions[hat];
  for (let i = 0; i < pos.length; i += 1) {
    const p = pos[i];
    const at = 'positions[' + i + ']';
    if (!isPlain(p)) return fail('schema_invalid:' + at);
    for (const k of Object.keys(p)) {
      if (!['sub_question', 'value', 'line'].includes(k)) return fail('schema_invalid:' + at + '.' + safeKeyName(k));
    }
    if (typeof p.sub_question !== 'string' || !ids.includes(p.sub_question) || seen.has(p.sub_question)) return fail('schema_invalid:' + at + '.sub_question');
    seen.add(p.sub_question);
    if (typeof p.value !== 'string' || !values.includes(p.value)) return fail('schema_invalid:' + at + '.value');
    if (p.line === undefined) {
      if (p.value !== 'no_position') return fail('schema_invalid:' + at + '.line');
    } else if (!strIn(p.line, p.value === 'no_position' ? 0 : 1, READING_LIMITS.line)) {
      return fail('schema_invalid:' + at + '.line');
    }
  }

  if (reading.evidence !== undefined) {
    const ev = reading.evidence;
    if (!Array.isArray(ev) || ev.length > READING_LIMITS.evidence_items) return fail('schema_invalid:evidence');
    for (let i = 0; i < ev.length; i += 1) {
      const it = ev[i];
      const at = 'evidence[' + i + ']';
      if (!isPlain(it)) return fail('schema_invalid:' + at);
      for (const k of Object.keys(it)) {
        if (!['source', 'tier', 'disposition', 'note'].includes(k)) return fail('schema_invalid:' + at + '.' + safeKeyName(k));
      }
      if (it.source !== undefined && !strIn(it.source, 1, READING_LIMITS.source)) return fail('schema_invalid:' + at + '.source');
      if (it.tier !== undefined && !strIn(it.tier, 1, READING_LIMITS.tier)) return fail('schema_invalid:' + at + '.tier');
      if (it.note !== undefined && !strIn(it.note, 0, READING_LIMITS.note)) return fail('schema_invalid:' + at + '.note');
      if (hat === 'black') {
        if (!READING_VALUES.black_dispositions.includes(it.disposition)) return fail('schema_invalid:' + at + '.disposition');
      } else if (it.disposition !== undefined && !READING_VALUES.dispositions.includes(it.disposition)) {
        return fail('schema_invalid:' + at + '.disposition');
      }
    }
  }

  if (hat === 'white') {
    if (reading.missing_data !== undefined) {
      const md = reading.missing_data;
      if (!Array.isArray(md) || md.length > READING_LIMITS.missing_data_items) return fail('schema_invalid:missing_data');
      if (!md.every(s => strIn(s, 1, READING_LIMITS.missing_data))) return fail('schema_invalid:missing_data');
    }
    if (reading.nothing_missing !== undefined && typeof reading.nothing_missing !== 'boolean') return fail('schema_invalid:nothing_missing');
  }
  if (hat === 'black' && reading.steelman !== undefined && !strIn(reading.steelman, 1, READING_LIMITS.steelman)) return fail('schema_invalid:steelman');
  if (hat === 'yellow' && reading.none_found !== undefined && typeof reading.none_found !== 'boolean') return fail('schema_invalid:none_found');
  if (hat === 'green' && reading.provocations !== undefined) {
    const pv = reading.provocations;
    if (!Array.isArray(pv) || pv.length > READING_LIMITS.provocations) return fail('schema_invalid:provocations');
    if (!pv.every(s => strIn(s, 1, READING_LIMITS.provocation))) return fail('schema_invalid:provocations');
  }

  // FS-4: self-found sources, only for white, black, yellow and green.
  if (RESEARCH_HATS.includes(hat)) {
    const ss = reading.self_search_strings;
    if (ss !== undefined) {
      if (!Array.isArray(ss) || ss.length > READING_LIMITS.search_strings) return fail('schema_invalid:self_search_strings');
      if (!ss.every(s => strIn(s, 1, READING_LIMITS.search_string))) return fail('schema_invalid:self_search_strings');
    }
    const fs2 = reading.self_found_sources;
    if (fs2 !== undefined) {
      if (!Array.isArray(fs2) || fs2.length > READING_LIMITS.found_sources) return fail('schema_invalid:self_found_sources');
      const strings = Array.isArray(ss) ? ss : [];
      for (let i = 0; i < fs2.length; i += 1) {
        const it = fs2[i];
        const at = 'self_found_sources[' + i + ']';
        if (!isPlain(it)) return fail('schema_invalid:' + at);
        for (const k of Object.keys(it)) {
          if (!['url', 'title', 'search_string', 'summary'].includes(k)) return fail('schema_invalid:' + at + '.' + safeKeyName(k));
        }
        if (!strIn(it.url, 1, READING_LIMITS.source) || !/^https?:\/\/\S+$/i.test(it.url)) return fail('schema_invalid:' + at + '.url');
        if (!strIn(it.title, 1, READING_LIMITS.found_title)) return fail('schema_invalid:' + at + '.title');
        if (!strIn(it.search_string, 1, READING_LIMITS.search_string) || !strings.includes(it.search_string)) return fail('schema_invalid:' + at + '.search_string');
        if (!strIn(it.summary, 1, READING_LIMITS.found_summary)) return fail('schema_invalid:' + at + '.summary');
      }
    }
  }
  return { ok: true };
}

function wordCount(text) {
  return String(text).split(/\s+/).filter(Boolean).length;
}

/**
 * The rule lines of one reading (DESIGN 4.7 with FS-10 and FS-11). A rule line never drops a reading.
 * For blue no governance function is called. Pure: no file access.
 * @param {string} hat
 * @param {Object} reading A reading that passed validateReading.
 * @param {{researchState?: string}} [ctx]
 * @returns {{lines: string[], none_found_basis: string|null}}
 */
function perHatRules(hat, reading, ctx) {
  const c = ctx || {};
  const out = { lines: [], none_found_basis: null };
  if (hat === 'blue' || !READ_HATS.includes(hat)) return out;
  const r = isPlain(reading) ? reading : {};
  // Lazy require, with the property read at call time: the Bono modules are not loaded at top level.
  const governance = require(path.join(REPO_ROOT, 'lib', 'core', 'bono', 'hat-governance.cjs'));
  const evidence = Array.isArray(r.evidence) ? r.evidence : [];
  const lines = governance.enforceGovernance(hat, r).violations.slice();

  if (hat === 'white') {
    const md = Array.isArray(r.missing_data) ? r.missing_data : [];
    if (md.length === 0 && r.nothing_missing !== true) lines.push('white_missing_data_absent');
  } else if (hat === 'red') {
    const pos = Array.isArray(r.positions) ? r.positions : [];
    if (pos.some(p => p && typeof p.line === 'string' && wordCount(p.line) > READING_LIMITS.red_line_words)) lines.push('red_line_too_long');
  } else if (hat === 'yellow') {
    if (r.none_found === true) {
      if (evidence.length > 0) {
        lines.push('none_found_with_evidence');
      } else {
        const own = Array.isArray(r.self_search_strings) ? r.self_search_strings : [];
        if (c.researchState === 'ran_empty') out.none_found_basis = 'door_search_empty';
        else if (own.length >= 1) out.none_found_basis = 'self_reported_search';
        else lines.push('none_found_without_search');
        if (out.none_found_basis) {
          const at = lines.indexOf('yellow_value_not_evidence_backed');
          if (at !== -1) lines.splice(at, 1);
        }
      }
    }
  } else if (hat === 'green') {
    if (evidence.some(it => it && it.disposition !== undefined)) lines.push('green_evidence_disposition');
  }
  out.lines = lines;
  return out;
}

/** The comparison form of a URL (H7): a final run of slashes and full stops does not count. */
function normaliseUrl(u) {
  return String(u).replace(/[\/.]+$/, '');
}

const URL_SCAN_RE = /(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
const CLAIM_SCAN_RE = /EvidenceClaim:[^\s<>"'`,;()\[\]{}]+/g;

/** Every string value of a reading, all depths, except the url field of a self-found source. */
function collectStrings(value, out, isSourceUrl) {
  if (typeof value === 'string') {
    if (!isSourceUrl) out.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collectStrings(v, out, false);
  } else if (isPlain(value)) {
    for (const k of Object.keys(value)) collectStrings(value[k], out, false);
  }
  return out;
}

function stringsOfReading(reading) {
  const out = [];
  for (const k of Object.keys(reading)) {
    if (k === 'self_found_sources' && Array.isArray(reading[k])) {
      for (const it of reading[k]) {
        if (!isPlain(it)) { collectStrings(it, out, false); continue; }
        for (const f of Object.keys(it)) collectStrings(it[f], out, f === 'url');
      }
    } else {
      collectStrings(reading[k], out, false);
    }
  }
  return out;
}

/**
 * The citation boundary (FS-5). The allowed set of a researching hat is its own pack ids and urls, the White ids and
 * urls, and the urls of the reading's own self_found_sources; red and blue have an empty set (WR-02). Any other URL or EvidenceClaim id in any
 * string field gives rejected:citation_outside_sources. Pure. Never echoes the refused text.
 * @returns {{ok: true} | {ok: false, reason: 'citation_outside_sources', state: string, why: string}}
 */
function citationCheck(hat, reading, ctx) {
  const c = ctx || {};
  const refuse = (why) => ({ ok: false, reason: 'citation_outside_sources', state: 'rejected:citation_outside_sources', why });
  const r = isPlain(reading) ? reading : {};
  // WR-02 (owner second card: "Red still gives no evidence"): a hat that does not research cites nothing, not even
  // the White package it reads. Its allowed set is empty whatever sets the caller passes.
  const cites = RESEARCH_HATS.includes(hat);
  const ids = new Set(cites ? [].concat(c.ownIds || [], c.whiteIds || []) : []);
  const urls = new Set(cites ? [].concat(c.ownUrls || [], c.whiteUrls || []) : []);
  if (RESEARCH_HATS.includes(hat) && Array.isArray(r.self_found_sources)) {
    for (const it of r.self_found_sources) {
      if (isPlain(it) && typeof it.url === 'string') urls.add(it.url);
    }
  }
  const canonOfNorm = new Map();
  for (const u of urls) canonOfNorm.set(normaliseUrl(u), u);
  const bare = new Map();
  for (const u of urls) bare.set(normaliseUrl(u).replace(/^https?:\/\//i, ''), u);

  // The Bono citation check, with the sources of the reading mapped to the canonical allowed form.
  const mapped = (Array.isArray(r.evidence) ? r.evidence : []).map(it => {
    const src = it && typeof it.source === 'string' ? it.source : null;
    if (src === null) return { source: null };
    if (ids.has(src) || urls.has(src)) return { source: src };
    const canon = canonOfNorm.get(normaliseUrl(src));
    return { source: canon !== undefined ? canon : src };
  });
  const wired = require(path.join(REPO_ROOT, 'lib', 'core', 'bono', 'persona-research.cjs'));
  const base = wired.validateCitations({ evidence: mapped, wired_sources: Array.from(ids).concat(Array.from(urls)) });
  if (!base.ok) return refuse(base.violations[0]);

  // The scan of every string field.
  const strings = stringsOfReading(r);
  const trailing = /[.,;:!?)\]}'"\/]+$/;
  for (const s of strings) {
    for (const m of s.match(URL_SCAN_RE) || []) {
      let cand = m;
      let okUrl = false;
      for (let guard = 0; guard < 8 && !okUrl; guard += 1) {
        const n = normaliseUrl(cand);
        if (canonOfNorm.has(n)) okUrl = true;
        else if (/^www\./i.test(n) && bare.has(n)) okUrl = true;
        const stripped = cand.replace(trailing, '');
        if (okUrl || stripped === cand || stripped.length === 0) break;
        cand = stripped;
      }
      if (!okUrl) return refuse('url');
    }
    for (const m of s.match(CLAIM_SCAN_RE) || []) {
      if (!ids.has(m.replace(/[.:]+$/, ''))) return refuse('evidence_claim_id');
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// plan-research (the no-plan branch) and check
// ---------------------------------------------------------------------------

const PERSONA_USABLE = ['fresh', 'built_accepted'];
const EVIDENCE_SCHEMA = 'mos.persona-evidence/1';

/** The directory of a hat from the private run map, only when it is inside the scratch root. */
function hatDirOf(map, hat) {
  const dir = map && map.hats ? map.hats[hat] : null;
  if (typeof dir !== 'string' || typeof map.scratch_root !== 'string') return null;
  const rel = path.relative(map.scratch_root, dir);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return dir;
}

const PLAN_SCHEMA = 'mos.persona-plan/1';
const HANDLES_SCHEMA = 'mos.persona-handles/1';
const HANDLES_STORE_SCHEMA = 'mos.persona-handles-store/1';
const EDITED_SCHEMA = 'mos.persona-edited/1';
const PACKS_SCHEMA = 'mos.persona-pack-hashes/1';
const HANDLES_KEYS = Object.freeze(['schema', 'hat', 'handles', 'nature_handle']);
// PS-09 (owner sixth card, item 2): Green proposes one more handle, in nature terms, for the nature lens (AskNature).
// It passes the same identity screen and checkHandle rules, with up to 6 words; the door adds no qualifier to it.
const NATURE_LENS = 'nature';
const NATURE_HAT = 'green';
const NATURE_MAX_WORDS = 6;
const HANDLE_ITEM_KEYS = Object.freeze(['handle', 'why']);
const EDITED_KEYS = Object.freeze(['schema', 'run_id', 'edits']);
const EDIT_ENTRY_KEYS = Object.freeze(['hat', 'q_hash_replaced', 'text']);
const MAX_HANDLES_PER_HAT = 2;
const MAX_STRINGS_PER_HAT = 2;
const MAX_EDITS_PER_FILE = 16;
const MAX_EDIT_TEXT = 2000;
const SHOWN_TEXT_MAX = 300;
const SHA256_RE = /^[0-9a-f]{64}$/;

// ---- the pack hashes: a hat must not widen its own citation set by rewriting a pack (risk of plan 07) ----

/** SHA-256 of a regular file that is not a symbolic link; null when the file is missing or of another kind. */
function packFileHash(file) {
  try {
    const st = fs.lstatSync(file);
    if (!st.isFile()) return null;
    return sha256Hex(fs.readFileSync(file));
  } catch (e) {
    return null;
  }
}

/**
 * Record the hashes of the packs now on disk in the run map and, as a record copy, in the ledger (neither is
 * written to disk here: the caller writes the run map with writeRunMap, then the ledger). The research step calls
 * this right after it writes the packs: the five copies of shared-white.json must be equal, and evidence.json
 * must exist for white, black, yellow and green. A pack that is rewritten later no longer matches.
 * @returns {{ok: true} | {ok: false, reason: string}}
 */
function sealPacks(ledger, map) {
  let shared = null;
  for (const hat of READ_HATS) {
    const dir = hatDirOf(map, hat);
    if (!dir) return { ok: false, reason: 'run_map_missing' };
    const h = packFileHash(path.join(dir, 'shared-white.json'));
    if (h === null) return { ok: false, reason: 'pack_missing:shared-white' };
    if (shared === null) shared = h;
    else if (shared !== h) return { ok: false, reason: 'shared_white_copies_differ' };
  }
  const evidence = {};
  for (const hat of RESEARCH_HATS) {
    const dir = hatDirOf(map, hat);
    if (!dir) return { ok: false, reason: 'run_map_missing' };
    const h = packFileHash(path.join(dir, 'evidence.json'));
    if (h === null) return { ok: false, reason: 'pack_missing:' + hat };
    evidence[hat] = h;
  }
  // WR-03: the seal that check and merge compare against lives in the private run map (mode 0600, under the
  // MindrianOS home), which no agent gets. The ledger copy in the room is for the record only and is never compared.
  const seal = { schema: PACKS_SCHEMA, shared_white: shared, evidence };
  ledger.packs = JSON.parse(JSON.stringify(seal));
  map.packs = seal;
  return { ok: true };
}

/** Write the private run map back (mode 0600). The caller writes it after sealPacks and before the ledger. */
function writeRunMap(homeDir, map) {
  atomicWriteJson(runMapPath(homeDir, map.run_id), map, 0o600);
}

/** Seal the packs of one run and write the ledger. For a research step that writes packs on its own. */
function sealRunPacks(args, deps) {
  const roomResolved = roomDirCheck(args && args.roomDir);
  if (!roomResolved) return { ok: false, reason: 'room_not_found' };
  const lr = readLedger(roomResolved, args.runId);
  if (!lr.ok) return lr;
  const map = readRunMap(homeDirOf(deps), lr.ledger.run_id, roomResolved);
  if (!map) return { ok: false, reason: 'run_map_missing' };
  const sealed = sealPacks(lr.ledger, map);
  if (!sealed.ok) return sealed;
  try {
    writeRunMap(homeDirOf(deps), map);
    writeLedger(lr.dir, lr.ledger);
  } catch (e) {
    return { ok: false, reason: 'write_failed:' + (e && e.code ? e.code : 'error') };
  }
  return { ok: true, run_id: lr.ledger.run_id };
}

/**
 * Compare the packs of one hat with the sealed hashes.
 * @returns {string|null} a reading state to reject with, or null when the packs are as sealed
 */
function packTamper(hat, dir, packs) {
  if (!isPlain(packs) || typeof packs.shared_white !== 'string' || !isPlain(packs.evidence)) return 'rejected:packs_not_sealed';
  if (packFileHash(path.join(dir, 'shared-white.json')) !== packs.shared_white) return 'rejected:pack_changed_after_research';
  if (RESEARCH_HATS.includes(hat) && packFileHash(path.join(dir, 'evidence.json')) !== packs.evidence[hat]) return 'rejected:pack_changed_after_research';
  return null;
}

// ---- the handles store (S-3a): one file for each brief, keyed by hat and persona file hash ----

function handlesStorePath(roomResolved, briefHash) {
  if (typeof briefHash !== 'string' || !SHA256_RE.test(briefHash)) throw Object.assign(new Error('brief hash invalid'), { code: 'brief_hash_invalid' });
  return path.join(roomResolved, '.mindrian', 'hats', 'handles', String(briefHash).slice(0, 16) + '.json');
}

function validHandleList(list) {
  return Array.isArray(list) && list.length >= 1 && list.length <= MAX_HANDLES_PER_HAT && list.every(h => typeof h === 'string' && h.length > 0 && h.length <= 200);
}

/**
 * Read the handles store of a brief. Never throws. A missing, unreadable or invalid file, or an entry that is not
 * well formed, gives no entry for that hat.
 * @returns {{ok: true, hats: Object<string, {persona_sha256: string, handles: string[]}>}}
 */
function readHandlesStore(roomDir, briefHash) {
  const out = { ok: true, hats: {} };
  if (typeof briefHash !== 'string' || !SHA256_RE.test(briefHash)) return out;
  const r = readJsonFile(handlesStorePath(path.resolve(roomDir), briefHash), { noSymlink: true });
  if (!r.ok || !isPlain(r.value) || r.value.schema !== HANDLES_STORE_SCHEMA || r.value.brief_hash !== briefHash || !isPlain(r.value.hats)) return out;
  for (const hat of RESEARCH_HATS) {
    const e = r.value.hats[hat];
    if (!isPlain(e) || typeof e.persona_sha256 !== 'string' || !SHA256_RE.test(e.persona_sha256) || e.brief_hash !== briefHash || !validHandleList(e.handles)) continue;
    if (e.nature_handle !== undefined && (hat !== NATURE_HAT || typeof e.nature_handle !== 'string' || e.nature_handle.length === 0 || e.nature_handle.length > 200)) continue;
    out.hats[hat] = { persona_sha256: e.persona_sha256, handles: e.handles.slice() };
    if (typeof e.nature_handle === 'string') out.hats[hat].nature_handle = e.nature_handle;
  }
  return out;
}

function writeHandlesStore(roomResolved, briefHash, updates, deps) {
  const file = handlesStorePath(roomResolved, briefHash);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // WR-09: read, merge by hat and rename under the lock of the store file.
  const written = withStoreLock(file, deps, () => {
    const current = readHandlesStore(roomResolved, briefHash);
    const hats = {};
    for (const hat of RESEARCH_HATS) {
      const e = updates[hat] || current.hats[hat];
      if (e) hats[hat] = { persona_sha256: e.persona_sha256, brief_hash: briefHash, handles: e.handles.slice() };
      if (e && hat === NATURE_HAT && typeof e.nature_handle === 'string') hats[hat].nature_handle = e.nature_handle;
    }
    atomicWriteJson(file, { schema: HANDLES_STORE_SCHEMA, brief_hash: briefHash, hats });
    return { ok: true };
  });
  if (!written.ok) throw Object.assign(new Error('handles store busy'), { code: 'handles_store_busy' });
}

/** SHA-256 of the persona file of each researching hat, null for a hat that has none. */
function personaHashesOf(roomResolved) {
  const freshness = ops.personaFreshness(roomResolved);
  const out = {};
  for (const hat of RESEARCH_HATS) {
    const entry = freshness.hats[hat];
    out[hat] = null;
    if (!entry || typeof entry.file !== 'string') continue;
    try {
      out[hat] = sha256Hex(fs.readFileSync(path.join(roomResolved, 'personas', entry.file)));
    } catch (e) {
      out[hat] = null;
    }
  }
  return out;
}

/**
 * The researching hats that need a handle agent: a fresh or accepted persona and no store entry for this brief and
 * this persona file. Never names red or blue.
 * @returns {string[]}
 */
function handlesNeeded(roomDir, ledger) {
  if (!ledger || ledger.mode !== 'deep' || !isPlain(ledger.hats)) return [];
  const roomResolved = path.resolve(roomDir);
  const store = readHandlesStore(roomResolved, ledger.brief_hash);
  const shas = personaHashesOf(roomResolved);
  const out = [];
  for (const hat of RESEARCH_HATS) {
    const entry = ledger.hats[hat];
    if (!entry || !PERSONA_USABLE.includes(entry.persona) || !shas[hat]) continue;
    const stored = store.hats[hat];
    if (stored && stored.persona_sha256 === shas[hat]) continue;
    out.push(hat);
  }
  return out;
}

/** Read and check the handles file of one hat (S-3a). @returns {{ok: true, handles: string[]} | {ok: false, reason: string}} */
function readHandlesFile(dir, hat) {
  const r = readJsonFile(path.join(dir, 'handles.json'), { noSymlink: true });
  if (!r.ok) return { ok: false, reason: r.reason === 'file_unreadable' ? 'no_file' : r.reason };
  const v = r.value;
  if (!isPlain(v)) return { ok: false, reason: 'schema_invalid:handles' };
  for (const k of Object.keys(v)) if (!HANDLES_KEYS.includes(k)) return { ok: false, reason: 'schema_invalid:handles' };
  if (v.schema !== HANDLES_SCHEMA || v.hat !== hat || !Array.isArray(v.handles)) return { ok: false, reason: 'schema_invalid:handles' };
  if (v.handles.length < 1 || v.handles.length > MAX_HANDLES_PER_HAT) return { ok: false, reason: 'schema_invalid:handles' };
  const list = [];
  for (const item of v.handles) {
    if (!isPlain(item)) return { ok: false, reason: 'schema_invalid:handles' };
    for (const k of Object.keys(item)) if (!HANDLE_ITEM_KEYS.includes(k)) return { ok: false, reason: 'schema_invalid:handles' };
    if (typeof item.handle !== 'string' || item.handle.length > 200 || typeof item.why !== 'string' || item.why.length === 0 || item.why.length > 200) return { ok: false, reason: 'schema_invalid:handles' };
    list.push(item.handle);
  }
  let nature = null;
  if (Object.prototype.hasOwnProperty.call(v, 'nature_handle')) {
    // PS-09: only Green has a nature handle.
    const item = v.nature_handle;
    if (hat !== NATURE_HAT || !isPlain(item)) return { ok: false, reason: 'schema_invalid:handles' };
    for (const k of Object.keys(item)) if (!HANDLE_ITEM_KEYS.includes(k)) return { ok: false, reason: 'schema_invalid:handles' };
    if (typeof item.handle !== 'string' || item.handle.length > 200 || typeof item.why !== 'string' || item.why.length === 0 || item.why.length > 200) return { ok: false, reason: 'schema_invalid:handles' };
    nature = item.handle;
  }
  return { ok: true, handles: list, nature_handle: nature };
}

// ---- Phase 400.2-19: the host web search as a hand-off (owner third card, items 3 to 5) ----
// The door is a script with no model, so it cannot call the web search tool of the host. When the Tavily key is not set,
// a web lens (industry, nature, datasets) is not refused: the plan gives that string the provider host-web, the command
// runs the host web search with the exact host string and passes the results back in a file (--host-results).
const HOST_WEB_PROVIDER = 'host-web';
const HOST_ROUTED_LENSES = Object.freeze(['industry', 'nature', 'datasets']);
const HOST_LABELS = Object.freeze({
  industry: 'web search by the assistant',
  nature: 'AskNature (through web search)',
  datasets: 'Kaggle datasets (through web search)',
});
// The fixed prefix that limits a host search to one site. The prefix is code; the rest is the audited planned string.
const HOST_SITE_PREFIX = Object.freeze({ industry: '', nature: 'site:asknature.org ', datasets: 'site:kaggle.com/datasets ' });

/** The exact text that the host web search gets for one lens and one planned string. */
function hostSearchText(lens, text) {
  return (Object.prototype.hasOwnProperty.call(HOST_SITE_PREFIX, lens) ? HOST_SITE_PREFIX[lens] : '') + text;
}

/** The host searches of a planned hat: for each planned string and each host lens, the lens, label, q_hash and exact text. */
function hostSearchesOf(rec) {
  const lenses = isPlain(rec) && Array.isArray(rec.host_lenses) ? rec.host_lenses : [];
  const strings = isPlain(rec) && Array.isArray(rec.strings) ? rec.strings : [];
  const out = [];
  // PS-09: the normal strings never go to the nature lens; the nature lens gets the nature string of Green only.
  const normal = lenses.filter(l => l !== NATURE_LENS);
  for (const str of strings) {
    for (const lens of normal) out.push({ lens, label: HOST_LABELS[lens], q_hash: str.q_hash, text: hostSearchText(lens, str.text) });
  }
  const nat = naturePlanned(rec);
  if (nat && lenses.includes(NATURE_LENS)) out.push({ lens: NATURE_LENS, label: HOST_LABELS[NATURE_LENS], q_hash: nat.q_hash, text: hostSearchText(NATURE_LENS, nat.text) });
  return out;
}

/** PS-09: the planned nature string of a hat plan ({text, q_hash, handle}), or null. */
function naturePlanned(rec) {
  return isPlain(rec) && isPlain(rec.nature) && rec.nature.state === 'planned' && typeof rec.nature.text === 'string' && typeof rec.nature.q_hash === 'string' ? rec.nature : null;
}

/**
 * The frozen lens set of a hat from the table, through the preflight. No network call.
 * lens_set holds the lenses that the door runs; host_lenses holds the web lenses that fall back to the host web search
 * because no Tavily key is set; providers lists both in table order (a domain lens is named asknature or kaggle).
 */
function lensPlanOf(hat, roomResolved, deps) {
  const driver = require(path.join(REPO_ROOT, 'lib', 'lens-engine', 'source-lens-driver.cjs'));
  const preflight = deps && typeof deps.preflightLenses === 'function' ? deps.preflightLenses : driver.preflightLenses;
  const table = ops.HAT_RESEARCH_LENSES[hat];
  const pre = preflight(table.slice(), { roomDir: roomResolved });
  const available = Array.isArray(pre && pre.available) ? pre.available : [];
  const unavailable = Array.isArray(pre && pre.unavailable) ? pre.unavailable : [];
  const lensToSource = driver._internal.LENS_TO_SOURCE;
  const domainLenses = driver._internal.DOMAIN_LENSES || {};
  const lensSet = [];
  const hostLenses = [];
  const providers = [];
  const addProvider = (name) => { if (typeof name === 'string' && !providers.includes(name)) providers.push(name); };
  table.forEach((lens, i) => {
    if (available.includes(lens)) {
      lensSet.push({ lens, weight: Math.round((1 - 0.2 * i) * 10) / 10 });
      addProvider(domainLenses[lens] ? domainLenses[lens].label : lensToSource[lens]);
      return;
    }
    const u = unavailable.find(x => isPlain(x) && x.lens === lens);
    if (u && HOST_ROUTED_LENSES.includes(lens) && u.provider === 'tavily' && u.reason === 'no_key') {
      hostLenses.push(lens);
      addProvider(HOST_WEB_PROVIDER);
    }
  });
  const rest = unavailable.filter(u => !(isPlain(u) && hostLenses.includes(u.lens)));
  return { lens_set: lensSet, host_lenses: hostLenses, providers, unavailable_line: driver.unavailableAnswerLine(rest) };
}

function emptyHatPlan(state) {
  return { state, strings: [], refused: [], lens_set: [], host_lenses: [], host_searches: [], providers: [], unavailable_line: '' };
}

function planOutput(ledger, plan, refusedShown, extra) {
  const hats = {};
  const planned = [];
  for (const hat of HATS) {
    if (RESEARCH_HATS.includes(hat)) {
      hats[hat] = plan.hats[hat].state;
      if (plan.hats[hat].state === 'planned') planned.push(hat);
    } else {
      hats[hat] = 'never_searches';
    }
  }
  return Object.assign({ ok: true, run_id: ledger.run_id, plan_seq: plan.plan_seq, hats, planned, plan, refused_shown: refusedShown }, extra || {});
}

/**
 * Step plan_research (plan 11). Planning branch: for each researching hat with a usable persona, the handles (the
 * store, else handles.json) pass checkHandle and composeString, the frozen lens set passes the preflight, and one plan
 * (S-3) is written for the cards. When no hat is planned, the closing branch runs: every hat is not planned,
 * run_research is skipped and zero-item packs are written. With --edited the strings of the plan are edited.
 * No fetch happens here.
 */
function cmdPlanResearch(args, deps) {
  const roomResolved = roomDirCheck(args && args.roomDir);
  if (!roomResolved) return { ok: false, reason: 'room_not_found' };
  const lr = readLedger(roomResolved, args.runId);
  if (!lr.ok) return lr;
  const ledger = lr.ledger;
  const order = requireStep(ledger, 'accept_persona');
  if (order) return { ok: false, reason: order };
  if (ledger.mode !== 'deep') return { ok: false, reason: 'mode_not_deep' };
  if (ledger.steps.run_research) return { ok: false, reason: 'step_already_done:run_research' };
  const map = readRunMap(homeDirOf(deps), ledger.run_id, roomResolved);
  if (!map) return { ok: false, reason: 'run_map_missing' };
  for (const hat of HATS) {
    if (!hatDirOf(map, hat)) return { ok: false, reason: 'run_map_missing' };
  }
  if (args.editedPath !== undefined && args.editedPath !== null) return planEdit(roomResolved, lr, map, args, deps);
  if (ledger.steps.plan_research) return { ok: false, reason: 'step_already_done:plan_research' };
  return planFirst(roomResolved, lr, map, deps);
}

function planFirst(roomResolved, lr, map, deps) {
  const ledger = lr.ledger;
  const screen = roomIdentityScreen(roomResolved, ledger.brief && ledger.brief.reading_list);
  const shas = screen.ran === true ? personaHashesOf(roomResolved) : {};
  const store = readHandlesStore(roomResolved, ledger.brief_hash);
  const planHats = {};
  const refusedShown = [];
  const storeUpdates = {};
  const consumed = [];
  let refusedCount = 0;

  for (const hat of RESEARCH_HATS) {
    const rec = emptyHatPlan('not_planned:no_valid_handle');
    planHats[hat] = rec;
    if (!PERSONA_USABLE.includes(ledger.hats[hat].persona)) { rec.state = 'not_planned:persona_not_accepted'; continue; }
    if (screen.ran !== true) { rec.state = 'not_planned:identity_screen_unavailable'; continue; }
    const sha = shas[hat];
    if (!sha) { rec.state = 'not_planned:persona_not_accepted'; continue; }

    let handles = null;
    let natureRaw = null;
    let fromFile = false;
    const stored = store.hats[hat];
    if (stored && stored.persona_sha256 === sha) {
      handles = stored.handles;
      natureRaw = typeof stored.nature_handle === 'string' ? stored.nature_handle : null;
    } else {
      const f = readHandlesFile(hatDirOf(map, hat), hat);
      if (f.ok) {
        handles = f.handles;
        natureRaw = f.nature_handle;
        fromFile = true;
        consumed.push(hat);
      } else if (f.reason !== 'no_file') {
        rec.refused.push({ reason: f.reason });
        refusedShown.push({ hat, text: null, reason: f.reason });
        refusedCount += 1; // IN-06: every refusal shown on the card is counted
        consumed.push(hat);
      }
    }
    if (handles === null) continue;

    const passed = [];
    for (const raw of handles) {
      const c = checkHandle(raw, screen);
      const s = c.ok ? composeString(hat, c.handle) : c;
      if (!s.ok) {
        rec.refused.push({ reason: s.reason });
        refusedShown.push({ hat, text: typeof raw === 'string' ? raw.slice(0, SHOWN_TEXT_MAX) : null, reason: s.reason });
        refusedCount += 1;
        continue;
      }
      if (rec.strings.some(x => x.text === s.text) || rec.strings.length >= MAX_STRINGS_PER_HAT) continue;
      rec.strings.push({ text: s.text, q_hash: s.q_hash, handle: s.handle, qualifier: s.qualifier, edited: false });
      passed.push(c.handle);
    }
    if (fromFile && passed.length > 0) storeUpdates[hat] = { persona_sha256: sha, handles: passed };
    if (rec.strings.length === 0) continue;

    const lp = lensPlanOf(hat, roomResolved, deps);
    if (lp.lens_set.length === 0 && lp.host_lenses.length === 0) {
      rec.state = 'not_planned:no_available_provider';
      rec.strings = [];
      rec.unavailable_line = lp.unavailable_line;
      continue;
    }
    rec.state = 'planned';
    rec.lens_set = lp.lens_set;
    rec.host_lenses = lp.host_lenses;
    if (hat === NATURE_HAT) {
      // PS-09: the nature lens searches the nature handle only. A missing or refused one leaves the lens not planned,
      // with a named reason; the normal strings of the hat still plan.
      const natureLens = lp.lens_set.some(e => e.lens === NATURE_LENS) || lp.host_lenses.includes(NATURE_LENS);
      if (!natureLens) {
        rec.nature = { state: 'not_planned:no_available_provider' };
      } else if (typeof natureRaw !== 'string') {
        rec.nature = { state: 'not_planned:no_nature_handle' };
      } else {
        const c = checkHandle(natureRaw, screen, NATURE_MAX_WORDS);
        const s = c.ok ? composeNatureString(c.handle) : c;
        if (!s.ok) {
          rec.nature = { state: 'not_planned:' + s.reason };
          refusedShown.push({ hat, lens: NATURE_LENS, text: natureRaw.slice(0, SHOWN_TEXT_MAX), reason: s.reason });
          refusedCount += 1;
        } else {
          rec.nature = { state: 'planned', lens: NATURE_LENS, text: s.text, q_hash: s.q_hash, handle: s.handle };
          if (storeUpdates[hat]) storeUpdates[hat].nature_handle = s.handle;
        }
      }
    }
    rec.host_searches = hostSearchesOf(rec);
    rec.providers = lp.providers;
    rec.unavailable_line = lp.unavailable_line;
  }

  const planned = RESEARCH_HATS.filter(h => planHats[h].state === 'planned');
  const plan = {
    schema: PLAN_SCHEMA,
    run_id: ledger.run_id,
    brief_hash: ledger.brief_hash,
    plan_seq: 1,
    identity_screen: screen.counts(),
    hats: planHats,
  };
  const now = nowOf(deps);
  const states = {};
  for (const hat of HATS) states[hat] = RESEARCH_HATS.includes(hat) ? planHats[hat].state : 'never_searches';
  const approved = planned.reduce((n, h) => n + planHats[h].strings.length + (naturePlanned(planHats[h]) ? 1 : 0), 0);

  try {
    if (Object.keys(storeUpdates).length > 0) writeHandlesStore(roomResolved, ledger.brief_hash, storeUpdates, deps);
    if (planned.length > 0) {
      const planPath = path.join(map.scratch_root, 'plan.json');
      atomicWriteJson(planPath, plan, 0o600);
      ledger.plan_sha256 = sha256Hex(fs.readFileSync(planPath));
    } else {
      const pack = (hat, state) => ({ schema: EVIDENCE_SCHEMA, run_id: ledger.run_id, hat, research_state: state, strings: [], items: [] });
      for (const hat of READ_HATS) {
        atomicWriteJson(path.join(hatDirOf(map, hat), 'shared-white.json'), pack('white', states.white));
      }
      for (const hat of RESEARCH_HATS) {
        atomicWriteJson(path.join(hatDirOf(map, hat), 'evidence.json'), pack(hat, states[hat]));
      }
      const sealed = sealPacks(ledger, map);
      if (!sealed.ok) return sealed;
      writeRunMap(homeDirOf(deps), map);
    }
  } catch (e) {
    return { ok: false, reason: 'write_failed:' + (e && e.code ? e.code : 'error') };
  }

  for (const hat of HATS) ledger.hats[hat].research = planned.includes(hat) ? 'planned' : states[hat];
  ledger.research = { strings_approved: approved, strings_refused: refusedCount };
  markStep(ledger, 'plan_research', 'done', now);
  if (planned.length === 0) markStep(ledger, 'run_research', 'skipped', now);
  try {
    writeLedger(lr.dir, ledger);
  } catch (e) {
    return { ok: false, reason: 'write_failed:' + (e && e.code ? e.code : 'error') };
  }
  // The handles files are consumed: a refused handle text must not stay in the scratch tree.
  for (const hat of consumed) {
    try { fs.rmSync(path.join(hatDirOf(map, hat), 'handles.json'), { force: true }); } catch (e) { /* the scratch tree is removed at merge */ }
  }
  return planOutput(ledger, plan, refusedShown);
}

/** Check the shape of the edited-strings file (S-3b). @returns {string|null} a reason */
function editedRefusal(v, runId) {
  if (!isPlain(v)) return 'schema_invalid:root';
  for (const k of Object.keys(v)) if (!EDITED_KEYS.includes(k)) return 'unknown_key:' + safeKeyName(k);
  if (v.schema !== EDITED_SCHEMA) return 'schema_invalid:schema';
  if (v.run_id !== runId) return 'schema_invalid:run_id';
  if (!Array.isArray(v.edits) || v.edits.length > MAX_EDITS_PER_FILE) return 'schema_invalid:edits';
  for (let i = 0; i < v.edits.length; i += 1) {
    const e = v.edits[i];
    if (!isPlain(e)) return 'schema_invalid:edits[' + i + ']';
    for (const k of Object.keys(e)) if (!EDIT_ENTRY_KEYS.includes(k)) return 'unknown_key:' + safeKeyName(k);
    if (typeof e.hat !== 'string' || e.hat.length > 20) return 'schema_invalid:edits[' + i + '].hat';
    if (typeof e.q_hash_replaced !== 'string' || e.q_hash_replaced.length > 100) return 'schema_invalid:edits[' + i + '].q_hash_replaced';
    if (typeof e.text !== 'string' || e.text.length > MAX_EDIT_TEXT) return 'schema_invalid:edits[' + i + '].text';
  }
  return null;
}

/**
 * The checks of an edited string (DESIGN 4.5): the content fence and the length rules on the full text, the qualifier,
 * then the four checks on the text with the qualifier removed, then the compose checks on the full text.
 * @returns {{ok: true, composed: Object} | {ok: false, reason: string}}
 */
function checkEditedText(hat, text, screen) {
  const qualifier = ops.HAT_RESEARCH_QUALIFIER[hat];
  const rs = require(path.join(REPO_ROOT, 'lib', 'core', 'rs-egress-prompts.cjs'));
  const lq = require(path.join(REPO_ROOT, 'lib', 'core', 'dominant-design', 'lane-queries.cjs'));
  const first = lq.auditEditedQuery(text, { auditFn: (s) => rs.auditQueryString(s, 'persona-hats') });
  if (!first.ok) return { ok: false, reason: first.reason };
  let stem;
  if (text === qualifier) stem = '';
  else if (text.endsWith(' ' + qualifier)) stem = text.slice(0, text.length - qualifier.length - 1);
  else return { ok: false, reason: 'qualifier_removed' };
  const c = checkHandle(stem, screen);
  if (!c.ok) return c;
  const composed = composeString(hat, c.handle);
  if (!composed.ok) return composed;
  if (composed.text !== text) return { ok: false, reason: 'handle_not_generic_shape' };
  return { ok: true, composed };
}

function planEdit(roomResolved, lr, map, args, deps) {
  const ledger = lr.ledger;
  if (!ledger.steps.plan_research) return { ok: false, reason: 'step_out_of_order:plan_research' };
  const planPath = path.join(map.scratch_root, 'plan.json');
  const pr = readJsonFile(planPath, { noSymlink: true });
  if (!pr.ok) return { ok: false, reason: 'plan_missing' };
  if (pr.sha256 !== ledger.plan_sha256) return { ok: false, reason: 'plan_changed' };
  const plan = pr.value;
  if (!isPlain(plan) || plan.schema !== PLAN_SCHEMA || plan.run_id !== ledger.run_id || !Number.isInteger(plan.plan_seq) || !isPlain(plan.hats)) return { ok: false, reason: 'plan_changed' };
  const er = readJsonFile(args.editedPath);
  if (!er.ok) return { ok: false, reason: er.reason };
  const bad = editedRefusal(er.value, ledger.run_id);
  if (bad) return { ok: false, reason: bad };

  const screen = roomIdentityScreen(roomResolved, ledger.brief && ledger.brief.reading_list);
  const refusedShown = [];
  const accepted = [];
  for (const edit of er.value.edits) {
    const refuse = (reason) => refusedShown.push({ hat: edit.hat.slice(0, 20), text: edit.text.slice(0, SHOWN_TEXT_MAX), reason });
    if (!RESEARCH_HATS.includes(edit.hat)) { refuse('hat_never_searches'); continue; }
    const rec = plan.hats[edit.hat];
    const at = isPlain(rec) && rec.state === 'planned' && Array.isArray(rec.strings) ? rec.strings.findIndex(s => s.q_hash === edit.q_hash_replaced) : -1;
    if (at === -1) { refuse('string_not_in_plan'); continue; }
    const checked = checkEditedText(edit.hat, edit.text, screen);
    if (!checked.ok) { refuse(checked.reason); continue; }
    const c = checked.composed;
    if (c.q_hash === edit.q_hash_replaced) { refuse('string_unchanged'); continue; }
    if (rec.strings.some((s, i) => i !== at && s.q_hash === c.q_hash)) { refuse('duplicate_string'); continue; }
    rec.strings[at] = { text: c.text, q_hash: c.q_hash, handle: c.handle, qualifier: c.qualifier, edited: true };
    rec.host_searches = hostSearchesOf(rec);
    accepted.push({ hat: edit.hat, q_hash: c.q_hash });
  }

  if (accepted.length > 0) {
    plan.plan_seq += 1;
    try {
      atomicWriteJson(planPath, plan, 0o600);
      ledger.plan_sha256 = sha256Hex(fs.readFileSync(planPath));
    } catch (e) {
      return { ok: false, reason: 'write_failed:' + (e && e.code ? e.code : 'error') };
    }
    const audit = isPlain(ledger.audit) ? ledger.audit : {};
    const list = Array.isArray(audit.edited_strings) ? audit.edited_strings : [];
    for (const a of accepted) list.push({ hat: a.hat, q_hash: a.q_hash, plan_seq: plan.plan_seq });
    audit.edited_strings = list;
    ledger.audit = audit;
  }
  if (refusedShown.length > 0) {
    const research = isPlain(ledger.research) ? ledger.research : { strings_approved: 0, strings_refused: 0 };
    research.strings_refused = (Number.isInteger(research.strings_refused) ? research.strings_refused : 0) + refusedShown.length;
    ledger.research = research;
  }
  if (accepted.length > 0 || refusedShown.length > 0) {
    try {
      writeLedger(lr.dir, ledger);
    } catch (e) {
      return { ok: false, reason: 'write_failed:' + (e && e.code ? e.code : 'error') };
    }
  }
  return planOutput(ledger, plan, refusedShown, { edited: accepted });
}

/** Read the ids and URLs of an evidence pack. A missing or invalid pack gives empty sets. */
function packSets(file) {
  const r = readJsonFile(file, { noSymlink: true });
  const ids = [];
  const urls = [];
  if (r.ok && isPlain(r.value) && Array.isArray(r.value.items)) {
    for (const it of r.value.items) {
      if (!isPlain(it)) continue;
      if (typeof it.id === 'string') ids.push(it.id);
      if (typeof it.url === 'string') urls.push(it.url);
    }
  }
  return { ids, urls };
}

const SELF_SEARCH_SUSPECTED_LINE = 'self_search_room_detail_suspected';
const SELF_SEARCH_PARTIAL_LINE = 'self_search_screen_partial';

/**
 * FS-9, the after-the-fact screen of the search strings that a hat reports it sent. A string is suspected when the
 * content fence of check 1 refuses it (an email address, a phone number and the other fenced patterns) or when a
 * token of it is a screened word of the room identity screen (a venture token, a team file name, a proper noun of the
 * reading list) or when the full venture name is in it. The screen cannot stop a send: the search is over when this
 * runs. It returns counts only and never a string. When the identity screen did not run, only the fence is used and
 * screen_partial is true.
 * @param {string[]} strings
 * @param {object} [screen] - the result of roomIdentityScreen
 * @returns {{checked: number, suspected: number, screen_partial: boolean}}
 */
function screenReportedStrings(strings, screen) {
  const list = Array.isArray(strings) ? strings.filter(x => typeof x === 'string') : [];
  const rs = require(path.join(REPO_ROOT, 'lib', 'core', 'rs-egress-prompts.cjs'));
  const screenRan = Boolean(screen) && screen.ran === true && typeof screen.has === 'function';
  let suspected = 0;
  for (const text of list) {
    let hit = false;
    try {
      rs.auditQueryString(text, 'persona-hats');
    } catch (e) {
      hit = true;
    }
    if (!hit && screenRan && handleHitsScreen(identityTokens(text), screen)) hit = true;
    if (hit) suspected += 1;
  }
  return { checked: list.length, suspected, screen_partial: !screenRan };
}

/**
 * Read and judge the reading file of one hat: schema, citation boundary, rule lines. Used by check
 * and again by merge, so both steps decide from the same code. Reads the file bytes once.
 * @returns {{rec: Object, none_found_basis: string|null, value: Object|null}}
 */
function judgeReading(hat, dir, ctx) {
  const rec = { reading: null, reading_sha256: null, rule_lines: [], evidence_items: 0, positions_taken: 0, self_search_strings: [], self_found_sources: 0 };
  const out = { rec, none_found_basis: null, value: null };
  const read = readJsonFile(path.join(dir, 'reading.json'), { noSymlink: true });
  if (!read.ok && read.reason === 'file_unreadable') {
    rec.reading = 'not_run:no_reading_file';
    return out;
  }
  if (!read.ok) {
    rec.reading = 'rejected:' + read.reason;
    return out;
  }
  rec.reading_sha256 = read.sha256;
  const reading = read.value;
  const schema = validateReading(hat, reading, { runId: ctx.runId, subQuestionIds: ctx.subQuestionIds });
  if (!schema.ok) {
    rec.reading = schema.state;
    return out;
  }
  // A hat must not widen its citation set by rewriting a pack: the packs must be as the research step sealed them.
  const tamper = packTamper(hat, dir, ctx.packs);
  if (tamper) {
    rec.reading = tamper;
    return out;
  }
  const own = RESEARCH_HATS.includes(hat) ? packSets(path.join(dir, 'evidence.json')) : { ids: [], urls: [] };
  const white = packSets(path.join(dir, 'shared-white.json'));
  const cite = citationCheck(hat, reading, { ownIds: own.ids, whiteIds: white.ids, ownUrls: own.urls, whiteUrls: white.urls });
  if (!cite.ok) {
    rec.reading = cite.state;
    return out;
  }
  const rules = perHatRules(hat, reading, { researchState: ctx.researchState });
  // FS-9: the after-the-fact screen of the strings that the hat reports. It adds rule lines and never drops the reading.
  const lines = rules.lines.slice();
  if (RESEARCH_HATS.includes(hat) && Array.isArray(reading.self_search_strings) && reading.self_search_strings.length > 0) {
    const screened = screenReportedStrings(reading.self_search_strings, ctx.screen);
    if (screened.suspected > 0) lines.push(SELF_SEARCH_SUSPECTED_LINE + ':' + screened.suspected);
    if (screened.screen_partial) lines.push(SELF_SEARCH_PARTIAL_LINE);
  }
  rec.reading = 'ran';
  rec.rule_lines = lines;
  out.none_found_basis = rules.none_found_basis || null;
  rec.evidence_items = Array.isArray(reading.evidence) ? reading.evidence.length : 0;
  rec.positions_taken = reading.positions.filter(p => p.value !== 'no_position').length;
  rec.self_search_strings = Array.isArray(reading.self_search_strings) ? reading.self_search_strings.slice() : [];
  rec.self_found_sources = Array.isArray(reading.self_found_sources) ? reading.self_found_sources.length : 0;
  out.value = reading;
  return out;
}

/**
 * Step check. For each of white, red, black, yellow and green it decides one state, in this order:
 * persona refused or build failed, no reading file, schema, citation, then rule lines. It writes the
 * counts-only ledger of Blue (S-9). It reads no file of the Blue directory and writes only ledger.json
 * there.
 */
function cmdCheck(args, deps) {
  const roomResolved = roomDirCheck(args && args.roomDir);
  if (!roomResolved) return { ok: false, reason: 'room_not_found' };
  const lr = readLedger(roomResolved, args.runId);
  if (!lr.ok) return lr;
  const ledger = lr.ledger;
  // WR-11: a merged run is closed; a later call must not change the final run record (S-8).
  if (ledger.steps.merge) return { ok: false, reason: 'step_already_done:merge' };
  const order = requireStep(ledger, 'run_research');
  if (order) return { ok: false, reason: order };
  if (ledger.mode !== 'deep') return { ok: false, reason: 'mode_not_deep' };
  const map = readRunMap(homeDirOf(deps), ledger.run_id, roomResolved);
  if (!map) return { ok: false, reason: 'run_map_missing' };
  const blueDir = hatDirOf(map, 'blue');
  if (!blueDir) return { ok: false, reason: 'run_map_missing' };

  const subQuestionIds = ledger.sub_questions.map(s => s.id);
  const now = nowOf(deps);
  // One identity screen for the whole step: the after-the-fact screen of the reported search strings (FS-9) uses it.
  const screen = roomIdentityScreen(roomResolved, ledger.brief && ledger.brief.reading_list);
  const notRun = [];
  const perHat = {};
  const personaNotRun = (persona) => {
    if (persona === 'refused') return 'not_run:persona_refused';
    if (persona === 'build_failed') return 'not_run:persona_build_failed';
    if (!PERSONA_USABLE.includes(persona)) return 'not_run:persona_not_accepted';
    return null;
  };

  for (const hat of READ_HATS) {
    const entry = ledger.hats[hat];
    const rec = { reading: null, reading_sha256: null, rule_lines: [], evidence_items: 0, positions_taken: 0, self_search_strings: [], self_found_sources: 0 };
    delete entry.none_found_basis;
    const early = personaNotRun(entry.persona);
    const dir = hatDirOf(map, hat);
    if (early) {
      rec.reading = early;
    } else if (!dir) {
      rec.reading = 'not_run:no_reading_file';
    } else {
      const judged = judgeReading(hat, dir, { runId: ledger.run_id, subQuestionIds, researchState: entry.research, packs: map.packs, screen });
      Object.assign(rec, judged.rec);
      if (judged.none_found_basis) entry.none_found_basis = judged.none_found_basis;
    }
    if (rec.reading !== 'ran') notRun.push({ hat, reason: rec.reading.replace(/^(not_run|rejected):/, '') + '', state: rec.reading });
    entry.reading = rec.reading;
    if (rec.reading_sha256) entry.reading_sha256 = rec.reading_sha256; else delete entry.reading_sha256;
    entry.rule_lines = rec.rule_lines;
    entry.evidence_items = rec.evidence_items;
    entry.positions_taken = rec.positions_taken;
    entry.self_search_strings = rec.self_search_strings;
    entry.self_found_sources = rec.self_found_sources;
    perHat[hat] = rec;
  }

  // Blue is not checked here: it reads the ledger below and runs after this step.
  const blueEntry = ledger.hats.blue;
  const blueEarly = personaNotRun(blueEntry.persona);
  blueEntry.reading = blueEarly || 'pending';
  const research = isPlain(ledger.research) ? ledger.research : {};
  const intOf = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);

  // The count of items in the sealed door pack of a hat (the research side of "which hat was thin"); a pack that
  // differs from its seal counts as 0, so a hat cannot raise the number by writing its own pack.
  const doorItemsOf = (hat) => {
    if (!RESEARCH_HATS.includes(hat)) return 0;
    const d = hatDirOf(map, hat);
    if (!d || packTamper(hat, d, map.packs) !== null) return 0;
    return Math.min(packSets(path.join(d, 'evidence.json')).ids.length, 999);
  };
  const ledgerBlue = { schema: 'mos.persona-blue-ledger/1', run_id: ledger.run_id, hats: {}, sub_questions: subQuestionIds.length, strings_approved: intOf(research.strings_approved), strings_refused: intOf(research.strings_refused) };
  for (const hat of HATS) {
    const e = ledger.hats[hat];
    const isBlue = hat === 'blue';
    ledgerBlue.hats[hat] = {
      persona: String(e.persona).slice(0, 60),
      research: String(e.research || 'never_searches').slice(0, 60),
      reading: String(e.reading).slice(0, 60),
      evidence_items: isBlue ? 0 : perHat[hat].evidence_items,
      positions_taken: isBlue ? 0 : perHat[hat].positions_taken,
      rule_lines: isBlue ? 0 : perHat[hat].rule_lines.length,
      self_found_sources: isBlue ? 0 : perHat[hat].self_found_sources,
      self_search_strings: isBlue ? 0 : perHat[hat].self_search_strings.length,
      door_items: doorItemsOf(hat),
    };
  }
  const bluePath = path.join(blueDir, 'ledger.json');
  try {
    atomicWriteJson(bluePath, ledgerBlue);
  } catch (e) {
    return { ok: false, reason: 'write_failed:' + (e && e.code ? e.code : 'error') };
  }

  if (!ledger.steps.check) markStep(ledger, 'check', 'done', now);
  try {
    writeLedger(lr.dir, ledger);
  } catch (e) {
    return { ok: false, reason: 'write_failed:' + (e && e.code ? e.code : 'error') };
  }
  const states = {};
  for (const hat of READ_HATS) {
    states[hat] = { reading: perHat[hat].reading, rule_lines: perHat[hat].rule_lines, evidence_items: perHat[hat].evidence_items, self_found_sources: perHat[hat].self_found_sources };
    if (ledger.hats[hat].none_found_basis) states[hat].none_found_basis = ledger.hats[hat].none_found_basis;
  }
  return { ok: true, run_id: ledger.run_id, hats: states, not_run: notRun, blue_ledger: bluePath };
}

// ---------------------------------------------------------------------------
// merge (deep mode): positions, tensions, same-position lines, the review artifact (plan 08)
// ---------------------------------------------------------------------------

// Owner rule: dissent first. Black is the first line under each sub-question; the others follow in this order.
const DISSENT_ORDER = Object.freeze(['black', 'white', 'red', 'yellow', 'green']);
// The three words are fixed marker text. tension-map.cjs reads them as a benefit marker (benefit, opportunity)
// and a caution marker (risk), so each node holds exactly one marker and the result is deterministic.
const POSITION_MARKERS = Object.freeze({ favours: 'benefit', alternative_offered: 'opportunity', opposes: 'risk' });
const SAME_POSITION_HATS = Object.freeze(['white', 'red', 'black', 'yellow']);
const SAME_POSITION_VALUES = Object.freeze(['favours', 'opposes']);
const COUNT_KEYS = Object.freeze(['agent_runs', 'stops', 'cards']);

// Every fixed sentence and label of the artifact. buildArtifact formats no sentence outside this table.
// A token in braces is filled with a hat name or a closed position value only.
const ARTIFACT_LABELS = Object.freeze({
  none: 'none',
  list_item: '- ',
  heading: '### ',
  section_brief: '## Brief',
  brief_target: 'target: ',
  brief_question: 'governing question: ',
  brief_sub_questions: 'sub-questions:',
  section_dissent: '## Dissent register',
  position: '{hat} {value}: ',
  section_tensions: '## Tensions',
  tension_pair: 'pair: ',
  tension_state: 'state: ',
  tension_id: 'tension id: ',
  settled_on: 'settled on {date}: {ruling}',
  stored_line: 'stored {hat}: ',
  no_tension: 'The tension map found no tension.',
  three_pairs: 'The tension map knows three hat pairs: yellow and black, green and black, red and white. Opposite positions of any other pair are shown in the dissent register only.',
  section_same: '## Same position',
  same_position: '{value}, same position, both attributed: ',
  section_not_run: '## Not run',
  not_run_line: '{hat}: ',
  white_absent: 'White did not run, so no red and white tension can exist.',
  section_rules: '## Rule lines',
  rule_line: '{hat}: ',
  blue_rule: 'Blue is checked against the owner rule, not against the debate judge rule.',
  section_lists: '## Hat lists',
  white_missing_data: 'white missing_data: ',
  white_nothing_missing: 'white nothing_missing: ',
  green_provocation: 'green provocation: ',
  blue_skipped: 'blue skipped: ',
  blue_thin: 'blue thin: ',
  blue_ask_next: 'blue ask_next: ',
  yellow_none_found_door_search_empty: 'yellow none_found: the door search ran and found nothing.',
  yellow_none_found_self_reported_search: 'yellow none_found: based on a search that the hat reports it ran.',
  yellow_none_found_unbased: 'yellow none_found: no search is behind it.',
  section_sources: '## Sources by hat',
  source_id: 'id: ',
  source_title: 'title: ',
  source_url: 'url: ',
  source_tier: 'tier: ',
  source_provider: 'provider: ',
  source_cache_hit: 'cache_hit: ',
  found_by_hat: 'Found by the hat, not approved on a card, not wired to the room graph:',
  found_url: 'url: ',
  found_title: 'title: ',
  found_search_string: 'search string: ',
  found_summary: 'summary: ',
  reported_strings: 'Search strings the hat reports it sent (not approved on a card):',
  prompt_rule: "A hat's own searches follow a prompt rule only. No code checked them before they left the machine.",
  host_web_limit: 'Provider host-web: the assistant ran the web search. Code cannot prove that it searched exactly the approved string.',
  section_rulings: '## Rulings',
  ruling_value: 'ruling: ',
  ruling_side_hat: 'side hat: ',
  ruling_date: 'ruled on: ',
  quick_label: 'Quick mode: one context, no research. Checks that need evidence were not run.',
});

/** The marker text of a closed position value, or null for mixed and no_position. */
function positionMarker(value) {
  return Object.prototype.hasOwnProperty.call(POSITION_MARKERS, value) ? POSITION_MARKERS[value] : null;
}

/**
 * The settled-tension key: SHA-256 hex of the target content hash, the sub-question id and the sorted pair
 * joined by "+", the three parts joined by a newline. Plan 09 uses the same id as the key of its store.
 * WR-04: a quick run adds a fourth part, the word quick, so a ruling on a fast look never settles the tension of a
 * deep run (two modes, each with its own identity). A deep key keeps the three parts.
 */
function tensionKey(targetContentHash, subQuestionId, pair, mode) {
  const sorted = (Array.isArray(pair) ? pair.slice() : []).map(String).sort();
  const parts = [String(targetContentHash), String(subQuestionId), sorted.join('+')];
  if (mode === 'quick') parts.push('quick');
  return sha256Hex(parts.join('\n'));
}

function oneLine(v) {
  return String(v).replace(/[\x00-\x1f\x7f]+/g, ' ').trim();
}

function fillLabel(key, vars) {
  let text = ARTIFACT_LABELS[key];
  for (const k of Object.keys(vars || {})) text = text.split('{' + k + '}').join(String(vars[k]));
  return text;
}

/**
 * The notice lines of a deep run, from the ledger only: the mode notice, then the hats whose research did not
 * run or failed, then the hats whose reading did not run. Hats are named in the fixed order of the door.
 */
function deepNoticeLines(ledger) {
  const lines = [ops.DEEP_NOTICE];
  const hats = isPlain(ledger && ledger.hats) ? ledger.hats : {};
  const reasonOf = (state) => (state.indexOf(':') === -1 ? state : state.slice(state.indexOf(':') + 1));
  // run-research keeps the state name bare and the reason beside it (research_reason): the notice names the reason.
  const whyOf = (hat, state) => (hats[hat] && typeof hats[hat].research_reason === 'string' && hats[hat].research_reason ? hats[hat].research_reason : reasonOf(state));
  const notRun = [];
  const failedRun = [];
  for (const hat of RESEARCH_HATS) {
    const st = hats[hat] && typeof hats[hat].research === 'string' ? hats[hat].research : '';
    if (st === 'declined' || st.indexOf('not_planned') === 0) notRun.push(hat + ' (' + whyOf(hat, st) + ')');
    else if (st.indexOf('failed') === 0 || st.indexOf('fetched_not_wired') === 0) failedRun.push(hat + ' (' + whyOf(hat, st) + ')');
  }
  if (notRun.length) lines.push('Research not run for: ' + notRun.join(', ') + '.');
  if (failedRun.length) lines.push('Research failed for: ' + failedRun.join(', ') + '.');
  const missing = HATS.filter(hat => {
    const st = hats[hat] && typeof hats[hat].reading === 'string' ? hats[hat].reading : '';
    return st.indexOf('not_run') === 0 || st.indexOf('rejected') === 0;
  });
  if (missing.length) lines.push('Not run: ' + missing.join(', ') + '.');
  return lines;
}

/**
 * The notice lines of a quick run: the quick notice, the fixed quick label, then the hats that did not run.
 * The text of both fixed lines is a constant (QUICK_NOTICE, the quick_label of ARTIFACT_LABELS).
 */
function quickNoticeLines(ledger) {
  const lines = [ops.QUICK_NOTICE, ARTIFACT_LABELS.quick_label];
  const hats = isPlain(ledger && ledger.hats) ? ledger.hats : {};
  const missing = HATS.filter(hat => {
    const st = hats[hat] && typeof hats[hat].reading === 'string' ? hats[hat].reading : '';
    return st.indexOf('not_run') === 0 || st.indexOf('rejected') === 0;
  });
  if (missing.length) lines.push('Not run: ' + missing.join(', ') + '.');
  return lines;
}

/** The notice lines of a run record, by mode. */
function noticeLinesOf(ledger) {
  return ledger && ledger.mode === 'quick' ? quickNoticeLines(ledger) : deepNoticeLines(ledger);
}

/** The full door pack of a hat for the artifact: items and strings, plain objects only. */
function readPackForArtifact(file) {
  const r = readJsonFile(file, { noSymlink: true });
  const out = { items: [], strings: [] };
  if (!r.ok || !isPlain(r.value)) return out;
  if (Array.isArray(r.value.items)) out.items = r.value.items.filter(isPlain);
  if (Array.isArray(r.value.strings)) out.strings = r.value.strings.filter(isPlain);
  return out;
}

function cacheHitOf(pack, item) {
  for (const s of pack.strings) {
    if (s.q_hash !== item.q_hash || !Array.isArray(s.providers)) continue;
    for (const p of s.providers) {
      if (isPlain(p) && p.provider === item.provider && typeof p.cache_hit === 'boolean') return String(p.cache_hit);
    }
  }
  return 'unknown';
}

/**
 * Build the review artifact. Every content line is a reading field, an evidence field, a brief field, a state
 * name of the ledger or an entry of ARTIFACT_LABELS: nothing else is formatted here. A field is shown verbatim,
 * except that line breaks become spaces so that no field can start a line of its own.
 * @param {Object} record The run ledger after the merge fields are set.
 * @param {Object} readings The parsed readings of the hats that ran, by hat.
 * @param {Object} packs The door packs {items, strings} by researching hat.
 * @returns {string}
 */
function buildArtifact(record, readings, packs) {
  const L = ARTIFACT_LABELS;
  const out = [];
  const push = (text) => out.push(String(text).replace(/\s+$/, ''));
  const field = (key, value, vars) => push(fillLabel(key, vars) + oneLine(value));
  const subs = Array.isArray(record.sub_questions) ? record.sub_questions : [];
  const positions = isPlain(record.positions) ? record.positions : {};
  const ran = (hat) => Boolean(record.hats && record.hats[hat] && record.hats[hat].reading === 'ran');
  const posLine = (sqId, hat) => {
    const p = positions[sqId] && positions[sqId][hat];
    return fillLabel('position', { hat, value: p.value }) + oneLine(p.line);
  };

  noticeLinesOf(record).forEach(push);
  push('');
  push(L.section_brief);
  field('brief_target', record.target);
  field('brief_question', record.brief && record.brief.governing_question);
  push(L.brief_sub_questions);
  for (const sq of subs) field('list_item', sq.text);

  push('');
  push(L.section_dissent);
  for (const sq of subs) {
    field('heading', sq.text);
    let any = false;
    for (const hat of DISSENT_ORDER) {
      if (positions[sq.id] && positions[sq.id][hat]) { push(posLine(sq.id, hat)); any = true; }
    }
    if (!any) push(L.none);
  }

  push('');
  push(L.section_tensions);
  const tensions = Array.isArray(record.tensions) ? record.tensions : [];
  if (tensions.length === 0) push(L.no_tension);
  for (const sq of subs) {
    const mine = tensions.filter(t => t.sub_question === sq.id);
    if (mine.length === 0) continue;
    field('heading', sq.text);
    for (const t of mine) {
      field('tension_pair', t.pair.join(' and '));
      for (const hat of t.pair) push(posLine(sq.id, hat));
      if (t.state === 'settled' && isPlain(t.stored_lines)) {
        push(fillLabel('settled_on', { date: String(t.ruled_at).slice(0, 10), ruling: t.ruling }));
        for (const hat of t.pair) field('stored_line', typeof t.stored_lines[hat] === 'string' ? t.stored_lines[hat] : '', { hat });
      }
      field('tension_state', t.state);
      field('tension_id', t.id);
    }
  }
  push(L.three_pairs);

  push('');
  push(L.section_same);
  const same = Array.isArray(record.same_position) ? record.same_position : [];
  if (same.length === 0) push(L.none);
  for (const sq of subs) {
    const mine = same.filter(e => e.sub_question === sq.id);
    if (mine.length === 0) continue;
    field('heading', sq.text);
    for (const e of mine) push(fillLabel('same_position', { value: e.value }) + e.hats.join(', '));
  }

  push('');
  push(L.section_not_run);
  const notRun = HATS.filter(hat => !ran(hat));
  if (notRun.length === 0) push(L.none);
  for (const hat of notRun) field('not_run_line', record.hats[hat].reading, { hat });
  if (!ran('white')) push(L.white_absent);

  push('');
  push(L.section_rules);
  let anyRule = false;
  for (const hat of READ_HATS) {
    if (!ran(hat)) continue;
    for (const rl of record.hats[hat].rule_lines || []) { field('rule_line', rl, { hat }); anyRule = true; }
  }
  if (!anyRule) push(L.none);
  if (ran('blue')) push(L.blue_rule);

  push('');
  push(L.section_lists);
  let anyList = false;
  const lists = [];
  const w = readings.white;
  if (w) {
    for (const item of Array.isArray(w.missing_data) ? w.missing_data : []) lists.push(['white_missing_data', item]);
    if (typeof w.nothing_missing === 'boolean') lists.push(['white_nothing_missing', String(w.nothing_missing)]);
  }
  const g = readings.green;
  if (g) for (const item of Array.isArray(g.provocations) ? g.provocations : []) lists.push(['green_provocation', item]);
  const b = readings.blue;
  if (b) {
    for (const item of Array.isArray(b.skipped) ? b.skipped : []) lists.push(['blue_skipped', item]);
    for (const item of Array.isArray(b.thin) ? b.thin : []) lists.push(['blue_thin', item]);
    for (const item of Array.isArray(b.ask_next) ? b.ask_next : []) lists.push(['blue_ask_next', item]);
  }
  for (const [key, item] of lists) { field(key, item); anyList = true; }
  const y = readings.yellow;
  if (y && y.none_found === true) {
    const basis = record.hats.yellow.none_found_basis;
    const key = basis === 'door_search_empty' ? 'yellow_none_found_door_search_empty'
      : (basis === 'self_reported_search' ? 'yellow_none_found_self_reported_search' : 'yellow_none_found_unbased');
    push(L[key]);
    anyList = true;
  }
  if (!anyList) push(L.none);

  push('');
  push(L.section_sources);
  let anySource = false;
  let anyString = false;
  for (const hat of RESEARCH_HATS) {
    const pack = packs[hat] || { items: [], strings: [] };
    const found = readings[hat] && Array.isArray(readings[hat].self_found_sources) ? readings[hat].self_found_sources : [];
    const strings = readings[hat] && Array.isArray(readings[hat].self_search_strings) ? readings[hat].self_search_strings : [];
    if (pack.items.length === 0 && found.length === 0 && strings.length === 0) continue;
    anySource = true;
    field('heading', hat);
    for (const it of pack.items) {
      field('source_id', it.id);
      field('source_title', it.title);
      field('source_url', it.url);
      field('source_tier', it.tier);
      field('source_provider', it.provider);
      field('source_cache_hit', cacheHitOf(pack, it));
    }
    if (found.length) {
      push(L.found_by_hat);
      for (const f of found) {
        field('found_url', f.url);
        field('found_title', f.title);
        field('found_search_string', f.search_string);
        field('found_summary', f.summary);
      }
    }
    if (strings.length) {
      push(L.reported_strings);
      for (const s of strings) field('list_item', s);
      anyString = true;
    }
  }
  if (!anySource) push(L.none);
  if (RESEARCH_HATS.some(hat => packs[hat] && packs[hat].items.some(it => it.provider === HOST_WEB_PROVIDER))) push(L.host_web_limit);
  if (anyString) push(L.prompt_rule);
  return out.join('\n') + '\n';
}

/** Read the counts file of the command. No path gives null. @returns {{ok: true, counts: Object|null} | {ok: false, reason: string}} */
function readCounts(countsPath) {
  if (countsPath === undefined || countsPath === null) return { ok: true, counts: null };
  const r = readJsonFile(countsPath, { noSymlink: true });
  if (!r.ok) return { ok: false, reason: 'counts_invalid:' + r.reason };
  if (!isPlain(r.value)) return { ok: false, reason: 'counts_invalid:shape' };
  for (const k of Object.keys(r.value)) {
    if (!COUNT_KEYS.includes(k)) return { ok: false, reason: 'counts_invalid:key' };
  }
  const counts = {};
  for (const k of COUNT_KEYS) {
    const v = r.value[k];
    if (!Number.isInteger(v) || v < 0 || v > 10000) return { ok: false, reason: 'counts_invalid:' + k };
    counts[k] = v;
  }
  return { ok: true, counts };
}

/** Judge the Blue reading (P-8): schema and the citation rule with no allowed source. Blue has no rule lines. */
function judgeBlue(dir, ledger) {
  const rec = { reading: null, reading_sha256: null, value: null };
  const read = readJsonFile(path.join(dir, 'reading.json'), { noSymlink: true });
  if (!read.ok && read.reason === 'file_unreadable') { rec.reading = 'not_run:no_reading_file'; return rec; }
  if (!read.ok) { rec.reading = 'rejected:' + read.reason; return rec; }
  rec.reading_sha256 = read.sha256;
  const schema = validateReading('blue', read.value, { runId: ledger.run_id, subQuestionIds: [] });
  if (!schema.ok) { rec.reading = schema.state; return rec; }
  const cite = citationCheck('blue', read.value, {});
  if (!cite.ok) { rec.reading = cite.state; return rec; }
  rec.reading = 'ran';
  rec.value = read.value;
  return rec;
}

/**
 * One lens-engine rotate call for each sub-question, with the lens set of the hats that ran and hold a marked
 * value. No db is passed, so the engine writes no node. No accept or reject hook is passed.
 * @returns {Promise<{ok: true, tensions: Object[]} | {ok: false, reason: string}>}
 */
async function computeTensions(roomResolved, ledger, positions) {
  const lensEngine = require(path.join(REPO_ROOT, 'lib', 'core', 'lens-engine.cjs'));
  const tensions = [];
  for (const sq of ledger.sub_questions) {
    const lenses = [];
    for (const hat of READ_HATS) {
      const p = positions[sq.id][hat];
      if (p && positionMarker(p.value) !== null) lenses.push(hat + '-hat');
    }
    if (lenses.length < 2) continue;
    let result;
    try {
      result = await lensEngine.rotate({
        lensType: 'cognitive',
        lensSet: lenses,
        rotationMode: 'parallel',
        synthesize: 'tension-map',
        input: { roomDir: roomResolved, topic: sq.id, sessionId: 'persona-merge-' + ledger.run_id + '-' + sq.id },
        perLensFn: (lens) => {
          const p = positions[sq.id][lens.replace(/-hat$/, '')];
          return p ? { topic: sq.id, summary: positionMarker(p.value) } : null;
        },
      });
    } catch (e) {
      return { ok: false, reason: 'tension_call_failed:thrown' };
    }
    if (!result || result.ok !== true || !isPlain(result.synthesis) || !Array.isArray(result.synthesis.tensions)) {
      return { ok: false, reason: 'tension_call_failed:' + safeKeyName(result && result.reason) };
    }
    const mine = [];
    for (const t of result.synthesis.tensions) {
      const pair = (Array.isArray(t.lenses) ? t.lenses : []).map(l => String(l).replace(/-hat$/, '')).sort();
      if (pair.length !== 2) continue;
      mine.push({
        id: tensionKey(ledger.target_content_hash, sq.id, pair, ledger.mode),
        sub_question: sq.id,
        pair,
        lines: { [pair[0]]: positions[sq.id][pair[0]].line, [pair[1]]: positions[sq.id][pair[1]].line },
        state: 'open',
      });
    }
    mine.sort((a, b) => (a.pair.join('+') < b.pair.join('+') ? -1 : (a.pair.join('+') > b.pair.join('+') ? 1 : 0)));
    for (const t of mine) tensions.push(t);
  }
  return { ok: true, tensions };
}

/** Two or more of white, red, black and yellow with the same favours or opposes value on one sub-question. */
function computeSamePosition(ledger, positions) {
  const out = [];
  for (const sq of ledger.sub_questions) {
    for (const value of SAME_POSITION_VALUES) {
      const hats = SAME_POSITION_HATS.filter(hat => positions[sq.id][hat] && positions[sq.id][hat].value === value);
      if (hats.length >= 2) out.push({ sub_question: sq.id, value, hats });
    }
  }
  return out;
}

function atomicWriteText(target, text) {
  const tmp = path.join(path.dirname(target), '.' + path.basename(target) + '.' + process.pid + '.' + crypto.randomBytes(4).toString('hex') + '.tmp');
  try {
    fs.writeFileSync(tmp, text, { encoding: 'utf8', mode: 0o644 });
    fs.renameSync(tmp, target);
  } catch (e) {
    try { fs.rmSync(tmp, { force: true }); } catch (_) { /* ignore */ }
    throw e;
  }
}

/** Delete the scratch tree and the private run map of a run. @returns {boolean} */
function cleanupRun(map, homeDir, runId) {
  let ok = true;
  const root = map && map.scratch_root;
  const m = typeof root === 'string' ? SCRATCH_RE.exec(path.basename(root)) : null;
  if (!m || m[1] !== runId) {
    ok = false;
  } else {
    try {
      const st = fs.lstatSync(root);
      if (st.isDirectory() && !st.isSymbolicLink()) fs.rmSync(root, { recursive: true, force: true });
      else ok = false;
    } catch (e) {
      if (!e || e.code !== 'ENOENT') ok = false;
    }
  }
  try { fs.rmSync(runMapPath(homeDir, runId), { force: true }); } catch (e) { ok = false; }
  return ok;
}

/**
 * Step merge (deep mode). It judges every reading again from the file bytes, makes the positions table, calls the
 * existing tension map once for each sub-question, lists same positions, files the review artifact and the final
 * run record, writes one session log entry for each hat with position lines, and deletes the scratch tree and the
 * run map last. It adds no fact, risk, idea or recommendation and promotes no claim.
 */
async function cmdMerge(args, deps) {
  const roomResolved = roomDirCheck(args && args.roomDir);
  if (!roomResolved) return { ok: false, reason: 'room_not_found' };
  const lr = readLedger(roomResolved, args.runId);
  if (!lr.ok) return lr;
  const ledger = lr.ledger;
  // A quick run merges with a quick result file and a deep run without one (plan 16).
  const hasQuickFile = typeof args.quickResultPath === 'string' && args.quickResultPath.length > 0;
  if ((ledger.mode === 'quick') !== hasQuickFile && (ledger.mode === 'quick' || ledger.mode === 'deep')) return { ok: false, reason: 'mode_mismatch' };
  if (ledger.mode === 'quick') return mergeQuickRun(roomResolved, lr, args, deps);
  if (ledger.mode !== 'deep') return { ok: false, reason: 'mode_not_deep' };
  if (ledger.steps.merge) return { ok: false, reason: 'step_already_done:merge' };
  const order = requireStep(ledger, 'check');
  if (order) return { ok: false, reason: order };
  const homeDir = homeDirOf(deps);
  const map = readRunMap(homeDir, ledger.run_id, roomResolved);
  if (!map) return { ok: false, reason: 'run_map_missing' };
  for (const hat of HATS) {
    if (!hatDirOf(map, hat)) return { ok: false, reason: 'run_map_missing' };
  }
  const counts = readCounts(args.countsPath);
  if (!counts.ok) return counts;
  // A corrupt rulings store stops the merge before anything is written: a settled tension must not come back by accident.
  const rulings = readRulingsStore(roomResolved);
  if (!rulings.ok) return rulings;

  const subQuestionIds = ledger.sub_questions.map(s => s.id);
  const now = nowOf(deps);
  const screen = roomIdentityScreen(roomResolved, ledger.brief && ledger.brief.reading_list);

  // 1. Judge each reading again. P-7: a file whose hash differs from the one of check is rejected.
  const verdict = {};
  const readings = {};
  for (const hat of READ_HATS) {
    const entry = ledger.hats[hat];
    if (entry.reading !== 'ran') {
      verdict[hat] = { state: entry.reading };
      continue;
    }
    const judged = judgeReading(hat, hatDirOf(map, hat), { runId: ledger.run_id, subQuestionIds, researchState: entry.research, packs: map.packs, screen });
    if (judged.rec.reading_sha256 !== entry.reading_sha256) {
      verdict[hat] = { state: 'rejected:changed_after_check' };
    } else if (judged.rec.reading !== 'ran') {
      verdict[hat] = { state: judged.rec.reading };
    } else {
      verdict[hat] = { state: 'ran', rec: judged.rec, none_found_basis: judged.none_found_basis };
      readings[hat] = judged.value;
    }
  }
  const blueEntry = ledger.hats.blue;
  const blueJudged = blueEntry.reading === 'pending' ? judgeBlue(hatDirOf(map, 'blue'), ledger) : null;
  if (blueJudged && blueJudged.reading === 'ran') readings.blue = blueJudged.value;

  // 2. The positions table, only from readings that ran.
  const positions = {};
  for (const sq of ledger.sub_questions) positions[sq.id] = {};
  for (const hat of READ_HATS) {
    if (!readings[hat]) continue;
    for (const p of readings[hat].positions) {
      positions[p.sub_question][hat] = { value: p.value, line: typeof p.line === 'string' ? p.line : '' };
    }
  }

  // 3. Tensions and same-position lines, before anything is written.
  const tensionResult = await computeTensions(roomResolved, ledger, positions);
  if (!tensionResult.ok) return tensionResult;
  markSettled(tensionResult.tensions, rulings.rulings);
  const samePosition = computeSamePosition(ledger, positions);

  // 4. The final run record (S-8). No key holds a score, a rank across hats or a winner.
  for (const hat of READ_HATS) {
    const entry = ledger.hats[hat];
    const v = verdict[hat];
    entry.reading = v.state;
    if (v.state === 'ran') {
      entry.rule_lines = v.rec.rule_lines;
      entry.evidence_items = v.rec.evidence_items;
      entry.positions_taken = v.rec.positions_taken;
      entry.self_search_strings = v.rec.self_search_strings;
      entry.self_found_sources = v.rec.self_found_sources;
      if (v.none_found_basis) entry.none_found_basis = v.none_found_basis; else delete entry.none_found_basis;
    } else {
      entry.rule_lines = [];
      entry.evidence_items = 0;
      entry.positions_taken = 0;
      entry.self_search_strings = [];
      entry.self_found_sources = 0;
      delete entry.none_found_basis;
    }
  }
  if (blueJudged) {
    blueEntry.reading = blueJudged.reading;
    if (blueJudged.reading_sha256) blueEntry.reading_sha256 = blueJudged.reading_sha256;
  }
  const packs = {};
  const sources = {};
  for (const hat of HATS) {
    // A pack that differs from its sealed hash is not shown: its hat could have written the items itself.
    const sealed = RESEARCH_HATS.includes(hat) && packTamper(hat, hatDirOf(map, hat), map.packs) === null;
    packs[hat] = sealed ? readPackForArtifact(path.join(hatDirOf(map, hat), 'evidence.json')) : { items: [], strings: [] };
    sources[hat] = packs[hat].items.length;
  }
  ledger.positions = positions;
  ledger.tensions = tensionResult.tensions;
  ledger.same_position = samePosition;
  ledger.sources = sources;
  const edited = isPlain(ledger.audit) && Array.isArray(ledger.audit.edited_strings) ? ledger.audit.edited_strings : [];
  ledger.audit = counts.counts
    ? { edited_strings: edited, cards: counts.counts.cards, stops: counts.counts.stops, agent_runs: counts.counts.agent_runs, reported_by: 'command' }
    : { edited_strings: edited, cards: null, stops: null, agent_runs: null, reported_by: 'not_reported' };
  ledger.timestamps.merged_at = now.toISOString();
  markStep(ledger, 'merge', 'done', now);

  // 5. The artifact, the copies of the readings, the session log, the run record, then the cleanup.
  const artifactPath = path.join(lr.dir, path.basename(lr.dir) + '.md');
  try {
    atomicWriteText(artifactPath, buildArtifact(ledger, readings, packs));
    const readingsDir = path.join(lr.dir, 'readings');
    fs.mkdirSync(readingsDir, { recursive: true });
    for (const hat of HATS) {
      if (ledger.hats[hat].reading === 'ran') fs.copyFileSync(path.join(hatDirOf(map, hat), 'reading.json'), path.join(readingsDir, hat + '.json'));
    }
  } catch (e) {
    return { ok: false, reason: 'write_failed:' + (e && e.code ? e.code : 'error') };
  }

  // P-6: one entry for each hat with position lines; concerns and opportunities stay empty, because sorting a
  // line into one of them would be an addition by the merge. Blue has no position lines.
  const sessionLog = {};
  for (const hat of READ_HATS) {
    if (!readings[hat]) continue;
    const findings = ledger.sub_questions.map(sq => positions[sq.id][hat].line).filter(line => line.length > 0).map(oneLine);
    if (findings.length === 0) continue;
    try {
      const r = ops.persistPersonaFindings(roomResolved, hat, { focus: ledger.target, findings, concerns: [], opportunities: [] });
      sessionLog[hat] = r && r.persisted ? 'logged' : 'failed:' + safeKeyName(r && r.error);
    } catch (e) {
      sessionLog[hat] = 'failed:error';
    }
  }

  try {
    writeLedger(lr.dir, ledger);
  } catch (e) {
    return { ok: false, reason: 'write_failed:' + (e && e.code ? e.code : 'error') };
  }
  const cleaned = cleanupRun(map, homeDir, ledger.run_id);

  const hatsOut = {};
  const notRun = [];
  for (const hat of HATS) {
    const e = ledger.hats[hat];
    hatsOut[hat] = { reading: e.reading, evidence_items: e.evidence_items || 0, self_found_sources: e.self_found_sources || 0 };
    if (e.reading !== 'ran') notRun.push({ hat, reason: String(e.reading).replace(/^(not_run|rejected):/, ''), state: e.reading });
  }
  return {
    ok: true,
    notice_lines: deepNoticeLines(ledger),
    run_id: ledger.run_id,
    artifact: artifactPath,
    review_dir: lr.dir,
    tensions: ledger.tensions,
    open: ledger.tensions.filter(t => t.state === 'open'),
    settled: ledger.tensions.filter(t => t.state === 'settled'),
    same_position: samePosition,
    hats: hatsOut,
    not_run: notRun,
    session_log: sessionLog,
    cleanup: cleaned ? 'done' : 'failed',
  };
}

// ---------------------------------------------------------------------------
// Quick run record (plan 16): merge with a quick result file
// ---------------------------------------------------------------------------

const QUICK_SCHEMA = 'mos.persona-quick/1';
const QUICK_RESULT_KEYS = Object.freeze(['schema', 'run_id', 'hats']);
const QUICK_HAT_KEYS = Object.freeze(['positions', 'provocations', 'skipped', 'thin', 'ask_next']);
// Quick mode has no research and no search of any kind (owner answer 1 of the second card): these keys are refused by name.
const QUICK_FORBIDDEN_KEYS = Object.freeze(['evidence', 'self_search_strings', 'self_found_sources', 'justification', 'verdict', 'none_found', 'missing_data']);

/**
 * Check a quick result (S-7) against the closed schema. The positions and the closed value lists are those of the
 * reading of the hat (validateReading); a key that names evidence or a search is refused by name; no URL and no
 * evidence claim id may stand in any string, because a quick run has no source to cite. Pure. Never echoes text.
 * @param {*} result The parsed file.
 * @param {{runId: string, subQuestionIds: string[]}} ctx
 * @returns {{ok: true, readings: Object} | {ok: false, reason: string, hat?: string}}
 */
function validateQuickResult(result, ctx) {
  const c = ctx || {};
  const fail = (reason, hat) => (hat ? { ok: false, reason, hat } : { ok: false, reason });
  if (!isPlain(result)) return fail('schema_invalid:quick_result');
  for (const k of Object.keys(result)) {
    if (!QUICK_RESULT_KEYS.includes(k)) return fail('unknown_key:' + safeKeyName(k));
  }
  if (result.schema !== QUICK_SCHEMA) return fail('schema_invalid:schema');
  if (result.run_id !== c.runId) return fail('schema_invalid:run_id');
  if (!isPlain(result.hats) || Object.keys(result.hats).length === 0) return fail('schema_invalid:hats');
  for (const hat of Object.keys(result.hats)) {
    if (!HATS.includes(hat)) return fail('schema_invalid:hat');
  }
  const readings = {};
  for (const hat of HATS) {
    if (!Object.prototype.hasOwnProperty.call(result.hats, hat)) continue;
    const entry = result.hats[hat];
    if (!isPlain(entry)) return fail('schema_invalid:hats.' + hat, hat);
    for (const k of Object.keys(entry)) {
      if (QUICK_FORBIDDEN_KEYS.includes(k)) return fail('forbidden_key:' + k, hat);
      if (!QUICK_HAT_KEYS.includes(k)) return fail('unknown_key:' + safeKeyName(k), hat);
    }
    const reading = Object.assign({ schema: 'mos.persona-reading/1', run_id: c.runId, hat }, entry);
    const checked = validateReading(hat, reading, { runId: c.runId, subQuestionIds: c.subQuestionIds });
    if (!checked.ok) return fail(checked.reason, hat);
    const cite = citationCheck(hat, reading, {});
    if (!cite.ok) return fail(cite.reason, hat);
    readings[hat] = reading;
  }
  return { ok: true, readings };
}

/**
 * Step merge (quick mode). It validates the quick result, builds the positions table, makes the same tension call
 * and the same same-position rule as deep, marks settled tensions from the rulings store, files the artifact with
 * the quick notice first and the run record, and deletes the scratch tree. It makes no check (check is recorded as
 * skipped), no research and no session log: a one-context pass never enters the persistent state of a hat (P-10).
 */
async function mergeQuickRun(roomResolved, lr, args, deps) {
  const ledger = lr.ledger;
  if (ledger.steps.merge) return { ok: false, reason: 'step_already_done:merge' };
  const homeDir = homeDirOf(deps);
  const map = readRunMap(homeDir, ledger.run_id, roomResolved);
  if (!map) return { ok: false, reason: 'run_map_missing' };
  const counts = readCounts(args.countsPath);
  if (!counts.ok) return counts;
  const rulings = readRulingsStore(roomResolved);
  if (!rulings.ok) return rulings;
  const read = readJsonFile(args.quickResultPath, { noSymlink: true });
  if (!read.ok) return { ok: false, reason: read.reason };
  const subQuestionIds = ledger.sub_questions.map(s => s.id);
  const checked = validateQuickResult(read.value, { runId: ledger.run_id, subQuestionIds });
  if (!checked.ok) return { ok: false, reason: checked.reason };
  const readings = checked.readings;
  const now = nowOf(deps);

  const positions = {};
  for (const sq of ledger.sub_questions) positions[sq.id] = {};
  for (const hat of READ_HATS) {
    if (!readings[hat]) continue;
    for (const p of readings[hat].positions) {
      positions[p.sub_question][hat] = { value: p.value, line: typeof p.line === 'string' ? p.line : '' };
    }
  }
  const tensionResult = await computeTensions(roomResolved, ledger, positions);
  if (!tensionResult.ok) return tensionResult;
  markSettled(tensionResult.tensions, rulings.rulings);
  const samePosition = computeSamePosition(ledger, positions);

  for (const hat of HATS) {
    const entry = ledger.hats[hat];
    entry.research = hat === 'red' || hat === 'blue' ? 'never_searches' : 'not_applicable';
    entry.reading = readings[hat] ? 'ran' : 'not_run:not_in_quick_result';
    if (hat === 'blue') continue;
    entry.rule_lines = [];
    entry.evidence_items = 0;
    entry.positions_taken = readings[hat] ? readings[hat].positions.filter(p => p.value !== 'no_position').length : 0;
    entry.self_search_strings = [];
    entry.self_found_sources = 0;
  }
  const sources = {};
  for (const hat of HATS) sources[hat] = 0;
  ledger.positions = positions;
  ledger.tensions = tensionResult.tensions;
  ledger.same_position = samePosition;
  ledger.sources = sources;
  ledger.quick_result_sha256 = read.sha256;
  ledger.audit = counts.counts
    ? { edited_strings: [], cards: counts.counts.cards, stops: counts.counts.stops, agent_runs: counts.counts.agent_runs, reported_by: 'command' }
    : { edited_strings: [], cards: null, stops: null, agent_runs: null, reported_by: 'not_reported' };
  ledger.timestamps.merged_at = now.toISOString();
  markStep(ledger, 'check', 'skipped', now);
  markStep(ledger, 'merge', 'done', now);

  const artifactPath = path.join(lr.dir, path.basename(lr.dir) + '.md');
  try {
    atomicWriteText(artifactPath, buildArtifact(ledger, readings, {}));
    fs.copyFileSync(args.quickResultPath, path.join(lr.dir, 'quick-result.json'));
    writeLedger(lr.dir, ledger);
  } catch (e) {
    return { ok: false, reason: 'write_failed:' + (e && e.code ? e.code : 'error') };
  }
  const cleaned = cleanupRun(map, homeDir, ledger.run_id);

  const hatsOut = {};
  const notRun = [];
  for (const hat of HATS) {
    const e = ledger.hats[hat];
    hatsOut[hat] = { reading: e.reading, evidence_items: 0, self_found_sources: 0 };
    if (e.reading !== 'ran') notRun.push({ hat, reason: String(e.reading).replace(/^(not_run|rejected):/, ''), state: e.reading });
  }
  return {
    ok: true,
    notice_lines: quickNoticeLines(ledger),
    run_id: ledger.run_id,
    artifact: artifactPath,
    review_dir: lr.dir,
    tensions: ledger.tensions,
    open: ledger.tensions.filter(t => t.state === 'open'),
    settled: ledger.tensions.filter(t => t.state === 'settled'),
    same_position: samePosition,
    hats: hatsOut,
    not_run: notRun,
    session_log: {},
    cleanup: cleaned ? 'done' : 'failed',
  };
}

// ---------------------------------------------------------------------------
// Tension rulings (plan 09): the store, the settled mark, record-ruling
// ---------------------------------------------------------------------------

const RULINGS_FILE = 'tension-rulings.json';
const RULINGS_SCHEMA = 'mos.persona-tension-rulings/1';
const RULING_ANSWER_SCHEMA = 'mos.persona-ruling-answer/1';
const RULING_VALUES = Object.freeze(['side_a', 'side_b', 'both_hold', 'defer']);
const STORED_RULINGS = Object.freeze(['side_a', 'side_b', 'both_hold']);
const RULING_ANSWER_KEYS = Object.freeze(['schema', 'run_id', 'rulings']);
const RULING_ENTRY_KEYS = Object.freeze(['tension_id', 'ruling', 'reason', 'reopen']);
const STORE_ENTRY_KEYS = Object.freeze(['ruling', 'reason', 'ruled_at', 'run_id', 'sub_question_text', 'pair', 'lines']);
const MAX_RULINGS_PER_ANSWER = 75;
const TENSION_ID_RE = /^[0-9a-f]{64}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T[0-9:.]+Z$/;

function rulingsStorePath(roomResolved) {
  return path.join(roomResolved, '.mindrian', 'hats', RULINGS_FILE);
}

function storeEntryValid(e) {
  if (!isPlain(e)) return false;
  const keys = Object.keys(e);
  if (keys.length !== STORE_ENTRY_KEYS.length || !STORE_ENTRY_KEYS.every(k => keys.includes(k))) return false;
  if (!STORED_RULINGS.includes(e.ruling)) return false;
  if (typeof e.reason !== 'string' || e.reason.length > 280) return false;
  if (typeof e.ruled_at !== 'string' || !ISO_RE.test(e.ruled_at)) return false;
  if (typeof e.run_id !== 'string' || typeof e.sub_question_text !== 'string') return false;
  if (!Array.isArray(e.pair) || e.pair.length !== 2 || !e.pair.every(h => HATS.includes(h)) || e.pair[0] >= e.pair[1]) return false;
  if (!isPlain(e.lines)) return false;
  const lk = Object.keys(e.lines).sort();
  if (lk.length !== 2 || lk[0] !== e.pair[0] || lk[1] !== e.pair[1]) return false;
  return lk.every(k => typeof e.lines[k] === 'string');
}

/**
 * Read the rulings store of a room. A missing file is an empty store. A file that is not valid (bad JSON, another
 * schema, an entry out of shape) is refused, so a settled tension never comes back by accident.
 * @returns {{ok: true, rulings: Object} | {ok: false, reason: string}}
 */
function readRulingsStore(roomDir) {
  const p = rulingsStorePath(path.resolve(String(roomDir)));
  try {
    fs.lstatSync(p);
  } catch (e) {
    if (e && e.code === 'ENOENT') return { ok: true, rulings: {} };
    return { ok: false, reason: 'rulings_store_invalid' };
  }
  const r = readJsonFile(p, { noSymlink: true });
  if (!r.ok || !isPlain(r.value)) return { ok: false, reason: 'rulings_store_invalid' };
  const v = r.value;
  const keys = Object.keys(v);
  if (keys.length !== 2 || !keys.includes('schema') || !keys.includes('rulings') || v.schema !== RULINGS_SCHEMA || !isPlain(v.rulings)) {
    return { ok: false, reason: 'rulings_store_invalid' };
  }
  for (const id of Object.keys(v.rulings)) {
    if (!TENSION_ID_RE.test(id) || !storeEntryValid(v.rulings[id])) return { ok: false, reason: 'rulings_store_invalid' };
  }
  return { ok: true, rulings: v.rulings };
}

/** Mark each tension whose id is in the store as settled, with the stored ruling, its date and the stored lines. */
function markSettled(tensions, stored) {
  for (const t of tensions) {
    const e = Object.prototype.hasOwnProperty.call(stored, t.id) ? stored[t.id] : null;
    if (!e) continue;
    t.state = 'settled';
    t.ruling = e.ruling;
    t.ruled_at = e.ruled_at;
    t.stored_lines = { [t.pair[0]]: typeof e.lines[t.pair[0]] === 'string' ? e.lines[t.pair[0]] : '', [t.pair[1]]: typeof e.lines[t.pair[1]] === 'string' ? e.lines[t.pair[1]] : '' };
  }
}

function rulingAnswerRefusal(answer, runId) {
  if (!isPlain(answer)) return 'schema_invalid:answer';
  for (const k of Object.keys(answer)) {
    if (!RULING_ANSWER_KEYS.includes(k)) return 'schema_invalid:unknown_key:' + safeKeyName(k);
  }
  if (answer.schema !== RULING_ANSWER_SCHEMA) return 'schema_invalid:schema';
  if (answer.run_id !== runId) return 'schema_invalid:run_id';
  if (!Array.isArray(answer.rulings) || answer.rulings.length < 1 || answer.rulings.length > MAX_RULINGS_PER_ANSWER) return 'schema_invalid:rulings';
  const seen = new Set();
  for (let i = 0; i < answer.rulings.length; i += 1) {
    const e = answer.rulings[i];
    const at = 'schema_invalid:rulings.' + i;
    if (!isPlain(e)) return at;
    for (const k of Object.keys(e)) {
      if (!RULING_ENTRY_KEYS.includes(k)) return at + '.' + safeKeyName(k);
    }
    if (typeof e.tension_id !== 'string' || !TENSION_ID_RE.test(e.tension_id)) return at + '.tension_id';
    if (!RULING_VALUES.includes(e.ruling)) return at + '.ruling';
    if (e.reason !== undefined && (typeof e.reason !== 'string' || e.reason.length > 280)) return at + '.reason';
    if (e.reopen !== undefined && typeof e.reopen !== 'boolean') return at + '.reopen';
    if (seen.has(e.tension_id)) return 'schema_invalid:duplicate_tension';
    seen.add(e.tension_id);
  }
  return null;
}

/**
 * The state of a ruled tension in the filed artifact (plan 16, orchestrator decision). The merge wrote the artifact
 * from evidence packs that are gone, so it cannot be rebuilt. This function edits the text only in two fixed ways:
 * the `state:` line above each `tension id:` line is set to the state of the run record (and the stored lines of a
 * tension that is open again are dropped), and a last section "## Rulings" is written again from the run record.
 * Every line of the section is a fixed label and one field (tension id, ruling, side hat, date). It adds no content.
 * @returns {string}
 */
function applyRulingsToArtifactText(text, tensions) {
  const L = ARTIFACT_LABELS;
  let lines = String(text).split('\n').map(l => l.replace(/\s+$/, ''));
  const had = lines.indexOf(L.section_rulings);
  if (had !== -1) lines = lines.slice(0, had);
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  for (const t of tensions) {
    const at = lines.indexOf(L.tension_id + t.id);
    if (at < 1 || lines[at - 1].indexOf(L.tension_state) !== 0) continue;
    lines[at - 1] = L.tension_state + t.state;
    if (t.state === 'open') {
      let from = at - 1;
      while (from > 0 && (lines[from - 1].indexOf('settled on ') === 0 || lines[from - 1].indexOf('stored ') === 0)) from -= 1;
      lines.splice(from, at - 1 - from);
    }
  }
  const settled = tensions.filter(t => t.state === 'settled' && typeof t.ruling === 'string' && typeof t.ruled_at === 'string');
  if (settled.length > 0 || had !== -1) {
    lines.push('');
    lines.push(L.section_rulings);
    if (settled.length === 0) lines.push(L.none);
    settled.forEach((t, i) => {
      if (i > 0) lines.push('');
      lines.push(L.tension_id + t.id);
      lines.push(L.ruling_value + t.ruling);
      lines.push(L.ruling_side_hat + (t.ruling === 'side_a' ? t.pair[0] : (t.ruling === 'side_b' ? t.pair[1] : L.none)));
      lines.push(L.ruling_date + String(t.ruled_at).slice(0, 10));
    });
  }
  return lines.join('\n') + '\n';
}

/** Write the Rulings state into the filed artifact. A missing or unwritable artifact never undoes a stored ruling. */
function updateArtifactRulings(reviewDir, tensions) {
  const file = path.join(reviewDir, path.basename(reviewDir) + '.md');
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    return { state: 'not_updated', reason: e && e.code === 'ENOENT' ? 'artifact_missing' : 'artifact_unreadable' };
  }
  try {
    atomicWriteText(file, applyRulingsToArtifactText(text, tensions));
  } catch (e) {
    return { state: 'not_updated', reason: 'write_failed' };
  }
  return { state: 'updated' };
}

/**
 * Step record_ruling (deep mode, after merge). The answer file holds the navigator ruling for each open tension.
 * A ruling is the navigator answer on a hat pair: it confirms no venture claim. A stored ruling (side_a, side_b,
 * both_hold) goes into the rulings store of the room and makes the tension settled for every later run with the same
 * target content, sub-question text and hat pair. A defer is written to the run record only. An entry with reopen
 * true removes the key from the store. Each stored ruling is also logged as one decision_captured memory event with
 * ids and the ruling value only. This function is the only writer of the store.
 */
function cmdRecordRuling(args, deps) {
  const roomResolved = roomDirCheck(args && args.roomDir);
  if (!roomResolved) return { ok: false, reason: 'room_not_found' };
  const lr = readLedger(roomResolved, args.runId);
  if (!lr.ok) return lr;
  const ledger = lr.ledger;
  // A quick run has the same record of tensions as a deep run, so a ruling works for both (plan 16).
  if (ledger.mode !== 'deep' && ledger.mode !== 'quick') return { ok: false, reason: 'mode_not_deep' };
  const order = requireStep(ledger, 'merge');
  if (order) return { ok: false, reason: order };
  const read = readJsonFile(args.answerPath, { noSymlink: true });
  if (!read.ok) return { ok: false, reason: read.reason };
  const bad = rulingAnswerRefusal(read.value, ledger.run_id);
  if (bad) return { ok: false, reason: bad };
  const answer = read.value;

  const tensions = Array.isArray(ledger.tensions) ? ledger.tensions : [];
  const byId = {};
  for (const t of tensions) byId[t.id] = t;
  for (const e of answer.rulings) {
    if (!Object.prototype.hasOwnProperty.call(byId, e.tension_id)) return { ok: false, reason: 'tension_not_in_run' };
  }
  for (const e of answer.rulings) {
    if (byId[e.tension_id].state === 'settled' && e.reopen !== true) return { ok: false, reason: 'tension_already_settled' };
  }
  const store = readRulingsStore(roomResolved);
  if (!store.ok) return store;

  const now = nowOf(deps);
  const nowIso = now.toISOString();
  // WR-09: the changes are kept by key and merged into the store as it is under the lock, so a concurrent writer of
  // another tension does not lose its ruling.
  const setEntries = {};
  const removedIds = [];
  let storeChanged = false;
  const recorded = [];
  const deferred = [];
  const reopened = [];
  for (const e of answer.rulings) {
    const t = byId[e.tension_id];
    if (e.reopen === true) {
      if (Object.prototype.hasOwnProperty.call(store.rulings, e.tension_id) || Object.prototype.hasOwnProperty.call(setEntries, e.tension_id)) {
        delete setEntries[e.tension_id];
        removedIds.push(e.tension_id);
        storeChanged = true;
      }
      t.state = 'open';
      delete t.ruling;
      delete t.ruled_at;
      delete t.stored_lines;
      reopened.push(e.tension_id);
    } else if (e.ruling === 'defer') {
      t.ruling = 'defer';
      t.ruled_at = nowIso;
      deferred.push(e.tension_id);
    } else {
      const sq = ledger.sub_questions.find(s => s.id === t.sub_question);
      setEntries[e.tension_id] = {
        ruling: e.ruling,
        reason: typeof e.reason === 'string' ? e.reason.trim() : '',
        ruled_at: nowIso,
        run_id: ledger.run_id,
        sub_question_text: sq ? sq.text : '',
        pair: t.pair.slice(),
        lines: Object.assign({}, t.lines),
      };
      storeChanged = true;
      t.state = 'settled';
      t.ruling = e.ruling;
      t.ruled_at = nowIso;
      delete t.stored_lines;
      recorded.push({ tension_id: e.tension_id, ruling: e.ruling, side_hat: e.ruling === 'side_a' ? t.pair[0] : (e.ruling === 'side_b' ? t.pair[1] : null) });
    }
  }

  try {
    if (storeChanged) {
      fs.mkdirSync(path.dirname(rulingsStorePath(roomResolved)), { recursive: true });
      const written = withStoreLock(rulingsStorePath(roomResolved), deps, () => {
        const fresh = readRulingsStore(roomResolved);
        if (!fresh.ok) return fresh;
        const nextStore = Object.assign({}, fresh.rulings);
        for (const id of removedIds) delete nextStore[id];
        for (const id of Object.keys(setEntries)) nextStore[id] = setEntries[id];
        atomicWriteJson(rulingsStorePath(roomResolved), { schema: RULINGS_SCHEMA, rulings: nextStore });
        return { ok: true };
      });
      if (!written.ok) return { ok: false, reason: written.reason === 'store_busy' ? 'rulings_store_busy' : written.reason };
    }
    markStep(ledger, 'record_ruling', 'done', now);
    writeLedger(lr.dir, ledger);
  } catch (e) {
    return { ok: false, reason: 'write_failed:' + (e && e.code ? e.code : 'error') };
  }
  // The filed artifact shows the ruled state (plan 16): fixed labels only, no reason text.
  const artifactState = updateArtifactRulings(lr.dir, tensions);

  // One decision_captured event for each stored ruling: ids and the ruling value only, never the reason or a line.
  // A ruling that cannot be logged stays stored; the output says so.
  let memoryEvent = { state: 'none', logged: 0 };
  if (recorded.length > 0) {
    memoryEvent = { state: 'not_logged', logged: 0, reason: 'no_room_db' };
    let navigation = null;
    let db = null;
    try {
      navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
      db = navigation.openRoomDbForCaller(roomResolved);
    } catch (e) {
      db = null;
    }
    if (db) {
      let logged = 0;
      let failure = null;
      try {
        for (const r of recorded) {
          const t = byId[r.tension_id];
          const res = navigation.logMemoryEvent(db, 'decision_captured', {
            source: 'persona-hats',
            tension_id: r.tension_id,
            ruling: r.ruling,
            run_id: ledger.run_id,
            sub_question_id: t.sub_question,
            pair: t.pair.slice(),
            dedupe_key: 'persona-ruling:' + r.tension_id + ':' + r.ruling,
          }, { now: () => now.getTime() });
          if (res && res.ok) logged += 1; else if (!failure) failure = 'event_refused:' + safeKeyName(res && res.reason);
        }
      } catch (e) {
        failure = failure || 'event_failed';
      } finally {
        try { navigation.closeRoomDbForCaller(db); } catch (_) { /* tolerant */ }
      }
      memoryEvent = logged === recorded.length ? { state: 'logged', logged } : { state: 'not_logged', logged, reason: failure || 'event_failed' };
    }
  }

  return {
    ok: true,
    run_id: ledger.run_id,
    recorded,
    deferred,
    reopened,
    memory_event: memoryEvent,
    artifact: artifactState,
    remaining_open: tensions.filter(t => t.state === 'open').map(t => t.id),
  };
}

// ---------------------------------------------------------------------------
// Phase 400.2-10: the Part 8 controls on a door search string (PS-01)
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

/** The venture name, read with the two rules of extractDomainSignals (venture: line, else the first heading). */
function readVentureName(roomResolved) {
  let state = '';
  try {
    state = fs.readFileSync(path.join(roomResolved, 'STATE.md'), 'utf8');
  } catch (e) {
    return null;
  }
  const m = state.match(/venture:\s*(.+)/i);
  if (m) return m[1].trim();
  const h = state.match(/^#\s+(.+)/m);
  if (h) return h[1].trim();
  return null;
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

/**
 * The four checks on a proposed handle, in a fixed order (DESIGN 4.5): the content fence on the raw text, the
 * generic shape, the digits rule, the room identity screen. A refusal holds ok false and reason only: the refused
 * text is never returned and never written.
 * @param {*} rawHandle
 * @param {object} screen - the result of roomIdentityScreen
 * @returns {{ok: true, handle: string} | {ok: false, reason: string}}
 */
function checkHandle(rawHandle, screen, maxWords) {
  const most = Number.isInteger(maxWords) && maxWords > 0 ? maxWords : 4;
  if (typeof rawHandle !== 'string') return { ok: false, reason: 'handle_not_generic_shape' };
  const rs = require(path.join(REPO_ROOT, 'lib', 'core', 'rs-egress-prompts.cjs'));
  try {
    rs.auditQueryString(rawHandle, 'persona-hats');
  } catch (e) {
    return { ok: false, reason: 'egress_violation' };
  }
  const gdh = require(path.join(REPO_ROOT, 'lib', 'core', 'bono', 'cell-fanout.cjs')).genericDomainHandle;
  const words = rawHandle.length > 0 ? rawHandle.split(' ') : [];
  if (rawHandle !== gdh(rawHandle) || words.length < 1 || words.length > most) return { ok: false, reason: 'handle_not_generic_shape' };
  if (/[0-9]/.test(rawHandle)) return { ok: false, reason: 'handle_has_digit' };
  if (!screen || screen.ran !== true || typeof screen.has !== 'function') return { ok: false, reason: 'identity_screen_unavailable' };
  if (handleHitsScreen(identityTokens(rawHandle), screen)) return { ok: false, reason: 'room_identity_word' };
  return { ok: true, handle: rawHandle };
}

/**
 * Compose the search string of a hat: handle + one space + the fixed qualifier (checks 5 to 7 of DESIGN 4.5).
 * The caller passes a handle that checkHandle accepted.
 * @param {string} hat - white, black, yellow or green
 * @param {string} handle
 * @returns {{ok: true, text: string, handle: string, qualifier: string, q_hash: string} | {ok: false, reason: string}}
 */
function composeString(hat, handle) {
  const table = ops.HAT_RESEARCH_QUALIFIER;
  if (typeof hat !== 'string' || !Object.prototype.hasOwnProperty.call(table, hat)) return { ok: false, reason: 'hat_never_searches' };
  if (typeof handle !== 'string') return { ok: false, reason: 'handle_not_generic_shape' };
  const qualifier = table[hat];
  const text = handle + ' ' + qualifier;
  const gdh = require(path.join(REPO_ROOT, 'lib', 'core', 'bono', 'cell-fanout.cjs')).genericDomainHandle;
  if (text.split(' ').length > 6 || text !== gdh(text)) return { ok: false, reason: 'handle_not_generic_shape' };
  const rs = require(path.join(REPO_ROOT, 'lib', 'core', 'rs-egress-prompts.cjs'));
  const lq = require(path.join(REPO_ROOT, 'lib', 'core', 'dominant-design', 'lane-queries.cjs'));
  const audited = lq.auditEditedQuery(text, { auditFn: (s) => rs.auditQueryString(s, 'persona-hats') });
  if (!audited.ok) return { ok: false, reason: audited.reason };
  const fam = require(path.join(REPO_ROOT, 'lib', 'core', 'research-planner', 'families.cjs'));
  return { ok: true, text, handle, qualifier, q_hash: fam.qHash(text) };
}

/**
 * PS-09: the search string of the nature lens of Green is the nature handle alone (no qualifier). The caller passes a
 * handle that checkHandle accepted with NATURE_MAX_WORDS. The site limit is added by the lens (Tavily domain filter, or
 * the site: prefix of the host search), never here.
 * @returns {{ok: true, text: string, handle: string, q_hash: string} | {ok: false, reason: string}}
 */
function composeNatureString(handle) {
  if (typeof handle !== 'string') return { ok: false, reason: 'handle_not_generic_shape' };
  const gdh = require(path.join(REPO_ROOT, 'lib', 'core', 'bono', 'cell-fanout.cjs')).genericDomainHandle;
  if (handle.split(' ').length > NATURE_MAX_WORDS || handle !== gdh(handle)) return { ok: false, reason: 'handle_not_generic_shape' };
  const rs = require(path.join(REPO_ROOT, 'lib', 'core', 'rs-egress-prompts.cjs'));
  const lq = require(path.join(REPO_ROOT, 'lib', 'core', 'dominant-design', 'lane-queries.cjs'));
  const audited = lq.auditEditedQuery(handle, { auditFn: (s) => rs.auditQueryString(s, 'persona-hats') });
  if (!audited.ok) return { ok: false, reason: audited.reason };
  const fam = require(path.join(REPO_ROOT, 'lib', 'core', 'research-planner', 'families.cjs'));
  return { ok: true, text: handle, handle, q_hash: fam.qHash(handle) };
}

// ---------------------------------------------------------------------------
// run-research (plan 12): the fetch, bound to the approved cards
// ---------------------------------------------------------------------------

const APPROVED_SCHEMA = 'mos.persona-approved/1';
const APPROVED_KEYS = Object.freeze(['schema', 'run_id', 'plan_seq', 'hats']);
const APPROVED_HAT_KEYS = Object.freeze(['decision', 'q_hashes', 'providers']);
const APPROVED_DECISIONS = Object.freeze(['approve', 'refuse', 'defer']);
const MAX_PROVIDER_NAMES = 10;
// The one section that a door finding informs (DESIGN 4.4). The id is 'section:personas'; no code mints that node.
const PERSONA_TARGET_SECTION = 'personas';
const PACK_ITEM_MAX = 10;
const PACK_TITLE_MAX = 300;
const PACK_URL_MAX = 500;
const PACK_SUMMARY_MAX = 600;
const PACK_DOI_MAX = 200;
const FETCH_ORDER = Object.freeze(['white', 'black', 'yellow', 'green']);

/**
 * Check the approved file (S-4) against the plan. Pure. A refusal is for the whole call: nothing is fetched.
 * Order: schema, plan_seq, then each named hat in file order (hat, entry keys, decision, hash and provider shapes,
 * count, plan membership, provider list). The provider list is bound only for an approve decision.
 * @returns {{ok: true} | {ok: false, reason: string}}
 */
function validateApproved(plan, approved) {
  const bad = (reason) => ({ ok: false, reason });
  if (!isPlain(approved)) return bad('schema_invalid:root');
  for (const k of Object.keys(approved)) if (!APPROVED_KEYS.includes(k)) return bad('unknown_key:' + safeKeyName(k));
  if (approved.schema !== APPROVED_SCHEMA) return bad('schema_invalid:schema');
  if (!isPlain(plan) || approved.run_id !== plan.run_id) return bad('schema_invalid:run_id');
  if (!Number.isInteger(approved.plan_seq)) return bad('schema_invalid:plan_seq');
  if (!isPlain(approved.hats)) return bad('schema_invalid:hats');
  if (approved.plan_seq !== plan.plan_seq) return bad('plan_seq_stale');
  for (const hat of Object.keys(approved.hats)) {
    if (hat === 'red' || hat === 'blue') return bad('hat_never_searches');
    if (!RESEARCH_HATS.includes(hat)) return bad('unknown_key:' + safeKeyName(hat));
    const e = approved.hats[hat];
    if (!isPlain(e)) return bad('schema_invalid:hats.' + hat);
    for (const k of Object.keys(e)) if (!APPROVED_HAT_KEYS.includes(k)) return bad('unknown_key:' + safeKeyName(k));
    if (!APPROVED_DECISIONS.includes(e.decision)) return bad('schema_invalid:decision');
    if (!Array.isArray(e.q_hashes) || !e.q_hashes.every(h => typeof h === 'string' && h.length <= 100)) return bad('schema_invalid:q_hashes');
    if (!Array.isArray(e.providers) || e.providers.length > MAX_PROVIDER_NAMES || !e.providers.every(p => typeof p === 'string' && p.length <= 40)) return bad('schema_invalid:providers');
    const rec = plan.hats && plan.hats[hat];
    const nat = isPlain(rec) && rec.state === 'planned' ? naturePlanned(rec) : null;
    if (e.q_hashes.length > MAX_STRINGS_PER_HAT + (nat ? 1 : 0)) return bad('too_many_strings');
    if (new Set(e.q_hashes).size !== e.q_hashes.length) return bad('schema_invalid:q_hashes');
    const known = isPlain(rec) && rec.state === 'planned' && Array.isArray(rec.strings) ? rec.strings.map(s => s && s.q_hash) : [];
    if (nat) known.push(nat.q_hash);
    if (!e.q_hashes.every(h => known.includes(h))) return bad('string_not_in_plan');
    if (e.decision === 'approve') {
      if (e.q_hashes.length === 0) return bad('schema_invalid:q_hashes');
      const want = Array.isArray(rec.providers) ? rec.providers : [];
      if (want.length !== e.providers.length || want.some((p, i) => p !== e.providers[i])) return bad('provider_list_mismatch');
    }
  }
  return { ok: true };
}

// ---- Phase 400.2-19: the results file of the host web search (--host-results) ----
const HOST_RESULTS_SCHEMA = 'mos.persona-host-results/1';
const HOST_RESULTS_KEYS = Object.freeze(['schema', 'run_id', 'plan_seq', 'searches']);
const HOST_SEARCH_KEYS = Object.freeze(['hat', 'lens', 'q_hash', 'string', 'results']);
const HOST_RESULT_KEYS = Object.freeze(['url', 'title', 'snippet']);
const HOST_SEARCHES_MAX = 40;
const HOST_RESULTS_PER_SEARCH_MAX = 10;
const HOST_STRING_MAX = 2000;

const hostKey = (hat, lens, qHash) => hat + '|' + lens + '|' + qHash;

/**
 * Check the host results file against the plan and the approved file. Pure. A refusal is for the whole call: nothing is
 * fetched. A result is accepted only for a (hat, lens, q_hash) that the plan lists as a host search, that the approved
 * file approved for that hat, and whose string equals the exact host string of the plan.
 * Order for each entry: hat, keys and shapes, approval, plan membership, string, duplicate.
 * @returns {{ok: true, index: Map<string, Object>} | {ok: false, reason: string}}
 */
function validateHostResults(plan, approved, doc) {
  const bad = (reason) => ({ ok: false, reason });
  if (!isPlain(doc)) return bad('schema_invalid:root');
  for (const k of Object.keys(doc)) if (!HOST_RESULTS_KEYS.includes(k)) return bad('unknown_key:' + safeKeyName(k));
  if (doc.schema !== HOST_RESULTS_SCHEMA) return bad('schema_invalid:schema');
  if (!isPlain(plan) || doc.run_id !== plan.run_id) return bad('schema_invalid:run_id');
  if (!Number.isInteger(doc.plan_seq)) return bad('schema_invalid:plan_seq');
  if (!Array.isArray(doc.searches) || doc.searches.length > HOST_SEARCHES_MAX) return bad('schema_invalid:searches');
  if (doc.plan_seq !== plan.plan_seq) return bad('plan_seq_stale');
  const index = new Map();
  for (const e of doc.searches) {
    if (!isPlain(e)) return bad('schema_invalid:searches');
    for (const k of Object.keys(e)) if (!HOST_SEARCH_KEYS.includes(k)) return bad('unknown_key:' + safeKeyName(k));
    if (typeof e.hat !== 'string' || e.hat.length > 20) return bad('schema_invalid:hat');
    if (e.hat === 'red' || e.hat === 'blue') return bad('hat_never_searches');
    if (!RESEARCH_HATS.includes(e.hat)) return bad('unknown_key:' + safeKeyName(e.hat));
    if (typeof e.lens !== 'string' || e.lens.length > 20) return bad('schema_invalid:lens');
    if (typeof e.q_hash !== 'string' || e.q_hash.length > 100) return bad('schema_invalid:q_hash');
    if (typeof e.string !== 'string' || e.string.length > HOST_STRING_MAX) return bad('schema_invalid:string');
    if (!Array.isArray(e.results) || e.results.length > HOST_RESULTS_PER_SEARCH_MAX) return bad('schema_invalid:results');
    for (const r of e.results) {
      if (!isPlain(r)) return bad('schema_invalid:results');
      for (const k of Object.keys(r)) if (!HOST_RESULT_KEYS.includes(k)) return bad('schema_invalid:results');
      if (typeof r.url !== 'string' || r.url.length > PACK_URL_MAX) return bad('schema_invalid:results');
      if (typeof r.title !== 'string' || r.title.length > PACK_TITLE_MAX) return bad('schema_invalid:results');
      if (typeof r.snippet !== 'string' || r.snippet.length > PACK_SUMMARY_MAX) return bad('schema_invalid:results');
    }
    const a = isPlain(approved) && isPlain(approved.hats) ? approved.hats[e.hat] : null;
    if (!isPlain(a) || a.decision !== 'approve' || !Array.isArray(a.q_hashes) || !a.q_hashes.includes(e.q_hash)) return bad('host_result_not_approved');
    const rec = plan.hats && plan.hats[e.hat];
    const searches = isPlain(rec) && rec.state === 'planned' && Array.isArray(rec.host_searches) ? rec.host_searches : [];
    const want = searches.find(h => isPlain(h) && h.lens === e.lens && h.q_hash === e.q_hash);
    if (!want) return bad('host_result_not_in_plan');
    if (e.string !== want.text) return bad('host_string_mismatch');
    const key = hostKey(e.hat, e.lens, e.q_hash);
    if (index.has(key)) return bad('schema_invalid:searches');
    index.set(key, e);
  }
  return { ok: true, index };
}

/** One operation of a provider, as the pack keeps it. Reads the driver record only; copies no query text. */
function providerRecord(p) {
  const op = isPlain(p && p.operation) ? p.operation : null;
  let state = op && typeof op.state === 'string' ? op.state : null;
  if (!state) {
    if (p && p.status === 'ok') state = 'executed_with_results';
    else if (p && p.status === 'empty') state = 'executed_empty';
    else if (p && p.status === 'refused') state = 'refused_before_fetch';
    else state = 'not_executed';
  }
  const reasonRaw = op && typeof op.reason === 'string' ? op.reason : (p && typeof p.reason === 'string' ? p.reason : null);
  const executed = state === 'executed_with_results' || state === 'executed_empty';
  const itemsRaw = op && Number.isInteger(op.result_count) ? op.result_count : (p && isPlain(p.counts) && Number.isInteger(p.counts.items) ? p.counts.items : 0);
  return {
    provider: p && typeof p.provider === 'string' ? p.provider.slice(0, 40) : 'unknown',
    lens: p && typeof p.lens === 'string' ? p.lens.slice(0, 40) : 'unknown',
    operation_state: state,
    reason: executed ? null : (reasonRaw ? reasonRaw.slice(0, 80) : null),
    items: itemsRaw,
    cache_hit: (op && op.cache_hit === true) || (p && p.reason === 'cache_hit'),
  };
}

/**
 * The state of one string, from the stored record and never from the reading (DESIGN 4.4). Pure.
 * record: {handle_changed, thrown, ok, reason, providers: [providerRecord], findings, wire_attempts: [{finding, result}], db_present}.
 * @returns {{state: string, partial: boolean, reason: string|null, failed_providers: Array<{provider: string, reason: string}>}}
 */
function stringState(record) {
  const r = isPlain(record) ? record : {};
  const provs = Array.isArray(r.providers) ? r.providers.filter(isPlain) : [];
  const executed = (p) => p.operation_state === 'executed_with_results' || p.operation_state === 'executed_empty';
  const notRan = provs.filter(p => !executed(p));
  const failedProviders = notRan.map(p => ({ provider: String(p.provider), reason: typeof p.reason === 'string' && p.reason ? p.reason : 'provider_unavailable' }));
  const attempts = Array.isArray(r.wire_attempts) ? r.wire_attempts : [];
  const wired = attempts.filter(a => isPlain(a) && isPlain(a.result) && a.result.ok === true && typeof a.result.node_id === 'string').length;
  const make = (state, reason, partial) => ({ state, partial: partial === true, reason: reason || null, failed_providers: failedProviders });
  if (r.handle_changed === true) return make('failed:handle_changed', 'handle_changed');
  if (r.thrown === true) return make('failed:thrown', 'thrown');
  if (r.ok !== true) {
    if (r.ok === false) {
      const why = r.reason === 'empty_lens_set' || r.reason === 'invalid_opts' ? r.reason : safeKeyName(r.reason);
      return make('failed:' + why, why);
    }
    return make('failed:thrown', 'thrown');
  }
  const withResults = provs.filter(p => p.operation_state === 'executed_with_results');
  const empties = provs.filter(p => p.operation_state === 'executed_empty');
  const partial = notRan.length > 0;
  if (wired > 0) return make('ran_with_results', null, partial);
  if (withResults.length === 0 && empties.length === 0) {
    const pf = notRan.find(p => typeof p.reason === 'string' && p.reason.indexOf('provider_failed:') === 0);
    if (pf) return make('failed:' + pf.reason, pf.reason);
    return make('failed:provider_unavailable', 'provider_unavailable');
  }
  if (withResults.length === 0) return make('ran_empty', null, partial);
  if (r.db_present !== true) return make('fetched_not_wired:no_db', 'no_db', partial);
  if (attempts.length > 0) return make('fetched_not_wired:wire_failed', 'wire_failed', partial);
  if (!Number.isInteger(r.findings) || r.findings === 0) return make('fetched_not_wired:filtered', 'filtered', partial);
  return make('fetched_not_wired:wire_failed', 'wire_failed', partial);
}

/**
 * The state of one researching hat from its string results and the card decision (DESIGN 4.4). Pure.
 * decision: approve (strings are fetched), refuse, defer, or none (the file does not name the hat).
 * A hat is ran_empty only when every string is ran_empty and no provider failed: a failed provider never reads as
 * "searched, found nothing".
 * @returns {{state: string, reason: string|null}}
 */
function hatResearchState(strings, decision) {
  if (decision === 'refuse') return { state: 'declined', reason: null };
  if (decision === 'defer') return { state: 'declined', reason: 'deferred' };
  if (decision === 'none') return { state: 'declined', reason: 'no_answer' };
  const list = Array.isArray(strings) ? strings.filter(isPlain) : [];
  const is = (s, name) => typeof s.state === 'string' && (s.state === name || s.state.indexOf(name + ':') === 0);
  if (list.some(s => is(s, 'ran_with_results'))) return { state: 'ran_with_results', reason: null };
  const notWired = list.find(s => is(s, 'fetched_not_wired'));
  if (notWired) return { state: 'fetched_not_wired', reason: notWired.state.slice('fetched_not_wired:'.length) };
  if (list.length > 0 && list.every(s => s.state === 'ran_empty')) {
    const part = list.find(s => s.partial === true);
    if (!part) return { state: 'ran_empty', reason: null };
    const why = Array.isArray(part.failed_providers) && part.failed_providers.length > 0 ? part.failed_providers[0].reason : 'provider_unavailable';
    return { state: 'failed', reason: why };
  }
  const failedString = list.find(s => is(s, 'failed'));
  if (failedString) return { state: 'failed', reason: failedString.state.slice('failed:'.length) };
  return { state: 'failed', reason: 'no_strings' };
}

function newStringRecord(s, dbPresent) {
  return {
    text: s.text,
    q_hash: s.q_hash,
    db_present: dbPresent,
    handle_changed: false,
    thrown: false,
    ok: null,
    reason: null,
    providers: [],
    research_mode: null,
    findings: 0,
    wire_attempts: [],
    recovery_action: null,
    substitute_calls: 0,
    // Phase 400.2-19: url -> DOI of the findings that the provider gave (the wirer call carries no DOI). Used for the
    // pack only, so that the overlap measure can match one paper found through two providers.
    dois: Object.create(null),
    // Phase 400.2-19: one entry for each host search of the string: {lens, state, reason, items, refused}.
    host: [],
  };
}

/**
 * One wire call of a finding, with the target fixed to the section of the personas, and the attempt kept on the string
 * record. DESIGN 4.4: a finding informs the section of the personas, never a section named after the search string. The
 * research leg of Bono files each finding under its string; the wrapper fixes the target before the write.
 */
function wireAndRecord(record, wireFn, dbArg, p) {
  let res = null;
  const decision = Object.assign({}, isPlain(p && p.decision) ? p.decision : {}, { target_section: PERSONA_TARGET_SECTION, target_kind: 'local' });
  const params = Object.assign({}, p, { decision });
  try { res = wireFn(dbArg, params); } catch (e) { res = null; }
  const f = isPlain(p && p.finding) ? p.finding : {};
  record.wire_attempts.push({
    finding: { title: f.title, url: f.url, source: f.source, evidence_tier: f.evidence_tier, summary: f.summary, retrieved_at: f.retrieved_at },
    result: { ok: !!(res && res.ok === true), node_id: res && typeof res.node_id === 'string' ? res.node_id : null, reason: res && typeof res.reason === 'string' ? res.reason : null },
  });
  return res;
}

/**
 * Fetch the approved strings of one hat through the Bono research leg, unchanged, wrapped. The wrapper holds a side
 * map (one record for each string) because the leg loses the per-provider result and marks every finding confirming.
 * No Brain function and no Brain lens reach the leg; the room-corpus substitute of the recovery path returns nothing.
 * @returns {Promise<Array<{q_hash: string, text: string, record: Object, result: Object}>>}
 */
async function fetchHatStrings(hat, rec, strings, roomResolved, db, deps, hostIndex) {
  const d = deps || {};
  const cellFanout = require(path.join(REPO_ROOT, 'lib', 'core', 'bono', 'cell-fanout.cjs'));
  const personaResearch = require(path.join(REPO_ROOT, 'lib', 'core', 'bono', 'persona-research.cjs'));
  const driver = require(path.join(REPO_ROOT, 'lib', 'lens-engine', 'source-lens-driver.cjs'));
  const wirer = require(path.join(REPO_ROOT, 'lib', 'core', 'findings-wirer.cjs'));
  const extractor = require(path.join(REPO_ROOT, 'lib', 'core', 'research-context-extractor.cjs'));
  const dispatchFn = typeof d.personaDispatchCell === 'function' ? d.personaDispatchCell : personaResearch.personaDispatchCell;
  const runLens = typeof d.runSourceLens === 'function' ? d.runSourceLens : driver.runSourceLens;
  const wireFn = typeof d.wireAccept === 'function' ? d.wireAccept : wirer.wireAccept;
  const extractFn = typeof d.extractContext === 'function' ? d.extractContext : extractor.extractContext;
  const frozen = (Array.isArray(rec.lens_set) ? rec.lens_set : []).map(e => ({ lens: e.lens, weight: e.weight }));
  const records = new Map();
  for (const s of strings) records.set(s.text, newStringRecord(s, db !== null && db !== undefined));

  const dispatchCell = async (cell) => {
    const record = records.get(cell.subdomain);
    const stub = { subdomain: cell.subdomain, hat: cell.hat, stance: 'neutral', evidence: [], confidence: 0, wired_sources: [], degraded: true, degraded_reasons: ['not_fetched'] };
    if (!record) return stub;
    if (cell.handle !== record.text) {
      record.handle_changed = true;
      return stub;
    }
    const sessionId = 'persona-' + hat + '-' + String(record.q_hash).replace(/^sha256:/, '').slice(0, 12);
    const ctx = {
      db: db || null,
      roomDir: roomResolved,
      sessionId,
      extractContextFn: (o) => {
        let base = null;
        try { base = extractFn(o); } catch (e) { base = null; }
        // Relevance scoring stays local; the lens set is the frozen set of the plan, never the room-derived set.
        return Object.assign({ ok: true, preflight: null }, isPlain(base) ? base : {}, { lens_set: frozen.map(e => ({ lens: e.lens, weight: e.weight })) });
      },
      runSourceLensFn: async (o) => {
        const call = Object.assign({}, o, {
          _substituteFn: async () => {
            record.substitute_calls += 1;
            return null;
          },
        });
        if (typeof d._fetchCorpusEnvelope === 'function') call._fetchCorpusEnvelope = d._fetchCorpusEnvelope;
        if (typeof d._sleep === 'function') call._sleep = d._sleep;
        let result;
        try {
          result = await runLens(call);
        } catch (e) {
          record.thrown = true;
          throw e;
        }
        if (isPlain(result)) {
          record.ok = result.ok === true;
          if (result.ok !== true) record.reason = typeof result.reason === 'string' ? result.reason : 'unknown';
          record.providers = Array.isArray(result.providers) ? result.providers.map(providerRecord) : [];
          record.research_mode = typeof result.research_mode === 'string' ? result.research_mode.slice(0, 60) : null;
          record.findings = Array.isArray(result.findings) ? result.findings.length : 0;
          for (const f of (Array.isArray(result.findings) ? result.findings : [])) {
            if (isPlain(f) && typeof f.url === 'string' && typeof f.doi === 'string' && f.doi.length > 0) record.dois[f.url] = f.doi.slice(0, PACK_DOI_MAX);
          }
          record.recovery_action = isPlain(result.recovery) && typeof result.recovery.action === 'string' ? result.recovery.action.slice(0, 40) : null;
        }
        return result;
      },
      wireAcceptFn: (dbArg, p) => wireAndRecord(record, wireFn, dbArg, p),
    };
    return dispatchFn({ subdomain: cell.subdomain, hat, handle: cell.handle }, ctx);
  };

  const hostLenses = Array.isArray(rec.host_lenses) ? rec.host_lenses : [];
  if (frozen.length === 0 && hostLenses.length > 0) {
    // A hat whose only providers are host searches: the door has no lens to run, and nothing failed.
    for (const s of strings) records.get(s.text).ok = true;
  } else {
    await cellFanout.runCellFanout({
      subdomains: strings.map(s => s.text),
      hats: [hat],
      dispatchCell,
      selfCritique: (reading) => ({ keep: true, cell: reading }),
    });
  }
  // Phase 400.2-19: the host web search results, for the strings that the door fetched. A host search with no entry in
  // the results file did not run (provider_unavailable:host_web); an entry with no result ran and found nothing.
  for (const s of strings) {
    const record = records.get(s.text);
    record.host = [];
    if (hostLenses.length === 0 || record.handle_changed || record.thrown || record.ok !== true) continue;
    const sessionId = 'persona-' + hat + '-' + String(record.q_hash).replace(/^sha256:/, '').slice(0, 12);
    for (const lens of hostLenses) {
      const entry = hostIndex instanceof Map ? hostIndex.get(hostKey(hat, lens, record.q_hash)) : undefined;
      if (!entry) {
        record.providers.push({ provider: HOST_WEB_PROVIDER, lens, operation_state: 'not_executed', reason: 'provider_unavailable:host_web', items: 0, cache_hit: false });
        record.host.push({ lens, state: 'not_executed', reason: 'provider_unavailable:host_web', items: 0, refused: 0 });
        continue;
      }
      const strip = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'evidence-claim.cjs')).stripInjectionSpans;
      const tiers = driver._internal.SOURCE_TO_TIER;
      const lensToSource = driver._internal.LENS_TO_SOURCE;
      const domainLenses = driver._internal.DOMAIN_LENSES || {};
      const tier = tiers[domainLenses[lens] ? domainLenses[lens].label : lensToSource[lens]] || 'None';
      const seenUrls = new Set();
      const kept = [];
      let refused = 0;
      for (const raw of entry.results) {
        if (!driver.domainLensAccepts(lens, raw.url)) { refused += 1; continue; }
        // IN-11: a host URL keeps its origin and path only. The query and the fragment can carry up to 500 characters
        // of text that every hat would read in the White package.
        const url = hostResultUrl(raw.url);
        if (url === null) { refused += 1; continue; }
        if (seenUrls.has(url)) continue;
        seenUrls.add(url);
        kept.push(Object.assign({}, raw, { url }));
      }
      for (const r of kept) {
        record.findings += 1;
        if (!db) continue;
        wireAndRecord(record, wireFn, db, {
          finding: { title: strip(r.title).slice(0, PACK_TITLE_MAX), source: HOST_WEB_PROVIDER, url: r.url, retrieved_at: nowOf(d).toISOString(), evidence_tier: tier, summary: strip(r.snippet).slice(0, PACK_SUMMARY_MAX) },
          decision: { target_section: PERSONA_TARGET_SECTION, target_kind: 'local' },
          roomDir: roomResolved,
          sessionId,
          topic: record.text,
        });
      }
      // WR-05: when every result is off the site, the host ignored the site limit and the approved search did not run
      // as approved. That is a failed provider, never an honest empty answer.
      const offSite = kept.length === 0 && refused > 0;
      const state = kept.length > 0 ? 'executed_with_results' : (offSite ? 'not_executed' : 'executed_empty');
      const reason = offSite ? 'provider_failed:host_off_site' : null;
      record.providers.push({ provider: HOST_WEB_PROVIDER, lens, operation_state: state, reason, items: kept.length, cache_hit: false });
      record.host.push({ lens, state, reason, items: kept.length, refused });
    }
  }
  return strings.map(s => ({ q_hash: s.q_hash, text: s.text, record: records.get(s.text), result: stringState(records.get(s.text)) }));
}

/** IN-11: the origin and the path of a host result URL, or null when it is not an http or https URL. */
function hostResultUrl(u) {
  let parsed;
  try { parsed = new URL(String(u)); } catch (e) { return null; }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  return (parsed.origin + parsed.pathname).slice(0, PACK_URL_MAX);
}

/** The wired findings of the string results, as pack items: title, URL, tier, provider, summary. No verdict field. */
function packItems(fetched) {
  const strip = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'evidence-claim.cjs')).stripInjectionSpans;
  const items = [];
  const seen = new Set();
  for (const s of fetched) {
    for (const a of s.record.wire_attempts) {
      if (!a.result.ok || typeof a.result.node_id !== 'string' || seen.has(a.result.node_id)) continue;
      seen.add(a.result.node_id);
      const f = a.finding;
      items.push({
        id: a.result.node_id,
        title: strip(typeof f.title === 'string' ? f.title : '').slice(0, PACK_TITLE_MAX),
        url: typeof f.url === 'string' ? f.url.slice(0, PACK_URL_MAX) : '',
        tier: typeof f.evidence_tier === 'string' ? f.evidence_tier : 'None',
        provider: typeof f.source === 'string' ? f.source : 'unknown',
        summary: strip(typeof f.summary === 'string' ? f.summary : '').slice(0, PACK_SUMMARY_MAX),
        retrieved_at: typeof f.retrieved_at === 'string' ? f.retrieved_at : '',
        q_hash: s.q_hash,
      });
      const doi = typeof f.url === 'string' && s.record.dois ? s.record.dois[f.url] : undefined;
      if (typeof doi === 'string' && doi.length > 0) items[items.length - 1].doi = doi;
      if (items.length >= PACK_ITEM_MAX) return items;
    }
  }
  return items;
}

function buildEvidencePack(runId, hat, state, reason, fetched) {
  const list = Array.isArray(fetched) ? fetched : [];
  const pack = {
    schema: EVIDENCE_SCHEMA,
    run_id: runId,
    hat,
    research_state: state,
    strings: list.map(s => ({ text: s.text, q_hash: s.q_hash, state: s.result.state, partial: s.result.partial, providers: s.record.providers.map(p => Object.assign({}, p)) })),
    items: packItems(list),
  };
  if (reason) pack.reason = reason;
  return pack;
}

/**
 * Step run_research (plan 12). Reads the ledger, the plan (its hash must equal ledger.plan_sha256) and the approved
 * file (S-4); refuses the whole call when the file does not fit the plan; then fetches only the approved strings,
 * White first, from exactly the providers the card showed. Writes the evidence packs, copies the White package into
 * the five reading directories, seals the packs in the ledger and marks the step done. Sends nothing to the Brain.
 * @param {{roomDir: string, runId: string, approvedPath: string}} args
 * @param {Object} [deps] - homeDir, tmpDir, now; test seams: _fetchCorpusEnvelope, _sleep, preflightLenses,
 *   personaDispatchCell, runSourceLens, wireAccept, extractContext
 * @returns {Promise<Object>}
 */
async function cmdRunResearch(args, deps) {
  const roomResolved = roomDirCheck(args && args.roomDir);
  if (!roomResolved) return { ok: false, reason: 'room_not_found' };
  const lr = readLedger(roomResolved, args.runId);
  if (!lr.ok) return lr;
  const ledger = lr.ledger;
  const order = requireStep(ledger, 'plan_research');
  if (order) return { ok: false, reason: order };
  if (ledger.mode !== 'deep') return { ok: false, reason: 'mode_not_deep' };
  if (ledger.steps.run_research) return { ok: false, reason: 'step_already_done:run_research' };
  const map = readRunMap(homeDirOf(deps), ledger.run_id, roomResolved);
  if (!map) return { ok: false, reason: 'run_map_missing' };
  for (const hat of HATS) {
    if (!hatDirOf(map, hat)) return { ok: false, reason: 'run_map_missing' };
  }

  // The plan must be the plan that the cards showed: the hash in the ledger is the only anchor.
  const pr = readJsonFile(path.join(map.scratch_root, 'plan.json'), { noSymlink: true });
  if (!pr.ok) return { ok: false, reason: 'plan_missing' };
  if (pr.sha256 !== ledger.plan_sha256) return { ok: false, reason: 'plan_changed' };
  const plan = pr.value;
  if (!isPlain(plan) || plan.schema !== PLAN_SCHEMA || plan.run_id !== ledger.run_id || !Number.isInteger(plan.plan_seq) || !isPlain(plan.hats)) return { ok: false, reason: 'plan_changed' };

  if (typeof args.approvedPath !== 'string' || args.approvedPath.length === 0) return { ok: false, reason: 'approved_file_missing' };
  const ar = readJsonFile(args.approvedPath);
  if (!ar.ok) return { ok: false, reason: ar.reason === 'file_unreadable' ? 'approved_file_missing' : ar.reason };
  const valid = validateApproved(plan, ar.value);
  if (!valid.ok) return valid;
  const approved = ar.value;

  // Phase 400.2-19: the results of the host web search, when the command passes a file. No file: every host search is
  // not run. A file that does not fit the plan and the approved file refuses the whole call before any fetch.
  let hostIndex = new Map();
  if (args.hostResultsPath !== undefined && args.hostResultsPath !== null) {
    if (typeof args.hostResultsPath !== 'string' || args.hostResultsPath.length === 0) return { ok: false, reason: 'host_results_file_missing' };
    const hr = readJsonFile(args.hostResultsPath);
    if (!hr.ok) return { ok: false, reason: hr.reason === 'file_unreadable' ? 'host_results_file_missing' : hr.reason };
    const hv = validateHostResults(plan, approved, hr.value);
    if (!hv.ok) return hv;
    hostIndex = hv.index;
  }

  // Decisions that need no fetch, then the queue of approved hats.
  const results = {};
  const queue = [];
  let approvedCount = 0;
  let plannedCount = 0;
  for (const hat of RESEARCH_HATS) {
    const rec = plan.hats[hat];
    if (!isPlain(rec) || rec.state !== 'planned') {
      results[hat] = { state: isPlain(rec) && typeof rec.state === 'string' ? rec.state : 'not_planned:no_valid_handle', reason: null, fetched: [] };
      continue;
    }
    plannedCount += (Array.isArray(rec.strings) ? rec.strings.length : 0) + (naturePlanned(rec) ? 1 : 0);
    const entry = approved.hats[hat];
    if (!entry) { results[hat] = Object.assign(hatResearchState([], 'none'), { fetched: [] }); continue; }
    if (entry.decision === 'refuse' || entry.decision === 'defer') { results[hat] = Object.assign(hatResearchState([], entry.decision), { fetched: [] }); continue; }
    approvedCount += entry.q_hashes.length;
    const lp = lensPlanOf(hat, roomResolved, deps);
    const wantLenses = (Array.isArray(rec.lens_set) ? rec.lens_set : []).map(e => e && e.lens);
    const sameSet = lp.lens_set.length === wantLenses.length && lp.lens_set.every((e, i) => e.lens === wantLenses[i])
      && lp.providers.length === rec.providers.length && lp.providers.every((p, i) => p === rec.providers[i])
      && lp.host_lenses.length === (Array.isArray(rec.host_lenses) ? rec.host_lenses : []).length
      && lp.host_lenses.every((l, i) => l === rec.host_lenses[i]);
    if (!sameSet) { results[hat] = { state: 'failed', reason: 'provider_set_changed', fetched: [] }; continue; }
    const nat = naturePlanned(rec);
    queue.push({ hat, rec, strings: rec.strings.filter(s => entry.q_hashes.includes(s.q_hash)), nature: nat && entry.q_hashes.includes(nat.q_hash) ? { text: nat.text, q_hash: nat.q_hash } : null });
  }

  // Fetch: White first, then black, yellow, green. One hat at a time; the two strings of a hat run together.
  if (queue.length > 0) {
    let db = null;
    let navigation = null;
    try {
      navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
      db = navigation.openRoomDbForCaller(roomResolved) || null;
    } catch (e) {
      db = null;
    }
    try {
      for (const hat of FETCH_ORDER) {
        const job = queue.find(q => q.hat === hat);
        if (!job) continue;
        try {
          // PS-09: the normal strings run every lens but nature; the nature string of Green runs the nature lens only.
          const lensSet = Array.isArray(job.rec.lens_set) ? job.rec.lens_set : [];
          const hostLenses = Array.isArray(job.rec.host_lenses) ? job.rec.host_lenses : [];
          const normalRec = Object.assign({}, job.rec, { lens_set: lensSet.filter(e => !(isPlain(e) && e.lens === NATURE_LENS)), host_lenses: hostLenses.filter(l => l !== NATURE_LENS) });
          let fetched = job.strings.length > 0 ? await fetchHatStrings(hat, normalRec, job.strings, roomResolved, db, deps, hostIndex) : [];
          if (job.nature) {
            const natureRec = Object.assign({}, job.rec, { lens_set: lensSet.filter(e => isPlain(e) && e.lens === NATURE_LENS), host_lenses: hostLenses.filter(l => l === NATURE_LENS) });
            const nf = await fetchHatStrings(hat, natureRec, [job.nature], roomResolved, db, deps, hostIndex);
            for (const f of nf) f.nature = true;
            fetched = fetched.concat(nf);
          }
          results[hat] = Object.assign(hatResearchState(fetched.map(f => Object.assign({ state: f.result.state, partial: f.result.partial, failed_providers: f.result.failed_providers }, {})), 'approve'), { fetched });
        } catch (e) {
          results[hat] = { state: 'failed', reason: 'thrown', fetched: [] };
        }
      }
    } finally {
      try { if (navigation && db) navigation.closeRoomDbForCaller(db); } catch (e) { /* closed by the caller of the process */ }
    }
  }

  // Packs: one for each researching hat, then the copies of the White package. Not-planned hats get zero-item packs.
  const now = nowOf(deps);
  const packs = {};
  for (const hat of RESEARCH_HATS) packs[hat] = buildEvidencePack(ledger.run_id, hat, results[hat].state, results[hat].reason, results[hat].fetched);
  try {
    for (const hat of RESEARCH_HATS) atomicWriteJson(path.join(hatDirOf(map, hat), 'evidence.json'), packs[hat]);
    for (const hat of READ_HATS) atomicWriteJson(path.join(hatDirOf(map, hat), 'shared-white.json'), packs.white);
  } catch (e) {
    return { ok: false, reason: 'write_failed:' + (e && e.code ? e.code : 'error') };
  }

  for (const hat of RESEARCH_HATS) {
    ledger.hats[hat].research = results[hat].state;
    if (results[hat].reason) ledger.hats[hat].research_reason = results[hat].reason;
    else delete ledger.hats[hat].research_reason;
  }
  // PS-09: the state of the nature lens of Green, named on its own: not planned with a reason, not approved, declined,
  // or the state of the nature string. Never an empty answer for a search that was not sent.
  const natureState = (() => {
    const rec = plan.hats[NATURE_HAT];
    if (!isPlain(rec) || rec.state !== 'planned') return isPlain(rec) && typeof rec.state === 'string' ? rec.state : 'not_planned:no_valid_handle';
    if (!isPlain(rec.nature)) return 'not_planned:no_available_provider';
    if (rec.nature.state !== 'planned') return String(rec.nature.state);
    const entry = approved.hats[NATURE_HAT];
    if (!entry || entry.decision !== 'approve') return 'declined';
    if (!entry.q_hashes.includes(rec.nature.q_hash)) return 'not_approved';
    const f = (results[NATURE_HAT].fetched || []).find(x => x.nature === true);
    return f ? f.result.state : (results[NATURE_HAT].state === 'failed' ? 'failed:' + (results[NATURE_HAT].reason || 'unknown') : 'not_executed');
  })();
  ledger.hats[NATURE_HAT].nature_research = natureState;
  const before = isPlain(ledger.research) && Number.isInteger(ledger.research.strings_refused) ? ledger.research.strings_refused : 0;
  ledger.research = { strings_approved: approvedCount, strings_refused: before + (plannedCount - approvedCount) };
  const sealed = sealPacks(ledger, map);
  if (!sealed.ok) return sealed;
  markStep(ledger, 'run_research', 'done', now);
  try {
    writeRunMap(homeDirOf(deps), map);
    writeLedger(lr.dir, ledger);
  } catch (e) {
    return { ok: false, reason: 'write_failed:' + (e && e.code ? e.code : 'error') };
  }

  const hats = {};
  const reasons = {};
  const stringsOut = {};
  const itemsOut = {};
  for (const hat of HATS) {
    if (!RESEARCH_HATS.includes(hat)) { hats[hat] = 'never_searches'; continue; }
    hats[hat] = results[hat].state;
    reasons[hat] = results[hat].reason || null;
    itemsOut[hat] = packs[hat].items.length;
    stringsOut[hat] = results[hat].fetched.map(f => Object.assign({
      q_hash: f.q_hash,
      state: f.result.state,
      partial: f.result.partial,
      research_mode: f.record.research_mode,
      findings: f.record.findings,
      wired: f.record.wire_attempts.filter(a => a.result.ok).length,
      substitute_calls: f.record.substitute_calls,
      recovery_action: f.record.recovery_action,
      host: f.record.host.map(h => Object.assign({}, h)),
    }, f.nature === true ? { nature: true } : {}));
  }
  return {
    ok: true,
    run_id: ledger.run_id,
    plan_seq: plan.plan_seq,
    hats,
    reasons,
    strings: stringsOut,
    nature: natureState,
    evidence_items: itemsOut,
    counts: { strings_approved: ledger.research.strings_approved, strings_refused: ledger.research.strings_refused },
  };
}

// ---------------------------------------------------------------------------
// compare (plan 16): one merged deep run and one merged quick run of one brief, side by side
// ---------------------------------------------------------------------------

// Every fixed label of compare.md. The file holds these labels and fields of the two run records, and nothing else.
// There is no score, no winner and no count of differences: the navigator reads the two columns and decides.
const COMPARE_LABELS = Object.freeze({
  title: '# Compare: deep run and quick run of one brief',
  deep_run: 'deep run: ',
  quick_run: 'quick run: ',
  question: 'governing question: ',
  section_positions: '## Positions',
  heading: '### ',
  table_head: '| hat | deep value | deep line | quick value | quick line |',
  table_rule: '| --- | --- | --- | --- | --- |',
  not_run: 'not run',
  not_applicable: 'not applicable',
  none: 'none',
  section_deep: '## Deep run',
  section_quick: '## Quick run',
  run_id: 'run id: ',
  hats_ran: 'hats that ran: ',
  evidence_items: 'door evidence items: ',
  found_sources: 'self-found sources: ',
  agent_runs: 'agent runs: ',
  stops: 'stops: ',
  cards: 'cards: ',
  reported: ' (reported by the command)',
  not_reported: 'not reported',
  wall_time: 'wall time: ',
  seconds: ' seconds',
  navigator_note: 'Navigator note:',
});

function compareCell(text) {
  const t = oneLine(text).replace(/\|/g, '/');
  return t === '' ? COMPARE_LABELS.none : t;
}

/** The position cell pair of one hat in one record: [value, line]. */
function comparePositionCells(record, sqId, hat) {
  const L = COMPARE_LABELS;
  const ran = Boolean(record.hats && record.hats[hat] && record.hats[hat].reading === 'ran');
  if (!ran) return [L.not_run, L.not_run];
  const p = isPlain(record.positions) && isPlain(record.positions[sqId]) ? record.positions[sqId][hat] : null;
  if (!isPlain(p)) return [L.not_applicable, L.none];
  return [compareCell(p.value), compareCell(typeof p.line === 'string' ? p.line : '')];
}

function compareBlock(record) {
  const L = COMPARE_LABELS;
  const hats = isPlain(record.hats) ? record.hats : {};
  const ran = HATS.filter(hat => hats[hat] && hats[hat].reading === 'ran');
  const sum = (obj) => (isPlain(obj) ? Object.values(obj).reduce((a, v) => a + (Number.isInteger(v) ? v : 0), 0) : 0);
  const found = HATS.reduce((a, hat) => a + (hats[hat] && Number.isInteger(hats[hat].self_found_sources) ? hats[hat].self_found_sources : 0), 0);
  const audit = isPlain(record.audit) ? record.audit : {};
  const reported = audit.reported_by === 'command';
  const count = (v) => (reported && Number.isInteger(v) ? String(v) + L.reported : L.not_reported);
  const ms = new Date(record.timestamps && record.timestamps.merged_at).getTime() - new Date(record.timestamps && record.timestamps.started_at).getTime();
  return [
    L.run_id + record.run_id,
    L.hats_ran + (ran.length ? ran.join(', ') : L.none),
    L.evidence_items + sum(record.sources),
    L.found_sources + found,
    L.agent_runs + count(audit.agent_runs),
    L.stops + count(audit.stops),
    L.cards + count(audit.cards),
    L.wall_time + (Number.isFinite(ms) ? String(ms / 1000) : L.not_reported) + (Number.isFinite(ms) ? L.seconds : ''),
  ];
}

/** Build the text of compare.md from two final run records. Pure. */
function buildCompare(deep, quick) {
  const L = COMPARE_LABELS;
  const out = [L.title, L.deep_run + deep.run_id, L.quick_run + quick.run_id, L.question + oneLine(deep.brief && deep.brief.governing_question), '', L.section_positions];
  const quickIdOf = {};
  for (const sq of quick.sub_questions) quickIdOf[normalSubQuestion(sq.text)] = sq.id;
  for (const sq of deep.sub_questions) {
    const qId = Object.prototype.hasOwnProperty.call(quickIdOf, normalSubQuestion(sq.text)) ? quickIdOf[normalSubQuestion(sq.text)] : sq.id;
    out.push(L.heading + oneLine(sq.text), L.table_head, L.table_rule);
    for (const hat of HATS) {
      const d = comparePositionCells(deep, sq.id, hat);
      const q = comparePositionCells(quick, qId, hat);
      out.push('| ' + [hat, d[0], d[1], q[0], q[1]].join(' | ') + ' |');
    }
    out.push('');
  }
  out.push(L.section_deep, ...compareBlock(deep), '', L.section_quick, ...compareBlock(quick), '', L.navigator_note);
  return out.join('\n') + '\n';
}

/**
 * Step compare. It reads the final run records of one merged deep run and one merged quick run of the same brief and
 * writes compare.md in the folder of the deep run (a temporary file and a rename). It writes nothing else, changes no
 * run record and draws no conclusion: no score, no winner, no count of differences.
 * @param {{roomDir: string, deepRunId: string, quickRunId: string}} args
 */
function cmdCompare(args, deps) {
  const roomResolved = roomDirCheck(args && args.roomDir);
  if (!roomResolved) return { ok: false, reason: 'room_not_found' };
  const d = readLedger(roomResolved, args.deepRunId);
  if (!d.ok) return d;
  const q = readLedger(roomResolved, args.quickRunId);
  if (!q.ok) return q;
  if (d.ledger.mode !== 'deep' || q.ledger.mode !== 'quick') return { ok: false, reason: 'modes_not_deep_and_quick' };
  for (const r of [d, q]) {
    if (!r.ledger.steps.merge || r.ledger.steps.merge.state !== 'done') return { ok: false, reason: 'not_merged:' + r.ledger.run_id };
  }
  if (d.ledger.brief_hash !== q.ledger.brief_hash) return { ok: false, reason: 'brief_hash_differs' };
  const file = path.join(d.dir, 'compare.md');
  try {
    atomicWriteText(file, buildCompare(d.ledger, q.ledger));
  } catch (e) {
    return { ok: false, reason: 'write_failed:' + (e && e.code ? e.code : 'error') };
  }
  return { ok: true, deep_run_id: d.ledger.run_id, quick_run_id: q.ledger.run_id, file };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

function main(argv, deps) {
  const args = Array.isArray(argv) ? argv : [];
  const sub = args[0];
  if (SUBCOMMANDS.indexOf(sub) === -1) {
    process.stderr.write(USAGE + '\n');
    process.exitCode = 2;
    return undefined;
  }
  const { flags } = parseFlags(args.slice(1));
  const noValue = Object.keys(flags).filter(k => flags[k] === true);
  if (noValue.length) {
    process.stderr.write(USAGE + '\nmissing value: ' + noValue.map(k => '--' + safeKeyName(k)).join(', ') + '\n');
    process.exitCode = 2;
    return undefined;
  }
  const need = (names) => names.filter(n => typeof flags[n] !== 'string' || flags[n].length === 0);
  let missing = [];
  let result;
  // WR-08: an exception inside a subcommand is a refusal (one JSON object, exit 0). Only the error code is printed:
  // a message or a stack trace can hold the room path and the review folder name (room text).
  const internal = (e) => ({ ok: false, reason: 'internal_error:' + safeKeyName(e && e.code ? e.code : 'error') });
  try {
    switch (sub) {
      case 'status':
        missing = need(['room']);
        if (!missing.length) result = cmdStatus({ roomDir: flags.room }, deps);
        break;
      case 'start':
        missing = need(['room', 'brief']);
        if (!missing.length) result = cmdStart({ roomDir: flags.room, briefPath: flags.brief, mode: flags.mode }, deps);
        break;
      case 'write-persona':
        missing = need(['room', 'run']);
        if (!missing.length) result = cmdWritePersona({ roomDir: flags.room, runId: flags.run }, deps);
        break;
      case 'accept-persona':
        missing = need(['room', 'run', 'answer']);
        if (!missing.length) result = cmdAcceptPersona({ roomDir: flags.room, runId: flags.run, answerPath: flags.answer }, deps);
        break;
      case 'plan-research':
        missing = need(['room', 'run']);
        if (!missing.length) result = cmdPlanResearch({ roomDir: flags.room, runId: flags.run, editedPath: typeof flags.edited === 'string' && flags.edited.length ? flags.edited : undefined }, deps);
        break;
      case 'run-research':
        missing = need(['room', 'run', 'approved']);
        if (!missing.length) result = cmdRunResearch({ roomDir: flags.room, runId: flags.run, approvedPath: flags.approved, hostResultsPath: typeof flags['host-results'] === 'string' && flags['host-results'].length ? flags['host-results'] : undefined }, deps);
        break;
      case 'check':
        missing = need(['room', 'run']);
        if (!missing.length) result = cmdCheck({ roomDir: flags.room, runId: flags.run }, deps);
        break;
      case 'merge':
        missing = need(['room', 'run']);
        if (!missing.length) result = cmdMerge({ roomDir: flags.room, runId: flags.run, countsPath: typeof flags.counts === 'string' && flags.counts.length ? flags.counts : undefined, quickResultPath: typeof flags['quick-result'] === 'string' && flags['quick-result'].length ? flags['quick-result'] : undefined }, deps);
        break;
      case 'record-ruling':
        missing = need(['room', 'run', 'answer']);
        if (!missing.length) result = cmdRecordRuling({ roomDir: flags.room, runId: flags.run, answerPath: flags.answer }, deps);
        break;
      case 'compare':
        missing = need(['room', 'deep', 'quick']);
        if (!missing.length) result = cmdCompare({ roomDir: flags.room, deepRunId: flags.deep, quickRunId: flags.quick }, deps);
        break;
      default:
        missing = ['subcommand'];
        break;
    }
  } catch (e) {
    result = internal(e);
  }
  if (missing.length) {
    process.stderr.write(USAGE + '\nmissing: ' + missing.join(', ') + '\n');
    process.exitCode = 2;
    return undefined;
  }
  if (result && typeof result.then === 'function') {
    // merge is asynchronous: the lens engine rotate call is a promise.
    // merge and run-research are asynchronous. A rejection is a refusal too (WR-08, IN-04).
    return result.then((r) => r, (e) => internal(e)).then((r) => {
      process.stdout.write(JSON.stringify(r, null, 2) + '\n');
      process.exitCode = 0;
      return r;
    });
  }
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exitCode = 0;
  return result;
}

// ---------------------------------------------------------------------------
// Phase 400.2-17 (PG-02): the frozen cost table of one deep run (R-10), the input for Phase 400.1.
// tests/test-4002-review-lists.cjs (leg V3) derives every number again from the code and fails on drift:
// the stage list from the hitl_stages of commands/persona.md, the subcommand count from SUBCOMMANDS,
// the rebuild limit from REBUILD_LIMIT, the hat counts from HATS, READ_HATS and the lens table of persona-ops,
// the retry budget from the recovery dispatcher. Nothing here is a limit that the code enforces; it is a count.
//   agent_runs: produce 0 to 6 (one run for each hat to build), handles 0 to 4 (researching hats only),
//     readings 5 (white, red, black, yellow, green), blue 1. Steady state (every persona fresh, handles stored)
//     6 to 10. First run 16. Each rebuild asked at Stop 2 adds 1 run, 2 at most for a hat, so 28 is the maximum.
//   stops: the stage ids of hitl_stages. Steady state has no generate-experts stop (3); a first run or a stale
//     persona has it (4). A card edit or a rebuild repeats its own stop; no fifth stop exists.
//   door_calls: the 10 subcommands minus compare (an optional extra, run after a merge). start skips write-persona
//     and accept-persona when no persona is built or waits for acceptance, so steady state needs 2 fewer. A card
//     edit round is 1 call (plan-research --edited). A rebuild round is 2 calls (write-persona, then accept-persona).
//   research: door provider calls are lens runs sent to a provider, one for each lens of the hat and each
//     approved string. Keyless means openalex and arxiv only. The recovery budget adds retries for a failed
//     lens run, except the two domain lenses (asknature, kaggle), which stay out of the recovery dispatcher.
//     host_web_searches are the extra calls of the command (WebSearch in Claude Code) when no Tavily key is set;
//     they are not door calls. The own web tool calls of a reading hat are not bounded by code.
function deepFreezeTable(o) {
  for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreezeTable(v);
  return Object.freeze(o);
}
const DEEP_RUN_BUDGET = deepFreezeTable({
  agent_runs: {
    produce_min: 0,
    produce_max: 6,
    handles_min: 0,
    handles_max: 4,
    readings: 5,
    blue: 1,
    steady_min: 6,
    steady_max: 10,
    first_run: 16,
    max_without_rebuild: 16,
    rebuilds_per_hat_max: 2,
    max_with_rebuilds: 28,
  },
  stops: {
    steady: 3,
    first_run: 4,
    max: 4,
    stages: ['brief-confirm', 'generate-experts', 'search-approve', 'resolve-tension'],
  },
  cards: { search_cards: 4 },
  door_calls: { steady: 7, max: 9, per_card_edit_round: 1, per_rebuild_round: 2 },
  research: {
    strings_per_hat_max: 2,
    provider_calls_keyless_max: 16,
    provider_calls_all_keys_max: 28,
    retries_per_call_max: 2,
    provider_calls_with_retries_max: 76,
    host_web_searches_max: 10,
    host_web_searches_with_tavily_key: 0,
  },
  web_tool_calls_of_reading_hats: 'not bounded by code',
  quick: { agent_runs: 0, stops: 1, door_calls: 3, fetches: 0 },
});

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = {
  SUBCOMMANDS,
  USAGE,
  HATS,
  READ_HATS,
  RESEARCH_HATS,
  REBUILD_LIMIT,
  MAX_HANDLES_PER_HAT,
  MAX_STRINGS_PER_HAT,
  HOST_LABELS,
  DEEP_RUN_BUDGET,
  main,
  parseFlags,
  readJsonFile,
  atomicWriteJson,
  cmdStatus,
  cmdStart,
  cmdWritePersona,
  cmdAcceptPersona,
  cmdPlanResearch,
  cmdRunResearch,
  validateApproved,
  validateHostResults,
  hostSearchText,
  hostSearchesOf,
  HOST_WEB_PROVIDER,
  stringState,
  hatResearchState,
  handlesNeeded,
  readHandlesStore,
  sealPacks,
  sealRunPacks,
  cmdCheck,
  cmdMerge,
  cmdRecordRuling,
  cmdCompare,
  readRulingsStore,
  tensionKey,
  positionMarker,
  buildArtifact,
  deepNoticeLines,
  quickNoticeLines,
  noticeLinesOf,
  validateQuickResult,
  ARTIFACT_LABELS,
  validateReading,
  perHatRules,
  citationCheck,
  screenReportedStrings,
  READING_VALUES,
  validateBrief,
  briefHashOf,
  subQuestionId,
  readLedger,
  writeLedger,
  requireStep,
  markStep,
  findRunDir,
  readRunMap,
  runMapPath,
  sweepScratch,
  IDENTITY_STOP_LIST,
  roomIdentityScreen,
  checkHandle,
  composeString,
};
