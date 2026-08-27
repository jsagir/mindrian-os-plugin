#!/usr/bin/env node
'use strict';

/*
 * Phase 270-03 Task 1, File B -- the 4.1a tripwire: operator baseline
 * awareness must be schema-driven off SECTION_METADATA, never a hardcoded 8.
 *
 * `lib/core/room-skeleton-scaffold.cjs:351` states it in-source, verbatim:
 * "FROZEN TABLE CONTRACT: SECTION_NAMES + SECTION_METADATA are never
 * modified." This test IMPORTS SECTION_NAMES and IDENTITY_DIRECTORIES at
 * runtime and BUILDS its own forbidden-literal list from them -- it never
 * restates a section name, so a future 9th section (OQ-7) is picked up with
 * zero edit, the same property it enforces on the operator.
 *
 * GREP HYGIENE WARNING: this header mentions section-name-shaped prose and
 * the forbidden `=== 8` pattern, so a raw grep over this FILE would find
 * tokens it forbids elsewhere. Every scan below reads ONLY the files named
 * in OPERATOR_FILES via readStripped(), never this file's own source.
 *
 * No em-dashes. CJS only. node:assert, node:fs, node:path only.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const { SECTION_NAMES, IDENTITY_DIRECTORIES } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-skeleton-scaffold.cjs'));

// Declared independently from tests/test-270-no-second-walker.cjs (the
// plan's own instruction: both files declare the same list, separately).
const OPERATOR_FILES = [
  'lib/core/icm-forest.cjs',
  'lib/mcp/tree-watcher.cjs',
  'lib/mcp/tools/context.cjs',
  'lib/mcp/tools/graph-reason.cjs',
  'lib/mcp/tools/identity.cjs',
  'lib/mcp/tools/dual-path.cjs',
];

// STRUCTURAL_DIRS is the ONE documented exception (baseline.2): 'team'
// legitimately also appears in section-registry.cjs's STRUCTURAL_DIRS. If
// the operator needs to disambiguate 'team', it must do so by importing
// STRUCTURAL_DIRS and calling STRUCTURAL_DIRS.includes(name), never by
// writing the literal 'team'. 'team' is still forbidden as a bare literal
// like every other name below.
const { STRUCTURAL_DIRS } = require(path.join(REPO_ROOT, 'lib', 'core', 'section-registry.cjs'));

function stripComments(src) {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlock
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

let skipped = 0;

function readStripped(rel) {
  const abs = path.join(REPO_ROOT, rel);
  if (!fs.existsSync(abs)) {
    if (rel === 'lib/core/icm-forest.cjs') {
      throw new Error('operator core not created yet (plan 270-07) - RED by design: ' + rel);
    }
    skipped += 1;
    return null;
  }
  return stripComments(fs.readFileSync(abs, 'utf8'));
}

function containsQuotedLiteral(src, name) {
  return src.indexOf("'" + name + "'") !== -1 || src.indexOf('"' + name + '"') !== -1;
}

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-270-baseline-schema-driven');

let ranRules = 0;

ok('baseline.1 IMPORT PRESENT: icm-forest.cjs requires room-skeleton-scaffold.cjs and references its exports', function () {
  const src = readStripped('lib/core/icm-forest.cjs');
  ranRules += 1;
  assert.ok(src.indexOf('room-skeleton-scaffold.cjs') !== -1, 'no require of room-skeleton-scaffold.cjs');
  const referencesAtLeastOne = ['SECTION_NAMES', 'SECTION_METADATA', 'IDENTITY_DIRECTORIES']
    .some((id) => src.indexOf(id) !== -1);
  assert.ok(referencesAtLeastOne, 'no reference to SECTION_NAMES / SECTION_METADATA / IDENTITY_DIRECTORIES by identifier');
});

ok('baseline.2 NO INLINED SECTION LITERAL: no canonical name or identity dir name is written as a literal', function () {
  ranRules += 1;
  const names = SECTION_NAMES.concat(Object.keys(IDENTITY_DIRECTORIES));
  const offenders = [];
  for (const file of OPERATOR_FILES) {
    const src = readStripped(file);
    if (src === null) continue;
    for (const name of names) {
      if (containsQuotedLiteral(src, name)) offenders.push(file + ':' + name);
    }
  }
  assert.equal(
    offenders.length,
    0,
    "inlined section/identity-dir literal found -- disambiguate 'team' via STRUCTURAL_DIRS.includes(name), " +
      'never a bare literal: ' + offenders.join(', ')
  );
  // Self-check: STRUCTURAL_DIRS really is the escape hatch this rule names,
  // not an invented one.
  assert.ok(STRUCTURAL_DIRS.indexOf('team') !== -1, 'self-check: STRUCTURAL_DIRS must contain "team"');
});

ok('baseline.3 NO FROZEN-COUNT ASSERTION: the operator never restates the frozen 8/5 count', function () {
  ranRules += 1;
  const patterns = ['=== 8', '=== 5', '!== 8', '!== 5', '.length === 8', '.length === 5'];
  const offenders = [];
  for (const file of OPERATOR_FILES) {
    const src = readStripped(file);
    if (src === null) continue;
    for (const p of patterns) {
      if (src.indexOf(p) !== -1) offenders.push(file + ':' + p);
    }
  }
  assert.equal(
    offenders.length,
    0,
    'frozen-count assertion found -- lib/core/room-skeleton-scaffold.test.cjs:251 is the ONE legitimate ' +
      'home of the exactly-8/exactly-5 assertions; a second copy silently diverges when OQ-7 lands: ' +
      offenders.join(', ')
  );
});

ok('baseline.4 SUBSET IS NOT AN ERROR: no throw/refusal path treats a missing canonical section as a defect', function () {
  ranRules += 1;
  const forbiddenPhrases = ['missing section', 'incomplete room', 'section_missing'];
  const offenders = [];
  for (const file of OPERATOR_FILES) {
    const src = readStripped(file);
    if (src === null) continue;
    const statements = src.split(/[;\n]/);
    for (const stmt of statements) {
      const isRefusal = stmt.indexOf('throw') !== -1 || stmt.indexOf('ok: false') !== -1 || stmt.indexOf('ok:false') !== -1;
      if (!isRefusal) continue;
      for (const phrase of forbiddenPhrases) {
        if (stmt.toLowerCase().indexOf(phrase) !== -1) offenders.push(file + ': "' + stmt.trim().slice(0, 80) + '"');
      }
    }
  }
  assert.equal(
    offenders.length,
    0,
    'a blueprint-subset room must be a normal room (room-skeleton-scaffold.cjs:202-254 resolveBlueprint ' +
      'returns a validated SUBSET; :353 iterates sectionList, not SECTION_NAMES): ' + offenders.join(', ')
  );
});

console.log(
  '\nPASS test-270-baseline-schema-driven (' + n + ' rules run, ' +
  OPERATOR_FILES.length + ' operator files declared, ' + skipped + ' skipped as not-yet-created)'
);
