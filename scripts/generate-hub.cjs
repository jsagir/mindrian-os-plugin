#!/usr/bin/env node
'use strict';

/**
 * MindrianOS -- Single-File SnapshotHub Generator
 *
 * Generates a standalone HTML hub from any room/ directory.
 * Output is a single self-contained file with all CSS inline,
 * De Stijl design system, sticky tab navigation, and card-based
 * article rendering.
 *
 * Usage:
 *   node scripts/generate-hub.cjs ./room
 *   node scripts/generate-hub.cjs ./room --output ./my-export.html
 *
 * Zero npm dependencies -- uses only Node.js built-ins.
 */

const fs = require('fs');
const path = require('path');

// ── Constants ──

const SKIP_FILES = new Set([
  'ROOM.md', 'STATE.md', 'TEAM-STATE.md', 'USER.md',
  'MINTO.md', 'JTBD.md', 'ROOM-INTELLIGENCE.md',
  'MEETINGS-INTELLIGENCE.md', 'action-items.md',
  'assumptions.json', 'ASSET_MANIFEST.md'
]);

const SKIP_DIRS = new Set([
  '.lazygraph', '.sparks', '.snapshots', 'exports', 'assets', 'personas'
]);

// Standard sections in display order
const STANDARD_SECTIONS = [
  'problem-definition',
  'market-analysis',
  'solution-design',
  'business-model',
  'competitive-analysis',
  'team-execution',
  'legal-ip',
  'financial-model',
  'meetings',
  'team'
];

const TAB_NAMES = {
  'problem-definition': 'Problem',
  'market-analysis': 'Market',
  'solution-design': 'Solution',
  'business-model': 'Business Model',
  'competitive-analysis': 'Competition',
  'team-execution': 'Execution',
  'legal-ip': 'Legal & IP',
  'financial-model': 'Financial',
  'meetings': 'Meetings',
  'team': 'Team',
  'product': 'Product',
  'ip': 'IP',
  'decisions': 'Decisions',
  'beta-testing': 'Beta Testing',
  'product-evolution': 'Evolution',
  'tech-stack': 'Tech Stack'
};

const SECTION_COLORS = {
  'problem-definition': 'var(--red)',
  'market-analysis': 'var(--yellow)',
  'solution-design': 'var(--gray-700)',
  'business-model': 'var(--teal)',
  'competitive-analysis': '#B5602A',
  'team-execution': 'var(--blue)',
  'legal-ip': '#6B4E8B',
  'financial-model': 'var(--teal)',
  'product': 'var(--blue)',
  'ip': '#6B4E8B',
  'decisions': 'var(--red)',
  'beta-testing': 'var(--teal)',
  'product-evolution': 'var(--yellow)',
  'tech-stack': 'var(--gray-700)',
  'meetings': 'var(--blue)',
  'team': 'var(--blue)'
};

const SECTION_COLOR_CLASSES = {
  'problem-definition': 'red',
  'market-analysis': 'yellow',
  'solution-design': 'gray',
  'business-model': 'teal',
  'competitive-analysis': 'orange',
  'team-execution': 'blue',
  'legal-ip': 'purple',
  'financial-model': 'teal',
  'product': 'blue',
  'ip': 'purple',
  'decisions': 'red',
  'beta-testing': 'teal',
  'product-evolution': 'yellow',
  'tech-stack': 'gray',
  'meetings': 'blue',
  'team': 'blue'
};

const DEFAULT_COLOR = 'var(--gray-500)';

// ── Helpers ──

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
  const match = content.match(/^# (.+)$/m);
  return match ? match[1].trim() : path.basename(filePath, '.md');
}

