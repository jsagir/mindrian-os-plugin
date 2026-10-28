'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 314-03 Task 1 -- SENS-13 evidence shape B (portfolio movement).
 * Legs B1 to B12. Hermetic: temp rooms under os.tmpdir(), no network.
 * Hyphens only. No dash characters are typed in this file.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const sensorMod = require(path.join(REPO, 'lib', 'core', 'sensors', 'sensor-eureka.cjs'));
const store = require(path.join(REPO, 'lib', 'core', 'eureka', 'portfolio-snapshot.cjs'));
const FIXTURE_B = path.join(REPO, 'tests', 'fixtures', '314', 'movement-live.json');
const FIXTURE_A = path.join(REPO, 'tests', 'fixtures', '213', 'last-eureka.json');

const { sensorEureka } = sensorMod;
const STORE_REL = path.join('.mindrian', 'eureka-portfolio');

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

function baseEnv() {
  return JSON.parse(fs.readFileSync(FIXTURE_B, 'utf8'));
}

function makeRoom() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm314-shape-b-'));
  fs.mkdirSync(path.join(dir, STORE_REL), { recursive: true });
  return dir;
}

/** Write a movement file for env under its scope; ageMs sets how old the mtime is. */
function putMovement(dir, env, ageMs, fileScope) {
  const sid = fileScope || env.scope_id;
  const target = path.join(dir, STORE_REL, 'movement-' + sid + '.json');
  fs.writeFileSync(target, JSON.stringify(env, null, 2));
  if (typeof ageMs === 'number') {
    const when = (Date.now() - ageMs) / 1000;
    fs.utimesSync(target, when, when);
  }
  return target;
}

function putSeen(dir, ids) {
  fs.writeFileSync(path.join(dir, STORE_REL, 'movement-seen.json'), JSON.stringify({ schema_version: 1, seen: ids }));
}

function withEnv(over) {
  return Object.assign(baseEnv(), over);
}

function subsetEnv(movementId, detectedAt) {
  return withEnv({
    movement_id: movementId,
    detected_at: detectedAt,
    scope: 'subset',
    scope_id: 's_0a1b2c3d',
  });
}

function copyFixtureA(dir) {
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  const target = path.join(dir, '.mindrian', 'last-eureka.json');
  fs.writeFileSync(target, fs.readFileSync(FIXTURE_A, 'utf8'));
  return target;
}

console.log('test-314-sensor-shape-b.cjs: SENS-13 evidence shape B (portfolio movement)');

ok('B1 a fresh valid live unseen movement fires the deep_research reach with flat evidence', () => {
  const dir = makeRoom();
  putMovement(dir, baseEnv(), 0);
  const r = sensorEureka({}, {}, { roomDir: dir });
  assert.ok(r, 'expected a reach');
  assert.ok(Object.isFrozen(r), 'reach is frozen');
  assert.equal(r.reach_id, 'deep_research');
  assert.equal(r.posture, 'hold');
  assert.equal(r.signal, 'eureka_portfolio_movement');
  assert.equal(sensorMod.PORTFOLIO_SIGNAL, 'eureka_portfolio_movement');
  const ev = r.evidence;
  assert.equal(ev.movement_id, 'pm_0123456789ab');
  assert.equal(ev.scope, 'room');
  assert.equal(ev.band_cross_count, 1);
  assert.equal(ev.tail_enter_count, 0);
  assert.equal(ev.reshuffle_count, 0);
  assert.equal(ev.first_kind, 'band_cross');
  assert.equal(ev.first_a_handle, 'n042');
  assert.equal(ev.first_b_handle, 'n317');
  assert.equal(ev.first_to_band, 'high');
  assert.equal(ev.first_direction, 'up');
  for (const k of Object.keys(ev)) {
    assert.ok(['string', 'number', 'boolean'].indexOf(typeof ev[k]) !== -1, 'flat evidence value: ' + k);
  }
});

