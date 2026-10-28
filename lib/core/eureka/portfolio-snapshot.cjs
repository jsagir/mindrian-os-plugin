'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 314-01 -- the closed-schema portfolio snapshot store.
 *
 * WHAT THIS IS
 *   The local memory of the last two portfolio runs, plus the stored movement
 *   between them. It lives inside the room, under
 *   <roomDir>/.mindrian/eureka-portfolio/, as plain JSON written temp-then-
 *   rename (the same governed idiom as eureka-reach-runner atomicWriteJson).
 *   D-01: each on-demand run is compared with the previous stored run.
 *   D-02: the sensor only reads the stored movement, it never writes here.
 *   D-07: local only, inside the room.
 *
 * LAYOUT
 *   <store>/room/latest.json, previous.json         whole-room scope
 *   <store>/section-<slug>/latest.json, previous.json   one named subset
 *   <store>/movement-<scope_id>.json                one movement per scope
 *   <store>/movement-seen.json                      set of seen movement ids
 *
 * PART 8
 *   A snapshot holds opaque handles, closed-enum bands, numbers, and a small
 *   local labels map. Labels are the ONLY place room text can appear. They stay
 *   in the local snapshot. The movement envelope (portfolio-movement.cjs) is a
 *   closed schema of enums, handles and counts and never copies a label.
 *   The scope id of a named subset is a hash, so the readable section name does
 *   not reach the movement file name.
 *
 * Every function here returns a plain value and never throws. Node built-ins
 * only. No network.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SCHEMA_VERSION = 1;
const STORE_DIRNAME = 'eureka-portfolio';
const LATEST_FILE = 'latest.json';
const PREVIOUS_FILE = 'previous.json';
const MOVEMENT_PREFIX = 'movement-';
const MOVEMENT_SUFFIX = '.json';
const SEEN_FILE = 'movement-seen.json';
const SCOPE_ID_RE = /^(?:room|s_[0-9a-f]{8})$/;
const MAX_MOVEMENT_FILES = 8;
const MAX_SEEN = 64;
const BANDS = Object.freeze(['none', 'low', 'moderate', 'opportunity', 'high', 'breakthrough']);
const MAX_PAIRS = 20000;
const MAX_TAIL_ITEMS = 5000;
const MAX_LABELS = 200;
const MAX_LABEL_CHARS = 80;
const MAX_PROVENANCE_KEYS = 40;
const MAX_PROVENANCE_STRING = 256;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const HANDLE_RE = /^[A-Za-z0-9_.:-]{1,128}$/;
const MOVEMENT_ID_RE = /^pm_[0-9a-f]{12}$/;

// A reader refuses a file larger than this before it parses it.
const MAX_SNAPSHOT_BYTES = 24 * 1024 * 1024;
const MAX_MOVEMENT_BYTES = 64 * 1024;
const MAX_SEEN_BYTES = 16 * 1024;

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const PROVENANCE_KEY_RE = /^[a-z][a-z0-9_]{0,63}$/;
const MOVEMENT_FILE_RE = /^movement-(room|s_[0-9a-f]{8})\.json$/;

// ---------- small helpers ----------

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function sortedKeysEqual(obj, keys) {
  if (!isPlainObject(obj)) return false;
  const have = Object.keys(obj).slice().sort();
  const want = keys.slice().sort();
  if (have.length !== want.length) return false;
  for (let i = 0; i < have.length; i += 1) {
    if (have[i] !== want[i]) return false;
  }
  return true;
}

function isHandle(v) {
  return typeof v === 'string' && HANDLE_RE.test(v);
}

function isIso(v) {
  return typeof v === 'string' && ISO_RE.test(v) && Number.isFinite(Date.parse(v));
}

function isRoomDir(roomDir) {
  return typeof roomDir === 'string' && roomDir.length > 0;
}

function storeDir(roomDir) {
  if (!isRoomDir(roomDir)) return null;
  return path.join(roomDir, '.mindrian', STORE_DIRNAME);
}

