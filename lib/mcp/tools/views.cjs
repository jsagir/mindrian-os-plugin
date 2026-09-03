'use strict';
// Phase 198-06 (SPEC-2, Task 2) -- artifact_file + view_compile.
//
// artifact_file: files a markdown artifact into the session's bound room
// through the shipped filing primitives -- reuses tool-router.cjs's
// SECTION_RE/safeResolveSection path-traversal guard (Canon Part 7, same
// reuse room.cjs/graph.cjs already established) and lib/core/artifact-id.cjs's
// computeArtifactId/injectArtifactId (the shipped stable-id + frontmatter
// injection pair, Phase-agnostic utility). The filing action itself is then
// recorded through lib/core/navigation.cjs's logMemoryEvent (the SAME door
// graph.cjs's memory_event tool writes through) -- this module never opens
// the graph store directly (T-198-04).
//
// view_compile: compiles a REGISTERED view for the bound room, read-mostly.
// The only view wired to real compilation today is 'wiki' -- it reuses
// lib/wiki/page-renderer.cjs's scanRoom/buildPageIndex/renderPage (the
// shipped, side-effect-free page-scan pipeline; NOT presentation-server.cjs,
// which opens an HTTP listener and is therefore unsuitable for an in-process
// MCP tool call). Any other view name degrades to an honest "not yet wired"
// note (never fabricated output) -- the VIEW_REGISTRY names every future view
// (dashboard/deck/insights/diagrams/graph) as a placeholder Wave-4+ can wire
// without touching this tool's schema again.
//
// D-07 (SUPERSEDED by Phase 234-05, D-05): artifact_file WRITES (it changes
// room state), so its REGISTRATION used to be flag-gated behind
// isMcpFirst(ctx.surface). That hid the tool entirely from any host where the
// flag defaults off, which is every foreign MCP host -- RESEARCH.md's Gap D.
// (Phase 248-01: per-session write-room resolution now goes through
// lib/mcp/session-room.cjs; isMcpFirst is no longer imported by this file.)
// Registration is now unconditional (DISCOVERY) and the handler evaluates
// isWritePathEnabled({surface, clientVersion}) as its FIRST statement
// (PERMISSION), because getClientVersion() is only populated after the
// initialize handshake and registration runs before any client connects.
// Same discipline as graph_write/memory_event. view_compile is read-only and,
// as before, always registered.
//
// Canon Part 8: zero Brain/network tokens. Canon Part 11: register(server,
// ctx) + connectors export, same disjoint-file module contract as room.cjs/
// graph.cjs/gate.cjs/sensors.cjs -- never requires those modules or
// lib/mcp/tool-router.cjs at module-load time (SECTION_RE/safeResolveSection
// are re-imported from tool-router.cjs's _test export, the SAME reuse
// room.cjs already does -- not a tools/tools require).
//
// 2026-08-19 amendment (quick task 260819-bql): the registration-vs-permission
// split above still holds; only WHO lands on the permitted side of the
// PERMISSION check changed. Claude Code is now permitted by default (see
// isWritePathEnabled's case 2 in lib/mcp/mcp-first-flag.cjs), so
// writePathRefusal below now serves an unidentified/pre-initialize client and
// the other tier1 hosts (Grok Build, OpenCode), not Claude Code.

const fs = require('node:fs');
const path = require('node:path');
const { z } = require('zod');

const navigation = require('../../core/navigation.cjs');
const { computeArtifactId, injectArtifactId } = require('../../core/artifact-id.cjs');
const { SECTION_RE, safeResolveSection } = require('../tool-router.cjs')._test;
const { resolveEffectiveSessionId } = require('../../core/session-binding.cjs');
const { isWritePathEnabled } = require('../mcp-first-flag.cjs');
const { resolveSessionRoomDir } = require('../session-room.cjs');
// Quick task 260903-i2x: the closed epistemic_type enum, read-only, for the
// artifact_file zod schema below (not a room.db open -- node-insert.cjs's
// own R17-02 gate is what actually validates the value; this is only the
// wire-schema mirror of the same closed set).
const { ALLOWED_EPISTEMIC_TYPES } = require('../../core/node-insert.cjs');

