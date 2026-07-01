'use strict';
// Phase 189-01 (HITL Memory Governance; SEED-040 / HMG-08) -- the governance-candidate
// data contract EVERY later plan (189-02/03/04) imports. Interface-first ordering: the
// shape a candidate must conform to is defined ONCE here so the downstream plans build
// AGAINST a contract instead of re-deriving it.
//
// PURE + zero-I/O + zero-Brain-wire. This module opens no db, requires no navigation /
// room-db surface, performs no network call. It is a plain data-shape validator. Canon
// Part 8: WHAT/HOW/WHO over user content is CONTENT-SET, LOCAL only -- this module never
// touches bodies and never wires to Brain. Canon Part 9: only a human confirms a
// truth-claim node; this contract carries the SHAPE of the candidate a human will
// confirm, never a silent auto-promotion.
//
// House rule: CJS only, hyphens only (no em-dashes).

// CANDIDATE_KINDS -- the truth-claim kinds a governance candidate can be. Reuses the
// semantics of transitions.cjs TRUTH_CLAIM_TYPES (claim / assumption / opportunity /
// decision) but is kept LOCAL to memory/ so lib/core/memory/ never requires
// lib/core/navigation/transitions.cjs -- this contract module has NO navigation
// dependency, so 189-02/03/04 can each import it independently. (CausalClaim /
// SyntheticExpert from TRUTH_CLAIM_TYPES are intentionally OUT of the candidate set:
// the confirm gate covers user-raised claims/assumptions/opportunities/decisions, not
// system-derived causal or synthetic-expert nodes.)
const CANDIDATE_KINDS = Object.freeze(new Set(['claim', 'assumption', 'opportunity', 'decision']));

// LAYER_VALUES -- the memory_layer enum. The exact three strings the shipped /mos:memory
// three-layer model already uses (commands/memory.md "Layers" + lib/hmi/across-session-
// memory.cjs). WHO/WHERE a memory lives is an explicit choice, never a silent default.
const LAYER_VALUES = Object.freeze(new Set(['within-session', 'across-session', 'cross-room']));

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.length > 0;
}

// validateCandidate(candidate) -> { ok: true } | { ok: false, reason }
//
// Deterministic, never throws, degrades to { ok:false, reason } on any malformed input.
// Checks the candidate is a plain object carrying:
//   candidate_id       -- non-empty string
//   kind               -- member of CANDIDATE_KINDS
//   confidence         -- number in [0,1], or null
//   target_section     -- non-empty string, or null (the single-section / no-single-
//                         target case)
//   affected_sections  -- array of non-empty strings, length >= 1
//   layer              -- member of LAYER_VALUES, or null. null is LEGAL at
//                         candidate-raise time (WHO is decided later, never silently
//                         defaulted) but the confirm-time gate (189-02+) rejects null.
function validateCandidate(candidate) {
  if (!isPlainObject(candidate)) {
    return { ok: false, reason: 'candidate_not_object' };
  }

  if (!isNonEmptyString(candidate.candidate_id)) {
    return { ok: false, reason: 'invalid_candidate_id' };
  }

  if (typeof candidate.kind !== 'string' || !CANDIDATE_KINDS.has(candidate.kind)) {
    return { ok: false, reason: 'invalid_kind' };
  }

  const conf = candidate.confidence;
  const confOk = conf === null
    || (typeof conf === 'number' && Number.isFinite(conf) && conf >= 0 && conf <= 1);
  if (!confOk) {
    return { ok: false, reason: 'invalid_confidence' };
  }

  const ts = candidate.target_section;
  if (!(ts === null || isNonEmptyString(ts))) {
    return { ok: false, reason: 'invalid_target_section' };
  }

  const affected = candidate.affected_sections;
  if (!Array.isArray(affected) || affected.length < 1) {
    return { ok: false, reason: 'invalid_affected_sections' };
  }
  for (const s of affected) {
    if (!isNonEmptyString(s)) {
      return { ok: false, reason: 'invalid_affected_section_member' };
    }
  }

  const layer = candidate.layer;
  if (!(layer === null || (typeof layer === 'string' && LAYER_VALUES.has(layer)))) {
    return { ok: false, reason: 'invalid_layer' };
  }

  return { ok: true };
}

module.exports = { CANDIDATE_KINDS, LAYER_VALUES, validateCandidate };
