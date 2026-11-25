#!/usr/bin/env node
'use strict';
// Phase 400.2 plan 18 (PJ-06): the recorded advisor run is prepared with zero network.
// A1 to A6. No leg sends a request: every child process runs with a preload that makes fetch, http, https and net throw.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PHASE_DIR = path.join(ROOT, '.planning', 'phases', '400.2-persona-hats-and-research-bundle-persona-builds-six-hat-pers');
const SHEET = path.join(PHASE_DIR, '400.2-ADVISOR-RUN.md');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

let failed = 0;
let passed = 0;
function check(label, fn) {
  try {
    fn();
    passed += 1;
    console.log('ok: ' + label);
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + label + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-4002-18-'));
process.on('exit', () => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ } });

// The preload: any network use throws, and a marker file proves that it was never reached.
const PRELOAD = path.join(TMP, 'no-network.cjs');
fs.writeFileSync(PRELOAD, [
  "'use strict';",
  "const fs = require('node:fs');",
  "const mark = process.env.NO_NET_MARK;",
  "const boom = (what) => () => { if (mark) fs.appendFileSync(mark, what + '\\n'); throw new Error('network blocked: ' + what); };",
  "globalThis.fetch = boom('fetch');",
  "for (const m of ['http', 'https']) { const x = require('node:' + m); x.request = boom(m + '.request'); x.get = boom(m + '.get'); }",
  "const net = require('node:net'); net.connect = boom('net.connect'); net.createConnection = boom('net.createConnection');",
  '',
].join('\n'));

function run(args, extraEnv) {
  const mark = path.join(TMP, 'net-' + Math.random().toString(16).slice(2) + '.log');
  const env = Object.assign({}, process.env, { NO_NET_MARK: mark, MINDRIAN_HOME: path.join(TMP, 'home') }, extraEnv || {});
  const r = spawnSync(process.execPath, ['--require', PRELOAD].concat(args), { cwd: ROOT, encoding: 'utf8', env });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '', netHits: fs.existsSync(mark) ? fs.readFileSync(mark, 'utf8').trim() : '' };
}

const DERIVE = path.join('scripts', 'derive-decision-fixture.cjs');
const SOURCE = { pairs: [{ job: 'navigate', command: '/mos:persona', p: 0.51234 }, { job: 'explore', command: '/mos:persona', p: 0.2 }] };
const sourceFile = path.join(TMP, 'pairs.json');
fs.writeFileSync(sourceFile, JSON.stringify(SOURCE));

check('A1. derive with --recorded-at writes that date; no flag writes 2026-11-24; a bad value gives exit 2 and no file', () => {
  const withFlag = path.join(TMP, 'fx-flag.json');
  let r = run([DERIVE, '--source', sourceFile, '--out', withFlag, '--recorded-at', '2026-12-01']);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(fs.readFileSync(withFlag, 'utf8')).recorded_at, '2026-12-01');
  const noFlag = path.join(TMP, 'fx-none.json');
  r = run([DERIVE, '--source', sourceFile, '--out', noFlag]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(fs.readFileSync(noFlag, 'utf8')).recorded_at, '2026-11-24');
  for (const bad of ['2026-1-01', '01-12-2026', '2026-13-01', '2026-02-30', 'today', '']) {
    const out = path.join(TMP, 'fx-bad-' + Math.random().toString(16).slice(2) + '.json');
    r = run([DERIVE, '--source', sourceFile, '--out', out, '--recorded-at', bad]);
    assert.equal(r.status, 2, 'exit code for "' + bad + '"');
    assert.equal(fs.existsSync(out), false, 'no file for "' + bad + '"');
  }
  const missingValue = path.join(TMP, 'fx-missing.json');
  r = run([DERIVE, '--source', sourceFile, '--out', missingValue, '--recorded-at']);
  assert.equal(r.status, 2, 'a flag with no value');
  assert.equal(fs.existsSync(missingValue), false);
});

check('A2. derive and HEADER keep their shape: derive(source) is unchanged, derive(source, {recordedAt}) sets the date, HEADER is not mutated', () => {
  const mod = require(path.join(ROOT, 'scripts', 'derive-decision-fixture.cjs'));
  assert.deepEqual(Object.keys(mod).sort(), ['HEADER', 'derive']);
  assert.equal(mod.HEADER.recorded_at, '2026-11-24');
  assert.deepEqual(Object.keys(mod.HEADER), ['schema', 'provider', 'model', 'question_type', 'question_template', 'recorded_at', 'conditioned_on']);
  const a = mod.derive(SOURCE);
  assert.equal(a.recorded_at, '2026-11-24');
  assert.deepEqual(a.pairs, [{ job: 'explore', command: '/mos:persona', p: 0.2 }, { job: 'navigate', command: '/mos:persona', p: 0.512 }]);
  const b = mod.derive(SOURCE, { recordedAt: '2026-12-01' });
  assert.equal(b.recorded_at, '2026-12-01');
  assert.deepEqual(Object.keys(b), Object.keys(a));
  assert.equal(mod.HEADER.recorded_at, '2026-11-24', 'HEADER is not changed by a call');
  assert.throws(() => mod.derive(SOURCE, { recordedAt: 'tomorrow' }), /recorded/i);
});

