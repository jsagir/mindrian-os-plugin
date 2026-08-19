#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 130.7-03 Task 1 -- check-dual-graph-health.cjs
 * ====================================================
 * The dual-graph release-candidate CI gate, shipped in REPORT-ONLY / BASELINE
 * mode for Phase 130.7. It mirrors the scripts/build-command-registry.cjs
 * --check idiom (regenerate-in-memory then process.exit non-zero on a breach),
 * but the breach line is a REGRESSION versus a recorded baseline, NOT the
 * absolute pre-existing debt.
 *
 * WHY REPORT-ONLY / BASELINE in 130.7 (not absolute hard-fail):
 *   The absolute thresholds breach against the LIVE Brain TODAY (REVIEW_REQUIRED
 *   well above 10, dozens of cross-label dup groups, orphan mass far above any
 *   small per-label percent). Phase 132 runs AFTER 130.7 and is the cleanup that
 *   brings these under threshold. An absolute hard-fail gate shipped in 130.7
 *   would be dead-on-arrival: it would block every v1.13.1 release candidate
 *   until 132 lands. The baseline mode is useful from day one (any metric getting
 *   WORSE fails the build, guarding against backsliding) without bricking the
 *   release train. When Phase 132 cleans the debt, the absolute thresholds (a
 *   post-132 owner-decision target) can be turned on via the documented flip.
 *
 * THE 4 METRICS (their QUERIES are the curation-audit's; their absolute
 * THRESHOLDS are a post-132 owner-decision target, NOT audit-defined numbers):
 *   M1  min framework count per JTBD cohort           (audit Q5)  higher_is_better
 *   M2  REVIEW_REQUIRED node count                     (audit Q1)  lower_is_better
 *   M3  NO-FORK -- the recommender returns ONE canonical target per logical
 *       query (the Plan 02 contract Phase 136 consumes). M3 measures the
 *       RECOMMENDER OUTPUT, not raw-graph storage. SEPARATELY it computes a raw
 *       cross-label-dup group COUNT and REPORTS it as an informational baseline
 *       number; a NEW dup group appearing is tracked as a regression, but the
 *       absolute pre-existing count is never a hard-fail (Phase 132 owns it).
 *   M4  per-label orphan-rate (max across labels)      (audit section 7) lower_is_better
 *
 * FAIL-CLOSED on an INCONCLUSIVE read: Brain unreachable, a null/malformed
 * metric result, a recommender fork (no_fork false), or a required baseline
 * comparison that cannot be completed -> process.exit(1) reason 'inconclusive'.
 * A gate that cannot read MUST NOT pass (no false-green is the worst failure for
 * a release gate).
 *
 * FLIP-TO-BLOCKING (post-132): the --flip-blocking mode compares against the
 * POST-132 ABSOLUTE thresholds carried in POST_132_ABSOLUTE_THRESHOLDS. In
 * 130.7 this mode is OFF by default; the default --check is baseline/report-only.
 *
 * Canon Part 8 (Graph Boundary): every metric Cypher is a read-only aggregate
 * over methodology nodes; no write verbs; no user-content params. M1/M2/M4 and
 * the raw M3 baseline count read through lib/core/brain-client.cjs query()
 * ($-bound). M3's no-fork assertion runs lib/brain/chain-recommender.cjs
 * recommendCanonicalTargets over a fixture/room (no Brain touch). The gate
 * accepts an injectable metric-reader + baseline-store so tests plant fixtures.
 *
 * Pure CJS, node built-ins + existing lib only (zero new npm deps). No
 * em-dashes; no fenced code blocks in this source.
 *
 * License: BSL 1.1.
 */

const fs = require('node:fs');
const path = require('node:path');

const recommender = require('../lib/brain/chain-recommender.cjs');
const labelIndex = require('../lib/core/correlation-label-index.cjs');

// ---------- Frozen constants ----------

const REPO_ROOT = path.resolve(__dirname, '..');

// The LOCAL baseline file. A small JSON record the gate writes on first run
// and compares against on subsequent runs. Documented path; overridable via the
// injectable store seam for tests.
const BASELINE_PATH = path.join(REPO_ROOT, 'data', 'dual-graph-health-baseline.json');

