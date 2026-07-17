#!/usr/bin/env node
'use strict';
/*
 * scripts/skillopt-inventory.cjs - Phase 230-01, WS1.1: the deterministic skill inventory.
 * ==========================================================================
 * Enumerates every skills/<name>/SKILL.md, parses its frontmatter with
 * gray-matter, groups skills into namespace families, and classifies the
 * script/workflow-backed subset that Workstream 2 (code-quality review) will
 * cover. Output: out/inventory.json - the ground-truth roster Plans 02-05 consume
 * for rosters, families, and the WS2 subset.
 *
 * IMPLEMENTATION CHOICE (within Claude's Discretion per CONTEXT.md): this step is
 * PURE CODE with ZERO model calls. The AI-SPEC model table lists the haiku tier as
 * the cost ceiling for inventory/classification, but a deterministic parse +
 * regex + grouping is cheaper, fully reviewable, and byte-for-byte reproducible on
 * every run - three properties a haiku call cannot promise. The filesystem is the
 * source of truth (CLAUDE.md conventions); a spend here would only add nondeterminism.
 *
 * No-silent-skip discipline (D5) starts here: a malformed SKILL.md is NEVER dropped
 * from the 124 count. It is recorded with a degraded record (backed:false,
 * body_lines:0) plus an explicit stderr warning naming the file - the same honesty
 * rule the whole pipeline enforces, applied to the inventory itself.
 *
 * Write-path containment (D6/CFM4): the inventory writes ONLY under
 * .planning/.../out/. assertUnderOut runs fail-closed before writeAtomic; a target
 * that resolves outside the out sandbox aborts the write.
 *
 * Backing signals (grep the BODY, not the frontmatter): a real reference to
 *   scripts/<name>.cjs, bin/<name>.cjs, or a Workflow( call
 * marks a skill backed. These are the "real .cjs machinery" the WS2 code review
 * targets. backed = ANY match; backing_refs = the unique matched strings.
 *
 * CJS only. Switch-case argv router (gsd-tools.cjs pattern), no Commander/yargs.
 * No em-dashes (CLAUDE.md HARD RULE). Zero new dependencies (gray-matter + zod
 * already pinned).
 */

const fs = require('node:fs');
const path = require('node:path');
const matter = require('gray-matter');

