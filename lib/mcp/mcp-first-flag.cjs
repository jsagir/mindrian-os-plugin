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

module.exports = { isMcpFirst, mcpFirstSurfaces };
