/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88-01 -- folder-memory SYNC entry point
 * ==============================================
 * The ONE and ONLY read contract for the per-folder memory triple
 * (ROOM.md + STATE.md + MINTO.md). Every skill, hook, statusline
 * segment, session-start injection, guardian, and the Navigation Engine
 * (Phase 91) consume the triple through `readTriple(sectionPath)`.
 *
 * The contract and field shape are documented in
 *   .planning/phases/88-feynman-minto-memory-layer/88-CONTEXT.md
 *     lines 99-132
 * and in the PLAN <interfaces> block for plan 88-01. Any change to the
 * returned shape is a cross-plan breaking change (88-06, 88-07, 88-08,
 * 88-09, 88-10, 88-13 all consume it).
 *
 * Sync entry point: used by CLI hook scripts (session-start, on-stop,
 * post-write, pre/post-compact), statusline segments, guardian, and the
 * pre-commit gate. Mirror async twin at lib/core/folder-memory-async.cjs
 * keeps key-set parity for MCP/Desktop callers.
 *
 * Pure CJS, node built-ins only, zero npm deps. Three-surface compatible
 * by construction (CLI + Desktop MCP + Cowork).
 *
 * API:
 *   readTriple(sectionPath) -> {room, state, reasoning}
 *   readDecisionLog(sectionPath) -> decision_log array
 *   readQuadruple(sectionPath) -> {room, state, reasoning, brain}
 *   isQuadrupleFresh(quadruple) -> boolean
 *   computeHealthScore(reasoning) -> number in [0,1]   (re-export)
 *   getCurrentRoom([workDir]) -> {slug, path, source} | null   (Phase 94-01)
 *
 * License: BSL 1.1.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const shared = require('./folder-memory-shared.cjs');
const invariants = require('./feynman-minto-invariants.cjs');
// Phase 128.1-03b: the canonical session-scoped active-room resolver.
// resolveCanonicalStateMd's Strategy 1 was a Bucket B-reader of the racing
// global `active` string; it now routes through resolveActiveRoom (D-03).
const sessionBinding = require('./session-binding.cjs');

const RESERVED = new Set(['ROOM.md', 'STATE.md', 'MINTO.md', 'TEAM-STATE.md']);

function safeStatSync(p) {
  try {
    return fs.statSync(p);
  } catch (_e) {
    return null;
  }
}

function safeReadSync(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (_e) {
    return null;
  }
}

function collectArtifactMtimes(sectionPath) {
  const mtimes = [];
  let entries = [];
  try {
    entries = fs.readdirSync(sectionPath);
  } catch (_e) {
    return mtimes;
  }
  for (const name of entries) {
    if (name[0] === '.') continue;
    if (RESERVED.has(name)) continue;
    const abs = path.join(sectionPath, name);
    const st = safeStatSync(abs);
    if (!st) continue;
    if (st.isFile() && name.endsWith('.md')) {
      mtimes.push(st.mtimeMs);
    }
  }
  return mtimes;
}

/**
 * readTriple(sectionPath) -> {room, state, reasoning}
 *
 * Never throws. Missing files degrade gracefully (exists:false).
 * Invariant violations (critical) downgrade reasoning to stale but do
 * not zero its fields -- best-effort parse continues so consumers see
 * as much context as possible.
 */
