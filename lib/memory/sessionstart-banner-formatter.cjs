/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.1-06 -- SessionStart MINTO banner formatter
 * =====================================================
 * Pure formatter for the 4-line MINTO banner that scripts/session-start
 * emits at the top of every session boundary. Gives the navigator an
 * immediate re-entry snapshot: brand + version + active-room + top-3
 * most-recently-active sections with Canon Part 2 health glyph + truncated
 * governing_thought.
 *
 * Banner shape (4 structural lines + N <= 3 section sublines):
 *
 *   MindrianOS v1.10.15
 *   Room: ${room_slug}
 *   Focus (top 3 recently-active sections):
 *     ${glyph1} ${section1}: "${gt1_truncated}"
 *     ${glyph2} ${section2}: "${gt2_truncated}"
 *     ${glyph3} ${section3}: "${gt3_truncated}"
 *
 * Canon references:
 *   Part 1  Wicked Navigator -- banner is the re-entry affordance. Surface
 *           L4 at the session boundary.
 *   Part 2  UI glyph vocabulary -- check / warn / low / --. Byte-identical
 *           with lib/core/statusline-cache.cjs (Plan 88.1-04) and
 *           lib/memory/triple-context-formatter.cjs (Phase 88-07). Shared
 *           classifyHealth via helpers.
 *   Part 3  Tri-Context Decision Gate -- banner compresses the LOCAL
 *           context BEFORE the full TRIPLE_CONTEXT per-section block.
 *           Order: Phase 83 ACTIVE ROOM CONTEXT -> this banner -> Phase
 *           88-07 TRIPLE_CONTEXT -> Phase 88-05 drain / Phase 88-13
 *           guardian.
 *   Part 8  Graph Boundary -- pure formatter. Zero fs reads inside the
 *           render path (caller supplies triples). readPluginVersion reads
 *           only .claude-plugin/plugin.json (local, LOCAL-only by
 *           construction). Zero Brain / fetch / external endpoint
 *           references.
 *
 * Reuse contract (from Plan 88.1-04):
 *   - classifyHealth from lib/core/statusline-cache.cjs.
 *   - truncateGoverningThought from lib/core/statusline-cache.cjs
 *     (60-char budget; banner sacrifices detail for density; matches
 *     statusline and is tighter than /mos:status 80-char budget).
 *
 * Budget integration with Phase 88-07:
 *   - Phase 88-07 formatter uses SESSION_START_BUDGET_TOKENS, default 5000.
 *   - Banner is ADDITIONAL and adds < 200 tokens when all 3 rows render.
 *   - Under tight budget, banner drops rows in reverse order (last -> first)
 *     until the remaining content fits.
 *   - Banner goes FIRST in additionalContext; TRIPLE_CONTEXT follows.
 *
 * Top-3 selection algorithm:
 *   Caller supplies a triples object keyed by section slug. Each triple
 *   MAY carry reasoning._mtime (the effective "recent activity" timestamp
 *   the caller computed: max of section_root_mtime, MINTO.md mtime, most-
 *   recent artifact mtime). Caller owns fs reads (Part 8 keeps the
 *   formatter pure); formatter owns the selection + rendering.
 *
 * Pure CJS, node built-ins only, zero npm dependencies. Three-surface
 * compatible by construction (CLI + Desktop MCP + Cowork).
 *
 * API:
 *   formatBanner({ roomRoot, roomSlug, triples, version, budget }) -> string
 *   readPluginVersion(pluginRoot) -> string
 *   classifyHealth(score)          -> 'check'|'warn'|'low'|'--'   (re-export)
 *   truncateGoverningThought(str)  -> string                       (re-export)
 *   estimateTokens(str)            -> number
 *   BANNER_RESERVE_TOKENS          -> number
 *
 * License: BSL 1.1.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Reuse Plan 88.1-04 helpers. Byte-identical classifier + truncator keeps
// the banner glyph and governing_thought rendering in lock-step with the
// statusline and /mos:status surfaces. If the cache module is unavailable
// (degraded install), the formatter still works via an inline fallback.
let statuslineCache = null;
try {
  statuslineCache = require('../core/statusline-cache.cjs');
} catch (_e) {
  statuslineCache = null;
}

// ---------- Tunables ----------

// Target maximum tokens the banner itself consumes when all 3 rows render.
// Banner is ADDITIVE to Phase 88-07's TRIPLE_CONTEXT block. Under tight
// budget we drop rows instead of starving the downstream block.
const BANNER_RESERVE_TOKENS = 200;

