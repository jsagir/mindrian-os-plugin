'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 381 Plan 04 Task 3 (PERF381-01, PERF381-05) -- the named divergences between the OLD bash
 * renderers (BASE_SHA oracle, tests/helpers/oracle-381.cjs) and the NEW node renderers.
 *
 * Ruling 2 as amended 2026-10-29 (381-CONTEXT.md): node gives the safe and correct result and the
 * following cases are NOT reproduced. Each one is pinned here by name. No gate room carries one,
 * so the parity gate (tests/test-381-parity.cjs) still diffs to zero.
 *   invalid-utf8 (team)            a profile name with the byte 0xE9. OLD grep reads the input as
 *                                  binary and prints no line, so the profile has no name and no
 *                                  row. NEW decodes the byte to U+FFFD and keeps the row.
 *   room-path-sed (team)           OLD removes the room prefix of a profile path with a sed
 *                                  program built from the room path. A path with | \ [ * ^ $ or a
 *                                  newline breaks or bends that program. NEW removes the prefix
 *                                  as a literal string. This is the same class as the ruling 2
 *                                  injection cases (program text built from data), here with a
 *                                  path instead of a frontmatter value.
 *   macos-python-path (compute-team)  source-level: the wrapper header runs the node renderer
 *                                  before the bash 3.2 python fallback, so macOS gets the Linux
 *                                  bytes instead of the python bytes.
 *
 * Not divergences any more: the python date fallback injection and the node -e section-name
 * injection (python-date-injection, node-e-section-name). After quick 261029-u8x the OLD oracle is
 * safe, so they are parity cases in the hostile room of the parity gate (equal bytes, no marker).
 *
 * Later plans append the analyze and state legs (sigpipe-large-file, nul-byte, ...).
 *
 * Plain node:assert/strict, zero deps. Every script runs on a fresh cp -a copy under os.tmpdir().
 * Exit 0 pass, 1 fail. A missing precondition prints a SKIP line. Hyphens only.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const oracle = require(path.join(ROOT, 'tests', 'helpers', 'oracle-381.cjs'));
const builders = require(path.join(ROOT, 'tests', 'fixtures', 'room-381', 'build-fixture.cjs'));

let failures = 0;
function leg(name, fn) {
  try {
    fn();
    console.log('ok - ' + name);
  } catch (err) {
    failures += 1;
    console.log('not ok - ' + name);
    console.log('    ' + String(err && err.message ? err.message : err).split('\n').join('\n    '));
  }
}

function bashMajor() {
  const r = spawnSync('bash', ['-c', 'echo "${BASH_VERSINFO[0]}"'], { encoding: 'utf8' });
  return r.status === 0 ? Number(String(r.stdout).trim()) : 0;
}

// Run one side on its own copy of src. tree = the OLD tree or ROOT (the HEAD entry point).
function runOn(tree, src, dst) {
  oracle.copyRoom(src, dst);
  const side = oracle.mkTmp('div-side');
  const home = path.join(side, 'home');
  const roomsHome = path.join(side, 'rooms-home');
  const cwd = path.join(side, 'cwd');
  [home, roomsHome, cwd].forEach((d) => fs.mkdirSync(d, { recursive: true }));
  const env = oracle.cleanEnv({ home, roomsHome, tz: 'UTC' });
  delete env.NODE_OPTIONS;
  const r = oracle.runScript({ tree, script: 'compute-team', roomArg: dst, env, cwd });
  return { status: r.status, stderr: r.stderr.toString('utf8'), cwdFiles: fs.readdirSync(cwd) };
}

function readOrNull(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (_e) {
    return null;
  }
}

function main() {
  if (bashMajor() < 4) {
    console.log('SKIP test-381-known-divergence: bash 4 or later is not available');
    return 0;
  }
  const scratch = oracle.mkTmp('divergence');
  const oldTree = oracle.buildOldTree(oracle.BASE_SHA);

  leg('invalid-utf8 (team): NEW keeps the U+FFFD name row, OLD has no row for it', () => {
    const built = builders.buildDivergenceRoom(path.join(scratch, 'utf8-src'), {});
    const base = oracle.mkTmp('utf8');
    const oldRoom = path.join(base, 'old-room');
    const newRoom = path.join(base, 'new-room');
    const o = runOn(oldTree, built.roomDir, oldRoom);
    const n = runOn(ROOT, built.roomDir, newRoom);
    assert.equal(n.status, 0, 'NEW exit code');
    const newText = readOrNull(path.join(newRoom, 'team', 'TEAM-STATE.md'));
    assert.ok(newText !== null, 'NEW wrote team/TEAM-STATE.md');
    assert.ok(newText.split('\n').some((l) => l.startsWith('| Caf� |')), 'NEW has a row for the U+FFFD name');
    const oldText = readOrNull(path.join(oldRoom, 'team', 'TEAM-STATE.md'));
    const oldRow = oldText !== null && oldText.split('\n').some((l) => l.startsWith('| Caf'));
    assert.equal(oldRow, false, 'OLD has no row for the invalid UTF-8 name');
    console.log('    OLD exit ' + o.status + ', TEAM-STATE.md ' + (oldText === null ? 'not written' : 'written without the row'));
  });

  leg('room-path-sed (team): NEW rewrites the Contributions table under a room path with a pipe', () => {
    const edge = builders.buildEdgeRoom(path.join(scratch, 'edge-src'), {});
    const parent = path.join(oracle.mkTmp('pipe'), 'a|b');
    fs.mkdirSync(parent, { recursive: true });
    const oldRoom = path.join(parent, 'old-room');
    const newRoom = path.join(parent, 'new-room');
    const rel = path.join('team', 'members', 'alice', 'PROFILE.md');
    const source = fs.readFileSync(path.join(edge.roomDir, rel), 'utf8');
    const o = runOn(oldTree, edge.roomDir, oldRoom);
    const n = runOn(ROOT, edge.roomDir, newRoom);
    assert.equal(n.status, 0, 'NEW exit code');
    const after = fs.readFileSync(path.join(newRoom, rel), 'utf8');
    assert.notEqual(after, source, 'NEW rewrote team/members/alice/PROFILE.md');
    assert.ok(after.includes('| Date | Section | Type | Artifact |'), 'NEW wrote the contributions table');
    assert.ok(!after.includes('| 2020-01-01 | old | old | old.md |'), 'NEW replaced the old table row');
    const oldAfter = readOrNull(path.join(oldRoom, rel));
    const oldState = fs.existsSync(path.join(oldRoom, 'team', 'TEAM-STATE.md'));
    console.log('    OLD exit ' + o.status + ', TEAM-STATE.md ' + (oldState ? 'written' : 'not written') +
      ', alice PROFILE.md ' + (oldAfter === source ? 'unchanged' : 'changed') +
      (o.stderr ? ', stderr: ' + JSON.stringify(o.stderr.split('\n')[0]) : ''));
  });

  leg('macos-python-path (compute-team): the node exec line precedes the first BASH_VERSINFO line', () => {
    const lines = fs.readFileSync(path.join(ROOT, 'scripts', 'compute-team'), 'utf8').split('\n');
    const execLine = lines.findIndex((l) => l.includes('exec node "${SCRIPT_DIR}/../lib/core/room-render.cjs" team "$@"'));
    const versLine = lines.findIndex((l) => l.includes('BASH_VERSINFO'));
    assert.ok(execLine >= 0, 'the exec line exists');
    assert.ok(versLine >= 0, 'the BASH_VERSINFO line exists');
    assert.ok(execLine < versLine, 'exec line ' + (execLine + 1) + ' comes before BASH_VERSINFO line ' + (versLine + 1));
  });

  return failures === 0 ? 0 : 1;
}

let code = 1;
try {
  code = main();
} finally {
  oracle.cleanupTmp();
}
console.log(failures === 0 ? 'test-381-known-divergence: all legs passed' : 'test-381-known-divergence: ' + failures + ' failed');
process.exitCode = code;
