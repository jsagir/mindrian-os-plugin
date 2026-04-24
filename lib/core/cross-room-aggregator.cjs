'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 90-06 -- cross-room aggregator (Canon Part 8 four-tripwire)
 * =================================================================
 * Walks ~/MindrianRooms/ via the Phase 83 .rooms/registry.json, reads
 * the per-section quadruple (ROOM + STATE + MINTO + BRAIN) through
 * folder-memory.readQuadruple, and computes structural-only
 * contradictions between the current room and its registered peers.
 *
 * Canon Part 8 (Graph Boundary) is the LOAD-BEARING invariant. The
 * aggregator reads MULTIPLE rooms' bytes. Every output path must carry
 * ONLY:
 *   - room slug (structural folder name)
 *   - section name (slug-safe short string)
 *   - frozen contradiction_type enum
 *   - frozen problem_type enum ('UDP'|'IDP'|'WDP')
 *   - sha256 hash prefix (governing_thought_hash)
 *   - scalar confidence in [0,1]
 * Everything else is redacted.
 *
 * Four tripwires now active in Phase 90:
 *   1. Plan 90-00 schema doc   frontmatter SCALAR regex scan
 *   2. Plan 90-01 prompt allowlist  outbound Brain query allow-list
 *   3. Plan 90-05 invariants      BRAIN.md body regex scan
 *   4. Plan 90-06 aggregator     sanitizeDetailScalar + JSON.stringify
 *                                 output audit (LAST LINE OF DEFENSE)
 *
 * Canon Part 8 ENFORCEMENT LAYERS in THIS module (four defense layers):
 *   L1. ALLOWED_ROOT: every peer path absolute-resolved and rejected if
 *       it does not start with ~/MindrianRooms/ (out_of_scope).
 *   L2. GUARDRAIL.md: any room with a top-level GUARDRAIL.md is sealed
 *       per Phase 83 contract; skipped with skip_reason 'sealed_room'.
 *   L3. Per-room opt-out: ROOM.md frontmatter brain_cross_room:false
 *       signals explicit opt-out; skipped with skip_reason 'opt_out'.
 *   L4. sanitizeDetailScalar + FORBIDDEN_PATTERNS scan on the final
 *       JSON.stringify(result); any hit is redacted and a stderr WARN
 *       is emitted (defense in depth -- should never fire).
 *
 * Registry-less fallback: if .rooms/registry.json is missing or
 * malformed, returns {contradictions:[], scanned_rooms:0,
 * skipped_rooms:0, reason:'no_registry'} -- graceful degradation like
 * Phase 88-13 guardian.
 *
 * Pure CJS, node built-ins only, zero new deps. Three-surface safe.
 *
 * License: BSL 1.1.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const folderMemory = require('./folder-memory.cjs');

// ---------- Frozen constants (Canon Part 8 invariants) ----------

// ALLOWED_ROOT: canonical ~/MindrianRooms/ absolute path. Overridable
// via MINDRIAN_ROOMS_ROOT for tests; every code path still calls
// path.resolve + startsWith against this base.
const ALLOWED_ROOT = (function () {
  const envRoot = process.env.MINDRIAN_ROOMS_ROOT;
  if (typeof envRoot === 'string' && envRoot.length > 0) {
    return path.resolve(envRoot);
  }
  return path.resolve(os.homedir(), 'MindrianRooms');
})();

// Contradiction type enum (frozen).
const CONTRADICTION_TYPES = Object.freeze([
  'hash_divergence',
  'framework_contradiction',
  'problem_type_mismatch',
]);

// Problem type enum (frozen, mirrors Plan 90-01 classifyProblemType).
const PROBLEM_TYPE_ENUM = Object.freeze(['UDP', 'IDP', 'WDP']);