function extractBody(content) {
  let body = content.replace(/^---\n[\s\S]*?\n---\n?/, '');
  body = body.replace(/^# .+\n?/, '');
  return body.trim();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toTabName(dirName) {
  if (TAB_NAMES[dirName]) return TAB_NAMES[dirName];
  return dirName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function toSectionId(dirName) {
  return 'section-' + dirName;
}

function getSectionColor(dirName) {
  return SECTION_COLORS[dirName] || DEFAULT_COLOR;
}

function getSectionColorClass(dirName) {
  return SECTION_COLOR_CLASSES[dirName] || 'default';
}

function formatDate(d) {
  const months = ['January','February','March','April','May','June',
    'July','August','September','October','November','December'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/**
 * Basic markdown to HTML conversion.
 * Handles headings, bold, italic, code, lists, tables, blockquotes, links, paragraphs.
 */
function markdownToHtml(md) {
  if (!md) return '';

  const lines = md.split('\n');
  const output = [];
  let inList = false;
  let inTable = false;
  let inBlockquote = false;
  let paragraph = [];

  function flushParagraph() {
    if (paragraph.length > 0) {
      const text = paragraph.join(' ');
      if (text.trim()) {
        output.push('<p>' + inlineFormat(text) + '</p>');
      }
      paragraph = [];
    }
  }

  function inlineFormat(text) {
    // Links [text](url)
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    // Bold **text**
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Italic *text*
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // Inline code `text`
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    return text;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line
    if (trimmed === '') {
      flushParagraph();
      if (inList) { output.push('</ul>'); inList = false; }
      if (inTable) { output.push('</tbody></table>'); inTable = false; }
      if (inBlockquote) { output.push('</blockquote>'); inBlockquote = false; }
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      if (inList) { output.push('</ul>'); inList = false; }
      // Map: # -> h3, ## -> h4, ### -> h5 (within card context)
      const level = Math.min(headingMatch[1].length + 2, 6);
      output.push(`<h${level}>${inlineFormat(headingMatch[2])}</h${level}>`);
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      flushParagraph();
      if (!inBlockquote) {
        output.push('<blockquote>');
        inBlockquote = true;
      }
      output.push(inlineFormat(trimmed.slice(2)));
      continue;
    } else if (inBlockquote) {
      output.push('</blockquote>');
      inBlockquote = false;
    }

    // Unordered list
    if (trimmed.match(/^[-*+]\s+/)) {
      flushParagraph();
      if (!inList) {
        output.push('<ul>');
        inList = true;
      }
      output.push('<li>' + inlineFormat(trimmed.replace(/^[-*+]\s+/, '')) + '</li>');
      continue;
    } else if (inList && !trimmed.match(/^\s/)) {
      output.push('</ul>');
      inList = false;
    }

    // Table
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushParagraph();
      // Skip separator rows
      if (trimmed.match(/^\|[\s-:|]+\|$/)) continue;

      const cells = trimmed.split('|').filter(c => c.trim() !== '');

      if (!inTable) {
        output.push('<table class="hub-table"><thead><tr>');
        cells.forEach(c => output.push('<th>' + inlineFormat(c.trim()) + '</th>'));
        output.push('</tr></thead><tbody>');
        inTable = true;
      } else {
        output.push('<tr>');
        cells.forEach(c => output.push('<td>' + inlineFormat(c.trim()) + '</td>'));
        output.push('</tr>');
      }
      continue;
    }

    // Regular paragraph text
    paragraph.push(trimmed);
  }

  // Flush remaining
  flushParagraph();
  if (inList) output.push('</ul>');
  if (inTable) output.push('</tbody></table>');
  if (inBlockquote) output.push('</blockquote>');

  return output.join('\n');
}

// ── Room Scanner ──

function scanRoom(roomDir) {
  // 1. Read STATE.md
  let ventureName = path.basename(roomDir);
  let ventureStage = 'Discovery';
  let subtitle = '';
  let firstInsight = '';

  const stateFile = path.join(roomDir, 'STATE.md');
  if (fs.existsSync(stateFile)) {
    const stateContent = fs.readFileSync(stateFile, 'utf-8');
    const fm = parseFrontmatter(stateContent);

    if (fm.venture_name) ventureName = fm.venture_name;
    else if (fm.room_name) ventureName = fm.room_name;
    else if (fm.name) ventureName = fm.name;
    else {
      const h1 = stateContent.match(/^# (.+)$/m);
      if (h1) ventureName = h1[1].replace(/Data Room State/i, '').trim() || ventureName;
    }

    if (fm.venture_stage) ventureStage = fm.venture_stage;
    else if (fm.stage) ventureStage = fm.stage;

    if (fm.subtitle) subtitle = fm.subtitle;
    else if (fm.description) subtitle = fm.description;

    // Extract suggested next action as insight
    const actionMatch = stateContent.match(/## Suggested Next Action\n(.+)/);
    if (actionMatch) firstInsight = actionMatch[1].trim();
  }

  // 2. Discover sections
  const sections = [];
  let totalEntries = 0;
  let meetingsCount = 0;
  let teamCount = 0;

  let dirEntries;
  try {
    dirEntries = fs.readdirSync(roomDir, { withFileTypes: true });
  } catch (_) { dirEntries = []; }

  for (const entry of dirEntries) {
    if (!entry.isDirectory()) continue;
    const dirName = entry.name;
    if (dirName.startsWith('.') || SKIP_DIRS.has(dirName)) continue;

    const sectionDir = path.join(roomDir, dirName);
    const articles = [];

    // Recursive scan
    function scanDir(dir) {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          const fullPath = path.join(dir, e.name);
          if (e.isDirectory() && !e.name.startsWith('.')) {
            scanDir(fullPath);
          } else if (e.isFile() && e.name.endsWith('.md') && !SKIP_FILES.has(e.name)) {
            let title = e.name.replace(/\.md$/, '');
            let body = '';
            let fm = {};
            try {
              const content = fs.readFileSync(fullPath, 'utf-8');
              title = extractTitle(content, e.name);
              body = extractBody(content);
              fm = parseFrontmatter(content);
            } catch (_) { /* filename fallback */ }
            articles.push({ filename: e.name, title, body, frontmatter: fm });
          }
        }
      } catch (_) { /* skip unreadable */ }
    }
    scanDir(sectionDir);

    // Sort articles alphabetically by title
    articles.sort((a, b) => a.title.localeCompare(b.title));

    const count = articles.length;
    totalEntries += count;

    if (dirName === 'meetings') meetingsCount = count;
    if (dirName === 'team') teamCount = count;

    // Only include sections that have articles
    if (count > 0) {
      sections.push({
        id: dirName,
        label: toTabName(dirName),
        color: getSectionColor(dirName),
        colorClass: getSectionColorClass(dirName),
        articleCount: count,
        articles
      });
    }
  }

  // 3. Sort sections: standard first (in DD order), then custom alphabetically
  const standardOrder = new Map(STANDARD_SECTIONS.map((s, i) => [s, i]));
  sections.sort((a, b) => {
    const aStd = standardOrder.has(a.id);
    const bStd = standardOrder.has(b.id);
    if (aStd && bStd) return standardOrder.get(a.id) - standardOrder.get(b.id);
    if (aStd && !bStd) return -1;
    if (!aStd && bStd) return 1;
    return a.id.localeCompare(b.id);
  });

  // 4. Try to get first insight from problem-definition if not from STATE.md
  if (!firstInsight) {
    const probSection = sections.find(s => s.id === 'problem-definition');
    if (probSection && probSection.articles.length > 0) {
      const firstBody = probSection.articles[0].body;
      // Take first sentence as insight
      const firstSentence = firstBody.match(/^([^.!?]+[.!?])/);
      if (firstSentence) firstInsight = firstSentence[1];
    }
  }
  if (!firstInsight) {
    firstInsight = `${ventureName} data room with ${totalEntries} artifacts across ${sections.length} sections.`;
  }

  return {
    ventureName,
    ventureStage,
    subtitle,
    sections,
    totalEntries,
    meetingsCount,
    teamCount,
    firstInsight
  };
}

// ── HTML Generation ──

function generateHtml(room) {
  const now = new Date();
  const dateStr = formatDate(now);
  const pageTitle = escapeHtml(room.ventureName) + ' | MindrianOS SnapshotHub';

  // Build nav tabs
  let navTabs = `<a class="nav-tab" href="#overview">Overview</a>`;
  for (const section of room.sections) {
    navTabs += `\n    <a class="nav-tab" href="#${toSectionId(section.id)}">${escapeHtml(section.label)}</a>`;
  }

  // Build overview tab
  const overviewHtml = buildOverview(room, dateStr);

  // Build section tabs
  let sectionsHtml = '';
  for (const section of room.sections) {
    sectionsHtml += buildSection(section);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${pageTitle}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<style>
:root {
  --red: #A63D2F;
  --blue: #1E3A6E;
  --yellow: #C8A43C;
  --teal: #2A6B5E;
  --cream: #F5F0E8;
  --dark: #1a1a1a;
  --white: #ffffff;
  --gray-100: #f7f7f7;
  --gray-200: #e8e8e8;
  --gray-300: #d4d4d4;
  --gray-500: #888888;
  --gray-700: #444444;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.1);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.12);
  --radius: 8px;
  --radius-lg: 12px;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html { scroll-behavior: smooth; }

body {
  font-family: 'DM Sans', sans-serif;
  color: var(--dark);
  background: var(--gray-100);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

/* -- HEADER -- */
.site-header {
  background: var(--dark);
  color: var(--white);
  padding: 0;
}

.header-mondrian {
  display: flex;
  height: 6px;
}
.header-mondrian span:nth-child(1) { flex: 3; background: var(--red); }
.header-mondrian span:nth-child(2) { flex: 1; background: var(--blue); }
.header-mondrian span:nth-child(3) { flex: 2; background: var(--yellow); }
.header-mondrian span:nth-child(4) { flex: 1; background: var(--teal); }

.header-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 28px 24px 24px;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--gray-500);
}

.header-brand a {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: inherit;
}

.header-title {
  font-size: clamp(28px, 4vw, 40px);
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: 8px;
}

.header-subtitle {
  font-size: 15px;
  color: var(--gray-500);
  font-weight: 400;
}

.header-date {
  font-size: 13px;
  color: var(--gray-500);
  margin-top: 6px;
  font-weight: 400;
}

/* -- NAVIGATION -- */
.site-nav {
  background: var(--white);
  border-bottom: 1px solid var(--gray-200);
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: var(--shadow-sm);
}

.nav-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  gap: 0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.nav-inner::-webkit-scrollbar { height: 0; }

.nav-tab {
  display: inline-block;
  padding: 14px 20px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--gray-700);
  text-decoration: none;
  border-bottom: 3px solid transparent;
  white-space: nowrap;
  transition: all 0.2s;
}

.nav-tab:hover {
  color: var(--blue);
  border-bottom-color: var(--blue);
}

/* -- MAIN -- */
.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px 80px;
}

/* -- SECTIONS -- */
.section {
  padding-top: 48px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 28px;
}

.section-marker {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  flex-shrink: 0;
}

.section-header h2 {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.3px;
}

.section-count {
  font-size: 13px;
  color: var(--gray-500);
  font-weight: 400;
  margin-left: 8px;
}

/* -- CARDS -- */
.card {
  background: var(--white);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  padding: 24px;
  margin-bottom: 16px;
  transition: box-shadow 0.2s;
}

.card:hover { box-shadow: var(--shadow-md); }

.card-bordered {
  border-left: 4px solid var(--gray-300);
}

.card-bordered.red { border-left-color: var(--red); }
.card-bordered.blue { border-left-color: var(--blue); }
.card-bordered.yellow { border-left-color: var(--yellow); }
.card-bordered.teal { border-left-color: var(--teal); }
.card-bordered.orange { border-left-color: #B5602A; }
.card-bordered.purple { border-left-color: #6B4E8B; }
.card-bordered.gray { border-left-color: var(--gray-700); }
.card-bordered.default { border-left-color: var(--gray-500); }

.card-title {
  font-size: 17px;
  font-weight: 700;
  margin-bottom: 4px;
}

.card-subtitle {
  font-size: 13px;
  color: var(--gray-500);
  margin-bottom: 12px;
}

.card-body {
  font-size: 15px;
  line-height: 1.65;
  color: var(--gray-700);
}

.card-body h3 { font-size: 17px; font-weight: 700; margin: 16px 0 8px; }
.card-body h4 { font-size: 15px; font-weight: 700; margin: 14px 0 6px; }
.card-body h5 { font-size: 14px; font-weight: 700; margin: 12px 0 4px; }
.card-body p { margin-bottom: 10px; }
.card-body ul, .card-body ol { padding-left: 20px; margin-bottom: 10px; }
.card-body li { margin-bottom: 4px; }
.card-body code {
  background: var(--cream);
  padding: 1px 5px;
  border-radius: 3px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
}
.card-body blockquote {
  border-left: 3px solid var(--yellow);
  padding: 8px 16px;
  margin: 10px 0;
  background: var(--cream);
  border-radius: 0 var(--radius) var(--radius) 0;
  font-style: italic;
}
.card-body a {
  color: var(--blue);
  text-decoration: none;
}
.card-body a:hover { text-decoration: underline; }

/* -- TABLES -- */
.hub-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  margin: 10px 0;
}
.hub-table th {
  text-align: left;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--gray-500);
  border-bottom: 2px solid var(--gray-200);
}
.hub-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--gray-200);
}
.hub-table tr:hover { background: var(--cream); }

/* -- STATS ROW -- */
.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}

.stat-card {
  background: var(--white);
  border-radius: var(--radius);
  padding: 20px;
  text-align: center;
  box-shadow: var(--shadow-sm);
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
}

.stat-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--gray-500);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 4px;
}

