'use strict';
/*
 * lib/core/doctor/section-ruling-module.cjs -- Phase 353 Plan 02 Task 9
 * (D-353-9, R-353-A, R-353-M).
 *
 * Structural sibling of lib/core/doctor/room-map-module.cjs. Both check(ctx)
 * and fix(ctx) are SYNCHRONOUS. Never back-requires scripts/doctor.cjs.
 *
 * WHAT check() DOES: over the active room (or ctx.roomPath, the test seam),
 * reports FIVE named drift classes:
 *   1. ruling_fingerprint_drift  -- a section's landed CONTEXT.md
 *      ruling_fingerprint disagrees with a fresh recomputation from the
 *      canon row plus the shipped ledger row
 *   2. sections_without_job_id   -- a section slug with no job: no row in
 *      data/section-job-canon.json and no accepted declaration in the room's
 *      <room>/.mindrian/section-jobs.json (getSectionJob returns
 *      reason:'undeclared')
 *   3. subrooms_without_job_id   -- a sub-room node whose job_id is null
 *      (Plan 01's parent-fallback case), reported as drift, not an error
 *   4. claims_without_anchor     -- claim nodes created ON OR AFTER this
 *      module's own INTRODUCED_AT_MS with no SOURCED_FROM edge to a
 *      `jtbd:*` target (legacy claims stay out of scope, D-353-8)
 *   5. room_declarations_rejected -- an entry (or the whole file) of the
 *      room's section-jobs.json that the registry rejected (quick 261028-gmg)
 * It also returns job_sources { canon, room }: the section paths whose job
 * comes from the shipped canon, and those whose job comes from the room's
 * ratified declaration. job_sources is information, not drift.
 *
 * WHAT fix() DOES: regenerates every drifted section's ruling document
 * through lib/core/room-skeleton-scaffold.cjs's generator (Task 4), then
 * re-checks. Never touches sections_without_job_id: a standard section is a
 * canon-file edit, and a custom section is a navigator-ratified entry in
 * <room>/.mindrian/section-jobs.json; fix() writes neither. Never touches
 * subrooms_without_job_id (the navigator's birth-time declaration, Plan 01),
 * room_declarations_rejected, or claims_without_anchor (re-anchoring legacy
 * claims is explicitly out of scope, 353-CONTEXT.md).
 *
 * D-353-9 recoverable:false guard: identical T-353-08 discipline to
 * room-map-module.cjs -- `check()` sets `recoverable: false` whenever the
 * resolved room path is NOT under tests/fixtures/icm-rooms/, so `--fix`
 * cannot regenerate a ruling document in a real fleet room without the
 * navigator's explicit act (a regeneration rewrites a file a human may have
 * authored prose into, a judgment fix per R-353-A's carried-forward note).
 *
 * R-353-A: this row ships in the SEVEN-key shape data/doctor-modules.json
 * already carries; no `auto_heal` key is minted here. Phase 352 classifies
 * it when it lands (proposed here: FALSE, for the reason stated above).
 *
 * Canon Part 9 / lib/core/doctor/ substrate reach: this directory is not
 * allow-listed to require node:sqlite or room-db.cjs directly.
 * lib/core/navigation/ is allow-listed; the read-only door
 * (openRoomDbReadOnlyForCaller/closeRoomDbForCaller) lives in
 * navigation/spine-events.cjs, and the claims_without_anchor SQL statement
 * lives in navigation/section-gate.cjs (Task 9's own addition to Task 7's
 * file) -- this module carries no raw SELECT of its own.
 *
 * Contract: check(ctx) -> { status:'ok'|'warn'|'skip'|'error', detail,
 *   roomPath?, drift?, recoverable? }. fix(ctx) -> { status:'ok'|'partial'|
 *   'error'|'skip', detail, tool, remaining? }, reading ctx.check_result.
 * Every return path, including 'skip' and 'ok', carries a non-empty
 * `detail` string (D-03 rule 9).
 */

const fs = require('node:fs');
const path = require('node:path');
const matter = require('gray-matter');

const { readRegistry, PLUGIN_ROOT } = require('./shared.cjs');
const roomMap = require('../room-map.cjs');
const sectionRegistry = require('../section-registry.cjs');
const scaffold = require('../room-skeleton-scaffold.cjs');
const { openRoomDbReadOnlyForCaller, closeRoomDbForCaller } = require('../navigation/spine-events.cjs');
const { countClaimsWithoutJtbdAnchor } = require('../navigation/section-gate.cjs');

const FIXTURE_PREFIX = path.resolve(PLUGIN_ROOT, 'tests', 'fixtures', 'icm-rooms');
const LEDGER_PATH = path.join(PLUGIN_ROOT, 'data', 'section-command-ledger.json');

