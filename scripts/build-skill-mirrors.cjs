#!/usr/bin/env node
'use strict';

/*
 * build-skill-mirrors.cjs - mirror every commands/<name>.md into
 * skills/<name>/SKILL.md, byte-for-byte EXCEPT the documented exception
 * classes below (DESENSITIZE, SKILL-SPEC NORMALIZATION).
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
 * EXCEPTION CLASS 1 - DESENSITIZE (single field, precedented, CONN-03-driven):
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
 * EXCEPTION CLASS 2 - SKILL-SPEC NORMALIZATION (phase 234-03/234-04):
 *   A commands/*.md file answers to Claude Code's slash-command frontmatter. A
 *   skills/<name>/SKILL.md ALSO has to answer to the external Agent Skills spec
 *   (agentskills.io), which the mirror is the whole point of: the mirror is what
 *   a foreign host loads. Those two contracts genuinely differ, and phase 234-03
 *   closed the gap on the SKILL side with scripts/migrate-skill-frontmatter.cjs:
 *
 *     1. `name:`           present and equal to the parent directory name.
 *     2. `allowed-tools:`  a STRING, never a YAML sequence (the spec's type rule).
 *     3. `license:`        the BSL-1.1 line, so the license is legible to a host
 *                          that only ever sees the SKILL.md and never LICENSE.
 *     4. `compatibility:`  on the skills whose bodies lean on Claude-Code-only
 *                          mechanics (disable-model-invocation, Tier-1 hooks).
 *
 *   That migration edited every skills/<name>/SKILL.md without teaching this about
 *   it, so `--check` reported 111 stale mirrors and a WRITE-mode run would have
 *   silently REVERTED the whole spec migration. The fix is not to push skill-layer
 *   metadata back onto commands/ (that would break the read-only invariant above,
 *   and build-command-registry.cjs reads `fm.name` from commands/*.md, so a `name:`
 *   insert there is NOT inert). The fix is this: the normalization is part of the
 *   EXPECTED mirror content, on equal footing with the DESENSITIZE exception. The
 *   mirror contract is now "byte-identical to the command EXCEPT the enumerated,
 *   deterministic transformations below", and `--check` measures against that.
 *
 *   Like 234-03's codemod, this is line-level splice surgery, NOT a YAML
 *   round-trip. A re-serialize through js-yaml drops every hand-written
 *   frontmatter comment, and this tree has load-bearing ones - commands/rs-experts
 *   and commands/rs-thesis record a Canon Part 8 Brain-egress prohibition in
 *   comments sitting INSIDE the allowed-tools block being rewritten.
 *
 * EXCEPTION CLASS 2b - NAME OVERRIDE + PRESERVED ANNOTATION:
 *   The spec requires `name` == parent directory. Exactly one command's frontmatter
 *   `name:` deliberately differs from its filename: commands/value-proposition.md
 *   carries `name: validate-proposition` (RETRO-05, audit item 39), because the
 *   Phase-122 framework resolver keys off it. The command keeps that name; the
 *   MIRROR's `name:` is overridden to the directory name so the mirror satisfies
 *   the external spec, while /mos:validate-proposition keeps resolving from
 *   commands/. Because that override is a reviewed divergence and not a mechanical
 *   one, the mirror is also allowed to carry a contiguous run of `#` comment lines
 *   immediately above its `name:` line, beyond whatever run the source already
 *   has, explaining the override. Those extra lines are PRESERVED verbatim from
 *   the mirror on disk - never generated here, never deleted by a write-mode run.
 *   Comments are non-semantic, so preserving them cannot change what a host loads,
 *   and it is what keeps write mode from destroying a written reason.
 *
 * EXCEPTION CLASS 3 - PLUGIN-ROOT PORTABILITY (phase 234-06, threat T-234-11):
 *   The BODY transformation, and the first exception class that is not about
 *   frontmatter. A command body shell-outs via "${CLAUDE_PLUGIN_ROOT}/scripts/x".
 *   That variable is set by Claude Code and by NOTHING else, so in the MIRROR -
 *   the artifact a foreign Agent-Skills host actually loads - it expands to the
 *   empty string and the instruction silently becomes `bash "/scripts/x"`: an
 *   absolute path at the filesystem root, which an attacker can plant a file at.
 *   RESEARCH.md's Security Domain names that silent misresolution as the phase's
 *   Tampering finding.
 *
 *   So the EXPECTED mirror body wraps every bare `${CLAUDE_PLUGIN_ROOT}` in
 *   `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?<message>}}` - plain POSIX nested
 *   parameter expansion (verified evaluable on bash and dash). MINDRIAN_OS_ROOT
 *   is precedence #1 of the existing documented resolver
 *   lib/core/active-plugin-root.cjs, so this REUSES the shipped escape hatch
 *   rather than inventing a second one. On Claude Code the runtime behavior is
 *   byte-identical to before; when NEITHER variable is set the shell aborts with
 *   a clear message and a non-zero exit instead of running against `/scripts/x`.
 *   Fail closed, not silent.
 *
 *   commands/ is deliberately NOT transformed (threat T-234-12, disposition
 *   accept): no Agent-Skills host loads a commands/ directory at all, so the
 *   reference is unreachable there by construction, and commands/ is the
 *   read-only source of truth this generator must not touch.
 *
 *   The transformation is idempotent by construction - the replacement contains
 *   `${CLAUDE_PLUGIN_ROOT:?...}` (a COLON, not a closing brace, after the name),
 *   so the bare token `${CLAUDE_PLUGIN_ROOT}` never survives in the output and a
 *   second pass is a no-op. That is what lets `--check` and the write path use
 *   the same function without double-wrapping.
 *
 *   Same duplication rationale as EXCEPTION CLASS 2: the authoring codemod is
 *   scripts/migrate-plugin-root-refs.cjs, but this gate stays fs/path-only, so
 *   the constant is restated here rather than imported. Drift between the two
 *   copies is not left to vigilance - tests/test-234-plugin-root-migrated.cjs
 *   asserts the two strings are byte-identical.
 *
 * CONVENTIONS (per CLAUDE.md): CJS only, no TypeScript, no Commander/yargs, no
 * new npm dependencies (fs/path only). process.argv parsed with the
 * switch/includes pattern used by build-connector-registry.cjs. Default run =
 * write mode; --check = compare-only, exit non-zero on any missing or divergent
 * mirror (divergence measured against the EXPECTED mirror content - source bytes
 * with the sensor_triggers desensitize and the skill-spec normalization applied
 * per the exception classes above - never against a stale pre-exception
 * expectation).
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

// ---------------------------------------------------------------------------
// EXCEPTION CLASS 2 - skill-spec normalization (see the header).
//
// These four constants and the helper set below are a deliberate, verbatim
// restatement of scripts/migrate-skill-frontmatter.cjs's one-time codemod, so
// the generator's notion of EXPECTED matches the bytes that codemod produced.
// They are duplicated rather than imported because that codemod is a one-time
// migration tool that requires gray-matter, and this generator is a release-gate
// dependency that stays on fs/path only (it runs from pre-commit, verify-release
// and doctor, where a missing node_modules must not take the gate down).
// ---------------------------------------------------------------------------

const LICENSE_LINE =
  'license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, ' +
  'Change Date 2030-04-16 to Apache License 2.0).';

const COMPAT_DISABLE_MODEL_INVOCATION =
  'compatibility: Requires Claude Code (or a host implementing ' +
  'disable-model-invocation semantics); Tier-1 hook mechanics referenced in this skill.';

const COMPAT_HOOK_REFERENCING =
  'compatibility: References Tier-1 hook mechanics (Claude Code, Grok Build, or ' +
  'OpenCode via the SEED-063 plugin); degrades to prose guidance on Tier-0 hosts.';

// Body tokens that mean "this skill leans on Tier-1 hook mechanics".
const HOOK_TOKENS_CASE_SENSITIVE = ['Stop gate', 'contradiction push'];
const HOOK_TOKEN_FILE_RE = /hooks\.json/i;

// Index of the closing '---' fence, or -1. Recomputed after every splice, since
// each insertion moves the fence down.
function frontmatterEnd(lines) {
  if (lines[0] !== '---') return -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') return i;
  }
  return -1;
}

// Inside a frontmatter block, a line starting at COLUMN 0 begins a new top-level
// construct; anything indented or blank continues the construct above it. That
// single rule is what lets a multi-line value be found and replaced without
// hand-parsing YAML.
function findTopLevelKey(lines, fmEnd, key) {
  const re = new RegExp('^' + key.replace(/-/g, '\\-') + '\\s*:');
  for (let i = 1; i < fmEnd; i++) {
    if (re.test(lines[i])) return i;
  }
  return -1;
}

function constructEnd(lines, fmEnd, keyIdx) {
  for (let i = keyIdx + 1; i < fmEnd; i++) {
    if (/^\S/.test(lines[i])) return i;
  }
  return fmEnd;
}

function isCommentLine(line) {
  return line.trimStart().startsWith('#');
}

function unquoteScalar(s) {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

// The spec's form is SPACE-separated, and that is what all but one skill gets.
// But a space separator can only encode tool names that contain no space, and
// Claude Code's scoped-permission syntax produces exactly such names:
// commands/status.md grants `Bash(node scripts/mos-status.cjs:*)`, narrowing Bash
// to one script. Space-joining that would re-read as three broad tokens, silently
// widening a deliberately narrow grant - a permission-scope regression, not a
// formatting nit. Comma-space is lossless there, is already the shipping form in
// other files, and is still a STRING, which is what the spec's type rule requires.
function toolSeparator(tools) {
  return tools.some((t) => String(t).includes(' ')) ? ', ' : ' ';
}

function yamlScalar(value) {
  const s = String(value);
  if (s === '') return '""';
  const safe =
    /^[A-Za-z0-9_]/.test(s) && !s.includes(': ') && !s.includes(' #') && !/[:#]$/.test(s);
  return safe ? s : JSON.stringify(s);
}

// Read an `allowed-tools:` value that is a YAML SEQUENCE, in either the block
// form (key line empty, indented `- item` lines beneath) or the flow form
// (`[A, B]` / `[]`). Returns null when the value is already a string, which is
// already spec-conformant and must survive byte-identical.
function readToolSequence(lines, fmEnd, keyIdx) {
  const inline = lines[keyIdx].replace(/^allowed-tools\s*:\s*/, '').trim();

  if (inline === '') {
    const endIdx = constructEnd(lines, fmEnd, keyIdx);
    const block = lines.slice(keyIdx + 1, endIdx);
    if (!block.some((l) => /^\s*-\s/.test(l))) return null;
    return {
      items: block.filter((l) => /^\s*-\s/.test(l)).map((l) => unquoteScalar(l.replace(/^\s*-\s*/, ''))),
      // rs-experts and rs-thesis record a Canon Part 8 prohibition in comments
      // INSIDE this block. They are re-emitted verbatim under the new one-liner.
      preserved: block.filter(isCommentLine),
      endIdx,
    };
  }

  if (inline.startsWith('[') && inline.endsWith(']')) {
    const inner = inline.slice(1, -1).trim();
    return {
      items: inner === '' ? [] : inner.split(',').map(unquoteScalar),
      preserved: [],
      endIdx: keyIdx + 1,
    };
  }

  return null;
}

