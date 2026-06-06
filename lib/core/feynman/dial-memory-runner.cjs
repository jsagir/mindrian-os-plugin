'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 143.1-05 -- dial-memory runner (MEMDIAL-02 runner half).
 * =============================================================
 * The atomic-write orchestrator that writes the sentinel-bounded dial-memory
 * section to the target MD in PRODUCTION. WITHOUT this runner MEMDIAL-02 is
 * green-in-tests-but-inert: the renderer (Plan 143.1-05 Task 2) produces the
 * body, but nothing writes it. This module closes that gap.
 *
 * It is a THIN SHIM over the SHIPPED Phase 124 timeline-runner (Canon Part 7
 * reuse): it REUSES the timeline-runner's parseFrontmatter / serializeFrontmatter
 * / bodyOutsideSentinels / sha256Hex / atomicWrite (.tmp + rename) idioms verbatim
 * and merges via the dial renderer's own dial sentinels (mergeDialSection). It
 * writes ONLY inside the dial sentinels; the human-authored body is byte-preserved
 * (the Phase 124 D-02 hard invariant).
 *
 * The dial section's body comes from lib/core/feynman/dial-memory-renderer.cjs,
 * which reads ONLY via navigation.cjs (D-03). The runner adds the impure shell:
 * read the file, merge inside the dial sentinels, update the watermark frontmatter,
 * atomic-write, and log a memory_event on every refresh attempt.
 *
 * Hybrid trigger (the SAME as the Phase 124 timeline, D-04 + D-12):
 *   - session-start cascade (wired in scripts/session-start alongside the timeline
 *     refresh), and
 *   - a manual refresh command surface (scripts/dial-memory-refresh-command.cjs,
 *     mirroring scripts/feynman-timeline-refresh-command.cjs).
 *
 * Public API (parity with the timeline-runner):
 *   refreshSection(roomDir, sectionSlug, opts) -> { status, ... }
 *   refreshAll(roomDir, opts) -> { refreshed, skipped, failed }
 *
 * Canon Part 8: zero net-new Brain surface; LOCAL-only. Canon Part 9: every
 *   refresh logs a typed memory_event making the regenerate decision legible.
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only.
 *
 * License: BSL 1.1.
 */

const fs = require('node:fs');
const path = require('node:path');

const renderer = require('./dial-memory-renderer.cjs');
// Reuse the SHIPPED Phase 124 timeline-runner impure shell verbatim (Part 7):
// the frontmatter parse/serialize + atomic write + byte-preservation helpers.
const timelineRunner = require('./timeline-runner.cjs');
const navigation = require('../navigation.cjs');

// The dial watermark frontmatter key (parallel to the Phase 124
// timeline_last_rendered key; a distinct key so the two auto-sections do not
// collide on the same FEYNMAN.md / memory MD).
const WATERMARK_KEY = 'dial_memory_last_rendered';

function safeIsFile(p) { try { return fs.statSync(p).isFile(); } catch (_) { return false; } }
function safeIsDir(p) { try { return fs.statSync(p).isDirectory(); } catch (_) { return false; } }

// The target memory MD per section. The dial memory section lives on the same
// FEYNMAN.md the Phase 124 timeline uses (the section's human-readable memory
// file), each in its own sentinel pair so they coexist without collision.
function memoryMdPath(roomDir, sectionSlug) {
  return path.join(roomDir, sectionSlug, 'FEYNMAN.md');
}

