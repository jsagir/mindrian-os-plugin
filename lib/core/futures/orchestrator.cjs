/**
 * MindrianOS Plugin -- Futures Wheel orchestrator (Phase 156, Wave 1 shell)
 *
 * This is the interface-first SHELL for the /mos:futures pipeline. It owns the
 * consequence frontmatter CONTRACT (horizon / confidence / PESTEL domain) and the
 * bounded depth / fan-out cap CONSTANTS that the later waves build against, so
 * Wave 2 receives the contract in-hand and never explores for it.
 *
 * Wave 1 scope (this file): the cap constants, the two frozen enums, and
 * validateConsequenceFrontmatter (FW-04). ZERO graph writes, ZERO HSI surface,
 * ZERO Larry generation loop -- those land in Waves 2-4 (clearly labeled stubs
 * below). Canon Part 8: everything local, zero Brain egress.
 *
 * Pure Node.js built-ins only (zero npm deps per Phase 10 decision).
 * Reuses opportunity-ops.parseFrontmatter for any frontmatter parsing
 * (Part 7: do NOT hand-roll a YAML parser).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { parseFrontmatter } = require('../opportunity-ops.cjs');
const navigation = require('../navigation.cjs');
const { flagCausalCue } = require('./causal-cue.cjs');
// Phase 272 D-04: the single dispatch chokepoint deciding CJS vs Python for
// both this file's spawn sites (runHsiScan's compute-hsi.py call and
// runRSReverseSalient's rs-engine.py call below). No other function in this
// file decides backend selection directly.
const rsBackendDispatch = require('../rs-backend-dispatch.cjs');
const hsiEngine = require('../hsi-engine.cjs');
const rsEngineCjs = require('../rs-engine.cjs');

// --- Bounded caps (FW-02) ---
// The wheel "explodes in complexity, mathematically unmanageable without
// software" -- these caps keep it tractable. Navigator-overridable, but every
// override is CLAMPED to the cap maximum (a navigator may shrink, never exceed).
const FUTURES_DEPTH_CAP = 3;   // default + maximum number of rings
const FUTURES_FANOUT_CAP = 5;  // default + maximum children per node

// --- Frozen enums (FW-04) ---
const HORIZON_ENUM = Object.freeze(['near', 'mid', 'long']);
const PESTEL_DOMAIN_ENUM = Object.freeze([
  'Political',
  'Economic',
  'Social',
  'Technological',
  'Environmental',
  'Legal',
]);

/**
 * Resolve the effective depth cap, clamping a navigator override to the maximum.
 * A navigator may request fewer rings; never more than FUTURES_DEPTH_CAP.
 *
 * @param {Object} [opts]
 * @param {number} [opts.depth] - requested ring depth
 * @returns {number} effective depth (1..FUTURES_DEPTH_CAP)
 */
function resolveDepthCap(opts) {
  opts = opts || {};
  const requested = Number.isFinite(opts.depth) ? Math.floor(opts.depth) : FUTURES_DEPTH_CAP;
  if (requested < 1) return 1;
  if (requested > FUTURES_DEPTH_CAP) return FUTURES_DEPTH_CAP;
  return requested;
}

/**
 * Resolve the effective fan-out cap, clamping a navigator override to the maximum.
 *
 * @param {Object} [opts]
 * @param {number} [opts.fanout] - requested per-node fan-out
 * @returns {number} effective fan-out (1..FUTURES_FANOUT_CAP)
 */
function resolveFanoutCap(opts) {
  opts = opts || {};
  const requested = Number.isFinite(opts.fanout) ? Math.floor(opts.fanout) : FUTURES_FANOUT_CAP;
  if (requested < 1) return 1;
  if (requested > FUTURES_FANOUT_CAP) return FUTURES_FANOUT_CAP;
  return requested;
}

/**
 * Validate a consequence frontmatter object against the FW-04 contract:
 *   - horizon is in HORIZON_ENUM
 *   - confidence is a float in the inclusive range 0.0-1.0
 *   - domain is in PESTEL_DOMAIN_ENUM
 *
 * Advisory-free: this is a hard structural validator (the contract Wave 2's
 * generation loop writes against). It NEVER mutates the input.
 *
 * @param {Object} fm - the consequence frontmatter object (or a parsed string)
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateConsequenceFrontmatter(fm) {
  const errors = [];

  // Accept a raw markdown/frontmatter string by reusing the shipped parser.
  if (typeof fm === 'string') {
    fm = parseFrontmatter(fm);
  }
  if (!fm || typeof fm !== 'object') {
    return { valid: false, errors: ['frontmatter is not an object'] };
  }

  // horizon: enum
  if (!HORIZON_ENUM.includes(fm.horizon)) {
    errors.push(
      'horizon must be one of ' + HORIZON_ENUM.join(' / ') + ' (got ' + String(fm.horizon) + ')'
    );
  }

  // confidence: float in [0.0, 1.0]
  const conf = fm.confidence;
  if (typeof conf !== 'number' || Number.isNaN(conf)) {
    errors.push('confidence must be a number (got ' + String(conf) + ')');
  } else if (conf < 0 || conf > 1) {
    errors.push('confidence must be in the inclusive range 0.0-1.0 (got ' + conf + ')');
  }

  // domain: enum
  if (!PESTEL_DOMAIN_ENUM.includes(fm.domain)) {
    errors.push(
      'domain must be one of ' + PESTEL_DOMAIN_ENUM.join(' / ') + ' (got ' + String(fm.domain) + ')'
    );
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Wave 2 surface (FW-02 / FW-05 / FW-06)
//
// generateRing       -- the bounded guided-by-ring generation loop (D-01).
// writeCascadeEdges  -- the ROOT_CAUSES / ENABLES cascade-edge writer (Part 9
//                       chokepoint navigation.writeEdge ONLY; never raw SQL).
// registerConsequenceArtifacts -- files each consequence as a nested .md AND
//                       registers it as a type='Artifact' node in room.db.
// assertArtifactCountMatchesFiled -- the LANDMINE #1 precondition guard.
// runHsiScan         -- the ordered register->assert->compute-hsi->hsi-to-graph
//                       ->read-back sequencer.
// ---------------------------------------------------------------------------

// --- Forbidden non-frozen edge types (RESEARCH landmine #2) ---
// HSI_CONNECTION / REVERSE_SALIENT are NOT in ALLOWED_EDGE_TYPES; they go ONLY
// through scripts/hsi-to-graph.cjs raw SQL, NEVER through navigation.writeEdge.
// The non-frozen causal aliases (the LEADS-TO / generic-cause variants) are
// never referenced here; only the frozen ROOT_CAUSES type is written.

/**
 * Slugify a free-text label into a filesystem-safe, lowercase, hyphenated slug.
 * Pure ASCII transform (no em-dashes, only hyphens). Used for the nested
 * Obsidian folder names (CLAUDE.md decision 16) under opportunity-bank/.
 * @param {string} label
 * @returns {string}
 */
function slugify(label) {
  return String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'consequence';
}

/**
 * Compute the room-relative Artifact id for a consequence .md path. MUST match
 * the id convention used by lib/core/lazygraph-ops.cjs::getArtifactId AND by
 * scripts/compute-hsi.py::discover_artifacts (room-relative path, .md stripped,
 * forward-slashed) so the registered Artifact node id and the HSI pair endpoint
 * id are byte-identical. Without this, hsi-to-graph silently writes zero edges.
 * @param {string} roomDir
 * @param {string} mdPath - absolute path to the consequence .md
 * @returns {string}
 */
function consequenceArtifactId(roomDir, mdPath) {
  const rel = path.relative(path.resolve(roomDir), path.resolve(mdPath));
  return rel.replace(/\.md$/, '').replace(/\\/g, '/');
}

