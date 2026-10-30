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
 * EDGE_ANALYZE_SPAWNS (analyze renderer on the same edge room, plan 381-06):
 *   grep -lZE -- PATTERN files...    the cross-reference INFORMS pass for the section name
 *                                    market.analysis (an ERE metacharacter, so not the in-process
 *                                    fast path); one spawn for every candidate file      = 1
 *   grep -liZE -- PATTERN2 files...  the CONTRADICTS pass for the same name               = 1
 *   xargs (argv [], value on stdin)  the opportunity status value -n (echo reads it as an
 *                                    option, so it is off the xargsEcho fast path)        = 1
 *   date -d V +%s                    the funding last_updated values 2020-01-01 and
 *                                    yesterday, once per distinct value (date -d accepts
 *                                    both, so no date -j -f and no python3)               = 2
 *   Total 5. Every other value, name and term is done in-process. The candidate file list goes to
 *   grep in 96 KiB argv chunks, so 50 more artifacts (## headers, bold runs and [[market-analysis]]
 *   references in problem-definition) give the same count.
 *
 * Analyze legs:
 *   analyze edge          run('analyze', [edgeCopy]) spawns exactly EDGE_ANALYZE_SPAWNS processes
 *   analyze edge plus 50  the same count with 50 more artifacts (zero per-file spawns)
 *   analyze hostile       every spawn is grep (pattern as one argv element after --, or -q with
 *                         the line on stdin), xargs with argv [] or a date-chain step; no node; no
 *                         python3 for a u8x payload value; no file in the fresh run cwd; no marker
 *                         in the room (spawn-level parity leg of T-381-01)
 *
 * EDGE_STATE_SPAWNS (compute-state renderer on the same edge room, plan 381-07):
 *   bash compute-meetings-intelligence <room>   meetings/ holds 2 meeting dirs; the script is
 *                                               spawned once (argv only)                      = 1
 *   grep -lZE -- PATTERN files...               the cross-reference pass for the section name
 *                                               market.analysis (ERE metacharacter); one spawn
 *                                               for every content file                        = 1
 *   the in-process team step (runTeam)          the dateDToEpoch chain once per distinct
 *                                               last_active value, the same spawns as
 *                                               EDGE_TEAM_SPAWNS                              = 9
 *   Total 11. The scaffold predicate, visual-ops (diagram, sparkline, one progress bar per
 *   section) and the registry read run in process: no node and no python3 for them. 50 more
 *   artifacts in problem-definition give the same count.
 *
 * State legs:
 *   state edge          run('state', [edgeCopy]) spawns exactly EDGE_STATE_SPAWNS processes
 *   state edge plus 50  the same count with 50 more artifacts (zero per-file spawns)
 *   state hostile       every spawn is bash compute-meetings-intelligence, grep -lZE with the
 *                       pattern as one argv element, or a date-chain step of the team step; no
 *                       node; no python3 for a u8x payload value; no file in the fresh run cwd;
 *                       no marker in the room (spawn-level parity leg of T-381-01)
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
const EDGE_ANALYZE_SPAWNS = 5;
const EDGE_STATE_SPAWNS = 11;

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

const ROOM_MODULES = ['room-scan.cjs', 'room-render.cjs', 'room-render-team.cjs', 'room-render-analyze.cjs', 'room-render-state.cjs']
  .map((f) => path.join(ROOT, 'lib', 'core', f));

