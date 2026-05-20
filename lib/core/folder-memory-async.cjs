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
// Phase 128.1-03b: the canonical session-scoped active-room resolver.
// resolveCanonicalStateMdAsync's Strategy 1 was a Bucket B-reader of the
// racing global `active` string; it now routes through resolveActiveRoom
// (D-03). The resolver is synchronous and never throws -- safe to call from
// an async function; the disk read it does is a single small JSON file.
const sessionBinding = require('./session-binding.cjs');

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

// ---------- Phase 94-01 getCurrentRoom async twin ----------
//
// Async pair of the sync getCurrentRoom. Same shape, same fallback
// chain, same Tier 0 graceful null. Key-set parity required by the
// Phase 88-01 sync/async parity test in lib/memory/folder-memory.test.cjs.
//
// MCP / Desktop / Cowork callers consume this when the handler loop is
// async; CLI hook scripts (statusline, session-start, on-stop) consume
// the sync entry point. Both return identical {slug, path, source} | null
// shape so the canonical contract is surface-uniform.

/**
 * Resolve canonical STATE.md path async. Mirror of the sync helper.
 *
 * Phase 128.1-03b: Strategy 1 previously read `reg.active` from a
 * registry.json directly -- a Bucket B-reader of the racing global string.
 * It now routes through session-binding.resolveActiveRoom so concurrent
 * sessions resolve their own room (D-03). The `tripwire` signal is
 * destructured but not acted on here -- Plan 05 owns that surface.
 *
 * @param {string} workDir
 * @returns {Promise<string|null>}
 */
async function resolveCanonicalStateMdAsync(workDir) {
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
      const st = await safeStatAsync(candidate);
      if (st && st.isFile()) return candidate;
    }
  } catch (_e) { /* fall through */ }

  const legacy = path.join(resolved, 'room', 'STATE.md');
  const legacyStat = await safeStatAsync(legacy);
  if (legacyStat && legacyStat.isFile()) return legacy;

  const direct = path.join(resolved, 'STATE.md');
  const directStat = await safeStatAsync(direct);
  if (directStat && directStat.isFile()) return direct;

  return null;
}

/**
 * Pure-CPU frontmatter sniff. Lifted byte-identical from the sync twin.
 * @param {string} buf
 * @returns {string|null}
 */
function parseCurrentRoomFieldAsync(buf) {
  if (typeof buf !== 'string' || buf.length === 0) return null;

  if (buf.indexOf('---') !== 0) return null;
  if (buf.length < 4) return null;
  if (buf[3] !== '\n' && buf[3] !== '\r') return null;

  const rest = buf.slice(buf.indexOf('\n') + 1);
  const closeMatch = rest.match(/^---\s*$/m);
  if (!closeMatch) return null;
  const fmText = rest.slice(0, closeMatch.index);

  const lines = fmText.split(/\r?\n/);
  for (const raw of lines) {
    if (raw.length === 0) continue;
    if (/^\s*#/.test(raw)) continue;
    const m = raw.match(/^current_room\s*:\s*(.+?)\s*$/);
    if (!m) continue;
    let value = m[1].trim();
    if (value.length === 0) return null;
    if (value === 'null' || value === '~') return null;

    if (
      (value[0] === '"' && value[value.length - 1] === '"') ||
      (value[0] === "'" && value[value.length - 1] === "'")
    ) {
      if (value.length >= 2) value = value.slice(1, -1).trim();
    }
    if (value.length === 0) return null;
    if (value.indexOf(':') !== -1) return null;

    return value;
  }
  return null;
}

/**
 * Async getCurrentRoom. Mirror of sync twin. Returns Promise resolving
 * to {slug, path, source: 'state_md'} | null. Never rejects on missing
 * files or malformed YAML; the resolution chain plus null on every
 * failure mode matches sync semantics byte for byte.
 *
 * @param {string} [workDir]
 * @returns {Promise<{slug:string,path:string,source:'state_md'}|null>}
 */
async function getCurrentRoom(workDir) {
  const root = workDir || process.cwd();
  const statePath = await resolveCanonicalStateMdAsync(root);
  if (!statePath) return null;

  const buf = await safeReadAsync(statePath);
  if (buf === null) return null;

  let slug;
  try {
    slug = parseCurrentRoomFieldAsync(buf);
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
  computeHealthScore: computeHealthScore,
  getCurrentRoom: getCurrentRoom,
};
