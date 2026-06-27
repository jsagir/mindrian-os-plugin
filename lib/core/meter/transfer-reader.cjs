'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 183-02 METER-02 -- the Gauge-2 SOURCE: three NAMED-DEBT transfer proxies.
 * ============================================================================
 * HONESTY HEADER (Canon Part 5 / Appendix D entries 28 + 31). None of the three
 * readers below is a real transfer DELTA. A real transfer measurement is a
 * novel-problem-solving delta against a DEFINED baseline (a thing METER cannot
 * produce -- there is no RCT here). These three are NAMED-DEBT proxies: they are
 * the INSTRUMENT (the Gauge-2 SOURCE) that Phase 184 READER's R1 A/B test and a
 * future real measurement consume, NOT a finished transfer measurement. An
 * engagement / capture / latency / independence proxy that masquerades as a
 * transfer delta is a canon breach (Part 5). So every reader stamps its return
 * with proxy_class: 'named-debt', and this module NEVER claims to "measure
 * transfer" -- it instruments the Gauge-2 source.
 *
 *   rejectReasonCaptureRate(db, sinceEpochMs, roomState)
 *     -> { reject_total, reject_with_reason, capture_rate, proxy_class:'named-debt' }
 *   insightToDecisionLatency / insightToValidatedDecisionLatency(db, sinceEpochMs, roomState)
 *     -> { sample_count, median_latency_ms, proxy_class:'named-debt' }
 *   independenceTrend(db, sinceEpochMs, roomState)
 *     -> { direction, delta, proxy_class:'named-debt', caveat }
 *
 * Contract (mirrors lib/workflow/reach-reject-reader.cjs + the Plan-01
 * gate-density-reader.cjs verbatim in shape):
 *   - Opens NO db (caller-owned handle). Makes NO remote / Brain call; reads ONLY
 *     via navigation.findRecentChanges (the Part 9 chokepoint). Canon Part 8:
 *     enum/scalar reads only; the run-all-183.sh grep-sweep proves zero network
 *     surface here.
 *   - rejectReasonCaptureRate reads the PRESENCE/absence of the reject reason field
 *     (properties.reason) ONLY -- the reason STRING is NEVER echoed into a returned
 *     field (Part 8 / T-183-02). Decision 13 "rejection is data": a captured reason
 *     is a data-quality signal on the instrument, NOT a transfer quality delta.
 *   - Prefers the roomState injection seam so the floor tests run db-free.
 *   - Returns a cold-start object (capture_rate null / sample_count 0 / direction
 *     flat) on a null db / read fault; NEVER throws, NEVER divides by zero.
 *
 * Production note (honest): f_selector_decision is not yet written from the dial in
 * production (ROADMAP:2846), so the reject-capture denominator cold-starts
 * structurally EMPTY on most rooms today. That is the correct and honest reading,
 * NOT a fault -- and it is exactly why the welded read (two-gauge.cjs) reports a
 * transfer_uninstrumented state distinct from a flat reading.
 *
 * House rule: hyphens only, no em-dashes.
 */

const navigation = require('../navigation.cjs');

const READ_LIMIT = 1000;
const PROXY_CLASS = 'named-debt';

// Insight events the latency proxy pairs FROM (the insight surfaced) to the next
// status_promoted (the human-confirmed validated decision, Part 9 role 5 -- the
// canonical latency end-event per Open Question 3).
const INSIGHT_EVENT_TYPES = Object.freeze(['reach_presented', 'auto_explore_finding_surfaced']);
const VALIDATED_DECISION_EVENT = 'status_promoted';

// Injection seam: returns roomState[key] when it is a finite number (the db-free
// test path), else null so the db read path runs. Mirrors the
// reach-reject-reader.cjs::_injected pre-computed-counter guard.
function _injectedNumber(roomState, key) {
  if (roomState
      && typeof roomState[key] === 'number'
      && Number.isFinite(roomState[key])) {
    return roomState[key];
  }
  return null;
}

// Read memory_event rows of one eventType via the Part 9 chokepoint. Returns [] on a
// null db or any read fault (never throws). Enum/scalar read only.
function _read(db, sinceEpochMs, eventType) {
  if (!db) return [];
  let rows;
  try {
    rows = navigation.findRecentChanges(db, sinceEpochMs || 0, {
      eventType: eventType,
      limit: READ_LIMIT,
    });
  } catch (_err) {
    return [];
  }
  return Array.isArray(rows) ? rows : [];
}