/**
 * Read a JSON file under a byte cap. Returns the parsed value or null for a
 * missing file, an oversized file, or text that is not JSON. Never throws.
 */
function readJsonCapped(filePath, maxBytes) {
  try {
    const st = fs.statSync(filePath);
    if (!st.isFile() || st.size > maxBytes) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_e) {
    return null;
  }
}

/**
 * Temp file in the same directory, then rename. Returns true or false. Never
 * throws. A failed write removes its temp file.
 */
function atomicWriteJson(filePath, data) {
  const tmpPath = filePath + '.tmp.' + process.pid;
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, filePath);
    return true;
  } catch (_e) {
    try { fs.rmSync(tmpPath, { force: true }); } catch (_e2) { /* ignore */ }
    return false;
  }
}

// ---------- scope ----------

/**
 * scopeId(scope) -> 'room' | 's_' + 8 hex | null.
 * The id of a named subset is the first 8 hex characters of the sha256 of the
 * slug, so no readable section name reaches the movement file name or the
 * movement envelope.
 */
function scopeId(scope) {
  if (scope === 'room') return 'room';
  if (typeof scope !== 'string' || !SLUG_RE.test(scope)) return null;
  return 's_' + crypto.createHash('sha256').update(scope).digest('hex').slice(0, 8);
}

/**
 * scopeDir(roomDir, scope) -> the folder of one scope, or null. The folder name
 * is built only from the constant 'room' or from a slug that passed SLUG_RE.
 */
function scopeDir(roomDir, scope) {
  const store = storeDir(roomDir);
  if (!store) return null;
  if (scope === 'room') return path.join(store, 'room');
  if (typeof scope !== 'string' || !SLUG_RE.test(scope)) return null;
  return path.join(store, 'section-' + scope);
}

// ---------- snapshot schema ----------

function validProvenance(p) {
  if (!isPlainObject(p)) return false;
  const keys = Object.keys(p);
  if (keys.length > MAX_PROVENANCE_KEYS) return false;
  for (let i = 0; i < keys.length; i += 1) {
    const k = keys[i];
    if (!PROVENANCE_KEY_RE.test(k)) return false;
    const v = p[k];
    if (v === null || typeof v === 'boolean') continue;
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) return false;
      continue;
    }
    if (typeof v === 'string') {
      if (v.length > MAX_PROVENANCE_STRING) return false;
      continue;
    }
    return false;
  }
  return true;
}

function validPairs(pairs) {
  if (!Array.isArray(pairs) || pairs.length > MAX_PAIRS) return false;
  for (let i = 0; i < pairs.length; i += 1) {
    const p = pairs[i];
    if (!sortedKeysEqual(p, ['a', 'b', 'band', 'score', 'rank'])) return false;
    if (!isHandle(p.a) || !isHandle(p.b)) return false;
    if (BANDS.indexOf(p.band) === -1) return false;
    if (typeof p.score !== 'number' || !Number.isFinite(p.score)) return false;
    if (!Number.isInteger(p.rank) || p.rank < 1) return false;
  }
  return true;
}

function validTail(t) {
  if (!sortedKeysEqual(t, ['composition', 'insufficient_structure', 'suspect_noise', 'items'])) return false;
  if (typeof t.composition !== 'string' || t.composition.length > MAX_PROVENANCE_STRING) return false;
  if (typeof t.insufficient_structure !== 'boolean' || typeof t.suspect_noise !== 'boolean') return false;
  if (!Array.isArray(t.items) || t.items.length > MAX_TAIL_ITEMS) return false;
  for (let i = 0; i < t.items.length; i += 1) {
    if (!sortedKeysEqual(t.items[i], ['id'])) return false;
    if (!isHandle(t.items[i].id)) return false;
  }
  return true;
}

