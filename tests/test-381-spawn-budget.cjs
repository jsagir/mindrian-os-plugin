'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 381 Plan 04 Task 3 (PERF381-02, PERF381-08, T-381-01, T-381-04) -- the spawn budget and
 * the network guard of the node renderers, measured in-process.
 *
 * Method: before any lib/core/room-* module loads, every function of node:child_process that
 * starts a process (spawn, spawnSync, execFile, execFileSync, exec, execSync, fork) is replaced by
 * a wrapper that records { fn, file, args } and calls through. room-scan.cjs and the renderers
 * call cp.<fn> at call time, so every child they start is recorded. The net guard of the parity
 * gate (tests/helpers/net-guard-381.cjs) is loaded in-process with NET_GUARD_381_LOG set; its log
 * must stay empty (Canon Part 8). Each leg clears the require cache of the room-* modules, so the
 * per-process date memo of room-scan starts empty.
 *
 * EDGE_TEAM_SPAWNS (team renderer on the edge room of tests/fixtures/room-381/build-fixture.cjs):
 *   The edge room has 7 named profiles with 7 distinct last_active values (frank is CRLF, so it
 *   has no frontmatter and no name). The only spawns are the date chain of room-scan dateDToEpoch,
 *   once per distinct value:
 *     6 values that date -d accepts                  6 x date -d                  = 6
 *     2026-02-30 (shape-valid, date -d rejects it)   date -d, date -j -f, python3  = 3
 *   Total 9. No profile or artifact value holds a backslash, so the profile rewrite fallback
 *   (FALLBACK_PROGRAMS.profileRewrite) does not run. Nothing is spawned per file: 50 more
 *   artifacts give the same count.
 *
 * Team legs:
 *   edge          run('team', [edgeCopy]) spawns exactly EDGE_TEAM_SPAWNS processes
 *   edge plus 50  50 more artifacts (speaker Alice Ade, segment_type insight) in
 *                 problem-definition: the same count (zero per-file spawns)
 *   hostile       the quick 261029-u8x payloads: only date-chain spawns, once per distinct
 *                 value; no python3 spawn for a payload value (they are not shape-valid); no node
 *                 spawn; no file appears in the fresh run cwd (the u8x marker); this is the
 *                 spawn-level parity leg of T-381-01
 *   programs      every recorded spawn with -c or -e carries a constant program next
 *                 (FALLBACK_PROGRAMS of the renderers or room-scan DATE_PY_PROGRAM); python3
 *                 only as dateDToEpoch step 3 with a shape-valid value; node never
 *   net guard     the net guard log is empty
 *
 * Plain node:assert/strict, zero deps, temp dirs under os.tmpdir() only. A missing precondition
 * (bash 4, symlinks) prints a SKIP line. Exit 0 pass, 1 fail. Hyphens only.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

// Parity contract (ruling 3) for the in-process run and its children.
process.env.LC_ALL = 'C.UTF-8';
process.env.LANG = 'C.UTF-8';
process.env.TZ = 'UTC';

// The fixture builders and the copy helper load BEFORE the recorder, so their own cp and git
// children are never counted.
const oracle = require(path.join(ROOT, 'tests', 'helpers', 'oracle-381.cjs'));
const builders = require(path.join(ROOT, 'tests', 'fixtures', 'room-381', 'build-fixture.cjs'));

const EDGE_TEAM_SPAWNS = 9;

// ---------------------------------------------------------------------------
// child_process recorder
// ---------------------------------------------------------------------------
const cpMod = require('node:child_process');
const recorded = [];
let recording = false;
['spawn', 'spawnSync', 'execFile', 'execFileSync', 'exec', 'execSync', 'fork'].forEach((fn) => {
  const orig = cpMod[fn];
  if (typeof orig !== 'function') return;
  cpMod[fn] = function recordedChild(file, args, ...rest) {
    if (recording) recorded.push({ fn, file: String(file), args: Array.isArray(args) ? args.map(String) : [] });
    return orig.call(this, file, args, ...rest);
  };
});

// ---------------------------------------------------------------------------
// in-process net guard
// ---------------------------------------------------------------------------
const netLog = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'test-381-spawn-net-')), 'net.log');
process.env.NET_GUARD_381_LOG = netLog;
require(path.join(ROOT, 'tests', 'helpers', 'net-guard-381.cjs'));

