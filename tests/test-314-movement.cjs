#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 314-01 Task 2 -- the portfolio movement detector (D-03 composite rule).
 * Legs MV1 to MV11. Pure CJS, node built-ins only, bare node assert. No network.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const mv = require(path.join(REPO, 'lib', 'core', 'eureka', 'portfolio-movement.cjs'));
const snap = require(path.join(REPO, 'lib', 'core', 'eureka', 'portfolio-snapshot.cjs'));

let passed = 0;
let failed = 0;
function ok(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('  PASS ' + name);
  } catch (e) {
    failed += 1;
    console.log('  FAIL ' + name + ' :: ' + (e && e.message));
  }
}

function pair(a, b, band, rank, score) {
  return { a: a, b: b, band: band, score: score === undefined ? 0.5 : score, rank: rank };
}

function makeSnapshot(over) {
  const base = {
    schema_version: 1,
    ran_at: '2026-10-28T10:00:00.000Z',
    scope: 'room',
    scope_id: 'room',
    encoder_kind: 'live',
    provenance: { run_mode: 'live' },
    pairs: [],
    tail: { composition: 'balanced', insufficient_structure: false, suspect_noise: false, items: [] },
    labels: {}
  };
  return Object.assign(base, over || {});
}

const OFF = { schema_version: 1, calibrated: false, top_n: null, reshuffle_min_moved: null, reshuffle_min_displacement: null, calibration: null };
const ON = { schema_version: 1, calibrated: true, top_n: 5, reshuffle_min_moved: 2, reshuffle_min_displacement: 3, calibration: {} };

console.log('test-314-movement');

ok('MV1 no previous run is silent', function () {
  const cur = makeSnapshot({ pairs: [pair('n1', 'n2', 'high', 1)] });
  [null, undefined].forEach(function (prev) {
    const d = mv.diffRuns(prev, cur, OFF);
    assert.strictEqual(d.comparable, false);
    assert.deepStrictEqual(d.events, []);
    assert.deepStrictEqual(d.counts, { band_cross: 0, tail_enter: 0, top_n_reshuffle: 0 });
    assert.strictEqual(d.reason, 'no_previous_run');
    assert.strictEqual(d.reshuffle_active, false);
  });
});

ok('MV2 different scope, encoder or schema is not comparable', function () {
  const cur = makeSnapshot({ pairs: [pair('n1', 'n2', 'high', 1)] });
  const sub = mv.diffRuns(makeSnapshot({ scope: 'subset', scope_id: 's_0a1b2c3d' }), cur, OFF);
  assert.strictEqual(sub.comparable, false);
  assert.ok(sub.reason && sub.reason !== 'no_previous_run');
  assert.deepStrictEqual(sub.events, []);
  const enc = mv.diffRuns(makeSnapshot({ encoder_kind: 'stub' }), cur, OFF);
  assert.strictEqual(enc.comparable, false);
  assert.deepStrictEqual(enc.events, []);
  const sch = mv.diffRuns(makeSnapshot({ schema_version: 2 }), cur, OFF);
  assert.strictEqual(sch.comparable, false);
  assert.deepStrictEqual(sch.events, []);
  const bad = mv.diffRuns({ nonsense: true }, cur, OFF);
  assert.strictEqual(bad.comparable, false);
  const badCur = mv.diffRuns(makeSnapshot(), { nonsense: true }, OFF);
  assert.strictEqual(badCur.comparable, false);
});

