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

// ---------- Stage A gate helpers (deterministic, pure) ----------

// The SAME fabricated-quantity regex class the 211-05 Part 8 guard uses: a bare
// K/M/B magnitude, plus any dollar figure. Real room nodes carrying catalog
// figures trip this, which is why opts.sourcedQuantities exists as an escape
// hatch (the JHU catalog-sourced Opportunity Statement drafts declare their
// figures as sourced). This is deliberately the [KMB] class, not a fork.
const FABRICATED_QUANTITY = /\b\d+(?:\.\d+)?[KMB]\b/;
const DOLLAR_FIGURE = /\$\s?\d/;

// Deterministic generic nouns for the swap-invariance perturbation. Swapping
// domain nouns for these should MOVE a real mechanism's embedding a lot; a
// generic-filler mechanism barely moves (the D6 failure signature computable).
const GENERIC_NOUNS = Object.freeze([
  'system', 'process', 'method', 'structure', 'pattern',
  'element', 'component', 'mechanism',
]);

const SWAP_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'into', 'across', 'from', 'that', 'this',
  'their', 'through', 'over', 'under', 'between', 'these', 'those', 'they',
  'which', 'while', 'where', 'when', 'then', 'than', 'them', 'have', 'been',
]);

// nounSwap: deterministically replace up to three domain-content tokens (length
// >= 4, not a stopword) with a single generic replacement chosen by variant
// index. Always returns a string DIFFERENT from the input (appends the generic
// noun when nothing matched) so an embedder that ignores content yields shift 0
// while a real embedder yields a large shift.
function nounSwap(text, variantIndex) {
  const replacement = GENERIC_NOUNS[variantIndex % GENERIC_NOUNS.length];
  const tokens = String(text == null ? '' : text).split(/\s+/);
  let replaced = 0;
  const out = tokens.map(function (tok) {
    const core = tok.replace(/[^A-Za-z]/g, '');
    if (core.length >= 4 && replaced < 3 && !SWAP_STOPWORDS.has(core.toLowerCase())) {
      replaced += 1;
      return tok.replace(core, replacement);
    }
    return tok;
  });
  let result = out.join(' ');
  if (replaced === 0) result = result + ' ' + replacement;
  return result;
}

// countEntities: proper-noun-shaped tokens (mid-sentence Capitalized words +
// ALL-CAPS acronyms) plus number-with-unit tokens (50mg, 1550nm, 5A). A vague
// mechanism names few specific entities and is not independently checkable.
function countEntities(text) {
  const s = String(text == null ? '' : text);
  let count = (s.match(/\b\d+(?:\.\d+)?[A-Za-z]{1,4}\b/g) || []).length;
  const tokens = s.split(/\s+/);
  for (let i = 0; i < tokens.length; i += 1) {
    const core = tokens[i].replace(/[^A-Za-z0-9]/g, '');
    if (/^[A-Z]{2,}$/.test(core)) count += 1;
    else if (i > 0 && /^[A-Z][a-z]+/.test(core)) count += 1;
  }
  return count;
}

