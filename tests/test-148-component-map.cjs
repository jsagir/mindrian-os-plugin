'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 148-03 Task 3 -- IRW-04 falsifiable test for toggleable-component routing.
 * =============================================================================
 * Each reach / sub_mode / standing-option resolves to a toggleable component
 * archetype via lib/hmi/reach-component-map.json, read by the dispatcher's
 * resolveArchetype() (registry-is-the-table -- never a hardcoded switch).
 *
 * Behaviors (148-VALIDATION.md IRW-04 row):
 *   - run a representative render set through the dispatcher; the set of emitted
 *     archetypes has >= 3 distinct members
 *   - File (a non-intelligence reach) emits multiSelect (non-default)
 *   - an unknown key falls back to the default 'select'
 *   - the archetype routes into the AskUserQuestion mode the dispatcher
 *     constructs (multiSelect -> contract.multiSelect === true)
 *
 * No em-dashes anywhere (CLAUDE.md / project hard rule). Hyphens only.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const dispatcher = require(path.join(REPO_ROOT, 'lib', 'hmi', 'selector-dispatcher.cjs'));
const componentMap = require(path.join(REPO_ROOT, 'lib', 'hmi', 'reach-component-map.json'));

// ---------------------------------------------------------------------------
// 0. The dispatcher exposes the resolver; the map carries the multiSelect token.
// ---------------------------------------------------------------------------
assert.equal(
  typeof dispatcher.resolveArchetype,
  'function',
  'IRW-04: selector-dispatcher must export resolveArchetype'
);
assert.ok(
  JSON.stringify(componentMap).indexOf('multiSelect') !== -1,
  'IRW-04: reach-component-map.json must contain the multiSelect archetype'
);

// ---------------------------------------------------------------------------
// 1. >= 3 distinct archetypes across a representative render set.
// ---------------------------------------------------------------------------
// The representative set spans engine sub_modes (multiSelect), the File and
// Brain review standing options (multiSelect / auto), compose (ordered), and a
// confirm-gated reach (hats). resolveArchetype must surface >= 3 distinct
// archetypes across them.
const RENDER_SET = [
  'reverse-salient',   // engine -> multiSelect
  'whitespace',        // engine -> multiSelect
  'cross-domain-connect', // engine -> multiSelect
  'six-hats',          // hats   -> confirm
  '_file',             // File   -> multiSelect
  '_brain_review',     // Brain review -> auto
  '_compose',          // compose -> ordered
  'context_block',     // base frozen reach -> select (default)
];
const emitted = RENDER_SET.map(function (k) { return dispatcher.resolveArchetype(k); });
const distinct = new Set(emitted);
assert.ok(
  distinct.size >= 3,
  'IRW-04: >= 3 distinct archetypes must emit across the render set (got ' +
    distinct.size + ': ' + Array.from(distinct).join(', ') + ')'
);

// ---------------------------------------------------------------------------
// 2. File (a NON-intelligence reach) carries a NON-default archetype: multiSelect.
// ---------------------------------------------------------------------------
assert.equal(
  dispatcher.resolveArchetype('_file'),
  'multiSelect',
  'IRW-04: File (_file) must resolve to multiSelect (non-default, non-intelligence)'
);
assert.notEqual(
  dispatcher.resolveArchetype('_file'),
  'select',
  'IRW-04: File must NOT resolve to the default select archetype'
);

// ---------------------------------------------------------------------------
// 3. Each named archetype lands as expected.
// ---------------------------------------------------------------------------
assert.equal(dispatcher.resolveArchetype('reverse-salient'), 'multiSelect', 'IRW-04: engine sub_mode -> multiSelect');
assert.equal(dispatcher.resolveArchetype('_brain_review'), 'auto', 'IRW-04: Brain review -> auto (no pick)');
assert.equal(dispatcher.resolveArchetype('_compose'), 'ordered', 'IRW-04: compose -> ordered');
assert.equal(dispatcher.resolveArchetype('six-hats'), 'confirm', 'IRW-04: hats six-hats -> confirm');
assert.equal(dispatcher.resolveArchetype('context_block'), 'select', 'IRW-04: base frozen reach -> select (default)');

// ---------------------------------------------------------------------------
// 4. Unknown key falls back to the default select archetype.
// ---------------------------------------------------------------------------
assert.equal(
  dispatcher.resolveArchetype('__nonexistent_reach__'),
  'select',
  'IRW-04: unknown key falls back to the default select archetype'
);
assert.equal(dispatcher.resolveArchetype(''), 'select', 'IRW-04: empty key -> default select');
assert.equal(dispatcher.resolveArchetype(null), 'select', 'IRW-04: null key -> default select');

// ---------------------------------------------------------------------------
// 5. The archetype routes into the AskUserQuestion mode the dispatcher builds.
//    pickShape with payload.reachKey='_file' must fold multiSelect onto the
//    contract (SEED-020: the dispatcher is the only construction site).
// ---------------------------------------------------------------------------
const picked = dispatcher.pickShape({
  requestedShape: 'F.1',
  tier: 2,
  payload: { reachKey: '_file', verbs: ['Run Methodology', 'Reformulate'] },
});
assert.ok(picked && picked.rendered && picked.rendered.contract, 'IRW-04: pickShape returns a rendered contract');
assert.equal(
  picked.rendered.contract.archetype,
  'multiSelect',
  'IRW-04: pickShape({reachKey:_file}) routes the multiSelect archetype onto the contract'
);
assert.equal(
  picked.rendered.contract.multiSelect,
  true,
  'IRW-04: the multiSelect archetype sets contract.multiSelect === true'
);

// A confirm-gated reach folds confirm onto the contract.
const pickedConfirm = dispatcher.pickShape({
  requestedShape: 'F.1',
  tier: 2,
  payload: { reachKey: 'six-hats', verbs: ['Run Methodology'] },
});
assert.equal(
  pickedConfirm.rendered.contract.archetype,
  'confirm',
  'IRW-04: pickShape({reachKey:six-hats}) routes the confirm archetype'
);
assert.equal(pickedConfirm.rendered.contract.confirm, true, 'IRW-04: confirm archetype sets contract.confirm');

process.stdout.write(
  'PASS test-148-component-map.cjs (IRW-04: >= 3 distinct archetypes; File=multiSelect ' +
    'non-default; unknown -> select; archetype routes into the AskUserQuestion mode)\n'
);
process.exit(0);
