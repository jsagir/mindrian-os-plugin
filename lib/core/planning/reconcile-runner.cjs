'use strict';
/*
 * Phase 149-02 -- reconcile-runner: the idempotent backfill = sync spine for the
 * GSD-doc to local-graph bridge (GAM-02 / GAM-05 / GAM-07).
 *
 * ONE function -- reconcilePlanningArtifacts(roomDir, opts) -- walks the room's
 * .planning/ tree, classifies each artifact by filename suffix, upserts its
 * planning_artifact node, parses requirement ids into requirement nodes, and
 * writes the typed lineage edges (FEEDS_INTO / INFORMS / VALIDATES). Idempotence
 * is FREE: every write is an upsert keyed on a stable node/edge id (the Plan 01
 * contract), so a second pass over an unchanged tree changes no counts. This is
 * D-02: backfill and ongoing sync are the SAME code path.
 *
 * Mirrors lib/core/feynman/timeline-runner.cjs end-to-end:
 *   - takes opts.db, a caller-owned db handle (NEVER opens room.db itself).
 *   - reads room DATA ONLY via lib/core/navigation.cjs (the Phase 109 chokepoint).
 *   - requires ONLY navigation.cjs + node:fs + node:path. No brain-client, no
 *     node:http/https, no fetch -- the GAM-06 / Canon Part 8 zero-egress floor.
 *   - best-effort per-item try/catch so one bad artifact never aborts the pass.
 *
 * Canon Part 9: the planning markdown is the SOURCE-OF-MEANING read (role 1:
 *   Files preserve meaning). The reconcile reads it LOCALLY to derive generic
 *   handles (phase id, artifact_type, requirement id, path) -- never room state.
 *   Room DATA (nodes, edges) is read and written ONLY via navigation.cjs (role 2:
 *   SQL remembers and navigates). The artifact BODY never lands on a node or edge.
 *
 * Canon Part 8: zero network surface. The artifact prose never leaves the room.
 *
 * Lineage orientation (within the shipped LINEAGE subset {FEEDS_INTO, VALIDATES,
 *   INFORMS}; D from CONTEXT leaves the requirement-link edge type to planner
 *   discretion within the taxonomy):
 *     SPEC    FEEDS_INTO CONTEXT        (file lineage)
 *     CONTEXT FEEDS_INTO PLAN           (file lineage, per phase; each PLAN)
 *     requirement INFORMS SPEC          (the requirement is declared in the SPEC)
 *     requirement INFORMS PLAN          (for each requirement the PLAN cites)
 *     VERIFICATION VALIDATES requirement
 *   The requirement-as-source INFORMS edges make the which-artifacts-touch-<req>
 *   query answerable by a single outbound navigation.getNeighborhood traversal
 *   from the requirement node (getNeighborhood traverses e.source = focus).
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 *
 * Exports:
 *   reconcilePlanningArtifacts(roomDir, opts)
 *     -> { upserted, requirement_nodes, edges, pruned, unchanged }
 *   parseRequirementIds(text)        -> deduped array of requirement ids
 *   discoverPlanningArtifacts(planningDir)
 *     -> [{ phase, artifactType, path, status }]
 *   classifyArtifactType(filename)   -> ARTIFACT_TYPES member | null
 */

const fs = require('node:fs');
const path = require('node:path');

const navigation = require('../navigation.cjs');

// ---------- Filename -> artifact type classification ----------

// Suffix -> ARTIFACT_TYPES member. Order matters: DISCUSSION-LOG must be checked
// before PLAN-style generic matching since both end in '.md'; exact suffix match
// avoids ambiguity. The 7 GSD artifact types come from the Plan 01 frozen set.
const SUFFIX_MAP = [
  ['-SPEC.md', 'SPEC'],
  ['-CONTEXT.md', 'CONTEXT'],
  ['-RESEARCH.md', 'RESEARCH'],
  ['-VALIDATION.md', 'VALIDATION'],
  ['-VERIFICATION.md', 'VERIFICATION'],
  ['-DISCUSSION-LOG.md', 'DISCUSSION-LOG'],
  ['-PLAN.md', 'PLAN'],
];

// classifyArtifactType(filename) -- maps a .planning filename to one of the 7
// ARTIFACT_TYPES by suffix; returns null for non-artifact files (e.g. SUMMARY.md,
// README.md, or anything not matching a known suffix).
function classifyArtifactType(filename) {
  if (typeof filename !== 'string' || filename.length === 0) return null;
  const base = path.basename(filename);
  for (const [suffix, type] of SUFFIX_MAP) {
    if (base.endsWith(suffix)) return type;
  }
  return null;
}

// ---------- Requirement-id parsing ----------

// The established token family: 2+ uppercase letters, a hyphen, 1-3 digits, with
// an optional .N sub-id (e.g. IRW-06, GAM-02, ALP-01, AUTH-12.3). Used against
// both the SPEC numbered/bolded list AND the PLAN frontmatter bracketed list.
const REQ_ID_RE = /\b[A-Z]{2,}-\d{1,3}(?:\.\d+)?\b/g;

