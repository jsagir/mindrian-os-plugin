/**
 * MindrianOS Plugin - Model Profiles & Routing
 * Maps agents to model aliases across profile tiers, venture stages, and cascade steps.
 * Pure Node.js built-ins only. No npm dependencies.
 */

'use strict';

const path = require('path');
const os = require('os');
const { safeReadFile } = require('./index.cjs');
const { getState } = require('./state-ops.cjs');

/**
 * MODEL_PROFILES: 8 agents x 3 profile tiers (quality/balanced/budget).
 * Each value is a model alias (opus, sonnet, haiku).
 */
const MODEL_PROFILES = {
  'larry-extended':      { quality: 'opus',   balanced: 'opus',   budget: 'sonnet' },
  'framework-runner':    { quality: 'opus',   balanced: 'opus',   budget: 'sonnet' },
  'grading':             { quality: 'opus',   balanced: 'opus',   budget: 'sonnet' },
  'investor':            { quality: 'opus',   balanced: 'sonnet', budget: 'sonnet' },
  'brain-query':         { quality: 'opus',   balanced: 'sonnet', budget: 'haiku'  },
  'research':            { quality: 'opus',   balanced: 'sonnet', budget: 'haiku'  },
  'opportunity-scanner': { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku'  },
  'persona-analyst':     { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku'  },
};

/** Valid profile tier names */
const VALID_PROFILES = ['quality', 'balanced', 'budget'];

/**
 * STAGE_HINTS: Venture-stage adaptive model hints.
 * null means "skip" - agent should not run at this stage.
 */
const STAGE_HINTS = {
  'Pre-Opportunity': { 'framework-runner': 'sonnet', 'research': 'haiku',  'grading': null,     'investor': null     },
  'Discovery':       { 'framework-runner': 'opus',   'research': 'sonnet', 'grading': 'sonnet', 'investor': null     },
  'Validation':      { 'framework-runner': 'opus',   'research': 'sonnet', 'grading': 'opus',   'investor': 'sonnet' },
  'Design':          { 'framework-runner': 'opus',   'research': 'sonnet', 'grading': 'opus',   'investor': 'sonnet' },
  'Investment':      { 'framework-runner': 'opus',   'research': 'opus',   'grading': 'opus',   'investor': 'opus'   },
};

/** Valid venture stage names */
const VALID_STAGES = ['Pre-Opportunity', 'Discovery', 'Validation', 'Design', 'Investment'];

/**
 * CASCADE_MODELS: Model assignments for cascade pipeline steps.
 * null means the step uses no LLM (pure computation).
 */
const CASCADE_MODELS = {
  'classify':           'haiku',
  'detect-edges':       'sonnet',
  'proactive-analysis': 'sonnet',
  'hsi-to-kuzu':        'haiku',
  'compute-state':      null,
};

/**
 * Load room config from .config.json with graceful defaults.
 * Tries room-level first, then global ~/.mindrian/defaults.json.
 * @param {string} roomDir - Path to room directory
 * @returns {{ model_profile: string, model_overrides: Object }}
 */
function loadRoomConfig(roomDir) {
  const defaults = { model_profile: 'quality', model_overrides: {} };

  // Try room-level config
  const roomConfigPath = path.join(roomDir, '.config.json');
  const roomRaw = safeReadFile(roomConfigPath);
  if (roomRaw) {
    try {
      const parsed = JSON.parse(roomRaw);
      return { ...defaults, ...parsed };
    } catch (_) {
      // Fall through on parse error
    }
  }

  // Try global config
  const globalConfigPath = path.join(os.homedir(), '.mindrian', 'defaults.json');
  const globalRaw = safeReadFile(globalConfigPath);
  if (globalRaw) {
    try {
      const parsed = JSON.parse(globalRaw);
      return { ...defaults, ...parsed };
    } catch (_) {
      // Fall through on parse error
    }
  }

  return defaults;
}

/**
 * Parse venture stage from room STATE.md.
 * @param {string} roomDir - Path to room directory
 * @returns {string|null} Valid stage name or null
 */
function parseVentureStage(roomDir) {
  const stateContent = getState(roomDir);
  if (!stateContent) return null;

  const match = stateContent.match(/(?:Venture\s+)?Stage:\s*(.+)/i);
  if (!match) return null;

  const rawStage = match[1].trim();
  const found = VALID_STAGES.find(s => s.toLowerCase() === rawStage.toLowerCase());
  return found || null;
}

/**
 * Resolve model alias for a given agent in a room context.
 * 5-step cascade: override > stage-hint > inherit > profile > default.
 * @param {string} roomDir - Path to room directory
 * @param {string} agentType - Agent key from MODEL_PROFILES
 * @returns {string} Model alias or 'skip'
 */
function resolveModel(roomDir, agentType) {
  const config = loadRoomConfig(roomDir);

  // Step 1: Per-agent override
  if (config.model_overrides && config.model_overrides[agentType]) {
    return config.model_overrides[agentType];
  }

  // Step 2: Venture-stage hint
  const stage = parseVentureStage(roomDir);
  if (stage && STAGE_HINTS[stage]) {
    const hint = STAGE_HINTS[stage][agentType];
    if (hint === null) return 'skip';
    if (typeof hint === 'string') return hint;
    // Agent not in stage hints - fall through
  }

  // Step 3: Inherit profile
  if (config.model_profile === 'inherit') {
    return 'inherit';
  }

  // Step 4: Profile lookup
  const profile = config.model_profile || 'quality';
  if (MODEL_PROFILES[agentType] && MODEL_PROFILES[agentType][profile]) {
    return MODEL_PROFILES[agentType][profile];
  }

  // Step 5: Default
  return 'sonnet';
}

/**
 * Resolve model for a cascade pipeline step.
 * @param {string} step - Cascade step key
 * @returns {string|null} Model alias, null, or 'sonnet' fallback
 */
function resolveCascadeModel(step) {
  if (step in CASCADE_MODELS) {
    return CASCADE_MODELS[step];
  }
  return 'sonnet';
}

/**
 * Format a human-readable table of current model resolution for a room.
 * @param {string} roomDir - Path to room directory
 * @returns {string} Formatted table string
 */
function formatProfileTable(roomDir) {
  const config = loadRoomConfig(roomDir);
  const stage = parseVentureStage(roomDir);
  const profile = config.model_profile || 'quality';

  let lines = [];
  lines.push(`Profile: ${profile}` + (stage ? `  |  Stage: ${stage}` : ''));
  lines.push('');

  // Agent table header
  const agentWidth = 22;
  const modelWidth = 10;
  const sourceWidth = 20;
  const sep = '-'.repeat(agentWidth + 2) + '+' + '-'.repeat(modelWidth + 2) + '+' + '-'.repeat(sourceWidth + 2);
  lines.push(' ' + 'Agent'.padEnd(agentWidth) + ' | ' + 'Model'.padEnd(modelWidth) + ' | ' + 'Source'.padEnd(sourceWidth));
  lines.push(sep);

  for (const agent of Object.keys(MODEL_PROFILES)) {
    const resolved = resolveModel(roomDir, agent);
    let source = '(default)';

    if (config.model_overrides && config.model_overrides[agent]) {
      source = '(override)';
    } else if (stage && STAGE_HINTS[stage] && agent in STAGE_HINTS[stage]) {
      source = `(stage: ${stage})`;
    } else if (profile === 'inherit') {
      source = '(inherit)';
    } else if (MODEL_PROFILES[agent] && MODEL_PROFILES[agent][profile]) {
      source = '(profile)';
    }

    lines.push(' ' + agent.padEnd(agentWidth) + ' | ' + String(resolved).padEnd(modelWidth) + ' | ' + source);
  }

  // Cascade section
  lines.push('');
  lines.push('Cascade Steps:');
  lines.push(sep);

  for (const [step, model] of Object.entries(CASCADE_MODELS)) {
    const display = model === null ? 'none' : model;
    lines.push(' ' + step.padEnd(agentWidth) + ' | ' + display.padEnd(modelWidth) + ' | (cascade)');
  }

  return lines.join('\n');
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const subcmd = args[0];

  if (subcmd === 'resolve' && args.length >= 3) {
    const result = resolveModel(args[1], args[2]);
    process.stdout.write(result + '\n');
  } else if (subcmd === 'cascade' && args.length >= 2) {
    const result = resolveCascadeModel(args[1]);
    process.stdout.write((result === null ? 'null' : result) + '\n');
  } else if (subcmd === 'table' && args.length >= 2) {
    process.stdout.write(formatProfileTable(args[1]) + '\n');
  } else if (subcmd === 'profile' && args.length >= 2) {
    process.stdout.write(JSON.stringify(loadRoomConfig(args[1]), null, 2) + '\n');
  } else {
    process.stderr.write('Usage: node model-profiles.cjs <resolve|cascade|table|profile> [args...]\n');
    process.exit(1);
  }
}

module.exports = {
  MODEL_PROFILES,
  VALID_PROFILES,
  STAGE_HINTS,
  CASCADE_MODELS,
  loadRoomConfig,
  parseVentureStage,
  resolveModel,
  resolveCascadeModel,
  formatProfileTable,
};
