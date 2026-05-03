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
 *   4. CLAUDE_CODE_ENTRYPOINT='cli' env -> 'CLI' (the canonical CC-CLI
 *      signal; survives non-TTY sub-process invocation -- Bash tool,
 *      statusline shell-exec, hooks, doctor.cjs all see it inherited
 *      from the parent CC process. Claude Desktop's spawned stdio MCP
 *      servers do NOT inherit this var, so it is CLI-exclusive.)
 *   5. process.stdin.isTTY === true -> 'CLI' (raw shell fallback)
 *   6. Default -> 'DESKTOP' (safe default; non-TTY child process is the
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

  // 4. Claude Code CLI entrypoint -- definitive CLI signal that survives
  // non-TTY sub-process invocation (Bash tool, statusline shell-exec,
  // hooks, doctor.cjs). Claude Code sets CLAUDE_CODE_ENTRYPOINT='cli'
  // on the parent process and it propagates to every child. Claude
  // Desktop's spawned stdio MCP servers do NOT inherit this var; Cowork
  // uses its own signals (handled at step 2). Therefore this read is
  // CLI-exclusive. Without this step, every CC-CLI Bash/hook invocation
  // falls through to the default-DESKTOP branch and the statusline
  // broadcast (D-02) plus visibility check (D-03) silently no-op.
  if (process.env.CLAUDE_CODE_ENTRYPOINT === 'cli') {
    return 'CLI';
  }

  // 5. Interactive TTY -> CLI (raw shell fallback for non-CC contexts).
  if (process.stdin && process.stdin.isTTY === true) {
    return 'CLI';
  }

  // 6. Safe default. Non-TTY child process is the most common Desktop
  // spawn pattern; defaulting to DESKTOP keeps Larry's prose echo on
  // (better than the rich line never showing).
  return 'DESKTOP';
}

module.exports = { detectStatuslineSurface, VALID_SURFACES };
