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

// 369.1-REVIEW WR-01: the install target is the directory this script lives in. The environment
// roots (CLAUDE_PLUGIN_ROOT, MINDRIAN_OS_ROOT) are honoured only when they are the same
// directory; a value pointing anywhere else (a dev clone named by ~/.claude/settings.json) would
// make `npm ci` wipe that tree's node_modules while the real cache stays empty.
const OWN_ROOT = path.resolve(__dirname, '..');
function sameDirectory(a, b) {
  try { return fs.realpathSync(a) === fs.realpathSync(b); } catch (e) { return path.resolve(a) === path.resolve(b); }
}
const ENV_ROOT = process.env.CLAUDE_PLUGIN_ROOT || process.env.MINDRIAN_OS_ROOT || '';
const PLUGIN_ROOT = (ENV_ROOT && sameDirectory(ENV_ROOT, OWN_ROOT)) ? ENV_ROOT : OWN_ROOT;

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
  if (!needInstall) {
    // 369.1-REVIEW CR-02: every dependency directory present is not proof of a finished
    // install. An install that started and never finished (the record says "installing"
    // with a dead or stale installer) left this tree half built, so re-run it. A live
    // installer is left to finish (no blocking wait inside a SessionStart hook).
    // mcp-dep-heal.cjs is built-ins only, so requiring it is safe with node_modules absent;
    // if it cannot load (a truncated cache), the presence check above stands.
    try {
      const heal = require('../lib/core/mcp-dep-heal.cjs');
      if (!heal.treeTrusted(PLUGIN_ROOT, deps) && !heal.installInFlight(PLUGIN_ROOT).inFlight) needInstall = true;
    } catch (_) { /* presence-only */ }
  }
  if (needInstall) {
    // Route the install through the shared guarded path so this hook and the
    // MCP self-heal (lib/core/mcp-dep-heal.cjs, debug session
    // mcp-servers-cache-missing-node-modules) never run two concurrent
    // `npm install` invocations against the same node_modules. The lock-loser
    // waits for the winner instead of corrupting the directory.
    //
    // mcp-dep-heal.cjs + npm-install-lock.cjs are pure node-built-in modules,
    // so requiring them is safe even with node_modules absent. If the require
    // somehow fails (truncated cache), fall back to a direct guarded-best-effort
    // install -- the uncaughtException handler still guarantees {continue:true}.
    let healed = false;
    try {
      const { runGuardedInstall } = require('../lib/core/mcp-dep-heal.cjs');
      runGuardedInstall(PLUGIN_ROOT);
      healed = true;
    } catch (_) { /* fall through to direct install */ }
    if (!healed) {
      // Fallback path: the shared guarded module could not be required (a
      // truncated cache). Run the install directly -- but STILL portable.
      // npm-cli-resolve.cjs is a pure node-built-in module (safe to require
      // with node_modules absent); it resolves npm to its absolute npm-cli.js
      // off process.execPath so this works on Windows (no `.cmd` dependency)
      // and Mac (no PATH dependency for GUI-launched Claude Code), not just
      // Linux. If even that require fails, the last-ditch bare spawn runs --
      // the uncaughtException handler still guarantees {continue:true}.
      const { spawnSync } = require('node:child_process');
      try {
        const { resolveNpmCli, buildInstallArgs } = require('../lib/core/npm-cli-resolve.cjs');
        const npm = resolveNpmCli();
        const frozen = fs.existsSync(path.join(PLUGIN_ROOT, 'npm-shrinkwrap.json'));
        spawnSync(npm.command, buildInstallArgs(npm, undefined, { frozen }), {
          cwd: PLUGIN_ROOT,
          timeout: 120000,
          stdio: 'ignore',
          shell: npm.shell,
        });
      } catch (_) {
        const lastDitch = fs.existsSync(path.join(PLUGIN_ROOT, 'npm-shrinkwrap.json'))
          ? ['ci', '--ignore-scripts', '--no-audit', '--no-fund']
          : ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--silent'];
        spawnSync('npm', lastDitch, {
          cwd: PLUGIN_ROOT,
          timeout: 120000,
          stdio: 'ignore',
          shell: process.platform === 'win32',
        });
      }
    }
  }
} catch (e) { /* swallow -- defensive: never block the hook chain */ }

emit();
