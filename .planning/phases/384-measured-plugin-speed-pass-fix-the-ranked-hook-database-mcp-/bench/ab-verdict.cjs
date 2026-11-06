#!/usr/bin/env node
'use strict';
/*
 * Phase 384 plan 12: the verdict tool for the Wave 2 before and after runs. Node built-ins only. Hyphens only.
 *
 * Use:
 *   node ab-verdict.cjs compare --set1-a FILE#ID --set1-b FILE#ID --set2-a FILE#ID --set2-b FILE#ID
 *        [--metric PATH] [--p95-metric PATH|none] [--floor MS] [--label TEXT] [--out FILE] [--markdown] [--expect WORD]
 *   node ab-verdict.cjs outcome --readings FILE --fix-sha SHA [--repo DIR]
 *
 * A is the tree before the fix. B is the tree after the fix. Set 1 and set 2 are two separate runs of the same A/B pair.
 * FILE is a result file of schema mos.perf-384/1. ID is a target id in it. PATH is a dotted path inside the target;
 * the leaf is a number or an object with a `median` key. The default metric is wall_ms.median and the default floor is 50.
 *
 * The rule. Per set k, d(k) = mA(k) minus mB(k): a positive d means tree B is smaller. The noise is
 * |mA1 minus mA2| plus |mB1 minus mB2| (rule R2 of measurements/t02-t05-costs.md). "Above" means strictly above.
 *   WORSE         both differences are below minus twice the noise and below minus the floor.
 *   NO-GAIN       both differences are at most twice the noise (and the case is not WORSE).
 *   NOT-RESOLVED  exactly one difference is above twice the noise.
 *   BELOW-FLOOR   both are above twice the noise, and at least one is at most the floor (owner decision 2: 50 ms).
 *   KEEP          both are above twice the noise and both are above the floor.
 * A difference of exactly twice the noise is not above it. With noise 0 a difference must be above 0.
 *
 * The p95 rule. The p95 path is the metric path with `.median` replaced by `.p95` when it ends in `.median`
 * (wall_ms.median gives wall_ms.p95), otherwise the metric path with `_p95` appended (background_ms gives
 * background_ms_p95). --p95-metric PATH replaces it. A p95 path that does not resolve to a number in a target is a typed
 * error (`p95-missing`). The only way to leave p95 out is --p95-metric none; the table and the JSON then hold `n/a`.
 * The tool never prints null, NaN or undefined.
 *
 * Refusals (exit 1, reason word first, no path in the text): n-short (n below 7), noisy, failed-runs, timed-out (on a
 * blocking target), bad-schema, missing-id, metric-missing, p95-missing.
 *
 * outcome checks that the git history agrees with the verdict in the readings JSON. KEEP: the fix commit is an ancestor
 * of HEAD and no later commit message holds `This reverts commit <sha>`. Any other word: such a revert commit exists.
 */
const fs = require('node:fs');
const cp = require('node:child_process');

const SCHEMA = 'mos.perf-384/1';
const MIN_N = 7;
const DEFAULT_METRIC = 'wall_ms.median';
const DEFAULT_FLOOR = 50;
const WORDS = ['KEEP', 'BELOW-FLOOR', 'NO-GAIN', 'NOT-RESOLVED', 'WORSE'];

class Refusal extends Error {
  constructor(reason, text) { super(reason + ' ' + text); this.reason = reason; this.text = text; }
}

function round6(x) { return Math.round(x * 1e6) / 1e6; }

// dotted path into a target; the leaf is a number or an object with a numeric `median` key
function readMetric(target, metricPath) {
  let cur = target;
  const parts = String(metricPath).split('.');
  for (let i = 0; i < parts.length; i += 1) {
    if (cur === null || typeof cur !== 'object' || !(parts[i] in cur)) return null;
    cur = cur[parts[i]];
  }
  if (typeof cur === 'number' && Number.isFinite(cur)) return cur;
  if (cur && typeof cur === 'object' && typeof cur.median === 'number' && Number.isFinite(cur.median)) return cur.median;
  return null;
}

function p95PathOf(metricPath) {
  if (/\.median$/.test(metricPath)) return metricPath.replace(/\.median$/, '.p95');
  return metricPath + '_p95';
}

function noiseOf(m) { return round6(Math.abs(m.mA1 - m.mA2) + Math.abs(m.mB1 - m.mB2)); }

function verdictOf(x) {
  const d1 = round6(x.d1);
  const d2 = round6(x.d2);
  const t = round6(2 * x.noise);
  const floor = x.floor;
  if (d1 < -t && d2 < -t && d1 < -floor && d2 < -floor) return 'WORSE';
  const up1 = d1 > t;
  const up2 = d2 > t;
  if (!up1 && !up2) return 'NO-GAIN';
  if (up1 !== up2) return 'NOT-RESOLVED';
  if (d1 > floor && d2 > floor) return 'KEEP';
  return 'BELOW-FLOOR';
}