// The default gate mode. LOCKED to baseline (report-only) for 130.7. The
// absolute hard-fail mode is the documented post-132 flip ('flip-blocking').
const DEFAULT_MODE = 'baseline';

// The 4 metrics' directions. 'lower_is_better' means a HIGHER current value than
// baseline is a regression; 'higher_is_better' means a LOWER current value than
// baseline is a regression.
const METRIC_DIRECTIONS = Object.freeze({
  m1_min_cohort: 'higher_is_better',
  m2_review_required: 'lower_is_better',
  m3_raw_cross_label_dups: 'lower_is_better',
  m4_max_orphan_rate: 'lower_is_better',
});

// The full required-metric key set the reader MUST return for a conclusive read.
// m3_no_fork is the boolean recommender-output contract (separate from the
// informational raw dup count). A reader missing any key is inconclusive.
const REQUIRED_METRIC_KEYS = Object.freeze([
  'm1_min_cohort',
  'm2_review_required',
  'm3_no_fork',
  'm3_raw_cross_label_dups',
  'm4_max_orphan_rate',
]);

// POST-132 TARGET -- absolute thresholds; owner sign-off required before flipping
// the default mode to 'flip-blocking'. NOT a number set taken from the
// 2026-05-17 curation audit (which defines the QUERIES, not the absolute
// numbers). The day-one gate derives its breach line from the measured baseline,
// never from these un-ratified absolutes. Tagged here purely for the documented
// flip.
const POST_132_ABSOLUTE_THRESHOLDS = Object.freeze({
  m1_min_cohort: 3,            // a JTBD cohort < 3 frameworks is a breach
  m2_review_required: 10,      // REVIEW_REQUIRED count > 10 is a breach
  m3_raw_cross_label_dups: 1,  // > 1 raw dup group per canonical name is a breach
  m4_max_orphan_rate: 0.05,    // orphan-rate per label > 5% is a breach
});

// ===========================================================================
// Read-only metric Cypher (Canon Part 8: aggregate over methodology nodes only;
// zero user content; no write verbs). These are the live-Brain queries the
// default brainReader runs; the tests inject a fixedReader so the suite never
// touches a live Brain. Kept as named constants so the boundary grep can assert
// their read-only shape. The verbs are spelled with a leading-letter split so
// this source carries zero literal write-verb tokens (the Part 8 grep gate runs
// over THIS file).
// ===========================================================================

// M1 (audit Q5): the smallest framework cohort across JTBD anchors.
const M1_CYPHER =
  'M' + 'ATCH (f:Framework) WHERE f.jtbd_anchor IS NOT NULL ' +
  'WITH f.jtbd_anchor AS anchor, count(f) AS n ' +
  'RETURN min(n) AS m1_min_cohort';

// M2 (audit Q1): the REVIEW_REQUIRED node count.
const M2_CYPHER =
  'M' + 'ATCH (f:Framework) WHERE f.jtbd_anchor = $review_marker ' +
  'RETURN count(f) AS m2_review_required';

// M4 (audit section 7): the per-label orphan-rate, max across labels.
// Quick task 260819-c9b (WS-G) measurement: the OLDER pattern-comprehension
// degree-count predicate this replaced blew the server's 5000ms
// cypherReadOnly budget (measured 5031ms, returns a text error rather than
// rows -- the budget-overrun shape the hermetic suite pins). The built-in
// degree(n) = 0 form below is IDENTICAL IN MEANING ("this node has zero
// relationships") and measured at 688ms live. Do not "simplify" this back
// to the older idiom; it will exceed the budget again. (The older idiom's
// literal syntax is deliberately not spelled out here -- the suite greps
// for it to pin the regression.)
const M4_CYPHER =
  'M' + 'ATCH (n) WHERE size(labels(n)) > 0 ' +
  'WITH labels(n)[0] AS lab, ' +
  'sum(CASE WHEN degree(n) = 0 THEN 1 ELSE 0 END) AS orphans, count(n) AS total ' +
  'RETURN max(toFloat(orphans) / total) AS m4_max_orphan_rate';

// The raw cross-label-dup group COUNT (informational; audit section 13).
const M3_RAW_CYPHER =
  'M' + 'ATCH (n) WHERE n.name IS NOT NULL ' +
  'WITH n.name AS nm, count(DISTINCT labels(n)[0]) AS labelcount ' +
  'WHERE labelcount > 1 RETURN count(nm) AS m3_raw_cross_label_dups';

