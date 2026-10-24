'use strict';

// Read a prior Reverse Salient thesis from the already-bound room. This is a
// MindrianOS host service, not an Eureka route. RSDiscovery is local user data:
// use the shared session resolver and navigation's read-only room.db door, and
// never call the remote Brain or mutate the room.

const { z } = require('zod');
const navigation = require('../../core/navigation.cjs');
const { resolveEffectiveSessionId } = require('../../core/session-binding.cjs');
const { resolveMcpSessionRoom, describeRoomBinding } = require('../session-room.cjs');
const { auditQueryString } = require('../../core/rs-egress-prompts.cjs');

const DESCRIPTION = 'Read the thesis and metadata for one prior Reverse Salient discovery in this session’s bound MindrianOS room. Local-only and read-only: it never contacts Brain or writes the room. Requires a bound room or an operator-pinned room; it does not use the registry or server fallback.';
const OUTPUT_SCHEMA = z.object({
  ok: z.boolean(),
  reason: z.string().optional(),
  message: z.string().optional(),
  host_service: z.literal('rs_thesis_read').optional(),
  readiness: z.literal('host_native').optional(),
  tier: z.literal('tier0').optional(),
  local_only: z.boolean().optional(),
  discovery_id: z.string().optional(),
  thesis: z.string().nullable().optional(),
  meta: z.object({
    rs_type: z.string().nullable().optional(),
    breakthrough_score: z.union([z.number(), z.null()]).optional(),
    room_slug: z.string().nullable().optional(),
    created_at: z.union([z.string(), z.null()]).optional(),
  }).optional(),
  room_binding: z.record(z.string(), z.unknown()).optional(),
  persistence: z.literal('none').optional(),
}).passthrough();

function response(payload, isError) {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
    ...(isError ? { isError: true } : {}),
  };
}

function readThesis(args, ctx, extra) {
  const sessionId = resolveEffectiveSessionId(undefined, extra);
  const resolution = resolveMcpSessionRoom({ sessionId, ctx, noFloor: true });
  const binding = describeRoomBinding(resolution);
  if (!resolution.dir || (!binding.bound && binding.operator_pinned !== true)) {
    return { ok: false, reason: 'no_bound_room', room_binding: binding,
      message: 'Bind the intended MindrianOS room before reading a local Reverse Salient thesis.' };
  }

  try {
    auditQueryString(args.discovery_id, 'rs-thesis-read-input');
  } catch (_error) {
    return { ok: false, reason: 'invalid_discovery_id', room_binding: binding,
      message: 'The discovery_id did not pass the local identifier safety check.' };
  }

  const db = navigation.openRoomDbReadOnlyForCaller(resolution.dir);
  if (!db) {
    return { ok: false, reason: 'room_db_unavailable', room_binding: binding,
      message: 'The bound room has no readable local room database.' };
  }
  try {
    let row;
    try {
      row = db.prepare('SELECT id, thesis, rs_type, breakthrough_score, room_slug, created_at FROM rs_discoveries WHERE id = ? LIMIT 1')
        .get(args.discovery_id);
    } catch (_error) {
      return { ok: false, reason: 'thesis_store_unavailable', room_binding: binding,
        message: 'This room does not expose the local Reverse Salient discovery view.' };
    }
    if (!row) {
      return { ok: false, reason: 'discovery_not_found', discovery_id: args.discovery_id,
        room_binding: binding, message: 'No Reverse Salient thesis matches this discovery_id in the bound room.' };
    }
    return {
      ok: true,
      host_service: 'rs_thesis_read',
      readiness: 'host_native',
      tier: 'tier0',
      local_only: true,
      discovery_id: row.id,
      thesis: row.thesis || null,
      meta: {
        rs_type: row.rs_type || null,
        breakthrough_score: row.breakthrough_score == null ? null : row.breakthrough_score,
        room_slug: row.room_slug || null,
        created_at: row.created_at || null,
      },
      room_binding: {
        room_id: binding.room_id,
        source: binding.source,
        operator_pinned: binding.operator_pinned === true,
      },
      persistence: 'none',
    };
  } finally {
    navigation.closeRoomDbForCaller(db);
  }
}

function register(server, ctx) {
  server.registerTool('rs_thesis_read', {
    title: 'Read Reverse Salient Thesis',
    description: DESCRIPTION,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    outputSchema: OUTPUT_SCHEMA,
    inputSchema: z.object({
      discovery_id: z.string().min(1).max(256)
        .describe('Exact ID of a previously filed RSDiscovery in the bound room.'),
    }).strict(),
  }, async (args, extra) => {
    const result = readThesis(args, ctx, extra);
    return response(result, !result.ok);
  });
}

const connectors = [{
  tool: 'rs_thesis_read',
  surface: 'rs_thesis_read',
  connector: 'mcp-tool',
  hitl_shape: 'none',
  hitl_why: 'Read-only lookup of a prior local Reverse Salient thesis; no fork, network call, or room write.',
  layer: 'harness',
  layer_why: 'Reads the bound room through the shared session resolver and navigation read-only SQLite door.',
}];

module.exports = { register, readThesis, connectors, response, DESCRIPTION, OUTPUT_SCHEMA };