function validLabels(l) {
  if (!isPlainObject(l)) return false;
  const keys = Object.keys(l);
  if (keys.length > MAX_LABELS) return false;
  for (let i = 0; i < keys.length; i += 1) {
    if (!isHandle(keys[i])) return false;
    if (typeof l[keys[i]] !== 'string' || l[keys[i]].length > MAX_LABEL_CHARS) return false;
  }
  return true;
}

/**
 * validateSnapshot(s) -> boolean. The closed schema: exact top-level keys, exact
 * nested keys, every enum inside its list, every number finite. Never throws.
 */
function validateSnapshot(s) {
  try {
    if (!sortedKeysEqual(s, ['schema_version', 'ran_at', 'scope', 'scope_id', 'encoder_kind', 'provenance', 'pairs', 'tail', 'labels'])) return false;
    if (s.schema_version !== SCHEMA_VERSION) return false;
    if (!isIso(s.ran_at)) return false;
    if (s.scope !== 'room' && s.scope !== 'subset') return false;
    if (typeof s.scope_id !== 'string' || !SCOPE_ID_RE.test(s.scope_id)) return false;
    if ((s.scope === 'room') !== (s.scope_id === 'room')) return false;
    if (s.encoder_kind !== 'live' && s.encoder_kind !== 'stub') return false;
    if (!validProvenance(s.provenance)) return false;
    if (!validPairs(s.pairs)) return false;
    if (!validTail(s.tail)) return false;
    if (!validLabels(s.labels)) return false;
    return true;
  } catch (_e) {
    return false;
  }
}

// ---------- run store ----------

function readValidSnapshot(filePath) {
  const doc = readJsonCapped(filePath, MAX_SNAPSHOT_BYTES);
  return doc !== null && validateSnapshot(doc) ? doc : null;
}

/**
 * saveRun(roomDir, scope, snapshot) -> { ok, rotated, reason? }.
 * Validates first, so an invalid snapshot writes nothing. The new run goes to a
 * temp file first; only then does the old latest rotate into previous.json and
 * the temp file replace latest.json.
 */
function saveRun(roomDir, scope, snapshot) {
  try {
    const dir = scopeDir(roomDir, scope);
    if (!dir) return { ok: false, rotated: false, reason: 'bad_scope' };
    if (!validateSnapshot(snapshot)) return { ok: false, rotated: false, reason: 'invalid_snapshot' };
    if (scopeId(scope) !== snapshot.scope_id) return { ok: false, rotated: false, reason: 'scope_mismatch' };

    fs.mkdirSync(dir, { recursive: true });
    const latestPath = path.join(dir, LATEST_FILE);
    const previousPath = path.join(dir, PREVIOUS_FILE);
    const tmpPath = latestPath + '.tmp.' + process.pid;
    try {
      fs.writeFileSync(tmpPath, JSON.stringify(snapshot, null, 2), 'utf8');
    } catch (_e) {
      try { fs.rmSync(tmpPath, { force: true }); } catch (_e2) { /* ignore */ }
      return { ok: false, rotated: false, reason: 'write_failed' };
    }
    let rotated = false;
    try {
      if (readValidSnapshot(latestPath) !== null) {
        fs.renameSync(latestPath, previousPath);
        rotated = true;
      }
      fs.renameSync(tmpPath, latestPath);
    } catch (_e) {
      try { fs.rmSync(tmpPath, { force: true }); } catch (_e2) { /* ignore */ }
      return { ok: false, rotated: rotated, reason: 'write_failed' };
    }
    return { ok: true, rotated: rotated };
  } catch (_e) {
    return { ok: false, rotated: false, reason: 'save_error' };
  }
}

function readRun(roomDir, scope, file) {
  try {
    const dir = scopeDir(roomDir, scope);
    if (!dir) return null;
    return readValidSnapshot(path.join(dir, file));
  } catch (_e) {
    return null;
  }
}

function readLatest(roomDir, scope) { return readRun(roomDir, scope, LATEST_FILE); }
function readPrevious(roomDir, scope) { return readRun(roomDir, scope, PREVIOUS_FILE); }

