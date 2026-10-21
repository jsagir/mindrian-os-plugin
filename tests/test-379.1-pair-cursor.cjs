#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 379.1 (graph derive drain and scout runaway CPU) proof: pair-cursor.
 * Proves CPU379-02: no all-pairs scoring in the background, the top-k cosine pruner is the
 * primary bound, a per-drain pair cap and a cursor are the safety net (D-379.1-01, D-379.1-12);
 * and CPU379-04: attempts and last_attempt_at are written before the work, the entry clears
 * only on success.
 * Wave 0 scaffold (plan 01): RED by design until Plan 04 (the drain cursor loop) replaces the
 * pending check with the real assertions.
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
  console.log('test-379.1-pair-cursor (CPU379-02, CPU379-04)');
  t('scaffold: implementation pending (Plan 04)', () => {
    throw new Error('RED by design: Wave 0 scaffold');
  });
  assert.equal(netGuard.attempts(), 0, 'no network attempt');
  netGuard.restore();
  console.log('PASS: ' + pass + ' FAIL: ' + fail + ' (fs, os, path ready: ' + [fs, os, path].length + ')');
}

main();
