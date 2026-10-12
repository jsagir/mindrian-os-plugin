'use strict';
// Drives the real room_search handler with a stub server. Prints which room the handler resolved.
const C = require('./common.cjs');
const room = C.ROOMS[process.argv[2] || 'rethinking-mindrianos'];
const q = process.argv[3] || 'harness';
process.env.CLAUDE_ACTIVE_ROOM = room;
let handler = null;
C.roomMod.register({ registerTool: (n, _d, f) => { if (n === 'room_search') handler = f; } }, { fallbackRoomDir: room });
(async () => {
  const env = JSON.parse((await handler({ query: q }, { sessionId: 'cluster-a-probe-' + Date.now() })).content[0].text);
  console.log(JSON.stringify({ room_expected: room, room_dir: env.room_dir, tier: env.tier, n: env.results.length, keys: Object.keys(env), reason_code: env.reason_code || null }));
})();
