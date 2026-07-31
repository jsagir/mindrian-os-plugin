#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 245-02 Task 3 -- the negative case: no trigger, no derive
 * ===============================================================
 * Requirement R2's negative half as amended by D-11. A turn whose section has
 *   - a governing_thought_hash MATCHING its triple,
 *   - an age WITHIN BRAIN_STALE_AGE_DAYS,
 *   - a current brain_graph_version,
 *   - and no explicit ask
 * must dispatch NO derivation at all.
 *
 * The assertion is deliberately stronger than "no Brain call was made". A
 * silent no-op and a correct no-op look identical from the Brain's side. What
 * is asserted here is that NOTHING IS DISPATCHED: computeBrainStaleness returns
 * fresh / none, so nothing enqueues; the queue therefore stays empty; and the
 * SHIPPED drain script, run cold against that room, reports zero dispatches and
 * spawns zero children.
 *
 * Hermetic (MEM-03 fence): every room is an fs.mkdtempSync under os.tmpdir(),
 * asserted per room. MINDRIAN_BRAIN_URL points at a dead loopback port so even
 * the online branch (which reaches schema()) cannot leave the machine.
 *
 * Pure CJS, node built-ins only, zero npm deps.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

// Belt and braces, BEFORE any lib require: brain-client captures its endpoint
// at module-load time, so the redirect has to land before the module graph
// loads. A dead loopback port means an unstubbed call fails instantly against
// localhost instead of reaching the real Brain.
process.env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:1';
process.env.MINDRIAN_BRAIN_TIMEOUT_MS = '200';

const REPO = path.resolve(__dirname, '..');
const DRAIN_SCRIPT = path.join(REPO, 'scripts', 'brain-derivation-drain.cjs');
const Q = require(path.join(REPO, 'lib', 'core', 'brain-derivation-queue.cjs'));
const staleness = require(path.join(REPO, 'lib', 'core', 'brain-md-staleness.cjs'));
const folderMemory = require(path.join(REPO, 'lib', 'core', 'folder-memory.cjs'));

const TMP_REAL = fs.realpathSync(os.tmpdir());

let passed = 0;
let failed = 0;
const tmpRooms = [];

function ok(name) {
  passed += 1;
  process.stdout.write('  ok  ' + name + '\n');
}

function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

async function t(name, fn) {
  try {
    await fn();
    ok(name);
  } catch (e) {
    fail(name, e);
  }
}

function sha256OfString(s) {
  return 'sha256:' + crypto.createHash('sha256')
    .update(String(s == null ? '' : s).normalize('NFC'))
    .digest('hex');
}

// The brain_graph_version axis is the one precedence step that consults the
// Brain (schema()). Asserting "the version is current" therefore needs a
// STUBBED schema, not a live one: this machine carries a real key in
// ~/.mindrian.env, so an unstubbed run would make a genuine network call and
// the fixture's version would drift the moment the live graph advanced. The
// stub is installed into require.cache before brain-md-staleness lazily
// requires the client, mirroring the installMocks idiom in
// lib/memory/brain-derivation-queue.test.cjs. Zero network, deterministic.
const BRAIN_GRAPH_VERSION_STUB = 7;

function stubBrainClient() {
  const resolved = require.resolve(path.join(REPO, 'lib', 'core', 'brain-client.cjs'));
  const stub = {
    isAvailable: function () { return true; },
    schema: async function () { return { brain_graph_version: BRAIN_GRAPH_VERSION_STUB }; },
  };
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: stub,
  };
  return resolved;
}

function makeRoom(prefix) {
  const room = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-245-' + prefix + '-'));
  const real = fs.realpathSync(room);
  assert.ok(real === TMP_REAL || real.startsWith(TMP_REAL + path.sep),
    'HERMETIC FENCE BREACH: room ' + real + ' is outside ' + TMP_REAL);
  tmpRooms.push(room);
  fs.writeFileSync(path.join(room, '.room-root'), '');
  return room;
}

