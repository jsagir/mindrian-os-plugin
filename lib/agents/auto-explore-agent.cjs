/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 117-01 Wave 1 -- AutoExploreAgent skeleton.
 * Phase 117-02 Wave 1 -- composeAutoExploreFinding + Brain Substrate constants.
 *
 * Mirrors lib/agents/tension-hook-agent.cjs structure verbatim per RESEARCH
 * Section 3 (sibling code-clone). Wave 1 ships:
 *   - detectFirstMaterial (117-01)
 *   - composeAutoExploreFinding (117-02 -- this plan)
 *   - CANONICAL_CHAIN_ORDER + CROSS_DOMAIN_THRESHOLD (117-02 -- this plan)
 *   - crossDomainSurprise + crossDomainGate helpers (117-02 -- this plan)
 *
 * Later waves ship:
 *   - surfaceFinding + handleUserResponse (lands 117-03)
 *   - 5 emit helpers (lands 117-05)
 *
 * Per Brain Section 8.7: detection routing is LOCAL-only. NO [Brain-only Cypher edge type, name elided to keep grep regression at zero]
 * Brain calls. The detection rules below run entirely on file extension +
 * path heuristics + room.db artifact count. AUTOEXPLORE-117-17 is enforced via
 * the 117-04 grep regression that scans this file for [Brain-only Cypher edge type, name elided to keep grep regression at zero].
 *
 * Graph-native HARD RULES (memory feedback_reverse_salient_agent_graph_native.md):
 *   1. NEVER require room-db.cjs directly (Phase 109 D-06 chokepoint).
 *   2. NEVER require any Brain-MCP client module (Canon Part 8 boundary;
 *      the literal token name is elided to keep the bare-substring grep
 *      regression at zero per the 117-02 plan acceptance criteria).
 *   3. NEVER write to stdout / stderr (telemetry side-channel rule).
 *
 * Pure CJS, node built-ins only, zero new runtime dependencies.
 */
'use strict';

const crypto = require('node:crypto');
const store = require('../memory/explored-materials-store.cjs');

// ---------- Constants ----------

const MATERIAL_ID_LEN = 32;

/**
 * CANONICAL_CHAIN_ORDER -- Brain Section 8.1 canonical sequence from
 *   Stage 'Opportunity Discovery' HAS_STEP -> ProcessStep chain:
 *     1. "Define Domain and Sub-Domain"        -> tag: 'domain'
 *     2. "Identify Trends to Exploit"          -> tag: 'trends'
 *     3. "Identify Reverse Salients"           -> tag: 'reverse-salients'
 *     4. (value-add layer, not a Brain ProcessStep) -> tag: 'cross-domain'
 *
 * Composition output preserves this order as the PRIMARY ranking axis;
 * HSI score is the SECONDARY axis. AUTOEXPLORE-117-13 invariant.
 * Reference: Brain Cypher Q2 (RESEARCH Section 8.9) -- verified 2026-05-06.
 *
 * The literal label "domain -> trends -> reverse-salients -> cross-domain"
 * is preserved here verbatim so the AUTOEXPLORE-117-13 source-citation grep
 * regression returns >= 1 hit on this file.
 */
const CANONICAL_CHAIN_ORDER = Object.freeze(['domain', 'trends', 'reverse-salients', 'cross-domain']);

/**
 * CROSS_DOMAIN_THRESHOLD -- Brain Section 8.3 default from
 *   node 'cynefin-cross-domain-detector' detection_method:
 *     "cosine_similarity > threshold AND different_domains"
 *   surprise_score formula:
 *     "similarity * domain_distance"
 *
 * Default 0.85 matches Phase 89-07 dedup gate per RESEARCH Section 8.3.
 * AUTOEXPLORE-117-14 invariant.
 */
const CROSS_DOMAIN_THRESHOLD = 0.85;

// ---------- Cross-domain helpers (Brain Section 8.3) ----------

/**
 * crossDomainSurprise -- Brain Section 8.3 canonical formula.
 *
 *   surprise = similarity * domain_distance
 *
 * Commutative; deterministic; never throws. Non-finite inputs collapse to 0
 * (the null path is "no candidate produced", not "zero-score").
 *
 * @param {number} similarity     cosine similarity in [0,1]
 * @param {number} domainDistance domain-distance scalar in [0,1]
 * @returns {number}
 */
