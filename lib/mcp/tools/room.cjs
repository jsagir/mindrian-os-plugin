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
// Canon Part 7 (reuse before build): reuses the SHIPPED SECTION_RE /
// safeResolveSection path-traversal guards from lib/mcp/tool-router.cjs (ASVS
// V5) and the SHIPPED session-room.cjs resolver (Phase 248-01), which itself
// wraps the core resolveSessionRoom/resolveWriteRoom precedence from
// lib/core/resolve-active-room.cjs (Phase 194 / 198-02) -- no second room
// resolver, no second path-guard.
//
// Canon Part 8: zero Brain/network tokens. Local filesystem reads only.

const fs = require('node:fs');
const path = require('node:path');
const { z } = require('zod');

const { SECTION_RE, safeResolveSection } = require('../tool-router.cjs')._test;
const { resolveEffectiveSessionId } = require('../../core/session-binding.cjs');
const { resolveSessionRoomDir } = require('../session-room.cjs');
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

// Quick task 260904-ng7: which file extensions room_search opens. Before this
// fix the walk only opened '.md', so every .html brief, rubric, or deck in a
// room was invisible to a literal-recall search and the tool reported a
// clean empty result -- a silent miss, not an error. The allowlist below is
// not a guess: it mirrors ARTIFACT_EXT, the repo's own canonical room-artifact
// extension set (lib/core/graph-backfill.cjs), minus one deliberate exclusion.
//   - '.md', '.html', '.htm' are IN: they are the confirmed live gap and are
//     already in ARTIFACT_EXT.
//   - '.txt' is deliberately NOT added: nothing in this repo writes a '.txt'
//     room artifact (every '.txt' path under lib/ and scripts/ is tooling
//     scratch), and it is absent from ARTIFACT_EXT too. Checked and rejected,
//     not an oversight.
//   - '.docx' is deliberately NOT added in this fix, even though it is in
//     ARTIFACT_EXT: lib/core/doc-text-extractor.cjs's extractDocxText joins
//     every run into ONE space-separated string, so a .docx has no line
//     structure and every hit would report line: 1, which makes room_search's
//     {file, line, snippet} contract silently false. Adding .docx needs its
//     own result-shape decision and is out of scope here.
const SEARCH_EXT = Object.freeze(['.md', '.html', '.htm']);

// Relevance weights: term frequency (log-damped match count) dominates, file
// recency breaks near-ties. Damping stops a file that merely repeats the query
// term from out-ranking a file that is genuinely about it.
const SEARCH_W_TF = 0.7;
const SEARCH_W_RECENCY = 0.3;

