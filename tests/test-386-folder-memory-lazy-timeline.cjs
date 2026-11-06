#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 386 plan 35 (E-LAZY): the timeline runner loads only when
 * extractFeynmanBody runs.
 * Debug session: folder-memory-eager-timeline-runner-widens-guard-dependencies.
 *
 * This is Part 8 hardening: fewer eager dependencies for the guard, the hook
 * and the statusline processes. It is not a speed item and claims no time gain.
 * Counts come from FRESH child processes only.
 *
 * Arms:
 *   LZ1 requiring folder-memory.cjs leaves the timeline runner out of require.cache
 *   LZ2 the same for folder-memory-async.cjs
 *   LZ3 readQuintuple().feynman equals the reference for every variant (sync and async)
 *   LZ4 a runner that cannot load takes the existing fallback (trimmed raw buffer)
 *   LZ5 fresh-process module counts are lower than the RCA before lines
 *   LZ6 navigation and the runner are out of require.cache for the guard and the statusline
 *
 * Synthetic room and strings only. No network. No em dash or en dash.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const FM = path.join(ROOT, 'lib', 'core', 'folder-memory.cjs');
const FA = path.join(ROOT, 'lib', 'core', 'folder-memory-async.cjs');
const GUARD = path.join(ROOT, 'lib', 'core', 'part8-egress-guard.cjs');
const HOOK = path.join(ROOT, 'scripts', 'part8-egress-guard-hook.cjs');
const STATUSLINE = path.join(ROOT, 'scripts', 'context-monitor');
const COUNT_PRELOAD = path.join(ROOT, 'tools', 'perf', 'count-modules-preload.cjs');
const ROOM_HELPER = path.join(__dirname, 'helpers', 'synthetic-room-db.cjs');
const RCA_PATH = (require('node:fs').existsSync(path.join(ROOT, '.planning', 'debug', 'folder-memory-eager-timeline-runner-widens-guard-dependencies.md')) ? path.join(ROOT, '.planning', 'debug', 'folder-memory-eager-timeline-runner-widens-guard-dependencies.md') : path.join(ROOT, '.planning', 'debug', 'resolved', 'folder-memory-eager-timeline-runner-widens-guard-dependencies.md'));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos386-lz-'));
const HOME = path.join(TMP, 'home');
fs.mkdirSync(HOME, { recursive: true });

let failures = 0;
function ok(label, detail) { console.log('ok - ' + label + (detail ? ' ' + detail : '')); }
function fail(label, detail) { failures += 1; console.log('FAIL - ' + label + (detail ? ': ' + detail : '')); }
function arm(label, fn) {
  try { fn(); } catch (e) { fail(label, 'threw ' + (e && e.message ? e.message : String(e))); }
}

function rcaLine(name) {
  const t = fs.readFileSync(RCA_PATH, 'utf8');
  const m = t.match(new RegExp('^' + name + ': (.+)$', 'm'));
  if (!m) throw new Error('RCA line missing: ' + name);
  return m[1].trim();
}

// ---- the preload that records require.cache flags at exit ------------------
const FLAGS_PRELOAD = path.join(TMP, 'flags-preload.cjs');
fs.writeFileSync(FLAGS_PRELOAD, [
  "'use strict';",
  "const fs = require('node:fs');",
  'process.on(\'exit\', function () {',
  '  try {',
  '    const keys = Object.keys(require.cache).map(function (k) { return k.split(String.fromCharCode(92)).join(\'/\'); });',
  '    const has = function (s) { return keys.some(function (k) { return k.endsWith(s); }); };',
  '    fs.appendFileSync(process.env.LZ_FLAGS_LOG, JSON.stringify({ navigation: has(\'/lib/core/navigation.cjs\'), runner: has(\'/lib/core/feynman/timeline-runner.cjs\') }) + \'\\n\');',
  '  } catch (_e) {}',
  '});',
  '',
].join('\n'));

// ---- fixtures --------------------------------------------------------------
const VARIANTS = {
  absent: null,
  empty: '',
  body_only: 'Plain prose line one.\nPlain prose line two.\n',
  frontmatter_body: '---\ntitle: sample\nupdated: 2026-01-01\n---\n\nProse after the frontmatter.\n',
  sentinel_block: 'Human prose before.\n\n## Timeline (auto)\n\n<!-- TIMELINE_AUTO_START -->\n- an auto line\n- another auto line\n<!-- TIMELINE_AUTO_END -->\n\nHuman prose after.\n',
  crlf: '---\r\ntitle: sample\r\n---\r\nLine one.\r\nLine two.\r\n',
};
const VARIANT_DIRS = {};
Object.keys(VARIANTS).forEach(function (name) {
  const d = path.join(TMP, 'sections', name);
  fs.mkdirSync(d, { recursive: true });
  if (VARIANTS[name] !== null) fs.writeFileSync(path.join(d, 'FEYNMAN.md'), VARIANTS[name]);
  VARIANT_DIRS[name] = d;
});

