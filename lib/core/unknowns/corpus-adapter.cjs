'use strict';
/*
 * Phase 165-03 -- corpus-adapter: THE recast search-space + the proxy oracle for
 * the unknown-unknowns blind-spot engine.
 *
 * Two responsibilities, both LOCAL room.db readers (Part 8 / D-165-10: zero Brain
 * require, zero web, zero egress; every value is a scalar or an enum handle):
 *
 *  (1) findConfidentClaims(db, opts) -- the load-bearing D-165-03 corpus reader.
 *      The hunt space is genuinely-held, well-evidenced beliefs: the UNION over
 *      (EvidenceClaim, claim, CausalClaim) WHERE review_status='confirmed' AND
 *      json_extract(properties,'$.evidence_tier') IN ('Academic','Operational').
 *      This is the "GRADED-CONFIRMED" reading (165-RESEARCH section 3): an
 *      ungraded confirmed claim (writeClaimNode mints knowledge_type + confidence
 *      1.0 but NO evidence_tier, typed-claim.cjs:133) returns NULL for the
 *      json_extract and falls OUT of the IN(...) filter by construction (Pitfall
 *      1). None/Practitioner-tier confirmed rows and proposed Academic rows are
 *      excluded by the tier and status filters respectively. This is NOT a naive
 *      writeClaimNode query -- that would return an empty corpus and the bandit
 *      would hunt nothing.
 *
 *      Rows are recast into the shared INSTANCE_FEATURES schema (iface.cjs):
 *      { claimId, section, domain, evidenceTier, confidence, governingHash,
 *        ageDays } plus the documented corpus fields { id, type, knowledgeType,
 *        lastModifiedAt }. section/domain derive from the node properties + the
 *        source_path + any PART_OF/TAGGED_WITH domain edges (Phase 163 frozen),
 *        enum handles only. ageDays derives from last_modified_at via the
 *        opts.now seam (deterministic, D-165-09; no raw Date.now in the math path).
 *
 *      Room-local v1 (D-165-04): the query reads ONLY the active room.db. The
 *      recursive rollupSubRooms (graph-derivation.cjs) is the deferred OPT-IN
 *      cross-room hook, NOT a v1 default; cross-room aggregation of NESTED_WITHIN
 *      is forbidden (canon entry 23).
 *
 *  (2) proxyOracle(db, claimId, cfg, nowFn) -- the D-165-01 cheap proxy label.
 *      Blends THREE LOCAL scalars (165-RESEARCH section 2.1), weighted and
 *      thresholded:
 *        (a) contradictionDensity = incident CONTRADICTS|INVALIDATES edges
 *            / (1 + total incident edges)   -- [0,1)
 *        (b) tierMismatch = max(0, confidence - TIER_FLOOR[evidenceTier])  -- [0,1]
 *        (c) staleness = clamp01((nowRef - last_modified_at)/STALE_WINDOW_MS) -- [0,1]
 *      proxyScore = w_contra*contra + w_mismatch*mismatch + w_stale*staleness;
 *      trueLabel = proxyScore >= proxyThreshold ? 1 : 0; cost = proxyCost (0.0 for
 *      the proxy tier so utility = isUnknownUnknown). Defaults (0.5/0.3/0.2,
 *      threshold 0.5, cost 0.0, staleWindowDays 30) come from
 *      DEFAULT_CONFIG.proxy in iface.cjs.
 *
 *      The proxy LABELS only: it returns { trueLabel, cost }. It does NOT write a
 *      finding and it NEVER writes review_status confirmed (Part 9 role 5; the
 *      orchestrator/finding-writer in a later plan clones graph-derivation
 *      candidateToFinding to land PROPOSED nodes, and only confirmNode -- a human
 *      byUser -- promotes). Deterministic via the injected nowFn seam.
 *
 * All room.db reads use the insights.cjs SELECT idiom (the json_extract props
 * pattern :226-232 + the edge-count idiom :76); zero raw INSERT, zero raw db open
 * outside the caller-supplied handle.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE). CJS, no new deps.
 *
 * Sources: 165-RESEARCH.md section 2 (the proxy), section 3 (the corpus UNION +
 * the recast return shape); lib/core/unknowns/iface.cjs (INSTANCE_FEATURES,
 * TIER_FLOOR, DEFAULT_CONFIG.proxy); lib/core/navigation/insights.cjs (the reader
 * idioms findStaleClaims:146 / findUnsupportedClaims:68 / json_extract :226-232).
 */

