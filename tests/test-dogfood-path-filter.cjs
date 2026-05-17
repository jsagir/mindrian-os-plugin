'use strict';
// Phase 260517-dcw Task 1: path-filter unit tests + queue-append hook smoke test.
// 10 path classifications + bash-hook integration (synthetic stdin, temp queue, <50ms budget).
//
// Canon Part 6 (Product-as-Venture): the dog-food bridge captures every Edit/Write/MultiEdit
//   on the plugin repo so the plugin's own venture room reflects its own development activity.
// Canon Part 8 (Graph Boundary): zero Brain egress; LOCAL-only filter; LOCAL queue file.
//
// Mirrors the shape of tests/test-feynman-timeline-empty-state.cjs (small, no node:sqlite
//   dependency for the pure-function tests; child_process.spawnSync for the bash smoke test).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const filter = require(path.join(PLUGIN_ROOT, 'scripts', 'dogfood-bridge', 'path-filter.cjs'));
const HOOK_SCRIPT = path.join(PLUGIN_ROOT, 'scripts', 'dogfood-bridge', 'append-to-queue.sh');

// ---------- 10 path classifications (per <behavior> in 260517-dcw-PLAN.md) ----------

function testPathFilterClassifications() {
  // Allowed paths (5):
  assert.equal(filter.matchesDogfoodFilter('/home/jsagi/MindrianOS-Plugin/scripts/release.sh'), true,
    'scripts/release.sh should be allowed');
  assert.equal(filter.matchesDogfoodFilter('/home/jsagi/MindrianOS-Plugin/lib/core/navigation.cjs'), true,
    'lib/core/navigation.cjs should be allowed');
  assert.equal(filter.matchesDogfoodFilter('/home/jsagi/MindrianOS-Plugin/commands/dogfood-flush.md'), true,
    'commands/dogfood-flush.md should be allowed');
  assert.equal(filter.matchesDogfoodFilter('/home/jsagi/MindrianOS-Plugin/CHANGELOG.md'), true,
    'CHANGELOG.md should be allowed (exact-file allowlist)');
  assert.equal(filter.matchesDogfoodFilter('/home/jsagi/MindrianOS-Plugin/.claude-plugin/plugin.json'), true,
    '.claude-plugin/plugin.json should be allowed (exact-file allowlist)');

  // Ignored paths (5):
  assert.equal(filter.matchesDogfoodFilter('/home/jsagi/MindrianOS-Plugin/.planning/quick/260517-dcw/foo.md'), false,
    '.planning/quick/** should be ignored');
  assert.equal(filter.matchesDogfoodFilter('/home/jsagi/MindrianOS-Plugin/node_modules/foo/index.js'), false,
    'node_modules/** should be ignored');
  assert.equal(filter.matchesDogfoodFilter('/home/jsagi/MindrianOS-Plugin/.git/HEAD'), false,
    '.git/** should be ignored');
  assert.equal(filter.matchesDogfoodFilter('/home/jsagi/some-other-repo/foo.md'), false,
    'paths outside PLUGIN_ROOT should be ignored');
  assert.equal(filter.matchesDogfoodFilter('/home/jsagi/MindrianOS-Plugin/tmp/scratch.md'), false,
    'tmp/** should be ignored (not in allowlist tree)');
}

// ---------- Edge cases ----------

function testEdgeCases() {
  assert.equal(filter.matchesDogfoodFilter(''), false, 'empty string returns false');
  assert.equal(filter.matchesDogfoodFilter(null), false, 'null returns false');
  assert.equal(filter.matchesDogfoodFilter(undefined), false, 'undefined returns false');
  assert.equal(filter.matchesDogfoodFilter(42), false, 'non-string returns false');
  // Phase CONTEXT.md regex
  assert.equal(filter.matchesDogfoodFilter('/home/jsagi/MindrianOS-Plugin/.planning/phases/124-feynman-temporal-awareness/124-CONTEXT.md'), true,
    'phase CONTEXT.md should be allowed via regex');
}

// ---------- Hook script: bash -n syntax check (no execution) ----------

function testHookScriptSyntax() {
  const r = cp.spawnSync('bash', ['-n', HOOK_SCRIPT], { encoding: 'utf8' });
  assert.equal(r.status, 0, 'append-to-queue.sh must pass bash -n: stderr=' + (r.stderr || ''));
}

// ---------- Hook script: executable bit ----------

function testHookScriptExecutable() {
  const st = fs.statSync(HOOK_SCRIPT);
  // owner executable bit
  assert.ok((st.mode & 0o100) !== 0, 'append-to-queue.sh must be executable (owner +x)');
}

// ---------- Hook script: appends one row for allowed path + <50ms wall-clock ----------

