#!/usr/bin/env node
'use strict';

/**
 * Phase 122-03 -- chain-recommender tests (new suite; registered in the Feynman runner).
 *
 * Registered in lib/memory/run-feynman-tests.cjs TEST_FILES[] and in
 * tests/run-all-122.sh CJS_SUITES (as ../lib/memory/chain-recommender.test.cjs).
 * Run: node lib/memory/chain-recommender.test.cjs
 * Exit 0 on pass; throws (node:assert) on any fail.
 *
 * Five assertion groups (per 122-03-PLAN.md Task 2 <behavior>):
 *   1. recommendFrameworkChain({ problemType:'ill-defined' }) -> non-empty
 *      ordered array of framework-name strings (length 1..4); element 0 is the
 *      seed (here, the IDP family's first skill resolved through the registry).
 *   2. recommendFrameworkChain({ currentFramework:'Beautiful Question Framework' })
 *      -> that framework first; with offline FEEDS_INTO edges supplied via
 *      roomState, its successors follow in order.
 *   3. A seed framework with no outgoing FEEDS_INTO edge -> [seed] (degrades
 *      cleanly, not a crash).
 *   4. Brain unavailable (monkey-patch brain-client.isAvailable() -> false) ->
 *      the recommender still returns a chain (offline FEEDS_INTO walk, or [seed]);
 *      never throws, never returns null.
 *   5. Canon Part 8: the recommender source contains NO command literal; any
 *      Cypher-looking string it builds contains only $-bound params (framework
 *      names / enums) -- no string interpolation of a command, no user-content
 *      token. The recommender's return value is framework names only.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const RECOMMENDER_PATH = path.join(REPO_ROOT, 'lib', 'brain', 'chain-recommender.cjs');
const REGISTRY_PATH = path.join(REPO_ROOT, 'data', 'command-registry.json');

const recommender = require('../brain/chain-recommender.cjs');
const composer = require('../core/framework-chain-composer.cjs');
const problemTypeRouter = require('../core/problem-type-router.cjs');
const brainClient = require('../core/brain-client.cjs');

const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));

let passed = 0;
function test(name, fn) {
  fn();
  process.stdout.write('  ok  ' + name + '\n');
  passed += 1;
}

// Derive what the IDP seed framework SHOULD be (so the test is retrofit-proof:
// it does not hardcode "Beautiful Question Framework", it re-derives it the
// way the recommender does -- router first skill -> registry first framework).
function slugToFramework(slug) {
  for (const c of registry.commands) {
    if (!c || typeof c.command !== 'string') continue;
    const parts = c.command.split(':');
    if (parts.length >= 2 && parts.slice(1).join(':') === slug) {
      return (Array.isArray(c.frameworks) && c.frameworks.length > 0) ? c.frameworks[0] : null;
    }
  }
  return null;
}
const idpSkills = problemTypeRouter.routeByProblemType('IDP', null).recommended_skills;
const expectedIdpSeed = slugToFramework(idpSkills[0]);
assert.ok(expectedIdpSeed, 'the IDP family first skill must resolve to a framework via the registry');

// ---------------------------------------------------------------------------
// 1. seeded from problem-type, walked via FEEDS_INTO; seed is first
// ---------------------------------------------------------------------------
test('recommendFrameworkChain({problemType:"ill-defined"}) -> non-empty ordered framework-name array, seed first', function () {
  const chain = recommender.recommendFrameworkChain({ problemType: 'ill-defined' });
  assert.ok(Array.isArray(chain), 'returns an array');
  assert.ok(chain.length >= 1 && chain.length <= 4, 'length 1..4, got ' + chain.length);
  assert.ok(chain.every(function (x) { return typeof x === 'string' && x.length > 0; }), 'all elements are non-empty strings');
  assert.strictEqual(chain[0], expectedIdpSeed, 'element 0 is the IDP seed framework');
  // 'IDP' alias and the canonical token yield the same seed.
  assert.strictEqual(recommender.recommendFrameworkChain({ problemType: 'IDP' })[0], expectedIdpSeed);
  // The other problem-type families seed differently (UDP / WDP).
  const udpSeed = slugToFramework(problemTypeRouter.routeByProblemType('UDP', null).recommended_skills[0]);
  assert.strictEqual(recommender.recommendFrameworkChain({ problemType: 'undefined' })[0], udpSeed);
});

// ---------------------------------------------------------------------------
// 2. currentFramework first; offline FEEDS_INTO successors follow
// ---------------------------------------------------------------------------
test('recommendFrameworkChain({currentFramework:X}) -> X first; supplied FEEDS_INTO edges add successors in order', function () {
  // No offline edges -> degrades to [X].
  const bare = recommender.recommendFrameworkChain({ currentFramework: 'Beautiful Question Framework' });
  assert.strictEqual(bare[0], 'Beautiful Question Framework');

  // With a pre-parsed FEEDS_INTO edge array (the shape parseFrameworkChainSection
  // returns) -> walk the chain via composer.proposeNextFramework.
  const edges = [
    { from: 'Beautiful Question Framework', to: 'Domain Selection', confidence: 0.9, phase_indicator: null },
    { from: 'Domain Selection', to: 'Jobs to Be Done (JTBD)', confidence: 0.85, phase_indicator: null },
    { from: 'Jobs to Be Done (JTBD)', to: 'PWS Value Proposition', confidence: 0.8, phase_indicator: null },
    { from: 'PWS Value Proposition', to: 'Lean Canvas', confidence: 0.75, phase_indicator: null }, // would be 5th -> truncated
  ];
  const walked = recommender.recommendFrameworkChain({
    currentFramework: 'Beautiful Question Framework',
    roomState: { feedsIntoEdges: edges },
  });
  assert.deepStrictEqual(walked, ['Beautiful Question Framework', 'Domain Selection', 'Jobs to Be Done (JTBD)', 'PWS Value Proposition']);
  assert.ok(walked.length <= 4, 'chain is capped at 4');

  // The same edges expressed as a BRAIN.md framework_chain_predictions section body.
  const sectionBody =
    'Beautiful Question Framework FEEDS_INTO Domain Selection (confidence: 0.9)\n' +
    'Domain Selection FEEDS_INTO Jobs to Be Done (JTBD) (confidence: 0.85)';
  const fromSection = recommender.recommendFrameworkChain({
    currentFramework: 'Beautiful Question Framework',
    roomState: { brainSection: { body: sectionBody } },
  });
  assert.deepStrictEqual(fromSection, ['Beautiful Question Framework', 'Domain Selection', 'Jobs to Be Done (JTBD)']);
});

// ---------------------------------------------------------------------------
// 3. seed with no outgoing FEEDS_INTO edge -> [seed]
// ---------------------------------------------------------------------------
test('a seed with no outgoing FEEDS_INTO edge degrades to [seed] (no crash, never null)', function () {
  const edges = [
    { from: 'Some Other Framework', to: 'Yet Another', confidence: 0.9, phase_indicator: null },
  ];
  const chain = recommender.recommendFrameworkChain({
    currentFramework: 'Beautiful Question Framework',
    roomState: { feedsIntoEdges: edges },
  });
  assert.deepStrictEqual(chain, ['Beautiful Question Framework']);

  // An edge below the composer noise floor (< 0.5) is not followed either.
  const lowConf = [{ from: 'Beautiful Question Framework', to: 'Domain Selection', confidence: 0.3, phase_indicator: null }];
  assert.deepStrictEqual(
    recommender.recommendFrameworkChain({ currentFramework: 'Beautiful Question Framework', roomState: { feedsIntoEdges: lowConf } }),
    ['Beautiful Question Framework']
  );

  // Empty / no roomState -> [seed].
  assert.deepStrictEqual(
    recommender.recommendFrameworkChain({ currentFramework: 'Beautiful Question Framework', roomState: {} }),
    ['Beautiful Question Framework']
  );
  assert.deepStrictEqual(
    recommender.recommendFrameworkChain({ currentFramework: 'Beautiful Question Framework' }),
    ['Beautiful Question Framework']
  );

  // No args at all -> the default seed, length 1.
  const def = recommender.recommendFrameworkChain();
  assert.ok(Array.isArray(def) && def.length >= 1 && typeof def[0] === 'string');
  assert.strictEqual(def[0], recommender.DEFAULT_SEED);
});

// ---------------------------------------------------------------------------
// 4. Brain unavailable -> still returns a chain; never throws, never null
// ---------------------------------------------------------------------------
test('Brain unavailable (isAvailable() -> false) still returns a chain; never throws, never null', function () {
  const orig = brainClient.isAvailable;
  try {
    brainClient.isAvailable = function () { return false; };
    const c1 = recommender.recommendFrameworkChain({ problemType: 'ill-defined' });
    assert.ok(Array.isArray(c1) && c1.length >= 1 && c1.every(function (x) { return typeof x === 'string'; }));
    assert.notStrictEqual(c1, null);
    const edges = [{ from: 'Beautiful Question Framework', to: 'Domain Selection', confidence: 0.9, phase_indicator: null }];
    const c2 = recommender.recommendFrameworkChain({ currentFramework: 'Beautiful Question Framework', roomState: { feedsIntoEdges: edges } });
    assert.deepStrictEqual(c2, ['Beautiful Question Framework', 'Domain Selection']);
  } finally {
    brainClient.isAvailable = orig;
  }
  // And with Brain "available" (the real isAvailable, which is false on a CI box
  // without a key -- so this also exercises the no-key path) it still works.
  const c3 = recommender.recommendFrameworkChain({ currentFramework: 'Beautiful Question Framework' });
  assert.deepStrictEqual(c3, ['Beautiful Question Framework']);
});

// ---------------------------------------------------------------------------
// 5. Canon Part 8: no command literal; Cypher carries only $-bound params; FW names only
// ---------------------------------------------------------------------------
test('Canon Part 8: chain-recommender source has no command literal; any Cypher uses only $-bound params', function () {
  const src = fs.readFileSync(RECOMMENDER_PATH, 'utf8');
  // No /mos: command literal anywhere (the pre-commit / 122-02 grep guard too).
  assert.ok(!/\/mos:/.test(src), 'no /mos: command literal in chain-recommender.cjs');

  // Any Cypher-looking string (a line containing MATCH ... FEEDS_INTO ...) must
  // bind its inputs as $-params, never interpolate them, and never carry a
  // command token or a user-content token.
  const lines = src.split(/\r?\n/);
  let sawCypher = false;
  for (const line of lines) {
    if (!/FEEDS_INTO/.test(line) || !/MATCH/i.test(line)) continue;
    sawCypher = true;
    assert.ok(/\$seed/.test(line) || /\$[a-zA-Z_]/.test(line), 'FEEDS_INTO Cypher binds inputs via $-params: ' + line.trim());
    assert.ok(!/\$\{/.test(line), 'no template-literal interpolation in the Cypher: ' + line.trim());
    assert.ok(!/\/mos:/.test(line), 'no command literal in the Cypher: ' + line.trim());
  }
  // The exported Cypher constant, if present, must also satisfy this.
  if (typeof recommender.FEEDS_INTO_CYPHER === 'string') {
    assert.ok(/\$seed/.test(recommender.FEEDS_INTO_CYPHER), 'FEEDS_INTO_CYPHER binds $seed');
    assert.ok(!/\$\{/.test(recommender.FEEDS_INTO_CYPHER), 'FEEDS_INTO_CYPHER has no template interpolation');
    assert.ok(!/\/mos:/.test(recommender.FEEDS_INTO_CYPHER), 'FEEDS_INTO_CYPHER has no command literal');
  }
  assert.ok(sawCypher || typeof recommender.FEEDS_INTO_CYPHER === 'string', 'a FEEDS_INTO Cypher template exists (source line or exported constant)');

  // The return value is framework names only -- never a command string.
  const chain = recommender.recommendFrameworkChain({ problemType: 'ill-defined' });
  assert.ok(chain.every(function (x) { return typeof x === 'string' && !/\/mos:/.test(x); }), 'returned chain is framework names, no command strings');

  // It reuses framework-chain-composer + problem-type-router (not hand-rolled).
  assert.ok(/framework-chain-composer/.test(src), 'requires framework-chain-composer');
  assert.ok(/problem-type-router/.test(src), 'requires problem-type-router');
});

// ---------------------------------------------------------------------------
// Bonus: composeWorkflow(recommendFrameworkChain(...)) -- the resolver attaches commands
// ---------------------------------------------------------------------------
test('composeWorkflow(recommendFrameworkChain(...)) attaches commands (the resolver does it, not the recommender)', function () {
  const resolver = require('../workflow/command-resolver.cjs');
  const edges = [
    { from: 'Beautiful Question Framework', to: 'Domain Selection', confidence: 0.9, phase_indicator: null },
    { from: 'Domain Selection', to: 'Jobs to Be Done (JTBD)', confidence: 0.85, phase_indicator: null },
  ];
  const chain = recommender.recommendFrameworkChain({ currentFramework: 'Beautiful Question Framework', roomState: { feedsIntoEdges: edges } });
  const wf = resolver.composeWorkflow(chain);
  assert.strictEqual(wf.length, 3);
  assert.strictEqual(wf[0].step, 1);
  wf.forEach(function (s, i) { assert.strictEqual(s.step, i + 1); assert.ok('command' in s); assert.ok('optional' in s); });
  // All three of these frameworks ARE mapped post-retrofit -> commands filled.
  assert.ok(wf.every(function (s) { return s.command !== null; }));
});

process.stdout.write('\nchain-recommender.test.cjs: ' + passed + ' assertion groups PASSED\n');
process.exit(0);
