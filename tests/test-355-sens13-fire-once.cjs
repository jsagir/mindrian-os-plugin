#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection
 * engines) Plan 22 Task 2 (HIPS-06, HIPS-05, D-41, D-42). Proof that:
 *
 *   1. SENS-13 (sensor-eureka.cjs, already fire-once-capable since 355-19)
 *      fires through decide() exactly once per opportunity_handle: the
 *      surfacing seam (lib/core/navigation-engine.cjs, this plan's own
 *      addition) calls markEurekaReachSurfaced the moment it selects the
 *      winning reach, so a SECOND decide() dispatch no longer sees it.
 *   2. dispatchSensors ALONE (no decide()) never marks the ledger -- the
 *      sensor itself stays pure; the dedup lives at the surfacing seam,
 *      not in the sensor (D-42's own design note, asserted here).
 *   3. lib/hmi/dial-label-composer.cjs's stamped-finding card variant
 *      renders identically to verification-stamp-format.cjs's
 *      formatStampLines(stamp, 'card')[0] for the SAME stamp, fed straight
 *      from the fired reach's own evidence bag (D-41).
 *   4. A markEurekaReachSurfaced failure (an unwritable ledger path) never
 *      throws out of decide() (soft-fail, D-42).
 *
 * Test hygiene contract (every 355 test): scrub TYPESAFE_API_KEY and install
 * the net guard via tests/helpers/hygiene-355.cjs BEFORE requiring any repo
 * module; assert attempts() === 0 as the last check.
 *
 * No em-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only.
 */

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const hygiene = require('./helpers/hygiene-355.cjs');

const wasKeyPresent = hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

try {
  require('node:sqlite');
} catch (_e) {
  // This suite does not open room.db itself, but every other 355 test does,
  // and tests/run-all-355.sh expects the same SKIP contract uniformly.
}

const REPO = path.join(__dirname, '..');
const checker = hygiene.makeChecker('test-355-sens13-fire-once');
const { check } = checker;

const { dispatchSensors } = require(path.join(REPO, 'lib', 'core', 'insight-sensors.cjs'));
const engine = require(path.join(REPO, 'lib', 'core', 'navigation-engine.cjs'));
const eurekaReachRunner = require(path.join(REPO, 'lib', 'core', 'eureka', 'eureka-reach-runner.cjs'));
const dialLabelComposer = require(path.join(REPO, 'lib', 'hmi', 'dial-label-composer.cjs'));
const { formatStampLines } = require(path.join(REPO, 'lib', 'core', 'verification-stamp-format.cjs'));

// A verified (strong) stamp and an unverified stamp -- both zod-legal shapes
// per lib/core/verification-stamp.cjs's Stamp schema, hand-built (never
// requiring verification-stamp.cjs's zod schema here -- this suite proves
// the render/dedup contract, not the Stamp adapter itself).
const VERIFIED_STAMP = Object.freeze({
  verification: 'strong', backend: 'theo', direction: 'structural_transfer', judge: 'none',
  path: Object.freeze({
    nodes: ['Reverse Salient Analysis', 'Six Thinking Hats'],
    labels: ['Reverse Salient Analysis', 'Six Thinking Hats'],
    edges: ['EXTENDS'],
  }),
});
const UNVERIFIED_STAMP = Object.freeze({
  verification: 'unverified', backend: 'theo', direction: 'structural_transfer', judge: 'none',
  reason: 'no_path_within_3_hops',
});

function makeTmpRoom(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-355-22-' + label + '-'));
  const roomDir = path.join(root, 'room');
  fs.mkdirSync(roomDir, { recursive: true });
  return {
    root: root, roomDir: roomDir,
    cleanup: function cleanup() {
      try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
    },
  };
}

// seedSideChannel(roomDir, stamp, handle) -- writes a fresh, guard-cleared,
// firing-band v2 side channel via the SAME writer 355-20's filing layer
// calls (writeStampedSideChannel), never a hand-built JSON file.
function seedSideChannel(roomDir, stamp, handle) {
  const wrote = eurekaReachRunner.writeStampedSideChannel(roomDir, {
    score: { direction: 'structural_transfer', abs_diff: 0.5, band: 'high', passes: true },
    guard: { verdict: 'transferable', confidence: 'high', tags: [] },
    a: { handle: 'nodeA', text: 'alpha finding text' },
    b: { handle: 'nodeB', text: 'omega finding text' },
    stamp: stamp,
    opportunityHandle: handle,
  });
  if (!wrote || wrote.ok !== true) throw new Error('seedSideChannel failed: ' + JSON.stringify(wrote));
  return wrote;
}

function readLedger(roomDir) {
  const ledgerPath = path.join(roomDir, '.mindrian', 'eureka-reach-ledger.json');
  if (!fs.existsSync(ledgerPath)) return null;
  return JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
}

function eurekaReachesOf(reaches) {
  return (Array.isArray(reaches) ? reaches : []).filter((r) => r && r.signal === 'eureka_bridge');
}

const TURN = Object.freeze({ turn_count: 6 });

// -------------------------------------------------------------------
// 1. Two consecutive decide() calls: the first surfaces SENS-13 exactly
//    once and marks the ledger; the second no longer sees it.
// -------------------------------------------------------------------
function caseDecideFireOnce() {
  process.stdout.write('\n-- 1: decide() surfaces SENS-13 once, then dedupes on the next dispatch --\n');
  const room = makeTmpRoom('decide-fire-once');
  try {
    const handle = 'opportunity:test:decide-fire-once';
    seedSideChannel(room.roomDir, VERIFIED_STAMP, handle);
    const ctx = { roomDir: room.roomDir };

    const beforeReaches = dispatchSensors(TURN, {}, ctx);
    const beforeEureka = eurekaReachesOf(beforeReaches);
    check('before any decide(): exactly one fired reach carries signal eureka_bridge', beforeEureka.length === 1, JSON.stringify(beforeReaches.map((r) => r.reach_id)));
    check('the fired reach is deep_research (SENS-13 rides the frozen reach)', beforeEureka[0] && beforeEureka[0].reach_id === 'deep_research', JSON.stringify(beforeEureka[0]));

    const decision1 = engine.decide(TURN, ctx);
    check('decide() never throws on the first dispatch', decision1 && typeof decision1 === 'object');

    const ledgerAfterFirst = readLedger(room.roomDir);
    check('the fire-once ledger carries the handle after the first decide()', !!ledgerAfterFirst && !!ledgerAfterFirst.entries && Object.prototype.hasOwnProperty.call(ledgerAfterFirst.entries, handle), JSON.stringify(ledgerAfterFirst));

    const afterReaches = dispatchSensors(TURN, {}, ctx);
    const afterEureka = eurekaReachesOf(afterReaches);
    check('after the first decide(): the SAME dispatchSensors call surfaces NO eureka_bridge reach', afterEureka.length === 0, JSON.stringify(afterReaches.map((r) => r.reach_id)));

    const decision2 = engine.decide(TURN, ctx);
    check('decide() never throws on the second dispatch', decision2 && typeof decision2 === 'object');

    const ledgerAfterSecond = readLedger(room.roomDir);
    const entryCount = ledgerAfterSecond && ledgerAfterSecond.entries ? Object.keys(ledgerAfterSecond.entries).length : -1;
    check('the ledger still carries exactly one entry for this handle after the second decide() (idempotent)', entryCount === 1, JSON.stringify(ledgerAfterSecond));
  } finally {
    room.cleanup();
  }
}

// -------------------------------------------------------------------
// 2. dispatchSensors alone (never decide()) fires SENS-13 on every call --
//    the sensor is pure; the dedup lives at the surfacing seam only.
// -------------------------------------------------------------------
function caseDispatchSensorsAloneNeverDedupes() {
  process.stdout.write('\n-- 2: dispatchSensors alone (no decide()) fires SENS-13 every time --\n');
  const room = makeTmpRoom('dispatch-alone');
  try {
    const handle = 'opportunity:test:dispatch-alone';
    seedSideChannel(room.roomDir, VERIFIED_STAMP, handle);
    const ctx = { roomDir: room.roomDir };

    const first = eurekaReachesOf(dispatchSensors(TURN, {}, ctx));
    check('dispatchSensors call 1 (no decide() in between): fires eureka_bridge', first.length === 1, JSON.stringify(first));

    const second = eurekaReachesOf(dispatchSensors(TURN, {}, ctx));
    check('dispatchSensors call 2 (still no decide() in between): fires eureka_bridge AGAIN', second.length === 1, JSON.stringify(second));

    check('the ledger was never written by dispatchSensors alone', readLedger(room.roomDir) === null);
  } finally {
    room.cleanup();
  }
}

// -------------------------------------------------------------------
// 3. composeLabel parity: the fired reach's own evidence bag, fed straight
//    into composeLabel, renders byte-identical to formatStampLines(stamp,
//    'card')[0] for the SAME stamp -- verified and unverified legs.
// -------------------------------------------------------------------
function caseComposeLabelParity() {
  process.stdout.write('\n-- 3: composeLabel(deep_research, slotContext-from-the-reach) matches formatStampLines(stamp, card) --\n');

  const verifiedRoom = makeTmpRoom('compose-verified');
  try {
    seedSideChannel(verifiedRoom.roomDir, VERIFIED_STAMP, 'opportunity:test:compose-verified');
    const reaches = eurekaReachesOf(dispatchSensors(TURN, {}, { roomDir: verifiedRoom.roomDir }));
    check('a verified stamp fires exactly one eureka_bridge reach for the parity check', reaches.length === 1, JSON.stringify(reaches));
    const reach = reaches[0];
    const slotContext = {
      signal: reach.signal,
      stamp_verification: reach.evidence.stamp_verification,
      stamp_path: reach.evidence.stamp_path,
    };
    const composed = dialLabelComposer.composeLabel('deep_research', slotContext);
    const expected = formatStampLines(VERIFIED_STAMP, 'card')[0];
    check('composeLabel renders "verified through <stamp_path>" for a verified stamp', composed.label === 'verified through ' + reach.evidence.stamp_path, composed.label);
    check('composeLabel output is byte-identical to formatStampLines(stamp, card)[0] for the same stamp (verified)', composed.label === expected, JSON.stringify({ composed: composed.label, expected: expected }));
    check('no D-30 bare decimal or percent token in the composed label', !/(^|[^0-9A-Za-z.])(0?\.[0-9]+|1\.0+)([^0-9.]|$)/.test(composed.label) && !/[0-9]+%/.test(composed.label), composed.label);
  } finally {
    verifiedRoom.cleanup();
  }

  const unverifiedRoom = makeTmpRoom('compose-unverified');
  try {
    seedSideChannel(unverifiedRoom.roomDir, UNVERIFIED_STAMP, 'opportunity:test:compose-unverified');
    const reaches = eurekaReachesOf(dispatchSensors(TURN, {}, { roomDir: unverifiedRoom.roomDir }));
    check('an unverified stamp fires exactly one eureka_bridge reach for the parity check', reaches.length === 1, JSON.stringify(reaches));
    const reach = reaches[0];
    const slotContext = {
      signal: reach.signal,
      stamp_verification: reach.evidence.stamp_verification,
      stamp_path: reach.evidence.stamp_path,
    };
    const composed = dialLabelComposer.composeLabel('deep_research', slotContext);
    const expected = formatStampLines(UNVERIFIED_STAMP, 'card')[0];
    check("composeLabel renders exactly 'unverified - novel or hallucinated, verify with an expert' for an unverified stamp", composed.label === 'unverified - novel or hallucinated, verify with an expert', composed.label);
    check('composeLabel output is byte-identical to formatStampLines(stamp, card)[0] for the same stamp (unverified)', composed.label === expected, JSON.stringify({ composed: composed.label, expected: expected }));
  } finally {
    unverifiedRoom.cleanup();
  }
}

// -------------------------------------------------------------------
// 4. A markEurekaReachSurfaced failure (an unwritable ledger PATH -- forced
//    by pre-creating the ledger path as a directory, so the atomic rename
//    step fails regardless of the process's own file permissions/uid)
//    never throws out of decide().
// -------------------------------------------------------------------
function caseSoftFailNeverThrows() {
  process.stdout.write('\n-- 4: a markEurekaReachSurfaced failure never throws out of decide() --\n');
  const room = makeTmpRoom('soft-fail');
  try {
    const handle = 'opportunity:test:soft-fail';
    seedSideChannel(room.roomDir, VERIFIED_STAMP, handle);

    // Force the ledger WRITE to fail: pre-create the ledger's own path as a
    // DIRECTORY. atomicWriteJson's final fs.renameSync(tmpFile, ledgerPath)
    // then fails (a file cannot rename onto an existing directory) -- this
    // fails deterministically regardless of uid/permissions (unlike a
    // read-only directory, which a root-run process would bypass).
    const ledgerPath = path.join(room.roomDir, '.mindrian', 'eureka-reach-ledger.json');
    fs.mkdirSync(ledgerPath, { recursive: true });

    let decision = null;
    let threw = null;
    try {
      decision = engine.decide(TURN, { roomDir: room.roomDir });
    } catch (e) {
      threw = e;
    }
    check('decide() does not throw when the ledger write fails', threw === null, threw && (threw.message || String(threw)));
    check('decide() still returns a valid decision object', !!decision && typeof decision === 'object' && !!decision.decision_trace);

    // The ledger path is still the directory we pre-created (the write
    // genuinely failed, proving this is not a false-positive no-op).
    check('the forced-failure ledger path is still a directory (the write genuinely failed)', fs.statSync(ledgerPath).isDirectory());
  } finally {
    room.cleanup();
  }
}

function run() {
  process.stdout.write('Plan 355-22 Task 2 (D-41, D-42, HIPS-06, HIPS-05): SENS-13 fire-once + the stamped reach card\n');

  caseDecideFireOnce();
  caseDispatchSensorsAloneNeverDedupes();
  caseComposeLabelParity();
  caseSoftFailNeverThrows();

  check('installNetGuard: zero fetch attempts', netGuard.attempts() === 0);
  netGuard.restore();
  process.stdout.write('scrubVendorKey found a pre-set TYPESAFE_API_KEY: ' + wasKeyPresent + '\n');
  process.exit(checker.summary());
}

run();
