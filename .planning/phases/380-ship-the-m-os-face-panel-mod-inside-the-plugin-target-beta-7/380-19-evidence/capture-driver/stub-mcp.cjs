// Plan 380-10 stub: a local MCP server with one tool, brain_ask, that answers with a fixed sentence.
// It makes no network call. It exists so the panel's delivery line can be captured without a model call
// and without Theo. Every answer says it is a stub.
'use strict';
const readline = require('node:readline');
const rl = readline.createInterface({ input: process.stdin });
const send = (o) => process.stdout.write(JSON.stringify(o) + '\n');
rl.on('line', (line) => {
  let m; try { m = JSON.parse(line); } catch (e) { return; }
  if (m.method === 'initialize') {
    send({ jsonrpc: '2.0', id: m.id, result: { protocolVersion: (m.params && m.params.protocolVersion) || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'stub-brain', version: '0.0.1' } } });
  } else if (m.method === 'tools/list') {
    send({ jsonrpc: '2.0', id: m.id, result: { tools: [{ name: 'brain_ask', description: 'stub for the screenshot plan', inputSchema: { type: 'object', properties: { question: { type: 'string' } }, additionalProperties: true } }] } });
  } else if (m.method === 'tools/call') {
    send({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: 'STUB ANSWER for the screenshot plan. No framework is named here.' }] } });
  } else if (m.id !== undefined) {
    send({ jsonrpc: '2.0', id: m.id, result: {} });
  }
});
