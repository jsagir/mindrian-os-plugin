#!/usr/bin/env node
'use strict';
// Phase 177 - The Behavioral Channel
// BCH-04: the shadow-log. calibration_observations logs EVERY pre-threshold
// behavioral cue -- INCLUDING the discarded below-floor ones -- so Wave 3
// (BCH-CAL) has shadow data to calibrate against. "Shadow before trust."
//
// SHADOW-ONLY: this wave LOGS, it does NOT fire. No reach minted, routing_source
// stays legacy. The dedicated calibration_observations table is LOCAL room.db only
// and is structurally invisible to buildBrainPacket (Canon Part 8 holds BY
// CONSTRUCTION); this suite carries a local Part 8 source-scan fence mirroring
// test-bch-14-part8-egress.
//
// Pure node asserts, no deps. Drives writes through navigation.logCalibrationObservation
// (the chokepoint), not a raw INSERT, so the suite exercises the real surface.

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '..');

let failed = 0;
function ok(cond, msg) {
  console.log((cond ? '  ok   - ' : '  FAIL - ') + msg);
  if (!cond) failed++;
}

console.log('--- test-bch-04-shadow-log ---');

const memoryOps = require(path.join(ROOT, 'lib/core/memory-ops.cjs'));
const nav = require(path.join(ROOT, 'lib/core/navigation.cjs'));
const { EVENT_TYPES } = require(path.join(ROOT, 'lib/core/navigation/memory-events.cjs'));

const db = new DatabaseSync(':memory:');
memoryOps.initCalibrationSchema(db);
// Idempotent re-run must not throw (the LOCAL-schema family contract).
memoryOps.initCalibrationSchema(db);
ok(true, 'initCalibrationSchema is idempotent (two calls, no throw)');

// (1) THE BCH-04 HEADLINE: a below-floor cue (confidence 0.30) STILL writes a row
//     whose cue_disposition is 'discarded'. Discarded cues are LOGGED, not dropped.
const below = nav.logCalibrationObservation(db, { turn_count: 1, cue_kind: 'reframe_cue', confidence: 0.30 });
ok(below && below.ok === true, 'below-floor cue (0.30) writes a row (ok:true) -- discarded cues are logged, not dropped');
const belowRow = db.prepare("SELECT cue_disposition, band FROM calibration_observations WHERE id = ?").get(below.id);
ok(belowRow && belowRow.cue_disposition === 'discarded', 'below-floor cue stores cue_disposition = discarded (got: ' + (belowRow && belowRow.cue_disposition) + ')');
ok(belowRow && belowRow.band === 'below_floor', 'below-floor cue stores band = below_floor (got: ' + (belowRow && belowRow.band) + ')');

// (2) a protected-band cue (0.70) writes cue_disposition 'fired'.
const protectedCue = nav.logCalibrationObservation(db, { turn_count: 2, cue_kind: 'reframe_cue', confidence: 0.70 });
ok(protectedCue && protectedCue.ok === true, 'protected-band cue (0.70) writes a row (ok:true)');
const protRow = db.prepare("SELECT cue_disposition FROM calibration_observations WHERE id = ?").get(protectedCue.id);
ok(protRow && protRow.cue_disposition === 'fired', 'protected-band cue stores cue_disposition = fired (got: ' + (protRow && protRow.cue_disposition) + ')');

// (3) an above-ceiling cue (0.92) writes cue_disposition 'above_ceiling'.
const aboveCue = nav.logCalibrationObservation(db, { turn_count: 3, cue_kind: 'escape_hatch', confidence: 0.92 });
ok(aboveCue && aboveCue.ok === true, 'above-ceiling cue (0.92) writes a row (ok:true)');
const aboveRow = db.prepare("SELECT cue_disposition FROM calibration_observations WHERE id = ?").get(aboveCue.id);
ok(aboveRow && aboveRow.cue_disposition === 'above_ceiling', 'above-ceiling cue stores cue_disposition = above_ceiling (got: ' + (aboveRow && aboveRow.cue_disposition) + ')');

// Sanity: all three rows landed (the table is the row store).
const total = db.prepare('SELECT COUNT(*) AS c FROM calibration_observations').get().c;
ok(total === 3, 'all 3 observations (discarded + fired + above_ceiling) are in the dedicated table (got: ' + total + ')');

// (4) calibration_observation_logged is a member of EVENT_TYPES (the scalar audit marker).
ok(EVENT_TYPES.has('calibration_observation_logged'), 'calibration_observation_logged is a member of the frozen EVENT_TYPES Set');

// (5) Part 8 source-scan fence: the calibration table name must NOT appear in the
//     Brain egress path (packet.cjs). The dedicated table is LOCAL-only; if a future
//     change wires it into buildBrainPacket, this trips immediately. Mirrors the
//     test-bch-14-part8-egress tripwire (a Part 8 regression fence local to this suite).
const PACKET = path.join(ROOT, 'lib/core/navigation/packet.cjs');
ok(fs.existsSync(PACKET), 'lib/core/navigation/packet.cjs exists (the Brain packet builder)');
const packetSrc = fs.existsSync(PACKET) ? fs.readFileSync(PACKET, 'utf8') : '';
ok(!/calibration_observations/.test(packetSrc), 'packet.cjs references NO calibration_observations table (Part 8: LOCAL -> BRAIN never)');

console.log(failed === 0 ? 'PASS test-bch-04 (shadow-log: discarded cues are logged, Part 8 holds)' : ('FAIL test-bch-04 (' + failed + ' assertion(s) failed)'));
process.exit(failed === 0 ? 0 : 1);
