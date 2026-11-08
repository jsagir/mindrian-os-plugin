'use strict';
// Phase 267.2 code review fix WR-02, rewritten by Phase 389 plan 07.
//
// The original defect: _fireReward trusted a shared, per-turn-overwritable pending record
// (written by a per-message hook) with no correlation to the sentence that drove THIS
// router's routing decision, so a later, unrelated venture-shaped turn could silently
// change which sentence the reward was rendered for. Plan 389-07 removes the shared
// record and the hook that wrote it. The guarantee that replaces the correlation check is
// stronger and simpler: the venture verdict is taken ONCE, at routing time, from the
// routing sentence, and stored as two booleans on the router's own state. The fire and
// drain legs read only those booleans. No later turn is ever read, so no later turn can
// change the reward. This file pins that guarantee in both directions.
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
  return res;
}

function readState(home) {
  const p = path.join(home, '.mindrian', 'first-install', 'state.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const ROUTED_SENTENCE = 'I want to start a new venture around clinical trial recruitment coordination.';
const LATER_VENTURE_SENTENCE = 'We are launching a startup that sells reusable packaging to neighbourhood cafes.';
const LATER_NON_VENTURE_SENTENCE = 'what is the weather today in town please';
const ROUTED_NON_VENTURE_SENTENCE = 'what is the weather today in town please';

function sha(s) { return crypto.createHash('sha256').update(s, 'utf8').digest('hex'); }

ok('WR-02 REPLACED: a venture-shaped turn between routing and firing does NOT turn a non-venture '
  + 'routing into a reward (the flag was stored at routing time only)', function () {
  withIsolatedHome(function (ctx) {
    const env = keylessEnv(ctx.env);
    env.MINDRIAN_ROOMS_HOME = path.join(ctx.home, 'nonexistent-rooms-home');

    // Turn 1: armed -> routed. The routing sentence is NOT venture-shaped.
    callRouter(env, ROUTED_NON_VENTURE_SENTENCE);
    const afterRoute = readState(ctx.home);
    assert.equal(afterRoute.phase, 'routed');
    assert.equal(afterRoute.sentence_sha256, sha(ROUTED_NON_VENTURE_SENTENCE),
      'sanity: state.json does not carry the routing-time sentence hash');
    assert.strictEqual(afterRoute.venture, false);

    // Turn 2: outcome_observed, with a clearly venture-shaped sentence typed by the person.
    callRouter(env, LATER_VENTURE_SENTENCE);
    // Turn 3: FIRE.
    callRouter(env, 'irrelevant third-turn prompt');
    const afterFire = readState(ctx.home);
    assert.equal(afterFire.phase, 'reward_pending', 'router did not advance to reward_pending');
    assert.equal(afterFire.skip_reason, 'not_venture_shaped',
      'REGRESSED: a later turn changed the verdict -- skip_reason=' + JSON.stringify(afterFire.skip_reason));
    assert.equal(afterFire.sentence_sha256, sha(ROUTED_NON_VENTURE_SENTENCE),
      'REGRESSED: the stored routing hash changed on a later turn');
    assert.ok(!afterFire.sha8 && !afterFire.capture_path, 'nothing may be set up for a skipped reward');

    // Turn 4: DRAIN injects nothing.
    const r4 = callRouter(env, 'irrelevant fourth-turn prompt');
    assert.equal(JSON.parse(r4.stdout).hookSpecificOutput, undefined, 'the drain injected for a skipped reward');
  });
});

ok('NON-REGRESSION: a non-venture turn between routing and firing does NOT cancel the reward of a '
  + 'venture-shaped routing sentence', function () {
  withIsolatedHome(function (ctx) {
    const env = keylessEnv(ctx.env);
    env.MINDRIAN_ROOMS_HOME = path.join(ctx.home, 'nonexistent-rooms-home');

    callRouter(env, ROUTED_SENTENCE);
    callRouter(env, LATER_NON_VENTURE_SENTENCE);
    callRouter(env, 'irrelevant third-turn prompt');

    const afterFire = readState(ctx.home);
    assert.equal(afterFire.phase, 'reward_pending');
    assert.equal(afterFire.skip_reason, null, 'a venture routing must not be skipped');
    assert.equal(afterFire.sentence_sha256, sha(ROUTED_SENTENCE), 'the routing hash must stay the routing sentence');

    const r4 = callRouter(env, 'irrelevant fourth-turn prompt');
    const ctxText = JSON.parse(r4.stdout).hookSpecificOutput.additionalContext;
    assert.ok(ctxText.indexOf('draft pyramid') !== -1, 'the drain did not inject the Seed instruction');
  });
});

ok('NO SHARED RECORD: the router text names no pending record and reads no other state file', function () {
  const src = fs.readFileSync(ROUTER_PATH, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map(function (l) { return l.replace(/^\s*\/\/.*$/, ''); }).join('\n');
  for (const forbidden of ['readPending', 'writePending', 'mva-state', 'pending_sentence_mismatch']) {
    assert.ok(src.indexOf(forbidden) === -1, 'the router still names ' + forbidden);
  }
});

console.log('\nPASS test-267-2-wr-02-reward-sentence-correlation (' + n + ' assertions)');
