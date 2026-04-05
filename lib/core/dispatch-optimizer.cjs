/**
 * MindrianOS Plugin - Agent Dispatch Optimizer
 * Budget-aware swarm sizing, cost estimation, and model downgrade logic.
 * Pure Node.js built-ins only. No npm dependencies.
 *
 * Requirements: AGENT-01, AGENT-02, AGENT-04
 */

'use strict';

const path = require('path');
const { safeReadFile } = require('./index.cjs');
const { resolveModel } = require('./model-profiles.cjs');

// ─── Token Cost Constants ──────────────────────────────────────────
// Approximate token costs per agent invocation by model tier.
// Based on Claude API pricing (input + output per typical methodology session).
// These are estimates -- actual cost varies by session depth.

const TOKEN_COSTS = {
  opus:   { input: 30000, output: 20000, total: 50000 },
  sonnet: { input: 15000, output: 10000, total: 25000 },
  haiku:  { input:  5000, output:  3000, total:  8000 },
};

// Default context window sizes by model
const CONTEXT_WINDOWS = {
  opus:   200000,
  sonnet: 200000,
  haiku:  200000,
};

// Safety margin -- never use more than this fraction of remaining context
const BUDGET_SAFETY_MARGIN = 0.85;

// Downgrade threshold -- if total cost exceeds this fraction of remaining context, downgrade
const DOWNGRADE_THRESHOLD = 0.6;

// ─── Cost Estimation ───────────────────────────────────────────────

/**
 * Estimate token cost for dispatching N agents at a given model tier.
 * @param {number} agentCount - Number of agents to dispatch
 * @param {string} model - Model alias (opus, sonnet, haiku)
 * @returns {{ perAgent: number, total: number, model: string, breakdown: { input: number, output: number } }}
 */
function estimateTokenCost(agentCount, model) {
  const tier = TOKEN_COSTS[model] || TOKEN_COSTS.sonnet;
  return {
    perAgent: tier.total,
    total: tier.total * agentCount,
    model,
    breakdown: {
      input: tier.input * agentCount,
      output: tier.output * agentCount,
    },
  };
}

/**
 * Format a cost estimate as a human-readable string for display.
 * @param {{ total: number, model: string, perAgent: number }} estimate
 * @param {number} agentCount
 * @returns {string} e.g. "This will use ~150K tokens (3 agents x Opus)"
 */
function formatCostEstimate(estimate, agentCount) {
  const totalK = Math.round(estimate.total / 1000);
  const modelName = estimate.model.charAt(0).toUpperCase() + estimate.model.slice(1);
  return `This will use ~${totalK}K tokens (${agentCount} agent${agentCount !== 1 ? 's' : ''} x ${modelName})`;
}

// ─── Dynamic Swarm Sizing ──────────────────────────────────────────

/**
 * Identify weak sections from room STATE.md.
 * Weak = fewer than 5 entries.
 * @param {string} roomDir - Path to room directory
 * @returns {Array<{ section: string, entries: number }>} Sorted ascending by entry count
 */
function findWeakSections(roomDir) {
  const statePath = path.join(roomDir, 'STATE.md');
  const content = safeReadFile(statePath);
  if (!content) return [];

  const sections = [];
  // Parse section fill levels from STATE.md
  // Format varies but typically: "section-name: N entries" or "| section-name | N |"
  const tablePattern = /\|\s*([a-z][a-z0-9-]+)\s*\|\s*(\d+)\s*\|/gi;
  const linePattern = /^\s*[-*]\s+([a-z][a-z0-9-]+)(?:\/?):\s*(\d+)\s*entr/gmi;

  let match;
  while ((match = tablePattern.exec(content)) !== null) {
    const name = match[1].trim();
    const count = parseInt(match[2], 10);
    if (count < 5) {
      sections.push({ section: name, entries: count });
    }
  }

  // Also try line-based format
  while ((match = linePattern.exec(content)) !== null) {
    const name = match[1].trim();
    const count = parseInt(match[2], 10);
    // Avoid duplicates
    if (count < 5 && !sections.find(s => s.section === name)) {
      sections.push({ section: name, entries: count });
    }
  }

  // Sort ascending by entry count (weakest first)
  sections.sort((a, b) => a.entries - b.entries);
  return sections;
}

/**
 * Calculate optimal swarm size based on weak sections and context budget.
 * Formula: N = min(weakSections.length, floor(contextBudget / agentCost))
 *
 * @param {Array<{ section: string, entries: number }>} weakSections - Weak sections from findWeakSections()
 * @param {number} contextBudget - Remaining context tokens available
 * @param {number} agentCost - Token cost per agent (from estimateTokenCost)
 * @returns {{ count: number, sections: Array<{ section: string, entries: number }>, reason: string }}
 */