const {
  InventoryRecordSchema,
  PHASE_OUT_DIR,
  assertUnderOut,
} = require('../lib/core/skillopt-schemas.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(REPO_ROOT, 'skills');

// Body-backing signals. Non-comment-aware on purpose: a script reference in a
// fenced code block still means the skill drives that machinery.
const BACKING_PATTERNS = [
  /scripts\/[A-Za-z0-9._-]+\.cjs/g,
  /bin\/[A-Za-z0-9._-]+\.cjs/g,
  /Workflow\(/g,
];

// --------------------------------------------------------------------------
// writeAtomic - write-temp-then-rename so a crash never leaves a half-written
// inventory. Copied from huji-batch.writeAtomic.
// --------------------------------------------------------------------------
function writeAtomic(filePath, contents) {
  const tmp = filePath + '.tmp.' + process.pid + '.' + Math.random().toString(36).slice(2, 10);
  fs.writeFileSync(tmp, contents, 'utf8');
  fs.renameSync(tmp, filePath);
}

// --------------------------------------------------------------------------
// familyKey(name) - group skills into namespace families (net-new logic, no
// in-repo analog). A family is a namespace prefix plus the first verb segment:
//   'mos:find-connections'  -> 'mos:find'      (namespaced form)
//   'mos:explore-domains'   -> 'mos:explore'
//   'find-connections'      -> 'plain:find'    (bare form, this repo's real names)
//   'build-thesis'          -> 'plain:build'
// Singleton families are fine - Plan 02 treats a singleton as a skill with no
// sibling near-misses.
// --------------------------------------------------------------------------
function familyKey(name) {
  const s = String(name || '');
  const colon = s.indexOf(':');
  if (colon >= 0) {
    const ns = s.slice(0, colon);
    const rest = s.slice(colon + 1);
    const verb = rest.split('-')[0] || rest;
    return ns + ':' + verb;
  }
  const verb = s.split('-')[0] || s;
  return 'plain:' + verb;
}

// --------------------------------------------------------------------------
// detectBacking(body) - scan a SKILL.md body for the three backing signals.
// Returns { backed, backing_refs } with backing_refs the sorted unique matches.
// --------------------------------------------------------------------------
function detectBacking(body) {
  const text = String(body || '');
  const refs = new Set();
  for (const re of BACKING_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) refs.add(m[0]);
  }
  const backing_refs = Array.from(refs).sort();
  return { backed: backing_refs.length > 0, backing_refs };
}

// --------------------------------------------------------------------------
// parseSkillDir(dirName) - build ONE inventory record from skills/<dirName>.
// Never throws on a malformed file: a missing/unparseable SKILL.md yields a
// degraded record (backed:false, body_lines:0, description '') plus a stderr
// warning - never dropped from the count (D5 no-silent-skip).
// --------------------------------------------------------------------------
function parseSkillDir(dirName) {
  const skillPath = path.join(SKILLS_DIR, dirName, 'SKILL.md');
  const degraded = {
    skill: dirName,
    dir: dirName,
    description: '',
    family: familyKey(dirName),
    backed: false,
    backing_refs: [],
    body_lines: 0,
  };

  let fileText;
  try {
    fileText = fs.readFileSync(skillPath, 'utf8');
  } catch (_e) {
    process.stderr.write('WARN skillopt-inventory: no readable SKILL.md for "' + dirName + '"; recorded degraded\n');
    return degraded;
  }

  let parsed;
  try {
    parsed = matter(fileText);
  } catch (e) {
    process.stderr.write('WARN skillopt-inventory: malformed frontmatter in "' + dirName + '" (' + e.message + '); recorded degraded\n');
    return degraded;
  }

  const data = parsed.data || {};
  const body = parsed.content || '';
  const name = data.name ? String(data.name) : dirName; // fall back to dir name when name missing
  const description = data.description != null ? String(data.description) : ''; // never crash on a missing description
  const { backed, backing_refs } = detectBacking(body);
  const body_lines = body.length === 0 ? 0 : body.split('\n').length;

  return {
    skill: name,
    dir: dirName,
    description,
    family: familyKey(name),
    backed,
    backing_refs,
    body_lines,
  };
}

// --------------------------------------------------------------------------
// buildInventory() - enumerate skills/ (readdirSync withFileTypes, directories
// only, huji-batch.listSubmissions shape) and build a record per skill dir.
// --------------------------------------------------------------------------
function buildInventory() {
  let entries = [];
  try {
    entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
  } catch (e) {
    throw new Error('skillopt-inventory: cannot read skills dir ' + SKILLS_DIR + ' (' + e.message + ')');
  }
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return entries.map((d) => parseSkillDir(d.name));
}

// --------------------------------------------------------------------------
// validateInventory(records) - every record must pass InventoryRecordSchema.
// Inventory is deterministic, so a schema failure is a BUG, not a not_evaluated:
// HARD exit 1 naming the offending record (contrast with the pipeline's spawn
// units, where a failure is recorded as not_evaluated).
// --------------------------------------------------------------------------
function validateInventory(records) {
  for (const rec of records) {
    const res = InventoryRecordSchema.safeParse(rec);
    if (!res.success) {
      process.stderr.write(
        'FATAL skillopt-inventory: record for "' + (rec && rec.dir) + '" failed InventoryRecordSchema: ' +
          JSON.stringify(res.error.issues) + '\n'
      );
      process.exit(1);
    }
  }
  return records;
}

// --------------------------------------------------------------------------
// summarize(records) - the one-line human summary (total, families, backed).
// --------------------------------------------------------------------------
function summarize(records) {
  const families = new Set(records.map((r) => r.family));
  const backed = records.filter((r) => r.backed);
  return {
    total: records.length,
    familyCount: families.size,
    backedCount: backed.length,
    backedNames: backed.map((r) => r.skill).sort(),
  };
}

// --------------------------------------------------------------------------
// writeInventory(records, outDir) - guard-then-write. assertUnderOut runs
// FAIL-CLOSED before writeAtomic; a target outside the out sandbox throws (D6).
// --------------------------------------------------------------------------
function writeInventory(records, outDir) {
  const target = path.join(outDir, 'inventory.json');
  const guard = assertUnderOut(target, outDir);
  if (!guard.ok) {
    throw new Error('skillopt-inventory: refusing to write outside the out sandbox (' + guard.reason + '): ' + target);
  }
  fs.mkdirSync(outDir, { recursive: true });
  writeAtomic(target, JSON.stringify(records, null, 2) + '\n');
  return target;
}

// --------------------------------------------------------------------------
// runSelftest() - embedded deterministic fixtures (zero I/O to skills/).
//   1. backing-detection: a body with a scripts/foo.cjs ref -> backed:true.
//   2. family-key: the dense mos:find-* / mos:explore-* families collapse to one
//      key each; a bare name maps to a plain: family.
//   3. containment: an assertUnderOut violation makes writeInventory throw
//      (the D6 fail-closed path).
// Exits 0 on success, 1 on the first failed assertion.
// --------------------------------------------------------------------------
function runSelftest() {
  const assert = require('node:assert');

  // 1. Backing detection.
  const backedProbe = detectBacking('Run `node scripts/foo.cjs --check` then done.');
  assert.strictEqual(backedProbe.backed, true, 'selftest: scripts/foo.cjs body must be backed');
  assert.ok(backedProbe.backing_refs.includes('scripts/foo.cjs'), 'selftest: backing_refs must include scripts/foo.cjs');
  const cleanProbe = detectBacking('A pure methodology skill with no machinery.');
  assert.strictEqual(cleanProbe.backed, false, 'selftest: a body with no refs must be unbacked');
  const wfProbe = detectBacking('This skill runs Workflow( over the room.');
  assert.strictEqual(wfProbe.backed, true, 'selftest: a Workflow( call must be backed');

  // 2. Family grouping - dense namespace families collapse to one key each.
  assert.strictEqual(familyKey('mos:find-connections'), 'mos:find', 'selftest: mos:find-connections -> mos:find');
  assert.strictEqual(familyKey('mos:find-analogies'), 'mos:find', 'selftest: mos:find-analogies -> mos:find');
  assert.strictEqual(familyKey('mos:find-bottlenecks'), 'mos:find', 'selftest: mos:find-bottlenecks -> mos:find');
  assert.strictEqual(familyKey('mos:explore-domains'), 'mos:explore', 'selftest: mos:explore-domains -> mos:explore');
  assert.strictEqual(familyKey('mos:explore-trends'), 'mos:explore', 'selftest: mos:explore-trends -> mos:explore');
  assert.strictEqual(familyKey('mos:explore-futures'), 'mos:explore', 'selftest: mos:explore-futures -> mos:explore');
  assert.strictEqual(familyKey('build-thesis'), 'plain:build', 'selftest: bare build-thesis -> plain:build');
  assert.strictEqual(familyKey('find-connections'), 'plain:find', 'selftest: bare find-connections -> plain:find');

  // 3. Containment violation must throw (fail-closed write path, D6).
  let threw = false;
  try {
    writeInventory([], path.join(REPO_ROOT, 'skills')); // outside .planning/out - must be refused
  } catch (_e) {
    threw = true;
  }
  assert.strictEqual(threw, true, 'selftest: writeInventory outside the out sandbox must throw');

  console.log('OK - skillopt-inventory self-test passed: backing detection, family grouping, containment guard.');
}

// --------------------------------------------------------------------------
// main - switch-case argv router (gsd-tools.cjs pattern), no Commander/yargs.
//   --selftest        run embedded fixtures, exit
//   --check           parse + validate + print counts, write NOTHING
//   --out <dir>       output directory (default PHASE_OUT_DIR)
// --------------------------------------------------------------------------
function main(argv) {
  const args = argv.slice(2);

  if (args.includes('--selftest')) {
    runSelftest();
    return;
  }

  let outDir = path.join(REPO_ROOT, PHASE_OUT_DIR);
  const outIdx = args.indexOf('--out');
  if (outIdx >= 0 && args[outIdx + 1]) {
    outDir = path.resolve(args[outIdx + 1]);
  }

  const records = validateInventory(buildInventory());
  const sum = summarize(records);

  if (args.includes('--check')) {
    console.log(
      'CHECK skillopt-inventory: ' + sum.total + ' skills, ' + sum.familyCount + ' families, ' +
        sum.backedCount + ' backed (no write).'
    );
    console.log('backed: ' + sum.backedNames.join(', '));
    return;
  }

  const target = writeInventory(records, outDir);
  console.log(
    'OK skillopt-inventory: wrote ' + sum.total + ' skills, ' + sum.familyCount + ' families, ' +
      sum.backedCount + ' backed -> ' + path.relative(REPO_ROOT, target)
  );
  console.log('backed: ' + sum.backedNames.join(', '));
}

module.exports = {
  familyKey,
  detectBacking,
  parseSkillDir,
  buildInventory,
  validateInventory,
  summarize,
  writeInventory,
};

if (require.main === module) {
  main(process.argv);
}
