#!/usr/bin/env node
'use strict';

/*
 * Phase 234-01 (D-01 / D-02) - the ONE validator for Agent Skills spec
 * conformance across this repo's shipped skill catalog.
 *
 * WHY THIS FILE EXISTS. The Agent Skills specification (agentskills.io) names a
 * reference validator, `skills-ref`. The authoritative one is a PyPI package and
 * this is a Node-only, CJS-only project (CLAUDE.md Conventions); the npm package
 * of the same name is an unaffiliated reimplementation with no declared source
 * repository, so reaching for it is a cross-ecosystem name-collision hazard, not
 * a shortcut. See 234-RESEARCH.md "Package Legitimacy Audit". This file replaces
 * that role in-repo, with zero new dependencies.
 *
 * WHAT IT READS. `skills/<dir>/SKILL.md` frontmatter ONLY, parsed READ-ONLY via
 * `gray-matter` (already a dependency). It never writes back through this file.
 * `.claude/skills/**` is deliberately OUT of scope: that tree holds the
 * project-local `docu-optimizer` dev skill, not shipped product surface.
 *
 * WHY gray-matter AND NOT A REGEX. Several skills use folded scalars
 * (`description: >`) and multiline blocks. A naive regex undercounted the
 * catalog by 33% during research (8,752 vs 12,966 bytes) on the exact number the
 * Zed budget gate depends on. The hand-rolled `parseFrontmatter` exported by
 * scripts/check-shape-declaration.cjs carries that same known limitation, so it
 * is deliberately NOT reused here.
 *
 * THE PREDICATES (agentskills.io/specification, current 2026-07-28):
 *   name           required, 1-64 chars, /^[a-z0-9]+(-[a-z0-9]+)*$/, == dirname
 *   description    required, 1-1024 chars
 *   allowed-tools  optional, but when present MUST be a space-separated STRING
 *   compatibility  optional, max 500 chars
 *
 * EXIT CONTRACT. Deliberate deviation from scripts/check-shape-declaration.cjs's
 * advisory-by-default shape: that gate was downgraded to WARN in Phase 210 for
 * its own documented reason (a shape-declaration backfill in flight). This is a
 * genuine external-spec validator, so a violation is a hard fail with no
 * --strict flag needed.
 *   --check                exit 0 clean, exit 1 on ANY violation
 *   --catalog-budget       exit 0 under the Zed 50KB budget, exit 1 over
 *   --plugin-root-census   ALWAYS exit 0 (informational; 234-06 owns the
 *                          "count must be zero" assertion once migration lands)
 *   no flag / unknown      usage, exit 2
 *
 * Canon Part 8 (The Graph Boundary): LOCAL-only. Reads process.env and local
 * skills/ files only. ZERO network reach, ZERO Brain read or write, ZERO fs
 * write. Deterministic: same tree -> same verdict.
 *
 * House rule: hyphens only, no em-dashes, no emoji. CJS, process.argv routing.
 */

const fs = require('node:fs');
const path = require('node:path');
const matter = require('gray-matter');

const REPO_ROOT = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(REPO_ROOT, 'skills');

// No leading/trailing hyphen, no consecutive hyphens (spec charset rule).
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const NAME_MAX = 64;
const DESCRIPTION_MAX = 1024;
const COMPATIBILITY_MAX = 500;

// Zed loads the whole skill catalog's name+description into one 50KB budget and
// drops the overflow (with a UI warning). Source: https://zed.dev/docs/ai/skills
const ZED_CATALOG_BUDGET_BYTES = 51200;

// The literal token the 51 Claude-Code-shaped skills interpolate today. Foreign
// hosts never define it, so a body carrying it degrades to a broken path there.
const PLUGIN_ROOT_TOKEN = '${CLAUDE_PLUGIN_ROOT}';

// ---------------------------------------------------------------------------
// Discovery: skills/<dir>/SKILL.md, sorted for deterministic output.
// ---------------------------------------------------------------------------
function listSkillFiles() {
  let entries;
  try {
    entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
  } catch (_e) {
    return [];
  }
  const out = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const p = path.join(SKILLS_DIR, e.name, 'SKILL.md');
    if (fs.existsSync(p)) out.push(p);
  }
  return out.sort();
}

