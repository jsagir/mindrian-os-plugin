#!/usr/bin/env node
'use strict';
/*
 * scripts/bench-decision-routing.cjs -- Phase 399 Plan 10 Task 1 (I-12, D-05).
 *
 * Internal routing benchmark for the decision advisor. Dev-time only. Not for public quoting
 * (Phase 399 Deferred): output goes to --out (default under os.tmpdir()) and to the terminal.
 * It writes nothing under data/, docs/, README.md or CHANGELOG.md.
 *
 * Offline mode (default): no model call, no network.
 *   Scope: the commands of data/run-step-capabilities.json that occur in the recorded run, crossed with
 *   the jobs of the recorded run. Answer key: the current registry serves_jtbd.
 *   Calibration: isotonic fit (fitIsotonic from build-decision-advisor-table.cjs), 5 folds by command.
 *   Every scope pair is scored by a calibration fitted without its own command's fold.
 *   Metrics: top-3 recall, AUC (rocAuc from lib/core/navigation/calibration-gate.cjs), ECE (10 bins), Brier.
 *   Two views: all labels, and the same pipeline with the 26 D-07 labels removed from the evaluation
 *   and the fit. The 26 labels came from the same model run as the recorded probabilities, so the first
 *   view is circular; the second removes that circularity for those pairs.
 *
 * Provider mode (--provider gemini|jev --live): one next_command_v1 choice question per job over the scope
 *   commands. A provider that keeps option order (Jev) gets 4 fixed shuffled orders, probabilities averaged.
 *   A provider that sorts options itself (Gemini) gets 1 order. Every send goes through
 *   scripts/decision-advisor-transport.cjs, which checks the labels-only validator and the egress line.
 *   While the decision_advisor line is off, the run refuses with egress_line_off.
 *
 * Flags: --out <path> --head <sha> --provider gemini|jev --live --json --base <url> --model <id>
 * Exit codes: 0 ok, 2 bad usage or labels_only_refused, 3 input absent, 4 egress_line_off,
 *             5 no_key or endpoint_unconfirmed, 6 http_error or bad_response.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const { fitIsotonic, applyCalibration } = require('./build-decision-advisor-table.cjs');
const { rocAuc } = require(path.join(ROOT, 'lib', 'core', 'navigation', 'calibration-gate.cjs'));
const adapter = require(path.join(ROOT, 'lib', 'core', 'decision-advisor', 'adapter.cjs'));
const transportModule = require('./decision-advisor-transport.cjs');

const FOLDS = 5;
const TOP_K = 3;
const ECE_BINS = 10;
const ORDERS_UNSORTED = 4;
const NOTE = 'not for public quoting (Phase 399 Deferred)';
const CIRCULARITY =
  'The 26 D-07 labels came from the same model run as the recorded probabilities. The top-level figures include them and are circular. ' +
  'The excluding_d07 figures remove those 26 pairs from the evaluation and from the calibration fit.';
const EXIT = { labels_only_refused: 2, egress_line_off: 4, no_key: 5, endpoint_unconfirmed: 5, http_error: 6, bad_response: 6 };

function defaults() {
  return {
    recordedPath:
      process.env.MINDRIAN_DECISION_RECORDED ||
      path.join(ROOT, 'tests', 'fixtures', '399', 'recorded-job-command-yes-no.json'),
    registryPath: process.env.MINDRIAN_COMMAND_REGISTRY || path.join(ROOT, 'data', 'command-registry.json'),
    scopePath: path.join(ROOT, 'data', 'run-step-capabilities.json'),
    rulingsPath: path.join(ROOT, 'data', 'job-label-rulings.json'),
  };
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/** Fold of a command: sha256(command) as a number, mod 5. A command lands in exactly one fold. */
function foldOf(command) {
  const hex = crypto.createHash('sha256').update(String(command)).digest('hex');
  return Number(BigInt('0x' + hex) % BigInt(FOLDS));
}

/** Mean squared gap between a probability and a 0/1 label. Range [0, 1]. */
function brierScore(points) {
  if (!points.length) return 0;
  let s = 0;
  for (const [p, y] of points) s += (p - y) * (p - y);
  return s / points.length;
}

