#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121.5-10 Sub-plan K -- selector alias_map unit tests.
 *
 * Behavior contract (per plan Task 1 behavior block):
 *   T1: jtbd-taxonomy.json parses with NEW top-level key alias_map.verb_aliases
 *       containing the 4 LOCKED entries (Resolve, Explore, Later, Skip) per
 *       LOCKED decision 1.
 *   T2: aliasToCanonical round-trip: 'Resolve' -> 'Run Methodology';
 *       'Run Methodology' (already canonical) -> 'Run Methodology' (no-op).
 *   T3: pickShape with payload.alias_map: { 'Resolve': 'Run Methodology' }
 *       honors LOCKED decision 1 -- contract.alias_map is surfaced to
 *       consumers so they can collapse verb_chosen to verb_canonical at
 *       selection time.
 *   T4: Render-vs-persist invariant: when payload.verbs carries an alias
 *       like 'Resolve', the alias label appears in rendered.zones.body;
 *       the canonical 'Run Methodology' is what aliasToCanonical returns
 *       for graph-edge persistence.
 *   T5: Unknown alias passes through unchanged (no-op for non-aliased verbs).
 *
 * No em-dash check applies (this is a test file; no narrative prose).
 *
 * Hermetic: reads only the live repo files via require/fs.readFileSync. No
 * network. No db. No spawn.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TAXONOMY_PATH = path.join(REPO_ROOT, 'lib', 'hmi', 'jtbd-taxonomy.json');
const DISPATCHER = require(path.join(REPO_ROOT, 'lib', 'hmi', 'selector-dispatcher.cjs'));

let pass = 0;
let fail = 0;
const failures = [];

function assert(cond, name, detail) {
  if (cond) {
    pass++;
    console.log('PASS  ' + name);
  } else {
    fail++;
    failures.push(name + (detail ? ' -- ' + detail : ''));
    console.log('FAIL  ' + name + (detail ? ' -- ' + detail : ''));
  }
}

// --- T1: jtbd-taxonomy.json carries alias_map.verb_aliases with 4 LOCKED entries ---
{
  const raw = fs.readFileSync(TAXONOMY_PATH, 'utf8');
  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
  assert(parsed !== null, 'T1a: jtbd-taxonomy.json parses as JSON');
  assert(parsed && parsed.alias_map && typeof parsed.alias_map === 'object',
    'T1b: top-level alias_map block present');
  const va = parsed && parsed.alias_map && parsed.alias_map.verb_aliases;
  assert(va && typeof va === 'object', 'T1c: alias_map.verb_aliases present');
  assert(va && va.Resolve === 'Run Methodology',
    'T1d: Resolve -> Run Methodology', va && va.Resolve);
  assert(va && va.Explore === 'Run Methodology',
    'T1e: Explore -> Run Methodology', va && va.Explore);
  assert(va && va.Later === 'Defer',
    'T1f: Later -> Defer', va && va.Later);
  assert(va && va.Skip === 'Free-Text',
    'T1g: Skip -> Free-Text', va && va.Skip);
}

// --- T2: aliasToCanonical round-trip ---
{
  assert(DISPATCHER.aliasToCanonical('Resolve') === 'Run Methodology',
    'T2a: aliasToCanonical(Resolve) === Run Methodology');
  assert(DISPATCHER.aliasToCanonical('Explore') === 'Run Methodology',
    'T2b: aliasToCanonical(Explore) === Run Methodology');
  assert(DISPATCHER.aliasToCanonical('Later') === 'Defer',
    'T2c: aliasToCanonical(Later) === Defer');
  assert(DISPATCHER.aliasToCanonical('Skip') === 'Free-Text',
    'T2d: aliasToCanonical(Skip) === Free-Text');
  // Already-canonical pass-through (no-op)
  assert(DISPATCHER.aliasToCanonical('Run Methodology') === 'Run Methodology',
    'T2e: aliasToCanonical(Run Methodology) is no-op');
  assert(DISPATCHER.aliasToCanonical('Defer') === 'Defer',
    'T2f: aliasToCanonical(Defer) is no-op');
  assert(DISPATCHER.aliasToCanonical('Free-Text') === 'Free-Text',
    'T2g: aliasToCanonical(Free-Text) is no-op');
}

