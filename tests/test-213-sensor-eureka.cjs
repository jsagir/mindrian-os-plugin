#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 213-02 -- SENS-13 eureka sensor + eureka-reach-runner offline suite.
 *
 * Every arm runs OFFLINE (Canon Part 8: no Brain, no live model, no network, no
 * live critic needed). The sensor arms use a temp room dir + the
 * tests/fixtures/213/last-eureka.json fixture (copied in, mtime touched for the
 * fresh / stale / future arms). The runner arms inject the guard probe
 * (criticProbeFn), the scorer (scoreFn), and the pair, so the closed-schema
 * writer is exercised without the real critic or an embedder.
 *
 *   Sensor:
 *     1 fresh transferable -> deep_research / hold / eureka_bridge
 *     2 restatement / pseudoscience / general_shallow verdict -> null
 *     3 guard.available false or guard key absent -> null
 *     4 stale mtime (older than 30 min) and future mtime -> null
 *     5 band low / moderate -> null
 *     6 malformed JSON / missing roomDir / schema_version !== 1 -> null (no throw)
 *     7 surprise_type outside the closed enum -> null
 *   Runner:
 *     8 probeGuard({criticProbeFn:()=>null}) -> available:false
 *     9 closed-schema writer: written file has EXACTLY the closed key set
 *    10 guard_not_cleared writes nothing
 *    11 every degrade reason is a member of the closed REASONS enum
 *
 * Pure CJS, node built-ins only, hermetic. Bare node assert.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const sensorMod = require(path.join(REPO, 'lib', 'core', 'sensors', 'sensor-eureka.cjs'));
const runnerMod = require(path.join(REPO, 'lib', 'core', 'eureka', 'eureka-reach-runner.cjs'));
const FIXTURE = path.join(REPO, 'tests', 'fixtures', '213', 'last-eureka.json');

const { sensorEureka } = sensorMod;

let PASS = 0;
let FAIL = 0;
function ok(label, fn) {
  try {
    fn();
    console.log('ok   ' + label);
    PASS += 1;
  } catch (e) {
    console.log('FAIL ' + label + ' -- ' + (e && e.message ? e.message : e));
    FAIL += 1;
  }
}
// async arm runner (sequential so output stays ordered)
const asyncArms = [];
function okAsync(label, fn) { asyncArms.push({ label: label, fn: fn }); }

// ---------- helpers ----------

function freshRoom(payloadObj, mtimeMs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sens13-'));
  const side = path.join(dir, '.mindrian');
  fs.mkdirSync(side, { recursive: true });
  const file = path.join(side, 'last-eureka.json');
  if (payloadObj === '__fixture__') {
    fs.copyFileSync(FIXTURE, file);
  } else if (typeof payloadObj === 'string') {
    fs.writeFileSync(file, payloadObj, 'utf8'); // raw (malformed-JSON arm)
  } else {
    fs.writeFileSync(file, JSON.stringify(payloadObj), 'utf8');
  }
  if (typeof mtimeMs === 'number') {
    const t = mtimeMs / 1000;
    fs.utimesSync(file, t, t);
  }
  return dir;
}

function loadFixture() {
  return JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
}

// ---------- sensor arms ----------

ok('1 fresh transferable fixture -> deep_research/hold/eureka_bridge', function () {
  const dir = freshRoom('__fixture__');
  const r = sensorEureka({}, {}, { roomDir: dir });
  assert.ok(r, 'must fire');
  assert.strictEqual(r.reach_id, 'deep_research');
  assert.strictEqual(r.posture, 'hold');
  assert.strictEqual(r.signal, 'eureka_bridge');
  assert.strictEqual(r.evidence.band, 'breakthrough');
  assert.strictEqual(r.evidence.surprise_type, 'structural_transfer');
  assert.strictEqual(r.evidence.guard_verdict, 'transferable');
  assert.strictEqual(r.evidence.a_handle, 'n042');
  assert.strictEqual(r.evidence.b_handle, 'n317');
  assert.strictEqual(r.evidence.differential, 0.57);
});