const REQ_DIR = path.join(TMP, 'requests');
check('A3. the request builder writes 20 files with 73 questions each; navigate is one; each holds /mos:persona; zero network', () => {
  const r = run([path.join('scripts', 'build-relay-release-requests.cjs'), '--out-dir', REQ_DIR]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.netHits, '', 'the build reached the network');
  const files = fs.readdirSync(REQ_DIR).filter((f) => f.endsWith('.json')).sort();
  assert.equal(files.length, 20);
  const vocab = readJson('data/job-vocabulary.json');
  assert.deepEqual(files, vocab.ids.map((id) => id + '.json').sort());
  assert.ok(files.includes('navigate.json'));
  for (const f of files) {
    const req = JSON.parse(fs.readFileSync(path.join(REQ_DIR, f), 'utf8'));
    assert.deepEqual(Object.keys(req).sort(), ['context', 'questions'], f);
    assert.deepEqual(Object.keys(req.context).sort(), ['job_id', 'job_summary'], f);
    assert.equal(Object.keys(req.questions).length, 73, f);
    assert.ok(Object.values(req.questions).some((q) => q.subject === '/mos:persona'), 'no /mos:persona question in ' + f);
    assert.ok(Object.values(req.questions).every((q) => q.type === 'yes_no' && q.template === 'serves_job_v1'), f);
  }
  // The same builder in process, with fetch blocked.
  const prev = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('network blocked'); };
  try {
    const set = require(path.join(ROOT, 'scripts', 'build-relay-release-requests.cjs')).buildRequests();
    assert.equal(set.length, 20);
  } finally {
    globalThis.fetch = prev;
  }
});

check('A4. the transport with --dry-run on one request file prints the neutral body and sends nothing', () => {
  const file = path.join(REQ_DIR, 'navigate.json');
  assert.ok(fs.existsSync(file), 'A3 must run first');
  const r = run([path.join('scripts', 'decision-advisor-transport.cjs'), '--provider', 'relay', '--dry-run', '--request', file]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.netHits, '', 'the dry run reached the network');
  const body = JSON.parse(r.stdout);
  assert.equal(Object.keys(body.questions).length, 73);
  assert.equal(body.context.job_id, 'navigate');
  assert.ok(!/authorization|bearer|token/i.test(r.stdout), 'no credential word in the output');
  // The release flag and a dry run never combine, and the flag needs the relay provider.
  const both = run([path.join('scripts', 'decision-advisor-transport.cjs'), '--provider', 'relay', '--dry-run', '--operator-release-run', '--request', file]);
  assert.equal(both.status, 2);
  assert.equal(both.netHits, '');
});

check('A5. the run sheet holds the command lines, names the flag and the token file, and holds no secret', () => {
  assert.ok(fs.existsSync(SHEET), 'the run sheet exists');
  const t = fs.readFileSync(SHEET, 'utf8');
  for (const part of ['Part A', 'Part B', 'Part C', 'Part D', 'Part E']) assert.ok(t.includes(part), part);
  for (const needle of [
    'scripts/build-relay-release-requests.cjs --out-dir',
    'scripts/decision-advisor-transport.cjs',
    '--provider relay',
    '--operator-release-run',
    '--resume',
    '--base https://mindrian-decision-relay.onrender.com',
    'decision-relay-operator-token',
    'scripts/derive-decision-fixture.cjs',
    '--recorded-at',
    'scripts/build-decision-advisor-table.cjs',
    'scripts/build-command-irreversibility-ledger.cjs',
    '--out',
  ]) assert.ok(t.includes(needle), 'missing in the sheet: ' + needle);
  assert.ok(/20 requests/.test(t) && /73 questions/.test(t), 'the counts');
  assert.ok(/ledger-rescored/.test(t) && /ledger-deferred/.test(t) && /advisor-run-done/.test(t), 'the three answer words');
  // No secret value: no bearer string, no key assignment, no long token-like word, no file read of the secrets file.
  assert.ok(!/Bearer\s+\S/.test(t), 'a bearer value');
  assert.ok(!/(API_KEY|TOKEN|SECRET)\s*=\s*\S/.test(t), 'a key assignment');
  assert.ok(!/\b[A-Za-z0-9_-]{32,}\b/.test(t.replace(/[A-Za-z0-9_./-]*\/[A-Za-z0-9_./-]*/g, '')), 'a long token-like word');
  assert.ok(!/cat\s+\S*(token|typesafe\.env)/.test(t), 'a command that prints a secret file');
  // Every script the sheet names exists, and no dash character of the banned kind is in the sheet.
  for (const m of t.matchAll(/scripts\/[A-Za-z0-9._-]+\.cjs/g)) assert.ok(fs.existsSync(path.join(ROOT, m[0])), 'script exists: ' + m[0]);
  assert.ok(!t.includes(String.fromCharCode(0x2014)) && !t.includes(String.fromCharCode(0x2013)), 'em dash or en dash');
});

check('A6. state before or after the run: reach test pending line and table rows agree with the fixture', () => {
  const fixture = readJson('tests/fixtures/399/recorded-job-command-yes-no.json');
  const hasNavigate = fixture.pairs.some((p) => p.job === 'navigate');
  const reach = run([path.join('tests', 'test-4002-job-reach.cjs')]);
  assert.equal(reach.status, 0, reach.stdout.slice(-400));
  const pending = reach.stdout.split('\n').filter((l) => /recorded run of plan 18 pending/.test(l));
  const table = readJson('data/decision-advisor-table.json');
  const rows = Object.keys(table.rows).length;
  const tableRun = run([path.join('tests', 'test-399-table.cjs')]);
  assert.equal(tableRun.status, 0, tableRun.stdout.slice(-400));
  if (hasNavigate) {
    assert.equal(pending.length, 0, 'after the run: no pending line');
    assert.equal(rows, 20, 'after the run: 20 rows');
    console.log('state: AFTER the recorded run (navigate recorded, 20 rows, no pending line)');
  } else {
    assert.equal(pending.length, 1, 'before the run: exactly one pending line');
    assert.ok(/no row for navigate:/.test(pending[0]), pending[0]);
    assert.equal(rows, 13, 'before the run: 13 rows');
    console.log('state: BEFORE the recorded run (' + pending[0] + '; 13 rows)');
  }
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
