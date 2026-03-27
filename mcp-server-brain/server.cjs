'use strict';

const express = require('express');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { validateApiKey } = require('./lib/auth.cjs');
const { registerNeo4jTools } = require('./lib/neo4j-tools.cjs');
const { registerPineconeTools } = require('./lib/pinecone-tools.cjs');
const { registerBrainAsk } = require('./lib/brain-ask.cjs');

const app = express();
app.use(express.json());

// API key auth middleware on /mcp route
app.use('/mcp', validateApiKey);

// Inject grace period warning into MCP JSON-RPC responses
app.use('/mcp', (req, res, next) => {
  if (!res.locals.brainWarning) return next();

  const originalJson = res.json.bind(res);
  res.json = function injectGraceWarning(body) {
    if (body && typeof body === 'object') {
      body._brain_warning = res.locals.brainWarning;
    }
    return originalJson(body);
  };
  next();
});

// MCP endpoint — stateless: new server + transport per request
app.post('/mcp', async (req, res) => {
  const server = new McpServer({
    name: 'mindrian-brain',
    version: '1.0.0',
  });

  registerNeo4jTools(server, { plan: req.brainPlan });
  registerPineconeTools(server);
  registerBrainAsk(server);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  });

  await server.connect(transport);

  try {
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});

// Root — redirect to docs
app.get('/', (req, res) => {
  res.json({
    name: 'MindrianOS Brain',
    version: '1.0.0',
    docs: 'https://mindrianos-jsagirs-projects.vercel.app/brain-access',
    health: '/health',
    mcp: 'POST /mcp (requires API key)',
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', server: 'mindrian-brain', version: '1.0.0' });
});

// Start server (or export for testing)
const PORT = process.env.PORT || 3001;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Brain MCP server listening on port ${PORT}`);
  });
}

module.exports = app;
