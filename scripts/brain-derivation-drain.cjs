#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 90-02 Task 2 -- Brain derivation drain (UserPromptSubmit hook)
 * ====================================================================
 * Drains the brain-derivation queue on every UserPromptSubmit. For each
 * eligible entry (current triple hash matches queue hash AND Brain is
 * available), spawns a detached child process that runs deriveSection
 * and writes the section's BRAIN.md. The parent returns immediately so
 * the user turn never waits.
 *
 * Wall-clock contract: parent exits within ~100ms regardless of queue
 * depth. Each spawned child runs independently and may take seconds (or
 * minutes) to complete its Brain calls; that is expected and acceptable
 * because BRAIN.md is read-only intelligence consumed by the next
 * SessionStart, not the current user turn.
 *
 * Failure discipline: silent fail. Hook scripts must never disrupt user
 * input. Errors written to stderr at most. Exit code always 0 on any
 * non-fatal path. Matches Phase 88 guardian advisory pattern.
 *
 * CLI invocation modes:
 *
 *   node scripts/brain-derivation-drain.cjs
 *     -- Resolve active room from .rooms/registry.json. Drain up to 5
 *        entries by spawning detached deriveSection children. Exit 0.
 *
 *   node scripts/brain-derivation-drain.cjs --room <roomDir>
 *     -- Drain a specific room. Used by Plan 90-03 staleness scan.
 *
 *   node scripts/brain-derivation-drain.cjs --single <section>
 *     -- Single-section synchronous derive (no detached spawn). Used by
 *        the spawned children themselves to actually do the work; not
 *        invoked directly by the hook.
 *
 *   node scripts/brain-derivation-drain.cjs --max <N>
 *     -- Override default maxEntries (default 5).
 *
 *   node scripts/brain-derivation-drain.cjs --dry-run
 *     -- Drain without spawning; print plan to stderr. Test surface.
 *
 * Pure CJS, node built-ins only, zero npm deps. Three-surface compatible
 * by construction (CLI + Desktop MCP + Cowork).
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
// Phase 128.1-03b: the canonical session-scoped active-room resolver.
// resolveActiveRoomDir's inline `reg.active` read was a Bucket B-reader of the
// racing global string; it now routes through resolveActiveRoom (D-03).
const sessionBinding = require('../lib/core/session-binding.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const PARENT_BUDGET_MS = 100;

// ---------------------------------------------------------------------------
// Active room resolution (mirrors scripts/intent-classifier.cjs pattern).
// ---------------------------------------------------------------------------

function resolveMindrianRoomsRoot() {
  const envRoot = process.env.MINDRIAN_ROOMS_ROOT;
  if (envRoot && fs.existsSync(envRoot)) return envRoot;
  const home = process.env.HOME || os.homedir();
  if (!home) return null;
  const defaultRoot = path.join(home, 'MindrianRooms');
  if (fs.existsSync(defaultRoot)) return defaultRoot;
  return null;
}

// Phase 128.1-03b (D-03): the prior inline `reg.active` read was a Bucket B
// reader of the racing global string. resolveActiveRoom does the session-keyed
// lookup plus the last_active/active fallback internally so concurrent
// sessions resolve their own room. The `tripwire` signal is destructured but
// not acted on here -- Plan 05 owns the tripwire surface.
function resolveActiveRoomDir() {
  try {
    const sid = sessionBinding.resolveSessionId();
    const { room, path: roomPath /* tripwire */ } =
      sessionBinding.resolveActiveRoom(sid);
    if (roomPath && fs.existsSync(roomPath)) return roomPath;
    // Fallback: derive from the slug under the rooms root (resolver path empty
    // when the room is registered without an explicit path entry).
    if (typeof room === 'string' && room.length > 0) {
      const root = resolveMindrianRoomsRoot();
      if (root) {
        const cand = path.join(root, room);
        if (fs.existsSync(cand)) return cand;
      }
    }
  } catch (_) { /* graceful */ }
  return null;
}

// ---------------------------------------------------------------------------
// CLI parser
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = {
    roomDir: null,
    single: null,
    maxEntries: 5,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--room' && argv[i + 1]) {
      out.roomDir = argv[i + 1];
      i += 1;
    } else if (a === '--single' && argv[i + 1]) {
      out.single = argv[i + 1];
      i += 1;
    } else if (a === '--max' && argv[i + 1]) {
      const n = parseInt(argv[i + 1], 10);
      if (Number.isFinite(n) && n > 0) out.maxEntries = n;
      i += 1;
    } else if (a === '--dry-run') {
      out.dryRun = true;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Single-section synchronous derive (invoked by spawned children)
// ---------------------------------------------------------------------------

async function runSingleDerive(roomDir, section) {
  let derive;
  try {
    derive = require('../lib/core/brain-derivation.cjs');
  } catch (_e) {
    return 1;
  }
  try {
    const result = await derive.deriveSection(roomDir, section, {});
    if (result && result.success) return 0;
    return 0; // soft-fail: failed derivations are advisory, not blocking
  } catch (_e) {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Main drain (UserPromptSubmit hook entry)
// ---------------------------------------------------------------------------

async function runDrain(roomDir, opts) {
  let Q;
  try {
    Q = require('../lib/core/brain-derivation-queue.cjs');
  } catch (_e) {
    return; // queue module unavailable -- soft-fail
  }
  const start = Date.now();
  const result = await Q.drain(roomDir, {
    maxEntries: opts.maxEntries,
    dryRun: true, // We handle dispatch via detached spawn below.
  });
  // Q.drain in dryRun mode collects entries that should fire (in result.dispatched)
  // without actually spawning. We do the spawn here.
  if (Array.isArray(result.dispatched)) {
    for (const item of result.dispatched) {
      if (Date.now() - start > PARENT_BUDGET_MS) break;
      if (opts.dryRun) {
        process.stderr.write(
          '[brain-derivation-drain] would spawn deriveSection for section=' +
          item.section + '\n'
        );
        continue;
      }
      try {
        const child = spawn(process.execPath, [
          path.join(REPO_ROOT, 'scripts', 'brain-derivation-drain.cjs'),
          '--room', roomDir,
          '--single', item.section,
        ], {
          detached: true,
          stdio: 'ignore',
        });
        child.unref();
      } catch (_e) {
        // Soft-fail: spawn failure is advisory.
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

(async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));

    // --single: child path -- run deriveSection synchronously and exit.
    if (args.single) {
      const roomDir = args.roomDir || resolveActiveRoomDir();
      if (!roomDir) process.exit(0);
      const code = await runSingleDerive(roomDir, args.single);
      process.exit(typeof code === 'number' ? code : 0);
      return;
    }

    // Hook path: drain the active room (or --room override).
    const roomDir = args.roomDir || resolveActiveRoomDir();
    if (!roomDir) {
      // No active room -- silent no-op.
      process.exit(0);
      return;
    }
    await runDrain(roomDir, args);
    process.exit(0);
  } catch (_e) {
    // Fail-silent on any unexpected error. Drain is advisory.
    process.exit(0);
  }
})();
