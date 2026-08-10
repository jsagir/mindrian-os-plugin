#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 237-08 -- the approve-to-execute end-to-end gate (REACH-01, Task 1)
 * =========================================================================
 * Real behavior proven: on a seeded room, approving the Decision Gate for a
 * material chain step (chain_run's wired default, NOT an injected onStep)
 * causes that step's real resolved command to run -- its declared output
 * artifact exists on disk afterward and did not before, the chain trace
 * records real execution fields (executed, exit_code, artifact), and a
 * mutation restoring the old log-only stub turns the gate red. This is the
 * phase's headline success criterion (ROADMAP SC1 / 237-RESEARCH.md's
 * REACH-01 section).
 *
 * Seven legs, driven end to end through lib/mcp/tools/chain.cjs's OWN public
 * API -- chainRun(steps, opts) to start, chainRun(null, {gateAnswer}) to
 * resume -- with NEITHER onStep NOR postureFn injected for the primary
 * legs (2-6). That is the whole point: chain_run's MCP tool handler supplies
 * neither, so a test that injects them would prove nothing about production.
 * The fixture is /mos:snapshot -> scripts/generate-hub.cjs ->
 * <roomDir>/exports/hub.html (237-RESEARCH.md 1c: MATERIAL under both
 * autonomy authorities, zero npm deps, a pure filesystem read + one write).
 *
 *   Leg 1 PRE-STATE:       <roomDir>/exports/hub.html does NOT exist on a
 *                          freshly seeded room, asserted explicitly (a test
 *                          that only checks the post-state can pass on a
 *                          pre-existing file).
 *   Leg 2 HALT AND MINT:   chainRun over a chain whose first step is
 *                          /mos:snapshot halts at that step and mints a gate
 *                          through gate-render.renderGate, returning a
 *                          usable gate_id -- confirming the Plan 02 collapse
 *                          (REACH-02) left /mos:snapshot MATERIAL.
 *   Leg 3 APPROVE EXECUTES: answering that gate with an approve verdict,
 *                          through chainRun's own gateAnswer path and a
 *                          gate-render.normalizeGateAnswer-shaped answer,
 *                          causes scripts/generate-hub.cjs to run.
 *                          <roomDir>/exports/hub.html exists afterward and
 *                          is non-empty.
 *   Leg 4 TRACE IS REAL:   the returned result's chain_output carries
 *                          executed === true, exit_code === 0, and an
 *                          artifact path equal to the resolved
 *                          <roomDir>/exports/hub.html -- asserted by value,
 *                          not truthiness.
 *   Leg 5 NON-APPROVE:     a fresh chain_run + a reject verdict leaves
 *                          <roomDir>/exports/hub.html absent and returns
 *                          the existing not-executed note. The gate still
 *                          gates.
 *   Leg 6 SINGLE USE:      a second answer against the SAME gate_id (from
 *                          Leg 3) does not execute a second time --
 *                          unknown_or_expired_gate.
 *   Leg 7 MUTATION:        a tmp copy of lib/mcp/tools/chain.cjs with the
 *                          wired chain-step-dispatcher default textually
 *                          replaced by an inline log-only onStep returning
 *                          quality: 'high' reproduces the defect: the
 *                          approve still reports green (ok:true,
 *                          executed:true) but
 *                          <roomDir>/exports/hub.html is ABSENT. This is the
 *                          mutation the ROADMAP success criterion names by
 *                          hand. Never mutates the working tree.
 *
 * A separate, purely diagnostic probe (not a leg, not a check()) drives
 * chain.cjs's _internal.makeDefaultOnStep directly (the pre-Task-2 stub,
 * when it still exists) to print the raw quality/artifact-absence shape of
 * the defect for the SUMMARY's RED capture -- mirrors 237-07-SUMMARY.md's
 * own "Real defect reproduction" section. This never touches the primary
 * chainRun flow and disappears cleanly (a caught exception, printed and
 * continued) once Task 2 deletes the stub.
 *
 * Room fixture: seedRoom mirrors tests/test-237-dispatcher-tiers.cjs's own
 * builder (itself mirroring tests/test-241-guardian-tripolar-parity.cjs:94-
 * 114), extended with a real non-ROOM.md markdown file per section so
 * scripts/generate-hub.cjs (whose SKIP_FILES list skips ROOM.md itself)
 * renders real cards, not an empty shell. Bootstraps .mindrian/room.db via
 * room-db.cjs::openRoomDb directly (test-only bootstrap) so
 * navigation.openRoomDbForCaller's own existsSync gate finds a real db.
 *
 * Hermetic env block (MINDRIAN_ROOMS_HOME / MINDRIAN_MCP_FIRST /
 * CLAUDE_ACTIVE_ROOM save-and-restore) from
 * tests/test-198-concurrency-mcp.test.cjs:31-45. mkTmp + process.on('exit')
 * cleanup + the node_modules-symlink-for-require('zod') technique from
 * tests/test-237-autonomy-parity.cjs (this worktree carries no node_modules
 * of its own).
 *
 * Leg 7's mutation harness follows
 * tests/test-241-guardian-tripolar-parity.cjs:160-215 /
 * tests/test-237-autonomy-parity.cjs:151-167: read the real source, pin
 * every relative require to an absolute repo path with a per-needle
 * assert.ok (a source drift fails loudly), apply the textual mutation,
 * assert.notEqual(mutated, src), write to a temp path, require(dest). Never
 * mutates the working tree. When the post-Task-2 wiring shape is not yet
 * present (the pre-fix probe run, before Task 2 lands), the harness reports
 * ok:false rather than throwing, and Leg 7 records that as an explicit
 * check() failure -- consistent with "Legs 3, 4 and 7 are expected to FAIL"
 * before Task 2.
 *
 * A bounded watchdog (WATCHDOG_MS) guards against a hung spawn producing an
 * illegible hang rather than a clear failure message on a slow machine --
 * set above lib/core/chain-step-dispatcher.cjs's own DISPATCH_TIMEOUT_MS
 * (120000ms) so the dispatcher's own timeout has room to fire first with
 * its own clear reason.
 *
 * This file never reaches into chain.cjs's own single-use resume ledger to
 * fabricate an entry -- the gate is answered exclusively through the real
 * mint/answer/resume ladder.
 *
 * bash/node only. No em-dashes.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const CHAIN_TOOL_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'chain.cjs');
