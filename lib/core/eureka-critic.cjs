/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 212-01 -- Eureka Grounding Guard (Critic): contract layer + Stage A.
 *
 * WHAT THIS IS
 *   The verifier that decides whether a high differential from the Phase 211
 *   generator is a REAL transferable salient or confident noise. It never
 *   improves the generator; it grades the generator's output.
 *
 * TWO-STAGE ARCHITECTURE (212-RESEARCH Architectural Responsibility Map)
 *   Stage A  (this file, deterministic, NO LLM): four programmatic gates run
 *            BEFORE any model call -- fabricated-quantity flag, domain-swap
 *            invariance, nearest-neighbor novelty delta, entity-specificity.
 *            Candidates that fail Stage A never reach an LLM judge. This alone
 *            kills the "$2-5B exit" and "tahini x blockchain" classes (D6).
 *   Stage B  (a later plan, Claude LOCAL, 2 calls): neutral + adversarial
 *            rubric passes; the verdict is computed BY CODE from the item
 *            pattern, never picked by the model.
 *
 * LOCAL / REMOTE SPLIT (Canon Part 8)
 *   Everything that touches raw room content runs LOCAL. The ONLY thing that
 *   may later cross the MCP boundary is the output of assembleCriticPayload():
 *   quantized scalars + closed enums (20-60 bits, not invertible to content).
 *   assembleCriticPayload is the single choke point; it reuses the Part 8
 *   egress audit (rs-egress-prompts) rather than hand-rolling a second one.
 *
 * PORTABILITY (D4, D5)
 *   Pure CJS, zero MCP-framework imports of any kind and zero room-directory
 *   knowledge. This is the one file SEED-014 later LIFTS into the separate
 *   Brain repo as a move, not a rewrite. The thin MCP wrapper lives elsewhere
 *   (a later plan) and never couples the critic logic to its request shape.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Part 8 dual-layer egress audit -- REUSED, not re-implemented (D1). The exact
// precedent is rs-differential-scorer.cjs's scoreMeasured: auditQueryString on
// inputs, auditQueryObject on the assembled output record.
const { auditQueryString, auditQueryObject } = require('./rs-egress-prompts.cjs');

const TAGS_PATH = path.join(__dirname, '..', '..', 'data', 'eureka-critic-tags.json');

// ---------- Stage A env tunables (read at CALL time, not module load) ----------
//
// Mirrors the RS_SEMANTIC_FLOOR precedent so an operator can retune a gate
// without a code change and tests can override per call. Q4 lock: these
// thresholds are calibrated against the shipped embedder (mdbr-leaf-ir); the
// encoder provenance travels with the features so a future swap invalidates
// cleanly rather than silently drifting (Pitfall 8).

function envFloat(name, fallback) {
  const v = parseFloat(process.env[name]);
  return Number.isFinite(v) ? v : fallback;
}
function envInt(name, fallback) {
  const v = parseInt(process.env[name], 10);
  return Number.isFinite(v) ? v : fallback;
}

function swapInvarianceFloor() { return envFloat('EUREKA_SWAP_INVARIANCE_FLOOR', 0.05); }
function swapK() { return envInt('EUREKA_SWAP_K', 3); }
function nnDeltaFloor() { return envFloat('EUREKA_NN_DELTA_FLOOR', 0.10); }
function entityMin() { return envInt('EUREKA_ENTITY_MIN', 2); }

// ---------- loadCriticTags ----------
//
// Reads the closed versioned enum registry relative to THIS module (never a
// cwd-relative or room-relative path -- D5). Validates schema_version and
// caches so repeated calls do not re-read from disk.

let _tagsCache = null;
function loadCriticTags() {
  if (_tagsCache) return _tagsCache;
  const raw = fs.readFileSync(TAGS_PATH, 'utf8');
  const tags = JSON.parse(raw);
  if (tags.schema_version !== 1) {
    throw new Error('eureka-critic-tags.json: unexpected schema_version ' + tags.schema_version + ' (expected 1)');
  }
  if (!Array.isArray(tags.verdicts) || tags.verdicts.length !== 4) {
    throw new Error('eureka-critic-tags.json: verdicts must be exactly four members');
  }
  if (!Array.isArray(tags.domain_tags) || tags.domain_tags.length === 0) {
    throw new Error('eureka-critic-tags.json: domain_tags must be a non-empty array');
  }
  _tagsCache = tags;
  return tags;
}

