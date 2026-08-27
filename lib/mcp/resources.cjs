/**
 * MindrianOS MCP Resources — Read-only room browsing via room:// and reasoning:// URI schemes
 *
 * Resources let Desktop users browse room state without tool calls
 * (application-controlled, zero token cost).
 *
 * Registered resources:
 *   1. room-state        — room://state              (room STATE.md)
 *   2. room-sections     — room://sections            (section listing with metadata)
 *   3. room-section      — room://section/{name}      (template: section contents)
 *   4. room-meetings     — room://meetings            (meeting folder listing)
 *   5. room-intelligence — room://intelligence         (MEETINGS-INTELLIGENCE.md)
 *   6. reasoning-state   — reasoning://state           (reasoning status across all sections)
 *   7. reasoning-section — reasoning://section/{name}  (reasoning analysis for a section)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { getState } = require('../core/state-ops.cjs');
const { discoverSections } = require('../core/section-registry.cjs');
const { safeReadFile } = require('../core/index.cjs');
const reasoningOps = require('../core/reasoning-ops.cjs');
// Phase 270-05 (RESEARCH.md 3.4d): the single MCP room resolver, the SAME
// one every Tool already uses. Do NOT write a second resolver here --
// tests/test-248-resolver-census.cjs rule census.1 turns RED on any second
// `function resolveSessionRoomDir` under lib/mcp/.
const { resolveSessionRoomDir } = require('./session-room.cjs');
const { resolveEffectiveSessionId } = require('../core/session-binding.cjs');
// Phase 270-08: the ICM forest composition (plan 270-07). mos://tree reads
// through this and adds nothing -- the structure-only/no-file-bodies rule
// lives entirely in icm-forest.cjs so there is exactly one place a body
// could leak, not two.
const icmForest = require('../core/icm-forest.cjs');

// A room slug is a URI path segment (mos://room/{slug}/tree). This mirrors
// lib/mcp/tool-router.cjs's SECTION_RE pattern (that pair is exported only
// via a `_test`-only surface, not meant for cross-module production import
// -- see lib/core/icm-forest.cjs's header note on the same point) rather
// than restating a path-join without validation. A slug failing this check
// never reaches a filesystem path anywhere below.
const SAFE_SLUG_RE = /^[a-z0-9-]+$/i;

/**
 * Register all MCP Resources on the server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {{fallbackRoomDir: string, pluginRoot?: string, surface?: string}|string} ctx
 *   The SAME ctx shape register-core-tools.cjs already passes to every tool
 *   module. A bare string is accepted for ONE release as a back-compat arm
 *   (added 2026-08-27, plan 270-05) so a stale caller cannot silently break;
 *   remove the string arm once no caller passes one.
 */
