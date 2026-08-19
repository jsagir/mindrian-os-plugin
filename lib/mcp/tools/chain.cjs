'use strict';
// Phase 198-07 (SPEC-3, Task 1) -- chain_resolve + chain_run: server-side
// chain execution honoring postures.
//
// chain_resolve wraps lib/workflow/command-resolver.cjs::composeWorkflow (the
// ONE governed reach path, R4) -- a read-only resolution of a framework-name
// chain into its command plan. It executes nothing.
//
// chain_run WRAPS the shipped lib/core/chain-executor.cjs::runChain (Phase
// 166) -- it mints NO second executor and NO second gate predicate. It runs
// the autonomous_safe prefix (posture authority OWNED SOLELY by
// lib/core/recipe-maps.cjs's exported posture-authority function -- see the
// Phase 237-02 note below; this file mints no posture authority of its own),
// and HALTS at the first material step, rendering a gate
// through the SAME lib/mcp/gate-render.cjs ladder gate_render/framework_run
// use, instead of executing it unattended (T-198-11). gate_answer is the ONE
// documented resume verb for a material step: an approve verdict through
// gate_answer ratifies AND runs the halted step in the same call, via a
// resumeFn handle minted onto the gate_id's single-use resume-ledger entry
// at halt time (mint on halt, consume on resume, 30-minute TTL -- the
// T-198-10 pattern, T-198-12 spoofing mitigation: a verdict for an
// unknown/expired gate_id never resumes anything). chain_run's own
// gate_answer parameter is the SAME execution path's direct programmatic
// entry point, not a second step of a documented flow -- the ledger is
// single-use, so whichever of the two consumes the entry first is the only
// one that ever executes; the other caller for that gate_id is refused with
// unknown_or_expired_gate.
//
// Any material write the resumed step performs routes EXCLUSIVELY through
// lib/core/navigation.cjs (Part 9, T-198-04) -- this file never opens the
// graph store directly.
//
// Phase 234-05 (D-05, Gap D) DELIBERATELY LEAVES THIS FILE'S GATING ALONE, and
// the reason is worth writing down so a future reader does not "fix" it.
// 234-05 moved the write gate on graph_write / memory_event / artifact_file
// from registration time to call time, because those three were HIDDEN from
// tools/list whenever MINDRIAN_MCP_FIRST was off, which is the default on
// every foreign MCP host. chain_run never had that registration gate: it has
// always been registered unconditionally. Its governance is the gate ladder
// above (halt at the first material step, render a gate, execute only on an
// approve verdict matched to this process's single-use resume ledger), gated
// by the ONE autonomy authority (see the Phase 237-02 note below). That is a
// STRONGER and more specific control than a blanket write-path flag.
//
// Adding isWritePathEnabled here would therefore not close a gap; it would
// OPEN one. 2026-08-19 amendment (quick task 260819-bql): the original reason
// stated here -- "isWritePathEnabled is false for Claude Code by design" -- is
// no longer true; isWritePathEnabled now returns true for Claude Code (see
// lib/mcp/mcp-first-flag.cjs). The CONCLUSION still stands regardless:
// isWritePathEnabled answers "may this call write through navigation.cjs",
// which is a different question from "may this chain auto-run a material
// step". Conflating them would swap chain_run's gate ladder plus the ONE
// autonomy authority (a stronger, more specific control) for a blanket
// write-path flag.
//
// Phase 248-01 (CTX-01): per-session write-room resolution now goes through
// lib/mcp/session-room.cjs, the ONE shared MCP resolver. isMcpFirst is no
// longer imported by this file.
//
// Phase 237-02 (REACH-02): this file used to mint its OWN posture/autonomy
// classifier here, joined from the generated per-surface reach-dial JSON
// manifest's `posture` field (a PEDAGOGICAL reach dial drawn from the
// frozen-3 vocabulary: auto-run / hold / pull-back). That was a category
// error, not a data-sync bug: connector posture answers "which way does this
// reach move the navigator", never
// "may this run unattended". Reading it as an autonomy answer let chain_run
// auto-run 12 commands framework_run correctly gated as material, including
// /mos:ignite and /mos:new-project (measured live: 48/112 registered
// commands disagreed between the two authorities). Autonomy classification
// is now owned SOLELY by lib/core/recipe-maps.cjs's exported posture-
// authority function, which delegates to
// lib/workflow/command-resolver.cjs::validateChainAutonomy -- the exact same
// call framework_run makes. chain_run mints NO posture authority of its own:
// chainRun's own postureFn default is `undefined`, which falls through to
// chain-executor.cjs's own `_defaultPostureFn` (= recipe-maps.cjs's exported
// posture-authority function). connector.posture MUST NEVER be read again in
// this file as an autonomy answer -- see tests/test-237-one-authority-fence.cjs,
// a structural source fence against exactly that reintroduction. The
// withhold-default half of the discipline this file used to call "T-166-02"
// (an unknown command halts, never a fabricated safe) is preserved unchanged
// -- it now lives entirely in chain-executor.cjs's `_defaultPostureFn` /
// recipe-maps.cjs's own posture authority, not duplicated here.
//
// Phase 237-08 (REACH-01, the approve-to-execute seam): this file used to
// wire a log-only stub as chain_run's onStep default -- it wrote one
// memory_event and unconditionally reported a fabricated top verdict
// without ever resolving step.command to anything runnable, so approving
// a Decision Gate produced a log line and a false-success readout, never
// a real side effect. That stub is deleted. chain_run's onStep default is
// now lib/core/chain-step-dispatcher.cjs::makeChainStepDispatcher, the
// two-tier honest dispatcher (Phase 237-07): it genuinely spawns a
// script-backed step and verifies the declared artifact on disk, or
// honestly refuses a prompt-backed (methodology) step with a null
// verdict plus a requires_host_dispatch directive, never a fabricated
// top verdict. See the doc comment directly above chainRun's onStep
// default assignment for the full two-tier contract.
// tests/test-237-approve-executes.cjs drives this end to end through the
// real mint/answer/resume path with no injected onStep, and carries a
// live mutation proof that restoring the log-only stub turns the gate
// red.
//
// Canon Part 7: reuses chain-executor.runChain, command-resolver.composeWorkflow,
// and gate-render.renderGate -- zero re-implementation. Canon Part 8: zero
// Brain/network tokens. Canon Part 11 (born-wired): register(server, ctx) +
// connectors export, same disjoint-file module contract as room.cjs / graph.cjs
// / gate.cjs / sensors.cjs -- never requires those modules or
// lib/mcp/tool-router.cjs at module-load time. gate-render.cjs is NOT a
// lib/mcp/tools/*.cjs module (it lives one directory up), so requiring it here
// mirrors gate.cjs's own require -- not a tools/tools collision.
//
// No em-dashes. CJS only.

