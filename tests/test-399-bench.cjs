#!/usr/bin/env node
'use strict';
// Phase 399 plan 10 task 1 (I-12, D-05): the routing benchmark.
//   BM1  runOfflineBench twice is deep-equal; the result carries the planned keys and flags
//   BM2  foldOf splits commands into 5 folds; no pair is scored by a calibration that saw its own command's fold
//   BM3  ECE and Brier give the hand-computed values on hand cases; every metric is in [0, 1]
//   BM4  scope is the run-step commands that occur in the recorded run; the answer key is the registry
//   BM5  shuffledOrders is fixed per seed, first order is the stable order; provider mode sends 4 orders (jev) or 1 (gemini)
//   BM6  the real transport with the shipped policy refuses with egress_line_off and makes 0 network calls; CLI --live exits 4
//   BM7  the CLI writes only to --out and nothing under data, docs, README.md, CHANGELOG.md
// No network. Hyphens only.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const bench = require(path.join(REPO, 'scripts/bench-decision-routing.cjs'));
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-399-bench-'));
let pass = 0;
let fail = 0;
const pending = [];
function leg(name, fn) {
  pending.push({ name, fn });
}
async function runLegs() {
  for (const { name, fn } of pending) {
    let ok;
    try { ok = await fn(); } catch (e) { ok = 'threw: ' + String(e && e.message); }
    if (ok === true) { pass += 1; console.log('PASS: ' + name); } else { fail += 1; console.log('FAIL: ' + name + ' (' + String(ok) + ')'); }
  }
}
function near(a, b) { return Math.abs(a - b) < 1e-9; }
function inUnit(v) { return typeof v === 'number' && v >= 0 && v <= 1; }

const { fitIsotonic, applyCalibration } = require(path.join(REPO, 'scripts/build-decision-advisor-table.cjs'));
const recorded = JSON.parse(fs.readFileSync(path.join(REPO, 'tests/fixtures/399/recorded-job-command-yes-no.json'), 'utf8'));
const registry = JSON.parse(fs.readFileSync(path.join(REPO, 'data/command-registry.json'), 'utf8'));
const scopeFile = JSON.parse(fs.readFileSync(path.join(REPO, 'data/run-step-capabilities.json'), 'utf8'));

leg('BM1 offline bench is deterministic and has the planned keys', () => {
  const a = bench.runOfflineBench();
  const b = bench.runOfflineBench();
  assert.deepStrictEqual(a, b);
  const need = ['mode', 'scope', 'per_command_top3_recall', 'per_job', 'auc_raw', 'ece_raw', 'brier_raw', 'ece_cv', 'brier_cv', 'folds', 'internal_only', 'note'];
  const missing = need.filter((k) => !(k in a));
  if (missing.length) return 'missing ' + missing.join(',');
  if (a.mode !== 'offline' || a.folds !== 5 || a.internal_only !== true) return 'flags';
  if (a.note !== 'not for public quoting (Phase 399 Deferred)') return 'note';
  for (const k of ['commands', 'jobs', 'pairs', 'labelled_pairs']) if (typeof a.scope[k] !== 'number') return 'scope.' + k;
  if (!a.excluding_d07 || a.excluding_d07.removed_pairs !== 26) return 'excluding_d07 ' + JSON.stringify(a.excluding_d07 && a.excluding_d07.removed_pairs);
  if (a.excluding_d07.scope.pairs >= a.scope.pairs) return 'excluding view not smaller';
  for (const j of Object.keys(a.per_job)) {
    const x = a.per_job[j];
    if (typeof x.labelled_in_top3 !== 'number' || !inUnit(x.recall_at_3)) return 'per_job ' + j;
  }
  return true;
});

leg('BM2 five folds, one fold per command', () => {
  const cmds = Array.from(new Set(recorded.pairs.map((p) => p.command)));
  const seen = new Set();
  for (const c of cmds) {
    const f = bench.foldOf(c);
    if (!Number.isInteger(f) || f < 0 || f > 4) return 'range ' + c + ' ' + f;
    if (bench.foldOf(c) !== f) return 'unstable ' + c;
    seen.add(f);
  }
  return seen.size === 5 || 'folds used ' + seen.size;
});

