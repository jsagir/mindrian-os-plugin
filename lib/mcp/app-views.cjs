'use strict';

/**
 * MindrianOS MCP App Views -- Phase 60
 *
 * Registers 3 MCP App tools + ui:// resources for inline Data Room
 * rendering in Claude Desktop and Cowork:
 *
 *   1. room-dashboard  -- De Stijl Mondrian grid overview
 *   2. room-wiki       -- Section browser with navigation
 *   3. room-graph      -- Cytoscape.js knowledge graph
 *
 * Each tool returns room data as JSON. Each has a ui:// resource with
 * self-contained HTML (De Stijl style, vanilla JS, Cytoscape via CDN).
 *
 * Bidirectional: HTML templates use postMessage JSON-RPC to call back
 * to MCP tools for on-demand data refresh (APP-06).
 *
 * Requirements: APP-01, APP-02, APP-03, APP-04, APP-05, APP-06
 */

const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } = require('@modelcontextprotocol/ext-apps/server');

// -- HTML template loader --

const TEMPLATE_DIR = path.join(__dirname, 'app-html');

function loadTemplate(filename) {
  const filePath = path.join(TEMPLATE_DIR, filename);
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    return `<html><body><p>Template not found: ${filename}</p></body></html>`;
  }
}

// -- Room data helpers --

const SKIP_DIRS = new Set(['.lazygraph', '.sparks', '.snapshots', '.mindrian', '.context', '.graph',
  'meetings', 'team', 'exports', 'assets', 'personas', 'intelligence']);
const SKIP_FILES = new Set([
  'ROOM.md', 'STATE.md', 'MINTO.md', 'USER.md', 'JTBD.md',
  'ROOM-INTELLIGENCE.md', 'MEETINGS-INTELLIGENCE.md',
  'action-items.md', 'assumptions.json', 'ASSET_MANIFEST.md'
]);

const SECTION_COLORS = {
  'problem-definition': '#A63D2F',
  'market-analysis': '#C8A43C',
  'solution-design': '#5C5A56',
  'business-model': '#2D6B4A',
  'competitive-analysis': '#B5602A',
  'team-execution': '#1E3A6E',
  'legal-ip': '#6B4E8B',
  'financial-model': '#2A6B5E',
  'opportunity-bank': '#C87137',
  'funding-strategy': '#3A7B5E',
  'literature': '#C8A43C',
  'clinical-pathway': '#2A6B5E'
};

function parseFrontmatter(content) {
  const fm = {};
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return fm;
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      fm[key] = val;
    }
  }
  return fm;
}

function extractTitle(content, filePath) {
  const h1 = content.match(/^# (.+)$/m);
  return h1 ? h1[1].trim() : path.basename(filePath, '.md');
}

function extractBody(content) {
  let body = content.replace(/^---\n[\s\S]*?\n---\n?/, '');
  body = body.replace(/^# .+\n?/, '');
  return body.trim();
}

/**
 * Scan room directory and return structured data for all views.
 */
function scanRoomData(roomDir) {
  const result = {
    name: path.basename(roomDir),
    stage: 'Discovery',
    subtitle: '',
    sections: [],
    stats: { section_count: 0, entry_count: 0, thread_count: 0 },
    threads: [],
    graphNodes: [],
    graphEdges: []
  };

  // Read STATE.md
  const stateFile = path.join(roomDir, 'STATE.md');
  if (fs.existsSync(stateFile)) {
    const content = fs.readFileSync(stateFile, 'utf-8');
    const fm = parseFrontmatter(content);
    if (fm.venture_name) result.name = fm.venture_name;
    else if (fm.room_name) result.name = fm.room_name;
    else if (fm.name) result.name = fm.name;
    if (fm.venture_stage) result.stage = fm.venture_stage;
    else if (fm.stage) result.stage = fm.stage;
    if (fm.subtitle) result.subtitle = fm.subtitle;
    else if (fm.description) result.subtitle = fm.description;
  }

  // Scan sections
  let dirEntries;
  try { dirEntries = fs.readdirSync(roomDir, { withFileTypes: true }); }
  catch (_) { dirEntries = []; }

  for (const entry of dirEntries) {
    if (!entry.isDirectory()) continue;
    const dirName = entry.name;
    if (dirName.startsWith('.') || SKIP_DIRS.has(dirName)) continue;

    const sectionDir = path.join(roomDir, dirName);
    const articles = [];

    try {
      const files = fs.readdirSync(sectionDir).filter(f => f.endsWith('.md') && !SKIP_FILES.has(f));
      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(sectionDir, file), 'utf-8');
          const fm = parseFrontmatter(content);
          articles.push({
            filename: file,
            title: extractTitle(content, file),
            body: extractBody(content),
            frontmatter: fm,
            section: dirName
          });
        } catch (_) {}
      }
    } catch (_) {}

    const label = dirName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const color = SECTION_COLORS[dirName] || '#4A7BC8';

    result.sections.push({
      id: dirName,
      label,
      color,
      entryCount: articles.length,
      articles
    });

    // Graph: section node
    result.graphNodes.push({
      data: { id: dirName, label, color, type: 'section' }
    });

    // Graph: entry nodes + edges to section
    for (const art of articles) {
      const nodeId = `${dirName}/${art.filename}`;
      result.graphNodes.push({
        data: { id: nodeId, label: art.title, color, type: 'entry' }
      });
      result.graphEdges.push({
        data: { source: dirName, target: nodeId, type: 'BELONGS_TO' }
      });
    }
  }

  result.stats.section_count = result.sections.length;
  result.stats.entry_count = result.sections.reduce((sum, s) => sum + s.entryCount, 0);

  // Load threads from LazyGraph if available
  const threadsFile = path.join(roomDir, '.mindrian', 'threads.json');
  if (fs.existsSync(threadsFile)) {
    try {
      const threads = JSON.parse(fs.readFileSync(threadsFile, 'utf-8'));
      if (Array.isArray(threads)) {
        result.threads = threads;
        result.stats.thread_count = threads.length;
        for (const t of threads) {
          result.graphEdges.push({
            data: {
              source: t.source || t.from,
              target: t.target || t.to,
              type: t.type || t.label || 'INFORMS'
            }
          });
        }
      }
    } catch (_) {}
  }

  // Also check SQLite causal export
  const causalExport = path.join(roomDir, '.mindrian/causal-export.json');
  if (fs.existsSync(causalExport)) {
    try {
      const data = JSON.parse(fs.readFileSync(causalExport, 'utf-8'));
      if (data.nodes) {
        for (const n of data.nodes) {
          const exists = result.graphNodes.some(gn => gn.data.id === n.id);
          if (!exists) {
            result.graphNodes.push({ data: { id: n.id, label: n.label || n.id, color: n.color || '#4A7BC8', type: n.type || 'concept' } });
          }
        }
      }
      if (data.edges) {
        for (const e of data.edges) {
          result.graphEdges.push({ data: { source: e.source, target: e.target, type: e.type || 'INFORMS' } });
        }
        result.stats.thread_count = Math.max(result.stats.thread_count, data.edges.length);
      }
    } catch (_) {}
  }

  return result;
}

