/**
 * MindrianOS Plugin -- Room Type Detector
 * Pure function: detects Room type from State content + Section names + Entry content.
 * Maps each Room type to adaptive config (statsBar, hubTitle, sectionLabels, insightTypes, graphLabel).
 *
 * Satisfies: ROOM-01, ROOM-02, ROOM-03, ROOM-04
 * Taxonomy: Room, Section, Entry, State, Thesis, Signal, Thread, Fabric
 * Zero npm dependencies -- uses only Node.js built-ins.
 */

'use strict';

/**
 * ROOM_TYPE_CONFIG: Adaptive presentation config per Room type.
 * Each preset maps to stats bar metrics, hub title, section label overrides,
 * insight types, and Constellation graph label.
 *
 * statsBar: array of { key, label } objects for the stats bar
 * hubTitle: display title for the hub page
 * sectionLabels: map of section-id -> display label override
 * insightTypes: prioritized Signal types for this Room type
 * graphLabel: label for the Constellation view
 */
const ROOM_TYPE_CONFIG = {
  venture: {
    statsBar: [
      { key: 'sectionCount', label: 'Sections' },
      { key: 'entryCount',   label: 'Entries' },
      { key: 'threadCount',  label: 'Threads' },
      { key: 'gapCount',     label: 'Blind Spots' },
      { key: 'grantCount',   label: 'Grants' },
    ],
    hubTitle: 'Venture Data Room',
    sectionLabels: {
      'problem-definition':   'Problem Definition',
      'market-analysis':      'Market Analysis',
      'solution-design':      'Solution Design',
      'business-model':       'Business Model',
      'competitive-analysis': 'Competitive Analysis',
      'team-execution':       'Team & Execution',
      'legal-ip':             'Legal & IP',
      'financial-model':      'Financial Model',
      'opportunity-bank':     'Opportunity Bank',
      'funding-strategy':     'Funding Strategy',
    },
    insightTypes: ['investor-readiness', 'competitive-gaps', 'financial-viability'],
    graphLabel: 'Venture Knowledge Graph',
  },

  website: {
    statsBar: [
      { key: 'sectionCount',    label: 'Sections' },
      { key: 'entryCount',      label: 'Pages' },
      { key: 'componentCount',  label: 'Components' },
      { key: 'breakpointCount', label: 'Breakpoints' },
      { key: 'gapCount',        label: 'Issues' },
    ],
    hubTitle: 'Design System Room',
    sectionLabels: {
      'problem-definition':   'User Needs',
      'market-analysis':      'Competitor Analysis',
      'solution-design':      'Component Architecture',
      'business-model':       'Content Strategy',
      'competitive-analysis': 'UX Benchmarks',
      'team-execution':       'Design Team',
      'legal-ip':             'Accessibility & Compliance',
      'financial-model':      'Performance Budget',
    },
    insightTypes: ['design-consistency', 'accessibility', 'performance'],
    graphLabel: 'Component Dependency Graph',
  },

  research: {
    statsBar: [
      { key: 'sectionCount', label: 'Sections' },
      { key: 'entryCount',   label: 'Papers' },
      { key: 'threadCount',  label: 'Citations' },
      { key: 'findingCount', label: 'Findings' },
      { key: 'gapCount',     label: 'Gaps' },
    ],
    hubTitle: 'Research Room',
    sectionLabels: {
      'problem-definition':   'Research Question',
      'market-analysis':      'Literature Review',
      'solution-design':      'Methodology',
      'business-model':       'Data Collection',
      'competitive-analysis': 'Related Work',
      'team-execution':       'Research Team',
      'legal-ip':             'Ethics & IRB',
      'financial-model':      'Funding & Budget',
      'literature':           'Literature',
      'clinical-pathway':     'Clinical Pathway',
      'findings':             'Findings',
    },
    insightTypes: ['methodology-coverage', 'citation-network', 'finding-strength'],
    graphLabel: 'Research Knowledge Graph',
  },

  general: {
    statsBar: [
      { key: 'sectionCount', label: 'Sections' },
      { key: 'entryCount',   label: 'Entries' },
      { key: 'threadCount',  label: 'Threads' },
      { key: 'gapCount',     label: 'Blind Spots' },
      { key: 'signalCount',  label: 'Signals' },
    ],
    hubTitle: 'Data Room',
    sectionLabels: {},
    insightTypes: ['gaps', 'contradictions', 'convergences'],
    graphLabel: 'Knowledge Graph',
  },
};

/** All recognized Room types */
const VALID_ROOM_TYPES = Object.keys(ROOM_TYPE_CONFIG);

