#!/usr/bin/env node
// Phase 388 plan 04: run the release-gate legs and compare a before record with an after record.
// Node built-ins only. Hyphens only.
//
// Commands:
//   selftest
//   run --out FILE                  run every leg, write one status per leg
//   compare --before FILE --after FILE
// Status words: PASS (exit 0), ENVGAP (exit 77), FAIL (any other exit), TIMEOUT, ABSENT (the file of the leg does not exist).
// Canon Part 8: legs run with a dead Brain URL and no Brain key variables.
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..', '..');
const STEP95 = /\.planning\/|mcp-server-brain\/|^npm notice .*tests\//m;

// name, argv (array), file that must exist (or null)
const LEGS = [
  ['test-341-payload-ceiling', ['node', 'tests/test-341-payload-ceiling.cjs'], 'tests/test-341-payload-ceiling.cjs'],
  ['test-341-payload-shrinkwrap-present', ['node', 'tests/test-341-payload-shrinkwrap-present.cjs'], 'tests/test-341-payload-shrinkwrap-present.cjs'],
  ['test-341-shrinkwrap-no-dev', ['node', 'tests/test-341-shrinkwrap-no-dev.cjs'], 'tests/test-341-shrinkwrap-no-dev.cjs'],
  ['test-341-release-shrinkwrap-gate', ['node', 'tests/test-341-release-shrinkwrap-gate.cjs'], 'tests/test-341-release-shrinkwrap-gate.cjs'],
  ['test-369-walled-manifest', ['node', 'tests/test-369-walled-manifest.cjs'], 'tests/test-369-walled-manifest.cjs'],
  ['test-369-installed-layout', ['node', 'tests/test-369-installed-layout.cjs'], 'tests/test-369-installed-layout.cjs'],
  ['test-369.1-desktop-artifact', ['node', 'tests/test-369.1-desktop-artifact.cjs'], 'tests/test-369.1-desktop-artifact.cjs'],
  ['test-369.1-bin-relocation', ['node', 'tests/test-369.1-bin-relocation.cjs'], 'tests/test-369.1-bin-relocation.cjs'],
  ['test-369.1-sharp-out', ['node', 'tests/test-369.1-sharp-out.cjs'], 'tests/test-369.1-sharp-out.cjs'],
  ['test-369.1-release-lockstep', ['node', 'tests/test-369.1-release-lockstep.cjs'], 'tests/test-369.1-release-lockstep.cjs'],
  ['test-345-lockstep', ['node', 'tests/test-345-lockstep.cjs'], 'tests/test-345-lockstep.cjs'],
  ['test-release-bump-tag-and-publish-gates', ['node', 'tests/test-release-bump-tag-and-publish-gates.cjs'], 'tests/test-release-bump-tag-and-publish-gates.cjs'],
  ['test-quick-261106-critic-baseline-ships', ['node', 'tests/test-quick-261106-critic-baseline-ships.cjs'], 'tests/test-quick-261106-critic-baseline-ships.cjs'],
  ['test-387-eureka-installed-layout', ['node', 'tests/test-387-eureka-installed-layout.cjs'], 'tests/test-387-eureka-installed-layout.cjs'],
  ['test-380-installed-layout', ['node', 'tests/test-380-installed-layout.cjs'], 'tests/test-380-installed-layout.cjs'],
  ['check-release-payload-ceiling', ['node', 'scripts/check-release-payload-ceiling.cjs', '--check'], 'scripts/check-release-payload-ceiling.cjs'],
  ['run-harness-check', ['node', 'scripts/run-harness.cjs', '--check'], 'scripts/run-harness.cjs'],
  ['build-connector-registry-check', ['node', 'scripts/build-connector-registry.cjs', '--check'], 'scripts/build-connector-registry.cjs'],
  ['build-orchestration-projection-check', ['node', 'scripts/build-orchestration-projection.cjs', '--check'], 'scripts/build-orchestration-projection.cjs'],
  ['check-render-coverage', ['node', 'scripts/check-render-coverage.cjs'], 'scripts/check-render-coverage.cjs'],
  ['build-desktop-artifact-check', ['node', 'scripts/release-lib/build-desktop-artifact.cjs', '--check'], 'scripts/release-lib/build-desktop-artifact.cjs'],
  ['bash-n-run-all-366', ['bash', '-n', 'tests/run-all-366.sh'], 'tests/run-all-366.sh'],
  ['step-9.5-grep', 'STEP95', null],
  ['verify-release', ['bash', 'scripts/verify-release'], 'scripts/verify-release', 600000],
  ['ship-less', ['node', 'tests/test-388-ship-less.cjs'], 'tests/test-388-ship-less.cjs'],
];

