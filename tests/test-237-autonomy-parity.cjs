#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 237-02 -- full-registry autonomy parity gate (REACH-02, Task 1)
 * =======================================================================
 * Real behavior proven: framework_run and chain_run must classify every
 * command in data/command-registry.json IDENTICALLY as material or
 * autonomous_safe. Today they do not. framework_run reads
 * commands[].autonomous_safe (an autonomy flag) via
 * lib/workflow/command-resolver.cjs::validateChainAutonomy; chain_run
 * reads data/connector-registry.json connectors[].posture ===
 * 'push_forward' (a pedagogical reach dial from the frozen-3 vocabulary).
 * This is a category error, not a data drift -- re-syncing the two data
 * files does not fix it, because they answer two different questions.
 *
 * Test map (5 legs):
 *   Leg 1 PARITY:          every registered command classifies identically
 *                          through both real entry points (exact-equality
 *                          verdict-map comparison; every disagreement named
 *                          in the failure message).
 *   Leg 2 DIRECTION:       /mos:ignite, /mos:new-project, /mos:pipeline are
 *                          MATERIAL (autonomous_safe:false, posture:'halt')
 *                          through chain_run -- the fix must not go the
 *                          wrong direction (making framework_run laxer).
 *   Leg 3 NO-LAXER:        chain_run's autonomous_safe tally never exceeds
 *                          framework_run's; framework_run's own tally is
 *                          pinned against the registry's own frozen
 *                          autonomous_safe:true count, so a future change
 *                          that widens autonomy fails loudly.
 *   Leg 4 WITHHOLD-DEFAULT: an unregistered command halts through both
 *                          paths (never a fabricated safe).
 *   Leg 5 MUTATION:        a tmp copy of chain.cjs with the postureFn
 *                          default textually re-pointed at a
 *                          connector-registry posture reader reproduces
 *                          >40 disagreements against framework_run -- proof
 *                          the gate can actually fail, not just pass.
 *
 * chainPostureFn() indirection (read this before touching the file): the
 * posture function chain_run actually installs changes shape across this
 * plan's own two tasks. BEFORE Task 2, chain.cjs still exports its own
 * (wrong) postureForCommand, joined from connector-registry -- that IS what
 * chain_run installs as its default today, so the pre-fix probe must read
 * THAT function to prove the live disagreement (Legs 1-3 are expected RED
 * against it). AFTER Task 2 deletes that export, chain_run's default falls
 * through to chain-executor.cjs's own _defaultPostureFn, which resolves to
 * lib/core/recipe-maps.cjs::postureForCommand -- the one true authority.
 * chainPostureFn() below therefore PREFERS chain.cjs's own export while it
 * still exists (the transient pre-fix probe branch, expected to disappear
 * the moment Task 2 lands) and FALLS BACK to recipe-maps.postureForCommand
 * once it is gone. This is the functionally-necessary direction: reading
 * recipe-maps unconditionally would make Legs 1-3 compare the one true
 * authority against itself and never show the live pre-fix defect at all.
 *
 * Harness idiom reused (source, verbatim, per 237-02-PLAN.md Task 1's
 * <read_first>):
 *   - tmpdir lifecycle + mutated-tmp-copy harness (pin-relative-requires-to-
 *     absolute-paths, needle assertions, assert.notEqual(mutated, src) proof
 *     that a mutation actually changed the source, require() the tmp copy
 *     fresh) + the async runner epilogue shape:
 *     tests/test-241-guardian-tripolar-parity.cjs (lines 77-114, 160-215,
 *     255-315).
 *   - hermetic env save/delete/restore (CLAUDE_ACTIVE_ROOM,
 *     MINDRIAN_ROOMS_HOME, MINDRIAN_MCP_FIRST):
 *     tests/test-198-concurrency-mcp.test.cjs (lines 31-45).
 *
 * Node built-in assert only. No em-dashes. Zero npm deps (of this test file
 * itself -- the module under test transitively requires 'zod', which is why
 * every tmp copy below gets a node_modules symlink back to the real repo,
 * so that require resolves without vendoring anything).
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const CHAIN_TOOL_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'chain.cjs');
const RECIPE_MAPS_PATH = path.join(REPO_ROOT, 'lib', 'core', 'recipe-maps.cjs');
const COMMAND_RESOLVER_PATH = path.join(REPO_ROOT, 'lib', 'workflow', 'command-resolver.cjs');
const COMMAND_REGISTRY_PATH = path.join(REPO_ROOT, 'data', 'command-registry.json');
const CONNECTOR_REGISTRY_PATH = path.join(REPO_ROOT, 'data', 'connector-registry.json');

