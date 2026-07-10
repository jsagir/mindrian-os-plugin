'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 216-01 -- room-native-substrate: the adapter that lets the SHIPPED Eureka
 * portfolio engines compose against a NORMAL MindrianOS room, with NO CSV-derived
 * idea-graph.json on disk (D-01, the navigator directive in 216-CONTEXT.md).
 *
 * WHAT IT IS (Canon Part 7 - composition, ZERO new engine):
 *   buildRoomNativeSubstrate(db, opts) reads room.db nodes + typed edges directly
 *   and returns the byte-level analog of loadGraph()'s return in
 *   scripts/eureka-portfolio-report.cjs: { meta, techMap, convergesPairs }. The
 *   same ahp-weights / portfolio-dimensions / tail-quadrant / opportunity-statement
 *   modules the shipped runner already composes consume this shape UNCHANGED. This
 *   is the room-native pair-and-signal source; it does NOT delegate to the plain
 *   211 eureka-room-report.cjs (that path was explicitly REJECTED at the gate).
 *
 * D-01 SIGNAL MAPPING (attention = degree, growth = created_at recency):
 *   - attention: every tech's pair_count (and its mirror degree) is its room-graph
 *     node degree - how many typed edges cite it. This is the room-native analog
 *     of the idea-graph edge_count that the shipped percentileRank attention axis
 *     already reads.
 *   - growth: every tech's cnumber is String(epochSeconds(created_at)). main()
 *     computes the tail growth axis as percentileRank(cnumberNumeric(cnumber)), and
 *     cnumberNumeric strips an optional leading C then parseInts. An epoch-seconds
 *     string therefore flows created_at recency ordering through the SHIPPED axis
 *     with ZERO runner math changes (a newer node yields a strictly larger integer).
 *
 * GRACEFUL-DEGRADATION POSTURE (D-01 consequence): the adapter never lowers or
 * overrides the shipped MIN_COHORT=30 tail floor and adds no recalibration knob -
 * a tens-of-entries room degrades to the honest insufficient_structure verdict
 * through the SAME classifier, because threshold changes are UNCALIBRATED territory
 * owned by a later 202-APO pass (216-RESEARCH.md).
 *
 * OWNERSHIP + BOUNDARY:
 *   - The CALLER owns the db handle (opens via openRoomDb, closes it) - this module
 *     neither opens nor closes it (the tail-quadrant caller-owns-data-access rule).
 *   - opts.canonicalId is an INJECTED function (row) => id, defaulting to row.id.
 *     The runner passes its own catalogId here. It is injected, never imported, so
 *     this module never requires the runner (that would be a require cycle once the
 *     runner requires this module in Plan 02).
 *   - Canon Part 8: node built-ins only, zero network, zero require of any transport.
 *   - Part 3 tampering guard: user-authored node/edge JSON is parsed defensively;
 *     a malformed property blob never aborts the substrate build.
 *
 * No em-dashes anywhere (project convention).
 */

