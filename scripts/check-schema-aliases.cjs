#!/usr/bin/env node
'use strict';

/*
 * Phase 108-05 - Pre-commit hook: schema alias drift guard.
 *
 * Implements: RECONCILE-108-05 (D-05 enforcement layer).
 *
 * Behavior: scans staged file content (passed in as args, or read via
 * `git diff --cached --unified=0` when invoked with no args) for CREATE
 * TABLE / CREATE INDEX / ALTER TABLE ADD COLUMN statements. Fails (exit 1)
 * if a new table name is not in the canonical alias resolution column.
 * Passes (exit 0) for ALTER TABLE ADD COLUMN (additive per D-05) and for
 * CREATE INDEX whose target table exists in the allowed set.
 *
 * Usage:
 *   node scripts/check-schema-aliases.cjs                  # read from git diff --cached
 *   node scripts/check-schema-aliases.cjs --sql 'CREATE TABLE foo (...)'  # test against literal SQL
 *   node scripts/check-schema-aliases.cjs --file path.sql   # test against a file
 *
 * Performance budget (per RESEARCH section 6 "Hook performance"): under 200ms warm.
 * Implementation: zero new deps; in-house YAML parser; native node:fs + node:child_process.
 *
 * Canon Part 8: zero Brain queries; LOCAL-only enforcement.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const ALIASES_PATH = path.join(
  REPO_ROOT,
  '.planning',
  'phases',
  '108-graph-memory-schema-reconciliation',
  'aliases.yml'
);

// Existing SQL table names (NOT graph node types). These are hardcoded because
// aliases.yml maps Codex node terms to graph node types, not SQL table names.
// Sources: lib/core/lazygraph-ops.cjs:31-65 + lib/core/memory-ops.cjs:23-148.
const ALLOWED_EXISTING_TABLES = [
  // From lib/core/lazygraph-ops.cjs:
  'nodes', 'edges', 'stakeholders',
  // From lib/core/memory-ops.cjs:
  'identity', 'facts', 'sessions', 'fragments', 'assumptions',
  'scaffold_log', 'voice_log', 'held_contradictions', 'decisions_index'
];

// ----------------------------------------------------------------------------
// In-house YAML parser (zero deps; lifted verbatim from Plan 108-04 test
// implementation; ultimately derived from lib/core/opportunity-ops.cjs:24-118).
// ----------------------------------------------------------------------------
function parseAliasesYaml(content) {
  const result = {
    schema_version: null, phase: null, canon_part: null,
    edge_aliases: [], node_aliases: [], status_aliases: {}
  };
  const lines = content.split('\n');
  let section = null;
  let currentEntry = null;

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
      return v.slice(1, -1).split(',').map((x) => x.trim()).filter(Boolean);
    }
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      return v.slice(1, -1);
    }
    return v;
  }

  for (const rawLine of lines) {
    const noComment = rawLine.replace(/\s+#.*$/, '').replace(/^#.*/, '');
    const line = noComment.replace(/\s+$/, '');
    if (line === '') continue;

    const topMatch = line.match(/^([a-z_]+):\s*(.*)$/);
    if (topMatch && !line.startsWith(' ') && !line.startsWith('-')) {
      pushEntry();
      const key = topMatch[1];
      const value = topMatch[2];
      if (key === 'edge_aliases' || key === 'node_aliases' || key === 'status_aliases') {
        section = key;
        continue;
      }
      section = null;
      if (key === 'schema_version' || key === 'phase' || key === 'canon_part') {
        result[key] = parseScalar(value);
      }
      continue;
    }

    if (section === 'status_aliases') {
      const m = line.match(/^\s+([a-z_]+):\s*([a-z_]+)\s*$/);
      if (m) { result.status_aliases[m[1]] = m[2]; continue; }
    }

    const entryStart = line.match(/^\s*-\s+([a-z_]+):\s*(.*)$/);
    if (entryStart && (section === 'edge_aliases' || section === 'node_aliases')) {
      pushEntry();
      currentEntry = {};
      currentEntry[entryStart[1]] = parseScalar(entryStart[2]);
      continue;
    }

    const cont = line.match(/^\s+([a-z_]+):\s*(.*)$/);
    if (cont && currentEntry !== null) {
      currentEntry[cont[1]] = parseScalar(cont[2]);
    }
  }
  pushEntry();
  return result;
}