// -- Registration --

/**
 * Register all 3 MCP App views on the server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {string} roomDir
 */
function registerAppViews(server, roomDir) {
  // -- 1. Dashboard --
  const dashboardUri = 'ui://mindrian-os/room-dashboard';

  registerAppTool(server, 'room-dashboard', {
    title: 'Data Room Dashboard',
    description: 'De Stijl Mondrian grid dashboard showing room sections, entry counts, stage, and health overview. Read-only. Rendered inline in Desktop/Cowork.',
    schema: z.object({
      room_path: z.string().optional().describe('Path to room directory (uses server default if omitted)')
    }),
    _meta: { ui: { resourceUri: dashboardUri } }
  }, async (args) => {
    const dir = args.room_path || roomDir;
    const data = scanRoomData(dir);
    return {
      content: [{ type: 'text', text: JSON.stringify(data) }]
    };
  });

  registerAppResource(server, dashboardUri, dashboardUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => ({
      contents: [{ uri: dashboardUri, mimeType: RESOURCE_MIME_TYPE, text: loadTemplate('dashboard.html') }]
    })
  );

  // -- 2. Wiki --
  const wikiUri = 'ui://mindrian-os/room-wiki';

  registerAppTool(server, 'room-wiki', {
    title: 'Data Room Wiki',
    description: 'Browse room sections and articles as navigable wiki pages. Click sections to view entries, search across all content. Rendered inline.',
    schema: z.object({
      room_path: z.string().optional().describe('Path to room directory'),
      section: z.string().optional().describe('Jump to a specific section')
    }),
    _meta: { ui: { resourceUri: wikiUri } }
  }, async (args) => {
    const dir = args.room_path || roomDir;
    const data = scanRoomData(dir);
    if (args.section) {
      data._activeSection = args.section;
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(data) }]
    };
  });

  registerAppResource(server, wikiUri, wikiUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => ({
      contents: [{ uri: wikiUri, mimeType: RESOURCE_MIME_TYPE, text: loadTemplate('wiki.html') }]
    })
  );

  // -- 3. Graph --
  const graphUri = 'ui://mindrian-os/room-graph';

  registerAppTool(server, 'room-graph', {
    title: 'Knowledge Graph',
    description: 'Interactive Cytoscape.js knowledge graph showing room sections, entries, and cross-references with De Stijl styling. Filter by thread type.',
    schema: z.object({
      room_path: z.string().optional().describe('Path to room directory'),
      layout: z.enum(['cose', 'circle', 'grid', 'breadthfirst']).optional().describe('Graph layout algorithm')
    }),
    _meta: { ui: { resourceUri: graphUri } }
  }, async (args) => {
    const dir = args.room_path || roomDir;
    const data = scanRoomData(dir);
    if (args.layout) {
      data._layout = args.layout;
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(data) }]
    };
  });

  registerAppResource(server, graphUri, graphUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => ({
      contents: [{ uri: graphUri, mimeType: RESOURCE_MIME_TYPE, text: loadTemplate('graph.html') }]
    })
  );

  process.stderr.write(`[mindrian-os] MCP Apps registered: room-dashboard, room-wiki, room-graph\n`);
}

module.exports = { registerAppViews, scanRoomData };
