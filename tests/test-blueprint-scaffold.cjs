#!/usr/bin/env node
'use strict';

/*
 * Phase 155-05 Task 2 (TDD RED) -- test-blueprint-scaffold.cjs
 *
 * Exercises the blueprintFamily extension to scaffoldRoomSkeleton:
 *   (1) exploration family creates only the exploration section set
 *   (2) venture family reproduces the frozen SECTION_NAMES 8 (backwards compat)
 *   (3) unknown family falls back gracefully to frozen SECTION_NAMES
 *   (4) portfolio family writes ROOM.md default_methodologies from the family
 *   (5) static: blueprintFamily appears in commands/new-project.md
 *   (6) static: B1 / STARTING POINT gate appears in commands/new-project.md
 *
 * TDD RED: these tests FAIL until Task 2 GREEN implementation is in place.
 * Canon Part 8: pure local -- no network, no Brain, no DB.
 */

const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCAFFOLD_PATH = path.join(REPO_ROOT, 'lib', 'core', 'room-skeleton-scaffold.cjs');
const BLUEPRINTS_PATH = path.join(REPO_ROOT, 'data', 'room-blueprints.json');
const NEW_PROJECT_PATH = path.join(REPO_ROOT, 'commands', 'new-project.md');

// SKIP-77 for environments where node:sqlite is unavailable (mirrors run-all-155.sh).
// This test does not use sqlite but uses the same SKIP signal for consistency.
const SKIP_SIGNAL = 77;

function pass(msg) { console.log('  PASS: ' + msg); }
function fail(msg) { console.error('  FAIL: ' + msg); }

let PASSED = 0;
let FAILED = 0;

function assert(condition, msg) {
  if (condition) { pass(msg); PASSED++; }
  else { fail(msg); FAILED++; }
}

// Create a temporary directory for each test.
function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-bp-test-'));
}

// Load the scaffold module (cleared from require cache each call to ensure
// mutation in one test does not pollute another; but since we do not modify the
// module, a single load suffices).
let scaffold;
try {
  scaffold = require(SCAFFOLD_PATH);
} catch (e) {
  console.error('[test-blueprint-scaffold] Cannot require scaffold: ' + e.message);
  process.exit(1);
}

let blueprints;
try {
  blueprints = JSON.parse(fs.readFileSync(BLUEPRINTS_PATH, 'utf8'));
} catch (e) {
  console.error('[test-blueprint-scaffold] Cannot read room-blueprints.json: ' + e.message);
  process.exit(1);
}

const newProjectSrc = (() => {
  try { return fs.readFileSync(NEW_PROJECT_PATH, 'utf8'); }
  catch (_) { return ''; }
})();

console.log('[test-blueprint-scaffold] Phase 155-05 Task 2 -- blueprintFamily consumption');
console.log('');

