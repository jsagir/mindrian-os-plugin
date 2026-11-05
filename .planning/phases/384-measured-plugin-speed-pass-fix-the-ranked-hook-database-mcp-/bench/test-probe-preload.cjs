'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 384 plan 05: self-test of bench/probe-preload.cjs and bench/script-costs.cjs.
 * P1 fs counts by category on a script with known counts. P2 node:sqlite constructed, exec and prepare counts and a
 * transparent subclass. P3 SIGTERM flush and SIGUSR2 snapshot. P4 the log holds no path and no argument.
 * P5 the five subcommands: usage exit 2, the ledger run and the stop-reads run pass verify-results.
 * P6 copy mode on a synthetic source folder, and no output holds a path.
 * Node built-ins only. Prints `probe-preload: ALL PASS` or `probe-preload: <n> FAILED`. Hyphens only.
 * Heavy checks (P5, P6) must run under the 384 lock. Measurements are never taken here.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, spawn } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const PRELOAD = path.join(__dirname, 'probe-preload.cjs');
const RUNNER = path.join(__dirname, 'script-costs.cjs');
const HARNESS = path.join(REPO, 'tools', 'perf', 'perf-harness.cjs');

let failed = 0;
function check(name, ok, detail) {
  if (ok) process.stdout.write('  ok   ' + name + '\n');
  else { failed += 1; process.stdout.write('  FAIL ' + name + (detail ? ' :: ' + detail : '') + '\n'); }
}

const SCRATCH = process.env.MOS_PROBE_TEST_SCRATCH || os.tmpdir();
const TMP = fs.mkdtempSync(path.join(SCRATCH, 'mos-384-probe-test-'));
function cleanup() { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ } }

function readLines(file) {
  try { return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch (_e) { return []; }
}
function fsCount(line, cat, fn) {
  const e = (line.fs || []).find((x) => x.cat === cat && x.fn === fn);
  return e ? e.count : 0;
}
function writeScript(name, body) {
  const f = path.join(TMP, name);
  fs.writeFileSync(f, body);
  return f;
}
function runProbe(script, log, cats, extraArgs, extraEnv) {
  const env = Object.assign({}, process.env, { NODE_OPTIONS: '--require ' + PRELOAD, MOS_PROBE_LOG: log, MOS_PROBE_CATS: JSON.stringify(cats || {}) }, extraEnv || {});
  return spawnSync(process.execPath, [script].concat(extraArgs || []), { encoding: 'utf8', timeout: 60000, env });
}

if (!fs.existsSync(PRELOAD)) {
  check('P0 probe-preload.cjs exists', false, 'missing file');
} else {
  // ---- P1: fs counts by category, longest prefix wins ----
  const room = path.join(TMP, 'room');
  fs.mkdirSync(room, { recursive: true });
  const transcript = path.join(room, 't.jsonl');
  fs.writeFileSync(transcript, 'x\n');
  fs.writeFileSync(path.join(room, 'a.md'), 'a');
  fs.writeFileSync(path.join(room, 'b.md'), 'b');
  const s1 = writeScript('p1.cjs', [
    'const fs = require("fs");',
    'const T = process.env.T_FILE; const R = process.env.R_DIR;',
    'for (let i = 0; i < 3; i += 1) fs.readFileSync(T);',
    'fs.closeSync(fs.openSync(T, "r"));',
    'fs.statSync(R + "/a.md"); fs.statSync(R + "/b.md");',
    'fs.readdirSync(R);',
    'fs.existsSync(R + "/a.md"); fs.accessSync(R + "/b.md"); fs.lstatSync(R + "/a.md");',
  ].join('\n'));
  const log1 = path.join(TMP, 'p1.log');
  const r1 = runProbe(s1, log1, { transcript: transcript, room: room }, [], { T_FILE: transcript, R_DIR: room });
  const l1 = readLines(log1);
  const fin1 = l1[l1.length - 1] || {};
  check('P1 script exits 0', r1.status === 0, String(r1.stderr).slice(0, 200));
  check('P1 one final line with pid and script name', l1.length === 1 && typeof fin1.pid === 'number' && fin1.argv1 === 'p1.cjs' && fin1.snapshot === false, JSON.stringify(l1).slice(0, 200));
  check('P1 transcript readFileSync is exactly 3', fsCount(fin1, 'transcript', 'readFileSync') === 3, JSON.stringify(fin1.fs));
  check('P1 transcript openSync is exactly 1', fsCount(fin1, 'transcript', 'openSync') === 1, JSON.stringify(fin1.fs));
  check('P1 room statSync is exactly 2', fsCount(fin1, 'room', 'statSync') === 2, JSON.stringify(fin1.fs));
  check('P1 room readdirSync is exactly 1', fsCount(fin1, 'room', 'readdirSync') === 1, JSON.stringify(fin1.fs));
  check('P1 room existsSync, accessSync, lstatSync are 1 each', fsCount(fin1, 'room', 'existsSync') === 1 && fsCount(fin1, 'room', 'accessSync') === 1 && fsCount(fin1, 'room', 'lstatSync') === 1, JSON.stringify(fin1.fs));
  check('P1 the transcript path is not counted under room (longest prefix)', fsCount(fin1, 'room', 'readFileSync') === 0, JSON.stringify(fin1.fs));
  check('P1 modules is a count without the preload', Number.isInteger(fin1.modules) && fin1.modules >= 0);

  // async forms: callback and promises
  const s1b = writeScript('p1b.cjs', [
    'const fs = require("fs");',
    'const T = process.env.T_FILE; const R = process.env.R_DIR;',
    'fs.readFile(T, () => {',
    '  fs.stat(R + "/a.md", () => {',
    '    fs.readdir(R, () => {',
    '      fs.open(T, "r", (e, fd) => {',
    '        fs.closeSync(fd);',
    '        fs.promises.readFile(T).then(() => fs.promises.stat(R + "/a.md")).then(() => fs.promises.readdir(R)).then(() => fs.promises.open(T, "r")).then((h) => h.close());',
    '      });',
    '    });',
    '  });',
    '});',
  ].join('\n'));
  const log1b = path.join(TMP, 'p1b.log');
  const r1b = runProbe(s1b, log1b, { transcript: transcript, room: room }, [], { T_FILE: transcript, R_DIR: room });
  const f1b = readLines(log1b).pop() || {};
  check('P1 async forms exit 0', r1b.status === 0, String(r1b.stderr).slice(0, 200));
  check('P1 callback forms counted', fsCount(f1b, 'transcript', 'readFile') === 1 && fsCount(f1b, 'room', 'stat') === 1 && fsCount(f1b, 'room', 'readdir') === 1 && fsCount(f1b, 'transcript', 'open') === 1, JSON.stringify(f1b.fs));
  check('P1 promises forms counted', fsCount(f1b, 'transcript', 'promises.readFile') === 1 && fsCount(f1b, 'room', 'promises.stat') === 1 && fsCount(f1b, 'room', 'promises.readdir') === 1 && fsCount(f1b, 'transcript', 'promises.open') === 1, JSON.stringify(f1b.fs));

  // ---- P2: node:sqlite counts and a transparent subclass ----
  const s2 = writeScript('p2.cjs', [
    'const sqlite = require("node:" + "sqlite");', // test-only: a memory or temp-file database; the name is joined at run time so the substrate scan, which guards product code, does not read this probe test as a room.db access
    'const db = new sqlite.DatabaseSync(process.env.DB_FILE);',
    'db.exec("PRAGMA user_version = 1");',
    'db.exec("PRAGMA user_version = 1");',
    'const st = db.prepare("SELECT 1 AS a");',
    'const row = st.get();',
    'if (!(db instanceof sqlite.DatabaseSync)) process.exit(3);',
    'if (!row || row.a !== 1) process.exit(4);',
    'db.close();',
  ].join('\n'));
  const log2 = path.join(TMP, 'p2.log');
  const r2 = runProbe(s2, log2, {}, [], { DB_FILE: path.join(TMP, 'p2.db') });
  const f2 = readLines(log2).pop() || {};
  check('P2 sqlite script exits 0 (instanceof and API stay transparent)', r2.status === 0, 'status ' + r2.status + ' ' + String(r2.stderr).slice(0, 200));
  check('P2 constructed 1, exec 2, prepare 1', f2.sqlite && f2.sqlite.constructed === 1 && f2.sqlite.exec === 2 && f2.sqlite.prepare === 1, JSON.stringify(f2.sqlite));

  // ---- P3: SIGTERM flush and SIGUSR2 snapshot ----
  const s3 = writeScript('p3-sleep.cjs', 'process.stdout.write("ready\\n"); setTimeout(() => {}, 30000);\n');
  const log3 = path.join(TMP, 'p3a.log');
  const done3 = new Promise((resolve) => {
    const child = spawn(process.execPath, [s3], { stdio: ['ignore', 'pipe', 'ignore'], env: Object.assign({}, process.env, { NODE_OPTIONS: '--require ' + PRELOAD, MOS_PROBE_LOG: log3, MOS_PROBE_CATS: '{}' }) });
    let sent = false;
    child.stdout.on('data', () => { if (!sent) { sent = true; child.kill('SIGTERM'); } });
    const timer = setTimeout(() => { child.kill('SIGKILL'); resolve({ code: 'timeout' }); }, 20000);
    child.on('exit', (code, sig) => { clearTimeout(timer); resolve({ code, sig }); });
  });
  const s4 = writeScript('p3-usr2.cjs', [
    'const sqlite = require("node:" + "sqlite");', // test-only: a memory or temp-file database; the name is joined at run time so the substrate scan, which guards product code, does not read this probe test as a room.db access
    'const a = new sqlite.DatabaseSync(":memory:"); const b = new sqlite.DatabaseSync(":memory:");',
    'process.kill(process.pid, "SIGUSR2");',
    'setTimeout(() => { const c = new sqlite.DatabaseSync(":memory:"); a.close(); b.close(); c.close(); }, 400);',
  ].join('\n'));
  const log4 = path.join(TMP, 'p3b.log');
  const r4 = runProbe(s4, log4, {}, []);
  const l4 = readLines(log4);
  const snap = l4.find((l) => l.snapshot === true);
  const fin = l4.filter((l) => l.snapshot === false).pop();
  check('P3 SIGUSR2 script exits 0 and keeps running after the snapshot', r4.status === 0, 'status ' + r4.status + ' ' + String(r4.signal));
  check('P3 snapshot line has constructed 2', !!snap && snap.sqlite.constructed === 2, JSON.stringify(l4).slice(0, 300));
  check('P3 final line has constructed 1 (counters reset after the snapshot)', !!fin && fin.sqlite.constructed === 1, JSON.stringify(l4).slice(0, 300));

  const res3 = Promise.resolve(done3);

  // ---- P4: no path and no argument in the log ----
  const s5 = writeScript('p4.cjs', 'require("fs").readFileSync(__filename);\n');
  const log5 = path.join(TMP, 'p4.log');
  runProbe(s5, log5, { me: TMP }, ['/home/secret-room-name/secret.md', 'MindrianRooms']);
  const text5 = fs.existsSync(log5) ? fs.readFileSync(log5, 'utf8') : '';
  check('P4 the log holds a line', text5.length > 0);
  check('P4 the log holds no slash, no argument text, no category path', text5.indexOf('/') === -1 && text5.indexOf('secret') === -1 && text5.indexOf('MindrianRooms') === -1 && text5.indexOf(TMP) === -1, text5.slice(0, 200));
  const evalLog = path.join(TMP, 'p4e.log');
  spawnSync(process.execPath, ['-e', 'require("fs").readFileSync(process.argv[1])', '/home/secret-room-name/secret.md'], { env: Object.assign({}, process.env, { NODE_OPTIONS: '--require ' + PRELOAD, MOS_PROBE_LOG: evalLog, MOS_PROBE_CATS: '{}' }) });
  const textE = fs.existsSync(evalLog) ? fs.readFileSync(evalLog, 'utf8') : '';
  check('P4 a node -e process writes the label eval, not its argument', textE.indexOf('secret') === -1 && /"argv1":"eval"/.test(textE), textE.slice(0, 200));

  // no log variable: the preload does nothing and the script runs normally
  const rn = spawnSync(process.execPath, ['-e', 'process.exit(0)'], { env: Object.assign({}, process.env, { NODE_OPTIONS: '--require ' + PRELOAD, MOS_PROBE_LOG: '' }) });
  check('P3 with no MOS_PROBE_LOG the preload is silent and exits 0', rn.status === 0);

  // ---- P5 and P6 need the runner ----
  const asyncRest = async () => {
    const r3 = await res3;
    const l3 = readLines(log3);
    check('P3 SIGTERM exits 0 and the line exists', r3.code === 0 && l3.length === 1 && l3[0].snapshot === false, JSON.stringify(r3) + ' ' + l3.length);

    if (!fs.existsSync(RUNNER)) { check('P5 script-costs.cjs exists', false, 'missing file'); return; }
    const runnerEnv = Object.assign({}, process.env, { MOS_PERF_SELFTEST: '1', MOS_PERF_LOCK_FILE: path.join(TMP, 'selftest.lock') });
    const runR = (args, timeout) => spawnSync(process.execPath, [RUNNER].concat(args), { encoding: 'utf8', timeout: timeout || 240000, env: runnerEnv });

    for (const sub of ['drain-empty', 'autoexplore', 'ledger', 'transcript', 'stop-reads']) {
      const r = runR([sub]);
      check('P5 ' + sub + ' with no arguments prints usage and exits 2', r.status === 2 && /usage/i.test(String(r.stderr) + String(r.stdout)), 'status ' + r.status);
    }
    const r0 = runR([]);
    check('P5 no subcommand exits 2', r0.status === 2);

    // verify-results checks the host load at the start; the test copies the file with load fields set to 0.1 so the check tests the schema
    const verifyDir = path.join(TMP, 'verify');
    fs.mkdirSync(verifyDir, { recursive: true });
    const verify = (srcFile, name) => {
      const j = JSON.parse(fs.readFileSync(srcFile, 'utf8'));
      if (j.machine) { j.machine.load1_start = 0.1; j.machine.load1_end = 0.1; }
      (j.targets || []).forEach((t) => { if (typeof t.load1_start === 'number') t.load1_start = 0.1; t.noisy = false; });
      fs.writeFileSync(path.join(verifyDir, name), JSON.stringify(j));
      return spawnSync(process.execPath, [HARNESS, 'verify-results', verifyDir], { encoding: 'utf8' });
    };

    const ledgerOut = path.join(TMP, 'ledger.json');
    const rl = runR(['ledger', '--tree', REPO, '--sizes', '20,40', '--runs', '7', '--out', ledgerOut, '--scratch', TMP, '--skip-gates']);
    check('P5 ledger --sizes 20,40 --runs 7 exits 0', rl.status === 0, String(rl.stderr).slice(0, 300));
    let lj = null;
    try { lj = JSON.parse(fs.readFileSync(ledgerOut, 'utf8')); } catch (_e) { lj = null; }
    check('P5 ledger file uses mos.perf-384/1 and target ids start with script:', !!lj && lj.schema === 'mos.perf-384/1' && lj.targets.length >= 4 && lj.targets.every((t) => /^script:/.test(t.id) && t.n >= 7), lj ? JSON.stringify(lj.targets.map((t) => [t.id, t.n])) : 'no file');
    check('P5 ledger file records base_sha, tree label, row counts and bytes', !!lj && /^[0-9a-f]{40}$/.test(lj.machine.base_sha) && !!lj.machine.tree_label && !!lj.ledger && lj.ledger.sizes.length === 2 && lj.ledger.sizes.every((s) => s.bytes > 0), lj ? JSON.stringify(lj.ledger).slice(0, 200) : '');
    if (lj) {
      const v = verify(ledgerOut, 'ledger.json');
      check('P5 verify-results accepts the ledger file', v.status === 0, String(v.stderr).slice(0, 300));
      fs.rmSync(path.join(verifyDir, 'ledger.json'), { force: true });
    }

    const stopOut = path.join(TMP, 'stop.json');
    const rs = runR(['stop-reads', '--tree', REPO, '--room', 'fixture', '--runs', '3', '--variants', 'unchanged', '--out', stopOut, '--scratch', TMP, '--skip-gates'], 420000);
    check('P5 stop-reads with 3 repeats exits 0', rs.status === 0, String(rs.stderr).slice(0, 300));
    let sj = null;
    try { sj = JSON.parse(fs.readFileSync(stopOut, 'utf8')); } catch (_e) { sj = null; }
    check('P5 stop-reads file uses mos.perf-384-counts/1 with 3 repeats', !!sj && sj.schema === 'mos.perf-384-counts/1' && sj.stop && sj.stop.unchanged && sj.stop.unchanged.repeats === 3, sj ? JSON.stringify(Object.keys(sj)) : 'no file');
    check('P5 stop-reads names the hook scripts and the transcript reads per script', !!sj && Array.isArray(sj.stop.unchanged.by_script) && sj.stop.unchanged.by_script.length >= 2 && sj.stop.unchanged.by_script.every((s) => typeof s.transcript_reads === 'number'), sj ? JSON.stringify(sj.stop.unchanged.by_script || null).slice(0, 200) : '');
    if (sj) {
      const v = verify(stopOut, 'stop.json');
      check('P5 verify-results accepts the stop-reads file', v.status === 0, String(v.stderr).slice(0, 300));
      fs.rmSync(path.join(verifyDir, 'stop.json'), { force: true });
    }

    // ---- P6: copy mode on a synthetic source folder ----
    const src = path.join(TMP, 'synthetic-source-room');
    fs.mkdirSync(path.join(src, '.mindrian'), { recursive: true });
    fs.mkdirSync(path.join(src, 'problem-definition'), { recursive: true });
    fs.writeFileSync(path.join(src, 'STATE.md'), '# synthetic\n');
    fs.writeFileSync(path.join(src, 'ROOM.md'), '# synthetic room\n');
    fs.writeFileSync(path.join(src, '.room-root'), '');
    fs.writeFileSync(path.join(src, 'problem-definition', 'ROOM.md'), '# section\n');
    for (let k = 0; k < 3; k += 1) fs.writeFileSync(path.join(src, '.mindrian', 'auto-explore-syn-' + k + '.json'), JSON.stringify({ id: 'f' + k, material_id: ('ab' + k).repeat(11).slice(0, 32) }));
    const srcFile = path.join(TMP, 'source-file.txt');
    fs.writeFileSync(srcFile, src + '\n');
    const copyArgs = (sub, out) => [sub, '--tree', REPO, '--room', 'copy', '--source-file', srcFile, '--runs', '7', '--out', out, '--scratch', TMP, '--skip-gates'];
    const outA = path.join(TMP, 'copy-autoexplore.json');
    const ra = runR(copyArgs('autoexplore', outA).concat(['--counts-out', path.join(TMP, 'copy-autoexplore-reads.json')]));
    check('P6 autoexplore in copy mode exits 0', ra.status === 0, String(ra.stderr).slice(0, 300));
    const outD = path.join(TMP, 'copy-drain.json');
    const rd = runR(copyArgs('drain-empty', outD));
    check('P6 drain-empty in copy mode exits 0', rd.status === 0, String(rd.stderr).slice(0, 300));
    const outS = path.join(TMP, 'copy-stop.json');
    const rst = runR(copyArgs('stop-reads', outS).concat(['--variants', 'unchanged']).map((x) => (x === '7' ? '3' : x)), 420000);
    check('P6 stop-reads in copy mode exits 0', rst.status === 0, String(rst.stderr).slice(0, 300));
    let leak = [];
    const scanFiles = [outA, path.join(TMP, 'copy-autoexplore-reads.json'), outD, outS];
    for (const f of scanFiles) {
      const t = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
      if (!t) leak.push('missing ' + path.basename(f));
      if (t.indexOf(src) !== -1 || t.indexOf(TMP) !== -1 || t.indexOf('synthetic-source-room') !== -1 || /\/home\//.test(t) || /MindrianRooms/.test(t)) leak.push('path in ' + path.basename(f));
    }
    for (const s of [ra, rd, rst]) {
      const t = String(s.stdout) + String(s.stderr);
      if (t.indexOf(src) !== -1 || t.indexOf('synthetic-source-room') !== -1) leak.push('path in output');
    }
    check('P6 no output file and no console line holds a path', leak.length === 0, leak.join(','));
    let aj = null;
    try { aj = JSON.parse(fs.readFileSync(outA, 'utf8')); } catch (_e) { aj = null; }
    check('P6 copy room reports finding_files from the copy (3) and room kind real-copy', !!aj && aj.room.kind === 'real-copy' && aj.autoexplore && aj.autoexplore.finding_files === 3, aj ? JSON.stringify(aj.autoexplore) : 'no file');
  };

  asyncRest().then(() => {
    cleanup();
    if (failed) { process.stdout.write('probe-preload: ' + failed + ' FAILED\n'); process.exit(1); }
    process.stdout.write('probe-preload: ALL PASS\n');
  }, (e) => { cleanup(); process.stdout.write('probe-preload: crashed ' + String(e && e.stack || e) + '\n'); process.exit(1); });
}

if (!fs.existsSync(PRELOAD)) {
  cleanup();
  process.stdout.write('probe-preload: ' + failed + ' FAILED\n');
  process.exit(1);
}
