'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 219-03 -- opportunity-harvest: the graph-event candidate producer
 * (REQ-2, the D-01 producer half of SENS-14).
 *
 * WHAT: harvestCandidates(roomDir, opts) scans room.db READ-ONLY for graph
 * events (bridge / whitespace / contradiction / eureka_proposal /
 * meeting_filing), scores each per the BINDING Harvest Formula
 * (CANDIDATE = Signal x Connection x Lens x Actor -- Brain already asked and
 * answered; never re-derived) using the canon-derived Q1..Q8 qualification
 * rubric (219-RESEARCH.md "Brain-sourced qualification doctrine"), classifies
 * Gibson Four-Lens, computes the D-18 component bag + HarvestIndex_v1
 * (ADVISORY, EXPERIMENTAL), and writes the enum/handle-only side-channel
 * <roomDir>/.mindrian/last-opportunity-harvest.json atomically
 * (write-temp-then-rename). SENS-14 (sensor-opportunity-harvest.cjs) reads
 * that file; the qualification card (Plan 04) dereferences the handles
 * against room.db locally for display.
 *
 * NAMING DE-COLLISION: Phase 188's lib/hmi/harvest-scope-state.cjs owns the
 * bare 'harvest' name (harvest-scope-state.json). Every surface here is
 * namespaced opportunity-harvest / last-opportunity-harvest.json. Own path --
 * never .mindrian/eureka/ or .mindrian/entity-extract/ (218 Pitfall 5).
 *
 * READ-ONLY BY CONTRACT (T-219-10): this producer NEVER writes nodes or edges
 * -- minting happens only at the card behind the human gate (Plan 04, Part 9
 * role 5). Zero INSERT/UPDATE/DELETE statements in this file (grep-gated by
 * the test + run-all-219). Full in-memory graph load (D2: rooms are 70-2,400
 * nodes; never LazyGraph).
 *
 * CANON PART 8 (enum/handle-only, even though the file is LOCAL): opaque
 * node-id handles, closed enums, quantized scalars. ZERO user prose crosses
 * into the side-channel -- no titles, no names, no hypothesis text.
 *
 * ---------------------------------------------------------------------------
 * THE RUBRIC MAPPING (Harvest Formula <- Q1..Q8, from the Brain doctrine):
 *   Signal     = Q1 friction/creation + Q4 timing
 *   Connection = Q2 (>=1 typed link, the ONLY HARD GATE: "one dot is noise")
 *                + Q3 surprise (cross-section/bridge, not within-cluster)
 *   Lens       = Four-Lens classification (a label, not a score factor)
 *   Actor      = Q5 actor fit
 *   Q6 definability, Q7 newness, Q8 desirability act as disqualifier checks.
 *
 * Multiplicative composition: score = q1*q2*q3*q4*q5*q6*q7*q8, quantized to
 * 2 decimals. Q2=0 -> the candidate is NEVER surfaced (the hard gate).
 * Q7=0 -> the candidate is DEDUPED (it already exists in the opportunity
 * bank or carries a REJECTED_BECAUSE edge -- re-surfacing a filed/rejected
 * item is not a NEW candidate; this is the newness dedup, not a quality
 * filter, so it does not violate the D-18 "Q2 is the only hard gate" rule,
 * which governs quality/readiness filtering).
 *
 * DETERMINISTIC WEIGHTS + THRESHOLDS (Claude's discretion per plan, tuned
 * against the Plan-02 hub-skew fixture; every value is a documented module
 * constant, no randomness, no clock-dependent decay so two back-to-back runs
 * are byte-identical):
 *   Q1 friction/creation per lane (LANE_Q1): contradiction 1.0 (friction is
 *     explicit), whitespace 0.9 (a gap IS friction), eureka_proposal 0.9
 *     (statement already critic-screened), bridge 0.8 (creation potential),
 *     meeting_filing 0.7 (friction implied, unscored).
 *   Q3 surprise: cross-section pair 1.0; WITHIN-CLUSTER (same-section) pair
 *     0.4 -- the 218 degree-centrality countermeasure: a same-section
 *     restatement is demoted, never promoted. Node lanes: whitespace 0.8,
 *     eureka_proposal 0.9, meeting_filing 0.6.
 *   Q4 timing: 0.8 constant (a live window is not deterministically
 *     measurable from the LOCAL graph yet; 0.8 = "window unknown, not
 *     stale" -- honest, and clock-free so runs stay deterministic).
 *   Q5 actor fit: 0.8 constant (the room's navigator is presumed able to
 *     act absent a negative capability signal; no such signal exists in the
 *     LOCAL graph deterministically).
 *   Q6 definability: 1.0 when every evidence endpoint resolves to a live
 *     node (a governing-thought candidate is expressible over real dots),
 *     else 0.7.
 *   Q8 desirability: 1.0 always -- there is NO deterministic legal/moral
 *     signal in the graph, and fabricating a disqualifier would be worse
 *     than omitting one. The human card (Plan 04) owns Q8 judgment.
 *   BANDS: high >= 0.60, medium >= 0.35, else low.
 *   HUB_DEGREE_CEILING = 6: a bridge endpoint with degree > 6 is an
 *     accumulated hub (the fixture hubs sit at 14-16); hub endpoints are
 *     excluded from the bridge lane entirely -- an artifact-vs-artifact hub
 *     pair must NEVER become a candidate (218 R1 regression pin).
 *
 * ---------------------------------------------------------------------------
 * D-18 COMPONENT BAG (existing measured signals ONLY; a missing input is the
 * typed string 'unknown', NEVER a fabricated zero -- a zero means
 * measured-zero):
 *   critic_gate: the 212 critic verdict, read from a banked opportunity
 *     node's props.critic (eureka_proposal lane). 'resolved'/'transferable'
 *     -> 'pass'; 'restatement'/'pseudoscience'/'general_shallow' -> 'fail';
 *     anything else / other lanes -> 'unknown'.
 *   compression_score: the 213 compression meter value when carried on the
 *     node props (props.compression_score); else 'unknown'.
 *   portfolio_score: the 215 AHP 3-dim row matched by evidence-pair ids from
 *     <roomDir>/evals/eureka/215-portfolio-report.json (ranked[].a/b ->
 *     dims); tech_econ_feasibility maps to the schema key 'feasibility';
 *     else 'unknown'.
 *   tail_flag: props.tail_flag boolean (215) or the matched 215 JSON row's
 *     tail_flag; else 'unknown' (never folded into any score).
 *   evidence_readiness: deterministic closed rubric over measured graph
 *     connectivity: round2(min(1, connection_count / 4)).
 *   follow_through_readiness: closed presence rubric over a banked node's
 *     props (owner / next_experiment / decision_question): present-count/3
 *     (0 is an HONEST measured zero on an existing node); other lanes have
 *     no node to measure -> 'unknown'.
 *
 * HarvestIndex_v1 (ADVISORY, status EXPERIMENTAL until calibrated; NEVER a
 * surfacing filter beyond the Q2 hard gate):
 *   value = critic_gate x weighted sum of the KNOWN numeric components,
 *   weights renormalized over the known subset. critic 'fail' -> 0 (a
 *   measured gate zero); critic 'unknown' -> 'unknown' (never fabricated);
 *   no known numeric component -> 'unknown'. Weights are the explicit
 *   editable constant HARVEST_INDEX_WEIGHTS below.
 *
 * engine_mode: 'engine' on this deterministic path. 'llm_manual_baseline' is
 * stamped ONLY by the D-20 offered fallback (Plan 04) and is EXCLUDED from
 * calibration sets.
 *
 * House rule: hyphens only, no em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');

const { openRoomDb, closeRoomDb } = require('../room-db.cjs');

// ---------- The closed enums (the Plan 03/04 shared interfaces contract) ----------

const SCHEMA_VERSION = 1;

const LENSES = Object.freeze([
  'leveraging_resources',
  'challenging_orthodoxies',
  'understanding_needs',
  'harnessing_trends',
]);

const SOURCE_EVENTS = Object.freeze([
  'bridge', 'whitespace', 'contradiction', 'eureka_proposal', 'meeting_filing',
]);

// ---------- The documented deterministic weights + thresholds ----------

// Q1 friction/creation per lane (Signal factor validity).
const LANE_Q1 = Object.freeze({
  bridge: 0.8,
  whitespace: 0.9,
  contradiction: 1,
  eureka_proposal: 0.9,
  meeting_filing: 0.7,
});

// Q3 surprise for node lanes (pair lanes compute cross-section vs within-cluster).
const LANE_Q3 = Object.freeze({
  whitespace: 0.8,
  eureka_proposal: 0.9,
  meeting_filing: 0.6,
});

const Q3_CROSS_SECTION = 1;      // an intersectional pair: two dots colliding
const Q3_WITHIN_CLUSTER = 0.4;   // same-section restatement: DEMOTED (218 lesson)
const Q4_TIMING_DEFAULT = 0.8;   // window unknown, not stale (clock-free)
const Q5_ACTOR_DEFAULT = 0.8;    // navigator presumed able to act
const Q6_DEFINABLE = 1;
const Q6_UNRESOLVED = 0.7;

const BAND_HIGH = 0.6;
const BAND_MEDIUM = 0.35;

// A bridge endpoint above this degree is an accumulated hub -- excluded from
// the bridge lane (the fixture hubs sit at 14-16; the entity family at 1-2).
const HUB_DEGREE_CEILING = 6;

// The typed edge kinds a bridge candidate may ride (associative reach, not
// provenance): DESCRIBES/DERIVED_FROM etc. are provenance, never bridges.
//
// GAP-2 (219-06 live checkpoint, 2026-07-13, ador-ip-test): the original
// four generic values never occur in a live post-218 room -- the census on
// ador-ip-test showed zero RELATED_TO/CONVERGES/SUPPORTS/INFORMS edges and
// 47 real domain-relationship edges (COMPETES_WITH:21, USES_COMPONENT:15,
// SUPPLIES_TO:11) that this lane was structurally blind to. The 219-03
// fixture only ever planted a generic RELATED_TO bridge, so the unit suite
// stayed green while the live run found zero candidates. Additive fix per
// D-04 (reuse existing typed edges wherever they fit): the 218 domain
// vocabulary IS the real bridge signal on any real room -- add it, keep the
// generic four for rooms that predate 218 extraction or use CONVERGES-style
// cross-references.
const BRIDGE_EDGE_TYPES = Object.freeze(new Set([
  'RELATED_TO', 'CONVERGES', 'SUPPORTS', 'INFORMS',
  'COMPETES_WITH', 'USES_COMPONENT', 'SUPPLIES_TO',
]));

// Node types that can never be a bridge endpoint (artifact-vs-artifact and
// event/plumbing nodes are restatements of room structure, not signal dots).
const BRIDGE_EXCLUDED_NODE_TYPES = Object.freeze(new Set([
  'memory_artifact', 'memory_event', 'meeting', 'WhitespaceZone', 'Section',
  'Artifact', 'opportunity',
]));

// The 212 critic verdict -> critic_gate mapping (D-18).
const CRITIC_PASS_VERDICTS = Object.freeze(new Set(['resolved', 'transferable', 'pass']));
const CRITIC_FAIL_VERDICTS = Object.freeze(new Set(['restatement', 'pseudoscience', 'general_shallow', 'fail']));

// HarvestIndex_v1: the explicit EDITABLE weights constant (D-18). Versioned;
// EXPERIMENTAL until calibrated on a labeled set. Edit here, nowhere else.
const HARVEST_INDEX_VERSION = 'HarvestIndex_v1';
const HARVEST_INDEX_STATUS = 'EXPERIMENTAL';
const HARVEST_INDEX_WEIGHTS = Object.freeze({
  compression: 0.3,
  portfolio: 0.3,
  evidence: 0.2,
  follow_through: 0.2,
});

// ---------- small pure helpers ----------

function round2(v) {
  return Math.round(v * 100) / 100;
}

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// The dependency-free stable 31-multiplier hash (the typed-entity /
// typed-opportunity id-minter idiom -- NOT createHash; the Part-8 sweep bans
// crypto hashing in sensor-adjacent surfaces).
function stableHash(key) {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

function candidateId(lane, evidenceIds) {
  return 'harv:' + lane + ':' + stableHash(lane + '|' + evidenceIds.slice().sort().join('|'));
}

function parseProps(row) {
  try {
    const p = JSON.parse(row.properties || '{}');
    return isPlainObject(p) ? p : {};
  } catch (_e) {
    return {};
  }
}

function readJsonSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_e) {
    return null;
  }
}