const ROOM_MODULES = ['room-scan.cjs', 'room-render.cjs', 'room-render-team.cjs'].map((f) => path.join(ROOT, 'lib', 'core', f));

function freshModules() {
  ROOM_MODULES.forEach((m) => { delete require.cache[m]; });
  return {
    render: require(path.join(ROOT, 'lib', 'core', 'room-render.cjs')),
    team: require(path.join(ROOT, 'lib', 'core', 'room-render-team.cjs')),
    scan: require(path.join(ROOT, 'lib', 'core', 'room-scan.cjs')),
  };
}

let failures = 0;
async function leg(name, fn) {
  try {
    await fn();
    console.log('ok - ' + name);
  } catch (err) {
    failures += 1;
    console.log('not ok - ' + name);
    console.log('    ' + String(err && err.message ? err.message : err).split('\n').join('\n    '));
  }
}

// Run the team renderer in-process with a fresh module set and a fresh empty cwd.
async function recordTeam(roomDir) {
  const mods = freshModules();
  const cwd = oracle.mkTmp('spawn-cwd');
  const prevCwd = process.cwd();
  recorded.length = 0;
  process.chdir(cwd);
  recording = true;
  let res;
  try {
    res = await mods.render.run('team', [roomDir]);
  } finally {
    recording = false;
    process.chdir(prevCwd);
  }
  return { res, spawns: recorded.slice(), cwdFiles: fs.readdirSync(cwd), mods };
}

function describe(s) {
  return s.fn + ' ' + s.file + ' ' + JSON.stringify(s.args);
}

const DATE_SHAPE = /^[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}$/;

// The date chain of room-scan dateDToEpoch: date -d V +%s, date -j -f %Y-%m-%d V +%s,
// python3 -c DATE_PY_PROGRAM V (shape-valid V only).
function dateChainValue(s, datePy) {
  if (s.fn !== 'spawnSync') return null;
  if (s.file === 'date' && s.args.length === 3 && s.args[0] === '-d' && s.args[2] === '+%s') return s.args[1];
  if (s.file === 'date' && s.args.length === 5 && s.args[0] === '-j' && s.args[1] === '-f' && s.args[2] === '%Y-%m-%d' && s.args[4] === '+%s') return s.args[3];
  if (s.file === 'python3' && s.args.length === 3 && s.args[0] === '-c' && s.args[1] === datePy && DATE_SHAPE.test(s.args[2])) return s.args[2];
  return null;
}

function checkPrograms(spawns, mods) {
  const allowed = new Set(Object.values(mods.team.FALLBACK_PROGRAMS).concat([mods.scan.DATE_PY_PROGRAM]));
  spawns.forEach((s) => {
    const i = s.args.findIndex((a) => a === '-c' || a === '-e');
    if (i >= 0) assert.ok(allowed.has(s.args[i + 1]), 'a spawn with ' + s.args[i] + ' carries a constant program: ' + describe(s));
    assert.notEqual(path.basename(s.file), 'node', 'no node spawn: ' + describe(s));
    assert.notEqual(s.file, process.execPath, 'no node spawn: ' + describe(s));
    if (path.basename(s.file).startsWith('python')) {
      assert.ok(dateChainValue(s, mods.scan.DATE_PY_PROGRAM) !== null, 'python3 only as dateDToEpoch step 3 with a shape-valid value: ' + describe(s));
    }
  });
}

