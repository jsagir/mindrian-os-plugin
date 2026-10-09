'use strict';
const path = require('node:path'); const fs = require('node:fs'); const os = require('node:os');
const S = require('./_stubs.cjs'); const check = S.check;
S.extra['gray-matter'] = function (raw) { const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/); return { data: m ? JSON.parse(m[1]) : {}, content: m ? m[2] : raw }; };
const evals = fs.mkdtempSync(path.join(os.tmpdir(), 'eureka-evals-'));
process.env.EUREKA_EVALS_DIR = evals; process.env.EUREKA_SWAP_INVARIANCE_FLOOR = '0'; process.env.EUREKA_ENTITY_MIN = '0';
fs.mkdirSync(path.join(evals, 'cases'), { recursive: true }); fs.mkdirSync(path.join(evals, 'opportunity-drafts'), { recursive: true });
const cards = ['archimedes-sterling', 'archimedes-uq', 'archimedes-darkmatter', 'davinci-salient', 'lovelace-lean', 'nichefoods-null'];
const golds = { 'archimedes-sterling': 'transferable', 'archimedes-uq': 'transferable', 'archimedes-darkmatter': 'general_shallow', 'davinci-salient': 'transferable', 'lovelace-lean': 'transferable', 'nichefoods-null': 'pseudoscience' };
cards.forEach(function (c) { fs.writeFileSync(path.join(evals, 'cases', c + '.md'), '---\n' + JSON.stringify({ gold_label: { salient: golds[c] }, hypothesis_in: 'hyp ' + c, destination: 'Valve ' + c + ' regulates flow using Bernoulli pressure at NASA Houston' }) + '\n---\nbody'); });
['pair-1-arrhythmias', 'pair-2-cerebral-aneurysm'].forEach(function (d) { fs.writeFileSync(path.join(evals, 'opportunity-drafts', d + '.md'), '---\n' + JSON.stringify({ quantities_sourced: true }) + '\n---\n<!-- READ-ONLY-FIXTURE -->\nThe ' + d + ' device couples Kalman filtering at Mayo with the Heimlich maneuver at Mercy.'); });
const baseP = path.join(evals, '212-critic-baseline.json');
fs.writeFileSync(baseP, JSON.stringify({ status: 'baseline_deferred', embedding_model: null, buckets: {} }));

const pkg = path.join(__dirname, '../..');
const R = require(path.join(pkg, 'scripts/eureka-critic-run.cjs'));
// The original script hardcodes REPO_ROOT/evals, so run a private copy of it in a temp tree (never inside _baseline/orig).
const origRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eureka-orig-'));
['scripts', 'lib/core', 'data'].forEach(function (d) { fs.mkdirSync(path.join(origRoot, d), { recursive: true }); });
fs.copyFileSync(path.join(pkg, '../_baseline/orig/eureka/scripts/eureka-critic-run.cjs'), path.join(origRoot, 'scripts/eureka-critic-run.cjs'));
fs.copyFileSync(path.join(pkg, '../_baseline/orig/eureka/lib/core/eureka-critic.cjs'), path.join(origRoot, 'lib/core/eureka-critic.cjs'));
fs.copyFileSync(path.join(pkg, '../_baseline/orig/eureka/data/eureka-critic-tags.json'), path.join(origRoot, 'data/eureka-critic-tags.json'));
const O = require(path.join(origRoot, 'scripts/eureka-critic-run.cjs'));
function capture(fn) { const w = process.stdout.write; let out = ''; process.stdout.write = function (s) { out += s; return true; }; return Promise.resolve(fn()).then(function (r) { process.stdout.write = w; return { r: r, out: out }; }, function (e) { process.stdout.write = w; throw e; }); }

