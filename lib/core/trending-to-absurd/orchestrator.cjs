/**
 * MindrianOS Plugin -- Trending-to-the-Absurd orchestrator (Phase 163, Wave 4)
 *
 * Visionary Innovation Companion. This is the 5-act trend pipeline, CLONED from
 * lib/core/futures/orchestrator.cjs (Canon Part 7: CLONE + EXTEND, never rewrite).
 * The proven 5-act guided-by-ring harness logic is REUSED VERBATIM by require --
 * the cap constants, the ring generator, the cascade-edge writer, the Artifact
 * registrar, the HSI scan, the bridge gate, the confirm path, and the bank-with-
 * provenance path all come straight from the futures harness so the harness logic
 * is reused not duplicated.
 *
 * What this clone EXTENDS (the net-new ~15-20%):
 *   Act 1 (seed grounding):  seedFromDomains + extractTrends -- Act 1 reads the
 *     connective taxonomy via navigation.getDomainsForTrendExtrapolation (Wave 3,
 *     D-163-04 graph-native-from-first-run) instead of a user-typed seed string.
 *   Act 2 (ring generation): generateAbsurdRings -- the extrapolate-to-absurd
 *     expansion that maps the three spec horizons (3-10yr / 11-30yr / 50yr) onto
 *     the frozen HORIZON_ENUM (near / mid / long) and pushes each trend to its
 *     absurd extreme via the reused generateRing.
 *   Act 3 (file + cascade):  registerTrendArtifacts -- a thin wrapper over the
 *     reused registerConsequenceArtifacts pinning the seed folder under
 *     opportunity-bank/trending-to-absurd-<seed>/ (exclusive file ownership,
 *     threat T-163-10). Cascade edges route through the reused writeCascadeEdges
 *     (navigation.writeEdge chokepoint ONLY; zero raw edge-table SQL).
 *   Act 4/5 gates:           surfaceTrendSelectionGate -- the Shape F.1 gate at
 *     the trend-selection judgment point (D-163-05 hybrid; mirrors the reused
 *     surfaceBridgesAtGate). The opportunity-pick gate reuses confirmRingDecisions
 *     (APPROVE routes through navigation.confirmNode with resolveByUser; threat
 *     T-163-11).
 *
 * Pipeline shape (D-163-05 hybrid default): seedFromDomains + the ring generation
 *   are autonomous_safe (auto-run); the two judgment points (trend selection,
 *   opportunity pick) are HITL Shape F Decision Gates.
 *
 * Canon Part 8: ZERO Brain egress. The ONLY external leg is the INHERITED
 *   runSignalResearch generic-handle path (re-exported from the futures harness;
 *   it carries only a generic domain/concept handle, never room content).
 * Canon Part 9: every graph write routes through navigation.writeEdge /
 *   confirmNode (zero raw edge-table INSERT in this file).
 *
 * Pure Node.js built-ins only (zero npm deps). NO em-dashes (CLAUDE.md HARD RULE).
 */

'use strict';

const path = require('path');
const navigation = require('../navigation.cjs');

// --- Part 7 reuse: import the futures 5-act harness VERBATIM by require ---
// The harness logic is REUSED, not duplicated. Every act below builds on these.
const futures = require('../futures/orchestrator.cjs');

const {
  // caps (reused clamps -- the wheel cannot balloon before the HSI O(n^2) pairing)
  FUTURES_DEPTH_CAP,
  FUTURES_FANOUT_CAP,
  resolveDepthCap,
  resolveFanoutCap,
  // enums + validator (reused frozen contract)
  HORIZON_ENUM,
  validateConsequenceFrontmatter,
  // generation + cascade (reused)
  generateRing,
  writeCascadeEdges,
  slugify,
  // Artifact registration + HSI sequencer (reused)
  registerConsequenceArtifacts,
  runHsiScan,
  // Decision Gate + confirm + bank (reused)
  surfaceBridgesAtGate,
  confirmRingDecisions,
  bankCandidateWithProvenance,
  RING_GATE_VERBS,
  // chaining handoffs (reused; CHAIN to /mos:futures + the foresight web)
  surfaceChainingHandoffs,
  // SIGNAL research (reused; the ONLY external leg, Part 8 generic handle)
  runSignalResearch,
  seedGrounding,
} = futures;