leg('BM2 every scope pair is scored by a calibration fitted without its own fold', () => {
  const scored = bench.scorePairs();
  // Independent recompute from the raw inputs.
  const served = new Map(registry.commands.map((c) => [c.command, new Set(c.serves_jtbd || [])]));
  const all = recorded.pairs.map((p) => ({ command: p.command, job: p.job, p: p.p, y: served.has(p.command) && served.get(p.command).has(p.job) ? 1 : 0, f: bench.foldOf(p.command) }));
  for (let f = 0; f < 5; f += 1) {
    const bp = fitIsotonic(all.filter((x) => x.f !== f).map((x) => [x.p, x.y]));
    for (const s of scored.filter((x) => x.fold === f)) {
      if (!near(s.cv, applyCalibration(bp, s.p))) return 'cv differs for ' + s.command + ' ' + s.job;
    }
  }
  // Leak control: flip every label of one command in a copy of the registry. Its own cv values must not move.
  const target = scored[0].command;
  const flipped = JSON.parse(JSON.stringify(registry));
  for (const c of flipped.commands) {
    if (c.command === target) c.serves_jtbd = scored.filter((x) => x.command === target && x.label === 0).map((x) => x.job);
  }
  const regPath = path.join(scratch, 'registry-flipped.json');
  fs.writeFileSync(regPath, JSON.stringify(flipped));
  const again = bench.scorePairs({ registryPath: regPath });
  const before = scored.filter((x) => x.command === target).map((x) => x.cv).join(',');
  const after = again.filter((x) => x.command === target).map((x) => x.cv).join(',');
  if (before !== after) return 'own-fold label change moved the score of ' + target;
  const others = scored.filter((x) => x.command !== target).map((x) => x.cv).join(',');
  const othersAfter = again.filter((x) => x.command !== target).map((x) => x.cv).join(',');
  return others !== othersAfter || 'control: the flip did not change any other fold (the test cannot see leaks)';
});

leg('BM3 ECE and Brier on hand cases, all in [0, 1]', () => {
  // Points [p, y]: bin 0: (0.05, 0), (0.05, 0) gap 0.05; bin 9: (0.95, 1), (0.95, 0) mean p 0.95, mean y 0.5, gap 0.45.
  // ECE = (2/4) * 0.05 + (2/4) * 0.45 = 0.25.
  const pts = [[0.05, 0], [0.05, 0], [0.95, 1], [0.95, 0]];
  const ece = bench.expectedCalibrationError(pts);
  if (!near(ece, 0.25)) return 'ece ' + ece;
  // Brier = (0.0025 + 0.0025 + 0.0025 + 0.9025) / 4 = 0.227500
  const br = bench.brierScore(pts);
  if (!near(br, 0.2275)) return 'brier ' + br;
  // p = 1.0 falls in the top bin, not out of range.
  if (!near(bench.expectedCalibrationError([[1, 1]]), 0)) return 'p=1 bin';
  const r = bench.runOfflineBench();
  for (const k of ['auc_raw', 'auc_cv', 'ece_raw', 'ece_cv', 'brier_raw', 'brier_cv', 'per_command_top3_recall']) if (!inUnit(r[k])) return k + ' out of range ' + r[k];
  return true;
});

leg('BM4 scope is the run-step commands in the recorded run; answer key is the registry', () => {
  const inRun = new Set(recorded.pairs.map((p) => p.command));
  const expectCommands = scopeFile.commands.filter((c) => inRun.has(c)).length;
  const jobs = new Set(recorded.pairs.map((p) => p.job)).size;
  const r = bench.runOfflineBench();
  if (r.scope.commands !== expectCommands || r.scope.jobs !== jobs || r.scope.pairs !== expectCommands * jobs) return JSON.stringify(r.scope);
  const served = new Map(registry.commands.map((c) => [c.command, new Set(c.serves_jtbd || [])]));
  const scopeSet = new Set(scopeFile.commands);
  let labelled = 0;
  for (const p of recorded.pairs) if (scopeSet.has(p.command) && served.has(p.command) && served.get(p.command).has(p.job)) labelled += 1;
  return r.scope.labelled_pairs === labelled || 'labelled ' + r.scope.labelled_pairs + ' vs ' + labelled;
});

