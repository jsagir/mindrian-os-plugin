'use strict';

/**
 * Shared SSE-shaped Brain capture server.
 *
 * Extracted from tests/test-brain-client-params.cjs (lines 57-125, the
 * `startMockServer` implementation and its `captured` array), per
 * .planning/phases/239-brain-access-surface/239-PATTERNS.md Correction 2:
 * this is an extraction of an already-shipped, already-proven capture
 * server, not a new invention. Phase 239 BRAIN-02's canary test
 * (tests/test-239-query-egress-canary.cjs) needs the exact same outbound
 * transport capture that tests/test-brain-client-params.cjs already stood
 * up inline; duplicating a second copy would violate Canon Part 7
 * (Reuse Before Build).
 *
 * ORDERING CONTRACT (load-bearing, do not skip): callers MUST set
 * process.env.MINDRIAN_BRAIN_URL and process.env.MINDRIAN_BRAIN_KEY to
 * point at this server's `url` BEFORE requiring lib/core/brain-client.cjs,
 * because BRAIN_URL is captured at module load time (brain-client.cjs
 * line 24); callers MUST also `delete require.cache[<resolved
 * lib/core/brain-client.cjs path>]` before that require, for isolation
 * from any earlier test that already loaded the module against a
 * different URL.
 *
 * Exports exactly: startCaptureServer, captured, resetCaptured,
 * stopCaptureServer.
 */

const http = require('node:http');

// Captured tools/call requests: { name, arguments } records, one per
// tools/call the server receives. Process-local, in-memory only, never
// persisted to disk (Trust Boundary: test fixture content to disk, per
// the 239-01 plan threat model T-239-01-A).
const captured = [];

/**
 * Start the loopback SSE-shaped capture server.
 * @returns {Promise<{server: http.Server, port: number, url: string}>}
 */
function startCaptureServer() {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      let parsed = null;
      try {
        parsed = JSON.parse(body);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'bad_json' }));
        return;
      }

      // brain-client.callTool does initialize first, then tools/call.
      if (parsed.method === 'initialize') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
        });
        res.end(
          'data: ' +
            JSON.stringify({
              jsonrpc: '2.0',
              id: parsed.id,
              result: { protocolVersion: '2024-11-05', capabilities: {} },
            }) +
            '\n'
        );
        return;
      }

      if (parsed.method === 'tools/call') {
        // Capture for assertions.
        captured.push({
          name: parsed.params && parsed.params.name,
          arguments: (parsed.params && parsed.params.arguments) || {},
        });
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.end(
          'data: ' +
            JSON.stringify({
              jsonrpc: '2.0',
              id: parsed.id,
              result: {
                content: [
                  { type: 'text', text: JSON.stringify({ ok: true }) },
                ],
              },
            }) +
            '\n'
        );
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unknown_method' }));
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, port, url: `http://127.0.0.1:${port}` });
    });
  });
}

/**
 * Truncate the shared `captured` array in place. Callers hold a
 * reference to the exported `captured` binding, so this must mutate,
 * never reassign.
 */
function resetCaptured() {
  captured.length = 0;
}

/**
 * Convenience wrapper so consumers can `await stopCaptureServer(server)`
 * instead of duplicating the close-callback dance at every call site.
 * @param {http.Server} server
 * @returns {Promise<void>}
 */
function stopCaptureServer(server) {
  return new Promise((resolve) => server.close(() => resolve()));
}

module.exports = {
  startCaptureServer,
  captured,
  resetCaptured,
  stopCaptureServer,
};
