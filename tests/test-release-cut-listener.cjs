'use strict';
/*
 * tests/test-release-cut-listener.cjs -- quick 261002-5v9 (navigator ruling 2026-10-02).
 *
 * Offline unit suite for scripts/release-cut-listener.cjs. Nothing here
 * spawns Theo, opens a network socket or touches the real website repo:
 * the Theo leg runs against fake deps (a fake spawnSync that records its
 * calls), and the website leg runs against mkdtemp fixture trees.
 *
 * Covers: every row of Theo's exit-code table (docs/RELEASE-SYNC-CONTRACT.md
 * in the Theo repo), unknown and inconsistent answers, the three SKIPPED
 * paths, --dry-run, usage errors, the website OK / DRIFT / MISSING / GONE /
 * REVIEW / UNMIRRORED rows, every banned rule plus the allowed JHU Press
 * citation and the .next / node_modules / *.map exclusions, the read-only
 * hash proof, --json, the report file and its write-failure path, and a
 * guarded lockstep against Theo's contract doc.
 *
 * Bare node script: assert, an ok(label) counter, no framework, non-zero
 * exit on any assertion failure (uncaught throw), temp dirs removed in finally.
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const REPO = path.resolve(__dirname, '..');
const L = require(path.join(REPO, 'scripts', 'release-cut-listener.cjs'));

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

console.log('test-release-cut-listener:');

const SHA = 'a'.repeat(40);
const VER = '2.0.0-beta.56';
const EM = '\u2014';

// ---------------------------------------------------------------------------
// Fake deps for the Theo leg
// ---------------------------------------------------------------------------
function theoFake(opts) {
  opts = opts || {};
  const calls = [];
  const outBuf = [];
  const errBuf = [];
  const writes = [];
  const present = opts.present || {};
  const theoDir = '/fake/Theo';
  const py = theoDir + '/.theo-graph/.venv/bin/python3';
  const script = theoDir + '/.theo-graph/release_sync.py';
  const exists = {};
  exists[theoDir] = present.theoDir !== false;
  exists[py] = present.python !== false;
  exists[script] = present.script !== false;
  const deps = L.makeDeps({
    env: Object.assign({ THEO_DIR: theoDir }, opts.env || {}),
    homedir: function () { return '/fake/home'; },
    existsSync: function (p) {
      if (Object.prototype.hasOwnProperty.call(exists, p)) return exists[p];
      return fs.existsSync(p);
    },
    spawnSync: function (cmd, args, o) {
      calls.push({ cmd: cmd, args: args, opts: o });
      if (opts.spawn) return opts.spawn(cmd, args, o);
      return { status: 0, stdout: theoLine(0, 'already-current') + '\n', stderr: null };
    },
    readRepoVersion: function () { return VER; },
    gitHeadSha: function () { return SHA; },
    gitLatestTag: function () { return '2.0.0-beta.55'; },
    writeFileSync: function (p, data) {
      if (opts.writeFail) throw new Error('EACCES: simulated write failure');
      writes.push({ p: p, data: data });
    },
    mkdirSync: function () { if (opts.writeFail) throw new Error('EACCES: simulated mkdir failure'); },
    out: function (t) { outBuf.push(String(t)); },
    err: function (t) { errBuf.push(String(t)); },
  });
  return {
    deps: deps, calls: calls, writes: writes, py: py, script: script, theoDir: theoDir,
    out: function () { return outBuf.join('\n'); },
    errText: function () { return errBuf.join('\n'); },
    outLines: outBuf,
  };
}

function theoLine(code, status, extra) {
  return JSON.stringify(Object.assign({
    contract: 'theo-release-sync/1',
    mode: 'propose',
    status: status,
    exit_code: code,
    version: VER,
    expected_stamp: 'command-registry@' + VER,
    live_stamp: 'command-registry@2.0.0-beta.51',
    windows: [],
    plugin_ref: SHA,
    plugin_ref_sha: SHA,
    payload: null,
    evidence: null,
    record_commit: null,
    apply_command: null,
    verify_command: null,
    followon_command: null,
    message: 'Theo says ' + status + '.',
  }, extra || {}));
}

function mapCode(code, status, extra) {
  return L.mapTheoResult({ status: code, stdout: 'progress noise is never here\n' + theoLine(code, status, extra) + '\n', error: null, signal: null });
}

// ---------------------------------------------------------------------------
// Exports exist
// ---------------------------------------------------------------------------
{
  ['main', 'mapTheoResult', 'runTheoLeg', 'runWebsiteLeg', 'renderReport', 'makeDeps'].forEach(function (k) {
    assert.equal(typeof L[k], 'function', k + ' must be an exported function');
  });
  assert.equal(typeof L.THEO_EXIT_MAP, 'object');
  assert.equal(L.LISTENER_EXIT.OK, 0);
  assert.equal(L.LISTENER_EXIT.INTERNAL, 1);
  assert.equal(L.LISTENER_EXIT.USAGE, 2);
  assert.equal(L.LISTENER_EXIT.SKIPPED, 3);
  assert.equal(L.LISTENER_EXIT.DRIFT, 4);
  assert.equal(L.LISTENER_EXIT.STOP, 10);
  assert.equal(L.LISTENER_EXIT.STOP_WITH_ACTION, 11);
  ok('exports: main, mapTheoResult, runTheoLeg, runWebsiteLeg, renderReport, makeDeps, THEO_EXIT_MAP, LISTENER_EXIT (0/1/2/3/4/10/11)');
}

// ---------------------------------------------------------------------------
// mapTheoResult: every contract row
// ---------------------------------------------------------------------------
{
  let r = mapCode(0, 'already-current');
  assert.equal(r.outcome, 'RAN-OK'); assert.equal(r.decision, 'CONTINUE');
  ok('code 0 already-current -> RAN-OK / CONTINUE');

  r = mapCode(0, 'verified', { mode: 'verify', followon_command: 'node scripts/refresh-framework-names.cjs --live' });
  assert.equal(r.outcome, 'RAN-OK'); assert.equal(r.decision, 'CONTINUE');
  assert.ok(r.actions.indexOf('node scripts/refresh-framework-names.cjs --live') !== -1, 'verified surfaces followon_command verbatim');
  ok('code 0 verified -> RAN-OK / CONTINUE and surfaces followon_command');

  r = mapCode(21, 'verified-record-uncommitted', { mode: 'verify', followon_command: 'node scripts/refresh-framework-names.cjs --live' });
  assert.equal(r.outcome, 'RAN-DRIFT'); assert.equal(r.decision, 'CONTINUE');
  assert.ok(/Theo's record needs a manual commit/.test(r.reason), r.reason);
  assert.ok(r.actions.indexOf('node scripts/refresh-framework-names.cjs --live') !== -1);
  ok('code 21 -> RAN-DRIFT / CONTINUE with "Theo\'s record needs a manual commit" and the follow-on');

  const apply = '/home/x/Theo/.theo-graph/.venv/bin/python3 /home/x/Theo/.theo-graph/release_sync.py --apply --token "t0k en" --version 2.0.0-beta.56';
  const verify = '/home/x/Theo/.theo-graph/.venv/bin/python3 /home/x/Theo/.theo-graph/release_sync.py --verify --version 2.0.0-beta.56 --ref ' + SHA;
  r = mapCode(20, 'awaiting-navigator-apply', { apply_command: apply, verify_command: verify });
  assert.equal(r.outcome, 'STOP'); assert.equal(r.decision, 'STOP-WITH-ACTION');
  const ia = r.actions.indexOf(apply);
  const iv = r.actions.indexOf(verify);
  assert.ok(ia !== -1, 'apply_command byte-for-byte in actions');
  assert.ok(iv !== -1, 'verify_command byte-for-byte in actions');
  assert.ok(ia < iv, 'apply before verify');
  assert.ok(/^1\. Apply/.test(r.actions[0]), r.actions[0]);
  assert.ok(r.actions.some(function (a) { return /^2\. Verify/.test(a); }));
  assert.ok(r.actions.some(function (a) { return /^3\. .*refresh-framework-names\.cjs --live/.test(a); }));
  ok('code 20 -> STOP-WITH-ACTION, actions carry apply_command then verify_command byte-for-byte, numbered 1/2/3');

  r = mapCode(20, 'awaiting-navigator-apply', { apply_command: null, verify_command: verify });
  assert.equal(r.outcome, 'STOP'); assert.equal(r.decision, 'STOP');
  ok('code 20 without apply_command -> plain STOP (contract violation, never a pass)');

  r = mapCode(22, 'not-yet-applied', { mode: 'verify', verify_command: verify });
  assert.equal(r.outcome, 'STOP'); assert.equal(r.decision, 'STOP-WITH-ACTION');
  assert.ok(r.actions.indexOf(verify) !== -1, 'verify_command verbatim at 22');
  assert.ok(/apply/i.test(r.actions.join('\n')));
  ok('code 22 -> STOP-WITH-ACTION (run apply, then verify; verify_command verbatim)');

  const stops = [
    [1, 'internal-error', /navigator/i],
    [2, 'usage-error', /fix the call/i],
    [3, 'input-error', /sha and version/i],
    [5, 'canon-read-failure', /never treated as current/i],
    [23, 'plugin-ref-moved', /full sha/i],
    [30, 'needs-mapping-review', /Theo phase/i],
    [31, 'spent-seam', /Theo phase/i],
    [40, 'dry-run-refused', /navigator/i],
  ];
  stops.forEach(function (s) {
    const m = mapCode(s[0], s[1]);
    assert.equal(m.outcome, 'STOP', 'code ' + s[0]);
    assert.equal(m.decision, 'STOP', 'code ' + s[0]);
    assert.ok(s[2].test(m.reason), 'code ' + s[0] + ' reason: ' + m.reason);
    assert.equal(m.theo_exit_code, s[0]);
  });
  ok('codes 1, 2, 3, 5, 23, 30, 31, 40 -> STOP with the contract\'s "what to do" sentence (5 says never treated as current)');

  r = mapCode(10, 'deferred-window-open', { windows: [
    { id: 'w-366-graph', file: 'a.md', ends_when: 'Phase 366 closes' },
    { id: 'w-267-mcp', file: 'b.md', ends_when: 'the 267 merge lands' },
  ] });
  assert.equal(r.outcome, 'STOP'); assert.equal(r.decision, 'STOP');
  ['w-366-graph', 'Phase 366 closes', 'w-267-mcp', 'the 267 merge lands'].forEach(function (s) {
    assert.ok(r.reason.indexOf(s) !== -1 || r.actions.join('\n').indexOf(s) !== -1, 'code 10 names ' + s);
  });
  ok('code 10 -> STOP naming every windows[].id and ends_when');
}

// ---------------------------------------------------------------------------
// mapTheoResult: unknown and inconsistent answers never pass
// ---------------------------------------------------------------------------
{
  let r = L.mapTheoResult({ status: 99, stdout: theoLine(99, 'mystery'), error: null, signal: null });
  assert.equal(r.outcome, 'STOP');
  ok('unknown code 99 -> STOP');

  r = L.mapTheoResult({ status: 0, stdout: '', error: null, signal: null });
  assert.equal(r.outcome, 'STOP');
  assert.ok(/contract violation/.test(r.reason) && /never treated as current/.test(r.reason), r.reason);
  ok('exit 0 with empty stdout -> STOP (contract violation, never treated as current)');

  r = L.mapTheoResult({ status: 0, stdout: 'not json at all\n', error: null, signal: null });
  assert.equal(r.outcome, 'STOP');
  ok('exit 0 with unparseable stdout -> STOP');

  r = L.mapTheoResult({ status: 0, stdout: theoLine(0, 'already-current', { contract: 'theo-release-sync/2' }), error: null, signal: null });
  assert.equal(r.outcome, 'STOP');
  ok('wrong contract field -> STOP');

  r = L.mapTheoResult({ status: 0, stdout: theoLine(20, 'awaiting-navigator-apply'), error: null, signal: null });
  assert.equal(r.outcome, 'STOP');
  ok('JSON exit_code differs from the process code -> STOP');

  r = L.mapTheoResult({ status: 0, stdout: theoLine(0, 'awaiting-navigator-apply'), error: null, signal: null });
  assert.equal(r.outcome, 'STOP');
  ok('status that does not belong to its code -> STOP');

  const e = new Error('spawnSync python3 ETIMEDOUT'); e.code = 'ETIMEDOUT';
  r = L.mapTheoResult({ status: null, stdout: '', error: e, signal: 'SIGTERM' });
  assert.equal(r.outcome, 'STOP');
  assert.ok(/THEO_SYNC_TIMEOUT_MS/.test(r.reason), r.reason);
  r = L.mapTheoResult({ status: null, stdout: '', error: null, signal: 'SIGKILL' });
  assert.equal(r.outcome, 'STOP');
  assert.ok(/THEO_SYNC_TIMEOUT_MS/.test(r.reason), r.reason);
  ok('spawn timeout (ETIMEDOUT or a signal) -> STOP naming THEO_SYNC_TIMEOUT_MS');
}

// ---------------------------------------------------------------------------
// runTheoLeg: SKIPPED paths, dry-run, exact argv, usage errors
// ---------------------------------------------------------------------------
{
  [['theoDir', 'THEO_DIR', '/fake/Theo'],
   ['python', 'python', '/fake/Theo/.theo-graph/.venv/bin/python3'],
   ['script', 'release_sync.py', '/fake/Theo/.theo-graph/release_sync.py']].forEach(function (c) {
    const present = {}; present[c[0]] = false;
    const f = theoFake({ present: present });
    const leg = L.runTheoLeg({ pluginRoot: REPO, version: VER, ref: SHA, dryRun: false }, f.deps);
    assert.equal(leg.outcome, 'SKIPPED', c[0]);
    assert.ok(leg.reason.indexOf(c[2]) !== -1, 'reason names the missing path: ' + leg.reason);
    assert.ok(/^SKIPPED: /.test(leg.reason));
    assert.ok(/Step 0\.6 stamp gate still guards/.test(leg.reason));
    assert.equal(f.calls.length, 0, 'spawnSync never called when ' + c[0] + ' missing');
    const code = L.main(['theo', '--plugin-root', REPO, '--version', VER, '--ref', SHA, '--report-dir', '/fake/reports'], f.deps);
    assert.equal(code, 3, 'listener exit 3 when ' + c[0] + ' missing');
    assert.equal(f.calls.length, 0);
  });
  ok('THEO_DIR / python / release_sync.py missing -> SKIPPED naming the path, spawn never called, exit 3');

  const f = theoFake();
  const code = L.main(['theo', '--dry-run', '--plugin-root', REPO, '--version', VER, '--ref', SHA], f.deps);
  assert.equal(code, 3);
  assert.equal(f.calls.length, 0, 'dry-run never spawns');
  const o = f.out();
  assert.ok(o.indexOf(f.py) !== -1 && o.indexOf(f.script) !== -1, 'call line names python and script');
  assert.ok(o.indexOf('--plugin-root') !== -1 && o.indexOf('--version ' + VER) !== -1 && o.indexOf('--ref ' + SHA) !== -1 && o.indexOf('--json') !== -1, o);
  assert.ok(/--dry-run: printed the call, ran nothing/.test(o));
  assert.ok(/report: not written under --dry-run/.test(o));
  assert.equal(f.writes.length, 0, 'no report file under --dry-run');
  ok('--dry-run with Theo present -> prints the full call line, spawns nothing, SKIPPED, exit 3, no report file');

  const f2 = theoFake();
  const leg2 = L.runTheoLeg({ pluginRoot: '/plug root', version: VER, ref: SHA, dryRun: false }, f2.deps);
  assert.equal(f2.calls.length, 1);
  assert.equal(f2.calls[0].cmd, f2.py);
  assert.deepEqual(f2.calls[0].args, [f2.script, '--plugin-root', '/plug root', '--version', VER, '--ref', SHA, '--json']);
  assert.ok(!f2.calls[0].opts.shell, 'no shell');
  assert.equal(f2.calls[0].opts.cwd, f2.theoDir);
  assert.deepEqual(f2.calls[0].opts.stdio, ['ignore', 'pipe', 'inherit'], 'stderr inherited, never captured');
  assert.equal(f2.calls[0].opts.timeout, 600000, 'default THEO_SYNC_TIMEOUT_MS');
  assert.equal(leg2.outcome, 'RAN-OK');
  ok('real run passes argv exactly [script, --plugin-root, root, --version, v, --ref, sha, --json], no shell, stderr inherited');

  const f3 = theoFake({ env: { THEO_SYNC_TIMEOUT_MS: '1234' } });
  L.runTheoLeg({ pluginRoot: REPO, version: VER, ref: SHA, dryRun: false }, f3.deps);
  assert.equal(f3.calls[0].opts.timeout, 1234);
  ok('THEO_SYNC_TIMEOUT_MS env overrides the spawn timeout');

  const f4 = theoFake();
  assert.equal(L.main(['theo', '--version', 'v' + VER, '--ref', SHA], f4.deps), 2);
  assert.equal(L.main(['theo', '--version', VER, '--ref', 'HEAD'], f4.deps), 2);
  assert.equal(L.main(['theo', '--version', VER, '--ref', 'A'.repeat(40)], f4.deps), 2);
  assert.equal(f4.calls.length, 0);
  ok('--version with a leading v, or --ref that is not 40 lowercase hex -> exit 2 before any spawn');

  const f5 = theoFake({ spawn: function () { const e = new Error('spawnSync ENOENT'); e.code = 'ENOENT'; return { status: null, stdout: '', error: e }; } });
  const leg5 = L.runTheoLeg({ pluginRoot: REPO, version: VER, ref: SHA, dryRun: false }, f5.deps);
  assert.equal(leg5.outcome, 'SKIPPED');
  ok('spawn error ENOENT -> SKIPPED (venv unusable)');

  const f6 = theoFake({ spawn: function () { return { status: 20, stdout: theoLine(20, 'awaiting-navigator-apply', { apply_command: 'APPLY LINE', verify_command: 'VERIFY LINE' }) }; } });
  const c6 = L.main(['theo', '--version', VER, '--ref', SHA, '--report-dir', '/fake/reports'], f6.deps);
  assert.equal(c6, 11);
  const out6 = f6.outLines;
  assert.ok(out6.indexOf('APPLY LINE') !== -1, 'apply line printed on its own line, unwrapped');
  assert.ok(out6.indexOf('VERIFY LINE') !== -1, 'verify line printed on its own line, unwrapped');
  const f7 = theoFake({ spawn: function () { return { status: 3, stdout: theoLine(3, 'input-error') }; } });
  assert.equal(L.main(['theo', '--version', VER, '--ref', SHA, '--report-dir', '/fake/reports'], f7.deps), 10);
  const f8 = theoFake({ spawn: function () { return { status: 21, stdout: theoLine(21, 'verified-record-uncommitted', { mode: 'verify' }) }; } });
  assert.equal(L.main(['theo', '--version', VER, '--ref', SHA, '--report-dir', '/fake/reports'], f8.deps), 4);
  ok('main exit codes: 20 -> 11 (actions printed verbatim on their own lines), 3 -> 10, 21 -> 4');

  const f9 = theoFake();
  L.main(['theo', '--report-dir', '/fake/reports'], f9.deps);
  assert.deepEqual(f9.calls[0].args.slice(1), ['--plugin-root', REPO, '--version', VER, '--ref', SHA, '--json']);
  ok('defaults: --version from readRepoVersion (repo-version.cjs), --ref from gitHeadSha');
}

// ---------------------------------------------------------------------------
// main: usage, --json, report file, write failure
// ---------------------------------------------------------------------------
{
  const f = theoFake();
  assert.equal(L.main(['bogus'], f.deps), 2);
  assert.ok(/Usage/i.test(f.errText()));
  assert.equal(L.main(['theo', '--frobnicate'], f.deps), 2);
  assert.equal(L.main(['all', '--version', VER], f.deps), 2);
  assert.equal(L.main([], f.deps), 2);
  ok('unknown subcommand, unknown flag, no subcommand, `all --version x` -> exit 2 with usage');

  const fh = theoFake();
  assert.equal(L.main(['help'], fh.deps), 0);
  assert.ok(/Usage/i.test(fh.out()));
  ok('help -> usage on stdout, exit 0');

  // Review CR-01: help after a subcommand must never fall through to a live
  // Theo propose (or a website scan + report write).
  [['theo', '--help'], ['theo', '-h'], ['all', '--help'], ['website', '--help'],
   ['--help', 'theo'], ['theo', '--version', VER, '--ref', SHA, '--help']].forEach(function (argv) {
    const fh2 = theoFake();
    assert.equal(L.main(argv, fh2.deps), 0, argv.join(' ') + ' exits 0');
    assert.equal(fh2.calls.length, 0, argv.join(' ') + ' spawns nothing');
    assert.equal(fh2.writes.length, 0, argv.join(' ') + ' writes no report');
    assert.ok(/Usage/i.test(fh2.out()), argv.join(' ') + ' prints usage');
  });
  // Review WR-01: a valued flag never swallows the next flag.
  [['theo', '--report-dir', '--dry-run'],
   ['theo', '--plugin-root', '--dry-run'],
   ['website', '--website-dir', '--dry-run'],
   ['theo', '--version', '--dry-run'],
   ['theo', '--ref', '--json'],
   ['theo', '--dry-run', '--report-dir']].forEach(function (argv) {
    const fv = theoFake();
    assert.equal(L.main(argv, fv.deps), 2, argv.join(' ') + ' -> usage exit 2');
    assert.equal(fv.calls.length, 0, argv.join(' ') + ' spawns nothing');
    assert.equal(fv.writes.length, 0, argv.join(' ') + ' writes no report');
    assert.ok(/needs a value/.test(fv.errText()), fv.errText());
  });
  ok('WR-01: a valued flag followed by a flag or nothing (theo --report-dir --dry-run, ...) -> exit 2, zero spawns');

  ok('CR-01: theo --help / theo -h / all --help / website --help -> usage, exit 0, zero spawns, no report');

  const fj = theoFake();
  const cj = L.main(['theo', '--json', '--version', VER, '--ref', SHA, '--report-dir', '/fake/reports'], fj.deps);
  assert.equal(cj, 0);
  assert.equal(fj.outLines.length, 1, 'exactly one stdout line under --json, got ' + fj.outLines.length);
  assert.equal(fj.outLines[0].indexOf('\n'), -1);
  const parsed = JSON.parse(fj.outLines[0]);
  assert.equal(parsed.contract, 'mos-release-cut-listener/1');
  assert.equal(parsed.exit_code, 0);
  assert.equal(parsed.legs[0].leg, 'theo');
  assert.equal(parsed.legs[0].outcome, 'RAN-OK');
  assert.deepEqual(parsed.legs[0].command.slice(-1), ['--json']);
  ok('--json prints exactly one stdout line, contract mos-release-cut-listener/1');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-cutl-report-'));
  try {
    const fr = theoFake();
    const realDeps = L.makeDeps(Object.assign({}, fr.deps, { writeFileSync: fs.writeFileSync, mkdirSync: fs.mkdirSync }));
    const rdir = path.join(tmp, 'nested', 'reports');
    const cr = L.main(['theo', '--version', VER, '--ref', SHA, '--report-dir', rdir], realDeps);
    assert.equal(cr, 0);
    const files = fs.readdirSync(rdir);
    assert.equal(files.length, 1, 'exactly one report file');
    assert.ok(/^\d{8}T\d{6}Z-theo-2\.0\.0-beta\.56\.json$/.test(files[0]), files[0]);
    const rep = JSON.parse(fs.readFileSync(path.join(rdir, files[0]), 'utf8'));
    assert.equal(rep.contract, 'mos-release-cut-listener/1');
    assert.equal(rep.report_path, path.join(rdir, files[0]));
    assert.ok(fr.out().indexOf('report: ' + path.join(rdir, files[0])) !== -1, 'prints report: <path>');
    assert.ok(/RAN-OK/.test(fr.out()));
    ok('non-dry-run writes one JSON file under --report-dir (YYYYMMDDTHHMMSSZ-theo-<version>.json) and prints report: <path>');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  const fw = theoFake({ writeFail: true, spawn: function () { return { status: 3, stdout: theoLine(3, 'input-error') }; } });
  const cw = L.main(['theo', '--version', VER, '--ref', SHA, '--report-dir', '/fake/reports'], fw.deps);
  assert.equal(cw, 10, 'outcome unchanged by a write failure');
  assert.ok(/WARN: report file not written: /.test(fw.out() + fw.errText()));
  ok('report write failure prints WARN and leaves the leg outcome unchanged');

  const fenv = theoFake({ env: { MINDRIAN_CUT_LISTENER_REPORT_DIR: '/env/reports' } });
  L.main(['theo', '--version', VER, '--ref', SHA], fenv.deps);
  assert.equal(fenv.writes.length, 1);
  assert.ok(fenv.writes[0].p.indexOf('/env/reports/') === 0, fenv.writes[0].p);
  const fdef = theoFake();
  L.main(['theo', '--version', VER, '--ref', SHA], fdef.deps);
  assert.ok(fdef.writes[0].p.indexOf(path.join('/fake/home', '.mindrian', 'release-cut-listener') + path.sep) === 0, fdef.writes[0].p);
  ok('report dir: MINDRIAN_CUT_LISTENER_REPORT_DIR override, default $HOME/.mindrian/release-cut-listener');

  const fbox = theoFake({ present: { theoDir: false } });
  L.main(['theo', '--version', VER, '--ref', SHA, '--report-dir', '/fake/reports'], fbox.deps);
  const boxText = fbox.out();
  assert.ok(/release-cut listener/.test(boxText));
  assert.ok(/SKIPPED/.test(boxText));
  const boxLines = boxText.split('\n').filter(function (l) { return /^[+|]/.test(l); });
  assert.ok(boxLines.length >= 4);
  boxLines.forEach(function (l) { assert.equal(l.length, 78, 'box line width 78: ' + JSON.stringify(l)); });
  assert.ok(boxLines.some(function (l) { return l.indexOf('/fake/Theo') !== -1; }), 'SKIPPED reason (with path) inside the box');
  ok('boxed report: width 78, title line, SKIPPED reason inside the box');
}

// ---------------------------------------------------------------------------
// Website leg fixtures
// ---------------------------------------------------------------------------
function writeFile(root, rel, text) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
}

const CHECKLIST = [
  '# Version-Bump Website Reconciliation Checklist',
  '- `src/components/layout/Nav.tsx` version badge',
  '- `src/components/layout/Footer.tsx` version meta',
  '- `src/lib/version.ts` -> `FALLBACK_VERSION` constant',
  '- `src/data/commands-canon.json` -> `version` field',
  '- `src/app/roadmap/page.tsx` -> milestone labels',
  '- `src/app/about/page.tsx` -> Today entry',
  '- `src/app/page.tsx` (the live home)',
  '- `src/app/pricing/page.tsx`',
  '- `src/app/layout.tsx`',
  '- `src/components/brain/BrainPublicPage.tsx`',
  '- `src/components/home/` - `MoatLadder.tsx`, `CTASection.tsx`',
  '- `src/app/researchers/page.tsx`',
  '',
].join('\n');

function makeWebsiteFixture(n, opts) {
  opts = opts || {};
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-cutl-web-'));
  const repo = path.join(tmp, 'mindrian-website');
  const web = path.join(repo, 'website');
  const plugin = path.join(tmp, 'plugin');
  const cmds = [];
  for (let i = 0; i < n; i++) cmds.push({ name: 'c' + i });
  writeFile(plugin, 'data/command-registry.json', JSON.stringify({ commands: cmds }));
  writeFile(repo, 'docs/VERSION-BUMP-CHECKLIST.md', opts.checklist || CHECKLIST);
  writeFile(web, 'src/lib/version.ts', 'export const FALLBACK_VERSION = "v' + (opts.fallback || '2.0.0-beta.55') + '";\n');
  const half = Math.floor(n / 2);
  writeFile(web, 'src/data/commands-canon.json', JSON.stringify({
    version: opts.canonVersion || '2.0.0-beta.55',
    groups: [
      { id: 'a', label: 'A', glyph: 'x', lane: 'start', commands: cmds.slice(0, half) },
      { id: 'b', label: 'B', glyph: 'y', lane: 'core', commands: cmds.slice(half, opts.canonCount === undefined ? n : opts.canonCount) },
    ],
  }, null, 2));
  const counts = ['src/app/page.tsx', 'src/app/pricing/page.tsx', 'src/app/layout.tsx', 'src/components/brain/BrainPublicPage.tsx',
    'src/components/home/MoatLadder.tsx', 'src/components/home/CTASection.tsx', 'src/components/home/EngineSection.tsx',
    'src/components/home/SurfacesGrid.tsx', 'src/app/researchers/page.tsx'];
  counts.forEach(function (rel) { writeFile(web, rel, 'export const X = "' + n + ' commands, one room";\n'); });
  writeFile(web, 'src/app/roadmap/page.tsx', 'export const R = "v2.0 milestone";\n');
  writeFile(web, 'src/app/about/page.tsx', 'export const A = "Today: v2.0 shipped";\n');
  return { tmp: tmp, repo: repo, web: web, plugin: plugin };
}

function webDeps(extra) {
  const outBuf = [];
  const deps = L.makeDeps(Object.assign({
    env: {},
    homedir: function () { return '/nonexistent-home-for-test'; },
    out: function (t) { outBuf.push(String(t)); },
    err: function () {},
    writeFileSync: function () { throw new Error('the website leg test never writes reports here'); },
    mkdirSync: function () {},
  }, extra || {}));
  return { deps: deps, out: function () { return outBuf.join('\n'); } };
}

function hashTree(root) {
  const acc = {};
  (function walk(d) {
    fs.readdirSync(d, { withFileTypes: true }).forEach(function (e) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else acc[path.relative(root, p)] = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    });
  })(root);
  return acc;
}

function rowsBy(leg, pred) { return leg.rows.filter(pred); }

// All-matching fixture -> RAN-OK
{
  const fx = makeWebsiteFixture(113);
  try {
    const w = webDeps();
    const before = hashTree(fx.tmp);
    const leg = L.runWebsiteLeg({ pluginRoot: fx.plugin, version: '2.0.0-beta.55', websiteDir: fx.web }, w.deps);
    assert.equal(leg.outcome, 'RAN-OK', JSON.stringify(leg.rows.filter(function (r) { return r.status !== 'OK'; })) + JSON.stringify(leg.banned));
    assert.equal(leg.decision, 'CONTINUE');
    assert.equal(leg.plugin_command_count, 113);
    assert.equal(leg.website_dir, fx.web);
    assert.equal(leg.checklist_path, path.join(fx.repo, 'docs', 'VERSION-BUMP-CHECKLIST.md'));
    assert.equal(leg.counts.drift, 0); assert.equal(leg.counts.missing, 0); assert.equal(leg.counts.banned, 0);
    assert.equal(leg.counts.review, 2, 'roadmap + about are REVIEW rows');
    assert.ok(rowsBy(leg, function (r) { return r.status === 'REVIEW'; }).every(function (r) { return /roadmap|about/.test(r.file); }));
    assert.equal(leg.counts.unmirrored, 0, 'every checklist path is mirrored in SURFACES');
    const code = L.main(['website', '--plugin-root', fx.plugin, '--version', '2.0.0-beta.55', '--website-dir', fx.web, '--dry-run'], w.deps);
    assert.equal(code, 0);
    assert.deepEqual(hashTree(fx.tmp), before, 'every fixture file byte-identical after the website leg (read-only proof)');
    ok('website all-matching fixture -> RAN-OK, exit 0, REVIEW rows for roadmap + about, no UNMIRRORED; fixture bytes unchanged');
  } finally { fs.rmSync(fx.tmp, { recursive: true, force: true }); }
}

// Drift fixture
{
  const fx = makeWebsiteFixture(113, { canonVersion: '2.0.0-beta.51' });
  try {
    writeFile(fx.web, 'src/app/page.tsx', 'export const H = 1;\nexport const X = "84 commands, two lanes";\nexport const Y = "100+ commands";\n');
    const w = webDeps();
    const before = hashTree(fx.tmp);
    const leg = L.runWebsiteLeg({ pluginRoot: fx.plugin, version: '2.0.0-beta.55', websiteDir: fx.web }, w.deps);
    assert.equal(leg.outcome, 'RAN-DRIFT');
    const canonV = rowsBy(leg, function (r) { return r.file === 'src/data/commands-canon.json' && r.status === 'DRIFT'; });
    assert.equal(canonV.length, 1);
    assert.equal(canonV[0].found, '2.0.0-beta.51'); assert.equal(canonV[0].expected, '2.0.0-beta.55');
    assert.equal(canonV[0].line, 2, 'canon version on 1-based line 2');
    const lit = rowsBy(leg, function (r) { return r.file === 'src/app/page.tsx' && r.status === 'DRIFT'; });
    assert.equal(lit.length, 1, JSON.stringify(leg.rows));
    assert.equal(lit[0].line, 2); assert.equal(String(lit[0].found), '84'); assert.equal(String(lit[0].expected), '113');
    const plus = rowsBy(leg, function (r) { return r.file === 'src/app/page.tsx' && r.line === 3; });
    assert.equal(plus.length, 1); assert.equal(plus[0].status, 'OK', '"100+ commands" with N >= 100 is OK');
    const code = L.main(['website', '--plugin-root', fx.plugin, '--version', '2.0.0-beta.55', '--website-dir', fx.web, '--dry-run'], w.deps);
    assert.equal(code, 4);
    const o = w.out();
    assert.ok(o.indexOf('MOS_CANON_VERSION=2.0.0-beta.55 MOS_PLUGIN_DIR=' + fx.plugin + ' node scripts/gen-commands-canon.mjs') !== -1, 'canon recovery hint printed');
    assert.ok(/docs\/VERSION-BUMP-CHECKLIST\.md/.test(o));
    assert.ok(/src\/app\/page\.tsx:2/.test(o) || /src\/app\/page\.tsx\s.*\b2\b/.test(o), 'drift row printed with file and line');
    assert.deepEqual(hashTree(fx.tmp), before);
    ok('website drift -> stale canon version + "84 commands" DRIFT rows with 1-based lines, "100+" OK, RAN-DRIFT, exit 4, recovery hints');
  } finally { fs.rmSync(fx.tmp, { recursive: true, force: true }); }
}

// GONE / MISSING / count mismatch / UNMIRRORED / unreadable registry
{
  const fx = makeWebsiteFixture(113);
  try {
    fs.rmSync(path.join(fx.web, 'src/components/home/MoatLadder.tsx'));
    const w = webDeps();
    let leg = L.runWebsiteLeg({ pluginRoot: fx.plugin, version: '2.0.0-beta.55', websiteDir: fx.web }, w.deps);
    assert.equal(leg.outcome, 'RAN-OK', 'GONE does not flip the outcome');
    const gone = rowsBy(leg, function (r) { return r.status === 'GONE'; });
    assert.equal(gone.length, 1); assert.equal(gone[0].file, 'src/components/home/MoatLadder.tsx');
    assert.equal(leg.counts.gone, 1);
    ok('deleting a listed count file -> GONE row that does not flip the outcome');

    fs.rmSync(path.join(fx.web, 'src/lib/version.ts'));
    leg = L.runWebsiteLeg({ pluginRoot: fx.plugin, version: '2.0.0-beta.55', websiteDir: fx.web }, w.deps);
    assert.equal(leg.outcome, 'RAN-DRIFT', 'MISSING flips the outcome');
    assert.equal(rowsBy(leg, function (r) { return r.status === 'MISSING' && r.file === 'src/lib/version.ts'; }).length, 1);
    assert.equal(leg.counts.missing, 1);
    ok('deleting src/lib/version.ts -> MISSING row that flips the outcome');
  } finally { fs.rmSync(fx.tmp, { recursive: true, force: true }); }

  const fx2 = makeWebsiteFixture(113, { canonCount: 100, fallback: '2.0.0-beta.54', checklist: CHECKLIST + '- `src/lib/facts.ts` new constants\n' });
  try {
    const w = webDeps();
    const leg = L.runWebsiteLeg({ pluginRoot: fx2.plugin, version: '2.0.0-beta.55', websiteDir: fx2.web }, w.deps);
    const cnt = rowsBy(leg, function (r) { return r.surface === 'commands-canon count'; });
    assert.equal(cnt.length, 1); assert.equal(cnt[0].status, 'DRIFT'); assert.equal(Number(cnt[0].found), 100); assert.equal(Number(cnt[0].expected), 113);
    const fb = rowsBy(leg, function (r) { return r.surface === 'FALLBACK_VERSION'; });
    assert.equal(fb[0].status, 'DRIFT'); assert.equal(fb[0].found, 'v2.0.0-beta.54'); assert.equal(fb[0].expected, 'v2.0.0-beta.55'); assert.equal(fb[0].line, 1);
    const un = rowsBy(leg, function (r) { return r.status === 'UNMIRRORED'; });
    assert.equal(un.length, 1); assert.equal(un[0].file, 'src/lib/facts.ts');
    assert.equal(leg.counts.unmirrored, 1);
    ok('canon command count vs plugin count DRIFT, FALLBACK_VERSION DRIFT, an unlisted checklist path -> UNMIRRORED');

    fs.writeFileSync(path.join(fx2.plugin, 'data/command-registry.json'), '{ not json');
    const leg2 = L.runWebsiteLeg({ pluginRoot: fx2.plugin, version: '2.0.0-beta.55', websiteDir: fx2.web }, w.deps);
    assert.equal(leg2.plugin_command_count, null);
    assert.ok(rowsBy(leg2, function (r) { return r.status === 'UNKNOWN'; }).length >= 1);
    assert.equal(leg2.outcome, 'RAN-DRIFT');
    assert.ok(/command-registry\.json/.test(leg2.reason), leg2.reason);
    ok('unreadable data/command-registry.json -> count rows UNKNOWN (counted as drift), reason names the file');
  } finally { fs.rmSync(fx2.tmp, { recursive: true, force: true }); }
}

// Banned scan
{
  const fx = makeWebsiteFixture(113);
  try {
    writeFile(fx.web, 'src/app/blog/one.mdx', [
      'The graph lives in KuzuDB today.',
      'Install: claude plugin install mos@mindrian-marketplace',
      'Built on 20 years of teaching innovation.',
      'A Johns Hopkins method.',
      'We hold 15,298 frameworks.',
      'Our graph has 31,415 nodes.',
      'A sentence with a dash ' + EM + ' here.',
      'Lawrence, Book (Johns Hopkins University Press, 2019).',
      'Three S-Curves in 20 Years',
      '',
    ].join('\n'));
    const poison = 'KuzuDB claude plugin install 20 years of teaching Johns Hopkins 15,298 31,415 nodes ' + EM + '\n';
    writeFile(fx.web, 'src/.next/static/chunk.js', poison);
    writeFile(fx.web, 'src/node_modules/pkg/index.js', poison);
    writeFile(fx.web, 'src/app/blog/one.js.map', poison);
    writeFile(fx.web, 'src/app/blog/notes.txt', poison);
    const w = webDeps();
    const before = hashTree(fx.tmp);
    const leg = L.runWebsiteLeg({ pluginRoot: fx.plugin, version: '2.0.0-beta.55', websiteDir: fx.web }, w.deps);
    const byRule = {};
    leg.banned.forEach(function (b) { byRule[b.rule] = (byRule[b.rule] || []).concat([b]); });
    ['kuzudb', 'plugin-install-string', 'twenty-years', 'jhu-attribution', 'em-dash'].forEach(function (rule) {
      assert.equal((byRule[rule] || []).length, 1, rule + ' -> exactly one hit, got ' + JSON.stringify(byRule[rule]));
    });
    assert.equal((byRule['vanity-graph-count'] || []).length, 2, '15,298 and 31,415 nodes -> two vanity hits: ' + JSON.stringify(byRule['vanity-graph-count']));
    leg.banned.forEach(function (b) {
      assert.equal(b.file, 'src/app/blog/one.mdx', 'only the real source file is read: ' + b.file);
      assert.ok(b.line >= 1 && b.line <= 7);
      assert.ok(b.excerpt.length <= 80);
    });
    assert.equal(byRule.kuzudb[0].line, 1);
    assert.equal(byRule['em-dash'][0].line, 7);
    assert.equal(leg.allowed.length, 1, 'JHU Press citation lands in allowed');
    assert.equal(leg.allowed[0].rule, 'jhu-attribution'); assert.equal(leg.allowed[0].line, 8);
    assert.ok(!leg.banned.some(function (b) { return b.line === 9; }), '"Three S-Curves in 20 Years" is not a hit');
    assert.equal(leg.outcome, 'RAN-DRIFT');
    assert.equal(leg.counts.banned, 7);
    assert.deepEqual(hashTree(fx.tmp), before, 'banned scan is read-only');
    const code = L.main(['website', '--plugin-root', fx.plugin, '--version', '2.0.0-beta.55', '--website-dir', fx.web, '--dry-run'], w.deps);
    assert.equal(code, 4);
    assert.ok(/src\/app\/blog\/one\.mdx:1/.test(w.out()), 'banned hits printed as file:line');
    ok('banned scan: KuzuDB, claude plugin install, 20 years of teaching, Johns Hopkins, 15,298, 31,415 nodes, U+2014 each one hit; JHU Press allowed; "20 Years" title not a hit; .next / node_modules / *.map / .txt never read');
  } finally { fs.rmSync(fx.tmp, { recursive: true, force: true }); }
}

// Website dir missing
{
  const w = webDeps();
  const missing = path.join(os.tmpdir(), 'mos-cutl-definitely-missing-' + process.pid, 'website');
  const leg = L.runWebsiteLeg({ pluginRoot: REPO, version: '2.0.0-beta.55', websiteDir: missing }, w.deps);
  assert.equal(leg.outcome, 'SKIPPED');
  assert.ok(leg.reason.indexOf(missing) !== -1, leg.reason);
  assert.equal(L.main(['website', '--version', '2.0.0-beta.55', '--website-dir', missing, '--dry-run'], w.deps), 3);
  const w2 = webDeps({ env: { MINDRIAN_WEBSITE_DIR: missing } });
  const leg2 = L.runWebsiteLeg({ pluginRoot: REPO, version: '2.0.0-beta.55' }, w2.deps);
  assert.ok(leg2.reason.indexOf(missing) !== -1, 'MINDRIAN_WEBSITE_DIR honored');
  const w3 = webDeps();
  const leg3 = L.runWebsiteLeg({ pluginRoot: REPO, version: '2.0.0-beta.55' }, w3.deps);
  assert.ok(leg3.reason.indexOf(path.join('/nonexistent-home-for-test', 'mindrian-website', 'website')) !== -1, 'default is homedir/mindrian-website/website: ' + leg3.reason);
  ok('website dir missing -> SKIPPED naming the path, exit 3; MINDRIAN_WEBSITE_DIR and the homedir default resolve like Step 9.6b');
}

// all: two legs, precedence
{
  const fx = makeWebsiteFixture(113, { canonVersion: '2.0.0-beta.51' });
  try {
    const f = theoFake();
    const deps = L.makeDeps(Object.assign({}, f.deps, { homedir: function () { return '/nonexistent'; } }));
    const code = L.main(['all', '--dry-run', '--plugin-root', fx.plugin, '--ref', SHA, '--website-dir', fx.web], deps);
    assert.equal(code, 4, 'theo SKIPPED (3) + website DRIFT (4) -> 4');
    const o = f.out();
    assert.ok(/theo/.test(o) && /website/.test(o));
    assert.equal(f.calls.length, 0);
    ok('all --dry-run runs theo then website; precedence 4 > 3');
  } finally { fs.rmSync(fx.tmp, { recursive: true, force: true }); }
}

// ---------------------------------------------------------------------------
// Lockstep with Theo's contract doc (guarded, visible SKIP when absent)
// ---------------------------------------------------------------------------
{
  const theoDir = process.env.THEO_DIR || path.join(os.homedir(), 'Theo');
  const doc = path.join(theoDir, 'docs', 'RELEASE-SYNC-CONTRACT.md');
  if (fs.existsSync(doc)) {
    const text = fs.readFileSync(doc, 'utf8');
    const re = /^\|\s*(\d+)\s*\|\s*`([a-z-]+)`\s*\|/gm;
    let m; let n = 0;
    while ((m = re.exec(text)) !== null) {
      n += 1;
      const entry = L.THEO_EXIT_MAP[m[1]];
      assert.ok(entry, 'THEO_EXIT_MAP lacks code ' + m[1]);
      assert.ok(entry.statuses.indexOf(m[2]) !== -1, 'THEO_EXIT_MAP[' + m[1] + '] lacks status ' + m[2]);
    }
    assert.ok(n >= 14, 'expected at least 14 contract rows, parsed ' + n);
    ok('lockstep: every exit-table row in ' + doc + ' (' + n + ' rows) has a THEO_EXIT_MAP entry');
  } else {
    console.log('  SKIP: Theo contract doc not present (' + doc + ')');
  }
}

console.log(checks + ' checks passed.');
process.exit(0);
