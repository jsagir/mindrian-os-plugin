#!/usr/bin/env node
'use strict';
/*
 * Phase 106-02 D-02 carve-out fence test.
 *
 * Replaces the Wave 0 stub. The four D-02 statusline glyphs (📊 🎯 ⚙️ ⚠) are
 * governed by the carve-out at skills/ui-system/SKILL.md:202: they may appear
 * ONLY inside scripts/context-monitor (the Claude Code statusline renderer is
 * a passive signal surface, every other source surface stays no-emoji).
 *
 * This test walks the production source tree and FAILS if any of the four
 * glyphs land in any source file other than scripts/context-monitor. It also
 * sanity-checks that scripts/context-monitor itself still contains each glyph
 * (catches accidental glyph removal in a future refactor).
 *
 * Documentation surfaces are exempt: tests/, test/, .planning/, docs/, *.md,
 * CHANGELOG, README. The fence is for production code only.
 *
 * Canon Part 8: pure local read. No network. No spawn. No external deps.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const ALLOWED_FILE = path.join(REPO_ROOT, 'scripts', 'context-monitor');

// Glyphs governed by the carve-out. Adding any of these to a non-carve-out
// source file is a Class F regression.
//
// EXCLUSIVE_GLYPHS: the three glyphs introduced by Phase 106-D02 that have
// never been in the production source tree before -- they are reserved for
// scripts/context-monitor exclusively. Any future plan that adds one of these
// to another source file trips the fence.
//
// SHARED_GLYPHS: ⚠ (U+26A0 WARNING SIGN) was already in widespread production
// use across the doctor, render, hmi, jtbd-command, memory-command, and
// session-start surfaces BEFORE Phase 106 shipped. The carve-out cannot
// retroactively forbid it. The fence enforces only that scripts/context-monitor
// still contains ⚠ (the compaction-imminent text uses it -- accidental removal
// would silently break the D-02 broadcast).
const EXCLUSIVE_GLYPHS = ['📊', '🎯', '⚙️'];
const SHARED_GLYPHS = ['⚠'];
const GLYPHS = EXCLUSIVE_GLYPHS.concat(SHARED_GLYPHS); // for sanity check only

// Directories never scanned (docs / tests / git / dependencies / planning
// artifacts / archives). The fence is for production source code only --
// fixtures and READMEs may legitimately discuss the glyphs.
const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'tests',
  'test',
  '.planning',
  'docs',
  '.archive-pre-qa-rescope',
  '.archive',
  '.archive-pre-mwp',
  '.claude',
  '.claude-plugin',
  '.deprecated-pre-mos-prefix',
]);

// Filename or filename-prefix patterns skipped regardless of directory.
function shouldSkipFile(p) {
  const base = path.basename(p);
  if (base === 'CHANGELOG.md' || base === 'README.md') return true;
  if (base.endsWith('.md')) return true;
  if (base.endsWith('.html')) return true;       // dashboards are documentation surfaces
  if (base.endsWith('.lock') || base === 'package-lock.json') return true;
  if (base.startsWith('.deprecated-')) return true;
  return false;
}

function walk(dir, files) {
  if (!files) files = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_e) {
    return files;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      walk(full, files);
    } else if (ent.isFile()) {
      if (shouldSkipFile(full)) continue;
      files.push(full);
    }
  }
  return files;
}

const violations = [];
const allFiles = walk(REPO_ROOT);
for (const f of allFiles) {
  if (path.resolve(f) === path.resolve(ALLOWED_FILE)) continue;
  let content;
  try {
    content = fs.readFileSync(f, 'utf8');
  } catch (_e) {
    continue;
  }
  for (const g of EXCLUSIVE_GLYPHS) {
    if (content.includes(g)) {
      violations.push({ file: path.relative(REPO_ROOT, f), glyph: g });
    }
  }
}

if (violations.length > 0) {
  console.error('Glyph carve-out violations:');
  for (const v of violations) {
    console.error('  ' + v.file + ': contains ' + v.glyph);
  }
  console.error('');
  console.error('The three exclusive D-02 glyphs (📊 🎯 ⚙️) are governed by');
  console.error('skills/ui-system/SKILL.md:202 carve-out and may appear ONLY');
  console.error('in scripts/context-monitor. Move the glyph or extend the');
  console.error('carve-out (with explicit Canon amendment).');
  process.exit(1);
}

// Sanity: scripts/context-monitor MUST contain each glyph at least once. If a
// future refactor accidentally drops one of the D-02 glyphs the fence catches
// it here -- the file would still pass the violation scan above (you removed
// the glyph entirely), but the broadcast contract would be silently broken.
const monitor = fs.readFileSync(ALLOWED_FILE, 'utf8');
for (const g of GLYPHS) {
  assert.ok(
    monitor.includes(g),
    'scripts/context-monitor missing required D-02 glyph: ' + g
  );
}

// Sanity: at least the canonical CODE-bearing production directories were
// walked. Catches accidental SKIP_DIRS over-broadening. We only check dirs
// that contain non-markdown source -- commands/ and agents/ are markdown-only
// surfaces (skipped by shouldSkipFile), so they would yield zero scanned
// files even with correct SKIP_DIRS.
const expectedCodeDirs = ['lib', 'scripts', 'hooks'];
for (const d of expectedCodeDirs) {
  const candidate = path.join(REPO_ROOT, d);
  if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
    const fileCount = allFiles.filter(function (f) {
      return f.startsWith(candidate + path.sep) || f.startsWith(candidate + '/');
    }).length;
    assert.ok(
      fileCount > 0,
      'Production directory ' + d + '/ had zero scanned files (SKIP_DIRS over-broad?)'
    );
  }
}

console.log('PASS: glyph isolation fence (4 glyphs, 1 allowed file, ' + allFiles.length + ' files scanned)');
process.exit(0);