// Atomic write: temp-then-rename (the eureka-reach-runner idiom).
function writeJsonAtomic(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = filePath + '.tmp.' + process.pid;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function bandOf(score) {
  if (score >= BAND_HIGH) return 'high';
  if (score >= BAND_MEDIUM) return 'medium';
  return 'low';
}

// Normalize a name for the Q7 bank-filename dedup (lowercase alnum spine).
function normalizeName(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// ---------- the graph snapshot (READ-ONLY, full in-memory load) ----------

function loadGraph(db) {
  const nodes = new Map(); // id -> { id, type, props }
  const edges = [];        // { source, target, type }
  const degree = new Map();
  const bySource = new Map();
  const byTarget = new Map();

  for (const row of db.prepare('SELECT id, type, properties FROM nodes').all()) {
    nodes.set(row.id, { id: row.id, type: row.type, props: parseProps(row) });
  }
  for (const row of db.prepare('SELECT source, target, type FROM edges ORDER BY source, target, type').all()) {
    const e = { source: row.source, target: row.target, type: row.type };
    edges.push(e);
    degree.set(e.source, (degree.get(e.source) || 0) + 1);
    degree.set(e.target, (degree.get(e.target) || 0) + 1);
    if (!bySource.has(e.source)) bySource.set(e.source, []);
    bySource.get(e.source).push(e);
    if (!byTarget.has(e.target)) byTarget.set(e.target, []);
    byTarget.get(e.target).push(e);
  }
  return { nodes, edges, degree, bySource, byTarget };
}

function degreeOf(graph, id) {
  return graph.degree.get(id) || 0;
}

// A node's anchor section: props.section when present, else the section of
// the memory_artifact its DESCRIBES edge points at, else 'unknown'.
function anchorSection(graph, id) {
  const node = graph.nodes.get(id);
  if (!node) return 'unknown';
  if (typeof node.props.section === 'string' && node.props.section.length > 0) {
    return node.props.section;
  }
  const out = graph.bySource.get(id) || [];
  for (const e of out) {
    if (e.type !== 'DESCRIBES') continue;
    const target = graph.nodes.get(e.target);
    if (target && typeof target.props.section === 'string' && target.props.section.length > 0) {
      return target.props.section;
    }
  }
  return 'unknown';
}

function hasRejectionEdge(graph, id) {
  const touching = (graph.bySource.get(id) || []).concat(graph.byTarget.get(id) || []);
  return touching.some((e) => e.type === 'REJECTED_BECAUSE');
}

// Evidence handles of a banked opportunity node: its DERIVED_FROM targets.
function derivedFromTargets(graph, id) {
  return (graph.bySource.get(id) || [])
    .filter((e) => e.type === 'DERIVED_FROM')
    .map((e) => e.target);
}

// The dominant-signal lens for bridge/eureka lanes: a market/trend dot is a
// macro signal (harnessing_trends); a person/user dot is a needs signal
// (understanding_needs); otherwise combining existing dots is
// leveraging_resources. Deterministic, documented.
function dominantSignalLens(graph, evidenceIds) {
  let sawMarket = false;
  let sawPerson = false;
  for (const id of evidenceIds) {
    const node = graph.nodes.get(id);
    if (!node) continue;
    if (node.type === 'market' || node.type === 'trend') sawMarket = true;
    if (node.type === 'person' || node.type === 'user') sawPerson = true;
  }
  if (sawMarket) return 'harnessing_trends';
  if (sawPerson) return 'understanding_needs';
  return 'leveraging_resources';
}

// ---------- D-18 components ----------

function criticGateOf(props) {
  const v = typeof props.critic === 'string' ? props.critic : '';
  if (CRITIC_PASS_VERDICTS.has(v)) return 'pass';
  if (CRITIC_FAIL_VERDICTS.has(v)) return 'fail';
  return 'unknown';
}

// Match a candidate's evidence pair against the 215 AHP report (ranked[].a/b).
function portfolioRowFor(report215, evidenceIds) {
  if (!report215 || !Array.isArray(report215.ranked) || evidenceIds.length < 2) return null;
  const set = new Set(evidenceIds);
  for (const r of report215.ranked) {
    if (set.has(r.a) && set.has(r.b)) return r;
  }
  return null;
}

function buildComponents(lane, nodeProps, evidenceIds, connectionCount, report215) {
  const props = isPlainObject(nodeProps) ? nodeProps : null;
  const row = portfolioRowFor(report215, evidenceIds);

  const critic_gate = (lane === 'eureka_proposal' && props) ? criticGateOf(props) : 'unknown';

  let compression_score = 'unknown';
  if (props && typeof props.compression_score === 'number' && Number.isFinite(props.compression_score)) {
    compression_score = round2(props.compression_score);
  }

  let portfolio_score = 'unknown';
  if (row && isPlainObject(row.dims)) {
    const d = row.dims;
    if (typeof d.strategic_fit === 'number' && typeof d.validated_demand === 'number'
        && typeof d.tech_econ_feasibility === 'number') {
      portfolio_score = {
        strategic_fit: round2(d.strategic_fit),
        validated_demand: round2(d.validated_demand),
        feasibility: round2(d.tech_econ_feasibility),
      };
    }
  }

  let tail_flag = 'unknown';
  if (props && typeof props.tail_flag === 'boolean') tail_flag = props.tail_flag;
  else if (row && typeof row.tail_flag === 'boolean') tail_flag = row.tail_flag;

  // Measured graph-connectivity rubric (deterministic, closed).
  const evidence_readiness = round2(Math.min(1, connectionCount / 4));

  // Presence rubric on a banked node's props; measured zero is honest on an
  // existing node, but a lane with no node has nothing to measure -> unknown.
  let follow_through_readiness = 'unknown';
  if (lane === 'eureka_proposal' && props) {
    let present = 0;
    for (const k of ['owner', 'next_experiment', 'decision_question']) {
      if (typeof props[k] === 'string' && props[k].length > 0) present += 1;
    }
    follow_through_readiness = round2(present / 3);
  }

  return {
    critic_gate,
    compression_score,
    portfolio_score,
    tail_flag,
    evidence_readiness,
    follow_through_readiness,
  };
}

// HarvestIndex_v1 = critic_gate x weighted sum of KNOWN numeric components,
// weights renormalized over the known subset. ADVISORY -- never filters.
function buildHarvestIndex(components) {
  const out = {
    version: HARVEST_INDEX_VERSION,
    status: HARVEST_INDEX_STATUS,
    value: 'unknown',
    weights: HARVEST_INDEX_WEIGHTS,
  };
  if (components.critic_gate === 'unknown') return out; // never fabricated
  if (components.critic_gate === 'fail') {
    out.value = 0; // a MEASURED gate zero, not a missing input
    return out;
  }
  const numeric = [];
  if (typeof components.compression_score === 'number') {
    numeric.push({ w: HARVEST_INDEX_WEIGHTS.compression, v: components.compression_score });
  }
  if (isPlainObject(components.portfolio_score)) {
    const p = components.portfolio_score;
    const mean = (p.strategic_fit + p.validated_demand + p.feasibility) / 3;
    numeric.push({ w: HARVEST_INDEX_WEIGHTS.portfolio, v: mean });
  }
  if (typeof components.evidence_readiness === 'number') {
    numeric.push({ w: HARVEST_INDEX_WEIGHTS.evidence, v: components.evidence_readiness });
  }
  if (typeof components.follow_through_readiness === 'number') {
    numeric.push({ w: HARVEST_INDEX_WEIGHTS.follow_through, v: components.follow_through_readiness });
  }
  if (numeric.length === 0) return out;
  const wSum = numeric.reduce((s, n) => s + n.w, 0);
  const value = numeric.reduce((s, n) => s + (n.w / wSum) * n.v, 0);
  out.value = round2(value);
  return out;
}

// ---------- rubric scoring ----------

// Compose the rubric + multiplicative score for one candidate. `pairSections`
// is null for node lanes; for pair lanes it is [sectionA, sectionB].
function scoreCandidate(lane, evidenceResolved, pairSections, deduped) {
  const q1 = LANE_Q1[lane];
  const q2 = 1; // the caller has already enforced the hard gate (>=1 typed link)
  let q3;
  if (pairSections) {
    const crossSection = pairSections[0] !== pairSections[1]
      && pairSections[0] !== 'unknown' && pairSections[1] !== 'unknown';
    q3 = crossSection ? Q3_CROSS_SECTION : Q3_WITHIN_CLUSTER;
  } else {
    q3 = LANE_Q3[lane] !== undefined ? LANE_Q3[lane] : 0.6;
  }
  const q4 = Q4_TIMING_DEFAULT;
  const q5 = Q5_ACTOR_DEFAULT;
  const q6 = evidenceResolved ? Q6_DEFINABLE : Q6_UNRESOLVED;
  const q7 = deduped ? 0 : 1;
  const q8 = 1;
  const rubric = {
    q1: round2(q1), q2, q3: round2(q3), q4, q5, q6, q7, q8,
  };
  const score = round2(q1 * q2 * q3 * q4 * q5 * q6 * q7 * q8);
  return { rubric, score };
}

// ---------- the five graph-event lanes ----------

function scanBridges(graph) {
  const out = [];
  const seen = new Set();
  for (const e of graph.edges) {
    if (!BRIDGE_EDGE_TYPES.has(e.type)) continue;
    const a = graph.nodes.get(e.source);
    const b = graph.nodes.get(e.target);
    if (!a || !b) continue;
    // Non-artifact, low-degree dots ONLY: artifact hubs and event/plumbing
    // nodes never form a bridge candidate (218 R1 countermeasure).
    if (BRIDGE_EXCLUDED_NODE_TYPES.has(a.type) || BRIDGE_EXCLUDED_NODE_TYPES.has(b.type)) continue;
    if (degreeOf(graph, a.id) > HUB_DEGREE_CEILING || degreeOf(graph, b.id) > HUB_DEGREE_CEILING) continue;
    const key = [a.id, b.id].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ lane: 'bridge', evidence: [a.id, b.id], node: null });
  }
  return out;
}

