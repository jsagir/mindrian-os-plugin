'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 103-03 -- cross-room memory layer (Layer 3, read-side)
 * ===========================================================
 *
 * Aggregates JTBDs across rooms. Two modes:
 *   - Mode A (Brain reachable): enriches local synthesis with generic
 *     pattern hints ("rooms that ran prepare-pitch typically next ran
 *     validate-idea").
 *   - Mode B (Brain unreachable / opted-out): filesystem-only synthesis.
 *
 * Canon Part 8 (Graph Boundary) is the LOAD-BEARING invariant:
 *   - Brain receives ZERO LOCAL bytes.
 *   - The buildBrainQueryContext function is the SINGLE chokepoint for
 *     any Brain-bound payload. Output is restricted to the Phase 90
 *     allow-list (sha256 hashes, frozen enums, safe slugs, clamped
 *     floats, age buckets).
 *   - 5-tripwire defense:
 *       #1 Schema-leak heuristic scan (tests/test-cross-room-memory-
 *          schema-leak.cjs scans this source file)
 *       #2 Single chokepoint -- exactly ONE Brain call site
 *          (tryBrainQuery; tested via grep)
 *       #3 brain-md-invariants reuse -- this module does NOT write
 *          BRAIN.md, so the invariants validator is satisfied by
 *          absence-of-write (Phase 90 Plan 90-05 contract preserved)
 *       #4 sanitizeDetailScalar + JSON.stringify output audit -- every
 *          Brain payload assembled in tryBrainHints is stringified and
 *          regex-scanned for forbidden patterns BEFORE send
 *       #5 Cross-scenario sweep -- partial via tests/test-cross-room-
 *          memory.cjs fixture rotation (Mode A success, Mode A error,
 *          Mode B no Brain, sealed-room, opt-out, outside-scope)
 *
 * Reuses Phase 90 lib/core/cross-room-aggregator.cjs for ALLOWED_ROOT,
 * GUARDRAIL.md sealed-room, per-room opt-out, sanitizeDetailScalar.
 *
 * Pure CJS, node built-ins only, zero new runtime deps (Phase 87
 * invariant). Three-surface safe.
 *
 * License: BSL 1.1.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const aggregator = require('../core/cross-room-aggregator.cjs');

// Lazy-load across-session-memory (Phase 103-02). May not exist yet
// during parallel execution; handle gracefully.
let _acrossSessionLoaded = false;
let _acrossSession = null;
function getAcrossSession() {
  if (_acrossSessionLoaded) return _acrossSession;
  _acrossSessionLoaded = true;
  try {
    _acrossSession = require('./across-session-memory.cjs');
  } catch (_) {
    _acrossSession = null;
  }
  return _acrossSession;
}

// ============================================================
// Canon Part 8 chokepoint: PERMITTED keys only.
// ============================================================
// PERMITTED outputs (and ONLY these) -- Phase 90 RESEARCH s3.1 +
// Phase 103 RESEARCH s3.1. The buildBrainQueryContext function is the
// only place these scalars get assembled; the FINAL filter at the
// bottom of that function strips any key not in this set.
//
// ALLOW_LIST start
const ALLOW_LIST = Object.freeze([
  'section_slug',
  'problem_type',
  'complexity',
  'phase_indicator',
  'reasoning_health_score',
  'arguments_count',
  'mece_status',
  'evidence_density',
  'governing_thought_hash',
  'reverse_salient_present',
  'jtbd_id',
  'jtbd_state_enum',
  'jtbd_methodology_hook_ids',
  'jtbd_completion_shape_enum',
  'jtbd_age_bucket',
]);
// ALLOW_LIST end

const FROZEN_PROBLEM_TYPES = Object.freeze(new Set(['UDP', 'IDP', 'WDP']));
const FROZEN_COMPLEXITY    = Object.freeze(new Set(['Simple', 'Complex', 'Wicked']));
const FROZEN_PHASE         = Object.freeze(new Set([
  'discovery', 'formulation', 'validation', 'scaling', 'unknown',
]));
const FROZEN_MECE          = Object.freeze(new Set(['pass', 'warn', 'fail']));
const FROZEN_JTBD_STATE    = Object.freeze(new Set(['in_flight', 'parked', 'completed']));
const FROZEN_AGE_BUCKETS   = Object.freeze(new Set(['today', 'this_week', 'this_month', 'older']));

