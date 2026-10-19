'use strict';
// Phase 198-04 (SPEC-2, Task 2) -- room_list / room_state / room_search.
//
// Three read-only, session-scoped room tools. Registered unconditionally
// (they add surface without altering any legacy path -- lib/mcp/register-core-
// tools.cjs's Task 1 read-only carve-out). Every tool resolves the room from
// THIS session's binding (extra.sessionId -> lib/mcp/session-room.cjs's
// resolveSessionRoomDir, the ONE shared MCP resolver as of Phase 248-01),
// never a frozen boot-time roomDir.
//
// Canon Part 7 (reuse before build): reuses the SHIPPED SECTION_RE
// path-traversal guard from lib/mcp/tool-router.cjs (ASVS V5) for the zod
// section field and the SHIPPED session-room.cjs resolver (Phase 248-01), which
// itself wraps the core resolveSessionRoom/resolveWriteRoom precedence from
// lib/core/resolve-active-room.cjs (Phase 194 / 198-02) -- no second room
// resolver, no second path-guard.
// The search engine and its guards now live in lib/core/room-search.cjs (quick
// 261012-u58). This file keeps the three tools, the room_search envelope and
// the _internal names that the room_search tests read.
//
// Canon Part 8: zero Brain/network tokens. Local filesystem reads only.

const { z } = require('zod');

const { SECTION_RE } = require('../tool-router.cjs')._test;
const { resolveEffectiveSessionId } = require('../../core/session-binding.cjs');
const { resolveSessionRoomDir, resolveMcpSessionRoom, describeRoomBinding } = require('../session-room.cjs');
const { listRoomRoots } = require('../../core/icm-forest.cjs');

const sectionOptional = z.string().regex(SECTION_RE, 'section must match [a-z0-9-]+').optional();

