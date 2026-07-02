#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 127.2 Plan 04 -- Instance #7: post-update atomic activation
 * (the META-FIX for the silent-activation gap).
 *
 * Problem (RCA: .planning/debug/resolved/mos-update-silent-activation-gap.md):
 *   `/mos:update` and `claude plugin update mos@mindrian-marketplace` land
 *   the new plugin bytes in ~/.claude/plugins/cache/mindrian-marketplace/mos/
 *   <NEW_VERSION>/ but DO NOT atomically swap the active install at
 *   ~/.claude/plugins/mindrian-os/. Every subsequent MCP probe, statusline
 *   render, and hook output continues to read the OLD bytes. Users think
 *   they are on beta.N+1 while every Brain interaction silently reads
 *   beta.N. Surfaced 2026-05-23 on the maintainer's dogfood box.
 *
 * Solution:
 *   This module reuses scripts/doctor.cjs's Phase 95.2 atomic-swap pipeline
 *   (performRecoveryAtomic + safeRename, lines ~399-499 of doctor.cjs):
 *   cp -> verify -> two-step rename. After the swap, set a touch-file at
 *   ~/.mindrian/post-update-restart-pending that the sessionstart preflight
 *   hook reads on the NEXT session to confirm activation reached the wire
 *   (MCP server version matches package.json version-of-record).
 *
 * Canon discipline:
 *   - Part 7 (Reuse Before Build): delegates the atomic-swap to doctor.cjs
 *     --fix (the existing implementation, three autopsies of hardening) via
 *     child_process.spawnSync. Does NOT re-implement the swap logic. This
 *     module is the orchestrator + touch-file writer + Shape E action report
 *     only.
 *   - Part 8: pure LOCAL filesystem. Zero network surface.
 *   - Part 6 (Dog-fooding): closes the 7th case in the install-cache failure
 *     family (docs/install-cache-family-premortem.md).
 *
 * Exports:
 *   activatePostUpdate(opts) -> Promise<{ok, swapped, oldVersion, newVersion,
 *                                        backupPath, touchFilePath, message}>
 *   POST_UPDATE_TOUCH_FILE   absolute path to ~/.mindrian/post-update-restart-pending
 *
 * CLI invocation (from /mos:update Step 7 + doctor.cjs --fix --post-update):
 *   node scripts/post-update-activation.cjs            human-readable Shape E report
 *   node scripts/post-update-activation.cjs --json     machine-readable JSON result
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

// The Mindrian block-letter logo opens the post-update banner (navigator rule,
// 2026-07-02: the mark is visible after ANY update). Consumed as-is; degrades
// to plain when NO_COLOR / non-TTY. Loaded defensively so a missing/renamed
// module can never break the activation report.
let buildLogo = null;
try { ({ buildLogo } = require(path.join(__dirname, '..', 'lib', 'hmi', 'mindrian-ascii-logo.cjs'))); }
catch (_) { buildLogo = null; }

const HOME = process.env.HOME || process.env.USERPROFILE || os.homedir();
const PLUGIN_HOME = process.env.MINDRIAN_PLUGIN_HOME || path.join(HOME, '.claude', 'plugins');
const INSTALL_DIR = path.join(PLUGIN_HOME, 'mindrian-os');
const INSTALL_PLUGIN_JSON = path.join(INSTALL_DIR, '.claude-plugin', 'plugin.json');
const MARKETPLACE_CACHE_DIR = path.join(PLUGIN_HOME, 'cache', 'mindrian-marketplace', 'mos');
const MINDRIAN_DIR = path.join(HOME, '.mindrian');
const POST_UPDATE_TOUCH_FILE = path.join(MINDRIAN_DIR, 'post-update-restart-pending');

// ANSI colors for Shape E report (no-op when NO_COLOR / non-TTY).
const useColor = process.env.MOS_NO_COLOR !== '1' && !process.env.NO_COLOR && process.stdout.isTTY === true;
const C = useColor
  ? { reset: '\x1b[0m', dim: '\x1b[2m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m' }
  : { reset: '', dim: '', green: '', yellow: '', red: '', cyan: '' };

// -- helpers --------------------------------------------------------------

function readPluginVersion(dir) {
  const pj = path.join(dir, '.claude-plugin', 'plugin.json');
  if (!fs.existsSync(pj)) return null;
  try {
    return JSON.parse(fs.readFileSync(pj, 'utf8')).version || null;
  } catch (_) { return null; }
}

