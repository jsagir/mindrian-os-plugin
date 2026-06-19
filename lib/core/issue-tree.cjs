'use strict';
// ========================================
// MINDRIAN ISSUE TREE ENGINE (Phase 164 Wave 3 port)
// Diagnostic ("why") Issue Tree -- validate, render, emit FROZEN typed edges
//
// Ported from reference/issue-tree/MindrianIssueTree.js (164-ISSUE-TREE.md).
// The four pure functions (normalizeKeyQuestion / validateMECE /
// validateFalsifiability / renderMarkdown / toGraphEdges) keep the reference
// LOGIC verbatim; the ONLY change is the navigator-LOCKED EDGE REMAP
// (164-ISSUE-TREE.md section 5) applied to the edge-type constants toGraphEdges
// emits, so every emitted edge is a member of the frozen Part-9 ALLOWED_EDGE_TYPES
// set (no canon amendment -- the frozen set already covers the semantics, and
// Phase 168 brought INVALIDATES / ENABLES into the chokepoint, Phase 163 froze
// PART_OF, Phase 150.8 froze ROOT_CAUSES).
//
// Division of labour (same as the GENESIS pipeline): the LLM/agent
// (mos-diagnose-issue-tree.md) GENERATES the insightful MECE + falsifiable
// branches; this DETERMINISTIC engine VALIDATES MECE + falsifiability, renders
// Markdown (the agent's only allowed output), and emits the typed edges.
//
// It is a SINGLE deterministic build call (build()). It does NOT ride runChain
// (runChain carries the Wave-5 sequential gated debate, not the deterministic
// tree build) -- there is ZERO runChain require here. Zero Math.random, zero
// Date.now in the build path (deterministic; any timestamp is caller-injected,
// mirroring the GENESIS handoff no-Date.now rule).
//
// Canon Part 4: every emitted edge is graph data. Canon Part 8: the build is
// LOCAL deterministic -- it makes no Brain call. Canon Part 9: graph emission
// routes through the navigation.writeEdge chokepoint (writeIssueTreeEdges),
// never raw SQL; the edges land PROPOSED, the human confirms.
//
// THE EDGE REMAP (164-ISSUE-TREE.md section 5, navigator-LOCKED 2026-06-18):
//   INVALIDATED  (branch failed its falsification test)        -> INVALIDATES
//   RESOLVES_VIA (confirmed leaf root cause -> governing prob)  -> ROOT_CAUSES
//   RESOLVES_VIA (the opportunity-bank-seed half)              -> ENABLES
//   BELONGS_TO   (branch -> governing problem)                 -> PART_OF
//   INFORMS      (child cause -> parent cause)                 -> INFORMS (unchanged)
//
// Tree node shape:
//   { label, test?, branches?: [node], status?: 'open'|'confirmed'|'invalidated' }
// ========================================

const { ALLOWED_EDGE_TYPES } = require('./navigation/edges.cjs');

// The remapped edge-type constants this engine can emit. Each maps a reference
// engine emission to its frozen Part-4 replacement. EVERY value here is
// self-checked at module load against the frozen ALLOWED_EDGE_TYPES set (below)
// so a remap that drifted out of the frozen set fails fast.
const EDGE_TYPES = Object.freeze({
  // branch -> governing problem (was BELONGS_TO; PART_OF frozen Phase 163).
  STRUCTURAL: 'PART_OF',
  // child cause -> parent cause (unchanged; INFORMS frozen since Phase 130-01).
  INFORMS: 'INFORMS',
  // branch failed falsification (was INVALIDATED; INVALIDATES frozen Phase 168).
  INVALIDATES: 'INVALIDATES',
  // confirmed leaf root cause -> governing problem (was RESOLVES_VIA; ROOT_CAUSES
  //   frozen Phase 150.8).
  ROOT_CAUSES: 'ROOT_CAUSES',
  // confirmed cause -> opportunity-bank candidate (was the RESOLVES_VIA
  //   opportunity-seed half; ENABLES frozen Phase 168).
  ENABLES: 'ENABLES',
});

// Module-load self-check (fail-fast): every edge type the engine can emit MUST
// be a frozen member. If a remap drifted out of the frozen set, throw at require
// time so the regression surfaces before any tree is built (threat T-164-10).
(function assertEmittableEdgesAreFrozen() {
  for (const t of Object.values(EDGE_TYPES)) {
    if (!ALLOWED_EDGE_TYPES.has(t)) {
      throw new Error(
        'issue-tree edge remap drift: emittable edge type "' + t +
        '" is not a member of the frozen ALLOWED_EDGE_TYPES (Part 4 / Phase 108). ' +
        'The remap must target frozen members only (164-ISSUE-TREE.md section 5).'
      );
    }
  }
})();