// ---------- stageA ----------
//
// Deterministic, NO-LLM gate set (D2 item 1). Gates run in a fixed order and
// the first failure returns immediately, so a forbidden candidate never reaches
// an encoder. Async because a real encoder is async. Never throws on encoder
// failure: it degrades to a pessimistic calibration_unknown envelope, mirroring
// embedTexts' never-throws contract.
//
//   candidate = { text, mechanismText, sourceDomainTag, targetDomainTag, differential }
//   opts      = { encodeFn, knnFn, sourcedQuantities, <env-tunable overrides> }
//
async function stageA(candidate, opts) {
  const cand = candidate || {};
  const options = opts || {};
  const text = String(cand.text == null ? '' : cand.text);
  const mechanismText = String(cand.mechanismText == null ? '' : cand.mechanismText);

  // --- Gate 1: fabricated-quantity flag (BEFORE any embedding). ---
  // Kills the "$2-5B exit" class. The encoder is never invoked when this trips.
  if (options.sourcedQuantities !== true &&
      (FABRICATED_QUANTITY.test(text) || DOLLAR_FIGURE.test(text))) {
    return { pass: false, route: 'pseudoscience', tag: 'unsourced_quantity' };
  }

  // Lazy-require the embedding spine INSIDE the function (Canon Decision 8) so
  // the critic still loads when the heavy dep is absent. The encodeFn injection
  // seam routes tests through a stub; production uses the real batched model.
  // eslint-disable-next-line global-require
  const spine = require('./eureka/embedding-spine.cjs');

  const k = swapK();
  const variants = [];
  for (let i = 0; i < k; i += 1) variants.push(nounSwap(mechanismText, i + 1));
  const toEmbed = [mechanismText].concat(variants);

  const emb = await spine.embedTexts(toEmbed, options);
  if (!emb || emb.success !== true || !Array.isArray(emb.vectors) || emb.vectors.length < 1) {
    // Encoder unavailable: degrade, never throw (Blocker 2 lesson).
    return { pass: false, route: 'general_shallow', tag: 'calibration_unknown', degraded: true };
  }

  const embedder = (emb.provenance && emb.provenance.model) || 'unknown';
  const originalVec = emb.vectors[0];

  // --- Gate 2: domain-swap invariance. shift = 1 - mean cosine(original, variants). ---
  let cosSum = 0;
  let cosN = 0;
  for (let i = 1; i < emb.vectors.length; i += 1) {
    const c = spine.cosineSimilarity(originalVec, emb.vectors[i]);
    if (Number.isFinite(c)) { cosSum += c; cosN += 1; }
  }
  const meanCos = cosN > 0 ? cosSum / cosN : 1;
  const shift = 1 - meanCos;
  if (shift < swapInvarianceFloor()) {
    return { pass: false, route: 'general_shallow', tag: 'domain_swap_invariant', features: { shift: quantize(shift), embedder: embedder } };
  }

  const features = { shift: quantize(shift), embedder: embedder };

  // --- Gate 3: nearest-neighbor novelty delta. Degrades when knnFn is absent. ---
  let nnDelta = null;
  if (typeof options.knnFn === 'function') {
    try {
      const neighbors = await options.knnFn(originalVec, swapK());
      let maxSim = 0;
      if (Array.isArray(neighbors)) {
        for (let i = 0; i < neighbors.length; i += 1) {
          const sim = neighbors[i] && neighbors[i].similarity;
          if (Number.isFinite(sim) && sim > maxSim) maxSim = sim;
        }
      }
      nnDelta = 1 - maxSim;
      features.nn_delta = quantize(nnDelta);
      if (nnDelta < nnDeltaFloor()) {
        features.entity_count = countEntities(mechanismText);
        return { pass: false, route: 'restatement', tag: 'low_novelty_delta', features: features };
      }
    } catch (err) {
      features.gate_skipped = 'nn_unavailable';
      features.nn_delta = null;
    }
  } else {
    // No kNN backend wired (vec0 fix is a parallel dependency): degrade, do not
    // die. The candidate can still pass on the remaining deterministic gates.
    features.gate_skipped = 'nn_unavailable';
    features.nn_delta = null;
  }

  // --- Gate 4: entity-specificity. ---
  const entityCount = countEntities(mechanismText);
  features.entity_count = entityCount;
  if (entityCount < entityMin()) {
    return { pass: false, route: 'general_shallow', tag: 'entity_nonspecific', features: features };
  }

  // Passed every deterministic gate. Provenance travels with the features so a
  // future embedder swap invalidates the mdbr-leaf-ir-calibrated thresholds
  // cleanly (Q4 lock) rather than silently drifting.
  return { pass: true, features: features };
}