function scanContradictions(graph) {
  const out = [];
  const seen = new Set();
  for (const e of graph.edges) {
    if (e.type !== 'CONTRADICTS') continue;
    const a = graph.nodes.get(e.source);
    const b = graph.nodes.get(e.target);
    if (!a || !b) continue;
    // An artifact-vs-artifact contradiction pair is a structural restatement
    // of the room, not a signal (the same 218 pin as the bridge lane).
    if ((a.type === 'memory_artifact' || a.type === 'Artifact')
      && (b.type === 'memory_artifact' || b.type === 'Artifact')) continue;
    const key = [a.id, b.id].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ lane: 'contradiction', evidence: [a.id, b.id], node: null });
  }
  return out;
}

// Whitespace zones ride the graph nodes whitespace-to-graph.cjs minted from
// prior scout runs (.mindrian/whitespace-results.json -> WhitespaceZone
// nodes). When no prior scout output landed, the lane yields nothing --
// graceful skip, never a crash. The raw JSON is NOT read as a candidate
// source: it carries hypothesis prose, and this side-channel is handle-only.
function scanWhitespace(graph) {
  const out = [];
  for (const node of graph.nodes.values()) {
    if (node.type !== 'WhitespaceZone') continue;
    out.push({ lane: 'whitespace', evidence: [node.id], node });
  }
  return out;
}

