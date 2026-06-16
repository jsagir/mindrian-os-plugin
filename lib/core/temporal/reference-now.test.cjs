'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 160-01 Task 1 -- getReferenceNow() precedence ladder + local seam tests.
 *
 * R1 acceptance (160-SPEC.md):
 *   (a/b) with currentDate=2026-06-16 injected and now() stubbed to a DIFFERENT
 *         calendar date, getReferenceNow().referenceMs falls on 2026-06-16.
 *   (c)   with fetchTimeOffsetOnce's fetch stubbed to throw, it returns null and
 *         getReferenceNow still returns a valid reference with no thrown error.
 *
 * Decisions (160-CONTEXT.md):
 *   D-01b precedence ladder: injected currentDate (calendar date) beats a fresh
 *         seam value beats now() floor.
 *   D-01a route through the options.now seam contract (a plain millisecond int).
 *
 * House rule: hyphens only, no em-dashes. Pure CJS, node built-ins only.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  getReferenceNow,
  readSeam,
  writeSeam,
  applyCurrentDate,
  fetchTimeOffsetOnce,
} = require('./reference-now.cjs');

// ---------- helpers ----------

function tmpSeam(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'refnow-'));
  return path.join(dir, (name || 'reference-now') + '.json');
}

// A fixed system-clock stub that lands on a DIFFERENT calendar date than the
// injected currentDate. 2026-01-02T03:04:05Z (Jan 2), to contrast with Jun 16.
const DIVERGENT_CLOCK_MS = Date.UTC(2026, 0, 2, 3, 4, 5);

// ---------- exports surface ----------

test('exports the documented surface', () => {
  assert.equal(typeof getReferenceNow, 'function');
  assert.equal(typeof readSeam, 'function');
  assert.equal(typeof writeSeam, 'function');
  assert.equal(typeof applyCurrentDate, 'function');
  assert.equal(typeof fetchTimeOffsetOnce, 'function');
});

// ---------- R1 acceptance a + b: currentDate wins the calendar DATE ----------

test('R1 a/b: injected currentDate wins the calendar date over a divergent system clock', () => {
  const seamPath = tmpSeam();
  const res = getReferenceNow({
    currentDate: '2026-06-16',
    now: () => DIVERGENT_CLOCK_MS,
    seamPath,
  });
  assert.equal(typeof res.referenceMs, 'number');
  assert.ok(Number.isFinite(res.referenceMs));
  // The returned reference must land on the 2026-06-16 calendar date (UTC).
  const d = new Date(res.referenceMs);
  assert.equal(d.getUTCFullYear(), 2026);
  assert.equal(d.getUTCMonth(), 5); // June is month index 5
  assert.equal(d.getUTCDate(), 16);
  // It must NOT be the divergent system-clock date (Jan 2).
  assert.notEqual(d.getUTCMonth(), 0);
  assert.equal(res.source, 'currentDate');
});

test('R1 a/b: returned referenceMs is a millisecond integer usable as an options.now value', () => {
  const seamPath = tmpSeam();
  const res = getReferenceNow({ currentDate: '2026-06-16', now: () => DIVERGENT_CLOCK_MS, seamPath });
  // options.now contract: a function returning a ms integer. The reference is
  // directly usable as that returned value.
  assert.ok(Number.isInteger(res.referenceMs));
  const asNowFn = () => res.referenceMs;
  assert.equal(asNowFn(), res.referenceMs);
});

test('currentDate blends seam offset for time-of-day while keeping the calendar date', () => {
  const seamPath = tmpSeam();
  // Seed a seam with an offset (skew corrector result).
  writeSeam(seamPath, { floorMs: DIVERGENT_CLOCK_MS, offsetMs: 5000, source: 'seam' });
  const res = getReferenceNow({ currentDate: '2026-06-16', now: () => DIVERGENT_CLOCK_MS, seamPath });
  const d = new Date(res.referenceMs);
  // Calendar date still 2026-06-16.
  assert.equal(d.getUTCFullYear(), 2026);
  assert.equal(d.getUTCMonth(), 5);
  assert.equal(d.getUTCDate(), 16);
  assert.equal(res.source, 'currentDate');
});

// ---------- seam fallback ----------

test('no currentDate + a fresh seam value returns the seam value', () => {
  const seamPath = tmpSeam();
  const seamFloor = Date.UTC(2026, 5, 10, 12, 0, 0);
  writeSeam(seamPath, { floorMs: seamFloor, offsetMs: 0, source: 'seam' });
  const res = getReferenceNow({ now: () => DIVERGENT_CLOCK_MS, seamPath });
  assert.equal(res.source, 'seam');
  assert.equal(typeof res.referenceMs, 'number');
  assert.equal(res.referenceMs, seamFloor);
});

// ---------- Date.now floor ----------

test('no currentDate + no usable seam falls back to now() with source date_now', () => {
  const seamPath = tmpSeam(); // path does not exist yet
  const res = getReferenceNow({ now: () => DIVERGENT_CLOCK_MS, seamPath });
  assert.equal(res.source, 'date_now');
  assert.equal(res.referenceMs, DIVERGENT_CLOCK_MS);
});

test('getReferenceNow never throws on a missing seam path and defaults now to Date.now', () => {
  const seamPath = tmpSeam();
  let res;
  assert.doesNotThrow(() => {
    res = getReferenceNow({ seamPath });
  });
  assert.ok(Number.isFinite(res.referenceMs));
});

