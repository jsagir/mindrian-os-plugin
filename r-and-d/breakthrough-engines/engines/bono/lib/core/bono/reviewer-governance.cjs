'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * grade-grant reviewer-panel examination mode -- lib/core/bono/reviewer-governance.cjs
 * ======================================================================================
 * The reviewer-panel sibling of lib/core/bono/hat-governance.cjs (Phase 223-01). Where
 * HAT_GOVERNANCE disciplines the six de Bono hats' debate arguments, REVIEWER_GOVERNANCE
 * disciplines the SEVEN grant-rubric category reviewers (the CATEGORY_VALUES enum
 * lib/core/eureka/grade-grant.cjs already ships: eligibility / process / budget / legal /
 * reporting / market / ip). Same uniform adversarial framing across all seven: "would an
 * actual Tnufa committee member reading only this section accept it?" -- so no category
 * gets a hat-style always-fresh special case (there is no library reuse question here at
 * all; see D7 in the design this module implements: no SyntheticExpert filing this pass).
 *
 * Canon Part 7 (reuse before build): this module does NOT duplicate hat-governance.cjs.
 *   `assertHeterogeneity` and `lensDescriptor` are IDENTITY-GENERIC (they operate on any
 *   cell carrying a lens/hat/subdomain shape, never on hat-specific vocabulary), so they
 *   are RE-EXPORTED here verbatim rather than copy-pasted. `hatForStep` and
 *   `argumentFromResult` are likewise identity-generic (they read `step.hat` / parse a
 *   `bono-argument-<x>` command, and extract a governed-argument shape off a chain-output
 *   respectively -- neither cares whether `<x>` is a de Bono color or a rubric category) so
 *   `composeReviewerGovernedSeams` below CALLS them from hat-governance.cjs rather than
 *   reimplementing them. Only the DATA (REVIEWER_GOVERNANCE) and the ONE differentiated
 *   mechanical check (`enforceReviewerGovernance`) are net-new.
 *
 * `composeReviewerGovernedSeams` mirrors `composeGovernedSeams`'s exact shape
 * ({deriveFn, selfCritiqueFn, onStep}, wired into runDebate's injectable options) but
 * deliberately does NOT carry forward `composeGovernedSeams`'s KAC-first onStep ordering
 * flag: that flag checks whether the debate's first material step is a Key-Assumptions-
 * Check step, a BONO-hat-debate discipline (CROSS_CUTTING_RULES key_assumptions_check_first)
 * with no grant-grading analog. grade-grant's real "eligibility overrides everything" rule
 * is enforced more honestly downstream at the ruling step
 * (lib/core/eureka/grade-grant.cjs::deriveRulingVerb's hard gate), not as debate
 * step-ordering etiquette -- see that function's header for the full rationale.
 *
 * PHASE-210-STYLE SCOPE CAUTION (mirrors hat-governance.cjs verbatim): these rules govern
 * the grade-grant reviewer-panel DEBATE steps ONLY. They are NEVER wired into live-
 * conversation enforcement. No hook, sensor, or command outside grade-grant's panel mode
 * may require this module as a gate on a live conversation turn.
 *
 * DESIGN-PASS RECONCILIATION (2026-08-06, independent Fable review of this module):
 * the reuse ledger above was independently re-derived and CONFIRMED (same sibling shape,
 * same re-export choices, same seam contract). ONE amendment landed from that pass,
 * grounded in the tnufa fixture itself: ip moved OFF disconfirming_first. Tnufa's sole
 * ip criterion (ip_protection_use_of_funds) is a use-of-funds and disclosure-duty
 * CHECKLIST item ("did you budget IP costs, do you acknowledge the IIA disclosure
 * duty"), not an ownership claim to attack (ownership is legal_ip_registration,
 * category legal). Demanding a disconfirming-FIRST evidence ordering on a checklist
 * item manufactures false violations on a straightforwardly-budgeted application and,
 * worse, incentivizes a reviewer to fabricate a disconfirming item just to pass
 * governance. ip's discipline is now mechanism-or-retract under cite_or_retract: a
 * credited IP claim names its protection mechanism and its budget line, or the
 * unbudgeted-IP gap is flagged (the fixture's own named common mistake). A future
 * program fixture with heavier ip criteria (real FTO / ownership disputes) tightens
 * this in one place, here.
 *
 * Canon Part 8: pure LOCAL data + validation. ZERO network surface -- no fetch, no
 * http(s), no Brain wire. The prose in REVIEWER_GOVERNANCE is drafted from the Tnufa
 * fixture's own category enum + the navigator's adversarial-reviewer framing; it contains
 * no reference to any external design source, not even in comments.
 *
 * Pure Node.js built-ins (in fact zero requires beyond the sibling hat-governance.cjs).
 * No emoji. No em-dashes.
 *
 * License: BSL 1.1.
 */

const hatGovernance = require('./hat-governance.cjs');

// The seven grant-rubric category reviewers, each with a governed scrutiny discipline.
// This is DATA (mirrors HAT_GOVERNANCE's shape exactly): discipline (the one-line
// mandate), hard_gate (true only for eligibility -- READ by
// grade-grant.cjs::deriveRulingVerb, NOT enforced here; governance judges reviewer
// RIGOR, not application substance, mirroring how enforceGovernance judges argument
// rigor while the debate's ruling step judges the hypothesis), rules (the enforceable
// clauses), evidence_policy (how evidence is weighted -- 'reconciliation_required' is a
// NEW policy value budget needs; hat-governance's five values never needed it), and
// discipline_source. Frozen so the governance map cannot mutate at runtime.
const REVIEWER_GOVERNANCE = Object.freeze({
  eligibility: Object.freeze({
    discipline: 'rule-match-or-reject: cite the disqualifying/qualifying rule and where it is met, or retract',
    hard_gate: true,
    rules: Object.freeze([
      'at least one evidence item is present',
      'every evidence item cites a criterion id and a room location',
    ]),
    evidence_policy: 'cite_or_retract',
    discipline_source: 'Tnufa eligibility criteria (IIA); ACH rule-match',
  }),
  process: Object.freeze({
    discipline: 'checklist-completeness: did the applicant follow the submission mechanics',
    hard_gate: false,
    rules: Object.freeze([
      'a credited process finding carries at least one cited evidence item',
    ]),
    evidence_policy: 'cite_or_retract',
    discipline_source: 'Tnufa submission_process / evaluation_process / work_plan_milestones',
  }),
  budget: Object.freeze({
    discipline: 'numbers-must-reconcile: a credited budget claim shows its arithmetic',
    hard_gate: false,
    rules: Object.freeze([
      'at least one evidence item is present',
      'a credited (supports) budget claim carries at least one reconciliation-marked evidence item',
    ]),
    evidence_policy: 'reconciliation_required',
    discipline_source: 'Tnufa funding_terms / budget_planning / matching_funds_proof',
  }),
  legal: Object.freeze({
    discipline: 'cite-the-actual-requirement-or-flag-it',
    hard_gate: false,
    rules: Object.freeze([
      'a credited legal finding carries at least one cited evidence item',
    ]),
    evidence_policy: 'cite_or_retract',
    discipline_source: 'Tnufa legal_ip_registration',
  }),
  reporting: Object.freeze({
    discipline: 'audit-trail-verifiable: post-award commitments, not submission mechanics',
    hard_gate: false,
    rules: Object.freeze([
      'a credited reporting finding carries at least one cited evidence item',
    ]),
    evidence_policy: 'cite_or_retract',
    discipline_source: 'Tnufa reporting_requirements / change_management',
  }),
  market: Object.freeze({
    discipline: 'disconfirming-first: look for a reason to reject before crediting demand evidence',
    hard_gate: false,
    rules: Object.freeze([
      'at least one disconfirming evidence item is present',
      'the first cited evidence item is disconfirming',
    ]),
    evidence_policy: 'disconfirming_first',
    discipline_source: 'ACH disconfirming-first (mirrors Black); Tnufa market_validation_scope',
  }),
  ip: Object.freeze({
    discipline: 'mechanism-or-retract: a credited IP claim names its protection mechanism and its budget line, or the unbudgeted-IP gap is flagged',
    hard_gate: false,
    rules: Object.freeze([
      'a credited ip finding carries at least one cited evidence item',
    ]),
    evidence_policy: 'cite_or_retract',
    discipline_source: 'Tnufa ip_protection_use_of_funds (a use-of-funds and disclosure-duty checklist item; IP ownership lives in the legal category)',
  }),
});

function normalizeCategory(category) {
  return (typeof category === 'string') ? category.trim().toLowerCase() : '';
}

/**
 * governanceForCategory(category) -> the frozen entry or null. An unknown category
 * NEVER throws (mirrors hat-governance.cjs::governanceForHat).
 */
function governanceForCategory(category) {
  const key = normalizeCategory(category);
  return Object.prototype.hasOwnProperty.call(REVIEWER_GOVERNANCE, key) ? REVIEWER_GOVERNANCE[key] : null;
}

function evidenceList(argument) {
  if (!argument || typeof argument !== 'object') return [];
  return Array.isArray(argument.evidence) ? argument.evidence : [];
}

function dispositionOf(item) {
  if (!item || typeof item !== 'object') return 'neutral';
  const d = (typeof item.disposition === 'string') ? item.disposition.toLowerCase() : 'neutral';
  return hatGovernance.EVIDENCE_DISPOSITIONS.includes(d) ? d : 'neutral';
}

// A reconciliation marker is a STRUCTURAL scalar (item.reconciled === true) or a short
// keyword match on the item's own note/summary text -- never a semantic read of the
// application's actual arithmetic (this module never reads room/draft prose; that
// interpretation belongs to the dispatched agents/grant-reviewer.md cell agent).
function hasReconciliationMarker(item) {
  if (!item || typeof item !== 'object') return false;
  if (item.reconciled === true) return true;
  const note = typeof item.note === 'string' ? item.note : '';
  const summary = typeof item.summary === 'string' ? item.summary : '';
  return /reconcil/i.test(note + ' ' + summary);
}

/**
 * enforceReviewerGovernance(category, argument) -> { ok, violations:[] }
 *
 * A mechanical validator over the structured argument/reading shape a reviewer cell
 * produces (the SAME shape hat-governance.cjs's enforceGovernance validates):
 *   { stance, evidence:[{ criterion_id?, room_location?, disposition?, reconciled?,
 *     note?, source?, tier? }], confidence, ... }
 * Each category enforces ONLY its own discipline; violations are short scalar reason
 * strings and NEVER carry content bytes. An unknown category returns ok:true (nothing
 * to enforce) so the map differentiates behavior without ever throwing.
 */
function enforceReviewerGovernance(category, argument) {
  const key = normalizeCategory(category);
  const arg = (argument && typeof argument === 'object') ? argument : {};
  const evidence = evidenceList(arg);
  const violations = [];

  if (key === 'eligibility') {
    if (evidence.length === 0) {
      violations.push('eligibility_no_evidence');
    }
    for (const item of evidence) {
      const hasCriterion = item && typeof item.criterion_id === 'string' && item.criterion_id.length > 0;
      const hasLocation = item && typeof item.room_location === 'string' && item.room_location.length > 0;
      if (!hasCriterion || !hasLocation) {
        violations.push('eligibility_missing_citation');
        break;
      }
    }
  } else if (key === 'process' || key === 'legal' || key === 'reporting' || key === 'ip') {
    // ip joined the cite_or_retract branch in the 2026-08-06 design-pass amendment
    // (module header): tnufa's ip criterion is a checklist item, so the mechanical
    // floor is "cite something or flag the gap", never disconfirming-first.
    if (evidence.length === 0) {
      violations.push(key + '_gap_not_flagged');
    }
  } else if (key === 'budget') {
    if (evidence.length === 0) {
      violations.push('budget_no_evidence');
    } else if (arg.stance === 'supports' && !evidence.some(hasReconciliationMarker)) {
      violations.push('budget_no_reconciliation_check');
    }
  } else if (key === 'market') {
    const dispositions = evidence.map(dispositionOf);
    const hasDisconfirming = dispositions.indexOf('disconfirming') !== -1;
    if (!hasDisconfirming) {
      violations.push(key + '_no_disconfirming_evidence');
    } else if (dispositions[0] !== 'disconfirming') {
      violations.push(key + '_confirming_before_disconfirming');
    }
  }

  return { ok: violations.length === 0, violations };
}

/**
 * composeReviewerGovernedSeams(opts) -> { deriveFn, selfCritiqueFn, onStep }
 *
 * Returns seams shaped EXACTLY to runDebate's injectable options (mirrors
 * hat-governance.cjs::composeGovernedSeams's contract byte-for-byte):
 *   - deriveFn({ roomDir, artifactPair, llm }) -> Array (SYNCHRONOUS, same CR-01
 *     thenable-never-escapes discipline).
 *   - selfCritiqueFn(step, result) -> verdict. Routes a material per-category step's
 *     governed argument through enforceReviewerGovernance for that step's category.
 *     Reuses hat-governance.cjs's hatForStep + argumentFromResult (identity-generic,
 *     see module header) rather than reimplementing them.
 *   - onStep(step, previousOutput) -> { chain_output, quality }. Wraps opts.onStepFn.
 *     Deliberately carries NO Key-Assumptions-Check-first ordering flag (see module
 *     header): grade-grant's eligibility-hard-gate rule lives at the ruling step, not
 *     here.
 *
 * opts:
 *   hats               the category axis (metadata for callers; CATEGORY_VALUES)
 *   deriveCandidateFn  optional sync candidate producer override
 *   onStepFn           optional inner per-step dispatch (default a thin passthrough)
 */
function composeReviewerGovernedSeams(opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  const deriveCandidateFn = (typeof o.deriveCandidateFn === 'function') ? o.deriveCandidateFn : null;
  const onStepFn = (typeof o.onStepFn === 'function') ? o.onStepFn : null;

  // deriveFn: synchronous over pre-resolved cell data. Never returns a Promise.
  function deriveFn(args) {
    const a = (args && typeof args === 'object') ? args : {};
    const pair = (a.artifactPair && typeof a.artifactPair === 'object') ? a.artifactPair : null;
    if (!pair) return [];
    let candidates;
    if (deriveCandidateFn) {
      candidates = deriveCandidateFn({ roomDir: a.roomDir, artifactPair: pair, llm: a.llm });
      // CR-01 (mirrored): a thenable must NOT escape this synchronous seam.
      if (candidates && typeof candidates.then === 'function') return [];
      return Array.isArray(candidates) ? candidates : [];
    }
    // Default: a per-category CONVERGES claim about the hypothesis (conservative).
    return [{
      source: pair.b,
      target: pair.a,
      edge_type: 'CONVERGES',
      reason: 'category ' + String(pair.hat || '') + ' reviewer finding bears on the hypothesis',
    }];
  }

  // selfCritiqueFn: route the step's governed argument through enforceReviewerGovernance.
  // Reuses hat-governance.cjs's hatForStep / argumentFromResult verbatim -- both read
  // step.hat / parse a 'bono-argument-<x>' command and extract a governed-argument shape
  // respectively, with zero hat-specific vocabulary baked in.
  function selfCritiqueFn(step, result) {
    const category = hatGovernance.hatForStep(step);
    const argument = hatGovernance.argumentFromResult(result);
    if (!category || !argument) {
      // Nothing governed to critique -- pass through at the incoming quality.
      const q = (result && typeof result === 'object' && result.quality) ? result.quality : 'high';
      return { passed: true, quality: q };
    }
    const verdict = enforceReviewerGovernance(category, argument);
    if (!verdict.ok) {
      return { passed: false, quality: 'low', violations: verdict.violations };
    }
    return { passed: true, quality: 'high' };
  }

  // onStep: thin passthrough wrapper. NO Key-Assumptions-Check-first ordering flag
  // (module header): grade-grant's real hard-gate rule is enforced at the ruling step.
  function onStep(step, previousOutput) {
    let inner;
    if (onStepFn) {
      inner = onStepFn(step, previousOutput);
    } else {
      inner = { chain_output: { step: step && step.command }, quality: 'high' };
    }
    return (inner && typeof inner === 'object') ? inner : { chain_output: null, quality: 'high' };
  }

  return { deriveFn, selfCritiqueFn, onStep };
}

module.exports = {
  REVIEWER_GOVERNANCE,
  governanceForCategory,
  enforceReviewerGovernance,
  composeReviewerGovernedSeams,
  // Re-exported, NOT duplicated (Canon Part 7): both are identity-generic in
  // hat-governance.cjs and need no category-specific variant.
  assertHeterogeneity: hatGovernance.assertHeterogeneity,
  lensDescriptor: hatGovernance.lensDescriptor,
};