// This module's own introduced-at stamp (Phase 353 Plan 02 landed
// 2026-09-17): claims created before this moment are legacy and stay out of
// scope, mirroring graph-integrity-counts.cjs's own LEGACY_COHORT_BEFORE_MS
// idiom. A version string (`introduced_version` on the registry row) has no
// wall-clock meaning a SQL cutoff can use; this constant is the doctor
// module's own operational date, independent of the registry row's label.
const INTRODUCED_AT_MS = Date.parse('2026-09-17T00:00:00.000Z');

function isUnderFixturePrefix(candidatePath) {
  const resolved = path.resolve(candidatePath);
  return resolved === FIXTURE_PREFIX || resolved.startsWith(FIXTURE_PREFIX + path.sep);
}

function resolveActiveRoomPath() {
  const reg = readRegistry();
  if (!reg) {
    return { skip: true, detail: 'no registry; section-ruling check scoped to the active room' };
  }
  const activeName = reg.registry && reg.registry.active;
  if (!activeName) {
    return { skip: true, detail: 'no active room' };
  }
  const activeInfo = (reg.registry.rooms || {})[activeName];
  if (!activeInfo || !activeInfo.path) {
    return { skip: true, detail: 'active room not in registry' };
  }
  const roomPath = path.isAbsolute(activeInfo.path)
    ? activeInfo.path
    : path.join(reg.roomsHome, activeInfo.path);
  if (!fs.existsSync(path.join(roomPath, '.room-root'))) {
    return { skip: true, detail: 'active room missing .room-root sentinel', roomPath: roomPath };
  }
  return { skip: false, roomPath: roomPath };
}

function loadLedgerSafely() {
  try {
    return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
  } catch (_e) {
    return null;
  }
}

function readContextFrontmatter(roomPath, sectionPath) {
  const contextPath = path.join(roomPath, sectionPath, 'CONTEXT.md');
  if (!fs.existsSync(contextPath)) return { exists: false, data: {} };
  try {
    const data = matter(fs.readFileSync(contextPath, 'utf8')).data || {};
    return { exists: true, data: data };
  } catch (_e) {
    return { exists: true, data: {} };
  }
}

function check(ctx) {
  const c = ctx || {};
  let roomPath;
  if (typeof c.roomPath === 'string' && c.roomPath.length > 0) {
    roomPath = c.roomPath;
  } else {
    const resolved = resolveActiveRoomPath();
    if (resolved.skip) {
      return { status: 'skip', detail: resolved.detail, roomPath: resolved.roomPath };
    }
    roomPath = resolved.roomPath;
  }

  let freshMap;
  try {
    freshMap = roomMap.buildRoomMap(roomPath);
  } catch (e) {
    return {
      status: 'error',
      detail: 'buildRoomMap threw: ' + String((e && e.message) || e).slice(0, 80),
      roomPath: roomPath,
    };
  }

  const ledger = loadLedgerSafely();

  // One read of the room's declaration file per check (quick 261028-gmg).
  const roomDecl = sectionRegistry.readRoomSectionJobs(roomPath);

  const drift = {
    ruling_fingerprint_drift: [],
    sections_without_job_id: [],
    subrooms_without_job_id: [],
    claims_without_anchor: 0,
    room_declarations_rejected: roomDecl.rejected,
  };
  const jobSources = { canon: [], room: [] };
  const actionLines = [];

  for (const node of freshMap.nodes) {
    if (node.kind === 'section') {
      const slug = path.basename(node.path);
      const canonRow = sectionRegistry.getSectionJob(slug, roomPath);
      if (!canonRow || !canonRow.job_id) {
        drift.sections_without_job_id.push(node.path);
        continue;
      }
      if (canonRow.source === 'room-declaration') {
        // A room-declared job has no fingerprint check on purpose: no shipped
        // contract template exists for a custom slug, so writeSectionContracts
        // emits contract_template_missing for it, fix() can never generate a
        // ruling document, and the drift would never clear.
        jobSources.room.push(node.path);
        actionLines.push('room-declared: ' + node.path + ' -> ' + canonRow.job_id
          + ' (ratified by ' + canonRow.ratified_by + ' on ' + canonRow.ratified_at + ')');
        continue;
      }
      jobSources.canon.push(node.path);
      const expected = scaffold.buildRulingBlock(canonRow, ledger);
      const landed = readContextFrontmatter(roomPath, node.path);
      if (!landed.exists || landed.data.ruling_fingerprint !== expected.fingerprint) {
        drift.ruling_fingerprint_drift.push(node.path);
      }
    } else if (node.kind === 'sub-room') {
      if (!node.job_id) {
        drift.subrooms_without_job_id.push(node.path);
      }
    }
  }

  let db = null;
  try {
    db = openRoomDbReadOnlyForCaller(roomPath);
    if (db) {
      const count = countClaimsWithoutJtbdAnchor(db, INTRODUCED_AT_MS);
      drift.claims_without_anchor = (typeof count === 'number') ? count : 0;
    }
  } catch (_e) {
    drift.claims_without_anchor = 0;
  } finally {
    if (db) closeRoomDbForCaller(db);
  }

  const totalDrift = drift.ruling_fingerprint_drift.length
    + drift.sections_without_job_id.length
    + drift.subrooms_without_job_id.length
    + drift.claims_without_anchor
    + drift.room_declarations_rejected.length;

  for (const e of drift.room_declarations_rejected) {
    actionLines.push('rejected declaration: ' + (e.slug === null ? 'file' : e.slug)
      + ' (' + e.reason + ') in ' + sectionRegistry.ROOM_SECTION_JOBS_REL);
  }
  if (drift.sections_without_job_id.length > 0) {
    actionLines.push('undeclared section(s): ' + drift.sections_without_job_id.join(', ')
      + '. Declare each in ' + sectionRegistry.ROOM_SECTION_JOBS_REL
      + ' under sections.<slug> with job_id, ratified_by and ratified_at; job ids come from the closed job vocabulary and the navigator ratifies each one.');
  }
  const sourcesNote = '; job sources: canon:' + jobSources.canon.length + ', room-declared:' + jobSources.room.length;

  const recoverable = isUnderFixturePrefix(roomPath);

  if (totalDrift === 0) {
    const okResult = {
      status: 'ok',
      detail: freshMap.nodes.length + ' node(s) checked, 0 drift '
        + '(ruling_fingerprint_drift:0, sections_without_job_id:0, subrooms_without_job_id:0, claims_without_anchor:0, room_declarations_rejected:0)'
        + sourcesNote,
      roomPath: roomPath,
      drift: drift,
      job_sources: jobSources,
      recoverable: recoverable,
    };
    if (actionLines.length > 0) okResult.action_lines = actionLines;
    return okResult;
  }

  const namedCounts = 'ruling_fingerprint_drift:' + drift.ruling_fingerprint_drift.length
    + ', sections_without_job_id:' + drift.sections_without_job_id.length
    + ', subrooms_without_job_id:' + drift.subrooms_without_job_id.length
    + ', claims_without_anchor:' + drift.claims_without_anchor
    + ', room_declarations_rejected:' + drift.room_declarations_rejected.length;
  const cutNote = drift.room_declarations_rejected.length > 0 ? '; rejected values cut to 64 chars' : '';
  const recoverableNote = recoverable
    ? ''
    : '; recoverable:false -- outside tests/fixtures/icm-rooms, --fix refuses to auto-heal a real fleet room (D-353-9), rebuild manually as the navigator\'s explicit act';
  const warnResult = {
    status: 'warn',
    detail: totalDrift + ' drift finding(s) (' + namedCounts + ')' + sourcesNote + cutNote + recoverableNote,
    roomPath: roomPath,
    drift: drift,
    job_sources: jobSources,
    recoverable: recoverable,
  };
  if (actionLines.length > 0) warnResult.action_lines = actionLines;
  return warnResult;
}