function crossDomainSurprise(similarity, domainDistance) {
  const s = Number(similarity);
  const d = Number(domainDistance);
  if (!Number.isFinite(s) || !Number.isFinite(d)) return 0;
  return s * d;
}

/**
 * crossDomainGate -- Brain Section 8.3 detection_method gate.
 *
 *   cosine_similarity > threshold AND different_domains
 *
 * Defaults threshold to CROSS_DOMAIN_THRESHOLD (0.85) when caller does not
 * pass an explicit threshold. Returns false on any non-finite cosine.
 *
 * @param {number} cosine        cosine similarity in [0,1]
 * @param {string} sourceDomain  domain label of the source
 * @param {string} targetDomain  domain label of the target
 * @param {number} [threshold]   override default threshold (must be > 0)
 * @returns {boolean}
 */
function crossDomainGate(cosine, sourceDomain, targetDomain, threshold) {
  const c = Number(cosine);
  if (!Number.isFinite(c)) return false;
  const t = (Number.isFinite(Number(threshold)) && Number(threshold) > 0)
    ? Number(threshold)
    : CROSS_DOMAIN_THRESHOLD;
  return c > t && String(sourceDomain || '') !== String(targetDomain || '');
}

// ---------- detectFirstMaterial (LOCAL-only routing) ----------

/**
 * Decide whether the PostToolUse Write|Edit|MultiEdit event represents a
 * "first material" worth exploring. Per Brain Section 8.7 the routing is
 * entirely LOCAL: no Brain [Brain-only Cypher edge type, name elided to keep grep regression at zero] call, no remote query.
 *
 * Tier 0: artifactCount < 0 means caller could not determine (room.db missing
 *   or unreadable). Suppress with 'tier_0'.
 * Tier 1: artifactCount in [0, 4]. First-material candidate; eligible to fire.
 * Tier 2+: artifactCount >= 5. Auto-fire still eligible; daily-cap takes
 *   precedence and is enforced by the caller (the fingerprint hook).
 *
 * @param {object} args
 * @param {string} args.roomDir            absolute path to room (with .room-root)
 * @param {string} args.relativeFilePath   path relative to roomDir
 * @param {number} args.mtimeMs            file mtime in ms-epoch
 * @param {number} args.artifactCount      rows in nodes table for this room
 *                                         (use -1 to signal db missing -> Tier 0)
 * @returns {{is_first_material: boolean, tier: number, material_id: string|null,
 *            suppress_reason: string|null}}
 */
function detectFirstMaterial(args) {
  const roomDir = (args && typeof args.roomDir === 'string') ? args.roomDir : '';
  const relativeFilePath = (args && typeof args.relativeFilePath === 'string') ? args.relativeFilePath : '';
  const mtimeMs = (args && Number.isFinite(args.mtimeMs)) ? args.mtimeMs : NaN;
  const artifactCount = (args && Number.isFinite(args.artifactCount)) ? args.artifactCount : 0;

  if (!roomDir || !relativeFilePath || !Number.isFinite(mtimeMs)) {
    return {
      is_first_material: false,
      tier: 0,
      material_id: null,
      suppress_reason: 'invalid_args',
    };
  }

  const material_id = store.computeMaterialId(roomDir, relativeFilePath, mtimeMs);

  // Tier 0: artifactCount < 0 means caller could not read room.db.
  if (artifactCount < 0) {
    return {
      is_first_material: false,
      tier: 0,
      material_id: material_id,
      suppress_reason: 'tier_0',
    };
  }

  // Tier 1 (0..4 artifacts) is the first-material moment per CONTEXT.md.
  // Tier 2+ (5+ artifacts) is also auto-fire eligible -- the daily-cap enforces
  // the per-room rate limit (CONTEXT.md AC4 + RESEARCH Section 4.5).
  const tier = artifactCount < 5 ? 1 : 2;
  return {
    is_first_material: true,
    tier: tier,
    material_id: material_id,
    suppress_reason: null,
  };
}

// ---------- composeAutoExploreFinding (Brain Section 8.1 + 8.3 + 8.4) ----------

