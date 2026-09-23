'use strict';
// Fault injection at the real auto-registration seam. No files are changed.
const path = require('node:path');
const Module = require('node:module');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const repo = path.resolve(__dirname, '../../..');
const { registerCoreTools } = require(path.join(repo, 'lib/mcp/register-core-tools.cjs'));
const healthy = new McpServer({ name: 'healthy-fixture', version: '1' });
registerCoreTools(healthy, { fallbackRoomDir: '/tmp' });
const originalLoad = Module._load;
const originalWrite = process.stderr.write;
let diagnostic = '';
Module._load = function(request, ...args) {
  if (request === path.join(repo, 'lib/mcp/tools/graph.cjs')) throw new Error('SYNTHETIC_REGISTRATION_FAILURE');
  return originalLoad.call(this, request, ...args);
};
process.stderr.write = function(chunk) { diagnostic += String(chunk); return true; };
const degraded = new McpServer({ name: 'degraded-fixture', version: '1' });
try {
  const result = registerCoreTools(degraded, { fallbackRoomDir: '/tmp' });
  console.log(JSON.stringify({
    healthyToolCount: Object.keys(healthy._registeredTools).length,
    degradedToolCount: Object.keys(degraded._registeredTools).length,
    missingTools: Object.keys(healthy._registeredTools).filter(k => !degraded._registeredTools[k]),
    failureDiagnosticPresent: diagnostic.includes('SYNTHETIC_REGISTRATION_FAILURE'),
    returnedFailure: result !== undefined
  }));
} finally {
  Module._load = originalLoad;
  process.stderr.write = originalWrite;
}
