#!/usr/bin/env node
'use strict';
// Phase 177 Wave 5 - The Behavioral Channel
// BCH-09: the FORCED-MATERIAL guardrail. An autonomous_safe step whose command
// carries an IRREVERSIBLE_HINT (e.g. "deploy") STILL HALTS at the Decision Gate --
// even with the escape-hatch gate-suppression branch ACTIVE and
// BEHAVIORAL_CHANNEL_ARMED true. The guardrail wins UNCONDITIONALLY (177-SPEC :47).
//
// This wave adds the escape-hatch gate-SUPPRESSION consequence to makeGateFn(),
// WIRED-BUT-SHADOWED: GATED by BEHAVIORAL_CHANNEL_ARMED (default LOCKED, owned by
// calibration-gate.cjs) and GUARDED, UNCONDITIONALLY, by the isIrreversibleStep()
// first-check. When unarmed (always today) the suppression branch suppresses
// NOTHING -- makeGateFn() is byte-identical to its pre-seam behavior.
//
// The test arms via the opts.armed seam; it NEVER mutates the shipped
// BEHAVIORAL_CHANNEL_ARMED constant (the calibration-gate change-control rule
// forbids flipping it to unblock a wave).
//
// Canon Part 8: the suppression branch reads ONLY the ARMED boolean, the step's
// escape_hatch scalar handle, and the resolved posture enum -- never user prose,
// never an artifact body. Pure node asserts, no deps.

const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const {
  makeGateFn,
  isIrreversibleStep,
  BEHAVIORAL_CHANNEL_ARMED: SHIPPED_ARMED,
} = require(path.join(ROOT, 'lib/core/chain-executor.cjs'));
const calibrationGate = require(path.join(ROOT, 'lib/core/navigation/calibration-gate.cjs'));

let failed = 0;
function ok(cond, msg) {
  console.log((cond ? '  ok   - ' : '  FAIL - ') + msg);
  if (!cond) failed++;
}

console.log('--- test-bch-09-forced-material ---');

// A posture authority that always reports autonomous_safe + push_forward ('run').
// This is the WORST case for the guardrail: a step the posture layer would
// greenlight. The guardrail must still win on an irreversible step.
function safePosture(command) {
  return { command: command || null, autonomous_safe: true, posture: 'run' };
}
// A posture authority that reports NOT autonomous_safe (halt). A non-safe step
// must never be escalated to 'run' by the escape hatch, even armed.
function unsafePosture(command) {
  return { command: command || null, autonomous_safe: false, posture: 'halt' };
}

// An active escape_hatch observation handle on the step (the Wave-1 observation
// schema surfaces escape_hatch as a boolean -- "just tell me" / "bottom line").
const ESC = { escape_hatch: true };

// ---------------------------------------------------------------------------
// Group 0: the shipped constant is exported and LOCKED (false) on disk. The test
// arms via the opts.armed seam; it never mutates this.
// ---------------------------------------------------------------------------
ok(SHIPPED_ARMED === false, 'BEHAVIORAL_CHANNEL_ARMED is exported false (LOCKED) from chain-executor');
ok(calibrationGate.BEHAVIORAL_CHANNEL_ARMED === false,
  'calibration-gate BEHAVIORAL_CHANNEL_ARMED is the LOCKED source-of-truth (false)');

// ---------------------------------------------------------------------------
// Group 1: HEADLINE -- deploy-still-halts (armed + escape-hatch active).
// The load-bearing assert: an autonomous_safe step carrying an active escape_hatch
// whose command contains an IRREVERSIBLE_HINT STILL returns 'halt' even with
// armed forced true. The forced-material guardrail wins unconditionally.
// ---------------------------------------------------------------------------
const gateArmedSafe = makeGateFn({ postureFn: safePosture, armed: true });

const deployStep = Object.assign({ step: 1, command: '/mos:deploy-site' }, ESC);
ok(isIrreversibleStep(deployStep) === true, 'a "deploy" command is classified forced-material');
ok(gateArmedSafe(deployStep, safePosture('/mos:deploy-site'), null) === 'halt',
  'HEADLINE: autonomous_safe + escape-hatch active + ARMED, deploy command STILL HALTS');

const publishStep = Object.assign({ step: 2, command: 'publish-release' }, ESC);
ok(isIrreversibleStep(publishStep) === true, 'a "publish" command is classified forced-material');
ok(gateArmedSafe(publishStep, safePosture('publish-release'), null) === 'halt',
  'HEADLINE: autonomous_safe + escape-hatch active + ARMED, publish command STILL HALTS');

const irrFlagStep = Object.assign({ step: 3, command: '/mos:reframe', irreversible: true }, ESC);
ok(isIrreversibleStep(irrFlagStep) === true, 'step.irreversible===true with a non-hint command is forced-material');
ok(gateArmedSafe(irrFlagStep, safePosture('/mos:reframe'), null) === 'halt',
  'HEADLINE: autonomous_safe + escape-hatch active + ARMED, step.irreversible===true STILL HALTS');

