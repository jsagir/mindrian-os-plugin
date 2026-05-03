/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 106 Plan 04 -- statusline surface-detect helper.
 *
 * Returns 'CLI' | 'DESKTOP' | 'COWORK' for hook-time / doctor-time
 * surface routing. NOT TO BE CONFUSED with lib/mcp/surface-detect.cjs
 * (that helper picks MCP transport at server startup; signature and
 * consumer set are different -- lowercase strings + transport field).
 *
 * Detection priority (highest first):
 *   1. MINDRIAN_STATUSLINE_SURFACE env (explicit override; one of
 *      'CLI' / 'DESKTOP' / 'COWORK')
 *   2. COWORK_SESSION_ID env, or fs.existsSync('/sessions') -> 'COWORK'
 *   3. CLAUDE_DESKTOP=1 env -> 'DESKTOP'
 *   4. process.stdin.isTTY === true -> 'CLI'
 *   5. Default -> 'DESKTOP' (safe default; non-TTY child process is the
 *      most common Desktop pattern per lib/mcp/surface-detect.cjs:62-64)
 *
 * Never returns null/undefined; never throws. Pure-ish (reads env + one
 * fs.existsSync); no network; no writes. Canon Part 8.
 *
 * Pure CJS, node built-ins only, zero npm deps (Phase 87 invariant).
 */

'use strict';

const fs = require('node:fs');

const VALID_SURFACES = ['CLI', 'DESKTOP', 'COWORK'];

function detectStatuslineSurface() {
  // 1. Explicit override (highest priority for testability + power-user opt-in).
  const explicit = process.env.MINDRIAN_STATUSLINE_SURFACE;
  if (explicit && VALID_SURFACES.indexOf(explicit) !== -1) {
    return explicit;
  }

  // 2. Cowork signals.
  if (process.env.COWORK_SESSION_ID) {
    return 'COWORK';
  }
  try {
    if (fs.existsSync('/sessions')) {
      return 'COWORK';
    }
  } catch (_e) {
    // Never let an fs error block surface detection.
  }

  // 3. Desktop signal.
  if (process.env.CLAUDE_DESKTOP === '1') {
    return 'DESKTOP';
  }

  // 4. Interactive TTY -> CLI.
  if (process.stdin && process.stdin.isTTY === true) {
    return 'CLI';
  }

  // 5. Safe default. Non-TTY child process is the most common Desktop
  // spawn pattern; defaulting to DESKTOP keeps Larry's prose echo on
  // (better than the rich line never showing).
  return 'DESKTOP';
}

module.exports = { detectStatuslineSurface, VALID_SURFACES };