// The three Visionary-Innovation-Companion spec horizons mapped onto the frozen
// HORIZON_ENUM (reused from the futures harness; never minted anew):
//   3-10yr  -> 'near'
//   11-30yr -> 'mid'
//   50yr    -> 'long'
// This is the extrapolate-to-absurd horizon contract (Stage 5 of the spec).
const TREND_HORIZON_SPEC = Object.freeze({
  near: '3-10yr',
  mid: '11-30yr',
  long: '50yr',
});
const TREND_HORIZON_ORDER = Object.freeze(['near', 'mid', 'long']);

// ---------------------------------------------------------------------------
// ACT 1 -- seed grounding from the connective taxonomy (D-163-04, graph-native)
// ---------------------------------------------------------------------------

/**
 * seedFromDomains -- Act 1 seed grounding. Reads the connective taxonomy via
 * navigation.getDomainsForTrendExtrapolation (Wave 3) and projects each
 * graph-walked domain hub into a trend-extraction seed. The agent is graph-native
 * from its first run (D-163-04): the seeds come from the local graph, NOT from
 * user-typed strings. On a cold start (no domain nodes) the reader returns its
 * tier-0 fallback domains and this function projects those instead -- never a
 * crash, never a fabricated seed.
 *
 * autonomous_safe (D-163-05): runs without a Decision Gate.
 *
 * @param {string} roomDir - absolute room directory
 * @param {Object} [opts] - { db, maxDepth, topK } forwarded to the reader
 * @returns {{ tier: number, seeds: Array<{ name, domainType, id, relatedCount }> }}
 */
function seedFromDomains(roomDir, opts) {
  opts = opts || {};
  const read = navigation.getDomainsForTrendExtrapolation(roomDir, opts);
  const domains = read && Array.isArray(read.domains) ? read.domains : [];
  const tier = read && Number.isFinite(read.tier) ? read.tier : 0;

  const seeds = domains
    .filter((d) => d && typeof d.name === 'string' && d.name.length > 0)
    .map((d) => ({
      name: d.name,
      domainType: typeof d.domainType === 'string' ? d.domainType : 'domain',
      id: typeof d.id === 'string' ? d.id : '',
      relatedCount: Array.isArray(d.related) ? d.related.length : 0,
    }));

  return { tier, seeds };
}

/**
 * extractTrends -- derive candidate trends from the domain hubs + their related
 * nodes (the seed projection from seedFromDomains, or the raw reader output). A
 * trend candidate is a { trend, domain, sourceId, signalStrength } object where
 * signalStrength is a LOCAL scalar (the related-node count) used to rank which
 * trends are worth pushing to the absurd extreme. Pure + LOCAL; zero Brain egress.
 *
 * @param {Array<Object>} domains - the reader domains, or seedFromDomains().seeds
 * @returns {Array<{ trend, domain, sourceId, signalStrength }>}
 */
function extractTrends(domains) {
  const list = Array.isArray(domains) ? domains : [];
  const trends = [];
  for (const d of list) {
    if (!d || typeof d.name !== 'string' || d.name.length === 0) continue;
    const signalStrength = Number.isFinite(d.relatedCount)
      ? d.relatedCount
      : (Array.isArray(d.related) ? d.related.length : 0);
    trends.push({
      trend: 'Trend in ' + d.name,
      domain: d.name,
      sourceId: typeof d.id === 'string' ? d.id : '',
      signalStrength,
    });
  }
  // Rank by LOCAL signal strength (a richer hub is a stronger trend candidate).
  trends.sort((a, b) => b.signalStrength - a.signalStrength);
  return trends;
}

// ---------------------------------------------------------------------------
// ACT 2 -- extrapolate to the absurd across the three horizons
// ---------------------------------------------------------------------------