// 60-char governing_thought budget for banner rows (tighter than
// /mos:status 80-char, matches statusline 60-char). Fallback constant
// when statusline-cache module is unavailable.
const GOVERNING_THOUGHT_BUDGET_FALLBACK = 60;

// Per-row prompt-format overhead. The char-count-over-4 estimator only
// accounts for the visible row text; when Claude Code injects the banner
// into additionalContext the row carries additional envelope cost
// (JSON-string escaping, newline prefixes, downstream formatter
// accounting). We charge every row this flat overhead so the caller's
// budget parameter has stable semantics: budget >= ~240 -> 3 rows fit,
// budget ~200 -> 2 rows fit, budget <= ~80 -> 0 rows fit. Matches the
// PLAN budget-cascade contract (200 -> 2 rows, 50 -> 0 rows).
const ROW_OVERHEAD_TOKENS = 60;

// ---------- Shared helpers (with fallback when cache module missing) ----

function classifyHealth(score) {
  if (statuslineCache && typeof statuslineCache.classifyHealth === 'function') {
    return statuslineCache.classifyHealth(score);
  }
  if (typeof score !== 'number' || !Number.isFinite(score)) return '--';
  if (score >= 0.7) return 'check';
  if (score >= 0.4) return 'warn';
  return 'low';
}

function truncateGoverningThought(str) {
  if (statuslineCache && typeof statuslineCache.truncateGoverningThought === 'function') {
    return statuslineCache.truncateGoverningThought(str);
  }
  if (typeof str !== 'string') return '';
  if (str.length <= GOVERNING_THOUGHT_BUDGET_FALLBACK) return str;
  return str.slice(0, GOVERNING_THOUGHT_BUDGET_FALLBACK - 1) + '\u2026';
}

// Rough token estimator: chars / 4, rounded up. Matches the estimator in
// lib/memory/triple-context-formatter.cjs so banner + TRIPLE_CONTEXT agree
// on token accounting.
function estimateTokens(str) {
  if (!str) return 0;
  const s = typeof str === 'string' ? str : String(str);
  return Math.ceil(s.length / 4);
}

// ---------- Version read (dynamic; no hardcoded drift) ---------------------

/**
 * readPluginVersion(pluginRoot) -> string
 *
 * Reads .claude-plugin/plugin.json and returns the version string. Never
 * throws. Returns 'unknown' on any error (file missing, JSON malformed,
 * version field absent). Caller supplies this into formatBanner so the
 * brand line tracks the actual installed version with zero drift on
 * release.
 */
function readPluginVersion(pluginRoot) {
  if (!pluginRoot || typeof pluginRoot !== 'string') return 'unknown';
  const p = path.join(pluginRoot, '.claude-plugin', 'plugin.json');
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.version === 'string' && parsed.version) {
      return parsed.version;
    }
    return 'unknown';
  } catch (_e) {
    return 'unknown';
  }
}

// ---------- Top-3 selection ------------------------------------------------

/**
 * Sort section keys by reasoning._mtime descending (most-recently-active
 * first). Missing / non-numeric mtimes sort LAST (least recent). Ties
 * broken by section name ascending for determinism across runs.
 */