const GATE_RENDER_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'gate-render.cjs');
const NAVIGATION_PATH = path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs');
const ROOM_DB_PATH = path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs');
const CHAIN_STEP_DISPATCHER_PATH = path.join(REPO_ROOT, 'lib', 'core', 'chain-step-dispatcher.cjs');

const chainTool = require(CHAIN_TOOL_PATH);
const gateRender = require(GATE_RENDER_PATH);
const { openRoomDb, closeRoomDb } = require(ROOM_DB_PATH);

// ---------------------------------------------------------------------------
// Bounded watchdog: a clear failure message on a hung machine rather than an
// illegible hang. Set above DISPATCH_TIMEOUT_MS (120000ms) so the
// dispatcher's own bounded-timeout mitigation (T-237-07-05 / T-237-08-05)
// has room to fire first with its own reason.
// ---------------------------------------------------------------------------
const WATCHDOG_MS = 150000;
const watchdog = setTimeout(() => {
  console.error(
    'FAIL: test-237-approve-executes -- watchdog timeout after ' + WATCHDOG_MS +
    'ms. A spawn or dispatcher call likely hung well past ' +
    'lib/core/chain-step-dispatcher.cjs\'s own DISPATCH_TIMEOUT_MS (120000ms).'
  );
  process.exit(1);
}, WATCHDOG_MS);
watchdog.unref();

// ---------------------------------------------------------------------------
// Hermetic env block (tests/test-198-concurrency-mcp.test.cjs:31-45).
// ---------------------------------------------------------------------------
const previousHome = process.env.MINDRIAN_ROOMS_HOME;
const previousFlag = process.env.MINDRIAN_MCP_FIRST;
const previousActiveRoomEnv = process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_ACTIVE_ROOM;

