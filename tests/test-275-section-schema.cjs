#!/usr/bin/env node
'use strict';

/*
 * Phase 275-08 Task 2 -- test-275-section-schema.cjs
 *
 * The phase's own assertion suite over the 11-section ICM L0/L1/L2/L3
 * schema (Phase 275). House shape lifted from tests/test-blueprint-scaffold.cjs:
 * no test framework, plain assert, numbered Section blocks, a pass counter,
 * non-zero exit on any failure.
 *
 * Schema-driven per tests/test-270-baseline-schema-driven.cjs's own rule: this
 * file derives its expectations from the live tables (SECTION_NAMES,
 * SECTION_METADATA, data/command-registry.json, data/room-blueprints.json,
 * lib/core/model-profiles.cjs's STAGE_HINTS) rather than restating a frozen
 * count as a hand-typed literal.
 *
 * Pure local: no network, no Brain client require, no room-db require
 * (Canon Part 8, Canon Part 9).
 */

const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCAFFOLD_PATH = path.join(REPO_ROOT, 'lib', 'core', 'room-skeleton-scaffold.cjs');
const SECTION_REGISTRY_PATH = path.join(REPO_ROOT, 'lib', 'core', 'section-registry.cjs');
const ROOM_BIRTH_PATH = path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'room-birth.cjs');
const GRADE_GRANT_PATH = path.join(REPO_ROOT, 'lib', 'core', 'eureka', 'grade-grant.cjs');
const MODEL_PROFILES_PATH = path.join(REPO_ROOT, 'lib', 'core', 'model-profiles.cjs');
const COMMAND_REGISTRY_PATH = path.join(REPO_ROOT, 'data', 'command-registry.json');
const BLUEPRINTS_PATH = path.join(REPO_ROOT, 'data', 'room-blueprints.json');
const CONTRACTS_DIR = path.join(REPO_ROOT, 'templates', 'room-skeleton', 'section-contracts');
const REFERENCES_DIR = path.join(REPO_ROOT, 'templates', 'room-skeleton', 'references');
const MIGRATE_SCRIPT = path.join(REPO_ROOT, 'scripts', 'migrate-room-sections-v275.cjs');

function pass(msg) { console.log('  PASS: ' + msg); }
function fail(msg) { console.error('  FAIL: ' + msg); }

let PASSED = 0;
let FAILED = 0;

function assert(condition, msg) {
  if (condition) { pass(msg); PASSED++; }
  else { fail(msg); FAILED++; }
}

function makeTmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix || 'm275-test-'));
}

function setEqual(a, b) {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size !== sb.size) return false;
  for (const v of sa) if (!sb.has(v)) return false;
  return true;
}

// Recursive content snapshot: relative path -> file content. Used to prove
// dry-run / --report-drift are provably inert.
function snapshot(dir) {
  const out = {};
  const stack = [''];
  while (stack.length > 0) {
    const rel = stack.pop();
    const abs = path.join(dir, rel);
    let entries;
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch (_e) {
      continue;
    }
    for (const ent of entries) {
      const childRel = rel ? path.join(rel, ent.name) : ent.name;
      if (ent.isDirectory()) {
        stack.push(childRel);
      } else if (ent.isFile()) {
        out[childRel] = fs.readFileSync(path.join(dir, childRel), 'utf8');
      }
    }
  }
  return out;
}

let scaffold, sectionRegistry, roomBirth, gradeGrant, modelProfiles, commandRegistry, blueprints;
try {
  scaffold = require(SCAFFOLD_PATH);
  sectionRegistry = require(SECTION_REGISTRY_PATH);
  roomBirth = require(ROOM_BIRTH_PATH);
  gradeGrant = require(GRADE_GRANT_PATH);
  modelProfiles = require(MODEL_PROFILES_PATH);
  commandRegistry = JSON.parse(fs.readFileSync(COMMAND_REGISTRY_PATH, 'utf8'));
  blueprints = JSON.parse(fs.readFileSync(BLUEPRINTS_PATH, 'utf8'));
} catch (e) {
  console.error('[test-275-section-schema] Cannot load a required module: ' + e.message);
  process.exit(1);
}