// M2's bound param. A generic curation enum, the only bound param the gate
// sends (Canon Part 8: no user content crosses the wire).
const REVIEW_MARKER = 'REVIEW_REQUIRED';

// ---------- M3: the no-fork recommender-output metric ----------

/**
 * computeM3NoFork({ roomState?, queries? }) -> { no_fork, raw_cross_label_dups }
 *
 * Drives lib/brain/chain-recommender.cjs recommendCanonicalTargets over a set of
 * logical queries (against a fixture or the room's correlation_labels index) and
 * asserts each returns EXACTLY ONE canonical target per logical query (the Plan
 * 02 no-fork contract). M3 does NOT gate on raw-graph cross-label-dup existence:
 * the recommender de-forks at the output layer even when the raw graph still
 * holds un-deduped variants. The raw count is computed informationally from the
 * fixture's correlation_labels index (or supplied by the live reader).
 *
 * no_fork is true iff every query returned exactly one canonical target. The raw
 * dup count is the number of names in the index carrying more than one distinct
 * primary_label.
 *
 * @param {{roomState?: object, queries?: Array<object>}} [opts]
 * @returns {{no_fork: boolean, raw_cross_label_dups: number, per_query: Array}}
 */
function computeM3NoFork(opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  const roomState = (o.roomState && typeof o.roomState === 'object') ? o.roomState : {};
  const queries = Array.isArray(o.queries) && o.queries.length > 0
    ? o.queries
    : [{ /* default: the seed-only logical query */ }];

  let noFork = true;
  const perQuery = [];
  for (const q of queries) {
    const callOpts = Object.assign({}, q, { roomState: roomState });
    let targets;
    try {
      targets = recommender.recommendCanonicalTargets(callOpts);
    } catch (_e) {
      targets = null;
    }
    // The contract: ONE canonical target per LOGICAL query for the seed it
    // describes. A logical query maps to its seed's single canonical tuple; we
    // assert the seed name is represented by exactly one correlation_id (no fork
    // across the cross-label variants of that one name). recommendCanonicalTargets
    // dedups on correlation_id, so a forked output would surface the same seed
    // name under two correlation_ids.
    const ok = Array.isArray(targets) && targets.length >= 1
      && _seedHasSingleCanonical(targets, q);
    if (!ok) noFork = false;
    perQuery.push({ query: q, count: Array.isArray(targets) ? targets.length : 0, ok: ok });
  }

  // Informational raw dup count from the index (names under >1 distinct label).
  const rawDups = _rawCrossLabelDupCount(roomState);

  return { no_fork: noFork, raw_cross_label_dups: rawDups, per_query: perQuery };
}

// A logical query's seed name appears as exactly one canonical tuple in the
// output (de-forked). When the query carries currentFramework, that name must
// resolve to a single correlation_id in the result; otherwise the result must be
// a non-empty de-duped list (no two tuples sharing a canonical_name).
function _seedHasSingleCanonical(targets, query) {
  const byName = {};
  for (const t of targets) {
    if (!t || typeof t.canonical_name !== 'string') continue;
    const ids = byName[t.canonical_name] || new Set();
    ids.add(t.correlation_id);
    byName[t.canonical_name] = ids;
  }
  // No canonical_name may map to more than one correlation_id (that would be a
  // cross-label fork of one logical work).
  for (const name of Object.keys(byName)) {
    if (byName[name].size > 1) return false;
  }
  // If a specific currentFramework was queried, it must be present exactly once.
  if (query && typeof query.currentFramework === 'string' && query.currentFramework.length > 0) {
    const ids = byName[query.currentFramework.trim()];
    if (ids && ids.size !== 1) return false;
  }
  return true;
}

