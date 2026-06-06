'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 143.1-05 -- dial-memory renderer (MEMDIAL-02 / MEMDIAL-03).
 * ================================================================
 * The legible MD projection of the dial relationship layer. A PURE function
 *   renderDialMemory(db, sectionSlug, opts) -> { markdown_body, summary_stats }
 * modeled VERBATIM on the SHIPPED Phase 124 timeline-renderer architecture
 * (lib/core/feynman/timeline-renderer.cjs): it reads ONLY via lib/core/navigation.cjs
 * (the Phase 109 closed chokepoint, D-03), with ZERO filesystem reads and ZERO
 * Brain calls.
 *
 * The section is rendered FROM the graph (MEMDIAL-03; the graph is the source of
 * truth, the MD is the legible projection) and carries ALL FOUR MEMDIAL-02
 * components on every render:
 *
 *   1. Available reaches      -- the 5 canonical reach ids (DIAL_REACH_K doctrine).
 *   2. Last selected          -- the most-recent SELECTED_REACH edge, surfaced via
 *                                navigation.getNeighborhood off the focus node.
 *   3. Current recommended    -- the FROZEN-gate result, passed in via opts.reachList
 *                                (the dial-reach orchestrator's pre-baked LOCAL output;
 *                                this renderer never re-runs the gate -- it projects).
 *   4. Recent research conclusions -- surfaced from the DRSCH research-conclusion
 *                                evidence edges via navigation.getNeighborhood filtered
 *                                on the DRSCH / evidence-conclusion edgeTypeIn
 *                                (EvidenceClaim-typed neighbors reached by an INFORMS
 *                                edge). Rendered as a clean empty/placeholder block
 *                                ("no recent research conclusions") when none exist --
 *                                NEVER omitted, NEVER a crash.
 *
 * Idempotence (MEMDIAL-03): rendering twice from the same graph state yields a
 * byte-identical body (deterministic sort, ISO-second timestamps, frozen format).
 *
 * The renderer ALSO exports the dial sentinels + a mergeDialSection helper so the
 * runner (Plan 143.1-05 Task 3) can do its sentinel-bounded byte-preserving write
 * without re-deriving the contract. The merge idiom mirrors the Phase 124
 * timeline-runner mergeSentinelSection verbatim (Part 7 reuse).
 *
 * Canon Part 8: zero net-new Brain surface; LOCAL-only projection of the LOCAL
 *   graph. Canon Part 9: SQL is the source of truth; this is the Larry-explains
 *   face of the SELECTED_REACH / PIVOTED / DRSCH relationship layer.
 *
 * NO em-dashes / en-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only.
 *
 * License: BSL 1.1.
 */

const navigation = require('../navigation.cjs');
const { REACH_IDS } = require('../../hmi/dial-reach-orchestrator.cjs');

// ---------- Dial sentinel contract (mirrors the Phase 124 D-02 idiom) ----------

const SENTINEL_START = '<!-- DIAL_MEMORY_AUTO_START -->';
const SENTINEL_END = '<!-- DIAL_MEMORY_AUTO_END -->';
const HEADER = '## Dial Memory (auto)';

// How far back the graph traversal reaches for the dial relationship layer. A
// generous neighborhood so SELECTED_REACH + DRSCH neighbors all surface; the
// renderer filters by edge type after the traversal.
const NEIGHBORHOOD_TOP_K = 200;
const NEIGHBORHOOD_MAX_DEPTH = 2;

// ---------- ISO helper (second resolution -- idempotence) ----------

