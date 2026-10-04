'use strict';
// Phase 369 plan 13 (FEED369-01, D-18) -- room_changes: the room's change feed
// as an MCP read tool, so the browser shell stays current through the MindrianOS
// MCP server and nothing else (D-18: no side door to room.db).
//
// Part 7 justification (reuse before build): no existing surface returns an
// ordered change feed. room_search returns substring matches, room://section
// returns a whole section, room_content manages entities, status_read reports
// segments. The shell's read copy needs "everything that changed after cursor N,
// with deletes as rows and a reset contract", which none of them can say.
//
// Part 8: local only. This module reaches no Brain host and makes no network
// call; room content never leaves the machine.
//
// Part 9: the read door only. The tool opens room.db through
// navigation.openRoomDbReadOnlyForCaller (file: URI mode=ro, so a write is
// mechanically rejected and no migration runs) and reads through the navigation
// re-exports readChanges / readSnapshot. It never requires room-db.cjs or
// node:sqlite, and it closes the handle in a finally. No read transaction spans
// MCP calls: the snapshot cursor carries its own as_of_seq instead. Inside one
// delta call the metadata and the page rows are one read transaction (plan 39).
//
// Part 11: born WIRED. `connectors` below is the source the connector registry
// and the zod 4 wire snapshot are regenerated from (hitl_shape none, layer
// harness).
//
// What the feed can and cannot see (open question 5, stated not hidden): a row
// reaches the change log only when something writes a nodes or edges row, and
// the table triggers (plan 05) capture every writer in every process. An
// artifact file that changes on disk reaches the feed only when an indexer writes
// its nodes (the PostToolUse graph hooks). A file written outside Claude Code and
// never indexed does not appear here until it is indexed. The shell's scope is
// review and decision (D-08), which accepts that.
//
// Answer shapes (JSON text, never thrown):
//   delta    { ok: true, room, epoch, floor, collection, changes[], from, through, latest_seq, has_more }
//   snapshot { ok: true, room, epoch, floor, collection, docs[], next_cursor, as_of_seq, done }
//   reset    { ok: false, reason: 'epoch_changed' | 'checkpoint_expired', epoch, floor, snapshot_revision }
//   others   { ok: false, reason: 'room_unbound' | 'room_unavailable' | 'change_log_absent' | 'feed_error' }
// Only feed_error sets isError: a reset is an expected answer, not a failure.
//
// No em-dashes. CJS only.

const { z } = require('zod');

const navigation = require('../../core/navigation.cjs');
const { resolveEffectiveSessionId } = require('../../core/session-binding.cjs');
const { resolveMcpSessionRoom, describeRoomBinding } = require('../session-room.cjs');

// Contract defaults (reasons in 369-13-PLAN.md): 200 is spike 006's working
// batchSize so one replica pull is one call; 500 is 2.5 times that and bounds one
// page's JSON; the 64 and 512 string caps are sized to an epoch id and a
// base64url cursor of two short fields.
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

