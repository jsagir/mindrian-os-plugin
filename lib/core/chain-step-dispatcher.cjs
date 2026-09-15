'use strict';
/*
 * chain-step-dispatcher.cjs -- the two-tier honest step executor (REACH-01).
 * =========================================================================
 * Phase 237-07. Replaces lib/mcp/tools/chain.cjs's makeDefaultOnStep body,
 * which today only writes a memory_event and unconditionally returns
 * quality: 'high' without ever resolving step.command to anything runnable.
 * That fabricated success is the defect this module removes.
 *
 * THE HARD CONSTRAINT (read this before touching anything below): the MCP
 * server process cannot execute a /mos: methodology command. A methodology
 * command is a markdown prompt with no executable behind it; its designated
 * executor is agents/framework-runner.md, a Claude Code SUBAGENT dispatched
 * by the HOST from a command body. Claude Code exposes no mechanism for an
 * MCP server to invoke a subagent, a slash command, or a model turn (no
 * server-initiated slash-command execution, no MCP sampling -- confirmed
 * against the official Claude Code MCP docs, 237-RESEARCH.md). Any module
 * that claims to run a methodology command server-side has faked it a
 * second time, in the exact shape this milestone exists to remove.
 *
 * So the design is two HONEST tiers:
 *
 *   TIER 1 (executable, TIER_EXECUTABLE) -- the resolved command names a
 *   real, build-time-generated script join (data/command-registry.json's
 *   commands[].executable). The dispatcher genuinely spawns it with a
 *   bounded, argv-array child process (no shell, never a template-literal
 *   command string) and verifies the declared artifact exists on disk
 *   afterward. quality is 'high' ONLY when the exit status is 0 AND the
 *   declared artifact is present; every other outcome (non-zero exit, a
 *   timeout, a spawn error, a missing artifact, a containment refusal) is
 *   'low'.
 *
 *   TIER 2 (host-dispatch, TIER_HOST_DISPATCH) -- every other case,
 *   including an unknown command, a command with no executable join, or a
 *   declared script missing from disk. The dispatcher does not spawn
 *   anything. It returns quality: null (never 'high', never 'low' -- 'low'
 *   would halt a chain that has done nothing wrong) plus a machine-readable
 *   requires_host_dispatch directive naming exactly what the host must
 *   dispatch: agents/framework-runner.md, with the fields its own
 *   documented Input Contract names (framework/command, room_path,
 *   target_section).
 *
 * quality: null on tier 2 is what makes the honesty STRUCTURAL. No caller
 * can weaken it to 'high' -- that fabricated success is precisely the
 * defect being removed, and a mutation that reintroduces it is expected to
 * turn tests/test-237-dispatcher-tiers.cjs red (Leg 9).
 *
 * The executable set is a CLOSED, build-time-generated allowlist. step.command
 * is used ONLY as a lookup key into that registry -- it never reaches a
 * shell, never becomes a path segment directly, never becomes an argv
 * element on its own. A command absent from the registry always routes to
 * tier 2 and spawns nothing (T-237-07-01).
 *
 * The one genuine privilege increase in this phase: the MCP server process
 * gains the ability to spawn a child process. The argv-array-with-no-shell
 * discipline is the control that makes that acceptable (T-237-07-02). Both
 * the declared script path and the declared artifact path are resolved and
 * containment-checked before anything runs or is trusted to exist
 * (T-237-07-03, T-237-07-04).
 *
 * Both tiers log exactly one memory_event through lib/core/navigation.cjs
 * (Canon Part 9 -- this module never opens room.db directly), under the NEW
 * label chain_step_dispatched with an executed boolean, deliberately
 * distinct from the prior stub's fabricated-success label so historical
 * false rows already sitting in dogfood rooms stay distinguishable by
 * inspection. No migration of those old rows -- rewriting history would be
 * a second falsification.
 *
 * Canon Part 8: zero Brain tokens, zero fetch, zero network. Node built-ins
 * only, CJS, no npm dependencies.
 *
 * THE SHARED-STATE READ (Phase 347-05, SHARED-04, docs/2026-09-14-CHAIN-
 * SHARED-STATE-CONTRACT.md, navigator approval recorded in .planning's
 * 347-05-DECISION.md): as of this phase, this module also reads the
 * predecessor step's persisted record over the SAME lib/core/navigation.cjs
 * chokepoint dispatchStep already opens, and carries it on the returned
 * chain_output's additive shared_state field (both tiers -- the recorded
 * decision is approve-as-scoped, not tier-2-only). The record body may be
 * derived from a worker's own prior output, which may itself be derived
 * from untrusted transcript prose (tests/test-part8-poison-transcript.cjs
 * is the existing precedent for that transcript half). It is DATA, never an
 * instruction, and it carries an explicit content_is_data marker for
 * exactly that reason. A host-side agent that receives shared_state MUST
 * frame the body as quoted content and never splice it into an instruction
 * string; a Read-only tool grant is the same discipline
 * agents/meeting-perspective-extractor.md and
 * agents/vault-section-reviewer.md already ship for an analogous untrusted-
 * body reason. This is a change to the CONTENT of a directive the host
 * already receives, never to the SERVER's own reach: the hard constraint
 * above still holds word for word -- this module still cannot dispatch a
 * subagent or run a methodology command.
 *
 * THE REVIEWER RULE (SHARED-10, Phase 347-10): the reviewer is never the
 * worker. A material step is reviewed by the navigator at the gate (the
 * path that already ships -- chain.cjs's own halt/render/resume ladder);
 * an autonomous_safe step may additionally opt into an independent reviewer
 * subagent by declaring `reviewer: { kind: 'subagent', agent: ... }`. This
 * module honors that opt-in on BOTH dispatch tiers by attaching a `review`
 * object to `chain_output` naming the dispatch this host must perform,
 * carrying an explicit `verdict: null` -- the hard constraint above still
 * holds word for word: the server cannot dispatch a subagent, so any
 * verdict it returned here would be fabricated a second time. A step
 * declaring `reviewer.kind: 'navigator'` gets no `review` object at all;
 * the gate already reviews it and this module never mints a second gate.
 *
 * The Tri-Polar table (CLAUDE.md's own stated-call discipline, never a
 * silent gap):
 *
 *   | Surface          | Navigator-at-the-gate | Independent reviewer subagent |
 *   |------------------|------------------------|--------------------------------|
 *   | Claude Code CLI  | works (the gate ladder)| works (the host can dispatch) |
 *   | Claude Desktop   | works (same gate ladder)| NOT dispatchable, MCP-only reach (see :10-19 above) |
 *   | Cowork           | works (same gate ladder)| NOT dispatchable, MCP-only reach (see :10-19 above) |
 *
 * Consequence: on Claude Desktop and Cowork, an autonomous_safe step that
 * requests an independent reviewer gets the honest directive above and the
 * navigator decides from there; this module never fabricates a review
 * verdict on any surface.
 *
 * Exports: dispatchStep, makeChainStepDispatcher, resolveExecutable,
 * executableCommands, scriptPathFor, TIER_EXECUTABLE, TIER_HOST_DISPATCH,
 * DISPATCH_TIMEOUT_MS.
 *
 * No em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const navigation = require('./navigation.cjs');

// PLUGIN_ROOT: two levels above this file (lib/core/ -> repo/plugin root),
// same computation as lib/core/index.cjs's own PLUGIN_ROOT. Every declared
// script path is resolved against THIS constant, never against a caller-
// supplied root -- the containment guarantee (T-237-07-04) depends on the
// root itself being fixed, not test-injectable.
const PLUGIN_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_REGISTRY_PATH = path.join(PLUGIN_ROOT, 'data', 'command-registry.json');

const TIER_EXECUTABLE = 'executable';
const TIER_HOST_DISPATCH = 'host_dispatch';

// DISPATCH_TIMEOUT_MS: bounded default child-process timeout, low minutes.
// The real fixture (scripts/generate-hub.cjs against a normal-sized room)
// runs in well under a second; two minutes gives a slow filesystem or a
// large room generous headroom without letting a hung script tie up the
// MCP server indefinitely. chain-executor.cjs's own EXEC-06 maxSteps brake
// (default 25) already bounds how many steps a chain can dispatch; this
// constant only bounds the duration of ONE step's spawn.
const DISPATCH_TIMEOUT_MS = 120000;

// ---------------------------------------------------------------------------
// Registry loading. Cached per resolved path (a Map, not a single slot) so a
// caller-supplied registryPath override (test-only -- see resolveExecutable's
// doc below) never evicts the real registry's cached entry, and vice versa.
// A distinct registryPath per fixture is itself the reset path for tests:
// nothing here needs a bespoke cache-clear export.
// ---------------------------------------------------------------------------
const _registryCache = new Map();

function _resolveRegistryPath(registryPath) {
  return (typeof registryPath === 'string' && registryPath.length > 0)
    ? path.resolve(registryPath)
    : DEFAULT_REGISTRY_PATH;
}

function _loadRegistryCommands(registryPath) {
  const rp = _resolveRegistryPath(registryPath);
  if (_registryCache.has(rp)) return _registryCache.get(rp);
  let commands = [];
  try {
    const raw = fs.readFileSync(rp, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.commands)) commands = parsed.commands;
  } catch (_e) {
    commands = [];
  }
  _registryCache.set(rp, commands);
  return commands;
}

/**
 * resolveExecutable(command, opts) -> { script, args, produces } | null
 *
 * Looks up `command` (used ONLY as a lookup key, never interpreted) in the
 * generated registry and returns its normalized executable join, or null
 * when the command is unknown or declares no executable.
 *
 * opts.registryPath is an OPTIONAL override of which registry file to read.
 * It exists so tests/test-237-dispatcher-tiers.cjs can drive synthetic
 * joins without ever touching the generated data/command-registry.json.
 * This override is TEST-ONLY: makeChainStepDispatcher (the production
 * wiring) never sets it, so production dispatch always reads the real
 * generated file.
 */