function textResponse(payload, isError) {
  const result = { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
  if (isError) result.isError = true;
  return result;
}

/**
 * Phase 234-05: the live client identity, read PER CALL. Independent copy per
 * the disjoint-file tool-module contract (the same shape graph.cjs carries).
 * The MCP SDK populates getClientVersion() only after initialize completes, so
 * a missing accessor degrades to undefined and floors to unknown/tier0 rather
 * than throwing inside a tool call.
 */
function currentClientVersion(server) {
  try {
    if (server && server.server && typeof server.server.getClientVersion === 'function') {
      return server.server.getClientVersion();
    }
  } catch (_e) {
    // fall through to the conservative floor
  }
  return undefined;
}

/**
 * Phase 234-05 (D-04, D-05): the per-call write gate. Returns null when the
 * call may proceed, or the honest refusal payload when it may not. Governance
 * stays server-side in the handler, so it holds on a host with no hook
 * channel. The refusal is informative rather than a silent catalog omission
 * (T-234-09).
 */
function writePathRefusal(server, ctx) {
  const clientVersion = currentClientVersion(server);
  if (isWritePathEnabled({ surface: ctx && ctx.surface, clientVersion: clientVersion })) return null;
  return textResponse({
    ok: false,
    reason: 'write_path_disabled',
    hint: 'Write path is off for this caller: the client is unidentified or has not completed initialize, or it is a tier1 host with its own hook channel (Grok Build, OpenCode). Set MINDRIAN_MCP_FIRST for this surface to override.',
  }, true);
}


// A path-safe basename: strips any directory component and rejects an
// escape attempt outright (defense-in-depth alongside safeResolveSection,
// which already guards the SECTION component -- this guards the FILENAME
// component the section-guard does not cover).
function safeBasename(filename) {
  const base = path.basename(String(filename || ''));
  if (base === '' || base === '.' || base === '..') return null;
  return base;
}

// Quick task 260903-i2x (T2 node-writing half) -- extraction, not invention.
// Mirrors the rule scripts/vault-section-minto-generator.cjs::firstBodyLine
// already uses to summarize a filed artifact (skip frontmatter, skip blank/
// heading/comment/blockquote lines, return the first real prose line). This
// is a SMALL LOCAL COPY, not an import of that script -- the generator is a
// CLI script, not a navigation-safe library this MCP tool should depend on.
// Truncated to 300 chars (Canon Part 8 bound); '' when no usable line exists
// -- never fabricated, an empty text is honest when the artifact has none.
function firstArtifactBodyLine(content) {
  if (typeof content !== 'string' || content.length === 0) return '';
  let body = content;
  if (content.startsWith('---')) {
    const end = content.indexOf('\n---', 3);
    if (end !== -1) body = content.slice(end + 4);
  }
  const lines = body.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('<!--')) continue;
    if (trimmed.startsWith('>')) continue;
    return trimmed.length > 300 ? trimmed.slice(0, 300) : trimmed;
  }
  return '';
}

/**
 * fileArtifact -- write `content` to `<roomDir>/<section>/<filename>`,
 * injecting a stable artifact_id when the content carries frontmatter
 * (idempotent, mirrors the shipped meeting-filing pipeline's own use of
 * injectArtifactId). Logs the filing through navigation.logMemoryEvent (the
 * ONLY door). Never opens the graph store directly.
 *
 * Quick task 260903-i2x (T2 node-writing half, ADDITIVE ONLY): after the
 * existing logMemoryEvent call, also writes a typed claim node (epistemic
 * type from params.epistemicType, default 'conclusion') plus SOURCED_FROM
 * provenance edges to params.evidenceNodeIds, through the SAME shared
 * writer gate_answer's approve branch uses. The logMemoryEvent row is
 * unchanged; this is new code alongside it, never a replacement.
 *
 * @param {object} db - a caller-owned graph-store handle
 * @param {string} roomDir
 * @param {{section: string, filename: string, content: string,
 *   epistemicType?: string, evidenceNodeIds?: string[]}} params
 */