function textResponse(payload, isError) {
  const result = { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
  if (isError) result.isError = true;
  return result;
}

function resolveBoundRoom(server, ctx, extra) {
  const sessionId = resolveEffectiveSessionId(undefined, extra);
  // noFloor: an unbound session must not read some other room (T-369-13-02), so
  // the cwd and boot fallbacks are off; the registry fallback is refused below.
  const resolution = resolveMcpSessionRoom({ sessionId: sessionId, ctx: ctx, noFloor: true });
  const binding = describeRoomBinding(resolution);
  if (!resolution.dir || !(binding.bound || binding.operator_pinned)) return null;
  return { dir: resolution.dir, slug: resolution.slug || null };
}

function handle(args, ctx, extra, server) {
  const a = args && typeof args === 'object' ? args : {};
  const collection = String(a.collection || '');
  if (!navigation.ROOM_COLLECTIONS.includes(collection)) {
    return textResponse({ ok: false, reason: 'feed_error', message: 'unknown collection: ' + collection }, true);
  }
  const room = resolveBoundRoom(server, ctx, extra);
  if (!room) {
    return textResponse({
      ok: false,
      reason: 'room_unbound',
      message: 'No room is bound to this session. Call room_list, then room_bind, then retry.',
    });
  }
  // D-18: start (or refresh) the daemon-side watcher that publishes room.changed
  // when any process commits to this room. Lazy require (the status.cjs cycle
  // pattern); its result never changes the room_changes answer.
  try {
    require('../room-watcher.cjs').ensureWatching({ roomId: room.slug || room.dir, roomDir: room.dir });
  } catch (_e) {
    // The watcher is a fast path only; the shell's own cursor poll is the net.
  }
  const db = navigation.openRoomDbReadOnlyForCaller(room.dir);
  if (!db) {
    return textResponse({ ok: false, reason: 'room_unavailable', room: room.slug, message: 'This room has no room.db yet.' });
  }
  try {
    const limit = Number.isInteger(a.limit) ? Math.min(MAX_LIMIT, Math.max(1, a.limit)) : DEFAULT_LIMIT;
    const meta = navigation.readChangeLogMeta(db);
    const present = meta.present === true;
    const epoch = present ? meta.epoch : null;
    const floor = present ? meta.floor : 0;

    if (a.mode === 'snapshot') {
      const snap = navigation.readSnapshot(db, {
        collection: collection,
        cursor: typeof a.snapshot_cursor === 'string' && a.snapshot_cursor.length > 0 ? a.snapshot_cursor : null,
        limit: limit,
      });
      return textResponse(Object.assign({ ok: true, room: room.slug, epoch: epoch, floor: floor, collection: collection }, snap));
    }

    if (!present) {
      return textResponse({
        ok: false,
        reason: 'change_log_absent',
        room: room.slug,
        snapshot_required: true,
        message: 'This room has no change log yet (it has not been opened by the write door). Take a snapshot.',
      });
    }
    // One read transaction decides the reset contract and reads the page
    // (WR-08), and the same snapshot refuses a cursor beyond the head (WR-07:
    // a room.db restored from an older copy). The reset answers carry the
    // epoch, floor and head of that snapshot.
    const after = Number.isInteger(a.after) && a.after >= 0 ? a.after : 0;
    const out = navigation.readChanges(db, {
      after: after,
      limit: limit,
      collection: collection,
      guard: { epoch: typeof a.epoch === 'string' ? a.epoch : null },
    });
    if (out.reset) {
      return textResponse({
        ok: false, reason: out.reset, room: room.slug, epoch: out.epoch, floor: out.floor, snapshot_revision: out.snapshot_revision,
      });
    }
    return textResponse(Object.assign({ ok: true, room: room.slug, epoch: out.epoch, floor: out.floor, collection: collection }, {
      changes: out.changes, from: out.from, through: out.through, latest_seq: out.latest_seq, has_more: out.has_more,
    }));
  } catch (err) {
    return textResponse({ ok: false, reason: 'feed_error', message: String((err && err.message) || err).slice(0, 200) }, true);
  } finally {
    navigation.closeRoomDbForCaller(db);
  }
}

function register(server, ctx) {
  server.registerTool(
    'room_changes',
    {
      title: 'Room Changes',
      description: "Read this room's change feed so a screen can stay current. Name one collection (nodes, relations, artifacts, decisions, activity) and a cursor; you get the changes after it in order, deletes as rows with no document, and the new cursor. If the cursor is too old or the room was rebuilt, ask again in snapshot mode and resume from its as_of_seq. This tool never writes.",
      inputSchema: z.object({
        collection: z.enum(navigation.ROOM_COLLECTIONS).describe('Which collection to read.'),
        after: z.number().int().min(0).nullable().optional().describe('Cursor: return changes after this change_seq. Null or absent means from the start.'),
        epoch: z.string().max(64).nullable().optional().describe('The epoch the cursor was issued under; a different current epoch answers epoch_changed.'),
        limit: z.number().int().min(1).max(MAX_LIMIT).optional().describe('Page size, default 200.'),
        mode: z.enum(['delta', 'snapshot']).optional().describe('delta (default) or snapshot (page current rows).'),
        snapshot_cursor: z.string().max(512).optional().describe('The next_cursor from the previous snapshot page.'),
      }),
    },
    // Block-bodied on purpose: scripts/check-tool-honesty.cjs only counts a handler
    // it can read as a block, and a read tool should be inside that sweep.
    async (args, extra) => {
      return handle(args, ctx, extra, server);
    }
  );
}

// Born-wired SOURCE of truth (Part 11 R1/R16). room_changes is a pure read
// (hitl_shape 'none'). scripts/build-connector-registry.cjs discovers this export
// and regenerates data/mcp-tool-connectors.json + data/connector-registry.json;
// never hand-edit either generated file.
const connectors = [
  {
    tool: 'room_changes',
    surface: 'room_changes',
    connector: 'mcp-tool',
    hitl_shape: 'none',
    hitl_why: 'Pure read: returns ordered room changes and snapshots for the browser read copy, no fork.',
    layer: 'harness',
    layer_why: 'Local room read through the read-only door of the navigation chokepoint.',
  },
];

module.exports = {
  register,
  connectors,
  _internal: { handle, resolveBoundRoom, DEFAULT_LIMIT, MAX_LIMIT },
};
