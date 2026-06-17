'use strict';
// Phase SEED-026 graph-export. The single whole-graph read door for the
// visualization surfaces (generate-presentation.cjs graph.html + dashboard).
//
// WHY THIS EXISTS (the defect it kills): the canonical graph viz built its NODE
// set from a filesystem/wikilink scan (scripts/build-graph, IDs like
// "<section>/<rel_clean>" with subfolders FLATTENED to hyphens) and bolted
// room.db EDGES on top, keyed in room.db's slash-preserving getArtifactId space.
// Per CLAUDE.md decision 16 every artifact lives in a nested subfolder, so the
// two ID strings ALWAYS diverge -> every room.db edge landed on a node the node
// set never minted -> Cytoscape orphans. getGraphExport sources BOTH nodes and
// edges from room.db in ONE identity space, so dangling edges are structurally
// impossible (an edge is emitted only when BOTH endpoints are in the node set).
//
// Canon Part 9: navigation IS the local mind; the viz reads THROUGH the spine,
//   never a second scanner. This module lives under navigation/ (allow-listed)
//   and reuses lazygraph-ops read primitives; it never re-derives identity.
// Canon Part 8: this is a BROAD READ that can land in a deployable present/ HTML
//   artifact, so the payload is a strict WHITELIST of local render fields
//   (id, label, type, knowledge_type, color, degree, review_status). It NEVER
//   emits the raw properties blob, source paths, or any correlation_id / Brain-
//   correlated bytes. The whitelist makes the boundary structural, not audited.
// Canon Part 4: node types + edge types are read from the typed graph; the
//   knowledge_type color map mirrors the proving implementation.

const fs = require('fs');
const path = require('path');
const lgOps = require('../lazygraph-ops.cjs');

let discoverSections;
try { ({ discoverSections } = require('../section-registry.cjs')); } catch (_) { discoverSections = null; }

// --- Classification maps (Canon Part 4 typed vocabulary) ---

// knowledge_type -> color (mirrors the proving impl present/hub/graph.html KT map).
const KNOWLEDGE_TYPE_COLOR = {
  fact: '#c9c6bd',
  mental_model: '#ffd000',
  causal: '#2b50e6',
  assumption: '#e84a8a',
  anomaly_cue: '#e5383b',
  heuristic: '#2ec4b6',
  governing_thought: '#ffffff',
};

// node.type -> { cls, color, useKnowledgeType }. Covers all live render types.
// useKnowledgeType: color is derived from the node's knowledge_type property.
const NODE_TYPE_RENDER = {
  claim: { cls: 'claim', useKnowledgeType: true, color: '#c9c6bd' },
  CausalClaim: { cls: 'causal', color: '#2b50e6' },
  assumption: { cls: 'assumption', color: '#e84a8a' },
  decision: { cls: 'decision', color: '#2ec4b6' },
  opportunity: { cls: 'opportunity', color: '#ffd000' },
  governing_thought: { cls: 'governing', color: '#ffffff' },
  EvidenceClaim: { cls: 'evidence', color: '#c9c6bd' },
  WhitespaceZone: { cls: 'whitespace', color: '#C8A43C' },
  RSDiscovery: { cls: 'reverse-salient', color: '#e5383b' },
  Breakthrough: { cls: 'breakthrough', color: '#ffd000' },
  lens_finding: { cls: 'lens', color: '#2ec4b6' },
  Artifact: { cls: 'artifact', color: '#A09A90' },
  Section: { cls: 'section-group', color: '#1A1A1A' },
  Concept: { cls: 'concept', color: '#C8A43C' },
};

// System-bookkeeping + memory-cortex node types DELIBERATELY excluded from the
// knowledge viz (counted in meta.excluded, never silently dropped). memory_event
// is the temporal audit log (can be hundreds of rows) and would swamp the graph.
const EXCLUDE_TYPES = new Set([
  'memory_event', 'focus', 'audit',
  'memory_artifact', 'navigator_persona', 'HatState',
  'requirement', 'planning_artifact',
]);

const DEFAULT_COLOR = '#888888';