// ============================================================================
// STAGE B -- the two-pass rubric, verdict-by-code, and the composed pipeline
// (Plan 212-02). Everything here runs LOCAL: the judge needs raw content, so a
// content-egress would breach Canon Part 8 (212-RESEARCH Architectural
// Responsibility Map). Only the abstracted rubric BOOLEAN PATTERN + the D1
// scalars ever reach criticRule, the one function the Phase-03 MCP tool wraps.
// ============================================================================

// ---------- RUBRIC_ITEMS ----------
//
// Six BINARY items, keyed a-f, wording grounded in SEED-050's documented failure
// modes (rubric-not-Likert, D2 item 2; the LLM answers items, CODE computes the
// class). The items are expert-grounded, NOT model-invented: each traces to a
// real failure the critic exists to catch.
//   a - the "swap the nouns, text unchanged = generic filler" signature (SEED-050)
//   b - Gentner structure-mapping: no orphan elements
//   c - falsifiability: an "X is a living Y" metaphor yields no checkable consequence
//   d - Pitfall 2: high differential is NECESSARY not SUFFICIENT; must beat the graph edge
//   e - the #1 job: a restatement is the same idea with vocabulary swapped
//   f - the "$2-5B exit" class: no unsourced quantities in the claim
const RUBRIC_ITEMS = Object.freeze([
  Object.freeze({ id: 'a', question: 'Is the shared relational schema statable WITHOUT either domain\'s nouns?', evidence_instruction: 'state the schema in one domain-free sentence' }),
  Object.freeze({ id: 'b', question: 'Do the elements map one-to-one across the two domains with no orphans?', evidence_instruction: 'name one mapped pair and any orphan' }),
  Object.freeze({ id: 'c', question: 'Does the stated mechanism yield a consequence a reader could actually check?', evidence_instruction: 'state the one checkable consequence' }),
  Object.freeze({ id: 'd', question: 'Does the claim add something over the nearest prior knowledge / graph edge?', evidence_instruction: 'name what it adds' }),
  Object.freeze({ id: 'e', question: 'Is the claim genuinely NOT a restatement of the source in the target\'s vocabulary?', evidence_instruction: 'give the one difference that makes it more than a paraphrase' }),
  Object.freeze({ id: 'f', question: 'Is the claim free of unsourced quantities or statistics?', evidence_instruction: 'name any figure and whether it is sourced' }),
]);

const RUBRIC_KEYS = Object.freeze(['a', 'b', 'c', 'd', 'e', 'f']);

// ---------- verdictFromRubric ----------
//
// The Pattern-2 mapping, exported pure. The LLM NEVER picks the class; this total
// function computes it from the item booleans, biased to REJECT on ambiguity
// (Pitfall 1). Accepts 1/0 or true/false interchangeably (truthiness).
function verdictFromRubric(items) {
  if (!items.f || !items.c) return 'pseudoscience';
  if (!items.e) return 'restatement';
  if (!items.d) return 'general_shallow';
  if (items.a && items.b && items.c) return 'transferable';
  return 'general_shallow';
}

// reasoningTagFromItems: the closed-enum reasoning tag that matches the verdict
// path verdictFromRubric took, so a downstream reader gets a one-line WHY without
// any free text crossing a boundary. Same priority order as the verdict mapping.
function reasoningTagFromItems(items) {
  if (!items.f) return 'unsourced_quantity';
  if (!items.c) return 'no_checkable_consequence';
  if (!items.e) return 'restatement_vocab_swap';
  if (!items.d) return 'low_novelty_delta';
  if (items.a && items.b && items.c) return 'passes_all_gates';
  return 'schema_orphan';
}