// parseRequirementIds(text) -- extract requirement ids via REQ_ID_RE; return a
// deduped, order-preserving array. Defensive: non-string input yields [].
function parseRequirementIds(text) {
  if (typeof text !== 'string' || text.length === 0) return [];
  const seen = new Set();
  const out = [];
  let m;
  REQ_ID_RE.lastIndex = 0;
  while ((m = REQ_ID_RE.exec(text)) !== null) {
    const id = m[0];
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

// Parse the frontmatter `requirements:` field of a PLAN, which is a bracketed
// inline list: `requirements: [IRW-01, IRW-06]`. Returns the deduped id array.
// Falls back to scanning the whole frontmatter block if the field is absent.
function parsePlanRequirements(text) {
  if (typeof text !== 'string' || text.length === 0) return [];
  const lines = text.split('\n');
  if (lines.length === 0 || lines[0].trim() !== '---') {
    return [];
  }
  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { endIdx = i; break; }
  }
  if (endIdx === -1) return [];
  const fmBlock = lines.slice(1, endIdx).join('\n');
  const fieldMatch = fmBlock.match(/^requirements:\s*(.+)$/m);
  const scope = fieldMatch ? fieldMatch[1] : fmBlock;
  return parseRequirementIds(scope);
}

// ---------- .planning/ discovery ----------

function safeIsDir(p) { try { return fs.statSync(p).isDirectory(); } catch (_) { return false; } }
function safeIsFile(p) { try { return fs.statSync(p).isFile(); } catch (_) { return false; } }

// Parse the frontmatter `status:` field, if present, for the node status property.
function parseStatus(text) {
  if (typeof text !== 'string' || text.length === 0) return 'present';
  const lines = text.split('\n');
  if (lines.length === 0 || lines[0].trim() !== '---') return 'present';
  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { endIdx = i; break; }
  }
  if (endIdx === -1) return 'present';
  for (let i = 1; i < endIdx; i++) {
    const sm = lines[i].match(/^status:\s*(.+)$/);
    if (sm) {
      let v = sm[1].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      return v.length > 0 ? v : 'present';
    }
  }
  return 'present';
}

// discoverPlanningArtifacts(planningDir) -- walk planningDir/phases/<phase>/*.md
// plus the top-level planningDir/*.md (ROADMAP-style), returning a list of
// { phase, artifactType, path, status }. status defaults to 'present'. Reads the
// markdown ONLY to classify + read the frontmatter status (source-of-meaning).
function discoverPlanningArtifacts(planningDir) {
  const out = [];
  if (!safeIsDir(planningDir)) return out;

  // Top-level phase folders.
  const phasesDir = path.join(planningDir, 'phases');
  if (safeIsDir(phasesDir)) {
    let phaseEntries = [];
    try {
      phaseEntries = fs.readdirSync(phasesDir, { withFileTypes: true });
    } catch (_) {
      phaseEntries = [];
    }
    for (const pe of phaseEntries) {
      if (!pe.isDirectory()) continue;
      const phaseName = pe.name;
      const phaseDir = path.join(phasesDir, phaseName);
      let files = [];
      try {
        files = fs.readdirSync(phaseDir, { withFileTypes: true });
      } catch (_) {
        files = [];
      }
      for (const f of files) {
        if (!f.isFile()) continue;
        const artifactType = classifyArtifactType(f.name);
        if (!artifactType) continue;
        const filePath = path.join(phaseDir, f.name);
        let status = 'present';
        try {
          status = parseStatus(fs.readFileSync(filePath, 'utf8'));
        } catch (_) { status = 'present'; }
        out.push({ phase: phaseName, artifactType: artifactType, path: filePath, status: status });
      }
    }
  }

  return out;
}

// ---------- The spine ----------

// resolvePlanningDir(roomDir, opts) -- roomDir/.planning by default, overridable
// via opts.planningDir (the plugin dog-foods its own .planning).
function resolvePlanningDir(roomDir, opts) {
  if (opts && typeof opts.planningDir === 'string' && opts.planningDir.length > 0) {
    return opts.planningDir;
  }
  return path.join(roomDir, '.planning');
}

