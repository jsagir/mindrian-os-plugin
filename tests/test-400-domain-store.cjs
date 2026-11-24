#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 400 plan 08 Task 1 (CY-03, O-04, Part 9): the room-level store of the
 * navigator's cause and effect domain. Legs N1 to N7.
 *
 * The identity key problem.cause_effect has one writer and one reader, both in
 * lib/core/navigation/cause-effect.cjs. The caller owns the transaction. The
 * value is the navigator's gate answer only, never room text.
 *
 * Scratch rooms live under os.tmpdir() and are removed in finally.
 * Bare node script; exits non-zero on any failure. Hyphens only.
 *
 * Run: node tests/test-400-domain-store.cjs
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

let roomDbMod;
let navigation;
let ce;
try {
  roomDbMod = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
  navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
} catch (e) {
  console.log('SKIP: test-400-domain-store: node:sqlite or a required module is unavailable. ' + (e.code || e.message));
  process.exit(0);
}

function load() {
  ce = require(path.join(REPO, 'lib', 'core', 'navigation', 'cause-effect.cjs'));
}

function makeRoom() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-400-ce-store-'));
}

function rawRow(db) {
  return db.prepare('SELECT key, value, updated_at FROM identity WHERE key = ?').get('problem.cause_effect');
}

function inTx(db, fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

function stripComments(src) {
  // Drop block comments and line comments so N6 counts code lines only.
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(function (l) { return !/^\s*\/\//.test(l); })
    .map(function (l) { return l.replace(/\s\/\/.*$/, ''); })
    .join('\n');
}

function walk(dir, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(cjs|js|mjs|ts)$/.test(ent.name)) out.push(p);
  }
  return out;
}

function main() {
  // N1 fails here until the module exists (RED).
  load();

  const rooms = [];
  try {
    // N1: a write inside a transaction, then a read.
    {
      const dir = makeRoom();
      rooms.push(dir);
      const db = roomDbMod.openRoomDb(dir);
      try {
        const w = inTx(db, function () {
          return ce.writeCauseEffect(db, { domain: 'complex', gateId: 'g1', decisionNodeId: 'n1' });
        });
        assert.deepEqual(w, { ok: true, domain: 'complex' });
        const r = ce.readCauseEffect(db);
        assert.equal(r.domain, 'complex');
        assert.equal(r.source, 'navigator');
        assert.equal(r.gate_id, 'g1');
        assert.equal(r.decision_node_id, 'n1');
        assert.equal(Number.isInteger(r.updated_at), true);
        assert.deepEqual(Object.keys(r).sort(), ['decision_node_id', 'domain', 'gate_id', 'source', 'updated_at']);
        assert.equal(ce.KEY, 'problem.cause_effect');
        ok('N1 writeCauseEffect complex inside a transaction; readCauseEffect returns the 5 fields with source navigator');

        // N2: a second write replaces the first (one domain per room).
        inTx(db, function () {
          return ce.writeCauseEffect(db, { domain: 'clear', gateId: 'g2', decisionNodeId: 'n2' });
        });
        const r2 = ce.readCauseEffect(db);
        assert.equal(r2.domain, 'clear');
        assert.equal(r2.gate_id, 'g2');
        const cnt = db.prepare("SELECT COUNT(*) AS c FROM identity WHERE key = 'problem.cause_effect'").get().c;
        assert.equal(cnt, 1);
        ok('N2 a second write with clear replaces the first; one row for the key (O-04)');

        // N3: refused domains write nothing.
        const before = rawRow(db);
        for (const bad of ['Complex', 'confused', '', null, undefined, 3]) {
          const res = ce.writeCauseEffect(db, { domain: bad, gateId: 'g3', decisionNodeId: 'n3' });
          assert.deepEqual(res, { ok: false, reason: 'not_a_domain' });
        }
        assert.deepEqual(rawRow(db), before);
        ok('N3 Complex, confused, empty, null, undefined and 3 return not_a_domain and write nothing');

        // N4: null for a missing key, invalid JSON, an unknown domain, a source other than navigator.
        const now = new Date().toISOString();
        const up = db.prepare('INSERT INTO identity (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at');
        up.run('problem.cause_effect', '{not json', now);
        assert.equal(ce.readCauseEffect(db), null);
        up.run('problem.cause_effect', JSON.stringify({ domain: 'wicked', source: 'navigator', gate_id: 'g', decision_node_id: 'n', updated_at: 1 }), now);
        assert.equal(ce.readCauseEffect(db), null);
        up.run('problem.cause_effect', JSON.stringify({ domain: 'complex', source: 'weak_cynefin_rating', gate_id: 'g', decision_node_id: 'n', updated_at: 1 }), now);
        assert.equal(ce.readCauseEffect(db), null);
        up.run('problem.cause_effect', JSON.stringify({ domain: 'complex', source: 'room_text', gate_id: 'g', decision_node_id: 'n', updated_at: 1 }), now);
        assert.equal(ce.readCauseEffect(db), null);
        up.run('problem.cause_effect', JSON.stringify(['complex']), now);
        assert.equal(ce.readCauseEffect(db), null);
        db.prepare("DELETE FROM identity WHERE key = 'problem.cause_effect'").run();
        assert.equal(ce.readCauseEffect(db), null);
        assert.equal(ce.readCauseEffect(null), null);
        ok('N4 readCauseEffect is null for a missing key, invalid JSON, an unknown domain, a non-navigator source, a null db');

        // Leave a stored value for N5.
        inTx(db, function () {
          return ce.writeCauseEffect(db, { domain: 'chaotic', gateId: 'g5', decisionNodeId: 'n5' });
        });
      } finally {
        roomDbMod.closeRoomDb(db);
      }

      // N5: readCauseEffectForRoom.
      const empty = makeRoom();
      rooms.push(empty);
      const dbPath = path.join(empty, '.mindrian', 'room.db');
      assert.equal(ce.readCauseEffectForRoom(empty), null);
      assert.equal(fs.existsSync(dbPath), false);
      assert.equal(fs.existsSync(path.join(empty, '.mindrian')), false);
      assert.equal(ce.readCauseEffectForRoom(null), null);
      assert.equal(ce.readCauseEffectForRoom(path.join(empty, 'nope')), null);
      const got = ce.readCauseEffectForRoom(dir);
      assert.equal(got.domain, 'chaotic');
      assert.equal(got.gate_id, 'g5');
      // The navigation re-exports reach the same functions.
      assert.equal(typeof navigation.writeCauseEffect, 'function');
      assert.equal(typeof navigation.readCauseEffect, 'function');
      assert.equal(navigation.readCauseEffectForRoom(dir).domain, 'chaotic');
      ok('N5 readCauseEffectForRoom is null with no room.db and creates no file; returns the stored value; navigation re-exports work');
    }

    // N6: only the owner module holds the key string in a code line; packet.cjs never does.
    {
      const owner = path.join(REPO, 'lib', 'core', 'navigation', 'cause-effect.cjs');
      const files = walk(path.join(REPO, 'lib'), []);
      const holders = [];
      for (const f of files) {
        const src = fs.readFileSync(f, 'utf8');
        if (src.indexOf('problem.cause_effect') === -1) continue;
        if (stripComments(src).indexOf('problem.cause_effect') !== -1) holders.push(path.relative(REPO, f));
      }
      assert.deepEqual(holders, [path.relative(REPO, owner)]);
      const packet = fs.readFileSync(path.join(REPO, 'lib', 'core', 'navigation', 'packet.cjs'), 'utf8');
      assert.equal(packet.indexOf('problem.cause_effect'), -1);
      assert.equal(packet.indexOf('cause-effect.cjs'), -1);
      ok('N6 only lib/core/navigation/cause-effect.cjs holds problem.cause_effect in a code line; packet.cjs does not hold it');
    }

    // N7: the substrate check and the schema alias check pass.
    {
      const sub = spawnSync(process.execPath, [path.join(REPO, 'scripts', 'check-substrate.cjs')], { cwd: REPO, encoding: 'utf8' });
      assert.equal(sub.status, 0, 'check-substrate failed: ' + (sub.stdout || '') + (sub.stderr || ''));
      const ali = spawnSync(process.execPath, [path.join(REPO, 'scripts', 'check-schema-aliases.cjs'), '--file', 'lib/core/navigation/cause-effect.cjs'], { cwd: REPO, encoding: 'utf8' });
      assert.equal(ali.status, 0, 'check-schema-aliases failed: ' + (ali.stdout || '') + (ali.stderr || ''));
      const yml = fs.readFileSync(path.join(REPO, '.planning', 'phases', '108-graph-memory-schema-reconciliation', 'aliases.yml'), 'utf8');
      assert.equal((yml.match(/problem_cause_effect/g) || []).length, 1);
      ok('N7 check-substrate and check-schema-aliases --file exit 0; aliases.yml registers problem_cause_effect once');
    }
  } finally {
    for (const r of rooms) {
      try { fs.rmSync(r, { recursive: true, force: true }); } catch (_e) { /* tolerant */ }
    }
  }

  console.log('test-400-domain-store: ' + checks + ' checks passed');
}

try {
  main();
} catch (e) {
  console.error('FAIL: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
}
