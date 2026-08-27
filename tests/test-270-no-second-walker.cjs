#!/usr/bin/env node
'use strict';

/*
 * Phase 270-03 Task 1, File A -- Canon Part 7 delegation census over the
 * operator's own files, mirroring tests/test-248-resolver-census.cjs.
 *
 * `lib/core/memory/reconcile-memory-runner.cjs:144-145` states the rule this
 * test enforces, verbatim in substance: "NO hand-rolled walker - Part 7
 * reuse ... recurses into each ROOM.md-bearing sub-section via the shared
 * sectionRegistry.discoverSections helper." `walkFractalMemory` (Walker A)
 * and `rollupSubRooms` (Walker B, lib/core/graph-derivation.cjs) already
 * walk; `discoverIcmForest` (plan 270-07) must delegate to them, never
 * hand-roll a second recursive directory descent.
 *
 * GREP HYGIENE WARNING (test-248's own rule, load-bearing here): this header
 * itself mentions "readdirSync" and "DEPTH_CAP" and "healRoom" in prose, so
 * a raw grep over this FILE would find the very tokens it forbids. Every
 * scan below reads ONLY the files named in OPERATOR_FILES, via
 * readStripped(), never this file's own source.
 *
 * No em-dashes. CJS only. node:assert, node:fs, node:path only.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

// The operator files this phase adds. Declared independently in this file
// and in tests/test-270-baseline-schema-driven.cjs (the plan's own
// instruction: both files declare the same list, separately, not shared via
// a require, so each test stays independently runnable).
const OPERATOR_FILES = [
  'lib/core/icm-forest.cjs',
  'lib/mcp/tree-watcher.cjs',
  'lib/mcp/tools/context.cjs',
  'lib/mcp/tools/graph-reason.cjs',
  'lib/mcp/tools/identity.cjs',
  'lib/mcp/tools/dual-path.cjs',
];

function stripComments(src) {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlock
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

let skipped = 0;

// readStripped(rel) -- read + comment-strip an operator file. A missing
// lib/core/icm-forest.cjs is a HARD FAIL (Wave 0 is red for a stated
// reason); a missing file elsewhere in OPERATOR_FILES is a SKIP (it
// legitimately arrives in a later wave).
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

// extractFunctionBodies(src) -- returns [{name, body}] for every
// `function <name>(...) { ... }` declaration, matched by brace balancing
// (never a single regex over the whole body -- a nested block would break
// that). Best-effort, scoped to this repo's plain CJS function declarations.
function extractFunctionBodies(src) {
  const results = [];
  const re = /function\s+([A-Za-z_$][\w$]*)\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    const name = m[1];
    let i = re.lastIndex;
    let parenDepth = 1;
    while (i < src.length && parenDepth > 0) {
      if (src[i] === '(') parenDepth += 1;
      else if (src[i] === ')') parenDepth -= 1;
      i += 1;
    }
    let j = i;
    while (j < src.length && src[j] !== '{') j += 1;
    if (j >= src.length) { re.lastIndex = i; continue; }
    let braceDepth = 1;
    let k = j + 1;
    while (k < src.length && braceDepth > 0) {
      if (src[k] === '{') braceDepth += 1;
      else if (src[k] === '}') braceDepth -= 1;
      k += 1;
    }
    results.push({ name, body: src.slice(j, k) });
    re.lastIndex = k;
  }
  return results;
}

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-270-no-second-walker');

let ranRules = 0;

ok('walker.1 DELEGATION PRESENT: icm-forest.cjs requires the five reuse targets', function () {
  const src = readStripped('lib/core/icm-forest.cjs');
  ranRules += 1;
  const required = [
    './section-registry.cjs',
    './graph-derivation.cjs',
    './memory/reconcile-memory-runner.cjs',
    './room-skeleton-scaffold.cjs',
    './coverage-rollup.cjs',
  ];
  const missing = required.filter((req) => src.indexOf(req) === -1);
  assert.equal(missing.length, 0, 'missing required delegation to: ' + missing.join(', '));
});

ok('walker.2 NO SECOND DESCENT: no operator function is both readdirSync-calling and self-recursive', function () {
  ranRules += 1;
  const offenders = [];
  for (const file of OPERATOR_FILES) {
    const src = readStripped(file);
    if (src === null) continue;
    const fns = extractFunctionBodies(src);
    for (const fn of fns) {
      const callsReaddir = fn.body.indexOf('readdirSync') !== -1;
      const callsSelf = fn.body.indexOf(fn.name + '(') !== -1;
      if (callsReaddir && callsSelf) offenders.push(file + ':' + fn.name);
    }
  }
  assert.equal(
    offenders.length,
    0,
    'self-recursive readdirSync walker found (a second hand-rolled descent): ' + offenders.join(', ')
  );
});

ok('walker.3 NO SECOND DEPTH CONSTANT: DEPTH_CAP is only ever an imported reference', function () {
  ranRules += 1;
  const depthAssignRe = /(?:const|let|var)\s+\w*DEPTH_CAP\w*\s*=/;
  const depthLiteralRe = /[A-Za-z_$][\w$]*depth[\w$]*\s*[:=]\s*3\b/i;
  const offenders = [];
  for (const file of OPERATOR_FILES) {
    const src = readStripped(file);
    if (src === null) continue;
    if (depthAssignRe.test(src)) offenders.push(file + ' (redeclares DEPTH_CAP)');
    if (depthLiteralRe.test(src)) offenders.push(file + ' (numeric literal 3 bound to a depth-named identifier)');
  }
  assert.equal(
    offenders.length,
    0,
    'second depth policy found -- lib/core/coverage-rollup.cjs:41 is the one place DEPTH_CAP may live: ' +
      offenders.join(', ')
  );
});

ok('walker.4 NO PROMOTION FROM DISCOVERY: discovery never calls the promotion primitives', function () {
  ranRules += 1;
  const forbidden = ['healRoom', 'approvedBy', 'birthRoom', 'confirmNode'];
  const offenders = [];
  for (const file of OPERATOR_FILES) {
    const src = readStripped(file);
    if (src === null) continue;
    for (const token of forbidden) {
      if (src.indexOf(token) !== -1) offenders.push(file + ':' + token);
    }
  }
  assert.equal(
    offenders.length,
    0,
    'discovery code calls a promotion primitive (only a human-approved healRoom call may promote a ' +
      'discovered folder -- {ok:false, reason:"no_approval"} is the refusal shape without it): ' +
      offenders.join(', ')
  );
});

console.log(
  '\nPASS test-270-no-second-walker (' + n + ' rules run, ' +
  OPERATOR_FILES.length + ' operator files declared, ' + skipped + ' skipped as not-yet-created)'
);
