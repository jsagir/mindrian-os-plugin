'use strict';
// Phase 109-06 test: navigation chokepoint pre-commit hook + runtime soft-defense.
// NAV-109-05 acceptance harness.

const { ok, equal } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const HOOK = path.join(REPO_ROOT, 'scripts', 'check-schema-aliases.cjs');

function runHook(stagedFiles, opts) {
  // The hook accepts staged-file paths via env MINDRIAN_HOOK_STAGED_FILES (newline-separated)
  // for hermetic testing. Plan 109-06 introduces this seam.
  const env = Object.assign({}, process.env, {
    MINDRIAN_HOOK_STAGED_FILES: stagedFiles.map((f) => f.path).join('\n'),
    MINDRIAN_HOOK_STAGED_CONTENT_DIR: opts && opts.contentDir ? opts.contentDir : '',
  });
  const args = ['--check-chokepoint'];
  const r = spawnSync('node', [HOOK, ...args], { env, encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function makeStagedContent(files) {
  // Write file paths plus content into a tmp dir; the hook reads each path's content.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-109-hook-'));
  const out = [];
  for (const f of files) {
    const full = path.join(tmp, f.path);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, f.content);
    out.push({ path: f.path });
  }
  return { tmp, files: out };
}

function cleanup(tmp) { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ } }

function test1_subcommandExists() {
  const r = spawnSync('node', [HOOK, '--check-chokepoint'], { env: Object.assign({}, process.env, { MINDRIAN_HOOK_STAGED_FILES: '' }), encoding: 'utf8' });
  equal(r.status, 0, 'empty staged set passes; stderr=' + r.stderr);
}

function test2_allowListAcceptance() {
  const { tmp, files } = makeStagedContent([
    { path: 'lib/core/navigation/example-helper.cjs', content: "'use strict';\nconst { openRoomDb } = require('../room-db.cjs');\nmodule.exports = {};\n" },
  ]);
  try {
    const r = runHook(files, { contentDir: tmp });
    equal(r.code, 0, 'navigation/* path with direct import accepted; stderr=' + r.stderr);
  } finally { cleanup(tmp); }
}

function test3_bannedPatternRejection() {
  const { tmp, files } = makeStagedContent([
    { path: 'lib/core/some-new-module.cjs', content: "'use strict';\nconst rd = require('./room-db.cjs');\nmodule.exports = rd;\n" },
  ]);
  try {
    const r = runHook(files, { contentDir: tmp });
    ok(r.code !== 0, 'banned require accepted unexpectedly');
    ok(/some-new-module\.cjs/.test(r.stderr), 'stderr names offending file');
    ok(/room-db/.test(r.stderr), 'stderr names offending pattern');
  } finally { cleanup(tmp); }
}

function test4_lazygraphAndMemoryAlsoBanned() {
  const cases = [
    { path: 'lib/some-feature.cjs', content: "const lg = require('lib/core/lazygraph-ops.cjs');" },
    { path: 'lib/some-feature.cjs', content: "const m = require('../core/memory-ops.cjs');" },
  ];
  for (const c of cases) {
    const { tmp, files } = makeStagedContent([c]);
    try {
      const r = runHook(files, { contentDir: tmp });
      ok(r.code !== 0, 'banned co-module require accepted: ' + c.content);
    } finally { cleanup(tmp); }
  }
}

function test5_legacyGrandfather() {
  const grandfathered = [
    'lib/hmi/across-session-memory.cjs',
    'lib/core/brain-derivation.cjs',
    'scripts/compute-state',
  ];
  for (const p of grandfathered) {
    const { tmp, files } = makeStagedContent([{ path: p, content: "const rd = require('lib/core/room-db.cjs');" }]);
    try {
      const r = runHook(files, { contentDir: tmp });
      equal(r.code, 0, 'grandfathered path rejected: ' + p + '; stderr=' + r.stderr);
    } finally { cleanup(tmp); }
  }
}

function test6_runtimeSoftDefenseJsonl() {
  const home = os.homedir();
  const dir = path.join(home, '.mindrian', 'telemetry');
  const file = path.join(dir, 'navigation-bypass.jsonl');
  const linesBefore = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).length : 0;

  // Spawn a sub-process that requires room-db.cjs from a path NOT inside navigation/ or tests/.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-109-runtime-'));
  const callerScript = path.join(tmp, 'fake-caller.cjs');
  const roomDir = path.join(tmp, 'room');
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  const roomDbPath = path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs').replace(/\\/g, '/');
  const roomDirNorm = roomDir.replace(/\\/g, '/');
  fs.writeFileSync(callerScript, "const { openRoomDb, closeRoomDb } = require('" + roomDbPath + "'); const db = openRoomDb('" + roomDirNorm + "'); closeRoomDb(db);");
  const r = spawnSync('node', [callerScript], { env: Object.assign({}, process.env, { MINDRIAN_DISABLE_BYPASS_AUDIT: '0' }), encoding: 'utf8' });
  try {
    equal(r.status, 0, 'caller script crashed: ' + r.stderr);
    ok(fs.existsSync(file), 'navigation-bypass.jsonl created');
    const linesAfter = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).length;
    ok(linesAfter > linesBefore, 'JSONL gained at least one line: before=' + linesBefore + ' after=' + linesAfter);
    const lastLine = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).pop();
    const parsed = JSON.parse(lastLine);
    ok(typeof parsed.ts === 'number');
    ok(typeof parsed.caller === 'string' && parsed.caller.length > 0);
    ok(typeof parsed.room_hash === 'string' && parsed.room_hash.length === 16);
  } finally { cleanup(tmp); }
}

function test7_optOutEnvHonored() {
  const home = os.homedir();
  const dir = path.join(home, '.mindrian', 'telemetry');
  const file = path.join(dir, 'navigation-bypass.jsonl');
  const linesBefore = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).length : 0;

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-109-runtime-optout-'));
  const callerScript = path.join(tmp, 'fake-caller.cjs');
  const roomDir = path.join(tmp, 'room');
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  const roomDbPath = path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs').replace(/\\/g, '/');
  const roomDirNorm = roomDir.replace(/\\/g, '/');
  fs.writeFileSync(callerScript, "const { openRoomDb, closeRoomDb } = require('" + roomDbPath + "'); const db = openRoomDb('" + roomDirNorm + "'); closeRoomDb(db);");
  const r = spawnSync('node', [callerScript], { env: Object.assign({}, process.env, { MINDRIAN_DISABLE_BYPASS_AUDIT: '1' }), encoding: 'utf8' });
  try {
    equal(r.status, 0);
    const linesAfter = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).length : 0;
    equal(linesAfter, linesBefore, 'opt-out env suppresses JSONL write');
  } finally { cleanup(tmp); }
}

function run() {
  const tests = [test1_subcommandExists, test2_allowListAcceptance, test3_bannedPatternRejection, test4_lazygraphAndMemoryAlsoBanned, test5_legacyGrandfather, test6_runtimeSoftDefenseJsonl, test7_optOutEnvHonored];
  let pass = 0; let fail = 0;
  for (const t of tests) {
    try { t(); pass++; process.stdout.write('PASS ' + t.name + '\n'); }
    catch (err) { fail++; process.stderr.write('FAIL ' + t.name + ': ' + err.message + '\n' + err.stack + '\n'); }
  }
  process.stdout.write('test-navigation-chokepoint-hook: ' + pass + '/' + tests.length + ' passed\n');
  process.exit(fail === 0 ? 0 : 1);
}

run();