leg('BM5 shuffledOrders: k permutations, fixed per seed, first is the stable order', () => {
  const opts = ['/mos:c', '/mos:a', '/mos:d', '/mos:b', '/mos:e'];
  const o = bench.shuffledOrders(opts, 4, 'validate-idea');
  if (o.length !== 4) return 'count ' + o.length;
  if (JSON.stringify(o[0]) !== JSON.stringify(opts.slice().sort())) return 'first not stable order';
  if (new Set(o.map((x) => JSON.stringify(x))).size !== 4) return 'not distinct';
  for (const x of o) if (JSON.stringify(x.slice().sort()) !== JSON.stringify(opts.slice().sort())) return 'not a permutation';
  if (JSON.stringify(o) !== JSON.stringify(bench.shuffledOrders(opts, 4, 'validate-idea'))) return 'not fixed for a seed';
  if (JSON.stringify(o) === JSON.stringify(bench.shuffledOrders(opts, 4, 'explore'))) return 'seed has no effect';
  const two = bench.shuffledOrders(['/mos:a', '/mos:b'], 4, 's');
  return two.length === 2 || 'capped at the number of permutations: ' + two.length;
});

function fakeTransport(log) {
  return async (req, opts) => {
    log.push({ job: req.context.job_id, options: req.questions.q0001.options.slice(), provider: opts.provider });
    const ids = req.questions.q0001.options;
    const probabilities = {};
    // Deterministic, order independent: hash-like value from the id alone. none_of_these gets a value too.
    ids.forEach((id) => { probabilities[id] = ((id.length * 7 + id.charCodeAt(id.length - 1)) % 50) / 100; });
    probabilities.none_of_these = 0.01;
    return { ok: true, answers: { q0001: { type: 'choice', probabilities, choice: ids[0], confidence: 0.5 } }, usage: { input_tokens: 3, output_tokens: 2 }, requests: 1 };
  };
}

leg('BM5 provider mode: jev sends 4 orders per job, gemini sends 1', async () => {
  const logJ = [];
  const rj = await bench.runProviderBench({ provider: 'jev', transport: fakeTransport(logJ) });
  if (!rj.ok) return 'jev refused ' + rj.reason;
  const jobs = new Set(logJ.map((x) => x.job));
  if (rj.orders !== 4 || logJ.length !== jobs.size * 4) return 'jev sends ' + logJ.length + ' for ' + jobs.size + ' jobs';
  for (const j of jobs) {
    const mine = logJ.filter((x) => x.job === j).map((x) => JSON.stringify(x.options));
    if (new Set(mine).size !== 4) return 'orders not distinct for ' + j;
    if (JSON.stringify(logJ.find((x) => x.job === j).options) !== JSON.stringify(logJ.find((x) => x.job === j).options.slice().sort())) return 'first order not stable';
  }
  // Averaging: the fake gives order-independent values, so the average equals one answer.
  if (!inUnit(rj.mean_job_recall_at_3)) return 'recall range';
  if (rj.usage.input_tokens !== 3 * logJ.length) return 'usage not summed';
  const logG = [];
  const rg = await bench.runProviderBench({ provider: 'gemini', transport: fakeTransport(logG) });
  if (!rg.ok) return 'gemini refused ' + rg.reason;
  if (rg.orders !== 1 || logG.length !== jobs.size) return 'gemini sends ' + logG.length;
  return true;
});

