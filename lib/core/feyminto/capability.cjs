'use strict';
/*
 * lib/core/feyminto/capability.cjs -- FeyMinto's local capability marker: can this install actually run it?
 *
 * Plan 369.25-06 (TFACE-04). SEED-122 ruling 5: "a recommendation is a handle, not a capability". FeyMinto never
 * claims a framework ran; it says, per surface, one of three things (the open question on the instruction-only
 * definition, RESEARCH Pattern 7, decided in this plan because it composes local facts that already exist):
 *   runnable         the command is in data/command-registry.json with surface navigator and a command file for it exists
 *                    on this install (commands/<name>.md or a file whose frontmatter name: is the command). On CLI that is enough. On the MCP surfaces (Desktop, Cowork) it must also be in
 *                    lib/mcp/tool-router.cjs ALL_TOOL_COMMANDS and not in UNIMPLEMENTED_MUTATING_ORCHESTRATION (the
 *                    commands that answer with a NOT EXECUTED banner).
 *   instruction-only the command exists on this install but on this surface it returns reference text only (an
 *                    internal-surface command, a missing command file, an MCP command that is unrouted or unimplemented).
 *   assisted         no command on this install lists the framework in its registry `frameworks` field, so the face
 *                    offers retrieved material for labeled assisted reasoning.
 * The install version comes from lib/core/repo-version.cjs readRepoVersion.
 *
 * The router is required lazily, only when an MCP marker is asked for (about 100 ms at HEAD). If it cannot be loaded
 * the MCP marker falls to instruction-only: this module never guesses toward runnable.
 *
 * Pure local reads. No network, no Brain, no write.
 */
const fs = require('node:fs');
const path = require('node:path');

const PLUGIN_ROOT = path.resolve(__dirname, '..', '..', '..');
const CAPABILITY = Object.freeze({ RUNNABLE: 'runnable', INSTRUCTION_ONLY: 'instruction-only', ASSISTED: 'assisted' });
const NO_RUNNABLE_LINE = 'no runnable command here; instruction-only or assisted';

const LABELS = Object.freeze({
  both: 'runnable here (CLI and Desktop)',
  cliOnly: 'runnable on CLI; instruction-only on Desktop and Cowork',
  instructionOnly: 'instruction-only',
  assisted: 'assisted: no command on this install maps this framework',
});

let registryCache = null;
function registry() {
  if (!registryCache) {
    const doc = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, 'data', 'command-registry.json'), 'utf8'));
    registryCache = doc.commands.map((c) => ({ ...c, name: String(c.command).replace(/^\/mos:/, '') }));
  }
  return registryCache;
}

let routerSets;
function router() {
  if (routerSets === undefined) {
    try {
      const r = require('../../mcp/tool-router.cjs');
      routerSets = { all: new Set(r.ALL_TOOL_COMMANDS), unimplemented: new Set(r.UNIMPLEMENTED_MUTATING_ORCHESTRATION || []) };
    } catch (_e) {
      routerSets = null;
    }
  }
  return routerSets;
}

function installVersion() {
  try {
    return require('../repo-version.cjs').readRepoVersion(PLUGIN_ROOT).version;
  } catch (_e) {
    return null;
  }
}

function labelFor(cli, mcp) {
  if (cli === CAPABILITY.RUNNABLE && mcp === CAPABILITY.RUNNABLE) return LABELS.both;
  if (cli === CAPABILITY.RUNNABLE) return LABELS.cliOnly;
  return LABELS.instructionOnly;
}

// A command's file is commands/<name>.md, or a commands/*.md whose frontmatter `name:` key is the command name
// (value-proposition.md declares name: validate-proposition on purpose). Read once, lazily.
let commandFileNames;
function commandFileExists(name) {
  if (commandFileNames === undefined) {
    commandFileNames = new Set();
    const dir = path.join(PLUGIN_ROOT, 'commands');
    let files = [];
    try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')); } catch (_e) { files = []; }
    for (const f of files) {
      commandFileNames.add(f.slice(0, -3));
      try {
        const head = fs.readFileSync(path.join(dir, f), 'utf8').split('\n').slice(0, 40).join('\n');
        const m = head.match(/^name:\s*([a-z0-9-]+)\s*$/m);
        if (m) commandFileNames.add(m[1]);
      } catch (_e) { /* an unreadable file simply does not vouch for a name */ }
    }
  }
  return commandFileNames.has(name);
}

