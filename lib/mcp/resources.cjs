/**
 * MindrianOS MCP Resources — Read-only room browsing via room:// URI scheme
 *
 * Resources let Desktop users browse room state without tool calls
 * (application-controlled, zero token cost).
 *
 * Registered resources:
 *   1. room-state       — room://state         (room STATE.md)
 *   2. room-sections    — room://sections       (section listing with metadata)
 *   3. room-section     — room://section/{name} (template: section contents)
 *   4. room-meetings    — room://meetings       (meeting folder listing)
 *   5. room-intelligence — room://intelligence  (MEETINGS-INTELLIGENCE.md)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { getState } = require('../core/state-ops.cjs');
const { discoverSections } = require('../core/section-registry.cjs');
const { safeReadFile } = require('../core/index.cjs');

/**
 * Register all MCP Resources on the server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {string} roomDir - Absolute path to the Data Room directory
 */
function registerResources(server, roomDir) {
  // -------------------------------------------------------------------------
  // 1. room-state (static) — room://state
  // -------------------------------------------------------------------------
  server.resource(
    'room-state',
    'room://state',
    { description: 'Current Data Room state (STATE.md)', mimeType: 'text/markdown' },
    async (uri) => {
      const state = getState(roomDir);
      const text = state || 'No room initialized. Run /mindrian-os:new-project to create one.';
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
    async (uri) => {
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
    list: async () => {
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
    async (uri, params) => {
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
    async (uri) => {
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
    async (uri) => {
      const intel = safeReadFile(path.join(roomDir, 'MEETINGS-INTELLIGENCE.md'));
      const text = intel || 'No meeting intelligence generated yet. File meetings first.';
      return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text }] };
    }
  );
}

module.exports = { registerResources };