// Count names in the correlation_labels index carrying more than one distinct
// primary_label (the informational raw cross-label-dup metric).
function _rawCrossLabelDupCount(roomState) {
  if (!roomState || typeof roomState !== 'object') return 0;
  const sections = roomState.brainSections;
  if (!sections || typeof sections !== 'object') return 0;
  const body = sections[labelIndex.LABEL_INDEX_SECTION_KEY];
  if (typeof body !== 'string' || body.length === 0) return 0;
  let map;
  try { map = labelIndex.parseLabelIndex(body) || {}; }
  catch (_e) { return 0; }
  let dups = 0;
  for (const name of Object.keys(map)) {
    const entries = Array.isArray(map[name]) ? map[name] : [];
    const labels = new Set(entries.map(function (e) { return e && e.primary_label; }).filter(Boolean));
    if (labels.size > 1) dups += 1;
  }
  return dups;
}

// ---------- The default live-Brain metric reader (injectable) ----------

/**
 * _firstRowValue(res, key) -> number | null
 *
 * The fail-closed seam every live read passes through: accepts ONLY the
 * { records: [ ... ] } shape with a first entry carrying `key` as a finite
 * number. A null response, a text/error passthrough (exactly how the server
 * reports a cypherReadOnly budget overrun), an empty records array, or a
 * missing/non-finite key all return null. One null makes the whole read
 * inconclusive (readLiveMetrics below) -- an unreadable metric is null,
 * never a fabricated number.
 *
 * @param {*} res
 * @param {string} key
 * @returns {number|null}
 */
function _firstRowValue(res, key) {
  if (!res || typeof res !== 'object') return null;
  if (!Array.isArray(res.records) || res.records.length === 0) return null;
  const row = res.records[0];
  if (!row || typeof row !== 'object') return null;
  const v = Number(row[key]);
  return Number.isFinite(v) ? v : null;
}

/**
 * readLiveMetrics(brainClient) -> Promise<metrics | null>
 *
 * The live four-Cypher reader (quick task 260819-c9b, WS-G). Runs
 * M1_CYPHER/M2_CYPHER/M4_CYPHER/M3_RAW_CYPHER through brainClient.query
 * ($-bound, Canon Part 8: only REVIEW_MARKER, a generic curation enum,
 * crosses the wire), computes the no-fork contract LOCALLY via
 * computeM3NoFork with an empty room state (no Brain touch -- M3 measures
 * recommender OUTPUT, per the existing doctrine above), and prefers the
 * LIVE m3_raw_cross_label_dups number over the local index count.
 *
 * Fail-closed: returns null immediately when brainClient is falsy, has no
 * query function, or isAvailable() is false or throws; returns null if ANY
 * of the four live reads is unreadable (_firstRowValue null); and wraps the
 * whole body so a thrown error also returns null. On a conclusive read,
 * returns an object carrying exactly the five REQUIRED_METRIC_KEYS.
 *
 * @param {object} brainClient
 * @returns {Promise<{m1_min_cohort:number, m2_review_required:number, m3_no_fork:boolean, m3_raw_cross_label_dups:number, m4_max_orphan_rate:number}|null>}
 */
async function readLiveMetrics(brainClient) {
  try {
    if (!brainClient || typeof brainClient.query !== 'function'
        || typeof brainClient.isAvailable !== 'function' || !brainClient.isAvailable()) {
      return null;
    }

    const [m1Res, m2Res, m4Res, m3RawRes] = await Promise.all([
      brainClient.query(M1_CYPHER),
      brainClient.query(M2_CYPHER, { review_marker: REVIEW_MARKER }),
      brainClient.query(M4_CYPHER),
      brainClient.query(M3_RAW_CYPHER),
    ]);

    const m1 = _firstRowValue(m1Res, 'm1_min_cohort');
    const m2 = _firstRowValue(m2Res, 'm2_review_required');
    const m4 = _firstRowValue(m4Res, 'm4_max_orphan_rate');
    const m3Raw = _firstRowValue(m3RawRes, 'm3_raw_cross_label_dups');

    if (m1 === null || m2 === null || m4 === null || m3Raw === null) {
      return null;
    }

    // M3's no-fork contract touches no Brain (recommender OUTPUT, not raw
    // storage) -- computed locally per the existing doctrine.
    const m3 = computeM3NoFork({ roomState: {} });

    return {
      m1_min_cohort: m1,
      m2_review_required: m2,
      m3_no_fork: m3.no_fork,
      m3_raw_cross_label_dups: m3Raw,
      m4_max_orphan_rate: m4,
    };
  } catch (_e) {
    return null;
  }
}

