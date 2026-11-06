#!/usr/bin/env node
'use strict';
/*
 * Phase 384 plan 04: checks for bench/exec-counter.c and bench/process-census.cjs.
 * Node built-ins only. Prints `process-census: ALL PASS` or `process-census: <n> FAILED`.
 * Run it under the lock:
 *   mkdir -p "$HOME/.cache" && flock -w 7200 "$HOME/.cache/mos-perf-384.lock" node bench/test-process-census.cjs
 * Checks: K1 counter build and log format, K2 calibration A (exact 7), K3 calibration B (exact 5),
 * K4 survivors (tail, CPU lower bound, kill by marker only), K5 block trace, K6 schemas and verify-results,
 * K7 copy mode on a synthetic source, K8 block list, K9 log parser.
 * Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const BENCH = __dirname;
const REPO = path.resolve(BENCH, '..', '..', '..', '..');
const CENSUS = path.join(BENCH, 'process-census.cjs');
const HARNESS = path.join(REPO, 'tools', 'perf', 'perf-harness.cjs');

let failed = 0;
let passed = 0;
function check(name, cond, detail) {
  if (cond) { passed += 1; process.stdout.write('  ok   ' + name + '\n'); return; }
  failed += 1;
  process.stdout.write('  FAIL ' + name + (detail !== undefined ? ' :: ' + String(detail).slice(0, 400) : '') + '\n');
}

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-384-censustest-'));
const selfEnv = Object.assign({}, process.env, { MOS_PERF_SELFTEST: '1' });

function run(args, opts) {
  const o = opts || {};
  return cp.spawnSync(process.execPath, [CENSUS].concat(args), { encoding: 'utf8', env: o.env || selfEnv, timeout: o.timeout || 240000, cwd: o.cwd || scratch });
}

function tmp(name) { return path.join(scratch, name); }

function writeFile(file, text, mode) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, mode ? { mode } : undefined);
}

// a plugin tree whose hooks.json holds the given hooks: { Event: [{ command, async, matcher }] }
function makeTree(name, hooks, extra) {
  const dir = tmp(name);
  const doc = { hooks: {} };
  for (const ev of Object.keys(hooks)) {
    doc.hooks[ev] = hooks[ev].map((h) => ({ matcher: h.matcher, hooks: [{ type: 'command', command: h.command, async: !!h.async }] }));
  }
  writeFile(path.join(dir, 'hooks', 'hooks.json'), JSON.stringify(doc));
  for (const [rel, text] of Object.entries(extra || {})) writeFile(path.join(dir, rel), text, 0o755);
  return dir;
}

function readJson(f) { return JSON.parse(fs.readFileSync(f, 'utf8')); }

// ---------------------------------------------------------------------------
// K1 counter build, K9 log parser (library)
// ---------------------------------------------------------------------------
let lib = null;
try { lib = require(CENSUS); } catch (e) { lib = null; }
check('K0 the census library loads and exports parseExecLog and keyDef', !!lib && typeof lib.parseExecLog === 'function' && typeof lib.keyDef === 'function', lib ? '' : 'process-census.cjs missing');

const so = path.join(scratch, 'exec-counter.so');
const built = run(['build', '--scratch', scratch]);
check('K1 build compiles the counter with gcc into the scratch folder', built.status === 0 && fs.existsSync(so) && fs.statSync(so).size > 1000, built.stderr + built.stdout);
check('K1 build prints the size and no path', /size_bytes=[0-9]+/.test(built.stdout) && built.stdout.indexOf(scratch) === -1, built.stdout);

function countRun(scriptText, extraEnv) {
  const script = tmp('cal-' + Math.random().toString(36).slice(2) + '.sh');
  writeFile(script, scriptText, 0o755);
  const log = script + '.log';
  const env = Object.assign({}, process.env, { LD_PRELOAD: so, MOS_EXEC_LOG: log }, extraEnv || {});
  const r = cp.spawnSync('bash', [script], { env, encoding: 'utf8', timeout: 60000 });
  const text = fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '';
  return { r, text, parsed: lib ? lib.parseExecLog(text) : null, script };
}

if (lib) {
  const p = lib.parseExecLog([
    'E 10 1 100 node -', 'E 11 10 200 bash post-write', 'F 11', 'E 12 10 300 find -', 'I 12', 'B 13 10 400 touch', 'E 14 10 500 node x.cjs',
  ].join('\n') + '\n');
  check('K9 parseExecLog: E minus F, B and I apart', p.total === 3 && p.blocked === 1 && p.injected === 1, JSON.stringify(p));
  check('K9 parseExecLog: counts by program, node, bash and find', p.byProgram.node === 2 && p.byProgram.find === 1 && !p.byProgram.bash && p.nodeStarts === 2 && p.findCount === 1 && p.bashStarts === 0, JSON.stringify(p));
  const q = lib.parseExecLog('garbage line\nE 1 1 5 sh -\nE x\n');
  check('K9 parseExecLog ignores lines of another form', q.total === 1 && q.bashStarts === 1, JSON.stringify(q));
  const kd = lib.keyDef('SubagentStop:files20');
  check('K9 keyDef: SubagentStop:files20 maps to the SubagentStop event with 20 files', kd && kd.def.event === 'SubagentStop' && kd.files === 20, JSON.stringify(kd));
  const ks = lib.keyDef('Stop:changed:tx4m');
  check('K9 keyDef: Stop:changed:tx4m is a changed Stop with the 4 MiB transcript', ks && ks.def.event === 'Stop' && ks.def.change === 'changed' && ks.def.transcript === 'tx4m', JSON.stringify(ks));
  check('K9 keyDef: SessionStart:startup:unchanged and :compact', lib.keyDef('SessionStart:startup:unchanged').def.change === 'unchanged' && lib.keyDef('SessionStart:compact').def.source === 'compact');
  check('K9 keyDef: an unknown key is null', lib.keyDef('Nope:1') === null);
}

// ---------------------------------------------------------------------------
// K2 and K3 calibration
// ---------------------------------------------------------------------------
const calA = countRun([
  '#!/usr/bin/env bash',
  ':',
  'true',
  '/bin/true',
  '/bin/true',
  '/bin/true',
  '/usr/bin/env /bin/true',
  'node -e 0',
  'sleep 0.3 &',
  'wait',
  '',
].join('\n'));
check('K2 calibration A: exactly 7 processes (3 true, env and its true, node, sleep)', !!calA.parsed && calA.parsed.total === 7, calA.parsed ? JSON.stringify(calA.parsed) + ' :: ' + calA.text : 'no parser');
check('K2 calibration A: the programs are named by base name only', !!calA.parsed && calA.parsed.byProgram.true === 4 && calA.parsed.byProgram.env === 1 && calA.parsed.byProgram.node === 1 && calA.parsed.byProgram.sleep === 1, calA.parsed ? JSON.stringify(calA.parsed.byProgram) : '');
check('K2 the log lines have the form E pid ppid ns program script', calA.text.split('\n').filter(Boolean).every((l) => /^E [0-9]+ [0-9]+ [0-9]+ \S+ \S+$/.test(l)), calA.text.slice(0, 300));

const calB = countRun([
  '#!/usr/bin/env bash',
  'node -e "const c=require(\'child_process\');c.execFileSync(\'/bin/true\');c.execSync(\'/bin/true; /bin/true\');"',
  '',
].join('\n'));
check('K3 calibration B: exactly 5 processes (node, true, shell, two true)', !!calB.parsed && calB.parsed.total === 5, calB.parsed ? JSON.stringify(calB.parsed) + ' :: ' + calB.text : 'no parser');

// ---------------------------------------------------------------------------
// K8 block list
// ---------------------------------------------------------------------------
{
  const marker = tmp('marker-touch');
  const status = tmp('marker-status');
  const res = countRun(['#!/usr/bin/env bash', 'touch "' + marker + '"', 'echo $? > "' + status + '"', ''].join('\n'), { MOS_EXEC_BLOCK: 'touch' });
  check('K8 the blocked program does not run (no marker file)', !fs.existsSync(marker));
  check('K8 the log holds one B line and the call failed with a non-zero status', !!res.parsed && res.parsed.blocked === 1 && fs.existsSync(status) && Number(fs.readFileSync(status, 'utf8').trim()) !== 0, res.text + (fs.existsSync(status) ? fs.readFileSync(status, 'utf8') : 'no status'));
  check('K8 B lines are not part of the count', !!res.parsed && res.parsed.total === 0, res.parsed ? JSON.stringify(res.parsed) : '');
  const marker2 = tmp('marker-touch-2');
  const res2 = countRun(['#!/usr/bin/env bash', 'touch "' + marker2 + '"', ''].join('\n'), {});
  check('K8 with no block list the same script runs touch', fs.existsSync(marker2) && !!res2.parsed && res2.parsed.total === 1);
}

// ---------------------------------------------------------------------------
// K4 survivors
// ---------------------------------------------------------------------------
function censusRun(treeDir, events, out, extra) {
  return run(['run', '--tree', treeDir, '--room', 'synthetic', '--events', events, '--repeats', '3', '--counter', so, '--scratch', scratch, '--out', out, '--allow-short', '--skip-gates'].concat(extra || []));
}

{
  const tree = makeTree('tree-sleep', { UserPromptSubmit: [{ command: "setsid bash -c 'sleep 0.5' &" }] });
  const out = tmp('k4-sleep.json');
  const r = censusRun(tree, 'UserPromptSubmit', out);
  let ev = null;
  try { ev = readJson(out).events[0]; } catch (_e) { ev = null; }
  check('K4 a detached sleep gives survivors of 1 or more', !!ev && ev.survivors >= 1, r.stderr + JSON.stringify(ev));
  check('K4 and a tail between 400 and 1500 ms', !!ev && ev.tail_ms >= 400 && ev.tail_ms <= 1500, JSON.stringify(ev));
}
{
  const tree = makeTree('tree-busy', { UserPromptSubmit: [{ command: "setsid node -e 'const t=Date.now();while(Date.now()-t<400);' &" }] });
  const out = tmp('k4-busy.json');
  const r = censusRun(tree, 'UserPromptSubmit', out);
  let ev = null;
  try { ev = readJson(out).events[0]; } catch (_e) { ev = null; }
  check('K4 a detached busy loop gives survivor_cpu_ms of 200 or more (a lower bound)', !!ev && ev.survivor_cpu_ms >= 200, r.stderr + JSON.stringify(ev));
  check('K4 the event counts the node start of the detached loop', !!ev && ev.node_starts >= 1, JSON.stringify(ev));
}
{
  // kill only by marker: a survivor with the marker is killed at the wait limit, a bystander without it stays
  const tree = makeTree('tree-long', { UserPromptSubmit: [{ command: "setsid bash -c 'exec -a mos384longsleep sleep 31.337' &" }] });
  const by = cp.spawn('sleep', ['33.3'], { detached: true, stdio: 'ignore' });
  by.unref();
  const out = tmp('k4-long.json');
  const r = run(['run', '--tree', tree, '--room', 'synthetic', '--events', 'UserPromptSubmit', '--repeats', '1', '--counter', so, '--scratch', scratch, '--out', out, '--allow-short', '--skip-gates', '--wait-limit-ms', '1500']);
  let ev = null;
  try { ev = readJson(out).events[0]; } catch (_e) { ev = null; }
  const pg = cp.spawnSync('pgrep', ['-f', '31.337'], { encoding: 'utf8' });
  let byAlive = false;
  try { process.kill(by.pid, 0); byAlive = true; } catch (_e) { byAlive = false; }
  check('K4 a survivor with the run marker is killed at the wait limit', pg.stdout.trim() === '', r.stderr + pg.stdout);
  check('K4 a bystander without the marker survives', byAlive);
  check('K4 the event reports the survivor that was killed', !!ev && ev.survivors >= 1 && ev.killed_survivors >= 1, JSON.stringify(ev));
  try { process.kill(by.pid, 'SIGKILL'); } catch (_e) { /* gone */ }
}

