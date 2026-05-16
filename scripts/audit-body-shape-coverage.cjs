#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121.5-01 Task 2 -- body_shape: frontmatter coverage auditor.
 *
 * Scans commands/*.md and verifies every file declares a body_shape: in
 * its YAML frontmatter, with a value drawn from the locked Canon Part 3
 * vocabulary (SKILL.md Section 2 + Phase 88.2 F.0 / F.6 additions +
 * the methodology carve-out).
 *
 * Exit 0 on full coverage with valid values. Exit 1 when any command
 * is missing body_shape OR carries an invalid value.
 *
 * Usage:
 *   node scripts/audit-body-shape-coverage.cjs               // human output
 *   node scripts/audit-body-shape-coverage.cjs --json        // machine output
 *   node scripts/audit-body-shape-coverage.cjs --dir <path>  // alt commands/
 *
 * Canon references:
 *   Part 3 UI Ruling System -- this script is the CI tripwire that keeps
 *           the body_shape: contract honest. /mos:doctor --ui-compliance
 *           (Phase 121.5-08) calls into the same audit() function.
 *   Part 7 Reuse Before Build -- single-file CJS following the GSD
 *           pattern (gsd-tools.cjs style: process.argv switch, no CLI
 *           framework, no commander/yargs). Reuses the in-house YAML
 *           parsing approach from scripts/check-schema-aliases.cjs.
 *   Part 8 Graph Boundary -- zero fetch / http / Brain / Pinecone /
 *           Tavily references in this file. Pure filesystem audit.
 *
 * Reuse contract:
 *   - Exported audit(commandsDir) returns
 *     { total, missing[], invalid[], histogram } for programmatic use.
 *   - Exported VALID_SHAPES is the canonical Set used by tests and by
 *     downstream consumers (e.g. Phase 121.5-08 /mos:doctor surface).
 */

const fs = require('node:fs');
const path = require('node:path');

// The locked vocabulary for body_shape: in commands/*.md frontmatter.
// Canon Part 3 surface contract. Adding a new shape requires a canon
// amendment, NOT a script-level invention.
const VALID_SHAPES = new Set([
  // Five primary body shapes (SKILL.md Section 2)
  'A',  // Mondrian Board
  'B',  // Semantic Tree
  'C',  // Room Card
  'D',  // Document View
  'E',  // Action Report
  // Shape F family (Decision Gate, SKILL.md Section 2 + Phase 88.2)
  'F.0',  // Mini Decision Gate (Phase 88.2)
  'F.1',  // Next Move selector
  'F.2',  // Path Control selector
  'F.3',  // Rabbit-Hole Depth selector
  'F.4',  // Insight Extraction selector
  'F.5',  // Branch Resolution selector
  'F.6',  // Plan Review Round (Phase 88.2)
  // Conversational carve-out (SKILL.md Section 2 final paragraph)
  'methodology',
]);

/**
 * Parse the YAML frontmatter from a markdown file.
 * Returns an object of top-level keys, or null if no frontmatter found.
 *
 * This is a minimal line-by-line parser; it does NOT handle nested
 * structures, list values, or multiline scalars. body_shape: is always
 * a single scalar on one line so this is sufficient.
 */
function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split('\n')) {
    // Match "key: value" at the start of the line (allow letters,
    // digits, underscores, hyphens in keys).
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
}

/**
 * Normalize a body_shape: value to its canonical form for VALID_SHAPES
 * lookup. Examples of accepted forms:
 *   "A"                  -> "A"
 *   "A (Mondrian Board)" -> "A"
 *   "methodology"        -> "methodology"
 *   "\"methodology\""    -> "methodology"
 *   "F.1"                -> "F.1"
 *   "F.1 (Next Move)"    -> "F.1"
 */
function normalizeShape(raw) {
  if (typeof raw !== 'string') return '';
  let v = raw.trim();
  // Strip trailing parenthetical descriptor.
  v = v.replace(/\s*\(.*\)\s*$/, '');
  // Strip surrounding quotes (single or double).
  v = v.replace(/^['"]|['"]$/g, '');
  return v.trim();
}

/**
 * Audit a commands/ directory for body_shape: frontmatter coverage.
 * Returns:
 *   {
 *     total: number,
 *     missing: [{ file, reason }],
 *     invalid: [{ file, value }],
 *     histogram: { [shape]: count, ... }
 *   }
 */
function audit(commandsDir) {
  const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.md'));
  const missing = [];
  const invalid = [];
  const histogram = {};
  for (const f of files) {
    const text = fs.readFileSync(path.join(commandsDir, f), 'utf8');
    const fm = parseFrontmatter(text);
    if (!fm) {
      missing.push({ file: f, reason: 'no-frontmatter' });
      continue;
    }
    if (!fm.body_shape) {
      missing.push({ file: f, reason: 'missing-body-shape' });
      continue;
    }
    const v = normalizeShape(fm.body_shape);
    if (!VALID_SHAPES.has(v)) {
      invalid.push({ file: f, value: fm.body_shape });
      continue;
    }
    histogram[v] = (histogram[v] || 0) + 1;
  }
  return { total: files.length, missing, invalid, histogram };
}

// ---------- CLI ----------

function parseArgs(argv) {
  const out = { json: false, dir: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') out.json = true;
    else if (a === '--dir' && i + 1 < argv.length) { out.dir = argv[i + 1]; i++; }
    else if (a === '--help' || a === '-h') { out.help = true; }
  }
  return out;
}

function printHelp() {
  console.log('Usage: audit-body-shape-coverage.cjs [--json] [--dir <path>]');
  console.log('');
  console.log('  --json         Emit machine-readable JSON output.');
  console.log('  --dir <path>   Override the commands/ directory location.');
  console.log('');
  console.log('Exits 0 on full coverage with valid values, 1 otherwise.');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { printHelp(); process.exit(0); }
  const commandsDir = args.dir
    ? path.resolve(args.dir)
    : path.resolve(__dirname, '..', 'commands');

  if (!fs.existsSync(commandsDir) || !fs.statSync(commandsDir).isDirectory()) {
    if (args.json) {
      console.log(JSON.stringify({
        error: 'commands-dir-missing',
        path: commandsDir,
        total: 0,
        missing: [],
        invalid: [],
        histogram: {},
      }, null, 2));
    } else {
      console.error('error: commands directory not found: ' + commandsDir);
    }
    process.exit(1);
  }

  const result = audit(commandsDir);

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('audit-body-shape-coverage: ' + commandsDir);
    console.log('  Total:    ' + result.total);
    console.log('  Missing:  ' + result.missing.length);
    console.log('  Invalid:  ' + result.invalid.length);
    if (result.missing.length || result.invalid.length) {
      for (const m of result.missing) {
        console.error('  MISSING  ' + m.file + ' (' + m.reason + ')');
      }
      for (const i of result.invalid) {
        console.error('  INVALID  ' + i.file + ' = "' + i.value + '"');
      }
    }
    console.log('  Histogram: ' + JSON.stringify(result.histogram));
  }

  const ok = result.missing.length === 0 && result.invalid.length === 0;
  process.exit(ok ? 0 : 1);
}

if (require.main === module) main();

module.exports = { audit, VALID_SHAPES, parseFrontmatter, normalizeShape };
