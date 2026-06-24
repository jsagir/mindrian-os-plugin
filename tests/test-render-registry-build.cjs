'use strict';
/*
 * Phase 178-01 Task 1 (TDD) - the render-coverage registry build test.
 *
 * Proves the SEPARATE render-coverage registry (data/render-coverage-registry.json)
 * is minted by scripts/build-render-coverage.cjs as a DERIVED, exhaustive AST/grep
 * walk over the .cjs render ENTRY POINTS (C-1): the 14 pickShape callers (including
 * the lib/hmi/selector-dispatcher.cjs dispatcher self-call) + the 2 renderDial
 * callers = 16 entry points. Each entry is a two-state render_coverage value
 * ('card-emission' | 'render-only-excluded'); a render-only-excluded entry REQUIRES
 * a non-empty reason. The F.7-dial / dial-selector entry declares card-emission
 * (host-appended via pickShape's isFShape branch).
 *
 * This is the BUILD test (the registry exists, is exhaustive, two-state, and the
 * --check byte-compare is stable). The exhaustiveness FLOOR (a code-present-but-
 * registry-absent entry FAILS the build) lives in test-render-registry-exhaustive.cjs
 * (Task 2).
 *
 * House rule: hyphens only, no em-dashes. Canon Part 8: zero Brain / network.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const GEN = path.join(REPO_ROOT, 'scripts', 'build-render-coverage.cjs');
const REGISTRY = path.join(REPO_ROOT, 'data', 'render-coverage-registry.json');

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

// ---------------------------------------------------------------------------
// Build the registry fresh, then read it from disk.
// ---------------------------------------------------------------------------
const build = cp.spawnSync('node', [GEN], { encoding: 'utf8', timeout: 60000 });
ok('build-render-coverage.cjs runs and exits 0', build.status === 0);
ok('data/render-coverage-registry.json exists after build', fs.existsSync(REGISTRY));

const reg = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
const entries = reg.entries;
ok('registry has an entries array', Array.isArray(entries));

// ---------------------------------------------------------------------------
// Exactly 16 render entry-point records (14 pickShape incl. dispatcher self-call
// + 2 renderDial).
// ---------------------------------------------------------------------------
ok('registry has exactly 16 render entry points', entries.length === 16);

const pickShapeEntries = entries.filter((e) => e.kind === 'pickShape');
const renderDialEntries = entries.filter((e) => e.kind === 'renderDial');
ok('14 pickShape entry points', pickShapeEntries.length === 14);
ok('2 renderDial entry points', renderDialEntries.length === 2);

// The dispatcher self-call is a real call site reached at runtime -- it MUST be
// enumerated (the LOW reconciliation: 13 external + 1 dispatcher self-call).
ok(
  'the dispatcher self-call (lib/hmi/selector-dispatcher.cjs pickShape) is enumerated',
  entries.some((e) => e.entry === 'lib/hmi/selector-dispatcher.cjs' && e.kind === 'pickShape')
);

// ---------------------------------------------------------------------------
// Two-state render_coverage on every entry; render-only-excluded REQUIRES a reason.
// ---------------------------------------------------------------------------
ok(
  'every entry carries a two-state render_coverage',
  entries.every((e) => e.render_coverage === 'card-emission' || e.render_coverage === 'render-only-excluded')
);
ok(
  'every render-only-excluded entry carries a non-empty reason',
  entries
    .filter((e) => e.render_coverage === 'render-only-excluded')
    .every((e) => typeof e.reason === 'string' && e.reason.trim().length > 0)
);

// ---------------------------------------------------------------------------
// The F.7-dial / dial-selector entry declares card-emission (host-appended).
// ---------------------------------------------------------------------------
const dialEntry = entries.find(
  (e) => String(e.entry || '').includes('dial-selector') || String(e.shape || '') === 'F.7-dial'
);
ok('the F.7-dial / dial-selector entry is present', !!dialEntry);
ok('the F.7-dial / dial-selector entry declares card-emission', dialEntry && dialEntry.render_coverage === 'card-emission');

// ---------------------------------------------------------------------------
// render_counts block.
// ---------------------------------------------------------------------------
ok('registry carries a render_counts block', reg.render_counts && typeof reg.render_counts === 'object');
ok(
  'render_counts.card_emission + render_only_excluded === 16',
  (reg.render_counts.card_emission + reg.render_counts.render_only_excluded) === 16
);

// ---------------------------------------------------------------------------
// --check byte-stable.
// ---------------------------------------------------------------------------
const check = cp.spawnSync('node', [GEN, '--check'], { encoding: 'utf8', timeout: 60000 });
ok('--check exits 0 on a freshly-built registry (byte-stable)', check.status === 0);

console.log('\nPASS test-render-registry-build (' + pass + ' assertions)');