ok('2 restatement / pseudoscience / general_shallow verdict -> null', function () {
  ['restatement', 'pseudoscience', 'general_shallow'].forEach(function (v) {
    const p = loadFixture();
    p.guard.verdict = v;
    const dir = freshRoom(p);
    assert.strictEqual(sensorEureka({}, {}, { roomDir: dir }), null, 'verdict ' + v + ' must not fire');
  });
});

ok('3 guard.available false or guard key absent -> null', function () {
  const p1 = loadFixture();
  p1.guard.available = false;
  assert.strictEqual(sensorEureka({}, {}, { roomDir: freshRoom(p1) }), null, 'available false');
  const p2 = loadFixture();
  delete p2.guard;
  assert.strictEqual(sensorEureka({}, {}, { roomDir: freshRoom(p2) }), null, 'guard absent');
});

ok('4 stale mtime and future mtime -> null', function () {
  const staleDir = freshRoom('__fixture__', Date.now() - (31 * 60 * 1000));
  assert.strictEqual(sensorEureka({}, {}, { roomDir: staleDir }), null, 'stale must not fire');
  const futureDir = freshRoom('__fixture__', Date.now() + (10 * 60 * 1000));
  assert.strictEqual(sensorEureka({}, {}, { roomDir: futureDir }), null, 'future must not fire');
});

ok('5 band low / moderate -> null', function () {
  ['low', 'moderate'].forEach(function (band) {
    const p = loadFixture();
    p.bridge.band = band;
    assert.strictEqual(sensorEureka({}, {}, { roomDir: freshRoom(p) }), null, 'band ' + band + ' must not fire');
  });
});

ok('6 malformed JSON / missing roomDir / schema_version mismatch -> null (no throw)', function () {
  assert.strictEqual(sensorEureka({}, {}, { roomDir: freshRoom('{ not json') }), null, 'malformed json');
  assert.strictEqual(sensorEureka({}, {}, {}), null, 'missing roomDir');
  assert.strictEqual(sensorEureka({}, {}, { roomDir: '/nonexistent-213-room' }), null, 'nonexistent room');
  const p = loadFixture();
  p.schema_version = 2;
  assert.strictEqual(sensorEureka({}, {}, { roomDir: freshRoom(p) }), null, 'schema_version mismatch');
});

ok('7 surprise_type outside the closed enum -> null', function () {
  const p = loadFixture();
  p.bridge.surprise_type = 'wild_leap';
  assert.strictEqual(sensorEureka({}, {}, { roomDir: freshRoom(p) }), null, 'bad surprise_type');
});

// ---------- runner arms ----------

// A cleared stub critic (Stage A passes, criticRule confident): fires the writer.
function stubCriticCleared() {
  return {
    criticRule: function () { return { verdict: 'general_shallow', confidence: 'high', reasoning_tag: 'passes_all_gates' }; },
    loadCriticTags: function () { return { schema_version: 1, verdicts: ['transferable', 'restatement', 'pseudoscience', 'general_shallow'], domain_tags: ['unknown', 'engineering'] }; },
    stageA: function () { return Promise.resolve({ pass: true, features: { shift: 0.4, embedder: 'stub', entity_count: 5 } }); },
    assembleCriticPayload: function (f) { return Object.assign({}, f, { schema_version: 1 }); },
  };
}
// A not-cleared stub critic (Stage A fails).
function stubCriticFail() {
  return Object.assign(stubCriticCleared(), {
    stageA: function () { return Promise.resolve({ pass: false, route: 'restatement', tag: 'low_novelty_delta' }); },
  });
}
function stubScore(band, direction, absDiff) {
  return function () {
    return Promise.resolve({
      semantic: 0.8, lexical: 0.2, signed_diff: absDiff, abs_diff: absDiff,
      direction: direction, passes: true, band: band,
      provenance: { semantic_model: 'stub-model' },
    });
  };
}
const PAIR = [{ handle: 'n1', text: 'alpha beta gamma delta' }, { handle: 'n2', text: 'omega psi chi phi' }];

okAsync('8 probeGuard({criticProbeFn:()=>null}) -> available:false', function () {
  return runnerMod.probeGuard({ criticProbeFn: function () { return null; } }).then(function (g) {
    assert.strictEqual(g.available, false, 'null critic must be unavailable');
    assert.strictEqual(g.reason, 'guard_unavailable');
  });
});