leg('BM5 provider mode: probabilities are averaged over the 4 orders', async () => {
  // The first listed option gets 0.9, the rest 0.1. A command that is first in m of the 4 orders averages (0.9 m + 0.1 (4 - m)) / 4.
  const positional = async (req) => {
    const ids = req.questions.q0001.options;
    const probabilities = {};
    ids.forEach((id, i) => { probabilities[id] = i === 0 ? 0.9 : 0.1; });
    return { ok: true, answers: { q0001: { type: 'choice', probabilities, choice: ids[0] } }, usage: { input_tokens: 0, output_tokens: 0 }, requests: 1 };
  };
  const r = await bench.runProviderBench({ provider: 'jev', transport: positional });
  if (!r.ok || r.orders !== 4) return 'jev run';
  for (const j of Object.keys(r.per_job)) {
    const top = r.per_job[j].top3[0];
    const m = (4 * top.p - 0.4) / 0.8;
    if (Math.abs(m - Math.round(m)) > 1e-9 || Math.round(m) < 1 || Math.round(m) > 4) return 'not an average over 4 orders for ' + j + ': ' + top.p;
  }
  const g = await bench.runProviderBench({ provider: 'gemini', transport: positional });
  return (g.ok && g.orders === 1 && g.per_job[Object.keys(g.per_job)[0]].top3[0].p === 0.9) || 'gemini single order';
});

leg('BM6 real transport, shipped policy: egress_line_off and 0 network calls', async () => {
  let calls = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { calls += 1; throw new Error('network call attempted'); };
  try {
    const r = await bench.runProviderBench({ provider: 'jev', base: 'https://example.invalid', env: { TYPESAFE_API_KEY: 'x' } });
    if (r.ok !== false || r.reason !== 'egress_line_off') return JSON.stringify(r);
    const g = await bench.runProviderBench({ provider: 'gemini', base: 'https://example.invalid', env: { GEMINI_API_KEY: 'x' } });
    if (g.ok !== false || g.reason !== 'egress_line_off') return JSON.stringify(g);
  } finally {
    globalThis.fetch = realFetch;
  }
  return calls === 0 || 'network calls ' + calls;
});

leg('BM6 CLI --provider jev --live exits 4; without --live it exits 2', () => {
  const live = spawnSync(process.execPath, [path.join(REPO, 'scripts/bench-decision-routing.cjs'), '--provider', 'jev', '--live'], { encoding: 'utf8', cwd: REPO });
  if (live.status !== 4 || !/egress_line_off/.test(live.stderr)) return 'live exit ' + live.status + ' ' + live.stderr.slice(0, 120);
  const noLive = spawnSync(process.execPath, [path.join(REPO, 'scripts/bench-decision-routing.cjs'), '--provider', 'jev'], { encoding: 'utf8', cwd: REPO });
  return noLive.status === 2 || 'no-live exit ' + noLive.status;
});

leg('BM7 CLI writes to --out only and leaves data, docs, README, CHANGELOG alone', () => {
  const snap = () => spawnSync('git', ['status', '--short', '--', 'data', 'docs', 'README.md', 'CHANGELOG.md'], { encoding: 'utf8', cwd: REPO }).stdout;
  const before = snap();
  const out = path.join(scratch, 'out.json');
  const r = spawnSync(process.execPath, [path.join(REPO, 'scripts/bench-decision-routing.cjs'), '--head', 'abc1234', '--out', out], { encoding: 'utf8', cwd: REPO });
  if (r.status !== 0) return 'exit ' + r.status + ' ' + r.stderr.slice(0, 200);
  if (!fs.existsSync(out)) return 'no out file';
  const j = JSON.parse(fs.readFileSync(out, 'utf8'));
  if (j.head !== 'abc1234' || j.internal_only !== true) return 'out content';
  if (!/not for public quoting/.test(r.stdout)) return 'table lacks the internal label';
  if (snap() !== before) return 'tracked surface changed';
  // Default out path lives under os.tmpdir().
  const def = spawnSync(process.execPath, [path.join(REPO, 'scripts/bench-decision-routing.cjs')], { encoding: 'utf8', cwd: REPO });
  if (def.status !== 0) return 'default exit ' + def.status;
  const m = /wrote (\S+)/.exec(def.stdout);
  if (!m || !m[1].startsWith(os.tmpdir())) return 'default out not under tmpdir: ' + (m && m[1]);
  return snap() === before || 'tracked surface changed by default run';
});

runLegs().then(() => {
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  process.exit(fail ? 1 : 0);
});