function fileArtifact(db, roomDir, params) {
  const p = params || {};
  const scopeDir = safeResolveSection(roomDir, p.section || null);
  const base = safeBasename(p.filename);
  if (!base) {
    return { ok: false, reason: 'invalid_filename' };
  }
  const filename = base.endsWith('.md') ? base : base + '.md';
  fs.mkdirSync(scopeDir, { recursive: true });
  const filePath = path.join(scopeDir, filename);
  fs.writeFileSync(filePath, typeof p.content === 'string' ? p.content : '', 'utf8');

  let artifactId = null;
  try {
    const injected = injectArtifactId(filePath, roomDir);
    artifactId = injected && injected.artifact_id ? injected.artifact_id : null;
  } catch (_e) {
    artifactId = null; // no frontmatter, or already carries an id -- not a failure
  }
  if (!artifactId) {
    // No frontmatter to inject into (or already stamped) -- compute the
    // stable id anyway so the caller always gets one back, without mutating
    // a file that carries no frontmatter block.
    try {
      artifactId = computeArtifactId(roomDir, p.section || '_root', base, new Date().toISOString().slice(0, 10));
    } catch (_e) {
      artifactId = null;
    }
  }

  const logResult = navigation.logMemoryEvent(db, 'mcp_client_event_logged', {
    label: 'artifact_file',
    section: p.section || null,
    filename: filename,
    artifact_id: artifactId,
  });

  // Quick task 260903-i2x (T2 node-writing half) -- ADDITIVE ONLY, after the
  // logMemoryEvent row above. Skip entirely when artifactId is falsy: never
  // mint a node under a fabricated id (in practice computeArtifactId never
  // throws, so this guard is the structural floor rather than a commonly
  // exercised branch -- see the SUMMARY for the honest accounting).
  let reasoningNode = null;
  if (artifactId) {
    try {
      const nodeId = navigation.REASONING_NODE_ID('claim:artifact', artifactId);
      if (nodeId) {
        const text = firstArtifactBodyLine(typeof p.content === 'string' ? p.content : '');
        const epistemicType = (typeof p.epistemicType === 'string' && p.epistemicType.length > 0)
          ? p.epistemicType
          : 'conclusion';
        // framework: null is deliberate -- artifact_file has no chain/step
        // context, so per the design there is nothing to source a framework
        // from and nothing is guessed (unlike gate_answer's DC-2 threading).
        // No confirmNode promotion on this path -- artifact_file is not
        // gate-gated, so the node stays 'proposed' (DC-4).
        reasoningNode = navigation.writeReasoningNode(db, {
          nodeId: nodeId,
          nodeType: 'claim',
          epistemicType: epistemicType,
          text: text,
          section: p.section || null,
          sourcePath: 'artifact:' + artifactId,
          evidenceNodeIds: p.evidenceNodeIds,
          framework: null,
          origin: 'artifact_file',
        });
      }
    } catch (e) {
      reasoningNode = { ok: false, reason: 'reasoning_write_threw', detail: String((e && e.message) || e).slice(0, 80) };
    }
  }

  // Quick task 260903-i2x: artifact_file has ZERO deterministic callers
  // (grepped repo-wide by the T2 design pass, docs/2026-09-03-DESIGN-t2-
  // write-back-minimal.md) -- it is invoked only at Larry's runtime
  // discretion, so evidence_node_ids will be empty in practice until the
  // skill-prompt convention shipped in quick 260903-h58 is actually
  // exercised at runtime. That empty default is the design's own "never
  // fabricate" floor, NOT a bug to chase.
  return {
    ok: true,
    file_path: path.relative(roomDir, filePath),
    artifact_id: artifactId,
    memory_event: logResult,
    reasoning_node: reasoningNode,
  };
}

// -----------------------------------------------------------------------
// view_compile -- the shipped view registry. Only 'wiki' compiles for real
// today (lib/wiki/page-renderer.cjs, side-effect-free); every other name
// degrades honestly rather than fabricating output (Canon Part 7: reuse, do
// not reinvent presentation-server.cjs's HTTP-serving pipeline inside a bare
// MCP tool call).
// -----------------------------------------------------------------------
const VIEW_REGISTRY = Object.freeze(['wiki', 'dashboard', 'deck', 'insights', 'diagrams', 'graph']);

function compileWikiView(roomDir, pageId) {
  const pageRenderer = require('../../wiki/page-renderer.cjs');
  const { pages, sections } = pageRenderer.scanRoom(roomDir);
  const pageIndex = pageRenderer.buildPageIndex(pages);
  const summary = {
    page_count: pages.size,
    section_count: sections.size,
    sections: Array.from(sections.keys()),
  };
  if (typeof pageId === 'string' && pageId.length > 0 && pages.has(pageId)) {
    const rendered = pageRenderer.renderPage(pages.get(pageId), pageIndex, []);
    return Object.assign({ compiled_page: pageId, rendered: rendered }, summary);
  }
  return Object.assign({ compiled_page: null }, summary);
}

function compileView(view, roomDir, params) {
  if (VIEW_REGISTRY.indexOf(view) === -1) {
    return { ok: false, reason: 'unknown_view', known_views: VIEW_REGISTRY.slice() };
  }
  if (view === 'wiki') {
    try {
      return Object.assign({ ok: true, view: 'wiki' }, compileWikiView(roomDir, params && params.pageId));
    } catch (e) {
      return { ok: false, reason: 'compile_failed', detail: String((e && e.message) || e) };
    }
  }
  // Registered but not yet wired to a real compiler -- honest degrade, not
  // fabricated output (Canon "degrade, do not fabricate" discipline).
  return { ok: true, view: view, note: 'View registered but not yet wired to a compiler in this build.' };
}

