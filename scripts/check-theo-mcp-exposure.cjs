#!/usr/bin/env node
'use strict';

/*
 * scripts/check-theo-mcp-exposure.cjs
 *
 * THEO-04 (354-CONTEXT.md Addendum 2026-09-23, navigator-ruled 2026-09-23):
 * the raw `theo` MCP server (`~/.claude.json` mcpServers.theo ->
 * `node /home/jsagi/Theo/dist/index.js`) is a live, ungated second path to
 * the same Brain backend `lib/core/part8-egress-guard.cjs` patches (D-354-EGR
 * / THEO-03, 354-06) via this plugin's own guarded `mindrian-brain` shim
 * (`bin/mindrian-brain-mcp-client.cjs`, this repo's `.mcp.json`). Verified:
 * `theo-mcp.onrender.com` appears in exactly one place in this repo
 * (`lib/core/brain-client.cjs`); the raw `theo` server never touches that
 * code and never passes through `part8-egress-guard.cjs`.
 *
 * Navigator decision (2026-09-23): DOCUMENT + procedural discipline, NOT
 * removal, NOT a code fix. The raw `theo` server remains a legitimate
 * standing consult for Theo-repo-own dev work (CLAUDE.md's 2026-09-02
 * ruling, "Consult ALL Relevant Grounding Sources During Dev Work"); its
 * own repository (`/home/jsagi/Theo`) is out of scope for this plugin phase
 * to patch or deploy. This script does NOT unregister the `theo` MCP entry
 * and does NOT gate anything -- it makes the risk visible, nothing more.
 *
 * ADVISORY, ALWAYS. This script exits 0 regardless of what it finds. There
 * is deliberately NO --strict escalation flag (unlike this repo's sibling
 * pattern, scripts/check-shape-declaration.cjs) -- the navigator's decision
 * was documentation + visibility, never enforcement, so inventing a
 * stricter mode here would overstate what was actually decided.
 *
 * OFFLINE, ALWAYS. This script opens NO network connection, calls NO
 * vendor endpoint, and requires NO key (Canon Part 8: LOCAL-only). It reads
 * exactly two locations from disk:
 *   1. ~/.claude.json (Claude Code's global MCP config) -- both its
 *      top-level `mcpServers` map ("user" scope) and, one level of nesting
 *      down, `projects[<this project dir>].mcpServers` ("local" scope) --
 *      the SAME two-scope shape lib/core/integration-registry.cjs's
 *      readScopedMcpServers() already reads (Part 7 reuse of the shape,
 *      not the function itself: that reader intentionally strips
 *      command/args/env as a secret-leak guard, which is correct for its
 *      own callers but leaves nothing to classify a stdio server's
 *      identity by -- theo and mindrian-brain are BOTH stdio servers with
 *      no `url` field at all, so this script re-reads the same two
 *      locations with a narrower, path-segment-only projection instead).
 *   2. This repo's own .mcp.json ("project" scope in Claude Code's own
 *      vocabulary) -- where the guarded `mindrian-brain` shim is normally
 *      registered.
 * Any location that is absent or unparseable is treated as "no entries
 * found there" and never throws.
 *
 * PROJECTION SAFETY: only `command` and `args` string values are read for
 * classification (path-segment substring matches only). `env`, `headers`,
 * and any other entry field are NEVER read or printed -- no new secret-leak
 * surface versus the existing readScopedMcpServers() guard.
 *
 * House rule: hyphens only, no em-dashes, no emoji. CJS, process.argv routing.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// readJsonConfig(configPath) -- read + JSON.parse, tolerating absence or
// malformed content. Returns the parsed object, or null on any failure.
// Never throws. LOCAL disk read only.
// ---------------------------------------------------------------------------
function readJsonConfig(configPath) {
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(raw);
  } catch (_e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// classifyEntry(entry) -- classify one mcpServers[name] object by its
// command/args path segments only. Returns 'theo-shaped',
// 'guarded-shim-shaped', or null (neither). Checked shim-first since the
// two signatures are mutually exclusive path segments in practice; order
// has no effect on a well-formed entry.
// ---------------------------------------------------------------------------
function classifyEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const parts = [];
  if (typeof entry.command === 'string') parts.push(entry.command);
  if (Array.isArray(entry.args)) {
    for (const a of entry.args) {
      if (typeof a === 'string') parts.push(a);
    }
  }
  const joined = parts.join(' ');
  if (joined.indexOf('mindrian-brain-mcp-client.cjs') !== -1) return 'guarded-shim-shaped';
  if (joined.indexOf('/Theo/dist/index.js') !== -1 || /\/Theo(\/|$)/.test(joined)) return 'theo-shaped';
  return null;
}

// ---------------------------------------------------------------------------
// scanMcpConfigs(opts) -- walk the three mcpServers locations described
// above and classify every entry found. Returns
//   { locations: [{ path, scope, entries: [{ name, shape }] }] }.
// Tolerates every location being absent/unparseable. Never throws.
// opts (all optional, test seam): { home, projectDir, globalConfigPath,
// repoMcpPath }.
// ---------------------------------------------------------------------------
function scanMcpConfigs(opts) {
  const o = opts || {};
  const home = o.home || os.homedir();
  const projectDir = o.projectDir || process.cwd();
  const globalConfigPath = o.globalConfigPath || path.join(home, '.claude.json');
  const repoMcpPath = o.repoMcpPath || path.join(REPO_ROOT, '.mcp.json');

  const locations = [];

  const globalParsed = readJsonConfig(globalConfigPath);
  if (globalParsed && typeof globalParsed === 'object') {
    if (globalParsed.mcpServers && typeof globalParsed.mcpServers === 'object') {
      const servers = globalParsed.mcpServers;
      locations.push({
        path: globalConfigPath,
        scope: 'user (top-level mcpServers)',
        entries: Object.keys(servers).map((name) => ({
          name,
          shape: classifyEntry(servers[name]),
        })),
      });
    }
    if (
      globalParsed.projects &&
      typeof globalParsed.projects === 'object' &&
      globalParsed.projects[projectDir] &&
      globalParsed.projects[projectDir].mcpServers &&
      typeof globalParsed.projects[projectDir].mcpServers === 'object'
    ) {
      const projServers = globalParsed.projects[projectDir].mcpServers;
      locations.push({
        path: globalConfigPath + ' (projects["' + projectDir + '"].mcpServers)',
        scope: 'local (project-scoped mcpServers)',
        entries: Object.keys(projServers).map((name) => ({
          name,
          shape: classifyEntry(projServers[name]),
        })),
      });
    }
  }

  const repoParsed = readJsonConfig(repoMcpPath);
  if (repoParsed && typeof repoParsed === 'object' && repoParsed.mcpServers && typeof repoParsed.mcpServers === 'object') {
    const servers = repoParsed.mcpServers;
    locations.push({
      path: repoMcpPath,
      scope: 'project (repo .mcp.json)',
      entries: Object.keys(servers).map((name) => ({
        name,
        shape: classifyEntry(servers[name]),
      })),
    });
  }

  return { locations };
}

// ---------------------------------------------------------------------------
// evaluateExposure(scanResult) -- reduce a scan to the THEO-04 verdict:
// whether at least one theo-shaped entry AND at least one guarded-shim-shaped
// entry are BOTH registered somewhere across the scanned locations (a real
// session loads global + project scopes together, so the exposure is a
// union across locations, not a per-location check). Returns
//   { exposed, theoLocations: [path...], shimLocations: [path...] }.
// ---------------------------------------------------------------------------
function evaluateExposure(scanResult) {
  const theoLocations = [];
  const shimLocations = [];
  const result = scanResult && Array.isArray(scanResult.locations) ? scanResult.locations : [];
  for (const loc of result) {
    let hasTheo = false;
    let hasShim = false;
    for (const e of loc.entries || []) {
      if (e.shape === 'theo-shaped') hasTheo = true;
      if (e.shape === 'guarded-shim-shaped') hasShim = true;
    }
    if (hasTheo) theoLocations.push(loc.path);
    if (hasShim) shimLocations.push(loc.path);
  }
  return {
    exposed: theoLocations.length > 0 && shimLocations.length > 0,
    theoLocations,
    shimLocations,
  };
}

// ---------------------------------------------------------------------------
// main() -- always runs the check (there is no separate mode: this script
// has exactly one behavior). Prints to stdout, exits 0 unconditionally.
// ---------------------------------------------------------------------------
function main() {
  let verdict;
  try {
    const scanResult = scanMcpConfigs();
    verdict = evaluateExposure(scanResult);
  } catch (_e) {
    // Never throw. Advisory-only: treat any unexpected failure as
    // "no exposure found" and say so plainly.
    console.log(
      'check-theo-mcp-exposure: WARN scan failed unexpectedly; treating as no exposure found (advisory, non-blocking)'
    );
    process.exit(0);
    return;
  }

  if (verdict.exposed) {
    console.log(
      'WARN: theo-mcp-exposure advisory (THEO-04): both a guarded mindrian-brain-shaped entry ' +
        'and a raw theo-shaped entry are registered for this session scope.'
    );
    console.log('  theo-shaped entry found in: ' + verdict.theoLocations.join(', '));
    console.log('  guarded-shim-shaped entry found in: ' + verdict.shimLocations.join(', '));
    console.log(
      '  Any Brain-adjacent question carrying plugin-user or venture-room content MUST go ' +
        "through the guarded mindrian-brain shim, never mcp__theo__* directly -- see CLAUDE.md's " +
        'Theo grounding-source bullet ("Consult ALL Relevant Grounding Sources During Dev Work").'
    );
    console.log('  This is advisory only (THEO-04, navigator-ruled 2026-09-23) -- never blocking.');
  } else {
    console.log('check-theo-mcp-exposure: OK (no exposure found -- THEO-04 not currently live for this session)');
  }

  // Advisory, always. No --strict escalation exists for this check.
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = {
  readJsonConfig,
  classifyEntry,
  scanMcpConfigs,
  evaluateExposure,
};