function freshModules() {
  ROOM_MODULES.forEach((m) => { delete require.cache[m]; });
  return {
    render: require(path.join(ROOT, 'lib', 'core', 'room-render.cjs')),
    team: require(path.join(ROOT, 'lib', 'core', 'room-render-team.cjs')),
    analyze: require(path.join(ROOT, 'lib', 'core', 'room-render-analyze.cjs')),
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

// Run a renderer in-process with a fresh module set and a fresh empty cwd.
async function recordTeam(roomDir) {
  return recordMode('team', roomDir);
}

async function recordMode(mode, roomDir) {
  const mods = freshModules();
  const cwd = oracle.mkTmp('spawn-cwd');
  const prevCwd = process.cwd();
  recorded.length = 0;
  process.chdir(cwd);
  recording = true;
  let res;
  try {
    res = await mods.render.run(mode, [roomDir]);
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
  const allowed = new Set(Object.values(mods.team.FALLBACK_PROGRAMS)
    .concat(Object.values(mods.analyze.FALLBACK_PROGRAMS), [mods.scan.DATE_PY_PROGRAM]));
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

// The analyze spawn kinds: grep with the pattern as one argv element, xargs with argv [], or a
// date-chain step. Returns 'grep-files', 'grep-q', 'xargs', 'date' or null.
function analyzeKind(s, datePy) {
  if (s.fn !== 'spawnSync') return null;
  if (s.file === 'grep' && (s.args[0] === '-lZE' || s.args[0] === '-liZE') && s.args[1] === '--' && s.args.length >= 4) return 'grep-files';
  if (s.file === 'grep' && s.args[0] === '-q' && s.args.length === 2) return 'grep-q';
  if (s.file === 'xargs' && s.args.length === 0) return 'xargs';
  if (dateChainValue(s, datePy) !== null) return 'date';
  return null;
}

// The state spawn kinds: the meetings script once (argv only), grep -lZE with the pattern as one
// argv element, or a date-chain step of the in-process team step. Returns the kind or null.
const MEETINGS_SCRIPT = path.join(ROOT, 'scripts', 'compute-meetings-intelligence');
function stateKind(s, datePy, roomDir) {
  if (s.fn !== 'spawnSync') return null;
  if (s.file === 'bash' && s.args.length === 2 && s.args[0] === MEETINGS_SCRIPT && s.args[1] === roomDir) return 'meetings';
  if (s.file === 'grep' && s.args[0] === '-lZE' && s.args[1] === '--' && s.args.length >= 4) return 'grep-files';
  if (dateChainValue(s, datePy) !== null) return 'date';
  return null;
}

function addAnalyzeArtifacts(roomDir, n) {
  for (let i = 0; i < n; i += 1) {
    const id = String(i).padStart(2, '0');
    fs.writeFileSync(path.join(roomDir, 'problem-definition', 'extra-' + id + '.md'),
      '---\nmethodology: porter\n---\n# Extra ' + id + '\n\n## Pricing signal ' + id + '\n\n' +
      'A **bold claim ' + id + '** about [[market-analysis]] and its buyers.\n');
  }
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

  let edgeAnalyze = -1;
  await leg('analyze edge: run(analyze) spawns exactly EDGE_ANALYZE_SPAWNS (' + EDGE_ANALYZE_SPAWNS + ') processes', async () => {
    const copy = path.join(oracle.mkTmp('spawn-aedge'), 'room');
    oracle.copyRoom(edge.roomDir, copy);
    const r = await recordMode('analyze', copy);
    assert.equal(r.res.code, 0, 'exit code');
    r.spawns.forEach((sp) => console.log('    spawn: ' + describe(sp).slice(0, 160)));
    const kinds = r.spawns.map((sp) => analyzeKind(sp, r.mods.scan.DATE_PY_PROGRAM));
    assert.ok(kinds.every((k) => k !== null), 'every spawn is grep, xargs or a date-chain step');
    checkPrograms(r.spawns, r.mods);
    const count = (k) => kinds.filter((x) => x === k).length;
    assert.equal(count('grep-files'), 2, 'two grep spawns for market.analysis');
    r.spawns.filter((sp) => sp.file === 'grep').forEach((sp) => assert.ok(sp.args[2].includes('market.analysis'), 'the grep pattern names market.analysis'));
    assert.equal(count('xargs'), 1, 'one xargs spawn (the status value -n)');
    assert.equal(count('date'), 2, 'one date -d per distinct funding last_updated value');
    edgeAnalyze = r.spawns.length;
    console.log('    spawn count ' + edgeAnalyze + ' (EDGE_ANALYZE_SPAWNS ' + EDGE_ANALYZE_SPAWNS + ')');
    assert.equal(edgeAnalyze, EDGE_ANALYZE_SPAWNS, 'spawn count');
    assert.deepEqual(r.cwdFiles, [], 'no file appears in the run cwd');
  });

  await leg('analyze edge plus 50 artifacts: the same spawn count (zero per-file spawns)', async () => {
    const copy = path.join(oracle.mkTmp('spawn-aedge50'), 'room');
    oracle.copyRoom(edge.roomDir, copy);
    addAnalyzeArtifacts(copy, 50);
    const r = await recordMode('analyze', copy);
    assert.equal(r.res.code, 0, 'exit code');
    assert.ok(r.spawns.every((sp) => analyzeKind(sp, r.mods.scan.DATE_PY_PROGRAM) !== null), 'every spawn is grep, xargs or a date-chain step');
    checkPrograms(r.spawns, r.mods);
    console.log('    spawn count ' + r.spawns.length + ' with 50 extra artifacts (edge ' + edgeAnalyze + ')');
    assert.equal(r.spawns.length, EDGE_ANALYZE_SPAWNS, 'spawn count with 50 extra artifacts');
  });

  await leg('analyze hostile: grep, xargs and date-chain spawns only, no node, no payload reaches python3, no marker', async () => {
    const copy = path.join(oracle.mkTmp('spawn-ahostile'), 'room');
    oracle.copyRoom(hostile.roomDir, copy);
    const r = await recordMode('analyze', copy);
    assert.equal(r.res.code, 0, 'exit code');
    r.spawns.forEach((sp) => console.log('    spawn: ' + describe(sp).slice(0, 160)));
    checkPrograms(r.spawns, r.mods);
    const seen = new Map();
    r.spawns.forEach((sp) => {
      const kind = analyzeKind(sp, r.mods.scan.DATE_PY_PROGRAM);
      assert.ok(kind !== null, 'grep, xargs or a date-chain step: ' + describe(sp));
      if (kind === 'date') {
        const v = dateChainValue(sp, r.mods.scan.DATE_PY_PROGRAM);
        const k = sp.file + ' ' + sp.args[0] + '\u0000' + v;
        assert.ok(!seen.has(k), 'each date step runs once per distinct value: ' + describe(sp));
        seen.set(k, true);
      }
      if (path.basename(sp.file).startsWith('python')) {
        const v = dateChainValue(sp, r.mods.scan.DATE_PY_PROGRAM) || '';
        hostile.markers.forEach((m) => assert.ok(!v.includes(m), 'no payload value reaches python3'));
      }
    });
    console.log('    spawn count ' + r.spawns.length);
    assert.deepEqual(r.cwdFiles, [], 'no file appears in the run cwd');
    hostile.markers.forEach((m) => {
      assert.ok(!fs.existsSync(path.join(copy, m)), 'no marker in the room: ' + m);
    });
  });

  let edgeState = -1;
  await leg('state edge: run(state) spawns exactly EDGE_STATE_SPAWNS (' + EDGE_STATE_SPAWNS + ') processes', async () => {
    const copy = path.join(oracle.mkTmp('spawn-sedge'), 'room');
    oracle.copyRoom(edge.roomDir, copy);
    const r = await recordMode('state', copy);
    assert.equal(r.res.code, 0, 'exit code');
    assert.ok(String(r.res.stdout).includes('# Data Room State'), 'STATE.md text printed');
    r.spawns.forEach((sp) => console.log('    spawn: ' + describe(sp).slice(0, 160)));
    const kinds = r.spawns.map((sp) => stateKind(sp, r.mods.scan.DATE_PY_PROGRAM, copy));
    assert.ok(kinds.every((k) => k !== null), 'every spawn is the meetings script, grep -lZE or a date-chain step');
    checkPrograms(r.spawns, r.mods);
    const count = (k) => kinds.filter((x) => x === k).length;
    assert.equal(count('meetings'), 1, 'one compute-meetings-intelligence spawn');
    assert.equal(count('grep-files'), 1, 'one grep spawn for market.analysis');
    r.spawns.filter((sp) => sp.file === 'grep').forEach((sp) => assert.ok(sp.args[2].includes('market.analysis'), 'the grep pattern names market.analysis'));
    assert.equal(count('date'), EDGE_TEAM_SPAWNS, 'the team step date chain, as in the team leg');
    edgeState = r.spawns.length;
    console.log('    spawn count ' + edgeState + ' (EDGE_STATE_SPAWNS ' + EDGE_STATE_SPAWNS + ')');
    assert.equal(edgeState, EDGE_STATE_SPAWNS, 'spawn count');
    assert.deepEqual(r.cwdFiles, [], 'no file appears in the run cwd');
  });

  await leg('state edge plus 50 artifacts: the same spawn count (zero per-file spawns)', async () => {
    const copy = path.join(oracle.mkTmp('spawn-sedge50'), 'room');
    oracle.copyRoom(edge.roomDir, copy);
    addAnalyzeArtifacts(copy, 50);
    const r = await recordMode('state', copy);
    assert.equal(r.res.code, 0, 'exit code');
    assert.ok(r.spawns.every((sp) => stateKind(sp, r.mods.scan.DATE_PY_PROGRAM, copy) !== null), 'every spawn is the meetings script, grep -lZE or a date-chain step');
    checkPrograms(r.spawns, r.mods);
    console.log('    spawn count ' + r.spawns.length + ' with 50 extra artifacts (edge ' + edgeState + ')');
    assert.equal(r.spawns.length, EDGE_STATE_SPAWNS, 'spawn count with 50 extra artifacts');
  });

  await leg('state hostile: meetings, grep and date-chain spawns only, no node, no payload reaches python3, no marker', async () => {
    const copy = path.join(oracle.mkTmp('spawn-shostile'), 'room');
    oracle.copyRoom(hostile.roomDir, copy);
    const r = await recordMode('state', copy);
    assert.equal(r.res.code, 0, 'exit code');
    r.spawns.forEach((sp) => console.log('    spawn: ' + describe(sp).slice(0, 160)));
    checkPrograms(r.spawns, r.mods);
    const seen = new Map();
    r.spawns.forEach((sp) => {
      const kind = stateKind(sp, r.mods.scan.DATE_PY_PROGRAM, copy);
      assert.ok(kind !== null, 'the meetings script, grep -lZE or a date-chain step: ' + describe(sp));
      if (kind === 'date') {
        const v = dateChainValue(sp, r.mods.scan.DATE_PY_PROGRAM);
        const k = sp.file + ' ' + sp.args[0] + '\u0000' + v;
        assert.ok(!seen.has(k), 'each date step runs once per distinct value: ' + describe(sp));
        seen.set(k, true);
      }
      if (path.basename(sp.file).startsWith('python')) {
        const v = dateChainValue(sp, r.mods.scan.DATE_PY_PROGRAM) || '';
        hostile.markers.forEach((m) => assert.ok(!v.includes(m), 'no payload value reaches python3'));
      }
    });
    console.log('    spawn count ' + r.spawns.length);
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