function isoSecond(ms) {
  if (!Number.isFinite(ms)) return '';
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// ---------- Graph reads (ONLY via navigation.cjs) ----------

// Pull the full neighborhood off the focus node, then filter by edge type. The
// SELECTED_REACH neighbors are committed reaches; the EvidenceClaim neighbors
// reached by an INFORMS edge are the DRSCH research-conclusion evidence layer.
function neighborhood(db, focusNodeId) {
  if (!focusNodeId) return [];
  try {
    return navigation.getNeighborhood(db, focusNodeId, {
      topK: NEIGHBORHOOD_TOP_K,
      maxDepth: NEIGHBORHOOD_MAX_DEPTH,
    }) || [];
  } catch (_) {
    return [];
  }
}

// The most-recent SELECTED_REACH neighbor (the "last selected" component). The
// neighbor's id is cmd:<command>; the edgeTypeIn is SELECTED_REACH.
function lastSelected(neighbors) {
  const selected = neighbors.filter((n) => n.edgeTypeIn === 'SELECTED_REACH');
  if (selected.length === 0) return null;
  // Deterministic: newest createdAt first; tie-break on id for idempotence.
  selected.sort((a, b) => {
    const ca = Number.isFinite(a.createdAt) ? a.createdAt : 0;
    const cb = Number.isFinite(b.createdAt) ? b.createdAt : 0;
    if (cb !== ca) return cb - ca;
    return String(a.id).localeCompare(String(b.id));
  });
  return selected[0];
}

// The DRSCH research-conclusion evidence neighbors: EvidenceClaim-typed nodes
// reached via an INFORMS edge (the FILEVAL-02 substrate's evidence-conclusion
// edgeTypeIn). Deterministic order: newest first, tie-break on id.
function researchConclusions(neighbors) {
  const drsch = neighbors.filter((n) =>
    n.type === 'EvidenceClaim' && n.edgeTypeIn === 'INFORMS');
  drsch.sort((a, b) => {
    const ca = Number.isFinite(a.createdAt) ? a.createdAt : 0;
    const cb = Number.isFinite(b.createdAt) ? b.createdAt : 0;
    if (cb !== ca) return cb - ca;
    return String(a.id).localeCompare(String(b.id));
  });
  return drsch;
}

// Strip the opaque "EvidenceClaim:<session>:" prefix to a readable handle so the
// rendered line is legible without leaking raw provenance. The renderer reads
// only what getNeighborhood returns (the node id); it never opens room.db to
// fetch the topic blob.
function readableEvidenceHandle(id) {
  const s = String(id || '');
  const m = s.match(/^EvidenceClaim:[^:]*:(.+)$/);
  return m ? m[1] : s;
}

// The current-recommended component reads the FROZEN-gate result the caller
// already computed (opts.reachList from the dial-reach orchestrator). This
// renderer NEVER re-runs the gate; it projects what the graph + the pre-baked
// LOCAL signal produced.
function recommendedReaches(reachList) {
  if (!reachList || !Array.isArray(reachList.reaches)) return [];
  return reachList.reaches.filter((r) => r && r.recommended === true);
}

// ---------- The renderer ----------

function renderDialMemory(db, sectionSlug, opts) {
  const options = opts || {};
  const now_ms = Number.isFinite(options.now_ms) ? options.now_ms : Date.now();
  const focusNodeId = typeof options.focusNodeId === 'string' && options.focusNodeId.length > 0
    ? options.focusNodeId
    : ('section:' + sectionSlug);
  const reachList = (options.reachList && typeof options.reachList === 'object')
    ? options.reachList
    : { reaches: [], tier_mode: 'tier_0' };

  const neighbors = neighborhood(db, focusNodeId);
  const sel = lastSelected(neighbors);
  const drsch = researchConclusions(neighbors);
  const recommended = recommendedReaches(reachList);

  const lines = [];
  const nowIso = isoSecond(now_ms);

  // Empty state (MEMDIAL-02): zero SELECTED_REACH edges -> clean, intentional.
  if (!sel) {
    lines.push('*Last refreshed: ' + nowIso + '. No dial activity yet.*');
    lines.push('');
    lines.push('**Available reaches** (' + REACH_IDS.length + '):');
    for (const rid of REACH_IDS) lines.push('- ' + rid);
    lines.push('');
    lines.push('**Last selected:** none yet.');
    lines.push('');
    lines.push('**Current recommended:** ' + renderRecommended(recommended, reachList));
    lines.push('');
    lines.push('**Recent research conclusions:**');
    lines.push(renderResearchBlock(drsch));
    return {
      markdown_body: lines.join('\n'),
      summary_stats: {
        available_reaches: REACH_IDS.length,
        selected_count: 0,
        recommended_count: recommended.length,
        research_conclusions: drsch.length,
      },
    };
  }

  // Populated state: all 4 components.
  lines.push('*Last refreshed: ' + nowIso + '. Dial activity tracked as a typed graph relationship layer.*');
  lines.push('');

  // Component 1: available reaches.
  lines.push('**Available reaches** (' + REACH_IDS.length + '):');
  for (const rid of REACH_IDS) lines.push('- ' + rid);
  lines.push('');

  // Component 2: last selected (the most-recent SELECTED_REACH edge).
  const selCmd = String(sel.id || '').replace(/^cmd:/, '');
  lines.push('**Last selected:** ' + selCmd + ' (selected ' + isoSecond(sel.createdAt) + ').');
  lines.push('');

  // Component 3: current recommended (the FROZEN-gate result).
  lines.push('**Current recommended:** ' + renderRecommended(recommended, reachList));
  lines.push('');

  // Component 4: recent research conclusions (DRSCH-surfaced; empty/placeholder).
  lines.push('**Recent research conclusions:**');
  lines.push(renderResearchBlock(drsch));

  return {
    markdown_body: lines.join('\n'),
    summary_stats: {
      available_reaches: REACH_IDS.length,
      selected_count: neighbors.filter((n) => n.edgeTypeIn === 'SELECTED_REACH').length,
      recommended_count: recommended.length,
      research_conclusions: drsch.length,
    },
  };
}

// Render the current-recommended component. The dial is the confidence column;
// here it degrades to a legible list of the gated reach ids (the section is a
// memory projection, not the interactive chooser).
function renderRecommended(recommended, reachList) {
  const tier = reachList && typeof reachList.tier_mode === 'string' ? reachList.tier_mode : 'tier_0';
  if (!recommended || recommended.length === 0) {
    if (tier !== 'mode_a') {
      return 'none (Brain-gated marker is a mode_a concept; current tier ' + tier + ').';
    }
    return 'none above the frozen 0.70 gate.';
  }
  const ids = recommended
    .map((r) => String(r.reach_id || ''))
    .filter((s) => s.length > 0)
    .sort();
  return ids.join(', ') + '.';
}

// Render the research-conclusions block. ALWAYS returns a non-empty string: a
// clean placeholder when no DRSCH edges exist (so the block is never omitted and
// never crashes), or one line per surfaced research conclusion.
function renderResearchBlock(drsch) {
  if (!drsch || drsch.length === 0) {
    return '- no recent research conclusions';
  }
  const out = [];
  for (const n of drsch) {
    out.push('- ' + readableEvidenceHandle(n.id));
  }
  return out.join('\n');
}

// ---------- Sentinel-bounded merge (mirrors Phase 124 mergeSentinelSection) ----------

function mergeDialSection(body, renderedBody) {
  const startIdx = body.indexOf(SENTINEL_START);
  const endIdx = body.indexOf(SENTINEL_END);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = body.slice(0, startIdx + SENTINEL_START.length);
    const after = body.slice(endIdx);
    return before + '\n' + renderedBody + '\n' + after;
  }
  const sep = body.endsWith('\n') ? '' : '\n';
  return body + sep + '\n' + HEADER + '\n\n' + SENTINEL_START + '\n' + renderedBody + '\n' + SENTINEL_END + '\n';
}

function bodyOutsideSentinels(body) {
  const startIdx = body.indexOf(SENTINEL_START);
  const endIdx = body.indexOf(SENTINEL_END);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return body;
  let lineStart = body.lastIndexOf('\n', startIdx);
  if (lineStart === -1) lineStart = 0;
  let lineEnd = body.indexOf('\n', endIdx + SENTINEL_END.length);
  if (lineEnd === -1) lineEnd = body.length;
  return body.slice(0, lineStart) + body.slice(lineEnd);
}

module.exports = {
  renderDialMemory,
  mergeDialSection,
  bodyOutsideSentinels,
  isoSecond,
  SENTINEL_START,
  SENTINEL_END,
  HEADER,
};
