#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 124-03 -- /mos:feynman-timeline-refresh CLI dispatcher
 * ============================================================
 * Manual user command to force-refresh the `## Timeline (auto)` sentinel-bounded
 * block in each section's FEYNMAN.md. When the automatic session-start cascade
 * (Plan 124-03 cascade slot in scripts/session-start) is not enough -- the user
 * wants an explicit redraw -- this is the direct knob.
 *
 * Three invocation modes:
 *
 *   node scripts/feynman-timeline-refresh-command.cjs
 *   node scripts/feynman-timeline-refresh-command.cjs --all
 *     -- Refresh every section in the active room.
 *
 *   node scripts/feynman-timeline-refresh-command.cjs --section <slug>
 *     -- Refresh one section. Exit 1 on bad/missing slug.
 *
 * Output:
 *   F.0 Action Report (Canon Part 3 UI Ruling System; same shape as
 *   /mos:brain-derive's Shape E). Three summary rows + a PER SECTION breakdown +
 *   a NEXT action footer.
 *
 * Canon Part 8:
 *   This dispatcher adds ZERO net new Brain surface. It is a thin wrapper around
 *   lib/core/feynman/timeline-runner.cjs (Plan 124-02), which itself reads ONLY
 *   room.db via lib/core/navigation.cjs (D-03).
 *
 * Pure CJS, node built-ins only. Three-surface safe (CLI + Desktop MCP + Cowork).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const runner = require(path.join(REPO_ROOT, 'lib', 'core', 'feynman', 'timeline-runner.cjs'));

// ---------- argv parser ----------

function parseArgv(argv) {
  const out = { section: null, all: false, help: false };
  if (!Array.isArray(argv)) return out;
  const startIdx = argv.length >= 2 && typeof argv[1] === 'string' && argv[1].endsWith('feynman-timeline-refresh-command.cjs') ? 2 : 0;
  for (let i = startIdx; i < argv.length; i++) {
    const a = argv[i];
    if (typeof a !== 'string') continue;
    if (a === '--all') { out.all = true; continue; }
    if (a === '--section') {
      const next = argv[i + 1];
      if (typeof next === 'string' && !next.startsWith('-')) { out.section = next; i += 1; }
      continue;
    }
    if (a === '--help' || a === '-h') { out.help = true; continue; }
    if (a.startsWith('-')) continue;
    if (out.section == null && !out.all) out.section = a;
  }
  // Default: --all when no args.
  if (!out.section && !out.all && !out.help) out.all = true;
  return out;
}

// ---------- Helpers ----------

function safeIsFile(p) { try { return fs.statSync(p).isFile(); } catch (_) { return false; } }
function safeIsDir(p)  { try { return fs.statSync(p).isDirectory(); } catch (_) { return false; } }

// ---------- Active room resolution ----------

/**
 * resolveActiveRoom(rootsOverride) -> roomPath | null
 *
 * Reads ~/MindrianRooms/.rooms/registry.json (or override) and returns the
 * active room dir. Returns null if no registry, no active slug, or the path
 * does not resolve to an actual directory. Mirrors the resolver used by
 * scripts/brain-derive-command.cjs.
 */
function resolveActiveRoom(rootsOverride) {
  const roomsRoot = rootsOverride
    || process.env.MINDRIAN_ROOMS_ROOT
    || process.env.MINDRIAN_ROOMS_HOME
    || path.join(os.homedir(), 'MindrianRooms');
  const registryPath = path.join(roomsRoot, '.rooms', 'registry.json');
  if (!safeIsFile(registryPath)) return null;
  let reg;
  try { reg = JSON.parse(fs.readFileSync(registryPath, 'utf8')); } catch (_) { return null; }
  if (!reg || typeof reg !== 'object') return null;
  const activeSlug = reg.active;
  if (!activeSlug || typeof activeSlug !== 'string') return null;
  const entry = reg.rooms && reg.rooms[activeSlug];
  if (!entry || typeof entry !== 'object') return null;
  const relPath = entry.path || activeSlug;
  const absPath = path.resolve(roomsRoot, relPath);
  if (!safeIsDir(absPath)) return null;
  return absPath;
}

/**
 * resolveRoomDb(roomDir) -> sqlite3 handle | null
 *
 * Opens roomDir/.mindrian/room.db (the Phase 109 standard path) via node:sqlite.
 * Returns null on missing file OR if node:sqlite is unavailable; the caller
 * treats null as a soft-fail (timeline is enrichment, not a gate).
 */
function resolveRoomDb(roomDir) {
  const dbPath = path.join(roomDir, '.mindrian', 'room.db');
  if (!safeIsFile(dbPath)) return null;
  try {
    const sqlite = require('node:sqlite');
    return new sqlite.DatabaseSync(dbPath);
  } catch (_) {
    return null;
  }
}

// ---------- F.0 Action Report renderer ----------

/**
 * renderReport(result) -> string
 *
 * Three summary rows + PER SECTION breakdown + NEXT footer. Stable F.0 / Shape E
 * Action Report shape. Hyphens only; zero em-dashes/en-dashes.
 */
function renderReport(result) {
  const lines = [];
  const refreshed = Array.isArray(result.refreshed) ? result.refreshed : [];
  const skipped = Array.isArray(result.skipped) ? result.skipped : [];
  const failed = Array.isArray(result.failed) ? result.failed : [];
  const refreshedN = refreshed.length;
  const skippedN = skipped.length;
  const failedN = failed.length;
  lines.push('');
  lines.push('  FEYNMAN TIMELINE REFRESH');
  lines.push('  ' + '-'.repeat(68));
  lines.push('  Sections refreshed:                 ' + refreshedN);
  lines.push('  Sections skipped (watermark fresh): ' + skippedN);
  lines.push('  Sections failed:                    ' + failedN);
  if (refreshedN + skippedN + failedN > 0) {
    lines.push('  ' + '-'.repeat(68));
    lines.push('  PER SECTION');
    for (const r of refreshed) {
      lines.push('  refreshed:  ' + r.slug + '  (watermark: ' + (r.watermark || '') + ')');
    }
    for (const r of skipped) {
      lines.push('  skipped:    ' + r.slug + '  (reason: ' + (r.reason || '') + ')');
    }
    for (const r of failed) {
      lines.push('  failed:     ' + r.slug + '  (reason: ' + (r.reason || '') + ')');
    }
  }
  lines.push('  ' + '-'.repeat(68));
  lines.push('  NEXT');
  if (failedN > 0) {
    lines.push('  Run again with --section <slug> to retry failed sections.');
  } else if (refreshedN === 0 && skippedN > 0) {
    lines.push('  All sections up to date.');
  } else if (refreshedN + skippedN + failedN === 0) {
    lines.push('  No FEYNMAN.md sections found under the active room.');
  } else {
    lines.push('  Refreshed ' + refreshedN + ' section(s).');
  }
  lines.push('');
  return lines.join('\n');
}

// ---------- Progress streamer (when many sections) ----------

function streamProgress(index, total, slug, label) {
  try { process.stderr.write('[' + index + '/' + total + '] ' + slug + ': ' + label + '\n'); } catch (_) { /* best-effort */ }
}

// ---------- Main ----------

function main() {
  const opts = parseArgv(process.argv);
  if (opts.help) {
    process.stdout.write('Usage: /mos:feynman-timeline-refresh [--all | --section <slug>]\n');
    process.exit(0);
    return;
  }

  const roomDir = resolveActiveRoom();
  if (!roomDir) {
    process.stderr.write('No active room. Set one with /mos:rooms switch <slug>.\n');
    process.exit(1);
    return;
  }

  // Section mode: validate slug is a directory under the room.
  if (opts.section) {
    const secDir = path.join(roomDir, opts.section);
    if (!safeIsDir(secDir)) {
      process.stderr.write('Invalid section slug: "' + opts.section + '". (Not a directory under ' + roomDir + '.) Run /mos:rooms to see available sections.\n');
      process.exit(1);
      return;
    }
  }

  const db = resolveRoomDb(roomDir);
  // room.db missing is a soft-fail (per command markdown contract).
  if (!db) {
    process.stdout.write('room.db not found for active room; the runner needs the Phase 109 SQL spine. Skipping refresh.\n');
    process.exit(0);
    return;
  }

  let result;
  try {
    if (opts.section) {
      const r = runner.refreshSection(roomDir, opts.section, { db: db });
      if (r.status === 'refreshed') {
        result = { refreshed: [{ slug: opts.section, watermark: r.watermark, written_path: r.written_path }], skipped: [], failed: [] };
      } else if (r.status === 'failed') {
        result = { refreshed: [], skipped: [], failed: [{ slug: opts.section, reason: r.reason }] };
      } else {
        result = { refreshed: [], skipped: [{ slug: opts.section, reason: r.reason || r.status }], failed: [] };
      }
    } else {
      // refreshAll: get section count first so we can stream progress when N > 3.
      const sections = runner.findFeynmanSections(roomDir);
      const total = sections.length;
      if (total > 3) {
        // Iterate manually so we can stream progress; mirrors runner.refreshAll.
        const refreshed = [];
        const skipped = [];
        const failed = [];
        for (let i = 0; i < sections.length; i++) {
          const s = sections[i];
          const r = runner.refreshSection(roomDir, s.slug, { db: db });
          if (r.status === 'refreshed') {
            refreshed.push({ slug: s.slug, written_path: r.written_path, watermark: r.watermark });
            streamProgress(i + 1, total, s.slug, 'refreshed');
          } else if (r.status === 'failed') {
            failed.push({ slug: s.slug, reason: r.reason });
            streamProgress(i + 1, total, s.slug, 'failed (' + (r.reason || 'unknown') + ')');
          } else {
            skipped.push({ slug: s.slug, reason: r.reason || r.status });
            streamProgress(i + 1, total, s.slug, 'skipped (' + (r.reason || r.status) + ')');
          }
        }
        result = { refreshed: refreshed, skipped: skipped, failed: failed };
      } else {
        result = runner.refreshAll(roomDir, { db: db });
      }
    }
  } finally {
    try { db.close(); } catch (_) {}
  }

  process.stdout.write(renderReport(result) + '\n');
  process.exit(0);
}

// ---------- Exports ----------

module.exports = {
  parseArgv,
  resolveActiveRoom,
  resolveRoomDb,
  renderReport,
  main,
};

if (require.main === module) {
  main();
}
