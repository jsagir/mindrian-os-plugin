#!/usr/bin/env node
'use strict';

/**
 * Phase 83-07: Mid-session intent classifier (Tier 2) tests.
 *
 * Exercises scripts/intent-classifier end-to-end. Each test builds an
 * isolated MindrianRooms fixture under /tmp/83-test-fixtures, points the
 * classifier at it via MINDRIAN_ROOMS_ROOT, pipes a synthetic payload on
 * stdin, and asserts stdout (warning emission) and exit code (always 0;
 * classifier is advisory, never blocks).
 *
 * Seven test cases per plan 83-07 task 6:
 *   1. No mismatch: message matches active room only
 *   2. Clear mismatch: message contains exact non-active room name
 *   3. Multi-token mismatch: 3 entity names from non-active, 0 from active
 *   4. Sealed room mismatch: message matches a sealed room name, warning
 *      includes sealed note, still exit 0
 *   5. Empty message: silent exit 0
 *   6. Empty registry and no sealed rooms: silent exit 0
 *   7. Budget smoke: fixture with many rooms, clean exit (no timing assert)
 *
 * Zero test frameworks. Node built-in assert only. CJS only.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'intent-classifier');
const FIXTURES_ROOT = path.join('/tmp', '83-test-fixtures');

fs.mkdirSync(FIXTURES_ROOT, { recursive: true });

function mkFixture(label) {
  const dir = path.join(
    FIXTURES_ROOT,
    'intent-classifier-' + label + '-' + crypto.randomUUID()
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
      fs.writeFileSync(path.join(rdir, 'GUARDRAIL.md'), '# sealed\n');
    }
    if (r.state) {
      fs.writeFileSync(path.join(rdir, 'STATE.md'), r.state);
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

function runHook(payload, roomsRoot) {
  const env = Object.assign({}, process.env);
  if (roomsRoot) env.MINDRIAN_ROOMS_ROOT = roomsRoot;
  else delete env.MINDRIAN_ROOMS_ROOT;
  const input = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const res = spawnSync(SCRIPT, [], {
    input: input,
    env: env,
    encoding: 'utf8',
  });
  return {
    status: res.status,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
  };
}

function stateMd(project, body) {
  return (
    '---\n' +
    'project: ' + project + '\n' +
    '---\n' +
    (body || '')
  );
}

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write('  ok  ' + name + '\n');
  } catch (e) {
    failed += 1;
    process.stdout.write('  FAIL ' + name + '\n');
    process.stdout.write('       ' + (e && e.message ? e.message : e) + '\n');
  }
}

// ---------------------------------------------------------------------------
// 1. No mismatch: message matches active room only.
// ---------------------------------------------------------------------------
test('no mismatch when message matches active room', () => {
  const fixture = mkFixture('no-mismatch');
  try {
    const root = mkRoomsRoot(fixture, {
      registry: { active: 'mindrian-os-plugin', rooms: ['mindrian-os-plugin', 'village-of-life'] },
      rooms: [
        {
          name: 'mindrian-os-plugin',
          state: stateMd('MindrianOS Plugin', 'Working on Claude Code Plugin release.\n'),
        },
        {
          name: 'village-of-life',
          state: stateMd('Village of Life', 'Jewish nonprofit donor outreach.\n'),
        },
      ],
    });
    const res = runHook(
      { user_message: 'Let us continue the mindrian plugin work on release pipeline.' },
      root
    );
    assert.strictEqual(res.status, 0, 'exit should be 0');
    // Phase 91-02: Phase 91 Navigation Engine fires per UserPromptSubmit.
    // The Phase 83 Intent Mismatch warning still must NOT appear on a
    // matching message. The engine block CAN appear (it does on every
    // turn in 91-02+) and it does NOT count as a "warning" for Phase 83
    // purposes. Assert specifically that no Phase 83 mismatch warning
    // is emitted, while tolerating the engine block.
    assert.equal(
      res.stdout.indexOf('Intent mismatch detected'), -1,
      'no Phase 83 mismatch warning should be emitted; got stdout=' + res.stdout
    );
  } finally {
    cleanup(fixture);
  }
});

// ---------------------------------------------------------------------------
// 2. Clear mismatch: exact non-active room name in the message.
// ---------------------------------------------------------------------------
test('clear mismatch on exact non-active room name', () => {
  const fixture = mkFixture('clear-mismatch');
  try {
    const root = mkRoomsRoot(fixture, {
      registry: { active: 'mindrian-os-plugin', rooms: ['mindrian-os-plugin', 'village-of-life'] },
      rooms: [
        {
          name: 'mindrian-os-plugin',
          state: stateMd('MindrianOS Plugin', 'Claude Code plugin.\n'),
        },
        {
          name: 'village-of-life',
          state: stateMd('Village of Life', 'Donor pipeline.\n'),
        },
      ],
    });
    const res = runHook(
      { user_message: 'Draft a donor email for village of life program.' },
      root
    );
    assert.strictEqual(res.status, 0, 'exit should be 0 (advisory, never blocks)');
    assert.ok(res.stdout.length > 0, 'warning expected, got empty stdout');
    assert.ok(
      res.stdout.indexOf('village-of-life') !== -1,
      'warning should name the non-active room'
    );
    assert.ok(
      res.stdout.indexOf('mindrian-os-plugin') !== -1,
      'warning should name the active room'
    );
    assert.ok(
      res.stdout.indexOf('Intent mismatch detected') !== -1,
      'warning should begin with intent mismatch header'
    );
  } finally {
    cleanup(fixture);
  }
});

// ---------------------------------------------------------------------------
// 3. Multi-token mismatch: 3 entity names from non-active, 0 from active.
// ---------------------------------------------------------------------------
test('multi-token entity mismatch triggers warning', () => {
  const fixture = mkFixture('multi-token');
  try {
    const root = mkRoomsRoot(fixture, {
      registry: { active: 'alpha', rooms: ['alpha', 'beta'] },
      rooms: [
        {
          name: 'alpha',
          state: stateMd('Alpha Project', 'Quantum Computing research notes.\n'),
        },
        {
          name: 'beta',
          state: stateMd('Beta Project',
            'Lawrence Summers is the principal advisor. ' +
            'Glenn Yago runs the Financial Innovations Lab. ' +
            'Michael Milken chairs the institute.\n'
          ),
        },
      ],
    });
    // Message contains: lawrence, summers, glenn, yago, michael, milken
    // zero tokens from alpha fingerprint (quantum/computing) or name alpha.
    const res = runHook(
      { user_message: 'Please file notes from Lawrence Summers meeting with Glenn Yago and Michael Milken.' },
      root
    );
    assert.strictEqual(res.status, 0);
    assert.ok(res.stdout.length > 0, 'warning expected for multi-entity mismatch');
    assert.ok(res.stdout.indexOf('beta') !== -1, 'should name beta room');
  } finally {
    cleanup(fixture);
  }
});

// ---------------------------------------------------------------------------
// 4. Sealed room mismatch: warning + sealed note, not a block.
// ---------------------------------------------------------------------------
test('sealed room mismatch warns with sealed note, does not block', () => {
  const fixture = mkFixture('sealed');
  try {
    const root = mkRoomsRoot(fixture, {
      registry: { active: 'working-room', rooms: ['working-room'] },
      rooms: [
        {
          name: 'working-room',
          state: stateMd('Working Room', 'Current active scope.\n'),
        },
        {
          name: 'milken-twin',
          sealed: true,
          state: stateMd('Milken Twin', 'Glenn Yago financial innovations labs.\n'),
        },
      ],
    });
    const res = runHook(
      { user_message: 'Add a slide about milken-twin for the deck.' },
      root
    );
    assert.strictEqual(res.status, 0, 'never blocks, even for sealed rooms');
    assert.ok(res.stdout.length > 0, 'warning expected');
    assert.ok(res.stdout.indexOf('milken-twin') !== -1, 'should name sealed room');
    assert.ok(res.stdout.indexOf('sealed room') !== -1, 'should include sealed note');
  } finally {
    cleanup(fixture);
  }
});

// ---------------------------------------------------------------------------
// 5. Empty message: silent exit 0.
// ---------------------------------------------------------------------------
test('empty message exits silently', () => {
  const fixture = mkFixture('empty-msg');
  try {
    const root = mkRoomsRoot(fixture, {
      registry: { active: 'alpha', rooms: ['alpha'] },
      rooms: [{ name: 'alpha', state: stateMd('Alpha', 'body\n') }],
    });
    const res = runHook({ user_message: '' }, root);
    assert.strictEqual(res.status, 0);
    assert.strictEqual(res.stdout, '');
  } finally {
    cleanup(fixture);
  }
});

// ---------------------------------------------------------------------------
// 6. Empty registry and no sealed rooms: silent exit 0.
// ---------------------------------------------------------------------------
test('empty registry with no sealed rooms exits silently', () => {
  const fixture = mkFixture('empty-registry');
  try {
    const root = mkRoomsRoot(fixture, {
      registry: { active: null, rooms: [] },
      rooms: [],
    });
    const res = runHook(
      { user_message: 'Anything at all about village of life donors.' },
      root
    );
    assert.strictEqual(res.status, 0);
    assert.strictEqual(res.stdout, '');
  } finally {
    cleanup(fixture);
  }
});

// ---------------------------------------------------------------------------
// 7. Budget smoke: many rooms, clean exit (classifier does not crash or hang).
// ---------------------------------------------------------------------------
test('budget smoke with many rooms exits cleanly', () => {
  const fixture = mkFixture('budget');
  try {
    const rooms = [];
    for (let i = 0; i < 40; i += 1) {
      rooms.push({
        name: 'room-' + i,
        state: stateMd('Room ' + i, 'Project Alpha Beta Gamma line.\nEntity One Two Three.\n'),
      });
    }
    const root = mkRoomsRoot(fixture, {
      registry: { active: 'room-0', rooms: rooms.map((r) => r.name) },
      rooms: rooms,
    });
    const res = runHook({ user_message: 'Quick status update.' }, root);
    assert.strictEqual(res.status, 0);
    // Not asserting warning content: this is a smoke test for clean exit.
  } finally {
    cleanup(fixture);
  }
});

process.stdout.write(
  '\n83-intent-classifier: ' + passed + '/' + (passed + failed) + ' passed\n'
);
process.exit(failed === 0 ? 0 : 1);
