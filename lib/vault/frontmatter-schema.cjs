#!/usr/bin/env node
/**
 * MindrianOS Plugin -- Vault Frontmatter Schema Enrichment
 *
 * Pure CJS, zero npm dependencies. Parses, enriches, and serializes
 * YAML frontmatter for vault artifacts per RULES-09 and ARCH-04.
 *
 * Exports:
 *   FRONTMATTER_SCHEMA  -- required fields per file type
 *   detectFileType      -- classify a file by path + existing fm
 *   enrichFrontmatter   -- add missing schema fields (never overwrite)
 *   parseFrontmatter    -- split YAML fm from body
 *   serializeFrontmatter -- round-trip fm + body back to string
 */

'use strict';

// ---------------------------------------------------------------------------
// Schema definition (RULES-09)
// ---------------------------------------------------------------------------

const FRONTMATTER_SCHEMA = {
  base: ['type', 'section', 'created', 'room'],
  content: ['methodology', 'sources', 'related', 'parent-moc', 'status'],
  meeting: ['speakers', 'filed-to'],
  team: ['role', 'expertise', 'contributions'],
  xref: ['source-artifact', 'target-artifacts', 'relationship-type'],
  'filed-to': ['filed_to', 'artifact_type', 'source-meeting'],
};

// System files never get enriched or footered (BRAND-03)
const SYSTEM_FILES = new Set([
  'ROOM.md',
  'STATE.md',
  'TEAM-STATE.md',
  'CLAUDE.md',
  'COWORK-INSTRUCTIONS.md',
  'TODOS.md',
  'WHATS-NEXT.md',
  'INDEX.md',
  'MILESTONES.md',
  'MEETINGS-INTELLIGENCE.md',
  'action-items.md',
  'metadata.yaml',
]);

const MEETING_FILENAMES = new Set([
  'summary.md',
  'transcript.md',
  'action-items.md',
  'decisions.md',
  'speakers.md',
]);

// ---------------------------------------------------------------------------
// File type detection
// ---------------------------------------------------------------------------

function detectFileType(relPath, frontmatter) {
  const norm = String(relPath || '').replace(/\\/g, '/');
  const parts = norm.split('/').filter(Boolean);
  const basename = parts[parts.length - 1] || '';

  if (SYSTEM_FILES.has(basename)) return 'system';

  // Team profile: team/<category>/<person>/PROFILE.md
  if (norm.includes('team/') && basename === 'PROFILE.md') return 'team';

  // Filed-to stub lives under meetings/<slug>/filed-to/
  if (norm.includes('meetings/') && norm.includes('filed-to/')) return 'filed-to';

  // Meeting artifact (summary/transcript/etc.)
  if (norm.includes('meetings/') && MEETING_FILENAMES.has(basename)) return 'meeting';

  // Cross-reference: filename starts with xref-
  if (/^xref-/i.test(basename)) return 'xref';

  // AI personas
  if (norm.includes('ai-personas/')) return 'persona';

  return 'content';
}

// ---------------------------------------------------------------------------
// Frontmatter parser (minimal YAML subset)
// ---------------------------------------------------------------------------

const FM_DELIM = /^---\s*\r?\n/;

function parseFrontmatter(content) {
  const src = String(content || '');
  if (!FM_DELIM.test(src)) {
    return { frontmatter: {}, body: src, raw: '' };
  }
  const afterFirst = src.replace(FM_DELIM, '');
  const closeMatch = afterFirst.match(/\r?\n---\s*(\r?\n|$)/);
  if (!closeMatch) {
    return { frontmatter: {}, body: src, raw: '' };
  }
  const raw = afterFirst.slice(0, closeMatch.index);
  const bodyStart = closeMatch.index + closeMatch[0].length;
  const body = afterFirst.slice(bodyStart);
  const frontmatter = parseYamlLite(raw);
  return { frontmatter, body, raw };
}

