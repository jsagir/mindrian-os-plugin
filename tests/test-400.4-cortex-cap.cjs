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

// Hermetic homes: the MCP handler resolves the session room through the machine registry under MINDRIAN_ROOMS_HOME
// (the registry active room wins over the boot fallback). Point HOME and MINDRIAN_ROOMS_HOME at a fresh temp dir
// BEFORE any module loads, so the test never reads or opens a real room.
const HERMETIC_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-400-4-cap-home-'));
process.env.HOME = path.join(HERMETIC_HOME, 'home');
process.env.MINDRIAN_ROOMS_HOME = path.join(HERMETIC_HOME, 'rooms');
fs.mkdirSync(process.env.HOME, { recursive: true });
fs.mkdirSync(process.env.MINDRIAN_ROOMS_HOME, { recursive: true });
process.on('exit', () => { try { fs.rmSync(HERMETIC_HOME, { recursive: true, force: true }); } catch (_e) { /* best effort */ } });

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
  await legsC6toC8();
  console.log(passed + ' checks passed.');
  process.exit(0);
}

async function legsC6toC8() {
  const { z } = require('zod');
  const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
  const contextTool = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'context.cjs'));

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-400-4-cap-'));
  try {
    const roomDir = path.join(tmpDir, 'room');
    fs.mkdirSync(roomDir, { recursive: true });
    const db = openRoomDb(roomDir);
    try { addCortexNodes(db, 120); } finally { closeRoomDb(db); }

    const stub = {
      tools: new Map(),
      registerTool(name, config, cb) {
        const cfg = config || {};
        this.tools.set(name, { description: cfg.description, schema: (cfg.inputSchema && cfg.inputSchema.shape) || cfg.inputSchema || {}, cb });
      },
    };
    contextTool.register(stub, { fallbackRoomDir: roomDir, pluginRoot: REPO_ROOT, surface: 'cli' });
    const reg = stub.tools.get('context_assemble');
    assert.ok(reg, 'context_assemble registered');
    const roomDirReal = fs.realpathSync(roomDir);
    let n = 0;
    const call = async (args) => {
      n += 1;
      const res = await reg.cb(args, { sessionId: 'sess-400-4-cap-' + n });
      return { text: res.content[0].text, body: JSON.parse(res.content[0].text) };
    };

    // C6
    const def = await call({});
    assert.equal(def.body.ok, true);
    assert.equal(fs.realpathSync(def.body.room_dir), roomDirReal, 'the handler resolved the fixture room, not a real one');
    assert.equal(def.body.cortexNodes.length, 40, 'C6: default cap is 40');
    assert.ok(def.body._meta.omitted.some((e) => e.leg === 'legD' && e.reason === 'top_k_cap' && e.count === 80 && e.detail === 'cortex_k'));
    assert.equal(def.body._meta.cortexTotal, 120);
    const all = await call({ cortex_k: 500 });
    assert.equal(all.body.cortexNodes.length, 120, 'C6: cortex_k 500 gives all rows');
    assert.equal(all.body._meta.omitted.some((e) => e.leg === 'legD' && e.reason === 'top_k_cap'), false);
    const schema = z.object(reg.schema);
    assert.equal(schema.safeParse({ cortex_k: 0 }).success, false, 'C6: 0 refused');
    assert.equal(schema.safeParse({ cortex_k: 501 }).success, false, 'C6: 501 refused');
    assert.equal(schema.safeParse({ cortex_k: 40 }).success, true);
    assert.equal(schema.safeParse({}).success, true);
    ok('C6: default cap 40, cortex_k 500 gives all rows, the schema refuses 0 and 501');

    // C7
    for (const k of [40, 500]) {
      const real = await call({ cortex_k: k });
      const est = await call({ cortex_k: k, estimate_only: true });
      const realBytes = Buffer.byteLength(real.text, 'utf8');
      const estimate = est.body._meta.reply_bytes_estimate;
      assert.equal(typeof estimate, 'number', 'C7: estimate present');
      assert.ok(Math.abs(estimate - realBytes) / realBytes <= 0.05,
        'C7: estimate ' + estimate + ' within 5 percent of real ' + realBytes + ' at cortex_k ' + k);
      assert.equal(est.body.cortexNodes, null);
      assert.equal(est.body._meta.estimateOnly, true);
      assert.ok(est.text.length < real.text.length, 'C7: the estimate reply is smaller than the real reply');
      const ekeys = Object.keys(est.body._meta);
      assert.equal(ekeys[ekeys.length - 1], 'omitted', 'C8: omitted last in the estimate reply');
    }
    ok('C7: reply_bytes_estimate is within 5 percent of the real reply at cortex_k 40 and 500');

    // C8
    const real8 = await call({ cortex_k: 40 });
    const len8 = Buffer.byteLength(real8.text, 'utf8');
    const rb = real8.body._meta.reply_bytes;
    assert.equal(typeof rb, 'number');
    assert.ok(len8 - rb >= 0 && len8 - rb < 64, 'C8: reply_bytes ' + rb + ' within 64 bytes of the final text ' + len8);
    const keys8 = Object.keys(real8.body._meta);
    assert.equal(keys8[keys8.length - 1], 'omitted', 'C8: omitted last in the real reply');
    assert.equal('reply_bytes_estimate' in real8.body._meta, false);
    ok('C8: reply_bytes matches the reply text length; omitted stays last');
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
}

main().catch((err) => {
  console.error('FAIL test-400.4-cortex-cap: ' + (err && err.stack ? err.stack : String(err)));
  process.exit(1);
});
