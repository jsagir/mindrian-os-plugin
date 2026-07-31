#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 245-02 Task 1 -- the queue cannot be silently vacuumed
 * ============================================================
 * Threat T-245-06 (Repudiation: silent queue loss) in assertion form.
 *
 * The defect this pins: scripts/brain-derivation-drain.cjs calls
 * Q.drain(roomDir, {dryRun:true}) because it does the spawning itself. Until
 * this phase, that dry run REWROTE the queue file, deleting every entry it
 * had merely PREVIEWED. When the caller's PARENT_BUDGET_MS tripped before the
 * first spawn (which it did on cold hook processes: 162ms / 96ms / 145ms
 * measured against a 100ms budget), the whole queue vanished and nothing was
 * ever derived. Every turn since v1.16.0-beta.1 silently vacuumed the queue.
 *
 * The new contract, asserted below:
 *   1. dryRun:true performs ZERO queue writes (byte-compare the file).
 *   2. commitDispatched(roomDir, sections) removes exactly the named sections.
 *   3. commitDispatched is idempotent and write-free on a second call.
 *   4. commitDispatched never throws on garbage input and never writes.
 *   5. dryRun:false still commits exactly as it did before (no behavior
 *      change to the committing path).
 *
 * Hermetic (MEM-03 fence): every room is an fs.mkdtempSync under os.tmpdir().
 * Nothing is ever written under ~/MindrianRooms.
 *
 * Pure CJS, node built-ins only, zero npm deps.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const REPO = path.resolve(__dirname, '..');
const Q = require(path.join(REPO, 'lib', 'core', 'brain-derivation-queue.cjs'));

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

// Mirror brain-derivation-queue.sha256OfString so a fixture's queued hash
// matches the drain's recomputed current-governing-thought hash exactly.
function sha256OfString(s) {
  return 'sha256:' + crypto.createHash('sha256')
    .update(String(s == null ? '' : s).normalize('NFC'))
    .digest('hex');
}

// Build a hermetic room with N sections, each carrying a MINTO.md whose
// governing_thought hashes to the value we enqueue, so drain sees them as
// eligible rather than stale.
function makeRoom(prefix, sections, govThought) {
  const room = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-245-' + prefix + '-'));
  tmpRooms.push(room);
  for (const s of sections) {
    const sp = path.join(room, s);
    fs.mkdirSync(sp, { recursive: true });
    fs.writeFileSync(
      path.join(sp, 'MINTO.md'),
      '---\ngoverning_thought: ' + govThought + '\n---\n# Reasoning\n'
    );
    fs.writeFileSync(path.join(sp, 'ROOM.md'), '# ' + s + '\n');
  }
  return room;
}

function queueFilePath(room) {
  return path.join(room, '.mindrian', 'brain-derivation-queue.json');
}

function queueBytes(room) {
  return fs.readFileSync(queueFilePath(room));
}