// FORBIDDEN_PATTERNS: the Canon Part 8 regex set, mirrored byte-for-
// byte from Plan 90-05 invariants validator FORBIDDEN_PATTERNS + Plan
// 90-00 schema heuristics. Any string matching any of these patterns
// must NEVER leak into aggregator output. sanitizeDetailScalar strips
// them at the detail-object layer; the JSON.stringify audit is the
// last line of defense.
const FORBIDDEN_PATTERNS = Object.freeze([
  /@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,}/,                                       // email
  /\$[0-9][\d,.]*[KMB]?\b/,                                               // currency magnitude
  /\b(Lawrence|Jonathan|Nimrod|Oren|Dror)\s+(said|revealed|told|mentioned)\b/i, // quoted-person
  /\bmeeting with\b/i,                                                    // meeting fragment
  /\b\d{3}-\d{2}-\d{4}\b/,                                                // SSN-like
  /\b\+?1?[\s.\-]?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}\b/,                // phone-like
]);

const DETAIL_STRING_MAX = 40; // detail_scalar strings must be short & structural

// Budget defaults.
const DEFAULT_MAX_ROOMS = 10;
const DEFAULT_PER_ROOM_TIMEOUT_MS = 300;

// Sections to cross-scan. For now we anchor on ANY shared slug; the
// scanner walks every section directory in each room.
// Reserved system slugs we skip (mirrors folder-memory-shared RESERVED).
const RESERVED_TOPLEVEL = Object.freeze(new Set([
  '.rooms', '.mindrian', '.room-graph', '.snapshots', '.context', '.intelligence',
  'assets', 'team', 'meetings', '_archive',
]));

// ---------- Canon Part 8 L2: GUARDRAIL.md sealed-room detection ----------

function isRoomSealed(roomPath) {
  try {
    const gp = path.join(roomPath, 'GUARDRAIL.md');
    return fs.existsSync(gp);
  } catch (_e) {
    // Treat stat failure as sealed (fail-closed on this specific check)
    return true;
  }
}

// ---------- Canon Part 8 L3: per-room opt-out (ROOM.md frontmatter) ----------

function isRoomOptedOut(roomPath) {
  try {
    const rp = path.join(roomPath, 'ROOM.md');
    const st = fs.statSync(rp);
    if (!st.isFile()) return false;
    // Only read the first 2KB; frontmatter is always at the top.
    const fd = fs.openSync(rp, 'r');
    try {
      const buf = Buffer.alloc(2048);
      const bytes = fs.readSync(fd, buf, 0, 2048, 0);
      const head = buf.slice(0, bytes).toString('utf8');
      // Narrow-dialect scan: 'brain_cross_room: false' on a frontmatter
      // line. Accept true/false as boolean or string.
      if (/^brain_cross_room\s*:\s*false\b/mi.test(head)) return true;
      return false;
    } finally {
      try { fs.closeSync(fd); } catch (_e) { /* best effort */ }
    }
  } catch (_e) {
    return false; // absence of ROOM.md is not an opt-out signal
  }
}

// ---------- Canon Part 8 L1: absolute-path scope check ----------

function isRoomInScope(roomPath) {
  try {
    const resolved = path.resolve(roomPath);
    const base = ALLOWED_ROOT + path.sep;
    if (resolved === ALLOWED_ROOT) return false; // the root itself is not a room
    return resolved.startsWith(base);
  } catch (_e) {
    return false;
  }
}

// ---------- Unreadable detection ----------

function isRoomUnreadable(roomPath, slug) {
  // Deterministic override for tests (chmod-0 does not block reads under root)
  const forceUnreadable = process.env.MINDRIAN_XROOM_FORCE_UNREADABLE;
  if (typeof forceUnreadable === 'string' && forceUnreadable.length > 0) {
    const slugs = forceUnreadable.split(',').map(function (s) { return s.trim(); });
    if (slugs.indexOf(slug) !== -1) return true;
  }
  try {
    fs.accessSync(roomPath, fs.constants.R_OK | fs.constants.X_OK);
    // Also try a readdir -- chmod-0 on dir blocks this even if access says OK
    fs.readdirSync(roomPath);
    return false;
  } catch (_e) {
    return true;
  }
}

// ---------- Registry discovery ----------

/**
 * discoverRegisteredRooms() -> {rooms: [{slug, path}], reason?}
 *
 * Reads ~/MindrianRooms/.rooms/registry.json. Returns rooms array with
 * absolute-resolved paths. On missing or malformed registry returns
 * reason:'no_registry' with an empty rooms array (graceful fallback).
 */
