#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355.1 AMB-06: the CLI Stop entry of the ambient trigger. Registered
 * in hooks/hooks.json with async: true (hook timeouts are seconds; async
 * hooks are not bounded by the harness, research C5), so this script bounds
 * itself through the evaluator's own budget plus a hard exit timer. Writes
 * NOTHING to stdout outside --dry-run: an async hook's output can reach the
 * next turn as context, and this hook has nothing to say. Exit 0 on every
 * path. HITL shape: none (machinery; the only human decision is the gate
 * answer on the card). Canon Part 8: argv, logs and files carry no room
 * bytes. Hyphens only.
 *
 * CLI router by a process.argv switch (no Commander): requires --stop;
 * accepts --dry-run (tests only, never registered in hooks.json).
 *
 * Flow: install uncaughtException/unhandledRejection handlers that exit 0;
 * arm an unref'd hard-exit timer; read stdin defensively; stop_hook_active
 * true or a missing session_id exits 0; resolve the room only through
 * resolveSessionRoom({ sessionId, requireOwnership: true }); no room, or
 * the reserved no-room sentinel, exits 0; in --dry-run, capture the one
 * spawn the evaluator would make and print one JSON line; otherwise run the
 * evaluator silently. This script itself never spawns (the evaluator does).
 */

const fs = require('node:fs');

const AMBIENT_DEBUG_ENV = 'MINDRIAN_AMBIENT_DEBUG';
const NO_ROOM_SENTINEL = '__no_room__';

function debugLog(msg) {
  try {
    if (process.env[AMBIENT_DEBUG_ENV] === '1') {
      process.stderr.write('[ambient-stop] ' + String(msg) + '\n');
    }
  } catch (_e) {
    /* never block on a diagnostic write */
  }
}

function exitZero() {
  try {
    process.exit(0);
  } catch (_e) {
    /* the process is already tearing down */
  }
}

process.on('uncaughtException', function () {
  debugLog('uncaught_exception');
  exitZero();
});
process.on('unhandledRejection', function () {
  debugLog('unhandled_rejection');
  exitZero();
});

function readStdin() {
  try {
    const data = fs.readFileSync(0, 'utf8');
    if (!data) return {};
    const parsed = JSON.parse(data);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (_e) {
    return {};
  }
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.indexOf('--stop') === -1) {
    debugLog('missing_stop_flag');
    return exitZero();
  }
  const dryRun = argv.indexOf('--dry-run') !== -1;

  const ambientTrigger = require('../lib/core/ambient-trigger.cjs');
  const resolveActiveRoom = require('../lib/core/resolve-active-room.cjs');

  // The hard, unref'd backstop: an async hook is not bounded by the harness
  // (research C5), so this script bounds its OWN wall clock rather than
  // trusting it. This never blocks process exit; it only guarantees one if
  // something downstream hangs.
  const hardExit = setTimeout(function () {
    debugLog('hard_exit_timer');
    exitZero();
  }, ambientTrigger.AMBIENT_EVAL_BUDGET_MS + 1500);
  if (hardExit && typeof hardExit.unref === 'function') hardExit.unref();

  const input = readStdin();
  if (input.stop_hook_active === true) {
    debugLog('stop_hook_active');
    return exitZero();
  }
  const sessionId = (typeof input.session_id === 'string') ? input.session_id : '';
  if (!sessionId) {
    debugLog('no_session_id');
    return exitZero();
  }

  let resolved = null;
  try {
    resolved = resolveActiveRoom.resolveSessionRoom({ sessionId: sessionId, requireOwnership: true });
  } catch (_e) {
    resolved = null;
  }
  const roomDir = (resolved && typeof resolved.abs_path === 'string' && resolved.abs_path.length > 0)
    ? resolved.abs_path
    : null;
  if (!roomDir || roomDir === NO_ROOM_SENTINEL) {
    debugLog('no_room');
    return exitZero();
  }

  if (dryRun) {
    let captured = null;
    ambientTrigger._internal.setSpawnImpl(function captureSpawn(command, args) {
      captured = { command: command, argv: args };
      return { unref: function () {} };
    });
    let result;
    try {
      result = ambientTrigger.evaluateAndMaybeSpawn(roomDir, { seam: 'stop_hook', sessionId: sessionId });
    } finally {
      ambientTrigger._internal.resetSpawnImpl();
    }
    try {
      const line = JSON.stringify({
        decision: result && result.decision,
        argv: captured ? captured.argv : null,
      });
      process.stdout.write(line + '\n');
    } catch (_e) {
      /* never block the dry-run print */
    }
    return exitZero();
  }

  try {
    ambientTrigger.evaluateAndMaybeSpawn(roomDir, { seam: 'stop_hook', sessionId: sessionId });
  } catch (_e) {
    debugLog('evaluate_error');
  }
  return exitZero();
}

main();
