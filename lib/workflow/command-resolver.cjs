'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 122-03 -- command-resolver.cjs (the only door)
 * ====================================================
 * The SOLE deterministic read-only path from "framework" to "command".
 * Reads only data/command-registry.json at runtime. NEVER touches the Brain.
 *
 * Reliability rules (per .planning/WORKFLOW-LAYER-SPEC.md):
 *   3. The resolver is the only door. The suggest-next / pipeline / act
 *      orchestrators, the navigation hook, the pws-methodology skill, and
 *      the brain-connector skill all go through this module. Larry never
 *      names a command from memory; every command he emits came back from
 *      the resolver.
 *   5. Degrade, do not fabricate. A framework with no command yields
 *      { command: null, optional: true } -- never a made-up command. A
 *      missing / empty registry degrades every function to empty results.
 *
 * Canon Part 8 (Graph Boundary): this file does NOT require the Brain HTTP
 * client and makes ZERO network calls. The registry is a plugin-local,
 * generated, committed artifact (built by scripts/build-command-registry.cjs,
 * validated AGAINST the Brain's framework names at build time, never written
 * back). The pre-commit / test grep guard from 122-02 enforces the no-Brain
 * rule.
 *
 * The four functions:
 *   commandsForFramework(name)  -> string[]   (registry framework_index[name] or [])
 *   frameworksForCommand(cmd)   -> string[]   (the command entry's frameworks, or [])
 *   composeWorkflow(chain)      -> [{ step, framework, command|null, optional }]
 *   validateChainAutonomy(wf)   -> { runnable, blockers }
 *
 * Test-only surface (small, clearly test-only):
 *   __reset()                       clears the per-process cache
 *   MINDRIAN_COMMAND_REGISTRY env   overrides REGISTRY_PATH (for fixtures)
 *
 * License: BSL 1.1.
 */

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_REGISTRY_PATH = path.join(__dirname, '..', '..', 'data', 'command-registry.json');

// Test-only override: lets the test point at a fixture or a nonexistent file
// to exercise the degrade path. Resolved fresh on every _load() cache miss so
// a test can flip it between __reset() calls.
function _registryPath() {
  const override = process.env.MINDRIAN_COMMAND_REGISTRY;
  return (typeof override === 'string' && override.length > 0) ? override : DEFAULT_REGISTRY_PATH;
}

// Per-process cache. The registry is a generated artifact that does not change
// during a run; reading it once is the integration-registry.cjs precedent.
let _cache = null;

// Degrade shape: an empty registry. Every function returns empty results
// against it -- no throw, no fabricated command.
const EMPTY_REGISTRY = Object.freeze({ commands: [], framework_index: {}, curated_chains: [] });

function _load() {
  if (_cache) return _cache;
  try {
    const raw = fs.readFileSync(_registryPath(), 'utf8');
    const parsed = JSON.parse(raw);
    // Be tolerant of a partially-shaped file: fill missing keys.
    _cache = {
      commands: Array.isArray(parsed && parsed.commands) ? parsed.commands : [],
      framework_index: (parsed && parsed.framework_index && typeof parsed.framework_index === 'object')
        ? parsed.framework_index : {},
      curated_chains: Array.isArray(parsed && parsed.curated_chains) ? parsed.curated_chains : [],
    };
  } catch (_e) {
    _cache = EMPTY_REGISTRY; // degrade: missing / unreadable / malformed registry
  }
  return _cache;
}

/**
 * commandsForFramework(name) -> string[]
 * The /mos: command(s) declared (via frontmatter) to run framework `name`.
 * Unknown framework / empty registry -> []. Never throws.
 */
function commandsForFramework(name) {
  if (typeof name !== 'string' || name.length === 0) return [];
  const idx = _load().framework_index || {};
  const cmds = idx[name];
  return Array.isArray(cmds) ? cmds.slice() : [];
}

/**
 * frameworksForCommand(cmd) -> string[]
 * The framework(s) the given /mos: command declares it runs.
 * Unknown command / empty registry -> []. Never throws.
 */
function frameworksForCommand(cmd) {
  if (typeof cmd !== 'string' || cmd.length === 0) return [];
  const c = _load().commands.find(function (x) { return x && x.command === cmd; });
  return (c && Array.isArray(c.frameworks)) ? c.frameworks.slice() : [];
}

// ---------------------------------------------------------------------------
// Phase 347-07 (SHARED-06): six OPTIONAL routing keys, additive on
// composeWorkflow's output. Routing keys EXTEND the resolver's output; they
// never fork it and never mint a second resolver -- composeWorkflow stays
// the SOLE framework-to-command path (CLAUDE.md Connector Spine). Rejected
// alternative: a separate routing-graph document, which would be two
// sources of truth for control flow, the mistake pipeline-state.cjs:27-38's
// B1 single-source ruling already paid for once.
//
// A caller declares routing by passing an OBJECT entry (instead of a bare
// framework-name string) in frameworkChain: { framework, on_pass?, on_fail?,
// fan_out?, fan_in?, reviewer?, context? }. A bare string entry (every
// existing caller today) produces exactly today's four-key object -- the
// additive floor. A declared key that fails validation is DROPPED, never
// thrown: composeWorkflow is read by four surfaces that have nothing to do
// with routing, so a throw on one malformed optional key would take all of
// them down. The drop is recorded on an additive `routing_warnings` array
// hung off the returned array (Array.isArray stays true; .length, .map,
// JSON.stringify over indices are all untouched -- the same "named
// membership, never an exact count/shape" idiom edges.cjs:812-816 and
// room-context.cjs:337 already use for an additive floor).
// ---------------------------------------------------------------------------
const ROUTING_KEYS = Object.freeze(['on_pass', 'on_fail', 'fan_out', 'fan_in', 'reviewer', 'context']);

function _isStepIdOrNull(v) {
  return v === null || typeof v === 'string' || typeof v === 'number';
}
function _isFanOutArray(v) {
  return Array.isArray(v) && v.length > 0 && v.every(function (x) {
    return typeof x === 'string' || typeof x === 'number';
  });
}
function _isFanIn(v) {
  return !!(v && typeof v === 'object' && Array.isArray(v.from) && v.from.length > 0
    && typeof v.reducer === 'string' && v.reducer.length > 0);
}
function _isReviewer(v) {
  return !!(v && typeof v === 'object'
    && (v.kind === 'navigator' || v.kind === 'subagent')
    && typeof v.agent === 'string' && v.agent.length > 0);
}
function _isContext(v) {
  return !!(v && typeof v === 'object'
    && typeof v.focus_node_id === 'string' && v.focus_node_id.length > 0
    && v.budget && typeof v.budget === 'object');
}

const ROUTING_VALIDATORS = Object.freeze({
  on_pass: _isStepIdOrNull,
  on_fail: _isStepIdOrNull,
  fan_out: _isFanOutArray,
  fan_in: _isFanIn,
  reviewer: _isReviewer,
  context: _isContext,
});

// Validate and attach any declared routing keys onto stepObj. Malformed
// values are dropped and pushed onto `warnings` with a named reason -- never
// thrown, never silently kept.
function _attachRoutingKeys(stepObj, entry, stepNumber, warnings) {
  for (let k = 0; k < ROUTING_KEYS.length; k += 1) {
    const key = ROUTING_KEYS[k];
    if (!Object.prototype.hasOwnProperty.call(entry, key)) continue;
    const value = entry[key];
    const validator = ROUTING_VALIDATORS[key];
    if (validator(value)) {
      stepObj[key] = value;
    } else {
      warnings.push({ step: stepNumber, key: key, reason: 'malformed_routing_value' });
    }
  }
}

/**
 * composeWorkflow(frameworkChain) -> [{ step, framework, command|null, optional, ...routing? }]
 * Maps an ordered framework-name list to a step list. The first command for
 * each framework is taken; a framework with no command degrades to
 * { command: null, optional: true } (the consumer prints "run X manually").
 * Non-array / [] -> []. Never throws.
 *
 * Phase 347-07: an entry may be a bare framework-name string (today's shape,
 * byte-identical output) or an object { framework, ...routing keys } to
 * declare any of the six OPTIONAL routing keys additively. The returned
 * array also carries an additive `routing_warnings` array naming every
 * declared-but-dropped malformed key.
 */
function composeWorkflow(frameworkChain) {
  if (!Array.isArray(frameworkChain)) return [];
  const warnings = [];
  let anyDeclared = false;
  const result = frameworkChain.map(function (entry, i) {
    const isDeclared = entry !== null && typeof entry === 'object';
    if (isDeclared) anyDeclared = true;
    const fw = isDeclared ? entry.framework : entry;
    const cmds = commandsForFramework(fw);
    const stepObj = {
      step: i + 1,
      framework: fw,
      command: cmds.length > 0 ? cmds[0] : null,
      optional: cmds.length === 0,
    };
    if (isDeclared) {
      _attachRoutingKeys(stepObj, entry, i + 1, warnings);
    }
    return stepObj;
  });
  // Additive floor: routing_warnings hangs off the array as a named property,
  // ONLY when the caller actually declared routing on at least one entry.
  // Node's assert.deepStrictEqual compares an array's own enumerable
  // properties, not just its indices -- attaching this unconditionally would
  // break every existing caller's full-array equality check against a bare
  // framework-name chain, which is exactly the byte-identical floor this key
  // set exists to protect (SHARED-06). A chain built entirely from bare
  // framework-name strings (every caller shipped before this plan) never
  // triggers this branch, so `result` stays a plain array with no
  // non-index property, in the same shape it has always returned.
  if (anyDeclared) {
    result.routing_warnings = warnings;
  }
  return result;
}

/**
 * validateChainAutonomy(workflow) -> { runnable, blockers }
 * `blockers` names every step whose command exists in the registry but is not
 * `autonomous_safe: true` (or is unknown to the registry). Steps with
 * command === null are skipped (not blockers -- they are manual-only by
 * design, the consumer surfaces a "run manually" line, /mos:act --chain stops
 * there with a "needs you here" gate per the spec). Never throws.
 */
function validateChainAutonomy(workflow) {
  const reg = _load();
  const byCmd = new Map(reg.commands.map(function (c) { return [c && c.command, c]; }));
  const blockers = [];
  for (const s of (Array.isArray(workflow) ? workflow : [])) {
    if (!s || !s.command) continue; // null command -> not a blocker (manual step)
    const c = byCmd.get(s.command);
    if (!c || c.autonomous_safe !== true) {
      blockers.push({ step: s.step, command: s.command, reason: 'not autonomous_safe' });
    }
  }
  return { runnable: blockers.length === 0, blockers: blockers };
}

/**
 * commandRow(cmd) -> { command, teaching, jtbd_summary } | null
 * Phase 356 R5/R6: additive accessor over the existing cached registry read,
 * frozen raw values only, for lib/core/irreversibility-ledger.cjs's staleness
 * hash. Unknown command / empty / non-string -> null. Never throws.
 */
function commandRow(cmd) {
  if (typeof cmd !== 'string' || cmd.length === 0) return null;
  const c = _load().commands.find(function (x) { return x && x.command === cmd; });
  if (!c) return null;
  return Object.freeze({ command: c.command, teaching: c.teaching, jtbd_summary: c.jtbd_summary });
}

// Test-only: clear the per-process cache so a test can re-point the registry.
function __reset() { _cache = null; }

module.exports = {
  commandsForFramework: commandsForFramework,
  frameworksForCommand: frameworksForCommand,
  composeWorkflow: composeWorkflow,
  validateChainAutonomy: validateChainAutonomy,
  // Phase 356 R5/R6: additive accessor (see doc comment above).
  commandRow: commandRow,
  // Test-only surface (see header).
  __reset: __reset,
};
