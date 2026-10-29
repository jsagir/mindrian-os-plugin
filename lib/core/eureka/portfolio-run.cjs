'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 314-02 -- the bounded portfolio run.
 *
 * WHAT THIS IS
 *   One library function, runPortfolio(opts), that scores the pairs a room's OWN
 *   typed edges name, with the engines that survived Phase 366. Door 1 (the
 *   /mos:eureka-portfolio command) and Door 2 (the movement store) both call it.
 *   It composes, in this order: ahp-weights, room-native-substrate, the tri-modal
 *   index, candidate-exclusion, rs-differential-scorer, portfolio-dimensions and
 *   tail-quadrant. It adds no scoring math of its own.
 *
 * RESOLVED ENGINE-PATH DECISION (navigator, 2026-10-28)
 *   The batch runner that CONTEXT named was deleted by Phase 366 plan 22 (the
 *   navigator ruling "runner: retire"). The navigator then chose the answer
 *   "Bounded run library (Recommended)". This file is that library. It has no
 *   all-pairs loop (the loop Phase 366 D-02 retired) and no runner file or
 *   runner name returns (tests/test-366-runner-retired.cjs stays green).
 *
 * BOUNDARIES
 *   - Pairs come from the typed edges only. A room with things and no edges
 *     degrades to no_pairs. It never falls back to enumerating cross pairs.
 *   - HARD GATE: a pair is scored only when this run freshly embedded the room.
 *     A stale vector from an earlier run never passes as a live number.
 *   - Measured fitness numbers belong to the portfolio command only. The
 *     /mos:eureka command keeps its rule never to render a score, and nothing
 *     here feeds a number into that path.
 *   - Canon Part 9: the run opens the room, reads it, and writes only the derived
 *     eureka_* projection tables (the index). Nodes, edges and memory events are
 *     untouched. The run never writes the portfolio store; the command does.
 *   - Canon Part 8: no network of any kind, no Brain call. The figure guard inside
 *     scoreMeasured can refuse a pair; the run skips that pair and counts it.
 *
 * RESULT SHAPES
 *   ok:       { status: 'ok', snapshot, display }
 *   degraded: { status: 'degraded', degrade: 'qualitative-only', reason, qualitative }
 *   error:    { status: 'error', reason }
 *
 * The snapshot is the closed schema of portfolio-snapshot.cjs. The display object
 * is for the caller's terminal only and is never stored. Room text appears only
 * in labels (cut to 80 characters).
 *
 * Plain CJS. Hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const { openRoomDb, closeRoomDb } = require('../room-db.cjs');
const triModal = require('../semantic-index/tri-modal-index.cjs');
const { scoreMeasured } = require('../rs-differential-scorer.cjs');
const ahp = require('./ahp-weights.cjs');
const pdims = require('./portfolio-dimensions.cjs');
const tailmod = require('./tail-quadrant.cjs');
const roomNative = require('./room-native-substrate.cjs');
const candidateExclusion = require('./candidate-exclusion.cjs');
const snap = require('./portfolio-snapshot.cjs');
// The closed entity node-type family, reused from its one source of truth.
const { ENTITY_NODE_TYPES } = require('../navigation/typed-entity.cjs');
// Reused room-report helper: reads the vectors the index just wrote.
const roomReport = require('../../../scripts/eureka-room-report.cjs');

// ---------- constants ----------

const DEFAULT_TOP_N = 25;
const MAX_TOP_N = 100;
const DEFAULT_MAX_PAIRS = 20000;
const MAX_MOST_CONNECTED = 10;
const MAX_TAIL_SHOWN = 25;
const GROWTH_PROXY = 'created_at-recency (room-native)';
const DEFAULT_AHP_SOURCE = 'data/portfolio-ahp-matrix.json';

// The scaffold node-type family: a pair with BOTH ends scaffold is document
// scaffolding, never a real cross-domain opportunity (quick 260715-0nj).
const SCAFFOLD_NODE_TYPES = Object.freeze(new Set(['memory_artifact', 'Artifact']));
// A Section node is a folder label: never a valid endpoint on either side.
const CONTAINER_NODE_TYPES = Object.freeze(new Set(['Section']));
// An unverified tier-1 regex hit no semantic tier confirmed (quick 260719).
// 'fallback' is deliberately absent: it is honest provenance, not an exclusion.
const LOW_TRUST_EVIDENCE_TIERS = Object.freeze(new Set(['low_confidence']));