function discoverRegisteredRooms() {
  const registryPath = path.join(ALLOWED_ROOT, '.rooms', 'registry.json');
  let raw;
  try {
    raw = fs.readFileSync(registryPath, 'utf8');
  } catch (_e) {
    return { rooms: [], reason: 'no_registry' };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    try {
      process.stderr.write(
        '[cross-room-aggregator] registry malformed; graceful fallback: ' +
        (err && err.message ? err.message : 'JSON parse error') + '\n'
      );
    } catch (_e) { /* best effort */ }
    return { rooms: [], reason: 'no_registry' };
  }
  if (!parsed || typeof parsed !== 'object' || !parsed.rooms || typeof parsed.rooms !== 'object') {
    return { rooms: [], reason: 'no_registry' };
  }
  const out = [];
  for (const slug of Object.keys(parsed.rooms)) {
    const entry = parsed.rooms[slug];
    if (!entry || typeof entry !== 'object') continue;
    // Slug-sanitize defensively
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(slug)) continue;
    const relPath = typeof entry.path === 'string' && entry.path.length > 0
      ? entry.path
      : slug;
    // Resolve relative to ALLOWED_ROOT (same contract as Phase 83)
    const absPath = path.resolve(ALLOWED_ROOT, relPath);
    out.push({ slug: slug, path: absPath, entry: entry });
  }
  return { rooms: out };
}

// ---------- Canon Part 8 L4: sanitizeDetailScalar ----------

/**
 * sanitizeDetailScalar(obj) -> obj
 *
 * Walks the detail scalar object. Strips any string value longer than
 * DETAIL_STRING_MAX OR matching any FORBIDDEN_PATTERNS regex. Replaces
 * with the literal token '[redacted]'. Non-string primitives pass
 * through unchanged. Nested objects / arrays are rejected (detail
 * scalars are flat by contract); any nested structure is replaced with
 * '[redacted-nested]'.
 *
 * THIS IS THE THIRD LAYER OF DEFENSE for Canon Part 8 inside the
 * aggregator (after ALLOWED_ROOT scope + GUARDRAIL.md + opt-out).
 */
function sanitizeDetailScalar(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const out = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v === null || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v;
      continue;
    }
    if (typeof v === 'string') {
      if (v.length > DETAIL_STRING_MAX) {
        out[k] = '[redacted]';
        continue;
      }
      let matched = false;
      for (const re of FORBIDDEN_PATTERNS) {
        if (re.test(v)) { matched = true; break; }
      }
      if (matched) {
        out[k] = '[redacted]';
        continue;
      }
      out[k] = v;
      continue;
    }
    // Arrays, nested objects, functions -> redact aggressively
    out[k] = '[redacted-nested]';
  }
  return out;
}

// ---------- Structural slug cleaner ----------

function safeSlug(raw) {
  if (typeof raw !== 'string') return 'unknown';
  const s = raw.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 64);
  return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(s) ? s : 'unknown';
}

// ---------- Per-section scan (reads quadruple, extracts structural signals) ----------

