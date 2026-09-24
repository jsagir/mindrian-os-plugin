#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection
 * engines) Plan 24 (HIPS-07). Guard / export / Wilson / rate legs for
 * scripts/measure-355-hit-rate.cjs. hygiene-355's scrubVendorKey() and
 * installNetGuard() run BEFORE any repo module is required (Pitfall 16);
 * attempts() === 0 is the last check. This file never runs an encoder and
 * never requires lib/core/verification-stamp.cjs's network-calling path --
 * every stamp used here is injected as a plain object.
 *
 * Exit 0 on full green. The `--check` absent-record contract (77) is
 * asserted as a VALUE against an injected absent path, never propagated as
 * this file's own exit code. 355-25 Task 3 added the present-record legs:
 * exact recomputation, n and Wilson on every rate, >= 20 judged per room,
 * the committed 355-VERIFICATION.md section being the record's rendering
 * (checked against a temp copy, never rewriting the tracked file), the
 * banned-claim and em-dash scans, and the blind-before-stamped git order.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

'use strict';

const hygiene = require('./helpers/hygiene-355.cjs');

hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const measure = require('../scripts/measure-355-hit-rate.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const { check, summary } = hygiene.makeChecker('test-355-hit-rate-record');

function approxEqual(a, b, tol) {
  return Math.abs(a - b) <= (tol === undefined ? 1e-6 : tol);
}

// ---------------------------------------------------------------------------
// leg: guardRoomPath
// ---------------------------------------------------------------------------
function legGuard() {
  console.log('--- leg: guardRoomPath ---');

  const roomControl = path.join(REPO_ROOT, 'tests', 'fixtures', '355-rooms', 'room-control');
  let real;
  let threw = false;
  try {
    real = measure.guardRoomPath(roomControl);
  } catch (_e) {
    threw = true;
  }
  check('guardRoomPath(room-control) returns the realpath, does not throw', !threw);
  check('guardRoomPath(room-control) result resolves inside FIXTURE_ROOT', typeof real === 'string' && real.indexOf(measure.FIXTURE_ROOT) === 0);

  const outsideTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'measure-355-guard-'));
  let outsideThrew = false;
  try {
    measure.guardRoomPath(outsideTmp);
  } catch (_e) {
    outsideThrew = true;
  }
  check('guardRoomPath(a tmp dir outside the tree) throws', outsideThrew);
  fs.rmSync(outsideTmp, { recursive: true, force: true });

  const siblingPrefix = measure.FIXTURE_ROOT + '-evil';
  fs.mkdirSync(siblingPrefix, { recursive: true });
  let siblingThrew = false;
  try {
    measure.guardRoomPath(siblingPrefix);
  } catch (_e) {
    siblingThrew = true;
  }
  check('guardRoomPath(a sibling-prefix path, 355-rooms-evil) throws', siblingThrew);
  fs.rmSync(siblingPrefix, { recursive: true, force: true });

  // An escaping symlink: a symlink INSIDE the fixture root whose target
  // points OUTSIDE it must still be refused (realpath resolves the symlink
  // before the prefix check runs).
  const escapeTarget = fs.mkdtempSync(path.join(os.tmpdir(), 'measure-355-escape-target-'));
  const symlinkPath = path.join(measure.FIXTURE_ROOT, '__test-355-escape-symlink__');
  let symlinkThrew = false;
  try {
    fs.symlinkSync(escapeTarget, symlinkPath, 'dir');
    try {
      measure.guardRoomPath(symlinkPath);
    } catch (_e) {
      symlinkThrew = true;
    }
  } catch (_e) {
    // symlink creation itself failed (e.g. platform restriction) -- do not
    // fail the whole suite over an environment limitation, but do not
    // silently count a pass either.
    symlinkThrew = 'skip';
  } finally {
    try { fs.unlinkSync(symlinkPath); } catch (_e) { /* best effort */ }
    fs.rmSync(escapeTarget, { recursive: true, force: true });
  }
  if (symlinkThrew === 'skip') {
    console.log('  (symlink leg skipped: symlink creation unavailable in this environment)');
  } else {
    check('guardRoomPath(a symlink pointing outside the tree) throws', symlinkThrew === true);
  }

  // A path outside the tree that happens to include "MindrianRooms" in its
  // name proves the refusal is prefix-based, not a string-match special case
  // (the static leg below proves the source never names that string at all).
  const homedirStyle = path.join(os.tmpdir(), 'not-a-real-home', 'MindrianRooms', 'some-room');
  fs.mkdirSync(homedirStyle, { recursive: true });
  let homedirThrew = false;
  try {
    measure.guardRoomPath(homedirStyle);
  } catch (_e) {
    homedirThrew = true;
  }
  check('guardRoomPath(a path under any other tree named MindrianRooms) throws', homedirThrew);
  fs.rmSync(path.join(os.tmpdir(), 'not-a-real-home'), { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// leg: static source scan (no MindrianRooms / no homedir() in non-comment
// source -- mirrors the plan's own acceptance_criteria grep, run here too so
// the RED/GREEN cycle covers it).
// ---------------------------------------------------------------------------
function legStaticScan() {
  console.log('--- leg: static source scan ---');
  const scriptPath = path.join(REPO_ROOT, 'scripts', 'measure-355-hit-rate.cjs');
  const lines = hygiene.nonCommentLines(scriptPath);
  const hit = lines.find((l) => /MindrianRooms|homedir\(\)/.test(l));
  check('scripts/measure-355-hit-rate.cjs non-comment source names neither MindrianRooms nor homedir()', !hit, hit);
}

// ---------------------------------------------------------------------------
// leg: exportUnstamped (injected runProducers, no real engine, no encoder)
// ---------------------------------------------------------------------------
function fakeArtifact(id, title, text) {
  return { id, path: id + '.md', title, text };
}

function buildFakeRoomPairs(roomName, count) {
  const pairs = [];
  for (let i = 0; i < count; i += 1) {
    const a = fakeArtifact(roomName + '/a' + i, 'Artifact A' + i, 'This is sentence one. This is sentence two. This is sentence three.');
    const b = fakeArtifact(roomName + '/b' + i, 'Artifact B' + i, 'A different sentence one. A different sentence two.');
    pairs.push({ producer: 'hsi', a, b, direction: i % 2 === 0 ? 'structural_transfer' : 'semantic_implementation' });
  }
  return pairs;
}

async function legExportUnstamped() {
  console.log('--- leg: exportUnstamped ---');

  const rooms = [{ name: 'fake-room-one', dir: '/fake/one' }, { name: 'fake-room-two', dir: '/fake/two' }];

  async function runProducers(ctx) {
    return {
      producers_ran: ['hsi'],
      encoder: 'fake-encoder/v1',
      pairs: buildFakeRoomPairs(ctx.room, 22),
    };
  }

  const payload = await measure.exportUnstamped(rooms, { top: 10, runProducers });
  check('exportUnstamped returns generated_at', typeof payload.generated_at === 'string');
  check('exportUnstamped returns the injected encoder id', payload.encoder === 'fake-encoder/v1');
  check('exportUnstamped returns top_k echoing the option', payload.top_k === 10);
  check('exportUnstamped returns a phrase_hash matching direction-convention', payload.phrase_hash === require('../lib/core/direction-convention.cjs').phraseHash());
  check('exportUnstamped writes >= 20 items per room (rooms metadata)', payload.rooms['fake-room-one'].shown >= 20 && payload.rooms['fake-room-two'].shown >= 20);
  check('exportUnstamped items total equals the sum of per-room shown counts', payload.items.length === payload.rooms['fake-room-one'].shown + payload.rooms['fake-room-two'].shown);

  const first = payload.items.find((i) => i.room === 'fake-room-one');
  check('item carries pair_id, room, producer, a_excerpt, b_excerpt, direction_phrase', !!(first && first.pair_id && first.room && first.producer && first.a_excerpt && first.b_excerpt && first.direction_phrase));
  check('item carries no stamp/stamp_lines/verification field (unstamped baseline)', !('stamp' in first) && !('stamp_lines' in first) && !('verification' in first));
  check('a_excerpt starts with the artifact title', first.a_excerpt.indexOf('Artifact A') === 0);
  check('direction_phrase resolves through DIRECTION_MEANING for a real direction', payload.items.some((i) => i.direction_phrase === 'same meaning in different words') && payload.items.some((i) => i.direction_phrase === 'same words with different meaning'));

  const expectedPairId = measure.pairId('fake-room-one', 'fake-room-one/a0.md', 'fake-room-one/b0.md');
  const matchingItem = payload.items.find((i) => i.a_path === 'fake-room-one/a0.md' && i.b_path === 'fake-room-one/b0.md');
  check('pair_id is sha256(room + NUL + sorted artifact paths).slice(0,12), 12 hex chars', !!matchingItem && matchingItem.pair_id === expectedPairId && /^[0-9a-f]{12}$/.test(matchingItem.pair_id));

  // Dedup across producers: two producers surfacing the SAME unordered
  // artifact pair collapse to one item.
  async function runProducersDup(ctx) {
    const basePairs = buildFakeRoomPairs(ctx.room, 20);
    const dupOfFirst = { producer: 'rs', a: basePairs[0].b, b: basePairs[0].a, direction: 'structural_transfer' };
    return { producers_ran: ['hsi', 'rs'], encoder: null, pairs: basePairs.concat([dupOfFirst]) };
  }
  const dupPayload = await measure.exportUnstamped([{ name: 'dup-room', dir: '/fake/dup' }], { top: 10, runProducers: runProducersDup });
  check('exportUnstamped dedupes an unordered pair repeated by a second producer', dupPayload.items.length === 20);

  // Throws instead of padding when a room falls short of 20.
  async function runProducersShort(ctx) {
    return { producers_ran: ['hsi'], encoder: null, pairs: buildFakeRoomPairs(ctx.room, 5) };
  }
  let threwShort = null;
  try {
    await measure.exportUnstamped([{ name: 'short-room', dir: '/fake/short' }], { top: 10, runProducers: runProducersShort });
  } catch (e) {
    threwShort = e;
  }
  check('exportUnstamped throws "fewer than 20 shown pairings in <room>" instead of padding', !!threwShort && /fewer than 20 shown pairings in short-room/.test(threwShort.message));
}

// ---------------------------------------------------------------------------
// leg: wilson95 (hand-computed values)
// ---------------------------------------------------------------------------
function legWilson() {
  console.log('--- leg: wilson95 ---');

  const zero = measure.wilson95(0, 0);
  check('wilson95(0, 0) -> [0, 0] (n=0 flagged, degenerate)', Array.isArray(zero) && zero.length === 2 && zero[0] === 0 && zero[1] === 0);

  // Hand-computed via the standard Wilson score formula, z = 1.959963985.
  const five20 = measure.wilson95(5, 20);
  check('wilson95(5, 20) matches the hand-computed Wilson interval', approxEqual(five20[0], 0.111865, 1e-4) && approxEqual(five20[1], 0.468705, 1e-4));

  const twenty20 = measure.wilson95(20, 20);
  check('wilson95(20, 20) matches the hand-computed Wilson interval', approxEqual(twenty20[0], 0.838870, 1e-4) && approxEqual(twenty20[1], 1.0, 1e-6));

  const zeroOfN = measure.wilson95(0, 20);
  check('wilson95(0, 20) has lo === 0', zeroOfN[0] === 0);
  check('wilson95(0, 20) has a finite, non-negative hi', Number.isFinite(zeroOfN[1]) && zeroOfN[1] >= 0);
}

// ---------------------------------------------------------------------------
// leg: computeRates (BLIND judgments joined by pair_id + injected stamps)
// ---------------------------------------------------------------------------
function fakeStamp(verification, extra) {
  return Object.assign({ verification, backend: verification === 'unverified' ? 'theo' : 'theo', direction: 'structural_transfer', judge: 'none' }, extra || {});
}

function legComputeRates() {
  console.log('--- leg: computeRates ---');

  const itemsPayload = {
    items: [
      { pair_id: 'p1', room: 'room-a', producer: 'hsi', a_path: 'room-a/x.md', b_path: 'room-a/y.md' },
      { pair_id: 'p2', room: 'room-a', producer: 'hsi', a_path: 'room-a/w.md', b_path: 'room-a/z.md' },
      { pair_id: 'p3', room: 'room-b', producer: 'rs', a_path: 'room-b/x.md', b_path: 'room-b/y.md' },
      { pair_id: 'p4', room: 'room-b', producer: 'rs', a_path: 'room-b/w.md', b_path: 'room-b/z.md' },
      { pair_id: 'p5', room: 'room-b', producer: 'rs', a_path: 'cell-biology/virus-replication.md', b_path: 'computer-security/self-replicating-virus-code.md' },
    ],
  };

  const judgmentsPayload = {
    items: [
      { pair_id: 'p1', useful: true, direction_ok: true, already_known: false, at: '2026-09-24T00:00:00Z' },
      { pair_id: 'p2', useful: false, direction_ok: true, already_known: true, at: '2026-09-24T00:00:01Z' },
      { pair_id: 'p3', useful: true, direction_ok: false, already_known: false, at: '2026-09-24T00:00:02Z' },
      { pair_id: 'p4', useful: false, direction_ok: false, already_known: false, at: '2026-09-24T00:00:03Z' },
      { pair_id: 'p5', useful: false, direction_ok: false, already_known: true, at: '2026-09-24T00:00:04Z' },
    ],
  };

  const stampsByPairId = new Map([
    ['p1', fakeStamp('strong', { path: { nodes: ['A', 'B'], labels: ['Framework', 'Framework'], edges: ['EXTENDS'] } })],
    ['p2', fakeStamp('indirect', { path: { nodes: ['A', 'C', 'D', 'B'], labels: ['Framework', 'Framework', 'Framework', 'Framework'], edges: ['EXTENDS', 'FEEDS_INTO', 'SUPPORTS'] } })],
    ['p3', fakeStamp('unverified', { backend: 'theo', reason: 'no_path_within_3_hops' })],
    ['p4', fakeStamp('unverified', { backend: 'not_called', reason: 'handle_unresolved' })],
    ['p5', fakeStamp('unverified', { backend: 'theo', reason: 'no_path_within_3_hops' })],
  ]);

  const joined = measure.joinJudgments(judgmentsPayload, itemsPayload, stampsByPairId);
  check('joinJudgments returns one row per judgment', joined.length === 5);
  check('joinJudgments attaches room from the items file', joined.find((r) => r.pair_id === 'p1').room === 'room-a');
  check('joinJudgments attaches the injected stamp', joined.find((r) => r.pair_id === 'p1').stamp.verification === 'strong');

  const plantedCases = {
    false_friends: [{ a: 'cell-biology/virus-replication.md', b: 'computer-security/self-replicating-virus-code.md', shared_word: 'virus' }],
  };

  const rates = measure.computeRates(joined, { plantedCases });

  check('per_room room-a: k=1, n=2 (p1 useful, p2 not)', rates.per_room['room-a'].k === 1 && rates.per_room['room-a'].n === 2);
  check('per_room room-b: k=1, n=3 (p3 useful; p4, p5 not)', rates.per_room['room-b'].k === 1 && rates.per_room['room-b'].n === 3);
  check('per_room rows carry a Wilson interval array', Array.isArray(rates.per_room['room-a'].wilson) && rates.per_room['room-a'].wilson.length === 2);

  check('pooled: k=2, n=5', rates.pooled.k === 2 && rates.pooled.n === 5);
  check('pooled rate === k/n', approxEqual(rates.pooled.rate, 2 / 5));

  check('per_tier.strong: k=1, n=1 (p1)', rates.per_tier.strong.k === 1 && rates.per_tier.strong.n === 1);
  check('per_tier.indirect: k=0, n=1 (p2)', rates.per_tier.indirect.k === 0 && rates.per_tier.indirect.n === 1);
  check('per_tier.unverified: k=1, n=3 (p3, p4, p5)', rates.per_tier.unverified.k === 1 && rates.per_tier.unverified.n === 3);

  check('unverified_share === 3/5', approxEqual(rates.unverified_share, 3 / 5));
  check('reason_mix counts no_path_within_3_hops twice, handle_unresolved once', rates.reason_mix.no_path_within_3_hops === 2 && rates.reason_mix.handle_unresolved === 1);
  check('not_called_share === 1/5 (p4 only)', approxEqual(rates.not_called_share, 1 / 5));

  check('already_known_by_tier.unverified: {true:1, false:2} (p5 known, p3/p4 not)', rates.already_known_by_tier.unverified.true === 1 && rates.already_known_by_tier.unverified.false === 2);
  check('already_known_by_tier.strong: {true:0, false:1} (p1)', rates.already_known_by_tier.strong.true === 0 && rates.already_known_by_tier.strong.false === 1);

  check('false_friends_by_tier.unverified counts the planted virus false friend (p5)', rates.false_friends_by_tier.unverified === 1);
  check('false_friends_by_tier.strong is 0 (no planted false friend in the strong bucket)', rates.false_friends_by_tier.strong === 0);

  // No stamps attached at all (a genuinely blind, unstamped join): per-tier
  // buckets and the stamp-derived shares are honestly empty/zero, never
  // guessed.
  const joinedNoStamps = measure.joinJudgments(judgmentsPayload, itemsPayload, null);
  const ratesNoStamps = measure.computeRates(joinedNoStamps, {});
  check('computeRates with no stamps: per_tier buckets are all n=0', ratesNoStamps.per_tier.strong.n === 0 && ratesNoStamps.per_tier.indirect.n === 0 && ratesNoStamps.per_tier.unverified.n === 0);
  check('computeRates with no stamps: unverified_share is 0 (no stamps to be unverified)', ratesNoStamps.unverified_share === 0);
  check('computeRates with no stamps: pooled rate is still computed from the blind judgments alone', ratesNoStamps.pooled.k === 2 && ratesNoStamps.pooled.n === 5);
}

// ---------------------------------------------------------------------------
// leg: false friends count only when the reader marked the direction wrong
// (355-25 plan text: "planted false_friends whose direction_ok was false")
// ---------------------------------------------------------------------------
function legFalseFriendDirection() {
  console.log('--- leg: false-friend count requires direction_ok false ---');
  const planted = { false_friends: [{ a: 'x/a.md', b: 'y/b.md' }, { a: 'x/c.md', b: 'y/d.md' }] };
  const joined = [
    { pair_id: 'q1', room: 'r', a_path: 'y/b.md', b_path: 'x/a.md', useful: false, direction_ok: false, already_known: false, stamp: fakeStamp('unverified', { reason: 'handle_unresolved', backend: 'not_called' }) },
    { pair_id: 'q2', room: 'r', a_path: 'x/c.md', b_path: 'y/d.md', useful: false, direction_ok: true, already_known: false, stamp: fakeStamp('unverified', { reason: 'handle_unresolved', backend: 'not_called' }) },
  ];
  const rates = measure.computeRates(joined, { plantedCases: planted });
  check('a shown false friend marked direction-wrong counts', rates.false_friends_by_tier.unverified === 1);
  check('a shown false friend marked direction-right is shown but not counted', rates.false_friends_shown_by_tier.unverified === 2);
}

// ---------------------------------------------------------------------------
// leg: nearest-rank percentile and hub metrics (hand-computed)
// ---------------------------------------------------------------------------
function legPercentile() {
  console.log('--- leg: percentile + hub metrics ---');
  check('p50 of [5,1,3,2,4] is 3 (nearest rank)', measure.percentileNearestRank([5, 1, 3, 2, 4], 0.5) === 3);
  check('p95 of 1..20 is 19 (nearest rank)', measure.percentileNearestRank(Array.from({ length: 20 }, (_, i) => i + 1), 0.95) === 19);
  check('percentile of an empty sample is null', measure.percentileNearestRank([], 0.5) === null);
  const mk = (nodes, labels, edges) => ({ stamp: fakeStamp('strong', { path: { nodes, labels, edges } }) });
  const rows = [
    mk(['A', 'H', 'B'], ['Framework', 'Framework', 'Framework'], ['FEEDS_INTO', 'FEEDS_INTO']),
    mk(['C', 'H', 'D'], ['Framework', 'Framework', 'Framework'], ['FEEDS_INTO', 'FEEDS_INTO']),
    mk(['E', 'X', 'F'], ['Framework', 'BrainRecord', 'Framework'], ['SOURCED_FROM', 'FEEDS_INTO']),
    mk(['G', 'I'], ['Framework', 'Framework'], ['FEEDS_INTO']),
  ];
  const h = measure.hubMetrics(rows);
  check('hub: the most frequent interior node is the top decile', h.hub_inflation.top_decile_nodes.length === 1 && h.hub_inflation.top_decile_nodes[0].node === 'H');
  check('hub: 2 of 4 strong paths cross the hub', h.hub_inflation.k === 2 && h.hub_inflation.n === 4 && approxEqual(h.hub_inflation.share, 0.5));
  check('provenance-routed strong counts a BrainRecord / SOURCED_FROM path', h.provenance_routed_strong === 1);
  check('diversity = distinct interior nodes / strong stamps', h.diversity.distinct_interior_nodes === 2 && approxEqual(h.diversity.ratio, 0.5));
}

// ---------------------------------------------------------------------------
// leg: --check's absent-record contract (77), proved against an injected
// absent path so the real record's presence never turns this into a SKIP.
// ---------------------------------------------------------------------------
function legCheckAbsentContract() {
  console.log('--- leg: --check (record absent -> 77) ---');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'measure-355-absent-'));
  const code = measure.checkRecord({ recordPath: path.join(tmp, 'hit-rate-record.json'), verificationPath: path.join(tmp, 'V.md') });
  check('checkRecord returns 77 when the record path does not exist', code === 77);
  check('checkRecord wrote no section when the record is absent', !fs.existsSync(path.join(tmp, 'V.md')));
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// leg: the real record (355-25 Task 3). Recomputes exactly, carries n and a
// Wilson interval on every rate, >= 20 judged per room, and the committed
// 355-VERIFICATION.md section is already the rendering of the record.
// ---------------------------------------------------------------------------
function isRate(r) {
  return !!r && Number.isInteger(r.k) && Number.isInteger(r.n) && r.n >= 0 && r.k >= 0 && r.k <= r.n &&
    typeof r.rate === 'number' && r.rate >= 0 && r.rate <= 1 &&
    Array.isArray(r.wilson) && r.wilson.length === 2 && r.wilson[0] >= 0 && r.wilson[1] <= 1 && r.wilson[0] <= r.wilson[1] &&
    approxEqual(r.rate, r.n > 0 ? r.k / r.n : 0);
}

function legRecordPresent() {
  console.log('--- leg: hit-rate record (present) ---');
  check('tests/fixtures/355-rooms/hit-rate-record.json exists (355-25 Task 3 wrote it)', fs.existsSync(measure.RECORD_PATH));
  if (!fs.existsSync(measure.RECORD_PATH)) return;
  const stored = fs.readFileSync(measure.RECORD_PATH, 'utf8');
  const record = JSON.parse(stored);

  const inputs = measure.loadRecordInputs();
  const a = measure.serializeRecord(measure.buildRecord(inputs));
  const b = measure.serializeRecord(measure.buildRecord(measure.loadRecordInputs()));
  check('buildRecord is deterministic (two recomputations are byte-identical)', a === b);
  check('the stored record equals the record recomputed from the raw files', a === stored);

  const required = ['per_room', 'pooled', 'per_tier', 'baseline', 'as_shown', 'unverified_share', 'reason_mix', 'not_called_share',
    'hub_inflation_share', 'provenance_routed_strong', 'diversity', 'false_friends_by_tier', 'already_known_by_tier', 'theo_latency_ms'];
  const missing = required.filter((k) => !(k in record));
  check('record carries every key the plan names', missing.length === 0, missing.join(','));

  const rooms = Object.keys(record.per_room);
  check('record covers the three fixture rooms', rooms.length === 3 && measure.DEFAULT_ROOM_NAMES.every((r) => rooms.indexOf(r) !== -1));
  check('every room has >= 20 judged pairings', rooms.every((r) => record.per_room[r].n >= 20));
  check('every per-room rate carries k, n, rate and a Wilson interval', rooms.every((r) => isRate(record.per_room[r])));
  check('pooled carries k, n, rate and a Wilson interval', isRate(record.pooled));
  check('pooled n equals the sum of per-room n', record.pooled.n === rooms.reduce((acc, r) => acc + record.per_room[r].n, 0));
  check('per-tier rates (strong, indirect, unverified) each carry k, n, rate and a Wilson interval', ['strong', 'indirect', 'unverified'].every((t) => isRate(record.per_tier[t])));
  check('per-tier n sums to the pooled n (every judged pairing has a stamp)', ['strong', 'indirect', 'unverified'].reduce((acc, t) => acc + record.per_tier[t].n, 0) === record.pooled.n);
  check('baseline carries k, n, rate and a Wilson interval, equal to the blind pooled rate', isRate(record.baseline) && record.baseline.k === record.pooled.k && record.baseline.n === record.pooled.n);
  check('as_shown pooled carries k, n, rate and a Wilson interval over the same n', isRate(record.as_shown.pooled) && record.as_shown.pooled.n === record.pooled.n);
  check('stamp_influence.gap equals as_shown minus baseline', approxEqual(record.stamp_influence.gap, record.as_shown.pooled.rate - record.baseline.rate));
  check('shares are fractions in [0, 1]', [record.unverified_share, record.not_called_share, record.hub_inflation_share].every((x) => typeof x === 'number' && x >= 0 && x <= 1));
  check('hub inflation names its degree source as the in-sample proxy', /in-sample proxy/.test(record.hub_inflation.proxy_source));
  check('Theo latency p50 <= p95, both finite, with n', Number.isFinite(record.theo_latency_ms.p50) && Number.isFinite(record.theo_latency_ms.p95) && record.theo_latency_ms.p50 <= record.theo_latency_ms.p95 && record.theo_latency_ms.n > 0);
  check('both sittings are the navigator (one labeler), sitting 1 blind, sitting 2 with stamps', record.labelers.sitting_1.labeler === 'navigator' && record.labelers.sitting_2.labeler === 'navigator' && record.labelers.sitting_1.stamps_shown === false && record.labelers.sitting_2.stamps_shown === true);
  const judgedRows = Object.values(record.judgments).reduce((acc, rows) => acc + rows.length, 0);
  check('the record lists every judged pairing, per room', judgedRows === record.pooled.n);

  // The committed section is already the rendering of the record: run
  // --check against a temp copy and require the copy to be unchanged.
  const verificationPath = measure.VERIFICATION_PATH;
  check('355-VERIFICATION.md exists', fs.existsSync(verificationPath));
  if (!fs.existsSync(verificationPath)) return;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'measure-355-verif-'));
  const copy = path.join(tmp, '355-VERIFICATION.md');
  fs.copyFileSync(verificationPath, copy);
  const code = measure.checkRecord({ verificationPath: copy });
  check('checkRecord returns 0 on the real record', code === 0);
  check('the committed hit-rate section is current (checkRecord left the copy unchanged)', fs.readFileSync(copy, 'utf8') === fs.readFileSync(verificationPath, 'utf8'));
  fs.rmSync(tmp, { recursive: true, force: true });

  const text = fs.readFileSync(verificationPath, 'utf8');
  const heading = measure.SECTION_HEADING;
  check('section heading appears exactly once', text.split(heading + '\n').length === 2);
  const section = text.slice(text.indexOf(heading), text.indexOf(measure.SECTION_END));
  check('section contains "Wilson", "unstamped baseline" and "first calibration point"', /Wilson/.test(section) && /unstamped baseline/.test(section) && /first calibration point/.test(section));
  check('section carries the regenerate / append-only header comment', /Regenerate with node scripts\/measure-355-hit-rate\.cjs record; verifiers append below, never overwrite this section\./.test(section));
  check('355-VERIFICATION.md makes no banned claim (works / improves discovery / validated / proven)', !/\b(works|improves discovery|validated|proven)\b/i.test(text));
  check('355-VERIFICATION.md carries no em-dash', text.indexOf('\u2014') === -1);
}

