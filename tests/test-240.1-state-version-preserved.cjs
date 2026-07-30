#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 240.1 Plan 02 Task 1 -- the CTXL-01 empirical repro from
 * 240.1-RESEARCH.md Finding 1B, turned into a standing test.
 *
 * WHAT THIS MEASURES VERSUS ASSUMES. Every scenario seeds a REAL scratch room
 * with the byte-identical STATE.md block scripts/room-registry:127-131 writes,
 * then runs the REAL computeState(roomDir) from lib/core/state-ops.cjs (not a
 * mock, not a re-derivation) and re-reads the resulting STATE.md off disk.
 * Nothing here asserts a return value in isolation; every assertion reads the
 * file that a real caller would read next.
 *
 * MUTATION THAT TURNS THIS RED. Restoring the blind
 *   fs.writeFileSync(path.join(resolved, 'STATE.md'), result)
 * at lib/core/state-ops.cjs:44, with no preceding version read, turns
 * scenarios 1 through 4 red: gsd_state_version and status are destroyed by
 * the very next real regeneration.
 *
 * NOTE ON WHAT DOES *NOT* TURN THIS RED (Pitfall 2, 240.1-RESEARCH.md
 * Finding 1C). This file only drives computeState() at lib/core/state-ops.cjs.
 * The census in Finding 1C found FIVE other write sites
 * (lib/core/intelligence-cascade.cjs:492-498, scripts/on-stop:144-145,
 * scripts/on-task-complete:51-55, scripts/on-agent-complete:133,
 * lib/core/navigation/room-birth.cjs:986-990) that bypass computeState()
 * entirely. A green run of this file proves write site 1 is fixed; it proves
 * NOTHING about the other five. That is exactly why
 * tests/test-240.1-hook-write-site.sh exists in plan 240.1-03 -- do not read
 * a green run of this file as "the drift is closed everywhere."
 *
 * Hermeticity (mandatory, Research Wave 0 Gaps): every scenario owns a
 * fs.mkdtempSync root under os.tmpdir(), sets MINDRIAN_ROOMS_HOME to a path
 * inside it, and restores the prior value in a finally. Phase 240 Plan 02
 * just fixed a live-store leak of exactly this class (MEM-03); this file does
 * not reintroduce it. Nothing under ~/MindrianRooms/ is read or written by
 * this file.
 *
 * Harness: the plain ok/fail/scenario pass-counter idiom from
 * tests/test-236-rebuild-preserves-journal.cjs. No jest, no vitest.
 * No em-dashes (CLAUDE.md hard rule); the two forbidden code points appear
 * nowhere in this file, not even as \u escapes, because this file never needs
 * to name them.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const stateOps = require(path.join(REPO, 'lib', 'core', 'state-ops.cjs'));

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  process.stdout.write('  ok ' + name + '\n');
}

function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.stack || err.message || String(err)) + '\n');
}

function scenario(name, fn) {
  try {
    fn();
    ok(name);
  } catch (e) {
    fail(name, e);
  }
}

function makeScratchDir(suffix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-2401-preserved-' + suffix + '-'));
}

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
}

// Save/restore MINDRIAN_ROOMS_HOME in a finally, per
// tests/test-across-session-memory.cjs:100-111's withTmpRoot idiom, so a
// hermetic tmp root under os.tmpdir() is the ONLY thing scripts/compute-state
// can see for registry lookups, and nothing under a real
// $MINDRIAN_ROOMS_HOME (or the default ~/MindrianRooms) is ever touched.
function withHermeticRoomsHome(fn) {
  const roomsHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-2401-preserved-roomshome-'));
  const prior = process.env.MINDRIAN_ROOMS_HOME;
  process.env.MINDRIAN_ROOMS_HOME = roomsHome;
  try {
    return fn(roomsHome);
  } finally {
    if (prior === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
    else process.env.MINDRIAN_ROOMS_HOME = prior;
    rmrf(roomsHome);
  }
}

// Seed a fixture room's STATE.md with the byte-identical block
// scripts/room-registry:127-131 writes (frontmatter + body + Decisions
// heading), so a body-preservation regression is visible too. Also create
// .room-root and .mindrian/ so compute-state's room detection succeeds.
function seedRegistryStyleRoom(roomDir) {
  fs.mkdirSync(roomDir, { recursive: true });
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '', 'utf8');
  fs.writeFileSync(
    path.join(roomDir, 'STATE.md'),
    '---\n'
      + 'gsd_state_version: 1.0\n'
      + 'status: active\n'
      + '---\n'
      + '\n'
      + '# State\n'
      + '\n'
      + '## Decisions\n'
      + '\n'
      + '(none yet)\n',
    'utf8'
  );
}