function scaleSwarm(weakSections, contextBudget, agentCost) {
  if (!weakSections || weakSections.length === 0) {
    return {
      count: 0,
      sections: [],
      reason: 'No weak sections found -- room is well-developed',
    };
  }

  const usableBudget = Math.floor(contextBudget * BUDGET_SAFETY_MARGIN);
  const maxByBudget = Math.max(1, Math.floor(usableBudget / agentCost));
  const maxBySections = weakSections.length;
  const count = Math.min(maxByBudget, maxBySections);
  const selectedSections = weakSections.slice(0, count);

  let reason;
  if (maxByBudget < maxBySections) {
    reason = `Budget-limited: ${maxByBudget} agents fit in ${Math.round(usableBudget / 1000)}K budget (${maxBySections} weak sections available)`;
  } else {
    reason = `Section-limited: ${maxBySections} weak section${maxBySections !== 1 ? 's' : ''} found (budget allows ${maxByBudget})`;
  }

  return { count, sections: selectedSections, reason };
}

// ─── Budget-Aware Model Selection ──────────────────────────────────

/**
 * Select optimal model tier based on total dispatch cost vs remaining context.
 * If total cost at current model exceeds DOWNGRADE_THRESHOLD of remaining context,
 * downgrade from opus -> sonnet -> haiku.
 *
 * @param {number} agentCount - Number of agents to dispatch
 * @param {string} preferredModel - The model resolved by model-profiles.cjs
 * @param {number} remainingContext - Remaining context tokens
 * @returns {{ model: string, downgraded: boolean, originalModel: string, reason: string }}
 */
function selectModel(agentCount, preferredModel, remainingContext) {
  const downgradeChain = ['opus', 'sonnet', 'haiku'];
  const startIdx = downgradeChain.indexOf(preferredModel);

  // If preferred model not in chain, use as-is (could be 'inherit' or 'skip')
  if (startIdx === -1) {
    return {
      model: preferredModel,
      downgraded: false,
      originalModel: preferredModel,
      reason: `Model "${preferredModel}" is not in downgrade chain -- using as-is`,
    };
  }

  for (let i = startIdx; i < downgradeChain.length; i++) {
    const candidate = downgradeChain[i];
    const cost = estimateTokenCost(agentCount, candidate);

    if (cost.total <= remainingContext * DOWNGRADE_THRESHOLD) {
      const downgraded = i > startIdx;
      return {
        model: candidate,
        downgraded,
        originalModel: preferredModel,
        reason: downgraded
          ? `Downgraded ${preferredModel} -> ${candidate}: ${Math.round(cost.total / 1000)}K tokens fits within ${Math.round(remainingContext * DOWNGRADE_THRESHOLD / 1000)}K budget (60% of ${Math.round(remainingContext / 1000)}K remaining)`
          : `${candidate} fits within budget: ${Math.round(cost.total / 1000)}K of ${Math.round(remainingContext * DOWNGRADE_THRESHOLD / 1000)}K allowed`,
      };
    }
  }

  // Even haiku exceeds budget -- dispatch minimum with haiku
  return {
    model: 'haiku',
    downgraded: true,
    originalModel: preferredModel,
    reason: `All models exceed 60% budget -- using haiku as minimum (${Math.round(estimateTokenCost(agentCount, 'haiku').total / 1000)}K tokens)`,
  };
}

// ─── Full Dispatch Plan ────────────────────────────────────────────

/**
 * Generate a complete dispatch plan for swarm mode.
 * Combines weak section detection, swarm sizing, model selection, and cost estimation.
 *
 * @param {string} roomDir - Path to room directory
 * @param {Object} options
 * @param {number} [options.remainingContext=200000] - Remaining context tokens
 * @param {number} [options.maxBudget] - User-specified max token budget (--budget flag)
 * @param {string} [options.preferredModel] - Override model (otherwise resolved from room config)
 * @returns {Object} Full dispatch plan with agents, costs, and reasoning
 */