// Apply the skill-spec normalization in place on `lines`. `name` is the mirror's
// directory name (== the command filename base). `currentLines` is the mirror as
// it exists on disk, or null; it is consulted ONLY for the preserved-annotation
// rule of exception class 2b. Returns true when any line changed.
function applySkillSpecNormalization(lines, name, currentLines) {
  let fmEnd = frontmatterEnd(lines);
  if (fmEnd < 0) return false;
  let changed = false;

  // -- 1. name == parent directory -----------------------------------------
  const nameIdx = findTopLevelKey(lines, fmEnd, 'name');
  if (nameIdx === -1) {
    lines.splice(1, 0, 'name: ' + name);
    fmEnd = frontmatterEnd(lines);
    changed = true;
  } else if (unquoteScalar(lines[nameIdx].replace(/^name\s*:\s*/, '')) !== name) {
    // Exception class 2b. Carry over any comment run the mirror added above its
    // name: line beyond the run the source already carries.
    let srcRun = 0;
    for (let i = nameIdx - 1; i >= 1 && isCommentLine(lines[i]); i--) srcRun++;
    const srcBlock = lines.slice(nameIdx - srcRun, nameIdx);
    let annotation = [];
    if (currentLines) {
      const curFmEnd = frontmatterEnd(currentLines);
      const curNameIdx = curFmEnd > 0 ? findTopLevelKey(currentLines, curFmEnd, 'name') : -1;
      if (curNameIdx > 0) {
        const curRun = [];
        for (let i = curNameIdx - 1; i >= 1 && isCommentLine(currentLines[i]); i--) {
          curRun.unshift(currentLines[i]);
        }
        // Only accept it as an ANNOTATION when the source's own run is an exact
        // prefix of it. Anything else is real drift, not a mirror-layer note.
        if (
          curRun.length > srcRun &&
          JSON.stringify(curRun.slice(0, srcRun)) === JSON.stringify(srcBlock)
        ) {
          annotation = curRun.slice(srcRun);
        }
      }
    }
    lines.splice(nameIdx, 1, ...annotation, 'name: ' + name);
    fmEnd = frontmatterEnd(lines);
    changed = true;
  }

  // -- 2. allowed-tools sequence -> spec-required string --------------------
  const atIdx = findTopLevelKey(lines, fmEnd, 'allowed-tools');
  if (atIdx !== -1) {
    const seq = readToolSequence(lines, fmEnd, atIdx);
    if (seq) {
      const joined = seq.items.join(toolSeparator(seq.items));
      const replacement = ['allowed-tools: ' + yamlScalar(joined)].concat(seq.preserved);
      lines.splice(atIdx, seq.endIdx - atIdx, ...replacement);
      fmEnd = frontmatterEnd(lines);
      changed = true;
    }
  }

  // -- 3/4. license, then compatibility right beneath it --------------------
  if (findTopLevelKey(lines, fmEnd, 'license') === -1) {
    const descIdx = findTopLevelKey(lines, fmEnd, 'description');
    if (descIdx !== -1) {
      const insertAt = constructEnd(lines, fmEnd, descIdx);
      lines.splice(insertAt, 0, LICENSE_LINE);
      fmEnd = frontmatterEnd(lines);
      changed = true;

      if (findTopLevelKey(lines, fmEnd, 'compatibility') === -1) {
        // Structural, not a hardcoded name list: the frontmatter key IS the
        // Claude-Code-only mechanic being declared (its VALUE is irrelevant;
        // declaring it at all is what binds the skill to the host).
        const declaresDmi = findTopLevelKey(lines, fmEnd, 'disable-model-invocation') !== -1;
        const body = lines.slice(fmEnd + 1).join('\n');
        const bodyRefsHooks =
          HOOK_TOKENS_CASE_SENSITIVE.some((t) => body.includes(t)) || HOOK_TOKEN_FILE_RE.test(body);
        if (declaresDmi) {
          lines.splice(insertAt + 1, 0, COMPAT_DISABLE_MODEL_INVOCATION);
          fmEnd = frontmatterEnd(lines);
        } else if (bodyRefsHooks) {
          lines.splice(insertAt + 1, 0, COMPAT_HOOK_REFERENCING);
          fmEnd = frontmatterEnd(lines);
        }
      }
    }
  }

  return changed;
}

