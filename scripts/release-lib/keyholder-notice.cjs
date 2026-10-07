#!/usr/bin/env node
'use strict';
/*
 * scripts/release-lib/keyholder-notice.cjs
 *
 * WHAT: all the logic of release.sh Step 9.9, the key-holder service notice. On a cut it asks a
 * person "Send the key-holder service notice now?" (default No). On Yes, and only when the
 * sender is verified, it mails each key holder one service note, one person per mail.
 *
 * WHY (owner ruling 2026-10-02, owner decision 2026-10-07): the old keys are dead. Each holder
 * needs one honest note: old key retired, Theo needs no key, five-step install, tick the box on
 * the home page for the letter, plus the update commands and one article link. The notice is not
 * a newsletter and not a release announcement.
 *
 * ENV (process environment only, no file fallback):
 *   RESEND_API_KEY                 Resend API key. It needs full access: the sender check reads the domains list.
 *   MOS_KEYHOLDER_NOTICE_FROM      the From value. Its domain must be verified in Resend.
 *   SUPABASE_URL                   project URL (recipients are read live, GET only)
 *   SUPABASE_SERVICE_ROLE_KEY      service key for the read
 *   MOS_RESEND_API_BASE            honoured only when its host is loopback (test seam)
 *   MOS_KEYHOLDER_NOTICE_PACE_MS   pause between mails, default 600
 *   MOS_KEYHOLDER_NOTICE_PROMPT_TIMEOUT_S   prompt timeout, default 300
 *   MINDRIAN_KEYHOLDER_NOTICE_LEDGER_DIR    ledger dir override (test seam)
 *
 * LEDGER: $HOME/.mindrian/release-keyholder-notice/ledger.jsonl (mode 0600, dir 0700, outside git).
 * JSON lines. Events: salt (written once), started, marker, finished. A marker is the HMAC-SHA256
 * of the lowercased address keyed with the per-ledger salt, with a state: pending (written BEFORE the
 * POST), then sent, unknown_outcome or failed. The ledger never holds an address and never holds a
 * plain hash of an address. Each record is one atomic append (one writeSync, then fsync).
 * ledger.lock (O_EXCL) stops two runs from overlapping. A present lock, live or stale, refuses
 * the run; the module never removes a lock it did not create.
 *
 * PRIVACY: nothing prints an address. Every printed line goes through redact(). Error bodies,
 * headers and env values are never printed, only status numbers and typed reasons.
 *
 * FAIL OPEN: the module never calls process.exit. main() sets process.exitCode and returns.
 * Hyphens only, no em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const TEMPLATE_DIR = path.join(__dirname, 'keyholder-notice');
const QUESTION = 'Send the key-holder service notice now?';
const LEDGER_FILE = 'ledger.jsonl';
const LOCK_FILE = 'ledger.lock';

const REASONS = Object.freeze({
  declined: 'declined',
  no_tty: 'no_tty',
  opted_out: 'opted_out',
  already_sent: 'already_sent',
  sender_unverified: 'sender_unverified',
  no_recipient_source: 'no_recipient_source',
  no_recipients: 'no_recipients',
  nothing_to_send: 'nothing_to_send',
  template_missing: 'template_missing',
  ledger_unwritable: 'ledger_unwritable',
  ledger_corrupt: 'ledger_corrupt',
  ledger_locked: 'ledger_locked',
  send_failed: 'send_failed',
  prompt_timeout: 'prompt_timeout',
  auto_yes_refused: 'auto_yes_refused',
  crash: 'crash',
  interrupted: 'interrupted',
});

const EVENTS = ['salt', 'started', 'marker', 'finished'];
const STATES = ['pending', 'sent', 'unknown_outcome', 'failed'];
const RECORD_KEYS = ['v', 'event', 'at', 'salt', 'recipients', 'sent', 'failed', 'unknown', 'notice_hash',
  'release_version', 'override', 'm', 'state'];
const HEX64 = /^[0-9a-f]{64}$/;
const MAX_RECORD_BYTES = 4096;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Replace every email-like substring with the word address in angle brackets. */
function redact(text) {
  return String(text).replace(/[^\s<>"'(),;:]+@[^\s<>"'(),;:]+/g, '<address>');
}

/** sha256 hex over the three parts with a fixed separator. */
function noticeHash(subject, text, html) {
  const SEP = '\n--8<--\n';
  return crypto.createHash('sha256').update(String(subject) + SEP + String(text) + SEP + String(html)).digest('hex');
}

/** Read both template files. Returns {ok, subject, text, html, hash} or {ok:false, reason:template_missing}. */
function loadNotice(dir) {
  const d = dir || TEMPLATE_DIR;
  try {
    const raw = fs.readFileSync(path.join(d, 'notice.txt'), 'utf8');
    const html = fs.readFileSync(path.join(d, 'notice.html'), 'utf8');
    const first = raw.split('\n')[0];
    const m = /^Subject:\s*(.+)$/.exec(first);
    const cut = raw.indexOf('\n\n');
    if (!m || cut === -1) return { ok: false, reason: REASONS.template_missing, detail: 'subject_missing' };
    const subject = m[1].trim();
    const text = raw.slice(cut + 2);
    return { ok: true, subject, text, html, hash: noticeHash(subject, text, html) };
  } catch (e) {
    return { ok: false, reason: REASONS.template_missing, detail: 'read_failed' };
  }
}

function ledgerDir(env, homedir) {
  const e = env || {};
  if (e.MINDRIAN_KEYHOLDER_NOTICE_LEDGER_DIR) return e.MINDRIAN_KEYHOLDER_NOTICE_LEDGER_DIR;
  return path.join(homedir || os.homedir(), '.mindrian', 'release-keyholder-notice');
}

function utcNow() { return new Date().toISOString(); }

// ---------------------------------------------------------------------------
// Ledger: read, validate, append
// ---------------------------------------------------------------------------

function isValidRecord(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return false;
  if (r.v !== 1 || EVENTS.indexOf(r.event) === -1) return false;
  for (const k of Object.keys(r)) if (RECORD_KEYS.indexOf(k) === -1) return false;
  if (r.event === 'salt') return typeof r.salt === 'string' && HEX64.test(r.salt);
  if (r.event === 'marker') return typeof r.m === 'string' && HEX64.test(r.m) && STATES.indexOf(r.state) !== -1;
  return true;
}

/**
 * Read the ledger. Never throws.
 * Returns {ok, exists, records, lines, corrupt_lines}. A line is corrupt when it is not a valid
 * record with a known event. A last line with no newline is corrupt (a cut write). Empty lines are not.
 */
function readLedger(dir) {
  const file = path.join(dir, LEDGER_FILE);
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    if (e && e.code === 'ENOENT') return { ok: true, exists: false, records: [], lines: [], corrupt_lines: 0 };
    return { ok: false, exists: false, reason: REASONS.ledger_unwritable, records: [], lines: [], corrupt_lines: 0 };
  }
  const parts = raw.split('\n');
  const tail = parts.pop(); // text after the last newline: empty when the file ends cleanly
  const records = [];
  const lines = [];
  let corrupt = 0;
  for (const line of parts) {
    if (line.trim() === '') continue;
    let rec = null;
    try { rec = JSON.parse(line); } catch (e) { rec = null; }
    if (isValidRecord(rec)) { records.push(rec); lines.push(line); } else corrupt += 1;
  }
  if (tail.trim() !== '') corrupt += 1;
  return { ok: true, exists: true, records, lines, corrupt_lines: corrupt };
}

/**
 * Append one record. One fs.writeSync call on a descriptor opened for append, one JSON line under
 * 4096 bytes ending in a newline, then fsync. Never throws. Returns {ok} or {ok:false, reason}.
 */
function appendLedger(dir, record) {
  let fd = null;
  try {
    const rec = { v: 1 };
    const src = record || {};
    for (const k of RECORD_KEYS) {
      if (k === 'v') continue;
      if (src[k] !== undefined) rec[k] = src[k];
    }
    if (rec.at === undefined) rec.at = utcNow();
    if (EVENTS.indexOf(rec.event) === -1) return { ok: false, reason: REASONS.ledger_unwritable, detail: 'bad_event' };
    const buf = Buffer.from(JSON.stringify(rec) + '\n', 'utf8');
    if (buf.length >= MAX_RECORD_BYTES) return { ok: false, reason: REASONS.ledger_unwritable, detail: 'record_too_big' };
    let created = false;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      created = true;
    }
    if (!fs.statSync(dir).isDirectory()) return { ok: false, reason: REASONS.ledger_unwritable, detail: 'not_a_dir' };
    if (created && process.platform !== 'win32') { try { fs.chmodSync(dir, 0o700); } catch (e) { /* best effort */ } }
    fd = fs.openSync(path.join(dir, LEDGER_FILE), 'a', 0o600);
    if (process.platform !== 'win32') { try { fs.fchmodSync(fd, 0o600); } catch (e) { /* best effort */ } }
    const n = fs.writeSync(fd, buf);
    if (n !== buf.length) return { ok: false, reason: REASONS.ledger_unwritable, detail: 'short_write' };
    fs.fsyncSync(fd);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: REASONS.ledger_unwritable, detail: 'io_error' };
  } finally {
    if (fd !== null) { try { fs.closeSync(fd); } catch (e) { /* ignore */ } }
  }
}