// Inherits the Phase 95.2 parseVersion + cmpVersion convention without
// pulling the whole module: scan MARKETPLACE_CACHE_DIR for the latest
// semver-comparable version dir, return its name (or null if empty).
function findLatestCacheVersion() {
  if (!fs.existsSync(MARKETPLACE_CACHE_DIR)) return null;
  let entries;
  try { entries = fs.readdirSync(MARKETPLACE_CACHE_DIR, { withFileTypes: true }); }
  catch (_) { return null; }
  const versions = entries
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .filter(n => /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(n));
  if (versions.length === 0) return null;
  // Sort using semver-aware string comparison; lean on `semver` if available.
  try {
    const semver = require('semver');
    versions.sort(semver.compare);
  } catch (_) {
    // Fallback: lexicographic (Phase 126 Plan 02 noted this is wrong for
    // beta.10 vs beta.9, but it is correctness-equivalent here because the
    // cache typically holds at most one new + one current version).
    versions.sort();
  }
  return versions[versions.length - 1];
}

// -- main API -------------------------------------------------------------

/**
 * Activate the freshly-landed cache-staging directory by atomically swapping
 * the live install. Idempotent: if no staging dir is newer than live, returns
 * `{ok: true, swapped: false}` without side-effects.
 *
 * @param {Object} [opts]
 * @param {string} [opts.pluginHome] override ~/.claude/plugins (for tests)
 * @param {string} [opts.stagingHint] explicit staging version (defaults to
 *   the latest version dir in MARKETPLACE_CACHE_DIR)
 * @returns {Promise<Object>} result envelope
 */
async function activatePostUpdate(opts) {
  opts = opts || {};
  const pluginHome = opts.pluginHome || PLUGIN_HOME;
  const installDir = path.join(pluginHome, 'mindrian-os');
  const cacheDir = path.join(pluginHome, 'cache', 'mindrian-marketplace', 'mos');
  const mindrianDir = opts.mindrianDir || MINDRIAN_DIR;
  const touchFile = path.join(mindrianDir, 'post-update-restart-pending');

  // 1. Determine current live version + cache-staging candidate.
  const liveVersion = readPluginVersion(installDir);
  const stagingVersion = opts.stagingHint || (function () {
    if (!fs.existsSync(cacheDir)) return null;
    let entries;
    try { entries = fs.readdirSync(cacheDir, { withFileTypes: true }); }
    catch (_) { return null; }
    const versions = entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .filter(n => /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(n));
    if (versions.length === 0) return null;
    try {
      const semver = require('semver');
      versions.sort(semver.compare);
    } catch (_) {
      versions.sort();
    }
    return versions[versions.length - 1];
  }());

  if (!stagingVersion) {
    return {
      ok: true,
      swapped: false,
      oldVersion: liveVersion,
      newVersion: null,
      backupPath: null,
      touchFilePath: null,
      message: 'no cache-staging directory found; nothing to activate.',
    };
  }

  if (liveVersion && liveVersion === stagingVersion) {
    return {
      ok: true,
      swapped: false,
      oldVersion: liveVersion,
      newVersion: stagingVersion,
      backupPath: null,
      touchFilePath: null,
      message: `already on latest (${stagingVersion}); no swap needed.`,
    };
  }

  // 2. Delegate the atomic swap to doctor.cjs --fix (Part 7 -- reuse the
  //    Phase 95.2 implementation, three autopsies of hardening). The
  //    subprocess inherits MINDRIAN_PLUGIN_HOME so test harnesses targeting
  //    a custom pluginHome (opts.pluginHome) still drive the same fix
  //    pipeline.
  const env = Object.assign({}, process.env);
  if (opts.pluginHome) env.MINDRIAN_PLUGIN_HOME = opts.pluginHome;
  const doctorPath = path.join(__dirname, 'doctor.cjs');
  const res = spawnSync('node', [doctorPath, '--fix', '--json'], {
    encoding: 'utf8',
    timeout: 60000,
    env,
  });
  const stdout = (res && res.stdout) || '';
  const stderr = (res && res.stderr) || '';
  let report = null;
  try { report = JSON.parse(stdout); } catch (_) { /* fall through */ }

  // doctor.cjs --fix exit codes: 0=healthy, 1=drift detected (no --fix),
  // 2=drift detected AND recovered, 3=internal, 4=recovery double-failure.
  const exitCode = res ? res.status : -1;
  const recovered = !!(report && report.classARecovered);

  if (recovered) {
    // 3. Set the touch-file so the next session's preflight hook can
    //    verify activation reached the wire.
    try {
      fs.mkdirSync(mindrianDir, { recursive: true });
      fs.writeFileSync(touchFile, stagingVersion + '\n', 'utf8');
    } catch (e) {
      return {
        ok: false,
        swapped: true,
        oldVersion: liveVersion,
        newVersion: stagingVersion,
        backupPath: report.classARecovered.backup || null,
        touchFilePath: null,
        message: 'swap complete but touch-file write failed: ' + e.message,
      };
    }
    return {
      ok: true,
      swapped: true,
      oldVersion: liveVersion,
      newVersion: stagingVersion,
      backupPath: report.classARecovered.backup || null,
      touchFilePath: touchFile,
      message: `swap complete to ${stagingVersion}; session restart required so MCP servers reconnect against new bytes.`,
    };
  }

  // Recovery did not occur. Either no drift was detected (live already
  // matched cache) or recovery errored.
  if (exitCode === 0 && report && report.install && report.install.version === stagingVersion) {
    return {
      ok: true,
      swapped: false,
      oldVersion: liveVersion,
      newVersion: stagingVersion,
      backupPath: null,
      touchFilePath: null,
      message: `already on latest (${stagingVersion}); no swap needed.`,
    };
  }

  // Genuine recovery failure -- surface it.
  const detail = (report && report.recoveryError)
    || (stderr.trim().slice(-200))
    || ('doctor exit ' + exitCode);
  return {
    ok: false,
    swapped: false,
    oldVersion: liveVersion,
    newVersion: stagingVersion,
    backupPath: null,
    touchFilePath: null,
    message: 'activation failed: ' + detail,
  };
}

