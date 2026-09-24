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
 * Exit 0 on full green. The `--check` leg (77 while
 * tests/fixtures/355-rooms/hit-rate-record.json is absent) is asserted as a
 * VALUE inside this file, not propagated as this file's own exit code --
 * this file itself exits 0 when every check (including that one) passes.
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
// leg: --check exits 77 while hit-rate-record.json is absent
// ---------------------------------------------------------------------------
async function legCheckAbsent() {
  console.log('--- leg: --check (record absent) ---');
  check('tests/fixtures/355-rooms/hit-rate-record.json does not exist yet (355-25 writes it)', !fs.existsSync(measure.RECORD_PATH));
  const code = await measure.cliMain(['--check']);
  check('cliMain(["--check"]) returns 77 while the record is absent', code === 77);
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
  await legCheckAbsent();
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
