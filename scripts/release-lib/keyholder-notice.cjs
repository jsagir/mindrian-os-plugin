#!/usr/bin/env node
'use strict';
/*
 * scripts/release-lib/keyholder-notice.cjs
 *
 * WHAT: all the logic of release.sh Step 9.9, the key-holder announcement. On a cut it asks a person
 * "Send the key-holder announcement now?" (default No). On Yes, and only when the sender is
 * verified, it mails the key holders one note in batches. Every message has the sender in to and
 * in reply_to and the batch in bcc, so no recipient sees another.
 *
 * WHY (owner ruling 2026-10-02, owner decision 2026-10-07): key holders hear from us once, with
 * the news of the new version, one paragraph about M:OS, the article, the update and install
 * commands and an invitation to a one-to-one session. The mail text lives in the two files of
 * the keyholder-notice directory and is owned by the owner; this module only sends it.
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
const QUESTION = 'Send the key-holder announcement now?';
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

// ---------------------------------------------------------------------------
// Network helpers
// ---------------------------------------------------------------------------

const REAL_RESEND_BASE = 'https://api.resend.com';
const HTTP_TIMEOUT_MS = 15000;
const DRY_RUN_DEADLINE_MS = 12000;
const MAX_FAIL_STREAK = 5;

/** MOS_RESEND_API_BASE is honoured only for a loopback host. Otherwise the real base. */
function resendBase(env) {
  const v = env && env.MOS_RESEND_API_BASE;
  if (v) {
    try {
      const u = new URL(v);
      if ((u.protocol === 'http:' || u.protocol === 'https:') && (u.hostname === '127.0.0.1' || u.hostname === 'localhost')) {
        return (u.origin + u.pathname).replace(/\/+$/, '');
      }
    } catch (e) { /* fall through to the real base */ }
  }
  return REAL_RESEND_BASE;
}

/**
 * Build an http function. It never throws. It returns {status, json, retryAfter}.
 * A network error, a timeout or an abort gives status 0. Bodies are parsed and dropped, never kept.
 */
function makeHttp(fetchImpl, signal, timeoutMs) {
  const limit = timeoutMs || HTTP_TIMEOUT_MS;
  return async function http(url, init) {
    const ac = new AbortController();
    const timer = setTimeout(function () { ac.abort(); }, limit);
    const onAbort = function () { ac.abort(); };
    if (signal) {
      if (signal.aborted) ac.abort(); else signal.addEventListener('abort', onAbort, { once: true });
    }
    try {
      const res = await fetchImpl(url, Object.assign({}, init, { signal: ac.signal }));
      let text = '';
      try { text = await res.text(); } catch (e) { return { status: 0, json: null, retryAfter: null }; }
      let json = null;
      try { json = JSON.parse(text); } catch (e) { json = null; }
      let retryAfter = null;
      try { retryAfter = res.headers && res.headers.get ? res.headers.get('retry-after') : null; } catch (e) { retryAfter = null; }
      return { status: res.status, json, retryAfter };
    } catch (e) {
      return { status: 0, json: null, retryAfter: null };
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
    }
  };
}

function sleep(ms, signal) {
  return new Promise(function (resolve) {
    if (!(ms > 0)) return resolve();
    if (signal && signal.aborted) return resolve();
    const t = setTimeout(done, ms);
    function done() { clearTimeout(t); if (signal) signal.removeEventListener('abort', done); resolve(); }
    if (signal) signal.addEventListener('abort', done, { once: true });
    return undefined;
  });
}

function fromDomain(from) {
  const m = /<([^<>]+)>/.exec(String(from));
  const a = (m ? m[1] : String(from)).trim();
  const at = a.lastIndexOf('@');
  if (at < 1) return null;
  const dom = a.slice(at + 1).toLowerCase();
  if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(dom) || dom.indexOf('.') === -1) return null;
  return dom;
}

/**
 * The sender gate. A Yes needs RESEND_API_KEY and a From domain with status verified in the
 * Resend domains API. An unreachable API fails closed. Returns {ok, domain} or
 * {ok:false, reason:sender_unverified, detail, hint?}.
 */