async function main() {
  const probe = cpMod.spawnSync('bash', ['-c', 'echo "${BASH_VERSINFO[0]}"'], { encoding: 'utf8' });
  if (probe.status !== 0 || Number(String(probe.stdout).trim()) < 4) {
    console.log('SKIP test-381-spawn-budget: bash 4 or later is not available');
    return 0;
  }
  const scratch = oracle.mkTmp('spawn-src');
  const edge = builders.buildEdgeRoom(path.join(scratch, 'edge'), {});
  if (!edge.symlinks) {
    console.log('SKIP test-381-spawn-budget: the platform refused a symlink, the edge room is incomplete');
    return 0;
  }
  const hostile = builders.buildHostileRoom(path.join(scratch, 'hostile'), {});

  let edgeCount = -1;
  await leg('edge: run(team) spawns exactly EDGE_TEAM_SPAWNS (' + EDGE_TEAM_SPAWNS + ') date-chain processes', async () => {
    const copy = path.join(oracle.mkTmp('spawn-edge'), 'room');
    oracle.copyRoom(edge.roomDir, copy);
    const r = await recordTeam(copy);
    assert.equal(r.res.code, 0, 'exit code');
    assert.ok(fs.existsSync(path.join(copy, 'team', 'TEAM-STATE.md')), 'TEAM-STATE.md written');
    r.spawns.forEach((s) => console.log('    spawn: ' + describe(s)));
    const values = r.spawns.map((s) => dateChainValue(s, r.mods.scan.DATE_PY_PROGRAM));
    assert.ok(values.every((v) => v !== null), 'every spawn is a date-chain step');
    checkPrograms(r.spawns, r.mods);
    edgeCount = r.spawns.length;
    console.log('    spawn count ' + edgeCount + ' (EDGE_TEAM_SPAWNS ' + EDGE_TEAM_SPAWNS + ')');
    assert.equal(edgeCount, EDGE_TEAM_SPAWNS, 'spawn count');
  });

  await leg('edge plus 50 artifacts: the same spawn count (zero per-file spawns)', async () => {
    const copy = path.join(oracle.mkTmp('spawn-edge50'), 'room');
    oracle.copyRoom(edge.roomDir, copy);
    for (let i = 0; i < 50; i += 1) {
      fs.writeFileSync(path.join(copy, 'problem-definition', 'extra-' + String(i).padStart(2, '0') + '.md'),
        '---\nspeaker: Alice Ade\nsegment_type: insight\n---\n# Extra ' + i + '\n');
    }
    const r = await recordTeam(copy);
    assert.equal(r.res.code, 0, 'exit code');
    checkPrograms(r.spawns, r.mods);
    console.log('    spawn count ' + r.spawns.length + ' with 50 extra artifacts (edge ' + edgeCount + ')');
    assert.equal(r.spawns.length, EDGE_TEAM_SPAWNS, 'spawn count with 50 extra artifacts');
  });

  await leg('hostile: only date-chain spawns once per distinct value, no payload reaches python3, no node, no marker', async () => {
    const copy = path.join(oracle.mkTmp('spawn-hostile'), 'room');
    oracle.copyRoom(hostile.roomDir, copy);
    const r = await recordTeam(copy);
    assert.equal(r.res.code, 0, 'exit code');
    r.spawns.forEach((s) => console.log('    spawn: ' + describe(s)));
    checkPrograms(r.spawns, r.mods);
    const seen = new Map();
    r.spawns.forEach((s) => {
      const v = dateChainValue(s, r.mods.scan.DATE_PY_PROGRAM);
      assert.ok(v !== null, 'a date-chain step: ' + describe(s));
      const step = s.file + ' ' + s.args[0];
      const k = step + '\u0000' + v;
      assert.ok(!seen.has(k), 'each step runs once per distinct value: ' + describe(s));
      seen.set(k, true);
      if (s.file === 'python3') {
        hostile.markers.forEach((m) => assert.ok(!v.includes(m), 'no payload value reaches python3'));
      }
    });
    assert.deepEqual(r.cwdFiles, [], 'no file appears in the run cwd');
    hostile.markers.forEach((m) => {
      assert.ok(!fs.existsSync(path.join(copy, m)), 'no marker in the room: ' + m);
    });
  });

  await leg('net guard: the log is empty (Part 8)', async () => {
    let log = '';
    try { log = fs.readFileSync(netLog, 'utf8'); } catch (_e) { log = ''; }
    assert.equal(log.trim(), '', 'net guard log');
  });

  return failures === 0 ? 0 : 1;
}

main().then((code) => {
  oracle.cleanupTmp();
  try { fs.rmSync(path.dirname(netLog), { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  console.log(failures === 0 ? 'test-381-spawn-budget: all legs passed' : 'test-381-spawn-budget: ' + failures + ' failed');
  process.exitCode = code;
}, (err) => {
  oracle.cleanupTmp();
  console.log('not ok - test-381-spawn-budget crashed: ' + String(err && err.stack ? err.stack : err));
  process.exitCode = 1;
});