// VERDICTS: frozen array re-exported from the tags file (single source of truth).
const VERDICTS = Object.freeze(loadCriticTags().verdicts.slice());

// ---------- quantize ----------
//
// Null-safe 2-decimal rounding. D3b item 1 (non-negotiable): a full-precision
// float32 similarity is close to a unique fingerprint of a specific document
// pair; quantizing destroys that content-linkage channel BEFORE any field can
// leave the machine. Non-finite input returns null (never a NaN on the wire).

function quantize(x) {
  if (typeof x !== 'number' || !Number.isFinite(x)) return null;
  return Math.round(x * 100) / 100;
}

// ---------- assembleCriticPayload ----------
//
// The single choke point that shapes what may later cross the MCP boundary
// (D1). Builds a fresh object with EXACTLY the closed key set; every scalar is
// quantized, every domain tag must be a member of the closed enum, and the one
// passthrough string field (surprise_type) is scanned by the Part 8 auditor.
// No artifact IDs, no free text, no raw floats survive past this function
// (D3b items 1-2). Extra keys on `features` are dropped by construction.

function assembleCriticPayload(features) {
  if (features === null || typeof features !== 'object') {
    throw new TypeError('assembleCriticPayload: features must be an object');
  }
  const tags = loadCriticTags();
  const domainTags = tags.domain_tags;

  const src = features.source_domain_tag;
  const tgt = features.target_domain_tag;
  if (!domainTags.includes(src)) {
    throw new TypeError('assembleCriticPayload: source_domain_tag not in closed domain enum: ' + String(src));
  }
  if (!domainTags.includes(tgt)) {
    throw new TypeError('assembleCriticPayload: target_domain_tag not in closed domain enum: ' + String(tgt));
  }

  // Part 8 Layer 1: scan the one passthrough string field before it can egress
  // (the scoreMeasured auditQueryString-on-inputs precedent). A smuggled email /
  // currency / content string here throws ExternalEgressViolation.
  const surpriseType = features.surprise_type;
  auditQueryString(typeof surpriseType === 'string' ? surpriseType : '', 'eureka-critic-mcp');

  // rubric_pattern is a 6-slot [01x] string; 'xxxxxx' means Stage B never ran.
  const rubricPattern = (typeof features.rubric_pattern === 'string' && /^[01x]{6}$/.test(features.rubric_pattern))
    ? features.rubric_pattern
    : 'xxxxxx';

  const payload = {
    differential_score: quantize(features.differential_score),
    semantic_similarity: quantize(features.semantic_similarity),
    lsa_similarity: quantize(features.lsa_similarity),
    surprise_type: surpriseType,
    source_domain_tag: src,
    target_domain_tag: tgt,
    rubric_pattern: rubricPattern,
    schema_version: tags.schema_version,
  };

  // Part 8 Layer 2: JSON.stringify audit on the assembled wire object -- the
  // last line of defense against a forbidden pattern smuggled through any field
  // (auditQueryObject, rs-egress-prompts reuse; T-212-01 mitigation).
  auditQueryObject(payload, 'eureka-critic-mcp');
  return payload;
}

// ---------- Exports (stageA is appended in Plan 212-01 Task 2) ----------

module.exports = {
  loadCriticTags: loadCriticTags,
  VERDICTS: VERDICTS,
  quantize: quantize,
  assembleCriticPayload: assembleCriticPayload,
  // Env-tunable resolvers (exported for the Stage A gates + tests).
  _tunables: {
    swapInvarianceFloor: swapInvarianceFloor,
    swapK: swapK,
    nnDeltaFloor: nnDeltaFloor,
    entityMin: entityMin,
  },
};
