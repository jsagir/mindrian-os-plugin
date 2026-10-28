#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 314-01 Task 1 -- the closed-schema portfolio snapshot store.
 * Legs S1 to S10. Pure CJS, node built-ins only, bare node assert.
 * Each leg uses its own temp room and removes it. No network.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const REPO = path.resolve(__dirname, '..');
const SNAP_PATH = path.join(REPO, 'lib', 'core', 'eureka', 'portfolio-snapshot.cjs');
const MOVE_PATH = path.join(REPO, 'lib', 'core', 'eureka', 'portfolio-movement.cjs');

const snap = require(SNAP_PATH);

let passed = 0;
let failed = 0;
function ok(name, fn) {
  const rooms = [];
  try {
    fn(function mk() {
      const d = fs.mkdtempSync(path.join(os.tmpdir(), 't314-snap-'));
      rooms.push(d);
      return d;
    });
    passed += 1;
    console.log('  PASS ' + name);
  } catch (e) {
    failed += 1;
    console.log('  FAIL ' + name + ' :: ' + (e && e.message));
  } finally {
    rooms.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* ignore */ } });
  }
}

function makeSnapshot(over) {
  const base = {
    schema_version: 1,
    ran_at: '2026-10-28T10:00:00.000Z',
    scope: 'room',
    scope_id: 'room',
    encoder_kind: 'live',
    provenance: { run_mode: 'live', encoder_model: 'e5-test', pairs_scored: 3, pairs_capped: false, note: null },
    pairs: [
      { a: 'n001', b: 'n002', band: 'high', score: 0.81, rank: 1 },
      { a: 'entity:entity-extract:7d0acf8a', b: 'n003', band: 'moderate', score: 0.42, rank: 2 },
      { a: 'n004', b: 'n005', band: 'low', score: 0.1, rank: 3 }
    ],
    tail: { composition: 'balanced', insufficient_structure: false, suspect_noise: false, items: [{ id: 'n006' }] },
    labels: { n001: 'First thing', n002: 'Second thing' }
  };
  return Object.assign(base, over || {});
}

function movementEnvelope(scopeId, id, detectedAt) {
  return {
    schema_version: 1,
    kind: 'portfolio_movement',
    movement_id: id,
    detected_at: detectedAt,
    scope: scopeId === 'room' ? 'room' : 'subset',
    scope_id: scopeId,
    encoder_kind: 'live',
    counts: { band_cross: 1, tail_enter: 0, top_n_reshuffle: 0 },
    events: [{ kind: 'band_cross', a_handle: 'n001', b_handle: 'n002', from_band: 'moderate', to_band: 'high', direction: 'up' }]
  };
}

function listing(dir) {
  const out = [];
  (function walk(d) {
    fs.readdirSync(d, { withFileTypes: true }).forEach(function (e) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else out.push(path.relative(dir, p));
    });
  })(dir);
  return out.sort();
}

const HAS_MOVEMENT_MODULE = fs.existsSync(MOVE_PATH);

console.log('test-314-snapshot');

ok('S1 scopeDir builds the room and section folders, refuses bad slugs', function (mk) {
  const room = mk();
  const store = path.join(room, '.mindrian', 'eureka-portfolio');
  assert.strictEqual(snap.scopeDir(room, 'room'), path.join(store, 'room'));
  assert.strictEqual(snap.scopeDir(room, 'opportunity-bank'), path.join(store, 'section-opportunity-bank'));
  ['../x', 'a/b', '', 'A B', 'a'.repeat(65), '-lead', null, undefined, 7].forEach(function (bad) {
    assert.strictEqual(snap.scopeDir(room, bad), null, 'slug ' + String(bad));
  });
  assert.notStrictEqual(snap.scopeDir(room, 'a'.repeat(64)), null);
});