// The hat-lens disclaimer travels in the FILED artifact, NEVER in renderMarkdown
// output. The FILER attaches this string to the artifact; the tree output stays
// clean (asserted by the engine test).
const HAT_LENS_DISCLAIMER =
  'Perspective lens (White Data-Analyst + Black Risk-Assessor), not expert advice. ' +
  'This is a diagnostic map of plausible causes for the navigator to test, not a verdict.';

const IssueTreeEngine = {
  EDGE_TYPES,
  HAT_LENS_DISCLAIMER,

  // Coerce any problem statement into a single "why" key question.
  normalizeKeyQuestion: (raw) => {
    let q = (raw || '').trim().replace(/\s+/g, ' ');
    if (!q) return 'Why is the problem occurring?';
    if (/^why\b/i.test(q)) return q.replace(/\?*$/, '?');
    // Strip leading framing and reframe as "why".
    q = q.replace(/^(the problem is|we have a problem|issue:|problem:)\s*/i, '');
    return `Why ${q.charAt(0).toLowerCase() + q.slice(1)}`.replace(/\?*$/, '?');
  },

  // ---- MECE validation -------------------------------------------------
  // Mutually exclusive: flag sibling branches that share distinctive keywords.
  // Collectively exhaustive: warn if a level has < 2 branches.
  validateMECE: (branches, path = 'root') => {
    const warnings = [];
    if (!Array.isArray(branches) || branches.length === 0) return warnings;

    if (branches.length < 2) {
      warnings.push(`[${path}] Only ${branches.length} branch -- a breakdown needs >= 2 to be a decomposition.`);
    }

    // Mutual exclusivity heuristic: distinctive content words shared across siblings.
    const stop = new Set(['the', 'a', 'an', 'of', 'to', 'and', 'or', 'in', 'on', 'for', 'is', 'are', 'with', 'by', 'from', 'too', 'not', 'no', 'low', 'high', 'poor', 'bad']);
    const tokensOf = (s) => (String(s || '').toLowerCase().match(/[a-z][a-z0-9\-]{2,}/g) || []).filter(t => !stop.has(t));
    for (let i = 0; i < branches.length; i++) {
      for (let j = i + 1; j < branches.length; j++) {
        const a = new Set(tokensOf(branches[i].label));
        const shared = tokensOf(branches[j].label).filter(t => a.has(t));
        if (shared.length >= 2) {
          warnings.push(`[${path}] Possible overlap (not mutually exclusive): "${branches[i].label}" vs "${branches[j].label}" share {${shared.join(', ')}}.`);
        }
      }
    }

    // Recurse.
    branches.forEach((b, idx) => {
      if (b.branches && b.branches.length) {
        warnings.push(...IssueTreeEngine.validateMECE(b.branches, `${path}/${idx + 1}`));
      }
    });
    return warnings;
  },

  // ---- Falsifiability validation ---------------------------------------
  // Every LEAF should carry a test that could eliminate it.
  validateFalsifiability: (node, path = 'root') => {
    const warnings = [];
    const isLeaf = !node.branches || node.branches.length === 0;
    if (isLeaf) {
      if (!node.test || !String(node.test).trim()) {
        warnings.push(`[${path}] Leaf "${node.label}" has no falsification test -- it cannot be definitively eliminated.`);
      }
    } else {
      node.branches.forEach((b, idx) =>
        warnings.push(...IssueTreeEngine.validateFalsifiability(b, `${path}/${idx + 1}`)));
    }
    return warnings;
  },

  // ---- Markdown rendering (the agent's only allowed output) ------------
  // The hat-lens disclaimer is NEVER part of this output -- the FILER attaches
  // it to the artifact, not the tree.
  renderMarkdown: (tree) => {
    const key = IssueTreeEngine.normalizeKeyQuestion(tree.keyQuestion);
    const lines = [`# ${key}`, ''];

    const walk = (nodes, depth) => {
      (nodes || []).forEach(n => {
        const indent = '  '.repeat(depth);
        const strike = n.status === 'invalidated' ? '~~' : '';
        lines.push(`${indent}- ${strike}${n.label}${strike}`);
        const isLeaf = !n.branches || n.branches.length === 0;
        if (isLeaf && n.test) {
          lines.push(`${indent}  - *Test: ${n.test}*`);
        }
        if (n.branches && n.branches.length) walk(n.branches, depth + 1);
      });
    };
    walk(tree.branches, 0);
    return lines.join('\n');
  },

  // ---- Graph subgraph for the filing cascade ---------------------------
  // Local room only. Returns edges ready for the navigation.writeEdge chokepoint.
  // The EDGE REMAP is applied here: every emitted type is a frozen member.
  // Deterministic: ids are derived from a per-call counter only (no Math.random,
  // no Date.now), so the SAME tree yields byte-identical edges across builds.
  toGraphEdges: (tree, governingProblemId = 'problem-definition:governing') => {
    const edges = [];
    let counter = 0;
    const idFor = (label) => `issue:${(label || 'node').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-${counter++}`;
    const oppIdFor = (nodeId) => `opportunity:${nodeId.replace(/^issue:/, '')}`;

    const walk = (nodes, parentId) => {
      (nodes || []).forEach(n => {
        const nodeId = idFor(n.label);
        // branch -> governing problem (remap BELONGS_TO -> PART_OF).
        edges.push({ from: nodeId, to: governingProblemId, type: EDGE_TYPES.STRUCTURAL, rationale: 'Branch of the diagnostic tree' });
        if (parentId) {
          // child cause -> parent cause (INFORMS unchanged).
          edges.push({ from: nodeId, to: parentId, type: EDGE_TYPES.INFORMS, rationale: 'Sub-cause informs parent cause' });
        }
        if (n.status === 'invalidated') {
          // failed falsification (remap INVALIDATED -> INVALIDATES).
          edges.push({ from: nodeId, to: governingProblemId, type: EDGE_TYPES.INVALIDATES, rationale: n.test ? `Falsified: ${n.test}` : 'Eliminated by diagnosis' });
        }
        const isLeaf = !n.branches || n.branches.length === 0;
        if (isLeaf && n.status === 'confirmed') {
          // confirmed leaf root cause -> governing problem (remap RESOLVES_VIA
          //   root-cause half -> ROOT_CAUSES; leaf -> governing problem).
          edges.push({ from: nodeId, to: governingProblemId, type: EDGE_TYPES.ROOT_CAUSES, rationale: 'Confirmed root cause of the governing problem' });
          // confirmed cause -> opportunity-bank candidate (remap RESOLVES_VIA
          //   opportunity-seed half -> ENABLES).
          edges.push({ from: nodeId, to: oppIdFor(nodeId), type: EDGE_TYPES.ENABLES, rationale: 'Confirmed cause seeds an opportunity-bank candidate' });
        }
        if (n.branches && n.branches.length) walk(n.branches, nodeId);
      });
    };
    walk(tree.branches, null);
    return edges;
  },

  // ---- One-call build: validate everything, render, emit ---------------
  // SINGLE deterministic call returning { keyQuestion, markdown, graphEdges,
  // validation, warnings, nextMove }. No Math.random, no Date.now, no runChain.
  build: (tree) => {
    const meceWarnings = IssueTreeEngine.validateMECE(tree.branches);
    const falsWarnings = (tree.branches || []).flatMap((b, i) =>
      IssueTreeEngine.validateFalsifiability(b, `root/${i + 1}`));
    return {
      keyQuestion: IssueTreeEngine.normalizeKeyQuestion(tree.keyQuestion),
      markdown: IssueTreeEngine.renderMarkdown(tree),
      graphEdges: IssueTreeEngine.toGraphEdges(tree),
      validation: {
        mece: meceWarnings,
        falsifiability: falsWarnings,
        passes: meceWarnings.length === 0 && falsWarnings.length === 0,
      },
      // Flat warnings list surfaced to the navigator (never auto-suppressed).
      warnings: [...meceWarnings, ...falsWarnings],
      nextMove: '/mos:root-cause on surviving leaves, then /mos:validate to run the tests',
    };
  },
};

