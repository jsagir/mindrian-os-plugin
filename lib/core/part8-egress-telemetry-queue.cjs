'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 261118-vbv: the room-local queue of the Part 8 egress telemetry.
 * ======================================================================
 * Plan 392-11 (P5) writes one brain_egress_* row into the room that the Part 8
 * lexicon check resolved. Before this quick task the PreToolUse hook opened
 * room.db and wrote that row itself, on the hot path of every Brain call. Now
 * the hook only appends one small JSON line to
 * <room>/.mindrian/part8-egress-telemetry.queue.jsonl (enqueue), and a drain
 * (drainRoom, run by scripts/part8-egress-telemetry-drain.cjs on the Stop step
 * and at session start) writes each queued record through
 * lib/core/part8-egress-ontology.cjs record(), which routes every write through
 * lib/core/navigation.cjs (Canon Part 9, the single chokepoint). The stored row
 * is the same as before: the drain forwards the same fields the hook sent.
 *
 * Part 7 reuse note: no generic telemetry queue exists. The derivation queue
 * (lib/core/brain-derivation-queue.cjs) and the graph-derive queue are keyed
 * read-modify-write JSON files of other domains. This module copies the
 * enqueue-then-drain, keep-on-failure discipline of
 * scripts/gsd-graph-derive-drain.cjs and the atomic JSONL append of
 * lib/core/telemetry/writer.cjs (one appendFileSync for each line).
 *
 * Hook side (enqueue): node:fs and node:path only; no db open, no sqlite. It
 * writes only when <room>/.mindrian/room.db already exists, so it never mints
 * a database or a folder. Each line has 7 whitelisted keys: v, at, verdict,
 * class, matched_pattern, session_id, lexicon_scope. No payload byte rides a
 * line (Canon Part 8): class and matched_pattern are the scalars classify()
 * gives, cut to 200 characters; the ontology cuts them again to 40 and 80.
 * The queue has a cap of 5,000 lines or 2 MB, whichever comes first. When it is
 * full, the oldest lines are dropped and counted in
 * part8-egress-telemetry.state.json (field dropped); the drain reports it.
 *
 * Drain side (drainRoom): claim the queue with an atomic rename to
 * part8-egress-telemetry.<pid>-<epochMs>.claim (a hook append after the rename
 * makes a new queue file), plus each leftover claim of a dead process, of this
 * process, or older than 60 s. A missing room.db (never minted here), a room.db
 * that is not writable, or an open that throws keeps every claim. A malformed
 * line goes to part8-egress-telemetry.rejected.jsonl and is counted. A budget
 * stop writes the lines not yet done to a new claim file (tmp, then rename).
 *
 * Delivery is AT LEAST ONCE: a crash between record() and the unlink of the
 * claim can repeat a row; a row is never lost by the drain. record() swallows a
 * write failure inside navigation (its best-effort contract), so a write that
 * fails after a successful open counts as landed; the writable probe before the
 * open catches the read-only cases.
 *
 * No export throws. Pure CJS, node built-ins and repo modules only. No em dash
 * and no en dash.
 *
 * License: BSL 1.1.
 */

const fs = require('node:fs');
const path = require('node:path');

const QUEUE_BASENAME = 'part8-egress-telemetry.queue.jsonl';
const REJECTED_BASENAME = 'part8-egress-telemetry.rejected.jsonl';
const STATE_BASENAME = 'part8-egress-telemetry.state.json';
const CLAIM_RE = /^part8-egress-telemetry\.(\d+)-(\d+)\.claim$/;
const MAX_QUEUE_LINES = 5000;
const MAX_QUEUE_BYTES = 2 * 1024 * 1024;
const MAX_REJECTED_BYTES = 1024 * 1024;
const STALE_CLAIM_MS = 60000;
const DEFAULT_BUDGET_MS = 2000;
const ROOM_DB_PATH = path.join(__dirname, 'room-db.cjs');
const ONTOLOGY_PATH = path.join(__dirname, 'part8-egress-ontology.cjs');

// The shortest line enqueue can write. Below MAX_QUEUE_LINES of these bytes the
// line cap cannot be reached, so the hook reads the queue only when it is large.
const MIN_LINE_BYTES = JSON.stringify({ v: 1, at: new Date(0).toISOString(), verdict: '', class: '', matched_pattern: '', session_id: '' }).length + 1;

