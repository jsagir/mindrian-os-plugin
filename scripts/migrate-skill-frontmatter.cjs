#!/usr/bin/env node
'use strict';

/*
 * Phase 234-03 (D-01 / D-02 / D-07 / D-08) - ONE-TIME codemod that brings the
 * shipped skill catalog onto the Agent Skills spec (agentskills.io).
 *
 * WHAT IT DOES, per skills/<dir>/SKILL.md:
 *   1. `name:`           inserted as the first frontmatter key when absent, set
 *                        to the parent directory name (the spec's == dirname rule).
 *   2. `allowed-tools:`  a YAML sequence (block or flow form) is normalized to
 *                        the spec-required space-separated STRING. A value that is
 *                        ALREADY a string is left byte-identical (it already
 *                        satisfies the spec's type rule). See toolSeparator() for
 *                        the one case that cannot use a space separator losslessly.
 *   3. `license:`        added right after the description block, so BSL-1.1 is
 *                        legible at the skill level on a foreign host that only
 *                        ever sees the SKILL.md and never the repo LICENSE file.
 *   4. `compatibility:`  added to the skills whose BODIES depend on Claude-Code-only
 *                        mechanics (the disable-model-invocation set, plus any skill
 *                        whose body references Tier-1 hook mechanics).
 *
 * WHY TARGETED TEXT EDITS AND NOT gray-matter's stringify(). `matter.stringify()`
 * re-serializes from the parsed JS object through js-yaml, which silently DROPS
 * every hand-written YAML comment. This tree is full of load-bearing ones:
 * `skills/larry-personality/SKILL.md` records its Canon Part 11 CIRS exclusion in a
 * comment, and `skills/rs-experts` + `skills/rs-thesis` record a Canon Part 8
 * Brain-egress prohibition in comments sitting INSIDE the allowed-tools block
 * itself. A naive round-trip would delete the written reason a future maintainer
 * needs to not re-add `mcp__mindrian-brain__read_neo4j_cypher`. The only in-repo
 * precedent for matter.stringify() write-back (scripts/skillopt-triggerloop.cjs
 * lines 440-448) operates on a disposable SCRATCH COPY, never the canonical tree,
 * which is exactly why it is not the pattern here.
 *
 * So: gray-matter is used READ-ONLY (to get the authoritative parsed values and to
 * self-verify the result), and every WRITE is a line-level splice that touches only
 * the lines being changed. Comment lines found inside a rewritten allowed-tools
 * block are re-emitted verbatim underneath the new single-line form.
 *
 * SCOPE. skills/<dir>/SKILL.md, EXCLUDING `MOSDeckEngine` and `value-proposition`.
 * Those two are not mechanical fixes (a directory rename with live callers, and an
 * intentional name/dirname mismatch with two live consumers) and are owned by plan
 * 234-04 as a decision task. The exclusion is an explicit list here, never an
 * accident of iteration order.
 *
 * SELF-VERIFICATION. After each write the file is re-parsed and compared against
 * the pre-edit parse: every pre-existing key must survive with a deep-equal value
 * (allowed-tools compared token-wise, since array -> string is the intended
 * change), the frontmatter comment-line count must be unchanged, and the body must
 * be byte-identical. Any mismatch restores the original bytes and reports a failure.
 *
 * Canon Part 8 (The Graph Boundary): LOCAL-only. Reads and writes local skills/
 * files. ZERO network reach, ZERO Brain read or write.
 *
 * EXIT CONTRACT
 *   --dry-run    report what would change, write nothing, exit 0 (exit 1 on a
 *                self-verification failure detected in the simulated result)
 *   --apply      perform the migration, exit 0 clean, exit 1 on any failure
 *   no flag      usage, exit 2
 *
 * House rule: hyphens only, no em-dashes, no emoji. CJS, process.argv routing.
 */

const fs = require('node:fs');
const path = require('node:path');
const matter = require('gray-matter');