const { TIER_FLOOR, DEFAULT_CONFIG } = require('./iface.cjs');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// The corpus node types that can carry a Part-5 evidence_tier (165-RESEARCH 3.1).
const CORPUS_NODE_TYPES = ['EvidenceClaim', 'claim', 'CausalClaim'];

// The corpus tier filter (D-165-03): graded-confirmed = Academic or Operational.
const CORPUS_TIERS = ['Academic', 'Operational'];

// The contradiction-density edge types (165-RESEARCH 2.1a). Both frozen in
// ALLOWED_EDGE_TYPES (CONTRADICTS:153, INVALIDATES:405 brought into the chokepoint
// by Phase 168).
const CONTRA_EDGE_TYPES = ['CONTRADICTS', 'INVALIDATES'];

function clamp01(x) {
  if (typeof x !== 'number' || !Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

// Resolve the deterministic reference-now via the injected seam (the insights.cjs
// findStaleClaims:151 idiom). nowFn may be a function (preferred) or a number; a
// missing/invalid seam falls back to Date.now ONLY outside the deterministic test
// path (production runtime), never silently inside a math assertion.
function resolveNow(nowFn) {
  let ref;
  if (typeof nowFn === 'function') {
    try { ref = nowFn(); } catch (_e) { ref = undefined; }
  } else if (typeof nowFn === 'number') {
    ref = nowFn;
  }
  if (typeof ref !== 'number' || !Number.isFinite(ref)) {
    ref = Date.now();
  }
  return ref;
}

// Derive a section enum handle from properties.section, else from source_path.
// Enum handle only (Part 8); never prose. source_path forms are
// 'meeting:<sid>:<seg>', 'research:<source>:<sid>', or '<section>/<artifact>'.
function deriveSection(propsObj, sourcePath) {
  if (propsObj && typeof propsObj.section === 'string' && propsObj.section.length > 0) {
    return propsObj.section;
  }
  if (typeof sourcePath === 'string' && sourcePath.length > 0) {
    // A path-like source_path: the first slash-delimited segment is the section.
    if (sourcePath.indexOf('/') !== -1) {
      return sourcePath.split('/')[0];
    }
    // A scheme-like source_path ('meeting:...' / 'research:...'): the scheme handle.
    if (sourcePath.indexOf(':') !== -1) {
      return sourcePath.split(':')[0];
    }
    return sourcePath;
  }
  return 'unknown';
}

// Derive a domain enum handle from properties.domain, else from an incident
// PART_OF / TAGGED_WITH domain edge (Phase 163 frozen taxonomy edges), else
// 'unknown'. Enum handle only (Part 8). The edge target is a domain node id handle.
function deriveDomain(db, claimId, propsObj) {
  if (propsObj && typeof propsObj.domain === 'string' && propsObj.domain.length > 0) {
    return propsObj.domain;
  }
  try {
    const row = db.prepare(
      "SELECT e.target AS t FROM edges e "
      + "WHERE e.source = ? AND e.type IN ('PART_OF','TAGGED_WITH') "
      + "ORDER BY e.target ASC LIMIT 1"
    ).get(claimId);
    if (row && typeof row.t === 'string' && row.t.length > 0) {
      return row.t;
    }
  } catch (_e) {
    // graceful: a room without the Phase 163 edges yields no domain edge.
  }
  return 'unknown';
}

// findConfidentClaims(db, opts) -- the D-165-03 graded-confirmed corpus reader.
// Returns the recast instance array (INSTANCE_FEATURES schema + the documented
// corpus fields). Room-local; no rollupSubRooms (deferred OPT-IN hook). Defensive:
// returns [] on a missing/invalid handle.
function findConfidentClaims(db, opts) {
  if (!db || typeof db.prepare !== 'function') return [];
  const options = (opts && typeof opts === 'object') ? opts : {};
  const nowRef = resolveNow(options.now);

  const typePlaceholders = CORPUS_NODE_TYPES.map(() => '?').join(',');
  const tierPlaceholders = CORPUS_TIERS.map(() => '?').join(',');

  // The load-bearing UNION corpus query (165-RESEARCH section 3, clone the
  // insights.cjs json_extract reader idiom). LOCAL room.db only.
  let rows;
  try {
    rows = db.prepare(
      "SELECT n.id, n.type, n.confidence, n.source_path, n.last_modified_at, "
      + "n.properties AS props, "
      + "json_extract(n.properties, '$.evidence_tier') AS evidence_tier, "
      + "json_extract(n.properties, '$.knowledge_type') AS knowledge_type "
      + "FROM nodes n "
      + "WHERE n.type IN (" + typePlaceholders + ") "
      + "AND n.review_status = 'confirmed' "
      + "AND json_extract(n.properties, '$.evidence_tier') IN (" + tierPlaceholders + ") "
      + "ORDER BY n.id ASC"
    ).all(...CORPUS_NODE_TYPES, ...CORPUS_TIERS);
  } catch (_e) {
    return [];
  }

  return rows.map((r) => {
    let propsObj = {};
    try { propsObj = JSON.parse(r.props || '{}'); } catch (_e) { propsObj = {}; }
    const section = deriveSection(propsObj, r.source_path);
    const domain = deriveDomain(db, r.id, propsObj);
    // confidence is a real column; writeEvidenceClaim sets it NULL, writeClaimNode
    // hardcodes 1.0. NULL -> 0 for the recast scalar (a confident-but-untiered
    // graded claim never reaches here since it lacks the tier).
    const confidence = (typeof r.confidence === 'number' && Number.isFinite(r.confidence))
      ? r.confidence : 0;
    // ageDays from last_modified_at via the opts.now seam (D-165-09 deterministic).
    let ageDays = 0;
    if (typeof r.last_modified_at === 'number' && Number.isFinite(r.last_modified_at)) {
      ageDays = Math.max(0, (nowRef - r.last_modified_at) / MS_PER_DAY);
    }
    // governingHash: a provenance handle for the staleness seam. Use the
    // governing_thought_hash prop when present, else the node id (a stable handle).
    const governingHash = (propsObj && typeof propsObj.governing_thought_hash === 'string'
      && propsObj.governing_thought_hash.length > 0)
      ? propsObj.governing_thought_hash
      : r.id;
    return {
      // INSTANCE_FEATURES schema (the recast):
      claimId: r.id,
      section: section,
      domain: domain,
      evidenceTier: r.evidence_tier,
      confidence: confidence,
      governingHash: governingHash,
      ageDays: ageDays,
      // Documented corpus fields (165-RESEARCH 3.2):
      id: r.id,
      type: r.type,
      knowledgeType: r.knowledge_type,
      lastModifiedAt: (typeof r.last_modified_at === 'number') ? r.last_modified_at : null,
    };
  });
}

// readContradictionDensity(db, claimId) -- scalar (a), 165-RESEARCH 2.1a.
// incident CONTRADICTS|INVALIDATES edges / (1 + total incident edges). Incident =
// the claim is either source or target of the edge. Normalized to [0,1).
function readContradictionDensity(db, claimId) {
  if (!db || typeof db.prepare !== 'function' || !claimId) return 0;
  const contraPlaceholders = CONTRA_EDGE_TYPES.map(() => '?').join(',');
  let totalRow;
  let contraRow;
  try {
    totalRow = db.prepare(
      "SELECT COUNT(*) AS n FROM edges e WHERE e.source = ? OR e.target = ?"
    ).get(claimId, claimId);
    contraRow = db.prepare(
      "SELECT COUNT(*) AS n FROM edges e "
      + "WHERE (e.source = ? OR e.target = ?) "
      + "AND e.type IN (" + contraPlaceholders + ")"
    ).get(claimId, claimId, ...CONTRA_EDGE_TYPES);
  } catch (_e) {
    return 0;
  }
  const total = (totalRow && Number.isFinite(totalRow.n)) ? totalRow.n : 0;
  const contra = (contraRow && Number.isFinite(contraRow.n)) ? contraRow.n : 0;
  return contra / (1 + total);
}

// readTierMismatch(db, claimId) -- scalar (b), 165-RESEARCH 2.1b.
// max(0, confidence - TIER_FLOOR[evidence_tier]). confidence is the nodes column;
// evidence_tier is read via json_extract. A NULL confidence (writeEvidenceClaim)
// is treated as 0, so a NULL-confidence corpus row contributes 0 mismatch.
function readTierMismatch(db, claimId) {
  if (!db || typeof db.prepare !== 'function' || !claimId) return 0;
  let row;
  try {
    row = db.prepare(
      "SELECT n.confidence AS confidence, "
      + "json_extract(n.properties, '$.evidence_tier') AS evidence_tier "
      + "FROM nodes n WHERE n.id = ?"
    ).get(claimId);
  } catch (_e) {
    return 0;
  }
  if (!row) return 0;
  const confidence = (typeof row.confidence === 'number' && Number.isFinite(row.confidence))
    ? row.confidence : 0;
  const floor = (typeof row.evidence_tier === 'string'
    && Object.prototype.hasOwnProperty.call(TIER_FLOOR, row.evidence_tier))
    ? TIER_FLOOR[row.evidence_tier]
    : 0;
  return Math.max(0, confidence - floor);
}

// readStaleness(db, claimId, nowFn, cfg) -- scalar (c), 165-RESEARCH 2.1c.
// clamp01((nowRef - last_modified_at) / STALE_WINDOW_MS). STALE_WINDOW from
// cfg.staleWindowDays (default DEFAULT_CONFIG.proxy.staleWindowDays = 30). Uses the
// injected nowFn seam (deterministic; no raw Date.now in the math path). A NULL
// last_modified_at (never write-stamped) yields 0 (no staleness signal).
function readStaleness(db, claimId, nowFn, cfg) {
  if (!db || typeof db.prepare !== 'function' || !claimId) return 0;
  const windowDays = (cfg && typeof cfg.staleWindowDays === 'number' && cfg.staleWindowDays > 0)
    ? cfg.staleWindowDays
    : DEFAULT_CONFIG.proxy.staleWindowDays;
  const windowMs = windowDays * MS_PER_DAY;
  let row;
  try {
    row = db.prepare(
      "SELECT n.last_modified_at AS lm FROM nodes n WHERE n.id = ?"
    ).get(claimId);
  } catch (_e) {
    return 0;
  }
  if (!row || typeof row.lm !== 'number' || !Number.isFinite(row.lm)) return 0;
  const nowRef = resolveNow(nowFn);
  if (windowMs <= 0) return 0;
  return clamp01((nowRef - row.lm) / windowMs);
}

// proxyOracle(db, claimId, cfg, nowFn) -- the D-165-01 cheap proxy label.
// Blends the three LOCAL scalars with cfg weights, thresholds at cfg.proxyThreshold,
// returns { trueLabel, cost }. cfg defaults to DEFAULT_CONFIG.proxy. Zero Brain
// require; all reads LOCAL room.db; deterministic via nowFn (165-RESEARCH 2.2).
function proxyOracle(db, claimId, cfg, nowFn) {
  const config = (cfg && typeof cfg === 'object') ? cfg : DEFAULT_CONFIG.proxy;
  const wContra = (typeof config.w_contra === 'number') ? config.w_contra : DEFAULT_CONFIG.proxy.w_contra;
  const wMismatch = (typeof config.w_mismatch === 'number') ? config.w_mismatch : DEFAULT_CONFIG.proxy.w_mismatch;
  const wStale = (typeof config.w_stale === 'number') ? config.w_stale : DEFAULT_CONFIG.proxy.w_stale;
  const threshold = (typeof config.proxyThreshold === 'number') ? config.proxyThreshold : DEFAULT_CONFIG.proxy.proxyThreshold;
  const cost = (typeof config.proxyCost === 'number') ? config.proxyCost : DEFAULT_CONFIG.proxy.proxyCost;

  const contradictionDensity = readContradictionDensity(db, claimId);
  const tierMismatch = readTierMismatch(db, claimId);
  const staleness = readStaleness(db, claimId, nowFn, config);

  const score = wContra * contradictionDensity
    + wMismatch * tierMismatch
    + wStale * staleness;

  return {
    trueLabel: score >= threshold ? 1 : 0,
    cost: cost,
  };
}

module.exports = {
  findConfidentClaims,
  proxyOracle,
  // Exposed for the proxy unit test + downstream introspection (LOCAL scalars):
  readContradictionDensity,
  readTierMismatch,
  readStaleness,
};
