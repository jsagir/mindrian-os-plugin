'use strict';
// Phase 143.2-04 -- WFL-01 resolvability suite.
//
// The doctrine (Plan 02) anchors every push-family on its EXACT frontmatter
// framework name + late-binds the /mos: command through the resolver
// (commandsForFramework). This suite proves those named frameworks are LIVE in
// the registry: for each of the 6 push-family frameworks, commandsForFramework
// returns a NON-EMPTY array. It FAILS LOUDLY (non-zero, naming the framework) if
// any name resolves to [] -- the name-drift trap from AUDIT-3 (a hand-author
// writing a colloquial label, or a frontmatter name drifting, resolves to []).
//
// House rule: hyphens only, no em-dashes.

const assert = require('node:assert/strict');
const path = require('node:path');

const resolver = require(path.resolve(__dirname, '..', 'lib', 'workflow', 'command-resolver.cjs'));

// The 6 push-family frameworks -- EXACT names (verified live in
// data/framework-names.json). These are the WFL-01 anchors the doctrine names.
const PUSH_FAMILY_FRAMEWORKS = [
  'Reverse Salient Analysis',
  "Usher's Model of Cumulative Synthesis",
  'Four Lenses of Innovation',
  'HSI Semantic Surprise Analysis Assistant',
  'Six Thinking Hats',
  'Hypothesis-Driven Problem Solving',
];

let failures = 0;
for (const name of PUSH_FAMILY_FRAMEWORKS) {
  const cmds = resolver.commandsForFramework(name);
  assert.ok(
    Array.isArray(cmds),
    'WFL-01: commandsForFramework(' + JSON.stringify(name) + ') must return an array'
  );
  if (cmds.length === 0) {
    failures++;
    process.stderr.write(
      'WFL-01 FAIL: push-family framework resolves to EMPTY array (name drifted?): ' +
      JSON.stringify(name) + '\n'
    );
  }
}

assert.equal(
  failures,
  0,
  'WFL-01: ' + failures + ' push-family framework name(s) resolved to an empty command array; ' +
  'every push-family framework must resolve NON-EMPTY (a [] means a name drifted from data/framework-names.json)'
);

process.stdout.write('PASS test-push-frameworks-resolvable.cjs (WFL-01: all 6 push-family frameworks resolve to a non-empty command array)\n');
process.exit(0);