// ---------------------------------------------------------------------------
// tmpdir lifecycle + node_modules symlink for require('zod') from a tmp copy
// (tests/test-237-autonomy-parity.cjs:92-121 idiom -- this worktree carries
// no node_modules of its own).
// ---------------------------------------------------------------------------
function _resolveNodeModulesDir() {
  try {
    const zodEntry = require.resolve('zod');
    const zodPkgDir = path.dirname(zodEntry);
    return path.dirname(zodPkgDir);
  } catch (_e) {
    return path.join(REPO_ROOT, 'node_modules');
  }
}
const REAL_NODE_MODULES_DIR = _resolveNodeModulesDir();

const TMPDIRS = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMPDIRS.push(d);
  return d;
}
function mkTmpWithNodeModules(prefix) {
  const d = mkTmp(prefix);
  try {
    fs.symlinkSync(REAL_NODE_MODULES_DIR, path.join(d, 'node_modules'), 'dir');
  } catch (_e) {
    // best effort; harness plumbing only
  }
  return d;
}
process.on('exit', () => {
  for (const d of TMPDIRS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
  if (previousHome === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
  else process.env.MINDRIAN_ROOMS_HOME = previousHome;
  if (previousFlag === undefined) delete process.env.MINDRIAN_MCP_FIRST;
  else process.env.MINDRIAN_MCP_FIRST = previousFlag;
  if (previousActiveRoomEnv === undefined) delete process.env.CLAUDE_ACTIVE_ROOM;
  else process.env.CLAUDE_ACTIVE_ROOM = previousActiveRoomEnv;
});

// ---------------------------------------------------------------------------
// Room fixture (tests/test-237-dispatcher-tiers.cjs:182-222 idiom).
// ---------------------------------------------------------------------------
function seedRoom(tmp) {
  const roomDir = path.join(tmp, 'room');
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  fs.writeFileSync(
    path.join(roomDir, 'STATE.md'),
    '---\nventure_name: Approve-Executes Fixture Venture\nventure_stage: Discovery\n---\n# Approve-Executes Fixture Venture\n'
  );

  const sections = ['problem-definition', 'market-analysis'];
  for (const s of sections) {
    const dir = path.join(roomDir, s);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'ROOM.md'), '# ' + s + '\n\nIdentity text for ' + s + '.\n');
    fs.writeFileSync(
      path.join(dir, 'notes.md'),
      '# ' + s + ' Notes\n\nSubstantive content for ' + s +
        ' so the hub generator renders a real card, not an empty shell. ' +
        'This paragraph exists only to give the section body enough text ' +
        'for a non-trivial artifact check.\n'
    );
  }

  // Bootstrap .mindrian/room.db so navigation.openRoomDbForCaller's own
  // existsSync gate finds it (openRoomDbForCaller does NOT create the db
  // itself -- it only opens an already-present one).
  const bootstrapDb = openRoomDb(roomDir);
  closeRoomDb(bootstrapDb);

  return roomDir;
}

let failures = 0;
function check(cond, label) {
  if (cond) {
    console.log('  ok  ' + label);
  } else {
    console.error('  FAIL  ' + label);
    failures += 1;
  }
}

function snapshotSteps() {
  return [{ step: 1, framework: null, command: '/mos:snapshot', optional: false }];
}

// ---------------------------------------------------------------------------
// Diagnostic-only probe (NOT a leg, NOT a check()): drives the pre-Task-2
// stub directly, when it still exists, to print the raw defect shape for
// the SUMMARY's RED capture. Never touches the primary chainRun flow.
// ---------------------------------------------------------------------------
async function printDiagnosticDefectSnapshot() {
  const tmp = mkTmp('t23708-diagnostic-');
  const roomDir = seedRoom(tmp);
  const artifact = path.join(roomDir, 'exports', 'hub.html');
  console.log('[diagnostic] direct pre-Task-2 stub probe (informational only, not a check):');
  try {
    const makeDefaultOnStep = chainTool._internal && chainTool._internal.makeDefaultOnStep;
    if (typeof makeDefaultOnStep !== 'function') {
      console.log('    makeDefaultOnStep is no longer exported -- expected after Task 2 deletes the log-only stub.');
      return;
    }
    const onStep = makeDefaultOnStep(roomDir);
    const probe = await onStep({ step: 1, command: '/mos:snapshot', framework: null }, null);
    console.log('    probe.quality = ' + JSON.stringify(probe.quality));
    console.log('    probe.chain_output = ' + JSON.stringify(probe.chain_output));
    console.log('    exports/hub.html exists on disk = ' + fs.existsSync(artifact));
    if (probe.quality === 'high' && !fs.existsSync(artifact)) {
      console.log('    DEFECT REPRODUCED: quality:\'high\' fabricated while the declared artifact was NEVER created.');
    }
  } catch (e) {
    console.log('    probe threw (treated as informational): ' + (e && e.message ? e.message : e));
  }
}