/* -- INSIGHT BOX -- */
.insight-box {
  background: linear-gradient(135deg, var(--dark) 0%, #2a2a2a 100%);
  color: var(--white);
  border-radius: var(--radius-lg);
  padding: 36px 32px;
  margin-bottom: 24px;
  position: relative;
  overflow: hidden;
}

.insight-box::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 6px;
  height: 100%;
  background: linear-gradient(to bottom, var(--yellow), var(--red));
}

.insight-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--yellow);
  margin-bottom: 12px;
}

.insight-text {
  font-size: 20px;
  font-weight: 500;
  line-height: 1.5;
  max-width: 800px;
}

/* -- VENTURE CARD -- */
.venture-card {
  background: var(--white);
  border-radius: var(--radius-lg);
  padding: 28px;
  box-shadow: var(--shadow-md);
  margin-bottom: 24px;
}

.venture-name {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 4px;
}

.venture-stage {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  padding: 4px 12px;
  border-radius: 4px;
  background: var(--cream);
  color: var(--teal);
  margin-bottom: 12px;
}

.venture-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  font-size: 14px;
  color: var(--gray-700);
}

.venture-meta dt {
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--gray-500);
  margin-bottom: 2px;
}

/* -- SECTION SUMMARY -- */
.section-summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.section-summary-item {
  background: var(--white);
  padding: 16px 20px;
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  display: flex;
  align-items: center;
  gap: 12px;
}