// gray-matter, READ-ONLY. A malformed YAML block returns an empty data object
// plus an explicit parse violation rather than throwing the whole sweep down.
function readSkill(skillMdPath) {
  let raw;
  try {
    raw = fs.readFileSync(skillMdPath, 'utf8');
  } catch (e) {
    return { data: {}, content: '', parseError: 'cannot read file: ' + (e.message || String(e)) };
  }
  try {
    const parsed = matter(raw);
    return { data: parsed.data || {}, content: parsed.content || '', parseError: null };
  } catch (e) {
    return { data: {}, content: raw, parseError: 'frontmatter parse failed: ' + (e.message || String(e)) };
  }
}

// ---------------------------------------------------------------------------
// validateSkill(skillMdPath) -> string[] of violations (empty array == valid).
// ---------------------------------------------------------------------------
function validateSkill(skillMdPath) {
  const { data: fm, parseError } = readSkill(skillMdPath);
  const errs = [];
  if (parseError) {
    errs.push(parseError);
    return errs;
  }

  const dir = path.basename(path.dirname(skillMdPath));

  // name: required, charset, length, must equal the parent directory name.
  if (fm.name === undefined || fm.name === null || String(fm.name).trim() === '') {
    errs.push('missing required `name`');
  } else {
    const name = String(fm.name);
    if (!NAME_RE.test(name)) {
      errs.push('`name` charset: "' + name + '" must match /^[a-z0-9]+(-[a-z0-9]+)*$/');
    }
    if (name.length < 1 || name.length > NAME_MAX) {
      errs.push('`name` length ' + name.length + ' outside 1-' + NAME_MAX);
    }
    if (name !== dir) {
      errs.push('`name` must match parent directory: "' + name + '" != "' + dir + '"');
    }
  }

  // description: required, 1-1024 chars.
  if (fm.description === undefined || fm.description === null || String(fm.description).trim() === '') {
    errs.push('missing required `description`');
  } else {
    const desc = String(fm.description);
    if (desc.length > DESCRIPTION_MAX) {
      errs.push('`description` length ' + desc.length + ' over ' + DESCRIPTION_MAX);
    }
  }

  // allowed-tools: optional, but a space-separated STRING when present.
  const at = fm['allowed-tools'];
  if (at !== undefined && at !== null && typeof at !== 'string') {
    errs.push('`allowed-tools` must be a space-separated string (found ' + (Array.isArray(at) ? 'array' : typeof at) + ')');
  }

  // compatibility: optional, max 500 chars.
  const compat = fm.compatibility;
  if (compat !== undefined && compat !== null && String(compat).length > COMPATIBILITY_MAX) {
    errs.push('`compatibility` length ' + String(compat).length + ' over ' + COMPATIBILITY_MAX);
  }

  return errs;
}

// ---------------------------------------------------------------------------
// checkAll() -> { ok, total, failing, hardFailing, allowedToolsDeviations,
//                 violations: [{ skill, errors }] }
//
// Both counts are reported because they are two different repair jobs. A
// missing/mismatched `name` breaks the spec's REQUIRED contract and is what makes
// a skill vanish from a strict foreign host's catalog. `allowed-tools` is marked
// Experimental in the spec, so the array form is a portability deviation, not a
// required-field breach. Later plans in this phase close them separately, and a
// single blended number would hide which one moved.
// ---------------------------------------------------------------------------
function isAllowedToolsError(err) {
  return String(err).indexOf('`allowed-tools`') === 0;
}

function checkAll() {
  const files = listSkillFiles();
  const violations = [];
  let hardFailing = 0;
  let allowedToolsDeviations = 0;
  for (const f of files) {
    const errors = validateSkill(f);
    if (!errors.length) continue;
    violations.push({ skill: path.relative(REPO_ROOT, f), errors });
    if (errors.some((e) => !isAllowedToolsError(e))) hardFailing += 1;
    if (errors.some(isAllowedToolsError)) allowedToolsDeviations += 1;
  }
  return {
    ok: violations.length === 0,
    total: files.length,
    failing: violations.length,
    hardFailing,
    allowedToolsDeviations,
    violations,
  };
}