/** 10 equal-width bins; sample-weighted absolute gap between mean probability and mean label. Range [0, 1]. */
function expectedCalibrationError(points, bins) {
  const nBins = Number.isInteger(bins) && bins > 0 ? bins : ECE_BINS;
  if (!points.length) return 0;
  const sumP = new Array(nBins).fill(0);
  const sumY = new Array(nBins).fill(0);
  const cnt = new Array(nBins).fill(0);
  for (const [p, y] of points) {
    const b = Math.min(nBins - 1, Math.max(0, Math.floor(p * nBins)));
    sumP[b] += p;
    sumY[b] += y;
    cnt[b] += 1;
  }
  let e = 0;
  for (let b = 0; b < nBins; b += 1) {
    if (cnt[b]) e += (cnt[b] / points.length) * Math.abs(sumP[b] / cnt[b] - sumY[b] / cnt[b]);
  }
  return e;
}

// Seeded stream in [0, 1): sha256(seed|counter), first 4 bytes.
function streamValue(seed, counter) {
  const h = crypto.createHash('sha256').update(String(seed) + '|' + counter).digest();
  return h.readUInt32BE(0) / 4294967296;
}

function factorialCapped(n, cap) {
  let f = 1;
  for (let i = 2; i <= n; i += 1) {
    f *= i;
    if (f >= cap) return cap;
  }
  return f;
}

/**
 * k permutations of options. Fixed for a seed. The first is the stable id order (ascending code point).
 * The rest are distinct Fisher-Yates shuffles driven by a sha256 stream. When there are fewer than k
 * distinct permutations, all of them are returned.
 */
function shuffledOrders(options, k, seed) {
  const base = Array.from(options).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const want = Math.min(k, factorialCapped(base.length, k));
  const orders = [base];
  const seen = new Set([JSON.stringify(base)]);
  let counter = 0;
  let guard = 0;
  while (orders.length < want && guard < 10000) {
    guard += 1;
    const arr = base.slice();
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(streamValue(seed, counter) * (i + 1));
      counter += 1;
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    const key = JSON.stringify(arr);
    if (!seen.has(key)) {
      seen.add(key);
      orders.push(arr);
    }
  }
  return orders;
}

function loadInputs(opts) {
  const o = Object.assign(defaults(), opts || {});
  for (const p of [o.recordedPath, o.registryPath, o.scopePath]) {
    if (!fs.existsSync(p)) {
      const err = new Error('input absent: ' + path.basename(p));
      err.code = 'INPUT_ABSENT';
      throw err;
    }
  }
  const recorded = readJson(o.recordedPath);
  const registry = readJson(o.registryPath);
  const scope = readJson(o.scopePath);
  const served = new Map();
  for (const c of registry.commands) served.set(c.command, new Set(Array.isArray(c.serves_jtbd) ? c.serves_jtbd : []));
  let d07 = null;
  if (o.rulingsPath && fs.existsSync(o.rulingsPath)) {
    const r = readJson(o.rulingsPath);
    if (Array.isArray(r.accepted)) d07 = new Set(r.accepted.map((a) => a.command + '|' + a.job));
  }
  // Scope (BM4): run-step commands that occur in the recorded run, and the jobs of the recorded run.
  const recordedCommands = new Set(recorded.pairs.map((p) => p.command));
  const scopeSet = new Set(scope.commands.filter((c) => recordedCommands.has(c)));
  const jobs = Array.from(new Set(recorded.pairs.map((p) => p.job))).sort();
  return { recorded, served, scopeSet, jobs, d07 };
}

// Score every scope pair with a calibration fitted without its own command's fold.
// exclude: a Set of "command|job" keys removed from the evaluation and from the fit.
function scoreWith(inputs, exclude) {
  const { recorded, served, scopeSet } = inputs;
  const pairs = recorded.pairs
    .filter((pr) => !(exclude && exclude.has(pr.command + '|' + pr.job)))
    .map((pr) => ({
      job: pr.job,
      command: pr.command,
      p: pr.p,
      label: served.has(pr.command) && served.get(pr.command).has(pr.job) ? 1 : 0,
      fold: foldOf(pr.command),
    }));
  const breaks = [];
  for (let f = 0; f < FOLDS; f += 1) {
    breaks.push(fitIsotonic(pairs.filter((x) => x.fold !== f).map((x) => [x.p, x.label])));
  }
  return pairs
    .filter((x) => scopeSet.has(x.command))
    .map((x) => ({ job: x.job, command: x.command, p: x.p, label: x.label, fold: x.fold, cv: applyCalibration(breaks[x.fold], x.p) }));
}

