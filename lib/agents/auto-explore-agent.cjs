/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 117-01 Wave 1 -- AutoExploreAgent skeleton.
 * Phase 117-02 Wave 1 -- composeAutoExploreFinding + Brain Substrate constants.
 * Phase 117-03 Wave 2 -- F.1 surface: surfaceFinding + handleUserResponse +
 *   populateHSIAnalysis + composeBQAnchoredLarryVoice + buildExploreApprovedEdge
 *   + BQ_TEMPLATE_REGISTRY constant.
 *
 * Mirrors lib/agents/tension-hook-agent.cjs structure verbatim per RESEARCH
 * Section 3 (sibling code-clone). Wave 1 ships:
 *   - detectFirstMaterial (117-01)
 *   - composeAutoExploreFinding (117-02)
 *   - CANONICAL_CHAIN_ORDER + CROSS_DOMAIN_THRESHOLD (117-02)
 *   - crossDomainSurprise + crossDomainGate helpers (117-02)
 *
 * Wave 2 (117-03 -- this plan) ships:
 *   - populateHSIAnalysis (Brain Section 8.4 HSIAnalysis schema population)
 *   - composeBQAnchoredLarryVoice (Brain Section 8.5 BQ-anchored render; not raw)
 *   - surfaceFinding (F.1 Decision Gate dispatch via lib/hmi/selector-dispatcher.cjs)
 *   - handleUserResponse (post-F.1 routing; INFORMS edge on EXPLORE)
 *   - buildExploreApprovedEdge (cascade edge spec for lazygraph-ops.upsertEdge)
 *   - BQ_TEMPLATE_REGISTRY (4-key registry; Brain Section 8.5 BQ patterns)
 *
 * Later waves ship:
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

const fs = require('node:fs');
const path = require('node:path');
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

/**
 * BQ_TEMPLATE_REGISTRY -- Brain Section 8.5 BQ-anchored Larry voice templates.
 *
 * Per Brain Cypher Q6 (BeautifulQuestion-[GUIDED_BY|GENERATES_MATRIX]-)
 * domain analysis links to a portfolio of canonical questions. Phase 117
 * v1 ships a LOCAL registry of 4 templates keyed by source_pipeline tag;
 * future variant may replace via runtime Brain query (deferred to Phase 110
 * Brain Context Packet Contract).
 *
 * Per Brain Section 8.5: F.1 line is BQ-anchored, NOT raw technical match.
 * AUTOEXPLORE-117-16 invariant.
 *
 * W7 fix iteration 1: bq_id keys are LOCAL shorthand. brain_canonical_name field
 * carries the verbatim Brain BQ name from RESEARCH Section 8.5 Cypher result;
 * this is the moat-aligned key per docs/MOAT-MANDATE.md -- preserve verbatim
 * across phases so cross-room comparability holds. 'bq_id' is the local registry
 * lookup key; 'brain_canonical_name' is the Brain handle.
 */
const BQ_TEMPLATE_REGISTRY = Object.freeze({
  'cross-domain': {
    template: "What if the deepest pattern here isn't '{category_error}' but '{semantic_surprise}'?",
    bq_id: 'bq-emerging-patterns',
    bq_text: 'What new relationships or surprising patterns are emerging from our diverse evidence and where might they lead?',
    brain_canonical_name: 'Question-Domain-Expert Breakthrough Map', // GENERATES_MATRIX BQ from Brain Cypher Section 8.5
  },
  'reverse-salients': {
    template: "What lagging element in '{source_section}' is holding back '{target_section}'?",
    bq_id: 'bq-reverse-salient',
    bq_text: 'Which lagging components in this system most constrain its forward motion?',
    brain_canonical_name: 'Domain Reassessment & Transition', // GUIDED_BY BQ from Brain Cypher Section 8.5
  },
  'domain': {
    template: "What essential elements of '{source_section}' are we missing?",
    bq_id: 'bq-domain-decomposition',
    bq_text: 'What essential elements or patterns can we surface by breaking this context into its smallest actionable parts?',
    brain_canonical_name: 'Domain Sensing & Placement', // GUIDED_BY BQ from Brain Cypher Section 8.5
  },
  'trends': {
    template: "What trend signals are reshaping '{source_section}' faster than we are adapting?",
    bq_id: 'bq-domain-reassessment',
    bq_text: 'How should we recalibrate our understanding now that new patterns or evidence have shifted domain boundaries?',
    brain_canonical_name: 'Domain Reassessment & Transition', // GUIDED_BY BQ from Brain Cypher Section 8.5
  },
});

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
 * HSIAnalysis shape; population in 117-03 (populateHSIAnalysis fills the
 * null/empty placeholders below).
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