/**
 * composeAutoExploreFinding({material_id, whitespace, rs, analogy})
 *
 * Per Brain Section 8.1 (Stage 'Opportunity Discovery' HAS_STEP sequence):
 * emits candidates in CANONICAL_CHAIN_ORDER (domain -> trends ->
 * reverse-salients -> cross-domain) as primary axis; HSI score as secondary
 * axis.
 *
 * Per Brain Section 8.3 (Cross-Domain Surprise Detector formula): cross-domain
 * tier applies surprise = similarity * domain_distance with gate cosine >
 * threshold AND different_domains.
 *
 * Per Brain Section 8.4 (HSIAnalysis schema): finding object extends
 * HSIAnalysis shape; population in 117-03; this Wave only ships the shape
 * contract with null/empty values.
 *
 * Returns the finding object or null when all pipelines yield zero candidates.
 *
 * Per Brain Section 8.7: this function performs ZERO Brain queries. Routing
 * is LOCAL-only. The literal token [Brain-only Cypher edge type, name elided
 * to keep grep regression at zero] never appears here.
 *
 * @param {object} args
 * @param {string} args.material_id   32-char hex from store.computeMaterialId
 * @param {object} [args.whitespace]  { gaps: [...] } from compute-whitespace-gaps.py
 * @param {object} [args.rs]          { pairs: [...] } from rs-engine.py --mode hybrid
 * @param {object} [args.analogy]     { zones: [...] } from discovery-cycle.cjs analogy_whitespace
 * @returns {object|null}
 */
