'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 150-07 -- the missing FEYNMAN.md seed-writer (MEM-08; discover.md:170).
 * ===========================================================================
 * commands/discover.md DISC-10 line 170 promises: "Seed the room's per-section
 * FEYNMAN.md from it via the shipped lib/core/folder-memory.cjs writer -- never
 * hand-write FEYNMAN.md." That seed-writer did NOT exist, so fresh rooms got no
 * auto FEYNMAN section at all. This module ships that promise.
 *
 * It writes the HUMAN-AUTHORED body region of a fresh section's FEYNMAN.md, leaving
 * any sentinel-bounded ## Timeline (auto) section to the Phase 124 timeline-runner
 * (this writer does NOT re-derive the timeline). The write routes THROUGH the shipped
 * write idiom that the folder-memory read contract reuses (the Phase 124 timeline-
 * runner atomicWrite + frontmatter parse/serialize, the same helpers
 * lib/core/folder-memory.cjs::extractFeynmanBody reads back through) -- never a
 * bespoke hand-written file (discover.md:170). After seeding,
 * folder-memory.readQuintuple(sectionPath).feynman is non-empty.
 *
 * It then projects the body-freshness + the timeline stale-flag rows as typed graph
 * signals via lib/core/navigation.cjs (logMemoryEvent), closing the write-only sink:
 * FEYNMAN.md gains a genuine read-back signal the projected cortex (and the dial via
 * getRoomContext) can read.
 *
 * Canon Part 7: reuses the SHIPPED timeline-runner atomic-write + frontmatter idiom;
 *   net-new is only the seed sequencing + the freshness projection.
 * Canon Part 8: zero net-new Brain surface; LOCAL-only. The freshness memory_event
 *   carries the section slug + a freshness scalar / stale-flag only; the FEYNMAN prose
 *   body NEVER lands in a memory_event and never crosses to Brain.
 * Canon Part 9: the body-freshness rows are SYSTEM-BOOKKEEPING (memory_event,
 *   created_by=system, review_status=confirmed) under the v1.5 audit-node carve-out --
 *   they record what the system DID, never a venture truth-claim. Part 9 role 5 is
 *   untouched (no truth-claim node is minted here).
 *
 * Best-effort: a logging failure never corrupts the landed write; a fresh section that
 * already has a FEYNMAN human body is left untouched (idempotent, never clobbers human
 * authorship).
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only.
 *
 * Public API:
 *   seedSection(roomDir, sectionSlug, seedBody, opts) -> { status, ... }
 *
 * License: BSL 1.1.
 */

const fs = require('node:fs');
const path = require('node:path');

// Reuse the SHIPPED Phase 124 timeline-runner write idiom (Part 7): the atomic
// .tmp + rename write, the frontmatter parse/serialize, and the bodyOutsideSentinels
// helper -- the SAME helpers lib/core/folder-memory.cjs::extractFeynmanBody reads
// back through. Routing the write through these (not a bespoke fs.writeFileSync of a
// hand-authored file) is what fulfils the discover.md:170 "via the shipped writer"
// contract.
const timelineRunner = require('./timeline-runner.cjs');
const navigation = require('../navigation.cjs');

// Freshness threshold: a FEYNMAN human body older than this is flagged stale. Mirrors
// the Phase 124 renderer quiet window (30 days) so the body-freshness signal and the
// timeline stale buckets agree.
const BODY_STALE_MS = 30 * 24 * 60 * 60 * 1000;

function safeIsFile(p) { try { return fs.statSync(p).isFile(); } catch (_) { return false; } }
function safeIsDir(p) { try { return fs.statSync(p).isDirectory(); } catch (_) { return false; } }

// The per-section FEYNMAN.md path (the same file the Phase 124 timeline + the read
// contract use).
function feynmanPath(roomDir, sectionSlug) {
  return path.join(roomDir, sectionSlug, 'FEYNMAN.md');
}

/**
 * Project the body-freshness + timeline stale-flag rows as typed graph signals.
 * Best-effort: never throws. Returns the projected freshness label.
 *
 * @param {object} db          caller-owned room.db handle (navigation reads/writes through it)
 * @param {string} sectionSlug
 * @param {number} now_ms
 * @param {number} bodyMtimeMs the mtime of the seeded FEYNMAN.md body
 */