/**
 * generateRing -- the bounded D-01 "and then what?" expansion (FW-02).
 *
 * Ring 1 is generated directly from the seed; ring N>1 expands ONLY the approved
 * parents, each into at most FUTURES_FANOUT_CAP children. ringNumber is clamped
 * to FUTURES_DEPTH_CAP and per-parent children to FUTURES_FANOUT_CAP so the wheel
 * cannot balloon (the guard that MUST run before the HSI O(n^2) pairing).
 *
 * Prose generation is Larry-driven on Desktop/Cowork; on CLI the function
 * accepts a pre-supplied consequence batch (opts.children for ring 1, or
 * parent.children on each parent for ring N>1) so it is unit-testable headlessly.
 *
 * Each returned consequence object carries: id, ring, parent_id (null for ring
 * 1), horizon, confidence, domain, label, and a causal_cue annotation. The
 * domain is validated via validateConsequenceFrontmatter; an invalid consequence
 * is skipped (advisory, never throws on a single bad child).
 *
 * @param {string} seed - the seed label / focus (ring-1 driver)
 * @param {number} ringNumber - requested ring (clamped to FUTURES_DEPTH_CAP)
 * @param {Array<Object>} parents - approved parent consequence objects (ring N>1)
 * @param {Object} [opts]
 * @param {Array<Object>} [opts.children] - pre-supplied ring-1 children batch
 * @param {number} [opts.fanout] - navigator fan-out override (clamped)
 * @returns {Array<Object>} the bounded ring-N consequence objects
 */
function generateRing(seed, ringNumber, parents, opts) {
  opts = opts || {};
  // Clamp the ring number to the depth cap (FW-02: caps clamp, never error).
  const ring = resolveDepthCap({ depth: ringNumber });
  const fanout = resolveFanoutCap({ fanout: opts.fanout });

  const out = [];

  /**
   * Normalize + validate one raw child into a consequence object. Returns null
   * when the child fails the frontmatter contract (skip, do not throw).
   */
  function buildConsequence(raw, parentId) {
    if (!raw || typeof raw !== 'object') return null;
    const label = String(raw.label || raw.title || '').trim();
    const fm = {
      horizon: raw.horizon,
      confidence: raw.confidence,
      domain: raw.domain,
    };
    const v = validateConsequenceFrontmatter(fm);
    if (!v.valid) return null;
    const cue = flagCausalCue(label + ' ' + String(raw.body || ''));
    return {
      id: raw.id || (slugify(label) + '-r' + ring),
      ring,
      parent_id: parentId,
      horizon: fm.horizon,
      confidence: fm.confidence,
      domain: fm.domain,
      label,
      body: typeof raw.body === 'string' ? raw.body : '',
      causal_cue: cue.flag,
      cue_matched: cue.matched,
    };
  }

  if (ring === 1) {
    // Ring 1: generated from the seed. Children clamped to the fan-out cap.
    const batch = Array.isArray(opts.children) ? opts.children.slice(0, fanout) : [];
    for (const raw of batch) {
      const c = buildConsequence(raw, null);
      if (c) out.push(c);
    }
    return out;
  }

  // Ring N>1: expand ONLY the approved parents, each into at most `fanout`
  // children, stamping ring N and the parent link.
  const parentList = Array.isArray(parents) ? parents : [];
  for (const parent of parentList) {
    if (!parent || typeof parent.id !== 'string') continue;
    const rawChildren = Array.isArray(parent.children) ? parent.children.slice(0, fanout) : [];
    for (const raw of rawChildren) {
      const c = buildConsequence(raw, parent.id);
      if (c) out.push(c);
    }
  }
  return out;
}

/**
 * writeCascadeEdges -- write a ROOT_CAUSES edge (source=parent CAUSE,
 * target=child EFFECT) for every consequence carrying a non-null parent_id, via
 * the navigation.writeEdge chokepoint ONLY (Part 9). ROOT_CAUSES is the frozen
 * cascade edge for the parent->child causal link (added to ALLOWED_EDGE_TYPES by
 * Phase 150.8). An explicit enabling relation requests ENABLES.
 *
 * NOTE (Wave 2 deviation, Rule 1): the plan and 156-RESEARCH assumed ENABLES is
 * in the frozen ALLOWED_EDGE_TYPES set; it is NOT (only ROOT_CAUSES is). Because
 * the Part 9 chokepoint + the orchestrator grep gate (zero raw edge-table writes)
 * forbid raw-SQL bypassing writeEdge, an ENABLES request is routed through
 * writeEdge and faithfully REPORTED as a failure ({reason:'invalid_edge_type'})
 * rather than silently raw-SQL'd. ROOT_CAUSES (the actual parent->child cascade
 * relation this wave needs) is frozen and always succeeds once both endpoints
 * are registered Artifact nodes.
 *
 * Properties are enum/scalar ONLY (ring + confidence) -- never the consequence
 * body (Part 8). The result surfaces failures so the caller / test sees them.
 *
 * @param {Object} db - caller-owned room.db handle (openGraph().db)
 * @param {Array<Object>} consequences - ring consequence objects (with parent_id)
 * @returns {{ written: number, edges: Array<Object>, failures: Array<Object> }}
 */
function writeCascadeEdges(db, consequences) {
  const list = Array.isArray(consequences) ? consequences : [];
  const edges = [];
  const failures = [];
  let written = 0;

  for (const c of list) {
    if (!c || typeof c.parent_id !== 'string' || c.parent_id.length === 0) continue;
    // ROOT_CAUSES is the frozen cascade edge (parent->child). ENABLES is only
    // attempted when explicitly requested; nothing non-frozen is ever forced.
    const edgeType = c.edge_type === 'ENABLES' ? 'ENABLES' : 'ROOT_CAUSES';
    const res = navigation.writeEdge(db, {
      source_id: c.parent_id,
      target_id: c.id,
      edge_type: edgeType,
      // enum/scalar ONLY (Part 8): ring number + confidence float. No body text.
      properties: { ring: c.ring, confidence: c.confidence },
    });
    if (res && res.ok) {
      written++;
      edges.push({ source: c.parent_id, target: c.id, type: edgeType });
    } else {
      failures.push({ source: c.parent_id, target: c.id, type: edgeType, reason: res && res.reason });
    }
  }

  return { written, edges, failures };
}

/**
 * registerConsequenceArtifacts -- file each consequence as a nested Obsidian
 * .md (CLAUDE.md decision 16: opportunity-bank/futures-<seed>/<slug>/<slug>.md)
 * WITH an ICM Layer 0 ROOM.md per folder (CLAUDE.md decision 15), THEN register
 * each consequence as a type='Artifact' node in room.db via the lazygraph
 * indexing path (indexArtifact -> _indexArtifactBody -> insertNode). Both
 * registrations are required: the .md for compute-hsi discover_artifacts, the
 * Artifact node for hsi-to-graph's findArtifact gate.
 *
 * @param {string} roomDir - absolute room directory
 * @param {Array<Object>} consequences - consequence objects (id/label/horizon/...)
 * @param {Object} [opts]
 * @param {string} [opts.seed] - seed label for the futures-<seed-slug> folder
 * @returns {Promise<{ filed: Array<{id,path}>, seedDir: string }>}
 */