function resolveExecutable(command, opts) {
  if (typeof command !== 'string' || command.length === 0) return null;
  const o = (opts && typeof opts === 'object') ? opts : {};
  const commands = _loadRegistryCommands(o.registryPath);
  const entry = commands.find((c) => c && c.command === command);
  if (!entry || !entry.executable || typeof entry.executable !== 'object') return null;
  const ex = entry.executable;
  if (typeof ex.script !== 'string' || ex.script.length === 0) return null;
  return {
    script: ex.script,
    args: Array.isArray(ex.args) ? ex.args.slice() : [],
    produces: (typeof ex.produces === 'string' && ex.produces.length > 0) ? ex.produces : null,
  };
}

/**
 * scriptPathFor(command, opts) -> absolute path | null
 *
 * Resolves the declared script against PLUGIN_ROOT (never a caller-supplied
 * root) and returns null when the join is absent OR when the resolved path
 * escapes PLUGIN_ROOT. A declared script can only ever come from committed
 * command markdown frontmatter via the build step, never from runtime data
 * -- this containment check is a second, independent floor under that
 * already-strong guarantee (T-237-07-04).
 */
function scriptPathFor(command, opts) {
  const ex = resolveExecutable(command, opts);
  if (!ex) return null;
  const resolved = path.resolve(PLUGIN_ROOT, ex.script);
  const rel = path.relative(PLUGIN_ROOT, resolved);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return resolved;
}