function _mdir(roomDir) { return path.join(roomDir, '.mindrian'); }
function _cut(v, n) { return typeof v === 'string' ? v.slice(0, n) : ''; }

function _readState(mdir) {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(mdir, STATE_BASENAME), 'utf8'));
    return (s && typeof s === 'object' && Number.isInteger(s.dropped) && s.dropped >= 0) ? s : { v: 1, dropped: 0 };
  } catch (_e) {
    return { v: 1, dropped: 0 };
  }
}

function _addDropped(mdir, n) {
  try {
    const s = _readState(mdir);
    const next = { v: 1, dropped: s.dropped + n, last_drop_at: new Date().toISOString() };
    const tmp = path.join(mdir, STATE_BASENAME + '.' + process.pid + '.tmp');
    fs.writeFileSync(tmp, JSON.stringify(next) + '\n', { mode: 0o600 });
    fs.renameSync(tmp, path.join(mdir, STATE_BASENAME));
  } catch (_e) { /* the counter is best-effort */ }
}

// Make room for one line of `size` bytes under the cap: drop the oldest lines.
function _trimForCap(mdir, qPath, size) {
  let st;
  try { st = fs.statSync(qPath); } catch (_e) { return; }
  if (!st.isFile()) return;
  if (st.size + size <= MAX_QUEUE_BYTES && st.size < MAX_QUEUE_LINES * MIN_LINE_BYTES) return;
  const lines = fs.readFileSync(qPath, 'utf8').split('\n').filter(function (l) { return l.length > 0; });
  let bytes = st.size;
  let drop = 0;
  while (drop < lines.length && (lines.length - drop >= MAX_QUEUE_LINES || bytes + size > MAX_QUEUE_BYTES)) {
    bytes -= Buffer.byteLength(lines[drop], 'utf8') + 1;
    drop += 1;
  }
  if (drop === 0) return;
  const tmp = path.join(mdir, QUEUE_BASENAME + '.' + process.pid + '.tmp');
  const rest = lines.slice(drop);
  fs.writeFileSync(tmp, rest.length ? rest.join('\n') + '\n' : '', { mode: 0o600 });
  fs.renameSync(tmp, qPath);
  _addDropped(mdir, drop);
}

/**
 * enqueue(roomDir, info) -> boolean. Hook side. Never throws.
 * info = { verdict, class, matched_pattern, sessionId, lexicon_scope }.
 */
function enqueue(roomDir, info) {
  try {
    if (typeof roomDir !== 'string' || roomDir.length === 0) return false;
    const mdir = _mdir(roomDir);
    if (!fs.existsSync(path.join(mdir, 'room.db'))) return false;
    const i = (info && typeof info === 'object') ? info : {};
    const rec = {
      v: 1,
      at: new Date().toISOString(),
      verdict: _cut(i.verdict, 40),
      class: _cut(i.class, 200),
      matched_pattern: _cut(i.matched_pattern, 200),
      session_id: _cut(i.sessionId, 512),
    };
    if (i.lexicon_scope === 'session' || i.lexicon_scope === 'machine_global') rec.lexicon_scope = i.lexicon_scope;
    const line = JSON.stringify(rec) + '\n';
    const qPath = path.join(mdir, QUEUE_BASENAME);
    try { _trimForCap(mdir, qPath, Buffer.byteLength(line, 'utf8')); } catch (_e) { /* the append below still runs */ }
    fs.appendFileSync(qPath, line, { flag: 'a', mode: 0o600 });
    return true;
  } catch (_e) {
    return false;
  }
}

function _list(mdir) {
  try { return fs.readdirSync(mdir); } catch (_e) { return []; }
}

function _lineCount(file) {
  try {
    return fs.readFileSync(file, 'utf8').split('\n').filter(function (l) { return l.length > 0; }).length;
  } catch (_e) {
    return 0;
  }
}

function _alive(pid) {
  if (pid === process.pid) return false; // this process owns no concurrent drain (drainRoom is synchronous)
  try { process.kill(pid, 0); return true; } catch (e) { return !(e && e.code === 'ESRCH'); }
}

let _lastStamp = 0;
function _claimPath(mdir) {
  const ms = Math.max(Date.now(), _lastStamp + 1);
  _lastStamp = ms;
  return path.join(mdir, 'part8-egress-telemetry.' + process.pid + '-' + ms + '.claim');
}