// ---------- populateHSIAnalysis (Brain Section 8.4 schema population) ----------

/**
 * populateHSIAnalysis(finding) -- populate Brain Section 8.4 HSIAnalysis schema
 * fields from finding provenance. Wave 2 ships shape contract with nulls; this
 * function fills them at render time so F.1 dispatch can apply the RECOMMENDED
 * gate at top_differential_score >= 0.7 (Phase 88.2 invariant + AUTOEXPLORE-117-15).
 *
 * Per Brain Section 8.4 canonical HSIAnalysis property set:
 *   top_differential: string like "x * y: 0.985" (the top match)
 *   semantic_surprise: one-line reframe
 *   category_errors_identified: what the material was misframed as
 *   top_differential_score: 0-1 numeric; F.1 RECOMMENDED gate at >= 0.7
 *
 * Deterministic, idempotent (re-runs collapse to same shape). Never throws.
 *
 * @param {object} finding   composeAutoExploreFinding output
 * @returns {object}         finding extended with 4 HSIAnalysis fields populated
 */
function populateHSIAnalysis(finding) {
  if (!finding || typeof finding !== 'object') return finding;
  const score = Number(finding.score) || 0;
  const sourceSec = String(finding.source_section || '');
  const targetSec = String(finding.target_section || '');
  // top_differential: render as "<source_section> * <target_section>: <score>"
  // (no body_text per Canon Part 8).
  const top_differential = (sourceSec && targetSec)
    ? sourceSec + ' * ' + targetSec + ': ' + score.toFixed(3)
    : (sourceSec ? sourceSec + ': ' + score.toFixed(3) : '<unspecified>: ' + score.toFixed(3));
  // semantic_surprise: derived from source_pipeline tag (one-line reframe).
  const reframeByPipeline = {
    'cross-domain': 'A non-obvious analogy across domains worth exploring',
    'reverse-salients': 'A lagging element constraining forward motion',
    'domain': 'A whitespace gap in the canonical decomposition',
    'trends': 'A trend signal reshaping the domain faster than adaptation',
  };
  const semantic_surprise = reframeByPipeline[finding.source_pipeline] || reframeByPipeline['domain'];
  // category_errors_identified: framework_chain provenance (what we WERE framing it as).
  const category_errors_identified = Array.isArray(finding.framework_chain)
    ? finding.framework_chain.slice(0, 5)
    : [];
  // top_differential_score: normalized score [0,1]; clamp.
  const top_differential_score = Math.max(0, Math.min(1, score));
  return Object.assign({}, finding, {
    top_differential: top_differential,
    semantic_surprise: semantic_surprise,
    category_errors_identified: category_errors_identified,
    top_differential_score: top_differential_score,
  });
}

// ---------- composeBQAnchoredLarryVoice (Brain Section 8.5 BQ render) ----------

/**
 * composeBQAnchoredLarryVoice(finding, opts) -- Brain Section 8.5 BQ-anchored
 * render. Uses BQ_TEMPLATE_REGISTRY keyed by source_pipeline tag.
 *
 * Per RESEARCH Section 8.5: F.1 line MUST be BQ-anchored, never raw technical
 * match. AUTOEXPLORE-117-16 invariant.
 *   Generic (avoid): "Top match: weather_algorithm * synthetic_inertia (0.985)"
 *   BQ-anchored:    "What if the deepest pattern here isn't 'wind power' but
 *                   'embodied algorithms providing computational stability'?"
 *
 * Future variant (deferred to Phase 110 Brain Context Packet Contract) may
 * substitute a runtime Brain query for the local registry; the v1 ships the
 * 4-key local constant.
 *
 * @param {object} finding   populateHSIAnalysis output (or composeAutoExploreFinding output)
 * @param {object} [opts]    optional persona arg (v1 ignores per AUTOEXPLORE-117-16 test 7)
 * @returns {string}
 */