// ----------------------------------------------------------------------------
// Build the allowed-table set.
// ----------------------------------------------------------------------------
function buildAllowedTableSet() {
  const allowed = new Set(ALLOWED_EXISTING_TABLES);
  if (!fs.existsSync(ALIASES_PATH)) {
    // No aliases.yml means we can only allow the hardcoded existing tables.
    return allowed;
  }
  const aliases = parseAliasesYaml(fs.readFileSync(ALIASES_PATH, 'utf8'));
  // Add canonical_name from any node_aliases entry whose resolution is NEW or EXTEND.
  // (RESERVED entries are name-locked but the table does not ship until the
  // deferred phase, so we DO allow them so a future Phase 112 commit creating
  // BUDDED_FROM-table is not blocked by hook bootstrapping order.)
  for (const entry of aliases.node_aliases) {
    if (entry && entry.canonical_name && ['EXISTS', 'EXTEND', 'NEW', 'RESERVED'].includes(entry.resolution)) {
      allowed.add(entry.canonical_name);
      // Allow common derived table names too (e.g., banked_by, banked_by_audit).
      allowed.add(entry.canonical_name.toLowerCase());
      allowed.add(entry.canonical_name.toLowerCase() + '_audit');
    }
  }
  // Same for edges (edges are typically NOT separate tables - they live in the
  // shared `edges` table - but a future EXTEND might create a per-edge audit
  // table named after the edge. Allow the lowercase form + _audit suffix).
  for (const entry of aliases.edge_aliases) {
    if (entry && entry.canonical_name && ['EXISTS', 'EXTEND', 'NEW', 'RESERVED'].includes(entry.resolution)) {
      allowed.add(entry.canonical_name.toLowerCase());
      allowed.add(entry.canonical_name.toLowerCase() + '_audit');
    }
  }
  return allowed;
}

