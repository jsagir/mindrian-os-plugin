#!/usr/bin/env node
'use strict';
/*
 * Phase 384 plan 12: checks for bench/ab-verdict.cjs. Node built-ins only. Prints `ab-verdict: ALL PASS` or
 * `ab-verdict: <n> FAILED`. The checks use synthetic result files in a temporary folder and a temporary git
 * repository (no real room, no network, no product code). They need no lock because they start no timed child.
 * Checks: AV1 verdict on a KEEP set, AV2 the five words and both boundaries, AV3 output keys and --expect and
 * --markdown, AV4 six refusal cases, AV5 outcome against git history, AV6 the p95 rule.
 * AB_VERDICT_MODULE overrides the module path (used for the recorded RED run). Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const BENCH = __dirname;
const TOOL = process.env.AB_VERDICT_MODULE || path.join(BENCH, 'ab-verdict.cjs');

let failed = 0;
function check(name, cond, detail) {
  if (cond) { process.stdout.write('  ok   ' + name + '\n'); return; }
  failed += 1;
  process.stdout.write('  FAIL ' + name + (detail !== undefined ? ' :: ' + String(detail).slice(0, 400) : '') + '\n');
}

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-384-abtest-'));
function tmp(name) { return path.join(scratch, name); }
function readJson(f) { return JSON.parse(fs.readFileSync(f, 'utf8')); }

const MACHINE = { cores: 4, node: 'v22.0.0', platform: 'linux', arch: 'x64', kernel: 'k', cpu_cap: 4, fs_type: 'ext4', head_sha: 'a'.repeat(40), tree_label: 'synthetic', base_sha: 'b'.repeat(40), started_at: '2026-01-01T00:00:00Z', ended_at: '2026-01-01T00:01:00Z', load1_start: 0.5, load1_end: 0.5 };

// a synthetic result file with one target; opts override fields of the target
function target(id, median, opts) {
  const o = opts || {};
  const t = {
    id: id, n: 'n' in o ? o.n : 9, blocking: true,
    wall_ms: { median: median, p95: median + 10, min: median - 5, max: median + 12 },
    cpu_ms: { median: median / 2, p95: median / 2 + 5, min: 0, max: 1 },
    background_ms: median, background_ms_p95: median + 7,
    survivor_cpu_ms: median / 4,
    exits: [0], timed_out: 0, failed_runs: 0, noisy: false,
  };
  Object.keys(o).forEach((k) => { if (k !== 'n') t[k] = o[k]; });
  if (o.dropP95) { delete t.wall_ms.p95; delete t.dropP95; }
  return t;
}
function writeResult(name, median, opts, schema) {
  const f = tmp(name + '.json');
  const o = Object.assign({}, opts || {});
  fs.writeFileSync(f, JSON.stringify({ schema: schema || 'mos.perf-384/1', machine: MACHINE, room: 'fixture-room', set: name, targets: [target('t:x', median, o)] }));
  return f;
}
// four files for one case: a1, b1, a2, b2
let seq = 0;
function fourFiles(mA1, mB1, mA2, mB2, opts) {
  seq += 1;
  const p = 'c' + seq;
  return {
    a1: writeResult(p + 'a1', mA1, opts), b1: writeResult(p + 'b1', mB1), a2: writeResult(p + 'a2', mA2), b2: writeResult(p + 'b2', mB2),
  };
}
function specs(f, extra) {
  return ['--set1-a', f.a1 + '#t:x', '--set1-b', f.b1 + '#t:x', '--set2-a', f.a2 + '#t:x', '--set2-b', f.b2 + '#t:x'].concat(extra || []);
}
function run(args) {
  return cp.spawnSync(process.execPath, [TOOL].concat(args), { encoding: 'utf8', timeout: 60000 });
}
function verdictLine(r) { const m = /^VERDICT (\S+)(.*)$/m.exec(r.stdout || ''); return m ? { word: m[1], rest: m[2] } : null; }

let lib = null;
try { lib = require(TOOL); } catch (e) { lib = null; }

function main() {
  // AV1 and a first look at the output line
  const fk = fourFiles(200, 100, 202, 102);
  const r1 = run(['compare'].concat(specs(fk)));
  const v1 = verdictLine(r1);
  check('AV1 a set where A is 100 ms above B in both sets with noise 4 prints VERDICT KEEP', r1.status === 0 && !!v1 && v1.word === 'KEEP', r1.stdout + r1.stderr);
  check('AV3 the VERDICT line carries d1, d2, noise and floor', !!v1 && /d1=100\b/.test(v1.rest) && /d2=100\b/.test(v1.rest) && /noise=4\b/.test(v1.rest) && /floor=50\b/.test(v1.rest), v1 && v1.rest);

  // AV2 the five words through the pure function
  const vf = lib && lib.verdictOf;
  const w = (d1, d2, noise, floor) => (typeof vf === 'function' ? vf({ d1: d1, d2: d2, noise: noise, floor: floor }) : 'NO-FN');
  check('AV2 KEEP: both differences above twice the noise and above the floor', w(100, 100, 4, 50) === 'KEEP', w(100, 100, 4, 50));
  check('AV2 WORSE: both differences below minus twice the noise and below minus the floor', w(-100, -100, 4, 50) === 'WORSE', w(-100, -100, 4, 50));
  check('AV2 NO-GAIN: both differences at most twice the noise', w(5, -3, 4, 50) === 'NO-GAIN', w(5, -3, 4, 50));
  check('AV2 NOT-RESOLVED: exactly one difference above twice the noise', w(100, 5, 4, 50) === 'NOT-RESOLVED' && w(5, 100, 4, 50) === 'NOT-RESOLVED', w(100, 5, 4, 50));
  check('AV2 BELOW-FLOOR: both above twice the noise, one at most the floor', w(40, 40, 4, 50) === 'BELOW-FLOOR' && w(100, 45, 4, 50) === 'BELOW-FLOOR', w(40, 40, 4, 50));
  check('AV2 boundary: a difference equal to twice the noise is not above it (NO-GAIN)', w(8, 8, 4, 50) === 'NO-GAIN', w(8, 8, 4, 50));
  check('AV2 boundary: a difference equal to the floor gives BELOW-FLOOR', w(50, 100, 4, 50) === 'BELOW-FLOOR' && w(100, 50, 4, 50) === 'BELOW-FLOOR', w(50, 100, 4, 50));
  check('AV2 boundary: just above the floor gives KEEP', w(50.1, 50.1, 4, 50) === 'KEEP', w(50.1, 50.1, 4, 50));
  check('AV2 noise 0 needs a difference above 0: 0 gives NO-GAIN, 1 gives BELOW-FLOOR', w(0, 0, 0, 50) === 'NO-GAIN' && w(1, 1, 0, 50) === 'BELOW-FLOOR', w(0, 0, 0, 50) + ' ' + w(1, 1, 0, 50));
  check('AV2 one very negative difference and one near zero is NO-GAIN, not WORSE', w(-100, 2, 4, 50) === 'NO-GAIN', w(-100, 2, 4, 50));
  check('AV2 noiseOf is the sum of the two set drifts', !!lib && typeof lib.noiseOf === 'function' && lib.noiseOf({ mA1: 200, mA2: 203, mB1: 100, mB2: 98 }) === 5);

  // AV2 through the CLI for each word
  const cases = [
    ['KEEP', fourFiles(200, 100, 202, 102)],
    ['WORSE', fourFiles(100, 200, 102, 202)],
    ['NO-GAIN', fourFiles(100, 100, 106, 100)],
    ['NOT-RESOLVED', fourFiles(300, 100, 100, 100)],
    ['BELOW-FLOOR', fourFiles(140, 100, 142, 102)],
  ];
  cases.forEach((c) => {
    const r = run(['compare'].concat(specs(c[1])));
    const v = verdictLine(r);
    check('AV2 CLI word ' + c[0], r.status === 0 && !!v && v.word === c[0], r.stdout + r.stderr);
  });

  // AV3 json keys, markdown, expect
  const outFile = tmp('out.json');
  const r3 = run(['compare'].concat(specs(fk, ['--out', outFile, '--label', 'case one'])));
  let j = null;
  try { j = readJson(outFile); } catch (e) { j = null; }
  const keys = ['verdict', 'd1', 'd2', 'noise', 'floor', 'mA1', 'mB1', 'mA2', 'mB2', 'nA1', 'nB1', 'nA2', 'nB2', 'p95_a', 'p95_b', 'spread_a_pct', 'spread_b_pct', 'metric', 'p95_metric', 'label'];
  check('AV3 --out writes a JSON file with every named key', r3.status === 0 && !!j && keys.every((k) => k in j), j ? keys.filter((k) => !(k in j)).join() : r3.stderr);
  check('AV3 JSON values: verdict word, differences, noise, floor, the larger p95 of the two sets, spread percent, label', !!j && j.verdict === 'KEEP' && j.d1 === 100 && j.d2 === 100 && j.noise === 4 && j.floor === 50 && j.p95_a === 212 && j.p95_b === 112 && j.metric === 'wall_ms.median' && j.label === 'case one' && Math.abs(j.spread_a_pct - (2 / 201 * 100)) < 0.01, j && JSON.stringify(j));
  const r3m = run(['compare'].concat(specs(fk, ['--markdown'])));
  check('AV3 --markdown prints one table with a header row and the verdict', r3m.status === 0 && /\| *median A *\|/.test(r3m.stdout) && /\| *p95 B *\|/.test(r3m.stdout) && /\| *spread/.test(r3m.stdout) && /KEEP/.test(r3m.stdout), r3m.stdout);
  const rExp1 = run(['compare'].concat(specs(cases[2][1], ['--expect', 'KEEP'])));
  const rExp2 = run(['compare'].concat(specs(cases[0][1], ['--expect', 'KEEP'])));
  check('AV3 --expect KEEP exits 1 on a NO-GAIN case and 0 on a KEEP case', rExp1.status === 1 && rExp2.status === 0, rExp1.status + ' ' + rExp2.status);

  // AV4 six refusal cases
  const refuse = (label, f, word, extraArgs) => {
    const r = run(['compare'].concat(specs(f, extraArgs)));
    const text = r.stdout + r.stderr;
    check('AV4 refusal ' + label + ': exit 1, reason word ' + word + ', no path in the text', r.status === 1 && text.indexOf(word) >= 0 && text.indexOf(scratch) < 0 && text.indexOf(os.tmpdir()) < 0 && !/^VERDICT /m.test(r.stdout), r.status + ' ' + text);
  };
  refuse('n below 7', fourFiles(200, 100, 202, 102, { n: 6 }), 'n-short');
  refuse('noisy target', fourFiles(200, 100, 202, 102, { noisy: true }), 'noisy');
  refuse('failed runs', fourFiles(200, 100, 202, 102, { failed_runs: 1 }), 'failed-runs');
  refuse('timed out on a blocking target', fourFiles(200, 100, 202, 102, { timed_out: 2 }), 'timed-out');
  const bad = fourFiles(200, 100, 202, 102);
  bad.a1 = writeResult('badschema', 200, {}, 'mos.perf-384-counts/1');
  refuse('wrong schema', bad, 'bad-schema');
  const miss = fourFiles(200, 100, 202, 102);
  const rMiss = run(['compare', '--set1-a', miss.a1 + '#t:nope', '--set1-b', miss.b1 + '#t:x', '--set2-a', miss.a2 + '#t:x', '--set2-b', miss.b2 + '#t:x']);
  check('AV4 refusal missing id: exit 1, reason word missing-id, no path in the text', rMiss.status === 1 && (rMiss.stdout + rMiss.stderr).indexOf('missing-id') >= 0 && (rMiss.stdout + rMiss.stderr).indexOf(scratch) < 0, rMiss.stdout + rMiss.stderr);

  // AV6 the p95 rule
  const dp = lib && lib.p95PathOf;
  check('AV6 default p95 path: wall_ms.median gives wall_ms.p95', typeof dp === 'function' && dp('wall_ms.median') === 'wall_ms.p95');
  check('AV6 default p95 path: cpu_ms.median gives cpu_ms.p95', typeof dp === 'function' && dp('cpu_ms.median') === 'cpu_ms.p95');
  check('AV6 default p95 path: background_ms gives background_ms_p95', typeof dp === 'function' && dp('background_ms') === 'background_ms_p95');
  const rBg = run(['compare'].concat(specs(fourFiles(300, 100, 302, 102), ['--metric', 'background_ms', '--out', tmp('bg.json')])));
  let jbg = null;
  try { jbg = readJson(tmp('bg.json')); } catch (e) { jbg = null; }
  check('AV6 a count-free metric with a _p95 sibling reads it: --metric background_ms', rBg.status === 0 && !!jbg && jbg.p95_metric === 'background_ms_p95' && jbg.p95_a === 309, rBg.stderr + JSON.stringify(jbg));
  const noP95 = fourFiles(200, 100, 202, 102);
  noP95.b2 = tmp('nop95b2.json');
  fs.writeFileSync(noP95.b2, JSON.stringify({ schema: 'mos.perf-384/1', machine: MACHINE, targets: [target('t:x', 102, { dropP95: true })] }));
  const rMissP = run(['compare'].concat(specs(noP95)));
  const textMissP = rMissP.stdout + rMissP.stderr;
  check('AV6 a target without the p95 key exits 1 with a line starting p95-missing that names the id and the path', rMissP.status === 1 && /^p95-missing\b.*t:x.*wall_ms\.p95/m.test(textMissP) && !/\b(null|NaN|undefined)\b/.test(textMissP), textMissP);
  const outNone = tmp('none.json');
  const rNone = run(['compare'].concat(specs(noP95, ['--p95-metric', 'none', '--markdown', '--out', outNone])));
  let jn = null;
  try { jn = readJson(outNone); } catch (e) { jn = null; }
  const noneText = rNone.stdout + (jn ? fs.readFileSync(outNone, 'utf8') : '');
  check('AV6 --p95-metric none exits 0, the table and the JSON hold n/a and none of null, NaN, undefined', rNone.status === 0 && !!jn && jn.p95_a === 'n/a' && jn.p95_b === 'n/a' && /n\/a/.test(rNone.stdout) && !/\b(null|NaN|undefined)\b/.test(noneText), rNone.stderr + noneText);
  const outNone2 = tmp('none2.json');
  const countF = fourFiles(300, 100, 302, 102);
  const rCount = run(['compare'].concat(specs(countF, ['--metric', 'survivor_cpu_ms', '--p95-metric', 'none', '--out', outNone2])));
  let jc = null;
  try { jc = readJson(outNone2); } catch (e) { jc = null; }
  check('AV6 a plain-number metric (survivor_cpu_ms) with --p95-metric none gives a verdict and n/a', rCount.status === 0 && !!jc && jc.p95_a === 'n/a' && jc.mA1 === 75, rCount.stderr + JSON.stringify(jc));
  const rCountNoFlag = run(['compare'].concat(specs(countF, ['--metric', 'survivor_cpu_ms'])));
  check('AV6 the same metric without the flag exits 1 with p95-missing', rCountNoFlag.status === 1 && /^p95-missing\b/m.test(rCountNoFlag.stdout + rCountNoFlag.stderr), rCountNoFlag.stdout + rCountNoFlag.stderr);

  // AV5 outcome against git history
  const repo = tmp('repo');
  fs.mkdirSync(repo);
  const git = (args, input) => cp.spawnSync('git', args, { cwd: repo, encoding: 'utf8', input: input, env: Object.assign({}, process.env, { GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.invalid', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.invalid' }) });
  git(['init', '-q', '-b', 'main']);
  fs.writeFileSync(path.join(repo, 'a.txt'), 'one\n');
  git(['add', 'a.txt']); git(['commit', '-q', '-m', 'base']);
  fs.writeFileSync(path.join(repo, 'a.txt'), 'two\n');
  git(['commit', '-q', '-am', 'the fix']);
  const fixSha = git(['rev-parse', 'HEAD']).stdout.trim();
  const keepReading = tmp('read-keep.json');
  const ngReading = tmp('read-ng.json');
  fs.writeFileSync(keepReading, JSON.stringify({ verdict: 'KEEP' }));
  fs.writeFileSync(ngReading, JSON.stringify({ verdict: 'NO-GAIN' }));
  const oc = (reading) => run(['outcome', '--readings', reading, '--fix-sha', fixSha, '--repo', repo]);
  const o1 = oc(keepReading);
  check('AV5 KEEP with the fix commit in place exits 0', o1.status === 0, o1.stdout + o1.stderr);
  const o3 = oc(ngReading);
  check('AV5 NO-GAIN without a revert exits 1', o3.status === 1, o3.stdout + o3.stderr);
  git(['revert', '--no-edit', 'HEAD']);
  const o2 = oc(keepReading);
  check('AV5 the same KEEP reading after a revert commit exits 1', o2.status === 1, o2.stdout + o2.stderr);
  const o4 = oc(ngReading);
  check('AV5 NO-GAIN with a revert commit exits 0', o4.status === 0, o4.stdout + o4.stderr);
  const oBad = run(['outcome', '--readings', keepReading, '--fix-sha', 'f'.repeat(40), '--repo', repo]);
  check('AV5 an unknown fix sha exits 1 and names the reason', oBad.status === 1 && /unknown-sha/.test(oBad.stdout + oBad.stderr), oBad.stdout + oBad.stderr);
  check('AV5 outcome text holds no path', [o1, o2, o3, o4].every((r) => (r.stdout + r.stderr).indexOf(scratch) < 0));

  // text of all runs: no path
  check('AV3 compare output holds no scratch path', (r1.stdout + r1.stderr + r3.stdout + r3m.stdout).indexOf(scratch) < 0);
}

try { main(); } catch (e) { failed += 1; process.stdout.write('  FAIL unexpected error :: ' + String(e && e.stack || e).slice(0, 600) + '\n'); }
try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
if (failed === 0) { process.stdout.write('ab-verdict: ALL PASS\n'); process.exit(0); }
process.stdout.write('ab-verdict: ' + failed + ' FAILED\n');
process.exit(1);
