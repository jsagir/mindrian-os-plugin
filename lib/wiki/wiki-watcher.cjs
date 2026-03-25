'use strict';
/**
 * wiki-watcher.cjs — File watcher + SSE broadcast for wiki auto-refresh
 *
 * Watches room/ directory via chokidar. On file changes,
 * calls the onChange callback and broadcasts SSE events
 * to all connected browser clients.
 */

const chokidar = require('chokidar');
const path = require('path');

const sseClients = new Set();

/**
 * Start watching a room directory for changes.
 * @param {string} roomDir - Path to room/ directory
 * @param {function} onChangeCallback - Called with { event, path } on changes
 * @returns {object} chokidar watcher instance
 */
function startWatcher(roomDir, onChangeCallback) {
  const absRoom = path.resolve(roomDir);

  const watcher = chokidar.watch(absRoom, {
    ignoreInitial: true,
    ignored: [
      /\.lazygraph/,
      /\.reasoning/,
      /node_modules/,
      /\.git/
    ],
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100
    }
  });

  watcher.on('all', (event, filePath) => {
    // Only care about .md file changes
    if (!filePath.endsWith('.md')) return;

    const relPath = path.relative(absRoom, filePath);

    // Call the application callback (rebuild index, etc.)
    if (typeof onChangeCallback === 'function') {
      onChangeCallback({ event, path: relPath });
    }

    // Broadcast SSE event to all connected clients
    broadcast({ event: 'change', path: relPath, type: event });
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
      // Client disconnected — remove
      sseClients.delete(client);
    }
  }
}

module.exports = { startWatcher, addSSEClient, removeSSEClient };