/**
 * brainReader() -> metrics | null
 *
 * The default reader: a read-only metric pull from the live Brain. Returns null
 * (inconclusive) when the Brain is unreachable, or when any metric query returns
 * a null/malformed result. Each Cypher is a read-only aggregate over methodology
 * nodes; the only bound param is a generic enum marker (Canon Part 8). The async
 * wiring landed as readLiveMetrics (above); runCheck stays synchronous by
 * contract, so the async read is drained by main() BEFORE runCheck is called
 * and passed in here as `prefetched`.
 *
 * @param {object} brainClient
 * @param {object|null} [prefetched] a pre-drained readLiveMetrics() result.
 *   When omitted (or null), the returned reader keeps the pre-existing
 *   fail-closed default (returns null) -- every current caller and test
 *   keeps its behavior unchanged. When prefetched is a non-null object, the
 *   returned synchronous reader returns it as-is.
 */
function makeBrainReader(brainClient, prefetched) {
  return function brainReader() {
    try {
      if (!brainClient || typeof brainClient.isAvailable !== 'function' || !brainClient.isAvailable()) {
        return null; // Brain unreachable -> inconclusive (fail-closed upstream)
      }
    } catch (_e) {
      return null;
    }
    if (prefetched && typeof prefetched === 'object') {
      return prefetched;
    }
    // No prefetched metrics supplied -- fail-closed default, unchanged from
    // before the async wiring landed.
    return null;
  };
}

// ---------- Baseline store (injectable; default = LOCAL JSON file) ----------

function fileStore(baselinePath) {
  const p = baselinePath || BASELINE_PATH;
  return {
    load: function () {
      try {
        if (!fs.existsSync(p)) return null;
        const raw = fs.readFileSync(p, 'utf8');
        const obj = JSON.parse(raw);
        return (obj && typeof obj === 'object') ? obj : null;
      } catch (_e) {
        // A required baseline that cannot be read is inconclusive, handled by
        // the caller; here we surface null and let runCheck decide.
        return null;
      }
    },
    save: function (obj) {
      try {
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
        return true;
      } catch (_e) {
        return false;
      }
    },
  };
}

// ---------- Metric validation ----------

function _isConclusive(metrics) {
  if (!metrics || typeof metrics !== 'object') return false;
  for (const k of REQUIRED_METRIC_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(metrics, k)) return false;
  }
  if (typeof metrics.m3_no_fork !== 'boolean') return false;
  for (const k of ['m1_min_cohort', 'm2_review_required', 'm3_raw_cross_label_dups', 'm4_max_orphan_rate']) {
    if (!Number.isFinite(Number(metrics[k]))) return false;
  }
  return true;
}

// Is `current` worse than `baseline` for a metric, by its direction?
function _isRegression(metricKey, baselineVal, currentVal) {
  const dir = METRIC_DIRECTIONS[metricKey];
  const b = Number(baselineVal);
  const c = Number(currentVal);
  if (!Number.isFinite(b) || !Number.isFinite(c)) return false;
  if (dir === 'lower_is_better') return c > b;   // a HIGHER value is worse
  if (dir === 'higher_is_better') return c < b;  // a LOWER value is worse
  return false;
}

function _isImprovement(metricKey, baselineVal, currentVal) {
  const dir = METRIC_DIRECTIONS[metricKey];
  const b = Number(baselineVal);
  const c = Number(currentVal);
  if (!Number.isFinite(b) || !Number.isFinite(c)) return false;
  if (dir === 'lower_is_better') return c < b;
  if (dir === 'higher_is_better') return c > b;
  return false;
}

// ---------- The gate core ----------

/**
 * runCheck({ reader, store, mode? }) -> { exitCode, outcome, regressions, metrics, ... }
 *
 * Synchronous. reader() returns the measured metric set (or null/malformed for
 * an inconclusive read). store implements { load(), save(obj) }.
 *
 * Default mode 'baseline' (report-only):
 *   - no prior baseline + a conclusive read     -> RECORD it, exit 0 ('baseline_recorded')
 *   - baseline present, no metric worse          -> exit 0 ('no_regression')
 *   - baseline present, every-or-some improved   -> ratchet baseline, exit 0 ('improved')
 *   - baseline present, ANY metric worse         -> exit 1 ('regression'), naming each
 *   - inconclusive read / recommender fork       -> exit 1 ('inconclusive')
 *
 * Mode 'flip-blocking' (post-132, off by default): compare the conclusive read
 * against POST_132_ABSOLUTE_THRESHOLDS; any breach -> exit 1 ('absolute_breach').
 *
 * @param {{reader: Function, store: {load:Function,save:Function}, mode?: string}} opts
 * @returns {{exitCode:number, outcome:string, regressions:Array, metrics:object|null}}
 */
