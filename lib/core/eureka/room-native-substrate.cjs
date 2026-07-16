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

// The closed 3-member entity node-type set. Byte-matches
// lib/core/navigation/typed-entity.cjs ENTITY_NODE_TYPES WITHOUT requiring that
// navigation submodule into this eureka leaf (the same reuse-by-byte-match
// posture opportunity-statement.cjs DIMS takes toward ahp-weights: a leaf module
// mirrors a frozen enum rather than importing the writer that owns it). An entity
// node is identified by a props.entityType in this set (writeEntityNode always
// stamps it), never by row.type (the sectionFor hard rule).
const ENTITY_NODE_TYPES = Object.freeze(new Set(['company', 'technology', 'market']));

// The provenance edge an entity node uses to point at its source memory_artifact
// (typed-entity.cjs: DESCRIBES source=entityId target=memory_artifact). This is
// the ALREADY-SHIPPED linkage the section-inheritance fix reuses; NO new edge.
const ENTITY_DESCRIBES_EDGE = 'DESCRIBES';

// entityTypeOf(props) -> the entity node's entityType label ('company' /
// 'technology' / 'market') when this is a typed entity node, else null. Reads
// props.entityType ONLY (never row.type -- the same hard rule sectionFor honors):
// writeEntityNode always stamps entityType into the props bag.
function entityTypeOf(props) {
  const et = (props && typeof props.entityType === 'string') ? props.entityType.trim() : '';
  return ENTITY_NODE_TYPES.has(et) ? et : null;
}

