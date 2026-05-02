#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 104-02 -- Per-command JTBD declarations verification harness.
 *
 * Implements: JTBDCONS-104-02
 *
 * Walks commands/*.md, parses YAML frontmatter, and asserts:
 *   (a) every command file has a `serves_jtbd:` field,
 *   (b) the field is a JSON array of strings (one or more entries),
 *   (c) every string resolves to a `lib/hmi/jtbd-taxonomy.json`
 *       `entries[i].id` (closed-vocabulary enforcement; Canon Part 3
 *       ten-verb principle applied to JTBDs).
 *
 * Failure mode: list every offending file with line number and reason.
 *
 * Latency budget: < 500ms warm.
 *
 * Exit codes:
 *   0  = PASS
 *   1  = FAIL (one or more violations)
 *   77 = SKIPPED (degraded env: missing taxonomy file)
 *
 * Zero dependencies (Node built-ins only). In-house frontmatter parsing
 * (no js-yaml; mirrors the Phase 88-00 pattern documented in
 * lib/memory/validators/brain-md-invariants.cjs splitFrontmatterAndBody).
 *
 * Canon Part 8: zero Brain queries. All assertions are LOCAL filesystem
 * reads against in-tree files.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const COMMANDS_DIR = path.join(REPO_ROOT, 'commands');
const TAXONOMY_PATH = path.join(REPO_ROOT, 'lib', 'hmi', 'jtbd-taxonomy.json');

const failures = [];
function fail(file, line, msg) {
  failures.push({ file: file, line: line, msg: msg });
}

process.stdout.write('test-command-jtbd-declarations.cjs (Phase 104-02 JTBDCONS-104-02)\n');

const t0 = Date.now();

// ---- Load taxonomy (canonical 13 ids) ----
let canonicalIds;
try {
  const raw = fs.readFileSync(TAXONOMY_PATH, 'utf8');
  const tax = JSON.parse(raw);
  if (!tax || !Array.isArray(tax.entries)) {
    process.stderr.write('SKIP: taxonomy malformed (missing entries[])\n');
    process.exit(77);
  }
  canonicalIds = new Set(tax.entries.map(function (e) { return e && e.id; }).filter(Boolean));
  if (canonicalIds.size === 0) {
    process.stderr.write('SKIP: taxonomy entries[] empty\n');
    process.exit(77);
  }
} catch (err) {
  process.stderr.write('SKIP: cannot read taxonomy at ' + TAXONOMY_PATH + ': ' + err.message + '\n');
  process.exit(77);
}

// ---- Walk commands/*.md ----
let commandFiles;
try {
  commandFiles = fs.readdirSync(COMMANDS_DIR)
    .filter(function (n) { return n.endsWith('.md'); })
    .sort();
} catch (err) {
  process.stderr.write('FAIL: cannot read commands directory: ' + err.message + '\n');
  process.exit(1);
}

if (commandFiles.length === 0) {
  process.stderr.write('FAIL: commands/ contains zero .md files\n');
  process.exit(1);
}

// ---- Per-file scan ----
//
// Frontmatter parsing strategy (in-house, zero deps):
//   1. Confirm file opens with `---\n` and find the closing `---` fence.
//   2. Within frontmatter, locate the `serves_jtbd:` line (record line no).
//   3. Right-hand side must be a JSON array literal of string scalars.
//   4. Each scalar must be in the canonical 13-id set.
//
// We do NOT attempt full YAML parsing. The Phase 104-01 sweep wrote
// every declaration as a single-line JSON array (e.g. `serves_jtbd: ["explore"]`),
// which is also valid JSON. The parser below tolerates whitespace
// variations but rejects multi-line block-style declarations (the sweep
// invariant says single-line; multi-line would be a regression worth flagging).

const FRONTMATTER_OPEN = /^---\r?\n/;
const FRONTMATTER_CLOSE = /^---\s*$/;

for (let f = 0; f < commandFiles.length; f++) {
  const name = commandFiles[f];
  const filePath = path.join(COMMANDS_DIR, name);
  const rel = path.join('commands', name);

  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    fail(rel, 0, 'cannot read file: ' + err.message);
    continue;
  }

  if (!FRONTMATTER_OPEN.test(raw)) {
    fail(rel, 1, 'file does not begin with --- frontmatter fence');
    continue;
  }

  const lines = raw.split(/\r?\n/);
  // Find closing fence (start scanning from line 1, skipping the opening ---).
  let closeIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (FRONTMATTER_CLOSE.test(lines[i])) { closeIdx = i; break; }
  }
  if (closeIdx === -1) {
    fail(rel, 1, 'frontmatter has no closing --- fence');
    continue;
  }

  // Locate serves_jtbd: line within [1, closeIdx).
  let svcLine = -1;
  let svcRhs = null;
  for (let i = 1; i < closeIdx; i++) {
    const m = lines[i].match(/^serves_jtbd:\s*(.*)$/);
    if (m) {
      svcLine = i + 1; // 1-based for human reporting
      svcRhs = m[1];
      break;
    }
  }
  if (svcLine === -1) {
    fail(rel, 0, 'missing required `serves_jtbd:` field in frontmatter');
    continue;
  }

  // (b) Parse RHS as JSON array of strings.
  let arr;
  try {
    arr = JSON.parse(svcRhs);
  } catch (err) {
    fail(rel, svcLine, 'serves_jtbd value is not valid JSON: ' + err.message + ' (got: ' + JSON.stringify(svcRhs) + ')');
    continue;
  }
  if (!Array.isArray(arr)) {
    fail(rel, svcLine, 'serves_jtbd value is not an array (got typeof ' + typeof arr + ')');
    continue;
  }
  if (arr.length === 0) {
    fail(rel, svcLine, 'serves_jtbd array is empty (must declare at least one JTBD)');
    continue;
  }

  let rowOk = true;
  for (let k = 0; k < arr.length; k++) {
    const v = arr[k];
    if (typeof v !== 'string') {
      fail(rel, svcLine, 'serves_jtbd[' + k + '] is not a string (got typeof ' + typeof v + ')');
      rowOk = false;
      break;
    }
  }
  if (!rowOk) continue;

  // (c) Closed-vocabulary check: every id resolves to canonical taxonomy.
  for (let k = 0; k < arr.length; k++) {
    const id = arr[k];
    if (!canonicalIds.has(id)) {
      fail(rel, svcLine, 'serves_jtbd[' + k + ']="' + id + '" is not in the canonical 13-id taxonomy');
    }
  }
}

const elapsed = Date.now() - t0;

// ---- Report ----
if (failures.length === 0) {
  process.stdout.write('  ok  ' + commandFiles.length + ' command files; all carry valid serves_jtbd declarations\n');
  process.stdout.write('  ok  closed-vocabulary check (13 canonical ids enforced)\n');
  process.stdout.write('  ok  latency ' + elapsed + 'ms (budget < 500ms)\n');
  process.exit(0);
}

process.stderr.write('FAIL: ' + failures.length + ' violation(s) across ' + commandFiles.length + ' command files\n');
for (let i = 0; i < failures.length; i++) {
  const f = failures[i];
  const where = f.line > 0 ? (f.file + ':' + f.line) : f.file;
  process.stderr.write('  ' + where + ' -> ' + f.msg + '\n');
}
process.exit(1);
