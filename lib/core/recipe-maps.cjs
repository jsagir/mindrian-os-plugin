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

function _connectorPath() {
  const o = process.env.MINDRIAN_CONNECTOR_REGISTRY;
  return (typeof o === 'string' && o.length > 0) ? o : DEFAULT_CONNECTOR_PATH;
}

function _projectionPath() {
  const o = process.env.MINDRIAN_ORCHESTRATION_PROJECTION;
  return (typeof o === 'string' && o.length > 0) ? o : DEFAULT_PROJECTION_PATH;
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

// Test-only: clear the per-process caches so a test can re-point the maps.
function __reset() {
  _connectorCache = null;
  _projectionCache = null;
  if (typeof resolver.__reset === 'function') resolver.__reset();
}

module.exports = {
  postureForCommand: postureForCommand,
  wiringForReach: wiringForReach,
  rankedNextReach: rankedNextReach,
  // Test-only surface (see header).
  __reset: __reset,
};
