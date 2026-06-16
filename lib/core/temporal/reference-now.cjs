'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 160-01 Task 1 -- getReferenceNow(): one authoritative reference clock.
 * ===========================================================================
 *
 * R1 (160-SPEC.md). getReferenceNow() is a PRECEDENCE LADDER (D-01b):
 *
 *   1. injected Claude Code `currentDate` wins for the calendar DATE (free, no
 *      network). The time-of-day is blended from any available seam offset so
 *      the date is correct without inventing a wall-clock time.
 *   2. an OPTIONAL online time-fetch clock-skew corrector -- NTP-style: fetch
 *      ONCE per session, compute offset = authoritativeMs - Date.now(), persist
 *      the offset to the seam, then `localclock + offset`. getReferenceNow
 *      itself makes NO network call; it consumes a cached offset only. The
 *      online rung degrades silently offline (returns null, no throw).
 *   3. a raw `Date.now()` floor.
 *
 * Hybrid capture (D-01): a SessionStart hook seeds ~/.mindrian/reference-now.json
 * with a Date.now() floor; Larry corrects the seam via a tiny command when the
 * model-known `currentDate` diverges. The reader routes through the existing
 * options.now clock seam (D-01a): getReferenceNow returns a plain millisecond
 * integer directly usable as the value an `options.now` closure would yield.
 *
 * Part 8 (LOCAL -> BRAIN: NO). The seam is a LOCAL file; it never leaves the
 * machine. The ONLY network surface (fetchTimeOffsetOnce) is a bare GET that
 * reads ONLY the HTTP `Date` response header -- it sends NO body, NO query
 * params, and NO user-derived headers. Zero user bytes egress. SIGNAL -> LOCAL.
 *
 * House rule: hyphens only, no em-dashes. Pure CJS, node built-ins only, zero
 * new runtime dependencies (native fetch). Reuses isoSecond from the Feynman
 * timeline-renderer rather than re-implementing ISO rendering.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Reuse the existing ISO renderer (Canon Part 7) rather than re-implementing it.
const { isoSecond } = require('../feynman/timeline-renderer.cjs');

// The default LOCAL seam path. ~/.mindrian/reference-now.json.
const DEFAULT_SEAM_PATH = path.join(os.homedir(), '.mindrian', 'reference-now.json');

// A bare, keyless public time endpoint. The HTTP Date response header is the
// authoritative-time source -- no API key, no JSON body, no user bytes.
const DEFAULT_TIME_ENDPOINT = 'https://www.google.com/generate_204';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ---------- internal helpers ----------

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

// Strict YYYY-MM-DD validation that rejects impossible dates (e.g. 2026-13-99).
// Returns the UTC-midnight epoch ms for the calendar date, or null.
function parseCurrentDateToUtcMidnight(currentDateStr) {
  if (typeof currentDateStr !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(currentDateStr.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]); // 1-12
  const day = Number(m[3]);   // 1-31
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  const ms = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  if (!Number.isFinite(ms)) return null;
  // Round-trip guard: reject overflow dates (e.g. 2026-02-31 -> Mar 3).
  const d = new Date(ms);
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return ms;
}

// ---------- seam read / write (LOCAL only) ----------

/*
 * readSeam(seamPath) -> the parsed seam object, or null on missing/malformed.
 * Never throws. Validates basic shape (numeric floorMs/offsetMs when present).
 * Seam shape: { floorMs, offsetMs, lastFetchSession, source, updatedAt }.
 */
function readSeam(seamPath) {
  const p = typeof seamPath === 'string' && seamPath ? seamPath : DEFAULT_SEAM_PATH;
  try {
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, 'utf8');
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
    // Coerce/validate numeric fields; tolerate absent ones.
    if (obj.floorMs != null && !isFiniteNumber(obj.floorMs)) return null;
    if (obj.offsetMs != null && !isFiniteNumber(obj.offsetMs)) return null;
    return obj;
  } catch (_err) {
    // Malformed JSON, permission error, etc. Degrade to null (T-160-02).
    return null;
  }
}