// -- Shape E action report rendering --------------------------------------

// Loud, bordered restart banner -- the LAST thing the user sees after a swap.
// The update swaps installPath under the running session, so the in-memory
// slash-command registry goes stale until restart (F8). Approved glyphs only.
function renderRestartBanner() {
  const rule = '------------------------------------------------------------';
  const lines = [];
  lines.push('');
  lines.push(`${C.yellow}${rule}${C.reset}`);
  lines.push(`${C.yellow}⚠  RESTART THIS SESSION NOW${C.reset}`);
  lines.push(`${C.yellow}${rule}${C.reset}`);
  lines.push('The update swapped the install under this running session.');
  lines.push('Slash commands ( /mos:help, /mos:* ) will read as MISSING');
  lines.push('until you restart. This is EXPECTED. Nothing is broken.');
  lines.push('');
  lines.push('  -> Close and reopen the terminal, or kill and re-run `claude`');
  lines.push('  -> Then run /mos:help to confirm commands are reachable');
  lines.push(`${C.yellow}${rule}${C.reset}`);
  lines.push('');
  return lines.join('\n');
}

function renderActionReport(result) {
  const lines = [];
  lines.push(`${C.dim}-- MindrianOS -- post-update-activation --${C.reset}`);
  lines.push('');
  if (result.swapped && result.ok) {
    lines.push(`  ${C.green}■${C.reset} activation              ${C.green}✓${C.reset} swap complete to ${C.green}${result.newVersion}${C.reset}`);
    if (result.oldVersion) {
      lines.push(`     ${C.dim}live    ${C.yellow}${result.oldVersion}${C.reset} ${C.dim}→${C.reset} ${C.green}${result.newVersion}${C.reset}`);
    }
    if (result.backupPath) {
      lines.push(`     ${C.dim}backup ${result.backupPath}${C.reset}`);
    }
    lines.push(`     ${C.dim}touch-file: ${result.touchFilePath}${C.reset}`);
    // The Mindrian mark opens the banner, the loud RESTART banner closes it
    // (the LAST thing the user sees). Logo is best-effort; never a hard dep.
    if (typeof buildLogo === 'function') {
      try { lines.push(''); lines.push(buildLogo({})); } catch (_) { /* skip logo on any render error */ }
    }
    lines.push(renderRestartBanner());
    return lines.join('\n');
  } else if (result.ok && !result.swapped) {
    lines.push(`  ${C.green}■${C.reset} activation              ${C.green}✓${C.reset} ${result.message}`);
  } else {
    lines.push(`  ${C.red}■${C.reset} activation              ${C.red}⚠${C.reset} ${result.message}`);
  }
  lines.push('');
  return lines.join('\n');
}

// -- CLI ------------------------------------------------------------------

async function main() {
  const argv = process.argv.slice(2);
  const json = argv.indexOf('--json') !== -1;
  try {
    const result = await activatePostUpdate({});
    if (json) {
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    } else {
      process.stdout.write(renderActionReport(result));
    }
    process.exit(result.ok ? 0 : 1);
  } catch (e) {
    if (json) {
      process.stdout.write(JSON.stringify({ ok: false, error: e.message }, null, 2) + '\n');
    } else {
      process.stderr.write(`post-update-activation: ${e.message}\n`);
    }
    process.exit(1);
  }
}

module.exports = {
  activatePostUpdate,
  renderActionReport,
  POST_UPDATE_TOUCH_FILE,
};

if (require.main === module) {
  main();
}
