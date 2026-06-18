'use strict';

/**
 * MindrianOS Pipeline State Manager
 *
 * Manages pipeline state via room artifacts. When a methodology tool writes
 * output, metadata is stored in room/.mindrian/pipeline-state.json so the
 * next tool in the chain knows what came before.
 *
 * State file: room/.mindrian/pipeline-state.json
 * Schema:
 *   {
 *     last_tool: string,        // e.g. "scenario-plan"
 *     output_path: string,      // relative path to filed artifact
 *     chain_position: number,   // 0-based index in current chain
 *     suggested_next: string,   // next tool name
 *     chain: string[],          // full ordered chain (from Brain or heuristic)
 *     chain_source: string,     // "brain" | "local" | "manual"
 *     started_at: string,       // ISO timestamp of chain start
 *     updated_at: string,       // ISO timestamp of last update
 *     history: Array<{tool: string, output_path: string, completed_at: string}>
 *   }
 *
 * Follows ICM principle: state lives inside room/ (folder IS orchestration).
 * Pipeline state is a room artifact, not external infrastructure.
 *
 * SOLE CHAIN-STATE SOURCE OF TRUTH (B1, D-166-02)
 * -----------------------------------------------
 * Per Canon decision D-166-02, this file (room/.mindrian/pipeline-state.json)
 * is the SOLE source of truth for chain position and resume state. The
 * artifact-frontmatter scan described in commands/pipeline.md:78-114 is a
 * SECONDARY index only -- a human-readable mirror, NEVER a competing
 * chain-state source. A resumed chain reads its position from THIS store and
 * nowhere else, so two disagreeing memories (pipeline-state.json vs the
 * frontmatter scan) cannot occur. The exported CHAIN_STATE_SOURCE constant is
 * the stable marker the executor and the verdict assert on to prove this
 * single-source invariant.
 *
 * checkPosition exposes a HARD GATE (B1): it returns a gate enum ('run' when
 * the tool is the next expected step, 'withhold' otherwise) plus a withhold
 * reason. Callers MUST honor the gate before running a step -- isNext is no
 * longer merely advisory. The legacy isNext boolean stays byte-stable for
 * prior callers; the gate / reason / expectedNext fields are additive.
 *
 * @module pipeline-state
 */

const fs = require('fs');
const path = require('path');

const PIPELINE_DIR = '.mindrian';
const PIPELINE_FILE = 'pipeline-state.json';

/**
 * The sole chain-state source of truth marker (D-166-02). The executor and the
 * verdict assert on this constant to prove the frontmatter scan is a secondary
 * index only, never a competing store.
 * @type {string}
 */
const CHAIN_STATE_SOURCE = PIPELINE_FILE;

/**
 * Resolve the pipeline state file path for a room.
 * @param {string} roomDir - Absolute path to the room directory
 * @returns {string} Absolute path to pipeline-state.json
 */
function statePath(roomDir) {
  return path.join(roomDir, PIPELINE_DIR, PIPELINE_FILE);
}

/**
 * Ensure the .mindrian directory exists in the room.
 * @param {string} roomDir
 */
