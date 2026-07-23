#!/usr/bin/env node
'use strict';

/**
 * MindrianOS -- Single-File SnapshotHub Generator (Synteris Quality)
 *
 * Generates a standalone HTML hub from any room/ directory.
 * Output is a single self-contained file with all CSS inline,
 * De Stijl design system, sticky tab navigation, smart content
 * detection, badge system, grade rendering, and card-based
 * article rendering matching the Synteris reference quality.
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
  'assumptions.json', 'ASSET_MANIFEST.md', 'GRADE.md'
]);

const SKIP_DIRS = new Set([
  '.lazygraph', '.mindrian', '.sparks', '.snapshots', 'exports', 'assets', 'personas'
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

// Data Room view labels (decorative, shows multi-view capability)
const DATA_ROOM_VIEWS = [
  'Wiki', 'Graph Intelligence', 'Constellation', 'Dashboard',
  'Deck', 'Insights', 'Diagrams', 'Narrative', 'Synthesis'
];

// Badge color mappings
const STATUS_BADGES = {
  'built': { bg: '#e6f2ef', color: 'var(--teal)', label: 'BUILT' },
  'open': { bg: '#fdecea', color: 'var(--red)', label: 'OPEN' },
  'designing': { bg: '#faf4e4', color: '#8a6d1f', label: 'DESIGNING' },
  'active': { bg: '#e8edf5', color: 'var(--blue)', label: 'ACTIVE' },
  'done': { bg: '#e6f2ef', color: 'var(--teal)', label: 'DONE' },
  'planned': { bg: '#faf4e4', color: '#8a6d1f', label: 'PLANNED' },
  'in-progress': { bg: '#e8edf5', color: 'var(--blue)', label: 'IN PROGRESS' },
  'critical': { bg: '#fdecea', color: 'var(--red)', label: 'CRITICAL' }
};

const PRIORITY_BADGES = {
  'critical': { bg: '#fdecea', color: 'var(--red)', label: 'CRITICAL' },
  'high': { bg: '#faf4e4', color: '#8a6d1f', label: 'HIGH' },
  'medium': { bg: '#e8edf5', color: 'var(--blue)', label: 'MEDIUM' },
  'low': { bg: '#e6f2ef', color: 'var(--teal)', label: 'LOW' }
};

const TYPE_BADGES = {
  'architectural': { bg: '#e8edf5', color: 'var(--blue)', label: 'ARCHITECTURAL' },
  'philosophical': { bg: '#e6f2ef', color: 'var(--teal)', label: 'PHILOSOPHICAL' },
  'tactical': { bg: '#faf4e4', color: '#8a6d1f', label: 'TACTICAL' },
  'bug': { bg: '#fdecea', color: 'var(--red)', label: 'BUG' },
  'feature': { bg: '#e8edf5', color: 'var(--blue)', label: 'FEATURE' },
  'decision': { bg: '#faf4e4', color: '#8a6d1f', label: 'DECISION' }
};

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
 * Handles headings, bold, italic, code, lists, tables, blockquotes, links, paragraphs, code blocks.
 */
