'use strict';
/*
 * Phase 188-06 -- F.8 array-capture adapter behavior test (SFS-02).
 * =========================================================================
 * The CONTRACT for lib/hmi/f8-action-capture-cli.cjs, referenced by
 * tests/run-all-188.sh (the "F.8 capture (array of N toggles)" leg). Fails
 * LOUDLY on module-not-found -- never a silent skip.
 *
 * What the F.8 capture is: F.1 maps ONE AskUserQuestion answer -> ONE {verb,
 * outcome} pick; F.8 maps the CONFIRMED `selectedOptions[]` toggle set -> an
 * ARRAY of N {verb, outcome} picks, one per toggle. Each option is matched to a
 * verb DETERMINISTICALLY (membership, not fuzzy NLP); the raw navigator text
 * rides the optional per-element `sentence` LOCAL lane only (Part 8).
 *
 * House rule: hyphens only, no em-dashes. Node built-ins only, zero deps.
 */

const assert = require('node:assert');

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

// RED-loud: the module must exist.
const mod = require('./f8-action-capture-cli.cjs');
ok('module exports captureCliActionSet', typeof mod.captureCliActionSet === 'function');
ok('module reuses the OUTCOMES enum (no parallel enum)',
  Array.isArray(mod.OUTCOMES)
  && mod.OUTCOMES.indexOf('accept') !== -1
  && mod.OUTCOMES.indexOf('defer') !== -1
  && mod.OUTCOMES.indexOf('reject') !== -1
  && mod.OUTCOMES.indexOf('Free-Text') !== -1);

const priorPayload = { verbs: ['ship it', 'archive', 'escalate', 'Free-Text'] };

// ---- N selectedOptions -> N deterministic {verb, outcome} picks ----
const answer = {
  selectedOptions: [
    'ship it',                                   // bare toggle -> default accept
    { label: 'archive', outcome: 'reject' },     // per-element outcome preserved
    { label: 'escalate', outcome: 'defer' },
  ],
};
const picks = mod.captureCliActionSet(answer, priorPayload);
ok('returns an ARRAY', Array.isArray(picks));
ok('N selectedOptions -> N picks', picks.length === 3);
ok('each pick carries a matched verb + outcome',
  picks.every((p) => typeof p.verb === 'string' && typeof p.outcome === 'string'));
ok('a bare confirmed toggle defaults to accept', picks[0].verb === 'ship it' && picks[0].outcome === 'accept');
ok('a per-element reject stays a reject (two-channel split preserved)',
  picks[1].verb === 'archive' && picks[1].outcome === 'reject');
ok('a per-element defer stays a defer', picks[2].verb === 'escalate' && picks[2].outcome === 'defer');

// ---- Part 8: raw navigator text rides the per-element sentence LOCAL lane only ----
const withText = {
  selectedOptions: [{ label: 'ship it', outcome: 'accept', text: 'do this before the demo' }],
};
const textPicks = mod.captureCliActionSet(withText, priorPayload);
ok('raw navigator text rides the sentence LOCAL lane per element',
  textPicks[0].sentence === 'do this before the demo');
ok('the sentence text is NEVER the pick verb (Part 8: not an edge body)',
  textPicks[0].verb === 'ship it' && textPicks[0].verb !== textPicks[0].sentence);

// ---- unknown option degrades (no false match) ----
const withUnknown = { selectedOptions: ['ship it', 'NOT-A-RENDERED-VERB'] };
const degraded = mod.captureCliActionSet(withUnknown, priorPayload);
ok('an unknown option degrades to verb:null (deterministic, no false match)',
  degraded.length === 2 && degraded[0].verb === 'ship it' && degraded[1].verb === null);

// ---- a pre-checked-but-unconfirmed toggle is NOT a selection until confirm ----
// (The adapter only ever sees the CONFIRMED selectedOptions[]; an empty confirm
//  yields an empty pick set even if candidates were pre-checked at render time.)
const noConfirm = mod.captureCliActionSet({ selectedOptions: [] }, priorPayload);
ok('a pre-checked-but-unconfirmed toggle is NOT a selection until confirm',
  Array.isArray(noConfirm) && noConfirm.length === 0);

console.log('\nPASS f8-capture.test (' + pass + ' assertions)');
console.log('>>> f8-capture.test.cjs: PASSED');