function projectFreshnessSignal(db, sectionSlug, now_ms, bodyMtimeMs) {
  const ageMs = Number.isFinite(bodyMtimeMs) ? (now_ms - bodyMtimeMs) : 0;
  const isStale = ageMs >= BODY_STALE_MS;
  const freshness = isStale ? 'stale' : 'fresh';
  if (!db) return freshness;
  try {
    navigation.logMemoryEvent(db, 'feynman_body_seeded', {
      source_path: 'feynman:' + sectionSlug,
      created_by: 'system',
      body_freshness: freshness,
    });
    if (isStale) {
      navigation.logMemoryEvent(db, 'feynman_body_stale_flagged', {
        source_path: 'feynman:' + sectionSlug,
        created_by: 'system',
        body_freshness: freshness,
        age_ms: ageMs,
      });
    }
  } catch (_) {
    // Logging failure never corrupts the landed write; the freshness label is still
    // returned so the caller can degrade gracefully.
  }
  return freshness;
}

/**
 * seedSection(roomDir, sectionSlug, seedBody, opts) -> { status, ... }
 *
 * Seeds a fresh section's FEYNMAN human body via the shipped write idiom, then
 * projects the body-freshness signal. seedBody is the plain-language seed content
 * DISC-10 produces (the "explain it to a smart twelve-year-old" one-liner + ladder).
 *
 * Returns:
 *   { status: 'seeded', written_path, freshness }   on a successful seed
 *   { status: 'skipped_has_body', reason }           when a human body already exists
 *   { status: 'skipped_no_section_dir', reason }      when the section dir is absent
 *   { status: 'failed', reason }                      on any write error (never throws;
 *                                                      atomic write preserves any prior file)
 *
 * opts: { db, now_ms?, force? }
 *   db     -- caller-owned room.db handle for the freshness projection (optional).
 *   now_ms -- deterministic clock for the freshness check (defaults Date.now).
 *   force  -- overwrite an existing human body (default false; never clobbers human
 *             authorship unless explicitly forced).
 */
function seedSection(roomDir, sectionSlug, seedBody, opts) {
  const options = opts || {};
  const db = options.db;
  const now_ms = Number.isFinite(options.now_ms) ? options.now_ms : Date.now();
  const force = options.force === true;

  const sectionDir = path.join(roomDir, sectionSlug);
  if (!safeIsDir(sectionDir)) {
    return { status: 'skipped_no_section_dir', reason: 'section_dir_absent' };
  }
  const feyPath = feynmanPath(roomDir, sectionSlug);

  // Idempotent: if a human body already exists (FEYNMAN.md present with non-empty
  // bodyOutsideSentinels), do NOT clobber it unless forced. This honors Phase 124's
  // D-02 human-authorship invariant.
  if (!force && safeIsFile(feyPath)) {
    try {
      const existing = fs.readFileSync(feyPath, 'utf8');
      const parsed = timelineRunner.parseFrontmatter(existing);
      const humanBody = timelineRunner.bodyOutsideSentinels(parsed.body).trim();
      if (humanBody.length > 0) {
        return { status: 'skipped_has_body', reason: 'human_body_present' };
      }
    } catch (_) {
      // Fall through to seed if the existing file is unreadable / malformed.
    }
  }

  const safeBody = typeof seedBody === 'string' && seedBody.trim().length > 0
    ? seedBody.trim()
    : 'Plain-language essence pending. Replace this seed with the one-line "explain it to a smart twelve-year-old" message.';

  // Compose the FEYNMAN human body. A leading H1 keeps the section identity; the seed
  // body is the plain-language message. No sentinels -- the Phase 124 timeline-runner
  // appends its own sentinel-bounded ## Timeline (auto) section on its first refresh.
  const bodyContent = '# ' + sectionSlug + '\n\n' + safeBody + '\n';

  try {
    // Route through the SHIPPED atomic write idiom (the same helper the read contract
    // reuses) -- never a bespoke hand-written file (discover.md:170).
    timelineRunner.atomicWrite(feyPath, bodyContent);
    let bodyMtimeMs = now_ms;
    try { bodyMtimeMs = fs.statSync(feyPath).mtimeMs; } catch (_) {}

    const freshness = projectFreshnessSignal(db, sectionSlug, now_ms, bodyMtimeMs);

    return { status: 'seeded', written_path: feyPath, freshness: freshness };
  } catch (err) {
    const reason = (err && err.message) ? String(err.message).slice(0, 200) : 'unknown_error';
    return { status: 'failed', reason: reason };
  }
}

module.exports = {
  seedSection,
  feynmanPath,
  projectFreshnessSignal,
  BODY_STALE_MS,
};
