#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 102-05 -- RENDER-102-05 color overlay regression fence.
 *
 * IIFE harness with 6 assertions per Plan 102-05 §Task 3:
 *
 *   1. accent_applied:        TTY simulated; jtbd='find-bottleneck' ->
 *                             output starts with \`\\x1b[31m■\\x1b[0m\`.
 *   2. accent_each_jtbd:      for each of 13 JTBDs the accent renders
 *                             with the expected color (mapping per D-06).
 *   3. compact_no_accent:     when compaction triggers (env var or
 *                             budget), no \`■\` accent in Zone 1.
 *   4. non_tty_no_ansi:       isTTY false -> no ANSI escape codes in
 *                             output. Strip-ANSI(TTY) === non-TTY (D-07).
 *   5. palette_complete:      every taxonomy JTBD has a CLI color
 *                             mapping (no missing entries).
 *   6. palettes_md_present:   \`lib/render/JTBD-PALETTES.md\` exists and
 *                             contains both palette tables (CLI + Mondrian).
 *
 * Exit 0 on full pass; exit 1 on any failure.
 *
 * Pure CJS, node built-ins only, zero new runtime deps (Phase 87 invariant).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const V2_PATH = path.join(REPO_ROOT, 'lib', 'render', 'render-v2.cjs');
const PALETTES_PATH = path.join(REPO_ROOT, 'lib', 'render', 'JTBD-PALETTES.md');

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

// Strip-ANSI helper. Removes the SGR escape sequences emitted by Plan
// 102-05 (and only those — the renderer never emits other ANSI types).
function stripAnsi(s) {
  // eslint-disable-next-line no-control-regex
  return String(s).replace(/\x1b\[\d+m/g, '');
}

// TTY toggle helper. process.stdout.isTTY is a writable boolean in Node;
// the helper saves + restores so we never leave the runtime in a leaked
// state if an assertion throws mid-test.
function withTTY(value, fn) {
  const previous = process.stdout.isTTY;
  process.stdout.isTTY = value;
  try {
    return fn();
  } finally {
    process.stdout.isTTY = previous;
  }
}

// Local copy of the canonical D-06 mapping. Mirrors the renderer's
// JTBD_CLI_COLOR map. Test 5 asserts the renderer's exported map matches
// this list one-to-one (no missing JTBDs, no orphan colors).
const EXPECTED_JTBD_COLORS = Object.freeze({
  'decide-pursue': 'red',
  'find-problem': 'yellow',
  'understand-market': 'cyan',
  'find-bottleneck': 'red',
  'prepare-pitch': 'green',
  'validate-idea': 'yellow',
  'compare-options': 'cyan',
  'connect-domains': 'cyan',
  'surface-contradiction': 'red',
  'plan-execution': 'green',
  'file-meeting': 'cyan',
  'audit-room': 'yellow',
  'explore': 'gray',
});

// Canonical ANSI sequences (5-color contract). The renderer's exported
// ANSI const must match these byte-for-byte.
const EXPECTED_ANSI = Object.freeze({
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  gray: '\x1b[90m',
  reset: '\x1b[0m',
});

// ---------------------------------------------------------------------------
// 1. accent_applied: TTY simulated; jtbd='find-bottleneck' -> red ■ accent.
// ---------------------------------------------------------------------------
(function test1_accentApplied() {
  const label = 'accent_applied: TTY + find-bottleneck -> red ■ accent';
  try {
    const out = withTTY(true, function () {
      const savedEnv = process.env.CLAUDE_CONTEXT_USED_PCT;
      delete process.env.CLAUDE_CONTEXT_USED_PCT;
      try {
        return v2.render({
          zones: { header: 'venture-room', body: 'b' },
          mode: 'A',
          operator: 'BUILD_ROOM',
          tier: 1,
          jtbd: 'find-bottleneck',
          tokenBudget: { used: 0, total: 1 },
        });
      } finally {
        if (savedEnv !== undefined) process.env.CLAUDE_CONTEXT_USED_PCT = savedEnv;
      }
    });
    assert.equal(typeof out.rendered, 'string', 'rendered is a string');
    // Header must start with red SGR + ■ + reset SGR + space.
    assert.ok(
      out.rendered.startsWith('\x1b[31m■\x1b[0m '),
      'rendered starts with red ■ accent + space; got: ' + JSON.stringify(out.rendered.slice(0, 20))
    );
    // Underlying header text must still be present after the accent.
    assert.ok(
      out.rendered.indexOf('venture-room') !== -1,
      'original header text still in rendered output'
    );
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// 2. accent_each_jtbd: each of 13 JTBDs renders with the expected color.
// ---------------------------------------------------------------------------
(function test2_accentEachJtbd() {
  const label = 'accent_each_jtbd: all 13 JTBDs render with their D-06 color';
  try {
    withTTY(true, function () {
      const savedEnv = process.env.CLAUDE_CONTEXT_USED_PCT;
      delete process.env.CLAUDE_CONTEXT_USED_PCT;
      try {
        for (const jtbd of Object.keys(EXPECTED_JTBD_COLORS)) {
          const expectedColor = EXPECTED_JTBD_COLORS[jtbd];
          const expectedAnsi = EXPECTED_ANSI[expectedColor];
          const out = v2.render({
            zones: { header: 'h', body: 'b' },
            mode: 'A',
            operator: 'BUILD_ROOM',
            tier: 1,
            jtbd: jtbd,
            tokenBudget: { used: 0, total: 1 },
          });
          assert.ok(
            out.rendered.startsWith(expectedAnsi + '■\x1b[0m '),
            'jtbd ' + jtbd + ' should render with ' + expectedColor +
              ' (' + JSON.stringify(expectedAnsi) + '); got: ' +
              JSON.stringify(out.rendered.slice(0, 20))
          );
        }
      } finally {
        if (savedEnv !== undefined) process.env.CLAUDE_CONTEXT_USED_PCT = savedEnv;
      }
    });
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// 3. compact_no_accent: compaction (env or budget) drops the accent.
// ---------------------------------------------------------------------------
(function test3_compactNoAccent() {
  const label = 'compact_no_accent: compact mode drops the ■ accent (D-08)';
  try {
    // 3a. Compact via env var.
    withTTY(true, function () {
      const savedEnv = process.env.CLAUDE_CONTEXT_USED_PCT;
      process.env.CLAUDE_CONTEXT_USED_PCT = '85';
      try {
        const out = v2.render({
          zones: { header: 'h', body: 'b' },
          mode: 'A',
          operator: 'BUILD_ROOM',
          tier: 1,
          jtbd: 'find-bottleneck',
          tokenBudget: { used: 0, total: 1 },
        });
        // Compact mode MUST drop the leading colored ■ accent.
        assert.ok(
          !out.rendered.startsWith('\x1b[31m■\x1b[0m '),
          'env-driven compact mode drops the colored ■ accent'
        );
      } finally {
        if (savedEnv === undefined) delete process.env.CLAUDE_CONTEXT_USED_PCT;
        else process.env.CLAUDE_CONTEXT_USED_PCT = savedEnv;
      }
    });

    // 3b. Compact via tokenBudget ratio > 0.80.
    withTTY(true, function () {
      const savedEnv = process.env.CLAUDE_CONTEXT_USED_PCT;
      delete process.env.CLAUDE_CONTEXT_USED_PCT;
      try {
        const out = v2.render({
          zones: { header: 'h', body: 'b' },
          mode: 'A',
          operator: 'BUILD_ROOM',
          tier: 1,
          jtbd: 'find-bottleneck',
          tokenBudget: { used: 90, total: 100 },
        });
        assert.ok(
          !out.rendered.startsWith('\x1b[31m■\x1b[0m '),
          'budget-driven compact mode drops the colored ■ accent'
        );
      } finally {
        if (savedEnv !== undefined) process.env.CLAUDE_CONTEXT_USED_PCT = savedEnv;
      }
    });
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// 4. non_tty_no_ansi: isTTY=false -> output has zero ANSI escape codes,
//    AND the output is byte-identical to the strip-ANSI of the TTY render.
//    This is the RENDER-102-05 strip-ANSI invariant.
// ---------------------------------------------------------------------------
(function test4_nonTtyNoAnsi() {
  const label = 'non_tty_no_ansi: non-TTY no ANSI; byte-identical to strip-ANSI(TTY)';
  try {
    const savedEnv = process.env.CLAUDE_CONTEXT_USED_PCT;
    delete process.env.CLAUDE_CONTEXT_USED_PCT;
    try {
      const args = {
        zones: { header: 'h', body: 'b', signals: ['s1'], footer: 'f' },
        mode: 'A',
        operator: 'BUILD_ROOM',
        tier: 1,
        jtbd: 'find-bottleneck',
        tokenBudget: { used: 0, total: 1 },
      };
      const ttyOut = withTTY(true, function () { return v2.render(args).rendered; });
      const nonTtyOut = withTTY(false, function () { return v2.render(args).rendered; });

      // Non-TTY render contains NO ANSI escape codes.
      assert.equal(
        // eslint-disable-next-line no-control-regex
        /\x1b\[/.test(nonTtyOut),
        false,
        'non-TTY render contains zero ANSI escape codes'
      );

      // TTY render contains AT LEAST one ANSI escape (the accent).
      // eslint-disable-next-line no-control-regex
      assert.ok(/\x1b\[/.test(ttyOut), 'TTY render contains the accent ANSI');

      // Strip-ANSI(TTY) MUST equal non-TTY byte-for-byte. This is the
      // canonical RENDER-102-05 invariant: color is overlay-only, never
      // changes the underlying text.
      assert.equal(
        stripAnsi(ttyOut),
        nonTtyOut,
        'strip-ANSI(TTY) byte-identical to non-TTY render'
      );
    } finally {
      if (savedEnv !== undefined) process.env.CLAUDE_CONTEXT_USED_PCT = savedEnv;
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// 5. palette_complete: renderer's JTBD_CLI_COLOR matches the canonical
//    13-row taxonomy AND every value is a valid 5-color token.
// ---------------------------------------------------------------------------
(function test5_paletteComplete() {
  const label = 'palette_complete: 13 JTBDs mapped, all 5-color contract values';
  try {
    const exported = v2.JTBD_CLI_COLOR;
    assert.ok(exported, 'JTBD_CLI_COLOR is exported from render-v2');
    assert.ok(Object.isFrozen(exported), 'JTBD_CLI_COLOR is frozen');

    const exportedKeys = Object.keys(exported).sort();
    const expectedKeys = Object.keys(EXPECTED_JTBD_COLORS).sort();
    assert.deepEqual(
      exportedKeys,
      expectedKeys,
      'exported JTBD keys exactly match the canonical 13-row D-06 taxonomy'
    );

    // Every value is one of the 5 SKILL.md §4 contract colors.
    const allowedColors = ['red', 'yellow', 'cyan', 'green', 'gray'];
    for (const k of exportedKeys) {
      assert.ok(
        allowedColors.indexOf(exported[k]) !== -1,
        'jtbd ' + k + ' maps to a 5-color contract value (got: ' + exported[k] + ')'
      );
      // And it must match the canonical D-06 mapping.
      assert.equal(
        exported[k],
        EXPECTED_JTBD_COLORS[k],
        'jtbd ' + k + ' D-06 mapping correct'
      );
    }

    // ANSI export shape stable.
    const ansi = v2.ANSI;
    assert.ok(ansi, 'ANSI is exported from render-v2');
    assert.ok(Object.isFrozen(ansi), 'ANSI is frozen');
    for (const color of Object.keys(EXPECTED_ANSI)) {
      assert.equal(
        ansi[color],
        EXPECTED_ANSI[color],
        'ANSI[' + color + '] byte-identical to canonical SGR'
      );
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// 6. palettes_md_present: JTBD-PALETTES.md exists and contains both
//    palette tables (CLI + Mondrian) per D-06b documentation requirement.
// ---------------------------------------------------------------------------
(function test6_palettesMdPresent() {
  const label = 'palettes_md_present: JTBD-PALETTES.md exists with both palette tables';
  try {
    assert.ok(
      fs.existsSync(PALETTES_PATH),
      'lib/render/JTBD-PALETTES.md exists'
    );
    const md = fs.readFileSync(PALETTES_PATH, 'utf8');

    // Both palette section headers present.
    assert.ok(
      md.indexOf('CLI Semantic Palette') !== -1,
      'doc contains CLI Semantic Palette section'
    );
    assert.ok(
      md.indexOf('Mondrian') !== -1,
      'doc contains Mondrian palette section'
    );

    // All 13 JTBD handles appear at least once in the doc.
    for (const jtbd of Object.keys(EXPECTED_JTBD_COLORS)) {
      assert.ok(
        md.indexOf(jtbd) !== -1,
        'doc references jtbd handle: ' + jtbd
      );
    }

    // Forward references to downstream consumers (D-06b).
    assert.ok(md.indexOf('Phase 19') !== -1, 'doc references Phase 19 consumer');
    assert.ok(md.indexOf('Phase 25') !== -1, 'doc references Phase 25 consumer');
    assert.ok(md.indexOf('Phase 30') !== -1, 'doc references Phase 30 consumer');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Summary + exit code.
// ---------------------------------------------------------------------------
process.stdout.write('\n');
process.stdout.write(
  'Phase 102-05 render-v2 color overlay: ' +
    passed + ' passed, ' + failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);