async function checkSender(env, http) {
  function fail(detail, hint) { return { ok: false, reason: REASONS.sender_unverified, detail, hint: hint || null }; }
  const e = env || {};
  if (!e.RESEND_API_KEY) return fail('api_key_unset');
  if (!e.MOS_KEYHOLDER_NOTICE_FROM) return fail('from_unset');
  const dom = fromDomain(e.MOS_KEYHOLDER_NOTICE_FROM);
  if (!dom) return fail('from_invalid');
  const base = resendBase(e);
  let after = null;
  let listedUnverified = false;
  for (let page = 0; page < 5; page += 1) {
    const url = base + '/domains?limit=100' + (after ? '&after=' + encodeURIComponent(after) : '');
    const r = await http(url, { method: 'GET', headers: { Authorization: 'Bearer ' + e.RESEND_API_KEY } });
    if (r.status === 0) return fail('api_unreachable');
    if (r.status < 200 || r.status >= 300) {
      return fail('api_status_' + r.status, r.status === 401 || r.status === 403 ? 'the check needs a full-access Resend key' : null);
    }
    const data = r.json && Array.isArray(r.json.data) ? r.json.data : [];
    for (const d of data) {
      const name = String(d && d.name || '').toLowerCase();
      if (!name) continue;
      if (dom === name || dom.endsWith('.' + name)) {
        if (d.status === 'verified') return { ok: true, domain: name };
        listedUnverified = true;
      }
    }
    if (!(r.json && r.json.has_more) || data.length === 0) break;
    after = data[data.length - 1].id;
  }
  return fail(listedUnverified ? 'domain_not_verified' : 'domain_not_listed');
}

const ADDRESS_SHAPE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
function cleanAddress(v) {
  if (typeof v !== 'string') return null;
  const a = v.trim().toLowerCase();
  return ADDRESS_SHAPE.test(a) ? a : null;
}

/**
 * Read recipients live from Supabase, GET only. Key holders (brain_api_keys rows) are mailed.
 * Auth accounts resolve a missing address (by user_id) and are counted; an auth account with no
 * key row is counted and not mailed. Returns addresses in memory plus a counts object.
 */
async function loadRecipients(env, http) {
  const e = env || {};
  if (!e.SUPABASE_URL || !e.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, reason: REASONS.no_recipient_source, detail: 'env_unset' };
  const base = String(e.SUPABASE_URL).replace(/\/+$/, '');
  const headers = { apikey: e.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + e.SUPABASE_SERVICE_ROLE_KEY };
  const rows = [];
  for (let page = 0; page < 50; page += 1) {
    const off = page * 1000;
    const r = await http(base + '/rest/v1/brain_api_keys?select=email,user_id', {
      method: 'GET',
      headers: Object.assign({ 'Range-Unit': 'items', Range: off + '-' + (off + 999) }, headers),
    });
    if (r.status !== 200 && r.status !== 206) return { ok: false, reason: REASONS.no_recipient_source, detail: 'keys_status_' + r.status };
    const part = Array.isArray(r.json) ? r.json : [];
    for (const x of part) rows.push(x || {});
    if (part.length < 1000) break;
  }
  const users = [];
  for (let page = 1; page <= 50; page += 1) {
    const r = await http(base + '/auth/v1/admin/users?page=' + page + '&per_page=1000', { method: 'GET', headers });
    if (r.status !== 200) return { ok: false, reason: REASONS.no_recipient_source, detail: 'auth_status_' + r.status };
    const part = r.json && Array.isArray(r.json.users) ? r.json.users : [];
    for (const u of part) users.push(u || {});
    if (part.length < 1000) break;
  }
  const authById = new Map();
  for (const u of users) if (u.id) authById.set(u.id, cleanAddress(u.email));
  const set = new Set();
  const counts = { key_rows: rows.length, with_address: 0, via_auth: 0, no_address: 0, recipients: 0, auth_accounts: users.length, auth_only_excluded: 0 };
  const keyIds = new Set();
  for (const row of rows) {
    if (row.user_id) keyIds.add(row.user_id);
    const own = cleanAddress(row.email);
    if (own) { counts.with_address += 1; set.add(own); continue; }
    const viaAuth = row.user_id ? authById.get(row.user_id) : null;
    if (viaAuth) { counts.via_auth += 1; set.add(viaAuth); } else counts.no_address += 1;
  }
  for (const u of users) {
    const a = cleanAddress(u.email);
    if (!keyIds.has(u.id) && !(a && set.has(a))) counts.auth_only_excluded += 1;
  }
  counts.recipients = set.size;
  if (set.size === 0) return { ok: false, reason: REASONS.no_recipients, counts };
  return { ok: true, recipients: Array.from(set).sort(), counts };
}