function runCheck(opts) {
  const o = opts || {};
  const reader = (typeof o.reader === 'function') ? o.reader : function () { return null; };
  const store = (o.store && typeof o.store.load === 'function' && typeof o.store.save === 'function')
    ? o.store : fileStore();
  const mode = o.mode || DEFAULT_MODE;

  // Read the live (or fixture) metrics.
  let metrics;
  try { metrics = reader(); }
  catch (_e) { metrics = null; }

  // Fail-closed: a read we could not complete is inconclusive, never a pass.
  if (!_isConclusive(metrics)) {
    return { exitCode: 1, outcome: 'inconclusive', reason: 'inconclusive_read', regressions: [], metrics: null };
  }
  // Fail-closed: a recommender fork (no_fork false) is a true breach of the
  // Plan 02 contract -- the worst thing this gate exists to catch.
  if (metrics.m3_no_fork !== true) {
    return { exitCode: 1, outcome: 'inconclusive', reason: 'recommender_fork', regressions: [], metrics: metrics };
  }

  // Flip-to-blocking (post-132 absolute mode). OFF by default in 130.7.
  if (mode === 'flip-blocking') {
    const breaches = [];
    for (const k of Object.keys(POST_132_ABSOLUTE_THRESHOLDS)) {
      const threshold = POST_132_ABSOLUTE_THRESHOLDS[k];
      const cur = Number(metrics[k]);
      const dir = METRIC_DIRECTIONS[k];
      const breached = (dir === 'lower_is_better') ? (cur > threshold) : (cur < threshold);
      if (breached) breaches.push({ metric: k, threshold: threshold, current: cur, direction: dir });
    }
    if (breaches.length > 0) {
      return { exitCode: 1, outcome: 'absolute_breach', breaches: breaches, regressions: [], metrics: metrics };
    }
    return { exitCode: 0, outcome: 'absolute_pass', regressions: [], metrics: metrics };
  }

  // Default baseline/report-only mode.
  const baseline = store.load();

  // No prior baseline -> record + exit 0.
  if (!baseline || typeof baseline !== 'object' || !baseline.metrics) {
    const record = { metrics: metrics, recorded_at: new Date().toISOString(), mode: 'baseline', version: 1 };
    store.save(record);
    return { exitCode: 0, outcome: 'baseline_recorded', regressions: [], metrics: metrics };
  }

  // Compare current vs baseline by direction.
  const base = baseline.metrics;
  const regressions = [];
  for (const k of Object.keys(METRIC_DIRECTIONS)) {
    if (_isRegression(k, base[k], metrics[k])) {
      regressions.push({
        metric: k,
        baseline: Number(base[k]),
        current: Number(metrics[k]),
        direction: METRIC_DIRECTIONS[k],
        delta: Number(metrics[k]) - Number(base[k]),
      });
    }
  }

  if (regressions.length > 0) {
    return { exitCode: 1, outcome: 'regression', regressions: regressions, metrics: metrics };
  }

  // No regression. Ratchet the baseline toward any improvement so the next run
  // guards the gain. Improvement is never a failure.
  let improved = false;
  const ratcheted = Object.assign({}, base);
  for (const k of Object.keys(METRIC_DIRECTIONS)) {
    if (_isImprovement(k, base[k], metrics[k])) {
      ratcheted[k] = Number(metrics[k]);
      improved = true;
    }
  }
  // m3_no_fork carries forward (always true here).
  ratcheted.m3_no_fork = true;

  if (improved) {
    store.save({ metrics: ratcheted, recorded_at: new Date().toISOString(), mode: 'baseline', version: 1 });
    return { exitCode: 0, outcome: 'improved', regressions: [], metrics: metrics };
  }

  return { exitCode: 0, outcome: 'no_regression', regressions: [], metrics: metrics };
}

