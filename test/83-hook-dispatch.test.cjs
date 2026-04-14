#!/usr/bin/env node
'use strict';

/**
 * Phase 83-05: hook dispatch scaffold smoke tests.
 *
 * Validates that run-hook.cmd dispatches the two new sibling scripts
 * (write-scope-check, intent-classifier) and that hooks/hooks.json
 * registers PreToolUse(Write|Edit|MultiEdit) and UserPromptSubmit entries.
 *
 * Real logic for these hooks ships in plans 83-06 and 83-07. This plan
 * only exercises the plumbing.
 *
 * Zero test frameworks. Node built-in assert only. CJS only.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const RUN_HOOK = path.join(REPO_ROOT, 'hooks', 'run-hook.cmd');
const HOOKS_JSON = path.join(REPO_ROOT, 'hooks', 'hooks.json');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('run-hook.cmd dispatches write-scope-check with exit 0', () => {
  const res = spawnSync('bash', [RUN_HOOK, 'write-scope-check'], {
    stdio: 'pipe',
  });
  assert.strictEqual(res.status, 0,
    'write-scope-check dispatch should exit 0, got ' + res.status +
    ' stderr=' + (res.stderr && res.stderr.toString()));
});

test('run-hook.cmd dispatches intent-classifier with exit 0', () => {
  const res = spawnSync('bash', [RUN_HOOK, 'intent-classifier'], {
    stdio: 'pipe',
  });
  assert.strictEqual(res.status, 0,
    'intent-classifier dispatch should exit 0, got ' + res.status +
    ' stderr=' + (res.stderr && res.stderr.toString()));
});

test('hooks/hooks.json parses as valid JSON', () => {
  const raw = fs.readFileSync(HOOKS_JSON, 'utf8');
  const parsed = JSON.parse(raw);
  assert.ok(parsed && typeof parsed === 'object', 'parsed object exists');
  assert.ok(parsed.hooks && typeof parsed.hooks === 'object',
    'top-level hooks key exists');
});

test('hooks.json has PreToolUse entry with Write|Edit|MultiEdit matcher', () => {
  const parsed = JSON.parse(fs.readFileSync(HOOKS_JSON, 'utf8'));
  const pre = parsed.hooks.PreToolUse;
  assert.ok(Array.isArray(pre) && pre.length > 0,
    'PreToolUse array is present and non-empty');
  const entry = pre.find(e => e.matcher === 'Write|Edit|MultiEdit');
  assert.ok(entry, 'PreToolUse entry with matcher Write|Edit|MultiEdit exists');
  assert.ok(Array.isArray(entry.hooks) && entry.hooks.length > 0,
    'PreToolUse entry has hooks array');
  const cmd = entry.hooks[0];
  assert.strictEqual(cmd.type, 'command');
  assert.ok(cmd.command.includes('write-scope-check'),
    'command invokes write-scope-check');
  assert.strictEqual(cmd.timeout, 2000, 'timeout is 2000ms');
});

test('hooks.json has UserPromptSubmit entry calling intent-classifier', () => {
  const parsed = JSON.parse(fs.readFileSync(HOOKS_JSON, 'utf8'));
  const ups = parsed.hooks.UserPromptSubmit;
  assert.ok(Array.isArray(ups) && ups.length > 0,
    'UserPromptSubmit array is present and non-empty');
  const entry = ups[0];
  assert.ok(Array.isArray(entry.hooks) && entry.hooks.length > 0,
    'UserPromptSubmit entry has hooks array');
  const cmd = entry.hooks[0];
  assert.strictEqual(cmd.type, 'command');
  assert.ok(cmd.command.includes('intent-classifier'),
    'command invokes intent-classifier');
  assert.strictEqual(cmd.timeout, 2000, 'timeout is 2000ms');
});

test('scripts/write-scope-check and scripts/intent-classifier are executable', () => {
  const a = path.join(REPO_ROOT, 'scripts', 'write-scope-check');
  const b = path.join(REPO_ROOT, 'scripts', 'intent-classifier');
  assert.ok(fs.existsSync(a), 'write-scope-check exists');
  assert.ok(fs.existsSync(b), 'intent-classifier exists');
  const sa = fs.statSync(a);
  const sb = fs.statSync(b);
  assert.ok((sa.mode & 0o111) !== 0, 'write-scope-check is executable');
  assert.ok((sb.mode & 0o111) !== 0, 'intent-classifier is executable');
});

let failed = 0;
for (const t of tests) {
  try {
    t.fn();
    process.stdout.write('  ok ' + t.name + '\n');
  } catch (err) {
    failed += 1;
    process.stderr.write('  FAIL ' + t.name + '\n');
    process.stderr.write('    ' + (err && err.stack ? err.stack : err) + '\n');
  }
}

const total = tests.length;
process.stdout.write(
  '\n83-hook-dispatch: ' + (total - failed) + '/' + total + ' passed\n'
);
process.exit(failed === 0 ? 0 : 1);