.section-summary-dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
}

.section-summary-name {
  font-size: 14px;
  font-weight: 600;
}

.section-summary-count {
  font-size: 13px;
  color: var(--gray-500);
  margin-left: auto;
}

/* -- FOOTER -- */
.site-footer {
  background: var(--dark);
  color: var(--gray-500);
  padding: 32px 24px 0;
  margin-top: 64px;
}

.footer-inner {
  max-width: 1200px;
  margin: 0 auto;
  text-align: center;
  font-size: 13px;
  line-height: 1.8;
  padding-bottom: 24px;
}

.footer-inner a {
  color: var(--yellow);
  text-decoration: none;
}

.footer-inner a:hover { text-decoration: underline; }

.footer-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--white);
  margin-bottom: 4px;
}

.footer-brand a {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: inherit;
}

.footer-mondrian {
  display: flex;
  height: 6px;
}

.footer-mondrian span:nth-child(1) { flex: 2; background: var(--red); }
.footer-mondrian span:nth-child(2) { flex: 1; background: var(--blue); }
.footer-mondrian span:nth-child(3) { flex: 3; background: var(--yellow); }
.footer-mondrian span:nth-child(4) { flex: 1; background: var(--teal); }

/* -- RESPONSIVE -- */
@media (max-width: 768px) {
  .venture-card { grid-template-columns: 1fr; }
  .section-summary-grid { grid-template-columns: 1fr; }
  .stats-row { grid-template-columns: repeat(2, 1fr); }
}