// Quick task 260904-ng7: dependency-free, line-preserving HTML-to-text pass.
// This is deliberately NOT a real HTML parser -- lib/core/doc-text-
// extractor.cjs's HTML leg needs cheerio, and cheerio is not installed in
// this repo (see the RCA filed at
// .planning/debug/html-artifacts-invisible-to-graph-derivation.md), so
// reusing that extractor here would turn a silent miss into a thrown tool
// error on every .html file. Instead this is a linear, non-backtracking
// regex pass with no ReDoS surface (T-ng7-01): strip <script>/<style>/
// comment regions (their content must never match or be returned as a
// snippet -- T-ng7-04), strip remaining tags, decode the minimal entity set
// that changes matching, then collapse whitespace.
//
// Returns a NEW array the SAME length as `lines`, index-for-index, so the
// reported line number stays truthful (D-04): room_search must never claim a
// line number that does not correspond to the real source line.
//
// A small state machine carries across lines for the three region kinds that
// can span multiple lines (<script>...</script>, <style>...</style>,
// <!-- ... -->). A line that is fully inside such a region maps to the empty
// string; a line that opens or closes one maps to only the portion outside
// the region. Ordinary tags are assumed not to span lines (they are stripped
// per-line by /<[^>]*>/g), which keeps the pass linear and dependency-free.
//
// Tags are replaced with a SINGLE SPACE, never the empty string:
// `<td>Acme</td><td>Corp</td>` must become "Acme Corp", not the false token
// "AcmeCorp". Accepted cost of this tradeoff: an inline tag that splits a
// single word, e.g. `<b>Acme</b>Corp`, will not be re-joined into one token.
//
// Order matters: tags are stripped FIRST, entities are decoded AFTER, so a
// decoded `&lt;` can never be re-read as a tag.
function htmlLinesToText(lines) {
  const out = new Array(lines.length);
  let inScript = false;
  let inStyle = false;
  let inComment = false;

  const stripTags = (s) => s.replace(/<[^>]*>/g, ' ');
  // &amp; is decoded LAST so an already-decoded '&lt;' etc. is never re-read
  // as the start of a fresh entity (no double-decode of '&amp;lt;').
  const decodeEntities = (s) => s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let pos = 0;
    const pieces = [];

    while (pos < line.length) {
      if (inComment) {
        const end = line.indexOf('-->', pos);
        if (end === -1) { pos = line.length; break; }
        inComment = false;
        pos = end + 3;
        continue;
      }
      if (inScript) {
        const m = /<\/script\s*>/i.exec(line.slice(pos));
        if (!m) { pos = line.length; break; }
        inScript = false;
        pos = pos + m.index + m[0].length;
        continue;
      }
      if (inStyle) {
        const m = /<\/style\s*>/i.exec(line.slice(pos));
        if (!m) { pos = line.length; break; }
        inStyle = false;
        pos = pos + m.index + m[0].length;
        continue;
      }

      const rest = line.slice(pos);
      const commentIdx = rest.indexOf('<!--');
      const scriptM = /<script(\s[^>]*)?>/i.exec(rest);
      const styleM = /<style(\s[^>]*)?>/i.exec(rest);

      const candidates = [];
      if (commentIdx !== -1) candidates.push({ idx: commentIdx, type: 'comment', len: 4 });
      if (scriptM) candidates.push({ idx: scriptM.index, type: 'script', len: scriptM[0].length });
      if (styleM) candidates.push({ idx: styleM.index, type: 'style', len: styleM[0].length });

      if (candidates.length === 0) {
        pieces.push(rest);
        pos = line.length;
        break;
      }

      candidates.sort((a, b) => a.idx - b.idx);
      const next = candidates[0];
      pieces.push(rest.slice(0, next.idx));
      pos = pos + next.idx + next.len;
      if (next.type === 'comment') inComment = true;
      else if (next.type === 'script') inScript = true;
      else inStyle = true;
    }

    let text = pieces.join('');
    text = stripTags(text);
    text = decodeEntities(text);
    text = text.replace(/\s+/g, ' ').trim();
    out[i] = text;
  }

  return out;
}

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
      const ext = path.extname(e.name).toLowerCase();
      if (!SEARCH_EXT.includes(ext)) continue;
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
      const isHtml = ext === '.html' || ext === '.htm';
      let searchLines = lines;
      if (isHtml) {
        // room_search must never throw because one malformed .html file
        // exists in the room: skip the file and let the walk continue,
        // mirroring the exit-safe posture of the readFileSync/statSync
        // catches above.
        try {
          searchLines = htmlLinesToText(lines);
        } catch (_e) {
          continue;
        }
      }
      const matches = [];
      const seen = new Set(); // dedupe verbatim-identical trimmed lines in-file
      let matchCount = 0;
      for (let i = 0; i < searchLines.length; i++) {
        if (!searchLines[i].toLowerCase().includes(needle)) continue;
        matchCount += 1;
        if (matches.length >= SEARCH_MAX_MATCHES_PER_FILE) continue;
        const snippet = searchLines[i].trim().slice(0, 200);
        if (seen.has(snippet)) continue;
        seen.add(snippet);
        matches.push({ line: i + 1, snippet });
      }
      if (matchCount > 0) {
        const record = { file: path.relative(roomDir, full), mtimeMs, matchCount, matches };
        // Additive provenance marker (D-06): non-.md results carry
        // extracted: true so the caller knows the text was derived from
        // markup, not read verbatim. .md results get NOTHING added, so an
        // .md result object keeps exactly its current four keys.
        if (isHtml) record.extracted = true;
        perFile.push(record);
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
      const result = {
        file: f.file,
        line: m.line,
        snippet: m.snippet,
        match_count: f.matchCount,
      };
      if (f.extracted) result.extracted = true;
      results.push(result);
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
    "Search the markdown and HTML entries of this session's bound room by case-insensitive substring, optionally scoped to a single section. Read-only, no side effects. It answers literal-recall questions well: a project name, a person, a funder, any term you expect to appear verbatim in the text. It does NOT do semantic or fuzzy matching, so for a conceptual or relational question reach for room_graph and run a graph query instead of guessing at keywords.",
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
  _internal: { resolveSessionRoomDir, listRooms, searchRoom, collectMatches, rankMatches, htmlLinesToText },
};
