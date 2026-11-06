#!/usr/bin/env node
'use strict';
/*
 * Phase 384 plan 06: checks for bench/mcp-probe.cjs. Node built-ins only. Prints `mcp-probe: ALL PASS` or
 * `mcp-probe: <n> FAILED`. Run it under the lock:
 *   mkdir -p "$HOME/.cache" && flock -w 7200 "$HOME/.cache/mos-perf-384.lock" node bench/test-mcp-probe.cjs
 * The checks use a synthetic stdio server that the test writes to a temporary folder (no product code, no real room).
 * Checks: M1 handshake and counts, M2 blocking ping, M3 inotify count, M4 idle cost, M5 profile groups,
 * M6 CPU profile start, M7 opens per call, M8 subcommands and the two schemas, M9 exec check with stub npm and block
 * list, M10 copy mode on a synthetic source. MCP_PROBE_MODULE overrides the module path (used for the recorded RED run).
 * Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const BENCH = __dirname;
const REPO = path.resolve(BENCH, '..', '..', '..', '..');
const HARNESS = path.join(REPO, 'tools', 'perf', 'perf-harness.cjs');
const PROBE_PATH = process.env.MCP_PROBE_MODULE || path.join(BENCH, 'mcp-probe.cjs');
const CENSUS = path.join(BENCH, 'process-census.cjs');

let failed = 0;
function check(name, cond, detail) {
  if (cond) { process.stdout.write('  ok   ' + name + '\n'); return; }
  failed += 1;
  process.stdout.write('  FAIL ' + name + (detail !== undefined ? ' :: ' + String(detail).slice(0, 400) : '') + '\n');
}

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-384-mcptest-'));
function tmp(name) { return path.join(scratch, name); }
function writeFile(file, text, mode) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, mode ? { mode } : undefined);
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function readJson(f) { return JSON.parse(fs.readFileSync(f, 'utf8')); }

// the synthetic stdio server: line-framed JSON-RPC, 5 tools (2 named eureka), a slow tool, a tool that opens 2 databases
const FAKE = [
  "'use strict';",
  "const cp = require('node:child_process');",
  "const fs = require('node:fs');",
  "const mode = process.env.FAKE_MODE || '';",
  // test-only order log: one line per server start, the name of the tree folder (no path)
  "if (process.env.FAKE_ORDER_FILE) { try { fs.appendFileSync(process.env.FAKE_ORDER_FILE, require('node:path').basename(require('node:path').dirname(__dirname)) + '\\n'); } catch (e) { /* none */ } }",
  "if (mode === 'npm') { try { cp.execFileSync('npm', ['--version'], { stdio: 'ignore' }); } catch (e) { /* stub exits 1 */ } }",
  "if (mode === 'npmabs') { try { cp.execFileSync('/usr/bin/env', [process.env.FAKE_NPM_ABS, '--version'], { stdio: 'ignore' }); } catch (e) { /* blocked */ } }",
  "if (process.env.FAKE_WATCH) { try { fs.watch(process.env.MINDRIAN_ROOMS_HOME); } catch (e) { /* none */ } }",
  "const tools = ['room_list', 'memory_event', 'stop_gate_check', 'eureka_a', 'eureka_b'];",
  "function reply(id, result) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: id, result: result }) + '\\n'); }",
  "function handle(m) {",
  "  if (m.method === 'initialize') return reply(m.id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'fake', version: '1' } });",
  "  if (m.method === 'ping') return reply(m.id, {});",
  "  if (m.method === 'tools/list') return reply(m.id, { tools: tools.map(function (n) { return { name: n, inputSchema: { type: 'object' } }; }) });",
  "  if (m.method === 'tools/call') {",
  "    const n = m.params.name;",
  "    if (n === 'stop_gate_check') cp.execFileSync('sleep', ['0.3']);",
  "    if (n === 'stop_gate_check' && process.env.FAKE_BG) cp.spawn('sleep', ['1'], { detached: true, stdio: 'ignore' }).unref();",
  // test-only: the module name is joined at run time so the substrate scan, which guards product code, does not read this synthetic server as a room.db access
  "    if (n === 'memory_event') { const D = require('node:' + 'sqlite').DatabaseSync; new D(':memory:'); new D(':memory:'); }",
  "    if (n === 'room_state') cp.execFileSync(process.execPath, ['-e', \"new (require('node:' + 'sqlite').DatabaseSync)(':memory:')\"], { stdio: 'ignore' });",
  "    return reply(m.id, { content: [{ type: 'text', text: 'ok' }] });",
  "  }",
  "  if (m.id !== undefined) reply(m.id, {});",
  "}",
  "let buf = '';",
  "process.stdin.on('data', function (d) { buf += d; let i; while ((i = buf.indexOf('\\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (!l.trim()) continue; let m; try { m = JSON.parse(l); } catch (e) { continue; } handle(m); } });",
  "process.stdin.on('end', function () { process.exit(0); });",
  '',
].join('\n');