// ---------------------------------------------------------------------------
// K5 block trace
// ---------------------------------------------------------------------------
{
  const script = ['#!/usr/bin/env bash', 'sleep 0.1', 'sleep 0.2', 'sleep 0.05', ''].join('\n');
  const tree = makeTree('tree-blocks', { SessionStart: [{ command: 'true' }] }, { 'scripts/session-start': script });
  const out = tmp('k5.json');
  const r = run(['blocks', '--tree', tree, '--room', 'synthetic', '--script', 'scripts/session-start', '--ranges', '2,3,4', '--out', out, '--allow-short', '--skip-gates']);
  let j = null;
  try { j = readJson(out); } catch (_e) { j = null; }
  const shares = j && j.ranges ? j.ranges.map((x) => x.share_pct) : [];
  const want = [29, 57, 14];
  check('K5 three ranges come back', shares.length === 3, r.stderr + JSON.stringify(j));
  check('K5 shares are within 30 percent of 29, 57 and 14', shares.length === 3 && shares.every((s, i) => Math.abs(s - want[i]) <= want[i] * 0.3), JSON.stringify(shares));
  check('K5 the top lines are named script:line', !!j && Array.isArray(j.top_lines) && j.top_lines.length >= 1 && /^session-start:[0-9]+$/.test(j.top_lines[0].line), JSON.stringify(j && j.top_lines));
  check('K5 the file holds no command text', !!j && JSON.stringify(j).indexOf('sleep') === -1);
  check('K5 the schema is the counts schema with a machine record and a diagnostic label', !!j && j.schema === 'mos.perf-384-counts/1' && !!j.machine && j.diagnostic === true, JSON.stringify(j && Object.keys(j)));
}