function readTriple(sectionPath) {
  const room = { ...shared.emptyRoom() };
  const state = { ...shared.emptyState() };
  const reasoning = { ...shared.emptyReasoning() };

  // Sentinel: if the section path itself doesn't exist, return the
  // all-empty shell. This is the graceful-degradation contract (Test 9).
  const sectionStat = safeStatSync(sectionPath);
  if (!sectionStat || !sectionStat.isDirectory()) {
    reasoning.reasoning_health_score = shared.computeHealthScore(reasoning);
    return { room: room, state: state, reasoning: reasoning };
  }

  // ---- ROOM.md ----
  const roomPath = path.join(sectionPath, 'ROOM.md');
  const roomStat = safeStatSync(roomPath);
  if (roomStat && roomStat.isFile()) {
    const roomBuf = safeReadSync(roomPath);
    if (roomBuf !== null) {
      Object.assign(room, shared.parseRoomMd(roomBuf, roomStat.mtimeMs));
    }
  }

  // ---- STATE.md ----
  const statePath = path.join(sectionPath, 'STATE.md');
  const stateStat = safeStatSync(statePath);
  if (stateStat && stateStat.isFile()) {
    const stateBuf = safeReadSync(statePath);
    if (stateBuf !== null) {
      Object.assign(state, shared.parseStateMd(stateBuf));
    }
  }

  // ---- MINTO.md ----
  const mintoPath = path.join(sectionPath, 'MINTO.md');
  const mintoStat = safeStatSync(mintoPath);
  if (mintoStat && mintoStat.isFile()) {
    const mintoBuf = safeReadSync(mintoPath);
    if (mintoBuf !== null) {
      const parsed = shared.parseMintoMd(mintoBuf);
      Object.assign(reasoning, parsed);
      reasoning.exists = true;

      // Ask the invariants validator for its verdict. Critical violations
      // downgrade stale_reason to 'invariant_violation' so every downstream
      // consumer agrees. Best-effort parse is preserved; we do NOT zero
      // governing_thought or decision_log on invariant failure.
      let invariantSeverity = null;
      try {
        const v = invariants.validate(mintoPath);
        invariantSeverity = v.severity;
      } catch (_e) {
        // Validator is defensive; treat unexpected failure as warning-level
        invariantSeverity = null;
      }

      const artifactMtimes = collectArtifactMtimes(sectionPath);
      const stale = shared.computeStale(
        reasoning,
        artifactMtimes,
        mintoStat.mtimeMs,
        invariantSeverity
      );
      reasoning.is_stale = stale.is_stale;
      reasoning.stale_reason = stale.stale_reason;
    }
  }
  // If reasoning.exists is still false (no MINTO.md), the default
  // emptyReasoning() shell already carries is_stale:true,
  // stale_reason:'never_generated' which matches the contract.

  // Compute reasoning_health_score deterministically from the parsed
  // reasoning fields + freshness outcome.
  reasoning.reasoning_health_score = shared.computeHealthScore(reasoning);

  return { room: room, state: state, reasoning: reasoning };
}

/**
 * readDecisionLog(sectionPath) -> Array of decision_log entries.
 *
 * Read-optimized for 88-09 consumer (post-compact re-injection). Same
 * permissive shape as readTriple().reasoning.decision_log: returns ALL
 * entries in write order (oldest first), no cap enforcement on the
 * read side (guardian is strict; read is permissive).
 */
function readDecisionLog(sectionPath) {
  const mintoPath = path.join(sectionPath, 'MINTO.md');
  const buf = safeReadSync(mintoPath);
  if (buf === null) return [];
  const parsed = shared.parseMintoMd(buf);
  return Array.isArray(parsed.decision_log) ? parsed.decision_log : [];
}

// ---------- Phase 90-04 readQuadruple (additive extension) ----------
//
// readQuadruple composes on top of readTriple. readTriple semantics are
// preserved byte-for-byte; readQuadruple simply adds a fourth field
// named "brain" that is either null (BRAIN.md absent) or a structured
// object parsed from BRAIN.md.
//
// Canon Part 8 (Graph Boundary): readQuadruple is a LOCAL read. No
// Brain MCP call is made here. The BRAIN.md file was written locally
// by Plan 90-01 deriveSection (which is the module that DOES call
// Brain, under chokepoint buildBrainQueryContext). Consumers
// downstream of readQuadruple are responsible for not sending brain
// content back into Brain query payloads.

/**
 * readQuadruple(sectionPath) -> {room, state, reasoning, brain}
 *
 * Additive extension of readTriple. Brain field:
 *   - null when BRAIN.md is absent
 *   - struct with parse_failed:true when BRAIN.md is present but
 *     unparseable (malformed frontmatter, empty file, I/O error)
 *   - full struct when BRAIN.md parses cleanly
 *
 * Never throws. Phase 88-01 readTriple signature/return unchanged.
 */