ok('S2 validateSnapshot accepts a good snapshot and rejects bad ones', function () {
  assert.strictEqual(snap.validateSnapshot(makeSnapshot()), true);
  assert.strictEqual(snap.validateSnapshot(makeSnapshot({ extra: 1 })), false, 'extra top key');
  assert.strictEqual(snap.validateSnapshot(makeSnapshot({ schema_version: 2 })), false, 'version 2');
  const badBand = makeSnapshot();
  badBand.pairs[0].band = 'mega';
  assert.strictEqual(snap.validateSnapshot(badBand), false, 'band');
  const space = makeSnapshot();
  space.pairs[0].a = 'n 001';
  assert.strictEqual(snap.validateSnapshot(space), false, 'handle space');
  const slash = makeSnapshot();
  slash.pairs[0].b = 'a/b';
  assert.strictEqual(snap.validateSnapshot(slash), false, 'handle slash');
  const longLabel = makeSnapshot();
  longLabel.labels.n001 = 'x'.repeat(81);
  assert.strictEqual(snap.validateSnapshot(longLabel), false, 'label 81');
  const okLabel = makeSnapshot();
  okLabel.labels.n001 = 'x'.repeat(80);
  assert.strictEqual(snap.validateSnapshot(okLabel), true, 'label 80');
  const many = makeSnapshot();
  many.pairs = [];
  for (let i = 0; i < 20001; i += 1) many.pairs.push({ a: 'a' + i, b: 'b' + i, band: 'low', score: 0.1, rank: i + 1 });
  assert.strictEqual(snap.validateSnapshot(many), false, '20001 pairs');
  const nan = makeSnapshot();
  nan.pairs[0].score = NaN;
  assert.strictEqual(snap.validateSnapshot(nan), false, 'NaN');
  const inf = makeSnapshot();
  inf.pairs[0].score = Infinity;
  assert.strictEqual(snap.validateSnapshot(inf), false, 'Infinity');
  assert.strictEqual(snap.validateSnapshot(null), false);
  assert.strictEqual(snap.validateSnapshot([]), false);
  const rank0 = makeSnapshot();
  rank0.pairs[0].rank = 0;
  assert.strictEqual(snap.validateSnapshot(rank0), false, 'rank 0');
  const scopeBad = makeSnapshot({ scope: 'room', scope_id: 's_0a1b2c3d' });
  assert.strictEqual(snap.validateSnapshot(scopeBad), false, 'room scope with subset id');
  const subsetRoom = makeSnapshot({ scope: 'subset', scope_id: 'room' });
  assert.strictEqual(snap.validateSnapshot(subsetRoom), false, 'subset scope with room id');
  assert.strictEqual(snap.validateSnapshot(makeSnapshot({ scope: 'subset', scope_id: 's_0a1b2c3d' })), true);
  assert.strictEqual(snap.validateSnapshot(makeSnapshot({ encoder_kind: 'other' })), false, 'encoder kind');
  assert.strictEqual(snap.validateSnapshot(makeSnapshot({ ran_at: 'yesterday' })), false, 'ran_at');
  const badProv = makeSnapshot();
  badProv.provenance = { nested: { a: 1 } };
  assert.strictEqual(snap.validateSnapshot(badProv), false, 'nested provenance');
  const badProvKey = makeSnapshot();
  badProvKey.provenance = { 'Bad Key': 1 };
  assert.strictEqual(snap.validateSnapshot(badProvKey), false, 'provenance key');
  const tailExtra = makeSnapshot();
  tailExtra.tail.extra = 1;
  assert.strictEqual(snap.validateSnapshot(tailExtra), false, 'tail extra key');
  const pairExtra = makeSnapshot();
  pairExtra.pairs[0].title = 'x';
  assert.strictEqual(snap.validateSnapshot(pairExtra), false, 'pair extra key');
});