// Proposed opportunity nodes minted by Plan 01's banking (lifecycle
// 'candidate', review_status born 'proposed').
function scanEurekaProposals(graph) {
  const out = [];
  for (const node of graph.nodes.values()) {
    if (node.type !== 'opportunity') continue;
    if (node.props.lifecycle !== 'candidate') continue;
    out.push({ lane: 'eureka_proposal', evidence: [node.id], node });
  }
  return out;
}

// Meeting filings: real-world meeting nodes (type 'meeting') plus
// memory_event nodes carrying the meeting kind.
function scanMeetingFilings(graph) {
  const out = [];
  for (const node of graph.nodes.values()) {
    const isMeeting = node.type === 'meeting'
      || (node.type === 'memory_event' && node.props.kind === 'meeting');
    if (!isMeeting) continue;
    out.push({ lane: 'meeting_filing', evidence: [node.id], node });
  }
  return out;
}

// ---------- lens classification (Gibson Four-Lens) ----------

function classifyLens(graph, event) {
  switch (event.lane) {
    case 'contradiction': return 'challenging_orthodoxies';
    case 'whitespace': return 'leveraging_resources';
    case 'meeting_filing': return 'understanding_needs';
    case 'eureka_proposal': {
      const p = event.node ? event.node.props : {};
      if (typeof p.lens === 'string' && LENSES.indexOf(p.lens) !== -1) return p.lens;
      const targets = derivedFromTargets(graph, event.node.id);
      return dominantSignalLens(graph, targets.length > 0 ? targets : event.evidence);
    }
    case 'bridge':
    default:
      return dominantSignalLens(graph, event.evidence);
  }
}