function classify(status) {
  if (status >= 200 && status < 300) return 'accepted';
  if (status === 0 || status >= 500) return 'unknown';
  return 'failed';
}

/**
 * Largest number of recipients in one message. The Resend send-email reference
 * (https://resend.com/docs/api-reference/emails/send-email, read 2026-10-07) documents "Max 50" for
 * the to field and does not state a separate cap for bcc. Every message here has one address in
 * to (the sender), so 49 bcc recipients keep the to plus bcc total at 50 or below.
 */
const BATCH_MAX = 49;
/** Owner decision 2026-10-07: send in 5 bcc batches unless a batch would exceed BATCH_MAX. */
const BATCH_COUNT = 5;

/** The bare address inside a From value (angle brackets allowed). Lowercased. Null when invalid. */
function fromAddress(from) {
  const m = /<([^<>]+)>/.exec(String(from));
  const a = (m ? m[1] : String(from)).trim().toLowerCase();
  return ADDRESS_SHAPE.test(a) ? a : null;
}

/**
 * The batch plan for n recipients. Fewer than 5 recipients: one person per batch. Otherwise 5
 * batches of ceil(n / 5); when that exceeds BATCH_MAX, as many batches as needed so none does.
 * Returns {count, size} where size is the largest batch.
 */
function batchPlan(n) {
  if (!(n > 0)) return { count: 0, size: 0 };
  if (n < BATCH_COUNT) return { count: n, size: 1 };
  let count = BATCH_COUNT;
  if (Math.ceil(n / count) > BATCH_MAX) count = Math.ceil(n / BATCH_MAX);
  return { count, size: Math.ceil(n / count) };
}

/**
 * Split the list into batches. Deterministic: the same ordered list always gives the same batches,
 * so a retry rebuilds batches from the same unmarked members. The split is even (the first
 * n mod count batches get one more person). A forced size (a test seam) chunks in order instead and
 * never exceeds BATCH_MAX.
 */
function makeBatches(list, forcedSize) {
  const out = [];
  if (Number.isInteger(forcedSize) && forcedSize > 0) {
    const n = Math.min(BATCH_MAX, forcedSize);
    for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
    return out;
  }
  const plan = batchPlan(list.length);
  if (plan.count === 0) return out;
  const base = Math.floor(list.length / plan.count);
  const extra = list.length % plan.count;
  let at = 0;
  for (let i = 0; i < plan.count; i += 1) {
    const len = base + (i < extra ? 1 : 0);
    out.push(list.slice(at, at + len));
    at += len;
  }
  return out;
}

/**
 * Send the notice in batches. Each message has the sender address in to and in reply_to, and the
 * batch in bcc: no recipient address is ever in to or cc, and recipients never see each other.
 * recipients is the list still to be mailed. For each batch: write a pending marker for EVERY
 * member (a failed write stops the run before the POST), POST, then write the final state for every
 * member. An unknown result marks the whole batch unknown_outcome. The Idempotency-Key is a hash
 * of the sorted member markers. Returns {sent, failed, unknown, batches, stopped}; the three counts
 * are people.
 */
