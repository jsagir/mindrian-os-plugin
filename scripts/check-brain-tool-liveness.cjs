#!/usr/bin/env node
'use strict';

/**
 * check-brain-tool-liveness.cjs
 *
 * RELEASE GATE (Phase 239, requirement BRAIN-01, threat T-239-T1): proves,
 * from the LIVE MCP registration itself and never from a hand-typed list,
 * whether every Brain hook matcher in hooks/hooks.json and every Brain
 * allowed-tools entry in agents/*.md names a tool that ACTUALLY exists.
 *
 * WHY THIS EXISTS. The official Claude Code plugins reference states, of a
 * plugin-bundled MCP server's tool names: they take the shape
 * mcp__plugin_<plugin-name>_<server-name>__<tool>, and "a matcher written
 * against the bare server key never fires." Claude Code never validates a
 * hook matcher against a live tool registry at evaluation time, so a matcher
 * naming a server key that has drifted out from under it does not warn and
 * does not error; it silently stops firing, forever. That silent no-op is
 * exactly the dead seam this gate exists to catch, and it is the recurrence
 * shape threat T1 names: a future rename of the plugin or the server key
 * reopens the same hole with every surface still reading green.
 *
 * TWO CLAIM SOURCES, not one. A wildcard-suffix hook matcher
 * (mcp__(?:plugin_..._)?<server>__.*) is, by design, insensitive to a single
 * tool being renamed underneath it -- the matcher keeps matching every OTHER
 * live name, so it does not go red. That is correct behavior, not a gap: the
 * tool-rename sensitivity this gate also has to provide is carried by the
 * SECOND claim source, the exact Brain tool names an agent's allowed-tools
 * frontmatter names one-for-one. Both sources are asserted here so neither
 * failure mode (matcher drift, single-tool rename) goes unnoticed.
 *
 * THE ANTI-VACUITY RULE (the single top-priority rule in this file). This
 * gate reuses lib/core/seam-liveness.cjs's assertSeamLive, whose documented
 * contract is that a claim set of ZERO is VACUOUSLY live: a seam that claims
 * nothing cannot be dead. That contract is correct for assertSeamLive's own
 * generic purpose, but it is a trap for a wildcard matcher: today's dead
 * mcp__brain_.* matcher matches zero live names, and feeding that empty
 * result straight to checkHookMatcherLiveness would report the dead seam as
 * GREEN. This gate therefore computes each matcher's live claim set FIRST and
 * asserts it is non-empty BEFORE ever consulting the shared helper. Only the
 * exact-claim source (which is never empty by construction once an agent
 * declares Brain tools) is handed to checkHookMatcherLiveness directly.
 *
 * NEITHER the plugin name nor the server name nor the bare tool names are
 * hardcoded anywhere below (Phase 235 Decision (e): "a hardcoded literal rots
 * the day someone renames it, and the natural fix is to edit the gate rather
 * than trust it"). The plugin name is read from .claude-plugin/plugin.json at
 * run time; the server name is read from .mcp.json at run time by finding
 * the mcpServers entry whose args reference the Brain stdio shim; the bare
 * tool names come from a real stdio tools/list handshake against that shim.
 *
 * ENUMERATION, two tiers. Tier 1 spawns the Brain MCP stdio shim for real and
 * performs a genuine JSON-RPC initialize -> notifications/initialized ->
 * tools/list handshake. Tool registration happens at module load, before any
 * network call, so this is fully offline and hermetic; no Brain API key is
 * needed. Tier 2, used only if tier 1 fails or times out, scans the shim's
 * own source for the tool names it registers. A silent fallback would turn
 * this probe into exactly the source-census this gate exists to avoid being,
 * so tier 2 always prints a clearly labelled FALLBACK line naming the tier-1
 * failure. If both tiers yield zero names this script exits 2 (probe
 * failure), never 0.
 *
 * Exit codes:
 *   0 -- every hook matcher matches at least one live tool name AND every
 *        exact agent-declared Brain tool name is live
 *   1 -- a dead seam found (the offending matcher or agent entry is named)
 *   2 -- probe failure (both enumeration tiers yielded zero names, or the
 *        plugin/server name could not be resolved)
 */

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const { checkHookMatcherLiveness } = require('../lib/core/seam-liveness.cjs');