function registerResources(server, ctx) {
  const rctx = (typeof ctx === 'string')
    ? { fallbackRoomDir: ctx }
    : (ctx && typeof ctx === 'object' ? ctx : {});

  // resolveRoom(extra) -- the ONE per-read resolution point in this file.
  // Every handler calls this; no handler reads rctx.fallbackRoomDir
  // directly. Mirrors the canonical per-call pattern lib/mcp/tools/graph.cjs
  // uses for Tools, so Resources and Tools derive the session id identically
  // (RESEARCH.md 3.4d: same resolver, same session-id derivation, no drift).
  function resolveRoom(extra) {
    return resolveSessionRoomDir(resolveEffectiveSessionId(undefined, extra), rctx);
  }

  // -------------------------------------------------------------------------
  // 1. room-state (static) — room://state
  // -------------------------------------------------------------------------
  server.resource(
    'room-state',
    'room://state',
    { description: 'Current Data Room state (STATE.md)', mimeType: 'text/markdown' },
    async (uri, extra) => {
      const roomDir = resolveRoom(extra);
      const state = getState(roomDir);
      const text = state || 'No room initialized. Run /mos:new-project to create one.';
      return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text }] };
    }
  );

  // -------------------------------------------------------------------------
  // 2. room-sections (static) — room://sections
  // -------------------------------------------------------------------------
  server.resource(
    'room-sections',
    'room://sections',
    { description: 'All discovered sections with metadata (name, type, label, color)', mimeType: 'application/json' },
    async (uri, extra) => {
      const roomDir = resolveRoom(extra);
      const sections = discoverSections(roomDir);
      const listing = sections.all.map((name) => {
        const meta = sections.getMeta(name);
        return { name, type: meta.type, label: meta.label, color: meta.color };
      });
      const text = JSON.stringify(listing, null, 2);
      return { contents: [{ uri: uri.href, mimeType: 'application/json', text }] };
    }
  );

  // -------------------------------------------------------------------------
  // 3. room-section (template) — room://section/{sectionName}
  // -------------------------------------------------------------------------
  const sectionTemplate = new ResourceTemplate('room://section/{sectionName}', {
    list: async (extra) => {
      const roomDir = resolveRoom(extra);
      const sections = discoverSections(roomDir);
      return {
        resources: sections.all.map((name) => ({
          name: `room-section-${name}`,
          uri: `room://section/${name}`,
          description: `Contents of the ${name} section`,
          mimeType: 'text/markdown',
        })),
      };
    },
  });

  server.resource(
    'room-section',
    sectionTemplate,
    { description: 'Contents of a specific Data Room section (all .md files)', mimeType: 'text/markdown' },
    async (uri, params, extra) => {
      const roomDir = resolveRoom(extra);
      const sectionName = params.sectionName;
      const sectionDir = path.join(roomDir, sectionName);

      if (!fs.existsSync(sectionDir) || !fs.statSync(sectionDir).isDirectory()) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'text/markdown',
            text: `Section "${sectionName}" not found in this Data Room.`,
          }],
        };
      }

      // Read all .md files in the section directory
      let files;
      try {
        files = fs.readdirSync(sectionDir).filter((f) => f.endsWith('.md')).sort();
      } catch (e) {
        files = [];
      }

      if (files.length === 0) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'text/markdown',
            text: `Section "${sectionName}" exists but contains no markdown files yet.`,
          }],
        };
      }

      const combined = files.map((f) => {
        const content = safeReadFile(path.join(sectionDir, f)) || '';
        return `# ${f}\n\n${content}`;
      }).join('\n\n---\n\n');

      return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: combined }] };
    }
  );

  // -------------------------------------------------------------------------
  // 4. room-meetings (static) — room://meetings
  // -------------------------------------------------------------------------
  server.resource(
    'room-meetings',
    'room://meetings',
    { description: 'List of filed meeting folders', mimeType: 'application/json' },
    async (uri, extra) => {
      const roomDir = resolveRoom(extra);
      const meetingsDir = path.join(roomDir, 'meetings');

      if (!fs.existsSync(meetingsDir) || !fs.statSync(meetingsDir).isDirectory()) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: 'No meetings filed yet.',
          }],
        };
      }

      let folders;
      try {
        folders = fs.readdirSync(meetingsDir, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name)
          .sort();
      } catch (e) {
        folders = [];
      }

      if (folders.length === 0) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: 'No meetings filed yet.',
          }],
        };
      }

      const text = JSON.stringify(folders, null, 2);
      return { contents: [{ uri: uri.href, mimeType: 'application/json', text }] };
    }
  );

  // -------------------------------------------------------------------------
  // 5. room-intelligence (static) — room://intelligence
  // -------------------------------------------------------------------------
  server.resource(
    'room-intelligence',
    'room://intelligence',
    { description: 'Cross-meeting intelligence analysis', mimeType: 'text/markdown' },
    async (uri, extra) => {
      const roomDir = resolveRoom(extra);
      const intel = safeReadFile(path.join(roomDir, 'MEETINGS-INTELLIGENCE.md'));
      const text = intel || 'No meeting intelligence generated yet. File meetings first.';
      return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text }] };
    }
  );

  // -------------------------------------------------------------------------
  // 6. reasoning-state (static) — reasoning://state
  // -------------------------------------------------------------------------
  server.resource(
    'reasoning-state',
    'reasoning://state',
    { description: 'Reasoning status across all room sections', mimeType: 'application/json' },
    async (uri, extra) => {
      const roomDir = resolveRoom(extra);
      const listing = reasoningOps.listReasoning(roomDir);
      const text = (listing && listing.length > 0)
        ? JSON.stringify(listing, null, 2)
        : 'No reasoning generated yet. Run /mos:reason generate to create reasoning for room sections.';
      return { contents: [{ uri: uri.href, mimeType: 'application/json', text }] };
    }
  );

  // -------------------------------------------------------------------------
  // 7. reasoning-section (template) — reasoning://section/{name}
  // -------------------------------------------------------------------------
  // reasoningTemplate ships list: undefined -- left AS IS (RESEARCH.md 3.4b
  // flags this as a known inconsistency: it is not enumerable via a
  // resources/list request). Phase 270 records it, does not fix it.
  const reasoningTemplate = new ResourceTemplate('reasoning://section/{name}', {
    list: undefined,
  });

  server.resource(
    'reasoning-section',
    reasoningTemplate,
    { description: 'Reasoning analysis for a specific room section', mimeType: 'text/markdown' },
    async (uri, params, extra) => {
      const roomDir = resolveRoom(extra);
      const name = params.name;
      const result = reasoningOps.getReasoning(roomDir, name);

      const text = result.error
        ? `No reasoning generated for ${name}. Run /mos:reason generate ${name} to create.`
        : result.content;

      return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text }] };
    }
  );

  // -------------------------------------------------------------------------
  // 8. mos-tree (static) - mos://tree (plan 270-08, RESEARCH.md 3.4a/4.1 item 1)
  // -------------------------------------------------------------------------
  // The whole ICM forest under the rooms home, as identity and structure
  // only, never file contents: every room, classified into one of four
  // classes (canonical_section / identity_directory / structural_directory
  // / discovered), reflecting a folder created after this session started
  // with no refresh step (dynamic discovery, no registration -- RESEARCH.md
  // 3.4b). This resource NEVER registers or promotes anything: a folder
  // found without its own .room-root sentinel comes back registered:false,
  // and promoting one is a human Decision Gate (Part 3/9), not something a
  // read does. A Resource, not a Tool, because it is a pure read, browsable,
  // takes no parameters, and has no fork -- it costs nothing against the
  // always-loaded tool schema budget (RESEARCH.md 3.4, 4.1 item 1).
  server.resource(
    'mos-tree',
    'mos://tree',
    { description: 'The ICM forest: every room under the rooms home, classified into canonical_section / identity_directory / structural_directory / discovered, identity and structure only (never file contents). Reflects a folder created after this session started, with no refresh step. A folder with no .room-root sentinel is surfaced as registered: false and is never auto-promoted -- promotion is a human Decision Gate.', mimeType: 'application/json' },
    async (uri) => {
      let text;
      try {
        const result = icmForest.discoverIcmForest({});
        text = JSON.stringify(result, null, 2);
      } catch (e) {
        let home = null;
        try { home = icmForest.listRoomRoots().home; } catch (_e2) { home = null; }
        text = JSON.stringify({ ok: false, reason: (e && e.message) || 'discover_failed', home }, null, 2);
      }
      return { contents: [{ uri: uri.href, mimeType: 'application/json', text }] };
    }
  );

  // -------------------------------------------------------------------------
  // 9. mos-room-tree (template) - mos://room/{slug}/tree
  // -------------------------------------------------------------------------
  // The `list` callback re-evaluates per resources/list call (the same
  // shipped pattern sectionTemplate above already uses), so a sub-room
  // created mid-session is enumerable with no re-registration step
  // (RESEARCH.md 3.4b). This template deliberately supplies a real list
  // function, unlike reasoningTemplate above, whose non-enumerable callback
  // is that resource's own known inconsistency (:206-208); this one records
  // that gap rather than repeating it.
  const roomTreeTemplate = new ResourceTemplate('mos://room/{slug}/tree', {
    list: async () => {
      let rooms = [];
      try {
        rooms = icmForest.listRoomRoots().rooms || [];
      } catch (_e) {
        rooms = [];
      }
      return {
        resources: rooms.map((slug) => ({
          uri: 'mos://room/' + slug + '/tree',
          name: slug,
        })),
      };
    },
  });

  server.resource(
    'mos-room-tree',
    roomTreeTemplate,
    { description: 'One room\'s own subtree from the ICM forest (see mos://tree for the full-forest shape and class definitions), scoped to the {slug} named in the URI.', mimeType: 'application/json' },
    async (uri, params) => {
      const slug = params && params.slug;
      // threat T-270-05 (ASVS V5): variables.slug is client-supplied and is
      // this template's only untrusted input. Validated BEFORE any use, and
      // never echoed back into an error string.
      if (typeof slug !== 'string' || !SAFE_SLUG_RE.test(slug)) {
        return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ ok: false, reason: 'unknown_room' }, null, 2) }] };
      }
      let text;
      try {
        const result = icmForest.discoverIcmForest({});
        const room = (result.rooms || []).find((r) => r.slug === slug || r.name === slug);
        text = room
          ? JSON.stringify({ ok: true, room }, null, 2)
          : JSON.stringify({ ok: false, reason: 'unknown_room' }, null, 2);
      } catch (e) {
        text = JSON.stringify({ ok: false, reason: (e && e.message) || 'discover_failed' }, null, 2);
      }
      return { contents: [{ uri: uri.href, mimeType: 'application/json', text }] };
    }
  );
}

module.exports = { registerResources };
