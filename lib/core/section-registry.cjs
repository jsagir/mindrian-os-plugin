/**
 * MindrianOS Plugin - Section Registry
 * Metadata for DD-aligned sections + dynamic discovery.
 * Pure Node.js built-ins only.
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * 11 DD-aligned core sections with label and De Stijl color.
 * Sourced from build-graph SECTION_COLORS/SECTION_LABELS.
 * Phase 275 (D-01): promoted opportunity-bank + funding from EXTENDED_SECTION_META; minted strategy.
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
  'opportunity-bank':      { label: 'OPPORTUNITY BANK',      color: '#8B6914' },
  'funding':               { label: 'FUNDING',               color: '#1A5276' },
  'strategy':              { label: 'STRATEGY',              color: '#8B2942' },
};

/**
 * Pre-assigned metadata for known extension sections.
 */
const EXTENDED_SECTION_META = {
  'personas':         { label: 'PERSONAS',         color: '#6C3483' },
};

/**
 * Directories that are structural (not sections). `references` (Phase 275,
 * D-01) is the new ICM L3 factory directory: stable factory recipe material,
 * not a destination that accumulates methodology content -- the same
 * distinction that already keeps `meetings` structural.
 */
const STRUCTURAL_DIRS = ['meetings', 'team', 'references'];

// Phase 169 GDH-03/04 (D-169-07): the single source of truth for the
// artifact-extension filter. Accepts .md/.docx/.html/.htm while excluding the
// identity files STATE.md / ROOM.md (and any dot-prefixed file). Lives here in
// section-registry (zero deps) so both the section-qualification pass below and
// lazygraph-ops.cjs (which already requires this module) share ONE predicate
// with no drift. Semantics are byte-equivalent to the former local
// _isIndexableArtifactFile in lazygraph-ops.cjs.
function isIndexableArtifactFile(name) {
  if (typeof name !== 'string' || name.length === 0) return false;
  // CONTEXT.md (Phase 275) is an ICM L2 contract file, a sibling of the L0
  // ROOM.md identity file, not an L4 artifact -- excluded from indexing here.
  if (name === 'STATE.md' || name === 'ROOM.md' || name === 'CONTEXT.md') return false;
  if (name.startsWith('.')) return false;
  return /\.(md|docx|html|htm)$/i.test(name);
}

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

    // Nested-artifact qualification (CLAUDE.md decision #16, v1.9.7): under the
    // Obsidian-nested convention every artifact sits in its own subfolder
    // (section/name/name.md), so a section can have ZERO direct .md files yet
    // still hold real artifacts one level down. If the flat check above found
    // nothing, descend ONE level: any immediate child directory (not
    // dot-prefixed, and NOT a sub-room carrying a .room-root sentinel) that
    // holds an indexable artifact qualifies the section. First hit wins.
    let hasNestedArtifacts = false;
    if (!hasStateMd && !hasMdFiles) {
      let children;
      try {
        children = fs.readdirSync(dirPath, { withFileTypes: true });
      } catch (e) {
        continue; // skip unreadable dirs
      }
      for (const child of children) {
        if (!child.isDirectory()) continue;
        if (child.name.startsWith('.')) continue;
        const childPath = path.join(dirPath, child.name);
        // A sub-room (own .room-root sentinel) must NOT qualify its parent as a
        // section; the sub-room owns its own room.db and rebuild pass.
        if (fs.existsSync(path.join(childPath, '.room-root'))) continue;
        try {
          const childFiles = fs.readdirSync(childPath);
          if (childFiles.some(isIndexableArtifactFile)) {
            hasNestedArtifacts = true;
            break;
          }
        } catch (e) {
          // skip unreadable child dirs
          continue;
        }
      }
    }

    if (!hasStateMd && !hasMdFiles && !hasNestedArtifacts) continue;

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
    // Unknown extension - generate label from name
    return {
      label: name.replace(/-/g, ' ').toUpperCase(),
      color: '#555555',
      type: 'extended',
    };
  }

  return { core, extended, all, getMeta };
}

module.exports = { CORE_SECTIONS, EXTENDED_SECTION_META, STRUCTURAL_DIRS, discoverSections, isIndexableArtifactFile };
