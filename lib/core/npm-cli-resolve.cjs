#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * MindrianOS Plugin -- portable npm CLI resolution (debug session
 * mcp-servers-cache-missing-node-modules, escalated mandate 2026-05-21).
 *
 * THE PROBLEM (code review of the prior Option D fix, commit f6cafe74):
 * The self-heal and the SessionStart reconcile hook both ran
 * `spawnSync('npm', ['install', ...])`. That bare invocation is NOT
 * cross-platform:
 *   - WINDOWS: `npm` is `npm.cmd` (a batch file). spawnSync('npm') with no
 *     shell:true and no .cmd suffix returns ENOENT -- the heal silently does
 *     nothing. On Windows the node_modules gap then NEVER heals.
 *   - MAC: even with the .cmd issue aside, spawnSync('npm') depends on `npm`
 *     being on the child process PATH. A GUI-launched (Dock/Finder) Claude
 *     Code gives child processes a minimal PATH that frequently excludes the
 *     nvm / Homebrew bin directory where `npm` lives -- same ENOENT, different
 *     cause. `shell:true` does NOT fix this (it does not add the missing dir
 *     to PATH).
 *
 * THE FIX (this module): resolve npm to an ABSOLUTE path, independent of PATH
 * and independent of the platform file extension.
 *
 * The key insight: npm ships in the SAME distribution as the `node` binary
 * already executing this code. `process.execPath` is the absolute path to
 * that node binary. npm's real entry point is a plain JavaScript file --
 * `npm-cli.js` -- which lives at a fixed location relative to the node binary:
 *   - POSIX  (Linux, Mac): <nodeBinDir>/../lib/node_modules/npm/bin/npm-cli.js
 *   - WINDOWS:              <nodeBinDir>/node_modules/npm/bin/npm-cli.js
 * Running `node <absolute npm-cli.js> install ...` invokes npm directly with
 * the SAME node binary, sidestepping PATH, the .cmd extension, and shell:true
 * entirely. This is correct by construction on Windows, Mac, and Linux.
 *
 * Fallback: if npm-cli.js cannot be located off process.execPath (an unusual
 * layout -- a system-package node, a relocated install), the resolver returns
 * a PATH-based spawn descriptor that DOES carry the Windows .cmd handling
 * (shell:true on win32) so the backstop is still better than the bare
 * pre-fix invocation.
 *
 * Canon Part 8: zero network surface. Pure node built-ins. This module only
 * computes a spawn descriptor; the caller runs `npm install`.
 *
 * HARD RULE: no em-dashes anywhere in this file (hyphens only).
 */

const fs = require('node:fs');
const path = require('node:path');

const IS_WINDOWS = process.platform === 'win32';

/**
 * Candidate absolute locations of npm's JavaScript entry point (npm-cli.js),
 * derived from the directory of the currently-running node binary.
 *
 * Node distributions place npm consistently:
 *   - POSIX tarball / nvm / Homebrew / Volta:
 *       bin/node  +  lib/node_modules/npm/bin/npm-cli.js
 *   - Windows zip / installer:
 *       node.exe  +  node_modules/npm/bin/npm-cli.js   (same dir as node.exe)
 *
 * Both layouts are probed on every platform (a defensive superset) so a
 * non-standard packaging still resolves if npm is present anywhere npm
 * normally ships.
 *
 * @param {string} [execPath] - override for process.execPath (tests)
 * @returns {string[]} absolute candidate paths, most-likely first
 */
function npmCliCandidates(execPath) {
  const nodeBin = path.dirname(execPath || process.execPath);
  return [
    // Windows-style: npm sits beside node.exe.
    path.join(nodeBin, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    // POSIX-style: npm sits one level up under lib/.
    path.join(nodeBin, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    // Some Windows installs nest under a node_modules/npm with a lib prefix.
    path.join(nodeBin, '..', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ];
}

/**
 * Resolve a portable, absolute spawn descriptor for `npm install`.
 *
 * Preferred result (strategy 'node-npm-cli'):
 *   { command: process.execPath, baseArgs: [<abs npm-cli.js>], shell: false }
 * Run npm by feeding its JS entry point to the current node binary. No PATH
 * dependency, no .cmd extension, no shell. Correct on Windows, Mac, Linux.
 *
 * Fallback result (strategy 'path-npm'):
 *   { command: 'npm', baseArgs: [], shell: true on win32 else false }
 * Used only when npm-cli.js is not found off process.execPath. shell:true is
 * set on Windows so the OS resolves `npm` -> `npm.cmd` (still better than the
 * pre-fix bare spawn, though it remains PATH-dependent).
 *
 * @param {object} [opts]
 * @param {string} [opts.execPath] - override process.execPath (tests)
 * @returns {{command:string, baseArgs:string[], shell:boolean, strategy:string, npmCli:(string|null)}}
 */
function resolveNpmCli(opts) {
  opts = opts || {};
  const candidates = npmCliCandidates(opts.execPath);
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return {
          command: opts.execPath || process.execPath,
          baseArgs: [candidate],
          shell: false,
          strategy: 'node-npm-cli',
          npmCli: candidate,
        };
      }
    } catch (_) {
      // stat failure on a candidate -- try the next one.
    }
  }
  // Fallback: npm-cli.js not locatable. PATH-based spawn, with Windows .cmd
  // handling via shell:true. Still an improvement over the bare pre-fix call.
  return {
    command: 'npm',
    baseArgs: [],
    shell: IS_WINDOWS,
    strategy: 'path-npm',
    npmCli: null,
  };
}

/**
 * Build the full argv for `npm install` (production-safe, quiet, no scripts
 * surprises) given a resolved descriptor from resolveNpmCli().
 *
 * @param {{baseArgs:string[]}} descriptor
 * @param {string[]} [installArgs] - npm args after `install`; defaults to the
 *                                   quiet production set used by the heal path.
 * @returns {string[]} argv to pass as the second arg of spawnSync(command, argv)
 */
function buildInstallArgs(descriptor, installArgs) {
  const tail = Array.isArray(installArgs) && installArgs.length
    ? installArgs
    : ['--no-audit', '--no-fund', '--silent'];
  return descriptor.baseArgs.concat(['install'], tail);
}

module.exports = {
  resolveNpmCli,
  buildInstallArgs,
  npmCliCandidates,
  IS_WINDOWS,
};
