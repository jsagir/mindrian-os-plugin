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
 *   1. Claims the status file (<os.tmpdir()>/mindrian-dep-install-<hash>.json)
 *      atomically. If another live installer already owns it, exits (single flight).
 *   2. runGuardedInstall(pluginRoot) with the hook-path 120 s budget: the same
 *      install lock, the same `npm ci --ignore-scripts` frozen form when
 *      npm-shrinkwrap.json exists.
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

const { runGuardedInstall, productionDepNames } = require('./mcp-dep-heal.cjs');
const { statusFilePath, readStatus } = require('./mcp-install-responder.cjs');

function pidIsLive(pid) {
  if (typeof pid !== 'number' || !(pid > 0)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return !!(e && e.code === 'EPERM');
  }
}

/** Replace the status file atomically (write a temp file, rename over). */
function writeStatus(file, status) {
  const tmp = file + '.' + process.pid + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(status));
    fs.renameSync(tmp, file);
  } catch (_) {
    try { fs.unlinkSync(tmp); } catch (_e) { /* best effort */ }
  }
}

/**
 * Claim the status file for this installer. Publishes a fully written file
 * with link (atomic, EEXIST if present), so a reader never sees a half file.
 * @returns {boolean} true when this process owns the install
 */
function claim(file, status, pluginRoot) {
  const tmp = file + '.' + process.pid + '.claim';
  try {
    fs.writeFileSync(tmp, JSON.stringify(status));
  } catch (_) {
    return true; // cannot write the status at all: install anyway, the lock still serializes npm
  }
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        fs.linkSync(tmp, file);
        return true;
      } catch (e) {
        if (!e || e.code !== 'EEXIST') return true;
        const existing = readStatus(pluginRoot);
        const live = existing && existing.state === 'installing' && !existing.finishedAt &&
          existing.pid !== process.pid && pidIsLive(existing.pid);
        if (live) return false; // another installer is already running
        try { fs.unlinkSync(file); } catch (_e) { /* raced with a peer */ }
      }
    }
    return false;
  } finally {
    try { fs.unlinkSync(tmp); } catch (_) { /* already gone */ }
  }
}

function main() {
  const root = process.argv[2];
  if (!root) return;
  const pluginRoot = path.resolve(root);
  const file = statusFilePath(pluginRoot);
  const base = { startedAt: new Date().toISOString(), pid: process.pid, pluginRoot };

  if (!claim(file, Object.assign({ state: 'installing' }, base), pluginRoot)) return;

  let final;
  try {
    const outcome = runGuardedInstall(pluginRoot);
    const nm = path.join(pluginRoot, 'node_modules');
    const missing = productionDepNames(pluginRoot).filter((d) => !fs.existsSync(path.join(nm, ...d.split('/'))));
    if (outcome.ok && missing.length === 0) {
      final = { state: 'done', reason: null };
    } else if (outcome.reason === 'npm-not-found') {
      final = { state: 'npm-not-found', reason: 'npm-not-found' };
    } else {
      final = { state: 'failed', reason: outcome.reason || ('incomplete: missing ' + missing.slice(0, 3).join(', ')) };
    }
  } catch (_) {
    final = { state: 'failed', reason: 'installer-error' };
  }
  writeStatus(file, Object.assign({}, base, final, { finishedAt: new Date().toISOString() }));
}

try {
  main();
} catch (_) { /* fire-and-forget: never throw */ }
process.exit(0);
