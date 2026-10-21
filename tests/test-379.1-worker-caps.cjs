#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 379.1 (graph derive drain and scout runaway CPU) proof: worker-caps.
 * Proves CPU379-03: the drain worker has a time limit, a low priority and an ONNX thread limit
 * set in lib/core/semantic-index/embedding-spine.cjs (intraOpNumThreads 2, interOpNumThreads 1,
 * allow_spinning "0" when the Wave 0 probe proves the extra map is honoured; D-379.1-13).
 * Wave 0 scaffold (plan 01): RED by design until Plan 02 (the spine thread cap) and then
 * Plan 04 (the worker budget and priority) replace the pending check with the real assertions.
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
  console.log('test-379.1-worker-caps (CPU379-03)');
  t('scaffold: implementation pending (Plan 02, then Plan 04)', () => {
    throw new Error('RED by design: Wave 0 scaffold');
  });
  assert.equal(netGuard.attempts(), 0, 'no network attempt');
  netGuard.restore();
  console.log('PASS: ' + pass + ' FAIL: ' + fail + ' (fs, os, path ready: ' + [fs, os, path].length + ')');
}

main();
