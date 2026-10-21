#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 379.1 (graph derive drain and scout runaway CPU) proof: artifact-scope.
 * Proves CPU379-10: a declared way to keep generated engine-input directories out of the derive
 * and scout artifact scope (the engine-input-manifest.json and .mos-generated markers, the
 * .mindrian/artifact-scope.json globs, the overbroad guard at 0.5 of directories; D-379.1-18).
 * Wave 0 scaffold (plan 01): RED by design until Plan 02 (lib/core/artifact-scope.cjs), then
 * Plan 05 (the walkers) and then Plan 06 (the release leg) replace the pending check.
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
  console.log('test-379.1-artifact-scope (CPU379-10)');
  t('scaffold: implementation pending (Plan 02, then Plan 05, then Plan 06)', () => {
    throw new Error('RED by design: Wave 0 scaffold');
  });
  assert.equal(netGuard.attempts(), 0, 'no network attempt');
  netGuard.restore();
  console.log('PASS: ' + pass + ' FAIL: ' + fail + ' (fs, os, path ready: ' + [fs, os, path].length + ')');
}

main();
