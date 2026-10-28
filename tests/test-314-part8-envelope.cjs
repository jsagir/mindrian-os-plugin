#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 314-01 Task 3 -- the Part 8 fence for the stored files and the envelope.
 *
 * Room text (node labels) may live in the local snapshot labels map only. It
 * must never enter the movement envelope. This suite REUSES the Phase 196
 * classify() guard (lib/core/part8-egress-guard.cjs); it never declares a second
 * auditor. Legs EV1 to EV6. Pure CJS, node built-ins only. No network.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const { classify } = require(path.join(REPO, 'lib', 'core', 'part8-egress-guard.cjs'));
const snap = require(path.join(REPO, 'lib', 'core', 'eureka', 'portfolio-snapshot.cjs'));
const mv = require(path.join(REPO, 'lib', 'core', 'eureka', 'portfolio-movement.cjs'));

const SENTINEL = 'Our confidential pilot with the regional hospital group falls apart if the pricing lands';
// A label is capped at 80 characters, so the planted label is a sentinel cut to fit.
const LABEL_SENTINEL = SENTINEL.slice(0, 80);

let passed = 0;
let failed = 0;
function ok(name, fn) {
  const rooms = [];
  try {
    fn(function mk() {
      const d = fs.mkdtempSync(path.join(os.tmpdir(), 't314-p8-'));
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

function makeSnapshot(band, ranAt) {
  return {
    schema_version: 1,
    ran_at: ranAt || '2026-10-28T10:00:00.000Z',
    scope: 'room',
    scope_id: 'room',
    encoder_kind: 'live',
    provenance: { run_mode: 'live', encoder_model: 'e5-test' },
    pairs: [
      { a: 'n042', b: 'n317', band: band, score: 0.77, rank: 1 },
      { a: 'n100', b: 'n101', band: 'low', score: 0.1, rank: 2 }
    ],
    tail: {
      composition: 'balanced',
      insufficient_structure: false,
      suspect_noise: false,
      items: band === 'high' ? [{ id: 'n555' }] : []
    },
    labels: { n042: LABEL_SENTINEL, n317: 'Second label ' + LABEL_SENTINEL.slice(0, 40), n555: LABEL_SENTINEL }
  };
}

function movementPair() {
  const prev = makeSnapshot('moderate', '2026-10-27T10:00:00.000Z');
  const cur = makeSnapshot('high', '2026-10-28T10:00:00.000Z');
  const diff = mv.diffRuns(prev, cur, mv.loadThresholds());
  const env = mv.buildMovementEnvelope(diff, cur, new Date('2026-10-28T12:00:00Z'));
  return { prev: prev, cur: cur, diff: diff, env: env };
}

console.log('test-314-part8-envelope');

ok('EV1 a planted label round-trips in labels only', function (mk) {
  const room = mk();
  const s = makeSnapshot('high');
  assert.strictEqual(snap.saveRun(room, 'room', s).ok, true);
  const back = snap.readLatest(room, 'room');
  assert.deepStrictEqual(back, s);
  assert.strictEqual(back.labels.n042, LABEL_SENTINEL);
  // the sentinel text appears in the labels map and nowhere else in the snapshot
  const withoutLabels = JSON.stringify(Object.assign({}, back, { labels: {} }));
  assert.strictEqual(withoutLabels.indexOf(LABEL_SENTINEL.slice(0, 30)), -1);
  assert.ok(JSON.stringify(back.labels).indexOf(LABEL_SENTINEL) !== -1);
});

ok('EV2 the envelope text holds no label string', function () {
  const m = movementPair();
  assert.ok(m.env, 'a movement exists');
  const text = JSON.stringify(m.env);
  assert.strictEqual(text.indexOf(SENTINEL.slice(0, 20)), -1);
  assert.strictEqual(text.indexOf(LABEL_SENTINEL), -1);
  Object.keys(m.cur.labels).forEach(function (h) {
    assert.strictEqual(text.indexOf(m.cur.labels[h]), -1, 'label of ' + h);
  });
  // the handles and enums are there
  assert.ok(text.indexOf('n042') !== -1);
});

ok('EV3 classify() does not block the envelope', function () {
  const m = movementPair();
  const v = classify(m.env, { toolName: 'brain_ask' });
  assert.notStrictEqual(v.verdict, 'block');
});

ok('EV4 no free-text key name appears anywhere in the envelope', function () {
  const m = movementPair();
  const banned = ['title', 'label', 'text', 'name', 'summary'];
  (function walk(v) {
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (v && typeof v === 'object') {
      Object.keys(v).forEach(function (k) {
        assert.ok(banned.indexOf(k) === -1, 'banned key ' + k);
        walk(v[k]);
      });
    }
  })(m.env);
  const text = JSON.stringify(m.env);
  banned.forEach(function (k) {
    assert.strictEqual(text.indexOf('"' + k + '"'), -1, k);
  });
});

ok('EV5 a hand-edited movement file with a title key is rejected', function (mk) {
  const room = mk();
  const m = movementPair();
  assert.strictEqual(snap.writeMovement(room, m.env).ok, true);
  assert.deepStrictEqual(snap.readMovement(room, 'room'), m.env);
  const file = path.join(room, '.mindrian', 'eureka-portfolio', 'movement-room.json');
  const edited = JSON.parse(fs.readFileSync(file, 'utf8'));
  edited.title = LABEL_SENTINEL;
  fs.writeFileSync(file, JSON.stringify(edited));
  assert.strictEqual(snap.readMovement(room, 'room'), null);
  assert.deepStrictEqual(snap.listMovements(room), []);
  // a title planted inside an event is refused too
  const edited2 = JSON.parse(JSON.stringify(m.env));
  edited2.events[0].title = LABEL_SENTINEL;
  fs.writeFileSync(file, JSON.stringify(edited2));
  assert.strictEqual(snap.readMovement(room, 'room'), null);
  // writeMovement refuses to store a label-bearing envelope
  const before = fs.readdirSync(path.dirname(file)).sort();
  const poisoned = JSON.parse(JSON.stringify(m.env));
  poisoned.events[0].a_handle = LABEL_SENTINEL;
  assert.strictEqual(snap.writeMovement(room, poisoned).ok, false);
  fs.rmSync(file, { force: true });
  assert.deepStrictEqual(fs.readdirSync(path.dirname(file)).sort(), before.filter(function (n) { return n !== 'movement-room.json'; }));
});

ok('EV6 stored files sit under the room folder only and a hostile scope is refused', function (mk) {
  const room = mk();
  const outer = path.dirname(room);
  const hostile = ['../escape', '..', '/etc', 'a/../../b', '..\\x', 'room/../x'];
  hostile.forEach(function (slug) {
    assert.strictEqual(snap.scopeDir(room, slug), null, slug);
    assert.strictEqual(snap.scopeId(slug), null, slug);
    assert.strictEqual(snap.saveRun(room, slug, makeSnapshot('high')).ok, false, slug);
  });
  assert.strictEqual(snap.readMovement(room, '../../evil'), null);
  assert.strictEqual(snap.clearMovement(room, '../../evil').ok, false);
  // a valid scope writes under .mindrian/eureka-portfolio of the room and nowhere else
  const s = makeSnapshot('high');
  const sid = snap.scopeId('opportunity-bank');
  s.scope = 'subset';
  s.scope_id = sid;
  assert.strictEqual(snap.saveRun(room, 'opportunity-bank', s).ok, true);
  const dir = snap.scopeDir(room, 'opportunity-bank');
  const rel = path.relative(room, dir);
  assert.ok(!rel.startsWith('..') && !path.isAbsolute(rel));
  assert.strictEqual(rel, path.join('.mindrian', 'eureka-portfolio', 'section-opportunity-bank'));
  // nothing leaked beside the room folder
  const before = fs.readdirSync(outer).filter(function (n) { return n.indexOf('escape') !== -1 || n === 'etc'; });
  assert.deepStrictEqual(before, []);
  // the movement file name never carries the readable section name
  const m = movementPair();
  const env = JSON.parse(JSON.stringify(m.env));
  env.scope = 'subset';
  env.scope_id = sid;
  assert.strictEqual(snap.writeMovement(room, env).ok, true);
  const names = fs.readdirSync(path.join(room, '.mindrian', 'eureka-portfolio'));
  assert.ok(names.some(function (n) { return n === 'movement-' + sid + '.json'; }));
  assert.ok(!names.some(function (n) { return n.indexOf('movement-') === 0 && n.indexOf('opportunity') !== -1; }));
  assert.ok(!JSON.stringify(env).includes('opportunity-bank'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
