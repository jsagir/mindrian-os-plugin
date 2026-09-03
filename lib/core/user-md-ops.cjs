#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 91-01 -- USER.md persistence + persona update-detect ops
 * ==============================================================
 * USER.md is a per-user, per-room artifact that holds the user's
 * canonical role, current Larry persona, journey stage, role-blend
 * weights, and supporting metadata. This module owns the read / write /
 * update-decide primitives.
 *
 * Three responsibilities, one entry point each:
 *
 *   readUserMd(path)
 *     Graceful-degradation read. null when absent, emptyUser() shell
 *     with parse_failed:true on malformed content, full struct when
 *     the file is well-formed. NEVER throws.
 *
 *   writeUserMdAtomic(path, data)
 *     Phase 87-02 atomic write pattern: openSync('wx') + writeSync +
 *     fsyncSync (best-effort) + closeSync + renameSync. Cleans up tmp
 *     on any error path. Preserves the user-authored body below the
 *     frontmatter delimiter.
 *
 *   detectPersonaUpdate({ current, signal })
 *     Pure function returning { shouldUpdate, reason } where reason is
 *     one of:
 *       'first_detection'              -- current === null
 *       'user_override'                -- signal.source === 'user_override'
 *       'no_change'                    -- signal.persona === current.persona
 *       'confidence_below_threshold'   -- signal.confidence < threshold
 *       'awaiting_consecutive_signal'  -- threshold met but < 3 consecutive
 *       'threshold_met'                -- threshold met + >= 3 consecutive
 *
 * Canon Part 8 posture:
 *   USER.md is a LOCAL artifact. This module never touches the network.
 *   Test 21 of lib/memory/user-md-persona.test.cjs grep-guards this
 *   module against Brain MCP query helpers, network primitives, http
 *   URL literals, and shell-out HTTP clients. Brain queries that carry
 *   persona MUST go through brain-derivation-prompts.cjs and carry only
 *   the Larry-or-Brain persona scalar (a generic framework handle),
 *   never the role_blend weights or user_id.
 *
 * Phase 87-02 atomic-write pattern source-of-truth:
 *   lib/core/decision-capture.cjs lines 320-380 (atomicRewriteMintoWith*)
 *   lib/core/write-lock.cjs (the openSync('wx') primitive proven under
 *   the 20-fork concurrency fence).
 *
 * Three-surface compatible (CLI hook, Desktop MCP handler, Cowork
 * shared runner). Pure CJS, node built-ins only, zero npm dependencies.
 *
 * License: BSL 1.1.
 */

const fs = require('node:fs');
const path = require('node:path');

const taxonomy = require('./persona-taxonomy.cjs');

const SCHEMA_VERSION = 1;
const DEFAULT_UPDATE_THRESHOLD = 0.75;
const CONSECUTIVE_SIGNAL_REQUIRED = 3;

// ---------- emptyUser shell ----------

/**
 * Build an empty USER.md struct. Used as the fallback shape when
 * USER.md is absent (caller wants a non-null default), as the parse
 * failure shape, and as the shell that writeUserMdAtomic merges into
 * before serializing.
 *
 * @returns {object} Empty user struct.
 */
function emptyUser() {
  return {
    schema_version: SCHEMA_VERSION,
    user_id: null,
    canonical_role: null,
    larry_persona: null,
    brain_persona: null,
    journey_stage: null,
    role_blend: {
      founder: 0,
      researcher: 0,
      operator: 0,
      investor: 0,
      mentor: 0,
      domain_expert: 0,
      student: 0,
    },
    problem_type: 'unknown',
    venture_stage: 'unknown',
    last_detected_at: null,
    last_updated_at: null,
    detection_confidence: 0.0,
    update_threshold: DEFAULT_UPDATE_THRESHOLD,
    consecutive_signal_count: 0,
    parse_failed: false,
    // Quick task 260612-t2k: marker any surface can show. Default false on
    // the normal path so the field exists and never reads as undefined; set
    // true only when readUserMd returns a navigator-set synthetic persona.
    override_active: false,
  };
}

// ---------- Narrow-dialect YAML scalar parser ----------
//
// Mirrors the dialect used in lib/core/folder-memory-shared.cjs
// parseBrainFrontmatter. Flat scalars only: strings, ints, floats,
// booleans, null. Single one-level-deep object support for role_blend.
// Duplicated here intentionally so user-md-ops keeps zero cross-import
// into folder-memory layers (flat dep graph).