async function sendAll(recipients, notice, env, http, deps, ledger) {
  const d = deps || {};
  const out = { sent: 0, failed: 0, unknown: 0, batches: 0, stopped: null };
  const base = resendBase(env);
  const aborted = d.aborted || function () { return false; };
  const sender = fromAddress(env.MOS_KEYHOLDER_NOTICE_FROM);
  if (!sender) { out.stopped = REASONS.sender_unverified; return out; }
  const batches = makeBatches(recipients, d.batchSize);
  let streak = 0;
  for (let i = 0; i < batches.length; i += 1) {
    if (aborted()) { out.stopped = REASONS.interrupted; break; }
    const members = batches[i].map(function (address) { return { address, marker: markerFor(ledger.salt, address) }; });
    let pendingOk = true;
    for (const m of members) {
      if (!appendMarker(ledger.dir, m.marker, 'pending').ok) { pendingOk = false; break; }
    }
    if (!pendingOk) { out.stopped = REASONS.ledger_unwritable; break; }
    const sortedMarkers = members.map(function (m) { return m.marker; }).sort();
    const body = JSON.stringify({
      from: env.MOS_KEYHOLDER_NOTICE_FROM,
      to: [sender],
      reply_to: sender,
      headers: { 'List-Unsubscribe': '<mailto:' + sender + '?subject=stop>' },
      bcc: members.map(function (m) { return m.address; }),
      subject: notice.subject,
      text: notice.text,
      html: notice.html,
    });
    const headers = {
      Authorization: 'Bearer ' + env.RESEND_API_KEY,
      'Content-Type': 'application/json',
      'Idempotency-Key': notice.hash.slice(0, 12) + '-' + crypto.createHash('sha256').update(sortedMarkers.join(',')).digest('hex').slice(0, 32),
    };
    out.batches += 1;
    let res = await http(base + '/emails', { method: 'POST', headers, body });
    if (res.status === 429) {
      const wait = Math.min(10, Math.max(0, Number(res.retryAfter) || 0));
      await sleep(wait * 1000, d.signal);
      res = await http(base + '/emails', { method: 'POST', headers, body });
    }
    const cls = classify(res.status);
    if (cls === 'accepted') {
      if (typeof d.afterAccept === 'function') await d.afterAccept({ index: i, members: members.length });
      for (const m of members) {
        if (!appendMarker(ledger.dir, m.marker, 'sent').ok) { out.stopped = REASONS.ledger_unwritable; break; }
        out.sent += 1;
      }
      if (out.stopped) break;
      streak = 0;
      if (typeof d.afterSent === 'function') await d.afterSent({ index: i, members: members.length });
    } else {
      const state = cls === 'unknown' ? 'unknown_outcome' : 'failed';
      for (const m of members) {
        if (!appendMarker(ledger.dir, m.marker, state).ok) { out.stopped = REASONS.ledger_unwritable; break; }
        if (cls === 'unknown') out.unknown += 1; else out.failed += 1;
      }
      if (out.stopped) break;
      streak += 1;
      if (streak >= MAX_FAIL_STREAK) { out.stopped = REASONS.send_failed; break; }
    }
    if (aborted()) { out.stopped = REASONS.interrupted; break; }
    if (i + 1 < batches.length) await sleep(d.pace, d.signal);
  }
  return out;
}

// ---------------------------------------------------------------------------
// The step: prompt, gates, retry filter, send
// ---------------------------------------------------------------------------

function cleanVersion(v) {
  const s = String(v === undefined || v === null ? '' : v);
  return /^[0-9A-Za-z.+-]{1,64}$/.test(s) ? s : 'unknown';
}

function realAsk(question, signal) {
  return new Promise(function (resolve) {
    const rl = require('node:readline').createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let done = false;
    function finish(v) {
      if (done) return;
      done = true;
      if (signal) signal.removeEventListener('abort', onAbort);
      rl.close();
      resolve(v);
    }
    function onAbort() { finish(null); }
    if (signal) {
      if (signal.aborted) { finish(null); return; }
      signal.addEventListener('abort', onAbort, { once: true });
    }
    rl.on('close', function () { finish(null); });
    rl.question(question, function (a) { finish(a); });
  });
}

