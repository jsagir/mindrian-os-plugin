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
// FCM-01/02: reuse the ONE frozen depth cap from coverage-rollup -- do NOT mint a
// second depth constant (Part 11 R11, Part 7 reuse). Root is depth 0; the fractal
// memory walk descends children to DEPTH_CAP inclusive and STOPS, so a
// depth-(DEPTH_CAP+1) sub-room is discovered by its parent but NEVER projected.
const { DEPTH_CAP } = require('../coverage-rollup.cjs');

// The per-folder memory basenames -> their kind (six shipped + DRIFT, the Phase
// 195 FCM-07 7th kind). Exact basename match; any other file classifies to null
// (mirrors classifyArtifactType's suffix map, but here the match is an exact
// basename, not a suffix). The kinds are the frozen MEMORY_KINDS set the 150-01
// writer validates against.
const BASENAME_TO_KIND = Object.freeze({
  'ROOM.md': 'ROOM',
  'STATE.md': 'STATE',
  'MINTO.md': 'MINTO',
  'BRAIN.md': 'BRAIN',
  'FEYNMAN.md': 'FEYNMAN',
  'USER.md': 'USER',
  // FCM-07: DRIFT is the 7th memory kind. The CODE registration lands
  // autonomously in this wave (Wave 1) so the navigator-gated canon 6->7
  // amendment (FCM-08, Wave 5) ratifies an already-wired basename. The per-folder
  // memory-kind DRIFT.md is a room-tree section artifact and is DISTINCT from the
  // Phase-150.9 .planning/DRIFT.md audit baseline that drift-baseline.cjs writes;
  // the reconciler never walks .planning/, so the two never collide (Pitfall 5).
  'DRIFT.md': 'DRIFT',
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

// walkFractalMemory(dir, sectionKey, depth, out) -- FCM-01/02 the depth-bounded
// fractal memory walk. At every level it scans `dir` for classified memory MD
// files (tagged with the depth-qualified sectionKey) then recurses into each
// ROOM.md-bearing sub-section via the shared sectionRegistry.discoverSections
// helper (NO hand-rolled walker -- Part 7 reuse). The descent is bounded by
// coverage-rollup's frozen DEPTH_CAP: the root is depth 0, children are walked to
// DEPTH_CAP inclusive and the walk STOPS, so a depth-(DEPTH_CAP+1) sub-room is
// discovered by its parent's discoverSections but is NEVER scanned or projected
// (Part 11 R11 depth-bounded rollup; identity-begets-memory, CLAUDE.md Decision
// #15: every room/section directory carries its own ROOM.md identity marker, and
// discoverSections already qualifies a folder only when it carries .md identity).
//
// Depth-qualified key (Pitfall 2 / threat T-195-05): the sectionKey is qualified
// with the sub-room's relative path (e.g. 'section-alpha/sub-room/sub-sub-room')
// so MEMORY_ARTIFACT_NODE_ID(section, kind) stays unique across depths -- two
// sub-rooms that share a bare section slug never collide on a node id.
//
// Entry-23 boundary (Appendix D entry 23, Pitfall 3 / threat T-195-03): this walk
// reads the FILESYSTEM structure ONLY (directory listings). It NEVER opens a
// sub-room's own room.db, so it can never read a child's NESTED_WITHIN edge rows
// across a room.db boundary. Where the recursion crosses a registered sub-room,
// only LOCAL scalars (section slug + kind + content hash) flow into the projection
// -- aggregate-scalar-only, never a cross-room edge read.
//
// It NEVER descends into a dot-directory (`.planning/`, `.rooms/`, `.git/`):
// discoverSections already skips hidden dirs, and the explicit dot guard below is
// belt-and-suspenders so the memory-kind DRIFT.md (a room-tree artifact) can never
// be sourced from the DISTINCT `.planning/DRIFT.md` audit baseline that
// drift-baseline.cjs writes (Pitfall 5, HARD disambiguation).
//
// Deferred design note: ZOOM re-rooting beyond DEPTH_CAP (treating a
// depth-(DEPTH_CAP+1) sub-room as a fresh depth-0 root of its own recursion) is
// intentionally OUT of 195 scope.
function walkFractalMemory(dir, sectionKey, depth, out) {
  scanDirForMemoryFiles(dir, sectionKey, out);
  if (depth >= DEPTH_CAP) return;

  let sections = [];
  try {
    const disc = sectionRegistry.discoverSections(dir);
    sections = (disc && Array.isArray(disc.all)) ? disc.all : [];
  } catch (_) {
    sections = [];
  }

  for (const child of sections) {
    // Never cross into a dot-directory (defense-in-depth over discoverSections'
    // hidden-dir skip). The `.planning/` tree carries a DISTINCT DRIFT.md audit
    // baseline that must NEVER become a memory source (Pitfall 5).
    if (typeof child !== 'string' || child.length === 0 || child.charAt(0) === '.') continue;
    const childDir = path.join(dir, child);
    const childKey = (sectionKey === ROOT_SECTION) ? child : sectionKey + '/' + child;
    walkFractalMemory(childDir, childKey, depth + 1, out);
  }
}

// discoverMemoryFiles(sectionRoot) -- walk the room's fractal section tree (via
// the shared section-registry discoverSections helper per level -- do NOT
// hand-roll a new walker) AND the room root itself, returning [{ section, kind,
// path }] for every classified memory MD found at the room root OR inside a
// ROOM.md-bearing sub-section, recursively to the frozen DEPTH_CAP. Reads no file
// body here; only the directory listing (the source-of-meaning structural read).
//
// FCM-01/02: previously a 1-level walk (root + one layer of sections). It now
// recurses into ROOM.md-bearing sub-rooms to depth 3, so the fractal memory
// invariant is enforced at every depth. Idempotence is FREE: reconcileMemoryArtifacts
// upserts each file on a stable (now depth-qualified) node id, so feeding it a
// deeper flat file list changes no other code path.
function discoverMemoryFiles(sectionRoot) {
  const out = [];
  if (!safeIsDir(sectionRoot)) return out;

  // The room root is depth 0. The canonical top-level STATE.md / USER.md / ROOM.md
  // live here (no section subfolder owns them) and are tagged ROOT_SECTION.
  walkFractalMemory(sectionRoot, ROOT_SECTION, 0, out);

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
// Used to pull the canonical id token out of a decision LIST-ITEM lead (e.g.
// 'PD-100' from 'DEC-PD-100', 'DEC-001' from 'DEC-001').
const DECISION_ID_RE = /\b[A-Z]{2,}-\d{1,4}(?:\.\d+)?\b/g;

// A decision is recognized ONLY at a leading list-item position terminated by a
// colon (MED-02): '- DEC-001: ...' or '* PD-100: ...'. This anchors the match so
// prose tokens like ISO-9001 / GPT-4 / RFC-2119 / SOC-2 / CVE-2024 (which appear
// mid-sentence, never as a colon-terminated list-item lead) can NEVER mint a
// spurious truth-claim decision node. The whole-body fallback is DROPPED: a MINTO
// without a decisions heading yields zero decisions, not a blast radius over the
// whole document.
//   group 1: the list-item LEAD (text before the first ':') -- the id token is
//            extracted from here so the id must sit at the colon-terminated lead.
//   group 2: the list-item REST (text after the colon, up to end-of-line) -- the
//            contradiction signal is scanned over the full item (lead + rest)
//            because the contradiction language ('never ship', 'users reject it')
//            lives in the decision body, not the id token.
const DECISION_LINE_RE = /^\s*[-*]\s+([^:\r\n]+?)\s*:([^\r\n]*)/gm;

// Contradiction-signaling tokens. A decision line whose lead carries one of these
// is classified kind='contradiction' (the archetype-escalation signal). Generic
// keyword presence only; the decision PROSE never leaves this function (only the
// id handle and the closed kind enum do). Word-boundary matched, case-insensitive.
const CONTRADICTION_SIGNAL_RE = /\b(never|reject|rejects|rejected|conflict|conflicts|conflicting|contradict|contradicts|contradicting|instead|abandon|must not|do not|don't)\b/i;

// extractDecisions(raw) -- pull decisions from a MINTO / decisions decision_log.
// Scans ONLY inside an explicit "## Decisions" / "## Decision Log" /
// "## Decisions Index" region (NO whole-body fallback -- MED-02), and ONLY at a
// leading colon-terminated list-item position. Returns a deduped,
// order-preserving array of { id, kind } where kind is 'contradiction' when the
// list-item lead carries a contradiction signal, else ''. The decision PROSE is
// never returned; only the generic id handle and the closed kind enum.
function extractDecisions(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return [];
  // Require an explicit decisions heading; without one there is no decision_log.
  const headingRe = /^##\s+(Decisions?|Decision Log|Decisions Index)\s*$/im;
  const hm = raw.match(headingRe);
  if (!hm) return [];
  const start = raw.indexOf(hm[0]);
  const after = raw.slice(start + hm[0].length);
  // Stop at the next ## heading so we never bleed into a later section.
  const nextHeading = after.search(/\n##\s+/);
  const scope = nextHeading === -1 ? after : after.slice(0, nextHeading);

  const seen = new Set();
  const out = [];
  let lm;
  DECISION_LINE_RE.lastIndex = 0;
  while ((lm = DECISION_LINE_RE.exec(scope)) !== null) {
    const lead = lm[1]; // the list-item text before the first ':'
    const rest = typeof lm[2] === 'string' ? lm[2] : ''; // the body after the ':'
    if (typeof lead !== 'string' || lead.length === 0) continue;
    // The id token must be present in the lead (a real decision id, not arbitrary
    // colon-terminated prose). Take the FIRST id token in the lead (preserves the
    // 'PD-100' from 'DEC-PD-100' / 'DEC-001' from 'DEC-001' semantics).
    DECISION_ID_RE.lastIndex = 0;
    const idm = DECISION_ID_RE.exec(lead);
    if (!idm) continue;
    const id = idm[0];
    if (seen.has(id)) continue;
    seen.add(id);
    // Scan the FULL list item (lead + body) for a contradiction signal -- the
    // contradiction language lives in the decision body, not the id token.
    const kind = CONTRADICTION_SIGNAL_RE.test(lead + ' ' + rest) ? 'contradiction' : '';
    out.push({ id: id, kind: kind });
  }
  return out;
}

// extractDecisionIds(raw) -- back-compat shim returning the id handles only.
// Retained for any caller that wants the id list without the kind enum.
function extractDecisionIds(raw) {
  return extractDecisions(raw).map((d) => d.id);
}

// Default staleness window for a governing thought (mirrors
// feynman-seed-writer.BODY_STALE_MS posture): a MINTO older than this is 'stale',
// else 'fresh'. 30 days in ms. A generic temporal threshold, not user content.
const GOVERNING_THOUGHT_STALE_MS = 30 * 24 * 60 * 60 * 1000;

// deriveFreshness(filePath, nowMs, staleMs) -- 'fresh' | 'stale' from the source
// MINTO file's mtime vs the staleness window. Best-effort: an unstattable file
// defaults to 'fresh' (presence-grounded). A generic temporal enum, never prose.
function deriveFreshness(filePath, nowMs, staleMs) {
  const now = typeof nowMs === 'number' ? nowMs : Date.now();
  const window = typeof staleMs === 'number' ? staleMs : GOVERNING_THOUGHT_STALE_MS;
  try {
    const st = fs.statSync(filePath);
    const mtime = st.mtimeMs;
    if (typeof mtime === 'number' && (now - mtime) > window) return 'stale';
  } catch (_) { /* unstattable -> default fresh */ }
  return 'fresh';
}

// The generic framework-name handles deriveBrainAnchors recognizes (mirrors
// lib/core/navigation/projections.cjs KNOWN_FRAMEWORK_HINTS -- the high-traffic
// Brain teaching-graph framework names). A BRAIN.md derivation that NAMES one of
// these (e.g. "Framework chain: SWOT then Porter") yields the matching generic
// handle. Framework names ONLY ever flow -- never BRAIN.md prose (Part 8).
const KNOWN_FRAMEWORK_HINTS = Object.freeze([
  'Beautiful Question Framework', 'Mullins 7 Domains', 'Porter Five Forces',
  'Jobs to be Done', 'Lean Canvas', 'Business Model Canvas',
  'Six Thinking Hats', 'Cynefin', 'Root Cause Analysis', 'First Principles',
  'Wardley Map', 'Scenario Planning', 'Design Thinking',
  'SWOT', 'JTBD', 'Porter', 'OKR',
]);

// extractBrainAnchors(raw) -- scan a BRAIN.md derivation for known generic
// framework-name handles. Order-preserving, deduped. Returns ONLY generic
// framework names (Part 8: never BRAIN.md prose). The longer multi-word names are
// scanned first so 'Porter Five Forces' wins over the bare 'Porter' substring.
function extractBrainAnchors(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return [];
  const out = [];
  const seen = new Set();
  for (const fw of KNOWN_FRAMEWORK_HINTS) {
    if (raw.indexOf(fw) !== -1 && !seen.has(fw)) {
      // Skip a bare substring already covered by a longer matched name (e.g.
      // do not also add 'Porter' when 'Porter Five Forces' already matched).
      const coveredByLonger = out.some((existing) => existing.indexOf(fw) !== -1 && existing !== fw);
      if (coveredByLonger) continue;
      seen.add(fw);
      out.push(fw);
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

  const nowMs = Date.now();

  // Count a writer result as 'upserted' (genuine insert/content change) or
  // 'unchanged' (no-op re-projection) per the writer's `changed` flag (MED-04).
  // A writer that does not report `changed` is conservatively counted upserted.
  function countWrite(res) {
    if (!res || !res.ok) return;
    if (res.changed === false) report.unchanged += 1;
    else report.upserted += 1;
  }

  // MED-03: resolve the room DESCRIBES target. The persona DESCRIBES the ROOM,
  // not the USER artifact (edges.cjs taxonomy: a navigator_persona DESCRIBES the
  // room node). Prefer the canonical _root ROOM memory_artifact; fall back to any
  // ROOM-kind memory_artifact discovered in the room. When no ROOM target exists
  // the DESCRIBES edge is SKIPPED (the persona node stands alone) rather than
  // mis-wired to the USER artifact.
  let roomTargetNodeId = null;
  const hasRootRoom = files.some((f) => f.section === ROOT_SECTION && f.kind === 'ROOM');
  if (hasRootRoom) {
    roomTargetNodeId = navigation.MEMORY_ARTIFACT_NODE_ID(ROOT_SECTION, 'ROOM');
  } else {
    const anyRoom = files.find((f) => f.kind === 'ROOM');
    if (anyRoom) {
      roomTargetNodeId = navigation.MEMORY_ARTIFACT_NODE_ID(anyRoom.section, anyRoom.kind);
    }
  }

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

    // LOW-03: store a ROOM-RELATIVE path handle, never the absolute filesystem
    // path (an absolute path is user-identifying -- home dir + room layout -- and
    // a latent egress surface). The generic source_path already carries the
    // memory:<section>:<kind> identity; the room-relative path is a minimal LOCAL
    // locator. Best-effort relativize; on any failure fall back to the basename.
    let relPath;
    try {
      relPath = path.relative(sectionRoot, f.path);
    } catch (_) { relPath = ''; }
    if (typeof relPath !== 'string' || relPath.length === 0 || relPath.startsWith('..')) {
      relPath = path.basename(f.path);
    }

    // HIGH-01: a BRAIN-kind file carries Phase-90 derivation framework anchors.
    // Derive the generic framework-name handles (never BRAIN.md prose, Part 8) so
    // deriveBrainAnchors lands a non-empty set on real reconcile output.
    const anchors = (f.kind === 'BRAIN') ? extractBrainAnchors(body) : [];

    // 2. Upsert the memory_artifact node (system-bookkeeping; created_by=system).
    try {
      const res = navigation.writeMemoryArtifactNode(db, {
        section: f.section,
        kind: f.kind,
        path: relPath,
        hash: hash,
        anchors: anchors,
      });
      countWrite(res);
    } catch (_) { /* best-effort per-item; a bad memory file never aborts the pass */ }

    const memoryNodeId = navigation.MEMORY_ARTIFACT_NODE_ID(f.section, f.kind);

    // 3. Richer projections per kind.
    if (f.kind === 'MINTO') {
      // 3a. governing_thought (hash handle + freshness enum) STATES the section.
      const gt = extractGoverningThought(body);
      if (gt) {
        try {
          // HIGH-01: derive freshness from the source MINTO mtime vs the staleness
          // window so buildReachScoresFromCortex can read the 'fresh' prior.
          const freshness = deriveFreshness(f.path, nowMs, GOVERNING_THOUGHT_STALE_MS);
          const gr = navigation.writeGoverningThoughtNode(db, {
            section: f.section,
            hash: sha256Hex(gt),
            freshness: freshness,
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
      const decisions = extractDecisions(body);
      for (const decision of decisions) {
        try {
          const dr = navigation.writeDecisionNode(db, {
            decisionId: decision.id,
            section: f.section,
            summaryHash: sha256Hex(decision.id + ':' + f.section),
            source: 'minto_decision_log',
            // HIGH-01: pass the contradiction kind through so hasContradiction +
            // the D-02 archetype escalation fire on real reconcile output. A
            // closed enum, never decision prose (Part 8). '' drops the key.
            kind: decision.kind || undefined,
          });
          if (dr && dr.ok) {
            report.decision_nodes += 1;
            const decNodeId = navigation.DECISION_NODE_ID(decision.id);
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
            // MED-03: persona DESCRIBES the ROOM (the _root ROOM memory_artifact,
            // or any ROOM-kind artifact). When no ROOM target exists the persona
            // node stands alone and the edge is SKIPPED -- never mis-wired to the
            // USER memory_artifact.
            if (roomTargetNodeId) {
              report.edges += writeEdgeCounted(db, personaNodeId, roomTargetNodeId, 'DESCRIBES');
            }
          }
        } catch (_) { /* best-effort */ }
      }
    } else if (f.kind === 'DRIFT') {
      // 3d. FCM-07 DRIFT projection (minimal, RESEARCH A5). The per-folder DRIFT.md
      //     intent-vs-actual ledger projects as a plain memory_artifact node --
      //     already written generically above via writeMemoryArtifactNode (the
      //     unconditional per-file upsert), exactly like the ROOM/STATE kinds,
      //     which also carry no richer branch. This branch is the documented seam
      //     where a richer typed drift-ledger node (intent-vs-actual deltas) would
      //     land; that projection is a deferred follow-on kept OUT of 195 scope to
      //     keep the wave tight. DRIFT is LOCAL only: a drift entry NEVER egresses
      //     to the Brain (Part 8). NO canon bytes this wave; the canon 6->7
      //     amendment is GATED (FCM-08, Wave 5). No richer projection here by design.
      void memoryNodeId;
    }
  }

  return report;
}

module.exports = {
  reconcileMemoryArtifacts,
  classifyMemoryFile,
  discoverMemoryFiles,
  // HIGH-01 / MED-02 generic-handle extractors (test seam).
  extractDecisions,
  extractDecisionIds,
  extractBrainAnchors,
  deriveFreshness,
};