ok('B1b a tail_enter first event leaves the band_cross fields as empty strings', () => {
  const dir = makeRoom();
  putMovement(dir, withEnv({
    counts: { band_cross: 0, tail_enter: 1, top_n_reshuffle: 0 },
    events: [{ kind: 'tail_enter', handle: 'n900' }],
  }), 0);
  const r = sensorEureka({}, {}, { roomDir: dir });
  assert.ok(r);
  assert.equal(r.evidence.first_kind, 'tail_enter');
  assert.equal(r.evidence.first_a_handle, 'n900');
  assert.equal(r.evidence.first_b_handle, '');
  assert.equal(r.evidence.first_to_band, '');
  assert.equal(r.evidence.first_direction, '');
});

ok('B2 a stub encoder movement never fires', () => {
  const dir = makeRoom();
  putMovement(dir, withEnv({ encoder_kind: 'stub' }), 0);
  assert.equal(sensorEureka({}, {}, { roomDir: dir }), null);
});

ok('B3 a movement older than 24 hours or dated in the future never fires', () => {
  const stale = makeRoom();
  putMovement(stale, baseEnv(), 25 * 60 * 60 * 1000);
  assert.equal(sensorEureka({}, {}, { roomDir: stale }), null);
  const edge = makeRoom();
  putMovement(edge, baseEnv(), 23 * 60 * 60 * 1000);
  assert.ok(sensorEureka({}, {}, { roomDir: edge }), 'inside 24 hours still fires');
  const future = makeRoom();
  putMovement(future, baseEnv(), -60 * 1000);
  assert.equal(sensorEureka({}, {}, { roomDir: future }), null);
});

ok('B4 no movement file means silence (no store folder at all, and an empty one)', () => {
  const empty = makeRoom();
  assert.equal(sensorEureka({}, {}, { roomDir: empty }), null);
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'pm314-bare-'));
  assert.equal(sensorEureka({}, {}, { roomDir: bare }), null);
  assert.equal(sensorEureka({}, {}, {}), null);
  assert.equal(sensorEureka({}, {}, null), null);
});

ok('B5 seen list: seen id is silent, corrupt seen file fails closed, other ids still fire', () => {
  const seen = makeRoom();
  putMovement(seen, baseEnv(), 0);
  putSeen(seen, ['pm_0123456789ab']);
  assert.equal(sensorEureka({}, {}, { roomDir: seen }), null);

  const corrupt = makeRoom();
  putMovement(corrupt, baseEnv(), 0);
  fs.writeFileSync(path.join(corrupt, STORE_REL, 'movement-seen.json'), '{not json');
  assert.equal(sensorEureka({}, {}, { roomDir: corrupt }), null);

  const other = makeRoom();
  putMovement(other, baseEnv(), 0);
  putSeen(other, ['pm_ffffffffffff']);
  assert.ok(sensorEureka({}, {}, { roomDir: other }));
});

ok('B6 closed-schema violations never fire', () => {
  const cases = {
    wrong_schema_version: withEnv({ schema_version: 2 }),
    unknown_kind: withEnv({ kind: 'something_else' }),
    zero_counts: withEnv({ counts: { band_cross: 0, tail_enter: 0, top_n_reshuffle: 0 } }),
    empty_events: withEnv({ events: [] }),
    bad_movement_id: withEnv({ movement_id: 'pm_XYZ' }),
    bad_scope_enum: withEnv({ scope: 'galaxy' }),
    extra_key: withEnv({ title: 'room text' }),
    bad_event_kind: withEnv({ events: [{ kind: 'mystery', handle: 'n1' }] }),
    slash_handle: withEnv({ events: [{ kind: 'tail_enter', handle: 'a/b' }] }),
    slash_handle_pair: withEnv({ events: [{ kind: 'band_cross', a_handle: 'n1', b_handle: '../x', from_band: 'low', to_band: 'high', direction: 'up' }] }),
    bad_direction: withEnv({ events: [{ kind: 'band_cross', a_handle: 'n1', b_handle: 'n2', from_band: 'low', to_band: 'high', direction: 'sideways' }] }),
  };
  for (const name of Object.keys(cases)) {
    const dir = makeRoom();
    putMovement(dir, cases[name], 0);
    assert.equal(sensorEureka({}, {}, { roomDir: dir }), null, name + ' must not fire');
  }
  // scope_id that does not match the file name
  const mismatch = makeRoom();
  putMovement(mismatch, subsetEnv('pm_aaaaaaaaaaaa', '2026-10-28T09:00:00.000Z'), 0, 'room');
  assert.equal(sensorEureka({}, {}, { roomDir: mismatch }), null, 'file name and scope_id disagree');
  // scope_id outside the enum
  const badSid = makeRoom();
  putMovement(badSid, withEnv({ scope: 'subset', scope_id: 's_ZZZZZZZZ' }), 0, 'room');
  assert.equal(sensorEureka({}, {}, { roomDir: badSid }), null, 'scope id outside the enum');
});

