'use strict';
/*
 * Phase 119-02 Task 2 -- test suite for room-skeleton-scaffold.cjs.
 *
 * Verifies the 14 behaviors from
 * .planning/phases/119-room-as-receipt-invariant/119-02-PLAN.md Task 2.
 *
 * Each test uses an isolated tmp roomDir via os.tmpdir() + crypto-random
 * suffix; tear-down via fs.rmSync(.., {recursive:true, force:true}).
 *
 * Canon Part 8 invariant: zero Brain MCP coupling (Test 12).
 * Canon Part 9 invariant: zero room-db.cjs require (Test 13 -- this module
 *   writes files only; memory_event emission stays in Plan 119-00 + 119-01).
 * Em-dash HARD RULE: zero `--` chars in source (Test 14).
 */

const assert = require('node:assert');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const {
  scaffoldRoomSkeleton,
  SECTION_NAMES,
  SECTION_METADATA,
  IDENTITY_DIRECTORIES,
  renderTemplate,
  isStateAuthored,
} = require('./room-skeleton-scaffold.cjs');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

function makeTmpRoom() {
  const dir = path.join(os.tmpdir(), 'phase119-02-' + crypto.randomBytes(4).toString('hex'));
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  // Mark as placeholder room (matches Plan 119-00 contract).
  fs.writeFileSync(path.join(dir, '.room-root'), '');
  return dir;
}

function rmTmp(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
}

test('Test 1: all SECTION_NAMES sections present after scaffolding', () => {
  const roomDir = makeTmpRoom();
  try {
    const r = scaffoldRoomSkeleton(roomDir, {});
    assert.strictEqual(r.ok, true, 'scaffold did not return ok');
    for (const section of SECTION_NAMES) {
      const sectionDir = path.join(roomDir, section);
      const roomMd = path.join(sectionDir, 'ROOM.md');
      assert.ok(fs.existsSync(sectionDir), `missing section dir: ${section}`);
      assert.ok(fs.existsSync(roomMd), `missing ROOM.md in ${section}/`);
    }
  } finally { rmTmp(roomDir); }
});

test('Test 2: non-ICM identity directories present with ROOM.md (Canon decision 15)', () => {
  const roomDir = makeTmpRoom();
  try {
    scaffoldRoomSkeleton(roomDir, {});
    const identityDirs = ['team', 'assets', '.intelligence', '.snapshots', '.context'];
    for (const d of identityDirs) {
      const dirPath = path.join(roomDir, d);
      const roomMd = path.join(dirPath, 'ROOM.md');
      assert.ok(fs.existsSync(dirPath), `missing identity dir: ${d}`);
      assert.ok(fs.existsSync(roomMd), `missing ROOM.md in ${d}/`);
    }
  } finally { rmTmp(roomDir); }
});

test('Test 3: STATE.md rendered with substitutions', () => {
  const roomDir = makeTmpRoom();
  try {
    scaffoldRoomSkeleton(roomDir, {
      placeholder_slug: 'untitled-test-slug',
      source_material_id: 'deadbeefcafef00d',
    });
    const state = fs.readFileSync(path.join(roomDir, 'STATE.md'), 'utf8');
    assert.match(state, /phase: scoping/, 'phase scoping not rendered');
    assert.match(state, /journey_stage: ordinary-world/, 'journey_stage not rendered');
    assert.match(state, /placeholder_slug: 'untitled-test-slug'/, 'placeholder_slug substitution failed');
    assert.match(state, /source_material_id: 'deadbeefcafef00d'/, 'source_material_id substitution failed');
  } finally { rmTmp(roomDir); }
});

test('Test 4: MINTO.md is sentinel-bounded', () => {
  const roomDir = makeTmpRoom();
  try {
    scaffoldRoomSkeleton(roomDir, {});
    const minto = fs.readFileSync(path.join(roomDir, 'MINTO.md'), 'utf8');
    assert.ok(minto.includes('<!-- mos:minto-begin -->'), 'missing minto-begin sentinel');
    assert.ok(minto.includes('<!-- mos:minto-end -->'), 'missing minto-end sentinel');
  } finally { rmTmp(roomDir); }
});

test('Test 5: USER.md present with non-zero size', () => {
  const roomDir = makeTmpRoom();
  try {
    scaffoldRoomSkeleton(roomDir, {});
    const userPath = path.join(roomDir, 'USER.md');
    assert.ok(fs.existsSync(userPath), 'USER.md not created');
    const stat = fs.statSync(userPath);
    assert.ok(stat.size > 0, 'USER.md is empty');
  } finally { rmTmp(roomDir); }
});

