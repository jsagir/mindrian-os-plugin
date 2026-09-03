'use strict';
// Phase 267.2 W1b Task 3 -- room-free, keyless proof that the Instant Brief
// reward fires and drains through scripts/first-install-router.cjs (HOOK-07).
//
// Research finding C-6: lib/core/mva-orchestrator.cjs's runPipeline is the
// one qualifying variable reward with no room coupling (all state under
// ~/.mindrian/mva/, no roomDir, no db). This file pins that claim at the
// source level and proves the router's fire-and-drain contract end to end
// under an isolated HOME, with all three API keys stripped and no rooms
// home -- the default a first-install session actually runs under
// (267.2-RESEARCH.md, Environment Availability).
//
// Turn model. scripts/first-install-router.cjs's state machine advances one
// phase per hook turn: armed -> routed -> (outcome_observed, same phase) ->
// reward_pending -> reward_delivered. Each turn below is a separate
// spawnSync call, exactly mirroring one real UserPromptSubmit invocation.
// This is deliberate, not a workaround: tests/test-267-2-router-telemetry.cjs
// (267.2-06's own test, which this plan's <verification> requires stays
// green) already pins that a SECOND router call on a freshly-routed session
// produces the outcome_observed telemetry line -- so the fire leg cannot
// collapse into the same turn as routing without breaking that contract.
//
// Cleanup discipline (per this plan's own Task 3 instruction): the FIRE
// assertion below does let a real scripts/mva-run.cjs child spawn (that is
// the behaviour under test), but the test never waits on it -- the router's
// own spawn() call is detached+unref'd, so the parent router process (and
// this test's spawnSync of it) returns long before the grandchild pipeline
// finishes. The DRAIN assertion does not depend on that real child either:
// it simulates completion by writing known text into the capture file and
// marking the MVA state complete directly, per the plan's own instruction,
// so the test never blocks on a real agent dispatch.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const helpers = require('./test-267-2-helpers.cjs');

const REPO = path.join(__dirname, '..');
const ROUTER = path.join(REPO, 'scripts', 'first-install-router.cjs');
const MVA_ORCHESTRATOR = path.join(REPO, 'lib', 'core', 'mva-orchestrator.cjs');
const MVA_STATE = path.join(REPO, 'lib', 'core', 'mva-state.cjs');

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-267-2-pre-room-reward');

const FIRE_PROMPT = 'I want to start a new venture around clinical trial recruitment coordination.';
const KNOWN_BRIEF_TEXT = 'INSTANT-BRIEF-SIMULATED-RENDER-marker-8f3d2a';

function stateFilePath(home) {
  return path.join(home, '.mindrian', 'first-install', 'state.json');
}

function readState(home) {
  return JSON.parse(fs.readFileSync(stateFilePath(home), 'utf8'));
}

function runRouter(env, prompt) {
  return spawnSync('node', [ROUTER], {
    input: JSON.stringify({ prompt: prompt }),
    env: env,
    encoding: 'utf8',
    timeout: 8000,
  });
}

function writePendingInChild(env, payload) {
  const script = 'const s=require(' + JSON.stringify(MVA_STATE) + ');'
    + 's.writePending(' + JSON.stringify(payload) + ');';
  return spawnSync('node', ['-e', script], { env: env, encoding: 'utf8', timeout: 5000 });
}

function markCompleteInChild(env) {
  const script = 'require(' + JSON.stringify(MVA_STATE) + ').markComplete();';
  return spawnSync('node', ['-e', script], { env: env, encoding: 'utf8', timeout: 5000 });
}

function walkFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_e) {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function extractLongWords(sentence) {
  const words = sentence.match(/[A-Za-z]{8,}/g) || [];
  return Array.from(new Set(words));
}

// ---------------------------------------------------------------------------
// 1. ROOM-FREE SOURCE GUARD (research C-6's central claim, pinned at source)
// ---------------------------------------------------------------------------

ok('lib/core/mva-orchestrator.cjs source contains no roomDir/openRoomDb/room.db', function () {
  const src = fs.readFileSync(MVA_ORCHESTRATOR, 'utf8');
  for (const forbidden of ['roomDir', 'openRoomDb', 'room.db']) {
    assert.ok(src.indexOf(forbidden) === -1, 'forbidden room-coupling token found: ' + forbidden);
  }
});

ok('lib/core/mva-state.cjs source contains no roomDir/openRoomDb/room.db', function () {
  const src = fs.readFileSync(MVA_STATE, 'utf8');
  for (const forbidden of ['roomDir', 'openRoomDb', 'room.db']) {
    assert.ok(src.indexOf(forbidden) === -1, 'forbidden room-coupling token found: ' + forbidden);
  }
});

// ---------------------------------------------------------------------------
// 2-3-4-6. FIRE, NON-BLOCKING, DRAIN, PART 8 -- one isolated HOME
// ---------------------------------------------------------------------------

helpers.withIsolatedHome(function (ctx) {
  const env = helpers.keylessEnv(ctx.env);
  env.MINDRIAN_ROOMS_HOME = path.join(ctx.home, 'nonexistent-rooms-home');

  const fixedSha256 = crypto.createHash('sha256')
    .update('267.2-07 pre-room-reward test fixture sentence, never a real user sentence', 'utf8')
    .digest('hex');
  const expectedSha8 = fixedSha256.slice(0, 8);
  const expectedCapturePath = path.join(ctx.home, '.mindrian', 'first-install', 'brief-' + expectedSha8 + '.md');

  ok('mvaState.writePending seeds a pending record in the isolated HOME', function () {
    const r = writePendingInChild(env, {
      sentence_sha256: fixedSha256,
      classified_at: Date.now(),
      classifier_source: 'heuristic',
      classifier_confidence: 'high',
      locale: 'en',
    });
    assert.equal(r.status, 0, 'seed child exited non-zero: ' + r.status + ' stderr=' + r.stderr);
  });

  // Turn 1: armed -> routed.
  const r1 = runRouter(env, FIRE_PROMPT);
  ok('router turn 1 (armed -> routed) exits 0', function () {
    assert.equal(r1.status, 0, 'router exited non-zero: ' + r1.status + ' stderr=' + r1.stderr);
  });

  // Turn 2: outcome_observed (phase stays 'routed').
  const r2 = runRouter(env, 'irrelevant second-turn prompt');
  ok('router turn 2 (outcome_observed) exits 0', function () {
    assert.equal(r2.status, 0, 'router exited non-zero: ' + r2.status + ' stderr=' + r2.stderr);
  });

  ok('after turn 2, state.json phase is still routed with outcome_observed_at_ms set', function () {
    const state = readState(ctx.home);
    assert.equal(state.phase, 'routed');
    assert.ok(typeof state.outcome_observed_at_ms === 'number');
  });

  // Turn 3: FIRE. Measured around this spawnSync per the NON-BLOCKING
  // assertion -- decision D-D's out-of-band shape must hold: the router
  // itself returns almost immediately even though it spawns the pipeline.
  const fireStart = Date.now();
  const r3 = runRouter(env, 'irrelevant third-turn prompt');
  const fireElapsedMs = Date.now() - fireStart;

  ok('router turn 3 (fire) exits 0', function () {
    assert.equal(r3.status, 0, 'router exited non-zero: ' + r3.status + ' stderr=' + r3.stderr);
  });

  ok('FIRE: state.json reaches phase reward_pending with a non-null sha8 and a capture path inside the isolated HOME', function () {
    const state = readState(ctx.home);
    assert.equal(state.phase, 'reward_pending');
    assert.equal(typeof state.sha8, 'string');
    assert.ok(state.sha8.length > 0);
    assert.equal(state.sha8, expectedSha8);
    assert.equal(typeof state.capture_path, 'string');
    assert.ok(state.capture_path.startsWith(ctx.home), 'capture_path escapes the isolated HOME: ' + state.capture_path);
    assert.equal(state.capture_path, expectedCapturePath);
  });

  ok('NON-BLOCKING: the fire turn\'s own wall clock (measured around spawnSync) is under 1500ms', function () {
    assert.ok(
      fireElapsedMs < 1500,
      'fire turn took ' + fireElapsedMs + 'ms, expected under 1500ms -- decision D-D would be violated'
    );
  });

  // DRAIN: simulate pipeline completion directly (never wait on the real
  // detached grandchild spawned by turn 3) -- write known text into the
  // capture file and mark the MVA state complete, then run the router again.
  fs.writeFileSync(expectedCapturePath, KNOWN_BRIEF_TEXT, 'utf8');
  const markResult = markCompleteInChild(env);
  ok('markComplete on the isolated MVA state exits 0', function () {
    assert.equal(markResult.status, 0, 'markComplete child exited non-zero: ' + markResult.status + ' stderr=' + markResult.stderr);
  });

  const r4 = runRouter(env, 'irrelevant fourth-turn prompt');
  ok('router turn 4 (drain) exits 0', function () {
    assert.equal(r4.status, 0, 'router exited non-zero: ' + r4.status + ' stderr=' + r4.stderr);
  });

  let drainEnvelope;
  ok('DRAIN: the emitted envelope\'s additionalContext contains the simulated brief text', function () {
    drainEnvelope = JSON.parse(r4.stdout);
    assert.ok(drainEnvelope.hookSpecificOutput, 'no hookSpecificOutput on the drain turn: ' + r4.stdout);
    assert.ok(
      drainEnvelope.hookSpecificOutput.additionalContext.indexOf(KNOWN_BRIEF_TEXT) !== -1,
      'additionalContext does not carry the simulated brief text'
    );
  });

  ok('DRAIN: state.json reaches phase reward_delivered', function () {
    const state = readState(ctx.home);
    assert.equal(state.phase, 'reward_delivered');
    assert.equal(typeof state.delivered_at_ms, 'number');
  });

  ok('PART 8: a whole-tree scan of the isolated HOME finds no 8-or-more character substring of the routing prompt', function () {
    const longWords = extractLongWords(FIRE_PROMPT);
    assert.ok(longWords.length > 0, 'FIRE_PROMPT has no 8+ char word to check -- strengthen the fixture');
    for (const file of walkFiles(ctx.home)) {
      for (const word of longWords) {
        helpers.assertNoRawText(file, word);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 5. NO-KEY DEGRADATION -- a separate isolated HOME, router state seeded
// directly at reward_pending so the drain loop is exercised in isolation
// without waiting on a real agent dispatch (per this task's own instruction).
// ---------------------------------------------------------------------------

helpers.withIsolatedHome(function (ctx) {
  const env = helpers.keylessEnv(ctx.env);
  env.MINDRIAN_ROOMS_HOME = path.join(ctx.home, 'nonexistent-rooms-home');

  const firstInstallDir = path.join(ctx.home, '.mindrian', 'first-install');
  fs.mkdirSync(firstInstallDir, { recursive: true });
  const neverAppearsPath = path.join(firstInstallDir, 'brief-deadbeef.md');
  const seededState = {
    phase: 'reward_pending',
    schema_version: 1,
    armed_at_ms: Date.now(),
    routed_at_ms: Date.now(),
    bucket: 'new_venture',
    outcome: 'ignite',
    outcome_observed_at_ms: Date.now(),
    sha8: 'deadbeef',
    fired_at_ms: Date.now(),
    capture_path: neverAppearsPath,
    skip_reason: null,
    drain_retries: 0,
  };
  fs.writeFileSync(path.join(firstInstallDir, 'state.json'), JSON.stringify(seededState), 'utf8');

  // Deviation (Rule 1 - stale test, discovered while executing plan 267.2-09): exactly
  // DRAIN_MAX_RETRIES (5) turns is the precise number that forces drain_timeout and lands
  // on reward_delivered -- confirmed against scripts/first-install-router.cjs's own
  // DRAIN_MAX_RETRIES constant. This loop originally ran 6 turns, with the 6th turn
  // intended as a "does it stay put" sanity check against the OLD catch-all behavior,
  // where reward_delivered was a dead end. Plan 267.2-09 (HOOK-10) wires reward_delivered
  // forward into investment_asked by design (decision D-L), so a 6th turn here now
  // legitimately advances past reward_delivered -- that transition is plan 267.2-09's own
  // roundtrip test's job (tests/test-267-2-user-md-roundtrip.cjs), not this file's. Reduced
  // to 5 turns so this test keeps testing exactly what its own name says: the drain
  // mechanism's bounded retry counter forcing reward_delivered, nothing past it.
  const runs = [];
  for (let i = 0; i < 5; i++) {
    runs.push(runRouter(env, 'no-key degradation drain turn ' + i));
  }

  ok('NO-KEY DEGRADATION: all 5 drain turns exit 0 and never emit a non-continue envelope', function () {
    for (const r of runs) {
      assert.equal(r.status, 0, 'router exited non-zero: ' + r.status + ' stderr=' + r.stderr);
      const envelope = JSON.parse(r.stdout);
      assert.equal(envelope.continue, true, 'envelope did not carry continue:true: ' + r.stdout);
    }
  });

  ok('NO-KEY DEGRADATION: state.json reaches reward_delivered with skip_reason drain_timeout, the capture file never having appeared', function () {
    assert.equal(fs.existsSync(neverAppearsPath), false, 'the never-appears capture file unexpectedly exists');
    const state = readState(ctx.home);
    assert.equal(state.phase, 'reward_delivered');
    assert.equal(state.skip_reason, 'drain_timeout');
  });
});

console.log('\nPASS test-267-2-pre-room-reward (' + n + ' assertions)');