/**
 * Keyword sets for heuristic Room type detection from Section names and Entry content.
 * Each set is scored -- highest score wins.
 */
/**
 * Strong indicators: Section names that are near-unique to one Room type.
 * Presence of ANY strong indicator adds a large bonus (weight: 10).
 * This prevents generic sections (market-analysis, team-execution) from
 * drowning out domain-specific sections (clinical-pathway, literature).
 */
const STRONG_INDICATORS = {
  venture: ['financial-model', 'opportunity-bank', 'funding-strategy'],
  website: ['design-system', 'ui-components', 'components', 'pages'],
  research: ['clinical-pathway', 'literature', 'findings', 'methodology', 'experiments'],
};

const TYPE_SIGNALS = {
  venture: {
    sectionKeywords: [
      'financial-model', 'competitive-analysis', 'business-model',
      'funding-strategy', 'opportunity-bank', 'team-execution',
      'legal-ip',
    ],
    contentKeywords: [
      'investor', 'funding', 'revenue', 'TAM', 'SAM', 'SOM',
      'valuation', 'pitch', 'startup', 'venture', 'equity',
      'cap table', 'burn rate', 'runway',
    ],
  },
  website: {
    sectionKeywords: [
      'components', 'pages', 'design-system', 'navigation',
      'layouts', 'styles', 'responsive', 'ui-components',
    ],
    contentKeywords: [
      'responsive', 'breakpoint', 'component', 'CSS', 'layout',
      'navigation', 'wireframe', 'figma', 'typography', 'color palette',
      'accessibility', 'WCAG', 'viewport',
    ],
  },
  research: {
    sectionKeywords: [
      'literature', 'methodology', 'findings', 'clinical-pathway',
      'data-collection', 'hypothesis', 'experiments', 'results',
    ],
    contentKeywords: [
      'hypothesis', 'methodology', 'findings', 'citation', 'peer review',
      'abstract', 'literature review', 'sample size', 'p-value',
      'clinical', 'experiment', 'IRB', 'protocol', 'randomized',
    ],
  },
};

/**
 * Detect Room type from State content and Section metadata.
 * Pure function -- no file I/O, no side effects.
 *
 * Detection cascade:
 *   1. Explicit type in State frontmatter (room_type: or venture_type:)
 *   2. Section name heuristics (weighted keyword match)
 *   3. Entry content sampling (keyword frequency in first N entries)
 *   4. Fallback to 'general'
 *
 * @param {string} stateContent - Raw STATE.md content (or empty string)
 * @param {Array<{name: string, entries?: Array<{content?: string}>}>} sections - Section metadata
 * @returns {string} One of: 'venture', 'website', 'research', 'general'
 */
