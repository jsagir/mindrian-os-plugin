#!/usr/bin/env node
'use strict';

/**
 * MindrianOS Hub Quick-View Server
 *
 * Serves the SnapshotHub export-template.html LIVE on localhost,
 * injecting fresh ROOM_DATA on every request. Same Mondrian grid,
 * same document view, same graph -- but always current.
 *
 * This is NOT a new dashboard. It's the existing SnapshotHub
 * rendered live instead of as a static export.
 *
 * Usage: node lib/quickview/hub-server.cjs [ROOM_DIR] [PORT]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const http = require('http');

// ── Paths ──

const PLUGIN_ROOT = path.resolve(__dirname, '..', '..');
const TEMPLATE_PATH = path.join(PLUGIN_ROOT, 'dashboard', 'export-template.html');
const GENERATE_SCRIPT = path.join(PLUGIN_ROOT, 'scripts', 'generate-export.cjs');

// ── Section Config (mirrors generate-export.cjs) ──

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
  'funding': '#3A7B5E',
  'personas': '#7B4A8B'
};

const LIGHT_TEXT_SECTIONS = new Set([
  'problem-definition', 'solution-design', 'business-model',
  'team-execution', 'legal-ip', 'financial-model', 'personas'
]);

const SECTION_LABELS = {
  'problem-definition': 'Problem Definition',
  'market-analysis': 'Market Analysis',
  'solution-design': 'Solution Design',
  'business-model': 'Business Model',
  'competitive-analysis': 'Competitive Analysis',
  'team-execution': 'Team & Execution',
  'legal-ip': 'Legal & IP',
  'financial-model': 'Financial Model',
  'opportunity-bank': 'Opportunities',
  'funding': 'Funding',
  'personas': 'Thinking Hats'
};

const SKIP_DIRS = new Set(['.lazygraph', '.mindrian', 'meetings', 'team', 'exports', '.context', '.planning', 'personas']);
const SKIP_FILES = new Set(['ROOM.md', 'STATE.md', 'MINTO.md', 'USER.md',
  'ROOM-INTELLIGENCE.md', 'MEETINGS-INTELLIGENCE.md']);

// ── Room Data Collection ──

function collectRoomData(roomDir) {
  const data = {
    roomName: 'Data Room',
    stage: 'Pre-opportunity',
    generatedDate: new Date().toISOString().split('T')[0],
    updates: [],
    sections: [],
    intelligence: { gaps: [], convergence: [], contradictions: [] },
    graph: { elements: { nodes: [], edges: [] } },
    stats: { artifacts: 0, meetings: 0, speakers: 0, sections: 0, empty: 0 },
  };

  // Read STATE.md -- mirrors generate-export.cjs name resolution
  const statePath = path.join(roomDir, 'STATE.md');
  if (fs.existsSync(statePath)) {
    const content = fs.readFileSync(statePath, 'utf-8');
    const fm = {};
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (fmMatch) {
      for (const line of fmMatch[1].split('\n')) {
        const idx = line.indexOf(':');
        if (idx > 0) fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      }
    }
    // Name: try venture_name, room_name, name, then parent dir, then H1
    if (fm.venture_name) data.roomName = fm.venture_name;
    else if (fm.room_name) data.roomName = fm.room_name;
    else if (fm.name) data.roomName = fm.name;
    else {
      // Fallback: parent directory name (cleaned up)
      const dirName = path.basename(path.dirname(roomDir));
      if (dirName && dirName !== '.' && dirName !== '/') {
        data.roomName = dirName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      }
      // Fallback: H1 heading
      const h1 = content.match(/^# (.+)$/m);
      if (h1 && data.roomName === 'Data Room') data.roomName = h1[1].trim();
    }
    // Stage
    if (fm.venture_stage) data.stage = fm.venture_stage;
    else if (fm.stage) data.stage = fm.stage;
    // Room ID (for multi-room tracking)
    data.roomId = fm.room_id || fm.id || path.basename(roomDir);
  }

  // Scan sections
  let totalArtifacts = 0;
  const entries = fs.readdirSync(roomDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue;

    const sectionDir = path.join(roomDir, entry.name);
    const sectionId = entry.name;
    const label = SECTION_LABELS[sectionId] || sectionId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const color = SECTION_COLORS[sectionId] || '#5C5A56';
    const lightText = LIGHT_TEXT_SECTIONS.has(sectionId);

    // Collect artifacts
    const artifacts = [];
    try {
      const files = fs.readdirSync(sectionDir)
        .filter(f => f.endsWith('.md') && !SKIP_FILES.has(f))
        .sort();

      for (const file of files) {
        const filePath = path.join(sectionDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');

        // Parse frontmatter
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        const fm = {};
        if (fmMatch) {
          for (const line of fmMatch[1].split('\n')) {
            const idx = line.indexOf(':');
            if (idx > 0) fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
          }
        }

        // Extract title
        const titleMatch = content.match(/^# (.+)$/m);
        const title = titleMatch ? titleMatch[1].trim() : file.replace('.md', '');

        // Extract first paragraph as summary (strip markdown syntax)
        const bodyStart = fmMatch ? content.indexOf('---', 4) + 3 : 0;
        const body = content.slice(bodyStart).trim();
        const firstPara = body.split('\n\n').find(p => {
          const t = p.trim();
          // Skip headings, tables, frontmatter-like lines, metadata lines, empty
          return t && !t.startsWith('#') && !t.startsWith('|') && !t.startsWith('---')
            && !t.match(/^\*?\*?(?:Filed|Source|Category|Reference|Cross-reference|Depends on|Full (?:paper|reference)):?\*?\*?:/i);
        });
        // Clean markdown syntax from summary
        const rawSummary = firstPara ? firstPara.trim() : '';
        const summary = rawSummary
          .replace(/\*\*([^*]+)\*\*/g, '$1')    // strip bold
          .replace(/\*([^*]+)\*/g, '$1')         // strip italic
          .replace(/`([^`]+)`/g, '$1')           // strip code
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // strip links, keep text
          .replace(/^>\s*/gm, '')                // strip blockquote markers
          .replace(/^[-*]\s+/gm, '')             // strip list markers
          .replace(/\s+/g, ' ')                  // collapse whitespace
          .trim()
          .slice(0, 180);

        // Extract links: internal cross-references and external citations
        const internalLinks = [];  // [[section/file]] or references to other room sections
        const externalLinks = [];  // [text](https://...) URLs
        const citations = [];      // "Source:", "Reference:", "Cross-reference:" lines

        // Markdown links: [text](url)
        const mdLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
        let linkMatch;
        while ((linkMatch = mdLinkRegex.exec(body)) !== null) {
          externalLinks.push({ text: linkMatch[1], url: linkMatch[2] });
        }

        // Bare URLs
        const bareUrlRegex = /(?<!\()(https?:\/\/[^\s)>\]]+)/g;
        while ((linkMatch = bareUrlRegex.exec(body)) !== null) {
          if (!externalLinks.some(l => l.url === linkMatch[1])) {
            externalLinks.push({ text: linkMatch[1].replace(/^https?:\/\//, '').slice(0, 60), url: linkMatch[1] });
          }
        }

        // Internal cross-references: mentions of other section names or RESEARCH_NN files
        for (const otherSection of Object.keys(SECTION_LABELS)) {
          if (otherSection !== sectionId && body.toLowerCase().includes(otherSection)) {
            internalLinks.push({ section: otherSection, label: SECTION_LABELS[otherSection] || otherSection });
          }
        }
        // Cross-ref patterns: "RESEARCH_14", "room/solution-design/", etc.
        const crossRefRegex = /RESEARCH_(\d+)[_\w]*/g;
        while ((linkMatch = crossRefRegex.exec(body)) !== null) {
          internalLinks.push({ section: 'research', label: linkMatch[0] });
        }

        // Citation lines: "Source:", "Reference:", "Cross-reference:", "Filed:", "Depends on:"
        const citationRegex = /^(?:\*?\*?(?:Source|Reference|Cross-reference|Filed|Depends on|Full (?:paper|reference|analysis)):?\*?\*?:?\s*)(.+)$/gm;
        while ((linkMatch = citationRegex.exec(body)) !== null) {
          citations.push(linkMatch[1].trim());
        }

        artifacts.push({
          id: file.replace('.md', ''),
          title,
          summary,
          content: body,
          frontmatter: fm,
          date: fm.created || fm.date || null,
          methodology: fm.methodology || null,
          links: {
            internal: internalLinks,
            external: externalLinks.slice(0, 20),  // cap at 20 to control payload size
            citations: citations.slice(0, 10),
          },
        });
      }
    } catch (e) { /* empty section */ }

    data.sections.push({
      id: sectionId,
      label,
      color,
      lightText,
      entryCount: artifacts.length,
      summary: artifacts.length > 0 ? artifacts[0].summary : '',
      artifacts,
    });

    totalArtifacts += artifacts.length;
    data.stats.sections++;
    if (artifacts.length === 0) data.stats.empty++;
  }

  data.stats.artifacts = totalArtifacts;

  // Add expected-but-missing sections as empty gaps
  const existingIds = new Set(data.sections.map(s => s.id));
  for (const [sectionId, label] of Object.entries(SECTION_LABELS)) {
    if (!existingIds.has(sectionId)) {
      data.sections.push({
        id: sectionId,
        label,
        color: SECTION_COLORS[sectionId] || '#5C5A56',
        lightText: LIGHT_TEXT_SECTIONS.has(sectionId),
        entryCount: 0,
        summary: '',
        artifacts: [],
      });
      data.stats.sections++;
      data.stats.empty++;
    }
  }

  // Count meetings
  const meetingsDir = path.join(roomDir, 'meetings');
  if (fs.existsSync(meetingsDir)) {
    data.stats.meetings = fs.readdirSync(meetingsDir, { withFileTypes: true })
      .filter(d => d.isDirectory()).length;
  }

  // Build intelligence (format must match export-template.html buildIntelligence())
  // Gaps: {section, message, severity}
  for (const s of data.sections) {
    if (s.entryCount === 0) {
      data.intelligence.gaps.push({
        section: s.label,
        message: `${s.label} is empty -- highest-priority structural gap`,
        severity: 'HIGH',
      });
    } else if (s.entryCount === 1) {
      data.intelligence.gaps.push({
        section: s.label,
        message: `${s.label} has only 1 entry -- single-lens risk`,
        severity: 'MEDIUM',
      });
    }
  }

  // Convergence: look for themes appearing in 3+ sections
  const themeCounts = {};
  for (const s of data.sections) {
    for (const a of s.artifacts) {
      const words = (a.title + ' ' + (a.summary || '')).toLowerCase().split(/\W+/);
      for (const w of words) {
        if (w.length > 5) {
          if (!themeCounts[w]) themeCounts[w] = new Set();
          themeCounts[w].add(s.id);
        }
      }
    }
  }
  for (const [theme, sections] of Object.entries(themeCounts)) {
    if (sections.size >= 3) {
      data.intelligence.convergence.push(theme);
    }
  }
  // Keep top 8 convergence themes
  data.intelligence.convergence = data.intelligence.convergence.slice(0, 8);

  // Build graph nodes from sections + artifacts
  const nodes = [];
  const edges = [];

  for (const s of data.sections) {
    // Section node
    nodes.push({
      data: {
        id: s.id,
        label: s.label,
        color: s.color,
        section: s.id,
        layer: 'section',
        entryCount: s.entryCount,
      },
      classes: 'section-group'
    });

    // Artifact nodes
    for (const a of s.artifacts) {
      const nodeId = `${s.id}--${a.id}`;
      nodes.push({
        data: {
          id: nodeId,
          label: a.title,
          color: s.color,
          section: s.id,
          layer: 'content',
          methodology: a.methodology,
        },
        classes: 'artifact'
      });

      // Edge from section to artifact
      edges.push({
        data: {
          id: `e-${s.id}-${nodeId}`,
          source: s.id,
          target: nodeId,
          edgeType: 'CONTAINS',
        }
      });
    }
  }

  // Cross-section edges (simple keyword matching)
  for (let i = 0; i < data.sections.length; i++) {
    for (let j = i + 1; j < data.sections.length; j++) {
      const a = data.sections[i];
      const b = data.sections[j];
      if (a.entryCount > 0 && b.entryCount > 0) {
        // Check if any artifact in A references section B's label
        const aText = a.artifacts.map(x => x.content).join(' ').toLowerCase();
        const bLabel = b.label.toLowerCase();
        if (aText.includes(bLabel) || aText.includes(b.id)) {
          edges.push({
            data: {
              id: `e-cross-${a.id}-${b.id}`,
              source: a.id,
              target: b.id,
              edgeType: 'INFORMS',
            }
          });
        }
      }
    }
  }

  data.graph = { elements: { nodes, edges } };

  return data;
}

// ── Template Injection ──

function injectRoomData(template, roomData) {
  // Replace the ROOM_DATA placeholder with live data
  // CRITICAL: escape </script> to prevent XSS breakout from artifact content
  const jsonStr = JSON.stringify(roomData).replace(/<\/script>/gi, '<\\/script>');

  // The template has: var ROOM_DATA = /*ROOM_DATA_PLACEHOLDER*/{...};
  // Replace everything between /*ROOM_DATA_PLACEHOLDER*/ and the next semicolon
  let html = template.replace(
    /var ROOM_DATA = \/\*ROOM_DATA_PLACEHOLDER\*\/[^;]+;/,
    `var ROOM_DATA = ${jsonStr};`
  );

  // Inject content script blocks for the document view
  // The template's openDoc() reads from <script id="content-{sectionId}" type="text/markdown">
  const contentScripts = (roomData.sections || []).map(section => {
    if (!section.artifacts || section.artifacts.length === 0) return '';
    // Combine all artifacts in the section into one content block with separators
    const combined = section.artifacts.map(a => {
      const header = `# ${a.title}\n`;
      const meta = a.frontmatter ? Object.entries(a.frontmatter)
        .map(([k, v]) => `**${k}:** ${v}`).join('  \n') + '\n\n' : '';
      return header + meta + (a.content || '');
    }).join('\n\n---\n\n');
    const safe = combined.replace(/<\/script>/gi, '<\\/script>');
    return `<script id="content-${section.id}" type="text/markdown">${safe}</script>`;
  }).filter(Boolean).join('\n');

  html = html.replace('<!-- CONTENT_SCRIPTS_PLACEHOLDER -->', contentScripts);

  // Update the title
  html = html.replace(
    /<title>MindrianOS Data Room<\/title>/,
    `<title>${roomData.roomName} -- MindrianOS Live View</title>`
  );

  // Add internal hyperlink wiring + citation rendering + live-reload before </body>
  const internalLinksScript = `
<script>
// Wire internal cross-references as clickable links in document view
(function() {
  var SECTION_IDS = ${JSON.stringify(Object.keys(SECTION_LABELS))};
  var origOpenDoc = window.openDoc;

  // After marked.parse renders the doc body, post-process for internal links
  var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      if (m.target.id !== 'doc-body') return;
      var body = m.target;

      // 1. Make section references clickable
      SECTION_IDS.forEach(function(sid) {
        var label = sid.replace(/-/g, ' ');
        // Find text nodes containing section names (case-insensitive)
        var walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, null, false);
        var textNode;
        while ((textNode = walker.nextNode())) {
          var re = new RegExp('(' + sid + '|' + label + ')', 'gi');
          if (re.test(textNode.nodeValue) && textNode.parentNode.tagName !== 'A') {
            var span = document.createElement('span');
            span.innerHTML = textNode.nodeValue.replace(re,
              '<a href="#" class="internal-ref" data-section="' + sid + '" style="color:var(--mondrian-blue);text-decoration:underline;cursor:pointer;">$1</a>'
            );
            textNode.parentNode.replaceChild(span, textNode);
          }
        }
      });

      // 2. Make RESEARCH_XX references clickable (link to solution-design section)
      body.querySelectorAll('*').forEach(function(el) {
        if (el.children.length === 0 && el.tagName !== 'A' && el.textContent.match(/RESEARCH_\\d+/)) {
          el.innerHTML = el.innerHTML.replace(/(RESEARCH_\\d+[\\w_]*)/g,
            '<a href="#" class="internal-ref" data-section="solution-design" style="color:var(--mondrian-blue);text-decoration:underline;cursor:pointer;">$1</a>'
          );
        }
      });

      // 3. Style citation lines
      body.querySelectorAll('p, li').forEach(function(el) {
        if (/^\\*?\\*?(?:Source|Reference|Cross-reference|Filed|Depends on|Full (?:paper|reference|analysis)):/.test(el.textContent)) {
          el.style.borderLeft = '3px solid var(--mondrian-yellow, #E8B931)';
          el.style.paddingLeft = '12px';
          el.style.fontSize = '13px';
          el.style.color = 'rgba(26,26,26,0.6)';
          el.style.fontFamily = '"JetBrains Mono", monospace';
        }
      });

      // 4. Ensure all external links open in new tab
      body.querySelectorAll('a[href^="http"]').forEach(function(a) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener');
      });
    });
  });

  observer.observe(document.getElementById('doc-body') || document.body, { childList: true, subtree: true });

  // Handle clicks on internal references
  document.addEventListener('click', function(e) {
    var ref = e.target.closest('.internal-ref');
    if (ref) {
      e.preventDefault();
      var section = ref.getAttribute('data-section');
      if (section && typeof openDoc === 'function') openDoc(section);
    }
  });
})();
</script>`;

  html = html.replace('</body>', internalLinksScript + '\n</body>');

  // Add live-reload script before </body>
  const liveReloadScript = `
<script>
// Live reload: check for changes every 8 seconds
(function() {
  var lastHash = '';
  setInterval(async function() {
    try {
      var res = await fetch('/api/hash');
      var data = await res.json();
      if (lastHash && data.hash !== lastHash) {
        window.location.reload();
      }
      lastHash = data.hash;
    } catch(e) {}
  }, 8000);
})();
</script>`;

  html = html.replace('</body>', liveReloadScript + '\n</body>');

  return html;
}