// A f_selector_decision row is a REJECT only when decision === 'reject' OR
// edge_semantic === 'REJECTED' (mirror reach-reject-reader.cjs::_isRejectRow). Read
// enums ONLY.
function _isRejectRow(props) {
  if (!props || typeof props !== 'object') return false;
  return props.decision === 'reject' || props.edge_semantic === 'REJECTED';
}

// Presence check on the reject reason field. Reads whether properties.reason is a
// non-empty string -- NEVER the value. The local var is named `val` (not `reason`)
// precisely so the source carries no `reason ===` / `reason !==` echo of the value
// into any returned field (Part 8 / T-183-02). Capture-rate reads presence only.
function _hasReason(props) {
  if (!props || typeof props !== 'object') return false;
  const val = props.reason; // reads properties.reason for PRESENCE only
  return typeof val === 'string' && val.trim().length > 0;
}

// ---------------------------------------------------------------------------
// rejectReasonCaptureRate(db, sinceEpochMs, roomState)
//   -> { reject_total, reject_with_reason, capture_rate, proxy_class:'named-debt' }
//
// capture_rate = COUNT(reject AND reason present) / COUNT(reject), or null on zero
// reject rows (cold-start; NEVER a divide-by-zero, NEVER a throw). NAMED-DEBT: a
// data-quality signal on the transfer instrument (does the navigator capture WHY on
// a reject -- Decision 13 / Part 4 REJECTED_BECAUSE), NOT a transfer delta.
// ---------------------------------------------------------------------------
function rejectReasonCaptureRate(db, sinceEpochMs, roomState) {
  const injTotal = _injectedNumber(roomState, 'reject_total');
  const injWith = _injectedNumber(roomState, 'reject_with_reason');
  if (injTotal !== null && injWith !== null) {
    return {
      reject_total: injTotal,
      reject_with_reason: injWith,
      capture_rate: injTotal > 0 ? (injWith / injTotal) : null,
      proxy_class: PROXY_CLASS,
    };
  }

  const rows = _read(db, sinceEpochMs, 'f_selector_decision');
  let reject_total = 0;
  let reject_with_reason = 0;
  for (const row of rows) {
    const props = row && row.properties;
    if (_isRejectRow(props)) {
      reject_total += 1;
      if (_hasReason(props)) reject_with_reason += 1;
    }
  }
  return {
    reject_total: reject_total,
    reject_with_reason: reject_with_reason,
    capture_rate: reject_total > 0 ? (reject_with_reason / reject_total) : null,
    proxy_class: PROXY_CLASS,
  };
}

// ---------------------------------------------------------------------------
// insightToValidatedDecisionLatency(db, sinceEpochMs, roomState)
//   -> { sample_count, median_latency_ms, proxy_class:'named-debt' }
//
// Pairs each insight event createdAt (reach_presented / auto_explore_finding_surfaced)
// to the NEXT status_promoted createdAt strictly after it, and reports the median of
// those latencies. Cold-starts to sample_count 0 / median null when no pair exists.
// NAMED-DEBT: a SPEED proxy aligned with the JTBD core job ("compress time between
// insight and validated decision"), NOT a novel-problem-solving delta. A faster
// insight->decision loop is not itself transfer.
// ---------------------------------------------------------------------------
function insightToValidatedDecisionLatency(db, sinceEpochMs, roomState) {
  const injCount = _injectedNumber(roomState, 'latency_sample_count');
  const injMedian = _injectedNumber(roomState, 'latency_median_ms');
  if (injCount !== null) {
    return {
      sample_count: injCount,
      median_latency_ms: injCount > 0 && injMedian !== null ? injMedian : null,
      proxy_class: PROXY_CLASS,
    };
  }

  // Validated-decision timestamps, ascending.
  const decisions = _read(db, sinceEpochMs, VALIDATED_DECISION_EVENT)
    .map((r) => (r && typeof r.createdAt === 'number') ? r.createdAt : null)
    .filter((t) => t !== null)
    .sort((a, b) => a - b);

  // Insight timestamps, ascending.
  let insights = [];
  for (const et of INSIGHT_EVENT_TYPES) {
    for (const r of _read(db, sinceEpochMs, et)) {
      if (r && typeof r.createdAt === 'number') insights.push(r.createdAt);
    }
  }
  insights = insights.sort((a, b) => a - b);

  const latencies = [];
  for (const ins of insights) {
    // the next validated decision strictly after this insight.
    let next = null;
    for (const d of decisions) {
      if (d > ins) { next = d; break; }
    }
    if (next !== null) latencies.push(next - ins);
  }

  if (latencies.length === 0) {
    return { sample_count: 0, median_latency_ms: null, proxy_class: PROXY_CLASS };
  }
  latencies.sort((a, b) => a - b);
  const mid = Math.floor(latencies.length / 2);
  const median = latencies.length % 2 === 1
    ? latencies[mid]
    : (latencies[mid - 1] + latencies[mid]) / 2;
  return {
    sample_count: latencies.length,
    median_latency_ms: median,
    proxy_class: PROXY_CLASS,
  };
}

