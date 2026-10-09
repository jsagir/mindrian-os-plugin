'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 223-01 -- lib/core/bono/hat-governance.cjs
 * ================================================
 * The de Bono hat GOVERNANCE MAP (data) plus a thin mechanical enforcement
 * layer that rides runDebate's EXISTING injectable seams (deriveFn / onStep /
 * selfCritiqueFn -- debate-composition.cjs). 223-RESEARCH: "the only genuinely
 * net-new logic is the hat-governance map (data)". This module rolls no runtime;
 * it encodes the BUILD-BRIEF Section 5 scrutiny table + the five cross-cutting
 * rules as frozen data, and exposes selectors runDebate consumes.
 *
 * PHASE 210 SCOPE CAUTION (verbatim intent): these rules govern bono's DEBATE
 * steps ONLY. They are NEVER wired into live-conversation enforcement. No hook,
 * sensor, or command outside bono / intel-pipeline may require this module as a
 * gate on a live conversation turn. Phase 210 selectively undid exactly that kind
 * of over-reach; this map stays scoped to the debate logic so the mistake is not
 * repeated. Governance shapes how the debate argues, not how Larry talks.
 *
 * Canon Part 8: pure LOCAL data + validation. ZERO network surface -- no fetch,
 * no http(s), no Brain wire. The prose in HAT_GOVERNANCE is drafted from SPEC
 * Requirement 1 + BUILD-BRIEF Section 5 (Requirement 6 fallback); this module
 * contains no reference to any external design source, not even in comments.
 *
 * Pure Node.js built-ins (in fact zero requires). No emoji. No em-dashes.
 *
 * License: BSL 1.1.
 */

// The six de Bono hats, each with a governed scrutiny discipline. This is DATA:
// discipline (the one-line mandate), rules (the enforceable clauses),
// evidence_policy (how evidence is weighted), and discipline_source (the
// methodology lineage). Frozen so a governance map cannot mutate at runtime.
const HAT_GOVERNANCE = Object.freeze({
  white: Object.freeze({
    discipline: 'sourced-only facts: evidence-tiered, no interpretation, cite-or-retract',
    rules: Object.freeze([
      'every evidence item carries a source and an evidence tier',
      'no interpretive claim beyond what the cited source states',
      'an uncitable assertion is retracted, never asserted',
    ]),
    evidence_policy: 'cite_or_retract',
    discipline_source: 'De Bono; SAT',
  }),
  black: Object.freeze({
    discipline: 'ACH skeptic: disconfirming evidence first, steelman then attack, falsify before reject',
    rules: Object.freeze([
      'at least one disconfirming evidence item is present',
      'the first cited evidence item is disconfirming (ACH weighting)',
      'the opposing case is steelmanned before it is attacked',
    ]),
    evidence_policy: 'disconfirming_first',
    discipline_source: 'Heuer/Pherson ACH; red-team',
  }),
  yellow: Object.freeze({
    discipline: 'optimist: benefits and value, evidence-backed, never hope',
    rules: Object.freeze([
      'every benefit claim is backed by at least one evidence item',
      'value is stated as evidence, never as hope or wish',
    ]),
    evidence_policy: 'evidence_backed_value',
    discipline_source: 'De Bono',
  }),
  green: Object.freeze({
    discipline: 'creative: provocations and alternatives, feeds hypotheses to Black',
    rules: Object.freeze([
      'at least one provocation or alternative marker is present',
      'each provocation is framed as a testable hypothesis for the skeptic',
    ]),
    evidence_policy: 'provocation_marked',
    discipline_source: 'De Bono',
  }),
  red: Object.freeze({
    discipline: 'intuition: gut read, timeboxed, no justification, surfaces the unspoken',
    rules: Object.freeze([
      'the reading carries no justification prose (a gut read is unjustified by design)',
      'the reading names an unspoken feeling, not a reasoned argument',
    ]),
    evidence_policy: 'no_justification',
    discipline_source: 'De Bono',
  }),
  blue: Object.freeze({
    discipline: 'judge and process: strongest model, MECE + parallel-thinking + anti-premature-convergence, bias-guarded',
    rules: Object.freeze([
      'dissent is recorded before a ruling is issued (anti-premature-convergence)',
      'the ruling is MECE over the collected hat arguments',
      'the judge runs on the strongest available model',
    ]),
    evidence_policy: 'anti_convergence',
    discipline_source: 'De Bono; multi-agent-debate research',
  }),
});

// The five cross-cutting governance rules that make a conclusion earned rather
// than asserted. Frozen list of { id, rule }.
const CROSS_CUTTING_RULES = Object.freeze([
  Object.freeze({ id: 'heterogeneity_mandate', rule: 'no two personas share an identical lens descriptor' }),
  Object.freeze({ id: 'anti_premature_convergence', rule: 'force dissent and steelman the losing side before a ruling' }),
  Object.freeze({ id: 'key_assumptions_check_first', rule: 'the first material debate step surfaces the key assumptions' }),
  Object.freeze({ id: 'disconfirming_over_confirming', rule: 'disconfirming evidence is weighted over confirming' }),
  Object.freeze({ id: 'strongest_model_judge', rule: 'the Blue judge runs on the strongest available model' }),
]);

