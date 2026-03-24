/**
 * MindrianOS Plugin -- Opportunity Bank + Funding Operations
 * Core operations for opportunity-bank/ and funding/ room sections.
 * Pure Node.js built-ins only (zero npm deps per Phase 10 decision).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { discoverSections } = require('./section-registry.cjs');

/**
 * Parse YAML frontmatter from a markdown string.
 * Simple regex/split parsing (no yaml library -- follows existing codebase pattern).
 * Handles scalar values, simple lists (- item), and nested objects.
 *
 * @param {string} content - Markdown file content
 * @returns {Object} Parsed frontmatter key-value pairs
 */
function parseFrontmatter(content) {
  if (!content || typeof content !== 'string') return {};

  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const yaml = match[1];
  const result = {};
  const lines = yaml.split('\n');

  let currentKey = null;
  let currentList = null;
  let currentObj = null;
  let currentObjKey = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Top-level key: value
    const topMatch = line.match(/^([a-z_]+):\s*(.*)$/);
    if (topMatch) {
      // Flush any pending list/object
      if (currentList !== null && currentKey) {
        result[currentKey] = currentList;
        currentList = null;
      }
      if (currentObj !== null && currentObjKey !== null) {
        if (!result[currentKey]) result[currentKey] = [];
        result[currentKey].push(currentObj);
        currentObj = null;
        currentObjKey = null;
      }

      currentKey = topMatch[1];
      const val = topMatch[2].trim();

      if (val === '' || val === 'null') {
        // Could be a list or object starting on next line
        result[currentKey] = null;
      } else if (val === 'true') {
        result[currentKey] = true;
      } else if (val === 'false') {
        result[currentKey] = false;
      } else if (/^-?\d+(\.\d+)?$/.test(val)) {
        result[currentKey] = parseFloat(val);
      } else {
        // Remove surrounding quotes if present
        result[currentKey] = val.replace(/^["']|["']$/g, '');
      }
      continue;
    }

    // List item (  - value)
    const listMatch = line.match(/^\s+-\s+(.+)$/);
    if (listMatch && currentKey) {
      if (currentList === null) currentList = [];

      const itemVal = listMatch[1].trim();

      // Check if this is a nested object field (  - key: value)
      const nestedMatch = itemVal.match(/^([a-z_]+):\s*(.+)$/);
      if (nestedMatch) {
        // Flush previous object if starting a new one
        if (currentObj !== null) {
          if (!Array.isArray(result[currentKey])) result[currentKey] = [];
          result[currentKey].push(currentObj);
        }
        currentObj = {};
        currentObjKey = currentKey;
        currentObj[nestedMatch[1]] = nestedMatch[2].replace(/^["']|["']$/g, '').trim();
      } else {
        // Simple list item
        currentList.push(itemVal.replace(/^["']|["']$/g, ''));
      }
      continue;
    }

    // Nested object field (    key: value) -- continuation of a list object
    const nestedFieldMatch = line.match(/^\s{4,}([a-z_]+):\s*(.+)$/);
    if (nestedFieldMatch && currentObj !== null) {
      currentObj[nestedFieldMatch[1]] = nestedFieldMatch[2].replace(/^["']|["']$/g, '').trim();
      continue;
    }
  }

  // Flush any pending list/object
  if (currentList !== null && currentKey) {
    result[currentKey] = currentList;
  }
  if (currentObj !== null && currentKey) {
    if (!Array.isArray(result[currentKey])) result[currentKey] = [];
    result[currentKey].push(currentObj);
  }

  return result;
}

/**
 * Parse opportunity artifact frontmatter.
 * @param {string} content - Opportunity markdown file content
 * @returns {Object} Parsed opportunity fields
 */
function parseOpportunityFrontmatter(content) {
  return parseFrontmatter(content);
}

/**
 * Parse funding STATUS.md frontmatter.
 * @param {string} content - STATUS.md file content
 * @returns {{ stage: string|null, outcome: string|null, source_opportunity: string|null, deadline: string|null, last_updated: string|null, transition_history: Array|null }}
 */
function parseFundingStatus(content) {
  const fm = parseFrontmatter(content);
  return {
    stage: fm.stage || null,
    outcome: fm.outcome || null,
    source_opportunity: fm.source_opportunity || null,
    deadline: fm.deadline || null,
    last_updated: fm.last_updated || null,
    transition_history: fm.transition_history || null,
  };
}

/**
 * List opportunities in room/opportunity-bank/.
 * Scans for .md files (excluding STATE.md), parses frontmatter for each.
 *
 * @param {string} roomDir - Path to room directory
 * @returns {{ opportunities: Array<{filename, funder, program, deadline, relevance_score, status}>, count: number }}
 */
function listOpportunities(roomDir) {
  const oppDir = path.join(path.resolve(roomDir), 'opportunity-bank');
  if (!fs.existsSync(oppDir)) return { opportunities: [], count: 0 };

  let files;
  try {
    files = fs.readdirSync(oppDir).filter(f => f.endsWith('.md') && f !== 'STATE.md');
  } catch (e) {
    return { opportunities: [], count: 0 };
  }

  const opportunities = files.map(filename => {
    const filePath = path.join(oppDir, filename);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const fm = parseOpportunityFrontmatter(content);
      return {
        filename,
        funder: fm.funder || null,
        program: fm.program || null,
        deadline: fm.deadline || null,
        relevance_score: fm.relevance_score != null ? fm.relevance_score : null,
        status: fm.status || null,
      };
    } catch (e) {
      return { filename, funder: null, program: null, deadline: null, relevance_score: null, status: null };
    }
  });

  return { opportunities, count: opportunities.length };
}

/**
 * List funding entries in room/funding/.
 * Scans for subdirectories, reads STATUS.md from each.
 *
 * @param {string} roomDir - Path to room directory
 * @returns {{ entries: Array<{name, stage, outcome, deadline, source_opportunity}>, count: number }}
 */
function listFunding(roomDir) {
  const fundDir = path.join(path.resolve(roomDir), 'funding');
  if (!fs.existsSync(fundDir)) return { entries: [], count: 0 };

  let dirEntries;
  try {
    dirEntries = fs.readdirSync(fundDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && !e.name.startsWith('.'));
  } catch (e) {
    return { entries: [], count: 0 };
  }

  const entries = dirEntries.map(entry => {
    const statusPath = path.join(fundDir, entry.name, 'STATUS.md');
    try {
      const content = fs.readFileSync(statusPath, 'utf-8');
      const st = parseFundingStatus(content);
      return {
        name: entry.name,
        stage: st.stage,
        outcome: st.outcome,
        deadline: st.deadline,
        source_opportunity: st.source_opportunity,
      };
    } catch (e) {
      return { name: entry.name, stage: null, outcome: null, deadline: null, source_opportunity: null };
    }
  });

  return { entries, count: entries.length };
}

/**
 * Read opportunity-bank/STATE.md content.
 * @param {string} roomDir - Path to room directory
 * @returns {string|null} STATE.md content or null if missing
 */
function getOpportunityBankState(roomDir) {
  const statePath = path.join(path.resolve(roomDir), 'opportunity-bank', 'STATE.md');
  try {
    return fs.readFileSync(statePath, 'utf-8');
  } catch (e) {
    return null;
  }
}

/**
 * Read funding/STATE.md content.
 * @param {string} roomDir - Path to room directory
 * @returns {string|null} STATE.md content or null if missing
 */
function getFundingState(roomDir) {
  const statePath = path.join(path.resolve(roomDir), 'funding', 'STATE.md');
  try {
    return fs.readFileSync(statePath, 'utf-8');
  } catch (e) {
    return null;
  }
}

module.exports = {
  listOpportunities,
  listFunding,
  parseOpportunityFrontmatter,
  parseFundingStatus,
  getOpportunityBankState,
  getFundingState,
};