function normDeps(deps) {
  const d = deps || {};
  const env = d.env || process.env;
  const paceEnv = Number(env.MOS_KEYHOLDER_NOTICE_PACE_MS);
  const promptS = Number(env.MOS_KEYHOLDER_NOTICE_PROMPT_TIMEOUT_S);
  return {
    env,
    isTTY: d.isTTY === undefined ? process.stdin.isTTY === true : !!d.isTTY,
    ask: d.ask || realAsk,
    out: d.out || function (l) { process.stdout.write(l + '\n'); },
    err: d.err || function (l) { process.stderr.write(l + '\n'); },
    fetch: d.fetch || globalThis.fetch,
    homedir: d.homedir || os.homedir(),
    ledgerDir: d.ledgerDir || null,
    pace: d.pace !== undefined ? Number(d.pace) : (Number.isFinite(paceEnv) && env.MOS_KEYHOLDER_NOTICE_PACE_MS !== undefined && env.MOS_KEYHOLDER_NOTICE_PACE_MS !== '' ? paceEnv : 600),
    noticeDir: d.noticeDir || TEMPLATE_DIR,
    promptTimeoutMs: d.promptTimeoutMs !== undefined ? d.promptTimeoutMs : ((Number.isFinite(promptS) && promptS > 0 ? promptS : 300) * 1000),
    afterAccept: d.afterAccept,
    afterSent: d.afterSent,
    batchSize: d.batchSize,
    signal: d.signal || null,
    aborted: d.aborted || function () { return false; },
  };
}

function isCi(env) {
  const v = env.CI;
  return v !== undefined && v !== '' && v !== '0' && v !== 'false';
}

function ledgerStateOf(dir) {
  // Read only. Never takes the lock. Returns a one-line state for the step and the dry-run.
  const led = readLedger(dir);
  if (!led.ok) return { kind: 'unreadable' };
  if (led.corrupt_lines > 0) return { kind: 'corrupt', bad: led.corrupt_lines };
  const started = led.records.find(function (r) { return r.event === 'started'; });
  if (!started) return { kind: 'none' };
  const mk = readMarkers(dir);
  let sent = 0;
  let open = 0;
  if (mk.ok) {
    for (const st of mk.markers.values()) { if (st === 'sent') sent += 1; else if (st === 'pending' || st === 'unknown_outcome') open += 1; }
  }
  return { kind: 'started', at: String(started.at || '').slice(0, 10), sent, open, hash: String(started.notice_hash || '').slice(0, 8), version: String(started.release_version || 'unknown') };
}

function resultOf(reason, extra) {
  return Object.assign({ reason: reason || null, sent: 0, failed: 0, unknown: 0, to_send: 0, already_mailed: 0, unknown_skipped: 0 }, extra || {});
}

