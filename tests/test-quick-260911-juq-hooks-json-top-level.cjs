#!/usr/bin/env node
// Quick task 260911-juq -- Claude Code 2.1.268 printed, at every session
// start, on every surface that loads the plugin manifest:
//   hooks.json: unknown keys "_mcpFirst198Migrated", "_firstInstallRouterOrdering" ignored
// Both keys were our own build metadata, never hook configuration; the
// loader was correct to ignore them and correct to complain. The fix moved
// both markers verbatim into data/hooks-markers.json and left
// hooks/hooks.json with exactly one top-level key (hooks). This test is the
// permanent guard against either regression: the stray key coming back, or
// the sidecar path silently going dead (which would make lib/mcp/hook-
// adapter-audit.cjs's migratedSurfaces() return [] through its never-throws
// catch, and the D-06 adapter budget go vacuous).
//
// Node built-in test runner + assert only. No em-dashes. CJS only.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const HOOKS_JSON_PATH = path.join(REPO_ROOT, 'hooks', 'hooks.json');
const HOOKS_MARKERS_PATH = path.join(REPO_ROOT, 'data', 'hooks-markers.json');

// Arm 1: the fix holds -- hooks/hooks.json's top level is exactly ["hooks"].
test('Arm 1: hooks/hooks.json top-level keys are exactly ["hooks"] (the fix holds)', () => {
  const parsed = JSON.parse(fs.readFileSync(HOOKS_JSON_PATH, 'utf8'));
  const keys = Object.keys(parsed);
  assert.deepStrictEqual(
    keys,
    ['hooks'],
    'hooks/hooks.json must have exactly one top-level key, "hooks". Found: ' + JSON.stringify(keys) +
      '. Any extra key here reproduces the Claude Code 2.1.268 unknown-keys warning.'
  );
});

// Arm 2: nothing was lost -- both markers survive verbatim in the sidecar.
test('Arm 2: data/hooks-markers.json carries both markers, nothing lost in the move', () => {
  const markers = JSON.parse(fs.readFileSync(HOOKS_MARKERS_PATH, 'utf8'));

  const migrated = markers._mcpFirst198Migrated;
  assert.ok(migrated && Array.isArray(migrated.surfaces), '_mcpFirst198Migrated.surfaces must be an array');

  const scripts = migrated.surfaces.map((s) => s && s.script);
  for (const expected of [
    'scripts/statusline-mos-dispatch',
    'scripts/sessionstart-coordinator.cjs',
    'scripts/on-stop',
  ]) {
    assert.ok(
      scripts.includes(expected),
      '_mcpFirst198Migrated.surfaces must still name ' + expected + '. Found: ' + JSON.stringify(scripts)
    );
  }

  const ordering = markers._firstInstallRouterOrdering;
  assert.ok(
    ordering && typeof ordering._note === 'string' && ordering._note.length > 0,
    '_firstInstallRouterOrdering._note must be a non-empty string'
  );
  assert.match(
    ordering._note,
    /first-install-router\.cjs/,
    '_firstInstallRouterOrdering._note must still mention first-install-router.cjs'
  );
  assert.match(
    ordering._note,
    /mva-detect\.cjs/,
    '_firstInstallRouterOrdering._note must still mention mva-detect.cjs (the load-bearing ordering fact the note exists to carry)'
  );
});

// Arm 3: sidecar liveness -- the important one. migratedSurfaces() swallows
// every error and returns [] by contract, so a wrong path would silently
// make the whole D-06 adapter budget vacuous instead of failing. This arm
// makes that impossible: it asserts the real reader actually resolves all
// three migrated scripts through the sidecar.
test('Arm 3: migratedSurfaces() resolves all 3 scripts through the sidecar (guards against a silently-dead path)', () => {
  const audit = require('../lib/mcp/hook-adapter-audit.cjs');
  const surfaces = audit.migratedSurfaces();
  assert.strictEqual(
    surfaces.length,
    3,
    'migratedSurfaces() must return 3 scripts, not ' + surfaces.length + ' (' + JSON.stringify(surfaces) +
      '). A wrong sidecar path returns [] through the never-throws catch and silently makes the D-06 adapter budget vacuous.'
  );
  assert.deepStrictEqual(
    surfaces.slice().sort(),
    [
      'scripts/on-stop',
      'scripts/sessionstart-coordinator.cjs',
      'scripts/statusline-mos-dispatch',
    ].slice().sort(),
    'migratedSurfaces() must name exactly the three migrated scripts'
  );
});

// Arm 4: mutation leg -- proves Arm 1's matcher actually discriminates
// rather than passing on anything. Runs the same key-equality assertion
// against an in-memory fixture that carries an extra top-level key and
// confirms it throws.
test('Arm 4: the top-level-keys guard is not vacuous -- an extra key fails the same assertion', () => {
  const fixtureWithExtraKey = {
    _someFutureMarker: { note: 'a future regression re-adding a stray top-level key' },
    hooks: {},
  };
  assert.throws(
    () => {
      assert.deepStrictEqual(Object.keys(fixtureWithExtraKey), ['hooks']);
    },
    /AssertionError/,
    'the key-equality assertion must actually throw on a fixture with an extra top-level key, proving the guard discriminates'
  );
});
