#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 379.1 (graph derive drain and scout runaway CPU) proof: svd-parity.
 * Proves CPU379-06 and D-379.1-14: the seeded randomized truncated SVD that replaces the cyclic
 * Jacobi in lib/core/numeric/svd.cjs passes the 272 rank-agreement gate at its tolerance
 * (tests/fixtures/272/noise-floor.json: LSA_SPEARMAN_MIN 0.85, LSA_AVG_DELTA_MAX 0.02,
 * LSA_MAX_DELTA_MAX 0.05, CONFIDENT_SIGN_FLIP_MAX 0) and keeps the determinism contract.
 * Wave 0 scaffold (plan 01): RED by design until Plan 03 (the gated solver swap) replaces the
 * pending check with the real assertions. On a GATE FAIL Plan 03 ships nothing and files a seed.
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
  console.log('test-379.1-svd-parity (CPU379-06, D-379.1-14)');
  t('scaffold: implementation pending (Plan 03)', () => {
    throw new Error('RED by design: Wave 0 scaffold');
  });
  assert.equal(netGuard.attempts(), 0, 'no network attempt');
  netGuard.restore();
  console.log('PASS: ' + pass + ' FAIL: ' + fail + ' (fs, os, path ready: ' + [fs, os, path].length + ')');
}

main();