function unquoteScalar(raw) {
  const s = raw.trim();
  if (s.length === 0) return '';
  if (s[0] === '"') {
    if (s.length < 2 || s[s.length - 1] !== '"') return undefined;
    return s.slice(1, -1);
  }
  if (s[0] === "'") {
    if (s.length < 2 || s[s.length - 1] !== "'") return undefined;
    return s.slice(1, -1);
  }
  return s;
}

function castScalar(s) {
  if (s === 'null' || s === '~') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+$/.test(s)) {
    const n = parseInt(s, 10);
    if (Number.isSafeInteger(n)) return n;
  }
  if (/^-?\d+\.\d+$/.test(s)) {
    const f = parseFloat(s);
    if (Number.isFinite(f)) return f;
  }
  return s;
}

function parseFrontmatter(src) {
  if (typeof src !== 'string' || src.length === 0) {
    return { ok: false };
  }
  const lines = src.split(/\r?\n/);
  const root = {};
  // role_blend is the only nested scalar map we know about. Track its
  // open block so we can absorb indented children.
  let inRoleBlend = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length === 0 || /^\s*$/.test(line) || /^\s*#/.test(line)) {
      continue;
    }
    // Indented child of role_blend?
    if (inRoleBlend && /^\s+/.test(line)) {
      const childMatch = line.match(/^\s+([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
      if (!childMatch) {
        return { ok: false };
      }
      const ck = childMatch[1];
      const cv = childMatch[2];
      if (cv.trim().length === 0) {
        root.role_blend[ck] = '';
        continue;
      }
      const rawC = unquoteScalar(cv);
      if (rawC === undefined) return { ok: false };
      root.role_blend[ck] = castScalar(rawC);
      continue;
    }
    // Flat top-level key: value. Closes any open block.
    inRoleBlend = false;
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):(.*)$/);
    if (!m) return { ok: false };
    const key = m[1];
    const rest = m[2];
    if (rest.trim().length === 0) {
      // Empty-RHS top-level key. role_blend is the known container; for
      // any other key treat as empty string scalar.
      if (key === 'role_blend') {
        root.role_blend = {};
        inRoleBlend = true;
      } else {
        root[key] = '';
      }
      continue;
    }
    const raw = unquoteScalar(rest);
    if (raw === undefined) return { ok: false };
    root[key] = castScalar(raw);
  }
  return { ok: true, data: root };
}

// ---------- readUserMd ----------

/**
 * Read and parse a USER.md file with graceful degradation.
 *
 * Precedence:
 *   1. USER.md absent / non-string / empty path  -> null
 *   2. Frontmatter delimiter missing             -> emptyUser + parse_failed:true
 *   3. Narrow-dialect YAML unparseable           -> emptyUser + parse_failed:true
 *   4. Read error (EACCES, etc.)                 -> emptyUser + parse_failed:true
 *   5. Valid                                     -> full struct, parse_failed:false
 *
 * Schema-tolerant validation: an unknown enum value (e.g. larry_persona
 * not in LARRY_PERSONAS) coerces that single field to null and leaves
 * parse_failed:false. The caller can distinguish "no persona detected
 * yet" from "the file is corrupted" without try/catch.
 *
 * NEVER throws.
 *
 * @param {string} userMdPath Absolute path to USER.md.
 * @param {object} [opts] Optional behavior flags.
 * @param {boolean} [opts.ignoreOverride] When true, skip the persona-override
 *   seam below and read the real on-disk file even while an override is
 *   active. Review finding WR-03 (267.2-REVIEW.md): a read-modify-write
 *   caller (identity.cjs's identity_write handler, first-install-router.cjs's
 *   _seedIdentityFile) must never merge a delta onto the override's synthetic
 *   struct and then persist that merge back to disk -- doing so silently
 *   resets every field the override does not carry. Display-time readers
 *   (session-register.cjs, the HMI renderers, etc.) want the override and
 *   must NOT pass this flag; only a caller that is about to WRITE the merged
 *   result back to userMdPath should.
 * @returns {object|null} User struct or null when path is absent.
 */
