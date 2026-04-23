#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.1-05 -- /mos:status Shape E renderer
 * ==============================================
 * Renders the active room's per-section MINTO governing_thought as a
 * Canon Part 2 Shape E (Action Report) block. One row per section with
 * a health glyph (check / warn / low / --) and a 1-line governing_thought
 * or an (no MINTO yet) / (stale: reason) placeholder. A summary row at
 * the bottom counts filled / stale sections and the median reasoning
 * health. A two-line actions footer closes the render.
 *
 * This is the /mos:status command's stdout. commands/status.md invokes
 * `node scripts/mos-status.cjs $ARGUMENTS` and forwards the output
 * verbatim to the user.
 *
 * Canon references:
 *   Part 2  UI Ruling System Shape E zones (header / rows / summary /
 *     actions) + glyph vocabulary (check / warn / low / --). Byte-
 *     identical classifier with lib/core/statusline-cache.cjs and
 *     lib/memory/triple-context-formatter.cjs.
 *   Part 3  Tri-Context Decision Gate -- /mos:status renders LOCAL state
 *     only, the first of the three contexts. Zero BRAIN calls. Zero
 *     SIGNAL sweeps. Pure per-turn user-triggered local read.
 *   Part 8  Graph Boundary -- every triple read goes through
 *     lib/core/folder-memory.cjs readTriple; every cache hit goes through
 *     lib/core/statusline-cache.cjs getCached. Zero network egress. Zero
 *     Brain endpoint references. LOCAL-only by construction.
 *
 * Composes with:
 *   Phase 88-01  folder-memory.readTriple read contract (the only way
 *     this renderer loads triples).
 *   Phase 88.1-04  statusline-cache.getCached / setCached 5s TTL cache
 *     + classifyHealth + truncateGoverningThought helpers. A /mos:status
 *     invocation that fires within 5s of a statusline tick reuses the
 *     cached triple instead of paying for a second readTriple. A cold
 *     /mos:status reads all triples and warms the cache for the next
 *     statusline tick.
 *
 * Arguments (parsed from process.argv):
 *   (no args)         render every section in the active room.
 *   --stale-only      render only sections flagged is_stale.
 *   <section>         render only that section's full triple (no 80-char
 *                     truncation on governing_thought).
 *
 * Pure CJS, node built-ins only, zero npm dependencies. Three-surface
 * compatible by construction (CLI + Desktop MCP + Cowork).
 *
 * License: BSL 1.1.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

// ---------- Tunables ----------

// 80-char budget for /mos:status rows. Wider than the 60-char statusline
// budget (Plan 88.1-04) because /mos:status is a user-triggered explicit
// command; users asked for the status, so more detail is welcome.
const ROW_THOUGHT_BUDGET = 80;

// ---------- Lazy-required helpers. Graceful fallback on module errors. ----

let statuslineCache = null;
let folderMemory = null;
try {
  statuslineCache = require(path.join(__dirname, '..', 'lib', 'core',
    'statusline-cache.cjs'));
} catch (_e) { /* graceful fallback; cache becomes a no-op */ }
try {
  folderMemory = require(path.join(__dirname, '..', 'lib', 'core',
    'folder-memory.cjs'));
} catch (_e) { /* graceful fallback; readTriple becomes the noop path */ }

// ---------- Argument parsing ----------

function parseArgs(argv) {
  const out = { staleOnly: false, section: null };
  // argv[0] is node, argv[1] is this script; user args start at argv[2].
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a) continue;
    if (a === '--stale-only') { out.staleOnly = true; continue; }
    if (a.indexOf('--') === 0) continue; // ignore unknown flags
    if (out.section === null) { out.section = a; }
  }
  return out;
}

// ---------- Room + section resolution ----------

/**
 * resolveRoomRoot(cwd)
 *
 * Walk from cwd up 6 levels looking for:
 *   1. A directory containing ROOM.md at the top level and at least one
 *      subdirectory with its own ROOM.md (the room layout).
 *   2. A `.room-root` sentinel file.
 *
 * Returns absolute path to the room root or null if none is found. Never
 * throws. Never queries outside the filesystem.
 */
