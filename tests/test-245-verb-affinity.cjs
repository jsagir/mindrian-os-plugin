'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 245-04 Task 3 -- test-245-verb-affinity.
 *
 * WHAT THIS PINS: the VERB_REACH_AFFINITY contract that Requirement 1's
 * Brain-verb fusion term will consume. Shape, value domain, frozenness, the
 * coverage census as a NUMBER, defensive lookup, and the zero-I/O property.
 *
 * WHY THE COVERAGE CENSUS IS A NUMBER AND NOT A VIBE: 5 of the 10 frozen
 * CANONICAL_VERBS have no reach preimage (245-RESEARCH.md F-8). That is a real
 * coverage hole, and the honest way to carry it is to assert the count so it
 * cannot drift silently in either direction. If a later phase closes the hole
 * (by wiring a reach that maps to one of those verbs) this test reddens and
 * forces the number, the comment, and the SUMMARY to be updated together.
 *
 * WHY THIS TEST TOUCHES NO ENCODER: the runtime lookup is a plain frozen-object
 * read. The build-time derivation script is where the encoder lives, and it
 * gates no build and no release by design, so pulling it in here would make a
 * hermetic contract test depend on a model cache. This file requires nothing
 * under lib/core/eureka/ and performs no network access.
 *
 * Bare node script, no framework, exits non-zero on failure, self-contained.
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const affinity = require('../lib/core/verb-reach-affinity.cjs');
const { VERB_REACH_AFFINITY, verbReachAffinity } = affinity;
const { CANONICAL_VERBS } = require('../lib/core/navigation-engine-shared.cjs');
const orchestrator = require('../lib/hmi/dial-reach-orchestrator.cjs');

const FROZEN_REACH_IDS = orchestrator.REACH_IDS;

let checks = 0;
function ok(label) {
  checks++;
  console.log('  ok - ' + label);
}

console.log('test-245-verb-affinity:');

// ---------------------------------------------------------------------------
// Arm 1: key-set equality against Canon Part 3's closed 10-verb vocabulary.
//
// Asserted in BOTH directions on purpose. A one-directional check (every
// canonical verb has an entry) would pass happily while an 11th bogus key sat
// in the table steering the fusion term off a verb the router can never emit.
// ---------------------------------------------------------------------------
const tableKeys = Object.keys(VERB_REACH_AFFINITY);
const canonSet = new Set(CANONICAL_VERBS);
const tableSet = new Set(tableKeys);

assert.strictEqual(
  tableKeys.length,
  CANONICAL_VERBS.length,
  'VERB_REACH_AFFINITY must have exactly ' + CANONICAL_VERBS.length
    + ' entries, has ' + tableKeys.length
);
for (const verb of CANONICAL_VERBS) {
  assert.ok(
    tableSet.has(verb),
    'CANONICAL_VERBS member missing from VERB_REACH_AFFINITY: ' + verb
  );
}
for (const key of tableKeys) {
  assert.ok(
    canonSet.has(key),
    'VERB_REACH_AFFINITY key is not a CANONICAL_VERBS member: ' + key
  );
}
ok('key set equals CANONICAL_VERBS exactly, in both directions');

// ---------------------------------------------------------------------------
// Arm 2: value domain. Every reach id is a member of the frozen six-reach set,
// every weight is in (0, 1], and every entry's weights sum to 1 within 1e-9.
//
// The reach id list is read from lib/hmi/dial-reach-orchestrator.cjs, the
// authority, NOT from the affinity module's own local mirror. Comparing a
// module against its own copy of the answer proves nothing.
// ---------------------------------------------------------------------------
assert.strictEqual(
  FROZEN_REACH_IDS.length,
  6,
  'the frozen reach set must have 6 members, has ' + FROZEN_REACH_IDS.length
);
const reachSet = new Set(FROZEN_REACH_IDS);

assert.deepStrictEqual(
  affinity.REACH_IDS.slice().sort(),
  FROZEN_REACH_IDS.slice().sort(),
  'the affinity module local REACH_IDS mirror has drifted from the orchestrator frozen set'
);

for (const verb of CANONICAL_VERBS) {
  const entry = VERB_REACH_AFFINITY[verb];
  if (entry === null) continue;

  const ids = Object.keys(entry);
  assert.ok(ids.length > 0, verb + ': a non-null entry must name at least one reach');

  let sum = 0;
  for (const id of ids) {
    assert.ok(
      reachSet.has(id),
      verb + ': reach id "' + id + '" is not a member of the frozen six-reach set'
    );
    const w = entry[id];
    assert.ok(
      typeof w === 'number' && Number.isFinite(w) && w > 0 && w <= 1,
      verb + '.' + id + ': weight must be a finite number in (0, 1], got ' + String(w)
    );
    sum += w;
  }
  assert.ok(
    Math.abs(sum - 1) <= 1e-9,
    verb + ': weights must sum to 1 within 1e-9, sum is ' + sum
  );
}
ok('every reach id is in the frozen six-reach set, every weight is in (0, 1], every entry sums to 1');

