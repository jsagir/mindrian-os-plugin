'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * lib/hmi/voice-style-log.cjs -- Phase 298-07 (R-08, rung 2: LOGGED)
 * =====================================================================
 * WHAT IT IS: the append-only evidence log for the voice policies (currently
 * `voice-hyphens-only` and `voice-glyph-present`). Rung 2 of the harness's
 * three-rung ladder (declared -> LOGGED -> blocking) means a violation is
 * recorded, never enforced. `scripts/check-voice-style.cjs` is the sole
 * writer; a human, or `evaluatePromotion` (plan 298-08), is the sole reader
 * that matters for a promotion decision.
 *
 * ROW SHAPE, exactly these keys in this order: `ts` (epoch ms, the freshness
 * key a doctor module reads, mirroring `card-fire-health-module.cjs:79`),
 * `timestamp` (ISO string), `policy_id`, `version` (from
 * `lib/core/repo-version.cjs::readRepoVersion()`, or the string `unknown` if
 * that call fails), `result` (`fire` on write; a human later relabels a row
 * to `true_positive` or `false_positive`), `detail` (a capped excerpt, never
 * a whole turn), `session_id`.
 *
 * RETENTION DECISION (Pitfall 4, `298-RESEARCH.md`): this log carries no
 * time-based TTL of any kind. A `promotion_rule` names a `window_runs`
 * measured in RELEASES (e.g. 200 runs across a multi-week promotion
 * window). Card-fire's own 24-hour age-based eviction
 * (`scripts/check-card-fire.cjs:244`) prunes on every write -- copying that
 * here would silently evict evidence before a multi-release promotion
 * window could ever see it, making the `promotion_rule` structurally
 * unsatisfiable. This log is instead rotated by SIZE ONLY (see
 * ROTATE_THRESHOLD_BYTES below), never by age.
 *
 * APPEND-ONLY (not read-prune-rewrite): `appendVoiceStyleRow` always
 * `fs.appendFileSync`s one line. It never reads the whole file back in order
 * to rewrite it (contrast `card-fire`'s `appendInterceptLog`, which DOES
 * read-prune-rewrite for its own age-based eviction). A rewrite would
 * clobber a human's `result` relabelling the moment the next Stop hook
 * fires -- append-only is what makes that relabelling survive.
 *
 * Canon Part 8 (Graph Boundary): this module does LOCAL FILE WRITES ONLY,
 * under `$MINDRIAN_HOME` (default `~/.mindrian`). It never makes a network
 * call and never egresses anything. `detail` is capped (VOICE_STYLE_DETAIL_CAP
 * below) rather than storing a whole turn, so an untrusted model turn cannot
 * write an unbounded amount of its own text to local disk.
 *
 * NEVER-BLOCK CONTRACT: a diagnostic log write must NEVER block or throw the
 * Stop hook that calls it. Every exported write path is wrapped in a
 * swallow-all try/catch; every exported read path degrades to an empty
 * array rather than throwing. Both return plain values (never a rejected
 * promise, never a thrown error) so a caller never needs its own wrapper.
 *
 * `evaluatePromotion` is NOT written here. Plan 298-08 adds it to this file
 * and adds its assertions to `tests/test-298-voice-log.cjs`.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// VOICE_STYLE_DETAIL_CAP: the `detail` field is a short excerpt plus an
// offset, never a whole turn (Canon Part 8, T-298-02 information-disclosure
// mitigation). Follows card-fire's INTERCEPT_LOG_TEXT_CAP precedent
// (scripts/check-card-fire.cjs:251), sized smaller since `detail` is a
// diagnostic excerpt, not the whole captured turn text.
const VOICE_STYLE_DETAIL_CAP = 500;

// ROTATE_THRESHOLD_BYTES: when voice-style.jsonl exceeds this size, it is
// renamed to voice-style.jsonl.1 (overwriting any prior .1) before the new
// row is appended to a fresh file. SIZE-based only, never time-based (see
// the retention decision above) -- 5 MiB comfortably holds many thousands
// of rows before rotation, and rotation never deletes evidence outright,
// it only moves the older half out of the active file.
const ROTATE_THRESHOLD_BYTES = 5 * 1024 * 1024;