function readUserMd(userMdPath, opts) {
  const ignoreOverride = !!(opts && opts.ignoreOverride);
  // Quick task 260612-t2k -- override seam.
  // Consult the persona-override store BEFORE the path/stat logic. While an
  // override is active, EVERY caller (all ~9 persona readers funnel through
  // this one chokepoint) inherits the navigator-set synthetic persona, and
  // the real USER.md is ignored. The override store lives outside the
  // context window, so it survives maintenance commands (the /mos:doctor
  // failure that collapsed the persona in QA Report #1). The whole legacy
  // body below is the else-branch: with NO override active (or with
  // ignoreOverride:true, WR-03) this block falls through and readUserMd
  // stays byte-identical to its prior behavior. The override taxonomy
  // validation already happened in setOverride; here we only map fields onto
  // the emptyUser shell. NEVER break readUserMd: any failure in this block
  // falls through to the real file read.
  try {
    const personaOverride = require('./persona-override.cjs');
    const ov = ignoreOverride ? null : personaOverride.getOverride();
    if (ov) {
      const out = emptyUser();
      out.parse_failed = false;
      out.override_active = true;
      if (typeof ov.canonical_role === 'string') out.canonical_role = ov.canonical_role;
      if (typeof ov.journey_stage === 'string') out.journey_stage = ov.journey_stage;
      if (typeof ov.problem_type === 'string') out.problem_type = ov.problem_type;
      if (typeof ov.venture_stage === 'string') out.venture_stage = ov.venture_stage;
      if (ov.role_blend && typeof ov.role_blend === 'object') {
        for (const k of Object.keys(out.role_blend)) {
          if (typeof ov.role_blend[k] === 'number') out.role_blend[k] = ov.role_blend[k];
        }
      }
      return out;
    }
  } catch (_e) { /* fall through to the real file read - never break readUserMd */ }

  if (typeof userMdPath !== 'string' || userMdPath.length === 0) {
    return null;
  }
  let stat;
  try {
    stat = fs.statSync(userMdPath);
  } catch (_e) {
    return null; // absent
  }
  if (!stat.isFile()) return null;

  if (stat.size === 0) {
    const shell = emptyUser();
    shell.parse_failed = true;
    return shell;
  }

  let raw;
  try {
    raw = fs.readFileSync(userMdPath, 'utf8');
  } catch (_e) {
    const shell = emptyUser();
    shell.parse_failed = true;
    return shell;
  }

  const fmRe = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
  const m = raw.match(fmRe);
  if (!m) {
    const shell = emptyUser();
    shell.parse_failed = true;
    return shell;
  }

  const parsed = parseFrontmatter(m[1]);
  if (!parsed.ok) {
    const shell = emptyUser();
    shell.parse_failed = true;
    return shell;
  }
  const fm = parsed.data;

  const out = emptyUser();
  out.parse_failed = false;
  out.schema_version = typeof fm.schema_version === 'number'
    ? fm.schema_version : SCHEMA_VERSION;
  out.user_id = typeof fm.user_id === 'string' && fm.user_id.length > 0
    ? fm.user_id : null;
  out.canonical_role = typeof fm.canonical_role === 'string' && fm.canonical_role.length > 0
    ? fm.canonical_role : null;
  // Schema-tolerant enum coercion: invalid -> null, NOT parse_failed.
  if (typeof fm.larry_persona === 'string'
      && taxonomy.LARRY_PERSONAS.indexOf(fm.larry_persona) >= 0) {
    out.larry_persona = fm.larry_persona;
  } else {
    out.larry_persona = null;
  }
  if (typeof fm.brain_persona === 'string'
      && taxonomy.BRAIN_PERSONAS.indexOf(fm.brain_persona) >= 0) {
    out.brain_persona = fm.brain_persona;
  } else {
    out.brain_persona = null;
  }
  if (typeof fm.journey_stage === 'string'
      && taxonomy.JOURNEY_STAGES.indexOf(fm.journey_stage) >= 0) {
    out.journey_stage = fm.journey_stage;
  } else {
    out.journey_stage = null;
  }
  if (typeof fm.problem_type === 'string'
      && taxonomy.PROBLEM_TYPES.indexOf(fm.problem_type) >= 0) {
    out.problem_type = fm.problem_type;
  } else {
    out.problem_type = 'unknown';
  }
  if (typeof fm.venture_stage === 'string'
      && taxonomy.VENTURE_STAGES.indexOf(fm.venture_stage) >= 0) {
    out.venture_stage = fm.venture_stage;
  } else {
    out.venture_stage = 'unknown';
  }
  out.last_detected_at = typeof fm.last_detected_at === 'string'
      && fm.last_detected_at.length > 0
    ? fm.last_detected_at : null;
  out.last_updated_at = typeof fm.last_updated_at === 'string'
      && fm.last_updated_at.length > 0
    ? fm.last_updated_at : null;
  out.detection_confidence = typeof fm.detection_confidence === 'number'
    ? fm.detection_confidence : 0.0;
  out.update_threshold = typeof fm.update_threshold === 'number'
    ? fm.update_threshold : DEFAULT_UPDATE_THRESHOLD;
  out.consecutive_signal_count = typeof fm.consecutive_signal_count === 'number'
    ? fm.consecutive_signal_count : 0;
  // role_blend: inherit defaults, then overwrite per-axis from fm.
  if (fm.role_blend && typeof fm.role_blend === 'object') {
    const allowed = Object.keys(out.role_blend);
    for (const k of allowed) {
      if (typeof fm.role_blend[k] === 'number') {
        out.role_blend[k] = fm.role_blend[k];
      }
    }
  }
  return out;
}