function markCommand(entry) {
  const name = entry.name;
  if (entry.surface !== 'navigator') {
    return { cli: CAPABILITY.INSTRUCTION_ONLY, mcp: CAPABILITY.INSTRUCTION_ONLY, reason: 'internal surface' };
  }
  if (!commandFileExists(name)) {
    return { cli: CAPABILITY.INSTRUCTION_ONLY, mcp: CAPABILITY.INSTRUCTION_ONLY, reason: 'command file missing on this install' };
  }
  const sets = router();
  let mcp;
  let reason = null;
  if (!sets) { mcp = CAPABILITY.INSTRUCTION_ONLY; reason = 'MCP router not loadable'; }
  else if (!sets.all.has(name)) { mcp = CAPABILITY.INSTRUCTION_ONLY; reason = 'not routed on the MCP surfaces'; }
  else if (sets.unimplemented.has(name)) { mcp = CAPABILITY.INSTRUCTION_ONLY; reason = 'MCP answers with a NOT EXECUTED banner'; }
  else mcp = CAPABILITY.RUNNABLE;
  return { cli: CAPABILITY.RUNNABLE, mcp, reason };
}

function best(a, b) {
  return a === CAPABILITY.RUNNABLE || b === CAPABILITY.RUNNABLE ? CAPABILITY.RUNNABLE : CAPABILITY.INSTRUCTION_ONLY;
}

/**
 * capabilityFor(name, ctx): ctx.kind is 'command' (default) or 'framework'.
 * command   -> { known:false } for a name the registry does not carry; else { known, kind, name, cli, mcp, version, label, reason }
 * framework -> { known:true, kind, name, cli, mcp, version, label, commands, reason }; assisted when no command lists it.
 */
function capabilityFor(name, ctx) {
  const kind = ctx && ctx.kind === 'framework' ? 'framework' : 'command';
  const version = installVersion();
  if (kind === 'command') {
    const key = String(name).replace(/^\/mos:/, '');
    const entry = registry().find((c) => c.name === key);
    if (!entry) return { known: false, kind, name: key };
    const m = markCommand(entry);
    return { known: true, kind, name: key, cli: m.cli, mcp: m.mcp, version, label: labelFor(m.cli, m.mcp), reason: m.reason };
  }
  const want = String(name).trim().toLowerCase();
  const owners = registry().filter((c) => (c.frameworks || []).some((f) => String(f).trim().toLowerCase() === want));
  if (owners.length === 0) {
    return {
      known: true, kind, name, cli: CAPABILITY.ASSISTED, mcp: CAPABILITY.ASSISTED, version, label: LABELS.assisted,
      commands: [], reason: 'no command on this install lists this framework',
    };
  }
  let cli = CAPABILITY.INSTRUCTION_ONLY;
  let mcp = CAPABILITY.INSTRUCTION_ONLY;
  for (const o of owners) {
    const m = markCommand(o);
    cli = best(cli, m.cli);
    mcp = best(mcp, m.mcp);
  }
  return { known: true, kind, name, cli, mcp, version, label: labelFor(cli, mcp), commands: owners.map((o) => o.name), reason: null };
}

/**
 * sectionMarker(section): the fixed no-runnable line when the navigator data names the section as having no dedicated
 * command AND the section contract's own "Ground truth" line confirms it; otherwise null. Never invents a command.
 */
function sectionMarker(section) {
  let rel;
  try {
    rel = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, 'data', 'section-command-relevance.json'), 'utf8'));
  } catch (_e) {
    return null;
  }
  if (!Array.isArray(rel.no_dedicated_command) || !rel.no_dedicated_command.includes(section)) return null;
  const gt = require('./command-sources.cjs').contractGroundTruth(section);
  return gt.has_line && gt.none ? NO_RUNNABLE_LINE : null;
}

module.exports = { CAPABILITY, capabilityFor, sectionMarker };