const LIVE_COMMANDS = new Set(commandRegistry.commands.map((c) => c.command));
const BLUEPRINT_FAMILY_NAMES = Object.keys(blueprints).filter((k) => !k.startsWith('_'));

console.log('[test-275-section-schema] Phase 275-08 -- the phase\'s own ICM L0/L1/L2/L3 assertion suite');
console.log('');

// ---------------------------------------------------------------------------
// Section 1: vocabulary coherence (ICML-01, ICML-03, ICML-05)
// ---------------------------------------------------------------------------
console.log('Section 1: vocabulary coherence -- every section-vocabulary source is set-equal');
{
  const scaffoldNames = Array.from(scaffold.SECTION_NAMES);
  const metadataKeys = Object.keys(scaffold.SECTION_METADATA);
  const coreSectionKeys = Object.keys(sectionRegistry.CORE_SECTIONS);
  const roomBirthNames = Array.from(roomBirth.SECTION_NAMES);
  const gradeGrantValues = Array.from(gradeGrant.ROOM_SECTION_VALUES);

  assert(setEqual(scaffoldNames, metadataKeys),
    'SECTION_NAMES and Object.keys(SECTION_METADATA) are set-equal (' + metadataKeys.length + ' entries)');
  assert(setEqual(scaffoldNames, coreSectionKeys),
    'SECTION_NAMES and Object.keys(CORE_SECTIONS) are set-equal (' + coreSectionKeys.length + ' entries)');
  assert(setEqual(scaffoldNames, roomBirthNames),
    'SECTION_NAMES and roomBirth.SECTION_NAMES are set-equal (' + roomBirthNames.length + ' entries)');
  assert(setEqual(scaffoldNames, gradeGrantValues),
    'SECTION_NAMES and [...grade-grant.ROOM_SECTION_VALUES] are set-equal (' + gradeGrantValues.length + ' entries)');
}
console.log('');

// ---------------------------------------------------------------------------
// Section 2: citation liveness (ICML-02)
// ---------------------------------------------------------------------------
console.log('Section 2: citation liveness -- every default_methodologies slug resolves live');
{
  let allResolve = true;
  const offenders = [];
  for (const slug of scaffold.SECTION_NAMES) {
    const meta = scaffold.SECTION_METADATA[slug];
    for (const m of meta.default_methodologies) {
      const cmd = '/mos:' + m;
      if (!LIVE_COMMANDS.has(cmd)) {
        allResolve = false;
        offenders.push(slug + ' -> ' + cmd);
      }
    }
  }
  assert(allResolve, 'every SECTION_METADATA default_methodologies slug resolves to a live /mos: command' +
    (offenders.length > 0 ? ' (offenders: ' + offenders.join(', ') + ')' : ''));

  const trendingUnder = scaffold.SECTION_NAMES.filter(
    (s) => scaffold.SECTION_METADATA[s].default_methodologies.includes('trending-to-absurd')
  );
  assert(setEqual(trendingUnder, ['opportunity-bank']),
    'trending-to-absurd appears only under opportunity-bank (found under: ' + trendingUnder.join(',') + ')');

  const analyzeNeedsUnder = scaffold.SECTION_NAMES.filter(
    (s) => scaffold.SECTION_METADATA[s].default_methodologies.includes('analyze-needs')
  );
  assert(setEqual(analyzeNeedsUnder, ['market-analysis']),
    'analyze-needs appears only under market-analysis (found under: ' + analyzeNeedsUnder.join(',') + ')');

  const deadSlugs = ['domain-explorer', 'scenario-analysis'];
  let noDeadSlugs = true;
  for (const slug of scaffold.SECTION_NAMES) {
    const meta = scaffold.SECTION_METADATA[slug];
    for (const dead of deadSlugs) {
      if (meta.default_methodologies.includes(dead)) noDeadSlugs = false;
    }
  }
  assert(noDeadSlugs, 'neither domain-explorer nor scenario-analysis appears in any SECTION_METADATA default_methodologies array');
}
console.log('');