function _resolveBudget(o) {
  if (Number.isFinite(o.budgetMs) && o.budgetMs >= 0) return o.budgetMs;
  const env = Number(process.env.MINDRIAN_PART8_TELEMETRY_DRAIN_BUDGET_MS);
  return Number.isFinite(env) && env >= 0 ? env : DEFAULT_BUDGET_MS;
}

function _claim(mdir) {
  const claims = [];
  const fresh = _claimPath(mdir);
  try { fs.renameSync(path.join(mdir, QUEUE_BASENAME), fresh); claims.push(fresh); } catch (_e) { /* no queue */ }
  const now = Date.now();
  _list(mdir).sort().forEach(function (name) {
    const m = CLAIM_RE.exec(name);
    if (!m) return;
    const file = path.join(mdir, name);
    if (claims.indexOf(file) !== -1) return;
    let old = false;
    try { old = now - fs.statSync(file).mtimeMs > STALE_CLAIM_MS; } catch (_e) { return; }
    if (!old && _alive(Number(m[1]))) return;
    const mine = _claimPath(mdir);
    try { fs.renameSync(file, mine); claims.push(mine); } catch (_e) { /* another drain took it */ }
  });
  return claims;
}

function _reject(mdir, line) {
  try {
    const p = path.join(mdir, REJECTED_BASENAME);
    let size = 0;
    try { size = fs.statSync(p).size; } catch (_e) { size = 0; }
    if (size >= MAX_REJECTED_BYTES) return;
    fs.appendFileSync(p, line.slice(0, 4096) + '\n', { flag: 'a', mode: 0o600 });
  } catch (_e) { /* counted by the caller either way */ }
}

function _drain(roomDir, o, deadline) {
  const res = { room_db: 'ok', claimed: 0, landed: 0, rejected: 0, kept: 0, dropped: 0 };
  let db = null;
  let roomDb = null;
  try {
    if (typeof roomDir !== 'string' || roomDir.length === 0) { res.room_db = 'missing'; return res; }
    const mdir = _mdir(roomDir);
    const dbFile = path.join(mdir, 'room.db');
    res.dropped = _readState(mdir).dropped;
    const claims = _claim(mdir);
    const counts = claims.map(_lineCount);
    res.claimed = counts.reduce(function (a, b) { return a + b; }, 0);
    if (typeof o.onClaimed === 'function') { try { o.onClaimed(); } catch (_e) { /* test seam */ } }
    if (claims.length === 0) { res.room_db = fs.existsSync(dbFile) ? 'ok' : 'missing'; return res; }
    // Never call openRoomDb on a missing db: it would mint one.
    if (!fs.existsSync(dbFile)) { res.room_db = 'missing'; res.kept = res.claimed; return res; }
    try {
      fs.accessSync(dbFile, fs.constants.R_OK | fs.constants.W_OK);
      roomDb = require(ROOM_DB_PATH);
      db = roomDb.openRoomDb(roomDir);
      if (!db) throw new Error('no handle');
    } catch (_e) {
      res.room_db = 'open_failed'; res.kept = res.claimed; db = null; return res;
    }
    const ontology = require(ONTOLOGY_PATH);
    for (let c = 0; c < claims.length; c += 1) {
      let lines;
      try {
        lines = fs.readFileSync(claims[c], 'utf8').split('\n').filter(function (l) { return l.length > 0; });
      } catch (_e) {
        res.kept += counts[c];
        continue;
      }
      let k = 0;
      for (; k < lines.length; k += 1) {
        if (Date.now() > deadline) break;
        let rec = null;
        try { rec = JSON.parse(lines[k]); } catch (_e) { rec = null; }
        if (!rec || typeof rec !== 'object' || typeof rec.verdict !== 'string' ||
          !Object.prototype.hasOwnProperty.call(ontology.VERDICT_EVENT, rec.verdict)) {
          _reject(mdir, lines[k]);
          res.rejected += 1;
          continue;
        }
        ontology.record(db, {
          verdict: rec.verdict,
          class: rec.class,
          matched_pattern: rec.matched_pattern,
          count: 1,
          sessionId: rec.session_id,
          lexicon_scope: rec.lexicon_scope,
        });
        res.landed += 1;
      }
      if (k < lines.length) {
        // Budget stop: keep the rest of this claim and every claim not yet read.
        const rest = lines.slice(k);
        const next = _claimPath(mdir);
        const tmp = next + '.tmp';
        try {
          fs.writeFileSync(tmp, rest.join('\n') + '\n', { mode: 0o600 });
          fs.renameSync(tmp, next);
          fs.unlinkSync(claims[c]);
        } catch (_e) { /* the claim stays; at least once */ }
        res.kept += rest.length;
        for (let d = c + 1; d < claims.length; d += 1) res.kept += counts[d];
        break;
      }
      try { fs.unlinkSync(claims[c]); } catch (_e) { /* a repeat is allowed, a loss is not */ }
    }
    return res;
  } catch (_e) {
    return res;
  } finally {
    try { if (db && roomDb && roomDb.closeRoomDb) roomDb.closeRoomDb(db); } catch (_e) { /* ignore */ }
  }
}

