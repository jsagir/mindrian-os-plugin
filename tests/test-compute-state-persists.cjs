#!/usr/bin/env node
'use strict';

/**
 * Regression (intern-w1-state-not-recomputed):
 *
 * scripts/compute-state only prints STATE.md's body to stdout by design; it
 * never writes STATE.md itself, so every caller owns persistence. Two
 * callers used to discard that stdout while still reporting success:
 *   1. lib/core/intelligence-cascade.cjs Step 8 (the automatic PostToolUse
 *      cascade that fires on every Write/Edit/MultiEdit into a room section).
 *   2. lib/core/state-ops.cjs::computeState() (the manual re-run path the
 *      MCP room_state `compute-state` command calls).
 * Both now persist the freshly computed body to STATE.md before reporting
 * success, mirroring the pattern already correct in scripts/on-stop /
 * on-task-complete / on-agent-complete.
 *
 * Phase 240.1 Plan 02 (CTXL-01) update: state-ops.cjs::computeState() no
 * longer writes the returned stdout byte-for-byte. It now hands the rendered
 * string to lib/core/state-version.cjs::persistState(), which may SPLICE a
 * gsd_state_version (and status) line into the persisted copy so the
 * pre-existing version stamp a room was seeded with is never silently
 * destroyed (240.1-RESEARCH.md Finding 1B). The fixture room here has no
 * frontmatter at all, so persistState's absent-version branch stamps
 * forward; the assertion below accounts for exactly that splice rather than
 * asserting raw byte-identity, which is no longer this function's contract.
 *
 * Zero test frameworks. Node built-in assert only. CJS only.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const stateOps = require(path.join(PLUGIN_ROOT, 'lib', 'core', 'state-ops.cjs'));
const { runCascade } = require(path.join(PLUGIN_ROOT, 'lib', 'core', 'intelligence-cascade.cjs'));
const {
  spliceFrontmatterKeys,
  STATE_SCHEMA_VERSION_LITERAL,
} = require(path.join(PLUGIN_ROOT, 'lib', 'core', 'state-version.cjs'));

let failed = 0;
function check(name, fn) {
  try {
    fn();
    process.stdout.write('  ok ' + name + '\n');
  } catch (err) {
    failed += 1;
    process.stderr.write('  FAIL ' + name + '\n    ' +
      (err && err.message ? err.message : err) + '\n');
  }
}

async function checkAsync(name, fn) {
  try {
    await fn();
    process.stdout.write('  ok ' + name + '\n');
  } catch (err) {
    failed += 1;
    process.stderr.write('  FAIL ' + name + '\n    ' +
      (err && err.message ? err.message : err) + '\n');
  }
}

const STALE_STATE = '# Data Room State (STALE FIXTURE)\n\ntotal_entries: 0\ncomputed: 2020-01-01T00:00:00Z\n';

// The room dir MUST be literally named "room" (or nested under "rooms/") --
// intelligence-cascade.cjs::isRoomFile() gates on a literal "/room/" or
// "/rooms/" path segment before it will run the cascade at all.
function makeFixtureRoom(prefix) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const roomDir = path.join(tmp, 'room');
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, 'STATE.md'), STALE_STATE);
  fs.mkdirSync(path.join(roomDir, 'market-analysis'), { recursive: true });
  return { tmp, roomDir };
}

async function run() {
  // ---------------------------------------------------------------------
  // Contract 1: state-ops.cjs::computeState() persists to STATE.md.
  // ---------------------------------------------------------------------
  {
    const { tmp, roomDir } = makeFixtureRoom('mos-compute-state-persist-');
    try {
      await checkAsync('stateOps.computeState() writes fresh content to STATE.md on disk (not just stdout)', async () => {
        const before = fs.readFileSync(path.join(roomDir, 'STATE.md'), 'utf8');
        assert.ok(before.includes('STALE FIXTURE'), 'fixture must start stale');
        const returned = stateOps.computeState(roomDir);
        const after = fs.readFileSync(path.join(roomDir, 'STATE.md'), 'utf8');
        assert.ok(!after.includes('STALE FIXTURE'),
          'STATE.md on disk must no longer be the stale fixture after computeState() (got: ' + after.slice(0, 120) + ')');
        // The fixture's STATE.md carried no frontmatter at all, so
        // persistState's absent-version branch stamps gsd_state_version
        // forward (CTXL-01). The persisted copy is the returned stdout with
        // exactly that splice applied, not a byte-identical copy.
        const expectedPersisted = spliceFrontmatterKeys(
          returned, { gsd_state_version: STATE_SCHEMA_VERSION_LITERAL }
        );
        assert.strictEqual(
          after, expectedPersisted,
          'persisted content must be the returned stdout with the CTXL-01 version stamp spliced in'
        );
      });
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  // ---------------------------------------------------------------------
  // Contract 2: intelligence-cascade.cjs Step 8 (via runCascade) persists.
  // ---------------------------------------------------------------------
  {
    const { tmp, roomDir } = makeFixtureRoom('mos-cascade-compute-state-');
    const artifactPath = path.join(roomDir, 'market-analysis', 'research-pm-role-outlook.md');
    fs.writeFileSync(artifactPath, '# PM Role Outlook\n\nSome research content.\n');
    // scripts/build-graph (cascade Step 9, unrelated to compute-state) defaults
    // its output to "./dashboard/graph.json" relative to CWD when only one
    // positional arg is passed - which is exactly how Step 9 invokes it. Run
    // the cascade with CWD pointed at the scratch dir so this pre-existing,
    // out-of-scope behavior cannot write into the plugin repo's own
    // dashboard/graph.json.
    const savedCwd = process.cwd();
    process.chdir(tmp);
    try {
      await checkAsync('runCascade() Step 8 writes fresh content to STATE.md on disk, matching intern-w1 repro', async () => {
        const before = fs.readFileSync(path.join(roomDir, 'STATE.md'), 'utf8');
        assert.ok(before.includes('STALE FIXTURE'), 'fixture must start stale');
        const result = await runCascade(roomDir, { trigger: 'test', filePath: artifactPath });
        assert.strictEqual(result.computeState && result.computeState.status, 'ok',
          'cascade must report computeState ok (got: ' + JSON.stringify(result.computeState) + ')');
        const after = fs.readFileSync(path.join(roomDir, 'STATE.md'), 'utf8');
        assert.ok(!after.includes('STALE FIXTURE'),
          'STATE.md on disk must no longer be the stale fixture after runCascade() reports computeState ok (got: ' + after.slice(0, 120) + ')');
      });
    } finally {
      process.chdir(savedCwd);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  process.stdout.write('\ncompute-state-persists: ' +
    (failed === 0 ? 'ALL PASS' : failed + ' FAILED') + '\n');
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((err) => {
  process.stderr.write('FATAL: ' + (err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
