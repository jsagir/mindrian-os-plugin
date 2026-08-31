#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * tests/272-cache-location.test.cjs
 *
 * Phase 272, PYPORT-06 (D-07 cache-location fix). RED BY DESIGN TODAY, but
 * for a BEHAVIORAL reason, not a missing-module reason: lib/core/eureka/
 * embedding-spine.cjs ALREADY EXISTS today, so this file requires it
 * DIRECTLY -- a require() failure here would itself be a real, unexpected
 * bug, not this test's intended RED reason.
 *
 * D-07 (272-CONTEXT.md, locked): the default model-cache directory currently
 * resolves INSIDE the versioned plugin install directory
 * (node_modules/@huggingface/transformers/.cache/ in this dev checkout, or
 * ~/.claude/plugins/cache/mindrian-marketplace/mos/<version>/ in a real
 * marketplace install), which lib/core/cache-prune.cjs deletes on every
 * version update (RESEARCH.md Finding F-10, verified live: env.cacheDir on
 * this machine resolves to
 * /home/jsagi/dev/MindrianOS-Plugin/node_modules/@huggingface/transformers/.cache/).
 * Without the fix this becomes a re-download-on-every-update bug, not a true
 * one-time first-run cost.
 *
 * The fix defaults MINDRIAN_MODEL_CACHE to a STABLE path outside that
 * directory, following the SAME $HOME/.mindrian/ home-dir resolution idiom
 * already established elsewhere in this repo:
 *
 *   process.env.HOME || process.env.USERPROFILE || os.homedir()
 *
 * (lib/core/mva-state.cjs:43's homeDir(), matching lib/core/install-state.cjs's
 * own $HOME/.mindrian/ convention) -- this test asserts that specific
 * resolution is used, not a fresh reimplementation.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Use hyphens.
 */

'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SPINE_MODULE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'eureka', 'embedding-spine.cjs');

// Direct require -- embedding-spine.cjs already exists today.
// eslint-disable-next-line global-require
const spine = require(SPINE_MODULE_PATH);

const OLD_MINDRIAN_MODEL_CACHE = process.env.MINDRIAN_MODEL_CACHE;
const OLD_HOME = process.env.HOME;

function restoreEnv() {
  if (OLD_MINDRIAN_MODEL_CACHE === undefined) {
    delete process.env.MINDRIAN_MODEL_CACHE;
  } else {
    process.env.MINDRIAN_MODEL_CACHE = OLD_MINDRIAN_MODEL_CACHE;
  }
  if (OLD_HOME === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = OLD_HOME;
  }
}

async function main() {
  assert.ok(spine && spine._test, 'embedding-spine.cjs must expose a _test surface');
  assert.ok(
    typeof spine._test.resolveCacheDir === 'function',
    'embedding-spine.cjs._test.resolveCacheDir must be a function'
  );

  try {
    // --- Assert 1: with MINDRIAN_MODEL_CACHE UNSET (the real-world default- ---
    // --- user case), the resolved directory must NOT be the transformers.js ---
    // --- package-relative default (the versioned/prunable location, F-10), ---
    // --- and must NOT land inside plugins/cache/mindrian-marketplace either. ---
    delete process.env.MINDRIAN_MODEL_CACHE;
    const fakeTransformersEnv = {
      cacheDir: path.join(REPO_ROOT, 'node_modules', '@huggingface', 'transformers', '.cache'),
    };
    const resolvedDefault = spine._test.resolveCacheDir(fakeTransformersEnv);
    assert.ok(
      typeof resolvedDefault === 'string' && resolvedDefault.length > 0,
      'resolveCacheDir must return a non-empty string default when MINDRIAN_MODEL_CACHE is unset'
    );
    assert.ok(
      !resolvedDefault.includes(path.join('plugins', 'cache', 'mindrian-marketplace')),
      'the default cache dir must NOT resolve inside the versioned plugin install directory ' +
        '(plugins/cache/mindrian-marketplace) -- that directory is deleted on every version ' +
        'update by lib/core/cache-prune.cjs (RESEARCH.md Finding F-10)'
    );
    assert.ok(
      resolvedDefault !== fakeTransformersEnv.cacheDir,
      'the default cache dir must NOT fall through to the transformers.js package-relative ' +
        'env.cacheDir default (node_modules/@huggingface/transformers/.cache/) -- today it does ' +
        'exactly that, which is the reason this assertion is red today'
    );

    // --- Assert 2: the new default specifically resolves under $HOME/.mindrian, ---
    // --- using the repo's established home-dir resolution idiom. ---
    const fakeHome = '/tmp/p272-fake-home-for-cache-location-test';
    process.env.HOME = fakeHome;
    const resolvedUnderFakeHome = spine._test.resolveCacheDir(fakeTransformersEnv);
    assert.ok(
      resolvedUnderFakeHome.startsWith(path.join(fakeHome, '.mindrian')),
      'the default cache dir must resolve under $HOME/.mindrian using the SAME home-dir ' +
        'resolution idiom already used by lib/core/install-state.cjs and lib/core/mva-state.cjs ' +
        '(process.env.HOME || process.env.USERPROFILE || os.homedir()), got: ' + resolvedUnderFakeHome
    );

    // --- Assert 3: MINDRIAN_MODEL_CACHE, when explicitly set, still overrides ---
    // --- the new default (backward compatible -- D-07 changes the DEFAULT ---
    // --- value only, it does not remove the override). ---
    const explicitOverride = '/tmp/p272-explicit-model-cache-override';
    process.env.MINDRIAN_MODEL_CACHE = explicitOverride;
    const resolvedWithOverride = spine._test.resolveCacheDir(fakeTransformersEnv);
    assert.equal(
      resolvedWithOverride,
      explicitOverride,
      'an explicitly set MINDRIAN_MODEL_CACHE must still override the default (backward compatible)'
    );

    console.log('PASS 272-cache-location');
  } finally {
    restoreEnv();
  }
}

main().catch((e) => {
  restoreEnv();
  console.error(e);
  process.exit(1);
});
