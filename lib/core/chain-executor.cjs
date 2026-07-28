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
 * NEXT-STEP AUTHORITY (EXEC-01 + B2 + SPEC Out-of-scope): the loop re-calls decideFn()
 * per iteration to re-derive the next reach, and records its return shape UNCHANGED
 * (B2 -- never reshape decide()'s return). decideFn has NO DEFAULT (Phase 237-03,
 * REACH-01): the loop's own ({step,index},{previousOutput}) call shape matches none
 * of the real navigation-engine.cjs decide()'s documented turn/context fields, so a
 * default that fed it straight to decide() reliably computed and stored an EMPTY
 * decision that nothing downstream reads (a 27-hit grep found zero consumers).
 * decideFn is therefore an OPTIONAL injectable seam ONLY: absent an adapter, no
 * decision is computed and trace[i].decision_trace stays null. The ONE supported
 * caller adapts this call onto the real decide({userText,sectionPath,sessionId},
 * context) contract -- see scripts/act-command.cjs (Phase 172-08 CIRS R4). Whichever
 * decideFn is (or is not) supplied, recipe-maps.rankedNextReach stays a contract-only
 * reader (live nav-engine consumption of the projection deferred with Phase 157); the
 * loop NEVER substitutes the projection's ranked list for decide().
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
 *     decideFn,     // OPTIONAL injectable decide() seam; NO DEFAULT (237-03, REACH-01).
 *                   // Absent, no decision is computed and decision_trace stays null.
 *                   // The only supported caller ADAPTS runChain's ({step,index},
 *                   // {previousOutput}) shape onto decide()'s real
 *                   // ({userText,sectionPath,sessionId}, context) contract --
 *                   // see scripts/act-command.cjs (Phase 172-08 CIRS R4).
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

// EXEC-05 (D-166-01): the bounded retry-with-backoff substrate the resilient
// onStep dispatch wraps. Lazily required so the legacy synchronous path never
// pays for it. chain-retry.cjs is a pure timing/error helper (zero Brain wire).
let _retry = null;
function _loadRetry() {
  if (_retry !== null) return _retry;
  try {
    _retry = require(path.join(__dirname, 'chain-retry.cjs'));
  } catch (_e) {
    _retry = false;
  }
  return _retry;
}

// EXEC-05 resume/journal substrate (D-166-02): the SOLE chain-state truth from
// Wave 1. The resilient path journals each completed step via recordStep and
// honors the isNext hard gate on resume so a partial re-run re-enters at the
// failed step WITHOUT re-running upstream. No new orchestration path is built.
let _pipelineState = null;
function _loadPipelineState() {
  if (_pipelineState !== null) return _pipelineState;
  try {
    _pipelineState = require(path.join(__dirname, '..', 'mcp', 'pipeline-state.cjs'));
  } catch (_e) {
    _pipelineState = false;
  }
  return _pipelineState;
}

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

// ---------------------------------------------------------------------------
// Phase 177 Wave 5 (BCH-09) -- the BEHAVIORAL_CHANNEL_ARMED kill-switch seam.
// The escape-hatch gate-SUPPRESSION branch (in makeGateFn below) is GATED by
// this flag. It is read LAZILY from its home (navigation/calibration-gate.cjs,
// shipped in 177-08) so the gate can never drift from the calibration owner's
// notion of ARMED, and so a missing dependency degrades to LOCKED (false) rather
// than crashing the legacy synchronous path at require time. The default is
// false ALWAYS today -- no real calibration PASS has armed it -- so the
// suppression branch is provably inert and makeGateFn() is byte-identical to its
// pre-seam behavior. We do NOT re-type the literal false here; we read the shipped
// constant so there is ONE source of truth.
// ---------------------------------------------------------------------------
let _calibrationArmed = null;
function _loadBehavioralChannelArmed() {
  if (_calibrationArmed !== null) return _calibrationArmed;
  try {
    const mod = require(path.join(__dirname, 'navigation', 'calibration-gate.cjs'));
    _calibrationArmed = (mod && typeof mod.BEHAVIORAL_CHANNEL_ARMED === 'boolean')
      ? mod.BEHAVIORAL_CHANNEL_ARMED
      : false;
  } catch (_e) {
    _calibrationArmed = false; // withhold-default: a missing owner stays LOCKED.
  }
  return _calibrationArmed;
}

