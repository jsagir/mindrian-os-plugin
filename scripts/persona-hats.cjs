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
 * CANON PART 9 (Memory Locality): this script confirms no truth-claim node. The only
 * writer of persona_status accepted is the function markAccepted, fed by a navigator
 * answer file. The one place that opens room.db is cmdRecordRuling, through the
 * navigation chokepoint, to log one decision_captured event (ids and the ruling value).
 * CANON PART 11: this file is a door of the persona surface, not a new invocable surface.
 *
 * Subcommands of this plan (later plans add the rest of the cycle):
 *   status --room <dir>
 *   start --room <dir> --brief <file> [--mode deep|quick]
 *   write-persona --room <dir> --run <id>
 *   accept-persona --room <dir> --run <id> --answer <file>
 *   plan-research --room <dir> --run <id>      (plan 07: the no-plan branch only)
 *   check --room <dir> --run <id>              (plan 07: schema, per-hat rules, citation boundary, Blue ledger)
 *   merge --room <dir> --run <id> [--counts <file>]  (plan 08, deep mode: positions, tensions, artifact, run record, cleanup)
 *   record-ruling --room <dir> --run <id> --answer <file>  (plan 09: the navigator ruling on a tension; the only writer of the rulings store)
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

const SUBCOMMANDS = Object.freeze(['status', 'start', 'write-persona', 'accept-persona', 'plan-research', 'check', 'merge', 'record-ruling']);
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
 * The citation boundary (FS-5). The allowed set of a hat is its own pack ids and urls, the White ids and
 * urls, and the urls of the reading's own self_found_sources. Any other URL or EvidenceClaim id in any
 * string field gives rejected:citation_outside_sources. Pure. Never echoes the refused text.
 * @returns {{ok: true} | {ok: false, reason: 'citation_outside_sources', state: string, why: string}}
 */
