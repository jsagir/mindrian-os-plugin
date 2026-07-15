'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 166-01 Task 2 -- recipe-maps.cjs (B4, D-166-03)
 * ====================================================
 * A thin READ-ONLY joiner over the three EXISTING recipe maps, each read for
 * exactly ONE job, LAYERED not merged (D-166-03). The Wave-2 runChain loop reads
 * exactly one posture authority, one wiring authority, and one ranked-suggestion
 * authority through this module so the three maps never drift into the divergence
 * the executor exists to kill.
 *
 *   postureForCommand(command)  -> { command, autonomous_safe, posture }
 *       JOB: posture / autonomy authority. Delegates to lib/workflow/
 *       command-resolver.cjs (validateChainAutonomy / the command-registry
 *       authority). Maps the 3-posture vocabulary (sensor-types.POSTURE_IDS:
 *       push_forward / hold / pull_back) to the run/halt verb the loop honors:
 *       push_forward -> 'run' (auto-run); hold / pull_back -> 'halt'. An unknown
 *       command degrades to a withhold-default ({ autonomous_safe: false,
 *       posture: 'halt' }) -- NEVER a fabricated autonomous_safe (T-166-02).
 *
 *   wiringForReach(reachId)     -> string[]   (surfaces whose reach_id matches)
 *       JOB: reach -> surface wiring. Reads data/connector-registry.json
 *       connectors[] (each entry carries reach_id + surface + sub_mode +
 *       posture) and returns the onStep dispatch-target surface(s) for the reach.
 *       An unknown reach returns [].
 *
 *   rankedNextReach(opts)       -> [{ reach_id, ... }]
 *       JOB: ranked next-reach (the chef's suggestion). Reads
 *       data/brain-orchestration-projection.json (the 207-node / 51-edge
 *       projection) and returns the ranked next-reach candidates.
 *
 *       TRUTH-IN-LABELING (D-166-03 + SPEC Out-of-scope): rankedNextReach is a
 *       CONTRACT-ONLY reader. It is the projection's FIRST named consumer
 *       (closing the "dark 207-node projection has no consumer" gap), but the
 *       Wave-2 runChain loop selects the next step from decide()
 *       (navigation-engine.cjs), NOT from this function. Live nav-engine
 *       consumption of the projection cache for ranked next-reach is explicitly
 *       DEFERRED with Phase 157 (166-SPEC.md Out of scope: "Live Brain
 *       consumption of the Phase 157 projection for ranked next-reach (deferred
 *       with 157; the executor reads decide() locally until then)"). This read
 *       opens NO live nav-engine consumption path. Do NOT wire it into the loop.
 *
 * Canon Part 8 (Graph Boundary): this file requires NO Brain client and makes
 * ZERO network calls. The projection is a Brain-DERIVED LOCAL cache (Part 8
 * amendment entry 19): it is a committed local artifact, so reading it opens no
 * Brain wire. Posture is joined ONLY from the LOCAL data/command-registry.json
 * via the command-resolver. The test forbidden-token scan
 * (tests/test-recipe-maps-authority.cjs) proves the clean surface.
 *
 * Canon Part 7 (Reuse Before Build): this is an ~85 percent repoint -- it reuses
 * the shipped command-resolver authority and two existing committed JSON maps; a
 * rewrite is rejected because the maps and the resolver already exist and are
 * CI-tripwired.
 *
 * Each reader caches per-process and degrades to empty on missing / malformed
 * JSON, mirroring the command-resolver _load degrade idiom
 * (command-resolver.cjs:62-78).
 *
 * Test-only surface:
 *   __reset()                                       clears the per-process caches
 *   MINDRIAN_CONNECTOR_REGISTRY env                 overrides the connector path
 *   MINDRIAN_ORCHESTRATION_PROJECTION env           overrides the projection path
 *   (command-registry path override is the resolver's MINDRIAN_COMMAND_REGISTRY)
 *
 * License: BSL 1.1.
 */

const fs = require('node:fs');
const path = require('node:path');

const resolver = require(path.join(__dirname, '..', 'workflow', 'command-resolver.cjs'));

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DEFAULT_CONNECTOR_PATH = path.join(DATA_DIR, 'connector-registry.json');
const DEFAULT_PROJECTION_PATH = path.join(DATA_DIR, 'brain-orchestration-projection.json');
const DEFAULT_MANIFEST_PATH = path.join(DATA_DIR, 'harness-manifest.json');

// The 3-posture vocabulary is frozen in lib/core/sensors/sensor-types.cjs
// (POSTURE_IDS: push_forward / hold / pull_back). The loop honors a run/halt
// verb: push_forward authorizes an auto-run; hold / pull_back halt at a gate.
const POSTURE_TO_VERB = Object.freeze({
  push_forward: 'run',
  hold: 'halt',
  pull_back: 'halt',
});

// ---------------------------------------------------------------------------
// Per-process caches + degrade idiom (mirrors command-resolver.cjs:54-78).
// ---------------------------------------------------------------------------
let _connectorCache = null;
let _projectionCache = null;
let _manifestCache = null;

function _connectorPath() {
  const o = process.env.MINDRIAN_CONNECTOR_REGISTRY;
  return (typeof o === 'string' && o.length > 0) ? o : DEFAULT_CONNECTOR_PATH;
}

function _projectionPath() {
  const o = process.env.MINDRIAN_ORCHESTRATION_PROJECTION;
  return (typeof o === 'string' && o.length > 0) ? o : DEFAULT_PROJECTION_PATH;
}

function _manifestPath() {
  const o = process.env.MINDRIAN_HARNESS_MANIFEST;
  return (typeof o === 'string' && o.length > 0) ? o : DEFAULT_MANIFEST_PATH;
}

function _loadConnectors() {
  if (_connectorCache) return _connectorCache;
  try {
    const parsed = JSON.parse(fs.readFileSync(_connectorPath(), 'utf8'));
    _connectorCache = {
      connectors: Array.isArray(parsed && parsed.connectors) ? parsed.connectors : [],
    };
  } catch (_e) {
    _connectorCache = { connectors: [] }; // degrade: missing / unreadable / malformed
  }
  return _connectorCache;
}

function _loadProjection() {
  if (_projectionCache) return _projectionCache;
  try {
    const parsed = JSON.parse(fs.readFileSync(_projectionPath(), 'utf8'));
    _projectionCache = {
      nodes: Array.isArray(parsed && parsed.nodes) ? parsed.nodes : [],
      edges: Array.isArray(parsed && parsed.edges) ? parsed.edges : [],
    };
  } catch (_e) {
    _projectionCache = { nodes: [], edges: [] }; // degrade: missing / unreadable / malformed
  }
  return _projectionCache;
}

function _loadManifest() {
  if (_manifestCache) return _manifestCache;
  try {
    const parsed = JSON.parse(fs.readFileSync(_manifestPath(), 'utf8'));
    _manifestCache = {
      methodology_tier: (typeof parsed && parsed && typeof parsed.methodology_tier === 'string')
        ? parsed.methodology_tier : null,
      version: (parsed && typeof parsed.version === 'number') ? parsed.version : null,
      maps: Array.isArray(parsed && parsed.maps) ? parsed.maps : [],
      // Phase 201-01 (SEED-032, D-201-1): the additive runtime-surface digest
      // block. TOLERANT read - a manifest without the key (an older artifact)
      // degrades to []; the three read-joins below ignore it entirely, so the
      // schema change is purely additive (postureForCommand / wiringForReach /
      // rankedNextReach are byte-unchanged, D-166-03 preserved).
      runtime_surfaces: Array.isArray(parsed && parsed.runtime_surfaces)
        ? parsed.runtime_surfaces : [],
    };
  } catch (_e) {
    // Degrade to the DOCUMENTED empty binding (never throws), mirroring the
    // _loadProjection degrade idiom. An empty maps[] is the legible "manifest
    // missing / malformed" state, not a fabricated binding.
    _manifestCache = { methodology_tier: null, version: null, maps: [], runtime_surfaces: [] };
  }
  return _manifestCache;
}

// ---------------------------------------------------------------------------
// JOB 1: posture / autonomy authority (command-registry, via command-resolver).
// ---------------------------------------------------------------------------
/**
 * postureForCommand(command) -> { command, autonomous_safe, posture }
 * The posture authority answer for a command, joined from the LOCAL
 * command-registry via the shipped command-resolver (the ONE posture authority).
 * `autonomous_safe` is the registry's autonomous_safe flag; `posture` is the
 * run/halt verb the loop honors ('run' when the command is autonomous_safe,
 * 'halt' otherwise). An unknown command degrades to a withhold-default
 * ({ autonomous_safe: false, posture: 'halt' }), never a fabricated
 * autonomous_safe (T-166-02). Never throws.
 */
function postureForCommand(command) {
  if (typeof command !== 'string' || command.length === 0) {
    return { command: null, autonomous_safe: false, posture: 'halt' };
  }
  // Reuse validateChainAutonomy as the ONE posture authority: compose a
  // single-step workflow and ask the resolver whether it is runnable. A command
  // unknown to the registry, or known-but-not-autonomous_safe, yields a blocker
  // -> withhold-default. A registry autonomous_safe:true command -> runnable.
  const wf = [{ step: 1, command: command }];
  const verdict = resolver.validateChainAutonomy(wf);
  const autonomousSafe = verdict.runnable === true && verdict.blockers.length === 0;
  // push_forward maps to 'run'; the withhold-default uses 'hold' -> 'halt'.
  const postureId = autonomousSafe ? 'push_forward' : 'hold';
  return {
    command: command,
    autonomous_safe: autonomousSafe,
    posture: POSTURE_TO_VERB[postureId],
  };
}

// ---------------------------------------------------------------------------
// JOB 2: reach -> surface wiring (connector-registry).
// ---------------------------------------------------------------------------
/**
 * wiringForReach(reachId) -> string[]
 * The onStep dispatch-target surface(s) wired to the given reach, read from
 * data/connector-registry.json connectors[] (entries whose reach_id matches).
 * An unknown reach / empty registry -> []. Never throws.
 */
function wiringForReach(reachId) {
  if (typeof reachId !== 'string' || reachId.length === 0) return [];
  const connectors = _loadConnectors().connectors;
  const surfaces = [];
  for (const c of connectors) {
    if (c && c.reach_id === reachId && typeof c.surface === 'string') {
      surfaces.push(c.surface);
    }
  }
  return surfaces;
}

// ---------------------------------------------------------------------------
// JOB 3: ranked next-reach (the projection). CONTRACT-ONLY reader (see header).
// ---------------------------------------------------------------------------
/**
 * rankedNextReach(opts) -> [{ reach_id, sub_mode, hierarchy_rank, posture,
 *                             framework, command }]
 * The ranked next-reach candidates read from the 207-node
 * data/brain-orchestration-projection.json. Candidates are the projection nodes
 * that carry a ranking block, sorted ascending by hierarchy_rank (lower rank =
 * higher priority -- the chef's strongest suggestion first). A missing /
 * malformed projection degrades to [] and never throws.
 *
 * CONTRACT-ONLY (D-166-03 + SPEC Out-of-scope): this is the projection's first
 * NAMED consumer, but the Wave-2 runChain loop drives next-step selection from
 * decide() (navigation-engine.cjs), NOT from this function. Live nav-engine
 * consumption of the projection cache is DEFERRED with Phase 157. Do NOT wire
 * this into the loop -- it opens no live nav-engine consumption path.
 *
 * @param {object} [opts] - reserved for future filters (currently unused; the
 *   contract is the read shape, not a query API).
 */
function rankedNextReach(opts) {
  void opts; // reserved; the Wave-1 contract is the read shape only.
  const nodes = _loadProjection().nodes;
  const candidates = [];
  for (const n of nodes) {
    if (!n || !n.ranking || typeof n.ranking !== 'object') continue;
    const r = n.ranking;
    if (typeof r.reach_id !== 'string') continue;
    candidates.push({
      reach_id: r.reach_id,
      sub_mode: (typeof r.sub_mode === 'string') ? r.sub_mode : null,
      hierarchy_rank: (typeof r.hierarchy_rank === 'number') ? r.hierarchy_rank : Number.MAX_SAFE_INTEGER,
      posture: (typeof r.posture === 'string') ? r.posture : null,
      framework: (typeof r.framework === 'string') ? r.framework : null,
      command: (typeof n.name === 'string') ? n.name : null,
    });
  }
  candidates.sort((a, b) => a.hierarchy_rank - b.hierarchy_rank);
  return candidates;
}

// ---------------------------------------------------------------------------
// JOB 4 (Phase 205-06, SCOPE-6 pipelining): the SENS-10 cause -> compose recipe.
// Each of the four SENS-10 causes (from lib/core/sensors/sensor-circularity.cjs
// CAUSES) maps to an ORDERED command chain -- the exits COMPOSE, they are NOT a
// menu. A chain is: the autonomous_safe RECON PREFIX (find-bottlenecks /
// find-analogies / challenge-assumptions / beautiful-question) -> the MATERIAL
// GATE (bono) -> the TELL SYNTHESIS terminal.
//
// The recipe values are BARE COMMAND STRINGS ONLY -- NO autonomous_safe literal
// is fabricated here (T-166-02 / T-205-06-E). The run/halt posture for every step
// is SOURCED at compose time from postureForCommand (the registry authority):
// find-bottlenecks / find-analogies / challenge-assumptions / beautiful-question
// carry the registry autonomous_safe flag (-> auto-run recon prefix); bono is NOT
// autonomous_safe (-> the first material gate, the GUIDED safe-halt); the TELL
// synthesis handle (/mos:tell-synthesis) has NO registry flag, so it degrades to a
// withhold-default halt -- it never auto-runs before the gate (Reach rule 8 /
// Phase 166 GUIDED safe-halt preserved).
//
// The recipe keys MIRROR the sensor-circularity CAUSES enum. recipe-maps stays
// dependency-free of the sensor (no require cycle); the drift guard that the keys
// equal the sensor CAUSES lives in tests/test-205-pipelining.cjs.
// ---------------------------------------------------------------------------
const SENS10_CAUSE_RECIPES = Object.freeze({
  // answer_unheard -> stop asking, DELIVER. A short TELL-synthesis chain: the
  // synthesis IS the terminal material delivery (no registry flag -> withhold-
  // default halt), so the GUIDED gate fires on the deliver rather than auto-running.
  answer_unheard: Object.freeze(['/mos:tell-synthesis']),
  // assertion_unvalidated -> the GRILL chain: recon (challenge-assumptions, the
  // logical Arm A, autonomous_safe) + find-analogies, then the bono material gate
  // (Arm B external validation), then the TELL synthesis.
  assertion_unvalidated: Object.freeze([
    '/mos:challenge-assumptions',
    '/mos:find-analogies',
    '/mos:bono',
    '/mos:tell-synthesis',
  ]),
  // stuck_unlocated -> LEADS with find-bottlenecks (the SENS-02 lagging-component
  // reuse), then find-analogies, then the bono material gate, then TELL synthesis.
  stuck_unlocated: Object.freeze([
    '/mos:find-bottlenecks',
    '/mos:find-analogies',
    '/mos:bono',
    '/mos:tell-synthesis',
  ]),
  // wrong_frame -> LEADS with beautiful-question (REFRAME: Why / What-if / How),
  // then find-analogies, then the bono material gate, then the TELL synthesis.
  wrong_frame: Object.freeze([
    '/mos:beautiful-question',
    '/mos:find-analogies',
    '/mos:bono',
    '/mos:tell-synthesis',
  ]),
});

/**
 * recipeForCause(cause) -> string[]
 * The ordered command chain a SENS-10 cause composes into (recon prefix ->
 * material gate -> TELL synthesis). An unknown / empty cause -> []. The returned
 * array is a fresh copy (never the frozen source). Never throws. The step
 * postures are NOT decided here -- the caller sources them via postureForCommand
 * so the run/halt verb always comes from the registry (never fabricated).
 */
function recipeForCause(cause) {
  if (typeof cause !== 'string' || cause.length === 0) return [];
  const recipe = SENS10_CAUSE_RECIPES[cause];
  return Array.isArray(recipe) ? recipe.slice() : [];
}

// ---------------------------------------------------------------------------
// JOB 5 (Phase 229-04, seam d): the NAMED recipe map -- a recipe-name -> ordered
// bare-command chain, a SIBLING to SENS10_CAUSE_RECIPES (not a modification of
// it). This is the posture/ORDER authority for a named pipeline: a single
// queryable source of the ordered bare-command list, so the orchestrator, the
// autonomy validator, and the shipped pipelines/<name>/CHAIN.md stage files all
// read ONE ordering and never drift into a competing order.
//
// Same T-166-02 / T-205-06-E rule as the SENS-10 map: the values are BARE
// COMMAND STRINGS ONLY -- NO autonomous_safe literal is fabricated here. The
// run/halt posture for every step is SOURCED at compose time from
// postureForCommand (the ONE registry posture authority). All four PWS_grading
// commands resolve autonomous_safe:true in data/command-registry.json, so
// validateChainAutonomy reports runnable:true with zero blockers -- the chain
// runs unattended (score-and-continue); the build-thesis 6/10 halt is neutralized
// at the PROMPT layer (references/methodology/rubric-huji.md), never here.
//
//   PWS_grading -- the HUJI pitch-feedback chain in methodology-native order
//   (navigator-locked 15.7.2026): deep-grade spine -> mullins (BEFORE
//   build-thesis) -> build-thesis (scored, non-gating) -> structure-argument
//   (Minto pyramid packaging, last). The recipe name is EXACTLY PWS_grading for
//   every invocable surface; "pitch-feedback" only labels the phase dir.
// ---------------------------------------------------------------------------
const NAMED_RECIPES = Object.freeze({
  PWS_grading: Object.freeze([
    '/mos:deep-grade',
    '/mos:mullins',
    '/mos:build-thesis',
    '/mos:structure-argument',
  ]),
});

/**
 * recipeForName(name) -> string[]
 * The ordered command chain a NAMED recipe composes into. Mirrors
 * recipeForCause EXACTLY: an unknown / empty name -> []; the returned array is a
 * fresh copy (never the frozen source, so a caller mutating it cannot corrupt
 * the authority); never throws. The step postures are NOT decided here -- the
 * caller sources them via postureForCommand so the run/halt verb always comes
 * from the registry (never fabricated).
 */
function recipeForName(name) {
  if (typeof name !== 'string' || name.length === 0) return [];
  const recipe = NAMED_RECIPES[name];
  return Array.isArray(recipe) ? recipe.slice() : [];
}

// ---------------------------------------------------------------------------
// THE DECLARED DESCRIPTOR READER (D-167-02). loadManifest() reads the declared,
// versioned harness MANIFEST (data/harness-manifest.json) and returns the
// three-map binding it names. This is the DECLARED descriptor reader; the three
// read-join functions above (postureForCommand / wiringForReach /
// rankedNextReach) remain the live EXECUTABLE join. A future reader must NOT
// collapse one into the other: the manifest is the declared / versioned
// descriptor (the control-plane entry point), recipe-maps is the live join (the
// runtime read). recipe-maps is NOT retired (D-166-03).
// ---------------------------------------------------------------------------
/**
 * loadManifest() -> { methodology_tier, version, maps:[{ role, path, digest,
 *                     source_count }], runtime_surfaces:[{ role, path, digest }] }
 * The declared harness binding read from data/harness-manifest.json: the three
 * DATA maps - posture (command-registry), wiring (connector-registry), and
 * ranked_next_reach (brain-orchestration-projection) named by role + path +
 * digest + source_count - PLUS (Phase 201-01, SEED-032) the four RUNTIME surfaces
 * (the runChain spine, the decide() engine, the statusline cockpit, the
 * brain-orchestration reader) named by role + path + digest (digest-only,
 * D-201-1). The runtime_surfaces block is ADDITIVE and read TOLERANTLY: the three
 * read-joins ignore it, so postureForCommand / wiringForReach / rankedNextReach
 * are byte-unchanged (D-166-03 preserved). A missing / malformed manifest degrades
 * to the documented empty binding ({ methodology_tier: null, version: null,
 * maps: [], runtime_surfaces: [] }) and never throws, mirroring the
 * _loadProjection degrade idiom.
 *
 * Per D-167-02, this is the DECLARED / VERSIONED descriptor reader; the runtime
 * reads the manifest here while recipe-maps stays the live executable read-join
 * (postureForCommand / wiringForReach / rankedNextReach). recipe-maps is NOT
 * retired (D-166-03). Canon Part 8: the manifest is a LOCAL committed artifact;
 * reading it opens NO Brain wire (zero Brain calls in this file).
 */
function loadManifest() {
  return _loadManifest();
}

// manifest() is an alias of loadManifest() (the same declared-descriptor read).
function manifest() {
  return _loadManifest();
}

// Test-only: clear the per-process caches so a test can re-point the maps.
function __reset() {
  _connectorCache = null;
  _projectionCache = null;
  _manifestCache = null;
  if (typeof resolver.__reset === 'function') resolver.__reset();
}

module.exports = {
  postureForCommand: postureForCommand,
  wiringForReach: wiringForReach,
  rankedNextReach: rankedNextReach,
  loadManifest: loadManifest,
  manifest: manifest,
  // Phase 205-06 (SCOPE-6 pipelining): the SENS-10 cause -> compose recipe.
  recipeForCause: recipeForCause,
  SENS10_CAUSE_RECIPES: SENS10_CAUSE_RECIPES,
  // Phase 229-04 (seam d): the NAMED recipe map + accessor (PWS_grading).
  recipeForName: recipeForName,
  NAMED_RECIPES: NAMED_RECIPES,
  // Test-only surface (see header).
  __reset: __reset,
};
