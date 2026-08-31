#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * tests/272-cache-probe.test.cjs
 *
 * Phase 272, PYPORT-06 (D-06 cache-probe fix). RED BY DESIGN TODAY, but for a
 * BEHAVIORAL reason, not a missing-module reason: lib/core/eureka/
 * embedding-spine.cjs ALREADY EXISTS today (unlike this phase's other Wave 0
 * targets), so this file requires it DIRECTLY -- a require() failure here
 * would itself be a real, unexpected bug, not this test's intended RED
 * reason. This is the "assert NEW behavior against EXISTING but
 * not-yet-fixed code" RED-reason class (272-03-PLAN.md Task 2), distinct
 * from Task 1's and Task 3's "missing module" RED-reason class.
 *
 * What is RED today is the BEHAVIOR of _test.isModelCached
 * (embedding-spine.cjs:226-238): it is still the old synchronous
 * fs.existsSync-on-a-guessed-path heuristic, which:
 *
 *   (a) is SYNCHRONOUS, not async -- the D-06 fix makes it delegate to
 *       @huggingface/transformers' ModelRegistry.is_pipeline_cached, which
 *       is async (RESEARCH.md Finding F-11, verified live this session
 *       against @huggingface/transformers@4.2.0: returns false in ~17ms on
 *       a cold cache, no network, no throw).
 *
 *   (b) reads ANY existing <cacheDir>/<owner>/<model> directory as a hit,
 *       even a PARTIALLY-downloaded one missing config.json -- the exact
 *       false-positive ModelRegistry.is_pipeline_cached fixes by checking
 *       the actual required file set for the task and dtype
 *       (RESEARCH.md Finding F-11).
 *
 * This test constructs a real throwaway temp directory (fs.mkdtempSync)
 * for every fixture, cleaned up in a finally, and NEVER touches the real
 * $HOME/.mindrian directory or the real plugin cache directory.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Use hyphens.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SPINE_MODULE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'eureka', 'embedding-spine.cjs');

// Direct require -- embedding-spine.cjs already exists today. A require()
// failure here is a REAL bug, not the intended RED reason, so this file does
// NOT use the defensive try/catch pattern the module-does-not-exist-yet
// Wave 0 tests use.
// eslint-disable-next-line global-require
const spine = require(SPINE_MODULE_PATH);

const TEST_MODEL = 'MindrianTest/not-a-real-model';

async function main() {
  assert.ok(spine && spine._test, 'embedding-spine.cjs must expose a _test surface');
  assert.ok(
    typeof spine._test.isModelCached === 'function',
    'embedding-spine.cjs._test.isModelCached must be a function'
  );

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p272-cache-'));
  try {
    // --- Assert (a): isModelCached must be ASYNC once fixed (returns a ---
    // --- Promise/thenable). Today it is a plain synchronous function ---
    // --- returning a boolean, so `.then` on the return value is undefined -- ---
    // --- this assertion is RED today. ---
    const returnValue = spine._test.isModelCached(TEST_MODEL, tmpDir);
    assert.ok(
      returnValue && typeof returnValue.then === 'function',
      'isModelCached must be async (return a Promise/thenable) once fixed to delegate to ' +
        'ModelRegistry.is_pipeline_cached (RESEARCH.md Finding F-11) -- today it returns a ' +
        'plain synchronous boolean, which is exactly why this assertion is red today'
    );
    const resolvedForUncached = await returnValue;
    assert.equal(
      resolvedForUncached,
      false,
      'a model id with no matching directory under a throwaway cache dir must resolve to false, ' +
        'without throwing and without a network call'
    );

    // --- Assert (b): the D-06 fix delegates to ModelRegistry.is_pipeline_cached, ---
    // --- which is confirmed present and network-free in this session's dep ---
    // --- tree (sanity check on the dependency itself, not on embedding-spine.cjs). ---
    let transformers = null;
    try {
      // eslint-disable-next-line global-require
      transformers = require('@huggingface/transformers');
    } catch (_e) {
      transformers = null;
    }
    assert.ok(
      transformers && transformers.ModelRegistry
        && typeof transformers.ModelRegistry.is_pipeline_cached === 'function',
      'the installed @huggingface/transformers dep must expose ModelRegistry.is_pipeline_cached ' +
        '(RESEARCH.md Finding F-11)'
    );

    // --- Assert (c): the false-positive-on-partial-download regression case. ---
    // Construct a PARTIALLY-downloaded model directory: the owner/model path
    // exists on disk, but is missing config.json (or any real model file) --
    // the exact directory-presence-reads-as-a-hit false positive the OLD
    // fs.existsSync heuristic produces, and which
    // ModelRegistry.is_pipeline_cached fixes by checking the actual required
    // file set instead of mere directory presence.
    const partialModelDir = path.join(tmpDir, ...TEST_MODEL.split('/'));
    fs.mkdirSync(partialModelDir, { recursive: true });
    // Intentionally NOT writing config.json -- a truncated/incomplete
    // download leaves the directory present but the model unusable.
    fs.writeFileSync(path.join(partialModelDir, '.partial-download-marker'), 'incomplete, no config.json');

    const partialResult = await spine._test.isModelCached(TEST_MODEL, tmpDir);
    assert.equal(
      partialResult,
      false,
      'a directory that exists but is missing config.json (a partial/truncated download) must be ' +
        'reported as NOT cached -- today isModelCached uses fs.existsSync on the directory alone ' +
        'and false-positively reports this as a cache HIT (RESEARCH.md Finding F-11)'
    );

    // --- Assert (d, regression guard): the download-notice latch must fire at ---
    // --- most ONCE per process for the same model+cache-dir, even after the ---
    // --- D-06 fix lands. This latch (_downloadNoticeShown, module-level) is ---
    // --- UNCHANGED by this phase -- maybeEmitDownloadNotice must still exist ---
    // --- as a testable seam once the D-06 fix lands. It is not exposed via ---
    // --- _test today (only isModelCached, resolveCacheDir, resetDownloadNotice, ---
    // --- etc. are -- see embedding-spine.cjs:444-467), so this assertion is RED ---
    // --- today for the same behavioral reason as (a)/(c): the fixed module's ---
    // --- testable surface does not exist yet. ---
    assert.ok(
      typeof spine._test.maybeEmitDownloadNotice === 'function',
      'embedding-spine.cjs._test must expose maybeEmitDownloadNotice once the D-06 fix lands, so ' +
        'this test can assert the notice-emission latch fires exactly once across two consecutive ' +
        'calls with the same model+cache-dir (the existing _downloadNoticeShown module-level latch ' +
        'must survive the fix as a regression guard, not just support new behavior)'
    );
    if (typeof spine._test.resetDownloadNotice === 'function') {
      spine._test.resetDownloadNotice();
    }
    if (typeof spine._test.maybeEmitDownloadNotice === 'function') {
      let writeCount = 0;
      const originalWrite = process.stderr.write;
      process.stderr.write = function patchedWrite(...args) {
        writeCount += 1;
        return originalWrite.apply(process.stderr, args);
      };
      try {
        await spine._test.maybeEmitDownloadNotice(TEST_MODEL, tmpDir);
        await spine._test.maybeEmitDownloadNotice(TEST_MODEL, tmpDir);
      } finally {
        process.stderr.write = originalWrite;
      }
      assert.equal(
        writeCount,
        1,
        'the download-notice latch must fire exactly once across two consecutive calls with the ' +
          'same model+cache-dir, not once per call'
      );
    }

    console.log('PASS 272-cache-probe');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
