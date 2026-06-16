#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 160-01 Task 2 -- Canon Part 8 boundary sweep over the reference-now seam.
 * =============================================================================
 *
 * R1 (160-SPEC.md) + threat register (160-01-PLAN.md):
 *   T-160-01 (Information Disclosure): the ONLY network surface
 *     (fetchTimeOffsetOnce) is a bare GET reading only the HTTP Date header --
 *     no body, no user-derived query/header. Zero user bytes egress.
 *   Part 8 (LOCAL -> BRAIN: NO): the reference-now seam + the seeder make ZERO
 *     Brain query. The Phase 157 boundary scan stays GREEN.
 *
 * Method: an adversarial forbidden-substring sweep over the SOURCE of
 *   lib/core/temporal/reference-now.cjs and scripts/sessionstart-reference-now-seed.cjs.
 *   Comment/header lines (lines whose first non-space char is `*`, `/`, or `#`,
 *   i.e. block-comment bodies, line comments, and shebang) are FILTERED OUT
 *   before the match count so the doctrine prose in the file header does not
 *   self-invalidate the scan (the plan's grep -v '^#' requirement, generalized
 *   to JS comment syntax). A forbidden Brain-egress token in EXECUTABLE code is
 *   a hard FAIL.
 *
 * Prints per-check PASS/FAIL. Exits non-zero on any breach. House rule: hyphens
 * only, no em-dashes. Pure CJS, node built-ins only.
 */

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const REPO_ROOT = path.resolve(__dirname, '..');

const REFNOW_PATH = path.join(REPO_ROOT, 'lib', 'core', 'temporal', 'reference-now.cjs');
const SEEDER_PATH = path.join(REPO_ROOT, 'scripts', 'sessionstart-reference-now-seed.cjs');

// Forbidden Brain-egress / user-data-egress tokens. A reference clock has NO
// business touching the Brain or any remote enrichment endpoint.
const FORBIDDEN_TOKENS = [
  /\bbrain\b/i,
  /\bmcp\b/i,
  /\btavily\b/i,
  /onrender/i,
  /mindrian-brain/i,
  /sendPacket/,
  /buildBrainPacket/,
  /firecrawl/i,
  /\bexa\b/i,
  /pinecone/i,
];

// Forbidden network-request shapes that would carry user bytes (a request body,
// a POST, a user-derived query string). The reference clock's only legal network
// shape is a bare GET reading the HTTP Date header.
const FORBIDDEN_EGRESS_SHAPES = [
  /method:\s*['"]POST['"]/i,
  /method:\s*['"]PUT['"]/i,
  /body:\s*/,
  /JSON\.stringify\([^)]*\)\s*\}\s*\)/,   // a stringified body passed to fetch opts
  /searchParams/,
  /\?\$\{/,                                // template-literal query string
];

let failed = 0;

function isCommentOrShebangLine(line) {
  const t = line.trimStart();
  if (t.length === 0) return true;            // blank line, ignore
  if (t.startsWith('//')) return true;        // line comment
  if (t.startsWith('*')) return true;         // block-comment body
  if (t.startsWith('/*')) return true;        // block-comment open
  if (t.startsWith('#')) return true;         // shebang / hash
  return false;
}

// Returns the executable (non-comment) source of a file as a single string,
// mirroring the plan's `grep -v '^#'` filter generalized to JS comment syntax.
function executableSource(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw
    .split(/\r?\n/)
    .filter((line) => !isCommentOrShebangLine(line))
    .join('\n');
}

function sweepForbiddenTokens(label, filePath) {
  const src = executableSource(filePath);
  const hits = [];
  for (const re of FORBIDDEN_TOKENS) {
    const m = src.match(re);
    if (m) hits.push(re.toString() + ' -> "' + m[0] + '"');
  }
  if (hits.length === 0) {
    console.log('PASS [' + label + '] zero forbidden Brain-egress tokens in executable source');
  } else {
    failed += 1;
    console.error('FAIL [' + label + '] forbidden tokens found: ' + hits.join('; '));
  }
}

function sweepEgressShapes(label, filePath) {
  const src = executableSource(filePath);
  const hits = [];
  for (const re of FORBIDDEN_EGRESS_SHAPES) {
    const m = src.match(re);
    if (m) hits.push(re.toString() + ' -> "' + m[0] + '"');
  }
  if (hits.length === 0) {
    console.log('PASS [' + label + '] only network surface carries no user bytes (bare GET)');
  } else {
    failed += 1;
    console.error('FAIL [' + label + '] forbidden egress shape found: ' + hits.join('; '));
  }
}

// CHECK A + B: forbidden Brain-egress token sweep over both source files.
sweepForbiddenTokens('reference-now.cjs', REFNOW_PATH);
sweepForbiddenTokens('seeder', SEEDER_PATH);

// CHECK C + D: forbidden egress-shape sweep over both source files.
sweepEgressShapes('reference-now.cjs', REFNOW_PATH);
sweepEgressShapes('seeder', SEEDER_PATH);

// CHECK E: positive assertion -- the ONLY fetch call in reference-now.cjs is a
// bare GET. Confirm exactly one fetch invocation and that it uses method GET.
(function checkBareGet() {
  const src = executableSource(REFNOW_PATH);
  const fetchCalls = src.match(/fetchImpl\s*\(/g) || [];
  const getMethods = src.match(/method:\s*['"]GET['"]/g) || [];
  try {
    assert.ok(fetchCalls.length >= 1, 'expected at least one fetchImpl( call');
    assert.equal(getMethods.length, fetchCalls.length,
      'every fetch invocation must declare method GET (found ' + getMethods.length
      + ' GET vs ' + fetchCalls.length + ' fetch calls)');
    console.log('PASS [reference-now.cjs] the only network surface is a bare GET (' + fetchCalls.length + ' call)');
  } catch (err) {
    failed += 1;
    console.error('FAIL [reference-now.cjs] bare-GET assertion: ' + err.message);
  }
})();

// CHECK F: the seeder makes NO network call of its own (it only DELEGATES to
// fetchTimeOffsetOnce, which lives in reference-now.cjs). No raw fetch( in the
// seeder executable source.
(function checkSeederNoRawFetch() {
  const src = executableSource(SEEDER_PATH);
  const rawFetch = src.match(/(^|[^.\w])fetch\s*\(/g) || [];
  try {
    assert.equal(rawFetch.length, 0, 'the seeder must not call fetch directly; it delegates to fetchTimeOffsetOnce');
    console.log('PASS [seeder] no direct network call (delegates to the core skew corrector)');
  } catch (err) {
    failed += 1;
    console.error('FAIL [seeder] ' + err.message);
  }
})();

if (failed > 0) {
  console.error('\nreference-now Part 8 sweep: ' + failed + ' check(s) FAILED');
  process.exit(1);
}
console.log('\nreference-now Part 8 sweep: all checks PASSED');
process.exit(0);