const ROOT = path.resolve(__dirname, '..');
const SHIM_PATH = path.join(ROOT, 'bin', 'mindrian-brain-mcp-client.cjs');
const HOOKS_JSON_PATH = path.join(ROOT, 'hooks', 'hooks.json');
const PLUGIN_JSON_PATH = path.join(ROOT, '.claude-plugin', 'plugin.json');
const MCP_JSON_PATH = path.join(ROOT, '.mcp.json');
const AGENTS_DIR = path.join(ROOT, 'agents');

// Assumption A4 (239-RESEARCH.md): the shim's dependency self-heal can add
// first-run latency, so the handshake gets a generous window before this
// gate falls back to the source-scan tier.
const HANDSHAKE_TIMEOUT_MS = 20000;

// ---------------------------------------------------------------------------
// Tier 2 fallback: scan the shim's own source for every `server.tool(` call
// followed by a quoted name. The name sits on the line AFTER `server.tool(`
// in this repo's shim, so the pattern spans a `\s` gap rather than matching
// per single line.
// ---------------------------------------------------------------------------
function fallbackSourceScan() {
  let src = '';
  try {
    src = fs.readFileSync(SHIM_PATH, 'utf8');
  } catch (_e) {
    return [];
  }
  const names = [];
  const re = /server\.tool\(\s*['"]([a-zA-Z0-9_]+)['"]/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    names.push(m[1]);
  }
  return names;
}

// ---------------------------------------------------------------------------
// enumerateLiveBrainTools() -- the real stdio handshake, with the labelled
// fallback tier. Returns { names: string[], tier: 'handshake'|'fallback',
// error: string|null }.
// ---------------------------------------------------------------------------
function runHandshake() {
  return new Promise((resolve) => {
    let settled = false;
    let stdoutBuf = '';
    let stderrBuf = '';

    const proc = cp.spawn('node', [SHIM_PATH], {
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });

    function finish(payload) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        proc.kill('SIGKILL');
      } catch (_e) {
        /* already gone */
      }
      resolve(payload);
    }

    const timer = setTimeout(() => {
      finish({ ok: false, reason: 'timeout', stderr: stderrBuf.slice(-800) });
    }, HANDSHAKE_TIMEOUT_MS);

    proc.stdout.on('data', (chunk) => {
      stdoutBuf += chunk.toString('utf8');
      let nl;
      while ((nl = stdoutBuf.indexOf('\n')) !== -1) {
        const line = stdoutBuf.slice(0, nl).trim();
        stdoutBuf = stdoutBuf.slice(nl + 1);
        if (!line) continue;
        let obj;
        try {
          obj = JSON.parse(line);
        } catch (_e) {
          continue; // non-JSON stdout noise (e.g. dependency self-heal chatter)
        }
        if (!obj) continue;
        if (obj.id === 1) {
          proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
          proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) + '\n');
          continue;
        }
        if (obj.id === 2) {
          if (obj.error) {
            finish({ ok: false, reason: 'tools_list_error', message: JSON.stringify(obj.error) });
          } else {
            const tools = obj.result && Array.isArray(obj.result.tools) ? obj.result.tools : [];
            const names = tools.map((t) => t && t.name).filter((n) => typeof n === 'string' && n.length > 0);
            finish({ ok: true, names: names });
          }
        }
      }
    });

    proc.stderr.on('data', (c) => {
      stderrBuf += c.toString('utf8');
    });

    proc.on('error', (err) => {
      finish({ ok: false, reason: 'spawn_error', message: err.message });
    });

    proc.on('exit', (code) => {
      finish({ ok: false, reason: 'exited_before_response', code: code, stderr: stderrBuf.slice(-800) });
    });

    proc.stdin.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'check-brain-tool-liveness', version: '1.0.0' },
        },
      }) + '\n'
    );
  });
}