// ---------- Frontmatter emitter ----------

function emitYamlScalar(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  // String. Quote if it could be misparsed as another type.
  const s = String(v);
  // Plain-scalar safe set: ASCII alnum, dash, underscore, slash, dot,
  // colon (for ISO timestamps), plus the +Z/T separators. Otherwise
  // round-trip through quotes.
  if (/^[A-Za-z0-9._/:+\- ]+$/.test(s) && s.length > 0
      && s !== 'true' && s !== 'false' && s !== 'null' && s !== '~') {
    return s;
  }
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function buildFrontmatter(data) {
  const merged = Object.assign(emptyUser(), data || {});
  // Re-merge role_blend separately so partial caller input does not
  // erase the empty-shell defaults.
  if (data && typeof data.role_blend === 'object' && data.role_blend !== null) {
    merged.role_blend = Object.assign(emptyUser().role_blend, data.role_blend);
  }
  const lines = ['---'];
  lines.push('schema_version: ' + emitYamlScalar(merged.schema_version));
  lines.push('user_id: ' + emitYamlScalar(merged.user_id));
  lines.push('canonical_role: ' + emitYamlScalar(merged.canonical_role));
  lines.push('larry_persona: ' + emitYamlScalar(merged.larry_persona));
  lines.push('brain_persona: ' + emitYamlScalar(merged.brain_persona));
  lines.push('journey_stage: ' + emitYamlScalar(merged.journey_stage));
  lines.push('role_blend:');
  const axes = ['founder', 'researcher', 'operator', 'investor',
    'mentor', 'domain_expert', 'student'];
  for (const k of axes) {
    const v = merged.role_blend[k];
    lines.push('  ' + k + ': ' + emitYamlScalar(typeof v === 'number' ? v : 0));
  }
  lines.push('problem_type: ' + emitYamlScalar(merged.problem_type));
  lines.push('venture_stage: ' + emitYamlScalar(merged.venture_stage));
  lines.push('last_detected_at: ' + emitYamlScalar(merged.last_detected_at));
  lines.push('last_updated_at: ' + emitYamlScalar(merged.last_updated_at));
  lines.push('detection_confidence: ' + emitYamlScalar(merged.detection_confidence));
  lines.push('update_threshold: ' + emitYamlScalar(merged.update_threshold));
  lines.push('consecutive_signal_count: ' + emitYamlScalar(merged.consecutive_signal_count));
  lines.push('---');
  return lines.join('\n');
}

// ---------- writeUserMdAtomic ----------

/**
 * Write USER.md atomically using the Phase 87-02 pattern.
 *
 * Sequence:
 *   1. Read existing USER.md body (if any) to preserve user-authored
 *      content below the frontmatter delimiter.
 *   2. Build new frontmatter from data merged into emptyUser() shell.
 *   3. Compose newContent = newFrontmatter + tail + preservedBody.
 *   4. Open tmp = path + '.tmp.<pid>.<rnd>.user' with openSync('wx')
 *      to fail-fast on stale tmp.
 *   5. writeSync newContent. fsyncSync best-effort (try/catch for
 *      ENOTSUP on tmpfs).
 *   6. closeSync.
 *   7. renameSync(tmp, path) -- atomic on POSIX + Windows-NTFS.
 *   8. On any error: unlink tmp + rethrow with descriptive message.
 *
 * The 'wx' flag plus per-pid + random tmp name makes mid-write crashes
 * recoverable (next call re-creates a fresh tmp).
 *
 * Production callers:
 *   - commands/new-project.md Step 5 (first production caller, Phase 155-03)
 *   - commands/onboard.md USER.md Generation section (Phase 155-03)
 *   - lib/core/navigation/room-birth.cjs STEP 1 (Phase 155-02)
 *
 * @param {string} userMdPath Absolute path to USER.md.
 * @param {object} data       Partial USER.md struct; merged into shell.
 * @returns {void}
 */
function writeUserMdAtomic(userMdPath, data) {
  if (typeof userMdPath !== 'string' || userMdPath.length === 0) {
    throw new Error('writeUserMdAtomic: userMdPath must be a non-empty string');
  }
  // Preserve any user-authored body below the existing frontmatter.
  let preservedBody = '\n# USER.md\n';
  try {
    const existing = fs.readFileSync(userMdPath, 'utf8');
    const fmRe = /^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/;
    const m = existing.match(fmRe);
    if (m && typeof m[1] === 'string') {
      preservedBody = m[1];
      // Ensure exactly one leading newline so the body starts on its
      // own line below the frontmatter close delimiter.
      if (preservedBody.length === 0 || preservedBody[0] !== '\n') {
        preservedBody = '\n' + preservedBody;
      }
    }
  } catch (_e) {
    // No existing file or unreadable. Use the default body shell.
  }

  const newFrontmatter = buildFrontmatter(data);
  const newContent = newFrontmatter + '\n' + preservedBody.replace(/^\n/, '\n');
  // ^ ensure exactly one '\n' between '---' and the body.

  // Per-pid + random tmp name. The 'wx' flag on openSync would otherwise
  // race with sibling writers in the same process if they shared a name.
  const rnd = Math.random().toString(36).slice(2, 10);
  const tmpPath = userMdPath + '.tmp.' + process.pid + '.' + rnd + '.user';

  let fd;
  try {
    fd = fs.openSync(tmpPath, 'wx');
  } catch (e) {
    if (e && e.code === 'EEXIST') {
      // Stale tmp from a prior crash on this exact pid+random slot.
      // Astronomically unlikely with random suffix, but be defensive.
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      fd = fs.openSync(tmpPath, 'wx');
    } else {
      throw e;
    }
  }
  try {
    fs.writeSync(fd, newContent);
    try { fs.fsyncSync(fd); } catch (_e) {
      // ENOTSUP on tmpfs / overlayfs / Windows ImDisk. Best-effort
      // durability is acceptable for USER.md (not load-bearing across
      // power loss; persona will re-detect on next session).
    }
  } finally {
    try { fs.closeSync(fd); } catch (_) {}
  }

  try {
    fs.renameSync(tmpPath, userMdPath);
  } catch (e) {
    try { fs.unlinkSync(tmpPath); } catch (_) {}
    throw e;
  }
}

// ---------- detectPersonaUpdate ----------

/**
 * Decide whether a new persona signal should overwrite the current
 * USER.md persona.
 *
 * The decision tree is deliberately ordered for early-exit + low-noise
 * behavior:
 *
 *   1. current === null              -> 'first_detection' (always update)
 *   2. signal.source === 'user_*'    -> 'user_override' (bypass threshold)
 *   3. signal.persona === current    -> 'no_change' (no rewrite)
 *   4. confidence < update_threshold -> 'confidence_below_threshold'
 *   5. consecutive < 3               -> 'awaiting_consecutive_signal'
 *   6. consecutive >= 3              -> 'threshold_met' (update)
 *
 * Caller is responsible for incrementing consecutive_signal_count; this
 * function reads the count off `signal` so the caller controls the
 * window definition (per-turn vs per-session vs per-window).
 *
 * @param {object} args
 * @param {object|null} args.current Current USER.md persona struct or null.
 * @param {object} args.signal      New persona detection signal.
 * @returns {{shouldUpdate: boolean, reason: string}}
 */
function detectPersonaUpdate(args) {
  const current = (args && args.current) || null;
  const signal = (args && args.signal) || {};

  if (current === null) {
    return { shouldUpdate: true, reason: 'first_detection' };
  }
  if (signal.source === 'user_override') {
    return { shouldUpdate: true, reason: 'user_override' };
  }
  if (signal.persona === current.persona) {
    return { shouldUpdate: false, reason: 'no_change' };
  }
  const threshold = typeof current.update_threshold === 'number'
    ? current.update_threshold
    : DEFAULT_UPDATE_THRESHOLD;
  const conf = typeof signal.confidence === 'number' ? signal.confidence : 0.0;
  if (conf < threshold) {
    return { shouldUpdate: false, reason: 'confidence_below_threshold' };
  }
  const consec = typeof signal.consecutive_signal_count === 'number'
    ? signal.consecutive_signal_count : 0;
  if (consec < CONSECUTIVE_SIGNAL_REQUIRED) {
    return { shouldUpdate: false, reason: 'awaiting_consecutive_signal' };
  }
  return { shouldUpdate: true, reason: 'threshold_met' };
}

module.exports = {
  emptyUser,
  readUserMd,
  writeUserMdAtomic,
  detectPersonaUpdate,
  // Constants exposed for callers that want to honor the same defaults.
  DEFAULT_UPDATE_THRESHOLD,
  CONSECUTIVE_SIGNAL_REQUIRED,
  SCHEMA_VERSION,
};