ok('S3 saveRun writes latest, then rotates the first run into previous', function (mk) {
  const room = mk();
  const first = makeSnapshot();
  const r1 = snap.saveRun(room, 'room', first);
  assert.deepStrictEqual({ ok: r1.ok, rotated: r1.rotated }, { ok: true, rotated: false });
  const dir = snap.scopeDir(room, 'room');
  const firstBytes = fs.readFileSync(path.join(dir, 'latest.json'));
  assert.ok(!fs.existsSync(path.join(dir, 'previous.json')));
  const second = makeSnapshot({ ran_at: '2026-10-29T10:00:00.000Z' });
  const r2 = snap.saveRun(room, 'room', second);
  assert.deepStrictEqual({ ok: r2.ok, rotated: r2.rotated }, { ok: true, rotated: true });
  assert.ok(fs.readFileSync(path.join(dir, 'previous.json')).equals(firstBytes), 'previous holds first run byte for byte');
  assert.deepStrictEqual(snap.readLatest(room, 'room'), second);
  assert.deepStrictEqual(snap.readPrevious(room, 'room'), first);
});

ok('S4 saveRun with an invalid snapshot writes nothing', function (mk) {
  const room = mk();
  const before = listing(room);
  const r = snap.saveRun(room, 'room', makeSnapshot({ extra: 1 }));
  assert.strictEqual(r.ok, false);
  assert.deepStrictEqual(listing(room), before);
  const r2 = snap.saveRun(room, '../evil', makeSnapshot());
  assert.strictEqual(r2.ok, false);
  const r3 = snap.saveRun(room, 'opportunity-bank', makeSnapshot());
  assert.strictEqual(r3.ok, false, 'scope arg disagrees with snapshot scope_id');
  assert.deepStrictEqual(listing(room), before);
  assert.strictEqual(snap.saveRun('', 'room', makeSnapshot()).ok, false);
  assert.strictEqual(snap.saveRun(null, 'room', makeSnapshot()).ok, false);
});

ok('S5 no temp file remains after saveRun', function (mk) {
  const room = mk();
  snap.saveRun(room, 'room', makeSnapshot());
  snap.saveRun(room, 'room', makeSnapshot({ ran_at: '2026-10-29T10:00:00.000Z' }));
  snap.saveRun(room, 'room', makeSnapshot({ ran_at: '2026-10-30T10:00:00.000Z' }));
  const left = listing(room).filter(function (f) { return /\.tmp/.test(f); });
  assert.deepStrictEqual(left, []);
});

ok('S6 readLatest and readPrevious return null for missing, non-JSON and invalid files', function (mk) {
  const room = mk();
  assert.strictEqual(snap.readLatest(room, 'room'), null);
  assert.strictEqual(snap.readPrevious(room, 'room'), null);
  const dir = snap.scopeDir(room, 'room');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'latest.json'), 'not json {');
  fs.writeFileSync(path.join(dir, 'previous.json'), JSON.stringify(makeSnapshot({ extra: 1 })));
  assert.strictEqual(snap.readLatest(room, 'room'), null);
  assert.strictEqual(snap.readPrevious(room, 'room'), null);
  assert.strictEqual(snap.readLatest(room, '../x'), null);
});

