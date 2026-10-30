#!/usr/bin/env node
'use strict';

/**
 * Regression (quick 261030-8vd): the Stop hook Phase 88 recompile block waits
 * only on the recompile PIDs, and its 1 s watcher is a working timeout.
 *
 * Why (base commit 861ae9c59):
 *   F-1  The old block ran `wait $(jobs -p)`. The job list also held the 1 s
 *        watcher, so every stop waited the full second, also when the
 *        recompiles ended in about 0.1 s.
 *   P-4  Inside the watcher subshell `$(jobs -p)` is empty, so the old
 *        watcher ran `kill` with no PID and killed nothing.
 *   P-5  A watcher subshell that keeps the hook stdout open holds the pipe of
 *        its reader until its orphaned `sleep 1` ends. The new watcher sends
 *        its output to /dev/null.
 *
 * Method (DD-1): the test extracts the block from scripts/on-stop between two
 * existing comment anchors (start line included, end line excluded) and runs
 * it in a bash harness under `set -euo pipefail`. Whole-hook coverage stays
 * with the other Stop suites. Wall time is measured around spawnSync with
 * pipes, so a held pipe counts.
 *
 * Arms: S1 static shape, S2 file checks, B1 speed with 15 sections, B2 hang
 * that honors SIGTERM, B3 hang that ignores SIGTERM, B4 no ROOM.md.
 *
 * Zero test frameworks. Node built-in modules only. CJS only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REAL_ROOT = path.resolve(__dirname, '..');
const ON_STOP = path.join(REAL_ROOT, 'scripts', 'on-stop');
const START_ANCHOR = '# 2. Recompile ROOM.md references';
const END_ANCHOR = '# 3-5. Walk sections, readTriple per section';

let failed = 0;
function check(name, fn) {
  try {
    const extra = fn();
    process.stdout.write('  ok ' + name + (extra ? ' ' + extra : '') + '\n');
  } catch (err) {
    failed += 1;
    process.stderr.write('  FAIL ' + name + '\n    ' +
      (err && err.message ? err.message : err) + '\n');
  }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

const lines = fs.readFileSync(ON_STOP, 'utf8').split('\n');
function findAll(text) {
  const out = [];
  lines.forEach((l, i) => { if (l.includes(text)) out.push(i); });
  return out;
}
const starts = findAll(START_ANCHOR);
const ends = findAll(END_ANCHOR);
const anchorsOk = starts.length === 1 && ends.length === 1 && starts[0] < ends[0];
const block = anchorsOk ? lines.slice(starts[0], ends[0]) : [];

// ---------------------------------------------------------------------------
// S1 static shape, S2 file checks
// ---------------------------------------------------------------------------
check('S1 block shape: waits on RECOMPILE_PIDS, guarded, watcher kills the list', () => {
  need(anchorsOk, 'anchors not found once each');
  const code = block.filter((l) => !/^\s*#/.test(l));
  const text = code.join('\n');
  const mustHave = [
    'RECOMPILE_PIDS=()',
    'RECOMPILE_PIDS+=("$!")',
    '${RECOMPILE_PIDS[0]+set}',
    'wait "${RECOMPILE_PIDS[@]}"',
    'timeout 0.4 node',
  ];
  for (const s of mustHave) need(text.includes(s), 'missing: ' + s);
  const sleepLines = code.filter((l) => l.includes('sleep 1'));
  need(sleepLines.length === 1, 'expected 1 line with sleep 1, got ' + sleepLines.length);
  need(sleepLines[0].includes('kill "${RECOMPILE_PIDS[@]}"'), 'watcher line does not kill the PID list');
  need(/>\/dev\/null 2>&1 &\s*$/.test(sleepLines[0]), 'watcher line does not end with >/dev/null 2>&1 &');
  const banned = ['jobs -p', 'wait -n', 'declare -A', 'mapfile', 'readarray'];
  for (const s of banned) need(!text.includes(s), 'banned text present: ' + s);
});

check('S2 file: anchors once, bash -n, line budget', () => {
  need(anchorsOk, 'anchors not found once each, or start is not before end');
  const syn = spawnSync('bash', ['-n', ON_STOP], { encoding: 'utf8' });
  need(syn.status === 0, 'bash -n failed: ' + syn.stderr);
  const audit = require('../lib/mcp/hook-adapter-audit.cjs');
  const r = audit.lineCountBudget({ surfaces: ['scripts/on-stop'] });
  need(r.pass === true, 'lineCountBudget failed: ' + JSON.stringify(r));
});

// ---------------------------------------------------------------------------
// Behavior arms
// ---------------------------------------------------------------------------
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), '8vd-'));
const PID_DIR = path.join(TMP, 'pids');
const HARNESS = path.join(TMP, 'harness.sh');

function writeHarness() {
  const body = [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'ROOM_DIR="$1"',
    'SCRIPT_DIR="$2"',
    ...block,
    'exit 0',
    '',
  ].join('\n');
  fs.writeFileSync(HARNESS, body, { mode: 0o755 });
}

function makeRoom(name, count, withRoomMd) {
  const room = path.join(TMP, name);
  for (let i = 1; i <= count; i += 1) {
    const dir = path.join(room, 's' + String(i).padStart(2, '0'));
    fs.mkdirSync(dir, { recursive: true });
    if (withRoomMd) {
      fs.writeFileSync(path.join(dir, 'ROOM.md'),
        '---\nname: Section ' + i + '\n---\n\n# Section ' + i + '\n\nBody text.\n');
    }
  }
  return room;
}

function makeStub(name, source) {
  const dir = path.join(TMP, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'recompile-room-references.cjs'), source);
  return dir;
}

function runBlock(room, scriptDir) {
  const t0 = process.hrtime.bigint();
  const r = spawnSync('bash', [HARNESS, room, scriptDir], {
    encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const ms = Math.round(Number(process.hrtime.bigint() - t0) / 1e6);
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, ms };
}

const hasTimeout = spawnSync('bash', ['-c', 'command -v timeout'], { encoding: 'utf8' }).status === 0;

function main() {
  if (!anchorsOk) {
    process.stderr.write('  FAIL B-arms: anchors not found, behavior arms skipped\n');
    failed += 1;
    return;
  }
  writeHarness();
  const realScripts = path.join(REAL_ROOT, 'scripts');

  check('B1 speed: 15 sections, real recompiler, median under 600 ms', () => {
    const room = makeRoom('room15', 15, true);
    const runs = [];
    for (let i = 0; i < 3; i += 1) {
      const r = runBlock(room, realScripts);
      need(r.status === 0, 'run ' + i + ' exit ' + r.status);
      need(r.stdout === '', 'run ' + i + ' stdout not empty: ' + r.stdout);
      runs.push(r.ms);
    }
    const sorted = runs.slice().sort((a, b) => a - b);
    const med = sorted[1];
    const wrote = fs.readdirSync(room).filter((d) => /^s\d\d$/.test(d)).some((d) =>
      fs.readFileSync(path.join(room, d, 'ROOM.md'), 'utf8').includes('<!-- BEGIN REFERENCES -->'));
    need(med < 600, 'median ' + med + ' ms is not under 600 ms (runs ' + runs.join(',') + ')');
    need(wrote, 'no fixture ROOM.md holds BEGIN REFERENCES (the recompiler did not run)');
    return '(runs ' + runs.join(', ') + ' ms, median ' + med + ' ms)';
  });

  if (!hasTimeout) {
    process.stdout.write('  SKIP B2, B3: no timeout binary\n');
  } else {
    check('B2 hang that honors SIGTERM: exit 0 under 1300 ms', () => {
      const room = makeRoom('room3hang', 3, true);
      const stub = makeStub('stub-term',
        "'use strict';\nsetTimeout(() => {}, 5000);\n");
      const r = runBlock(room, stub);
      need(r.status === 0, 'exit ' + r.status);
      need(r.ms < 1300, 'wall ' + r.ms + ' ms is not under 1300 ms');
      return '(' + r.ms + ' ms)';
    });

    check('B3 hang that ignores SIGTERM: freed by the watcher, exit 0 under 1300 ms', () => {
      const room = makeRoom('room3ign', 3, true);
      fs.mkdirSync(PID_DIR, { recursive: true });
      const stub = makeStub('stub-ign',
        "'use strict';\nconst fs = require('node:fs');\n" +
        "fs.writeFileSync(" + JSON.stringify(PID_DIR) + " + '/' + process.pid, '');\n" +
        "process.on('SIGTERM', () => {});\nsetTimeout(() => {}, 3000);\n");
      const r = runBlock(room, stub);
      need(r.status === 0, 'exit ' + r.status);
      need(r.ms < 1300, 'wall ' + r.ms + ' ms is not under 1300 ms');
      return '(' + r.ms + ' ms)';
    });
  }

  check('B4 no ROOM.md: exit 0, empty output, under 600 ms', () => {
    const room = makeRoom('room0', 3, false);
    const r = runBlock(room, realScripts);
    need(r.status === 0, 'exit ' + r.status);
    need(r.stdout === '' && r.stderr === '', 'output not empty: ' + r.stdout + r.stderr);
    need(r.ms < 600, 'wall ' + r.ms + ' ms is not under 600 ms');
    return '(' + r.ms + ' ms)';
  });
}

try {
  main();
} finally {
  try {
    for (const f of fs.readdirSync(PID_DIR)) {
      try { process.kill(Number(f), 'SIGKILL'); } catch (_) { /* gone */ }
    }
  } catch (_) { /* no pid dir */ }
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

if (failed === 0) {
  process.stdout.write('onstop-wait: ALL PASS\n');
  process.exit(0);
}
process.stdout.write('onstop-wait: ' + failed + ' FAILED\n');
process.exit(1);
