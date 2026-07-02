#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121.5-07 Task 2 -- /mos:help coverage CI tripwire (Decision D-08 LOCKED).
 * Quick task 20260702-help-coverage-gate -- born-listed deprecation hardening +
 * pre-commit wiring (the gate shipped in 121.5-07 but was never wired into
 * scripts/install-pre-commit.sh, so a 13-command drift went silently RED).
 *
 * Hard-fails pre-commit + CI on:
 *   (a) any commands/*.md missing help_jtbd: frontmatter.
 *   (b) any visibility:non-admin, non-deprecated command missing from
 *       data/help-groups.json (missing_from_groups).
 *   (c) any group entry in data/help-groups.json that references a command
 *       file that does not exist (orphan_in_groups -- a true ghost).
 *   (d) any command whose frontmatter carries `deprecated: true` that is NOT
 *       explicitly listed in the deprecated_aliases exclusion registry
 *       (unlisted_deprecated) -- so a deprecation can never SILENTLY vanish
 *       from coverage; exclusion is born-listed, not born-absent.
 *   (e) any `deprecated: true` command that leaked INTO a group
 *       (deprecated_in_groups).
 *   (f) any deprecated_aliases key with no command file (orphan_excluded -- a
 *       ghost in the exclusion registry).
 *
 * The exclusion model is entirely IN-SHAPE + machine-checkable: admin surfaces
 * are detected from frontmatter (visibility:admin); deprecated surfaces are
 * detected from frontmatter (deprecated:true) AND must appear in the top-level
 * deprecated_aliases registry. No parallel _excluded list is minted (Part 7).
 *
 * Usage:
 *   node scripts/check-help-coverage.cjs          # prose output
 *   node scripts/check-help-coverage.cjs --json   # JSON output
 *
 * Exit code: 0 if valid; 1 if any violation.
 *
 * Canon references: Part 3, Part 7, Part 8, Part 11 (born-listed exclusion).
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

// check(opts) -- opts.commandsDir + opts.groupsPath default to the live repo
// paths, and are overridable so a test can point the SAME logic at an isolated
// fixture tree (Part 7 -- one gate, exercised over fixtures, never a fork).
function check(opts) {
  const o = opts || {};
  const groupsPath = o.groupsPath || GROUPS_PATH;
  const commandsDir = o.commandsDir || COMMANDS_DIR;
  if (!fs.existsSync(groupsPath)) {
    return {
      valid: false,
      missing_help_jtbd: [],
      missing_from_groups: [],
      orphan_in_groups: [],
      unlisted_deprecated: [],
      deprecated_in_groups: [],
      orphan_excluded: [],
      fatal: 'data/help-groups.json not found',
    };
  }
  const groups = JSON.parse(fs.readFileSync(groupsPath, 'utf8'));
  const allGroupedCommands = new Set();
  for (const g of groups.groups) {
    for (const c of g.commands) allGroupedCommands.add(c);
  }
  // The exclusion registry: deprecated_aliases keys (minus _-prefixed notes).
  // A deprecated command is EXCLUDED from group coverage only if it is listed
  // here -- that is the born-listed contract enforced by (d) below.
  const excludedRegistry = new Set(
    Object.keys(groups.deprecated_aliases || {}).filter((k) => !k.startsWith('_'))
  );

  const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith('.md'));
  const missing_help_jtbd = [];
  const missing_from_groups = [];
  const unlisted_deprecated = [];
  const deprecated_in_groups = [];

  for (const f of files) {
    const name = f.replace(/\.md$/, '');
    const text = fs.readFileSync(path.join(commandsDir, f), 'utf8');
    const fm = parseFrontmatter(text);
    if (!fm || !fm.help_jtbd) missing_help_jtbd.push(f);
    const visibility = (fm && fm.visibility) || 'user';
    const isDeprecated = !!(fm && String(fm.deprecated).trim() === 'true');

    // Admin surfaces are excluded by frontmatter; nothing more to check.
    if (visibility === 'admin') continue;

    if (isDeprecated) {
      // Born-listed exclusion: a deprecated command MUST be registered in
      // deprecated_aliases, and must NOT appear in a visible group.
      if (!excludedRegistry.has(name)) unlisted_deprecated.push(name);
      if (allGroupedCommands.has(name)) deprecated_in_groups.push(name);
      continue;
    }

    // A live user-facing command MUST appear in some group.
    if (!allGroupedCommands.has(name)) missing_from_groups.push(name);
  }

  const fileNames = new Set(files.map((f) => f.replace(/\.md$/, '')));
  const orphan_in_groups = [];
  for (const grouped of allGroupedCommands) {
    if (!fileNames.has(grouped)) orphan_in_groups.push(grouped);
  }
  // Ghosts in the exclusion registry: a deprecated_aliases key with no file.
  const orphan_excluded = [];
  for (const excluded of excludedRegistry) {
    if (!fileNames.has(excluded)) orphan_excluded.push(excluded);
  }

  const valid =
    missing_help_jtbd.length === 0 &&
    missing_from_groups.length === 0 &&
    orphan_in_groups.length === 0 &&
    unlisted_deprecated.length === 0 &&
    deprecated_in_groups.length === 0 &&
    orphan_excluded.length === 0;

  return {
    valid,
    missing_help_jtbd,
    missing_from_groups,
    orphan_in_groups,
    unlisted_deprecated,
    deprecated_in_groups,
    orphan_excluded,
  };
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
    for (const c of result.unlisted_deprecated || []) {
      console.error(
        '  UNLISTED deprecated command (add to deprecated_aliases): ' + c
      );
    }
    for (const c of result.deprecated_in_groups || []) {
      console.error(
        '  DEPRECATED command leaked into a group (remove it): ' + c
      );
    }
    for (const c of result.orphan_excluded || []) {
      console.error(
        '  ORPHAN in deprecated_aliases (no command file): ' + c
      );
    }
  }
  process.exit(result.valid ? 0 : 1);
}

if (require.main === module) main();

module.exports = { check };