// ---------------------------------------------------------------------------
// Section 3: L1 statement (ICML-07)
// ---------------------------------------------------------------------------
console.log('Section 3: L1 statement -- every section carries it in frontmatter and body');
{
  let allNonEmpty = true;
  for (const slug of scaffold.SECTION_NAMES) {
    if (!scaffold.SECTION_METADATA[slug].statement || scaffold.SECTION_METADATA[slug].statement.length === 0) {
      allNonEmpty = false;
    }
  }
  assert(allNonEmpty, 'every SECTION_METADATA entry has a non-empty statement');

  const tmpDir = makeTmpDir('m275-l1-');
  try {
    const result = scaffold.scaffoldRoomSkeleton(tmpDir, {});
    assert(result.ok, 'scaffoldRoomSkeleton returns ok:true for a fresh room');

    let allCarryStatement = true;
    let noUnrenderedTokens = true;
    const walk = (dir) => {
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return; }
      for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) { walk(full); continue; }
        if (!ent.isFile()) continue;
        const content = fs.readFileSync(full, 'utf8');
        if (/\{\{[A-Z_]+\}\}/.test(content)) noUnrenderedTokens = false;
      }
    };
    walk(tmpDir);
    assert(noUnrenderedTokens, 'no file in a fresh room matches an unrendered {{TOKEN}}');

    for (const slug of scaffold.SECTION_NAMES) {
      const roomMdPath = path.join(tmpDir, slug, 'ROOM.md');
      const content = fs.readFileSync(roomMdPath, 'utf8');
      const meta = scaffold.SECTION_METADATA[slug];
      const hasFrontmatterStatement = new RegExp('^statement: ' + escapeRe(meta.statement), 'm').test(content);
      const hasBodyBlockquote = content.includes('> ' + meta.statement);
      if (!hasFrontmatterStatement || !hasBodyBlockquote) allCarryStatement = false;
    }
    assert(allCarryStatement, 'every scaffolded section ROOM.md carries the statement in frontmatter AND as a body blockquote');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