ok('B7 shape A wins when both shapes are present; shape A alone is unchanged', () => {
  const both = makeRoom();
  copyFixtureA(both);
  putMovement(both, baseEnv(), 0);
  const r = sensorEureka({}, {}, { roomDir: both });
  assert.ok(r);
  assert.equal(r.signal, 'eureka_bridge');
  assert.equal(r.evidence.band, 'breakthrough');

  const onlyA = makeRoom();
  copyFixtureA(onlyA);
  const ra = sensorEureka({}, {}, { roomDir: onlyA });
  assert.ok(ra);
  assert.equal(ra.signal, 'eureka_bridge');
  assert.equal(ra.evidence.a_handle, 'n042');
});

ok('B8 registry pin: 23 ids, SENS-13 once, no SENS-22, no portfolio sensor file', () => {
  const sensors = require(path.join(REPO, 'lib', 'core', 'insight-sensors.cjs'));
  const ids = sensors.SENSOR_REGISTRY_IDS;
  assert.equal(ids.length, 23);
  assert.equal(ids.filter((x) => x === 'SENS-13').length, 1);
  assert.equal(ids.indexOf('SENS-22'), -1);
  const names = fs.readdirSync(path.join(REPO, 'lib', 'core', 'sensors'));
  assert.deepEqual(names.filter((n) => /portfolio/i.test(n)), []);
});

ok('B9 drift pin: replicated constants equal the producer exports', () => {
  assert.equal(sensorMod.PORTFOLIO_STORE_RELPATH, path.join('.mindrian', store.STORE_DIRNAME));
  assert.equal(sensorMod.PORTFOLIO_MOVEMENT_PREFIX, store.MOVEMENT_PREFIX);
  assert.equal(sensorMod.PORTFOLIO_MOVEMENT_SUFFIX, store.MOVEMENT_SUFFIX);
  assert.equal(sensorMod.PORTFOLIO_SCOPE_ID_RE.source, store.SCOPE_ID_RE.source);
  assert.equal(sensorMod.PORTFOLIO_SEEN_RELPATH, path.join('.mindrian', store.STORE_DIRNAME, store.SEEN_FILE));
  assert.equal(sensorMod.PORTFOLIO_HANDLE_RE.source, store.HANDLE_RE.source);
  assert.equal(sensorMod.MOVEMENT_ID_RE.source, store.MOVEMENT_ID_RE.source);
  assert.equal(sensorMod.PORTFOLIO_MAX_FILES, store.MAX_MOVEMENT_FILES);
  assert.equal(sensorMod.PORTFOLIO_FRESHNESS_MS, 24 * 60 * 60 * 1000);
  assert.equal(sensorMod.PORTFOLIO_SCHEMA_VERSION, 1);
});

ok('B10 recognition arm: dispatchSensors and the real decide() surface the movement', () => {
  const sensors = require(path.join(REPO, 'lib', 'core', 'insight-sensors.cjs'));
  const nav = require(path.join(REPO, 'lib', 'core', 'navigation-engine.cjs'));
  const dir = makeRoom();
  putMovement(dir, baseEnv(), 0);
  const reaches = sensors.dispatchSensors({ text: 'quiet turn', turn_count: 5 }, {}, { roomDir: dir });
  const hit = reaches.find((r) => r && r.signal === 'eureka_portfolio_movement');
  assert.ok(hit, 'dispatchSensors did not emit the shape B reach');
  assert.equal(hit.reach_id, 'deep_research');
  const decision = nav.decide({ text: 'quiet turn', turn_count: 5 }, { roomDir: dir });
  assert.equal(decision.fire_skill, nav.reachIdToSkillFamily('deep_research'));
});

