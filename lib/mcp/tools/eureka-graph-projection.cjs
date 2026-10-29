'use strict';

const { registerEurekaTool, response: eurekaResponse, signalFromExtra } = require('../eureka-tool-contract.cjs');

// Read-only bridge from MindrianOS's session-bound local graph to attached
// Eureka engine MCP tools. Input is an explicit set of node IDs, never a path
// or arbitrary query. The host keeps identity, authorization, and persistence.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { z } = require('zod');
const navigation = require('../../core/navigation.cjs');
const { resolveEffectiveSessionId } = require('../../core/session-binding.cjs');
const { resolveMcpSessionRoom, describeRoomBinding } = require('../session-room.cjs');

function textResponse(payload, isError) {
  return eurekaResponse(payload, isError);
}

// Canon Part 8 L2 and the registry disposition: a room with a top-level
// GUARDRAIL.md, or a registry entry marked sealed or archived, is never
// projected for an engine. A stat failure counts as sealed (fail closed).
function isRoomSealed(dir, slug) {
  try {
    if (fs.existsSync(path.join(dir, 'GUARDRAIL.md'))) return true;
  } catch (_error) {
    return true;
  }
  try {
    const home = process.env.MINDRIAN_ROOMS_HOME ||
      path.join(process.env.HOME || process.env.USERPROFILE || os.homedir(), 'MindrianRooms');
    const regPath = path.join(home, '.rooms', 'registry.json');
    if (!fs.existsSync(regPath)) return false;
    const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
    if (!reg || typeof reg !== 'object' || !slug) return false;
    const entry = Array.isArray(reg.rooms)
      ? reg.rooms.find((room) => room && (room.slug === slug || room.name === slug))
      : (reg.rooms && typeof reg.rooms === 'object' ? reg.rooms[slug] : null);
    if (!entry || typeof entry !== 'object') return false;
    return entry.sealed === true || entry.status === 'sealed' || entry.status === 'archived';
  } catch (_error) {
    return true;
  }
}

function project(args, ctx, extra) {
  const sessionId = resolveEffectiveSessionId(undefined, extra);
  const resolution = resolveMcpSessionRoom({ sessionId, ctx, noFloor: true });
  const binding = describeRoomBinding(resolution);
  if (!resolution.dir || !(binding.bound || binding.operator_pinned)) {
    return { ok: false, reason: 'no_bound_room', message: 'Bind the intended MindrianOS room before preparing an engine projection.' };
  }
  if (isRoomSealed(resolution.dir, resolution.slug)) {
    return { ok: false, reason: 'room_sealed', message: 'This room is sealed or archived; no engine projection was created.' };
  }
  if (!binding.identity || binding.identity.state !== 'ready') {
    return { ok: false, reason: 'room_identity_not_ready', message: 'This room identity is not ready; no engine projection was created. Repair the room identity first.' };
  }
  if (!binding.room_id) {
    return { ok: false, reason: 'room_identity_unavailable', message: 'This room has no verified MindrianOS room identity; no engine projection was created.' };
  }
  const db = navigation.openRoomDbReadOnlyForCaller(resolution.dir);
  if (!db) return { ok: false, reason: 'room_db_unavailable', message: 'MindrianOS could not open the bound room graph read-only.' };
  let transactionOpen = false;
  try {
    // Pin node and edge reads to one SQLite read snapshot. BEGIN is read-only
    // on this connection; the handle was opened with mode=ro by navigation.
    db.exec('BEGIN DEFERRED');
    transactionOpen = true;
    const result = navigation.projectEngineSnapshot(db, { node_ids: args.node_ids, scope_id: binding.room_id });
    db.exec('COMMIT');
    transactionOpen = false;
    result.room_binding = { room_id: binding.room_id, source: binding.source, registry_fallback: binding.registry_fallback };
    result.projection_complete = result.snapshot.meta.complete;
    result.partial = !result.projection_complete;
    result.projection_omissions = result.snapshot.meta.omissions;
    result.partial_policy = 'warn_and_continue';
    result.review_required = true;
    result.acceptance_requires_review = true;
    return result;
  } catch (error) {
    if (transactionOpen) {
      try { db.exec('ROLLBACK'); } catch (_rollbackError) { /* closing the read-only handle is the final guard */ }
    }
    if (error instanceof TypeError || error instanceof RangeError) {
      return { ok: false, reason: 'projection_rejected', message: error.message };
    }
    return { ok: false, reason: 'projection_failed', message: 'MindrianOS could not prepare this graph projection.' };
  } finally {
    navigation.closeRoomDbForCaller(db);
  }
}

function register(server, ctx) {
  registerEurekaTool(server,
    'eureka_graph_project',
    {
      title: 'Prepare MindrianOS Graph Projection for Eureka',
      description: 'Read a bounded, explicit selection from the active MindrianOS room graph through the navigation boundary. Requires a bound room and verified room identity. Returns selected node text, stable graph references, induced edges, a content-derived snapshot ID, and omission metadata. Does not accept room paths, expand beyond selected IDs, call an engine, or write graph state. Pass the returned snapshot, scope_id, and snapshot_id to the separately configured Eureka MCP.',
      inputSchema: z.object({
        node_ids: z.array(z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9_.:/-]*$/))
          .min(1).max(2500)
          .describe('Explicit MindrianOS graph node IDs selected for this investigation. Only these nodes and edges between them are projected.'),
      }).strict(),
    },
    async (args, extra) => {
      const result = project(args, ctx, extra);
      return textResponse(result, !result.ok);
    }
  );
}

const connectors = [{
  tool: 'eureka_graph_project',
  surface: 'eureka_graph_project',
  connector: 'mcp-tool',
  hitl_shape: 'none',
  hitl_why: 'Read-only projection of caller-selected IDs from the already-bound room through MindrianOS navigation; no graph mutation or scope expansion.',
  layer: 'harness',
  layer_why: 'Prepares the MindrianOS-owned graph view consumed by a separately attached analysis engine.',
}];

module.exports = { register, project, connectors, textResponse };
