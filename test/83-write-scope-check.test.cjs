#!/usr/bin/env node
'use strict';

/**
 * Phase 83-06: Filesystem write interception (Tier 1.5) tests.
 *
 * Exercises scripts/write-scope-check end-to-end by building isolated
 * MindrianRooms fixtures, piping synthetic PreToolUse payloads on stdin,
 * and asserting exit codes and stderr content.
 *
 * Eight test cases, per plan 83-06 task 3 (case 8 added quick-260611-nob):
 *   1. Allow: write to the active room
 *   2. Block: write to a non-active room
 *   3. Block: write to a sealed room even when it is the active room
 *   4. Allow: write outside MindrianRooms root
 *   5. Allow: empty stdin
 *   6. Allow: unparseable stdin
 *   7. Allow: tool_input missing file_path
 *   8. Block: write to a rooms-root file with accurate root-file message
 *
 * Zero test frameworks. Node built-in assert only. CJS only.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'write-scope-check');
const FIXTURES_ROOT = path.join('/tmp', '83-test-fixtures');

fs.mkdirSync(FIXTURES_ROOT, { recursive: true });

function mkFixture(label) {
  const dir = path.join(
    FIXTURES_ROOT,
    'write-scope-check-' + label + '-' + crypto.randomUUID()
  );
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

function mkRoomsRoot(parent, opts) {
  const root = path.join(parent, 'MindrianRooms');
  fs.mkdirSync(root, { recursive: true });
  const rooms = (opts && opts.rooms) || [];
  for (const r of rooms) {
    const rdir = path.join(root, r.name);
    fs.mkdirSync(rdir, { recursive: true });
    if (r.sealed) {
      fs.writeFileSync(
        path.join(rdir, 'GUARDRAIL.md'),
        '# sealed for test\n'
      );
    }
  }
  if (opts && opts.registry) {
    fs.mkdirSync(path.join(root, '.rooms'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '.rooms', 'registry.json'),
      JSON.stringify(opts.registry, null, 2)
    );
  }
  return root;
}

function runHook(payload, roomsRoot, rawOverride) {
  const env = Object.assign({}, process.env);
  if (roomsRoot) {
    env.MINDRIAN_ROOMS_ROOT = roomsRoot;
  } else {
    delete env.MINDRIAN_ROOMS_ROOT;
  }
  let input;
  if (typeof rawOverride === 'string') {
    input = rawOverride;
  } else if (payload === undefined) {
    input = '';
  } else {
    input = JSON.stringify(payload);
  }
  const res = spawnSync('bash', [SCRIPT], {
    env: env,
    input: input,
    encoding: 'utf8',
    timeout: 5000
  });
  return {
    status: res.status,
    stdout: res.stdout || '',
    stderr: res.stderr || ''
  };
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// ---------------------------------------------------------------------------
// 1. Allow: write to the active room
// ---------------------------------------------------------------------------
test('allows write to the active room', () => {
  const fx = mkFixture('allow-active');
  try {
    const root = mkRoomsRoot(fx, {
      rooms: [{ name: 'alpha' }, { name: 'beta' }],
      registry: { active: 'alpha', rooms: {} }
    });
    const target = path.join(root, 'alpha', 'note.md');
    const res = runHook(
      { tool_name: 'Write', tool_input: { file_path: target } },
      root
    );
    assert.strictEqual(res.status, 0,
      'expected exit 0, got ' + res.status + ' stderr=' + res.stderr);
    assert.strictEqual(res.stderr, '', 'expected empty stderr');
  } finally {
    cleanup(fx);
  }
});

// ---------------------------------------------------------------------------
// 2. Block: write to a non-active room
// ---------------------------------------------------------------------------
test('blocks write to a non-active room', () => {
  const fx = mkFixture('block-cross');
  try {
    const root = mkRoomsRoot(fx, {
      rooms: [{ name: 'alpha' }, { name: 'beta' }],
      registry: { active: 'alpha', rooms: {} }
    });
    const target = path.join(root, 'beta', 'leak.md');
    const res = runHook(
      { tool_name: 'Write', tool_input: { file_path: target } },
      root
    );
    assert.notStrictEqual(res.status, 0,
      'expected non-zero exit, got ' + res.status);
    assert.ok(res.stderr.includes('Blocked:'),
      'stderr should contain "Blocked:", got: ' + res.stderr);
    assert.ok(res.stderr.includes('beta'),
      'stderr should name the target room');
    assert.ok(res.stderr.includes('alpha'),
      'stderr should name the active room');
    assert.ok(res.stderr.includes('/mos:rooms switch beta'),
      'stderr should include switch hint');
    assert.ok(!res.stderr.includes('sealed'),
      'cross-room message should not mention sealed');
  } finally {
    cleanup(fx);
  }
});

// ---------------------------------------------------------------------------
// 3. Block: write to a sealed room even when it is the active room
// ---------------------------------------------------------------------------
test('blocks write to a sealed room even when active matches', () => {
  const fx = mkFixture('block-sealed');
  try {
    const root = mkRoomsRoot(fx, {
      rooms: [{ name: 'vault', sealed: true }],
      registry: { active: 'vault', rooms: {} }
    });
    const target = path.join(root, 'vault', 'forbidden.md');
    const res = runHook(
      { tool_name: 'Write', tool_input: { file_path: target } },
      root
    );
    assert.notStrictEqual(res.status, 0,
      'expected non-zero exit, got ' + res.status);
    assert.ok(res.stderr.includes('sealed room vault'),
      'stderr should identify sealed room, got: ' + res.stderr);
    assert.ok(res.stderr.includes('GUARDRAIL.md'),
      'stderr should mention GUARDRAIL.md');
    assert.ok(res.stderr.includes('/mos:rooms switch vault'),
      'stderr should include switch hint');
  } finally {
    cleanup(fx);
  }
});

// ---------------------------------------------------------------------------
// 4. Allow: write outside MindrianRooms root
// ---------------------------------------------------------------------------
test('allows write outside MindrianRooms root', () => {
  const fx = mkFixture('allow-outside');
  try {
    const root = mkRoomsRoot(fx, {
      rooms: [{ name: 'alpha' }],
      registry: { active: 'alpha', rooms: {} }
    });
    // Target a path that is clearly outside root.
    const outside = path.join(fx, 'scratch', 'foo.txt');
    fs.mkdirSync(path.dirname(outside), { recursive: true });
    const res = runHook(
      { tool_name: 'Write', tool_input: { file_path: outside } },
      root
    );
    assert.strictEqual(res.status, 0,
      'expected exit 0, got ' + res.status + ' stderr=' + res.stderr);

    // Also verify /tmp/foo.txt path form.
    const res2 = runHook(
      { tool_name: 'Write', tool_input: { file_path: '/tmp/definitely-not-a-room-file.txt' } },
      root
    );
    assert.strictEqual(res2.status, 0,
      '/tmp path should be allowed, got ' + res2.status);
  } finally {
    cleanup(fx);
  }
});

// ---------------------------------------------------------------------------
// 5. Allow: empty stdin
// ---------------------------------------------------------------------------
test('allows on empty stdin', () => {
  const fx = mkFixture('allow-empty-stdin');
  try {
    const root = mkRoomsRoot(fx, {
      rooms: [{ name: 'alpha' }],
      registry: { active: 'alpha', rooms: {} }
    });
    const res = runHook(undefined, root, '');
    assert.strictEqual(res.status, 0,
      'empty stdin should allow, got ' + res.status);
  } finally {
    cleanup(fx);
  }
});

// ---------------------------------------------------------------------------
// 6. Allow: unparseable stdin
// ---------------------------------------------------------------------------
test('allows on unparseable stdin', () => {
  const fx = mkFixture('allow-bad-stdin');
  try {
    const root = mkRoomsRoot(fx, {
      rooms: [{ name: 'alpha' }],
      registry: { active: 'alpha', rooms: {} }
    });
    const res = runHook(undefined, root, '{not json at all');
    assert.strictEqual(res.status, 0,
      'bad JSON should allow, got ' + res.status + ' stderr=' + res.stderr);
  } finally {
    cleanup(fx);
  }
});

// ---------------------------------------------------------------------------
// 7. Allow: tool_input missing file_path
// ---------------------------------------------------------------------------
test('allows when tool_input has no file_path', () => {
  const fx = mkFixture('allow-no-filepath');
  try {
    const root = mkRoomsRoot(fx, {
      rooms: [{ name: 'alpha' }],
      registry: { active: 'alpha', rooms: {} }
    });
    const res = runHook(
      { tool_name: 'Write', tool_input: { content: 'hello' } },
      root
    );
    assert.strictEqual(res.status, 0,
      'missing file_path should allow, got ' + res.status);
  } finally {
    cleanup(fx);
  }
});

// ---------------------------------------------------------------------------
// 8. Block: write to a rooms-root file with accurate root-file message
// ---------------------------------------------------------------------------
test('blocks write to a rooms-root file with accurate root-file message', () => {
  const fx = mkFixture('block-root-file');
  try {
    const root = mkRoomsRoot(fx, {
      rooms: [{ name: 'alpha' }],
      registry: { active: 'alpha', rooms: {} }
    });
    const target = path.join(root, 'INDEX.md');
    fs.writeFileSync(target, '# rooms index\n');
    const res = runHook(
      { tool_name: 'Edit', tool_input: { file_path: target } },
      root
    );
    assert.strictEqual(res.status, 2,
      'expected exit 2, got ' + res.status + ' stderr=' + res.stderr);
    assert.ok(/root file/i.test(res.stderr),
      'stderr should name the target a root file, got: ' + res.stderr);
    assert.ok(!res.stderr.includes('switch INDEX.md'),
      'stderr must not suggest switching to a filename, got: ' + res.stderr);
  } finally {
    cleanup(fx);
  }
});

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
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
  '\n83-write-scope-check: ' + (total - failed) + '/' + total + ' passed\n'
);
process.exit(failed === 0 ? 0 : 1);
