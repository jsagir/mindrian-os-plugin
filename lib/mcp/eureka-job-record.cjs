'use strict';

// Phase 374 plan 10 (ADAPT374-02, owner card OD-4 answered RECOMMENDED = USER-DIR, decision D-12).
//
// The plugin job record: one small pointer file for each started Eureka job, so a job that was started before a
// host restart can be asked about again. The engine keeps a finished job and its result for 30 days; this record
// only holds the ids needed to ask the engine and to check the answer.
//
// Canon Part 8 and Part 9 rules for this file:
//   - ids, hashes, counts and times only. Never a request, a title, a source reference, a node id, an objective
//     or any result text. The key list is closed; a key outside the list, or a deny-listed key, is refused.
//   - local only. No Brain or Theo call, no network, no child process. This module requires only node:fs,
//     node:path, node:os and node:crypto.
//   - bound to the room. The folder is <home>/.mindrian/eureka-jobs/<safe room id>/ and every read checks the
//     room id inside the record.
//   - owner only. The folders are mode 0700 and the files mode 0600. A write goes to a temp file in the same
//     folder and is then renamed. The job id is checked against a strict pattern before it becomes a file name.
//   - swept after 30 days (engine_expires_at).
// Only the location the owner answered is implemented. There is no second location.

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_MS = 30 * DAY_MS;
const MAX_FIELD_CHARS = 256;
const JOB_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/;
const ROOM_SEGMENT_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/;
const HEX64 = /^[a-fA-F0-9]{64}$/;

// The closed key list. The value is the kind of check.
const FIELDS = Object.freeze({
  job_id: 'job_id', capability_id: 'text', route: 'text', scope_id: 'text', snapshot_id: 'text', room_id: 'text',
  session_key_hash: 'hex', request_sha256: 'hex', artifact_count: 'count', top_k: 'count', plan_digest: 'hex',
  approval_ref: 'text', idempotency_key: 'text', started_at: 'time', engine_expires_at: 'time',
  last_status: 'text', last_status_at: 'time', terminal: 'bool', manifest_sha256: 'hex',
});
const REQUIRED = Object.freeze(['job_id', 'capability_id', 'room_id', 'started_at', 'engine_expires_at']);
const UPDATABLE = Object.freeze(['last_status', 'last_status_at', 'terminal', 'manifest_sha256']);
// Keys that must never appear. They are listed so that a refusal is deliberate, not only a side effect of the closed list.
const DENIED = Object.freeze(['text', 'title', 'source_ref', 'request', 'result', 'objective', 'node_ids', 'artifacts']);

const MSG_KEY = 'job record: a key is not allowed';
const MSG_FIELD = 'job record: a field value is not valid';
const MSG_MISSING = 'job record: a required field is missing';
const MSG_SHAPE = 'job record: the record must be an object';

function jobIdOk(id) {
  return typeof id === 'string' && JOB_ID_RE.test(id) && id.indexOf('..') === -1;
}

function sha256Hex(text) { return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex'); }

// Canonical JSON: keys sorted at every level. The digest of a request is taken over this form.
function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((k) => JSON.stringify(k) + ':' + canonicalJson(value[k])).join(',') + '}';
  }
  const text = JSON.stringify(value);
  return text === undefined ? 'null' : text;
}
function canonicalSha256(value) { return sha256Hex(canonicalJson(value)); }

function checkValue(kind, value, key) {
  if (value === null || value === undefined) {
    if (REQUIRED.indexOf(key) !== -1) throw new TypeError(MSG_MISSING);
    return null;
  }
  switch (kind) {
    case 'job_id':
      if (!jobIdOk(value)) throw new TypeError(MSG_FIELD);
      return value;
    case 'text':
      if (typeof value !== 'string' || value.length === 0) throw new TypeError(MSG_FIELD);
      return value.length > MAX_FIELD_CHARS ? value.slice(0, MAX_FIELD_CHARS) : value;
    case 'hex':
      if (typeof value !== 'string' || !HEX64.test(value)) throw new TypeError(MSG_FIELD);
      return value;
    case 'count':
      if (!Number.isInteger(value) || value < 0 || value > 1e9) throw new TypeError(MSG_FIELD);
      return value;
    case 'time':
      if (typeof value !== 'string' || value.length > 64 || Number.isNaN(Date.parse(value))) throw new TypeError(MSG_FIELD);
      return value;
    case 'bool':
      if (typeof value !== 'boolean') throw new TypeError(MSG_FIELD);
      return value;
    default:
      throw new TypeError(MSG_FIELD);
  }
}