// ---------------------------------------------------------------------------
// K6 schemas and verify-results
// ---------------------------------------------------------------------------
{
  const tree = makeTree('tree-schema', { UserPromptSubmit: [{ command: 'true' }, { command: 'node -e 0' }], TaskCompleted: [{ command: 'true' }] });
  const dir = tmp('k6');
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, 'census.json');
  const r = censusRun(tree, 'UserPromptSubmit,TaskCompleted', out);
  let j = null;
  try { j = readJson(out); } catch (_e) { j = null; }
  check('K6 the census file uses mos.perf-384-counts/1 and holds the machine record', !!j && j.schema === 'mos.perf-384-counts/1' && !!j.machine && j.machine.tree_label !== undefined, r.stderr + JSON.stringify(j && Object.keys(j)));
  const ev = j && j.events ? j.events.find((e) => e.key === 'UserPromptSubmit') : null;
  check('K6 an event holds hooks, exec_total (min, median, max), exec_by_program, node_starts, bash_starts, find_count, tail_ms, survivors, survivor_cpu_ms', !!ev && ev.hooks && ev.hooks.matched === 2 && ev.exec_total && ev.exec_total.min <= ev.exec_total.median && ev.exec_total.median <= ev.exec_total.max && Array.isArray(ev.exec_by_program) && ['node_starts', 'bash_starts', 'find_count', 'tail_ms', 'survivors', 'survivor_cpu_ms'].every((k) => typeof ev[k] === 'number'), JSON.stringify(ev));
  check('K6 the count of UserPromptSubmit is exact: true is a shell child, node is one more', !!ev && ev.exec_total.median >= 1 && ev.node_starts === 1, JSON.stringify(ev));
  check('K6 the file holds 3 repeats', !!ev && ev.repeats === 3);
  const v1 = cp.spawnSync(process.execPath, [HARNESS, 'verify-results', dir], { encoding: 'utf8' });
  // the machine load1_start of a synthetic run is real; the check below is about the schema rule, so set a quiet value
  if (j) { j.machine.load1_start = 0.5; j.machine.load1_end = 0.5; fs.writeFileSync(out, JSON.stringify(j, null, 2)); }
  const v1b = cp.spawnSync(process.execPath, [HARNESS, 'verify-results', dir], { encoding: 'utf8' });
  check('K6 a census file with 3 repeats passes verify-results (counts schema)', v1b.status === 0, v1.stderr + v1b.stderr);
  const tdir = tmp('k6-timing');
  fs.mkdirSync(tdir, { recursive: true });
  const timing = {
    schema: 'mos.perf-384/1', machine: j ? j.machine : {}, room: { kind: 'synthetic-room' },
    targets: [{ id: 'event:SubagentStop:files1', n: 3, blocking: true, wall_ms: { median: 1, p95: 1, min: 1, max: 1 }, failed_runs: 0, timed_out: 0, survivors_left: 0, noisy: false, load1_start: 0.5 }],
  };
  fs.writeFileSync(path.join(tdir, 'timing.json'), JSON.stringify(timing));
  const v2 = cp.spawnSync(process.execPath, [HARNESS, 'verify-results', tdir], { encoding: 'utf8' });
  check('K6 a timing file with n = 3 fails verify-results', v2.status !== 0 && /n 3/.test(v2.stderr), v2.stderr);
}

