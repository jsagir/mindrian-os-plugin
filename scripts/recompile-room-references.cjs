#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88-03 -- recompile-room-references (deterministic)
 * =========================================================
 * Rebuilds the ONLY machine-managed portion of ROOM.md: the delimited
 *
 *   <!-- BEGIN REFERENCES -->
 *   ... auto-generated artifact + cross-section link block ...
 *   <!-- END REFERENCES -->
 *
 * Human-authored identity text outside those markers is preserved
 * byte-for-byte. Without this compiler, ROOM.md is written at folder
 * creation and never refreshed -- a section accumulates 10 artifacts
 * but ROOM.md still lists the original 3 references. That is the
 * "partial-wiring gap" that 88-CONTEXT.md flags as a memory leak in
 * the R of the ROOM/STATE/MINTO triple.
 *
 * This script is deterministic (no LLM), sub-200ms for typical
 * sections, and composes with the Phase 87-02 atomic write-lock. It
 * also detects mtime conflicts: if ROOM.md has been edited since the
 * last recompile (stamp stored at roomRoot/.mindrian/recompile-stamps.
 * json), the recompile is SKIPPED and a warning is emitted to stderr.
 * This closes risk #7 from 88-CONTEXT.md (silent stomp of manual
 * edits between sessions).
 *
 * Three-surface by construction: CJS + node built-ins + zero new deps.
 * Same code path on Claude Code CLI, Claude Desktop MCP, and Cowork.
 *
 * Usage (CLI, from bash hook scripts or post-write dispatcher):
 *   node scripts/recompile-room-references.cjs <sectionPath>
 *
 * Exit codes:
 *   0 -- success (references recompiled)
 *   1 -- generic error (I/O failure, lock contention after retries)
 *   2 -- ROOM.md not found in <sectionPath>
 *
 * Usage (programmatic, for other scripts in this repo):
 *   const rc = require('./scripts/recompile-room-references.cjs');
 *   rc.recompile(sectionPath);       // {success, references_count, elapsed_ms} or {success:false, reason}
 *   rc.extractReferences(sectionPath);
 *   rc.buildReferencesBlock(refs);
 *
 * Downstream consumers:
 *   - 88-04 post-write hook (calls recompile on room section writes)
 *   - 88-06 on-stop snapshot (calls recompile per active section pre-snapshot)
 *   - lib/core/folder-memory.cjs (reads the output of this compiler)
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { acquireLock, releaseLock } = require('../lib/core/write-lock.cjs');

// Lock acquisition: exponential-backoff retry so concurrent post-write
// workers (same section, different processes) all eventually converge
// instead of a single winner and N losers. Mirrors the primitive in
// scripts/minto-debouncer.cjs.
const LOCK_RETRY_MAX_ATTEMPTS = 12;
const LOCK_RETRY_BASE_MS = 25;
const LOCK_RETRY_CAP_MS = 1600;

function sleepSync(ms) {
  if (ms <= 0) return;
  try {
    const sab = new SharedArrayBuffer(4);
    const view = new Int32Array(sab);
    Atomics.wait(view, 0, 0, ms);
  } catch (_) {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) { /* busy wait */ }
  }
}