function citationCheck(hat, reading, ctx) {
  const c = ctx || {};
  const refuse = (why) => ({ ok: false, reason: 'citation_outside_sources', state: 'rejected:citation_outside_sources', why });
  const r = isPlain(reading) ? reading : {};
  const ids = new Set([].concat(c.ownIds || [], c.whiteIds || []));
  const urls = new Set([].concat(c.ownUrls || [], c.whiteUrls || []));
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

/**
 * Step plan_research. This plan holds the no-plan branch only: no handle step exists before plan 11, so
 * every researching hat is not planned, plan_research is done and run_research is skipped. Zero-item
 * packs (S-5) are written into the hat directories so a reading still finds its two files.
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

  const states = {};
  for (const hat of HATS) {
    if (!RESEARCH_HATS.includes(hat)) states[hat] = 'never_searches';
    else if (!PERSONA_USABLE.includes(ledger.hats[hat].persona)) states[hat] = 'not_planned:persona_not_accepted';
    else states[hat] = 'not_planned:no_valid_handle';
  }
  const pack = (hat, state) => ({ schema: EVIDENCE_SCHEMA, run_id: ledger.run_id, hat, research_state: state, strings: [], items: [] });
  try {
    for (const hat of READ_HATS) {
      atomicWriteJson(path.join(hatDirOf(map, hat), 'shared-white.json'), pack('white', states.white));
    }
    for (const hat of RESEARCH_HATS) {
      atomicWriteJson(path.join(hatDirOf(map, hat), 'evidence.json'), pack(hat, states[hat]));
    }
  } catch (e) {
    return { ok: false, reason: 'write_failed:' + (e && e.code ? e.code : 'error') };
  }

  const now = nowOf(deps);
  for (const hat of HATS) ledger.hats[hat].research = states[hat];
  ledger.research = { strings_approved: 0, strings_refused: 0 };
  markStep(ledger, 'plan_research', 'done', now);
  markStep(ledger, 'run_research', 'skipped', now);
  writeLedger(lr.dir, ledger);
  return { ok: true, run_id: ledger.run_id, hats: states, planned: [] };
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
  const own = RESEARCH_HATS.includes(hat) ? packSets(path.join(dir, 'evidence.json')) : { ids: [], urls: [] };
  const white = packSets(path.join(dir, 'shared-white.json'));
  const cite = citationCheck(hat, reading, { ownIds: own.ids, whiteIds: white.ids, ownUrls: own.urls, whiteUrls: white.urls });
  if (!cite.ok) {
    rec.reading = cite.state;
    return out;
  }
  const rules = perHatRules(hat, reading, { researchState: ctx.researchState });
  rec.reading = 'ran';
  rec.rule_lines = rules.lines;
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
  const order = requireStep(ledger, 'run_research');
  if (order) return { ok: false, reason: order };
  if (ledger.mode !== 'deep') return { ok: false, reason: 'mode_not_deep' };
  const map = readRunMap(homeDirOf(deps), ledger.run_id, roomResolved);
  if (!map) return { ok: false, reason: 'run_map_missing' };
  const blueDir = hatDirOf(map, 'blue');
  if (!blueDir) return { ok: false, reason: 'run_map_missing' };

  const subQuestionIds = ledger.sub_questions.map(s => s.id);
  const now = nowOf(deps);
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
      const judged = judgeReading(hat, dir, { runId: ledger.run_id, subQuestionIds, researchState: entry.research });
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
    };
  }
  const bluePath = path.join(blueDir, 'ledger.json');
  try {
    atomicWriteJson(bluePath, ledgerBlue);
  } catch (e) {
    return { ok: false, reason: 'write_failed:' + (e && e.code ? e.code : 'error') };
  }

  if (!ledger.steps.check) markStep(ledger, 'check', 'done', now);
  writeLedger(lr.dir, ledger);
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
});

/** The marker text of a closed position value, or null for mixed and no_position. */
function positionMarker(value) {
  return Object.prototype.hasOwnProperty.call(POSITION_MARKERS, value) ? POSITION_MARKERS[value] : null;
}

/**
 * The settled-tension key: SHA-256 hex of the target content hash, the sub-question id and the sorted pair
 * joined by "+", the three parts joined by a newline. Plan 09 uses the same id as the key of its store.
 */
function tensionKey(targetContentHash, subQuestionId, pair) {
  const sorted = (Array.isArray(pair) ? pair.slice() : []).map(String).sort();
  return sha256Hex([String(targetContentHash), String(subQuestionId), sorted.join('+')].join('\n'));
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
  const notRun = [];
  const failedRun = [];
  for (const hat of RESEARCH_HATS) {
    const st = hats[hat] && typeof hats[hat].research === 'string' ? hats[hat].research : '';
    if (st === 'declined' || st.indexOf('not_planned') === 0) notRun.push(hat + ' (' + reasonOf(st) + ')');
    else if (st.indexOf('failed') === 0 || st.indexOf('fetched_not_wired') === 0) failedRun.push(hat + ' (' + reasonOf(st) + ')');
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

  deepNoticeLines(record).forEach(push);
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
        id: tensionKey(ledger.target_content_hash, sq.id, pair),
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

  // 1. Judge each reading again. P-7: a file whose hash differs from the one of check is rejected.
  const verdict = {};
  const readings = {};
  for (const hat of READ_HATS) {
    const entry = ledger.hats[hat];
    if (entry.reading !== 'ran') {
      verdict[hat] = { state: entry.reading };
      continue;
    }
    const judged = judgeReading(hat, hatDirOf(map, hat), { runId: ledger.run_id, subQuestionIds, researchState: entry.research });
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
    packs[hat] = RESEARCH_HATS.includes(hat) ? readPackForArtifact(path.join(hatDirOf(map, hat), 'evidence.json')) : { items: [], strings: [] };
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
  if (ledger.mode !== 'deep') return { ok: false, reason: 'mode_not_deep' };
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
  const nextStore = Object.assign({}, store.rulings);
  let storeChanged = false;
  const recorded = [];
  const deferred = [];
  const reopened = [];
  for (const e of answer.rulings) {
    const t = byId[e.tension_id];
    if (e.reopen === true) {
      if (Object.prototype.hasOwnProperty.call(nextStore, e.tension_id)) { delete nextStore[e.tension_id]; storeChanged = true; }
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
      nextStore[e.tension_id] = {
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
      atomicWriteJson(rulingsStorePath(roomResolved), { schema: RULINGS_SCHEMA, rulings: nextStore });
    }
    markStep(ledger, 'record_ruling', 'done', now);
    writeLedger(lr.dir, ledger);
  } catch (e) {
    return { ok: false, reason: 'write_failed:' + (e && e.code ? e.code : 'error') };
  }

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
    remaining_open: tensions.filter(t => t.state === 'open').map(t => t.id),
  };
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
    case 'plan-research':
      missing = need(['room', 'run']);
      if (!missing.length) result = cmdPlanResearch({ roomDir: flags.room, runId: flags.run }, deps);
      break;
    case 'check':
      missing = need(['room', 'run']);
      if (!missing.length) result = cmdCheck({ roomDir: flags.room, runId: flags.run }, deps);
      break;
    case 'merge':
      missing = need(['room', 'run']);
      if (!missing.length) result = cmdMerge({ roomDir: flags.room, runId: flags.run, countsPath: typeof flags.counts === 'string' && flags.counts.length ? flags.counts : undefined }, deps);
      break;
    case 'record-ruling':
      missing = need(['room', 'run', 'answer']);
      if (!missing.length) result = cmdRecordRuling({ roomDir: flags.room, runId: flags.run, answerPath: flags.answer }, deps);
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
  if (result && typeof result.then === 'function') {
    // merge is asynchronous: the lens engine rotate call is a promise.
    return result.then((r) => {
      process.stdout.write(JSON.stringify(r, null, 2) + '\n');
      process.exitCode = 0;
      return r;
    }, (e) => {
      process.stderr.write('merge failed: ' + (e && e.code ? e.code : 'error') + '\n');
      process.exitCode = 1;
      return undefined;
    });
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
  cmdPlanResearch,
  cmdCheck,
  cmdMerge,
  cmdRecordRuling,
  readRulingsStore,
  tensionKey,
  positionMarker,
  buildArtifact,
  deepNoticeLines,
  ARTIFACT_LABELS,
  validateReading,
  perHatRules,
  citationCheck,
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
};
