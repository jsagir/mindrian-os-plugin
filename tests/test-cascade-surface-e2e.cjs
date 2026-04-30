#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 95.1-02 -- RED skeleton for /mos:doctor class D (cascade surface
 * end-to-end live verification).
 *
 * Covers: DOCTOR-95.1-02 + DOCTOR-95.1-08.
 *
 * Behavior asserted (Wave 1 Plan 95.1-04 will implement
 * checkSurfaceVerification() in scripts/doctor.cjs that runs this same
 * pattern from the doctor command):
 *   1. Copy the committed test/fixtures/cascade-surface-e2e/ tree to a
 *      tmpdir so the test does not dirty the committed fixture.
 *   2. Set MINDRIAN_ROOMS_HOME=<tmpdir> on the spawnSync env.
 *   3. Fire the bash post-write hook with a synthetic envelope pointing at
 *      <tmpdir>/surface-e2e-room/problem-definition/seed-artifact/seed-artifact.md
 *   4. Assert: hook exits 0.
 *   5. Assert: <tmpdir>/surface-e2e-room/.mindrian/last-cascade.json
 *      exists.
 *   6. Assert: it parses as JSON.
 *   7. Assert: it carries all 8 documented root keys: cascade_status,
 *      classification, file_path, git_commit, graph_index,
 *      proactive_intelligence, section, timestamp (per D-06).
 *
 * Defensive (Pitfall 2 from 95.1-RESEARCH.md): every spawnSync MUST set
 * MINDRIAN_ROOMS_HOME to the tmpdir copy. Without it, scripts/resolve-room
 * falls through to the user's real ~/MindrianRooms/ and the cascade fires
 * against the user's real active room. We assert the env binding before
 * every spawn.
 *
 * IIFE harness pattern from tests/test-cascade-side-channel.cjs.
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const POST_WRITE = path.join(REPO, 'scripts', 'post-write');
const FIXTURE_REPO_PATH = path.join(REPO, 'test', 'fixtures', 'cascade-surface-e2e');

// Required keys per Plan 95-02 contract (D-06 in 95.1-CONTEXT.md).
const REQUIRED_KEYS = [
  'cascade_status',
  'classification',
  'file_path',
  'git_commit',
  'graph_index',
  'proactive_intelligence',
  'section',
  'timestamp',
];

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  process.stdout.write('  ok ' + name + '\n');
}

function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) {
    process.stdout.write('    ' + (err.message || String(err)) + '\n');
  }
}

// ---------- Sandbox helpers ----------

function makeScratchDir(suffix) {
  const base = path.join(
    os.tmpdir(),
    'mos-cascade-surface-e2e-' + Date.now().toString(36) + '-' + suffix
  );
  fs.mkdirSync(base, { recursive: true });
  return base;
}

function rmrf(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch (_) { /* best-effort */ }
}

// Copy the committed cascade-surface-e2e/ fixture into the scratch dir so
// the test does not dirty the committed tree. fs.cpSync is Node 16.7+
// stable, Node 22.22.2 (verified plugin floor) supports it.
function copyFixture(scratch) {
  const dest = path.join(scratch, 'cascade-surface-e2e');
  fs.cpSync(FIXTURE_REPO_PATH, dest, { recursive: true });
  return dest;
}

// Run the bash post-write hook with a synthetic PostToolUse envelope on
// stdin. Mirror of runBashHook from tests/test-cascade-side-channel.cjs.
// MINDRIAN_ROOMS_HOME is the binding constraint for cascade-surface-e2e:
// without it, resolve-room falls through to the user's real active room
// and the active-room guard at scripts/post-write lines 207-217 fires
// silently (Pitfall 2 / Pitfall 4 from 95.1-RESEARCH.md).
function runBashHook(scriptPath, envelope, opts) {
  const o = opts || {};
  const env = Object.assign({}, process.env, o.env || {});
  // Defensive assertion before every spawn (Pitfall 2 guard).
  assert.equal(typeof env.MINDRIAN_ROOMS_HOME, 'string',
    'Test must set MINDRIAN_ROOMS_HOME to scratch dir to avoid leaking into real active room');
  const res = spawnSync('bash', [scriptPath], {
    encoding: 'utf8',
    input: JSON.stringify(envelope),
    timeout: o.timeoutMs || 8000,
    cwd: o.cwd || process.cwd(),
    env: env,
  });
  return {
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    status: typeof res.status === 'number' ? res.status : -1,
  };
}

// ---------- Scenarios ----------

(function test1_committedFixtureExists() {
  // PRE-CONDITION: Plan 95.1-01 created the committed fixture. This test
  // is GREEN today (the fixture is on disk after Plan 95.1-01) and
  // continues to be GREEN throughout Wave 1.
  const label = 'cascade-surface-e2e: committed fixture exists at expected path';
  try {
    assert.equal(fs.existsSync(FIXTURE_REPO_PATH), true,
      label + ': committed fixture must exist at ' + FIXTURE_REPO_PATH);
    assert.equal(
      fs.existsSync(path.join(FIXTURE_REPO_PATH, 'surface-e2e-room', '.room-root')),
      true,
      label + ': fixture must contain surface-e2e-room/.room-root sentinel'
    );
    assert.equal(
      fs.existsSync(path.join(FIXTURE_REPO_PATH, 'surface-e2e-room', 'STATE.md')),
      true,
      label + ': fixture must contain surface-e2e-room/STATE.md'
    );
    assert.equal(
      fs.existsSync(path.join(FIXTURE_REPO_PATH, '.rooms', 'registry.json')),
      true,
      label + ': fixture must contain .rooms/registry.json'
    );
    ok(label);
  } catch (e) {
    fail(label, e);
  }
})();

