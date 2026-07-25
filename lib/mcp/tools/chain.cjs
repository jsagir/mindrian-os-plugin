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
// the autonomous_safe prefix (posture JOINED from data/connector-registry.json,
// never re-derived), and HALTS at the first material step, rendering a gate
// through the SAME lib/mcp/gate-render.cjs ladder gate_render/framework_run
// use, instead of executing it unattended (T-198-11). The material step
// executes ONLY when a subsequent gate_answer payload ({gate_id, chosen,
// verdict}) is threaded back into chain_run and the gate_id matches THIS
// process's own single-use resume ledger (mint on halt, consume on resume,
// 30-minute TTL -- the T-198-10 pattern, T-198-12 spoofing mitigation: a
// verdict for an unknown/expired gate_id never resumes anything).
//
// Any material write the resumed step performs routes EXCLUSIVELY through
// lib/core/navigation.cjs (Part 9, T-198-04) -- this file never opens the
// graph store directly.
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

const fs = require('node:fs');
const path = require('node:path');
const { z } = require('zod');

const chainExecutor = require('../../core/chain-executor.cjs');
const { composeWorkflow } = require('../../workflow/command-resolver.cjs');
const navigation = require('../../core/navigation.cjs');
const gateRender = require('../gate-render.cjs');
const { resolveWriteRoom, resolveActiveRoom } = require('../../core/resolve-active-room.cjs');
const { resolveEffectiveSessionId } = require('../../core/session-binding.cjs');
const { isMcpFirst } = require('../mcp-first-flag.cjs');

