'use strict';
/*
 * Phase 150-03 (MEM-01) -- reconcile-memory-runner: the idempotent backfill =
 * sync spine for the USER-memory cortex (the per-folder memory MD files to
 * local-graph bridge). The user-memory twin of Phase 149-02
 * lib/core/planning/reconcile-runner.cjs.
 *
 * ONE function -- reconcileMemoryArtifacts(roomDir, opts) -- walks the room's
 * section folders, classifies each per-folder memory MD file by basename into
 * one of {ROOM, STATE, MINTO, BRAIN, FEYNMAN, USER}, upserts its memory_artifact
 * node, and projects the richer typed nodes where the content warrants:
 *   - governing_thought (from a MINTO governing-thought) STATES the section
 *   - navigator_persona  (from a USER role_blend x journey_stage) DESCRIBES the room
 *   - decision           (from a MINTO / decisions decision_log) INFORMS the section
 * via the 150-01 writers through the lib/core/navigation.cjs chokepoint.
 *
 * Idempotence is FREE: every write is an upsert keyed on a stable node/edge id
 * (the 150-01 contract), so a second pass over an unchanged room changes no
 * counts. This is D-02: backfill and ongoing sync are the SAME code path.
 *
 * Mirrors lib/core/planning/reconcile-runner.cjs + lib/core/feynman/
 * timeline-runner.cjs end-to-end:
 *   - takes opts.db, a caller-owned db handle (NEVER opens room.db itself).
 *   - reads room DATA ONLY via lib/core/navigation.cjs (the Phase 109 chokepoint).
 *   - requires ONLY navigation.cjs + section-registry.cjs (the shared section
 *     discovery helper) + node:fs + node:path + node:crypto (for the sha256
 *     content-hash handle). NO brain-client, NO node:http/https, NO fetch --
 *     the MEM-01 / Canon Part 8 zero-egress floor.
 *   - best-effort per-item try/catch so one bad memory file never aborts the pass.
 *
 * Canon Part 9: the memory markdown is the SOURCE-OF-MEANING read (role 1: Files
 *   preserve meaning). The reconcile reads it LOCALLY to derive generic handles
 *   (kind, section, governing-thought sha256, persona enum, decision id) -- never
 *   room state. Room DATA (nodes, edges) is read and written ONLY via
 *   navigation.cjs (role 2: SQL remembers and navigates). The memory BODY never
 *   lands on a node or edge; only sha256 handles and section/kind/enum scalars do.
 *
 * Canon Part 8: zero network surface. The memory prose never leaves the room.
 *
 * Canon Part 9 audit-node carve-out: memory_artifact / governing_thought /
 *   navigator_persona are system-bookkeeping nodes (the 150-01 writers mint them
 *   created_by='system' review_status='confirmed'). The decision node is the ONE
 *   truth-claim projection -- the 150-01 writeDecisionNode mints it at 'proposed'
 *   (never auto-confirmed); only a human confirmNode path promotes it. This
 *   reconcile never overrides that contract.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 *
 * Exports:
 *   reconcileMemoryArtifacts(roomDir, opts)
 *     -> { upserted, decision_nodes, edges, unchanged }
 *   classifyMemoryFile(filename)  -> MEMORY_KINDS member | null
 *   discoverMemoryFiles(sectionRoot) -> [{ section, kind, path }]
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const navigation = require('../navigation.cjs');
const sectionRegistry = require('../section-registry.cjs');

// The six per-folder memory basenames -> their kind. Exact basename match; any
// other file classifies to null (mirrors classifyArtifactType's suffix map, but
// here the match is an exact basename, not a suffix). The kinds are the frozen
// MEMORY_KINDS set the 150-01 writer validates against.
const BASENAME_TO_KIND = Object.freeze({
  'ROOM.md': 'ROOM',
  'STATE.md': 'STATE',
  'MINTO.md': 'MINTO',
  'BRAIN.md': 'BRAIN',
  'FEYNMAN.md': 'FEYNMAN',
  'USER.md': 'USER',
});

// classifyMemoryFile(filename) -- maps a per-folder memory filename to one of
// MEMORY_KINDS by exact basename. Returns null for any other file. Case-exact
// (state.md does NOT match STATE.md): the memory contract is the uppercase
// basenames.
function classifyMemoryFile(filename) {
  if (typeof filename !== 'string' || filename.length === 0) return null;
  const base = path.basename(filename);
  const kind = BASENAME_TO_KIND[base];
  return kind || null;
}

// ---------- fs guards ----------

function safeIsDir(p) { try { return fs.statSync(p).isDirectory(); } catch (_) { return false; } }
function safeIsFile(p) { try { return fs.statSync(p).isFile(); } catch (_) { return false; } }

// sha256 of a string -> hex handle. A GENERIC content handle; the prose itself
// never leaves this function.
function sha256Hex(s) {
  return crypto.createHash('sha256').update(typeof s === 'string' ? s : '', 'utf8').digest('hex');
}

// ---------- Section discovery + memory-file walk ----------

// The stable section label for a memory MD that lives directly at the room root
// (the top-level ICM Layer 0 directory -- per CLAUDE.md decision 15 every
// directory carries identity, and the canonical top-level STATE.md / USER.md /
// ROOM.md live at the room root, not inside a section folder). discoverSections
// only walks SUB-folders, so a root-level memory file would otherwise be missed.
// The sentinel is a generic handle (never user prose) and keys the stable
// memory_artifact node id 'memory_artifact:_root:<KIND>'.
const ROOT_SECTION = '_root';

// scanDirForMemoryFiles(dir, section, out) -- push every classified memory MD
// found directly inside `dir` (non-recursive) tagged with `section`. Reads no
// file body here; only the directory listing (the source-of-meaning structural
// read).
function scanDirForMemoryFiles(dir, section, out) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    entries = [];
  }
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    const kind = classifyMemoryFile(ent.name);
    if (!kind) continue;
    out.push({ section: section, kind: kind, path: path.join(dir, ent.name) });
  }
}

// discoverMemoryFiles(sectionRoot) -- walk the room's section folders (via the
// shared section-registry discoverSections helper -- do NOT hand-roll a new
// walker) AND the room root itself, returning [{ section, kind, path }] for
// every classified memory MD found directly inside a section folder OR at the
// room root. Reads no file body here; only the directory listing (the
// source-of-meaning structural read).
function discoverMemoryFiles(sectionRoot) {
  const out = [];
  if (!safeIsDir(sectionRoot)) return out;

  // 1. Root-level memory files (top-level ICM Layer 0 directory). The room root
  //    carries the canonical top-level STATE.md / USER.md / ROOM.md that no
  //    section subfolder owns; discoverSections never returns the root itself.
  scanDirForMemoryFiles(sectionRoot, ROOT_SECTION, out);

  // 2. Per-section memory files (the section subfolders).
  let sections = [];
  try {
    const disc = sectionRegistry.discoverSections(sectionRoot);
    sections = (disc && Array.isArray(disc.all)) ? disc.all : [];
  } catch (_) {
    sections = [];
  }

  for (const section of sections) {
    const sectionDir = path.join(sectionRoot, section);
    scanDirForMemoryFiles(sectionDir, section, out);
  }
  out.sort((a, b) => {
    if (a.section !== b.section) return a.section.localeCompare(b.section);
    return a.kind.localeCompare(b.kind);
  });
  return out;
}

// ---------- Generic-handle extractors (LOCAL prose -> generic handles) ----------

// extractGoverningThought(raw) -- the MINTO governing-thought, as PROSE (we
// hash it before it ever lands on a node). Frontmatter scalar OR first body
// paragraph under "## Governing Thought". Mirrors
// scripts/vault-section-minto-generator.cjs extractGoverningThought.
function extractGoverningThought(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return '';
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fmMatch) {
    const m = fmMatch[1].match(/^governing_thought:\s*(.+)$/m);
    if (m) {
      let v = m[1].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      v = v.replace(/\\"/g, '"');
      return v;
    }
  }
  const idx = raw.indexOf('## Governing Thought');
  if (idx !== -1) {
    const lines = raw.slice(idx).split(/\r?\n/);
    for (let i = 1; i < lines.length; i++) {
      const t = lines[i].trim();
      if (!t) continue;
      if (t.startsWith('#')) break;
      return t.replace(/^>+\s*/, '').trim();
    }
  }
  return '';
}