test('getReferenceNow degrades to date_now on a malformed seam (tampering, T-160-02)', () => {
  const seamPath = tmpSeam();
  fs.writeFileSync(seamPath, '{ this is not valid json', 'utf8');
  const res = getReferenceNow({ now: () => DIVERGENT_CLOCK_MS, seamPath });
  assert.equal(res.source, 'date_now');
  assert.equal(res.referenceMs, DIVERGENT_CLOCK_MS);
});

// ---------- applyCurrentDate ----------

test('applyCurrentDate places baseMs time-of-day onto the currentDate calendar date', () => {
  // base carries a time-of-day of 03:04:05 on Jan 2; applying 2026-06-16 should
  // keep the calendar date June 16 (time-of-day handling is implementation-defined
  // but the DATE must be June 16).
  const out = applyCurrentDate('2026-06-16', DIVERGENT_CLOCK_MS);
  assert.equal(typeof out, 'number');
  const d = new Date(out);
  assert.equal(d.getUTCFullYear(), 2026);
  assert.equal(d.getUTCMonth(), 5);
  assert.equal(d.getUTCDate(), 16);
});

test('applyCurrentDate returns null on a malformed date string', () => {
  assert.equal(applyCurrentDate('not-a-date', DIVERGENT_CLOCK_MS), null);
  assert.equal(applyCurrentDate('2026-13-99', DIVERGENT_CLOCK_MS), null);
  assert.equal(applyCurrentDate('', DIVERGENT_CLOCK_MS), null);
});

// ---------- readSeam / writeSeam round-trip ----------

test('writeSeam then readSeam round-trips a partial and stamps updatedAt', () => {
  const seamPath = tmpSeam();
  const w = writeSeam(seamPath, { floorMs: 123456, offsetMs: 7 });
  assert.equal(w.ok, true);
  const r = readSeam(seamPath);
  assert.equal(r.floorMs, 123456);
  assert.equal(r.offsetMs, 7);
  assert.equal(typeof r.updatedAt, 'string');
});

test('readSeam returns null on a missing file (no throw)', () => {
  const seamPath = tmpSeam();
  let r;
  assert.doesNotThrow(() => { r = readSeam(seamPath); });
  assert.equal(r, null);
});

// ---------- R1 acceptance c: offline degrade ----------

test('R1 c: fetchTimeOffsetOnce returns null when fetch throws, and never throws', async () => {
  const seamPath = tmpSeam();
  const throwingFetch = async () => { throw new Error('network down'); };
  let out;
  await assert.doesNotReject(async () => {
    out = await fetchTimeOffsetOnce({ seamPath, fetchImpl: throwingFetch, now: () => DIVERGENT_CLOCK_MS });
  });
  assert.equal(out, null);
  // getReferenceNow still returns a valid reference with no thrown error.
  let res;
  assert.doesNotThrow(() => { res = getReferenceNow({ now: () => DIVERGENT_CLOCK_MS, seamPath }); });
  assert.ok(Number.isFinite(res.referenceMs));
});

test('R1 c: fetchTimeOffsetOnce returns null when the response has no Date header', async () => {
  const seamPath = tmpSeam();
  const noDateFetch = async () => ({ headers: { get: () => null } });
  const out = await fetchTimeOffsetOnce({ seamPath, fetchImpl: noDateFetch, now: () => DIVERGENT_CLOCK_MS });
  assert.equal(out, null);
});

test('fetchTimeOffsetOnce computes and persists offset on a successful Date header', async () => {
  const seamPath = tmpSeam();
  // Authoritative time is 10 seconds ahead of the local clock.
  const authoritativeMs = DIVERGENT_CLOCK_MS + 10000;
  const dateHeader = new Date(authoritativeMs).toUTCString();
  const okFetch = async () => ({ headers: { get: (k) => (k.toLowerCase() === 'date' ? dateHeader : null) } });
  const out = await fetchTimeOffsetOnce({ seamPath, fetchImpl: okFetch, now: () => DIVERGENT_CLOCK_MS });
  assert.equal(typeof out, 'number');
  // toUTCString truncates to whole seconds; allow up to 1s rounding.
  assert.ok(Math.abs(out - 10000) <= 1000, 'offset near 10000ms, got ' + out);
  const seam = readSeam(seamPath);
  assert.equal(typeof seam.offsetMs, 'number');
});

test('fetchTimeOffsetOnce calls fetch at most once per session (idempotent on lastFetchSession)', async () => {
  const seamPath = tmpSeam();
  let calls = 0;
  const countingFetch = async () => {
    calls += 1;
    return { headers: { get: (k) => (k.toLowerCase() === 'date' ? new Date(DIVERGENT_CLOCK_MS).toUTCString() : null) } };
  };
  const sessionId = 'session-abc';
  await fetchTimeOffsetOnce({ seamPath, fetchImpl: countingFetch, now: () => DIVERGENT_CLOCK_MS, sessionId });
  await fetchTimeOffsetOnce({ seamPath, fetchImpl: countingFetch, now: () => DIVERGENT_CLOCK_MS, sessionId });
  assert.equal(calls, 1, 'fetch must fire at most once per session id');
});