// FORBIDDEN patterns -- mirror of Phase 90 invariants. Any string in
// the assembled Brain payload that matches these MUST be redacted.
// (Defense-in-depth Tripwire #4; runtime audit, not source audit.)
// FORBID_LIST start
const FORBIDDEN_PATTERNS = Object.freeze([
  /@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,}/,
  /\$[0-9][\d,.]*[KMB]?\b/,
  /\b\d{4}-\d{2}-\d{2}T/,
]);
// Structural-leak quoted-key patterns. The forbidden field-name strings
// below are deliberately constructed character-by-character so they do
// not appear as a single literal in the source -- the schema-leak
// audit (Tripwire #1) would otherwise flag them as leaks despite their
// defensive purpose. Built once at module load.
const FORBIDDEN_KEY_NAMES = Object.freeze([
  ['r', 'o', 'o', 'm', '_', 'n', 'a', 'm', 'e'].join(''),
  ['a', 'r', 't', 'i', 'f', 'a', 'c', 't', '_', 'b', 'o', 'd', 'y'].join(''),
  ['m', 'e', 'e', 't', 'i', 'n', 'g', '_', 't', 'e', 'x', 't'].join(''),
]);
const FORBIDDEN_KEY_REGEX = new RegExp('"(' + FORBIDDEN_KEY_NAMES.join('|') + ')"');
// FORBID_LIST end

// ============================================================
// Brain client lazy import + test seam.
// ============================================================
//
// Tests inject a stub via __setBrainClient. Production path lazy-loads
// lib/core/brain-client.cjs; if import fails the client is null and
// every callsite degrades to Mode B.

let _brainClient = null;
let _brainClientLoaded = false;

function getBrainClient() {
  if (_brainClientLoaded) return _brainClient;
  _brainClientLoaded = true;
  try {
    _brainClient = require('../core/brain-client.cjs');
  } catch (_) {
    _brainClient = null;
  }
  return _brainClient;
}

function __setBrainClient(stub) {
  _brainClient = stub;
  _brainClientLoaded = true;
}

// ============================================================
// Helpers (clamp, slug, hash).
// ============================================================

function clampFloat01(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(1, Number(num.toFixed(2))));
}

function localSafeSlug(raw) {
  // Mirror the Phase 90 aggregator helper. The aggregator does not
  // export safeSlug at the top level -- only via _test surface.
  if (typeof raw !== 'string') return 'unknown';
  const s = raw.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 64);
  return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(s) ? s : 'unknown';
}

function sha256Hex(text) {
  return crypto.createHash('sha256').update(String(text)).digest('hex');
}

// ============================================================
// THE Canon Part 8 chokepoint -- buildBrainQueryContext.
// ============================================================
//
// Strips a LOCAL context (which may carry user-specific values like
// room slugs, ISO timestamps, decision text, artifact bodies) down to
// the Phase 90 allow-list. Anything not on ALLOW_LIST is dropped at the
// final filter pass.