async function registerConsequenceArtifacts(roomDir, consequences, opts) {
  opts = opts || {};
  const lazygraph = require('../lazygraph-ops.cjs');
  const resolvedRoom = path.resolve(roomDir);
  const seedSlug = slugify(opts.seed || 'seed');
  const seedDir = path.join(resolvedRoom, 'opportunity-bank', 'futures-' + seedSlug);
  fs.mkdirSync(seedDir, { recursive: true });

  // ICM Layer 0: the seed folder itself gets a ROOM.md identity file.
  writeRoomMd(seedDir, 'Futures Wheel: ' + (opts.seed || seedSlug),
    'Seed folder for the Futures Wheel consequence rings. Each child folder is one consequence artifact.');

  const list = Array.isArray(consequences) ? consequences : [];
  const filed = [];

  // 1. File every consequence .md (and its ROOM.md) on disk FIRST.
  const plan = [];
  for (const c of list) {
    if (!c || typeof c.label !== 'string') continue;
    const slug = slugify(c.label) + (c.ring ? '-r' + c.ring : '');
    const folder = path.join(seedDir, slug);
    fs.mkdirSync(folder, { recursive: true });
    // ICM Layer 0: each consequence folder gets a ROOM.md (decision 15).
    writeRoomMd(folder, c.label, 'Consequence artifact (ring ' + c.ring + ', ' + c.domain + ').');
    const mdPath = path.join(folder, slug + '.md');
    const artifactId = consequenceArtifactId(resolvedRoom, mdPath);
    // GAP FIX (live-UAT on formation, 2026-06-15): stamp the registered
    // (path-derived) Artifact-node id back onto the consequence object so the
    // downstream writeCascadeEdges targets the id that actually exists as a node.
    // Before this, generateRing's short slug id (slug-rN) never matched the
    // registered node id -> ROOT_CAUSES edges silently failed (0 written).
    c.id = artifactId;
    const fmBody = renderConsequenceMd(c);
    fs.writeFileSync(mdPath, fmBody, 'utf-8');
    plan.push({ artifactId, mdPath });
    filed.push({ id: artifactId, path: mdPath });
  }

  // 2. Register each consequence as an Artifact node in room.db (the gate for
  //    hsi-to-graph). indexArtifact derives the SAME id from the .md path.
  const graph = await lazygraph.openGraph(resolvedRoom);
  try {
    for (const p of plan) {
      await lazygraph.indexArtifact(graph.conn, resolvedRoom, p.mdPath);
    }
  } finally {
    await lazygraph.closeGraph(graph.db);
  }

  return { filed, seedDir };
}

/**
 * Render a consequence object to a frontmatter + body markdown string. Body is
 * >50 chars so compute-hsi.py::discover_artifacts does not skip it as near-empty.
 */
function renderConsequenceMd(c) {
  const lines = [];
  lines.push('---');
  lines.push('horizon: ' + c.horizon);
  lines.push('confidence: ' + c.confidence);
  lines.push('domain: ' + c.domain);
  lines.push('ring: ' + c.ring);
  if (c.parent_id) lines.push('parent_id: ' + c.parent_id);
  lines.push('causal_cue: ' + (c.causal_cue || 'cue-thin'));
  lines.push('review_status: proposed');
  lines.push('---');
  lines.push('');
  lines.push('# ' + c.label);
  lines.push('');
  lines.push(c.body && c.body.length > 0 ? c.body
    : 'Consequence in the ' + c.domain + ' domain at the ' + c.horizon
      + ' horizon. This artifact records a ring ' + c.ring
      + ' consequence of the Futures Wheel seed for cross-domain HSI analysis.');
  lines.push('');
  return lines.join('\n');
}

/**
 * Write an ICM Layer 0 ROOM.md identity file into a folder (CLAUDE.md decision
 * 15: every directory in the Data Room gets a ROOM.md). Idempotent overwrite.
 */
function writeRoomMd(dir, title, description) {
  const body = [
    '# ' + title,
    '',
    description,
    '',
    '_ICM Layer 0 identity file (Futures Wheel)._',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'ROOM.md'), body, 'utf-8');
}

/**
 * assertArtifactCountMatchesFiled -- the LANDMINE #1 precondition (RESEARCH risk
 * 1). SELECTs COUNT(*) of type='Artifact' nodes whose id is in the filed set and
 * asserts it equals the filed count. runHsiScan MUST call this and HARD-FAIL if
 * the counts differ -- preventing hsi-to-graph's silent zero-edge false-success.
 *
 * @param {Object} db - caller-owned room.db handle
 * @param {Array<string>} filedConsequenceIds - the filed Artifact ids
 * @returns {{ ok: boolean, artifactCount: number, filedCount: number, missing: string[] }}
 */
function assertArtifactCountMatchesFiled(db, filedConsequenceIds) {
  const ids = Array.isArray(filedConsequenceIds) ? filedConsequenceIds.filter((x) => typeof x === 'string') : [];
  const filedCount = ids.length;
  if (filedCount === 0) {
    return { ok: false, artifactCount: 0, filedCount: 0, missing: [] };
  }
  const stmt = db.prepare("SELECT id FROM nodes WHERE id = ? AND type = 'Artifact'");
  let artifactCount = 0;
  const missing = [];
  for (const id of ids) {
    const row = stmt.get(id);
    if (row) artifactCount++;
    else missing.push(id);
  }
  return { ok: artifactCount === filedCount, artifactCount, filedCount, missing };
}

/**
 * runHsiScan -- the FW-06 deterministic file-then-scan sequencer:
 *   (1) assertArtifactCountMatchesFiled -- HARD-FAIL (return {ok:false}) if
 *       counts differ; do NOT proceed to compute-hsi (the landmine guard).
 *   (2) python3 scripts/compute-hsi.py <roomDir> --tier 1  -> .hsi-results.json
 *   (3) node scripts/hsi-to-graph.cjs <roomDir>  -> HSI_CONNECTION edges (raw SQL)
 *   (4) read back the HSI_CONNECTION edges and rank the cross-domain bridges
 *       (cross-domain = the two endpoints carry different PESTEL domains).
 *
 * Tri-Polar: detects python3 absence and degrades cleanly to a Tier 0 fallback
 * (returns { degraded:true, tier:0 }) rather than crashing on Desktop/Cowork.
 * This command OWNS the sequence; no hidden async.
 *
 * NEVER routes HSI_CONNECTION / REVERSE_SALIENT through navigation.writeEdge
 * (they are not frozen) -- step (3) is the raw hsi-to-graph.cjs path.
 *
 * @param {string} roomDir
 * @param {Array<string>} filedConsequenceIds
 * @param {Object} [opts]
 * @param {string} [opts.pluginRoot] - root holding scripts/ (default: repo root)
 * @returns {Promise<Object>} result with { ok, guard, degraded?, tier, hsiEdgeCount, bridges[] }}
 */