// ---------------------------------------------------------------------------
// leg: spliceSection keeps everything outside the section byte-for-byte
// ---------------------------------------------------------------------------
function legSplice() {
  console.log('--- leg: spliceSection ---');
  const H = measure.SECTION_HEADING;
  const E = measure.SECTION_END;
  const before = '# T\n\nintro\n\n';
  const after = '\n## Verifier notes\n\nappended text\n';
  const doc = before + H + '\n\nold body\n' + E + '\n' + after;
  const out = measure.spliceSection(doc, H + '\n\nnew body\n' + E + '\n');
  check('spliceSection replaces only the section body', out === before + H + '\n\nnew body\n' + E + '\n' + after);
  let threw = false;
  try { measure.spliceSection(before + H + '\n\nno end marker\n', H + '\n' + E + '\n'); } catch (_e) { threw = true; }
  check('spliceSection refuses a heading with no end marker', threw);
}

// ---------------------------------------------------------------------------
// leg: blind-before-stamped git order (D-32): the sitting-1 judgments commit
// is an ancestor of the stamps commit, which is an ancestor of the sitting-2
// judgments commit.
// ---------------------------------------------------------------------------
function legGitOrder() {
  console.log('--- leg: git order (sitting 1 -> stamps -> sitting 2) ---');
  const { spawnSync } = require('node:child_process');
  const firstAdd = (rel) => {
    const r = spawnSync('git', ['log', '--diff-filter=A', '--format=%H', '--', rel], { cwd: REPO_ROOT, encoding: 'utf8' });
    const lines = (r.stdout || '').trim().split('\n').filter(Boolean);
    return lines.length ? lines[lines.length - 1] : null;
  };
  const isAncestor = (a, b) => spawnSync('git', ['merge-base', '--is-ancestor', a, b], { cwd: REPO_ROOT }).status === 0;
  const j1 = firstAdd('tests/fixtures/355-rooms/judgments.json');
  const st = firstAdd('tests/fixtures/355-rooms/stamps.json');
  const j2 = firstAdd('tests/fixtures/355-rooms/judgments-stamped.json');
  check('judgments.json, stamps.json and judgments-stamped.json each have an adding commit', !!(j1 && st && j2), [j1, st, j2].join(' '));
  if (!(j1 && st && j2)) return;
  check('the sitting-1 judgments commit is an ancestor of the stamps commit', j1 !== st && isAncestor(j1, st));
  check('the stamps commit is an ancestor of the sitting-2 judgments commit', st !== j2 && isAncestor(st, j2));
}

