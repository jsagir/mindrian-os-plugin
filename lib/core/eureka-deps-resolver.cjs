'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 341 (install-and-update-overhaul) Plan 02, D-09 -- the eureka
 * side-directory resolution authority.
 *
 * WHAT: this module is the ONE place in the tree that resolves the local
 * embedding stack's package tree. It exports exactly three functions:
 *   eurekaDepsRoot()          -> absolute path string, never throws
 *   requireEurekaDep(name)    -> loaded module, or null, never throws
 *   eurekaDepInstalled(name)  -> { installed, where, dir }, never throws
 *
 * WHY: Plan 341-04 removes `@huggingface/transformers` from `dependencies`
 * so the shipped tarball drops the ~380 MB transformers.js/ONNX-runtime
 * stack. D-09 replaces that with an on-demand install into a side
 * directory (`~/.mindrian/eureka-deps/`), installed by
 * `lib/core/eureka/eureka-enable.cjs` (this plan's Task 2) via
 * `/mos:eureka enable` and `doctor --fix eureka`. Every consumer that used
 * to `require('@huggingface/transformers')` directly now resolves it
 * through THIS module instead, so there is exactly one resolution
 * authority shared by the runtime lazy require
 * (`lib/core/eureka/embedding-spine.cjs`), the installer, and (plan 341-03)
 * Class S's `model_installed` layer.
 *
 * WHY A SIDE DIRECTORY UNDER ~/.mindrian AND NOT THE PLUGIN CACHE:
 * `lib/core/cache-prune.cjs` deletes the VERSIONED plugin cache directory
 * on every update, so a package tree stored there would be re-downloaded
 * on every version bump -- the exact D14 distribution gap this phase
 * closes for good. `~/.mindrian/model-cache` already exists for the same
 * reason (embedding-spine.cjs's resolveCacheDir). `eureka-deps` holds
 * PACKAGES (code); `model-cache` holds WEIGHTS (data). Two directories,
 * two lifetimes, two failure modes -- never conflated.
 *
 * CANON PART 7 (Reuse Before Build): the home-dir resolution chain below
 * (`process.env.HOME || process.env.USERPROFILE || os.homedir()`) is
 * copied from the established convention at `lib/core/mva-state.cjs:43`,
 * not reinvented.
 *
 * CANON PART 8 (Graph Boundary): this module touches only local
 * filesystem paths and local `require()` resolution. Zero network, zero
 * Brain call, zero user-byte egress.
 *
 * TEST SEAM: `MINDRIAN_EUREKA_DEPS_ROOT` overrides `eurekaDepsRoot()` when
 * set to a non-empty (trimmed) string -- checked FIRST, before the home-dir
 * chain -- so `tests/test-341-eureka-deps-resolver.cjs` runs fully hermetic
 * against a tmpdir, never the real machine's $HOME.
 *
 * NEVER THROW ACROSS A RESOLVER BOUNDARY: every export here degrades to a
 * documented default (a path string, null, or a plain object) instead of
 * propagating. This is a READ path; directory creation belongs to the
 * installer (`eureka-enable.cjs`), not here.
 *
 * House rule: hyphens only, no em-dashes, no emoji. CJS, process.argv
 * routing.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createRequire } = require('node:module');

// Package-name guard (T-341-08, Tampering mitigation): only a valid npm
// package name (optionally scoped) may reach createRequire/require below.
// This is what keeps `requireEurekaDep('../../etc/passwd')` or an absolute
// path from ever resolving outside the intended side directory.
const PACKAGE_NAME_RE = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

/**
 * eurekaDepsRoot() -- the absolute path to the side directory that holds the
 * on-demand-installed embedding stack. Checks the test seam FIRST, else
 * follows the established home-dir chain. Never throws: on any failure this
 * falls all the way back to os.homedir(), and if even THAT throws, returns
 * null. Does NOT mkdirSync -- this is a read/resolve path only; the
 * installer owns directory creation.
 *
 * @returns {string|null}
 */
function eurekaDepsRoot() {
  const override = process.env.MINDRIAN_EUREKA_DEPS_ROOT;
  if (typeof override === 'string' && override.trim() !== '') return override.trim();
  try {
    const home = process.env.HOME || process.env.USERPROFILE || os.homedir();
    return path.join(home, '.mindrian', 'eureka-deps');
  } catch (_e) {
    try {
      return path.join(os.homedir(), '.mindrian', 'eureka-deps');
    } catch (_e2) {
      return null;
    }
  }
}

function _isValidPackageName(name) {
  return typeof name === 'string' && PACKAGE_NAME_RE.test(name);
}

/**
 * requireEurekaDep(name) -- loads a package by name, side-directory FIRST,
 * plugin node_modules SECOND (the dev-checkout arm, where the package is
 * still in the plugin's own node_modules), null on a miss. NEVER throws
 * across this boundary.
 *
 * Resolution order:
 *   1. Guard `name` against PACKAGE_NAME_RE -- reject anything that looks
 *      like a relative or absolute path.
 *   2. createRequire(anchor inside eurekaDepsRoot())(name) -- the side
 *      directory wins when the package was installed there.
 *   3. Plain require(name) -- falls back to the plugin's own node_modules
 *      (still present pre-341-04-cut, or in a dev checkout).
 *   4. null.
 *
 * @param {string} name
 * @returns {*|null}
 */
function requireEurekaDep(name) {
  if (!_isValidPackageName(name)) return null;
  const root = eurekaDepsRoot();
  if (root) {
    try {
      // createRequire takes a FILENAME, not a directory; the anchor file
      // itself need not exist -- Node walks upward from its directory to
      // find node_modules. 'noop.js' is never created or read.
      const anchor = path.join(root, 'noop.js');
      const sideRequire = createRequire(anchor);
      return sideRequire(name);
    } catch (_e) {
      // Fall through to the plain-require arm below.
    }
  }
  try {
    // eslint-disable-next-line global-require
    return require(name);
  } catch (_e) {
    return null;
  }
}

/**
 * eurekaDepInstalled(name) -- a pure existence probe over the two candidate
 * `node_modules/<name>/package.json` paths (side directory, then plugin).
 * Never loads the module, never throws. This is what plan 341-03's Class S
 * `model_installed` layer calls, and what makes the "one resolution
 * authority" claim true rather than aspirational.
 *
 * @param {string} name
 * @returns {{installed: boolean, where: ('side-dir'|'plugin'|null), dir: (string|null)}}
 */
function eurekaDepInstalled(name) {
  if (!_isValidPackageName(name)) return { installed: false, where: null, dir: null };
  const root = eurekaDepsRoot();
  try {
    if (root) {
      const sideDir = path.join(root, 'node_modules', name);
      const sidePkg = path.join(sideDir, 'package.json');
      if (fs.existsSync(sidePkg)) {
        return { installed: true, where: 'side-dir', dir: sideDir };
      }
    }
  } catch (_e) {
    // Fall through to the plugin probe.
  }
  try {
    // Plugin root: this module lives at lib/core/, so the root is two
    // levels up -- the same walk class-s-eureka-smoke.cjs uses for its
    // three-level walk from lib/core/doctor/.
    const pluginRoot = path.resolve(__dirname, '..', '..');
    const pluginDir = path.join(pluginRoot, 'node_modules', name);
    const pluginPkg = path.join(pluginDir, 'package.json');
    if (fs.existsSync(pluginPkg)) {
      return { installed: true, where: 'plugin', dir: pluginDir };
    }
  } catch (_e) {
    // Defensive default below.
  }
  return { installed: false, where: null, dir: null };
}

module.exports = { eurekaDepsRoot, requireEurekaDep, eurekaDepInstalled };
