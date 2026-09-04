/**
 * MindrianOS Plugin - MCP Session Profiles (CTX-03)
 * Defines 6 MCP session profiles that control which servers load per session.
 * Student exercises need zero MCP overhead; venturist pipelines need full power.
 * Pure Node.js built-ins only. No npm dependencies.
 */

'use strict';

const path = require('path');
const { safeReadFile } = require('./index.cjs');

/**
 * MCP_PROFILES: 6 session profiles controlling which MCP servers to load.
 *
 * Each profile has:
 *   - servers: array of server keys that should be active
 *   - description: human-readable purpose
 *   - maxTools: soft limit on exposed tools (for context budget)
 *
 * Server keys map to entries in .mcp.json:
 *   - brain: the origin resolved by lib/core/brain-client.cjs's
 *     getBrainUrl() (remote, Streamable HTTP). Phase 339, 2026-09-03: named
 *     the resolver here instead of a host so this comment cannot go stale
 *     across an origin change.
 *   - mindrian: MindrianOS local MCP server
 *   - research: web research tools
 *   - pinecone: vector search
 *   - context7: documentation lookup
 */
const MCP_PROFILES = {
  learn: {
    servers: [],
    description: 'Zero MCP overhead. Students learn concepts without tooling noise.',
    maxTools: 0,
    targetArchetype: 'student'
  },
  think: {
    servers: ['mindrian'],
    description: 'Local tools only. Diagnostic, diagnose, and methodology commands.',
    maxTools: 15,
    targetArchetype: 'default'
  },
  build: {
    servers: ['mindrian'],
    description: 'Room operations and pipeline execution. No external connections.',
    maxTools: 30,
    targetArchetype: 'default'
  },
  research: {
    servers: ['mindrian', 'brain', 'pinecone'],
    description: 'Brain + vector search for deep research and literature exploration.',
    maxTools: 40,
    targetArchetype: 'researcher'
  },
  present: {
    servers: ['mindrian', 'brain'],
    description: 'Dashboard, export, and presentation generation with Brain enrichment.',
    maxTools: 25,
    targetArchetype: 'venturist'
  },
  full: {
    servers: ['mindrian', 'brain', 'research', 'pinecone', 'context7'],
    description: 'All servers active. Full pipeline with external intelligence.',
    maxTools: 64,
    targetArchetype: 'venturist'
  }
};

/**
 * Intent detection keywords mapped to profiles.
 * Used when the session intent can be inferred from user input or room state.
 */
const INTENT_SIGNALS = {
  learn: ['learn', 'study', 'understand', 'explain', 'teach', 'what is', 'how does', 'tutorial', 'exercise'],
  think: ['diagnose', 'analyze', 'think through', 'brainstorm', 'ideate', 'consider'],
  build: ['create', 'file', 'write', 'generate', 'build', 'room', 'section', 'artifact'],
  research: ['research', 'find', 'search', 'literature', 'papers', 'grants', 'competitors', 'query brain'],
  present: ['present', 'export', 'dashboard', 'snapshot', 'deck', 'pitch', 'share'],
  full: ['pipeline', 'swarm', 'full analysis', 'deep dive', 'comprehensive']
};

/**
 * Archetype-to-default-profile mapping.
 * Used when no intent signal is detected.
 */
const ARCHETYPE_DEFAULTS = {
  student: 'learn',
  researcher: 'research',
  venturist: 'build',
  default: 'think'
};

/**
 * Get the recommended MCP session profile for a given archetype and intent.
 *
 * @param {string} archetype - User archetype (student/researcher/venturist/default)
 * @param {string|null} intent - Optional detected intent string
 * @returns {{ profile: string, servers: string[], description: string, maxTools: number }}
 */
function getProfile(archetype, intent) {
  // If explicit intent provided, try to match it
  if (intent) {
    const intentLower = intent.toLowerCase();
    for (const [profileName, keywords] of Object.entries(INTENT_SIGNALS)) {
      if (keywords.some(kw => intentLower.includes(kw))) {
        const profile = MCP_PROFILES[profileName];
        return {
          profile: profileName,
          servers: profile.servers,
          description: profile.description,
          maxTools: profile.maxTools
        };
      }
    }
  }

  // Fall back to archetype default
  const profileName = ARCHETYPE_DEFAULTS[archetype] || ARCHETYPE_DEFAULTS.default;
  const profile = MCP_PROFILES[profileName];
  return {
    profile: profileName,
    servers: profile.servers,
    description: profile.description,
    maxTools: profile.maxTools
  };
}

/**
 * Check which MCP servers are actually configured in .mcp.json.
 * Returns intersection of desired servers and available servers.
 *
 * @param {string} pluginRoot - Path to plugin root directory
 * @param {string[]} desiredServers - Server keys from profile
 * @returns {{ available: string[], missing: string[] }}
 */
function checkServerAvailability(pluginRoot, desiredServers) {
  const mcpJsonPath = path.join(pluginRoot, '.mcp.json');
  const raw = safeReadFile(mcpJsonPath);
  if (!raw) {
    return { available: [], missing: desiredServers };
  }

  try {
    const mcpConfig = JSON.parse(raw);
    const configuredKeys = Object.keys(mcpConfig.mcpServers || mcpConfig.servers || {});
    const available = desiredServers.filter(s => configuredKeys.includes(s));
    const missing = desiredServers.filter(s => !configuredKeys.includes(s));
    return { available, missing };
  } catch (_) {
    return { available: [], missing: desiredServers };
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const subcmd = args[0];

  if (subcmd === 'get' && args.length >= 2) {
    const archetype = args[1];
    const intent = args[2] || null;
    const result = getProfile(archetype, intent);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else if (subcmd === 'list') {
    for (const [name, profile] of Object.entries(MCP_PROFILES)) {
      process.stdout.write(`${name.padEnd(10)} | servers: [${profile.servers.join(', ')}] | ${profile.description}\n`);
    }
  } else if (subcmd === 'check' && args.length >= 3) {
    const pluginRoot = args[1];
    const profileName = args[2];
    const profile = MCP_PROFILES[profileName];
    if (!profile) {
      process.stderr.write(`Unknown profile: ${profileName}\n`);
      process.exit(1);
    }
    const result = checkServerAvailability(pluginRoot, profile.servers);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    process.stderr.write('Usage: node mcp-profiles.cjs <get|list|check> [args...]\n');
    process.exit(1);
  }
}

module.exports = { MCP_PROFILES, INTENT_SIGNALS, ARCHETYPE_DEFAULTS, getProfile, checkServerAvailability };
