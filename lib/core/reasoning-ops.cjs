/**
 * MindrianOS Plugin -- Reasoning Engine Operations
 * Core operations for .reasoning/ artifacts: REASONING.md generation,
 * frontmatter CRUD (get/set/merge), methodology run artifacts, status listing.
 * Pure Node.js built-ins only (zero npm deps per Phase 10 decision).
 *
 * Follows persona-ops.cjs module pattern exactly.
 * Enhanced parseFrontmatter handles 2-3 levels of nesting (confidence.high,
 * requires as array of objects, verification.must_be_true as nested list).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { discoverSections } = require('./section-registry.cjs');
const { safeReadFile } = require('./index.cjs');

// ---------------------------------------------------------------------------
// Plugin root (for template loading)
// ---------------------------------------------------------------------------

const PLUGIN_ROOT = path.resolve(__dirname, '../..');

// ---------------------------------------------------------------------------
// Enhanced frontmatter parser (handles 2-3 levels of nesting)
// ---------------------------------------------------------------------------

/**
 * Parse YAML frontmatter from a markdown string.
 * Enhanced version: handles nested objects, arrays of objects, and inline arrays.
 * Supports the locked reasoning schema (confidence.high is list, requires is
 * list of objects, verification.must_be_true is nested list).
 *
 * @param {string} content
 * @returns {Object}
 */
