#!/usr/bin/env node
'use strict';

/*
 * Phase 108-04 - aliases.yml schema validator.
 *
 * Implements: RECONCILE-108-05 (the YAML data layer; the hook itself ships in 108-05).
 *
 * Asserts that .planning/phases/108-graph-memory-schema-reconciliation/aliases.yml:
 *   1. Parses successfully via the in-house YAML parser (no js-yaml dep).
 *   2. Has top-level keys: schema_version (= 1), phase (= 108), canon_part (= 9),
 *      edge_aliases (array), node_aliases (array), status_aliases (map).
 *   3. Every edge_aliases + node_aliases entry has codex_term, resolution, canonical_name, canon_parts.
 *   4. resolution is exactly one of EXISTS|EXTEND|NEW|RESERVED.
 *   5. canon_parts is a non-empty list (Plan 108-06 cross-ref test enforces deeper).
 *   6. RESERVED entries carry deferred_to_phase.
 *   7. EXTEND entries with direction have direction in {forward, reverse}.
 *   8. status_aliases contains the 4 canonical mappings.
 *   9. Every entry in lib/core/lazygraph-ops.cjs:25 EDGE_TYPES appears as a canonical_name in edge_aliases (RESEARCH 2.4 + Pitfall 3).
 *  10. Zero em-dashes or en-dashes (project hard rule).
 *
 * Exit 0 = PASS. Exit 1 = FAIL.
 *
 * Pattern source: tests/test-cascade-side-channel.cjs + lib/core/opportunity-ops.cjs:24-118 (YAML parser).
 */

const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');

const REPO_ROOT = path.resolve(__dirname, '..');
const ALIASES_PATH = path.join(
  REPO_ROOT,
  '.planning',
  'phases',
  '108-graph-memory-schema-reconciliation',
  'aliases.yml'
);
const LAZYGRAPH_OPS_PATH = path.join(REPO_ROOT, 'lib', 'core', 'lazygraph-ops.cjs');

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log('PASS:', name);
  } catch (e) {
    console.error('FAIL:', name, '-', e.message);
    failures += 1;
  }
}

// ----------------------------------------------------------------------------
// In-house YAML parser (zero deps; handles top-level scalars, indented maps,
// and arrays of indented maps as used by aliases.yml).
// Adapted from lib/core/opportunity-ops.cjs:24-118 frontmatter parser.
// ----------------------------------------------------------------------------
function parseAliasesYaml(content) {
  const result = {
    schema_version: null,
    phase: null,
    canon_part: null,
    edge_aliases: [],
    node_aliases: [],
    status_aliases: {}
  };

  const lines = content.split('\n');
  let section = null; // 'edge_aliases' | 'node_aliases' | 'status_aliases' | null
  let currentEntry = null; // for arrays of objects

  function pushEntry() {
    if (!currentEntry) return;
    if (section === 'edge_aliases') result.edge_aliases.push(currentEntry);
    else if (section === 'node_aliases') result.node_aliases.push(currentEntry);
    currentEntry = null;
  }

  function parseScalar(rawValue) {
    const v = rawValue.trim();
    if (v === '') return null;
    if (v.startsWith('[') && v.endsWith(']')) {
      // Inline list. Strip brackets, split on commas, trim each.
      return v.slice(1, -1).split(',').map((x) => x.trim()).filter(Boolean);
    }
    // Numeric?
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    // Quoted string?
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      return v.slice(1, -1);
    }
    return v;
  }

  for (const rawLine of lines) {
    // Strip comments (after first #) and right-trim.
    const noComment = rawLine.replace(/\s+#.*$/, '').replace(/^#.*/, '');
    const line = noComment.replace(/\s+$/, '');
    if (line === '') continue;

    // Top-level key: detected by no leading whitespace and a colon.
    const topMatch = line.match(/^([a-z_]+):\s*(.*)$/);
    if (topMatch && !line.startsWith(' ') && !line.startsWith('-')) {
      pushEntry();
      const key = topMatch[1];
      const value = topMatch[2];
      if (key === 'edge_aliases' || key === 'node_aliases' || key === 'status_aliases') {
        section = key;
        continue;
      }
      // Top-level scalar.
      section = null;
      if (key === 'schema_version' || key === 'phase' || key === 'canon_part') {
        result[key] = parseScalar(value);
      }
      continue;
    }

    // Status aliases: "  key: value" indented under "status_aliases:"
    if (section === 'status_aliases') {
      const m = line.match(/^\s+([a-z_]+):\s*([a-z_]+)\s*$/);
      if (m) {
        result.status_aliases[m[1]] = m[2];
        continue;
      }
    }

    // Array entry start (edge_aliases or node_aliases): "  - codex_term: VALUE"
    const entryStart = line.match(/^\s*-\s+([a-z_]+):\s*(.*)$/);
    if (entryStart && (section === 'edge_aliases' || section === 'node_aliases')) {
      pushEntry();
      currentEntry = {};
      currentEntry[entryStart[1]] = parseScalar(entryStart[2]);
      continue;
    }

    // Continuation of an array entry: "    key: value"
    const cont = line.match(/^\s+([a-z_]+):\s*(.*)$/);
    if (cont && currentEntry !== null) {
      currentEntry[cont[1]] = parseScalar(cont[2]);
      continue;
    }
  }
  pushEntry();
  return result;
}

