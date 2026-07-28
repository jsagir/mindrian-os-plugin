#!/usr/bin/env node
'use strict';

/*
 * Phase 234-06 (D-01 / D-02) -- the plugin-root fail-closed gate.
 *
 * WHAT THIS DEFENDS (threat T-234-11, Tampering). `CLAUDE_PLUGIN_ROOT` is
 * exported by Claude Code and by NOTHING else. Every skills/<name>/SKILL.md is
 * precisely the artifact an Agent-Skills foreign host (VS Code, Cursor, Goose,
 * Zed, and the ~45 others in the showcase) loads into its active instructions,
 * and 51 of them instructed shell-outs through "${CLAUDE_PLUGIN_ROOT}/scripts/x".
 * On those hosts the variable is undefined, the expansion collapses to the empty
 * string, and the instruction silently becomes `bash "/scripts/x"` - an absolute
 * path at the filesystem root, a location an attacker can plant a file at. Exit
 * status 0, no warning. The SILENCE is the vulnerability.
 *
 * WHAT IT ASSERTS, in four layers, weakest to strongest:
 *   1. TEXTUAL      no bare `${CLAUDE_PLUGIN_ROOT}` survives in any of the 125
 *                   skill bodies (not just the 51 that were on the census, so a
 *                   NEWLY added skill carrying the bare form also trips this).
 *   2. SHAPE        every surviving reference sits inside the MINDRIAN_OS_ROOT-first
 *                   wrapper, and MINDRIAN_OS_ROOT is the documented precedence #1
 *                   of lib/core/active-plugin-root.cjs - the shipped escape hatch,
 *                   reused, not a second competing mechanism.
 *   3. BEHAVIORAL   a REAL line lifted off a migrated SKILL.md is evaluated in a
 *                   real shell under three environments. Text can lie about what
 *                   a shell does; running it cannot. This is the layer that
 *                   actually proves "fail closed" rather than asserting it.
 *   4. DURABILITY   skills/ are GENERATED mirrors of commands/. If
 *                   build-skill-mirrors.cjs does not itself expect the wrapped
 *                   form, its next write-mode run silently REVERTS this entire
 *                   security migration - the exact class of gap D-1 already
 *                   caught once in this phase. So the mirror generator's EXPECTED
 *                   content is compared against disk, and its restated copy of
 *                   the wrapper constant is compared byte-for-byte against the
 *                   codemod's.
 *
 * SCOPE CHECK, ASSERTED NOT ASSUMED. commands/*.md keeps its bare references on
 * purpose (threat T-234-12, disposition accept): no Agent-Skills host loads a
 * commands/ directory at all, so the reference is unreachable there by
 * construction, and commands/ is the read-only source of truth for
 * build-command-registry.cjs, build-render-coverage.cjs and check-help-coverage.cjs.
 * This test asserts commands/ STILL carries them, so an over-eager future codemod
 * that "helpfully" migrates commands/ trips a failing test instead of quietly
 * mutating the registry source of truth.
 *
 * HARNESS HONESTY. A census that scanned zero skills, or a shell probe that never
 * reached a real migrated line, would read as a vacuous pass. Both are asserted
 * against explicit floors first, so this harness proves it reached real data
 * before it grades it.
 *
 * Canon Part 8: reads local repo files and spawns local `bash -c` probes with a
 * scrubbed environment. Zero network, zero writes.
 *
 * Run: node tests/test-234-plugin-root-migrated.cjs
 * Exit: 0 when every check passes, non-zero otherwise. No em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const COMMANDS_DIR = path.join(REPO_ROOT, 'commands');

// A skill count far below this means the census walker broke, not that the repo
// shrank. 100 is a deliberately loose floor under the current 125.
const MIN_SKILLS_SCANNED = 100;

// The census surface this plan migrated. A drop far below this means the codemod
// ran against the wrong tree, not that the work is done.
const MIN_MIGRATED_FILES = 45;

let passed = 0;
let failed = 0;

function check(label, cond, detail) {
  try {
    assert.ok(cond, label);
    passed += 1;
    process.stdout.write('  ok - ' + label + '\n');
  } catch (e) {
    failed += 1;
    process.stdout.write('  FAIL - ' + label + '\n');
    if (detail) process.stdout.write('    ' + detail + '\n');
  }
}

// Body = everything after the closing frontmatter fence. Same scope as
// check-skill-spec.cjs's pluginRootCensus(), which is where these references live.
function skillBody(text) {
  const lines = String(text).split('\n');
  if (lines[0] !== '---') return String(text);
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') return lines.slice(i + 1).join('\n');
  }
  return String(text);
}

// Run one shell line under an explicitly controlled environment. `env` keys set
// to null are DELETED, which is what simulates a foreign host that never had
// CLAUDE_PLUGIN_ROOT in the first place.
function probe(line, envOverrides) {
  const env = Object.assign({}, process.env);
  for (const [k, v] of Object.entries(envOverrides)) {
    if (v === null) delete env[k];
    else env[k] = v;
  }
  const r = cp.spawnSync('bash', ['-c', line], { env, encoding: 'utf8', timeout: 15000 });
  return { status: r.status, stdout: String(r.stdout || ''), stderr: String(r.stderr || '') };
}

(function main() {
  process.stdout.write('\ntest-234-plugin-root-migrated (D-01/D-02, threat T-234-11)\n\n');

  const { pluginRootCensus, listSkillFiles, PLUGIN_ROOT_TOKEN } = require('../scripts/check-skill-spec.cjs');
  const mirrors = require('../scripts/build-skill-mirrors.cjs');
  const codemod = require('../scripts/migrate-plugin-root-refs.cjs');

  // -------------------------------------------------------------------------
  // Layer 0: harness honesty. Prove we reached real data before grading it.
  // -------------------------------------------------------------------------
  const census = pluginRootCensus();
  check(
    'census scanned >= ' + MIN_SKILLS_SCANNED + ' skills (got ' + census.scanned + ')',
    census.scanned >= MIN_SKILLS_SCANNED,
    'A near-zero scan would make every assertion below vacuously true.'
  );
  check(
    'census token is the BARE form ' + JSON.stringify(PLUGIN_ROOT_TOKEN),
    PLUGIN_ROOT_TOKEN === codemod.BARE_TOKEN,
    'checker and codemod must agree on what "unguarded" means'
  );

  // -------------------------------------------------------------------------
  // Layer 1: textual. Zero bare references across ALL skills, not just the 51.
  //
  // Note the migrated files legitimately contain the string CLAUDE_PLUGIN_ROOT
  // again, nested inside the wrapper as `${CLAUDE_PLUGIN_ROOT:?...}`. That form
  // carries a COLON where the bare token carries a closing brace, so the census
  // token cannot match it and no "was it already migrated" heuristic is needed.
  // -------------------------------------------------------------------------
  check(
    'zero skill bodies carry a bare ' + PLUGIN_ROOT_TOKEN + ' (census count 0)',
    census.count === 0,
    census.count ? 'still bare in: ' + census.files.join(', ') : ''
  );

  // -------------------------------------------------------------------------
  // Layer 2: shape. Every surviving reference is inside the wrapper, and the
  // wrapper leads with MINDRIAN_OS_ROOT.
  // -------------------------------------------------------------------------
  const skillFiles = listSkillFiles();
  const migrated = [];
  const unwrapped = [];
  for (const f of skillFiles) {
    const body = skillBody(fs.readFileSync(f, 'utf8'));
    if (!body.includes('CLAUDE_PLUGIN_ROOT')) continue;
    const rel = path.relative(REPO_ROOT, f);
    // Every shell-expansion occurrence -- `${CLAUDE_PLUGIN_ROOT` with any
    // following operator -- must be immediately preceded by the wrapper opener.
    const occurrences = body.split('${CLAUDE_PLUGIN_ROOT').length - 1;
    const wrapped = body.split('${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?').length - 1;
    if (occurrences === 0) continue;
    if (occurrences !== wrapped) unwrapped.push(rel + ' (' + occurrences + ' refs, ' + wrapped + ' wrapped)');
    else migrated.push(rel);
  }
  check(
    'every ${CLAUDE_PLUGIN_ROOT expansion in every skill body is MINDRIAN_OS_ROOT-first wrapped',
    unwrapped.length === 0,
    unwrapped.length ? 'unwrapped: ' + unwrapped.join(', ') : ''
  );
  check(
    'at least ' + MIN_MIGRATED_FILES + ' skills carry the wrapper (got ' + migrated.length + ')',
    migrated.length >= MIN_MIGRATED_FILES,
    'A tiny number here means the codemod ran against the wrong tree.'
  );
  check(
    'the wrapper leads with MINDRIAN_OS_ROOT, precedence #1 of lib/core/active-plugin-root.cjs',
    codemod.PORTABLE_TOKEN.startsWith('${MINDRIAN_OS_ROOT:-'),
    'got: ' + codemod.PORTABLE_TOKEN.slice(0, 40)
  );
  check(
    'the resolver it defers to is the shipped one, not a new mechanism',
    fs.existsSync(path.join(REPO_ROOT, 'lib', 'core', 'active-plugin-root.cjs')) &&
      fs.readFileSync(path.join(REPO_ROOT, 'lib', 'core', 'active-plugin-root.cjs'), 'utf8')
        .includes('MINDRIAN_OS_ROOT'),
    'lib/core/active-plugin-root.cjs must still honor MINDRIAN_OS_ROOT as precedence #1'
  );
  check(
    'the fail-closed message names the recovery action',
    /MINDRIAN_OS_ROOT/.test(codemod.FAIL_CLOSED_MESSAGE) &&
      /active-plugin-root\.cjs/.test(codemod.FAIL_CLOSED_MESSAGE),
    'got: ' + codemod.FAIL_CLOSED_MESSAGE
  );
  check(
    'no em-dash in the injected wrapper (CLAUDE.md hard rule, 172 injection sites)',
    codemod.PORTABLE_TOKEN.indexOf('—') === -1 && codemod.PORTABLE_TOKEN.indexOf('–') === -1
  );

  // -------------------------------------------------------------------------
  // Layer 3: behavioral. Lift a REAL line off a migrated SKILL.md and run it.
  // -------------------------------------------------------------------------
  const exemplarFile = path.join(REPO_ROOT, 'skills', 'rooms', 'SKILL.md');
  const exemplarLine = skillBody(fs.readFileSync(exemplarFile, 'utf8'))
    .split('\n')
    .find((l) => l.includes('${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?') && /^\s*bash\s/.test(l));
  check(
    'found a real migrated shell-out line in skills/rooms/SKILL.md to probe',
    !!exemplarLine,
    'Without a real line the behavioral layer below would be vacuous.'
  );

  if (exemplarLine) {
    // (a) Foreign host, neither variable set. THE threat case: must fail closed.
    const foreign = probe(exemplarLine, { MINDRIAN_OS_ROOT: null, CLAUDE_PLUGIN_ROOT: null });
    check(
      'foreign host (neither var set): exits NON-ZERO instead of running /scripts/...',
      foreign.status !== 0,
      'status=' + foreign.status + ' stdout=' + JSON.stringify(foreign.stdout.slice(0, 120))
    );
    check(
      'foreign host: prints the actionable fail-closed message on stderr',
      foreign.stderr.includes('MindrianOS install root not found'),
      'stderr=' + JSON.stringify(foreign.stderr.slice(0, 200))
    );
    check(
      'foreign host: never emits an empty-prefixed /scripts path',
      !foreign.stdout.includes(' "/scripts/') && !foreign.stdout.includes(" '/scripts/"),
      'stdout=' + JSON.stringify(foreign.stdout.slice(0, 200))
    );

    // (b) Foreign host WITH the documented escape hatch: must resolve to it.
    const hatched = probe(
      'echo "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?should not be reached}}"',
      { MINDRIAN_OS_ROOT: '/opt/mindrian-os', CLAUDE_PLUGIN_ROOT: null }
    );
    check(
      'foreign host with MINDRIAN_OS_ROOT set: resolves to it, exit 0',
      hatched.status === 0 && hatched.stdout.trim() === '/opt/mindrian-os',
      'status=' + hatched.status + ' stdout=' + JSON.stringify(hatched.stdout)
    );

    // (c) Claude Code today: MINDRIAN_OS_ROOT unset, CLAUDE_PLUGIN_ROOT set.
    // Behavior must be byte-identical to the pre-migration form -- this is the
    // no-regression leg. A wrapper that broke Claude Code would be worse than
    // the vulnerability it closes.
    const claudeCode = probe(
      'echo "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?unreachable}}/scripts/room-registry"',
      { MINDRIAN_OS_ROOT: null, CLAUDE_PLUGIN_ROOT: '/home/u/.claude/plugins/cache/mp/mos/1.15.0' }
    );
    check(
      'Claude Code (CLAUDE_PLUGIN_ROOT only): unchanged resolution, exit 0',
      claudeCode.status === 0 &&
        claudeCode.stdout.trim() === '/home/u/.claude/plugins/cache/mp/mos/1.15.0/scripts/room-registry',
      'status=' + claudeCode.status + ' stdout=' + JSON.stringify(claudeCode.stdout)
    );

    // (d) MINDRIAN_OS_ROOT wins when BOTH are set (documented precedence #1).
    const both = probe(
      'echo "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?unreachable}}"',
      { MINDRIAN_OS_ROOT: '/dev/clone', CLAUDE_PLUGIN_ROOT: '/cache/install' }
    );
    check(
      'both set: MINDRIAN_OS_ROOT wins (precedence #1)',
      both.status === 0 && both.stdout.trim() === '/dev/clone',
      'stdout=' + JSON.stringify(both.stdout)
    );
  }

  // -------------------------------------------------------------------------
  // Layer 4: durability. The mirror generator must EXPECT the wrapped form, or
  // its next write-mode run silently reverts all of this.
  // -------------------------------------------------------------------------
  check(
    'build-skill-mirrors.cjs restates the wrapper byte-identically (no drift)',
    mirrors.PLUGIN_ROOT_PORTABLE_TOKEN === codemod.PORTABLE_TOKEN &&
      mirrors.PLUGIN_ROOT_BARE_TOKEN === codemod.BARE_TOKEN,
    'generator=' + JSON.stringify(mirrors.PLUGIN_ROOT_PORTABLE_TOKEN) +
      ' codemod=' + JSON.stringify(codemod.PORTABLE_TOKEN)
  );

  const reverted = [];
  for (const rel of migrated) {
    const name = rel.split('/')[1];
    const cmdFile = path.join(COMMANDS_DIR, name + '.md');
    if (!fs.existsSync(cmdFile)) continue; // hand-authored skill, not a mirror
    const src = fs.readFileSync(cmdFile);
    const cur = fs.readFileSync(path.join(REPO_ROOT, rel));
    const { buffer: expected } = mirrors.computeExpectedMirror(src, name, cur);
    if (!cur.equals(expected)) reverted.push(rel);
  }
  check(
    'every migrated mirror equals build-skill-mirrors EXPECTED content (write mode is a no-op)',
    reverted.length === 0,
    reverted.length
      ? 'a write-mode run would REVERT: ' + reverted.join(', ') +
        ' -- recovery: teach scripts/build-skill-mirrors.cjs EXCEPTION CLASS 3'
      : ''
  );

  // -------------------------------------------------------------------------
  // Scope: commands/ deliberately untouched (T-234-12, accept). Asserted, so a
  // future over-eager codemod trips a test rather than mutating the read-only
  // source of truth for build-command-registry.cjs.
  // -------------------------------------------------------------------------
  const commandsWithBare = fs
    .readdirSync(COMMANDS_DIR)
    .filter((f) => f.endsWith('.md'))
    .filter((f) => fs.readFileSync(path.join(COMMANDS_DIR, f), 'utf8').includes(PLUGIN_ROOT_TOKEN));
  check(
    'commands/*.md still carries its bare references (out of scope by construction, ' +
      commandsWithBare.length + ' files)',
    commandsWithBare.length > 0,
    'commands/ is never loaded by an Agent-Skills host, and is the read-only ' +
      'source of truth for build-command-registry.cjs. Migrating it is scope creep ' +
      'with zero Tier-0 security benefit.'
  );

  process.stdout.write('\n  ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed === 0 ? 0 : 1);
})();
