#!/usr/bin/env node
'use strict';

/**
 * Phase 122-03 -- command-resolver tests (real suite; fills the 122-01 Wave-0 stub).
 *
 * Registered in lib/memory/run-feynman-tests.cjs TEST_FILES[] (since 122-01,
 * unchanged path). Run: node lib/workflow/command-resolver.test.cjs
 * Exit 0 on pass; throws (node:assert) on any fail.
 *
 * Seven assertion groups (per 122-03-PLAN.md Task 1 <behavior>):
 *   1. commandsForFramework -- known framework returns its array; unknown -> [].
 *   2. frameworksForCommand -- known command returns its frameworks; unknown -> [].
 *   3. composeWorkflow -- step/framework/command/optional shape, 1-indexed, in
 *      order; []/non-array -> [].
 *   4. composeWorkflow on a deliberately command-less framework ("Red Teaming")
 *      -> { step:1, framework:"Red Teaming", command:null, optional:true }.
 *   5. validateChainAutonomy -- /mos:hat-briefing (autonomous_safe: false) is a
 *      blocker; an all-autonomous_safe chain -> { runnable:true, blockers:[] };
 *      command:null steps are skipped.
 *   6. Degrade -- MINDRIAN_COMMAND_REGISTRY pointed at a nonexistent file +
 *      __reset() -> empty registry, every function empty, no throw.
 *   7. No-Brain -- the resolver source contains no require() of brain-client,
 *      no fetch(, no require('node:http'/'node:https').
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const RESOLVER_PATH = path.join(__dirname, 'command-resolver.cjs');
const REGISTRY_PATH = path.join(REPO_ROOT, 'data', 'command-registry.json');

// The real registry (read directly so the test asserts the COMPOSITION SHAPE
// against the committed artifact rather than hardcoding command strings that
// the 122-01 retrofit could legitimately tweak).
const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
const frameworkIndex = registry.framework_index || {};
const commandsByName = new Map(registry.commands.map(function (c) { return [c.command, c]; }));

const resolver = require('./command-resolver.cjs');

let passed = 0;
function test(name, fn) {
  fn();
  process.stdout.write('  ok  ' + name + '\n');
  passed += 1;
}

// Pick a real framework that has at least one command, deterministically (first
// key in the index whose value is a non-empty array). Keeps the test
// retrofit-proof.
const mappedFramework = Object.keys(frameworkIndex).find(function (k) {
  return Array.isArray(frameworkIndex[k]) && frameworkIndex[k].length > 0;
});
assert.ok(mappedFramework, 'registry framework_index must contain at least one mapped framework');

// ---------------------------------------------------------------------------
// 1. commandsForFramework
// ---------------------------------------------------------------------------
test('commandsForFramework returns the registry framework_index array for a known framework', function () {
  const got = resolver.commandsForFramework(mappedFramework);
  assert.deepStrictEqual(got, frameworkIndex[mappedFramework]);
  assert.ok(Array.isArray(got) && got.length > 0);
});

test('commandsForFramework returns [] for an unknown framework / empty / non-string', function () {
  assert.deepStrictEqual(resolver.commandsForFramework('No Such Framework XYZ'), []);
  assert.deepStrictEqual(resolver.commandsForFramework(''), []);
  assert.deepStrictEqual(resolver.commandsForFramework(undefined), []);
  assert.deepStrictEqual(resolver.commandsForFramework(null), []);
});

// ---------------------------------------------------------------------------
// 2. frameworksForCommand
// ---------------------------------------------------------------------------
test('frameworksForCommand returns the frameworks array from that command entry', function () {
  const methCmd = registry.commands.find(function (c) {
    return Array.isArray(c.frameworks) && c.frameworks.length > 0;
  });
  assert.ok(methCmd, 'registry must contain a command with a non-empty frameworks list');
  assert.deepStrictEqual(resolver.frameworksForCommand(methCmd.command), methCmd.frameworks);
});

test('frameworksForCommand returns [] for an unknown command / empty / non-string', function () {
  assert.deepStrictEqual(resolver.frameworksForCommand('/mos:no-such-command-xyz'), []);
  assert.deepStrictEqual(resolver.frameworksForCommand(''), []);
  assert.deepStrictEqual(resolver.frameworksForCommand(undefined), []);
});

// ---------------------------------------------------------------------------
// 3. composeWorkflow -- shape, 1-indexed, in order
// ---------------------------------------------------------------------------
test('composeWorkflow returns 1-indexed in-order { step, framework, command|null, optional } steps', function () {
  // The spec acceptance example -- all three frameworks ARE mapped post-retrofit.
  const chain = ['Beautiful Question Framework', 'Domain Selection', 'Jobs to Be Done (JTBD)'];
  const wf = resolver.composeWorkflow(chain);
  assert.strictEqual(wf.length, 3);
  wf.forEach(function (s, i) {
    assert.strictEqual(s.step, i + 1);
    assert.strictEqual(s.framework, chain[i]);
    assert.ok('command' in s);
    assert.ok('optional' in s);
    const cmds = frameworkIndex[chain[i]] || [];
    if (cmds.length > 0) {
      assert.strictEqual(s.command, cmds[0]);
      assert.strictEqual(s.optional, false);
    } else {
      assert.strictEqual(s.command, null);
      assert.strictEqual(s.optional, true);
    }
  });
  // The spec example expects all three filled.
  assert.ok(wf.every(function (s) { return s.command !== null && s.optional === false; }),
    'the spec acceptance example expects all three frameworks to resolve to a command');
});

test('composeWorkflow inverse-of-framework_index consistency for every mapped framework', function () {
  const allMapped = Object.keys(frameworkIndex).filter(function (k) {
    return Array.isArray(frameworkIndex[k]) && frameworkIndex[k].length > 0;
  });
  const wf = resolver.composeWorkflow(allMapped);
  assert.strictEqual(wf.length, allMapped.length);
  wf.forEach(function (s, i) {
    assert.strictEqual(s.command, frameworkIndex[allMapped[i]][0]);
    assert.strictEqual(s.optional, false);
  });
});

test('composeWorkflow on [] returns []; on a non-array returns []', function () {
  assert.deepStrictEqual(resolver.composeWorkflow([]), []);
  assert.deepStrictEqual(resolver.composeWorkflow(null), []);
  assert.deepStrictEqual(resolver.composeWorkflow(undefined), []);
  assert.deepStrictEqual(resolver.composeWorkflow('not an array'), []);
  assert.deepStrictEqual(resolver.composeWorkflow(42), []);
});

// ---------------------------------------------------------------------------
// 4. command-less framework degrades, does not fabricate
// ---------------------------------------------------------------------------
test('composeWorkflow(["Red Teaming"]) degrades to { command:null, optional:true } (no fabricated command)', function () {
  // "Red Teaming" is intentionally command-less per the spec.
  assert.ok(!(frameworkIndex['Red Teaming'] && frameworkIndex['Red Teaming'].length > 0),
    'Red Teaming must remain command-less for this assertion to be meaningful');
  const wf = resolver.composeWorkflow(['Red Teaming']);
  assert.deepStrictEqual(wf, [{ step: 1, framework: 'Red Teaming', command: null, optional: true }]);
});

// ---------------------------------------------------------------------------
// 5. validateChainAutonomy
// ---------------------------------------------------------------------------
test('validateChainAutonomy flags a non-autonomous_safe command (/mos:hat-briefing) as a blocker', function () {
  const hb = commandsByName.get('/mos:hat-briefing');
  assert.ok(hb, 'registry must contain /mos:hat-briefing');
  assert.strictEqual(hb.autonomous_safe, false, '/mos:hat-briefing must be autonomous_safe: false');
  const v = resolver.validateChainAutonomy([
    { step: 1, command: '/mos:hat-briefing' },
    { step: 2, command: '/mos:analyze-needs' },
  ]);
  assert.strictEqual(v.runnable, false);
  assert.ok(v.blockers.some(function (b) {
    return b.step === 1 && b.command === '/mos:hat-briefing' && b.reason === 'not autonomous_safe';
  }));
});

test('validateChainAutonomy on an all-autonomous_safe chain returns { runnable:true, blockers:[] }', function () {
  const safeCmds = registry.commands.filter(function (c) { return c.autonomous_safe === true; }).slice(0, 3);
  assert.ok(safeCmds.length >= 2, 'registry must contain at least 2 autonomous_safe commands');
  const wf = safeCmds.map(function (c, i) { return { step: i + 1, command: c.command }; });
  const v = resolver.validateChainAutonomy(wf);
  assert.deepStrictEqual(v, { runnable: true, blockers: [] });
});

test('validateChainAutonomy skips command:null steps (they are not blockers)', function () {
  const v = resolver.validateChainAutonomy([
    { step: 1, command: null },
    { step: 2, command: '/mos:analyze-needs' }, // autonomous_safe: true
  ]);
  assert.strictEqual(v.runnable, true);
  assert.deepStrictEqual(v.blockers, []);
  const v2 = resolver.validateChainAutonomy([
    { step: 1, command: null },
    { step: 2, command: '/mos:hat-briefing' },
  ]);
  assert.strictEqual(v2.runnable, false);
  assert.strictEqual(v2.blockers.length, 1);
  assert.strictEqual(v2.blockers[0].step, 2);
});

test('validateChainAutonomy on []/non-array/undefined returns { runnable:true, blockers:[] }', function () {
  assert.deepStrictEqual(resolver.validateChainAutonomy([]), { runnable: true, blockers: [] });
  assert.deepStrictEqual(resolver.validateChainAutonomy(undefined), { runnable: true, blockers: [] });
  assert.deepStrictEqual(resolver.validateChainAutonomy(null), { runnable: true, blockers: [] });
});

// ---------------------------------------------------------------------------
// 6. Degrade -- missing registry -> empty results, no throw
// ---------------------------------------------------------------------------
test('a missing / unreadable registry degrades every function to empty results (no throw)', function () {
  const prev = process.env.MINDRIAN_COMMAND_REGISTRY;
  try {
    process.env.MINDRIAN_COMMAND_REGISTRY = path.join(REPO_ROOT, 'data', '__nonexistent_registry__.json');
    resolver.__reset();
    assert.deepStrictEqual(resolver.commandsForFramework('Beautiful Question Framework'), []);
    assert.deepStrictEqual(resolver.frameworksForCommand('/mos:analyze-needs'), []);
    assert.deepStrictEqual(resolver.composeWorkflow(['Beautiful Question Framework', 'Red Teaming']),
      [
        { step: 1, framework: 'Beautiful Question Framework', command: null, optional: true },
        { step: 2, framework: 'Red Teaming', command: null, optional: true },
      ]);
    assert.deepStrictEqual(resolver.validateChainAutonomy([{ step: 1, command: '/mos:analyze-needs' }]),
      { runnable: false, blockers: [{ step: 1, command: '/mos:analyze-needs', reason: 'not autonomous_safe' }] });
  } finally {
    if (prev === undefined) { delete process.env.MINDRIAN_COMMAND_REGISTRY; }
    else { process.env.MINDRIAN_COMMAND_REGISTRY = prev; }
    resolver.__reset();
  }
  // Sanity: back to the real registry after reset.
  assert.ok(resolver.commandsForFramework(mappedFramework).length > 0);
});

// ---------------------------------------------------------------------------
// 7. No-Brain -- the resolver source is a pure local reader
// ---------------------------------------------------------------------------
test('command-resolver.cjs source contains no brain-client require, no fetch(, no node:http(s) require', function () {
  const src = fs.readFileSync(RESOLVER_PATH, 'utf8');
  assert.ok(!/brain-client/.test(src), 'resolver must not reference brain-client');
  assert.ok(!/\bfetch\s*\(/.test(src), 'resolver must not call fetch()');
  assert.ok(!/require\(\s*['"]node:https?['"]\s*\)/.test(src), 'resolver must not require node:http / node:https');
  assert.ok(!/require\(\s*['"]https?['"]\s*\)/.test(src), 'resolver must not require http / https');
});

process.stdout.write('\ncommand-resolver.test.cjs: ' + passed + ' assertion groups PASSED\n');
process.exit(0);
