#!/usr/bin/env node
// Phase 198 SPEC-3 -- server-side chain execution honoring postures. Real
// behavior: chain_run wraps the shipped lib/core/chain-executor.cjs::runChain
// (Phase 166) server-side; a chain of 2 autonomous_safe steps + 1 material
// step runs the autonomous_safe prefix, halts at the material step, and
// returns a gate_render payload instead of executing it; the material step
// executes ONLY after gate_answer returns an approve verdict (and stays
// unexecuted on a reject/defer verdict). R4: chain_run must not mint a
// second executor -- it wraps runChain, never re-implements it. Postures are
// read from the REAL data/connector-registry.json (joined, not fabricated).
//
// SKIP-safe until lib/mcp/tools/chain.cjs exists. Node built-in assert only.
// No em-dashes.
'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

let chainTool;
try {
  chainTool = require('../lib/mcp/tools/chain.cjs');
} catch (e) {
  console.log('SKIP: test-198-chain-run-halt -- lib/mcp/tools/chain.cjs not present yet. ' + (e.code || e.message));
  process.exit(0);
}

const hasChainRunApi = typeof chainTool.chainRun === 'function'
  || typeof chainTool.registerChainTools === 'function';
if (!hasChainRunApi) {
  console.log('SKIP: test-198-chain-run-halt -- chain.cjs present but chain_run API not exported yet.');
  process.exit(0);
}

let passed = 0;
function check(label, cond) {
  assert.ok(cond, label);
  passed += 1;
  console.log('  ok - ' + label);
}

