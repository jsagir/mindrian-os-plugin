'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 381 Plan 03 Task 1 -- the full TZ matrix of dateDToEpoch. Kept out of
 * tests/test-381-bash-dialect.cjs so that file stays a quick run (the matrix spawns date and
 * python3 for every case x TZ pair, on both the BASE_SHA bash side and the NEW side).
 *
 * For every value of live.dateValues() and every TZ of live.TZ_MATRIX (UTC, Asia/Jerusalem,
 * America/Havana, Asia/Beirut, America/Sao_Paulo, America/New_York and the host zone with TZ
 * unset): dateDToEpoch equals the BASE_SHA portable_date_to_epoch run in bash under the same TZ in
 * a fresh temp cwd, and no marker file appears on either side. The DST-gap dates 2026-03-08
 * (America/Havana), 2026-03-29 (Asia/Beirut) and 2018-11-04 (America/Sao_Paulo) are in the values.
 *
 * Plain node:assert/strict, zero deps, mkdtemp only. Exit 0 pass, 1 fail. Hyphens only.
 */
const assert = require('node:assert/strict');

process.env.LC_ALL = 'C.UTF-8';
process.env.LANG = 'C.UTF-8';

const live = require('./helpers/live-381.cjs');
const scan = require('../lib/core/room-scan.cjs');

let failures = 0;
function leg(name, fn) {
  try {
    fn();
    console.log('ok - ' + name);
  } catch (err) {
    failures += 1;
    console.log('not ok - ' + name);
    console.log('    ' + String(err && err.message ? err.message : err).split('\n').join('\n    '));
  }
}

const VALUES = live.dateValues();
live.TZ_MATRIX.forEach((tz) => {
  leg('TZ=' + tz + ': ' + VALUES.length + ' values equal the BASE_SHA bash function', () => {
    const want = live.oracleEpochs(VALUES, tz);
    const got = live.withTz(tz, () => VALUES.map((v) => scan.dateDToEpoch(v)));
    assert.equal(want.epochs.length, VALUES.length);
    const bad = [];
    VALUES.forEach((v, i) => {
      if (String(got.value[i]) !== want.epochs[i]) bad.push(JSON.stringify(v) + ': bash=' + want.epochs[i] + ' js=' + got.value[i]);
    });
    assert.deepEqual(bad, [], 'differences:\n' + bad.join('\n'));
    assert.deepEqual(want.markers, [], 'BASE_SHA side created ' + want.markers.join(','));
    assert.deepEqual(got.markers, [], 'NEW side created ' + got.markers.join(','));
  });
});

live.cleanup();
if (failures > 0) {
  console.log('FAILED legs: ' + failures);
  process.exit(1);
}
console.log('all legs ok');