// ----------------------------------------------------------------------------
// Load file + parse.
// ----------------------------------------------------------------------------

if (!fs.existsSync(ALIASES_PATH)) {
  console.error('FAIL: aliases.yml not found at', ALIASES_PATH);
  process.exit(1);
}
const aliasesContent = fs.readFileSync(ALIASES_PATH, 'utf8');
let parsed;
try {
  parsed = parseAliasesYaml(aliasesContent);
} catch (e) {
  console.error('FAIL: aliases.yml parse error:', e.message);
  process.exit(1);
}

// ----------------------------------------------------------------------------
// Tests.
// ----------------------------------------------------------------------------

const RESOLUTIONS = ['EXISTS', 'EXTEND', 'NEW', 'RESERVED'];

test('top-level schema_version is 1', () => {
  assert.equal(parsed.schema_version, 1, 'schema_version was: ' + parsed.schema_version);
});

test('top-level phase is 108', () => {
  assert.equal(parsed.phase, 108, 'phase was: ' + parsed.phase);
});

test('top-level canon_part is 9', () => {
  assert.equal(parsed.canon_part, 9, 'canon_part was: ' + parsed.canon_part);
});

test('edge_aliases is a non-empty array', () => {
  assert.ok(Array.isArray(parsed.edge_aliases), 'edge_aliases is not an array');
  assert.ok(parsed.edge_aliases.length >= 23, 'edge_aliases has only ' + parsed.edge_aliases.length + ' entries; expected >= 23 (17 Codex + 23 EDGE_TYPES with overlap; net >= 23)');
});

test('node_aliases is a non-empty array', () => {
  assert.ok(Array.isArray(parsed.node_aliases), 'node_aliases is not an array');
  assert.ok(parsed.node_aliases.length >= 14, 'node_aliases has only ' + parsed.node_aliases.length + ' entries; expected >= 14 (14 Codex + 3 existing)');
});

test('status_aliases contains all 4 canonical mappings', () => {
  const expected = { untested: 'proposed', supported: 'validated', contradicted: 'invalidated', stale: 'stale' };
  for (const [old, neu] of Object.entries(expected)) {
    assert.equal(parsed.status_aliases[old], neu, 'status_aliases[' + old + '] expected ' + neu + ', got ' + parsed.status_aliases[old]);
  }
});

