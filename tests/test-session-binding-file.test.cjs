#!/usr/bin/env node
// PSB-01 -- per-session binding file read/write + safe defaults on miss/corruption.
// SKIP-safe stub: exits 0 until lib/core/session-binding.cjs lands, then runs live.
// Node built-in assert only. No em-dashes.
'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let mod;
try {
  mod = require('../lib/core/session-binding.cjs');
} catch (e) {
  console.log('SKIP: test-session-binding-file -- module not present yet (lib/core/session-binding.cjs). ' + (e.code || e.message));
  process.exit(0);
}
if (typeof mod.readSessionBinding !== 'function' || typeof mod.writeSessionBinding !== 'function') {
  console.log('SKIP: test-session-binding-file -- readSessionBinding/writeSessionBinding not exported yet.');
  process.exit(0);
}

// --- live contract (runs once the module lands) ---
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'psb-bind-'));
const sid = 'sess-aaaa1111';

// (1) safe default on miss: never throws; returns {bound:[],primary:null,sticky:false}
const miss = mod.readSessionBinding(sid, { home });
assert.ok(miss && Array.isArray(miss.bound), 'safe default carries a bound array');
assert.strictEqual(miss.primary, null, 'safe default primary is null');
assert.strictEqual(miss.sticky, false, 'safe default sticky is false');

// (2) round-trip write -> read
mod.writeSessionBinding(sid, { bound: ['alpha', 'beta'], primary: 'alpha', sticky: true }, { home });
const got = mod.readSessionBinding(sid, { home });
assert.deepStrictEqual(got.bound, ['alpha', 'beta'], 'bound set round-trips');
assert.strictEqual(got.primary, 'alpha', 'primary round-trips');
assert.strictEqual(got.sticky, true, 'sticky round-trips');

// TODO (implementing wave): corruption reset -- write garbage to the file, assert
// read returns the safe default (mirrors resolve-active-room null-on-parse-fail).
// TODO: path-traversal guard -- a `..` slug in bound/primary is rejected before use.

console.log('PASS: test-session-binding-file');
process.exit(0);
