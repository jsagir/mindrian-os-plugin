'use strict';

/**
 * Surface Detection for MindrianOS MCP Server
 *
 * Auto-detects CLI/Desktop/Cowork at server startup.
 * Called once before McpServer creation to determine transport
 * and capability set.
 *
 * Detection order (highest priority first):
 *   1. MINDRIAN_TRANSPORT env (explicit override)
 *   2. CLAUDE_SURFACE env (Anthropic-set)
 *   3. COWORK_SESSION_ID env or /sessions dir (Cowork VM)
 *   4. Non-TTY stdin with minimal argv (Desktop child process)
 *   5. TTY stdin (interactive CLI)
 *   6. Default: stdio (Desktop safe default)
 */

const fs = require('fs');

/** @type {Record<string, { hooks: boolean, apps: boolean, tasks: boolean, scripts: boolean }>} */
const CAPABILITY_MAP = {
  cli:     { hooks: true,  apps: false, tasks: false, scripts: true  },
  desktop: { hooks: false, apps: true,  tasks: false, scripts: false },
  cowork:  { hooks: false, apps: true,  tasks: true,  scripts: false },
};

/**
 * Detect the current surface (CLI, Desktop, Cowork) and return
 * transport type plus capability flags.
 *
 * @returns {{ surface: 'cli'|'desktop'|'cowork', transport: 'stdio'|'http', capabilities: { hooks: boolean, apps: boolean, tasks: boolean, scripts: boolean } }}
 */
function detectSurface() {
  // 1. Explicit override via env
  const explicitTransport = process.env.MINDRIAN_TRANSPORT;
  if (explicitTransport === 'http') {
    return { surface: 'cowork', transport: 'http', capabilities: CAPABILITY_MAP.cowork };
  }
  if (explicitTransport === 'stdio') {
    return { surface: 'desktop', transport: 'stdio', capabilities: CAPABILITY_MAP.desktop };
  }

  // 2. Anthropic-set surface env
  const claudeSurface = process.env.CLAUDE_SURFACE;
  if (claudeSurface === 'cowork') {
    return { surface: 'cowork', transport: 'http', capabilities: CAPABILITY_MAP.cowork };
  }
  if (claudeSurface === 'desktop') {
    return { surface: 'desktop', transport: 'stdio', capabilities: CAPABILITY_MAP.desktop };
  }
  if (claudeSurface === 'cli') {
    return { surface: 'cli', transport: 'stdio', capabilities: CAPABILITY_MAP.cli };
  }

  // 3. Cowork VM indicators
  if (process.env.COWORK_SESSION_ID || (fs.existsSync('/sessions'))) {
    return { surface: 'cowork', transport: 'http', capabilities: CAPABILITY_MAP.cowork };
  }

  // 4. Non-TTY stdin with minimal argv = Desktop spawned child process
  if (!process.stdin.isTTY && process.argv.length <= 2) {
    return { surface: 'desktop', transport: 'stdio', capabilities: CAPABILITY_MAP.desktop };
  }

  // 5. Interactive TTY = CLI
  if (process.stdin.isTTY) {
    return { surface: 'cli', transport: 'stdio', capabilities: CAPABILITY_MAP.cli };
  }

  // 6. Default: Desktop (stdio is the safe default)
  return { surface: 'desktop', transport: 'stdio', capabilities: CAPABILITY_MAP.desktop };
}

module.exports = { detectSurface, CAPABILITY_MAP };
