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
 *
 * CR-04 fix (355.1 review) -- SINGLE OWNER of the ambient evaluator on the
 * CLI Stop event: hooks/hooks.json registers this script as its OWN
 * independent Stop-hook entry, always invoked. Separately, scripts/on-stop
 * (also a Stop hook, run in the SAME Stop dispatch) has a MINDRIAN_MCP_FIRST
 * branch that queries the MCP daemon's stop_gate_check tool, which reaches
 * lib/mcp/stop-gate-handler.cjs's _closeOutAmbientTrigger -- a SECOND,
 * independent call to ambientTrigger.evaluateAndMaybeSpawn for the same
 * room, from the same Stop event. Two calls into the same evaluator, only
 * milliseconds apart, is exactly the CR-01 collision scenario, and it is
 * the designed always-on behavior of any CLI install with MINDRIAN_MCP_FIRST
 * set -- not a rare race. Ownership is decided here, deterministically, by
 * the SAME env var both processes read (isMcpFirst('cli'), the identical
 * check scripts/on-stop itself makes): when MINDRIAN_MCP_FIRST names 'cli'
 * (or 'all'), this script stands down and lib/mcp/stop-gate-handler.cjs's
 * _closeOutAmbientTrigger is the sole owner for this Stop event; otherwise
 * (the default, flag unset) this script remains the sole owner, exactly as
 * before. This is deterministic on the flag alone -- it does NOT depend on
 * whether the CR-01 claim fix would otherwise have arbitrated the race,
 * because a true mutex would still waste a full spawn + require graph on
 * every single CLI Stop event under the flag, not just a rare collision.
 * KNOWN LIMITATION: if MINDRIAN_MCP_FIRST names 'cli' but the daemon is
 * unreachable, scripts/on-stop's own thin adapter falls through to its
 * legacy body (which never calls the ambient evaluator directly), so no
 * ambient evaluation runs at all for that one Stop event; the next Stop
 * event retries normally. This is the accepted tradeoff of a deterministic,
 * env-only single-owner check, and matches a Stop hook's own contract that
 * it must never block or retry-loop.
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

  // CR-04 fix (355.1 review): stand down when MINDRIAN_MCP_FIRST('cli') is
  // active for this session -- lib/mcp/stop-gate-handler.cjs's
  // _closeOutAmbientTrigger is the sole owner of the evaluator for this
  // Stop event in that case (see the header comment above). Checked before
  // any room resolution or evaluator work, and before --dry-run's own
  // capture-spawn setup, so a --dry-run invocation under the flag also
  // reports the stand-down deterministically rather than double-firing.
  const { isMcpFirst } = require('../lib/mcp/mcp-first-flag.cjs');
  if (isMcpFirst('cli')) {
    debugLog('mcp_first_standdown');
    return exitZero();
  }

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
