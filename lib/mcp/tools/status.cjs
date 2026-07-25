'use strict';
// Phase 198-06 (SPEC-2, Task 2) -- status_read (spend/cap segment, day one).
//
// The Warp lesson (per 198-CONTEXT.md <specifics>): "Spend/cap visibility as
// a first-class statusline segment ... status_read carries it from day one" --
// the room teardown's finding was that bolting spend/cap visibility on AFTER
// a substrate ships is what fails; the segment SHAPE must exist from the
// first cut of the contract, even where the live billing wire is not built
// yet. This tool ships that shape now:
//   - context_pct/context_source: reuses the SHIPPED lib/statusline/
//     ctx-window.cjs::resolveCtxPct (Canon Part 7 -- the SAME context-budget
//     percentage resolver the CLI statusline already renders), fed by an
//     OPTIONAL caller-supplied context_window object (the native Claude Code
//     statusline stdin shape) -- a bare MCP pull has no stdin, so this
//     degrades to null/'none' when the caller does not thread it through.
//   - spend_usd/cap_usd: read from MINDRIAN_SPEND_USD / MINDRIAN_SPEND_CAP_USD
//     env vars (or an optional caller-supplied override) -- no live billing
//     API exists yet in this tree; degrade to null rather than fabricate a
//     number. The SEGMENT is real and present from day one; the wire to a
//     real billing source is future work (out of this plan's scope).
//
// status_read also publishes the computed segment to the SSE bus (Plan 03's
// lib/mcp/sse-event-bus.cjs, EVENT_KINDS 'status-segment') so a live
// subscriber (the future thin-adapter statusline) sees it without polling.
//
// Canon Part 8: zero Brain/network tokens; pure local reads + in-process
// publish. Canon Part 11: register(server, ctx) + connectors export, same
// disjoint-file module contract as room.cjs/graph.cjs/gate.cjs/sensors.cjs/
// views.cjs -- never requires those modules or lib/mcp/tool-router.cjs at
// module-load time.

const { z } = require('zod');

const { resolveCtxPct } = require('../../statusline/ctx-window.cjs');
const sseEventBus = require('../sse-event-bus.cjs');
const { resolveWriteRoom, resolveActiveRoom } = require('../../core/resolve-active-room.cjs');
const { resolveEffectiveSessionId } = require('../../core/session-binding.cjs');
const { isMcpFirst } = require('../mcp-first-flag.cjs');

function textResponse(payload, isError) {
  const result = { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
  if (isError) result.isError = true;
  return result;
}

/**
 * Resolve THIS session's room for a READ. Independent copy per the
 * disjoint-file tool-module contract.
 *
 * @param {string|undefined} sessionId
 * @param {{fallbackRoomDir: string, surface?: string}} ctx
 * @returns {string}
 */
function resolveSessionRoomDir(sessionId, ctx) {
  const fallback = (ctx && ctx.fallbackRoomDir) || process.cwd();
  try {
    if (isMcpFirst(ctx && ctx.surface)) {
      const r = resolveWriteRoom({ sessionId: sessionId, home: process.env.MINDRIAN_ROOMS_HOME });
      if (r && r.abs_path) return r.abs_path;
    }
    const active = resolveActiveRoom();
    if (active && active.abs_path) return active.abs_path;
  } catch (_e) {
    // fall through to fallback
  }
  return fallback;
}

function parseNumericEnv(name) {
  const raw = process.env[name];
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * buildSpendCapSegment -- the Warp-lesson segment. Never throws; every field
 * is null-degradable so the SHAPE is stable even before a real billing wire
 * lands.
 *
 * @param {{spendUsd?: number, capUsd?: number}} overrides - optional
 *   caller-supplied values (take precedence over env when finite numbers)
 * @returns {{spend_usd: number|null, cap_usd: number|null, currency: string, source: string}}
 */
function buildSpendCapSegment(overrides) {
  const o = overrides || {};
  const spendUsd = (typeof o.spendUsd === 'number' && Number.isFinite(o.spendUsd))
    ? o.spendUsd
    : parseNumericEnv('MINDRIAN_SPEND_USD');
  const capUsd = (typeof o.capUsd === 'number' && Number.isFinite(o.capUsd))
    ? o.capUsd
    : parseNumericEnv('MINDRIAN_SPEND_CAP_USD');
  return {
    spend_usd: spendUsd,
    cap_usd: capUsd,
    currency: 'usd',
    source: (spendUsd !== null || capUsd !== null) ? 'configured' : 'unavailable',
  };
}

/**
 * buildStatusSegments -- the full status_read payload. Pure composition; no
 * fs/network beyond the room-dir resolve above (already LOCAL-only).
 */
function buildStatusSegments(roomDir, params) {
  const p = params || {};
  const ctx = resolveCtxPct(p.contextWindow);
  const spendCap = buildSpendCapSegment({ spendUsd: p.spendUsd, capUsd: p.capUsd });
  return {
    room_dir: roomDir,
    context_pct: ctx.pct,
    context_source: ctx.source,
    spend_cap: spendCap,
  };
}

function register(server, ctx) {
  server.tool(
    'status_read',
    "Read this session's navigator status segments, including the spend/cap segment from day one (the Warp lesson -- the shape exists now even where the live billing wire is not yet built). Publishes the computed segment to the SSE bus ('status-segment') for a live subscriber.",
    {
      context_window: z.record(z.any()).optional()
        .describe("Optional native Claude Code statusline stdin context_window object, forwarded through to the SAME resolveCtxPct resolver the CLI statusline uses. Absent -> context_pct is null."),
      spend_usd: z.number().nonnegative().optional()
        .describe('Optional caller-supplied spend override (else MINDRIAN_SPEND_USD env, else null).'),
      cap_usd: z.number().nonnegative().optional()
        .describe('Optional caller-supplied cap override (else MINDRIAN_SPEND_CAP_USD env, else null).'),
    },
    async ({ context_window, spend_usd, cap_usd }, extra) => {
      const sessionId = resolveEffectiveSessionId(undefined, extra);
      const roomDir = resolveSessionRoomDir(sessionId, ctx);
      const segments = buildStatusSegments(roomDir, { contextWindow: context_window, spendUsd: spend_usd, capUsd: cap_usd });
      sseEventBus.publish('status-segment', segments);
      return textResponse({ ok: true, segments: segments });
    }
  );
}

// Born-wired SOURCE of truth (Part 11 R1/R16). status_read is a pure read
// (hitl_shape 'none') -- it never mutates room state, it only composes and
// publishes a status segment. scripts/build-connector-registry.cjs discovers
// this export and regenerates data/mcp-tool-connectors.json +
// data/connector-registry.json from it; never hand-edit either generated file.
const connectors = [
  {
    tool: 'status_read',
    surface: 'status_read',
    connector: 'mcp-tool',
    hitl_shape: 'none',
    hitl_why: "Pure read: composes this session's navigator status segments (including the day-one spend/cap segment) and publishes to the SSE bus, no fork.",
  },
];

module.exports = {
  register,
  connectors,
  _internal: { resolveSessionRoomDir, buildSpendCapSegment, buildStatusSegments },
};
