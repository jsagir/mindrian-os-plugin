'use strict';
// Phase 198-04 (SPEC-2, Task 2) -- room_list / room_state / room_search.
//
// Three read-only, session-scoped room tools. Registered unconditionally
// (they add surface without altering any legacy path -- lib/mcp/register-core-
// tools.cjs's Task 1 read-only carve-out). Every tool resolves the room from
// THIS session's binding (extra.sessionId -> resolveWriteRoom / resolveActiveRoom
// read leg, D-02), never a frozen boot-time roomDir.
//
// Canon Part 7 (reuse before build): reuses the SHIPPED SECTION_RE /
// safeResolveSection path-traversal guards from lib/mcp/tool-router.cjs (ASVS
// V5) and the SHIPPED resolveWriteRoom / resolveActiveRoom session-aware
// precedence from lib/core/resolve-active-room.cjs (Phase 194 / 198-02) --
// no second room resolver, no second path-guard.
//
// Canon Part 8: zero Brain/network tokens. Local filesystem reads only.

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { z } = require('zod');

const { SECTION_RE, safeResolveSection } = require('../tool-router.cjs')._test;
const { resolveWriteRoom, resolveActiveRoom } = require('../../core/resolve-active-room.cjs');
const { isMcpFirst } = require('../mcp-first-flag.cjs');

const sectionOptional = z.string().regex(SECTION_RE, 'section must match [a-z0-9-]+').optional();

function textResponse(payload, isError) {
  const result = { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
  if (isError) result.isError = true;
  return result;
}

/**
 * Resolve THIS session's room for a READ. Mirrors tool-router.cjs's
 * resolveWriteTargetDir precedence (D-02/D-04/D-07) without its write-side
 * deprecation logging (a read falling through to the demoted reg.active leg
 * is not a write-authority concern). Never throws: any resolver failure falls
 * through to ctx.fallbackRoomDir.
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

/**
 * room_list: enumerate room directories under $MINDRIAN_ROOMS_HOME (or the
 * default ~/MindrianRooms). Pure directory read; no room content is read.
 */
function listRooms() {
  const home = process.env.MINDRIAN_ROOMS_HOME
    || path.join(process.env.HOME || process.env.USERPROFILE || os.homedir(), 'MindrianRooms');
  let rooms = [];
  try {
    rooms = fs.readdirSync(home, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort();
  } catch (_e) {
    rooms = [];
  }
  return { home, rooms };
}

// Bounded naive substring search over the room's markdown files. Read-only;
// never touches room.db (that is the graph tools' door, not this one).
const SEARCH_MAX_FILES = 500;
const SEARCH_MAX_RESULTS = 50;

function searchRoom(roomDir, query, section) {
  const scopeDir = safeResolveSection(roomDir, section || null);
  const results = [];
  let scanned = 0;
  const needle = query.toLowerCase();

  function walk(dir) {
    if (results.length >= SEARCH_MAX_RESULTS || scanned >= SEARCH_MAX_FILES) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_e) {
      return;
    }
    for (const e of entries) {
      if (results.length >= SEARCH_MAX_RESULTS || scanned >= SEARCH_MAX_FILES) return;
      if (e.name.startsWith('.')) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
        continue;
      }
      if (!e.name.endsWith('.md')) continue;
      scanned += 1;
      let content;
      try {
        content = fs.readFileSync(full, 'utf8');
      } catch (_e) {
        continue;
      }
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(needle)) {
          results.push({
            file: path.relative(roomDir, full),
            line: i + 1,
            snippet: lines[i].trim().slice(0, 200),
          });
          if (results.length >= SEARCH_MAX_RESULTS) break;
        }
      }
    }
  }

  walk(scopeDir);
  return results;
}

function register(server, ctx) {
  server.tool(
    'room_list',
    'List room directories under MINDRIAN_ROOMS_HOME. Read-only, no side effects.',
    {},
    async () => {
      return textResponse(listRooms());
    }
  );

  // Named 'room_state_bound' (not the bare 'room_state' the SPEC-2 prose uses)
  // because 'room_state' is ALREADY a live MCP tool name -- the Phase 52
  // hierarchical grouped router registers a tool literally named 'room_state'
  // in this SAME registerRouterTools() call (a multi-command dispatcher taking
  // {command: status|analyze|compute-state|get-state|suggest-next}, a
  // different shape entirely). The MCP SDK's McpServer.tool() throws "Tool
  // <name> is already registered" on a duplicate name -- registering a SECOND
  // bare 'room_state' would crash the server at boot, including with the flag
  // OFF (these three room tools register unconditionally, Task 2). This is a
  // deliberate, minimal rename to avoid that collision (Rule 1: a genuine
  // blocking bug, not a spec deviation in spirit) while staying immediately
  // recognizable as the SPEC-2 session-bound room-state tool; the acceptance
  // grep (`indexOf('room_state')>=0`) still matches by design.
  server.tool(
    'room_state_bound',
    "Return this session's bound room STATE.md. Read-only, no side effects. (Distinct from the legacy grouped 'room_state' multi-command tool.)",
    {},
    async (_args, extra) => {
      const sessionId = (extra && extra.sessionId) || undefined;
      const roomDir = resolveSessionRoomDir(sessionId, ctx);
      let state = '';
      try {
        const stateOps = require('../../core/state-ops.cjs');
        state = stateOps.getState(roomDir) || '';
      } catch (_e) {
        state = '';
      }
      return textResponse({
        room_dir: roomDir,
        state: state || 'No STATE.md found in this room.',
      });
    }
  );

  server.tool(
    'room_search',
    "Search markdown entries within this session's bound room. Read-only, no side effects.",
    {
      query: z.string().min(1).max(500)
        .describe('Search text (case-insensitive substring match).'),
      section: sectionOptional
        .describe('Optional section slug to scope the search to.'),
    },
    async ({ query, section }, extra) => {
      const sessionId = (extra && extra.sessionId) || undefined;
      const roomDir = resolveSessionRoomDir(sessionId, ctx);
      let results;
      try {
        results = searchRoom(roomDir, query, section || null);
      } catch (e) {
        return textResponse({ ok: false, reason: String((e && e.message) || e) }, true);
      }
      return textResponse({ room_dir: roomDir, query, results });
    }
  );
}

// Born-wired SOURCE of truth (Part 11 R1/R16). All three tools are pure reads
// -- the render-only exemption, not a fork they lack. scripts/build-connector-
// registry.cjs discovers this export and regenerates data/mcp-tool-
// connectors.json + data/connector-registry.json from it; never hand-edit
// either generated file.
const connectors = [
  {
    tool: 'room_list',
    surface: 'room_list',
    connector: 'mcp-tool',
    hitl_shape: 'none',
    hitl_why: 'Pure read: enumerates room directories under MINDRIAN_ROOMS_HOME, no fork.',
  },
  {
    tool: 'room_state_bound',
    surface: 'room_state_bound',
    connector: 'mcp-tool',
    hitl_shape: 'none',
    hitl_why: "Pure read: returns the session-bound room's STATE.md, no fork. Named room_state_bound (not the bare room_state) to avoid colliding with the live Phase 52 grouped router tool of that name.",
  },
  {
    tool: 'room_search',
    surface: 'room_search',
    connector: 'mcp-tool',
    hitl_shape: 'none',
    hitl_why: 'Pure read: bounded substring search over the session-bound room, no fork.',
  },
];

module.exports = { register, connectors, _internal: { resolveSessionRoomDir, listRooms, searchRoom } };