ok('S7 movement is stored per scope and never crosses scopes', function (mk) {
  if (!HAS_MOVEMENT_MODULE) {
    console.log('    (S7 body skipped: portfolio-movement.cjs not built yet, plan task 2 removes this guard)');
    return;
  }
  const room = mk();
  const store = path.join(room, '.mindrian', 'eureka-portfolio');
  const envRoom = movementEnvelope('room', 'pm_0123456789ab', '2026-10-28T10:00:00.000Z');
  const envSub = movementEnvelope('s_0a1b2c3d', 'pm_ba9876543210', '2026-10-28T11:00:00.000Z');
  assert.strictEqual(snap.writeMovement(room, envRoom).ok, true);
  assert.strictEqual(snap.writeMovement(room, envSub).ok, true);
  assert.deepStrictEqual(snap.readMovement(room, 'room'), envRoom);
  assert.deepStrictEqual(snap.readMovement(room, 's_0a1b2c3d'), envSub);
  assert.ok(fs.existsSync(path.join(store, 'movement-room.json')));
  assert.ok(fs.existsSync(path.join(store, 'movement-s_0a1b2c3d.json')));
  const roomBytes = fs.readFileSync(path.join(store, 'movement-room.json'));
  // clear and rewrite for the subset leave the room file intact
  const envSub2 = movementEnvelope('s_0a1b2c3d', 'pm_111111111111', '2026-10-28T12:00:00.000Z');
  assert.strictEqual(snap.writeMovement(room, envSub2).ok, true);
  assert.ok(fs.readFileSync(path.join(store, 'movement-room.json')).equals(roomBytes), 'write leaves other scope intact');
  assert.strictEqual(snap.clearMovement(room, 's_0a1b2c3d').ok, true);
  assert.ok(!fs.existsSync(path.join(store, 'movement-s_0a1b2c3d.json')));
  assert.ok(fs.readFileSync(path.join(store, 'movement-room.json')).equals(roomBytes), 'clear leaves other scope intact');
  // clear of an absent file does not throw
  assert.doesNotThrow(function () { snap.clearMovement(room, 's_0a1b2c3d'); });
  assert.doesNotThrow(function () { snap.clearMovement(room, 'not a scope'); });
  assert.ok(fs.existsSync(path.join(store, 'movement-room.json')));
  // an invalid envelope writes nothing
  const before = listing(room);
  const bad = Object.assign({}, envRoom, { title: 'leak' });
  assert.strictEqual(snap.writeMovement(room, bad).ok, false);
  assert.deepStrictEqual(listing(room), before);
  assert.strictEqual(snap.writeMovement(room, null).ok, false);
  // listMovements: newest first, skips invalid, a corrupt third scope does not hide the others
  assert.strictEqual(snap.writeMovement(room, envSub).ok, true);
  fs.writeFileSync(path.join(store, 'movement-s_deadbeef.json'), 'corrupt {');
  fs.writeFileSync(path.join(store, 'movement-notascope.json'), JSON.stringify(envRoom));
  const listed = snap.listMovements(room);
  assert.deepStrictEqual(listed.map(function (e) { return e.movement_id; }), ['pm_ba9876543210', 'pm_0123456789ab']);
  // cap at 8
  for (let i = 0; i < 12; i += 1) {
    const hex = ('00000000' + i.toString(16)).slice(-8);
    const sid = 's_' + hex;
    const e = movementEnvelope(sid, 'pm_' + ('000000000000' + i.toString(16)).slice(-12), '2026-11-01T00:' + String(10 + i) + ':00.000Z');
    assert.strictEqual(snap.writeMovement(room, e).ok, true);
  }
  assert.ok(snap.listMovements(room).length <= 8);
  assert.strictEqual(snap.readMovement(room, '../x'), null);
});