// ---------------------------------------------------------------------------
// Section 1: exploration family creates a different section set than the frozen 8
// ---------------------------------------------------------------------------
console.log('Section 1: exploration family creates exploration sections (not frozen 8)');
{
  const tmpDir = makeTmpDir();
  const result = scaffold.scaffoldRoomSkeleton(tmpDir, { blueprintFamily: 'exploration' });
  const explorationSections = blueprints.exploration.sections;
  const frozenSections = Array.from(scaffold.SECTION_NAMES);

  // At least one exploration section should have been created.
  const anyCreated = result.sections_created.length > 0 || explorationSections.some(
    (s) => fs.existsSync(path.join(tmpDir, s))
  );
  assert(anyCreated, 'exploration: at least one section directory exists');

  // Every created section dir should be in the exploration family sections (not all 8 frozen).
  const dirsPresent = explorationSections.filter((s) => fs.existsSync(path.join(tmpDir, s)));
  assert(dirsPresent.length === explorationSections.length,
    'exploration: all ' + explorationSections.length + ' exploration sections present');

  // Sections NOT in exploration should NOT exist (the family is a SUBSET of 8).
  const sectionsOnlyInFrozen = frozenSections.filter((s) => !explorationSections.includes(s));
  const unexpectedDirs = sectionsOnlyInFrozen.filter((s) => fs.existsSync(path.join(tmpDir, s)));
  assert(unexpectedDirs.length === 0,
    'exploration: sections outside the exploration family are absent (' +
      sectionsOnlyInFrozen.join(',') + ')');

  // Clean up.
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
console.log('');

// ---------------------------------------------------------------------------
// Section 2: venture family reproduces the frozen 8 (backwards compat)
// ---------------------------------------------------------------------------
console.log('Section 2: venture family reproduces frozen SECTION_NAMES (backwards compat)');
{
  const tmpVenture = makeTmpDir();
  const tmpNoFamily = makeTmpDir();

  scaffold.scaffoldRoomSkeleton(tmpVenture, { blueprintFamily: 'venture' });
  scaffold.scaffoldRoomSkeleton(tmpNoFamily, {});

  const frozenSections = Array.from(scaffold.SECTION_NAMES);

  // Both dirs should have the same 8 ICM section directories.
  const ventureHas = frozenSections.filter((s) => fs.existsSync(path.join(tmpVenture, s)));
  const noFamilyHas = frozenSections.filter((s) => fs.existsSync(path.join(tmpNoFamily, s)));

  assert(ventureHas.length === frozenSections.length,
    'venture: all ' + frozenSections.length + ' frozen sections present');
  assert(noFamilyHas.length === frozenSections.length,
    'no-family: all ' + frozenSections.length + ' frozen sections present');
  assert(JSON.stringify(ventureHas.sort()) === JSON.stringify(noFamilyHas.sort()),
    'venture family produces same sections as no-blueprintFamily call');

  fs.rmSync(tmpVenture, { recursive: true, force: true });
  fs.rmSync(tmpNoFamily, { recursive: true, force: true });
}
console.log('');

// ---------------------------------------------------------------------------
// Section 3: unknown family falls back to frozen SECTION_NAMES (graceful)
// ---------------------------------------------------------------------------
console.log('Section 3: unknown family falls back to frozen SECTION_NAMES gracefully');
{
  const tmpDir = makeTmpDir();
  const result = scaffold.scaffoldRoomSkeleton(tmpDir, { blueprintFamily: 'totally-unknown-xyz' });
  const frozenSections = Array.from(scaffold.SECTION_NAMES);

  assert(result.ok, 'unknown-family: scaffoldRoomSkeleton returns {ok:true}');

  const frozenDirs = frozenSections.filter((s) => fs.existsSync(path.join(tmpDir, s)));
  assert(frozenDirs.length === frozenSections.length,
    'unknown-family: all ' + frozenSections.length + ' frozen sections present (fallback)');

  fs.rmSync(tmpDir, { recursive: true, force: true });
}
console.log('');

// ---------------------------------------------------------------------------
// Section 4: portfolio family ROOM.md contains default_methodologies from family
// ---------------------------------------------------------------------------
console.log('Section 4: portfolio family writes ROOM.md with find-connections in default_methodologies');
{
  const tmpDir = makeTmpDir();
  scaffold.scaffoldRoomSkeleton(tmpDir, { blueprintFamily: 'portfolio' });

  const portfolioSections = blueprints.portfolio.sections;
  const portfolioMethodologies = blueprints.portfolio.default_methodologies;
  assert(portfolioMethodologies.includes('find-connections'),
    'portfolio blueprints data: default_methodologies contains find-connections');

  // Find a ROOM.md that should have find-connections in default_methodologies.
  // The scaffold writes ROOM.md per section. Check at least one contains find-connections.
  let foundFindConnections = false;
  for (const s of portfolioSections) {
    const roomMdPath = path.join(tmpDir, s, 'ROOM.md');
    if (fs.existsSync(roomMdPath)) {
      const content = fs.readFileSync(roomMdPath, 'utf8');
      if (content.includes('find-connections')) {
        foundFindConnections = true;
        break;
      }
    }
  }
  assert(foundFindConnections,
    'portfolio: at least one section ROOM.md contains find-connections in default_methodologies');

  fs.rmSync(tmpDir, { recursive: true, force: true });
}
console.log('');

// ---------------------------------------------------------------------------
// Section 5: static -- blueprintFamily appears in commands/new-project.md
// ---------------------------------------------------------------------------
console.log('Section 5: static -- blueprintFamily in commands/new-project.md');
{
  const count = (newProjectSrc.match(/blueprintFamily/g) || []).length;
  assert(count >= 1, 'commands/new-project.md contains blueprintFamily (count=' + count + ')');
}
console.log('');

// ---------------------------------------------------------------------------
// Section 6: static -- B1 gate / STARTING POINT in commands/new-project.md
// ---------------------------------------------------------------------------
console.log('Section 6: static -- B1 gate / STARTING POINT in commands/new-project.md');
{
  const hasB1 = /\bB1\b/.test(newProjectSrc);
  const hasStartingPoint = /STARTING POINT/i.test(newProjectSrc);
  assert(hasB1 || hasStartingPoint,
    'commands/new-project.md contains B1 or STARTING POINT (B1=' + hasB1 + ' SP=' + hasStartingPoint + ')');
}
console.log('');

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------
console.log('[test-blueprint-scaffold] ' + (PASSED + FAILED) + '/' + (PASSED + FAILED) + ' ran');
console.log('[test-blueprint-scaffold] ' + PASSED + '/' + (PASSED + FAILED) + ' PASS');

if (FAILED > 0) {
  console.error('[test-blueprint-scaffold] ' + FAILED + ' FAIL');
  process.exit(1);
}
process.exit(0);
