#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 122-04 -- navigation-hook-resolver tests (new suite; registered in the Feynman runner).
 * ============================================================================================
 * Asserts the ONE surgical edit in lib/core/framework-chain-composer.cjs:
 * proposeNextFramework() now resolves the next framework's /mos: command via
 * lib/workflow/command-resolver.cjs commandsForFramework() (the only door),
 * degrades to command:null when the registry has no command for it (degrade,
 * do not fabricate -- WORKFLOW-LAYER-SPEC reliability rule 5), and carries a
 * workflow array (the resolver's composeWorkflow for the multi-hop chain) as
 * data on the proposal. mapFrameworkToCommandSlug() delegates to the resolver.
 * The navigation engine / offer presenter / hooks are NOT touched.
 *
 * Registered in lib/memory/run-feynman-tests.cjs TEST_FILES[] and in
 * tests/run-all-122.sh CJS_SUITES (as ../lib/memory/navigation-hook-resolver.test.cjs).
 * Run: node lib/memory/navigation-hook-resolver.test.cjs
 * Exit 0 on pass; throws (node:assert) on any fail.
 *
 * Assertion groups:
 *   1. framework-chain-composer.cjs source requires ../workflow/command-resolver
 *      (the surgical edit is in place) and references composeWorkflow.
 *   2. proposeNextFramework(completed, edges).command === commandsForFramework(next)[0]
 *      (or null when there is none). Tested on a registered next framework
 *      (Business Model Canvas -> Lean Canvas -> /mos:lean-canvas) and an
 *      unregistered one (X -> A Wholly Imaginary Framework -> null).
 *   3. proposeNextFramework returns a workflow array shaped like composeWorkflow
 *      ([{ step, framework, command|null, optional }], 1-indexed, in order),
 *      and for a multi-hop FEEDS_INTO chain it includes the successors.
 *   4. mapFrameworkToCommandSlug delegates to the resolver (a registered
 *      framework slug round-trips), falls back to the legacy table for an
 *      unknown name, and stays exported alongside FRAMEWORK_TO_COMMAND_SLUG
 *      and KNOWN_FRAMEWORKS (122-05 prunes the legacy table, not this plan).
 *   5. The engine / presenter / hooks are NOT touched: framework-chain-composer.cjs
 *      is the only file that gained the resolver require (we assert the
 *      navigation-engine source did NOT gain a command-resolver require).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const COMPOSER_PATH = path.join(REPO_ROOT, 'lib', 'core', 'framework-chain-composer.cjs');
const ENGINE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'navigation-engine.cjs');

const composer = require('../core/framework-chain-composer.cjs');
const resolver = require('../workflow/command-resolver.cjs');

let passed = 0;
function test(name, fn) {
  fn();
  process.stdout.write('  ok  ' + name + '\n');
  passed += 1;
}