ok('S8 the seen list is a set capped at 64 and fails closed when corrupt', function (mk) {
  const room = mk();
  const a = 'pm_0123456789ab';
  const b = 'pm_ba9876543210';
  const c = 'pm_aaaaaaaaaaaa';
  assert.strictEqual(snap.isSeen(room, a), false, 'absent file: nothing seen');
  assert.strictEqual(snap.markSeen(room, a).ok, true);
  assert.strictEqual(snap.markSeen(room, b).ok, true);
  assert.strictEqual(snap.isSeen(room, a), true);
  assert.strictEqual(snap.isSeen(room, b), true);
  assert.strictEqual(snap.isSeen(room, c), false);
  assert.strictEqual(snap.markSeen(room, 'not-an-id').ok, false);
  assert.strictEqual(snap.markSeen(room, '../x').ok, false);
  assert.strictEqual(snap.isSeen(room, 'not-an-id'), true, 'invalid id fails closed (never offered)');
  // cap at 64 newest
  for (let i = 0; i < 70; i += 1) {
    snap.markSeen(room, 'pm_' + ('000000000000' + i.toString(16)).slice(-12));
  }
  const seenPath = path.join(room, '.mindrian', 'eureka-portfolio', snap.SEEN_FILE);
  const doc = JSON.parse(fs.readFileSync(seenPath, 'utf8'));
  assert.strictEqual(doc.seen.length, 64);
  assert.strictEqual(doc.schema_version, 1);
  assert.strictEqual(snap.isSeen(room, 'pm_' + ('000000000000' + (69).toString(16)).slice(-12)), true, 'newest kept');
  assert.strictEqual(snap.isSeen(room, a), false, 'oldest dropped');
  // corrupt file: seen for every id
  fs.writeFileSync(seenPath, 'garbage {');
  assert.strictEqual(snap.isSeen(room, c), true);
  assert.strictEqual(snap.isSeen(room, a), true);
  // schema-wrong file also reads as corrupt
  fs.writeFileSync(seenPath, JSON.stringify({ schema_version: 1, seen: [a], extra: 1 }));
  assert.strictEqual(snap.isSeen(room, c), true);
  // marking again repairs the file and keeps the new id
  assert.strictEqual(snap.markSeen(room, c).ok, true);
  assert.strictEqual(snap.isSeen(room, c), true);
  assert.strictEqual(snap.isSeen(room, b), false);
  assert.ok(!listing(room).some(function (f) { return /\.tmp/.test(f); }));
});

ok('S9 the module has no network require and writes only under the store folder', function () {
  const src = fs.readFileSync(SNAP_PATH, 'utf8');
  const reqs = (src.match(/require\(\s*['"][^'"]+['"]\s*\)/g) || []);
  reqs.forEach(function (r) {
    const m = /['"]([^'"]+)['"]/.exec(r)[1];
    assert.ok(!/^(node:)?(http|https|http2|net|tls|dgram|dns)$/.test(m), 'forbidden require ' + m);
  });
  assert.ok(!/\bfetch\s*\(/.test(src), 'no fetch call');
  assert.ok(!/—|–/.test(src), 'no em-dash or en-dash');
  assert.ok(/renameSync/.test(src));
  assert.strictEqual(snap.STORE_DIRNAME, 'eureka-portfolio');
});

ok('S10 scopeId is stable, opaque and matches SCOPE_ID_RE', function () {
  assert.strictEqual(snap.scopeId('room'), 'room');
  const id = snap.scopeId('opportunity-bank');
  const want = 's_' + crypto.createHash('sha256').update('opportunity-bank').digest('hex').slice(0, 8);
  assert.strictEqual(id, want);
  assert.strictEqual(snap.scopeId('opportunity-bank'), id);
  assert.ok(snap.SCOPE_ID_RE.test(id));
  assert.ok(snap.SCOPE_ID_RE.test('room'));
  assert.ok(!snap.SCOPE_ID_RE.test('s_0A1B2C3D'));
  assert.ok(!snap.SCOPE_ID_RE.test('s_0a1b2c3'));
  assert.ok(!snap.SCOPE_ID_RE.test('xroom'));
  assert.strictEqual(snap.scopeId('../x'), null);
  assert.strictEqual(snap.scopeId(''), null);
  assert.ok(id.indexOf('opportunity') === -1 && id.indexOf('bank') === -1);
  assert.strictEqual(snap.MOVEMENT_PREFIX, 'movement-');
  assert.strictEqual(snap.MOVEMENT_SUFFIX, '.json');
  assert.strictEqual(snap.SEEN_FILE, 'movement-seen.json');
  assert.strictEqual(snap.MAX_SEEN, 64);
  assert.strictEqual(snap.MAX_MOVEMENT_FILES, 8);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