// ---------------------------------------------------------------------------
// leg: CLI refuses a --room outside the fixture tree (spawned, not required)
// ---------------------------------------------------------------------------
function legCliRefusal() {
  console.log('--- leg: CLI refuses an outside --room ---');
  const { spawnSync } = require('node:child_process');
  const outsideTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'measure-355-cli-refuse-'));
  const scriptPath = path.join(REPO_ROOT, 'scripts', 'measure-355-hit-rate.cjs');
  const result = spawnSync(process.execPath, [scriptPath, 'export', '--unstamped', '--room', outsideTmp], { encoding: 'utf8' });
  check('CLI exits non-zero for --room outside tests/fixtures/355-rooms', result.status !== 0);
  fs.rmSync(outsideTmp, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// leg: --help
// ---------------------------------------------------------------------------
async function legHelp() {
  console.log('--- leg: --help ---');
  const code = await measure.cliMain(['--help']);
  check('cliMain(["--help"]) returns 0', code === 0);
  const codeNoArgs = await measure.cliMain([]);
  check('cliMain([]) (no command) returns 0 and shows help', codeNoArgs === 0);
}

async function main() {
  legGuard();
  legStaticScan();
  await legExportUnstamped();
  legWilson();
  legComputeRates();
  legFalseFriendDirection();
  legPercentile();
  legCheckAbsentContract();
  legRecordPresent();
  legSplice();
  legGitOrder();
  legCliRefusal();
  await legHelp();

  check('no network attempt was made anywhere in this file (hygiene-355 installNetGuard)', netGuard.attempts() === 0);

  netGuard.restore();
  const code = summary();
  process.exitCode = code;
}

main().catch((err) => {
  netGuard.restore();
  console.error(err && err.stack ? err.stack : err);
  process.exitCode = 1;
});