// ---------- movement store (one file per scope) ----------

function movementPath(roomDir, sid) {
  const store = storeDir(roomDir);
  if (!store || typeof sid !== 'string' || !SCOPE_ID_RE.test(sid)) return null;
  return path.join(store, MOVEMENT_PREFIX + sid + MOVEMENT_SUFFIX);
}

function validEnvelope(envelope) {
  // Lazy require: portfolio-movement.cjs requires this module for HANDLE_RE.
  try {
    const mod = require('./portfolio-movement.cjs');
    return typeof mod.validateEnvelope === 'function' && mod.validateEnvelope(envelope) === true;
  } catch (_e) {
    return false;
  }
}

/**
 * writeMovement(roomDir, envelope) -> { ok, reason? }.
 * Writes <store>/movement-<envelope.scope_id>.json and touches no other file.
 * An invalid envelope, or a missing validator, writes nothing.
 */
function writeMovement(roomDir, envelope) {
  try {
    if (!isPlainObject(envelope)) return { ok: false, reason: 'invalid_envelope' };
    const target = movementPath(roomDir, envelope.scope_id);
    if (!target) return { ok: false, reason: 'bad_scope' };
    if (!validEnvelope(envelope)) return { ok: false, reason: 'invalid_envelope' };
    return atomicWriteJson(target, envelope) ? { ok: true } : { ok: false, reason: 'write_failed' };
  } catch (_e) {
    return { ok: false, reason: 'write_error' };
  }
}

/**
 * readMovement(roomDir, scopeId) -> a validated envelope or null. The file must
 * also name the scope it is stored under.
 */
function readMovement(roomDir, sid) {
  try {
    const p = movementPath(roomDir, sid);
    if (!p) return null;
    const doc = readJsonCapped(p, MAX_MOVEMENT_BYTES);
    if (doc === null || !validEnvelope(doc) || doc.scope_id !== sid) return null;
    return doc;
  } catch (_e) {
    return null;
  }
}

/**
 * listMovements(roomDir) -> validated envelopes, newest detected_at first, from
 * at most MAX_MOVEMENT_FILES store files (the newest by modification time). An
 * invalid or corrupt file is skipped and never hides a valid one.
 */
function listMovements(roomDir) {
  try {
    const store = storeDir(roomDir);
    if (!store) return [];
    const names = fs.readdirSync(store).filter(function (n) { return MOVEMENT_FILE_RE.test(n); });
    const dated = names.map(function (n) {
      let m = 0;
      try { m = fs.statSync(path.join(store, n)).mtimeMs; } catch (_e) { m = 0; }
      return { n: n, m: m };
    });
    dated.sort(function (x, y) { return y.m - x.m || (x.n < y.n ? -1 : 1); });
    const out = [];
    dated.slice(0, MAX_MOVEMENT_FILES).forEach(function (d) {
      const sid = MOVEMENT_FILE_RE.exec(d.n)[1];
      const env = readMovement(roomDir, sid);
      if (env) out.push(env);
    });
    out.sort(function (x, y) {
      const dx = Date.parse(x.detected_at);
      const dy = Date.parse(y.detected_at);
      return dy - dx || (x.scope_id < y.scope_id ? -1 : 1);
    });
    return out;
  } catch (_e) {
    return [];
  }
}

/**
 * clearMovement(roomDir, scopeId) -> { ok }. Removes that scope's file only. An
 * absent file is a success. Never throws.
 */
function clearMovement(roomDir, sid) {
  try {
    const p = movementPath(roomDir, sid);
    if (!p) return { ok: false, reason: 'bad_scope' };
    fs.rmSync(p, { force: true });
    return { ok: true };
  } catch (_e) {
    return { ok: false, reason: 'clear_failed' };
  }
}

// ---------- seen set ----------

/**
 * Read the seen file. Returns { state: 'absent' | 'corrupt' | 'ok', seen: [] }.
 */
