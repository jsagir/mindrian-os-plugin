'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * lib/core/state-version.cjs -- preserve-or-notify persistence for the
 * per-room STATE.md.
 *
 * Phase 240.1 Plan 02 (CTXL-01). scripts/compute-state renders a fresh
 * frontmatter block and every current caller blind-overwrites the room's
 * STATE.md with it, destroying the gsd_state_version stamp that
 * scripts/room-registry:127-131 seeds at room birth
 * (240.1-RESEARCH.md Finding 1B, empirically reproduced). This module is the
 * write-path replacement every STATE.md write site must call:
 * read-before-write, classify the on-disk version, then either refuse
 * (future), preserve byte-identically (current), or stamp forward
 * (absent/legacy).
 *
 * Ported structurally from lib/core/install-state.cjs:184-231's
 * migrateIfNeeded four-branch contract (the same shape, for a different
 * artifact). Do NOT re-derive version-mismatch semantics; this repo already
 * has them.
 *
 * Two exported version constants, and why there are two: STATE_SCHEMA_VERSION
 * (a number, 1) is the numeric comparison authority, mirroring
 * install-state.cjs:54's SCHEMA_VERSION idiom. STATE_SCHEMA_VERSION_LITERAL
 * (a string, '1.0') is the emitted rendering, kept byte-identical to what
 * scripts/room-registry:130 writes. String(1.0) in JavaScript is '1', so
 * using the number for rendering would silently rewrite '1.0' to '1' -- a new
 * drift introduced by the fix itself. The literal exists precisely to avoid
 * that.
 *
 * PRESERVED_KEYS is exactly ['gsd_state_version', 'status']. It MUST NOT
 * include 'current_room'. scripts/compute-state:29-45 deliberately
 * RE-DERIVES current_room from the room registry and emits the line ONLY for
 * the registry-active room, so a parked room gains no line ("this never
 * bulk-backfills the existing rooms"). If persistState preserved
 * current_room, every parked room would resurrect a stale active-room marker
 * on its next regeneration, and the no-backfill contract that
 * lib/memory/statusline-active-room-write.test.cjs test 6 pins would break in
 * production (CORRECTION B, 240.1-02-PLAN.md). A future reader must not
 * "helpfully" add current_room to this list.
 *
 * Why the existing frontmatter-schema-validator.cjs notification surface
 * could not simply be reused: hooks/hooks.json:258-263 registers
 * frontmatter-schema-validator.cjs on the matcher Write|Edit|MultiEdit, which
 * fires only on CLAUDE TOOL CALLS. Every STATE.md write site is a
 * programmatic fs.writeFileSync or a shell redirect, never a Claude tool
 * call. The existing surface is structurally blind to the writer that causes
 * the drift (240.1-RESEARCH.md Finding 1E). This module reuses the LOG SINK
 * shape and the ADVISORY SEMANTICS from that validator and does not attempt
 * to route detection through the PostToolUse hook.
 *
 * The write itself is ATOMIC: same-dir tmp plus fs.renameSync, the idiom from
 * lib/core/room-skeleton-scaffold.cjs:90 (atomicWrite is not exported by that
 * module, so the identical shape is re-implemented here rather than adding a
 * cross-module dependency). The read-then-write version compare opens a
 * TOCTOU window (Security Domain T-240.1-05); tmp-and-rename is the in-repo
 * mitigation, matching the compare-then-write race every other SCHEMA_VERSION
 * consumer in this repo already accepts as its baseline.
 *
 * Never-throw envelope: persistState never propagates an exception. A throw
 * inside hook-adjacent code (on-stop, on-task-complete, on-agent-complete)
 * would break Larry's turn on all three surfaces (Security Domain T-240.1-06).
 * The counter-lesson is lib/core/navigation/room-birth.cjs:992-995's bare
 * catch (_e) with a "Tolerate" comment, which is why that site's compute-state
 * call has never once succeeded -- a soft failure must still WRITE A LINE,
 * never swallow silently.
 *
 * Canon Part 8: LOCAL files only. Zero network calls. Zero Brain queries.
 * CJS, node built-ins only, zero new dependencies, no YAML dependency
 * (Security Domain V5).
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const STATE_SCHEMA_VERSION = 1;
const STATE_SCHEMA_VERSION_LITERAL = '1.0';

const PRESERVED_KEYS = Object.freeze(['gsd_state_version', 'status']);

/**
 * readStateFrontmatter(roomDir) -> { present, keys, raw }
 *
 * Line-walk frontmatter parser, mirroring the dialect used in
 * scripts/frontmatter-schema-validator.cjs: split on the leading `---` fence,
 * walk lines, split each on the FIRST colon, trim. No YAML dependency; this
 * repo does not carry one and this module does not add one.
 *
 * Returns { present: false, keys: {}, raw: null } for:
 *   - an absent STATE.md,
 *   - an unparseable STATE.md (no closing `---` fence),
 *   - an EMPTY STATE.md (zero bytes).
 * The empty case is load-bearing: scripts/on-agent-complete:133 truncates
 * STATE.md to zero BEFORE compute-state runs (240.1-RESEARCH.md Pitfall 3),
 * so an empty read is a real and expected input, not a corruption signal.
 */
function readStateFrontmatter(roomDir) {
  const empty = { present: false, keys: {}, raw: null };
  const statePath = path.join(roomDir, 'STATE.md');
  let content;
  try {
    content = fs.readFileSync(statePath, 'utf8');
  } catch (_e) {
    return empty;
  }
  if (typeof content !== 'string' || content.length === 0) {
    return empty;
  }
  const lines = content.split(/\r?\n/);
  if (lines[0] !== '---') {
    return empty;
  }
  const keys = {};
  let closed = false;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i] === '---') {
      closed = true;
      break;
    }
    const idx = lines[i].indexOf(':');
    if (idx === -1) continue; // skip malformed/non-key-value lines, do not abort
    const key = lines[i].slice(0, idx).trim();
    const value = lines[i].slice(idx + 1).trim();
    if (key.length > 0) keys[key] = value;
  }
  if (!closed) {
    return empty;
  }
  return { present: true, keys, raw: content };
}

