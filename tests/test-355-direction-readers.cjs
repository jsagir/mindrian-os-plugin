#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection
 * engines) Plan 12 (HIPS-01, D-07) -- readers and duplicates.
 *
 * Task 1: the three duplicate direction-id enums (eureka-critic.cjs,
 * eureka-offer.cjs, grill-engine.cjs) and the eureka_critic zod schema in
 * tool-router.cjs all now source the two wire ids from
 * lib/core/direction-convention.cjs's DIRECTIONS instead of carrying a
 * second copy. eureka-reach-runner.cjs and sensor-eureka.cjs are the two
 * named 355-19 carve-outs (they move with the schema_version bump, not this
 * plan).
 *
 * Task 2: producers that store a direction/innovation label in a room
 * (scripts/hsi-to-graph.cjs) and readers that surface one
 * (lib/core/nl-graph-queries.cjs) never trust the stored string; they
 * re-derive it fresh from the stored similarity pair (or suppress it,
 * REVERSE_SALIENT's innovation_type, unless the edge is rs-engine-sourced)
 * every time. lib/chat/fabric-chat.cjs and scripts/generate-chat-embed.cjs
 * carry the same honesty note in their LLM-facing schema descriptions.
 *
 * Test hygiene contract (every 355 test): scrub TYPESAFE_API_KEY and install
 * the net guard via tests/helpers/hygiene-355.cjs BEFORE requiring any repo
 * module; assert attempts() === 0 as the last check.
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

const checker = hygiene.makeChecker('test-355-direction-readers');
const { check } = checker;

const d = require(path.join(REPO, 'lib', 'core', 'direction-convention.cjs'));
const { DIRECTIONS, classify } = d;

// ---------------------------------------------------------------------------
// Task 1: duplicate enums and the eureka_critic zod enum take DIRECTIONS
// (D-07)
// ---------------------------------------------------------------------------

// Leg 1a: static sweep. The only non-comment two-literal direction-id arrays
// left under lib/ are direction-convention.cjs itself (the definition) and
// the two named 355-19 carve-outs.
const TWO_LITERAL_ARRAY =
  /\[\s*['"](?:structural_transfer|semantic_implementation)['"]\s*,\s*['"](?:structural_transfer|semantic_implementation)['"]\s*\]/;

const ALLOWED_ARRAY_HITS = [
  path.join('lib', 'core', 'direction-convention.cjs'), // the definition itself
  path.join('lib', 'core', 'eureka', 'eureka-reach-runner.cjs'), // moves in 355-19
  path.join('lib', 'core', 'sensors', 'sensor-eureka.cjs'), // moves in 355-19
];

function sweepLibForTwoLiteralArrays() {
  const files = hygiene.listFilesRecursive(path.join(REPO, 'lib')).filter((f) => f.endsWith('.cjs'));
  const hits = [];
  for (const abs of files) {
    const lines = hygiene.nonCommentLines(abs);
    for (const line of lines) {
      if (TWO_LITERAL_ARRAY.test(line)) {
        hits.push(path.relative(REPO, abs));
        break;
      }
    }
  }
  return hits;
}

const arrayHits = sweepLibForTwoLiteralArrays();
const unresolvedArrayHits = arrayHits.filter((rel) => ALLOWED_ARRAY_HITS.indexOf(rel) === -1);
check(
  'T1 static: no unresolved two-literal direction-id arrays under lib/ (allowed: direction-convention.cjs + the two 355-19 carve-outs)',
  unresolvedArrayHits.length === 0,
  unresolvedArrayHits.length ? 'unresolved: ' + unresolvedArrayHits.join(', ') : undefined
);
check(
  'T1 static: the two 355-19 carve-outs are still present (unwidened exception list)',
  arrayHits.indexOf(path.join('lib', 'core', 'eureka', 'eureka-reach-runner.cjs')) !== -1 &&
    arrayHits.indexOf(path.join('lib', 'core', 'sensors', 'sensor-eureka.cjs')) !== -1
);

// Leg 1b: each of the four files requires direction-convention.cjs.
const REQUIRING_FILES = [
  path.join('lib', 'core', 'eureka-critic.cjs'),
  path.join('lib', 'core', 'eureka', 'eureka-offer.cjs'),
  path.join('lib', 'core', 'grill-engine.cjs'),
  path.join('lib', 'mcp', 'tool-router.cjs'),
];
for (const rel of REQUIRING_FILES) {
  const abs = path.join(REPO, rel);
  const found = hygiene.nonCommentLines(abs).some((line) => line.indexOf('direction-convention.cjs') !== -1);
  check('T1 ' + rel + ' requires direction-convention.cjs', found);
}

// Leg 1c: eureka-critic.cjs's SURPRISE_TYPES (internal, not exported) is
// exercised indirectly through criticRule's own closed-enum guard: a payload
// carrying each DIRECTIONS member must validate; anything outside DIRECTIONS
// must throw.
{
  const eurekaCritic = require(path.join(REPO, 'lib', 'core', 'eureka-critic.cjs'));
  const tags = eurekaCritic.loadCriticTags();
  const basePayload = {
    differential_score: 0.5,
    semantic_similarity: 0.5,
    lsa_similarity: 0.2,
    source_domain_tag: tags.domain_tags[0],
    target_domain_tag: tags.domain_tags[0],
    rubric_pattern: '000000',
    schema_version: tags.schema_version,
  };
  for (const member of DIRECTIONS) {
    let threw = false;
    try {
      eurekaCritic.criticRule(Object.assign({}, basePayload, { surprise_type: member }));
    } catch (e) {
      threw = true;
    }
    check('T1 eureka-critic criticRule accepts DIRECTIONS member ' + member, threw === false);
  }
  let rejectedNone = false;
  try {
    eurekaCritic.criticRule(Object.assign({}, basePayload, { surprise_type: 'none' }));
  } catch (e) {
    rejectedNone = true;
  }
  check('T1 eureka-critic criticRule rejects a non-DIRECTIONS surprise_type ("none")', rejectedNone === true);
}

// Leg 1d: eureka-offer.cjs's exported DIRECTION_ENUM deep-equals DIRECTIONS.
{
  const eurekaOffer = require(path.join(REPO, 'lib', 'core', 'eureka', 'eureka-offer.cjs'));
  check(
    'T1 eureka-offer DIRECTION_ENUM === direction-convention DIRECTIONS',
    JSON.stringify(eurekaOffer.DIRECTION_ENUM) === JSON.stringify(DIRECTIONS)
  );
}

// Leg 1e: grill-engine.cjs's internal EUREKA_SURPRISE_TYPES is not exported
// (validateEurekaSignal is the only consumer); the static sweep above is the
// authoritative proof for this file. This is a load-time smoke check only:
// requiring the module must not throw now that it imports
// direction-convention.cjs.
{
  const grillEngine = require(path.join(REPO, 'lib', 'core', 'grill-engine.cjs'));
  check('T1 grill-engine.cjs loads cleanly after importing direction-convention.cjs', typeof grillEngine.runGrill === 'function');
}

// Leg 1f: tool-router.cjs's eureka_critic input schema accepts exactly
// DIRECTIONS for surprise_type, and schema_version is unchanged (still an
// int field, no literal bump).
{
  const router = require(path.join(REPO, 'lib', 'mcp', 'tool-router.cjs'));
  const schemas = {};
  const fakeServer = {
    tool(name, _desc, schema) {
      schemas[name] = schema;
    },
  };
  const fakeRoomDir = path.join(REPO, '__nonexistent_355_readers_probe_room__');
  router.registerRouterTools(fakeServer, fakeRoomDir, REPO, { compact: '' }, 'cli');
  const surpriseTypeSchema = schemas.eureka_critic && schemas.eureka_critic.surprise_type;
  check('T1 tool-router eureka_critic schema captured', !!surpriseTypeSchema);
  if (surpriseTypeSchema) {
    for (const member of DIRECTIONS) {
      const r = surpriseTypeSchema.safeParse(member);
      check('T1 tool-router eureka_critic surprise_type accepts ' + member, r.success === true);
    }
    const rejectNone = surpriseTypeSchema.safeParse('none');
    const rejectBridge = surpriseTypeSchema.safeParse('meaning_bridge');
    check('T1 tool-router eureka_critic surprise_type rejects "none"', rejectNone.success === false);
    check('T1 tool-router eureka_critic surprise_type rejects "meaning_bridge"', rejectBridge.success === false);
  }
  const schemaVersionSchema = schemas.eureka_critic && schemas.eureka_critic.schema_version;
  check('T1 tool-router eureka_critic schema_version field still present (unchanged shape)', !!schemaVersionSchema);
}

// ---------------------------------------------------------------------------
// Summary (Task 2 legs are appended by the second commit of this plan).
// ---------------------------------------------------------------------------
check('installNetGuard: zero fetch attempts', netGuard.attempts() === 0);
netGuard.restore();
console.log('scrubVendorKey found a pre-set TYPESAFE_API_KEY: ' + hadKey);
process.exit(checker.summary());