// Returns a new object with exactly the allowed keys. Throws a TypeError with a fixed message for anything else.
// The message never repeats a value.
function validateRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new TypeError(MSG_SHAPE);
  for (const key of Object.keys(record)) {
    if (DENIED.indexOf(key) !== -1) throw new TypeError(MSG_KEY);
    if (!Object.prototype.hasOwnProperty.call(FIELDS, key)) throw new TypeError(MSG_KEY);
  }
  const out = {};
  for (const key of Object.keys(FIELDS)) {
    out[key] = checkValue(FIELDS[key], record[key], key);
  }
  if (out.terminal === null) out.terminal = false;
  return out;
}

// ---------------------------------------------------------------------------
// location: <home>/.mindrian/eureka-jobs/<safe room id>/
// ---------------------------------------------------------------------------

// The home comes from the environment at call time: HOME, then USERPROFILE, then os.homedir(). The os.homedir()
// step is used only when the caller passes no env (the process environment). A caller that passes its own env
// object without a home gets no folder, so a test or a host with a bare env never writes to the real home.
function homeFrom(env) {
  const explicit = !!env && env !== process.env;
  const source = env || process.env;
  let home = source.HOME || source.USERPROFILE;
  if (!home && !explicit) {
    try { home = os.homedir(); } catch (_error) { home = null; }
  }
  if (typeof home !== 'string' || !home || !path.isAbsolute(home)) return null;
  return home;
}

function resolveRoot(env) {
  const home = homeFrom(env);
  if (!home) return { ok: false, reason: 'no_home' };
  return { ok: true, root: path.join(home, '.mindrian', 'eureka-jobs') };
}

function roomSegment(roomId) {
  if (typeof roomId === 'string' && ROOM_SEGMENT_RE.test(roomId) && roomId.indexOf('..') === -1) return roomId;
  return 'h-' + sha256Hex(roomId).slice(0, 32);
}

// resolveBase({ room_id, env }) gives { ok: true, base, root } or { ok: false, reason: 'no_room' | 'no_home' }.
function resolveBase(input) {
  const opts = input && typeof input === 'object' ? input : {};
  if (typeof opts.room_id !== 'string' || !opts.room_id) return { ok: false, reason: 'no_room' };
  const rooted = resolveRoot(opts.env);
  if (!rooted.ok) return rooted;
  return { ok: true, root: rooted.root, base: path.join(rooted.root, roomSegment(opts.room_id)) };
}

function fileNameOf(jobId) { return jobId.replace(/:/g, '%3A') + '.json'; }

// The resolved file path must stay inside the base folder.
function fileIn(base, jobId) {
  if (typeof base !== 'string' || !base || !path.isAbsolute(base) || !jobIdOk(jobId)) return null;
  const dir = path.resolve(base);
  const file = path.resolve(dir, fileNameOf(jobId));
  if (path.dirname(file) !== dir || !file.startsWith(dir + path.sep)) return null;
  return { dir, file };
}

// ---------------------------------------------------------------------------
// read, write
// ---------------------------------------------------------------------------

function readFileRecord(file) {
  try {
    const st = fs.lstatSync(file);
    if (!st.isFile() || st.isSymbolicLink()) return null;
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return validateRecord(parsed);
  } catch (_error) {
    return null;
  }
}

// readRecord(base, jobId, roomId): the record, or null. When roomId is given the room id inside the record must
// equal it, so a record copied into another room's folder does not read.
function readRecord(base, jobId, roomId) {
  const where = fileIn(base, jobId);
  if (!where) return null;
  const record = readFileRecord(where.file);
  if (!record || record.job_id !== jobId) return null;
  if (typeof roomId === 'string' && record.room_id !== roomId) return null;
  return record;
}

// Looks for a record of this job in the folders of other rooms. Gives { room_id } or null. Used only to tell a
// caller from another room that the job is not theirs.
function findInOtherRooms(input, jobId) {
  if (!jobIdOk(jobId)) return null;
  const opts = input && typeof input === 'object' ? input : {};
  const rooted = resolveRoot(opts.env);
  if (!rooted.ok) return null;
  const own = typeof opts.room_id === 'string' && opts.room_id ? roomSegment(opts.room_id) : null;
  let entries;
  try { entries = fs.readdirSync(rooted.root, { withFileTypes: true }); } catch (_error) { return null; }
  let seen = 0;
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === own) continue;
    seen += 1;
    if (seen > 500) break;
    const record = readRecord(path.join(rooted.root, entry.name), jobId);
    if (record) return { room_id: record.room_id };
  }
  return null;
}