// ---------------------------------------------------------------------------
// Legs 1-4 and 6: the primary approve-executes flow. NEITHER onStep NOR
// postureFn is passed into either chainRun call below -- the whole point is
// to prove the WIRED DEFAULT, not an injected one.
// ---------------------------------------------------------------------------
async function legsPreStateHaltApproveTraceSingleUse() {
  const tmp = mkTmp('t23708-approve-');
  const roomDir = seedRoom(tmp);
  const expectedArtifact = path.join(roomDir, 'exports', 'hub.html');

  // Leg 1: PRE-STATE.
  check(!fs.existsSync(expectedArtifact), '1: PRE-STATE -- exports/hub.html does NOT exist before any run');

  // Leg 2: HALT AND MINT.
  const haltResult = await chainTool.chainRun(snapshotSteps(), { roomDir: roomDir });
  check(haltResult.ok === true, '2a: chain_run returns ok:true on halt');
  check(
    haltResult.completed === false && haltResult.halted === true,
    '2b: chain_run halts (does not complete) at /mos:snapshot -- confirms the Plan 02 (REACH-02) collapse left it MATERIAL'
  );
  check(
    !!(haltResult.gate && typeof haltResult.gate.gate_id === 'string' && haltResult.gate.gate_id.length > 0),
    '2c: chain_run mints a usable gate_id through gate-render.renderGate'
  );
  const gateId = haltResult.gate && haltResult.gate.gate_id;

  // Leg 3: APPROVE EXECUTES. Build the answer through
  // gate-render.normalizeGateAnswer -- the exact shape gate_answer produces
  // -- and answer through chainRun's OWN gateAnswer path.
  const approveAnswer = gateRender.normalizeGateAnswer(gateId, ['approve'], 'approve');
  const approveResult = await chainTool.chainRun(null, { gateAnswer: approveAnswer });

  check(approveResult.ok === true, '3a: answering the gate with an approve verdict returns ok:true');
  check(
    fs.existsSync(expectedArtifact),
    '3b: APPROVE EXECUTES -- exports/hub.html exists after the approve (exists=' + fs.existsSync(expectedArtifact) + ')'
  );
  let hubSize = 0;
  try { hubSize = fs.statSync(expectedArtifact).size; } catch (_e) { hubSize = 0; }
  check(hubSize > 0, '3c: exports/hub.html is non-empty (size=' + hubSize + ' bytes)');

  // Leg 4: TRACE IS REAL. Assert the trace fields BY VALUE, not truthiness.
  check(!!approveResult.chain_output, '4a: TRACE IS REAL -- the resume result carries a chain_output');
  check(
    !!(approveResult.chain_output && approveResult.chain_output.executed === true),
    '4b: chain_output.executed === true (executed=' + JSON.stringify(approveResult.chain_output && approveResult.chain_output.executed) + ')'
  );
  check(
    !!(approveResult.chain_output && approveResult.chain_output.exit_code === 0),
    '4c: chain_output.exit_code === 0 (exit_code=' + JSON.stringify(approveResult.chain_output && approveResult.chain_output.exit_code) + ')'
  );
  check(
    !!(approveResult.chain_output && approveResult.chain_output.artifact === expectedArtifact),
    '4d: chain_output.artifact === the resolved <roomDir>/exports/hub.html path (artifact=' +
      JSON.stringify(approveResult.chain_output && approveResult.chain_output.artifact) + ')'
  );

  // Leg 6: SINGLE USE. A second answer against the SAME gate_id must not
  // resume/execute again -- the mint-then-consume ledger stays single-use.
  const replay = await chainTool.chainRun(null, { gateAnswer: approveAnswer });
  check(
    replay.ok === false && replay.reason === 'unknown_or_expired_gate',
    '6: SINGLE USE -- a second answer against the consumed gate_id does not resume/execute again'
  );
}

