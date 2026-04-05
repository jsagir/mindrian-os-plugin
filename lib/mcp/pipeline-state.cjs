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
 * @module pipeline-state
 */

const fs = require('fs');
const path = require('path');

const PIPELINE_DIR = '.mindrian';
const PIPELINE_FILE = 'pipeline-state.json';

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
 * @param {string} roomDir - Absolute path to the room directory
 * @param {string} toolName - Tool about to be executed
 * @returns {{ inPipeline: boolean, isNext: boolean, position: number, chain: string[], previousOutput: string|null }}
 */
function checkPosition(roomDir, toolName) {
  const state = read(roomDir);

  if (!state || !state.chain || state.chain.length === 0) {
    return {
      inPipeline: false,
      isNext: false,
      position: -1,
      chain: [],
      previousOutput: null
    };
  }

  const nextExpected = state.chain[state.chain_position + 1];
  const isInChain = state.chain.includes(toolName);

  return {
    inPipeline: true,
    isNext: nextExpected === toolName,
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
  formatPipelineContext
};
