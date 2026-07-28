'use strict';

/**
 * Surface Detection for MindrianOS MCP Server
 *
 * Auto-detects CLI/Desktop/Cowork at server startup.
 * Called once before McpServer creation to determine transport
 * and capability set.
 *
 * Detection order (highest priority first):
 *   1. MINDRIAN_TRANSPORT env (explicit override)
 *   2. CLAUDE_SURFACE env (Anthropic-set)
 *   3. COWORK_SESSION_ID env or /sessions dir (Cowork VM)
 *   4. Non-TTY stdin with minimal argv (Desktop child process)
 *   5. TTY stdin (interactive CLI)
 *   6. Default: stdio (Desktop safe default)
 */

const fs = require('fs');

/** @type {Record<string, { hooks: boolean, apps: boolean, tasks: boolean, scripts: boolean }>} */
const CAPABILITY_MAP = {
  cli:     { hooks: true,  apps: false, tasks: false, scripts: true  },
  desktop: { hooks: false, apps: true,  tasks: false, scripts: false },
  cowork:  { hooks: false, apps: true,  tasks: true,  scripts: false },
};

/**
 * Detect the current surface (CLI, Desktop, Cowork) and return
 * transport type plus capability flags.
 *
 * @returns {{ surface: 'cli'|'desktop'|'cowork', transport: 'stdio'|'http', capabilities: { hooks: boolean, apps: boolean, tasks: boolean, scripts: boolean } }}
 */
function detectSurface() {
  // 1. Explicit override via env
  const explicitTransport = process.env.MINDRIAN_TRANSPORT;
  if (explicitTransport === 'http') {
    return { surface: 'cowork', transport: 'http', capabilities: CAPABILITY_MAP.cowork };
  }
  if (explicitTransport === 'stdio') {
    return { surface: 'desktop', transport: 'stdio', capabilities: CAPABILITY_MAP.desktop };
  }

  // 2. Anthropic-set surface env
  const claudeSurface = process.env.CLAUDE_SURFACE;
  if (claudeSurface === 'cowork') {
    return { surface: 'cowork', transport: 'http', capabilities: CAPABILITY_MAP.cowork };
  }
  if (claudeSurface === 'desktop') {
    return { surface: 'desktop', transport: 'stdio', capabilities: CAPABILITY_MAP.desktop };
  }
  if (claudeSurface === 'cli') {
    return { surface: 'cli', transport: 'stdio', capabilities: CAPABILITY_MAP.cli };
  }

  // 3. Cowork VM indicators
  if (process.env.COWORK_SESSION_ID || (fs.existsSync('/sessions'))) {
    return { surface: 'cowork', transport: 'http', capabilities: CAPABILITY_MAP.cowork };
  }

  // 4. Non-TTY stdin with minimal argv = Desktop spawned child process
  if (!process.stdin.isTTY && process.argv.length <= 2) {
    return { surface: 'desktop', transport: 'stdio', capabilities: CAPABILITY_MAP.desktop };
  }

  // 5. Interactive TTY = CLI
  if (process.stdin.isTTY) {
    return { surface: 'cli', transport: 'stdio', capabilities: CAPABILITY_MAP.cli };
  }

  // 6. Default: Desktop (stdio is the safe default)
  return { surface: 'desktop', transport: 'stdio', capabilities: CAPABILITY_MAP.desktop };
}

// ---------------------------------------------------------------------------
// Phase 234-05 (D-05, D-02, D-12) -- the SECOND capability axis: host tier.
//
// detectSurface() above answers "which Anthropic surface am I running on"
// (cli/desktop/cowork). It cannot answer "which MCP HOST is talking to me",
// and it never will, for a hard timing reason: detectSurface() is called ONCE
// at module load in bin/mindrian-mcp-server.cjs, before McpServer is even
// constructed, whereas the MCP SDK only populates Server.getClientVersion()
// AFTER the initialize handshake completes. Registration-time host detection
// is therefore structurally impossible, not merely inelegant.
//
// So the host axis lands as a SEPARATE, LAZY, PER-CALL function that takes the
// SDK's Implementation shape ({name, version} | undefined) as its ONLY input.
// detectHostTier reads no process.env, touches no fs, and runs nothing at
// module scope. It is safe to call on every tool invocation, including before
// initialize has completed (that case is exactly `undefined`).
//
// Canon Part 7 (reuse before build): this lives INSIDE the existing
// surface-detect chokepoint rather than in a new lib/mcp/host-detect.cjs.
// A second detector module beside this one is the exact "four guessers"
// failure mode resolve-active-room.cjs and resolve-brain-key.cjs were written
// to eliminate.
//
// D-12 GUARD: host-capability tier (tier0/tier1) and commercial tier
// (free/paid) are DIFFERENT AXES. Nothing here reads a plan, a key, or an
// entitlement. A tier0 host can have a paying user; a tier1 host can have a
// free one.
//
// TRUST NOTE (T-234-08, accepted): clientInfo.name is client-supplied and
// unauthenticated. It is a UX/routing signal that selects a DEFAULT
// convenience gate, never an authentication boundary. Every write it
// influences still routes through navigation.cjs's own validation and CAS
// guard.
// ---------------------------------------------------------------------------