function childEnv(extra) {
  const env = Object.assign({}, process.env, { HOME: HOME, USERPROFILE: HOME, PART8_FORCE_BRAIN_AVAILABLE: '0' });
  delete env.CLAUDE_ACTIVE_ROOM;
  delete env.NODE_OPTIONS;
  return Object.assign(env, extra || {});
}

function runNode(args, input, extraEnv) {
  return spawnSync(process.execPath, args, { input: input || '', encoding: 'utf8', timeout: 30000, cwd: ROOT, env: childEnv(extraEnv) });
}

function runnerInCache(modulePath) {
  const code = "require(" + JSON.stringify(modulePath) + ");" +
    "console.log(JSON.stringify(Object.keys(require.cache).some(function (k) { return k.split(String.fromCharCode(92)).join('/').endsWith('/feynman/timeline-runner.cjs'); })));";
  const r = runNode(['-e', code]);
  if (r.status !== 0) throw new Error('child exit ' + r.status + ': ' + String(r.stderr).slice(0, 160));
  return JSON.parse(String(r.stdout).trim().split('\n').pop());
}

// ---- LZ1, LZ2 ---------------------------------------------------------------
arm('LZ1', function () {
  const inCache = runnerInCache(FM);
  if (inCache) fail('LZ1', 'timeline-runner.cjs is in require.cache after requiring folder-memory.cjs');
  else ok('LZ1', 'runner not loaded by folder-memory.cjs');
});
arm('LZ2', function () {
  const inCache = runnerInCache(FA);
  if (inCache) fail('LZ2', 'timeline-runner.cjs is in require.cache after requiring folder-memory-async.cjs');
  else ok('LZ2', 'runner not loaded by folder-memory-async.cjs');
});

// ---- LZ3 --------------------------------------------------------------------
function reference(name) {
  // what the runner returns directly: body outside the sentinels, trimmed
  const file = path.join(VARIANT_DIRS[name], 'FEYNMAN.md');
  if (!fs.existsSync(file)) return '';
  const runner = require(path.join(ROOT, 'lib', 'core', 'feynman', 'timeline-runner.cjs'));
  const buf = fs.readFileSync(file, 'utf8');
  const parsed = runner.parseFrontmatter(buf);
  const body = parsed && typeof parsed.body === 'string' ? parsed.body : buf;
  return runner.bodyOutsideSentinels(body).trim();
}

arm('LZ3', function () {
  const fm = require(FM);
  const fa = require(FA);
  const names = Object.keys(VARIANTS);
  const mismatches = [];
  const pending = names.map(function (name) {
    const want = reference(name);
    const sync = fm.readQuintuple(VARIANT_DIRS[name]).feynman;
    if (sync !== want) mismatches.push('sync:' + name);
    return Promise.resolve(fa.readQuintuple(VARIANT_DIRS[name])).then(function (q) {
      if (q.feynman !== want) mismatches.push('async:' + name);
    });
  });
  Promise.all(pending).then(function () {
    if (mismatches.length) fail('LZ3', mismatches.length + ' mismatches: ' + mismatches.join(','));
    else ok('LZ3', '0 mismatches over ' + names.length + ' variants, sync and async');
    afterLz3();
  }, function (e) {
    fail('LZ3', 'threw ' + (e && e.message ? e.message : String(e)));
    afterLz3();
  });
});

// ---- LZ4 --------------------------------------------------------------------
function lz4() {
  arm('LZ4', function () {
    const code = [
      "const Module = require('module');",
      'const orig = Module._load;',
      "Module._load = function (request) { if (/timeline-runner/.test(String(request))) throw new Error('forced runner load failure'); return orig.apply(this, arguments); };",
      'const fm = require(' + JSON.stringify(FM) + ');',
      'const fa = require(' + JSON.stringify(FA) + ');',
      'const dirs = ' + JSON.stringify(VARIANT_DIRS) + ';',
      'const out = {};',
      '(async function () {',
      '  for (const name of Object.keys(dirs)) {',
      '    const s = fm.readQuintuple(dirs[name]);',
      '    const a = await fa.readQuintuple(dirs[name]);',
      "    out[name] = { sync: s.feynman, async: a.feynman, object: typeof s === 'object' && s !== null };",
      '  }',
      '  console.log(JSON.stringify(out));',
      '})();',
    ].join('\n');
    const r = runNode(['-e', code]);
    if (r.status !== 0) { fail('LZ4', 'child exit ' + r.status + ': ' + String(r.stderr).split('\n').find(function (l) { return /Error/.test(l); })); return; }
    const out = JSON.parse(String(r.stdout).trim().split('\n').pop());
    const bad = [];
    Object.keys(VARIANTS).forEach(function (name) {
      const want = VARIANTS[name] === null ? '' : VARIANTS[name].trim();
      if (!out[name] || out[name].sync !== want) bad.push('sync:' + name);
      if (!out[name] || out[name].async !== want) bad.push('async:' + name);
      if (!out[name] || out[name].object !== true) bad.push('object:' + name);
    });
    if (bad.length) fail('LZ4', bad.join(','));
    else ok('LZ4', 'a runner that cannot load takes the fallback, folder-memory still loads');
  });
}

