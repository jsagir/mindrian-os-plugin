#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.1-16 -- query efficiency telemetry acceptance tests.
 *
 * Verifies the pure token-estimator + aggregation-math contract of the module
 * at lib/core/token-estimator.cjs. This module is consumed by the PostToolUse
 * hook at scripts/query-efficiency-telemetry.cjs (measures tokens_used per
 * query) and the /mos:scout aggregator wrapper at
 * scripts/scout-telemetry-aggregator.cjs (renders the median-ratio summary).
 *
 * Canon references:
 *   Part 6 Product-as-Venture -- the 57x efficiency claim is a VENTURE claim.
 *     Measure it or retune the copy. No third option. This module is the
 *     measurement arm.
 *   Part 8 Graph Boundary -- the estimator + aggregator are LOCAL-by-
 *     construction: pure token math + room-tree walk. No network surface.
 *     The hook persists scalar integer counts (tokens_used /
 *     tokens_naive_estimate) to ~/.mindrian/telemetry/query-efficiency.jsonl,
 *     never user artifact bytes.
 *
 * Test map (12 cases, one-to-one with the PLAN <behavior> block for Task 1):
 *   1.  estimateTokens("hello") -> 2 (5 chars / 4 = 1.25 -> ceil -> 2)
 *   2.  estimateTokens("") -> 0
 *   3.  estimateTokens(null) -> 0 (graceful on null/undefined/non-string)
 *   4.  estimateRoomTokens on valid room returns positive integer
 *   5.  estimateRoomTokens cache: second call returns same value without
 *       re-walking the filesystem (verified by assertion on a sentinel file
 *       written BETWEEN the two calls -- cached value must ignore it)
 *   6.  estimateRoomTokens on invalid room returns null (graceful)
 *   7.  clearCache() resets the session cache
 *   8.  estimateRoomTokens skips non-.md files (only .md counted)
 *   9.  ratio computation sanity: 50000 / 1000 -> 50.0
 *  10.  event-shape validator: ensures emitted JSONL has exactly the
 *       8 required fields from the <interfaces> block
 *  11.  classifyRatio: 5.2 -> 'warn'; 42.0 -> 'normal'; 10.0 boundary -> 'normal'
 *  12.  aggregateEvents(10 events with known ratios) -> median/mean match
 *       hand-computed; top5 ranked descending by ratio; count = 10
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO = path.resolve(__dirname, '..', '..');
const ESTIMATOR_PATH = path.join(REPO, 'lib/core/token-estimator.cjs');

// Defensive reload so repeated invocations reload fresh.
try { delete require.cache[require.resolve(ESTIMATOR_PATH)]; } catch (_) {}
const estimator = require(ESTIMATOR_PATH);

assert.equal(typeof estimator.estimateTokens, 'function',
  'module must export estimateTokens()');
assert.equal(typeof estimator.estimateRoomTokens, 'function',
  'module must export estimateRoomTokens()');
assert.equal(typeof estimator.clearCache, 'function',
  'module must export clearCache()');
assert.equal(typeof estimator.aggregateEvents, 'function',
  'module must export aggregateEvents()');
assert.equal(typeof estimator.classifyRatio, 'function',
  'module must export classifyRatio()');
assert.equal(typeof estimator.validateEventShape, 'function',
  'module must export validateEventShape()');

// ---------- Fixture scaffolding ----------

function mkTmpDir(prefix) {
  const base = path.join(os.tmpdir(), 'mos-88-1-16-' + prefix + '-' + process.pid + '-' + Date.now().toString(36));
  fs.mkdirSync(base, { recursive: true });
  return base;
}

function rmRf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) {}
}

// ---------- Test 1: estimateTokens small string ----------

(function test1SmallString() {
  const result = estimator.estimateTokens('hello');
  assert.equal(result, 2,
    'estimateTokens("hello") must ceil(5/4) = 2, got ' + result);
  console.log('PASS test 1: estimateTokens("hello") -> 2');
})();

// ---------- Test 2: estimateTokens empty string ----------

