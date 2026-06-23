'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 172-10 Task 3 -- the LOCAL-projection chain recommender (Canon Part 11
 * R6 / INV-08 / INV-12).
 *
 * WHAT: ranks chain candidates (FEEDS_INTO / CHAINS / PREREQUISITE edges) off the
 * LOCAL orchestration projection (data/brain-orchestration-projection.json),
 * joined to the curated per-edge confidence in data/command-registry.json
 * curated_chains. suggest-next reaches for this to surface USEFUL next-step
 * frameworks with EARNED confidence.
 *
 * recommendChainCandidates() ranks SINGLE-edge candidates. recommendMultiHopChains()
 * (Plan 172-15) composes MULTI-HOP chain confidence MULTIPLICATIVELY along a path
 * (the SPFO verified Brain model: reduce(c=1.0, r | c * coalesce(r.confidence, 0.5)),
 * ordered by hops then composed-confidence DESC), carrying the per-hop `transform`
 * descriptors, so the Brain-OFF ranker mirrors the Brain-ON model exactly
 * (research/172-SPFO-CHAIN-MODEL-REFERENCE.md, Canon Part 11 R6 / INV-08 / INV-12).
 *
 * LOCAL-ONLY (INV-12 / R7): the recommender reads ONLY committed local files
 * (the projection + the registry) -- it makes ZERO Brain/network calls at rank
 * time. There is no brain-client require, no fetch, no http. The projection is a
 * Brain-DERIVED LOCAL cache (Canon Part 8 dual-role amendment); reading it opens
 * no wire.
 *
 * R6 ranking-deferral (Canon Part 11): the recommender SUPPLIES the curated
 * confidence and produces a confidence-ranked candidate set; the final surfaced
 * ORDERING of the eligible set is the Part-3 MAX_K ranker's job
 * (lib/workflow/f-selector-ranker.cjs rankForSelector). This module therefore
 * RE-EXPORTS the Part-3 MAX_K cap (never mints its own) and does NOT duplicate
 * rankForSelector -- CIRS supplies confidence, Part 3 orders.
 *
 * Part 8: the projection + curated_chains carry ONLY generic machinery metadata
 * (framework-name pairs + a scalar confidence); no user content is read or
 * emitted.
 */

const fs = require('node:fs');
const path = require('node:path');

