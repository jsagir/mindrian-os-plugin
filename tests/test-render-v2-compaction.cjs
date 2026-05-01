#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 102-02 -- token-budget-aware compaction regression fence.
 *
 * Replaces the Phase 102-00 Wave-0 stub at this path. Single 80%
 * threshold per CONTEXT D-02 + D-03. Adaptive granularity (50/70/80/90)
 * is v1.15.x deferred and explicitly out of scope here.
 *
 * IIFE harness with 8 assertions (Plan 102-02 Task 2):
 *
 *   1. threshold_80                tokenBudget {used:81,total:100} compacts;
 *                                  {used:79,total:100} does NOT.
 *   2. env_var_priority            CLAUDE_CONTEXT_USED_PCT=85 wins even when
 *                                  tokenBudget says no.
 *   3. body_cap                    50-line body truncates to 30 + "... <20
 *                                  more rows>".
 *   4. signals_cap                 5-signal array clamps to first 2.
 *   5. footer_cap_preserve_freetext verbs ['A','B','C','Free-Text'] ->
 *                                   ['A','Free-Text'] (Free-Text last).
 *   6. footer_cap_no_freetext      verbs ['A','B','C'] -> ['A','B'].
 *   7. header_compact              decorative dashes collapsed; single line.
 *   8. fallback_heuristic          no env var, no budget -> isCompact()
 *                                  returns boolean (true OR false ok).
 *
 * Exit 0 on full pass; exit 1 on any failure. Pure CJS, node built-ins
 * only, zero new runtime deps (Phase 87 invariant).
 *
 * Canon Part 7 + Part 8 invariants identical to test-render-v2-signature.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const V2_PATH = path.join(REPO_ROOT, 'lib', 'render', 'render-v2.cjs');

const v2 = require(V2_PATH);

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  process.stdout.write('  ok ' + name + '\n');
}

function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

// Each scenario must restore process.env.CLAUDE_CONTEXT_USED_PCT to its
// pre-test value so siblings do not see leaked state. Centralize the
// save/restore so individual scenarios stay readable.
function withEnv(value, fn) {
  const prior = process.env.CLAUDE_CONTEXT_USED_PCT;
  if (value === undefined) {
    delete process.env.CLAUDE_CONTEXT_USED_PCT;
  } else {
    process.env.CLAUDE_CONTEXT_USED_PCT = value;
  }
  try {
    fn();
  } finally {
    if (prior === undefined) {
      delete process.env.CLAUDE_CONTEXT_USED_PCT;
    } else {
      process.env.CLAUDE_CONTEXT_USED_PCT = prior;
    }
  }
}