test('every edge_aliases entry has codex_term, resolution, canonical_name, canon_parts', () => {
  for (const entry of parsed.edge_aliases) {
    assert.ok(entry.codex_term, 'edge entry missing codex_term: ' + JSON.stringify(entry));
    assert.ok(entry.resolution, 'edge entry missing resolution: ' + JSON.stringify(entry));
    assert.ok(entry.canonical_name, 'edge entry missing canonical_name: ' + JSON.stringify(entry));
    assert.ok(entry.canon_parts && (Array.isArray(entry.canon_parts) ? entry.canon_parts.length > 0 : entry.canon_parts.length > 0), 'edge entry missing or empty canon_parts: ' + JSON.stringify(entry));
  }
});

test('every node_aliases entry has codex_term, resolution, canonical_name, canon_parts', () => {
  for (const entry of parsed.node_aliases) {
    assert.ok(entry.codex_term, 'node entry missing codex_term: ' + JSON.stringify(entry));
    assert.ok(entry.resolution, 'node entry missing resolution: ' + JSON.stringify(entry));
    assert.ok(entry.canonical_name, 'node entry missing canonical_name: ' + JSON.stringify(entry));
    assert.ok(entry.canon_parts && (Array.isArray(entry.canon_parts) ? entry.canon_parts.length > 0 : entry.canon_parts.length > 0), 'node entry missing or empty canon_parts: ' + JSON.stringify(entry));
  }
});

test('every resolution is one of EXISTS|EXTEND|NEW|RESERVED (closed set)', () => {
  const allEntries = parsed.edge_aliases.concat(parsed.node_aliases);
  for (const entry of allEntries) {
    assert.ok(
      RESOLUTIONS.includes(entry.resolution),
      'Invalid resolution "' + entry.resolution + '" in entry ' + entry.codex_term
    );
  }
});

test('RESERVED entries carry deferred_to_phase', () => {
  const allEntries = parsed.edge_aliases.concat(parsed.node_aliases);
  for (const entry of allEntries) {
    if (entry.resolution === 'RESERVED') {
      assert.ok(entry.deferred_to_phase, 'RESERVED entry missing deferred_to_phase: ' + entry.codex_term);
    }
  }
});

test('EXTEND entries with direction have direction in {forward, reverse}', () => {
  const allEntries = parsed.edge_aliases.concat(parsed.node_aliases);
  for (const entry of allEntries) {
    if (entry.resolution === 'EXTEND' && entry.direction !== undefined && entry.direction !== null) {
      assert.ok(['forward', 'reverse'].includes(entry.direction), 'Invalid direction "' + entry.direction + '" in entry ' + entry.codex_term);
    }
  }
});

test('every EDGE_TYPES entry from lib/core/lazygraph-ops.cjs:25 appears as a canonical_name', () => {
  // Load EDGE_TYPES via require() if exported, else regex-parse the file.
  let edgeTypes;
  try {
    edgeTypes = require(LAZYGRAPH_OPS_PATH).EDGE_TYPES;
  } catch (_) { /* ignore */ }
  if (!edgeTypes) {
    const src = fs.readFileSync(LAZYGRAPH_OPS_PATH, 'utf8');
    const m = src.match(/const EDGE_TYPES = \[([^\]]+)\]/);
    if (!m) throw new Error('Cannot find EDGE_TYPES in lazygraph-ops.cjs');
    edgeTypes = m[1].split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean);
  }
  const canonicalNames = new Set(parsed.edge_aliases.map((e) => e.canonical_name));
  const missing = edgeTypes.filter((t) => !canonicalNames.has(t));
  assert.equal(missing.length, 0, 'EDGE_TYPES entries missing from edge_aliases canonical_names: ' + missing.join(', '));
});

test('zero em-dashes (U+2014) or en-dashes (U+2013)', () => {
  const emdashIdx = aliasesContent.indexOf('—');
  const endashIdx = aliasesContent.indexOf('–');
  assert.equal(emdashIdx, -1, 'Em-dash found at character offset ' + emdashIdx);
  assert.equal(endashIdx, -1, 'En-dash found at character offset ' + endashIdx);
});

process.exit(failures > 0 ? 1 : 0);
