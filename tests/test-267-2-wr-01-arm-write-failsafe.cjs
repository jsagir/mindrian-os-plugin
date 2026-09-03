'use strict';
// Phase 267.2 code review fix WR-01 -- the one-shot onboarding-marker gate
// was not write-failure safe. _atomicWriteState swallows every filesystem
// error and returns false, but main() never checked that return value at
// the arm step. If ~/.mindrian/first-install/state.json cannot be created,
// state.json never persists, _readState() keeps returning null on every
// later turn, and the ONE-SHOT GATE broke down: _checkOnboardStatus() and
// _classifyAndRoute would re-fire on EVERY subsequent turn for the rest of
// the session, including injecting "invoke /mos:ignite" prose into any
// later, unrelated turn whose sentence happened to score new_venture.
//
// Fix: main() now checks the arm write's return value and, on failure, fails
// the turn closed (emitEmpty(), no classification, no injection) rather than
// proceeding to classify and route anyway.
//
// Reproduction technique: create a REGULAR FILE at the exact path the router
// needs as a DIRECTORY (~/.mindrian, one path segment above
// ~/.mindrian/first-install/state.json). fs.mkdirSync(..., {recursive:true})
// then deterministically throws ENOTDIR, so _atomicWriteState's catch branch
// returns false on every turn -- no chmod, no root-uid special-casing,
// cross-platform-safe within this repo's Linux CI.
//
// Isolated HOME throughout. No em-dashes. Plain node:assert/strict.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { withIsolatedHome, keylessEnv } = require('./test-267-2-helpers.cjs');

const REPO = path.join(__dirname, '..');
const ROUTER_PATH = path.join(REPO, 'scripts', 'first-install-router.cjs');

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-267-2-wr-01-arm-write-failsafe');

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

ok('WR-01 FIXED: when ~/.mindrian/first-install/ cannot be created, the router never '
  + 'classifies or injects ignite prose, on this turn or any later one', function () {
  withIsolatedHome(function (ctx) {
    const env = keylessEnv(ctx.env);

    // Block the directory path: a plain FILE at ~/.mindrian means
    // fs.mkdirSync(~/.mindrian/first-install, {recursive:true}) throws ENOTDIR every time.
    const blockerPath = path.join(ctx.home, '.mindrian');
    fs.writeFileSync(blockerPath, 'WR-01 test blocker: this is a file, not a directory');

    const statePath = path.join(ctx.home, '.mindrian', 'first-install', 'state.json');

    // A strongly new_venture-scoring sentence: if the write-failure guard were absent, this
    // is exactly the sentence that would inject "invoke /mos:ignite" prose.
    const igniteSentence = 'I want to start a new venture around clinical trial recruitment.';

    for (let i = 1; i <= 3; i++) {
      const envelope = callRouter(env, i === 1 ? igniteSentence : 'turn ' + i + ' also mentions starting a new venture');
      assert.ok(envelope, 'turn ' + i + ': router did not emit a parseable envelope');
      assert.equal(
        envelope.hookSpecificOutput,
        undefined,
        'WR-01 REGRESSED: turn ' + i + ' injected additionalContext despite the arm write '
          + 'never being able to persist: ' + JSON.stringify(envelope),
      );
      assert.equal(
        fs.existsSync(statePath),
        false,
        'WR-01: state.json unexpectedly exists at turn ' + i + ' despite the blocked directory path',
      );
    }

    // Sanity: the blocker file itself is untouched (the router degraded gracefully, it did
    // not try to remove or overwrite the obstruction).
    assert.equal(fs.readFileSync(blockerPath, 'utf8'), 'WR-01 test blocker: this is a file, not a directory');
  });
});

ok('NON-REGRESSION: with no blocker present, the arm write succeeds and the router routes normally', function () {
  withIsolatedHome(function (ctx) {
    const env = keylessEnv(ctx.env);
    const statePath = path.join(ctx.home, '.mindrian', 'first-install', 'state.json');

    const envelope = callRouter(env, 'I want to start a new venture around clinical trial recruitment.');
    assert.ok(envelope, 'router did not emit a parseable envelope');
    assert.ok(envelope.hookSpecificOutput, 'the ordinary arm+route turn must still inject additionalContext');
    assert.ok(fs.existsSync(statePath), 'state.json must exist after a normal arm write');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    assert.equal(state.phase, 'routed');
  });
});

console.log('\nPASS test-267-2-wr-01-arm-write-failsafe (' + n + ' assertions)');
