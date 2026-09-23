#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection
 * engines) Plan 01 Task 2: pins lib/core/direction-convention.cjs (HIPS-01,
 * D-01, D-02) -- the one module that owns the wording-difference direction
 * rule and the two confirmed phrases, citing 355-ORIGIN-CONCEPT.md section 3.
 *
 * Test hygiene contract (every 355 test, per the plan context block):
 * scrub TYPESAFE_API_KEY and install the net guard through
 * tests/helpers/hygiene-355.cjs BEFORE requiring any repo module; assert
 * attempts() === 0 as the last check.
 *
 * RED by design at first run: lib/core/direction-convention.cjs does not
 * exist yet.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

'use strict';

const path = require('node:path');
const fs = require('node:fs');
const hygiene = require('./helpers/hygiene-355.cjs');

const hadKey = hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

const REPO = path.join(__dirname, '..');
const MODULE_PATH = path.join(REPO, 'lib', 'core', 'direction-convention.cjs');

const checker = hygiene.makeChecker('test-355-direction-convention');
const { check } = checker;

let mod = null;
let loadError = null;
try {
  // eslint-disable-next-line global-require
  mod = require(MODULE_PATH);
} catch (e) {
  loadError = e;
}

check('lib/core/direction-convention.cjs loads without throwing', mod !== null, loadError ? String(loadError && loadError.message) : undefined);

if (mod === null) {
  console.log('RED: lib/core/direction-convention.cjs does not exist yet -- expected until this task lands GREEN');
  netGuard.restore();
  console.log('scrubVendorKey found a pre-set TYPESAFE_API_KEY: ' + hadKey);
  process.exit(checker.summary());
}

// ---------------------------------------------------------------------------
// classify(lsa, semantic) -- Convention A, sourced from 355-ORIGIN-CONCEPT.md
// section 3: signed_diff = semantic - lsa; > 0 -> structural_transfer (same
// meaning, different words); else -> semantic_implementation (same words,
// different meaning, includes the exact tie per D-02).
// ---------------------------------------------------------------------------
check("classify(0.2, 0.6) === 'structural_transfer'", mod.classify(0.2, 0.6) === 'structural_transfer');
check("classify(0.6, 0.2) === 'semantic_implementation'", mod.classify(0.6, 0.2) === 'semantic_implementation');
check("classify(0.4, 0.4) === 'semantic_implementation' (exact tie, D-02)", mod.classify(0.4, 0.4) === 'semantic_implementation');
check("classify(0, 0) === 'semantic_implementation'", mod.classify(0, 0) === 'semantic_implementation');

check("classify(null, 0.5) === 'none'", mod.classify(null, 0.5) === 'none');
check("classify(0.5, undefined) === 'none'", mod.classify(0.5, undefined) === 'none');
check("classify(NaN, 0.1) === 'none'", mod.classify(NaN, 0.1) === 'none');
check("classify('abc', 0.1) === 'none'", mod.classify('abc', 0.1) === 'none');
check("classify(0.1, Infinity) === 'none'", mod.classify(0.1, Infinity) === 'none');

check("classify('0.2', '0.6') === 'structural_transfer' (numeric strings coerce)", mod.classify('0.2', '0.6') === 'structural_transfer');

// ---------------------------------------------------------------------------
// classifyDiff(signedDiff)
// ---------------------------------------------------------------------------
check("classifyDiff(0.01) === 'structural_transfer'", mod.classifyDiff(0.01) === 'structural_transfer');
check("classifyDiff(0) === 'semantic_implementation'", mod.classifyDiff(0) === 'semantic_implementation');
check("classifyDiff(-0.3) === 'semantic_implementation'", mod.classifyDiff(-0.3) === 'semantic_implementation');
check("classifyDiff(null) === 'none'", mod.classifyDiff(null) === 'none');

// ---------------------------------------------------------------------------
// DIRECTIONS, DIRECTION_MEANING, NONE, NONE_MEANING
// ---------------------------------------------------------------------------
check(
  "DIRECTIONS deep-equals ['structural_transfer','semantic_implementation']",
  Array.isArray(mod.DIRECTIONS) &&
    mod.DIRECTIONS.length === 2 &&
    mod.DIRECTIONS[0] === 'structural_transfer' &&
    mod.DIRECTIONS[1] === 'semantic_implementation'
);
check('Object.isFrozen(DIRECTIONS) === true', Object.isFrozen(mod.DIRECTIONS) === true);

check(
  "DIRECTION_MEANING.structural_transfer === 'same meaning in different words'",
  mod.DIRECTION_MEANING && mod.DIRECTION_MEANING.structural_transfer === 'same meaning in different words'
);
check(
  "DIRECTION_MEANING.semantic_implementation === 'same words with different meaning'",
  mod.DIRECTION_MEANING && mod.DIRECTION_MEANING.semantic_implementation === 'same words with different meaning'
);
check("NONE === 'none'", mod.NONE === 'none');
check("NONE_MEANING === 'no wording signal measured'", mod.NONE_MEANING === 'no wording signal measured');

// ---------------------------------------------------------------------------
// phraseHash()
// ---------------------------------------------------------------------------
const hash1 = mod.phraseHash();
check('phraseHash() returns a 64-char hex sha256', typeof hash1 === 'string' && /^[0-9a-f]{64}$/.test(hash1));

const crypto = require('node:crypto');
const expectedHash = crypto
  .createHash('sha256')
  .update(
    JSON.stringify({
      DIRECTIONS: mod.DIRECTIONS,
      DIRECTION_MEANING: mod.DIRECTION_MEANING,
      NONE_MEANING: mod.NONE_MEANING,
    })
  )
  .digest('hex');
check('phraseHash() matches sha256(JSON.stringify({DIRECTIONS, DIRECTION_MEANING, NONE_MEANING}))', hash1 === expectedHash);

const alteredHash = crypto
  .createHash('sha256')
  .update(
    JSON.stringify({
      DIRECTIONS: mod.DIRECTIONS,
      DIRECTION_MEANING: { ...mod.DIRECTION_MEANING, structural_transfer: 'changed' },
      NONE_MEANING: mod.NONE_MEANING,
    })
  )
  .digest('hex');
check('phraseHash() changes when a phrase changes', alteredHash !== hash1);

// ---------------------------------------------------------------------------
// Static legs: module cites 355-ORIGIN-CONCEPT.md; requires only node:crypto.
// ---------------------------------------------------------------------------
const source = fs.readFileSync(MODULE_PATH, 'utf8');
check('module source cites 355-ORIGIN-CONCEPT.md', source.indexOf('355-ORIGIN-CONCEPT.md') !== -1);

const requireCalls = hygiene
  .nonCommentLines(MODULE_PATH)
  .join('\n')
  .match(/require\(([^)]*)\)/g) || [];
check(
  "module's only require( call is require('node:crypto')",
  requireCalls.length === 1 && /require\(\s*['"]node:crypto['"]\s*\)/.test(requireCalls[0]),
  'found: ' + JSON.stringify(requireCalls)
);
check('module source does not require zod', !/require\(\s*['"]zod['"]\s*\)/.test(source));

// ---------------------------------------------------------------------------
// Last check: the net guard proves zero network attempts.
// ---------------------------------------------------------------------------
check('installNetGuard: zero fetch attempts', netGuard.attempts() === 0);

netGuard.restore();
console.log('scrubVendorKey found a pre-set TYPESAFE_API_KEY: ' + hadKey);
process.exit(checker.summary());
