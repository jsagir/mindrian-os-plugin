#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 215-03 -- The Opportunity Statement emitter.
 *
 * The turnstile between a Eureka and a banked opportunity. A Eureka is a
 * curiosity ("whoa, those two connect"); an Opportunity Statement is banked,
 * ranked, repeatable ("here is the market, the risk, and who funds it"). This
 * module turns a SCORED candidate pair (from the Plan 01 AHP score + the Plan 02
 * three-dimension classifier + the tail-quadrant flag) into the ONE canonical
 * banked shape, gated by the SEED-050 critic.
 *
 * Shape provenance (source of record, NOT a net-new framework):
 *   - SEED-048 addendum, commit 360e4826 (the canonical Opportunity Statement
 *     formula: what combines with what, unmet need each side, who it is for,
 *     what kills it, next steps, market/impact tier, rank score).
 *   - the room's jhtv-d15 entry, section 3 (the same formula, drafted by hand).
 *   - Brain-routed (Part 8 generic query, confidence 0.90) to "PWS Value
 *     Proposition" -- this is PWS Value Proposition specialized for portfolio
 *     candidates, NOT a new framework (Canon Part 7, reuse before build).
 *
 * Critic honesty (215-RESEARCH.md Pitfall 4): a surprising pair is a curiosity,
 * NOT a bankable opportunity. A statement is banked ONLY after a real SEED-050
 * critic pass. When the Phase 212 critic module is absent from the tree, the
 * statement is stamped critic 'pending' and banked false -- NEVER a fabricated
 * pass. banked can NEVER be true on the 'pending' path.
 *
 * Egress posture (Canon Part 8, T-215-07): the statement is a LOCAL room
 * derivative; potential_tier is an abstract tier ENUM, never a real market-size
 * figure, so nothing minted here can carry a K/M/B money figure across any wire.
 *
 * Pure CJS, node built-ins only. No em-dashes anywhere (hyphens only), LTR,
 * plain ASCII prose (the Plan 04 runner renders the markdown around this text).
 */
'use strict';

const path = require('node:path');

// Repo root from lib/core/eureka/ -> three levels up.
const REPO_ROOT = path.join(__dirname, '..', '..', '..');

// ---------- The three portfolio dimensions ----------
// Byte-match the ahp-weights CRITERIA and the portfolio-dimensions DIMS WITHOUT
// importing either module (Part 7 leaf emitter). This is the fixed precedence
// order the risks / next-steps derivations iterate for determinism.
const DIMS = Object.freeze(['strategic_fit', 'validated_demand', 'tech_econ_feasibility']);

// ---------- CLAUSE_LABELS: the frozen canonical clause markers ----------
// ONE source of truth for the formula so it can never drift silently between
// this module, its test, and the Plan 05 reproduction check. The text is
// assembled by interleaving these markers with the derived slot values, in this
// exact order. Byte-exact per SEED-048 addendum 360e4826.
const CLAUSE_LABELS = Object.freeze([
  'Combining ',            // 0  -> tech_a
  ' (unmet need: ',        // 1  -> unmet_need_a
  ') and ',                // 2  -> tech_b
  ' (unmet need: ',        // 3  -> unmet_need_b
  ') creates a ',          // 4  -> novel_application
  ' that addresses ',      // 5  -> gap
  ', for ',                // 6  -> audience
  '. Key risks: ',         // 7  -> risks
  '. Next steps: ',        // 8  -> next_steps
  '. Estimated potential: ', // 9 -> potential_tier
  '. Score: ',             // 10 -> score_label
]);

// ---------- Required candidate slots (Test 6 / OPP_STATEMENT_INPUT) ----------
function requireString(value, label, errs) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errs.push(label);
  }
}

function validateCandidate(candidate) {
  const errs = [];
  if (!candidate || typeof candidate !== 'object') {
    throw new Error('OPP_STATEMENT_INPUT: candidate must be an object');
  }
  const a = candidate.a || {};
  const b = candidate.b || {};
  requireString(a.title, 'a.title', errs);
  requireString(a.primary_problem, 'a.primary_problem', errs);
  requireString(a.section, 'a.section', errs);
  requireString(b.title, 'b.title', errs);
  requireString(b.primary_problem, 'b.primary_problem', errs);
  requireString(b.section, 'b.section', errs);
  if (!Array.isArray(candidate.shared_problems) || candidate.shared_problems.length === 0
    || typeof candidate.shared_problems[0] !== 'string'
    || candidate.shared_problems[0].trim().length === 0) {
    errs.push('shared_problems[0]');
  }
  if (typeof candidate.score !== 'number' || !Number.isFinite(candidate.score)) {
    errs.push('score');
  }
  if (typeof candidate.rank !== 'number' || !Number.isFinite(candidate.rank)) {
    errs.push('rank');
  }
  if (errs.length > 0) {
    throw new Error('OPP_STATEMENT_INPUT: missing or invalid slot(s): ' + errs.join(', '));
  }
}