// ── Content Hash (for live reload detection) ──

function computeHash(roomDir) {
  // Simple hash based on file modification times
  let hash = '';
  try {
    const walk = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.name.startsWith('.')) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory() && !SKIP_DIRS.has(e.name)) {
          walk(full);
        } else if (e.isFile() && e.name.endsWith('.md')) {
          const stat = fs.statSync(full);
          hash += stat.mtimeMs.toString(36);
        }
      }
    };
    walk(roomDir);
  } catch (e) {
    process.stderr.write(`Warning: hash computation failed: ${e.message}\n`);
  }
  // Simple string hash
  let h = 0;
  for (let i = 0; i < hash.length; i++) {
    h = ((h << 5) - h + hash.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

// ── HTTP Server ──

function startServer(roomDir, port) {
  // Read template once (it doesn't change)
  if (!fs.existsSync(TEMPLATE_PATH)) {
    process.stderr.write(`Template not found: ${TEMPLATE_PATH}\n`);
    process.exit(1);
  }
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');

  const server = http.createServer((req, res) => {
    // API: room data as JSON
    if (req.url === '/api/state') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(collectRoomData(roomDir)));
      return;
    }

    // API: content hash for live reload
    if (req.url === '/api/hash') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ hash: computeHash(roomDir) }));
      return;
    }

    // API: available actions per section
    if (req.url === '/api/actions') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({
        section: [
          { id: 'analyze', label: 'Analyze', icon: '>', cmd: '/mos:reason', desc: 'Run Minto/MECE structured reasoning' },
          { id: 'grade', label: 'Grade', icon: '*', cmd: '/mos:grade', desc: 'Score problem discovery quality' },
          { id: 'diagnose', label: 'Diagnose', icon: '?', cmd: '/mos:diagnose', desc: 'Classify problem type and match methodology' },
          { id: 'hats', label: '6 Hats', icon: '#', cmd: '/mos:think-hats', desc: 'Force perspective shifts' },
        ],
        room: [
          { id: 'status', label: 'Status', icon: '>', cmd: '/mos:status', desc: 'Room state and next steps' },
          { id: 'suggest', label: 'Suggest Next', icon: '>', cmd: '/mos:suggest-next', desc: 'What should you work on next' },
          { id: 'grade-room', label: 'Deep Grade', icon: '*', cmd: '/mos:deep-grade', desc: 'Full venture assessment' },
          { id: 'export', label: 'Export', icon: '>', cmd: '/mos:export', desc: 'Generate professional export' },
        ]
      }));
      return;
    }

    // API: execute a CLI command (POST)
    if (req.url === '/api/command' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { command, section } = JSON.parse(body);
          // Sanitize: only allow /mos: commands
          if (!command || !command.startsWith('/mos:')) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Only /mos: commands are allowed' }));
            return;
          }

          // Build the CLI invocation
          const sectionArg = section || '';

          // Respond immediately with JSON (not SSE)
          // Generate a clipboard-ready command the user can paste into their CLI
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          });

          // For sections with content, include a quick summary
          const roomData = collectRoomData(roomDir);
          const targetSection = roomData.sections.find(s => s.id === sectionArg);
          const sectionInfo = targetSection
            ? `${targetSection.label}: ${targetSection.entryCount} artifact(s). ${targetSection.summary || 'No summary.'}`
            : 'Room-level command.';

          // Generate the CLI command to copy
          const cliCommand = sectionArg
            ? `${command} on the ${sectionArg} section`
            : command;

          // Quick analysis based on room data
          let quickAnalysis = '';
          if (targetSection && targetSection.artifacts.length > 0) {
            quickAnalysis = `\n\nSection: ${targetSection.label}\n`;
            quickAnalysis += `Artifacts: ${targetSection.entryCount}\n`;
            quickAnalysis += `---\n`;
            targetSection.artifacts.forEach(a => {
              quickAnalysis += `\n## ${a.title}\n`;
              if (a.summary) quickAnalysis += `${a.summary}\n`;
              if (a.frontmatter && a.frontmatter.methodology) quickAnalysis += `Methodology: ${a.frontmatter.methodology}\n`;
            });
          } else if (!targetSection || targetSection.entryCount === 0) {
            quickAnalysis = `\n\nThis section is empty -- a structural gap.\nRun the command in your CLI to start filling it.`;
          }

          res.end(JSON.stringify({
            command: cliCommand,
            section: sectionInfo,
            analysis: quickAnalysis,
            clipboardCmd: cliCommand,
            message: 'Paste this command in your Claude Code CLI to run the full analysis.',
          }));

        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // CORS preflight for API
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }

    // Serve the SnapshotHub template with live data
    const roomData = collectRoomData(roomDir);
    const html = injectRoomData(template, roomData);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });

  // CRITICAL: handle port-in-use before listen
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      process.stderr.write(`Port ${port} is already in use. Try: node hub-server.cjs "${roomDir}" ${port + 1}\n`);
      process.exit(1);
    }
    throw err;
  });

  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    process.stderr.write(`\n  MindrianOS Live Hub: ${url}\n`);
    process.stderr.write(`  Room: ${roomDir}\n`);
    process.stderr.write(`  Auto-refreshes when files change\n\n`);

    // Auto-open browser (use execFileSync to prevent command injection)
    const { platform } = process;
    const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
    try { require('child_process').execFileSync(cmd, [url], { stdio: 'ignore' }); } catch (e) { /* no browser */ }
  });

  return server;
}

// ── CLI Entry ──

if (require.main === module) {
  const roomDir = path.resolve(process.argv[2] || path.join(process.cwd(), 'room'));
  const port = parseInt(process.argv[3] || '8450', 10);

  if (!fs.existsSync(roomDir)) {
    process.stderr.write(`Room not found: ${roomDir}\n`);
    process.exit(1);
  }

  startServer(roomDir, port);
}

module.exports = { startServer, collectRoomData };