function scanRoomSections(roomPath) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(roomPath);
  } catch (_e) {
    return out;
  }
  for (const name of entries) {
    if (name[0] === '.') continue;
    if (RESERVED_TOPLEVEL.has(name)) continue;
    const abs = path.join(roomPath, name);
    let st;
    try { st = fs.statSync(abs); } catch (_e) { continue; }
    if (!st.isDirectory()) continue;
    // Probe quadruple
    let q;
    try {
      q = folderMemory.readQuadruple(abs);
    } catch (_e) {
      continue;
    }
    // Extract structural signals only.
    const brain = q && q.brain;
    const reasoning = q && q.reasoning;
    // Problem type: prefer BRAIN.md frontmatter scalar if present; else
    // derive a lightweight enum from reasoning shape (so peers without
    // BRAIN.md still contribute data). We never read governing_thought
    // text -- only an existence flag.
    let problemType = null;
    if (brain && brain.exists && typeof brain.sections === 'object') {
      // BRAIN.md doesn't store problem_type as a first-class frontmatter
      // field in 90-00 schema, but generators DO emit it. Check via a
      // narrow frontmatter re-read is overkill; we instead sniff the
      // BRAIN.md file for the frontmatter 'problem_type:' scalar.
      const brainMdPath = path.join(abs, 'BRAIN.md');
      problemType = extractProblemTypeFromBrain(brainMdPath);
    }
    // Governing-thought hash: prefer BRAIN.md stored hash (already a
    // sha256 prefix, hashed upstream per Canon Part 8). Fallback: null.
    const gtHash = (brain && typeof brain.governing_thought_hash === 'string')
      ? brain.governing_thought_hash
      : null;
    // Framework chain signature: a bounded scalar hash of the Framework
    // Chain Predictions section body (if present). Never the body text.
    const fwSig = (brain && brain.sections && brain.sections.framework_chain_predictions)
      ? shortFnv1a(brain.sections.framework_chain_predictions.body || '')
      : null;
    // Section reasoning presence
    const reasoningExists = !!(reasoning && reasoning.exists);
    out.push({
      section: safeSlug(name),
      governing_thought_hash: gtHash,
      problem_type: problemType && PROBLEM_TYPE_ENUM.indexOf(problemType) !== -1 ? problemType : null,
      framework_chain_sig: fwSig,
      reasoning_exists: reasoningExists,
    });
  }
  return out;
}

/**
 * extractProblemTypeFromBrain(brainMdPath) -> 'UDP'|'IDP'|'WDP'|null
 *
 * Narrow frontmatter sniff. Canon Part 8 safe: reads ONLY the frontmatter
 * key 'problem_type' which is a frozen enum by Plan 90-01 contract.
 */
function extractProblemTypeFromBrain(brainMdPath) {
  try {
    const st = fs.statSync(brainMdPath);
    if (!st.isFile()) return null;
    const fd = fs.openSync(brainMdPath, 'r');
    try {
      const buf = Buffer.alloc(4096);
      const bytes = fs.readSync(fd, buf, 0, 4096, 0);
      const head = buf.slice(0, bytes).toString('utf8');
      const m = head.match(/^problem_type\s*:\s*([A-Za-z]{3,4})\b/m);
      if (!m) return null;
      const v = m[1].toUpperCase();
      return PROBLEM_TYPE_ENUM.indexOf(v) !== -1 ? v : null;
    } finally {
      try { fs.closeSync(fd); } catch (_e) { /* best effort */ }
    }
  } catch (_e) {
    return null;
  }
}

// ---------- Fast 32-bit scalar hash (zero crypto cost, structural only) ----------

function shortFnv1a(str) {
  if (typeof str !== 'string' || str.length === 0) return 'fnv1a:0';
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return 'fnv1a:' + h.toString(16);
}

// ---------- Contradiction computation ----------

/**
 * computeCrossRoomContradictions(currentSlug, currentSections,
 *   peerSlug, peerSections) -> [contradictions]
 *
 * Frozen rules, structural-only. Returns array of contradiction records
 * each shaped as: {type, room_a_slug, room_b_slug, section, detail_scalar, confidence}.
 */