async function enumerateLiveBrainTools() {
  const outcome = await runHandshake();
  if (outcome.ok && Array.isArray(outcome.names) && outcome.names.length > 0) {
    return { names: outcome.names, tier: 'handshake', error: null };
  }
  const detailParts = [outcome.reason];
  if (outcome.message) detailParts.push(outcome.message);
  if (outcome.stderr) detailParts.push('stderr: ' + outcome.stderr);
  const errorDetail = detailParts.filter(Boolean).join(' -- ');
  const fallbackNames = fallbackSourceScan();
  return { names: fallbackNames, tier: 'fallback', error: errorDetail };
}

// ---------------------------------------------------------------------------
// composeScopedNames(bareNames, pluginName, serverName) -- BOTH scopes, per
// 239-RESEARCH.md Pitfall 6 (Tri-Polar: Desktop/Cowork resolve plugin scope,
// a project-scoped dev checkout resolves the bare-server-key scope).
// ---------------------------------------------------------------------------
function composeScopedNames(bareNames, pluginName, serverName) {
  const names = Array.isArray(bareNames) ? bareNames : [];
  const out = [];
  for (const bare of names) {
    out.push('mcp__plugin_' + pluginName + '_' + serverName + '__' + bare);
    out.push('mcp__' + serverName + '__' + bare);
  }
  return out;
}

function resolvePluginName() {
  const raw = fs.readFileSync(PLUGIN_JSON_PATH, 'utf8');
  const meta = JSON.parse(raw);
  if (!meta || typeof meta.name !== 'string' || meta.name.length === 0) {
    throw new Error('could not resolve a plugin name from .claude-plugin/plugin.json');
  }
  return meta.name;
}

function resolveServerName() {
  const raw = fs.readFileSync(MCP_JSON_PATH, 'utf8');
  const doc = JSON.parse(raw);
  const servers = doc && typeof doc.mcpServers === 'object' ? doc.mcpServers : {};
  for (const key of Object.keys(servers)) {
    const entry = servers[key];
    const args = entry && Array.isArray(entry.args) ? entry.args : [];
    const referencesShim = args.some(
      (a) => typeof a === 'string' && a.indexOf('mindrian-brain-mcp-client.cjs') !== -1
    );
    if (referencesShim) return key;
  }
  throw new Error('could not resolve the Brain server key from .mcp.json (no mcpServers entry references the Brain stdio shim)');
}