/**
 * Known host identifiers, by capability tier (SEED-068's matrix, D-02).
 *
 *   tier1 -- hook-capable: Claude Code (84 hook entries), Grok Build (17
 *            native events), OpenCode (via its plugin). These hosts have a
 *            proactive channel of their own.
 *   tier0 -- MCP + skills only: everything else. Recognized tier0 names are
 *            listed so the capability floor can NAME the host honestly rather
 *            than shrugging "unknown" at a client it actually knows.
 *
 * Order matters: tier1 is matched first, so a name that could plausibly hit
 * both lists resolves to the more capable tier.
 *
 * @type {{ tier1: Array<{host: string, re: RegExp}>, tier0: Array<{host: string, re: RegExp}> }}
 */
const HOST_TIER_MAP = {
  tier1: [
    { host: 'claude-code', re: /claude.?code/i },
    { host: 'grok-build',  re: /grok/i },
    { host: 'opencode',    re: /opencode/i },
  ],
  tier0: [
    { host: 'cursor',   re: /cursor/i },
    { host: 'vscode',   re: /visual[ _-]?studio[ _-]?code|vs[ _-]?code|vscode|copilot/i },
    { host: 'goose',    re: /goose/i },
    { host: 'zed',      re: /(^|[^a-z])zed([^a-z]|$)/i },
    { host: 'cline',    re: /cline/i },
    { host: 'continue', re: /continue/i },
    { host: 'windsurf', re: /windsurf/i },
    { host: 'devin',    re: /devin/i },
  ],
};

/**
 * Resolve the MCP host tier from the client's self-reported identity.
 *
 * Pure and total: takes exactly one argument, reads no ambient state, and
 * never throws. Anything it cannot confidently place resolves to the
 * conservative floor `{ host: 'unknown', hostTier: 'tier0' }` -- including
 * `undefined` (the pre-initialize case) and any client name never seen before
 * (RESEARCH Assumption A4: clientInfo.name distinguishability across the ~45
 * known hosts is not guaranteed, so an unrecognized name is treated as an
 * unknown, not optimistically promoted).
 *
 * `host` and `hostTier` are reported SEPARATELY on purpose (D-05, "state both
 * axes honestly"): a recognized-but-tier0 host is distinguishable from a
 * genuinely-unknown one for logging and status purposes, even though both
 * land on the same tier.
 *
 * @param {{name?: string, version?: string}|undefined} clientVersion - the MCP
 *   SDK's Implementation shape, as returned by Server.getClientVersion().
 * @returns {{ host: string, hostTier: 'tier0'|'tier1' }}
 */
function detectHostTier(clientVersion) {
  const floor = { host: 'unknown', hostTier: 'tier0' };
  try {
    if (!clientVersion || typeof clientVersion !== 'object' || Array.isArray(clientVersion)) return floor;
    const name = clientVersion.name;
    if (typeof name !== 'string' || name.trim().length === 0) return floor;
    for (let i = 0; i < HOST_TIER_MAP.tier1.length; i += 1) {
      if (HOST_TIER_MAP.tier1[i].re.test(name)) {
        return { host: HOST_TIER_MAP.tier1[i].host, hostTier: 'tier1' };
      }
    }
    for (let j = 0; j < HOST_TIER_MAP.tier0.length; j += 1) {
      if (HOST_TIER_MAP.tier0[j].re.test(name)) {
        return { host: HOST_TIER_MAP.tier0[j].host, hostTier: 'tier0' };
      }
    }
    return floor;
  } catch (_e) {
    // Defense in depth: a detector failure must never invent a capability.
    return floor;
  }
}

module.exports = { detectSurface, CAPABILITY_MAP, detectHostTier, HOST_TIER_MAP };