/**
 * executableCommands(opts) -> string[]
 *
 * The list of commands carrying a non-null executable join, so a seam-
 * liveness consumer (Phase 237-05's tests/test-237-executable-seam.cjs) or
 * a future coverageReport() consumer can enumerate the claims without
 * re-parsing the registry file itself.
 */
function executableCommands(opts) {
  const commands = _loadRegistryCommands((opts && opts.registryPath) || undefined);
  return commands
    .filter((c) => c && c.executable && typeof c.executable === 'object' &&
      typeof c.executable.script === 'string' && c.executable.script.length > 0)
    .map((c) => c.command);
}

// ---------------------------------------------------------------------------
// Artifact containment. Mirrors scripts/write-scope-check.cjs's
// targetRoomUnderRoot containment check: resolve, then require the relative
// path to stay inside the room root (T-237-07-03).
// ---------------------------------------------------------------------------
function _resolveArtifactPath(produces, roomDir) {
  if (typeof produces !== 'string' || produces.length === 0) {
    return { resolved: null, contained: true };
  }
  const roomRoot = path.resolve(roomDir);
  const resolved = path.resolve(roomRoot, produces);
  const rel = path.relative(roomRoot, resolved);
  const contained = !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
  return { resolved: contained ? resolved : null, contained };
}