// edge type -> plain-English gloss (proving impl EX, extended with the frozen
// ALLOWED_EDGE_TYPES the rooms actually carry). Canon Part 4 vocabulary.
const EDGE_GLOSS = {
  INFORMS: 'feeds the claim - evidence you can trace, so the conclusion is never a black box.',
  SUPPORTS: 'directly backs the claim - a load-bearing beam, not decoration.',
  INSTANTIATES: 'makes the claim real - a concrete example you can actually test.',
  STATES: 'declares the governing thought the rest hangs from.',
  DESCRIBES: 'describes or annotates the target.',
  CONTRADICTS: 'directly opposes the claim - a gap that must be resolved.',
  CONVERGES: 'aligns with the pattern - evidence the claim is robust.',
  ENABLES: 'unblocks the target - makes it actionable.',
  INVALIDATES: 'proves the target stale or wrong - requires rework.',
  REFINES: 'tightens or conditions the claim without invalidating it.',
  ROOT_CAUSES: 'is the root cause of the target.',
  DERIVED_FROM: 'was derived from the source.',
  REVERSE_SALIENT: 'marks a lagging spot where understanding trails ambition.',
  BELONGS_TO: 'belongs to the section.',
};

const DEFAULT_NODE_CAP = 5000;

function edgeClass(type) {
  return String(type || '').toLowerCase().replace(/_/g, '-');
}

function safeParse(json) {
  if (!json || typeof json !== 'string') return {};
  try { return JSON.parse(json); } catch (_) { return {}; }
}

function deriveLabel(props, knowledgeType, id) {
  const t = props && (props.title || props.label || props.name);
  if (t && String(t).trim()) return String(t).trim();
  if (knowledgeType) return knowledgeType;
  // last resort: the trailing id segment, never a path or a hash-only blob
  const tail = String(id).split(/[:/]/).pop();
  return tail || String(id);
}

function roomSlugFromDir(roomDir) {
  return path.basename(path.resolve(roomDir));
}

/**
 * Build a Cytoscape-ready whole-graph export sourced entirely from room.db, in
 * ONE node-identity space. Dangling edges are impossible by construction.
 *
 * @param {string} roomDir - absolute path to the room directory
 * @param {object} [opts] - { nodeCap }
 * @returns {Promise<{
 *   ok: boolean, cold_start: boolean, room_slug: string,
 *   counts: { nodes: number, edges: number, excluded: number, orphans: number, dropped_edges: number },
 *   unmapped_types: string[], capped: boolean,
 *   elements: { nodes: Array, edges: Array }
 * }>}
 */