/**
 * generateAbsurdRings -- the extrapolate-to-absurd expansion (Stage 5 of the
 * Visionary Innovation Companion spec). REUSES the futures generateRing for the
 * bounded "and then what?" expansion (clamped to FUTURES_DEPTH_CAP /
 * FUTURES_FANOUT_CAP -- the wheel cannot balloon), and STAMPS each generated
 * consequence with one of the three spec horizons. The horizon argument is the
 * frozen HORIZON_ENUM member (near / mid / long); the absurd push means a child
 * with no explicit horizon inherits the ring's spec horizon, so every
 * consequence carries a horizon mapped to 3-10 / 11-30 / 50yr.
 *
 * autonomous_safe (D-163-05): runs without a Decision Gate.
 *
 * @param {string} seed - the trend seed label (ring-1 driver)
 * @param {string} horizon - one of HORIZON_ENUM (near / mid / long)
 * @param {Array<Object>} parents - approved parent consequences (ring N>1)
 * @param {Object} [opts] - { ring, fanout, children } forwarded to generateRing
 * @returns {Array<Object>} the bounded ring consequence objects, horizon-stamped
 */
function generateAbsurdRings(seed, horizon, parents, opts) {
  opts = opts || {};
  // Clamp the requested horizon to the frozen enum (default 'near' = 3-10yr).
  const specHorizon = HORIZON_ENUM.includes(horizon) ? horizon : 'near';
  const ring = Number.isFinite(opts.ring) ? opts.ring : 1;

  // Stamp the spec horizon onto any child that did not declare its own, so the
  // reused validateConsequenceFrontmatter passes and every consequence carries a
  // 3-10 / 11-30 / 50yr horizon. We never overwrite an explicit child horizon.
  function stampHorizon(children) {
    if (!Array.isArray(children)) return children;
    return children.map((raw) => {
      if (!raw || typeof raw !== 'object') return raw;
      if (HORIZON_ENUM.includes(raw.horizon)) return raw;
      return Object.assign({}, raw, { horizon: specHorizon });
    });
  }

  const genOpts = {
    fanout: opts.fanout,
    children: stampHorizon(opts.children),
  };

  // Ring N>1 stamps the spec horizon onto each parent's children too.
  const stampedParents = ring > 1 && Array.isArray(parents)
    ? parents.map((p) => {
        if (!p || typeof p !== 'object') return p;
        return Object.assign({}, p, { children: stampHorizon(p.children) });
      })
    : parents;

  const consequences = generateRing(seed, ring, stampedParents, genOpts);
  // Annotate each consequence with its spec-horizon label (3-10 / 11-30 / 50yr)
  // for the artifact + the gate, without touching the frozen horizon enum value.
  return consequences.map((c) => Object.assign({}, c, {
    horizon_spec: TREND_HORIZON_SPEC[c.horizon] || TREND_HORIZON_SPEC[specHorizon],
  }));
}

// ---------------------------------------------------------------------------
// ACT 3 -- file + cascade (exclusive ownership of opportunity-bank/, T-163-10)
// ---------------------------------------------------------------------------

// The exclusive seed-folder prefix this harness owns under opportunity-bank/.
// EVERY write this harness makes lands under opportunity-bank/trending-to-absurd-*
// (threat T-163-10 -- no write escapes opportunity-bank/).
const TTA_SEED_PREFIX = 'trending-to-absurd';

/**
 * registerTrendArtifacts -- a THIN wrapper over the reused
 * registerConsequenceArtifacts that pins the seed folder under
 * opportunity-bank/trending-to-absurd-<seed>/ (exclusive file ownership,
 * T-163-10). The reused registrar files each consequence as a nested Obsidian
 * .md WITH an ICM Layer 0 ROOM.md per folder (CLAUDE.md decisions 15 + 16) and
 * registers each as a type='Artifact' node. We prefix the seed so the wrapper
 * NEVER files outside opportunity-bank/.
 *
 * @param {string} roomDir - absolute room directory
 * @param {Array<Object>} consequences - the horizon-stamped consequence objects
 * @param {Object} [opts] - { seed } the trend seed label
 * @returns {Promise<{ filed: Array<{id,path}>, seedDir: string }>}
 */
function registerTrendArtifacts(roomDir, consequences, opts) {
  opts = opts || {};
  const seedLabel = String(opts.seed || 'seed');
  // Pin the seed under the TTA-owned prefix so registerConsequenceArtifacts
  // files under opportunity-bank/futures-trending-to-absurd-<seed>/ -- a subtree
  // of opportunity-bank/ (exclusive ownership; no escape).
  const ownedSeed = TTA_SEED_PREFIX + '-' + seedLabel;
  return registerConsequenceArtifacts(roomDir, consequences, { seed: ownedSeed });
}