// ---------- harvestCandidates: the producer ----------

/**
 * Scan room.db for graph events, score them per the Q1..Q8 rubric, classify
 * Four-Lens, compute D-18 components + HarvestIndex_v1, and write
 * <roomDir>/.mindrian/last-opportunity-harvest.json atomically.
 *
 * READ-ONLY against the graph. Never throws: returns { ok:false, reason } on
 * any failure so the scout cadence degrades instead of dying (T-219-12).
 *
 * @param {string} roomDir
 * @param {object} [opts] -- { sessionId? }
 * @returns {{ok:boolean, count?:number, top_band?:string|null,
 *            top_candidate_id?:string|null, side_channel?:string,
 *            candidates?:Array<object>, reason?:string}}
 */
function harvestCandidates(roomDir, opts) {
  try {
    if (typeof roomDir !== 'string' || roomDir.length === 0) {
      return { ok: false, reason: 'invalid_room_dir' };
    }
    const options = isPlainObject(opts) ? opts : {};
    const sessionId = (typeof options.sessionId === 'string' && options.sessionId.length > 0)
      ? options.sessionId : 'opportunity-harvest';

    let db;
    try {
      db = openRoomDb(roomDir);
    } catch (e) {
      return { ok: false, reason: 'room_db_open_failed', detail: String(e.message || '').slice(0, 80) };
    }

    let graph;
    try {
      graph = loadGraph(db);
    } catch (e) {
      return { ok: false, reason: 'graph_load_failed', detail: String(e.message || '').slice(0, 80) };
    } finally {
      try { closeRoomDb(db); } catch (_e) { /* handle already closed */ }
    }

    // The 215 AHP report (Plan 05 reads the same file); absent -> components
    // source 'unknown', never a fabricated value.
    const report215 = readJsonSafe(path.join(roomDir, 'evals', 'eureka', '215-portfolio-report.json'));

    // Q7 newness: the opportunity-bank filename spine for the name dedup.
    // computeOpportunityBankState/listOpportunities is the shipped door.
    const bankNames = new Set();
    try {
      const oppOps = require('../opportunity-ops.cjs');
      const listed = oppOps.listOpportunities(roomDir);
      for (const o of (listed && listed.opportunities) || []) {
        bankNames.add(normalizeName(String(o.filename || '').replace(/\.md$/, '')));
      }
    } catch (_e) { /* bank unreadable -> no dedup source, never a crash */ }

    // Bridges deduped against banked eureka proposals: an opportunity node
    // already DERIVED_FROM both endpoints carries the pair in its own lane.
    const bankedPairs = new Set();
    for (const node of graph.nodes.values()) {
      if (node.type !== 'opportunity') continue;
      const targets = derivedFromTargets(graph, node.id);
      if (targets.length >= 2) bankedPairs.add(targets.slice().sort().join('|'));
    }

    const events = []
      .concat(scanBridges(graph))
      .concat(scanWhitespace(graph))
      .concat(scanContradictions(graph))
      .concat(scanEurekaProposals(graph))
      .concat(scanMeetingFilings(graph));

    const candidates = [];
    for (const event of events) {
      // Q2 CONNECTION -- the ONLY hard gate ("one dot is noise"). Pair lanes:
      // the weakest endpoint's typed-link count; node lanes: the node degree.
      let connectionCount;
      if (event.evidence.length >= 2) {
        connectionCount = Math.min(...event.evidence.map((id) => degreeOf(graph, id)));
      } else {
        connectionCount = degreeOf(graph, event.evidence[0]);
      }
      if (connectionCount < 1) continue; // Q2 = 0 -> never surfaced

      // Q7 NEWNESS dedup: an existing REJECTED_BECAUSE edge, a bank-filename
      // match, or a pair already carried by a banked proposal.
      let deduped = event.evidence.some((id) => hasRejectionEdge(graph, id))
        || (event.node && hasRejectionEdge(graph, event.node.id));
      if (!deduped && event.lane === 'eureka_proposal') {
        const nm = normalizeName(event.node.props.name);
        if (nm && bankNames.has(nm)) deduped = true;
      }
      if (!deduped && event.lane === 'bridge') {
        if (bankedPairs.has(event.evidence.slice().sort().join('|'))) deduped = true;
      }
      if (deduped) continue; // q7 = 0: not NEW -> deduped, never re-surfaced

      const evidenceResolved = event.evidence.every((id) => graph.nodes.has(id));
      const pairSections = event.evidence.length >= 2
        ? [anchorSection(graph, event.evidence[0]), anchorSection(graph, event.evidence[1])]
        : null;

      const { rubric, score } = scoreCandidate(event.lane, evidenceResolved, pairSections, false);
      const components = buildComponents(
        event.lane,
        event.node ? event.node.props : null,
        event.lane === 'eureka_proposal' ? derivedFromTargets(graph, event.node.id) : event.evidence,
        connectionCount,
        report215
      );

      candidates.push({
        candidate_id: candidateId(event.lane, event.evidence),
        node_handle: event.lane === 'eureka_proposal' ? event.node.id : null,
        source_event: event.lane,
        lens: classifyLens(graph, event),
        band: bandOf(score),
        score,
        connection_count: connectionCount,
        evidence_handles: event.evidence.slice(),
        rubric,
        components,
        harvest_index: buildHarvestIndex(components),
        engine_mode: 'engine',
      });
    }

    // Rank: score desc, stable candidate_id tie-break (deterministic order).
    candidates.sort((a, b) => (b.score - a.score) || (a.candidate_id < b.candidate_id ? -1 : 1));

    const sideChannel = path.join(roomDir, '.mindrian', 'last-opportunity-harvest.json');
    writeJsonAtomic(sideChannel, {
      schema_version: SCHEMA_VERSION,
      generated_at: new Date().toISOString(),
      session_id: sessionId,
      candidates,
    });

    return {
      ok: true,
      count: candidates.length,
      top_band: candidates.length > 0 ? candidates[0].band : null,
      top_candidate_id: candidates.length > 0 ? candidates[0].candidate_id : null,
      side_channel: sideChannel,
      candidates,
    };
  } catch (e) {
    return { ok: false, reason: 'harvest_failed', detail: String(e && e.message ? e.message : e).slice(0, 120) };
  }
}

module.exports = {
  harvestCandidates,
  // The documented deterministic constants (exposed for tests + live tuning).
  SCHEMA_VERSION,
  LENSES,
  SOURCE_EVENTS,
  LANE_Q1,
  LANE_Q3,
  HUB_DEGREE_CEILING,
  BRIDGE_EDGE_TYPES,
  HARVEST_INDEX_VERSION,
  HARVEST_INDEX_STATUS,
  HARVEST_INDEX_WEIGHTS,
};