function composeBQAnchoredLarryVoice(finding, opts) {
  if (!finding || typeof finding !== 'object') return '';
  // opts reserved for future persona-blend variant (v1: ignored).
  void opts;
  const tag = String(finding.source_pipeline || 'domain');
  const tmpl = BQ_TEMPLATE_REGISTRY[tag] || BQ_TEMPLATE_REGISTRY['domain'];
  const categoryError = (Array.isArray(finding.category_errors_identified)
                         && finding.category_errors_identified.length > 0)
    ? String(finding.category_errors_identified[0])
    : 'the surface framing';
  const semanticSurprise = String(finding.semantic_surprise || 'the deeper pattern');
  const sourceSection = String(finding.source_section || 'this material');
  const targetSection = String(finding.target_section || 'the rest of the room');
  let line = tmpl.template;
  line = line.split('{category_error}').join(categoryError);
  line = line.split('{semantic_surprise}').join(semanticSurprise);
  line = line.split('{source_section}').join(sourceSection);
  line = line.split('{target_section}').join(targetSection);
  return line;
}

// ---------- buildExploreApprovedEdge (cascade edge spec) ----------

/**
 * buildExploreApprovedEdge -- INFORMS cascade edge spec on F.1 EXPLORE.
 *
 * Mirrors lib/agents/tension-hook-agent.cjs::buildResolvedViaEdge with type-swap
 * RESOLVES_VIA -> INFORMS.
 *
 * properties.source = 'auto-explore' (distinct from rs-engine attribution).
 *
 * Returns null on missing source/target (defensive; caller passes through to
 * lazygraph-ops.upsertEdge which has its own validation).
 *
 * @param {object} args
 * @param {object} args.finding             populateHSIAnalysis output
 * @param {string} [args.materialNodeId]    the uploaded artifact node id
 * @param {string} [args.parent_decision_id]  sha256-32 hex
 * @returns {object|null}
 */
function buildExploreApprovedEdge(args) {
  const finding = (args && args.finding) || {};
  const materialNodeId = String((args && args.materialNodeId) || '');
  const target = String(finding.target_node_id || '');
  const source = materialNodeId || String(finding.source_node_id || '');
  if (!source || !target) return null;
  return {
    type: 'INFORMS',
    source: source,
    target: target,
    properties: {
      source: 'auto-explore',
      material_id: String(finding.material_id || ''),
      finding_id: String(finding.id || ''),
      parent_decision_id: String((args && args.parent_decision_id) || finding.id || ''),
      canonical_chain_pipeline: String(finding.source_pipeline || ''),
      created_at: Date.now(),
    },
  };
}

// ---------- surfaceFinding (F.1 Decision Gate dispatch) ----------

/**
 * surfaceFinding({finding, roomDir, operator, tier}) -- F.1 Decision Gate dispatch.
 *
 * Mirrors lib/agents/tension-hook-agent.cjs::surfaceFinding shape verbatim
 * with verb-swap [Resolve/Later/Skip] -> [Explore/Skip/Later] and edge-type
 * swap RESOLVES_VIA -> INFORMS.
 *
 * Suppression paths per Phase 88.2 + RESEARCH Section 5 scenarios 1, 9:
 *   tier===0                -> {surfaced:false, suppress_reason:'tier_0'}
 *   operator==='JUST_TALK'  -> {surfaced:false, suppress_reason:'just_talk'}
 *   dispatcher load fail    -> {surfaced:false, suppress_reason:'dispatcher_load_failed'}
 *   pickShape throws        -> {surfaced:false, suppress_reason:'dispatch_threw:<err>'}
 *   pickShape unavailable   -> {surfaced:false, suppress_reason:'pickShape_unavailable'}
 *
 * Side-effect: atomic re-persist enriched finding to room/.mindrian/auto-explore-<material_id>.json
 * so post-hoc audit reading the on-disk JSON sees populated HSI fields, not nulls
 * (W6 fix iteration 1).
 *
 * @param {object} args
 * @param {object} args.finding   composeAutoExploreFinding output
 * @param {string} args.roomDir   absolute path to room (with .room-root)
 * @param {string} [args.operator] 'AUTONOMOUS' | 'JUST_TALK' | undefined
 * @param {number} [args.tier]    0 | 1 | 2
 * @returns {object}              {surfaced: bool, contract?, suppress_reason?, finding?, bq_line?, parent_decision_id?}
 */