// ---------------------------------------------------------------------------
// Tier 1: genuinely spawn and verify.
// ---------------------------------------------------------------------------
function _dispatchTier1(command, executable, scriptPath, roomDir, context) {
  const substitutedArgs = executable.args.map((a) => (a === '${ROOM_DIR}' ? roomDir : a));
  const argv = [scriptPath].concat(substitutedArgs);

  const timeoutMs = (typeof context.dispatchTimeoutMs === 'number' && context.dispatchTimeoutMs > 0)
    ? context.dispatchTimeoutMs
    : DISPATCH_TIMEOUT_MS;

  const artifactInfo = _resolveArtifactPath(executable.produces, roomDir);

  // Refuse BEFORE spawning when the declared artifact would land outside the
  // room root. The script never runs in this case -- a containment failure
  // is a registry-authoring bug, not something worth executing to find out.
  if (executable.produces && !artifactInfo.contained) {
    return {
      chain_output: {
        tier: TIER_EXECUTABLE,
        command: command,
        executed: false,
        artifact: null,
        exit_code: null,
        timed_out: false,
        reason: 'declared artifact path escapes the room root; refused before spawn',
      },
      quality: 'low',
    };
  }

  // The argv array (never a shell, never a template-literal command string)
  // IS the security control that makes this module's one privilege increase
  // acceptable (T-237-07-02).
  let spawnResult;
  try {
    spawnResult = spawnSync(process.execPath, argv, {
      cwd: roomDir,
      timeout: timeoutMs,
      stdio: 'pipe',
      windowsHide: true,
    });
  } catch (_e) {
    spawnResult = { status: null, signal: null, error: _e };
  }

  const timedOut = !!(spawnResult && spawnResult.error && spawnResult.error.code === 'ETIMEDOUT');
  const exitCode = spawnResult ? spawnResult.status : null;

  let artifactExists = false;
  try {
    artifactExists = !!artifactInfo.resolved && fs.existsSync(artifactInfo.resolved);
  } catch (_e) {
    artifactExists = false;
  }

  const quality = (!timedOut && exitCode === 0 && artifactExists) ? 'high' : 'low';

  return {
    chain_output: {
      tier: TIER_EXECUTABLE,
      command: command,
      executed: true,
      artifact: artifactExists ? artifactInfo.resolved : null,
      exit_code: exitCode,
      timed_out: timedOut,
    },
    quality: quality,
  };
}

// ---------------------------------------------------------------------------
// Tier 2: honest refusal. Only fields from agents/framework-runner.md's own
// documented Input Contract are named in the dispatch directive.
// ---------------------------------------------------------------------------
function _dispatchTier2(command, roomDir, context) {
  const targetSection = (typeof context.targetSection === 'string' && context.targetSection.length > 0)
    ? context.targetSection
    : null;
  return {
    chain_output: {
      tier: TIER_HOST_DISPATCH,
      command: command,
      executed: false,
      requires_host_dispatch: true,
      dispatch: {
        agent: 'framework-runner',
        command: command,
        room_path: roomDir,
        target_section: targetSection,
      },
    },
    quality: null,
  };
}

// ---------------------------------------------------------------------------
// THE SHARED-STATE READ's own two helpers (Phase 347-05, SHARED-04). See the
// module header paragraph above for the framing obligation this exists to
// satisfy.
// ---------------------------------------------------------------------------

// _currentStepIndex(step): composeWorkflow's own convention
// (command-resolver.cjs:110-121) is a 1-indexed public step label
// (step: i + 1); chain-executor.cjs's own chain_state writer stores
// step_index 0-indexed (the loop's own i, chain-executor.cjs:1016). This
// converts the resolved step's public label back into the writer's own
// index space -- never a second counting convention. Returns null when the
// step carries no usable numeric label.
function _currentStepIndex(step) {
  if (!step || typeof step !== 'object') return null;
  if (typeof step.step !== 'number' || !Number.isInteger(step.step) || step.step < 1) return null;
  return step.step - 1;
}

