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
const { resolveEffectiveSessionId } = require('../../core/session-binding.cjs');
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

// Bounded substring search over the room's markdown files. Read-only; never
// touches room.db (that is the graph tools' door, not this one).
//
// RANK-THEN-CAP (fix for graph-query-results-unranked, room_search leg). The
// original walk pushed matches in raw filesystem directory-entry order and
// hard-`return`ed the instant results hit SEARCH_MAX_RESULTS -- so the 50-slot
// cap landed BEFORE any relevance ordering. A genuinely relevant hit in a
// late-traversed folder was silently dropped in favor of 50 incidental
// early-folder hits, and one entity-heavy file could monopolize the whole
// budget with near-duplicate same-entity lines (the Shi et al. 2023 /
// Mirzadeh et al. 2024 same-topic-distractor shape). The walk now scans every
// file up to the SEARCH_MAX_FILES cost bound (never truncating on arrival
// order), collects per-file match tallies + recency, RANKS, and only then
// applies the result cap with a per-file slice so no single file can crowd
// out a more relevant file elsewhere.
const SEARCH_MAX_FILES = 500;   // walk-bound for cost control (unchanged)
const SEARCH_MAX_RESULTS = 50;  // final payload cap, applied AFTER ranking
// A single file may contribute at most this many lines to the ranked payload.
// Its full match tally still drives its rank; this only bounds its slice of
// the 50-slot budget so near-duplicate same-entity hits cannot monopolize it.
const SEARCH_MAX_PER_FILE = 5;
// Bound the per-file lines we retain in memory so a pathologically large file
// cannot blow up the candidate set; matches beyond this still count toward the
// file's relevance tally (matchCount), they are just not individually returned.
const SEARCH_MAX_MATCHES_PER_FILE = 200;

// Relevance weights: term frequency (log-damped match count) dominates, file
// recency breaks near-ties. Damping stops a file that merely repeats the query
// term from out-ranking a file that is genuinely about it.
const SEARCH_W_TF = 0.7;
const SEARCH_W_RECENCY = 0.3;

// Collect every matching file (bounded by SEARCH_MAX_FILES) with its match
// tally, recency, and a deduped, per-file-capped list of matching lines.
function collectMatches(scopeDir, roomDir, needle) {
  const perFile = [];
  let scanned = 0;

  function walk(dir) {
    if (scanned >= SEARCH_MAX_FILES) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_e) {
      return;
    }
    // Deterministic traversal: readdir order is inode-dependent, which the old
    // code inherited as nondeterministic output. Sorting makes both the walk
    // bound and ranking ties resolve stably across platforms.
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      if (scanned >= SEARCH_MAX_FILES) return;
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
      let mtimeMs = 0;
      try {
        mtimeMs = fs.statSync(full).mtimeMs;
      } catch (_e) {
        mtimeMs = 0;
      }
      const lines = content.split(/\r?\n/);
      const matches = [];
      const seen = new Set(); // dedupe verbatim-identical trimmed lines in-file
      let matchCount = 0;
      for (let i = 0; i < lines.length; i++) {
        if (!lines[i].toLowerCase().includes(needle)) continue;
        matchCount += 1;
        if (matches.length >= SEARCH_MAX_MATCHES_PER_FILE) continue;
        const snippet = lines[i].trim().slice(0, 200);
        if (seen.has(snippet)) continue;
        seen.add(snippet);
        matches.push({ line: i + 1, snippet });
      }
      if (matchCount > 0) {
        perFile.push({ file: path.relative(roomDir, full), mtimeMs, matchCount, matches });
      }
    }
  }

  walk(scopeDir);
  return perFile;
}

// Rank the collected files by relevance, then fill the SEARCH_MAX_RESULTS
// budget in ranked order with a per-file slice cap. This is the step that
// replaces the old arrival-order truncation.
function rankMatches(perFile) {
  const maxMtime = perFile.reduce((m, f) => Math.max(m, f.mtimeMs), 0);
  const scored = perFile.map((f) => {
    const tf = Math.log1p(f.matchCount);
    const recency = maxMtime > 0 ? f.mtimeMs / maxMtime : 0;
    return { f, score: tf * SEARCH_W_TF + recency * SEARCH_W_RECENCY };
  });
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.f.matchCount !== a.f.matchCount) return b.f.matchCount - a.f.matchCount;
    return a.f.file < b.f.file ? -1 : a.f.file > b.f.file ? 1 : 0;
  });

  const results = [];
  for (const { f } of scored) {
    if (results.length >= SEARCH_MAX_RESULTS) break;
    const slice = f.matches.slice(0, SEARCH_MAX_PER_FILE);
    for (const m of slice) {
      if (results.length >= SEARCH_MAX_RESULTS) break;
      results.push({
        file: f.file,
        line: m.line,
        snippet: m.snippet,
        match_count: f.matchCount,
      });
    }
  }
  return results;
}

function searchRoom(roomDir, query, section) {
  const scopeDir = safeResolveSection(roomDir, section || null);
  const needle = query.toLowerCase();
  const perFile = collectMatches(scopeDir, roomDir, needle);
  return rankMatches(perFile);
}

function register(server, ctx) {
  server.tool(
    'room_list',
    'List every room directory under MINDRIAN_ROOMS_HOME. Read-only, no side effects. Call this first whenever you do not already know which rooms exist or how one is named, then use room_bind to attach this session to the room you want and room_state to read that room health, stage, and suggested next move. This tool answers only WHICH rooms exist; it deliberately says nothing about what is inside any of them, so do not use it to look for content.',
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
      const sessionId = resolveEffectiveSessionId(undefined, extra);
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
    "Search the markdown entries of this session's bound room by case-insensitive substring, optionally scoped to a single section. Read-only, no side effects. It answers literal-recall questions well: a project name, a person, a funder, any term you expect to appear verbatim in the text. It does NOT do semantic or fuzzy matching, so for a conceptual or relational question reach for room_graph and run a graph query instead of guessing at keywords.",
    {
      query: z.string().min(1).max(500)
        .describe('Search text (case-insensitive substring match).'),
      section: sectionOptional
        .describe('Optional section slug to scope the search to.'),
    },
    async ({ query, section }, extra) => {
      const sessionId = resolveEffectiveSessionId(undefined, extra);
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

module.exports = {
  register,
  connectors,
  _internal: { resolveSessionRoomDir, listRooms, searchRoom, collectMatches, rankMatches },
};