// ---------------------------------------------------------------------------
// 1. the surgical edit is in place (source requires the resolver)
// ---------------------------------------------------------------------------
test('framework-chain-composer.cjs requires ../workflow/command-resolver and references composeWorkflow', function () {
  const src = fs.readFileSync(COMPOSER_PATH, 'utf8');
  assert.ok(/require\(['"]\.\.\/workflow\/command-resolver(\.cjs)?['"]\)/.test(src),
    'framework-chain-composer.cjs must require ../workflow/command-resolver');
  assert.ok(/command-resolver/.test(src), 'source mentions command-resolver');
  assert.ok(/composeWorkflow/.test(src), 'source mentions composeWorkflow (the multi-step path)');
});

// ---------------------------------------------------------------------------
// 2. proposeNextFramework.command === resolver answer (or null)
// ---------------------------------------------------------------------------
test('proposeNextFramework.command === commandsForFramework(next)[0] (or null when there is none)', function () {
  // Registered next framework: Lean Canvas -> /mos:lean-canvas.
  const registeredEdges = [
    { from: 'Business Model Canvas', to: 'Lean Canvas', confidence: 0.85, phase_indicator: 'thesis' },
  ];
  const p = composer.proposeNextFramework('Business Model Canvas', registeredEdges);
  assert.ok(p !== null, 'a 0.85-confidence edge yields a proposal');
  const expected = resolver.commandsForFramework('Lean Canvas');
  assert.strictEqual(p.command, expected.length > 0 ? expected[0] : null,
    'command must equal commandsForFramework(next)[0]; got: ' + p.command);
  assert.ok(typeof p.command === 'string' && p.command.indexOf('/mos:') === 0,
    'Lean Canvas IS registered, so command must be a /mos: string; got: ' + p.command);

  // Unregistered next framework -> command is null (degrade, not fabricate).
  const unregEdges = [
    { from: 'X', to: 'A Wholly Imaginary Framework', confidence: 0.8, phase_indicator: null },
  ];
  const u = composer.proposeNextFramework('X', unregEdges);
  assert.ok(u !== null, 'a 0.8-confidence edge yields a proposal even when the next has no command');
  assert.strictEqual(u.command, null, 'unregistered next framework -> command:null; got: ' + u.command);
  // It still matches the resolver: commandsForFramework returns [] for it.
  assert.deepStrictEqual(resolver.commandsForFramework('A Wholly Imaginary Framework'), []);
});

// ---------------------------------------------------------------------------
// 3. proposeNextFramework.workflow is a composeWorkflow-shaped array
// ---------------------------------------------------------------------------
test('proposeNextFramework.workflow is a composeWorkflow array; a multi-hop chain includes the successors', function () {
  // Single hop: workflow = composeWorkflow([completed, next]).
  const single = composer.proposeNextFramework('Business Model Canvas', [
    { from: 'Business Model Canvas', to: 'Lean Canvas', confidence: 0.85, phase_indicator: null },
  ]);
  assert.ok(Array.isArray(single.workflow), 'workflow is an array');
  assert.ok(single.workflow.length >= 2, 'workflow includes [completed, next]');
  single.workflow.forEach(function (s, i) {
    assert.strictEqual(s.step, i + 1, 'workflow is 1-indexed and in order');
    assert.ok('framework' in s && 'command' in s && 'optional' in s, 'workflow step shape');
    assert.ok(s.command === null || (typeof s.command === 'string' && s.command.indexOf('/mos:') === 0),
      'workflow step command is a /mos: string or null');
  });
  assert.strictEqual(single.workflow[0].framework, 'Business Model Canvas');
  assert.strictEqual(single.workflow[1].framework, 'Lean Canvas');

  // Multi-hop FEEDS_INTO: BQ -> Domain Selection -> JTBD. The workflow walks
  // the highest-confidence chain and composeWorkflow attaches the commands.
  const multi = composer.proposeNextFramework('Beautiful Question Framework', [
    { from: 'Beautiful Question Framework', to: 'Domain Selection', confidence: 0.9, phase_indicator: null },
    { from: 'Domain Selection', to: 'Jobs to Be Done (JTBD)', confidence: 0.85, phase_indicator: null },
    { from: 'Jobs to Be Done (JTBD)', to: 'PWS Value Proposition', confidence: 0.8, phase_indicator: null },
  ]);
  assert.ok(Array.isArray(multi.workflow));
  // [completed, +3 hops] -> 4 steps (collectForwardChain caps at 3 hops).
  assert.strictEqual(multi.workflow.length, 4, 'workflow includes the 3-hop chain; got ' + multi.workflow.length);
  assert.deepStrictEqual(multi.workflow.map(function (s) { return s.framework; }),
    ['Beautiful Question Framework', 'Domain Selection', 'Jobs to Be Done (JTBD)', 'PWS Value Proposition']);
  // And the workflow equals what the resolver would compose for that chain.
  assert.deepStrictEqual(multi.workflow,
    resolver.composeWorkflow(['Beautiful Question Framework', 'Domain Selection', 'Jobs to Be Done (JTBD)', 'PWS Value Proposition']));

  // composer.collectForwardChain is also directly exercisable.
  assert.deepStrictEqual(
    composer.collectForwardChain('Beautiful Question Framework', [
      { from: 'Beautiful Question Framework', to: 'Domain Selection', confidence: 0.9 },
      { from: 'Domain Selection', to: 'Jobs to Be Done (JTBD)', confidence: 0.85 },
    ], 3),
    ['Beautiful Question Framework', 'Domain Selection', 'Jobs to Be Done (JTBD)']
  );
});

// ---------------------------------------------------------------------------
// 4. mapFrameworkToCommandSlug delegates to the resolver; exports preserved
// ---------------------------------------------------------------------------
test('mapFrameworkToCommandSlug delegates to the resolver; FRAMEWORK_TO_COMMAND_SLUG + KNOWN_FRAMEWORKS still exported', function () {
  // A registered framework: the slug round-trips through the resolver.
  const cmds = resolver.commandsForFramework('Lean Canvas');
  assert.ok(cmds.length > 0);
  assert.strictEqual(composer.mapFrameworkToCommandSlug('Lean Canvas'), cmds[0].replace(/^\/mos:/, ''));
  assert.strictEqual(composer.mapFrameworkToCommandSlug('Domain Selection'),
    resolver.commandsForFramework('Domain Selection')[0].replace(/^\/mos:/, ''));
  // An unknown name: falls back to the legacy table / FALLBACK_COMMAND_SLUG.
  assert.strictEqual(composer.mapFrameworkToCommandSlug('A Wholly Imaginary Framework'), composer.FALLBACK_COMMAND_SLUG);
  assert.strictEqual(typeof composer.mapFrameworkToCommandSlug('Lean Canvas'), 'string',
    'mapFrameworkToCommandSlug always returns a slug string (it keeps a non-null fallback)');
  // Exports preserved (122-05 prunes FRAMEWORK_TO_COMMAND_SLUG; not this plan).
  assert.strictEqual(typeof composer.proposeNextFramework, 'function');
  assert.strictEqual(typeof composer.mapFrameworkToCommandSlug, 'function');
  assert.ok(composer.FRAMEWORK_TO_COMMAND_SLUG && typeof composer.FRAMEWORK_TO_COMMAND_SLUG === 'object');
  assert.ok(Array.isArray(composer.KNOWN_FRAMEWORKS) && composer.KNOWN_FRAMEWORKS.length > 0);
});

// ---------------------------------------------------------------------------
// 5. the engine / presenter / hooks are NOT touched (only the composer gained the resolver require)
// ---------------------------------------------------------------------------
test('navigation-engine.cjs did NOT gain a command-resolver require (the surgical edit is composer-only)', function () {
  const engineSrc = fs.readFileSync(ENGINE_PATH, 'utf8');
  assert.ok(!/command-resolver/.test(engineSrc),
    'navigation-engine.cjs must not require command-resolver (the resolver wiring is in framework-chain-composer.cjs only)');
  // Sanity: the composer's require IS there (the only file that should have it among these two).
  const composerSrc = fs.readFileSync(COMPOSER_PATH, 'utf8');
  assert.ok(/command-resolver/.test(composerSrc));
});

process.stdout.write('\nnavigation-hook-resolver.test.cjs: ' + passed + ' assertion groups PASSED\n');
process.exit(0);