// ---------- parseRubricResponse ----------
//
// Tolerant parser for a judgeFn return. A stub judgeFn (tests) returns an object
// with a..f booleans directly; a real local Claude pass returns a markdown-ish
// string. Both normalize to { a..f: boolean }. Unparseable items default FALSE
// (bias to reject, Pitfall 1) so a garbled judge answer never silently blesses.
function coerceBool(v) {
  if (v === true || v === 1) return true;
  if (v === false || v === 0 || v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === 'yes' || s === 'true' || s === 'y' || s === '1';
}

function parseRubricResponse(resp) {
  const out = {};
  const obj = (resp && typeof resp === 'object' && !Array.isArray(resp))
    ? (resp.items && typeof resp.items === 'object' ? resp.items : resp)
    : null;
  if (obj) {
    for (let i = 0; i < RUBRIC_KEYS.length; i += 1) {
      out[RUBRIC_KEYS[i]] = coerceBool(obj[RUBRIC_KEYS[i]]);
    }
    return out;
  }
  const text = String(resp == null ? '' : resp);
  for (let i = 0; i < RUBRIC_KEYS.length; i += 1) {
    const k = RUBRIC_KEYS[i];
    const m = text.match(new RegExp('(?:^|\\n)\\s*[*-]?\\s*\\(?' + k + '\\)?\\s*[).:=-]\\s*(yes|no|true|false|1|0)', 'i'));
    out[k] = m ? coerceBool(m[1]) : false;
  }
  return out;
}

// ---------- prompt builders (mechanism + mapping ONLY, D2 item 5) ----------
//
// The prompts carry the mechanism text and the proposed mapping and NOTHING else:
// never the differential score, the excitement band, or any provenance/framing.
// Exposing the candidate's persuasive framing to the judge reopens the sycophancy
// channel D1 was built to close (arXiv:2310.13548). The adversarial pass asks the
// judge to argue the connection is generic filler and complete a counter-mapping.
function candidateMechanism(candidate) {
  return String((candidate && candidate.mechanismText) || '');
}
function candidateMapping(candidate) {
  const c = candidate || {};
  return String(c.mappingStatement || c.mapping || c.claim || '');
}
function renderRubricItems() {
  return RUBRIC_ITEMS.map(function (it) {
    return '- (' + it.id + ') ' + it.question + ' [evidence: ' + it.evidence_instruction + ']';
  }).join('\n');
}
function buildNeutralPrompt(candidate) {
  return [
    'Grade the proposed cross-domain analogy against the fixed rubric below.',
    'Answer each item yes or no, each with one sentence of evidence.',
    '',
    'MECHANISM:',
    candidateMechanism(candidate),
    '',
    'PROPOSED MAPPING:',
    candidateMapping(candidate),
    '',
    'RUBRIC:',
    renderRubricItems(),
  ].join('\n');
}
function buildAdversarialPrompt(candidate) {
  return [
    'Argue this proposed analogy is generic filler. Actively try to complete a',
    'COUNTER-mapping showing the connection is superficial, then answer each rubric',
    'item yes or no with one sentence of evidence, taking the skeptical reading when unsure.',
    '',
    'MECHANISM:',
    candidateMechanism(candidate),
    '',
    'PROPOSED MAPPING:',
    candidateMapping(candidate),
    '',
    'RUBRIC:',
    renderRubricItems(),
  ].join('\n');
}

// ---------- runRubric ----------
//
// The two-pass protocol: EXACTLY two judgeFn calls (neutral, then adversarial),
// never a panel (a 9-judge panel delivered ~2.2 effective votes). Compare the two
// passes item-by-item: ANY per-item disagreement routes general_shallow with tag
// rubric_disagreement and records 'x' at each disagreed slot (D2 item 3). Full
// agreement flows the [01] pattern to verdictFromRubric.
async function runRubric(candidate, opts) {
  const options = opts || {};
  const judgeFn = options.judgeFn;
  if (typeof judgeFn !== 'function') {
    throw new TypeError('runRubric: opts.judgeFn must be a function');
  }
  const neutral = parseRubricResponse(await judgeFn(buildNeutralPrompt(candidate)));
  const adversarial = parseRubricResponse(await judgeFn(buildAdversarialPrompt(candidate)));

  let disagreement = false;
  const agreed = {};
  let pattern = '';
  for (let i = 0; i < RUBRIC_KEYS.length; i += 1) {
    const k = RUBRIC_KEYS[i];
    if (neutral[k] === adversarial[k]) {
      agreed[k] = neutral[k];
      pattern += neutral[k] ? '1' : '0';
    } else {
      disagreement = true;
      agreed[k] = null;
      pattern += 'x';
    }
  }

  let verdict;
  let reasoning_tag;
  if (disagreement) {
    verdict = 'general_shallow';
    reasoning_tag = 'rubric_disagreement';
  } else {
    verdict = verdictFromRubric(agreed);
    reasoning_tag = reasoningTagFromItems(agreed);
  }
  return { rubric_pattern: pattern, disagreement: disagreement, items: agreed, calls: 2, verdict: verdict, reasoning_tag: reasoning_tag };
}

// ============================================================================
// criticRule -- the calibration ruling (Plan 212-02 Task 2). This is the ONE
// function the Phase-03 MCP tool wraps (D4 thin-wrapper contract). It is a PURE
// function of the D1 payload: no fs writes, no room-directory closure, no content,
// and no current-working-directory reads. It
// takes the abstracted rubric_pattern + D1 scalars and returns a verdict plus a
// CALIBRATION-DERIVED coarse confidence (never a model-self-reported number, D2
// item 4; never a raw float, D3b item 3).
// ============================================================================

const CLOSED_PAYLOAD_KEYS = Object.freeze([
  'differential_score', 'semantic_similarity', 'lsa_similarity',
  'surprise_type', 'source_domain_tag', 'target_domain_tag',
  'rubric_pattern', 'schema_version',
]);

// surprise_type is a closed two-member enum (D1: structural_transfer |
// semantic_implementation). Kept here (not the tags file) because it is a D1
// wire-contract enum, not a reasoning tag.
const SURPRISE_TYPES = Object.freeze(['structural_transfer', 'semantic_implementation']);

// The baseline lives beside the gold cards under evals/eureka -- NEVER a
// cwd-relative or room-relative path (D5). opts.baselinePath overrides it for
// tests only; production always reads this stamped, versioned file.
const BASELINE_PATH = path.join(__dirname, '..', '..', 'evals', 'eureka', '212-critic-baseline.json');

function loadBaseline(baselinePath) {
  const p = baselinePath || BASELINE_PATH;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// patternToItems: turn a pure [01]{6} rubric_pattern back into the item booleans
// so verdictFromRubric can recompute the class from the abstracted pattern alone.
function patternToItems(pattern) {
  const out = {};
  for (let i = 0; i < RUBRIC_KEYS.length; i += 1) {
    out[RUBRIC_KEYS[i]] = pattern.charAt(i) === '1';
  }
  return out;
}

// validateCriticPayload: the closed-key discipline (same posture as
// assembleCriticPayload). Unknown keys throw; any string field outside its closed
// enum throws. This keeps a smuggled content string off the wire by construction.
function validateCriticPayload(payload) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('criticRule: payload must be an object');
  }
  const keys = Object.keys(payload);
  for (let i = 0; i < keys.length; i += 1) {
    if (CLOSED_PAYLOAD_KEYS.indexOf(keys[i]) === -1) {
      throw new TypeError('criticRule: unknown payload key (closed-key discipline): ' + keys[i]);
    }
  }
  const tags = loadCriticTags();
  if (!tags.domain_tags.includes(payload.source_domain_tag)) {
    throw new TypeError('criticRule: source_domain_tag not in closed enum: ' + String(payload.source_domain_tag));
  }
  if (!tags.domain_tags.includes(payload.target_domain_tag)) {
    throw new TypeError('criticRule: target_domain_tag not in closed enum: ' + String(payload.target_domain_tag));
  }
  if (SURPRISE_TYPES.indexOf(payload.surprise_type) === -1) {
    throw new TypeError('criticRule: surprise_type not in closed enum: ' + String(payload.surprise_type));
  }
  if (typeof payload.rubric_pattern !== 'string' || !/^[01x]{6}$/.test(payload.rubric_pattern)) {
    throw new TypeError('criticRule: rubric_pattern must be a [01x]{6} string');
  }
  if (typeof payload.schema_version !== 'number') {
    throw new TypeError('criticRule: schema_version must be a number');
  }
}