ok('B11 source fence: no http, no producer require, no write call', () => {
  const src = fs.readFileSync(path.join(REPO, 'lib', 'core', 'sensors', 'sensor-eureka.cjs'), 'utf8');
  assert.equal(/https?:/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), false, 'no http in code');
  assert.equal(/require\([^)]*portfolio-snapshot/.test(src), false);
  assert.equal(/require\([^)]*portfolio-movement/.test(src), false);
  assert.equal(/writeFile|appendFile|renameSync|mkdirSync|rmSync|unlinkSync|createWriteStream/.test(src), false, 'no write call');
});

ok('B12 several scopes: newest first, seen one at a time, junk ignored, cap of 8 files', () => {
  const dir = makeRoom();
  const room = withEnv({ movement_id: 'pm_aaaaaaaaaaaa', detected_at: '2026-10-28T08:00:00.000Z' });
  const sub = subsetEnv('pm_bbbbbbbbbbbb', '2026-10-28T09:00:00.000Z');
  putMovement(dir, room, 0);
  putMovement(dir, sub, 0);
  let r = sensorEureka({}, {}, { roomDir: dir });
  assert.ok(r);
  assert.equal(r.evidence.movement_id, 'pm_bbbbbbbbbbbb', 'newest detected_at wins');
  assert.equal(r.evidence.scope, 'subset');
  putSeen(dir, ['pm_bbbbbbbbbbbb']);
  r = sensorEureka({}, {}, { roomDir: dir });
  assert.ok(r);
  assert.equal(r.evidence.movement_id, 'pm_aaaaaaaaaaaa', 'the other one fires after the first is seen');
  putSeen(dir, ['pm_bbbbbbbbbbbb', 'pm_aaaaaaaaaaaa']);
  assert.equal(sensorEureka({}, {}, { roomDir: dir }), null, 'both seen is silent');

  // a stub file and a stale file among them are ignored while a valid one fires
  const mix = makeRoom();
  putMovement(mix, withEnv({ movement_id: 'pm_cccccccccccc', encoder_kind: 'stub' }), 0);
  putMovement(mix, subsetEnv('pm_dddddddddddd', '2026-10-28T09:00:00.000Z'), 26 * 60 * 60 * 1000);
  assert.equal(sensorEureka({}, {}, { roomDir: mix }), null, 'only junk is silent');
  const mix2 = makeRoom();
  putMovement(mix2, withEnv({ movement_id: 'pm_cccccccccccc', encoder_kind: 'stub' }), 0);
  putMovement(mix2, subsetEnv('pm_dddddddddddd', '2026-10-28T09:00:00.000Z'), 0);
  r = sensorEureka({}, {}, { roomDir: mix2 });
  assert.ok(r);
  assert.equal(r.evidence.movement_id, 'pm_dddddddddddd');

  // cap: 9 valid files, the oldest by mtime is not read
  const cap = makeRoom();
  const hexes = ['00000001', '00000002', '00000003', '00000004', '00000005', '00000006', '00000007', '00000008'];
  hexes.forEach(function (h, i) {
    const id = 'pm_' + String(i + 1).padStart(12, '0');
    putMovement(cap, withEnv({
      movement_id: id,
      detected_at: '2026-10-28T10:00:00.000Z',
      scope: 'subset',
      scope_id: 's_' + h,
    }), (i + 1) * 60 * 1000);
  });
  // the 9th file is the OLDEST by mtime but carries the NEWEST detected_at
  putMovement(cap, withEnv({
    movement_id: 'pm_eeeeeeeeeeee',
    detected_at: '2026-10-28T11:00:00.000Z',
  }), 20 * 60 * 1000);
  r = sensorEureka({}, {}, { roomDir: cap });
  assert.ok(r);
  assert.notEqual(r.evidence.movement_id, 'pm_eeeeeeeeeeee', 'the ninth (oldest by mtime) file is not read');
});

console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL === 0 ? 0 : 1);
