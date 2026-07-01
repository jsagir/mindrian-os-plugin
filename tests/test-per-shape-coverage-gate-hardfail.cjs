'use strict';
/*
 * Phase 188-00 Wave 0 -- the per-shape coverage FLOOR / hard-fail test (SFS-10).
 * =========================================================================
 * Models on tests/test-render-coverage-gate-hardfail.cjs (the RENDER-plane
 * fail-closed test). Proves BY CONSTRUCTION that the PER-SHAPE coverage gate
 * (added to scripts/check-render-coverage.cjs in 188-03, enabled for F.8/F.9 in
 * 188-07) FAILS CLOSED when a canonical shape (F.0-F.9) lacks a renderer/branch,
 * while the live repo stays GREEN.
 *
 * WAVE 0 STATUS: this test is RED now. The per-shape predicate does not exist yet
 * (188-03 adds gate.perShapeCoverageReport + the --check-shapes flag). This stub
 * is authored to FLIP GREEN the moment 188-03/188-07 wire the predicate -- it is
 * the CONTRACT those waves implement against. It runs (valid CJS) and fails on an
 * assertion (RED-not-error), never a crash.
 *
 * The predicate CONTRACT this test pins (do not rename downstream):
 *   gate.perShapeCoverageReport({ shapes?, dispatcherRel? })
 *       -> { shapes:[...], gaps:[{shape, reason}], ok }
 *     A shape is a gap iff it lacks (1) a resolvable renderer module OR (2) a
 *     `requestedShape === 'F.x'` dispatch branch (reuse the comment-aware
 *     hasCallSite). Default shapes = the canonical ten F.0-F.9; F.7-dial is F.7's
 *     render path, NOT a separate shape.
 *   CLI: `node scripts/check-render-coverage.cjs --check-shapes` exits 1 on any
 *     gap with a self-naming error + a recovery line. A synthetic missing shape is
 *     injected via the PER_SHAPE_COVERAGE_SHAPES env override (comma list) so NO
 *     tracked file is ever mutated (mirrors the RENDER_COVERAGE_REGISTRY idiom).
 *
 * Read-only: temp-override via env only; no tracked file mutated (T-188-00-01).
 * House rule: hyphens only, no em-dashes. Canon Part 8: zero Brain/network.
 */

const assert = require('node:assert');
const path = require('node:path');
const cp = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const GATE = path.join(REPO_ROOT, 'scripts', 'check-render-coverage.cjs');
const gate = require(GATE);

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

// ---------------------------------------------------------------------------
// Existence guard: the per-shape predicate must be wired (RED until 188-03).
// ---------------------------------------------------------------------------
ok('gate exports perShapeCoverageReport (wired in 188-03)',
  typeof gate.perShapeCoverageReport === 'function');

// ---------------------------------------------------------------------------
// Predicate level: a synthetic missing shape (F.99 has no renderer/branch)
// classifies as a gap; the canonical ten over the live tree have zero gaps
// (once F.8/F.9 land in 188-07).
// ---------------------------------------------------------------------------
const synth = gate.perShapeCoverageReport({ shapes: ['F.0', 'F.99'] });
ok('a synthetic missing shape (F.99) is classified as a gap',
  synth && Array.isArray(synth.gaps) && synth.gaps.some((g) => g.shape === 'F.99'));
ok('the gap self-names the offending shape with a reason',
  synth.gaps.find((g) => g.shape === 'F.99').reason.length > 0);

const live = gate.perShapeCoverageReport({});
ok('the canonical ten F.0-F.9 have zero gaps on the live tree (enabled in 188-07)',
  live && Array.isArray(live.gaps) && live.gaps.length === 0 && live.ok === true);

// ---------------------------------------------------------------------------
// End-to-end: with a synthetic missing shape injected via the env override,
// `--check-shapes` exits NON-ZERO and names the offender + a recovery line.
// NO tracked file is mutated -- the synthesis rides the env var only.
// ---------------------------------------------------------------------------
function spawnCheckShapes(extraShapesCsv) {
  return cp.spawnSync('node', [GATE, '--check-shapes'], {
    encoding: 'utf8',
    timeout: 60000,
    env: Object.assign({}, process.env, { PER_SHAPE_COVERAGE_SHAPES: extraShapesCsv }),
  });
}

const darkRun = spawnCheckShapes('F.0,F.1,F.2,F.3,F.4,F.5,F.6,F.7,F.8,F.9,F.99');
ok('synthetic missing shape present -> --check-shapes exits non-zero (fail closed)',
  darkRun && darkRun.status !== 0);
const stderr = (darkRun && darkRun.stderr) || '';
ok('the FAIL message names the offending shape (F.99)', stderr.indexOf('F.99') !== -1);
ok('the FAIL message carries a recovery line', /Recovery:/.test(stderr));

// ---------------------------------------------------------------------------
// Baseline: the clean live repo passes --check-shapes exit 0 (gap=0).
// ---------------------------------------------------------------------------
const clean = cp.spawnSync('node', [GATE, '--check-shapes'], { encoding: 'utf8', timeout: 60000 });
ok('clean live repo --check-shapes exits 0 (baseline gap=0)', clean.status === 0);

console.log('\nPASS test-per-shape-coverage-gate-hardfail (' + pass + ' assertions)');
console.log('>>> test-per-shape-coverage-gate-hardfail.cjs: PASSED');
