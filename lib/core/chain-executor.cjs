'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 166-02 -- chain-executor.cjs (EXEC-01 / EXEC-02 / EXEC-03 / EXEC-04 / EXEC-06)
 * ===================================================================================
 * runChain is the ONE shared gated loop in lib/core, called by BOTH the CLI entry and
 * the MCP server through thin command wrappers (Tri-Polar parity, D-166-04). It takes a
 * sequence of reaches/commands and runs it as autopilot-with-gates: invoke a step,
 * capture its structured output, pass that output (carrying the quality enum) into the
 * next step, and loop. Auto-run steps the gate greenlights; HALT at material-decision
 * steps and hand to the Tri-Context Decision Gate (Canon Part 3). No consumer owns a
 * loop -- act / pipeline / ignite all call this one spine.
 *
 * Extracted and generalized from the donor loop in scripts/act-command.cjs (planChainRun
 * + walk at act-command.cjs:131-147; the stop / gate render at act-command.cjs:172-224;
 * the workflow_stage journaling at act-command.cjs:245-295). No new dispatch path.
 *
 * NEXT-STEP AUTHORITY (EXEC-01 + B2 + SPEC Out-of-scope): the loop re-calls decide()
 * (navigation-engine.cjs:596 returns ONE typed decision from the navigated graph
 * neighborhood) per iteration to re-derive the next reach, and records its return shape
 * UNCHANGED (B2 -- never reshape decide()'s return). decide() is the LIVE next-step
 * authority; recipe-maps.rankedNextReach stays a contract-only reader (live nav-engine
 * consumption of the projection deferred with Phase 157). The loop NEVER substitutes the
 * projection's ranked list for decide().
 *
 * NO convergence stop (B3): the SEED-032 / imported-harness "loop until all PASSING"
 * convergence branch is REJECTED. The stop condition is posture / quality / maxSteps
 * ONLY -- the chain halts at the first material step per Canon Part 3.
 *
 * The six-callback contract (the SPEC):
 *   runChain(steps, {
 *     postureFn,    // (command) -> posture authority  (default: recipe-maps.postureForCommand)
 *     gateFn,       // (step, posture, priorOutput) -> 'run' | 'halt'  (default: makeGateFn)
 *     onStep,       // (step, previousOutput) -> { chain_output, quality }  (dispatches framework-runner)
 *     provenanceFn, // optional (step, result) -> frontmatter  (pipeline supplies; act/ignite pass null)
 *     maxSteps,     // hard cap (budget brake, EXEC-06)
 *     onHalt,       // (step, contexts) -> the user's verb at the Tri-Context gate
 *     decideFn,     // injectable decide() seam (default: navigation-engine.cjs decide)
 *   }) -> { trace, completed, haltedAt }
 *
 * Canon Part 8 (Graph Boundary): runChain itself opens NO Brain wire. Posture is joined
 * from the LOCAL command-registry via recipe-maps; egress (if any) is the framework-runner's
 * existing chokepoint, reached through onStep. This file makes zero Brain calls and no raw
 * fetch.
 *
 * Canon Part 7 (Reuse Before Build): ~80-85 percent repoint of shipped code (the
 * act-command loop, the recipe-maps posture authority, the navigation-engine decide(),
 * the framework-runner brick). Net-new is the contract + the gate predicate + the trace
 * join.
 *
 * House rule: hyphens only, no em-dashes.
 */

const path = require('node:path');

// ---------------------------------------------------------------------------
// Lazy seams. The production defaults are required lazily so a test can inject
// stubs (decideFn / postureFn / gateFn) without loading the real engine, and so
// a missing dependency degrades gracefully rather than crashing at require time.
// ---------------------------------------------------------------------------
let _recipeMaps = null;
function _loadRecipeMaps() {
  if (_recipeMaps !== null) return _recipeMaps;
  try {
    _recipeMaps = require(path.join(__dirname, 'recipe-maps.cjs'));
  } catch (_e) {
    _recipeMaps = false;
  }
  return _recipeMaps;
}

let _navEngine = null;
function _loadDecide() {
  if (_navEngine !== null) return _navEngine;
  try {
    const mod = require(path.join(__dirname, 'navigation-engine.cjs'));
    _navEngine = (mod && typeof mod.decide === 'function') ? mod.decide : false;
  } catch (_e) {
    _navEngine = false;
  }
  return _navEngine;
}

// EXEC-06: a sane default budget brake. The caller may lower it; the loop never
// runs more than this many steps regardless of the chain length.
const DEFAULT_MAX_STEPS = 25;

// The quality enum the framework-runner emits (framework-runner.md Step 6:
// quality: {high|medium|low}). The gate halts on 'low' even for an autonomous_safe
// step (EXEC-02 quality carry stops garbage-in-garbage-out down the chain).
const LOW_QUALITY = 'low';

// The kill-switch verb. A [stop] verb at the Tri-Context gate flushes the filed
// artifacts (the trace built so far) and ends the chain cleanly (EXEC-04). Accepts
// the bare verb and the bracketed render form so both onHalt idioms work.
function _isStopVerb(verb) {
  if (typeof verb !== 'string') return false;
  const v = verb.trim().toLowerCase();
  return v === 'stop' || v === '[stop]';
}

// ---------------------------------------------------------------------------
// Default posture authority: recipe-maps.postureForCommand (the ONE posture
// authority, joined from the LOCAL command-registry). Degrades to a
// withhold-default ('halt') when recipe-maps is unavailable -- never a fabricated
// autonomous_safe (T-166-02).
// ---------------------------------------------------------------------------
function _defaultPostureFn(command) {
  const rm = _loadRecipeMaps();
  if (rm && typeof rm.postureForCommand === 'function') {
    return rm.postureForCommand(command);
  }
  return { command: command || null, autonomous_safe: false, posture: 'halt' };
}

// ---------------------------------------------------------------------------
// IRREVERSIBLE forced-material classification (EXEC-03 HARD RULE + D-166-05).
// An irreversible step (sends email / deploys / publishes / external write) is
// FORCED-MATERIAL: it ALWAYS halts at the gate regardless of an autonomous_safe
// tag. Two signals: an explicit step.irreversible flag, OR the step's
// command/connector matching one of the frozen irreversible-action keywords.
// ---------------------------------------------------------------------------
const IRREVERSIBLE_HINTS = Object.freeze([
  'email',
  'deploy',
  'publish',
  'send',
  'release',
  'external-write',
  'external_write',
]);

function isIrreversibleStep(step) {
  if (!step || typeof step !== 'object') return false;
  if (step.irreversible === true) return true;
  const hay = String(step.command || '').toLowerCase();
  if (hay.length === 0) return false;
  for (const hint of IRREVERSIBLE_HINTS) {
    if (hay.indexOf(hint) !== -1) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Default gate predicate (EXEC-03, the single leverage point). Used when no
// gateFn is injected. Returns 'run' ONLY when ALL three hold:
//   1. the step's posture maps to push_forward (autonomous_safe), AND
//   2. the inbound priorOutput.quality is NOT 'low' (EXEC-02 quality carry), AND
//   3. the step is NOT irreversible (forced-material steps ALWAYS halt).
// Otherwise 'halt'. The posture is read via postureFn (recipe-maps default).
// makeGateFn(opts) returns the bound predicate; opts.postureFn overrides the
// posture authority (test seam / caller-supplied).
// ---------------------------------------------------------------------------
function makeGateFn(opts) {
  const o = opts || {};
  const postureFn = (typeof o.postureFn === 'function') ? o.postureFn : _defaultPostureFn;
  return function gateFn(step, posture, priorOutput) {
    // Forced-material irreversible step ALWAYS halts (HARD RULE), even when
    // autonomous_safe. Checked first so no tag can override it.
    if (isIrreversibleStep(step)) return 'halt';

    // Quality carry: a low-quality inbound output halts even an autonomous_safe
    // step (stops garbage-in-garbage-out propagation -- loop R3).
    if (priorOutput && priorOutput.quality === LOW_QUALITY) return 'halt';

    // Posture authority: resolve the verb. Prefer an explicitly-passed posture
    // object; otherwise ask the posture authority for the step's command.
    let verdict = (posture && typeof posture === 'object') ? posture : null;
    if (!verdict) verdict = postureFn(step && step.command);
    const autonomousSafe = !!(verdict && verdict.autonomous_safe === true);
    const verb = verdict && verdict.posture; // 'run' (push_forward) | 'halt'

    if (autonomousSafe && verb === 'run') return 'run';
    return 'halt';
  };
}

// ---------------------------------------------------------------------------
// runChain -- the loop runner (EXEC-01 / 02 / 03 / 04 / 06).
// ---------------------------------------------------------------------------
/**
 * runChain(steps, opts) -> { trace, completed, haltedAt }
 *
 * steps: ordered array of step objects. Each step carries at least { step, command }
 *        and MAY carry { irreversible:true, reach_id, framework, ... }.
 *
 * opts (the six-callback contract + the decideFn seam):
 *   postureFn(command) -> posture authority   (default recipe-maps.postureForCommand)
 *   gateFn(step, posture, priorOutput) -> 'run'|'halt'   (default makeGateFn({postureFn}))
 *   onStep(step, previousOutput) -> { chain_output, quality }   (REQUIRED; dispatches the brick)
 *   provenanceFn(step, result) -> frontmatter   (optional; called per run step when supplied)
 *   maxSteps   hard cap (default DEFAULT_MAX_STEPS) -- EXEC-06 budget brake
 *   onHalt(step, contexts) -> verb   (the Tri-Context gate; returns one of the 10 verbs)
 *   decideFn(turn, context) -> decision   (injectable decide() seam; default the real decide)
 *
 * Returns:
 *   trace      ONE ordered array; each entry { step, chain_output, decision_trace }
 *              (decision_trace is decide()'s return handle, UNCHANGED -- B2)
 *   completed  true when every step ran with no halt / no budget brake
 *   haltedAt   the step where the chain stopped (or a synthetic budget-brake marker),
 *              or null when completed
 *
 * Never throws on a callback fault that is recoverable; a missing onStep is the one
 * hard precondition (the loop has nothing to dispatch without it).
 */
function runChain(steps, opts) {
  const o = opts || {};
  const list = Array.isArray(steps) ? steps : [];

  const onStep = (typeof o.onStep === 'function') ? o.onStep : null;
  if (!onStep) {
    return {
      trace: [],
      completed: false,
      haltedAt: { step: null, reason: 'no_onStep_callback' },
    };
  }

  const postureFn = (typeof o.postureFn === 'function') ? o.postureFn : _defaultPostureFn;
  const gateFn = (typeof o.gateFn === 'function') ? o.gateFn : makeGateFn({ postureFn: postureFn });
  const onHalt = (typeof o.onHalt === 'function') ? o.onHalt : function () { return 'defer'; };
  const provenanceFn = (typeof o.provenanceFn === 'function') ? o.provenanceFn : null;
  const decideFn = (typeof o.decideFn === 'function') ? o.decideFn : _loadDecide();
  const maxSteps = (typeof o.maxSteps === 'number' && o.maxSteps > 0)
    ? Math.floor(o.maxSteps)
    : DEFAULT_MAX_STEPS;

  const trace = [];
  let completed = true;
  let haltedAt = null;
  let previousOutput = null; // EXEC-02: prior chain_output folds into the next step.
  let stepsRun = 0;

  for (let i = 0; i < list.length; i += 1) {
    const step = list[i];

    // EXEC-06 budget brake: a hard cap on steps run. When the next iteration would
    // exceed the budget, halt with a recorded reason (haltedAt names the brake).
    if (stepsRun >= maxSteps) {
      completed = false;
      haltedAt = { step: step, reason: 'budget_brake', maxSteps: maxSteps };
      break;
    }

    // EXEC-01 + B2: re-call decide() per loop to re-derive the next reach from the
    // navigated graph neighborhood. Capture its decision_trace handle UNCHANGED into
    // the trace. decide() is the LIVE next-step authority -- NOT rankedNextReach.
    // Wrapped so a decide() fault degrades to a null handle rather than crashing the
    // chain (the loop still runs; the trace records the absence).
    let decisionTrace = null;
    if (typeof decideFn === 'function') {
      try {
        const decision = decideFn({ step: step, index: i }, { previousOutput: previousOutput });
        // Record decide()'s decision_trace UNCHANGED (reference, never a copy / reshape).
        decisionTrace = (decision && decision.decision_trace) ? decision.decision_trace : null;
      } catch (_e) {
        decisionTrace = null;
      }
    }

    // EXEC-03: gate the step. posture authority is consulted via postureFn so the
    // gate fires on push_forward + not-low-quality + reversible. The default gateFn
    // resolves posture internally; an injected gateFn may use the passed posture.
    let posture = null;
    try { posture = postureFn(step && step.command); } catch (_e) { posture = null; }

    let verb = 'halt';
    try {
      verb = gateFn(step, posture, previousOutput);
    } catch (_e) {
      verb = 'halt'; // a gate fault is a withhold-default (fail closed).
    }

    if (verb !== 'run') {
      // HALT: hand to the Tri-Context Decision Gate (Part 3). onHalt returns the
      // user's verb. A [stop] verb is the kill switch: flush (return the trace built
      // so far) and end cleanly (EXEC-04). Any other verb also ends the loop here
      // (the chain halts at the first material step per Canon Part 3 -- B3: there is
      // NO convergence-driven continue).
      let userVerb = 'defer';
      try {
        userVerb = onHalt(step, { previousOutput: previousOutput, posture: posture, decisionTrace: decisionTrace });
      } catch (_e) {
        userVerb = 'defer';
      }
      completed = false;
      haltedAt = {
        step: step,
        reason: isIrreversibleStep(step) ? 'forced_material' : 'gate_halt',
        verb: userVerb,
        stopped: _isStopVerb(userVerb),
      };
      // Whether the verb is [stop] or another halt verb, the loop ends here and the
      // trace built ABOVE the stop is flushed (already in `trace`), never dropped.
      break;
    }

    // RUN: dispatch the per-step brick (framework-runner via onStep). It returns
    // { chain_output, quality }. Fold chain_output into the next previousOutput
    // (EXEC-02), carrying the quality enum forward via the result object.
    let result = null;
    try {
      result = onStep(step, previousOutput);
    } catch (_e) {
      // An onStep dispatch fault halts the chain (fail closed) rather than silently
      // continuing with a stale previousOutput.
      completed = false;
      haltedAt = { step: step, reason: 'onStep_fault' };
      break;
    }
    result = result || {};
    const chainOutput = (result.chain_output !== undefined) ? result.chain_output : null;
    const quality = (typeof result.quality === 'string') ? result.quality : null;

    // optional provenance side-channel (pipeline supplies it; act/ignite pass null).
    if (provenanceFn) {
      try { provenanceFn(step, result); } catch (_e) { /* best-effort; never load-bearing */ }
    }

    // EXEC-04 single trace: append ONE entry built from the step + its chain_output
    // + the UNCHANGED decide() decision_trace handle (B2).
    trace.push({
      step: step,
      chain_output: chainOutput,
      quality: quality,
      decision_trace: decisionTrace,
    });
    stepsRun += 1;

    // EXEC-06 quality early-stop: a step that returns quality:low on a gate-passed
    // path terminates the chain with a recorded reason (the downstream gate would
    // halt on it anyway; stopping now avoids dispatching a doomed next step).
    if (quality === LOW_QUALITY) {
      completed = false;
      haltedAt = { step: step, reason: 'quality_early_stop', quality: quality };
      break;
    }

    // EXEC-02: this step's chain_output becomes the next step's previousOutput,
    // carrying the quality forward so the gate can fire on it next hop.
    previousOutput = chainOutput;
  }

  return { trace: trace, completed: completed, haltedAt: haltedAt };
}

module.exports = {
  runChain: runChain,
  makeGateFn: makeGateFn,
  isIrreversibleStep: isIrreversibleStep,
  IRREVERSIBLE_HINTS: IRREVERSIBLE_HINTS,
  DEFAULT_MAX_STEPS: DEFAULT_MAX_STEPS,
};
