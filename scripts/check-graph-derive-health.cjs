#!/usr/bin/env node
'use strict';

/*
 * scripts/check-graph-derive-health.cjs -- Phase 298 Plan 06 (SEED-037 4d).
 *
 * THE GATE, NOT THE DETECTOR. This script is a THIN CLI WRAPPER over
 * lib/core/doctor/graph-derive-health-module.cjs -- specifically its
 * `detectRoomHealth(roomDir)` and `check(ctx)` exports. That module's own
 * header names itself THE ONE SHARED DETECTION SIGNAL with two consumers
 * (its own check()/fix() and the graph-derive-heal-retrofit sibling) and
 * says "never a second copy". This script is a THIRD consumer, which per
 * that module's own doctrine makes it a wrapper, never a reimplementation
 * (Canon Part 7, reuse before build). It contains zero structural/semantic
 * edge-detection logic of its own -- every status this script reports was
 * derived by graph-derive-health-module.cjs's detectRoomHealth()/check(),
 * never recomputed here.
 *
 * MONITOR, NOT REPAIR. SEED-037 4c (healing the roughly 16 already-damaged
 * rooms) is a separate, human-gated action -- the module's own `fix()` /
 * `--heal-room` path. This script never calls fix() and never writes into a
 * room; it reports and exits.
 *
 * Canon Part 8: every read this script triggers is LOCAL. detectRoomHealth()
 * opens room.db only through the read-only door
 * (openRoomDbReadOnlyForCaller, lib/core/navigation/spine-events.cjs:523) --
 * this script itself never touches node:sqlite and never opens a database.
 * Zero network, zero Brain calls.
 *
 * Exit map (the repo's own 0/1/2 scanner convention):
 *   0  clean        status 'ok' or 'skip' (skip = Tier 0 room, nothing to
 *                    derive yet -- the committed converged-room fixture has
 *                    no room.db and is therefore the green case)
 *   1  finding      status 'fail', or status 'warn' under --strict
 *   2  scanner/usage fault  unknown flag, missing --room value, a load or
 *                    detection error -- never a raw stack trace on stderr
 *
 * CLI convention (CLAUDE.md): process.argv switch-case routing, no
 * Commander/yargs, no new dependencies. Argv-loop shape copied from
 * scripts/check-worktree-hygiene.cjs.
 *
 * No CIRS / HITL shape declaration: this is a script, not an invocable
 * surface under commands/, skills/, or agents/, and no sibling
 * scripts/check-*.cjs carries one -- confirmed with
 * `node scripts/check-cirs-declaration.cjs --check` after this file landed.
 */

const path = require('node:path');

const SCRIPT_NAME = 'check-graph-derive-health';

function usage() {
  return [
    SCRIPT_NAME + ': the SEED-037 4d CLI gate. Wraps detectRoomHealth()/check()',
    'from lib/core/doctor/graph-derive-health-module.cjs -- never a second detector.',
    '',
    'Usage: node scripts/' + SCRIPT_NAME + '.cjs [--room <dir>] [--all] [--json] [--strict] [--check] [--help]',
    '',
    'Flags:',
    '  --room <dir>  check exactly one room directory via detectRoomHealth(dir)',
    '  --all         check every registered room (cascade scope, class-level)',
    '  (neither)     check the registry-active room only',
    '  --json        print the module\'s returned object verbatim as JSON',
    '  --strict      map a warn status to exit 1 (default: warn exits 0)',
    '  --check       accepted as an explicit no-op (the default action)',
    '  --help        print this message and exit 0',
    '',
    'Exit codes:',
    '  0  clean: status ok or skip (skip = Tier 0 room, nothing to derive yet',
    '     -- the committed converged-room fixture reports this, the green case)',
    '  1  finding: status fail, or status warn under --strict',
    '  2  scanner or usage fault: unknown flag, missing --room value, or a',
    '     load/detection error -- never a raw stack trace on stderr',
    '',
    'Monitor only: this gate never repairs a room. Healing damaged rooms',
    '(SEED-037 4c) is a separate, human-gated action (the wrapped module\'s',
    'own fix() / --heal-room path), never reached from here.',
  ].join('\n');
}