// ---------------------------------------------------------------------------
// 1. threshold_80: 81/100 compacts, 79/100 does not.
// ---------------------------------------------------------------------------
(function test1_threshold80() {
  const label = 'threshold_80: >0.80 compacts, <=0.80 does not';
  try {
    withEnv(undefined, function () {
      // 81/100 -> compact === true.
      const env81 = v2.render({
        zones: { header: '-- h --', body: 'b', footer: { verbs: ['A', 'B', 'C', 'Free-Text'] } },
        operator: 'BUILD_ROOM',
        tier: 1,
        tokenBudget: { used: 81, total: 100 },
      });
      assert.equal(env81.contract.compact, true, '81/100 must compact');

      // 79/100 -> compact === false.
      const env79 = v2.render({
        zones: { header: '-- h --', body: 'b', footer: { verbs: ['A', 'B', 'C', 'Free-Text'] } },
        operator: 'BUILD_ROOM',
        tier: 1,
        tokenBudget: { used: 79, total: 100 },
      });
      assert.equal(env79.contract.compact, false, '79/100 must NOT compact');

      // Boundary: exactly 80/100 -> NOT compact (strict > not >=).
      const env80 = v2.render({
        zones: { header: 'h' },
        operator: 'BUILD_ROOM',
        tier: 1,
        tokenBudget: { used: 80, total: 100 },
      });
      assert.equal(env80.contract.compact, false, 'exactly 80/100 must NOT compact (strict >)');
    });
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// 2. env_var_priority: env=85 wins even when tokenBudget arg says no.
// ---------------------------------------------------------------------------
(function test2_envVarPriority() {
  const label = 'env_var_priority: CLAUDE_CONTEXT_USED_PCT=85 wins over tokenBudget';
  try {
    withEnv('85', function () {
      const env = v2.render({
        zones: { header: 'h', body: 'b' },
        operator: 'BUILD_ROOM',
        tier: 1,
        // tokenBudget says comfortably under 80% -- env var must override.
        tokenBudget: { used: 10, total: 100 },
      });
      assert.equal(env.contract.compact, true, 'env=85 forces compact even when tokenBudget=10/100');
    });

    // Inverse: env=50 must override a tokenBudget that would otherwise
    // compact. This protects the priority rule in both directions so a
    // stale tokenBudget cannot accidentally trigger compaction when the
    // env var is the source of truth.
    withEnv('50', function () {
      const env = v2.render({
        zones: { header: 'h' },
        operator: 'BUILD_ROOM',
        tier: 1,
        tokenBudget: { used: 99, total: 100 },
      });
      assert.equal(env.contract.compact, false, 'env=50 overrides tokenBudget=99/100');
    });
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// 3. body_cap: 50-line body -> 30 + "... <20 more rows>".
// ---------------------------------------------------------------------------
(function test3_bodyCap() {
  const label = 'body_cap: 50-line body truncates to 30 + "... <20 more rows>"';
  try {
    withEnv('85', function () {
      const body = Array(50).fill('row').join('\n');
      const env = v2.render({
        zones: { header: 'h', body: body },
        operator: 'BUILD_ROOM',
        tier: 1,
      });
      assert.equal(env.contract.compact, true, 'compaction fired');
      assert.ok(env.rendered.indexOf('... <20 more rows>') !== -1, 'overflow marker present');

      // Confirm the FIRST 30 rows survive and rows 31..50 are gone.
      const lines = env.rendered.split('\n');
      const rowLines = lines.filter(function (l) { return l === 'row'; });
      assert.equal(rowLines.length, 30, 'exactly 30 row lines survive');
    });
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// 4. signals_cap: 5-signal array clamps to first 2.
// ---------------------------------------------------------------------------
(function test4_signalsCap() {
  const label = 'signals_cap: 5-signal array clamps to first 2';
  try {
    withEnv('85', function () {
      const env = v2.render({
        zones: {
          header: 'h',
          body: 'b',
          signals: ['s1', 's2', 's3', 's4', 's5'],
        },
        operator: 'BUILD_ROOM',
        tier: 1,
      });
      assert.equal(env.contract.compact, true, 'compaction fired');
      assert.ok(env.rendered.indexOf('▷ s1') !== -1, 's1 retained');
      assert.ok(env.rendered.indexOf('▷ s2') !== -1, 's2 retained');
      assert.ok(env.rendered.indexOf('▷ s3') === -1, 's3 dropped');
      assert.ok(env.rendered.indexOf('▷ s4') === -1, 's4 dropped');
      assert.ok(env.rendered.indexOf('▷ s5') === -1, 's5 dropped');
    });
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// 5. footer_cap_preserve_freetext: ['A','B','C','Free-Text'] -> ['A','Free-Text'].
// ---------------------------------------------------------------------------
(function test5_footerCapPreserveFreeText() {
  const label = 'footer_cap_preserve_freetext: Free-Text preserved as last';
  try {
    withEnv('85', function () {
      const env = v2.render({
        zones: {
          header: 'h',
          body: 'b',
          footer: { verbs: ['A', 'B', 'C', 'Free-Text'] },
        },
        operator: 'BUILD_ROOM',
        tier: 1,
      });
      assert.equal(env.contract.compact, true, 'compaction fired');
      assert.ok(env.rendered.indexOf('▷ A') !== -1, 'A retained as first');
      assert.ok(env.rendered.indexOf('▷ Free-Text') !== -1, 'Free-Text retained');
      assert.ok(env.rendered.indexOf('▷ B') === -1, 'B dropped');
      assert.ok(env.rendered.indexOf('▷ C') === -1, 'C dropped');

      // Order check: Free-Text comes AFTER A in the rendered output.
      const aIdx = env.rendered.indexOf('▷ A');
      const ftIdx = env.rendered.indexOf('▷ Free-Text');
      assert.ok(aIdx < ftIdx, 'A precedes Free-Text');
    });
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// 6. footer_cap_no_freetext: ['A','B','C'] -> ['A','B'].
// ---------------------------------------------------------------------------
(function test6_footerCapNoFreeText() {
  const label = 'footer_cap_no_freetext: no Free-Text -> first 2 verbs';
  try {
    withEnv('85', function () {
      const env = v2.render({
        zones: {
          header: 'h',
          body: 'b',
          footer: { verbs: ['A', 'B', 'C'] },
        },
        operator: 'BUILD_ROOM',
        tier: 1,
      });
      assert.equal(env.contract.compact, true, 'compaction fired');
      assert.ok(env.rendered.indexOf('▷ A') !== -1, 'A retained');
      assert.ok(env.rendered.indexOf('▷ B') !== -1, 'B retained');
      assert.ok(env.rendered.indexOf('▷ C') === -1, 'C dropped');
    });
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// 7. header_compact: decorative dashes stripped; single line.
// ---------------------------------------------------------------------------
(function test7_headerCompact() {
  const label = 'header_compact: decorative dashes collapsed, single-line';
  try {
    withEnv('85', function () {
      // Standard envelope-style header with leading and trailing " -- ".
      const env = v2.render({
        zones: {
          header: '-- mindrianOS -- doctor -- 6 classes -- ',
          body: 'b',
        },
        operator: 'BUILD_ROOM',
        tier: 1,
      });
      assert.equal(env.contract.compact, true, 'compaction fired');
      // Leading "-- " collapses to "■ "; trailing " -- " is stripped.
      assert.ok(
        env.rendered.indexOf('■ mindrianOS') === 0 ||
          env.rendered.split('\n')[0].indexOf('■ mindrianOS') === 0,
        'leading "-- " collapsed to "■ "'
      );
      // Mid-string " -- " separators preserved (semantic dividers).
      assert.ok(
        env.rendered.indexOf('mindrianOS -- doctor') !== -1,
        'mid-string " -- " separator preserved'
      );
      // Trailing decoration removed.
      const headerLine = env.rendered.split('\n')[0];
      assert.ok(
        !/ -- $/.test(headerLine),
        'trailing " -- " removed'
      );

      // Multi-line header collapses to single line.
      const env2 = v2.render({
        zones: {
          header: 'line-one\nline-two\nline-three',
          body: 'b',
        },
        operator: 'BUILD_ROOM',
        tier: 1,
      });
      const headerLine2 = env2.rendered.split('\n')[0];
      assert.equal(headerLine2, 'line-one', 'multi-line header collapses to first line');
      assert.ok(env2.rendered.indexOf('line-two') === -1, 'line-two dropped');
      assert.ok(env2.rendered.indexOf('line-three') === -1, 'line-three dropped');

      // Box-drawing characters stripped.
      const env3 = v2.render({
        zones: {
          header: '┌─ banner ─┐',
          body: 'b',
        },
        operator: 'BUILD_ROOM',
        tier: 1,
      });
      const headerLine3 = env3.rendered.split('\n')[0];
      assert.ok(headerLine3.indexOf('┌') === -1, '┌ stripped');
      assert.ok(headerLine3.indexOf('─') === -1, '─ stripped');
      assert.ok(headerLine3.indexOf('┐') === -1, '┐ stripped');
      assert.ok(headerLine3.indexOf('banner') !== -1, 'banner text retained');
    });
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// 8. fallback_heuristic: no env var, no tokenBudget -> isCompact returns
//    a boolean (either value acceptable; we only assert the type).
// ---------------------------------------------------------------------------
(function test8_fallbackHeuristic() {
  const label = 'fallback_heuristic: no env, no budget -> isCompact returns boolean';
  try {
    withEnv(undefined, function () {
      // Direct introspection: isCompact is exported for fence access.
      assert.equal(typeof v2.isCompact, 'function', 'isCompact exported');
      const result = v2.isCompact(undefined);
      assert.equal(typeof result, 'boolean', 'isCompact(undefined) returns boolean');

      // And via render(): compact field on contract is always boolean.
      const env = v2.render({
        zones: { header: 'h', body: 'b' },
        operator: 'BUILD_ROOM',
        tier: 1,
      });
      assert.equal(typeof env.contract.compact, 'boolean', 'contract.compact is boolean');
    });
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Summary + exit code.
// ---------------------------------------------------------------------------
process.stdout.write('\n');
process.stdout.write(
  'Phase 102-02 render-v2 compaction: ' +
    passed + ' passed, ' + failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);
