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

// ---------- Phase 150-07 readQuintuple (additive extension; MEM-08) ----------
//
// readQuintuple composes on top of readQuadruple. The first FOUR fields
// (room, state, reasoning, brain) are byte-preserved -- readQuintuple spreads
// them UNCHANGED, exactly the additive idiom readQuadruple used on readTriple.
// It adds a fifth field named "feynman" carrying the HUMAN-AUTHORED body of
// FEYNMAN.md (the bodyOutsideSentinels region), NOT the auto Timeline section.
//
// FEYNMAN.md had 2 writers (Phase 124 timeline-runner + Phase 143.1 dial-memory-
// runner) and 0 genuine consumers -- it was not in the read contract at all.
// readQuintuple closes the read-back loop so FEYNMAN joins ROOM/STATE/MINTO/BRAIN
// as a first-class per-folder memory member.
//
// The sentinel boundaries are the same ones the Phase 124 timeline-renderer and
// runner define; we reuse the runner's bodyOutsideSentinels helper (Canon Part 7
// reuse) rather than re-deriving the sentinel parse. Phase 124 owns the renderer;
// readQuintuple is a pure read that never re-derives the timeline.
//
// Canon Part 8 (Graph Boundary): readQuintuple is a LOCAL read. No Brain MCP call.
// Canon Part 9: FEYNMAN.md is a Files-preserve-meaning surface; reading its human
// body back is a local-mind read, never a Brain egress.

const timelineRunner = require('./feynman/timeline-runner.cjs');

/**
 * extractFeynmanBody(sectionPath) -> string
 *
 * Returns the human-authored FEYNMAN body (the bodyOutsideSentinels region),
 * with the sentinel-bounded ## Timeline (auto) block excised. Empty string when
 * FEYNMAN.md is absent or unreadable. Never throws.
 */
function extractFeynmanBody(sectionPath) {
  const feyPath = path.join(sectionPath, 'FEYNMAN.md');
  const buf = safeReadSync(feyPath);
  if (buf === null) return '';
  let body = buf;
  try {
    // The timeline-runner's frontmatter parser splits off any frontmatter so the
    // body region is the prose; bodyOutsideSentinels then excises the auto block.
    const parsed = timelineRunner.parseFrontmatter(buf);
    body = parsed && typeof parsed.body === 'string' ? parsed.body : buf;
    body = timelineRunner.bodyOutsideSentinels(body);
  } catch (_e) {
    // Defensive: fall back to the raw buffer if the helper ever throws.
    body = buf;
  }
  return typeof body === 'string' ? body.trim() : '';
}

/**
 * readQuintuple(sectionPath) -> {room, state, reasoning, brain, feynman}
 *
 * Additive extension of readQuadruple. The first four fields equal
 * readQuadruple's output byte-for-byte (the prior contract is byte-preserved).
 * The fifth field, feynman, carries the human-authored FEYNMAN body
 * (bodyOutsideSentinels), empty string when FEYNMAN.md is absent.
 *
 * Never throws. Phase 88-01 readTriple + Phase 90-04 readQuadruple
 * signatures/returns unchanged.
 */
function readQuintuple(sectionPath) {
  const quad = readQuadruple(sectionPath);
  const feynman = extractFeynmanBody(sectionPath);
  return {
    room: quad.room,
    state: quad.state,
    reasoning: quad.reasoning,
    brain: quad.brain,
    feynman: feynman,
  };
}

// ---------- Phase 195-02 readSextuple (additive extension; FCM-07) ----------
//
// readSextuple composes on top of readQuintuple. The first FIVE fields (room,
// state, reasoning, brain, feynman) are byte-preserved -- readSextuple spreads
// them UNCHANGED, exactly the additive idiom readQuintuple used on readQuadruple.
// It adds a sixth field named "drift" carrying the LOCAL body of the per-folder
// DRIFT.md ledger (the 7th memory kind, FCM-07), empty string when DRIFT.md is
// absent. Every existing caller of readTriple/readQuadruple/readQuintuple is
// byte-unaffected (purely additive).
//
// The pre-existing USER read-back gap (readQuintuple stops at feynman; USER.md is
// the 6th memory FILE but is not yet in the read family) predates Phase 195 and is
// a named follow-on, intentionally OUT of scope here (Path A, RESEARCH Item 5).
//
// Canon Part 8 (Graph Boundary): readSextuple is a LOCAL read. No Brain MCP call.
// Canon Part 9: DRIFT.md is a Files-preserve-meaning surface; reading its body
// back is a local-mind read, never a Brain egress. A drift entry never egresses.

/**
 * extractDriftBody(sectionPath) -> string
 *
 * Returns the LOCAL body of the per-folder DRIFT.md ledger, trimmed. Empty string
 * when DRIFT.md is absent or unreadable. Never throws. The per-folder memory-kind
 * DRIFT.md is DISTINCT from the .planning/DRIFT.md audit baseline (Pitfall 5).
 */
function extractDriftBody(sectionPath) {
  const driftPath = path.join(sectionPath, 'DRIFT.md');
  const buf = safeReadSync(driftPath);
  if (buf === null) return '';
  return typeof buf === 'string' ? buf.trim() : '';
}

/**
 * readSextuple(sectionPath) -> {room, state, reasoning, brain, feynman, drift}
 *
 * Additive extension of readQuintuple. The first five fields equal
 * readQuintuple's output byte-for-byte (the prior contract is byte-preserved).
 * The sixth field, drift, carries the LOCAL DRIFT.md body (empty string when
 * DRIFT.md is absent).
 *
 * Never throws. Phase 88-01 readTriple + Phase 90-04 readQuadruple + Phase 150-07
 * readQuintuple signatures/returns unchanged.
 */
function readSextuple(sectionPath) {
  const quint = readQuintuple(sectionPath);
  const drift = extractDriftBody(sectionPath);
  return {
    room: quint.room,
    state: quint.state,
    reasoning: quint.reasoning,
    brain: quint.brain,
    feynman: quint.feynman,
    drift: drift,
  };
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
 *   1. <workDir>/.rooms/registry.json -> active room's STATE.md
 *   2. <workDir>/room/STATE.md            (legacy default room)
 *   3. <workDir>/STATE.md                  (workDir IS the room)
 *
 * Returns absolute path string or null. Pure I/O probes; never throws.
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

  // Strategy 1: registry-driven active room.
  const registryPath = path.join(resolved, '.rooms', 'registry.json');
  const regStat = safeStatSync(registryPath);
  if (regStat && regStat.isFile()) {
    const regBuf = safeReadSync(registryPath);
    if (regBuf !== null) {
      try {
        const reg = JSON.parse(regBuf);
        if (reg && reg.active && reg.rooms && reg.rooms[reg.active]) {
          const roomDir = path.resolve(resolved, reg.rooms[reg.active].path);
          const candidate = path.join(roomDir, 'STATE.md');
          const st = safeStatSync(candidate);
          if (st && st.isFile()) return candidate;
        }
      } catch (_e) { /* fall through */ }
    }
  }

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
  readQuintuple: readQuintuple,
  readSextuple: readSextuple,
  isQuadrupleFresh: isQuadrupleFresh,
  computeHealthScore: shared.computeHealthScore,
  getCurrentRoom: getCurrentRoom,
};