(function test2EmptyString() {
  const result = estimator.estimateTokens('');
  assert.equal(result, 0,
    'estimateTokens("") must return 0, got ' + result);
  console.log('PASS test 2: estimateTokens("") -> 0');
})();

// ---------- Test 3: estimateTokens graceful on null / non-string ----------

(function test3GracefulNull() {
  assert.equal(estimator.estimateTokens(null), 0,
    'estimateTokens(null) must return 0');
  assert.equal(estimator.estimateTokens(undefined), 0,
    'estimateTokens(undefined) must return 0');
  assert.equal(estimator.estimateTokens(123), 0,
    'estimateTokens(non-string) must return 0');
  console.log('PASS test 3: estimateTokens graceful on null/undefined/non-string');
})();

// ---------- Test 4: estimateRoomTokens returns positive integer ----------

(function test4ValidRoom() {
  estimator.clearCache();
  const tmp = mkTmpDir('room-valid');
  try {
    fs.writeFileSync(path.join(tmp, 'ROOM.md'), '# Room\n'.repeat(100));
    fs.writeFileSync(path.join(tmp, 'notes.md'), 'x'.repeat(4000));
    const result = estimator.estimateRoomTokens(tmp);
    assert.equal(typeof result, 'number',
      'estimateRoomTokens must return a number on valid room');
    assert.ok(Number.isFinite(result) && Number.isInteger(result),
      'estimateRoomTokens must return finite integer, got ' + result);
    assert.ok(result > 0,
      'estimateRoomTokens on non-empty room must be > 0, got ' + result);
    // Sanity: ~ (700 + 4000) / 4 = ~1175 tokens. Allow envelope for overhead.
    assert.ok(result >= 1000 && result <= 1500,
      'estimateRoomTokens must approximate chars/4; got ' + result);
    console.log('PASS test 4: estimateRoomTokens valid room -> ' + result);
  } finally {
    rmRf(tmp);
    estimator.clearCache();
  }
})();

// ---------- Test 5: estimateRoomTokens caches per session ----------

(function test5Cache() {
  estimator.clearCache();
  const tmp = mkTmpDir('room-cache');
  try {
    fs.writeFileSync(path.join(tmp, 'a.md'), 'x'.repeat(2000));
    const first = estimator.estimateRoomTokens(tmp);
    // Write a LARGE new artifact after first call. If the second call re-
    // walks the fs, it will report a much larger number. If it uses the
    // cache, it must return the same value as `first`.
    fs.writeFileSync(path.join(tmp, 'b.md'), 'y'.repeat(100000));
    const second = estimator.estimateRoomTokens(tmp);
    assert.equal(second, first,
      'second estimateRoomTokens call must return cached value; ' +
      'got first=' + first + ' second=' + second);
    // Clear cache and confirm it now picks up the new artifact.
    estimator.clearCache();
    const third = estimator.estimateRoomTokens(tmp);
    assert.ok(third > first,
      'after clearCache, estimate must reflect new artifact: ' +
      'first=' + first + ' third=' + third);
    console.log('PASS test 5: estimateRoomTokens cache hit (first=' + first +
      ' second=' + second + ' after-clear=' + third + ')');
  } finally {
    rmRf(tmp);
    estimator.clearCache();
  }
})();

// ---------- Test 6: estimateRoomTokens invalid room -> null ----------

(function test6InvalidRoom() {
  estimator.clearCache();
  const nonexistent = path.join(os.tmpdir(), 'mos-88-1-16-DOES-NOT-EXIST-' + Date.now());
  const result = estimator.estimateRoomTokens(nonexistent);
  assert.equal(result, null,
    'estimateRoomTokens on nonexistent path must return null, got ' + result);
  assert.equal(estimator.estimateRoomTokens(null), null,
    'estimateRoomTokens(null) must return null');
  assert.equal(estimator.estimateRoomTokens(''), null,
    'estimateRoomTokens("") must return null');
  console.log('PASS test 6: estimateRoomTokens invalid room -> null');
})();

// ---------- Test 7: clearCache resets ----------