// --- T3: pickShape carries alias_map onto rendered.contract.alias_map ---
{
  const result = DISPATCHER.pickShape({
    requestedShape: 'F.1',
    tier: 2,
    payload: {
      brain_suggestion_variant: true,
      header: '[■ BRAIN]',
      questionLine: 'Choose next move:',
      verbs: ['Resolve', 'Later', 'Skip'],
      alias_map: { 'Resolve': 'Run Methodology', 'Later': 'Defer', 'Skip': 'Free-Text' },
      optionRows: [
        { glyph: '▷', number: 1, verb: 'Resolve', confPct: 70, meta: 'tension hook' },
        { glyph: '▷', number: 2, verb: 'Later', confPct: 50, meta: 'queue for milestone' },
        { glyph: '▷', number: 3, verb: 'Skip', confPct: 30, meta: 'silent dismiss' },
      ],
      footer: '▶ Brain · top-3 of 3 ranked · cyan = informing',
    },
  });
  assert(result && result.shape === 'F.1', 'T3a: pickShape returned shape F.1');
  assert(result && result.rendered && result.rendered.contract
      && result.rendered.contract.alias_map
      && result.rendered.contract.alias_map.Resolve === 'Run Methodology',
    'T3b: contract.alias_map carries the Resolve -> Run Methodology mapping');
}

// --- T4: Render-vs-persist invariant ---
{
  const result = DISPATCHER.pickShape({
    requestedShape: 'F.1',
    tier: 2,
    payload: {
      brain_suggestion_variant: true,
      header: '[■ BRAIN]',
      verbs: ['Resolve', 'Later', 'Skip'],
      alias_map: { 'Resolve': 'Run Methodology', 'Later': 'Defer', 'Skip': 'Free-Text' },
      optionRows: [
        { glyph: '▷', number: 1, verb: 'Resolve', confPct: 70, meta: 'tension hook' },
      ],
    },
  });
  const body = (result && result.rendered && result.rendered.zones && result.rendered.zones.body) || '';
  // Alias label appears in rendered body (render to user).
  assert(body.indexOf('Resolve') >= 0, 'T4a: alias label "Resolve" appears in rendered body');
  // aliasToCanonical produces canonical for graph-edge persistence.
  assert(DISPATCHER.aliasToCanonical('Resolve', result.rendered.contract.alias_map)
      === 'Run Methodology',
    'T4b: aliasToCanonical("Resolve", contract.alias_map) === Run Methodology');
  // The canonical "Run Methodology" string is what would persist to the graph edge,
  // NOT the alias "Resolve" -- this is the render-vs-persist split.
}

// --- T5: Unknown alias passes through unchanged ---
{
  assert(DISPATCHER.aliasToCanonical('NotAnAlias') === 'NotAnAlias',
    'T5a: unknown verb is a no-op');
  assert(DISPATCHER.aliasToCanonical('') === '',
    'T5b: empty string is a no-op (input returned as-is)');
  assert(DISPATCHER.aliasToCanonical(null) === null,
    'T5c: null is a no-op (input returned as-is)');
  assert(DISPATCHER.aliasToCanonical(undefined) === undefined,
    'T5d: undefined is a no-op (input returned as-is)');
}

// --- T6: explicit aliasMap arg overrides the module-level cache ---
{
  const customMap = { 'CustomAlias': 'Run Methodology' };
  assert(DISPATCHER.aliasToCanonical('CustomAlias', customMap) === 'Run Methodology',
    'T6a: explicit aliasMap arg honored over module default');
  // Module-level cache untouched -- Resolve still resolves via the default map.
  assert(DISPATCHER.aliasToCanonical('Resolve') === 'Run Methodology',
    'T6b: module-level alias_map cache preserved after explicit-arg call');
}

console.log('');
console.log('selector-alias-map.test.cjs: ' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) {
  console.log('FAILURES:');
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
process.exit(0);