function readSeen(roomDir) {
  const store = storeDir(roomDir);
  if (!store) return { state: 'corrupt', seen: [] };
  const p = path.join(store, SEEN_FILE);
  if (!fs.existsSync(p)) return { state: 'absent', seen: [] };
  const doc = readJsonCapped(p, MAX_SEEN_BYTES);
  if (!sortedKeysEqual(doc, ['schema_version', 'seen'])) return { state: 'corrupt', seen: [] };
  if (doc.schema_version !== SCHEMA_VERSION || !Array.isArray(doc.seen) || doc.seen.length > MAX_SEEN) {
    return { state: 'corrupt', seen: [] };
  }
  for (let i = 0; i < doc.seen.length; i += 1) {
    if (typeof doc.seen[i] !== 'string' || !MOVEMENT_ID_RE.test(doc.seen[i])) return { state: 'corrupt', seen: [] };
  }
  return { state: 'ok', seen: doc.seen.slice() };
}

/**
 * markSeen(roomDir, movementId) -> { ok, reason? }. Adds one id to the set and
 * keeps the 64 newest. It never erases another id. A corrupt seen file is
 * rewritten with this id so that the nudge cannot repeat for it.
 */
function markSeen(roomDir, movementId) {
  try {
    if (typeof movementId !== 'string' || !MOVEMENT_ID_RE.test(movementId)) return { ok: false, reason: 'bad_id' };
    const store = storeDir(roomDir);
    if (!store) return { ok: false, reason: 'bad_room' };
    const cur = readSeen(roomDir);
    const list = cur.seen.filter(function (id) { return id !== movementId; });
    list.push(movementId);
    const kept = list.slice(-MAX_SEEN);
    const wrote = atomicWriteJson(path.join(store, SEEN_FILE), { schema_version: SCHEMA_VERSION, seen: kept });
    return wrote ? { ok: true } : { ok: false, reason: 'write_failed' };
  } catch (_e) {
    return { ok: false, reason: 'mark_error' };
  }
}

/**
 * isSeen(roomDir, movementId) -> boolean. Fails closed: a corrupt seen file, a
 * bad id or a bad room reads as seen, so a damaged store never repeats a nudge.
 */
function isSeen(roomDir, movementId) {
  try {
    if (typeof movementId !== 'string' || !MOVEMENT_ID_RE.test(movementId)) return true;
    const cur = readSeen(roomDir);
    if (cur.state === 'corrupt') return true;
    return cur.seen.indexOf(movementId) !== -1;
  } catch (_e) {
    return true;
  }
}

module.exports = {
  SCHEMA_VERSION: SCHEMA_VERSION,
  STORE_DIRNAME: STORE_DIRNAME,
  LATEST_FILE: LATEST_FILE,
  PREVIOUS_FILE: PREVIOUS_FILE,
  MOVEMENT_PREFIX: MOVEMENT_PREFIX,
  MOVEMENT_SUFFIX: MOVEMENT_SUFFIX,
  SEEN_FILE: SEEN_FILE,
  SCOPE_ID_RE: SCOPE_ID_RE,
  MAX_MOVEMENT_FILES: MAX_MOVEMENT_FILES,
  MAX_SEEN: MAX_SEEN,
  BANDS: BANDS,
  MAX_PAIRS: MAX_PAIRS,
  MAX_LABELS: MAX_LABELS,
  MAX_LABEL_CHARS: MAX_LABEL_CHARS,
  SLUG_RE: SLUG_RE,
  HANDLE_RE: HANDLE_RE,
  MOVEMENT_ID_RE: MOVEMENT_ID_RE,
  scopeId: scopeId,
  scopeDir: scopeDir,
  validateSnapshot: validateSnapshot,
  saveRun: saveRun,
  readLatest: readLatest,
  readPrevious: readPrevious,
  writeMovement: writeMovement,
  readMovement: readMovement,
  listMovements: listMovements,
  clearMovement: clearMovement,
  markSeen: markSeen,
  isSeen: isSeen
};