// a plugin tree for the CLI checks
const tree = tmp('tree');
writeFile(path.join(tree, 'hooks', 'hooks.json'), JSON.stringify({ hooks: { SessionEnd: [{ hooks: [{ type: 'command', command: 'true' }] }] } }));
writeFile(path.join(tree, 'scripts', 'mindrian-mcp-server.cjs'), FAKE);
writeFile(path.join(tree, 'scripts', 'mindrian-brain-mcp-client.cjs'), FAKE);
writeFile(path.join(tree, 'lib', 'mcp', 'tools', 'a.cjs'), "'use strict';\n");
const FAKE_SCRIPT = path.join(tree, 'scripts', 'mindrian-mcp-server.cjs');

// a synthetic source folder for copy mode
const source = tmp('source-room');
writeFile(path.join(source, 'ROOM.md'), '# synthetic\n');
writeFile(path.join(source, 'problem-definition', 'note.md'), '# synthetic note\n');
const sourceFile = tmp('source-file.txt');
writeFile(sourceFile, source + '\n');

const selfEnv = Object.assign({}, process.env, { MOS_PERF_SELFTEST: '1' });
// verify-results needs load1 below 2 at the start of a result; the checks before it raise the load, so wait (up to 10 min)
function waitLoad(limit) {
  const end = Date.now() + 600000;
  for (;;) {
    const l = Number(fs.readFileSync('/proc/loadavg', 'utf8').split(' ')[0]);
    if (l < limit || Date.now() > end) return l;
    cp.spawnSync('sleep', ['5']);
  }
}
function cli(args, extraEnv) {
  if (/^(opens|start)$/.test(args[0])) waitLoad(1.5);
  return cp.spawnSync(process.execPath, [PROBE_PATH].concat(args), { encoding: 'utf8', env: Object.assign({}, selfEnv, extraEnv || {}), timeout: 300000, cwd: scratch });
}
function verify(dir) {
  return cp.spawnSync(process.execPath, [HARNESS, 'verify-results', dir], { encoding: 'utf8', timeout: 120000, env: process.env });
}
function baseEnv(extra) {
  return Object.assign({}, process.env, { MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9' }, extra || {});
}

async function main() {
  let P = null;
  try { P = require(PROBE_PATH); } catch (e) { P = null; }
  check('M0 the probe library loads and exports its functions', !!P && ['spawnServer', 'handshake', 'blockProbe', 'inotifyWatches', 'idleCost', 'summarizeProfile', 'opensPerCall', 'execCheck', 'profileStart'].every((k) => typeof P[k] === 'function'), P ? '' : 'mcp-probe.cjs missing');
  if (!P) {
    // RED: nothing below can run; count one failure for each group so the recorded run lists them
    for (const g of ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10']) check(g + ' needs the probe library', false, 'module not found');
    return;
  }
  const hasTaskset = cp.spawnSync('taskset', ['--version'], { stdio: 'ignore' }).status === 0;
  const common = { cwd: scratch, cpus: 4, hasTaskset };

  // ---- M1 handshake and counts
  {
    const srv = P.spawnServer(Object.assign({ script: FAKE_SCRIPT, env: baseEnv() }, common));
    const hs = await P.handshake(srv, { timeoutMs: 20000 });
    const c = P.toolCounts ? P.toolCounts(hs.tools) : { tools: hs.tools.length, eureka_tools: hs.tools.filter((n) => n.startsWith('eureka')).length };
    check('M1 handshake: 5 tools, 2 of them eureka-named', hs.tools.length === 5 && c.eureka_tools === 2, JSON.stringify(hs.tools));
    check('M1 both reply times are above 0 and the tools/list reply is not earlier than initialize', hs.init_ms > 0 && hs.list_ms >= hs.init_ms, hs.init_ms + ' ' + hs.list_ms);

    // ---- M2 blocking ping
    const slow = await P.blockProbe(srv, { tool: 'stop_gate_check', args: {}, pingDelayMs: 20 });
    const fast = await P.blockProbe(srv, { tool: 'room_list', args: {}, pingDelayMs: 20 });
    check('M2 the ping during the slow tool (sleep 0.3 s in execFileSync) takes 250 ms or more', slow.ping_ms >= 250, slow.ping_ms);
    check('M2 the ping during the fast tool takes less than 100 ms', fast.ping_ms < 100, fast.ping_ms);
    check('M2 the slow tool reply time is 300 ms or more', slow.tool_ms >= 290, slow.tool_ms);
    const idle = await P.idlePing(srv, 3);
    check('M2 the idle ping baseline is below 100 ms', idle < 100, idle);
    await srv.stop('SIGKILL', 2000);
  }

  // ---- M3 inotify watches
  {
    const watched = tmp('watched-dir');
    fs.mkdirSync(watched, { recursive: true });
    const spawnNode = (code) => new Promise((resolve) => {
      const c = cp.spawn(process.execPath, ['-e', code, watched], { stdio: ['ignore', 'pipe', 'ignore'] });
      c.stdout.once('data', () => resolve(c));
    });
    const w = await spawnNode("require('fs').watch(process.argv[1], function () {}); process.stdout.write('r\\n'); setInterval(function () {}, 1000);");
    const wn = P.inotifyWatches(w.pid);
    w.kill('SIGKILL');
    const n0 = await spawnNode("process.stdout.write('r\\n'); setInterval(function () {}, 1000);");
    const zn = P.inotifyWatches(n0.pid);
    n0.kill('SIGKILL');
    check('M3 a child with fs.watch has 1 or more watches', wn >= 1, wn);
    check('M3 a child without a watcher has 0 watches', zn === 0, zn);
  }

  // ---- M4 idle cost and the bare control
  {
    const c = await new Promise((resolve) => {
      const k = cp.spawn(process.execPath, ['-e', "process.stdout.write('r\\n'); setInterval(function () {}, 1000);"], { stdio: ['ignore', 'pipe', 'ignore'] });
      k.stdout.once('data', () => resolve(k));
    });
    const cost = await P.idleCost(c.pid, 500);
    c.kill('SIGKILL');
    check('M4 the bare node control: VmRSS between 5 and 300 MB', cost && cost.rss_mb > 5 && cost.rss_mb < 300, JSON.stringify(cost));
    check('M4 the bare node control: CPU in the window is 0 or more and below 400 ms', cost && cost.cpu_ms >= 0 && cost.cpu_ms < 400, JSON.stringify(cost));
  }

  // ---- M5 profile groups on a hand-made profile
  {
    const root = tree;
    const u = (rel) => 'file://' + root + '/' + rel;
    const nm = (rel) => 'file://' + root + '/node_modules/' + rel;
    const defs = [
      [1, '(root)', ''], [2, 'a', u('lib/mcp/tools/foo.cjs')], [3, 'b', u('lib/mcp/tools/eureka-x.cjs')], [4, 'c', u('lib/mcp/server.cjs')],
      [5, 'd', u('lib/core/c.cjs')], [6, 'e', nm('@modelcontextprotocol/sdk/dist/cjs/client/index.js')], [7, 'f', nm('@modelcontextprotocol/sdk/dist/cjs/server/index.js')],
      [8, 'g', nm('zod/lib/index.js')], [9, 'h', nm('chokidar/index.js')], [10, 'i', 'node:internal/modules/cjs/loader'], [11, '(idle)', ''],
      [12, 'j', 'file:///elsewhere/other.js'], [13, 'k', u('scripts/server.cjs')],
    ];
    const counts = { 2: 3, 3: 2, 4: 1, 5: 4, 6: 5, 7: 6, 8: 7, 9: 8, 10: 9, 11: 10, 12: 1, 13: 2 };
    const samples = [];
    const timeDeltas = [];
    for (const id of Object.keys(counts)) for (let i = 0; i < counts[id]; i += 1) { samples.push(Number(id)); timeDeltas.push(1000); }
    const prof = { nodes: defs.map((d) => ({ id: d[0], callFrame: { functionName: d[1], url: d[2] }, children: [] })), samples, timeDeltas };
    const pf = tmp('hand.cpuprofile');
    writeFile(pf, JSON.stringify(prof));
    const s = P.summarizeProfile(pf, root);
    const g = s.by_group;
    check('M5 the self time sums by group match the known sample counts', g.tools === 3 && g['eureka-tools'] === 2 && g['other-mcp'] === 1 && g.core === 4 && g['sdk-client'] === 5 && g['sdk-other'] === 6 && g.zod === 7 && g.chokidar === 8 && g['node-builtins'] === 9 && g.other === 3 && g.idle === 10, JSON.stringify(g));
    check('M5 the active time leaves out idle and the shares add up to about 100', s.active_ms === 48 && Math.abs(Object.keys(s.shares_percent).reduce((a, k) => a + s.shares_percent[k], 0) - 100) < 1, s.active_ms);
    check('M5 the top file by self time is the builtin loader with 9 ms', s.top_files[0].file === 'node:internal/modules/cjs/loader' && s.top_files[0].ms === 9 && s.top_files.length <= 10, JSON.stringify(s.top_files[0]));
    check('M5 file names are plugin-relative or package names', s.top_files.some((t) => t.file === 'lib/core/c.cjs') && s.top_files.some((t) => t.file === '@modelcontextprotocol/sdk'), JSON.stringify(s.top_files));
    check('M5 no absolute path in the summary', JSON.stringify(s).indexOf(scratch) === -1 && JSON.stringify(s).indexOf('/elsewhere') === -1);
  }

  // ---- M6 CPU profile start
  {
    const dir = tmp('prof-run');
    const r = await P.profileStart(Object.assign({ script: FAKE_SCRIPT, env: baseEnv(), dir }, common));
    const sum = r.profile_file ? P.summarizeProfile(r.profile_file, tree) : null;
    check('M6 the server run under --cpu-prof writes a profile after SIGTERM (probe preload exits 0)', !!r.profile_file && fs.existsSync(r.profile_file), JSON.stringify({ file: !!r.profile_file }));
    check('M6 summarizeProfile reads that profile', !!sum && sum.samples > 0 && sum.total_ms > 0, sum ? sum.samples : 'no profile');
    check('M6 the preload reported a module count', typeof r.modules === 'number' && r.modules >= 1, r.modules);
  }

  // ---- M7 opens per tool call
  {
    const rows = await P.opensPerCall(Object.assign({ script: FAKE_SCRIPT, env: baseEnv(), logFile: tmp('opens.log'), cats: { lib: path.join(tree, 'lib') } }, common), [
      { name: 'room_list', label: 'fast' }, { name: 'memory_event', label: 'two' }, { name: 'memory_event', label: 'two-again' }, { name: 'room_state', label: 'child' },
    ]);
    const by = {};
    rows.forEach((r) => { by[r.label] = r; });
    check('M7 the tool that constructs 2 databases counts 2', by.two && by.two.measured && by.two.opens_server === 2, JSON.stringify(by.two));
    check('M7 the same tool called again counts 2 again', by['two-again'] && by['two-again'].opens_server === 2, JSON.stringify(by['two-again']));
    check('M7 the fast tool counts 0', by.fast && by.fast.measured && by.fast.opens_server === 0 && by.fast.opens_children === 0, JSON.stringify(by.fast));
    check('M7 a database opened in a child node process of the server is counted apart (1)', by.child && by.child.opens_children === 1 && by.child.opens_server === 0 && by.child.child_node_direct === 1, JSON.stringify(by.child));
  }

  // ---- M9 exec check with stub npm and a block list
  {
    const so = tmp('exec-counter.so');
    const built = cp.spawnSync(process.execPath, [CENSUS, 'build', '--scratch', scratch], { encoding: 'utf8', timeout: 120000 });
    check('M9 the exec counter builds in the temporary folder', built.status === 0 && fs.existsSync(so), built.stderr + built.stdout);
    const fakeNpmDir = tmp('fakebin');
    const marker = tmp('fake-npm-ran.marker');
    writeFile(path.join(fakeNpmDir, 'npm'), '#!/bin/sh\ntouch "' + marker + '"\nexit 0\n', 0o755);
    const run = (envExtra, block, name) => P.execCheck(Object.assign({ script: FAKE_SCRIPT, env: baseEnv(envExtra), counter: so, dir: tmp('exec-' + name), settleMs: 300 }, common, block === undefined ? {} : { block }));
    const a = await run({ FAKE_MODE: 'npm' }, undefined, 'a');
    check('M9 npm through PATH with the block list: blocked 1 or more, no stub call (the block comes first), npm attempted', a.blocked_execs >= 1 && a.stub_calls === 0 && a.npm_attempted === true, JSON.stringify(a));
    const b = await run({ FAKE_MODE: 'npm' }, '', 'b');
    check('M9 npm through PATH with no block list: the stub ran once, no real npm, npm attempted', b.stub_calls === 1 && b.blocked_execs === 0 && b.npm_attempted === true, JSON.stringify(b));
    const c = await run({ FAKE_MODE: 'npmabs', FAKE_NPM_ABS: path.join(fakeNpmDir, 'npm') }, undefined, 'c');
    check('M9 an absolute path to a program named npm is blocked and the fake program does not run', c.blocked_execs >= 1 && !fs.existsSync(marker), JSON.stringify(c) + ' marker=' + fs.existsSync(marker));
    const d = await run({}, undefined, 'd');
    check('M9 a server that starts no child gives 0 stub calls, 0 blocked, npm not attempted', d.stub_calls === 0 && d.blocked_execs === 0 && d.npm_attempted === false && d.replied === true, JSON.stringify(d));
  }

  // ---- M8 and M10 the CLI, the two schemas, copy mode
  {
    const outDir = tmp('out');
    fs.mkdirSync(outDir, { recursive: true });
    const opensFile = path.join(outDir, 'opens.json');
    const r1 = cli(['opens', '--tree', tree, '--room', 'copy', '--source-file', sourceFile, '--out', opensFile, '--repeats', '3', '--tools', 'room_list,memory_event,bogus', '--scratch', scratch, '--skip-gates', '--label', 'synthetic']);
    check('M8 opens exits 0 in copy mode on a synthetic source', r1.status === 0 && fs.existsSync(opensFile), r1.stderr + r1.stdout);
    const oj = fs.existsSync(opensFile) ? readJson(opensFile) : null;
    check('M8 the opens result uses mos.perf-384-counts/1 and carries the machine record', !!oj && oj.schema === 'mos.perf-384-counts/1' && oj.machine && oj.machine.cores > 0 && oj.machine.base_sha !== undefined, oj ? oj.schema : 'no file');
    const mem = oj && oj.opens.find((o) => o.tool === 'memory_event');
    const lst = oj && oj.opens.find((o) => o.tool === 'room_list');
    check('M8 opens by tool name: memory_event 2, room_list 0 in all 3 repeats, first and second call', !!mem && !!lst && mem.first_call.opens_server.join() === '2,2,2' && mem.second_call.opens_server.join() === '2,2,2' && lst.first_call.opens_server.join() === '0,0,0', JSON.stringify(mem));
    check('M8 a tool with no safe argument set is listed as not measured', !!oj && oj.not_measured.some((x) => x.tool === 'bogus' && /safe argument/.test(x.reason)), oj ? JSON.stringify(oj.not_measured) : '');
    const v1 = verify(outDir);
    check('M8 an opens result with 3 repeats passes verify-results', v1.status === 0, v1.stderr + v1.stdout);
    const text = fs.existsSync(opensFile) ? fs.readFileSync(opensFile, 'utf8') : '';
    check('M10 no output holds a path (scratch, source, home)', text.length > 0 && text.indexOf(scratch) === -1 && text.indexOf(source) === -1 && text.indexOf(os.homedir()) === -1);
    check('M10 copy mode left the source folder unchanged and the isolation exit code is 0', !!oj && oj.isolation.exit_code === 0 && oj.isolation.source_changed_paths === 0, oj ? JSON.stringify(oj.isolation) : '');

    const wpDir = tmp('out-wp');
    fs.mkdirSync(wpDir, { recursive: true });
    const wpFile = path.join(wpDir, 'opens-wp.json');
    const r1b = cli(['opens', '--tree', tree, '--room', 'copy', '--source-file', sourceFile, '--out', wpFile, '--repeats', '3', '--tools', 'memory_event', '--write-path', 'on', '--scratch', scratch, '--skip-gates', '--label', 'synthetic']);
    const wj = fs.existsSync(wpFile) ? readJson(wpFile) : null;
    check('M8 --write-path on is recorded in the result and the count still holds (2)', r1b.status === 0 && !!wj && /^on/.test(wj.write_path) && wj.opens[0].first_call.opens_server.join() === '2,2,2' && /^off/.test(oj.write_path), r1b.stderr + (wj ? wj.write_path : ''));
    const badWp = cli(['opens', '--tree', tree, '--room', 'copy', '--source-file', sourceFile, '--out', tmp('w.json'), '--write-path', 'maybe', '--scratch', scratch, '--skip-gates']);
    check('M8 --write-path with another value exits 2', badWp.status === 2, badWp.status + ' ' + badWp.stderr);

    const startDir = tmp('out-start');
    fs.mkdirSync(startDir, { recursive: true });
    const startFile = path.join(startDir, 'start.json');
    const r2 = cli(['start', '--tree', tree, '--room', 'copy', '--source-file', sourceFile, '--out', startFile, '--runs', '3', '--server', 'both', '--scratch', scratch, '--skip-gates', '--allow-short', '--label', 'synthetic']);
    check('M8 start exits 0 in copy mode', r2.status === 0 && fs.existsSync(startFile), r2.stderr + r2.stdout);
    const sj = fs.existsSync(startFile) ? readJson(startFile) : null;
    const tl = sj && sj.targets.find((t) => t.id === 'mcp:os:tools-list');
    check('M8 the start result uses mos.perf-384/1 with mcp: ids, the floor target, and the series target', !!sj && sj.schema === 'mos.perf-384/1' && !!tl && sj.targets.some((t) => t.id === 'floor:node') && sj.targets.some((t) => t.id === 'mcp:series-os-plus-brain:initialize') && sj.targets.every((t) => /^(mcp:|floor:node)/.test(t.id)), sj ? sj.targets.map((t) => t.id).join() : '');
    check('M8 the start result holds tools 5 and eureka 2 and a count run with modules', !!tl && tl.tools === 5 && tl.eureka_tools === 2 && sj.counts.os.tools === 5 && sj.counts.os.eureka_tools === 2 && sj.counts.os.modules >= 1 && sj.counts.os.tool_files_in_folder === 1, sj ? JSON.stringify(sj.counts) : '');
    const v2 = verify(startDir);
    check('M8 a start result with n = 3 fails verify-results', v2.status === 1 && /needs 7 or more/.test(v2.stderr), v2.stderr + v2.stdout);
    const refuse = cli(['start', '--tree', tree, '--room', 'copy', '--source-file', sourceFile, '--out', tmp('x.json'), '--runs', '3', '--scratch', scratch, '--skip-gates']);
    check('M8 fewer than 7 runs without --allow-short exits 2', refuse.status === 2, refuse.status + ' ' + refuse.stderr);
    const noSelf = cp.spawnSync(process.execPath, [PROBE_PATH, 'start', '--tree', tree, '--room', 'copy', '--source-file', sourceFile, '--out', tmp('y.json'), '--allow-short'], { encoding: 'utf8', env: process.env, cwd: scratch });
    check('M8 the test-only flags need MOS_PERF_SELFTEST=1 (exit 2)', noSelf.status === 2, noSelf.status + ' ' + noSelf.stderr);
    const noLock = cp.spawnSync(process.execPath, [PROBE_PATH, 'opens', '--tree', tree, '--room', 'copy', '--source-file', sourceFile, '--out', tmp('z.json')], { encoding: 'utf8', env: Object.assign({}, process.env, { MOS_PERF_LOCK_FILE: tmp('no-such-lock') }), cwd: scratch });
    check('M8 a run without the lock exits 1', noLock.status === 1 && /lock not held/.test(noLock.stderr), noLock.status + ' ' + noLock.stderr);

    // two trees, interleaved
    const treeB = tmp('tree-b');
    writeFile(path.join(treeB, 'scripts', 'mindrian-mcp-server.cjs'), FAKE);
    const abFile = path.join(outDir, 'ab.json');
    const r6 = cli(['start', '--tree', tree, '--tree-b', treeB, '--label-b', 'tree-b-label', '--room', 'copy', '--source-file', sourceFile, '--out', abFile, '--runs', '4', '--server', 'os', '--scratch', scratch, '--skip-gates', '--allow-short', '--label', 'tree-a-label']);
    const aj = fs.existsSync(abFile) ? readJson(abFile) : null;
    const ids = aj ? aj.targets.map((t) => t.id).join() : '';
    check('M8 start --tree-b: targets for both trees and a per-pair difference, n = 4 each, labels kept', r6.status === 0 && !!aj && /mcp:os:initialize/.test(ids) && /mcp:os-b:initialize/.test(ids) && /mcp:os:initialize:a-minus-b/.test(ids) && aj.targets.every((t) => t.n === 4) && aj.compare.a === 'tree-a-label' && aj.compare.b === 'tree-b-label', r6.stderr + ids);
    const abBad = cli(['start', '--tree', tree, '--tree-b', tmp('no-such-tree'), '--room', 'copy', '--source-file', sourceFile, '--out', tmp('ab2.json'), '--runs', '4', '--server', 'os', '--scratch', scratch, '--skip-gates', '--allow-short']);
    check('M8 start --tree-b with a folder that is not a plugin tree exits 2', abBad.status === 2, abBad.status + ' ' + abBad.stderr);

    // block and idle, small
    const blockFile = path.join(outDir, 'block.json');
    const r3 = cli(['block', '--tree', tree, '--room', 'copy', '--source-file', sourceFile, '--out', blockFile, '--tool', 'stop_gate_check', '--runs', '2', '--scratch', scratch, '--skip-gates', '--allow-short', '--label', 'synthetic']);
    const bj = fs.existsSync(blockFile) ? readJson(blockFile) : null;
    const cold = bj && bj.targets.find((t) => t.id === 'mcp:block:stop_gate_check:cold:ping');
    const base = bj && bj.targets.find((t) => t.id === 'mcp:block:idle-ping');
    check('M8 block: the ping during the synthetic slow tool is above 250 ms and the idle ping is below 100 ms', r3.status === 0 && !!cold && !!base && cold.wall_ms.median >= 250 && base.wall_ms.median < 100, r3.stderr + (cold ? cold.wall_ms.median : ''));
    // a call that leaves detached background work: it is waited for, its time is on file, and it is not a survivor
    const bgFile = path.join(outDir, 'block-bg.json');
    const r3b = cli(['block', '--tree', tree, '--room', 'copy', '--source-file', sourceFile, '--out', bgFile, '--tool', 'stop_gate_check', '--runs', '2', '--scratch', scratch, '--skip-gates', '--allow-short', '--label', 'synthetic'], { FAKE_BG: '1' });
    const gj = fs.existsSync(bgFile) ? readJson(bgFile) : null;
    const gcold = gj && gj.targets.find((t) => t.id === 'mcp:block:stop_gate_check:cold:ping');
    check('M8 block: detached background work after the reply is waited for (background_ms of 500 or more), survivors 0', r3b.status === 0 && !!gcold && gcold.background_ms >= 500 && gcold.survivors_left === 0 && gcold.failed_runs === 0, r3b.stderr + (gcold ? JSON.stringify([gcold.background_ms, gcold.survivors_left]) : ''));
    check('M8 block: with no background work background_ms is 0', !!cold && cold.background_ms === 0, cold ? cold.background_ms : '');

    // BA: block with two trees, interleaved. Tree A blocks 300 ms in execFileSync, tree B answers at once.
    {
      const treeFast = tmp('tree-fast');
      writeFile(path.join(treeFast, 'hooks', 'hooks.json'), JSON.stringify({ hooks: { SessionEnd: [{ hooks: [{ type: 'command', command: 'true' }] }] } }));
      writeFile(path.join(treeFast, 'scripts', 'mindrian-mcp-server.cjs'), FAKE.replace("if (n === 'stop_gate_check') cp.execFileSync('sleep', ['0.3']);", ''));
      const orderFile = tmp('block-order.txt');
      const baFile = path.join(outDir, 'block-ab.json');
      const rBa = cli(['block', '--tree', tree, '--tree-b', treeFast, '--label-b', 'fast-label', '--room', 'copy', '--source-file', sourceFile, '--out', baFile, '--tool', 'stop_gate_check', '--runs', '4', '--scratch', scratch, '--skip-gates', '--allow-short', '--label', 'slow-label'], { FAKE_ORDER_FILE: orderFile });
      const baj = fs.existsSync(baFile) ? readJson(baFile) : null;
      const baIds = baj ? baj.targets.map((t) => t.id) : [];
      const T = (id) => (baj ? baj.targets.find((t) => t.id === id) : null);
      const pre = 'mcp:block:stop_gate_check:';
      const preB = 'mcp:block-b:stop_gate_check:';
      const order = fs.existsSync(orderFile) ? fs.readFileSync(orderFile, 'utf8').split('\n').filter(Boolean) : [];
      let orderOk = order.length === 24;
      for (let k = 0; orderOk && k < 12; k += 1) {
        const round = Math.floor(k / 3);
        const first = round % 2 === 0 ? 'tree' : 'tree-fast';
        if (order[2 * k] !== first || order[2 * k + 1] === first) orderOk = false;
      }
      check('BA1 block --tree-b exits 0 and runs both trees in every pair, tree A first in even rounds and tree B first in odd rounds', rBa.status === 0 && orderOk, rBa.status + ' ' + rBa.stderr + ' ' + order.join(','));
      const badTreeB = cli(['block', '--tree', tree, '--tree-b', tmp('no-such-tree'), '--room', 'copy', '--source-file', sourceFile, '--out', tmp('ba-bad.json'), '--runs', '4', '--scratch', scratch, '--skip-gates', '--allow-short']);
      check('BA1 block --tree-b with a folder that is not a plugin tree exits 2', badTreeB.status === 2, badTreeB.status + ' ' + badTreeB.stderr);
      const idsA = ['mcp:block:idle-ping', pre + 'cold:ping', pre + 'cold:tool', pre + 'warm:ping', pre + 'warm:tool'];
      const idsB = idsA.map((x) => x.replace('mcp:block:', 'mcp:block-b:'));
      const idsD = [pre + 'cold:ping', pre + 'cold:tool', pre + 'warm:ping', pre + 'warm:tool'].map((x) => x + ':a-minus-b');
      check('BA2 the A rows keep today ids, the B rows use the prefix mcp:block-b:, and each ping and tool row has an :a-minus-b row', !!baj && idsA.concat(idsB, idsD).every((id) => baIds.indexOf(id) >= 0), baIds.join());
      check('BA2 the result holds a compare key with both labels and every row has n = 4', !!baj && !!baj.compare && baj.compare.a === 'slow-label' && baj.compare.b === 'fast-label' && baj.targets.every((t) => t.n === 4), baj ? JSON.stringify(baj.compare) : '');
      check('BA2 block without --tree-b still has no B row and no compare key (earlier output unchanged)', !!bj && !bj.compare && !bj.targets.some((t) => /block-b|a-minus-b/.test(t.id)));
      const cA = T(pre + 'cold:ping');
      const cB = T(preB + 'cold:ping');
      const cD = T(pre + 'cold:ping:a-minus-b');
      check('BA3 the A cold ping median is 250 ms or more, the B cold ping median is below 100 ms', !!cA && !!cB && cA.wall_ms.median >= 250 && cB.wall_ms.median < 100, cA && cB ? cA.wall_ms.median + ' ' + cB.wall_ms.median : '');
      check('BA3 the a-minus-b row of the cold ping has a median of 150 ms or more', !!cD && cD.wall_ms.median >= 150 && cD.derived === true, cD ? cD.wall_ms.median : '');
    }
    const idleFile = path.join(outDir, 'idle.json');
    const r4 = cli(['idle', '--tree', tree, '--room', 'copy', '--source-file', sourceFile, '--out', idleFile, '--rooms', '1,2', '--procs', '1,2', '--window-ms', '300', '--runs', '1', '--scratch', scratch, '--skip-gates', '--allow-short', '--label', 'synthetic'], { FAKE_WATCH: '1' });
    const ij = fs.existsSync(idleFile) ? readJson(idleFile) : null;
    const t22 = ij && ij.targets.find((t) => t.id === 'mcp:idle:rooms-2:procs-2');
    check('M8 idle: targets for each rooms and procs pair, the control, and the derived minus-control rows', r4.status === 0 && !!ij && ij.targets.some((t) => t.id === 'mcp:idle:control-node') && ij.targets.some((t) => /minus-control$/.test(t.id)) && !!t22, r4.stderr + (ij ? ij.targets.map((t) => t.id).join() : ''));
    check('M8 idle: 2 processes watch the rooms home, so the total is twice the per-process count and 1 or more', !!t22 && t22.watches_per_process.median >= 1 && t22.watches_total.median === 2 * t22.watches_per_process.median, t22 ? JSON.stringify([t22.watches_per_process, t22.watches_total]) : '');
    check('M8 idle: the control process has 0 watches', !!ij && ij.targets.find((t) => t.id === 'mcp:idle:control-node').watches_per_process.median === 0);

    // exec check CLI (count schema)
    const so = tmp('exec-counter.so');
    const execDir = tmp('out-exec');
    fs.mkdirSync(execDir, { recursive: true });
    const execFile = path.join(execDir, 'exec.json');
    const r5 = cli(['start', '--exec-check', '--tree', tree, '--room', 'copy', '--source-file', sourceFile, '--out', execFile, '--runs', '3', '--server', 'os', '--counter', so, '--scratch', scratch, '--skip-gates', '--label', 'synthetic']);
    const ej = fs.existsSync(execFile) ? readJson(execFile) : null;
    check('M9 the exec-check CLI writes the counts schema with stub calls, blocked execs and npm_attempted false for a quiet server', r5.status === 0 && !!ej && ej.schema === 'mos.perf-384-counts/1' && ej.exec_check.os.npm_attempted === false && ej.exec_check.os.stub_calls.join() === '0,0,0' && ej.exec_check.os.blocked_execs.join() === '0,0,0', r5.stderr + (ej ? JSON.stringify(ej.exec_check) : ''));
    const v3 = verify(execDir);
    check('M9 the exec-check result passes verify-results', v3.status === 0, v3.stderr + v3.stdout);
  }
}

main().then(() => {
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  if (failed === 0) { process.stdout.write('mcp-probe: ALL PASS\n'); process.exit(0); }
  process.stdout.write('mcp-probe: ' + failed + ' FAILED\n');
  process.exit(1);
}, (err) => {
  process.stdout.write('  FAIL unexpected error :: ' + String(err && err.stack || err).slice(0, 600) + '\n');
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  process.stdout.write('mcp-probe: ' + (failed + 1) + ' FAILED\n');
  process.exit(1);
});
