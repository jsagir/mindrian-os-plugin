#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 379.1 (graph derive drain and scout runaway CPU) proof: scout-bound.
 * Proves CPU379-06: the scout is bounded before buildLsaMatrix (an artifact-count cap that
 * returns the degraded envelope, a timeout and killSignal on runStep, and a single-flight lock
 * with a PID liveness check or a throttle stamp written at run start).
 * Wave 0 scaffold (plan 01): RED by design until Plan 05 (rs-engine cap and the cadence runner)
 * replaces the pending check with the real assertions.
 * Hermetic: scrubVendorKey + installNetGuard first; attempts() === 0 last. No em-dashes.
 */
const { scrubVendorKey, installNetGuard } = require('./helpers/hygiene-355.cjs');
scrubVendorKey();
const netGuard = installNetGuard();

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let pass = 0;
let fail = 0;
function t(label, fn) {
  try {
    fn();
    pass += 1;
    console.log('  ok - ' + label);
  } catch (e) {
    fail += 1;
    process.exitCode = 1;
    console.log('  FAIL - ' + label + ': ' + (e && e.message ? e.message : e));
  }
}

function main() {
  console.log('test-379.1-scout-bound (CPU379-06)');
  t('scaffold: implementation pending (Plan 05)', () => {
    throw new Error('RED by design: Wave 0 scaffold');
  });
  assert.equal(netGuard.attempts(), 0, 'no network attempt');
  netGuard.restore();
  console.log('PASS: ' + pass + ' FAIL: ' + fail + ' (fs, os, path ready: ' + [fs, os, path].length + ')');
}

main();