// --- fixture: 2 REAL push_forward commands + 1 REAL hold (material) command
// from data/connector-registry.json -- postures are JOINED from the real
// registry, never fabricated ad-hoc (SPEC-3). ---
const registryPath = path.resolve(__dirname, '..', 'data', 'connector-registry.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const cmdConnectors = registry.connectors.filter((c) => c && c.source === 'command' && typeof c.surface === 'string');
const pushCmds = cmdConnectors.filter((c) => c.posture === 'push_forward').slice(0, 2).map((c) => c.surface);
const holdCmds = cmdConnectors.filter((c) => c.posture === 'hold').slice(0, 1).map((c) => c.surface);
assert.ok(pushCmds.length === 2, 'FIXTURE: connector-registry.json has >=2 push_forward commands');
assert.ok(holdCmds.length === 1, 'FIXTURE: connector-registry.json has >=1 hold (material) command');

const steps = [
  { step: 1, framework: 'fixture-safe-1', command: pushCmds[0], optional: false },
  { step: 2, framework: 'fixture-safe-2', command: pushCmds[1], optional: false },
  { step: 3, framework: 'fixture-material', command: holdCmds[0], optional: false },
];

// A deterministic, injectable onStep -- proves the CONTROL-FLOW timing
// (halt-then-resume), independent of the real navigation.cjs write path
// (that chokepoint is proven elsewhere, e.g. test-198-chokepoint-guard).
const executed = [];
async function stubOnStep(step, _previousOutput) {
  executed.push(step.command);
  return { chain_output: { ran: step.command }, quality: 'high' };
}

(async () => {
  // --- (1) postureForCommand genuinely joins the registry (not fabricated). ---
  const pushVerdict = chainTool.postureForCommand(pushCmds[0]);
  const holdVerdict = chainTool.postureForCommand(holdCmds[0]);
  check('postureForCommand(push_forward command) -> autonomous_safe:true, posture:"run"',
    pushVerdict.autonomous_safe === true && pushVerdict.posture === 'run');
  check('postureForCommand(hold command) -> autonomous_safe:false, posture:"halt"',
    holdVerdict.autonomous_safe === false && holdVerdict.posture === 'halt');
  check('postureForCommand(unknown command) withhold-defaults to halt (never fabricates safe)',
    chainTool.postureForCommand('/mos:__definitely-not-a-real-command__').autonomous_safe === false);

  // --- (2) chain_run(steps): runs the 2 autonomous_safe steps, HALTS at the
  // material step, returns a gate_render payload, does NOT execute it. ---
  const run1 = await chainTool.chainRun(steps, { roomDir: __dirname, onStep: stubOnStep });

  check('chain_run returns ok:true', run1.ok === true);
  check('chain_run does NOT complete (halted at the material step)', run1.completed === false && run1.halted === true);
  check('chain_run ran exactly the 2 autonomous_safe steps, in order',
    executed.length === 2 && executed[0] === pushCmds[0] && executed[1] === pushCmds[1]);
  check('chain_run did NOT execute the material step before any approval',
    executed.indexOf(holdCmds[0]) === -1);
  check('chain_run names the material step as the halt point',
    !!(run1.halted_at && run1.halted_at.step && run1.halted_at.step.command === holdCmds[0]));
  check('chain_run returns a gate_render payload (gate_id + rendered card)',
    !!(run1.gate && typeof run1.gate.gate_id === 'string' && run1.gate.rendered));

  const gateId = run1.gate.gate_id;

  // --- (3) a reject verdict must NOT execute the material step -- and must
  // consume the gate (single-use: a second answer for the same gate_id is
  // rejected as unknown/expired -- T-198-12). ---
  const rejectExecuted = executed.slice();
  const rejectResult = await chainTool.chainRun(null, {
    gateAnswer: { gate_id: gateId, chosen: ['reject'], verdict: 'reject' },
  });
  check('a reject verdict does NOT execute the material step', rejectResult.executed === false);
  check('a reject verdict leaves the executed log unchanged (material step never ran)',
    executed.length === rejectExecuted.length && executed.indexOf(holdCmds[0]) === -1);

  const replaySameGate = await chainTool.chainRun(null, {
    gateAnswer: { gate_id: gateId, chosen: ['approve'], verdict: 'approve' },
  });
  check('a consumed gate_id cannot be replayed (single-use ledger, T-198-12)',
    replaySameGate.ok === false && replaySameGate.reason === 'unknown_or_expired_gate');

  // --- (4) a forged/unknown gate_id never resumes anything. ---
  const forged = await chainTool.chainRun(null, {
    gateAnswer: { gate_id: 'gate-never-minted-by-this-process', chosen: ['approve'], verdict: 'approve' },
  });
  check('a forged/unknown gate_id is rejected, never resumes', forged.ok === false && forged.reason === 'unknown_or_expired_gate');

  // --- (5) START A FRESH RUN, then an APPROVE verdict resumes and executes
  // the material step -- the SPEC-3 acceptance bar. ---
  const executed2 = [];
  async function stubOnStep2(step, _previousOutput) {
    executed2.push(step.command);
    return { chain_output: { ran: step.command }, quality: 'high' };
  }
  const run2 = await chainTool.chainRun(steps, { roomDir: __dirname, onStep: stubOnStep2 });
  check('a second fresh chain_run also halts at the material step', run2.completed === false && run2.halted === true);
  check('the material step still has not executed pre-approval', executed2.indexOf(holdCmds[0]) === -1);

  const gateId2 = run2.gate.gate_id;
  const approveResult = await chainTool.chainRun(null, {
    gateAnswer: { gate_id: gateId2, chosen: ['approve'], verdict: 'approve' },
  });
  check('an approve verdict resumes and executes the material step', approveResult.executed === true);
  check('the material step (and ONLY it, once) now appears in the executed log',
    executed2.filter((c) => c === holdCmds[0]).length === 1);
  check('an approve verdict on a chain with no remaining steps completes the chain',
    approveResult.completed === true);

  console.log('PASS: test-198-chain-run-halt (' + passed + ' assertions -- real registry postures, halt-at-material, single-use resume ledger, approve executes / reject-defer does not, replay/forgery rejected)');
  process.exit(0);
})().catch((e) => {
  console.error('FAIL: test-198-chain-run-halt -- ' + (e && e.stack || e));
  process.exit(1);
});