/* -- PRINT -- */
@media print {
  .site-nav { display: none; }
  .section { page-break-inside: avoid; }
  .card { box-shadow: none; border: 1px solid var(--gray-200); }
  body { background: white; }
}

/* -- ANIMATIONS -- */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.section {
  animation: fadeUp 0.4s ease both;
}
</style>
</head>
<body>

<!-- HEADER -->
<header class="site-header">
  <div class="header-mondrian"><span></span><span></span><span></span><span></span></div>
  <div class="header-inner">
    <div class="header-brand">
      <a href="https://mindrianos-jsagirs-projects.vercel.app/" target="_blank">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 48" style="height:32px;width:auto;">
          <rect x="0" y="0" width="20" height="48" fill="#1E3A6E"/>
          <rect x="22" y="0" width="12" height="22" fill="#A63D2F"/>
          <rect x="22" y="24" width="12" height="24" fill="#C8A43C"/>
          <rect x="36" y="0" width="8" height="48" fill="#F5F0E8"/>
          <rect x="46" y="0" width="4" height="32" fill="#2D6B4A"/>
          <text x="60" y="35" font-size="32" fill="#F5F0E8" font-family="'Bebas Neue', sans-serif" font-weight="400" letter-spacing="0.04em">MINDRIAN</text>
        </svg>
        <span>SnapshotHub</span>
      </a>
    </div>
    <h1 class="header-title">${escapeHtml(room.ventureName)}</h1>
    <p class="header-subtitle">${escapeHtml(room.subtitle || 'Data Room Snapshot | Generated by MindrianOS')}</p>
    <p class="header-date">${dateStr}</p>
  </div>