(async function () {
  const pa = R.parseArgv(['--emit-prompts', '--seed', 'S', '--repeats', '2', '--bogus', '--workdir', 'x']);
  check('parseArgv new flags', pa.mode === 'emit-prompts' && pa.seed === 'S' && pa.repeats === 2 && pa.unknown[0] === '--bogus' && pa.workdir === 'x');
  check('parseArgv original contract', JSON.stringify(Object.keys(O.parseArgv([])).sort()) === JSON.stringify(['answers', 'help', 'mode', 'workdir']));
  check('repeats clamp/invalid', R.parseArgv(['--repeats', 'x']).repeats === 1 && R.parseArgv(['--repeats', '99']).repeats === 9);

  const wd = path.join(evals, 'work');
  let { r } = await capture(function () { return R.main(['--emit-prompts', '--workdir', wd, '--seed', 'S', '--repeats', '2']); });
  check('emit exit 0', r === 0);
  const man = JSON.parse(fs.readFileSync(path.join(wd, 'manifest.json'), 'utf8'));
  check('manifest provenance', man.seed === 'S' && man.repeats === 2 && man.node_version === process.version && man.prompt_max_chars === 8000);
  const stageB = man.candidates.filter(function (c) { return c.stage_a_pass; });
  check('all 8 candidates reach stage B with permissive floors', stageB.length === 8, String(stageB.length));
  const f0 = fs.readFileSync(stageB[0].prompt_files.neutral, 'utf8');
  const f1 = fs.readFileSync(stageB[0].prompt_files.replicates[1].neutral, 'utf8');
  const crit = require(path.join(pkg, 'lib/core/eureka-critic.cjs'));
  check('prompt file equals critic builder output (no private copy)', f0 === crit.buildNeutralPrompt({ mechanismText: 'Valve archimedes-sterling regulates flow using Bernoulli pressure at NASA Houston', mappingStatement: 'hyp archimedes-sterling' }, { seed: 'S:0' }) + '\n');
  check('replicate 1 uses a different seeded item order or same set', f1.indexOf('(a)') !== -1 && stageB[0].prompt_files.replicates.length === 2);

  // answers: pair-1 disagreement on b between neutral and adversarial (run 0), pair-2 agree
  const yes = { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1 };
  const answers = {};
  stageB.forEach(function (c) { answers[c.name] = { runs: [{ neutral: yes, adversarial: yes }, { neutral: yes, adversarial: yes }] }; });
  answers['pair-1-arrhythmias'] = { runs: [{ neutral: yes, adversarial: Object.assign({}, yes, { b: 0 }) }, { neutral: yes, adversarial: Object.assign({}, yes, { b: 0 }) }] };
  answers['nichefoods-null'] = { runs: [{ neutral: Object.assign({}, yes, { f: 0 }), adversarial: Object.assign({}, yes, { f: 0 }) }, { neutral: Object.assign({}, yes, { f: 0 }), adversarial: Object.assign({}, yes, { f: 0 }) }] };
  answers['archimedes-uq'] = { runs: [{ neutral: yes, adversarial: yes }, { neutral: Object.assign({}, yes, { a: 'no' }), adversarial: yes }] }; // unstable across replicates
  const ap = path.join(evals, 'answers.json'); fs.writeFileSync(ap, JSON.stringify(answers));
  const res = await capture(function () { return R.main(['--score', '--answers', ap, '--workdir', wd]); });
  check('score exit 0', res.r === 0, res.out);
  const report = fs.readFileSync(path.join(evals, '212-calibration-report.md'), 'utf8');
  check('report has seed/repeats provenance', /Rubric order seed \| S/.test(report) && /Judge repeats per pass \| 2/.test(report));
  check('report: computed disagreement for pair-1 (item b)', /pair-1-arrhythmias: neutral `111111` vs adversarial `101111`.*disagree on item\(s\) b/.test(report));
  check('report: pair-2 agreement computed, not asserted', /pair-2-cerebral-aneurysm: .*agree on every item/.test(report));
  check('report: no hard-coded EmboGel narrative', report.indexOf('EmboGel') === -1);
  check('report: wilson column', /wilson95 low-high/.test(report));
  check('report: gold match table has unstable replicate as x', /archimedes-uq[^\n]*\| 1x1111 /.test(report) || /archimedes-uq[^\n]*x/.test(report));
  check('report has no em dash', report.indexOf('\u2014') === -1);
  let base = JSON.parse(fs.readFileSync(baseP, 'utf8'));
  check('baseline buckets populated, status deferred', base.status === 'baseline_deferred' && base.buckets['111111'] && base.buckets['111111'].n >= 3);
  check('uq unstable bucket not populated (x pattern)', !Object.keys(base.buckets).some(function (k) { return k.indexOf('x') !== -1; }));

  // human approval must survive a re-score
  base.status = 'calibrated'; base.approved_at = '2026-10-01'; base.gold_accuracy = 0.9; base.buckets = { keep: { n: 9, correct: 9 } };
  fs.writeFileSync(baseP, JSON.stringify(base));
  const res2 = await capture(function () { return R.main(['--score', '--answers', ap, '--workdir', wd]); });
  const after = JSON.parse(fs.readFileSync(baseP, 'utf8'));
  check('2026: calibrated baseline preserved on re-score', after.status === 'calibrated' && after.approved_at === '2026-10-01' && after.buckets.keep && /baseline NOT overwritten/.test(res2.out));
  const res3 = await capture(function () { return R.main(['--score', '--answers', ap, '--workdir', wd, '--force-recalibrate']); });
  const forced = JSON.parse(fs.readFileSync(baseP, 'utf8'));
  check('--force-recalibrate replaces and clears stale approval', forced.status === 'baseline_deferred' && forced.approved_at === undefined && forced.gold_accuracy === undefined && !forced.buckets.keep);
  // original behaviour (bug demonstration)
  fs.cpSync(evals, path.join(origRoot, 'evals', 'eureka'), { recursive: true });
  fs.writeFileSync(path.join(origRoot, 'evals', 'eureka', '212-critic-baseline.json'), JSON.stringify(Object.assign({}, after)));
  const ans1 = {}; stageB.forEach(function (c) { ans1[c.name] = { neutral: yes, adversarial: yes }; });
  const ap1 = path.join(evals, 'answers1.json'); fs.writeFileSync(ap1, JSON.stringify(ans1));
  await capture(function () { return O.main(['--score', '--answers', ap1, '--workdir', path.join(origRoot, 'evals', 'eureka', 'work')]); });
  const origAfter = JSON.parse(fs.readFileSync(path.join(origRoot, 'evals', 'eureka', '212-critic-baseline.json'), 'utf8'));
  check('ORIGINAL reset a calibrated baseline to deferred (bug)', origAfter.status === 'baseline_deferred' && origAfter.approved_at === '2026-10-01');

  // legacy answers shape still works with the new runner
  fs.writeFileSync(baseP, JSON.stringify({ status: 'baseline_deferred', embedding_model: null, buckets: {} }));
  const wd2 = path.join(evals, 'work2'); await capture(function () { return R.main(['--emit-prompts', '--workdir', wd2]); });
  const res4 = await capture(function () { return R.main(['--score', '--answers', ap1, '--workdir', wd2]); });
  check('legacy {neutral,adversarial} answers still score', res4.r === 0 && /gold-card accuracy = /.test(res4.out), res4.out);
  const rep2 = fs.readFileSync(path.join(evals, '212-calibration-report.md'), 'utf8');
  check('no-seed report says fixed order', /none \(fixed a-f order\)/.test(rep2));
  const miss = await capture(function () { return R.main(['--score', '--answers', ap1]); });
  check('score without workdir -> exit 1', miss.r === 1);
  check('help exit 0, no mode exit 1', (await capture(function () { return R.main(['--help']); })).r === 0 && (await capture(function () { return R.main([]); })).r === 1);
  const dn = R.draftNarrative([]); check('narrative handles no drafts', /no drafts/.test(dn));
  fs.rmSync(evals, { recursive: true, force: true }); fs.rmSync(origRoot, { recursive: true, force: true });
  S.done('test-critic-run');
})();
