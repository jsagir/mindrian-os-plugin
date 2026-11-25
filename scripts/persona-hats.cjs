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
 * only, never as argv text. This script sends nothing to the Brain and makes no fetch.
 * CANON PART 9 (Memory Locality): this script never opens room.db and confirms no
 * truth-claim node. The only writer of persona_status accepted is the function
 * markAccepted, fed by a navigator answer file.
 * CANON PART 11: this file is a door of the persona surface, not a new invocable surface.
 *
 * Subcommands of this plan (later plans add the rest of the cycle):
 *   status --room <dir>
 *   start --room <dir> --brief <file> [--mode deep|quick]
 *   write-persona --room <dir> --run <id>
 *   accept-persona --room <dir> --run <id> --answer <file>
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

const SUBCOMMANDS = Object.freeze(['status', 'start', 'write-persona', 'accept-persona']);
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
      flags[a.slice(2)] = argv[i + 1];
      i += 1;
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
 * @returns {{abs: string, rel: string}|null}
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
  return { abs, rel: rel.split(path.sep).join('/') };
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
    if (!t) return fail('schema_invalid:target');
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
    if (!f || f.rel.split('/')[0] === 'personas') return fail('schema_invalid:reading_list');
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
    target_content_hash: brief.target === 'room' ? fingerprint : sha256Hex(fs.readFileSync(checked.targetAbs)),
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
    for (const hat of HATS) hatsOut[hat] = { persona: freshness.hats[hat].state, dir: hatDirs[hat], discipline: ops.HAT_DISCIPLINE[hat] };
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
      const r = readJsonFile(path.join(dir, 'persona.json'), { noSymlink: true });
      if (!r.ok) {
        reason = r.reason === 'file_unreadable' ? 'no_spec_file' : r.reason;
      } else {
        entry.spec_sha256 = r.sha256;
        const w = ops.writeReasonedPersona(roomResolved, hat, r.value, { fingerprint: ledger.room_fingerprint, now });
        if (w.ok) proposedFile = w.file;
        else reason = w.reason;
      }
    }
    if (reason) {
      entry.persona = 'build_failed';
      entry.persona_reason = reason;
      results[hat] = { state: 'build_failed:' + reason };
    } else {
      entry.persona = 'proposed';
      delete entry.persona_reason;
      results[hat] = { state: 'proposed', file: proposedFile, spec_sha256: entry.spec_sha256 };
    }
  }
  if (!ledger.steps.write_persona) markStep(ledger, 'write_persona', 'done', now);
  writeLedger(lr.dir, ledger);
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
    const f = findProposedFile(roomResolved, hat);
    if (!f) return { ok: false, reason: 'no_proposed_file:' + hat };
    if (f.fingerprint !== ledger.room_fingerprint) return { ok: false, reason: 'persona_file_changed:' + hat };
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
  writeLedger(lr.dir, ledger);
  if (failure) return { ok: false, reason: failure };
  return { ok: true, run_id: ledger.run_id, hats: out, to_rebuild: toRebuild, pending, accept_done: Boolean(ledger.steps.accept_persona) };
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
  const need = (names) => names.filter(n => typeof flags[n] !== 'string' || flags[n].length === 0);
  let missing = [];
  let result;
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
    default:
      missing = ['subcommand'];
      break;
  }
  if (missing.length) {
    process.stderr.write(USAGE + '\nmissing: ' + missing.join(', ') + '\n');
    process.exitCode = 2;
    return undefined;
  }
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exitCode = 0;
  return result;
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = {
  SUBCOMMANDS,
  USAGE,
  HATS,
  main,
  parseFlags,
  readJsonFile,
  atomicWriteJson,
  cmdStatus,
  cmdStart,
  cmdWritePersona,
  cmdAcceptPersona,
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
};
