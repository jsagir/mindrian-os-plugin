#!/usr/bin/env node
'use strict';

/*
 * Phase 270-03 Task 2 -- RED pin for discoverIcmForest's four-class
 * classification contract, the blueprint-subset tolerance, and the
 * structure-only payload rule (RESEARCH.md 3.1.0, Pitfall P4c).
 *
 * A flat directory list misrepresents the room; at least four classes
 * exist with different discovery semantics: canonical_section (the frozen
 * 8, or a validated subset), identity_directory (the 5 non-ICM ROOM.md
 * directories), structural_directory (meetings/team -- populated but
 * invisible to section discovery by design), and discovered
 * (beyond-baseline, unregistered, never auto-promoted).
 *
 * RED until plan 270-07 (lib/core/icm-forest.cjs does not exist yet).
 *
 * No em-dashes. CJS only. No new deps.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const ICM_FOREST_PATH = path.join(REPO_ROOT, 'lib', 'core', 'icm-forest.cjs');

const { SECTION_NAMES, IDENTITY_DIRECTORIES } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-skeleton-scaffold.cjs'));
const { STRUCTURAL_DIRS } = require(path.join(REPO_ROOT, 'lib', 'core', 'section-registry.cjs'));

// The pinned four-class contract. Plan 270-07 must export this EXACT frozen
// array from lib/core/icm-forest.cjs; the test asserts the module's export
// deep-equals this local copy, so the contract is stated in exactly two
// places and drift is caught.
const DIRECTORY_CLASSES = ['canonical_section', 'identity_directory', 'structural_directory', 'discovered'];

const ALLOWED_KEYS = ['slug', 'path', 'relPath', 'depth', 'class', 'hasRoomDb', 'registered', 'name', 'children'];

function requireForest() {
  try {
    return require(ICM_FOREST_PATH);
  } catch (e) {
    throw new Error('lib/core/icm-forest.cjs does not exist yet (plan 270-07) - RED by design. Underlying: ' + e.message);
  }
}

function cleanupDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
}

// makeFixtureForest() -- two rooms under a hermetic MINDRIAN_ROOMS_HOME.
function makeFixtureForest() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), '270-forest-'));

  // Room alpha: a FULL room.
  const alphaDir = path.join(home, 'alpha');
  fs.mkdirSync(alphaDir, { recursive: true });
  fs.writeFileSync(path.join(alphaDir, '.room-root'), JSON.stringify({ slug: 'alpha' }));
  fs.writeFileSync(path.join(alphaDir, 'STATE.md'), '# State\n');
  for (const name of SECTION_NAMES) {
    const d = path.join(alphaDir, name);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'ROOM.md'), '# section\n');
    fs.writeFileSync(path.join(d, 'STATE.md'), '# state\n');
  }
  for (const name of Object.keys(IDENTITY_DIRECTORIES)) {
    const d = path.join(alphaDir, name);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'ROOM.md'), '# identity\n');
  }
  const meetingsDir = path.join(alphaDir, 'meetings');
  fs.mkdirSync(meetingsDir, { recursive: true });
  fs.writeFileSync(path.join(meetingsDir, 'notes.md'), '# notes\n');
  // Hidden junk directory: must never appear in the returned forest.
  const scratchDir = path.join(alphaDir, '.scratch');
  fs.mkdirSync(scratchDir, { recursive: true });
  fs.writeFileSync(path.join(scratchDir, 'x.md'), '# scratch\n');

  // Room beta: a SUBSET room. Only three of the imported SECTION_NAMES, by
  // index (never restating a name).
  const betaDir = path.join(home, 'beta');
  fs.mkdirSync(betaDir, { recursive: true });
  fs.writeFileSync(path.join(betaDir, '.room-root'), JSON.stringify({ slug: 'beta' }));
  fs.writeFileSync(path.join(betaDir, 'STATE.md'), '# State\n');
  const subsetIdx = [0, 2, 5];
  for (const idx of subsetIdx) {
    const name = SECTION_NAMES[idx];
    const d = path.join(betaDir, name);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'ROOM.md'), '# section\n');
    fs.writeFileSync(path.join(d, 'STATE.md'), '# state\n');
  }
  // custom-lab: discovered-beyond-baseline, unregistered (no .room-root).
  const customLabDir = path.join(betaDir, 'custom-lab');
  fs.mkdirSync(customLabDir, { recursive: true });
  fs.writeFileSync(path.join(customLabDir, 'ROOM.md'), '# custom lab\n');
  fs.writeFileSync(path.join(customLabDir, 'note1.md'), '# note1\n');
  fs.writeFileSync(path.join(customLabDir, 'note2.md'), '# note2\n');

  return { home, alphaDir, betaDir, subsetCount: subsetIdx.length };
}

function flattenNodes(result) {
  const out = [];
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    out.push(node);
    if (Array.isArray(node.children)) node.children.forEach(walk);
  }
  if (result && Array.isArray(result.rooms)) result.rooms.forEach(walk);
  else if (result && Array.isArray(result.nodes)) result.nodes.forEach(walk);
  return out;
}

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-270-tree-classification');

const fixture = makeFixtureForest();
const savedHome = process.env.MINDRIAN_ROOMS_HOME;
process.env.MINDRIAN_ROOMS_HOME = fixture.home;

try {
  ok('DIRECTORY_CLASSES is exported frozen and matches the pinned four-class contract', function () {
    const forest = requireForest();
    assert.ok(Object.isFrozen(forest.DIRECTORY_CLASSES), 'DIRECTORY_CLASSES must be Object.frozen');
    assert.deepStrictEqual(
      Array.from(forest.DIRECTORY_CLASSES),
      DIRECTORY_CLASSES,
      'DIRECTORY_CLASSES drifted from the pinned four-class contract'
    );
  });

  ok('every returned node carries exactly one class, drawn from DIRECTORY_CLASSES', function () {
    const forest = requireForest();
    const result = forest.discoverIcmForest({ home: fixture.home });
    const nodes = flattenNodes(result);
    if (nodes.length < 10) throw new Error('harness never reached real data: only ' + nodes.length + ' nodes');
    for (const node of nodes) {
      assert.ok(typeof node.class === 'string', 'node missing a class field: ' + JSON.stringify(node).slice(0, 120));
      assert.ok(DIRECTORY_CLASSES.includes(node.class), 'node carries an unknown class: ' + node.class);
      const classFieldCount = Object.keys(node).filter((k) => /class/i.test(k)).length;
      assert.equal(classFieldCount, 1, 'node carries more than one class-ish field: ' + JSON.stringify(node));
    }
  });

  ok('the canonical / identity / structural split is imported, not guessed', function () {
    const forest = requireForest();
    const result = forest.discoverIcmForest({ home: fixture.home });
    const nodes = flattenNodes(result);
    const byName = new Map(nodes.map((node) => [node.name || (node.relPath || '').split('/').pop(), node]));

    for (const section of SECTION_NAMES) {
      const node = byName.get(section);
      if (node && node.path && node.path.indexOf(fixture.alphaDir) === 0) {
        assert.equal(node.class, 'canonical_section', section + ' should classify as canonical_section');
      }
    }
    for (const dirName of Object.keys(IDENTITY_DIRECTORIES)) {
      if (STRUCTURAL_DIRS.includes(dirName)) continue;
      const node = byName.get(dirName);
      if (node) assert.equal(node.class, 'identity_directory', dirName + ' should classify as identity_directory');
    }
    const meetingsNode = byName.get('meetings');
    assert.ok(meetingsNode, 'meetings directory did not appear in the forest');
    assert.equal(meetingsNode.class, 'structural_directory', 'meetings should classify as structural_directory');
  });

  ok('team resolves to exactly one class, deterministically, and the rule is stated', function () {
    // PRECEDENCE RULE this phase pins: STRUCTURAL_DIRS wins over
    // IDENTITY_DIRECTORIES for a name that appears in both (today, only
    // 'team'), because discoverSections skipping it is the stronger,
    // behaviour-visible fact. Plan 270-07 implements this rule rather than
    // inventing its own.
    assert.ok(STRUCTURAL_DIRS.includes('team') && Object.prototype.hasOwnProperty.call(IDENTITY_DIRECTORIES, 'team'));
    const forest = requireForest();
    const result = forest.discoverIcmForest({ home: fixture.home });
    const nodes = flattenNodes(result);
    const teamNodes = nodes.filter((node) => (node.name || (node.relPath || '').split('/').pop()) === 'team');
    assert.equal(teamNodes.length, 1, 'team must appear exactly once in the flattened node list');
    assert.equal(teamNodes[0].class, 'structural_directory', 'team must classify as structural_directory (STRUCTURAL_DIRS wins)');
  });

  ok('a blueprint-subset room is a NORMAL room, never an error', function () {
    const forest = requireForest();
    const result = forest.discoverIcmForest({ home: fixture.home });
    assert.equal(result.ok, true, 'top-level result must have ok: true');
    const betaRoom = (result.rooms || []).find((r) => r.slug === 'beta');
    assert.ok(betaRoom, 'beta room not present in the forest result');
    assert.ok(!betaRoom.error, 'beta room must not carry an error field');
    assert.ok(!betaRoom.defect, 'beta room must not carry a defect field');
    assert.ok(!Object.prototype.hasOwnProperty.call(betaRoom, 'missing_sections'), 'beta room must not carry missing_sections');
    assert.notEqual(betaRoom.ok, false, 'beta room must not carry ok: false');

    const betaNodes = flattenNodes({ rooms: [betaRoom] });
    const canonicalCount = betaNodes.filter((node) => node.class === 'canonical_section').length;
    assert.equal(canonicalCount, fixture.subsetCount, 'beta must show exactly its subset count of canonical_section nodes');
    assert.notEqual(canonicalCount, SECTION_NAMES.length, 'beta must not be padded up to the full SECTION_NAMES count');
  });

  ok('the payload is identity and structure only, never file bodies, and hidden dirs never appear', function () {
    const forest = requireForest();
    const result = forest.discoverIcmForest({ home: fixture.home });
    const nodes = flattenNodes(result);

    for (const node of nodes) {
      for (const key of Object.keys(node)) {
        assert.ok(ALLOWED_KEYS.includes(key), 'node carries a disallowed key "' + key + '": ' + JSON.stringify(node).slice(0, 160));
      }
      for (const value of Object.values(node)) {
        if (typeof value === 'string') {
          assert.ok(value.length <= 512, 'a node string value exceeds 512 chars (possible file-body leak): ' + value.slice(0, 80));
        }
      }
    }

    const customLabNode = nodes.find((node) => (node.name || (node.relPath || '').split('/').pop()) === 'custom-lab');
    assert.ok(customLabNode, 'custom-lab (discovered, unregistered) did not appear in the forest');
    assert.equal(customLabNode.registered, false, 'custom-lab must be registered: false, never auto-promoted');

    const scratchNode = nodes.find((node) => (node.name || (node.relPath || '').split('/').pop()) === '.scratch');
    assert.ok(!scratchNode, 'hidden .scratch directory must never appear in the forest');
  });
} finally {
  if (savedHome === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
  else process.env.MINDRIAN_ROOMS_HOME = savedHome;
  cleanupDir(fixture.home);
}

console.log('\nPASS test-270-tree-classification (' + n + ' assertions)');