async function runHsiScan(roomDir, filedConsequenceIds, opts) {
  opts = opts || {};
  const lazygraph = require('../lazygraph-ops.cjs');
  const resolvedRoom = path.resolve(roomDir);
  const pluginRoot = opts.pluginRoot || path.resolve(__dirname, '..', '..', '..');
  const computeHsi = path.join(pluginRoot, 'scripts', 'compute-hsi.py');
  const hsiToGraph = path.join(pluginRoot, 'scripts', 'hsi-to-graph.cjs');

  // --- Step 1: LANDMINE #1 precondition. Hard-fail BEFORE compute-hsi. ---
  let guard;
  {
    const graph = await lazygraph.openGraph(resolvedRoom);
    try {
      guard = assertArtifactCountMatchesFiled(graph.db, filedConsequenceIds);
    } finally {
      await lazygraph.closeGraph(graph.db);
    }
  }
  if (!guard.ok) {
    return {
      ok: false,
      reason: 'artifact_count_mismatch',
      guard,
      hsiEdgeCount: 0,
      bridges: [],
    };
  }

  // --- Step 2: compute-hsi (backend-dispatched) <room> --tier 1  -> .hsi-results.json ---
  const hsiBackend = rsBackendDispatch.resolveBackend();
  if (hsiBackend === 'python') {
    // --- Tri-Polar python3 detection: degrade to Tier 0 fallback if absent. ---
    const python = resolvePython3();
    if (!python) {
      return {
        ok: true,
        degraded: true,
        tier: 0,
        reason: 'python3_absent_tier0_fallback',
        guard,
        hsiEdgeCount: 0,
        bridges: [],
      };
    }
    try {
      execFileSync(python, [computeHsi, resolvedRoom, '--tier', '1'], {
        stdio: 'pipe',
        cwd: pluginRoot,
      });
    } catch (e) {
      // python3 present but the HSI deps (numpy/sklearn) missing -> Tier 0 degrade.
      return {
        ok: true,
        degraded: true,
        tier: 0,
        reason: 'compute_hsi_unavailable_tier0_fallback',
        detail: String((e && e.message) || '').slice(0, 160),
        guard,
        hsiEdgeCount: 0,
        bridges: [],
      };
    }
  } else {
    // 'cjs' backend (D-04 default): in-process hsi-engine.cjs, no python3
    // resolution check needed on this branch -- degrades to the SAME Tier 0
    // graceful-degradation shape the Python branch already returns on any
    // failure, rather than throwing.
    try {
      const result = await hsiEngine.runTier1(resolvedRoom, { tier: 1 });
      if (result && result.success === false) {
        return {
          ok: true,
          degraded: true,
          tier: 0,
          reason: 'compute_hsi_unavailable_tier0_fallback',
          detail: String(result.detail || result.error || '').slice(0, 160),
          guard,
          hsiEdgeCount: 0,
          bridges: [],
        };
      }
    } catch (e) {
      return {
        ok: true,
        degraded: true,
        tier: 0,
        reason: 'compute_hsi_unavailable_tier0_fallback',
        detail: String((e && e.message) || '').slice(0, 160),
        guard,
        hsiEdgeCount: 0,
        bridges: [],
      };
    }
  }

  // --- Step 3: hsi-to-graph.cjs <room>  -> HSI_CONNECTION edges (raw SQL). ---
  execFileSync(process.execPath, [hsiToGraph, resolvedRoom], { stdio: 'pipe', cwd: pluginRoot });

  // --- Step 4: read back HSI_CONNECTION edges, rank cross-domain bridges. ---
  const bridges = [];
  let hsiEdgeCount = 0;
  const graph = await lazygraph.openGraph(resolvedRoom);
  try {
    const rows = graph.db.prepare(
      "SELECT source, target, properties FROM edges WHERE type = 'HSI_CONNECTION'"
    ).all();
    hsiEdgeCount = rows.length;
    for (const r of rows) {
      let score = 0;
      try { score = JSON.parse(r.properties || '{}').hsi_score || 0; } catch (_e) { score = 0; }
      const srcDomain = domainOfArtifact(resolvedRoom, r.source);
      const tgtDomain = domainOfArtifact(resolvedRoom, r.target);
      const crossDomain = !!srcDomain && !!tgtDomain && srcDomain !== tgtDomain;
      bridges.push({ source: r.source, target: r.target, hsi_score: score, crossDomain });
    }
  } finally {
    await lazygraph.closeGraph(graph.db);
  }
  bridges.sort((a, b) => b.hsi_score - a.hsi_score);

  return { ok: true, tier: 1, guard, hsiEdgeCount, bridges };
}

/**
 * Read the PESTEL domain of a consequence Artifact for cross-domain bridge
 * detection. The Artifact id is the room-relative path stem; reconstruct the
 * .md path and parse its frontmatter domain. Returns '' when unavailable (no
 * cross-domain claim). LOCAL filesystem read only (Part 8).
 * @param {string} roomDir - absolute room directory
 * @param {string} artifactId - room-relative path stem (the node id)
 * @returns {string} PESTEL domain or ''
 */
function domainOfArtifact(roomDir, artifactId) {
  try {
    const mdPath = path.join(path.resolve(roomDir), artifactId + '.md');
    if (!fs.existsSync(mdPath)) return '';
    const fm = parseFrontmatter(fs.readFileSync(mdPath, 'utf-8'));
    return fm && typeof fm.domain === 'string' ? fm.domain : '';
  } catch (_e) {
    return '';
  }
}

/**
 * Resolve a usable python3 executable, or null when none is available
 * (Tri-Polar: Desktop/Cowork may lack python3 -> Tier 0 degrade).
 */
