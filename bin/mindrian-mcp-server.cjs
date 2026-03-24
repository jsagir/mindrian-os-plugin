#!/usr/bin/env node

/**
 * MindrianOS MCP Server — stdio transport entry point
 *
 * Connects MindrianOS plugin capabilities to Claude Desktop and Cowork
 * via the Model Context Protocol. Uses hierarchical tool router (6 tools)
 * instead of flat 41-tool registration to stay under 5000 token budget.
 *
 * Configuration:
 *   MINDRIAN_ROOM env var sets the Data Room path (default: ./room)
 *
 * Usage in claude_desktop_config.json:
 *   {
 *     "mcpServers": {
 *       "mindrian-os": {
 *         "command": "node",
 *         "args": ["/path/to/MindrianOS-Plugin/bin/mindrian-mcp-server.cjs"],
 *         "env": { "MINDRIAN_ROOM": "/path/to/project/room" }
 *       }
 *     }
 *   }
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

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

// Register hierarchical tool router (6 tools covering 41 CLI commands)
const { registerRouterTools } = require('../lib/mcp/tool-router.cjs');
registerRouterTools(server, roomDir, pluginRoot, larryContext);

// Register MCP Resources (read-only room browsing via room:// URIs)
const { registerResources } = require('../lib/mcp/resources.cjs');
registerResources(server, roomDir);

// Register MCP Prompts (methodology workflows with Larry personality)
const { registerPrompts } = require('../lib/mcp/prompts.cjs');
registerPrompts(server, roomDir, pluginRoot);

// Connect stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`[mindrian-os] MCP server v${version} started (room: ${roomDir})\n`);
}

main().catch((err) => {
  process.stderr.write(`[mindrian-os] Fatal: ${err.message}\n`);
  process.exit(1);
});