test('Test 6: per-section ROOM.md has YAML frontmatter with required fields', () => {
  const roomDir = makeTmpRoom();
  try {
    scaffoldRoomSkeleton(roomDir, {});
    const content = fs.readFileSync(path.join(roomDir, 'problem-definition', 'ROOM.md'), 'utf8');
    const m = content.match(/^---\n([\s\S]*?)\n---/);
    assert.ok(m, 'no frontmatter delimiter');
    const fm = m[1];
    assert.match(fm, /section: problem-definition/, 'section field missing');
    assert.match(fm, /purpose:/, 'purpose field missing');
    assert.match(fm, /stage_relevance:/, 'stage_relevance missing');
    assert.match(fm, /default_methodologies:/, 'default_methodologies missing');
    assert.match(fm, /icm_layer: 0/, 'icm_layer 0 missing');
    assert.match(fm, /auto_scaffolded: true/, 'auto_scaffolded missing');
  } finally { rmTmp(roomDir); }
});

test('Test 7: each section has section-matching ROOM.md identity', () => {
  const roomDir = makeTmpRoom();
  try {
    scaffoldRoomSkeleton(roomDir, {});
    for (const section of SECTION_NAMES) {
      const content = fs.readFileSync(path.join(roomDir, section, 'ROOM.md'), 'utf8');
      assert.match(content, new RegExp('section: ' + section), `wrong section identity in ${section}/ROOM.md`);
    }
  } finally { rmTmp(roomDir); }
});

test('Test 8: REENTRANCY -- human-authored STATE.md preserved across re-invocation', () => {
  const roomDir = makeTmpRoom();
  try {
    // Pre-author STATE.md with auto_created: false (human signal).
    const humanState = '---\nphase: validation\nauto_created: false\nventure_name: my-venture\n---\n\n# Human STATE\n';
    fs.writeFileSync(path.join(roomDir, 'STATE.md'), humanState);
    const before = fs.readFileSync(path.join(roomDir, 'STATE.md'), 'utf8');

    // Capture stderr to verify the skip message.
    const origWrite = process.stderr.write.bind(process.stderr);
    let stderrCapture = '';
    process.stderr.write = (chunk) => { stderrCapture += String(chunk); return true; };
    try {
      const r = scaffoldRoomSkeleton(roomDir, {});
      const after = fs.readFileSync(path.join(roomDir, 'STATE.md'), 'utf8');
      assert.strictEqual(after, before, 'human-authored STATE.md was overwritten');
      assert.strictEqual(r.state_written, false, 'state_written should be false on skip path');
      assert.ok(stderrCapture.includes('STATE.md already authored'), 'expected skip message on stderr');
      // Sections + identity files STILL created (idempotent fill).
      assert.ok(fs.existsSync(path.join(roomDir, 'problem-definition', 'ROOM.md')), 'sections not filled on re-entry');
    } finally {
      process.stderr.write = origWrite;
    }
  } finally { rmTmp(roomDir); }
});

test('Test 9: atomic-write idiom -- tmp file removed on success (no leftover .tmp files)', () => {
  const roomDir = makeTmpRoom();
  try {
    scaffoldRoomSkeleton(roomDir, {});
    // Walk roomDir; no .tmp.* files should remain.
    const walk = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const results = [];
      for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) results.push(...walk(p));
        else results.push(p);
      }
      return results;
    };
    const files = walk(roomDir);
    const leftovers = files.filter(f => /\.tmp\./.test(f));
    assert.strictEqual(leftovers.length, 0, `leftover tmp files: ${leftovers.join(',')}`);
  } finally { rmTmp(roomDir); }
});

test('Test 10: return shape has all expected fields', () => {
  const roomDir = makeTmpRoom();
  try {
    const r = scaffoldRoomSkeleton(roomDir, {});
    assert.ok(Object.prototype.hasOwnProperty.call(r, 'ok'));
    assert.ok(Object.prototype.hasOwnProperty.call(r, 'sections_created'));
    assert.ok(Object.prototype.hasOwnProperty.call(r, 'identity_files_created'));
    assert.ok(Object.prototype.hasOwnProperty.call(r, 'state_written'));
    assert.ok(Object.prototype.hasOwnProperty.call(r, 'minto_written'));
    assert.ok(Object.prototype.hasOwnProperty.call(r, 'user_written'));
    assert.ok(Object.prototype.hasOwnProperty.call(r, 'thinness_acknowledged'));
    assert.ok(Array.isArray(r.sections_created));
    assert.ok(Array.isArray(r.identity_files_created));
    assert.strictEqual(typeof r.state_written, 'boolean');
    assert.strictEqual(typeof r.minto_written, 'boolean');
    assert.strictEqual(typeof r.user_written, 'boolean');
    assert.strictEqual(typeof r.thinness_acknowledged, 'boolean');
  } finally { rmTmp(roomDir); }
});

test('Test 11: thinness pass-through -- null finding => thinness_acknowledged true', () => {
  const roomDir = makeTmpRoom();
  try {
    const r = scaffoldRoomSkeleton(roomDir, { auto_explore_finding: null });
    assert.strictEqual(r.thinness_acknowledged, true);
  } finally { rmTmp(roomDir); }

  const roomDir2 = makeTmpRoom();
  try {
    const substantive = { findings: [{ source_pipeline: 'whitespace', hsi_score: 0.7 }, { source_pipeline: 'cross-domain', hsi_score: 0.6 }] };
    const r = scaffoldRoomSkeleton(roomDir2, { auto_explore_finding: substantive });
    assert.strictEqual(r.thinness_acknowledged, false);
  } finally { rmTmp(roomDir2); }
});

