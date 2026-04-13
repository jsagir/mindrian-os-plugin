#!/usr/bin/env node
'use strict';

/**
 * Unit tests for lib/import/vault-scanner.cjs
 * Run: node lib/import/vault-scanner.test.cjs
 */

const assert = require('node:assert/strict');
const path = require('node:path');
const { scanVault } = require('./vault-scanner.cjs');

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

const TINY = path.join(__dirname, 'test-fixtures', 'tiny-vault');
const OBS = path.join(__dirname, 'test-fixtures', 'obsidian-vault');

test('scanVault on tiny-vault returns 5 files with full metadata', function () {
  const r = scanVault(TINY);
  assert.equal(r.files.length, 5, 'expected 5 files, got ' + r.files.length);
  for (const f of r.files) {
    assert.ok(f.source_path, 'source_path');
    assert.ok(typeof f.source_size === 'number', 'source_size');
    assert.ok(f.source_mtime, 'source_mtime');
    assert.ok(/^sha1:[0-9a-f]{40}$/.test(f.source_hash), 'source_hash sha1');
    assert.ok(f.source_frontmatter && typeof f.source_frontmatter === 'object', 'source_frontmatter');
    assert.ok(Array.isArray(f.source_wikilinks), 'source_wikilinks array');
    assert.ok('parent_folder' in f, 'parent_folder');
  }
});

test('scanVault skips .obsidian/, .git/, hidden dirs', function () {
  const r = scanVault(OBS);
  for (const f of r.files) {
    assert.ok(!f.source_path.includes('.obsidian'), 'should not include .obsidian paths: ' + f.source_path);
  }
  // skipped[] should have recorded .obsidian
  const skippedJoined = r.skipped.join('|');
  assert.ok(skippedJoined.includes('.obsidian'), 'expected .obsidian in skipped list, got: ' + skippedJoined);
});

test('scanVault extracts [[wikilinks]] from body into source_wikilinks', function () {
  const r = scanVault(OBS);
  const withLinks = r.files.find(function (f) { return f.source_path.indexOf('with-wikilinks') !== -1; });
  assert.ok(withLinks, 'expected with-wikilinks.md in results');
  assert.ok(withLinks.source_wikilinks.indexOf('dror-cohen') !== -1, 'expected dror-cohen wikilink');
  assert.ok(withLinks.source_wikilinks.indexOf('activation-funnel') !== -1, 'expected activation-funnel wikilink');
});

test('scanVault throws on missing path', function () {
  assert.throws(function () { scanVault('/nonexistent/path/xyz-123'); }, /source path not found/);
});

process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed > 0) process.exit(1);
process.stdout.write('PASS\n');
