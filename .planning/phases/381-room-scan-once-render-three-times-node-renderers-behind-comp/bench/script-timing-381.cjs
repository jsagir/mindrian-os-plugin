'use strict';
/**
 * script-timing-381.cjs - per-script wall time on a COPY of a room (phase 381, plan 02).
 * Usage: node script-timing-381.cjs --script <compute-team|compute-state|analyze-room|compute-meetings-intelligence>
 *          --side <old|new> [--runs 3] [--source <room>] [--copy <dir>] [--refresh]
 * OLD = the BASE_SHA tree (git archive); NEW = this repo root. Scripts run only on the copy;
 * --source is read by cp -a and never passed to a script (threat T-381-03).
 * Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const oracle = require(path.join(REPO, 'tests', 'helpers', 'oracle-381.cjs'));
const { assertSafeTarget } = require(path.join(REPO, 'tests', 'fixtures', 'room-381', 'build-fixture.cjs'));

const SCRIPTS = ['compute-team', 'compute-state', 'analyze-room', 'compute-meetings-intelligence'];
// The source room is given by the environment (MOS_REAL_ROOM_381) or --source, never hard-coded: a room folder name is private room content.
const REAL_ROOM = process.env.MOS_REAL_ROOM_381 || null;
const DEFAULT_COPY = '/mnt/c/Users/jsagi/AppData/Local/Temp/mos-381-bench/room';

function parseArgs(argv) {
  const o = { script: null, side: null, runs: 3, source: REAL_ROOM, copy: DEFAULT_COPY, refresh: false };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--script': o.script = argv[++i]; break;
      case '--side': o.side = argv[++i]; break;
      case '--runs': o.runs = Number(argv[++i]); break;
      case '--source': o.source = path.resolve(argv[++i]); break;
      case '--copy': o.copy = path.resolve(argv[++i]); break;
      case '--refresh': o.refresh = true; break;
      default: throw new Error('unknown argument: ' + argv[i]);
    }
  }
  if (SCRIPTS.indexOf(o.script) < 0) throw new Error('--script must be one of ' + SCRIPTS.join(', '));
  if (o.side !== 'old' && o.side !== 'new') throw new Error('--side must be old or new');
  if (!(o.runs >= 1)) throw new Error('--runs must be at least 1');
  return o;
}

function load1() {
  try { return fs.readFileSync('/proc/loadavg', 'utf8').split(' ')[0]; } catch (_e) { return 'na'; }
}

function main() {
  const o = parseArgs(process.argv.slice(2));
  assertSafeTarget(path.dirname(o.copy));
  assertSafeTarget(o.copy);
  if (o.refresh) fs.rmSync(o.copy, { recursive: true, force: true });
  if (!fs.existsSync(o.copy)) {
    if (!o.source) { console.error('script-timing-381: no source room; set MOS_REAL_ROOM_381 or pass --source <room>'); process.exit(2); }
    fs.mkdirSync(path.dirname(o.copy), { recursive: true });
    oracle.copyRoom(o.source, o.copy);
  }
  const tree = o.side === 'old' ? oracle.buildOldTree(oracle.BASE_SHA) : REPO;
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'st381-home-'));
  const roomsHome = fs.mkdtempSync(path.join(os.tmpdir(), 'st381-rooms-'));
  const env = oracle.cleanEnv({ home, roomsHome, tz: 'host' });
  delete env.NODE_OPTIONS; // the net-guard preload would add start cost to every node spawn
  delete env.NET_GUARD_381_LOG;
  const script = path.join(tree, 'scripts', o.script);
  const run = () => {
    const t0 = process.hrtime.bigint();
    const r = spawnSync('bash', [script, o.copy], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 });
    return { ms: Number(process.hrtime.bigint() - t0) / 1e6, code: r.status };
  };
  const warm = run(); // warm-up, not counted
  const times = [];
  let code = 0;
  for (let i = 0; i < o.runs; i++) { const r = run(); times.push(r.ms); if (r.code !== 0) code = r.code; }
  const sorted = times.slice().sort((a, b) => a - b);
  const head = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).stdout.trim();
  console.log('script=' + o.script + ' side=' + o.side + ' runs=' + o.runs + ' median_ms=' + sorted[Math.floor(sorted.length / 2)].toFixed(0) +
    ' min_ms=' + sorted[0].toFixed(0) + ' max_ms=' + sorted[sorted.length - 1].toFixed(0) + ' exit=' + code +
    ' load1=' + load1() + ' head=' + head + ' warmup_ms=' + warm.ms.toFixed(0) + ' warmup_exit=' + warm.code + ' runs_ms=[' + times.map((x) => x.toFixed(0)).join(',') + ']');
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(roomsHome, { recursive: true, force: true });
  oracle.cleanupTmp();
}

main();