function fix(ctx) {
  const c = ctx || {};
  const checkResult = c.check_result;
  if (!checkResult || checkResult.status !== 'warn') {
    return { status: 'skip', detail: 'no section-ruling drift to recover', tool: 'section-ruling-module' };
  }
  if (checkResult.recoverable === false) {
    return {
      status: 'skip',
      detail: 'recoverable:false -- room path is outside tests/fixtures/icm-rooms/; --fix refuses to auto-heal a real fleet room (D-353-9); the navigator regenerates it explicitly instead',
      tool: 'section-ruling-module',
    };
  }
  const roomPath = checkResult.roomPath;
  if (!roomPath) {
    return { status: 'error', detail: 'roomPath not set on check result', tool: 'section-ruling-module' };
  }
  const drifted = (checkResult.drift && checkResult.drift.ruling_fingerprint_drift) || [];
  if (drifted.length === 0) {
    return { status: 'ok', detail: 'no ruling_fingerprint_drift to regenerate; other drift classes are report-only (sections_without_job_id, subrooms_without_job_id, claims_without_anchor, room_declarations_rejected)', tool: 'section-ruling-module' };
  }
  const slugs = drifted.map((p) => path.basename(p));
  try {
    const result = { warnings: [], errors: [], contracts_created: [], ruling_regenerated: [] };
    scaffold.writeSectionContracts(roomPath, slugs, result);
  } catch (e) {
    return {
      status: 'error',
      detail: 'regeneration threw: ' + String((e && e.message) || e).slice(0, 80),
      tool: 'section-ruling-module',
    };
  }

  const after = check({ roomPath: roomPath });
  if (after.status === 'ok') {
    return { status: 'ok', detail: slugs.length + ' ruling document(s) regenerated; 0 drift remaining', tool: 'section-ruling-module' };
  }
  return {
    status: 'partial',
    detail: slugs.length + ' ruling document(s) regenerated; drift remaining: ' + after.detail,
    tool: 'section-ruling-module',
    remaining: after.drift,
  };
}

module.exports = { check: check, fix: fix };