okAsync('9 closed-schema writer: written file has EXACTLY the closed key set', function () {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'run9-'));
  return runnerMod.runEurekaScan({
    roomDir: dir, pair: PAIR, criticProbeFn: stubCriticCleared,
    scoreFn: stubScore('breakthrough', 'semantic_implementation', 0.6), now: 1720000000000,
  }).then(function (o) {
    assert.strictEqual(o.fired, true, 'should fire: ' + o.reason);
    const written = JSON.parse(fs.readFileSync(o.sideChannelPath, 'utf8'));
    assert.strictEqual(Object.keys(written).sort().join(','), 'bridge,guard,provenance,scanned_at,schema_version', 'top key set');
    assert.strictEqual(Object.keys(written.guard).sort().join(','), 'available,confidence,tags,verdict', 'guard key set');
    assert.strictEqual(Object.keys(written.bridge).sort().join(','), 'a_handle,b_handle,band,differential_quantized,surprise_type', 'bridge key set');
    assert.strictEqual(Object.keys(written.provenance).sort().join(','), 'method,model', 'provenance key set');
    assert.strictEqual(written.schema_version, 1);
    assert.strictEqual(written.guard.verdict, 'transferable');
    assert.strictEqual(written.bridge.a_handle, 'n1');
    assert.strictEqual(written.bridge.differential_quantized, 0.6);
    // The written file must in turn FIRE the sensor (the two halves agree).
    const r = sensorEureka({}, {}, { roomDir: dir });
    assert.ok(r && r.reach_id === 'deep_research', 'runner output must fire the sensor');
  });
});

okAsync('10 guard_not_cleared writes nothing', function () {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'run10-'));
  return runnerMod.runEurekaScan({
    roomDir: dir, pair: PAIR, criticProbeFn: stubCriticFail,
    scoreFn: stubScore('breakthrough', 'semantic_implementation', 0.6),
  }).then(function (o) {
    assert.strictEqual(o.fired, false);
    assert.strictEqual(o.reason, 'guard_not_cleared');
    assert.strictEqual(fs.existsSync(path.join(dir, '.mindrian', 'last-eureka.json')), false, 'must write nothing');
  });
});

okAsync('11 every degrade reason is a member of the closed REASONS enum', function () {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'run11-'));
  const cases = [
    runnerMod.runEurekaScan({ roomDir: '', criticProbeFn: stubCriticCleared }),                                     // room_dir_missing
    runnerMod.runEurekaScan({ roomDir: dir, criticProbeFn: function () { return null; }, pair: PAIR }),              // guard_unavailable
    runnerMod.runEurekaScan({ roomDir: dir, criticProbeFn: stubCriticCleared }),                                    // substrate_unavailable
    runnerMod.runEurekaScan({ roomDir: dir, pair: PAIR, criticProbeFn: stubCriticCleared, scoreFn: stubScore('low', 'semantic_implementation', 0.02) }), // below_floor
    runnerMod.runEurekaScan({ roomDir: dir, pair: PAIR, criticProbeFn: stubCriticFail, scoreFn: stubScore('breakthrough', 'semantic_implementation', 0.6) }), // guard_not_cleared
  ];
  return Promise.all(cases).then(function (results) {
    const seen = results.map(function (r) { return r.reason; });
    seen.forEach(function (reason) {
      assert.ok(runnerMod.REASONS.indexOf(reason) !== -1, 'reason "' + reason + '" not in closed enum');
    });
    assert.deepStrictEqual(seen, ['room_dir_missing', 'guard_unavailable', 'substrate_unavailable', 'below_floor', 'guard_not_cleared']);
  });
});

// ---------- run ----------

(async function run() {
  // async arms sequentially
  for (const arm of asyncArms) {
    try {
      await arm.fn();
      console.log('ok   ' + arm.label);
      PASS += 1;
    } catch (e) {
      console.log('FAIL ' + arm.label + ' -- ' + (e && e.message ? e.message : e));
      FAIL += 1;
    }
  }
  console.log('\nPASS=' + PASS + ' FAIL=' + FAIL);
  process.exit(FAIL === 0 ? 0 : 1);
})();