function cmpName(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

// Metrics over scored scope pairs. rankKey: how ties inside the calibrated value are broken.
function metricsFor(scored) {
  const commands = Array.from(new Set(scored.map((x) => x.command))).sort();
  const jobs = Array.from(new Set(scored.map((x) => x.job))).sort();
  const labelled = scored.filter((x) => x.label === 1);

  // Per command: do the top 3 jobs hold a labelled job?
  function perCommand(tieRaw) {
    let withLabel = 0;
    let hits = 0;
    let baseline = 0;
    for (const c of commands) {
      const mine = scored.filter((x) => x.command === c);
      const nLab = mine.filter((x) => x.label === 1).length;
      if (!nLab) continue;
      withLabel += 1;
      mine.sort((a, b) => b.cv - a.cv || (tieRaw ? b.p - a.p : 0) || cmpName(a.job, b.job));
      if (mine.slice(0, TOP_K).some((x) => x.label === 1)) hits += 1;
      const n = mine.length;
      const k = Math.min(TOP_K, n);
      // Chance of a labelled job in a random top k: 1 - C(n - L, k) / C(n, k).
      let miss = 1;
      for (let i = 0; i < k; i += 1) miss *= Math.max(0, n - nLab - i) / (n - i);
      baseline += 1 - miss;
    }
    return { withLabel, hits, value: withLabel ? hits / withLabel : 0, baseline: withLabel ? baseline / withLabel : 0 };
  }
  const pc = perCommand(false);
  const pcRaw = perCommand(true);

  // Per job: labelled commands in the job's top 3. Order mirrors the shipped table: calibrated value desc, then command name.
  const perJob = {};
  let recallSum = 0;
  let recallJobs = 0;
  for (const j of jobs) {
    const mine = scored.filter((x) => x.job === j).sort((a, b) => b.cv - a.cv || cmpName(a.command, b.command));
    const nLab = mine.filter((x) => x.label === 1).length;
    const inTop = mine.slice(0, TOP_K).filter((x) => x.label === 1).length;
    const recall = nLab ? inTop / Math.min(TOP_K, nLab) : 0;
    perJob[j] = { labelled: nLab, labelled_in_top3: inTop, recall_at_3: recall };
    if (nLab) {
      recallSum += recall;
      recallJobs += 1;
    }
  }

  const raw = scored.map((x) => [x.p, x.label]);
  const cv = scored.map((x) => [x.cv, x.label]);
  return {
    scope: { commands: commands.length, jobs: jobs.length, pairs: scored.length, labelled_pairs: labelled.length },
    per_command_top3_recall: pc.value,
    per_command_top3_detail: { commands_with_label: pc.withLabel, hits: pc.hits },
    per_command_top3_recall_raw_rank: pcRaw.value,
    baseline_random_top3_recall: pc.baseline,
    per_job: perJob,
    mean_job_recall_at_3: recallJobs ? recallSum / recallJobs : 0,
    auc_raw: rocAuc(scored.map((x) => ({ raw_confidence: x.p, ground_truth_label: x.label }))),
    auc_cv: rocAuc(scored.map((x) => ({ raw_confidence: x.cv, ground_truth_label: x.label }))),
    ece_raw: expectedCalibrationError(raw),
    brier_raw: brierScore(raw),
    ece_cv: expectedCalibrationError(cv),
    brier_cv: brierScore(cv),
  };
}

/** Score every scope pair (exported for tests). */
function scorePairs(opts) {
  const inputs = loadInputs(opts);
  return scoreWith(inputs, null);
}

function runOfflineBench(opts) {
  const inputs = loadInputs(opts);
  const all = metricsFor(scoreWith(inputs, null));
  const result = Object.assign({ mode: 'offline' }, all, { folds: FOLDS, internal_only: true, note: NOTE, circularity: CIRCULARITY });
  if (inputs.d07) {
    const scored = scoreWith(inputs, inputs.d07);
    const recordedKeys = new Set(inputs.recorded.pairs.map((p) => p.command + '|' + p.job));
    const removed = Array.from(inputs.d07).filter((k) => recordedKeys.has(k));
    const inScope = removed.filter((k) => inputs.scopeSet.has(k.split('|')[0]));
    const m = metricsFor(scored);
    result.excluding_d07 = Object.assign({ removed_pairs: removed.length, removed_in_scope: inScope.length }, m);
  } else {
    result.excluding_d07 = null;
  }
  return result;
}

/**
 * Provider mode. opts: { provider: 'gemini'|'jev', transport (fn(req, opts) -> result, default the policy gated send),
 * base, model, roomDir, env, ... other send options pass through }.
 */
async function runProviderBench(opts) {
  const o = opts || {};
  const provider = o.provider;
  if (provider !== 'gemini' && provider !== 'jev') return { ok: false, reason: 'labels_only_refused', detail: 'unknown provider' };
  const inputs = loadInputs(o.inputs);
  const commands = Array.from(inputs.scopeSet).sort();
  const jobs = inputs.jobs;
  const sorts = adapter.PROVIDERS[provider].SORTS_OPTIONS === true;
  const k = sorts ? 1 : ORDERS_UNSORTED;
  const ordersByJob = {};
  for (const j of jobs) ordersByJob[j] = shuffledOrders(commands, k, j);
  const send = typeof o.transport === 'function' ? o.transport : transportModule.send;
  const sendOpts = Object.assign({}, o);
  delete sendOpts.transport;
  delete sendOpts.inputs;

  const sums = {}; // job -> command -> { sum, n }
  const usage = { input_tokens: 0, output_tokens: 0 };
  let requests = 0;
  const orderCount = Math.min(k, ...jobs.map((j) => ordersByJob[j].length));
  for (let oi = 0; oi < orderCount; oi += 1) {
    // A neutral request has one job context, so each job's choice question is its own request.
    for (let ji = 0; ji < jobs.length; ji += 1) {
      const job = jobs[ji];
      const req = { context: { job_id: job }, questions: { q0001: { type: 'choice', template: 'next_command_v1', options: ordersByJob[job][oi] } } };
      const r = await send(req, sendOpts);
      if (!r || !r.ok) return { ok: false, reason: r && r.reason ? r.reason : 'bad_response', detail: r && r.detail };
      requests += typeof r.requests === 'number' ? r.requests : 1;
      if (r.usage) {
        usage.input_tokens += r.usage.input_tokens || 0;
        usage.output_tokens += r.usage.output_tokens || 0;
      }
      const ans = r.answers && r.answers.q0001;
      if (!ans || ans.missing || !ans.probabilities) continue;
      sums[job] = sums[job] || {};
      for (const c of Object.keys(ans.probabilities)) {
        if (c === adapter.NONE_OPTION_ID) continue;
        const s = sums[job][c] || { sum: 0, n: 0 };
        s.sum += ans.probabilities[c];
        s.n += 1;
        sums[job][c] = s;
      }
    }
  }

  const perJob = {};
  let recallSum = 0;
  let recallJobs = 0;
  for (const j of jobs) {
    const avg = Object.keys(sums[j] || {}).map((c) => ({ command: c, p: sums[j][c].sum / sums[j][c].n }));
    avg.sort((a, b) => b.p - a.p || cmpName(a.command, b.command));
    const labelledSet = new Set(commands.filter((c) => inputs.served.has(c) && inputs.served.get(c).has(j)));
    const nLab = labelledSet.size;
    const inTop = avg.slice(0, TOP_K).filter((x) => labelledSet.has(x.command)).length;
    const recall = nLab ? inTop / Math.min(TOP_K, nLab) : 0;
    perJob[j] = {
      labelled: nLab,
      labelled_in_top3: inTop,
      recall_at_3: recall,
      answered: avg.length > 0,
      top3: avg.slice(0, TOP_K).map((x) => ({ command: x.command, p: x.p })),
    };
    if (nLab) {
      recallSum += recall;
      recallJobs += 1;
    }
  }
  return {
    ok: true,
    mode: 'provider',
    provider,
    orders: orderCount,
    requests,
    usage,
    scope: { commands: commands.length, jobs: jobs.length },
    per_job: perJob,
    mean_job_recall_at_3: recallJobs ? recallSum / recallJobs : 0,
    internal_only: true,
    note: NOTE,
  };
}

function pct(v) {
  return (v * 100).toFixed(1) + '%';
}

function renderTable(r, head) {
  const lines = [];
  const row = (name, m) => {
    lines.push('  ' + name.padEnd(34) + m);
  };
  lines.push('decision routing benchmark (offline)  head=' + (head || 'unknown') + '  ' + NOTE);
  const block = (title, b) => {
    lines.push('');
    lines.push(title);
    row('scope', b.scope.commands + ' commands, ' + b.scope.jobs + ' jobs, ' + b.scope.pairs + ' pairs, ' + b.scope.labelled_pairs + ' labelled');
    row('per-command top-3 recall', pct(b.per_command_top3_recall) + '  (' + b.per_command_top3_detail.hits + '/' + b.per_command_top3_detail.commands_with_label + ', random ' + pct(b.baseline_random_top3_recall) + ')');
    row('  tie broken by raw p', pct(b.per_command_top3_recall_raw_rank));
    row('mean per-job recall at 3', pct(b.mean_job_recall_at_3));
    row('AUC raw / calibrated (cv)', b.auc_raw.toFixed(3) + ' / ' + b.auc_cv.toFixed(3));
    row('ECE raw / cv', b.ece_raw.toFixed(3) + ' / ' + b.ece_cv.toFixed(3));
    row('Brier raw / cv', b.brier_raw.toFixed(3) + ' / ' + b.brier_cv.toFixed(3));
    for (const j of Object.keys(b.per_job)) {
      const pj = b.per_job[j];
      lines.push('    ' + j.padEnd(24) + 'labelled ' + String(pj.labelled).padStart(2) + '  in top 3: ' + pj.labelled_in_top3 + '  recall ' + pct(pj.recall_at_3));
    }
  };
  block('ALL LABELS (circular: includes the 26 D-07 labels from the same model run)', r);
  if (r.excluding_d07) {
    block('EXCLUDING the 26 D-07 pairs (' + r.excluding_d07.removed_pairs + ' removed, ' + r.excluding_d07.removed_in_scope + ' in scope)', r.excluding_d07);
  }
  return lines.join('\n') + '\n';
}

function parseArgs(argv) {
  const a = { out: null, head: null, provider: null, live: false, json: false, base: null, model: null, error: null };
  for (let i = 0; i < argv.length; i += 1) {
    switch (argv[i]) {
      case '--out': a.out = argv[++i] || null; break;
      case '--head': a.head = argv[++i] || null; break;
      case '--provider': a.provider = argv[++i] || null; break;
      case '--base': a.base = argv[++i] || null; break;
      case '--model': a.model = argv[++i] || null; break;
      case '--live': a.live = true; break;
      case '--json': a.json = true; break;
      default: a.error = 'unknown flag ' + argv[i];
    }
  }
  if (!a.error && a.provider && a.provider !== 'gemini' && a.provider !== 'jev') a.error = 'provider must be gemini or jev';
  if (!a.error && a.live && !a.provider) a.error = '--live needs --provider';
  return a;
}

async function main(argv) {
  const a = parseArgs(argv);
  if (a.error) {
    process.stderr.write('usage error: ' + a.error + '\n');
    return 2;
  }
  if (a.provider) {
    if (!a.live) {
      process.stderr.write('provider mode sends requests: pass --live (the egress line decides)\n');
      return 2;
    }
    const r = await runProviderBench({ provider: a.provider, base: a.base, model: a.model });
    if (!r.ok) {
      process.stderr.write(r.reason + (r.detail ? ': ' + r.detail : '') + '\n');
      return EXIT[r.reason] || 6;
    }
    const outPath = a.out || path.join(os.tmpdir(), 'mindrian-bench-decision-routing-provider.json');
    fs.writeFileSync(outPath, JSON.stringify(Object.assign({ head: a.head }, r), null, 2) + '\n');
    process.stdout.write('provider bench: mean per-job recall at 3 ' + pct(r.mean_job_recall_at_3) + '  (' + NOTE + ')\nwrote ' + outPath + '\n');
    return 0;
  }
  let result;
  try {
    result = runOfflineBench();
  } catch (e) {
    process.stderr.write('bench: ' + (e && e.message ? e.message : String(e)) + '\n');
    return e && e.code === 'INPUT_ABSENT' ? 3 : 1;
  }
  const outPath = a.out || path.join(os.tmpdir(), 'mindrian-bench-decision-routing.json');
  fs.writeFileSync(outPath, JSON.stringify(Object.assign({ head: a.head }, result), null, 2) + '\n');
  if (a.json) process.stdout.write(JSON.stringify(Object.assign({ head: a.head }, result), null, 2) + '\n');
  else process.stdout.write(renderTable(result, a.head) + 'wrote ' + outPath + '\n');
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then(
    (code) => { process.exitCode = code; },
    () => {
      process.stderr.write('bench failed\n');
      process.exitCode = 1;
    }
  );
}

module.exports = {
  runOfflineBench,
  runProviderBench,
  shuffledOrders,
  expectedCalibrationError,
  brierScore,
  foldOf,
  scorePairs,
};
