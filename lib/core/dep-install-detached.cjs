#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * MindrianOS Plugin -- the detached dependency installer
 * (Phase 369.1 plan 06, D-14). Usage: node dep-install-detached.cjs <pluginRoot>
 *
 * Started by startDetachedInstall() in lib/core/mcp-dep-heal.cjs when an MCP
 * server finds its packages missing on the connect path. It outlives the
 * server's connect budget on purpose: killing a half-done `npm ci` and
 * restarting it later doubles the cost on a slow machine (a Cowork VM), so the
 * server waits for it only up to its own budget, answers honestly through
 * lib/core/mcp-install-responder.cjs, and leaves this process to finish.
 *
 * What it does, in order:
 *   1. Claims the status record (<home>/.mindrian/run/dep-install-<hash>.json,
 *      a private 0700 directory, a 0600 file; lib/core/dep-install-status.cjs)
 *      atomically. If another live installer already owns it, exits (single flight).
 *   2. runGuardedInstall(pluginRoot) under the detached ceiling (600 s, not the
 *      120 s hook budget: 369.1-REVIEW WR-06): the same install lock, the same
 *      `npm ci --ignore-scripts` frozen form when npm-shrinkwrap.json exists. A
 *      failed or timed-out install removes its partial node_modules.
 *   3. Re-checks the production dependency set on disk, then writes the final
 *      status: done, failed (with the reason), or npm-not-found.
 *
 * Fire-and-forget: exits 0 in every case, prints nothing to stdout. Built-ins
 * plus the two sibling lib/core modules only (safe with node_modules absent).
 * Canon Part 8 / D-08: reads plugin files, talks only to the user's npm
 * registry; the status file holds no user data.
 *
 * HARD RULE: no em-dashes anywhere in this file (hyphens only).
 */

const fs = require('node:fs');
const path = require('node:path');

const { runGuardedInstall, productionDepNames, detachedInstallTimeoutMs } = require('./mcp-dep-heal.cjs');
const { claimStatusFile, writeStatusFile } = require('./dep-install-status.cjs');

function main() {
  const root = process.argv[2];
  if (!root) return;
  const pluginRoot = path.resolve(root);
  // No pluginRoot is stored in the record (369.1-REVIEW CR-01): the file is keyed by a hash of it.
  const base = { startedAt: new Date().toISOString(), pid: process.pid };

  const claim = claimStatusFile(pluginRoot, Object.assign({ state: 'installing' }, base));
  if (!claim.owned) return; // another installer is already running

  let final;
  try {
    // The detached ceiling (600 s), never the 120 s hook budget: a slow machine finishes (WR-06).
    const outcome = runGuardedInstall(pluginRoot, { timeoutMs: detachedInstallTimeoutMs(), cleanTree: claim.interrupted === true });
    const nm = path.join(pluginRoot, 'node_modules');
    const missing = productionDepNames(pluginRoot).filter((d) => !fs.existsSync(path.join(nm, ...d.split('/'))));
    if (outcome.ok && missing.length === 0) {
      final = { state: 'done', reason: null, attempts: 0 };
    } else if (outcome.reason === 'npm-not-found') {
      final = { state: 'npm-not-found', reason: 'npm-not-found', attempts: 0 };
    } else {
      // npm exited 0 with the set incomplete (or the install failed): no partial tree may survive.
      if (outcome.ok) { try { fs.rmSync(nm, { recursive: true, force: true }); } catch (_) { /* best effort */ } }
      // WR-03: the consecutive-failure count drives the retry backoff in startDetachedInstall.
      final = { state: 'failed', reason: outcome.reason || ('incomplete: missing ' + missing.slice(0, 3).join(', ')), attempts: (claim.priorAttempts || 0) + 1 };
    }
  } catch (_) {
    final = { state: 'failed', reason: 'installer-error', attempts: (claim.priorAttempts || 0) + 1 };
  }
  writeStatusFile(pluginRoot, Object.assign({}, base, final, { finishedAt: new Date().toISOString() }));
}

try {
  main();
} catch (_) { /* fire-and-forget: never throw */ }
process.exit(0);