function computeCrossRoomContradictions(currentSlug, currentSections, peerSlug, peerSections) {
  const out = [];
  if (!Array.isArray(currentSections) || !Array.isArray(peerSections)) return out;
  // Index peer sections by section slug for O(1) lookup
  const peerBySection = new Map();
  for (const ps of peerSections) peerBySection.set(ps.section, ps);
  for (const cs of currentSections) {
    const ps = peerBySection.get(cs.section);
    if (!ps) continue;
    // Rule A: hash_divergence -- both carry hashes and they differ
    if (cs.governing_thought_hash && ps.governing_thought_hash &&
        cs.governing_thought_hash !== ps.governing_thought_hash) {
      out.push({
        type: 'hash_divergence',
        room_a_slug: safeSlug(currentSlug),
        room_b_slug: safeSlug(peerSlug),
        section: cs.section,
        detail_scalar: sanitizeDetailScalar({
          hash_a_prefix: String(cs.governing_thought_hash || '').slice(0, 14), // 'sha256:xxxxxx'
          hash_b_prefix: String(ps.governing_thought_hash || '').slice(0, 14),
        }),
        confidence: 0.75,
      });
    }
    // Rule B: problem_type_mismatch -- both classified, different enums
    if (cs.problem_type && ps.problem_type && cs.problem_type !== ps.problem_type) {
      out.push({
        type: 'problem_type_mismatch',
        room_a_slug: safeSlug(currentSlug),
        room_b_slug: safeSlug(peerSlug),
        section: cs.section,
        detail_scalar: sanitizeDetailScalar({
          problem_type_a: cs.problem_type,
          problem_type_b: ps.problem_type,
        }),
        confidence: 0.8,
      });
    }
    // Rule C: framework_contradiction -- both carry framework chain
    // signatures and they differ
    if (cs.framework_chain_sig && ps.framework_chain_sig &&
        cs.framework_chain_sig !== ps.framework_chain_sig) {
      out.push({
        type: 'framework_contradiction',
        room_a_slug: safeSlug(currentSlug),
        room_b_slug: safeSlug(peerSlug),
        section: cs.section,
        detail_scalar: sanitizeDetailScalar({
          sig_a_prefix: String(cs.framework_chain_sig).slice(0, 16),
          sig_b_prefix: String(ps.framework_chain_sig).slice(0, 16),
        }),
        confidence: 0.6,
      });
    }
  }
  return out;
}

// ---------- Timeout wrapper ----------

function withTimeout(fn, timeoutMs) {
  return new Promise(function (resolve, reject) {
    let settled = false;
    const timer = setTimeout(function () {
      if (settled) return;
      settled = true;
      reject(new Error('timeout'));
    }, Math.max(1, timeoutMs));
    // Execute synchronously inside a microtask so timeout races correctly.
    // Await fn() so promise-returning workloads actually race the timer.
    Promise.resolve().then(async function () {
      let r;
      try {
        r = await fn();
      } catch (err) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
        return;
      }
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(r);
    });
  });
}

// ---------- Main entry: aggregateContradictions ----------

/**
 * aggregateContradictions(currentRoom, options) ->
 *   Promise<{contradictions, scanned_rooms, skipped_rooms, skip_reasons, reason?}>
 *
 * NEVER throws. Every failure mode becomes a structured result.
 * Registry-less fallback: reason:'no_registry', empty contradictions.
 *
 * options:
 *   opt_in              -- caller signals this is an opt-in per-call
 *   max_rooms           -- cap scanned peer count (default 10)
 *   per_room_timeout_ms -- per-peer scan timeout (default 300)
 */