// Pure helper: does the step carry an ACTIVE escape_hatch observation handle?
// Reads ONLY the step's escape_hatch scalar (a boolean / truthy enum surfaced by
// the Wave-1 observation schema -- "just tell me" / "bottom line"), never user
// prose, never an artifact body (Canon Part 8). The handle may sit directly on
// the step or on a step.observation sub-object (both Wave-1 surfaces); read both,
// scalar-only.
function _escapeHatchActive(step) {
  if (!step || typeof step !== 'object') return false;
  if (step.escape_hatch === true) return true;
  if (step.observation && typeof step.observation === 'object'
    && step.observation.escape_hatch === true) {
    return true;
  }
  return false;
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
// fable-mode (HARN-02, D-167-04): POSTURE-SCOPED material-step classification.
// fable-mode is net-new NAMING over the shipped quality machinery -- it invents
// NO fable model tier; model-profiles stays opus/sonnet/haiku. The verify +
// self-critique fires ONLY on MATERIAL / uncertain steps, NOT on every
// autonomous_safe step (this respects the 166 token analysis: do not burn
// tokens re-verifying trivially-safe steps). A step is material when:
//   1. its posture verb is NOT push_forward ('run'), OR
//   2. the step is irreversible (forced-material, EXEC-03), OR
//   3. the caller flags step.material === true.
// A trivially-safe push_forward + reversible step is NOT material -> the
// critique is SKIPPED on it.
// ---------------------------------------------------------------------------
function _isMaterialStep(step, posture) {
  if (isIrreversibleStep(step)) return true;
  if (step && step.material === true) return true;
  const verb = (posture && typeof posture === 'object') ? posture.posture : null;
  // A non-push_forward posture (verb !== 'run') is material / uncertain. An
  // absent posture is treated as uncertain -> material (withhold-default).
  if (verb !== 'run') return true;
  return false;
}

// ---------------------------------------------------------------------------
// fable-mode seam (HARN-02, D-167-04, MEDIUM-3). The ONE shared helper applied
// at BOTH execution seams (sync runChain + async _runChainResilient) so the two
// paths cannot drift. It runs AFTER the per-step result.quality is captured and
// BEFORE chain_output folds into the next previousOutput. When a selfCritiqueFn
// is supplied AND the step is material, it calls selfCritiqueFn(step, result);
// if the verdict indicates a FAILED self-critique (verdict.quality === 'low' OR
// verdict.passed === false), it AUGMENTS the captured quality to LOW_QUALITY so
// the EXISTING quality_early_stop branch + the next-hop makeGateFn LOW_QUALITY
// halt fire. It adds NO new halt reason, NO retry, NO loop -- the verdict is a
// gate INPUT, never a convergence stop condition (166 B3). A selfCritiqueFn
// fault degrades to NO augmentation (fail open on the critic, T-167-12): a
// broken critic must not silently halt every step, but a LOW verdict halts.
// Returns the (possibly augmented) quality string.
// ---------------------------------------------------------------------------
function _applySelfCritique(selfCritiqueFn, step, posture, result, quality) {
  if (typeof selfCritiqueFn !== 'function') return quality;
  if (!_isMaterialStep(step, posture)) return quality;
  let verdict = null;
  try {
    verdict = selfCritiqueFn(step, result);
  } catch (_e) {
    // Fail open on the critic itself: a thrown critic does not halt the chain.
    return quality;
  }
  if (verdict && (verdict.quality === LOW_QUALITY || verdict.passed === false)) {
    return LOW_QUALITY;
  }
  return quality;
}

// ---------------------------------------------------------------------------
// SEED-033 L1 (Phase 201-02): opt-in bounded Ralph verify+retry on an
// autonomous_safe step. This is DISTINCT from the material-step _applySelfCritique
// seam above (which stays material-only, token-economy per D-167-04). It fires ONLY
// when the caller opts a step in (step.ralph_verify === true) AND a selfCritiqueFn is
// supplied AND the step is autonomous_safe (NOT material / irreversible -- the caller
// guarantees this). It re-runs onStep up to min(cap, budgetRemaining) times while the
// critique fails, returning the FIRST passing result; if the retries are exhausted it
// returns the last result with quality forced to LOW_QUALITY so the EXISTING
// quality_early_stop + next-hop gate halt fire (the safe step still halts when it
// cannot self-correct -- Ralph inside the safe step, the gate still at the material
// one). Fail-open on a thrown critic (a broken critic must not force a halt).
// Bounded twice over: the cap AND the EXEC-06 step budget. Never unbounded.
// ---------------------------------------------------------------------------
const RALPH_RETRY_CAP_DEFAULT = 2;

function _safeCritique(selfCritiqueFn, step, result) {
  try { return selfCritiqueFn(step, result); } catch (_e) { return null; }
}

function _critiqueFailed(verdict) {
  return !!(verdict && (verdict.quality === LOW_QUALITY || verdict.passed === false));
}

function _ralphSafeRetry(params) {
  const step = params.step;
  const selfCritiqueFn = params.selfCritiqueFn;
  const onStep = params.onStep;
  const previousOutput = params.previousOutput;
  let result = params.initialResult;
  let quality = params.initialQuality;
  const cap = params.cap;
  const budgetRemaining = params.budgetRemaining;
  const maxRetries = Math.max(0, Math.min(cap, budgetRemaining));
  let attempts = 0;
  let verdict = _safeCritique(selfCritiqueFn, step, result);
  while (_critiqueFailed(verdict) && attempts < maxRetries) {
    attempts += 1;
    let retried;
    try { retried = onStep(step, previousOutput); } catch (_e) { break; }
    result = retried || {};
    quality = (typeof result.quality === 'string') ? result.quality : quality;
    verdict = _safeCritique(selfCritiqueFn, step, result);
  }
  // Exhausted = stopped WITHOUT a passing verdict. The step must HALT (never silently
  // proceed): force LOW so it falls through to the existing gate (Ralph inside the safe
  // step, the gate still at the material one). We ALSO name WHY it stopped, so the caller
  // can set a distinct haltedAt.reason (Task 3c): the EXEC-06 budget bound the retries
  // strictly below the cap (budget_brake), or the cap itself was reached (retry_exhausted).
  const exhausted = _critiqueFailed(verdict);
  let haltReason = null;
  if (exhausted) {
    quality = LOW_QUALITY;
    haltReason = (budgetRemaining < cap) ? 'budget_brake' : 'retry_exhausted';
  }
  return { result: result, quality: quality, attempts: attempts, exhausted: exhausted, haltReason: haltReason };
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
  // Phase 177 Wave 5 (BCH-09): the ARMED gate for the escape-hatch suppression
  // branch. Overridable via opts.armed (the TEST seam) so the armed-true path can
  // be exercised WITHOUT mutating the shipped BEHAVIORAL_CHANNEL_ARMED constant
  // (the calibration-gate change-control rule forbids flipping it to unblock a
  // wave). When opts.armed is absent it defaults to the LAZY calibration-gate read
  // -- false ALWAYS today.
  const armed = (typeof o.armed === 'boolean') ? o.armed : _loadBehavioralChannelArmed();
  return function gateFn(step, posture, priorOutput) {
    // (1) FORCED-MATERIAL FIRST (HARD RULE, UNCONDITIONAL, BCH-09). An irreversible
    // step (sends email / deploys / publishes / external write, OR step.irreversible)
    // ALWAYS halts -- armed or not, escape-hatch or not. This statement STAYS the
    // very first decision in gateFn; nothing may be added before it. Because the
    // irreversible step returns here, the escape-hatch suppression branch below can
    // NEVER reach a forced-material step -- the guardrail is structurally upstream.
    if (isIrreversibleStep(step)) return 'halt';

    // (2) Quality carry: a low-quality inbound output halts even an autonomous_safe
    // step (stops garbage-in-garbage-out propagation -- loop R3).
    if (priorOutput && priorOutput.quality === LOW_QUALITY) return 'halt';

    // Posture authority: resolve the verb ONCE. Prefer an explicitly-passed posture
    // object; otherwise ask the posture authority for the step's command. Shared by
    // both the escape-hatch suppression branch (3) and the normal return (4) so the
    // two cannot read a different posture.
    let verdict = (posture && typeof posture === 'object') ? posture : null;
    if (!verdict) verdict = postureFn(step && step.command);
    const autonomousSafe = !!(verdict && verdict.autonomous_safe === true);
    const verb = verdict && verdict.posture; // 'run' (push_forward) | 'halt'

    // (3) Escape-hatch gate-SUPPRESSION (Phase 177 Wave 5, BCH-09) -- WIRED-BUT-
    // SHADOWED. When ARMED and the step carries an ACTIVE escape_hatch, the gate may
    // SUPPRESS the Decision Gate (return 'run' instead of halting for human
    // confirmation) -- but ONLY for an already autonomous_safe + reversible step.
    // It NEVER escalates a non-safe step, and it can NEVER reach an irreversible /
    // forced-material step (that returned 'halt' at the UNCONDITIONAL first check
    // above). The branch reads ONLY the ARMED boolean, the escape_hatch scalar
    // handle, and the resolved posture enum -- never user prose, never an artifact
    // body (Canon Part 8 LOCAL -> BRAIN: NO; the gate adds no Brain wire).
    //
    // DORMANT CONTRACT: when unarmed (always today, because no real calibration PASS
    // has armed the flag) this branch's guard is false, so it suppresses NOTHING and
    // falls through to the identical (4) return -- makeGateFn() is byte-identical to
    // its pre-seam behavior, the Decision Gate fires unchanged, and the escape_hatch
    // handle has zero effect on the verb. The LIVE flip (a real gate actually
    // suppressed) happens only when a real calibration PASS arms the flag -- that
    // arming is data-gated (177-08 fit.method:'deferred') AND Canon-Custodian-gated
    // (Canon Part 8 PR gate). This wave does NOT weaken the human-in-the-loop
    // Decision Gate today.
    if (armed && _escapeHatchActive(step) && autonomousSafe && verb === 'run') {
      return 'run';
    }

    // (4) Normal posture/autonomous_safe return (the pre-seam terminal decision).
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
 *   decideFn(turn, context) -> decision   (OPTIONAL injectable decide() seam; NO DEFAULT
 *     as of 237-03/REACH-01 -- when absent, no decision is computed and
 *     trace[i].decision_trace stays null. The only supported caller ADAPTS runChain's
 *     own ({step,index},{previousOutput}) shape onto decide()'s real
 *     ({userText,sectionPath,sessionId}, context) contract; see scripts/act-command.cjs,
 *     the reference adapter (Phase 172-08 CIRS R4).)
 *   selfCritiqueFn(step, result) -> verdict   (fable-mode, HARN-02 / D-167-04; OPTIONAL,
 *     default a no-op pass-through. POSTURE-SCOPED: fires only on material steps. A verdict
 *     with quality:'low' or passed:false AUGMENTS result.quality -> the existing LOW_QUALITY
 *     halt. Rides BOTH the sync runChain path and the async _runChainResilient path.)
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

  // EXEC-05 dispatch: when ANY reliability opt is present (retries / journal /
  // roomDir / resume / sleep), run the ASYNC resilient path -- onStep wrapped in
  // bounded retry-with-backoff, exhaustion folded into a GRACEFUL PARTIAL, the
  // position journaled via the Wave-1 pipeline-state substrate. The legacy
  // synchronous path below is UNCHANGED for callers that pass none of these
  // (Wave-2 contract preserved byte-for-byte). This is ONE entry point, not a
  // consumer-visible fork: runChain stays the single door (D-166-04).
  if (
    o.retries !== undefined ||
    o.journal === true ||
    o.roomDir !== undefined ||
    o.resume === true ||
    typeof o.sleep === 'function'
  ) {
    return _runChainResilient(list, o);
  }

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
  // Phase 237-03 (REACH-01): NO default. decideFn is an OPTIONAL injectable seam
  // -- when absent, no decision is computed and every trace entry's
  // decision_trace stays null (see the call site below for why the DEFAULT was
  // removed while the seam itself was kept).
  const decideFn = (typeof o.decideFn === 'function') ? o.decideFn : null;
  // fable-mode (HARN-02 / D-167-04): default a no-op so an absent selfCritiqueFn
  // is byte-identical to the Wave-166 behavior (regression guard).
  const selfCritiqueFn = (typeof o.selfCritiqueFn === 'function') ? o.selfCritiqueFn : null;
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
    //
    // Phase 237-03 (REACH-01): decideFn has NO default -- when the caller does
    // not inject an ADAPTED decideFn, this block simply does not run and
    // decisionTrace stays null. Why the old default was removed: the call
    // below passes runChain's own ({step,index},{previousOutput}) shape, which
    // matches none of the real decide()'s documented turn/context fields (all
    // read as undefined); decide() never throws (it falls through to
    // emptyDecision()), so the old default reliably computed and stored an
    // EMPTY decision, and a 27-hit grep across lib/ and scripts/ found zero
    // consumers of runChain's stored decision_trace. The seam itself is kept:
    // scripts/act-command.cjs injects an ADAPTED decideFn that reshapes this
    // exact call onto a real decide({userText,sectionPath,sessionId}, context)
    // call (Phase 172-08 CIRS R4) -- that is the ONLY supported caller shape.
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
    let quality = (typeof result.quality === 'string') ? result.quality : null;

    // SEED-033 L1 (201-02): opt-in bounded Ralph verify+retry on an autonomous_safe
    // step. DEFAULT OFF (token economy, D-167-04) -- fires ONLY when step.ralph_verify
    // is true, a selfCritiqueFn is supplied, and the step is autonomous_safe (NOT
    // material / irreversible). It may replace `result` with a passing retry, or force
    // LOW when the retries are exhausted; retry re-runs count against the EXEC-06 budget
    // (stepsRun += ralphAttempts below). Material steps are UNTOUCHED -- they keep the
    // _applySelfCritique-as-halt-input path below (B3 intact).
    let ralphAttempts = 0;
    let ralphHaltReason = null;
    if (step && step.ralph_verify === true && typeof selfCritiqueFn === 'function' &&
        !_isMaterialStep(step, posture)) {
      const budgetRemaining = Math.max(0, maxSteps - stepsRun - 1);
      const cap = (typeof o.ralphRetryCap === 'number' && o.ralphRetryCap >= 0)
        ? Math.floor(o.ralphRetryCap) : RALPH_RETRY_CAP_DEFAULT;
      const r = _ralphSafeRetry({
        step: step, selfCritiqueFn: selfCritiqueFn, onStep: onStep,
        previousOutput: previousOutput, initialResult: result, initialQuality: quality,
        cap: cap, budgetRemaining: budgetRemaining,
      });
      result = r.result;
      quality = r.quality;
      ralphAttempts = r.attempts;
      if (r.exhausted) ralphHaltReason = r.haltReason;
    }

    const chainOutput = (result.chain_output !== undefined) ? result.chain_output : null;

    // fable-mode seam (HARN-02 / D-167-04): posture-scoped self-critique runs
    // AFTER the result.quality capture and BEFORE the previousOutput fold. On a
    // material step a failed verdict augments quality to LOW_QUALITY, feeding the
    // EXISTING quality_early_stop branch + next-hop LOW_QUALITY gate. Shared with
    // the async path via _applySelfCritique so the two seams cannot drift. (Safe-step
    // verify+retry is the L1 opt-in above; this stays material-only.)
    quality = _applySelfCritique(selfCritiqueFn, step, posture, result, quality);

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
    // EXEC-06: this step plus any L1 verify+retry re-runs count against the budget.
    stepsRun += 1 + ralphAttempts;

    // SEED-033 L1 (201-02, Task 3): an EXHAUSTED opt-in safe-step retry HALTS with a
    // DISTINCT reason so the halt is observable as a Ralph-loop exhaustion rather than a
    // plain low-quality stop. retry_exhausted = the cap bound; budget_brake = the EXEC-06
    // budget bound below the cap. Either way the step HALTS (falls through to the gate,
    // never silently proceeds) -- this branch precedes the generic quality_early_stop so
    // the specific reason wins. Material steps never reach here (guarded above; B3 intact).
    if (ralphHaltReason) {
      completed = false;
      haltedAt = { step: step, reason: ralphHaltReason, quality: quality, ralphAttempts: ralphAttempts };
      break;
    }

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

// ---------------------------------------------------------------------------
// _runChainResilient -- the EXEC-05 / D-166-01 async path (graceful partial).
// ---------------------------------------------------------------------------
/**
 * Same six-callback contract as runChain, PLUS the reliability opts:
 *   retries     bounded retries on a transient 5xx (default chain-retry default)
 *   baseDelayMs / maxDelayMs   the exponential-with-cap backoff knobs
 *   sleep       injectable sleep (tests pass a no-op recorder; default real timer)
 *   roomDir     the room for the pipeline-state journal (resume/journal substrate)
 *   journal     when true, recordStep journals each completed step (D-166-02)
 *   resume      when true, honor the pipeline-state isNext hard gate and SKIP any
 *               step already past the journaled position (re-enter at the failed
 *               step; do NOT re-run upstream)
 *
 * Returns (async): { trace, completed, haltedAt, partial }
 *   - On a clean run: { completed:true, haltedAt:null, partial:false }.
 *   - On retry exhaustion (transient) OR a non-transient onStep fault: a GRACEFUL
 *     PARTIAL -- the upstream trace is PRESERVED, a { step, failure:{code,reason},
 *     partial:true } marker is folded into the ONE trace, the position is
 *     journaled, and the return carries { completed:false, partial:true,
 *     haltedAt:{ step, reason } }. NEVER null, NEVER a silent drop (SEED-028 /
 *     the AION failure mode).
 *
 * The onStep dispatch is wrapped in chain-retry.withBackoff(isTransient): a
 * transient 5xx retries with bounded backoff; a non-transient error fails fast.
 * Reuses the Wave-1 pipeline-state.recordStep / isNext hard gate -- builds NO new
 * orchestration path (Canon Part 7).
 *
 * fable-mode (HARN-02 / D-167-04, MEDIUM-3): the SAME selfCritiqueFn opt rides
 * this async path. The seam is MIRRORED here at the same logical position --
 * AFTER the post-withBackoff result.quality capture (so the dispatchError
 * graceful-partial marker is never double-handled) and BEFORE the previousOutput
 * fold -- via the ONE shared _applySelfCritique helper, so the sync and async
 * seams cannot drift. A material step that fails self-critique gets quality
 * augmented to LOW_QUALITY, feeding the identical quality_early_stop / LOW_QUALITY
 * halt.
 */
async function _runChainResilient(list, o) {
  const onStep = (typeof o.onStep === 'function') ? o.onStep : null;
  if (!onStep) {
    return { trace: [], completed: false, haltedAt: { step: null, reason: 'no_onStep_callback' }, partial: false };
  }

  const postureFn = (typeof o.postureFn === 'function') ? o.postureFn : _defaultPostureFn;
  const gateFn = (typeof o.gateFn === 'function') ? o.gateFn : makeGateFn({ postureFn: postureFn });
  const onHalt = (typeof o.onHalt === 'function') ? o.onHalt : function () { return 'defer'; };
  const provenanceFn = (typeof o.provenanceFn === 'function') ? o.provenanceFn : null;
  // Phase 237-03 (REACH-01): NO default, mirroring the sync path above (both
  // sites must change identically; see the sync site's comment for the full
  // rationale). Absent a caller-injected decideFn, decision_trace stays null.
  const decideFn = (typeof o.decideFn === 'function') ? o.decideFn : null;
  // fable-mode (HARN-02 / D-167-04): the SAME opt as the sync path; default no-op
  // so an absent selfCritiqueFn keeps this path byte-identical to Wave-166.
  const selfCritiqueFn = (typeof o.selfCritiqueFn === 'function') ? o.selfCritiqueFn : null;
  const maxSteps = (typeof o.maxSteps === 'number' && o.maxSteps > 0)
    ? Math.floor(o.maxSteps)
    : DEFAULT_MAX_STEPS;

  // Reliability knobs.
  const retry = _loadRetry();
  const sleep = (typeof o.sleep === 'function') ? o.sleep : undefined;
  const retries = (typeof o.retries === 'number' && o.retries >= 0) ? Math.floor(o.retries) : undefined;
  const baseDelayMs = (typeof o.baseDelayMs === 'number') ? o.baseDelayMs : undefined;
  const maxDelayMs = (typeof o.maxDelayMs === 'number') ? o.maxDelayMs : undefined;

  // Journal/resume substrate (Wave-1 pipeline-state.cjs, D-166-02).
  const roomDir = (typeof o.roomDir === 'string') ? o.roomDir : null;
  const doJournal = o.journal === true && roomDir;
  const doResume = o.resume === true && roomDir;
  const ps = (doJournal || doResume) ? _loadPipelineState() : false;

  const trace = [];
  let completed = true;
  let haltedAt = null;
  let partial = false;
  let previousOutput = null;
  let stepsRun = 0;

  for (let i = 0; i < list.length; i += 1) {
    const step = list[i];

    // EXEC-06 budget brake (unchanged contract).
    if (stepsRun >= maxSteps) {
      completed = false;
      haltedAt = { step: step, reason: 'budget_brake', maxSteps: maxSteps };
      break;
    }

    // D-166-02 resume: re-enter at the journaled failed step, do NOT re-run
    // upstream. The SOLE chain-state truth (pipeline-state.cjs) advances its
    // chain_position via recordStep only for COMPLETED steps, so any step whose
    // command sits at-or-before that journaled cursor has already run and is
    // SKIPPED. The first un-journaled step is the resume re-entry point.
    if (doResume && ps && typeof ps.read === 'function') {
      let journal = null;
      try { journal = ps.read(roomDir); } catch (_e) { journal = null; }
      if (journal && Array.isArray(journal.chain)) {
        const cursor = (typeof journal.chain_position === 'number') ? journal.chain_position : -1;
        const stepIdxInChain = journal.chain.indexOf(step.command);
        if (stepIdxInChain !== -1 && stepIdxInChain <= cursor) {
          // Already journaled as completed: skip without re-dispatching onStep.
          continue;
        }
      }
    }

    // EXEC-01 + B2: re-call decide() per loop; record decision_trace UNCHANGED.
    // Phase 237-03 (REACH-01): decideFn has NO default -- see the sync path's
    // comment above the identical block for the full rationale (unadapted
    // shape, dead default, preserved seam for scripts/act-command.cjs).
    let decisionTrace = null;
    if (typeof decideFn === 'function') {
      try {
        const decision = decideFn({ step: step, index: i }, { previousOutput: previousOutput });
        decisionTrace = (decision && decision.decision_trace) ? decision.decision_trace : null;
      } catch (_e) {
        decisionTrace = null;
      }
    }

    // EXEC-03 gate (unchanged): fail-closed halt on a gate fault.
    let posture = null;
    try { posture = postureFn(step && step.command); } catch (_e) { posture = null; }
    let verb = 'halt';
    try { verb = gateFn(step, posture, previousOutput); } catch (_e) { verb = 'halt'; }

    if (verb !== 'run') {
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
      break;
    }

    // RUN: dispatch the per-step brick THROUGH bounded retry-with-backoff
    // (EXEC-05). A transient 5xx retries with backoff; a non-transient error
    // fails fast inside withBackoff and surfaces here as a throw.
    let result = null;
    let dispatchError = null;
    try {
      if (retry && typeof retry.withBackoff === 'function') {
        result = await retry.withBackoff(
          function () { return onStep(step, previousOutput); },
          {
            retries: retries,
            baseDelayMs: baseDelayMs,
            maxDelayMs: maxDelayMs,
            sleep: sleep,
            // We want the loop -- not withBackoff -- to author the graceful
            // partial, so ask for the thrown marker on exhaustion and catch it.
            returnMarkerOnExhaust: false,
          }
        );
      } else {
        // Degrade gracefully when chain-retry is unavailable: a single attempt.
        result = await onStep(step, previousOutput);
      }
    } catch (err) {
      dispatchError = err;
    }

    if (dispatchError) {
      // GRACEFUL PARTIAL (SEED-028 / the AION failure mode). The chain is NEVER
      // silently dropped: fold a failure marker into the ONE trace, journal the
      // position, and return the upstream trace preserved with partial:true.
      const transient = !!(retry && typeof retry.isTransient === 'function' && retry.isTransient(dispatchError));
      const code = (typeof dispatchError.code === 'number')
        ? dispatchError.code
        : _codeFromError(dispatchError);
      const reason = dispatchError.exhausted === true
        ? 'transient_retry_exhausted'
        : (transient ? 'transient_failure' : 'non_transient_hard_failure');

      trace.push({
        step: step,
        chain_output: null,
        quality: null,
        decision_trace: decisionTrace,
        failure: {
          code: (typeof code === 'number') ? code : null,
          reason: reason,
          message: (dispatchError && dispatchError.message) ? String(dispatchError.message) : null,
          attempts: (typeof dispatchError.attempts === 'number') ? dispatchError.attempts : 1,
        },
        partial: true,
      });

      // Journal the failed position so a resume re-enters HERE (D-166-02). The
      // journal cursor stays at the last SUCCEEDED step; the failed step is
      // recorded only in the trace, so checkPosition still names it as next.
      completed = false;
      partial = true;
      haltedAt = {
        step: step,
        reason: reason,
        partial: true,
        code: (typeof code === 'number') ? code : null,
      };
      break;
    }

    result = result || {};
    const chainOutput = (result.chain_output !== undefined) ? result.chain_output : null;
    let quality = (typeof result.quality === 'string') ? result.quality : null;

    // fable-mode seam (HARN-02 / D-167-04, MEDIUM-3): MIRROR of the sync seam.
    // Runs AFTER the post-withBackoff dispatchError guard (so a graceful-partial
    // failure marker is never touched by the critique) and BEFORE the
    // previousOutput fold. Shared with the sync path via _applySelfCritique.
    quality = _applySelfCritique(selfCritiqueFn, step, posture, result, quality);

    if (provenanceFn) {
      try { provenanceFn(step, result); } catch (_e) { /* best-effort */ }
    }

    trace.push({
      step: step,
      chain_output: chainOutput,
      quality: quality,
      decision_trace: decisionTrace,
    });
    stepsRun += 1;

    // D-166-02: journal the COMPLETED step via the Wave-1 recordStep so a resume
    // advances the cursor and skips it next time. The artifact path is the
    // step's chain_output handle (a generic reference, never user content -- the
    // body never leaves onStep; Part 8).
    if (doJournal && ps && typeof ps.recordStep === 'function') {
      try {
        ps.recordStep(roomDir, step.command, 'chain-output:' + step.command);
      } catch (_e) { /* journal is best-effort; the trace remains the truth */ }
    }

    // EXEC-06 quality early-stop (unchanged).
    if (quality === LOW_QUALITY) {
      completed = false;
      haltedAt = { step: step, reason: 'quality_early_stop', quality: quality };
      break;
    }

    previousOutput = chainOutput;
  }

  return { trace: trace, completed: completed, haltedAt: haltedAt, partial: partial };
}

// Pull a numeric status off an error when chain-retry did not already decorate
// it with .code (e.g. a non-transient error that failed fast). Mirrors
// chain-retry's _extractCode minimally for the failure-marker code field.
function _codeFromError(err) {
  if (!err || typeof err !== 'object') return null;
  if (typeof err.status === 'number') return err.status;
  if (typeof err.statusCode === 'number') return err.statusCode;
  return null;
}

module.exports = {
  runChain: runChain,
  makeGateFn: makeGateFn,
  isIrreversibleStep: isIrreversibleStep,
  IRREVERSIBLE_HINTS: IRREVERSIBLE_HINTS,
  DEFAULT_MAX_STEPS: DEFAULT_MAX_STEPS,
  // Phase 177 Wave 5 (BCH-09): re-export the LOCKED arming flag (read lazily from
  // its calibration-gate home; false ALWAYS today) so callers/tests can read the
  // shipped default WITHOUT re-typing the literal. This getter never mutates the
  // owner's constant -- arming the live escape hatch is data-gated AND
  // Canon-Custodian-gated, out of scope for this wave.
  get BEHAVIORAL_CHANNEL_ARMED() { return _loadBehavioralChannelArmed(); },
};
