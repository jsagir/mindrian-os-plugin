'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 381 Plan 01 (PERF381-01, PERF381-05) -- the OLD vs NEW parity gate.
 *
 * OLD is "git archive" of BASE_SHA (tests/helpers/oracle-381.cjs). NEW is the scripts of this
 * tree (or --new-tree, or --direct for lib/core/room-render.cjs). For every script (compute-team,
 * compute-state, analyze-room) and every gate room the harness runs both sides on fresh "cp -a"
 * copies under a clean env (LC_ALL=C.UTF-8, pinned TZ, net guard preloaded) and compares stdout
 * bytes, exit code and the full post-run tree content. Only the "computed:" timestamp lines and
 * the FUND_STALE day digits are normalized.
 *
 * Modes:
 *   (default)          OLD vs NEW on every gate room, all three scripts
 *   --self-check       OLD vs OLD (determinism), OLD vs the HEAD scripts, then --prove-fail
 *   --prove-fail       mutate one byte in a copy of OLD; the harness must report a DIFF
 *   --determinism      OLD vs OLD only
 *   --new-tree <dir>   NEW runs the scripts of <dir>
 *   --direct           NEW runs node lib/core/room-render.cjs <mode> (SKIP when it is absent)
 *   --legacy-switch    NEW is the HEAD scripts with MINDRIAN_LEGACY_COMPUTE=1; prints
 *                      "SKIP legacy bodies removed (381-09)" and exits 0 when scripts/compute-team
 *                      no longer reads MINDRIAN_LEGACY_COMPUTE (plan 381-09 removed the bodies)
 *   --only a[,b]       compute-team | compute-state | analyze-room
 *   --room <path>      an extra source room (repeatable), copied read-only
 *   --fixtures-only    only the repository fixture rooms
 *   --until <line>     compare stdout only before the first line equal to <line>
 *   --no-tree          skip the tree compare (renderer not complete yet)
 *   --tz <zone|host>   default UTC
 *   --mtime <stagger|equal>
 *   --report <md>      write a markdown table
 *   --keep             keep the temp dirs and print their paths
 *
 * The divergence room is never a gate room here. Exit 0 only when there are 0 diffs.
 * Plain node, zero deps. Hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const oracle = require(path.join(ROOT, 'tests', 'helpers', 'oracle-381.cjs'));
const builders = require(path.join(ROOT, 'tests', 'fixtures', 'room-381', 'build-fixture.cjs'));

const ALL_SCRIPTS = ['compute-team', 'compute-state', 'analyze-room'];

function parseArgs(argv) {
  const o = {
    selfCheck: false, proveFail: false, determinism: false, newTree: null, direct: false,
    legacy: false, only: null, rooms: [], fixturesOnly: false, until: null, noTree: false,
    tz: 'UTC', mtime: 'stagger', report: null, keep: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    switch (a) {
      case '--self-check': o.selfCheck = true; break;
      case '--prove-fail': o.proveFail = true; break;
      case '--determinism': o.determinism = true; break;
      case '--new-tree': o.newTree = path.resolve(argv[++i]); break;
      case '--direct': o.direct = true; break;
      case '--legacy-switch': o.legacy = true; break;
      case '--only': o.only = String(argv[++i]).split(',').filter(Boolean); break;
      case '--room': o.rooms.push(path.resolve(argv[++i])); break;
      case '--fixtures-only': o.fixturesOnly = true; break;
      case '--until': o.until = argv[++i]; break;
      case '--no-tree': o.noTree = true; break;
      case '--tz': o.tz = argv[++i]; break;
      case '--mtime': o.mtime = argv[++i]; break;
      case '--report': o.report = path.resolve(argv[++i]); break;
      case '--keep': o.keep = true; break;
      default:
        process.stderr.write('test-381-parity: unknown flag: ' + a + '\n');
        process.exit(2);
    }
  }
  if (o.only) {
    o.only.forEach((s) => {
      if (!ALL_SCRIPTS.includes(s)) {
        process.stderr.write('test-381-parity: unknown script in --only: ' + s + '\n');
        process.exit(2);
      }
    });
  }
  return o;
}

function say(line) {
  process.stdout.write(line + '\n');
}

