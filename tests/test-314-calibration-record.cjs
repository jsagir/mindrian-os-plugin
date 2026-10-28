#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 314-07 -- CL9: the shipped thresholds file carries an honest record.
 * calibrated true needs positive integers and a full calibration record from a
 * non-stub encoder. calibrated false needs a reason, or is the untouched default.
 * Run with: node tests/test-314-calibration-record.cjs
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const DATA_FILE = path.join(REPO, 'data', 'eureka-portfolio-thresholds.json');
const CAL_MD = path.join(REPO, '.planning', 'phases', '314-seed-055-broaden-sens-13-to-portfolio-movement-mos-eureka-portfolio-command', '314-CALIBRATION.md');

let passed = 0;
let failed = 0;

function leg(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('  PASS ' + name);
  } catch (e) {
    failed += 1;
    console.log('  FAIL ' + name + ' :: ' + (e && e.message ? e.message : e));
  }
}

function posInt(v) { return Number.isInteger(v) && v > 0; }

const doc = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

leg('CL9a the file has schema_version 1 and a boolean calibrated', function () {
  assert.strictEqual(doc.schema_version, 1);
  assert.strictEqual(typeof doc.calibrated, 'boolean');
  assert.deepStrictEqual(Object.keys(doc), ['schema_version', 'calibrated', 'top_n', 'reshuffle_min_moved', 'reshuffle_min_displacement', 'calibration']);
});

if (doc.calibrated === true) {
  leg('CL9b calibrated true: three positive integers and a full record', function () {
    assert.ok(posInt(doc.top_n) && doc.top_n >= 2, 'top_n');
    assert.ok(posInt(doc.reshuffle_min_moved), 'reshuffle_min_moved');
    assert.ok(posInt(doc.reshuffle_min_displacement), 'reshuffle_min_displacement');
    const c = doc.calibration;
    assert.ok(c && typeof c === 'object', 'calibration object');
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(c.run_date), 'run_date');
    assert.ok(/^[0-9a-f]{12}$/.test(c.room_id_hash), 'room_id_hash');
    assert.ok(posInt(c.node_count) && posInt(c.pairs_scored), 'node_count and pairs_scored above 0');
    assert.ok(typeof c.encoder_model === 'string' && c.encoder_model.length > 0 && c.encoder_model !== 'stub' && c.encoder_model !== 'unknown', 'encoder_model is a real model');
    assert.ok(Array.isArray(c.seeds) && c.seeds.length > 0, 'seeds');
    assert.ok(typeof c.rule === 'string' && c.rule.length > 20, 'rule');
    assert.ok(c.per_n && typeof c.per_n === 'object' && c.per_n[String(doc.top_n)], 'measured wobble and change numbers');
    assert.strictEqual(typeof c.displacement_separates, 'boolean');
  });
  leg('CL9c 314-CALIBRATION.md exists once calibrated is true', function () {
    assert.ok(fs.existsSync(CAL_MD), '314-CALIBRATION.md is missing');
  });
} else {
  leg('CL9b calibrated false: a reason string, or the untouched default', function () {
    assert.strictEqual(doc.top_n, null);
    assert.strictEqual(doc.reshuffle_min_moved, null);
    assert.strictEqual(doc.reshuffle_min_displacement, null);
    if (doc.calibration === null) return; // untouched default
    assert.ok(doc.calibration && typeof doc.calibration.reason === 'string' && doc.calibration.reason.length > 0, 'calibration.reason');
  });
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
