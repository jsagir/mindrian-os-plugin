'use strict';
// Phase 267.2 code review fix CR-02 (partial fix + documented residual,
// see 267.2-CR-02-DEFERRED.md) -- the investment ask had no coordination
// with an in-flight /mos:ignite birth flow. When the classifier routes to
// outcome='ignite', /mos:ignite's own Gate B1 (a two-step persona pick)
// typically spans more turns than the reward leg's own drain window, so
// scripts/first-install-router.cjs's _askInvestment could fire mid-flow,
// injecting a second, competing "who are you" ask for information ignite
// already captured.
//
// Fix: _checkIgniteBirthCaptured reads lib/core/scratchpad-ops.cjs's
// birth_gate_answers journal (the SAME journal commands/ignite.md's B1 gate
// writes via writeScratchpadBirthAnswer the moment the navigator completes
// the two-step persona pick) and, when a 'B1' entry with ts at or after this
// session's own armed_at_ms is found, skips the prose ask entirely --
// folding the already-known role_blend into the deterministic identity seed
// instead of asking again.
//
// This file pins three legs: the skip fires when a same-session B1 answer
// exists; the ordinary ask still fires when no birth answer exists
// (non-regression); and a STALE B1 answer (ts before this session's own
// armed_at_ms, simulating a leftover answer from an earlier session) is
// correctly NOT treated as in-flight for this session.
//
// Isolated HOME throughout. No em-dashes. Plain node:assert/strict.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { withIsolatedHome, keylessEnv } = require('./test-267-2-helpers.cjs');

const REPO = path.join(__dirname, '..');
const ROUTER_PATH = path.join(REPO, 'scripts', 'first-install-router.cjs');
const SCRATCHPAD_OPS = path.join(REPO, 'lib', 'core', 'scratchpad-ops.cjs');

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-267-2-cr-02-ignite-birth-coordination');