function readQuadruple(sectionPath) {
  const triple = readTriple(sectionPath);
  const brainPath = path.join(sectionPath, 'BRAIN.md');
  const brain = shared.parseBrainMd(brainPath);
  return shared.attachBrainToTriple(triple, brain);
}

/**
 * isQuadrupleFresh(quadruple) -> boolean
 *
 * Returns true iff:
 *   (a) reasoning.is_stale === false, AND
 *   (b) brain is null  OR  brain.staleness === 'fresh'  OR
 *       brain.stale_reason === 'brain_offline'
 *
 * Rationale: brain-offline is a transient network condition, not a
 * derivation-staleness signal. A quadruple whose BRAIN.md is stale
 * because Brain is temporarily unreachable is still "fresh enough" for
 * consumers that don't require the brain signal. A brain that is stale
 * for ANY other reason (governing_thought_changed, age_exceeded,
 * brain_graph_version_mismatch, derivation_timeout) marks the
 * quadruple as not-fresh.
 *
 * Pure function -- no I/O, no exceptions.
 */
function isQuadrupleFresh(quadruple) {
  if (!quadruple || typeof quadruple !== 'object') return false;
  const reasoning = quadruple.reasoning;
  if (!reasoning || reasoning.is_stale !== false) return false;
  const brain = quadruple.brain;
  if (brain === null || brain === undefined) return true;
  if (brain.staleness === 'fresh') return true;
  if (brain.stale_reason === 'brain_offline') return true;
  return false;
}

// ---------- Phase 94-01 getCurrentRoom (statusline canonical read) ----------
//
// Lawrence Aronhime hit the v1.11.0 bug "look at the bottom. It still says
// core power" four times in 38 minutes because scripts/context-monitor was
// deriving the room name from a stale source. This function anchors the
// canonical contract: STATE.md frontmatter current_room is the source of
// truth; statusline is a derived read-only view.
//
// Canon Part 7 (Reuse Before Build): composes resolveRoom() from room-ops-
// shared and reuses the same minimal frontmatter sniff readTriple already
// uses (no new YAML lib). Canon Part 4: read-only function, never writes.
// Canon Part 8: pure local; never queries Brain.

/**
 * Resolve the canonical STATE.md path for the active room.
 *
 * Resolution order (first match wins):
 *   1. session-scoped active-room binding -> active room's STATE.md
 *   2. <workDir>/room/STATE.md            (legacy default room)
 *   3. <workDir>/STATE.md                  (workDir IS the room)
 *
 * Returns absolute path string or null. Pure I/O probes; never throws.
 *
 * Phase 128.1-03b: Strategy 1 previously read `reg.active` from a
 * registry.json directly -- a Bucket B-reader of the racing global string.
 * It now routes through session-binding.resolveActiveRoom so concurrent
 * sessions resolve their own room (D-03). The resolver does the session-keyed
 * lookup plus the last_active/active fallback internally. The `tripwire`
 * signal is destructured but not acted on here -- Plan 05 owns that surface.
 *
 * @param {string} workDir
 * @returns {string|null}
 */
function resolveCanonicalStateMd(workDir) {
  let resolved;
  try {
    resolved = path.resolve(workDir);
  } catch (_e) {
    return null;
  }

  // Strategy 1: session-scoped active-room binding.
  try {
    const sid = sessionBinding.resolveSessionId();
    const { path: roomDir /* room, tripwire -- Plan 05 owns tripwire */ } =
      sessionBinding.resolveActiveRoom(sid);
    if (roomDir) {
      const candidate = path.join(roomDir, 'STATE.md');
      const st = safeStatSync(candidate);
      if (st && st.isFile()) return candidate;
    }
  } catch (_e) { /* fall through */ }

  // Strategy 2: legacy room/ dir.
  const legacy = path.join(resolved, 'room', 'STATE.md');
  const legacyStat = safeStatSync(legacy);
  if (legacyStat && legacyStat.isFile()) return legacy;

  // Strategy 3: workDir IS a room.
  const direct = path.join(resolved, 'STATE.md');
  const directStat = safeStatSync(direct);
  if (directStat && directStat.isFile()) return direct;

  return null;
}

