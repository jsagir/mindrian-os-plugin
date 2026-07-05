#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick task 260602-rgx -- regression test that locks the /mos:help selector-menu
 * lane contract.
 *
 * /mos:help is a Shape F two-axis lanes-as-tabs selector (commands/help.md) over
 * data/help-groups.json -- the 4 lanes (start|methodology|explore|view) render as
 * parallel AskUserQuestion question-tabs (the LANE axis) and each lane's commands
 * are that question's options (the COMMAND axis). SEED-020: this is the first
 * user-facing application of Shape F as the universal Mindrian UI. The menu shows
 * ALL non-admin commands; only
 * visibility: admin commands (admin, dogfood-flush) and the deprecated_aliases (soft
 * redirects) are hidden. That feature shipped as ad-hoc edits with no regression test.
 *
 * This test asserts the four invariants that a future edit must not silently break:
 *   1. Every group declares a lane in the closed set {start, methodology, explore, view}.
 *   2. The 4 lanes collectively cover every non-admin command EXACTLY once (full
 *      coverage + no duplicate). The non-admin set is derived from commands/*.md
 *      frontmatter (visibility != admin) minus the deprecated_aliases keys, mirroring
 *      scripts/check-help-coverage.cjs.
 *   3. No visibility: admin command (admin, dogfood-flush) and no deprecated_aliases
 *      key appears in any group.
 *   4. scripts/help-renderer.cjs text view exits 0 and prints a /mos:<cmd> line for
 *      every non-admin command.
 *
 * Mirrors the tests/test-doctor-class-a-topology-drift.cjs CJS pattern (node:assert,
 * pass/failTest counters, process.exit). Registered in lib/memory/run-feynman-tests.cjs.
 *
 * Canon Part 7 (Reuse Before Build): the non-admin derivation mirrors
 * scripts/check-help-coverage.cjs exactly rather than inventing a second visibility
 * convention.
 * Canon Part 8 (Graph Boundary): filesystem only -- zero network surface.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const GROUPS_PATH = path.join(REPO_ROOT, 'data', 'help-groups.json');
const COMMANDS_DIR = path.join(REPO_ROOT, 'commands');
const RENDERER = path.join(REPO_ROOT, 'scripts', 'help-renderer.cjs');
const HELP_MD = path.join(REPO_ROOT, 'commands', 'help.md');

const LANE_ENUM = new Set(['start', 'methodology', 'explore', 'view']);

let passed = 0;
let failed = 0;
function pass(name) { passed += 1; console.log('PASS: ' + name); }
function failTest(name, err) { failed += 1; console.log('FAIL: ' + name + '\n    ' + (err && err.message || err)); }

// Frontmatter parser -- byte-for-byte the dialect scripts/check-help-coverage.cjs
// uses (first match per key, anchored ---\n...\n--- block).
function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-z_]+):\s*(.+)$/i);
    if (kv && out[kv[1]] === undefined) out[kv[1]] = kv[2].trim();
  }
  return out;
}

// Derive the non-admin command set exactly as scripts/check-help-coverage.cjs:
// a command is non-admin when its frontmatter visibility is not 'admin', minus the
// deprecated_aliases keys (soft redirects).
function deriveNonAdminCommands(groups) {
  const deprecated = new Set(
    Object.keys(groups.deprecated_aliases || {}).filter((k) => !k.startsWith('_'))
  );
  const files = fs.readdirSync(COMMANDS_DIR).filter((f) => f.endsWith('.md'));
  const nonAdmin = new Set();
  const adminCommands = new Set();
  for (const f of files) {
    const name = f.replace(/\.md$/, '');
    const fm = parseFrontmatter(fs.readFileSync(path.join(COMMANDS_DIR, f), 'utf8'));
    const visibility = (fm && fm.visibility) || 'user';
    if (visibility === 'admin') {
      adminCommands.add(name);
      continue;
    }
    if (!deprecated.has(name)) nonAdmin.add(name);
  }
  return { nonAdmin, adminCommands, deprecated };
}

const groups = JSON.parse(fs.readFileSync(GROUPS_PATH, 'utf8'));
const { nonAdmin, adminCommands, deprecated } = deriveNonAdminCommands(groups);

// -- Assertion 1: every group declares a lane in the closed enum -----------
try {
  assert.ok(Array.isArray(groups.groups) && groups.groups.length > 0, 'groups.groups is a non-empty array');
  for (const g of groups.groups) {
    assert.ok(typeof g.lane === 'string', 'group ' + g.id + ' declares a lane (string); got ' + JSON.stringify(g.lane));
    assert.ok(LANE_ENUM.has(g.lane),
      'group ' + g.id + ' lane "' + g.lane + '" must be one of {start, methodology, explore, view}');
  }
  pass('Assertion 1 (every group declares a lane in the closed enum)');
} catch (err) { failTest('Assertion 1 (every group declares a lane in the closed enum)', err); }

// -- Assertion 2: the 4 lanes cover every non-admin command EXACTLY once ----
try {
  // Build the union of all command lists, keyed by lane, tracking duplicates.
  const seen = new Map(); // cmd -> lane that first claimed it
  const dups = [];
  const lanesPresent = new Set();
  for (const g of groups.groups) {
    lanesPresent.add(g.lane);
    for (const cmd of g.commands) {
      if (seen.has(cmd)) {
        dups.push(cmd + ' (in lane ' + seen.get(cmd) + ' and ' + g.lane + ')');
      } else {
        seen.set(cmd, g.lane);
      }
    }
  }
  // No command appears in two groups (no dup).
  assert.strictEqual(dups.length, 0, 'no command appears in two groups; dups: ' + JSON.stringify(dups));

  // The union equals the non-admin set: full coverage (no orphan) + no extra.
  const grouped = new Set(seen.keys());
  const orphan = [...nonAdmin].filter((c) => !grouped.has(c));
  const extra = [...grouped].filter((c) => !nonAdmin.has(c));
  assert.strictEqual(orphan.length, 0, 'every non-admin command is covered by a lane; orphaned: ' + JSON.stringify(orphan));
  assert.strictEqual(extra.length, 0, 'no lane references a non-non-admin command; extra: ' + JSON.stringify(extra));
  assert.strictEqual(grouped.size, nonAdmin.size,
    'lane union size (' + grouped.size + ') equals non-admin set size (' + nonAdmin.size + ')');

  // All four lanes are actually used (the enum is the cover, not a superset).
  for (const lane of LANE_ENUM) {
    assert.ok(lanesPresent.has(lane), 'lane "' + lane + '" is used by at least one group');
  }
  pass('Assertion 2 (4 lanes cover every non-admin command EXACTLY once; ' + nonAdmin.size + ' commands)');
} catch (err) { failTest('Assertion 2 (4 lanes cover every non-admin command EXACTLY once)', err); }

// -- Assertion 3: no admin command and no deprecated alias appears in groups
try {
  // admin set must be exactly {admin, dogfood-flush} per the canon note.
  assert.ok(adminCommands.has('admin'), 'admin is a visibility:admin command');
  assert.ok(adminCommands.has('dogfood-flush'), 'dogfood-flush is a visibility:admin command');

  const grouped = new Set();
  for (const g of groups.groups) for (const c of g.commands) grouped.add(c);

  const leakedAdmin = [...adminCommands].filter((c) => grouped.has(c));
  assert.strictEqual(leakedAdmin.length, 0, 'no visibility:admin command appears in any group; leaked: ' + JSON.stringify(leakedAdmin));

  const leakedAlias = [...deprecated].filter((c) => grouped.has(c));
  assert.strictEqual(leakedAlias.length, 0, 'no deprecated_aliases key appears in any group; leaked: ' + JSON.stringify(leakedAlias));
  pass('Assertion 3 (no admin command and no deprecated alias appears in any group)');
} catch (err) { failTest('Assertion 3 (no admin command and no deprecated alias appears in any group)', err); }

// -- Assertion 4: help-renderer.cjs text view exits 0 + prints every command
try {
  // spawnSync pipes stdout (isTTY false) so probeCapability() returns 'ascii'
  // deterministically -- but the /mos:<cmd> substring check is branch-independent
  // (both the ASCII and truecolor branches emit '/mos:' + cmd verbatim). Scrub any
  // inherited force-color / Desktop overrides so the child sees a clean text view.
  const env = Object.assign({}, process.env);
  delete env.MINDRIAN_FORCE_TRUECOLOR;
  delete env.MINDRIAN_FORCE_256COLOR;
  delete env.CLAUDE_DESKTOP;
  delete env.MINDRIAN_DESKTOP;
  const r = spawnSync('node', [RENDERER], { encoding: 'utf8', timeout: 30000, env });
  assert.strictEqual(r.status, 0, 'help-renderer.cjs exits 0; got ' + r.status + ' :: ' + (r.stderr || '').slice(0, 200));
  const out = r.stdout || '';
  const missing = [];
  for (const cmd of nonAdmin) {
    if (out.indexOf('/mos:' + cmd) === -1) missing.push(cmd);
  }
  assert.strictEqual(missing.length, 0, 'renderer prints a /mos:<cmd> line for every non-admin command; missing: ' + JSON.stringify(missing));
  // And the admin commands must NOT surface in the rendered text view.
  const leaked = [...adminCommands].filter((c) => out.indexOf('/mos:' + c) !== -1);
  assert.strictEqual(leaked.length, 0, 'renderer must not print any visibility:admin /mos:<cmd> line; leaked: ' + JSON.stringify(leaked));
  pass('Assertion 4 (help-renderer.cjs text view exits 0 and prints every non-admin command)');
} catch (err) { failTest('Assertion 4 (help-renderer.cjs text view exits 0 and prints every non-admin command)', err); }

// -- Assertion 5: commands/help.md default render is the 3-CARD 11-FAMILY Shape-F
// selector (quick task 260705-jeq), NOT a flat list and NOT the retired 4-lane /
// sequential drill-down framing. SEED-020 is the first user-facing application of
// Shape F as the universal Mindrian UI; this assertion locks the CURRENT contract
// so a future edit cannot silently regress it (updated from the 2-axis lanes-as-
// tabs contract when help.md moved to the 11-family 3-card map).
try {
  const md = fs.readFileSync(HELP_MD, 'utf8');

  // The current contract: 11 families as 3 sequential cards, each card its own
  // AskUserQuestion call, sourced from data/help-groups.json (never hardcoded),
  // the exact escape-hatch line for families over 4 commands, run via the Skill
  // tool, and an explicit honesty clause about NOT claiming host keybindings.
  assert.ok(/11 famil/i.test(md), 'help.md names the 11-family surface');
  assert.ok(/3-card|3 cards|three cards|Card 1/i.test(md), 'help.md renders the 11 families as 3 cards');
  assert.ok(/AskUserQuestion call/i.test(md), 'help.md renders each card as an AskUserQuestion call');
  assert.ok(/more in this family - type \/mos:help <family-id> to see all/.test(md),
    'help.md keeps the exact escape-hatch line for families over 4 commands (2026-07-05: reworded from "lane" to "family", the last stale-copy residual a live Windows QA pass caught)');
  assert.ok(/help-renderer\.cjs --group/.test(md),
    'help.md family text-list path delegates to help-renderer.cjs --group');
  assert.ok(/data\/help-groups\.json/.test(md),
    'help.md sources family contents from data/help-groups.json (one source of truth)');
  assert.ok(/Skill tool/i.test(md), 'help.md runs the selected command via the Skill tool');

  // Honest about the host keymap: must NOT instruct the navigator to press a
  // specific tab-switch key (the plugin cannot control the host keymap).
  assert.ok(/does NOT control the host's keybindings|do not control the host keymap/i.test(md),
    'help.md is explicit that the plugin does not control the host keymap');
  assert.ok(!/press Tab|press Left\/Right|press the Tab key/i.test(md),
    'help.md must NOT claim a specific tab-switch keybinding the plugin cannot control');

  // The retired framings must be gone: the stale 4-lane claim, the "one
  // AskUserQuestion call" single-call phrasing, and the sequential drill-down.
  assert.ok(!/4-lane|4 lanes/i.test(md), 'help.md no longer carries the stale "4-lane" claim');
  assert.ok(!/one AskUserQuestion call/i.test(md), 'help.md no longer claims "one AskUserQuestion call" (the single-call model is retired)');
  assert.ok(!/Level 1 -- lane/i.test(md), 'help.md no longer uses the sequential "Level 1 -- lane" drill-down framing');
  assert.ok(!/Level 3 -- command/i.test(md), 'help.md no longer uses the sequential "Level 3 -- command" drill-down framing');

  // The text fallback must STILL delegate to the renderer verbatim (unchanged).
  assert.ok(/scripts\/help-renderer\.cjs/.test(md), 'help.md text fallback still delegates to scripts/help-renderer.cjs');
  pass('Assertion 5 (help.md default render is the 3-card 11-family selector; text fallback unchanged)');
} catch (err) { failTest('Assertion 5 (help.md 3-card 11-family contract)', err); }

if (failed > 0) {
  console.log('\n' + failed + ' assertion block(s) FAILED (' + passed + ' passed)');
  process.exit(1);
}
console.log('\nAll ' + passed + ' assertion blocks PASS');
process.exit(0);