// ---------------------------------------------------------------------------
// ACT 4 -- the Shape F.1 trend-selection Decision Gate (D-163-05 HITL)
// ---------------------------------------------------------------------------

/**
 * surfaceTrendSelectionGate -- assemble the Shape F.1 Decision Gate at the
 * TREND-SELECTION judgment point (D-163-05 hybrid: the first of the two HITL
 * gates; the other is the opportunity-pick gate via confirmRingDecisions). This
 * MIRRORS the reused surfaceBridgesAtGate: it does the LOCAL assembly only and
 * NEVER renders the gate itself (the HITL checkpoint is the navigator's). Larry /
 * the command layer renders the returned descriptor through the Shape F.1
 * AskUserQuestion selector (the only choice primitive, Part 3).
 *
 * The navigator selects WHICH extracted trends to push to the absurd extreme.
 *
 * @param {string} roomDir - absolute room directory (LOCAL context source)
 * @param {Array<Object>} trends - the extractTrends() candidates
 * @param {Object} [opts]
 * @param {number} [opts.topN] - cap on surfaced trends (default 5)
 * @returns {{ judgment_point: string, verbs: string[], surface: string,
 *   trends: Array<Object>, contexts: Object }}
 */
function surfaceTrendSelectionGate(roomDir, trends, opts) {
  opts = opts || {};
  const topN = Number.isFinite(opts.topN) ? opts.topN : 5;
  const list = Array.isArray(trends) ? trends : [];
  const surfaced = list.slice(0, topN);

  return {
    judgment_point: 'trend-selection',
    // Shape F.1 selector vocabulary (the reused tri-context Decision Gate; Part 3).
    verbs: RING_GATE_VERBS.slice(),
    surface: 'F.1',
    trends: surfaced.map((t) => ({
      trend: t.trend,
      domain: t.domain,
      sourceId: t.sourceId,
      signalStrength: t.signalStrength,
    })),
    // Tri-context panels: LOCAL (the extracted trends) + BRAIN (generic
    // methodology handle ONLY, never room content; Part 8) + SIGNAL (none this
    // turn -- the trend-selection gate is a LOCAL pick, no external sweep).
    contexts: {
      local: { roomDir: path.resolve(roomDir), trendCount: list.length },
      brain: { methodology: 'S-Curve Analysis', note: 'generic framework handle only (Part 8)' },
      signal: { note: 'none this turn' },
    },
  };
}

module.exports = {
  // spec horizon mapping (3-10 / 11-30 / 50yr)
  TREND_HORIZON_SPEC,
  TREND_HORIZON_ORDER,
  TTA_SEED_PREFIX,
  // Act 1 -- net-new graph-native seed grounding (D-163-04)
  seedFromDomains,
  extractTrends,
  // Act 2 -- net-new extrapolate-to-absurd (reuses generateRing)
  generateAbsurdRings,
  // Act 3 -- net-new thin wrapper pinning exclusive ownership (reuses registrar)
  registerTrendArtifacts,
  // Act 4 -- net-new Shape F.1 trend-selection gate (mirrors surfaceBridgesAtGate)
  surfaceTrendSelectionGate,

  // --- Part 7 reuse: the futures 5-act harness functions, re-exported VERBATIM
  // so the command layer drives the SAME proven harness (clone + extend) ---
  FUTURES_DEPTH_CAP,
  FUTURES_FANOUT_CAP,
  resolveDepthCap,
  resolveFanoutCap,
  HORIZON_ENUM,
  validateConsequenceFrontmatter,
  generateRing,
  writeCascadeEdges,
  slugify,
  registerConsequenceArtifacts,
  runHsiScan,
  surfaceBridgesAtGate,
  confirmRingDecisions,
  bankCandidateWithProvenance,
  RING_GATE_VERBS,
  surfaceChainingHandoffs,
  // the ONLY external leg (Part 8 generic handle)
  runSignalResearch,
  seedGrounding,
};