// confidenceFromBucket: the calibration bands. Confidence is DERIVED from measured
// gold-set accuracy (correct/n), never the model's self-report (D2 item 4). Bands
// are coarse strings, never a raw float (D3b item 3): >=0.9 high, >=0.7 medium,
// else low; an empty/absent bucket is 'unknown' (route to human review).
function confidenceFromBucket(bucket) {
  if (!bucket || typeof bucket.n !== 'number' || bucket.n <= 0 || typeof bucket.correct !== 'number') {
    return 'unknown';
  }
  const acc = bucket.correct / bucket.n;
  if (acc >= 0.9) return 'high';
  if (acc >= 0.7) return 'medium';
  return 'low';
}

function criticRule(payload, opts) {
  const options = opts || {};
  validateCriticPayload(payload);

  // Versioned-enum guard (Canon Part 9): a payload minted against a different
  // schema cannot be trusted against these buckets -> unknown, human review.
  const tags = loadCriticTags();
  if (payload.schema_version !== tags.schema_version) {
    return { verdict: 'general_shallow', confidence: 'unknown', reasoning_tag: 'calibration_unknown' };
  }

  const baseline = loadBaseline(options.baselinePath);
  const buckets = (baseline && baseline.buckets) || {};
  const pattern = payload.rubric_pattern;

  // All-'x' sentinel: Stage A short-circuited, the rubric never ran. A programmatic
  // gate is CODE-CERTAIN (not judge-estimated), so confidence is 'high' by
  // construction. The authoritative, specific gate verdict/reasoning_tag lives in
  // the local classifyCandidate result (a.route / a.tag); it is not recoverable
  // from the 8-key wire payload, so criticRule returns the conservative reject.
  if (pattern === 'xxxxxx') {
    return { verdict: 'general_shallow', confidence: 'high', reasoning_tag: 'entity_nonspecific' };
  }

  // Disagreement pattern (SOME 'x'): the two passes disagreed -> general_shallow.
  if (pattern.indexOf('x') !== -1) {
    const conf = confidenceFromBucket(buckets[pattern]);
    return {
      verdict: 'general_shallow',
      confidence: conf,
      reasoning_tag: conf === 'unknown' ? 'calibration_unknown' : 'rubric_disagreement',
    };
  }

  // Pure [01] rubric pattern: recompute the verdict by code, band the confidence.
  const items = patternToItems(pattern);
  const verdict = verdictFromRubric(items);
  const bucket = buckets[pattern];
  if (!bucket) {
    // Unseen on the gold set -> confidence unknown -> human review (D2 item 4).
    return { verdict: verdict, confidence: 'unknown', reasoning_tag: 'calibration_unknown' };
  }
  return { verdict: verdict, confidence: confidenceFromBucket(bucket), reasoning_tag: reasoningTagFromItems(items) };
}