(function test7ClearCache() {
  estimator.clearCache();
  const tmp = mkTmpDir('room-clear');
  try {
    fs.writeFileSync(path.join(tmp, 'a.md'), 'x'.repeat(2000));
    const first = estimator.estimateRoomTokens(tmp);
    // Delete the room dir, clear cache, re-query. Without clearCache the
    // stale value would still be returned; after clearCache, null.
    rmRf(tmp);
    estimator.clearCache();
    const result = estimator.estimateRoomTokens(tmp);
    assert.equal(result, null,
      'after clearCache + rmdir, estimateRoomTokens must return null; got ' + result);
    assert.ok(first > 0, 'sanity: first call was > 0 (' + first + ')');
    console.log('PASS test 7: clearCache resets session cache');
  } finally {
    rmRf(tmp);
    estimator.clearCache();
  }
})();

// ---------- Test 8: estimateRoomTokens skips non-.md files ----------

(function test8SkipsBinary() {
  estimator.clearCache();
  const tmp = mkTmpDir('room-skip');
  try {
    // Only the .md file should count. Binary .bin + .png + non-.md .txt
    // must be ignored by the walker.
    fs.writeFileSync(path.join(tmp, 'a.md'), 'x'.repeat(4000));
    fs.writeFileSync(path.join(tmp, 'ignored.bin'), Buffer.alloc(100000));
    fs.writeFileSync(path.join(tmp, 'ignored.png'), Buffer.alloc(50000));
    fs.writeFileSync(path.join(tmp, 'ignored.txt'), 'z'.repeat(100000));
    const result = estimator.estimateRoomTokens(tmp);
    // Expect only the .md to contribute: 4000 chars / 4 = 1000 tokens.
    assert.ok(result >= 900 && result <= 1100,
      'estimateRoomTokens must count only .md; got ' + result + ' (expected ~1000)');
    console.log('PASS test 8: estimateRoomTokens skips non-.md files (got ' + result + ')');
  } finally {
    rmRf(tmp);
    estimator.clearCache();
  }
})();

// ---------- Test 9: ratio computation sanity ----------

(function test9RatioComputation() {
  const naive = 50000;
  const used = 1000;
  const ratio = naive / used;
  assert.equal(ratio, 50,
    'ratio 50000 / 1000 must equal 50');
  // The hook will compute this division directly. Sanity only.
  console.log('PASS test 9: ratio computation (50000 / 1000 = 50)');
})();

// ---------- Test 10: event shape validator ----------

(function test10EventShape() {
  const good = {
    event: 'query.served',
    ts: '2026-04-23T00:00:00Z',
    command: '/mos:whitespace',
    tool: 'Read',
    tokens_used: 100,
    tokens_naive_estimate: 5000,
    ratio: 50.0,
    room_slug: 'example-room',
  };
  const gResult = estimator.validateEventShape(good);
  assert.equal(gResult.valid, true,
    'fully-specified event must validate: ' + JSON.stringify(gResult));
  assert.deepEqual(gResult.missing, [],
    'good event must have no missing fields');

  // Missing one field -> invalid with that field listed in `missing`.
  const badOne = Object.assign({}, good);
  delete badOne.ratio;
  const bResult = estimator.validateEventShape(badOne);
  assert.equal(bResult.valid, false,
    'event missing ratio must fail validation');
  assert.ok(bResult.missing.indexOf('ratio') >= 0,
    'missing array must include "ratio", got ' + JSON.stringify(bResult.missing));

  // Empty object -> every field missing.
  const empty = estimator.validateEventShape({});
  assert.equal(empty.valid, false, '{} must fail validation');
  assert.equal(empty.missing.length, 8,
    'empty object must report all 8 fields missing, got ' + empty.missing.length);

  // Non-object -> invalid.
  const nullRes = estimator.validateEventShape(null);
  assert.equal(nullRes.valid, false, 'null must fail validation');

  console.log('PASS test 10: event shape validator (8 required fields)');
})();

// ---------- Test 11: classifyRatio below/at threshold ----------

