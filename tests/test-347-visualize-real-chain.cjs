#!/usr/bin/env node
'use strict';
/*
 * tests/test-347-visualize-real-chain.cjs -- Phase 347-09.
 *
 * Task 1 (behaviors 1-7): generateMermaidChain's additive routing render --
 * labelled conditional arrows, a fan-out subgraph, a halt node and a
 * reviewer node, every one driven by an OPTIONAL field on the step object,
 * with the undeclared/linear render pinned byte-identical by a frozen
 * expected string (the floor every later plan must keep).
 *
 * Task 2 (behaviors 1-7, appended below): the visualize-chain router
 * sub-case repointed at the real resolved chain and the real recorded run,
 * the hardcoded six-step literal deleted, and an honest empty statement
 * when nothing has been recorded.
 *
 * Plain node:assert CJS script. Hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const visualOps = require(path.join(REPO, 'lib', 'core', 'visual-ops.cjs'));
const { generateMermaidChain, DS_HEX } = visualOps;

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

// ---------------------------------------------------------------------------
// Task 1: generateMermaidChain
// ---------------------------------------------------------------------------

// ---- Test 1: the no-routing floor, byte-frozen. ----
function test1Floor() {
  const steps = [
    { name: 'Diagnose', framework: 'diagnose', status: 'pending' },
    { name: 'Apply', framework: '', status: 'complete' },
    { name: 'File', framework: '', status: 'running' }
  ];
  const out = generateMermaidChain(steps);
  const expected = 'graph TD\n'
    + '  Diagnose["Diagnose [diagnose]"]\n'
    + '  Apply["Apply"]\n'
    + '  Diagnose --> Apply\n'
    + '  File["File"]\n'
    + '  Apply --> File\n'
    + '\n'
    + '  style Diagnose fill:' + DS_HEX.muted + ',color:' + DS_HEX.cream + ',stroke:' + DS_HEX.cream + '\n'
    + '  style Apply fill:' + DS_HEX.green + ',color:' + DS_HEX.cream + ',stroke:' + DS_HEX.cream + '\n'
    + '  style File fill:' + DS_HEX.yellow + ',color:' + DS_HEX.cream + ',stroke:' + DS_HEX.cream;
  assert.strictEqual(out, expected, 'a step array with no routing fields renders byte-identical to the pre-change output');
  ok('Test 1: no-routing floor is byte-frozen');
}

// ---- Test 2: on_pass + on_fail draw two labelled arrows. ----
function test2Conditional() {
  const steps = [
    { name: 'Gate', on_pass: 'Apply', on_fail: 'Retry' },
    { name: 'Apply' },
    { name: 'Retry' }
  ];
  const out = generateMermaidChain(steps);
  assert.match(out, /Gate -->\|pass\| Apply/, 'a labelled pass arrow leaves the declaring step');
  assert.match(out, /Gate -->\|fail\| Retry/, 'a labelled fail arrow leaves the declaring step');
  assert.doesNotMatch(out, /Gate --> Apply\n/, 'the default unlabelled arrow is suppressed once routing is declared');
  ok('Test 2: on_pass and on_fail render two labelled arrows out of the declaring node');
}

// ---- Test 3: fan_out renders a subgraph with one coordinator arrow. ----
function test3FanOut() {
  const steps = [{ name: 'Diagnose', fan_out: ['Domain A', 'Domain B'] }];
  const out = generateMermaidChain(steps);
  assert.match(out, /subgraph Diagnose_fanout \[Fan-out\]/, 'a subgraph block is opened for the fan-out');
  assert.match(out, /Domain_A\["Domain A"\]/, 'the first fan-out target is a node inside the subgraph');
  assert.match(out, /Domain_B\["Domain B"\]/, 'the second fan-out target is a node inside the subgraph');
  assert.match(out, /\n {2}end\n/, 'the subgraph block is closed');
  assert.match(out, /Diagnose --> Diagnose_fanout/, 'exactly one arrow runs from the coordinator into the subgraph');
  ok('Test 3: fan_out renders a Mermaid subgraph containing the fan-out targets');
}

// ---- Test 4: a halted trace renders a red halt node with the reason. ----
function test4Halt() {
  const steps = [
    { name: 'Diagnose' },
    { name: 'Apply', halted: true, halt_reason: 'quality_early_stop' }
  ];
  const out = generateMermaidChain(steps);
  assert.match(out, /Apply_halt\["Halted: quality_early_stop"\]/, 'the halt node carries the recorded reason');
  assert.match(out, new RegExp('style Apply_halt fill:' + DS_HEX.red.replace('#', '\\#')), 'the halt node is styled with DS_HEX.red');
  assert.match(out, /Apply --> Apply_halt/, 'the halt node is attached to the step that halted');
  ok('Test 4: a halted run renders a DS_HEX.red halt node carrying the halt reason');
}

// ---- Test 5: a reviewer renders a distinctly styled node naming its kind. ----
function test5Reviewer() {
  const steps = [{ name: 'Diagnose', reviewer: { kind: 'navigator' } }];
  const out = generateMermaidChain(steps);
  assert.match(out, /Diagnose_reviewer\["Reviewer: navigator"\]/, 'the reviewer node names the reviewer kind');
  assert.match(out, new RegExp('style Diagnose_reviewer fill:' + DS_HEX.amethyst.replace('#', '\\#')), 'the reviewer node is distinctly styled');
  assert.doesNotMatch(
    out.split('style Diagnose_reviewer')[1] || '',
    new RegExp(DS_HEX.green.replace('#', '\\#') + '|' + DS_HEX.red.replace('#', '\\#')),
    'the reviewer style is not a status color'
  );
  ok('Test 5: a reviewer renders a distinctly styled node naming navigator or subagent');
}

// ---- Test 6: the empty-array floor is unchanged. ----
function test6Empty() {
  const out = generateMermaidChain([]);
  assert.strictEqual(out, 'graph TD\n  empty[No chain data]', 'an empty step array still returns the existing empty marker');
  ok('Test 6: an empty step array renders the unchanged empty marker');
}

// ---- Test 7: no em-dash, every color a DS_HEX member. ----
function test7Palette() {
  const steps = [
    { name: 'Gate', on_pass: 'Apply', on_fail: 'Retry', fan_out: ['X'], halted: true, halt_reason: 'r', reviewer: { kind: 'subagent' } },
    { name: 'Apply' },
    { name: 'Retry' }
  ];
  const out = generateMermaidChain(steps);
  assert.strictEqual(out.indexOf('—'), -1, 'no label contains an em-dash');
  const hexLiterals = out.match(/#[0-9a-fA-F]{6}/g) || [];
  const dsHexValues = new Set(Object.values(DS_HEX).filter((v) => typeof v === 'string'));
  for (const hex of hexLiterals) {
    assert.ok(dsHexValues.has(hex), 'every rendered color (' + hex + ') is a member of DS_HEX');
  }
  ok('Test 7: no em-dash anywhere, and every rendered color is a DS_HEX member');
}

test1Floor();
test2Conditional();
test3FanOut();
test4Halt();
test5Reviewer();
test6Empty();
test7Palette();

console.log('\n' + checks + ' checks passed (Task 1: generateMermaidChain)');
process.exit(0);
