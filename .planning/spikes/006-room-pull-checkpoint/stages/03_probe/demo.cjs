// Spike 006: keep the throwaway stack up for the navigator (and for spike 007).
// Starts a temp room copy, the MCP server (per-connection mode) and the pull
// server in journal mode, writes output/stack.json, prints the page URL.
// Ctrl-C stops both servers (SIGKILL, own temp dir only) and checks the real room.
// Usage: node stages/03_probe/demo.cjs [--tick]   (--tick: one claim every 5 s)
'use strict';
const path = require('path');
const fs = require('fs');
const L = require('./launch.cjs');
(async () => {
  process.env.PULL_MODE = process.env.PULL_MODE || 'journal';
  const stack = await L.startStack({ pullPort: 3871, prefix: 'spike006demo-' });
  const info = { home: stack.home, roomDir: stack.roomDir, mcpUrl: stack.mcpUrl, pullUrl: stack.pullUrl, mode: process.env.PULL_MODE, before: stack.before, started: new Date().toISOString(), pid: process.pid };
  fs.writeFileSync(path.resolve(__dirname, 'output/stack.json'), JSON.stringify(info, null, 1));
  console.log('\nRoom copy:   ' + stack.roomDir + '\nMCP server:  ' + stack.mcpUrl + '\nOpen this:   ' + stack.pullUrl + '/\n\nWrite a claim from another terminal:\n  node .planning/spikes/006-room-pull-checkpoint/stages/03_probe/write.cjs "Your claim text"\nCtrl-C stops everything.\n');
  let tick = null;
  if (process.argv.includes('--tick')) {
    const { c } = await L.mcpConnect(stack.mcpUrl, 'demo-tick');
    await c.callTool({ name: 'room_bind', arguments: { room: L.SLUG } });
    let i = 0;
    tick = setInterval(() => { c.callTool({ name: 'claim_write', arguments: { knowledge_type: 'assumption', text: 'Demo tick claim ' + (++i) } }).catch(() => {}); }, 5000);
  }
  const stop = async () => {
    if (tick) clearInterval(tick);
    const r = await stack.stop();
    console.log('\nstopped: pull ' + r.pull + ', mcp ' + r.mcp + ', real room untouched (4 stamps): ' + r.real_room_untouched);
    try { fs.unlinkSync(path.resolve(__dirname, 'output/stack.json')); } catch (_) {}
    process.exit(0);
  };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
})().catch((e) => { console.error(e.message); process.exit(1); });
