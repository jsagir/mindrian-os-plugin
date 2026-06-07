#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 144.1-06 RETRO-03 -- the Tier D sensor-firing chokepoint shim.
 *
 * A tiny LOCAL-only helper the bash sensor-firing hooks (on-file-changed,
 * on-agent-complete) shell out to so they can FIRE their sensor through the
 * navigation chokepoint (lib/core/navigation.cjs) and emit a memory_event the
 * engine can observe -- mirroring the firing idiom the .cjs Tier D hooks use
 * inline (scripts/auto-explore-fingerprint.cjs routes through navigation.cjs;
 * this shim is the bash-side equivalent door).
 *
 * The fire is a chokepoint-routed spine_read memory_event carrying ONLY generic
 * handles + LOCAL scalars: the reach_id, the SENS-* sensor id, the dispatch
 * handle, the posture, and a sha256 of the relative file path. NEVER the file
 * body, the artifact text, or any user content (Canon Part 8). No bare Write
 * that bypasses cascade: the only write is the chokepoint memory_event.
 *
 * Usage:
 *   node scripts/fire-sensor-event.cjs <roomDir> <reachId> <sensorId> \
 *     <dispatch> <posture> <relativeFilePath>
 *
 * ALWAYS exits 0; never blocks the calling hook. Any failure (missing
 * navigation substrate, no room.db, locked db) degrades silently.
 *
 * Pure CJS, node built-ins + project libs only. No new deps. No em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function main() {
  const roomDir = String(process.argv[2] || '');
  const reachId = String(process.argv[3] || '');
  const sensorId = String(process.argv[4] || '');
  const dispatch = String(process.argv[5] || '');
  const posture = String(process.argv[6] || '');
  const relativeFilePath = String(process.argv[7] || '');

  if (!roomDir || !reachId || !sensorId) return;
  if (!fs.existsSync(roomDir)) return;

  // Route the fire through the navigation chokepoint. A missing substrate
  // (node:sqlite absent, navigation module unresolvable) degrades to a no-op
  // -- never an ad-hoc detached spawn that bypasses the sensor layer.
  let navigation;
  try {
    navigation = require('../lib/core/navigation.cjs');
  } catch (_e) {
    return;
  }
  if (!navigation || typeof navigation.logSpineRead !== 'function') return;

  // file_path_sha256: hash the relative path so the emitted memory_event carries
  // only the 16-char hex digest, never the raw path (Canon Part 8 -- never store
  // a raw path or body in the event payload).
  const fileSha = relativeFilePath
    ? crypto.createHash('sha256').update(relativeFilePath).digest('hex').slice(0, 16)
    : '';

  try {
    navigation.logSpineRead(roomDir, {
      surface: reachId,
      sensor: sensorId,
      dispatch: dispatch || null,
      posture: posture || null,
      file_path_sha256: fileSha,
      source: 'tier-d-hook',
    });
  } catch (_e) {
    // Chokepoint write best-effort: a locked db / FK miss never blocks the hook.
  }
}

try {
  main();
} catch (_e) {
  // Final defensive net -- the fire is advisory; never propagate.
}
process.exit(0);
