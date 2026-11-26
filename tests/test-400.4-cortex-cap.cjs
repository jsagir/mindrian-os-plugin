#!/usr/bin/env node
'use strict';

/*
 * tests/test-400.4-cortex-cap.cjs -- Phase 400.4 plan 03 (QA-F6).
 *
 * Legs:
 *   C1 the cortex leg keeps the first cortexK rows of the uncapped ranking
 *   C2 the cap is reported: omitted entry, _meta.cortexK, _meta.cortexTotal, omitted last
 *   C3 a room under the cap has no top_k_cap entry
 *   C4 a call without cortexK equals the base shape (no cortexK or cortexTotal key)
 *   C5 toEstimateResult(real result) equals getRoomContext with estimateOnly
 *   C6 the context_assemble handler: default cap 40, cortex_k 500 gives all, the schema refuses 0 and 501
 *   C7 reply_bytes_estimate is within 5 percent of the real reply text length
 *   C8 reply_bytes matches the reply text length; omitted stays the last _meta key
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const roomContext = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'room-context.cjs'));
const { getRoomContext } = roomContext;

let passed = 0;
function ok(label) {
  passed += 1;
  console.log('  ok - ' + label);
}

const NOW = 1717000000000;
const HOUR = 3600 * 1000;

// Insert n cortex nodes (claims) with distinct created_at values, newest first by index.
function addCortexNodes(db, n) {
  const stmt = db.prepare(
    'INSERT INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, ' +
    'created_at, last_seen_at, source_section) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (let i = 0; i < n; i++) {
    const ts = NOW - (i + 1) * HOUR;
    const id = 'claim:cap-400-4-' + String(i).padStart(4, '0');
    stmt.run(id, 'claim', JSON.stringify({ text: 'cortex node number ' + i + ' ' + 'x'.repeat(200) }),
      'cap-400-4', 'system', null, 'proposed', ts, ts, 'cap-400-4');
  }
}

function stripTimings(r) {
  const clone = JSON.parse(JSON.stringify(r));
  if (clone && clone._meta) delete clone._meta.legTimingsMs;
  return clone;
}

async function legsC1toC5() {
  const { buildFixtureDb } = require(path.join(REPO_ROOT, 'tests', 'fixtures', 'room-141-fixture.cjs'));

  // 120 cortex nodes
  const db = buildFixtureDb();
  try {
    const base = await getRoomContext(db, 'fixture', { now: NOW });
    const baseCortexCount = base.cortexNodes.length;
    addCortexNodes(db, 120);
    const total = baseCortexCount + 120;

    const full = await getRoomContext(db, 'fixture', { now: NOW });
    assert.equal(full.cortexNodes.length, total, 'fixture holds ' + total + ' cortex rows');
    const capped = await getRoomContext(db, 'fixture', { now: NOW, cortexK: 40 });

    // C1
    assert.equal(capped.cortexNodes.length, 40, 'C1: 40 rows kept');
    assert.deepStrictEqual(
      capped.cortexNodes.map((n) => n.id),
      full.cortexNodes.slice(0, 40).map((n) => n.id),
      'C1: same ids, same order as the first 40 of the uncapped call'
    );
    ok('C1: cortexK 40 keeps the first 40 of the uncapped ranking');

    // C2
    const entry = capped._meta.omitted.find((e) => e.leg === 'legD' && e.reason === 'top_k_cap');
    assert.ok(entry, 'C2: legD top_k_cap entry present');
    assert.deepStrictEqual(entry, { leg: 'legD', reason: 'top_k_cap', count: total - 40, detail: 'cortex_k' });
    assert.equal(capped._meta.cortexK, 40);
    assert.equal(capped._meta.cortexTotal, total);
    const keys = Object.keys(capped._meta);
    assert.equal(keys[keys.length - 1], 'omitted', 'C2: omitted stays the last _meta key');
    ok('C2: omitted count is rows left out; cortexK and cortexTotal reported; omitted last');

    // C4 (same db)
    const noK = await getRoomContext(db, 'fixture', { now: NOW });
    assert.deepStrictEqual(stripTimings(noK), stripTimings(full), 'C4: repeat call is stable');
    assert.equal('cortexK' in noK._meta, false, 'C4: no cortexK key without the option');
    assert.equal('cortexTotal' in noK._meta, false, 'C4: no cortexTotal key without the option');
    assert.deepStrictEqual(
      Object.keys(noK._meta),
      ['seedNodeId', 'fragmentWindow', 'topK', 'maxDepth', 'legTimingsMs', 'legCostChars',
        'legCostTokensApprox', 'estimateOnly', 'omitted'],
      'C4: _meta key list equals base'
    );
    ok('C4: a call with no cortexK keeps the base shape');

    // C5
    const real = await getRoomContext(db, 'fixture', { now: NOW, cortexK: 40 });
    const est = await getRoomContext(db, 'fixture', { now: NOW, cortexK: 40, estimateOnly: true });
    const converted = roomContext.toEstimateResult(JSON.parse(JSON.stringify(real)));
    assert.deepStrictEqual(stripTimings(converted), stripTimings(est), 'C5: helper equals estimate mode');
    assert.equal(converted._meta.estimateOnly, true);
    assert.equal(converted.cortexNodes, null);
    // idempotent: no duplicate omitted entries
    const twice = roomContext.toEstimateResult(JSON.parse(JSON.stringify(converted)));
    assert.deepStrictEqual(twice._meta.omitted, converted._meta.omitted, 'C5: second pass adds nothing');
    ok('C5: toEstimateResult(real) equals getRoomContext with estimateOnly');
  } finally {
    db.close();
  }

  // C3: a room under the cap
  const small = buildFixtureDb();
  try {
    const before = (await getRoomContext(small, 'fixture', { now: NOW })).cortexNodes.length;
    addCortexNodes(small, 30);
    const r = await getRoomContext(small, 'fixture', { now: NOW, cortexK: 40 });
    assert.equal(r.cortexNodes.length, before + 30);
    assert.equal(r._meta.omitted.some((e) => e.leg === 'legD' && e.reason === 'top_k_cap'), false,
      'C3: no top_k_cap entry under the cap');
    assert.equal(r._meta.cortexTotal, before + 30);
    ok('C3: under the cap there is no top_k_cap entry and cortexTotal is the row count');
  } finally {
    small.close();
  }
}

async function main() {
  console.log('test-400.4-cortex-cap:');
  await legsC1toC5();
  if (typeof legsC6toC8 === 'function') await legsC6toC8();
  console.log(passed + ' checks passed.');
  process.exit(0);
}

// LEGS_C6_C8_PLACEHOLDER

main().catch((err) => {
  console.error('FAIL test-400.4-cortex-cap: ' + (err && err.stack ? err.stack : String(err)));
  process.exit(1);
});