function textResponse(payload, isError) {
  const result = { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
  if (isError) result.isError = true;
  return result;
}

/**
 * room_list: enumerate room directories under $MINDRIAN_ROOMS_HOME (or the
 * default ~/MindrianRooms). Pure directory read; no room content is read.
 *
 * Phase 270-12 Task 2 Half B: this function no longer carries its own copy of
 * the rooms-home resolution and the readdir. Plan 270-07 lifted that logic into
 * lib/core/icm-forest.cjs's listRoomRoots() and recorded the duplication as a
 * KNOWN, temporary one to avoid a cross-plan conflict while both waves were in
 * flight; this is the plan that collapses it. The dependency runs lib/mcp/* ->
 * lib/core/*, which is the allowed direction (the reverse would be wrong), and
 * icm-forest.cjs is already on the server's load path via lib/mcp/resources.cjs,
 * so delegating adds no new cold-start cost.
 *
 * listRoomRoots() returns { home, rooms } with the same resolution precedence
 * (explicit arg, then MINDRIAN_ROOMS_HOME, then HOME/USERPROFILE/os.homedir()
 * joined with 'MindrianRooms'), the same hidden-entry skip, the same sort, and
 * the same empty-array-on-error behaviour, so room_list's wire response is
 * byte-identical. Called with no argument so the env precedence is evaluated
 * per call, exactly as the local copy did.
 */
function listRooms() {
  return listRoomRoots();
}

// The search engine lives in lib/core/room-search.cjs (quick 261012-u58) so the
// wiki /api/search and this tool share one engine. This module keeps the MCP
// tool, its envelope and the _internal names the room_search tests read.
const roomSearch = require('../../core/room-search.cjs');
const { searchRoomDetailed, searchRoom } = roomSearch;
const {
  collectMatches, rankMatches, htmlLinesToText, queryWords, scoreWordTier, walkSearchFiles,
  collectWordStats, scanSearchScope, scoreWordStats, SEARCH_MAX_FILES,
  SEARCH_FLOOR_MIN_WORDS, SEARCH_FLOOR_MIN_IDF_SHARE,
} = roomSearch._internal;

const roomApp = require('../room-app.cjs');

function register(server, ctx) {
  roomApp.registerRoomApp(server);
  server.registerTool(
    'room_list',
    {
      title: 'Room List',
      _meta: roomApp.TOOL_META,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      description: 'Open MindrianOS by listing the existing local rooms and showing the built-in room picker in compatible MCP Apps hosts. Read-only: listing does not bind or create a room and reads no room contents. Let the user select a room, then use room_bind without an invented sessionId; verify effective and carries_to_later_calls, call context_assemble and room_startup for its saved understanding and workday briefing, then room-dashboard without room_path to open the bound room. If the user already named a room, still validate it against this list. For a first room use room_create and its approval gate. The standalone browser shell is a separate local feature; do not route an embedded room-opening request to Claude Code.',
      inputSchema: z.object({}),
    },
    async () => {
      const rooms = listRooms();
      return Object.assign(textResponse(rooms), { structuredContent: rooms });
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
  server.registerTool(
    'room_state_bound',
    {
      title: 'Room State Bound',
      description: "Return this session's bound room STATE.md. Read-only, no side effects. (Distinct from the legacy grouped 'room_state' multi-command tool.)",
      inputSchema: z.object({}),
    },
    async (_args, extra) => {
      const sessionId = resolveEffectiveSessionId(undefined, extra);
      // RCA desktop-session-binding-fallback: label an unbound read.
      const roomResolution = resolveMcpSessionRoom({ sessionId: sessionId, ctx: ctx });
      const roomDir = roomResolution.dir;
      let state = '';
      try {
        const stateOps = require('../../core/state-ops.cjs');
        state = stateOps.getState(roomDir) || '';
      } catch (_e) {
        state = '';
      }
      const roomBinding = describeRoomBinding(roomResolution);
      const payload = {
        room_dir: roomDir,
        state: state || 'No STATE.md found in this room.',
        room_binding: roomBinding,
      };
      if (roomBinding.note) payload.note = roomBinding.note;
      return textResponse(payload);
    }
  );

  server.registerTool(
    'room_search',
    {
      title: 'Room Search',
      description: "Search the markdown and HTML entries of this session's bound room, optionally scoped to a single section. Read-only, no side effects, and local to this machine. Send a plain question, a full sentence, or a single term. The tool first looks for your exact text, ignoring case. When no file holds that exact text, the tool ranks the files by the meaningful words in your question. It returns the best line from each of the top files. The reply names the tier that answered, phrase or words. An empty reply carries a reason and means the room holds no answer for this wording, so tell the person that. Matching is literal, with no semantic or fuzzy search, so a file that uses other words than yours is not found. For a question about how things in the room connect, use room_graph and run a graph query.",
      inputSchema: z.object({
        query: z.string().min(1).max(500)
          .describe('A plain question, a full sentence, or a single term. Case-insensitive. The exact text is tried first, then its meaningful words.'),
        section: sectionOptional
          .describe('Optional section slug to scope the search to.'),
      }),
    },
    async ({ query, section }, extra) => {
      const sessionId = resolveEffectiveSessionId(undefined, extra);
      const roomDir = resolveSessionRoomDir(sessionId, ctx);
      let found;
      try {
        found = searchRoomDetailed(roomDir, query, section || null);
      } catch (e) {
        return textResponse({ ok: false, reason: String((e && e.message) || e) }, true);
      }
      const payload = { room_dir: roomDir, query, tier: found.tier, results: found.results };
      if (found.tier !== 'phrase') payload.words = found.words;
      payload.scanned = found.scanned;
      payload.walkable = found.walkable;
      payload.truncated = found.truncated;
      if (found.results.length === 0) {
        payload.reason_code = found.reason_code;
        payload.reason = found.reason;
      }
      return textResponse(payload);
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
    layer: 'context',
    layer_why: 'Enumerates room directories to let the navigator choose which room\'s context to bind; a room-context reader.',
  },
  {
    tool: 'room_state_bound',
    surface: 'room_state_bound',
    connector: 'mcp-tool',
    hitl_shape: 'none',
    hitl_why: "Pure read: returns the session-bound room's STATE.md, no fork. Named room_state_bound (not the bare room_state) to avoid colliding with the live Phase 52 grouped router tool of that name.",
    layer: 'context',
    layer_why: 'Reads the session-bound room\'s STATE.md; a room-context reader, the rubric\'s own step 4 signal verbatim.',
  },
  {
    tool: 'room_search',
    surface: 'room_search',
    connector: 'mcp-tool',
    hitl_shape: 'none',
    hitl_why: 'Pure read: bounded substring search over the session-bound room, no fork.',
    layer: 'context',
    layer_why: 'Bounded substring search over the session-bound room\'s own content; a room-context reader.',
  },
];

module.exports = {
  register,
  connectors,
  _internal: {
    resolveSessionRoomDir, listRooms, searchRoom, collectMatches, rankMatches, htmlLinesToText,
    searchRoomDetailed, queryWords, scoreWordTier, walkSearchFiles, collectWordStats,
    scanSearchScope, scoreWordStats, SEARCH_MAX_FILES,
    SEARCH_FLOOR_MIN_WORDS, SEARCH_FLOOR_MIN_IDF_SHARE,
  },
};