// ---------------------------------------------------------------------------
// EXCEPTION CLASS 3 - plugin-root portability (see the header).
//
// Restated verbatim from scripts/migrate-plugin-root-refs.cjs so this gate keeps
// its fs/path-only dependency surface. tests/test-234-plugin-root-migrated.cjs
// asserts the two copies stay byte-identical.
// ---------------------------------------------------------------------------

const PLUGIN_ROOT_BARE_TOKEN = '${CLAUDE_PLUGIN_ROOT}';

const PLUGIN_ROOT_PORTABLE_TOKEN =
  '${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. ' +
  'Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}';

// BODY lines only (everything after the closing frontmatter fence), matching the
// scope of check-skill-spec.cjs's pluginRootCensus(). `fmEnd` must be the fence
// index AFTER any frontmatter splices above, since each insertion moves it down.
function applyPluginRootPortability(lines, fmEnd) {
  let changed = false;
  for (let i = fmEnd + 1; i < lines.length; i++) {
    if (!lines[i].includes(PLUGIN_ROOT_BARE_TOKEN)) continue;
    lines[i] = lines[i].split(PLUGIN_ROOT_BARE_TOKEN).join(PLUGIN_ROOT_PORTABLE_TOKEN);
    changed = true;
  }
  return changed;
}

// Given the raw source Buffer for a command file, compute the EXPECTED mirror
// content. `name` is the mirror's directory name; `currentBuf` is the mirror on
// disk (or null) and is read ONLY for the preserved-annotation rule.
// Returns { buffer, desensitized, normalized, portable } where desensitized is
// true only when the single sensor_triggers field was rewritten to [], normalized
// is true when any skill-spec transformation applied, and portable is true when
// at least one body ${CLAUDE_PLUGIN_ROOT} got the fail-closed wrapper.
function computeExpectedMirror(srcBuf, name, currentBuf) {
  const text = srcBuf.toString('utf8');
  const bounds = frontmatterBounds(text);
  if (!bounds) return { buffer: srcBuf, desensitized: false, normalized: false, portable: false };

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

  let desensitized = false;
  if (connectsToSpine && sensorTriggersLineIdx !== -1 && !sensorTriggersIsEmpty) {
    // Rewrite ONLY that one line's array to []; every other line untouched.
    const m = lines[sensorTriggersLineIdx].match(/^(\s*sensor_triggers:\s*)\[[^\]]*\]\s*$/);
    lines[sensorTriggersLineIdx] = m[1] + '[]';
    desensitized = true;
  }

  const normalized = name
    ? applySkillSpecNormalization(lines, name, currentBuf ? currentBuf.toString('utf8').split('\n') : null)
    : false;

  // EXCEPTION CLASS 3 runs LAST, and recomputes the fence index because every
  // normalization splice above shifts it down.
  const portable = applyPluginRootPortability(lines, frontmatterEnd(lines));

  if (!desensitized && !normalized && !portable) {
    // Nothing applied: pure byte copy, no string round-trip.
    return { buffer: srcBuf, desensitized: false, normalized: false, portable: false };
  }
  return { buffer: Buffer.from(lines.join('\n'), 'utf8'), desensitized, normalized, portable };
}