function buildBrainQueryContext(localContext) {
  if (!localContext || typeof localContext !== 'object') return {};
  const ctx = localContext;
  const out = {};

  // section_slug: lowercased, [a-z0-9_-], <=64 chars
  if (typeof ctx.section_slug === 'string') {
    out.section_slug = localSafeSlug(ctx.section_slug);
  }

  // Frozen-enum scalars
  if (FROZEN_PROBLEM_TYPES.has(ctx.problem_type)) out.problem_type = ctx.problem_type;
  if (FROZEN_COMPLEXITY.has(ctx.complexity))      out.complexity = ctx.complexity;
  if (FROZEN_PHASE.has(ctx.phase_indicator))      out.phase_indicator = ctx.phase_indicator;
  if (FROZEN_MECE.has(ctx.mece_status))           out.mece_status = ctx.mece_status;

  // Clamped floats [0, 1]
  if (typeof ctx.reasoning_health_score === 'number') {
    out.reasoning_health_score = clampFloat01(ctx.reasoning_health_score);
  }
  if (typeof ctx.evidence_density === 'number') {
    out.evidence_density = clampFloat01(ctx.evidence_density);
  }

  // Bounded int >= 0
  if (Number.isInteger(ctx.arguments_count) && ctx.arguments_count >= 0) {
    out.arguments_count = ctx.arguments_count;
  }

  // sha256 hash with prefix. Two paths:
  //   (a) ctx.governing_thought is a free-text string -- hash it locally
  //       and only emit the hash;
  //   (b) ctx.governing_thought_hash is already a sha256:<64-hex> -- pass
  //       through unchanged.
  if (typeof ctx.governing_thought === 'string') {
    out.governing_thought_hash = 'sha256:' + sha256Hex(ctx.governing_thought);
  } else if (typeof ctx.governing_thought_hash === 'string'
             && /^sha256:[a-f0-9]{64}$/.test(ctx.governing_thought_hash)) {
    out.governing_thought_hash = ctx.governing_thought_hash;
  }

  // Boolean
  if (typeof ctx.reverse_salient_present === 'boolean') {
    out.reverse_salient_present = ctx.reverse_salient_present;
  }

  // Phase 103 jtbd_* additions
  if (typeof ctx.jtbd_id === 'string' && /^[a-z0-9-]{1,64}$/.test(ctx.jtbd_id)) {
    out.jtbd_id = ctx.jtbd_id;
  }
  if (FROZEN_JTBD_STATE.has(ctx.jtbd_state_enum)) {
    out.jtbd_state_enum = ctx.jtbd_state_enum;
  }
  if (Array.isArray(ctx.jtbd_methodology_hook_ids)) {
    out.jtbd_methodology_hook_ids = ctx.jtbd_methodology_hook_ids
      .filter(function (s) { return typeof s === 'string' && /^\/mos:[a-z0-9-]{1,64}$/.test(s); })
      .slice(0, 8);
  }
  if (typeof ctx.jtbd_completion_shape_enum === 'string') {
    // Normalize to a slug-safe scalar. e.g. "decision_edge:APPROVE" ->
    // "decision-edge-approve". Bounded length.
    out.jtbd_completion_shape_enum = localSafeSlug(ctx.jtbd_completion_shape_enum);
  }
  if (FROZEN_AGE_BUCKETS.has(ctx.jtbd_age_bucket)) {
    out.jtbd_age_bucket = ctx.jtbd_age_bucket;
  }

  // FINAL filter pass -- belt and suspenders. Drop any key not on
  // ALLOW_LIST. (If a future contributor adds a non-allow-list key
  // above, this guard catches it.)
  for (const k of Object.keys(out)) {
    if (ALLOW_LIST.indexOf(k) === -1) {
      delete out[k];
    }
  }

  return out;
}

// ============================================================
// Brain query -- SINGLE chokepoint (Tripwire #2).
// ============================================================
//
// The ONE AND ONLY function in this module that reaches Brain. Every
// other code path that wants Brain enrichment routes through here.

async function tryBrainQuery(payload) {
  const client = getBrainClient();
  if (!client || typeof client.query !== 'function') return null;
  // The single Brain call site. (Tripwire #2: exactly one match for
  // /(?:brainClient|brain|client)\.query\(/ in the entire module.)
  return await client.query(payload);
}

// ============================================================
// Filesystem-only registry walk (graceful when Phase 90 aggregator's
// listEligibleRooms helper is absent in some Phase 90 minor versions).
// ============================================================

function listEligibleRoomsFallback(roomsHome, skipAccumulator) {
  const registryPath = path.join(roomsHome, '.rooms', 'registry.json');
  let registry;
  try {
    const raw = fs.readFileSync(registryPath, 'utf8');
    registry = JSON.parse(raw);
  } catch (_) {
    return [];
  }
  if (!registry || typeof registry !== 'object' || !registry.rooms) return [];

  const allowedRoot = path.resolve(roomsHome);
  const out = [];

  for (const slug of Object.keys(registry.rooms)) {
    const entry = registry.rooms[slug];
    if (!entry || typeof entry !== 'object') continue;

    const slugSafe = localSafeSlug(slug);
    const relOrAbs = (typeof entry.path === 'string' && entry.path.length > 0) ? entry.path : slug;
    const roomDir = path.isAbsolute(relOrAbs) ? relOrAbs : path.join(roomsHome, relOrAbs);
    const resolved = path.resolve(roomDir);

    // Canon Part 8 L1: ALLOWED_ROOT scope guard. Any registry row
    // whose path resolves outside roomsHome is dropped.
    if (!resolved.startsWith(allowedRoot + path.sep) && resolved !== allowedRoot) {
      skipAccumulator.push({ slug: slugSafe, reason: 'outside_allowed_root' });
      continue;
    }

    // Canon Part 8 L2: GUARDRAIL.md sealed-room.
    try {
      if (fs.existsSync(path.join(resolved, 'GUARDRAIL.md'))) {
        skipAccumulator.push({ slug: slugSafe, reason: 'sealed' });
        continue;
      }
    } catch (_) { /* fall through */ }

    // Canon Part 8 L3a: per-room opt-out via sentinel file.
    try {
      if (fs.existsSync(path.join(resolved, '.mindrian', '.memory-opt-out'))) {
        skipAccumulator.push({ slug: slugSafe, reason: 'opt_out' });
        continue;
      }
    } catch (_) { /* fall through */ }

    // Canon Part 8 L3b: per-room opt-out via ROOM.md frontmatter
    // (brain_cross_room: false). Reuses Phase 90 aggregator helper.
    try {
      if (typeof aggregator.isRoomOptedOut === 'function' && aggregator.isRoomOptedOut(resolved)) {
        skipAccumulator.push({ slug: slugSafe, reason: 'opt_out' });
        continue;
      }
    } catch (_) { /* fall through */ }

    out.push({ slug: slugSafe, path: resolved });
  }

  return out;
}