// ---------------------------------------------------------------------------
// tmpdir lifecycle (test-241 idiom). Every tmp copy gets a node_modules
// symlink back to the real repo so require('zod') (chain.cjs's one real npm
// dependency) resolves from a directory that is not a descendant of REPO_ROOT.
// ---------------------------------------------------------------------------
// Resolve the REAL node_modules directory that actually satisfies chain.cjs's
// one npm dependency ('zod'). This worktree carries no node_modules of its
// own -- Node's resolution walks up past REPO_ROOT to a node_modules living
// in an ancestor directory (the main repo checkout this worktree branches
// from). A tmp dir under os.tmpdir() is not a descendant of that ancestor
// chain, so require('zod') would otherwise fail from any tmp copy; symlink
// straight to wherever 'zod' ACTUALLY resolves from, not to REPO_ROOT's own
// (possibly nonexistent) node_modules.
function _resolveNodeModulesDir() {
  try {
    const zodEntry = require.resolve('zod'); // e.g. .../node_modules/zod/index.cjs
    const zodPkgDir = path.dirname(zodEntry); // .../node_modules/zod
    return path.dirname(zodPkgDir); // .../node_modules
  } catch (_e) {
    return path.join(REPO_ROOT, 'node_modules'); // best-effort fallback
  }
}
const REAL_NODE_MODULES_DIR = _resolveNodeModulesDir();

