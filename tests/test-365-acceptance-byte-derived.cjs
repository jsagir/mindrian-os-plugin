#!/usr/bin/env node
'use strict';

/*
 * Phase 365-02 -- the BYTE acceptance test (derived-rung half), red at base.
 *
 * Same fixture as the structural half, plus a locator ("p. 4, Table 2") on A's
 * source. The derived rung is an edge-derived number: a located primary source
 * is 4, asking a model is 2. That derivation is blocked on the ladder
 * ratification (data/verification-ladder.json, ratified:false), so this leg is
 * RED at base and stays red through Phase 365; it is handed to Phase 365.1.
 *
 * PASS only when navigation.deriveRung is a function and deriveRung(A) === 4
 * and deriveRung(B) === 2.
 *
 * Signature on failure: RED-365-BYTE-DERIVED (healed by 365.1).
 * tests/test-365-ladder-fence.cjs keeps deriveRung from landing early.
 *
 * Exit: 0 PASS, 1 FAIL, 77 ENV GAP. No em-dashes.
 */

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const net = hygiene.installNetGuard();

const assert = require('node:assert/strict');
const path = require('node:path');
const fx = require('./helpers/fixture-room-365.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));

let hardFail = 0;
function check(label, cond, detail) {
  try {
    assert.ok(cond, label);
    process.stdout.write('  ok - ' + label + '\n');
  } catch (_e) {
    hardFail += 1;
    process.stdout.write('  FAIL - ' + label + (detail ? ' :: ' + detail : '') + '\n');
  }
}

const TEXT = 'The reviewer found that the unit price fell by a third after the change.';

function main() {
  let room;
  try {
    room = fx.makeRoom365('byte-derived');
  } catch (e) {
    process.stdout.write('ENV GAP: cannot make a scratch room: ' + String(e && e.message) + '\n');
    return fx.SKIP_EXIT_CODE;
  }
  let redLine = null;
  try {
    const wdb = fx.openFresh(room.room);
    let aId;
    let bId;
    try {
      aId = fx.seedClaim(wdb, { text: TEXT, variant: 'A' });
      bId = fx.seedClaim(wdb, { text: TEXT, variant: 'B' });
      const srcId = fx.addSourceEdge(wdb, aId, {
        url: 'https://example.org/review', retrieved_at: '2026-09-30',
        locator: 'p. 4, Table 2', variant: 'A',
      });
      fx.recordRead(wdb, aId, { againstId: srcId, rung: 3 });
      fx.recordAsk(wdb, bId, { rung: 3 });
    } finally {
      fx.closeFresh(wdb);
    }

    const textA = fx.readClaimText(room.room, aId);
    const textB = fx.readClaimText(room.room, bId);
    check('claim texts read back byte-identical from a fresh handle',
      typeof textA === 'string' && textA === textB, JSON.stringify([textA, textB]));

    const fnPresent = typeof navigation.deriveRung === 'function';
    process.stdout.write('  observed: typeof navigation.deriveRung = ' + typeof navigation.deriveRung + '\n');
    let ra = null;
    let rb = null;
    if (fnPresent) {
      const rdb = fx.openFresh(room.room);
      try {
        ra = navigation.deriveRung(rdb, aId);
        rb = navigation.deriveRung(rdb, bId);
      } finally {
        fx.closeFresh(rdb);
      }
      process.stdout.write('  observed: deriveRung(A)=' + JSON.stringify(ra) + ' deriveRung(B)=' + JSON.stringify(rb) + '\n');
    }
    if (!(fnPresent && ra === 4 && rb === 2)) {
      redLine = 'RED-365-BYTE-DERIVED: no edge-derived rung separates a located primary source (4) from asking a model (2)';
    }
  } finally {
    fx.cleanup(room);
  }

  check('no network attempted', net.attempts() === 0, String(net.attempts()));
  net.restore();
  if (hardFail > 0) return 1;
  if (redLine) {
    process.stdout.write(redLine + '\n');
    return 1;
  }
  process.stdout.write('PASS: derived rung separates a located primary source from a model ask\n');
  return 0;
}

try {
  process.exitCode = main();
} catch (e) {
  process.stdout.write('UNCAUGHT: ' + String((e && e.stack) || e) + '\n');
  process.exitCode = 1;
}