// sectionFor(row, props) -> the tech's `section` field: a real domain label or
// the honest string 'unknown' (216-05 field contract).
//
// HARD RULE: this derivation must NEVER read row.type. The ICM schema type
// column ('Section', 'Artifact', 'memory_event', 'Claim') is a node TYPE, not
// a domain; it is the exact value that leaked into user prose as
// 'a Section x Section cross-domain bridge' (the 216-04 gap, navigator verdict
// 2026-07-10). The SELECT still reads type for the injected canonicalId; only
// the section derivation stops consuming it.
//
// The chain:
//   1. props.section - Artifact nodes and post-Phase-162 Section anchors carry
//      the real slug here.
//   2. Else the source_path first path segment, when source_path is a
//      non-empty string containing NO ':' character. room.db source_path is
//      the room-relative artifact path whose first segment IS the section
//      folder slug ('business-model/2026-05-26-investor-meeting-prep-eran'
//      derives 'business-model'), and a pre-162-vintage Section anchor's
//      source_path is the bare slug itself ('business-model'). The ':'
//      exclusion keeps system-authored rows out ('system:section-anchor',
//      'system:default') so they fall through honestly. Known edge: a
//      root-level artifact with no '/' and no ':' derives its bare filename
//      as the section (accepted; no such row exists in a normal room layout).
//   3. Else the literal 'unknown' - the SAME honest default the scorer already
//      uses (eureka-portfolio-report.cjs techFor and loadGraph; the 215
//      precedent).
function sectionFor(row, props) {
  const propSection = trimmedString(props.section);
  if (propSection) return propSection;
  const sp = row && row.source_path;
  if (typeof sp === 'string' && sp && sp.indexOf(':') === -1) {
    const slash = sp.indexOf('/');
    const first = (slash === -1 ? sp : sp.slice(0, slash)).trim();
    if (first) return first;
  }
  return 'unknown';
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
  // canonical id -> entityType, for every entity node (company/technology/market).
  // Feeds the entity-node section-inheritance fixup after the techMap is built.
  const entityCanonType = new Map();
  for (let i = 0; i < nodeRows.length; i += 1) {
    const row = nodeRows[i];
    const props = parseProps(row);
    const canon = rawToCanonical.get(row.id);
    const deg = degree.get(canon) || 0;
    const entityType = entityTypeOf(props);
    if (entityType) entityCanonType.set(canon, entityType);

    // Phase 218 fix (T-218-VD, live-verify follow-on): entity nodes
    // (company/technology/market, lib/core/navigation/typed-entity.cjs)
    // carry their identifying string in props.name, not props.title or
    // props.text. Without this fallback the ranked report's a_title/b_title
    // and opportunity-statement text fell back to the raw hashed node id
    // ("entity:entity-extract:7d0acf8a") instead of the real name ("Sabra")
    // -- readable to nothing and nobody, even after the ranking itself
    // correctly surfaced the pair. tri-modal-index.cjs::nodeText already
    // checks props.name first for the embedding text; this mirrors that
    // precedent so the two text-extraction paths agree. Checked AFTER an
    // explicit props.title (never override an intentional title) and BEFORE
    // props.text (a short identifying name beats a long prose excerpt).
    let title = canon;
    const propTitle = trimmedString(props.title);
    const propName = trimmedString(props.name);
    if (propTitle) {
      title = propTitle;
    } else if (propName) {
      title = propName;
    } else if (typeof props.text === 'string' && props.text.trim()) {
      title = props.text.slice(0, 60);
    }

    const section = sectionFor(row, props);

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

  // (6b) Entity-node section inheritance (Phase 219 upstream-metadata fix, the
  // direct sibling of the props.name title fix above). An entity node
  // (company/technology/market, typed-entity.cjs) structurally carries NO
  // section/problem content -- only {name, entityType, evidenceTier} -- so
  // sectionFor returned the literal 'unknown', which surfaced as the
  // "unknown x unknown" text in every entity-entity opportunity statement (Phase
  // 218 half-wired only the title slot for this node class). Reusing the
  // ALREADY-SHIPPED DESCRIBES edge (typed-entity.cjs; entity=source,
  // memory_artifact=target, which carries props.section):
  //   (1) inherit section (+ any present primary_problem/problems) from the
  //       entity's DESCRIBES source artifact's techMap entry.
  //   (2) fallback, for an entity with no usable DESCRIBES source (missing edge,
  //       or an artifact whose OWN section is still 'unknown'): derive section
  //       from entityType (company/technology/market is a real present label)
  //       instead of 'unknown'.
  // Pure composition over edges + node props already in room.db; zero new engine,
  // zero egress (Canon Part 7 / Part 8).
  if (entityCanonType.size > 0) {
    // Map each entity canon -> its DESCRIBES source memory_artifact canon,
    // preferring a target whose techMap section is REAL over one still 'unknown'.
    const describesTarget = new Map();
    for (let i = 0; i < edgeRows.length; i += 1) {
      const e = edgeRows[i];
      if (e.type !== ENTITY_DESCRIBES_EDGE) continue;
      const srcCanon = rawToCanonical.has(e.source) ? rawToCanonical.get(e.source) : null;
      if (srcCanon == null || !entityCanonType.has(srcCanon)) continue;
      const tgtCanon = rawToCanonical.has(e.target) ? rawToCanonical.get(e.target) : null;
      if (tgtCanon == null) continue;
      const prev = describesTarget.get(srcCanon);
      if (prev === undefined) {
        describesTarget.set(srcCanon, tgtCanon);
      } else {
        const prevArt = techMap.get(prev);
        const prevReal = !!(prevArt && prevArt.section && prevArt.section !== 'unknown');
        const thisArt = techMap.get(tgtCanon);
        const thisReal = !!(thisArt && thisArt.section && thisArt.section !== 'unknown');
        if (thisReal && !prevReal) describesTarget.set(srcCanon, tgtCanon);
      }
    }
    entityCanonType.forEach(function (entityType, canon) {
      const tech = techMap.get(canon);
      if (!tech || (tech.section && tech.section !== 'unknown')) return;
      const tgtCanon = describesTarget.get(canon);
      const artifact = (tgtCanon != null) ? techMap.get(tgtCanon) : null;
      if (artifact && artifact.section && artifact.section !== 'unknown') {
        tech.section = artifact.section; // (1) inherit the real domain
        if (!tech.primary_problem && artifact.primary_problem) {
          tech.primary_problem = artifact.primary_problem;
        }
        if ((!Array.isArray(tech.problems) || tech.problems.length === 0)
          && Array.isArray(artifact.problems) && artifact.problems.length > 0) {
          tech.problems = artifact.problems.slice();
        }
      } else {
        tech.section = entityType; // (2) entityType fallback, never 'unknown'
      }
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
    // Carry the forming edge's type so a downstream entity-entity bridge label
    // can name the real relation (COMPETES_WITH / USES_COMPONENT / SUPPLIES_TO)
    // instead of the generic "cross-domain bridge" (Phase 219 fix 3). Scalar
    // enum only, never prose (Part 8).
    const edgeType = (typeof e.type === 'string' && e.type) ? e.type : null;
    convergesPairs.push({ a: a, b: b, shared_problems: shared, edge_type: edgeType });
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
    entityTypeOf: entityTypeOf,
    ENTITY_NODE_TYPES: ENTITY_NODE_TYPES,
  },
};
