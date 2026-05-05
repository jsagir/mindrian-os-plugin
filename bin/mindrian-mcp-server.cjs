#!/usr/bin/env node

/**
 * MindrianOS MCP Server -- dual transport entry point (stdio + Streamable HTTP)
 *
 * Connects MindrianOS plugin capabilities to Claude Desktop and Cowork
 * via the Model Context Protocol. Uses hierarchical tool router (9 tools
 * covering 64 CLI commands) to stay under 7000 token budget.
 *
 * Transport selection is automatic via surface detection:
 *   - CLI / Desktop: stdio (default, zero-config)
 *   - Cowork: Streamable HTTP on 127.0.0.1:3847
 *
 * Override with MINDRIAN_TRANSPORT=stdio|http env var.
 *
 * Configuration:
 *   MINDRIAN_ROOM env var sets the Data Room path (default: ./room)
 *
 * Usage in claude_desktop_config.json (stdio):
 *   {
 *     "mcpServers": {
 *       "mindrian-os": {
 *         "command": "node",
 *         "args": ["/path/to/MindrianOS-Plugin/bin/mindrian-mcp-server.cjs"],
 *         "env": { "MINDRIAN_ROOM": "/path/to/project/room" }
 *       }
 *     }
 *   }
 *
 * Usage for Cowork (Streamable HTTP):
 *   MINDRIAN_TRANSPORT=http node bin/mindrian-mcp-server.cjs
 *   -> Listens on http://127.0.0.1:3847/mcp
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { detectSurface } = require('../lib/mcp/surface-detect.cjs');
const { registerCapabilities } = require('../lib/mcp/capability-registry.cjs');
const { computeCatchUp, registerShutdownHandler } = require('../lib/mcp/session-catchup.cjs');

// Detect surface before anything else
const surface = detectSurface();

// Resolve paths
const pluginRoot = path.resolve(__dirname, '..');
const roomDir = path.resolve(process.env.MINDRIAN_ROOM || './room');

// Read version from plugin.json
const pluginMeta = require('../.claude-plugin/plugin.json');
const version = pluginMeta.version;

// Load Larry personality context
const { loadLarryContext } = require('../lib/mcp/larry-context.cjs');
const larryContext = loadLarryContext(pluginRoot);

// Validate room directory exists (warn, do not crash -- Desktop may start before room creation)
if (!fs.existsSync(roomDir)) {
  process.stderr.write(`[mindrian-os] Warning: Room directory not found at ${roomDir}. Some tools will return limited results.\n`);
}

// Create MCP server
const server = new McpServer({
  name: 'mindrian-os',
  version,
});

// Register hierarchical tool router (9 tools covering 64 CLI commands)
const { registerRouterTools } = require('../lib/mcp/tool-router.cjs');
registerRouterTools(server, roomDir, pluginRoot, larryContext);

// -----------------------------------------------------------------------------
// Phase 115-02: dual-path opener tools (Pitfall 6 tri-polar surface coverage)
// -----------------------------------------------------------------------------
// detect_dual_path  classify turn-1 input as upload | type | ambiguous
// extract_shallow   parse a CV/memo/pitch paste into 1 user + 1 venture + 1-3
//                   claims and route filing through Phase 109 navigation.cjs
// Both wrap pure lib/core entries; safe for Desktop/Cowork stdio transport.
// -----------------------------------------------------------------------------
const { z } = require('zod');
const dualPathDetector = require('../lib/core/dual-path-detector.cjs');
const shallowDocParser = require('../lib/core/shallow-doc-parser.cjs');

server.tool(
  'detect_dual_path',
  'Phase 115 dual-path detector. 5-feature additive score classifier (RESEARCH DISCRETION-03). Classifies turn-1 input as upload | type | ambiguous; returns { path, score, features } with booleans-only features payload (Canon Part 8 telemetry-safe). Pure classification, no side effects.',
  {
    text: z.string().describe('The user first-turn input (CV paste, conversational answer, or any string).'),
  },
  async ({ text }) => {
    const result = dualPathDetector.classify(text);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
);

server.tool(
  'extract_shallow',
  'Phase 115 strategy (b) shallow-file. Parses a CV / memo / pitch paste classified as upload-path into 1 user + 1 venture + 1-3 claim nodes. Routes graph writes through lib/core/navigation.cjs setFocus + memory_event (Phase 109 chokepoint). Falls back to 0 nodes on parse failure (graceful).',
  {
    text: z.string().describe('CV / memo / pitch paste classified as upload-path by detect_dual_path.'),
    sessionId: z.string().describe('Session id for navigation.setFocus + memory_event scoping.'),
  },
  async ({ text, sessionId }) => {
    const result = shallowDocParser.extractShallow(text, sessionId);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
);

// Register MCP Resources (read-only room browsing via room:// URIs)
const { registerResources } = require('../lib/mcp/resources.cjs');
registerResources(server, roomDir);

// Register MCP Prompts (methodology workflows with Larry personality)
const { registerPrompts } = require('../lib/mcp/prompts.cjs');
registerPrompts(server, roomDir, pluginRoot);

// Register surface-aware capabilities (MCP Apps, Tasks -- Phase 58/60 hook points)
registerCapabilities(server, surface.capabilities, roomDir, pluginRoot);

// Session catch-up: register shutdown handler to save session state (all surfaces)
if (fs.existsSync(roomDir)) {
  registerShutdownHandler(roomDir);
}

// Connect transport based on detected surface
async function main() {
  if (surface.transport === 'http') {
    // Streamable HTTP for Cowork
    let express;
    try {
      express = require('express');
    } catch (err) {
      process.stderr.write(`[mindrian-os] Express not available, falling back to stdio transport.\n`);
      const transport = new StdioServerTransport();
      await server.connect(transport);
      process.stderr.write(`[mindrian-os] MCP server v${version} started (${surface.surface}, stdio-fallback, room: ${roomDir})\n`);
      return;
    }

    const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
    const app = express();
    app.use(express.json());

    // MCP endpoint
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    app.all('/mcp', async (req, res) => {
      await transport.handleRequest(req, res);
    });

    await server.connect(transport);
    app.listen(3847, '127.0.0.1', () => {
      process.stderr.write(`[mindrian-os] MCP server v${version} started (${surface.surface}, HTTP on 127.0.0.1:3847, room: ${roomDir})\n`);

      // Session catch-up for Cowork: compute what was missed since last session
      if (fs.existsSync(roomDir)) {
        try {
          const catchUp = computeCatchUp(roomDir);
          if (catchUp.hasCatchUp) {
            process.stderr.write(`[mindrian-os] Session catch-up: ${catchUp.summary}\n`);
          } else {
            process.stderr.write(`[mindrian-os] Session catch-up: first session or no changes detected.\n`);
          }
        } catch (e) {
          process.stderr.write(`[mindrian-os] Session catch-up failed (non-fatal): ${e.message}\n`);
        }
      }
    });
  } else {
    // stdio for CLI and Desktop
    const transport = new StdioServerTransport();
    await server.connect(transport);
    process.stderr.write(`[mindrian-os] MCP server v${version} started (${surface.surface}, ${surface.transport}, room: ${roomDir})\n`);
  }
}

main().catch((err) => {
  process.stderr.write(`[mindrian-os] Fatal: ${err.message}\n`);
  process.exit(1);
});