// ---------------------------------------------------------------------------
// extractBrainHookMatchers() -- walk hooks/hooks.json in the gatherHookCommands
// shape (lib/core/security/agentshield-run.cjs), reading `.matcher` on the
// OUTER group rather than `.command` on the inner hook, for every group whose
// inner command mentions either Part-8 Brain hook script.
// ---------------------------------------------------------------------------
function extractBrainHookMatchers() {
  const raw = fs.readFileSync(HOOKS_JSON_PATH, 'utf8');
  const doc = JSON.parse(raw);
  const hooks = doc && typeof doc.hooks === 'object' ? doc.hooks : {};
  const out = [];
  for (const hookType of Object.keys(hooks)) {
    const groups = Array.isArray(hooks[hookType]) ? hooks[hookType] : [];
    for (const group of groups) {
      const inner = group && Array.isArray(group.hooks) ? group.hooks : [];
      const brainCommand = inner
        .map((h) => h && h.command)
        .find(
          (cmd) =>
            typeof cmd === 'string' &&
            (cmd.indexOf('part8-egress-guard-hook.cjs') !== -1 ||
              cmd.indexOf('brain-response-sanitize-hook.cjs') !== -1)
        );
      if (!brainCommand) continue;
      const matcher = group && group.matcher;
      if (typeof matcher !== 'string') continue;
      out.push({ hookType: hookType, matcher: matcher, command: brainCommand });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// extractAgentBrainToolClaims(serverName) -- read every agents/*.md, parse the
// YAML frontmatter allowed-tools list, and return every entry that starts
// with mcp__ AND references the Brain server: either the resolved live
// server name, or the superseded literal mcp__brain_ (so a stale entry is
// caught rather than silently skipped).
// ---------------------------------------------------------------------------
function extractAgentBrainToolClaims(serverName) {
  const out = [];
  let files = [];
  try {
    files = fs.readdirSync(AGENTS_DIR).filter((f) => f.endsWith('.md'));
  } catch (_e) {
    files = [];
  }
  for (const file of files) {
    const full = path.join(AGENTS_DIR, file);
    let raw = '';
    try {
      raw = fs.readFileSync(full, 'utf8');
    } catch (_e) {
      continue;
    }
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) continue;
    const frontmatter = fmMatch[1];
    const allowedMatch = frontmatter.match(/allowed-tools:\s*\n((?:[ \t]*-[ \t]*.+\n?)+)/);
    if (!allowedMatch) continue;
    const lines = allowedMatch[1].split('\n');
    for (const line of lines) {
      const entryMatch = line.match(/^[ \t]*-[ \t]*(\S+)/);
      if (!entryMatch) continue;
      const entry = entryMatch[1];
      if (entry.indexOf('mcp__') !== 0) continue;
      const referencesBrain = entry.indexOf(serverName) !== -1 || entry.indexOf('mcp__brain_') === 0;
      if (!referencesBrain) continue;
      out.push({ file: path.relative(ROOT, full).split(path.sep).join('/'), entry: entry });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// evaluateLiveness({ matchers, exactClaims, liveToolNames }) -- PURE, no I/O,
// so the test can drive every mutation without touching disk.
// ---------------------------------------------------------------------------
function evaluateLiveness(input) {
  const opts = input && typeof input === 'object' ? input : {};
  const matchers = Array.isArray(opts.matchers) ? opts.matchers : [];
  const exactClaims = Array.isArray(opts.exactClaims) ? opts.exactClaims : [];
  const liveToolNames = Array.isArray(opts.liveToolNames) ? opts.liveToolNames : [];

  const failures = [];
  const perMatcher = [];

  for (const matcher of matchers) {
    let matched = [];
    try {
      const re = new RegExp(matcher);
      matched = liveToolNames.filter((name) => re.test(name));
    } catch (_e) {
      matched = [];
    }
    perMatcher.push({ matcher: matcher, matched: matched });

    // THE ANTI-VACUITY CHECK. Assert non-empty BEFORE ever deferring to the
    // shared helper: checkHookMatcherLiveness's own contract is that a claim
    // set of zero is VACUOUSLY live, and that contract would report today's
    // dead matcher shape (zero live matches) as ok:true. A wildcard-suffix
    // matcher matching zero live names is a FAILURE here, full stop.
    if (matched.length === 0) {
      failures.push({
        type: 'matcher_zero_matches',
        matcher: matcher,
        reason: 'matcher matches zero live tool names (a vacuous claim set is a failure, not a pass)',
      });
    }
  }

  // The exact-claim source IS sensitive to a single tool rename, since these
  // are exact names rather than a wildcard. This is deferred to the shared,
  // frozen helper directly: an exact claim set built from a real agent
  // declaration is never empty by construction, so the vacuity trap above
  // does not apply here.
  const exactVerdict = checkHookMatcherLiveness(exactClaims, liveToolNames);
  if (!exactVerdict.ok) {
    for (const dead of exactVerdict.dead) {
      failures.push({
        type: 'exact_claim_dead',
        claim: dead,
        reason: 'agent-declared Brain tool name does not name a live tool',
      });
    }
  }

  return {
    ok: failures.length === 0,
    failures: failures,
    perMatcher: perMatcher,
    exact: exactVerdict,
  };
}

// ---------------------------------------------------------------------------
// main() -- runs all four extraction/enumeration steps, prints a
// human-readable report, and exits 0/1/2 per the contract above. Only runs
// when this file is invoked directly, so the test can drive the pure parts
// without spawning a child process.
//
// Honest scope note: with a wildcard-suffix matcher, renaming ONE live tool
// does NOT stale the matcher (every other live name still matches), and that
// is correct by design rather than a coverage gap. The rename sensitivity
// this gate also has to provide is carried entirely by the exact-name claim
// source above (agent allowed-tools), which is why both sources exist side
// by side rather than one subsuming the other.
// ---------------------------------------------------------------------------
async function main() {
  function log(s) {
    process.stdout.write(s + '\n');
  }

  log('check-brain-tool-liveness: Phase 239, requirement BRAIN-01, threat T-239-T1');
  log('Proves the Brain hook matchers and agent allowed-tools claims name real, live');
  log('tool names, enumerated from a real stdio registration handshake.');
  log('');

  let pluginName;
  let serverName;
  try {
    pluginName = resolvePluginName();
    serverName = resolveServerName();
  } catch (e) {
    log('FATAL: could not resolve the plugin/server name: ' + (e && e.message ? e.message : e));
    process.exitCode = 2;
    return;
  }

  const enumeration = await enumerateLiveBrainTools();
  if (enumeration.tier === 'fallback') {
    log('FALLBACK: the live handshake failed (' + enumeration.error + '); using the source-scan fallback tier.');
  }
  if (!enumeration.names || enumeration.names.length === 0) {
    log('FATAL: both the handshake tier and the fallback tier yielded zero Brain tool names.');
    process.exitCode = 2;
    return;
  }

  const bareNames = enumeration.names;
  log('Live bare tool names (' + enumeration.tier + ' tier, ' + bareNames.length + '): ' + bareNames.join(', '));

  const liveToolNames = composeScopedNames(bareNames, pluginName, serverName);
  log('Composed live scoped names (' + liveToolNames.length + '):');
  for (const n of liveToolNames) log('  ' + n);

  const hookMatchers = extractBrainHookMatchers();
  const matchers = hookMatchers.map((m) => m.matcher);
  log('');
  log('Hook matchers found in hooks/hooks.json (' + hookMatchers.length + '):');
  for (const hm of hookMatchers) log('  ' + hm.hookType + ': "' + hm.matcher + '" -> ' + hm.command);

  const agentClaims = extractAgentBrainToolClaims(serverName);
  const exactClaims = agentClaims.map((c) => c.entry);
  log('');
  log('Agent allowed-tools Brain claims found (' + agentClaims.length + '):');
  for (const ac of agentClaims) log('  ' + ac.file + ': ' + ac.entry);

  const verdict = evaluateLiveness({ matchers: matchers, exactClaims: exactClaims, liveToolNames: liveToolNames });

  log('');
  log('--- Per-matcher liveness ---');
  for (const pm of verdict.perMatcher) {
    const detail = pm.matched.length > 0 ? pm.matched.length + ' live match(es)' : 'ZERO matches -- VACUOUS, FAILURE';
    log('  "' + pm.matcher + '" -> ' + detail);
  }

  log('');
  log('--- Exact-claim liveness (checkHookMatcherLiveness) ---');
  log(
    '  ok: ' +
      verdict.exact.ok +
      ', claimedCount: ' +
      verdict.exact.claimedCount +
      ', liveCount: ' +
      verdict.exact.liveCount +
      ', dead: ' +
      JSON.stringify(verdict.exact.dead)
  );

  log('');
  if (verdict.ok) {
    log('RESULT: OK. Every hook matcher matches at least one live name, and every exact agent-declared Brain tool name is live.');
    process.exitCode = 0;
  } else {
    log('RESULT: DEAD SEAM FOUND.');
    for (const f of verdict.failures) {
      log('  - ' + f.type + ': ' + (f.matcher || f.claim) + ' -- ' + f.reason);
    }
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((e) => {
    process.stdout.write('FATAL: ' + (e && e.stack ? e.stack : e) + '\n');
    process.exit(2);
  });
}

module.exports = {
  enumerateLiveBrainTools,
  composeScopedNames,
  extractBrainHookMatchers,
  extractAgentBrainToolClaims,
  evaluateLiveness,
  resolvePluginName,
  resolveServerName,
};
