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
// Read staged content via git diff --cached. Used by the default
// schema-aliases scan. Renamed to *_default in Plan 109-06 because the new
// --check-chokepoint subcommand introduces a per-file readStagedContent
// helper with different semantics (path -> content vs full diff blob).
// ----------------------------------------------------------------------------
function readStagedContent_default() {
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

// ============================================================================
// Phase 109-06 - --check-chokepoint subcommand. Scans staged JS/CJS/MJS files
// for direct require('./room-db.cjs') / require('./lazygraph-ops.cjs') /
// require('./memory-ops.cjs') outside the allow-list. Per RESEARCH section 3.2
// + Open Question 11.7 (single mega-script with sub-commands per check).
//
// Canon Part 7 (Reuse Before Build): extends Phase 108-05 substrate; same
// installer; zero new npm dependencies; reuses existing in-house seam.
// Canon Part 8 (Graph Boundary): zero Brain queries; LOCAL-only enforcement.
// Canon Part 9 (Memory Locality): the chokepoint enforces that every module
// touching the graph routes through navigation.cjs - the single-source-of-truth
// principle Canon Part 9 ratifies.
// ============================================================================

const ALLOWED_DIRECT_IMPORT = [
  /^lib\/core\/navigation\.cjs$/,
  /^lib\/core\/navigation\//,
  /^lib\/core\/room-db\.cjs$/,
  /^lib\/core\/lazygraph-ops\.cjs$/,
  /^lib\/core\/memory-ops\.cjs$/,
  /^lib\/core\/opportunity-ops\.cjs$/,
  /^tests\//,
  /^scripts\/migrate-/,
  // v1.14.0 backward-compat grandfather (per CONTEXT.md L353-358; deprecation cycle in v1.14+):
  /^lib\/hmi\/across-session-memory\.cjs$/,
  /^lib\/core\/brain-derivation\.cjs$/,
  /^scripts\/compute-state$/,
  // Phase 108 substrate self-reference (migration scripts directory):
  /^lib\/core\/migrations\//,
];

const BANNED_PATTERNS = [
  // Relative paths ending in the protected basename. Covers:
  //   require('./room-db.cjs')
  //   require('../room-db.cjs')
  //   require('../core/memory-ops.cjs')
  //   require('../../lib/core/room-db.cjs')
  // The leading anchor is one or two dots (relative path prefix); the body is
  // any number of intermediate path segments before the protected basename.
  /require\(['"]\.\.?\/[^'"]*?(room-db|lazygraph-ops|memory-ops)\.cjs['"]\)/,
  // Bare absolute-style paths: require('lib/core/room-db.cjs').
  /require\(['"]lib\/core\/(room-db|lazygraph-ops|memory-ops)\.cjs['"]\)/,
];

function isAllowedPath(p) {
  const normalized = p.replace(/\\/g, '/');
  return ALLOWED_DIRECT_IMPORT.some((rx) => rx.test(normalized));
}

function getStagedFiles() {
  const env = process.env.MINDRIAN_HOOK_STAGED_FILES;
  if (typeof env === 'string') {
    return env.split('\n').map((s) => s.trim()).filter(Boolean);
  }
  // Production: git diff --cached --name-only --diff-filter=ACM.
  try {
    const r = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM'], { cwd: REPO_ROOT, encoding: 'utf8' });
    if (r.status !== 0) return [];
    return (r.stdout || '').split('\n').map((s) => s.trim()).filter(Boolean);
  } catch (_) {
    return [];
  }
}

function readStagedContent(filePath) {
  // Hermetic-test seam: read from MINDRIAN_HOOK_STAGED_CONTENT_DIR/<path> when set.
  const contentDir = process.env.MINDRIAN_HOOK_STAGED_CONTENT_DIR;
  const candidates = [];
  if (contentDir) candidates.push(path.join(contentDir, filePath));
  candidates.push(path.join(REPO_ROOT, filePath));
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8');
    } catch (_) { /* fall through */ }
  }
  // Production fallback: git show :<file> for staged content.
  try {
    const r = spawnSync('git', ['show', ':' + filePath], { cwd: REPO_ROOT, encoding: 'utf8' });
    if (r.status === 0) return r.stdout || '';
  } catch (_) { /* ignore */ }
  return '';
}

function checkChokepoint() {
  const staged = getStagedFiles();
  const violations = [];
  for (const filePath of staged) {
    if (!/\.(cjs|js|mjs)$/.test(filePath)) continue;
    if (isAllowedPath(filePath)) continue;
    const content = readStagedContent(filePath);
    if (!content) continue;
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      for (const rx of BANNED_PATTERNS) {
        const m = lines[i].match(rx);
        if (m) {
          violations.push({ file: filePath, line: i + 1, match: m[0] });
        }
      }
    }
  }
  if (violations.length === 0) {
    process.exit(0);
  }
  process.stderr.write('[check-chokepoint] FAIL: direct require of room-db / lazygraph-ops / memory-ops outside allow-list:\n');
  for (const v of violations) {
    process.stderr.write('  ' + v.file + ':' + v.line + ': ' + v.match + '\n');
  }
  process.stderr.write('Route the access through lib/core/navigation.cjs or add the path to the ALLOWED_DIRECT_IMPORT list in scripts/check-schema-aliases.cjs.\n');
  process.exit(1);
}

module.exports.checkChokepoint = checkChokepoint;
module.exports.ALLOWED_DIRECT_IMPORT = ALLOWED_DIRECT_IMPORT;
module.exports.BANNED_PATTERNS = BANNED_PATTERNS;