// extractPersona(raw) -- the USER role_blend + journey_stage as GENERIC handles
// only: a dominant-role enum string and the journey-stage enum. The raw
// role-weight prose never leaves this function; we return enum scalars.
function extractPersona(raw) {
  const result = { roleBlend: '', journeyStage: '' };
  if (typeof raw !== 'string' || raw.length === 0) return result;
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fm = fmMatch ? fmMatch[1] : '';

  // journey_stage: scalar.
  const jm = fm.match(/^journey_stage:\s*(.+)$/m);
  if (jm) {
    let v = jm[1].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    result.journeyStage = v;
  }

  // role_blend: derive the dominant-role enum from the nested weight block (a
  // generic handle, not the full weight vector). Prefer an explicit
  // canonical_role scalar if present; else pick the max-weight axis.
  const cr = fm.match(/^canonical_role:\s*(.+)$/m);
  if (cr) {
    let v = cr[1].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (v && v !== 'null') result.roleBlend = v;
  }
  if (!result.roleBlend) {
    // Scan the role_blend: nested block for the heaviest axis.
    const rbIdx = fm.indexOf('role_blend:');
    if (rbIdx !== -1) {
      const rest = fm.slice(rbIdx).split(/\r?\n/);
      let bestAxis = '';
      let bestWeight = -1;
      for (let i = 1; i < rest.length; i++) {
        const ln = rest[i];
        // A nested axis line is indented; an un-indented line ends the block.
        if (!/^\s+/.test(ln)) break;
        const am = ln.match(/^\s+([A-Za-z_][A-Za-z0-9_]*):\s*([-0-9.]+)\s*$/);
        if (!am) continue;
        const w = Number(am[2]);
        if (Number.isFinite(w) && w > bestWeight) {
          bestWeight = w;
          bestAxis = am[1];
        }
      }
      if (bestAxis && bestWeight > 0) result.roleBlend = bestAxis;
    }
  }
  return result;
}

