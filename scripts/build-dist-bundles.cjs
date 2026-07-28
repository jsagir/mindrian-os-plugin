#!/usr/bin/env node
'use strict';

/*
 * Phase 234-07 (D-01 / D-02) - the ONE generator for the foreign-host
 * distribution bundles.
 *
 * WHY THIS FILE EXISTS. `skills/` is the canonical source of truth and it is
 * shaped for the Claude Code plugin loader. Every other Agent Skills host reads
 * one of exactly two other layouts:
 *
 *   dist/generic-claude-dir/.claude/skills/<name>/SKILL.md   (nested, assets kept)
 *       VS Code, Cursor, Goose, OpenCode, Copilot, Codex, Gemini CLI, Roo Code,
 *       Amp and the rest of the ~45-client agentskills.io showcase that read the
 *       `.claude/skills/` convention. 234-RESEARCH.md "Recommended distribution
 *       structure" estimates one artifact serves 30+ of them.
 *
 *   dist/zed/.agents/skills/<name>/SKILL.md                  (FLAT, no subdirs)
 *       Zed. Its loader is documented flat-only: a skill directory may not carry
 *       nested folders, and the whole catalog's name+description must fit one
 *       50KB budget or the overflow is dropped with a UI warning.
 *       Source: https://zed.dev/docs/ai/skills
 *
 * GENERATE, NEVER HAND-EDIT. Everything under dist/ is output. This file is the
 * sole writer, following the idiom scripts/build-connector-registry.cjs already
 * establishes for data/connector-registry.json. Maintaining parallel hand-kept
 * copies is the "N thin adapters over one core, forever" cost SEED-068 names;
 * the only way adapters stay cheap is if they are generated.
 *
 * CANON PART 7 (Reuse Before Build). The Zed budget number is NOT recomputed
 * here. `catalogBudget()` is required straight out of scripts/check-skill-spec.cjs
 * because that function already carries the hard-won gray-matter parse (a naive
 * regex undercounted the catalog by 33% during research, on the exact number this
 * budget gate depends on). One measurement, one owner.
 *
 * CANON PART 8 (The Graph Boundary). LOCAL-only. This generator reads skills/,
 * .claude-plugin/plugin.json and ~/.claude/plugins/ metadata. It makes ZERO
 * network reach and it never reads, embeds, or transports key material: the
 * generated .mcp.json carries an install PATH and nothing else. Brain key
 * resolution stays entirely on lib/core/resolve-brain-key.cjs's existing
 * env/file precedence, untouched here (threat T-234-13).
 *
 * THE UPDATE STORY, STATED HONESTLY (234-RESEARCH.md Open Question 3).
 * There is NO auto-update mechanism on any foreign host, and this phase does not
 * invent one. Claude Code has `claude plugin update`; VS Code, Cursor, Zed and
 * Gemini CLI have no equivalent for this content today. What this file adds is
 * the cheap half that is genuinely responsible to ship: dist/BUNDLE-VERSION.json
 * stamps what was generated from which source version, and `--check-stale`
 * makes drift MECHANICALLY DETECTABLE instead of silently assumed current
 * (threat T-234-14). See dist/README.md, which this generator writes.
 *
 * WHY dist/generic-claude-dir/.mcp.json IS NOT COMMITTED. It embeds a literal
 * absolute install path resolved on the generating machine. Committing it would
 * ship the maintainer's home directory to every user AND hand every user a path
 * that is wrong for them. The repo's pre-existing `.mcp.json` gitignore rule
 * already covers it at any depth; .gitignore now says so out loud so nobody
 * "fixes" it later with a negation. Everything else under dist/ IS committed,
 * matching how data/connector-registry.json (also generated) is tracked.
 *
 * CLI:
 *   node scripts/build-dist-bundles.cjs
 *       generate mode: rebuild both bundles + the version stamp + dist/README.md
 *   node scripts/build-dist-bundles.cjs --check-stale
 *       staleness only; exit 1 when the stamp is missing or its source_version
 *       no longer matches the live .claude-plugin/plugin.json version
 *
 * House rule: hyphens only, no em-dashes, no emoji. CJS, process.argv routing.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(REPO_ROOT, 'skills');
const DIST_DIR = path.join(REPO_ROOT, 'dist');
const GENERIC_ROOT = path.join(DIST_DIR, 'generic-claude-dir');
const GENERIC_SKILLS = path.join(GENERIC_ROOT, '.claude', 'skills');
const GENERIC_MCP = path.join(GENERIC_ROOT, '.mcp.json');
const ZED_ROOT = path.join(DIST_DIR, 'zed');
const ZED_SKILLS = path.join(ZED_ROOT, '.agents', 'skills');
const ZED_OMITTED = path.join(ZED_ROOT, 'OMITTED-ASSETS.md');
const VERSION_STAMP = path.join(DIST_DIR, 'BUNDLE-VERSION.json');
const DIST_README = path.join(DIST_DIR, 'README.md');
const PLUGIN_MANIFEST = path.join(REPO_ROOT, '.claude-plugin', 'plugin.json');

// Canon Part 7: reused, not re-derived. See the header.
const { catalogBudget, listSkillFiles, ZED_CATALOG_BUDGET_BYTES } = require('./check-skill-spec.cjs');
const { resolveActivePluginRoot } = require('../lib/core/active-plugin-root.cjs');

const GENERATED_BANNER =
  'GENERATED FILE - DO NOT HAND EDIT.\n' +
  'Regenerate with: node scripts/build-dist-bundles.cjs\n';

// ---------------------------------------------------------------------------
// fs helpers. Every destructive call is fenced inside dist/ by assertion, so a
// future refactor that mangles a path cannot reach the source tree.
// ---------------------------------------------------------------------------
function assertInsideDist(target) {
  const resolved = path.resolve(target);
  if (resolved !== DIST_DIR && !resolved.startsWith(DIST_DIR + path.sep)) {
    throw new Error('refusing to write or remove outside dist/: ' + resolved);
  }
  return resolved;
}

function resetDir(target) {
  const dir = assertInsideDist(target);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function writeInDist(target, contents) {
  const file = assertInsideDist(target);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

// Recursive, byte-identical copy. SKILL.md bodies are NEVER rewritten: 234-06
// already made every body host-neutral at the source, so any rewrite here would
// be a second, divergent contract.
function copyTree(src, dst) {
  assertInsideDist(dst);
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyTree(from, to);
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to);
    }
  }
}

// skills/<name>/SKILL.md -> [{ name, dir }], sorted, discovered through the
// SAME listSkillFiles() the spec validator uses so the two can never disagree
// about what "the catalog" is.
function listSkillDirs() {
  return listSkillFiles()
    .map((f) => ({ name: path.basename(path.dirname(f)), dir: path.dirname(f) }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

function pluginVersion() {
  return JSON.parse(fs.readFileSync(PLUGIN_MANIFEST, 'utf8')).version;
}

// ---------------------------------------------------------------------------
// buildGenericBundle()
//
// Nested layout. Every skill directory is copied whole (SKILL.md plus any
// references/ scripts/ assets/ it carries), then a foreign-host-safe .mcp.json
// is written beside it.
//
// The root .mcp.json is Claude-Code-shaped and is NEVER touched by this file.
// Two tokens in it do not survive the trip:
//   ${CLAUDE_PLUGIN_ROOT}  no foreign host expands it; it would land literally
//   alwaysLoad             a Claude Code plugin manifest key, not part of any
//                          cross-host MCP config convention
// So the generated variant substitutes a literal absolute path resolved HERE,
// at generation time, and also sets MINDRIAN_OS_ROOT in env so the server-side
// resolver (lib/core/active-plugin-root.cjs precedence #1) still succeeds if the
// install is later moved and the user updates one place instead of two.
// ---------------------------------------------------------------------------
function foreignMcpConfig(installRoot) {
  const env = { MINDRIAN_OS_ROOT: installRoot };
  return {
    mcpServers: {
      'mindrian-os': {
        command: 'node',
        args: [path.join(installRoot, 'bin', 'mindrian-mcp-server.cjs')],
        env: { ...env },
      },
      'mindrian-brain': {
        command: 'node',
        args: [path.join(installRoot, 'bin', 'mindrian-brain-mcp-client.cjs')],
        env: { ...env },
      },
    },
  };
}

function buildGenericBundle() {
  const skills = listSkillDirs();
  resetDir(GENERIC_ROOT);
  fs.mkdirSync(GENERIC_SKILLS, { recursive: true });
  for (const s of skills) {
    copyTree(s.dir, path.join(GENERIC_SKILLS, s.name));
  }

  // An install root is required for the args to mean anything. resolveActivePluginRoot()
  // is the repo's single owner of "where is the active install"; when nothing is
  // installed on this machine (a fresh clone, CI), fall back to the repo itself,
  // which is a genuine runnable root.
  const resolved = resolveActivePluginRoot();
  const installRoot = resolved && resolved.root ? resolved.root : REPO_ROOT;
  writeInDist(GENERIC_MCP, JSON.stringify(foreignMcpConfig(installRoot), null, 2) + '\n');

  return {
    root: GENERIC_ROOT,
    skillCount: skills.length,
    installRoot,
    installRootSource: resolved && resolved.root ? resolved.source : 'repo-root-fallback',
  };
}

// ---------------------------------------------------------------------------
// buildZedBundle()
//
// Flat layout, budget-guarded, fail-closed.
//
// Zed's loader does not descend into a skill's subdirectories, so a skill that
// carries references/ scripts/ assets/ cannot ship them here. Dropping content
// silently is the failure shape this phase exists to close, so every omission is
// recorded in dist/zed/OMITTED-ASSETS.md instead.
//
// The budget guard runs BEFORE any write. Zed's own docs say overflow is dropped
// with a UI warning, which means an over-budget catalog degrades quietly on the
// user's machine rather than loudly on ours. So this generator refuses to
// produce the bundle at all in that case (threat T-234-15).
// ---------------------------------------------------------------------------
function buildZedBundle() {
  const budget = catalogBudget();
  if (budget.totalBytes >= ZED_CATALOG_BUDGET_BYTES) {
    const err = new Error(
      'ZED CATALOG BUDGET EXCEEDED: ' + budget.totalBytes + ' bytes / ' + ZED_CATALOG_BUDGET_BYTES +
        ' across ' + budget.skills + ' skill(s). Refusing to write dist/zed/.\n' +
        'Recovery: shorten the longest `description` fields (see ' +
        'node scripts/check-skill-spec.cjs --catalog-budget), then re-run this generator.'
    );
    err.budgetExceeded = true;
    throw err;
  }

  const skills = listSkillDirs();
  resetDir(ZED_ROOT);
  fs.mkdirSync(ZED_SKILLS, { recursive: true });

  const omitted = [];
  for (const s of skills) {
    const dest = path.join(ZED_SKILLS, s.name);
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(s.dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const files = [];
        (function walk(dir, rel) {
          for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            if (e.isDirectory()) walk(path.join(dir, e.name), rel + '/' + e.name);
            else if (e.isFile()) files.push(rel + '/' + e.name);
          }
        })(path.join(s.dir, entry.name), entry.name);
        omitted.push({ skill: s.name, subdir: entry.name, files: files.sort() });
      } else if (entry.isFile()) {
        fs.copyFileSync(path.join(s.dir, entry.name), path.join(dest, entry.name));
      }
    }
  }

  writeInDist(ZED_OMITTED, renderOmittedManifest(omitted, skills.length, budget));
  return {
    root: ZED_ROOT,
    skillCount: skills.length,
    omitted,
    // A single skill can lose more than one subdirectory, so the two counts are
    // reported separately rather than conflated into one misleading number.
    omittedSkillCount: new Set(omitted.map((o) => o.skill)).size,
    budget,
  };
}

function renderOmittedManifest(omitted, skillCount, budget) {
  const lines = [];
  lines.push('<!-- ' + GENERATED_BANNER.trim().replace(/\n/g, ' | ') + ' -->');
  lines.push('');
  lines.push('# Zed bundle: assets omitted by the flat-layout constraint');
  lines.push('');
  lines.push(
    'Zed loads skills from a FLAT `.agents/skills/<name>/` directory and does not ' +
      'descend into subdirectories (https://zed.dev/docs/ai/skills). Skills in this ' +
      'repo may carry spec-sanctioned `references/`, `scripts/` and `assets/` ' +
      'subdirectories for progressive disclosure. Those cannot ship in this bundle.'
  );
  lines.push('');
  lines.push(
    'This file exists so the omission is RECORDED rather than silent. A skill listed ' +
      'below still loads on Zed, but any instruction in its SKILL.md body that points ' +
      'at one of these paths will not resolve there. The full content is always ' +
      'available in `dist/generic-claude-dir/` and in the source `skills/` tree.'
  );
  lines.push('');
  lines.push('- Skills in this bundle: ' + skillCount);
  lines.push('- Catalog name+description bytes: ' + budget.totalBytes + ' / ' + budget.budgetBytes +
    ' (' + budget.pct + '% of the Zed budget)');
  lines.push('- Skills with omitted subdirectories: ' + new Set(omitted.map((o) => o.skill)).size);
  lines.push('- Subdirectories omitted in total: ' + omitted.length);
  lines.push('');
  if (!omitted.length) {
    lines.push('No subdirectories were omitted: every skill in the catalog is already flat.');
    lines.push('');
    return lines.join('\n');
  }
  lines.push('| Skill | Omitted subdirectory | Files |');
  lines.push('|-------|----------------------|-------|');
  for (const o of omitted) {
    lines.push('| `' + o.skill + '` | `' + o.subdir + '/` | ' + o.files.map((f) => '`' + f + '`').join('<br>') + ' |');
  }
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// writeVersionStamp() -> dist/BUNDLE-VERSION.json
//
// Four keys, no more. This is the whole update mechanism: it records what was
// generated, from which source version, so `--check-stale` can answer "is this
// bundle current?" without guessing.
// ---------------------------------------------------------------------------
function writeVersionStamp() {
  const budget = catalogBudget();
  const stamp = {
    source_version: pluginVersion(),
    generated_at: new Date().toISOString(),
    skill_count: listSkillDirs().length,
    catalog_bytes: budget.totalBytes,
  };
  writeInDist(VERSION_STAMP, JSON.stringify(stamp, null, 2) + '\n');
  return stamp;
}

// ---------------------------------------------------------------------------
// checkStale() -> { stale, bundled_version, live_version, reason }
//
// The honest answer to RESEARCH Open Question 3. No auto-update is built; drift
// is simply made detectable. A missing stamp counts as stale, because "no stamp"
// and "current" are indistinguishable otherwise, and defaulting the unknown case
// to fresh is exactly the silent-success shape this phase closes.
// ---------------------------------------------------------------------------
function checkStale() {
  const live = pluginVersion();
  let stamp;
  try {
    stamp = JSON.parse(fs.readFileSync(VERSION_STAMP, 'utf8'));
  } catch (_e) {
    return { stale: true, bundled_version: null, live_version: live, reason: 'no dist/BUNDLE-VERSION.json (bundle never generated, or removed)' };
  }
  const bundled = stamp.source_version || null;
  if (bundled !== live) {
    return { stale: true, bundled_version: bundled, live_version: live, reason: 'bundle was generated from ' + bundled + ', the live plugin is ' + live };
  }
  return { stale: false, bundled_version: bundled, live_version: live, reason: 'bundle matches the live plugin version' };
}

// ---------------------------------------------------------------------------
// dist/README.md - the update story, in plain words, shipped WITH the bundle.
// ---------------------------------------------------------------------------
function renderDistReadme(generic, zed, stamp) {
  return [
    '<!-- ' + GENERATED_BANNER.trim().replace(/\n/g, ' | ') + ' -->',
    '',
    '# MindrianOS distribution bundles',
    '',
    'Generated from the canonical `skills/` tree by `scripts/build-dist-bundles.cjs`.',
    'Nothing in this directory is hand-edited. Edit `skills/`, then regenerate.',
    '',
    '## There is no auto-update mechanism',
    '',
    'These bundles are generated SNAPSHOTS, not auto-updating installs. Claude Code',
    'has `claude plugin update`; VS Code, Cursor, Zed, Gemini CLI and the rest of the',
    'Agent Skills ecosystem have no equivalent for this content today. A copy you',
    'placed on a foreign host will stay exactly as old as the day you placed it.',
    '',
    'To refresh:',
    '',
    '```bash',
    'node scripts/build-dist-bundles.cjs      # regenerate both bundles',
    '# then copy the bundle into your host again, manually',
    '```',
    '',
    'To find out whether a bundle is behind before you trust it:',
    '',
    '```bash',
    'node scripts/build-dist-bundles.cjs --check-stale   # exit 1 when stale',
    '```',
    '',
    'That check compares `dist/BUNDLE-VERSION.json`\'s `source_version` against the',
    'live `.claude-plugin/plugin.json` version. Staleness is mechanically detectable,',
    'not silently assumed.',
    '',
    '## What is here',
    '',
    '| Bundle | Layout | Hosts |',
    '|--------|--------|-------|',
    '| `generic-claude-dir/` | nested `.claude/skills/<name>/SKILL.md` plus each skill\'s `references/`, `scripts/`, `assets/` | VS Code, Cursor, Goose, OpenCode, Copilot, Codex, Gemini CLI, Roo Code, Amp and the rest of the Agent Skills clients that read the `.claude/skills/` convention |',
    '| `zed/` | FLAT `.agents/skills/<name>/SKILL.md`, no nested folders | Zed only (its loader does not descend into skill subdirectories) |',
    '',
    '- Skills in each bundle: ' + generic.skillCount,
    '- Catalog name+description bytes: ' + stamp.catalog_bytes + ' / ' + zed.budget.budgetBytes +
      ' (' + zed.budget.pct + '% of Zed\'s 50KB budget)',
    '- Skills whose subdirectories could not ship to Zed: ' + zed.omittedSkillCount +
      ' (' + zed.omitted.length + ' subdirectories in total, recorded in `zed/OMITTED-ASSETS.md`)',
    '',
    '## `generic-claude-dir/.mcp.json` is machine-specific',
    '',
    'It is generated with a LITERAL absolute path to the MindrianOS install on the',
    'machine that ran the generator, because no foreign host expands',
    '`${CLAUDE_PLUGIN_ROOT}`. That is why it is deliberately not committed to the',
    'repository: the path would be wrong for everyone else. Run the generator on your',
    'own machine to get a correct one, or edit the two `args` paths and the',
    '`MINDRIAN_OS_ROOT` env value by hand.',
    '',
    'It carries a path and nothing else. No Brain key, no credential, ever.',
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function main() {
  const argv = process.argv.slice(2);

  if (argv.includes('--check-stale')) {
    const r = checkStale();
    if (r.stale) {
      console.error('dist bundle STALE: ' + r.reason);
      console.error('Recovery: node scripts/build-dist-bundles.cjs');
      process.exit(1);
      return;
    }
    console.log('dist bundle fresh: stale=false (source_version ' + r.bundled_version + ')');
    return;
  }

  if (argv.length && !argv.includes('--check-stale')) {
    console.error('usage: node scripts/build-dist-bundles.cjs [--check-stale]');
    process.exit(2);
    return;
  }

  fs.mkdirSync(DIST_DIR, { recursive: true });

  const generic = buildGenericBundle();
  console.log(
    'Wrote dist/generic-claude-dir/ (' + generic.skillCount + ' skills, nested .claude/skills/**)'
  );
  console.log(
    '  .mcp.json install root: ' + generic.installRoot + ' (source: ' + generic.installRootSource + ')'
  );

  let zed;
  try {
    zed = buildZedBundle();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
    return;
  }
  console.log(
    'Wrote dist/zed/ (' + zed.skillCount + ' skills, flat .agents/skills/**, ' +
      zed.budget.totalBytes + '/' + zed.budget.budgetBytes + ' catalog bytes = ' + zed.budget.pct + '%)'
  );
  console.log(
    '  ' + zed.omitted.length + ' subdirectory omission(s) across ' + zed.omittedSkillCount +
      ' skill(s), recorded in dist/zed/OMITTED-ASSETS.md'
  );

  const stamp = writeVersionStamp();
  console.log(
    'Wrote dist/BUNDLE-VERSION.json (source_version ' + stamp.source_version + ', ' +
      stamp.skill_count + ' skills, ' + stamp.catalog_bytes + ' catalog bytes)'
  );

  writeInDist(DIST_README, renderDistReadme(generic, zed, stamp));
  console.log('Wrote dist/README.md (no-auto-update statement + staleness check)');
}

if (require.main === module) {
  main();
}

module.exports = {
  buildGenericBundle,
  buildZedBundle,
  writeVersionStamp,
  checkStale,
  listSkillDirs,
  foreignMcpConfig,
  DIST_DIR,
  GENERIC_ROOT,
  GENERIC_SKILLS,
  GENERIC_MCP,
  ZED_ROOT,
  ZED_SKILLS,
  VERSION_STAMP,
};