// reconcilePlanningArtifacts(roomDir, opts) -- the ONE idempotent function.
//   opts.db          -- a caller-owned db handle (required for any write).
//   opts.planningDir -- override the planning dir (plugin self-dogfood).
// Returns { upserted, requirement_nodes, edges, pruned, unchanged }.
function reconcilePlanningArtifacts(roomDir, opts) {
  const options = opts || {};
  const db = options.db;
  const report = { upserted: 0, requirement_nodes: 0, edges: 0, pruned: 0, unchanged: 0 };
  if (!db) return report;

  const planningDir = resolvePlanningDir(roomDir, options);
  const artifacts = discoverPlanningArtifacts(planningDir);
  if (artifacts.length === 0) return report;

  // Group by phase so the per-phase lineage (SPEC -> CONTEXT -> PLAN) can be wired.
  const byPhase = new Map();
  for (const a of artifacts) {
    if (!byPhase.has(a.phase)) byPhase.set(a.phase, []);
    byPhase.get(a.phase).push(a);
  }

  // 1. Upsert every artifact node.
  for (const a of artifacts) {
    try {
      const res = navigation.writePlanningArtifactNode(db, {
        phase: a.phase,
        artifactType: a.artifactType,
        path: a.path,
        status: a.status,
      });
      if (res && res.ok) report.upserted += 1;
    } catch (_) { /* best-effort per-item; a bad artifact never aborts the pass */ }
  }

  // 2. Per-phase: parse requirements, upsert requirement nodes, wire lineage.
  for (const [phase, items] of byPhase.entries()) {
    const typeIndex = {};
    for (const it of items) {
      // First-of-type wins for the file-lineage anchors (SPEC/CONTEXT). PLANs and
      // VERIFICATIONs are handled as a list below.
      if (!typeIndex[it.artifactType]) typeIndex[it.artifactType] = it;
    }
    const plans = items.filter((it) => it.artifactType === 'PLAN');
    const verifications = items.filter((it) => it.artifactType === 'VERIFICATION');

    const specItem = typeIndex.SPEC || null;
    const contextItem = typeIndex.CONTEXT || null;

    const specNodeId = specItem ? navigation.ARTIFACT_NODE_ID(phase, 'SPEC') : null;
    const contextNodeId = contextItem ? navigation.ARTIFACT_NODE_ID(phase, 'CONTEXT') : null;

    // 2a. File lineage: SPEC FEEDS_INTO CONTEXT FEEDS_INTO each PLAN.
    if (specNodeId && contextNodeId) {
      report.edges += writeEdgeCounted(db, specNodeId, contextNodeId, 'FEEDS_INTO');
    }
    if (contextNodeId) {
      for (const pl of plans) {
        const planNodeId = navigation.ARTIFACT_NODE_ID(phase, 'PLAN');
        report.edges += writeEdgeCounted(db, contextNodeId, planNodeId, 'FEEDS_INTO');
        break; // PLAN node id is per-phase stable; a single FEEDS_INTO covers it.
      }
    }

    // 2b. SPEC requirement ids -> requirement nodes + requirement INFORMS SPEC.
    const specReqIds = [];
    if (specItem) {
      let specText = '';
      try { specText = fs.readFileSync(specItem.path, 'utf8'); } catch (_) { specText = ''; }
      const ids = parseRequirementIds(specText);
      for (const reqId of ids) {
        specReqIds.push(reqId);
        try {
          const rr = navigation.writeRequirementNode(db, { reqId: reqId, phase: phase });
          if (rr && rr.ok) report.requirement_nodes += 1;
        } catch (_) { /* best-effort */ }
        const reqNodeId = navigation.REQUIREMENT_NODE_ID(reqId);
        report.edges += writeEdgeCounted(db, reqNodeId, specNodeId, 'INFORMS');
      }
    }

    // 2c. PLAN frontmatter requirements -> requirement INFORMS PLAN (and ensure
    //     the requirement node exists even if it was only cited by the PLAN).
    for (const pl of plans) {
      let planText = '';
      try { planText = fs.readFileSync(pl.path, 'utf8'); } catch (_) { planText = ''; }
      const planReqIds = parsePlanRequirements(planText);
      const planNodeId = navigation.ARTIFACT_NODE_ID(phase, 'PLAN');
      for (const reqId of planReqIds) {
        if (specReqIds.indexOf(reqId) === -1) {
          // Requirement cited by the PLAN but not declared in the SPEC list.
          try {
            const rr = navigation.writeRequirementNode(db, { reqId: reqId, phase: phase });
            if (rr && rr.ok) report.requirement_nodes += 1;
          } catch (_) { /* best-effort */ }
        }
        const reqNodeId = navigation.REQUIREMENT_NODE_ID(reqId);
        report.edges += writeEdgeCounted(db, reqNodeId, planNodeId, 'INFORMS');
      }
    }

    // 2d. VERIFICATION VALIDATES each requirement declared for the phase.
    if (verifications.length > 0) {
      const verNodeId = navigation.ARTIFACT_NODE_ID(phase, 'VERIFICATION');
      for (const reqId of specReqIds) {
        const reqNodeId = navigation.REQUIREMENT_NODE_ID(reqId);
        report.edges += writeEdgeCounted(db, verNodeId, reqNodeId, 'VALIDATES');
      }
    }
  }

  return report;
}

// writeEdgeCounted -- thin wrapper that routes through navigation.writeLineageEdge
// (the Plan 01 LINEAGE-subset chokepoint) and returns 1 on success, 0 otherwise.
// Edges are upsert-idempotent on the (source, target, type) primary key, so a
// re-run writes the SAME row (count stays stable across passes).
function writeEdgeCounted(db, sourceId, targetId, edgeType) {
  try {
    const res = navigation.writeLineageEdge(db, {
      source_id: sourceId,
      target_id: targetId,
      edge_type: edgeType,
    });
    return res && res.ok ? 1 : 0;
  } catch (_) {
    return 0;
  }
}

module.exports = {
  reconcilePlanningArtifacts,
  parseRequirementIds,
  discoverPlanningArtifacts,
  classifyArtifactType,
};
