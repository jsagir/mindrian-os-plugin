#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 119-00 Wave 1 -- Venture-Shaped-Turn Nudge F.1 selector shim.
 *
 * Invocation:
 *   node scripts/room-auto-create-nudge.cjs --room-dir <abs_path>
 *
 * Reads the room's recent memory_event log via lib/core/venture-shape-nudge.cjs;
 * if >= 3 venture-shaped turns accumulated without an upload (D-02 threshold),
 * renders an F.1 selector via lib/hmi/selector-dispatcher.cjs::pickShape with
 * verbs ['upload material', '/mos:ignite', 'keep talking'] (Free-Text
 * appended automatically by the dispatcher).
 * // Repointed from /mos:new-project to /mos:ignite per Phase 155-04
 * // (the Ignite Flow is now the birth front door).
 *
 * Per CONTEXT.md D-01 invariant: if any auto_explore_fired event appears in
 * the recent window, the upload path is active and this shim short-circuits
 * silently (no nudge -- never compete with the Phase 117 path). The nudge
 * module enforces this; the shim just renders whatever the module returns.
 *
 * Per CLAUDE.md tri-polar design rule (CLI / Desktop / Cowork): same JSON
 * envelope across all three surfaces; the consuming surface decides how to
 * render. CLI renders the numbered menu via lib/hmi/shape-f1-renderer.cjs;
 * Desktop paraphrases the same verb set conversationally; Cowork renders the
 * envelope as a shared-state choice point in the room .context channel. The
 * shim never invents surface adaptation -- that's the Phase 88.2 dispatcher
 * responsibility. The three surfaces converge here.
 *
 * Canon Part 8: no Brain MCP, no fetch, no telemetry egress. Pure CJS, node
 * built-ins only.
 */
'use strict';

const path = require('node:path');

function parseArgs() {
  const args = process.argv.slice(2);
  let roomDir = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--room-dir' && i + 1 < args.length) {
      roomDir = args[i + 1];
    }
  }
  return { roomDir };
}

function main() {
  const { roomDir } = parseArgs();
  if (!roomDir) {
    process.stdout.write(JSON.stringify({
      shape: 'F.1',
      surface: false,
      reason: 'no_room_dir_arg',
    }) + '\n');
    process.exit(0);
  }
  const absRoomDir = path.resolve(roomDir);

  let nudgeResult;
  try {
    const nudge = require('../lib/core/venture-shape-nudge.cjs');
    nudgeResult = nudge.shouldSurfaceNudge(absRoomDir, {});
  } catch (e) {
    process.stdout.write(JSON.stringify({
      shape: 'F.1',
      surface: false,
      reason: 'nudge_module_error:' + String((e && e.message) || e).slice(0, 60),
    }) + '\n');
    process.exit(0);
  }

  if (!nudgeResult.surface) {
    process.stdout.write(JSON.stringify({
      shape: 'F.1',
      surface: false,
      reason: nudgeResult.skip_reason || 'below_threshold',
      turn_count: nudgeResult.turn_count,
      threshold: nudgeResult.threshold,
    }) + '\n');
    process.exit(0);
  }

  // Surface the F.1 selector. Verbatim verb labels per CONTEXT.md D-02.
  let dispatcher;
  try {
    dispatcher = require('../lib/hmi/selector-dispatcher.cjs');
  } catch (_e) {
    process.stdout.write(JSON.stringify({
      shape: 'F.1',
      surface: false,
      reason: 'dispatcher_load_failed',
    }) + '\n');
    process.exit(0);
  }

  let rendered;
  try {
    rendered = dispatcher.pickShape({
      requestedShape: 'F.1',
      roomDir: absRoomDir,
      tier: 0, // Mode B (no Brain reachability assumed for the nudge surface)
      // Repointed from /mos:new-project to /mos:ignite per Phase 155-04
      // (the Ignite Flow is now the birth front door).
      verbs: ['upload material', '/mos:ignite', 'keep talking'],
    });
  } catch (e) {
    process.stdout.write(JSON.stringify({
      shape: 'F.1',
      surface: false,
      reason: 'dispatcher_threw:' + String((e && e.message) || e).slice(0, 60),
    }) + '\n');
    process.exit(0);
  }

  process.stdout.write(JSON.stringify({
    shape: 'F.1',
    surface: true,
    turn_count: nudgeResult.turn_count,
    threshold: nudgeResult.threshold,
    rendered: rendered,
  }) + '\n');
  process.exit(0);
}

process.on('uncaughtException', () => {
  process.stdout.write(JSON.stringify({
    shape: 'F.1',
    surface: false,
    reason: 'uncaught',
  }) + '\n');
  process.exit(0);
});

main();
