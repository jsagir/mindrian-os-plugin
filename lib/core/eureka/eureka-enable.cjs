'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 341 (install-and-update-overhaul) Plan 02, D-09 -- on-demand
 * installer for the local embedding stack.
 *
 * WHAT: three exports.
 *   EUREKA_DEP_SPEC              the frozen, pinned npm install spec
 *   buildEurekaInstallArgv(opts) PURE argv builder, spawns nothing
 *   enableEureka(opts)           the real installer: probe -> lock -> spawn
 *                                 -> re-probe
 *
 * WHY: plan 341-04 removes `@huggingface/transformers` from
 * `dependencies` so the shipped npm-source tarball drops the ~380 MB
 * transformers.js/ONNX-runtime stack. This module is the precondition
 * that makes that cut safe: `/mos:eureka enable` and `doctor --fix eureka`
 * (this plan's Task 3) both call `enableEureka()` to install the stack
 * on demand into `~/.mindrian/eureka-deps/`, platform-scoped so a Mac
 * never downloads DirectML.dll.
 *
 * CANON PART 7 (Reuse Before Build): this module reuses
 * `lib/core/npm-cli-resolve.cjs` (`resolveNpmCli` + `buildInstallArgs`,
 * the existing cross-platform npm invocation) and
 * `lib/core/npm-install-lock.cjs` (`acquireInstallLock` /
 * `releaseInstallLock` / `waitForUnlock`) rather than re-implementing
 * either. It does not spawn npm directly and does not hand-roll a second
 * lock file scheme.
 *
 * CANON PART 8 (Graph Boundary): the ONLY egress in this module is the
 * npm registry fetch the user explicitly asked for by running
 * `/mos:eureka enable` or `doctor --fix eureka`. Zero Brain reads, zero
 * Brain writes, zero room content anywhere near this file.
 *
 * TEST SEAM: `MINDRIAN_EUREKA_DEPS_ROOT` (same seam as
 * `eureka-deps-resolver.cjs`) overrides the default install prefix, so
 * `tests/test-341-eureka-enable-argv.cjs` can assert the built argv
 * without ever touching the real ~/.mindrian/eureka-deps.
 *
 * House rule: hyphens only, no em-dashes, no emoji. CJS, process.argv
 * routing.
 */

const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const { resolveNpmCli, buildInstallArgs } = require('../npm-cli-resolve.cjs');
const { acquireInstallLock, releaseInstallLock, waitForUnlock } = require('../npm-install-lock.cjs');
const { eurekaDepsRoot, eurekaDepInstalled } = require('../eureka-deps-resolver.cjs');

// EUREKA_DEP_SPEC: the frozen, pinned range for the embedding stack. Read
// directly out of package.json's `dependencies` entry BEFORE plan 341-04
// removes it (measured on this tree at Phase 341 Plan 01 time:
// "@huggingface/transformers": "^4.2.0"). Once 341-04 lands, this constant
// is the ONLY remaining record of that pinned range in the repo -- do not
// re-derive it from package.json after that cut.
const EUREKA_DEP_SPEC = '@huggingface/transformers@^4.2.0';

// The install itself is user-initiated (never on a hook/connect-path clock
// like mcp-dep-heal.cjs's CONNECT_PATH_BUDGET_MS), so it may use the full
// 120000 ms hook-path budget documented in mcp-dep-heal.cjs -- do NOT copy
// that file's connect-path budget arithmetic here.
const INSTALL_TIMEOUT_MS = 120000;

// Findings-text cap convention (scripts/run-harness.cjs): captured stderr
// is sliced to at most this many characters before it ever reaches a
// message a user sees.
const FINDING_TEXT_CAP = 500;

/**
 * buildEurekaInstallArgv(opts) -- PURE argv builder. Spawns nothing, which
 * is what makes it unit-testable without a 380 MB download.
 *
 * `--os` and `--cpu` force optional-dependency platform selection during
 * `npm install`, which is what keeps a Mac from downloading DirectML.dll
 * (a Windows-only optional dep of the transformers.js stack) and vice
 * versa -- npm otherwise resolves optional deps for every platform it can
 * find a match for, not just the one actually running.
 *
 * `opts.prefix` / `opts.platform` / `opts.arch` are TEST-ONLY overrides.
 * The production call path (enableEureka below) never takes any of the
 * three from user argv -- prefix always resolves through
 * eurekaDepsRoot(), platform/arch always come from process.platform /
 * process.arch.
 *
 * @param {{prefix?: string, platform?: string, arch?: string}} [opts]
 * @returns {{command: string, argv: string[], shell: boolean, prefix: string}}
 */
function buildEurekaInstallArgv(opts) {
  const o = opts || {};
  const prefix = (typeof o.prefix === 'string' && o.prefix.trim() !== '') ? o.prefix : eurekaDepsRoot();
  const platform = (typeof o.platform === 'string' && o.platform.trim() !== '') ? o.platform : process.platform;
  const arch = (typeof o.arch === 'string' && o.arch.trim() !== '') ? o.arch : process.arch;

  const descriptor = resolveNpmCli();
  const tail = [
    EUREKA_DEP_SPEC,
    '--prefix', prefix,
    '--os', platform,
    '--cpu', arch,
    '--no-audit',
    '--no-fund',
    '--no-progress',
  ];
  const argv = buildInstallArgs(descriptor, tail);
  return { command: descriptor.command, argv, shell: descriptor.shell, prefix };
}

function _tailCapture(s) {
  return (typeof s === 'string' ? s : '').slice(0, FINDING_TEXT_CAP);
}

/**
 * enableEureka(opts) -- the real installer. Sequence:
 *   a. probe eurekaDepInstalled -- if already installed and opts.force is
 *      not set, return immediately WITHOUT spawning (idempotent by
 *      construction).
 *   b. fs.mkdirSync(prefix, {recursive:true})
 *   c. acquireInstallLock(prefix); on contention, waitForUnlock then
 *      re-probe step (a) before installing. Always releaseInstallLock in a
 *      finally.
 *   d. spawnSync the resolved npm argv, input:'' (never let a prompt hang),
 *      timeout 120000 ms, stderr capped at 500 chars.
 *   e. re-probe eurekaDepInstalled and report `ok` from THAT probe, not
 *      from the spawn's exit code -- a zero exit with nothing on disk is a
 *      failure, and this arm is what catches it.
 *
 * @param {{force?: boolean, prefix?: string, platform?: string, arch?: string}} [opts]
 * @returns {Promise<{ok: boolean, alreadyInstalled: boolean, prefix: (string|null), durationMs: number, message: string, stderrTail: string}>}
 */
async function enableEureka(opts) {
  const o = opts || {};
  const t0 = Date.now();
  const depName = '@huggingface/transformers';

  // Step (a): idempotent probe. No spawn on a machine that already has it.
  const initialProbe = eurekaDepInstalled(depName);
  if (initialProbe.installed && !o.force) {
    return {
      ok: true,
      alreadyInstalled: true,
      prefix: initialProbe.dir ? initialProbe.dir.replace(/[\\/]node_modules[\\/].*$/, '') : eurekaDepsRoot(),
      durationMs: Date.now() - t0,
      message: 'Eureka\'s embedding stack is already installed at ' + initialProbe.dir
        + '. The model weights (MongoDB/mdbr-leaf-ir) download once on the first real embedding call.',
      stderrTail: '',
    };
  }

  const built = buildEurekaInstallArgv({ prefix: o.prefix, platform: o.platform, arch: o.arch });
  const prefix = built.prefix;

  try {
    fs.mkdirSync(prefix, { recursive: true });
  } catch (e) {
    return {
      ok: false,
      alreadyInstalled: false,
      prefix: prefix,
      durationMs: Date.now() - t0,
      message: 'Very simply: could not create the eureka-deps directory at ' + prefix + '.',
      stderrTail: _tailCapture(e && e.message),
    };
  }

  let heldLock = false;
  try {
    heldLock = acquireInstallLock(prefix);
    if (!heldLock) {
      // Another process is installing right now; wait for it, then
      // re-probe before deciding whether we still need to run our own.
      waitForUnlock(prefix);
      const afterWaitProbe = eurekaDepInstalled(depName);
      if (afterWaitProbe.installed && !o.force) {
        return {
          ok: true,
          alreadyInstalled: true,
          prefix: prefix,
          durationMs: Date.now() - t0,
          message: 'Eureka\'s embedding stack is already installed at ' + afterWaitProbe.dir
            + ' (installed by a concurrent enable). The model weights download once on the first real embedding call.',
          stderrTail: '',
        };
      }
      // Still not installed after waiting -- try to acquire and run it
      // ourselves rather than give up.
      heldLock = acquireInstallLock(prefix);
    }

    const spawnResult = spawnSync(built.command, built.argv, {
      shell: built.shell,
      encoding: 'utf8',
      timeout: INSTALL_TIMEOUT_MS,
      input: '',
    });

    const stderrTail = _tailCapture(spawnResult && spawnResult.stderr);

    // Step (e): report ok from a FRESH filesystem probe, never from the
    // spawn exit code alone -- a zero exit with nothing on disk is a
    // failure, and this is what catches it.
    const finalProbe = eurekaDepInstalled(depName);
    if (finalProbe.installed) {
      return {
        ok: true,
        alreadyInstalled: false,
        prefix: prefix,
        durationMs: Date.now() - t0,
        message: 'Eureka\'s embedding stack is installed at ' + prefix
          + '. The model weights (MongoDB/mdbr-leaf-ir) download once on the first real embedding call.',
        stderrTail: stderrTail,
      };
    }
    return {
      ok: false,
      alreadyInstalled: false,
      prefix: prefix,
      durationMs: Date.now() - t0,
      message: 'Very simply: the install did not land the embedding stack at ' + prefix
        + '. Run /mos:eureka enable again, or check the network.',
      stderrTail: stderrTail,
    };
  } finally {
    if (heldLock) releaseInstallLock(prefix);
  }
}

module.exports = { EUREKA_DEP_SPEC, buildEurekaInstallArgv, enableEureka };