function resolveRoomRoot(cwd) {
  if (!cwd) return null;

  // Pass 1: walk UP from cwd looking for an EXPLICIT room marker.
  // Explicit markers: .room-root sentinel OR ROOM.md with at least one
  // subdir that also carries ROOM.md (the canonical 2-level room layout).
  // This pass is strict because walking up a filesystem without strictness
  // would otherwise falsely resolve to /tmp or / on CI boxes that have
  // left-over test fixture directories.
  let dir = cwd;
  for (let hop = 0; hop < 6; hop++) {
    try {
      if (fs.existsSync(path.join(dir, '.room-root'))) {
        return dir;
      }
      if (fs.existsSync(path.join(dir, 'ROOM.md'))) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          if (!e.isDirectory()) continue;
          if (e.name.indexOf('.') === 0) continue;
          if (fs.existsSync(path.join(dir, e.name, 'ROOM.md'))) {
            return dir;
          }
        }
      }
      // room/ subdir at any hop that itself looks like a room.
      const nested = path.join(dir, 'room');
      if (fs.existsSync(nested)) {
        try {
          const nentries = fs.readdirSync(nested, { withFileTypes: true });
          for (const e of nentries) {
            if (!e.isDirectory()) continue;
            if (e.name.indexOf('.') === 0) continue;
            if (fs.existsSync(path.join(nested, e.name, 'ROOM.md'))) {
              return nested;
            }
          }
        } catch (_e) { /* ignore */ }
      }
    } catch (_e) { /* ignore this hop */ }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // Pass 2: fixture-friendly fallback. ONLY checks the starting cwd (not
  // parents). The cwd IS a room if it contains at least ONE subdir with
  // ROOM.md. This tolerates the test-fixture layout where each section
  // has its own ROOM.md but the outer tmp dir does not.
  try {
    const subs = fs.readdirSync(cwd, { withFileTypes: true });
    for (const e of subs) {
      if (!e.isDirectory()) continue;
      if (e.name.indexOf('.') === 0) continue;
      const sp = path.join(cwd, e.name);
      if (fs.existsSync(path.join(sp, 'ROOM.md'))) {
        return cwd;
      }
    }
  } catch (_e) { /* ignore */ }

  return null;
}

/**
 * enumerateSections(roomRoot)
 *
 * List direct subdirectories of roomRoot that look like sections: they
 * carry at least one of ROOM.md / STATE.md / MINTO.md. Skips hidden dirs
 * (leading dot) and system dirs (team/, meetings/, exports/, assets/ are
 * allowed -- they are canonical room sections per PROJECT.md).
 *
 * Returns Array<{name, absPath}> sorted by name.
 */
function enumerateSections(roomRoot) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(roomRoot, { withFileTypes: true });
  } catch (_e) {
    return out;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name.indexOf('.') === 0) continue;
    const abs = path.join(roomRoot, e.name);
    const hasMarker =
      fs.existsSync(path.join(abs, 'ROOM.md')) ||
      fs.existsSync(path.join(abs, 'STATE.md')) ||
      fs.existsSync(path.join(abs, 'MINTO.md'));
    if (!hasMarker) continue;
    out.push({ name: e.name, absPath: abs });
  }
  out.sort(function (a, b) {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  });
  return out;
}

// ---------- Triple loading (cache-first) ----------

/**
 * loadTriple(roomRoot, sectionAbs)
 *
 * Cache-first read. If the 5s TTL cache (Plan 88.1-04) has fresh data for
 * the (roomRoot, sectionAbs) pair, return it. Else fall back to
 * folder-memory.readTriple and warm the cache for the next statusline tick.
 *
 * Never throws. Returns a default empty-shell triple on any failure so the
 * caller can still render a placeholder row.
 */
function loadTriple(roomRoot, sectionAbs) {
  if (statuslineCache && typeof statuslineCache.getCached === 'function') {
    try {
      const hit = statuslineCache.getCached(roomRoot, sectionAbs);
      if (hit && hit.fresh && hit.value) {
        return hit.value;
      }
    } catch (_e) { /* fall through to readTriple */ }
  }
  let triple = null;
  if (folderMemory && typeof folderMemory.readTriple === 'function') {
    try {
      triple = folderMemory.readTriple(sectionAbs);
    } catch (_e) {
      triple = null;
    }
  }
  if (!triple) {
    // Defensive empty shell. Never null-return so the row renderer can
    // always produce output.
    triple = {
      room: { exists: false, identity_text: '', references: [] },
      state: {
        exists: false, artifact_count: 0, gap_status: 'unknown',
        completeness_score: 0, minto_health: '--', last_activity_at: null,
      },
      reasoning: {
        exists: false,
        governing_thought: null,
        arguments_count: 0,
        evidence_density: 0,
        mece_status: 'fail',
        reasoning_health_score: 0,
        flagged_weaknesses: [],
        decision_log: [],
        last_generated_at: null,
        last_artifact_write_seen_at: null,
        is_stale: true,
        stale_reason: 'never_generated',
      },
    };
  }
  // Warm the cache. Fire-and-forget; Plan 88.1-04 setCached is graceful.
  if (statuslineCache && typeof statuslineCache.setCached === 'function') {
    try { statuslineCache.setCached(roomRoot, sectionAbs, triple); } catch (_e) {}
  }
  return triple;
}

// ---------- Row + summary formatters ----------