// A section that is FRESH on every axis the staleness precedence checks.
function makeFreshSection(room, section, gt) {
  const sp = path.join(room, section);
  fs.mkdirSync(sp, { recursive: true });
  fs.writeFileSync(path.join(sp, 'ROOM.md'), '# ' + section + '\n');
  fs.writeFileSync(
    path.join(sp, 'MINTO.md'),
    '---\ngoverning_thought: ' + gt + '\n---\n# Reasoning\n'
  );
  // Generated 1 hour ago: comfortably within any BRAIN_STALE_AGE_DAYS >= 1.
  const generatedAt = new Date(Date.now() - 60 * 60 * 1000)
    .toISOString().replace(/\.\d{3}Z$/, 'Z');
  fs.writeFileSync(path.join(sp, 'BRAIN.md'), [
    '---',
    'brain_generated_at: "' + generatedAt + '"',
    'brain_graph_version: ' + BRAIN_GRAPH_VERSION_STUB,
    'governing_thought_hash: "' + sha256OfString(gt) + '"',
    '---',
    '',
    '# Brain derivation',
    '',
  ].join('\n'));
  return sp;
}

async function main() {
  process.stdout.write('\nPhase 245-02: the negative case dispatches NOTHING\n\n');

  const GT = 'The serviceable market gates the venture.';
  const envSaved = {
    MINDRIAN_BRAIN_KEY: process.env.MINDRIAN_BRAIN_KEY,
    MINDRIAN_BRAIN_URL: process.env.MINDRIAN_BRAIN_URL,
    MINDRIAN_BRAIN_TIMEOUT_MS: process.env.MINDRIAN_BRAIN_TIMEOUT_MS,
    BRAIN_STALE_AGE_DAYS: process.env.BRAIN_STALE_AGE_DAYS,
    MINDRIAN_ROOMS_ROOT: process.env.MINDRIAN_ROOMS_ROOT,
  };

  try {
    process.env.MINDRIAN_ROOMS_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-245-roots-'));
    tmpRooms.push(process.env.MINDRIAN_ROOMS_ROOT);
    process.env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:1';
    process.env.MINDRIAN_BRAIN_TIMEOUT_MS = '200';
    process.env.BRAIN_STALE_AGE_DAYS = '7';

    let room;

    await t('a fresh section on every axis returns staleness fresh / action none', async function () {
      stubBrainClient();
      room = makeRoom('neg');
      const sectionPath = makeFreshSection(room, 'market-analysis', GT);
      const triple = folderMemory.readTriple(sectionPath);
      const res = await staleness.computeBrainStaleness(sectionPath, triple);
      assert.equal(res.exists, true, 'BRAIN.md exists');
      assert.equal(res.brain_graph_version, BRAIN_GRAPH_VERSION_STUB,
        'the fixture must carry the CURRENT graph version, so the version axis '
        + 'is genuinely exercised rather than skipped');
      assert.equal(res.staleness, 'fresh',
        'matching hash + within-threshold age + current version is FRESH; got '
        + JSON.stringify(res));
      assert.equal(res.stale_reason, null, 'a fresh section has no stale reason');
      assert.equal(res.recommended_action, 'none',
        'a fresh section recommends NO action; got ' + JSON.stringify(res));
    });

    await t('nothing enqueues, so the queue stays empty', function () {
      assert.equal(Q.readQueue(room).entries.length, 0,
        'the negative case must leave the derivation queue empty');
    });

    await t('a drain over the empty queue DISPATCHES nothing', async function () {
      // Brain deliberately available: proving nothing dispatches is only
      // meaningful when the Brain gate would have let a dispatch through.
      const prevKey = process.env.MINDRIAN_BRAIN_KEY;
      process.env.MINDRIAN_BRAIN_KEY = 'mos-245-test-key';
      try {
        const res = await Q.drain(room, { dryRun: true, maxEntries: 5 });
        assert.ok(Array.isArray(res.dispatched), 'drain must return a dispatched array');
        assert.equal(res.dispatched.length, 0,
          'NO derive may be dispatched; got ' + JSON.stringify(res.dispatched));
        assert.equal(res.processed, 0, 'nothing processed');
        assert.equal(res.skipped, 0, 'nothing skipped');
        assert.equal(res.re_enqueued, 0, 'nothing re-enqueued');
      } finally {
        if (prevKey === undefined) delete process.env.MINDRIAN_BRAIN_KEY;
        else process.env.MINDRIAN_BRAIN_KEY = prevKey;
      }
    });

    await t('the SHIPPED drain script, run cold, spawns NO child', function () {
      const proc = spawnSync(
        process.execPath,
        [DRAIN_SCRIPT, '--room', room, '--dry-run'],
        {
          encoding: 'utf8',
          timeout: 30000,
          env: Object.assign({}, process.env, {
            MINDRIAN_BRAIN_KEY: 'mos-245-test-key',
            MINDRIAN_BRAIN_URL: 'http://127.0.0.1:1',
          }),
        }
      );
      assert.equal(proc.status, 0, 'the hook must always exit 0');
      const combined = (proc.stdout || '') + (proc.stderr || '');
      assert.ok(!/would spawn deriveSection/.test(combined),
        'the drain must report NO spawn candidate; got: ' + combined);
    });

    await t('a real (non-preview) cold drain leaves the room untouched', function () {
      const before = fs.readdirSync(path.join(room, 'market-analysis')).sort();
      const brainBefore = fs.readFileSync(path.join(room, 'market-analysis', 'BRAIN.md'), 'utf8');
      const proc = spawnSync(
        process.execPath,
        [DRAIN_SCRIPT, '--room', room],
        {
          encoding: 'utf8',
          timeout: 30000,
          env: Object.assign({}, process.env, {
            MINDRIAN_BRAIN_KEY: 'mos-245-test-key',
            MINDRIAN_BRAIN_URL: 'http://127.0.0.1:1',
          }),
        }
      );
      assert.equal(proc.status, 0, 'the hook must always exit 0');
      assert.deepEqual(fs.readdirSync(path.join(room, 'market-analysis')).sort(), before,
        'no file may appear or vanish in the section');
      assert.equal(
        fs.readFileSync(path.join(room, 'market-analysis', 'BRAIN.md'), 'utf8'),
        brainBefore,
        'BRAIN.md must not be rewritten when nothing triggered');
      assert.equal(Q.readQueue(room).entries.length, 0, 'the queue stays empty');
    });

    await t('hermetic fence: every room lives under os.tmpdir()', function () {
      const home = process.env.HOME || os.homedir();
      const live = path.join(home, 'MindrianRooms');
      for (const r of tmpRooms) {
        const real = fs.realpathSync(r);
        assert.ok(real === TMP_REAL || real.startsWith(TMP_REAL + path.sep),
          'room escaped the tmpdir fence: ' + real);
        assert.ok(real.indexOf(live) !== 0,
          'a room resolved inside the live room tree: ' + r);
      }
    });

    await t('no em-dash or en-dash in this suite', function () {
      const EM = String.fromCharCode(0x2014);
      const EN = String.fromCharCode(0x2013);
      const src = fs.readFileSync(__filename, 'utf8');
      assert.ok(src.indexOf(EM) === -1, 'em-dash found');
      assert.ok(src.indexOf(EN) === -1, 'en-dash found');
    });
  } finally {
    for (const k of Object.keys(envSaved)) {
      if (envSaved[k] === undefined) delete process.env[k];
      else process.env[k] = envSaved[k];
    }
    for (const r of tmpRooms) {
      try { fs.rmSync(r, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    }
  }

  process.stdout.write(
    '\n245-02 trigger-negative: ' + passed + ' passed, ' + failed + ' failed\n'
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(function (e) {
  process.stdout.write('FATAL: ' + (e && e.stack || e) + '\n');
  process.exit(1);
});
