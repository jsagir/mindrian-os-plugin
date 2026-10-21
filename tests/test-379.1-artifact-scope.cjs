#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 379.1 (graph derive drain and scout runaway CPU) proof: artifact-scope.
 * Proves CPU379-10: a declared way to keep generated engine-input directories out of the derive
 * and scout artifact scope (the engine-input-manifest.json and .mos-generated markers, the
 * .mindrian/artifact-scope.json globs, the overbroad guard at 0.5 of directories; D-379.1-18).
 * Plan 02 (this file's predicate part): lib/core/artifact-scope.cjs matchGlob, validatePattern,
 * loadScope with the guards G1 to G6b, isExcludedDir. Plan 05 adds the rs-engine walker
 * assertions; Plan 06 adds the both-walkers assertion on the large fixture.
 * Hermetic: scrubVendorKey + installNetGuard first; attempts() === 0 last. No em-dashes.
 */
const { scrubVendorKey, installNetGuard } = require('./helpers/hygiene-355.cjs');
scrubVendorKey();
const netGuard = installNetGuard();

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const scopeMod = require('../lib/core/artifact-scope.cjs');
const { loadScope, isExcludedDir, matchGlob, MARKER_FILES, SCOPE_FILE, OVERBROAD_DIR_SHARE_DEFAULT } = scopeMod;
const { validatePattern } = scopeMod._test;

let pass = 0;
let fail = 0;
function t(label, fn) {
  try {
    fn();
    pass += 1;
    console.log('  ok - ' + label);
  } catch (e) {
    fail += 1;
    process.exitCode = 1;
    console.log('  FAIL - ' + label + ': ' + (e && e.message ? e.message : e));
  }
}

const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-379-1-scope-'));
let roomSeq = 0;

// Build a tmp room. layout = { 'dir/sub': ['a.md', 'b.txt'], '': ['root.md'] }
// markers = ['dir/sub'] drops engine-input-manifest.json in those dirs.
// declaration = undefined | string (raw file text) | object (JSON.stringified).
function makeRoom(layout, opts) {
  const o = opts || {};
  roomSeq += 1;
  const room = path.join(SCRATCH, 'room-' + roomSeq);
  fs.mkdirSync(path.join(room, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(room, '.room-root'), JSON.stringify({ room: 'fixture-' + roomSeq, active: true }), 'utf8');
  for (const rel of Object.keys(layout)) {
    const dir = rel === '' ? room : path.join(room, rel);
    fs.mkdirSync(dir, { recursive: true });
    for (const name of layout[rel]) {
      fs.writeFileSync(path.join(dir, name), '# ' + name + '\n\nbody text long enough to count as an artifact in any walker.\n', 'utf8');
    }
  }
  for (const rel of (o.markers || [])) {
    const dir = path.join(room, rel);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, o.markerName || 'engine-input-manifest.json'), '{}', 'utf8');
  }
  if (o.declaration !== undefined) {
    const text = typeof o.declaration === 'string' ? o.declaration : JSON.stringify(o.declaration);
    fs.writeFileSync(path.join(room, SCOPE_FILE), text, 'utf8');
  }
  return room;
}

function withEnv(name, value, fn) {
  const had = Object.prototype.hasOwnProperty.call(process.env, name);
  const prev = process.env[name];
  if (value === undefined) delete process.env[name]; else process.env[name] = value;
  try {
    return fn();
  } finally {
    if (had) process.env[name] = prev; else delete process.env[name];
  }
}

function mdList(n, prefix) {
  const out = [];
  for (let i = 0; i < n; i += 1) out.push((prefix || 'f') + i + '.md');
  return out;
}