/**
 * truncateThought(str, budget)
 *
 * 80-char row budget for /mos:status. Byte-identical algorithm to
 * lib/core/statusline-cache.cjs truncateGoverningThought (59 chars +
 * ellipsis = 60 chars) but with a larger budget here (80 chars: 79 +
 * ellipsis).
 */
function truncateThought(str, budget) {
  const cap = typeof budget === 'number' && budget > 0 ? budget : ROW_THOUGHT_BUDGET;
  if (typeof str !== 'string') return '';
  if (str.length <= cap) return str;
  return str.slice(0, cap - 1) + '\u2026';
}

function classifyGlyph(score) {
  if (statuslineCache && typeof statuslineCache.classifyHealth === 'function') {
    return statuslineCache.classifyHealth(score);
  }
  // Inline mirror for the graceful-fallback path when statusline-cache
  // cannot load. Canon Part 2 thresholds.
  if (typeof score !== 'number' || !Number.isFinite(score)) return '--';
  if (score >= 0.7) return 'check';
  if (score >= 0.4) return 'warn';
  return 'low';
}

/**
 * formatRow(section, triple, opts)
 *
 * Build a single Shape E row. Returns a plain string without trailing
 * newline.
 *
 * Row shapes:
 *   check  market-analysis: "TAM of $12B is bottom-up defensible"
 *   warn   problem-definition: "IT integration is the wedge"
 *   low    team: "TEAM claim weak"
 *   --     business-model: (stale: artifacts_newer_than_minto)
 *   --     competitive: (no MINTO yet)
 */
function formatRow(section, triple, opts) {
  const o = opts || {};
  const reasoning = (triple && triple.reasoning) || {};
  const exists = reasoning.exists === true;
  const isStale = reasoning.is_stale === true;
  const gt = reasoning.governing_thought;

  // Empty section: no MINTO.md at all.
  if (!exists || gt === null || gt === undefined || typeof gt !== 'string' || gt.length === 0) {
    if (!exists) {
      return '--    ' + section + ': (no MINTO yet)';
    }
    // reasoning.exists=true but gt null. Treat as "not yet generated".
    if (isStale) {
      return '--    ' + section + ': (stale: ' +
        (reasoning.stale_reason || 'unknown') + ')';
    }
    return '--    ' + section + ': (no governing thought)';
  }

  const score = typeof reasoning.reasoning_health_score === 'number'
    ? reasoning.reasoning_health_score
    : null;
  const glyph = classifyGlyph(score);
  // Normalize the label column to 6 chars so glyphs align regardless of
  // length (check=5, warn=4, low=3, --=2).
  const glyphPad = {
    check: 'check ',
    warn:  'warn  ',
    low:   'low   ',
    '--':  '--    ',
  }[glyph] || (glyph + '  ');

  const maybeTruncated = o.full
    ? String(gt)
    : truncateThought(String(gt), ROW_THOUGHT_BUDGET);

  let row = glyphPad + section + ': "' + maybeTruncated + '"';
  if (isStale) {
    row += ' (stale: ' + (reasoning.stale_reason || 'unknown') + ')';
  }
  return row;
}

function formatSummary(rows) {
  let filled = 0;
  let stale = 0;
  const scores = [];
  for (const r of rows) {
    const reasoning = (r.triple && r.triple.reasoning) || {};
    if (reasoning.exists === true && reasoning.governing_thought) {
      filled += 1;
    }
    if (reasoning.is_stale === true && reasoning.exists === true) {
      stale += 1;
    }
    if (typeof reasoning.reasoning_health_score === 'number'
        && Number.isFinite(reasoning.reasoning_health_score)
        && reasoning.exists === true) {
      scores.push(reasoning.reasoning_health_score);
    }
  }
  let median = 'n/a';
  if (scores.length > 0) {
    const sorted = scores.slice().sort(function (a, b) { return a - b; });
    const mid = Math.floor(sorted.length / 2);
    const m = sorted.length % 2 === 1
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
    median = m.toFixed(2);
  }
  return rows.length + ' section' + (rows.length === 1 ? '' : 's') +
    ', ' + filled + ' filled' +
    ', ' + stale + ' stale' +
    ', median reasoning health ' + median;
}

function formatActions() {
  return [
    'Next: /mos:reason <section> to regenerate stale MINTOs',
    'Or:   talk to Larry about a specific section',
  ];
}

// ---------- Section-detail render (for <section> argument) ----------