function register(server, ctx) {
  // view_compile -- read-mostly, registered unconditionally.
  server.tool(
    'view_compile',
    "Compile a registered view (wiki/dashboard/deck/insights/diagrams/graph) for this session's bound room. Only 'wiki' compiles for real today (lib/wiki/page-renderer.cjs, side-effect-free); every other registered name degrades to an honest 'not yet wired' note rather than fabricated output.",
    {
      view: z.enum(VIEW_REGISTRY).describe('Which registered view to compile.'),
      page_id: z.string().min(1).optional()
        .describe("Optional page id (wiki view only) to render in full; absent -> a room-wide summary only."),
    },
    async ({ view, page_id }, extra) => {
      const sessionId = resolveEffectiveSessionId(undefined, extra);
      const roomDir = resolveSessionRoomDir(sessionId, ctx);
      const result = compileView(view, roomDir, { pageId: page_id });
      return textResponse(Object.assign({ room_dir: roomDir }, result), result.ok === false);
    }
  );

  // artifact_file -- WRITE. Phase 234-05 (D-05, Gap D): ALWAYS registered now.
  // The write gate moved from REGISTRATION time (visibility) to CALL time
  // (permission), mirroring graph_write/memory_event. See the header.
  server.tool(
    'artifact_file',
    "File a markdown artifact into this session's bound room. Resolves the section via the shipped SECTION_RE/safeResolveSection path-traversal guard, injects a stable artifact_id (lib/core/artifact-id.cjs), and logs the filing through navigation.cjs's logMemoryEvent (the ONLY door) -- never opens the graph store directly. Also writes a typed claim node (epistemic_type defaults to 'conclusion') plus SOURCED_FROM provenance edges to evidence_node_ids, through the SAME shared writer gate_answer's approve branch uses.",
    {
      section: z.string().regex(SECTION_RE, 'section must match [a-z0-9-]+')
        .describe('Room section slug to file into.'),
      filename: z.string().min(1).max(200)
        .describe('Basename for the filed artifact (a .md extension is appended if absent).'),
      content: z.string().max(200000)
        .describe('Full markdown content (including frontmatter, if any) to write.'),
      epistemic_type: z.enum(Array.from(ALLOWED_EPISTEMIC_TYPES)).optional()
        .describe("Epistemic classification of the filed claim; defaults to 'conclusion' when absent. 'decision' is reserved for gate-produced nodes (gate_answer's approve branch) and should not be passed here."),
      evidence_node_ids: z.array(z.string().min(1)).max(64).optional()
        .describe('Opaque LOCAL room-graph node ids, provenance only. Canon Part 8 forbids Brain identifiers or room content.'),
    },
    async ({ section, filename, content, epistemic_type, evidence_node_ids }, extra) => {
      const refused = writePathRefusal(server, ctx);
      if (refused) return refused;
      const sessionId = resolveEffectiveSessionId(undefined, extra);
      const roomDir = resolveSessionRoomDir(sessionId, ctx);
      const db = navigation.openRoomDbForCaller(roomDir);
      if (!db) {
        return textResponse({ ok: false, reason: 'no_room_db', room_dir: roomDir }, true);
      }
      try {
        const result = fileArtifact(db, roomDir, {
          section, filename, content,
          epistemicType: epistemic_type,
          evidenceNodeIds: evidence_node_ids,
        });
        return textResponse(Object.assign({ room_dir: roomDir }, result), !result.ok);
      } finally {
        navigation.closeRoomDbForCaller(db);
      }
    }
  );
}

// Born-wired SOURCE of truth (Part 11 R1/R16). view_compile is a pure read
// (hitl_shape 'none'). artifact_file mints a filed artifact + a memory_event
// node -- a material graph write, the same F.1 shape graph_write/memory_event
// carry. scripts/build-connector-registry.cjs discovers this export and
// regenerates data/mcp-tool-connectors.json + data/connector-registry.json
// from it; never hand-edit either generated file.
const connectors = [
  {
    tool: 'view_compile',
    surface: 'view_compile',
    connector: 'mcp-tool',
    hitl_shape: 'none',
    hitl_why: 'Pure read: compiles a registered view (wiki today; others degrade honestly) for the bound room, no fork.',
  },
  {
    tool: 'artifact_file',
    surface: 'artifact_file',
    connector: 'mcp-tool',
    hitl_shape: 'F.1',
    hitl_why: 'Files a markdown artifact and mints a memory_event node through navigation.cjs, plus a typed claim node with SOURCED_FROM provenance edges -- a material room-content write, not a pure read.',
  },
];

module.exports = {
  register,
  connectors,
  VIEW_REGISTRY,
  _internal: { resolveSessionRoomDir, fileArtifact, compileView, safeBasename },
};
