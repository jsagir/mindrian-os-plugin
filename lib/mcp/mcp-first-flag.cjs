'use strict';
// Phase 198-02 (SPEC-1/SPEC-7, D-07) -- the ONE MINDRIAN_MCP_FIRST flag reader.
//
// D-07: MINDRIAN_MCP_FIRST accepts a per-surface list ('cli', 'cli,desktop',
// 'all'). unset/empty = byte-identical legacy on EVERY surface. No other
// module in the tree reads process.env.MINDRIAN_MCP_FIRST directly -- every
// caller (bin/mindrian-mcp-server.cjs, lib/mcp/tool-router.cjs, and any future
// consumer) goes through isMcpFirst(surface) here so the cutover contract
// lives in exactly one place (mirrors the SEED-034 "four guessers" lesson
// resolve-active-room.cjs already fixed for room resolution).
//
// Canon Part 8: reads process.env only. Zero Brain/network token, zero fs
// access. No em-dashes. CJS only.

/**
 * Parse MINDRIAN_MCP_FIRST into its per-surface list. unset/empty -> [].
 * Whitespace around each entry is trimmed; empty entries (double commas,
 * leading/trailing commas) are dropped.
 *
 * @returns {string[]}
 */
function mcpFirstSurfaces() {
  const raw = process.env.MINDRIAN_MCP_FIRST;
  if (typeof raw !== 'string') return [];
  const trimmed = raw.trim();
  if (trimmed.length === 0) return [];
  return trimmed
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s.length > 0; });
}

/**
 * isMcpFirst(surface) -- true iff MINDRIAN_MCP_FIRST names this surface or
 * the literal 'all'. unset/empty ALWAYS returns false for every surface
 * (D-07 byte-identical-legacy default, SPEC-7). Never throws.
 *
 * @param {string} surface - e.g. 'cli', 'desktop', 'cowork'
 * @returns {boolean}
 */
function isMcpFirst(surface) {
  try {
    if (typeof surface !== 'string' || surface.length === 0) return false;
    const list = mcpFirstSurfaces();
    if (list.length === 0) return false;
    if (list.indexOf('all') !== -1) return true;
    return list.indexOf(surface) !== -1;
  } catch (_e) {
    // Defense-in-depth: a flag-reader failure must never flip a surface ON.
    return false;
  }
}

// ---------------------------------------------------------------------------
// Phase 234-05 (D-05, Gap D) -- the write-path gate.
//
// THE GAP THIS CLOSES. isMcpFirst() above defaults OFF, and the three
// write-path tools (graph_write, memory_event, artifact_file) were gated on it
// at REGISTRATION time. On Claude Code that is harmless: slash commands and
// hooks do the writing. On any foreign MCP host it meant the product could
// read the room graph and never record into it, and the model could not even
// SEE that a write tool existed to ask for. RESEARCH.md names this the phase's
// single biggest functional gap.
//
// THE FIX, IN ONE LINE: an explicit flag still wins, and when there is no
// explicit flag, a CONFIDENTLY-RECOGNIZED non-Claude-Code Tier-0 host gets the
// write path by default instead of silently getting nothing.
//
// isMcpFirst() itself is called here BYTE-UNCHANGED, so every existing call
// site (bin/mindrian-mcp-server.cjs, lib/mcp/tool-router.cjs,
// lib/mcp/stop-gate-handler.cjs, each tool module's resolveSessionRoomDir)
// keeps its exact current behavior. This function is purely additive.
//
// Requiring surface-detect.cjs here is a one-way edge (surface-detect requires
// nothing from this module, so no cycle). Its `fs` require is load-only; no fs
// access happens on this read path.
// ---------------------------------------------------------------------------

const { detectHostTier } = require('./surface-detect.cjs');

/**
 * isWritePathEnabled({surface, clientVersion}) -- may THIS call write?
 *
 * Precedence, highest first:
 *   1. An explicit MINDRIAN_MCP_FIRST naming this surface (or 'all') -> true.
 *      The hand-set flag ALWAYS wins over auto-detection, on every host. No
 *      regression for anyone already setting it.
 *   2. Otherwise, a confidently-recognized non-Claude-Code Tier-0 host -> true
 *      (the Gap D default flip: Cursor, VS Code/Copilot, Goose, Zed, Cline,
 *      Continue, Windsurf, Devin).
 *   3. Everything else -> false. That is Claude Code (its slash commands and
 *      hooks already do the writing, so its legacy default is preserved
 *      byte-for-byte), the other Tier-1 hosts (Grok Build, OpenCode: they have
 *      their own hook channel), and any UNKNOWN or pre-initialize client (an
 *      unidentified caller does not silently gain write access).
 *
 * Case 3 is NOT a silent skip. The tools it gates are now ALWAYS present in
 * tools/list, and each handler returns an informative
 * {ok:false, reason:'write_path_disabled', hint:...} a human or a model can
 * act on (T-234-09). Discovery and permission are separate concerns.
 *
 * Governance stays SERVER-SIDE (D-04): this is read inside the tool handler,
 * never delegated to a client hook.
 *
 * D-12: this is a HOST-CAPABILITY decision only. It reads no plan, no key, and
 * no entitlement.
 *
 * Never throws; a failure floors to false (a gate-reader failure must never
 * flip a capability ON).
 *
 * @param {{surface?: string, clientVersion?: {name?: string, version?: string}}} opts
 * @returns {boolean}
 */
function isWritePathEnabled(opts) {
  try {
    const o = (opts && typeof opts === 'object') ? opts : {};
    // 1. The explicit flag path, unchanged.
    if (isMcpFirst(o.surface)) return true;
    // 2. Host-tier auto-detection.
    const tier = detectHostTier(o.clientVersion);
    if (!tier || tier.host === 'unknown') return false;
    if (tier.host === 'claude-code') return false;
    return tier.hostTier === 'tier0';
  } catch (_e) {
    // Defense-in-depth: same doctrine as isMcpFirst above.
    return false;
  }
}

module.exports = { isMcpFirst, mcpFirstSurfaces, isWritePathEnabled };
