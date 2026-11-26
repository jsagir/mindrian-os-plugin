'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 122-03 -- command-resolver.cjs (the only door)
 * ====================================================
 * The SOLE deterministic read-only path from "framework" to "command".
 * Reads data/command-registry.json at runtime and, for the known-framework check only
 * (Phase 400.4-01, QA-F5), data/framework-names.json. Both are plugin-local snapshots. NEVER touches the Brain.
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
 *   resolveFrameworkName(name)  -> { key, commands, via }   (Phase 400.4-01: exact key, then normalized key,
 *                                   then command id; composeWorkflow uses this, commandsForFramework stays exact)
 *   frameworksForCommand(cmd)   -> string[]   (the command entry's frameworks, or [])
 *   composeWorkflow(chain, opts) -> [{ step, framework, command|null, optional }]
                                   (Phase 399 I-07: opts { jobId, definitionLevel, lastCommand } lets the
                                   decision advisor pick among a framework's commands; no opts, or the
                                   advisor not switched on, gives the output of base, byte for byte)
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

// ---------------------------------------------------------------------------
// Phase 400.4-01 (QA-F5): framework-name normalization.
// A host model writes "Beautiful Question", "beautiful-question" or "/mos:beautiful-question"
// where the registry key is "Beautiful Question Framework". composeWorkflow now matches by an
// exact key first (byte-identical to base), then by a normalized key, then by command id.
// A name that matches nothing and is not a known framework name is reported as unresolved,
// never as a silent optional step. commandsForFramework stays an exact lookup (the
// chain-recommender contract).
// ---------------------------------------------------------------------------

/**
 * normalizeFrameworkName(name) -> string
 * trim, lower-case, hyphen and underscore runs to one space, collapse whitespace, strip a leading
 * "/mos:" or "mos:", strip a trailing " framework", then strip one trailing "s" from the last word
 * when that word is longer than 3 characters and does not end in "ss". '' for a non-string.
 */
function normalizeFrameworkName(name) {
  if (typeof name !== 'string') return '';
  let t = name.trim().toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(/^\/?mos:/, '').trim();
  t = t.replace(/ framework$/, '').trim();
  const words = t.split(' ');
  const last = words[words.length - 1];
  if (last.length > 3 && last.endsWith('s') && !last.endsWith('ss')) {
    words[words.length - 1] = last.slice(0, -1);
  }
  return words.join(' ');
}

// The command-id form of a name: "Analyze Needs" -> "analyze-needs". No plural or "framework" stripping.
function _commandIdForm(name) {
  if (typeof name !== 'string') return '';
  return name.trim().toLowerCase().replace(/^\/?mos:/, '').trim().replace(/[\s_]+/g, '-');
}

// Normalized framework_index key map, built once per _load cache (cleared by __reset).
let _normMap = null;
function _normalizedKeyMap() {
  if (_normMap) return _normMap;
  const m = new Map();
  const keys = Object.keys(_load().framework_index || {});
  for (let i = 0; i < keys.length; i += 1) {
    const n = normalizeFrameworkName(keys[i]);
    if (n && !m.has(n)) m.set(n, keys[i]); // registry key order wins on a collision
  }
  _normMap = m;
  return m;
}

// Known framework names (data/framework-names.json: framework_names and curated_extras), normalized.
// Plugin-local snapshot, read once and lazily, tolerant of a missing or malformed file. No network.
let _knownNames = null;
function _knownFrameworkNames() {
  if (_knownNames) return _knownNames;
  const set = new Set();
  try {
    const raw = fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'framework-names.json'), 'utf8');
    const parsed = JSON.parse(raw);
    const lists = [parsed && parsed.framework_names, parsed && parsed.curated_extras];
    for (let i = 0; i < lists.length; i += 1) {
      if (!Array.isArray(lists[i])) continue;
      for (let j = 0; j < lists[i].length; j += 1) {
        const n = normalizeFrameworkName(lists[i][j]);
        if (n) set.add(n);
      }
    }
  } catch (_e) { /* degrade: an empty set */ }
  _knownNames = set;
  return set;
}

/**
 * resolveFrameworkName(name) -> { key, commands, via }
 * via 'exact' (a framework_index key), 'normalized' (the first key, in registry order, with the same
 * normalized form), 'command_id' (a registry command; key is null), or null (nothing matched).
 * Never throws; never fabricates a command.
 */