// Minimal YAML parser: top-level scalars, inline [a, b], and nested 1-level maps.
// Preserves unknown structures as raw strings so serialization round-trips.
function parseYamlLite(raw) {
  const fm = {};
  const lines = raw.split(/\r?\n/);
  let currentKey = null;
  let currentMap = null;
  let currentList = null;

  const scalar = (v) => {
    const t = v.trim();
    if (t === '') return '';
    if (/^\[.*\]$/.test(t)) {
      const inner = t.slice(1, -1).trim();
      if (!inner) return [];
      return inner.split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
    }
    if (/^['"].*['"]$/.test(t)) return t.slice(1, -1);
    return t;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Nested: two-space indent under a map key
    if (/^\s{2}\S/.test(line) && currentMap) {
      const m = line.match(/^\s{2}([^:]+):\s*(.*)$/);
      if (m) {
        currentMap[m[1].trim()] = scalar(m[2]);
        continue;
      }
    }

    // List continuation
    if (/^\s*-\s/.test(line) && currentList) {
      currentList.push(line.replace(/^\s*-\s+/, '').trim());
      continue;
    }

    // Top-level key
    const m = line.match(/^([A-Za-z0-9_\-]+):\s*(.*)$/);
    if (!m) continue;
    currentMap = null;
    currentList = null;
    currentKey = m[1];
    const val = m[2];
    if (val === '' || val === undefined) {
      // Could be a map or list; look ahead
      const next = lines[i + 1] || '';
      if (/^\s*-\s/.test(next)) {
        fm[currentKey] = [];
        currentList = fm[currentKey];
      } else if (/^\s{2}\S/.test(next)) {
        fm[currentKey] = {};
        currentMap = fm[currentKey];
      } else {
        fm[currentKey] = '';
      }
    } else {
      fm[currentKey] = scalar(val);
    }
  }

  return fm;
}

function serializeFrontmatter(frontmatter, body) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(frontmatter)) {
    lines.push(serializeKV(k, v));
  }
  lines.push('---');
  const prefix = lines.join('\n') + '\n';
  return prefix + (body || '');
}

function serializeKV(k, v) {
  if (Array.isArray(v)) {
    if (v.length === 0) return `${k}: []`;
    return `${k}: [${v.map(formatScalar).join(', ')}]`;
  }
  if (v && typeof v === 'object') {
    const parts = [`${k}:`];
    for (const [ck, cv] of Object.entries(v)) {
      parts.push(`  ${ck}: ${formatScalar(cv)}`);
    }
    return parts.join('\n');
  }
  return `${k}: ${formatScalar(v)}`;
}

function formatScalar(v) {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return `[${v.map(formatScalar).join(', ')}]`;
  const s = String(v);
  if (s === '') return '';
  // Quote if contains special YAML chars
  if (/[:#{}\[\],&*!|>'"%@`]/.test(s) && !/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    if (!s.includes("'")) return `'${s}'`;
    return `"${s.replace(/"/g, '\\"')}"`;
  }
  return s;
}

// ---------------------------------------------------------------------------
// Extraction helpers
// ---------------------------------------------------------------------------

function extractSection(relPath) {
  const norm = String(relPath || '').replace(/\\/g, '/');
  const parts = norm.split('/').filter(Boolean);
  return parts[0] || '';
}

function extractDate(frontmatter, relPath) {
  if (frontmatter.created) return String(frontmatter.created);
  if (frontmatter.last_updated) return String(frontmatter.last_updated);
  if (frontmatter.meeting_date) return String(frontmatter.meeting_date);
  const norm = String(relPath || '');
  const m = norm.match(/(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  return 'unknown';
}

function parentMocFor(section) {
  if (!section) return '';
  return `${section}/ROOM.md`;
}

// ---------------------------------------------------------------------------
// Enrichment
// ---------------------------------------------------------------------------

function enrichFrontmatter(content, relPath, roomName) {
  const parsed = parseFrontmatter(content);
  const fm = Object.assign({}, parsed.frontmatter);
  const type = detectFileType(relPath, fm);

  if (type === 'system') return content;

  const section = extractSection(relPath);
  const created = extractDate(fm, relPath);

  // Base fields (never overwrite)
  if (!('type' in fm)) fm.type = type;
  if (!('section' in fm)) fm.section = section;
  if (!('created' in fm)) fm.created = created;
  if (!('room' in fm)) fm.room = roomName || '';

  // Type-specific defaults
  if (type === 'content') {
    if (!('methodology' in fm)) fm.methodology = '';
    if (!('sources' in fm)) fm.sources = [];
    if (!('related' in fm)) fm.related = [];
    if (!('parent-moc' in fm)) fm['parent-moc'] = parentMocFor(section);
    if (!('status' in fm)) fm.status = 'active';
  } else if (type === 'meeting') {
    if (!('speakers' in fm)) fm.speakers = [];
    if (!('filed-to' in fm)) fm['filed-to'] = [];
  } else if (type === 'team') {
    if (!('role' in fm)) fm.role = '';
    if (!('expertise' in fm)) fm.expertise = [];
    if (!('contributions' in fm)) fm.contributions = [];
  } else if (type === 'xref') {
    if (!('source-artifact' in fm)) fm['source-artifact'] = '';
    if (!('target-artifacts' in fm)) fm['target-artifacts'] = [];
    if (!('relationship-type' in fm)) fm['relationship-type'] = '';
  } else if (type === 'filed-to') {
    if (!('filed_to' in fm)) fm.filed_to = '';
    if (!('artifact_type' in fm)) fm.artifact_type = '';
    if (!('source-meeting' in fm)) fm['source-meeting'] = '';
  }

  return serializeFrontmatter(fm, parsed.body);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  FRONTMATTER_SCHEMA,
  SYSTEM_FILES,
  detectFileType,
  enrichFrontmatter,
  parseFrontmatter,
  serializeFrontmatter,
  extractSection,
  extractDate,
};
