#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 143.1-05 -- /mos:dial-memory-refresh CLI dispatcher (MEMDIAL-02 manual half)
 * =================================================================================
 * Manual user command to force-refresh the `## Dial Memory (auto)` sentinel-bounded
 * block in each section's memory MD. The automatic session-start cascade (the dial
 * slot in scripts/session-start) fires it on every session start; this is the
 * explicit manual knob -- the SAME hybrid trigger shape as the Phase 124
 * /mos:feynman-timeline-refresh command (D-04 + D-12).
 *
 * It is a THIN WRAPPER around lib/core/feynman/dial-memory-runner.cjs (which is
 * itself a thin shim over the Phase 124 timeline-runner, Part 7). Active-room +
 * room.db resolution REUSE the SHIPPED feynman-timeline-refresh-command.cjs
 * resolvers verbatim (resolveActiveRoom / resolveRoomDb) so the two refresh
 * commands stay in lockstep.
 *
 * Invocation modes (mirror the timeline command):
 *   node scripts/dial-memory-refresh-command.cjs            -> --all (default)
 *   node scripts/dial-memory-refresh-command.cjs --all
 *   node scripts/dial-memory-refresh-command.cjs --section <slug>
 *
 * Canon Part 8: ZERO net-new Brain surface; the runner reads ONLY room.db via
 *   lib/core/navigation.cjs (D-03). Pure CJS, node built-ins only. Three-surface
 *   safe (CLI + Desktop MCP + Cowork).
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only.
 */

const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const runner = require(path.join(REPO_ROOT, 'lib', 'core', 'feynman', 'dial-memory-runner.cjs'));
// Reuse the SHIPPED Phase 124 command resolvers verbatim (Part 7): active-room +
// room.db resolution are identical for both auto-sections.
const timelineCommand = require(path.join(REPO_ROOT, 'scripts', 'feynman-timeline-refresh-command.cjs'));

// ---------- argv parser (mirrors the timeline command) ----------

function parseArgv(argv) {
  const out = { section: null, all: false, help: false };
  if (!Array.isArray(argv)) return out;
  const startIdx = argv.length >= 2 && typeof argv[1] === 'string' && argv[1].endsWith('dial-memory-refresh-command.cjs') ? 2 : 0;
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
  if (!out.section && !out.all && !out.help) out.all = true;
  return out;
}

// ---------- F.0 Action Report renderer ----------

function renderReport(result) {
  const lines = [];
  const refreshed = Array.isArray(result.refreshed) ? result.refreshed : [];
  const skipped = Array.isArray(result.skipped) ? result.skipped : [];
  const failed = Array.isArray(result.failed) ? result.failed : [];
  lines.push('');
  lines.push('  DIAL MEMORY REFRESH');
  lines.push('  ' + '-'.repeat(68));
  lines.push('  Sections refreshed: ' + refreshed.length);
  lines.push('  Sections skipped:   ' + skipped.length);
  lines.push('  Sections failed:    ' + failed.length);
  if (refreshed.length + skipped.length + failed.length > 0) {
    lines.push('  ' + '-'.repeat(68));
    lines.push('  PER SECTION');
    for (const r of refreshed) lines.push('  refreshed:  ' + r.slug + '  (watermark: ' + (r.watermark || '') + ')');
    for (const r of skipped) lines.push('  skipped:    ' + r.slug + '  (reason: ' + (r.reason || '') + ')');
    for (const r of failed) lines.push('  failed:     ' + r.slug + '  (reason: ' + (r.reason || '') + ')');
  }
  lines.push('  ' + '-'.repeat(68));
  lines.push('  NEXT');
  if (failed.length > 0) {
    lines.push('  Run again with --section <slug> to retry failed sections.');
  } else if (refreshed.length === 0 && skipped.length === 0 && failed.length === 0) {
    lines.push('  No memory MD sections found under the active room.');
  } else {
    lines.push('  Refreshed ' + refreshed.length + ' section(s).');
  }
  lines.push('');
  return lines.join('\n');
}

// ---------- Main ----------

function main() {
  const opts = parseArgv(process.argv);
  if (opts.help) {
    process.stdout.write('Usage: /mos:dial-memory-refresh [--all | --section <slug>]\n');
    process.exit(0);
    return;
  }

  const roomDir = timelineCommand.resolveActiveRoom();
  if (!roomDir) {
    process.stderr.write('No active room. Set one with /mos:rooms switch <slug>.\n');
    process.exit(1);
    return;
  }

  const db = timelineCommand.resolveRoomDb(roomDir);
  if (!db) {
    process.stdout.write('room.db not found for active room; the dial-memory runner needs the Phase 109 SQL spine. Skipping refresh.\n');
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
      result = runner.refreshAll(roomDir, { db: db });
    }
  } finally {
    try { db.close(); } catch (_) {}
  }

  process.stdout.write(renderReport(result) + '\n');
  process.exit(0);
}

module.exports = { parseArgv, renderReport, main };

if (require.main === module) {
  main();
}