// The closed disposition vocabulary an evidence item may carry.
const EVIDENCE_DISPOSITIONS = Object.freeze(['disconfirming', 'confirming', 'neutral', 'mixed']);

function normalizeHat(hat) {
  return (typeof hat === 'string') ? hat.trim().toLowerCase() : '';
}

/**
 * governanceForHat(hat) -> the frozen entry or null. An unknown hat NEVER throws.
 */
function governanceForHat(hat) {
  const key = normalizeHat(hat);
  return Object.prototype.hasOwnProperty.call(HAT_GOVERNANCE, key) ? HAT_GOVERNANCE[key] : null;
}

function evidenceList(argument) {
  if (!argument || typeof argument !== 'object') return [];
  return Array.isArray(argument.evidence) ? argument.evidence : [];
}

function dispositionOf(item) {
  if (!item || typeof item !== 'object') return 'neutral';
  const d = (typeof item.disposition === 'string') ? item.disposition.toLowerCase() : 'neutral';
  return EVIDENCE_DISPOSITIONS.includes(d) ? d : 'neutral';
}

/**
 * enforceGovernance(hat, argument) -> { ok, violations:[] }
 *
 * A mechanical validator over the structured argument/reading shape:
 *   { stance, evidence:[{ source, tier, disposition }], confidence,
 *     justification?, provocations?, dissent_recorded? }
 * Each hat enforces ONLY its own discipline; violations are short scalar reason
 * strings and NEVER carry content bytes. An unknown hat returns ok:true (nothing
 * to enforce) so the map differentiates behavior without ever throwing.
 */
function enforceGovernance(hat, argument) {
  const key = normalizeHat(hat);
  const arg = (argument && typeof argument === 'object') ? argument : {};
  const evidence = evidenceList(arg);
  const violations = [];

  if (key === 'black') {
    const dispositions = evidence.map(dispositionOf);
    const hasDisconfirming = dispositions.indexOf('disconfirming') !== -1;
    if (!hasDisconfirming) {
      violations.push('black_no_disconfirming_evidence');
    } else if (dispositions[0] !== 'disconfirming') {
      violations.push('black_confirming_before_disconfirming');
    }
  } else if (key === 'white') {
    if (evidence.length === 0) {
      violations.push('white_no_evidence');
    }
    for (const item of evidence) {
      const hasSource = item && typeof item.source === 'string' && item.source.length > 0;
      const hasTier = item && typeof item.tier === 'string' && item.tier.length > 0;
      if (!hasSource || !hasTier) {
        violations.push('white_uncited_or_untiered_evidence');
        break;
      }
    }
  } else if (key === 'yellow') {
    if (evidence.length === 0) {
      violations.push('yellow_value_not_evidence_backed');
    }
  } else if (key === 'green') {
    const provocations = Array.isArray(arg.provocations) ? arg.provocations : [];
    const hasMarker = provocations.length > 0
      || arg.alternative === true
      || (typeof arg.provocation === 'string' && arg.provocation.length > 0);
    if (!hasMarker) {
      violations.push('green_no_provocation_marker');
    }
  } else if (key === 'red') {
    const hasJustification = typeof arg.justification === 'string' && arg.justification.trim().length > 0;
    if (hasJustification) {
      violations.push('red_carries_justification');
    }
  } else if (key === 'blue') {
    const dissentRecorded = arg.dissent_recorded === true || arg.anti_convergence === true;
    if (!dissentRecorded) {
      violations.push('blue_ruling_without_recorded_dissent');
    }
  }

  return { ok: violations.length === 0, violations };
}

// Resolve the lens/persona identity descriptor a cell carries. Checks the
// canonical fields in order; returns '' when none is present.
function lensDescriptor(cell) {
  if (!cell || typeof cell !== 'object') return '';
  const candidates = [cell.lens, cell.lens_descriptor, cell.persona, cell.lensId];
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c;
  }
  return '';
}

/**
 * assertHeterogeneity(cells) -> { ok, duplicates:[] }
 *
 * The heterogeneity mandate: no two persona cells may share an identical lens
 * descriptor. Returns the list of duplicated descriptors. Cells with no
 * descriptor are ignored (they cannot collide). Never throws.
 */
function assertHeterogeneity(cells) {
  const list = Array.isArray(cells) ? cells : [];
  const seen = Object.create(null);
  const duplicates = [];
  for (const cell of list) {
    const d = lensDescriptor(cell);
    if (!d) continue;
    if (seen[d]) {
      if (duplicates.indexOf(d) === -1) duplicates.push(d);
    } else {
      seen[d] = true;
    }
  }
  return { ok: duplicates.length === 0, duplicates };
}

