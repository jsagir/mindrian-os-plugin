'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 381 Plan 04 (PERF381-01, PERF381-02, PERF381-08) -- the room summary renderer router.
 *
 * Purpose
 *   scripts/compute-team (and, after plans 381-05 and 381-07, scripts/analyze-room and
 *   scripts/compute-state) exec this file. One node process reads the room once and writes the
 *   same bytes as the bash body did. The bash entry points keep their argv, exit code and stdout
 *   contract; this router only picks the renderer.
 *
 * Modes (process.argv[2])
 *   team     lib/core/room-render-team.cjs (scripts/compute-team)
 *   analyze  lib/core/room-render-analyze.cjs (scripts/analyze-room, plans 381-05 and 381-06)
 *   state    lib/core/room-render-state.cjs (scripts/compute-state, plan 381-07)
 *
 * Node floor: the CLI arm refuses a node below 22.18.0 with one stderr line and exit 1, before
 * any renderer loads (the wrapper passes no node option flag, so an old node reaches this check).
 * Test seam: MINDRIAN_TEST_NODE_VERSION is honoured only under MINDRIAN_TEST_MODE=1 (the seam
 * convention of lib/core/mcp-dep-heal.cjs). The check does not run on an in-process require.
 *
 * The legacy bash bodies and the MINDRIAN_LEGACY_COMPUTE switch were removed by plan 381-09; the
 * bash entry points only exec this file.
 *
 * Canon
 *   Part 8 (graph boundary): zero network. Node built-ins and lib/core/room-scan.cjs only.
 *   Part 11 (invocation constitution): a library with a CLI arm behind an existing script; it adds
 *   no invocable surface.
 *
 * Hyphens only. CommonJS (.cjs): a hook reaches this file through scripts/compute-team.
 */

const FLOOR_MAJOR = 22;
const FLOOR_MINOR = 18;
const USAGE = 'usage: room-render.cjs <team|analyze|state> [room_dir]';

// run(mode, args, ctx) -> { stdout, stderr, code }. ctx: { now: () => Date } (optional).
async function run(mode, args, ctx) {
  const c = Object.assign({ now: () => new Date() }, ctx || {});
  const list = Array.isArray(args) ? args : [];
  switch (mode) {
    case 'team': {
      const team = require('./room-render-team.cjs');
      return team.renderTeam(list, c);
    }
    case 'analyze': {
      const analyze = require('./room-render-analyze.cjs');
      return analyze.renderAnalyze(list, c);
    }
    case 'state': {
      const state = require('./room-render-state.cjs');
      return state.renderState(list, c);
    }
    default:
      return { stdout: '', stderr: USAGE + '\n', code: 2 };
  }
}

function numField(s) {
  const n = Number(s);
  return s === undefined || s === '' || !Number.isFinite(n) ? 0 : n;
}

// Returns the refusal line or null.
function floorRefusal(mode) {
  const fake = process.env.MINDRIAN_TEST_MODE === '1' ? process.env.MINDRIAN_TEST_NODE_VERSION : '';
  const version = fake ? fake : process.versions.node;
  const parts = String(version).split('.');
  const major = numField(parts[0]);
  const minor = numField(parts[1]);
  if (major < FLOOR_MAJOR || (major === FLOOR_MAJOR && minor < FLOOR_MINOR)) {
    return (mode || 'room-render') + ': needs Node.js 22.18.0 or later (found v' + version + ')\n';
  }
  return null;
}

async function main() {
  const mode = process.argv[2];
  const refusal = floorRefusal(mode);
  if (refusal) {
    process.stderr.write(refusal);
    process.exitCode = 1;
    return;
  }
  let res;
  switch (mode) {
    case 'team':
    case 'analyze':
    case 'state':
      try {
        res = await run(mode, process.argv.slice(3));
      } catch (err) {
        res = { stdout: '', stderr: mode + ': ' + String(err && err.message ? err.message : err) + '\n', code: 1 };
      }
      break;
    default:
      res = { stdout: '', stderr: USAGE + '\n', code: 2 };
  }
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  process.exitCode = res.code;
}

if (require.main === module) {
  main();
}

module.exports = { run };