const { z } = require('zod');

const chainExecutor = require('../../core/chain-executor.cjs');
const { composeWorkflow } = require('../../workflow/command-resolver.cjs');
const gateRender = require('../gate-render.cjs');
const { resolveEffectiveSessionId } = require('../../core/session-binding.cjs');
const { resolveSessionRoomDir } = require('../session-room.cjs');
const { makeChainStepDispatcher } = require('../../core/chain-step-dispatcher.cjs');
const gateLedger = require('../gate-ledger.cjs');

function textResponse(payload, isError) {
  const result = { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
  if (isError) result.isError = true;
  return result;
}


/**
 * detectClientCapabilities -- the SAME ladder-detection shape gate.cjs /
 * sensors.cjs use (kept as an independent copy per the disjoint-file
 * contract).
 */
const CLAUDE_HOST_SURFACES = ['cli', 'desktop', 'cowork'];

function detectClientCapabilities(server, ctx) {
  let elicitation = false;
  try {
    const caps = (server && server.server && typeof server.server.getClientCapabilities === 'function')
      ? server.server.getClientCapabilities()
      : null;
    elicitation = !!(caps && caps.elicitation);
  } catch (_e) {
    elicitation = false;
  }
  const surface = (ctx && typeof ctx.surface === 'string') ? ctx.surface : null;
  const claudeCode = !elicitation && surface !== null && CLAUDE_HOST_SURFACES.indexOf(surface) !== -1;
  return { elicitation: elicitation, claudeCode: claudeCode };
}

// -----------------------------------------------------------------------
// chain_resolve -- wraps composeWorkflow. Read-only; executes nothing.
// -----------------------------------------------------------------------
function chainResolve(frameworkChain) {
  return composeWorkflow(frameworkChain);
}

// -----------------------------------------------------------------------
// The default onStep: chain_run's WIRED executor for the material step it
// halts on. Phase 237-08 (REACH-01): this used to be a log-only stub
// (deleted, see the module header's own Phase 237-08 note) that wrote
// one memory_event and unconditionally reported a fabricated top verdict
// without ever resolving step.command to anything runnable -- see
// 237-RESEARCH.md's REACH-01 section for the full defect writeup this
// rewire closes.
//
// It is now lib/core/chain-step-dispatcher.cjs's two-tier honest
// dispatcher (Phase 237-07): a script-backed step (TIER_EXECUTABLE)
// genuinely spawns via a bounded, argv-array child process and verifies
// its declared artifact exists on disk afterward -- the top verdict is
// reported ONLY on a verified real execution, never fabricated. A
// prompt-backed (methodology) step (TIER_HOST_DISPATCH) returns a null
// verdict (NEVER the top one) plus a requires_host_dispatch directive
// naming agents/framework-runner.md, because the MCP server cannot
// invoke a Claude Code subagent or slash command -- no server-initiated
// slash-command execution, no MCP sampling (confirmed against the
// official Claude Code MCP docs, 237-RESEARCH.md). A caller (a test, or a
// future richer dispatcher) may inject its own onStep via opts.onStep;
// this default is only the wired fallback.
// -----------------------------------------------------------------------

// -----------------------------------------------------------------------
// T-198-10-pattern / T-198-12 mitigation: the resume ledger now lives in
// lib/mcp/gate-ledger.cjs -- the SAME session-keyed, single-use, TTL-bounded
// ledger gate_answer consumes from (238-RESEARCH.md Finding 1: chain_run
// used to mint its gate id into a private Map here while gate_answer looked
// in gate.cjs's own _liveGates, so the documented resume flow failed at step
// two with unknown_or_expired_gate). A gate_answer verdict naming a gate_id
// this process never minted (forged, replayed, or belonging to a different
// tool's gate) is rejected before any step executes. _mintResumeLedger and
// _consumeResumeLedger below are thin named wrappers over the shared
// module's mintGate/consumeGate, kept so existing tests and this file's own
// _internal export keep resolving without a rename.
// -----------------------------------------------------------------------
function _mintResumeLedger(gateId, entry) {
  gateLedger.mintGate(gateId, entry);
}

function _consumeResumeLedger(gateId, sessionId) {
  return gateLedger.consumeGate(gateId, sessionId);
}

/**
 * _buildMaterialStepCard(step) -> the gate superset card composed for a
 * halted material step. Options' ids ARE the gate_answer verdict vocabulary
 * (approve/reject/defer) so renderGate's verdictFor identity-maps the chosen
 * option straight to the verdict -- no extra translation layer.
 */
function _buildMaterialStepCard(step) {
  const label = (step && (step.command || step.framework)) || ('step ' + (step && step.step));
  return {
    header: 'Confirm material step: ' + label,
    kind: 'general',
    select_mode: 'single',
    options: [
      { id: 'approve', label: 'Approve - run ' + label },
      { id: 'reject', label: 'Reject - do not run this step' },
      { id: 'defer', label: 'Defer - decide later' },
    ],
  };
}

/**
 * chainRun(steps, opts) -> the SPEC-3 core. Two modes, selected by
 * opts.gateAnswer:
 *
 *   START (opts.gateAnswer absent): wraps chain-executor.cjs::runChain over
 *   `steps` (the composeWorkflow shape: { step, framework, command, optional }
 *   entries). Runs the autonomous_safe prefix (posture resolved by
 *   chain-executor.cjs's own `_defaultPostureFn`, which resolves to
 *   recipe-maps.cjs's exported posture-authority function, the ONE autonomy
 *   authority, unless opts.postureFn overrides -- this file mints no posture
 *   authority of its own; see the Phase 237-02 module header note). HALTS at
 *   the first material step -- the SHIPPED gate
 *   predicate (chain-executor.cjs's makeGateFn, via runChain's own default)
 *   decides this, not a second gate re-implementation here. On halt, renders
 *   a gate (lib/mcp/gate-render.cjs::renderGate, the SAME ladder gate_render
 *   uses) and mints a single-use resume-ledger entry keyed by the minted
 *   gate_id, capturing the halted step + the remaining chain + the folded
 *   previousOutput so a later RESUME call can continue exactly where the
 *   chain stopped.
 *
 *   RESUME (opts.gateAnswer present, shape { gate_id, chosen, verdict }):
 *   `steps` is ignored. The gate_id is consumed from THIS process's resume
 *   ledger (T-198-12: an unknown/expired gate_id resumes nothing). A
 *   non-approve verdict returns without executing the material step
 *   (executed:false). An approve verdict executes the halted step directly
 *   (the gate already resolved it -- this does NOT re-run it through the
 *   gate) via the SAME onStep the original call used, then continues any
 *   remaining steps through a recursive chainRun (so a further material step
 *   later in the chain halts through the identical path).
 *
 * @param {Array<{step:number, framework?:string, command:string|null, optional?:boolean}>} steps
 * @param {{
 *   roomDir?: string, sessionId?: string, onStep?: Function,
 *   postureFn?: Function, maxSteps?: number, gateRenderCtx?: object,
 *   gateAnswer?: {gate_id: string, chosen: string[], verdict: string},
 * }} opts
 */
async function chainRun(steps, opts) {
  const o = opts || {};

  if (o.gateAnswer) {
    return _resumeFromGateAnswer(o.gateAnswer, o.sessionId);
  }

  const list = Array.isArray(steps) ? steps : [];
  const roomDir = (typeof o.roomDir === 'string' && o.roomDir.length > 0) ? o.roomDir : process.cwd();
  const onStepFn = (typeof o.onStep === 'function') ? o.onStep : makeChainStepDispatcher(roomDir, { sessionId: o.sessionId, targetSection: (typeof o.targetSection === 'string' && o.targetSection.length > 0) ? o.targetSection : null });
  // Phase 237-02 (REACH-02): NO local default here. `undefined` falls through
  // to chain-executor.cjs's own `_defaultPostureFn`, which resolves to
  // recipe-maps.cjs's exported posture-authority function (the ONE autonomy
  // authority) -- confirmed by reading chain-executor.cjs's own opts
  // handling: `(typeof o.postureFn === 'function') ? o.postureFn :
  // _defaultPostureFn`, so passing `postureFn: undefined` here correctly
  // resolves to the shared default rather than installing `undefined` as a
  // callable. opts.postureFn stays an injectable seam: a caller/test that
  // supplies one still wins.
  const postureFn = (typeof o.postureFn === 'function') ? o.postureFn : undefined;
  const gateRenderCtx = (o.gateRenderCtx && typeof o.gateRenderCtx === 'object') ? o.gateRenderCtx : {};

  const result = await chainExecutor.runChain(list, {
    postureFn: postureFn,
    onStep: onStepFn,
    maxSteps: o.maxSteps,
    // Forces chain-executor.cjs's async resilient path (o.roomDir !== undefined)
    // so onStep's real async navigation.cjs work is genuinely awaited -- the
    // legacy synchronous runChain path never awaits onStep (Wave-2 contract).
    roomDir: roomDir,
    onHalt: function (_step, _contexts) {
      // Synchronous by design (runChain never awaits onHalt): the async gate
      // render happens AFTER runChain returns, reading result.haltedAt below.
      // Return a non-'run' verb so the chain halts cleanly. Never [stop] --
      // this is a genuine material-step gate, not a kill switch.
      return 'defer';
    },
  });

  if (result.completed) {
    return { ok: true, completed: true, halted: false, trace: result.trace };
  }

  const haltedStep = result.haltedAt && result.haltedAt.step;
  if (!haltedStep) {
    // A budget brake or a callback fault with no specific step -- nothing to
    // gate; surface the halt reason as-is.
    return { ok: true, completed: false, halted: false, trace: result.trace, halted_at: result.haltedAt };
  }

  const idx = list.findIndex((s) => s === haltedStep);
  const restSteps = idx >= 0 ? list.slice(idx + 1) : [];
  const previousOutput = result.trace.length > 0 ? result.trace[result.trace.length - 1].chain_output : null;

  const card = _buildMaterialStepCard(haltedStep);
  const renderCtxWithVerdict = Object.assign(
    { verdictFor: function (chosenIds) { return (Array.isArray(chosenIds) && chosenIds[0]) || 'defer'; } },
    gateRenderCtx
  );

  let rendered;
  try {
    rendered = await gateRender.renderGate(card, renderCtxWithVerdict);
  } catch (e) {
    return { ok: false, reason: 'gate_render_failed', detail: String((e && e.message) || e) };
  }

  const gateId = rendered.card.gate_id;
  // Phase 237-02: the ledger carries `postureFn` UNCHANGED, including a raw
  // `undefined` when no override was supplied. This is deliberately not
  // pre-resolved here: `_resumeFromGateAnswer` below continues the chain by
  // calling THIS SAME `chainRun` entry point again (not chain-executor.cjs
  // directly), so the identical `(typeof o.postureFn === 'function') ?
  // o.postureFn : undefined` line above re-applies on resume exactly as it
  // did on the original START call -- an `undefined` ledger value cascades
  // to chain-executor.cjs's own default on EVERY re-entry, not just the
  // first. A caller/test that supplied a real override still carries it
  // through unchanged (it is already a function, so this branch is a no-op
  // for that case).
  const resumeEntry = {
    haltedStep: haltedStep,
    restSteps: restSteps,
    previousOutput: previousOutput,
    roomDir: roomDir,
    sessionId: o.sessionId,
    onStepFn: onStepFn,
    postureFn: postureFn,
    maxSteps: o.maxSteps,
    gateRenderCtx: gateRenderCtx,
    // GATE-01 G-2: the NORMALIZED card renderGate returned, not the
    // pre-render card from _buildMaterialStepCard -- its option ids are
    // canonical and its gate_id is the id being minted. Carried so the
    // resume path can validate a submitted `chosen` against the actual
    // minted options instead of ignoring it.
    card: rendered.card,
    kind: 'material_step',
  };

  // Doctrine comment (quick task 260819-c55, Task 1) -- why minting a
  // callable resumeFn onto this entry is safe:
  // (1) mintGate (lib/mcp/gate-ledger.cjs) Object.assigns `resumeEntry` into
  //     a NEW object before storing it, so the stored entry and this
  //     closed-over `resumeEntry` end up as two distinct objects carrying
  //     the same field values. `resumeFn` below always closes over THIS
  //     `resumeEntry`, never the stored copy, and _executeResumedEntry only
  //     ever reads fields both objects carry (card, haltedStep, restSteps,
  //     onStepFn, roomDir, sessionId, postureFn, maxSteps, gateRenderCtx) --
  //     never `mintedAt` or `sessionKey`, the two fields only the STORED
  //     copy carries. The two objects are therefore interchangeable by
  //     construction for every field this function reads.
  // (2) `resumeEntry.resumeFn` is the ONE way another lib/mcp/tools/*.cjs
  //     module (gate.cjs) reaches this execution path without requiring
  //     chain.cjs at all -- the disjoint-file contract (both module
  //     headers) forbids a lib/mcp/tools/*.cjs module from requiring
  //     another lib/mcp/tools/*.cjs module. A function reference minted
  //     here and carried on the ledger entry is the seam; gate.cjs invokes
  //     `live.resumeFn(...)`, never `require('./chain.cjs')`.
  // (3) Minting resumeFn does NOT itself add a new execution authority: the
  //     entry it closes over is UNREACHABLE until someone consumes it out
  //     of gate-ledger.cjs's single-use Map (gateLedger.consumeGate deletes
  //     on lookup), and the ledger permits exactly one consumer per
  //     gate_id. Whichever caller wins that single consume -- gate_answer
  //     invoking `live.resumeFn(...)`, or chain_run's own gateAnswer path
  //     calling `_executeResumedEntry` directly -- is the only caller whose
  //     execution ladder ever runs; the other is refused with
  //     unknown_or_expired_gate before either resumeFn or
  //     _executeResumedEntry is ever reached.
  resumeEntry.resumeFn = function (gateAnswerPayload) {
    return _executeResumedEntry(resumeEntry, gateAnswerPayload);
  };

  _mintResumeLedger(gateId, resumeEntry);

  return {
    ok: true,
    completed: false,
    halted: true,
    trace: result.trace,
    halted_at: { step: haltedStep, reason: result.haltedAt.reason },
    gate: { gate_id: gateId, renderer: rendered.renderer, rendered: rendered.rendered },
  };
}

/**
 * _executeResumedEntry(entry, gateAnswer) -- the ONE execution authority for
 * a halted material step (quick task 260819-c55). Takes an ALREADY-CONSUMED
 * ledger entry -- the caller (`_resumeFromGateAnswer` below, for the direct
 * chain_run path, OR `resumeFn` closed over the entry at mint time and
 * invoked by gate.cjs's gate_answer handler, for the MCP-surface path) has
 * already pulled it out of the single-use ledger via
 * `gateLedger.consumeGate` -- and `gateAnswer` ({gate_id, chosen, verdict}),
 * then runs the identical execution ladder every resume path must run, in
 * this exact order:
 *   1. chosen validated against the entry's OWN minted card
 *      (validateChosenAgainstCard) -> chosen_not_in_card_options reject.
 *      An entry with no card at all (minted before Phase 238-04, still
 *      inside the TTL during a rolling restart) fails closed the same way
 *      rather than skipping the check.
 *   2. non-approve verdict -> executed:false, reject without running
 *      anything.
 *   3. only then: entry.onStepFn runs, wrapped in try/catch ->
 *      onStep_fault on a thrown error.
 *   4. entry.restSteps.length === 0 -> completed:true, executed:true.
 *   5. otherwise, the tail continues through THIS SAME chainRun entry point
 *      (a further material step later in the chain halts through the
 *      identical path -- no second gate/executor is minted for the tail).
 *
 * This function never touches the ledger itself -- consuming is always the
 * caller's job. That split is what lets gate.cjs delegate here through a
 * plain function reference (`live.resumeFn`) without ever requiring
 * chain.cjs (see the doctrine comment above `resumeEntry.resumeFn`'s
 * assignment in `chainRun`, above, for why minting that reference adds no
 * new execution authority).
 */
async function _executeResumedEntry(entry, gateAnswer) {
  const ga = gateAnswer || {};

  // GATE-01 G-2 (chain side, the worse instance): this used to read only
  // the gate id and the verdict, never `chosen` at all -- a payload of
  // verdict:approve with ANY arbitrary `chosen` executed the halted
  // material step. A missing card fails closed with the same reason rather
  // than skipping the check -- the conservative direction, matching the
  // verdict-cannot-be-overridden doctrine.
  const validChosen = entry.card ? gateRender.validateChosenAgainstCard(entry.card, ga.chosen) : null;
  if (!validChosen) {
    return {
      ok: false,
      reason: 'chosen_not_in_card_options',
      gate_id: ga.gate_id,
      valid_option_ids: (entry.card && Array.isArray(entry.card.options)) ? entry.card.options.map((o) => o.id) : [],
    };
  }

  if (ga.verdict !== 'approve') {
    return {
      ok: true,
      completed: false,
      halted: true,
      executed: false,
      verdict: ga.verdict,
      gate_id: ga.gate_id,
      note: 'Material step NOT executed (verdict was not approve).',
    };
  }

  // Execute the approved material step directly -- the gate already resolved
  // it; this call does NOT re-run it through the gate predicate again.
  let stepResult;
  try {
    stepResult = await entry.onStepFn(entry.haltedStep, entry.previousOutput);
  } catch (e) {
    return { ok: false, reason: 'onStep_fault', detail: String((e && e.message) || e) };
  }
  stepResult = stepResult || {};
  const chainOutput = (stepResult.chain_output !== undefined) ? stepResult.chain_output : null;

  if (entry.restSteps.length === 0) {
    return { ok: true, completed: true, halted: false, executed: true, gate_id: ga.gate_id, chain_output: chainOutput };
  }

  // Continue the remaining chain through the SAME chainRun entry point (a
  // further material step later in the chain halts through the identical
  // path -- no second gate/executor is minted for the tail).
  const rest = await chainRun(entry.restSteps, {
    roomDir: entry.roomDir,
    sessionId: entry.sessionId,
    onStep: entry.onStepFn,
    postureFn: entry.postureFn,
    maxSteps: entry.maxSteps,
    gateRenderCtx: entry.gateRenderCtx,
  });
  return Object.assign({ executed: true, resumed_step_output: chainOutput, gate_id: ga.gate_id }, rest);
}

/**
 * _resumeFromGateAnswer(gateAnswer, sessionId) -- the CONSUME half of
 * chain_run's direct programmatic resume path (see chainRun's own doc
 * comment). Never executes without consuming a gate_id THIS process
 * actually minted via a prior halt (T-198-12), never for a session other
 * than the one that minted it (GATE-03 half A, chain side). All EXECUTION
 * ladder logic (chosen validation, verdict check, onStepFn, tail
 * continuation) now lives in `_executeResumedEntry`, above -- this function
 * only owns the consume-and-dispatch half.
 *
 * `sessionId` is the CALLER's session id -- threaded in from chainRun's own
 * `opts.sessionId`, which the registered `chain_run` handler populates from
 * its `resolveEffectiveSessionId(undefined, extra)` call (see `register`
 * below). It is NEVER read off the consumed ledger entry: comparing the
 * entry to itself would pass vacuously (the same shape as the source-
 * presence-grep anti-pattern this repo already learned the hard way).
 *
 * Failure ladder, in order, because the ordering decides whether the
 * halted material step can run:
 *   1. missing gate_id -> reject, nothing consumed.
 *   2. consume(gate_id, sessionId): null -> unknown_or_expired_gate;
 *      {ok:false, reason:'session_mismatch'} -> session_mismatch reject.
 *   3. only then: delegate to _executeResumedEntry, which owns every
 *      remaining step of the ladder.
 */
async function _resumeFromGateAnswer(gateAnswer, sessionId) {
  const ga = gateAnswer || {};
  if (typeof ga.gate_id !== 'string' || ga.gate_id.length === 0) {
    return { ok: false, reason: 'missing_gate_id' };
  }
  const entry = _consumeResumeLedger(ga.gate_id, sessionId);
  if (!entry) {
    return { ok: false, reason: 'unknown_or_expired_gate', gate_id: ga.gate_id };
  }
  if (entry.ok === false && entry.reason === 'session_mismatch') {
    return { ok: false, reason: 'session_mismatch', gate_id: ga.gate_id };
  }
  return _executeResumedEntry(entry, ga);
}

// -----------------------------------------------------------------------
// MCP tool registration.
// -----------------------------------------------------------------------
function register(server, ctx) {
  server.tool(
    'chain_resolve',
    "Resolve an ordered framework-name chain to its command plan via lib/workflow/command-resolver.cjs::composeWorkflow -- the ONE governed reach path (R4: mints no second resolver). Read-only: executes nothing.",
    {
      chain: z.array(z.string().min(1)).min(1)
        .describe('Ordered list of framework names (the same names lib/workflow/command-resolver.cjs\'s registry indexes).'),
    },
    async ({ chain }) => {
      const workflow = chainResolve(chain);
      return textResponse({ ok: true, workflow: workflow });
    }
  );

  server.tool(
    'chain_run',
    "Execute an ordered framework-name chain server-side, WRAPPING the shipped lib/core/chain-executor.cjs::runChain (Phase 166) -- mints no second executor. Runs the autonomous_safe prefix (posture resolved from the ONE shared autonomy authority in lib/core/recipe-maps.cjs, never re-derived); HALTS at the first material step and returns a gate_id minted into the shared gate ledger instead of executing it unattended. To resume, call gate_answer with that gate_id: it ratifies the decision AND runs the approved step and continues the chain in that SAME call, returning the real execution result. Do NOT then thread the answer back into chain_run -- the gate is single-use, so the second caller for that gate_id is refused with unknown_or_expired_gate and nothing re-runs. `chosen` must be an option id or an option label from the returned card, or the resume is rejected without executing the step. Only the session that halted the chain can resume it; a different session's gate_answer for the same gate_id is rejected. An approve verdict executes the halted step and continues; reject/defer leaves it unexecuted.",
    {
      chain: z.array(z.string().min(1)).min(1).optional()
        .describe('Ordered framework-name chain to resolve and run. Required to START a chain; omit when resuming via gate_answer.'),
      gate_answer: z.object({
        gate_id: z.string().min(1),
        chosen: z.array(z.string().min(1)).min(1),
        verdict: z.enum(['approve', 'reject', 'defer']),
      }).optional()
        .describe('The DIRECT programmatic resume path for a caller driving chainRun in-process (not through the gate_answer MCP tool) -- it consumes the SAME single-use ledger entry and runs the SAME execution path the gate_answer tool invokes. `chosen` must match an option id or label from the halt gate\'s own card, and must come from the SAME session that halted the chain, or the resume is rejected before the step runs. A caller uses ONE verb or the other for a given gate_id, never both: whichever of gate_answer or this parameter consumes the entry first is the only one that executes; the other is refused with unknown_or_expired_gate.'),
    },
    async ({ chain, gate_answer }, extra) => {
      const sessionId = resolveEffectiveSessionId(undefined, extra);
      const roomDir = resolveSessionRoomDir(sessionId, ctx);

      if (gate_answer) {
        const result = await chainRun(null, { gateAnswer: gate_answer, sessionId: sessionId });
        return textResponse(result, result.ok === false);
      }

      if (!Array.isArray(chain) || chain.length === 0) {
        return textResponse({ ok: false, reason: 'missing_chain' }, true);
      }

      const capabilities = detectClientCapabilities(server, ctx);
      const renderCtx = { capabilities: capabilities, sessionId: sessionId };
      if (capabilities.elicitation && server && server.server && typeof server.server.elicitInput === 'function') {
        renderCtx.elicitInput = function (params) { return server.server.elicitInput(params); };
      }

      const workflow = chainResolve(chain);
      const result = await chainRun(workflow, { roomDir: roomDir, sessionId: sessionId, gateRenderCtx: renderCtx });
      return textResponse(result, result.ok === false);
    }
  );
}

// Born-wired SOURCE of truth (Part 11 R1/R16). chain_resolve is a pure read
// (hitl_shape 'none'); chain_run reaches a genuine material-step fork
// (hitl_shape 'F.1', the same shape gate_render/gate_answer/framework_run
// carry -- it halts and renders a gate rather than executing unattended).
// The born-wired registry generator discovers this export and regenerates
// data/mcp-tool-connectors.json plus its sibling per-surface reach-dial
// manifest from it; never hand-edit either generated file.
const connectors = [
  {
    tool: 'chain_resolve',
    surface: 'chain_resolve',
    connector: 'mcp-tool',
    hitl_shape: 'none',
    hitl_why: 'Pure read: resolves a framework chain via composeWorkflow, no execution, no fork.',
  },
  {
    tool: 'chain_run',
    surface: 'chain_run',
    connector: 'mcp-tool',
    hitl_shape: 'F.1',
    hitl_why: 'Executes the autonomous_safe prefix server-side (wrapping the shipped runChain) and halts at the first material step, rendering a genuine Decision-Gate fork through the SAME gate-render.cjs ladder gate_render uses, instead of executing it unattended.',
  },
];

module.exports = {
  register: register,
  connectors: connectors,
  chainResolve: chainResolve,
  chainRun: chainRun,
  // Phase 237-02 (REACH-02): this module's own local posture/autonomy
  // classifier export is DELETED, not renamed. This is a deliberate breaking
  // export change -- chain.cjs mints no posture authority of its own
  // anymore. The one true authority is recipe-maps.cjs's own exported
  // posture-authority function.
  _internal: {
    resolveSessionRoomDir: resolveSessionRoomDir,
    detectClientCapabilities: detectClientCapabilities,
    // Re-pointed onto the shared module's own Map (238-04): this is the
    // SAME object gate.cjs's ledger now resolves against, not a private
    // mirror -- the identity probe in 238-04-SUMMARY.md proves this.
    _resumeLedger: gateLedger._internal._ledger,
    _mintResumeLedger: _mintResumeLedger,
    _consumeResumeLedger: _consumeResumeLedger,
    _resumeFromGateAnswer: _resumeFromGateAnswer,
    // quick task 260819-c55: the ONE execution authority for a halted
    // material step, exported so gate.cjs's resumeFn delegation (a plain
    // function reference carried on the ledger entry, never a require of
    // this module) and tests/test-c55-one-resume-owner.cjs can both reach
    // it without duplicating the ladder.
    _executeResumedEntry: _executeResumedEntry,
  },
};