// writeIssueTreeEdges(db, graphEdges) -- route EVERY emitted edge through the
// navigation.writeEdge chokepoint (the Part 9 single door, never raw SQL). It
// takes the caller-owned db handle (via openRoomDb) and the build() graphEdges
// array. Returns { written, rejected, results } -- a rejected edge (a remap
// drift slipping past the load-time self-check) is reported, never silently
// swallowed. It does NOT require runChain (the tree is a deterministic build,
// not a debate). Per Canon Part 9, edges land PROPOSED; the human confirms.
function writeIssueTreeEdges(navigation, db, graphEdges) {
  const results = [];
  let written = 0;
  let rejected = 0;
  for (const e of (Array.isArray(graphEdges) ? graphEdges : [])) {
    const res = navigation.writeEdge(db, {
      source_id: e.from,
      target_id: e.to,
      edge_type: e.type,
      properties: {
        relation: 'issue_tree',
        rationale: typeof e.rationale === 'string' ? e.rationale : '',
        review_status: 'proposed',
      },
    });
    results.push(res);
    if (res && res.ok) {
      written += 1;
    } else {
      rejected += 1;
    }
  }
  return { written, rejected, results };
}

IssueTreeEngine.writeIssueTreeEdges = writeIssueTreeEdges;

module.exports = IssueTreeEngine;