// ============================================================================
// Phase 110-04 - --check-sendpacket subcommand (D-08 layer 2). Mirrors the
// --check-chokepoint structure above. Scans staged JS/CJS/MJS files for a
// bare sendPacket( call site NOT lexically preceded by a buildBrainPacket(
// call in the same file. The origin string on a Brain Context Packet is
// in-process-forgeable; the hook + review are the real teeth that catch a
// packet built outside lib/core/navigation.cjs::buildBrainPacket.
//
// Canon Part 8 (Graph Boundary -- D-08 layer 2): three layers, no crypto.
// Layer 1 (origin string at construction in navigation.cjs) is unforgeable
// only by convention; this pre-commit guard makes the convention enforced.
// Layer 3 is the schema-drift tripwire wired into the same pre-commit hook
// (110-01 build-brain-packet-schema.cjs --check).
//
// Canon Part 7 (Reuse Before Build): extends the existing 109-06 substrate
// (getStagedFiles + readStagedContent + isAllowedPath idiom) rather than a
// sibling script; same installer; zero new npm dependencies.
//
// Canon Part 9 (Memory Locality): the chokepoint enforces that every Brain
// Context Packet is assembled through the navigation chokepoint, never
// directly from files / shell / transcript.
// ============================================================================

const ALLOWED_SENDPACKET_FILES = [
  /^lib\/core\/brain-client\.cjs$/,
  /^lib\/core\/navigation\.cjs$/,
  /^lib\/core\/navigation\//,
  /^tests\//,
  /^scripts\//,
  // lib/core/mindrian-brain-shim.test.cjs is a meta-test (Phase 127-00): its
  // own source contains the literal string sendPacket( inside a regex/label
  // that checks for the ABSENCE of a bypass in the file it tests (the shim),
  // not an actual call site. Audited across all 274 tracked *.test.cjs files
  // in this repo (Phase 257 regression_gate, 2026-09-03): this is the ONLY
  // one containing the string sendPacket( at all, so a narrow single-file
  // exemption is used here rather than a blanket *.test.cjs pattern -- this
  // check is a real D-08 security chokepoint and should stay narrow. This is
  // the first commit to re-stage this exact file since the layer 2 check
  // started enforcing, so the false positive had never fired before now.
  /^lib\/core\/mindrian-brain-shim\.test\.cjs$/,
];

function isAllowedSendpacketPath(p) {
  const normalized = p.replace(/\\/g, '/');
  return ALLOWED_SENDPACKET_FILES.some(function (rx) { return rx.test(normalized); });
}

function checkSendpacket() {
  const staged = getStagedFiles();
  const violations = [];
  for (const filePath of staged) {
    if (!/\.(cjs|js|mjs)$/.test(filePath)) continue;
    if (isAllowedSendpacketPath(filePath)) continue;
    const content = readStagedContent(filePath);
    if (!content) continue;
    const lines = content.split('\n');
    // A bare sendPacket( call is OK only if a buildBrainPacket( call appears
    // earlier in the SAME file. Coarse lexical proximity check: the hook is
    // the teeth, not a precise data-flow analysis.
    let sawBuild = false;
    for (let i = 0; i < lines.length; i++) {
      if (/\bbuildBrainPacket\s*\(/.test(lines[i])) sawBuild = true;
      const m = lines[i].match(/\bsendPacket\s*\(/);
      if (m && !sawBuild) {
        violations.push({ file: filePath, line: i + 1, match: lines[i].trim().slice(0, 120) });
      }
    }
  }
  if (violations.length === 0) {
    process.exit(0);
  }
  process.stderr.write('[check-sendpacket] FAIL (D-08 layer 2): a `sendPacket(` call site is not lexically preceded by a `buildBrainPacket(` call. Brain Context Packets must be built ONLY through lib/core/navigation.cjs::buildBrainPacket (D-01 chokepoint).\n');
  for (const v of violations) {
    process.stderr.write('  ' + v.file + ':' + v.line + ': ' + v.match + '\n');
  }
  process.stderr.write('Build the packet via navigation.buildBrainPacket(...) before calling brain-client.sendPacket(...), or add the path to ALLOWED_SENDPACKET_FILES in scripts/check-schema-aliases.cjs.\n');
  process.exit(1);
}

module.exports.checkSendpacket = checkSendpacket;
module.exports.ALLOWED_SENDPACKET_FILES = ALLOWED_SENDPACKET_FILES;
module.exports.isAllowedSendpacketPath = isAllowedSendpacketPath;

// ----------------------------------------------------------------------------
// CLI entry point.
// ----------------------------------------------------------------------------
if (require.main === module) {
  const args = process.argv.slice(2);

  // Phase 109-06: --check-chokepoint subcommand short-circuits the default
  // schema-aliases scan. The pre-commit installer can invoke either or both
  // independently; this dispatch keeps each check single-purpose.
  if (args.includes('--check-chokepoint')) {
    checkChokepoint();
    return;
  }

  // Phase 110-04: --check-sendpacket subcommand (D-08 layer 2).
  if (args.includes('--check-sendpacket')) {
    checkSendpacket();
    return;
  }

  let sqlText = '';
  let filePath = '<staged>';

  if (args[0] === '--sql' && args[1]) {
    sqlText = args[1];
  } else if (args[0] === '--file' && args[1]) {
    filePath = args[1];
    sqlText = fs.readFileSync(args[1], 'utf8');
  } else {
    const staged = readStagedContent_default();
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
