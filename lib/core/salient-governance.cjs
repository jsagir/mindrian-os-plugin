'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Reverse Salient adversarial critic -- lib/core/salient-governance.cjs
 * ========================================================================
 * A sibling of lib/core/bono/reviewer-governance.cjs, placed at lib/core/ and
 * deliberately NOT inside bono/: Reverse Salient is not a BONO subsystem (D-09,
 * Phase 264 CONTEXT.md). This module is the first real critic behind
 * ralph_verify -- ralph_verify has shipped since Phase 201 with no critic
 * actually wired to a Reverse Salient finding. Plan 264-04 wires this into a
 * real runChain via chain-executor.cjs's makeSalientSelfCritiqueFn-shaped
 * selfCritiqueFn seam.
 *
 * Canon Part 7 reuse ledger (what is reused, what is net-new):
 *   REUSED, in spirit not verbatim text -- reviewer-governance.cjs's
 *   selfCritiqueFn seam shape ({passed, quality, violations}), its
 *   {ok, violations} mechanical-verdict shape, its frozen-rule-table idiom
 *   (discipline / hard_gate / rules / evidence_policy / discipline_source per
 *   entry), and eureka-critic.cjs's 2-pass unanimity ruling (exactly two
 *   passes, neutral then adversarial, any per-item disagreement kills the
 *   candidate -- eureka-critic.cjs:462-468, "a 9-judge panel delivered about
 *   2.2 effective votes").
 *   NET-NEW -- findingFromResult, because hat-governance.cjs::argumentFromResult
 *   returns null for the Reverse Salient eight-field shape (RESEARCH F-14):
 *   argumentFromResult looks for chain_output.argument or a
 *   stance/evidence-shaped chain_output, neither of which the RS finding
 *   contract carries. Reusing it here would be the exact silent-pass trap
 *   this module exists to close, so findingFromResult is authored fresh
 *   against the real RS finding shape (lib/agents/reverse-salient-agent.cjs
 *   composeFinding, lines 236-270).
 *
 * PHASE-210-STYLE SCOPE CAUTION (mirrors hat-governance.cjs / reviewer-
 * governance.cjs verbatim in spirit): these rules govern the Technical
 * Roadmap chain's find-bottlenecks step ONLY. They are NEVER wired into live-conversation enforcement. No hook, sensor, or command may require this
 * module as a gate on a live conversation turn.
 *
 * Canon Part 8: pure LOCAL data + validation. ZERO network surface -- no
 * fetch, no http(s), no Brain wire. The module reads only the structured
 * finding object handed to it in-process.
 *
 * TWO DELIBERATE DIVERGENCES FROM THE DONOR (reviewer-governance.cjs), stated
 * explicitly so a future reader does not "fix" them back:
 *   (a) an unparseable finding FAILS the candidate here, where the donor
 *       PASSES it (reviewer-governance.cjs's selfCritiqueFn: "Nothing
 *       governed to critique -- pass through"). This inverts the donor's
 *       fail-open default on purpose (A7 / Pitfall 2 / D-13); this repo's own
 *       watch list names silent false-success as a recurring bug class
 *       (feedback_false_success_silent_skip_gates_academy_testers.md), and a
 *       critic that cannot parse its input must not wave it through.
 *   (b) an unrecognized pass name FAILS here, where the donor's unknown-
 *       category fallthrough (governanceForCategory / enforceReviewerGovernance)
 *       returns ok:true / "nothing to enforce". Same reasoning: an
 *       unrecognized pass is a programming error signal, not a free pass.
 *
 * FORBIDDEN IN THIS FILE: async, await, Promise, fetch, require('node:http,
 * setTimeout. This module is a mechanical validator over an already-
 * materialized structured shape, exactly like enforceReviewerGovernance. If a
 * model judgment is ever wanted, it must be produced upstream by onStep and
 * land on result.chain_output BEFORE the critic runs. Rationale (RESEARCH
 * F-12): chain-executor.cjs's _ralphSafeRetry while loop never awaits, so a
 * Promise verdict has verdict.quality === undefined and
 * verdict.passed === undefined, _critiqueFailed returns false, and EVERY
 * candidate silently passes with no error logged.
 *
 * Pure / sync / LOCAL-first. No new deps. House rule: hyphens only, no em-dashes.
 *
 * License: BSL 1.1.
 */

// The two adversarial critic passes, in fixed order (D-10 unanimity ruling).
const SALIENT_PASSES = Object.freeze(['neutral', 'adversarial']);

// The closed direction bank -- taken verbatim from
// lib/agents/reverse-salient-agent.cjs::mapDirectionToCascadeEdge's own branch
// set (lines 66-82).
const RS_DIRECTIONS = Object.freeze([
  'structural_transfer',
  'semantic_implementation',
  'whitespace',
  'blindspot',
]);

// The seven neutral rule strings (field-completeness-or-retract), authored
// inline -- the donor's own test (tests/test-reviewer-governance.cjs) ships
// inline factory functions and no fixture file, so this module follows suit
// (Phase 264 CONTEXT.md Claude's Discretion item 2).
const NEUTRAL_RULES = Object.freeze([
  'finding.id is a non-empty string',
  'finding.source_artifact_id is a non-empty string',
  'finding.target_artifact_id is a non-empty string',
  'finding.direction is a non-empty string',
  'finding.signed_diff and finding.abs_diff are finite numbers',
  'finding.body_text is a non-empty (trimmed) string',
  'finding.brain_chain_text, when present, is a string',
]);

// The four adversarial-only rule strings (refute-or-concede), applied ONLY
// on the adversarial pass, reading the SAME fields under a stricter rule set.
const ADVERSARIAL_ONLY_RULES = Object.freeze([
  'source_artifact_id and target_artifact_id are not the same artifact',
  'signed_diff and abs_diff agree in magnitude (abs(signed_diff) === abs_diff)',
  'abs_diff is not exactly zero (a zero gap is not a bottleneck)',
  'direction is one of the closed RS_DIRECTIONS bank',
]);

// SALIENT_GOVERNANCE -- a frozen map with exactly two entries keyed by pass
// name, each carrying the donor's five fields (discipline, hard_gate, rules,
// evidence_policy, discipline_source).
const SALIENT_GOVERNANCE = Object.freeze({
  neutral: Object.freeze({
    discipline: 'field-completeness-or-retract: every field the Reverse Salient finding contract names is present and well-typed, or the finding is retracted',
    hard_gate: true,
    rules: NEUTRAL_RULES,
    evidence_policy: 'fields_present',
    discipline_source: 'lib/agents/reverse-salient-agent.cjs finding contract (8 fields)',
  }),
  adversarial: Object.freeze({
    discipline: 'refute-or-concede: the SAME finding fields under a strictly larger rule set, never a richer input',
    hard_gate: true,
    rules: Object.freeze(NEUTRAL_RULES.concat(ADVERSARIAL_ONLY_RULES)),
    evidence_policy: 'refute_or_concede',
    discipline_source: 'lib/core/eureka-critic.cjs two-pass unanimity ruling (a 9-judge panel delivered about 2.2 effective votes)',
  }),
});

function normalizePassName(passName) {
  return String(passName || '').trim().toLowerCase();
}

/**
 * governanceForPass(passName) -> the frozen entry or null. Normalizes with
 * String(passName || '').trim().toLowerCase(). Never throws.
 */
function governanceForPass(passName) {
  const key = normalizePassName(passName);
  return Object.prototype.hasOwnProperty.call(SALIENT_GOVERNANCE, key)
    ? SALIENT_GOVERNANCE[key]
    : null;
}

function isPlainNonArrayObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/**
 * findingFromResult(result) -> a plain object candidate finding, or null.
 *
 * Extraction order: if result is a plain non-array object and
 * result.chain_output is a plain non-array object, return result.chain_output;
 * else if result is a plain non-array object and it carries a
 * source_artifact_id key, return result; else return null.
 *
 * This function EXTRACTS only. It does NOT validate fields; validation is
 * enforceSalientGovernance's job, so violations can be specific rather than
 * collapsing every defect into one string.
 *
 * Deliberately does NOT call
 * require('./bono/hat-governance.cjs').argumentFromResult: it returns null
 * for this shape (RESEARCH F-14), which is exactly the silent-pass trap this
 * module exists to close.
 */
function findingFromResult(result) {
  if (!isPlainNonArrayObject(result)) return null;
  if (isPlainNonArrayObject(result.chain_output)) return result.chain_output;
  if (Object.prototype.hasOwnProperty.call(result, 'source_artifact_id')) return result;
  return null;
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.length > 0;
}

/**
 * enforceSalientGovernance(passName, finding) -> { ok: boolean, violations: string[] }
 *
 * Mechanical, structural checks only; never interprets prose. Violation
 * strings follow the donor's <category>_<reason> convention and carry ZERO
 * content bytes (Canon Part 8) -- never echo body_text, an artifact id, or
 * any turn text into a violation string.
 */
function enforceSalientGovernance(passName, finding) {
  const key = normalizePassName(passName);
  const violations = [];

  // Step 1: unrecognized pass name FAILS (divergence (b)).
  if (SALIENT_PASSES.indexOf(key) === -1) {
    return { ok: false, violations: ['rs_pass_unrecognized'] };
  }

  // Step 2: unparseable finding FAILS (divergence (a)).
  if (!isPlainNonArrayObject(finding)) {
    return { ok: false, violations: ['rs_finding_unrecognized'] };
  }

  // Step 3: the SEVEN NEUTRAL checks, applied for BOTH pass names.
  if (!isNonEmptyString(finding.id)) violations.push('rs_no_id');
  if (!isNonEmptyString(finding.source_artifact_id)) violations.push('rs_no_source_artifact');
  if (!isNonEmptyString(finding.target_artifact_id)) violations.push('rs_no_target_artifact');
  if (!isNonEmptyString(finding.direction)) violations.push('rs_direction_missing');
  if (!Number.isFinite(finding.signed_diff) || !Number.isFinite(finding.abs_diff)) {
    violations.push('rs_diff_not_numeric');
  }
  if (typeof finding.body_text !== 'string' || finding.body_text.trim().length === 0) {
    violations.push('rs_body_text_empty');
  }
  if (
    Object.prototype.hasOwnProperty.call(finding, 'brain_chain_text') &&
    finding.brain_chain_text !== undefined &&
    typeof finding.brain_chain_text !== 'string'
  ) {
    violations.push('rs_chain_text_type');
  }

  // Step 4: the FOUR ADVERSARIAL-ONLY checks, applied ONLY when
  // key === 'adversarial'. They read the SAME fields under a stricter rule
  // set; they must not consult any additional input (eureka-critic.cjs's
  // sycophancy-channel discipline).
  if (key === 'adversarial') {
    if (
      isNonEmptyString(finding.source_artifact_id) &&
      isNonEmptyString(finding.target_artifact_id) &&
      finding.source_artifact_id === finding.target_artifact_id
    ) {
      violations.push('rs_self_referential');
    }
    if (Number.isFinite(finding.signed_diff) && Number.isFinite(finding.abs_diff)) {
      if (Math.abs(finding.signed_diff) !== finding.abs_diff) {
        violations.push('rs_diff_sign_mismatch');
      }
    }
    if (Number.isFinite(finding.abs_diff) && finding.abs_diff === 0) {
      violations.push('rs_diff_below_floor');
    }
    if (RS_DIRECTIONS.indexOf(finding.direction) === -1) {
      violations.push('rs_direction_unrecognized');
    }
  }

  // Step 5.
  return { ok: violations.length === 0, violations: violations };
}

function dedupeUnion(a, b) {
  const out = [];
  const seen = Object.create(null);
  const push = function (v) {
    if (!seen[v]) {
      seen[v] = true;
      out.push(v);
    }
  };
  a.forEach(push);
  b.forEach(push);
  return out;
}

/**
 * makeSalientSelfCritiqueFn(opts) -> a selfCritiqueFn(step, result) closure.
 *
 * opts.commandFilter (optional string): when set, the returned critic GOVERNS
 * only steps whose step.command equals it, and ABSTAINS on every other step.
 * Absent or empty means govern every step (the fail-closed default).
 *
 * Never throws; never returns a Promise.
 */
function makeSalientSelfCritiqueFn(opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  const commandFilter = (typeof o.commandFilter === 'string' && o.commandFilter.length > 0)
    ? o.commandFilter
    : '';

  return function selfCritiqueFn(step, result) {
    const stepCommand = (step && typeof step === 'object' && typeof step.command === 'string')
      ? step.command
      : '';

    // ABSTAIN branch -- the ONE pass-through branch in the module, deliberately
    // narrow: only reachable when commandFilter is set AND the step command
    // differs. Preserves the incoming quality (rather than upgrading it to
    // 'high'), mirroring reviewer-governance.cjs's own passthrough behaviour,
    // and names the abstention via rs_step_not_governed so it is OBSERVABLE
    // rather than silent.
    if (commandFilter && stepCommand !== commandFilter) {
      const incomingQuality = (result && typeof result === 'object' && isNonEmptyString(result.quality))
        ? result.quality
        : 'high';
      return { passed: true, quality: incomingQuality, violations: ['rs_step_not_governed'] };
    }

    // GOVERNED branch.
    const finding = findingFromResult(result);
    const neutral = enforceSalientGovernance('neutral', finding);
    const adversarial = enforceSalientGovernance('adversarial', finding);
    const disagreement = (neutral.ok !== adversarial.ok);

    if (!neutral.ok || !adversarial.ok) {
      let violations = dedupeUnion(neutral.violations, adversarial.violations);
      if (disagreement) violations = dedupeUnion(violations, ['rs_pass_disagreement']);
      return { passed: false, quality: 'low', violations: violations };
    }

    return { passed: true, quality: 'high', violations: [] };
  };
}

module.exports = {
  SALIENT_GOVERNANCE,
  SALIENT_PASSES,
  RS_DIRECTIONS,
  governanceForPass,
  findingFromResult,
  enforceSalientGovernance,
  makeSalientSelfCritiqueFn,
};
