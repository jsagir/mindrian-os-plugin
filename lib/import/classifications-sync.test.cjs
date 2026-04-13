#!/usr/bin/env node
'use strict';

/**
 * Unit tests for lib/import/classifications-sync.cjs
 * Run: node lib/import/classifications-sync.test.cjs
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const manifestMod = require('./manifest.cjs');
const sync = require('./classifications-sync.cjs');

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

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-test-'));

function seedManifest(fileRows) {
  const manifest = manifestMod.createManifest('/tmp/v', '2026-04-13-cs');
  fileRows.forEach(function (row, i) {
    manifest.files.push({
      id: 'f_' + String(i + 1).padStart(3, '0'),
      source_path: row.source_path,
      source_size: 1,
      source_mtime: '2026-01-01T00:00:00.000Z',
      source_hash: 'sha1:aaa',
      source_frontmatter: {},
      source_wikilinks: [],
      parent_folder: null,
      classification: row.classification || null
    });
  });
  return manifest;
}

function writeClassificationsMd(filePath, rows) {
  let out = '| File | Section | Confidence | Evidence | Decision |\n';
  out += '|------|---------|------------|----------|----------|\n';
  for (const r of rows) {
    out += '| ' + r.file + ' | ' + r.section + ' | ' + r.confidence + ' | ' + r.evidence + ' | ' + r.decision + ' |\n';
  }
  fs.writeFileSync(filePath, out, 'utf8');
}

test('round-trip: write classifications.md, parse, get back same rows', function () {
  const mdPath = path.join(tmpRoot, 'rt.md');
  const rows = [
    { file: 'notes/a.md', section: 'problem-definition', confidence: '0.84', evidence: 'clear signal', decision: 'AUTO' },
    { file: 'notes/b.md', section: 'business-model', confidence: '0.58', evidence: 'freemium', decision: 'SUGGEST' },
    { file: 'notes/c.md', section: 'inbox', confidence: '0.31', evidence: 'no signal', decision: 'INBOX' }
  ];
  writeClassificationsMd(mdPath, rows);
  const parsed = sync.parseClassificationsMarkdown(mdPath);
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].file, 'notes/a.md');
  assert.equal(parsed[0].section, 'problem-definition');
  assert.equal(parsed[0].confidence, 0.84);
  assert.equal(parsed[0].decision, 'AUTO');
});

test('section edit: inbox -> problem-definition persists into manifest', function () {
  const manifestPath = path.join(tmpRoot, 'sec.json');
  const mdPath = path.join(tmpRoot, 'sec.md');
  const manifest = seedManifest([
    { source_path: 'notes/a.md', classification: { section: 'inbox', confidence: 0.31, evidence: 'no signal', decision: 'INBOX', stage: 'classify' } }
  ]);
  manifestMod.writeManifest(manifestPath, manifest);
  writeClassificationsMd(mdPath, [
    { file: 'notes/a.md', section: 'problem-definition', confidence: '0.80', evidence: 'edited', decision: 'AUTO' }
  ]);
  const result = sync.syncClassificationsToManifest(mdPath, manifestPath);
  assert.equal(result.rows, 1);
  assert.equal(result.edits, 1);
  const back = manifestMod.readManifest(manifestPath);
  assert.equal(back.files[0].classification.section, 'problem-definition');
  assert.equal(back.stage_states.classify.human_edited, true);
  assert.equal(back.stage_states.classify.edits_count, 1);
});

test('decision edit: INBOX -> AUTO persists into manifest', function () {
  const manifestPath = path.join(tmpRoot, 'dec.json');
  const mdPath = path.join(tmpRoot, 'dec.md');
  const manifest = seedManifest([
    { source_path: 'notes/a.md', classification: { section: 'problem-definition', confidence: 0.5, evidence: 'ok', decision: 'INBOX', stage: 'classify' } }
  ]);
  manifestMod.writeManifest(manifestPath, manifest);
  writeClassificationsMd(mdPath, [
    { file: 'notes/a.md', section: 'problem-definition', confidence: '0.5', evidence: 'ok', decision: 'AUTO' }
  ]);
  sync.syncClassificationsToManifest(mdPath, manifestPath);
  const back = manifestMod.readManifest(manifestPath);
  assert.equal(back.files[0].classification.decision, 'AUTO');
});

test('malformed row (missing Decision column) throws', function () {
  const mdPath = path.join(tmpRoot, 'bad.md');
  let out = '| File | Section | Confidence | Evidence | Decision |\n';
  out += '|------|---------|------------|----------|----------|\n';
  out += '| notes/a.md | problem-definition | 0.84 | "ok" |\n';
  fs.writeFileSync(mdPath, out, 'utf8');
  assert.throws(function () { sync.parseClassificationsMarkdown(mdPath); }, /malformed classifications row/);
});

test('confidence "0.84" parses as Number 0.84 (not string)', function () {
  const mdPath = path.join(tmpRoot, 'num.md');
  writeClassificationsMd(mdPath, [
    { file: 'notes/a.md', section: 'problem-definition', confidence: '0.84', evidence: 'ok', decision: 'AUTO' }
  ]);
  const parsed = sync.parseClassificationsMarkdown(mdPath);
  assert.equal(typeof parsed[0].confidence, 'number');
  assert.equal(parsed[0].confidence, 0.84);
});

process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed > 0) process.exit(1);
process.stdout.write('PASS\n');