// mindrianHome() / voiceStyleLogPath() -- the MINDRIAN_HOME resolver,
// inlined exactly as the four shipped sites do (lib/core/doctor/card-fire-
// health-module.cjs:41-46 is the canonical one). Exported for hermetic
// tests so tests/test-298-voice-log.cjs can point MINDRIAN_HOME at a
// scratch directory and never touch the real ~/.mindrian.
function mindrianHome() {
  return process.env.MINDRIAN_HOME || path.join(os.homedir(), '.mindrian');
}
function voiceStyleLogPath() {
  return path.join(mindrianHome(), 'voice-style.jsonl');
}

// resolveVersion() -- best-effort read of the repo version stamp. Never
// throws; a failed read (e.g. this module running from a worktree checkout
// that repo-version.cjs itself refuses, per its own contamination guard)
// writes the string 'unknown' rather than blocking the log write.
function resolveVersion() {
  try {
    // Lazy require: keeps this module loadable even in a context where
    // repo-version.cjs's own root-resolution would throw (e.g. a scratch
    // test directory with no plugin.json/package.json pair).
    const { readRepoVersion } = require('../core/repo-version.cjs');
    const result = readRepoVersion();
    return typeof result.version === 'string' ? result.version : 'unknown';
  } catch (_e) {
    return 'unknown';
  }
}

// rotateIfNeeded(fp) -- size-based rotation only (never time-based). Renames
// the current log to `<fp>.1` (overwriting any prior `.1`) when it exceeds
// ROTATE_THRESHOLD_BYTES, immediately before the new row is appended. Best-
// effort: any rotation failure is swallowed and the write proceeds against
// the (possibly oversized) existing file rather than blocking the hook.
function rotateIfNeeded(fp) {
  try {
    const st = fs.statSync(fp);
    if (st.size >= ROTATE_THRESHOLD_BYTES) {
      fs.renameSync(fp, fp + '.1');
    }
  } catch (_e) {
    /* missing file (nothing to rotate) or a rename fault; either way, proceed */
  }
}

// appendVoiceStyleRow(row) -- fills defaults, ensures the home directory
// exists, rotates by size if needed, then appends exactly one JSONL line.
// Never throws (a diagnostic write must never block the calling Stop hook).
// Returns true on a successful append, false on any failure (for testability
// only -- no caller is required to check the return value).
function appendVoiceStyleRow(row) {
  try {
    const r = row && typeof row === 'object' ? row : {};
    const now = Date.now();
    const detail = typeof r.detail === 'string' ? r.detail.slice(0, VOICE_STYLE_DETAIL_CAP) : '';
    const record = {
      ts: now,
      timestamp: new Date(now).toISOString(),
      policy_id: typeof r.policy_id === 'string' ? r.policy_id : '',
      version: resolveVersion(),
      result: typeof r.result === 'string' ? r.result : 'fire',
      detail: detail,
      session_id: typeof r.session_id === 'string' ? r.session_id : '',
    };
    const fp = voiceStyleLogPath();
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    rotateIfNeeded(fp);
    fs.appendFileSync(fp, JSON.stringify(record) + '\n', 'utf8');
    return true;
  } catch (_e) {
    // Swallow-all: a diagnostic write must never block or throw the hook.
    return false;
  }
}

// readVoiceStyleRows(logPathOrNull) -- reads the log (or the given path, the
// hermetic-test seam), splitting on newlines and JSON.parsing each line. A
// malformed line is dropped; the surrounding rows still parse. A missing
// file returns an empty array. Never throws.
function readVoiceStyleRows(logPathOrNull) {
  const fp = typeof logPathOrNull === 'string' ? logPathOrNull : voiceStyleLogPath();
  const out = [];
  try {
    const raw = fs.readFileSync(fp, 'utf8');
    const lines = raw.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        out.push(JSON.parse(trimmed));
      } catch (_eLine) {
        continue; // drop the malformed line, never throw
      }
    }
  } catch (_e) {
    /* missing / unreadable log -> empty array */
  }
  return out;
}

module.exports = {
  appendVoiceStyleRow,
  readVoiceStyleRows,
  VOICE_STYLE_DETAIL_CAP,
  ROTATE_THRESHOLD_BYTES,
  // exported for hermetic tests:
  mindrianHome,
  voiceStyleLogPath,
};