// ---- counts and cache flags ---------------------------------------------------
function buildRoom() {
  const room = path.join(TMP, 'room');
  require(ROOM_HELPER).buildRoom(room, 'gate-lexgen');
  return room;
}

function targetsFor(room) {
  return {
    guard: { args: ['-e', 'require(' + JSON.stringify(GUARD) + ')'], input: '' },
    hook: {
      args: [HOOK],
      input: JSON.stringify({ tool_name: 'mcp__plugin_mos_mindrian-brain__brain_ask', tool_input: { question: 'explain dominant design' }, session_id: 'tlz386', cwd: room }),
    },
    statusline: {
      args: [STATUSLINE],
      input: JSON.stringify({ model: { display_name: 'M' }, workspace: { current_dir: room }, context_window: { used_percentage: 20, remaining_percentage: 80 } }),
    },
  };
}

function countOf(name, t, i) {
  const log = path.join(TMP, 'count-' + name + '-' + i + '.log');
  runNode(t.args, t.input, { NODE_OPTIONS: '--require ' + COUNT_PRELOAD, MOS_PERF_COUNT_LOG: log });
  const lines = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
  const main = lines.filter(function (l) { return name === 'guard' ? true : l.argv1 === path.basename(t.args[0]); });
  if (!main.length) throw new Error('no count line for ' + name);
  return main[0].modules;
}

function flagsOf(name, t) {
  const log = path.join(TMP, 'flags-' + name + '.log');
  runNode(t.args, t.input, { NODE_OPTIONS: '--require ' + FLAGS_PRELOAD, LZ_FLAGS_LOG: log });
  const lines = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
  if (!lines.length) throw new Error('no flags line for ' + name);
  return lines[0];
}

function lz5(targets) {
  arm('LZ5', function () {
    const hookLoads = rcaLine('hook_loads_timeline_runner') === 'yes';
    const problems = [];
    const seen = [];
    ['guard', 'hook', 'statusline'].forEach(function (name) {
      const before = parseInt(rcaLine('modules_' + name + '_before'), 10);
      const counts = [0, 1, 2].map(function (i) { return countOf(name, targets[name], i); });
      if (counts.some(function (c) { return c !== counts[0]; })) problems.push(name + ' count differs between repeats: ' + counts.join(','));
      const now = counts[0];
      seen.push(name + ' ' + before + ' to ' + now);
      if (name === 'hook' && !hookLoads) {
        if (now > before) problems.push('hook count rose from ' + before + ' to ' + now);
      } else if (!(now < before)) {
        problems.push(name + ' count ' + now + ' is not lower than ' + before);
      }
    });
    if (problems.length) fail('LZ5', problems.join('; '));
    else ok('LZ5', seen.join('; '));
  });
}

function lz6(targets) {
  arm('LZ6', function () {
    const problems = [];
    ['guard', 'statusline'].forEach(function (name) {
      const f = flagsOf(name, targets[name]);
      if (f.navigation) problems.push(name + ': navigation.cjs is in require.cache');
      if (f.runner) problems.push(name + ': timeline-runner.cjs is in require.cache');
    });
    if (problems.length) fail('LZ6', problems.join('; '));
    else ok('LZ6', 'navigation and the runner are absent from require.cache for the guard and the statusline');
  });
}

function afterLz3() {
  lz4();
  let targets = null;
  try { targets = targetsFor(buildRoom()); } catch (e) {
    fail('LZ5', 'room build failed: ' + e.message);
    fail('LZ6', 'room build failed: ' + e.message);
    return finish();
  }
  lz5(targets);
  lz6(targets);
  finish();
}

let finished = false;
process.on('exit', function () {
  if (!finished) {
    console.log('FAIL - the test did not run to the end');
    process.exitCode = 1;
  }
});

function finish() {
  finished = true;
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  if (failures > 0) {
    console.log('\n' + failures + ' arm(s) failed');
    process.exit(1);
  }
  console.log('\nAll lazy timeline runner arms passed');
}