// _readPredecessorRecord(db, runId, currentIndex): the one place this
// module reads a predecessor's persisted record. Additive-floor idiom
// (edges.cjs:812-816): absent inputs degrade to an explicit named reason,
// never an empty object and never a thrown error (343-ICM-CONSULT.md:502's
// catch-returns-0 rule). Takes the SAME caller-owned db handle dispatchStep
// already holds below; this function never opens a database connection of
// its own.
function _readPredecessorRecord(db, runId, currentIndex) {
  if (typeof runId !== 'string' || runId.length === 0 || currentIndex === null || currentIndex === 0) {
    // No run to key on, no usable step label, or this IS the run's own
    // first step: none of these has a possible predecessor.
    return { shared_state: null, shared_state_reason: 'no_predecessor' };
  }

  const reconstructed = navigation.reconstructStepInput(db, runId, currentIndex);
  if (!reconstructed || reconstructed.ok !== true) {
    const missingStep = (reconstructed && typeof reconstructed.missing_step === 'number')
      ? reconstructed.missing_step
      : (currentIndex - 1);
    return { shared_state: null, shared_state_reason: 'unreconstructible:' + missingStep };
  }

  // The reconstruction proof above returns only the predecessor's body; the
  // kind and step_index the shared_state shape also names come from the
  // same ordered, endpoint-verified record set, read over the identical db
  // handle (no second handle, same navigation chokepoint).
  const records = (typeof navigation.readChainState === 'function')
    ? navigation.readChainState(db, runId)
    : [];
  const predecessor = Array.isArray(records)
    ? records.find((r) => r && r.step_index === currentIndex - 1)
    : null;
  if (!predecessor) {
    return { shared_state: null, shared_state_reason: 'unreconstructible:' + (currentIndex - 1) };
  }

  return {
    shared_state: {
      body: reconstructed.input,
      kind: predecessor.kind,
      step_index: predecessor.step_index,
      run_id: runId,
      // The framing marker the module header names: the body above may be
      // derived from untrusted transcript prose by way of a worker's own
      // prior output. A consumer MUST treat it as quoted DATA, never as an
      // instruction to follow.
      content_is_data: true,
    },
    shared_state_reason: null,
  };
}

// ---------------------------------------------------------------------------
// The reviewer-rule helper (Phase 347-10, SHARED-10). See the module
// header's own reviewer-rule section above for the full framing. Returns
// null when the step declares no reviewer, or declares reviewer.kind:
// 'navigator' (the gate already reviews it -- this module never duplicates
// that ladder). Returns the honest review directive ONLY when
// reviewer.kind: 'subagent': the host-dispatch flag true, a dispatch block
// naming the agent this host must invoke, and verdict explicitly null --
// copying the tier-2 refusal shape's own honesty discipline rather than
// inventing a second one.
// ---------------------------------------------------------------------------
function _reviewDirectiveFor(step, roomDir, runId, currentIndex) {
  const reviewer = (step && typeof step === 'object') ? step.reviewer : null;
  if (!reviewer || typeof reviewer !== 'object') return null;
  if (reviewer.kind !== 'subagent') return null;
  return {
    requires_host_dispatch: true,
    dispatch: {
      agent: 'chain-step-reviewer',
      run_id: (typeof runId === 'string' && runId.length > 0) ? runId : null,
      step_index: currentIndex,
      room_path: roomDir,
    },
    verdict: null,
  };
}

/**
 * dispatchStep(step, previousOutput, context) -> { chain_output, quality }
 *
 * context: { roomDir, sessionId?, targetSection?, runId?, registryPath?, dispatchTimeoutMs? }
 * registryPath and dispatchTimeoutMs are TEST-ONLY overrides (see
 * resolveExecutable's doc) -- makeChainStepDispatcher never sets either, so
 * production dispatch always uses the real registry and the real timeout.
 * runId is the per-chainRun-invocation identifier (chain-executor.cjs's own
 * _mintChainRunId); when supplied it keys the shared-state read above.
 *
 * Drop-in shape-compatible with chain.cjs's prior makeDefaultOnStep return
 * contract, so it installs as chain_run's onStep default unchanged.
 */
