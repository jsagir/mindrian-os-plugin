'use strict';

/**
 * Capability Registry for MindrianOS MCP Server
 *
 * Surface-aware feature registration. Conditionally enables
 * MCP Apps, Tasks, hooks, and scripts based on detected surface.
 *
 * MCP Apps registration (ext-apps) is Phase 60 -- this module
 * creates the hook point for future capability expansion.
 */

const { CAPABILITY_MAP } = require('./surface-detect.cjs');
const { registerAppViews } = require('./app-views.cjs');

/**
 * Get capability flags for a given surface.
 *
 * @param {'cli'|'desktop'|'cowork'} surface
 * @returns {{ hooks: boolean, apps: boolean, tasks: boolean, scripts: boolean }}
 */
function getCapabilities(surface) {
  return CAPABILITY_MAP[surface] || CAPABILITY_MAP.desktop;
}

/**
 * Conditionally register surface-specific features on the MCP server.
 *
 * Currently logs active capabilities. MCP Apps tool/resource registration
 * will be added in Phase 60 when capabilities.apps === true.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {{ hooks: boolean, apps: boolean, tasks: boolean, scripts: boolean }} capabilities
 * @param {string} roomDir
 * @param {string} pluginRoot
 */
function registerCapabilities(server, capabilities, roomDir, pluginRoot) {
  const active = Object.entries(capabilities)
    .filter(([, v]) => v)
    .map(([k]) => k);
  const inactive = Object.entries(capabilities)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  process.stderr.write(
    `[mindrian-os] Capabilities: active=[${active.join(', ')}] inactive=[${inactive.join(', ')}]\n`
  );

  // Phase 60: MCP Apps registration when capabilities.apps === true (Desktop/Cowork)
  if (capabilities.apps) {
    try {
      registerAppViews(server, roomDir);
    } catch (err) {
      process.stderr.write(`[mindrian-os] MCP Apps registration failed (non-fatal): ${err.message}\n`);
    }
  }

  // Phase 58: MCP Tasks registration when capabilities.tasks === true
  // if (capabilities.tasks) { registerTasksTools(server, roomDir, pluginRoot); }
}

module.exports = { getCapabilities, registerCapabilities };