/**
 * The per-ledger salt. Creates it on the first write. Returns {ok, salt} or {ok:false, reason, detail}.
 * Refuses when the ledger has corrupt lines, or has records but no readable salt.
 */
function ledgerSalt(dir) {
  const led = readLedger(dir);
  if (!led.ok) return { ok: false, reason: led.reason };
  if (led.corrupt_lines > 0) return { ok: false, reason: REASONS.ledger_corrupt, detail: 'corrupt_lines' };
  const rec = led.records.find(function (r) { return r.event === 'salt'; });
  if (rec) return { ok: true, salt: rec.salt };
  if (led.records.length > 0) return { ok: false, reason: REASONS.ledger_corrupt, detail: 'salt_missing' };
  const salt = crypto.randomBytes(32).toString('hex');
  const w = appendLedger(dir, { event: 'salt', salt });
  if (!w.ok) return { ok: false, reason: w.reason };
  return { ok: true, salt };
}

/** HMAC-SHA256 of the trimmed lowercased address, keyed with the salt. */
function markerFor(salt, address) {
  return crypto.createHmac('sha256', String(salt)).update(String(address).trim().toLowerCase()).digest('hex');
}

function appendMarker(dir, marker, state) {
  if (STATES.indexOf(state) === -1 || !HEX64.test(String(marker))) {
    return { ok: false, reason: REASONS.ledger_unwritable, detail: 'bad_marker' };
  }
  return appendLedger(dir, { event: 'marker', m: marker, state });
}