function detectRoomType(stateContent, sections) {
  stateContent = stateContent || '';
  sections = sections || [];

  // Step 1: Explicit type declaration in State frontmatter
  const explicitType = parseExplicitType(stateContent);
  if (explicitType && VALID_ROOM_TYPES.includes(explicitType)) {
    return explicitType;
  }

  // Step 2 + 3: Score-based detection from Section names + Entry content
  const scores = { venture: 0, website: 0, research: 0 };
  const sectionNames = sections.map(s => (s.name || '').toLowerCase());

  // Strong indicators: domain-unique sections get a large bonus (weight: 10)
  for (const [type, indicators] of Object.entries(STRONG_INDICATORS)) {
    for (const indicator of indicators) {
      if (sectionNames.includes(indicator)) {
        scores[type] += 10;
      }
    }
  }

  for (const [type, signals] of Object.entries(TYPE_SIGNALS)) {
    // Section name matches (weight: 3 per match)
    for (const keyword of signals.sectionKeywords) {
      if (sectionNames.includes(keyword)) {
        scores[type] += 3;
      }
      // Partial match (section name contains keyword)
      for (const name of sectionNames) {
        if (name !== keyword && name.includes(keyword)) {
          scores[type] += 1;
        }
      }
    }

    // Entry content keyword matches (weight: 1 per match, sampled)
    const contentSample = buildContentSample(sections);
    const contentLower = contentSample.toLowerCase();
    for (const keyword of signals.contentKeywords) {
      if (contentLower.includes(keyword.toLowerCase())) {
        scores[type] += 1;
      }
    }
  }

  // Find highest scoring type
  let bestType = 'general';
  let bestScore = 0;
  for (const [type, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  // Minimum threshold: need at least 3 points to declare a type
  if (bestScore < 3) return 'general';

  return bestType;
}

/**
 * Parse explicit Room type from State frontmatter.
 * Looks for: room_type, venture_type, project_type
 * @param {string} stateContent - Raw STATE.md content
 * @returns {string|null} Explicit type or null
 */
function parseExplicitType(stateContent) {
  // Match frontmatter block
  const fmMatch = stateContent.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    // Also check inline patterns outside frontmatter
    const inlineMatch = stateContent.match(/(?:room_type|project_type|venture_type):\s*(\S+)/i);
    return inlineMatch ? normalizeType(inlineMatch[1]) : null;
  }

  const frontmatter = fmMatch[1];
  const typeMatch = frontmatter.match(/(?:room_type|project_type):\s*(\S+)/i);
  if (typeMatch) return normalizeType(typeMatch[1]);

  // venture_type implies 'venture'
  const ventureMatch = frontmatter.match(/venture_type:\s*(\S+)/i);
  if (ventureMatch) return 'venture';

  return null;
}

/**
 * Normalize a raw type string to a recognized Room type.
 * @param {string} raw - Raw type value from frontmatter
 * @returns {string} Normalized type
 */
function normalizeType(raw) {
  const cleaned = (raw || '').toLowerCase().replace(/['"]/g, '').trim();
  if (VALID_ROOM_TYPES.includes(cleaned)) return cleaned;

  // Fuzzy matching for common aliases
  if (['startup', 'company', 'business', 'venture-capital'].includes(cleaned)) return 'venture';
  if (['web', 'site', 'design', 'ui', 'frontend'].includes(cleaned)) return 'website';
  if (['academic', 'science', 'study', 'lab', 'clinical'].includes(cleaned)) return 'research';

  return cleaned; // Let caller check VALID_ROOM_TYPES
}

/**
 * Build a content sample string from Section entries for keyword detection.
 * Samples up to 3 entries per Section, first 500 chars each.
 * @param {Array} sections - Section metadata with optional entries
 * @returns {string} Concatenated content sample
 */
function buildContentSample(sections) {
  const chunks = [];
  for (const section of sections) {
    if (!section.entries || !Array.isArray(section.entries)) continue;
    const sample = section.entries.slice(0, 3);
    for (const entry of sample) {
      if (entry.content) {
        chunks.push(entry.content.slice(0, 500));
      }
    }
  }
  return chunks.join(' ');
}

/**
 * Get the full ROOM_TYPE_CONFIG for a detected Room type.
 * @param {string} roomType - One of VALID_ROOM_TYPES
 * @returns {Object} Config object with statsBar, hubTitle, sectionLabels, insightTypes, graphLabel
 */
function getRoomTypeConfig(roomType) {
  return ROOM_TYPE_CONFIG[roomType] || ROOM_TYPE_CONFIG.general;
}

/**
 * Get the display label for a Section within a Room type context.
 * Falls back to Title Case of the section id.
 * @param {string} roomType - Room type
 * @param {string} sectionId - Section directory name (kebab-case)
 * @returns {string} Display label
 */
function getSectionLabel(roomType, sectionId) {
  const config = getRoomTypeConfig(roomType);
  if (config.sectionLabels[sectionId]) {
    return config.sectionLabels[sectionId];
  }
  // Fallback: Title Case from kebab-case
  return sectionId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// CLI interface
if (require.main === module) {
  const fs = require('fs');
  const path = require('path');

  const args = process.argv.slice(2);
  if (args.length < 1) {
    process.stderr.write('Usage: node room-type-detector.cjs <ROOM_PATH>\n');
    process.exit(1);
  }

  const roomDir = path.resolve(args[0]);
  const statePath = path.join(roomDir, 'STATE.md');

  let stateContent = '';
  try { stateContent = fs.readFileSync(statePath, 'utf-8'); } catch (_) {}

  // Build section list from directory scan
  const sections = [];
  try {
    const entries = fs.readdirSync(roomDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const sectionDir = path.join(roomDir, entry.name);
      const sectionEntries = [];
      try {
        const files = fs.readdirSync(sectionDir).filter(f => f.endsWith('.md'));
        for (const f of files.slice(0, 3)) {
          try {
            const content = fs.readFileSync(path.join(sectionDir, f), 'utf-8');
            sectionEntries.push({ content });
          } catch (_) {}
        }
      } catch (_) {}
      sections.push({ name: entry.name, entries: sectionEntries });
    }
  } catch (_) {}

  const roomType = detectRoomType(stateContent, sections);
  const config = getRoomTypeConfig(roomType);

  const result = { roomType, config };
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

module.exports = {
  ROOM_TYPE_CONFIG,
  VALID_ROOM_TYPES,
  detectRoomType,
  getRoomTypeConfig,
  getSectionLabel,
};