// ---------------------------------------------------------------------------
// Leg 5: NON-APPROVE DOES NOT EXECUTE. A fresh chain_run + a reject verdict.
// ---------------------------------------------------------------------------
async function legNonApprove() {
  const tmp = mkTmp('t23708-nonapprove-');
  const roomDir = seedRoom(tmp);
  const expectedArtifact = path.join(roomDir, 'exports', 'hub.html');

  const haltResult = await chainTool.chainRun(snapshotSteps(), { roomDir: roomDir });
  check(haltResult.halted === true, '5a: a fresh chain_run halts at the material step again');
  const gateId = haltResult.gate && haltResult.gate.gate_id;

  const rejectAnswer = gateRender.normalizeGateAnswer(gateId, ['reject'], 'reject');
  const rejectResult = await chainTool.chainRun(null, { gateAnswer: rejectAnswer });

  check(
    rejectResult.ok === true && rejectResult.executed === false,
    '5b: NON-APPROVE DOES NOT EXECUTE -- a reject verdict returns executed:false'
  );
  check(
    typeof rejectResult.note === 'string' && rejectResult.note.length > 0,
    '5c: the existing not-executed note is present'
  );
  check(
    !fs.existsSync(expectedArtifact),
    '5d: exports/hub.html is still absent after a reject verdict -- the gate still gates'
  );
}

// ---------------------------------------------------------------------------
// Leg 7: MUTATION. A tmp copy of chain.cjs with the wired dispatcher default
// textually replaced by an inline log-only onStep returning quality: 'high'.
// Follows tests/test-241-guardian-tripolar-parity.cjs:160-215 /
// tests/test-237-autonomy-parity.cjs:151-167. Never mutates the working
// tree.
// ---------------------------------------------------------------------------
function pinRequiresToRealRepo(src) {
  let out = src;
  // Phase 248-01: chain.cjs's own resolveSessionRoomDir copy (and its direct
  // requires of ../mcp-first-flag.cjs and ../../core/resolve-active-room.cjs)
  // was retired in favor of the shared lib/mcp/session-room.cjs resolver
  // (Task 3, CTX-01 nine-copy collapse). Both stale pins below are removed;
  // session-room.cjs is pinned in their place so the mutated tmp copy
  // (written outside lib/mcp/) can still resolve its relative require.
  const relativeRequires = [
    ["require('../../core/chain-executor.cjs')", path.join(REPO_ROOT, 'lib', 'core', 'chain-executor.cjs')],
    ["require('../../workflow/command-resolver.cjs')", path.join(REPO_ROOT, 'lib', 'workflow', 'command-resolver.cjs')],
    ["require('../gate-render.cjs')", GATE_RENDER_PATH],
    ["require('../../core/session-binding.cjs')", path.join(REPO_ROOT, 'lib', 'core', 'session-binding.cjs')],
    ["require('../session-room.cjs')", path.join(REPO_ROOT, 'lib', 'mcp', 'session-room.cjs')],
    ["require('../../core/chain-step-dispatcher.cjs')", CHAIN_STEP_DISPATCHER_PATH],
    // Phase 238-04 added this require to chain.cjs after this harness's pin
    // list was last updated; pinned here now so the mutated tmp copy (which
    // this Leg 7 harness needs to load) can resolve it too.
    ["require('../gate-ledger.cjs')", path.join(REPO_ROOT, 'lib', 'mcp', 'gate-ledger.cjs')],
  ];
  for (const [needle, absTarget] of relativeRequires) {
    if (out.indexOf(needle) === -1) return null; // pre-Task-2 shape: needle not present yet
    out = out.split(needle).join('require(' + JSON.stringify(absTarget) + ')');
  }
  return out;
}

// The EXACT wired-default expression Task 2 installs (chainRun's onStepFn
// false-branch). Kept as a single line so the textual replace below is
// unambiguous. If Task 2's actual wiring text ever drifts from this, the
// needle-not-found branch below reports it loudly rather than silently
// no-op-ing.
const DISPATCHER_CALL_NEEDLE =
  "makeChainStepDispatcher(roomDir, { sessionId: o.sessionId, targetSection: (typeof o.targetSection === 'string' && o.targetSection.length > 0) ? o.targetSection : null })";