function formatSectionDetail(section, triple) {
  const room = (triple && triple.room) || {};
  const state = (triple && triple.state) || {};
  const reasoning = (triple && triple.reasoning) || {};
  const lines = [];

  const gt = reasoning.governing_thought;
  const glyph = classifyGlyph(
    typeof reasoning.reasoning_health_score === 'number'
      ? reasoning.reasoning_health_score
      : null
  );

  lines.push('### ' + section);
  lines.push('');
  if (reasoning.exists && typeof gt === 'string' && gt.length > 0) {
    // Full detail: NO truncation. Canon Part 5: evidence at a glance.
    lines.push('Governing thought: "' + gt + '"');
  } else {
    lines.push('Governing thought: (not yet generated)');
  }
  lines.push('Reasoning health: ' + glyph +
    (typeof reasoning.reasoning_health_score === 'number'
      ? ' (' + reasoning.reasoning_health_score.toFixed(2) + ')'
      : ''));
  lines.push('Arguments: ' + (reasoning.arguments_count || 0) +
    ', MECE: ' + (reasoning.mece_status || 'fail'));
  if (reasoning.is_stale) {
    lines.push('Stale: ' + (reasoning.stale_reason || 'unknown'));
  }
  if (state && state.exists) {
    lines.push('Artifacts: ' + (state.artifact_count || 0) +
      ', completeness: ' +
      (typeof state.completeness_score === 'number'
        ? Math.round(state.completeness_score * 100) + '%'
        : 'n/a'));
  }
  if (room && room.exists && room.identity_text) {
    const identity = String(room.identity_text)
      .split('\n')[0].replace(/^#+\s*/, '').slice(0, 160);
    lines.push('Identity: ' + identity);
  }
  return lines.join('\n');
}

// ---------- Main render ----------

/**
 * renderStatus(opts)
 *
 * opts.cwd            -- starting directory (default process.cwd())
 * opts.staleOnly      -- bool
 * opts.section        -- section name or null
 *
 * Returns the full stdout string (no trailing newline).
 */
function renderStatus(opts) {
  const o = opts || {};
  const cwd = o.cwd || process.cwd();
  const roomRoot = resolveRoomRoot(cwd);

  if (!roomRoot) {
    return 'no active room; /mos:rooms to list available rooms';
  }

  const sections = enumerateSections(roomRoot);
  if (sections.length === 0) {
    return 'no active room; /mos:rooms to list available rooms';
  }

  const roomSlug = path.basename(roomRoot);

  // Single-section argument: render full detail for that section only.
  if (o.section) {
    const match = sections.filter(function (s) { return s.name === o.section; });
    if (match.length === 0) {
      return '/mos:status -- room: ' + roomSlug + '\n\n' +
        'section "' + o.section + '" not found in this room\n\n' +
        'Next: /mos:status (no args) to list all sections';
    }
    const t = loadTriple(roomRoot, match[0].absPath);
    const header = '/mos:status -- room: ' + roomSlug +
      ' -- section: ' + match[0].name;
    const detail = formatSectionDetail(match[0].name, t);
    const actions = formatActions();
    return [header, '', detail, '', actions.join('\n')].join('\n');
  }

  // Full render path.
  const rows = [];
  for (const s of sections) {
    const triple = loadTriple(roomRoot, s.absPath);
    rows.push({ section: s.name, triple: triple });
  }

  let filtered = rows;
  if (o.staleOnly) {
    filtered = rows.filter(function (r) {
      const reasoning = (r.triple && r.triple.reasoning) || {};
      // Only sections that exist AND are stale (never_generated is also
      // technically stale but we keep --stale-only focused on sections
      // whose MINTO did ship but has gone stale).
      return reasoning.exists === true && reasoning.is_stale === true;
    });
  }

  const header = '/mos:status -- room: ' + roomSlug;
  const renderedRows = filtered.map(function (r) {
    return formatRow(r.section, r.triple, {});
  });
  // Summary always reflects ALL rows, not just the filtered ones, so the
  // user sees the full room picture even with --stale-only.
  const summary = formatSummary(rows);
  const actions = formatActions();

  const pieces = [header, ''];
  if (renderedRows.length === 0 && o.staleOnly) {
    pieces.push('(no stale sections)');
  } else {
    for (const row of renderedRows) pieces.push(row);
  }
  pieces.push('');
  pieces.push(summary);
  pieces.push('');
  for (const a of actions) pieces.push(a);

  return pieces.join('\n');
}

// ---------- Entry point ----------

function main() {
  const args = parseArgs(process.argv);
  try {
    const out = renderStatus({
      cwd: process.cwd(),
      staleOnly: args.staleOnly,
      section: args.section,
    });
    process.stdout.write(out + '\n');
    process.exit(0);
  } catch (e) {
    // Last-resort graceful fallback. Never crash /mos:status.
    process.stdout.write('no active room; /mos:rooms to list available rooms\n');
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  renderStatus: renderStatus,
  resolveRoomRoot: resolveRoomRoot,
  enumerateSections: enumerateSections,
  formatRow: formatRow,
  formatSummary: formatSummary,
  truncateThought: truncateThought,
};
