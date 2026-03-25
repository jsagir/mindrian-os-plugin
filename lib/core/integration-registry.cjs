'use strict';

/**
 * Integration Registry — detects available integrations from env, MCP config, filesystem.
 *
 * Zero npm dependencies. Pure Node.js built-ins only (Phase 10 pattern).
 *
 * Exports:
 *   INTEGRATION_CATALOG — all known integrations with detection config
 *   detectIntegrations(options) — scan all integrations, return structured status
 *   checkIntegration(name) — single integration check
 *   getContextTriggers(userMessage, roomState) — suggest integrations based on context
 */

const fs = require('fs');
const path = require('path');

/**
 * Catalog of all known integrations.
 * Each entry defines how to detect it and what benefit it provides.
 */
const INTEGRATION_CATALOG = {
  brain: {
    env: 'MINDRIAN_BRAIN_KEY',
    mcp: 'mindrian-brain',
    benefit: 'Enhanced framework suggestions, grading calibration, cross-domain connections',
    setup: '/mos:setup brain',
    triggers: ['suggest-next', 'grade', 'connections', 'framework'],
    offer_text: "I'd be sharper with my teaching graph connected. One command: `/mos:setup brain`",
  },
  velma: {
    env: 'MODULATE_API_KEY',
    benefit: 'Audio transcription with speaker diarization and emotion detection',
    setup: '/mos:setup transcription',
    triggers: ['audio', 'transcript', 'recording', 'meeting recording'],
    offer_text: "I can transcribe that with speaker identification if you connect Velma -- `/mos:setup transcription`",
  },
  obsidian: {
    detect: 'filesystem',
    benefit: 'Vault sync -- room sections as Obsidian pages with graph view',
    setup: '/mos:setup obsidian',
    future: true,
    triggers: ['notes', 'vault', 'obsidian', 'knowledge base'],
    offer_text: "I noticed you might use Obsidian. Room sections could sync there -- that's on the roadmap.",
  },
  notion: {
    env: 'NOTION_API_KEY',
    mcp: 'notion',
    benefit: 'Workspace sync -- room intelligence in Notion pages',
    setup: '/mos:setup notion',
    future: true,
    triggers: ['notion', 'workspace', 'wiki'],
    offer_text: "Notion sync is coming. For now, `/mos:export` gets your room into any format.",
  },
  meeting_source: {
    mcp_pattern: ['read-ai', 'vexa', 'recall-ai'],
    benefit: 'Auto-fetch latest meeting transcripts',
    setup: '/mos:setup meetings',
    triggers: ['latest meeting', 'auto-fetch', 'meeting source'],
    offer_text: "I can auto-fetch meeting transcripts if you connect a source -- `/mos:setup meetings`",
  },
};

/**
 * Parse .mcp.json to extract configured MCP server keys.
 * Returns array of server key strings (lowercased).
 */
function parseMcpConfig(mcpConfigPath) {
  try {
    const raw = fs.readFileSync(mcpConfigPath, 'utf-8');
    const parsed = JSON.parse(raw);
    const servers = parsed.mcpServers || parsed.servers || {};
    return Object.keys(servers).map(k => k.toLowerCase());
  } catch (e) {
    return [];
  }
}

/**
 * Check for .obsidian/ directory by walking up from workDir (max 3 levels).
 */
function detectObsidianVault(workDir) {
  let current = workDir;
  for (let i = 0; i < 4; i++) {
    const obsDir = path.join(current, '.obsidian');
    try {
      const stat = fs.statSync(obsDir);
      if (stat.isDirectory()) return true;
    } catch (e) {
      // not found, continue
    }
    const parent = path.dirname(current);
    if (parent === current) break; // reached root
    current = parent;
  }
  return false;
}

/**
 * Detect status of a single integration.
 * @param {string} name — integration key from INTEGRATION_CATALOG
 * @param {object} opts — { workDir, mcpKeys }
 * @returns {object} status object
 */
function detectSingle(name, opts) {
  const catalog = INTEGRATION_CATALOG[name];
  if (!catalog) return { status: 'unknown' };

  const result = {};

  // Environment variable check
  if (catalog.env) {
    result.env_set = !!process.env[catalog.env];
  }

  // MCP server check (exact name match)
  if (catalog.mcp) {
    result.mcp_available = opts.mcpKeys.some(k => k.includes(catalog.mcp));
  }

  // MCP pattern check (any key containing one of the patterns)
  if (catalog.mcp_pattern) {
    const provider = catalog.mcp_pattern.find(p =>
      opts.mcpKeys.some(k => k.includes(p))
    );
    result.provider = provider || 'none';
  }

  // Filesystem check (Obsidian)
  if (catalog.detect === 'filesystem') {
    result.vault_found = detectObsidianVault(opts.workDir);
  }

  // Determine overall status
  const connected =
    result.env_set ||
    result.mcp_available ||
    result.vault_found ||
    (result.provider && result.provider !== 'none');

  result.status = connected ? (catalog.detect === 'filesystem' ? 'detected' : 'connected') : 'not-configured';

  return result;
}

/**
 * Detect all integrations.
 * @param {object} options
 * @param {string} options.workDir — defaults to process.cwd()
 * @param {string} options.mcpConfig — path to .mcp.json (defaults to workDir/.mcp.json)
 * @returns {object} keyed by integration name, each with status object
 */
function detectIntegrations(options = {}) {
  const workDir = options.workDir || process.cwd();
  const mcpConfigPath = options.mcpConfig || path.join(workDir, '.mcp.json');
  const mcpKeys = parseMcpConfig(mcpConfigPath);

  const opts = { workDir, mcpKeys };
  const results = {};

  for (const name of Object.keys(INTEGRATION_CATALOG)) {
    results[name] = detectSingle(name, opts);
  }

  return results;
}

/**
 * Check a single integration by name.
 * @param {string} name — integration key
 * @param {object} options — same as detectIntegrations
 * @returns {object} status object for that integration
 */
function checkIntegration(name, options = {}) {
  const workDir = options.workDir || process.cwd();
  const mcpConfigPath = options.mcpConfig || path.join(workDir, '.mcp.json');
  const mcpKeys = parseMcpConfig(mcpConfigPath);

  return detectSingle(name, { workDir, mcpKeys });
}

/**
 * Analyze user message + room state and return integration suggestions.
 * Returns at most 1 suggestion. Suppressed during active methodology.
 *
 * @param {string} userMessage — the user's current message
 * @param {object} roomState — current room state (activeMethodology truthy = suppress)
 * @returns {Array<{integration: string, reason: string, offer_text: string}>}
 */
function getContextTriggers(userMessage, roomState = {}) {
  // Never suggest during active methodology sessions
  if (roomState && roomState.activeMethodology) {
    return [];
  }

  if (!userMessage || typeof userMessage !== 'string') {
    return [];
  }

  const msgLower = userMessage.toLowerCase();
  const statuses = detectIntegrations();

  const candidates = [];

  for (const [name, catalog] of Object.entries(INTEGRATION_CATALOG)) {
    // Skip if already connected
    if (statuses[name] && statuses[name].status !== 'not-configured') {
      continue;
    }

    // Check trigger keywords
    const matched = catalog.triggers.some(trigger => msgLower.includes(trigger));
    if (matched) {
      candidates.push({
        integration: name,
        reason: catalog.benefit,
        offer_text: catalog.offer_text,
      });
    }
  }

  // Return at most 1 suggestion (first match = highest relevance by catalog order)
  return candidates.slice(0, 1);
}

module.exports = {
  INTEGRATION_CATALOG,
  detectIntegrations,
  checkIntegration,
  getContextTriggers,
};
