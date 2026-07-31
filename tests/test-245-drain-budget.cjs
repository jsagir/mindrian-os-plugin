#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 245-02 Task 2 -- the drain's budget accounting
 * ====================================================
 * Threat T-245-05 (Denial of Service: budget accounting starves the spawn
 * loop) in assertion form.
 *
 * The defect this pins: scripts/brain-derivation-drain.cjs captured
 * `start = Date.now()` BEFORE Q.drain lazily required folder-memory.cjs
 * (which pulls node:sqlite) and brain-client.cjs. On a cold hook process that
 * module load costs 96-191ms against PARENT_BUDGET_MS = 100, so the budget
 * check at the TOP of the spawn loop tripped before the first spawn. The
 * overrun is FLAKY, not deterministic (three cold runs measured 162ms, 96ms,
 * 145ms), which is why 15+ warm in-process tests never caught it. So this
 * suite runs the SHIPPED SCRIPT as a COLD SUBPROCESS, never in-process.
 *
 * The two halves of the fix, asserted below:
 *   1. Every lazily-required dependency is hoisted above the `start` capture,
 *      so PARENT_BUDGET_MS measures spawn work only.
 *   2. The budget check sits at the BOTTOM of the loop body, so the first
 *      eligible entry always gets a child, and only what actually spawned is
 *      committed (anything else survives for the next turn).
 *
 * How "spawned exactly N children" is proven: commitDispatched() is called
 * with `spawnedSections`, a list built ONLY from spawn calls that returned
 * without throwing. It is never called with result.dispatched. So the queue's
 * before/after delta IS the spawn count, exactly. A source-order assertion
 * below fences that wiring so the delta stays a valid proxy.
 *
 * Hermetic (MEM-03 fence): every room is an fs.mkdtempSync under os.tmpdir().
 * MINDRIAN_BRAIN_KEY is set so the parent's isAvailable() gate passes (a pure
 * env read, zero network), and MINDRIAN_BRAIN_URL is pointed at a dead local
 * port so a spawned child's derive attempt fails instantly against loopback
 * and never reaches the real Brain.
 *
 * Pure CJS, node built-ins only, zero npm deps.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const DRAIN_SCRIPT = path.join(REPO, 'scripts', 'brain-derivation-drain.cjs');
const DRAIN_SRC = fs.readFileSync(DRAIN_SCRIPT, 'utf8');
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