/**
 * drainRoom(roomDir, opts) -> { room_db, claimed, landed, rejected, kept, dropped }. Never throws.
 * room_db: 'ok' | 'missing' | 'open_failed'. opts.budgetMs (default
 * MINDRIAN_PART8_TELEMETRY_DRAIN_BUDGET_MS, else 2000). opts.onClaimed: a test
 * seam called after the claim and before the db open.
 */
function drainRoom(roomDir, opts) {
  try {
    const o = (opts && typeof opts === 'object') ? opts : {};
    const deadline = Number.isFinite(o._deadline) ? o._deadline : Date.now() + _resolveBudget(o);
    return _drain(roomDir, o, deadline);
  } catch (_e) {
    return { room_db: 'open_failed', claimed: 0, landed: 0, rejected: 0, kept: 0, dropped: 0 };
  }
}

/**
 * drainRooms(roomDirs, opts) -> [{ roomDir, ...drainRoom result }]. Duplicate
 * paths are removed (path.resolve). One budget covers all rooms. Never throws.
 */
function drainRooms(roomDirs, opts) {
  try {
    const o = (opts && typeof opts === 'object') ? opts : {};
    const deadline = Date.now() + _resolveBudget(o);
    const seen = new Set();
    const out = [];
    (Array.isArray(roomDirs) ? roomDirs : []).forEach(function (d) {
      if (typeof d !== 'string' || d.length === 0) return;
      const abs = path.resolve(d);
      if (seen.has(abs)) return;
      seen.add(abs);
      out.push(Object.assign({ roomDir: abs }, drainRoom(abs, Object.assign({}, o, { _deadline: deadline }))));
    });
    return out;
  } catch (_e) {
    return [];
  }
}

/** pendingCount(roomDir) -> lines in the queue file plus all claim files. Never throws. */
function pendingCount(roomDir) {
  try {
    if (typeof roomDir !== 'string' || roomDir.length === 0) return 0;
    const mdir = _mdir(roomDir);
    let n = _lineCount(path.join(mdir, QUEUE_BASENAME));
    _list(mdir).forEach(function (name) { if (CLAIM_RE.test(name)) n += _lineCount(path.join(mdir, name)); });
    return n;
  } catch (_e) {
    return 0;
  }
}

/** hasPending(roomDir) -> true when a queue file or a claim file exists. Never throws. */
function hasPending(roomDir) {
  try {
    if (typeof roomDir !== 'string' || roomDir.length === 0) return false;
    const mdir = _mdir(roomDir);
    if (fs.existsSync(path.join(mdir, QUEUE_BASENAME))) return true;
    return _list(mdir).some(function (name) { return CLAIM_RE.test(name); });
  } catch (_e) {
    return false;
  }
}

/** droppedCount(roomDir) -> lines dropped at the cap so far. Never throws. */
function droppedCount(roomDir) {
  try { return _readState(_mdir(roomDir)).dropped; } catch (_e) { return 0; }
}

module.exports = {
  enqueue: enqueue,
  drainRoom: drainRoom,
  drainRooms: drainRooms,
  pendingCount: pendingCount,
  hasPending: hasPending,
  droppedCount: droppedCount,
  QUEUE_BASENAME: QUEUE_BASENAME,
  REJECTED_BASENAME: REJECTED_BASENAME,
  STATE_BASENAME: STATE_BASENAME,
  MAX_QUEUE_LINES: MAX_QUEUE_LINES,
  MAX_QUEUE_BYTES: MAX_QUEUE_BYTES,
};