async function runStep(opts, deps) {
  const o = opts || {};
  const d = normDeps(deps);
  function say(line) { d.out(redact(line)); }
  function refuse(reason, hint, extra) {
    say('keyholder-notice: not sent' + (hint ? ': ' + hint : '') + ' reason=' + reason);
    return resultOf(reason, extra);
  }
  let dir = null;
  let held = false;
  try {
    if (o.optedOut) {
      say('key-holder notice: opt-out engaged (--no-keyholder-notice, audit-logged): the question was NOT asked on this cut, no notice was sent, and key holders hear nothing until a cut answers Yes.');
      return resultOf(REASONS.opted_out);
    }
    dir = d.ledgerDir || ledgerDir(d.env, d.homedir);
    const notice = loadNotice(d.noticeDir);
    if (!notice.ok) return refuse(REASONS.template_missing, notice.detail || null);
    if (o.includeUnknown && !o.resend) say('keyholder-notice: --include-unknown has no effect without --resend-keyholder-notice');
    const st = ledgerStateOf(dir);
    if (st.kind === 'started') {
      say('keyholder-notice: ledger: started ' + st.at + ', sent=' + st.sent + ', pending_or_unknown=' + st.open + ', notice=' + st.hash + ', release=' + st.version);
    }
    if (o.autoYes) return refuse(REASONS.auto_yes_refused, 'a person must answer the question');
    if (!d.isTTY || isCi(d.env)) return refuse(REASONS.no_tty, 'no terminal on stdin or CI is set, the answer is No');

    // The question. Default No. Only y or yes counts.
    const askAc = new AbortController();
    const onSig = function () { askAc.abort(); };
    if (d.signal) d.signal.addEventListener('abort', onSig, { once: true });
    const TIMEOUT = { timeout: true };
    let timer = null;
    let answer;
    try {
      const timeoutP = new Promise(function (resolve) { timer = setTimeout(function () { resolve(TIMEOUT); }, d.promptTimeoutMs); });
      answer = await Promise.race([Promise.resolve().then(function () { return d.ask(QUESTION + ' [y/N] ', askAc.signal); }), timeoutP]);
    } finally {
      clearTimeout(timer);
      askAc.abort();
      if (d.signal) d.signal.removeEventListener('abort', onSig);
    }
    if (d.aborted()) return refuse(REASONS.interrupted, 'a signal arrived');
    if (answer === TIMEOUT) return refuse(REASONS.prompt_timeout, 'no answer in time, the answer is No');
    if (!(typeof answer === 'string' && /^(y|yes)$/i.test(answer.trim()))) return refuse(REASONS.declined, 'the answer was No');

    // Yes. Take the lock first. A lock that is present, live or stale, refuses the run.
    const lk = acquireLedgerLock(dir);
    if (!lk.ok) {
      if (lk.reason === REASONS.ledger_locked) {
        const alive = lk.pid_alive === null ? 'unknown' : (lk.pid_alive ? 'yes' : 'no');
        return refuse(REASONS.ledger_locked, 'lock file ' + lk.path + ', pid ' + (lk.pid === null ? 'unknown' : lk.pid) + ', age ' + lk.age_s + ' s, pid alive: ' + alive + ', delete it by hand only after you confirm no run is active');
      }
      return refuse(lk.reason, lk.detail || null);
    }
    held = true;

    let led = readLedger(dir);
    if (!led.ok) return refuse(led.reason, 'ledger unreadable');
    if (led.corrupt_lines > 0) {
      if (!o.repair) {
        return refuse(REASONS.ledger_corrupt, led.corrupt_lines + ' bad line' + (led.corrupt_lines === 1 ? '' : 's') + ' in the ledger, pass --repair-keyholder-ledger to keep a quarantine copy and drop them');
      }
      const rep = repairLedger(dir);
      if (!rep.ok) return refuse(rep.reason, rep.detail || null);
      say('keyholder-notice: repair: quarantine copy kept (' + rep.quarantine + '), dropped ' + rep.dropped + ' line' + (rep.dropped === 1 ? '' : 's') + '; each dropped line can be a person mailed again');
      led = readLedger(dir);
    } else if (o.repair) {
      say('keyholder-notice: repair: no repair needed');
    }
    if (led.records.length > 0 && !led.records.some(function (r) { return r.event === 'salt'; })) {
      return refuse(REASONS.ledger_corrupt, 'the ledger has records and no salt');
    }
    const started = led.records.some(function (r) { return r.event === 'started'; });
    if (started && !o.resend) {
      return refuse(REASONS.already_sent, 'a send is on record, pass --resend-keyholder-notice to mail only people not yet mailed');
    }

    const http = makeHttp(d.fetch, d.signal);
    const sender = await checkSender(d.env, http);
    if (!sender.ok) {
      return refuse(REASONS.sender_unverified, 'sender check failed (' + sender.detail + ')' + (sender.hint ? ', ' + sender.hint : ''));
    }
    const rec = await loadRecipients(d.env, http);
    if (!rec.ok) return refuse(rec.reason, rec.detail || null);
    const c = rec.counts;
    say('keyholder-notice: recipients: key_rows=' + c.key_rows + ' with_address=' + c.with_address + ' via_auth=' + c.via_auth + ' no_address=' + c.no_address + ' recipients=' + c.recipients + ' auth_accounts=' + c.auth_accounts + ' auth_only_excluded=' + c.auth_only_excluded + ' batches=' + batchPlan(rec.recipients.length).count + ' batch_size=' + batchPlan(rec.recipients.length).size);

    const sl = ledgerSalt(dir);
    if (!sl.ok) return refuse(sl.reason, sl.detail || null);
    const mk = readMarkers(dir);
    if (!mk.ok) return refuse(mk.reason, mk.detail || null);
    const todo = [];
    let alreadyMailed = 0;
    let unknownSkipped = 0;
    for (const a of rec.recipients) {
      const state = mk.markers.get(markerFor(sl.salt, a));
      if (state === 'sent') { alreadyMailed += 1; continue; }
      if ((state === 'pending' || state === 'unknown_outcome') && !o.includeUnknown) { unknownSkipped += 1; continue; }
      todo.push(a);
    }
    say('keyholder-notice: already_mailed=' + alreadyMailed + ' unknown_skipped=' + unknownSkipped + ' to_send=' + todo.length + ' batches=' + makeBatches(todo, d.batchSize).length + ' batch_size=' + (d.batchSize ? Math.min(BATCH_MAX, d.batchSize) : batchPlan(todo.length).size));
    const stats = { to_send: todo.length, already_mailed: alreadyMailed, unknown_skipped: unknownSkipped };
    if (todo.length === 0) return refuse(REASONS.nothing_to_send, 'every recipient is already mailed or held back', stats);

    const sw = appendLedger(dir, { event: 'started', recipients: todo.length, notice_hash: notice.hash, release_version: cleanVersion(o.releaseVersion), override: !!o.resend });
    if (!sw.ok) return refuse(REASONS.ledger_unwritable, 'could not write the started record', stats);

    const r = await sendAll(todo, notice, d.env, http, d, { dir, salt: sl.salt });
    if (r.stopped !== REASONS.ledger_unwritable) {
      appendLedger(dir, { event: 'finished', recipients: todo.length, sent: r.sent, failed: r.failed, unknown: r.unknown });
    }
    say('keyholder-notice: done sent=' + r.sent + ' failed=' + r.failed + ' unknown=' + r.unknown);
    if (r.stopped) return refuse(r.stopped, 'the run stopped early', Object.assign({ sent: r.sent, failed: r.failed, unknown: r.unknown }, stats));
    return resultOf(null, Object.assign({ sent: r.sent, failed: r.failed, unknown: r.unknown }, stats));
  } catch (e) {
    say('keyholder-notice: crash: ' + String(e && e.message ? e.message : e).slice(0, 120) + ' reason=' + REASONS.crash);
    return resultOf(REASONS.crash);
  } finally {
    if (held) releaseLedgerLock(dir);
  }
}

