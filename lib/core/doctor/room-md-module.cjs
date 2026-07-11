'use strict';
/*
 * lib/core/doctor/room-md-module.cjs -- Phase 217 Plan 04 (D-01/D-02).
 *
 * The class-E "room-md" doctor check + fix, migrated out of the doctor CLI inline
 * main() block (check) and the main() --fix dispatch (fix) into a registry-driven
 * cadence:always runner. The engine's fix-then-recheck flow (Plan 01) now owns the
 * dispatch the old main() block did by hand.
 *
 * WHAT check() DOES: walks the active room's subdirectories under `.room-root` and
 * reports any directory missing ROOM.md or MINTO.md. The pre-commit guard (Phase
 * 87-01a) enforces both files at every level under a `.room-root` subtree; this
 * check is the doctor-side detector for that same invariant.
 *
 * WHAT fix() DOES: invokes scripts/generate-section-intelligence.cjs --recursive
 * against the active room and re-checks. PRESERVES the pre-migration recovery record
 * shape verbatim, including its own `tool: 'generate-section-intelligence'` field --
 * the engine glue lets a fixer's own tool field win over the module id, so the
 * report.recovered entry stays shape-identical to what the old main() dispatch
 * pushed.
 *
 * Contract: check(ctx) -> { status:'ok'|'warn'|'skip', detail, missing[], roomPath?,
 *   subdirs? }. fix(ctx) -> the recovery record (status ok|partial|error|skip, detail,
 *   tool). Reads ctx.check_result (the just-run check result the engine passes) as the
 *   performRoomMdRecovery input.
 *
 * Canon Part 8: pure LOCAL scan + local generator spawn -- zero network, zero Brain.
 * Never back-requires the doctor CLI (circular). Requires node built-ins + ./shared.cjs
 * (readRegistry, PLUGIN_ROOT for the generator path).
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { readRegistry, PLUGIN_ROOT } = require('./shared.cjs');

// Directories the section walk never descends into (system + build noise).
const SKIP_DIRS = new Set([
  '.git', '.mindrian', '.context', '.lazygraph', '.rooms',
  'node_modules', '.next', 'dist', 'build', '.cache',
]);

// Walk subdirectories under rootDir, returning absolute paths. Skips SKIP_DIRS
// and respects maxDepth (default 8). Enumerates section + sub-section dirs under
// a .room-root.
function listSubdirs(rootDir, opts) {
  const o = opts || {};
  const recursive = o.recursive !== false;
  const maxDepth = typeof o.maxDepth === 'number' ? o.maxDepth : 8;
  const results = [];
  function walk(dir, depth) {
    if (depth > maxDepth) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (_) { return; }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (SKIP_DIRS.has(entry.name)) continue;
      const sub = path.join(dir, entry.name);
      results.push(sub);
      if (recursive) walk(sub, depth + 1);
    }
  }
  walk(rootDir, 0);
  return results;
}

// Spawn scripts/generate-section-intelligence.cjs as a child process to remediate
// missing ROOM.md/MINTO.md across a room subtree. Returns a normalized result.
// The generator path is re-based off PLUGIN_ROOT (this file sits three levels below
// the repo root at lib/core/doctor/, vs the doctor CLI one level below).
function invokeGenerator(targetDir, opts) {
  const o = opts || {};
  const recursive = o.recursive !== false;
  const force = !!o.force;
  const generatorPath = path.join(PLUGIN_ROOT, 'scripts', 'generate-section-intelligence.cjs');
  if (!fs.existsSync(generatorPath)) {
    return { status: 'error', detail: 'generator not found at ' + generatorPath, stdout: '', stderr: '', exitCode: -1 };
  }
  const args = [generatorPath, targetDir];
  if (recursive) args.push('--recursive');
  if (force) args.push('--force');
  const res = spawnSync('node', args, { encoding: 'utf8', timeout: 30000 });
  return {
    status: res.status === 0 ? 'ok' : 'error',
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    exitCode: typeof res.status === 'number' ? res.status : -1,
  };
}

// check(ctx) -- read-only ROOM.md/MINTO.md presence scan under the active room.
function check(_ctx) {
  const reg = readRegistry();
  if (!reg) {
    return { status: 'skip', detail: 'no registry; class E scoped to active room', missing: [] };
  }
  const activeName = reg.registry && reg.registry.active;
  if (!activeName) {
    return { status: 'skip', detail: 'no active room', missing: [] };
  }
  const activeInfo = (reg.registry.rooms || {})[activeName];
  if (!activeInfo || !activeInfo.path) {
    return { status: 'skip', detail: 'active room not in registry', missing: [] };
  }
  const roomPath = path.isAbsolute(activeInfo.path)
    ? activeInfo.path
    : path.join(reg.roomsHome, activeInfo.path);
  // Sentinel must exist for class E to apply (Phase 87-01a guard scope).
  if (!fs.existsSync(path.join(roomPath, '.room-root'))) {
    return { status: 'skip', detail: 'active room missing .room-root sentinel (class B finding)', missing: [], roomPath };
  }
  const subdirs = listSubdirs(roomPath, { recursive: true, maxDepth: 8 });
  const missing = [];
  for (const subdir of subdirs) {
    const hasRoom = fs.existsSync(path.join(subdir, 'ROOM.md'));
    const hasMinto = fs.existsSync(path.join(subdir, 'MINTO.md'));
    if (!hasRoom || !hasMinto) {
      const filesMissing = [];
      if (!hasRoom) filesMissing.push('ROOM.md');
      if (!hasMinto) filesMissing.push('MINTO.md');
      missing.push({
        section: path.relative(roomPath, subdir),
        absPath: subdir,
        files: filesMissing,
      });
    }
  }
  if (missing.length === 0) {
    // D-03 rule 9: non-empty detail on the ok path (the pre-migration ok return
    // had none).
    return {
      status: 'ok',
      detail: subdirs.length + ' section dir(s) have ROOM.md + MINTO.md',
      missing: [],
      roomPath,
      subdirs: subdirs.length,
    };
  }
  return {
    status: 'warn',
    missing,
    roomPath,
    subdirs: subdirs.length,
    detail: missing.length + ' dir(s) missing ROOM.md or MINTO.md',
  };
}

// performRoomMdRecovery(checkResult) -- invoke the generator against the active
// room's path and re-run check(). Returns 'ok' when the post-fix check is clean,
// 'partial' when some dirs still lack files, 'error' when the generator failed,
// 'skip' when there is no drift to recover. The record carries its OWN
// tool:'generate-section-intelligence' field (preserved verbatim so the engine's
// recovered plumbing keeps the class-E record shape-identical).
function performRoomMdRecovery(checkResult) {
  if (!checkResult || checkResult.status !== 'warn') {
    return { status: 'skip', detail: 'no class E drift to recover', tool: 'generate-section-intelligence' };
  }
  if (!checkResult.roomPath) {
    return { status: 'error', detail: 'roomPath not set on check result', tool: 'generate-section-intelligence' };
  }
  const result = invokeGenerator(checkResult.roomPath, { recursive: true, force: false });
  if (result.status !== 'ok') {
    return {
      status: 'error',
      detail: 'generator failed: ' + (result.stderr || result.stdout || 'no output').slice(0, 200),
      tool: 'generate-section-intelligence',
      exitCode: result.exitCode,
    };
  }
  const afterCheck = check();
  if (afterCheck.status === 'ok') {
    return {
      status: 'ok',
      detail: 'all subdirs now have ROOM.md + MINTO.md',
      tool: 'generate-section-intelligence',
      generatorOutput: result.stdout,
    };
  }
  return {
    status: 'partial',
    detail: (afterCheck.missing || []).length + ' dir(s) still missing after generation',
    tool: 'generate-section-intelligence',
    remaining: afterCheck.missing,
  };
}

// fix(ctx) -- the engine passes the just-run check result on ctx.check_result.
function fix(ctx) {
  const c = ctx || {};
  return performRoomMdRecovery(c.check_result);
}

module.exports = {
  check,
  fix,
};