function main() {
  console.log('test-379.1-artifact-scope (CPU379-10)');
  try {
    t('exports: MARKER_FILES, SCOPE_FILE, OVERBROAD_DIR_SHARE_DEFAULT 0.5', () => {
      assert.deepEqual(MARKER_FILES, ['.mos-generated', 'engine-input-manifest.json']);
      assert.equal(SCOPE_FILE, '.mindrian/artifact-scope.json');
      assert.equal(OVERBROAD_DIR_SHARE_DEFAULT, 0.5);
      assert.equal(scopeMod.PREWALK_MAX_DEPTH, 8);
      assert.equal(scopeMod.PREWALK_MAX_ENTRIES, 20000);
    });

    // --- matchGlob table ---
    const globTable = [
      ['solution-design/full-catalog-run-*', 'solution-design/full-catalog-run-2026-10-18', true],
      ['**/engine-input-room', 'a/b/engine-input-room', true],
      ['**/engine-input-room', 'engine-input-room', true],
      ['*.md', 'a/b.md', false],
      ['a/*', 'a/b/c', false],
      ['a/*', 'a/b', true],
      ['a/**', 'a/b/c', true],
      ['a/**/d', 'a/d', true],
      ['a/**/d', 'a/b/c/d', true],
      ['*run*', 'full-catalog-run-2026', true],
      ['*run*', 'solution-design/full-catalog-run-2026', false],
      ['solution-design/full-catalog-run-*', 'solution-design/full-catalog-run-2026/sub', false],
      ['a', 'A', false],
    ];
    for (const [pat, rel, want] of globTable) {
      t('matchGlob(' + JSON.stringify(pat) + ', ' + JSON.stringify(rel) + ') is ' + want, () => {
        assert.equal(matchGlob(pat, rel), want);
      });
    }

    // --- validatePattern table ---
    const rejected = ['*', '**', '**/*', '*/**', '*/*', '', '   ', '../x', '/abs', 'C:\\x', 'a/../b', 'a\\b', 'x'.repeat(257), 42, null];
    const accepted = ['solution-design/full-catalog-run-*', '*run*', '**/engine-input-room', 'a', 'a/**', '**/b/*'];
    for (const p of rejected) {
      t('validatePattern(' + JSON.stringify(typeof p === 'string' && p.length > 40 ? p.slice(0, 8) + '... (257 chars)' : p) + ') is false', () => {
        assert.equal(validatePattern(p), false);
      });
    }
    for (const p of accepted) {
      t('validatePattern(' + JSON.stringify(p) + ') is true', () => {
        assert.equal(validatePattern(p), true);
      });
    }

    // --- loadScope on tmp rooms ---
    t('loadScope: no file -> declared false, patterns [], stats present', () => {
      const room = makeRoom({ 'notes': ['n.md'] });
      const s = loadScope(room);
      assert.equal(s.declared, false);
      assert.deepEqual(s.patterns, []);
      assert.equal(s.parse_error, false);
      assert.equal(s.overbroad, false);
      assert.equal(s.stats.kept_md, 1);
      assert.equal(s.stats.dirs_seen, 1);
    });

    t('loadScope: valid file -> 2 patterns, overbroad false', () => {
      const room = makeRoom({ 'notes': ['n.md'], 'solution-design/full-catalog-run-2026-10-18': ['g.md'] }, {
        declaration: { version: 1, exclude: ['solution-design/full-catalog-run-*', '**/engine-input-room'] },
      });
      const s = loadScope(room);
      assert.equal(s.declared, true);
      assert.deepEqual(s.patterns, ['solution-design/full-catalog-run-*', '**/engine-input-room']);
      assert.equal(s.invalid_patterns, 0);
      assert.equal(s.overbroad, false);
      assert.equal(s.stats.pattern_pruned_dirs, 1);
      assert.equal(s.stats.excluded_md, 1);
      assert.equal(s.stats.kept_md, 1);
    });

    t('loadScope: a pattern ../x -> invalid_patterns 1', () => {
      const room = makeRoom({ 'notes': ['n.md'] }, { declaration: { version: 1, exclude: ['../x', 'notes-archive'] } });
      const s = loadScope(room);
      assert.equal(s.invalid_patterns, 1);
      assert.equal(s.overbroad_patterns, 0);
      assert.deepEqual(s.patterns, ['notes-archive']);
    });

    t('loadScope: a pattern /abs -> invalid_patterns 1', () => {
      const room = makeRoom({ 'notes': ['n.md'] }, { declaration: { version: 1, exclude: ['/abs'] } });
      const s = loadScope(room);
      assert.equal(s.invalid_patterns, 1);
      assert.equal(s.overbroad_patterns, 0);
      assert.deepEqual(s.patterns, []);
    });

    t('loadScope: declaration ["**"] -> invalid 1, overbroad_patterns 1, patterns [], overbroad false', () => {
      const room = makeRoom({ 'notes': ['n.md'] }, { declaration: { version: 1, exclude: ['**'] } });
      const s = loadScope(room);
      assert.equal(s.invalid_patterns, 1);
      assert.equal(s.overbroad_patterns, 1);
      assert.deepEqual(s.patterns, []);
      assert.equal(s.overbroad, false);
      assert.equal(s.stats.kept_md, 1);
    });

    t('loadScope: malformed JSON -> parse_error true and patterns []', () => {
      const room = makeRoom({ 'notes': ['n.md'] }, { declaration: '{ "version": 1, "exclude": [' });
      const s = loadScope(room);
      assert.equal(s.declared, true);
      assert.equal(s.parse_error, true);
      assert.deepEqual(s.patterns, []);
      assert.equal(s.stats.kept_md, 1);
    });

    t('loadScope: wrong version or exclude not an array -> parse_error true', () => {
      const r1 = makeRoom({ 'notes': ['n.md'] }, { declaration: { version: 2, exclude: ['a'] } });
      assert.equal(loadScope(r1).parse_error, true);
      const r2 = makeRoom({ 'notes': ['n.md'] }, { declaration: { version: 1, exclude: 'a' } });
      assert.equal(loadScope(r2).parse_error, true);
    });

    t('loadScope: a 100 KB file -> parse_error true', () => {
      const big = JSON.stringify({ version: 1, exclude: ['a'], pad: 'x'.repeat(100 * 1024) });
      const room = makeRoom({ 'notes': ['n.md'] }, { declaration: big });
      const s = loadScope(room);
      assert.equal(s.parse_error, true);
      assert.deepEqual(s.patterns, []);
    });

    // --- the overbroad guards ---
    t('G1: 3 dirs sa sb sc, no root .md, ["s*"] -> overbroad true, patterns [], first-pass counts kept', () => {
      const room = makeRoom({ sa: ['a.md'], sb: ['b.md'], sc: ['c.md'] }, { declaration: { version: 1, exclude: ['s*'] } });
      const s = loadScope(room);
      assert.equal(s.overbroad, true);
      assert.deepEqual(s.patterns, []);
      assert.equal(s.overbroad_stats.pattern_pruned_dirs, 3);
      assert.equal(s.overbroad_stats.dirs_seen, 3);
      assert.equal(s.overbroad_stats.pattern_excluded_md, 3);
      assert.equal(s.overbroad_stats.kept_md, 0);
      assert.equal(s.stats.pattern_pruned_dirs, 0);
      assert.equal(s.stats.kept_md, 3);
      assert.equal(s.stats.excluded_dirs, 0);
    });

    t('G2: 4 dirs, ["sd"] -> overbroad false, excluded_dirs 1, excluded_md 1, kept_md 3', () => {
      const room = makeRoom({ sa: ['a.md'], sb: ['b.md'], sc: ['c.md'], sd: ['d.md'] }, { declaration: { version: 1, exclude: ['sd'] } });
      const s = loadScope(room);
      assert.equal(s.overbroad, false);
      assert.equal(s.overbroad_stats, null);
      assert.deepEqual(s.patterns, ['sd']);
      assert.equal(s.stats.excluded_dirs, 1);
      assert.equal(s.stats.pattern_pruned_dirs, 1);
      assert.equal(s.stats.excluded_md, 1);
      assert.equal(s.stats.kept_md, 3);
    });

    t('G3: the only .md files sit under gen/, ["gen"] -> overbroad true by guard A', () => {
      // Three dirs so guard B (1 of 3 = 0.33) stays quiet and guard A decides.
      const room = makeRoom({ gen: mdList(3, 'g'), other: ['readme.txt'], misc: ['data.json'] }, { declaration: { version: 1, exclude: ['gen'] } });
      const s = loadScope(room);
      assert.equal(s.overbroad, true);
      assert.equal(s.overbroad_stats.dirs_seen, 3);
      assert.equal(s.overbroad_stats.pattern_pruned_dirs, 1);
      assert.equal(s.overbroad_stats.pattern_excluded_md, 3);
      assert.equal(s.overbroad_stats.kept_md, 0);
      assert.deepEqual(s.patterns, []);
    });

    t('G4: 50 .md under a marker dir and 5 outside, no declaration -> overbroad false, marker counts', () => {
      const room = makeRoom({ 'solution-design/run': mdList(50), notes: mdList(5, 'n') }, { markers: ['solution-design/run'] });
      const s = loadScope(room);
      assert.equal(s.declared, false);
      assert.equal(s.overbroad, false);
      assert.equal(s.stats.marker_pruned_dirs, 1);
      assert.equal(s.stats.pattern_pruned_dirs, 0);
      assert.equal(s.stats.excluded_dirs, 1);
      assert.equal(s.stats.excluded_md, 50);
      assert.equal(s.stats.pattern_excluded_md, 0);
      assert.equal(s.stats.kept_md, 5);
      assert.equal(s.stats.truncated, false);
    });

    t('G4b: the markers never trip the guard even when they hide every .md', () => {
      const room = makeRoom({ gen: mdList(10, 'g') }, { markers: ['gen'], markerName: '.mos-generated' });
      const s = loadScope(room);
      assert.equal(s.overbroad, false);
      assert.equal(s.stats.marker_pruned_dirs, 1);
      assert.equal(s.stats.excluded_md, 10);
      assert.equal(s.stats.kept_md, 0);
    });

    t('G5: G1 room plus root.md with MINDRIAN_SCOPE_OVERBROAD_DIR_SHARE=1 -> overbroad false; env abc -> true', () => {
      const room = makeRoom({ '': ['root.md'], sa: ['a.md'], sb: ['b.md'], sc: ['c.md'] }, { declaration: { version: 1, exclude: ['s*'] } });
      const relaxed = withEnv('MINDRIAN_SCOPE_OVERBROAD_DIR_SHARE', '1', () => loadScope(room));
      assert.equal(relaxed.dir_share, 1);
      assert.equal(relaxed.overbroad, false, '3 of 3 is not above 1.0 and kept_md is 1');
      assert.equal(relaxed.stats.pattern_pruned_dirs, 3);
      assert.equal(relaxed.stats.kept_md, 1);
      const strict = withEnv('MINDRIAN_SCOPE_OVERBROAD_DIR_SHARE', 'abc', () => loadScope(room));
      assert.equal(strict.dir_share, 0.5);
      assert.equal(strict.overbroad, true);
      const zero = withEnv('MINDRIAN_SCOPE_OVERBROAD_DIR_SHARE', '0', () => scopeMod._test.resolveOverbroadDirShare());
      assert.equal(zero, 0.5, '0 is outside (0, 1]');
      const two = withEnv('MINDRIAN_SCOPE_OVERBROAD_DIR_SHARE', '2', () => scopeMod._test.resolveOverbroadDirShare());
      assert.equal(two, 0.5, '2 is outside (0, 1]');
    });

    t('G6a: 2 top-level dirs, 1 pruned -> overbroad false (0.5 is not above 0.5)', () => {
      const room = makeRoom({ sa: ['a.md'], gen: ['g.md'] }, { declaration: { version: 1, exclude: ['gen'] } });
      const s = loadScope(room);
      assert.equal(s.overbroad, false);
      assert.equal(s.stats.dirs_seen, 2);
      assert.equal(s.stats.pattern_pruned_dirs, 1);
      assert.equal(s.stats.kept_md, 1);
    });

    t('G6b: 2 of 2 pruned -> overbroad true', () => {
      const room = makeRoom({ ga: ['a.md'], gb: ['b.md'] }, { declaration: { version: 1, exclude: ['g*'] } });
      const s = loadScope(room);
      assert.equal(s.overbroad, true);
      assert.equal(s.overbroad_stats.dirs_seen, 2);
      assert.equal(s.overbroad_stats.pattern_pruned_dirs, 2);
      assert.deepEqual(s.patterns, []);
    });

    t('prewalk: a sub-room (.room-root) and a dot-directory are skipped; nested dirs count', () => {
      const room = makeRoom({ 'a/b/c': ['deep.md'], 'sub': ['s.md'], '.hidden': ['h.md'] });
      fs.writeFileSync(path.join(room, 'sub', '.room-root'), '{}', 'utf8');
      const stats = scopeMod._test.prewalk(room, []);
      assert.equal(stats.dirs_seen, 3, 'a, a/b, a/b/c');
      assert.equal(stats.kept_md, 1);
      assert.equal(stats.truncated, false);
    });

    // --- isExcludedDir ---
    t('isExcludedDir: engine-input-manifest.json -> true; .mos-generated -> true', () => {
      const room = makeRoom({ m1: ['x.md'], m2: ['y.md'] }, { markers: ['m1'] });
      fs.writeFileSync(path.join(room, 'm2', '.mos-generated'), '', 'utf8');
      const scope = loadScope(room);
      assert.equal(isExcludedDir(path.join(room, 'm1'), room, scope), true);
      assert.equal(isExcludedDir(path.join(room, 'm2'), room, scope), true);
      assert.equal(isExcludedDir(path.join(room, 'm1'), room, null), true, 'markers apply with no scope');
    });

    t('isExcludedDir: a dir matched by the declaration -> true; a plain section dir -> false', () => {
      const room = makeRoom({ sa: ['a.md'], sb: ['b.md'], sc: ['c.md'], sd: ['d.md'] }, { declaration: { version: 1, exclude: ['sd'] } });
      const scope = loadScope(room);
      assert.equal(isExcludedDir(path.join(room, 'sd'), room, scope), true);
      assert.equal(isExcludedDir(path.join(room, 'sa'), room, scope), false);
    });

    t('isExcludedDir: an absDir outside the room -> false; the room root -> false', () => {
      const room = makeRoom({ sa: ['a.md'] }, { declaration: { version: 1, exclude: ['**/sa'] } });
      const scope = loadScope(room);
      const outside = path.join(SCRATCH, 'outside-' + roomSeq, 'sa');
      fs.mkdirSync(outside, { recursive: true });
      fs.writeFileSync(path.join(outside, 'engine-input-manifest.json'), '{}', 'utf8');
      assert.equal(isExcludedDir(outside, room, scope), false);
      assert.equal(isExcludedDir(room, room, scope), false);
      assert.equal(isExcludedDir(undefined, room, scope), false);
    });

    t('isExcludedDir: after an overbroad declaration a dir the declaration named -> false', () => {
      const room = makeRoom({ sa: ['a.md'], sb: ['b.md'], sc: ['c.md'] }, { declaration: { version: 1, exclude: ['s*'] } });
      const scope = loadScope(room);
      assert.equal(scope.overbroad, true);
      assert.equal(isExcludedDir(path.join(room, 'sa'), room, scope), false);
    });

    // --- Plan 05: the rs-engine walker honours the scope and discloses it ---
    const rsEngine = require('../lib/core/rs-engine.cjs');
    const genFiles = [];
    for (let i = 0; i < 50; i += 1) genFiles.push('gen-' + i + '.md');
    const walkerLayout = () => ({
      notes: ['a.md', 'b.md', 'c.md', 'd.md', 'e.md'],
      'solution-design/gen': [],
      'solution-design/gen/engine-input-room': genFiles,
    });

    t('walker: a manifest marker prunes the generated dir; 5 artifacts, disclosure 1 dir and 50 md', () => {
      const room = makeRoom(walkerLayout(), { markers: ['solution-design/gen'] });
      assert.equal(rsEngine.discoverArtifacts(room).length, 5);
      const r = rsEngine.discoverArtifactsWithScope(room);
      assert.equal(r.artifacts.length, 5);
      assert.equal(r.scope.stats.excluded_dirs, 1);
      assert.equal(r.scope.stats.excluded_md, 50);
    });

    t('walker: without the manifest the same room reads 55', () => {
      const room = makeRoom(walkerLayout());
      assert.equal(rsEngine.discoverArtifacts(room).length, 55);
    });

    t('walker: a valid declaration with no manifest reads 5', () => {
      const room = makeRoom(walkerLayout(), { declaration: { version: 1, exclude: ['solution-design/gen'] } });
      assert.equal(rsEngine.discoverArtifacts(room).length, 5);
    });

    t('walker: a malformed declaration excludes nothing (55)', () => {
      const room = makeRoom(walkerLayout(), { declaration: '{ not json' });
      assert.equal(rsEngine.discoverArtifacts(room).length, 55);
    });

    t('walker: a wildcard-only declaration is ignored (55) and counted as 1 overbroad pattern', () => {
      const room = makeRoom(walkerLayout(), { declaration: { version: 1, exclude: ['**'] } });
      const r = rsEngine.discoverArtifactsWithScope(room);
      assert.equal(r.artifacts.length, 55);
      assert.equal(r.scope.overbroad_patterns, 1);
    });

    t('walker: a declaration naming every top-level directory is ignored (55), overbroad true', () => {
      const room = makeRoom(walkerLayout(), { declaration: { version: 1, exclude: ['notes', 'solution-design'] } });
      const r = rsEngine.discoverArtifactsWithScope(room);
      assert.equal(r.artifacts.length, 55);
      assert.equal(r.scope.overbroad, true);
    });

    // --- Plan 06: both walkers, one declaration, one count, on the large fixture (CPU379-10) ---
    const classifier = require('../lib/core/graph-derive-classifier.cjs');
    const largeBuilder = require('./fixtures/large-room/build-fixture.cjs');

    t('large fixture with the manifest: both walkers read 5 artifacts and report 2100 excluded', () => {
      const built = largeBuilder.buildLargeRoom(path.join(SCRATCH, 'large-scoped'), { slug: 'large-scoped', withManifest: true });
      const c = classifier.enumerateArtifactsWithScope(built.roomDir);
      const r = rsEngine.discoverArtifactsWithScope(built.roomDir);
      assert.equal(c.artifacts.length, 5);
      assert.equal(r.artifacts.length, 5);
      assert.equal(c.scope.stats.excluded_md, 2100);
      assert.equal(r.scope.stats.excluded_md, 2100);
    });

    t('large fixture without the manifest: both walkers read 2105', () => {
      const built = largeBuilder.buildLargeRoom(path.join(SCRATCH, 'large-plain'), { slug: 'large-plain' });
      assert.equal(classifier.enumerateArtifactsWithScope(built.roomDir).artifacts.length, 2105);
      assert.equal(rsEngine.discoverArtifactsWithScope(built.roomDir).artifacts.length, 2105);
    });
  } finally {
    try { fs.rmSync(SCRATCH, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
  assert.equal(netGuard.attempts(), 0, 'no network attempt');
  netGuard.restore();
  console.log('PASS: ' + pass + ' FAIL: ' + fail);
}

main();