function t(name, fn) {
  try {
    fn();
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

// Run the SHIPPED script as a cold subprocess. Nothing in-process: the whole
// point of this suite is that warm timing is not representative.
function coldDrain(room, extraArgs, extraEnv) {
  const env = Object.assign({}, process.env, {
    MINDRIAN_BRAIN_KEY: 'mos-245-test-key',
    MINDRIAN_BRAIN_URL: 'http://127.0.0.1:1',
    MINDRIAN_BRAIN_TIMEOUT_MS: '200',
  }, extraEnv || {});
  return spawnSync(
    process.execPath,
    [DRAIN_SCRIPT, '--room', room].concat(extraArgs || []),
    { encoding: 'utf8', timeout: 30000, env: env }
  );
}

function main() {
  process.stdout.write('\nPhase 245-02: the drain spawns before it commits\n\n');

  const GT = 'The serviceable market gates the venture.';
  const HASH = sha256OfString(GT);

  try {
    // -----------------------------------------------------------------
    // Source-order fences (the structural half of the fix).
    // -----------------------------------------------------------------
    t('the three lazy requires are hoisted ABOVE the start capture', function () {
      const iFolder = DRAIN_SRC.indexOf("require('../lib/core/folder-memory.cjs')");
      const iBrain = DRAIN_SRC.indexOf("require('../lib/core/brain-client.cjs')");
      const iNav = DRAIN_SRC.indexOf("require('../lib/core/navigation.cjs')");
      const iStart = DRAIN_SRC.indexOf('const start = Date.now()');
      assert.ok(iFolder !== -1, 'folder-memory.cjs must be warmed explicitly');
      assert.ok(iBrain !== -1, 'brain-client.cjs must be warmed explicitly');
      assert.ok(iNav !== -1, 'navigation.cjs must be required outside the loop');
      assert.ok(iStart !== -1, 'the start capture must exist');
      assert.ok(iFolder < iStart, 'folder-memory require must precede the start capture');
      assert.ok(iBrain < iStart, 'brain-client require must precede the start capture');
      assert.ok(iNav < iStart, 'navigation require must precede the start capture');
    });

    t('the budget comparison sits AFTER the spawn call inside the loop', function () {
      const iSpawn = DRAIN_SRC.indexOf('spawn(process.execPath');
      const iBudget = DRAIN_SRC.indexOf('Date.now() - start > budgetMs');
      assert.ok(iSpawn !== -1, 'the detached spawn must exist');
      assert.ok(iBudget !== -1, 'the budget comparison must exist');
      assert.ok(iSpawn < iBudget,
        'the budget check must follow the spawn so the first entry always fires');
    });

    t('PARENT_BUDGET_MS is still 100', function () {
      assert.ok(/const PARENT_BUDGET_MS = 100;/.test(DRAIN_SRC),
        'PARENT_BUDGET_MS must remain 100 (this phase stops mis-measuring it, '
        + 'it does not relitigate the value)');
    });

    t('commitDispatched is fed spawnedSections, never result.dispatched', function () {
      assert.ok(/Q\.commitDispatched\(roomDir, spawnedSections\)/.test(DRAIN_SRC),
        'the commit must be driven by successful spawns only');
      assert.ok(!/commitDispatched\([^)]*result\.dispatched/.test(DRAIN_SRC),
        'commitDispatched must never be handed result.dispatched directly');
      assert.ok(/if \(spawned\) spawnedSections\.push\(item\.section\)/.test(DRAIN_SRC),
        'a section may only join spawnedSections when its spawn did not throw');
    });

    t('no awaited Brain call is introduced in the parent turn path', function () {
      const iRun = DRAIN_SRC.indexOf('async function runDrain');
      const iEnd = DRAIN_SRC.indexOf('// Entry point');
      const body = DRAIN_SRC.slice(iRun, iEnd === -1 ? DRAIN_SRC.length : iEnd);
      const awaits = body.match(/await\s+[A-Za-z_$][\w$.]*/g) || [];
      // The ONLY await in runDrain is the local Q.drain read. deriveSection
      // (the actual Brain call) stays inside the detached --single child.
      assert.deepEqual(awaits, ['await Q.drain'],
        'runDrain must await nothing but the local queue read; got '
        + JSON.stringify(awaits));
      assert.ok(!/deriveSection\(/.test(body),
        'runDrain must never call deriveSection itself (Canon Part 8: the '
        + 'Brain call belongs to the detached child)');
    });

    t('no em-dash or en-dash in the drain script', function () {
      const EM = String.fromCharCode(0x2014);
      const EN = String.fromCharCode(0x2013);
      assert.ok(DRAIN_SRC.indexOf(EM) === -1, 'em-dash found in brain-derivation-drain.cjs');
      assert.ok(DRAIN_SRC.indexOf(EN) === -1, 'en-dash found in brain-derivation-drain.cjs');
    });

    // -----------------------------------------------------------------
    // Behavior: a cold process spawns at least one child.
    // -----------------------------------------------------------------
    t('a COLD drain with 1 eligible entry spawns 1 child and empties the queue', function () {
      const room = makeRoom('cold1', ['alpha-section'], GT);
      Q.enqueue(room, 'alpha-section', null, HASH, 'governing_thought_changed');
      assert.equal(Q.readQueue(room).entries.length, 1, 'fixture must start with 1 entry');

      const proc = coldDrain(room, []);
      assert.equal(proc.status, 0,
        'the hook must always exit 0; stderr=' + (proc.stderr || ''));

      const after = Q.readQueue(room).entries.length;
      assert.equal(after, 0,
        'the eligible entry must be spawned and committed on a COLD process; '
        + '1 remaining means the budget tripped before the first spawn again. '
        + 'stderr=' + (proc.stderr || ''));
    });

    // -----------------------------------------------------------------
    // Behavior: budget forced to 0 degrades gracefully, never to zero.
    // -----------------------------------------------------------------
    t('budget forced to 0 over 3 entries spawns exactly 1 and keeps the other 2', function () {
      const room = makeRoom('budget0', ['alpha-section', 'beta-section', 'gamma-section'], GT);
      for (const s of ['alpha-section', 'beta-section', 'gamma-section']) {
        Q.enqueue(room, s, null, HASH, 'governing_thought_changed');
      }
      assert.equal(Q.readQueue(room).entries.length, 3, 'fixture must start with 3 entries');

      const proc = coldDrain(room, [], { MOS_DRAIN_PARENT_BUDGET_MS: '0' });
      assert.equal(proc.status, 0,
        'the hook must always exit 0; stderr=' + (proc.stderr || ''));

      const left = Q.readQueue(room).entries.length;
      assert.equal(left, 2,
        'with a zero budget exactly ONE child must fire and the other TWO must '
        + 'survive for the next turn. 0 remaining is the old silent-total-loss '
        + 'bug; 3 remaining means no child fired at all. stderr='
        + (proc.stderr || ''));
    });

    // -----------------------------------------------------------------
    // Behavior: the operator preview flag commits nothing.
    // -----------------------------------------------------------------
    t('operator --dry-run previews without spawning and without committing', function () {
      const room = makeRoom('preview', ['alpha-section', 'beta-section'], GT);
      for (const s of ['alpha-section', 'beta-section']) {
        Q.enqueue(room, s, null, HASH, 'governing_thought_changed');
      }
      const proc = coldDrain(room, ['--dry-run']);
      assert.equal(proc.status, 0, 'the hook must always exit 0');
      const combined = (proc.stdout || '') + (proc.stderr || '');
      assert.ok(/would spawn deriveSection for section=alpha-section/.test(combined),
        'the preview must name what it would spawn; got: ' + combined);
      assert.equal(Q.readQueue(room).entries.length, 2,
        'an operator preview must leave the queue untouched');
    });

    // -----------------------------------------------------------------
    // Behavior: Brain offline keeps everything queued (unchanged contract).
    // -----------------------------------------------------------------
    t('Brain offline keeps every entry queued (re-enqueue path unchanged)', function () {
      const room = makeRoom('offline', ['alpha-section'], GT);
      Q.enqueue(room, 'alpha-section', null, HASH, 'governing_thought_changed');
      const proc = spawnSync(
        process.execPath,
        [DRAIN_SCRIPT, '--room', room],
        {
          encoding: 'utf8',
          timeout: 30000,
          // No MINDRIAN_BRAIN_KEY: isAvailable() is false, so drain re-enqueues.
          env: Object.assign({}, process.env, {
            MINDRIAN_BRAIN_KEY: '',
            MINDRIAN_BRAIN_URL: 'http://127.0.0.1:1',
            HOME: path.join(room, '.no-home'),
          }),
        }
      );
      assert.equal(proc.status, 0, 'the hook must always exit 0');
      assert.equal(Q.readQueue(room).entries.length, 1,
        'a Brain-offline drain must keep the entry queued');
    });
  } finally {
    for (const r of tmpRooms) {
      try { fs.rmSync(r, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    }
  }

  process.stdout.write(
    '\n245-02 drain-budget: ' + passed + ' passed, ' + failed + ' failed\n'
  );
  process.exit(failed === 0 ? 0 : 1);
}

main();