// ---------- Slot derivations (all deterministic, weak-dimension-reasoned) ----------

function weakSet(side) {
  return Array.isArray(side.weak_dimensions) ? side.weak_dimensions : [];
}

// unmet_need_a/b: derive from the FIRST weak dimension (fixed precedence), else
// the honest "underexploited reach" baseline when a side has no weak dimension.
function unmetNeed(side) {
  const weak = weakSet(side);
  const problem = side.primary_problem;
  if (weak.indexOf('validated_demand') !== -1) {
    return 'unvalidated demand around ' + problem;
  }
  if (weak.indexOf('tech_econ_feasibility') !== -1) {
    return 'unproven feasibility path for ' + problem;
  }
  if (weak.indexOf('strategic_fit') !== -1) {
    return 'no strategic home for ' + problem;
  }
  return 'underexploited reach of ' + problem;
}

// next_steps: for EACH dimension weak on EITHER side, the matching validation
// move; joined with '; ' in DIMS order (deterministic).
function nextSteps(candidate, audience) {
  const union = new Set([].concat(weakSet(candidate.a), weakSet(candidate.b)));
  const moves = [];
  for (const dim of DIMS) {
    if (!union.has(dim)) continue;
    if (dim === 'validated_demand') {
      moves.push('customer-discovery interviews with ' + audience);
    } else if (dim === 'tech_econ_feasibility') {
      moves.push('joint feasibility prototype across both assets');
    } else if (dim === 'strategic_fit') {
      moves.push('map to a named district/tier-1 problem owner');
    }
  }
  if (moves.length === 0) {
    // no side is weak anywhere: the combine itself is the thing to validate.
    return 'validate the combine hypothesis end to end';
  }
  return moves.join('; ');
}

// risks: the UNRESOLVED weaknesses -- dimensions weak on BOTH sides are what
// kills it. When no shared weakness exists, the combine itself is the risk.
function risks(candidate) {
  const wa = new Set(weakSet(candidate.a));
  const wb = weakSet(candidate.b);
  const shared = [];
  for (const dim of DIMS) {
    if (wa.has(dim) && wb.indexOf(dim) !== -1) shared.push(dim);
  }
  if (shared.length === 0) {
    return 'integration risk: the combine itself is the unproven step';
  }
  const phrases = shared.map((dim) => {
    if (dim === 'validated_demand') return 'both sides unvalidated on demand';
    if (dim === 'tech_econ_feasibility') return 'both sides unproven on feasibility';
    return 'both sides without a strategic home';
  });
  return phrases.join('; ');
}

// potential_tier: score quartile ENUM (never a real figure), plus the gem flag.
function potentialTier(candidate) {
  const s = candidate.score;
  let tier;
  if (s >= 0.75) tier = 'tier-1 (portfolio-lead)';
  else if (s >= 0.5) tier = 'tier-2 (develop)';
  else if (s >= 0.25) tier = 'tier-3 (watch)';
  else tier = 'tier-4 (park)';
  if (candidate.tail === true) {
    tier += ' - WEAK-SIGNAL TAIL';
  }
  return tier;
}

function scoreLabel(candidate) {
  return 'rank ' + candidate.rank + ' (composite ' + candidate.score.toFixed(2) + ')';
}

function deriveFields(candidate) {
  const firstShared = candidate.shared_problems[0];
  const audience = 'tech-transfer / portfolio operators triaging ' + firstShared + ' assets';
  return {
    tech_a: candidate.a.title,
    unmet_need_a: unmetNeed(candidate.a),
    tech_b: candidate.b.title,
    unmet_need_b: unmetNeed(candidate.b),
    novel_application: candidate.a.section + ' x ' + candidate.b.section + ' approach to ' + firstShared,
    gap: 'the ' + firstShared + ' gap neither side closes alone',
    audience: audience,
    risks: risks(candidate),
    next_steps: nextSteps(candidate, audience),
    potential_tier: potentialTier(candidate),
    score_label: scoreLabel(candidate),
  };
}

// Assemble the single canonical statement string from CLAUSE_LABELS interleaved
// with the derived slots (byte-stable order).
function assembleText(fields) {
  const slots = [
    fields.tech_a, fields.unmet_need_a, fields.tech_b, fields.unmet_need_b,
    fields.novel_application, fields.gap, fields.audience, fields.risks,
    fields.next_steps, fields.potential_tier, fields.score_label,
  ];
  let out = '';
  for (let i = 0; i < CLAUSE_LABELS.length; i += 1) {
    out += CLAUSE_LABELS[i] + slots[i];
  }
  return out;
}