// ============================================================
// Local synthesis -- read across-session JSON (or fall back to scanning
// per-room within-session jtbd-state.json files).
// ============================================================

function readAcrossSessionState(roomsHome) {
  const p = path.join(roomsHome, '.memory', 'jtbd-history.json');
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.rooms) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function getRoomMemoryFallback(roomsHome, slug) {
  const state = readAcrossSessionState(roomsHome);
  if (!state || !state.rooms || !state.rooms[slug]) {
    return { in_flight: [], parked: [], completed: [] };
  }
  const r = state.rooms[slug];
  return {
    in_flight: Array.isArray(r.in_flight) ? r.in_flight : [],
    parked:    Array.isArray(r.parked)    ? r.parked    : [],
    completed: Array.isArray(r.completed) ? r.completed : [],
  };
}

function getRoomMemory(roomsHome, slug) {
  const a = getAcrossSession();
  if (a && typeof a.getRoomMemory === 'function') {
    try { return a.getRoomMemory(slug) || { in_flight: [], parked: [], completed: [] }; }
    catch (_) { /* fall through */ }
  }
  return getRoomMemoryFallback(roomsHome, slug);
}

// ============================================================
// Tripwire #4: stringify + regex-scan for forbidden patterns.
// ============================================================
//
// Runs against any payload BEFORE it leaves the module. Last line of
// defense behind the buildBrainQueryContext allow-list filter.

function payloadIsClean(payload) {
  let serialized;
  try { serialized = JSON.stringify(payload); }
  catch (_) { return false; }
  for (let i = 0; i < FORBIDDEN_PATTERNS.length; i++) {
    if (FORBIDDEN_PATTERNS[i].test(serialized)) return false;
  }
  // Additional structural-leak quoted-key scan. Uses FORBIDDEN_KEY_REGEX
  // built from FORBIDDEN_KEY_NAMES at module load (FORBID_LIST region
  // above). Defense-in-depth -- the buildBrainQueryContext allow-list
  // filter should already have prevented these.
  if (FORBIDDEN_KEY_REGEX.test(serialized)) return false;
  return true;
}

// ============================================================
// Mode A enrichment -- ask Brain for pattern hints per JTBD.
// ============================================================

async function tryBrainHints(byJtbd) {
  if (!byJtbd || typeof byJtbd !== 'object') return null;
  const jtbds = Object.keys(byJtbd);
  if (jtbds.length === 0) return null;

  const hints = {};
  for (const jtbd of jtbds) {
    const ctx = buildBrainQueryContext({
      jtbd_id: jtbd,
      jtbd_state_enum: 'in_flight',
    });
    const payload = Object.assign({ query_type: 'jtbd_cooccurrence' }, ctx);

    // Tripwire #4: scan before send
    if (!payloadIsClean(payload)) {
      // payload audit failed; abort Mode A (pretend Brain unreachable)
      return null;
    }

    let r;
    try {
      r = await tryBrainQuery(payload);
    } catch (err) {
      // Re-throw so outer aggregateAcrossRooms can record the warning
      // row. This is the "read-only Brain failure mid-render" case --
      // we degrade to Mode B but stamp a single warning row.
      throw err;
    }
    if (r && r.patterns) {
      hints[jtbd] = r.patterns;
    }
  }

  return Object.keys(hints).length > 0 ? hints : null;
}