function testHookAppendsForAllowedPath() {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dogfood-hook-'));
  try {
    const payload = JSON.stringify({
      tool_name: 'Edit',
      tool_input: { file_path: '/home/jsagi/MindrianOS-Plugin/lib/foo.cjs' },
    });
    const start = process.hrtime.bigint();
    const r = cp.spawnSync('bash', [HOOK_SCRIPT], {
      input: payload,
      encoding: 'utf8',
      env: Object.assign({}, process.env, { HOME: tmpHome }),
    });
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    assert.equal(r.status, 0, 'hook exit 0 even on success path');
    const queueFile = path.join(tmpHome, '.mindrian', 'dogfood-queue.jsonl');
    assert.ok(fs.existsSync(queueFile), 'queue file must be created');
    const lines = fs.readFileSync(queueFile, 'utf8').split('\n').filter((l) => l.length > 0);
    assert.equal(lines.length, 1, 'exactly one row appended; got ' + lines.length);
    const row = JSON.parse(lines[0]);
    assert.equal(row.path, '/home/jsagi/MindrianOS-Plugin/lib/foo.cjs', 'row carries the file_path');
    assert.equal(row.tool, 'Edit', 'row carries the tool name');
    assert.ok(typeof row.ts === 'string' && row.ts.length > 0, 'row carries ISO timestamp');
    // <50ms (10x the 5ms target for CI noise tolerance)
    assert.ok(elapsedMs < 50,
      'hook wall-clock must be < 50ms; measured ' + elapsedMs.toFixed(2) + 'ms');
  } finally {
    try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_) {}
  }
}

// ---------- Hook script: ignored path appends zero rows ----------

function testHookIgnoresFilteredPath() {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dogfood-hook-'));
  try {
    const payload = JSON.stringify({
      tool_name: 'Edit',
      tool_input: { file_path: '/home/jsagi/MindrianOS-Plugin/.planning/quick/260517-dcw/foo.md' },
    });
    const r = cp.spawnSync('bash', [HOOK_SCRIPT], {
      input: payload,
      encoding: 'utf8',
      env: Object.assign({}, process.env, { HOME: tmpHome }),
    });
    assert.equal(r.status, 0, 'hook exit 0 on ignore path');
    const queueFile = path.join(tmpHome, '.mindrian', 'dogfood-queue.jsonl');
    // Queue file may not exist OR may be zero bytes; both are valid "no append" outcomes.
    if (fs.existsSync(queueFile)) {
      const content = fs.readFileSync(queueFile, 'utf8');
      assert.equal(content.length, 0, 'ignored path must NOT append; got ' + content.length + ' bytes');
    }
  } finally {
    try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_) {}
  }
}

// ---------- Hook script: empty stdin exits 0 silently ----------

function testHookEmptyStdin() {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dogfood-hook-'));
  try {
    const r = cp.spawnSync('bash', [HOOK_SCRIPT], {
      input: '',
      encoding: 'utf8',
      env: Object.assign({}, process.env, { HOME: tmpHome }),
    });
    assert.equal(r.status, 0, 'hook exit 0 on empty stdin');
    const queueFile = path.join(tmpHome, '.mindrian', 'dogfood-queue.jsonl');
    if (fs.existsSync(queueFile)) {
      const content = fs.readFileSync(queueFile, 'utf8');
      assert.equal(content.length, 0, 'empty stdin must NOT append');
    }
  } finally {
    try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_) {}
  }
}

// ---------- Hook script: malformed JSON exits 0 silently ----------

function testHookMalformedJson() {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dogfood-hook-'));
  try {
    const r = cp.spawnSync('bash', [HOOK_SCRIPT], {
      input: 'this is not json {{ broken',
      encoding: 'utf8',
      env: Object.assign({}, process.env, { HOME: tmpHome }),
    });
    assert.equal(r.status, 0, 'hook exit 0 on malformed JSON');
  } finally {
    try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_) {}
  }
}

// ---------- Run ----------

const tests = [
  ['path-filter classifications (10)', testPathFilterClassifications],
  ['path-filter edge cases', testEdgeCases],
  ['hook script bash -n syntax', testHookScriptSyntax],
  ['hook script is executable', testHookScriptExecutable],
  ['hook appends one row for allowed path (<50ms)', testHookAppendsForAllowedPath],
  ['hook ignores filtered path (zero rows)', testHookIgnoresFilteredPath],
  ['hook empty stdin exits 0 silently', testHookEmptyStdin],
  ['hook malformed JSON exits 0 silently', testHookMalformedJson],
];

let pass = 0;
let fail = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    process.stdout.write('PASS ' + name + '\n');
    pass += 1;
  } catch (e) {
    process.stdout.write('FAIL ' + name + ': ' + (e && e.message ? e.message : e) + '\n');
    fail += 1;
  }
}
process.stdout.write('\nTotal: ' + (pass + fail) + ' PASS=' + pass + ' FAIL=' + fail + '\n');
process.exit(fail > 0 ? 1 : 0);
