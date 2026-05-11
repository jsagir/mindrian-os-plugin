#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 95.6 D-05d -- SessionStart runtime npm-dependency reconciliation.
 *
 * Idempotent: only runs `npm install` if node_modules is missing or out of
 * sync with the plugin's package.json `dependencies`. On a healthy box this
 * is a zero-cost no-op (a few stat() calls, then {continue:true}).
 *
 * Defensive: ANY error -> emit {continue:true} and exit 0. The
 * uncaughtException handler guarantees that even a require() failure cannot
 * throw an unhandled error and block the hook chain.
 *
 * Canon Part 8: zero network surface beyond the `npm install` call itself.
 * No Brain calls, no external search calls, no user data, no remote requests
 * of any kind. Pure CJS, node built-ins only.
 *
 * Three-surface awareness: SessionStart hooks fire on Claude Code CLI. On
 * Desktop and Cowork the plugin's node_modules are managed by the host's
 * plugin install mechanism; this hook is harmless there (it either finds the
 * deps present and no-ops, or it cannot find a package.json and no-ops).
 */

process.on('uncaughtException', () => {
  try { process.stdout.write(JSON.stringify({ continue: true })); } catch (e) { /* swallow */ }
  process.exit(0);
});

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT
  || process.env.MINDRIAN_OS_ROOT
  || path.resolve(__dirname, '..')
  || path.join(os.homedir(), '.claude', 'plugins', 'mindrian-os');

function emit() {
  try { process.stdout.write(JSON.stringify({ continue: true })); } catch (e) { /* swallow */ }
  process.exit(0);
}

let needInstall = false;
try {
  const pkgPath = path.join(PLUGIN_ROOT, 'package.json');
  if (!fs.existsSync(pkgPath)) return emit();
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const deps = Object.keys(pkg.dependencies || {});
  const nm = path.join(PLUGIN_ROOT, 'node_modules');
  if (deps.length === 0) return emit();
  if (!fs.existsSync(nm)) {
    needInstall = true;
  } else {
    for (const d of deps) {
      // d may be a scoped package like "@scope/name" -- split on "/" so the
      // path join lands at node_modules/@scope/name.
      if (!fs.existsSync(path.join(nm, ...d.split('/')))) { needInstall = true; break; }
    }
  }
  if (needInstall) {
    const { spawnSync } = require('node:child_process');
    spawnSync('npm', ['install', '--no-audit', '--no-fund', '--silent'], {
      cwd: PLUGIN_ROOT,
      timeout: 60000,
      stdio: 'ignore',
    });
  }
} catch (e) { /* swallow -- defensive: never block the hook chain */ }

emit();