function buildLogOnlyOnStepExpression() {
  // Reconstructs the OLD makeDefaultOnStep stub inline, as an IIFE
  // expression (valid as the ternary's false-branch), self-contained via
  // its own require(navigation.cjs) so it does not depend on chain.cjs's
  // own top-level requires (Task 2 prunes the now-dead navigation require).
  return [
    '(function () {',
    '  return async function onStep(step, _previousOutput) {',
    '    const _nav = require(' + JSON.stringify(NAVIGATION_PATH) + ');',
    '    const _db = _nav.openRoomDbForCaller(roomDir);',
    '    if (!_db) { return { chain_output: null, quality: null }; }',
    '    try {',
    "      const _logged = _nav.logMemoryEvent(_db, 'mcp_client_event_logged', {",
    "        label: 'chain_step_executed',",
    '        step: step && step.step,',
    '        command: step && step.command,',
    '        framework: step && step.framework,',
    '      });',
    '      return {',
    '        chain_output: { step: step && step.step, command: step && step.command, memory_event: _logged },',
    "        quality: 'high', /* MUTATION (Leg 7 proof): fabricated success reintroduced */",
    '      };',
    '    } finally {',
    '      _nav.closeRoomDbForCaller(_db);',
    '    }',
    '  };',
    '})()',
  ].join('\n');
}

function buildMutatedChainCjs(tmp) {
  const src = fs.readFileSync(CHAIN_TOOL_PATH, 'utf8');
  const pinned = pinRequiresToRealRepo(src);
  if (pinned === null) {
    return { ok: false, reason: 'post-Task-2 require wiring not present yet (pre-fix probe run, before Task 2 lands)' };
  }
  if (pinned.indexOf(DISPATCHER_CALL_NEEDLE) === -1) {
    return { ok: false, reason: 'dispatcher-call needle not found -- harness pin target drifted or Task 2 wiring text differs' };
  }
  const mutated = pinned.split(DISPATCHER_CALL_NEEDLE).join(buildLogOnlyOnStepExpression());
  assert.notEqual(mutated, src, 'mutation must actually change the source');
  const dest = path.join(tmp, 'chain-mutated.cjs');
  fs.writeFileSync(dest, mutated);
  delete require.cache[dest];
  return { ok: true, module: require(dest) };
}

async function legMutation() {
  const tmp = mkTmpWithNodeModules('t23708-mutation-');
  const built = buildMutatedChainCjs(tmp);
  if (!built.ok) {
    check(false, '7: MUTATION -- could not build the mutated copy (' + built.reason + ')');
    return;
  }
  const mutatedChain = built.module;
  const roomDir = seedRoom(tmp);
  const expectedArtifact = path.join(roomDir, 'exports', 'hub.html');

  const haltResult = await mutatedChain.chainRun(snapshotSteps(), { roomDir: roomDir });
  check(haltResult.halted === true, '7a: the mutated copy still halts at the material step (mint path unaffected by the mutation)');
  const gateId = haltResult.gate && haltResult.gate.gate_id;
  const approveAnswer = gateRender.normalizeGateAnswer(gateId, ['approve'], 'approve');
  const approveResult = await mutatedChain.chainRun(null, { gateAnswer: approveAnswer });

  check(
    approveResult.ok === true && approveResult.executed === true,
    '7b: the mutated copy reports GREEN (ok:true, executed:true) for the approve -- the log-only stub never signals failure'
  );
  check(
    !fs.existsSync(expectedArtifact),
    '7c: MUTATION PROOF -- exports/hub.html is ABSENT even though the mutated copy reported success. ' +
      'Restoring the log-only stub reproduces the false-success defect and this gate catches it.'
  );
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
async function main() {
  await printDiagnosticDefectSnapshot();
  console.log('');
  await legsPreStateHaltApproveTraceSingleUse();
  await legNonApprove();
  await legMutation();

  console.log('');
  clearTimeout(watchdog);
  if (failures > 0) {
    console.error('test-237-approve-executes: ' + failures + ' FAILURE(S)');
    process.exit(1);
  } else {
    console.log('test-237-approve-executes: all checks passed (7/7 legs)');
    process.exit(0);
  }
}

main().catch((err) => {
  clearTimeout(watchdog);
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
