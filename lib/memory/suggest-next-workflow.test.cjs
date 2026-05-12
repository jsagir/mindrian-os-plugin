#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 122-04 -- suggest-next-workflow integration test (new suite; registered in the Feynman runner).
 * ====================================================================================================
 * The end-to-end check for the Workflow Layer's user-facing slice:
 *   - a fixture room with a ProblemType -> /mos:suggest-next returns a COMMAND
 *     SEQUENCE (a step-numbered framework list AND at least one /mos: token),
 *     and every /mos: it emits exists in data/command-registry.json (no
 *     hallucinated command);
 *   - a synthetic chain that includes /mos:hat-briefing -> validateChainAutonomy
 *     reports it as a blocker (the /mos:act --chain stop point);
 *   - /mos:pipeline --from-problem-type <x> derives a Brain-derived command
 *     chain (the helper prints a run order of registered /mos: commands);
 *   - /mos:act --chain stops at the first non-autonomous_safe step (here,
 *     /mos:hat-briefing for Six Thinking Hats).
 *
 * Hermetic: a tmp room dir + a STATE.md with "Problem Type: ill-defined" (no
 * network -- recommendFrameworkChain degrades to [seed] without offline edges,
 * and that seed is what the room's ProblemType maps to via problem-type-router).
 *
 * Registered in lib/memory/run-feynman-tests.cjs TEST_FILES[] and in
 * tests/run-all-122.sh CJS_SUITES (as ../lib/memory/suggest-next-workflow.test.cjs).
 * Run: node lib/memory/suggest-next-workflow.test.cjs
 * Exit 0 on pass; throws (node:assert) on any fail.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const REGISTRY_PATH = path.join(REPO_ROOT, 'data', 'command-registry.json');
const SUGGEST_SCRIPT = path.join(REPO_ROOT, 'scripts', 'suggest-next-command.cjs');
const PIPELINE_SCRIPT = path.join(REPO_ROOT, 'scripts', 'pipeline-command.cjs');
const ACT_SCRIPT = path.join(REPO_ROOT, 'scripts', 'act-command.cjs');

const resolver = require('../workflow/command-resolver.cjs');
const recommender = require('../brain/chain-recommender.cjs');

const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
const REGISTERED_COMMANDS = new Set((registry.commands || []).map(function (c) { return c && c.command; }));

let passed = 0;
function test(name, fn) {
  fn();
  process.stdout.write('  ok  ' + name + '\n');
  passed += 1;
}

// Extract /mos:... tokens from a string.
function extractCommands(text) {
  const m = String(text).match(/\/mos:[a-z][a-z0-9-]*/g);
  return m ? m.slice() : [];
}

// A fixture room: a tmp dir with a STATE.md carrying a ProblemType line.
function makeFixtureRoom(problemTypeLine) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'p122-04-suggest-'));
  const roomDir = path.join(root, 'room');
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, 'STATE.md'),
    '# Room State\n\n' + problemTypeLine + '\n\nStage: discovery\n');
  return { root: root, roomDir: roomDir };
}
function rmFixture(fx) { try { fs.rmSync(fx.root, { recursive: true, force: true }); } catch (_e) {} }

// ---------------------------------------------------------------------------
// 1. fixture room with a ProblemType -> /mos:suggest-next returns a command SEQUENCE
// ---------------------------------------------------------------------------
test('a fixture room with a ProblemType -> /mos:suggest-next prints a step-numbered command sequence; every /mos: is registered', function () {
  const fx = makeFixtureRoom('Problem Type: ill-defined');
  try {
    const res = spawnSync(process.execPath, [SUGGEST_SCRIPT, '--room', fx.roomDir], { encoding: 'utf8' });
    assert.strictEqual(res.status, 0, 'suggest-next-command.cjs exits 0; stderr: ' + (res.stderr || ''));
    const out = res.stdout || '';
    // It is a SEQUENCE: a "Command sequence" header + a step-numbered list + at least one /mos: token.
    assert.ok(/command sequence/i.test(out), 'output names a command sequence; got:\n' + out);
    assert.ok(/^\s*\d+\.\s/m.test(out), 'output has a step-numbered list; got:\n' + out);
    assert.ok(/recommended framework chain/i.test(out), 'output shows the framework chain too');
    const cmds = extractCommands(out);
    assert.ok(cmds.length >= 1, 'output emits at least one /mos: command; got:\n' + out);
    // Every /mos: it emits in the SEQUENCE/chain is a registered command (the
    // footer cross-references /mos:status, /mos:pipeline -- also registered).
    for (const c of cmds) {
      assert.ok(REGISTERED_COMMANDS.has(c), 'emitted command must exist in data/command-registry.json: ' + c + '\nfull output:\n' + out);
    }
    // And the methodology command in the sequence is the resolver's answer for
    // the IDP seed framework -- not a hallucinated one (in particular, NOT
    // /mos:jtbd, which does not exist).
    assert.ok(!/\/mos:jtbd\b/.test(out), 'must not emit the non-existent /mos:jtbd');
  } finally {
    rmFixture(fx);
  }
});

