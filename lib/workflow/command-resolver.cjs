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

/**
 * composeWorkflow(frameworkChain) -> [{ step, framework, command|null, optional }]
 * Maps an ordered framework-name list to a step list. The first command for
 * each framework is taken; a framework with no command degrades to
 * { command: null, optional: true } (the consumer prints "run X manually").
 * Non-array / [] -> []. Never throws.
 */
function composeWorkflow(frameworkChain) {
  if (!Array.isArray(frameworkChain)) return [];
  return frameworkChain.map(function (fw, i) {
    const cmds = commandsForFramework(fw);
    return {
      step: i + 1,
      framework: fw,
      command: cmds.length > 0 ? cmds[0] : null,
      optional: cmds.length === 0,
    };
  });
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

// Test-only: clear the per-process cache so a test can re-point the registry.
function __reset() { _cache = null; }

module.exports = {
  commandsForFramework: commandsForFramework,
  frameworksForCommand: frameworksForCommand,
  composeWorkflow: composeWorkflow,
  validateChainAutonomy: validateChainAutonomy,
  // Test-only surface (see header).
  __reset: __reset,
};