function surfaceFinding(args) {
  const finding = (args && args.finding) || null;
  const roomDir = String((args && args.roomDir) || '');
  const operator = String((args && args.operator) || 'AUTONOMOUS');
  const tier = Number((args && args.tier) || 0);

  if (!finding || !finding.id) {
    return { surfaced: false, suppress_reason: 'invalid_finding' };
  }
  if (tier === 0) {
    return { surfaced: false, suppress_reason: 'tier_0', finding: finding };
  }
  if (operator === 'JUST_TALK') {
    return { surfaced: false, suppress_reason: 'just_talk', finding: finding };
  }

  // Populate HSIAnalysis schema fields (Brain Section 8.4) before dispatch.
  const populated = populateHSIAnalysis(finding);

  // W6 fix iteration 1: atomic re-persist enriched finding to
  // room/.mindrian/auto-explore-<material_id>.json so post-hoc audit reading
  // the on-disk JSON sees populated HSI fields, not nulls. populateHSIAnalysis
  // is deterministic -- re-runs are idempotent -- but persisting closes the
  // audit-trail gap. Use the same atomic-write pattern from
  // explored-materials-store.cjs (write-temp + rename).
  if (roomDir && populated.material_id) {
    try {
      const mindrianDir = path.join(roomDir, '.mindrian');
      try { fs.mkdirSync(mindrianDir, { recursive: true }); } catch (_e) { /* graceful */ }
      const findingPath = path.join(mindrianDir, 'auto-explore-' + populated.material_id + '.json');
      const tmpPath = findingPath + '.tmp.' + process.pid;
      fs.writeFileSync(tmpPath, JSON.stringify(populated, null, 2), 'utf8');
      fs.renameSync(tmpPath, findingPath);
    } catch (_e) { /* best-effort persistence; surface still proceeds */ }
  }

  // F.1 RECOMMENDED gate per Phase 88.2 invariant: only at >= 0.7.
  const recommendedVerb = (Number(populated.top_differential_score) >= 0.7) ? 'Explore' : null;

  // Compose BQ-anchored Larry-voice line (Brain Section 8.5).
  const bqLine = composeBQAnchoredLarryVoice(populated);

  // Compose parent_decision_id (deterministic over finding.id; Phase 88.2-05 pattern).
  const parent_decision_id = String(finding.id);

  let dispatcher;
  try {
    dispatcher = require('../hmi/selector-dispatcher.cjs');
  } catch (_e) {
    return { surfaced: false, suppress_reason: 'dispatcher_load_failed', finding: populated };
  }
  if (!dispatcher || typeof dispatcher.pickShape !== 'function') {
    return { surfaced: false, suppress_reason: 'pickShape_unavailable', finding: populated };
  }

  let result;
  try {
    result = dispatcher.pickShape({
      requestedShape: 'F.1',
      roomDir: roomDir,
      operator: operator,
      tier: tier,
      payload: {
        verbs: ['Explore', 'Skip', 'Later'],
        header: bqLine,
        recommendedVerb: recommendedVerb,
        emitTelemetry: true,
        parent_decision_id: parent_decision_id,
      },
    });
  } catch (err) {
    const detail = String((err && err.message) || err).slice(0, 60);
    return {
      surfaced: false,
      suppress_reason: 'dispatch_threw:' + detail,
      finding: populated,
    };
  }

  if (!result || result.shape === 'error') {
    const errCode = (result && result.rendered && result.rendered.error)
      ? String(result.rendered.error)
      : 'pickShape_unavailable';
    return {
      surfaced: false,
      suppress_reason: errCode,
      finding: populated,
    };
  }

  return {
    surfaced: true,
    contract: (result.rendered && result.rendered.contract) ? result.rendered.contract : (result.rendered || null),
    rendered: result.rendered || null,
    finding: populated,
    bq_line: bqLine,
    parent_decision_id: parent_decision_id,
  };
}