/**
 * Extract the YAML frontmatter block from a markdown buffer, then walk
 * its lines for the `current_room` key. Returns the parsed slug string
 * or null on every failure mode (no frontmatter, malformed, key absent).
 *
 * Strips surrounding single/double quotes and whitespace from the value.
 * Treats explicit `null` / empty string as absent.
 *
 * @param {string} buf
 * @returns {string|null}
 */
function parseCurrentRoomField(buf) {
  if (typeof buf !== 'string' || buf.length === 0) return null;

  // Frontmatter MUST open with --- on the very first line. This is a
  // tighter sniff than parseStateMd does, but the canonical write surface
  // (the /mos:rooms skill) emits clean frontmatter every time.
  if (buf.indexOf('---') !== 0) return null;
  if (buf.length < 4) return null;
  if (buf[3] !== '\n' && buf[3] !== '\r') return null;

  // Locate the closing ---.
  const rest = buf.slice(buf.indexOf('\n') + 1);
  const closeMatch = rest.match(/^---\s*$/m);
  if (!closeMatch) return null;
  const fmText = rest.slice(0, closeMatch.index);

  // Walk frontmatter lines for current_room.
  const lines = fmText.split(/\r?\n/);
  for (const raw of lines) {
    if (raw.length === 0) continue;
    if (/^\s*#/.test(raw)) continue;
    const m = raw.match(/^current_room\s*:\s*(.+?)\s*$/);
    if (!m) continue;
    let value = m[1].trim();
    if (value.length === 0) return null;
    if (value === 'null' || value === '~') return null;

    // Strip surrounding quotes (single, double, or matched pairs).
    if (
      (value[0] === '"' && value[value.length - 1] === '"') ||
      (value[0] === "'" && value[value.length - 1] === "'")
    ) {
      if (value.length >= 2) value = value.slice(1, -1).trim();
    }
    if (value.length === 0) return null;

    // Reject obvious garbage that the YAML-malformed test produces. A
    // valid slug is non-empty, non-whitespace, and does not contain
    // unescaped colons (which would imply a nested structure we cannot
    // honor without a real YAML parser).
    if (value.indexOf(':') !== -1) return null;

    return value;
  }
  return null;
}

/**
 * getCurrentRoom([workDir]) -> {slug, path, source: 'state_md'} | null
 *
 * Reads the canonical active-room slug from STATE.md frontmatter
 * `current_room` field. Resolution order matches resolveCanonicalStateMd.
 * Pure read; never writes; never throws.
 *
 * Returns null when STATE.md is missing, lacks frontmatter, lacks the
 * current_room field, or has malformed YAML. Consumers (scripts/context-
 * monitor, /mos:status, etc) treat null as "fall back to git rev-parse"
 * per Canon Part 3 Tier 0 graceful degradation.
 *
 * Phase 94-01 -- statusline canonical source. Lawrence reproducer fence.
 *
 * @param {string} [workDir] - workspace root (default process.cwd())
 * @returns {{slug: string, path: string, source: 'state_md'} | null}
 */
function getCurrentRoom(workDir) {
  const root = workDir || process.cwd();
  const statePath = resolveCanonicalStateMd(root);
  if (!statePath) return null;

  const buf = safeReadSync(statePath);
  if (buf === null) return null;

  let slug;
  try {
    slug = parseCurrentRoomField(buf);
  } catch (_e) {
    return null;
  }
  if (slug === null) return null;

  return {
    slug: slug,
    path: statePath,
    source: 'state_md',
  };
}

module.exports = {
  readTriple: readTriple,
  readDecisionLog: readDecisionLog,
  readQuadruple: readQuadruple,
  isQuadrupleFresh: isQuadrupleFresh,
  computeHealthScore: shared.computeHealthScore,
  getCurrentRoom: getCurrentRoom,
};