async function dispatchStep(step, previousOutput, context) {
  const ctx = (context && typeof context === 'object') ? context : {};
  const roomDir = (typeof ctx.roomDir === 'string' && ctx.roomDir.length > 0) ? ctx.roomDir : process.cwd();
  const command = (step && typeof step === 'object') ? step.command : null;

  const registryOpts = (typeof ctx.registryPath === 'string' && ctx.registryPath.length > 0)
    ? { registryPath: ctx.registryPath }
    : undefined;

  const executable = resolveExecutable(command, registryOpts);
  const scriptPath = executable ? scriptPathFor(command, registryOpts) : null;
  let scriptExists = false;
  if (scriptPath) {
    try {
      scriptExists = fs.existsSync(scriptPath) && fs.statSync(scriptPath).isFile();
    } catch (_e) {
      scriptExists = false;
    }
  }

  // Canon Part 9: room.db reached ONLY through navigation.cjs's caller-owned
  // handle trio. When no room.db exists yet (Tier 0 cold start), follow the
  // existing chain.cjs precedent and degrade to a null result rather than
  // throwing.
  const db = navigation.openRoomDbForCaller(roomDir);
  if (!db) {
    return { chain_output: null, quality: null };
  }

  try {
    const outcome = (executable && scriptExists)
      ? _dispatchTier1(command, executable, scriptPath, roomDir, ctx)
      : _dispatchTier2(command, roomDir, ctx);

    // Additive-floor idiom (edges.cjs:812-816): one key added to whichever
    // tier's chain_output outcome above returned, on BOTH tiers per the
    // navigator's recorded approve-as-scoped decision (347-05-DECISION.md).
    // A consumer reading only today's fields (tier/command/executed/... on
    // tier 1, the tier-2 refusal's own directive fields on tier 2) is
    // unaffected.
    const currentIndex = _currentStepIndex(step);
    const predecessor = _readPredecessorRecord(db, ctx.runId, currentIndex);
    if (outcome.chain_output && typeof outcome.chain_output === 'object') {
      outcome.chain_output.shared_state = predecessor.shared_state;
      if (predecessor.shared_state === null) {
        outcome.chain_output.shared_state_reason = predecessor.shared_state_reason;
      }
    }

    // The reviewer-rule directive (SHARED-10): additive on BOTH tiers, same
    // idiom as shared_state above. Absent when the step declares no
    // reviewer, or declares reviewer.kind: 'navigator' (the gate already
    // reviews it).
    const review = _reviewDirectiveFor(step, roomDir, ctx.runId, currentIndex);
    if (review && outcome.chain_output && typeof outcome.chain_output === 'object') {
      outcome.chain_output.review = review;
    }

    navigation.logMemoryEvent(db, 'mcp_client_event_logged', {
      label: 'chain_step_dispatched',
      step: step && step.step,
      command: command,
      framework: step && step.framework,
      executed: !!(outcome.chain_output && outcome.chain_output.executed),
    });

    return outcome;
  } finally {
    navigation.closeRoomDbForCaller(db);
  }
}

/**
 * makeChainStepDispatcher(roomDir, opts) -> onStep(step, previousOutput)
 *
 * The shape lib/mcp/tools/chain.cjs installs as chain_run's onStep default
 * (Plan 08 rewires makeDefaultOnStep to this). opts.sessionId,
 * opts.targetSection and opts.runId are the only production-facing
 * overrides; there is no production path to registryPath or
 * dispatchTimeoutMs. opts.runId is the phase 347-05 seam: chain.cjs's own
 * wiring of the real per-invocation run_id is a later plan's scope (347-08)
 * -- absent here, dispatchStep's shared-state read degrades honestly to
 * shared_state: null, reason no_predecessor, exactly like every other
 * missing-input case above.
 */
function makeChainStepDispatcher(roomDir, opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  return async function onStep(step, previousOutput) {
    return dispatchStep(step, previousOutput, {
      roomDir: roomDir,
      sessionId: o.sessionId,
      targetSection: o.targetSection,
      runId: o.runId,
    });
  };
}

module.exports = {
  dispatchStep: dispatchStep,
  makeChainStepDispatcher: makeChainStepDispatcher,
  resolveExecutable: resolveExecutable,
  executableCommands: executableCommands,
  scriptPathFor: scriptPathFor,
  TIER_EXECUTABLE: TIER_EXECUTABLE,
  TIER_HOST_DISPATCH: TIER_HOST_DISPATCH,
  DISPATCH_TIMEOUT_MS: DISPATCH_TIMEOUT_MS,
};
