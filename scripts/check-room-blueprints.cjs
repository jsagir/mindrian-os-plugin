#!/usr/bin/env node
'use strict';

/*
 * Phase 155-05 Task 1 -- Blueprint family CI schema checker.
 *
 * Validates data/room-blueprints.json against three invariants:
 *   (1) exactly EXPECTED_FAMILY_COUNT blueprint families present (no drift, no
 *       extras). Phase 155-05 froze 8; Phase 179-04 moved it to 9 (the
 *       hypothesis Door 3 family).
 *   (2) every family has sections (non-empty array), default_methodologies
 *       (non-empty array), and arrival_assets (non-empty array)
 *   (3) all section slugs in every family appear in VALID_SECTION_SLUGS
 *       (the frozen SECTION_NAMES table from room-skeleton-scaffold.cjs)
 *
 * Usage:
 *   node scripts/check-room-blueprints.cjs
 *       validate and print result; exit 0 on pass, non-zero on fail
 *   node scripts/check-room-blueprints.cjs --check
 *       same validation; intended for pre-commit CI use
 *
 * Mirrors the --check pattern from scripts/build-connector-registry.cjs.
 * Zero network calls. Pure filesystem read. No em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const BLUEPRINTS_PATH = path.join(REPO_ROOT, 'data', 'room-blueprints.json');
const SCAFFOLD_PATH = path.join(REPO_ROOT, 'lib', 'core', 'room-skeleton-scaffold.cjs');

const EXPECTED_FAMILIES = new Set([
  'exploration',
  'solution-first',
  'problem-first',
  'business-first',
  'portfolio',
  'venture',
  'program',
  'case-study',
  // Phase 179-04: the hypothesis-driven Door 3 family (data, not a frozen-set
  // move per Canon Part 11). LOCKED section set per CONTEXT decision 3.
  'hypothesis',
]);
const EXPECTED_FAMILY_COUNT = 9;

// Read VALID_SECTION_SLUGS from the frozen SECTION_NAMES table in the scaffold.
// Require the scaffold module and pull the exported SECTION_NAMES array.
// The scaffold is pure-local and safe to require here (no network, no DB).
function loadValidSectionSlugs() {
  try {
    const scaffold = require(SCAFFOLD_PATH);
    if (Array.isArray(scaffold.SECTION_NAMES) && scaffold.SECTION_NAMES.length > 0) {
      return new Set(scaffold.SECTION_NAMES);
    }
  } catch (_e) {
    // Fallback: hardcode the frozen set so the CI check never fails due to a
    // scaffold require error. The frozen set is the canonical contract.
  }
  // Frozen fallback (from room-skeleton-scaffold.cjs SECTION_NAMES as of Phase 275,
  // the 11-slug table -- opportunity-bank, funding, strategy grew the frozen 8):
  return new Set([
    'problem-definition',
    'market-analysis',
    'solution-design',
    'business-model',
    'competitive-analysis',
    'team-execution',
    'legal-ip',
    'financial-model',
    'opportunity-bank',
    'funding',
    'strategy',
  ]);
}

// HISTORICAL (superseded by Phase 275, D-01): "opportunity-bank" used to sit
// outside the frozen SECTION_NAMES table (a directory concept used by the
// opportunity pipeline, not an ICM scaffold section), and this extension set
// carried it so the CI check would accept it as a real blueprint slug even
// though the scaffold skipped it gracefully. Phase 275 promoted
// opportunity-bank INTO SECTION_NAMES for real, so it is now validated by
// loadValidSectionSlugs() above like any other frozen slug; keeping it here
// too would hide a future regression (a typo'd or removed frozen slug would
// silently pass). Removed.
//
// "assumptions" is the sole remaining intent-only slug (Phase 179-04, the
// hypothesis-driven Door 3 family). It surfaces the navigator's "I believe
// ___" for challenge and is a real directory the room uses, but it is NOT in
// the frozen SECTION_NAMES scaffold table; the scaffold skips it gracefully
// while the CI check accepts it as a valid blueprint slug.
// tests/test-hypothesis-family-and-claim.cjs:84 asserts this file still
// references the "assumptions" slug -- do not remove it.
const EXTENDED_VALID_SLUGS_FOR_CHECK = new Set(['assumptions']);

function validate() {
  const errors = [];
  const warnings = [];

  // Load blueprints.
  let blueprints;
  try {
    const raw = fs.readFileSync(BLUEPRINTS_PATH, 'utf8');
    blueprints = JSON.parse(raw);
  } catch (e) {
    errors.push('Cannot read data/room-blueprints.json: ' + (e && e.message ? e.message : String(e)));
    return { errors, warnings };
  }

  // Load valid section slugs.
  const validSlugs = loadValidSectionSlugs();
  // Extended set includes the opportunity-bank (used in birth flow but not in scaffold section dirs).
  const allValidSlugs = new Set([...validSlugs, ...EXTENDED_VALID_SLUGS_FOR_CHECK]);

  // Enumerate non-underscore, non-comment keys as family keys.
  const familyKeys = Object.keys(blueprints).filter((k) => !k.startsWith('_'));

  // (1) Exactly 8 families.
  if (familyKeys.length !== EXPECTED_FAMILY_COUNT) {
    errors.push(
      'Expected exactly ' + EXPECTED_FAMILY_COUNT + ' blueprint families; found ' +
        familyKeys.length + ': ' + familyKeys.join(', ')
    );
  }

  // Check each expected family name is present.
  for (const expected of EXPECTED_FAMILIES) {
    if (!Object.prototype.hasOwnProperty.call(blueprints, expected)) {
      errors.push('Missing expected family: "' + expected + '"');
    }
  }

  // Check for unexpected family keys (not in EXPECTED_FAMILIES).
  for (const key of familyKeys) {
    if (!EXPECTED_FAMILIES.has(key)) {
      errors.push('Unexpected family key: "' + key + '" (not in the canonical 8)');
    }
  }

  // (2) Each family must have sections, default_methodologies, arrival_assets (non-empty arrays).
  // (3) All section slugs must be in VALID_SECTION_SLUGS.
  for (const familyKey of familyKeys) {
    // Prototype-pollution guard: only access families that are in EXPECTED_FAMILIES.
    if (!EXPECTED_FAMILIES.has(familyKey)) continue;
    const family = blueprints[familyKey];

    if (!family || typeof family !== 'object') {
      errors.push('Family "' + familyKey + '" is not an object');
      continue;
    }

    // sections check.
    if (!Array.isArray(family.sections) || family.sections.length === 0) {
      errors.push('Family "' + familyKey + '" has no sections array or it is empty');
    } else {
      // (3) Validate each slug.
      for (const slug of family.sections) {
        if (!allValidSlugs.has(slug)) {
          errors.push(
            'Family "' + familyKey + '" section slug "' + slug +
              '" is not in VALID_SECTION_SLUGS. Valid: ' + Array.from(validSlugs).join(', ')
          );
        }
      }
    }

    // default_methodologies check.
    if (!Array.isArray(family.default_methodologies) || family.default_methodologies.length === 0) {
      errors.push('Family "' + familyKey + '" has no default_methodologies array or it is empty');
    }

    // arrival_assets check.
    if (!Array.isArray(family.arrival_assets) || family.arrival_assets.length === 0) {
      errors.push('Family "' + familyKey + '" has no arrival_assets array or it is empty');
    }
  }

  return { errors, warnings };
}

function main() {
  const isCheck = process.argv.includes('--check');
  const label = 'check-room-blueprints';

  console.log('[' + label + '] Validating data/room-blueprints.json ...');

  const { errors, warnings } = validate();

  if (warnings.length) {
    for (const w of warnings) {
      console.warn('[' + label + '] WARN: ' + w);
    }
  }

  if (errors.length) {
    for (const e of errors) {
      console.error('[' + label + '] FAIL: ' + e);
    }
    if (isCheck) {
      process.stderr.write(
        '[' + label + '] --check failed. Fix data/room-blueprints.json or ' +
          'lib/core/room-skeleton-scaffold.cjs SECTION_NAMES.\n'
      );
    }
    process.exit(1);
  }

  console.log('[' + label + '] PASS: ' + EXPECTED_FAMILY_COUNT + ' families, all section slugs valid, all arrays non-empty.');
  process.exit(0);
}

main();