async function aggregateContradictions(currentRoom, options) {
  options = options || {};
  const maxRooms = Number.isFinite(options.max_rooms) && options.max_rooms > 0
    ? Math.floor(options.max_rooms)
    : DEFAULT_MAX_ROOMS;
  const perRoomTimeout = Number.isFinite(options.per_room_timeout_ms) && options.per_room_timeout_ms > 0
    ? Math.floor(options.per_room_timeout_ms)
    : DEFAULT_PER_ROOM_TIMEOUT_MS;

  const result = {
    contradictions: [],
    scanned_rooms: 0,
    skipped_rooms: 0,
    skip_reasons: {
      sealed_room: 0,
      opt_out: 0,
      out_of_scope: 0,
      unreadable: 0,
      timeout: 0,
      max_rooms_exceeded: 0,
      self: 0,
      empty: 0,
    },
  };

  // Input validation: currentRoom must be a string path; treat malformed
  // input as no_registry-style fallback.
  if (typeof currentRoom !== 'string' || currentRoom.length === 0) {
    result.reason = 'no_registry';
    return result;
  }
  const currentRoomAbs = path.resolve(currentRoom);
  const currentSlug = safeSlug(path.basename(currentRoomAbs));

  // Discover registered rooms.
  const discovery = discoverRegisteredRooms();
  if (discovery.reason === 'no_registry') {
    result.reason = 'no_registry';
    return result;
  }
  const rooms = discovery.rooms;

  // Scan current room sections ONCE
  let currentSections = [];
  try {
    currentSections = scanRoomSections(currentRoomAbs);
  } catch (_e) {
    currentSections = [];
  }

  // Walk peers
  let scannedCount = 0;
  for (const r of rooms) {
    // L1: scope check
    if (!isRoomInScope(r.path)) {
      result.skipped_rooms += 1;
      result.skip_reasons.out_of_scope += 1;
      continue;
    }
    // Self-exclusion
    if (path.resolve(r.path) === currentRoomAbs) {
      // Self is not counted as skipped (by convention); separate reason
      // for clarity.
      result.skip_reasons.self += 1;
      continue;
    }
    // max_rooms cap
    if (scannedCount >= maxRooms) {
      result.skipped_rooms += 1;
      result.skip_reasons.max_rooms_exceeded += 1;
      continue;
    }
    // L2: sealed
    if (isRoomSealed(r.path)) {
      result.skipped_rooms += 1;
      result.skip_reasons.sealed_room += 1;
      continue;
    }
    // L3: opt-out
    if (isRoomOptedOut(r.path)) {
      result.skipped_rooms += 1;
      result.skip_reasons.opt_out += 1;
      continue;
    }
    // Unreadable
    if (isRoomUnreadable(r.path, r.slug)) {
      result.skipped_rooms += 1;
      result.skip_reasons.unreadable += 1;
      continue;
    }
    // Scan (with timeout wrapper)
    let peerSections;
    try {
      // Test hook: force timeout deterministically
      const forceTimeout = process.env.MINDRIAN_XROOM_FORCE_TIMEOUT === '1';
      if (forceTimeout) {
        // Simulate a slow scan that exceeds the timeout
        await withTimeout(function () {
          // Busy-wait would block the microtask; use setTimeout via a
          // separate promise so the timeout fires first.
          return new Promise(function (resolve) {
            setTimeout(function () { resolve([]); }, perRoomTimeout + 50);
          });
        }, perRoomTimeout);
        peerSections = [];
      } else {
        peerSections = await withTimeout(function () {
          return scanRoomSections(r.path);
        }, perRoomTimeout);
      }
    } catch (err) {
      // Any error (timeout or otherwise) -> skipped as timeout
      result.skipped_rooms += 1;
      result.skip_reasons.timeout += 1;
      continue;
    }
    // Compute contradictions vs current room
    try {
      const cs = computeCrossRoomContradictions(
        currentSlug, currentSections, r.slug, peerSections
      );
      for (const c of cs) result.contradictions.push(c);
    } catch (_e) {
      // Never propagate a compute error; count as empty scan
    }
    scannedCount += 1;
  }
  result.scanned_rooms = scannedCount;

  // Canon Part 8 LAST-LINE-OF-DEFENSE audit:
  // JSON.stringify the final payload, scan against FORBIDDEN_PATTERNS.
  // Any hit triggers redaction of the offending contradiction and a
  // stderr WARN. This should never fire in production; the
  // sanitizeDetailScalar + structural-only compute rules should have
  // caught it already. This is the defense-in-depth layer.
  try {
    const serialized = JSON.stringify(result);
    let anyHit = false;
    for (const re of FORBIDDEN_PATTERNS) {
      if (re.test(serialized)) { anyHit = true; break; }
    }
    if (anyHit) {
      try {
        process.stderr.write(
          '[cross-room-aggregator] canon_part_8 WARN: forbidden pattern matched in output; redacting contradictions\n'
        );
      } catch (_e) { /* best effort */ }
      // Redact every contradiction's detail_scalar aggressively
      const redacted = [];
      for (const c of result.contradictions) {
        let redactedScalar = {};
        try {
          redactedScalar = sanitizeDetailScalar(c.detail_scalar || {});
          // Second-pass: if any string survived, mass-redact it
          for (const k of Object.keys(redactedScalar)) {
            const v = redactedScalar[k];
            if (typeof v === 'string') {
              for (const re2 of FORBIDDEN_PATTERNS) {
                if (re2.test(v)) {
                  redactedScalar[k] = '[redacted]';
                  break;
                }
              }
            }
          }
        } catch (_e) {
          redactedScalar = { _redacted: true };
        }
        redacted.push({
          type: c.type,
          room_a_slug: safeSlug(c.room_a_slug),
          room_b_slug: safeSlug(c.room_b_slug),
          section: safeSlug(c.section),
          detail_scalar: redactedScalar,
          confidence: (typeof c.confidence === 'number') ? c.confidence : 0,
        });
      }
      result.contradictions = redacted;
    }
  } catch (_e) {
    // If even the audit failed, return empty contradictions with a
    // redaction marker rather than leak.
    result.contradictions = [];
    result.reason = result.reason || 'canon_part_8_audit_failed';
  }

  return result;
}

