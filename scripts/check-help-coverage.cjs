#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121.5-07 Task 2 -- /mos:help coverage CI tripwire (Decision D-08 LOCKED).
 *
 * Hard-fails pre-commit + CI on:
 *   (a) any commands/*.md missing help_jtbd: frontmatter.
 *   (b) any visibility:non-admin command missing from data/help-groups.json
 *       (and not listed in deprecated_aliases).
 *   (c) any group entry in data/help-groups.json that references a command
 *       file that does not exist.
 *
 * Usage:
 *   node scripts/check-help-coverage.cjs          # prose output
 *   node scripts/check-help-coverage.cjs --json   # JSON output
 *
 * Exit code: 0 if valid; 1 if any violation.
 *
 * Canon references: Part 3, Part 7, Part 8.
 */

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const GROUPS_PATH = path.join(REPO, 'data', 'help-groups.json');
const COMMANDS_DIR = path.join(REPO, 'commands');

function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-z_]+):\s*(.+)$/i);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
}

function check() {
  if (!fs.existsSync(GROUPS_PATH)) {
    return {
      valid: false,
      missing_help_jtbd: [],
      missing_from_groups: [],
      orphan_in_groups: [],
      fatal: 'data/help-groups.json not found',
    };
  }
  const groups = JSON.parse(fs.readFileSync(GROUPS_PATH, 'utf8'));
  const allGroupedCommands = new Set();
  for (const g of groups.groups) {
    for (const c of g.commands) allGroupedCommands.add(c);
  }
  const deprecated = new Set(
    Object.keys(groups.deprecated_aliases || {}).filter((k) => !k.startsWith('_'))
  );

  const files = fs.readdirSync(COMMANDS_DIR).filter((f) => f.endsWith('.md'));
  const missing_help_jtbd = [];
  const missing_from_groups = [];

  for (const f of files) {
    const name = f.replace(/\.md$/, '');
    const text = fs.readFileSync(path.join(COMMANDS_DIR, f), 'utf8');
    const fm = parseFrontmatter(text);
    if (!fm || !fm.help_jtbd) missing_help_jtbd.push(f);
    const visibility = (fm && fm.visibility) || 'user';
    if (
      visibility !== 'admin' &&
      !allGroupedCommands.has(name) &&
      !deprecated.has(name)
    ) {
      missing_from_groups.push(name);
    }
  }

  const fileNames = new Set(files.map((f) => f.replace(/\.md$/, '')));
  const orphan_in_groups = [];
  for (const grouped of allGroupedCommands) {
    if (!fileNames.has(grouped)) orphan_in_groups.push(grouped);
  }

  const valid =
    missing_help_jtbd.length === 0 &&
    missing_from_groups.length === 0 &&
    orphan_in_groups.length === 0;

  return { valid, missing_help_jtbd, missing_from_groups, orphan_in_groups };
}

function main() {
  const json = process.argv.includes('--json');
  const result = check();
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('valid: ' + result.valid);
    if (result.fatal) console.error('  FATAL: ' + result.fatal);
    for (const f of result.missing_help_jtbd) {
      console.error('  MISSING help_jtbd: ' + f);
    }
    for (const c of result.missing_from_groups) {
      console.error('  MISSING from help-groups.json: ' + c);
    }
    for (const c of result.orphan_in_groups) {
      console.error(
        '  ORPHAN in help-groups.json (no command file): ' + c
      );
    }
  }
  process.exit(result.valid ? 0 : 1);
}

if (require.main === module) main();

module.exports = { check };
