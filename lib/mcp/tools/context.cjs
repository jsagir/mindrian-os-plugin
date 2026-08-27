'use strict';
// Phase 270-09. This tool is a WIRE, not an implementation. getRoomContext
// (lib/core/navigation/room-context.cjs:244) is a 4-leg local fusion that
// has shipped for phases with zero MCP surface (RESEARCH.md 3.2). This
// module resolves the session room, opens the room.db through the Part 9
// chokepoint, calls navigation.getRoomContext, and returns. It adds no
// assembly logic of its own. Don't Hand-Roll row 6: do not build a second
// assembler.
//
// The wire caveat (room-context.cjs:14-18): that header says the output
// feeds Larry's IN-PROCESS reasoning and MUST NOT cross the wire. This tool
// DOES put it on the MCP wire, which is a local stdio or loopback transport
// to the user's own client, never the Brain. Recording that distinction
// explicitly so a future reader does not mistake an MCP response for a
// Part 8 egress: no Brain client is imported here and no network call is
// added.
//
// No em-dashes. CJS only.

const path = require('node:path');
const { z } = require('zod');

const navigation = require('../../core/navigation.cjs');
const { resolveEffectiveSessionId } = require('../../core/session-binding.cjs');
const { resolveSessionRoomDir } = require('../session-room.cjs');

function textResponse(payload, isError) {
  const result = { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
  if (isError) result.isError = true;
  return result;
}

function register(server, ctx) {
  server.tool(
    'context_assemble',
    'Assembles this session\'s room context from four local legs: the room state summary, recent session fragments, a ranked graph neighborhood around the conversation, and projected cortex nodes. Every leg reads locally through the navigation.cjs chokepoint, with zero Brain calls. The four numeric parameters are your budget dial. Set estimate_only to see the projected cost per leg WITHOUT the bodies, so you can price a context pull before paying for it. Never returns raw file contents.',
    {
      fragment_window: z.number().int().min(1).max(50).optional()
        .describe('How many of the most recent session fragments to include (default 6).'),
      fragment_char_cap: z.number().int().min(50).max(4000).optional()
        .describe('Per-fragment character cap before truncation (default 400).'),
      top_k: z.number().int().min(1).max(100).optional()
        .describe('Max ranked graph-neighborhood results to return (default 10).'),
      max_depth: z.number().int().min(1).max(5).optional()
        .describe('Max graph traversal depth for the neighborhood leg (default 2).'),
      estimate_only: z.boolean().optional()
        .describe('When true, returns the projected per-leg cost with all leg bodies nulled, so you can see the price before paying it (default false).'),
    },
    async ({ fragment_window, fragment_char_cap, top_k, max_depth, estimate_only }, extra) => {
      const sessionId = resolveEffectiveSessionId(undefined, extra);
      const roomDir = resolveSessionRoomDir(sessionId, ctx);
      const db = navigation.openRoomDbForCaller(roomDir);
      if (!db) {
        return textResponse({ ok: false, reason: 'no_room_db', room_dir: roomDir });
      }
      try {
        // The existing convention every getRoomContext caller uses
        // (scripts/intent-classifier.cjs): the room id is the room
        // directory's own basename, never a second identity scheme.
        const roomId = path.basename(roomDir || '.') || 'room';
        const result = await navigation.getRoomContext(db, roomId, {
          fragmentWindow: fragment_window,
          fragmentCharCap: fragment_char_cap,
          topK: top_k,
          maxDepth: max_depth,
          estimateOnly: estimate_only === true,
        });
        return textResponse({ ok: true, room_dir: roomDir, ...result });
      } catch (e) {
        return textResponse({ ok: false, reason: (e && e.message) || 'context_assemble_failed', room_dir: roomDir }, true);
      } finally {
        navigation.closeRoomDbForCaller(db);
      }
    }
  );
}

// Born-wired SOURCE of truth (Part 11 R1/R16). scripts/build-connector-
// registry.cjs discovers this export and regenerates data/mcp-tool-
// connectors.json + data/connector-registry.json from it; never hand-edit
// either generated file.
const connectors = [
  {
    tool: 'context_assemble',
    surface: 'context_assemble',
    connector: 'mcp-tool',
    hitl_shape: 'none',
    hitl_why: 'A pure read across four local legs (room state, session fragments, graph neighborhood, projected cortex) through the navigation.cjs chokepoint -- no graph mutation, no node minted, no fork. Contrast with memory_event\'s F.1: this tool never writes, the read/write line RESEARCH.md 2.5 names as the load-bearing distinction this phase preserves.',
  },
];

module.exports = { register, connectors };