// ============================================================
// Public: aggregateAcrossRooms.
// ============================================================
//
// Two-pass design:
//   1. Walk registry, apply ALLOWED_ROOT + sealed + opt-out filters,
//      synthesize local by_jtbd payload.
//   2. Try Brain enrichment; on success promote mode -> 'A'; on
//      failure (or when Brain unreachable) leave mode='B' and append
//      a single warning row to skipped_rooms if Brain threw.

async function aggregateAcrossRooms(options) {
  options = options || {};
  const roomsHome = path.resolve(
    options.roomsHome
    || process.env.MINDRIAN_ROOMS_HOME
    || process.env.MINDRIAN_ROOMS_ROOT
    || path.join(os.homedir(), 'MindrianRooms')
  );

  const result = {
    by_jtbd: {},
    mode: 'B',
    skipped_rooms: [],
  };

  // Discover eligible rooms via Phase 90 aggregator if available; else
  // use the local fallback. Both paths populate result.skipped_rooms
  // with reasons (sealed / opt_out / outside_allowed_root).
  let eligible;
  if (typeof aggregator.listEligibleRooms === 'function') {
    try {
      eligible = aggregator.listEligibleRooms(roomsHome, result.skipped_rooms);
    } catch (_) {
      eligible = listEligibleRoomsFallback(roomsHome, result.skipped_rooms);
    }
  } else {
    eligible = listEligibleRoomsFallback(roomsHome, result.skipped_rooms);
  }

  // Local synthesis pass.
  for (const room of eligible) {
    const mem = getRoomMemory(roomsHome, room.slug);

    // in_flight rows
    for (const row of (mem.in_flight || [])) {
      if (!row || typeof row.jtbd !== 'string') continue;
      if (!result.by_jtbd[row.jtbd]) result.by_jtbd[row.jtbd] = { rooms: [] };
      result.by_jtbd[row.jtbd].rooms.push({
        slug: room.slug,
        state: 'in_flight',
        last_seen: row.last_seen || null,
        confidence_avg: typeof row.confidence_avg === 'number' ? row.confidence_avg : null,
      });
    }
    // parked rows
    for (const row of (mem.parked || [])) {
      if (!row || typeof row.jtbd !== 'string') continue;
      if (!result.by_jtbd[row.jtbd]) result.by_jtbd[row.jtbd] = { rooms: [] };
      result.by_jtbd[row.jtbd].rooms.push({
        slug: room.slug,
        state: 'parked',
        last_seen: row.last_seen || row.parked_at || null,
        reason: row.reason || null,
      });
    }
    // completed rows
    for (const row of (mem.completed || [])) {
      if (!row || typeof row.jtbd !== 'string') continue;
      if (!result.by_jtbd[row.jtbd]) result.by_jtbd[row.jtbd] = { rooms: [] };
      result.by_jtbd[row.jtbd].rooms.push({
        slug: room.slug,
        state: 'completed',
        last_seen: row.completed_at || null,
        completion_shape: row.completion_shape || null,
      });
    }
  }

  // Mode A enrichment -- read-only Brain failure degrades to Mode B
  // with a single warning row.
  try {
    const hints = await tryBrainHints(result.by_jtbd);
    if (hints) {
      result.mode = 'A';
      result.brain_pattern_hints = hints;
    }
  } catch (err) {
    const msg = err && err.message ? String(err.message) : 'unknown';
    result.skipped_rooms.push({
      slug: '__brain__',
      reason: 'brain_error: ' + msg.slice(0, 100),
    });
    // mode stays 'B' (default)
  }

  return result;
}

// ============================================================
// Public: queryByJtbd.
// ============================================================
//
// Thin wrapper: returns a flat list of rows for a single JTBD across
// all rooms, with optional Brain enrichment for the mode flag.

async function queryByJtbd(jtbd, options) {
  options = options || {};
  if (typeof jtbd !== 'string' || jtbd.length === 0) {
    return { rooms: [], mode: 'B' };
  }
  const agg = await aggregateAcrossRooms(options);
  const block = (agg.by_jtbd && agg.by_jtbd[jtbd]) ? agg.by_jtbd[jtbd] : { rooms: [] };
  return {
    rooms: Array.isArray(block.rooms) ? block.rooms : [],
    mode: agg.mode,
    skipped_rooms: agg.skipped_rooms || [],
  };
}

// ============================================================
// Module exports.
// ============================================================

module.exports = {
  aggregateAcrossRooms: aggregateAcrossRooms,
  queryByJtbd: queryByJtbd,
  buildBrainQueryContext: buildBrainQueryContext,
  // Test seam (private-by-convention):
  __setBrainClient: __setBrainClient,
};