function spreadPctOf(a, b) {
  const mean = (a + b) / 2;
  if (mean === 0) return 0;
  return round6(Math.abs(a - b) / mean * 100);
}

// FILE#ID: split at the last '#'
function parseSpec(role, spec) {
  const i = String(spec || '').lastIndexOf('#');
  if (i <= 0 || i === spec.length - 1) throw new Refusal('missing-id', role + ' needs FILE#ID');
  return { file: spec.slice(0, i), id: spec.slice(i + 1) };
}

function loadTarget(role, spec) {
  const s = parseSpec(role, spec);
  let j;
  try { j = JSON.parse(fs.readFileSync(s.file, 'utf8')); } catch (e) { throw new Refusal('bad-schema', role + ' file is not readable JSON'); }
  if (!j || j.schema !== SCHEMA || !Array.isArray(j.targets)) throw new Refusal('bad-schema', role + ' schema is not ' + SCHEMA);
  const t = j.targets.find((x) => x && x.id === s.id);
  if (!t) throw new Refusal('missing-id', role + ' has no target ' + s.id);
  if (!(typeof t.n === 'number' && t.n >= MIN_N)) throw new Refusal('n-short', role + ' target ' + s.id + ' has n ' + t.n + ', need ' + MIN_N + ' or more');
  if (t.noisy === true) throw new Refusal('noisy', role + ' target ' + s.id + ' is marked noisy');
  if (typeof t.failed_runs === 'number' && t.failed_runs > 0) throw new Refusal('failed-runs', role + ' target ' + s.id + ' has failed runs ' + t.failed_runs);
  if (t.blocking === true && typeof t.timed_out === 'number' && t.timed_out > 0) throw new Refusal('timed-out', role + ' target ' + s.id + ' has timed out runs ' + t.timed_out);
  return { id: s.id, t: t };
}

function parseFlags(argv, valueFlags, boolFlags) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (boolFlags.indexOf(a) >= 0) { out[a.slice(2)] = true; continue; }
    if (valueFlags.indexOf(a) >= 0) {
      if (i + 1 >= argv.length) throw new Refusal('usage', a + ' needs a value');
      out[a.slice(2)] = argv[i + 1];
      i += 1;
      continue;
    }
    throw new Refusal('usage', 'unknown argument ' + a);
  }
  return out;
}

function numText(x) { return String(round6(x)); }

function compare(argv) {
  const f = parseFlags(argv, ['--set1-a', '--set1-b', '--set2-a', '--set2-b', '--metric', '--p95-metric', '--floor', '--label', '--out', '--expect'], ['--markdown']);
  const metric = f.metric || DEFAULT_METRIC;
  const floor = f.floor !== undefined ? Number(f.floor) : DEFAULT_FLOOR;
  if (!Number.isFinite(floor) || floor < 0) throw new Refusal('usage', '--floor needs a number of 0 or more');
  if (f.expect !== undefined && WORDS.indexOf(f.expect) < 0) throw new Refusal('usage', '--expect needs one of ' + WORDS.join(', '));
  const p95Metric = f['p95-metric'] === 'none' ? null : (f['p95-metric'] || p95PathOf(metric));
  const roles = ['set1-a', 'set1-b', 'set2-a', 'set2-b'];
  const tg = {};
  roles.forEach((r) => {
    if (!f[r]) throw new Refusal('usage', '--' + r + ' FILE#ID is required');
    tg[r] = loadTarget(r, f[r]);
  });
  const m = {};
  roles.forEach((r) => {
    const v = readMetric(tg[r].t, metric);
    if (v === null) throw new Refusal('metric-missing', r + ' target ' + tg[r].id + ' has no number at ' + metric);
    m[r] = v;
  });
  const p = {};
  roles.forEach((r) => {
    if (p95Metric === null) { p[r] = 'n/a'; return; }
    const v = readMetric(tg[r].t, p95Metric);
    if (v === null) throw new Refusal('p95-missing', r + ' target ' + tg[r].id + ' has no number at ' + p95Metric + ' (use --p95-metric none for a metric without p95)');
    p[r] = v;
  });
  const mm = { mA1: m['set1-a'], mB1: m['set1-b'], mA2: m['set2-a'], mB2: m['set2-b'] };
  const d1 = round6(mm.mA1 - mm.mB1);
  const d2 = round6(mm.mA2 - mm.mB2);
  const noise = noiseOf(mm);
  const verdict = verdictOf({ d1: d1, d2: d2, noise: noise, floor: floor });
  const big = (x, y) => (p95Metric === null ? 'n/a' : Math.max(x, y));
  const result = {
    verdict: verdict, d1: d1, d2: d2, noise: noise, floor: floor,
    mA1: mm.mA1, mB1: mm.mB1, mA2: mm.mA2, mB2: mm.mB2,
    nA1: tg['set1-a'].t.n, nB1: tg['set1-b'].t.n, nA2: tg['set2-a'].t.n, nB2: tg['set2-b'].t.n,
    p95_a: big(p['set1-a'], p['set2-a']), p95_b: big(p['set1-b'], p['set2-b']),
    spread_a_pct: spreadPctOf(mm.mA1, mm.mA2), spread_b_pct: spreadPctOf(mm.mB1, mm.mB2),
    metric: metric, p95_metric: p95Metric === null ? 'none' : p95Metric,
    label: f.label || '',
  };
  return { result: result, flags: f };
}