// Plan-contract alias: the artifacts list names this insightToValidatedDecisionLatency
// while the floor pin imports insightToDecisionLatency. Export BOTH names for the one
// reader so neither contract drifts.
const insightToDecisionLatency = insightToValidatedDecisionLatency;

// ---------------------------------------------------------------------------
// independenceTrend(db, sinceEpochMs, roomState)
//   -> { direction, delta, proxy_class:'named-debt', caveat }
//
// Per-cycle delta of the invocation-density basis (reach_presented + framework_invoked
// firings -- the same basis the Plan-01 gate-density-reader counts). The window is
// split at its time midpoint into an OLDER half and a NEWER half; delta = newer - older;
// direction is rising | falling | flat. Cold-starts to direction 'flat' / delta 0.
//
// AMBIGUITY FLAG (Part 5, explicit and load-bearing): the direction is NOT
// self-interpreting. Falling invocation density could mean the navigator INTERNALIZED
// the method (a transfer-like good signal) OR DISENGAGED (an anti-signal). These are
// un-disambiguable LOCALLY, so independenceTrend is reported as a trend scalar with the
// caveat string below and is NEVER read as a transfer delta on its own.
// ---------------------------------------------------------------------------
function independenceTrend(db, sinceEpochMs, roomState) {
  const CAVEAT = 'direction is not self-interpreting: falling density may mean the '
    + 'navigator internalized the method (transfer-like) OR disengaged (anti-signal); '
    + 'un-disambiguable locally -- never read as a transfer delta.';

  const injDelta = _injectedNumber(roomState, 'independence_delta');
  if (injDelta !== null) {
    return {
      direction: injDelta > 0 ? 'rising' : (injDelta < 0 ? 'falling' : 'flat'),
      delta: injDelta,
      proxy_class: PROXY_CLASS,
      caveat: CAVEAT,
    };
  }

  // Collect the invocation-basis firing timestamps across the window.
  let ts = [];
  for (const et of ['reach_presented', 'framework_invoked']) {
    for (const r of _read(db, sinceEpochMs, et)) {
      if (r && typeof r.createdAt === 'number') ts.push(r.createdAt);
    }
  }
  if (ts.length === 0) {
    return { direction: 'flat', delta: 0, proxy_class: PROXY_CLASS, caveat: CAVEAT };
  }
  ts = ts.sort((a, b) => a - b);
  const lo = ts[0];
  const hi = ts[ts.length - 1];
  const mid = lo + (hi - lo) / 2;
  let older = 0;
  let newer = 0;
  for (const t of ts) {
    if (t <= mid) older += 1; else newer += 1;
  }
  const delta = newer - older;
  return {
    direction: delta > 0 ? 'rising' : (delta < 0 ? 'falling' : 'flat'),
    delta: delta,
    proxy_class: PROXY_CLASS,
    caveat: CAVEAT,
  };
}

module.exports = {
  rejectReasonCaptureRate,
  insightToValidatedDecisionLatency,
  insightToDecisionLatency,
  independenceTrend,
  INSIGHT_EVENT_TYPES,
  VALIDATED_DECISION_EVENT,
};
