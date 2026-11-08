'use strict';
// Phase 267.2 W1b Task 3, rewritten by Phase 389 plan 07 -- room-free, keyless proof that
// the first-install reward fires and drains through scripts/first-install-router.cjs
// (HOOK-07) on the Pyramid Seed.
//
// Before plan 389-07 the reward was the Instant Brief: a pending record written by a
// per-message hook, a detached child process and a capture file. That machinery is gone.
// The router now classifies the first answer once, at routing time, with the sync
// heuristic of lib/core/mva-classifier.cjs, stores two booleans (venture, hebrew) and no
// text, and on a later turn injects one fixed instruction: write the draft pyramid, then
// offer the evidence step of /mos:structure-argument. This file pins the legs that stay
// true (room-free, keyless, isolated HOME, non-blocking, Part 8, bounded drain that never
// wedges) against that design. tests/test-389-first-install-seed.cjs pins the new
// behaviours in detail.
//
// Turn model. scripts/first-install-router.cjs's state machine advances one phase per
// hook turn: armed -> routed -> (outcome_observed, same phase) -> reward_pending ->
// reward_delivered. Each turn below is a separate spawnSync call, exactly mirroring one
// real UserPromptSubmit invocation.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const helpers = require('./test-267-2-helpers.cjs');

const REPO = path.join(__dirname, '..');
const ROUTER = path.join(REPO, 'scripts', 'first-install-router.cjs');
const CLASSIFIER = path.join(REPO, 'lib', 'core', 'mva-classifier.cjs');

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-267-2-pre-room-reward');

const FIRE_PROMPT = 'I want to start a new venture around clinical trial recruitment coordination.';

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
// 1. ROOM-FREE SOURCE GUARD (research C-6's claim, now pinned on the two files the
// reward path really runs: the router and the classifier it calls)
// ---------------------------------------------------------------------------

ok('scripts/first-install-router.cjs source contains no roomDir/openRoomDb/room.db', function () {
  const src = fs.readFileSync(ROUTER, 'utf8');
  for (const forbidden of ['roomDir', 'openRoomDb', 'room.db']) {
    assert.ok(src.indexOf(forbidden) === -1, 'forbidden room-coupling token found: ' + forbidden);
  }
});

ok('lib/core/mva-classifier.cjs source contains no roomDir/openRoomDb/room.db', function () {
  const src = fs.readFileSync(CLASSIFIER, 'utf8');
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
  const capturePathGlob = path.join(ctx.home, '.mindrian', 'first-install');

  // Turn 1: armed -> routed. The venture verdict is taken here, from this sentence only.
  const r1 = runRouter(env, FIRE_PROMPT);
  ok('router turn 1 (armed -> routed) exits 0', function () {
    assert.equal(r1.status, 0, 'router exited non-zero: ' + r1.status + ' stderr=' + r1.stderr);
  });

  ok('after turn 1, state.json holds venture true and hebrew false, and no sentence text', function () {
    const state = readState(ctx.home);
    assert.equal(state.phase, 'routed');
    assert.strictEqual(state.venture, true);
    assert.strictEqual(state.hebrew, false);
    assert.equal(JSON.stringify(state).indexOf('clinical'), -1, 'sentence text found in the state');
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

  // Turn 3: FIRE. Measured around this spawnSync per the NON-BLOCKING assertion: the
  // fire leg only reads a flag and writes state, so it must return almost immediately.
  const fireStart = Date.now();
  const r3 = runRouter(env, 'irrelevant third-turn prompt');
  const fireElapsedMs = Date.now() - fireStart;

  ok('router turn 3 (fire) exits 0 and injects nothing', function () {
    assert.equal(r3.status, 0, 'router exited non-zero: ' + r3.status + ' stderr=' + r3.stderr);
    const envelope = JSON.parse(r3.stdout);
    assert.equal(envelope.continue, true);
    assert.equal(envelope.hookSpecificOutput, undefined, 'the fire turn must inject nothing');
  });

  ok('FIRE: state.json reaches phase reward_pending with skip_reason null, no sha8 and no capture path', function () {
    const state = readState(ctx.home);
    assert.equal(state.phase, 'reward_pending');
    assert.equal(state.skip_reason, null);
    assert.ok(!state.sha8, 'sha8 should stay empty: ' + state.sha8);
    assert.ok(!state.capture_path, 'capture_path should stay empty: ' + state.capture_path);
    assert.deepEqual(
      walkFiles(capturePathGlob).filter(function (f) { return /brief-.*\.md$/.test(f); }),
      [],
      'a brief capture file exists');
  });

  ok('NON-BLOCKING: the fire turn\'s own wall clock (measured around spawnSync) is under 1500ms', function () {
    assert.ok(
      fireElapsedMs < 1500,
      'fire turn took ' + fireElapsedMs + 'ms, expected under 1500ms'
    );
  });

  // Turn 4: DRAIN. Nothing to simulate: there is no child and no capture file to wait on.
  const r4 = runRouter(env, 'irrelevant fourth-turn prompt');
  ok('router turn 4 (drain) exits 0', function () {
    assert.equal(r4.status, 0, 'router exited non-zero: ' + r4.status + ' stderr=' + r4.stderr);
  });

  ok('DRAIN: the emitted envelope\'s additionalContext carries the fixed Seed instruction', function () {
    const drainEnvelope = JSON.parse(r4.stdout);
    assert.ok(drainEnvelope.hookSpecificOutput, 'no hookSpecificOutput on the drain turn: ' + r4.stdout);
    const text = drainEnvelope.hookSpecificOutput.additionalContext;
    for (const phrase of ['draft pyramid', 'no outside lookup', 'evidence step', '/mos:structure-argument']) {
      assert.ok(text.indexOf(phrase) !== -1, 'additionalContext lacks "' + phrase + '"');
    }
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
// 5. NEVER WEDGES -- a separate isolated HOME with a state in the shape an older router
// left mid-flow (reward_pending, a sha8 and a capture path that never appears, and no
// venture flag). The drain must advance in ONE turn to reward_delivered, carry a skip
// reason, inject nothing (the flag, not a guess, decides) and never emit a non-continue
// envelope, so the investment gate still opens.
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

  const r = runRouter(env, 'older-state drain turn');

  ok('NEVER WEDGES: the drain turn on an older-shaped state exits 0, emits a continue envelope and injects nothing', function () {
    assert.equal(r.status, 0, 'router exited non-zero: ' + r.status + ' stderr=' + r.stderr);
    const envelope = JSON.parse(r.stdout);
    assert.equal(envelope.continue, true, 'envelope did not carry continue:true: ' + r.stdout);
    assert.equal(envelope.hookSpecificOutput, undefined, 'an older-shaped state must not inject the Seed instruction');
  });

  ok('NEVER WEDGES: state.json reaches reward_delivered with a skip reason, the capture file never having appeared', function () {
    assert.equal(fs.existsSync(neverAppearsPath), false, 'the never-appears capture file unexpectedly exists');
    const state = readState(ctx.home);
    assert.equal(state.phase, 'reward_delivered');
    assert.equal(state.skip_reason, 'not_venture_shaped');
  });
});

console.log('\nPASS test-267-2-pre-room-reward (' + n + ' assertions)');