// ---------- classifyCandidate ----------
//
// The composed local pipeline: Stage A gates -> Stage B rubric -> verdict-by-code
// -> calibration confidence. A Stage-A-failing candidate returns its gate route/
// tag IMMEDIATELY with the 'xxxxxx' sentinel (the judge is never reached; Stage-A
// gates are code-certain, confidence 'high'). On pass, the two-pass rubric runs,
// the verdict is computed by code, and the confidence is ruled via criticRule --
// but ONLY after a local calibration-validity guard confirms the live embedder
// matches the one the baseline was stamped against (Pitfall 8); a mismatch (or a
// still-deferred baseline) yields confidence 'unknown'.
async function classifyCandidate(candidate, opts) {
  const options = opts || {};
  const a = await stageA(candidate, options);
  if (!a.pass) {
    return {
      verdict: a.route,
      reasoning_tag: a.tag,
      rubric_pattern: 'xxxxxx',
      features: a.features || {},
      stage: 'A',
      confidence: 'high',
    };
  }
  const rub = await runRubric(candidate, options);
  const features = a.features || {};

  let confidence = 'unknown';
  try {
    const baseline = loadBaseline(options.baselinePath);
    // eslint-disable-next-line global-require
    const spine = require('./eureka/embedding-spine.cjs');
    const liveModel = features.embedder ||
      (typeof spine.encoderProvenance === 'function' ? spine.encoderProvenance().model : 'unknown');
    const calibrated = baseline && baseline.status !== 'baseline_deferred';
    const embedderMatches = baseline && baseline.embedding_model && liveModel === baseline.embedding_model;
    if (calibrated && embedderMatches) {
      const payload = assembleCriticPayload({
        differential_score: candidate && candidate.differential_score,
        semantic_similarity: candidate && candidate.semantic_similarity,
        lsa_similarity: candidate && candidate.lsa_similarity,
        surprise_type: (candidate && candidate.surprise_type) || 'structural_transfer',
        source_domain_tag: (candidate && candidate.sourceDomainTag) || 'unknown',
        target_domain_tag: (candidate && candidate.targetDomainTag) || 'unknown',
        rubric_pattern: rub.rubric_pattern,
      });
      confidence = criticRule(payload, options).confidence;
    }
  } catch (err) {
    // Any calibration-path failure degrades to unknown, never throws (the Stage A
    // degrade-not-die posture). Content-grounded verdict still stands.
    confidence = 'unknown';
  }

  return {
    verdict: rub.verdict,
    reasoning_tag: rub.reasoning_tag,
    rubric_pattern: rub.rubric_pattern,
    features: features,
    stage: 'B',
    confidence: confidence,
  };
}

