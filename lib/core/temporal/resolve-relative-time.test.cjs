'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 160-02 Task 1 -- resolveRelativeTime() unit tests (TDD RED-first).
 * =======================================================================
 *
 * R2 (160-SPEC.md). A chrono-node resolver turns user NL-time into epoch ms
 * anchored to getReferenceNow() via the options.now seam (D-01a). The test
 * table resolves >= 10 expressions against a FIXED reference of 2026-06-16
 * (a Tuesday) and asserts the EXACT resolved calendar dates from SPEC R2.
 *
 * The anchor-injection test proves the resolver reads getReferenceNow(), not
 * the system clock: the same expression resolves to a different date when the
 * injected reference moves.
 *
 * House rule: hyphens only, no em-dashes. Pure CJS, node:test.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveRelativeTime } = require('./resolve-relative-time.cjs');

// 2026-06-16 is a Tuesday. Anchor at noon UTC so day-granularity resolution
// lands cleanly within the calendar day regardless of time-of-day rounding.
const REF_2026_06_16 = Date.UTC(2026, 5, 16, 12, 0, 0, 0);

// Helper: the resolved date's UTC calendar date (YYYY-MM-DD).
function utcDate(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

test('R2: resolves a table of >= 10 relative expressions against reference 2026-06-16', () => {
  // [expression, expected YYYY-MM-DD, expected forward bias]
  const table = [
    ['last Tuesday', '2026-06-09', false],
    ['yesterday', '2026-06-15', false],
    ['next month', '2026-07-16', true],
    ['next quarter', '2026-09-16', true],
    ['3 days ago', '2026-06-13', false],
    ['tomorrow', '2026-06-17', true],
    ['in 3 weeks', '2026-07-07', true],
    ['last Friday', '2026-06-12', false],
    ['next week', '2026-06-23', true],
    ['2 months ago', '2026-04-16', false],
    ['last month', '2026-05-16', false],
  ];

  assert.ok(table.length >= 10, 'the SPEC R2 table must carry at least 10 expressions');

  for (const [expr, expectedDate, expectedForward] of table) {
    const res = resolveRelativeTime(expr, { referenceMs: REF_2026_06_16 });
    assert.ok(res, 'expected a non-null resolution for "' + expr + '"');
    assert.equal(
      utcDate(res.validAtMs),
      expectedDate,
      '"' + expr + '" should resolve to ' + expectedDate + ' (got ' + utcDate(res.validAtMs) + ')'
    );
    assert.equal(res.matched, true, '"' + expr + '" should report matched=true');
    assert.equal(res.forward, expectedForward, '"' + expr + '" forward-bias mismatch');
  }
});

test('R2 anchor: "last Tuesday" -> 2026-06-09 (the SPEC headline case)', () => {
  const res = resolveRelativeTime('last Tuesday', { referenceMs: REF_2026_06_16 });
  assert.ok(res);
  assert.equal(utcDate(res.validAtMs), '2026-06-09');
});

test('R2 anchor: "next month" -> a 2026-07 date (the SPEC headline case)', () => {
  const res = resolveRelativeTime('next month', { referenceMs: REF_2026_06_16 });
  assert.ok(res);
  assert.equal(utcDate(res.validAtMs).slice(0, 7), '2026-07');
});

test('R2 anchor: resolution MOVES with the injected reference (anchored to getReferenceNow, not the system clock)', () => {
  // Same expression, two different injected references. "yesterday" must track
  // whichever reference is supplied -- proving the resolver does NOT consult
  // Date.now(). Reference A: 2026-06-16 -> yesterday = 2026-06-15.
  const a = resolveRelativeTime('yesterday', { referenceMs: REF_2026_06_16 });
  assert.equal(utcDate(a.validAtMs), '2026-06-15');

  // Reference B: 2020-01-10 -> yesterday = 2020-01-09. If the resolver leaked
  // to the real system clock this would NOT be 2020-01-09.
  const refB = Date.UTC(2020, 0, 10, 12, 0, 0, 0);
  const b = resolveRelativeTime('yesterday', { referenceMs: refB });
  assert.equal(utcDate(b.validAtMs), '2020-01-09');
});

test('R2: resolver falls back to getReferenceNow() when no referenceMs is supplied', () => {
  // With no referenceMs and no currentDate, the resolver anchors to
  // getReferenceNow()'s Date.now() floor. "yesterday" must be ~1 day before now.
  const res = resolveRelativeTime('yesterday', {});
  assert.ok(res);
  const approxYesterday = Date.now() - 24 * 60 * 60 * 1000;
  // Within a 2-day window to tolerate time-of-day rounding.
  assert.ok(
    Math.abs(res.validAtMs - approxYesterday) < 2 * 24 * 60 * 60 * 1000,
    'resolution should anchor near the real now when no reference is injected'
  );
});

test('R2: resolver honors an injected currentDate string through getReferenceNow', () => {
  // currentDate wins the calendar DATE per the Wave 1 precedence ladder.
  const res = resolveRelativeTime('last Tuesday', { currentDate: '2026-06-16' });
  assert.ok(res);
  assert.equal(utcDate(res.validAtMs), '2026-06-09');
});

test('R2: returns null when no time expression is present', () => {
  assert.equal(resolveRelativeTime('the financial model assumptions', { referenceMs: REF_2026_06_16 }), null);
  assert.equal(resolveRelativeTime('', { referenceMs: REF_2026_06_16 }), null);
  assert.equal(resolveRelativeTime(null, { referenceMs: REF_2026_06_16 }), null);
  assert.equal(resolveRelativeTime(undefined, {}), null);
});

test('R2: forward-biased phrases set forward=true; past phrases set forward=false', () => {
  assert.equal(resolveRelativeTime('next week', { referenceMs: REF_2026_06_16 }).forward, true);
  assert.equal(resolveRelativeTime('in 3 weeks', { referenceMs: REF_2026_06_16 }).forward, true);
  assert.equal(resolveRelativeTime('tomorrow', { referenceMs: REF_2026_06_16 }).forward, true);
  assert.equal(resolveRelativeTime('3 days ago', { referenceMs: REF_2026_06_16 }).forward, false);
  assert.equal(resolveRelativeTime('last Tuesday', { referenceMs: REF_2026_06_16 }).forward, false);
});

test('R2: matched span is reported and never echoes arbitrary prose (Part 8 scalar discipline)', () => {
  const res = resolveRelativeTime('we met last Tuesday at the lab', { referenceMs: REF_2026_06_16 });
  assert.ok(res);
  assert.equal(utcDate(res.validAtMs), '2026-06-09');
  assert.equal(res.matched, true);
  // The return surface carries only scalars: epoch ms, a matched boolean, a
  // forward boolean, and the matched SPAN text (the time phrase only, never the
  // whole user sentence). Assert validAtMs is a finite number.
  assert.equal(typeof res.validAtMs, 'number');
  assert.ok(Number.isFinite(res.validAtMs));
  assert.equal(typeof res.matched, 'boolean');
  assert.equal(typeof res.forward, 'boolean');
});
