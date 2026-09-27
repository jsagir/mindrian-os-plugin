#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355.1 Plan 11 (RED then GREEN) -- test-3551-surfacing: pins AMB-05
 * and AMB-07 on the card. SENS-13 (lib/core/sensors/sensor-eureka.cjs)
 * shows the stamped ambient finding once, through the 355-22 fire-once path,
 * framed by the room's confirmed problem-type framing -- a single new
 * `framing` enum in the evidence bag, a single new confirmed-phrase prefix
 * on the rendered card, everything unverified stays off the card.
 *
 * Legs covered (355.1-11-PLAN.md Task 1 <behavior>):
 *   1. setup + CLI: two decide() calls (turn_count 6, the 355-22 fire-once
 *      mark) -- the first surfaces exactly one eureka_bridge reach carrying
 *      evidence.framing + evidence.opportunity_handle; the second is silent.
 *   2. label: composeLabel('deep_research', slotContext-from-the-reach)
 *      matches FRAMING_PHRASES[framing] + ' -- ' + the 355-22 stamped line,
 *      for each of the three confirmed framings.
 *   3. regression: a command-path side channel (no opportunity_handle, no
 *      matching delta state) yields evidence.framing === '' and a label
 *      byte-identical to Phase 355's own unframed output.
 *   4. tier gate: a composition whose findings are all unverified writes no
 *      side channel; dispatchSensors, decide() and the MCP pull all see no
 *      SENS-13 reach for that room.
 *   5. MCP pull: dispatchCandidateReaches fires the same framed reach on two
 *      consecutive pulls (pure read; the Stop-time close-out mark is
 *      plan 355.1-13's own seam).
 *   6. render guards + negative controls over every composed label and
 *      every FRAMING_PHRASES value.
 *   7. static: sensor-eureka.cjs stays zod-free, stamp-module-free,
 *      writeFileSync/renameSync-free, and the sensor itself writes no file.
 *
 * Test hygiene contract (every 355/355.1 test): scrub TYPESAFE_API_KEY and
 * install the net guard via tests/helpers/hygiene-355.cjs BEFORE requiring
 * any repo module; assert attempts() === 0 as the last check.
 *
 * No em-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only.
 */

const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const hygiene = require('./helpers/hygiene-355.cjs');

const wasKeyPresent = hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

try {
  require('node:sqlite');
} catch (_e) {
  process.stdout.write('SKIP test-3551-surfacing.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const REPO = path.join(__dirname, '..');
const checker = hygiene.makeChecker('test-3551-surfacing');
const { check } = checker;

const { buildDeltaRoom } = require('./helpers/fixture-room-3551.cjs');
const ambientRun = require(path.join(REPO, 'lib', 'core', 'ambient-run.cjs'));
const eurekaReachRunner = require(path.join(REPO, 'lib', 'core', 'eureka', 'eureka-reach-runner.cjs'));
const scoutCadenceGuard = require(path.join(REPO, 'scripts', 'scout-cadence-guard.cjs'));
const { dispatchSensors } = require(path.join(REPO, 'lib', 'core', 'insight-sensors.cjs'));
const engine = require(path.join(REPO, 'lib', 'core', 'navigation-engine.cjs'));
const dialLabelComposer = require(path.join(REPO, 'lib', 'hmi', 'dial-label-composer.cjs'));
const { formatStampLines } = require(path.join(REPO, 'lib', 'core', 'verification-stamp-format.cjs'));
const directionConvention = require(path.join(REPO, 'lib', 'core', 'direction-convention.cjs'));
const sensorsTool = require(path.join(REPO, 'lib', 'mcp', 'tools', 'sensors.cjs'));
const sensorEurekaModule = require(path.join(REPO, 'lib', 'core', 'sensors', 'sensor-eureka.cjs'));
const sensorRoomDelta = require(path.join(REPO, 'lib', 'core', 'sensors', 'sensor-room-delta.cjs'));

const { FRAMING_IDS, FRAMING_PHRASES } = directionConvention;

// ---------------------------------------------------------------------------
// Shared fixtures + helpers.
// ---------------------------------------------------------------------------

const TURN = Object.freeze({ turn_count: 6 });

const INDIRECT_STAMP = Object.freeze({
  verification: 'indirect', backend: 'theo', direction: 'structural_transfer', judge: 'none',
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

const rooms = [];
function trackedRoom(label) {
  const r = buildDeltaRoom(label);
  rooms.push(r);
  return r;
}
function cleanupAllRooms() {
  for (const r of rooms) {
    try { r.cleanup(); } catch (_e) { /* best-effort */ }
  }
}

function eurekaReachesOf(reaches) {
  return (Array.isArray(reaches) ? reaches : []).filter((r) => r && r.signal === 'eureka_bridge');
}

function fixedDeltaHash(seed) {
  return crypto.createHash('sha256').update(String(seed), 'utf8').digest('hex');
}

// seedIndirectComposition(room, stamp) -- runs the REAL runAmbientComposition
// (lib/core/ambient-run.cjs) with an injected adapter returning ONE finding
// carrying `stamp` and an injected measureAndGuard that always clears, so the
// resulting last-eureka.json side channel + opportunity node are the SAME
// shape production writes (never a hand-built JSON file). Returns the
// composition result ({ card, surfaced_via, ... }).
async function seedIndirectComposition(room, stamp) {
  const finding = {
    producer: 'eureka',
    a: { handle: 'nodeA', text: 'alpha finding text' },
    b: { handle: 'nodeB', text: 'omega finding text' },
    stamp: stamp,
    rank: 0,
  };
  const adapters = {
    eureka: async () => ({ outcome: 'no_candidate', findings: [finding] }),
    'find-connections': async () => ({ outcome: 'no_candidate', findings: [] }),
    'find-bottlenecks': async () => ({ outcome: 'no_candidate', findings: [] }),
    hsi: async () => ({ outcome: 'no_candidate', findings: [] }),
    whitespace: async () => ({ outcome: 'no_candidate', findings: [] }),
  };
  const measureAndGuard = async () => ({
    ok: true,
    score: { direction: 'structural_transfer', abs_diff: 0.5, band: 'opportunity', passes: true, semantic: 0.1, lexical: 0.1 },
    guard: { cleared: true, verdict: 'transferable', confidence: 'high', tags: [] },
  });
  const res = await ambientRun.runAmbientComposition(room.roomDir, { deps: { adapters: adapters, measureAndGuard: measureAndGuard } });
  if (!res || !res.card) throw new Error('seedIndirectComposition: expected a card, got: ' + JSON.stringify(res));
  return res;
}

// writeMatchingDeltaState(roomDir, opportunityHandle, framing) -- the SAME
// closed shape lib/core/ambient-run.cjs's runAmbientInChild writes at the
// end of a completed run (scripts/scout-cadence-guard.cjs's own writer).
function writeMatchingDeltaState(roomDir, opportunityHandle, framing) {
  const iso = new Date().toISOString();
  const w = scoutCadenceGuard.writeRoomDeltaState(roomDir, {
    schema_version: 1,
    evaluated_at: iso,
    seam: 'stop_hook',
    classes: ['e'],
    delta_hash: fixedDeltaHash('surfacing:' + opportunityHandle + ':' + framing),
    run_state: 'completed',
    material_id: null,
    opportunity_handle: opportunityHandle,
    surfaced_via: 'sens13',
    framing: framing,
  });
  if (!w.ok) throw new Error('writeMatchingDeltaState failed: ' + JSON.stringify(w));
}

// seedCommandPathSideChannel(roomDir, stamp) -- a v2 side channel with NO
// opportunity_handle at all, mirroring the hook-path scan producer (the
// command path). Never writes a delta-state file.
function seedCommandPathSideChannel(roomDir, stamp) {
  const wrote = eurekaReachRunner.writeStampedSideChannel(roomDir, {
    score: { direction: 'structural_transfer', abs_diff: 0.5, band: 'high', passes: true },
    guard: { verdict: 'transferable', confidence: 'high', tags: [] },
    a: { handle: 'nodeA', text: 'alpha finding text' },
    b: { handle: 'nodeB', text: 'omega finding text' },
    stamp: stamp,
    opportunityHandle: null,
  });
  if (!wrote || wrote.ok !== true) throw new Error('seedCommandPathSideChannel failed: ' + JSON.stringify(wrote));
  return wrote;
}

// ---------------------------------------------------------------------------
// Render guards (Canon Part 12 / AC3): the D-30 decimal check, the percent
// check, the count-next-to-a-finding check, the banned-praise/over-claim
// check, and the em-dash check. Every composed label is swept through here.
// ---------------------------------------------------------------------------

const DECIMAL_RX = /(^|[^0-9A-Za-z.])(0?\.[0-9]+|1\.0+)([^0-9.]|$)/;
const PERCENT_RX = /[0-9]+%/;
const COUNT_RX = /\b[0-9]+\s+(new\s+)?(finding|connection|opportunit)/i;
const BANNED_CLAIMS_RX = /\b(breakthrough|convergent|validated|proven|great|amazing|excellent|brilliant)\b/i;
const EM_DASH_CHAR = String.fromCharCode(0x2014);

function sweepRenderGuard(label, text) {
  check(label + ': no D-30 bare decimal or percent-adjacent literal', !DECIMAL_RX.test(text), JSON.stringify(text));
  check(label + ': no bare percent token', !PERCENT_RX.test(text), JSON.stringify(text));
  check(label + ': no count-next-to-a-finding phrase', !COUNT_RX.test(text), JSON.stringify(text));
  check(label + ': no banned over-claim or praise word', !BANNED_CLAIMS_RX.test(text), JSON.stringify(text));
  check(label + ': no literal U+2014 em-dash', text.indexOf(EM_DASH_CHAR) === -1, JSON.stringify(text));
}

// ---------------------------------------------------------------------------
// 1 + setup: two decide() calls fire-once, one CLI card, framed.
// ---------------------------------------------------------------------------
async function caseCliOneCardFramed() {
  process.stdout.write('\n-- CLI: two decide() calls, one framed card, then silence --\n');
  const room = trackedRoom('cli-fire-once');
  const compRes = await seedIndirectComposition(room, INDIRECT_STAMP);
  const handle = compRes.card.opportunity_handle;
  writeMatchingDeltaState(room.roomDir, handle, 'find_the_problem');

  const ctx = { roomDir: room.roomDir };
  const before = eurekaReachesOf(dispatchSensors(TURN, {}, ctx));
  check('CLI: exactly one eureka_bridge reach fires before any decide()', before.length === 1, JSON.stringify(before.map((r) => r.reach_id)));
  check('CLI: the fired reach is deep_research (SENS-13 rides the frozen reach)', before[0] && before[0].reach_id === 'deep_research');
  check("CLI: evidence.framing === 'find_the_problem'", before[0].evidence.framing === 'find_the_problem', before[0].evidence.framing);
  check('CLI: evidence.opportunity_handle equals the node id', before[0].evidence.opportunity_handle === handle);
  sweepRenderGuard('CLI raw evidence carries no rendered text', '');

  const decision1 = engine.decide(TURN, ctx);
  check('decide() never throws on the first dispatch', decision1 && typeof decision1 === 'object');

  const ledgerPath = path.join(room.roomDir, '.mindrian', 'eureka-reach-ledger.json');
  const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
  check('the fire-once ledger carries the handle after the first decide()', !!ledger && !!ledger.entries && Object.prototype.hasOwnProperty.call(ledger.entries, handle));

  const after = eurekaReachesOf(dispatchSensors(TURN, {}, ctx));
  check("CLI: 355-22's mark (extended not replaced) -- the SAME dispatchSensors call now surfaces NO eureka_bridge reach", after.length === 0, JSON.stringify(after));

  const decision2 = engine.decide(TURN, ctx);
  check('decide() never throws on the second dispatch', decision2 && typeof decision2 === 'object');
}

// ---------------------------------------------------------------------------
// 2. label: composeLabel matches FRAMING_PHRASES[framing] + ' -- ' + the
//    355-22 stamped line, for each of the three confirmed framings.
// ---------------------------------------------------------------------------
async function caseLabelPerFraming() {
  process.stdout.write('\n-- label: composeLabel(deep_research, slotContext-from-the-reach) per framing --\n');
  for (const framing of FRAMING_IDS) {
    const room = trackedRoom('label-' + framing);
    const compRes = await seedIndirectComposition(room, INDIRECT_STAMP);
    const handle = compRes.card.opportunity_handle;
    writeMatchingDeltaState(room.roomDir, handle, framing);

    const reaches = eurekaReachesOf(dispatchSensors(TURN, {}, { roomDir: room.roomDir }));
    check('label ' + framing + ': exactly one eureka_bridge reach', reaches.length === 1, JSON.stringify(reaches));
    const reach = reaches[0];
    check('label ' + framing + ": evidence.framing matches", reach.evidence.framing === framing, reach.evidence.framing);

    const slotContext = {
      signal: reach.signal,
      stamp_verification: reach.evidence.stamp_verification,
      stamp_path: reach.evidence.stamp_path,
      framing: reach.evidence.framing,
    };
    const composed = dialLabelComposer.composeLabel('deep_research', slotContext);
    const stampedLine = formatStampLines(INDIRECT_STAMP, 'card')[0];
    const expected = FRAMING_PHRASES[framing] + ' -- ' + stampedLine;
    check('label ' + framing + ': composeLabel matches FRAMING_PHRASES[framing] + " -- " + the stamped line', composed.label === expected, composed.label);
    sweepRenderGuard('label ' + framing, composed.label);
  }
}

// ---------------------------------------------------------------------------
// 3. regression: a command-path side channel (no opportunity_handle, no
//    matching delta state) yields evidence.framing === '' and a label
//    byte-identical to Phase 355's own unframed output.
// ---------------------------------------------------------------------------
function caseRegressionCommandPath() {
  process.stdout.write('\n-- regression: a command-path scan (no opportunity_handle) never carries a framing --\n');
  const room = trackedRoom('regression-command-path');
  seedCommandPathSideChannel(room.roomDir, INDIRECT_STAMP);
  // No last-room-delta.json is written at all for this room.

  const reaches = eurekaReachesOf(dispatchSensors(TURN, {}, { roomDir: room.roomDir }));
  check('regression: exactly one eureka_bridge reach fires for a command-path side channel', reaches.length === 1, JSON.stringify(reaches));
  const reach = reaches[0];
  check("regression: evidence.framing === '' (no opportunity_handle, no delta state to match)", reach.evidence.framing === '', JSON.stringify(reach.evidence.framing));
  check("regression: evidence.opportunity_handle === '' (the command path never sets one)", reach.evidence.opportunity_handle === '');

  const slotContext = { signal: reach.signal, stamp_verification: reach.evidence.stamp_verification, stamp_path: reach.evidence.stamp_path };
  const composed = dialLabelComposer.composeLabel('deep_research', slotContext);
  const expected = formatStampLines(INDIRECT_STAMP, 'card')[0];
  check('regression: composeLabel output is byte-identical to Phase 355 D-41 unframed output', composed.label === expected, composed.label);
  sweepRenderGuard('regression unframed label', composed.label);
}

// ---------------------------------------------------------------------------
// 4. tier gate: a composition whose findings are all unverified writes no
//    side channel; dispatchSensors, decide() and the MCP pull all stay silent.
// ---------------------------------------------------------------------------
async function caseTierGateAllUnverified() {
  process.stdout.write('\n-- tier gate: an all-unverified composition writes no side channel, no SENS-13 anywhere --\n');
  const room = trackedRoom('tier-gate');
  const finding = { producer: 'eureka', a: { handle: 'ea', text: 'EA' }, b: { handle: 'eb', text: 'EB' }, stamp: UNVERIFIED_STAMP, rank: 0 };
  const adapters = {
    eureka: async () => ({ outcome: 'no_candidate', findings: [finding] }),
    'find-connections': async () => ({ outcome: 'no_candidate', findings: [] }),
    'find-bottlenecks': async () => ({ outcome: 'no_candidate', findings: [] }),
    hsi: async () => ({ outcome: 'no_candidate', findings: [] }),
    whitespace: async () => ({ outcome: 'no_candidate', findings: [] }),
  };
  const res = await ambientRun.runAmbientComposition(room.roomDir, { deps: { adapters: adapters } });
  check('tier gate: card stays null when every finding is unverified', res.card === null, JSON.stringify(res.card));
  const lastEurekaPath = path.join(room.roomDir, '.mindrian', 'last-eureka.json');
  check('tier gate: no last-eureka.json side channel is written', !fs.existsSync(lastEurekaPath));

  const ctx = { roomDir: room.roomDir };
  check('tier gate: dispatchSensors surfaces no eureka_bridge reach', eurekaReachesOf(dispatchSensors(TURN, {}, ctx)).length === 0);

  const decision = engine.decide(TURN, ctx);
  check('tier gate: decide() never throws with no side channel to consider', decision && typeof decision === 'object');
  const ledgerPath = path.join(room.roomDir, '.mindrian', 'eureka-reach-ledger.json');
  check('tier gate: decide() marks no fire-once ledger entry (nothing to surface)', !fs.existsSync(ledgerPath));

  const pull = sensorsTool._internal.dispatchCandidateReaches('sess-tier-gate', room.roomDir, {});
  check('tier gate: the MCP pull (dispatchCandidateReaches) surfaces no eureka_bridge reach', eurekaReachesOf(pull.reaches).length === 0, JSON.stringify(pull.reaches));
}

// ---------------------------------------------------------------------------
// 5. MCP pull: dispatchCandidateReaches fires the SAME framed reach on two
//    consecutive pulls (pure read; the Stop-time close-out mark is
//    plan 355.1-13's own seam, documented here as a pinned fact).
// ---------------------------------------------------------------------------
async function caseMcpPullTwoConsecutive() {
  process.stdout.write('\n-- MCP pull: dispatchCandidateReaches fires the framed reach on two consecutive pulls --\n');
  const room = trackedRoom('mcp-pull');
  const compRes = await seedIndirectComposition(room, INDIRECT_STAMP);
  const handle = compRes.card.opportunity_handle;
  writeMatchingDeltaState(room.roomDir, handle, 'pursue_or_drop');

  const pull1 = sensorsTool._internal.dispatchCandidateReaches('sess-mcp-pull', room.roomDir, {});
  const eureka1 = eurekaReachesOf(pull1.reaches);
  check('MCP pull 1: exactly one eureka_bridge reach, framed', eureka1.length === 1 && eureka1[0].evidence.framing === 'pursue_or_drop', JSON.stringify(eureka1));

  const pull2 = sensorsTool._internal.dispatchCandidateReaches('sess-mcp-pull', room.roomDir, {});
  const eureka2 = eurekaReachesOf(pull2.reaches);
  check('MCP pull 2 (no decide()/close-out in between, pure read): fires eureka_bridge AGAIN, same framing', eureka2.length === 1 && eureka2[0].evidence.framing === 'pursue_or_drop', JSON.stringify(eureka2));
}

// ---------------------------------------------------------------------------
// 6. render guards over every FRAMING_PHRASES value + negative controls.
// ---------------------------------------------------------------------------
function caseRenderGuardsOverFramingPhrases() {
  process.stdout.write('\n-- render guards: every FRAMING_PHRASES value --\n');
  for (const framing of FRAMING_IDS) {
    sweepRenderGuard('FRAMING_PHRASES.' + framing, FRAMING_PHRASES[framing]);
  }
}

function caseNegativeControls() {
  process.stdout.write('\n-- negative controls: the render guard actually catches a planted violation --\n');
  const decimalLabel = dialLabelComposer.composeLabel('deep_research', {
    signal: 'eureka_bridge', stamp_verification: 'strong', stamp_path: 'A (0.87) B',
  }).label;
  check('negative control: a planted decimal literal in stamp_path is caught by the D-30 regex', DECIMAL_RX.test(decimalLabel) === true, decimalLabel);

  const countLabel = 'Larry found 3 new connections in this room.';
  check('negative control: a planted count-next-to-a-finding phrase is caught by the count regex', COUNT_RX.test(countLabel) === true, countLabel);
}

// ---------------------------------------------------------------------------
// 7. static: sensor-eureka.cjs stays zod-free / stamp-module-free /
//    writeFileSync-free; the sensor itself writes no file.
// ---------------------------------------------------------------------------
function caseStaticSensorEureka() {
  process.stdout.write('\n-- static: sensor-eureka.cjs stays zod-free, stamp-module-free, write-free --\n');
  const filePath = path.join(REPO, 'lib', 'core', 'sensors', 'sensor-eureka.cjs');
  const lines = hygiene.nonCommentLines(filePath);
  const joined = lines.join('\n');
  check("static: sensor-eureka.cjs carries no require('zod') on a non-comment line", !/require\(\s*['"]zod['"]\s*\)/.test(joined));
  check('static: sensor-eureka.cjs carries no verification-stamp.cjs require on a non-comment line', !/verification-stamp\.cjs/.test(joined));
  check('static: sensor-eureka.cjs carries no writeFileSync/renameSync call on a non-comment line', !/\b(writeFileSync|renameSync)\s*\(/.test(joined));

  // Pinned equal, the sensor-url-ingest.cjs replicated-relpath precedent:
  // sensor-eureka.cjs's own ROOM_DELTA_STATE_RELPATH must never drift from
  // sensor-room-delta.cjs's DELTA_STATE_RELPATH (the file both this sensor
  // and the SENS-21 sensor read).
  check('static: ROOM_DELTA_STATE_RELPATH is pinned equal to sensor-room-delta.cjs DELTA_STATE_RELPATH', sensorEurekaModule.ROOM_DELTA_STATE_RELPATH === sensorRoomDelta.DELTA_STATE_RELPATH);
  check('static: ROOM_DELTA_STATE_SCHEMA_VERSION is pinned equal to sensor-room-delta.cjs DELTA_STATE_SCHEMA_VERSION', sensorEurekaModule.ROOM_DELTA_STATE_SCHEMA_VERSION === sensorRoomDelta.DELTA_STATE_SCHEMA_VERSION);
}

function caseSensorCallWritesNoFile() {
  process.stdout.write('\n-- static: the sensor call itself writes no file (fs write spy) --\n');
  const room = trackedRoom('write-spy');
  seedCommandPathSideChannel(room.roomDir, INDIRECT_STAMP);

  const originalWriteFileSync = fs.writeFileSync;
  const originalRenameSync = fs.renameSync;
  let writeCalls = 0;
  fs.writeFileSync = function spyWriteFileSync() {
    writeCalls += 1;
    return originalWriteFileSync.apply(fs, arguments);
  };
  fs.renameSync = function spyRenameSync() {
    writeCalls += 1;
    return originalRenameSync.apply(fs, arguments);
  };
  let threw = null;
  try {
    sensorEurekaModule.sensorEureka(TURN, {}, { roomDir: room.roomDir });
  } catch (e) {
    threw = e;
  } finally {
    fs.writeFileSync = originalWriteFileSync;
    fs.renameSync = originalRenameSync;
  }
  check('the sensor call never throws', threw === null, threw && (threw.message || String(threw)));
  check('the sensor call makes zero fs.writeFileSync/renameSync calls (read-only sensor)', writeCalls === 0, String(writeCalls));
}

// ---------------------------------------------------------------------------
// Run every case; a single async main so a rejection anywhere still exits
// non-zero (JS has no top-level await in a CJS file).
// ---------------------------------------------------------------------------
(async function main() {
  try {
    await caseCliOneCardFramed();
    await caseLabelPerFraming();
    caseRegressionCommandPath();
    await caseTierGateAllUnverified();
    await caseMcpPullTwoConsecutive();
    caseRenderGuardsOverFramingPhrases();
    caseNegativeControls();
    caseStaticSensorEureka();
    caseSensorCallWritesNoFile();
  } catch (e) {
    console.error(e);
    checker.check('the suite ran to completion without an uncaught exception', false, e && (e.stack || e.message || String(e)));
  } finally {
    cleanupAllRooms();
  }

  check('net guard: zero fetch attempts across the whole suite', netGuard.attempts() === 0, String(netGuard.attempts()));
  netGuard.restore();

  const code = checker.summary();
  process.exit(code);
})();

void wasKeyPresent;