async function main() {
  process.stdout.write('\nPhase 245-02: drain must never silently vacuum the queue\n\n');

  const GT = 'The serviceable market gates the venture.';
  const HASH = sha256OfString(GT);
  const SECTIONS = ['alpha-section', 'beta-section', 'gamma-section'];

  const prevKey = process.env.MINDRIAN_BRAIN_KEY;
  // isAvailable() is `!!getApiKey()` -- a pure env read, zero network. Setting
  // it makes the drain treat Brain as reachable so entries DISPATCH rather
  // than re-enqueue, which is the path under test.
  process.env.MINDRIAN_BRAIN_KEY = 'mos-245-test-key';

  try {
    // -----------------------------------------------------------------
    // 1. dryRun is strictly read-only.
    // -----------------------------------------------------------------
    const roomA = makeRoom('dry', SECTIONS, GT);
    for (const s of SECTIONS) {
      Q.enqueue(roomA, s, null, HASH, 'governing_thought_changed');
    }

    await t('dryRun drain previews >= 1 entry AND writes nothing to disk', async function () {
      assert.equal(Q.readQueue(roomA).entries.length, 3, 'fixture must start with 3 entries');
      const before = queueBytes(roomA);
      const res = await Q.drain(roomA, { dryRun: true, maxEntries: 5 });
      assert.ok(Array.isArray(res.dispatched), 'drain must return a dispatched array');
      assert.ok(res.dispatched.length >= 1,
        'dry run must PREVIEW at least one dispatch; got ' + JSON.stringify(res));
      const after = queueBytes(roomA);
      assert.ok(before.equals(after),
        'dry run must perform ZERO queue writes (queue file changed on disk)');
      assert.equal(Q.readQueue(roomA).entries.length, 3,
        'all 3 entries must survive a dry run');
    });

    // -----------------------------------------------------------------
    // 2 + 3. commitDispatched: exact, then idempotent and write-free.
    // -----------------------------------------------------------------
    await t('commitDispatched removes exactly the named section', function () {
      const r = Q.commitDispatched(roomA, ['alpha-section']);
      assert.deepEqual(r, { removed: 1, remaining: 2 },
        'expected {removed:1, remaining:2}; got ' + JSON.stringify(r));
      const left = Q.readQueue(roomA).entries.map(function (e) { return e.section; }).sort();
      assert.deepEqual(left, ['beta-section', 'gamma-section'],
        'only alpha-section may be removed');
    });

    await t('commitDispatched is idempotent and performs no second write', function () {
      const before = queueBytes(roomA);
      const r = Q.commitDispatched(roomA, ['alpha-section']);
      assert.deepEqual(r, { removed: 0, remaining: 2 },
        'a second commit of the same section must report removed:0');
      const after = queueBytes(roomA);
      assert.ok(before.equals(after), 'a no-match commit must not rewrite the queue file');
    });

    // -----------------------------------------------------------------
    // 4. Defensive: garbage in, no throw, no write.
    // -----------------------------------------------------------------
    await t('commitDispatched never throws and never writes on garbage input', function () {
      const before = queueBytes(roomA);
      const cases = [
        [null, ['x']],
        [undefined, ['x']],
        [roomA, []],
        [roomA, 'notanarray'],
        [roomA, null],
        [roomA, [null, 42, '']],
      ];
      for (const [rd, secs] of cases) {
        const r = Q.commitDispatched(rd, secs);
        assert.ok(r && typeof r.removed === 'number' && typeof r.remaining === 'number',
          'commitDispatched must always return a {removed, remaining} shape');
        assert.equal(r.removed, 0,
          'garbage input must remove nothing: ' + JSON.stringify([rd, secs]));
      }
      const after = queueBytes(roomA);
      assert.ok(before.equals(after), 'no garbage-input call may rewrite the queue file');
    });

    // -----------------------------------------------------------------
    // 5. The committing path is unchanged.
    // -----------------------------------------------------------------
    await t('dryRun:false still commits dispatched entries (committing path unchanged)', async function () {
      const roomB = makeRoom('wet', SECTIONS, GT);
      for (const s of SECTIONS) {
        Q.enqueue(roomB, s, null, HASH, 'governing_thought_changed');
      }
      const res = await Q.drain(roomB, { dryRun: false, maxEntries: 5 });
      assert.equal(res.processed, 3, 'expected 3 processed; got ' + JSON.stringify(res));
      assert.equal(Q.readQueue(roomB).entries.length, 0,
        'a real (non-dryRun) drain still removes what it dispatched');
    });

    await t('a stale-hash entry survives a dry run but is dropped by a real drain', async function () {
      const roomC = makeRoom('stale', ['alpha-section'], GT);
      // Queue a hash that does NOT match the on-disk governing thought.
      Q.enqueue(roomC, 'alpha-section', null, sha256OfString('SOMETHING-ELSE'),
        'governing_thought_changed');

      const before = queueBytes(roomC);
      const dry = await Q.drain(roomC, { dryRun: true, maxEntries: 5 });
      assert.equal(dry.skipped, 1, 'dry run must REPORT the stale entry as skipped');
      assert.ok(before.equals(queueBytes(roomC)),
        'dry run must not drop the stale entry from disk');

      const wet = await Q.drain(roomC, { dryRun: false, maxEntries: 5 });
      assert.equal(wet.skipped, 1, 'real drain must skip the stale entry');
      assert.equal(Q.readQueue(roomC).entries.length, 0,
        'real drain still drops the stale entry (stale-queue-race guard unchanged)');
    });

    // -----------------------------------------------------------------
    // Export-surface fence.
    // -----------------------------------------------------------------
    await t('commitDispatched is exported', function () {
      assert.equal(typeof Q.commitDispatched, 'function',
        'brain-derivation-queue must export commitDispatched');
    });

    // -----------------------------------------------------------------
    // No em-dashes (repo hard rule).
    // -----------------------------------------------------------------
    await t('no em-dash or en-dash in the touched sources', function () {
      const files = [
        path.join(REPO, 'lib', 'core', 'brain-derivation-queue.cjs'),
        path.join(REPO, 'scripts', 'brain-derivation-drain.cjs'),
        __filename,
      ];
      // Escape sequences, not literals, so this fence does not trip on itself.
      const EM = String.fromCharCode(0x2014);
      const EN = String.fromCharCode(0x2013);
      for (const f of files) {
        const src = fs.readFileSync(f, 'utf8');
        assert.ok(src.indexOf(EM) === -1, 'em-dash found in ' + path.basename(f));
        assert.ok(src.indexOf(EN) === -1, 'en-dash found in ' + path.basename(f));
      }
    });
  } finally {
    if (prevKey === undefined) delete process.env.MINDRIAN_BRAIN_KEY;
    else process.env.MINDRIAN_BRAIN_KEY = prevKey;
    for (const r of tmpRooms) {
      try { fs.rmSync(r, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    }
  }

  process.stdout.write(
    '\n245-02 no-silent-loss: ' + passed + ' passed, ' + failed + ' failed\n'
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(function (e) {
  process.stdout.write('FATAL: ' + (e && e.stack || e) + '\n');
  process.exit(1);
});