function resolveFrameworkName(name) {
  const none = { key: null, commands: [], via: null };
  if (typeof name !== 'string' || name.length === 0) return none;
  const reg = _load();
  const idx = reg.framework_index || {};
  if (Object.prototype.hasOwnProperty.call(idx, name) && Array.isArray(idx[name])) {
    return { key: name, commands: idx[name].slice(), via: 'exact' };
  }
  const norm = normalizeFrameworkName(name);
  const nk = norm ? _normalizedKeyMap().get(norm) : undefined;
  if (nk !== undefined && Array.isArray(idx[nk])) {
    return { key: nk, commands: idx[nk].slice(), via: 'normalized' };
  }
  const id = _commandIdForm(name);
  if (id) {
    const cmd = '/mos:' + id;
    const hit = reg.commands.find(function (x) { return x && x.command === cmd; });
    if (hit) return { key: null, commands: [cmd], via: 'command_id' };
  }
  return none;
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

// ---------------------------------------------------------------------------
// Phase 399-08 (I-07): the decision advisor ranks among the commands of ONE
// framework, inside this door. It adds no second resolver: the commands it
// ranks are exactly commandsForFramework(fw), and the advisor table is read
// only through lib/core/decision-advisor/shortlist.cjs (local JSON, no Brain).
//
// Opt-in (orchestrator ruling 2026-11-24): the advisor acts only when
// shortlist.advisorEnabled() is true (MINDRIAN_DECISION_ADVISOR=on). With the
// advisor off, with no opts, or with opts that carry no job id, no step gains a
// key and the output is byte-identical to base.
//
// Tie rule (from 399-07): a command moves ahead of another only on a strictly
// greater calibrated value. When the top of the table row is a tie
// (shortlist top_tie > 1), the order inside the tie is alphabetical, not a
// preference, so the advisor abstains and registry order stands.
// No number leaves this function: the step carries a basis word and a name list.
// ---------------------------------------------------------------------------
function _advisorContext(opts) {
  if (!opts || typeof opts !== 'object' || Array.isArray(opts)) return null;
  if (typeof opts.jobId !== 'string' || opts.jobId.trim().length === 0) return null;
  try {
    const sl = require('../core/decision-advisor/shortlist.cjs');
    if (sl.advisorEnabled() !== true) return null;
    const query = {
      jobId: opts.jobId,
      definitionLevel: opts.definitionLevel,
      causeEffect: opts.causeEffect,
      lastCommand: opts.lastCommand,
    };
    const meta = sl.tableMeta();
    const shortlist = sl.lookupShortlist(query);
    // A tie at the top of the row means no reorder (abstain). Phase 400-10 (CY-05): the chaotic domain also
    // abstains (the advisor gives no strong pick, F-04).
    const abstain = shortlist.top_tie > 1 || query.causeEffect === 'chaotic';
    // Phase 400-10: when the domain reordered the strong band, the fit commands of the one lookup go first.
    // Review WR-04: the fit set (shortlist.domain.fits), not a position list, so equal values stay equal and
    // keep registry order. Otherwise null, and the 399 value order stands.
    const reordered = !!(shortlist.domain && shortlist.domain.effect === 'reordered');
    const fits = reordered && Array.isArray(shortlist.domain.fits) ? new Set(shortlist.domain.fits.map(_bareCommand)) : null;
    return { sl: sl, query: query, thresholds: meta ? meta.thresholds : null, abstain: abstain, fits: fits };
  } catch (_e) {
    return null;
  }
}

// ranked_commands: commands with a strong value, by value descending (stable,
// so equal values keep registry order), then every other command in registry order.
// Review WR-04: this matches the next-move selector. Only the strong band promotes a command (a
// possible command never reorders), and the command that just ran (lastCommand) is never promoted,
// so a chain step does not re-run it.
function _bareCommand(c) {
  return typeof c === 'string' ? c.replace(/^\/?(mos:)?/, '') : '';
}
function _rankCommands(cmds, ctx) {
  if (ctx.abstain || !ctx.thresholds) return cmds.slice();
  const last = _bareCommand(ctx.query.lastCommand);
  const scored = [];
  const rest = [];
  cmds.forEach(function (cmd, idx) {
    const isLast = last.length > 0 && _bareCommand(cmd) === last;
    const value = isLast ? null : ctx.sl.scoreFor(ctx.query, cmd);
    if (typeof value === 'number' && ctx.sl.bandFor(value, ctx.thresholds) === 'strong') {
      scored.push({ cmd: cmd, value: value, idx: idx });
    } else {
      rest.push(cmd);
    }
  });
  if (ctx.fits) {
    // Phase 400-10, review WR-04: sort by (fit desc, value desc, registry index asc). A fit command goes
    // ahead of a non-fit one; inside each part equal values keep registry order.
    const fit = function (x) { return ctx.fits.has(_bareCommand(x.cmd)) ? 1 : 0; };
    scored.sort(function (a, b) { return (fit(b) - fit(a)) || (b.value - a.value) || (a.idx - b.idx); });
  } else {
    scored.sort(function (a, b) { return (b.value - a.value) || (a.idx - b.idx); });
  }
  return scored.map(function (x) { return x.cmd; }).concat(rest);
}

/**
 * advisorOptsForRoom(roomDir) -> { jobId, definitionLevel, causeEffect? } | null
 * Phase 400-10 (CY-05): causeEffect (the room's stored cause and effect domain) is present only when the room
 * has one, so a room without a domain gives exactly the 399 options. It is read only on the advisor-on path.
 * Review WR-05: the one place a caller builds the composeWorkflow advisor options. It returns null FIRST when
 * the advisor is off (MINDRIAN_DECISION_ADVISOR is not "on"), so the default path reads neither the job nor the
 * room axes. Null also when the room has no selection job. A caller passes the result only when it is not null:
 * `opts ? composeWorkflow(chain, opts) : composeWorkflow(chain)`. Never throws.
 */
function advisorOptsForRoom(roomDir) {
  try {
    if (require('../core/decision-advisor/shortlist.cjs').advisorEnabled() !== true) return null;
    const selJob = require('../hmi/jtbd-state.cjs').resolveSelectionJob(roomDir, null);
    if (!selJob || typeof selJob.id !== 'string' || selJob.id.length === 0) return null;
    let definitionLevel = null;
    try { definitionLevel = require('../core/problem-axes.cjs').readRoomAxes(roomDir).definition_level || null; } catch (_e) { definitionLevel = null; }
    let causeEffect = null;
    try {
      const ce = require('../core/navigation/cause-effect.cjs').readCauseEffectForRoom(roomDir);
      causeEffect = ce && typeof ce.domain === 'string' ? ce.domain : null;
    } catch (_e) { causeEffect = null; }
    if (causeEffect) return { jobId: selJob.id, definitionLevel: definitionLevel, causeEffect: causeEffect };
    return { jobId: selJob.id, definitionLevel: definitionLevel };
  } catch (_e) {
    return null;
  }
}

// True when `fw` is a non-empty string that matches no registry key and no known framework name, and the
// registry is loaded. A missing registry degrades to optional steps (base behavior), never to unresolved.
function _isUnknownFrameworkName(fw) {
  if (typeof fw !== 'string' || fw.trim().length === 0) return false;
  const reg = _load();
  if (reg === EMPTY_REGISTRY || reg.commands.length === 0) return false;
  if (Object.prototype.hasOwnProperty.call(reg.framework_index || {}, fw)) return false;
  const n = normalizeFrameworkName(fw);
  return !(n && _knownFrameworkNames().has(n));
}

/**
 * composeWorkflow(frameworkChain, opts) -> [{ step, framework, command|null, optional, ...routing? }]
 * Maps an ordered framework-name list to a step list. The first command for
 * each framework is taken (registry order); a framework with no command degrades to
 * { command: null, optional: true } (the consumer prints "run X manually").
 * Non-array / [] -> []. Never throws.
 *
 * Phase 347-07: an entry may be a bare framework-name string (today's shape,
 * byte-identical output) or an object { framework, ...routing keys } to
 * declare any of the six OPTIONAL routing keys additively. The returned
 * array also carries an additive `routing_warnings` array naming every
 * declared-but-dropped malformed key.
 *
 * Phase 399-08 (I-07): opts { jobId, definitionLevel, lastCommand } is optional. Phase 400-10 adds
 * opts.causeEffect (the room's domain; unknown or absent gives the 399 output).
 * With a job id and the advisor switched on, a framework with 1 or more commands
 * gains `command_basis` ('advisor' when the pick differs from the first command,
 * else 'registry_order') and `ranked_commands` (names only), and `command` is the
 * first of them. Otherwise the output is unchanged.
 */
function composeWorkflow(frameworkChain, opts) {
  if (!Array.isArray(frameworkChain)) return [];
  const warnings = [];
  let anyDeclared = false;
  const advisor = _advisorContext(opts);
  const result = frameworkChain.map(function (entry, i) {
    const isDeclared = entry !== null && typeof entry === 'object';
    if (isDeclared) anyDeclared = true;
    const fw = isDeclared ? entry.framework : entry;
    const resolved = resolveFrameworkName(fw);
    const cmds = resolved.commands;
    const ranked = (advisor && cmds.length > 0) ? _rankCommands(cmds, advisor) : null;
    const stepObj = {
      step: i + 1,
      framework: fw,
      command: cmds.length > 0 ? (ranked ? ranked[0] : cmds[0]) : null,
      optional: cmds.length === 0,
    };
    if (resolved.via === 'normalized' || resolved.via === 'command_id') {
      // Phase 400.4-01 (QA-F5): say how the name was matched. An exact name gains no key.
      stepObj.resolved_via = resolved.via;
      stepObj.matched_framework = resolved.key;
    }
    if (cmds.length === 0 && _isUnknownFrameworkName(fw)) {
      // Phase 400.4-01 (QA-F5): a name that is no framework, no command id and no known framework name is
      // reported as unresolved, not as a silent optional step.
      stepObj.optional = false;
      stepObj.unresolved = true;
      stepObj.reason = 'unknown_framework_name';
    }
    if (ranked) {
      stepObj.command_basis = ranked[0] !== cmds[0] ? 'advisor' : 'registry_order';
      stepObj.ranked_commands = ranked;
    }
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
function __reset() { _cache = null; _normMap = null; _knownNames = null; }

module.exports = {
  commandsForFramework: commandsForFramework,
  // Phase 400.4-01 (QA-F5).
  normalizeFrameworkName: normalizeFrameworkName,
  resolveFrameworkName: resolveFrameworkName,
  frameworksForCommand: frameworksForCommand,
  composeWorkflow: composeWorkflow,
  advisorOptsForRoom: advisorOptsForRoom,
  validateChainAutonomy: validateChainAutonomy,
  // Phase 356 R5/R6: additive accessor (see doc comment above).
  commandRow: commandRow,
  // Test-only surface (see header).
  __reset: __reset,
};
