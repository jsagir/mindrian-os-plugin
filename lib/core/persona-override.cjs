#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick task 260612-t2k -- persona override (identity-only) store
 * ==============================================================
 * The store that backs the readUserMd override seam. A navigator can
 * declare a synthetic persona (role_blend / canonical_role /
 * journey_stage / problem_type / venture_stage) that survives
 * auto-detection AND maintenance commands (the /mos:doctor failure that
 * collapsed the persona in QA Report #1). The override lives OUTSIDE the
 * context window in a sentinel file, so it persists across turns and
 * process restarts until explicitly cleared.
 *
 * Store location:
 *   ~/.mindrian/persona-override.json (global, room-agnostic).
 *   MINDRIAN_PERSONA_OVERRIDE_PATH env var overrides the path so tests
 *   NEVER touch the real user file.
 *
 * Exports:
 *   getOverride()    -> parsed override object or null (any failure -> null).
 *   setOverride(p)   -> validate against persona-taxonomy.cjs, stamp set_at,
 *                       atomic write, return the written object.
 *   clearOverride()  -> idempotent delete of the store file.
 *   isActive()       -> getOverride() !== null.
 *
 * CLI entry (require.main === module):
 *   node lib/core/persona-override.cjs <set <role>|set-blend <json>|clear|status>
 *
 * Canon Part 8 posture:
 *   The override is LOCAL only. This module makes ZERO network or remote
 *   methodology calls; the boundary-scan grep over network primitives and
 *   remote-host literals MUST return zero matches against this file. A
 *   navigator-set persona is navigator-confirmed (legitimate per Canon
 *   Part 9 role 5).
 *
 * Canon Part 9 posture:
 *   The override is an identity declaration the human made explicitly; it
 *   is graph-local working memory, never egressed.
 *
 * Graceful by construction: a missing / malformed / unreadable store
 * returns null. Every code path is non-throwing; the CLI exits 0 on every
 * branch (never crash).
 *
 * Pure CJS, node built-ins + persona-taxonomy.cjs only. No npm deps.
 *
 * License: BSL 1.1.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const taxonomy = require('./persona-taxonomy.cjs');

// ---------- Store path resolution ----------

/**
 * Resolve the override store path. The env var wins so tests can point at
 * a temp file and never touch the real ~/.mindrian/persona-override.json.
 *
 * @returns {string} Absolute path to the override store.
 */
function storePath() {
  const env = process.env.MINDRIAN_PERSONA_OVERRIDE_PATH;
  if (typeof env === 'string' && env.length > 0) {
    return env;
  }
  return path.join(os.homedir(), '.mindrian', 'persona-override.json');
}

// ---------- Validation tables (derived from persona-taxonomy.cjs) ----------

// The 7 role_blend keys readUserMd / emptyUser use are lowercase
// snake_case. persona-taxonomy.ROLE_BLEND_AXES carries the display form
// ('Founder', 'Domain Expert', ...). Map display -> store key so a
// navigator can pass either form and we coerce to the 7 known keys.
const ROLE_BLEND_KEYS = Object.freeze([
  'founder',
  'researcher',
  'operator',
  'investor',
  'mentor',
  'domain_expert',
  'student',
]);

function normalizeRoleKey(k) {
  if (typeof k !== 'string') return null;
  const key = k.trim().toLowerCase().replace(/\s+/g, '_');
  return ROLE_BLEND_KEYS.indexOf(key) >= 0 ? key : null;
}

// ---------- getOverride ----------

/**
 * Read and parse the override store with graceful degradation.
 *
 * @returns {object|null} The parsed override object, or null when the
 *   store is absent / unreadable / malformed.
 */
function getOverride() {
  const p = storePath();
  let raw;
  try {
    raw = fs.readFileSync(p, 'utf8');
  } catch (_e) {
    return null; // absent or unreadable
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_e) {
    return null; // malformed JSON
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }
  return parsed;
}

// ---------- setOverride ----------

/**
 * Validate a partial persona declaration, stamp set_at, and atomically
 * write the store. Unknown roles / stages / problem-types / venture-stages
 * are dropped. role_blend is coerced to the 7 known keys with numeric
 * weights only.
 *
 * @param {object} partial Persona declaration.
 * @returns {object} The written override object.
 */
function setOverride(partial) {
  const src = (partial && typeof partial === 'object') ? partial : {};
  const out = {};

  if (typeof src.canonical_role === 'string' && src.canonical_role.length > 0) {
    out.canonical_role = src.canonical_role;
  }
  if (typeof src.journey_stage === 'string'
      && taxonomy.JOURNEY_STAGES.indexOf(src.journey_stage) >= 0) {
    out.journey_stage = src.journey_stage;
  }
  if (typeof src.problem_type === 'string'
      && taxonomy.PROBLEM_TYPES.indexOf(src.problem_type) >= 0) {
    out.problem_type = src.problem_type;
  }
  if (typeof src.venture_stage === 'string'
      && taxonomy.VENTURE_STAGES.indexOf(src.venture_stage) >= 0) {
    out.venture_stage = src.venture_stage;
  }
  if (src.role_blend && typeof src.role_blend === 'object'
      && !Array.isArray(src.role_blend)) {
    const blend = {};
    for (const rawKey of Object.keys(src.role_blend)) {
      const key = normalizeRoleKey(rawKey);
      if (key === null) continue;
      const w = src.role_blend[rawKey];
      if (typeof w === 'number' && Number.isFinite(w)) {
        blend[key] = w;
      }
    }
    if (Object.keys(blend).length > 0) {
      out.role_blend = blend;
    }
  }

  out.set_at = new Date().toISOString();

  writeStoreAtomic(out);
  return out;
}

/**
 * Atomically write the override object to the store path. tmp + rename.
 * Creates the parent directory when absent. Best-effort; throws only on a
 * genuinely unrecoverable filesystem error (callers at the CLI surface
 * catch and exit 0).
 *
 * @param {object} obj The override object to persist.
 * @returns {void}
 */
function writeStoreAtomic(obj) {
  const p = storePath();
  const dir = path.dirname(p);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (_e) {
    // Directory may already exist or be uncreatable; the openSync below
    // surfaces the real error if it matters.
  }
  const rnd = Math.random().toString(36).slice(2, 10);
  const tmpPath = p + '.tmp.' + process.pid + '.' + rnd + '.po';
  const content = JSON.stringify(obj, null, 2) + '\n';
  let fd;
  try {
    fd = fs.openSync(tmpPath, 'wx');
  } catch (e) {
    if (e && e.code === 'EEXIST') {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      fd = fs.openSync(tmpPath, 'wx');
    } else {
      throw e;
    }
  }
  try {
    fs.writeSync(fd, content);
    try { fs.fsyncSync(fd); } catch (_e) { /* ENOTSUP on tmpfs; best-effort */ }
  } finally {
    try { fs.closeSync(fd); } catch (_) {}
  }
  try {
    fs.renameSync(tmpPath, p);
  } catch (e) {
    try { fs.unlinkSync(tmpPath); } catch (_) {}
    throw e;
  }
}

// ---------- clearOverride ----------

/**
 * Delete the override store. Idempotent: no error when the file is absent.
 *
 * @returns {void}
 */
function clearOverride() {
  const p = storePath();
  try {
    fs.unlinkSync(p);
  } catch (_e) {
    // Absent or unremovable; clearing an absent override is a no-op.
  }
}

// ---------- isActive ----------

/**
 * @returns {boolean} True when an override is currently active.
 */
function isActive() {
  return getOverride() !== null;
}

module.exports = {
  getOverride,
  setOverride,
  clearOverride,
  isActive,
  ROLE_BLEND_KEYS,
};

// ---------- CLI entry ----------

/**
 * CLI surface for the activation surface and tests. Exit 0 on every path;
 * never crash.
 *
 *   node lib/core/persona-override.cjs set <role>
 *   node lib/core/persona-override.cjs set-blend <json>
 *   node lib/core/persona-override.cjs clear
 *   node lib/core/persona-override.cjs status
 */
function runCli(argv) {
  const cmd = argv[0];
  try {
    if (cmd === 'set') {
      const role = argv[1];
      if (typeof role !== 'string' || role.length === 0) {
        process.stdout.write('usage: persona-override.cjs set <role>\n');
        return 0;
      }
      // set <role> -> canonical_role + a 1.0 role_blend on that role (when
      // the role maps to one of the 7 known blend keys).
      const decl = { canonical_role: role };
      const blendKey = normalizeRoleKey(role);
      if (blendKey !== null) {
        decl.role_blend = {};
        decl.role_blend[blendKey] = 1.0;
      }
      const written = setOverride(decl);
      process.stdout.write(JSON.stringify(written, null, 2) + '\n');
      return 0;
    }
    if (cmd === 'set-blend') {
      const jsonArg = argv[1];
      let decl = {};
      try {
        decl = JSON.parse(jsonArg);
      } catch (_e) {
        process.stdout.write('error: set-blend expects a JSON object argument\n');
        return 0;
      }
      const written = setOverride(decl);
      process.stdout.write(JSON.stringify(written, null, 2) + '\n');
      return 0;
    }
    if (cmd === 'clear') {
      clearOverride();
      process.stdout.write('cleared\n');
      return 0;
    }
    if (cmd === 'status') {
      const ov = getOverride();
      if (ov === null) {
        process.stdout.write('none\n');
      } else {
        process.stdout.write(JSON.stringify(ov, null, 2) + '\n');
      }
      return 0;
    }
    process.stdout.write(
      'usage: persona-override.cjs <set <role>|set-blend <json>|clear|status>\n'
    );
    return 0;
  } catch (_e) {
    // Never crash. Report and exit 0.
    process.stdout.write('error: ' + (_e && _e.message ? _e.message : 'unknown') + '\n');
    return 0;
  }
}

if (require.main === module) {
  process.exit(runCli(process.argv.slice(2)));
}