</header>

<!-- NAVIGATION -->
<nav class="site-nav">
  <div class="nav-inner">
    ${navTabs}
  </div>
</nav>

<!-- MAIN -->
<main class="main-content">

${overviewHtml}

${sectionsHtml}

</main>

<!-- FOOTER -->
<footer class="site-footer">
  <div class="footer-inner">
    <div class="footer-brand">
      <a href="https://mindrianos-jsagirs-projects.vercel.app/" target="_blank">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 48" style="height:20px;width:auto;">
          <rect x="0" y="0" width="20" height="48" fill="#1E3A6E"/>
          <rect x="22" y="0" width="12" height="22" fill="#A63D2F"/>
          <rect x="22" y="24" width="12" height="24" fill="#C8A43C"/>
          <rect x="36" y="0" width="8" height="48" fill="#F5F0E8"/>
          <rect x="46" y="0" width="4" height="32" fill="#2D6B4A"/>
          <text x="60" y="35" font-size="32" fill="#888" font-family="'Bebas Neue', sans-serif" font-weight="400" letter-spacing="0.04em">MINDRIAN</text>
        </svg>
        Generated by MindrianOS
      </a>
    </div>
    <p>Powered by PWS Methodology (Prof. Lawrence Aronhime, Johns Hopkins)</p>
    <p><a href="https://mindrianos-jsagirs-projects.vercel.app/">mindrianos.vercel.app</a></p>
  </div>
  <div class="footer-mondrian"><span></span><span></span><span></span><span></span></div>
</footer>

<!-- SCROLL NAVIGATION HIGHLIGHT -->
<script>
document.addEventListener('DOMContentLoaded', function() {
  var sections = document.querySelectorAll('.section');
  var navTabs = document.querySelectorAll('.nav-tab');

  function updateNav() {
    var current = '';
    sections.forEach(function(section) {
      var sectionTop = section.offsetTop - 100;
      if (window.scrollY >= sectionTop) {
        current = section.getAttribute('id');
      }
    });
    navTabs.forEach(function(tab) {
      tab.style.borderBottomColor = 'transparent';
      tab.style.color = '';
      if (tab.getAttribute('href') === '#' + current) {
        tab.style.borderBottomColor = '#1E3A6E';
        tab.style.color = '#1E3A6E';
      }
    });
  }

  window.addEventListener('scroll', updateNav);
  updateNav();
});
</script>