// ---------------------------------------------------------------------------
// gate rooms
// ---------------------------------------------------------------------------
function collectRooms(opts, scratch) {
  const rooms = [];
  let hardFail = 0;
  const hardCheck = (label, dir) => {
    const found = oracle.gatePrecondition(dir);
    if (found.length) {
      hardFail += 1;
      say('PRECONDITION FAIL ' + label + ' carries a divergence shape: ' + found.join('; '));
    }
  };
  if (!opts.fixturesOnly) {
    const edge = builders.buildEdgeRoom(scratch, {});
    const hostile = builders.buildHostileRoom(scratch, {});
    const bad = builders.buildBadStageRoom(scratch);
    const small = builders.buildSmallRooms(scratch);
    rooms.push({ label: 'edge-room', src: edge.roomDir, kind: 'edge' });
    rooms.push({ label: 'hostile-room', src: hostile.roomDir, kind: 'hostile' });
    rooms.push({ label: 'bad-stage-room', src: bad.roomDir, kind: 'bad' });
    rooms.push({ label: 'empty-room', src: small.emptyRoom, kind: 'small' });
    rooms.push({ label: 'team-no-profiles', src: small.teamNoProfiles, kind: 'small' });
    rooms.push({ label: 'missing-room', src: small.missingRoom, kind: 'small' });
    rooms.forEach((r) => hardCheck(r.label, r.src));
  }
  oracle.FIXTURE_ROOMS.forEach((name) => {
    const dir = path.join(ROOT, 'tests', 'fixtures', name);
    let st = null;
    try { st = fs.statSync(dir); } catch (_e) { st = null; }
    if (!st) { say('NOTE skip ' + name + ': missing'); return; }
    if (!st.isDirectory()) { say('NOTE skip ' + name + ': not a directory'); return; }
    rooms.push({ label: name, src: dir, kind: 'fixture' });
  });
  if (!opts.fixturesOnly) {
    opts.rooms.forEach((dir) => {
      let st = null;
      try { st = fs.statSync(dir); } catch (_e) { st = null; }
      if (!st || !st.isDirectory()) { say('NOTE skip ' + dir + ': not a directory'); return; }
      rooms.push({ label: 'room-copy:' + path.basename(dir), src: dir, kind: 'extra' });
    });
  }
  rooms.filter((r) => r.kind === 'fixture' || r.kind === 'extra').forEach((r) => {
    oracle.gatePrecondition(r.src).forEach((shape) => {
      say('NOTE ' + r.label + ' carries ' + shape + ' (ruling 2 divergence)');
    });
  });
  return { rooms, hardFail };
}

// ---------------------------------------------------------------------------
// one suite = every pair of OLD against a NEW side
// ---------------------------------------------------------------------------
function runSuite(name, rooms, scripts, oldSide, newSide, opts, report) {
  say('== ' + name + ' ==');
  let pairs = 0;
  let diffs = 0;
  const runOne = (script, label, src, extra) => {
    const o = Object.assign({
      script, srcRoom: src, oldSide, newSide, until: opts.until, mtimeMode: opts.mtime,
      tz: opts.tz, noTree: opts.noTree,
    }, extra || {});
    const r = oracle.comparePair(o);
    pairs += 1;
    if (r.ok) {
      say('PARITY ' + script + ' ' + label + ' OK ' + r.oldMs + ' ' + r.newMs);
    } else {
      diffs += 1;
      say('PARITY ' + script + ' ' + label + ' DIFF ' + r.diffs[0]);
      r.diffs.slice(0, 20).forEach((l) => say('    ' + l));
    }
    report.push({ suite: name, script, room: label, ok: r.ok, oldMs: r.oldMs, newMs: r.newMs, diff: r.ok ? '' : r.diffs.slice(0, 3).join(' / ') });
  };
  rooms.forEach((room) => {
    scripts.forEach((script) => runOne(script, room.label, room.src));
    if (room.kind === 'edge' && scripts.includes('compute-state')) {
      runOne('compute-state', room.label + '[mtime-equal]', room.src, { mtimeMode: 'equal' });
      runOne('compute-state', room.label + '[no-registry]', room.src, { registry: false });
    }
  });
  say(name + ': ' + diffs + ' diffs in ' + pairs + ' pairs');
  return { pairs, diffs };
}