function writeMirrors() {
  let created = 0;
  let unchanged = 0;
  let overwritten = 0;
  let skipped = 0;
  let desensitizedCount = 0;
  let normalizedCount = 0;
  let portableCount = 0;
  let pureCopyCount = 0;

  for (const name of commandNames()) {
    if (SKIP_LIST.includes(name)) {
      skipped++;
      continue;
    }
    const src = fs.readFileSync(path.join(COMMANDS_DIR, name + '.md'));
    const dst = mirrorPath(name);
    const cur = fs.existsSync(dst) ? fs.readFileSync(dst) : null;
    const { buffer: expected, desensitized, normalized, portable } = computeExpectedMirror(src, name, cur);
    if (desensitized) desensitizedCount++;
    if (normalized) normalizedCount++;
    if (portable) portableCount++;
    if (!desensitized && !normalized && !portable) pureCopyCount++;

    if (cur) {
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
      ', skill-spec normalized ' +
      normalizedCount +
      ', plugin-root portable ' +
      portableCount +
      ', pure byte copy ' +
      pureCopyCount
  );
  return {
    created,
    unchanged,
    overwritten,
    skipped,
    desensitizedCount,
    normalizedCount,
    portableCount,
    pureCopyCount,
  };
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
    const dst = mirrorPath(name);
    if (!fs.existsSync(dst)) {
      failing.push(name + ' (MISSING)');
      continue;
    }
    const cur = fs.readFileSync(dst);
    const { buffer: expected } = computeExpectedMirror(src, name, cur);
    if (!cur.equals(expected)) {
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

module.exports = {
  SKIP_LIST,
  computeExpectedMirror,
  applySkillSpecNormalization,
  checkMirrors,
  checkSkipList,
  applyPluginRootPortability,
  LICENSE_LINE,
  COMPAT_DISABLE_MODEL_INVOCATION,
  COMPAT_HOOK_REFERENCING,
  PLUGIN_ROOT_BARE_TOKEN,
  PLUGIN_ROOT_PORTABLE_TOKEN,
};

if (require.main === module) main();
