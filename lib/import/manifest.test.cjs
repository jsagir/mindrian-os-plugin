#!/usr/bin/env node
'use strict';

/**
 * Unit tests for lib/import/manifest.cjs
 * Zero-dependency test runner. Run: node lib/import/manifest.test.cjs
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const m = require('./manifest.cjs');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write('  ok  ' + name + '\n');
  } catch (err) {
    failed += 1;
    process.stdout.write('  FAIL ' + name + '\n    ' + err.message + '\n');
  }
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mf-test-'));

test('createManifest returns correct initial shape', function () {
  const x = m.createManifest('/tmp/v', '2026-04-13-test');
  assert.equal(x.schema_version, '1.0');
  assert.equal(x.import_id, '2026-04-13-test');
  assert.equal(x.status, 'in_progress');
  assert.equal(x.source_vault, '/tmp/v');
  assert.deepEqual(x.files, []);
  assert.deepEqual(x.people, []);
  assert.deepEqual(x.meetings, []);
  assert.deepEqual(x.collisions, []);
  assert.deepEqual(x.warnings, []);
  assert.equal(x.undo.is_undone, false);
  assert.equal(x.stage_states.ingest.status, 'pending');
  assert.equal(x.stage_states.classify.human_edited, false);
});

test('writeManifest + readManifest roundtrip preserves every field', function () {
  const x = m.createManifest('/tmp/v', '2026-04-13-rt');
  x.files.push({
    id: 'f_001',
    source_path: 'notes/a.md',
    source_size: 100,
    source_mtime: '2026-01-01T00:00:00.000Z',
    source_hash: 'sha1:abc',
    source_frontmatter: { title: 'A' },
    source_wikilinks: ['foo'],
    parent_folder: 'notes'
  });
  const p = path.join(tmpRoot, 'rt.json');
  m.writeManifest(p, x);
  const back = m.readManifest(p);
  assert.deepEqual(back, x);
});

test('updateFile merges patch into matching entry without mutating siblings', function () {
  const x = m.createManifest('/tmp/v', 'up');
  x.files.push({ id: 'f_001', source_path: 'a.md', label: 'one' });
  x.files.push({ id: 'f_002', source_path: 'b.md', label: 'two' });
  m.updateFile(x, 'f_001', { classification: { section: 'problem-definition', confidence: 0.9, decision: 'AUTO' } });
  assert.equal(x.files[0].classification.section, 'problem-definition');
  assert.equal(x.files[0].label, 'one');
  assert.equal(x.files[1].label, 'two');
  assert.equal(x.files[1].classification, undefined);
});

test('recordCollision appends + flags file', function () {
  const x = m.createManifest('/tmp/v', 'co');
  x.files.push({ id: 'f_099', source_path: 'onb.md' });
  m.recordCollision(x, {
    source_file_id: 'f_099',
    intended_target: 'problem-definition/onboarding/onboarding.md',
    actual_target: 'problem-definition/onboarding-imported-2026-04-13/onboarding.md',
    reason: 'destination_folder_exists'
  });
  assert.equal(x.collisions.length, 1);
  assert.equal(x.collisions[0].reason, 'destination_folder_exists');
  assert.equal(x.files[0].collision, true);
  assert.equal(x.files[0].collision_original_target, 'problem-definition/onboarding/onboarding.md');
});

test('reverseManifest returns moves in reverse insertion order', function () {
  const x = m.createManifest('/tmp/v', 'rev');
  x.files.push({
    id: 'f_001', source_path: 'a.md',
    destination_section: 'problem-definition',
    destination_folder: 'problem-definition/a',
    destination_path: 'problem-definition/a/a.md',
    destination_abs_path: '/room/problem-definition/a/a.md',
    enrichment: { rooms_md_written: true }
  });
  x.files.push({
    id: 'f_002', source_path: 'b.md',
    destination_section: 'solution-design',
    destination_folder: 'solution-design/b',
    destination_path: 'solution-design/b/b.md',
    destination_abs_path: '/room/solution-design/b/b.md',
    enrichment: { rooms_md_written: true }
  });
  const r = m.reverseManifest(x);
  assert.equal(r.moves.length, 2);
  assert.equal(r.moves[0].from, '/room/solution-design/b/b.md'); // reversed
  assert.equal(r.moves[1].from, '/room/problem-definition/a/a.md');
  assert.ok(r.rooms_md_to_remove.length >= 2);
  assert.ok(r.minto_stubs_to_remove.length >= 2);
});

test('writeManifest throws if schema_version is missing', function () {
  const bad = { import_id: 'x' };
  assert.throws(function () { m.writeManifest(path.join(tmpRoot, 'bad.json'), bad); }, /schema_version/);
});

process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed > 0) process.exit(1);
process.stdout.write('PASS\n');