ok('MV3 band crossings are caught only when a firing band is involved', function () {
  const prev = makeSnapshot({ pairs: [
    pair('n1', 'n2', 'moderate', 1),
    pair('n3', 'n4', 'high', 2),
    pair('n5', 'n6', 'low', 3),
    pair('n7', 'n8', 'opportunity', 4)
  ] });
  const cur = makeSnapshot({ pairs: [
    pair('n2', 'n1', 'high', 1),          // reversed order, same pair: moderate -> high
    pair('n3', 'n4', 'low', 2),           // high -> low: down
    pair('n5', 'n6', 'moderate', 3),      // low -> moderate: neither firing: nothing
    pair('n7', 'n8', 'opportunity', 4),   // unchanged
    pair('n9', 'n10', 'breakthrough', 5), // new pair in a firing band: from none
    pair('n11', 'n12', 'low', 6)          // new pair, not firing: nothing
  ] });
  const d = mv.diffRuns(prev, cur, OFF);
  assert.strictEqual(d.comparable, true);
  assert.strictEqual(d.counts.band_cross, 3);
  const up = d.events.find(function (e) { return e.a_handle === 'n1'; });
  assert.deepStrictEqual(up, { kind: 'band_cross', a_handle: 'n1', b_handle: 'n2', from_band: 'moderate', to_band: 'high', direction: 'up' });
  const down = d.events.find(function (e) { return e.a_handle === 'n3'; });
  assert.strictEqual(down.direction, 'down');
  assert.strictEqual(down.from_band, 'high');
  assert.strictEqual(down.to_band, 'low');
  const fresh = d.events.find(function (e) { return e.a_handle === 'n10' || e.b_handle === 'n10'; });
  assert.strictEqual(fresh.from_band, 'none');
  assert.strictEqual(fresh.to_band, 'breakthrough');
  assert.strictEqual(fresh.direction, 'up');
  assert.ok(!d.events.some(function (e) { return e.a_handle === 'n5' || e.a_handle === 'n11'; }));
});

ok('MV4 tail entrants, silent when the tail verdict is noise', function () {
  const prev = makeSnapshot({ tail: { composition: 'c', insufficient_structure: false, suspect_noise: false, items: [{ id: 'n1' }] } });
  const cur = makeSnapshot({ tail: { composition: 'c', insufficient_structure: false, suspect_noise: false, items: [{ id: 'n1' }, { id: 'n2' }] } });
  const d = mv.diffRuns(prev, cur, OFF);
  assert.deepStrictEqual(d.events, [{ kind: 'tail_enter', handle: 'n2' }]);
  assert.strictEqual(d.counts.tail_enter, 1);
  ['insufficient_structure', 'suspect_noise'].forEach(function (flag) {
    const noisy = makeSnapshot({ tail: { composition: 'c', insufficient_structure: flag === 'insufficient_structure', suspect_noise: flag === 'suspect_noise', items: [{ id: 'n1' }, { id: 'n2' }] } });
    const dn = mv.diffRuns(prev, noisy, OFF);
    assert.strictEqual(dn.comparable, true);
    assert.deepStrictEqual(dn.events, [], flag);
    assert.strictEqual(dn.counts.tail_enter, 0);
  });
});

ok('MV5 reshuffle stays off while thresholds are not calibrated', function () {
  const prev = makeSnapshot({ pairs: [pair('a1', 'b1', 'low', 1), pair('a2', 'b2', 'low', 2), pair('a3', 'b3', 'low', 3), pair('a4', 'b4', 'low', 4), pair('a5', 'b5', 'low', 5)] });
  const cur = makeSnapshot({ pairs: [pair('c1', 'd1', 'low', 1), pair('c2', 'd2', 'low', 2), pair('c3', 'd3', 'low', 3), pair('c4', 'd4', 'low', 4), pair('c5', 'd5', 'low', 5)] });
  const d = mv.diffRuns(prev, cur, OFF);
  assert.strictEqual(d.reshuffle_active, false);
  assert.strictEqual(d.counts.top_n_reshuffle, 0);
  assert.ok(!d.events.some(function (e) { return e.kind === 'top_n_reshuffle'; }));
  // an uncalibrated flag with numbers filled in is still off
  const half = Object.assign({}, ON, { calibrated: false });
  assert.strictEqual(mv.diffRuns(prev, cur, half).reshuffle_active, false);
  // calibrated true with a null number is off too
  const nulls = Object.assign({}, ON, { reshuffle_min_moved: null });
  assert.strictEqual(mv.diffRuns(prev, cur, nulls).reshuffle_active, false);
  const smallN = Object.assign({}, ON, { top_n: 1 });
  assert.strictEqual(mv.diffRuns(prev, cur, smallN).reshuffle_active, false);
});

