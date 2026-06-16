'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 160-03 Task 1 (TDD RED) -- recency-decay: the app-side decay blend that
 * makes getRoomContext Leg D rank recent cortex nodes above stale (R5 / D-03).
 * ===========================================================================
 *
 * D-03 places the decay math APP-SIDE in JS (a VISIBLE DECAY_BASE constant) AFTER
 * a recency-ordered SQL fetch -- never buried in a SQL string, so it is
 * frozen-testable. These tests assert:
 *   - DECAY_BASE is the visible Generative-Agents 0.995 constant.
 *   - recencyScore(createdAtMs, referenceMs) = DECAY_BASE ^ deltaHours and is
 *     MONOTONIC DECREASING with age (a newer node scores higher than an older).
 *   - rankByRecency(nodes, referenceMs) orders the MORE-RECENT node first and is
 *     DETERMINISTIC (stable id tiebreak on equal scores).
 *
 * RED-by-design until lib/core/temporal/recency-decay.cjs lands.
 *
 * House rule: hyphens only, no em-dashes. Pure CJS, node built-ins only.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  recencyScore,
  rankByRecency,
  DECAY_BASE,
} = require('./recency-decay.cjs');

const HOUR_MS = 60 * 60 * 1000;

test('DECAY_BASE is the visible 0.995 Generative-Agents constant', () => {
  assert.equal(DECAY_BASE, 0.995, 'DECAY_BASE must be the visible 0.995 constant (D-03)');
});

test('recencyScore at zero age is 1 (DECAY_BASE ^ 0)', () => {
  const ref = 1_700_000_000_000;
  assert.equal(recencyScore(ref, ref), 1, 'a node created exactly at the reference scores 1');
});

test('recencyScore equals DECAY_BASE ^ deltaHours', () => {
  const ref = 1_700_000_000_000;
  const tenHoursAgo = ref - 10 * HOUR_MS;
  const expected = Math.pow(DECAY_BASE, 10);
  assert.ok(
    Math.abs(recencyScore(tenHoursAgo, ref) - expected) < 1e-12,
    'recencyScore must be DECAY_BASE ^ deltaHours'
  );
});

test('recencyScore is monotonic decreasing with age: newer > older (R5 acceptance part 1)', () => {
  const ref = 1_700_000_000_000;
  const newer = ref - 1 * HOUR_MS;
  const older = ref - 100 * HOUR_MS;
  assert.ok(
    recencyScore(newer, ref) > recencyScore(older, ref),
    'a more-recent node must score higher than an older node'
  );
});

test('recencyScore degrades safely on a non-finite input (never throws, scores 0)', () => {
  const ref = 1_700_000_000_000;
  assert.equal(recencyScore(null, ref), 0, 'null createdAt scores 0 (degrade, never throw)');
  assert.equal(recencyScore(ref, null), 0, 'null reference scores 0 (degrade, never throw)');
  assert.equal(recencyScore('nope', ref), 0, 'non-numeric createdAt scores 0');
});

test('recencyScore treats a future createdAt as zero-age (clamped, scores 1)', () => {
  const ref = 1_700_000_000_000;
  const future = ref + 50 * HOUR_MS;
  assert.equal(
    recencyScore(future, ref),
    1,
    'a future-dated node (clock skew) clamps to zero age and scores 1, never > 1'
  );
});

test('rankByRecency orders the more-recent node first (R5 acceptance part 1)', () => {
  const ref = 1_700_000_000_000;
  const nodes = [
    { id: 'stale', created_at: ref - 240 * HOUR_MS },
    { id: 'fresh', created_at: ref - 1 * HOUR_MS },
  ];
  const ranked = rankByRecency(nodes, ref);
  assert.equal(ranked[0].id, 'fresh', 'the more-recent node ranks first');
  assert.equal(ranked[1].id, 'stale', 'the staler node ranks last');
});

test('rankByRecency: two nodes identical but for created_at rank more-recent-first', () => {
  const ref = 1_700_000_000_000;
  const nodes = [
    { id: 'n', type: 'claim', created_at: ref - 100 * HOUR_MS },
    { id: 'n', type: 'claim', created_at: ref - 2 * HOUR_MS },
  ];
  const ranked = rankByRecency(nodes, ref);
  assert.equal(
    ranked[0].created_at,
    ref - 2 * HOUR_MS,
    'identical-but-for-created_at nodes order more-recent-first'
  );
});

test('rankByRecency is deterministic: equal scores keep a stable id tiebreak', () => {
  const ref = 1_700_000_000_000;
  const sameAge = ref - 5 * HOUR_MS;
  const nodes = [
    { id: 'zebra', created_at: sameAge },
    { id: 'alpha', created_at: sameAge },
    { id: 'mango', created_at: sameAge },
  ];
  const a = rankByRecency(nodes, ref).map((n) => n.id);
  const b = rankByRecency(nodes.slice().reverse(), ref).map((n) => n.id);
  assert.deepEqual(a, b, 'equal-score ordering is stable regardless of input order');
  assert.deepEqual(a, ['alpha', 'mango', 'zebra'], 'equal-score tiebreak is ascending id');
});

test('rankByRecency falls back to last_seen_at when created_at is absent', () => {
  const ref = 1_700_000_000_000;
  const nodes = [
    { id: 'old', last_seen_at: ref - 200 * HOUR_MS },
    { id: 'new', last_seen_at: ref - 3 * HOUR_MS },
  ];
  const ranked = rankByRecency(nodes, ref);
  assert.equal(ranked[0].id, 'new', 'last_seen_at drives ranking when created_at is missing');
});

test('rankByRecency does not mutate the caller array and degrades on bad input', () => {
  const ref = 1_700_000_000_000;
  const nodes = [
    { id: 'b', created_at: ref - 10 * HOUR_MS },
    { id: 'a', created_at: ref - 1 * HOUR_MS },
  ];
  const before = nodes.slice();
  rankByRecency(nodes, ref);
  assert.deepEqual(nodes, before, 'the caller array is never mutated (a fresh sorted copy is returned)');
  assert.deepEqual(rankByRecency(null, ref), [], 'non-array input degrades to []');
  assert.deepEqual(rankByRecency([], ref), [], 'empty input returns []');
});
