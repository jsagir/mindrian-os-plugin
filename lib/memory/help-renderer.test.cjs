#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121.5-07 Task 2 -- help-renderer + help-groups.json tests.
 *
 * Test map (6 cases, one-to-one with PLAN Task 2 <behavior> Tests 1-6):
 *
 *   1. data/help-groups.json parses; groups[] has 11 entries.
 *   2. Each group entry has {id, label, glyph, commands: []}.
 *   3. Every commands/*.md (non-admin) appears in EXACTLY one group's commands[].
 *   4. renderHelp({capability: 'truecolor'}) emits 24-bit ANSI escapes.
 *   5. renderHelp({capability: 'ascii'}) emits zero \x1b escape sequences.
 *   6. renderHelp({capability: 'ascii'}) contains sentinel glyphs for each
 *      of the 11 groups (proves all groups render in ASCII mode).
 *
 * Canon Part 3 (UI Ruling System), Part 7 (Reuse Before Build), Part 8
 * (Graph Boundary -- filesystem only, no network, no Brain, no telemetry).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..');
const GROUPS_PATH = path.join(REPO, 'data', 'help-groups.json');
const RENDERER_PATH = path.join(REPO, 'scripts', 'help-renderer.cjs');
const COMMANDS_DIR = path.join(REPO, 'commands');

let passed = 0;
let failed = 0;
const failures = [];

function run(name, fn) {
  try {
    fn();
    console.log('  PASS  ' + name);
    passed++;
  } catch (err) {
    console.error('  FAIL  ' + name);
    console.error('        ' + (err.message || err));
    failed++;
    failures.push(name);
  }
}

// --- Test 1: data/help-groups.json parses + 11 groups ---
run('Test 1: data/help-groups.json parses; groups[] has 11 entries', () => {
  assert.ok(fs.existsSync(GROUPS_PATH), 'data/help-groups.json must exist');
  const groups = JSON.parse(fs.readFileSync(GROUPS_PATH, 'utf8'));
  assert.ok(Array.isArray(groups.groups), 'groups must be array');
  assert.equal(groups.groups.length, 11, 'expected 11 groups, got ' + groups.groups.length);
});

// --- Test 2: each group has required keys ---
run('Test 2: each group has {id, label, glyph, commands: []}', () => {
  const groups = JSON.parse(fs.readFileSync(GROUPS_PATH, 'utf8'));
  for (const g of groups.groups) {
    assert.ok(typeof g.id === 'string' && g.id.length > 0, 'group.id missing: ' + JSON.stringify(g));
    assert.ok(typeof g.label === 'string' && g.label.length > 0, 'group.label missing: ' + g.id);
    assert.ok(typeof g.glyph === 'string' && g.glyph.length > 0, 'group.glyph missing: ' + g.id);
    assert.ok(Array.isArray(g.commands), 'group.commands not array: ' + g.id);
  }
});

// --- Test 3: every non-admin command appears in exactly one group ---
run('Test 3: every non-admin command appears in exactly one group', () => {
  const groups = JSON.parse(fs.readFileSync(GROUPS_PATH, 'utf8'));
  const deprecated = new Set(
    Object.keys(groups.deprecated_aliases || {}).filter((k) => !k.startsWith('_'))
  );

  // Build seen-count map.
  const seen = new Map();
  for (const g of groups.groups) {
    for (const c of g.commands) {
      seen.set(c, (seen.get(c) || 0) + 1);
    }
  }

  // Every command file (non-admin) must be in exactly one group OR deprecated.
  const files = fs.readdirSync(COMMANDS_DIR).filter((f) => f.endsWith('.md'));
  const errors = [];
  for (const f of files) {
    const name = f.replace(/\.md$/, '');
    const text = fs.readFileSync(path.join(COMMANDS_DIR, f), 'utf8');
    const fm = text.match(/^---\n([\s\S]*?)\n---/);
    let visibility = 'user';
    if (fm) {
      const vm = fm[1].match(/^visibility:\s*(\S+)/m);
      if (vm) visibility = vm[1];
    }
    if (visibility === 'admin') {
      // admin commands may be in Infrastructure group or absent; allowed either way.
      continue;
    }
    if (deprecated.has(name)) continue;
    const count = seen.get(name) || 0;
    if (count === 0) errors.push(name + ' (missing from all groups)');
    if (count > 1) errors.push(name + ' (appears in ' + count + ' groups)');
  }
  assert.deepEqual(errors, [], 'command-group violations: ' + errors.join(', '));
});

// --- Test 4: truecolor render emits ANSI ---
run('Test 4: renderHelp({capability: truecolor}) emits 24-bit ANSI', () => {
  assert.ok(fs.existsSync(RENDERER_PATH), 'scripts/help-renderer.cjs must exist');
  const { renderHelp } = require(RENDERER_PATH);
  const out = renderHelp({ capability: 'truecolor' });
  assert.ok(out.length > 100, 'output too short');
  // Look for 24-bit truecolor escape pattern: ESC[38;2;R;G;Bm
  assert.ok(/\x1b\[38;2;\d+;\d+;\d+m/.test(out), 'no 24-bit ANSI escape found');
});

// --- Test 5: ascii render has zero ANSI ---
run('Test 5: renderHelp({capability: ascii}) emits zero \\x1b escapes', () => {
  const { renderHelp } = require(RENDERER_PATH);
  const out = renderHelp({ capability: 'ascii' });
  assert.ok(out.length > 100, 'output too short');
  assert.ok(!/\x1b/.test(out), 'ASCII output contains \\x1b escape');
});

// --- Test 6: ASCII output renders all 11 group labels ---
run('Test 6: ASCII render contains all 11 group labels', () => {
  const { renderHelp, loadGroups } = require(RENDERER_PATH);
  const groups = loadGroups();
  const out = renderHelp({ capability: 'ascii', groups });
  for (const g of groups.groups) {
    assert.ok(
      out.includes(g.label),
      'ASCII output missing group label "' + g.label + '"'
    );
  }
});

console.log('');
console.log('passed=' + passed + ' failed=' + failed);
if (failed > 0) {
  console.error('Failed tests:');
  for (const t of failures) console.error('  - ' + t);
  process.exit(1);
}
process.exit(0);
