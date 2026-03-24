'use strict';

/**
 * Local smoke test for Brain MCP server.
 * Tests auth, health, MCP initialize, and tools/list.
 * No external services needed — uses dummy env vars.
 */

const http = require('http');

const PORT = 3099;
let serverInstance = null;
let passed = 0;
let failed = 0;

// Set dummy env vars so modules load without real credentials
process.env.BRAIN_API_KEYS = 'test-key-123';
process.env.NEO4J_URI = 'bolt://localhost:7687';
process.env.NEO4J_USER = 'neo4j';
process.env.NEO4J_PASSWORD = 'fake';
process.env.PINECONE_API_KEY = 'fake';
process.env.PORT = String(PORT);

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: PORT, ...options }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        // Parse response — may be plain JSON or SSE (event: message\ndata: {...})
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          // Try extracting JSON from SSE data line
          const dataMatch = data.match(/^data:\s*(.+)$/m);
          if (dataMatch) {
            try {
              parsed = JSON.parse(dataMatch[1]);
            } catch {
              parsed = data;
            }
          } else {
            parsed = data;
          }
        }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function assert(name, condition, detail) {
  if (condition) {
    console.log(`  PASS: ${name}`);
    passed++;
  } else {
    console.log(`  FAIL: ${name} — ${detail || ''}`);
    failed++;
  }
}

async function runTests() {
  console.log('Starting Brain MCP smoke tests...\n');

  // Start server
  const app = require('./server.cjs');
  serverInstance = app.listen(PORT, '127.0.0.1');
  await new Promise(r => setTimeout(r, 500)); // wait for listen

  // Test 1: GET /health returns 200 + { status: 'ok' }
  console.log('Test 1: Health check');
  const health = await request({ path: '/health', method: 'GET' });
  assert('status 200', health.status === 200, `got ${health.status}`);
  assert('status ok', health.body.status === 'ok', `got ${JSON.stringify(health.body)}`);

  // Test 2: POST /mcp with NO auth header returns 401
  console.log('\nTest 2: Missing auth → 401');
  const noAuth = await request(
    { path: '/mcp', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { jsonrpc: '2.0', method: 'initialize', id: 1 }
  );
  assert('status 401', noAuth.status === 401, `got ${noAuth.status}`);
  assert('error message', noAuth.body.error && noAuth.body.error.includes('Missing'), `got ${JSON.stringify(noAuth.body)}`);

  // Test 3: POST /mcp with invalid Bearer key returns 401
  console.log('\nTest 3: Invalid key → 401');
  const badKey = await request(
    { path: '/mcp', method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer wrong-key' } },
    { jsonrpc: '2.0', method: 'initialize', id: 2 }
  );
  assert('status 401', badKey.status === 401, `got ${badKey.status}`);
  assert('error message', badKey.body.error && badKey.body.error.includes('Invalid'), `got ${JSON.stringify(badKey.body)}`);

  // Test 4: POST /mcp with valid key + MCP initialize
  console.log('\nTest 4: MCP initialize with valid key');
  const init = await request(
    { path: '/mcp', method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream', 'Authorization': 'Bearer test-key-123' } },
    {
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' },
      },
      id: 1,
    }
  );
  assert('status 200', init.status === 200, `got ${init.status}`);
  assert('has result', init.body && init.body.result !== undefined, `got ${JSON.stringify(init.body)}`);
  assert('server name', init.body.result && init.body.result.serverInfo && init.body.result.serverInfo.name === 'mindrian-brain',
    `got ${JSON.stringify(init.body.result && init.body.result.serverInfo)}`);

  // Test 5: POST /mcp with valid key + tools/list
  console.log('\nTest 5: tools/list returns 5 tools');
  const toolsList = await request(
    { path: '/mcp', method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream', 'Authorization': 'Bearer test-key-123' } },
    {
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {},
      id: 2,
    }
  );
  assert('status 200', toolsList.status === 200, `got ${toolsList.status}`);
  const tools = toolsList.body && toolsList.body.result && toolsList.body.result.tools;
  assert('has tools array', Array.isArray(tools), `got ${JSON.stringify(toolsList.body)}`);
  const toolNames = (tools || []).map(t => t.name).sort();
  const expected = ['brain_query', 'brain_schema', 'brain_search', 'brain_stats', 'brain_write'];
  assert('5 tools registered', toolNames.length === 5, `got ${toolNames.length}: ${toolNames.join(', ')}`);
  assert('correct tool names', JSON.stringify(toolNames) === JSON.stringify(expected),
    `expected ${expected.join(', ')}, got ${toolNames.join(', ')}`);

  // Summary
  console.log(`\n${'='.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(40)}`);

  serverInstance.close();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Test runner error:', err);
  if (serverInstance) serverInstance.close();
  process.exit(1);
});