// ---------- handleUserResponse (post-F.1 routing) ----------

/**
 * handleUserResponse -- F.1 user-pick router.
 *
 *   EXPLORE   -> appendMaterial response='EXPLORE' + emit INFORMS cascade edge
 *   SKIP      -> appendMaterial response='SKIP' (rejection captured per Canon Part 4 D-13)
 *   LATER     -> appendMaterial response='LATER' (re-queue; surfacing_count NOT decremented)
 *   FREE_TEXT -> appendMaterial response='FREE_TEXT'; Larry interprets via Canon Part 3 Verb 10
 *
 * Wrapped in try/catch -- never throws. Returns scalar-only result envelope
 * (no user-content fields) so the caller can mirror to telemetry safely.
 *
 * @param {object} args
 * @param {object} args.finding             populated finding object
 * @param {string} args.userResponse        'EXPLORE'|'SKIP'|'LATER'|'FREE_TEXT' (case-insensitive)
 * @param {string} args.roomDir             absolute path to room
 * @param {object} [args.db]                node:sqlite DatabaseSync handle (for EXPLORE path)
 * @param {string} [args.materialNodeId]    explicit material node id (defaults to finding.source_node_id)
 * @param {string} [args.parent_decision_id]
 * @returns {object}
 */
function handleUserResponse(args) {
  try {
    const finding = (args && args.finding) || {};
    const userResponse = String((args && args.userResponse) || '').toUpperCase();
    const roomDir = String((args && args.roomDir) || '');
    const db = (args && args.db) || null;
    const roomSlug = roomDir ? path.basename(roomDir) : 'default-room';

    const valid = new Set(['EXPLORE', 'SKIP', 'LATER', 'FREE_TEXT']);
    if (!valid.has(userResponse)) return { ok: false, reason: 'invalid_response' };

    // Append responded entry to ledger (LWW).
    const respondedEntry = {
      material_id: String(finding.material_id || ''),
      file_path_sha256: String(finding.file_path_sha256 || ''),
      relative_file_path: '',
      mtime_seconds: 0,
      fired_at: Date.now(),
      state: 'completed',
      finding_count: 1,
      surfaced: true,
      user_response: userResponse,
      responded_at: Date.now(),
      suppress_reason: null,
      in_flight_since: null,
    };
    let appendResult = null;
    try {
      appendResult = store.appendMaterial(roomSlug, respondedEntry);
    } catch (_e) { /* graceful */ }

    let edgeResult = null;
    if (userResponse === 'EXPLORE' && db) {
      // Emit INFORMS cascade edge per Canon Part 4.
      const edgeSpec = buildExploreApprovedEdge({
        finding: finding,
        materialNodeId: (args && args.materialNodeId) || finding.source_node_id,
        parent_decision_id: (args && args.parent_decision_id) || finding.id,
      });
      if (edgeSpec) {
        try {
          const lazygraph = require('../core/lazygraph-ops.cjs');
          if (typeof lazygraph.upsertEdge === 'function') {
            edgeResult = lazygraph.upsertEdge(db, edgeSpec);
          }
        } catch (_e) { /* graceful: edge emission best-effort */ }
      }
    }

    return {
      ok: true,
      response: userResponse,
      jsonl: appendResult,
      edge: edgeResult,
    };
  } catch (e) {
    return {
      ok: false,
      reason: 'handle_response_threw',
      detail: String((e && e.message) || '').slice(0, 80),
    };
  }
}

// ---------- Module exports ----------

module.exports = {
  detectFirstMaterial,
  composeAutoExploreFinding,
  surfaceFinding,
  handleUserResponse,
  populateHSIAnalysis,
  composeBQAnchoredLarryVoice,
  buildExploreApprovedEdge,
  crossDomainSurprise,
  crossDomainGate,
  BQ_TEMPLATE_REGISTRY,
  CANONICAL_CHAIN_ORDER,
  CROSS_DOMAIN_THRESHOLD,
  MATERIAL_ID_LEN,
};
