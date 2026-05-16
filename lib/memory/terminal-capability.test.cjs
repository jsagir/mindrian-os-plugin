#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121.5-07 Task 1 -- Terminal capability probe + help_jtbd frontmatter
 * sweep acceptance tests.
 *
 * Asserts:
 *   - lib/core/terminal-capability.cjs exists with probeCapability() dispatch
 *     covering 6 paths (truecolor, 256color via COLORTERM, 256color via TERM,
 *     ascii via non-TTY, ascii via no-COLORTERM-no-TERM, ascii via Desktop).
 *   - Every commands/<name>.md declares help_jtbd: frontmatter.
 *   - Every help_jtbd: value is a quoted string >= 8 and <= 120 chars.
 *
 * Canon references:
 *   Part 3 UI Ruling System -- bulletproof terminal coherence depends on a
 *           single capability probe shared across surfaces.
 *   Part 7 Reuse Before Build -- terminal-capability.cjs consolidates an
 *           inline check that would otherwise live in N command renderers;
 *           reusable across /mos:status, /mos:doctor, /mos:splash, etc.
 *   Part 8 Graph Boundary -- probe reads env-vars + isTTY only; zero
 *           network, zero Brain, zero telemetry egress.
 *
 * Test map (8 cases, one-to-one with PLAN Task 1 <behavior>):
 *
 *   1. probeCapability({isTTY:true, env:{COLORTERM:'truecolor'}}) -> 'truecolor'
 *   2. probeCapability({isTTY:true, env:{COLORTERM:'256color'}})  -> '256color'
 *   3. probeCapability({isTTY:true, env:{TERM:'xterm-256color'}}) -> '256color'
 *   4. probeCapability({isTTY:false})                              -> 'ascii'
 *   5. probeCapability({isTTY:true, env:{}})                       -> 'ascii'
 *   6. probeCapability({isTTY:true, env:{CLAUDE_DESKTOP:'1'}})     -> 'ascii'
 *   7. Every commands/*.md declares help_jtbd: frontmatter.
 *   8. Every help_jtbd: value is quoted, 8..120 chars, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..');
const PROBE_PATH = path.join(REPO, 'lib', 'core', 'terminal-capability.cjs');
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

// --- Test 1: truecolor dispatch via COLORTERM ---
run('Test 1: COLORTERM=truecolor + isTTY=true returns truecolor', () => {
  assert.ok(fs.existsSync(PROBE_PATH), 'lib/core/terminal-capability.cjs must exist');
  const { probeCapability } = require(PROBE_PATH);
  const result = probeCapability({ isTTY: true, env: { COLORTERM: 'truecolor' } });
  assert.equal(result, 'truecolor');
});

// --- Test 2: 256color via COLORTERM ---
run('Test 2: COLORTERM=256color + isTTY=true returns 256color', () => {
  const { probeCapability } = require(PROBE_PATH);
  const result = probeCapability({ isTTY: true, env: { COLORTERM: '256color' } });
  assert.equal(result, '256color');
});

// --- Test 3: 256color via TERM fallback ---
run('Test 3: TERM=xterm-256color + isTTY=true (COLORTERM unset) returns 256color', () => {
  const { probeCapability } = require(PROBE_PATH);
  const result = probeCapability({ isTTY: true, env: { TERM: 'xterm-256color' } });
  assert.equal(result, '256color');
});

// --- Test 4: non-TTY -> ascii ---
run('Test 4: isTTY=false returns ascii (piped/non-TTY)', () => {
  const { probeCapability } = require(PROBE_PATH);
  const result = probeCapability({ isTTY: false, env: { COLORTERM: 'truecolor' } });
  assert.equal(result, 'ascii');
});

// --- Test 5: isTTY=true with neither COLORTERM nor TERM -> ascii ---
run('Test 5: isTTY=true with empty env returns ascii', () => {
  const { probeCapability } = require(PROBE_PATH);
  const result = probeCapability({ isTTY: true, env: {} });
  assert.equal(result, 'ascii');
});

// --- Test 6: Desktop hard-override ---
run('Test 6: CLAUDE_DESKTOP=1 returns ascii (Desktop simulator)', () => {
  const { probeCapability } = require(PROBE_PATH);
  const result = probeCapability({
    isTTY: true,
    env: { CLAUDE_DESKTOP: '1', COLORTERM: 'truecolor' },
  });
  assert.equal(result, 'ascii');
});

// --- Test 7: every command has help_jtbd: ---
run('Test 7: every commands/*.md declares help_jtbd frontmatter', () => {
  const files = fs.readdirSync(COMMANDS_DIR).filter((f) => f.endsWith('.md'));
  assert.ok(files.length >= 80, 'expected >= 80 command files, found ' + files.length);
  const missing = [];
  for (const f of files) {
    const text = fs.readFileSync(path.join(COMMANDS_DIR, f), 'utf8');
    const fm = text.match(/^---\n([\s\S]*?)\n---/);
    if (!fm || !/^help_jtbd:/m.test(fm[1])) {
      missing.push(f);
    }
  }
  assert.deepEqual(missing, [], 'commands missing help_jtbd: ' + missing.join(', '));
});

// --- Test 8: help_jtbd value contract (quoted, 8..120 chars, no em-dash) ---
run('Test 8: every help_jtbd value is quoted, 8..120 chars, no em-dashes', () => {
  const files = fs.readdirSync(COMMANDS_DIR).filter((f) => f.endsWith('.md'));
  const violations = [];
  for (const f of files) {
    const text = fs.readFileSync(path.join(COMMANDS_DIR, f), 'utf8');
    const fm = text.match(/^---\n([\s\S]*?)\n---/);
    if (!fm) continue;
    const line = fm[1].split('\n').find((l) => /^help_jtbd:/.test(l));
    if (!line) continue;
    // Must be quoted with double-quotes
    const m = line.match(/^help_jtbd:\s*"([^"]*)"\s*$/);
    if (!m) {
      violations.push(f + ': not double-quoted -> ' + line);
      continue;
    }
    const val = m[1];
    if (val.length < 8) violations.push(f + ': too short (' + val.length + ' chars)');
    if (val.length > 120) violations.push(f + ': too long (' + val.length + ' chars)');
    if (/—/.test(val)) violations.push(f + ': contains em-dash');
  }
  assert.deepEqual(violations, [], 'help_jtbd violations: ' + violations.join('\n  '));
});

console.log('');
console.log('passed=' + passed + ' failed=' + failed);
if (failed > 0) {
  console.error('Failed tests:');
  for (const t of failures) console.error('  - ' + t);
  process.exit(1);
}
process.exit(0);