// ---------- Exports ----------

module.exports = {
  loadCriticTags: loadCriticTags,
  VERDICTS: VERDICTS,
  quantize: quantize,
  assembleCriticPayload: assembleCriticPayload,
  stageA: stageA,
  // Stage B (212-02): rubric + verdict-by-code + composed pipeline.
  RUBRIC_ITEMS: RUBRIC_ITEMS,
  runRubric: runRubric,
  verdictFromRubric: verdictFromRubric,
  classifyCandidate: classifyCandidate,
  // Phase 226 (reasoning-mode) ADDITIVE reuse seam -- zero logic change. The
  // encoder-free fallback path MUST reuse these prompt builders byte-identically
  // instead of keeping a third prompt copy (D3 prompt discipline: any drift from
  // buildNeutralPrompt/buildAdversarialPrompt reopens the sycophancy channel the
  // two-pass rubric closes). parseRubricResponse is exported so the fallback's
  // bias-to-reject default (unparseable -> every item false) is the SAME parser,
  // not a fork. _gate1 exposes the shared fabricated-quantity regexes so the
  // encoder-free Gate 1 is the same class the shipped Stage A Gate 1 enforces.
  buildNeutralPrompt: buildNeutralPrompt,
  buildAdversarialPrompt: buildAdversarialPrompt,
  parseRubricResponse: parseRubricResponse,
  _gate1: { FABRICATED_QUANTITY: FABRICATED_QUANTITY, DOLLAR_FIGURE: DOLLAR_FIGURE },
  // The calibration ruling -- the ONE function the Phase-03 MCP tool wraps (D4).
  criticRule: criticRule,
  // Env-tunable resolvers (exported for the Stage A gates + tests).
  _tunables: {
    swapInvarianceFloor: swapInvarianceFloor,
    swapK: swapK,
    nnDeltaFloor: nnDeltaFloor,
    entityMin: entityMin,
  },
};