ok('MV6 reshuffle with injected calibrated thresholds', function () {
  const mk = function (names) {
    return makeSnapshot({ pairs: names.map(function (n, i) { return pair(n + 'a', n + 'b', 'low', i + 1); }) });
  };
  const prev = mk(['p1', 'p2', 'p3', 'p4', 'p5']);
  // 2 entered, 2 left
  const swapped = mk(['p1', 'p2', 'p3', 'q4', 'q5']);
  const d1 = mv.diffRuns(prev, swapped, ON);
  assert.strictEqual(d1.reshuffle_active, true);
  assert.strictEqual(d1.counts.top_n_reshuffle, 1);
  assert.deepStrictEqual(d1.events.filter(function (e) { return e.kind === 'top_n_reshuffle'; }), [{ kind: 'top_n_reshuffle', top_n: 5, entered: 2, left: 2, max_shift: 0 }]);
  // same members, max shift 3 (p1 moves from rank 1 to rank 4)
  const shifted = mk(['p2', 'p3', 'p4', 'p1', 'p5']);
  const d2 = mv.diffRuns(prev, shifted, ON);
  const e2 = d2.events.filter(function (e) { return e.kind === 'top_n_reshuffle'; });
  assert.strictEqual(e2.length, 1);
  assert.strictEqual(e2[0].max_shift, 3);
  assert.strictEqual(e2[0].entered, 0);
  // identical top-5: nothing
  const d3 = mv.diffRuns(prev, mk(['p1', 'p2', 'p3', 'p4', 'p5']), ON);
  assert.deepStrictEqual(d3.events, []);
  assert.strictEqual(d3.reshuffle_active, true);
  // below both thresholds: 1 entered + 1 left, shift 0
  const d4 = mv.diffRuns(prev, mk(['p1', 'p2', 'p3', 'p4', 'q5']), ON);
  assert.deepStrictEqual(d4.events, []);
});

ok('MV7 events are ordered and counts hold the full numbers', function () {
  const prevPairs = [];
  const curPairs = [];
  for (let i = 1; i <= 5; i += 1) {
    prevPairs.push(pair('x' + i, 'y' + i, 'moderate', i));
    curPairs.push(pair('x' + i, 'y' + i, 'high', i));
  }
  const prev = makeSnapshot({ pairs: prevPairs, tail: { composition: 'c', insufficient_structure: false, suspect_noise: false, items: [] } });
  const cur = makeSnapshot({
    pairs: curPairs.slice().reverse(),
    tail: { composition: 'c', insufficient_structure: false, suspect_noise: false, items: [{ id: 'z2' }, { id: 'z1' }] }
  });
  const d = mv.diffRuns(prev, cur, OFF);
  assert.strictEqual(d.counts.band_cross, 5);
  assert.strictEqual(d.counts.tail_enter, 2);
  const kinds = d.events.map(function (e) { return e.kind; });
  assert.deepStrictEqual(kinds, ['band_cross', 'band_cross', 'band_cross', 'band_cross', 'band_cross', 'tail_enter', 'tail_enter']);
  assert.deepStrictEqual(d.events.slice(0, 5).map(function (e) { return e.a_handle; }), ['x1', 'x2', 'x3', 'x4', 'x5']);
  assert.deepStrictEqual(d.events.slice(5).map(function (e) { return e.handle; }), ['z1', 'z2']);
  // determinism: the same input twice gives deep-equal output
  assert.deepStrictEqual(mv.diffRuns(prev, cur, OFF), d);
  // reshuffle sorts after tail_enter
  const prev2 = makeSnapshot({ pairs: [pair('a1', 'b1', 'low', 1), pair('a2', 'b2', 'low', 2)], tail: { composition: 'c', insufficient_structure: false, suspect_noise: false, items: [] } });
  const cur2 = makeSnapshot({ pairs: [pair('c1', 'd1', 'low', 1), pair('c2', 'd2', 'low', 2)], tail: { composition: 'c', insufficient_structure: false, suspect_noise: false, items: [{ id: 'z9' }] } });
  const on2 = { calibrated: true, top_n: 2, reshuffle_min_moved: 2, reshuffle_min_displacement: 5, calibration: {} };
  const d2 = mv.diffRuns(prev2, cur2, on2);
  assert.deepStrictEqual(d2.events.map(function (e) { return e.kind; }), ['tail_enter', 'top_n_reshuffle']);
});