const REPO_ROOT = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(REPO_ROOT, 'skills');

// 234-04 owns these two. Explicit list, not an emergent skip.
const EXCLUDED_SKILLS = new Set(['MOSDeckEngine', 'value-proposition']);

// The 15 skills that declare `disable-model-invocation` (a Claude-Code-only
// frontmatter mechanic). Named in the plan; asserted against the tree at run time.
const DISABLE_MODEL_INVOCATION_SKILLS = [
  'dial-memory-refresh', 'export', 'brain-derive', 'explain-decision',
  'dogfood-flush', 'feynman-timeline-refresh', 'publish', 'memory', 'jtbd',
  'mva-report', 'ingest-methodology', 'pws-brain', 'operator', 'vault', 'snapshot',
];

// Body tokens that mean "this skill leans on Tier-1 hook mechanics".
const HOOK_TOKENS_CASE_SENSITIVE = ['Stop gate', 'contradiction push'];
const HOOK_TOKEN_FILE_RE = /hooks\.json/i;

const LICENSE_LINE =
  'license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, ' +
  'Change Date 2030-04-16 to Apache License 2.0).';

const COMPAT_DISABLE_MODEL_INVOCATION =
  'compatibility: Requires Claude Code (or a host implementing ' +
  'disable-model-invocation semantics); Tier-1 hook mechanics referenced in this skill.';

const COMPAT_HOOK_REFERENCING =
  'compatibility: References Tier-1 hook mechanics (Claude Code, Grok Build, or ' +
  'OpenCode via the SEED-063 plugin); degrades to prose guidance on Tier-0 hosts.';

// ---------------------------------------------------------------------------
// Line-level frontmatter helpers.
//
// The whole codemod rests on one rule: inside a frontmatter block, a line that
// starts at COLUMN 0 begins a new top-level construct (a key, a comment, or the
// closing fence); anything indented or blank is a continuation of the construct
// above it. That rule is what lets a multi-line value (folded scalar, block
// sequence) be found and replaced without parsing YAML by hand.
// ---------------------------------------------------------------------------

function frontmatterBounds(lines) {
  if (lines.length === 0 || lines[0].trim() !== '---') return null;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') return { start: 0, end: i };
  }
  return null;
}

function findTopLevelKey(lines, bounds, key) {
  const re = new RegExp('^' + key.replace(/[-]/g, '\\-') + '\\s*:');
  for (let i = bounds.start + 1; i < bounds.end; i += 1) {
    if (re.test(lines[i])) return i;
  }
  return -1;
}

// First index after keyIdx that starts a new top-level construct (or the fence).
function constructEnd(lines, bounds, keyIdx) {
  for (let i = keyIdx + 1; i < bounds.end; i += 1) {
    if (/^\S/.test(lines[i])) return i;
  }
  return bounds.end;
}

function isCommentLine(line) {
  return line.trimStart().startsWith('#');
}

function countFrontmatterComments(lines) {
  const bounds = frontmatterBounds(lines);
  if (!bounds) return 0;
  let n = 0;
  for (let i = bounds.start + 1; i < bounds.end; i += 1) {
    if (isCommentLine(lines[i])) n += 1;
  }
  return n;
}

// Pick the separator for the list -> string normalization.
//
// The spec's form is SPACE-separated, and that is what 122 of the 123 skills get.
// But a space separator can only encode tool names that contain no space, and
// Claude Code's scoped-permission syntax produces exactly such names:
// `skills/status` grants `Bash(node scripts/mos-status.cjs:*)`, which narrows Bash
// to one specific script. Space-joining that entry would silently re-read as the
// three tokens `Bash(node`, `scripts/mos-status.cjs:*)` and `Read` - widening a
// deliberately narrow Bash grant into a broad one. That is a permission-scope
// regression, not a formatting nit, so it is not an acceptable lossy conversion.
//
// For that case the separator falls back to comma-space, which is (a) lossless for
// entries containing spaces, (b) already the shipping form in 7 other SKILL.md
// files and 9 commands/*.md files in this repo, and (c) still a STRING, which is
// what the spec's type rule and scripts/check-skill-spec.cjs actually require
// (`allowed-tools` is marked Experimental in the spec, with support that "may vary
// between agent implementations"). Correctness of the grant beats separator purity.
function toolSeparator(tools) {
  return tools.some((t) => String(t).includes(' ')) ? ', ' : ' ';
}