/** The preview for release.sh --dry-run. State tokens and counts only. Sends nothing. */
async function dryRun(opts, deps) {
  const o = opts || {};
  const d = normDeps(deps);
  function say(line) { d.out(redact(line)); }
  const ac = new AbortController();
  const timer = setTimeout(function () { ac.abort(); }, DRY_RUN_DEADLINE_MS);
  const onSig = function () { ac.abort(); };
  if (d.signal) d.signal.addEventListener('abort', onSig, { once: true });
  try {
    say('keyholder-notice: step 9.9 key-holder announcement (dry run)');
    if (o.optedOut) {
      say('keyholder-notice: opt-out: engaged (--no-keyholder-notice), Step 9.9 will not ask');
      say('keyholder-notice: nothing is sent in a dry run');
      return resultOf(REASONS.opted_out);
    }
    say('keyholder-notice: opt-out: not engaged');
    const http = makeHttp(d.fetch, ac.signal);
    const sender = await checkSender(d.env, http);
    say('keyholder-notice: sender check: ' + (sender.ok ? 'PASSED' : 'REFUSED (' + sender.detail + ')'));
    const rec = await loadRecipients(d.env, http);
    if (rec.ok) {
      const c = rec.counts;
      say('keyholder-notice: recipients: key_rows=' + c.key_rows + ' with_address=' + c.with_address + ' via_auth=' + c.via_auth + ' no_address=' + c.no_address + ' recipients=' + c.recipients + ' auth_accounts=' + c.auth_accounts + ' auth_only_excluded=' + c.auth_only_excluded + ' batches=' + batchPlan(rec.recipients.length).count + ' batch_size=' + batchPlan(rec.recipients.length).size);
    } else {
      say('keyholder-notice: recipients: unavailable (' + rec.reason + ')');
    }
    const dir = d.ledgerDir || ledgerDir(d.env, d.homedir);
    let state;
    if (fs.existsSync(path.join(dir, LOCK_FILE))) state = 'locked';
    else {
      const st = ledgerStateOf(dir);
      if (st.kind === 'corrupt') state = 'corrupt (' + st.bad + ' bad line' + (st.bad === 1 ? '' : 's') + ')';
      else if (st.kind === 'started') state = 'started ' + st.at + ', sent=' + st.sent + ', pending_or_unknown=' + st.open;
      else if (st.kind === 'unreadable') state = 'unreadable';
      else state = 'no prior send';
    }
    say('keyholder-notice: ledger: ' + state);
    say('keyholder-notice: nothing is sent in a dry run');
    return resultOf(null);
  } catch (e) {
    say('keyholder-notice: crash: ' + String(e && e.message ? e.message : e).slice(0, 120) + ' reason=' + REASONS.crash);
    return resultOf(REASONS.crash);
  } finally {
    clearTimeout(timer);
    if (d.signal) d.signal.removeEventListener('abort', onSig);
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const USAGE = 'usage: keyholder-notice.cjs <run|dry-run|help> [--release-version V] [--resend] [--include-unknown] [--repair-keyholder-ledger] [--opted-out] [--dry-run]';
const AUTO_YES = ['--yes', '--yes-all', '-y', '--assume-yes'];

function parseArgs(argv) {
  const args = Array.isArray(argv) ? argv : [];
  const sub = args[0];
  const opts = { releaseVersion: 'unknown', resend: false, includeUnknown: false, repair: false, optedOut: false, dryRun: false, autoYes: false };
  if (sub === undefined || sub === 'help' || sub === '--help' || sub === '-h') return { sub: 'help', opts };
  if (sub !== 'run' && sub !== 'dry-run') return { error: 'unknown subcommand' };
  for (let i = 1; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--release-version') {
      const v = args[i + 1];
      if (v === undefined || v.indexOf('--') === 0) return { error: 'missing value for --release-version' };
      opts.releaseVersion = v;
      i += 1;
    } else if (a === '--resend') opts.resend = true;
    else if (a === '--include-unknown') opts.includeUnknown = true;
    else if (a === '--repair-keyholder-ledger') opts.repair = true;
    else if (a === '--opted-out') opts.optedOut = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (AUTO_YES.indexOf(a) !== -1) opts.autoYes = true;
    else return { error: 'unknown argument' };
  }
  return { sub, opts };
}

/**
 * Entry point. Sets process.exitCode and returns. Never calls process.exit.
 * Exit code 0 for run and dry-run in every case (the cut is never aborted), 2 for bad input,
 * 130 or 143 after SIGINT or SIGTERM. A signal aborts the work, the run releases the lock it
 * created, and main returns.
 */
async function main(argv, over) {
  const d = normDeps(over);
  const parsed = parseArgs(argv);
  if (parsed.error) {
    d.err(redact('keyholder-notice: ' + parsed.error));
    d.err(USAGE);
    process.exitCode = 2;
    return;
  }
  if (parsed.sub === 'help') {
    d.out(USAGE);
    process.exitCode = 0;
    return;
  }
  const opts = parsed.opts;
  const isDry = parsed.sub === 'dry-run' || opts.dryRun;
  let signalled = null;
  const ac = new AbortController();
  const handlers = [];
  if (!isDry) {
    for (const sig of ['SIGINT', 'SIGTERM']) {
      const h = function () {
        if (signalled) {
          // Second signal: release what this run created, drop the handlers, then let the default action run.
          releaseAllHeldLocks();
          for (const x of handlers) process.removeListener(x.sig, x.fn);
          try { process.kill(process.pid, sig); } catch (e) { /* ignore */ }
          return;
        }
        signalled = sig;
        process.exitCode = sig === 'SIGINT' ? 130 : 143;
        ac.abort();
      };
      handlers.push({ sig, fn: h });
      process.on(sig, h);
    }
  }
  const run = Object.assign({}, d, { signal: ac.signal, aborted: function () { return signalled !== null; } });
  try {
    if (isDry) await dryRun(opts, run); else await runStep(opts, run);
  } catch (e) {
    d.out(redact('keyholder-notice: crash: ' + String(e && e.message ? e.message : e).slice(0, 120) + ' reason=' + REASONS.crash));
  } finally {
    for (const x of handlers) process.removeListener(x.sig, x.fn);
    releaseAllHeldLocks();
  }
  if (signalled === null) process.exitCode = 0;
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
  resendBase,
  makeHttp,
  BATCH_MAX,
  BATCH_COUNT,
  batchPlan,
  fromAddress,
  makeBatches,
  checkSender,
  loadRecipients,
  sendAll,
  runStep,
  dryRun,
  main,
};

if (require.main === module) {
  main(process.argv.slice(2));
}
