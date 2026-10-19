'use strict';
const { z } = require('zod');
const navigation = require('../../core/navigation.cjs');
const { resolveEffectiveSessionId } = require('../../core/session-binding.cjs');
const { resolveMcpWriteRoom } = require('../session-room.cjs');
const operations = require('../startup-operations.cjs');
const roomApp = require('../room-app.cjs');
function response(data) { return { structuredContent: data, content: [{ type: 'text', text: JSON.stringify(data) }], ...(data.ok === false ? { isError: true } : {}) }; }
function register(server, ctx) {
  roomApp.registerRoomApp(server);
  server.registerTool('room_create', {
    title: 'Prepare a new local room',
    description: 'Prepare the first-room name, purpose and local-folder preview. Returns an F.0 approval gate; no room folder is created until the navigator answers that gate with gate_answer. Approved creation uses the existing room birth operation. Reject/defer creates nothing. Use only for a user requesting a new room; open existing rooms through room_list and room_bind. The returned receipt distinguishes creation from effective binding.',
    inputSchema: z.object({ name: z.string().trim().min(1).max(100), purpose: z.string().trim().min(1).max(2000),
      slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/).optional() }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }, _meta: roomApp.TOOL_META,
  }, async (input, extra) => {
    try { return response(await operations.prepareRoomCreation(server, ctx, resolveEffectiveSessionId(undefined, extra), input)); }
    catch (_) { return response({ ok: false, reason: 'room_creation_preview_failed' }); }
  });
  server.registerTool('room_startup', {
    title: 'Start work in the bound room',
    description: 'After room_bind and context_assemble, build a returning navigator workday briefing from saved local room records: where work stopped, recorded changes, open questions and pending decisions. Records one local visit checkpoint per session; retries keep the original baseline. Missing prior history is explicit. Show the briefing before its returned F.1 next-move card; use gate_answer for the choice. No Theo call is made.',
    inputSchema: z.object({}), annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }, _meta: roomApp.TOOL_META,
  }, async (_input, extra) => {
    const sessionId = resolveEffectiveSessionId(undefined, extra);
    if (!sessionId) return response({ ok: false, reason: 'no_session_id' });
    const room = resolveMcpWriteRoom({ sessionId, ctx });
    if (!room.ok) return response(room.refusal);
    let db;
    try {
      db = navigation.openRoomDbForCaller(room.dir);
      if (!db) return response({ ok: false, reason: 'no_room_db' });
      const navigatorId = navigation.resolveByUser(room.dir);
      const briefing = navigation.withRoomTx(db, () => navigation.startRoomWorkday(db, room.dir, { roomId: room.slug, sessionId, navigatorId }));
      navigation.closeRoomDbForCaller(db); db = null;
      const next_move = await operations.nextMoveForWorkday(server, ctx, sessionId, room.dir, room.slug, briefing);
      return response({ ok: true, room: room.slug, room_dir: room.dir, briefing: { ...briefing, next_move } });
    } catch (_) { return response({ ok: false, reason: 'room_startup_failed' }); }
    finally { if (db) navigation.closeRoomDbForCaller(db); }
  });
}
const connectors = [
  { tool: 'room_create', surface: 'room_create', connector: 'mcp-tool', hitl_shape: 'F.0',
    hitl_why: 'The navigator approves, rejects or defers the local room preview before the existing birth operation writes anything.',
    layer: 'harness', layer_why: 'Adapts the shared gate ledger and room birth operation to the host startup flow.' },
  { tool: 'room_startup', surface: 'room_startup', connector: 'mcp-tool', hitl_shape: 'F.1',
    hitl_why: 'The navigator chooses the next move after reviewing saved room understanding and unfinished work.',
    layer: 'harness', layer_why: 'Composes existing memory readers, a durable visit checkpoint and a shared-ledger next-move card.' },
];
module.exports = { register, connectors };