// ---------------------------------------------------------------------------
// Group 2: DORMANT -- byte-identical gate when UNARMED (the shipped default).
// With armed false, the escape_hatch handle suppresses NOTHING: makeGateFn()
// returns EXACTLY the verb it returns pre-seam for every step shape.
// ---------------------------------------------------------------------------
const gateDormantSafe = makeGateFn({ postureFn: safePosture }); // armed defaults to the LOCKED read
const gateDormantUnsafe = makeGateFn({ postureFn: unsafePosture });

// irreversible -> halt (escape_hatch has zero effect when unarmed)
ok(gateDormantSafe(deployStep, safePosture('/mos:deploy-site'), null) === 'halt',
  'DORMANT: unarmed, irreversible + escape-hatch -> halt (unchanged)');

// reversible autonomous_safe -> run (escape_hatch suppresses NOTHING when unarmed)
const reversibleSafeEsc = Object.assign({ step: 4, command: '/mos:explore-domains' }, ESC);
ok(isIrreversibleStep(reversibleSafeEsc) === false, 'a reversible analytical command is NOT forced-material');
ok(gateDormantSafe(reversibleSafeEsc, safePosture('/mos:explore-domains'), null) === 'run',
  'DORMANT: unarmed, reversible autonomous_safe + escape-hatch -> run (the pre-seam verb)');

// Prove the escape_hatch handle has ZERO effect on the verb when unarmed: the
// SAME reversible step WITHOUT the handle returns the identical verb.
const reversibleSafeNoEsc = { step: 4, command: '/mos:explore-domains' };
ok(
  gateDormantSafe(reversibleSafeEsc, safePosture('/mos:explore-domains'), null)
    === gateDormantSafe(reversibleSafeNoEsc, safePosture('/mos:explore-domains'), null),
  'DORMANT: the escape_hatch handle has ZERO effect on the verb when unarmed (byte-identical)'
);

// non-safe -> halt (unchanged)
const nonSafeEsc = Object.assign({ step: 5, command: '/mos:grade' }, ESC);
ok(gateDormantUnsafe(nonSafeEsc, unsafePosture('/mos:grade'), null) === 'halt',
  'DORMANT: unarmed, non-safe + escape-hatch -> halt (unchanged)');

// low-quality priorOutput -> halt even for a reversible autonomous_safe step (the quality carry)
ok(gateDormantSafe(reversibleSafeEsc, safePosture('/mos:explore-domains'), { quality: 'low' }) === 'halt',
  'DORMANT: unarmed, low-quality priorOutput -> halt (quality carry unchanged)');

// ---------------------------------------------------------------------------
// Group 3: FORCED-MATERIAL-FIRST (ordering). isIrreversibleStep() is the FIRST
// decision in gateFn. An irreversible step with a low-quality priorOutput AND an
// active escape_hatch AND armed true STILL returns 'halt' via the first check --
// not via the quality carry, not via the suppression branch. The headline cannot
// be reached by re-ordering.
// ---------------------------------------------------------------------------
ok(gateArmedSafe(deployStep, safePosture('/mos:deploy-site'), { quality: 'low' }) === 'halt',
  'FORCED-MATERIAL-FIRST: irreversible + low-quality + escape-hatch + ARMED -> halt via the FIRST check');

// ---------------------------------------------------------------------------
// Group 4: SUPPRESSION-PATH (armed, reversible only). The branch is reachable and
// does not throw: an autonomous_safe + REVERSIBLE step carrying an active
// escape_hatch returns 'run' when armed. A NON-autonomous_safe step carrying an
// active escape_hatch STILL returns 'halt' even armed -- the escape hatch may
// suppress only an already autonomous_safe + reversible step's gate, never
// escalate a non-safe step.
// ---------------------------------------------------------------------------
ok(gateArmedSafe(reversibleSafeEsc, safePosture('/mos:explore-domains'), null) === 'run',
  'SUPPRESSION-PATH: armed, reversible autonomous_safe + escape-hatch -> run (branch reachable, no throw)');

const gateArmedUnsafe = makeGateFn({ postureFn: unsafePosture, armed: true });
ok(gateArmedUnsafe(nonSafeEsc, unsafePosture('/mos:grade'), null) === 'halt',
  'SUPPRESSION-PATH: armed, NON-autonomous_safe + escape-hatch STILL HALTS (no escalation)');

// An armed autonomous_safe + reversible step WITHOUT an active escape_hatch is
// unaffected by the branch -- it returns 'run' via the normal posture path (the
// branch only fires on an active escape_hatch).
ok(gateArmedSafe(reversibleSafeNoEsc, safePosture('/mos:explore-domains'), null) === 'run',
  'SUPPRESSION-PATH: armed, reversible autonomous_safe WITHOUT escape-hatch -> run (normal posture path)');

// ---------------------------------------------------------------------------
console.log('');
if (failed === 0) {
  console.log('BCH-09 OK -- forced-material guardrail wins; escape-hatch suppression dormant when unarmed');
  process.exit(0);
} else {
  console.log('BCH-09 FAIL -- ' + failed + ' assertion(s) failed');
  process.exit(1);
}
