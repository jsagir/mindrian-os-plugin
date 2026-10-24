'use strict';

// Bound-room, local-only lookup over previously stored Paper/Author edges.
// It does not contact Brain, Aura, a directory, or an external provider.

const { z } = require('zod');
const navigation = require('../../core/navigation.cjs');
const { resolveEffectiveSessionId } = require('../../core/session-binding.cjs');
const { resolveMcpSessionRoom, describeRoomBinding } = require('../session-room.cjs');
const { auditQueryString } = require('../../core/rs-egress-prompts.cjs');
const { searchLocalExperts } = require('../../core/rs-local-expert-search.cjs');

const DESCRIPTION = 'Find authors in the session’s bound MindrianOS room by literal topic matches against stored paper titles and abstracts. Local-only and read-only. This does not search an external expert directory or establish expertise. Requires a bound or operator-pinned room; no registry or server fallback is used.';
const AUTHOR_SCHEMA = z.object({
  author_id: z.string(),
  name: z.string(),
  institutions: z.array(z.string()),
  matched_paper_count: z.number().int().nonnegative(),
  papers: z.array(z.object({
    id: z.string(), title: z.string().nullable(), source: z.string().nullable(), matched_terms: z.array(z.string()),
  }).strict()),
}).strict();
const OUTPUT_SCHEMA = z.object({
  ok: z.boolean(), reason: z.string().optional(), message: z.string().optional(),
  host_service: z.literal('rs_experts_find').optional(), readiness: z.literal('host_native').optional(),
  local_only: z.boolean().optional(), match_count: z.number().int().nonnegative().optional(),
  authors: z.array(AUTHOR_SCHEMA).optional(),
  matched_paper_count: z.number().int().nonnegative().optional(),
  search: z.object({ terms: z.array(z.string()), fields: z.array(z.string()), papers_scanned: z.number().int(), papers_in_room: z.number().int() }).strict().optional(),
  partial: z.boolean().optional(), omissions: z.array(z.record(z.string(), z.unknown())).optional(),
  limitations: z.array(z.string()).optional(), room_binding: z.record(z.string(), z.unknown()).optional(),
  persistence: z.literal('none').optional(),
}).passthrough();

function response(payload, isError) {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }], structuredContent: payload, ...(isError ? { isError: true } : {}) };
}

function findExperts(args, ctx, extra) {
  const sessionId = resolveEffectiveSessionId(undefined, extra);
  const resolution = resolveMcpSessionRoom({ sessionId, ctx, noFloor: true });
  const binding = describeRoomBinding(resolution);
  if (!resolution.dir || (!binding.bound && binding.operator_pinned !== true)) {
    return { ok: false, reason: 'no_bound_room', room_binding: binding,
      message: 'Bind the intended MindrianOS room before searching its local research records.' };
  }
  try {
    auditQueryString(args.topic, 'rs-experts-find-input');
  } catch (_error) {
    return { ok: false, reason: 'invalid_topic', room_binding: binding,
      message: 'The topic did not pass the local input safety check.' };
  }
  const db = navigation.openRoomDbReadOnlyForCaller(resolution.dir);
  if (!db) return { ok: false, reason: 'room_db_unavailable', room_binding: binding,
    message: 'The bound room has no readable local room database.' };
  try {
    let result;
    try {
      result = searchLocalExperts(db, args.topic, args.limit);
    } catch (_error) {
      return { ok: false, reason: 'expert_store_unavailable', room_binding: binding,
        message: 'The bound room does not expose a readable Paper/Author research graph.' };
    }
    if (!result.ok) return { ...result, room_binding: binding };
    return {
      ...result,
      host_service: 'rs_experts_find', readiness: 'host_native', local_only: true,
      room_binding: { room_id: binding.room_id, source: binding.source, operator_pinned: binding.operator_pinned === true },
    };
  } finally {
    navigation.closeRoomDbForCaller(db);
  }
}

function register(server, ctx) {
  server.registerTool('rs_experts_find', {
    title: 'Find Authors in Local Research', description: DESCRIPTION,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    inputSchema: z.object({
      topic: z.string().min(2).max(240).describe('Topic terms to match against stored paper titles and abstracts in the bound room.'),
      limit: z.number().int().min(1).max(100).optional().describe('Maximum authors returned; default 25.'),
    }).strict(),
    outputSchema: OUTPUT_SCHEMA,
  }, async (args, extra) => {
    const result = findExperts(args, ctx, extra);
    return response(result, !result.ok);
  });
}

const connectors = [{
  tool: 'rs_experts_find', surface: 'rs_experts_find', connector: 'mcp-tool',
  hitl_shape: 'none', hitl_why: 'Read-only search within the bound room; it makes no external request and does not write local knowledge.',
  layer: 'harness', layer_why: 'Uses the bound-session room resolver and navigation read-only database door.',
}];

module.exports = { register, findExperts, response, connectors, DESCRIPTION, OUTPUT_SCHEMA };