// Emit a YAML plain scalar when it is unambiguously safe, else a quoted one.
// Keeps the common case readable and never risks a re-parse surprise.
function yamlScalar(value) {
  const s = String(value);
  if (s === '') return '""';
  const safe = /^[A-Za-z0-9_]/.test(s) && !s.includes(': ') && !s.includes(' #') && !/[:#]$/.test(s);
  return safe ? s : JSON.stringify(s);
}

// ---------------------------------------------------------------------------
// migrateOne(dir) -> { dir, skipped, changes: string[], error: string|null }
// Pure with respect to disk when opts.write is false.
// ---------------------------------------------------------------------------
function migrateOne(dir, opts) {
  const write = !!(opts && opts.write);
  const skillPath = path.join(SKILLS_DIR, dir, 'SKILL.md');
  const rel = path.relative(REPO_ROOT, skillPath);
  const result = { dir, path: rel, skipped: false, changes: [], error: null };

  let raw;
  try {
    raw = fs.readFileSync(skillPath, 'utf8');
  } catch (e) {
    result.error = 'cannot read: ' + (e.message || String(e));
    return result;
  }

  let before;
  try {
    before = matter(raw);
  } catch (e) {
    result.error = 'frontmatter parse failed: ' + (e.message || String(e));
    return result;
  }

  const beforeData = before.data || {};
  const beforeBody = before.content || '';
  const beforeComments = countFrontmatterComments(raw.split('\n'));

  let lines = raw.split('\n');
  let bounds = frontmatterBounds(lines);
  if (!bounds) {
    result.error = 'no frontmatter block';
    return result;
  }

  // -- 1. name -------------------------------------------------------------
  const hasName =
    beforeData.name !== undefined && beforeData.name !== null && String(beforeData.name).trim() !== '';
  if (!hasName) {
    lines.splice(bounds.start + 1, 0, 'name: ' + dir);
    bounds = frontmatterBounds(lines);
    result.changes.push('name: ' + dir);
  }

  // -- 2. allowed-tools list -> space-separated string ----------------------
  const at = beforeData['allowed-tools'];
  if (Array.isArray(at)) {
    const keyIdx = findTopLevelKey(lines, bounds, 'allowed-tools');
    if (keyIdx < 0) {
      result.error = 'allowed-tools parsed as an array but no top-level line found';
      return result;
    }
    const endIdx = constructEnd(lines, bounds, keyIdx);
    // Preserve, verbatim, any hand-written comment sitting inside the block.
    // rs-experts and rs-thesis record a Canon Part 8 prohibition here.
    const preserved = lines.slice(keyIdx + 1, endIdx).filter(isCommentLine);
    const tools = at.map((t) => String(t));
    const joined = tools.join(toolSeparator(tools));
    const replacement = ['allowed-tools: ' + yamlScalar(joined)].concat(preserved);
    lines.splice(keyIdx, endIdx - keyIdx, ...replacement);
    bounds = frontmatterBounds(lines);
    result.changes.push(
      'allowed-tools: list(' + at.length + ') -> string' +
        (preserved.length ? ' (+' + preserved.length + ' comment line(s) preserved)' : '')
    );
  }

  // -- 3. license ----------------------------------------------------------
  if (beforeData.license === undefined) {
    const descIdx = findTopLevelKey(lines, bounds, 'description');
    if (descIdx < 0) {
      result.error = 'no top-level description key to anchor license insertion';
      return result;
    }
    const insertAt = constructEnd(lines, bounds, descIdx);
    lines.splice(insertAt, 0, LICENSE_LINE);
    bounds = frontmatterBounds(lines);
    result.changes.push('license: added');

    // -- 4. compatibility (immediately after the license line) -------------
    if (beforeData.compatibility === undefined) {
      const isDmi = DISABLE_MODEL_INVOCATION_SKILLS.indexOf(dir) !== -1;
      const bodyRefsHooks =
        HOOK_TOKENS_CASE_SENSITIVE.some((t) => beforeBody.includes(t)) ||
        HOOK_TOKEN_FILE_RE.test(beforeBody);
      if (isDmi) {
        lines.splice(insertAt + 1, 0, COMPAT_DISABLE_MODEL_INVOCATION);
        bounds = frontmatterBounds(lines);
        result.changes.push('compatibility: added (disable-model-invocation)');
      } else if (bodyRefsHooks) {
        lines.splice(insertAt + 1, 0, COMPAT_HOOK_REFERENCING);
        bounds = frontmatterBounds(lines);
        result.changes.push('compatibility: added (hook-referencing body)');
      }
    }
  }

  if (result.changes.length === 0) {
    result.skipped = true;
    return result;
  }

  const next = lines.join('\n');

  // -- self-verification ---------------------------------------------------
  const verifyError = verifyMigration({
    beforeData,
    beforeBody,
    beforeComments,
    next,
    dir,
  });
  if (verifyError) {
    result.error = verifyError;
    return result;
  }

  if (write) {
    try {
      fs.writeFileSync(skillPath, next, 'utf8');
    } catch (e) {
      result.error = 'cannot write: ' + (e.message || String(e));
    }
  }
  return result;
}

// The migration is only allowed to ADD keys and to retype allowed-tools. Anything
// else moving is a bug, and a bug here lands on 123 files at once.
function verifyMigration(ctx) {
  let after;
  try {
    after = matter(ctx.next);
  } catch (e) {
    return 'post-edit re-parse failed: ' + (e.message || String(e));
  }
  const afterData = after.data || {};

  if (String(after.content || '') !== String(ctx.beforeBody)) {
    return 'body content changed (must be byte-identical)';
  }
  if (countFrontmatterComments(ctx.next.split('\n')) !== ctx.beforeComments) {
    return (
      'frontmatter comment count changed: ' + ctx.beforeComments + ' -> ' +
      countFrontmatterComments(ctx.next.split('\n'))
    );
  }

  for (const key of Object.keys(ctx.beforeData)) {
    if (key === 'allowed-tools') {
      const b = ctx.beforeData[key];
      const a = afterData[key];
      if (typeof a !== 'string') return '`allowed-tools` did not become a string';
      // A value that was ALREADY a string is outside this codemod's remit: it
      // already satisfies the spec's type rule, so it must survive byte-identical.
      if (!Array.isArray(b)) {
        if (a !== b) return '`allowed-tools` was already a string and must not change';
        continue;
      }
      // Token IDENTITY, not string equality. The entire risk of a list -> string
      // conversion is a grant silently splitting into more (or fewer) tokens than
      // the author wrote, which is how a narrow Bash scope becomes a broad one.
      const bTokens = b.map((t) => String(t));
      const sep = toolSeparator(bTokens);
      const aTokens = a.length ? a.split(sep) : [];
      if (JSON.stringify(aTokens) !== JSON.stringify(bTokens)) {
        return '`allowed-tools` token drift: [' + bTokens.join(' | ') + '] -> [' + aTokens.join(' | ') + ']';
      }
      continue;
    }
    if (JSON.stringify(afterData[key]) !== JSON.stringify(ctx.beforeData[key])) {
      return 'key `' + key + '` changed value during migration';
    }
  }

  if (String(afterData.name || '') !== ctx.dir) {
    return '`name` is "' + String(afterData.name || '') + '", expected "' + ctx.dir + '"';
  }
  if (typeof afterData.license !== 'string' || afterData.license.indexOf('BSL-1.1') !== 0) {
    return '`license` missing or malformed after migration';
  }
  return null;
}

// ---------------------------------------------------------------------------
function listTargets() {
  let entries;
  try {
    entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
  } catch (_e) {
    return { targets: [], excluded: [] };
  }
  const targets = [];
  const excluded = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (!fs.existsSync(path.join(SKILLS_DIR, e.name, 'SKILL.md'))) continue;
    if (EXCLUDED_SKILLS.has(e.name)) excluded.push(e.name);
    else targets.push(e.name);
  }
  targets.sort();
  excluded.sort();
  return { targets, excluded };
}