// ---------------------------------------------------------------------------
// prove-fail: a one-byte change in a copy of OLD must show up as a DIFF
// ---------------------------------------------------------------------------
function proveFail(opts, scratch) {
  const oldTree = oracle.buildOldTree(oracle.BASE_SHA);
  const mut = oracle.mkTmp('mutated');
  const cp = spawnSync('cp', ['-a', oldTree + '/.', mut], { encoding: 'utf8' });
  if (cp.status !== 0) {
    say('PROVE-FAIL BROKEN: could not copy the OLD tree: ' + String(cp.stderr || '').trim());
    return false;
  }
  const script = path.join(mut, 'scripts', 'analyze-room');
  const src = fs.readFileSync(script, 'utf8');
  const marker = 'echo "## End"';
  if (!src.includes(marker)) {
    say('PROVE-FAIL BROKEN: the anchor line is absent from scripts/analyze-room');
    return false;
  }
  fs.writeFileSync(script, src.split(marker).join('echo "## End."'));
  const edge = builders.buildEdgeRoom(scratch, {});
  const r = oracle.comparePair({
    script: 'analyze-room', srcRoom: edge.roomDir,
    oldSide: { tree: oldTree }, newSide: { tree: mut },
    mtimeMode: opts.mtime, tz: opts.tz, noTree: false,
  });
  if (!r.ok) {
    say('PROVE-FAIL OK (expected DIFF: ' + r.diffs[0] + ')');
    return true;
  }
  say('PROVE-FAIL BROKEN: the harness did not detect a one-byte change');
  return false;
}

function writeReport(file, report, total) {
  const lines = ['# Phase 381 parity report', '', 'BASE_SHA: ' + oracle.BASE_SHA, '', total, '',
    '| suite | script | room | result | OLD ms | NEW ms | first diff |', '|---|---|---|---|---|---|---|'];
  report.forEach((r) => {
    lines.push('| ' + [r.suite, r.script, r.room, r.ok ? 'OK' : 'DIFF', r.oldMs, r.newMs, String(r.diff).replace(/\|/g, '/')].join(' | ') + ' |');
  });
  fs.writeFileSync(file, lines.join('\n') + '\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const newTree = opts.newTree || ROOT;

  if (opts.direct && !fs.existsSync(path.join(newTree, 'lib', 'core', 'room-render.cjs'))) {
    say('SKIP direct: lib/core/room-render.cjs absent');
    return 0;
  }
  if (opts.legacy && !fs.readFileSync(path.join(newTree, 'scripts', 'compute-team'), 'utf8').includes('MINDRIAN_LEGACY_COMPUTE')) {
    say('SKIP legacy bodies removed (381-09)');
    return 0;
  }

  oracle.setKeep(opts.keep);
  const scripts = opts.only || ALL_SCRIPTS;
  const scratch = oracle.mkTmp('fixtures');
  const report = [];
  let code = 0;
  try {
    if (opts.proveFail && !opts.selfCheck) {
      return proveFail(opts, scratch) ? 0 : 1;
    }
    const oldSide = { tree: oracle.buildOldTree(oracle.BASE_SHA) };
    const newSide = { tree: newTree, direct: opts.direct, env: opts.legacy ? { MINDRIAN_LEGACY_COMPUTE: '1' } : {} };
    say('BASE_SHA ' + oracle.BASE_SHA);
    const { rooms, hardFail } = collectRooms(opts, scratch);
    let totalPairs = 0;
    let totalDiffs = hardFail;
    if (hardFail) code = 1;

    if (opts.selfCheck || opts.determinism) {
      const d = runSuite('determinism (OLD vs OLD)', rooms, scripts, oldSide, oldSide, opts, report);
      totalPairs += d.pairs;
      totalDiffs += d.diffs;
    }
    if (!opts.determinism) {
      const h = runSuite(opts.selfCheck ? 'OLD vs HEAD scripts' : 'OLD vs NEW', rooms, scripts, oldSide, newSide, opts, report);
      totalPairs += h.pairs;
      totalDiffs += h.diffs;
    }
    if (opts.selfCheck) {
      if (!proveFail(opts, scratch)) code = 1;
    }
    const last = 'parity: ' + totalDiffs + ' diffs in ' + totalPairs + ' pairs';
    if (opts.report) writeReport(opts.report, report, last);
    if (opts.keep) say('kept temp dirs under ' + require('node:os').tmpdir() + ' (prefix oracle-381-)');
    say(last);
    if (totalDiffs > 0) code = 1;
    return code;
  } finally {
    oracle.cleanupTmp();
  }
}

process.exitCode = main();
