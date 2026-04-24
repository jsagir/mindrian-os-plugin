/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88-01 -- folder-memory ASYNC entry point
 * ===============================================
 * Promise-returning twin of lib/core/folder-memory.cjs. Import this from
 * MCP tool handlers and any caller that returns a Promise to the MCP
 * runtime. NEVER import from CLI hook scripts that expect synchronous
 * semantics -- use the sync entry point.
 *
 * Key-set parity with the sync entry point is enforced programmatically
 * by lib/memory/folder-memory.test.cjs (mirrors the Phase 87-04
 * sync-async-entry-points.test.cjs pattern). Future maintainers cannot
 * drift signatures without breaking the test.
 *
 * All reads go through fs.promises so the MCP handler loop stays
 * non-blocking. Invariant validation falls back to the sync validator
 * (feynman-minto-invariants.cjs validate() is pure-CPU; the MCP loop
 * does not see disk blocking because the file content is already
 * loaded into memory at that point).
 *
 * License: BSL 1.1.
 */

'use strict';

const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const shared = require('./folder-memory-shared.cjs');
const invariants = require('./feynman-minto-invariants.cjs');

const RESERVED = new Set(['ROOM.md', 'STATE.md', 'MINTO.md', 'TEAM-STATE.md']);

async function safeStatAsync(p) {
  try {
    return await fsp.stat(p);
  } catch (_e) {
    return null;
  }
}

async function safeReadAsync(p) {
  try {
    return await fsp.readFile(p, 'utf8');
  } catch (_e) {
    return null;
  }
}

async function collectArtifactMtimesAsync(sectionPath) {
  const mtimes = [];
  let entries = [];
  try {
    entries = await fsp.readdir(sectionPath);
  } catch (_e) {
    return mtimes;
  }
  for (const name of entries) {
    if (name[0] === '.') continue;
    if (RESERVED.has(name)) continue;
    const abs = path.join(sectionPath, name);
    const st = await safeStatAsync(abs);
    if (!st) continue;
    if (st.isFile() && name.endsWith('.md')) {
      mtimes.push(st.mtimeMs);
    }
  }
  return mtimes;
}

/**
 * Async readTriple. Promise resolves to the same shape as the sync
 * entry point's return value. Never rejects for missing files; only
 * rejects on truly unexpected errors (e.g. out-of-memory while reading
 * a huge file) -- at which point the caller should fall back to the
 * sync path or log and degrade.
 */
async function readTriple(sectionPath) {
  const room = { ...shared.emptyRoom() };
  const state = { ...shared.emptyState() };
  const reasoning = { ...shared.emptyReasoning() };

  const sectionStat = await safeStatAsync(sectionPath);
  if (!sectionStat || !sectionStat.isDirectory()) {
    reasoning.reasoning_health_score = shared.computeHealthScore(reasoning);
    return { room: room, state: state, reasoning: reasoning };
  }

  const roomPath = path.join(sectionPath, 'ROOM.md');
  const [roomStat, roomBuf] = await Promise.all([
    safeStatAsync(roomPath),
    safeReadAsync(roomPath),
  ]);
  if (roomStat && roomStat.isFile() && roomBuf !== null) {
    Object.assign(room, shared.parseRoomMd(roomBuf, roomStat.mtimeMs));
  }

  const statePath = path.join(sectionPath, 'STATE.md');
  const [stateStat, stateBuf] = await Promise.all([
    safeStatAsync(statePath),
    safeReadAsync(statePath),
  ]);
  if (stateStat && stateStat.isFile() && stateBuf !== null) {
    Object.assign(state, shared.parseStateMd(stateBuf));
  }

  const mintoPath = path.join(sectionPath, 'MINTO.md');
  const [mintoStat, mintoBuf] = await Promise.all([
    safeStatAsync(mintoPath),
    safeReadAsync(mintoPath),
  ]);
  if (mintoStat && mintoStat.isFile() && mintoBuf !== null) {
    const parsed = shared.parseMintoMd(mintoBuf);
    Object.assign(reasoning, parsed);
    reasoning.exists = true;

    let invariantSeverity = null;
    try {
      const v = invariants.validate(mintoPath);
      invariantSeverity = v.severity;
    } catch (_e) {
      invariantSeverity = null;
    }

    const artifactMtimes = await collectArtifactMtimesAsync(sectionPath);
    const stale = shared.computeStale(
      reasoning,
      artifactMtimes,
      mintoStat.mtimeMs,
      invariantSeverity
    );
    reasoning.is_stale = stale.is_stale;
    reasoning.stale_reason = stale.stale_reason;
  }

  reasoning.reasoning_health_score = shared.computeHealthScore(reasoning);

  return { room: room, state: state, reasoning: reasoning };
}

/**
 * Async readDecisionLog. Promise resolves to the decision_log array
 * (same permissive shape as the sync twin).
 */
async function readDecisionLog(sectionPath) {
  const mintoPath = path.join(sectionPath, 'MINTO.md');
  const buf = await safeReadAsync(mintoPath);
  if (buf === null) return [];
  const parsed = shared.parseMintoMd(buf);
  return Array.isArray(parsed.decision_log) ? parsed.decision_log : [];
}

/**
 * computeHealthScore is pure-CPU (no I/O). Wrapped in an async function
 * so every exported name is an AsyncFunction, matching the Phase 87-04
 * enforcement pattern: the parity test asserts every async export is
 * constructor.name === 'AsyncFunction'. Wrapping eliminates the
 * footgun where a future maintainer could accidentally expose a
 * synchronous helper on the async surface.
 */
async function computeHealthScore(reasoning) {
  return shared.computeHealthScore(reasoning);
}

// ---------- Phase 90-04 readQuadruple async twin (additive) ----------
//
// Async pair of the sync readQuadruple. Same shape, same semantics.
// Key-set parity with the sync entry point is asserted by
// lib/memory/folder-memory-quadruple.test.cjs (the same mechanism used
// by the Phase 88-01 sync/async parity test).
//
// parseBrainMd in shared.cjs is a synchronous fs.readFileSync call.
// Wrapping the call inside an async function keeps the async surface
// consistent -- every exported name is an AsyncFunction, matching the
// Phase 87-04 enforcement pattern. The cost is one synchronous file
// read inside an async function; BRAIN.md is small (< 10KB in practice)
// and this call happens once per section per session-start, so the
// blocking cost is negligible compared to a dedicated promise-returning
// parse variant.

async function readQuadruple(sectionPath) {
  const triple = await readTriple(sectionPath);
  const brainPath = path.join(sectionPath, 'BRAIN.md');
  const brain = shared.parseBrainMd(brainPath);
  return shared.attachBrainToTriple(triple, brain);
}

/**
 * Async isQuadrupleFresh. Pure function wrapped in async to keep
 * key-set parity with the sync entry point. Same predicate semantics
 * as the sync version: reasoning.is_stale:false AND
 * (brain:null OR brain.staleness:'fresh' OR stale_reason:'brain_offline').
 */
async function isQuadrupleFresh(quadruple) {
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
  computeHealthScore: computeHealthScore,
};
