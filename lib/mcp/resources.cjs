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
}

module.exports = { registerResources };
