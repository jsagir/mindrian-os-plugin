'use strict';
/*
 * Phase 119-02 Task 2 -- integration tests for room-skeleton-scaffold.cjs.
 *
 * Three end-to-end scenarios mirroring the real Plan 119-00 -> Plan 119-02
 * handoff:
 *   1. Fresh placeholder room (only .room-root + .mindrian/) -> full scaffold.
 *   2. Partial scaffold (sections present, STATE.md missing) -> idempotent fill.
 *   3. Human-authored STATE.md (auto_created:false) -> byte-preserved + sections
 *      still filled.
 *
 * Canon Part 9 invariant: this test exercises ONLY the file-system surface;
 * memory_event emission stays in Plan 119-00 (autoCreatePlaceholderRoom)
 * and Plan 119-01 (the F.1 selector that renames the room).
 */

const assert = require('node:assert');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const { scaffoldRoomSkeleton, SECTION_NAMES, IDENTITY_DIRECTORIES } =
  require('../lib/core/room-skeleton-scaffold.cjs');

function makePlaceholderRoom() {
  const dir = path.join(os.tmpdir(), 'phase119-02-int-' + crypto.randomBytes(4).toString('hex'));
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.room-root'), '');
  // Plan 119-00 also lays down an empty room.db; simulate with a placeholder file.
  fs.writeFileSync(path.join(dir, '.mindrian', 'room.db'), '');
  return dir;
}

function rmTmp(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
}

test('Integration 1: fresh placeholder room -> full scaffold (all sections + identity dirs + 3 root files)', () => {
  const roomDir = makePlaceholderRoom();
  try {
    const r = scaffoldRoomSkeleton(roomDir, {
      placeholder_slug: 'untitled-2026-05-16-1900',
      source_material_id: 'a'.repeat(32),
      auto_explore_finding: null,
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.state_written, true);
    assert.strictEqual(r.minto_written, true);
    assert.strictEqual(r.user_written, true);
    assert.strictEqual(r.sections_created.length, SECTION_NAMES.length);
    assert.strictEqual(r.identity_files_created.length, Object.keys(IDENTITY_DIRECTORIES).length);
    assert.strictEqual(r.thinness_acknowledged, true);
    // The warnings channel (plan 275-02) never turns result.ok false: a
    // not-yet-authored section-contract/reference-doc template degrades to
    // a named warning, and r.ok stays true even while r.warnings is
    // non-empty (section-contracts/ and references/ hold no real templates
    // yet, so this fresh scaffold DOES produce warnings today).
    assert.ok(Array.isArray(r.warnings), 'r.warnings must be an array');
    assert.strictEqual(r.ok, true, 'r.ok must stay true even when r.warnings is non-empty');

    // All sections + identity dirs + 3 root files materialized
    for (const section of SECTION_NAMES) {
      assert.ok(fs.existsSync(path.join(roomDir, section, 'ROOM.md')), `missing ${section}/ROOM.md`);
    }
    for (const d of Object.keys(IDENTITY_DIRECTORIES)) {
      assert.ok(fs.existsSync(path.join(roomDir, d, 'ROOM.md')), `missing ${d}/ROOM.md`);
    }
    assert.ok(fs.existsSync(path.join(roomDir, 'STATE.md')));
    assert.ok(fs.existsSync(path.join(roomDir, 'MINTO.md')));
    assert.ok(fs.existsSync(path.join(roomDir, 'USER.md')));
    // Plan 119-00 outputs preserved
    assert.ok(fs.existsSync(path.join(roomDir, '.room-root')));
    assert.ok(fs.existsSync(path.join(roomDir, '.mindrian', 'room.db')));
  } finally { rmTmp(roomDir); }
});

test('Integration 2: partial scaffold -> idempotent fill (missing pieces only)', () => {
  const roomDir = makePlaceholderRoom();
  try {
    // Pre-create the 8 sections (simulating an interrupted scaffold).
    for (const section of SECTION_NAMES) {
      const sectionDir = path.join(roomDir, section);
      fs.mkdirSync(sectionDir, { recursive: true });
      fs.writeFileSync(path.join(sectionDir, 'ROOM.md'), '---\nsection: ' + section + '\n---\n# existing\n');
    }
    // STATE.md + MINTO.md + USER.md + identity dirs are missing.

    const r = scaffoldRoomSkeleton(roomDir, {
      placeholder_slug: 'untitled-partial',
      source_material_id: 'b'.repeat(32),
    });
    assert.strictEqual(r.ok, true);
    // Only missing pieces were created
    assert.strictEqual(r.state_written, true);
    assert.strictEqual(r.minto_written, true);
    assert.strictEqual(r.user_written, true);
    assert.strictEqual(r.sections_created.length, 0, 'sections should not be recreated');
    assert.strictEqual(r.identity_files_created.length, Object.keys(IDENTITY_DIRECTORIES).length, 'identity dirs should be filled');

    // Pre-existing ROOM.md content preserved (byte-identical)
    const existing = fs.readFileSync(path.join(roomDir, 'problem-definition', 'ROOM.md'), 'utf8');
    assert.ok(existing.includes('# existing'), 'pre-existing section ROOM.md was overwritten');
  } finally { rmTmp(roomDir); }
});

test('Integration 3: human-authored STATE.md -> byte-preserved + sections filled (reentrancy)', () => {
  const roomDir = makePlaceholderRoom();
  try {
    // Human authored STATE.md with auto_created:false
    const humanState = [
      '---',
      'phase: validation',
      'auto_created: false',
      'venture_name: my-real-venture',
      'role_blend: { Founder: 0.7, Researcher: 0.3 }',
      'journey_stage: crossing-threshold',
      '---',
      '',
      '# Human-Authored Room State',
      '',
      'This room was manually curated by the navigator.',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(roomDir, 'STATE.md'), humanState);
    const before = fs.readFileSync(path.join(roomDir, 'STATE.md'), 'utf8');

    // Suppress stderr noise during the test
    const origWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = () => true;
    let r;
    try {
      r = scaffoldRoomSkeleton(roomDir, {
        placeholder_slug: 'should-not-substitute',
        source_material_id: 'c'.repeat(32),
      });
    } finally {
      process.stderr.write = origWrite;
    }

    // STATE.md byte-preserved
    const after = fs.readFileSync(path.join(roomDir, 'STATE.md'), 'utf8');
    assert.strictEqual(after, before, 'human STATE.md was overwritten');
    assert.strictEqual(r.state_written, false);
    // Sections + identity files STILL filled (idempotent)
    assert.strictEqual(r.sections_created.length, SECTION_NAMES.length);
    assert.strictEqual(r.identity_files_created.length, Object.keys(IDENTITY_DIRECTORIES).length);
    assert.ok(fs.existsSync(path.join(roomDir, 'problem-definition', 'ROOM.md')));
    assert.ok(fs.existsSync(path.join(roomDir, 'team', 'ROOM.md')));
  } finally { rmTmp(roomDir); }
});
