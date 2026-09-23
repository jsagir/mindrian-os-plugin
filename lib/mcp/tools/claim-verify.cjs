'use strict';

// B1 MCP surface: append one local verification record to an existing claim.
const { z } = require('zod');
const navigation = require('../../core/navigation.cjs');
const { resolveEffectiveSessionId } = require('../../core/session-binding.cjs');
const { isWritePathEnabled } = require('../mcp-first-flag.cjs');
const { resolveSessionRoomDir } = require('../session-room.cjs');

function response(payload, error) {
  const out = { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
  if (error) out.isError = true;
  return out;
}

function register(server, ctx) {
  server.tool('claim_verify', 'Record what a local claim was checked against. This records verification metadata and never confirms the claim.', {
    claim_id: z.string().min(1).max(512),
    against_id: z.string().min(1).max(512),
    against_kind: z.enum(Array.from(navigation.VERIFICATION_AGAINST_KINDS || ['artifact', 'source', 'observation', 'person', 'experiment'])),
    method: z.enum(Array.from(navigation.VERIFICATION_METHODS || ['read', 'compare', 'observe', 'test', 'ask'])),
    result: z.enum(Array.from(navigation.VERIFICATION_RESULTS || ['supports', 'contradicts', 'inconclusive'])),
    checked_by: z.enum(['user', 'system']).optional(),
    checked_at: z.string().max(64).optional(),
    note_handle: z.string().max(512).optional(),
  }, async (args, extra) => {
    const clientVersion = server && server.server && typeof server.server.getClientVersion === 'function'
      ? server.server.getClientVersion() : undefined;
    if (!isWritePathEnabled({ surface: ctx && ctx.surface, clientVersion })) {
      return response({ ok: false, reason: 'write_path_disabled' }, true);
    }
    const sessionId = resolveEffectiveSessionId(undefined, extra);
    const roomDir = resolveSessionRoomDir(sessionId, ctx);
    const db = navigation.openRoomDbForCaller(roomDir);
    if (!db) return response({ ok: false, reason: 'no_room_db', room_dir: roomDir }, true);
    try {
      const result = navigation.recordClaimVerification(db, args);
      return response(Object.assign({ room_dir: roomDir }, result), result.ok === false);
    } finally {
      navigation.closeRoomDbForCaller(db);
    }
  });
}

const connectors = [{
  tool: 'claim_verify', surface: 'claim_verify', connector: 'mcp-tool', hitl_shape: 'F.1',
  hitl_why: 'Records local verification metadata on a claim; it never promotes truth state.',
  layer: 'harness', layer_why: 'Local graph bookkeeping write through the navigation chokepoint.',
}];

module.exports = { register, connectors };