test('Test 12: no Brain MCP coupling in scaffold module', () => {
  const src = fs.readFileSync(path.join(PROJECT_ROOT, 'lib', 'core', 'room-skeleton-scaffold.cjs'), 'utf8');
  assert.ok(!/require\([^)]*brain-client/.test(src), 'brain-client require found');
  assert.ok(!/fetch\([^)]*brain\.mindrian/.test(src), 'brain.mindrian fetch found');
});

test('Test 13: no direct room-db.cjs require (Canon Part 9 chokepoint preserved)', () => {
  const src = fs.readFileSync(path.join(PROJECT_ROOT, 'lib', 'core', 'room-skeleton-scaffold.cjs'), 'utf8');
  assert.ok(!/require\([^)]*room-db\.cjs/.test(src), 'room-db.cjs require found');
});

test('Test 14: em-dash invariant -- zero U+2014 in source files', () => {
  // Construct the em-dash via charCode so this test file itself does not
  // contain the literal char (which would self-trip the invariant).
  const EMDASH = String.fromCharCode(0x2014);
  const sources = [
    path.join(PROJECT_ROOT, 'lib', 'core', 'room-skeleton-scaffold.cjs'),
    path.join(PROJECT_ROOT, 'lib', 'core', 'room-skeleton-scaffold.test.cjs'),
  ];
  for (const file of sources) {
    const src = fs.readFileSync(file, 'utf8');
    assert.ok(!src.includes(EMDASH), 'em-dash U+2014 found in ' + file);
  }
});

// Phase 275 -- this is the ONE sanctioned home of the exactly-N count
// assertions. tests/test-270-baseline-schema-driven.cjs baseline.3 names
// THIS FILE AND LINE by its own failure message and will fail if a second
// copy of these literals appears anywhere else in the repo. Precedents:
// Phase 155-05 froze the count at 8; Phase 179-04 moved the FAMILY count
// (blueprint families, a different table) 8 to 9; Phase 275 moved the
// section count 8 to 11 and the identity-directory count 5 to 6. Do not
// copy these two literals into any other file -- derive instead
// (SECTION_NAMES.length / Object.keys(IDENTITY_DIRECTORIES).length).
test('Bonus Test 15: SECTION_NAMES has exactly 11 entries; IDENTITY_DIRECTORIES has exactly 6', () => {
  assert.strictEqual(SECTION_NAMES.length, 11, 'SECTION_NAMES not 11');
  assert.strictEqual(Object.keys(IDENTITY_DIRECTORIES).length, 6, 'IDENTITY_DIRECTORIES not 6');
});

test('Bonus Test 16: renderTemplate substitutes {{KEY}} tokens correctly', () => {
  const out = renderTemplate('hello {{NAME}}, you are {{ROLE}}.', { NAME: 'Larry', ROLE: 'pedagogical guide' });
  assert.strictEqual(out, 'hello Larry, you are pedagogical guide.');
});

test('Bonus Test 17: isStateAuthored detects auto_created:false in frontmatter', () => {
  const roomDir = makeTmpRoom();
  try {
    // auto_created:true => not authored (auto-scaffold output)
    fs.writeFileSync(path.join(roomDir, 'STATE.md'), '---\nphase: scoping\nauto_created: true\n---\n');
    assert.strictEqual(isStateAuthored(roomDir), false);

    // auto_created:false => authored (human override)
    fs.writeFileSync(path.join(roomDir, 'STATE.md'), '---\nphase: validation\nauto_created: false\n---\n');
    assert.strictEqual(isStateAuthored(roomDir), true);

    // No auto_created key => treat as authored (human authored from scratch)
    fs.writeFileSync(path.join(roomDir, 'STATE.md'), '---\nphase: validation\n---\n');
    assert.strictEqual(isStateAuthored(roomDir), true);
  } finally { rmTmp(roomDir); }
});

test('Bonus Test 18: invalid roomDir returns ok:false with error', () => {
  const r = scaffoldRoomSkeleton('/this/path/definitely/does/not/exist/xyzpdq', {});
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.includes('room_dir_does_not_exist'));
});

test('Bonus Test 19: SECTION_METADATA covers all sections', () => {
  for (const section of SECTION_NAMES) {
    assert.ok(SECTION_METADATA[section], `missing metadata for ${section}`);
    assert.ok(SECTION_METADATA[section].purpose, `missing purpose for ${section}`);
    assert.ok(Array.isArray(SECTION_METADATA[section].stage_relevance), `stage_relevance not array for ${section}`);
    assert.ok(Array.isArray(SECTION_METADATA[section].default_methodologies), `default_methodologies not array for ${section}`);
  }
});