/*
 * writeSeam(seamPath, partial) -> { ok, reason? }. Merges `partial` over any
 * existing seam, stamps updatedAt (ISO seconds), and writes atomically-ish.
 * Never throws; returns { ok: false, reason } on failure.
 */
function writeSeam(seamPath, partial) {
  const p = typeof seamPath === 'string' && seamPath ? seamPath : DEFAULT_SEAM_PATH;
  const patch = partial && typeof partial === 'object' && !Array.isArray(partial) ? partial : {};
  try {
    const existing = readSeam(p) || {};
    const merged = Object.assign({}, existing, patch);
    merged.updatedAt = isoSecond(Date.now());
    const dir = path.dirname(p);
    try { fs.mkdirSync(dir, { recursive: true }); } catch (_e) { /* tolerant */ }
    const tmp = p + '.tmp-' + process.pid;
    fs.writeFileSync(tmp, JSON.stringify(merged, null, 2), 'utf8');
    fs.renameSync(tmp, p);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err && err.message ? err.message : String(err) };
  }
}

// ---------- applyCurrentDate ----------

/*
 * applyCurrentDate(currentDateStr, baseMs) -> epoch ms landing on the
 * currentDate calendar DATE, carrying baseMs's time-of-day so a downstream
 * delta keeps sub-day granularity. Returns null on a malformed date string.
 *
 * Per D-01b currentDate wins the DATE; the time-of-day is whatever the caller
 * supplies (the seam-blended local clock), never invented.
 */
function applyCurrentDate(currentDateStr, baseMs) {
  const dateMidnight = parseCurrentDateToUtcMidnight(currentDateStr);
  if (dateMidnight == null) return null;
  // Time-of-day fraction within the day from baseMs (UTC). Falls back to 0.
  let todMs = 0;
  if (isFiniteNumber(baseMs)) {
    const r = baseMs % MS_PER_DAY;
    todMs = r >= 0 ? r : r + MS_PER_DAY; // normalize negative epoch (pre-1970) safely
  }
  const result = dateMidnight + todMs;
  // Guard: the blended time-of-day must not roll the calendar date forward.
  const d = new Date(result);
  const dm = new Date(dateMidnight);
  if (d.getUTCFullYear() !== dm.getUTCFullYear() ||
      d.getUTCMonth() !== dm.getUTCMonth() ||
      d.getUTCDate() !== dm.getUTCDate()) {
    return dateMidnight; // clamp to midnight rather than spill into the next day
  }
  return result;
}

// ---------- fetchTimeOffsetOnce (the OPTIONAL online skew corrector) ----------

/*
 * fetchTimeOffsetOnce(opts) -> Promise<number|null>.
 *
 * Performs AT MOST ONE bare GET per session to a public time endpoint, reads
 * ONLY the HTTP `Date` response header, computes offset = authoritativeMs -
 * localNowMs, persists the offset to the seam, and returns the offset. On ANY
 * network or parse failure it returns null silently (degrades). It NEVER
 * throws and NEVER sends user bytes (no body, no query params, no user headers).
 *
 * opts:
 *   seamPath   LOCAL seam file (default ~/.mindrian/reference-now.json)
 *   fetchImpl  injectable fetch (default global fetch) -- test seam
 *   now        injectable clock (default Date.now) -- test seam
 *   sessionId  fire-once key; if the seam already has this lastFetchSession,
 *              the fetch is skipped and the cached offset is returned.
 *   endpoint   override the time endpoint (default DEFAULT_TIME_ENDPOINT)
 */