// ---------------------------------------------------------------------------
// 2. direct: recommendFrameworkChain + composeWorkflow for the IDP room state
// ---------------------------------------------------------------------------
test('recommendFrameworkChain({roomState:{problemType:"ill-defined"}}) -> composeWorkflow -> a chain of registered commands (no hallucination)', function () {
  const chain = recommender.recommendFrameworkChain({ roomState: { problemType: 'ill-defined' } });
  assert.ok(Array.isArray(chain) && chain.length >= 1, 'a non-empty framework chain');
  const wf = resolver.composeWorkflow(chain);
  assert.ok(Array.isArray(wf) && wf.length === chain.length);
  wf.forEach(function (s, i) {
    assert.strictEqual(s.step, i + 1);
    assert.ok('framework' in s && 'command' in s && 'optional' in s);
    if (s.command !== null) {
      assert.ok(typeof s.command === 'string' && s.command.indexOf('/mos:') === 0);
      assert.ok(REGISTERED_COMMANDS.has(s.command), 'composeWorkflow only ever yields registered commands: ' + s.command);
    } else {
      assert.strictEqual(s.optional, true, 'a command-less step is marked optional (run it manually)');
    }
  });
});

// ---------------------------------------------------------------------------
// 3. a synthetic chain including /mos:hat-briefing -> validateChainAutonomy flags it
// ---------------------------------------------------------------------------
test('a synthetic chain that includes /mos:hat-briefing -> validateChainAutonomy reports it as a blocker (the /mos:act --chain stop point)', function () {
  // Six Thinking Hats resolves to /mos:hat-briefing (autonomous_safe: false in
  // the registry) as its first command -- so a chain through it is the stop point.
  const sixHatsCmds = resolver.commandsForFramework('Six Thinking Hats');
  assert.ok(sixHatsCmds.length > 0 && sixHatsCmds[0] === '/mos:hat-briefing',
    'Six Thinking Hats resolves to /mos:hat-briefing first; got: ' + JSON.stringify(sixHatsCmds));
  const wf = resolver.composeWorkflow(['Beautiful Question Framework', 'Six Thinking Hats']);
  const report = resolver.validateChainAutonomy(wf);
  assert.strictEqual(report.runnable, false, 'a chain with /mos:hat-briefing is not fully runnable');
  assert.ok(Array.isArray(report.blockers) && report.blockers.length >= 1);
  const blocked = report.blockers.find(function (b) { return b && b.command === '/mos:hat-briefing'; });
  assert.ok(blocked, 'the blocker names /mos:hat-briefing; report: ' + JSON.stringify(report));
  assert.strictEqual(blocked.step, 2, 'the blocker is step 2 (the second step in the chain)');
  // Step 1 (/mos:beautiful-question, autonomous_safe) is NOT a blocker.
  assert.ok(!report.blockers.some(function (b) { return b && b.step === 1; }), 'step 1 is autonomous_safe -- not a blocker');
});

// ---------------------------------------------------------------------------
// 4. /mos:pipeline --from-problem-type ill-defined prints a Brain-derived command chain
// ---------------------------------------------------------------------------
test('/mos:pipeline --from-problem-type ill-defined prints a run order of registered /mos: commands', function () {
  const res = spawnSync(process.execPath, [PIPELINE_SCRIPT, '--from-problem-type', 'ill-defined'], { encoding: 'utf8' });
  assert.strictEqual(res.status, 0, 'pipeline-command.cjs exits 0; stderr: ' + (res.stderr || ''));
  const out = res.stdout || '';
  assert.ok(/brain-derived framework chain/i.test(out), 'output names the Brain-derived chain; got:\n' + out);
  assert.ok(/run order/i.test(out), 'output shows a run order; got:\n' + out);
  const cmds = extractCommands(out);
  assert.ok(cmds.length >= 1, 'output emits at least one /mos: command');
  for (const c of cmds) {
    assert.ok(REGISTERED_COMMANDS.has(c), 'pipeline run-order command must be registered: ' + c + '\nfull output:\n' + out);
  }
});

// ---------------------------------------------------------------------------
// 5. /mos:act --chain --from-framework "Six Thinking Hats" stops at the first non-autonomous step
// ---------------------------------------------------------------------------
test('/mos:act --chain stops at the first non-autonomous_safe step (Six Thinking Hats -> /mos:hat-briefing)', function () {
  const res = spawnSync(process.execPath, [ACT_SCRIPT, '--chain', '--from-framework', 'Six Thinking Hats'], { encoding: 'utf8' });
  assert.strictEqual(res.status, 0, 'act-command.cjs exits 0; stderr: ' + (res.stderr || ''));
  const out = res.stdout || '';
  assert.ok(/\[GATE\]/.test(out), 'output renders a needs-you-here gate; got:\n' + out);
  assert.ok(/not autonomous_safe/i.test(out), 'the gate cites the autonomy reason');
  assert.ok(/\/mos:hat-briefing/.test(out), 'the gate names /mos:hat-briefing (the stop point)');
  assert.ok(/runnable:\s*false/i.test(out), 'validateChainAutonomy reported runnable=false');
  // Every /mos: it prints is registered.
  for (const c of extractCommands(out)) {
    assert.ok(REGISTERED_COMMANDS.has(c), 'act --chain command must be registered: ' + c + '\nfull output:\n' + out);
  }
});

process.stdout.write('\nsuggest-next-workflow.test.cjs: ' + passed + ' assertion groups PASSED\n');
process.exit(0);