// Reported to stdout so the executor's SUMMARY.md records the measured count,
// not the estimate. RESEARCH guessed 16; the tree is authoritative.
function reportHookReferencing(targets) {
  const hits = [];
  for (const dir of targets) {
    const p = path.join(SKILLS_DIR, dir, 'SKILL.md');
    let body = '';
    try {
      body = matter(fs.readFileSync(p, 'utf8')).content || '';
    } catch (_e) {
      continue;
    }
    const tokens = HOOK_TOKENS_CASE_SENSITIVE.filter((t) => body.includes(t));
    if (HOOK_TOKEN_FILE_RE.test(body)) tokens.push('hooks.json');
    if (tokens.length) hits.push({ dir, tokens });
  }
  return hits;
}

function run(opts) {
  const { targets, excluded } = listTargets();
  console.log('migrate-skill-frontmatter: ' + targets.length + ' target skill(s), ' +
    excluded.length + ' excluded (' + excluded.join(', ') + ') - owned by plan 234-04');

  const hookHits = reportHookReferencing(targets);
  console.log('');
  console.log('hook-referencing skills discovered (body grep: "Stop gate", "contradiction push", hooks.json): ' + hookHits.length);
  for (const h of hookHits) {
    const dmi = DISABLE_MODEL_INVOCATION_SKILLS.indexOf(h.dir) !== -1 ? ' [also disable-model-invocation]' : '';
    console.log('  - ' + h.dir + ': ' + h.tokens.join(', ') + dmi);
  }
  console.log('');

  let changed = 0;
  let skipped = 0;
  const errors = [];
  for (const dir of targets) {
    const r = migrateOne(dir, opts);
    if (r.error) {
      errors.push(r.path + ': ' + r.error);
      console.error('  FAIL ' + r.path + ' - ' + r.error);
      continue;
    }
    if (r.skipped) {
      skipped += 1;
      continue;
    }
    changed += 1;
    console.log('  ' + (opts.write ? 'wrote' : 'would write') + ' ' + r.path + ' [' + r.changes.join('; ') + ']');
  }

  console.log('');
  console.log('migrate-skill-frontmatter: ' + changed + ' changed, ' + skipped +
    ' already conforming, ' + errors.length + ' failed' + (opts.write ? '' : ' (dry run, nothing written)'));
  if (errors.length) {
    console.error('Recovery: no file with a self-verification failure was written; fix the codemod and re-run.');
    return 1;
  }
  return 0;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--apply')) {
    process.exit(run({ write: true }));
    return;
  }
  if (argv.includes('--dry-run')) {
    process.exit(run({ write: false }));
    return;
  }
  console.error('usage: node scripts/migrate-skill-frontmatter.cjs [--dry-run | --apply]');
  process.exit(2);
}

if (require.main === module) {
  main();
}

module.exports = {
  migrateOne,
  listTargets,
  reportHookReferencing,
  frontmatterBounds,
  constructEnd,
  yamlScalar,
  EXCLUDED_SKILLS,
  DISABLE_MODEL_INVOCATION_SKILLS,
  LICENSE_LINE,
};