// The Part-3 MAX_K surfaced-set budget. Re-exported (never re-minted) so the
// recommender defers to the ranker's row-budget cap (R6 ranking-deferral).
const { MAX_K } = require('./f-selector-ranker.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PROJECTION_PATH = path.join(REPO_ROOT, 'data', 'brain-orchestration-projection.json');
const REGISTRY_PATH = path.join(REPO_ROOT, 'data', 'command-registry.json');

// The closed chain-edge set in the projection (the curated_chains kinds). OPERATES
// and CROSS_DOMAIN_ANALOGUE are NOT chain candidates.
const CHAIN_EDGE_TYPES = Object.freeze({
  FEEDS_INTO: 'feeds_into',
  CHAINS: 'chain',
  PREREQUISITE: 'prerequisite',
});

// ---------------------------------------------------------------------------
// _readJsonLocal(p) -- read a committed LOCAL JSON file. Returns null on any
// failure so the recommender degrades (Tier-0 cold start) rather than throwing.
// Zero network (Part 8 / INV-12).
// ---------------------------------------------------------------------------
function _readJsonLocal(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// _stripFrameworkPrefix(nodeId) -- the projection edge endpoints are node ids
// like 'framework:S-Curve Analysis' or 'reach:brain_consult'. The curated_chains
// from/to are the bare framework name / reach id. Strip the kind prefix so the
// edge can join to its curated confidence entry. Returns { kind, name }.
// ---------------------------------------------------------------------------
function _splitNodeId(nodeId) {
  if (typeof nodeId !== 'string') return { kind: null, name: null };
  const idx = nodeId.indexOf(':');
  if (idx < 0) return { kind: null, name: nodeId };
  return { kind: nodeId.slice(0, idx), name: nodeId.slice(idx + 1) };
}

// ---------------------------------------------------------------------------
// _buildConfidenceIndex(curatedChains) -- index curated confidence by
// (kind, from, to) so a projection chain edge resolves its earned confidence.
// Key is `${kind}\n${from}\n${to}` (newline-joined: framework names contain
// spaces but never newlines, so the delimiter is collision-safe).
// ---------------------------------------------------------------------------
function _buildConfidenceIndex(curatedChains) {
  const index = new Map();
  const list = Array.isArray(curatedChains) ? curatedChains : [];
  for (const c of list) {
    if (!c || typeof c !== 'object') continue;
    if (typeof c.kind !== 'string') continue;
    if (typeof c.from !== 'string' || typeof c.to !== 'string') continue;
    const key = c.kind + '\n' + c.from + '\n' + c.to;
    index.set(key, typeof c.confidence === 'number' ? c.confidence : null);
  }
  return index;
}

// ---------------------------------------------------------------------------
// recommendChainCandidates(args) -- the rank surface.
//
//   args.projection     optional in-memory projection ({ nodes, edges }); when
//                       absent the committed LOCAL projection file is read.
//   args.curatedChains  optional in-memory curated_chains array; when absent the
//                       committed LOCAL command-registry curated_chains is read.
//   args.k              optional surfaced-set budget; clamped at MAX_K (R6
//                       ranking-deferral -- the Part-3 row budget). When absent,
//                       the full confidence-ranked candidate set is returned.
//
// Returns an array of chain candidates { kind, from, to, confidence }, ranked by
// curated confidence DESCENDING. ONLY chain-kind edges (FEEDS_INTO / CHAINS /
// PREREQUISITE) are candidates; OPERATES / CROSS_DOMAIN_ANALOGUE are ignored. An
// edge with no curated-confidence join is dropped (a chain candidate must carry
// EARNED confidence -- never a fabricated default, per R6). Local-Only: zero
// Brain/network at rank time (INV-12).
// ---------------------------------------------------------------------------
function recommendChainCandidates(args) {
  const o = (args && typeof args === 'object') ? args : {};

  const projection = (o.projection && typeof o.projection === 'object')
    ? o.projection
    : _readJsonLocal(PROJECTION_PATH);
  if (!projection || !Array.isArray(projection.edges)) return [];

  let curatedChains = o.curatedChains;
  if (!Array.isArray(curatedChains)) {
    const reg = _readJsonLocal(REGISTRY_PATH);
    curatedChains = reg && Array.isArray(reg.curated_chains) ? reg.curated_chains : [];
  }
  const confIndex = _buildConfidenceIndex(curatedChains);

  const candidates = [];
  for (const e of projection.edges) {
    if (!e || typeof e !== 'object') continue;
    const kind = CHAIN_EDGE_TYPES[e.type];
    if (!kind) continue; // not a chain-kind edge -> not a candidate

    const fromName = _splitNodeId(e.from).name;
    const toName = _splitNodeId(e.to).name;
    if (!fromName || !toName) continue;

    const key = kind + '\n' + fromName + '\n' + toName;
    const confidence = confIndex.has(key) ? confIndex.get(key) : null;
    // R6: a chain candidate must carry EARNED confidence; drop an edge with no
    // curated join rather than fabricate a uniform default.
    if (typeof confidence !== 'number') continue;

    candidates.push({ kind, from: fromName, to: toName, confidence });
  }

  // CIRS supplies confidence: rank candidates by curated confidence descending.
  // Stable secondary sort on from/to for byte-deterministic output across runs.
  candidates.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    if (a.from !== b.from) return a.from < b.from ? -1 : 1;
    return a.to < b.to ? -1 : (a.to > b.to ? 1 : 0);
  });

  // R6 ranking-deferral: clamp the surfaced view at the Part-3 MAX_K budget when
  // a budget is requested. The FINAL ordering of the eligible set is the Part-3
  // ranker's job; this is only the row-budget cap, not a competing ranker.
  if (typeof o.k === 'number' && o.k > 0) {
    const k = Math.min(Math.floor(o.k), MAX_K);
    return candidates.slice(0, k);
  }
  return candidates;
}

