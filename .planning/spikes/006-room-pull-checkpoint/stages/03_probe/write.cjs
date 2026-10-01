// Spike 006: write one claim into the running demo room THROUGH the MCP server
// (claim_write), so the open page shows it without a reload.
// Usage: node stages/03_probe/write.cjs "claim text"
'use strict';
const path = require('path');
const fs = require('fs');
const L = require('./launch.cjs');
(async () => {
  const info = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'output/stack.json'), 'utf8'));
  const { c } = await L.mcpConnect(info.mcpUrl, 'demo-write');
  await c.callTool({ name: 'room_bind', arguments: { room: L.SLUG } });
  const r = L.toolJson(await c.callTool({ name: 'claim_write', arguments: { knowledge_type: 'assumption', text: process.argv[2] || ('Navigator claim ' + new Date().toLocaleTimeString()) } }));
  console.log(r.ok ? 'written ' + r.node_id : 'failed ' + JSON.stringify(r).slice(0, 300));
  await c.close();
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