// epochSeconds: created_at (an ISO-8601 string) -> integer seconds since epoch, or
// 0 when the value is absent or unparseable. Number.isFinite guards a NaN from
// Date.parse so a bad timestamp degrades to 0 rather than poisoning the axis.
function epochSeconds(v) {
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

// parseProps: JSON.parse the row's properties column inside try/catch, returning
// {} on any failure (malformed JSON, null, non-object). Works for both node rows
// and edge rows (both carry a `properties` TEXT column).
function parseProps(row) {
  try {
    const p = JSON.parse(row && row.properties);
    return (p && typeof p === 'object') ? p : {};
  } catch (_e) {
    return {};
  }
}

// degreeMap: one O(edges) pass counting appearances of each CANONICAL id across
// both the source and target columns. Every typed edge is a citation by the room's
// own hand (the room-native analog of the idea-graph edge_count). When two raw ids
// map to one canonical id their degrees sum. An endpoint with no known node row
// falls back to its raw id (it will not collide with any techMap key).
function degreeMap(edgeRows, rawToCanonical) {
  const degree = new Map();
  const bump = function (id) {
    if (id == null) return;
    degree.set(id, (degree.get(id) || 0) + 1);
  };
  for (let i = 0; i < edgeRows.length; i += 1) {
    const e = edgeRows[i];
    const cs = (rawToCanonical && rawToCanonical.has(e.source)) ? rawToCanonical.get(e.source) : e.source;
    const ct = (rawToCanonical && rawToCanonical.has(e.target)) ? rawToCanonical.get(e.target) : e.target;
    bump(cs);
    bump(ct);
  }
  return degree;
}

function trimmedString(v) {
  return (typeof v === 'string' && v.trim()) ? v : null;
}

// buildRoomNativeSubstrate(db, opts) -> { meta, techMap, convergesPairs }.
// The exact loadGraph() return shape, sourced from room.db alone.
function buildRoomNativeSubstrate(db, opts) {
  const canonicalId = (opts && typeof opts.canonicalId === 'function')
    ? opts.canonicalId
    : function (row) { return row.id; };

  // (1) Read nodes.
  const nodeRows = db.prepare('SELECT id, type, properties, source_path, created_at FROM nodes').all();

  // (2) Read edges. An older room may predate the edges table: catch the prepare
  // error and treat as zero edges. Never throw.
  let edgeRows = [];
  try {
    edgeRows = db.prepare('SELECT source, target, type, properties FROM edges').all();
  } catch (_e) {
    edgeRows = [];
  }

  // (5, part) raw id -> canonical id, built from the nodes pass.
  const rawToCanonical = new Map();
  for (let i = 0; i < nodeRows.length; i += 1) {
    rawToCanonical.set(nodeRows[i].id, canonicalId(nodeRows[i]));
  }

  // (4) Degree per canonical id over ALL typed edges (the attention axis).
  const degree = degreeMap(edgeRows, rawToCanonical);

  // (6) One techMap entry per node, keyed by canonical id (last write wins on a
  // canonical-id collision, the runner's documented precedent), carrying EXACTLY
  // the nine-field loadGraph/techFor contract.
  const techMap = new Map();
  for (let i = 0; i < nodeRows.length; i += 1) {
    const row = nodeRows[i];
    const props = parseProps(row);
    const canon = rawToCanonical.get(row.id);
    const deg = degree.get(canon) || 0;

    let title = canon;
    const propTitle = trimmedString(props.title);
    if (propTitle) {
      title = propTitle;
    } else if (typeof props.text === 'string' && props.text.trim()) {
      title = props.text.slice(0, 60);
    }

    let section = 'unknown';
    const propSection = trimmedString(props.section);
    if (propSection) {
      section = propSection;
    } else if (trimmedString(row.type)) {
      section = row.type;
    }

    techMap.set(canon, {
      id: canon,
      cnumber: String(epochSeconds(row.created_at)),
      title: title,
      primary_tier: undefined,
      pair_count: deg,
      degree: deg,
      section: section,
      primary_problem: trimmedString(props.primary_problem) || '',
      problems: Array.isArray(props.problems) ? props.problems : [],
    });
  }

  // (7) convergesPairs from edges: translate both endpoints into canonical space,
  // skip a self-edge or an endpoint with no node row, dedupe on the unordered key
  // (the loadGraph seen-set idiom).
  const seen = new Set();
  const convergesPairs = [];
  for (let i = 0; i < edgeRows.length; i += 1) {
    const e = edgeRows[i];
    const a = rawToCanonical.has(e.source) ? rawToCanonical.get(e.source) : null;
    const b = rawToCanonical.has(e.target) ? rawToCanonical.get(e.target) : null;
    if (a == null || b == null) continue; // endpoint has no node row
    if (a === b) continue; // self-edge after canonical translation
    const key = a < b ? a + ':' + b : b + ':' + a;
    if (seen.has(key)) continue;
    seen.add(key);
    const eprops = parseProps(e);
    const shared = Array.isArray(eprops.shared_problems)
      ? eprops.shared_problems.filter(function (x) { return typeof x === 'string' && x.trim(); })
      : [];
    convergesPairs.push({ a: a, b: b, shared_problems: shared });
  }

  // (8) meta: honest counts read at run time, never a frozen literal.
  const nodesRead = nodeRows.length;
  const edgesRead = edgeRows.length;
  const meta = {
    source: 'room-native',
    honest_nouns: 'room-native substrate: ' + nodesRead + ' nodes, ' + edgesRead + ' typed edges read from room.db',
    nodes_read: nodesRead,
    edges_read: edgesRead,
  };

  return { meta: meta, techMap: techMap, convergesPairs: convergesPairs };
}

// (9) Exports + the house _test seam.
module.exports = {
  buildRoomNativeSubstrate: buildRoomNativeSubstrate,
  _test: {
    epochSeconds: epochSeconds,
    parseProps: parseProps,
    degreeMap: degreeMap,
  },
};