function parseFrontmatter(content) {
  if (!content || typeof content !== 'string') return {};

  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const yaml = match[1];
  const lines = yaml.split('\n');
  const result = {};

  // Stack-based approach for nested structures
  let currentTopKey = null;
  let currentSubKey = null;
  let currentList = null;
  let currentObj = null;       // For sub-object within a parent key (e.g., confidence)
  let currentObjList = null;   // For list of objects (e.g., requires)
  let pendingListItem = null;  // For multi-line list items (objects in list)

  function flushState() {
    if (currentObjList !== null && currentTopKey) {
      if (pendingListItem) {
        currentObjList.push(pendingListItem);
        pendingListItem = null;
      }
      result[currentTopKey] = currentObjList;
      currentObjList = null;
    } else if (currentObj !== null && currentTopKey) {
      result[currentTopKey] = currentObj;
      currentObj = null;
    } else if (currentList !== null && currentTopKey) {
      result[currentTopKey] = currentList;
      currentList = null;
    }
    currentSubKey = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimEnd();

    // Calculate indentation
    const indent = line.length - line.trimStart().length;

    // Top-level key: value (no indentation)
    if (indent === 0 && /^[a-z_]/.test(trimmed)) {
      flushState();

      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) continue;

      currentTopKey = trimmed.slice(0, colonIdx).trim();
      const val = trimmed.slice(colonIdx + 1).trim();

      if (val === '' || val === 'null') {
        // Could be followed by nested content — don't assign yet
        result[currentTopKey] = null;
      } else if (val.startsWith('[') && val.endsWith(']')) {
        // Inline array: ["a", "b"]
        try {
          result[currentTopKey] = JSON.parse(val);
        } catch (e) {
          // Try manual parse for unquoted items
          const inner = val.slice(1, -1);
          result[currentTopKey] = inner.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
        }
        currentTopKey = null;
      } else if (val === 'true') {
        result[currentTopKey] = true;
      } else if (val === 'false') {
        result[currentTopKey] = false;
      } else if (/^-?\d+(\.\d+)?$/.test(val)) {
        result[currentTopKey] = parseFloat(val);
      } else {
        result[currentTopKey] = val.replace(/^["']|["']$/g, '');
      }
      continue;
    }

    if (!currentTopKey) continue;

    // Indent level 2 (2 spaces): sub-key or list item
    if (indent === 2) {
      const stripped = trimmed.trimStart();

      // List item: "- something"
      const listItemMatch = stripped.match(/^-\s+(.*)$/);
      if (listItemMatch) {
        const itemVal = listItemMatch[1].trim();

        // Check if this is a key-value list item: "- section: value"
        const kvMatch = itemVal.match(/^([a-z_]+):\s*(.+)$/);
        if (kvMatch) {
          // This is part of a list of objects (e.g., requires)
          if (currentObjList === null) {
            currentObjList = [];
          }
          if (pendingListItem) {
            currentObjList.push(pendingListItem);
          }
          pendingListItem = {};
          pendingListItem[kvMatch[1]] = parseValue(kvMatch[2]);
        } else {
          // Simple list item (string)
          if (currentList === null) currentList = [];
          currentList.push(parseValue(itemVal));
        }
        continue;
      }

      // Sub-key: "key: value" (nested object like confidence or verification)
      const subKeyMatch = stripped.match(/^([a-z_]+):\s*(.*)$/);
      if (subKeyMatch) {
        // Flush any pending list of objects
        if (currentObjList !== null) {
          if (pendingListItem) {
            currentObjList.push(pendingListItem);
            pendingListItem = null;
          }
          // This shouldn't happen in our schema, but handle gracefully
        }

        if (currentObj === null) currentObj = {};
        currentSubKey = subKeyMatch[1];
        const subVal = subKeyMatch[2].trim();

        if (subVal === '' || subVal === 'null') {
          currentObj[currentSubKey] = null;
        } else if (subVal.startsWith('[') && subVal.endsWith(']')) {
          // Inline array
          try {
            currentObj[currentSubKey] = JSON.parse(subVal);
          } catch (e) {
            const inner = subVal.slice(1, -1);
            currentObj[currentSubKey] = inner.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
          }
          currentSubKey = null;
        } else if (subVal === 'true') {
          currentObj[currentSubKey] = true;
        } else if (subVal === 'false') {
          currentObj[currentSubKey] = false;
        } else {
          currentObj[currentSubKey] = parseValue(subVal);
        }
        continue;
      }
    }

    // Indent level 4 (4 spaces): sub-sub content
    if (indent === 4) {
      const trimmedItem = trimmed.trim();

      // Key-value continuation of a list item object: "    provides: value"
      if (pendingListItem) {
        const kvMatch = trimmedItem.match(/^([a-z_]+):\s*(.+)$/);
        if (kvMatch) {
          pendingListItem[kvMatch[1]] = parseValue(kvMatch[2]);
          continue;
        }
      }

      // Sub-list item: "    - value" (under a sub-key like verification.must_be_true)
      const subListMatch = trimmedItem.match(/^-\s+(.+)$/);
      if (subListMatch && currentObj && currentSubKey) {
        if (!Array.isArray(currentObj[currentSubKey])) {
          currentObj[currentSubKey] = [];
        }
        currentObj[currentSubKey].push(parseValue(subListMatch[1]));
        continue;
      }
    }
  }

  // Final flush
  flushState();

  return result;
}

/**
 * Parse a YAML scalar value (string, number, boolean).
 * @param {string} val
 * @returns {*}
 */
function parseValue(val) {
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (val === 'null' || val === '') return null;
  if (/^-?\d+(\.\d+)?$/.test(val)) return parseFloat(val);
  return val.replace(/^["']|["']$/g, '');
}

// ---------------------------------------------------------------------------
// Frontmatter reconstruction (serialize object back to YAML)
// ---------------------------------------------------------------------------

/**
 * Reconstruct a frontmatter object back to a YAML string.
 * Handles nested objects, arrays of objects, arrays of strings, inline arrays.
 *
 * @param {Object} obj
 * @returns {string}
 */
function reconstructFrontmatter(obj) {
  const lines = [];

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      lines.push(`${key}:`);
    } else if (typeof value === 'boolean') {
      lines.push(`${key}: ${value}`);
    } else if (typeof value === 'number') {
      lines.push(`${key}: ${value}`);
    } else if (typeof value === 'string') {
      // Quote strings that contain special YAML chars
      if (value.includes(':') || value.includes('#') || value.includes('"')) {
        lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    } else if (Array.isArray(value)) {
      // Check if all items are simple strings/numbers (use inline for short arrays)
      const allSimple = value.every(v => typeof v === 'string' || typeof v === 'number');
      const isShortInline = allSimple && JSON.stringify(value).length < 80;

      if (allSimple && isShortInline && value.length <= 4) {
        // Inline array: affects: ["a", "b"]
        lines.push(`${key}: ${JSON.stringify(value)}`);
      } else if (allSimple) {
        // Block list
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - "${item}"`);
        }
      } else {
        // Array of objects
        lines.push(`${key}:`);
        for (const item of value) {
          if (typeof item === 'object' && item !== null) {
            const entries = Object.entries(item);
            if (entries.length > 0) {
              lines.push(`  - ${entries[0][0]}: ${serializeScalar(entries[0][1])}`);
              for (let j = 1; j < entries.length; j++) {
                lines.push(`    ${entries[j][0]}: ${serializeScalar(entries[j][1])}`);
              }
            }
          } else {
            lines.push(`  - ${serializeScalar(item)}`);
          }
        }
      }
    } else if (typeof value === 'object') {
      // Nested object (like confidence, verification)
      lines.push(`${key}:`);
      for (const [subKey, subVal] of Object.entries(value)) {
        if (Array.isArray(subVal)) {
          const allStr = subVal.every(v => typeof v === 'string' || typeof v === 'number');
          if (allStr && JSON.stringify(subVal).length < 80) {
            lines.push(`  ${subKey}: ${JSON.stringify(subVal)}`);
          } else {
            lines.push(`  ${subKey}:`);
            for (const item of subVal) {
              lines.push(`    - "${item}"`);
            }
          }
        } else {
          lines.push(`  ${subKey}: ${serializeScalar(subVal)}`);
        }
      }
    }
  }

  return lines.join('\n');
}

/**
 * Serialize a scalar value for YAML output.
 * @param {*} val
 * @returns {string}
 */
function serializeScalar(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return String(val);
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') {
    if (val.includes(':') || val.includes('#') || val.includes('"')) {
      return `"${val.replace(/"/g, '\\"')}"`;
    }
    return `"${val}"`;
  }
  return String(val);
}

// ---------------------------------------------------------------------------
// Frontmatter splicing (replace frontmatter in content)
// ---------------------------------------------------------------------------

/**
 * Replace frontmatter in a markdown content string.
 * @param {string} content - Full markdown content
 * @param {Object} newObj - New frontmatter object
 * @returns {string} - Content with updated frontmatter
 */
function spliceFrontmatter(content, newObj) {
  const yamlStr = reconstructFrontmatter(newObj);
  const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---/, '').trimStart();
  return `---\n${yamlStr}\n---\n\n${body}`;
}