function textResponse(payload, isError) {
  const result = { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
  if (isError) result.isError = true;
  return result;
}

/**
 * Resolve THIS session's room. Independent copy per the disjoint-file
 * tool-module contract (mirrors room.cjs / graph.cjs / gate.cjs / sensors.cjs
 * -- each tool module keeps its own copy rather than requiring a sibling).
 *
 * @param {string|undefined} sessionId
 * @param {{fallbackRoomDir: string, surface?: string}} ctx
 * @returns {string}
 */
function resolveSessionRoomDir(sessionId, ctx) {
  const fallback = (ctx && ctx.fallbackRoomDir) || process.cwd();
  try {
    if (isMcpFirst(ctx && ctx.surface)) {
      const r = resolveWriteRoom({ sessionId: sessionId, home: process.env.MINDRIAN_ROOMS_HOME });
      if (r && r.abs_path) return r.abs_path;
    }
    const active = resolveActiveRoom();
    if (active && active.abs_path) return active.abs_path;
  } catch (_e) {
    // fall through to fallback
  }
  return fallback;
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
// Posture join (SPEC-3): read data/connector-registry.json's per-surface
// `posture` field. NEVER re-derives posture -- an unknown command degrades to
// the SAME withhold-default chain-executor.cjs's own _defaultPostureFn uses
// ({ autonomous_safe:false, posture:'halt' }) rather than fabricating
// autonomous_safe (T-166-02 discipline, honored here at the join site too).
// -----------------------------------------------------------------------
const CONNECTOR_REGISTRY_PATH = path.join(__dirname, '..', '..', '..', 'data', 'connector-registry.json');
const PUSH_FORWARD = 'push_forward';

let _postureIndexCache = null;
function _loadPostureIndex() {
  if (_postureIndexCache) return _postureIndexCache;
  const idx = {};
  try {
    const raw = fs.readFileSync(CONNECTOR_REGISTRY_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const conns = Array.isArray(parsed && parsed.connectors) ? parsed.connectors : [];
    for (const c of conns) {
      if (c && typeof c.surface === 'string' && typeof c.posture === 'string') {
        idx[c.surface] = c.posture;
      }
    }
  } catch (_e) {
    // degrade: missing/unreadable/malformed registry -> empty index (every
    // command falls to the withhold-default below, never a fabricated safe).
  }
  _postureIndexCache = idx;
  return _postureIndexCache;
}

/**
 * postureForCommand(command) -> the chain-executor.cjs postureFn contract
 * ({ command, autonomous_safe, posture: 'run'|'halt' }), JOINED from
 * data/connector-registry.json's `posture` field (push_forward -> run/
 * autonomous_safe; hold/pull_back/unknown -> halt/not-safe). Never throws.
 */
function postureForCommand(command) {
  if (typeof command !== 'string' || command.length === 0) {
    return { command: command || null, autonomous_safe: false, posture: 'halt' };
  }
  const idx = _loadPostureIndex();
  const posture = idx[command];
  const autonomousSafe = posture === PUSH_FORWARD;
  return { command: command, autonomous_safe: autonomousSafe, posture: autonomousSafe ? 'run' : 'halt' };
}

// Test-only: clear the per-process posture cache so a test can re-point the
// registry (mirrors command-resolver.cjs's own __reset() precedent).
function __resetPostureCache() { _postureIndexCache = null; }

// -----------------------------------------------------------------------
// The default onStep: a step's "execution" is a memory_event through the
// navigation.cjs chokepoint (T-198-04) -- this file never opens room.db
// directly. A caller (the test, or a future richer dispatcher) may inject its
// own onStep via opts.onStep; this default is only the wired fallback.
// -----------------------------------------------------------------------
function makeDefaultOnStep(roomDir) {
  return async function onStep(step, _previousOutput) {
    const db = navigation.openRoomDbForCaller(roomDir);
    if (!db) {
      return { chain_output: null, quality: null };
    }
    try {
      const logged = navigation.logMemoryEvent(db, 'mcp_client_event_logged', {
        label: 'chain_step_executed',
        step: step && step.step,
        command: step && step.command,
        framework: step && step.framework,
      });
      return {
        chain_output: { step: step && step.step, command: step && step.command, memory_event: logged },
        quality: 'high',
      };
    } finally {
      navigation.closeRoomDbForCaller(db);
    }
  };
}

// -----------------------------------------------------------------------
// T-198-10-pattern / T-198-12 mitigation: chain_run's OWN single-use resume
// ledger, keyed by the gate_id gate-render.cjs minted for THIS halt. A
// gate_answer verdict naming a gate_id chain_run never minted (forged,
// replayed, or belonging to a different tool's gate) is rejected before any
// step executes -- mirrors gate.cjs's live-gate ledger shape, kept as an
// independent copy per the disjoint-file tool-module contract.
// -----------------------------------------------------------------------
const _resumeLedger = new Map();
const RESUME_TTL_MS = 30 * 60 * 1000; // 30 minutes

function _mintResumeLedger(gateId, entry) {
  _resumeLedger.set(gateId, Object.assign({ mintedAt: Date.now() }, entry));
}

function _consumeResumeLedger(gateId) {
  const entry = _resumeLedger.get(gateId);
  if (!entry) return null;
  _resumeLedger.delete(gateId); // single-use: consumed whether or not the TTL held
  if (Date.now() - entry.mintedAt > RESUME_TTL_MS) return null;
  return entry;
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
 *   entries). Runs the autonomous_safe prefix (posture joined from the
 *   connector registry via postureForCommand, unless opts.postureFn
 *   overrides). HALTS at the first material step -- the SHIPPED gate
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
    return _resumeFromGateAnswer(o.gateAnswer);
  }

  const list = Array.isArray(steps) ? steps : [];
  const roomDir = (typeof o.roomDir === 'string' && o.roomDir.length > 0) ? o.roomDir : process.cwd();
  const onStepFn = (typeof o.onStep === 'function') ? o.onStep : makeDefaultOnStep(roomDir);
  const postureFn = (typeof o.postureFn === 'function') ? o.postureFn : postureForCommand;
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
  _mintResumeLedger(gateId, {
    haltedStep: haltedStep,
    restSteps: restSteps,
    previousOutput: previousOutput,
    roomDir: roomDir,
    sessionId: o.sessionId,
    onStepFn: onStepFn,
    postureFn: postureFn,
    maxSteps: o.maxSteps,
    gateRenderCtx: gateRenderCtx,
  });

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
 * _resumeFromGateAnswer(gateAnswer) -- the RESUME half of chain_run (see
 * chainRun's own doc comment). Never executes without consuming a gate_id
 * THIS process actually minted via a prior halt (T-198-12).
 */
async function _resumeFromGateAnswer(gateAnswer) {
  const ga = gateAnswer || {};
  if (typeof ga.gate_id !== 'string' || ga.gate_id.length === 0) {
    return { ok: false, reason: 'missing_gate_id' };
  }
  const entry = _consumeResumeLedger(ga.gate_id);
  if (!entry) {
    return { ok: false, reason: 'unknown_or_expired_gate', gate_id: ga.gate_id };
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
    "Execute an ordered framework-name chain server-side, WRAPPING the shipped lib/core/chain-executor.cjs::runChain (Phase 166) -- mints no second executor. Runs the autonomous_safe prefix (posture JOINED from data/connector-registry.json, never re-derived); HALTS at the first material step and returns a gate_render payload instead of executing it unattended. To resume, call chain_run AGAIN with the gate_answer payload a prior gate_answer tool call returned: an approve verdict executes the halted step and continues; reject/defer leaves it unexecuted.",
    {
      chain: z.array(z.string().min(1)).min(1).optional()
        .describe('Ordered framework-name chain to resolve and run. Required to START a chain; omit when resuming via gate_answer.'),
      gate_answer: z.object({
        gate_id: z.string().min(1),
        chosen: z.array(z.string().min(1)).min(1),
        verdict: z.enum(['approve', 'reject', 'defer']),
      }).optional()
        .describe('A prior gate_answer tool response, threaded back to resume a chain_run halted at the material step it gated.'),
    },
    async ({ chain, gate_answer }, extra) => {
      const sessionId = resolveEffectiveSessionId(undefined, extra);
      const roomDir = resolveSessionRoomDir(sessionId, ctx);

      if (gate_answer) {
        const result = await chainRun(null, { gateAnswer: gate_answer });
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
// scripts/build-connector-registry.cjs discovers this export and regenerates
// data/mcp-tool-connectors.json + data/connector-registry.json from it; never
// hand-edit either generated file.
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
  postureForCommand: postureForCommand,
  _internal: {
    resolveSessionRoomDir: resolveSessionRoomDir,
    detectClientCapabilities: detectClientCapabilities,
    makeDefaultOnStep: makeDefaultOnStep,
    __resetPostureCache: __resetPostureCache,
    _resumeLedger: _resumeLedger,
    _mintResumeLedger: _mintResumeLedger,
    _consumeResumeLedger: _consumeResumeLedger,
    _resumeFromGateAnswer: _resumeFromGateAnswer,
  },
};