ok('MV8 buildMovementEnvelope: null for no events, closed, capped, stable id', function () {
  const prev = makeSnapshot({ pairs: [pair('n1', 'n2', 'moderate', 1)] });
  const calm = makeSnapshot({ pairs: [pair('n1', 'n2', 'moderate', 1)] });
  const dCalm = mv.diffRuns(prev, calm, OFF);
  assert.strictEqual(mv.buildMovementEnvelope(dCalm, calm, new Date('2026-10-28T12:00:00Z')), null);
  assert.strictEqual(mv.buildMovementEnvelope(mv.diffRuns(null, calm, OFF), calm, new Date()), null);
  assert.strictEqual(mv.buildMovementEnvelope(null, calm, new Date()), null);

  const prevPairs = [];
  const curPairs = [];
  for (let i = 1; i <= 6; i += 1) {
    prevPairs.push(pair('x' + i, 'y' + i, 'moderate', i));
    curPairs.push(pair('x' + i, 'y' + i, 'high', i));
  }
  const p2 = makeSnapshot({ pairs: prevPairs, labels: { x1: 'Secret prose about the venture' } });
  const c2 = makeSnapshot({ pairs: curPairs, labels: { x1: 'Secret prose about the venture' } });
  const d = mv.diffRuns(p2, c2, OFF);
  const now = new Date('2026-10-28T12:00:00.000Z');
  const env = mv.buildMovementEnvelope(d, c2, now);
  assert.ok(env);
  assert.deepStrictEqual(Object.keys(env).sort(), ['counts', 'detected_at', 'encoder_kind', 'events', 'kind', 'movement_id', 'schema_version', 'scope', 'scope_id']);
  assert.strictEqual(env.kind, 'portfolio_movement');
  assert.strictEqual(env.scope_id, 'room');
  assert.strictEqual(env.scope, 'room');
  assert.strictEqual(env.encoder_kind, 'live');
  assert.strictEqual(env.detected_at, '2026-10-28T12:00:00.000Z');
  assert.ok(snap.SCOPE_ID_RE.test(env.scope_id));
  assert.ok(/^pm_[0-9a-f]{12}$/.test(env.movement_id));
  assert.strictEqual(env.events.length, 3);
  assert.strictEqual(env.counts.band_cross, 6, 'counts hold the full number');
  assert.strictEqual(mv.MAX_EVENTS, 3);
  assert.ok(JSON.stringify(env).indexOf('Secret') === -1);
  const env2 = mv.buildMovementEnvelope(mv.diffRuns(p2, c2, OFF), c2, new Date('2027-01-01T00:00:00Z'));
  assert.strictEqual(env2.movement_id, env.movement_id, 'same inputs, same id');
  assert.strictEqual(mv.validateEnvelope(env), true);
  // a subset scope carries its hashed id
  const sid = snap.scopeId('opportunity-bank');
  const ps = makeSnapshot({ scope: 'subset', scope_id: sid, pairs: [pair('n1', 'n2', 'moderate', 1)] });
  const cs = makeSnapshot({ scope: 'subset', scope_id: sid, pairs: [pair('n1', 'n2', 'high', 1)] });
  const envS = mv.buildMovementEnvelope(mv.diffRuns(ps, cs, OFF), cs, now);
  assert.strictEqual(envS.scope, 'subset');
  assert.strictEqual(envS.scope_id, sid);
  assert.notStrictEqual(envS.movement_id, mv.buildMovementEnvelope(mv.diffRuns(p2, c2, OFF), c2, now).movement_id);
});