// Resolve a step's hat from step.hat or its 'bono-argument-<hat>' command.
function hatForStep(step) {
  if (!step || typeof step !== 'object') return '';
  if (typeof step.hat === 'string' && step.hat.length > 0) return normalizeHat(step.hat);
  if (typeof step.command === 'string') {
    const m = step.command.toLowerCase().match(/bono-argument-([a-z]+)/);
    if (m) return m[1];
  }
  return '';
}

// Extract the governed argument object from a runChain step result. The debate
// consolidator carries it on chain_output.argument; a bare chain_output that
// already looks like an argument (has a stance/evidence) is used directly.
function argumentFromResult(result) {
  if (!result || typeof result !== 'object') return null;
  const co = result.chain_output;
  if (co && typeof co === 'object') {
    if (co.argument && typeof co.argument === 'object') return co.argument;
    if (typeof co.stance === 'string' || Array.isArray(co.evidence)) return co;
  }
  return null;
}

// Is this the Key-Assumptions-Check step (the mandated first material step)?
function isKacStep(step) {
  if (!step || typeof step !== 'object') return false;
  if (step.kac === true || step.key_assumptions_check === true) return true;
  if (typeof step.command === 'string') {
    const c = step.command.toLowerCase();
    return c.indexOf('assumption') !== -1 || c.indexOf('kac') !== -1;
  }
  return false;
}

/**
 * composeGovernedSeams(opts) -> { deriveFn, selfCritiqueFn, onStep }
 *
 * Returns seams shaped EXACTLY to runDebate's injectable options:
 *   - deriveFn({ roomDir, artifactPair, llm }) -> Array (SYNCHRONOUS, CR-01).
 *     Wraps opts.deriveCandidateFn (Plan 03's stance-aware producer) or a default
 *     per-hat CONVERGES producer. If a producer returns a thenable, the wrapper
 *     does NOT let it escape -- it returns [] so no Promise reaches runDerivation
 *     (the synchronous composer throws on a thenable; we pre-empt that).
 *   - selfCritiqueFn(step, result) -> verdict. Routes a material per-hat step's
 *     governed argument through enforceGovernance for that step's hat. Returns
 *     the debate-composition critique contract { passed, quality, violations }.
 *   - onStep(step, previousOutput) -> { chain_output, quality }. Wraps
 *     opts.onStepFn and enforces Key-Assumptions-Check-first ordering: if the
 *     first MATERIAL step is not the assumptions surface, it flags the step and
 *     downgrades quality to 'low'.
 *
 * opts:
 *   hats               the debate hats (metadata for callers)
 *   deriveCandidateFn  optional sync candidate producer override (Plan 03)
 *   onStepFn           optional inner per-step dispatch (default a thin passthrough)
 */
function composeGovernedSeams(opts) {
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
      // CR-01: a thenable must NOT escape this synchronous seam.
      if (candidates && typeof candidates.then === 'function') return [];
      return Array.isArray(candidates) ? candidates : [];
    }
    // Default: a per-hat CONVERGES claim about the hypothesis (conservative).
    return [{
      source: pair.b,
      target: pair.a,
      edge_type: 'CONVERGES',
      reason: 'hat ' + String(pair.hat || '') + ' argument bears on the hypothesis',
    }];
  }

  // selfCritiqueFn: route the step's governed argument through enforceGovernance.
  function selfCritiqueFn(step, result) {
    const hat = hatForStep(step);
    const argument = argumentFromResult(result);
    if (!hat || !argument) {
      // Nothing governed to critique -- pass through at the incoming quality.
      const q = (result && typeof result === 'object' && result.quality) ? result.quality : 'high';
      return { passed: true, quality: q };
    }
    const verdict = enforceGovernance(hat, argument);
    if (!verdict.ok) {
      return { passed: false, quality: 'low', violations: verdict.violations };
    }
    return { passed: true, quality: 'high' };
  }

  // onStep: enforce Key-Assumptions-Check-first ordering across the debate.
  let materialSeen = 0;
  function onStep(step, previousOutput) {
    let inner;
    if (onStepFn) {
      inner = onStepFn(step, previousOutput);
    } else {
      inner = { chain_output: { step: step && step.command }, quality: 'high' };
    }
    const result = (inner && typeof inner === 'object') ? inner : { chain_output: null, quality: 'high' };
    if (step && step.material) {
      materialSeen += 1;
      if (materialSeen === 1 && !isKacStep(step)) {
        const co = (result.chain_output && typeof result.chain_output === 'object')
          ? Object.assign({}, result.chain_output)
          : { value: result.chain_output };
        co.governance_flag = 'kac_not_first';
        return { chain_output: co, quality: 'low' };
      }
    }
    return result;
  }

  return { deriveFn, selfCritiqueFn, onStep };
}

module.exports = {
  HAT_GOVERNANCE,
  CROSS_CUTTING_RULES,
  EVIDENCE_DISPOSITIONS,
  governanceForHat,
  enforceGovernance,
  assertHeterogeneity,
  composeGovernedSeams,
  // exposed for tests + Plan 03 wiring
  lensDescriptor,
  hatForStep,
  argumentFromResult,
  isKacStep,
};