function cleanEnv() {
  const env = Object.assign({}, process.env, { MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9', npm_config_update_notifier: 'false' });
  for (const k of Object.keys(env)) if (/^(MINDRIAN_BRAIN_(API_)?KEY|MINDRIAN_API_KEY|BRAIN_API_KEY|MINDRIAN_KEY)/i.test(k)) delete env[k];
  return env;
}

function statusOf(r) {
  if (r.error && r.error.code === 'ETIMEDOUT') return 'TIMEOUT';
  if (r.signal === 'SIGTERM' && r.status === null) return 'TIMEOUT';
  if (r.status === 0) return 'PASS';
  if (r.status === 77) return 'ENVGAP';
  return 'FAIL';
}

function runLeg(leg) {
  const [name, argv, file, timeout] = leg;
  if (file && !fs.existsSync(path.join(REPO, file))) return { status: 'ABSENT', tail: file + ' does not exist' };
  const to = timeout || 300000;
  if (argv === 'STEP95') {
    const { resolveNpmCli } = require(path.join(REPO, 'lib', 'core', 'npm-cli-resolve.cjs'));
    const d = resolveNpmCli();
    const r = spawnSync(d.command, d.baseArgs.concat(['pack', '--dry-run', '--ignore-scripts']), { cwd: REPO, encoding: 'utf8', timeout: to, shell: !!d.shell, maxBuffer: 256 * 1024 * 1024, env: cleanEnv() });
    const out = (r.stdout || '') + '\n' + (r.stderr || '');
    if (r.status !== 0) return { status: 'FAIL', tail: 'npm pack failed: ' + out.slice(-300) };
    const hits = out.split('\n').filter((l) => STEP95.test(l));
    return hits.length ? { status: 'FAIL', tail: hits.length + ' line(s) match the Step 9.5 pattern; first: ' + hits[0] } : { status: 'PASS', tail: 'no line matches the Step 9.5 pattern' };
  }
  const r = spawnSync(argv[0], argv.slice(1), { cwd: REPO, encoding: 'utf8', timeout: to, maxBuffer: 256 * 1024 * 1024, env: cleanEnv(), input: '' });
  const out = ((r.stdout || '') + (r.stderr || '')).replace(/\x1b\[[0-9;]*m/g, '');
  void name;
  return { status: statusOf(r), tail: out.slice(-400), exit: r.status };
}

// pure: compare two records ({legs:{name:{status}}}). Returns { code, lines }.
function compareRecords(before, after) {
  const lines = [];
  let code = 0;
  const names = new Set([...Object.keys(before.legs), ...Object.keys(after.legs)]);
  for (const n of names) {
    const b = (before.legs[n] || { status: 'ABSENT' }).status;
    const a = (after.legs[n] || { status: 'ABSENT' }).status;
    if (b === 'PASS' && a !== 'PASS') { lines.push('REGRESSION ' + n + ': ' + b + ' -> ' + a); code = 1; continue; }
    if (b !== 'FAIL' && (a === 'FAIL' || a === 'TIMEOUT')) { lines.push('REGRESSION ' + n + ': ' + b + ' -> ' + a); code = 1; continue; }
    if (a === 'ENVGAP' || a === 'TIMEOUT') lines.push('UNVERIFIED ' + n + ': ' + a + ' (before ' + b + ')');
    else if (a === 'FAIL' && b === 'FAIL') lines.push('PRE-EXISTING ' + n + ': FAIL before and after');
    else if (a === 'ABSENT') lines.push('ABSENT ' + n);
    else if (b !== a) lines.push('CHANGED ' + n + ': ' + b + ' -> ' + a);
  }
  return { code, lines };
}

function selftest() {
  const failures = [];
  const eq = (x, y, m) => { if (JSON.stringify(x) !== JSON.stringify(y)) failures.push(m + ': got ' + JSON.stringify(x) + ' expected ' + JSON.stringify(y)); };
  const rec = (o) => ({ legs: Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { status: v }])) });
  // run test 1
  const c1 = compareRecords(rec({ t: 'PASS' }), rec({ t: 'FAIL' }));
  eq(c1.code, 1, 'run test 1 PASS to FAIL exits 1'); eq(c1.lines.some((l) => l.includes('t')), true, 'run test 1 names the test');
  const c2 = compareRecords(rec({ t: 'ENVGAP' }), rec({ t: 'ENVGAP' }));
  eq(c2.code, 0, 'run test 1 ENVGAP both exits 0'); eq(c2.lines.some((l) => l.startsWith('UNVERIFIED t')), true, 'run test 1 prints UNVERIFIED');
  // run test 2
  const c3 = compareRecords(rec({ t: 'FAIL' }), rec({ t: 'FAIL' }));
  eq(c3.code, 0, 'run test 2 exits 0'); eq(c3.lines.some((l) => l.startsWith('PRE-EXISTING t')), true, 'run test 2 prints PRE-EXISTING');
  // extra: PASS to TIMEOUT and ABSENT to FAIL fail; ABSENT to PASS passes
  eq(compareRecords(rec({ t: 'PASS' }), rec({ t: 'TIMEOUT' })).code, 1, 'PASS to TIMEOUT');
  eq(compareRecords(rec({ t: 'ABSENT' }), rec({ t: 'FAIL' })).code, 1, 'ABSENT to FAIL');
  eq(compareRecords(rec({ t: 'ABSENT' }), rec({ t: 'PASS' })).code, 0, 'ABSENT to PASS');
  eq(compareRecords(rec({ t: 'FAIL' }), rec({ t: 'PASS' })).code, 0, 'FAIL to PASS');
  // status mapping
  eq([statusOf({ status: 0 }), statusOf({ status: 77 }), statusOf({ status: 1 }), statusOf({ status: null, signal: 'SIGTERM' }), statusOf({ status: null, error: { code: 'ETIMEDOUT' } })], ['PASS', 'ENVGAP', 'FAIL', 'TIMEOUT', 'TIMEOUT'], 'status mapping');
  // Step 9.5 pattern can fail
  eq([STEP95.test('npm notice 12kB lib/x/tests/a.cjs'), STEP95.test('npm notice 1kB .planning/x'), STEP95.test('npm notice 1kB lib/core/a.cjs')], [true, true, false], 'step 9.5 pattern');
  if (failures.length) { for (const f of failures) console.error('FAIL ' + f); return 1; }
  console.log('gate-run selftest: compare cases (regression, ENVGAP, PRE-EXISTING, TIMEOUT, ABSENT), status mapping and the Step 9.5 pattern passed');
  return 0;
}