ok('MV9 validateEnvelope rejects every drift', function () {
  const prev = makeSnapshot({ pairs: [pair('n1', 'n2', 'moderate', 1)], tail: { composition: 'c', insufficient_structure: false, suspect_noise: false, items: [] } });
  const cur = makeSnapshot({ pairs: [pair('n1', 'n2', 'high', 1)], tail: { composition: 'c', insufficient_structure: false, suspect_noise: false, items: [{ id: 'n9' }] } });
  const good = mv.buildMovementEnvelope(mv.diffRuns(prev, cur, OFF), cur, new Date('2026-10-28T12:00:00Z'));
  assert.strictEqual(mv.validateEnvelope(good), true);
  const clone = function () { return JSON.parse(JSON.stringify(good)); };
  const mutate = function (fn) { const e = clone(); fn(e); return mv.validateEnvelope(e); };
  assert.strictEqual(mutate(function (e) { e.title = 'x'; }), false, 'extra key');
  assert.strictEqual(mutate(function (e) { e.scope_id = 'bad'; }), false, 'scope_id outside the pattern');
  assert.strictEqual(mutate(function (e) { e.scope_id = 's_0a1b2c3d'; }), false, 'scope_id disagrees with scope');
  assert.strictEqual(mutate(function (e) { e.events[0].kind = 'mystery'; }), false, 'unknown kind');
  assert.strictEqual(mutate(function (e) { e.events[0].a_handle = 'a/b'; }), false, 'handle with slash');
  assert.strictEqual(mutate(function (e) { e.events[0].handle = 'x'; }), false, 'event extra key');
  assert.strictEqual(mutate(function (e) { e.events = [e.events[0], e.events[0], e.events[0], e.events[0]]; }), false, 'four events');
  assert.strictEqual(mutate(function (e) { e.counts.band_cross = -1; }), false, 'negative count');
  assert.strictEqual(mutate(function (e) { e.counts.band_cross = 1.5; }), false, 'fractional count');
  assert.strictEqual(mutate(function (e) { e.counts.extra = 1; }), false, 'counts extra key');
  assert.strictEqual(mutate(function (e) { e.encoder_kind = 'remote'; }), false, 'encoder kind');
  assert.strictEqual(mutate(function (e) { e.movement_id = 'pm_xyz'; }), false, 'movement id');
  assert.strictEqual(mutate(function (e) { e.schema_version = 2; }), false, 'schema version');
  assert.strictEqual(mutate(function (e) { e.kind = 'other'; }), false, 'envelope kind');
  assert.strictEqual(mutate(function (e) { e.detected_at = 'soon'; }), false, 'detected_at');
  assert.strictEqual(mutate(function (e) { e.events = []; }), false, 'no events');
  assert.strictEqual(mutate(function (e) { e.events[0].from_band = 'mega'; }), false, 'band');
  assert.strictEqual(mutate(function (e) { e.events[0].direction = 'sideways'; }), false, 'direction');
  assert.strictEqual(mv.validateEnvelope(null), false);
  assert.strictEqual(mv.validateEnvelope('x'), false);
  // reshuffle and tail event shapes validate
  const rs = clone();
  rs.events = [{ kind: 'top_n_reshuffle', top_n: 5, entered: 2, left: 2, max_shift: 3 }, { kind: 'tail_enter', handle: 'n9' }];
  assert.strictEqual(mv.validateEnvelope(rs), true);
  rs.events[0].top_n = 1;
  assert.strictEqual(mv.validateEnvelope(rs), false, 'top_n floor of 2');
});

