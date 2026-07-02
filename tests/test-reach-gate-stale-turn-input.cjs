'use strict';
// reach-gate-stale-turn-input (2026-07-02) -- regression for the non-reactive reach gate.
//
// ROOT CAUSE (proven with file:line in .planning/debug/reach-gate-stale-turn-input.md):
// the per-turn routing seed (deriveConversationSeed) read ONLY persisted session history
// (getSessionHistory) and NEVER the current user turn (STDIN_MESSAGE). At UserPromptSubmit
// time the current message is not yet stored, so turn.userText fed to decide()/
// dispatchSensors AND the getRoomContext seedFragments were turn-independent -> the reach
// gate rendered a byte-identical payload across materially different turns.
//
// This suite is a SUBPROCESS test: the child pipes a distinctive message on stdin (so the
// module-scope STDIN_MESSAGE is set at load), requires the classifier, and calls the
// exported deriveConversationSeed with a stubbed history. It asserts:
//   (1) the current turn text is now PRESENT in the seed (the fix), and is the freshest
//       (tail) line so resolveSeedNode + the sensor text-scan prefer it;
//   (2) two DIFFERENT current turns with IDENTICAL history yield DIFFERENT seeds (the
//       non-reactivity is gone -- decide() input is no longer byte-identical);
//   (3) an EMPTY current turn degrades byte-identically to the pre-fix history-only seed
//       (no regression to the RETR-02 wiring).
//
// House rule: hyphens only, no em-dashes.

const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const CLASSIFIER = path.join(REPO_ROOT, 'scripts', 'intent-classifier.cjs');

// The child harness: load the classifier with a controlled STDIN_MESSAGE, then exercise
// the exported deriveConversationSeed against a stubbed history. Prints one JSON line.
const CHILD = `
  const mod = require(${JSON.stringify(CLASSIFIER)});
  const HISTORY = { prior: 'we were mapping the v1.14 sprint action items', current: null };
  const navStub = {
    getSessionHistory: function () {
      return Promise.resolve([{ fragments: [{ role: 'user', content: HISTORY.prior }] }]);
    },
  };
  const dbStub = { prepare: function () { return { get: function () { return null; }, all: function () { return []; } }; } };
  mod.deriveConversationSeed(navStub, dbStub).then(function (seed) {
    process.stdout.write(JSON.stringify({ seed: seed }));
  });
`;

function runChild(message) {
  const stdin = message === null ? '' : JSON.stringify({ user_message: message });
  const out = execFileSync(process.execPath, ['-e', CHILD], {
    input: stdin,
    encoding: 'utf8',
    cwd: REPO_ROOT,
  });
  return JSON.parse(out).seed;
}

const PRIOR = 'we were mapping the v1.14 sprint action items';

// (1) the current turn is present AND is the freshest (tail) line.
const igniteSeed = runChild('ignite');
assert.ok(
  igniteSeed.includes('ignite'),
  '(1) the current turn "ignite" must be present in the routing seed (the fix)'
);
assert.ok(
  igniteSeed.trim().endsWith('ignite'),
  '(1) the current turn must be the freshest (tail) seed line'
);
assert.ok(
  igniteSeed.includes(PRIOR),
  '(1) the prior history fragment must still be seeded (context preserved)'
);

// (2) two different current turns, identical history -> different seeds (reactivity).
const showSeed = runChild('please show me the deck');
assert.notEqual(
  igniteSeed, showSeed,
  '(2) different current turns must yield different seeds -> decide() input is no longer byte-identical'
);

// (3) empty current turn degrades to the byte-identical pre-fix history-only seed.
const emptySeed = runChild(null);
assert.equal(
  emptySeed, PRIOR,
  '(3) an empty current turn must degrade byte-identically to the history-only seed (no RETR-02 regression)'
);

process.stdout.write('PASS test-reach-gate-stale-turn-input.cjs (current turn threaded into routing seed; reach gate reacts)\n');
process.exit(0);