function markdownOf(r) {
  const cell = (x) => (typeof x === 'number' ? numText(x) : String(x));
  const head = ['label', 'median A', 'median B', 'p95 A', 'p95 B', 'd1', 'd2', 'noise', 'floor', 'spread A %', 'spread B %', 'verdict'];
  const medA = numText((r.mA1 + r.mA2) / 2);
  const medB = numText((r.mB1 + r.mB2) / 2);
  const row = [r.label || r.metric, medA + ' (' + cell(r.mA1) + ' / ' + cell(r.mA2) + ')', medB + ' (' + cell(r.mB1) + ' / ' + cell(r.mB2) + ')', cell(r.p95_a), cell(r.p95_b), cell(r.d1), cell(r.d2), cell(r.noise), cell(r.floor), cell(r.spread_a_pct), cell(r.spread_b_pct), r.verdict];
  return '| ' + head.join(' | ') + ' |\n|' + head.map(() => '---').join('|') + '|\n| ' + row.join(' | ') + ' |';
}

function lineOf(r) {
  return 'VERDICT ' + r.verdict + ' d1=' + numText(r.d1) + ' d2=' + numText(r.d2) + ' noise=' + numText(r.noise) + ' floor=' + numText(r.floor);
}

function git(repo, args) {
  return cp.spawnSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function outcome(argv) {
  const f = parseFlags(argv, ['--readings', '--fix-sha', '--repo'], []);
  if (!f.readings || !f['fix-sha']) throw new Refusal('usage', 'outcome needs --readings and --fix-sha');
  let rd;
  try { rd = JSON.parse(fs.readFileSync(f.readings, 'utf8')); } catch (e) { throw new Refusal('bad-readings', 'readings file is not readable JSON'); }
  if (!rd || WORDS.indexOf(rd.verdict) < 0) throw new Refusal('bad-readings', 'readings hold no verdict word');
  const repo = f.repo || process.cwd();
  const rp = git(repo, ['rev-parse', '--verify', f['fix-sha'] + '^{commit}']);
  if (rp.status !== 0) throw new Refusal('unknown-sha', 'the fix sha is not a commit of the repository');
  const sha = rp.stdout.trim();
  const anc = git(repo, ['merge-base', '--is-ancestor', sha, 'HEAD']);
  const bodies = git(repo, ['log', '--format=%B%x00', sha + '..HEAD']);
  let reverted = false;
  if (bodies.status === 0) {
    const re = /This reverts commit ([0-9a-f]{7,40})/g;
    let mt;
    while ((mt = re.exec(bodies.stdout)) !== null) { if (sha.indexOf(mt[1]) === 0) reverted = true; }
  }
  if (rd.verdict === 'KEEP') {
    if (anc.status !== 0) return { ok: false, text: 'outcome mismatch: verdict KEEP but the fix commit is not an ancestor of HEAD' };
    if (reverted) return { ok: false, text: 'outcome mismatch: verdict KEEP but a revert commit of the fix exists' };
    return { ok: true, text: 'outcome ok: verdict KEEP and the fix commit is in place' };
  }
  if (!reverted) return { ok: false, text: 'outcome mismatch: verdict ' + rd.verdict + ' but no revert commit of the fix exists' };
  return { ok: true, text: 'outcome ok: verdict ' + rd.verdict + ' and a revert commit of the fix exists' };
}

function main(argv) {
  const sub = argv[0];
  try {
    if (sub === 'compare') {
      const c = compare(argv.slice(1));
      const r = c.result;
      process.stdout.write(lineOf(r) + '\n');
      if (c.flags.markdown) process.stdout.write(markdownOf(r) + '\n');
      if (c.flags.out) fs.writeFileSync(c.flags.out, JSON.stringify(r, null, 2) + '\n');
      if (c.flags.expect && c.flags.expect !== r.verdict) {
        process.stdout.write('expect-mismatch expected ' + c.flags.expect + ' got ' + r.verdict + '\n');
        return 1;
      }
      return 0;
    }
    if (sub === 'outcome') {
      const o = outcome(argv.slice(1));
      process.stdout.write(o.text + '\n');
      return o.ok ? 0 : 1;
    }
    throw new Refusal('usage', 'use compare or outcome; see the header of ab-verdict.cjs');
  } catch (e) {
    if (e instanceof Refusal) {
      process.stdout.write(e.reason + ' ' + e.text + '\n');
      return e.reason === 'usage' ? 2 : 1;
    }
    throw e;
  }
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { verdictOf, noiseOf, readMetric, p95PathOf, spreadPctOf, compare, outcome, main, WORDS, MIN_N, DEFAULT_FLOOR };