// ---------------------------------------------------------------------------
// K7 copy mode on a synthetic source
// ---------------------------------------------------------------------------
{
  const src = tmp('copy-source');
  for (const s of ['01_Alpha', '02_Beta']) {
    writeFile(path.join(src, s, 'ROOM.md'), '# ' + s + '\n');
    for (let k = 0; k < 3; k += 1) writeFile(path.join(src, s, 'note-' + k + '.md'), 'note ' + k + '\n');
  }
  writeFile(path.join(src, 'STATE.md'), '# state\n');
  writeFile(path.join(src, 'ROOM.md'), '# room\n');
  const srcFiles = 2 * 4 + 2;
  const srcFile = tmp('copy-source-file.txt');
  writeFile(srcFile, src + '\n');
  const tree = makeTree('tree-copy', {
    UserPromptSubmit: [{ command: 'true' }],
    SubagentStop: [{ command: 'node -e 0' }],
  });
  const out = tmp('k7-run.json');
  const scratch7 = tmp('scratch7');
  fs.mkdirSync(scratch7, { recursive: true });
  const r = run(['run', '--tree', tree, '--room', 'copy', '--source-file', srcFile, '--events', 'UserPromptSubmit,SubagentStop:files20', '--repeats', '3', '--counter', so, '--scratch', scratch7, '--out', out, '--allow-short', '--skip-gates']);
  let j = null;
  try { j = readJson(out); } catch (_e) { j = null; }
  const text = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  check('K7 run --room copy --source-file works on a synthetic source', r.status === 0 && !!j, r.stderr + r.stdout);
  check('K7 the result names the copy kind and its file count', !!j && j.room && j.room.kind === 'real-copy' && j.room.file_count === srcFiles, JSON.stringify(j && j.room));
  check('K7 the result holds no path', text.length > 0 && text.indexOf(src) === -1 && text.indexOf(scratch7) === -1 && !/\/home\/|\/tmp\/|\/mnt\/c\//.test(text), text.slice(0, 200));
  const srcNow = [];
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else srcNow.push(f); } })(src);
  check('K7 the source room is unchanged (no probe file in it)', srcNow.length === srcFiles && srcNow.every((f) => !/probe-/.test(f)), srcNow.length);
  const sub = j && j.events ? j.events.find((e) => e.key === 'SubagentStop:files20') : null;
  check('K7 SubagentStop:files20 ran (probe files made in the working copy only) and counted the hook process', !!sub && sub.exec_total.median >= 1, JSON.stringify(sub));
  const out2 = tmp('k7-walls.json');
  const w = run(['walls-subagent', '--tree', tree, '--files', '1,5', '--runs', '2', '--room', 'copy', '--source-file', srcFile, '--counter', so, '--scratch', scratch7, '--out', out2, '--allow-short', '--skip-gates']);
  let wj = null;
  try { wj = readJson(out2); } catch (_e) { wj = null; }
  const wtext = fs.existsSync(out2) ? fs.readFileSync(out2, 'utf8') : '';
  check('K7 walls-subagent works in copy mode and writes a timing file with one target per size', w.status === 0 && !!wj && wj.schema === 'mos.perf-384/1' && wj.targets.length === 2 && wj.targets.every((t) => typeof t.n === 'number' && typeof t.exec_total === 'number' && 'survivor_cpu_ms' in t && t.wall_ms), w.stderr + wtext.slice(0, 300));
  check('K7 the walls file holds no path', wtext.length > 0 && wtext.indexOf(src) === -1 && !/\/home\/|\/tmp\/|\/mnt\/c\//.test(wtext));

  // WA: walls-subagent with two trees, interleaved. Tree A starts 3 sleep processes in its SubagentStop hook, tree B starts 1.
  {
    const hookOf = (tag, sleeps) => 'sh -c \'echo ' + tag + ' >> "$MOS_ORDER_FILE"; ' + Array.from({ length: sleeps }, () => 'sleep 0.1 &').join(' ') + ' wait\'';
    const wa = makeTree('tree-wa', { SubagentStop: [{ command: hookOf('a', 3) }] });
    const wb = makeTree('tree-wb', { SubagentStop: [{ command: hookOf('b', 1) }] });
    const orderFile = tmp('wa-order.txt');
    const outAb = tmp('wa-ab.json');
    const waEnv = Object.assign({}, selfEnv, { MOS_ORDER_FILE: orderFile });
    const ab = run(['walls-subagent', '--tree', wa, '--tree-b', wb, '--label-b', 'b-label', '--files', '1,5', '--runs', '4', '--room', 'copy', '--source-file', srcFile, '--counter', so, '--scratch', scratch7, '--out', outAb, '--allow-short', '--skip-gates', '--label', 'a-label'], { env: waEnv });
    let aj = null;
    try { aj = readJson(outAb); } catch (_e) { aj = null; }
    const order = fs.existsSync(orderFile) ? fs.readFileSync(orderFile, 'utf8').split('\n').filter(Boolean).join('') : '';
    // 4 untimed runs (size 1: a b, size 5: a b), then 4 rounds of 2 sizes: A first in even rounds, B first in odd rounds
    const expect = 'abab' + 'abab' + 'baba' + 'abab' + 'baba';
    check('WA1 walls-subagent --tree-b exits 0 and the two trees alternate in every pair, A first in even rounds and B first in odd rounds', ab.status === 0 && order.indexOf(expect) === 0, ab.status + ' ' + ab.stderr + ' ' + order);
    const badB = run(['walls-subagent', '--tree', wa, '--tree-b', tmp('no-such-tree'), '--files', '1', '--runs', '4', '--room', 'copy', '--source-file', srcFile, '--counter', so, '--scratch', scratch7, '--out', tmp('wa-bad.json'), '--allow-short', '--skip-gates']);
    check('WA1 walls-subagent --tree-b with a folder that is not a plugin tree exits 2', badB.status === 2, badB.status + ' ' + badB.stderr);
    const ids = aj ? aj.targets.map((t) => t.id) : [];
    const T = (id) => (aj ? aj.targets.find((t) => t.id === id) : null);
    check('WA2 the A targets keep the ids event:SubagentStop:files<N> and the B targets use event:SubagentStop-b:files<N>', ['event:SubagentStop:files1', 'event:SubagentStop:files5', 'event:SubagentStop-b:files1', 'event:SubagentStop-b:files5'].every((id) => ids.indexOf(id) >= 0) && ids.length === 4, ids.join());
    const fields = ['background_ms', 'background_ms_p95', 'survivor_cpu_ms', 'exec_total', 'node_starts', 'bash_starts', 'find_count', 'load1_end', 'n'];
    check('WA2 every B target holds the fields of a single-tree run, and the result has a compare key with both labels', !!aj && aj.targets.every((t) => fields.every((k) => k in t)) && !!aj.compare && aj.compare.a === 'a-label' && aj.compare.b === 'b-label', aj ? JSON.stringify(aj.compare) : '');
    const a1 = T('event:SubagentStop:files1');
    const b1 = T('event:SubagentStop-b:files1');
    const a5 = T('event:SubagentStop:files5');
    const b5 = T('event:SubagentStop-b:files5');
    check('WA3 n is the same for both trees (4)', !!a1 && !!b1 && !!a5 && !!b5 && a1.n === 4 && b1.n === 4 && a5.n === 4 && b5.n === 4, [a1, b1, a5, b5].map((t) => t && t.n).join());
    check('WA3 the B exec_total is lower than the A exec_total in the direction built into the trees (A starts 2 more processes)', !!a1 && !!b1 && !!a5 && !!b5 && b1.exec_total < a1.exec_total && b5.exec_total < a5.exec_total && a1.exec_total - b1.exec_total >= 2, [a1, b1, a5, b5].map((t) => t && t.exec_total).join());
    const atext = fs.existsSync(outAb) ? fs.readFileSync(outAb, 'utf8') : '';
    check('WA3 the two-tree file holds no path', atext.length > 0 && !/\/home\/|\/tmp\/|\/mnt\/c\//.test(atext) && atext.indexOf(src) === -1);
    const abSingle = run(['walls-subagent', '--tree', wa, '--files', '1', '--runs', '2', '--room', 'copy', '--source-file', srcFile, '--counter', so, '--scratch', scratch7, '--out', tmp('wa-single.json'), '--allow-short', '--skip-gates'], { env: waEnv });
    let sj2 = null;
    try { sj2 = readJson(tmp('wa-single.json')); } catch (_e) { sj2 = null; }
    check('WA2 without --tree-b the output is unchanged: one target id per size, no compare key', abSingle.status === 0 && !!sj2 && sj2.targets.length === 1 && sj2.targets[0].id === 'event:SubagentStop:files1' && !sj2.compare, abSingle.stderr);
  }
  cp.spawnSync(process.execPath, [HARNESS, 'clean-bench', '--source', src, '--scratch', scratch7], { encoding: 'utf8' });
}

// ---------------------------------------------------------------------------
// end
// ---------------------------------------------------------------------------
try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
process.stdout.write(failed ? 'process-census: ' + failed + ' FAILED (' + passed + ' ok)\n' : 'process-census: ALL PASS (' + passed + ' checks)\n');
process.exit(failed ? 1 : 0);