// refreshSection(roomDir, sectionSlug, opts) -- the production write.
//
// opts: { db, now_ms?, force?, focusNodeId?, reachList? }
//   db        -- caller-owned room.db handle (navigation reads through it).
//   now_ms    -- deterministic clock for the watermark + render.
//   force     -- ignored watermark skip is handled by the renderer being
//                idempotent; force is accepted for parity but the dial section
//                always re-renders from graph (cheap, deterministic).
//   focusNodeId / reachList -- passed straight to the renderer.
//
// Returns { status:'refreshed', written_path, watermark } on a successful write,
// { status:'skipped_no_feynman' } when the target MD is absent, or
// { status:'failed', reason } on any error (never throws; the original file
// survives because the merge happens in memory and the write is atomic).
function refreshSection(roomDir, sectionSlug, opts) {
  const options = opts || {};
  const db = options.db;
  const now_ms = Number.isFinite(options.now_ms) ? options.now_ms : Date.now();
  const feyPath = memoryMdPath(roomDir, sectionSlug);

  if (!safeIsFile(feyPath)) {
    return { status: 'skipped_no_feynman', reason: 'no_memory_md_in_section_dir' };
  }

  try {
    const rawContent = fs.readFileSync(feyPath, 'utf8');
    const parsed = timelineRunner.parseFrontmatter(rawContent);

    // Render the dial section body FROM the graph (reads ONLY via navigation.cjs).
    const rendered = renderer.renderDialMemory(db, sectionSlug, {
      now_ms: now_ms,
      focusNodeId: options.focusNodeId,
      reachList: options.reachList,
    });

    // Merge inside the DIAL sentinels only (the human-authored body byte-preserved,
    // D-02). Reuse the dial renderer's own sentinel-merge idiom so the dial section
    // never collides with the Phase 124 timeline sentinels on the same file.
    const newBody = renderer.mergeDialSection(parsed.body, rendered.markdown_body);

    // Update the dial watermark frontmatter (parallel to timeline_last_rendered).
    const newIso = renderer.isoSecond(now_ms);
    const newFm = Object.assign({}, parsed.fm, {});
    newFm[WATERMARK_KEY] = newIso;
    const newContent = timelineRunner.serializeFrontmatter(newFm, parsed.fmOrder, newBody, true);

    // Atomic write (.tmp + rename) -- reuse the SHIPPED timeline-runner helper.
    timelineRunner.atomicWrite(feyPath, newContent);

    // Log a success memory_event (Part 9: the refresh decision is legible).
    if (db) {
      try {
        navigation.logMemoryEvent(db, 'dial_memory_refreshed', {
          source_path: 'dial-memory:' + sectionSlug,
          created_by: 'system',
        });
      } catch (_) { /* logging failure does not corrupt the landed write */ }
    }

    return { status: 'refreshed', written_path: feyPath, watermark: newIso };
  } catch (err) {
    const reason = (err && err.message) ? String(err.message).slice(0, 200) : 'unknown_error';
    if (db) {
      try {
        navigation.logMemoryEvent(db, 'dial_memory_refresh_failed', {
          source_path: 'dial-memory:' + sectionSlug,
          created_by: 'system',
          reason: reason,
        });
      } catch (_) { /* secondary failure swallowed */ }
    }
    return { status: 'failed', reason: reason };
  }
}

// findMemorySections(roomDir) -- reuse the SHIPPED timeline-runner section walk
// (it finds every <roomDir>/<section>/FEYNMAN.md), since the dial memory section
// lives on the same per-section memory MD.
function findMemorySections(roomDir) {
  return timelineRunner.findFeynmanSections(roomDir);
}

function refreshAll(roomDir, opts) {
  const options = opts || {};
  const refreshed = [];
  const skipped = [];
  const failed = [];
  if (!safeIsDir(roomDir)) return { refreshed, skipped, failed };
  const sections = findMemorySections(roomDir);
  for (const s of sections) {
    const r = refreshSection(roomDir, s.slug, options);
    if (r.status === 'refreshed') refreshed.push({ slug: s.slug, written_path: r.written_path, watermark: r.watermark });
    else if (r.status === 'failed') failed.push({ slug: s.slug, reason: r.reason });
    else skipped.push({ slug: s.slug, reason: r.reason || r.status });
  }
  return { refreshed, skipped, failed };
}

module.exports = {
  refreshSection,
  refreshAll,
  findMemorySections,
  memoryMdPath,
  WATERMARK_KEY,
  // Re-export the sentinels for the manual-refresh command surface.
  SENTINEL_START: renderer.SENTINEL_START,
  SENTINEL_END: renderer.SENTINEL_END,
};