// ---------------------------------------------------------------------------
// Template loading
// ---------------------------------------------------------------------------

/**
 * Load the REASONING.md template from references.
 * @returns {string}
 */
function loadReasoningTemplate() {
  const templatePath = path.join(PLUGIN_ROOT, 'references', 'reasoning', 'reasoning-template.md');
  const content = safeReadFile(templatePath);
  if (!content) throw new Error('Reasoning template not found at ' + templatePath);
  return content;
}

/**
 * Load the methodology run template from references.
 * @returns {string}
 */
function loadRunTemplate() {
  const templatePath = path.join(PLUGIN_ROOT, 'references', 'reasoning', 'run-template.md');
  const content = safeReadFile(templatePath);
  if (!content) throw new Error('Run template not found at ' + templatePath);
  return content;
}

// ---------------------------------------------------------------------------
// Core operations
// ---------------------------------------------------------------------------

/**
 * Generate REASONING.md for one or all discovered sections.
 * Creates .reasoning/{section}/REASONING.md from template with populated frontmatter.
 *
 * @param {string} roomDir - Path to room directory
 * @param {string|null} sectionName - Specific section, or null for all
 * @returns {{ generated: string[], room_hash: string, reasoning_dir: string } | { error: string }}
 */
function generateReasoning(roomDir, sectionName) {
  const resolved = path.resolve(roomDir);
  const stateContent = safeReadFile(path.join(resolved, 'STATE.md'));
  if (!stateContent) return { error: 'No room STATE.md found' };

  const sections = discoverSections(resolved);
  if (sectionName && !sections.all.includes(sectionName)) {
    return { error: `Section not found: ${sectionName}` };
  }

  const targetSections = sectionName ? [sectionName] : sections.all;
  const reasoningDir = path.join(resolved, '.reasoning');
  fs.mkdirSync(reasoningDir, { recursive: true });

  const roomHash = crypto.createHash('md5').update(stateContent).digest('hex').slice(0, 7);
  const date = new Date().toISOString().split('T')[0];
  const generated = [];

  for (const section of targetSections) {
    const sectionReasoningDir = path.join(reasoningDir, section);
    fs.mkdirSync(sectionReasoningDir, { recursive: true });

    const template = loadReasoningTemplate();
    const sectionLabel = section.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const content = template
      .replace(/\{section\}/g, section)
      .replace(/\{date\}/g, date)
      .replace(/\{hash\}/g, roomHash)
      .replace(/\{run_id\}/g, '')
      .replace(/\{Section Label\}/g, sectionLabel);

    fs.writeFileSync(path.join(sectionReasoningDir, 'REASONING.md'), content, 'utf-8');
    generated.push(section);
  }

  return { generated, room_hash: roomHash, reasoning_dir: '.reasoning/' };
}

