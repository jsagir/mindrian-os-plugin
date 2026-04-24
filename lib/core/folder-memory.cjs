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
 *   computeHealthScore(reasoning) -> number in [0,1]   (re-export)
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

module.exports = {
  readTriple: readTriple,
  readDecisionLog: readDecisionLog,
  readQuadruple: readQuadruple,
  isQuadrupleFresh: isQuadrupleFresh,
  computeHealthScore: shared.computeHealthScore,
};