ok('MV10 loadThresholds on the shipped file and on bad files', function () {
  const t = mv.loadThresholds();
  assert.strictEqual(typeof t.calibrated, 'boolean');
  if (t.calibrated === false) {
    assert.strictEqual(t.top_n, null);
    assert.strictEqual(t.reshuffle_min_moved, null);
    assert.strictEqual(t.reshuffle_min_displacement, null);
  } else {
    ['top_n', 'reshuffle_min_moved', 'reshuffle_min_displacement'].forEach(function (k) {
      assert.ok(Number.isInteger(t[k]) && t[k] > 0, k);
    });
    assert.ok(t.calibration && typeof t.calibration === 'object');
  }
  const shipped = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'eureka-portfolio-thresholds.json'), 'utf8'));
  assert.deepStrictEqual(Object.keys(shipped).sort(), ['calibrated', 'calibration', 'reshuffle_min_displacement', 'reshuffle_min_moved', 'schema_version', 'top_n']);
  assert.ok(!/—|–/.test(fs.readFileSync(path.join(REPO, 'data', 'eureka-portfolio-thresholds.json'), 'utf8')));

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't314-mv-'));
  try {
    const dflt = mv.loadThresholds(path.join(dir, 'missing.json'));
    assert.strictEqual(dflt.calibrated, false);
    assert.strictEqual(dflt.top_n, null);
    const corrupt = path.join(dir, 'corrupt.json');
    fs.writeFileSync(corrupt, '{ nope');
    assert.strictEqual(mv.loadThresholds(corrupt).calibrated, false);
    // calibrated true with a bad number falls back to the default
    const half = path.join(dir, 'half.json');
    fs.writeFileSync(half, JSON.stringify({ schema_version: 1, calibrated: true, top_n: 5, reshuffle_min_moved: 0, reshuffle_min_displacement: 3, calibration: {} }));
    assert.strictEqual(mv.loadThresholds(half).calibrated, false);
    const noCal = path.join(dir, 'nocal.json');
    fs.writeFileSync(noCal, JSON.stringify({ schema_version: 1, calibrated: true, top_n: 5, reshuffle_min_moved: 2, reshuffle_min_displacement: 3, calibration: null }));
    assert.strictEqual(mv.loadThresholds(noCal).calibrated, false);
    const good = path.join(dir, 'good.json');
    fs.writeFileSync(good, JSON.stringify({ schema_version: 1, calibrated: true, top_n: 10, reshuffle_min_moved: 3, reshuffle_min_displacement: 4, calibration: { run: 'x' } }));
    const g = mv.loadThresholds(good);
    assert.strictEqual(g.calibrated, true);
    assert.strictEqual(g.top_n, 10);
    // calibrated false with numbers set is forced to nulls
    const mixed = path.join(dir, 'mixed.json');
    fs.writeFileSync(mixed, JSON.stringify({ schema_version: 1, calibrated: false, top_n: 10, reshuffle_min_moved: 3, reshuffle_min_displacement: 4, calibration: null }));
    const m = mv.loadThresholds(mixed);
    assert.strictEqual(m.calibrated, false);
    assert.strictEqual(m.top_n, null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

ok('MV11 topNMetrics is the one measure the detector uses', function () {
  const prev = makeSnapshot({ pairs: [pair('a1', 'b1', 'low', 1), pair('a2', 'b2', 'low', 2), pair('a3', 'b3', 'low', 3)] });
  assert.deepStrictEqual(mv.topNMetrics(prev, prev, 3), { entered: 0, left: 0, max_shift: 0 });
  const cur = makeSnapshot({ pairs: [pair('a2', 'b2', 'low', 1), pair('a3', 'b3', 'low', 2), pair('z1', 'z2', 'low', 3), pair('a1', 'b1', 'low', 4)] });
  // top 3 of prev: a1 a2 a3. top 3 of cur: a2 a3 z. entered 1 (z), left 1 (a1), shifts: a2 1, a3 1.
  assert.deepStrictEqual(mv.topNMetrics(prev, cur, 3), { entered: 1, left: 1, max_shift: 1 });
  assert.deepStrictEqual(mv.topNMetrics(null, cur, 3), { entered: 0, left: 0, max_shift: 0 });
  // diffRuns agrees with it
  const thr = { calibrated: true, top_n: 3, reshuffle_min_moved: 2, reshuffle_min_displacement: 9, calibration: {} };
  const d = mv.diffRuns(prev, cur, thr);
  const ev = d.events.filter(function (e) { return e.kind === 'top_n_reshuffle'; });
  assert.strictEqual(ev.length, 1);
  const m = mv.topNMetrics(prev, cur, 3);
  assert.deepStrictEqual({ entered: ev[0].entered, left: ev[0].left, max_shift: ev[0].max_shift }, m);
  // the detector source holds no numeric top_n literal besides the floor of 2
  const src = fs.readFileSync(path.join(REPO, 'lib', 'core', 'eureka', 'portfolio-movement.cjs'), 'utf8');
  assert.ok(!/top_n\s*[:=]\s*[0-9]/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')), 'no numeric top_n literal');
  assert.ok(!/—|–/.test(src), 'no em-dash or en-dash');
  const reqs = (src.match(/require\(\s*['"][^'"]+['"]\s*\)/g) || []);
  reqs.forEach(function (r) {
    const name = /['"]([^'"]+)['"]/.exec(r)[1];
    assert.ok(!/^(node:)?(http|https|net|tls|dgram|dns)$/.test(name), 'forbidden require ' + name);
  });
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
