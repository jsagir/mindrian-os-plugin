#!/usr/bin/env node
'use strict';

/**
 * MindrianOS -- Chat Embed Generator
 * Generates the Fabric Chat panel HTML with room-specific graph schema embedded.
 * Schema includes: node types, edge types, sample queries from the Room's Fabric.
 *
 * Usage:
 *   node scripts/generate-chat-embed.cjs [ROOM_PATH]
 *   const { generateChatEmbed } = require('./scripts/generate-chat-embed.cjs');
 *   const html = generateChatEmbed(roomDir);
 *
 * Output: chat-panel HTML string ready for embedding in any Showcase view.
 * Zero npm dependencies -- uses only Node.js built-ins.
 */

const fs = require('fs');
const path = require('path');

// -- Load graph schema from fabric-chat module --
let GRAPH_SCHEMA;
try {
  GRAPH_SCHEMA = require('../lib/chat/fabric-chat.cjs').GRAPH_SCHEMA;
} catch (_) {
  // Fallback minimal schema if module not available
  GRAPH_SCHEMA = {
    nodeTypes: [
      { name: 'Artifact', properties: ['id', 'title', 'section', 'methodology', 'created', 'content_hash'], description: 'Knowledge Entry' },
      { name: 'Section', properties: ['name', 'label'], description: 'Room Section' }
    ],
    edgeTypes: [
      { name: 'INFORMS', from: 'Artifact', to: 'Artifact', properties: [], description: 'References' },
      { name: 'CONTRADICTS', from: 'Artifact', to: 'Artifact', properties: ['confidence'], description: 'Tension' },
      { name: 'CONVERGES', from: 'Artifact', to: 'Artifact', properties: ['term'], description: 'Pattern' },
      { name: 'ENABLES', from: 'Artifact', to: 'Artifact', properties: [], description: 'Unblocks' },
      { name: 'INVALIDATES', from: 'Artifact', to: 'Artifact', properties: [], description: 'Makes stale' },
      { name: 'BELONGS_TO', from: 'Artifact', to: 'Section', properties: [], description: 'Filed in' },
      { name: 'REASONING_INFORMS', from: 'Section', to: 'Section', properties: ['provides'], description: 'Minto chain' },
      { name: 'HSI_CONNECTION', from: 'Artifact', to: 'Artifact', properties: ['hsi_score', 'surprise_type', 'breakthrough_potential', 'tier'], description: 'Surprise' },
      { name: 'REVERSE_SALIENT', from: 'Section', to: 'Section', properties: ['differential_score', 'innovation_thesis'], description: 'Bottleneck' },
      { name: 'ANALOGOUS_TO', from: 'Artifact', to: 'Artifact', properties: ['analogy_distance', 'source_domain'], description: 'Cross-domain bridge' },
      { name: 'STRUCTURALLY_ISOMORPHIC', from: 'Section', to: 'Section', properties: ['isomorphism_score'], description: 'Structural mirror' },
      { name: 'RESOLVES_VIA', from: 'Artifact', to: 'Artifact', properties: ['resolution_type', 'triz_principle'], description: 'Resolution' }
    ],
    sampleQueries: []
  };
}

/**
 * Scan a room directory to build room-specific schema metadata.
 * Adds section names and entry counts to the schema for better NL-to-Cypher context.
 * @param {string} roomDir - Path to room directory
 * @returns {object} Enriched schema object
 */
function buildRoomSchema(roomDir) {
  const schema = JSON.parse(JSON.stringify(GRAPH_SCHEMA)); // deep clone

  // Discover sections from room directory
  const sections = [];
  try {
    const entries = fs.readdirSync(roomDir, { withFileTypes: true });
    const skipDirs = new Set(['.lazygraph', 'meetings', 'team', 'exports', 'assets', 'personas']);

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.') || skipDirs.has(entry.name)) continue;

      const sectionDir = path.join(roomDir, entry.name);
      let articleCount = 0;
      try {
        const files = fs.readdirSync(sectionDir);
        articleCount = files.filter(f => f.endsWith('.md') && f !== 'STATE.md' && f !== 'ROOM.md').length;
      } catch (_) {}

      sections.push({
        name: entry.name,
        label: entry.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        entryCount: articleCount
      });
    }
  } catch (_) {}

  // Add room-specific context to schema
  schema.roomSections = sections;
  schema.roomContext = 'This Room has ' + sections.length + ' sections: ' +
    sections.map(s => s.name + ' (' + s.entryCount + ' entries)').join(', ');

  // Add room-specific sample queries if sections exist
  if (sections.length > 0) {
    const firstSection = sections[0].name;
    schema.sampleQueries = schema.sampleQueries.concat([
      {
        question: 'What entries are in ' + firstSection + '?',
        cypher: "MATCH (a:Artifact)-[:BELONGS_TO]->(s:Section {name: '" + firstSection + "'}) RETURN a.title, a.id"
      }
    ]);
  }

  return schema;
}

/**
 * Read the chat panel template HTML.
 * @returns {string} Raw HTML template
 */
function readChatPanelTemplate() {
  const templatePath = path.join(__dirname, '..', 'templates', 'chat-panel.html');
  if (fs.existsSync(templatePath)) {
    return fs.readFileSync(templatePath, 'utf-8');
  }
  // Fallback: return minimal inline panel
  return '<!-- chat-panel.html template not found -->\n<div id="mos-fabric-chat-root"></div>';
}

/**
 * Generate the chat panel HTML with room-specific schema embedded.
 * @param {string} roomDir - Path to room directory
 * @returns {string} Complete HTML string ready for embedding
 */
function generateChatEmbed(roomDir) {
  const schema = buildRoomSchema(roomDir);
  const templateHtml = readChatPanelTemplate();

  // Inject the schema before the closing </script> tag
  const schemaInjection = '\n<script>\n' +
    '// Room-specific Fabric schema (generated by generate-chat-embed.cjs)\n' +
    'window.__fabricSchema = ' + JSON.stringify(schema, null, 2) + ';\n' +
    '</script>\n';

  // Insert schema script before the main chat panel script
  const injected = templateHtml.replace(
    '<script>',
    schemaInjection + '<script>'
  );

  return injected;
}

/**
 * Generate a minimal chat embed snippet for inclusion in other HTML views.
 * Returns just the essential elements without full page structure.
 * @param {string} roomDir - Path to room directory
 * @returns {string} HTML snippet for embedding
 */
function generateChatSnippet(roomDir) {
  const schema = buildRoomSchema(roomDir);

  return '<!-- Fabric Chat Panel (generated by MindrianOS) -->\n' +
    '<script>window.__fabricSchema = ' + JSON.stringify(schema) + ';</script>\n' +
    readChatPanelTemplate();
}

// -- CLI entrypoint --
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node scripts/generate-chat-embed.cjs [ROOM_PATH]');
    console.log('');
    console.log('  ROOM_PATH   Path to room directory (default: ./room)');
    console.log('');
    console.log('Outputs the chat panel HTML with room-specific schema to stdout.');
    console.log('Pipe to file: node scripts/generate-chat-embed.cjs ./room > chat.html');
    process.exit(0);
  }

  const roomDir = path.resolve(args[0] || './room');

  if (!fs.existsSync(roomDir) || !fs.statSync(roomDir).isDirectory()) {
    process.stderr.write('Error: Room directory not found: ' + roomDir + '\n');
    process.exit(1);
  }

  const html = generateChatEmbed(roomDir);
  process.stdout.write(html);
}

module.exports = { generateChatEmbed, generateChatSnippet, buildRoomSchema };