/** Map of marker to state. sent wins over every other state; otherwise the latest record wins. */
function readMarkers(dir) {
  const led = readLedger(dir);
  if (!led.ok) return { ok: false, reason: led.reason };
  if (led.corrupt_lines > 0) return { ok: false, reason: REASONS.ledger_corrupt, detail: 'corrupt_lines' };
  const markers = new Map();
  for (const r of led.records) {
    if (r.event !== 'marker') continue;
    if (markers.get(r.m) === 'sent') continue;
    markers.set(r.m, r.state);
  }
  return { ok: true, markers };
}

function stampForFile(d) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.(\d+)Z$/, '$1Z');
}

/**
 * Quarantine copy, then rewrite with the valid records only (temp file, then rename).
 * Returns {ok, dropped, repaired, quarantine}. Never creates a salt: with no readable salt it refuses.
 */
function repairLedger(dir) {
  const led = readLedger(dir);
  if (!led.ok) return { ok: false, reason: led.reason };
  if (led.corrupt_lines === 0) return { ok: true, dropped: 0, repaired: false };
  if (!led.records.some(function (r) { return r.event === 'salt'; })) {
    return { ok: false, reason: REASONS.ledger_corrupt, detail: 'salt_missing' };
  }
  try {
    const file = path.join(dir, LEDGER_FILE);
    let qname = 'ledger.corrupt-' + stampForFile(new Date());
    let n = 0;
    while (fs.existsSync(path.join(dir, qname))) { n += 1; qname = 'ledger.corrupt-' + stampForFile(new Date()) + '-' + n; }
    const qpath = path.join(dir, qname);
    fs.copyFileSync(file, qpath);
    if (process.platform !== 'win32') fs.chmodSync(qpath, 0o600);
    const tmp = path.join(dir, LEDGER_FILE + '.tmp-' + process.pid);
    const fd = fs.openSync(tmp, 'w', 0o600);
    try {
      fs.writeFileSync(fd, led.lines.join('\n') + '\n');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, file);
    return { ok: true, dropped: led.corrupt_lines, repaired: true, quarantine: qname };
  } catch (e) {
    return { ok: false, reason: REASONS.ledger_unwritable, detail: 'repair_io_error' };
  }
}

