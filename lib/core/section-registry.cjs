/**
 * MindrianOS Plugin — Section Registry
 * Metadata for DD-aligned sections + dynamic discovery.
 * Pure Node.js built-ins only.
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * 8 DD-aligned core sections with label and De Stijl color.
 * Sourced from build-graph SECTION_COLORS/SECTION_LABELS.
 */
const CORE_SECTIONS = {
  'problem-definition':    { label: 'PROBLEM DEFINITION',    color: '#A63D2F' },
  'market-analysis':       { label: 'MARKET ANALYSIS',       color: '#C8A43C' },
  'solution-design':       { label: 'SOLUTION DESIGN',       color: '#5C5A56' },
  'business-model':        { label: 'BUSINESS MODEL',        color: '#2D6B4A' },
  'competitive-analysis':  { label: 'COMPETITIVE ANALYSIS',  color: '#B5602A' },
  'team-execution':        { label: 'TEAM & EXECUTION',      color: '#1E3A6E' },
  'legal-ip':              { label: 'LEGAL & IP',            color: '#6B4E8B' },
  'financial-model':       { label: 'FINANCIAL MODEL',       color: '#2A6B5E' },
};

/**
 * Pre-assigned metadata for known extension sections.
 */
const EXTENDED_SECTION_META = {
  'opportunity-bank': { label: 'OPPORTUNITY BANK', color: '#8B6914' },
  'funding':          { label: 'FUNDING',          color: '#1A5276' },
  'personas':         { label: 'PERSONAS',         color: '#6C3483' },
};

/**
 * Directories that are structural (not sections).
 */
const STRUCTURAL_DIRS = ['meetings', 'team'];

/**
 * Discover sections in a room directory.
 * A directory qualifies as a section if it contains at least one .md file
 * or has a STATE.md. Excludes hidden dirs and structural dirs.
 *
 * @param {string} roomDir - Absolute or relative path to room directory
 * @returns {{ core: string[], extended: string[], all: string[], getMeta: function }}
 */
function discoverSections(roomDir) {
  const resolved = path.resolve(roomDir);
  const core = [];
  const extended = [];

  let entries;
  try {
    entries = fs.readdirSync(resolved, { withFileTypes: true });
  } catch (e) {
    return { core, extended, all: [], getMeta: () => null };
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;

    // Skip hidden directories
    if (name.startsWith('.')) continue;

    // Skip structural directories
    if (STRUCTURAL_DIRS.includes(name)) continue;

    const dirPath = path.join(resolved, name);

    // Check if directory qualifies as a section
    const hasStateMd = fs.existsSync(path.join(dirPath, 'STATE.md'));
    let hasMdFiles = false;
    if (!hasStateMd) {
      try {
        const files = fs.readdirSync(dirPath);
        hasMdFiles = files.some(f => f.endsWith('.md'));
      } catch (e) {
        // skip unreadable dirs
        continue;
      }
    }

    if (!hasStateMd && !hasMdFiles) continue;

    if (CORE_SECTIONS[name]) {
      core.push(name);
    } else {
      extended.push(name);
    }
  }

  const all = [...core, ...extended];

  function getMeta(name) {
    if (CORE_SECTIONS[name]) return { ...CORE_SECTIONS[name], type: 'core' };
    if (EXTENDED_SECTION_META[name]) return { ...EXTENDED_SECTION_META[name], type: 'extended' };
    // Unknown extension — generate label from name
    return {
      label: name.replace(/-/g, ' ').toUpperCase(),
      color: '#555555',
      type: 'extended',
    };
  }

  return { core, extended, all, getMeta };
}

module.exports = { CORE_SECTIONS, EXTENDED_SECTION_META, STRUCTURAL_DIRS, discoverSections };