function planDispatch(roomDir, options = {}) {
  const remainingContext = options.remainingContext || 200000;
  const maxBudget = options.maxBudget || remainingContext;
  const effectiveBudget = Math.min(remainingContext, maxBudget);

  // Resolve preferred model from room config
  const preferredModel = options.preferredModel || resolveModel(roomDir, 'framework-runner');

  // Find weak sections
  const weakSections = findWeakSections(roomDir);

  // Model selection with budget awareness
  const modelResult = selectModel(
    weakSections.length || 1,
    preferredModel === 'skip' ? 'sonnet' : preferredModel,
    effectiveBudget
  );

  // Cost per agent at selected model
  const perAgentCost = estimateTokenCost(1, modelResult.model).total;

  // Scale swarm to budget
  const swarmResult = scaleSwarm(weakSections, effectiveBudget, perAgentCost);

  // Total cost estimate
  const totalEstimate = estimateTokenCost(swarmResult.count, modelResult.model);

  return {
    agents: swarmResult.count,
    model: modelResult.model,
    sections: swarmResult.sections,
    cost: {
      perAgent: perAgentCost,
      total: totalEstimate.total,
      display: formatCostEstimate(totalEstimate, swarmResult.count),
    },
    budget: {
      remaining: remainingContext,
      maxBudget: maxBudget !== remainingContext ? maxBudget : null,
      effective: effectiveBudget,
    },
    downgrade: modelResult.downgraded ? {
      from: modelResult.originalModel,
      to: modelResult.model,
      reason: modelResult.reason,
    } : null,
    reasoning: {
      swarm: swarmResult.reason,
      model: modelResult.reason,
    },
  };
}

// ─── Chain Checkpoint Support ──────────────────────────────────────

/**
 * Generate a chain checkpoint prompt for the user.
 * Used between pipeline steps in --chain mode.
 *
 * @param {number} currentStep - 1-indexed current step number
 * @param {number} totalSteps - Total steps in chain
 * @param {string} completedFramework - Name of just-completed framework
 * @param {string} nextFramework - Name of next framework to run
 * @param {Object} [stats] - Optional stats from completed step
 * @param {number} [stats.artifactsAdded] - Artifacts filed
 * @param {string} [stats.section] - Target section
 * @returns {{ prompt: string, metadata: Object }}
 */
function chainCheckpoint(currentStep, totalSteps, completedFramework, nextFramework, stats = {}) {
  const prompt = [
    `[CHAIN] Step ${currentStep}/${totalSteps} complete: ${completedFramework}`,
    stats.artifactsAdded ? `        Filed: ${stats.artifactsAdded} artifact${stats.artifactsAdded !== 1 ? 's' : ''} to room/${stats.section || 'unknown'}/` : null,
    '',
    `Continue to step ${currentStep + 1}? (${nextFramework})`,
    '(yes / skip / stop)',
  ].filter(Boolean).join('\n');

  return {
    prompt,
    metadata: {
      step: currentStep,
      total: totalSteps,
      completed: completedFramework,
      next: nextFramework,
      canSkip: true,
      canStop: true,
    },
  };
}

// ─── CLI Interface ─────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const subcmd = args[0];

  if (subcmd === 'estimate' && args.length >= 3) {
    // estimate <agentCount> <model>
    const result = estimateTokenCost(parseInt(args[1], 10), args[2]);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else if (subcmd === 'plan' && args.length >= 2) {
    // plan <roomDir> [--budget <N>] [--context <N>]
    const roomDir = args[1];
    const opts = {};
    for (let i = 2; i < args.length; i += 2) {
      if (args[i] === '--budget' && args[i + 1]) opts.maxBudget = parseInt(args[i + 1], 10);
      if (args[i] === '--context' && args[i + 1]) opts.remainingContext = parseInt(args[i + 1], 10);
    }
    const result = planDispatch(roomDir, opts);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else if (subcmd === 'weak-sections' && args.length >= 2) {
    // weak-sections <roomDir>
    const result = findWeakSections(args[1]);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else if (subcmd === 'select-model' && args.length >= 4) {
    // select-model <agentCount> <preferredModel> <remainingContext>
    const result = selectModel(parseInt(args[1], 10), args[2], parseInt(args[3], 10));
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    process.stderr.write('Usage: node dispatch-optimizer.cjs <estimate|plan|weak-sections|select-model> [args...]\n');
    process.stderr.write('  estimate <agentCount> <model>\n');
    process.stderr.write('  plan <roomDir> [--budget <N>] [--context <N>]\n');
    process.stderr.write('  weak-sections <roomDir>\n');
    process.stderr.write('  select-model <agentCount> <preferredModel> <remainingContext>\n');
    process.exit(1);
  }
}

module.exports = {
  TOKEN_COSTS,
  CONTEXT_WINDOWS,
  DOWNGRADE_THRESHOLD,
  BUDGET_SAFETY_MARGIN,
  estimateTokenCost,
  formatCostEstimate,
  findWeakSections,
  scaleSwarm,
  selectModel,
  planDispatch,
  chainCheckpoint,
};