(function test11ClassifyRatio() {
  assert.equal(estimator.classifyRatio(5.2), 'warn',
    'ratio 5.2 must classify as warn (< 10x)');
  assert.equal(estimator.classifyRatio(42.0), 'normal',
    'ratio 42.0 must classify as normal (>= 10x)');
  assert.equal(estimator.classifyRatio(10.0), 'normal',
    'ratio 10.0 at boundary must classify as normal (>= 10x)');
  assert.equal(estimator.classifyRatio(9.99), 'warn',
    'ratio 9.99 just below boundary must classify as warn');
  assert.equal(estimator.classifyRatio(0), 'warn',
    'ratio 0 must classify as warn');
  // Non-numeric -> warn (defensive: ratio was never computed correctly).
  assert.equal(estimator.classifyRatio(null), 'warn',
    'null ratio must classify as warn (defensive)');
  assert.equal(estimator.classifyRatio(NaN), 'warn',
    'NaN ratio must classify as warn (defensive)');
  console.log('PASS test 11: classifyRatio thresholds (10x)');
})();

// ---------- Test 12: aggregateEvents median + mean + top5 ----------

(function test12Aggregate() {
  const events = [
    { command: '/mos:whitespace', ratio: 60, tokens_used: 100, tokens_naive_estimate: 6000, tool: 'Read', ts: 't', event: 'query.served', room_slug: 'r' },
    { command: '/mos:whitespace', ratio: 55, tokens_used: 100, tokens_naive_estimate: 5500, tool: 'Read', ts: 't', event: 'query.served', room_slug: 'r' },
    { command: '/mos:status', ratio: 50, tokens_used: 100, tokens_naive_estimate: 5000, tool: 'Read', ts: 't', event: 'query.served', room_slug: 'r' },
    { command: '/mos:find-bottlenecks', ratio: 45, tokens_used: 100, tokens_naive_estimate: 4500, tool: 'Read', ts: 't', event: 'query.served', room_slug: 'r' },
    { command: '/mos:find-bottlenecks', ratio: 48, tokens_used: 100, tokens_naive_estimate: 4800, tool: 'Read', ts: 't', event: 'query.served', room_slug: 'r' },
    { command: '/mos:scout', ratio: 40, tokens_used: 100, tokens_naive_estimate: 4000, tool: 'Read', ts: 't', event: 'query.served', room_slug: 'r' },
    { command: '/mos:whitespace', ratio: 70, tokens_used: 100, tokens_naive_estimate: 7000, tool: 'Read', ts: 't', event: 'query.served', room_slug: 'r' },
    { command: '/mos:grade', ratio: 35, tokens_used: 100, tokens_naive_estimate: 3500, tool: 'Read', ts: 't', event: 'query.served', room_slug: 'r' },
    { command: '/mos:reason', ratio: 42, tokens_used: 100, tokens_naive_estimate: 4200, tool: 'Read', ts: 't', event: 'query.served', room_slug: 'r' },
    { command: '/mos:persona', ratio: 38, tokens_used: 100, tokens_naive_estimate: 3800, tool: 'Read', ts: 't', event: 'query.served', room_slug: 'r' },
  ];
  const agg = estimator.aggregateEvents(events);

  // count
  assert.equal(agg.count, 10, 'count must equal events.length, got ' + agg.count);

  // sorted ratios: [35, 38, 40, 42, 45, 48, 50, 55, 60, 70]
  // median (even) = (45 + 48) / 2 = 46.5
  assert.equal(agg.median, 46.5,
    'median must be 46.5 (even-length average), got ' + agg.median);

  // mean = (60+55+50+45+48+40+70+35+42+38) / 10 = 483 / 10 = 48.3
  assert.equal(agg.mean, 48.3,
    'mean must be 48.3, got ' + agg.mean);

  // top5 by ratio: whitespace has 3 entries -> use BEST ratio per command (by convention)
  // OR aggregate per command with averages. Either interpretation: whitespace tops.
  // PLAN says "top-5 commands by ratio" -- commands with their best/median ratio.
  // Our contract: per-command aggregate (max ratio), sort desc, slice 5.
  assert.ok(Array.isArray(agg.top5), 'top5 must be array');
  assert.equal(agg.top5.length, 5, 'top5 must have exactly 5 entries when >= 5 commands');

  // Top entry must be the highest-ratio command (whitespace best: 70).
  assert.equal(agg.top5[0].command, '/mos:whitespace',
    'top5[0] must be /mos:whitespace (max ratio 70), got ' + agg.top5[0].command);
  assert.equal(agg.top5[0].ratio, 70,
    'top5[0].ratio must be 70, got ' + agg.top5[0].ratio);

  // Ratios must be strictly non-increasing.
  for (let i = 1; i < agg.top5.length; i++) {
    assert.ok(agg.top5[i].ratio <= agg.top5[i - 1].ratio,
      'top5 must be sorted desc by ratio at index ' + i);
  }

  // Empty events -> zero count, null median, null mean, [] top5.
  const emptyAgg = estimator.aggregateEvents([]);
  assert.equal(emptyAgg.count, 0, 'empty events -> count 0');
  assert.equal(emptyAgg.median, null, 'empty events -> median null');
  assert.equal(emptyAgg.mean, null, 'empty events -> mean null');
  assert.deepEqual(emptyAgg.top5, [], 'empty events -> top5 []');

  // Odd-length median check (sorted: 10, 20, 30 -> median 20).
  const oddAgg = estimator.aggregateEvents([
    { command: '/a', ratio: 10, tokens_used: 1, tokens_naive_estimate: 10, tool: 'Read', ts: 't', event: 'query.served', room_slug: 'r' },
    { command: '/b', ratio: 30, tokens_used: 1, tokens_naive_estimate: 30, tool: 'Read', ts: 't', event: 'query.served', room_slug: 'r' },
    { command: '/c', ratio: 20, tokens_used: 1, tokens_naive_estimate: 20, tool: 'Read', ts: 't', event: 'query.served', room_slug: 'r' },
  ]);
  assert.equal(oddAgg.median, 20, 'odd-length median must pick middle value');

  console.log('PASS test 12: aggregateEvents (median=' + agg.median +
    ', mean=' + agg.mean + ', top5[0]=' + agg.top5[0].command + '@' + agg.top5[0].ratio + ')');
})();