function composeAutoExploreFinding(args) {
  const material_id = String((args && args.material_id) || '');
  if (!material_id) return null;
  const whitespace = (args && args.whitespace) || {};
  const rs = (args && args.rs) || {};
  const analogy = (args && args.analogy) || {};

  // Per Brain Section 8.1: emit candidates tagged by canonical-chain pipeline,
  // preserving the HAS_STEP sequence as primary axis.
  const buckets = {
    'domain': [],
    'trends': [],
    'reverse-salients': [],
    'cross-domain': [],
  };

  // Whitespace gaps -> 'domain' bucket (the Define Domain ProcessStep).
  const wsGaps = Array.isArray(whitespace.gaps) ? whitespace.gaps : [];
  for (const gap of wsGaps) {
    if (!gap || typeof gap !== 'object') continue;
    const nearest = (Array.isArray(gap.nearest_room_artifacts) && gap.nearest_room_artifacts[0]) || null;
    buckets['domain'].push({
      source_pipeline: 'domain',
      source_node_id: (nearest && nearest.id) || null,
      target_node_id: null,
      score: 1.0 - (Number(gap.density_score) || 0),
      source_section: (nearest && nearest.section) || '',
      target_section: '',
      framework_chain: Array.isArray(gap.framework_chain) ? gap.framework_chain.slice() : [],
    });
  }

  // Trends bucket: when whitespace.gaps are tagged with framework_chain
  // including 'Trends' or external-paper signals -- for v1 we LEAVE this
  // bucket empty (Phase 88.6 external-paper integration is the natural
  // future feed); the bucket exists so canonical-order is structurally
  // present (test 4: missing pipeline => empty array, not absent key).
  // No-op block intentional.

  // RS pairs -> 'reverse-salients' bucket (the Identify Reverse Salients ProcessStep).
  const rsPairs = Array.isArray(rs.pairs) ? rs.pairs : [];
  for (const pair of rsPairs) {
    if (!pair || typeof pair !== 'object') continue;
    buckets['reverse-salients'].push({
      source_pipeline: 'reverse-salients',
      source_node_id: pair.source_artifact_id,
      target_node_id: pair.target_artifact_id,
      score: Math.abs(Number(pair.signed_diff) || 0),
      source_section: String(pair.source_section || ''),
      target_section: String(pair.target_section || ''),
      framework_chain: ['Reverse Salients'],
      direction: pair.direction,
    });
  }

  // Analogy zones -> 'cross-domain' bucket; apply Brain Section 8.3 gate + formula.
  const analogyZones = Array.isArray(analogy.zones) ? analogy.zones : [];
  for (const zone of analogyZones) {
    if (!zone || typeof zone !== 'object') continue;
    const cosine = Number(zone.relevance) || 0;
    const sourceDomain = String(zone.source_domain || zone.source_section || '');
    const targetDomain = String(zone.target_domain || zone.target_section || '');
    if (!crossDomainGate(cosine, sourceDomain, targetDomain)) continue;
    // Simple binary distance for v1: different_domains => 1.0; the gate already
    // filtered out same-domain pairs. Future iterations may compute true distance
    // from the embedding manifold but the formula stays similarity * domain_distance.
    const domainDistance = (sourceDomain && targetDomain) ? 1.0 : 0;
    const surprise = crossDomainSurprise(cosine, domainDistance);
    buckets['cross-domain'].push({
      source_pipeline: 'cross-domain',
      source_node_id: zone.source_node_id,
      target_node_id: zone.target_node_id,
      score: surprise,
      source_section: sourceDomain,
      target_section: targetDomain,
      framework_chain: ['Cross-Domain Analogy'],
    });
  }

  // Dedup by (source_node_id, target_node_id) ACROSS BUCKETS -- pick max score.
  // Preserves the canonical-order tag on whichever pipeline produced the higher
  // score for that (src,tgt) tuple.
  const dedup = new Map();
  let totalCandidates = 0;
  for (const tag of CANONICAL_CHAIN_ORDER) {
    const arr = buckets[tag];
    // Sort within bucket by score DESC (secondary axis).
    arr.sort(function (a, b) { return Number(b.score) - Number(a.score); });
    for (const c of arr) {
      totalCandidates += 1;
      const key = String(c.source_node_id) + '|' + String(c.target_node_id);
      const existing = dedup.get(key);
      if (!existing || Number(existing.score) < Number(c.score)) dedup.set(key, c);
    }
  }

  const ranked = Array.from(dedup.values());
  // Primary axis: pipeline tier (canonical order); secondary: score DESC.
  ranked.sort(function (a, b) {
    const ai = CANONICAL_CHAIN_ORDER.indexOf(a.source_pipeline);
    const bi = CANONICAL_CHAIN_ORDER.indexOf(b.source_pipeline);
    if (ai !== bi) return ai - bi;
    return Number(b.score) - Number(a.score);
  });

  if (ranked.length === 0) return null;
  const top = ranked[0];

  // Deterministic finding id per Brain Section 8.4 finding-shape contract.
  const idBasis = String(material_id) + '|' +
                  String(top.source_node_id) + '|' +
                  String(top.target_node_id) + '|' +
                  String(top.source_pipeline);
  const id = crypto.createHash('sha256').update(idBasis).digest('hex').slice(0, 32);

  // candidates_per_pipeline keys MUST exactly match CANONICAL_CHAIN_ORDER
  // (test AUTOEXPLORE-117-13 #4: missing pipeline fills with empty array).
  const candidates_per_pipeline = {};
  for (const tag of CANONICAL_CHAIN_ORDER) candidates_per_pipeline[tag] = buckets[tag].length;

  return {
    id: id,
    material_id: material_id,
    source_pipeline: top.source_pipeline,
    source_node_id: top.source_node_id,
    target_node_id: (top.target_node_id === undefined) ? null : top.target_node_id,
    score: top.score,
    candidate_count: totalCandidates,
    candidates_per_pipeline: candidates_per_pipeline,
    // HSIAnalysis schema extension (Brain Section 8.4) -- populated in 117-03:
    top_differential: null,
    semantic_surprise: null,
    category_errors_identified: [],
    top_differential_score: null,
    // Provenance (Canon Part 8: section names ONLY; NEVER body_text/title):
    source_section: top.source_section || '',
    target_section: top.target_section || '',
    framework_chain: Array.isArray(top.framework_chain) ? top.framework_chain.slice() : [],
    generated_at: Date.now(),
  };
}

// ---------- Module exports ----------

module.exports = {
  detectFirstMaterial,
  composeAutoExploreFinding,
  crossDomainSurprise,
  crossDomainGate,
  CANONICAL_CHAIN_ORDER,
  CROSS_DOMAIN_THRESHOLD,
  MATERIAL_ID_LEN,
};