function markdownToHtml(md) {
  if (!md) return '';

  const lines = md.split('\n');
  const output = [];
  let inList = false;
  let inOl = false;
  let inTable = false;
  let inBlockquote = false;
  let inCodeBlock = false;
  let codeBlockContent = [];
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
    // Images ![alt](url) - render as linked text since we're in HTML
    text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<em>[$1]</em>');
    // Bold **text**
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Italic *text*
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // Inline code `text`
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Strikethrough ~~text~~
    text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    return text;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code block fences
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        output.push('<pre><code>' + escapeHtml(codeBlockContent.join('\n')) + '</code></pre>');
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        flushParagraph();
        if (inList) { output.push('</ul>'); inList = false; }
        if (inOl) { output.push('</ol>'); inOl = false; }
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Empty line
    if (trimmed === '') {
      flushParagraph();
      if (inList) { output.push('</ul>'); inList = false; }
      if (inOl) { output.push('</ol>'); inOl = false; }
      if (inTable) { output.push('</tbody></table>'); inTable = false; }
      if (inBlockquote) { output.push('</blockquote>'); inBlockquote = false; }
      continue;
    }

    // Horizontal rule
    if (trimmed.match(/^(---|\*\*\*|___)$/)) {
      flushParagraph();
      output.push('<hr style="border: none; border-top: 1px solid var(--gray-200); margin: 16px 0;">');
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      if (inList) { output.push('</ul>'); inList = false; }
      if (inOl) { output.push('</ol>'); inOl = false; }
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

    // Ordered list
    if (trimmed.match(/^\d+\.\s+/)) {
      flushParagraph();
      if (inList) { output.push('</ul>'); inList = false; }
      if (!inOl) {
        output.push('<ol>');
        inOl = true;
      }
      output.push('<li>' + inlineFormat(trimmed.replace(/^\d+\.\s+/, '')) + '</li>');
      continue;
    } else if (inOl && !trimmed.match(/^\s/)) {
      output.push('</ol>');
      inOl = false;
    }

    // Unordered list
    if (trimmed.match(/^[-*+]\s+/)) {
      flushParagraph();
      if (inOl) { output.push('</ol>'); inOl = false; }
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
  if (inOl) output.push('</ol>');
  if (inTable) output.push('</tbody></table>');
  if (inBlockquote) output.push('</blockquote>');
  if (inCodeBlock) {
    output.push('<pre><code>' + escapeHtml(codeBlockContent.join('\n')) + '</code></pre>');
  }

  return output.join('\n');
}

// ── Badge Builder ──

function buildBadge(bg, color, label) {
  return `<span class="market-badge" style="background:${bg};color:${color};">${escapeHtml(label)}</span>`;
}

function getBadgesForArticle(fm) {
  const badges = [];

  // Status badge
  if (fm.status) {
    const key = fm.status.toLowerCase().replace(/\s+/g, '-');
    const badge = STATUS_BADGES[key];
    if (badge) {
      badges.push(buildBadge(badge.bg, badge.color, badge.label));
    }
  }

  // Priority badge
  if (fm.priority) {
    const key = fm.priority.toLowerCase();
    const badge = PRIORITY_BADGES[key];
    if (badge) {
      badges.push(buildBadge(badge.bg, badge.color, badge.label));
    }
  }

  // Type badge
  if (fm.type) {
    const key = fm.type.toLowerCase();
    const badge = TYPE_BADGES[key];
    if (badge) {
      badges.push(buildBadge(badge.bg, badge.color, badge.label));
    }
  }

  return badges.join(' ');
}

// ── Smart Content Detection ──

function detectCardType(article) {
  const fm = article.frontmatter;
  const body = article.body || '';

  // Bug card: has fixed_in, commit, or root_cause
  if (fm.fixed_in || fm.commit || fm.root_cause) return 'bug';

  // Wish card: has wish and status
  if (fm.wish || (fm.type && fm.type.toLowerCase() === 'wish')) return 'wish';

  // Decision card: has decision field
  if (fm.decision) return 'decision';

  // Before/After comparison
  if (body.includes('## Before') && body.includes('## After')) return 'comparison';

  return 'standard';
}

function renderBugCard(article, sectionColorClass) {
  const fm = article.frontmatter;
  const statusBadge = fm.status
    ? getBadgesForArticle(fm)
    : buildBadge('#e6f2ef', 'var(--teal)', 'FIXED');

  return `
    <div class="card card-bordered ${sectionColorClass}" style="border-left-width: 4px;">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;">
        <div class="card-title">${escapeHtml(article.title)}</div>
        ${statusBadge}
      </div>
      ${fm.root_cause ? `<div style="font-size:13px;color:var(--gray-500);margin-bottom:8px;"><strong>Root Cause:</strong> ${escapeHtml(fm.root_cause)}</div>` : ''}
      ${fm.fixed_in ? `<div style="font-size:13px;color:var(--teal);margin-bottom:8px;"><strong>Fixed in:</strong> <code>${escapeHtml(fm.fixed_in)}</code></div>` : ''}
      ${fm.commit ? `<div style="font-size:13px;color:var(--gray-500);margin-bottom:8px;"><strong>Commit:</strong> <code>${escapeHtml(fm.commit)}</code></div>` : ''}
      <div class="card-body">${markdownToHtml(article.body)}</div>
      ${fm.source ? `<div style="font-size:12px;color:var(--gray-500);margin-top:10px;">Source: <code>${escapeHtml(fm.source)}</code></div>` : ''}
    </div>`;
}

function renderWishCard(article, sectionColorClass) {
  const fm = article.frontmatter;
  const badges = getBadgesForArticle(fm);

  return `
    <div class="card card-bordered ${sectionColorClass}" style="border-left-width: 4px;">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;">
        <div class="card-title">${escapeHtml(article.title)}</div>
        ${badges}
      </div>
      ${fm.wish ? `<div style="font-size:14px;color:var(--blue);font-weight:500;margin-bottom:12px;font-style:italic;">"${escapeHtml(fm.wish)}"</div>` : ''}
      <div class="card-body">${markdownToHtml(article.body)}</div>
      ${fm.source ? `<div style="font-size:12px;color:var(--gray-500);margin-top:10px;">Source: <code>${escapeHtml(fm.source)}</code></div>` : ''}
    </div>`;
}

function renderDecisionCard(article, sectionColorClass) {
  const fm = article.frontmatter;
  const dNum = fm.decision || '';

  return `
    <div class="card card-bordered ${sectionColorClass}" style="border-left-width: 4px;">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;">
        <div class="card-title">${escapeHtml(article.title)}</div>
        ${dNum ? buildBadge('#faf4e4', '#8a6d1f', 'D-' + escapeHtml(dNum)) : ''}
      </div>
      <div class="card-body">${markdownToHtml(article.body)}</div>
      ${fm.source ? `<div style="font-size:12px;color:var(--gray-500);margin-top:10px;">Source: <code>${escapeHtml(fm.source)}</code></div>` : ''}
    </div>`;
}

function renderComparisonCard(article, sectionColorClass) {
  const fm = article.frontmatter;
  const badges = getBadgesForArticle(fm);
  const body = article.body || '';

  // Split body at ## Before and ## After
  const beforeMatch = body.match(/## Before\n([\s\S]*?)(?=## After)/);
  const afterMatch = body.match(/## After\n([\s\S]*?)$/);

  const beforeContent = beforeMatch ? beforeMatch[1].trim() : '';
  const afterContent = afterMatch ? afterMatch[1].trim() : '';

  // Get content that's not in before/after
  const preamble = body.split('## Before')[0].trim();

  return `
    <div class="card card-bordered ${sectionColorClass}" style="border-left-width: 4px;">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;">
        <div class="card-title">${escapeHtml(article.title)}</div>
        ${badges}
      </div>
      ${preamble ? `<div class="card-body" style="margin-bottom:16px;">${markdownToHtml(preamble)}</div>` : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:12px;">
        <div style="background:var(--cream);padding:14px;border-radius:var(--radius);">
          <div style="font-size:12px;font-weight:600;color:var(--red);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Before</div>
          <div class="card-body">${markdownToHtml(beforeContent)}</div>
        </div>
        <div style="background:var(--cream);padding:14px;border-radius:var(--radius);">
          <div style="font-size:12px;font-weight:600;color:var(--teal);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">After</div>
          <div class="card-body">${markdownToHtml(afterContent)}</div>
        </div>
      </div>
      ${fm.source ? `<div style="font-size:12px;color:var(--gray-500);margin-top:10px;">Source: <code>${escapeHtml(fm.source)}</code></div>` : ''}
    </div>`;
}

function renderStandardCard(article, sectionColorClass) {
  const fm = article.frontmatter;
  const badges = getBadgesForArticle(fm);

  // Build subtitle from frontmatter
  const subtitleParts = [];
  if (fm.methodology) subtitleParts.push(fm.methodology);
  if (fm.created) subtitleParts.push(fm.created);
  else if (fm.date) subtitleParts.push(fm.date);
  if (fm.source) subtitleParts.push(fm.source);
  if (fm.type && !TYPE_BADGES[fm.type.toLowerCase()]) subtitleParts.push(fm.type);
  const subtitleStr = subtitleParts.length > 0
    ? `<div class="card-subtitle">${escapeHtml(subtitleParts.join(' | '))}</div>`
    : '';

  const bodyHtml = markdownToHtml(article.body);

  return `
    <div class="card card-bordered ${sectionColorClass}">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:${badges ? '8' : '0'}px;">
        <div class="card-title">${escapeHtml(article.title)}</div>
        ${badges ? `<div style="display:flex;gap:6px;flex-shrink:0;">${badges}</div>` : ''}
      </div>
      ${subtitleStr}
      <div class="card-body">${bodyHtml}</div>
    </div>`;
}

function renderArticleCard(article, sectionColorClass) {
  const cardType = detectCardType(article);
  switch (cardType) {
    case 'bug': return renderBugCard(article, sectionColorClass);
    case 'wish': return renderWishCard(article, sectionColorClass);
    case 'decision': return renderDecisionCard(article, sectionColorClass);
    case 'comparison': return renderComparisonCard(article, sectionColorClass);
    default: return renderStandardCard(article, sectionColorClass);
  }
}

// ── Grade Parser ──

function parseGrade(roomDir) {
  const gradeFile = path.join(roomDir, 'GRADE.md');
  if (!fs.existsSync(gradeFile)) return null;

  try {
    const content = fs.readFileSync(gradeFile, 'utf-8');
    const fm = parseFrontmatter(content);
    const grade = {
      letter: fm.grade || fm.letter || '',
      score: fm.score || fm.total || '',
      components: [],
      quote: '',
      ceilings: []
    };

    // Extract components from body (look for patterns like "Component: score")
    const componentPattern = /^\*?\*?(.+?)\*?\*?\s*[:|-]\s*(\d+)\s*\/\s*100/gm;
    let match;
    while ((match = componentPattern.exec(content)) !== null) {
      grade.components.push({
        name: match[1].trim().replace(/\*\*/g, ''),
        score: parseInt(match[2])
      });
    }

    // Also try table format: | Component | Score |
    const tablePattern = /\|\s*(.+?)\s*\|\s*(\d+)\s*(?:\/\s*100)?\s*\|/g;
    while ((match = tablePattern.exec(content)) !== null) {
      const name = match[1].trim().replace(/\*\*/g, '');
      const score = parseInt(match[2]);
      if (name !== 'Component' && name !== 'Dimension' && !isNaN(score) && score <= 100) {
        grade.components.push({ name, score });
      }
    }

    // Extract quote
    const quoteMatch = content.match(/> (.+)/);
    if (quoteMatch) grade.quote = quoteMatch[1];

    return grade.letter ? grade : null;
  } catch (_) {
    return null;
  }
}

// ── Room Scanner ──

function scanRoom(roomDir) {
  // 1. Read STATE.md
  let ventureName = path.basename(roomDir);
  let ventureStage = 'Discovery';
  let subtitle = '';
  let firstInsight = '';
  let stateFm = {};
  let stateContent = '';

  const stateFile = path.join(roomDir, 'STATE.md');
  if (fs.existsSync(stateFile)) {
    stateContent = fs.readFileSync(stateFile, 'utf-8');
    stateFm = parseFrontmatter(stateContent);

    if (stateFm.venture_name) ventureName = stateFm.venture_name;
    else if (stateFm.room_name) ventureName = stateFm.room_name;
    else if (stateFm.name) ventureName = stateFm.name;
    else {
      const h1 = stateContent.match(/^# (.+)$/m);
      if (h1) ventureName = h1[1].replace(/Data Room State/i, '').trim() || ventureName;
    }

    if (stateFm.venture_stage) ventureStage = stateFm.venture_stage;
    else if (stateFm.stage) ventureStage = stateFm.stage;

    if (stateFm.subtitle) subtitle = stateFm.subtitle;
    else if (stateFm.description) subtitle = stateFm.description;

    // Extract suggested next action as insight
    const actionMatch = stateContent.match(/## Suggested Next Action\n(.+)/);
    if (actionMatch) firstInsight = actionMatch[1].trim();
  }

  // 2. Parse GRADE.md
  const grade = parseGrade(roomDir);

  // 3. Read team/ for metadata
  let founder = stateFm.founder || '';
  let employees = stateFm.employees || '';
  let funding = stateFm.funding || '';
  let affiliation = stateFm.affiliation || '';

  // 4. Discover sections
  const sections = [];
  let totalEntries = 0;
  let meetingsCount = 0;
  let teamCount = 0;
  let marketAnalysisCount = 0;
  let frameworksUsed = new Set();

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

            // Track frameworks used
            if (fm.methodology) frameworksUsed.add(fm.methodology);
            if (fm.framework) frameworksUsed.add(fm.framework);
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
    if (dirName === 'market-analysis') marketAnalysisCount = count;

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

  // 5. Sort sections: standard first (in DD order), then custom alphabetically
  const standardOrder = new Map(STANDARD_SECTIONS.map((s, i) => [s, i]));
  sections.sort((a, b) => {
    const aStd = standardOrder.has(a.id);
    const bStd = standardOrder.has(b.id);
    if (aStd && bStd) return standardOrder.get(a.id) - standardOrder.get(b.id);
    if (aStd && !bStd) return -1;
    if (!aStd && bStd) return 1;
    return a.id.localeCompare(b.id);
  });

  // 6. Try to get first insight from problem-definition if not from STATE.md
  if (!firstInsight) {
    const probSection = sections.find(s => s.id === 'problem-definition');
    if (probSection && probSection.articles.length > 0) {
      const firstBody = probSection.articles[0].body;
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
    marketAnalysisCount,
    frameworksUsed: frameworksUsed.size,
    firstInsight,
    grade,
    founder,
    employees,
    funding,
    affiliation,
    stateFm
  };
}

// ── CSS Generation ──

function getFullCSS() {
  return `
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
  position: relative;
}

.header-brand {
  position: absolute;
  top: 28px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--gray-500);
  z-index: 2;
}

@media (max-width: 640px) {
  .header-brand {
    position: static;
    margin-bottom: 16px;
  }
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

/* -- DATA ROOM VIEWS -- */
.views-row {
  max-width: 1200px;
  margin: 20px auto 0;
  padding: 0 24px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.view-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  border-radius: 20px;
  background: var(--white);
  border: 1px solid var(--gray-200);
  color: var(--gray-700);
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s;
}

.view-btn:hover {
  background: var(--blue);
  color: var(--white);
  border-color: var(--blue);
}

.view-btn:first-child {
  background: var(--dark);
  color: var(--white);
  border-color: var(--dark);
}

/* -- RICH TEXT: Callouts, Quotes, Wikilinks, Tags, Hat Cards -- */
.callout {
  border-left: 4px solid var(--yellow);
  padding: 16px 20px;
  background: rgba(200,164,60,0.06);
  margin: 20px 0;
  border-radius: 0 8px 8px 0;
}
.callout-red { border-left-color: var(--red); background: rgba(166,61,47,0.06); }
.callout-blue { border-left-color: var(--blue); background: rgba(30,58,110,0.06); }
.callout-teal { border-left-color: var(--teal); background: rgba(42,107,94,0.06); }

.quote {
  font-size: 1.15rem;
  font-style: italic;
  color: var(--gray-700);
  border-left: 3px solid var(--gray-300);
  padding: 12px 20px;
  margin: 20px 0;
}
.quote .attribution { font-size: 0.85rem; font-style: normal; color: var(--gray-500); margin-top: 8px; }

.wikilink {
  color: var(--blue);
  text-decoration: none;
  border-bottom: 1px dashed var(--blue);
  cursor: pointer;
  transition: all 0.2s;
}
.wikilink:hover { color: var(--red); border-bottom-color: var(--red); }

.key-number { font-family: 'Bebas Neue', sans-serif; font-size: 1.8rem; color: var(--yellow); }
.key-label { font-size: 0.85rem; color: var(--gray-500); text-transform: uppercase; letter-spacing: 1px; }

.tag-pill {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 2px 4px 2px 0;
}
.tag-high { background: rgba(166,61,47,0.15); color: var(--red); }
.tag-medium { background: rgba(200,164,60,0.15); color: #9a7d2e; }
.tag-low { background: rgba(42,107,94,0.15); color: var(--teal); }

.hat-tension {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin: 16px 0;
}
.hat-card {
  padding: 14px;
  border-radius: 8px;
  border: 1px solid var(--gray-200);
  background: var(--white);
}
.hat-card h5 { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
.hat-white h5 { color: #666; }
.hat-red h5 { color: #c0392b; }
.hat-black h5 { color: #2c3e50; }
.hat-yellow h5 { color: #d4ac0d; }
.hat-green h5 { color: #27ae60; }
.hat-blue h5 { color: #2980b9; }

.section-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 32px 0 24px;
  color: var(--gray-500);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 2px;
}
.section-divider::before, .section-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--gray-200);
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
.card-body pre {
  background: var(--dark);
  color: var(--cream);
  padding: 16px;
  border-radius: var(--radius);
  overflow-x: auto;
  margin: 10px 0;
  font-size: 13px;
  line-height: 1.5;
}
.card-body pre code {
  background: none;
  padding: 0;
  color: inherit;
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

/* -- GRID HELPERS -- */
.grid-2 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
}

.grid-3 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}

.grid-4 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

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
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 24px;
  align-items: start;
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

.venture-grade {
  text-align: center;
}

.grade-circle {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--teal);
  color: var(--white);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
}

.grade-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--gray-500);
  margin-top: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* -- MARKET CARDS -- */
.market-card {
  background: var(--white);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  padding: 24px;
  border-left: 4px solid var(--gray-300);
  transition: box-shadow 0.2s, transform 0.2s;
}

.market-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.market-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.market-name {
  font-size: 17px;
  font-weight: 700;
  flex: 1;
}

.market-badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  padding: 3px 10px;
  border-radius: 4px;
  white-space: nowrap;
}

.badge-red { background: #fdecea; color: var(--red); }
.badge-blue { background: #e8edf5; color: var(--blue); }
.badge-yellow { background: #faf4e4; color: #8a6d1f; }
.badge-teal { background: #e6f2ef; color: var(--teal); }

.market-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 12px;
  font-size: 13px;
}

.market-stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.market-stat-label {
  color: var(--gray-500);
  font-weight: 500;
}

.market-stat-value {
  font-weight: 700;
}

.market-finding {
  font-size: 14px;
  color: var(--gray-700);
  line-height: 1.6;
  margin-bottom: 10px;
}

.market-gating {
  font-size: 13px;
  padding: 10px 14px;
  background: var(--cream);
  border-radius: 6px;
  color: var(--dark);
}

.market-gating strong {
  color: var(--red);
}

/* -- OPPORTUNITY SECTION -- */
.opp-card {
  background: var(--white);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  padding: 24px;
  margin-bottom: 16px;
}

.opp-card h3 {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 4px;
}

.opp-card .source {
  font-size: 12px;
  color: var(--gray-500);
  margin-bottom: 14px;
}

.analogy-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.analogy-item {
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: 12px;
  align-items: start;
}

.analogy-num {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--cream);
  color: var(--dark);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}

.analogy-text {
  font-size: 14px;
  line-height: 1.55;
}

.analogy-text strong {
  color: var(--blue);
}

.breakthrough-box {
  background: linear-gradient(135deg, var(--blue), #2a5a9e);
  color: var(--white);
  border-radius: var(--radius-lg);
  padding: 28px 28px;
  margin-bottom: 24px;
}

.breakthrough-box h3 {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 16px;
}

.breakthrough-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.breakthrough-list li {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  font-size: 15px;
  line-height: 1.5;
}

.breakthrough-list .num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}

/* -- HSI TABLE -- */
.hsi-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.hsi-table thead th {
  text-align: left;
  padding: 10px 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--gray-500);
  border-bottom: 2px solid var(--gray-200);
}

.hsi-table tbody td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--gray-200);
}

.hsi-table tbody tr:hover {
  background: var(--cream);
}

.hsi-score {
  font-weight: 700;
}

/* -- REVERSE SALIENT MAP -- */
.rs-map {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.rs-item {
  background: var(--cream);
  padding: 16px;
  border-radius: var(--radius);
  border-left: 3px solid var(--red);
}

.rs-item h4 {
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 4px;
}

.rs-item p {
  font-size: 13px;
  color: var(--gray-700);
  line-height: 1.5;
}

/* -- FRAMEWORK CHAIN -- */
.chain-container {
  overflow-x: auto;
  padding: 20px 0;
}

.chain {
  display: flex;
  align-items: center;
  gap: 0;
  min-width: max-content;
}

.chain-node {
  background: var(--white);
  border: 2px solid var(--blue);
  border-radius: var(--radius);
  padding: 14px 18px;
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  white-space: nowrap;
  min-width: 120px;
}

.chain-node.active {
  background: var(--blue);
  color: var(--white);
}

.chain-arrow {
  width: 32px;
  height: 2px;
  background: var(--blue);
  position: relative;
  flex-shrink: 0;
}

.chain-arrow::after {
  content: '';
  position: absolute;
  right: 0;
  top: -4px;
  border: 5px solid transparent;
  border-left: 6px solid var(--blue);
}

.framework-explain {
  margin-top: 20px;
}

.framework-explain .fw-item {
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--gray-200);
  font-size: 14px;
}

.framework-explain .fw-item:last-child { border-bottom: none; }

.fw-name {
  font-weight: 700;
  color: var(--blue);
}

.fw-reason {
  color: var(--gray-700);
  line-height: 1.5;
}

/* -- PROBLEM CLASSIFICATION -- */
.problem-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
}

.problem-tag {
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  background: var(--cream);
  border: 1px solid var(--gray-200);
}

.problem-tag.active-tag {
  background: var(--dark);
  color: var(--white);
  border-color: var(--dark);
}

/* -- TRANSCRIPT -- */
.transcript-turn {
  margin-bottom: 20px;
}

.turn-label {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 6px;
}

.turn-label.user { color: var(--teal); }
.turn-label.larry { color: var(--blue); }

.turn-bubble {
  padding: 20px 24px;
  border-radius: var(--radius);
  font-size: 15px;
  line-height: 1.7;
}

.turn-bubble.user {
  background: var(--cream);
}

.turn-bubble.larry {
  background: #edf2fa;
  border-left: 4px solid var(--blue);
}

/* -- DECK SLIDES -- */
.slide {
  background: var(--white);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: 40px 36px;
  margin-bottom: 20px;
  position: relative;
  overflow: hidden;
}

.slide::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
}

.slide:nth-child(1)::before { background: var(--red); }
.slide:nth-child(2)::before { background: var(--blue); }
.slide:nth-child(3)::before { background: var(--teal); }
.slide:nth-child(4)::before { background: var(--yellow); }
.slide:nth-child(5)::before { background: var(--red); }
.slide:nth-child(6)::before { background: var(--blue); }
.slide:nth-child(7)::before { background: var(--teal); }
.slide:nth-child(8)::before { background: var(--yellow); }
.slide:nth-child(9)::before { background: var(--red); }

.slide-number {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--gray-500);
  margin-bottom: 16px;
}

.slide h3 {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.3;
  margin-bottom: 12px;
}

.slide h4 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 10px;
}

.slide p, .slide li {
  font-size: 15px;
  line-height: 1.65;
  color: var(--gray-700);
}

.slide ul, .slide ol {
  padding-left: 20px;
}

.slide li {
  margin-bottom: 6px;
}

.slide-title-card {
  text-align: center;
  padding: 60px 36px;
  background: var(--dark);
  color: var(--white);
}

.slide-title-card h3 {
  font-size: 32px;
  color: var(--white);
  margin-bottom: 8px;
}

.slide-title-card p {
  color: var(--gray-500);
}

.slide-title-card .tagline {
  font-size: 18px;
  color: var(--yellow);
  font-weight: 500;
  margin-bottom: 20px;
}

.slide-insight-card {
  background: linear-gradient(135deg, var(--dark), #2a2a2a);
  color: var(--white);
  text-align: center;
  padding: 50px 36px;
}

.slide-insight-card h3 { color: var(--white); }

.slide-insight-card .quote {
  font-size: 22px;
  font-weight: 500;
  line-height: 1.5;
  color: var(--yellow);
  max-width: 700px;
  margin: 0 auto 16px;
}

.slide-insight-card p { color: rgba(255,255,255,0.7); }

.chart-container {
  max-width: 600px;
  margin: 20px auto 0;
}

/* Revenue path */
.revenue-path {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 16px;
}

.revenue-step {
  text-align: center;
  padding: 24px 16px;
  background: var(--cream);
  border-radius: var(--radius);
  position: relative;
}

.revenue-step h5 {
  font-size: 13px;
  font-weight: 600;
  color: var(--blue);
  margin-bottom: 8px;
}

.revenue-step .amount {
  font-size: 22px;
  font-weight: 700;
  color: var(--dark);
  margin-bottom: 4px;
}

.revenue-step .detail {
  font-size: 13px;
  color: var(--gray-500);
}

/* -- GRADE SECTION -- */
.grade-overview {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 32px;
  align-items: start;
  margin-bottom: 32px;
}

.grade-big {
  text-align: center;
}

.grade-big-circle {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: var(--teal);
  color: var(--white);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 0 auto 8px;
}

.grade-big-letter {
  font-size: 40px;
  font-weight: 700;
  line-height: 1;
}

.grade-big-score {
  font-size: 14px;
  font-weight: 400;
  opacity: 0.8;
}

.grade-bar-container {
  margin-bottom: 14px;
}

.grade-bar-label {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
}

.grade-bar-track {
  height: 10px;
  background: var(--gray-200);
  border-radius: 5px;
  overflow: hidden;
}

.grade-bar-fill {
  height: 100%;
  border-radius: 5px;
  transition: width 0.6s ease;
}

.grade-quote {
  background: var(--cream);
  border-left: 4px solid var(--yellow);
  padding: 24px;
  border-radius: 0 var(--radius) var(--radius) 0;
  margin-top: 24px;
}

.grade-quote .label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--gray-500);
  margin-bottom: 8px;
}

.grade-quote blockquote {
  font-size: 16px;
  line-height: 1.6;
  font-style: italic;
  color: var(--dark);
}

.ceiling-card {
  background: var(--white);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  padding: 24px;
  margin-top: 20px;
}

.ceiling-card h4 {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 12px;
}

.ceiling-list {
  list-style: none;
}

.ceiling-list li {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 8px 0;
  font-size: 14px;
  line-height: 1.5;
  border-bottom: 1px solid var(--gray-200);
}

.ceiling-list li:last-child { border-bottom: none; }

.ceiling-icon {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 1px;
}

/* -- WHAT MUST BE TRUE -- */
.wmbt-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.wmbt-item {
  background: var(--cream);
  padding: 16px;
  border-radius: var(--radius);
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.wmbt-check {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--teal);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
}

.wmbt-text {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
}

/* -- ACTIVE QUESTIONS -- */
.question-list {
  list-style: none;
}

.question-list li {
  padding: 10px 0;
  border-bottom: 1px solid var(--gray-200);
  font-size: 14px;
  line-height: 1.55;
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.question-list li:last-child { border-bottom: none; }

.q-icon {
  color: var(--yellow);
  font-weight: 700;
  font-size: 16px;
  flex-shrink: 0;
  margin-top: -1px;
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
  .grade-overview { grid-template-columns: 1fr; text-align: center; }
  .revenue-path { grid-template-columns: 1fr; }
  .framework-explain .fw-item { grid-template-columns: 1fr; }
  .chain { flex-wrap: wrap; gap: 8px; }
  .chain-arrow { display: none; }
  .chain-node { min-width: auto; flex: 1 1 auto; }
  .slide { padding: 28px 20px; }
  .slide-title-card { padding: 40px 20px; }
  .slide-insight-card { padding: 36px 20px; }
  .slide-insight-card .quote { font-size: 18px; }
  .section-summary-grid { grid-template-columns: 1fr; }
  .stats-row { grid-template-columns: repeat(2, 1fr); }
  .views-row { gap: 6px; }
  .view-btn { padding: 6px 12px; font-size: 11px; }
}

/* -- PRINT -- */
@media print {
  .site-nav { display: none; }
  .views-row { display: none; }
  .section { page-break-inside: avoid; }
  .card, .slide { box-shadow: none; border: 1px solid var(--gray-200); }
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
`;
}

// ── Mindrian SVG Logo ──

function getMinidrianSVG(textFill) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 48" style="height:32px;width:auto;">
  <rect x="0" y="0" width="20" height="48" fill="#1E3A6E"/>
  <rect x="22" y="0" width="12" height="22" fill="#A63D2F"/>
  <rect x="22" y="24" width="12" height="24" fill="#C8A43C"/>
  <rect x="36" y="0" width="8" height="48" fill="#F5F0E8"/>
  <rect x="46" y="0" width="4" height="32" fill="#2D6B4A"/>
  <text x="60" y="35" font-size="32" fill="${textFill}" font-family="'Bebas Neue', sans-serif" font-weight="400" letter-spacing="0.04em">MINDRIAN</text>
</svg>`;
}

function getSmallSVG(textFill) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 48" style="height:20px;width:auto;">
  <rect x="0" y="0" width="20" height="48" fill="#1E3A6E"/>
  <rect x="22" y="0" width="12" height="22" fill="#A63D2F"/>
  <rect x="22" y="24" width="12" height="24" fill="#C8A43C"/>
  <rect x="36" y="0" width="8" height="48" fill="#F5F0E8"/>
  <rect x="46" y="0" width="4" height="32" fill="#2D6B4A"/>
  <text x="60" y="35" font-size="32" fill="${textFill}" font-family="'Bebas Neue', sans-serif" font-weight="400" letter-spacing="0.04em">MINDRIAN</text>
</svg>`;
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

  // Build data room views row -- clickable links to sections
  const viewSectionMap = {
    'Wiki': '#overview',
    'Graph Intelligence': '#overview',
    'Constellation': '#overview',
    'Dashboard': '#overview',
    'Deck': '#' + (room.sections.find(s => s.id === 'opportunity-bank') ? toSectionId('opportunity-bank') : 'overview'),
    'Insights': '#' + (room.sections.find(s => s.id === 'solution-design') ? toSectionId('solution-design') : 'overview'),
    'Diagrams': '#overview',
    'Narrative': '#narrative',
    'Synthesis': '#overview',
  };
  let viewsHtml = '';
  for (const view of DATA_ROOM_VIEWS) {
    const href = viewSectionMap[view] || '#overview';
    viewsHtml += `<a class="view-btn" href="${href}">${escapeHtml(view)}</a>\n    `;
  }

  // Build overview
  const overviewHtml = buildOverview(room, dateStr);

  // Build section tabs
  let sectionsHtml = '';
  for (const section of room.sections) {
    sectionsHtml += buildSection(section);
  }

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
${require("../lib/ui/design-system.cjs").mosStyleTag()}
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${pageTitle}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<style>
${getFullCSS()}
</style>
</head>
<body>

<!-- HEADER -->
<header class="site-header">
  <div class="header-mondrian"><span></span><span></span><span></span><span></span></div>
  <div class="header-inner">
    <div class="header-brand">
      <a href="https://mindrianos-jsagirs-projects.vercel.app/" target="_blank">
        ${getMinidrianSVG('#F5F0E8')}
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

<!-- DATA ROOM VIEWS -->
<div class="views-row">
  ${viewsHtml}
</div>

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
        ${getSmallSVG('#F5F0E8')}
        Made by Mindrian
      </a>
    </div>
    <p>Powered by PWS Methodology (Prof. Lawrence Aronhime, Johns Hopkins)</p>
    <p><a href="https://mindrianos-jsagirs-projects.vercel.app/">mindrian-os.com</a></p>
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
  // Venture meta items
  let metaItems = '';
  if (room.founder) {
    metaItems += `<dl><dt>Founder</dt><dd>${escapeHtml(room.founder)}</dd></dl>`;
  }
  if (room.employees) {
    metaItems += `<dl><dt>Employees</dt><dd>${escapeHtml(room.employees)}</dd></dl>`;
  }
  if (room.funding) {
    metaItems += `<dl><dt>Funding</dt><dd>${escapeHtml(room.funding)}</dd></dl>`;
  }
  if (room.affiliation) {
    metaItems += `<dl><dt>Affiliation</dt><dd>${escapeHtml(room.affiliation)}</dd></dl>`;
  }
  // Always show these
  metaItems += `<dl><dt>Stage</dt><dd>${escapeHtml(room.ventureStage)}</dd></dl>`;
  metaItems += `<dl><dt>Generated</dt><dd>${dateStr}</dd></dl>`;
  metaItems += `<dl><dt>Artifacts</dt><dd>${room.totalEntries}</dd></dl>`;

  // Grade circle (if GRADE.md exists)
  const gradeCircleHtml = room.grade ? `
      <div class="venture-grade">
        <div class="grade-circle">${escapeHtml(room.grade.letter)}</div>
        <div class="grade-label">Session Grade</div>
      </div>` : '';

  // Stats row
  const statsCards = [];
  statsCards.push(`<div class="stat-card"><div class="stat-value" style="color: var(--blue)">${room.sections.length}</div><div class="stat-label">Sections</div></div>`);
  statsCards.push(`<div class="stat-card"><div class="stat-value" style="color: var(--teal)">${room.totalEntries}</div><div class="stat-label">Documents</div></div>`);
  if (room.marketAnalysisCount > 0) {
    statsCards.push(`<div class="stat-card"><div class="stat-value" style="color: var(--red)">${room.marketAnalysisCount}</div><div class="stat-label">Market Analyses</div></div>`);
  }
  if (room.frameworksUsed > 0) {
    statsCards.push(`<div class="stat-card"><div class="stat-value" style="color: var(--yellow)">${room.frameworksUsed}</div><div class="stat-label">Frameworks</div></div>`);
  }
  if (room.meetingsCount > 0) {
    statsCards.push(`<div class="stat-card"><div class="stat-value" style="color: var(--blue)">${room.meetingsCount}</div><div class="stat-label">Meetings</div></div>`);
  }
  if (room.grade) {
    statsCards.push(`<div class="stat-card"><div class="stat-value" style="color: var(--teal)">${escapeHtml(room.grade.letter)}</div><div class="stat-label">Grade</div></div>`);
  }

  const statsHtml = `<div class="stats-row">${statsCards.join('\n      ')}</div>`;

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
      <div>
        <div class="venture-name">${escapeHtml(room.ventureName)}</div>
        <div class="venture-stage">${escapeHtml(room.ventureStage)}</div>
        <div class="venture-meta">
          ${metaItems}
        </div>
      </div>
      ${gradeCircleHtml}
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
    cardsHtml += renderArticleCard(article, section.colorClass);
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
MindrianOS -- Single-File SnapshotHub Generator (Synteris Quality)

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

  const lineCount = html.split('\n').length;
  console.log(`Hub generated: ${outputPath}`);
  console.log(`  Venture: ${room.ventureName}`);
  console.log(`  Stage: ${room.ventureStage}`);
  console.log(`  Sections: ${room.sections.map(s => s.label).join(', ')}`);
  console.log(`  Lines: ${lineCount}`);
  if (room.grade) {
    console.log(`  Grade: ${room.grade.letter}`);
  }
}

main();
