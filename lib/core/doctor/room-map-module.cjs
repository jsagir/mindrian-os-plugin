'use strict';
/*
 * lib/core/doctor/room-map-module.cjs -- Phase 353 Plan 01 Task 4 (D-353-9).
 *
 * Structural clone of lib/core/doctor/room-md-module.cjs. Both check(ctx)
 * and fix(ctx) are SYNCHRONOUS (the doctor engine's ALWAYS pass calls them
 * with no deferred-callback resolution anywhere in its dispatch; a
 * Promise-returning export would be misreported as a row with no status).
 * Never back-requires scripts/doctor.cjs (circular). Canon Part 8: pure
 * local fs walk through lib/core/room-map.cjs, zero network.
 *
 * WHAT check() DOES: rebuilds the target room's map from disk and compares
 * it against six drift classes, in this order:
 *   1. missing_map            -- .mindrian/room-map.json does not exist
 *   2. map_fingerprint_drift  -- a fresh build's fingerprint != the stored one
 *   3. dirs_without_room_md   -- a blocked-kind node (root|section|
 *                                structural|sub-room) has no ROOM.md
 *   4. block_fingerprint_drift-- a blocked-kind node's ROOM.md icm_self.
 *                                fingerprint != that node's own fingerprint
 *   5. artifact_with_block    -- an artifact-kind node's ROOM.md carries an
 *                                icm_self block by rule it must never have
 *                                (R-353-B)
 *   6. registry_lineage_drift -- a sub-room's registry parent/path disagrees
 *                                with disk (report-only; disk always wins,
 *                                per buildRoomMap's own crossCheckRegistry)
 *
 * WHAT fix() DOES: rebuilds the map, writes it, writes the self blocks
 * (which resolves classes 1-4 for any blocked-kind node), then re-checks.
 * Known limitation, stated here rather than silently: fix() does not strip
 * an errant icm_self block from an artifact folder (class 5) -- writeSelfBlocks
 * already refuses to touch an artifact node by rule, so a class-5 finding
 * is reported and left for the navigator's explicit review, never
 * auto-removed. This is a report-first posture, consistent with D-353-9.
 *
 * D-353-9 / R-353-A: this row ships in the SEVEN-key shape data/doctor-
 * modules.json already carries; NO `auto_heal` key is minted by this
 * phase. Phase 352 classifies both this row and section-ruling when it
 * lands (proposed here: room-map TRUE, a rebuild-from-disk is mechanical
 * and reversible).
 *
 * D-353-9 recoverable:false guard: `check()` sets `recoverable: false`
 * whenever the resolved room path is NOT under tests/fixtures/icm-rooms/,
 * computed from PLUGIN_ROOT and compared after path.resolve (never a
 * substring match on a raw string, so a room literally named to imitate the
 * fixture directory cannot spoof it -- T-353-08). The doctor engine's own
 * fix gate at scripts/doctor.cjs is
 *   wantFix && mod.fix_supported === true && typeof fixFn === 'function' &&
 *   (result.status === 'warn' || result.status === 'error') &&
 *   result.recoverable !== false
 * so `recoverable:false` is the mechanism that refuses to auto-heal a real
 * fleet room; `--fix` on a real room stays the navigator's explicit act.
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

const FIXTURE_PREFIX = path.resolve(PLUGIN_ROOT, 'tests', 'fixtures', 'icm-rooms');

// T-353-08: compare resolved, absolute paths, never a substring match on a
// raw string, so a room named to imitate the fixture directory cannot spoof
// the recoverable:false guard.
function isUnderFixturePrefix(candidatePath) {
  const resolved = path.resolve(candidatePath);
  return resolved === FIXTURE_PREFIX || resolved.startsWith(FIXTURE_PREFIX + path.sep);
}

// Scope resolution, mirroring room-md-module.cjs's registry + .room-root
// sentinel gate (Canon Part 7 reuse).
function resolveActiveRoomPath() {
  const reg = readRegistry();
  if (!reg) {
    return { skip: true, detail: 'no registry; room-map check scoped to the active room' };
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

function readIcmSelf(roomPath, nodePath) {
  const dirAbs = nodePath === '.' ? roomPath : path.join(roomPath, nodePath);
  const roomMdPath = path.join(dirAbs, 'ROOM.md');
  if (!fs.existsSync(roomMdPath)) return { exists: false, icmSelf: null };
  try {
    const data = matter(fs.readFileSync(roomMdPath, 'utf8')).data || {};
    return { exists: true, icmSelf: data.icm_self || null };
  } catch (_e) {
    return { exists: true, icmSelf: null };
  }
}

// check(ctx) -- ctx.roomPath is a test seam (mirrors ctx.check_result being
// the engine's own seam for fix()); production callers never set it and the
// registry-derived active room is used instead.
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

  const drift = {
    missing_map: [],
    map_fingerprint_drift: [],
    dirs_without_room_md: [],
    block_fingerprint_drift: [],
    artifact_with_block: [],
    registry_lineage_drift: [],
  };

  const stored = roomMap.readRoomMap(roomPath);
  if (!stored.ok) {
    drift.missing_map.push(roomPath);
  } else if (stored.map && stored.map.fingerprint !== freshMap.fingerprint) {
    drift.map_fingerprint_drift.push({ stored: stored.map.fingerprint, fresh: freshMap.fingerprint });
  }

  for (const node of freshMap.nodes) {
    if (node.registry_drift) {
      drift.registry_lineage_drift.push({ path: node.path, drift: node.registry_drift });
    }

    if (roomMap.SELF_BLOCK_KINDS.has(node.kind)) {
      if (!node.has_room_md) {
        drift.dirs_without_room_md.push(node.path);
        continue;
      }
      const read = readIcmSelf(roomPath, node.path);
      const nodeFp = roomMap.mapFingerprint([node]);
      if (read.icmSelf && read.icmSelf.fingerprint !== nodeFp) {
        drift.block_fingerprint_drift.push(node.path);
      }
    } else if (node.kind === 'artifact') {
      const read = readIcmSelf(roomPath, node.path);
      if (read.icmSelf) {
        drift.artifact_with_block.push(node.path);
      }
    }
  }

  const totalDrift = Object.keys(drift).reduce((n, k) => n + drift[k].length, 0);
  const recoverable = isUnderFixturePrefix(roomPath);

  if (totalDrift === 0) {
    return {
      status: 'ok',
      detail: freshMap.nodes.length + ' node(s) checked, 0 drift',
      roomPath: roomPath,
      drift: drift,
      recoverable: recoverable,
    };
  }

  const namedCounts = Object.keys(drift)
    .filter((k) => drift[k].length > 0)
    .map((k) => k + ':' + drift[k].length)
    .join(', ');
  const recoverableNote = recoverable
    ? ''
    : '; recoverable:false -- outside tests/fixtures/icm-rooms, --fix refuses to auto-heal a real fleet room (D-353-9), rebuild manually as the navigator\'s explicit act';
  return {
    status: 'warn',
    detail: totalDrift + ' drift finding(s) (' + namedCounts + ')' + recoverableNote,
    roomPath: roomPath,
    drift: drift,
    recoverable: recoverable,
  };
}

// fix(ctx) -- the engine passes the just-run check result on ctx.check_result.
function fix(ctx) {
  const c = ctx || {};
  const checkResult = c.check_result;
  if (!checkResult || checkResult.status !== 'warn') {
    return { status: 'skip', detail: 'no room-map drift to recover', tool: 'room-map-module' };
  }
  if (checkResult.recoverable === false) {
    return {
      status: 'skip',
      detail: 'recoverable:false -- room path is outside tests/fixtures/icm-rooms/; --fix refuses to auto-heal a real fleet room (D-353-9); the navigator rebuilds it explicitly instead',
      tool: 'room-map-module',
    };
  }
  const roomPath = checkResult.roomPath;
  if (!roomPath) {
    return { status: 'error', detail: 'roomPath not set on check result', tool: 'room-map-module' };
  }

  try {
    const freshMap = roomMap.buildRoomMap(roomPath);
    const writeResult = roomMap.writeRoomMap(roomPath, freshMap);
    if (!writeResult.ok) {
      return {
        status: 'error',
        detail: 'writeRoomMap failed: ' + (writeResult.detail || writeResult.reason || 'unknown'),
        tool: 'room-map-module',
      };
    }
    roomMap.writeSelfBlocks(roomPath, freshMap);
  } catch (e) {
    return {
      status: 'error',
      detail: 'rebuild threw: ' + String((e && e.message) || e).slice(0, 80),
      tool: 'room-map-module',
    };
  }

  const after = check({ roomPath: roomPath });
  if (after.status === 'ok') {
    return { status: 'ok', detail: 'room-map rebuilt; 0 drift remaining', tool: 'room-map-module' };
  }
  return {
    status: 'partial',
    detail: 'room-map rebuilt; drift remaining: ' + after.detail,
    tool: 'room-map-module',
    remaining: after.drift,
  };
}

module.exports = {
  check: check,
  fix: fix,
};