// ============================================================================
// HARD-04 / D-01 -- hook all-turns gate relaxation (Phase 140-03)
// ============================================================================
//
// The 12 tests above exercise the pure token-estimator math. The block below
// exercises the PostToolUse HOOK ITSELF (scripts/query-efficiency-telemetry.cjs)
// end-to-end: it pipes a real Claude Code envelope on stdin, points HOME at a
// throwaway dir so the JSONL lands somewhere observable, and asserts on the
// written line.
//
// D-01 (RELAX THE GATE): the hook must measure ALL turns -- a Read/Grep/Glob
// in a resolvable room must write a JSONL line EVEN WHEN no /mos: command
// context is set. Before the source fix the hook exitSilent()s on the missing
// command and writes nothing; these tests are the RED proof, then the GREEN
// confirmation.
//
// Canon Part 8 (preserved through relaxation): the written line carries ONLY
// the eight scalar fields (event/ts/command/tool/tokens_used/
// tokens_naive_estimate/ratio/room_slug) and no new field; command may be
// null for an all-turns (no-/mos:-context) turn. No network surface.

const { spawnSync } = require('node:child_process');

const HOOK_PATH = path.join(REPO, 'scripts/query-efficiency-telemetry.cjs');

/**
 * Build a throwaway room (with the .room-root sentinel so resolveRoomRoot
 * finds it from cwd) and a throwaway HOME (so the JSONL is observable and
 * isolated from the real ~/.mindrian). Returns { roomDir, homeDir }.
 */
function mkHookFixture(prefix) {
  const roomDir = mkTmpDir(prefix + '-room');
  // .room-root sentinel makes findRoomRootFromCwd() resolve this dir.
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  // Some .md content so estimateRoomTokens returns a positive baseline.
  fs.writeFileSync(path.join(roomDir, 'ROOM.md'), '# Room\n'.repeat(200));
  fs.writeFileSync(path.join(roomDir, 'notes.md'), 'x'.repeat(8000));
  const homeDir = mkTmpDir(prefix + '-home');
  return { roomDir, homeDir };
}

