'use strict';
// Phase 189-02 (HITL Memory Governance; SEED-040 / HMG-02) -- the F.8 governance
// BASKET renderer. This COMPOSES the shipped Phase-188 F.8 selector
// (shape-f8-renderer.cjs). It mints NO new selector shape and NO new frozen scalar
// -- it clones the renderUmbilicalBasket structural template (Phase 195-05) exactly,
// supplying only the domain-specific mapping (a governance candidate -> a toggle).
//
// Each candidate becomes a toggle whose LABEL is its candidate_id (a structural
// handle, Part-8-safe, NEVER prose / a node body) and whose confidence rides the
// toggle. A candidate whose confidence >= the frozen PRE_CHECK_THRESHOLD (0.70,
// imported from the renderer, never re-minted) renders PRE-CHECKED -- display-only,
// NEVER auto-applied. Rendering writes ZERO edges; nothing lands until the single
// confirm the closer consumes.
//
// Only a candidate that passes governance-candidate.validateCandidate renders; a
// malformed candidate is dropped, never rendered, never crashes the basket.
//
// Canon Part 8: the label is a structural id only; no candidate body ever renders.
// House rule: CJS only, hyphens only (no em-dashes).

const shapeF8 = require('../../hmi/shape-f8-renderer.cjs');
const governanceCandidate = require('./governance-candidate.cjs');

// The HITL shape this basket declares. It COMPOSES F.8; it mints no new shape.
const HITL_SHAPE = 'F.8';

// The frozen pre-check threshold, REUSED from the shipped renderer -- NOT minted
// here. This module never defines its own 0.7x scalar.
const PRE_CHECK_THRESHOLD = shapeF8.PRE_CHECK_THRESHOLD;

// _enrich(cand) -> a full candidate the validateCandidate contract accepts.
// The findGovernanceCandidates query hands us { candidate_id, kind, confidence,
// source_path } (the target_section / affected_sections / layer are filled HERE,
// per the Task 1 contract note). We derive a defensible default: the target
// section is the candidate's source_path when present, affected_sections is the
// single-element list of that section (or the candidate_id when no section is
// known), and layer stays null (WHO/WHERE is decided later, never silently
// defaulted -- validateCandidate accepts null layer at raise time). A candidate
// that already carries these fields is passed through unchanged.
function _enrich(cand) {
  if (!cand || typeof cand !== 'object') return cand;
  const section = (typeof cand.target_section === 'string' && cand.target_section.length > 0)
    ? cand.target_section
    : ((typeof cand.source_path === 'string' && cand.source_path.length > 0) ? cand.source_path : null);
  let affected = cand.affected_sections;
  if (!Array.isArray(affected) || affected.length < 1) {
    const fallback = section || (typeof cand.candidate_id === 'string' ? cand.candidate_id : null);
    affected = fallback ? [fallback] : [];
  }
  return {
    candidate_id: cand.candidate_id,
    kind: cand.kind,
    confidence: (cand.confidence === undefined) ? null : cand.confidence,
    target_section: section,
    affected_sections: affected,
    layer: (cand.layer === undefined) ? null : cand.layer,
  };
}

/**
 * renderGovernanceBasket(candidates, opts) -> { zones, contract }
 *
 * Mirrors renderUmbilicalBasket: map each VALID candidate to a toggle carrying its
 * candidate_id as the label + its confidence, call shapeF8.renderShapeF8 with those
 * options + a header, then declare rendered.contract.hitl_shape = 'F.8' (composes
 * the shipped shape, mints nothing). A candidate that fails validateCandidate is
 * silently dropped -- never rendered, never a crash.
 */
function renderGovernanceBasket(candidates, opts) {
  opts = opts || {};
  const list = Array.isArray(candidates) ? candidates : [];
  const options = [];
  for (const raw of list) {
    const cand = _enrich(raw);
    const verdict = governanceCandidate.validateCandidate(cand);
    if (!verdict || verdict.ok !== true) continue; // malformed -> drop, never render
    const label = cand.candidate_id;
    options.push({
      label: label,
      confidence: (typeof cand.confidence === 'number' && Number.isFinite(cand.confidence)) ? cand.confidence : null,
    });
  }

  const rendered = shapeF8.renderShapeF8({
    options: options,
    header: (typeof opts.header === 'string' && opts.header.length > 0)
      ? opts.header
      : '-- mindrianOS -- memory -- govern --',
    personaContext: opts.personaContext,
  });

  // Declare the composed HITL shape on the contract (F.8; no new shape minted).
  rendered.contract.hitl_shape = HITL_SHAPE;
  return rendered;
}

module.exports = {
  HITL_SHAPE: HITL_SHAPE,
  PRE_CHECK_THRESHOLD: PRE_CHECK_THRESHOLD,
  renderGovernanceBasket: renderGovernanceBasket,
};
