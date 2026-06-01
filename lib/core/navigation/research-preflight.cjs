'use strict';
/*
 * Phase 131-01 -- research-preflight: the batched Stage-1 PRE-FLIGHT read for the
 * source-lens research pipeline. getResearchPreflight collapses the 8 sequential
 * Stage-1 reads (per 131-CONTEXT.md "Stage 1 -- PRE-FLIGHT, 8 inputs") into ONE
 * navigation.cjs round-trip (the 4.8 re-baseline change). The driver (Plan 03),
 * the wirer + F.1 selector (Plan 04), and the command orchestration (Plan 05) all
 * call this single read before fetching, so research becomes context-aware rather
 * than blind.
 *
 * This module is an allow-listed navigation submodule (scripts/check-substrate.cjs
 * regex /^lib\/core\/navigation\// covers it). It is READ-ONLY over room.db +
 * USER.md. It takes a caller-owned db handle for the db-keyed reads (getActiveFocus
 * / findUnsupportedClaims / findBlockingAssumptions / findRecentChanges) and a
 * roomDir for the roomDir-keyed reads (getCurrentJTBD / getCurrentOperator /
 * USER.md role_blend). It NEVER requires node:sqlite and NEVER opens room.db
 * itself -- exactly like evidence-claim.cjs and lens-nodes.cjs. Zero substrate
 * bypass.
 *
 * Exports:
 *   getResearchPreflight(db, opts) -> { active_workflow, active_jtbd, operator,
 *     current_section, recent_changes, evidence_gaps, prior_research, role_blend }
 *
 * The 8 inputs (per 131-CONTEXT.md Stage 1):
 *   1. active_workflow  -- the calling workflow stage (getActiveFocus focusType).
 *   2. active_jtbd      -- getCurrentJTBD(roomDir) (event-log-authoritative).
 *   3. operator         -- getCurrentOperator(roomDir) (event-log-authoritative).
 *   4. current_section  -- getActiveFocus focusNodeId (the room location pointer).
 *   5. recent_changes   -- findRecentChanges tail (the conversation arc).
 *   6. evidence_gaps    -- findUnsupportedClaims + findBlockingAssumptions (the
 *                          needs_evidence claims).
 *   7. prior_research   -- a documented PLACEHOLDER array. The source-lens driver
 *                          (Plan 03) fills it via the Phase 130.5 cache + Pinecone
 *                          semantic dedup at Stage 4. This module is read-only over
 *                          room.db + USER.md and does NOT call the corpus.
 *   8. role_blend       -- the Phase 115 USER.md role_blend tuple (persona).
 *
 * Canon Part 9: SQL is the local mind; every sub-read goes through an existing
 *   chokepoint reader -- ZERO new SQL here, composition not duplication.
 * Canon Part 8: zero network surface. Pure LOCAL reads. prior_research is NOT
 *   fetched here; the corpus call lives in the driver. No Brain calls.
 * Defensive: every sub-read is wrapped so one failure degrades THAT key to null/[]
 *   and NEVER aborts the batch (the navigator always gets all 8 keys).
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const focus = require('./focus.cjs');
const memoryEvents = require('./memory-events.cjs');
const insights = require('./insights.cjs');
const spineEvents = require('./spine-events.cjs');
const userMdOps = require('../user-md-ops.cjs');

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Read the Phase 115 USER.md role_blend tuple. Mirrors lib/core/lens-engine.cjs
// readRoleBlend (which is module-private there) so the pre-flight does not depend
// on a non-exported helper. Pure read; never throws on a missing / malformed
// USER.md. Returns the role_blend object or null.
function readRoleBlend(roomDir) {
  if (typeof roomDir !== 'string' || roomDir.length === 0) return null;
  try {
    const userMdPath = roomDir.replace(/\/+$/, '') + '/USER.md';
    const user = userMdOps.readUserMd(userMdPath);
    if (user && isPlainObject(user.role_blend)) return user.role_blend;
  } catch (_e) {
    // Defensive: a persona-read failure must never break the pre-flight.
  }
  return null;
}

// Run a sub-read with a fallback. Any throw degrades to the fallback value so one
// failed key never aborts the whole batch (the navigator always gets all 8 keys).
function safe(fn, fallback) {
  try {
    const v = fn();
    return v === undefined ? fallback : v;
  } catch (_e) {
    return fallback;
  }
}

// getResearchPreflight(db, opts) -- compose the 8 Stage-1 inputs in ONE pass.
//
// opts = { roomDir, sessionId, topic }. db is a caller-owned room.db handle for
// the db-keyed reads. roomDir is for the roomDir-keyed reads (getCurrentJTBD /
// getCurrentOperator / USER.md role_blend). topic is forwarded for symmetry with
// the driver (this module does not fetch on it). Returns an object with ALL 8
// keys; missing inputs degrade to null / [] but the key is always present.
function getResearchPreflight(db, opts) {
  const options = isPlainObject(opts) ? opts : {};
  const roomDir = typeof options.roomDir === 'string' ? options.roomDir : null;
  const sessionId = typeof options.sessionId === 'string' ? options.sessionId : null;

  // 1 + 4. Active focus -> active_workflow (focusType) + current_section (focusNodeId).
  const activeFocus = (db && sessionId)
    ? safe(() => focus.getActiveFocus(db, sessionId), null)
    : null;
  const activeWorkflow = activeFocus && typeof activeFocus.focusType === 'string'
    ? activeFocus.focusType : null;
  const currentSection = activeFocus && typeof activeFocus.focusNodeId === 'string'
    ? activeFocus.focusNodeId : null;

  // 2. active_jtbd -- event-log-authoritative (roomDir-keyed).
  const activeJtbd = roomDir
    ? safe(() => spineEvents.getCurrentJTBD(roomDir), null)
    : null;

  // 3. operator -- event-log-authoritative (roomDir-keyed).
  const operator = roomDir
    ? safe(() => spineEvents.getCurrentOperator(roomDir), null)
    : null;

  // 5. recent_changes -- the memory_event tail (the conversation arc). Last 10.
  const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentChanges = db
    ? safe(() => memoryEvents.findRecentChanges(db, since, { limit: 10 }), [])
    : [];

  // 6. evidence_gaps -- the needs_evidence claims: unsupported claims + blocking
  // assumptions. Composed from the two existing insight readers; findUnsupported
  // is room-scoped, findBlocking is goal-scoped to the current section (when one
  // is in focus). Each degrades to [] independently.
  const unsupported = db
    ? safe(() => insights.findUnsupportedClaims(db, roomDir ? ('room:' + roomDir) : null), [])
    : [];
  const blocking = (db && currentSection)
    ? safe(() => insights.findBlockingAssumptions(db, currentSection), [])
    : [];
  const evidenceGaps = []
    .concat(Array.isArray(unsupported) ? unsupported : [])
    .concat(Array.isArray(blocking) ? blocking : []);

  // 7. prior_research -- PLACEHOLDER. Filled by source-lens-driver Stage 4 dedup
  // (Plan 03) via the Phase 130.5 cache + Pinecone semantic search. This module is
  // read-only over room.db + USER.md and does NOT call the corpus here.
  const priorResearch = [];

  // 8. role_blend -- Phase 115 USER.md persona tuple.
  const roleBlend = readRoleBlend(roomDir);

  return {
    active_workflow: activeWorkflow,
    active_jtbd: activeJtbd,
    operator: operator,
    current_section: currentSection,
    recent_changes: Array.isArray(recentChanges) ? recentChanges : [],
    evidence_gaps: evidenceGaps,
    prior_research: priorResearch,
    role_blend: roleBlend,
  };
}

module.exports = { getResearchPreflight };