async function fetchTimeOffsetOnce(opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  const seamPath = typeof o.seamPath === 'string' && o.seamPath ? o.seamPath : DEFAULT_SEAM_PATH;
  const nowFn = typeof o.now === 'function' ? o.now : Date.now;
  const fetchImpl = typeof o.fetchImpl === 'function'
    ? o.fetchImpl
    : (typeof fetch === 'function' ? fetch : null);
  const endpoint = typeof o.endpoint === 'string' && o.endpoint ? o.endpoint : DEFAULT_TIME_ENDPOINT;
  const sessionId = typeof o.sessionId === 'string' ? o.sessionId : null;

  // Fire-once-per-session: if the seam already recorded this session id and has
  // a numeric offset, return the cached offset without a network call.
  if (sessionId) {
    const seam = readSeam(seamPath);
    if (seam && seam.lastFetchSession === sessionId && isFiniteNumber(seam.offsetMs)) {
      return seam.offsetMs;
    }
  }

  if (typeof fetchImpl !== 'function') return null;

  try {
    // Bare GET. NO body, NO query string, NO user-derived headers. SIGNAL only.
    const resp = await fetchImpl(endpoint, { method: 'GET' });
    if (!resp || !resp.headers || typeof resp.headers.get !== 'function') return null;
    const dateHeader = resp.headers.get('date');
    if (!dateHeader) return null;
    const authoritativeMs = Date.parse(dateHeader);
    if (!Number.isFinite(authoritativeMs)) return null;
    const localNowMs = nowFn();
    const offsetMs = authoritativeMs - localNowMs;
    if (!Number.isFinite(offsetMs)) return null;
    // Persist the offset + the session marker to the seam (LOCAL write).
    writeSeam(seamPath, {
      offsetMs,
      lastFetchSession: sessionId || undefined,
      source: 'online_skew',
    });
    return offsetMs;
  } catch (_err) {
    // ANY failure (network, DNS, parse, abort) degrades to null silently.
    return null;
  }
}

// ---------- getReferenceNow (the precedence ladder) ----------

/*
 * getReferenceNow(opts) -> { referenceMs, source }.
 *   source in 'currentDate' | 'online_skew' | 'seam' | 'date_now'.
 *
 * Precedence (D-01b):
 *   1. valid injected currentDate -> calendar date floor blended with the
 *      seam offset for time-of-day. source 'currentDate'.
 *   2. (else) a fresh seam value -> source 'seam'.
 *   3. (else) now() floor (default Date.now) -> source 'date_now'.
 *
 * Never throws. opts:
 *   currentDate  YYYY-MM-DD injected by Claude Code (optional)
 *   now          injectable clock (default Date.now) -- the options.now seam
 *   seamPath     LOCAL seam file (default ~/.mindrian/reference-now.json)
 */
function getReferenceNow(opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  const nowFn = typeof o.now === 'function' ? o.now : Date.now;
  const seamPath = typeof o.seamPath === 'string' && o.seamPath ? o.seamPath : DEFAULT_SEAM_PATH;

  let localNow;
  try { localNow = nowFn(); } catch (_e) { localNow = Date.now(); }
  if (!isFiniteNumber(localNow)) localNow = Date.now();

  // Read the seam once (LOCAL, no network). Tolerant of missing/malformed.
  const seam = readSeam(seamPath);
  const seamOffset = seam && isFiniteNumber(seam.offsetMs) ? seam.offsetMs : 0;

  // Rung 1: injected currentDate wins the calendar DATE.
  if (typeof o.currentDate === 'string' && o.currentDate.trim()) {
    // Blend the seam offset into the local clock so time-of-day reflects the
    // skew-corrected local clock; the DATE is then forced to currentDate.
    const skewCorrectedNow = localNow + seamOffset;
    const blended = applyCurrentDate(o.currentDate, skewCorrectedNow);
    if (blended != null) {
      return { referenceMs: blended, source: 'currentDate' };
    }
    // Malformed currentDate falls through to the next rung.
  }

  // Rung 2: a fresh seam floor value.
  if (seam && isFiniteNumber(seam.floorMs)) {
    return { referenceMs: seam.floorMs, source: 'seam' };
  }

  // Rung 3: the Date.now (or injected now) floor.
  return { referenceMs: localNow, source: 'date_now' };
}

module.exports = {
  getReferenceNow,
  readSeam,
  writeSeam,
  applyCurrentDate,
  fetchTimeOffsetOnce,
  // Exported for the seeder/command + tests.
  DEFAULT_SEAM_PATH,
  DEFAULT_TIME_ENDPOINT,
};