const TMPDIRS = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMPDIRS.push(d);
  try {
    fs.symlinkSync(REAL_NODE_MODULES_DIR, path.join(d, 'node_modules'), 'dir');
  } catch (_e) {
    // best effort; a module under test with no npm deps still works without it.
  }
  return d;
}
process.on('exit', () => {
  for (const d of TMPDIRS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
});

// ---------------------------------------------------------------------------
// chainPostureFn() -- see the header comment above for why the preference
// order runs this direction.
// ---------------------------------------------------------------------------
function chainPostureFn() {
  let chainTool = null;
  try { chainTool = require(CHAIN_TOOL_PATH); } catch (_e) { chainTool = null; }
  if (chainTool && typeof chainTool.postureForCommand === 'function') {
    return chainTool.postureForCommand; // pre-fix probe; expected to disappear after Task 2
  }
  return require(RECIPE_MAPS_PATH).postureForCommand; // post-fix: the one true authority
}

function frameworkAutonomousSafe(resolver, command) {
  const verdict = resolver.validateChainAutonomy([{ step: 1, command: command }]);
  return verdict.runnable === true && Array.isArray(verdict.blockers) && verdict.blockers.length === 0;
}

// ---------------------------------------------------------------------------
// Leg 5 mutation harness (test-241 idiom: pin relative requires to absolute
// paths, inject the mutation, assert.notEqual(mutated, src), write to a tmp
// path, require() fresh -- never mutate the working tree).
// ---------------------------------------------------------------------------
function pinRequiresToRealRepo(src) {
  let out = src;
  const relativeRequires = [
    ["require('../../core/chain-executor.cjs')", path.join(REPO_ROOT, 'lib', 'core', 'chain-executor.cjs')],
    ["require('../../workflow/command-resolver.cjs')", path.join(REPO_ROOT, 'lib', 'workflow', 'command-resolver.cjs')],
    ["require('../../core/navigation.cjs')", path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs')],
    ["require('../gate-render.cjs')", path.join(REPO_ROOT, 'lib', 'mcp', 'gate-render.cjs')],
    ["require('../../core/resolve-active-room.cjs')", path.join(REPO_ROOT, 'lib', 'core', 'resolve-active-room.cjs')],
    ["require('../../core/session-binding.cjs')", path.join(REPO_ROOT, 'lib', 'core', 'session-binding.cjs')],
    ["require('../mcp-first-flag.cjs')", path.join(REPO_ROOT, 'lib', 'mcp', 'mcp-first-flag.cjs')],
  ];
  for (const [needle, absTarget] of relativeRequires) {
    assert.ok(out.indexOf(needle) !== -1, 'expected relative require not found in chain.cjs: ' + needle + ' (harness pin target drifted)');
    out = out.split(needle).join('require(' + JSON.stringify(absTarget) + ')');
  }
  return out;
}

/**
 * buildMutatedChainCjs(tmp) -> { ok:true, module } | { ok:false, reason }
 * Injects a SECOND classification path (a connector-registry posture
 * reader) at module scope, re-points chain_run's postureFn default at it
 * (the exact defect Task 2 fixes), and exposes it via a test-only
 * __mutationTestHook export so this test can drive it directly across all
 * 112 registered commands without spinning up a full chainRun per command.
 * Targets the POST-Task-2 shape of the postureFn default line; when that
 * shape is not yet present (the pre-fix probe run, before Task 2 lands),
 * returns { ok:false } rather than asserting -- Legs 1-3 already carry the
 * pre-fix RED demonstration on their own.
 */
function buildMutatedChainCjs(tmp) {
  const src = fs.readFileSync(CHAIN_TOOL_PATH, 'utf8');

  const requireAnchor = "const { isMcpFirst } = require('../mcp-first-flag.cjs');";
  assert.ok(src.indexOf(requireAnchor) !== -1, 'expected mcp-first-flag require anchor not found in chain.cjs; harness pin target drifted');

  const connectorRegistryAbs = JSON.stringify(CONNECTOR_REGISTRY_PATH);
  const injectedFn = [
    '',
    '// MUTATION (test-237-autonomy-parity Leg 5): a second classification',
    '// path, re-pointed at connector-registry posture -- the exact defect',
    '// this gate exists to catch on reintroduction. Never present in the',
    '// real repo file; only in this generated tmp copy. Self-contained (its',
    "// own require('node:fs')) so it does not depend on chain.cjs's own",
    '// top-level requires, which this very fix (Task 2) may prune as dead',
    '// code once the private classifier that used them is deleted.',
    'function __mutationConnectorPosture(command) {',
    '  try {',
    "    const __mutFs = require('node:fs');",
    "    const raw = __mutFs.readFileSync(" + connectorRegistryAbs + ", 'utf8');",
    '    const parsed = JSON.parse(raw);',
    '    const conns = Array.isArray(parsed && parsed.connectors) ? parsed.connectors : [];',
    '    for (const c of conns) {',
    "      if (c && c.surface === command && typeof c.posture === 'string') {",
    "        const safe = c.posture === 'push_forward';",
    "        return { command: command, autonomous_safe: safe, posture: safe ? 'run' : 'halt' };",
    '      }',
    '    }',
    '  } catch (_e) { /* fall through to withhold-default */ }',
    "  return { command: command || null, autonomous_safe: false, posture: 'halt' };",
    '}',
  ].join('\n');
  let out = src.split(requireAnchor).join(requireAnchor + injectedFn);

  const postureNeedle = "const postureFn = (typeof o.postureFn === 'function') ? o.postureFn : undefined;";
  if (out.indexOf(postureNeedle) === -1) {
    return { ok: false, reason: 'postureFn default needle not found (pre-Task-2 source shape) -- Leg 5 targets the post-fix shape and is expected to disappear as a live probe once Task 2 lands' };
  }
  out = out.split(postureNeedle).join(
    "const postureFn = (typeof o.postureFn === 'function') ? o.postureFn : __mutationConnectorPosture;"
  );

  const exportsNeedle = 'module.exports = {';
  assert.ok(out.indexOf(exportsNeedle) !== -1, 'expected module.exports anchor not found in chain.cjs; harness pin target drifted');
  out = out.split(exportsNeedle).join(exportsNeedle + '\n  __mutationTestHook: __mutationConnectorPosture,');

  const mutated = pinRequiresToRealRepo(out);
  assert.notEqual(mutated, src, 'mutation must actually change the source');

  const dest = path.join(tmp, 'chain-mutated.cjs');
  fs.writeFileSync(dest, mutated);
  return { ok: true, module: require(dest) };
}

// ---------------------------------------------------------------------------
// Runner (test-241 idiom): each leg runs independently in try/catch so a
// failing early leg does not hide the ones after it; SKIP is a third state,
// distinct from FAIL, used only by Leg 5's pre-fix-shape probe above.
// ---------------------------------------------------------------------------
const results = [];
function runLeg(name, fn) {
  try {
    const r = fn();
    if (r && r.skipped === true) {
      results.push({ name: name, status: 'SKIP', reason: r.reason });
    } else {
      results.push({ name: name, status: 'PASS' });
    }
  } catch (e) {
    results.push({ name: name, status: 'FAIL', error: e });
  }
}

// ---------------------------------------------------------------------------
// Hermetic env save/delete/restore (test-198-concurrency-mcp.test.cjs idiom),
// wrapped around the whole run.
// ---------------------------------------------------------------------------
const previousHome = process.env.MINDRIAN_ROOMS_HOME;
const previousFlag = process.env.MINDRIAN_MCP_FIRST;
const previousActiveRoomEnv = process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.MINDRIAN_ROOMS_HOME;
delete process.env.MINDRIAN_MCP_FIRST;

try {
  const registry = require(COMMAND_REGISTRY_PATH);
  const allCommands = registry.commands
    .filter((c) => c && typeof c.command === 'string')
    .map((c) => c.command)
    .sort();
  assert.ok(allCommands.length > 0, 'expected data/command-registry.json to carry at least one command');

  const resolver = require(COMMAND_RESOLVER_PATH);
  const chainPosture = chainPostureFn();

  const frameworkMap = {};
  const chainMap = {};
  for (const cmd of allCommands) {
    frameworkMap[cmd] = frameworkAutonomousSafe(resolver, cmd);
    const v = chainPosture(cmd);
    chainMap[cmd] = !!(v && v.autonomous_safe === true);
  }

  // -------------------------------------------------------------------------
  // Leg 1 PARITY
  // -------------------------------------------------------------------------
  runLeg('Leg 1 PARITY: every registered command classifies identically through framework_run and chain_run', () => {
    const disagreements = allCommands.filter((cmd) => frameworkMap[cmd] !== chainMap[cmd]);
    const frameworkStr = JSON.stringify(frameworkMap, allCommands);
    const chainStr = JSON.stringify(chainMap, allCommands);
    const message = disagreements.length === 0
      ? 'no disagreements'
      : 'DISAGREEMENTS (' + disagreements.length + '/' + allCommands.length + '): ' +
        disagreements.map((cmd) => cmd + ' framework_run=' + frameworkMap[cmd] + ' chain_run=' + chainMap[cmd]).join(', ');
    assert.equal(chainStr, frameworkStr, message);
  });

  // -------------------------------------------------------------------------
  // Leg 2 DIRECTION
  // -------------------------------------------------------------------------
  runLeg('Leg 2 DIRECTION: /mos:ignite, /mos:new-project, /mos:pipeline are MATERIAL through chain_run', () => {
    const targets = ['/mos:ignite', '/mos:new-project', '/mos:pipeline'];
    const failures = [];
    for (const cmd of targets) {
      const v = chainPosture(cmd);
      if (!(v && v.autonomous_safe === false && v.posture === 'halt')) {
        failures.push(cmd + ' -> ' + JSON.stringify(v));
      }
    }
    assert.equal(failures.length, 0,
      'expected MATERIAL (autonomous_safe:false, posture:halt) via chain_run for: ' + failures.join('; '));
  });

  // -------------------------------------------------------------------------
  // Leg 3 NO-LAXER
  // -------------------------------------------------------------------------
  runLeg('Leg 3 NO-LAXER: chain_run autonomous_safe tally never exceeds framework_run, pinned to the frozen registry tally', () => {
    const registrySafeCount = registry.commands.filter((c) => c && c.autonomous_safe === true).length;
    const frameworkSafeCount = allCommands.filter((cmd) => frameworkMap[cmd] === true).length;
    const chainSafeCount = allCommands.filter((cmd) => chainMap[cmd] === true).length;
    assert.equal(frameworkSafeCount, registrySafeCount,
      "framework_run's autonomous_safe tally (" + frameworkSafeCount + ') must equal the registry\'s own frozen autonomous_safe:true tally (' + registrySafeCount + ')');
    assert.ok(chainSafeCount <= frameworkSafeCount,
      "chain_run's autonomous_safe tally (" + chainSafeCount + ") must never exceed framework_run's (" + frameworkSafeCount + ')');
  });

  // -------------------------------------------------------------------------
  // Leg 4 WITHHOLD-DEFAULT
  // -------------------------------------------------------------------------
  runLeg('Leg 4 WITHHOLD-DEFAULT: an unregistered command halts through both paths', () => {
    const bogus = '/mos:__definitely-not-a-real-command__';
    const fwSafe = frameworkAutonomousSafe(resolver, bogus);
    const chainVerdict = chainPosture(bogus);
    assert.equal(fwSafe, false, 'framework_run must not fabricate autonomous_safe for an unregistered command');
    assert.ok(chainVerdict && chainVerdict.autonomous_safe === false && chainVerdict.posture === 'halt',
      'chain_run must withhold-default to halt for an unregistered command; got ' + JSON.stringify(chainVerdict));
  });

  // -------------------------------------------------------------------------
  // Leg 5 MUTATION
  // -------------------------------------------------------------------------
  runLeg('Leg 5 MUTATION: re-pointing chain_run\'s postureFn default at connector-registry reproduces >40 disagreements', () => {
    const tmp = mkTmp('test-237-leg5-');
    const built = buildMutatedChainCjs(tmp);
    if (!built.ok) {
      return { skipped: true, reason: built.reason };
    }
    const mutatedPosture = built.module.__mutationTestHook;
    assert.equal(typeof mutatedPosture, 'function', 'mutated module must expose the injected posture function via __mutationTestHook');
    let disagreementCount = 0;
    const names = [];
    for (const cmd of allCommands) {
      const v = mutatedPosture(cmd);
      const mutatedSafe = !!(v && v.autonomous_safe === true);
      if (mutatedSafe !== frameworkMap[cmd]) {
        disagreementCount += 1;
        names.push(cmd);
      }
    }
    assert.ok(disagreementCount > 40,
      'expected the mutation to reproduce >40 disagreements against framework_run; got ' + disagreementCount +
      ' (' + names.slice(0, 12).join(', ') + (names.length > 12 ? ', ...' : '') + ')');
  });
} finally {
  if (previousFlag === undefined) delete process.env.MINDRIAN_MCP_FIRST; else process.env.MINDRIAN_MCP_FIRST = previousFlag;
  if (previousHome === undefined) delete process.env.MINDRIAN_ROOMS_HOME; else process.env.MINDRIAN_ROOMS_HOME = previousHome;
  if (previousActiveRoomEnv === undefined) delete process.env.CLAUDE_ACTIVE_ROOM; else process.env.CLAUDE_ACTIVE_ROOM = previousActiveRoomEnv;
}

// ---------------------------------------------------------------------------
// Epilogue
// ---------------------------------------------------------------------------
let passCount = 0;
let failCount = 0;
let skipCount = 0;
console.log('');
for (const r of results) {
  if (r.status === 'PASS') {
    passCount += 1;
    console.log('  ok - ' + r.name);
  } else if (r.status === 'SKIP') {
    skipCount += 1;
    console.log('  SKIP - ' + r.name + ' (' + r.reason + ')');
  } else {
    failCount += 1;
    console.error('FAIL - ' + r.name);
    console.error(r.error && (r.error.message || r.error.stack) || String(r.error));
  }
}
console.log('');
if (failCount === 0) {
  console.log('PASS: test-237-autonomy-parity (' + passCount + ' passed, ' + skipCount + ' skipped, of ' + results.length + ' legs)');
  process.exit(0);
} else {
  console.error('FAIL: test-237-autonomy-parity (' + failCount + ' failed, ' + passCount + ' passed, ' + skipCount + ' skipped, of ' + results.length + ' legs)');
  process.exit(1);
}