// ---------- Critic gate seam (SEED-050, Phase 212) ----------
// Honesty rule (in code, non-negotiable): banked can NEVER be true on the
// 'pending' path -- that would bank an unverified Eureka, the exact Pitfall 4
// failure. banked is true ONLY when a resolved critic returns a passing verdict.

// _test override: undefined = no override (real guarded require); null = force
// the absent/pending path; a function = the injected verdict producer.
let _criticOverride;
let _criticOverridden = false;

function setCriticForTest(fnOrNull) {
  if (arguments.length === 0 || fnOrNull === undefined) {
    _criticOverridden = false;
    _criticOverride = undefined;
    return;
  }
  _criticOverridden = true;
  _criticOverride = fnOrNull; // function or null
}

// Guarded require of the Phase 212 critic. Present -> the module (or the test
// stub). Absent (MODULE_NOT_FOUND) -> null, which drives critic 'pending'. Any
// OTHER throw from the critic module PROPAGATES: a broken critic must be seen,
// not swallowed (T-215-06).
function resolveCritic() {
  if (_criticOverridden) return _criticOverride; // function or null
  try {
    // eslint-disable-next-line global-require
    return require(path.join(REPO_ROOT, 'lib', 'core', 'eureka-critic.cjs'));
  } catch (err) {
    if (err && err.code === 'MODULE_NOT_FOUND') return null;
    throw err;
  }
}

// A verdict is a "pass" when it explicitly says so (stub seam) or when the real
// 212 critic routes the candidate 'transferable' (its passing verdict enum).
function verdictPasses(verdict) {
  return !!(verdict && (verdict.pass === true || verdict.verdict === 'transferable'));
}

function runCriticGate(fields, text) {
  const critic = resolveCritic();

  // Absent (or force-absent) -> the honest degrade state.
  if (critic === null || critic === undefined) {
    return { critic: 'pending', banked: false };
  }

  let verdict;
  if (typeof critic === 'function') {
    // Injected synchronous verdict producer (the _test seam).
    verdict = critic(fields, text);
  } else if (critic && typeof critic.stageA === 'function') {
    // The real Phase 212 module. Its declared Stage A entry is async and
    // encoder-dependent, which does not compose with this synchronous
    // deterministic emitter (the Plan 04 runner consumes a plain object). We
    // invoke it best-effort: a Promise (the real async path) cannot be resolved
    // here, so we stay honest -- critic 'pending', banked false, NEVER a
    // fabricated pass. A future async runner can await the real verdict; this
    // synchronous seam never claims a verification it did not obtain.
    try {
      const candidate = {
        text: text,
        mechanismText: fields.novel_application,
        sourceDomainTag: 'unknown',
        targetDomainTag: 'unknown',
        differential: {},
      };
      const res = critic.stageA(candidate, {});
      if (res && typeof res.then === 'function') {
        return { critic: 'pending', banked: false };
      }
      verdict = res;
    } catch (err) {
      // A critic that throws at call time degrades honestly to pending here
      // (the record stays unbanked); it is never counted as a pass.
      return { critic: 'pending', banked: false };
    }
  } else {
    // Resolved to something that is neither a verdict function nor a critic
    // module -- treat as unavailable, stay pending.
    return { critic: 'pending', banked: false };
  }

  return { critic: verdict, banked: verdictPasses(verdict) };
}

// ---------- Public entry ----------

/**
 * buildOpportunityStatement(candidate) -> { text, fields, banked, critic, weak_dimensions }
 *
 * candidate = {
 *   a: { id, title, primary_problem, section, weak_dimensions },
 *   b: { id, title, primary_problem, section, weak_dimensions },
 *   shared_problems, dims, score, rank, tail
 * }
 */
function buildOpportunityStatement(candidate) {
  validateCandidate(candidate);
  const fields = deriveFields(candidate);
  const text = assembleText(fields);
  const gate = runCriticGate(fields, text);
  return {
    text: text,
    fields: fields,
    banked: gate.banked,
    critic: gate.critic,
    weak_dimensions: {
      a: weakSet(candidate.a).slice(),
      b: weakSet(candidate.b).slice(),
    },
  };
}

module.exports = {
  buildOpportunityStatement: buildOpportunityStatement,
  CLAUSE_LABELS: CLAUSE_LABELS,
  DIMS: DIMS,
  _test: {
    setCriticForTest: setCriticForTest,
    deriveFields: deriveFields,
    assembleText: assembleText,
  },
};