// ----------------------------------------------------------------------------
// DDL regexes (RESEARCH section 6 verbatim).
// ----------------------------------------------------------------------------
const CREATE_TABLE_REGEX = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?/gi;
const CREATE_INDEX_REGEX = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?\s+ON\s+[`"']?(\w+)[`"']?/gi;
const ALTER_TABLE_ADD_REGEX = /ALTER\s+TABLE\s+[`"']?(\w+)[`"']?\s+ADD\s+(?:COLUMN\s+)?[`"']?(\w+)[`"']?/gi;

// ----------------------------------------------------------------------------
// Scan a single SQL string and return list of violations.
// Each violation: { kind, table, line }
// ----------------------------------------------------------------------------
function scanSql(sqlText, filePath, allowedTables) {
  const violations = [];

  // CREATE TABLE: table name must be in allowedTables.
  let m;
  CREATE_TABLE_REGEX.lastIndex = 0;
  while ((m = CREATE_TABLE_REGEX.exec(sqlText)) !== null) {
    const tableName = m[1];
    if (!allowedTables.has(tableName)) {
      // Compute approximate line number.
      const upToMatch = sqlText.slice(0, m.index);
      const lineNo = upToMatch.split('\n').length;
      violations.push({
        kind: 'create_table_drift',
        table: tableName,
        file: filePath,
        line: lineNo
      });
    }
  }

  // CREATE INDEX: target table must be in allowedTables.
  CREATE_INDEX_REGEX.lastIndex = 0;
  while ((m = CREATE_INDEX_REGEX.exec(sqlText)) !== null) {
    const indexName = m[1];
    const targetTable = m[2];
    if (!allowedTables.has(targetTable)) {
      const upToMatch = sqlText.slice(0, m.index);
      const lineNo = upToMatch.split('\n').length;
      violations.push({
        kind: 'create_index_on_missing_table',
        table: targetTable,
        index: indexName,
        file: filePath,
        line: lineNo
      });
    }
  }

  // ALTER TABLE ADD COLUMN: always allowed (additive per D-05). No checks.
  // (Regex match here is purely informational; we do not record violations.)
  ALTER_TABLE_ADD_REGEX.lastIndex = 0;

  return violations;
}

// ----------------------------------------------------------------------------
// Format the canonical structured error message (RESEARCH section 6 verbatim).
// ----------------------------------------------------------------------------
function formatViolation(v) {
  if (v.kind === 'create_table_drift') {
    return [
      'SCHEMA DRIFT GUARD - PHASE 108',
      '',
      'A new table is being added that does not appear in the canonical alias table:',
      '',
      '  File:    ' + v.file,
      '  Line:    ' + v.line,
      '  Table:   ' + v.table,
      '',
      'This violates Phase 108 D-05 (Do not invent parallel schema).',
      '',
      'Resolution options:',
      '  1. Add the table name to .planning/phases/108-graph-memory-schema-reconciliation/aliases.yml',
      '     under node_aliases with resolution: NEW and a Canon Part justification.',
      '  2. Use an existing table (see aliases.yml for the canonical list).',
      '  3. If this is a one-off override, commit with --no-verify AND open a canon-amendment PR',
      '     to document the exception.',
      '',
      'Reference: .planning/phases/108-graph-memory-schema-reconciliation/108-CONTEXT.md D-05'
    ].join('\n');
  }
  if (v.kind === 'create_index_on_missing_table') {
    return [
      'SCHEMA DRIFT GUARD - PHASE 108',
      '',
      'CREATE INDEX targets a table that does not appear in the canonical alias table:',
      '',
      '  File:    ' + v.file,
      '  Line:    ' + v.line,
      '  Index:   ' + v.index,
      '  Table:   ' + v.table,
      '',
      'This violates Phase 108 D-05 (Do not invent parallel schema).',
      '',
      'Reference: .planning/phases/108-graph-memory-schema-reconciliation/108-CONTEXT.md D-05'
    ].join('\n');
  }
  return 'Unknown violation: ' + JSON.stringify(v);
}

// ----------------------------------------------------------------------------
// Read staged content via git diff --cached.
// ----------------------------------------------------------------------------
function readStagedContent() {
  const result = spawnSync('git', ['diff', '--cached', '--unified=0'], {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    return { content: '', files: [] };
  }
  return { content: result.stdout || '', files: [] };
}

// ----------------------------------------------------------------------------
// Public API: check a single SQL string against the alias set.
// Used by tests/test-precommit-hook-aliases.cjs.
// ----------------------------------------------------------------------------
function checkSqlAgainstAliases(sqlText, filePath) {
  const allowed = buildAllowedTableSet();
  return scanSql(sqlText, filePath || '<inline>', allowed);
}

module.exports = { checkSqlAgainstAliases, parseAliasesYaml, buildAllowedTableSet, formatViolation, ALLOWED_EXISTING_TABLES };

// ----------------------------------------------------------------------------
// CLI entry point.
// ----------------------------------------------------------------------------
if (require.main === module) {
  const args = process.argv.slice(2);
  let sqlText = '';
  let filePath = '<staged>';

  if (args[0] === '--sql' && args[1]) {
    sqlText = args[1];
  } else if (args[0] === '--file' && args[1]) {
    filePath = args[1];
    sqlText = fs.readFileSync(args[1], 'utf8');
  } else {
    const staged = readStagedContent();
    sqlText = staged.content;
  }

  const violations = checkSqlAgainstAliases(sqlText, filePath);
  if (violations.length === 0) {
    process.exit(0);
  }
  for (const v of violations) {
    console.error(formatViolation(v));
    console.error('');
  }
  process.exit(1);
}