console.log('');

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Section 4: L2 contracts (ICML-08, ICML-09, ICML-10)
// ---------------------------------------------------------------------------
console.log('Section 4: L2 contracts -- structural shape, live citations, cross-links');
{
  let allExist = true;
  for (const slug of scaffold.SECTION_NAMES) {
    if (!fs.existsSync(path.join(CONTRACTS_DIR, slug + '.md'))) allExist = false;
  }
  assert(allExist, 'a contract template exists for every slug in SECTION_NAMES');

  const MARKERS = [
    /^# .+/m,               // H1
    /^\*\*Statement:\*\*/m, // Statement line
    /^One job:/m,           // One job line
    /^## Inputs$/m,
    /^## Process$/m,
    /^## Outputs$/m,
    /^## Human check$/m,
    /^## Commands that write here$/m,
  ];

  let allHaveMarkers = true;
  let noFrontmatter = true;
  let noEmDashes = true;
  let allHaveNeverInline = true;
  let allHaveFeynmanMinto = true;
  let allTokensLive = true;
  const deadTokenOffenders = [];
  const allTemplateFiles = fs.readdirSync(CONTRACTS_DIR).filter((f) => f.endsWith('.md'));

  for (const f of allTemplateFiles) {
    const full = path.join(CONTRACTS_DIR, f);
    const content = fs.readFileSync(full, 'utf8');

    for (const marker of MARKERS) {
      if (!marker.test(content)) allHaveMarkers = false;
    }
    if (/^---\r?\n/.test(content)) noFrontmatter = false;
    // Detect via code point, not a literal em-dash character in this file's
    // own source (this repo's no-em-dash rule is about prose, not a lint
    // regex that must name the character it looks for).
    if (content.includes(String.fromCharCode(8212))) noEmDashes = false;
    if (!content.includes('Never inline content into `ROOM.md`')) allHaveNeverInline = false;

    const humanCheckMatch = content.match(/## Human check\n([\s\S]*?)(\n## |\n?$)/);
    const humanCheckBlock = humanCheckMatch ? humanCheckMatch[1] : '';
    if (!/Feynman/.test(humanCheckBlock) || !/Minto/.test(humanCheckBlock)) allHaveFeynmanMinto = false;

    const tokens = content.match(/\/mos:[a-z0-9-]+/g) || [];
    for (const t of tokens) {
      if (!LIVE_COMMANDS.has(t)) {
        allTokensLive = false;
        deadTokenOffenders.push(f + ':' + t);
      }
    }
  }

  assert(allHaveMarkers, 'every contract template has all structural markers (H1, Statement, One job, Inputs, Process, Outputs, Human check, Commands that write here)');
  assert(noFrontmatter, 'no contract template has YAML frontmatter');
  assert(noEmDashes, 'no contract template contains an em-dash');
  assert(allHaveNeverInline, 'every contract template carries the "Never inline content into ROOM.md" Outputs clause');
  assert(allHaveFeynmanMinto, 'every contract template\'s Human check names both Feynman and Minto');
  assert(allTokensLive, 'every /mos: token across all contract templates resolves live' +
    (deadTokenOffenders.length > 0 ? ' (offenders: ' + deadTokenOffenders.join(', ') + ')' : ''));

  const solutionDesign = fs.readFileSync(path.join(CONTRACTS_DIR, 'solution-design.md'), 'utf8');
  assert(solutionDesign.includes('hard to copy'), 'solution-design.md contains "hard to copy"');
  assert(solutionDesign.includes('competitive-analysis'), 'solution-design.md names competitive-analysis');

  const competitiveAnalysis = fs.readFileSync(path.join(CONTRACTS_DIR, 'competitive-analysis.md'), 'utf8');
  assert(competitiveAnalysis.includes('solution-design'), 'competitive-analysis.md names solution-design');

  const opportunityBank = fs.readFileSync(path.join(CONTRACTS_DIR, 'opportunity-bank.md'), 'utf8');
  assert(opportunityBank.includes('/mos:funding create'), 'opportunity-bank.md names /mos:funding create');

  const funding = fs.readFileSync(path.join(CONTRACTS_DIR, 'funding.md'), 'utf8');
  assert(funding.includes('[[opportunity-bank/'), 'funding.md contains [[opportunity-bank/');
  assert(funding.includes('Dilutive'), 'funding.md contains Dilutive');
  assert(funding.includes('Non-Dilutive'), 'funding.md contains Non-Dilutive');

  const tmpDir = makeTmpDir('m275-l2-');
  try {
    const result = scaffold.scaffoldRoomSkeleton(tmpDir, {});
    assert(result.contracts_created.length === scaffold.SECTION_NAMES.length,
      'contracts_created.length === SECTION_NAMES.length (' + result.contracts_created.length + '/' + scaffold.SECTION_NAMES.length + ')');
    const missingWarnings = result.warnings.filter((w) => w.startsWith('contract_template_missing:'));
    assert(missingWarnings.length === 0, 'zero contract_template_missing: warnings on a fresh scaffold');

    let allByteIdentical = true;
    for (const slug of scaffold.SECTION_NAMES) {
      const landed = fs.readFileSync(path.join(tmpDir, slug, 'CONTEXT.md'), 'utf8');
      const template = fs.readFileSync(path.join(CONTRACTS_DIR, slug + '.md'), 'utf8');
      if (landed !== template) allByteIdentical = false;
    }
    assert(allByteIdentical, 'every landed CONTEXT.md is byte-identical to its template');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
console.log('');

// ---------------------------------------------------------------------------
// Section 5: L3 references (ICML-11, ICML-12, ICML-13)
// ---------------------------------------------------------------------------
console.log('Section 5: L3 references -- SECTION-SCHEMA.md and SUB-SCHEMAS.md content + scaffold behavior');
{
  let bothExist = true;
  for (const name of scaffold.REFERENCE_DOCS) {
    if (!fs.existsSync(path.join(REFERENCES_DIR, name))) bothExist = false;
  }
  assert(bothExist, 'both REFERENCE_DOCS templates exist on disk');

  const sectionSchema = fs.readFileSync(path.join(REFERENCES_DIR, 'SECTION-SCHEMA.md'), 'utf8');
  const subSchemas = fs.readFileSync(path.join(REFERENCES_DIR, 'SUB-SCHEMAS.md'), 'utf8');

  const validStages = Object.keys(modelProfiles.STAGE_HINTS);
  let allStagesNamed = true;
  for (const stage of validStages) {
    if (!sectionSchema.includes(stage)) allStagesNamed = false;
  }
  assert(allStagesNamed, 'SECTION-SCHEMA.md names all ' + validStages.length + ' VALID_STAGES values');

  let allSlugsNamed = true;
  for (const slug of scaffold.SECTION_NAMES) {
    if (!sectionSchema.includes(slug)) allSlugsNamed = false;
  }
  assert(allSlugsNamed, 'SECTION-SCHEMA.md names all ' + scaffold.SECTION_NAMES.length + ' section slugs');

  let allFamiliesNamed = true;
  for (const fam of BLUEPRINT_FAMILY_NAMES) {
    if (!sectionSchema.includes(fam)) allFamiliesNamed = false;
  }
  assert(allFamiliesNamed, 'SECTION-SCHEMA.md names all ' + BLUEPRINT_FAMILY_NAMES.length + ' blueprint families');
  assert(sectionSchema.includes('familyActive'), 'SECTION-SCHEMA.md names familyActive');

  assert(subSchemas.includes('Discovered') && subSchemas.includes('Researched') &&
    subSchemas.includes('Applying') && subSchemas.includes('Submitted'),
    'SUB-SCHEMAS.md names all four funding stages');
  assert(subSchemas.includes('awarded') && subSchemas.includes('rejected') && subSchemas.includes('withdrawn'),
    'SUB-SCHEMAS.md names all three funding outcomes');
  assert(subSchemas.includes('Knight'), 'SUB-SCHEMAS.md names Knight');
  assert(subSchemas.includes('last_consulted'), 'SUB-SCHEMAS.md names last_consulted');

  const tmpDir = makeTmpDir('m275-l3-');
  try {
    const result = scaffold.scaffoldRoomSkeleton(tmpDir, {});
    assert(result.reference_docs_created.length === scaffold.REFERENCE_DOCS.length,
      'reference_docs_created.length === REFERENCE_DOCS.length');
    const missingWarnings = result.warnings.filter((w) => w.startsWith('reference_doc_missing:'));
    assert(missingWarnings.length === 0, 'zero reference_doc_missing: warnings on a fresh scaffold');
    assert(fs.existsSync(path.join(tmpDir, 'references', 'ROOM.md')), 'references/ROOM.md is present');

    let allByteIdentical = true;
    for (const name of scaffold.REFERENCE_DOCS) {
      const landed = fs.readFileSync(path.join(tmpDir, 'references', name), 'utf8');
      const template = fs.readFileSync(path.join(REFERENCES_DIR, name), 'utf8');
      if (landed !== template) allByteIdentical = false;
    }
    assert(allByteIdentical, 'both reference documents are byte-identical to their templates');

    const discovered = sectionRegistry.discoverSections(tmpDir);
    assert(!discovered.all.includes('references'), 'references is absent from discoverSections(room).all');

    const roomName = path.basename(tmpDir);
    let noRoomSpecificValues = true;
    for (const name of scaffold.REFERENCE_DOCS) {
      const content = fs.readFileSync(path.join(tmpDir, 'references', name), 'utf8');
      if (content.includes(roomName)) noRoomSpecificValues = false;
      if (/^venture_stage:\s*\S/m.test(content)) noRoomSpecificValues = false;
    }
    assert(noRoomSpecificValues, 'neither reference document contains the room\'s own directory name or a venture_stage: assignment line');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
console.log('');

// ---------------------------------------------------------------------------
// Section 6: L4 no-drift contract (ICML-15)
// ---------------------------------------------------------------------------
console.log('Section 6: L4 no-drift -- every contract forbids inlining, --report-drift is read-only');
{
  let allForbidInlining = true;
  const templateFiles = scaffold.SECTION_NAMES.map((s) => s + '.md');
  for (const f of templateFiles) {
    const content = fs.readFileSync(path.join(CONTRACTS_DIR, f), 'utf8');
    const hasArtifactShape = /<slug>\/<artifact-slug>\/<artifact-slug>\.md/.test(content) ||
      new RegExp(f.replace('.md', '') + '/<artifact-slug>/<artifact-slug>\\.md').test(content);
    const forbidsInline = content.includes('Never inline content into `ROOM.md`');
    if (!hasArtifactShape || !forbidsInline) allForbidInlining = false;
  }
  assert(allForbidInlining, 'every contract template\'s Outputs section states the <slug>/<artifact-slug>/<artifact-slug>.md shape and forbids inlining');

  const tmpDir = makeTmpDir('m275-l4-');
  try {
    fs.writeFileSync(path.join(tmpDir, '.room-root'), '');
    const driftedSlug = 'problem-definition';
    fs.mkdirSync(path.join(tmpDir, driftedSlug), { recursive: true });
    const longBody = 'Real drifted prose content, line by line.\n'.repeat(80);
    fs.writeFileSync(
      path.join(tmpDir, driftedSlug, 'ROOM.md'),
      '---\nsection: ' + driftedSlug + '\nstatement: X\npurpose: legacy\n---\n\n' + longBody
    );
    const before = snapshot(tmpDir);
    const result = cp.spawnSync('node', [MIGRATE_SCRIPT, tmpDir, '--report-drift'], { encoding: 'utf8' });
    assert(result.status === 0, '--report-drift exits 0 against a drifted synthetic room');
    assert(result.stdout.includes(driftedSlug), '--report-drift names the drifted section (' + driftedSlug + ') in its report');
    const after = snapshot(tmpDir);
    assert(JSON.stringify(before) === JSON.stringify(after), '--report-drift leaves the room content snapshot unchanged');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
console.log('');

// ---------------------------------------------------------------------------
// Section 7: migration (ICML-14)
// ---------------------------------------------------------------------------
console.log('Section 7: migration -- dry-run inert, real run additive, idempotent');
{
  const tmpDir = makeTmpDir('m275-mig-');
  try {
    fs.writeFileSync(path.join(tmpDir, '.room-root'), '');
    fs.mkdirSync(path.join(tmpDir, 'problem-definition'), { recursive: true });
    const humanSentinel = 'HUMAN CONTENT SENTINEL, pre-Phase-275 legacy room.';
    fs.writeFileSync(
      path.join(tmpDir, 'problem-definition', 'ROOM.md'),
      '---\nsection: problem-definition\npurpose: legacy\n---\n\n# Problem Definition\n\n' + humanSentinel + '\n'
    );
    fs.mkdirSync(path.join(tmpDir, 'opportunity-bank'), { recursive: true });
    const adhocSentinel = 'AD HOC OPPORTUNITY-BANK CONTENT, pre-Phase-275.';
    fs.writeFileSync(path.join(tmpDir, 'opportunity-bank', 'adhoc-note.md'), adhocSentinel);

    const beforeDryRun = snapshot(tmpDir);
    const dryRunResult = cp.spawnSync('node', [MIGRATE_SCRIPT, tmpDir, '--dry-run'], { encoding: 'utf8' });
    assert(dryRunResult.status === 0, '--dry-run exits 0');
    const afterDryRun = snapshot(tmpDir);
    assert(JSON.stringify(beforeDryRun) === JSON.stringify(afterDryRun), '--dry-run is provably inert (snapshot unchanged)');

    const realRun = cp.spawnSync('node', [MIGRATE_SCRIPT, tmpDir], { encoding: 'utf8' });
    assert(realRun.status === 0, 'a real migration run exits 0: ' + realRun.stderr);

    let allSectionsPresent = true;
    for (const slug of scaffold.SECTION_NAMES) {
      if (!fs.existsSync(path.join(tmpDir, slug, 'ROOM.md'))) allSectionsPresent = false;
      if (!fs.existsSync(path.join(tmpDir, slug, 'CONTEXT.md'))) allSectionsPresent = false;
    }
    for (const name of scaffold.REFERENCE_DOCS) {
      if (!fs.existsSync(path.join(tmpDir, 'references', name))) allSectionsPresent = false;
    }
    assert(allSectionsPresent, 'one real run brings the room to the full 11-section L0/L1/L2/L3 shape');

    const survivedContent = fs.readFileSync(path.join(tmpDir, 'problem-definition', 'ROOM.md'), 'utf8');
    assert(survivedContent.includes(humanSentinel), 'human content in problem-definition/ROOM.md survives byte-for-byte');
    const survivedAdhoc = fs.readFileSync(path.join(tmpDir, 'opportunity-bank', 'adhoc-note.md'), 'utf8');
    assert(survivedAdhoc === adhocSentinel, 'ad-hoc opportunity-bank content survives untouched');

    const afterFirstRun = snapshot(tmpDir);
    const secondRun = cp.spawnSync('node', [MIGRATE_SCRIPT, tmpDir], { encoding: 'utf8' });
    assert(secondRun.status === 0, 'a second migration run exits 0');
    const afterSecondRun = snapshot(tmpDir);
    assert(JSON.stringify(afterFirstRun) === JSON.stringify(afterSecondRun), 'a second run is byte-identical to the first');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
console.log('');

// ---------------------------------------------------------------------------
// Section 8: do-not-regress
// ---------------------------------------------------------------------------
console.log('Section 8: do-not-regress -- scaffold ok:true, warnings/errors separation, table coverage');
{
  const tmpDir = makeTmpDir('m275-regress-');
  try {
    const result = scaffold.scaffoldRoomSkeleton(tmpDir, {});
    assert(result.ok === true, 'scaffoldRoomSkeleton still returns ok:true on a fresh room');
    assert(result.ok === (result.errors.length === 0), 'result.ok is computed purely from errors.length === 0');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  const metaKeys = new Set(Object.keys(scaffold.SECTION_METADATA));
  const nameSet = new Set(scaffold.SECTION_NAMES);
  let noKeyMissingEitherWay = true;
  for (const n of nameSet) if (!metaKeys.has(n)) noKeyMissingEitherWay = false;
  for (const k of metaKeys) if (!nameSet.has(k)) noKeyMissingEitherWay = false;
  assert(noKeyMissingEitherWay, 'SECTION_METADATA covers SECTION_NAMES with no key missing either way');
}
console.log('');

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------
console.log('[test-275-section-schema] ' + (PASSED + FAILED) + ' assertions ran');
console.log('[test-275-section-schema] ' + PASSED + '/' + (PASSED + FAILED) + ' PASS');

if (FAILED > 0) {
  console.error('[test-275-section-schema] ' + FAILED + ' FAIL');
  process.exit(1);
}
process.exit(0);