function jsonlPath(homeDir) {
  return path.join(homeDir, '.mindrian', 'telemetry', 'query-efficiency.jsonl');
}

/**
 * Invoke the hook with the given envelope payload, running with cwd = roomDir
 * and HOME = homeDir, and (optionally) MOS_COMMAND_CONTEXT. Clears the two
 * env vars by default so the all-turns (no-/mos:-context) path is exercised.
 * Returns the spawnSync result.
 */
function runHook(payload, opts) {
  opts = opts || {};
  const env = Object.assign({}, process.env, {
    HOME: opts.homeDir,
    // Default: clear both /mos: signals so the all-turns path is tested.
    CLAUDE_SLASH_COMMAND: '',
    MOS_COMMAND_CONTEXT: '',
  });
  if (opts.mosContext) env.MOS_COMMAND_CONTEXT = opts.mosContext;
  return spawnSync('node', [HOOK_PATH], {
    input: JSON.stringify(payload),
    cwd: opts.roomDir,
    env,
    encoding: 'utf8',
    timeout: 15000,
  });
}

function readJsonlLines(homeDir) {
  const p = jsonlPath(homeDir);
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split('\n').filter(function (l) { return l.length > 0; });
}

// ---------- Test 13: all-turns -- JSONL written with NO /mos: context ----------

(function test13AllTurnsNoCommandContext() {
  const { roomDir, homeDir } = mkHookFixture('hook-allturns');
  try {
    const payload = {
      tool_name: 'Read',
      tool_input: { file_path: 'notes.md' },
      tool_response: { content: 'a'.repeat(400) },
      // NOTE: no slash_command / command_context field; env vars cleared.
    };
    const res = runHook(payload, { roomDir, homeDir });
    assert.equal(res.status, 0,
      'hook must exit 0 (advisory); stderr=' + (res.stderr || ''));
    const lines = readJsonlLines(homeDir);
    assert.equal(lines.length, 1,
      'HARD-04/D-01: a JSONL line MUST be written for a no-/mos:-context ' +
      'Read turn (all-turns gate). Got ' + lines.length + ' lines.');
    const ev = JSON.parse(lines[0]);
    assert.equal(ev.event, 'query.served', 'event field must be query.served');
    assert.equal(ev.tool, 'Read', 'tool field must be Read');
    // command is null/empty for the all-turns case -- this is the relaxation.
    assert.ok(ev.command === null || ev.command === '' || ev.command === undefined,
      'all-turns line must have a null/empty command (no /mos: context); got ' +
      JSON.stringify(ev.command));
    console.log('PASS test 13: all-turns line written with no /mos: context');
  } finally {
    rmRf(roomDir);
    rmRf(homeDir);
    estimator.clearCache();
  }
})();

// ---------- Test 14: /mos:-context turn still logs (preserved) ----------

(function test14MosContextStillLogs() {
  const { roomDir, homeDir } = mkHookFixture('hook-mos');
  try {
    const payload = {
      tool_name: 'Grep',
      tool_input: { pattern: 'foo' },
      tool_response: { content: 'b'.repeat(400) },
    };
    const res = runHook(payload, { roomDir, homeDir, mosContext: '/mos:scout' });
    assert.equal(res.status, 0, 'hook must exit 0; stderr=' + (res.stderr || ''));
    const lines = readJsonlLines(homeDir);
    assert.equal(lines.length, 1, '/mos: turn must still write exactly one line');
    const ev = JSON.parse(lines[0]);
    assert.equal(ev.command, '/mos:scout',
      '/mos: turn must record its command handle; got ' + JSON.stringify(ev.command));
    console.log('PASS test 14: /mos: context turn still logs (preserved)');
  } finally {
    rmRf(roomDir);
    rmRf(homeDir);
    estimator.clearCache();
  }
})();

// ---------- Test 15: non-Read/Grep/Glob tool still exits silent ----------