</body>
</html>`;
}

function buildOverview(room, dateStr) {
  // Stats row
  const statsHtml = `
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-value" style="color: var(--teal)">${room.totalEntries}</div>
        <div class="stat-label">Artifacts</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: var(--blue)">${room.sections.length}</div>
        <div class="stat-label">Sections</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: var(--red)">${room.meetingsCount}</div>
        <div class="stat-label">Meetings</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: var(--yellow)">${room.teamCount}</div>
        <div class="stat-label">Team Members</div>
      </div>
    </div>`;

  // Section summary grid
  let sectionSummaryItems = '';
  for (const section of room.sections) {
    sectionSummaryItems += `
      <div class="section-summary-item">
        <div class="section-summary-dot" style="background: ${section.color}"></div>
        <span class="section-summary-name">${escapeHtml(section.label)}</span>
        <span class="section-summary-count">${section.articleCount} ${section.articleCount === 1 ? 'entry' : 'entries'}</span>
      </div>`;
  }

  return `
  <!-- OVERVIEW -->
  <section id="overview" class="section">
    <div class="section-header">
      <div class="section-marker" style="background: var(--red)"></div>
      <h2>Overview</h2>
    </div>

    <!-- Venture Card -->
    <div class="venture-card">
      <div class="venture-name">${escapeHtml(room.ventureName)}</div>
      <div class="venture-stage">${escapeHtml(room.ventureStage)}</div>
      <div class="venture-meta">
        <dl><dt>Generated</dt><dd>${dateStr}</dd></dl>
        <dl><dt>Stage</dt><dd>${escapeHtml(room.ventureStage)}</dd></dl>
        <dl><dt>Artifacts</dt><dd>${room.totalEntries}</dd></dl>
      </div>
    </div>

    <!-- Key Insight -->
    <div class="insight-box">
      <div class="insight-label">Key Insight</div>
      <div class="insight-text">${escapeHtml(room.firstInsight)}</div>
    </div>

    <!-- Stats -->
    ${statsHtml}

    <!-- Section Summary -->
    <div class="card">
      <div class="card-title">Sections</div>
      <div class="card-subtitle">${room.sections.length} active sections in this data room</div>
      <div class="section-summary-grid">
        ${sectionSummaryItems}
      </div>
    </div>
  </section>`;
}

function buildSection(section) {
  let cardsHtml = '';
  for (const article of section.articles) {
    // Build subtitle from frontmatter
    const subtitleParts = [];
    if (article.frontmatter.methodology) subtitleParts.push(article.frontmatter.methodology);
    if (article.frontmatter.created) subtitleParts.push(article.frontmatter.created);
    else if (article.frontmatter.date) subtitleParts.push(article.frontmatter.date);
    if (article.frontmatter.source) subtitleParts.push(article.frontmatter.source);
    if (article.frontmatter.type) subtitleParts.push(article.frontmatter.type);
    const subtitleStr = subtitleParts.length > 0
      ? `<div class="card-subtitle">${escapeHtml(subtitleParts.join(' | '))}</div>`
      : '';

    const bodyHtml = markdownToHtml(article.body);

    cardsHtml += `
      <div class="card card-bordered ${section.colorClass}">
        <div class="card-title">${escapeHtml(article.title)}</div>
        ${subtitleStr}
        <div class="card-body">${bodyHtml}</div>
      </div>`;
  }

  return `
  <!-- ${escapeHtml(section.label).toUpperCase()} -->
  <section id="${toSectionId(section.id)}" class="section">
    <div class="section-header">
      <div class="section-marker" style="background: ${section.color}"></div>
      <h2>${escapeHtml(section.label)}</h2>
      <span class="section-count">${section.articleCount} ${section.articleCount === 1 ? 'artifact' : 'artifacts'}</span>
    </div>
    ${cardsHtml}
  </section>`;
}

// ── CLI Entry Point ──

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
MindrianOS -- Single-File SnapshotHub Generator

Usage:
  node scripts/generate-hub.cjs <room-path> [--output <path>]

Options:
  --output <path>  Output file path (default: <room>/exports/hub.html)
  --help, -h       Show this help

Examples:
  node scripts/generate-hub.cjs ./room
  node scripts/generate-hub.cjs ~/rooms/my-venture --output ./my-hub.html
`);
    process.exit(0);
  }

  // Parse args
  let roomDir = args[0];
  let outputPath = null;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--output' && args[i + 1]) {
      outputPath = args[i + 1];
      i++;
    }
  }

  // Resolve room directory
  roomDir = path.resolve(roomDir);
  if (!fs.existsSync(roomDir) || !fs.statSync(roomDir).isDirectory()) {
    console.error(`Error: Room directory not found: ${roomDir}`);
    process.exit(1);
  }

  // Default output path
  if (!outputPath) {
    const exportsDir = path.join(roomDir, 'exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }
    outputPath = path.join(exportsDir, 'hub.html');
  } else {
    outputPath = path.resolve(outputPath);
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }

  // Scan room
  console.log(`Scanning room: ${roomDir}`);
  const room = scanRoom(roomDir);
  console.log(`Found ${room.sections.length} sections, ${room.totalEntries} total artifacts`);

  // Generate HTML
  const html = generateHtml(room);

  // Write output
  fs.writeFileSync(outputPath, html, 'utf-8');
  console.log(`Hub generated: ${outputPath}`);
  console.log(`  Venture: ${room.ventureName}`);
  console.log(`  Stage: ${room.ventureStage}`);
  console.log(`  Sections: ${room.sections.map(s => s.label).join(', ')}`);
}

main();