function resolvePython3() {
  const candidates = ['python3', 'python'];
  for (const exe of candidates) {
    try {
      execFileSync(exe, ['--version'], { stdio: 'pipe' });
      return exe;
    } catch (_e) {
      // try next
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Wave 3 surface (FW-07 / FW-08 / FW-09 / FW-10)
//
// surfaceBridgesAtGate  -- the per-ring batch tri-context Decision Gate (D-02):
//                          present the ring's proposed consequences + the top-N
//                          cross-domain HSI bridges the navigator did NOT draw,
//                          via the Shape F.1 selector (APPROVE / REJECT / DEFER).
// confirmRingDecisions  -- promote APPROVE consequences proposed->confirmed via
//                          the navigation.confirmNode chokepoint with a human
//                          byUser (Part 9); REJECT writes a REJECTED_BECAUSE
//                          reason edge; DEFER writes a DEFERRED edge (Part 4).
// bankCandidateWithProvenance -- bank an approved candidate via
//                          opportunity-ops.bankOpportunity with an additive
//                          provenance field tracing to a source edge (FW-08/09).
// ---------------------------------------------------------------------------

// The closed tri-context Decision Gate verb set for the per-ring batch (D-02).
// Drawn from the Canon Part 3 / Shape F.1 vocabulary -- APPROVE promotes,
// REJECT captures the reason as graph data, DEFER queues for milestone audit.
const RING_GATE_VERBS = Object.freeze(['APPROVE', 'REJECT', 'DEFER']);

/**
 * surfaceBridgesAtGate -- assemble the per-ring batch tri-context Decision Gate
 * (D-02). Returns a structured gate descriptor the command / Larry layer renders
 * through the Shape F.1 AskUserQuestion selector (the only choice primitive,
 * Part 3). This function does the LOCAL assembly; it never renders the gate
 * itself (the HITL checkpoint is the navigator's, not the agent's).
 *
 * The surfaced bridges are the CROSS-DOMAIN HSI_CONNECTION bridges from
 * runHsiScan whose endpoints span two different PESTEL domains and that are NOT
 * a direct ROOT_CAUSES ring parent->child link -- the "do what a human cannot"
 * surfaced ripple (the invisible cross-domain effect a linear mind misses).
 *
 * @param {string} roomDir - absolute room directory (LOCAL context source)
 * @param {Array<Object>} bridges - ranked bridge objects from runHsiScan
 *   (each carries { source, target, hsi_score, crossDomain })
 * @param {Array<Object>} ringConsequences - the ring's proposed consequences
 * @param {Object} [opts]
 * @param {number} [opts.topN] - cap on surfaced bridges (default 5)
 * @param {Set<string>} [opts.ringParentLinks] - set of 'parent->child' id pairs
 *   that ARE direct ROOT_CAUSES ring links (excluded from the surfaced bridges)
 * @returns {{ ring: (number|null), verbs: string[], surface: string,
 *   consequences: Array<Object>, bridges: Array<Object>, contexts: Object }}
 */
function surfaceBridgesAtGate(roomDir, bridges, ringConsequences, opts) {
  opts = opts || {};
  const topN = Number.isFinite(opts.topN) ? opts.topN : 5;
  const ringParentLinks = opts.ringParentLinks instanceof Set ? opts.ringParentLinks : new Set();
  const cons = Array.isArray(ringConsequences) ? ringConsequences : [];
  const bridgeList = Array.isArray(bridges) ? bridges : [];

  // Surfaced bridges = cross-domain AND not a direct ring parent->child link.
  const surfaced = bridgeList
    .filter((b) => b && b.crossDomain === true)
    .filter((b) => !ringParentLinks.has(b.source + '->' + b.target)
      && !ringParentLinks.has(b.target + '->' + b.source))
    .slice(0, topN);

  // The ring number is taken from the batch (all share one ring); null if empty.
  const ring = cons.length && Number.isFinite(cons[0].ring) ? cons[0].ring : null;

  return {
    ring,
    // Shape F.1 selector vocabulary (the tri-context Decision Gate; Part 3).
    verbs: RING_GATE_VERBS.slice(),
    surface: 'F.1',
    consequences: cons.map((c) => ({ id: c.id, label: c.label, domain: c.domain, ring: c.ring })),
    bridges: surfaced,
    // Tri-context panels: LOCAL (the room's ring batch) + BRAIN (generic
    // methodology handle only, never room content; Part 8) + SIGNAL (none this
    // turn -- no external sweep in the wheel gate).
    contexts: {
      local: { roomDir: path.resolve(roomDir), ringConsequenceCount: cons.length },
      brain: { methodology: 'Futures Wheel', note: 'generic framework handle only (Part 8)' },
      signal: { note: 'none this turn' },
    },
  };
}

/**
 * confirmRingDecisions -- apply the navigator's per-ring batch decisions.
 *
 * For each decision:
 *   - APPROVE: resolve the navigator identity via navigation.resolveByUser
 *     (NEVER an agent identity -- a poisoned USER.md coerces to 'navigator')
 *     and call navigation.confirmNode(db, id, byUser) to promote the consequence
 *     proposed -> confirmed (Part 9 chokepoint; truth-claim nodes only).
 *   - REJECT: write a REJECTED_BECAUSE edge via navigation.writeEdge carrying the
 *     reason as a SCALAR reason-code property (Part 4 reason becomes graph data;
 *     Part 8 no body text on the edge).
 *   - DEFER: write a DEFERRED edge via navigation.writeEdge.
 *
 * The promotion routes through confirmNode ONLY (never promoteNodeStatus or a
 * raw UPDATE on review_status). REJECT / DEFER edges target a stable
 * 'futures:gate' decision node so the reason is graph-local data.
 *
 * @param {Object} db - caller-owned room.db handle (openGraph().db)
 * @param {string} roomDir - room directory (for resolveByUser USER.md lookup)
 * @param {Array<Object>} decisions - [{ id, verb, reason? }] per consequence
 * @returns {{ confirmed: Array<Object>, rejected: Array<Object>,
 *   deferred: Array<Object>, byUser: string, failures: Array<Object> }}
 */
function confirmRingDecisions(db, roomDir, decisions) {
  const list = Array.isArray(decisions) ? decisions : [];
  const byUser = navigation.resolveByUser(roomDir);
  const confirmed = [];
  const rejected = [];
  const deferred = [];
  const failures = [];

  // Stable decision-gate node id the REJECT/DEFER reason edges point at. The
  // edges are graph-local (Part 8); the reason rides as a scalar property.
  const GATE_NODE = 'futures:gate';

  for (const d of list) {
    if (!d || typeof d.id !== 'string') continue;
    const verb = String(d.verb || '').toUpperCase();

    if (verb === 'APPROVE') {
      // Promote proposed -> confirmed via the chokepoint with a HUMAN byUser.
      const res = navigation.confirmNode(db, d.id, byUser);
      if (res && res.ok) {
        confirmed.push({ id: d.id, byUser });
      } else {
        failures.push({ id: d.id, verb, reason: res && res.reason });
      }
    } else if (verb === 'REJECT') {
      // REJECTED_BECAUSE edge -- reason as a SCALAR reason-code (Part 4 + Part 8).
      const res = navigation.writeEdge(db, {
        source_id: d.id,
        target_id: GATE_NODE,
        edge_type: 'REJECTED_BECAUSE',
        properties: { reason: scalarReasonCode(d.reason) },
      });
      if (res && res.ok) {
        rejected.push({ id: d.id, reason: scalarReasonCode(d.reason) });
      } else {
        failures.push({ id: d.id, verb, reason: res && res.reason });
      }
    } else if (verb === 'DEFER') {
      const res = navigation.writeEdge(db, {
        source_id: d.id,
        target_id: GATE_NODE,
        edge_type: 'DEFERRED',
        properties: { reason: scalarReasonCode(d.reason) },
      });
      if (res && res.ok) {
        deferred.push({ id: d.id });
      } else {
        failures.push({ id: d.id, verb, reason: res && res.reason });
      }
    } else {
      failures.push({ id: d.id, verb, reason: 'unknown_verb' });
    }
  }

  return { confirmed, rejected, deferred, byUser, failures };
}

/**
 * Coerce a free-text rejection reason into a short SCALAR reason-code so the
 * consequence body never lands on the edge (Part 8). Accepts a known enum
 * code verbatim; otherwise maps to 'other'. Closed enum mirrors the F.0
 * REJECTED_BECAUSE reason-code idiom.
 * @param {string} reason
 * @returns {string}
 */
function scalarReasonCode(reason) {
  const known = new Set(['low_evidence', 'off_topic', 'duplicate', 'out_of_scope', 'low_confidence', 'other']);
  const r = String(reason || 'other').toLowerCase();
  return known.has(r) ? r : 'other';
}

/**
 * The source-edge types a banked opportunity's provenance may trace to (FW-09).
 * A candidate with no traceable source edge is NOT bankable.
 */
const PROVENANCE_EDGE_TYPES = Object.freeze(['HSI_CONNECTION', 'REVERSE_SALIENT', 'ROOT_CAUSES']);

/**
 * bankCandidateWithProvenance -- bank an approved opportunity candidate via the
 * shipped opportunity-ops.bankOpportunity engine (FW-08), adding an ADDITIVE
 * `provenance` frontmatter field that names the source edge the candidate traces
 * to: an HSI_CONNECTION / REVERSE_SALIENT / ROOT_CAUSES edge id or source-target
 * pair (FW-09). bankOpportunity passes the provenance frontmatter through and
 * preserves problem_hash dedup.
 *
 * A candidate WITHOUT a traceable source edge is refused (returns an error;
 * nothing is banked) -- this prevents banking an opportunity with fabricated
 * lineage (threat T-156-01).
 *
 * @param {string} roomDir - absolute room directory
 * @param {Object} candidate - { problem (required), confidence, evidence,
 *   domain?, provenance: { edge_type, source, target } | string }
 * @returns {{ banked: boolean, updated: boolean, path: string, error?: string,
 *   provenance?: string }}
 */
function bankCandidateWithProvenance(roomDir, candidate) {
  const oppOps = require('../opportunity-ops.cjs');

  if (!candidate || typeof candidate !== 'object') {
    return { banked: false, updated: false, path: '', error: 'Invalid candidate object' };
  }
  if (!candidate.problem) {
    return { banked: false, updated: false, path: '', error: 'Candidate missing required field: problem' };
  }

  // Resolve + validate the provenance source edge (FW-09; refuse if absent).
  const provenance = formatProvenance(candidate.provenance);
  if (!provenance) {
    return {
      banked: false,
      updated: false,
      path: '',
      error: 'Candidate has no traceable source edge (HSI_CONNECTION / REVERSE_SALIENT / ROOT_CAUSES); not bankable',
    };
  }

  // Build the opportunity object with the ADDITIVE provenance field. The
  // shipped bankOpportunity passes unknown frontmatter fields through.
  const opportunity = {
    problem: candidate.problem,
    confidence: candidate.confidence,
    evidence: candidate.evidence,
    domain: candidate.domain,
    source_framework: candidate.source_framework || 'Futures Wheel',
    provenance,
  };

  const res = oppOps.bankOpportunity(roomDir, opportunity);
  return Object.assign({}, res, { provenance });
}

/**
 * Format a candidate provenance descriptor into a single scalar string naming
 * the source edge (Part 8 scalar; no body text). Returns '' when the descriptor
 * names no valid source edge type. Accepts either an object
 * { edge_type, source, target } or a pre-formatted 'TYPE:source->target' string.
 * @param {Object|string} prov
 * @returns {string}
 */
function formatProvenance(prov) {
  if (typeof prov === 'string' && prov.length > 0) {
    const t = prov.split(':')[0];
    return PROVENANCE_EDGE_TYPES.includes(t) ? prov : '';
  }
  if (prov && typeof prov === 'object') {
    const type = String(prov.edge_type || '');
    if (!PROVENANCE_EDGE_TYPES.includes(type)) return '';
    const src = String(prov.source || '');
    const tgt = String(prov.target || '');
    if (!src && !tgt) return type;
    return type + ':' + src + '->' + tgt;
  }
  return '';
}

/**
 * Wave 3 alias retained for the Wave-1/2 surface contract. The real per-ring
 * gate is now surfaceBridgesAtGate + confirmRingDecisions (FW-10). Kept as a
 * thin pointer so any prior caller gets a clear redirect rather than a throw.
 */
function runRingGate(db, roomDir, gate) {
  const decisions = gate && Array.isArray(gate.decisions) ? gate.decisions : [];
  return confirmRingDecisions(db, roomDir, decisions);
}

// ---------------------------------------------------------------------------
// Wave 4 surface (FW-11 / FW-12 / FW-13)
//
// surfaceChainingHandoffs -- the top-3-of-N ranked foresight-web chaining
//                            surfacer (D-04). EVERY handoff target resolves
//                            through the Phase 122 command-resolver
//                            (commandsForFramework / composeWorkflow); NEVER a
//                            hardcoded /mos: command string (FW-12).
// runRSReverseSalient     -- the RS handoff: invoke the shipped
//                            scripts/rs-engine.py over the consequence set so
//                            >=1 REVERSE_SALIENT edge is written via the
//                            rs-engine raw path (NOT writeEdge; REVERSE_SALIENT
//                            is not frozen).
// runSignalResearch / seedGrounding / perRingResearch -- the FW-13 SIGNAL leg:
//                            two fire points, cache-first (30-day TTL), generic
//                            domain handles ONLY (Part 8).
// ---------------------------------------------------------------------------

// The 8 foresight-web partners (FW-12). Each is named ONLY by its FRAMEWORK
// HANDLE -- the command-resolver maps the framework name to its /mos: command
// at runtime against data/command-registry.json. This table carries ZERO
// hardcoded /mos: command strings (the FW-12 grep gate); the partner's command
// is resolved through commandsForFramework / composeWorkflow only. A registry
// miss degrades to a manual "run X" line (never a crash, never a fabricated
// command -- the resolver's degrade contract).
//
// `kind` is the local trigger this partner answers (used for ranking):
//   rs            -- a cross-domain HSI bridge wants the reverse-salient lens
//   causal_loop   -- a causal ring structure wants the systems-thinking lens
//   branch        -- co-occurring consequence branches want scenario planning
//   far_horizon   -- a long-horizon consequence wants trends / S-curve timing
//   banked        -- a banked candidate wants the Mullins seven-domains screen
//   reformulate   -- a tangled consequence set wants problem-definition diagnose
const FORESIGHT_WEB_PARTNERS = Object.freeze([
  { id: 'reverse-salient',  framework: 'Reverse Salient Analysis',                    kind: 'rs' },
  { id: 'systems-thinking', framework: 'Systems Thinking',                            kind: 'causal_loop' },
  { id: 'scenario-plan',    framework: 'Scenario Planning',                           kind: 'branch' },
  { id: 'explore-trends',   framework: 'S-Curve Analysis',                            kind: 'far_horizon' },
  { id: 'analyze-timing',   framework: 'S-Curve Analysis',                            kind: 'far_horizon' },
  { id: 'dominant-designs', framework: 'Dominant Design',                             kind: 'far_horizon' },
  { id: 'diagnose',         framework: 'Problem Definition Transformation Framework', kind: 'reformulate' },
  { id: 'mullins',          framework: 'Mullins Model',                               kind: 'banked' },
  { id: 'explore-futures',  framework: 'Scenario Planning',                           kind: 'branch' },
]);

// D-04: surface the TOP-3-of-N (mirror the 150.x dial top-3-of-N).
const CHAINING_HANDOFF_TOP_N = 3;

// The reverse "open as a futures wheel?" hook is reachable from these partner
// surfaces (FW-12 mutual handoff): the RS and systems-thinking surfaces declare
// it so an RS finding / a systems-thinking loop can be re-opened AS a wheel.
const REVERSE_OPEN_AS_WHEEL_SURFACES = Object.freeze(['reverse-salient', 'systems-thinking']);

/**
 * Detect which foresight-web triggers a consequence set fires, ranking each
 * partner by a LOCAL signal only (zero Brain egress; Part 8):
 *   - rs          : >=1 cross-domain bridge (two endpoints, different domains)
 *   - causal_loop : >=1 parent->child cascade (a causal ring exists)
 *   - branch      : >=2 consequences co-occur in one domain (a fork to cluster)
 *   - far_horizon : >=1 long-horizon consequence
 *   - banked      : >=1 high-confidence consequence (a bankable candidate)
 *   - reformulate : a tangled set (>= depth-cap rings present) wants a re-frame
 *
 * @param {Array<Object>} consequences - ring consequence objects
 * @param {Object} [opts]
 * @param {Array<Object>} [opts.bridges] - cross-domain bridges from runHsiScan
 * @returns {Object} score-by-kind map (higher = stronger trigger)
 */
function detectChainingTriggers(consequences, opts) {
  opts = opts || {};
  const cons = Array.isArray(consequences) ? consequences : [];
  const bridges = Array.isArray(opts.bridges) ? opts.bridges : [];

  const crossDomainBridges = bridges.filter((b) => b && b.crossDomain === true).length;
  const cascadeLinks = cons.filter((c) => c && typeof c.parent_id === 'string' && c.parent_id.length > 0).length;

  // Domain co-occurrence: any domain carrying >=2 consequences is a fork.
  const byDomain = {};
  for (const c of cons) {
    if (c && typeof c.domain === 'string') byDomain[c.domain] = (byDomain[c.domain] || 0) + 1;
  }
  const branchForks = Object.values(byDomain).filter((n) => n >= 2).length;

  const farHorizon = cons.filter((c) => c && c.horizon === 'long').length;
  const bankable = cons.filter((c) => c && typeof c.confidence === 'number' && c.confidence >= 0.6).length;
  const ringSpan = new Set(cons.map((c) => c && c.ring).filter((r) => Number.isFinite(r))).size;

  return {
    rs: crossDomainBridges,
    causal_loop: cascadeLinks,
    branch: branchForks,
    far_horizon: farHorizon,
    banked: bankable,
    reformulate: ringSpan >= FUTURES_DEPTH_CAP ? 1 : 0,
  };
}

/**
 * surfaceChainingHandoffs -- the FW-12 top-3-of-N ranked foresight-web chaining
 * surfacer at the F.1 gate (D-04, mirror the 150.x dial top-3-of-N).
 *
 * Ranks the 8 foresight-web partners by their detected LOCAL trigger, resolves
 * EACH surviving partner's command through the Phase 122 command-resolver
 * (commandsForFramework -> composeWorkflow), and returns the top-3. A registry
 * miss degrades to a manual "run X" line (manual:true, command:null) -- never a
 * crash, never a fabricated command string (FW-12 acceptance).
 *
 * The reverse "open as a futures wheel?" hook is attached to the RS and
 * systems-thinking handoffs (REVERSE_OPEN_AS_WHEEL_SURFACES) so the mutual
 * handoff is reachable from those surfaces (FW-12 reverse handoff).
 *
 * NO hardcoded /mos: command strings live in this function: every command comes
 * BACK from the resolver. The grep gate
 *   grep -ciE "'/mos:(systems-thinking|scenario-plan|...)'"
 * over orchestrator.cjs is 0.
 *
 * @param {string} roomDir - absolute room directory (LOCAL context source)
 * @param {Array<Object>} consequences - the ring's consequence objects
 * @param {Object} [opts]
 * @param {Array<Object>} [opts.bridges] - cross-domain bridges from runHsiScan
 * @param {Object} [opts.resolver] - injected command-resolver (default: the shipped one)
 * @param {number} [opts.topN] - override the top-N cap (default CHAINING_HANDOFF_TOP_N)
 * @returns {{ surface: string, handoffs: Array<Object>, reverseHook: Object }}
 */
function surfaceChainingHandoffs(roomDir, consequences, opts) {
  opts = opts || {};
  const resolver = opts.resolver || require('../../workflow/command-resolver.cjs');
  const topN = Number.isFinite(opts.topN) ? opts.topN : CHAINING_HANDOFF_TOP_N;
  const triggers = detectChainingTriggers(consequences, opts);

  // Score each partner by its trigger; keep only fired partners (score > 0).
  // Stable de-dup by framework so two partners sharing a framework (e.g.
  // explore-futures + scenario-plan both -> Scenario Planning) do not both
  // occupy a slot with the identical resolved command.
  const seenFramework = new Set();
  const ranked = FORESIGHT_WEB_PARTNERS
    .map((p) => ({ partner: p, score: triggers[p.kind] || 0 }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .filter((r) => {
      if (seenFramework.has(r.partner.framework)) return false;
      seenFramework.add(r.partner.framework);
      return true;
    })
    .slice(0, topN);

  // Resolve each surviving partner's command through the resolver ONLY.
  const handoffs = ranked.map((r) => {
    const workflow = resolver.composeWorkflow([r.partner.framework]);
    const step = workflow.length > 0 ? workflow[0] : { command: null, optional: true };
    const command = step.command || null;
    const handoff = {
      id: r.partner.id,
      framework: r.partner.framework,
      trigger: r.partner.kind,
      score: r.score,
      // command came BACK from the resolver (FW-12); manual when the registry
      // has no command for the framework (degrade, do not fabricate).
      command,
      manual: command === null,
    };
    if (REVERSE_OPEN_AS_WHEEL_SURFACES.includes(r.partner.id)) {
      handoff.reverse_open_as_wheel = true;
    }
    return handoff;
  });

  return {
    surface: 'F.1',
    handoffs,
    // The reverse hook descriptor: the "open as a futures wheel?" mutual handoff
    // declared for the RS + systems-thinking surfaces (FW-12).
    reverseHook: {
      verb: 'open-as-futures-wheel',
      reachableFrom: REVERSE_OPEN_AS_WHEEL_SURFACES.slice(),
      note: 'A reverse-salient finding or a systems-thinking loop can be re-opened AS a Futures Wheel seed.',
    },
  };
}

/**
 * runRSReverseSalient -- the RS handoff. When the navigator accepts the RS
 * chaining handoff, invoke the SHIPPED scripts/rs-engine.py (Mode A internal)
 * over the room so it writes >=1 REVERSE_SALIENT edge into room.db via the
 * rs-engine RAW path (properties.source='rs-engine'). REVERSE_SALIENT is NOT in
 * the frozen ALLOWED_EDGE_TYPES, so it MUST NOT route through navigation.writeEdge
 * (that path rejects it). The rs-engine raw writer is the canonical path (mirrors
 * the Wave 2 HSI_CONNECTION raw-path decision).
 *
 * Tri-Polar: python3 absence degrades cleanly to a Tier 0 no-op (no crash on
 * Desktop/Cowork). Part 8: rs-engine reads LOCAL room artifacts only; zero Brain
 * egress (Mode A internal scan; no --topic, no external corpus).
 *
 * @param {string} roomDir - absolute room directory
 * @param {Object} [opts]
 * @param {string} [opts.pluginRoot] - root holding scripts/ (default: repo root)
 * @returns {Promise<{ ok: boolean, degraded?: boolean, reason?: string, reverseSalientEdges: number }>}
 */
async function runRSReverseSalient(roomDir, opts) {
  opts = opts || {};
  const resolvedRoom = path.resolve(roomDir);
  const pluginRoot = opts.pluginRoot || path.resolve(__dirname, '..', '..', '..');
  const rsEngine = path.join(pluginRoot, 'scripts', 'rs-engine.py');

  // Phase 272 D-04: backend-dispatched. 'python' keeps the existing
  // execFileSync call and its Tri-Polar graceful-degradation contract
  // UNCHANGED. 'cjs' calls rs-engine.cjs::runModeInternal directly, in
  // process -- no python3 resolution check needed on this branch, since the
  // resolvePython3() guard only ever gated the Python leg. On failure it
  // maps to the SAME { ok:true, degraded:true, tier:0,
  // reason:'rs_engine_unavailable_tier0_fallback', reverseSalientEdges:0 }
  // shape the Python branch already returns -- this function's whole design
  // is Tri-Polar graceful degradation, and the CJS branch must degrade
  // exactly as gracefully, not throw.
  const rsBackend = rsBackendDispatch.resolveBackend();
  if (rsBackend === 'python') {
    const python = resolvePython3();
    if (!python) {
      return { ok: true, degraded: true, tier: 0, reason: 'python3_absent_tier0_fallback', reverseSalientEdges: 0 };
    }

    // Mode A internal scan: LOCAL room only, no external corpus (Part 8).
    try {
      execFileSync(python, [rsEngine, '--mode', 'internal', '--room', resolvedRoom], {
        stdio: 'pipe',
        cwd: pluginRoot,
      });
    } catch (e) {
      return {
        ok: true,
        degraded: true,
        tier: 0,
        reason: 'rs_engine_unavailable_tier0_fallback',
        detail: String((e && e.message) || '').slice(0, 160),
        reverseSalientEdges: 0,
      };
    }
  } else {
    // Mode A internal scan, in-process: LOCAL room only, no external corpus (Part 8).
    try {
      await rsEngineCjs.runModeInternal(resolvedRoom, { mode: 'internal' });
    } catch (e) {
      return {
        ok: true,
        degraded: true,
        tier: 0,
        reason: 'rs_engine_unavailable_tier0_fallback',
        detail: String((e && e.message) || '').slice(0, 160),
        reverseSalientEdges: 0,
      };
    }
  }

  // Read back the REVERSE_SALIENT edges the rs-engine raw path wrote, via the
  // SAME lazygraph handle the rest of the orchestrator uses (node:sqlite under
  // the hood; no better-sqlite3 dependency).
  let reverseSalientEdges = 0;
  const dbPath = path.join(resolvedRoom, '.mindrian', 'room.db');
  if (fs.existsSync(dbPath)) {
    const lazygraph = require('../lazygraph-ops.cjs');
    const graph = await lazygraph.openGraph(resolvedRoom);
    try {
      const row = graph.db.prepare("SELECT COUNT(*) AS n FROM edges WHERE type = 'REVERSE_SALIENT'").get();
      reverseSalientEdges = (row && row.n) || 0;
    } catch (_e) {
      reverseSalientEdges = 0;
    } finally {
      await lazygraph.closeGraph(graph.db);
    }
  }

  return { ok: true, tier: 1, reverseSalientEdges };
}

// --- FW-13 SIGNAL research: two fire points, cache-first, generic handles ---

// The default external corpus source for the SIGNAL leg. openalex is a public
// academic source (no API key needed) so seed grounding works out of the box.
const SIGNAL_DEFAULT_SOURCE = 'openalex';
const SIGNAL_DEFAULT_LIMIT = 5;

/**
 * Coerce a free-text concept/domain into a GENERIC search handle (Part 8). The
 * handle carries ONLY a domain/concept keyword -- NEVER a consequence body or
 * any room artifact text. We strip to a short lowercased keyword phrase (the
 * same generic-handle discipline the brain-cypher adapter uses), bounded to a
 * few words so a long artifact body cannot smuggle itself through as a "handle".
 *
 * @param {string} handle - the seed concept or a ring domain keyword
 * @returns {string} a bounded generic handle (or '' when nothing generic remains)
 */
function genericDomainHandle(handle) {
  const s = String(handle == null ? '' : handle).toLowerCase();
  // Keep word characters + spaces only; collapse whitespace; cap at 6 words so
  // a consequence sentence cannot ride through as a "handle".
  const words = s.replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  return words.slice(0, 6).join(' ');
}

/**
 * runSignalResearch -- the bounded SIGNAL leg (FW-13), cache-first:
 *   getCached(roomDir, source, handle) -> if a fresh hit, return it (no fetch)
 *   else fetchCorpus({ source, query: handle, limit }) -> putCached -> return
 *
 * The `query` passed to fetchCorpus is ALWAYS a GENERIC DOMAIN HANDLE
 * (genericDomainHandle), NEVER a consequence body or room artifact text (Part 8).
 * The 30-day cache (research-cache) bounds external calls: a second call within
 * the TTL window is a cache hit (isFresh true), so this is NOT always-on.
 *
 * @param {string} roomDir - absolute room directory (cache location)
 * @param {string} query - the seed concept / a ring domain keyword (generic)
 * @param {Object} [opts]
 * @param {string} [opts.source] - corpus source (default SIGNAL_DEFAULT_SOURCE)
 * @param {number} [opts.limit] - result cap (default SIGNAL_DEFAULT_LIMIT)
 * @param {Object} [opts.corpus] - injected research-corpus (default: shipped)
 * @param {Object} [opts.cache] - injected research-cache (default: shipped)
 * @param {Object} [opts.cacheOpts] - passed to getCached/isFresh (now/ttlMs seam)
 * @returns {Promise<{ handle: string, cacheHit: boolean, results: Array, count: number }>}
 */
async function runSignalResearch(roomDir, query, opts) {
  opts = opts || {};
  const corpus = opts.corpus || require('../research-corpus.cjs');
  const cache = opts.cache || require('../research-cache.cjs');
  const source = opts.source || SIGNAL_DEFAULT_SOURCE;
  const limit = Number.isFinite(opts.limit) ? opts.limit : SIGNAL_DEFAULT_LIMIT;
  const cacheOpts = opts.cacheOpts || {};

  // The ONLY thing that crosses the boundary: a generic domain/concept handle.
  const handle = genericDomainHandle(query);
  if (!handle) {
    return { handle: '', cacheHit: false, results: [], count: 0 };
  }

  // Cache-first: a fresh entry short-circuits the external call (30-day TTL).
  const cached = cache.getCached(roomDir, source, handle, cacheOpts);
  if (cached !== null) {
    return { handle, cacheHit: true, results: cached, count: cached.length };
  }

  // Miss / stale: fetch with the GENERIC HANDLE ONLY, then cache the result.
  const results = await corpus.fetchCorpus({ source, query: handle, limit });
  const list = Array.isArray(results) ? results : [];
  cache.putCached(roomDir, source, handle, list, cacheOpts);
  return { handle, cacheHit: false, results: list, count: list.length };
}

/**
 * seedGrounding -- FW-13 fire point (a): called ONCE up front to ground ring-1
 * generation. Fetches >=1 public source (cache hit or live) for the seed
 * concept (a generic handle) so ring-1 is grounded in real signal, not guesses.
 *
 * @param {string} roomDir
 * @param {string} seed - the seed concept (a generic domain/concept handle)
 * @param {Object} [opts] - forwarded to runSignalResearch
 * @returns {Promise<{ grounded: boolean, handle: string, cacheHit: boolean, sources: Array, count: number }>}
 */
async function seedGrounding(roomDir, seed, opts) {
  const res = await runSignalResearch(roomDir, seed, opts);
  return {
    grounded: res.count > 0,
    handle: res.handle,
    cacheHit: res.cacheHit,
    sources: res.results,
    count: res.count,
  };
}

/**
 * perRingResearch -- FW-13 fire point (b): the navigator fires research over a
 * ring's consequences ON DEMAND. The query is the ring's GENERIC DOMAIN keyword
 * (the PESTEL domain handle), NEVER a consequence body (Part 8). Each pass
 * either:
 *   - corroborates a consequence's confidence (raises evidence tier; returns a
 *     `confidenceAdjustments` list naming each consequence + a delta), OR
 *   - proposes >=1 signal-derived consequence (tagged signal_derived:true).
 *
 * The corroborate-vs-propose decision is LOCAL and bounded: if the ring already
 * has a consequence in the researched domain, the finding corroborates it;
 * otherwise the finding proposes a new signal-derived consequence in that domain.
 * Findings wire as typed LOCAL evidence via the evidence-claim path (Part 5) when
 * a db handle is supplied; with no db this returns the structured deltas the
 * caller (Larry) wires at the gate.
 *
 * @param {string} roomDir
 * @param {Array<Object>} ringConsequences - the ring's consequence objects
 * @param {string} domainHandle - the GENERIC domain keyword to research
 * @param {Object} [opts] - forwarded to runSignalResearch
 * @returns {Promise<{ handle: string, cacheHit: boolean, sourceCount: number,
 *   confidenceAdjustments: Array, signalDerived: Array }>}
 */
async function perRingResearch(roomDir, ringConsequences, domainHandle, opts) {
  opts = opts || {};
  const cons = Array.isArray(ringConsequences) ? ringConsequences : [];
  const res = await runSignalResearch(roomDir, domainHandle, opts);

  const confidenceAdjustments = [];
  const signalDerived = [];

  if (res.count > 0) {
    const handleDomain = genericDomainHandle(domainHandle);
    // Find a consequence whose domain matches the researched handle to corroborate.
    const target = cons.find((c) => c
      && typeof c.domain === 'string'
      && genericDomainHandle(c.domain) === handleDomain);
    if (target) {
      // Corroborate: a cited public source raises this consequence's confidence.
      confidenceAdjustments.push({
        id: target.id,
        confidence_adjust: 0.1,
        evidence_tier: 'Academic',
        source: res.results[0] && res.results[0].id ? res.results[0].id : 'signal',
      });
    } else {
      // Propose a signal-derived consequence in the researched domain.
      const top = res.results[0] || {};
      signalDerived.push({
        id: slugify((top.title || domainHandle) + '-signal') + '-signal',
        domain: matchPestelDomain(domainHandle),
        horizon: 'mid',
        confidence: 0.4,
        label: 'Signal-derived consequence in ' + domainHandle,
        signal_derived: true,
        source: top.id || 'signal',
      });
    }
  }

  return {
    handle: res.handle,
    cacheHit: res.cacheHit,
    sourceCount: res.count,
    confidenceAdjustments,
    signalDerived,
  };
}

/**
 * Map a free-text domain handle to its PESTEL enum member (default Social when
 * no match). Keeps a signal-derived consequence inside the frozen domain enum.
 */
function matchPestelDomain(handle) {
  const h = String(handle || '').toLowerCase();
  for (const d of PESTEL_DOMAIN_ENUM) {
    if (h.includes(d.toLowerCase())) return d;
  }
  return 'Social';
}

module.exports = {
  // caps (FW-02)
  FUTURES_DEPTH_CAP,
  FUTURES_FANOUT_CAP,
  resolveDepthCap,
  resolveFanoutCap,
  // enums (FW-04)
  HORIZON_ENUM,
  PESTEL_DOMAIN_ENUM,
  // validator (FW-04)
  validateConsequenceFrontmatter,
  // generation + cascade (FW-02 / FW-05)
  generateRing,
  writeCascadeEdges,
  slugify,
  consequenceArtifactId,
  // Artifact registration + HSI sequencer (FW-06)
  registerConsequenceArtifacts,
  assertArtifactCountMatchesFiled,
  runHsiScan,
  // Wave 3 Decision Gate + confirm + bank (FW-07 / FW-08 / FW-09 / FW-10)
  surfaceBridgesAtGate,
  confirmRingDecisions,
  bankCandidateWithProvenance,
  RING_GATE_VERBS,
  PROVENANCE_EDGE_TYPES,
  runRingGate,
  // Wave 4 chaining handoffs (FW-12)
  surfaceChainingHandoffs,
  detectChainingTriggers,
  runRSReverseSalient,
  FORESIGHT_WEB_PARTNERS,
  CHAINING_HANDOFF_TOP_N,
  REVERSE_OPEN_AS_WHEEL_SURFACES,
  // Wave 4 SIGNAL research (FW-13)
  runSignalResearch,
  seedGrounding,
  perRingResearch,
  genericDomainHandle,
};
