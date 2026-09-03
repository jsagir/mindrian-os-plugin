'use strict';
// Phase 267.2 code review fix WR-02 -- _fireReward trusted a shared,
// per-turn-overwritable mva-state pending record with no correlation to the
// sentence that actually drove THIS router's routing decision.
//
// scripts/mva-detect.cjs writes lib/core/mva-state.cjs's `pending` record
// independently on EVERY UserPromptSubmit turn (it runs immediately before
// this router in hooks/hooks.json's own chain), guarded only by
// isAlreadyRunning() -- never by "already consumed" or "matches the
// sentence this router itself classified." This router's own state machine
// takes at least 2 additional user turns between the routing decision (turn
// 1, reads the triggering sentence) and the fire turn (turn 3, reads
// whatever `pending` currently holds). If the user's intervening turn is
// independently classified as venture-shaped by mva-detect.cjs's own
// classifier, `pending.sentence_sha256` is silently overwritten before the
// fire leg ever reads it, and the "Instant Brief" would be rendered for the
// wrong, unrelated sentence.
//
// Fix: _classifyAndRoute now persists sentence_sha256 onto state.json at
// routing time; _fireReward compares it against pending.sentence_sha256 at
// fire time and skips with skip_reason: 'pending_sentence_mismatch' on a
// mismatch, rather than silently firing against whatever is currently
// pending.
//
// Isolated HOME throughout. No em-dashes. Plain node:assert/strict.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const { withIsolatedHome, keylessEnv } = require('./test-267-2-helpers.cjs');

const REPO = path.join(__dirname, '..');
const ROUTER_PATH = path.join(REPO, 'scripts', 'first-install-router.cjs');
const MVA_STATE = path.join(REPO, 'lib', 'core', 'mva-state.cjs');

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-267-2-wr-02-reward-sentence-correlation');

function callRouter(env, prompt) {
  const res = spawnSync(process.execPath, [ROUTER_PATH], {
    input: JSON.stringify({ prompt: prompt }),
    env: env,
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.equal(res.status, 0, 'router exited non-zero: ' + res.status + ' stderr=' + res.stderr);
}

function readState(home) {
  const p = path.join(home, '.mindrian', 'first-install', 'state.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writePendingInChild(env, payload) {
  const script = 'const s=require(' + JSON.stringify(MVA_STATE) + ');'
    + 's.writePending(' + JSON.stringify(payload) + ');';
  const r = spawnSync(process.execPath, ['-e', script], { env: env, encoding: 'utf8', timeout: 5000 });
  assert.equal(r.status, 0, 'writePending child exited non-zero: ' + r.status + ' stderr=' + r.stderr);
}

const ROUTED_SENTENCE = 'I want to start a new venture around clinical trial recruitment coordination.';
const UNRELATED_SENTENCE = 'a completely different sentence an intervening mva-detect.cjs turn classified';

ok('WR-02 FIXED: a pending record for a DIFFERENT sentence than the one this router routed '
  + 'is skipped with pending_sentence_mismatch, never fired', function () {
  withIsolatedHome(function (ctx) {
    const env = keylessEnv(ctx.env);
    env.MINDRIAN_ROOMS_HOME = path.join(ctx.home, 'nonexistent-rooms-home');

    // Turn 1: armed -> routed. state.sentence_sha256 becomes sha256(ROUTED_SENTENCE).
    callRouter(env, ROUTED_SENTENCE);
    const afterRoute = readState(ctx.home);
    assert.equal(afterRoute.phase, 'routed');
    assert.equal(
      afterRoute.sentence_sha256,
      crypto.createHash('sha256').update(ROUTED_SENTENCE, 'utf8').digest('hex'),
      'sanity: state.json does not carry the routing-time sentence hash',
    );

    // Turn 2: outcome_observed (phase stays routed).
    callRouter(env, 'irrelevant second-turn prompt');

    // Simulate scripts/mva-detect.cjs independently overwriting `pending` with an UNRELATED
    // sentence's hash on the intervening turn -- exactly the race WR-02 names.
    const unrelatedSha256 = crypto.createHash('sha256').update(UNRELATED_SENTENCE, 'utf8').digest('hex');
    writePendingInChild(env, {
      sentence_sha256: unrelatedSha256,
      classified_at: Date.now(),
      classifier_source: 'heuristic',
      classifier_confidence: 'high',
      locale: 'en',
    });

    // Turn 3: FIRE.
    callRouter(env, 'irrelevant third-turn prompt');
    const afterFire = readState(ctx.home);
    assert.equal(afterFire.phase, 'reward_pending', 'router did not advance to reward_pending');
    assert.equal(
      afterFire.skip_reason,
      'pending_sentence_mismatch',
      'WR-02 REGRESSED: fire did not skip with pending_sentence_mismatch against a pending '
        + 'record for a different sentence -- got skip_reason=' + JSON.stringify(afterFire.skip_reason)
        + ' sha8=' + JSON.stringify(afterFire.sha8),
    );
    assert.equal(
      afterFire.sha8,
      null,
      'WR-02 REGRESSED: a capture/spawn happened against a mismatched pending record '
        + '(sha8 should stay null on a mismatch skip)',
    );
  });
});

ok('NON-REGRESSION: a pending record for the SAME sentence this router routed still fires normally', function () {
  withIsolatedHome(function (ctx) {
    const env = keylessEnv(ctx.env);
    env.MINDRIAN_ROOMS_HOME = path.join(ctx.home, 'nonexistent-rooms-home');

    callRouter(env, ROUTED_SENTENCE);
    callRouter(env, 'irrelevant second-turn prompt');

    const matchingSha256 = crypto.createHash('sha256').update(ROUTED_SENTENCE, 'utf8').digest('hex');
    writePendingInChild(env, {
      sentence_sha256: matchingSha256,
      classified_at: Date.now(),
      classifier_source: 'heuristic',
      classifier_confidence: 'high',
      locale: 'en',
    });

    callRouter(env, 'irrelevant third-turn prompt');
    const afterFire = readState(ctx.home);
    assert.equal(afterFire.phase, 'reward_pending');
    assert.equal(afterFire.skip_reason, null, 'a matching pending record must not be skipped');
    assert.equal(afterFire.sha8, matchingSha256.slice(0, 8), 'a matching pending record must still fire');
  });
});

console.log('\nPASS test-267-2-wr-02-reward-sentence-correlation (' + n + ' assertions)');