// ---------------------------------------------------------------------------
// Arm 3: frozen, table and every nested value. An unfrozen nested object lets a
// caller mutate a shared weight and silently re-steer every later turn in the
// process.
// ---------------------------------------------------------------------------
assert.ok(Object.isFrozen(VERB_REACH_AFFINITY), 'VERB_REACH_AFFINITY must be frozen');
for (const verb of CANONICAL_VERBS) {
  const entry = VERB_REACH_AFFINITY[verb];
  if (entry === null) continue;
  assert.ok(Object.isFrozen(entry), verb + ': the nested affinity object must be frozen');
}
assert.ok(Object.isFrozen(affinity.REACH_EXEMPLARS), 'REACH_EXEMPLARS must be frozen');
for (const id of Object.keys(affinity.REACH_EXEMPLARS)) {
  assert.ok(
    Object.isFrozen(affinity.REACH_EXEMPLARS[id]),
    id + ': the nested exemplar array must be frozen'
  );
}
ok('the table, every nested affinity object, and every exemplar array are frozen');

// ---------------------------------------------------------------------------
// Arm 4: the coverage census, as a NUMBER.
//
// 5 of the 10 canonical verbs have NO reach preimage today and are recorded as
// explicit null. Those five, and why:
//
//   'Reformulate'      - no reach fires it; it is a navigator-side re-framing move
//   'Scenario Plan'    - no reach fires it; scenario work is a methodology, not a reach
//   'Bank Opportunity' - no reach fires it; banking is a filing action
//   'Defer'            - no reach fires it; deferring is a Decision-Gate outcome
//   'Free-Text'        - the deliberate no-reach escape hatch
//
// The build-time derivation independently confirmed all five: each scored below
// AFFINITY_FLOOR against every one of the six reaches (top1 in 0.5229 .. 0.6929
// against a 0.70 floor), so the encoder found no affinity worth recording
// either. The count is 5. If a later phase wires a reach that maps onto one of
// these verbs, this assertion reddens on purpose: update the number, this
// comment, and the SUMMARY together, never one of the three alone.
// ---------------------------------------------------------------------------
const EXPECTED_NULL_VERBS = [
  'Reformulate',
  'Scenario Plan',
  'Bank Opportunity',
  'Defer',
  'Free-Text',
];
const EXPECTED_NULL_COUNT = 5;

const actualNullVerbs = CANONICAL_VERBS.filter((v) => VERB_REACH_AFFINITY[v] === null);

assert.strictEqual(
  actualNullVerbs.length,
  EXPECTED_NULL_COUNT,
  'coverage census drift: expected exactly ' + EXPECTED_NULL_COUNT
    + ' no-preimage verbs, found ' + actualNullVerbs.length
    + ' [' + actualNullVerbs.join(', ') + ']'
);
assert.deepStrictEqual(
  actualNullVerbs.slice().sort(),
  EXPECTED_NULL_VERBS.slice().sort(),
  'coverage census drift: the SET of no-preimage verbs changed, found ['
    + actualNullVerbs.join(', ') + ']'
);
ok('coverage census: exactly ' + EXPECTED_NULL_COUNT + ' verbs have no reach preimage, and they are the expected five');

// ---------------------------------------------------------------------------
// Arm 5: the lookup is total and defensive. It is called on the per-turn render
// path, so a throw here is a broken turn, not a logged warning.
// ---------------------------------------------------------------------------
const JUNK = [null, undefined, '', '   ', 0, 42, {}, [], true, false, NaN, 'Not A Verb', 'run methodology'];
for (const bad of JUNK) {
  let result;
  assert.doesNotThrow(
    () => { result = verbReachAffinity(bad); },
    'verbReachAffinity must never throw, threw on: ' + String(bad)
  );
  assert.strictEqual(
    result,
    null,
    'verbReachAffinity must return null for junk input ' + JSON.stringify(String(bad))
      + ', returned ' + JSON.stringify(result)
  );
}
for (const verb of EXPECTED_NULL_VERBS) {
  assert.strictEqual(
    verbReachAffinity(verb),
    null,
    verb + ': a no-preimage canonical verb must look up as null'
  );
}
for (const verb of CANONICAL_VERBS) {
  if (VERB_REACH_AFFINITY[verb] === null) continue;
  assert.strictEqual(
    verbReachAffinity(verb),
    VERB_REACH_AFFINITY[verb],
    verb + ': the lookup must return the SAME frozen object as the table, not a copy'
  );
}
ok('verbReachAffinity never throws, returns null for 13 junk inputs and every no-preimage verb, and returns the frozen table object otherwise');

// ---------------------------------------------------------------------------
// Arm 6: zero-I/O. Requiring the runtime module must not drag in the encoder.
//
// Run in a FRESH child process, because this test file has already loaded the
// orchestrator and its dependency tree, so an in-process require.cache scan
// would measure THIS file's imports rather than the module under test.
// ---------------------------------------------------------------------------
const MODULE_PATH = path.resolve(__dirname, '..', 'lib', 'core', 'verb-reach-affinity.cjs');
const probe = 'require(' + JSON.stringify(MODULE_PATH) + ');'
  + 'const hits = Object.keys(require.cache).filter(function (k) { return k.indexOf("eureka") !== -1; });'
  + 'process.stdout.write(String(hits.length) + "|" + hits.join(","));';

const probeOut = execFileSync(process.execPath, ['-e', probe], { encoding: 'utf8' }).trim();
const probeCount = Number(probeOut.split('|')[0]);
const probeHits = probeOut.split('|')[1] || '';

assert.strictEqual(
  probeCount,
  0,
  'requiring verb-reach-affinity.cjs must load 0 modules under lib/core/eureka/, loaded '
    + probeCount + ': ' + probeHits
);
ok('a fresh require of verb-reach-affinity.cjs loads zero encoder modules (pure, zero-I/O leaf)');

console.log('');
console.log('PASS test-245-verb-affinity.cjs (' + checks + ' checks)');