// ---------- Render helper (deriveSection integration) ----------

/**
 * renderCrossRoomSection(result) -> string
 *
 * Render aggregator result into the BRAIN.md 'Flagged Contradictions
 * (cross-room)' body. Structural slug-based entries only. Max 10 lines;
 * if more, appends "... and N more".
 */
function renderCrossRoomSection(result) {
  if (!result || typeof result !== 'object') return '(no signal)';
  if (!Array.isArray(result.contradictions) || result.contradictions.length === 0) {
    if (result.reason === 'no_registry') return '(no signal -- no registry)';
    return '(no signal)';
  }
  const MAX_LINES = 10;
  const lines = [];
  const n = result.contradictions.length;
  const toRender = result.contradictions.slice(0, MAX_LINES);
  for (const c of toRender) {
    // Defensive: sanitize every field at render time too (fifth layer)
    const safeType = CONTRADICTION_TYPES.indexOf(c.type) !== -1 ? c.type : 'unknown';
    const section = safeSlug(c.section);
    const peer = safeSlug(c.room_b_slug);
    // Render ONLY structural fields
    let detailRender = '';
    const ds = sanitizeDetailScalar(c.detail_scalar || {});
    const pairs = [];
    for (const k of Object.keys(ds)) {
      const v = ds[k];
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null) {
        pairs.push(k + '=' + String(v));
      }
    }
    detailRender = pairs.join(' ');
    lines.push('- ' + section + ': ' + safeType + ' vs ' + peer + ' (' + detailRender + ')');
  }
  if (n > MAX_LINES) {
    lines.push('... and ' + (n - MAX_LINES) + ' more');
  }
  // Last-line-of-defense body scan
  const body = lines.join('\n');
  for (const re of FORBIDDEN_PATTERNS) {
    if (re.test(body)) {
      try {
        process.stderr.write(
          '[cross-room-aggregator] canon_part_8 render WARN: body matched forbidden regex; emitting placeholder\n'
        );
      } catch (_e) { /* best effort */ }
      return '(no signal -- redacted)';
    }
  }
  return body;
}

// ---------- Exports ----------

module.exports = {
  aggregateContradictions: aggregateContradictions,
  discoverRegisteredRooms: discoverRegisteredRooms,
  isRoomSealed: isRoomSealed,
  isRoomOptedOut: isRoomOptedOut,
  isRoomInScope: isRoomInScope,
  computeCrossRoomContradictions: computeCrossRoomContradictions,
  sanitizeDetailScalar: sanitizeDetailScalar,
  renderCrossRoomSection: renderCrossRoomSection,
  ALLOWED_ROOT: ALLOWED_ROOT,
  CONTRADICTION_TYPES: CONTRADICTION_TYPES,
  PROBLEM_TYPE_ENUM: PROBLEM_TYPE_ENUM,
  FORBIDDEN_PATTERNS: FORBIDDEN_PATTERNS,
  DETAIL_STRING_MAX: DETAIL_STRING_MAX,
  // Test surface
  _test: Object.freeze({
    scanRoomSections: scanRoomSections,
    extractProblemTypeFromBrain: extractProblemTypeFromBrain,
    shortFnv1a: shortFnv1a,
    safeSlug: safeSlug,
  }),
};