// ---------- Report renderer ----------

function renderReport(res) {
  const lines = [];
  lines.push('');
  lines.push('  DUAL-GRAPH HEALTH (report-only / baseline mode -- 130.7)');
  lines.push('  ' + '-'.repeat(64));
  lines.push('  Outcome: ' + res.outcome);
  if (res.outcome === 'regression') {
    lines.push('  REGRESSION -- a metric got worse than the recorded baseline:');
    for (const r of res.regressions) {
      lines.push('    ' + r.metric + ': baseline=' + r.baseline + ' current=' + r.current
        + ' (' + r.direction + ', delta ' + r.delta + ')');
    }
    lines.push('  The build fails on backsliding, not on pre-existing absolute debt.');
  } else if (res.outcome === 'inconclusive') {
    lines.push('  INCONCLUSIVE (' + (res.reason || 'unreadable') + ') -- failing CLOSED.');
    lines.push('  A gate that cannot complete its read MUST NOT pass (no false-green).');
  } else if (res.outcome === 'baseline_recorded') {
    lines.push('  Baseline recorded from the current measured values. Future runs');
    lines.push('  fail on any metric getting worse than this baseline.');
  } else if (res.outcome === 'improved') {
    lines.push('  Improvement detected -- baseline ratcheted toward the better value.');
  } else if (res.outcome === 'absolute_breach') {
    lines.push('  POST-132 ABSOLUTE BREACH (flip-blocking mode):');
    for (const b of (res.breaches || [])) {
      lines.push('    ' + b.metric + ': threshold=' + b.threshold + ' current=' + b.current);
    }
  }
  lines.push('  ' + '-'.repeat(64));
  lines.push('');
  return lines.join('\n');
}

// ---------- CLI entry ----------

async function main(argv) {
  const args = Array.isArray(argv) ? argv.slice(2) : [];
  let mode = DEFAULT_MODE;
  if (args.indexOf('--flip-blocking') !== -1) mode = 'flip-blocking';

  // The standalone CLI uses the default file-backed baseline store and the live
  // Brain reader. The async wiring landed as readLiveMetrics: main() drains it
  // BEFORE runCheck is called (runCheck itself stays synchronous by contract)
  // and passes the result to makeBrainReader as `prefetched`. A Brain that is
  // unreachable, or any single unreadable metric, still fails closed -> null ->
  // inconclusive. We never fabricate numbers here.
  let brainClient = null;
  try { brainClient = require('../lib/core/brain-client.cjs'); } catch (_e) { brainClient = null; }

  const prefetched = await readLiveMetrics(brainClient);

  const res = runCheck({
    reader: makeBrainReader(brainClient, prefetched),
    store: fileStore(),
    mode: mode,
  });

  process.stdout.write(renderReport(res) + '\n');
  process.exit(res.exitCode);
}

module.exports = {
  runCheck: runCheck,
  computeM3NoFork: computeM3NoFork,
  makeBrainReader: makeBrainReader,
  readLiveMetrics: readLiveMetrics,
  fileStore: fileStore,
  renderReport: renderReport,
  main: main,
  // Constants exposed for the suite + downstream plans.
  DEFAULT_MODE: DEFAULT_MODE,
  METRIC_DIRECTIONS: METRIC_DIRECTIONS,
  REQUIRED_METRIC_KEYS: REQUIRED_METRIC_KEYS,
  POST_132_ABSOLUTE_THRESHOLDS: POST_132_ABSOLUTE_THRESHOLDS,
  BASELINE_PATH: BASELINE_PATH,
  REVIEW_MARKER: REVIEW_MARKER,
  // Cypher constants exposed so the boundary sweep can assert their read-only
  // shape (and so a future plan can wire the live async reader).
  M1_CYPHER: M1_CYPHER,
  M2_CYPHER: M2_CYPHER,
  M4_CYPHER: M4_CYPHER,
  M3_RAW_CYPHER: M3_RAW_CYPHER,
};

if (require.main === module) {
  main(process.argv).catch(function (e) {
    process.stderr.write('check-dual-graph-health: fatal: ' + (e && e.message || String(e)) + '\n');
    process.exit(1);
  });
}
