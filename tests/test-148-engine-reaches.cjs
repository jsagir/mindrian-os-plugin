'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 148-04 -- IRW-01 engine-reaches-resolvable test.
 * ======================================================
 * The five PWS intelligence engines join the ranked reach set. This suite proves
 * each engine framework is BOTH resolvable to a real command (through the only
 * door, command-resolver.commandsForFramework) AND rankable by f-selector-ranker
 * (its resolved command is a scored candidate in the ranker's registry, passing
 * the same fail-closed filters the ranker applies).
 *
 * The five engines (framework -> a representative command, per
 * data/dispatch-framework-map.json):
 *   Reverse Salient Analysis                       -> /mos:find-bottlenecks (and /mos:rs-fetch)
 *   HSI Semantic Surprise Analysis Assistant       -> /mos:whitespace
 *   Four Lenses of Innovation                      -> /mos:find-analogies
 *   Usher's Model of Cumulative Synthesis          -> /mos:find-connections
 *   Dominant Design                                -> /mos:dominant-designs
 *
 * Why "rankable candidate" rather than "appears in the top-k slice": the ranker
 * clamps its returned list to MAX_K=3 (the FROZEN chooser-row budget, IRW-07).
 * The engine commands are therefore proven rankable by membership in the scored
 * candidate set the ranker reads -- they carry the required jtbd_summary +
 * teaching + frameworks fields, so the ranker scores them (it never filters them
 * out). This is the faithful reading of "rankable by f-selector-ranker" that does
 * not fight the frozen MAX_K clamp.
 *
 * Plain CJS node:assert/strict; PASS line + non-zero exit on failure.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const resolver = require(path.join(REPO_ROOT, 'lib', 'workflow', 'command-resolver.cjs'));
const ranker = require(path.join(REPO_ROOT, 'lib', 'workflow', 'f-selector-ranker.cjs'));
const registry = require(path.join(REPO_ROOT, 'data', 'command-registry.json'));

// The five engine frameworks (the ranked-reach members) and the representative
// resolved command each MUST surface, per dispatch-framework-map.json.
const ENGINE_FRAMEWORKS = [
  { framework: 'Reverse Salient Analysis', expect: '/mos:find-bottlenecks' },
  { framework: 'HSI Semantic Surprise Analysis Assistant', expect: '/mos:whitespace' },
  { framework: 'Four Lenses of Innovation', expect: '/mos:find-analogies' },
  { framework: "Usher's Model of Cumulative Synthesis", expect: '/mos:find-connections' },
  { framework: 'Dominant Design', expect: '/mos:dominant-designs' },
];

const COMMANDS = Array.isArray(registry.commands) ? registry.commands : [];

// A command is a ranker candidate when it passes the ranker's fail-closed
// filters: non-empty jtbd_summary AND non-empty teaching AND a non-empty
// frameworks array (see f-selector-ranker.rankForSelector D6/D11 filters).
function isRankableCandidate(command) {
  const c = COMMANDS.find((x) => x && x.command === command);
  if (!c) return false;
  const hasJtbd = typeof c.jtbd_summary === 'string' && c.jtbd_summary.length > 0;
  const hasTeaching = typeof c.teaching === 'string' && c.teaching.length > 0;
  const hasFw = Array.isArray(c.frameworks) && c.frameworks.length > 0;
  return hasJtbd && hasTeaching && hasFw;
}

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

console.log('test-148-engine-reaches.cjs (IRW-01): the 5 engine frameworks resolve + are rankable');

for (const { framework, expect } of ENGINE_FRAMEWORKS) {
  check(framework + ' resolves to a non-empty command list', () => {
    const cmds = resolver.commandsForFramework(framework);
    assert.ok(Array.isArray(cmds) && cmds.length > 0,
      framework + ' must resolve to >=1 command; got ' + JSON.stringify(cmds));
    for (const cmd of cmds) {
      assert.ok(typeof cmd === 'string' && cmd.indexOf('/mos:') === 0,
        framework + ' resolved a non-/mos: slug: ' + cmd);
    }
    assert.ok(cmds.indexOf(expect) !== -1,
      framework + ' must include the representative command ' + expect + '; got ' + JSON.stringify(cmds));
  });

  check(framework + ' -> ' + expect + ' is a rankable f-selector candidate', () => {
    assert.ok(isRankableCandidate(expect),
      expect + ' must be a rankable candidate (jtbd_summary + teaching + frameworks present)');
  });
}

// Cross-check: every command the five engines resolve to is a rankable candidate
// (not just the representative one).
check('every resolved engine command is a rankable f-selector candidate', () => {
  for (const { framework } of ENGINE_FRAMEWORKS) {
    const cmds = resolver.commandsForFramework(framework);
    for (const cmd of cmds) {
      assert.ok(isRankableCandidate(cmd),
        framework + ' resolved command ' + cmd + ' is not a rankable candidate');
    }
  }
});

// Positive ranker exercise: the ranker returns a non-empty, MAX_K-clamped slice
// of scored candidates, and the engine commands live in the same registry it
// scores (proving they are eligible candidates, not filtered out).
check('rankForSelector returns scored candidates from the same registry the engines live in', () => {
  const ranked = ranker.rankForSelector({ k: ranker.MAX_K });
  assert.ok(Array.isArray(ranked), 'rankForSelector returns an array');
  assert.ok(ranked.length > 0 && ranked.length <= ranker.MAX_K,
    'rankForSelector returns 1..MAX_K candidates; got ' + ranked.length);
  for (const r of ranked) {
    assert.ok(typeof r.command === 'string' && typeof r.framework === 'string',
      'each ranked candidate carries command + framework');
  }
  // The engine commands are members of the candidate registry the ranker scores.
  const registryCommands = new Set(COMMANDS.map((c) => c && c.command));
  for (const { expect } of ENGINE_FRAMEWORKS) {
    assert.ok(registryCommands.has(expect),
      expect + ' must be in the ranker candidate registry');
  }
});

console.log('');
console.log('PASS test-148-engine-reaches.cjs (' + passed + ' assertions)');