function ensureDir(roomDir) {
  const dir = path.join(roomDir, PIPELINE_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Read the current pipeline state from a room.
 * Returns null if no pipeline is active (no state file or empty).
 *
 * @param {string} roomDir - Absolute path to the room directory
 * @returns {object|null} Pipeline state or null
 */
function read(roomDir) {
  const fp = statePath(roomDir);
  try {
    const raw = fs.readFileSync(fp, 'utf8');
    return JSON.parse(raw);
  } catch (_e) {
    return null;
  }
}

/**
 * Write pipeline state to a room.
 *
 * @param {string} roomDir - Absolute path to the room directory
 * @param {object} state - Pipeline state object
 */
function write(roomDir, state) {
  ensureDir(roomDir);
  const fp = statePath(roomDir);
  fs.writeFileSync(fp, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

/**
 * Initialize a new pipeline chain in a room.
 * Called when Brain or local heuristic provides a chain recommendation.
 *
 * @param {string} roomDir - Absolute path to the room directory
 * @param {string[]} chain - Ordered array of methodology/analysis tool names
 * @param {string} source - Where the chain came from: "brain" | "local" | "manual"
 * @returns {object} The initialized pipeline state
 */
function initChain(roomDir, chain, source) {
  const state = {
    last_tool: null,
    output_path: null,
    chain_position: -1,
    suggested_next: chain.length > 0 ? chain[0] : null,
    chain,
    chain_source: source,
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    history: []
  };
  write(roomDir, state);
  return state;
}

/**
 * Record that a tool completed and advance the pipeline position.
 *
 * If the tool matches the next expected tool in the chain, advance
 * chain_position. If it doesn't match (user ran a different tool),
 * still record it but don't advance -- the chain ordering is advisory.
 *
 * @param {string} roomDir - Absolute path to the room directory
 * @param {string} toolName - The methodology/analysis tool that just completed
 * @param {string} outputPath - Relative path (from room root) to the filed artifact
 * @returns {object} Updated pipeline state
 */
function recordStep(roomDir, toolName, outputPath) {
  let state = read(roomDir);

  if (!state) {
    // No active pipeline -- create a minimal one
    state = {
      last_tool: null,
      output_path: null,
      chain_position: -1,
      suggested_next: null,
      chain: [],
      chain_source: 'manual',
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      history: []
    };
  }

  // Record the step in history
  state.history.push({
    tool: toolName,
    output_path: outputPath,
    completed_at: new Date().toISOString()
  });

  state.last_tool = toolName;
  state.output_path = outputPath;
  state.updated_at = new Date().toISOString();

  // Check if this tool matches the next expected in the chain
  const nextExpected = state.chain[state.chain_position + 1];
  if (nextExpected && nextExpected === toolName) {
    // Advance position in the chain
    state.chain_position += 1;
  }

  // Set suggested_next to the next tool in the chain (if any remain)
  const nextInChain = state.chain[state.chain_position + 1];
  state.suggested_next = nextInChain || null;

  write(roomDir, state);
  return state;
}

/**
 * Check if a given tool is the next expected step in the active pipeline.
 *
 * HARD GATE (B1, D-166-02): in addition to the legacy advisory `isNext`
 * boolean (kept byte-stable for prior callers), the return now carries a
 * hard-gate triple the executor MUST honor before running a step:
 *   - `gate`: 'run' when the tool IS the next expected step, 'withhold' otherwise.
 *   - `reason`: null when gate is 'run'; 'no_active_chain' when no chain is
 *     active; 'not_next' when a chain is active but the tool is not the next
 *     expected step.
 *   - `expectedNext`: the tool the chain expects next (so a 'not_next' withhold
 *     names what should run), or null when none remains / no chain.
 * The gate never returns a silent `true` for a no-chain or out-of-order step.
 *
 * @param {string} roomDir - Absolute path to the room directory
 * @param {string} toolName - Tool about to be executed
 * @returns {{ inPipeline: boolean, isNext: boolean, gate: ('run'|'withhold'), reason: (string|null), expectedNext: (string|null), position: number, chain: string[], previousOutput: string|null }}
 */
function checkPosition(roomDir, toolName) {
  const state = read(roomDir);

  if (!state || !state.chain || state.chain.length === 0) {
    return {
      inPipeline: false,
      isNext: false,
      gate: 'withhold',
      reason: 'no_active_chain',
      expectedNext: null,
      position: -1,
      chain: [],
      previousOutput: null
    };
  }

  const nextExpected = state.chain[state.chain_position + 1];
  const isNext = nextExpected === toolName;

  return {
    inPipeline: true,
    isNext: isNext,
    gate: isNext ? 'run' : 'withhold',
    reason: isNext ? null : 'not_next',
    expectedNext: (typeof nextExpected === 'string') ? nextExpected : null,
    position: state.chain.indexOf(toolName),
    chain: state.chain,
    previousOutput: state.output_path
  };
}

/**
 * Get the output path from the previous step in the pipeline.
 * Returns null if no previous step or no active pipeline.
 *
 * @param {string} roomDir - Absolute path to the room directory
 * @returns {string|null} Relative path to previous step's artifact, or null
 */
function getPreviousOutput(roomDir) {
  const state = read(roomDir);
  if (!state || !state.output_path) return null;
  return state.output_path;
}

/**
 * Build a provenanceFn for a runChain-driven pipeline (Phase 166-05, D-166-04).
 *
 * The pipeline is the runChain CONSUMER that supplies a provenanceFn (act and
 * ignite pass null). The factory returns a (step, result) -> frontmatter stamp
 * that maps each stage to its pipeline frontmatter fields:
 *   { pipeline: <chainName>, pipeline_stage: <step.step> }
 * mirroring the framework-runner frontmatter contract (framework-runner.md:220:
 * "Each stage's artifact gets pipeline: <chain> and pipeline_stage: {N}").
 *
 * Canon Part 8 (T-166-18, accept): the stamp carries ONLY generic stage metadata
 * (the pipeline name + the stage number). It NEVER copies user content from the
 * step result (chain_output / body) into the stamp, and it never crosses to Brain.
 *
 * A single-mode invocation (no chain name) returns null -- there is no pipeline to
 * stamp, exactly as act and ignite pass provenanceFn:null when they are not the
 * pipeline.
 *
 * @param {string|null} chainName - The pipeline chain name (e.g. "discovery"), or
 *   null/empty for a single-mode (no-chain) caller.
 * @returns {(function(object, object): {pipeline: string, pipeline_stage: number})|null}
 *   The stamp function, or null when no chain name was supplied.
 */
function makeProvenanceFn(chainName) {
  if (typeof chainName !== 'string' || chainName.length === 0) {
    return null;
  }
  return function provenanceFn(step, _result) {
    const stage = (step && typeof step.step === 'number') ? step.step : null;
    // Generic stage metadata ONLY -- never the result body (Part 8 T-166-18).
    return { pipeline: chainName, pipeline_stage: stage };
  };
}

/**
 * Reconcile a pipeline resume position from the SOLE chain-state truth (B1,
 * D-166-02) with the SECONDARY artifact-frontmatter index.
 *
 * The pipeline command (commands/pipeline.md) historically resumed by scanning the
 * Room for artifacts carrying `pipeline: {chain}` frontmatter (the block at
 * commands/pipeline.md:78-114). Per the Wave-1 B1 reconciliation, the
 * pipeline-state.json store is the SOLE source of truth for the resume position;
 * the frontmatter scan is a SECONDARY confirming index ONLY, never a competing
 * store (CHAIN_STATE_SOURCE is the marker that names it).
 *
 * This helper reads the chain position from THIS store (the last COMPLETED stage's
 * chain_position) and the next stage to run, then cross-checks the SECONDARY scan:
 *   - AGREE   (the scan reports the same number of completed stages):
 *             return the position with frontmatterStale:false.
 *   - DISAGREE (the scan reports a different count):
 *             trust pipeline-state.json, return ITS position, and flag the
 *             frontmatter STALE (never the reverse -- the scan never overrides the
 *             sole truth). T-166-16.
 *
 * @param {string} roomDir - Absolute path to the room directory
 * @param {object} [opts] - Optional secondary-index inputs.
 * @param {number} [opts.frontmatterStagesComplete] - The count of completed stages
 *   the artifact-frontmatter scan observed (the SECONDARY confirming index). When
 *   omitted, no cross-check is performed and frontmatterStale stays false.
 * @returns {{ source: string, position: number, nextStage: (string|null),
 *   agree: boolean, frontmatterStale: boolean }}
 *   source         always CHAIN_STATE_SOURCE (the sole truth marker).
 *   position       the chain_position (the last completed stage index; -1 = none).
 *   nextStage      the next stage tool to run, or null when the chain is complete.
 *   agree          true when the secondary scan matched (or was not supplied).
 *   frontmatterStale true ONLY when a supplied scan disagreed with the sole truth.
 */
function reconcileResume(roomDir, opts) {
  const o = opts || {};
  const state = read(roomDir);

  const position = (state && typeof state.chain_position === 'number')
    ? state.chain_position
    : -1;
  let nextStage = null;
  if (state && Array.isArray(state.chain)) {
    const candidate = state.chain[position + 1];
    nextStage = (typeof candidate === 'string') ? candidate : null;
  }

  // The SOLE truth's completed-stage count: chain_position is the 0-based index of
  // the last completed stage, so position + 1 stages have completed.
  const soleTruthComplete = position + 1;

  let agree = true;
  let frontmatterStale = false;
  if (typeof o.frontmatterStagesComplete === 'number') {
    agree = o.frontmatterStagesComplete === soleTruthComplete;
    // On disagreement the SECONDARY frontmatter scan is stale; pipeline-state wins.
    frontmatterStale = !agree;
  }

  return {
    source: CHAIN_STATE_SOURCE,
    position: position,
    nextStage: nextStage,
    agree: agree,
    frontmatterStale: frontmatterStale
  };
}

/**
 * Clear the pipeline state (pipeline completed or abandoned).
 *
 * @param {string} roomDir - Absolute path to the room directory
 */
function clear(roomDir) {
  const fp = statePath(roomDir);
  try {
    fs.unlinkSync(fp);
  } catch (_e) {
    // Already gone
  }
}

/**
 * Format a Pipeline Context section for tool output.
 * Included in every methodology/analysis tool response so the LLM
 * knows where the output was filed and what comes next.
 *
 * @param {string} roomDir - Absolute path to the room directory
 * @param {string} toolName - Current tool name
 * @param {string} outputPath - Relative path to filed artifact
 * @returns {string} Formatted markdown section
 */
function formatPipelineContext(roomDir, toolName, outputPath) {
  const state = read(roomDir);
  const lines = [
    '\n\n## Pipeline Context',
    '',
    `**Tool:** \`${toolName}\``,
    `**Output filed:** \`${outputPath}\``
  ];

  if (state && state.chain && state.chain.length > 0) {
    const pos = state.chain_position >= 0 ? state.chain_position + 1 : 0;
    lines.push(`**Chain:** ${state.chain.map((t, i) => i === pos ? `**${t}**` : t).join(' -> ')}`);
    lines.push(`**Position:** ${pos + 1} of ${state.chain.length}`);

    if (state.suggested_next) {
      lines.push(`**Next:** \`${state.suggested_next}\``);
    } else {
      lines.push('**Status:** Pipeline complete');
    }
  }

  if (state && state.history && state.history.length > 0) {
    lines.push('', '**Previous steps:**');
    for (const step of state.history.slice(-3)) {
      lines.push(`- \`${step.tool}\` -> \`${step.output_path}\``);
    }
  }

  return lines.join('\n');
}

module.exports = {
  read,
  write,
  initChain,
  recordStep,
  checkPosition,
  getPreviousOutput,
  clear,
  formatPipelineContext,
  // Phase 166-05 (D-166-04 / B1): the pipeline migration onto runChain.
  makeProvenanceFn,
  reconcileResume,
  // Sole chain-state source of truth marker (B1, D-166-02).
  CHAIN_STATE_SOURCE
};