(function test15NonMatchingToolSilent() {
  const { roomDir, homeDir } = mkHookFixture('hook-tool');
  try {
    const payload = {
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
      tool_response: { content: 'c'.repeat(400) },
    };
    const res = runHook(payload, { roomDir, homeDir });
    assert.equal(res.status, 0, 'hook must exit 0');
    const lines = readJsonlLines(homeDir);
    assert.equal(lines.length, 0,
      'non-Read/Grep/Glob tool must NOT write a line (tool gate preserved); ' +
      'got ' + lines.length);
    console.log('PASS test 15: non-matching tool exits silent (tool gate preserved)');
  } finally {
    rmRf(roomDir);
    rmRf(homeDir);
    estimator.clearCache();
  }
})();

// ---------- Test 16: no room -> exits silent ----------

(function test16NoRoomSilent() {
  // cwd is a bare temp dir with NO .room-root sentinel anywhere up the tree.
  const cwdDir = mkTmpDir('hook-noroom-cwd');
  const homeDir = mkTmpDir('hook-noroom-home');
  try {
    const payload = {
      tool_name: 'Read',
      tool_input: { file_path: 'x.md' },
      tool_response: { content: 'd'.repeat(400) },
    };
    const res = runHook(payload, { roomDir: cwdDir, homeDir });
    assert.equal(res.status, 0, 'hook must exit 0');
    const lines = readJsonlLines(homeDir);
    assert.equal(lines.length, 0,
      'no-room turn must NOT write a line (room gate preserved); got ' + lines.length);
    console.log('PASS test 16: no-room exits silent (room gate preserved)');
  } finally {
    rmRf(cwdDir);
    rmRf(homeDir);
    estimator.clearCache();
  }
})();

// ---------- Test 17: tokens_used <= 0 -> exits silent ----------

(function test17EmptyResponseSilent() {
  const { roomDir, homeDir } = mkHookFixture('hook-empty');
  try {
    const payload = {
      tool_name: 'Glob',
      tool_input: { pattern: '*.md' },
      tool_response: { content: '' }, // empty -> tokens_used 0 -> silent
    };
    const res = runHook(payload, { roomDir, homeDir });
    assert.equal(res.status, 0, 'hook must exit 0');
    const lines = readJsonlLines(homeDir);
    assert.equal(lines.length, 0,
      'empty response (tokens_used 0) must NOT write a line (>0 gate preserved); ' +
      'got ' + lines.length);
    console.log('PASS test 17: tokens_used<=0 exits silent (>0 gate preserved)');
  } finally {
    rmRf(roomDir);
    rmRf(homeDir);
    estimator.clearCache();
  }
})();

// ---------- Test 18: Part-8 field-set -- only the eight scalar fields ----------

(function test18Part8FieldSet() {
  const { roomDir, homeDir } = mkHookFixture('hook-part8');
  try {
    const payload = {
      tool_name: 'Read',
      tool_input: { file_path: 'notes.md' },
      tool_response: { content: 'e'.repeat(600) },
    };
    const res = runHook(payload, { roomDir, homeDir });
    assert.equal(res.status, 0, 'hook must exit 0');
    const lines = readJsonlLines(homeDir);
    assert.equal(lines.length, 1, 'all-turns line must be written');
    const ev = JSON.parse(lines[0]);
    const keys = Object.keys(ev).sort();
    // The canonical eight (sorted): command, event, ratio, room_slug,
    // tokens_naive_estimate, tokens_used, tool, ts.
    const canonical = [
      'command', 'event', 'ratio', 'room_slug',
      'tokens_naive_estimate', 'tokens_used', 'tool', 'ts',
    ].sort();
    assert.deepEqual(keys, canonical,
      'Part-8 invariant: the JSONL event must carry EXACTLY the eight scalar ' +
      'fields and no extra field. Got: ' + JSON.stringify(keys));
    // room_slug must be a LOCAL basename, never a path.
    assert.ok(ev.room_slug.indexOf('/') === -1 && ev.room_slug.indexOf('\\') === -1,
      'room_slug must be a slug, not a path; got ' + ev.room_slug);
    console.log('PASS test 18: Part-8 field-set (exactly 8 scalar fields, LOCAL slug)');
  } finally {
    rmRf(roomDir);
    rmRf(homeDir);
    estimator.clearCache();
  }
})();

console.log('\nquery-efficiency-telemetry: 18/18 tests passed');
