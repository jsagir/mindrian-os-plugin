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

// Parse serves_jtbd from a command's frontmatter as an array of tag strings.
// Handles both the inline form (serves_jtbd: ["a", "b"]) and the YAML block
// form (serves_jtbd:\n  - a\n  - b). Returns [] when the key is absent so the
// coherence check can distinguish "no tags" (a hard fail inside a group) from a
// legitimate tag set.
function parseServesJtbd(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return [];
  const fm = m[1];
  const inline = fm.match(/^serves_jtbd:\s*\[([^\]]*)\]/m);
  if (inline) {
    return inline[1]
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }
  const block = fm.match(/^serves_jtbd:\s*\n((?:[ \t]*-[ \t]*.+\n?)+)/m);
  if (block) {
    return block[1]
      .split('\n')
      .map((l) => l.match(/^[ \t]*-[ \t]*(.+?)\s*$/))
      .filter(Boolean)
      .map((x) => x[1].trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }
  return [];
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
      jtbd_missing_declaration: [],
      jtbd_unknown_tag: [],
      jtbd_incoherent: [],
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

  // Per-command metadata + the run-time JTBD vocabulary (union of every
  // non-admin command's serves_jtbd read from disk -- never a frozen literal,
  // so a drifted edit cannot silently satisfy the vocab check).
  const servesByName = new Map(); // name -> string[] (non-admin commands)
  const metaByName = new Map(); // name -> { admin, deprecated }
  const vocab = new Set();

  for (const f of files) {
    const name = f.replace(/\.md$/, '');
    const text = fs.readFileSync(path.join(commandsDir, f), 'utf8');
    const fm = parseFrontmatter(text);
    if (!fm || !fm.help_jtbd) missing_help_jtbd.push(f);
    const visibility = (fm && fm.visibility) || 'user';
    const isDeprecated = !!(fm && String(fm.deprecated).trim() === 'true');

    metaByName.set(name, { admin: visibility === 'admin', deprecated: isDeprecated });
    if (visibility !== 'admin') {
      const serves = parseServesJtbd(text);
      servesByName.set(name, serves);
      for (const t of serves) vocab.add(t);
    }

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

  // --- Family-JTBD coherence gate (quick-260705-sd5) -----------------------
  // Makes every family's membership traceable to a coherent JTBD outcome and a
  // standing CI gate, so the map cannot drift back into vibes-based grouping:
  //   (1) every group MUST declare a non-empty jtbd array (jtbd_missing_declaration).
  //   (2) every declared jtbd tag MUST be in the run-time vocabulary built
  //       above (jtbd_unknown_tag) -- vocab is the disk union, never a literal.
  //   (3) every non-admin, non-deprecated member command's serves_jtbd MUST
  //       intersect its family's jtbd (jtbd_incoherent); a member command with
  //       NO serves_jtbd at all is a hard fail here too (this makes the missing
  //       -tag gap class unrepresentable in the future).
  // Admin + deprecated + orphan members are handled by the membership checks
  // above; they are skipped here so a single command is never double-reported.
  const jtbd_missing_declaration = [];
  const jtbd_unknown_tag = [];
  const jtbd_incoherent = [];
  for (const g of groups.groups) {
    const declared = Array.isArray(g.jtbd) ? g.jtbd : null;
    if (!declared || declared.length === 0) {
      jtbd_missing_declaration.push(g.id);
      continue;
    }
    for (const tag of declared) {
      if (!vocab.has(tag)) jtbd_unknown_tag.push(g.id + ':' + tag);
    }
    for (const c of g.commands) {
      const meta = metaByName.get(c);
      if (!meta || meta.admin || meta.deprecated) continue;
      const serves = servesByName.get(c) || [];
      if (serves.length === 0 || !serves.some((t) => declared.includes(t))) {
        jtbd_incoherent.push(
          c + ' [' + serves.join(',') + '] does not intersect ' +
            g.id + ' [' + declared.join(',') + ']'
        );
      }
    }
  }

  const valid =
    missing_help_jtbd.length === 0 &&
    missing_from_groups.length === 0 &&
    orphan_in_groups.length === 0 &&
    unlisted_deprecated.length === 0 &&
    deprecated_in_groups.length === 0 &&
    orphan_excluded.length === 0 &&
    jtbd_missing_declaration.length === 0 &&
    jtbd_unknown_tag.length === 0 &&
    jtbd_incoherent.length === 0;

  return {
    valid,
    missing_help_jtbd,
    missing_from_groups,
    orphan_in_groups,
    unlisted_deprecated,
    deprecated_in_groups,
    orphan_excluded,
    jtbd_missing_declaration,
    jtbd_unknown_tag,
    jtbd_incoherent,
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
    for (const c of result.jtbd_missing_declaration || []) {
      console.error(
        '  MISSING jtbd declaration on group (add a non-empty jtbd list): ' + c
      );
    }
    for (const c of result.jtbd_unknown_tag || []) {
      console.error(
        '  UNKNOWN jtbd tag (not in the disk vocabulary): ' + c
      );
    }
    for (const c of result.jtbd_incoherent || []) {
      console.error('  INCOHERENT family membership: ' + c);
    }
  }
  process.exit(result.valid ? 0 : 1);
}

if (require.main === module) main();

module.exports = { check };