async function getGraphExport(roomDir, opts) {
  const options = opts || {};
  const nodeCap = Number.isInteger(options.nodeCap) && options.nodeCap > 0 ? options.nodeCap : DEFAULT_NODE_CAP;
  const roomSlug = roomSlugFromDir(roomDir);
  const dbPath = path.join(path.resolve(roomDir), '.mindrian', 'room.db');

  // Cold-start: no room.db. Emit section anchors so the viz renders the scaffold
  // (Black-hat HIGH risk: a room.db-only export must not blank a Tier-0 room).
  // Phase 162-02 (R11 / D-B): these export-time Section anchors are now the
  // TIER-0 FALLBACK only. birthRoom writes REAL Section nodes into room.db at
  // birth, and lib/core/migrations/phase-162-section-nodes.cjs backfills existing
  // rooms, so the in-DB path below renders real Section nodes. coldStart() fires
  // ONLY when room.db is absent (here) or has zero included nodes (the
  // coldStartFlag branch below). Do NOT delete this path: un-migrated rooms and
  // rooms with no room.db still depend on it.
  if (!fs.existsSync(dbPath)) {
    return coldStart(roomDir, roomSlug);
  }

  let db;
  try {
    const opened = await lgOps.openGraph(roomDir);
    db = opened.db;
    const conn = opened.conn;

    // SELECT * (not a named-column list) so the read is robust to schema variance:
    // a freshly-created room.db has only (id, type, properties); the Phase 109
    // provenance migration adds review_status et al. Reading * lets review_status be
    // undefined on unmigrated rooms without throwing. Part 8 is preserved at EMIT
    // time (strict whitelist below), so pulling all columns internally is safe.
    const rawNodes = await lgOps.queryGraph(
      conn,
      'SELECT * FROM nodes LIMIT ?',
      [nodeCap + 1]
    );
    const capped = rawNodes.length > nodeCap;
    const nodeRows = capped ? rawNodes.slice(0, nodeCap) : rawNodes;

    const unmapped = new Set();
    let excluded = 0;
    const nodeIndex = new Map(); // id -> node data (included only)

    for (const row of nodeRows) {
      if (EXCLUDE_TYPES.has(row.type)) { excluded += 1; continue; }
      const props = safeParse(row.properties);
      const knowledgeType = props.knowledge_type || (row.type === 'governing_thought' ? 'governing_thought' : null);
      const render = NODE_TYPE_RENDER[row.type];
      let cls; let color;
      if (render) {
        cls = render.cls;
        color = render.useKnowledgeType
          ? (KNOWLEDGE_TYPE_COLOR[knowledgeType] || render.color)
          : render.color;
      } else {
        // Unknown type: render loud (default color) + flag, never drop, never throw.
        unmapped.add(row.type);
        cls = 'unknown';
        color = DEFAULT_COLOR;
      }
      nodeIndex.set(row.id, {
        data: {
          id: row.id,
          label: deriveLabel(props, knowledgeType, row.id),
          type: row.type,
          knowledge_type: knowledgeType || null,
          color,
          degree: 0,
          review_status: row.review_status || null,
        },
        classes: cls,
      });
    }

    // Edges: keep ONLY those whose BOTH endpoints are in the included node set.
    // This is the no-orphan / no-dangling guarantee (one identity space).
    const rawEdges = await lgOps.queryGraph(conn, 'SELECT source, target, type FROM edges');
    const edges = [];
    let droppedEdges = 0;
    let edgeIdx = 0;
    for (const e of rawEdges) {
      const src = nodeIndex.get(e.source);
      const tgt = nodeIndex.get(e.target);
      if (!src || !tgt) { droppedEdges += 1; continue; }
      src.data.degree += 1;
      tgt.data.degree += 1;
      edges.push({
        data: {
          id: 'e' + (edgeIdx++),
          source: e.source,
          target: e.target,
          type: e.type,
          label: String(e.type || '').toLowerCase(),
          gloss: EDGE_GLOSS[e.type] || 'connects to the other.',
        },
        classes: edgeClass(e.type),
      });
    }

    const nodes = Array.from(nodeIndex.values());
    const orphans = nodes.filter((n) => n.data.degree === 0).length;
    const coldStartFlag = nodes.length === 0;

    if (unmapped.size) {
      // Loud in logs; CI golden test asserts unmapped_types is empty for fixtures.
      try { console.warn('[graph-export] unmapped node types rendered as default: ' + Array.from(unmapped).join(', ')); } catch (_) {}
    }

    // If room.db has zero KNOWLEDGE nodes (only bookkeeping), fall back to the
    // cold-start scaffold so the viz still renders something meaningful.
    if (coldStartFlag) {
      const cs = coldStart(roomDir, roomSlug);
      cs.counts.excluded = excluded;
      return cs;
    }

    return {
      ok: true,
      cold_start: false,
      room_slug: roomSlug,
      counts: {
        nodes: nodes.length,
        edges: edges.length,
        excluded,
        orphans,
        dropped_edges: droppedEdges,
      },
      unmapped_types: Array.from(unmapped),
      capped,
      elements: { nodes, edges },
    };
  } catch (err) {
    // Graceful degradation: never throw on the hot /mos:present path.
    return {
      ok: false,
      cold_start: false,
      room_slug: roomSlug,
      error: err && err.message ? err.message : String(err),
      counts: { nodes: 0, edges: 0, excluded: 0, orphans: 0, dropped_edges: 0 },
      unmapped_types: [],
      capped: false,
      elements: { nodes: [], edges: [] },
    };
  } finally {
    if (db) { try { await lgOps.closeGraph(db); } catch (_) {} }
  }
}

// Cold-start scaffold: section-group anchors from the section registry (or a
// minimal default set) so a brand-new room renders instead of a blank canvas.
function coldStart(roomDir, roomSlug) {
  let sections = [];
  if (discoverSections) {
    try { sections = discoverSections(roomDir) || []; } catch (_) { sections = []; }
  }
  if (!Array.isArray(sections) || sections.length === 0) {
    sections = [
      'problem-definition', 'market-analysis', 'solution-design', 'business-model',
      'competitive-analysis', 'team-execution', 'legal-ip', 'financial-model',
    ];
  }
  const nodes = sections.map((s) => {
    const name = typeof s === 'string' ? s : (s && (s.name || s.section)) || String(s);
    return {
      data: {
        id: name,
        label: String(name).replace(/-/g, ' ').toUpperCase(),
        type: 'Section',
        knowledge_type: null,
        color: '#1A1A1A',
        degree: 0,
        review_status: null,
      },
      classes: 'section-group',
    };
  });
  return {
    ok: true,
    cold_start: true,
    room_slug: roomSlug,
    counts: { nodes: nodes.length, edges: 0, excluded: 0, orphans: nodes.length, dropped_edges: 0 },
    unmapped_types: [],
    capped: false,
    elements: { nodes, edges: [] },
  };
}

module.exports = {
  getGraphExport,
  // exported for tests + consumers (gloss legend, color legend)
  KNOWLEDGE_TYPE_COLOR,
  NODE_TYPE_RENDER,
  EXCLUDE_TYPES,
  EDGE_GLOSS,
};