/**
 * classifyVersion(value) -> 'absent' | 'current' | 'future' | 'legacy'
 *
 * Parsed with parseFloat so both '1' and '1.0' compare equal to
 * STATE_SCHEMA_VERSION. Mapping:
 *   undefined or null                          -> 'absent'
 *   NaN, or a value below STATE_SCHEMA_VERSION  -> 'legacy'
 *   equal to STATE_SCHEMA_VERSION               -> 'current'
 *   greater than STATE_SCHEMA_VERSION           -> 'future'
 * The NaN branch is the install-state.cjs lower-than-v1 safety net, ported
 * here for any hand-edited or corrupt version value: coerce forward, never
 * throw.
 */
function classifyVersion(value) {
  if (value === undefined || value === null) {
    return 'absent';
  }
  const n = parseFloat(value);
  if (Number.isNaN(n)) {
    return 'legacy';
  }
  if (n < STATE_SCHEMA_VERSION) {
    return 'legacy';
  }
  if (n === STATE_SCHEMA_VERSION) {
    return 'current';
  }
  return 'future';
}

/**
 * spliceFrontmatterKeys(rendered, keys) -> string
 *
 * Insert each key present in `keys` (an object of key -> emitted-value
 * string), in PRESERVED_KEYS order, immediately after the opening `---` of
 * `rendered`. A key already present in `rendered`'s own frontmatter block is
 * SKIPPED, so a future change to scripts/compute-state emitting one of these
 * keys itself cannot produce a duplicate. If `rendered` has no opening `---`
 * fence, it is returned UNCHANGED and the caller is left to record the
 * anomaly (this module does not invent a frontmatter block for a renderer
 * that did not emit one).
 */
function spliceFrontmatterKeys(rendered, keys) {
  if (typeof rendered !== 'string') {
    return rendered;
  }
  const lines = rendered.split(/\r?\n/);
  if (lines[0] !== '---') {
    return rendered;
  }
  const existingKeys = new Set();
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i] === '---') break;
    const idx = lines[i].indexOf(':');
    if (idx !== -1) existingKeys.add(lines[i].slice(0, idx).trim());
  }
  const source = keys || {};
  const toInsert = [];
  for (const key of PRESERVED_KEYS) {
    if (Object.prototype.hasOwnProperty.call(source, key) && !existingKeys.has(key)) {
      toInsert.push(key + ': ' + source[key]);
    }
  }
  if (toInsert.length === 0) {
    return rendered;
  }
  lines.splice(1, 0, ...toInsert);
  return lines.join('\n');
}

/**
 * Atomic write: same-dir tmp plus fs.renameSync. Mirrors
 * lib/core/room-skeleton-scaffold.cjs:90's atomicWrite (not exported by that
 * module; the identical shape is re-implemented here). The tmp path includes
 * pid + a random suffix so concurrent invocations do not collide.
 */