// The established decision-id token family (mirrors reconcile-runner's
// REQ_ID_RE shape): 2+ uppercase letters, a hyphen, 1-4 digits, optional .N.
const DECISION_ID_RE = /\b[A-Z]{2,}-\d{1,4}(?:\.\d+)?\b/g;

// extractDecisionIds(raw) -- pull decision ids from a MINTO / decisions
// decision_log. Looks at the "## Decisions" / "## Decision Log" / decisions_index
// region; falls back to the whole body. Returns a deduped, order-preserving id
// array. The decision PROSE is never returned; only the generic id handles and a
// per-decision sha256 summary handle (computed by the caller).
function extractDecisionIds(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return [];
  // Prefer a decision section so we do not pull unrelated tokens from prose.
  let scope = raw;
  const headingRe = /^##\s+(Decisions?|Decision Log|Decisions Index)\s*$/im;
  const hm = raw.match(headingRe);
  if (hm) {
    const start = raw.indexOf(hm[0]);
    const after = raw.slice(start + hm[0].length);
    // Stop at the next ## heading.
    const nextHeading = after.search(/\n##\s+/);
    scope = nextHeading === -1 ? after : after.slice(0, nextHeading);
  }
  const seen = new Set();
  const out = [];
  let m;
  DECISION_ID_RE.lastIndex = 0;
  while ((m = DECISION_ID_RE.exec(scope)) !== null) {
    const id = m[0];
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

// ---------- The spine ----------

// resolveSectionRoot(roomDir, opts) -- roomDir by default, overridable via
// opts.sectionRoot (the plugin dog-foods its own per-folder memory files when
// the active room IS the plugin workspace).
function resolveSectionRoot(roomDir, opts) {
  if (opts && typeof opts.sectionRoot === 'string' && opts.sectionRoot.length > 0) {
    return opts.sectionRoot;
  }
  return roomDir;
}

// writeEdgeCounted -- thin wrapper routing through navigation.writeCortexLineageEdge
// (the 150-01 CORTEX-subset chokepoint) returning 1 on success, 0 otherwise.
// Edges are upsert-idempotent on the (source, target, type) primary key, so a
// re-run writes the SAME row (count stays stable across passes).
function writeEdgeCounted(db, sourceId, targetId, edgeType) {
  try {
    const res = navigation.writeCortexLineageEdge(db, {
      source_id: sourceId,
      target_id: targetId,
      edge_type: edgeType,
    });
    return res && res.ok ? 1 : 0;
  } catch (_) {
    return 0;
  }
}

// reconcileMemoryArtifacts(roomDir, opts) -- the ONE idempotent function.
//   opts.db          -- a caller-owned db handle (required for any write).
//   opts.sectionRoot -- override the section root (plugin self-dogfood).
// Returns { upserted, decision_nodes, edges, unchanged }.
function reconcileMemoryArtifacts(roomDir, opts) {
  const options = opts || {};
  const db = options.db;
  const report = { upserted: 0, decision_nodes: 0, edges: 0, unchanged: 0 };
  if (!db) return report;

  const sectionRoot = resolveSectionRoot(roomDir, options);
  const files = discoverMemoryFiles(sectionRoot);
  if (files.length === 0) return report;

  // The persona node is one-per-room; remember the navigator_persona node id so a
  // single USER.md DESCRIBES edge can be wired even when several sections each
  // carry no USER file.
  const personaNodeId = navigation.NAVIGATOR_PERSONA_NODE_ID();
  let personaProjected = false;

  for (const f of files) {
    // 1. Read the body LOCALLY (source-of-meaning) and hash it (generic handle).
    let body = '';
    try { body = fs.readFileSync(f.path, 'utf8'); } catch (_) { body = ''; }
    const hash = sha256Hex(body);

    // 2. Upsert the memory_artifact node (system-bookkeeping; created_by=system).
    try {
      const res = navigation.writeMemoryArtifactNode(db, {
        section: f.section,
        kind: f.kind,
        path: f.path,
        hash: hash,
      });
      if (res && res.ok) report.upserted += 1;
    } catch (_) { /* best-effort per-item; a bad memory file never aborts the pass */ }

    const memoryNodeId = navigation.MEMORY_ARTIFACT_NODE_ID(f.section, f.kind);

    // 3. Richer projections per kind.
    if (f.kind === 'MINTO') {
      // 3a. governing_thought (hash handle only) STATES the section.
      const gt = extractGoverningThought(body);
      if (gt) {
        try {
          const gr = navigation.writeGoverningThoughtNode(db, {
            section: f.section,
            hash: sha256Hex(gt),
          });
          if (gr && gr.ok) {
            const gtNodeId = navigation.GOVERNING_THOUGHT_NODE_ID(f.section);
            // governing_thought STATES section (the section's memory_artifact node).
            report.edges += writeEdgeCounted(db, gtNodeId, memoryNodeId, 'STATES');
          }
        } catch (_) { /* best-effort */ }
      }
      // 3b. decision_log -> decision node(s) INFORM the section. TRUTH-CLAIM:
      //     writeDecisionNode mints at 'proposed' (never auto-confirmed).
      const decisionIds = extractDecisionIds(body);
      for (const decisionId of decisionIds) {
        try {
          const dr = navigation.writeDecisionNode(db, {
            decisionId: decisionId,
            section: f.section,
            summaryHash: sha256Hex(decisionId + ':' + f.section),
            source: 'minto_decision_log',
          });
          if (dr && dr.ok) {
            report.decision_nodes += 1;
            const decNodeId = navigation.DECISION_NODE_ID(decisionId);
            // decision INFORMS section.
            report.edges += writeEdgeCounted(db, decNodeId, memoryNodeId, 'INFORMS');
          }
        } catch (_) { /* best-effort */ }
      }
    } else if (f.kind === 'USER' && !personaProjected) {
      // 3c. navigator_persona (role-blend + journey-stage enums) DESCRIBES room.
      const persona = extractPersona(body);
      if (persona.roleBlend || persona.journeyStage) {
        try {
          const pr = navigation.writeNavigatorPersonaNode(db, {
            roleBlend: persona.roleBlend,
            journeyStage: persona.journeyStage,
          });
          if (pr && pr.ok) {
            personaProjected = true;
            // persona DESCRIBES the room (the room ROOM memory_artifact, if one
            // exists; else the persona node stands alone as a system-bookkeeping
            // node and the edge is skipped). We point DESCRIBES at the USER
            // memory_artifact node so the edge always has a real target.
            report.edges += writeEdgeCounted(db, personaNodeId, memoryNodeId, 'DESCRIBES');
          }
        } catch (_) { /* best-effort */ }
      }
    }
  }

  return report;
}

module.exports = {
  reconcileMemoryArtifacts,
  classifyMemoryFile,
  discoverMemoryFiles,
};