/**
 * Get reasoning content and parsed frontmatter for a section.
 *
 * @param {string} roomDir
 * @param {string} section
 * @returns {{ section: string, content: string, frontmatter: Object } | { error: string }}
 */
function getReasoning(roomDir, section) {
  const resolved = path.resolve(roomDir);
  const reasoningPath = path.join(resolved, '.reasoning', section, 'REASONING.md');
  const content = safeReadFile(reasoningPath);

  if (!content) return { error: `No reasoning found for section: ${section}` };

  const frontmatter = parseFrontmatter(content);
  return { section, content, frontmatter };
}

/**
 * List all discovered sections with reasoning status.
 *
 * @param {string} roomDir
 * @returns {Array<{ section: string, has_reasoning: boolean, generated?: string, verification_status?: string, confidence_summary?: Object, brain_enriched?: boolean, room_hash?: string }>}
 */
function listReasoning(roomDir) {
  const resolved = path.resolve(roomDir);
  const reasoningDir = path.join(resolved, '.reasoning');
  const sections = discoverSections(resolved);

  return sections.all.map(section => {
    const reasoningPath = path.join(reasoningDir, section, 'REASONING.md');
    const content = safeReadFile(reasoningPath);
    if (!content) return { section, has_reasoning: false };

    const fm = parseFrontmatter(content);
    return {
      section,
      has_reasoning: true,
      generated: fm.generated || null,
      verification_status: (fm.verification && fm.verification.status) || 'unknown',
      confidence_summary: {
        high: Array.isArray(fm.confidence && fm.confidence.high) ? fm.confidence.high.length : 0,
        medium: Array.isArray(fm.confidence && fm.confidence.medium) ? fm.confidence.medium.length : 0,
        low: Array.isArray(fm.confidence && fm.confidence.low) ? fm.confidence.low.length : 0,
      },
      brain_enriched: fm.brain_enriched === true || fm.brain_enriched === 'true',
      room_hash: fm.room_hash || null,
    };
  });
}

/**
 * Verify reasoning for a section: returns verification criteria and dependency info.
 *
 * @param {string} roomDir
 * @param {string} sectionName
 * @returns {{ section: string, criteria: string[], status: string, provides: string[], requires: Array, affects: string[] } | { error: string }}
 */
function verifyReasoning(roomDir, sectionName) {
  const resolved = path.resolve(roomDir);
  const reasoningPath = path.join(resolved, '.reasoning', sectionName, 'REASONING.md');
  const content = safeReadFile(reasoningPath);

  if (!content) return { error: `No reasoning found for section: ${sectionName}` };

  const fm = parseFrontmatter(content);
  const criteria = (fm.verification && fm.verification.must_be_true) || [];

  return {
    section: sectionName,
    criteria,
    status: (fm.verification && fm.verification.status) || 'pending',
    provides: fm.provides || [],
    requires: fm.requires || [],
    affects: fm.affects || [],
  };
}

/**
 * Create a methodology run artifact in .reasoning/runs/.
 * Generates a sequential run ID: run-{date}-{seq}.
 *
 * @param {string} roomDir
 * @param {string} section
 * @returns {{ run_id: string, path: string } | { error: string }}
 */