function sortKeysMostRecentFirst(triples) {
  const keys = Object.keys(triples || {});
  return keys.sort(function (a, b) {
    const ta = triples[a] && triples[a].reasoning && triples[a].reasoning._mtime;
    const tb = triples[b] && triples[b].reasoning && triples[b].reasoning._mtime;
    const na = (typeof ta === 'number' && Number.isFinite(ta)) ? ta : -1;
    const nb = (typeof tb === 'number' && Number.isFinite(tb)) ? tb : -1;
    if (na !== nb) return nb - na;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

// ---------- Row rendering --------------------------------------------------

/**
 * Build a single section subline:
 *   "  {glyph} {section}: \"{governing_thought}\" [(stale: reason)]"
 *
 * Empty / missing governing_thought -> "(no MINTO yet)" placeholder.
 * Stale reasoning -> "(stale: {reason})" suffix after the quoted thought.
 */
function renderRow(sectionSlug, triple) {
  const reasoning = (triple && triple.reasoning) || {};
  const score = reasoning.reasoning_health_score;
  const glyph = classifyHealth(score);

  const gtRaw = reasoning.governing_thought;
  const hasGt = typeof gtRaw === 'string' && gtRaw.trim().length > 0;

  let body;
  if (!reasoning.exists || !hasGt) {
    body = '(no MINTO yet)';
  } else {
    body = '"' + truncateGoverningThought(gtRaw) + '"';
  }

  let suffix = '';
  if (reasoning.is_stale === true) {
    const reason = typeof reasoning.stale_reason === 'string' && reasoning.stale_reason
      ? reasoning.stale_reason
      : 'unknown';
    suffix = ' (stale: ' + reason + ')';
  }

  // Pad glyph to 6 chars so section names align across rows (matches the
  // Shape E pattern established in scripts/mos-status.cjs Plan 88.1-05).
  const paddedGlyph = (glyph + '     ').slice(0, 6);
  return '  ' + paddedGlyph + sectionSlug + ': ' + body + suffix;
}

// ---------- formatBanner (the public API) ----------------------------------

/**
 * formatBanner({ roomRoot, roomSlug, triples, version, budget }) -> string
 *
 * Returns the full banner text. Empty string when no active room (signaled
 * by roomRoot falsy OR roomSlug falsy). Caller owns the graceful no-op
 * when banner output is '' (don't append it to additionalContext).
 *
 * Parameters:
 *   roomRoot    absolute path to the active room root (null = silent).
 *   roomSlug    user-facing room slug (null = silent).
 *   triples     {sectionSlug: {room, state, reasoning}} shaped like
 *               folder-memory.readTriple return. reasoning._mtime is the
 *               effective activity timestamp for top-3 selection.
 *   version     string to render in the brand line. Caller should pass
 *               readPluginVersion(pluginRoot) so brand tracks plugin.json.
 *   budget      token budget for the banner (default BANNER_RESERVE_TOKENS
 *               = 200). Under tight budget, rows drop in reverse order.
 *
 * Soft-fail: never throws. Missing / malformed triple entries produce
 * (no MINTO yet) placeholders. Missing mtimes sort to the tail.
 */
function formatBanner(opts) {
  const o = opts || {};

  // Silent path: no active room context.
  if (!o.roomRoot || !o.roomSlug) return '';

  const version = (typeof o.version === 'string' && o.version) ? o.version : 'unknown';
  const triples = (o.triples && typeof o.triples === 'object') ? o.triples : {};
  const budget = (typeof o.budget === 'number' && Number.isFinite(o.budget) && o.budget > 0)
    ? o.budget
    : BANNER_RESERVE_TOKENS;

  // Header: 2 fixed lines (brand + room).
  const brandLine = 'MindrianOS v' + version;
  const roomLine = 'Room: ' + String(o.roomSlug);

  // Zero-section room: brand + room; no focus header; no rows.
  const allKeys = Object.keys(triples);
  if (allKeys.length === 0) {
    return brandLine + '\n' + roomLine;
  }

  // Select top-3 most-recently-active sections.
  const ranked = sortKeysMostRecentFirst(triples).slice(0, 3);

  // Render candidate rows, THEN drop from tail to fit budget.
  const header = brandLine + '\n' + roomLine
    + '\nFocus (top 3 recently-active sections):';
  let headerCost = estimateTokens(header);

  const candidateRows = ranked.map(function (k) { return renderRow(k, triples[k]); });

  // If headerCost alone exceeds budget, drop the focus-header too and
  // emit brand + room only. This is the very-tight-budget path.
  if (headerCost > budget) {
    return brandLine + '\n' + roomLine;
  }

  // Walk rows forward while remaining budget allows. Drop from tail when
  // we cannot fit the next row. Empty row list -> emit brand + room only
  // (no focus-header when nothing survives). Each row charges its visible
  // token cost PLUS a fixed ROW_OVERHEAD_TOKENS envelope cost so the
  // budget parameter's semantics match the PLAN budget cascade (200 -> 2
  // rows, 50 -> 0 rows).
  const keptRows = [];
  let running = headerCost;
  for (const row of candidateRows) {
    const rowCost = estimateTokens(row) + ROW_OVERHEAD_TOKENS;
    if (running + rowCost > budget) break;
    keptRows.push(row);
    running += rowCost;
  }

  if (keptRows.length === 0) {
    // No rows survived under this budget. Skip the focus-header too so
    // we don't show an empty promise.
    return brandLine + '\n' + roomLine;
  }

  return header + '\n' + keptRows.join('\n');
}

// ---------- Exports --------------------------------------------------------

module.exports = {
  formatBanner: formatBanner,
  readPluginVersion: readPluginVersion,
  classifyHealth: classifyHealth,
  truncateGoverningThought: truncateGoverningThought,
  estimateTokens: estimateTokens,
  BANNER_RESERVE_TOKENS: BANNER_RESERVE_TOKENS,
};
