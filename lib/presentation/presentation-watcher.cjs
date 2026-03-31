'use strict';
/**
 * presentation-watcher.cjs -- File watcher + SSE broadcast for presentation auto-refresh
 *
 * Watches room/ directory via chokidar. On file changes, triggers
 * presentation regeneration and broadcasts SSE events to all
 * connected browser clients.
 */

const chokidar = require('chokidar');
const path = require('path');
const { execSync } = require('child_process');

const sseClients = new Set();

// Debounce timer for regeneration
let regenTimer = null;
const REGEN_DEBOUNCE_MS = 1000;

/**
 * Start watching a room directory for changes.
 * On change: regenerate presentation views, then broadcast SSE reload.
 *
 * @param {string} roomDir - Path to room/ directory
 * @param {string} outputDir - Path to exports/presentation/ directory
 * @param {string} pluginRoot - Path to plugin root (for generate-presentation.cjs)
 * @returns {object} chokidar watcher instance
 */
function startWatcher(roomDir, outputDir, pluginRoot) {
  const absRoom = path.resolve(roomDir);
  const absOutput = path.resolve(outputDir);
  const generatorPath = path.join(pluginRoot, 'scripts', 'generate-presentation.cjs');

  const watcher = chokidar.watch(absRoom, {
    ignoreInitial: true,
    ignored: [
      /\.lazygraph/,
      /\.reasoning/,
      /node_modules/,
      /\.git/,
      /exports\/presentation/  // Don't watch our own output
    ],
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100
    }
  });

  watcher.on('all', (event, filePath) => {
    const relPath = path.relative(absRoom, filePath);
    console.log(`[presentation] ${event}: ${relPath}`);

    // Debounce regeneration to avoid hammering during rapid multi-file writes
    if (regenTimer) clearTimeout(regenTimer);
    regenTimer = setTimeout(() => {
      try {
        execSync(
          `node "${generatorPath}" "${absRoom}" --output "${absOutput}"`,
          { timeout: 15000, stdio: 'pipe' }
        );
        console.log('[presentation] Regenerated views');
      } catch (err) {
        console.error('[presentation] Regeneration failed:', err.message);
      }

      // Broadcast SSE reload event to all connected browsers
      broadcast({ event: 'change', path: relPath, type: event });
    }, REGEN_DEBOUNCE_MS);
  });

  return watcher;
}

/**
 * Add an SSE client (Express response object).
 * Sets appropriate headers and sends initial keepalive.
 * @param {object} res - Express response object
 */
function addSSEClient(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // Initial keepalive comment
  res.write(':keepalive\n\n');

  sseClients.add(res);

  // Clean up on disconnect
  res.on('close', () => {
    removeSSEClient(res);
  });
}

/**
 * Remove an SSE client from the set.
 * @param {object} res - Express response object
 */
function removeSSEClient(res) {
  sseClients.delete(res);
}

/**
 * Broadcast an SSE event to all connected clients.
 * @param {object} data - Event data to serialize as JSON
 */
function broadcast(data) {
  const message = `data: ${JSON.stringify(data)}\n\n`;

  for (const client of sseClients) {
    try {
      client.write(message);
    } catch (e) {
      // Client disconnected -- remove
      sseClients.delete(client);
    }
  }
}

module.exports = { startWatcher, addSSEClient, removeSSEClient };