function tryAcquireLock(roomDir) {
  let backoff = LOCK_RETRY_BASE_MS;
  let lastErr;
  for (let attempt = 0; attempt < LOCK_RETRY_MAX_ATTEMPTS; attempt++) {
    try {
      acquireLock(roomDir);
      return true;
    } catch (e) {
      lastErr = e;
      const jitter = Math.floor(Math.random() * (backoff / 2));
      sleepSync(backoff + jitter);
      backoff = Math.min(backoff * 2, LOCK_RETRY_CAP_MS);
    }
  }
  process.stderr.write(
    '[recompile-room-references] could not acquire write-lock for ' +
      roomDir + ' after ' + LOCK_RETRY_MAX_ATTEMPTS + ' attempts (' +
      (lastErr && lastErr.message || 'unknown') + '); skipping\n'
  );
  return false;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BEGIN_MARKER = '<!-- BEGIN REFERENCES -->';
const END_MARKER = '<!-- END REFERENCES -->';

// System / memory-triple files excluded from the artifact list so they
// do not appear as "artifacts" cross-referenced by the compiler.
const RESERVED_FILES = new Set([
  'ROOM.md',
  'STATE.md',
  'MINTO.md',
  'TEAM-STATE.md',
]);

// Wikilink: [[target]] or [[target|label]]
const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

// Frontmatter + first H1 extractors (narrow dialect: we only look for
// a `title:` scalar or `# ...` heading; anything else falls back to
// the basename).
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;
const H1_RE = /^#\s+(.+)$/m;
const FM_TITLE_RE = /^title:\s*(.+)$/m;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Find the room root for a section by walking up for `.room-root`
 * sentinel. Falls back to the section's parent directory so the stamp
 * file still lands somewhere sensible even when the sentinel is
 * missing (e.g. bare fixture directories in tests that only contain
 * one section).
 */
function findRoomRoot(sectionPath) {
  let cur = path.resolve(sectionPath);
  for (let i = 0; i < 12; i++) {
    // Cap walk depth to avoid accidental root traversal on misconfigured fs
    if (fs.existsSync(path.join(cur, '.room-root'))) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  // Fallback: parent of the section.
  return path.dirname(path.resolve(sectionPath));
}

function stampsPath(roomRoot) {
  return path.join(roomRoot, '.mindrian', 'recompile-stamps.json');
}

function readStamps(roomRoot) {
  const sp = stampsPath(roomRoot);
  if (!fs.existsSync(sp)) return {};
  try {
    const raw = fs.readFileSync(sp, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_e) {
    // Corrupt stamp file: reset rather than crash.
    process.stderr.write(
      '[recompile-room-references] warn: stamps file unreadable; resetting\n'
    );
    return {};
  }
}

function writeStampsAtomic(roomRoot, stamps) {
  const sp = stampsPath(roomRoot);
  fs.mkdirSync(path.dirname(sp), { recursive: true });
  const tmp = sp + '.tmp.' + process.pid;
  let fd;
  try {
    fd = fs.openSync(tmp, 'w');
    fs.writeSync(fd, JSON.stringify(stamps, null, 2));
    try { fs.fsyncSync(fd); } catch (_) { /* fsync best-effort */ }
    fs.closeSync(fd);
    fd = null;
    fs.renameSync(tmp, sp);
  } catch (e) {
    try { if (fd != null) fs.closeSync(fd); } catch (_) {}
    try { fs.unlinkSync(tmp); } catch (_) {}
    throw e;
  }
}

function writeFileAtomic(targetPath, contents) {
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = targetPath + '.tmp.' + process.pid;
  let fd;
  try {
    fd = fs.openSync(tmp, 'w');
    fs.writeSync(fd, contents);
    try { fs.fsyncSync(fd); } catch (_) {}
    fs.closeSync(fd);
    fd = null;
    fs.renameSync(tmp, targetPath);
  } catch (e) {
    try { if (fd != null) fs.closeSync(fd); } catch (_) {}
    try { fs.unlinkSync(tmp); } catch (_) {}
    throw e;
  }
}

/**
 * Extract a human-readable label from an artifact .md file.
 * Prefers `title:` frontmatter field, then first `# H1`, then the
 * prettified basename.
 */
function labelForArtifact(filePath, basenameNoExt) {
  let buf;
  try {
    buf = fs.readFileSync(filePath, 'utf-8');
  } catch (_e) {
    return basenameNoExt;
  }

  const fmMatch = buf.match(FRONTMATTER_RE);
  if (fmMatch) {
    const titleMatch = fmMatch[1].match(FM_TITLE_RE);
    if (titleMatch) {
      const raw = titleMatch[1].trim().replace(/^["']|["']$/g, '').trim();
      if (raw.length > 0) return raw;
    }
  }

  const h1Match = buf.match(H1_RE);
  if (h1Match) {
    const raw = h1Match[1].trim();
    if (raw.length > 0) return raw;
  }

  return basenameNoExt;
}

/**
 * Collect outbound cross-section wikilinks from an artifact body.
 * A wikilink counts as "cross-section" when its target contains '/',
 * meaning it points to a path rather than a bare artifact in the same
 * section (e.g. `[[problem-definition/wedge-spec]]`).
 *
 * Duplicate targets are collapsed by the caller via a Set.
 */
function extractCrossSectionLinks(buf) {
  if (typeof buf !== 'string') return [];
  const links = [];
  WIKILINK_RE.lastIndex = 0;
  let m;
  while ((m = WIKILINK_RE.exec(buf)) !== null) {
    const target = m[1].trim();
    const label = (m[2] || target).trim();
    if (target.indexOf('/') !== -1) {
      links.push({ target: target, label: label });
    }
  }
  return links;
}

// ---------------------------------------------------------------------------
// Public helpers (exported for testing / composition)
// ---------------------------------------------------------------------------

/**
 * extractReferences(sectionPath) -> { artifacts, sectionLinks }
 *
 * Walks the TOP-LEVEL of sectionPath only (not recursive into sub-rooms).
 * Filters reserved/hidden/underscore files. Reads each artifact and
 * gleans: a display label (from title/frontmatter/basename) AND any
 * outbound cross-section wikilinks in its body.
 *
 * Pure read-only. No writes. No fs.mkdir. Designed to be cheap enough
 * to call repeatedly from the post-write hook path.
 */
function extractReferences(sectionPath) {
  const artifacts = [];
  const sectionLinkSet = new Map(); // target -> label (first wins)

  let names = [];
  try {
    names = fs.readdirSync(sectionPath);
  } catch (_e) {
    return { artifacts: artifacts, sectionLinks: [] };
  }

  for (const name of names) {
    if (name.length === 0) continue;
    if (name[0] === '.' || name[0] === '_') continue;
    if (RESERVED_FILES.has(name)) continue;
    if (!name.endsWith('.md')) continue;

    const abs = path.join(sectionPath, name);
    let st;
    try { st = fs.statSync(abs); } catch (_e) { continue; }
    if (!st.isFile()) continue;

    const basenameNoExt = name.slice(0, -3);
    const label = labelForArtifact(abs, basenameNoExt);
    artifacts.push({ target: basenameNoExt, label: label });

    // Body scan for cross-section wikilinks.
    let buf;
    try { buf = fs.readFileSync(abs, 'utf-8'); } catch (_e) { buf = ''; }
    const links = extractCrossSectionLinks(buf);
    for (const l of links) {
      if (!sectionLinkSet.has(l.target)) {
        sectionLinkSet.set(l.target, l.label);
      }
    }
  }

  // Stable ordering: artifacts alphabetically by target, section links
  // alphabetically by target. Determinism matters so the recompiler
  // output is byte-identical across runs with the same filesystem.
  artifacts.sort((a, b) => (a.target < b.target ? -1 : a.target > b.target ? 1 : 0));
  const sectionLinks = Array.from(sectionLinkSet.entries())
    .map(([target, label]) => ({ target: target, label: label }))
    .sort((a, b) => (a.target < b.target ? -1 : a.target > b.target ? 1 : 0));

  return { artifacts: artifacts, sectionLinks: sectionLinks };
}

/**
 * buildReferencesBlock(refs) -> string
 *
 * Emits the machine-managed block WITHOUT the surrounding BEGIN/END
 * markers (the caller injects them). Format matches the <interfaces>
 * block in 88-03-PLAN.md.
 *
 * Section-level structure:
 *   ## Cross-References
 *
 *   ### Section links
 *   - [[target|label]]
 *
 *   ### Artifacts in this section
 *   - [[target|label]]
 *
 *   ### Cross-section mentions (inbound)
 *   - (placeholder -- inbound mentions are a Phase 90 scope)
 *
 * Empty section ALWAYS emits the placeholder line "No artifacts yet
 * in this section." under the Artifacts subheader, so consumers (and
 * guardians) can distinguish "never compiled" from "compiled-but-empty".
 */
function buildReferencesBlock(refs) {
  const lines = [];
  lines.push('## Cross-References');
  lines.push('');

  lines.push('### Section links');
  if (!refs.sectionLinks || refs.sectionLinks.length === 0) {
    lines.push('- (none)');
  } else {
    for (const s of refs.sectionLinks) {
      // Emit [[target]] when label is identical to target -- avoids the
      // noisy [[target|target]] shape AND keeps the output grep-friendly
      // (one mention of the target per link) which matters for dedup
      // assertions in downstream tests and consumers.
      if (s.label === s.target) {
        lines.push('- [[' + s.target + ']]');
      } else {
        lines.push('- [[' + s.target + '|' + s.label + ']]');
      }
    }
  }
  lines.push('');

  lines.push('### Artifacts in this section');
  if (!refs.artifacts || refs.artifacts.length === 0) {
    lines.push('- No artifacts yet in this section.');
  } else {
    for (const a of refs.artifacts) {
      if (a.label === a.target) {
        lines.push('- [[' + a.target + ']]');
      } else {
        lines.push('- [[' + a.target + '|' + a.label + ']]');
      }
    }
  }
  lines.push('');

  lines.push('### Cross-section mentions (inbound)');
  lines.push('- (none -- inbound scan is Phase 90 scope)');
  lines.push('');

  return lines.join('\n');
}

/**
 * Splice the references block into existing ROOM.md text, preserving
 * everything OUTSIDE the markers byte-for-byte. If markers are absent,
 * the block is appended to the end of the body with exactly one blank
 * line separator.
 *
 * @param {string} existing ROOM.md text
 * @param {string} block machine-managed block content (no markers)
 * @returns {string} new ROOM.md text
 */
function spliceReferencesBlock(existing, block) {
  const wrapped = BEGIN_MARKER + '\n' + block + END_MARKER + '\n';
  const beginIdx = existing.indexOf(BEGIN_MARKER);
  const endIdx = existing.indexOf(END_MARKER);

  if (beginIdx !== -1 && endIdx !== -1 && endIdx > beginIdx) {
    // Replace the existing block IN PLACE. Preserve everything before
    // BEGIN and everything after END, byte-for-byte.
    const before = existing.slice(0, beginIdx);
    // Advance past the END marker AND any trailing newline that the
    // previous recompile wrote (so we don't accumulate blank lines).
    let afterStart = endIdx + END_MARKER.length;
    if (existing[afterStart] === '\n') afterStart += 1;
    const after = existing.slice(afterStart);
    return before + wrapped + after;
  }

  // No markers present: append. Ensure exactly one blank line
  // separator between existing prose and the appended block.
  let prose = existing;
  // Trim at most one trailing newline to avoid three in a row when we
  // prepend our own '\n\n'.
  if (prose.endsWith('\n\n')) {
    // already double-newline terminated -- fine
  } else if (prose.endsWith('\n')) {
    prose = prose + '\n';
  } else {
    prose = prose + '\n\n';
  }
  return prose + wrapped;
}

// ---------------------------------------------------------------------------
// recompile()
// ---------------------------------------------------------------------------

/**
 * recompile(sectionPath)
 *
 * Rebuilds the REFERENCES block inside sectionPath/ROOM.md.
 *
 * Contracts:
 *   - never throws on expected inputs; returns { success:false, reason }
 *   - preserves identity prose byte-for-byte
 *   - deterministic: same inputs -> byte-identical output across runs
 *   - composes with Phase 87-02 atomic write-lock
 *   - detects mtime conflicts (ROOM.md edited after last recompile)
 *
 * @param {string} sectionPath absolute path to a section directory
 * @returns {object}
 *   - { success:true, references_count, elapsed_ms }
 *   - { success:false, reason: 'no_room_md' | 'mtime_conflict' | 'io_error' | 'lock_failed' }
 */
function recompile(sectionPath) {
  const startedAt = Date.now();

  const roomMdPath = path.join(sectionPath, 'ROOM.md');
  if (!fs.existsSync(roomMdPath)) {
    process.stderr.write(
      '[recompile-room-references] ROOM.md not found in ' + sectionPath + '\n'
    );
    return { success: false, reason: 'no_room_md' };
  }

  const roomRoot = findRoomRoot(sectionPath);
  // Section key in the stamps file: the canonical absolute path.
  const stampKey = path.resolve(sectionPath);

  // Conflict detection FIRST (outside the lock so we can bail cheaply).
  const preStat = fs.statSync(roomMdPath);
  const stamps = readStamps(roomRoot);
  const priorStamp = stamps[stampKey];
  if (priorStamp && typeof priorStamp.last_recompile_at === 'number') {
    // A small slack (1000ms) avoids false positives from fs timestamp
    // granularity when the recompile itself completes in under 1s.
    if (preStat.mtimeMs > priorStamp.last_recompile_at + 1000) {
      process.stderr.write(
        '[recompile-room-references] mtime conflict: skipped ' + sectionPath +
          ' (ROOM.md edited at ' + new Date(preStat.mtimeMs).toISOString() +
          ' after last recompile at ' + new Date(priorStamp.last_recompile_at).toISOString() + ')\n'
      );
      return { success: false, reason: 'mtime_conflict' };
    }
  }

  // Acquire the Phase 87-02 write-lock before mutating ROOM.md or
  // stamps. Uses exponential-backoff retry so concurrent post-write
  // workers all eventually converge instead of single-winner / N-losers.
  // Treat terminal lock failure as a soft skip (not a crash).
  const locked = tryAcquireLock(roomRoot);
  if (!locked) {
    return { success: false, reason: 'lock_failed' };
  }

  try {
    // Re-check mtime inside the lock (double-check pattern): another
    // process may have beaten us and refreshed the stamp while we were
    // waiting for the lock.
    const stamps2 = readStamps(roomRoot);
    const priorStamp2 = stamps2[stampKey];
    const curStat = fs.statSync(roomMdPath);
    if (priorStamp2 && typeof priorStamp2.last_recompile_at === 'number') {
      if (curStat.mtimeMs > priorStamp2.last_recompile_at + 1000) {
        return { success: false, reason: 'mtime_conflict' };
      }
    }

    // Read current ROOM.md, compute references, splice, write atomic.
    const existing = fs.readFileSync(roomMdPath, 'utf-8');
    const refs = extractReferences(sectionPath);
    const block = buildReferencesBlock(refs);
    const next = spliceReferencesBlock(existing, block);

    // Only write if the content actually changed -- keeps ROOM.md mtime
    // stable across no-op recompiles so the stamp stays honest.
    if (next !== existing) {
      writeFileAtomic(roomMdPath, next);
    }

    // Update the stamp regardless so a no-op recompile also advances
    // the "last checked" time. This keeps future mtime comparisons
    // sensible (otherwise a long-untouched section with a stale stamp
    // would trip conflict detection on the NEXT real write).
    stamps2[stampKey] = { last_recompile_at: Date.now() };
    writeStampsAtomic(roomRoot, stamps2);

    const referencesCount = refs.artifacts.length + refs.sectionLinks.length;
    const elapsedMs = Date.now() - startedAt;
    return {
      success: true,
      references_count: referencesCount,
      elapsed_ms: elapsedMs,
    };
  } catch (e) {
    process.stderr.write(
      '[recompile-room-references] io error on ' + sectionPath + ': ' +
        (e && e.message || 'unknown') + '\n'
    );
    return { success: false, reason: 'io_error' };
  } finally {
    if (locked) {
      try { releaseLock(roomRoot); } catch (_) { /* best effort */ }
    }
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function runCli(argv) {
  const args = argv.slice(2);
  if (args.length < 1 || args[0] === '--help' || args[0] === '-h') {
    process.stderr.write(
      'usage: recompile-room-references <sectionPath>\n' +
      '  Rebuilds the <!-- BEGIN/END REFERENCES --> block in sectionPath/ROOM.md.\n' +
      '  Exit codes: 0=ok, 1=error, 2=ROOM.md not found.\n'
    );
    process.exit(1);
  }

  const sectionPath = path.resolve(args[0]);
  const result = recompile(sectionPath);
  if (result.success) {
    process.stdout.write(
      JSON.stringify({
        success: true,
        references_count: result.references_count,
        elapsed_ms: result.elapsed_ms,
      }) + '\n'
    );
    process.exit(0);
  }
  if (result.reason === 'no_room_md') {
    process.exit(2);
  }
  if (result.reason === 'mtime_conflict') {
    // Conflict detection is an expected outcome for manual edits; exit
    // 0 per PLAN <behavior> test 6 (the warning already went to stderr
    // inside recompile()).
    process.exit(0);
  }
  // Any other reason (io_error, lock_failed) is a real failure.
  process.exit(1);
}

if (require.main === module) {
  runCli(process.argv);
}

module.exports = {
  recompile: recompile,
  extractReferences: extractReferences,
  buildReferencesBlock: buildReferencesBlock,
  spliceReferencesBlock: spliceReferencesBlock,
  // Constants exported for tests / composition:
  BEGIN_MARKER: BEGIN_MARKER,
  END_MARKER: END_MARKER,
  RESERVED_FILES: RESERVED_FILES,
};