// The SPFO coalesce default for a missing per-edge confidence (the verified Brain
// model: `coalesce(r.confidence, 0.5)`). research/172-SPFO-CHAIN-MODEL-REFERENCE.md.
const COALESCE_CONFIDENCE = 0.5;

// ---------------------------------------------------------------------------
// _buildChainAdjacency(projection, confIndex) -- index the projection's chain-kind
// edges (FEEDS_INTO / CHAINS / PREREQUISITE) as an adjacency map keyed on the
// source framework name. Each adjacency record carries { to, kind, confidence,
// transform } where confidence/transform come FIRST from the edge itself (Task 1
// materializes {confidence, transform} onto the projection edge) and FALL BACK to
// the curated_chains join (confIndex) when the edge lacks them. A missing
// confidence is left undefined here; the composition coalesces it to 0.5.
// ---------------------------------------------------------------------------
function _buildChainAdjacency(projection, confIndex) {
  const adj = new Map();
  if (!projection || !Array.isArray(projection.edges)) return adj;
  for (const e of projection.edges) {
    if (!e || typeof e !== 'object') continue;
    const kind = CHAIN_EDGE_TYPES[e.type];
    if (!kind) continue; // not a chain-kind edge

    const fromName = _splitNodeId(e.from).name;
    const toName = _splitNodeId(e.to).name;
    if (!fromName || !toName) continue;

    // Confidence + transform: prefer the edge's own (Task 1), else the curated join.
    const key = kind + '\n' + fromName + '\n' + toName;
    const joined = confIndex && confIndex.has(key) ? confIndex.get(key) : null;
    let confidence;
    if (typeof e.confidence === 'number') confidence = e.confidence;
    else if (typeof joined === 'number') confidence = joined;
    // else: undefined -> coalesced to COALESCE_CONFIDENCE at composition time.

    let transform = null;
    if (typeof e.transform === 'string' && e.transform) transform = e.transform;

    if (!adj.has(fromName)) adj.set(fromName, []);
    adj.get(fromName).push({ to: toName, kind, confidence, transform });
  }
  return adj;
}