// ---------------------------------------------------------------------------
// catalogBudget() -> the Zed 50KB name+description total across the catalog.
// ---------------------------------------------------------------------------
function catalogBudget() {
  const files = listSkillFiles();
  let totalBytes = 0;
  const perSkill = [];
  for (const f of files) {
    const { data: fm } = readSkill(f);
    const bytes = Buffer.byteLength(String(fm.name || '') + String(fm.description || ''), 'utf8');
    totalBytes += bytes;
    perSkill.push({ skill: path.relative(REPO_ROOT, f), bytes });
  }
  perSkill.sort((a, b) => b.bytes - a.bytes);
  return {
    totalBytes,
    budgetBytes: ZED_CATALOG_BUDGET_BYTES,
    pct: ZED_CATALOG_BUDGET_BYTES === 0 ? 0 : Math.round((totalBytes / ZED_CATALOG_BUDGET_BYTES) * 100),
    skills: files.length,
    largest: perSkill.slice(0, 5),
    ok: totalBytes < ZED_CATALOG_BUDGET_BYTES,
  };
}

// ---------------------------------------------------------------------------
// pluginRootCensus() -> how many skill BODIES still carry ${CLAUDE_PLUGIN_ROOT}.
// Informational only. Never fails. 234-06 owns the zero assertion.
// ---------------------------------------------------------------------------
function pluginRootCensus() {
  const files = listSkillFiles();
  const hits = [];
  for (const f of files) {
    const { content } = readSkill(f);
    if (String(content).includes(PLUGIN_ROOT_TOKEN)) {
      hits.push(path.relative(REPO_ROOT, f));
    }
  }
  return { count: hits.length, files: hits, scanned: files.length };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function main() {
  const argv = process.argv.slice(2);

  if (argv.includes('--check')) {
    const report = checkAll();
    if (!report.ok) {
      console.error(
        'AGENT SKILLS SPEC VIOLATION: ' + report.failing + ' of ' + report.total +
          ' skill(s) fail the spec (' + report.hardFailing + ' with a required-field breach, ' +
          report.allowedToolsDeviations + ' with the experimental `allowed-tools` array form)'
      );
      for (const v of report.violations) {
        console.error('  - ' + v.skill);
        for (const e of v.errors) console.error('      ' + e);
      }
      console.error(
        'Recovery: add the missing `name`/`description` key, align `name` to the parent ' +
          'directory, or convert `allowed-tools` to a space-separated string, per ' +
          'https://agentskills.io/specification'
      );
      process.exit(1);
      return;
    }
    console.log('check-skill-spec: OK (' + report.total + ' skill(s) conform to the Agent Skills spec)');
    return;
  }

  if (argv.includes('--catalog-budget')) {
    const b = catalogBudget();
    const line =
      'check-skill-spec catalog-budget: ' + b.totalBytes + ' bytes / ' + b.budgetBytes +
      ' (' + b.pct + '%) across ' + b.skills + ' skill(s)';
    if (!b.ok) {
      console.error('ZED CATALOG BUDGET EXCEEDED: ' + line);
      for (const s of b.largest) console.error('  largest: ' + s.skill + ' (' + s.bytes + ' bytes)');
      console.error('Recovery: shorten the longest `description` fields; Zed drops catalog overflow with a UI warning.');
      process.exit(1);
      return;
    }
    console.log(line);
    return;
  }

  if (argv.includes('--plugin-root-census')) {
    // Always exit 0. This reports a migration surface, it does not gate one.
    const c = pluginRootCensus();
    console.log(JSON.stringify(c, null, 2));
    return;
  }

  console.error(
    'usage: node scripts/check-skill-spec.cjs [--check | --catalog-budget | --plugin-root-census]'
  );
  process.exit(2);
}

if (require.main === module) {
  main();
}

module.exports = {
  validateSkill,
  checkAll,
  catalogBudget,
  pluginRootCensus,
  listSkillFiles,
  NAME_RE,
  ZED_CATALOG_BUDGET_BYTES,
  PLUGIN_ROOT_TOKEN,
};
