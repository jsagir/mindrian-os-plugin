#!/usr/bin/env node
'use strict';

/*
 * scripts/migrate-plugin-root-refs.cjs -- ONE-TIME codemod (phase 234-06, D-01/D-02).
 *
 * THE HAZARD IT CLOSES (RESEARCH.md Security Domain, threat T-234-11, Tampering).
 *   Every skills/<name>/SKILL.md body instructs shell-outs of the shape
 *
 *       bash "${CLAUDE_PLUGIN_ROOT}/scripts/room-registry" list
 *       node "${CLAUDE_PLUGIN_ROOT}/scripts/soft-alias-runner.cjs" ...
 *       cp   "${CLAUDE_PLUGIN_ROOT}/templates/icm/CLAUDE.md" ...
 *
 *   `CLAUDE_PLUGIN_ROOT` is set by Claude Code and by NOTHING else. On any
 *   Agent-Skills-compliant foreign host (VS Code, Cursor, Goose, Zed, and the
 *   ~45 others in the showcase) the variable is undefined, so the expansion
 *   collapses to the empty string and the command silently becomes
 *
 *       bash "/scripts/room-registry" list
 *
 *   That is an ABSOLUTE path at the filesystem root -- a location an attacker
 *   (or any other package) can plant a file at. Silent misresolution to an
 *   attacker-plantable path is the Tampering finding. The fix is not a better
 *   guess; it is to make the failure LOUD.
 *
 * WHAT IT WRITES. Every literal `${CLAUDE_PLUGIN_ROOT}` in a skill BODY becomes
 *
 *   ${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?<message>}}
 *
 *   which is plain POSIX nested parameter expansion (verified on bash and dash):
 *     - MINDRIAN_OS_ROOT set   -> used. This is precedence #1 of the documented
 *                                 resolver lib/core/active-plugin-root.cjs ("tests,
 *                                 dev boxes, hand clones"), i.e. the existing escape
 *                                 hatch a foreign-host install exports, NOT a second
 *                                 competing mechanism.
 *     - MINDRIAN_OS_ROOT unset -> falls through to `${CLAUDE_PLUGIN_ROOT:?msg}`,
 *                                 which on Claude Code expands exactly as it does
 *                                 today (byte-identical runtime behavior), and when
 *                                 NEITHER is set aborts the shell with a clear stderr
 *                                 message and a non-zero exit. Fail closed. The
 *                                 command never runs against `/scripts/...`.
 *
 * IDEMPOTENT BY CONSTRUCTION. The replacement contains `${CLAUDE_PLUGIN_ROOT:?...}`
 * -- a COLON, not a closing brace, after the name -- so the bare token
 * `${CLAUDE_PLUGIN_ROOT}` never appears in the output. A second run finds zero
 * occurrences and writes nothing. That is also exactly why the post-migration
 * assertion can just grep for the bare token instead of hand-parsing shell.
 *
 * SCOPE -- skills/ ONLY, commands/ DELIBERATELY UNTOUCHED (threat T-234-12,
 * disposition: accept). commands/ is a Claude-Code-only plugin concept. No
 * Agent-Skills host loads or executes a commands/ directory at all, so a
 * `${CLAUDE_PLUGIN_ROOT}` reference there is unreachable on a foreign host by
 * construction and carries zero Tier-0 exposure. Migrating it would be scope
 * creep with no security benefit -- and commands/*.md is the READ-ONLY source of
 * truth for build-command-registry.cjs, build-render-coverage.cjs and
 * check-help-coverage.cjs, so touching it is not free.
 *
 * THE MIRROR CONTRACT. skills/<name>/SKILL.md is a GENERATED mirror of
 * commands/<name>.md (scripts/build-skill-mirrors.cjs). Editing skill bodies
 * without teaching that generator would make `--check` report 51 stale mirrors
 * and a write-mode run would SILENTLY REVERT this security migration -- the exact
 * failure 234-03 already hit once. So this codemod ships together with EXCEPTION
 * CLASS 3 in build-skill-mirrors.cjs, which applies this same deterministic
 * body transformation when computing EXPECTED mirror content. The two share the
 * transformation via the exports at the bottom of this file, so they cannot drift.
 *
 * TEXT SUBSTITUTION, NOT AN AST ROUND-TRIP. Same constraint as 234-03's codemod:
 * these are skill BODIES carrying hand-written prose, fenced examples and
 * comments. A markdown/YAML re-serialize can silently reflow or drop them. Plain
 * String.split/join on the raw bytes is the minimal-diff, comment-safe approach.
 *
 * Usage:
 *   node scripts/migrate-plugin-root-refs.cjs            # write mode
 *   node scripts/migrate-plugin-root-refs.cjs --dry-run  # report only, writes nothing
 *
 * Canon Part 8: pure local file rewriting. Zero network, zero egress.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

// The bare, unguarded token. Note the `}` immediately after the name -- that is
// what makes it distinguishable from the guarded `${CLAUDE_PLUGIN_ROOT:?...}`
// form that appears INSIDE the replacement.
const BARE_TOKEN = '${CLAUDE_PLUGIN_ROOT}';

const FAIL_CLOSED_MESSAGE =
  'MindrianOS install root not found. Set MINDRIAN_OS_ROOT ' +
  '(see lib/core/active-plugin-root.cjs) or run from Claude Code.';

const PORTABLE_TOKEN =
  '${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?' + FAIL_CLOSED_MESSAGE + '}}';

// Index of the closing '---' frontmatter fence, or -1 when the file has no
// fence pair. Body = everything after that line. Scoping the rewrite to the BODY
// keeps it aligned with check-skill-spec.cjs's pluginRootCensus(), which greps
// the frontmatter-stripped body, and guarantees no frontmatter key can ever be
// disturbed by this codemod.
function frontmatterEndIndex(lines) {
  if (lines[0] !== '---') return -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') return i;
  }
  return -1;
}

// The single deterministic transformation, shared with build-skill-mirrors.cjs's
// EXCEPTION CLASS 3. Rewrites BODY lines only. Returns { text, replacements }.
function portablePluginRoot(text) {
  const lines = String(text).split('\n');
  const fmEnd = frontmatterEndIndex(lines);
  let replacements = 0;
  for (let i = fmEnd + 1; i < lines.length; i++) {
    if (!lines[i].includes(BARE_TOKEN)) continue;
    const parts = lines[i].split(BARE_TOKEN);
    replacements += parts.length - 1;
    lines[i] = parts.join(PORTABLE_TOKEN);
  }
  return { text: lines.join('\n'), replacements };
}

function main() {
  const dryRun = process.argv.includes('--dry-run');

  // Authoritative file list from the census -- required, never re-derived, so
  // this codemod and the checker can never disagree about the surface.
  const { pluginRootCensus } = require('./check-skill-spec.cjs');
  const census = pluginRootCensus();

  const targets = census.files.filter((rel) => /^skills\/[^/]+\/SKILL\.md$/.test(rel));
  const excluded = census.files.filter((rel) => !targets.includes(rel));

  let totalReplacements = 0;
  let filesChanged = 0;

  for (const rel of targets) {
    const abs = path.join(REPO_ROOT, rel);
    const before = fs.readFileSync(abs, 'utf8');
    const { text, replacements } = portablePluginRoot(before);
    if (replacements === 0 || text === before) {
      console.log('  unchanged  ' + rel);
      continue;
    }
    if (!dryRun) fs.writeFileSync(abs, text, 'utf8');
    filesChanged += 1;
    totalReplacements += replacements;
    console.log('  ' + String(replacements).padStart(3, ' ') + ' repl  ' + rel);
  }

  for (const rel of excluded) {
    console.log('  SKIPPED (outside skills/<name>/SKILL.md): ' + rel);
  }

  console.log(
    (dryRun ? 'migrate-plugin-root-refs --dry-run: ' : 'migrate-plugin-root-refs: ') +
      filesChanged + ' file(s) ' + (dryRun ? 'would change' : 'changed') + ', ' +
      totalReplacements + ' occurrence(s) wrapped, ' +
      census.scanned + ' skill(s) scanned, commands/ untouched by design.'
  );
}

module.exports = { portablePluginRoot, BARE_TOKEN, PORTABLE_TOKEN, FAIL_CLOSED_MESSAGE };

if (require.main === module) {
  main();
}
