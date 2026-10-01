#!/usr/bin/env node
'use strict';

/*
 * Phase 365-02 -- the BYTE acceptance test (structural half), red at base.
 *
 * Two claims carry byte-identical text. A has a source edge (url plus
 * retrieved_at) and a read record at declared rung 3; B has only an ask record
 * (a model was asked) at the SAME declared rung 3. Today every field the room
 * computes for a claim row is identical between them, so nothing a person can
 * filter on separates "read a source" from "asked a model".
 *
 * PASS only when both listClaimsForChecking rows carry a `standing` field, the
 * values differ, and a standing filter returns A and not B.
 *
 * Signature on failure: RED-365-BYTE (healed by 365-04).
 * The derived-rung half lives in tests/test-365-acceptance-byte-derived.cjs
 * and is handed to Phase 365.1.
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
    room = fx.makeRoom365('byte');
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
        url: 'https://example.org/review', retrieved_at: '2026-09-30', variant: 'A',
      });
      fx.recordRead(wdb, aId, { againstId: srcId, rung: 3 });
      fx.recordAsk(wdb, bId, { rung: 3 });
    } finally {
      fx.closeFresh(wdb);
    }

    // Read everything back through a FRESH handle.
    const textA = fx.readClaimText(room.room, aId);
    const textB = fx.readClaimText(room.room, bId);
    check('claim texts read back byte-identical from a fresh handle',
      typeof textA === 'string' && textA === textB, JSON.stringify([textA, textB]));
    check('the two claims are two different nodes', aId !== bId, aId + ' vs ' + bId);

    const rdb = fx.openFresh(room.room);
    let rowA;
    let rowB;
    let filtered;
    try {
      const listed = navigation.listClaimsForChecking(rdb, { limit: 100 });
      rowA = (listed.claims || []).find((c) => c.claim_id === aId);
      rowB = (listed.claims || []).find((c) => c.claim_id === bId);
      check('both claims are listed', !!rowA && !!rowB, JSON.stringify(listed.claims));
      const recA = rdb.prepare('SELECT properties FROM nodes WHERE id = ?').get(aId);
      const recB = rdb.prepare('SELECT properties FROM nodes WHERE id = ?').get(bId);
      const rungA = JSON.parse(recA.properties).verification.records[0].rung;
      const rungB = JSON.parse(recB.properties).verification.records[0].rung;
      check('both carry the same declared rung (3)', rungA === 3 && rungB === 3, rungA + ' vs ' + rungB);
      if (rowA && rowB && Object.prototype.hasOwnProperty.call(rowA, 'standing')) {
        filtered = navigation.listClaimsForChecking(rdb, { limit: 100, standing: rowA.standing });
      }
    } finally {
      fx.closeFresh(rdb);
    }
    if (!rowA || !rowB) return 1;

    const strip = (r) => {
      const c = Object.assign({}, r);
      delete c.claim_id;
      return c;
    };
    const a = strip(rowA);
    const b = strip(rowB);
    process.stdout.write('  observed row A (claim_id removed): ' + JSON.stringify(a) + '\n');
    process.stdout.write('  observed row B (claim_id removed): ' + JSON.stringify(b) + '\n');

    const hasStanding = Object.prototype.hasOwnProperty.call(a, 'standing')
      && Object.prototype.hasOwnProperty.call(b, 'standing');
    const differs = hasStanding && JSON.stringify(a.standing) !== JSON.stringify(b.standing);
    let filterOk = false;
    if (hasStanding && differs && filtered && Array.isArray(filtered.claims)) {
      const ids = filtered.claims.map((c) => c.claim_id);
      filterOk = ids.indexOf(aId) !== -1 && ids.indexOf(bId) === -1;
    }

    if (!(hasStanding && differs && filterOk)) {
      const diffKeys = Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
      redLine = 'RED-365-BYTE: identical text claims are indistinguishable by any computed field ('
        + (diffKeys.length ? diffKeys.join(',') : 'none') + ')';
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
  process.stdout.write('PASS: standing separates identical-text claims\n');
  return 0;
}

try {
  process.exitCode = main();
} catch (e) {
  process.stdout.write('UNCAUGHT: ' + String((e && e.stack) || e) + '\n');
  process.exitCode = 1;
}