// ---------------------------------------------------------------- record: pack numbers into 388-before-after.json

function escapeRe(s) { return s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'); }
function toRegexSource(pat) {
  const i = pat.indexOf('!(');
  if (i === -1) return pat.split('*').map(escapeRe).join('[^/]*');
  const j = pat.indexOf(')', i);
  const alts = pat.slice(i + 2, j).split('|').map(escapeRe).join('|');
  const rest = toRegexSource(pat.slice(j + 1));
  return toRegexSource(pat.slice(0, i)) + '(?:(?!(?:' + alts + ')' + rest + '$)[^/]*)' + rest;
}
function matchesPattern(pattern, p) { return new RegExp('^' + toRegexSource(pattern.replace(/^!/, '')) + '$').test(p); }

function packNumbers() {
  const { resolveNpmCli } = require(path.join(REPO, 'lib', 'core', 'npm-cli-resolve.cjs'));
  const d = resolveNpmCli();
  const r = spawnSync(d.command, d.baseArgs.concat(['pack', '--dry-run', '--json', '--ignore-scripts']), { cwd: REPO, encoding: 'utf8', timeout: 240000, shell: !!d.shell, maxBuffer: 256 * 1024 * 1024, env: cleanEnv() });
  if (r.status !== 0) throw new Error('npm pack failed: ' + (r.stderr || '').slice(0, 300));
  const e = JSON.parse(r.stdout)[0];
  return { entryCount: e.entryCount, size: e.size, unpackedSize: e.unpackedSize, files: e.files.map((x) => ({ path: x.path, size: x.size })) };
}

function hashObject(rel) { return spawnSync('git', ['hash-object', rel], { cwd: REPO, encoding: 'utf8' }).stdout.trim(); }

// record --which before|after --gate FILE --out FILE --list FILE [--list-before FILE] [--pj-before-files FILE]
function cmdRecord() {
  const which = arg('--which');
  const out = path.resolve(arg('--out'));
  const pack = packNumbers();
  const rec = {
    head: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).stdout.trim(),
    entryCount: pack.entryCount, size: pack.size, unpackedSize: pack.unpackedSize,
    packageJsonHash: hashObject('package.json'), shrinkwrapHash: hashObject('npm-shrinkwrap.json'),
    gate: Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(arg('--gate'), 'utf8')).legs).map(([k, v]) => [k, v.status])),
  };
  fs.writeFileSync(path.resolve(arg('--list')), pack.files.map((x) => x.path + '\t' + x.size).join('\n') + '\n');
  if (which === 'after') {
    const beforeList = new Map(fs.readFileSync(path.resolve(arg('--list-before')), 'utf8').split('\n').filter(Boolean).map((l) => l.split('\t')).map((c) => [c[0], Number(c[1])]));
    const afterSet = new Set(pack.files.map((x) => x.path));
    const removedPaths = [...beforeList.keys()].filter((p) => !afterSet.has(p));
    const added = pack.files.map((x) => x.path).filter((p) => !beforeList.has(p));
    const pats = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')).files.filter((x) => x.startsWith('!'));
    const newPats = JSON.parse(fs.readFileSync(path.resolve(arg('--pj-before-files')), 'utf8'));
    const approved = pats.filter((x) => !newPats.includes(x));
    rec.removed = { total: { files: removedPaths.length, bytes: removedPaths.reduce((s, p) => s + beforeList.get(p), 0) }, added, byPattern: {}, unmatched: [] };
    for (const p of removedPaths) {
      const pat = approved.find((x) => matchesPattern(x, p));
      if (!pat) { rec.removed.unmatched.push(p); continue; }
      const e = rec.removed.byPattern[pat] || { files: 0, bytes: 0 };
      e.files += 1; e.bytes += beforeList.get(p); rec.removed.byPattern[pat] = e;
    }
  }
  let doc = {};
  if (fs.existsSync(out)) doc = JSON.parse(fs.readFileSync(out, 'utf8'));
  doc[which] = rec;
  fs.writeFileSync(out, JSON.stringify(doc, null, 1) + '\n');
  console.log(which + ': entryCount ' + rec.entryCount + ' size ' + rec.size + ' unpackedSize ' + rec.unpackedSize + (rec.removed ? ' removed ' + rec.removed.total.files + ' files ' + rec.removed.total.bytes + ' bytes, unmatched ' + rec.removed.unmatched.length + ', added ' + rec.removed.added.length : ''));
}