(function test2_liveCascadeWritesSideChannel() {
  // RED: asserts the live cascade fires through the bash hook against the
  // copy of the committed fixture and produces an 8-key side-channel.
  // The post-write hook is shipped (Plan 95-02) so this MAY pass today --
  // it depends on whether the committed fixture's structure satisfies the
  // hook's section-detect + cascade walk. If the cascade short-circuits
  // (e.g. fixture missing a piece), this is RED until Wave 1 Plan 95.1-01
  // + Plan 95.1-04 close the gap.
  const label = 'cascade-surface-e2e: live cascade writes 8-key side-channel';
  const scratch = makeScratchDir('live-cascade');
  try {
    const fixtureCopy = copyFixture(scratch);
    const roomDir = path.join(fixtureCopy, 'surface-e2e-room');
    const target = path.join(roomDir, 'problem-definition', 'seed-artifact', 'seed-artifact.md');

    // The seed artifact already exists in the fixture (per Plan 95.1-01).
    // Touch it via a Write to fire the post-write hook end-to-end.
    assert.equal(fs.existsSync(target), true,
      label + ': seed-artifact target must exist in copied fixture');
    fs.writeFileSync(target, '---\nname: seed-artifact\n---\n# Body\n# touched ' + Date.now() + '\n');

    const envelope = {
      tool_name: 'Write',
      tool_input: { file_path: target },
    };

    const { status } = runBashHook(POST_WRITE, envelope, {
      env: { MINDRIAN_ROOMS_HOME: fixtureCopy },
    });
    assert.equal(status, 0, label + ': hook must exit 0');

    // Stale side-channel from the committed fixture must be replaced by a
    // fresh write. We don't care about the prior content; we only care
    // that after the hook runs, the file parses cleanly with the 8 keys
    // and a complete cascade_status.
    const sideChannel = path.join(roomDir, '.mindrian', 'last-cascade.json');
    assert.equal(fs.existsSync(sideChannel), true,
      label + ': side-channel file must exist at ' + sideChannel);

    const raw = fs.readFileSync(sideChannel, 'utf8');
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (e) {
      throw new Error(label + ': side-channel must be valid JSON. Got: ' + raw);
    }
    assert.equal(typeof payload, 'object',
      label + ': side-channel JSON must be an object');
    assert.notEqual(payload, null,
      label + ': side-channel JSON must not be null');

    for (const k of REQUIRED_KEYS) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(payload, k),
        true,
        label + ': side-channel JSON missing required key "' + k + '"'
      );
    }

    assert.equal(payload.cascade_status, 'complete',
      label + ': cascade_status must be "complete"');

    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(scratch);
  }
})();

(function test3_defensiveEnvAssertion() {
  // RED until Wave 1: confirms the test harness itself catches the
  // Pitfall 2 leak (forgetting MINDRIAN_ROOMS_HOME). Build an opts object
  // missing the env, expect the runBashHook defensive assert to throw.
  const label = 'cascade-surface-e2e: defensive MINDRIAN_ROOMS_HOME guard active';
  try {
    let threw = false;
    try {
      // Run with no env override at all -- the defensive assert MUST
      // catch the omission. If MINDRIAN_ROOMS_HOME happens to be set in
      // the OUTER process.env, this scenario is inconclusive; in that
      // case we simply ok() because the guard's PURPOSE is to prevent a
      // FALL-THROUGH to user's real room, and an externally-set
      // MINDRIAN_ROOMS_HOME pointing at a sandboxed place is acceptable.
      if (!process.env.MINDRIAN_ROOMS_HOME) {
        runBashHook(POST_WRITE, { tool_name: 'Write', tool_input: { file_path: '/tmp/x.md' } });
      } else {
        // Outer env already has MINDRIAN_ROOMS_HOME set, simulate the
        // missing-env case by clearing it explicitly inside the spawn.
        runBashHook(POST_WRITE, { tool_name: 'Write', tool_input: { file_path: '/tmp/x.md' } },
          { env: { MINDRIAN_ROOMS_HOME: undefined } });
      }
    } catch (e) {
      threw = true;
    }
    assert.equal(threw, true,
      label + ': runBashHook MUST throw when MINDRIAN_ROOMS_HOME is not set on opts.env');
    ok(label);
  } catch (e) {
    fail(label, e);
  }
})();

// ---------- Report ----------

process.stdout.write('\n');
process.stdout.write(
  'cascade-surface-e2e (class D live cascade): ' + passed + ' passed, ' + failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);
