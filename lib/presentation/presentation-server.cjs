'use strict';
/**
 * presentation-server.cjs -- Express static server for presentation live reload
 *
 * Serves the exports/presentation/ directory as static files with SSE
 * auto-reload injection. HTML responses get a small SSE client script
 * injected before </body> so browsers auto-reload on room file changes.
 *
 * SSE injection is SERVER-SIDE ONLY -- deployed/static HTML files
 * have zero SSE code baked in.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { startWatcher, addSSEClient } = require('./presentation-watcher.cjs');

// Minimal SSE client script injected into HTML responses
const SSE_SCRIPT = `<script>(function(){var es=new EventSource('/__sse');es.onmessage=function(){location.reload()};es.onerror=function(){setTimeout(function(){location.reload()},3000)}})()</script>`;

/**
 * Start the presentation Express server.
 * @param {string} roomDir - Path to room/ directory
 * @param {number} [port=8422] - Port to listen on
 * @returns {Promise<{app, server, port, watcher}>}
 */
function startPresentationServer(roomDir, port) {
  port = port || 8422;
  const absRoom = path.resolve(roomDir);
  const outputDir = path.join(absRoom, 'exports', 'presentation');
  const pluginRoot = path.join(__dirname, '..', '..');

  // Verify output directory exists
  if (!fs.existsSync(outputDir)) {
    console.error(`ERROR: ${outputDir} does not exist.`);
    console.error('Run generate-presentation.cjs first to create the presentation views.');
    process.exit(1);
  }

  const app = express();

  // -- SSE endpoint: connected browsers listen here for reload events --
  app.get('/__sse', (req, res) => {
    addSSEClient(res);
  });

  // -- HTML interception: inject SSE script before </body> --
  // This middleware runs BEFORE express.static so we can intercept HTML
  app.use((req, res, next) => {
    // Only intercept .html requests or directory index
    const reqPath = req.path;
    const htmlPath = reqPath.endsWith('.html')
      ? path.join(outputDir, reqPath)
      : reqPath === '/' || reqPath.endsWith('/')
        ? path.join(outputDir, reqPath, 'index.html')
        : null;

    if (!htmlPath || !fs.existsSync(htmlPath)) {
      return next(); // Let express.static handle non-HTML or missing files
    }

    try {
      let html = fs.readFileSync(htmlPath, 'utf8');

      // Inject SSE script before closing </body> tag
      if (html.includes('</body>')) {
        html = html.replace('</body>', SSE_SCRIPT + '</body>');
      } else {
        // No </body> tag -- append to end
        html += SSE_SCRIPT;
      }

      res.type('html').send(html);
    } catch (err) {
      next(); // Fall through to static on read error
    }
  });

  // -- Static file serving for non-HTML assets (CSS, JS, images, JSON) --
  app.use(express.static(outputDir));

  // -- Start chokidar watcher on the ROOM directory --
  const watcher = startWatcher(absRoom, outputDir, pluginRoot);

  // -- Start server --
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`Presentation running at http://localhost:${port}`);
      resolve({ app, server, port, watcher });
    });
  });
}

// -- CLI entry mode --
if (require.main === module) {
  const roomDir = process.argv[2] || './room';
  const port = parseInt(process.argv[3] || '8422', 10);
  startPresentationServer(roomDir, port);
}

module.exports = { startPresentationServer };