function arg(name) { const i = process.argv.indexOf(name); return i === -1 ? null : process.argv[i + 1]; }

function main() {
  const cmd = process.argv[2];
  if (cmd === 'selftest') process.exit(selftest());
  if (cmd === 'run') {
    const out = path.resolve(arg('--out'));
    const rec = { head: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).stdout.trim(), at: new Date().toISOString(), node: process.version, legs: {} };
    for (const leg of LEGS) {
      const t0 = Date.now();
      const res = runLeg(leg);
      res.seconds = Math.round((Date.now() - t0) / 1000);
      rec.legs[leg[0]] = res;
      console.log(leg[0] + ': ' + res.status + ' (' + res.seconds + ' s)');
    }
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(rec, null, 1) + '\n');
    return;
  }
  if (cmd === 'record') return cmdRecord();
  if (cmd === 'compare') {
    const b = JSON.parse(fs.readFileSync(arg('--before'), 'utf8'));
    const a = JSON.parse(fs.readFileSync(arg('--after'), 'utf8'));
    const res = compareRecords(b, a);
    for (const l of res.lines) console.log(l);
    console.log('gate-run compare: ' + (res.code ? 'REGRESSION' : 'no leg went from PASS to not PASS'));
    process.exit(res.code);
  }
  console.error('usage: 388-gate-run.cjs selftest | run --out FILE | compare --before FILE --after FILE | record --which before|after --gate FILE --out FILE --list FILE [--list-before FILE --pj-before-files FILE]');
  process.exit(2);
}

if (require.main === module) main();
module.exports = { compareRecords, LEGS, statusOf, matchesPattern };
void os;