function _atomicWrite(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = filePath + '.tmp.' + process.pid + '.' + Math.random().toString(36).slice(2, 10);
  fs.writeFileSync(tmpPath, content, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

/**
 * Resolve the violations JSONL sink path. Verbatim shape from
 * scripts/frontmatter-schema-validator.cjs:197-206 (that file has no
 * module.exports, so it cannot be required; the shape is deliberately
 * duplicated here so /mos:doctor --acceptance and /mos:admin pick up this
 * module's violations with no new surface, per Canon Part 7).
 */
function _resolveLogPath() {
  const envDir = process.env.CLAUDE_PLUGIN_DATA;
  if (envDir && typeof envDir === 'string' && envDir.length > 0) {
    return path.join(envDir, 'schema-violations.jsonl');
  }
  const home = process.env.HOME || os.homedir();
  if (!home) return null;
  return path.join(home, '.mindrian', 'schema-violations.jsonl');
}

/**
 * Append one JSON line to the violations log. Soft-fail wrapped, matching
 * scripts/frontmatter-schema-validator.cjs:207-219. The entry carries only
 * `file`, `onDiskVersion`, `moduleVersion`, `kind`, and an ISO timestamp --
 * never file body, never room content (Security Domain T-240.1-07).
 */
function _appendStateVersionViolation(entry) {
  const logPath = _resolveLogPath();
  if (!logPath) return;
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, JSON.stringify(entry) + '\n', { encoding: 'utf8' });
  } catch (_e) { /* soft-fail, matching the source idiom */ }
}

/**
 * persistState(roomDir, rendered, opts) -> {
 *   status: 'ok' | 'version-mismatch' | 'error',
 *   ...
 * }
 *
 * The four-branch contract, ported structurally from
 * install-state.cjs:184-214:
 *
 *   'future'          -> DO NOT WRITE. Notify (JSONL sink + one stderr line).
 *                         Return { status: 'version-mismatch', onDiskVersion,
 *                         moduleVersion, written: false,
 *                         advice: 'run /mos:doctor --fix' }. This IS
 *                         CTXL-01's success criterion: detect mismatch,
 *                         notify, refuse to overwrite.
 *   'current'         -> Preserve. Re-emit the on-disk RAW literal
 *                         byte-for-byte (so '1.0' stays '1.0', never
 *                         re-rendered through the number), splice `status` if
 *                         the prior file carried one, write. Return
 *                         { status: 'ok', classification: 'current',
 *                         stamped: false }.
 *   'absent'/'legacy' -> Stamp forward using STATE_SCHEMA_VERSION_LITERAL,
 *                         preserve `status` if present, write. Return
 *                         { status: 'ok', classification, stamped: true }.
 *   any thrown error  -> Return { status: 'error', message }. Write one line
 *                         to stderr. NEVER throw and NEVER swallow silently.
 *
 * `path.resolve` is applied to `roomDir` before any join, so a caller-
 * supplied filename component can never redirect the write target
 * (Security Domain T-240.1-04).
 */
function persistState(roomDir, rendered, _opts) {
  try {
    const resolved = path.resolve(roomDir);
    const statePath = path.join(resolved, 'STATE.md');
    const prior = readStateFrontmatter(resolved);
    const onDiskVersion = prior.keys.gsd_state_version;
    const classification = classifyVersion(onDiskVersion);

    if (classification === 'future') {
      const moduleVersion = STATE_SCHEMA_VERSION;
      _appendStateVersionViolation({
        kind: 'state-version-mismatch',
        file: statePath,
        onDiskVersion,
        moduleVersion,
        timestamp: new Date().toISOString(),
      });
      process.stderr.write(
        '[state-version] on-disk gsd_state_version ' + onDiskVersion
          + ' is newer than this plugin understands (' + moduleVersion
          + '). Skipping write; run /mos:doctor --fix.\n'
      );
      return {
        status: 'version-mismatch',
        onDiskVersion,
        moduleVersion,
        written: false,
        advice: 'run /mos:doctor --fix',
      };
    }

    const spliceMap = {};
    let stamped;
    if (classification === 'current') {
      // Re-emit the RAW on-disk literal byte-for-byte -- never re-derive it
      // from the numeric authority, which would silently rewrite '1.0' to '1'.
      spliceMap.gsd_state_version = onDiskVersion;
      stamped = false;
    } else {
      // 'absent' or 'legacy' -> stamp forward with the canonical literal.
      spliceMap.gsd_state_version = STATE_SCHEMA_VERSION_LITERAL;
      stamped = true;
    }
    if (Object.prototype.hasOwnProperty.call(prior.keys, 'status')) {
      spliceMap.status = prior.keys.status;
    }

    const toWrite = spliceFrontmatterKeys(rendered, spliceMap);
    _atomicWrite(statePath, toWrite);

    return { status: 'ok', classification, stamped };
  } catch (e) {
    try {
      process.stderr.write(
        '[state-version] persistState error: ' + (e && e.message ? e.message : String(e)) + '\n'
      );
    } catch (_e2) { /* stderr itself failing is not this function's problem */ }
    return { status: 'error', message: e && e.message ? e.message : String(e) };
  }
}

module.exports = {
  persistState,
  readStateFrontmatter,
  classifyVersion,
  spliceFrontmatterKeys,
  STATE_SCHEMA_VERSION,
  STATE_SCHEMA_VERSION_LITERAL,
  PRESERVED_KEYS,
};