// ---------------------------------------------------------------------------
// recommendMultiHopChains(args) -- the MULTI-HOP composition surface (Plan 172-15,
// Canon Part 11 R6 / INV-08).
//
//   args.from        REQUIRED -- the seed framework name to walk chains FROM.
//   args.maxHops     optional hop ceiling (default 3); each hop is one chain edge.
//   args.projection  optional in-memory projection; else the committed LOCAL file.
//   args.curatedChains optional in-memory curated_chains; else the committed LOCAL
//                    command-registry curated_chains (the confidence/transform
//                    fallback when an edge lacks them).
//   args.k           optional surfaced-set budget; clamped at the Part-3 MAX_K
//                    (R6 ranking-deferral). When absent, the full set is returned.
//
// Walks every acyclic chain path of 1..maxHops hops starting at `from`, composing
// confidence MULTIPLICATIVELY along the path with the SPFO reduce formula:
//   reduce(c = 1.0, r IN rels | c * coalesce(r.confidence, COALESCE_CONFIDENCE))
// Each candidate is { from, path, hops, confidence, transforms, kinds } where
// `path` is the framework-name sequence (length hops+1), `transforms` is the
// per-hop transform descriptor array (length hops; a hop with no transform is
// positionally null, never dropped), and `kinds` is the per-hop edge-kind array.
// Candidates are ordered by hops ASC then composed-confidence DESC (the SPFO
// ordering). Local-Only (INV-12): reads only the committed projection + registry
// (or the in-memory fixtures); ZERO Brain/network at rank time. The FINAL surfaced
// ordering of the eligible set still defers to the Part-3 MAX_K ranker (R6); this
// supplies the composed confidence + a clamped surfaced view, never a competing
// ranker.
// ---------------------------------------------------------------------------
function recommendMultiHopChains(args) {
  const o = (args && typeof args === 'object') ? args : {};
  const seed = typeof o.from === 'string' ? o.from : null;
  if (!seed) return [];

  const maxHops = (typeof o.maxHops === 'number' && o.maxHops > 0)
    ? Math.floor(o.maxHops)
    : 3;

  const projection = (o.projection && typeof o.projection === 'object')
    ? o.projection
    : _readJsonLocal(PROJECTION_PATH);
  if (!projection || !Array.isArray(projection.edges)) return [];

  let curatedChains = o.curatedChains;
  if (!Array.isArray(curatedChains)) {
    const reg = _readJsonLocal(REGISTRY_PATH);
    curatedChains = reg && Array.isArray(reg.curated_chains) ? reg.curated_chains : [];
  }
  const confIndex = _buildConfidenceIndex(curatedChains);

  const adj = _buildChainAdjacency(projection, confIndex);

  const candidates = [];

  // Depth-first acyclic walk. `path` is the framework-name sequence; `transforms`
  // / `kinds` are the per-hop arrays; `conf` is the running multiplicative product
  // (the SPFO reduce accumulator, seeded at 1.0). `visited` guards cycles.
  function walk(node, path, transforms, kinds, conf, visited) {
    const neighbors = adj.get(node) || [];
    for (const rec of neighbors) {
      if (visited.has(rec.to)) continue; // acyclic: never revisit a node on this path
      const c = typeof rec.confidence === 'number' ? rec.confidence : COALESCE_CONFIDENCE;
      const nextConf = conf * c;
      const nextPath = path.concat(rec.to);
      const nextTransforms = transforms.concat(typeof rec.transform === 'string' ? rec.transform : null);
      const nextKinds = kinds.concat(rec.kind);
      const hops = nextPath.length - 1;

      // Emit this path as a candidate (every 1..maxHops path is surfaced).
      candidates.push({
        from: seed,
        path: nextPath,
        hops,
        confidence: nextConf,
        transforms: nextTransforms,
        kinds: nextKinds,
      });

      if (hops < maxHops) {
        const nextVisited = new Set(visited);
        nextVisited.add(rec.to);
        walk(rec.to, nextPath, nextTransforms, nextKinds, nextConf, nextVisited);
      }
    }
  }

  walk(seed, [seed], [], [], 1.0, new Set([seed]));

  // SPFO ordering: hops ASC, then composed-confidence DESC. Stable tertiary sort
  // on the path string for byte-deterministic output across runs.
  candidates.sort((a, b) => {
    if (a.hops !== b.hops) return a.hops - b.hops;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    const pa = a.path.join('>');
    const pb = b.path.join('>');
    return pa < pb ? -1 : (pa > pb ? 1 : 0);
  });

  // R6 ranking-deferral: clamp the surfaced view at the Part-3 MAX_K budget when a
  // budget is requested. The FINAL ordering of the eligible set is the Part-3
  // ranker's job; this is only the row-budget cap.
  if (typeof o.k === 'number' && o.k > 0) {
    const k = Math.min(Math.floor(o.k), MAX_K);
    return candidates.slice(0, k);
  }
  return candidates;
}

module.exports = {
  recommendChainCandidates,
  recommendMultiHopChains,
  // R6 ranking-deferral: re-export the Part-3 MAX_K cap so consumers (and the
  // ranking test) can prove the recommender defers to the ranker's row budget
  // rather than minting its own. rankForSelector is intentionally NOT exported
  // here -- ordering the final surfaced set is the Part-3 ranker's job.
  MAX_K,
};