// ---------------------------------------------------------------------------
// Lock: ledger.lock, O_EXCL, never removed unless this process created it
// ---------------------------------------------------------------------------

const HELD_LOCKS = new Set();

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return !!(e && e.code === 'EPERM'); }
}

function acquireLedgerLock(dir) {
  const lockPath = path.join(dir, LOCK_FILE);
  let fd = null;
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      if (process.platform !== 'win32') { try { fs.chmodSync(dir, 0o700); } catch (e) { /* best effort */ } }
    }
    if (!fs.statSync(dir).isDirectory()) return { ok: false, reason: REASONS.ledger_unwritable, detail: 'not_a_dir' };
    try {
      fd = fs.openSync(lockPath, 'wx', 0o600);
    } catch (e) {
      if (e && e.code === 'EEXIST') {
        let pid = null;
        let ageS = null;
        try {
          const j = JSON.parse(fs.readFileSync(lockPath, 'utf8').trim());
          if (j && Number.isInteger(j.pid)) pid = j.pid;
          const t = Date.parse(j && j.at);
          if (!isNaN(t)) ageS = Math.max(0, Math.round((Date.now() - t) / 1000));
        } catch (e2) { /* unreadable lock: pid stays null */ }
        if (ageS === null) {
          try { ageS = Math.max(0, Math.round((Date.now() - fs.statSync(lockPath).mtimeMs) / 1000)); } catch (e3) { ageS = 0; }
        }
        return { ok: false, reason: REASONS.ledger_locked, path: lockPath, pid, age_s: ageS, pid_alive: pid === null ? null : pidAlive(pid) };
      }
      return { ok: false, reason: REASONS.ledger_unwritable, detail: 'lock_open_failed' };
    }
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, at: utcNow() }) + '\n');
    HELD_LOCKS.add(dir);
    return { ok: true, path: lockPath };
  } catch (e) {
    return { ok: false, reason: REASONS.ledger_unwritable, detail: 'lock_io_error' };
  } finally {
    if (fd !== null) { try { fs.closeSync(fd); } catch (e) { /* ignore */ } }
  }
}

/** Remove the lock only when this process created it here and the pid in the file is this pid. */
function releaseLedgerLock(dir) {
  const lockPath = path.join(dir, LOCK_FILE);
  if (!HELD_LOCKS.has(dir)) return { ok: true, released: false };
  try {
    const j = JSON.parse(fs.readFileSync(lockPath, 'utf8').trim());
    if (!j || j.pid !== process.pid) { HELD_LOCKS.delete(dir); return { ok: true, released: false }; }
    fs.unlinkSync(lockPath);
    HELD_LOCKS.delete(dir);
    return { ok: true, released: true };
  } catch (e) {
    if (e && e.code === 'ENOENT') HELD_LOCKS.delete(dir);
    return { ok: true, released: false };
  }
}

/** Release every lock this process created. Used by the signal path and the end of main(). */
function releaseAllHeldLocks() {
  for (const dir of Array.from(HELD_LOCKS)) releaseLedgerLock(dir);
}

module.exports = {
  REASONS,
  QUESTION,
  EVENTS,
  STATES,
  LEDGER_FILE,
  LOCK_FILE,
  TEMPLATE_DIR,
  loadNotice,
  noticeHash,
  redact,
  ledgerDir,
  ledgerSalt,
  markerFor,
  readMarkers,
  appendMarker,
  readLedger,
  appendLedger,
  repairLedger,
  acquireLedgerLock,
  releaseLedgerLock,
  releaseAllHeldLocks,
  pidAlive,
};
