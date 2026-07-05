#!/usr/bin/env node
'use strict';

/*
 * build-skill-mirrors.cjs - mirror every commands/<name>.md into
 * skills/<name>/SKILL.md, byte-for-byte EXCEPT one documented field
 * exception (see DESENSITIZE below).
 *
 * WHY THIS EXISTS (the Windows commands-registration host bug):
 *   On a confirmed-affected Windows machine, this plugin's commands/*.md fail to
 *   register with Claude Code, while skills/ from the SAME plugin load fine. This
 *   is a host-side Claude Code bug, independently confirmed via a control test
 *   against an unrelated marketplace plugin. The fix is to ALSO expose every
 *   command through the skills/ loading path, so /mos:<name> stays reachable on
 *   the affected machine. Pilot commit ee2fefac proved the byte-identical mirror
 *   mechanic end-to-end for commands/help.md; this generator scales it to all of
 *   them.
 *
 * WHY commands/ STAYS THE SINGLE SOURCE OF TRUTH (read-only here):
 *   data/command-registry.json (build-command-registry.cjs), the render-coverage
 *   md keyspace (build-render-coverage.cjs), and the help-coverage checker
 *   (check-help-coverage.cjs) all read commands/*.md SPECIFICALLY. So commands/
 *   is never touched, translated, annotated, or rewritten here.
 *
 * DESENSITIZE EXCEPTION (single field, precedented, CONN-03-driven):
 *   scripts/build-connector-registry.cjs walks BOTH commands/*.md and every
 *   skills/<name>/SKILL.md, and its validateConnectors() enforces a duplicate-tuple
 *   check across (sensor, reach_id, sub_mode), exploded per sensor in
 *   connector.sensor_triggers (CONN-03). A pure byte-identical mirror of a
 *   command with connects_to_spine:true and a NON-EMPTY sensor_triggers
 *   duplicates that command's tuple into the registry a second time under the
 *   `skill:<name>` surface, which the gate correctly flags as a collision - the
 *   mirror is the SAME governed reach, not a second, independent wiring.
 *
 *   This repo already has a precedent for exactly this shape: the pre-existing,
 *   hand-authored skills/trending-to-absurd/SKILL.md (phase 163, NOT part of
 *   this generator's scope - it is skip-listed) declares
 *   connects_to_spine:true identically to its command, but sensor_triggers:[]
 *   - so it is classified WIRED but never re-enters the sensor-indexed tuple
 *   check (validateConnectors()'s `for (const sid of sensors)` loop is a no-op
 *   on an empty array).
 *
 *   So: when a mirrored command has connector.connects_to_spine:true AND a
 *   non-empty connector.sensor_triggers, the generated skills/<name>/SKILL.md
 *   has ONLY that one field rewritten to `sensor_triggers: []` - every other
 *   line, field, and the rest of the connector block (reach_id, sub_mode,
 *   framework, posture, hierarchy_rank, filing, plan_gated, web_scope, etc.)
 *   stays byte-identical. This is a narrow, single-field, precedented
 *   exception - NOT a reopening of "byte-identical is the whole contract."
 *   Commands with connects_to_spine:false / excluded:true (e.g. help.md), or
 *   whose sensor_triggers is already [], are completely unaffected: pure byte
 *   copy, zero bytes changed.
 *
 * CONVENTIONS (per CLAUDE.md): CJS only, no TypeScript, no Commander/yargs, no
 * new npm dependencies (fs/path only). process.argv parsed with the
 * switch/includes pattern used by build-connector-registry.cjs. Default run =
 * write mode; --check = compare-only, exit non-zero on any missing or divergent
 * mirror (divergence measured against the EXPECTED mirror content - source
 * bytes, or source bytes with sensor_triggers desensitized per the exception
 * above - never against a stale pre-exception expectation).
 *
 * Usage:
 *   node scripts/build-skill-mirrors.cjs
 *       WRITE mode: enumerate commands/*.md sorted; for each non-skip-listed
 *       name, mkdir -p skills/<name>/ and write skills/<name>/SKILL.md as the
 *       EXPECTED content (pure byte copy, or the single-field desensitized
 *       copy). Prints a summary (created/unchanged/overwritten/skipped, plus
 *       how many mirrors got the sensor_triggers:[] treatment vs pure copy).
 *       Exit 0.
 *   node scripts/build-skill-mirrors.cjs --check
 *       COMPARE-ONLY: fail (exit non-zero) if any non-skip-listed mirror is
 *       missing or differs from its EXPECTED content. Never writes anything.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const COMMANDS_DIR = path.join(REPO_ROOT, 'commands');
const SKILLS_DIR = path.join(REPO_ROOT, 'skills');

// SKIP_LIST: names the generator must NEVER touch.
//   trending-to-absurd - skills/trending-to-absurd/SKILL.md is a pre-existing,
//   hand-authored phase-163 skill (the auto-invocable Visionary Innovation
//   Companion) that DIVERGES from commands/trending-to-absurd.md by design.
//   Overwriting it would destroy a shipped surface. This is safe for the Windows
//   goal: per the pilot's verified docs facts, a skill shadows the same-named
//   command, so /mos:trending-to-absurd is ALREADY served by the existing skill
//   on every machine - including the affected Windows box, where skills/ load
//   fine. So it is covered without a mirror. It is also this repo's precedent
//   for the DESENSITIZE exception below (its own sensor_triggers is already []).
const SKIP_LIST = ['trending-to-absurd'];

// Enumerate commands/*.md basenames (strip .md), sorted deterministically.
function commandNames() {
  return fs
    .readdirSync(COMMANDS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.slice(0, -'.md'.length))
    .sort();
}

function mirrorPath(name) {
  return path.join(SKILLS_DIR, name, 'SKILL.md');
}

// Locate the frontmatter block: line 0 must be '---', and the block runs
// through the next line that is exactly '---'. Returns { lines, fmEnd } where
// lines[1..fmEnd-1] is the frontmatter body and lines[fmEnd] is the closing
// fence, or null if the file has no frontmatter fence pair.
function frontmatterBounds(text) {
  const lines = text.split('\n');
  if (lines[0] !== '---') return null;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') return { lines, fmEnd: i };
  }
  return null;
}

// Given the raw source Buffer for a command file, compute the EXPECTED mirror
// content. Returns { buffer, desensitized } where desensitized is true only
// when the single sensor_triggers field was rewritten to [].
function computeExpectedMirror(srcBuf) {
  const text = srcBuf.toString('utf8');
  const bounds = frontmatterBounds(text);
  if (!bounds) return { buffer: srcBuf, desensitized: false };

  const { lines, fmEnd } = bounds;
  let connectsToSpine = false;
  let sensorTriggersLineIdx = -1;
  let sensorTriggersIsEmpty = true;

  for (let i = 1; i < fmEnd; i++) {
    if (/^\s*connects_to_spine:\s*true\s*$/.test(lines[i])) {
      connectsToSpine = true;
    }
    const m = lines[i].match(/^(\s*sensor_triggers:\s*)(\[[^\]]*\])\s*$/);
    if (m) {
      sensorTriggersLineIdx = i;
      sensorTriggersIsEmpty = m[2] === '[]';
    }
  }

  if (!connectsToSpine || sensorTriggersLineIdx === -1 || sensorTriggersIsEmpty) {
    // No exception applies: pure byte copy, no string round-trip.
    return { buffer: srcBuf, desensitized: false };
  }

  // Rewrite ONLY that one line's array to []; every other line untouched.
  const m = lines[sensorTriggersLineIdx].match(/^(\s*sensor_triggers:\s*)\[[^\]]*\]\s*$/);
  lines[sensorTriggersLineIdx] = m[1] + '[]';
  const newText = lines.join('\n');
  return { buffer: Buffer.from(newText, 'utf8'), desensitized: true };
}

function writeMirrors() {
  let created = 0;
  let unchanged = 0;
  let overwritten = 0;
  let skipped = 0;
  let desensitizedCount = 0;
  let pureCopyCount = 0;

  for (const name of commandNames()) {
    if (SKIP_LIST.includes(name)) {
      skipped++;
      continue;
    }
    const src = fs.readFileSync(path.join(COMMANDS_DIR, name + '.md'));
    const { buffer: expected, desensitized } = computeExpectedMirror(src);
    if (desensitized) desensitizedCount++;
    else pureCopyCount++;

    const dst = mirrorPath(name);
    if (fs.existsSync(dst)) {
      const cur = fs.readFileSync(dst);
      if (cur.equals(expected)) {
        unchanged++;
        continue;
      }
      // Target existed and differed from EXPECTED content. Allowed
      // regeneration semantics (e.g. the generator's own logic changed, as it
      // did when the sensor_triggers desensitize exception was introduced).
      fs.writeFileSync(dst, expected);
      overwritten++;
      continue;
    }
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, expected);
    created++;
  }

  console.log(
    'build-skill-mirrors: created ' +
      created +
      ', unchanged ' +
      unchanged +
      ', overwritten ' +
      overwritten +
      ', skipped ' +
      skipped +
      ' (skip-list: ' +
      SKIP_LIST.join(', ') +
      ') | sensor_triggers:[] desensitized ' +
      desensitizedCount +
      ', pure byte copy ' +
      pureCopyCount
  );
  return { created, unchanged, overwritten, skipped, desensitizedCount, pureCopyCount };
}

// Verify every SKIP_LIST name is still a genuine hand-authored skill, not a
// silently-deleted or flattened one. The generator never writes skip-listed
// names, so nothing else guards them; a skip-listed skill that vanishes or is
// reverted to a plain copy of its command would strand the affected surface
// (trending-to-absurd is the auto-invocable Visionary Innovation Companion).
// For each name it enforces BOTH:
//   (a) skillsDir/name/SKILL.md exists on disk, and
//   (b) its bytes are NOT identical to commandsDir/name.md (raw source bytes,
//       a plain Buffer.equals compare, no desensitize transform) - the skill
//       must stay genuinely divergent from its command.
// If the source command file itself is missing, condition (b) passes (there is
// nothing to be a copy of) but (a) is still enforced. Empty array = healthy.
// Canon Part 8: local byte compares only, zero Brain calls.
function checkSkipList(opts) {
  const skipList = (opts && opts.skipList) || SKIP_LIST;
  const commandsDir = (opts && opts.commandsDir) || COMMANDS_DIR;
  const skillsDir = (opts && opts.skillsDir) || SKILLS_DIR;
  const failures = [];
  for (const name of skipList) {
    const skillFile = path.join(skillsDir, name, 'SKILL.md');
    if (!fs.existsSync(skillFile)) {
      failures.push(name + ' (SKIP-LIST MISSING: hand-authored skill deleted)');
      continue;
    }
    const cmdFile = path.join(commandsDir, name + '.md');
    if (!fs.existsSync(cmdFile)) {
      // No source command to be a copy of: (b) passes, (a) already satisfied.
      continue;
    }
    const skillBuf = fs.readFileSync(skillFile);
    const cmdBuf = fs.readFileSync(cmdFile);
    if (skillBuf.equals(cmdBuf)) {
      failures.push(name + ' (SKIP-LIST NOT DIVERGENT: reverted to a plain copy of its command)');
    }
  }
  return failures;
}

function checkMirrors() {
  const failing = [];
  let ok = 0;
  for (const name of commandNames()) {
    if (SKIP_LIST.includes(name)) continue;
    const src = fs.readFileSync(path.join(COMMANDS_DIR, name + '.md'));
    const { buffer: expected } = computeExpectedMirror(src);
    const dst = mirrorPath(name);
    if (!fs.existsSync(dst)) {
      failing.push(name + ' (MISSING)');
      continue;
    }
    if (!fs.readFileSync(dst).equals(expected)) {
      failing.push(name + ' (DIVERGES)');
      continue;
    }
    ok++;
  }

  // Append SKIP_LIST verification failures to the SAME failing array so --check
  // exits 1 on either a stale/missing mirror OR a broken skip-listed skill.
  const skipFailures = checkSkipList();
  const mirrorFailureCount = failing.length;
  for (const f of skipFailures) failing.push(f);

  if (failing.length) {
    console.error(
      'build-skill-mirrors --check: ' +
        failing.length +
        ' mirror(s) missing or stale:'
    );
    for (const f of failing) console.error('  ' + f);
    if (mirrorFailureCount > 0) {
      console.error(
        'Recovery: node scripts/build-skill-mirrors.cjs'
      );
    }
    if (skipFailures.length > 0) {
      console.error(
        'Recovery for SKIP-LIST failures: restore the hand-authored skills/<name>/SKILL.md from git history (the generator never writes skip-listed names)'
      );
    }
    return { ok, failing };
  }
  console.log(
    'build-skill-mirrors --check: OK (' +
      ok +
      ' mirrors match expected content; skip-list verified: ' +
      SKIP_LIST.join(', ') +
      ')'
  );
  return { ok, failing };
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--check')) {
    const { failing } = checkMirrors();
    process.exit(failing.length ? 1 : 0);
  }
  writeMirrors();
  process.exit(0);
}

module.exports = { SKIP_LIST, computeExpectedMirror, checkMirrors, checkSkipList };

if (require.main === module) main();