// ---------- small helpers ----------

function finiteOr0(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Numeric recency axis: the substrate stamps cnumber as epoch seconds.
function cnumberNumeric(cnumber) {
  const s = String(cnumber == null ? '' : cnumber).replace(/^[Cc]/, '');
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * handleFor(id) -> a stored handle. A room node id that already fits the closed
 * handle pattern is used as it is. Any other id becomes 'h_' plus 24 hex
 * characters of its sha256, so the snapshot always passes its own schema and
 * the same id always gives the same handle.
 */
function handleFor(id) {
  const s = String(id == null ? '' : id);
  if (snap.HANDLE_RE.test(s)) return s;
  return 'h_' + crypto.createHash('sha256').update(s).digest('hex').slice(0, 24);
}

function pairKey(ha, hb) {
  return ha < hb ? ha + '|' + hb : hb + '|' + ha;
}

function cutLabel(text) {
  const one = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  return one.length > snap.MAX_LABEL_CHARS ? one.slice(0, snap.MAX_LABEL_CHARS).trim() : one;
}

function parseProps(row) {
  try {
    const p = JSON.parse(row && row.properties);
    return (p && typeof p === 'object' && !Array.isArray(p)) ? p : {};
  } catch (_e) {
    return {};
  }
}

// A typed entity node whose evidence tier is low-trust (props only, never throws).
function isLowTrustEntity(row) {
  const props = parseProps(row);
  const et = typeof props.entityType === 'string' ? props.entityType : '';
  if (!ENTITY_NODE_TYPES.has(et)) return false;
  const tier = typeof props.evidenceTier === 'string' ? props.evidenceTier : '';
  return LOW_TRUST_EVIDENCE_TIERS.has(tier);
}

function errorResult(reason) {
  return { status: 'error', reason: reason };
}

function clampInt(v, lo, hi, dflt) {
  if (v === undefined || v === null) return dflt;
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(lo, Math.min(hi, Math.floor(n)));
}

// ---------- cohort, tail and labels ----------

/**
 * Entity things are percentile-ranked against other entity things; everything
 * else keeps the mixed cohort (Phase 218 stratification). With no entity thing
 * the mixed cohort is the whole cohort, which equals the unstratified result.
 */
function buildCohorts(items) {
  const entityCohort = [];
  const scaffoldCohort = [];
  const typeOf = new Map();
  items.forEach(function (it) {
    typeOf.set(it.id, it.type);
    if (ENTITY_NODE_TYPES.has(it.type)) entityCohort.push(it.tech);
    else scaffoldCohort.push(it.tech);
  });
  return function cohortFor(id) {
    return ENTITY_NODE_TYPES.has(typeOf.get(id)) ? entityCohort : scaffoldCohort;
  };
}

/** Per-thing tail axes over the cohort, then the shipped classifier. */
function computeTail(items) {
  const techs = items.map(function (it) { return it.tech; });
  const pairCounts = techs.map(function (t) { return finiteOr0(t.pair_count); }).sort(function (a, b) { return a - b; });
  const cnums = techs.map(function (t) { return cnumberNumeric(t.cnumber); }).sort(function (a, b) { return a - b; });
  const axes = techs.map(function (t) {
    return {
      id: t.id,
      attention: pdims.percentileRank(finiteOr0(t.pair_count), pairCounts),
      growth: pdims.percentileRank(cnumberNumeric(t.cnumber), cnums),
    };
  });
  return tailmod.classifyTail(axes, { growthProxy: GROWTH_PROXY });
}

function tailSummary(tailResult, labelOfId, handleOfId) {
  const items = tailResult.tail.map(function (t) {
    const h = handleOfId(t.id);
    return { id: h, label: labelOfId(t.id) };
  });
  return {
    count: items.length,
    items: items.slice(0, MAX_TAIL_SHOWN),
    insufficient_structure: tailResult.insufficient_structure === true,
    suspect_noise: tailResult.suspect_noise === true,
    composition: tailResult.composition,
    growth_proxy: tailResult.growth_proxy,
  };
}

/**
 * The qualitative block: counts, the most connected things and the quiet tail.
 * It reads the substrate only. It carries no fitness number of any kind.
 */
function buildQualitative(items, sub, structuralExcluded, labelOfId, handleOfId) {
  const have = new Set(items.map(function (it) { return it.id; }));
  let typedPairs = 0;
  sub.convergesPairs.forEach(function (cp) {
    if (have.has(cp.a) && have.has(cp.b)) typedPairs += 1;
  });
  const ranked = items.slice().sort(function (x, y) {
    const dx = finiteOr0(x.tech.degree);
    const dy = finiteOr0(y.tech.degree);
    if (dy !== dx) return dy - dx;
    return x.id < y.id ? -1 : (x.id > y.id ? 1 : 0);
  });
  const mostConnected = ranked
    .filter(function (it) { return finiteOr0(it.tech.degree) >= 1; })
    .slice(0, MAX_MOST_CONNECTED)
    .map(function (it) {
      return { id: handleOfId(it.id), label: labelOfId(it.id), connections: finiteOr0(it.tech.degree) };
    });
  return {
    counts: { things: items.length, typed_edge_pairs: typedPairs, structural_excluded: structuralExcluded },
    most_connected: mostConnected,
    tail: tailSummary(computeTail(items), labelOfId, handleOfId),
  };
}

function degraded(reason, qualitative) {
  return { status: 'degraded', degrade: 'qualitative-only', reason: reason, qualitative: qualitative };
}

// ---------- encoder provenance ----------

function encoderInfo(hasStub) {
  if (hasStub) return { model: 'stub', dtype: 'stub' };
  try {
    // Lazy: the spine is only named for a live run.
    const prov = require('../semantic-index/embedding-spine.cjs').encoderProvenance();
    return { model: String(prov.model || 'unknown'), dtype: String(prov.dtype || 'unknown') };
  } catch (_e) {
    return { model: 'unknown', dtype: 'unknown' };
  }
}

// ---------- the run ----------

/**
 * runPortfolio(opts) -> Promise<ok | degraded | error>. Never throws.
 * opts: roomDir (absolute, required), section (slug), topN (1..100, default 25),
 * maxPairs (default 20000), and the test seams encodeFn, forceUnavailable,
 * ahpConfigPath and now.
 */
async function runPortfolio(opts) {
  const o = opts || {};
  if (typeof o.roomDir !== 'string' || !path.isAbsolute(o.roomDir)) return errorResult('no_room');
  const roomDir = o.roomDir;

  // Scope: the whole room, or one named section (D-05).
  let section = null;
  if (o.section !== undefined && o.section !== null) {
    if (typeof o.section !== 'string' || !snap.SLUG_RE.test(o.section)) return errorResult('bad_section');
    section = o.section;
  }
  const topN = clampInt(o.topN, 1, MAX_TOP_N, DEFAULT_TOP_N);
  const maxPairs = clampInt(o.maxPairs, 1, snap.MAX_PAIRS, Math.min(DEFAULT_MAX_PAIRS, snap.MAX_PAIRS));
  const hasStub = typeof o.encodeFn === 'function';
  const clock = typeof o.now === 'function' ? o.now : function () { return new Date(); };

  // 1. The AHP weights are loaded per run. A bad matrix stops the run loudly.
  let ahpConfig;
  try {
    ahpConfig = ahp.loadAhpConfig(o.ahpConfigPath);
  } catch (_e) {
    return errorResult('ahp_inconsistent');
  }
  const weights = ahpConfig.weights;

  // 2. The room must already have a database; the run never creates one.
  if (!fs.existsSync(path.join(roomDir, '.mindrian', 'room.db'))) return errorResult('no_room');
  let db = null;
  try {
    db = openRoomDb(roomDir, { allowExtension: true });
  } catch (_e) {
    return errorResult('room_unreadable');
  }

  try {
    // 3. The substrate: handles are the room's own opaque node ids.
    const sub = roomNative.buildRoomNativeSubstrate(db, { canonicalId: function (row) { return row.id; } });
    const rows = db.prepare('SELECT id, type, properties, source_path FROM nodes ORDER BY id').all();

    // 4 and 6. Eligible things: has text, inside the section when one is named,
    // and not structural. Structural things are counted by reason.
    const exclCtx = candidateExclusion.buildExclusionContext({ roomDir: roomDir });
    const eligible = [];
    let structuralExcluded = 0;
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const text = triModal.nodeText(row, { roomDir: roomDir });
      if (!text) continue;
      const tech = sub.techMap.get(row.id);
      if (!tech) continue;
      if (section !== null && tech.section !== section) continue;
      if (candidateExclusion.structuralReason(row, exclCtx)) {
        structuralExcluded += 1;
        continue;
      }
      eligible.push({
        id: row.id,
        type: row.type || 'unknown',
        text: text,
        tech: tech,
        lowTrust: isLowTrustEntity(row),
        vec: null,
      });
    }
    const byId = new Map();
    eligible.forEach(function (it) { byId.set(it.id, it); });
    const handleOfId = function (id) { return handleFor(id); };
    const labelOfId = function (id) {
      const it = byId.get(id);
      if (!it) return '';
      return it.tech.title === it.id ? '' : cutLabel(it.tech.title);
    };

    if (eligible.length < 2) {
      return degraded('too_few_things', buildQualitative(eligible, sub, structuralExcluded, labelOfId, handleOfId));
    }

    // 5. Index the room. HARD GATE: score only when this run freshly embedded.
    let idx;
    try {
      idx = await triModal.indexNodes(db, {
        // The forced-unavailable seam must reach the spine, so an injected
        // encoder is withheld when it is set (the encoder bypasses the hook).
        encodeFn: (hasStub && o.forceUnavailable !== true) ? o.encodeFn : undefined,
        roomDir: roomDir,
        _forceUnavailable: o.forceUnavailable === true ? true : undefined,
      });
    } catch (_e) {
      return errorResult('room_unreadable');
    }
    if (!idx || idx.embedded !== true) {
      return degraded('encoder_unavailable', buildQualitative(eligible, sub, structuralExcluded, labelOfId, handleOfId));
    }

    // 6. Vectors from this run's index. A thing without a vector is not indexed.
    const vectors = roomReport.loadIndexVectors(db, idx.vec_backend);
    const indexed = [];
    eligible.forEach(function (it) {
      const v = vectors.get(it.id);
      if (v) {
        it.vec = v;
        indexed.push(it);
      }
    });
    if (indexed.length < 2) {
      return degraded('too_few_things', buildQualitative(eligible, sub, structuralExcluded, labelOfId, handleOfId));
    }
    const indexedById = new Map();
    indexed.forEach(function (it) { indexedById.set(it.id, it); });
    const cohortFor = buildCohorts(indexed);

    // 7. Pair set: the typed-edge pairs only, both ends indexed. No cross-boundary
    // enumeration exists anywhere in this file.
    let hasVerifiedEntity = false;
    indexed.forEach(function (it) {
      if (!hasVerifiedEntity && ENTITY_NODE_TYPES.has(it.type) && !it.lowTrust) hasVerifiedEntity = true;
    });
    let convergesPairs = 0;
    let containerExcluded = 0;
    let lowTrustExcluded = 0;
    let scaffoldExcluded = 0;
    const candidates = [];
    sub.convergesPairs.forEach(function (cp) {
      const na = indexedById.get(cp.a);
      const nb = indexedById.get(cp.b);
      if (!na || !nb) return;
      convergesPairs += 1;
      if (CONTAINER_NODE_TYPES.has(na.type) || CONTAINER_NODE_TYPES.has(nb.type)) {
        containerExcluded += 1;
        return;
      }
      if (hasVerifiedEntity && (na.lowTrust || nb.lowTrust)) {
        lowTrustExcluded += 1;
        return;
      }
      if (SCAFFOLD_NODE_TYPES.has(na.type) && SCAFFOLD_NODE_TYPES.has(nb.type)) {
        scaffoldExcluded += 1;
        return;
      }
      const ha = handleOfId(na.id);
      const hb = handleOfId(nb.id);
      const swap = hb < ha;
      candidates.push({ key: pairKey(ha, hb), ha: swap ? hb : ha, hb: swap ? ha : hb, a: swap ? nb : na, b: swap ? na : nb });
    });
    candidates.sort(function (x, y) { return x.key < y.key ? -1 : (x.key > y.key ? 1 : 0); });
    const pairsCapped = candidates.length > maxPairs;
    const toScore = pairsCapped ? candidates.slice(0, maxPairs) : candidates;

    if (toScore.length === 0) {
      return degraded('no_pairs', buildQualitative(eligible, sub, structuralExcluded, labelOfId, handleOfId));
    }

    // 8. Score each pair. The figure guard can refuse a pair: skip and count.
    const enc = encoderInfo(hasStub);
    const scored = [];
    let figureGuardSkipped = 0;
    let encoderSkipped = 0;
    for (let k = 0; k < toScore.length; k += 1) {
      const cp = toScore[k];
      let r;
      try {
        // eslint-disable-next-line no-await-in-loop
        r = await scoreMeasured(cp.a.text, cp.b.text, {
          vectors: [cp.a.vec, cp.b.vec],
          vectorsProvenance: { model: enc.model, dtype: enc.dtype },
        });
      } catch (_e) {
        figureGuardSkipped += 1;
        continue;
      }
      if (!r || r.warning === 'encoder_unavailable' || r.signed_diff === null) {
        encoderSkipped += 1;
        continue;
      }
      const dimsA = pdims.scoreTechDimensions(cp.a.tech, cohortFor(cp.a.id));
      const dimsB = pdims.scoreTechDimensions(cp.b.tech, cohortFor(cp.b.id));
      const rs = { direction: r.direction, abs_diff: r.abs_diff, passes: r.passes };
      const pairDims = pdims.scorePairDimensions({ a: dimsA, b: dimsB, rs: rs });
      const band = (typeof r.band === 'string' && snap.BANDS.indexOf(r.band) !== -1) ? r.band : 'none';
      scored.push({
        key: cp.key,
        ha: cp.ha,
        hb: cp.hb,
        a: cp.a,
        b: cp.b,
        score: ahp.composeScore(pairDims, weights),
        band: band,
        pairDims: pairDims,
        weakA: pdims.weakDimensions(dimsA),
        weakB: pdims.weakDimensions(dimsB),
        isComp: pdims.complementary(dimsA, dimsB),
      });
    }
    if (scored.length === 0) {
      const why = encoderSkipped > 0 ? 'encoder_unavailable' : 'no_pairs';
      return degraded(why, buildQualitative(eligible, sub, structuralExcluded, labelOfId, handleOfId));
    }

    // 9. The quiet tail over the cohort.
    const tailResult = computeTail(indexed);
    const tailIds = new Set(tailResult.tail.map(function (t) { return t.id; }));

    // 10. Rank: score descending, ties by pair key. Ranks start at 1.
    scored.sort(function (x, y) {
      if (y.score !== x.score) return y.score - x.score;
      return x.key < y.key ? -1 : (x.key > y.key ? 1 : 0);
    });
    scored.forEach(function (s, i) { s.rank = i + 1; });

    const shown = scored.slice(0, topN);
    const labelFor = function (id) { return labelOfId(id); };
    const labels = {};
    let labelCount = 0;
    const addLabel = function (id) {
      if (labelCount >= snap.MAX_LABELS) return;
      const h = handleOfId(id);
      if (Object.prototype.hasOwnProperty.call(labels, h)) return;
      const text = labelFor(id);
      if (!text) return;
      labels[h] = text;
      labelCount += 1;
    };
    shown.forEach(function (s) { addLabel(s.a.id); addLabel(s.b.id); });
    tailResult.tail.slice(0, MAX_TAIL_SHOWN).forEach(function (t) { addLabel(t.id); });

    // 11. Provenance: flat scalars; every count is read at run time.
    const provenance = {
      run_mode: hasStub ? 'offline-stub' : 'live',
      encoder_model: enc.model,
      encoder_dtype: enc.dtype,
      vec_backend: String(idx.vec_backend || 'unknown'),
      ahp_weight_strategic_fit: weights[0],
      ahp_weight_validated_demand: weights[1],
      ahp_weight_tech_econ_feasibility: weights[2],
      ahp_cr: ahpConfig.cr,
      ahp_matrix_source: o.ahpConfigPath ? 'custom' : DEFAULT_AHP_SOURCE,
      cohort_techs: indexed.length,
      converges_pairs: convergesPairs,
      pairs_scored: scored.length,
      pairs_capped: pairsCapped,
      figure_guard_skipped: figureGuardSkipped,
      structural_excluded: structuralExcluded,
      container_pairs_excluded: containerExcluded,
      scaffold_pairs_excluded: scaffoldExcluded,
      low_trust_pairs_excluded: lowTrustExcluded,
      tail_composition: tailResult.composition,
      growth_proxy: tailResult.growth_proxy,
      section_scoped: section !== null,
    };

    const sid = section === null ? 'room' : snap.scopeId(section);
    const snapshot = {
      schema_version: snap.SCHEMA_VERSION,
      ran_at: clock().toISOString(),
      scope: section === null ? 'room' : 'subset',
      scope_id: sid,
      encoder_kind: hasStub ? 'stub' : 'live',
      provenance: provenance,
      pairs: scored.map(function (s) {
        return { a: s.ha, b: s.hb, band: s.band, score: s.score, rank: s.rank };
      }),
      tail: {
        composition: tailResult.composition,
        insufficient_structure: tailResult.insufficient_structure === true,
        suspect_noise: tailResult.suspect_noise === true,
        items: tailResult.tail.slice(0, 5000).map(function (t) { return { id: handleOfId(t.id) }; }),
      },
      labels: labels,
    };
    // 12. A run never hands back a snapshot its own store would refuse.
    if (!snap.validateSnapshot(snapshot)) return errorResult('room_unreadable');

    // In-process only: handle -> label for any thing in this run. Never stored.
    const labelByHandle = new Map();
    indexed.forEach(function (it) { labelByHandle.set(handleOfId(it.id), labelOfId(it.id)); });
    const labelOf = function (handle) {
      if (typeof handle !== 'string' || !labelByHandle.has(handle)) return '';
      return labelByHandle.get(handle);
    };

    const display = {
      rows: shown.map(function (s) {
        return {
          rank: s.rank,
          a: s.ha,
          b: s.hb,
          a_label: labelOf(s.ha),
          b_label: labelOf(s.hb),
          score: s.score,
          band: s.band,
          dims: {
            strategic_fit: s.pairDims.strategic_fit,
            validated_demand: s.pairDims.validated_demand,
            tech_econ_feasibility: s.pairDims.tech_econ_feasibility,
          },
          weak_a: s.weakA,
          weak_b: s.weakB,
          complementary: s.isComp,
          tail_flag: tailIds.has(s.a.id) || tailIds.has(s.b.id),
        };
      }),
      tail: tailSummary(tailResult, labelOfId, handleOfId),
      counts: {
        things: indexed.length,
        pairs_scored: scored.length,
        pairs_candidates: candidates.length,
        structural_excluded: structuralExcluded,
      },
      labelOf: labelOf,
    };

    return { status: 'ok', snapshot: snapshot, display: display };
  } catch (_e) {
    return errorResult('room_unreadable');
  } finally {
    try { closeRoomDb(db); } catch (_e2) { /* ignore */ }
  }
}

module.exports = {
  runPortfolio: runPortfolio,
  _test: {
    handleFor: handleFor,
    cutLabel: cutLabel,
    SCAFFOLD_NODE_TYPES: SCAFFOLD_NODE_TYPES,
    CONTAINER_NODE_TYPES: CONTAINER_NODE_TYPES,
    LOW_TRUST_EVIDENCE_TIERS: LOW_TRUST_EVIDENCE_TIERS,
  },
};