// Seed a fixture room whose STATE.md carries NO frontmatter at all -- a
// well-formed markdown body with no opening `---` fence.
function seedNoFrontmatterRoom(roomDir) {
  fs.mkdirSync(roomDir, { recursive: true });
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '', 'utf8');
  fs.writeFileSync(
    path.join(roomDir, 'STATE.md'),
    '# State\n\nNo frontmatter here at all.\n',
    'utf8'
  );
}

function readState(roomDir) {
  return fs.readFileSync(path.join(roomDir, 'STATE.md'), 'utf8');
}

// ---------- Scenarios 1-4: registry-seeded room survives a real regeneration ----------

function scenariosRegistrySeededRoom() {
  withHermeticRoomsHome((roomsHome) => {
    const roomDir = path.join(roomsHome, 'preserved-room');
    seedRegistryStyleRoom(roomDir);

    // Drive the REAL computeState() from lib/core/state-ops.cjs.
    stateOps.computeState(roomDir);

    const after = readState(roomDir);

    scenario('1. gsd_state_version survives a real computeState() regeneration', () => {
      assert.ok(
        /^gsd_state_version: 1\.0$/m.test(after),
        'gsd_state_version: 1.0 was DESTROYED by computeState(); STATE.md now reads:\n' + after
      );
    });

    scenario('2. status survives the same regeneration', () => {
      assert.ok(
        /^status: active$/m.test(after),
        'status: active was DESTROYED by computeState(); STATE.md now reads:\n' + after
      );
    });

    scenario('3. the body DID regenerate (this is a real write, not a skipped one)', () => {
      assert.ok(/^computed: /m.test(after), 'computed: line missing -- write did not run');
      assert.ok(/^total_entries: /m.test(after), 'total_entries: line missing -- write did not run');
    });

    scenario('4. anti-vacuity: the emitted value is the byte-identical string "1.0", not a re-rendered "1"', () => {
      const m = after.match(/^gsd_state_version: (\S+)$/m);
      assert.ok(m, 'gsd_state_version line not found at all');
      assert.equal(
        m[1], '1.0',
        'gsd_state_version was re-rendered to "' + m[1] + '" instead of staying the byte-identical "1.0"'
      );
    });
  });
}

// ---------- Scenario 5: no-frontmatter room is stamped forward ----------

function scenarioNoFrontmatterStampedForward() {
  withHermeticRoomsHome((roomsHome) => {
    const roomDir = path.join(roomsHome, 'no-frontmatter-room');
    seedNoFrontmatterRoom(roomDir);

    stateOps.computeState(roomDir);

    const after = readState(roomDir);

    scenario('5. a STATE.md with no prior frontmatter is stamped forward with gsd_state_version: 1.0', () => {
      assert.ok(
        /^gsd_state_version: 1\.0$/m.test(after),
        'a legacy no-version STATE.md was NOT stamped forward; STATE.md now reads:\n' + after
      );
    });
  });
}

// ---------- Runner ----------

process.stdout.write('\nPhase 240.1 Plan 02 Task 1: state-version-preserved (CTXL-01 repro)\n\n');

scenariosRegistrySeededRoom();
scenarioNoFrontmatterStampedForward();

process.stdout.write('\n  passed: ' + passed + '  failed: ' + failed + '\n\n');
if (failed > 0) {
  process.exit(1);
}
process.stdout.write('PASS test-240.1-state-version-preserved.cjs (5 scenarios)\n');
process.exit(0);