function callRouter(env, prompt) {
  const res = spawnSync(process.execPath, [ROUTER_PATH], {
    input: JSON.stringify({ prompt: prompt }),
    env: env,
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.equal(res.status, 0, 'router exited non-zero: ' + res.status + ' stderr=' + res.stderr);
  let envelope = null;
  try { envelope = JSON.parse(res.stdout); } catch (_e) { /* caller asserts */ }
  return envelope;
}

function readState(home) {
  const p = path.join(home, '.mindrian', 'first-install', 'state.json');
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_e) { return null; }
}

function driveToReadyForInvestment(env, home) {
  // Drive the router until state.json reads phase reward_delivered (the turn
  // immediately BEFORE _askInvestment fires), returning the last envelope +
  // state observed. Mirrors tests/test-267-2-user-md-roundtrip.cjs's driveTo.
  let state = null;
  for (let i = 1; i <= 15; i++) {
    callRouter(env, i === 1 ? 'I want to start a new venture' : 'irrelevant follow-up turn');
    state = readState(home);
    if (state && state.phase === 'reward_delivered') return state;
  }
  throw new Error('driveToReadyForInvestment: never reached reward_delivered; last state=' + JSON.stringify(state));
}

function writeBirthAnswerInChild(env, answer) {
  const script = 'const s=require(' + JSON.stringify(SCRATCHPAD_OPS) + ');'
    + 's.writeScratchpadBirthAnswer(' + JSON.stringify(answer) + ');';
  const r = spawnSync(process.execPath, ['-e', script], { env: env, encoding: 'utf8', timeout: 5000 });
  assert.equal(r.status, 0, 'writeScratchpadBirthAnswer child exited non-zero: ' + r.status + ' stderr=' + r.stderr);
}

// ============================================================
// Leg 1: a same-session B1 answer -> the investment ask is SKIPPED, the
// role_blend it captured is folded into the seed, and the state machine
// still advances through investment_asked -> done normally.
// ============================================================

ok('CR-02 FIXED: a same-session /mos:ignite B1 answer suppresses the investment prose ask '
  + 'and folds its role_blend into the deterministic identity seed', function () {
  withIsolatedHome(function (ctx) {
    const env = keylessEnv(ctx.env);
    const userMdPath = path.join(ctx.home, '.mindrian-user.md');

    const stateAtRewardDelivered = driveToReadyForInvestment(env, ctx.home);
    assert.ok(typeof stateAtRewardDelivered.armed_at_ms === 'number', 'sanity: armed_at_ms missing from state.json');

    // Simulate /mos:ignite's own B1 gate completing DURING this session, after arming.
    writeBirthAnswerInChild(env, {
      gate_id: 'B1',
      option_key: 'founder',
      canonical_verb: 'arriving-with',
      alias_label: 'Founder / business',
      role_blend: { founder: 1.0 },
      blueprint_family: 'venture',
      ts: stateAtRewardDelivered.armed_at_ms + 1000,
    });

    // The next turn: reward_delivered -> investment_asked. This is the turn CR-02's finding
    // says used to inject a second "who are you" ask.
    const envelope = callRouter(env, 'irrelevant investment-leg turn');
    const state = readState(ctx.home);
    assert.equal(state.phase, 'investment_asked', 'router did not advance to investment_asked');
    assert.equal(state.investment_ask_skipped, true, 'state.json does not record the skip');
    assert.equal(state.investment_ask_skip_reason, 'ignite_birth_captured');

    assert.equal(
      envelope.hookSpecificOutput,
      undefined,
      'CR-02 REGRESSED: the router still injected additionalContext on the investment-ask turn '
        + 'despite a same-session ignite B1 answer already on record: ' + JSON.stringify(envelope),
    );

    assert.ok(fs.existsSync(userMdPath), 'the identity file was not seeded even in the skip path');
    const { readUserMd } = require(path.join(REPO, 'lib', 'core', 'user-md-ops.cjs'));
    const written = readUserMd(userMdPath, { ignoreOverride: true });
    assert.equal(written.journey_stage, 'ordinary_world', 'deterministic seed delta missing in the skip path');
    assert.equal(
      written.role_blend.founder,
      1.0,
      'the role_blend ignite\'s own B1 already captured was not folded into the seed',
    );

    // The state machine still completes normally on the following turn.
    const doneEnvelope = callRouter(env, 'irrelevant final turn');
    const doneState = readState(ctx.home);
    assert.equal(doneState.phase, 'done', 'router did not advance to done after the skipped investment leg');
    assert.equal(doneEnvelope.hookSpecificOutput, undefined, 'the done turn should never inject additionalContext');
  });
});

// ============================================================
// Leg 2: NON-REGRESSION -- with no birth answer on record at all, the
// ordinary investment ask still fires exactly as before.
// ============================================================

ok('NON-REGRESSION: with no /mos:ignite birth answer on record, the ordinary investment ask '
  + 'still fires (identity_write named in additionalContext, no skip recorded)', function () {
  withIsolatedHome(function (ctx) {
    const env = keylessEnv(ctx.env);
    driveToReadyForInvestment(env, ctx.home);

    const envelope = callRouter(env, 'irrelevant investment-leg turn');
    const state = readState(ctx.home);
    assert.equal(state.phase, 'investment_asked');
    assert.notEqual(state.investment_ask_skipped, true, 'the ordinary path must not record a skip');
    assert.ok(envelope.hookSpecificOutput, 'the ordinary investment ask did not inject additionalContext');
    assert.notEqual(
      envelope.hookSpecificOutput.additionalContext.indexOf('identity_write'),
      -1,
      'the ordinary investment ask must still name identity_write',
    );
  });
});

// ============================================================
// Leg 3: a STALE B1 answer (ts before this session's own armed_at_ms) is
// NOT treated as in-flight -- the ordinary ask still fires.
// ============================================================

ok('a STALE /mos:ignite B1 answer (from before this first-install session armed) does not '
  + 'suppress the investment ask -- only a SAME-SESSION answer does', function () {
  withIsolatedHome(function (ctx) {
    const env = keylessEnv(ctx.env);

    // Write a stale birth answer BEFORE the router ever arms this session, so its ts
    // necessarily predates whatever armed_at_ms the router mints on the very first call.
    writeBirthAnswerInChild(env, {
      gate_id: 'B1',
      option_key: 'founder',
      canonical_verb: 'arriving-with',
      alias_label: 'Founder / business',
      role_blend: { founder: 1.0 },
      blueprint_family: 'venture',
      ts: Date.now() - (60 * 60 * 1000), // one hour in the past
    });

    driveToReadyForInvestment(env, ctx.home);
    const envelope = callRouter(env, 'irrelevant investment-leg turn');
    const state = readState(ctx.home);
    assert.equal(state.phase, 'investment_asked');
    assert.notEqual(
      state.investment_ask_skipped,
      true,
      'a stale (pre-session) birth answer must not suppress the investment ask',
    );
    assert.ok(envelope.hookSpecificOutput, 'the ask should still fire against a stale birth answer');
  });
});

console.log('\nPASS test-267-2-cr-02-ignite-birth-coordination (' + n + ' assertions)');