// mapStatusToExit(status, strict) -> 0 | 1. The exit map is exact: fail is
// always a finding; warn is a finding only under --strict; ok and skip (and
// any unrecognized status) are clean. Exported so the test can exercise the
// mapping in-process without spawning.
function mapStatusToExit(status, strict) {
  if (status === 'fail') return 1;
  if (status === 'warn') return strict ? 1 : 0;
  return 0;
}

function printHuman(mode, result, roomArg) {
  if (mode === 'room') {
    const reasons = (result.reasons && result.reasons.length) ? result.reasons.join('; ') : '(none)';
    console.log(
      SCRIPT_NAME + ': status=' + result.status
      + ' room=' + roomArg
      + ' queue=' + (result.queueCount || 0)
      + ' reasons=' + reasons
    );
    return;
  }
  console.log(
    SCRIPT_NAME + ': status=' + result.status
    + ' scope=' + result.scope
    + ' ' + result.detail
  );
  for (const r of (result.rooms || [])) {
    const reasons = (r.reasons && r.reasons.length) ? r.reasons.join('; ') : '(none)';
    console.log(
      '  ' + r.room + ' (' + (r.roomPath || 'unresolved') + '):'
      + ' status=' + r.status
      + ' queue=' + (r.queueCount || 0)
      + ' reasons=' + reasons
    );
  }
}

// main(argv?) -> exit code (does not call process.exit itself, so the test
// harness can call it in-process and assert on the return value).
function main(argv) {
  const args = argv || process.argv.slice(2);

  if (args.includes('--help')) {
    console.log(usage());
    return 0;
  }

  let roomDir = null;
  let all = false;
  let asJson = false;
  let strict = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--room') {
      const value = args[i + 1];
      if (!value) {
        console.error(SCRIPT_NAME + ': --room was given with no directory argument');
        return 2;
      }
      roomDir = path.resolve(value);
      i++;
    } else if (a === '--all') {
      all = true;
    } else if (a === '--json') {
      asJson = true;
    } else if (a === '--strict') {
      strict = true;
    } else if (a === '--check') {
      /* default action, accepted explicitly as a no-op */
    } else {
      console.error(SCRIPT_NAME + ': unknown flag ' + a + ' (see --help)');
      return 2;
    }
  }

  let healthMod;
  try {
    healthMod = require('../lib/core/doctor/graph-derive-health-module.cjs');
  } catch (e) {
    console.error(SCRIPT_NAME + ': could not load graph-derive-health-module.cjs: ' + ((e && e.message) || e));
    return 2;
  }

  let mode;
  let result;
  try {
    if (roomDir) {
      mode = 'room';
      result = healthMod.detectRoomHealth(roomDir);
    } else if (all) {
      mode = 'check';
      result = healthMod.check({ flags: { cascadeRooms: true } });
    } else {
      mode = 'check';
      result = healthMod.check({ flags: {} });
    }
  } catch (e) {
    console.error(SCRIPT_NAME + ': ' + ((e && e.message) || e));
    return 2;
  }

  if (!result || typeof result.status !== 'string') {
    console.error(SCRIPT_NAME + ': the wrapped module returned no usable status');
    return 2;
  }

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printHuman(mode, result, roomDir);
  }

  return mapStatusToExit(result.status, strict);
}

if (require.main === module) {
  let exitCode;
  try {
    exitCode = main();
  } catch (e) {
    console.error(SCRIPT_NAME + ': uncaught: ' + ((e && e.message) || e));
    exitCode = 2;
  }
  process.exit(exitCode);
}

module.exports = { main, mapStatusToExit, usage };