function createRun(roomDir, section) {
  const resolved = path.resolve(roomDir);
  const stateContent = safeReadFile(path.join(resolved, 'STATE.md'));
  if (!stateContent) return { error: 'No room STATE.md found' };

  const runsDir = path.join(resolved, '.reasoning', 'runs');
  fs.mkdirSync(runsDir, { recursive: true });

  const date = new Date().toISOString().split('T')[0];
  const roomHash = crypto.createHash('md5').update(stateContent).digest('hex').slice(0, 7);

  // Find next sequential ID for today
  let seq = 1;
  try {
    const existing = fs.readdirSync(runsDir).filter(f => f.startsWith(`run-${date}-`));
    if (existing.length > 0) {
      const nums = existing.map(f => {
        const m = f.match(/run-\d{4}-\d{2}-\d{2}-(\d+)/);
        return m ? parseInt(m[1], 10) : 0;
      });
      seq = Math.max(...nums) + 1;
    }
  } catch (e) {
    // directory might not exist yet
  }

  const runId = `run-${date}-${String(seq).padStart(3, '0')}`;
  const started = new Date().toISOString();
  const sectionLabel = section.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const template = loadRunTemplate();
  const content = template
    .replace(/\{run_id\}/g, runId)
    .replace(/\{section\}/g, section)
    .replace(/\{started\}/g, started)
    .replace(/\{completed\}/g, '')
    .replace(/\{hash\}/g, roomHash)
    .replace(/\{Section Label\}/g, sectionLabel);

  const runPath = path.join(runsDir, `${runId}.md`);
  fs.writeFileSync(runPath, content, 'utf-8');

  return { run_id: runId, path: `.reasoning/runs/${runId}.md` };
}

// ---------------------------------------------------------------------------
// Frontmatter CRUD (REASON-05)
// ---------------------------------------------------------------------------

/**
 * Get frontmatter from a section's REASONING.md, optionally a specific field.
 *
 * @param {string} roomDir
 * @param {string} section
 * @param {string} [field] - Optional specific field
 * @returns {Object}
 */
function getReasoningFrontmatter(roomDir, section, field) {
  const resolved = path.resolve(roomDir);
  const filePath = path.join(resolved, '.reasoning', section, 'REASONING.md');
  const content = safeReadFile(filePath);
  if (!content) return { error: `No reasoning for section: ${section}` };

  const fm = parseFrontmatter(content);
  if (field) {
    return field in fm ? { [field]: fm[field] } : { error: `Field not found: ${field}` };
  }
  return fm;
}

/**
 * Set a specific frontmatter field in a section's REASONING.md.
 *
 * @param {string} roomDir
 * @param {string} section
 * @param {string} field
 * @param {*} value
 * @returns {{ updated: boolean, section: string, field: string, value: * } | { error: string }}
 */
function setReasoningFrontmatter(roomDir, section, field, value) {
  const resolved = path.resolve(roomDir);
  const filePath = path.join(resolved, '.reasoning', section, 'REASONING.md');
  const content = safeReadFile(filePath);
  if (!content) return { error: `No reasoning for section: ${section}` };

  const fm = parseFrontmatter(content);
  fm[field] = value;
  const newContent = spliceFrontmatter(content, fm);
  fs.writeFileSync(filePath, newContent, 'utf-8');
  return { updated: true, section, field, value };
}

/**
 * Merge an object into a section's REASONING.md frontmatter.
 *
 * @param {string} roomDir
 * @param {string} section
 * @param {Object} data - Object to merge
 * @returns {{ merged: boolean, section: string, fields: string[] } | { error: string }}
 */
function mergeReasoningFrontmatter(roomDir, section, data) {
  const resolved = path.resolve(roomDir);
  const filePath = path.join(resolved, '.reasoning', section, 'REASONING.md');
  const content = safeReadFile(filePath);
  if (!content) return { error: `No reasoning for section: ${section}` };

  const fm = parseFrontmatter(content);
  const fields = [];
  for (const [key, value] of Object.entries(data)) {
    fm[key] = value;
    fields.push(key);
  }
  const newContent = spliceFrontmatter(content, fm);
  fs.writeFileSync(filePath, newContent, 'utf-8');
  return { merged: true, section, fields };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  generateReasoning,
  getReasoning,
  listReasoning,
  verifyReasoning,
  createRun,
  getReasoningFrontmatter,
  setReasoningFrontmatter,
  mergeReasoningFrontmatter,
};