function ensureDirs(base) {
  const dir = path.resolve(base);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  // Tighten only the two folders this module owns.
  try { fs.chmodSync(dir, 0o700); } catch (_error) { /* best effort */ }
  try { fs.chmodSync(path.dirname(dir), 0o700); } catch (_error) { /* best effort */ }
}

// Temp file in the same folder, then a rename. A failure removes the temp file and gives a typed answer.
function writeAtomic(base, jobId, record) {
  const where = fileIn(base, jobId);
  if (!where) return { ok: false, reason: 'job_id_invalid' };
  let tmp = null;
  try {
    ensureDirs(where.dir);
    tmp = path.join(where.dir, '.tmp-' + process.pid + '-' + crypto.randomBytes(6).toString('hex') + '.tmp');
    fs.writeFileSync(tmp, JSON.stringify(record, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    fs.renameSync(tmp, where.file);
    tmp = null;
    return { ok: true, file: where.file };
  } catch (_error) {
    if (tmp) { try { fs.unlinkSync(tmp); } catch (_inner) { /* best effort */ } }
    return { ok: false, reason: 'record_write_failed' };
  }
}

// recordStart(base, record): writes the record. A bad job id gives { ok: false, reason: 'job_id_invalid' } and
// touches nothing. Any other bad content throws a TypeError. A file system failure gives record_write_failed.
function recordStart(base, record) {
  if (record && typeof record === 'object' && !Array.isArray(record) && !jobIdOk(record.job_id)) {
    return { ok: false, reason: 'job_id_invalid' };
  }
  const clean = validateRecord(record);
  return writeAtomic(base, clean.job_id, clean);
}

// updateRecord(base, jobId, patch, roomId): changes only the four updatable fields.
function updateRecord(base, jobId, patch, roomId) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError(MSG_SHAPE);
  for (const key of Object.keys(patch)) {
    if (UPDATABLE.indexOf(key) === -1) throw new TypeError(MSG_KEY);
  }
  const next = {};
  for (const key of Object.keys(patch)) next[key] = checkValue(FIELDS[key], patch[key], key);
  if (!jobIdOk(jobId)) return { ok: false, reason: 'job_id_invalid' };
  const current = readRecord(base, jobId, roomId);
  if (!current) return { ok: false, reason: 'record_not_found' };
  const merged = validateRecord(Object.assign({}, current, next));
  return writeAtomic(base, jobId, merged);
}

function removeRecord(base, jobId) {
  const where = fileIn(base, jobId);
  if (!where) return { ok: false, reason: 'job_id_invalid' };
  try { fs.unlinkSync(where.file); return { ok: true }; } catch (_error) { return { ok: false, reason: 'record_not_found' }; }
}

// sweep(base, nowMs): removes records past engine_expires_at, unreadable records older than 30 days, and stale
// temp files. Gives the number of files removed. Never throws.
function sweep(base, nowMs) {
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  let removed = 0;
  let names;
  try { names = fs.readdirSync(path.resolve(base)); } catch (_error) { return 0; }
  for (const name of names) {
    const file = path.join(path.resolve(base), name);
    try {
      const st = fs.lstatSync(file);
      if (!st.isFile()) continue;
      if (name.startsWith('.tmp-') && name.endsWith('.tmp')) {
        if (now - st.mtimeMs > 60 * 60 * 1000) { fs.unlinkSync(file); removed += 1; }
        continue;
      }
      if (name.startsWith('.') || !name.endsWith('.json')) continue;
      const record = readFileRecord(file);
      if (record) {
        if (Date.parse(record.engine_expires_at) <= now) { fs.unlinkSync(file); removed += 1; }
      } else if (now - st.mtimeMs > RETENTION_MS) {
        fs.unlinkSync(file); removed += 1;
      }
    } catch (_error) { /* continue with the next file */ }
  }
  return removed;
}

module.exports = {
  RETENTION_MS, UPDATABLE, ALLOWED_KEYS: Object.freeze(Object.keys(FIELDS)),
  jobIdOk, resolveBase, resolveRoot, recordStart, readRecord, updateRecord, sweep, removeRecord,
  findInOtherRooms, validateRecord, canonicalSha256,
};
